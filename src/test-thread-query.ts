import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const main = async () => {
  const accountId = "";

  // First get all threads for this account
  const { data: allThreads, error: threadsError } = await supabase
    .from("email_threads")
    .select("*")
    .eq("account_id", accountId);

  if (threadsError) {
    console.error("Error fetching threads:", threadsError);
    return;
  }
  console.log(`Total threads for account: ${allThreads?.length || 0}`);

  // Get all classifications
  const { data: classifiedThreadIds, error: classificationError } = await supabase
    .from("thread_classifications")
    .select("thread_id")
    .eq(
      "thread_id",
      allThreads?.map((thread) => thread.id),
    ); // Only get classifications for this account's threads

  if (classificationError) {
    console.error("Error fetching classifications:", classificationError);
    return;
  }
  console.log(`Total classifications found: ${classifiedThreadIds?.length || 0}`);

  // Build the query for unclassified threads
  let query = supabase
    .from("email_threads")
    .select(
      `
      id,
      subject,
      thread_summary,
      emails (
        id,
        from,
        subject,
        body,
        received_at
      )
    `,
    )
    .eq("account_id", accountId)
    .order("last_message_at", { ascending: false });

  // Only add the "not in" clause if we have classifications
  if (classifiedThreadIds && classifiedThreadIds.length > 0) {
    query = query.not(
      "id",
      "in",
      classifiedThreadIds.map((row) => row.thread_id),
    );
  }

  const { data: unclassifiedThreads, error: threadError } = await query;

  if (threadError) {
    console.error("Error fetching unclassified threads:", threadError);
    return;
  }

  // Log results with helpful context
  console.log(`Found ${unclassifiedThreads?.length || 0} unclassified threads`);

  if (allThreads && classifiedThreadIds) {
    console.log(`Status:
    - Total threads: ${allThreads.length}
    - Classified threads: ${classifiedThreadIds.length}
    - Unclassified threads: ${unclassifiedThreads?.length || 0}
    `);
  }

  // If we got unexpected results, show more debug info
  if (unclassifiedThreads?.length === 0 && allThreads?.length > 0) {
    console.log(
      "All threads appear to be classified. Sample of recent threads:",
      allThreads.slice(0, 3).map((t) => ({
        id: t.id,
        subject: t.subject,
        last_message_at: t.last_message_at,
      })),
    );
  }
};

main().catch(console.error);
