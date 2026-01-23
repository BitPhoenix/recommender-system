import { Session } from "neo4j-driver";
import { Ollama } from "ollama";

/*
 * Self-contained skill embedding generation for the seed script.
 *
 * Generates a 1024-dimensional dense vector for each skill name
 * using Ollama's mxbai-embed-large model. Skips skills that already
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
  } catch (error) {
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
      console.warn("[Seed] Skill embedding request timed out");
    } else {
      console.warn("[Seed] Skill embedding generation failed:", error);
    }
    return null;
  }
}

/*
 * Seed skill embeddings using Ollama's mxbai-embed-large model.
 *
 * Generates a 1024-dimensional dense vector for each skill name.
 * Skips skills that already have embeddings (idempotent).
 */
export async function seedSkillEmbeddings(session: Session): Promise<void> {
  console.log("[Seed] Generating skill embeddings...");
  console.log(`[Seed] Using LLM_HOST: ${LLM_HOST}`);
  console.log(`[Seed] Using embedding model: ${LLM_EMBEDDING_MODEL}`);

  // Check if Ollama is available
  const ollamaAvailable = await isOllamaAvailable();
  if (!ollamaAvailable) {
    console.log("[Seed] Ollama not available, skipping skill embeddings.");
    return;
  }

  // Get all skills without embeddings
  const result = await session.run(`
    MATCH (s:Skill)
    WHERE s.embedding IS NULL
    RETURN s.id AS skillId, s.name AS skillName
  `);

  const skillCount = result.records.length;
  if (skillCount === 0) {
    console.log("[Seed] All skills already have embeddings.");
    return;
  }

  console.log(`[Seed] Generating embeddings for ${skillCount} skills...`);

  let successCount = 0;
  let failCount = 0;

  for (const record of result.records) {
    const skillId = record.get("skillId") as string;
    const skillName = record.get("skillName") as string;

    const embedding = await generateEmbedding(skillName);
    if (embedding) {
      await session.run(`
        MATCH (s:Skill {id: $skillId})
        SET s.embedding = $embedding,
            s.embeddingModel = $model,
            s.embeddingUpdatedAt = datetime()
      `, {
        skillId,
        embedding,
        model: LLM_EMBEDDING_MODEL,
      });
      successCount++;
    } else {
      console.warn(`[Seed] Failed to generate embedding for skill: ${skillName}`);
      failCount++;
    }

    // Progress logging every 20 skills
    if ((successCount + failCount) % 20 === 0) {
      console.log(`[Seed] Progress: ${successCount + failCount}/${skillCount} skills processed`);
    }
  }

  console.log(`[Seed] Skill embeddings complete: ${successCount} success, ${failCount} failed`);
}
