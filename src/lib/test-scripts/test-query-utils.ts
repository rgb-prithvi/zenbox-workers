import { supabase } from "@/lib/supabase-client";
import { getUnclassifiedThreads } from "../utils/query-utils";

async function testGetUnclassifiedThreads() {
  try {
    // Replace with a valid account ID from your database
    const testAccountId = "3c7318e5-10b0-4d03-9d93-723d9e0c0960";

    console.log("🔍 Fetching unclassified threads for account:", testAccountId);

    const { unclassifiedThreads } = await getUnclassifiedThreads(supabase, testAccountId);

    console.log("\n📊 Results:");
    console.log(`Found ${unclassifiedThreads.length} unclassified threads`);

    // Print details of first few threads
    const sampleSize = Math.min(3, unclassifiedThreads.length);
    if (sampleSize > 0) {
      console.log("\n📧 Sample of unclassified threads:");
      unclassifiedThreads.slice(0, sampleSize).forEach((thread, index) => {
        console.log(`\nThread ${index + 1}:`);
        console.log(`- Subject: ${thread.subject}`);
        console.log(`- Thread ID: ${thread.id}`);
        console.log(`- Email Count: ${thread.emails.length}`);
        console.log(`- Last Message: ${new Date(thread.last_message_at).toLocaleString()}`);
      });
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run the test
testGetUnclassifiedThreads();
