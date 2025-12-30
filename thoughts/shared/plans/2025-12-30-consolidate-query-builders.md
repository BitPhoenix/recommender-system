# Plan: Consolidate Query Builders to Fix Browse Mode Error

## Problem Summary

After implementing the constraint violations feature, calling the search API with `teamFocus: "scaling"` (no `requiredSkills`) causes an error:

```
This record has no field with key 'allRelevantSkills', available keys are:
[id,name,headline,salary,yearsExperience,availability,timezone,matchedSkills,matchedSkillCount,avgConfidence].
```

**Root cause**: Having two separate query builders (`buildSkillSearchQuery` and `buildBrowseQuery`) is error-prone:
- `buildSkillSearchQuery` returns field `allRelevantSkills`
- `buildBrowseQuery` returns field `matchedSkills`
- `search.service.ts:143` tries to access `allRelevantSkills` first, which throws in browse mode

## Solution: Unified Query Builder

Consolidate both queries into a single `buildSearchQuery` with consistent return structure.

### Current Duplication Analysis

Both queries share identical engineer-level conditions (duplicated ~25 lines each):
- `e.availability IN $availability`
- `e.yearsExperience >= $minYearsExperience` (and optional max)
- `e.timezone STARTS WITH $timezonePrefix` (optional)
- `e.salary <= $maxSalary` / `e.salary >= $minSalary` (optional)

### Files to Modify

1. **`recommender_api/src/services/cypher-builder.service.ts`**
2. **`recommender_api/src/services/search.service.ts`**

---

## Step 1: Add Shared Helper Function

**File**: `recommender_api/src/services/cypher-builder.service.ts`

Add new helper to extract duplicated condition-building logic:

```typescript
interface EngineerConditionsResult {
  conditions: string[];
  queryParams: Record<string, unknown>;
}

function buildEngineerConditions(params: CypherQueryParams): EngineerConditionsResult {
  const queryParams: Record<string, unknown> = {
    availability: params.availability,
    minYearsExperience: params.minYearsExperience,
  };

  const conditions: string[] = [
    "e.availability IN $availability",
    "e.yearsExperience >= $minYearsExperience",
  ];

  if (params.maxYearsExperience !== null) {
    conditions.push("e.yearsExperience < $maxYearsExperience");
    queryParams.maxYearsExperience = params.maxYearsExperience;
  }

  if (params.timezonePrefix !== null) {
    conditions.push("e.timezone STARTS WITH $timezonePrefix");
    queryParams.timezonePrefix = params.timezonePrefix;
  }

  if (params.maxSalary !== null) {
    conditions.push("e.salary <= $maxSalary");
    queryParams.maxSalary = params.maxSalary;
  }

  if (params.minSalary !== null) {
    conditions.push("e.salary >= $minSalary");
    queryParams.minSalary = params.minSalary;
  }

  return { conditions, queryParams };
}
```

---

## Step 2: Create Unified `buildSearchQuery`

**File**: `recommender_api/src/services/cypher-builder.service.ts`

Replace `buildSkillSearchQuery` and `buildBrowseQuery` with single unified function:

```typescript
export function buildSearchQuery(params: CypherQueryParams): CypherQuery {
  const { conditions, queryParams } = buildEngineerConditions(params);
  const hasSkillFilter = params.targetSkillIds !== null && params.targetSkillIds.length > 0;

  // Add pagination params
  queryParams.offset = int(params.offset);
  queryParams.limit = int(params.limit);

  if (hasSkillFilter) {
    // SKILL SEARCH MODE: Two-stage filtering with constraint check booleans
    queryParams.targetSkillIds = params.targetSkillIds;
    queryParams.skillIdentifiers = params.skillIdentifiers || [];
    queryParams.minConfidenceScore = params.minConfidenceScore;
    queryParams.allowedProficiencyLevels = params.allowedProficiencyLevels;

    const whereClause = conditions.join("\n  AND ");

    const query = `
// Stage 1: Find engineers with at least one qualifying skill in the hierarchy
MATCH (e:Engineer)-[:HAS]->(es:EngineerSkill)-[:FOR]->(s:Skill)
WHERE s.id IN $targetSkillIds
  AND ${whereClause}

// Check which engineers have at least one skill meeting confidence/proficiency constraints
WITH e, COLLECT(DISTINCT CASE
  WHEN es.confidenceScore >= $minConfidenceScore
   AND es.proficiencyLevel IN $allowedProficiencyLevels
  THEN s.id END) AS qualifyingSkillIds
WHERE SIZE([x IN qualifyingSkillIds WHERE x IS NOT NULL]) > 0

// Stage 2: Get ALL skills in hierarchy for qualifying engineers
MATCH (e)-[:HAS]->(es2:EngineerSkill)-[:FOR]->(s2:Skill)
WHERE s2.id IN $targetSkillIds

// Collect all skills with constraint check info
WITH e,
     COLLECT({
       skillId: s2.id,
       skillName: s2.name,
       proficiencyLevel: es2.proficiencyLevel,
       confidenceScore: es2.confidenceScore,
       yearsUsed: es2.yearsUsed,
       matchType: CASE
         WHEN s2.id IN $skillIdentifiers OR s2.name IN $skillIdentifiers THEN 'direct'
         ELSE 'descendant'
       END,
       meetsConfidence: es2.confidenceScore >= $minConfidenceScore,
       meetsProficiency: es2.proficiencyLevel IN $allowedProficiencyLevels
     }) AS allRelevantSkills,
     SIZE([x IN COLLECT(DISTINCT CASE
       WHEN es2.confidenceScore >= $minConfidenceScore
        AND es2.proficiencyLevel IN $allowedProficiencyLevels
       THEN s2.id END) WHERE x IS NOT NULL]) AS matchedSkillCount,
     AVG(CASE
       WHEN es2.confidenceScore >= $minConfidenceScore
        AND es2.proficiencyLevel IN $allowedProficiencyLevels
       THEN es2.confidenceScore END) AS avgConfidence

// Return results ordered by match quality
RETURN e.id AS id,
       e.name AS name,
       e.headline AS headline,
       e.salary AS salary,
       e.yearsExperience AS yearsExperience,
       e.availability AS availability,
       e.timezone AS timezone,
       allRelevantSkills,
       matchedSkillCount,
       COALESCE(avgConfidence, 0.0) AS avgConfidence

ORDER BY matchedSkillCount DESC, avgConfidence DESC, e.yearsExperience DESC
SKIP $offset
LIMIT $limit
`;

    return { query, params: queryParams };

  } else {
    // BROWSE MODE: No skill filtering, OPTIONAL MATCH for display
    queryParams.allowedProficiencyLevels = params.allowedProficiencyLevels;
    queryParams.minConfidenceScore = params.minConfidenceScore;

    const whereClause = conditions.join("\n  AND ");

    const query = `
// Find all engineers matching base constraints
MATCH (e:Engineer)
WHERE ${whereClause}

// Get all skills for display (not filtering)
OPTIONAL MATCH (e)-[:HAS]->(es:EngineerSkill)-[:FOR]->(s:Skill)
WHERE s.isCategory = false
  AND es.proficiencyLevel IN $allowedProficiencyLevels
  AND es.confidenceScore >= $minConfidenceScore

WITH e,
     COLLECT(
       CASE WHEN s IS NOT NULL THEN {
         skillId: s.id,
         skillName: s.name,
         proficiencyLevel: es.proficiencyLevel,
         confidenceScore: es.confidenceScore,
         yearsUsed: es.yearsUsed,
         matchType: 'none'
       } ELSE NULL END
     ) AS rawSkills

WITH e,
     [skill IN rawSkills WHERE skill IS NOT NULL] AS allRelevantSkills

RETURN e.id AS id,
       e.name AS name,
       e.headline AS headline,
       e.salary AS salary,
       e.yearsExperience AS yearsExperience,
       e.availability AS availability,
       e.timezone AS timezone,
       allRelevantSkills,
       0 AS matchedSkillCount,
       0.0 AS avgConfidence

ORDER BY e.yearsExperience DESC
SKIP $offset
LIMIT $limit
`;

    return { query, params: queryParams };
  }
}
```

**Key change**: Both branches now return `allRelevantSkills` (not `matchedSkills` for browse mode).

---

## Step 3: Update Count Query

**File**: `recommender_api/src/services/cypher-builder.service.ts`

Simplify `buildCountQuery` to use shared helper:

```typescript
export function buildCountQuery(params: CypherQueryParams): CypherQuery {
  const { conditions, queryParams } = buildEngineerConditions(params);
  const hasSkillFilter = params.targetSkillIds !== null && params.targetSkillIds.length > 0;

  if (hasSkillFilter) {
    queryParams.targetSkillIds = params.targetSkillIds;
    queryParams.minConfidenceScore = params.minConfidenceScore;
    queryParams.allowedProficiencyLevels = params.allowedProficiencyLevels;

    const whereClause = conditions.join("\n  AND ");

    const query = `
MATCH (e:Engineer)-[:HAS]->(es:EngineerSkill)-[:FOR]->(s:Skill)
WHERE s.id IN $targetSkillIds
  AND ${whereClause}
WITH e, COLLECT(DISTINCT CASE
  WHEN es.confidenceScore >= $minConfidenceScore
   AND es.proficiencyLevel IN $allowedProficiencyLevels
  THEN s.id END) AS qualifyingSkillIds
WHERE SIZE([x IN qualifyingSkillIds WHERE x IS NOT NULL]) > 0
RETURN COUNT(DISTINCT e) AS totalCount
`;

    return { query, params: queryParams };

  } else {
    const whereClause = conditions.join("\n  AND ");

    const query = `
MATCH (e:Engineer)
WHERE ${whereClause}
RETURN COUNT(e) AS totalCount
`;

    return { query, params: queryParams };
  }
}
```

---

## Step 4: Remove Obsolete Functions

**File**: `recommender_api/src/services/cypher-builder.service.ts`

Delete the following functions (replaced by unified versions):
- `buildSkillSearchQuery` (replaced by `buildSearchQuery`)
- `buildBrowseQuery` (replaced by `buildSearchQuery`)
- `buildSkillCountQuery` (inlined into `buildCountQuery`)
- `buildBrowseCountQuery` (inlined into `buildCountQuery`)

---

## Step 5: Update search.service.ts

**File**: `recommender_api/src/services/search.service.ts`

### 5a. Update import

```typescript
// Before
import {
  buildSkillSearchQuery,
  buildBrowseQuery,
  buildCountQuery,
  type CypherQueryParams,
} from './cypher-builder.service.js';

// After
import {
  buildSearchQuery,
  buildCountQuery,
  type CypherQueryParams,
} from './cypher-builder.service.js';
```

### 5b. Simplify query selection (lines 118-122)

```typescript
// Before
const hasResolvedSkills = targetSkillIds !== null && targetSkillIds.length > 0;
const mainQuery = hasResolvedSkills
  ? buildSkillSearchQuery(queryParams)
  : buildBrowseQuery(queryParams);

// After
const mainQuery = buildSearchQuery(queryParams);
```

### 5c. Simplify skill retrieval (lines 143-146)

```typescript
// Before (error-prone fallback logic)
const allSkills = (record.get('allRelevantSkills') as RawSkillData[] | null)
  || (record.get('matchedSkills') as RawSkillData[] | null)
  || [];

// After (consistent field name)
const allSkills = (record.get('allRelevantSkills') as RawSkillData[]) || [];
```

---

## Testing

After implementation, verify:

### Automated checks
- [x] TypeScript compiles: `npx tsc --noEmit`

### Manual testing
1. **Skill search works**: `POST /api/search/filter` with `{"requiredSkills": ["Full Stack"], "riskTolerance": "low"}`
   - [ ] Should return `matchedSkills` and `unmatchedRelatedSkills` arrays

2. **Browse mode works**: `POST /api/search/filter` with `{"teamFocus": "scaling"}`
   - [ ] Should return engineers without error
   - [ ] Skills should have `matchType: "none"`

3. **Pure browse works**: `POST /api/search/filter` with `{}`
   - [ ] Should return all engineers matching default constraints
