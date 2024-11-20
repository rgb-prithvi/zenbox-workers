// src/index.ts
import { Redis } from "@upstash/redis";
import { ConnectionOptions, Worker } from "bullmq";
import dotenv from "dotenv";
import http from "http"; // add this

dotenv.config();

dotenv.config();

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
});

// create connection config for bull
const redisUrl = new URL(process.env.UPSTASH_REDIS_URL!);

const connection: ConnectionOptions = {
  host: redisUrl.hostname,
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
