// @ts-nocheck
import { redisConnection } from "@/lib/config/redis";
import { Database } from "@/lib/types/supabase";
import { createClient } from "@supabase/supabase-js";
import { Queue } from "bullmq";
import dotenv from "dotenv";

dotenv.config();

const email = "prithvi@genaicollective.ai";
const userContext = `
User Name: Prithvi

User Context: “My name is Prithvi. I run an AI community called GenAI Collective. A lot of the messages in my inbox are from people in the community, and come in via "Luma", our events hosting platform. Many of these emails are about upcoming events. I specifically run the NYC chapter of the GenAI Collective, so many of the emails from other chapters (Boston, Paris, SF, etc) are not relevant for me, and hence should be marked as "NOT RELEVANT". Messages addressed to GenAI Collective NYC needs my review, as I am the leader of the NYC chapter and therefore the responsible party for the email.”
`;

const checkAccountExists = async (supabase: SupabaseClient<Database>, email: string) => {
  const { data: account } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("email", email)
    .single();

  if (!account) {
    throw new Error(`Test account ${email} not found in database`);
  }

  console.log(`Found test account: ${email}`);
};

async function testIndexWorker() {
  let emailQueue: Queue | null = null;
  try {
    emailQueue = new Queue("email-processing", { connection: redisConnection });

    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );

    await checkAccountExists(supabase, email);

    // Test cases
    const testCases = [
      // {
      //   name: "Full Sync Test",
      //   data: {
      //     email,
      //     sync_type: "FULL_SYNC" as const,
      //     days_to_sync: 2,
      //     user_context: userContext,
      //   },
      // },
      {
        name: "Incremental Sync Test",
        data: {
          email,
          sync_type: "INCREMENTAL_SYNC" as const,
          user_context: userContext,
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
  } finally {
    // Ensure queue is always closed, even if there's an error
    if (emailQueue) {
      await emailQueue.close();
      console.log("Queue connection closed");
    }
  }
}

// Add graceful shutdown handling
process.on("SIGTERM", async () => {
  console.log("Shutting down test script...");
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Shutting down test script...");
  process.exit(0);
});

// Run the test if called directly
if (require.main === module) {
  testIndexWorker().catch(console.error);
}

export { testIndexWorker };
