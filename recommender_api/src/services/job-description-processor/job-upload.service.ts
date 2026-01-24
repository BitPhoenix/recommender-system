import { Session } from "neo4j-driver";
import { v4 as uuidv4 } from "uuid";
import type { ExtractedJobDescription } from "./job-description-feature-extractor.service.js";
import { extractFeaturesFromJobDescription } from "./job-description-feature-extractor.service.js";
import { normalizeExtractedSkills } from "../skill-normalizer.service.js";
import { normalizeExtractedDomains } from "../domain-normalizer.service.js";
import {
  jobDescriptionExists,
  deleteJobRelationships,
  upsertJobDescriptionNode,
  linkJobToCompany,
  persistSkillRelationships,
  persistBusinessDomainRelationships,
  persistTechnicalDomainRelationships,
  generateJobEmbedding,
} from "../job.service.js";

// ============================================
// ERRORS
// ============================================

/*
 * Thrown when LLM feature extraction fails (e.g., LLM unavailable or invalid response).
 */
export class ExtractionFailedError extends Error {
  constructor(message: string = "Failed to extract features from job description") {
    super(message);
    this.name = "ExtractionFailedError";
  }
}

// ============================================
// TYPES
// ============================================

export interface JobUploadResult {
  jobId: string;
  isNewJob: boolean;
  extractedFeatures: ExtractedJobDescription;
  validationResults: JobValidationResults;
  embedding: {
    dimensions: number;
    model: string;
  } | null;  // null if LLM unavailable
}

export interface JobValidationResults {
  resolvedSkills: Array<{
    extracted: string;
    canonicalId: string | null;
    canonicalName: string | null;
    method: string;
    confidence: number;
    isRequired: boolean;
    minProficiency?: string;
  }>;
  unresolvedSkills: Array<{
    extracted: string;
    isRequired: boolean;
    minProficiency?: string;
  }>;
  resolvedBusinessDomains: Array<{
    extracted: string;
    canonicalId: string | null;
    canonicalName: string | null;
    isRequired: boolean;
    minYears?: number;
  }>;
  unresolvedBusinessDomains: string[];
  resolvedTechnicalDomains: Array<{
    extracted: string;
    canonicalId: string | null;
    canonicalName: string | null;
    isRequired: boolean;
  }>;
  unresolvedTechnicalDomains: string[];
  company?: {
    extracted: string;
    canonicalId: string;
    canonicalName: string;
    method: "exact" | "alias" | "new";
  };
}

// ============================================
// MAIN EXPORT FUNCTIONS
// ============================================

/*
 * Process a job description upload: extract features, normalize, persist, and generate embedding.
 *
 * Supports both create (no jobId) and update (with jobId) operations,
 * mirroring the resume upload pattern.
 *
 * @throws ExtractionFailedError if LLM feature extraction fails
 */
export async function processJobDescriptionUpload(
  session: Session,
  jobDescriptionText: string,
  existingJobId?: string
): Promise<JobUploadResult> {
  let jobId: string;
  let isNewJob: boolean;

  // Step 1: Determine create vs update (check existence BEFORE extraction for better error messages)
  if (existingJobId) {
    // Update existing job - verify it exists first
    const exists = await jobDescriptionExists(session, existingJobId);
    if (!exists) {
      throw new Error(`Job description not found: ${existingJobId}`);
    }
    jobId = existingJobId;
    isNewJob = false;
  } else {
    // Create new job
    jobId = `job_${uuidv4().slice(0, 8)}`;
    isNewJob = true;
  }

  // Step 2: Extract features from job description text via LLM
  const extractedJobFeatures = await extractFeaturesFromJobDescription(session, jobDescriptionText);
  if (!extractedJobFeatures) {
    throw new ExtractionFailedError("Failed to extract features from job description. LLM may be unavailable.");
  }

  // Step 3: For updates, delete existing relationships before re-creating
  if (!isNewJob) {
    await deleteJobRelationships(session, jobId);
  }

  // Step 4: Create or update job description node (stores original text)
  await upsertJobDescriptionNode(session, jobId, extractedJobFeatures, jobDescriptionText);

  // Build lookup maps from original names to extracted info (used for relationship creation and validation)
  // Use defaults for arrays in case LLM returns null/undefined
  const skills = extractedJobFeatures.skills || [];
  const businessDomains = extractedJobFeatures.businessDomains || [];
  const technicalDomains = extractedJobFeatures.technicalDomains || [];

  const skillNameToExtractedSkill = new Map(
    skills.map((s) => [s.name.toLowerCase(), s])
  );
  const businessDomainNameToExtractedDomain = new Map(
    businessDomains.map((d) => [d.name.toLowerCase(), d])
  );
  const technicalDomainNameToExtractedDomain = new Map(
    technicalDomains.map((d) => [d.name.toLowerCase(), d])
  );

  // Step 5: Normalize and link company (if provided)
  let companyResult: { companyId: string; canonicalName: string; method: "exact" | "alias" | "new" } | undefined;
  if (extractedJobFeatures.companyName) {
    companyResult = await linkJobToCompany(session, jobId, extractedJobFeatures.companyName);
  }

  // Step 6: Normalize and link skills
  const skillNames = skills.map((skill) => skill.name);
  const { resolvedSkills: normalizedSkills, unresolvedSkills: unresolvedNormalizedSkills } =
    await normalizeExtractedSkills(session, skillNames);

  const skillsForRelationships = joinNormalizedWithExtracted(
    normalizedSkills,
    skillNameToExtractedSkill,
    (normalized, extracted) => normalized.canonicalSkillId ? {
      canonicalId: normalized.canonicalSkillId,
      isRequired: extracted.isRequired,
      minProficiency: extracted.minProficiency,
    } : null
  );
  await persistSkillRelationships(session, jobId, skillsForRelationships);

  // Step 7: Normalize and link business domains
  const businessDomainNames = businessDomains.map((domain) => domain.name);
  const { resolvedDomains: resolvedBusinessDomains, unresolvedDomains: unresolvedBusiness } =
    await normalizeExtractedDomains(session, businessDomainNames, "BusinessDomain");

  const businessDomainsForRelationships = joinNormalizedWithExtracted(
    resolvedBusinessDomains,
    businessDomainNameToExtractedDomain,
    (normalized, extracted) => normalized.canonicalDomainId ? {
      canonicalId: normalized.canonicalDomainId,
      isRequired: extracted.isRequired,
      minYears: extracted.minYears,
    } : null
  );
  await persistBusinessDomainRelationships(session, jobId, businessDomainsForRelationships);

  // Step 8: Normalize and link technical domains
  const technicalDomainNames = technicalDomains.map((domain) => domain.name);
  const { resolvedDomains: resolvedTechnicalDomains, unresolvedDomains: unresolvedTechnical } =
    await normalizeExtractedDomains(session, technicalDomainNames, "TechnicalDomain");

  const technicalDomainsForRelationships = joinNormalizedWithExtracted(
    resolvedTechnicalDomains,
    technicalDomainNameToExtractedDomain,
    (normalized, extracted) => normalized.canonicalDomainId ? {
      canonicalId: normalized.canonicalDomainId,
      isRequired: extracted.isRequired,
    } : null
  );
  await persistTechnicalDomainRelationships(session, jobId, technicalDomainsForRelationships);

  // Step 9: Generate embedding (required for semantic search)
  const embeddingResult = await generateJobEmbedding(
    session,
    jobId,
    jobDescriptionText
  );

  // Build validation results for API response
  const validationResults: JobValidationResults = {
    resolvedSkills: normalizedSkills
      .filter((normalizedSkill) => normalizedSkill.canonicalSkillId !== null)
      .map((normalizedSkill) => {
        const extractedSkill = skillNameToExtractedSkill.get(normalizedSkill.originalName.toLowerCase());
        return {
          extracted: normalizedSkill.originalName,
          canonicalId: normalizedSkill.canonicalSkillId,
          canonicalName: normalizedSkill.canonicalSkillName,
          method: normalizedSkill.method,
          confidence: normalizedSkill.confidence,
          isRequired: extractedSkill?.isRequired ?? true,
          minProficiency: extractedSkill?.minProficiency,
        };
      }),
    unresolvedSkills: unresolvedNormalizedSkills.map((unresolvedSkill) => {
      const extractedSkill = skillNameToExtractedSkill.get(unresolvedSkill.originalName.toLowerCase());
      return {
        extracted: unresolvedSkill.originalName,
        isRequired: extractedSkill?.isRequired ?? true,
        minProficiency: extractedSkill?.minProficiency,
      };
    }),
    resolvedBusinessDomains: resolvedBusinessDomains
      .filter((normalizedDomain) => normalizedDomain.canonicalDomainId !== null)
      .map((normalizedDomain) => {
        const extractedDomain = businessDomainNameToExtractedDomain.get(normalizedDomain.originalName.toLowerCase());
        return {
          extracted: normalizedDomain.originalName,
          canonicalId: normalizedDomain.canonicalDomainId,
          canonicalName: normalizedDomain.canonicalDomainName,
          isRequired: extractedDomain?.isRequired ?? true,
          minYears: extractedDomain?.minYears,
        };
      }),
    unresolvedBusinessDomains: unresolvedBusiness.map((unresolvedDomain) => unresolvedDomain.originalName),
    resolvedTechnicalDomains: resolvedTechnicalDomains
      .filter((normalizedDomain) => normalizedDomain.canonicalDomainId !== null)
      .map((normalizedDomain) => {
        const extractedDomain = technicalDomainNameToExtractedDomain.get(normalizedDomain.originalName.toLowerCase());
        return {
          extracted: normalizedDomain.originalName,
          canonicalId: normalizedDomain.canonicalDomainId,
          canonicalName: normalizedDomain.canonicalDomainName,
          isRequired: extractedDomain?.isRequired ?? true,
        };
      }),
    unresolvedTechnicalDomains: unresolvedTechnical.map((unresolvedDomain) => unresolvedDomain.originalName),
    company: companyResult ? {
      extracted: extractedJobFeatures.companyName!,
      canonicalId: companyResult.companyId,
      canonicalName: companyResult.canonicalName,
      method: companyResult.method,
    } : undefined,
  };

  return {
    jobId,
    isNewJob,
    extractedFeatures: extractedJobFeatures,
    validationResults,
    embedding: embeddingResult,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/*
 * Join normalized results with extracted info and build relationship objects.
 * Filters out items that couldn't be normalized (no canonicalId) or matched.
 */
function joinNormalizedWithExtracted<TNormalized extends { originalName: string }, TExtracted, TRelationship>(
  normalizedItems: TNormalized[],
  extractedLookup: Map<string, TExtracted>,
  buildRelationship: (normalized: TNormalized, extracted: TExtracted) => TRelationship | null
): TRelationship[] {
  return normalizedItems
    .map((normalized) => {
      const extracted = extractedLookup.get(normalized.originalName.toLowerCase());
      if (!extracted) return null;
      return buildRelationship(normalized, extracted);
    })
    .filter((item): item is TRelationship => item !== null);
}
