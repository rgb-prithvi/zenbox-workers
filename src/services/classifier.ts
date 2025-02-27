import type { Database } from "@/lib/types/supabase";
import { createClient } from "@supabase/supabase-js";

type ThreadClassification = Database["public"]["Tables"]["thread_classifications"]["Row"];
type ThreadClassificationInsert = Database["public"]["Tables"]["thread_classifications"]["Insert"];
type ThreadCategory = Database["public"]["Enums"]["thread_category"];
type EmailThread = Database["public"]["Tables"]["email_threads"]["Row"];

type EmailInput = {
  from: string;
  subject: string;
  body_text?: string;
  body_html?: string;
};

type CategoryResult = {
  category: ThreadCategory;
  confidence: number;
  match_counts: Record<ThreadCategory, number>;
};

interface AutomationIndicators {
  sender_patterns: string[];
  subject_patterns: string[];
  body_patterns: string[];
  footer_patterns: string[];
  marketing_patterns: string[];
  notification_patterns: string[];
  meeting_patterns: string[];
  newsletter_patterns: string[];
}

export class EmailClassifier {
  private supabase;
  private indicators: AutomationIndicators;

  constructor() {
    this.supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );

    this.indicators = {
      sender_patterns: [
        "no[.-]?reply@",
        "notification?@",
        "notifications?@",
        "alert?@",
        "alerts?@",
        "info@",
        "news(?:letter)?@",
        "do-not-reply@",
        "updates?@",
        "support@",
        "hello@",
        "@calendar\\.[a-zA-Z0-9-]+\\.com",
      ],
      subject_patterns: [
        "^\\[?Auto(?:matic|mated)?\\]",
        "newsletter",
        "subscription",
        "confirm(?:ation)?",
        "welcome to",
        "your (?:daily|weekly|monthly) digest",
        "reminder:",
      ],
      body_patterns: [
        "unsubscribe",
        "(?:click|tap) (?:here|below)",
        "view (?:in browser|online)",
        "to stop receiving",
        "email preferences",
        "manage subscriptions?",
        "privacy policy",
        "terms of service",
        "this is an automated",
        "do not reply",
        "you(?:'re| are) receiving this (?:email|message)",
        "opt[ -]out",
      ],
      footer_patterns: [
        "©\\s*\\d{4}",
        "all rights reserved",
        "sent by",
        "powered by",
        "forward (?:this|to a friend)",
        "add us to your address book",
      ],
      marketing_patterns: [
        "special offer",
        "discount",
        "sale",
        "promo(?:tion)?",
        "limited time",
        "exclusive",
        "deal",
        "off your (?:next|first)",
        "\\d+%\\s*off",
        "save\\s+(?:up\\s+to\\s+)?\\$?\\d+",
        "save\\s+(?:up\\s+to\\s+)?\\d+%",
        "free shipping",
        "buy now",
        "shop now",
        "early access",
        "flash sale",
        "clearance",
        "best seller",
        "pricing",
        "offer expires",
      ],
      notification_patterns: [
        "alert",
        "status",
        "update",
        "confirm",
        "verify",
        "deployment",
        "build",
        "security",
        "login",
        "account",
        "payment",
      ],
      meeting_patterns: [
        "^invitation:\\s",
        "^updated invitation:",
        "^accepted:\\s+meeting",
        "^declined:\\s+meeting",
        "^tentatively accepted:",
        "^meeting\\s+request:",
        "^calendar\\s+notification:",

        "meet\\.google\\.com\\/[\\w-]+",
        "zoom\\.us\\/j\\/\\d+",
        "teams\\.microsoft\\.com\\/l\\/meetup-join",

        "calendly\\.com\\/[\\w-]+\\/",
        "your\\s+(?:meeting|appointment)\\s+is\\s+confirmed",

        "when:\\s.*\\d{1,2}:\\d{2}\\s*(?:am|pm|AM|PM)",
        "where:\\s",
        "organizer:\\s",
      ],
      newsletter_patterns: [
        "newsletter",
        "digest",
        "weekly",
        "monthly",
        "roundup",
        "update",
        "latest",
        "news",
        "substack",
        "beehiiv",
        "news(?:letter)?",
      ],
    };
  }

  private analyzeEmail(email: EmailInput) {
    if (!email || typeof email !== "object") {
      throw new Error("Email must be an object");
    }

    const requiredFields = ["from", "subject"];
    if (!requiredFields.every((field) => field in email)) {
      throw new Error(`Email must contain all required fields: ${requiredFields.join(", ")}`);
    }

    const emailFrom = String(email.from).trim();
    const emailSubject = String(email.subject).trim();
    const emailBody = String(email.body_text || email.body_html || "").trim();

    try {
      const matched_patterns: Record<string, string[]> = {
        sender: this.indicators.sender_patterns.filter((pattern) =>
          new RegExp(pattern, "i").test(emailFrom),
        ),
        subject: this.indicators.subject_patterns.filter((pattern) =>
          new RegExp(pattern, "i").test(emailSubject),
        ),
        body: this.indicators.body_patterns.filter((pattern) =>
          new RegExp(pattern, "i").test(emailBody),
        ),
        footer: this.indicators.footer_patterns.filter((pattern) =>
          new RegExp(pattern, "i").test(emailBody),
        ),
      };

      const has_noreply = new RegExp("no[.-]?reply@|do-not-reply@", "i").test(emailFrom);

      let has_unsubscribe = false;
      const unsubscribe_pattern = "(?:^|\\s)unsubscribe(?:\\s|$)";
      const confirmation_patterns = ["click here", "manage", "preferences", "opt[ -]out"];

      if (new RegExp(unsubscribe_pattern, "i").test(emailBody)) {
        has_unsubscribe = confirmation_patterns.some((pattern) =>
          new RegExp(pattern, "i").test(emailBody),
        );
      }

      const total_matches = Object.values(matched_patterns).reduce(
        (sum, matches) => sum + matches.length,
        0,
      );

      const is_automated = has_noreply || has_unsubscribe || total_matches >= 2;

      return {
        is_automated,
        automation_confidence: this.calculateAutomationConfidence(total_matches, {
          no_reply_sender: has_noreply,
          unsubscribe_present: has_unsubscribe,
        }),
        matched_patterns,
        total_matches,
        high_confidence_matches: {
          no_reply_sender: has_noreply,
          unsubscribe_present: has_unsubscribe,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error analyzing email: ${error.message}`);
      }
      throw error;
    }
  }

  private calculateCategoryMatches(subject: string, body: string): Record<ThreadCategory, number> {
    const matches: Record<ThreadCategory, number> = {
      ACTIVE_DISCUSSION: 0,
      PASSIVE_DISCUSSION: 0,
      NOTIFICATION: 0,
      MEETING: 0,
      NEWSLETTER: 0,
      NOT_RELEVANT: 0,
      MARKETING: 0,
    };

    // Map category names to pattern keys
    const categoryToPatternMap: Record<ThreadCategory, keyof AutomationIndicators> = {
      ACTIVE_DISCUSSION: "body_patterns",
      PASSIVE_DISCUSSION: "body_patterns",
      NOTIFICATION: "notification_patterns",
      MEETING: "meeting_patterns",
      NEWSLETTER: "newsletter_patterns",
      NOT_RELEVANT: "body_patterns",
      MARKETING: "marketing_patterns",
    };

    Object.entries(categoryToPatternMap).forEach(([category, patternKey]) => {
      const patterns = this.indicators[patternKey];
      matches[category as ThreadCategory] = patterns.reduce(
        (count, pattern) =>
          count +
          (new RegExp(pattern, "i").test(subject) || new RegExp(pattern, "i").test(body) ? 1 : 0),
        0,
      );
    });

    return matches;
  }

  private checkNewsletterOverride(subject: string, emailFrom: string): boolean {
    return (
      new RegExp("newsletter", "i").test(subject) || new RegExp("newsletter", "i").test(emailFrom)
    );
  }

  private determineCategory(matches: Record<ThreadCategory, number>): [ThreadCategory, number] {
    const max_matches = Math.max(...Object.values(matches));
    if (max_matches === 0) {
      return ["NOTIFICATION" as ThreadCategory, 0.5]; // Default with low confidence
    }

    const winners = Object.entries(matches)
      .filter(([_, count]) => count === max_matches)
      .map(([category]) => category as ThreadCategory);

    if (winners.length === 1) {
      const total_matches = Object.values(matches).reduce((a, b) => a + b, 0);
      const confidence = total_matches > 0 ? max_matches / total_matches : 0.5;
      return [winners[0], confidence];
    }

    // If multiple categories have the same number of matches, default to NOTIFICATION
    return ["NOTIFICATION" as ThreadCategory, 0.5];
  }

  private calculateAutomationConfidence(
    total_matches: number,
    high_confidence_matches: { no_reply_sender: boolean; unsubscribe_present: boolean },
  ): number {
    let base_confidence = Math.min(total_matches / 5.0, 1.0);

    if (high_confidence_matches.no_reply_sender) {
      base_confidence = Math.max(base_confidence, 0.8);
    }
    if (high_confidence_matches.unsubscribe_present) {
      base_confidence = Math.max(base_confidence, 0.7);
    }

    return base_confidence;
  }

  private categorizeAutomatedEmail(
    email: EmailInput,
    skipAutomationCheck: boolean = false,
  ): CategoryResult | null {
    try {
      if (!skipAutomationCheck && !this.analyzeEmail(email).is_automated) {
        return null;
      }

      const emailFrom = String(email.from).trim();
      const emailSubject = String(email.subject).trim();
      const emailBody = String(email.body_text || email.body_html || "").trim();

      const matches = this.calculateCategoryMatches(emailSubject, emailBody);

      if (this.checkNewsletterOverride(emailSubject, emailFrom)) {
        return {
          category: "NEWSLETTER" as ThreadCategory,
          confidence: 1.0,
          match_counts: matches,
        };
      }

      const [category, confidence] = this.determineCategory(matches);

      return {
        category,
        confidence,
        match_counts: matches,
      };
    } catch (error) {
      console.error("Error categorizing email:", error);
      return null;
    }
  }

  async classifyThread(threadId: string): Promise<ThreadClassification> {
    const { data: emails } = await this.supabase
      .from("emails")
      .select("*")
      .eq("thread_id", threadId);

    if (!emails?.length) {
      throw new Error(`No emails found for thread ${threadId}`);
    }

    const latestEmail = emails[emails.length - 1];
    const analysis = this.analyzeEmail({
      from: latestEmail.from,
      subject: latestEmail.subject || "",
      body_text: latestEmail.body_text || "",
      body_html: latestEmail.body_html || "",
    });

    let categoryResult: CategoryResult | null = null;
    if (analysis.is_automated) {
      categoryResult = this.categorizeAutomatedEmail(
        {
          from: latestEmail.from,
          subject: latestEmail.subject || "",
          body_text: latestEmail.body_text || "",
          body_html: latestEmail.body_html || "",
        },
        true,
      );
    }

    // Create classification record
    const classification: ThreadClassificationInsert = {
      thread_id: threadId,
      is_automated: analysis.is_automated,
      category: categoryResult?.category ?? ("NOTIFICATION" as ThreadCategory),
      confidence_score: categoryResult?.confidence || analysis.automation_confidence,
      reasoning: JSON.stringify({
        matched_patterns: analysis.matched_patterns,
        high_confidence_matches: analysis.high_confidence_matches,
      }),
      summary_points: [], // Initialize as empty array
      scheduling_todos: null,
      action_todos: null,
    };

    const { data, error } = await this.supabase
      .from("thread_classifications")
      .insert(classification)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async batchProcessThreads(threads: EmailThread[]) {
    const results: {
      threadId: string;
      classification: ThreadClassification;
    }[] = [];

    for (const thread of threads) {
      try {
        console.log(`\n🔄 Processing thread -- ID: ${thread.id}, Subject: ${thread.subject}`);

        const classification = await this.classifyThread(thread.id);
        console.log(
          `Classification result: ${
            classification.is_automated ? "Automated" : "Not Automated"
          }, ` +
            `Category: ${classification.category}, Confidence: ${classification.confidence_score}`,
        );

        results.push({
          threadId: thread.id,
          classification,
        });
      } catch (error) {
        console.error(`Error processing thread ${thread.id}:`, error);
      }
    }

    return results;
  }
}
