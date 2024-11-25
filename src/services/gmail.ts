import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { SyncMetrics } from "../types";
import { Database } from "../types/supabase";
import { retryWithBackoff } from "../utils/retry";

type EmailAccount = Database["public"]["Tables"]["email_accounts"]["Row"];
type Email = Database["public"]["Tables"]["emails"]["Insert"];
type GmailSystemLabel = Database["public"]["Enums"]["gmail_system_label"];

const GMAIL_SYSTEM_LABELS: Record<string, GmailSystemLabel> = {
  INBOX: 'INBOX',
  SENT: 'SENT',
  DRAFT: 'DRAFT',
  SPAM: 'SPAM',
  TRASH: 'TRASH',
  STARRED: 'STARRED',
  IMPORTANT: 'IMPORTANT',
  UNREAD: 'UNREAD',
  CATEGORY_PERSONAL: 'CATEGORY_PERSONAL',
  CATEGORY_SOCIAL: 'CATEGORY_SOCIAL',
  CATEGORY_PROMOTIONS: 'CATEGORY_PROMOTIONS',
  CATEGORY_UPDATES: 'CATEGORY_UPDATES',
  CATEGORY_FORUMS: 'CATEGORY_FORUMS'
};

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

  private getEmailBody(payload: any): { html: string | null; text: string | null } {
    if (!payload) return { html: null, text: null };

    let htmlContent: string | null = null;
    let textContent: string | null = null;

    // Helper function to decode base64
    const decodeBase64 = (data: string): string => {
      // Replace URL-safe chars and add padding if needed
      const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
      const padding = "=".repeat((4 - (base64.length % 4)) % 4);

      // Decode using TextDecoder to properly handle UTF-8
      const rawData = atob(base64 + padding);
      const decoder = new TextDecoder("utf-8");
      const bytes = new Uint8Array(rawData.length);

      for (let i = 0; i < rawData.length; i++) {
        bytes[i] = rawData.charCodeAt(i);
      }

      return decoder.decode(bytes);
    };

    const processPayloadPart = (part: any) => {
      if (part.body?.data) {
        const content = decodeBase64(part.body.data);
        if (part.mimeType === "text/html") {
          htmlContent = content;
        } else if (part.mimeType === "text/plain") {
          textContent = content;
        }
      }

      if (part.parts) {
        part.parts.forEach(processPayloadPart);
      }
    };

    processPayloadPart(payload);

    return { html: htmlContent, text: textContent };
  }

  private async storeThread(accountId: string, thread: any) {
    const subject = this.getHeaderValue(thread.messages[0], "Subject") || '(no subject)';
    const labels = thread.messages[0].labelIds || [];
    
    // Log the source
    const source = labels.find(label => 
      [GMAIL_SYSTEM_LABELS.INBOX, GMAIL_SYSTEM_LABELS.SENT, GMAIL_SYSTEM_LABELS.DRAFT].includes(label as GmailSystemLabel)
    ) || 'OTHER';
    console.log(`Storing thread "${subject}" from ${source} for account ID: ${accountId}`);

    // Filter out unwanted messages
    if ([GMAIL_SYSTEM_LABELS.DRAFT, GMAIL_SYSTEM_LABELS.SPAM, GMAIL_SYSTEM_LABELS.TRASH].includes(source as GmailSystemLabel)) {
      console.log(`Skipping ${source} thread "${subject}"`);
      return 0;
    }

    const messages = thread.messages || [];
    if (!messages.length) {
      console.log(`Thread "${subject}" has no messages, skipping storage.`);
      return 0;
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
      unread_count: messages.filter((m: any) => m.labelIds?.includes(GMAIL_SYSTEM_LABELS.UNREAD)).length,
    };

    // Store thread
    const { error: threadError } = await this.supabase.from("email_threads").upsert({
      id: thread.id,
      account_id: accountId,
      subject: this.getHeaderValue(lastMessage, "Subject"),
      history_id: lastMessage.historyId,
      last_message_at: threadDate.toISOString(),
      thread_summary: threadSummary,
    });

    if (threadError) {
      console.error(`Error storing thread "${subject}":`, threadError);
      return 0;
    }

    // Create emails with content hashes
    const emailsData: Email[] = await Promise.all(
      messages.map(async (message: any) => {
        const messageDate = new Date(parseInt(message.internalDate));
        const bodyContent = this.getEmailBody(message.payload);
        
        // Filter and validate labels
        const validLabels = (message.labelIds || [])
          .filter((label: string) => label in GMAIL_SYSTEM_LABELS)
          .map(label => label as keyof typeof GMAIL_SYSTEM_LABELS);

        const email = {
          id: message.id,
          thread_id: thread.id,
          account_id: accountId,
          from: this.getHeaderValue(message, "From"),
          to: this.getHeaderValue(message, "To")
            .split(",")
            .map((e: string) => e.trim())
            .filter(Boolean),
          cc: this.getHeaderValue(message, "Cc")
            .split(",")
            .map((e: string) => e.trim())
            .filter(Boolean),
          bcc: this.getHeaderValue(message, "Bcc")
            .split(",")
            .map((e: string) => e.trim())
            .filter(Boolean),
          subject: this.getHeaderValue(message, "Subject"),
          body_html: bodyContent.html,
          body_text: bodyContent.text,
          snippet: message.snippet,
          is_read: !validLabels.includes(GMAIL_SYSTEM_LABELS.UNREAD),
          labels: validLabels,
          received_at: messageDate.toISOString(),
        };

        const contentHash = await crypto.subtle
          .digest(
            "SHA-256",
            new TextEncoder().encode(
              `${email.subject}|${email.from}|${email.body_html}|${email.received_at}`,
            ),
          )
          .then((hash) => Buffer.from(hash).toString("hex"));

        return {
          ...email,
          content_hash: contentHash,
        };
      }),
    );

    let emailsStored = 0;
    const chunkSize = 100;
    for (let i = 0; i < emailsData.length; i += chunkSize) {
      const chunk = emailsData.slice(i, i + chunkSize);

      try {
        const { error: emailError } = await retryWithBackoff(() =>
          this.supabase.from("emails").upsert(chunk, {
            onConflict: "content_hash",
            ignoreDuplicates: true,
          }),
        );

        if (emailError) {
          console.error(`Error storing emails for thread "${subject}":`, emailError);
        } else {
          emailsStored += chunk.length;
          console.log(`Stored ${chunk.length} emails for thread "${subject}"`);
        }
      } catch (error) {
        console.warn(`Some emails were skipped due to duplicates in thread "${subject}"`);
      }
    }

    console.log(`Completed storing thread "${subject}" with ${emailsStored} emails`);
    return emailsStored;
  }

  private async updateSyncState(accountId: string, historyId: string) {
    console.log(`Updating sync state for account ${accountId} with historyId ${historyId}`);
    const { data, error } = await retryWithBackoff(() =>
      this.supabase.from("email_sync_states").insert({
        account_id: accountId,
        last_history_id: historyId,
        sync_type: 'incremental',
        status: 'in_progress',
        emails_synced: 0,
        threads_synced: 0,
        started_at: new Date().toISOString(),
      }),
    );

    if (error) {
      console.error("Failed to create sync state:", error);
    } else {
      console.log("Successfully created sync state:", data);
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

    // Create initial sync state
    const { data: syncState, error: syncStateError } = await this.supabase
      .from("email_sync_states")
      .insert({
        account_id: account.id,
        sync_type: 'full',
        status: 'in_progress',
        started_at: new Date().toISOString(),
        emails_synced: 0,
        threads_synced: 0
      })
      .select()
      .single();

    if (syncStateError) {
      console.error("Failed to create sync state:", syncStateError);
      throw syncStateError;
    }

    const accessToken = await this.setupGmailClient(account);
    let pageToken: string | undefined;

    try {
      let emailsSynced = 0;
      let threadsSynced = 0;
      
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
            const emailsStored = await this.storeThread(account.id, thread);
            metrics.threadsProcessed++;
            metrics.emailsProcessed += emailsStored;
            threadsSynced++;
            emailsSynced += emailsStored;
          }
        }

        pageToken = response.nextPageToken;
        
        // Update sync state periodically
        await this.supabase
          .from("email_sync_states")
          .update({
            emails_synced: emailsSynced,
            threads_synced: threadsSynced
          })
          .eq('id', syncState.id);

        if (pageToken) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      } while (pageToken);

      const profile = await this.gmailRequest(accessToken, "profile", {});
      
      // Update final sync state
      await this.supabase
        .from("email_sync_states")
        .update({
          last_history_id: profile.historyId,
          status: 'completed',
          completed_at: new Date().toISOString(),
          emails_synced: emailsSynced,
          threads_synced: threadsSynced
        })
        .eq('id', syncState.id);

    } catch (error) {
      // Update sync state with error
      await this.supabase
        .from("email_sync_states")
        .update({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString()
        })
        .eq('id', syncState.id);

      metrics.errors++;
      console.error(`Error syncing new account for email: ${email}`, error);
      throw error;
    }
  }

  async syncChanges(email: string, metrics: SyncMetrics) {
    console.log(`Starting incremental sync for email: ${email}`);
    
    // Get the most recent completed sync state for this email
    const { data: syncState, error: syncError } = await this.supabase
      .from("email_sync_states")
      .select("*, email_accounts(*)")
      .eq("email_accounts.email", email)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .single();

    if (syncError) throw new Error(`No sync history found for ${email}`);

    console.log(`Found sync state for account ID: ${syncState.account_id}`);
    console.log(`Last sync state:`, {
      lastHistoryId: syncState.last_history_id,
      lastSyncType: syncState.sync_type,
      lastSyncStatus: syncState.status,
      lastSyncTime: syncState.completed_at
    });

    const accessToken = await this.setupGmailClient(syncState.email_accounts);
    const startHistoryId = syncState.last_history_id;

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

      console.log(`Found ${response.history.length} history records`);
      console.log(`History range: ${startHistoryId} -> ${response.historyId}`);

      const threadIds = new Set<string>();
      response.history.forEach((change: any) => {
        console.log(`Processing history record:`, {
          id: change.id,
          messages: change.messages?.length || 0,
          labelsAdded: change.labelsAdded?.length || 0,
          labelsRemoved: change.labelsRemoved?.length || 0,
        });
        
        change.messages?.forEach((msg: any) => {
          if (msg.threadId) threadIds.add(msg.threadId);
        });
      });

      console.log(`Found ${threadIds.size} unique threads to update`);

      for (const threadId of threadIds) {
        const thread = await retryWithBackoff(() =>
          this.gmailRequest(accessToken, `threads/${threadId}`, { format: "full" }),
        );
        if (thread) {
          await this.storeThread(syncState.account_id, thread);
          metrics.threadsProcessed++;
          metrics.emailsProcessed += thread.messages?.length || 0;
        }
      }

      await this.updateSyncState(syncState.account_id, response.historyId);
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
