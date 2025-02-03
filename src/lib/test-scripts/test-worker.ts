// @ts-nocheck
import { Queue } from "bullmq";
import dotenv from "dotenv";

dotenv.config();

const email = process.env.TEST_EMAIL;

async function main() {
  const queue = new Queue("email-processing", {
    connection: {
      host: "localhost",
      port: 6379,
    },
  });

  await queue.add("test-job", {
    email: email,
    sync_type: "FULL_SYNC",
    days_to_sync: 3,
  });

  console.log("Test job added to queue");
  process.exit(0);
}

main().catch(console.error);
