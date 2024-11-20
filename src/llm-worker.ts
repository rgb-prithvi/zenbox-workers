import { Redis } from "@upstash/redis";
import { ConnectionOptions, Worker } from "bullmq";
import dotenv from "dotenv";
import { LLMService } from "./services/llm";

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

const worker = new Worker<LLMJobData>(
  "llm-processing",
  async (job) => {
    try {
      const llmService = new LLMService();
      await llmService.processEmail(job.data.email_id);
      
      return { success: true };
    } catch (error) {
      console.error("LLM processing failed:", error);
      throw error;
    }
  },
  { connection }
);

// Error handling
worker.on("completed", (job) => {
  console.log(`Completed LLM processing for thread ${job?.data.thread_id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Failed LLM processing for thread ${job?.data.thread_id}:`, error);
});

console.log("LLM worker started..."); 