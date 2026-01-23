import { Session } from "neo4j-driver";
import {
  buildTfIdfIndex,
  type Document,
  type TfIdfIndex,
} from "./tfidf-vectorizer.service.js";
import { loadEngineerTextContent, concatenateEngineerText } from "./engineer-text-loader.service.js";

// In-memory index (rebuilt on startup, updated on resume upload)
let tfIdfIndex: TfIdfIndex | null = null;

/*
 * Load all engineer documents from Neo4j with concatenated text.
 *
 * Uses the shared engineer text loader which aggregates:
 * - Headline
 * - Job titles from WorkExperience nodes
 * - Skills from UserSkill → Skill relationships
 * - Domains from BusinessDomain and TechnicalDomain relationships
 * - Company names from WorkExperience → Company relationships
 * - Job highlights from WorkExperience nodes
 * - Resume text
 */
async function loadEngineerDocuments(session: Session): Promise<Document[]> {
  const contents = await loadEngineerTextContent(session);
  return contents.map((content) => ({
    id: content.engineerId,
    text: concatenateEngineerText(content),
  }));
}

/*
 * Build or rebuild the TF-IDF index from all engineers in Neo4j.
 */
export async function buildEngineerTfIdfIndex(session: Session): Promise<TfIdfIndex> {
  const documents = await loadEngineerDocuments(session);
  tfIdfIndex = buildTfIdfIndex(documents);

  console.log(
    `[TF-IDF] Built index with ${tfIdfIndex.totalDocuments} documents, ` +
    `${tfIdfIndex.vocabulary.size} terms`
  );

  return tfIdfIndex;
}

/*
 * Get the current TF-IDF index, building it if necessary.
 */
export async function getTfIdfIndex(session: Session): Promise<TfIdfIndex> {
  if (!tfIdfIndex) {
    return buildEngineerTfIdfIndex(session);
  }
  return tfIdfIndex;
}

/*
 * Update the index after a new or updated engineer document.
 *
 * Currently rebuilds the entire index for simplicity. This is acceptable because:
 * 1. Corpus is small (hundreds of engineers)
 * 2. Resume uploads are infrequent
 * 3. Rebuild is fast at this scale
 *
 * Revisit if: corpus grows to thousands+ documents AND uploads become frequent.
 * At that point, consider accepting stale IDF values for new documents and
 * rebuilding the full index periodically in a background job.
 */
export async function updateTfIdfIndex(session: Session): Promise<void> {
  await buildEngineerTfIdfIndex(session);
}

/*
 * Reset the index (for testing).
 */
export function resetTfIdfIndex(): void {
  tfIdfIndex = null;
}
