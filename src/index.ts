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

const worker = new Worker("email-processing", async (job) => {
  try {
    // Simulate work with delays
    await job.updateProgress(0);
    console.log("Starting job:", job.id);

    await new Promise((r) => setTimeout(r, 2000));
    await job.updateProgress(33);
    console.log("Stage 1 complete");

    await new Promise((r) => setTimeout(r, 2000));
    await job.updateProgress(66);
    console.log("Stage 2 complete");

    await new Promise((r) => setTimeout(r, 2000));
    await job.updateProgress(100);
    console.log("Job complete");

    return { success: true };
  } catch (error) {
    console.error("Job failed:", error);
    throw error;
  }
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
    jobId: job.id,
    status: "completed",
    message: "Job completed successfully",
    timestamp: new Date(),
  });
  console.table(jobLogs);
});

worker.on("failed", (job, error) => {
  jobLogs.push({
    jobId: job.id,
    status: "failed",
    message: error.message,
    timestamp: new Date(),
  });
  console.table(jobLogs);
});

console.log("Worker started...");
