import { Ollama } from "ollama";
import config from "../config.js";

/*
 * LLM service for generating text completions and embeddings via Ollama.
 * Provides graceful degradation if Ollama is unavailable.
 */

let ollamaClient: Ollama | null = null;
let connectionVerified = false;

function getClient(): Ollama {
  if (!ollamaClient) {
    ollamaClient = new Ollama({ host: config.LLM_HOST });
  }
  return ollamaClient;
}

/*
 * Check if the LLM service is available and responding.
 * Caches the result to avoid repeated health checks.
 */
export async function isLLMAvailable(): Promise<boolean> {
  if (!config.LLM_ENABLED) {
    return false;
  }

  if (connectionVerified) {
    return true;
  }

  try {
    const client = getClient();
    await client.list();
    connectionVerified = true;
    return true;
  } catch (error) {
    console.warn("[LLM] Ollama not available, falling back to templates:", error);
    return false;
  }
}

/*
 * Reset the connection state (useful for testing or reconnection).
 */
export function resetConnectionState(): void {
  connectionVerified = false;
  ollamaClient = null;
}

export interface LLMCompletionOptions {
  systemPrompt?: string;
  maxTokens?: number;
}

/*
 * Generate a completion from the LLM.
 * Returns null if LLM is unavailable or times out.
 */
export async function generateCompletion(
  prompt: string,
  options: LLMCompletionOptions = {}
): Promise<string | null> {
  if (!(await isLLMAvailable())) {
    return null;
  }

  const { systemPrompt, maxTokens } = options;

  try {
    const client = getClient();

    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.LLM_TIMEOUT_MS);

    try {
      const response = await client.chat({
        model: config.LLM_MODEL,
        messages,
        options: maxTokens ? { num_predict: maxTokens } : undefined,
      });

      clearTimeout(timeoutId);
      return response.message.content.trim();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("[LLM] Request timed out");
    } else {
      console.warn("[LLM] Completion failed:", error);
    }
    return null;
  }
}

/*
 * Generate an embedding vector for text using Ollama.
 * Returns null if LLM is unavailable or on error.
 *
 * Uses the configured embedding model (default: mxbai-embed-large, 1024 dimensions).
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!(await isLLMAvailable())) {
    return null;
  }

  try {
    const client = getClient();

    /*
     * Use a longer timeout for embeddings since they process the full text.
     * Typical embedding generation takes 100-500ms for short text,
     * but can take 1-2s for longer documents.
     */
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.LLM_TIMEOUT_MS * 2);

    try {
      const response = await client.embed({
        model: config.LLM_EMBEDDING_MODEL,
        input: text,
      });

      clearTimeout(timeoutId);
      return response.embeddings[0];
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("[LLM] Embedding request timed out");
    } else {
      console.warn("[LLM] Embedding generation failed:", error);
    }
    return null;
  }
}

/*
 * Get the embedding model name for metadata.
 */
export function getEmbeddingModelName(): string {
  return config.LLM_EMBEDDING_MODEL;
}
