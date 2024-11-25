import { createClient } from "@supabase/supabase-js";
import { Worker } from "bullmq";
import dotenv from "dotenv";
import http from "http";
import { logRedisConnection, redisConnection, redisUrl } from "./config/redis";
import { EmailClassifier } from "./services/classifier";
import { GmailService } from "./services/gmail";
import { LLMService } from "./services/llm";
import { SyncMetrics, WorkerJobData } from "./types";
import { getUnclassifiedThreads } from "./utils/query-utils";

dotenv.config();

const requiredEnvVars = [
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REDIRECT_URI",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_KEY",
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

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

// Add LLM queue setup
logRedisConnection();

const worker = new Worker<WorkerJobData>(
  "email-processing",
  async (job) => {
    try {
      const { email, sync_type, days_to_sync } = job.data;
      console.log(
        `Processing job ${job.id} for email ${email} with sync type ${sync_type} and days to sync ${days_to_sync}`,
      );
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

      if (error || !emailAccount) {
        throw new Error(
          `No account found for email ${email} (Error: ${error?.message || "account not found"})`,
        );
      }

      const gmailService = new GmailService();
      const classifier = new EmailClassifier();
      const llmService = new LLMService();

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
        case "FULL_SYNC":
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
      const {
        unclassifiedThreads,
        stats,
        error: queryError,
      } = await getUnclassifiedThreads(supabase, emailAccount.id);

      if (queryError) {
        throw new Error(`Failed to fetch unclassified threads: ${queryError}`);
      }

      console.log(
        `Found ${stats.unclassifiedThreads} unclassified threads (${stats.totalThreads} total threads, ${stats.classifiedThreads} classified)`,
      );

      // Enhanced logging
      if (stats.unclassifiedThreads === 0) {
        console.log("No unclassified threads found - skipping classification step");
      } else {
        console.log("Starting classification of threads...");
      }

      for (const thread of unclassifiedThreads) {
        try {
          console.log(`\nProcessing thread: ${thread.id}`);
          console.log(`Subject: ${thread.subject}`);

          const classification = await classifier.classifyThread(thread.id);
          console.log(
            `Classification result: ${classification.is_automated ? "Automated" : "Not Automated"}`,
          );

          // If thread is not automated, process immediately
          if (!classification.is_automated) {
            console.log(`Processing non-automated thread ${thread.id} with LLM...`);

            const { data: threadEmails } = await supabase
              .from("emails")
              .select("*")
              .eq("thread_id", thread.id)
              .order("received_at", { ascending: false })
              .limit(5); // Increased from 3 to 5 for better batching

            if (threadEmails?.length) {
              const batchSize = 5; // Process 5 emails at once
              const batches: (typeof threadEmails)[] = [];
              for (let i = 0; i < threadEmails.length; i += batchSize) {
                batches.push(threadEmails.slice(i, i + batchSize));
              }

              console.log(`Processing ${threadEmails.length} emails in ${batches.length} batches`);

              try {
                await Promise.all(
                  batches.map((batch) =>
                    llmService.processBatch(
                      batch.map((e) => e.id),
                      3,
                    ),
                  ),
                );
                console.log(`Successfully processed all emails from thread ${thread.id}`);
              } catch (error) {
                console.error(`LLM processing failed for thread ${thread.id}:`, error);
                metrics.errors++;
              }
            }
          } else {
            console.log(`Thread ${thread.id} is automated - skipping LLM processing`);
          }

          metrics.threadsProcessed++;
          if (metrics.threadsProcessed % 10 === 0) {
            console.log(`Progress: Processed ${metrics.threadsProcessed} threads so far`);
          }
        } catch (error) {
          console.error(`Error classifying thread ${thread.id}:`, error);
          metrics.errors++;
        }
      }

      await job.updateProgress(66);

      console.log(`\nClassification complete:`);
      console.log(`- Threads processed: ${metrics.threadsProcessed}`);
      console.log(`- Errors encountered: ${metrics.errors}`);

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

      // Add sync state record
      await supabase.from("email_sync_states").insert({
        account_id: emailAccount.id,
        last_history_id: emailAccount.last_history_id,
        emails_synced: metrics.emailsProcessed,
        threads_synced: metrics.threadsProcessed,
        sync_type: sync_type,
        status: metrics.errors === 0 ? "completed" : "failed",
        error: metrics.errors > 0 ? "Sync completed with errors" : null,
        completed_at: new Date().toISOString(),
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
  { connection: redisConnection },
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
