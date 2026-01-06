# Refactor search.service.ts for Single Responsibility Principle

## Overview

Split `search.service.ts` (614 lines) into focused modules following the Single Responsibility Principle. The current file mixes orchestration, skill resolution coordination, skill categorization, and Neo4j record parsing. This refactoring separates these concerns into distinct files while maintaining the same public API.

## Current State Analysis

**search.service.ts** contains multiple responsibilities:

| Function | Lines | Responsibility |
|----------|-------|----------------|
| `executeSearch` | 111-299 | Main orchestration |
| `resolveAllSkills` | 409-488 | Skill resolution coordination |
| `groupSkillsByProficiency` | 305-331 | Group skills by proficiency level |
| `categorizeSkillsByConstraints` | 366-404 | Categorize matched/unmatched skills |
| `parseEngineerFromRecord` | 494-597 | Parse Neo4j records to domain objects |
| `parseDomainMatches` | 603-613 | Generic domain match parsing |
| `toNumber` | 336-348 | Neo4j integer conversion utility |
| 6 interfaces | 44-106 | Internal type definitions |

**Single consumer**: Only `search.controller.ts:21` imports `executeSearch`.

### Key Discoveries:
- `executeSearch` is the only exported function (search.service.ts:111)
- All other functions are internal helpers
- Type definitions are internal implementation details
- The codebase pattern is to keep internal types in their service files
- Existing services (skill-resolver, domain-resolver) follow single-responsibility

## Desired End State

Three focused files replacing one monolithic file:

```
services/
├── search.service.ts              (~120 lines) - Orchestration only
├── skill-resolution.service.ts    (~100 lines) - Skill resolution coordination
└── engineer-record-parser.ts      (~240 lines) - Neo4j record parsing + skill categorization
```

**Design note**: `categorizeSkillsByConstraints` lives in `engineer-record-parser.ts` rather than a separate file because:
1. It operates on `RawSkillData` which is a parsing-specific type
2. It's only called during record parsing
3. Keeping them together avoids a circular dependency between files

### Verification:
- `npm run typecheck` passes
- `npx newman run postman/collections/search-filter-tests.postman_collection.json --globals postman/globals/workspace.postman_globals.json` passes
- API responses identical before/after refactor

## What We're NOT Doing

- NOT changing any public API signatures
- NOT modifying the Cypher query builder
- NOT changing utility-calculator.service.ts
- NOT adding new functionality
- NOT moving types to a shared types file (keeping in-file pattern)

## Implementation Approach

Extract functions bottom-up to avoid circular dependencies:
1. First extract leaf utilities (no dependencies on other extracted code)
2. Then extract functions that depend on extracted utilities
3. Finally update search.service.ts to import from new files

---

## Phase 1: Create engineer-record-parser.ts

### Overview
Extract all Neo4j record parsing logic including skill categorization. This is a leaf module with no dependencies on other code being extracted.

### Changes Required:

#### 1. Create new file
**File**: `recommender_api/src/services/engineer-record-parser.ts`

```typescript
/**
 * Engineer Record Parser
 * Parses raw Neo4j query results into typed domain objects.
 */

import type {
  MatchedSkill,
  UnmatchedRelatedSkill,
  ConstraintViolation,
  BusinessDomainMatch,
  TechnicalDomainMatch,
  TechnicalDomainMatchType,
} from "../types/search.types.js";
import type { ResolvedBusinessDomain, ResolvedTechnicalDomain } from "./cypher-query-builder/index.js";

// ============================================================================
// Internal Types - Raw data structures from Cypher query results
// ============================================================================

/** Raw skill data from Cypher query (before splitting into matched/unmatched) */
export interface RawSkillData {
  skillId: string;
  skillName: string;
  proficiencyLevel: string;
  confidenceScore: number;
  yearsUsed: number;
  matchType: "direct" | "descendant" | "none";
  /** This field only exists when skill filtering is active */
  meetsProficiency?: boolean;
}

/** Raw business domain data from Cypher query */
interface RawBusinessDomainMatch {
  domainId: string;
  domainName: string;
  years: number;
}

/** Raw technical domain data from Cypher query */
interface RawTechnicalDomainMatch {
  domainId: string;
  domainName: string;
  years: number;
  source: "explicit" | "inferred";
}

/** Parsed engineer record before utility scoring */
export interface RawEngineerRecord {
  id: string;
  name: string;
  headline: string;
  salary: number;
  yearsExperience: number;
  startTimeline: string;
  timezone: string;
  matchedSkills: MatchedSkill[];
  unmatchedRelatedSkills: UnmatchedRelatedSkill[];
  matchedSkillCount: number;
  avgConfidence: number;
  matchedBusinessDomains: BusinessDomainMatch[];
  matchedTechnicalDomains: TechnicalDomainMatch[];
}

/** Context for computing meetsRequired/meetsPreferred flags on domain matches */
export interface DomainConstraintContext {
  requiredBusinessDomains: ResolvedBusinessDomain[];
  preferredBusinessDomains: ResolvedBusinessDomain[];
  requiredTechnicalDomains: ResolvedTechnicalDomain[];
  preferredTechnicalDomains: ResolvedTechnicalDomain[];
}

/** Options for controlling skill parsing behavior */
export interface ParseOptions {
  shouldClearSkills: boolean;
  isTeamFocusOnlyMode: boolean;
  alignedSkillIds: string[];
}

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Converts Neo4j integer values to JavaScript numbers.
 */
export function toNumber(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === "number") {
    return value;
  }
  // Handle Neo4j Integer type
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value) || 0;
}

/**
 * Parses a Neo4j record into a RawEngineerRecord.
 * Handles skill categorization based on search mode.
 */
export function parseEngineerFromRecord(
  record: { get: (key: string) => unknown },
  options: ParseOptions,
  domainContext: DomainConstraintContext
): RawEngineerRecord {
  const { shouldClearSkills, isTeamFocusOnlyMode, alignedSkillIds } = options;

  // Pre-flatten domain constraint IDs for efficient lookup
  const allRequiredBusinessDomainIds = new Set(
    domainContext.requiredBusinessDomains.flatMap((c) => c.expandedDomainIds)
  );
  const allPreferredBusinessDomainIds = new Set(
    domainContext.preferredBusinessDomains.flatMap((c) => c.expandedDomainIds)
  );
  const allRequiredTechnicalDomainIds = new Set(
    domainContext.requiredTechnicalDomains.flatMap((c) => c.expandedDomainIds)
  );
  const allPreferredTechnicalDomainIds = new Set(
    domainContext.preferredTechnicalDomains.flatMap((c) => c.expandedDomainIds)
  );

  let matchedSkills: MatchedSkill[] = [];
  let unmatchedRelatedSkills: UnmatchedRelatedSkill[] = [];

  if (!shouldClearSkills) {
    const allSkills = (record.get("allRelevantSkills") as RawSkillData[]) || [];

    if (isTeamFocusOnlyMode) {
      // Team-focus-only: no constraints to categorize, just filter to aligned skills
      matchedSkills = allSkills
        .filter((skill) => alignedSkillIds.includes(skill.skillId))
        .map((skill) => ({
          skillId: skill.skillId,
          skillName: skill.skillName,
          proficiencyLevel: skill.proficiencyLevel,
          confidenceScore: skill.confidenceScore,
          yearsUsed: skill.yearsUsed,
          matchType: skill.matchType,
        }));
      // unmatchedRelatedSkills stays empty - no constraint violations to report
    } else {
      // Skill-filtered mode: categorize by constraint checks
      const categorized = categorizeSkillsByConstraints(allSkills);
      matchedSkills = categorized.matchedSkills;
      unmatchedRelatedSkills = categorized.unmatchedRelatedSkills;
    }
  }

  // Extract matched domains with correct flag computation
  const matchedBusinessDomains = parseDomainMatches<
    BusinessDomainMatch,
    RawBusinessDomainMatch
  >(
    record.get("matchedBusinessDomains") as RawBusinessDomainMatch[] | null,
    (raw) => ({
      domainId: raw.domainId,
      domainName: raw.domainName,
      engineerYears: toNumber(raw.years),
      meetsRequired: allRequiredBusinessDomainIds.has(raw.domainId),
      meetsPreferred: allPreferredBusinessDomainIds.has(raw.domainId),
    })
  );

  const matchedTechnicalDomains = parseDomainMatches<
    TechnicalDomainMatch,
    RawTechnicalDomainMatch
  >(
    record.get("matchedTechnicalDomains") as RawTechnicalDomainMatch[] | null,
    (raw) => ({
      domainId: raw.domainId,
      domainName: raw.domainName,
      engineerYears: toNumber(raw.years),
      matchType: (raw.source === "inferred"
        ? "skill_inferred"
        : "direct") as TechnicalDomainMatchType,
      meetsRequired: allRequiredTechnicalDomainIds.has(raw.domainId),
      meetsPreferred: allPreferredTechnicalDomainIds.has(raw.domainId),
    })
  );

  return {
    id: record.get("id") as string,
    name: record.get("name") as string,
    headline: record.get("headline") as string,
    salary: toNumber(record.get("salary")),
    yearsExperience: toNumber(record.get("yearsExperience")),
    startTimeline: record.get("startTimeline") as string,
    timezone: record.get("timezone") as string,
    matchedSkills,
    unmatchedRelatedSkills,
    matchedSkillCount: shouldClearSkills
      ? 0
      : toNumber(record.get("matchedSkillCount")),
    avgConfidence: shouldClearSkills
      ? 0
      : toNumber(record.get("avgConfidence")),
    matchedBusinessDomains,
    matchedTechnicalDomains,
  };
}

/**
 * Parses raw domain match data from Cypher query results.
 * Filters out null values and objects with null domainId (from OPTIONAL MATCH).
 */
export function parseDomainMatches<T, R extends { domainId: unknown }>(
  rawDomains: R[] | null,
  mapper: (raw: R) => T
): T[] {
  if (!rawDomains) return [];
  return rawDomains
    .filter(
      (d): d is R => d !== null && typeof d === "object" && d.domainId !== null
    )
    .map(mapper);
}

/**
 * Categorizes raw skill data into matched and unmatched skills based on constraint checks.
 *
 * This separation exists because the API returns both categories to the client:
 * - matchedSkills: Skills that directly satisfy the search criteria (used for ranking)
 * - unmatchedRelatedSkills: Related skills shown as context to explain why an engineer
 *   appeared in results or what gaps exist
 *
 * Categorization rules:
 * - Direct matches passing all constraints → matchedSkills
 * - Descendants → unmatchedRelatedSkills (even if passing constraints). When a user
 *   specifies constraints like "TypeScript at expert level", we can only verify that
 *   against a direct TypeScript assessment—not infer it from a descendant skill.
 *   The descendant explains why the engineer appeared in results but isn't a confirmed match.
 * - Any skill with constraint violations → unmatchedRelatedSkills
 */
function categorizeSkillsByConstraints(allSkills: RawSkillData[]): {
  matchedSkills: MatchedSkill[];
  unmatchedRelatedSkills: UnmatchedRelatedSkill[];
} {
  const matchedSkills: MatchedSkill[] = [];
  const unmatchedRelatedSkills: UnmatchedRelatedSkill[] = [];

  for (const skill of allSkills) {
    const violations: ConstraintViolation[] = [];
    if (!skill.meetsProficiency) violations.push("proficiency_below_minimum");

    const isDirectMatchPassingConstraints =
      skill.matchType === "direct" && violations.length === 0;

    if (isDirectMatchPassingConstraints) {
      matchedSkills.push({
        skillId: skill.skillId,
        skillName: skill.skillName,
        proficiencyLevel: skill.proficiencyLevel,
        confidenceScore: skill.confidenceScore,
        yearsUsed: skill.yearsUsed,
        matchType: skill.matchType,
      });
    } else {
      // Descendants (even if passing constraints) and any skill with violations
      unmatchedRelatedSkills.push({
        skillId: skill.skillId,
        skillName: skill.skillName,
        proficiencyLevel: skill.proficiencyLevel,
        confidenceScore: skill.confidenceScore,
        yearsUsed: skill.yearsUsed,
        matchType: skill.matchType,
        constraintViolations: violations,
      });
    }
  }

  return { matchedSkills, unmatchedRelatedSkills };
}
```

### Success Criteria:

#### Automated Verification:
- [x] File created at correct path
- [x] Type checking passes: `npm run typecheck`

#### Manual Verification:
- [x] None for this phase

---

## Phase 2: Create skill-resolution.service.ts

### Overview
Extract skill resolution coordination that handles both required and preferred skills.

### Changes Required:

#### 1. Create new file
**File**: `recommender_api/src/services/skill-resolution.service.ts`

```typescript
/**
 * Skill Resolution Service
 * Coordinates resolution of both required and preferred skills for search queries.
 */

import type { Session } from "neo4j-driver";
import type {
  ProficiencyLevel,
  SkillRequirement,
} from "../types/search.types.js";
import {
  resolveSkillRequirements,
  type ResolvedSkillWithProficiency,
} from "./skill-resolver.service.js";
import type { SkillProficiencyGroups } from "./cypher-query-builder/index.js";

/** Result of resolving both required and preferred skills */
export interface SkillResolutionResult {
  /** From required skills (for query building) */
  skillGroups: SkillProficiencyGroups;
  /** All skill IDs from skillGroups combined */
  allRequestedSkillIds: string[];
  expandedSkillNames: string[];
  unresolvedSkills: string[];
  originalSkillIdentifiers: string[];
  /** From preferred skills (for ranking) */
  preferredSkillIds: string[];
  /** Merged from both (for utility calculation) */
  skillIdToPreferredProficiency: Map<string, ProficiencyLevel>;
}

/**
 * Groups resolved skills by their minProficiency level for efficient query filtering.
 * Returns three arrays: skills requiring 'learning', 'proficient', or 'expert' minimum.
 */
export function groupSkillsByProficiency(
  resolvedSkills: ResolvedSkillWithProficiency[]
): SkillProficiencyGroups {
  const learningLevelSkillIds: string[] = [];
  const proficientLevelSkillIds: string[] = [];
  const expertLevelSkillIds: string[] = [];

  for (const skill of resolvedSkills) {
    switch (skill.minProficiency) {
      case "learning":
        learningLevelSkillIds.push(skill.skillId);
        break;
      case "proficient":
        proficientLevelSkillIds.push(skill.skillId);
        break;
      case "expert":
        expertLevelSkillIds.push(skill.skillId);
        break;
    }
  }

  return {
    learningLevelSkillIds,
    proficientLevelSkillIds,
    expertLevelSkillIds,
  };
}

/**
 * Resolves both required and preferred skills, returning all data needed for query building and ranking.
 */
export async function resolveAllSkills(
  session: Session,
  requiredSkills: SkillRequirement[] | undefined,
  preferredSkills: SkillRequirement[] | undefined,
  defaultProficiency: ProficiencyLevel
): Promise<SkillResolutionResult> {
  // Defaults for when no skills are provided
  let skillGroups: SkillProficiencyGroups = {
    learningLevelSkillIds: [],
    proficientLevelSkillIds: [],
    expertLevelSkillIds: [],
  };
  let expandedSkillNames: string[] = [];
  let unresolvedSkills: string[] = [];
  let originalSkillIdentifiers: string[] = [];
  let preferredSkillIds: string[] = [];
  const skillIdToPreferredProficiency = new Map<string, ProficiencyLevel>();

  // Resolve required skills
  if (requiredSkills && requiredSkills.length > 0) {
    const result = await resolveSkillRequirements(
      session,
      requiredSkills,
      defaultProficiency
    );
    skillGroups = groupSkillsByProficiency(result.resolvedSkills);
    expandedSkillNames = result.expandedSkillNames;
    unresolvedSkills = result.unresolvedIdentifiers;
    originalSkillIdentifiers = result.originalIdentifiers;

    // Add preferred proficiencies from required skills
    for (const skill of result.resolvedSkills) {
      if (skill.preferredMinProficiency) {
        skillIdToPreferredProficiency.set(
          skill.skillId,
          skill.preferredMinProficiency
        );
      }
    }
  }

  // Resolve preferred skills
  if (preferredSkills && preferredSkills.length > 0) {
    const result = await resolveSkillRequirements(
      session,
      preferredSkills,
      defaultProficiency
    );
    preferredSkillIds = result.resolvedSkills.map((s) => s.skillId);

    // Add preferred proficiencies (don't override existing from required)
    for (const skill of result.resolvedSkills) {
      if (
        skill.preferredMinProficiency &&
        !skillIdToPreferredProficiency.has(skill.skillId)
      ) {
        skillIdToPreferredProficiency.set(
          skill.skillId,
          skill.preferredMinProficiency
        );
      }
    }
  }

  const allRequestedSkillIds = [
    ...skillGroups.learningLevelSkillIds,
    ...skillGroups.proficientLevelSkillIds,
    ...skillGroups.expertLevelSkillIds,
  ];

  return {
    skillGroups,
    allRequestedSkillIds,
    expandedSkillNames,
    unresolvedSkills,
    originalSkillIdentifiers,
    preferredSkillIds,
    skillIdToPreferredProficiency,
  };
}
```

### Success Criteria:

#### Automated Verification:
- [x] File created at correct path
- [x] Type checking passes: `npm run typecheck`

#### Manual Verification:
- [x] None for this phase

---

## Phase 3: Update search.service.ts

### Overview
Refactor the main search service to import from the new modules, removing extracted code and keeping only orchestration logic.

### Changes Required:

#### 1. Update imports and remove extracted code
**File**: `recommender_api/src/services/search.service.ts`

Replace entire file with:

```typescript
/**
 * Search Service
 * Main orchestration layer for the constraint-based search API.
 * Coordinates all services to fulfill search requests.
 */

import type { Session } from "neo4j-driver";
import type {
  SearchFilterRequest,
  SearchFilterResponse,
  EngineerMatch,
} from "../types/search.types.js";
import { expandSearchCriteria } from "./constraint-expander.service.js";
import { resolveAllSkills } from "./skill-resolution.service.js";
import {
  resolveBusinessDomains,
  resolveTechnicalDomains,
} from "./domain-resolver.service.js";
import {
  buildSearchQuery,
  type CypherQueryParams,
  type ResolvedTechnicalDomain,
  type ResolvedBusinessDomain,
} from "./cypher-query-builder/index.js";
import {
  scoreAndSortEngineers,
  type EngineerData,
  type UtilityContext,
} from "./utility-calculator.service.js";
import { knowledgeBaseConfig } from "../config/knowledge-base/index.js";
import {
  parseEngineerFromRecord,
  toNumber,
  type RawEngineerRecord,
  type DomainConstraintContext,
  type ParseOptions,
} from "./engineer-record-parser.js";

/**
 * Executes a search filter request and returns ranked results.
 */
export async function executeSearch(
  session: Session,
  request: SearchFilterRequest
): Promise<SearchFilterResponse> {
  const startTime = Date.now();
  const config = knowledgeBaseConfig;

  // Step 1: Expand search criteria using knowledge base rules
  const expanded = expandSearchCriteria(request);

  // Step 2: Resolve all skill requirements (both required and preferred)
  const {
    skillGroups,
    allRequestedSkillIds,
    expandedSkillNames,
    unresolvedSkills,
    originalSkillIdentifiers,
    preferredSkillIds,
    skillIdToPreferredProficiency,
  } = await resolveAllSkills(
    session,
    request.requiredSkills,
    request.preferredSkills,
    config.defaults.defaultMinProficiency
  );

  // Step 2b: Resolve domain requirements using new domain model
  // Note: Must run sequentially - Neo4j sessions are not thread-safe for concurrent queries
  const requiredBusinessDomains = await resolveBusinessDomains(
    session,
    request.requiredBusinessDomains
  );
  const preferredBusinessDomains = await resolveBusinessDomains(
    session,
    request.preferredBusinessDomains
  );
  const requiredTechnicalDomains = await resolveTechnicalDomains(
    session,
    request.requiredTechnicalDomains
  );
  const preferredTechnicalDomains = await resolveTechnicalDomains(
    session,
    request.preferredTechnicalDomains
  );

  // Step 3: Build query parameters with per-skill proficiency buckets
  const queryParams: CypherQueryParams = {
    // Per-skill proficiency buckets
    learningLevelSkillIds: skillGroups.learningLevelSkillIds,
    proficientLevelSkillIds: skillGroups.proficientLevelSkillIds,
    expertLevelSkillIds: skillGroups.expertLevelSkillIds,
    originalSkillIdentifiers:
      originalSkillIdentifiers.length > 0 ? originalSkillIdentifiers : null,
    // Basic engineer filters
    startTimeline: expanded.startTimeline,
    minYearsExperience: expanded.minYearsExperience,
    maxYearsExperience: expanded.maxYearsExperience,
    timezonePrefixes: expanded.timezonePrefixes,
    maxSalary: expanded.maxSalary,
    minSalary: expanded.minSalary,
    offset: expanded.offset,
    limit: expanded.limit,
    // Domain filtering with new model
    requiredBusinessDomains:
      requiredBusinessDomains.length > 0 ? requiredBusinessDomains : undefined,
    preferredBusinessDomains:
      preferredBusinessDomains.length > 0
        ? preferredBusinessDomains
        : undefined,
    requiredTechnicalDomains:
      requiredTechnicalDomains.length > 0
        ? requiredTechnicalDomains
        : undefined,
    preferredTechnicalDomains:
      preferredTechnicalDomains.length > 0
        ? preferredTechnicalDomains
        : undefined,
  };

  // Step 4: Execute main query (unified for skill-filtered and unfiltered search)
  const mainQuery = buildSearchQuery(queryParams);

  // Run main query (now includes totalCount computed before pagination)
  const mainResult = await session.run(mainQuery.query, mainQuery.params);

  // Step 5: Process results
  // Determine search mode from what user specified (not derived data).
  // parseEngineerFromRecord needs these flags to decide how to populate skill arrays:
  // - skill constraints specified → categorize skills as matched/unmatched by constraint
  // - teamFocus only → filter to team-aligned skills (no constraint categorization)
  // - neither → return empty skill arrays (unfiltered search doesn't show skills)
  const hasSkillConstraints =
    (request.requiredSkills?.length ?? 0) > 0 ||
    (request.preferredSkills?.length ?? 0) > 0;
  const hasTeamFocus = request.teamFocus !== undefined;
  const isTeamFocusOnlyMode = !hasSkillConstraints && hasTeamFocus;
  const shouldClearSkills = !hasSkillConstraints && !hasTeamFocus;

  const parseOptions: ParseOptions = {
    shouldClearSkills,
    isTeamFocusOnlyMode,
    alignedSkillIds: expanded.alignedSkillIds,
  };

  // Build domain context for flag computation
  const domainContext: DomainConstraintContext = {
    requiredBusinessDomains,
    preferredBusinessDomains,
    requiredTechnicalDomains,
    preferredTechnicalDomains,
  };

  const rawEngineers: RawEngineerRecord[] = mainResult.records.map((record) =>
    parseEngineerFromRecord(record, parseOptions, domainContext)
  );

  // Extract totalCount from first record (all records have same value from early count step)
  const totalCount =
    mainResult.records.length > 0
      ? toNumber(mainResult.records[0].get("totalCount"))
      : 0;

  // Step 6: Calculate utility scores and rank
  const engineerData: EngineerData[] = rawEngineers.map((raw) => ({
    id: raw.id,
    name: raw.name,
    headline: raw.headline,
    salary: raw.salary,
    yearsExperience: raw.yearsExperience,
    startTimeline: raw.startTimeline,
    timezone: raw.timezone,
    matchedSkills: raw.matchedSkills,
    unmatchedRelatedSkills: raw.unmatchedRelatedSkills,
    avgConfidence: raw.avgConfidence,
    matchedBusinessDomains: raw.matchedBusinessDomains,
    matchedTechnicalDomains: raw.matchedTechnicalDomains,
  }));

  const utilityContext: UtilityContext = {
    requestedSkillIds: allRequestedSkillIds,
    preferredSkillIds,
    preferredBusinessDomains,
    preferredTechnicalDomains,
    alignedSkillIds: expanded.alignedSkillIds,
    maxSalaryBudget: expanded.maxSalary,
    // Pass through preferred/required values
    preferredSeniorityLevel: expanded.preferredSeniorityLevel,
    preferredMaxStartTime: expanded.preferredMaxStartTime,
    requiredMaxStartTime: expanded.requiredMaxStartTime,
    preferredTimezone: expanded.preferredTimezone,
    preferredSalaryRange: expanded.preferredSalaryRange,
    // Per-skill preferred proficiencies for ranking boost
    skillIdToPreferredProficiency,
  };

  const scoredEngineers = scoreAndSortEngineers(engineerData, utilityContext);

  // Step 7: Format response
  const matches: EngineerMatch[] = scoredEngineers.map((eng) => ({
    id: eng.id,
    name: eng.name,
    headline: eng.headline,
    salary: eng.salary,
    yearsExperience: eng.yearsExperience,
    startTimeline: eng.startTimeline,
    timezone: eng.timezone,
    matchedSkills: eng.matchedSkills,
    unmatchedRelatedSkills: eng.unmatchedRelatedSkills,
    matchedBusinessDomains: eng.matchedBusinessDomains,
    matchedTechnicalDomains: eng.matchedTechnicalDomains,
    utilityScore: eng.utilityScore,
    scoreBreakdown: eng.scoreBreakdown,
  }));

  const executionTimeMs = Date.now() - startTime;

  return {
    matches,
    totalCount,
    appliedFilters: expanded.appliedFilters,
    appliedPreferences: expanded.appliedPreferences,
    queryMetadata: {
      executionTimeMs,
      skillsExpanded: expandedSkillNames,
      defaultsApplied: expanded.defaultsApplied,
      unresolvedSkills,
    },
  };
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `npm run typecheck`
- [x] Newman tests pass: `npx newman run postman/collections/search-filter-tests.postman_collection.json --globals postman/globals/workspace.postman_globals.json`

#### Manual Verification:
- [x] API returns identical results for various search queries (covered by Newman tests)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that API behavior is unchanged before considering the refactoring complete.

---

## Testing Strategy

### Automated Tests:
- Type checking validates all imports/exports are correct
- Newman/Postman collection validates API behavior unchanged

### Manual Testing Steps:
1. Run a skill-filtered search (e.g., `{"requiredSkills": [{"identifier": "TypeScript"}]}`)
2. Run an unfiltered search (no skills, no teamFocus)
3. Run a teamFocus-only search
4. Verify matchedSkills and unmatchedRelatedSkills arrays are populated correctly
5. Verify domain matches have correct meetsRequired/meetsPreferred flags

## Performance Considerations

No performance impact expected - this is a pure refactoring with no algorithmic changes. The function call overhead of the new module boundaries is negligible.

## Migration Notes

No migration required. This is an internal refactoring that maintains the same public API. The only exported function `executeSearch` signature remains unchanged.

## References

- Original file: `recommender_api/src/services/search.service.ts`
- Pattern reference: `recommender_api/src/services/skill-resolver.service.ts` (single-responsibility service)
- Pattern reference: `recommender_api/src/services/constraint-expander.service.ts` (internal types pattern)
