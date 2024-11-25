import { SupabaseClient } from "@supabase/supabase-js";

type EmailThread = {
  id: string;
  subject: string;
  thread_summary: any;
  emails: {
    id: string;
    from: string;
    subject: string;
    body: string;
    received_at: string;
  }[];
};

type QueryResult = {
  unclassifiedThreads: EmailThread[];
  stats: {
    totalThreads: number;
    classifiedThreads: number;
    unclassifiedThreads: number;
  };
  error?: string;
};

export async function getUnclassifiedThreads(
  supabase: SupabaseClient,
  accountId: string,
): Promise<QueryResult> {
  try {
    // Get all threads for this account
    const { data: allThreads, error: threadsError } = await supabase
      .from("email_threads")
      .select("*")
      .eq("account_id", accountId);

    if (threadsError) {
      return {
        unclassifiedThreads: [],
        stats: { totalThreads: 0, classifiedThreads: 0, unclassifiedThreads: 0 },
        error: `Error fetching threads: ${threadsError.message}`,
      };
    }

    // Get all classifications for these threads
    const { data: classifiedThreadIds, error: classificationError } = await supabase
      .from("thread_classifications")
      .select("thread_id")
      .eq(
        "thread_id",
        allThreads?.map((thread) => thread.id),
      );

    if (classificationError) {
      return {
        unclassifiedThreads: [],
        stats: { totalThreads: 0, classifiedThreads: 0, unclassifiedThreads: 0 },
        error: `Error fetching classifications: ${classificationError.message}`,
      };
    }

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
      return {
        unclassifiedThreads: [],
        stats: { totalThreads: 0, classifiedThreads: 0, unclassifiedThreads: 0 },
        error: `Error fetching unclassified threads: ${threadError.message}`,
      };
    }

    return {
      unclassifiedThreads: unclassifiedThreads || [],
      stats: {
        totalThreads: allThreads?.length || 0,
        classifiedThreads: classifiedThreadIds?.length || 0,
        unclassifiedThreads: unclassifiedThreads?.length || 0,
      },
    };
  } catch (error) {
    return {
      unclassifiedThreads: [],
      stats: { totalThreads: 0, classifiedThreads: 0, unclassifiedThreads: 0 },
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
