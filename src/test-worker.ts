import { Queue } from "bullmq";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const queue = new Queue("email-processing", {
    connection: {
      host: "localhost",
      port: 6379,
    },
  });

  await queue.add("test-job", {
    email: "prithvi@genaicollective.ai",
    sync_type: "FIRST_SYNC",
    days_to_sync: 7,
  });

  console.log("Test job added to queue");
  process.exit(0);
}

main().catch(console.error);
