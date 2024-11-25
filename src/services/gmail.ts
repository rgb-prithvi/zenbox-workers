import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { SyncMetrics } from "../types";
import { Database } from "../types/supabase";
import { retryWithBackoff } from "../utils/retry";

type EmailAccount = Database["public"]["Tables"]["email_accounts"]["Row"];
type EmailThread = Database["public"]["Tables"]["email_threads"]["Insert"];
type Email = Database["public"]["Tables"]["emails"]["Insert"];

export class GmailService {
  private oauth2Client;
  private gmail;
  private supabase;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI,
    );

    this.gmail = google.gmail({ version: "v1", auth: this.oauth2Client });
    this.supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );
  }

  async refreshToken(refreshToken: string) {
    if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
      throw new Error("Missing Gmail OAuth credentials in environment");
    }

    try {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GMAIL_CLIENT_ID,
          client_secret: process.env.GMAIL_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token refresh failed: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const now = Date.now();

      return {
        access_token: data.access_token,
        refresh_token: refreshToken,
        expires_at: new Date(now + data.expires_in * 1000).toISOString(),
      };
    } catch (error) {
      console.error("Token refresh error:", error);
      throw error;
    }
  }

  private async setupGmailClient(account: EmailAccount): Promise<string> {
    console.log(`Setting up Gmail client for account: ${account.email}`);

    const expiresAt = new Date(account.expires_at).getTime();
    const now = Date.now();

    if (expiresAt <= now) {
      console.log(`Refreshing token for account: ${account.email}`);

      const { access_token } = await this.refreshToken(account.refresh_token);
      return access_token;
    }

    return account.access_token;
  }

  private async gmailRequest(
    accessToken: string,
    endpoint: string,
    params: Record<string, string>,
  ) {
    const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/${endpoint}`);
    Object.keys(params).forEach((key) => {
      if (params[key]) {
        url.searchParams.append(key, params[key]);
      }
    });

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Gmail API request failed: ${response.status} - ${response.statusText}\n` +
          `Endpoint: ${endpoint}\n` +
          `Error: ${errorText}`,
      );
    }

    return response.json();
  }

  private getHeaderValue(message: any, headerName: string): string {
    return message.payload?.headers?.find((h: any) => h.name === headerName)?.value || "";
  }

  private extractParticipants(messages: any[]): string[] {
    const participants = new Set<string>();

    messages.forEach((message) => {
      ["From", "To", "Cc"].forEach((header) => {
        const value = this.getHeaderValue(message, header);
        if (value) {
          value
            .split(",")
            .map((email) => email.trim())
            .forEach((email) => participants.add(email));
        }
      });
    });

    return Array.from(participants);
  }

  private getEmailBody(payload: any): string {
    if (!payload) return "";

    if (payload.body?.data) {
      return atob(payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === "text/plain" || part.mimeType === "text/html") {
          const body = this.getEmailBody(part);
          if (body) return body;
        }
      }
    }

    return "";
  }

  private async storeThread(accountId: string, thread: any) {
    console.log(`Storing thread ${thread.id} for account ID: ${accountId}`);
    const messages = thread.messages || [];
    if (!messages.length) {
      console.log(`Thread ${thread.id} has no messages, skipping storage.`);
      return;
    }

    const lastMessage = messages[messages.length - 1];
    const threadDate = new Date(parseInt(lastMessage.internalDate));

    const threadSummary = {
      latest_email: {
        from: this.getHeaderValue(lastMessage, "From"),
        snippet: lastMessage.snippet,
        received_at: threadDate.toISOString(),
      },
      participants: this.extractParticipants(messages),
      unread_count: messages.filter((m: any) => m.labelIds?.includes("UNREAD")).length,
    };

    // Store thread
    await this.supabase.from("email_threads").upsert({
      id: thread.id,
      account_id: accountId,
      subject: this.getHeaderValue(lastMessage, "Subject"),
      history_id: lastMessage.historyId,
      last_message_at: threadDate.toISOString(),
      thread_summary: threadSummary,
    });

    // Create emails with content hashes
    const emailsData: Email[] = await Promise.all(messages.map(async (message: any) => {
      const messageDate = new Date(parseInt(message.internalDate));
      const email = {
        id: message.id,
        thread_id: thread.id,
        account_id: accountId,
        from: this.getHeaderValue(message, "From"),
        to: this.getHeaderValue(message, "To").split(",").map((e: string) => e.trim()),
        cc: this.getHeaderValue(message, "Cc").split(",").map((e: string) => e.trim()),
        bcc: this.getHeaderValue(message, "Bcc").split(",").map((e: string) => e.trim()),
        subject: this.getHeaderValue(message, "Subject"),
        body: this.getEmailBody(message.payload),
        snippet: message.snippet,
        is_read: !message.labelIds?.includes("UNREAD"),
        received_at: messageDate.toISOString(),
      };

      // Generate content hash
      const contentHash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          `${email.subject}|${email.from}|${email.body}|${email.received_at}`
        )
      ).then(hash => Buffer.from(hash).toString("hex"));

      return {
        ...email,
        content_hash: contentHash
      };
    }));

    // Process in chunks
    const chunkSize = 100;
    for (let i = 0; i < emailsData.length; i += chunkSize) {
      const chunk = emailsData.slice(i, i + chunkSize);
      
      try {
        // Attempt to insert all records - duplicates will fail due to unique constraint
        await retryWithBackoff(() => 
          this.supabase
            .from("emails")
            .upsert(chunk, { 
              onConflict: 'content_hash',  // Specify the conflict column
              ignoreDuplicates: true       // Skip records that would violate the constraint
            })
        );
      } catch (error) {
        console.warn(`Some emails were skipped due to duplicates in thread ${thread.id}`);
      }
    }
  }

  private async updateSyncState(accountId: string, historyId: string) {
    console.log(`Updating sync state for account ${accountId} with historyId ${historyId}`);
    const { data, error } = await retryWithBackoff(() =>
      this.supabase.from("email_sync_states").upsert({
        account_id: accountId,
        last_history_id: historyId,
        last_sync_at: new Date().toISOString(),
      })
    );
    
    if (error) {
      console.error('Failed to update sync state:', error);
    } else {
      console.log('Successfully updated sync state:', data);
    }
  }

  async syncNewAccount(email: string, daysToSync: number, metrics: SyncMetrics) {
    console.log(`Starting new account sync for email: ${email}`);
    const { data: account, error } = await this.supabase
      .from("email_accounts")
      .select("*")
      .eq("email", email)
      .single();

    if (error) throw new Error(`No account found for ${email}`);

    const accessToken = await this.setupGmailClient(account);
    let pageToken: string | undefined;

    try {
      do {
        console.log(
          `Fetching messages for account: ${email}, pageToken: ${pageToken || "initial"}`,
        );
        const response = await retryWithBackoff(() =>
          this.gmailRequest(accessToken, "messages", {
            q: `newer_than:${daysToSync}d`,
            pageToken: pageToken || "",
          }),
        );

        const threadIds = new Set(response.messages?.map((m: any) => m.threadId) ?? []);
        console.log(`Found ${threadIds.size} threads to process for account: ${email}`);

        const fetchedThreads = await Promise.all(
          Array.from(threadIds).map((id) =>
            retryWithBackoff(() =>
              this.gmailRequest(accessToken, `threads/${id}`, { format: "full" }),
            ),
          ),
        );

        for (const thread of fetchedThreads) {
          if (thread) {
            await this.storeThread(account.id, thread);
            metrics.threadsProcessed++;
            metrics.emailsProcessed += thread.messages?.length || 0;
          }
        }

        pageToken = response.nextPageToken;

        if (pageToken) {
          await new Promise((r) => setTimeout(r, 1000)); // Rate limiting
        }
      } while (pageToken);

      const profile = await this.gmailRequest(accessToken, "profile", {});
      await this.updateSyncState(account.id, profile.historyId);
    } catch (error) {
      metrics.errors++;
      console.error(`Error syncing new account for email: ${email}`, error);
      throw error;
    }
  }

  async syncChanges(email: string, metrics: SyncMetrics) {
    console.log(`Starting incremental sync for email: ${email}`);
    const { data: account, error } = await this.supabase
      .from("email_accounts")
      .select("*, email_sync_states!inner(*)")
      .eq("email", email)
      .single();

    if (error) throw new Error(`No account found for ${email}`);

    const accessToken = await this.setupGmailClient(account);
    const startHistoryId = account.email_sync_states?.last_history_id;

    if (!startHistoryId) {
      console.log("No history ID found, falling back to full sync");
      return this.syncNewAccount(email, 14, metrics);
    }

    try {
      console.log(`Fetching history changes since ID: ${startHistoryId}`);
      const response = await retryWithBackoff(() =>
        this.gmailRequest(accessToken, "history", {
          startHistoryId: startHistoryId,
        }),
      );

      if (!response.history?.length) {
        console.log("No changes since last sync");
        return;
      }

      const threadIds = new Set<string>();
      response.history.forEach((change: any) => {
        change.messages?.forEach((msg: any) => {
          if (msg.threadId) threadIds.add(msg.threadId);
        });
      });

      for (const threadId of threadIds) {
        const thread = await retryWithBackoff(() =>
          this.gmailRequest(accessToken, `threads/${threadId}`, { format: "full" }),
        );
        if (thread) {
          await this.storeThread(account.id, thread);
          metrics.threadsProcessed++;
          metrics.emailsProcessed += thread.messages?.length || 0;
        }
      }

      await this.updateSyncState(account.id, response.historyId);
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        console.log("History expired, falling back to full sync");
        return this.syncNewAccount(email, 14, metrics);
      }
      metrics.errors++;
      console.error(`Error during incremental sync for email: ${email}`, error);
      throw error;
    }
  }
}
