import { isProduction } from "@/lib/utils/worker-utils";
import { ConnectionOptions } from "bullmq";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.UPSTASH_REDIS_URL || !process.env.UPSTASH_REDIS_TOKEN) {
  throw new Error("Missing required Redis environment variables");
}

export const redisUrl = isProduction
  ? new URL(process.env.UPSTASH_REDIS_URL)
  : new URL("redis://localhost:6379");

const PORT = 6379;

const devRedisConfig = {
  host: "localhost",
  port: PORT,
};

const prodRedisConfig = {
  host: redisUrl.hostname,
  port: PORT,
  password: process.env.UPSTASH_REDIS_TOKEN,
  tls: {
    rejectUnauthorized: false,
  },
};

export const redisConnection: ConnectionOptions = isProduction ? prodRedisConfig : devRedisConfig;
