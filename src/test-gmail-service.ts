import dotenv from "dotenv";
import { GmailService } from "./services/gmail";
import { SyncMetrics } from "./types";

dotenv.config();

const email = "prithvi@genaicollective.ai";

async function main() {
  const gmailService = new GmailService();
  
  const metrics: SyncMetrics = {
    startTime: Date.now(),
    threadsProcessed: 0,
    emailsProcessed: 0,
    errors: 0,
    retries: 0,
  };

  try {
    await gmailService.syncNewAccount(email, 3, metrics);
    console.log("Sync completed successfully!", metrics);
  } catch (error) {
    console.error("Sync failed:", error);
  }
}

main().catch(console.error);