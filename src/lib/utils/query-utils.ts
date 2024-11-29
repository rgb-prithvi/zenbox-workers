import { supabase } from "@/lib/supabase-client";
import type { Database } from "@/lib/types/supabase";
import { SupabaseClient } from "@supabase/supabase-js";
import { retryWithBackoff } from "./retry";

type EmailThread = Database["public"]["Tables"]["email_threads"]["Row"] & {
  emails: Database["public"]["Tables"]["emails"]["Row"][];
};

type ThreadClassification = Database["public"]["Tables"]["thread_classifications"]["Row"];

export async function getEmailAccount(email: string) {
  console.log("🔍 Searching for email account:", email);
  const result = await retryWithBackoff(() =>
    supabase.from("email_accounts").select("*").eq("email", email).single(),
  );

  if (result.error || !result.data) {
    throw new Error(
      `❌ No account found for ${email}:\n Error Message:\n${
        result.error?.message || "<The error message didn't come through>"
      }`,
    );
  }

  return result.data;
}

export async function getUnclassifiedThreads(
  supabase: SupabaseClient,
  accountId: string,
): Promise<{ unclassifiedThreads: EmailThread[] }> {
  try {
    const { data: unclassifiedThreads, error } = await supabase
      .from("email_threads")
      .select(
        `
      id,
      subject,
      last_message_at,
      account_id,
      created_at,
      history_id,
      thread_summary,
      emails (*)
    `,
      )
      .eq("account_id", accountId)
      .eq("is_classified", false)
      .order("last_message_at", { ascending: false });

    if (error) {
      throw new Error(`❌ Error fetching unclassified threads: ${error.message}`);
    }

    return {
      unclassifiedThreads: unclassifiedThreads || [],
    };
  } catch (error) {
    console.error("❌ Error fetching unclassified threads:", error);
    throw new Error(`Failed to fetch unclassified threads`);
  }
}

export function processClassificationResults(
  classificationResults: Array<{
    threadId: string;
    classification: ThreadClassification;
  }>,
) {
  // Separate into automated and non-automated
  const automatedThreads = classificationResults.filter((r) => r.classification.is_automated);
  const nonAutomatedThreads = classificationResults.filter((r) => !r.classification.is_automated);

  return {
    automatedThreads,
    nonAutomatedThreads,
  };
}

export async function insertAutomatedClassifications(
  supabase: SupabaseClient,
  automatedThreads: Array<{
    threadId: string;
    classification: ThreadClassification;
  }>,
) {
  if (automatedThreads.length === 0) return;

  const { error } = await supabase.from("thread_classifications").upsert(
    automatedThreads.map((result) => ({
      ...result.classification,
      thread_id: result.threadId,
    })),
    {
      onConflict: "thread_id",
      ignoreDuplicates: true,
    },
  );

  if (error) {
    console.error("Error upserting automated classifications:", error);
    throw error;
  }

  return automatedThreads.length;
}
