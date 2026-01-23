import { Session } from "neo4j-driver";
import { generateCompletion } from "../llm.service.js";
import { seniorityMapping } from "../../config/knowledge-base/compatibility-constraints.config.js";

/*
 * A single job/position extracted from the resume.
 */
export interface ExtractedJob {
  title: string;
  company: string;
  companyType: string;              // Constrained by RAG context
  startDate: string;                // "2020-01" or "2020"
  endDate: string | "present";
  seniority: string;                // junior/mid/senior/staff/principal
  skills: ExtractedJobSkill[];      // Skills used in THIS role
  highlights: string[];             // Key accomplishments at this job
}

export interface ExtractedJobSkill {
  name: string;
  confidence: "explicit" | "inferred" | "uncertain";
}

export interface ExtractedProfile {
  /*
   * Jobs ordered by date ASCENDING (oldest first).
   * This lets us see career progression chronologically.
   */
  jobs: ExtractedJob[];

  /*
   * Standalone skills from the resume's Skills section (not tied to specific jobs).
   * These are normalized separately and create UserSkill nodes without USED_AT links.
   */
  skills: string[];

  /*
   * Business domains from our taxonomy (via RAG context).
   */
  businessDomains: string[];

  /*
   * Technical domains from our taxonomy (via RAG context).
   */
  technicalDomains: string[];

  /*
   * Computed/validated by LLM from job history.
   */
  totalYearsExperience: number;

  /*
   * A one-line professional headline summarizing the candidate.
   */
  headline: string | null;
}

/*
 * RAG context loaded from Neo4j to constrain LLM extraction.
 */
export interface ExtractionRagContext {
  validBusinessDomains: string[];   // From BusinessDomain nodes (e.g., "Fintech", "Healthcare")
  validTechnicalDomains: string[];  // From TechnicalDomain nodes (e.g., "Backend", "DevOps")
  validCompanyTypes: string[];      // Predefined list
  validSeniorities: string[];       // Predefined list
}

/*
 * Valid company types (could also be seeded in Neo4j if needed).
 */
const VALID_COMPANY_TYPES = [
  "FAANG",
  "big-tech",
  "startup",
  "scaleup",
  "enterprise",
  "agency",
  "consultancy",
  "government",
  "nonprofit",
  "other",
];

/*
 * Valid seniority levels - derived from canonical seniorityMapping.
 */
const VALID_SENIORITIES = Object.keys(seniorityMapping);

/*
 * Load RAG context from Neo4j for constraining LLM extraction.
 */
export async function loadExtractionRagContext(session: Session): Promise<ExtractionRagContext> {
  // Load business domains from Neo4j
  const businessDomainResult = await session.run(`
    MATCH (d:BusinessDomain)
    RETURN d.name AS name
    ORDER BY d.name
  `);
  const validBusinessDomains = businessDomainResult.records.map((r) => r.get("name") as string);

  // Load technical domains from Neo4j
  const technicalDomainResult = await session.run(`
    MATCH (d:TechnicalDomain)
    RETURN d.name AS name
    ORDER BY d.name
  `);
  const validTechnicalDomains = technicalDomainResult.records.map((r) => r.get("name") as string);

  return {
    validBusinessDomains,
    validTechnicalDomains,
    validCompanyTypes: VALID_COMPANY_TYPES,
    validSeniorities: VALID_SENIORITIES,
  };
}

const EXTRACTION_SYSTEM_PROMPT = `You are an expert at extracting structured information from developer resumes.
Extract precise, factual information only. Do not infer skills that are not mentioned or strongly implied.
Pay careful attention to dates and job ordering.`;

function buildExtractionPrompt(resumeText: string, ragContext: ExtractionRagContext): string {
  return `Extract structured information from this resume.

Resume:
${resumeText}

IMPORTANT - Use ONLY these values for constrained fields:
- businessDomains: ${ragContext.validBusinessDomains.join(", ")}
- technicalDomains: ${ragContext.validTechnicalDomains.join(", ")}
- companyType: ${ragContext.validCompanyTypes.join(", ")}
- seniority: ${ragContext.validSeniorities.join(", ")}

Return JSON matching this exact schema:
{
  "jobs": [
    {
      "title": string,              // Job title as written
      "company": string,            // Company name
      "companyType": string,        // One of: ${ragContext.validCompanyTypes.join(", ")}
      "startDate": string,          // "YYYY-MM" or "YYYY" if month unknown
      "endDate": string,            // "YYYY-MM", "YYYY", or "present"
      "seniority": string,          // One of: ${ragContext.validSeniorities.join(", ")}
      "skills": [
        {
          "name": string,           // Skill name as written
          "confidence": "explicit" | "inferred" | "uncertain"
        }
      ],
      "highlights": string[]        // Key accomplishments (2-4 bullet points max)
    }
  ],
  "skills": string[],               // Standalone skills from Skills section (not tied to specific jobs)
  "businessDomains": string[],      // Industry domains from: ${ragContext.validBusinessDomains.join(", ")}
  "technicalDomains": string[],     // Technical focus from: ${ragContext.validTechnicalDomains.join(", ")}
  "totalYearsExperience": number,   // Total years in software/tech
  "headline": string | null         // One-line professional summary
}

Rules:
- Order jobs by date ASCENDING (oldest job FIRST, most recent job LAST)
- IMPORTANT: Treat promotions as SEPARATE job entries, even at the same company
  - "Software Engineer at Google (2018-2020)" and "Senior Engineer at Google (2020-2022)" = TWO separate jobs
  - Each promotion level may have different skills, responsibilities, and seniority
- For each job, only include skills that were clearly used in THAT role
- "explicit": skill is directly stated for that job
- "inferred": skill deduced from context (e.g., "deployed to EKS" implies Kubernetes)
- "uncertain": educated guess based on weak signals
- If a date is unclear, make your best estimate based on context
- For companyType, use "other" if none of the options fit
- For businessDomains, include industries the engineer has worked in (e.g., Fintech, Healthcare)
- For technicalDomains, include technical focus areas (e.g., Backend, Frontend, DevOps)
- Only include domains from the provided lists that clearly apply`;
}

/*
 * Extract structured profile from resume text using LLM with RAG context.
 * Returns null if LLM is unavailable.
 */
export async function extractFeaturesFromResume(
  session: Session,
  resumeText: string
): Promise<ExtractedProfile | null> {
  // Load RAG context for constrained extraction
  const ragContext = await loadExtractionRagContext(session);

  const prompt = buildExtractionPrompt(resumeText, ragContext);

  const response = await generateCompletion(prompt, {
    systemPrompt: EXTRACTION_SYSTEM_PROMPT,
    maxTokens: 4000,
  });

  if (!response) {
    return null;
  }

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ||
                      response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[FeatureExtractor] No JSON found in LLM response");
      return null;
    }

    const jsonString = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonString);

    // Basic validation
    if (!Array.isArray(parsed.jobs)) {
      console.warn("[FeatureExtractor] Invalid jobs array in LLM response");
      return null;
    }

    return parsed as ExtractedProfile;
  } catch (error) {
    console.warn("[FeatureExtractor] Failed to parse LLM response:", error);
    return null;
  }
}

/*
 * Collect unique skill names from all sources for normalization efficiency.
 *
 * SKILL SOURCES:
 * 1. Job-specific skills - extracted from job entries
 * 2. Standalone skills - from resume's Skills section (not tied to specific jobs)
 *
 * WHY THIS EXISTS:
 * The same skill (e.g., "React") often appears in multiple places. Normalizing
 * involves database queries (exact match, synonym lookup, fuzzy match). If we
 * normalized inline while iterating, we'd query for "React" N times.
 *
 * Instead, we:
 * 1. Collect unique skill names from ALL sources (this function)
 * 2. Normalize each unique skill ONCE
 * 3. Create UserSkill for each resolved skill
 * 4. For job-specific skills, also create USED_AT links to WorkExperience
 *
 * Job associations are NOT lost - we iterate profile.jobs separately when
 * creating USED_AT relationships. This function returns only names because
 * that's all we need for normalization.
 */
export function getAllUniqueSkillNames(profile: ExtractedProfile): string[] {
  const seenNormalizedNames = new Set<string>();
  const uniqueSkillNames: string[] = [];

  // Collect from job-specific skills
  for (const job of profile.jobs) {
    for (const skill of job.skills) {
      const normalizedSkillName = skill.name.toLowerCase();
      if (!seenNormalizedNames.has(normalizedSkillName)) {
        seenNormalizedNames.add(normalizedSkillName);
        uniqueSkillNames.push(skill.name);  // Keep original casing for normalizer
      }
    }
  }

  // Collect from standalone skills section
  for (const skillName of profile.skills) {
    const normalizedSkillName = skillName.toLowerCase();
    if (!seenNormalizedNames.has(normalizedSkillName)) {
      seenNormalizedNames.add(normalizedSkillName);
      uniqueSkillNames.push(skillName);
    }
  }

  return uniqueSkillNames;
}
