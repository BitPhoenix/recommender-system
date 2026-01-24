import { Session } from "neo4j-driver";
import { generateCompletion } from "../llm.service.js";
import type {
  SeniorityLevel,
  StartTimeline,
  TeamFocus,
  USTimezoneZone,
  ProficiencyLevel,
} from "../../types/enums.types.js";
import {
  SENIORITY_LEVEL_ORDER,
  START_TIMELINE_ORDER,
  PROFICIENCY_LEVEL_ORDER,
  TEAM_FOCUS_VALUES,
  US_TIMEZONE_ZONE_ORDER,
} from "../../types/enums.types.js";

/*
 * Extracted skill with requirement type (required vs preferred).
 */
export interface ExtractedJobSkill {
  name: string;
  isRequired: boolean;
  minProficiency?: ProficiencyLevel;
}

/*
 * Extracted business domain with requirement type and experience requirement.
 */
export interface ExtractedBusinessDomain {
  name: string;
  isRequired: boolean;
  minYears?: number;
}

/*
 * Extracted technical domain with requirement type.
 */
export interface ExtractedTechnicalDomain {
  name: string;
  isRequired: boolean;
}

/*
 * Structured data extracted from job description text.
 * Note: The original job description text is stored separately on the JobDescription
 * node and used for embedding generation (not extracted/summarized by LLM).
 */
export interface ExtractedJobDescription {
  title: string;
  companyName: string | null;
  location: string | null;
  seniority: SeniorityLevel;
  minBudget: number | null;
  maxBudget: number | null;
  stretchBudget?: number | null;
  startTimeline: StartTimeline;
  timezone: USTimezoneZone[];
  teamFocus?: TeamFocus;
  skills: ExtractedJobSkill[];
  businessDomains: ExtractedBusinessDomain[];
  technicalDomains: ExtractedTechnicalDomain[];
}

/*
 * RAG context for constraining LLM extraction.
 * Combines static enum values with dynamic values from Neo4j.
 */
interface ExtractionRagContext {
  validBusinessDomains: string[];
  validTechnicalDomains: string[];
  validCompanyNames: string[];  // Known companies for better extraction
}

// ============================================
// MAIN EXPORT FUNCTIONS
// ============================================

/*
 * Extract structured job description from raw text using LLM with RAG context.
 * Returns null if LLM is unavailable.
 */
export async function extractFeaturesFromJobDescription(
  session: Session,
  jobDescriptionText: string
): Promise<ExtractedJobDescription | null> {
  const ragContext = await loadJobExtractionRagContext(session);
  const prompt = buildExtractionPrompt(jobDescriptionText, ragContext);

  const response = await generateCompletion(prompt, {
    systemPrompt: EXTRACTION_SYSTEM_PROMPT,
    maxTokens: 4000,
  });

  if (!response) {
    return null;
  }

  try {
    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ||
                      response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[JobFeatureExtractor] No JSON found in LLM response");
      return null;
    }

    let jsonString = jsonMatch[1] || jsonMatch[0];
    // Strip comments that some LLMs add (JSON doesn't support comments)
    jsonString = jsonString.replace(/\/\*[\s\S]*?\*\//g, "");  // Block comments /* ... */
    jsonString = jsonString.replace(/\/\/[^\n]*/g, "");        // Single-line comments // ...
    // Remove trailing commas before ] or }
    jsonString = jsonString.replace(/,(\s*[}\]])/g, "$1");
    const parsed = JSON.parse(jsonString);

    // Basic validation
    if (!parsed.title || !parsed.seniority) {
      console.warn("[JobFeatureExtractor] Missing required fields in LLM response");
      return null;
    }

    // Filter out any skills/domains with null or missing names (LLM occasionally returns malformed data)
    if (parsed.skills) {
      parsed.skills = parsed.skills.filter((s: { name?: string }) => s.name && typeof s.name === "string");
    }
    if (parsed.businessDomains) {
      parsed.businessDomains = parsed.businessDomains.filter((d: { name?: string }) => d.name && typeof d.name === "string");
    }
    if (parsed.technicalDomains) {
      parsed.technicalDomains = parsed.technicalDomains.filter((d: { name?: string }) => d.name && typeof d.name === "string");
    }

    return parsed as ExtractedJobDescription;
  } catch (error) {
    console.warn("[JobFeatureExtractor] Failed to parse LLM response:", error);
    return null;
  }
}

/*
 * Collect unique skill names from extracted job description.
 */
export function getUniqueSkillNames(extractedJob: ExtractedJobDescription): string[] {
  const seen = new Set<string>();
  const uniqueNames: string[] = [];

  for (const skill of extractedJob.skills) {
    const normalized = skill.name.toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueNames.push(skill.name);
    }
  }

  return uniqueNames;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/*
 * Load RAG context from Neo4j for constraining LLM extraction.
 * Static enum values are imported from enums.types.ts.
 */
export async function loadJobExtractionRagContext(session: Session): Promise<ExtractionRagContext> {
  const businessDomainResult = await session.run(`
    MATCH (d:BusinessDomain)
    RETURN d.name AS name
    ORDER BY d.name
  `);
  const validBusinessDomains = businessDomainResult.records.map((r) => r.get("name") as string);

  const technicalDomainResult = await session.run(`
    MATCH (d:TechnicalDomain)
    RETURN d.name AS name
    ORDER BY d.name
  `);
  const validTechnicalDomains = technicalDomainResult.records.map((r) => r.get("name") as string);

  // Load known companies for better extraction
  const companyResult = await session.run(`
    MATCH (c:Company)
    RETURN c.name AS name
    ORDER BY c.name
  `);
  const validCompanyNames = companyResult.records.map((r) => r.get("name") as string);

  return {
    validBusinessDomains,
    validTechnicalDomains,
    validCompanyNames,
  };
}

const EXTRACTION_SYSTEM_PROMPT = `You are an expert at extracting structured information from job descriptions.
Extract precise, factual information only. When information is not provided, use null or reasonable defaults.
Be careful to distinguish between required and preferred skills/domains.`;

function buildExtractionPrompt(jobDescriptionText: string, ragContext: ExtractionRagContext): string {
  const seniorities = SENIORITY_LEVEL_ORDER.join(", ");
  const timezones = US_TIMEZONE_ZONE_ORDER.join(", ");
  const timelines = START_TIMELINE_ORDER.join(", ");
  const teamFocusValues = TEAM_FOCUS_VALUES.join(", ");
  const proficiencies = PROFICIENCY_LEVEL_ORDER.join(", ");

  return `Extract structured information from this job description.

Job Description:
${jobDescriptionText}

IMPORTANT - Use ONLY these values for constrained fields:
- seniority: ${seniorities}
- timezone: ${timezones} (can be multiple)
- startTimeline: ${timelines}
- teamFocus: ${teamFocusValues} (or null if not specified)
- businessDomains: ${ragContext.validBusinessDomains.join(", ")}
- technicalDomains: ${ragContext.validTechnicalDomains.join(", ")}
- minProficiency: ${proficiencies} (or null)

Return JSON matching this exact schema:
{
  "title": string,                // Job title
  "companyName": string | null,   // Company name if mentioned
  "location": string | null,      // Location (city, state, "Remote", etc.)
  "seniority": string,            // One of: ${seniorities}
  "minBudget": number | null,     // Minimum salary/rate (annual USD)
  "maxBudget": number | null,     // Maximum salary/rate (annual USD)
  "stretchBudget": number | null, // Stretch budget if mentioned
  "startTimeline": string,        // When they need someone: ${timelines}
  "timezone": string[],           // Acceptable timezones from: ${timezones}
  "teamFocus": string | null,     // Type of work: ${teamFocusValues}
  "skills": [
    {
      "name": string,             // Skill name as written
      "isRequired": boolean,      // true if "required", false if "nice to have" or "preferred"
      "minProficiency": string | null  // One of: ${proficiencies}
    }
  ],
  "businessDomains": [
    {
      "name": string,             // From: ${ragContext.validBusinessDomains.join(", ")}
      "isRequired": boolean,
      "minYears": number | null   // Years of experience if specified
    }
  ],
  "technicalDomains": [
    {
      "name": string,             // From: ${ragContext.validTechnicalDomains.join(", ")}
      "isRequired": boolean
    }
  ]
}

Rules:
- "Required" skills appear in "Requirements" sections or use words like "must have", "required", "essential"
- "Preferred" skills appear in "Nice to have" sections or use words like "bonus", "preferred", "ideally"
- If no salary info, use null for budget fields
- If timezone not specified, assume all US timezones: ["Eastern", "Central", "Mountain", "Pacific"]
- For startTimeline, use "one_month" as default if not specified
- Only include domains from the provided lists that clearly apply
- IMPORTANT: For skills, extract ONLY the technology/skill name itself (e.g., "TypeScript", "PostgreSQL", "React") - NOT descriptive phrases like "Strong TypeScript programming skills" or "PostgreSQL database experience"
- IMPORTANT: Every skill/domain entry MUST have a non-null "name" string. Do NOT include entries with null names - simply omit them.
- CRITICAL: Return ONLY valid JSON with no comments, no trailing commas, and no explanatory text`;
}
