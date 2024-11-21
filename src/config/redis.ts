import { ConnectionOptions } from "bullmq";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.UPSTASH_REDIS_URL || !process.env.UPSTASH_REDIS_TOKEN) {
  throw new Error("Missing required Redis environment variables");
}

const redisUrl = new URL(process.env.UPSTASH_REDIS_URL);

export const redisConnection: ConnectionOptions = {
  host: process.env.NODE_ENV === "production" ? redisUrl.hostname : "localhost",
  port: 6379,
  ...(process.env.NODE_ENV === "production" && {
    password: process.env.UPSTASH_REDIS_TOKEN,
    tls: {
      rejectUnauthorized: false,
    },
  }),
};

// Helper function to log connection details
export function logRedisConnection() {
  console.log(
    "Connecting to Redis:",
    process.env.NODE_ENV === "production" ? redisUrl.hostname : "localhost"
  );
} 