import { EmailClassifier } from "../classifier";

describe("EmailClassifier", () => {
  let classifier: EmailClassifier;

  beforeEach(() => {
    classifier = new EmailClassifier();
  });

  test("should detect automated emails", async () => {
    const testCases = [
      {
        from: "noreply@example.com",
        subject: "Your order confirmation",
        body: "Click here to unsubscribe",
        expected: true,
      },
      {
        from: "john@example.com",
        subject: "Quick question",
        body: "Hi, how are you?",
        expected: false,
      },
    ];

    for (const testCase of testCases) {
      const result = await classifier.classifyThread(testCase);
      expect(result.is_automated).toBe(testCase.expected);
    }
  });
});
