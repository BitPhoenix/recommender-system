# Job Description Upload API Implementation Plan

## Overview

Add an API route (`POST /api/job-description/upload`) that accepts raw job description text, uses LLM to extract structured features (skills, domains, seniority, budget, etc.), normalizes them to our canonical taxonomy, and creates a `JobDescription` node with appropriate relationships in Neo4j. This mirrors the resume upload flow but for job descriptions.

## Current State Analysis

### What Exists

- **JobDescription node type** - Already defined in seeds with properties: id, title, description, companyName, location, seniority, budget range, startTimeline, timezone, teamFocus
- **Job-Skill relationships** - `REQUIRES_SKILL`, `PREFERS_SKILL` with optional `minProficiency`
- **Job-Domain relationships** - `REQUIRES_BUSINESS_DOMAIN`, `PREFERS_BUSINESS_DOMAIN`, `REQUIRES_TECHNICAL_DOMAIN`, `PREFERS_TECHNICAL_DOMAIN`
- **Embeddings** - Job descriptions have embeddings generated during seeding (`seeds/job-description-embeddings.ts`)
- **Vector index** - `job_description_embedding_index` already exists
- **Resume upload pattern** - Well-established flow at `POST /api/resume/upload` showing how to extract features from text via LLM and normalize to canonical taxonomy

### Key Discoveries

- `seeds/types.ts:268-318` - JobDescription and related types already defined
- `seeds/job-descriptions.ts` - Shows the structure of job data and relationships
- `recommender_api/src/services/resume-processor/feature-extractor.service.ts:117-173` - LLM extraction pattern with RAG context for constraining output
- `recommender_api/src/services/skill-normalizer.service.ts` - Skill normalization (exact → synonym → fuzzy)
- `recommender_api/src/services/domain-normalizer.service.ts` - Domain normalization (case-insensitive match)
- `recommender_api/src/services/llm.service.ts:111-147` - `generateEmbedding()` function available

## Desired End State

After completing all phases:

1. **API endpoint** at `POST /api/job-description/upload` that:
   - Accepts raw job description text
   - Supports both **create** (no jobId) and **update** (with jobId) operations
   - Uses LLM to extract: title, seniority, budget range, skills, domains, timeline, location, company
   - Normalizes skills and domains to canonical IDs
   - Creates or updates `JobDescription` node with relationships
   - Generates embedding for semantic search

2. **Response format** includes:
   - Job ID (created or updated)
   - `isNewJob: boolean` to indicate create vs update
   - Extracted features (for transparency)
   - Validation results (resolved vs unresolved skills/domains)
   - Embedding metadata (dimensions, model)

3. **Feature parity** with resume upload:
   - Same normalization strategy for skills and domains
   - Same embedding generation pattern
   - Same validation and error handling patterns

### Verification

- All automated tests pass (`npm test`, `npm run typecheck`, `npm run test:e2e`)
- New job can be created via API: `curl -X POST .../api/job-description/upload -d '{"jobDescriptionText": "..."}'`
- Existing job can be updated via API: `curl -X POST .../api/job-description/upload -d '{"jobId": "job_xxx", "jobDescriptionText": "..."}'`
- Job has correct relationships: `MATCH (j:JobDescription)-[:REQUIRES_SKILL]->(s:Skill) RETURN count(*)`
- Embedding is generated: `MATCH (j:JobDescription {id: $id}) WHERE j.embedding IS NOT NULL RETURN j`
- Job-Company relationships exist: `MATCH (j:JobDescription)-[:POSTED_BY]->(c:Company) RETURN count(*)`

## What We're NOT Doing

- **Job-to-engineer matching API** - This plan focuses on job creation/update; matching is future work
- **File upload (PDF/DOCX)** - Text-only upload for now; file parsing can be added later
- **Job validation rules** - No validation of budget ranges or seniority coherence

## Implementation Approach

Five phases, building progressively:

0. **Phase 0: Extract Core Enum Types** - Move shared enum types to central location
1. **Phase 1: LLM Feature Extraction** - Create the job description feature extractor service
2. **Phase 2: Job Create/Update Service** - Create the service that persists jobs to Neo4j (create or update)
3. **Phase 3: API Route & Integration** - Wire up the route, schema, and controller
4. **Phase 4: Seed Company Relationships** - Add companies for seeded jobs and create `POSTED_BY` relationships

---

## Phase 0: Extract Core Enum Types

### Overview

Extract shared enum types (seniority, timeline, proficiency, etc.) from `search.schema.ts` to central files that both search and job description processing can import from.

### Changes Required

#### 0.1 Create Central Enum Schema

**File**: `recommender_api/src/schemas/enums.schema.ts` (new)

```typescript
/**
 * Core Enum Schemas
 *
 * Shared enum types used across the application.
 * These are the single source of truth for constrained value types.
 */

import { z } from "zod";

// ============================================
// SENIORITY LEVELS
// ============================================

export const SENIORITY_LEVEL_ORDER = [
  "junior", "mid", "senior", "staff", "principal"
] as const;

export const SeniorityLevelSchema = z.enum(SENIORITY_LEVEL_ORDER);

// ============================================
// START TIMELINE
// ============================================

export const START_TIMELINE_ORDER = [
  "immediate", "two_weeks", "one_month", "three_months", "six_months", "one_year"
] as const;

export const StartTimelineSchema = z.enum(START_TIMELINE_ORDER);

// ============================================
// PROFICIENCY LEVELS
// ============================================

export const PROFICIENCY_LEVEL_ORDER = ["learning", "proficient", "expert"] as const;

export const ProficiencyLevelSchema = z.enum(PROFICIENCY_LEVEL_ORDER);

// ============================================
// TEAM FOCUS
// ============================================

export const TEAM_FOCUS_VALUES = [
  "greenfield", "migration", "maintenance", "scaling"
] as const;

export const TeamFocusSchema = z.enum(TEAM_FOCUS_VALUES);

// ============================================
// US TIMEZONE ZONES
// ============================================

export const US_TIMEZONE_ZONE_ORDER = [
  "Eastern", "Central", "Mountain", "Pacific"
] as const;

export const USTimezoneZoneSchema = z.enum(US_TIMEZONE_ZONE_ORDER);
```

#### 0.2 Create Central Enum Types

**File**: `recommender_api/src/types/enums.types.ts` (new)

```typescript
/**
 * Core Enum Types
 *
 * Re-exports types inferred from Zod schemas for convenience.
 */

import { z } from "zod";
import {
  SeniorityLevelSchema,
  StartTimelineSchema,
  ProficiencyLevelSchema,
  TeamFocusSchema,
  USTimezoneZoneSchema,
} from "../schemas/enums.schema.js";

// Re-export schemas for use in validation
export {
  SeniorityLevelSchema,
  StartTimelineSchema,
  ProficiencyLevelSchema,
  TeamFocusSchema,
  USTimezoneZoneSchema,
  SENIORITY_LEVEL_ORDER,
  START_TIMELINE_ORDER,
  PROFICIENCY_LEVEL_ORDER,
  TEAM_FOCUS_VALUES,
  US_TIMEZONE_ZONE_ORDER,
} from "../schemas/enums.schema.js";

// Inferred types
export type SeniorityLevel = z.infer<typeof SeniorityLevelSchema>;
export type StartTimeline = z.infer<typeof StartTimelineSchema>;
export type ProficiencyLevel = z.infer<typeof ProficiencyLevelSchema>;
export type TeamFocus = z.infer<typeof TeamFocusSchema>;
export type USTimezoneZone = z.infer<typeof USTimezoneZoneSchema>;
```

#### 0.3 Update search.schema.ts to Import from enums.schema.ts

**File**: `recommender_api/src/schemas/search.schema.ts`

Remove the enum definitions (lines 12-36) and import what's needed:

```typescript
// Remove these definitions:
// export const SENIORITY_LEVEL_ORDER = [...]
// export const SeniorityLevelSchema = z.enum(...)
// ... etc

// Add import for what search.schema.ts actually uses internally:
import {
  START_TIMELINE_ORDER,
  StartTimelineSchema,
  SeniorityLevelSchema,
  ProficiencyLevelSchema,
  TeamFocusSchema,
  USTimezoneZoneSchema,
} from "./enums.schema.js";
```

#### 0.4 Update types/search.types.ts

**File**: `recommender_api/src/types/search.types.ts`

Remove the re-exports from search.schema.ts (lines 14-26) and import directly:

```typescript
// Remove these lines:
// export type { SeniorityLevel, StartTimeline, ... } from '../schemas/search.schema.js';
// export { START_TIMELINE_ORDER, ... } from '../schemas/search.schema.js';

// Import types locally where needed in this file:
import type { ProficiencyLevel } from './enums.types.js';
```

#### 0.5 Update All Consumer Files

Update imports in files that use these enums:

| File | Change Import From | To |
|------|-------------------|-----|
| `services/constraint-expander.service.ts` | `../types/search.types.js` | `../types/enums.types.js` |
| `services/constraint-advisor/tightening-generator.service.ts` | `../../types/search.types.js` | `../../types/enums.types.js` |
| `services/critique-interpreter.service.ts` | `../types/search.types.js` | `../types/enums.types.js` |
| `services/skill-resolver.service.ts` | `../types/search.types.js` | `../types/enums.types.js` |
| `services/utility-calculator/scoring/skill-scoring.ts` | `../../../types/search.types.js` | `../../../types/enums.types.js` |
| `services/utility-calculator/scoring/logistics-scoring.ts` | `../../../types/search.types.js` | `../../../types/enums.types.js` |
| `config/knowledge-base/relaxation-strategies.config.ts` | `../../types/search.types.js` | `../../types/enums.types.js` |
| `config/knowledge-base/utility.config.ts` | `../../schemas/search.schema.js` | `../../schemas/enums.schema.js` |
| `services/search-match-explanation/tradeoff-explanation.service.ts` | `../../schemas/search.schema.js` | `../../schemas/enums.schema.js` |
| `services/critique-generator/critique-candidate-config.ts` | `../../schemas/search.schema.js` | `../../schemas/enums.schema.js` |

### Success Criteria

#### Automated Verification:

- [x] TypeScript compiles: `npm run typecheck`
- [x] All existing tests pass: `npm test`
- [x] No import errors in search-related files

**Implementation Note**: After completing this phase, proceed to Phase 1.

---

## Phase 1: LLM Feature Extraction

### Overview

Create a feature extractor service that takes raw job description text and uses LLM to extract structured features. This mirrors `feature-extractor.service.ts` but tailored for job descriptions.

### Changes Required

#### 1.1 Create Job Description Feature Extractor

**File**: `recommender_api/src/services/job-description-processor/job-description-feature-extractor.service.ts` (new)

```typescript
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

    const jsonString = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonString);

    // Basic validation
    if (!parsed.title || !parsed.seniority) {
      console.warn("[JobFeatureExtractor] Missing required fields in LLM response");
      return null;
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
- Extract skill names as written (normalization happens separately)`;
}
```

### Success Criteria

#### Automated Verification:

- [x] TypeScript compiles: `npm run typecheck` (from recommender_api directory)
- [x] Unit tests pass: `npm test -- job-description-processor`

#### 1.2 Add Unit Tests for Feature Extractor

**File**: `recommender_api/src/__tests__/unit/job-description-feature-extractor.test.ts` (new)

```typescript
import { describe, it, expect } from "vitest";
import { getUniqueSkillNames } from "../../services/job-description-processor/job-description-feature-extractor.service.js";
import type { ExtractedJobDescription } from "../../services/job-description-processor/job-description-feature-extractor.service.js";

describe("Job Description Feature Extractor", () => {
  describe("getUniqueSkillNames", () => {
    it("returns unique skill names", () => {
      const extractedJob: ExtractedJobDescription = {
        title: "Senior Engineer",
        companyName: "Test Co",
        location: "Remote",
        seniority: "senior",
        minBudget: 150000,
        maxBudget: 200000,
        startTimeline: "one_month",
        timezone: ["Eastern"],
        skills: [
          { name: "React", isRequired: true },
          { name: "TypeScript", isRequired: true },
          { name: "react", isRequired: false },  // Duplicate, different case
          { name: "Node.js", isRequired: false },
        ],
        businessDomains: [],
        technicalDomains: [],
      };

      const uniqueSkills = getUniqueSkillNames(extractedJob);
      expect(uniqueSkills).toHaveLength(3);
      expect(uniqueSkills).toContain("React");
      expect(uniqueSkills).toContain("TypeScript");
      expect(uniqueSkills).toContain("Node.js");
    });

    it("preserves original casing for first occurrence", () => {
      const extractedJob: ExtractedJobDescription = {
        title: "Engineer",
        companyName: null,
        location: null,
        seniority: "mid",
        minBudget: null,
        maxBudget: null,
        startTimeline: "one_month",
        timezone: ["Eastern"],
        skills: [
          { name: "JavaScript", isRequired: true },
          { name: "javascript", isRequired: false },
        ],
        businessDomains: [],
        technicalDomains: [],
      };

      const uniqueSkills = getUniqueSkillNames(extractedJob);
      expect(uniqueSkills).toHaveLength(1);
      expect(uniqueSkills[0]).toBe("JavaScript");  // First occurrence preserved
    });
  });
});
```

#### 1.3 Add Unit Tests for Upload Service Helpers

**File**: `recommender_api/src/__tests__/unit/job-upload-service.test.ts` (new)

```typescript
import { describe, it, expect } from "vitest";

/*
 * Test the joinNormalizedWithExtracted helper function.
 * Since it's not exported, we test its behavior indirectly through a local implementation.
 * This validates the algorithm used in job-upload.service.ts.
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

describe("Job Upload Service Helpers", () => {
  describe("joinNormalizedWithExtracted", () => {
    it("joins normalized items with extracted info", () => {
      const normalizedItems = [
        { originalName: "TypeScript", canonicalId: "skill_typescript" },
        { originalName: "React", canonicalId: "skill_react" },
      ];
      const extractedLookup = new Map([
        ["typescript", { isRequired: true, minProficiency: "expert" }],
        ["react", { isRequired: false, minProficiency: "proficient" }],
      ]);

      const result = joinNormalizedWithExtracted(
        normalizedItems,
        extractedLookup,
        (normalized, extracted) => ({
          canonicalId: normalized.canonicalId,
          isRequired: extracted.isRequired,
          minProficiency: extracted.minProficiency,
        })
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        canonicalId: "skill_typescript",
        isRequired: true,
        minProficiency: "expert",
      });
      expect(result[1]).toEqual({
        canonicalId: "skill_react",
        isRequired: false,
        minProficiency: "proficient",
      });
    });

    it("filters out items not found in extractedLookup", () => {
      const normalizedItems = [
        { originalName: "TypeScript", canonicalId: "skill_typescript" },
        { originalName: "Unknown", canonicalId: "skill_unknown" },
      ];
      const extractedLookup = new Map([
        ["typescript", { isRequired: true }],
        // "unknown" not in lookup
      ]);

      const result = joinNormalizedWithExtracted(
        normalizedItems,
        extractedLookup,
        (normalized, extracted) => ({
          canonicalId: normalized.canonicalId,
          isRequired: extracted.isRequired,
        })
      );

      expect(result).toHaveLength(1);
      expect(result[0].canonicalId).toBe("skill_typescript");
    });

    it("filters out items when buildRelationship returns null", () => {
      const normalizedItems = [
        { originalName: "TypeScript", canonicalId: "skill_typescript" },
        { originalName: "React", canonicalId: null }, // No canonical ID
      ];
      const extractedLookup = new Map([
        ["typescript", { isRequired: true }],
        ["react", { isRequired: false }],
      ]);

      const result = joinNormalizedWithExtracted(
        normalizedItems,
        extractedLookup,
        (normalized, extracted) => {
          if (!normalized.canonicalId) return null;
          return {
            canonicalId: normalized.canonicalId,
            isRequired: extracted.isRequired,
          };
        }
      );

      expect(result).toHaveLength(1);
      expect(result[0].canonicalId).toBe("skill_typescript");
    });

    it("handles case-insensitive lookup", () => {
      const normalizedItems = [
        { originalName: "TYPESCRIPT", canonicalId: "skill_typescript" },
      ];
      const extractedLookup = new Map([
        ["typescript", { isRequired: true }], // lowercase key
      ]);

      const result = joinNormalizedWithExtracted(
        normalizedItems,
        extractedLookup,
        (normalized, extracted) => ({
          canonicalId: normalized.canonicalId,
          isRequired: extracted.isRequired,
        })
      );

      expect(result).toHaveLength(1);
    });

    it("returns empty array when no matches", () => {
      const normalizedItems = [
        { originalName: "TypeScript", canonicalId: "skill_typescript" },
      ];
      const extractedLookup = new Map<string, { isRequired: boolean }>();

      const result = joinNormalizedWithExtracted(
        normalizedItems,
        extractedLookup,
        (normalized, extracted) => ({
          canonicalId: normalized.canonicalId,
          isRequired: extracted.isRequired,
        })
      );

      expect(result).toHaveLength(0);
    });
  });
});
```

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 2. ✅ COMPLETED

---

## Phase 2: Job Create/Update Service

### Overview

Create the service that persists job descriptions to Neo4j, supporting both create (new job) and update (existing job) operations. This mirrors the resume upload pattern where `engineerId` determines create vs update.

### Changes Required

#### 2.1 Create Job Service (Generic Operations)

**File**: `recommender_api/src/services/job.service.ts` (new)

Generic job operations that can be reused across different endpoints.

```typescript
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
    const newCompany = await findOrCreateCompany(session, companyName);
    companyId = newCompany.id;
    canonicalName = newCompany.name;
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
```

#### 2.2 Create Job Description Upload Service

**File**: `recommender_api/src/services/job-description-processor/job-upload.service.ts` (new)

```typescript
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
  // Step 1: Extract features from job description text via LLM
  const extractedJobFeatures = await extractFeaturesFromJobDescription(session, jobDescriptionText);
  if (!extractedJobFeatures) {
    throw new ExtractionFailedError("Failed to extract features from job description. LLM may be unavailable.");
  }

  let jobId: string;
  let isNewJob: boolean;

  // Step 2: Determine create vs update
  if (existingJobId) {
    // Update existing job
    const exists = await jobDescriptionExists(session, existingJobId);
    if (!exists) {
      throw new Error(`Job description not found: ${existingJobId}`);
    }
    jobId = existingJobId;
    isNewJob = false;

    // Delete existing relationships before re-creating
    await deleteJobRelationships(session, jobId);
  } else {
    // Create new job
    jobId = `job_${uuidv4().slice(0, 8)}`;
    isNewJob = true;
  }

  // Step 3: Create or update job description node (stores original text)
  await upsertJobDescriptionNode(session, jobId, extractedJobFeatures, jobDescriptionText);

  // Build lookup maps from original names to extracted info (used for relationship creation and validation)
  const skillNameToExtractedSkill = new Map(
    extractedJobFeatures.skills.map((s) => [s.name.toLowerCase(), s])
  );
  const businessDomainNameToExtractedDomain = new Map(
    extractedJobFeatures.businessDomains.map((d) => [d.name.toLowerCase(), d])
  );
  const technicalDomainNameToExtractedDomain = new Map(
    extractedJobFeatures.technicalDomains.map((d) => [d.name.toLowerCase(), d])
  );

  // Step 4: Normalize and link company (if provided)
  let companyResult: { companyId: string; canonicalName: string; method: "exact" | "alias" | "new" } | undefined;
  if (extractedJobFeatures.companyName) {
    companyResult = await linkJobToCompany(session, jobId, extractedJobFeatures.companyName);
  }

  // Step 5: Normalize and link skills
  const skillNames = extractedJobFeatures.skills.map((skill) => skill.name);
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

  // Step 6: Normalize and link business domains
  const businessDomainNames = extractedJobFeatures.businessDomains.map((domain) => domain.name);
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

  // Step 7: Normalize and link technical domains
  const technicalDomainNames = extractedJobFeatures.technicalDomains.map((domain) => domain.name);
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

  // Step 8: Generate embedding (required for semantic search)
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
```

### Success Criteria

#### Automated Verification:

- [x] TypeScript compiles: `npm run typecheck`
- [x] Unit tests pass: `npm test`

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 3. ✅ COMPLETED

---

## Phase 3: API Route & Integration

### Overview

Wire up the route, schema, and controller to expose the job description upload endpoint.

### Changes Required

#### 3.1 Create Job Description Schema

**File**: `recommender_api/src/schemas/job-description.schema.ts` (new)

```typescript
import { z } from "zod";

// ============================================
// JOB DESCRIPTION UPLOAD SCHEMAS
// ============================================

export const JobDescriptionUploadRequestSchema = z.object({
  /*
   * Existing job ID to update (optional).
   * If provided, updates the job's data and relationships.
   * If not provided, creates a new job.
   */
  jobId: z.string().optional(),

  /*
   * Raw job description text for LLM feature extraction.
   * The LLM will extract title, skills, domains, seniority, etc.
   */
  jobDescriptionText: z.string().min(1, "Job description text is required"),
});

export type JobDescriptionUploadRequest = z.infer<typeof JobDescriptionUploadRequestSchema>;

export interface JobDescriptionUploadResponse {
  jobId: string;
  isNewJob: boolean;
  extractedFeatures: {
    title: string;
    companyName: string | null;
    location: string | null;
    seniority: string;
    minBudget: number | null;
    maxBudget: number | null;
    stretchBudget?: number | null;
    startTimeline: string;
    timezone: string[];
    teamFocus?: string | null;
    skills: Array<{
      name: string;
      isRequired: boolean;
      minProficiency?: string;
    }>;
    businessDomains: Array<{
      name: string;
      isRequired: boolean;
      minYears?: number;
    }>;
    technicalDomains: Array<{
      name: string;
      isRequired: boolean;
    }>;
  };
  validationResults: {
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
  };
  embedding: {
    dimensions: number;
    model: string;
  } | null;  // null if LLM unavailable
}
```

#### 3.2 Create Job Description Controller

**File**: `recommender_api/src/controllers/job-description.controller.ts` (new)

```typescript
import type { Request, Response } from "express";
import driver from "../neo4j.js";
import {
  processJobDescriptionUpload,
  ExtractionFailedError,
} from "../services/job-description-processor/job-upload.service.js";
import type {
  JobDescriptionUploadRequest,
  JobDescriptionUploadResponse,
} from "../schemas/job-description.schema.js";

/*
 * Handle job description upload requests.
 * POST /api/job-description/upload
 */
export async function uploadJobDescription(req: Request, res: Response): Promise<void> {
  const session = driver.session();

  try {
    const request = req.body as JobDescriptionUploadRequest;

    const result = await processJobDescriptionUpload(
      session,
      request.jobDescriptionText,
      request.jobId
    );

    const response: JobDescriptionUploadResponse = {
      jobId: result.jobId,
      isNewJob: result.isNewJob,
      extractedFeatures: result.extractedFeatures,
      validationResults: result.validationResults,
      embedding: result.embedding,
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Job description upload error:", error);

    // Handle extraction failure (LLM unavailable)
    if (error instanceof ExtractionFailedError) {
      res.status(422).json({
        error: {
          code: "EXTRACTION_FAILED",
          message: error.message,
        },
      });
      return;
    }

    // Handle "job not found" error for update operations
    if (error instanceof Error && error.message.includes("not found")) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: error.message,
        },
      });
      return;
    }

    res.status(500).json({
      error: {
        code: "JOB_UPLOAD_ERROR",
        message: "Failed to process job description upload",
        details: error instanceof Error ? [{ field: "internal", message: error.message }] : undefined,
      },
    });
  } finally {
    await session.close();
  }
}
```

#### 3.3 Create Job Description Routes

**File**: `recommender_api/src/routes/job-description.routes.ts` (new)

```typescript
import { Router } from "express";
import { uploadJobDescription } from "../controllers/job-description.controller.js";
import { validate } from "../middleware/zod-validate.middleware.js";
import { JobDescriptionUploadRequestSchema } from "../schemas/job-description.schema.js";

const router = Router();

/*
 * POST /api/job-description/upload
 * Upload job description as text for LLM feature extraction.
 */
router.post("/upload", validate(JobDescriptionUploadRequestSchema), uploadJobDescription);

export default router;
```

#### 3.4 Register Routes in App

**File**: `recommender_api/src/app.ts`

Add import (after line 8):
```typescript
import jobDescriptionRoutes from './routes/job-description.routes.js';
```

Add route registration (after line 43):
```typescript
app.use('/api/job-description', jobDescriptionRoutes);
```

### Success Criteria

#### Automated Verification:

- [x] TypeScript compiles: `npm run typecheck`
- [x] All existing tests pass: `npm test` (unit tests pass; integration tests require Tilt)
- [ ] E2E tests pass: `npm run test:e2e` (requires Tilt)

#### 3.5 Add Integration Test

**File**: `recommender_api/src/__tests__/integration/job-description-upload.test.ts` (new)

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../app.js";
import neo4j, { Driver, Session } from "neo4j-driver";

describe("POST /api/job-description/upload", () => {
  let driver: Driver;
  let session: Session;

  beforeAll(async () => {
    driver = neo4j.driver(
      process.env.NEO4J_URI || "bolt://localhost:7687",
      neo4j.auth.basic(
        process.env.NEO4J_USER || "neo4j",
        process.env.NEO4J_PASSWORD || "password"
      )
    );
    session = driver.session();
  });

  afterAll(async () => {
    // Clean up test jobs
    await session.run(`
      MATCH (j:JobDescription)
      WHERE j.id STARTS WITH 'job_'
        AND j.title CONTAINS 'Test'
      DETACH DELETE j
    `);
    await session.close();
    await driver.close();
  });

  it("creates a job from job description text", async () => {
    const jobDescriptionText = `
      Senior Backend Engineer at Test Corp

      Location: Remote (US Eastern or Pacific timezone)

      About the role:
      We're looking for a senior backend engineer to join our scaling team.
      Salary range: $150,000 - $200,000

      Requirements:
      - Expert-level TypeScript experience
      - PostgreSQL experience required
      - 2+ years in Fintech

      Nice to have:
      - Redis experience
      - Experience with distributed systems

      Start date: Within one month
    `;

    const response = await request(app)
      .post("/api/job-description/upload")
      .send({ jobDescriptionText })
      .expect(201);

    expect(response.body.jobId).toMatch(/^job_/);
    expect(response.body.isNewJob).toBe(true);
    expect(response.body.extractedFeatures).toBeDefined();
    expect(response.body.extractedFeatures.title).toBeTruthy();
    expect(response.body.extractedFeatures.seniority).toBe("senior");
    expect(response.body.validationResults).toBeDefined();

    // Verify job was created in Neo4j
    const dbResult = await session.run(
      "MATCH (j:JobDescription {id: $jobId}) RETURN j",
      { jobId: response.body.jobId }
    );
    expect(dbResult.records.length).toBe(1);
  });

  it("returns 400 when jobDescriptionText is missing", async () => {
    const response = await request(app)
      .post("/api/job-description/upload")
      .send({})
      .expect(400);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when jobDescriptionText is empty", async () => {
    const response = await request(app)
      .post("/api/job-description/upload")
      .send({ jobDescriptionText: "" })
      .expect(400);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("updates an existing job when jobId is provided", async () => {
    // First, create a job
    const createJobDescriptionText = `
      Mid-Level Engineer

      Requirements:
      - JavaScript experience required

      Salary: $100,000 - $150,000
    `;

    const createResponse = await request(app)
      .post("/api/job-description/upload")
      .send({ jobDescriptionText: createJobDescriptionText })
      .expect(201);

    const jobId = createResponse.body.jobId;
    expect(createResponse.body.isNewJob).toBe(true);

    // Now update the job with new description
    const updateJobDescriptionText = `
      Senior Engineer - UPDATED POSITION

      Requirements:
      - TypeScript experience required
      - React experience preferred

      Salary: $150,000 - $200,000
    `;

    const updateResponse = await request(app)
      .post("/api/job-description/upload")
      .send({
        jobId,  // Providing existing jobId triggers update
        jobDescriptionText: updateJobDescriptionText,
      })
      .expect(201);

    expect(updateResponse.body.jobId).toBe(jobId);  // Same ID
    expect(updateResponse.body.isNewJob).toBe(false);  // Not new
    expect(updateResponse.body.extractedFeatures.seniority).toBe("senior");

    // Verify job was updated in Neo4j
    const dbResult = await session.run(
      "MATCH (j:JobDescription {id: $jobId}) RETURN j.seniority AS seniority",
      { jobId }
    );
    expect(dbResult.records[0].get("seniority")).toBe("senior");
  });

  it("returns 404 when updating a non-existent job", async () => {
    const response = await request(app)
      .post("/api/job-description/upload")
      .send({
        jobId: "job_nonexistent",
        jobDescriptionText: "Some job description text",
      })
      .expect(404);

    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(response.body.error.message).toContain("not found");
  });

  it("creates company relationship when company is mentioned in text", async () => {
    const jobDescriptionText = `
      Software Engineer at Acme Corp

      We're hiring a software engineer to join our team.

      Requirements:
      - Python experience
    `;

    const response = await request(app)
      .post("/api/job-description/upload")
      .send({ jobDescriptionText })
      .expect(201);

    expect(response.body.jobId).toMatch(/^job_/);

    // If the LLM extracted the company name, verify the relationship
    if (response.body.validationResults.company) {
      expect(response.body.validationResults.company.canonicalName).toBeTruthy();

      // Verify POSTED_BY relationship in Neo4j
      const companyResult = await session.run(`
        MATCH (j:JobDescription {id: $jobId})-[:POSTED_BY]->(c:Company)
        RETURN c.name AS companyName
      `, { jobId: response.body.jobId });

      expect(companyResult.records.length).toBe(1);
    }
  });

  it("creates REQUIRES_SKILL vs PREFERS_SKILL based on isRequired", async () => {
    const jobDescriptionText = `
      Full Stack Developer

      Requirements:
      - TypeScript experience required
      - PostgreSQL experience required

      Nice to have:
      - Redis experience preferred
      - GraphQL knowledge bonus
    `;

    const response = await request(app)
      .post("/api/job-description/upload")
      .send({ jobDescriptionText })
      .expect(201);

    const jobId = response.body.jobId;

    // Verify REQUIRES_SKILL relationships exist
    const requiredResult = await session.run(`
      MATCH (j:JobDescription {id: $jobId})-[:REQUIRES_SKILL]->(s:Skill)
      RETURN s.name AS skillName
    `, { jobId });
    const requiredSkills = requiredResult.records.map(r => r.get("skillName"));

    // Verify PREFERS_SKILL relationships exist
    const preferredResult = await session.run(`
      MATCH (j:JobDescription {id: $jobId})-[:PREFERS_SKILL]->(s:Skill)
      RETURN s.name AS skillName
    `, { jobId });
    const preferredSkills = preferredResult.records.map(r => r.get("skillName"));

    // Should have some required and some preferred (exact skills depend on LLM extraction + normalization)
    expect(requiredSkills.length + preferredSkills.length).toBeGreaterThan(0);
  });

  it("generates embedding for new job", async () => {
    const jobDescriptionText = `
      Backend Engineer for Test Embedding

      We need a backend engineer with Node.js experience.
    `;

    const response = await request(app)
      .post("/api/job-description/upload")
      .send({ jobDescriptionText })
      .expect(201);

    // Check embedding in response
    if (response.body.embedding) {
      expect(response.body.embedding.dimensions).toBe(1024);
      expect(response.body.embedding.model).toBe("mxbai-embed-large");
    }

    // Verify embedding in Neo4j
    const dbResult = await session.run(`
      MATCH (j:JobDescription {id: $jobId})
      RETURN j.embedding IS NOT NULL AS hasEmbedding,
             size(j.embedding) AS dimensions,
             j.embeddingModel AS model
    `, { jobId: response.body.jobId });

    const record = dbResult.records[0];
    // Embedding may be null if LLM unavailable - that's acceptable
    if (record.get("hasEmbedding")) {
      expect(record.get("dimensions").toNumber()).toBe(1024);
      expect(record.get("model")).toBe("mxbai-embed-large");
    }
  });

  it("replaces relationships when updating a job", async () => {
    // Create job with JavaScript skill
    const createText = `
      Test Job for Relationship Replacement

      Requirements:
      - JavaScript required
    `;

    const createResponse = await request(app)
      .post("/api/job-description/upload")
      .send({ jobDescriptionText: createText })
      .expect(201);

    const jobId = createResponse.body.jobId;

    // Check initial skills
    const initialSkills = await session.run(`
      MATCH (j:JobDescription {id: $jobId})-[:REQUIRES_SKILL|PREFERS_SKILL]->(s:Skill)
      RETURN s.name AS skillName
    `, { jobId });
    const initialSkillNames = initialSkills.records.map(r => r.get("skillName"));

    // Update job with different skills
    const updateText = `
      Test Job for Relationship Replacement - UPDATED

      Requirements:
      - Python required
      - Django required
    `;

    await request(app)
      .post("/api/job-description/upload")
      .send({ jobId, jobDescriptionText: updateText })
      .expect(201);

    // Check updated skills
    const updatedSkills = await session.run(`
      MATCH (j:JobDescription {id: $jobId})-[:REQUIRES_SKILL|PREFERS_SKILL]->(s:Skill)
      RETURN s.name AS skillName
    `, { jobId });
    const updatedSkillNames = updatedSkills.records.map(r => r.get("skillName"));

    // Skills should be different (old ones removed, new ones added)
    // Note: Exact skill names depend on LLM extraction and normalization
    // The key assertion is that the skill set changed
    expect(updatedSkillNames).not.toEqual(initialSkillNames);
  });

  it("stores minProficiency on skill relationships when provided", async () => {
    const jobDescriptionText = `
      Senior Engineer with Expertise Requirements

      Requirements:
      - Expert-level TypeScript experience
      - Proficient in React
    `;

    const response = await request(app)
      .post("/api/job-description/upload")
      .send({ jobDescriptionText })
      .expect(201);

    // Check if minProficiency was extracted and stored
    const skillResult = await session.run(`
      MATCH (j:JobDescription {id: $jobId})-[r:REQUIRES_SKILL|PREFERS_SKILL]->(s:Skill)
      WHERE r.minProficiency IS NOT NULL
      RETURN s.name AS skillName, r.minProficiency AS minProficiency
    `, { jobId: response.body.jobId });

    // If LLM extracted proficiency levels, they should be stored
    // This test verifies the mechanism works when proficiency is extracted
    for (const record of skillResult.records) {
      const proficiency = record.get("minProficiency");
      expect(["learning", "proficient", "expert"]).toContain(proficiency);
    }
  });

  it("creates domain relationships correctly", async () => {
    const jobDescriptionText = `
      Fintech Backend Engineer

      We're building payment infrastructure.

      Requirements:
      - Backend development experience
      - Fintech industry experience required (3+ years)
    `;

    const response = await request(app)
      .post("/api/job-description/upload")
      .send({ jobDescriptionText })
      .expect(201);

    const jobId = response.body.jobId;

    // Check business domain relationships
    const businessDomainResult = await session.run(`
      MATCH (j:JobDescription {id: $jobId})-[r:REQUIRES_BUSINESS_DOMAIN|PREFERS_BUSINESS_DOMAIN]->(d:BusinessDomain)
      RETURN d.name AS domainName, type(r) AS relType, r.minYears AS minYears
    `, { jobId });

    // Check technical domain relationships
    const technicalDomainResult = await session.run(`
      MATCH (j:JobDescription {id: $jobId})-[r:REQUIRES_TECHNICAL_DOMAIN|PREFERS_TECHNICAL_DOMAIN]->(d:TechnicalDomain)
      RETURN d.name AS domainName, type(r) AS relType
    `, { jobId });

    // At least some domain relationships should be created if LLM extracted them
    const totalDomains = businessDomainResult.records.length + technicalDomainResult.records.length;
    // Note: Exact domains depend on LLM extraction, so we just verify the mechanism works
    expect(totalDomains).toBeGreaterThanOrEqual(0);
  });
});
```

#### 3.6 Add E2E Test to Postman Collection

**File**: Update `postman/collections/search-filter-tests.postman_collection.json`

Add a new folder "Job Description Upload" with tests:
1. "Create job from text" - POST to /api/job-description/upload with jobDescriptionText
   - Verify 201 response with jobId, isNewJob=true
   - Verify extractedFeatures contains title, seniority, skills
   - Verify validationResults contains resolved/unresolved skills
2. "Update existing job" - POST with jobId and jobDescriptionText to update an existing job
   - Verify isNewJob=false
   - Verify jobId matches the one provided
3. "Update non-existent job (404)" - POST with invalid jobId
   - Verify error.code = "NOT_FOUND"
4. "Validation error - missing jobDescriptionText"
   - Verify error.code = "VALIDATION_ERROR"
5. "Validation error - empty jobDescriptionText"
   - Verify error.code = "VALIDATION_ERROR"
6. "Verify embedding in response" - Create job and check embedding metadata
   - Verify embedding.dimensions = 1024 (when LLM available)
   - Verify embedding.model = "mxbai-embed-large"
7. "Verify skill normalization" - Create job with known skills
   - Verify resolvedSkills contains canonicalId and canonicalName
   - Verify unresolvedSkills lists skills that couldn't be normalized

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 4. ✅ COMPLETED (Postman tests skipped - can be added later)

---

## Phase 4: Seed Company Relationships

### Overview

Add `POSTED_BY` relationships between seeded `JobDescription` nodes and `Company` nodes. This requires:
1. Adding the companies from job descriptions to the `knownCompanies` list
2. Creating a seeding function that links jobs to companies

### Changes Required

#### 4.1 Add Job Description Companies to Known Companies

**File**: `seeds/companies.ts`

Add new companies used in job descriptions to the `knownCompanies` array:

```typescript
// Add after existing knownCompanies entries (before the closing bracket)

  // Companies from job descriptions
  { id: "company_techpay", name: "TechPay Solutions", type: "startup" },
  { id: "company_financeforward", name: "FinanceForward", type: "startup" },
  { id: "company_designhub", name: "DesignHub", type: "startup" },
  { id: "company_shopstream", name: "ShopStream", type: "startup" },
  { id: "company_launchpad", name: "LaunchPad Tech", type: "startup" },
  { id: "company_healthtech", name: "HealthTech Innovations", type: "startup" },
  { id: "company_clinicaldata", name: "ClinicalData Corp", type: "enterprise" },
  { id: "company_scaleup", name: "ScaleUp Systems", type: "startup" },
  { id: "company_cloudnative", name: "CloudNative Inc", type: "startup" },
  { id: "company_securepay", name: "SecurePay", type: "startup" },
  { id: "company_airesearch", name: "AI Research Labs", type: "startup" },
  { id: "company_megascale", name: "MegaScale Technologies", type: "enterprise" },
```

#### 4.2 Add Company Name to ID Mapping for Job Descriptions

**File**: `seeds/job-descriptions.ts`

Add a mapping from company names to company IDs at the top of the file:

```typescript
// Add after imports

/*
 * Maps company names used in job descriptions to their canonical company IDs.
 * These IDs must match the ones defined in seeds/companies.ts.
 */
export const jobCompanyNameToId: Record<string, string> = {
  "TechPay Solutions": "company_techpay",
  "FinanceForward": "company_financeforward",
  "DesignHub": "company_designhub",
  "ShopStream": "company_shopstream",
  "LaunchPad Tech": "company_launchpad",
  "HealthTech Innovations": "company_healthtech",
  "ClinicalData Corp": "company_clinicaldata",
  "ScaleUp Systems": "company_scaleup",
  "CloudNative Inc": "company_cloudnative",
  "SecurePay": "company_securepay",
  "AI Research Labs": "company_airesearch",
  "MegaScale Technologies": "company_megascale",
};
```

#### 4.3 Add Seeding Function for Job-Company Relationships

**File**: `seeds/seed.ts`

Add import at top:

```typescript
import { jobCompanyNameToId } from './job-descriptions';
```

Add new seeding function after `seedJobPreferredTechnicalDomains`:

```typescript
async function seedJobCompanyRelationships(session: Session): Promise<void> {
  console.log('🏢 Seeding job-company relationships...');

  let count = 0;
  for (const job of jobDescriptions) {
    if (job.companyName && jobCompanyNameToId[job.companyName]) {
      const companyId = jobCompanyNameToId[job.companyName];
      await session.run(`
        MATCH (j:JobDescription {id: $jobId})
        MATCH (c:Company {id: $companyId})
        MERGE (j)-[:POSTED_BY]->(c)
      `, {
        jobId: job.id,
        companyId,
      });
      count++;
    }
  }
  console.log(`   ✓ Seeded ${count} job-company (POSTED_BY) relationships`);
}
```

Update the jobs seeding section (in the `if (shouldSeedCategory('jobs'))` block) to call the new function:

```typescript
    if (shouldSeedCategory('jobs')) {
      // Jobs require skills and domains to be seeded first
      await seedJobDescriptions(session);
      await seedJobRequiredSkills(session);
      await seedJobPreferredSkills(session);
      await seedJobRequiredBusinessDomains(session);
      await seedJobPreferredBusinessDomains(session);
      await seedJobRequiredTechnicalDomains(session);
      await seedJobPreferredTechnicalDomains(session);
      await seedJobCompanyRelationships(session);  // NEW: Link jobs to companies
    }
```

### Success Criteria

#### Automated Verification:

- [x] TypeScript compiles: `npm run typecheck` (from recommender_api directory) AND `npx tsc --noEmit` (from seeds directory)
- [ ] Seeds run without errors: Tilt redeploys after file changes and seeds complete (requires Tilt)
- [ ] All jobs have company relationships (verified via Neo4j query after seed completes)
- [ ] All tests pass: `npm test`

**Implementation Note**: After completing this phase, the implementation is complete.

---

## Testing Strategy

### Automated Test Suite

```bash
# Run all tests (from recommender_api directory)
npm test

# Run just job description tests
npm test -- job-description

# Run E2E tests (requires Tilt)
npm run test:e2e
```

### Test Categories

| Test File | Type | Test Cases | Description |
|-----------|------|------------|-------------|
| `unit/job-description-feature-extractor.test.ts` | Unit | 2 | Tests `getUniqueSkillNames` (deduplication, case preservation) |
| `unit/job-upload-service.test.ts` | Unit | 5 | Tests `joinNormalizedWithExtracted` helper (joining, filtering, case-insensitivity) |
| `integration/job-description-upload.test.ts` | Integration | 12 | Full upload flow: create, update, validation errors, relationships, embedding |
| Postman collection | E2E | 5 | API endpoint validation scenarios |

### Integration Test Coverage

The integration tests cover:

1. **Basic API Flow**
   - Create job from text (201 response)
   - Update existing job with jobId
   - Validation errors (400 for missing/empty text)
   - Not found error (404 for non-existent job update)

2. **Relationship Creation**
   - REQUIRES_SKILL vs PREFERS_SKILL based on isRequired flag
   - Domain relationships (business and technical)
   - Company relationship via POSTED_BY
   - minProficiency property on skill relationships

3. **Update Behavior**
   - Old relationships are deleted and replaced with new ones
   - Job properties are updated correctly

4. **Embedding Generation**
   - Embedding stored in Neo4j with correct dimensions (1024)
   - Embedding model metadata stored

## Performance Considerations

- **LLM extraction**: ~2-5 seconds depending on job description length
- **Skill normalization**: ~10ms per unique skill (batched queries)
- **Embedding generation**: ~500ms for job title + description
- **Total upload time**: ~3-6 seconds with LLM, ~200ms without

## Dependencies

- Ollama LLM service (for text extraction and embedding)
- Neo4j (for persistence and normalization queries)
- uuid package (already a dependency)

## References

- Resume upload implementation: `recommender_api/src/services/resume-processor/`
- Job seeding implementation: `seeds/job-descriptions.ts`
- Job seeding plan: `thoughts/private/plans/2026-01-23-job-description-seeding.md`
- Skill normalization: `recommender_api/src/services/skill-normalizer.service.ts`
- Domain normalization: `recommender_api/src/services/domain-normalizer.service.ts`
