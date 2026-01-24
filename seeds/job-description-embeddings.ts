import { Session } from "neo4j-driver";
import { Ollama } from "ollama";

/*
 * Self-contained job description embedding generation for the seed script.
 *
 * Generates a 1024-dimensional dense vector for each job description
 * using Ollama's mxbai-embed-large model. Skips jobs that already
 * have embeddings (idempotent).
 */

const LLM_HOST = process.env.LLM_HOST || "http://host.docker.internal:11434";
const LLM_EMBEDDING_MODEL = process.env.LLM_EMBEDDING_MODEL || "mxbai-embed-large";
const LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS || "30000", 10);

let ollamaClient: Ollama | null = null;

function getClient(): Ollama {
  if (!ollamaClient) {
    ollamaClient = new Ollama({ host: LLM_HOST });
  }
  return ollamaClient;
}

/*
 * Check if Ollama is available.
 */
async function isOllamaAvailable(): Promise<boolean> {
  try {
    const client = getClient();
    await client.list();
    return true;
  } catch {
    return false;
  }
}

/*
 * Generate an embedding vector for text using Ollama.
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const client = getClient();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS * 2);

    try {
      const response = await client.embed({
        model: LLM_EMBEDDING_MODEL,
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
      console.warn("[Seed] Job description embedding request timed out");
    } else {
      console.warn("[Seed] Job description embedding generation failed:", error);
    }
    return null;
  }
}

/**
 * Concatenate job title and description for embedding generation.
 *
 * The title provides high-signal keywords (e.g., "Senior Backend Engineer"),
 * while the description provides detailed context about requirements.
 */
function getJobTextForEmbedding(title: string, description: string): string {
  return `${title}\n\n${description}`;
}

/*
 * Seed job description embeddings using Ollama's mxbai-embed-large model.
 *
 * Generates a 1024-dimensional dense vector for each job's title + description.
 * Skips jobs that already have embeddings (idempotent).
 */
export async function seedJobDescriptionEmbeddings(session: Session): Promise<void> {
  console.log("[Seed] Generating job description embeddings...");
  console.log(`[Seed] Using LLM_HOST: ${LLM_HOST}`);
  console.log(`[Seed] Using embedding model: ${LLM_EMBEDDING_MODEL}`);

  // Check if Ollama is available
  const ollamaAvailable = await isOllamaAvailable();
  if (!ollamaAvailable) {
    console.log("[Seed] Ollama not available, skipping job description embeddings.");
    return;
  }

  // Get all job descriptions without embeddings
  const result = await session.run(`
    MATCH (j:JobDescription)
    WHERE j.embedding IS NULL
    RETURN j.id AS jobId, j.title AS title, j.description AS description
  `);

  const jobCount = result.records.length;
  if (jobCount === 0) {
    console.log("[Seed] All job descriptions already have embeddings.");
    return;
  }

  console.log(`[Seed] Generating embeddings for ${jobCount} job descriptions...`);

  let successCount = 0;
  let failCount = 0;

  for (const record of result.records) {
    const jobId = record.get("jobId") as string;
    const title = record.get("title") as string;
    const description = record.get("description") as string;

    const textForEmbedding = getJobTextForEmbedding(title, description);
    const embedding = await generateEmbedding(textForEmbedding);

    if (embedding) {
      await session.run(`
        MATCH (j:JobDescription {id: $jobId})
        SET j.embedding = $embedding,
            j.embeddingModel = $model,
            j.embeddingUpdatedAt = datetime()
      `, {
        jobId,
        embedding,
        model: LLM_EMBEDDING_MODEL,
      });
      successCount++;
    } else {
      console.warn(`[Seed] Failed to generate embedding for job: ${title}`);
      failCount++;
    }

    // Progress logging every 5 jobs (fewer jobs than skills)
    if ((successCount + failCount) % 5 === 0) {
      console.log(`[Seed] Progress: ${successCount + failCount}/${jobCount} jobs processed`);
    }
  }

  console.log(`[Seed] Job description embeddings complete: ${successCount} success, ${failCount} failed`);
}
