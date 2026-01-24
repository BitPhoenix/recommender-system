import { Session } from "neo4j-driver";
import { normalizeCompanyName } from "./company-normalizer.service.js";
import { findOrCreateCompany } from "./company.service.js";
import { generateEmbedding, getEmbeddingModelName } from "./llm.service.js";
import type { ExtractedJobDescription } from "./job-description-processor/job-description-feature-extractor.service.js";

// ============================================
// QUERY FUNCTIONS
// ============================================

/*
 * Check if a job description exists in the database.
 */
export async function jobDescriptionExists(session: Session, jobId: string): Promise<boolean> {
  const result = await session.run(
    "MATCH (j:JobDescription {id: $jobId}) RETURN j.id AS id LIMIT 1",
    { jobId }
  );
  return result.records.length > 0;
}

// ============================================
// PERSISTENCE FUNCTIONS
// ============================================

/*
 * Create or update job description node in Neo4j.
 * Uses MERGE pattern - creates if not exists, updates if exists.
 */
export async function upsertJobDescriptionNode(
  session: Session,
  jobId: string,
  extractedJob: ExtractedJobDescription,
  jobDescriptionText: string
): Promise<void> {
  await session.run(`
    MERGE (j:JobDescription {id: $jobId})
    ON CREATE SET
      j.title = $title,
      j.description = $description,
      j.companyName = $companyName,
      j.location = $location,
      j.seniority = $seniority,
      j.minBudget = $minBudget,
      j.maxBudget = $maxBudget,
      j.stretchBudget = $stretchBudget,
      j.startTimeline = $startTimeline,
      j.timezone = $timezone,
      j.teamFocus = $teamFocus,
      j.createdAt = datetime()
    ON MATCH SET
      j.title = $title,
      j.description = $description,
      j.companyName = $companyName,
      j.location = $location,
      j.seniority = $seniority,
      j.minBudget = $minBudget,
      j.maxBudget = $maxBudget,
      j.stretchBudget = $stretchBudget,
      j.startTimeline = $startTimeline,
      j.timezone = $timezone,
      j.teamFocus = $teamFocus,
      j.updatedAt = datetime()
  `, {
    jobId,
    title: extractedJob.title,
    description: jobDescriptionText,
    companyName: extractedJob.companyName,
    location: extractedJob.location,
    seniority: extractedJob.seniority,
    minBudget: extractedJob.minBudget,
    maxBudget: extractedJob.maxBudget,
    stretchBudget: extractedJob.stretchBudget ?? null,
    startTimeline: extractedJob.startTimeline,
    timezone: extractedJob.timezone,
    teamFocus: extractedJob.teamFocus ?? null,
  });
}

/*
 * Delete all skill, domain, and company relationships for a job.
 * Used when updating a job to replace relationships with new ones.
 */
export async function deleteJobRelationships(session: Session, jobId: string): Promise<void> {
  await session.run(`
    MATCH (j:JobDescription {id: $jobId})-[r]-()
    WHERE type(r) IN [
      'REQUIRES_SKILL', 'PREFERS_SKILL',
      'REQUIRES_BUSINESS_DOMAIN', 'PREFERS_BUSINESS_DOMAIN',
      'REQUIRES_TECHNICAL_DOMAIN', 'PREFERS_TECHNICAL_DOMAIN',
      'POSTED_BY'
    ]
    DELETE r
  `, { jobId });
}

/*
 * Link job description to a company.
 * Normalizes company name and creates POSTED_BY relationship.
 */
export async function linkJobToCompany(
  session: Session,
  jobId: string,
  companyName: string
): Promise<{ companyId: string; canonicalName: string; method: "exact" | "alias" | "new" }> {
  const normResult = await normalizeCompanyName(session, companyName);

  let companyId: string;
  let canonicalName: string;

  if (normResult.canonicalCompanyId) {
    companyId = normResult.canonicalCompanyId;
    canonicalName = normResult.canonicalCompanyName!;
  } else {
    // Create new company with default type "startup"
    companyId = await findOrCreateCompany(session, companyName, "startup");
    canonicalName = companyName.trim();
  }

  await session.run(`
    MATCH (j:JobDescription {id: $jobId})
    MATCH (c:Company {id: $companyId})
    MERGE (j)-[:POSTED_BY]->(c)
  `, { jobId, companyId });

  return { companyId, canonicalName, method: normResult.method };
}

/*
 * Persist skill relationships for a job.
 */
export async function persistSkillRelationships(
  session: Session,
  jobId: string,
  skills: Array<{
    canonicalId: string;
    isRequired: boolean;
    minProficiency?: string;
  }>
): Promise<void> {
  for (const skill of skills) {
    const relationshipType = skill.isRequired ? "REQUIRES_SKILL" : "PREFERS_SKILL";
    await session.run(`
      MATCH (j:JobDescription {id: $jobId})
      MATCH (s:Skill {id: $skillId})
      MERGE (j)-[r:${relationshipType}]->(s)
      ON CREATE SET r.minProficiency = $minProficiency
      ON MATCH SET r.minProficiency = $minProficiency
    `, {
      jobId,
      skillId: skill.canonicalId,
      minProficiency: skill.minProficiency ?? null,
    });
  }
}

/*
 * Persist business domain relationships for a job.
 */
export async function persistBusinessDomainRelationships(
  session: Session,
  jobId: string,
  domains: Array<{
    canonicalId: string;
    isRequired: boolean;
    minYears?: number;
  }>
): Promise<void> {
  for (const domain of domains) {
    const relationshipType = domain.isRequired
      ? "REQUIRES_BUSINESS_DOMAIN"
      : "PREFERS_BUSINESS_DOMAIN";
    await session.run(`
      MATCH (j:JobDescription {id: $jobId})
      MATCH (d:BusinessDomain {id: $domainId})
      MERGE (j)-[r:${relationshipType}]->(d)
      ON CREATE SET r.minYears = $minYears
      ON MATCH SET r.minYears = $minYears
    `, {
      jobId,
      domainId: domain.canonicalId,
      minYears: domain.minYears ?? null,
    });
  }
}

/*
 * Persist technical domain relationships for a job.
 */
export async function persistTechnicalDomainRelationships(
  session: Session,
  jobId: string,
  domains: Array<{
    canonicalId: string;
    isRequired: boolean;
  }>
): Promise<void> {
  for (const domain of domains) {
    const relationshipType = domain.isRequired
      ? "REQUIRES_TECHNICAL_DOMAIN"
      : "PREFERS_TECHNICAL_DOMAIN";
    await session.run(`
      MATCH (j:JobDescription {id: $jobId})
      MATCH (d:TechnicalDomain {id: $domainId})
      MERGE (j)-[:${relationshipType}]->(d)
    `, {
      jobId,
      domainId: domain.canonicalId,
    });
  }
}

/*
 * Generate and store embedding for job description.
 */
export async function generateJobEmbedding(
  session: Session,
  jobId: string,
  jobDescriptionText: string
): Promise<{ dimensions: number; model: string } | null> {
  const embedding = await generateEmbedding(jobDescriptionText);

  if (!embedding) {
    return null;
  }

  const model = getEmbeddingModelName();
  await session.run(`
    MATCH (j:JobDescription {id: $jobId})
    SET j.embedding = $embedding,
        j.embeddingModel = $model,
        j.embeddingUpdatedAt = datetime()
  `, {
    jobId,
    embedding,
    model,
  });

  return {
    dimensions: embedding.length,
    model,
  };
}
