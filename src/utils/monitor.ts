import { Queue } from "bullmq";

export class PipelineMonitor {
  private emailQueue: Queue;
  private llmQueue: Queue;
  private supabase;

  constructor() {
    // Initialize queues and Supabase client
  }

  async getQueueMetrics() {
    const emailCount = await this.emailQueue.count();
    const llmCount = await this.llmQueue.count();
    const failedEmails = await this.emailQueue.getFailed();
    const failedLLM = await this.llmQueue.getFailed();

    return {
      queues: {
        email: { total: emailCount, failed: failedEmails.length },
        llm: { total: llmCount, failed: failedLLM.length },
      },
    };
  }

  async getDatabaseMetrics() {
    const { data } = await this.supabase
      .from("thread_classifications")
      .select("is_automated, category")
      .order("created_at", { ascending: false })
      .limit(100);

    return {
      automated: data?.filter((c) => c.is_automated).length || 0,
      human: data?.filter((c) => !c.is_automated).length || 0,
      categories: data?.reduce((acc, c) => {
        acc[c.category] = (acc[c.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}
