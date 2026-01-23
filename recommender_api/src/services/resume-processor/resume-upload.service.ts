import { Session } from "neo4j-driver";
import type {
  ResumeUploadRequest,
  ResumeUploadResponse,
  ResumeUploadValidationResults,
} from "../../schemas/resume.schema.js";
import {
  extractFeaturesFromResume,
  getAllUniqueSkillNames,
  type ExtractedProfile,
} from "./feature-extractor.service.js";
import { normalizeExtractedSkills } from "../skill-normalizer.service.js";
import { normalizeExtractedDomains } from "../domain-normalizer.service.js";
import { linkEngineerToDomains } from "../domain.service.js";
import {
  engineerExists,
  createEngineer,
  updateEngineerProperties,
} from "../engineer.service.js";
import { storeResume } from "../resume.service.js";
import { createUserSkills, buildSkillNameToWorkExperienceIdMap } from "../user-skill.service.js";
import { createWorkExperiencesFromExtractedJobs } from "../work-experience.service.js";
import { updateTfIdfIndex } from "../content-search/tfidf-index-manager.service.js";
import { updateEngineerEmbedding } from "../content-search/embedding-index-manager.service.js";
import { getEmbeddingModelName } from "../llm.service.js";
import { calculateAndStoreSkillYears } from "./skill-years.service.js";

/*
 * Process a resume upload request.
 *
 * PROCESSING FLOW:
 * 1. Create or validate engineer
 * 2. Store resume text
 * 3. Extract features via LLM (if not skipped)
 * 4. Normalize and store extracted data
 * 5. Update TF-IDF index (if requested)
 */
export async function processResumeUpload(
  session: Session,
  request: ResumeUploadRequest
): Promise<ResumeUploadResponse> {
  let engineerId: string;
  let isNewEngineer = false;
  let extractedFeatures: ExtractedProfile | null = null;
  let validationResults: ResumeUploadValidationResults | undefined;

  // Step 1: Create or validate engineer
  if (request.engineerId) {
    // Update existing engineer
    const exists = await engineerExists(session, request.engineerId);
    if (!exists) {
      throw new Error(`Engineer not found: ${request.engineerId}`);
    }
    engineerId = request.engineerId;
  } else {
    // Create new engineer
    engineerId = await createEngineer(session, request.name!, request.email!);
    isNewEngineer = true;
  }

  // Step 2: Store resume text (if provided)
  if (request.resumeText) {
    await storeResume(session, engineerId, request.resumeText);
  }

  // Step 3: Extract features via LLM (if not skipped)
  if (request.resumeText && !request.skipFeatureExtraction) {
    extractedFeatures = await extractFeaturesFromResume(session, request.resumeText);

    if (extractedFeatures) {
      // Step 3a: Update engineer properties
      await updateEngineerProperties(session, engineerId, extractedFeatures);

      // Step 3b: Normalize and link domains
      const { resolvedDomains: resolvedBusinessDomains, unresolvedDomains: unresolvedBusinessDomains } =
        await normalizeExtractedDomains(session, extractedFeatures.businessDomains, "BusinessDomain");
      await linkEngineerToDomains(session, engineerId, resolvedBusinessDomains, "BusinessDomain");

      const { resolvedDomains: resolvedTechnicalDomains, unresolvedDomains: unresolvedTechnicalDomains } =
        await normalizeExtractedDomains(session, extractedFeatures.technicalDomains, "TechnicalDomain");
      await linkEngineerToDomains(session, engineerId, resolvedTechnicalDomains, "TechnicalDomain");

      /*
       * SKILL NORMALIZATION STRATEGY:
       *
       * GRAPH MODEL:
       * - Skill: shared canonical skill node from our taxonomy (e.g., "Python")
       * - UserSkill: per-engineer node representing "this engineer knows this skill"
       *   - Can hold engineer-specific data (proficiency, years with skill, etc.)
       *   - Multiple engineers' UserSkills point to the same shared Skill
       * - USED_AT: links UserSkill to specific jobs where the skill was used
       *
       * SKILL SOURCES:
       * 1. Job-specific skills - extracted from job entries (get USED_AT relationship)
       * 2. Standalone skills - from resume's Skills section (no job association)
       *
       * NORMALIZATION FLOW:
       * 1. Collect ALL unique skill names (from jobs + standalone skills section)
       * 2. Normalize each unique name ONCE (avoids duplicate DB queries for "React" appearing 5x)
       * 3. Create UserSkill for each resolved skill
       * 4. For job-specific skills, also create USED_AT links to WorkExperience
       */
      const uniqueSkillNames = getAllUniqueSkillNames(extractedFeatures);

      /*
       * Normalize extracted skill names to our canonical skill taxonomy.
       * Example: "JS", "javascript", "JavaScript" → canonical skill "JavaScript" (id: "javascript")
       *
       * Returns resolved skills (matched our taxonomy) and unresolved skills (needs review).
       */
      const { resolvedSkills, unresolvedSkills } = await normalizeExtractedSkills(session, uniqueSkillNames);

      // Create work history (Companies, WorkExperiences)
      const jobIndexToWorkExperienceId = await createWorkExperiencesFromExtractedJobs(session, engineerId, extractedFeatures.jobs);

      // Build skill → workExperienceIds map from job structure (pure function)
      const skillNameToWorkExperienceIds = buildSkillNameToWorkExperienceIdMap(extractedFeatures.jobs, jobIndexToWorkExperienceId);

      /*
       * Create UserSkills with USED_AT links in a single pass.
       *
       * Skills from the resume's Skills section → UserSkill only (no job association)
       * Skills from work experience entries → UserSkill + USED_AT links to those jobs
       *
       * The skillNameToWorkExperienceIds map tells us which skills came from jobs.
       * Skills not in that map are standalone (from the Skills section).
       */
      await createUserSkills(session, engineerId, resolvedSkills, skillNameToWorkExperienceIds);

      /*
       * Calculate yearsUsed for each UserSkill based on linked WorkExperience durations.
       * This must happen AFTER createUserSkills since it reads USED_AT relationships.
       * Overlapping job durations are merged to avoid double-counting.
       */
      await calculateAndStoreSkillYears(session, engineerId);

      validationResults = {
        resolvedSkills: resolvedSkills.map((n) => ({
          extracted: n.originalName,
          canonicalId: n.canonicalSkillId,
          canonicalName: n.canonicalSkillName,
          method: n.method,
          confidence: n.confidence,
        })),
        unresolvedSkills: unresolvedSkills.map((n) => n.originalName),
        resolvedBusinessDomains: resolvedBusinessDomains.map((d) => ({
          extracted: d.originalName,
          canonicalId: d.canonicalDomainId,
          canonicalName: d.canonicalDomainName,
        })),
        unresolvedBusinessDomains: unresolvedBusinessDomains.map((d) => d.originalName),
        resolvedTechnicalDomains: resolvedTechnicalDomains.map((d) => ({
          extracted: d.originalName,
          canonicalId: d.canonicalDomainId,
          canonicalName: d.canonicalDomainName,
        })),
        unresolvedTechnicalDomains: unresolvedTechnicalDomains.map((d) => d.originalName),
      };
    }
  }

  // Step 4: Update TF-IDF index
  if (request.generateVectors?.includes("tfidf")) {
    await updateTfIdfIndex(session);
  }

  // Step 5: Generate embedding
  let embeddingGenerated = false;
  if (request.generateVectors?.includes("embedding")) {
    embeddingGenerated = await updateEngineerEmbedding(session, engineerId);
  }

  // Build response
  const response: ResumeUploadResponse = {
    engineerId,
    isNewEngineer,
  };

  if (extractedFeatures) {
    response.extractedFeatures = extractedFeatures;
  }

  if (validationResults) {
    response.validationResults = validationResults;
  }

  if (request.generateVectors?.length) {
    response.vectors = {};
    if (request.generateVectors.includes("tfidf")) {
      response.vectors.tfidf = {
        termCount: 0,  // Will be populated from index stats
        nonZeroTerms: 0,
      };
    }
    if (request.generateVectors.includes("embedding") && embeddingGenerated) {
      response.vectors.embedding = {
        dimensions: 1024,  // mxbai-embed-large dimension
      };
    }
  }

  return response;
}
