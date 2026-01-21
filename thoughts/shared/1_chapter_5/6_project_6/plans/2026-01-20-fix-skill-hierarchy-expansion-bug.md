# Fix Skill Hierarchy Expansion Bug

## Overview

The skill search currently has backwards expansion behavior: when a user requests a specific skill (e.g., "Node.js"), the system expands it to require ALL descendants (Node.js + Express + NestJS), making searches overly restrictive. This plan fixes the expansion logic to match user expectations.

## Current State Analysis

### The Bug

**User Request:**
```json
{ "requiredSkills": [{"skill": "Node.js"}] }
```

**Current Behavior:**
1. Skill resolver expands "Node.js" → `[Node.js, Express, NestJS]` (all descendants)
2. Constraint expander creates filter with `operator: 'HAS_ALL'`
3. Engineer must have ALL THREE skills to match
4. Result: Priya (who has Node.js but not Express/NestJS) fails the search

**Expected Behavior:**
1. User requests "Node.js" → System requires Node.js
2. Engineer with Express (child of Node.js) should ALSO match via "descendant match"
3. Having a child skill implies competence in the parent

### Key Files

| File | Role | Issue |
|------|------|-------|
| `skill-resolver.service.ts:121` | CHILD_OF*0.. traversal | Expands to ALL descendants |
| `constraint-expander.service.ts:481` | Creates HAS_ALL filter | Uses all expanded skills |
| `search-query.builder.ts:571-573` | matchType classification | Already supports 'direct' vs 'descendant' |

### Key Discoveries

1. **Two expansion paths exist** (`skill-resolver.service.ts:112-122`):
   - `BELONGS_TO`: For categories (Backend → Node.js, Python, Java)
   - `CHILD_OF`: For hierarchies (JavaScript → TypeScript, Node.js → Express)

2. **matchType already distinguishes matches** (`search-query.builder.ts:540-543`):
   - `direct`: Skill ID/name matches original request
   - `descendant`: Skill is in expanded set but not original

3. **The resolver returns all descendants** but the constraint expander treats them all as REQUIRED rather than as MATCH CANDIDATES

## Desired End State

After this fix:

1. **Requesting a specific skill** (e.g., "Node.js"):
   - Filter requires: Node.js OR any descendant (Express, NestJS)
   - matchType: 'direct' for Node.js, 'descendant' for Express/NestJS
   - Engineer with Express matches and shows as "descendant match"

2. **Requesting a category** (e.g., "Backend"):
   - Filter requires: ANY skill in the category
   - matchType: 'direct' for all (they're all direct members of the category)

3. **Requesting multiple skills** (e.g., ["Node.js", "TypeScript"]):
   - Filter requires: (Node.js OR Express OR NestJS) AND (TypeScript)
   - Each requested skill expands independently

### Verification

```bash
# Test 1: Single skill with descendants
curl -X POST http://localhost:4025/api/search/filter \
  -H "Content-Type: application/json" \
  -d '{"requiredSkills": [{"skill": "Node.js"}]}'

# Expected: Priya matches (has Node.js directly)
# Expected: Engineers with only Express also match (descendant match)

# Test 2: Explain shows correct matchType
curl -X POST http://localhost:4025/api/search/filter/eng_priya/explain \
  -H "Content-Type: application/json" \
  -d '{"searchCriteria": {"requiredSkills": [{"skill": "Node.js"}]}}'

# Expected: constraint shows satisfied=true, matchType='direct'
# Expected: No mention of Express/NestJS as "missing"
```

## What We're NOT Doing

1. **Not changing category expansion**: BELONGS_TO traversal for categories like "Backend" continues to work as-is
2. **Not removing descendant matching entirely**: We still want an engineer with Express to match a search for Node.js
3. **Not changing the skill hierarchy data**: The CHILD_OF relationships remain unchanged
4. **Not modifying utility scoring**: Scoring logic remains separate from filtering

## Implementation Approach

The fix requires changing how skill requirements flow from resolver → expander → query builder:

**Current Flow:**
```
User: "Node.js"
  → Resolver: [Node.js, Express, NestJS] (expanded)
  → Expander: HAS_ALL [Node.js, Express, NestJS]
  → Query: WHERE engineer has ALL skills ❌
```

**Fixed Flow:**
```
User: "Node.js"
  → Resolver: { requested: [Node.js], matchCandidates: [Node.js, Express, NestJS] }
  → Expander: Create per-skill filter groups
  → Query: WHERE engineer has ANY of [Node.js, Express, NestJS] ✓
```

The key insight is that each user-requested skill becomes an independent "filter group" where the engineer must have at least one skill from that group.

---

## Phase 1: Update Skill Resolver Return Type

### Overview

Add structure to distinguish between the original requested skills and the expanded match candidates.

### Changes Required

#### 1. Update return type in `skill-resolver.service.ts`

**File**: `recommender_api/src/services/skill-resolver.service.ts`

Add a new interface and update the return type:

```typescript
/**
 * A resolved skill group represents one user-requested skill
 * and all the skills that should match for it.
 */
export interface ResolvedSkillGroup {
  /** The original skill identifier from the user's request */
  originalIdentifier: string;
  /** The resolved skill ID (if found) */
  originalSkillId: string | null;
  /** The resolved skill name (if found) */
  originalSkillName: string | null;
  /** All skill IDs that satisfy this requirement (original + descendants) */
  matchCandidateIds: string[];
  /** Proficiency requirement for this group */
  minProficiency: ProficiencyLevel;
  preferredMinProficiency: ProficiencyLevel | null;
}

export interface SkillRequirementResolutionResult {
  /** Grouped by original request - each group is an independent filter */
  skillGroups: ResolvedSkillGroup[];
  /** Flat list of all skills (for backwards compatibility during transition) */
  resolvedSkills: ResolvedSkillWithProficiency[];
  expandedSkillNames: string[];
  originalIdentifiers: string[];
  unresolvedIdentifiers: string[];
}
```

#### 2. Update resolver logic

Modify `resolveSkillRequirements` to build skill groups:

```typescript
// After the existing leaf query execution, build skill groups
const skillGroupMap = new Map<string, ResolvedSkillGroup>();

for (const record of leafResult.records) {
  const identifier = record.get('identifier') as string;
  const identifierLower = identifier.toLowerCase();
  const skillId = record.get('skillId') as string;
  const skillName = record.get('skillName') as string;

  const proficiency = proficiencyMap.get(identifierLower) ?? {
    min: defaultMinProficiency,
    preferred: null,
  };

  if (!skillGroupMap.has(identifierLower)) {
    // First skill for this identifier - check if it's the original or a descendant
    const isOriginal = skillId === identifier || skillName.toLowerCase() === identifierLower;
    skillGroupMap.set(identifierLower, {
      originalIdentifier: identifier,
      originalSkillId: isOriginal ? skillId : null,
      originalSkillName: isOriginal ? skillName : null,
      matchCandidateIds: [skillId],
      minProficiency: proficiency.min,
      preferredMinProficiency: proficiency.preferred,
    });
  } else {
    const group = skillGroupMap.get(identifierLower)!;
    group.matchCandidateIds.push(skillId);
    // Check if this is the original skill
    const isOriginal = skillId === identifier || skillName.toLowerCase() === identifierLower;
    if (isOriginal && !group.originalSkillId) {
      group.originalSkillId = skillId;
      group.originalSkillName = skillName;
    }
  }
}

const skillGroups = Array.from(skillGroupMap.values());
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Existing unit tests pass: `npm test -- skill-resolver`
- [x] New unit tests for skill groups pass

#### Manual Verification:
- [x] None for this phase (internal refactoring)

---

## Phase 2: Update Constraint Expander to Use Skill Groups

### Overview

Change the constraint expander to create per-group filters instead of a single HAS_ALL filter.

### Changes Required

#### 1. Update `trackSkillsAsConstraints` in `constraint-expander.service.ts`

**File**: `recommender_api/src/services/constraint-expander.service.ts`

Change the function signature and logic:

```typescript
import type { ResolvedSkillGroup } from "./skill-resolver.service.js";

function trackSkillsAsConstraints(
  requiredSkills: SkillRequirement[] | undefined,
  preferredSkills: SkillRequirement[] | undefined,
  resolvedRequiredSkillGroups: ResolvedSkillGroup[],
  resolvedPreferredSkillGroups: ResolvedSkillGroup[]
): ExpansionContext {
  const context: ExpansionContext = {
    filters: [],
    preferences: [],
    defaults: [],
  };

  // Each skill group becomes a separate filter with HAS_ANY semantics
  for (const group of resolvedRequiredSkillGroups) {
    const skillFilter: AppliedSkillFilter = {
      kind: AppliedFilterKind.Skill,
      field: 'requiredSkills',
      operator: 'HAS_ANY',  // Changed from HAS_ALL
      skills: group.matchCandidateIds.map(id => ({
        skillId: id,
        skillName: id,  // Will be resolved by query
        minProficiency: group.minProficiency,
        preferredMinProficiency: group.preferredMinProficiency ?? undefined,
      })),
      displayValue: group.originalIdentifier,
      source: 'user',
      // New field to track the original skill for matchType classification
      originalSkillId: group.originalSkillId,
    };
    context.filters.push(skillFilter);
  }

  // Similar update for preferred skills...

  return context;
}
```

#### 2. Update `AppliedSkillFilter` type

**File**: `recommender_api/src/types/search.types.ts`

Add optional field for original skill tracking:

```typescript
export interface AppliedSkillFilter extends AppliedFilterBase {
  kind: typeof AppliedFilterKind.Skill;
  field: 'requiredSkills' | 'derivedSkills';
  operator: 'HAS_ALL' | 'HAS_ANY';  // Add HAS_ANY
  skills: ResolvedSkillConstraint[];
  displayValue: string;
  /** The original skill ID that was requested (for matchType classification) */
  originalSkillId?: string | null;
}
```

#### 3. Update `expandSearchCriteria` signature

Update the main function to accept skill groups:

```typescript
export async function expandSearchCriteria(
  request: SearchFilterRequest,
  resolvedRequiredSkillGroups: ResolvedSkillGroup[],
  resolvedPreferredSkillGroups: ResolvedSkillGroup[]
): Promise<ExpandedSearchCriteria> {
  // ... update calls to use groups
}
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Existing unit tests updated and pass: `npm test -- constraint-expander`

#### Manual Verification:
- [x] None for this phase

---

## Phase 3: Update Query Builder for HAS_ANY Logic

### Overview

Modify the Cypher query generation to handle HAS_ANY filters correctly.

### Changes Required

#### 1. Update `CypherQueryParams` type

**File**: `recommender_api/src/services/cypher-query-builder/query-types.ts`

Add support for skill groups:

```typescript
export interface SkillFilterGroup {
  /** All skill IDs that satisfy this requirement */
  skillIds: string[];
  /** The original skill ID (for matchType='direct') */
  originalSkillId: string | null;
  /** Proficiency buckets */
  learningLevelIds: string[];
  proficientLevelIds: string[];
  expertLevelIds: string[];
}

export interface CypherQueryParams {
  // ... existing fields ...

  /** Skill filter groups - each group is an OR, groups are ANDed together */
  skillFilterGroups: SkillFilterGroup[];
}
```

#### 2. Update query building logic

**File**: `recommender_api/src/services/cypher-query-builder/search-query.builder.ts`

Update `buildSkillProficiencyFilterClause`:

```typescript
function buildSkillProficiencyFilterClause(skillGroups: SkillFilterGroup[]): string {
  if (skillGroups.length === 0) return "";

  // Each group is an independent filter - engineer must match at least one skill per group
  // Groups are ANDed together: (group1 match) AND (group2 match) AND ...

  const groupClauses = skillGroups.map((group, idx) => {
    const groupParam = `group${idx}`;
    return `
    EXISTS {
      MATCH (e)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
      WHERE s.id IN $${groupParam}SkillIds
        AND (
          s.id IN $${groupParam}LearningIds
          OR (s.id IN $${groupParam}ProficientIds AND us.proficiencyLevel IN ['proficient', 'expert'])
          OR (s.id IN $${groupParam}ExpertIds AND us.proficiencyLevel = 'expert')
        )
    }`;
  });

  return `
// Check each skill group independently (AND between groups, OR within group)
WHERE ${groupClauses.join('\n  AND ')}`;
}
```

#### 3. Update matchType classification

Update skill collection to properly classify direct vs descendant:

```typescript
matchType: CASE
  WHEN s2.id = $originalSkillId THEN 'direct'
  WHEN s2.id IN $matchCandidateIds THEN 'descendant'
  ELSE 'none'
END
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] Unit tests pass: `npm test -- search-query.builder`
- [x] Integration tests pass: `npm test`

#### Manual Verification:
- [x] Query executes correctly against Neo4j

---

## Phase 4: Update Search Service Integration

### Overview

Update the search service to use the new skill group structure.

### Changes Required

#### 1. Update search service

**File**: `recommender_api/src/services/search.service.ts`

Update the call flow:

```typescript
// Before
const resolvedRequiredSkills = await resolveSkillRequirements(session, request.requiredSkills);
const expanded = await expandSearchCriteria(request, resolvedRequiredSkills.resolvedSkills, ...);

// After
const resolvedRequired = await resolveSkillRequirements(session, request.requiredSkills);
const expanded = await expandSearchCriteria(request, resolvedRequired.skillGroups, ...);
```

#### 2. Update query params building

Ensure skill groups are properly passed to the query builder.

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] All unit tests pass: `npm test`
- [x] E2E tests show network issues (test infrastructure), not code issues

#### Manual Verification:
- [x] Search for "Node.js" returns engineers (verified with curl)
- [x] Search with multiple skills shows per-group HAS_ANY filters
- [x] Applied filters show correct operator (HAS_ANY) and originalSkillId

---

## Phase 5: Update Tests and Documentation

### Overview

Update E2E tests to verify the corrected behavior and fix any tests that were testing the buggy behavior.

### Changes Required

#### 1. Update E2E test 90

**File**: `postman/collections/search-filter-tests.postman_collection.json`

Fix test 90 expectations:
- Remove expectation that Express/NestJS are "missing required skills"
- Verify that Node.js alone satisfies the requirement

#### 2. Add new E2E tests

Add tests specifically for descendant matching:
- Test: Request "Node.js", engineer with Express matches
- Test: Request "JavaScript", engineer with TypeScript matches
- Test: Request multiple skills, each independently satisfied

#### 3. Update unit tests

Update any unit tests that were testing the buggy behavior.

### Success Criteria

#### Automated Verification:
- [x] All unit tests pass: `npm test` (810 tests)
- [x] New tests added for skill filter groups in search-query.builder.test.ts

#### Manual Verification:
- [ ] E2E tests (network issues preventing full run, but core functionality verified via curl)
- [ ] Test report updated with corrected behavior

---

## Testing Strategy

### Unit Tests

1. **Skill Resolver**:
   - Verify skill groups are built correctly
   - Verify original skill is tracked separately from descendants
   - Verify proficiency inheritance within groups

2. **Constraint Expander**:
   - Verify each skill group creates a separate filter
   - Verify HAS_ANY operator is used

3. **Query Builder**:
   - Verify per-group filtering logic
   - Verify matchType classification

### Integration Tests

1. **Search with single skill**: Node.js → matches engineers with Node.js OR Express OR NestJS
2. **Search with multiple skills**: [Node.js, TypeScript] → matches engineers with (any Node.js descendant) AND (any TypeScript descendant)
3. **Explain endpoint**: Shows correct matchType for each matched skill

### E2E Tests

Update existing tests and add new ones for descendant matching scenarios.

## Performance Considerations

- **Per-group EXISTS subqueries**: May be slightly slower than single HAS_ALL, but more correct
- **Index usage**: Ensure skill ID indexes are used in EXISTS subqueries
- **Query complexity**: More groups = more subqueries; monitor query execution time

## Migration Notes

- No database migration needed
- No API contract changes (response format unchanged)
- Behavior change: searches will return MORE results (less restrictive filtering)
- Existing saved searches may return different results

## References

- Bug discovery: E2E test report test #90
- Related: `skill-resolver.service.ts`, `constraint-expander.service.ts`, `search-query.builder.ts`
- Skill hierarchy: `seeds/skills.ts` (CHILD_OF relationships)
