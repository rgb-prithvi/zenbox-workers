import { EmailClassifier } from "../classifier";
import { GmailService } from "../gmail";
import { LLMService } from "../llm";

describe("Pipeline Integration", () => {
  test("should process emails end-to-end", async () => {
    const gmail = new GmailService();
    const classifier = new EmailClassifier();
    const llm = new LLMService();

    // 1. Sync emails
    const syncResult = await gmail.syncChanges("test@example.com", {
      startTime: Date.now(),
      threadsProcessed: 0,
      emailsProcessed: 0,
      errors: 0,
      retries: 0,
    });

    // 2. Classify threads
    const threadId = syncResult.threads[0]?.id;
    const classification = await classifier.classifyThread(threadId);

    // 3. Process with LLM if needed
    if (!classification.is_automated) {
      await llm.processEmail(syncResult.threads[0].emails[0].id);
    }

    expect(classification).toBeDefined();
  });
});
