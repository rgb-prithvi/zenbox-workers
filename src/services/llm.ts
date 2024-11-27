import { createOpenAI } from "@ai-sdk/openai";
import { createClient } from "@supabase/supabase-js";
import { generateObject } from "ai";
import pLimit from "p-limit";
import { z } from "zod";
import { Database } from "../types/supabase";
import SYSTEM_PROMPT from "./prompts";

// Define the response schema using Zod
const responseSchema = z.object({
  email_breakdown: z.string().describe("Detailed analysis of the email content"),
  summary_points: z.array(z.string()).describe("Bullet points summarizing the email"),
  category: z
    .enum([
      "ACTIVE_DISCUSSION",
      "PASSIVE_DISCUSSION",
      "NOTIFICATION",
      "MEETING",
      "NEWSLETTER",
      "MARKETING",
      "NOT_RELEVANT",
    ])
    .describe("The type of email"),
  confidence_score: z.number().min(0).max(1).describe("Confidence score of the classification"),
  reasoning: z.string().describe("Brief explanation for the classification"),
  scheduling_todos: z
    .array(
      z.object({
        what: z.string(),
        when: z.string(),
        with: z.string(),
      }),
    )
    .optional()
    .describe("Calendar-specific actions that need exact time blocks"),
  action_todos: z
    .array(
      z.object({
        action: z.string(),
        deadline: z.string().optional(),
      }),
    )
    .optional()
    .describe("User-specific action items, excluding counterparty responsibilities"),
});

type LLMResponse = z.infer<typeof responseSchema>;

export class LLMService {
  private openai;
  private supabase;
  private readonly systemPrompt: string;
  private limit = pLimit(4);

  constructor(userContext?: string) {
    this.openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    this.supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );

    // Initialize system prompt with user context
    this.systemPrompt = SYSTEM_PROMPT.replace("{{userContext}}", userContext || "");
  }

  private async generatePrompt(emailId: string): Promise<string> {
    const { data: email } = await this.supabase
      .from("emails")
      .select("*")
      .eq("id", emailId)
      .single();

    if (!email) {
      throw new Error(`No email found for ID ${emailId}`);
    }

    return `From: ${email.from}
To: ${email.to?.join(", ")}
Subject: ${email.subject}
Date: ${new Date(email.received_at).toISOString()}
Body: ${email.body_text || email.body_html}`;
  }

  async processEmail(emailId: string): Promise<void> {
    try {
      const prompt = await this.generatePrompt(emailId);

      const { object } = await generateObject({
        model: this.openai("gpt-4o-mini"),
        schema: responseSchema,
        prompt: prompt,
        system: this.systemPrompt,
      });

      const result = responseSchema.parse(object);

      // Get thread_id for this email
      const { data: email } = await this.supabase
        .from("emails")
        .select("thread_id")
        .eq("id", emailId)
        .single();

      if (!email) throw new Error(`Email ${emailId} not found`);

      // Update the classification in the database
      await this.supabase
        .from("thread_classifications")
        .update({
          category: result.category,
          confidence_score: result.confidence_score,
          reasoning: result.reasoning,
          email_breakdown: result.email_breakdown,
          summary_points: result.summary_points,
          scheduling_todos: result.scheduling_todos || [],
          action_todos: result.action_todos || [],
        })
        .eq("thread_id", email.thread_id);
    } catch (error) {
      console.error(`Error processing email ${emailId}:`, error);
      throw error;
    }
  }

  async processBatch(emailIds: string[], concurrency: number = 4): Promise<void> {
    const batchSize = emailIds.length;
    console.log(`Starting batch: ${batchSize} emails (max ${concurrency} concurrent)`);

    this.limit = pLimit(concurrency);

    const processEmailWithLogging = async (emailId: string) => {
      try {
        console.log(`→ Processing: ${emailId}`);
        await this.processEmail(emailId);
        console.log(`✓ Success: ${emailId}`);
      } catch (error) {
        console.error(`✗ Failed: ${emailId}`, error);
      }
    };

    const tasks = emailIds.map((emailId) => this.limit(() => processEmailWithLogging(emailId)));

    await Promise.all(tasks);
    console.log(`Batch complete: ${batchSize} emails processed`);
  }

  async processUnclassifiedEmails(batchSize: number = 10): Promise<void> {
    const { data: emails, error } = await this.supabase
      .from("emails")
      .select(
        `
        id,
        thread_id,
        thread_classifications!inner(is_automated)
      `,
      )
      .eq("thread_classifications.is_automated", false)
      .is("thread_classifications.category", null)
      .limit(batchSize);

    if (error) throw error;

    console.log(`Processing ${emails?.length || 0} unclassified emails`);

    if (emails?.length) {
      await this.processBatch(emails.map((e) => e.id));
    }
  }
}
