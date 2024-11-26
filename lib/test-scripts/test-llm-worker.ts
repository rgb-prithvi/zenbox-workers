import { Queue } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { redisConnection, logRedisConnection } from "./config/redis";

dotenv.config();

async function testLLMWorker() {
  logRedisConnection();
  
  try {
    // Create the queue
    const llmQueue = new Queue("llm-processing", { connection: redisConnection });
    
    // Get some test emails from your database
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const { data: emails } = await supabase
      .from("emails")
      .select("id, thread_id, account_id")
      .limit(3);  // Test with 3 emails

    if (!emails || emails.length === 0) {
      console.log("No emails found to test with");
      return;
    }

    console.log(`Found ${emails.length} emails to test with`);

    // Add test jobs to the queue
    for (const email of emails) {
      const jobId = `test-llm-${email.id}`;
      
      console.log(`Adding job ${jobId} to queue...`);
      
      await llmQueue.add(jobId, {
        email_id: email.id,
        thread_id: email.thread_id,
        account_id: email.account_id,
        classification_id: 'test-classification-id', // You might want to create a real classification first
      });

      console.log(`Added job ${jobId} to queue`);
    }

    console.log("All test jobs added to queue");
    
    // Close the queue
    await llmQueue.close();

  } catch (error) {
    console.error("Error in test:", error);
  }
}

// Run the test
testLLMWorker().catch(console.error); 