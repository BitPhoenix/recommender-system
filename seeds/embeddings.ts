import { Session } from "neo4j-driver";
import { Ollama } from "ollama";

/*
 * Self-contained embedding generation for the seed script.
 *
 * This module duplicates some logic from recommender_api to be self-contained
 * in the seeds Docker build context.
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

interface EngineerTextContent {
  engineerId: string;
  headline: string;
  jobTitles: string[];
  skills: string[];
  domains: string[];
  jobHighlights: string[];
  companyNames: string[];
  resumeText: string;
}

/*
 * Load text content for a specific engineer from Neo4j.
 */
async function loadEngineerTextContent(
  session: Session,
  engineerId: string
): Promise<EngineerTextContent | null> {
  const result = await session.run(`
    MATCH (e:Engineer {id: $engineerId})

    // Collect job titles and highlights from work history
    OPTIONAL MATCH (e)-[:HAD_ROLE]->(w:WorkExperience)
    WITH e, collect(DISTINCT w.title) AS jobTitles, collect(DISTINCT w.highlights) AS allHighlights
    WITH e, jobTitles, reduce(acc = [], h IN allHighlights | acc + COALESCE(h, [])) AS flatHighlights

    // Collect company names
    OPTIONAL MATCH (e)-[:HAD_ROLE]->(:WorkExperience)-[:AT_COMPANY]->(c:Company)
    WITH e, jobTitles, flatHighlights, collect(DISTINCT c.name) AS companyNames

    // Collect skills
    OPTIONAL MATCH (e)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
    WITH e, jobTitles, flatHighlights, companyNames, collect(DISTINCT s.name) AS skills

    // Collect domains
    OPTIONAL MATCH (e)-[:HAS_EXPERIENCE_IN]->(bd:BusinessDomain)
    OPTIONAL MATCH (e)-[:HAS_EXPERIENCE_IN]->(td:TechnicalDomain)
    WITH e, jobTitles, flatHighlights, companyNames, skills,
         collect(DISTINCT bd.name) + collect(DISTINCT td.name) AS domains

    // Get resume text
    OPTIONAL MATCH (e)-[:HAS_RESUME]->(r:Resume)

    RETURN
      e.id AS engineerId,
      e.headline AS headline,
      jobTitles,
      skills,
      domains,
      flatHighlights AS jobHighlights,
      companyNames,
      r.rawText AS resumeText
  `, { engineerId });

  if (result.records.length === 0) {
    return null;
  }

  const record = result.records[0];
  return {
    engineerId: record.get("engineerId") as string,
    headline: (record.get("headline") as string) || "",
    jobTitles: (record.get("jobTitles") as string[]) || [],
    skills: ((record.get("skills") as (string | null)[]) || []).filter((s): s is string => s !== null),
    domains: ((record.get("domains") as (string | null)[]) || []).filter((d): d is string => d !== null),
    jobHighlights: (record.get("jobHighlights") as string[]) || [],
    companyNames: (record.get("companyNames") as string[]) || [],
    resumeText: (record.get("resumeText") as string) || "",
  };
}

/*
 * Concatenate engineer text content into a single searchable string.
 */
function concatenateEngineerText(content: EngineerTextContent): string {
  return [
    content.headline,
    content.jobTitles.join(" "),
    content.skills.join(" "),
    content.domains.join(" "),
    content.companyNames.join(" "),
    content.jobHighlights.join(" "),
    content.resumeText,
  ]
    .filter(Boolean)
    .join(" ");
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
      console.warn("[Embedding] Request timed out");
    } else {
      console.warn("[Embedding] Generation failed:", error);
    }
    return null;
  }
}

/*
 * Update a single engineer's embedding.
 */
async function updateEngineerEmbedding(
  session: Session,
  engineerId: string
): Promise<boolean> {
  const content = await loadEngineerTextContent(session, engineerId);
  if (!content) {
    console.warn(`[Embedding] Engineer not found: ${engineerId}`);
    return false;
  }

  const combinedText = concatenateEngineerText(content);

  if (!combinedText.trim()) {
    console.warn(`[Embedding] No text content for engineer: ${engineerId}`);
    return false;
  }

  const embedding = await generateEmbedding(combinedText);
  if (!embedding) {
    console.warn(`[Embedding] Failed to generate embedding for engineer: ${engineerId}`);
    return false;
  }

  await session.run(`
    MATCH (e:Engineer {id: $engineerId})
    SET e.embedding = $embedding,
        e.embeddingModel = $model,
        e.embeddingUpdatedAt = datetime()
  `, {
    engineerId,
    embedding,
    model: LLM_EMBEDDING_MODEL,
  });

  return true;
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
 * Generate embeddings for all engineers.
 *
 * This is a slow operation (~100-500ms per engineer) but only needs to run once
 * during seeding. Subsequent updates happen via resume upload.
 */
export async function seedEngineerEmbeddings(session: Session): Promise<void> {
  console.log("[Seed] Generating engineer embeddings...");
  console.log(`[Seed] Using LLM_HOST: ${LLM_HOST}`);
  console.log(`[Seed] Using embedding model: ${LLM_EMBEDDING_MODEL}`);

  // Check if Ollama is available
  const available = await isOllamaAvailable();
  if (!available) {
    console.warn("[Seed] Ollama not available - skipping embedding generation");
    console.warn("[Seed] Embeddings can be generated later via resume upload endpoint");
    return;
  }

  // Get all engineer IDs without embeddings
  const result = await session.run(`
    MATCH (e:Engineer)
    WHERE e.embedding IS NULL
    RETURN e.id AS engineerId
  `);

  const engineerIds = result.records.map((r) => r.get("engineerId") as string);
  console.log(`[Seed] Found ${engineerIds.length} engineers without embeddings`);

  if (engineerIds.length === 0) {
    console.log("[Seed] All engineers already have embeddings");
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (const engineerId of engineerIds) {
    const success = await updateEngineerEmbedding(session, engineerId);
    if (success) {
      successCount++;
      if (successCount % 10 === 0) {
        console.log(`[Seed] Generated ${successCount}/${engineerIds.length} embeddings...`);
      }
    } else {
      failCount++;
      console.warn(`[Seed] Failed to generate embedding for ${engineerId}`);
    }
  }

  console.log(`[Seed] Embedding generation complete: ${successCount} succeeded, ${failCount} failed`);
}
