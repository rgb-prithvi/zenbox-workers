// src/index.ts
import { Redis } from "@upstash/redis";
import { ConnectionOptions, Worker } from "bullmq";
import dotenv from "dotenv";

dotenv.config();

// create redis connection
const host = process.env.UPSTASH_REDIS_URL!;
const token = process.env.UPSTASH_REDIS_TOKEN!;
const redis = new Redis({
  url: host,
  token: token,
});

// create connection config for bull
const connection: ConnectionOptions = {
  host: host,
  port: 6379,
  password: token,
  tls: {
    rejectUnauthorized: false, // needed for upstash
  },
};

const worker = new Worker(
  "email-processing",
  async (job) => {
    console.log("Processing job:", job.id);
    const { email } = job.data;

    try {
      // Stage 1: Sync
      console.log("Starting sync for:", email);
      await job.updateProgress(0);
      // TODO: implement sync

      // Stage 2: Classify
      console.log("Starting classification");
      await job.updateProgress(33);
      // TODO: implement classification

      // Stage 3: LLM
      console.log("Starting LLM processing");
      await job.updateProgress(66);
      // TODO: implement LLM

      await job.updateProgress(100);
      console.log("Job completed:", job.id);
    } catch (error) {
      console.error("Job failed:", error);
      throw error;
    }
  },
  { connection },
);

// Error handling
worker.on("completed", (job) => {
  if (job) {
    console.log(`Job ${job.id} completed successfully`);
  }
});

worker.on("failed", (job, error) => {
  if (job) {
    console.error(`Job ${job.id} failed:`, error);
  }
});

console.log("Worker started...");
