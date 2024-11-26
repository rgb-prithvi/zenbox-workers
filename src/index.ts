import { redisConnection, redisUrl } from "@/lib/config/redis";
import { supabase } from "@/lib/supabase-client";
import { SyncMetrics, WorkerJobData } from "@/lib/types";
import {
  getEmailAccount,
  getUnclassifiedThreads,
  insertAutomatedClassifications,
  processClassificationResults,
} from "@/lib/utils/query-utils";
import { checkEnvironmentVariables, createHealthCheckServer } from "@/lib/utils/worker-utils";
import { EmailClassifier } from "@/services/classifier";
import { GmailService } from "@/services/gmail";
import { LLMService } from "@/services/llm";
import { Worker } from "bullmq";
import dotenv from "dotenv";
import { DEFAULT_DAYS_TO_SYNC } from "./lib/constants";

dotenv.config();

checkEnvironmentVariables();
const healthCheckServer = createHealthCheckServer();

const HEALTH_CHECK_PORT = 8080;
healthCheckServer.listen(HEALTH_CHECK_PORT, () => {
  console.log(`✅ Health check server listening on port ${HEALTH_CHECK_PORT}`);
  console.log(`✅ Worker started with connection to: ${redisUrl.hostname}`);
});

// TODO: Add consistency to sync type
const worker = new Worker<WorkerJobData>(
  "email-processing",
  async (job) => {
    try {
      // TODO: Make sure zen-inbox schema is consistent
      const { email, sync_type, days_to_sync, user_context } = job.data;
      console.log(
        `🔄 Processing job ${job.id} for email ${email} with sync type ${sync_type} and days to sync ${days_to_sync}`,
      );
      console.log(`--------------------------------\n`);
      await job.updateProgress(0);

      const emailAccount = await getEmailAccount(email);

      const gmailService = new GmailService();
      const classifier = new EmailClassifier();
      const llmService = new LLMService(user_context);

      // TODO: Figure out what's good with these metrics
      const metrics: SyncMetrics = {
        startTime: Date.now(),
        threadsProcessed: 0,
        emailsProcessed: 0,
        errors: 0,
        retries: 0,
      };

      // Step 1: Sync emails based on sync type
      console.log(
        `✅ Successfully fetched email account ${emailAccount.email} & instantiated services...`,
      );
      console.log(`🔄Starting ${sync_type} for account ${email}`);
      await gmailService.triggerSync(
        email,
        sync_type,
        days_to_sync || DEFAULT_DAYS_TO_SYNC,
        metrics,
      );

      await job.updateProgress(33);

      // Step 2: Classify new threads
      console.log("Finding unclassified threads...");
      const { unclassifiedThreads } = await getUnclassifiedThreads(supabase, emailAccount.id);

      const threadClassifications = await classifier.batchProcessThreads(unclassifiedThreads);
      const { automatedThreads, nonAutomatedThreads } =
        processClassificationResults(threadClassifications);
      await insertAutomatedClassifications(supabase, automatedThreads);

      await job.updateProgress(66);
      console.log(
        `Classifier Complete:\n✅ Successfully inserted ${automatedThreads.length} automated classifications`,
      );

      // TODO: Revisit this metrics object...
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
  {
    connection: redisConnection,
    // Add connection options
    autorun: true,
    maxStalledCount: 10,
  },
);

// Add worker ready event handler
worker.on("ready", () => {
  console.log("Worker ready handler triggered: Worker is ready to process jobs!");
});

// Add connection error handler
worker.on("error", (error) => {
  console.error("Worker connection error triggered:", error);
});

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
