// @ts-nocheck
import { LLMService } from "@/services/llm";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

async function testEmailBreakdown() {
  try {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

    // Get a test email
    const { data: email } = await supabase.from("emails").select("id, thread_id").limit(1).single();

    if (!email) {
      console.log("No test email found");
      return;
    }

    console.log(`Testing with email ${email.id}`);

    const llmService = new LLMService();
    await llmService.processEmail(email.id);

    // Verify the result
    const { data: classification } = await supabase
      .from("thread_classifications")
      .select("*")
      .eq("thread_id", email.thread_id)
      .single();

    console.log("\nClassification result:");
    console.log("Category:", classification?.category);
    console.log("Confidence:", classification?.confidence_score);
    console.log("\nEmail Breakdown:", classification?.email_breakdown);
    console.log("\nReasoning:", classification?.reasoning);
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testEmailBreakdown();
