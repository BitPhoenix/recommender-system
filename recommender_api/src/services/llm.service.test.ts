import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateCompletion,
  generateEmbedding,
  getEmbeddingModelName,
  isLLMAvailable,
  resetConnectionState,
} from "./llm.service.js";

// Create a mock embedding array
const mockEmbedding = new Array(1024).fill(0.1);

// Mock the ollama module
vi.mock("ollama", () => {
  return {
    Ollama: class MockOllama {
      list = vi.fn().mockResolvedValue({ models: [] });
      chat = vi.fn().mockResolvedValue({
        message: { content: "Staff engineers typically earn $180,000+" },
      });
      embed = vi.fn().mockResolvedValue({
        embeddings: [new Array(1024).fill(0.1)],
      });
    },
  };
});

// Mock config
vi.mock("../config.js", () => ({
  default: {
    LLM_HOST: "http://127.0.0.1:11434",
    LLM_MODEL: "qwen2.5:14b-instruct",
    LLM_EMBEDDING_MODEL: "mxbai-embed-large",
    LLM_ENABLED: true,
    LLM_TIMEOUT_MS: 5000,
  },
}));

describe("llm.service", () => {
  beforeEach(() => {
    resetConnectionState();
  });

  describe("isLLMAvailable", () => {
    it("returns true when Ollama responds", async () => {
      const available = await isLLMAvailable();
      expect(available).toBe(true);
    });

    it("caches the connection state", async () => {
      await isLLMAvailable();
      const secondCall = await isLLMAvailable();
      expect(secondCall).toBe(true);
    });
  });

  describe("generateCompletion", () => {
    it("returns completion text from the model", async () => {
      const result = await generateCompletion("Explain why staff + $120k conflicts");
      expect(result).toBe("Staff engineers typically earn $180,000+");
    });

    it("accepts a system prompt", async () => {
      const result = await generateCompletion("Test prompt", {
        systemPrompt: "You are a helpful assistant",
      });
      expect(result).toBeTruthy();
    });
  });

  describe("generateEmbedding", () => {
    it("generates embedding vector for text", async () => {
      const result = await generateEmbedding("Python developer with machine learning experience");
      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(1024);
    });

    it("returns embedding with expected dimensionality", async () => {
      const result = await generateEmbedding("Test text");
      expect(result).toHaveLength(1024);
      // All values should be numbers
      result?.forEach((value) => {
        expect(typeof value).toBe("number");
      });
    });
  });

  describe("getEmbeddingModelName", () => {
    it("returns the configured embedding model name", () => {
      const modelName = getEmbeddingModelName();
      expect(modelName).toBe("mxbai-embed-large");
    });
  });
});
