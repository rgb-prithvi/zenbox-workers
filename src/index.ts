import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";
import { ConnectionOptions, Queue, Worker } from "bullmq";
import dotenv from "dotenv";
import http from "http";
import { EmailClassifier } from "./services/classifier";
import { GmailService } from "./services/gmail";
import { SyncMetrics, WorkerJobData } from "./types";

dotenv.config();

const requiredEnvVars = [
  'GMAIL_CLIENT_ID',
  'GMAIL_CLIENT_SECRET',
  'GMAIL_REDIRECT_URI',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// create redis connection
const host = process.env.UPSTASH_REDIS_URL!;
const token = process.env.UPSTASH_REDIS_TOKEN!;

const redis = new Redis({
  url: host,
  token: token,
});

// Healthcheck server
const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200);
    res.end("OK");
    return;
  }
  res.writeHead(404);
  res.end();
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`);
  console.log(
    "Worker started with connection to:",
    process.env.NODE_ENV === "production" ? redisUrl.hostname : "localhost",
  );
});

// create connection config for bull
const redisUrl = new URL(process.env.UPSTASH_REDIS_URL!);

const connection: ConnectionOptions = {
  host: process.env.NODE_ENV === "production" ? redisUrl.hostname : "localhost",
  port: 6379,
  ...(process.env.NODE_ENV === "production" && {
    password: token,
    tls: {
      rejectUnauthorized: false,
    },
  }),
};

// Add LLM queue setup
const llmQueue = new Queue("llm-processing", { connection });

const worker = new Worker<WorkerJobData>(
  "email-processing",
  async (job) => {
    try {
      const { email, sync_type, days_to_sync } = job.data;
      await job.updateProgress(0);

      // Initialize services
      const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

      // Get account details using email
      console.log("Searching for email account:", email);
      const { data: emailAccount, error } = await supabase
        .from("email_accounts")
        .select("*")
        .eq("email", email)
        .single();

      if (!emailAccount) {
        throw new Error(
          `No account found for email ${email} (Error: ${error?.message || "unknown"})`,
        );
      }

      const gmailService = new GmailService();

      const classifier = new EmailClassifier();

      const metrics: SyncMetrics = {
        startTime: Date.now(),
        threadsProcessed: 0,
        emailsProcessed: 0,
        errors: 0,
        retries: 0,
      };

      // Step 1: Sync emails based on sync type
      console.log(`Starting ${sync_type} for account ${email}`);
      if (!emailAccount) {
        throw new Error(`No account found for ID ${email}`);
      }

      switch (sync_type) {
        case "FIRST_SYNC":
          await gmailService.syncNewAccount(emailAccount.email, days_to_sync || 14, metrics);
          break;
        case "BACKFILL_SYNC":
          await gmailService.syncNewAccount(emailAccount.email, days_to_sync || 30, metrics);
          break;
        case "INCREMENTAL_SYNC":
          await gmailService.syncChanges(emailAccount.email, metrics);
          break;
      }
      await job.updateProgress(33);

      // Step 2: Classify new threads
      console.log("Finding unclassified threads...");
      const { data: unclassifiedThreads } = await supabase
        .from("email_threads")
        .select(
          `
          id,
          subject,
          thread_summary,
          emails!inner (
            id,
            from,
            subject,
            body,
            received_at
          )
        `,
        )
        .eq("account_id", emailAccount.id)
        .not("id", "in", supabase.from("thread_classifications").select("thread_id"))
        .order("last_message_at", { ascending: false });

      console.log(`Found ${unclassifiedThreads?.length || 0} unclassified threads`);

      for (const thread of unclassifiedThreads || []) {
        try {
          const classification = await classifier.classifyThread(thread.id);

          // If thread is not automated, queue it for LLM processing
          if (!classification.is_automated) {
            // Get the latest email from the thread
            const { data: latestEmail } = await supabase
              .from("emails")
              .select("*")
              .eq("thread_id", thread.id)
              .order("received_at", { ascending: false })
              .limit(1)
              .single();

            if (latestEmail) {
              await llmQueue.add(
                `llm-${latestEmail.id}`,
                {
                  email_id: latestEmail.id,
                  thread_id: thread.id,
                  account_id: emailAccount.id,
                  classification_id: classification.id,
                },
                {
                  attempts: 3,
                  backoff: {
                    type: "exponential",
                    delay: 1000,
                  },
                },
              );
            }
          }

          metrics.threadsProcessed++;
        } catch (error) {
          console.error(`Error classifying thread ${thread.id}:`, error);
          metrics.errors++;
        }
      }
      await job.updateProgress(66);

      // Store sync metrics
      await supabase.from("sync_metrics").insert({
        email: emailAccount.email,
        duration_ms: Date.now() - metrics.startTime,
        threads_processed: metrics.threadsProcessed,
        emails_processed: metrics.emailsProcessed,
        error_count: metrics.errors,
        retry_count: metrics.retries,
        success: metrics.errors === 0,
      });

      // Step 3: Process non-automated threads with LLM
      // This will be handled by a separate worker process
      await job.updateProgress(100);

      return {
        success: true,
        metrics: {
          duration_ms: Date.now() - metrics.startTime,
          threads_processed: metrics.threadsProcessed,
          emails_processed: metrics.emailsProcessed,
          errors: metrics.errors,
          retries: metrics.retries,
        },
      };
    } catch (error) {
      console.error("Job failed:", error);
      throw error;
    }
  },
  { connection },
);

// Error handling

interface JobLog {
  jobId: string;
  status: string;
  message: string;
  timestamp: Date;
}

const jobLogs: JobLog[] = [];

worker.on("completed", (job) => {
  jobLogs.push({
    jobId: job?.id ?? "",
    status: "completed",
    message: "Job completed successfully",
    timestamp: new Date(),
  });
  console.table(jobLogs);
});

worker.on("failed", (job, error) => {
  jobLogs.push({
    jobId: job?.id ?? "",
    status: "failed",
    message: error.message,
    timestamp: new Date(),
  });
  console.table(jobLogs);
});

console.log("Worker started...");
