// @ts-nocheck
import { SyncMetrics } from "@/lib/types";
import { GmailService } from "@/services/gmail";
import dotenv from "dotenv";

dotenv.config();

const email = process.env.TEST_EMAIL;

async function printMetrics(metrics: SyncMetrics) {
  const duration = Date.now() - metrics.startTime;
  console.log("\nSync Metrics:");
  console.log("-------------");
  console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
  console.log(`Threads Processed: ${metrics.threadsProcessed}`);
  console.log(`Emails Processed: ${metrics.emailsProcessed}`);
  console.log(`Errors: ${metrics.errors}`);
  console.log(`Retries: ${metrics.retries}`);
  console.log(`Average: ${(metrics.emailsProcessed / (duration / 1000)).toFixed(2)} emails/second`);
}

async function testFullSync() {
  console.log("\n🔄 Testing Full Sync...");
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
    console.log("✅ Full sync completed successfully!");
    await printMetrics(metrics);
  } catch (error) {
    console.error("❌ Full sync failed:", error);
    throw error;
  }
}

async function testIncrementalSync() {
  console.log("\n🔄 Testing Incremental Sync...");
  const gmailService = new GmailService();

  const metrics: SyncMetrics = {
    startTime: Date.now(),
    threadsProcessed: 0,
    emailsProcessed: 0,
    errors: 0,
    retries: 0,
  };

  try {
    await gmailService.syncChanges(email, metrics);
    console.log("✅ Incremental sync completed successfully!");
    await printMetrics(metrics);
  } catch (error) {
    console.error("❌ Incremental sync failed:", error);
    throw error;
  }
}

async function testUnreadStates() {
  console.log("\n🔄 Testing Unread States Update...");
  const gmailService = new GmailService();

  try {
    await gmailService.updateUnreadStates(email);
    console.log("✅ Unread states update completed successfully!");
  } catch (error) {
    console.error("❌ Unread states update failed:", error);
    throw error;
  }
}

async function main() {
  console.log("🚀 Starting Gmail Service Tests");
  console.log(`📧 Testing with email: ${email}`);

  try {
    // Test full sync first
    // await testFullSync();

    // Test unread states update
    await testUnreadStates();

    // Wait a bit before testing incremental sync
    // console.log("\nWaiting 5 seconds before testing incremental sync...");
    // await new Promise(resolve => setTimeout(resolve, 5000));

    // Test incremental sync
    // await testIncrementalSync();

    console.log("\n✨ All tests completed successfully!");
  } catch (error) {
    console.error("\n💥 Tests failed:", error);
    process.exit(1);
  }
}

main().catch(console.error);