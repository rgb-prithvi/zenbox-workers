import { createClient } from "@supabase/supabase-js";
import { ConnectionOptions, Worker } from "bullmq";
import dotenv from "dotenv";
import { LLMService } from "./services/llm";
import { Database } from "./types/supabase";

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'UPSTASH_REDIS_URL',
  'UPSTASH_REDIS_TOKEN',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Redis setup
const redisUrl = new URL(process.env.UPSTASH_REDIS_URL!);
const connection: ConnectionOptions = {
  host: redisUrl.hostname,
  port: 6379,
  password: process.env.UPSTASH_REDIS_TOKEN,
  tls: {
    rejectUnauthorized: false,
  },
};

interface LLMJobData {
  email_id: string;
  thread_id: string;
  account_id: string;
  classification_id: string;
}

interface LLMJobMetrics {
  jobId: string;
  emailId: string;
  threadId: string;
  startTime: number;
  endTime?: number;
  status: "completed" | "failed";
  error?: string;
  processingDuration?: number;  // Added for easier tracking
}

// Initialize Supabase client once
const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Track worker statistics
const workerStats = {
  totalProcessed: 0,
  successful: 0,
  failed: 0,
  startTime: Date.now(),
};

const jobMetrics: LLMJobMetrics[] = [];

const worker = new Worker<LLMJobData>(
  "llm-processing",
  async (job) => {
    // Get email subject for logging
    const { data: email } = await supabase
      .from("emails")
      .select("subject")
      .eq("id", job.data.email_id)
      .single();

    console.log(`\n[Job ${job.id}] Starting processing for email "${email?.subject}" (ID: ${job.data.email_id})`);
    const startTime = Date.now();
    
    const metric: LLMJobMetrics = {
      jobId: job.id!,
      emailId: job.data.email_id,
      threadId: job.data.thread_id,
      startTime,
      status: "completed",
    };

    try {
      // Validate job data
      if (!job.data.email_id || !job.data.thread_id || !job.data.account_id) {
        throw new Error("Missing required job data fields");
      }

      console.log(`[Job ${job.id}] Initializing LLM service...`);
      const llmService = new LLMService();
      
      console.log(`[Job ${job.id}] Processing email through LLM...`);
      await llmService.processEmail(job.data.email_id);

      metric.endTime = Date.now();
      metric.processingDuration = metric.endTime - metric.startTime;
      jobMetrics.push(metric);

      // Store metrics in Supabase
      console.log(`[Job ${job.id}] Storing job metrics...`);
      const { error: metricsError } = await supabase.from("llm_job_metrics").insert({
        job_id: job.id!,
        email_id: job.data.email_id,
        thread_id: job.data.thread_id,
        duration_ms: metric.processingDuration,
        success: true,
      });

      if (metricsError) {
        console.error(`[Job ${job.id}] Failed to store metrics:`, metricsError);
        // Don't throw here - we don't want to fail the job just because metrics failed
      }

      workerStats.totalProcessed++;
      workerStats.successful++;

      console.log(`[Job ${job.id}] Processing completed in ${metric.processingDuration}ms`);
      return { success: true };

    } catch (error) {
      metric.status = "failed";
      metric.error = error instanceof Error ? error.message : "Unknown error";
      metric.endTime = Date.now();
      metric.processingDuration = metric.endTime - metric.startTime;
      jobMetrics.push(metric);

      workerStats.totalProcessed++;
      workerStats.failed++;

      console.error(`[Job ${job.id}] Processing failed after ${metric.processingDuration}ms:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
    settings: {
      retryPolicy: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    },
  },
);

// Enhanced error handling and logging
worker.on("completed", async (job) => {
  const { data: email } = await supabase
    .from("emails")
    .select("subject")
    .eq("id", job.data.email_id)
    .single();

  const duration = job?.finishedOn ? job.finishedOn - job.timestamp : 'unknown';
  console.log(
    `✅ [Job ${job?.id}] Completed LLM processing for "${email?.subject}" (Email ID: ${job?.data.email_id}, Thread: ${job?.data.thread_id}, Duration: ${duration}ms)`
  );
});

worker.on("failed", (job, error) => {
  console.error(
    `❌ [Job ${job?.id}] Failed LLM processing for email ${job?.data.email_id} in thread ${job?.data.thread_id}:`,
    error
  );
});

// Log worker statistics periodically
const STATS_INTERVAL = 5 * 60 * 1000; // 5 minutes
setInterval(() => {
  const uptime = Math.floor((Date.now() - workerStats.startTime) / 1000);
  console.log(`\n📊 Worker Statistics (uptime: ${uptime}s):
    - Total jobs processed: ${workerStats.totalProcessed}
    - Successful: ${workerStats.successful}
    - Failed: ${workerStats.failed}
    - Success rate: ${(workerStats.successful / workerStats.totalProcessed * 100).toFixed(1)}%
  `);
}, STATS_INTERVAL);

// Add graceful shutdown
process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down LLM worker...");
  await worker.close();
  
  console.log("Final worker statistics:", workerStats);
  process.exit(0);
});

console.log("🚀 LLM worker started...");
