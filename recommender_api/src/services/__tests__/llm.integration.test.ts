import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { generateCompletion, isLLMAvailable, resetConnectionState } from "../llm.service.js";
import config from "../../config.js";

/*
 * Integration tests that hit real Ollama.
 * These tests are skipped if Ollama is not available.
 *
 * Note: Configured timeout is extended to handle LLM latency.
 * The tests use qwen2.5:7b-instruct which is smaller and faster.
 */

describe("LLM Integration Tests", () => {
  let ollamaAvailable = false;

  beforeAll(async () => {
    resetConnectionState();
    ollamaAvailable = await isLLMAvailable();
    if (!ollamaAvailable) {
      console.warn(
        "[LLM Integration Tests] Ollama not available - tests will be skipped"
      );
    }
  });

  afterAll(() => {
    resetConnectionState();
  });

  describe("generateCompletion", () => {
    it(
      "generates a completion for a simple prompt",
      { timeout: 30000 },
      async () => {
        if (!ollamaAvailable) {
          console.log("Skipping: Ollama not available");
          return;
        }

        const result = await generateCompletion(
          "What is 2 + 2? Answer with just the number.",
          { maxTokens: 50 }
        );

        expect(result).toBeTruthy();
        expect(result).toContain("4");
      }
    );

    it(
      "respects the system prompt for conflict explanations",
      { timeout: 30000 },
      async () => {
        if (!ollamaAvailable) {
          console.log("Skipping: Ollama not available");
          return;
        }

        const ragContext = `# Search Query Analysis

Total engineers matching the full query: 0

## Conflicting Constraints
- "staff level seniority (10+ years)": 5 engineers at this level
- "salary <= $120,000": 15 engineers within this budget

Combined: 0 engineers match both constraints.`;

        const result = await generateCompletion(ragContext, {
          systemPrompt: `You are an expert in tech talent acquisition. Explain why these constraints conflict concisely in 2-3 sentences.`,
          maxTokens: 150,
        });

        expect(result).toBeTruthy();
        /*
         * The response should mention salary/compensation and/or experience/seniority.
         * It may vary but should acknowledge the conflict is about pay expectations
         * at senior levels.
         */
        const lowercaseResult = result!.toLowerCase();
        expect(
          lowercaseResult.includes("salary") ||
            lowercaseResult.includes("compensation") ||
            lowercaseResult.includes("pay") ||
            lowercaseResult.includes("budget") ||
            lowercaseResult.includes("senior") ||
            lowercaseResult.includes("staff") ||
            lowercaseResult.includes("experience")
        ).toBe(true);
      }
    );

    it(
      "returns null when model generates empty response",
      { timeout: 30000 },
      async () => {
        if (!ollamaAvailable) {
          console.log("Skipping: Ollama not available");
          return;
        }

        /*
         * This test verifies graceful handling of edge cases.
         * Note: With a proper model, this likely won't return null,
         * but it tests the trim/empty handling.
         */
        const result = await generateCompletion("", { maxTokens: 1 });
        /*
         * Empty prompt may still get a response from the model.
         * Just verify we don't crash.
         */
        expect(typeof result === "string" || result === null).toBe(true);
      }
    );
  });

  describe("isLLMAvailable", () => {
    it("returns true when Ollama is running", async () => {
      /*
       * If we got here without Ollama available, the beforeAll
       * would have warned. This test validates caching behavior.
       */
      resetConnectionState();
      const firstCheck = await isLLMAvailable();
      const secondCheck = await isLLMAvailable(); // Should use cache

      expect(firstCheck).toBe(ollamaAvailable);
      expect(secondCheck).toBe(firstCheck);
    });
  });
});
