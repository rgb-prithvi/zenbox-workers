import { Redis } from "@upstash/redis";
import { ConnectionOptions, Worker } from "bullmq";
import dotenv from "dotenv";
import { LLMService } from "./services/llm";
import { createClient } from "@supabase/supabase-js";
import { Database } from "./types/supabase";

dotenv.config();

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

// Add job metrics tracking
interface LLMJobMetrics {
  jobId: string;
  emailId: string;
  threadId: string;
  startTime: number;
  endTime?: number;
  status: 'completed' | 'failed';
  error?: string;
}

const jobMetrics: LLMJobMetrics[] = [];

const worker = new Worker<LLMJobData>(
  "llm-processing",
  async (job) => {
    const startTime = Date.now();
    const metric: LLMJobMetrics = {
      jobId: job.id,
      emailId: job.data.email_id,
      threadId: job.data.thread_id,
      startTime,
      status: 'completed'
    };

    try {
      const llmService = new LLMService();
      await llmService.processEmail(job.data.email_id);
      
      metric.endTime = Date.now();
      jobMetrics.push(metric);

      // Store metrics in Supabase
      const supabase = createClient<Database>(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      );

      await supabase.from("llm_job_metrics").insert({
        job_id: job.id,
        email_id: job.data.email_id,
        thread_id: job.data.thread_id,
        duration_ms: metric.endTime - metric.startTime,
        success: true
      });

      return { success: true };
    } catch (error) {
      metric.status = 'failed';
      metric.error = error instanceof Error ? error.message : 'Unknown error';
      metric.endTime = Date.now();
      jobMetrics.push(metric);

      console.error("LLM processing failed:", error);
      throw error;
    }
  },
  { 
    connection,
    concurrency: 5, // Process 5 jobs at a time
    limiter: {
      max: 10, // Max 10 jobs per
      duration: 1000 // per second
    }
  }
);

// Enhanced error handling
worker.on("completed", (job) => {
  console.log(`Completed LLM processing for email ${job?.data.email_id} in thread ${job?.data.thread_id}`);
});

worker.on("failed", (job, error) => {
  console.error(
    `Failed LLM processing for email ${job?.data.email_id} in thread ${job?.data.thread_id}:`,
    error
  );
});

// Add graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down LLM worker...');
  await worker.close();
  process.exit(0);
});

console.log("LLM worker started..."); 