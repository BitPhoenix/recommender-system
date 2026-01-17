# Consolidate Skill Query Duplication Implementation Plan

## Overview

Consolidate duplicated skill extraction and query building logic across the constraint-advisor and cypher-query-builder modules. Currently, three files have near-identical skill extraction functions, and the proficiency CASE pattern is copy-pasted in the tightening generator instead of reusing the shared builder.

## Current State Analysis

### Duplication 1: Skill Extraction Functions (3 copies)

| File | Function | Purpose |
|------|----------|---------|
| `tightening-generator.service.ts:531-555` | `extractSkillsFromDecomposed` | Extract skills for tightening |
| `tightening-tester.service.ts:258-282` | `extractSkillsFromConstraints` | Extract skills for tightening tests |
| `relaxation-tester.service.ts:148-173` | `resolveSkillIdsFromConstraints` | Extract skills for relaxation tests |

All three do the same thing: iterate `DecomposedConstraints`, return `{ userRequiredSkills, derivedSkillIds }`.

### Duplication 2: Skill Parameter Building (2 copies)

| File | Function |
|------|----------|
| `tightening-generator.service.ts:557-574` | `buildSkillParams` |
| `search-query.builder.ts:202-214` | `addSkillQueryParams` |

Both build `allSkillIds`, `learningLevelSkillIds`, `proficientLevelSkillIds`, `expertLevelSkillIds`.

### Duplication 3: Proficiency CASE Logic (inline copy)

The proficiency CASE pattern in `tightening-generator.service.ts:454-459` is a copy-paste of `buildProficiencyQualificationClause()` from `search-query.builder.ts:127-133`.

### Key Discovery

`relaxation-tester.service.ts` already correctly reuses `buildSkillFilterCountQuery` - it's the model for how the other files should work.

## Desired End State

1. **Single source of truth** for skill extraction from `DecomposedConstraints`
2. **Single source of truth** for proficiency CASE pattern (already exists: `buildProficiencyQualificationClause`)
3. **New distribution query builder** that reuses the proficiency pattern for the tightening generator's distribution query
4. All consumers import from shared utilities instead of having local copies

### Verification

- `npm run typecheck` passes
- `npm test` passes (all existing tests continue to work)
- `npm run test:e2e` passes
- Grep for `extractSkillsFrom` finds only the canonical location
- Grep for proficiency CASE pattern (`WHEN.*learningLevelSkillIds`) finds only `search-query.builder.ts`

## What We're NOT Doing

- Not changing the query semantics - only consolidating identical logic
- Not refactoring the main search query builder
- Not changing the constraint-advisor's public API
- Not adding new features - pure consolidation

## Implementation Approach

1. Create shared skill extraction utility in constraint-advisor
2. Create skill distribution query builder in cypher-query-builder
3. Update consumers to use shared utilities
4. Delete duplicated code

---

## Phase 1: Create Shared Skill Extraction Utility

### Overview

Create `skill-extraction.utils.ts` in constraint-advisor with the canonical skill extraction function.

### Changes Required

#### 1. Create new utility file

**File**: `recommender_api/src/services/constraint-advisor/skill-extraction.utils.ts`

```typescript
import {
  ConstraintType,
  type TestableConstraint,
  type DecomposedConstraints,
  isUserSkillConstraint,
  isDerivedSkillConstraint,
} from "./constraint.types.js";
import type { ResolvedSkillWithProficiency } from "../skill-resolver.service.js";
import type { ProficiencyLevel } from "../../types/search.types.js";

/**
 * Result of extracting skills from decomposed constraints.
 * Separates user skills (with proficiency requirements) from derived skills (existence-only).
 */
export interface ExtractedSkillConstraints {
  /** User skills with proficiency requirements (checked via CASE pattern) */
  userRequiredSkills: ResolvedSkillWithProficiency[];
  /** Derived skills from inference rules (existence-only, no proficiency) */
  derivedSkillIds: string[];
}

/**
 * Extracts skill constraints from decomposed constraints.
 *
 * SINGLE SOURCE OF TRUTH for skill extraction from DecomposedConstraints.
 * Used by relaxation-tester, tightening-tester, and tightening-generator.
 *
 * Returns two categories with different query semantics:
 * - userRequiredSkills: Have proficiency requirements, checked via CASE pattern
 * - derivedSkillIds: Existence-only, checked via ALL(...WHERE EXISTS {...}) pattern
 */
export function extractSkillConstraints(
  decomposed: DecomposedConstraints
): ExtractedSkillConstraints {
  return extractSkillConstraintsFromArray(decomposed.constraints);
}

/**
 * Lower-level extraction from a constraints array.
 * Useful when you have constraints but not the full DecomposedConstraints object.
 */
export function extractSkillConstraintsFromArray(
  constraints: TestableConstraint[]
): ExtractedSkillConstraints {
  const userRequiredSkills: ResolvedSkillWithProficiency[] = [];
  const derivedSkillIds: string[] = [];

  for (const constraint of constraints) {
    if (constraint.constraintType !== ConstraintType.SkillTraversal) continue;

    if (constraint.field === 'requiredSkills' && isUserSkillConstraint(constraint)) {
      const skillReq = constraint.value;
      userRequiredSkills.push({
        skillId: skillReq.skill,
        skillName: skillReq.skill,
        minProficiency: (skillReq.minProficiency ?? 'learning') as ProficiencyLevel,
        preferredMinProficiency: null,
      });
    } else if (constraint.field === 'derivedSkills' && isDerivedSkillConstraint(constraint)) {
      derivedSkillIds.push(...constraint.value);
    }
  }

  return {
    userRequiredSkills,
    derivedSkillIds: [...new Set(derivedSkillIds)],
  };
}
```

#### 2. Export from constraint-advisor index

**File**: `recommender_api/src/services/constraint-advisor/index.ts`

Add export:
```typescript
export {
  extractSkillConstraints,
  extractSkillConstraintsFromArray,
  type ExtractedSkillConstraints,
} from "./skill-extraction.utils.js";
```

### Success Criteria

#### Automated Verification:
- [x] `npm run typecheck` passes
- [x] New file exists at expected path

---

## Phase 2: Create Skill Distribution Query Builder

### Overview

Add `buildSkillDistributionQuery` to cypher-query-builder that generates the distribution query currently inline in `generateSkillTighteningSuggestions`. This reuses `buildProficiencyQualificationClause`.

### Changes Required

#### 1. Add distribution query builder

**File**: `recommender_api/src/services/cypher-query-builder/search-query.builder.ts`

Add after `buildSkillFilterCountQuery` (around line 200):

```typescript
/**
 * Builds a query to find the most common skills among engineers matching constraints.
 * Used by tightening suggestions to identify skills that could narrow results.
 *
 * Reuses the same proficiency logic as the main search query.
 *
 * @param skillGroups - Proficiency buckets (from groupSkillsByProficiency)
 * @param propertyConditions - WHERE clause conditions (from buildPropertyConditions)
 * @param derivedSkillIds - Derived skill IDs that must exist (existence-only check)
 * @param limit - Maximum number of skills to return (default 10)
 */
export function buildSkillDistributionQuery(
  skillGroups: SkillProficiencyGroups,
  propertyConditions: { whereClauses: string[]; params: Record<string, unknown> },
  derivedSkillIds: string[],
  limit: number = 10
): CypherQuery {
  const allSkillIds = [
    ...skillGroups.learningLevelSkillIds,
    ...skillGroups.proficientLevelSkillIds,
    ...skillGroups.expertLevelSkillIds,
  ];

  const params: Record<string, unknown> = {
    ...propertyConditions.params,
    allSkillIds,
    learningLevelSkillIds: skillGroups.learningLevelSkillIds,
    proficientLevelSkillIds: skillGroups.proficientLevelSkillIds,
    expertLevelSkillIds: skillGroups.expertLevelSkillIds,
    derivedSkillIds,
    distributionLimit: limit,
  };

  const propertyWhereClause = propertyConditions.whereClauses.length > 0
    ? propertyConditions.whereClauses.join('\n  AND ')
    : 'true';

  const derivedSkillExistenceClause = derivedSkillIds.length > 0
    ? `
  AND ALL(derivedId IN $derivedSkillIds WHERE EXISTS {
    MATCH (e)-[:HAS]->(:UserSkill)-[:FOR]->(:Skill {id: derivedId})
  })`
    : '';

  /*
   * Two query structures based on whether we have skill constraints:
   * 1. With skills: Filter engineers by skill match, then find their other skills
   * 2. Without skills: Find all engineers matching properties, then get their skills
   */
  if (allSkillIds.length > 0) {
    const query = `
MATCH (e:Engineer)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
WHERE s.id IN $allSkillIds
  AND ${propertyWhereClause}
WITH e, ${buildProficiencyQualificationClause()} AS qualifyingSkillIds
WHERE SIZE([x IN qualifyingSkillIds WHERE x IS NOT NULL]) >= SIZE($allSkillIds)${derivedSkillExistenceClause}
WITH e
MATCH (e)-[:HAS]->(us2:UserSkill)-[:FOR]->(s2:Skill)
WITH s2.name AS skillName, s2.id AS skillId, count(DISTINCT e) AS engineerCount
ORDER BY engineerCount DESC
LIMIT $distributionLimit
RETURN skillName, skillId, engineerCount
`;
    return { query, params };
  }

  // No skill constraints - simple distribution query
  const whereClause = propertyConditions.whereClauses.length > 0
    ? `WHERE ${propertyConditions.whereClauses.join("\n  AND ")}`
    : "";

  const query = `
MATCH (e:Engineer)
${whereClause}
MATCH (e)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
WITH s.name AS skillName, s.id AS skillId, count(DISTINCT e) AS engineerCount
ORDER BY engineerCount DESC
LIMIT $distributionLimit
RETURN skillName, skillId, engineerCount
`;

  return { query, params };
}
```

#### 2. Export from cypher-query-builder index

**File**: `recommender_api/src/services/cypher-query-builder/index.ts`

Update export:
```typescript
export { buildSearchQuery, buildSkillFilterCountQuery, buildSkillDistributionQuery } from "./search-query.builder.js";
```

### Success Criteria

#### Automated Verification:
- [x] `npm run typecheck` passes
- [x] New function is exported from index

---

## Phase 3: Update Consumers to Use Shared Utilities

### Overview

Update the three files with duplicated code to use the new shared utilities.

### Changes Required

#### 1. Update relaxation-tester.service.ts

**File**: `recommender_api/src/services/constraint-advisor/relaxation-tester.service.ts`

**Import change** (add):
```typescript
import { extractSkillConstraintsFromArray } from "./skill-extraction.utils.js";
```

**Replace** `resolveSkillIdsFromConstraints` usage (line 89):
```typescript
// Before:
const { userRequiredSkills, derivedSkillIds } = resolveSkillIdsFromConstraints(decomposedConstraints.constraints);

// After:
const { userRequiredSkills, derivedSkillIds } = extractSkillConstraintsFromArray(decomposedConstraints.constraints);
```

**Delete** the local `resolveSkillIdsFromConstraints` function (lines 141-173) and its interface `ResolvedSkillIds` (lines 22-27).

#### 2. Update tightening-tester.service.ts

**File**: `recommender_api/src/services/constraint-advisor/tightening-tester.service.ts`

**Import change** (add):
```typescript
import { extractSkillConstraints } from "./skill-extraction.utils.js";
```

**Replace** all `extractSkillsFromConstraints` calls with `extractSkillConstraints`:
- Line 79: `extractSkillsFromConstraints(decomposedConstraints)` → `extractSkillConstraints(decomposedConstraints)`
- Line 135: same replacement
- Line 171: same replacement
- Line 213: same replacement

**Delete** the local `extractSkillsFromConstraints` function (lines 258-282) and its interface `ExtractedSkills` (lines 29-32).

#### 3. Update tightening-generator.service.ts

**File**: `recommender_api/src/services/constraint-advisor/tightening-generator.service.ts`

**Import changes**:
```typescript
// Add:
import { extractSkillConstraints } from "./skill-extraction.utils.js";
import { buildSkillDistributionQuery } from "../cypher-query-builder/index.js";

// Remove (no longer needed after refactor):
import { buildSkillFilterCountQuery } from "../cypher-query-builder/index.js";
```

**Replace** the entire skill distribution query building section in `generateSkillTighteningSuggestions` (lines 417-484) with:

```typescript
async function generateSkillTighteningSuggestions(
  session: Session,
  expanded: ExpandedSearchCriteria,
  decomposed: DecomposedConstraints,
  baselineCount: number
): Promise<SkillTightening[]> {
  /*
   * Get currently required skill IDs from appliedFilters.
   * We need to check appliedFilters because requiredSkills are stored there
   * as AppliedSkillFilter with the resolved skill IDs.
   */
  const requiredSkillFilter = expanded.appliedFilters.find(
    (f): f is AppliedSkillFilter => f.kind === AppliedFilterKind.Skill && f.field === 'requiredSkills'
  );
  const currentSkillIds = requiredSkillFilter?.skills.map(s => s.skillId) ?? [];

  // Extract skills using shared utility
  const { userRequiredSkills, derivedSkillIds } = extractSkillConstraints(decomposed);

  // Build property conditions for the distribution query
  const propertyConstraintIds = new Set(
    decomposed.constraints
      .filter(c => c.constraintType === ConstraintType.Property)
      .map(c => c.id)
  );
  const propertyConditions = buildPropertyConditions(decomposed, propertyConstraintIds);

  // Build and run distribution query using shared builder
  const skillGroups = groupSkillsByProficiency(userRequiredSkills);
  const { query: distributionQuery, params: distributionParams } = buildSkillDistributionQuery(
    skillGroups,
    propertyConditions,
    derivedSkillIds
  );

  const result = await session.run(distributionQuery, distributionParams);
  const suggestions: SkillTightening[] = [];

  for (const record of result.records) {
    const skillName = record.get("skillName") as string;
    const skillId = record.get("skillId") as string;
    const frequencyCount = record.get("engineerCount")?.toNumber?.() ?? 0;
    const percentage = Math.round((frequencyCount / baselineCount) * 100);

    // Skip if already required or too rare
    if (currentSkillIds.includes(skillId) || percentage < 20) continue;

    /*
     * Test what we'd get if we added this skill as a requirement.
     * We use 'learning' (the lowest proficiency) for testing since that's the actual
     * ProficiencyLevel enum value. The suggestion displays "familiar" to match UI conventions.
     */
    const count = await testAddedSkillConstraint(
      session,
      decomposed,
      skillId,
      'learning'
    );

    if (count > 0 && count < baselineCount) {
      suggestions.push({
        field: "requiredSkills",
        suggestedValue: { skill: skillId, minProficiency: "familiar" },
        rationale: `Add ${skillName} as a required skill`,
        resultingMatches: count,
        distributionInfo: `${count} of ${baselineCount} matching engineers (${Math.round((count / baselineCount) * 100)}%) have ${skillName}`,
      });
    }
  }

  return suggestions;
}
```

**Delete** the following from `tightening-generator.service.ts`:
- `ExtractedSkillsFromDecomposed` interface (lines 526-529)
- `extractSkillsFromDecomposed` function (lines 531-555)
- `buildSkillParams` function (lines 557-574)

### Success Criteria

#### Automated Verification:
- [x] `npm run typecheck` passes
- [x] `npm test` passes
- [x] `npm run test:e2e` passes

#### Manual Verification:
- [ ] Grep `extractSkillsFrom` only finds `skill-extraction.utils.ts`
- [ ] Grep `resolveSkillIdsFromConstraints` finds no results
- [ ] Grep `buildSkillParams` finds no results in constraint-advisor

---

## Phase 4: Verify No Remaining Duplication

### Overview

Final verification that all duplication has been eliminated.

### Verification Commands

```bash
# Should only find skill-extraction.utils.ts
grep -r "extractSkillConstraints\|extractSkillsFrom\|resolveSkillIds" recommender_api/src --include="*.ts"

# Should only find search-query.builder.ts
grep -r "buildProficiencyQualificationClause\|learningLevelSkillIds.*THEN.*s.id" recommender_api/src --include="*.ts"

# Should find no results (deleted functions)
grep -r "buildSkillParams" recommender_api/src/services/constraint-advisor --include="*.ts"
```

### Success Criteria

#### Automated Verification:
- [x] All grep commands return expected results
- [x] `npm test` passes
- [x] `npm run test:e2e` passes

---

## Testing Strategy

### Unit Tests

The existing tests in these files should continue to pass without modification:
- `relaxation-generator.service.test.ts`
- `tightening-generator.service.test.ts`
- `constraint-advisor.service.test.ts`

No new unit tests needed since we're consolidating existing functionality, not adding new behavior.

### Integration Tests

Run the full E2E test suite to verify the refactored queries produce identical results.

---

## Summary of Files Changed

| File | Action |
|------|--------|
| `constraint-advisor/skill-extraction.utils.ts` | **CREATE** |
| `constraint-advisor/index.ts` | Add export |
| `cypher-query-builder/search-query.builder.ts` | Add `buildSkillDistributionQuery` |
| `cypher-query-builder/index.ts` | Add export |
| `constraint-advisor/relaxation-tester.service.ts` | Use shared utility, delete local copy |
| `constraint-advisor/tightening-tester.service.ts` | Use shared utility, delete local copy |
| `constraint-advisor/tightening-generator.service.ts` | Use shared utilities, delete local copies |

---

## References

- Duplicated code identified in conversation analysis
- `relaxation-tester.service.ts` as model for correct reuse pattern
- `buildProficiencyQualificationClause` as canonical proficiency logic
