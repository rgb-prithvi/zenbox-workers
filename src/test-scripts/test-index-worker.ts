import { createClient } from "@supabase/supabase-js";
import { Queue } from "bullmq";
import dotenv from "dotenv";
import { logRedisConnection, redisConnection } from "../config/redis";
import { Database } from "../types/supabase";

dotenv.config();

const email = "prithvi@genaicollective.ai";

async function testIndexWorker() {
  logRedisConnection();

  try {
    // Create the queue
    const emailQueue = new Queue("email-processing", { connection: redisConnection });

    // Initialize Supabase to verify the account exists
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );

    // Verify test email account exists
    const { data: account } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("email", email)
      .single();

    if (!account) {
      throw new Error(`Test account ${email} not found in database`);
    }

    console.log(`Found test account: ${email}`);

    // Test cases
    const testCases = [
      {
        name: "Full Sync Test",
        data: {
          email,
          sync_type: "FULL_SYNC" as const,
          days_to_sync: 3,
        },
      },
      {
        name: "Incremental Sync Test",
        data: {
          email,
          sync_type: "INCREMENTAL_SYNC" as const,
        },
      },
    ];

    // Run test cases
    for (const test of testCases) {
      console.log(`\nRunning ${test.name}...`);

      const jobId = `test-${test.data.sync_type.toLowerCase()}-${Date.now()}`;
      await emailQueue.add(jobId, test.data);

      console.log(`Added job ${jobId} to queue`);

      // Wait for job completion
      const job = await emailQueue.getJob(jobId);
      if (job) {
        console.log(`Waiting for job ${jobId} to complete...`);
        await job.waitUntilFinished(emailQueue);
        const result = await job.getState();
        console.log(`Job ${jobId} finished with state: ${result}`);
      }
    }

    await emailQueue.close();
    console.log("\nAll test cases completed");
  } catch (error) {
    console.error("Error in test:", error);
    throw error;
  }
}

// Run the test if called directly
if (require.main === module) {
  testIndexWorker().catch(console.error);
}

export { testIndexWorker };
