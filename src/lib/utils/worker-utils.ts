import { redisConnection } from "@/lib/config/redis";
import { DEFAULT_DAYS_TO_SYNC } from "@/lib/constants";
import { supabase } from "@/lib/supabase-client";
import { Queue } from "bullmq";
import http from "http";

export const isProduction = process.env.NODE_ENV === "production";

export const checkEnvironmentVariables = () => {
  const requiredEnvVars = [
    "GMAIL_CLIENT_ID",
    "GMAIL_CLIENT_SECRET",
    "GMAIL_REDIRECT_URI",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "OPENAI_API_KEY",
    "UPSTASH_REDIS_URL",
    "UPSTASH_REDIS_TOKEN",
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
};

export const createHealthCheckServer = () => {
  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200);
      res.end("OK");
      return;
    }
    res.writeHead(404);
    res.end();
  });

  return server;
};

export const cronJobCallback = async () => {
  console.log("Running email sync cron job...");
    try {
      const queue = new Queue("email-processing", {
        connection: redisConnection,
      });
  
      // Get all active email accounts from the database
      const { data: accounts, error } = await supabase.from("email_accounts").select("email");
  
      if (error) {
        throw error;
      }
  
      // Create a job for each active account
      for (const account of accounts) {
        const jobId = `cron-sync-${account.email}-${Date.now()}`;
        await queue.add(jobId, {
          email: account.email,
          sync_type: "INCREMENTAL_SYNC",
          days_to_sync: DEFAULT_DAYS_TO_SYNC,
          user_context: null, // We'll fetch this from the database when processing
        });
  
        console.log(`Created sync job ${jobId} for account ${account.email}`);
      }
  
      await queue.close();
    } catch (error) {
      console.error("Cron job failed:", error);
  }
};
