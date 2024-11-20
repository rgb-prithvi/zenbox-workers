import { createClient } from "@supabase/supabase-js";
import { Queue } from "bullmq";
import dotenv from "dotenv";
import { Database } from "./types/supabase";

dotenv.config();

const connection = {
  host: process.env.UPSTASH_REDIS_URL!,
  port: 6379,
  password: process.env.UPSTASH_REDIS_TOKEN,
  tls: {
    rejectUnauthorized: false,
  },
};

async function testPipeline() {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  // 1. Create email processing queue
  const emailQueue = new Queue("email-processing", { connection });

  // 2. Get test account
  const { data: account } = await supabase.from("email_accounts").select("*").limit(1).single();

  if (!account) {
    throw new Error("No test account found");
  }

  // 3. Add test job
  const job = await emailQueue.add(
    `test-sync-${Date.now()}`,
    {
      email_account_id: account.id,
      sync_type: "INCREMENTAL_SYNC",
      days_to_sync: 1,
    },
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    },
  );

  console.log(`Added test job: ${job.id}`);

  // 4. Monitor job progress
  const jobInfo = await emailQueue.getJob(job.id!);
  if (jobInfo) {
    jobInfo.progress().then((progress) => {
      console.log(`Initial progress: ${progress}%`);
    });
  }

  // 5. Wait and check results
  setTimeout(async () => {
    const finalJob = await emailQueue.getJob(job.id!);
    if (finalJob) {
      const state = await finalJob.getState();
      const result = await finalJob.getResult();
      console.log("Job final state:", state);
      console.log("Job result:", result);

      // Check classifications
      const { data: classifications } = await supabase
        .from("thread_classifications")
        .select("*")
        .eq("is_automated", false)
        .order("created_at", { ascending: false })
        .limit(5);

      console.log("Recent non-automated classifications:", classifications);
    }
  }, 30000); // Check after 30 seconds
}

testPipeline().catch(console.error);
