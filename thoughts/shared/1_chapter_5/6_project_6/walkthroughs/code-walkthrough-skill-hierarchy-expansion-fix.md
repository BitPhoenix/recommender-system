# Code Walkthrough: Skill Hierarchy Expansion Bug Fix

## Summary

This implementation fixes a backwards skill expansion bug where requesting "Node.js" incorrectly required engineers to have ALL descendants (Node.js + Express + NestJS) instead of ANY matching skill. The fix introduces `ResolvedSkillRequirement` to track each user request independently, converts the filter operator from `HAS_ALL` to `HAS_ANY` within each group, and generates per-group Cypher conditions that are ANDed together. This enables proper descendant matching where an engineer with Express satisfies a request for Node.js.

**Follow-on work** unified derived skill filtering: inference-derived skills now go through the same hierarchy expansion and `skillFilterRequirements` mechanism as user-requested skills, eliminating the `HAS_ALL` operator entirely from the codebase.

**Narrative accuracy fixes** addressed two issues in the explain endpoint: (1) experience explanations now use raw 0-1 scores instead of weighted scores for correct reverse calculation, and (2) preferred skills tradeoffs now show the original user request count instead of the expanded skill count.

**Per-requirement preferred skill preferences** changed preferred skills handling to create one `AppliedSkillPreference` per requirement instead of flattening all preferred skills into a single preference. This makes the structure consistent with required skills and enables accurate tradeoff reporting with individual skill names.

**Code cleanup** removed unused parameters (`resolvedRequiredSkills`, `resolvedPreferredSkills`) from `expandSearchCriteria` and refactored `buildSkillFilterCountQuery`/`buildSkillDistributionQuery` to share common logic via `buildSkillFilterBase`.

## Learning Path Overview

```
Phase 1: Entry Points & Data Flow
├── 1.1 Type Definitions (query-types.ts)
├── 1.2 Applied Filter Types (search.types.ts)
└── 1.3 Search Service Orchestration (search.service.ts)

Phase 2: Core Resolution & Expansion Logic
├── 2.1 Skill Resolver - Requirement Building (skill-resolver.service.ts)
├── 2.2 Constraint Expander - Filter Creation (constraint-expander.service.ts)
├── 2.3 Derived Skill Hierarchy Expansion (constraint-expander.service.ts)
└── 2.4 Query Builder - Cypher Generation (search-query.builder.ts)

Phase 3: Unified Constraint Advisor Pattern
├── 3.1 Skill Extraction Utility (skill-extraction.utils.ts)
├── 3.2 Count/Distribution Query Builders (search-query.builder.ts)
├── 3.3 Tightening Tester Service (tightening-tester.service.ts)
├── 3.4 Relaxation Tester Service (relaxation-tester.service.ts)
└── 3.5 Tightening Generator Service (tightening-generator.service.ts)

Phase 4: Testing & Verification
├── 4.1 Query Builder Tests (search-query.builder.test.ts)
├── 4.2 Constraint Expander Tests (constraint-expander.service.test.ts)
└── 4.3 Skill Resolver Tests (skill-resolver.service.test.ts)

Phase 5: Per-Requirement Preferred Skill Preferences
└── 5.1 Constraint Expander - Preference Creation (constraint-expander.service.ts)

Phase 6: Code Cleanup & Refactoring
├── 6.1 Remove Unused Parameters (constraint-expander.service.ts)
└── 6.2 Extract Shared Skill Filter Logic (search-query.builder.ts)
```

---

## Phase 1: Entry Points & Data Flow

Understanding the data structures and how they flow through the system.

### 1.1 Type Definitions: SkillFilterRequirement (formerly SkillFilterGroup)

**File:** `recommender_api/src/services/cypher-query-builder/query-types.ts`

This file defines the core data structure that enables per-group filtering. Read this first to understand what data the query builder needs.

**Read in Order:**
1. **Lines 13-17:** `SkillProficiencyGroups` (flat buckets) - Legacy structure grouping skills by proficiency level. Still used for proficiency checking.
   - Key fields: `learningLevelSkillIds`, `proficientLevelSkillIds`, `expertLevelSkillIds`

2. **Lines 32-48:** `SkillFilterRequirement` (new structure) - Represents one user-requested skill with all its descendants
   - `expandedSkillIds: string[]` - All skill IDs that satisfy this requirement
   - `originalSkillId: string | null` - The specific skill requested (for matchType='direct')
   - `minProficiency: string` - Required proficiency for this group
   - `type: SkillFilterType` - `SkillFilterType.User` for proficiency-qualified check, `SkillFilterType.Derived` for existence-only check

3. **Lines 50-59:** `CypherQueryParams.skillFilterRequirements` - Array enabling per-group HAS_ANY filtering
   - Each group becomes a separate condition in the WHERE clause
   - Required when skill filtering is active

**Key Concept:** Each `SkillFilterRequirement` maps to one user request OR one derived skill from inference. Multiple groups are ANDed together in the WHERE clause, while skills within a group use OR semantics. The `type` field determines whether proficiency checking applies (`SkillFilterType.User` = yes, `SkillFilterType.Derived` = no).

---

### 1.2 Applied Filter Types: HAS_ANY Operator

**File:** `recommender_api/src/types/search.types.ts`

This file defines the discriminated union for applied filters. The fix removes `HAS_ALL` entirely - all skill filters now use `HAS_ANY`.

**Read in Order:**
1. **Lines 35-40:** `AppliedFilterType` (enum) - Discriminators for the union types
   - `Property` = standard constraints (salary, timezone)
   - `Skill` = skill-based constraints with full skill data
   - Note: Renamed from `AppliedFilterKind` to `AppliedFilterType`

2. **Lines 42-50:** `AppliedPreferenceType` (enum) - Discriminators for preference types
   - Same structure as filter types
   - Note: Renamed from `AppliedPreferenceKind` to `AppliedPreferenceType`

3. **Lines 52-61:** `SkillFilterType` (enum) - Type discriminator for skill filter groups
   - `SkillFilterType.User` (`'user'`) - proficiency-qualified check (must meet minProficiency)
   - `SkillFilterType.Derived` (`'derived'`) - existence-only check (any proficiency level qualifies)

4. **Lines 238-247:** `AppliedUserSkillFilter` (discriminated union variant)
   - `type: AppliedFilterType.Skill` - Changed from `kind` to `type`
   - `operator: 'HAS_ANY'` - Changed from `'HAS_ALL' | 'HAS_ANY'` to just `'HAS_ANY'`
   - `originalSkillId?: string | null` - Tracks which skill was originally requested
   - This is the key type change enabling descendant matching

5. **Lines 249-260:** `AppliedDerivedSkillFilter` - For inference-derived skills
   - `type: AppliedFilterType.Skill` - Changed from `kind` to `type`
   - `operator: 'HAS_ANY'` - **CHANGED**: was `'HAS_ALL'`, now unified to `'HAS_ANY'`
   - `originalSkillId?: string | null` - tracks original skill for hierarchy expansion
   - `ruleId: string` - Identifies the inference rule that added this constraint

6. **Lines 614-636:** Type guards - `isSkillFilter()`, `isUserSkillFilter()`, `isDerivedSkillFilter()` for safe narrowing
   - Now use `.type` property instead of `.kind`

**Key Concept:** All skill filters now use `HAS_ANY` operator (one match required). The `originalSkillId` enables matchType classification and hierarchy expansion tracking. `HAS_ALL` has been completely removed from the type system. Property name standardized from `kind` to `type` throughout.

---

### 1.3 Search Service Orchestration

**File:** `recommender_api/src/services/search.service.ts`

The search service orchestrates the pipeline. Understanding this shows how skill groups flow from resolution to query building.

**Read in Order:**
1. **Lines 52-70:** Skill resolution call - Destructures `resolvedRequiredSkillRequirements` and `resolvedPreferredSkillRequirements`
   - These are the new skill group arrays from the resolver
   - Also extracts `skillGroups` (flat proficiency buckets) for backwards compat

2. **Lines 72-80:** Constraint expansion call - Passes skill groups to expander
   - Signature changed: now takes `resolvedRequiredSkillRequirements` and `resolvedPreferredSkillRequirements`
   - Expander now receives Neo4j session for derived skill hierarchy expansion

3. **Lines 101-113:** Building `skillFilterRequirements` - Maps resolver output to query format
   ```typescript
   const skillFilterRequirements: SkillFilterRequirement[] = resolvedRequiredSkillRequirements.map(group => ({
     expandedSkillIds: group.expandedSkillIds,
     originalSkillId: group.originalSkillId,
     minProficiency: group.minProficiency,
     preferredMinProficiency: group.preferredMinProficiency,
   }));
   ```

4. **Lines 115-122:** Derived skill groups - **NEW**: Builds groups from derived skill filters
   ```typescript
   const derivedSkillFilterRequirements: SkillFilterRequirement[] = expanded.appliedFilters
     .filter(isDerivedSkillFilter)
     .map(filter => ({
       expandedSkillIds: filter.skills.map(s => s.skillId),
       originalSkillId: filter.originalSkillId ?? null,
       minProficiency: 'learning',  // Existence-only
       type: SkillFilterType.Derived,
     }));
   ```

5. **Lines 125-130:** Unified groups - Combines user and derived groups
   ```typescript
   const skillFilterRequirements = [...userSkillFilterRequirements, ...derivedSkillFilterRequirements];
   ```

**Key Concept:** The search service is the glue - it takes skill groups from the resolver, passes them through the expander for AppliedFilter creation, then converts both user and derived skill filters to query-builder format with the unified `skillFilterRequirements` array. User groups have `type: SkillFilterType.User`, derived groups have `type: SkillFilterType.Derived`.

---

## Phase 2: Core Resolution & Expansion Logic

The heart of the fix: how skill groups are built and converted to filters.

### 2.1 Skill Resolver: Building Skill Requirements

**File:** `recommender_api/src/services/skill-resolver.service.ts`

This is where user requests like "Node.js" become skill groups with expanded descendants.

**Read in Order:**
1. **Lines 36-61:** `ResolvedSkillRequirement` interface - The core data structure
   ```typescript
   interface ResolvedSkillRequirement {
     originalIdentifier: string;    // What user typed: "Node.js"
     originalSkillId: string | null; // skill_nodejs (if found)
     originalSkillName: string | null; // "Node.js"
     expandedSkillIds: string[];   // [skill_nodejs, skill_express, skill_nestjs]
     minProficiency: ProficiencyLevel;
     preferredMinProficiency: ProficiencyLevel | null;
   }
   ```

2. **Lines 63-71:** `SkillRequirementResolutionResult` - Now includes `skillRequirements: ResolvedSkillRequirement[]`

3. **Lines 136-163:** Cypher leaf query - Expands via BELONGS_TO and CHILD_OF relationships
   - BELONGS_TO: category membership (Backend → Node.js)
   - CHILD_OF*0..: hierarchy (JavaScript → TypeScript, Node.js → Express)
   - Returns `{identifier, skillId, skillName}` rows

4. **Lines 210-218:** Skill group map initialization
   ```typescript
   const skillRequirementMap = new Map<string, ResolvedSkillRequirement>();
   ```

5. **Lines 220-289:** Processing loop - Builds groups from query results
   - Line 265: `isOriginalSkill` check - determines if this is a direct match
   - Lines 267-288: Group building logic
     - First skill for identifier: create new group
     - Subsequent skills: add to `expandedSkillIds`

6. **Lines 291-293:** Converting map to array
   ```typescript
   const skillRequirements = Array.from(skillRequirementMap.values());
   ```

**Key Concept:** The resolver traverses the skill graph to find all descendants, then groups them by the original request identifier. This preserves the user's intent (each request = one group) while expanding matches.

---

### 2.2 Constraint Expander: Creating HAS_ANY Filters

**File:** `recommender_api/src/services/constraint-expander.service.ts`

Converts skill groups into `AppliedSkillFilter` entries with the correct operator.

**Read in Order:**
1. **Lines 466-477:** Function JSDoc - Explains HAS_ANY semantics
   - User requests "Node.js" → Filter with HAS_ANY of [node, express, nestjs]
   - Multiple groups are ANDed

2. **Lines 478-481:** `trackSkillsAsConstraints` signature - Accepts resolved skill requirements
   ```typescript
   function trackSkillsAsConstraints(
     resolvedRequiredSkillRequirements: ResolvedSkillRequirement[],
     resolvedPreferredSkillRequirements: ResolvedSkillRequirement[]
   ): ExpansionContext
   ```

3. **Lines 490-513:** Required skills loop - Creates one filter per group
   - Line 505: `operator: 'HAS_ANY'` - The key change from HAS_ALL
   - Line 510: `originalSkillId: requirement.originalSkillId` - For matchType

4. **Lines 515-537:** Preferred skills handling - Creates one preference per requirement

**Key Concept:** Each skill requirement becomes a separate filter or preference. The operator is HAS_ANY because an engineer only needs one skill from each group. Multiple groups create multiple entries, which are implicitly ANDed for filters. Preferred skills now also create separate preferences per requirement for accurate tradeoff reporting.

---

### 2.3 Derived Skill Hierarchy Expansion

**File:** `recommender_api/src/services/constraint-expander.service.ts`

**NEW SECTION**: Derived skills from inference rules now go through hierarchy expansion.

**Read in Order:**
1. **Lines 120-127:** Updated `expandSearchCriteria` signature - Now accepts Neo4j session
   ```typescript
   export async function expandSearchCriteria(
     session: Session,  // Needed for hierarchy expansion
     request: SearchFilterRequest,
     resolvedRequiredSkillRequirements: ResolvedSkillRequirement[],
     resolvedPreferredSkillRequirements: ResolvedSkillRequirement[]
   ): Promise<ExpandedSearchCriteria>
   ```
   Note: Previously had unused `resolvedRequiredSkills` and `resolvedPreferredSkills` parameters which have been removed.

2. **Lines 184-221:** Inference constraint processing loop
   - Lines 199-212: **NEW**: Derived skill hierarchy expansion
     ```typescript
     for (const skillId of skillIds) {
       const expandedSkills = await expandSkillHierarchy(session, skillId);

       inferenceContext.filters.push({
         type: AppliedFilterType.Skill,
         field: 'derivedSkills',
         operator: 'HAS_ANY',  // Changed from HAS_ALL
         skills: expandedSkills.map(s => ({ skillId: s.skillId, skillName: s.skillName })),
         displayValue: `Derived: ${derivedConstraint.rule.name}`,
         source: 'inference',
         ruleId: derivedConstraint.rule.id,
         originalSkillId: skillId,  // Track original for debugging
       });
     }
     ```

3. **Lines 608-630:** `expandSkillHierarchy` helper - Queries Neo4j for descendants
   ```typescript
   async function expandSkillHierarchy(session: Session, skillId: string): Promise<string[]> {
     const result = await session.run(`
       MATCH (root:Skill {id: $skillId})
       OPTIONAL MATCH (descendant:Skill)-[:CHILD_OF*0..]->(root)
       WHERE descendant.isCategory = false
       RETURN COLLECT(DISTINCT descendant.id) AS descendantIds
     `, { skillId });
     // ...
   }
   ```

**Key Concept:** Derived skills now use the same hierarchy expansion as user skills. If an inference rule derives "Node.js" requirement, engineers with Express (a descendant) will now match. This fixes the inconsistency where user skills got expansion but derived skills did not.

---

### 2.4 Query Builder: Cypher Generation

**File:** `recommender_api/src/services/cypher-query-builder/search-query.builder.ts`

Generates the Cypher that implements per-group filtering.

**Read in Order:**
1. **Lines 67-114:** `buildFilterClauses` - Centralized filter building
   - Lines 78-79: **NEW**: Checks for derived skill filters
     ```typescript
     const hasDerivedSkillFilter = (params.skillFilterRequirements ?? []).some(g => g.type === 'derived');
     const hasSkillFilter = allSkillIds.length > 0 || hasDerivedSkillFilter;
     ```

2. **Lines 230-246:** `getAllSkillIds` - **UPDATED**: Includes derived skill IDs
   ```typescript
   const derivedSkillIds = (params.skillFilterRequirements ?? [])
     .filter(g => g.type === 'derived')
     .flatMap(g => g.expandedSkillIds);
   return [...proficiencyBucketSkills, ...derivedSkillIds];
   ```

3. **Lines 463-487:** `addSkillQueryParams` - Adds per-group parameters
   ```typescript
   if (params.skillFilterRequirements) {
     for (let i = 0; i < params.skillFilterRequirements.length; i++) {
       queryParams[`skillGroup${i}`] = params.skillFilterRequirements[i].expandedSkillIds;
     }
     queryParams.skillGroupCount = params.skillFilterRequirements.length;
   }
   ```

4. **Lines 519-554:** `buildSkillProficiencyFilterClause` - Core filter generation
   - Lines 527-546: Per-group filtering logic
     ```typescript
     for (let i = 0; i < skillFilterRequirements.length; i++) {
       const group = skillFilterRequirements[i];

       if (group.type === 'derived') {
         // Existence-only check for derived skills (any proficiency)
         groupConditions.push(`SIZE([x IN allEngineerSkillIds WHERE x IN $skillGroup${i}]) > 0`);
       } else {
         // Proficiency-qualified check for user skills
         groupConditions.push(`SIZE([x IN qualifyingSkillIds WHERE x IN $skillGroup${i}]) > 0`);
       }
     }
     ```
   - Lines 548-554: Combines conditions with AND
     ```cypher
     WHERE ${groupConditions.join('\n  AND ')}
     ```

**Key Concept:** The query checks each group independently using `SIZE([...]) > 0` (HAS_ANY). Groups are ANDed with multiple WHERE clauses. Derived skills (`type: 'derived'`) use `allEngineerSkillIds` (existence-only), while user skills (`type: 'user'`) use `qualifyingSkillIds` (proficiency-checked). The `qualifyingSkillIds` collection is reused for scoring.

---

## Phase 3: Unified Constraint Advisor Pattern

The constraint advisor services (relaxation, tightening) were refactored to use the same `skillFilterRequirements` mechanism.

### 3.1 Skill Extraction Utility

**File:** `recommender_api/src/services/constraint-advisor/skill-extraction.utils.ts`

**REFACTORED**: Now returns unified `SkillFilterRequirement[]` instead of separate arrays.

**Read in Order:**
1. **Lines 15-18:** `ExtractedSkillConstraints` interface - Returns unified groups
   ```typescript
   export interface ExtractedSkillConstraints {
     /** Unified skill filter groups (both user and derived) */
     skillFilterRequirements: SkillFilterRequirement[];
   }
   ```

2. **Lines 28-32:** `extractSkillConstraints` - Delegates to array extraction
   ```typescript
   export function extractSkillConstraints(
     decomposed: DecomposedConstraints
   ): ExtractedSkillConstraints {
     return extractSkillConstraintsFromArray(decomposed.constraints);
   }
   ```

3. **Lines 38-75:** `extractSkillConstraintsFromArray` - Builds unified groups
   - Lines 46-54: User skill constraints → groups with `type: 'user'`
   - Lines 55-70: Derived skill constraints → groups with `type: 'derived'`
   ```typescript
   if (constraint.field === 'requiredSkills' && isUserSkillConstraint(constraint)) {
     skillFilterRequirements.push({
       expandedSkillIds: [skillReq.skill],
       originalSkillId: skillReq.skill,
       minProficiency: skillReq.minProficiency ?? 'learning',
       preferredMinProficiency: null,
       type: 'user',
     });
   } else if (constraint.field === 'derivedSkills' && isDerivedSkillConstraint(constraint)) {
     skillFilterRequirements.push({
       expandedSkillIds: uniqueSkillIds,
       originalSkillId: uniqueSkillIds[0],
       minProficiency: 'learning', // Existence-only
       preferredMinProficiency: null,
       type: 'derived',
     });
   }
   ```

**Key Concept:** Single source of truth for skill extraction from decomposed constraints. Returns unified `SkillFilterRequirement[]` matching the main search query pattern.

---

### 3.2 Count/Distribution Query Builders

**File:** `recommender_api/src/services/cypher-query-builder/search-query.builder.ts`

**REFACTORED**: Query builders now accept `SkillFilterRequirement[]` and share common logic via `buildSkillFilterBase`.

**Read in Order:**
1. **Lines 273-297:** `groupSkillsByProficiencyFromRequirements` - Converts requirements to proficiency buckets
   ```typescript
   function groupSkillsByProficiencyFromRequirements(
     skillFilterRequirements: SkillFilterRequirement[]
   ): { learningLevelSkillIds: string[]; proficientLevelSkillIds: string[]; expertLevelSkillIds: string[] }
   ```

2. **Lines 299-360:** `buildSkillFilterBase` - **NEW**: Shared helper for skill filter queries
   ```typescript
   interface SkillFilterBase {
     params: Record<string, unknown>;
     allUserSkillIds: string[];
     allSkillIds: string[];
     propertyWhereClause: string;
     derivedSkillExistenceClause: string;
   }

   function buildSkillFilterBase(
     skillFilterRequirements: SkillFilterRequirement[],
     propertyConditions: { whereClauses: string[]; params: Record<string, unknown> },
     extraParams: Record<string, unknown> = {}
   ): SkillFilterBase
   ```

3. **Lines 370-401:** `buildSkillFilterCountQuery` - Uses `buildSkillFilterBase`
   ```typescript
   export function buildSkillFilterCountQuery(
     skillFilterRequirements: SkillFilterRequirement[],
     propertyConditions: { whereClauses: string[]; params: Record<string, unknown> }
   ): CypherQuery {
     const base = buildSkillFilterBase(skillFilterRequirements, propertyConditions);
     // ~15 lines for count-specific logic
   }
   ```

4. **Lines 403-460:** `buildSkillDistributionQuery` - Also uses `buildSkillFilterBase`
   ```typescript
   export function buildSkillDistributionQuery(
     skillFilterRequirements: SkillFilterRequirement[],
     propertyConditions: { whereClauses: string[]; params: Record<string, unknown> },
     limit: number = 10
   ): CypherQuery {
     const base = buildSkillFilterBase(skillFilterRequirements, propertyConditions, { distributionLimit: limit });
     // ~25 lines for distribution-specific logic
   }
   ```

**Key Concept:** Both count and distribution query builders share ~40 lines of common logic (separating user/derived requirements, building proficiency buckets, constructing params, building WHERE clauses) via `buildSkillFilterBase`. This eliminates duplication and ensures consistent behavior.

---

### 3.3 Tightening Tester Service

**File:** `recommender_api/src/services/constraint-advisor/tightening-tester.service.ts`

**REFACTORED**: Uses unified `skillFilterRequirements` pattern.

**Read in Order:**
1. **Lines 34-41:** `CountQueryContext` interface - Uses unified groups
   ```typescript
   interface CountQueryContext {
     propertyConditions: { whereClauses: string[]; params: Record<string, unknown> };
     skillFilterRequirements: SkillFilterRequirement[];  // Unified groups
     baseMatchClause: string;
   }
   ```

2. **Lines 91-97:** `testTightenedPropertyValue` - Extracts unified groups
   ```typescript
   const { skillFilterRequirements } = extractSkillConstraints(decomposedConstraints);
   return runCountQuery(session, {
     propertyConditions,
     skillFilterRequirements,
     baseMatchClause: decomposedConstraints.baseMatchClause,
   });
   ```

3. **Lines 141-175:** `testAddedSkillConstraint` - Adds new group to unified array
   ```typescript
   const allGroups: SkillFilterRequirement[] = [
     ...skillFilterRequirements,
     {
       expandedSkillIds: [newSkillId],
       originalSkillId: newSkillId,
       minProficiency: newSkillMinProficiency,
       preferredMinProficiency: null,
       type: 'user',
     },
   ];
   ```

4. **Lines 232-261:** `runCountQuery` - Central decision point
   - If skills exist → `buildSkillFilterCountQuery` → skill-aware Cypher
   - If no skills → simple property-only Cypher

**Key Concept:** All tester functions prepare a `CountQueryContext` with unified `skillFilterRequirements` and delegate to `runCountQuery` for the skill-aware vs property-only decision. New groups use `type: 'user'` since they're user-added skill requirements.

---

### 3.4 Relaxation Tester Service

**File:** `recommender_api/src/services/constraint-advisor/relaxation-tester.service.ts`

**REFACTORED**: Uses unified `skillFilterRequirements` for skill relaxation testing.

**Read in Order:**
1. **Lines 63-103:** `testSkillRelaxation` - Modifies proficiency in unified groups
   ```typescript
   export async function testSkillRelaxation(
     session: Session,
     decomposedConstraints: DecomposedConstraints,
     constraint: UserSkillConstraint,
     modifiedSkill: { skill: string; minProficiency?: ProficiencyLevel }
   ): Promise<number> {
     // Extract unified skill filter groups
     const { skillFilterRequirements } = extractSkillConstraintsFromArray(decomposedConstraints.constraints);

     // Modify the proficiency for the target skill
     const modifiedGroups = skillFilterRequirements.map(group => {
       if (group.type === 'user' && group.originalSkillId === constraint.value.skill) {
         return { ...group, minProficiency: newProficiency };
       }
       return group;
     });

     // Build count query using unified groups
     const { query, params } = buildSkillFilterCountQuery(modifiedGroups, propertyConditions);
     // ...
   }
   ```

**Key Concept:** Skill relaxation testing modifies the proficiency of a specific group within the unified array, then runs a count query with the modified groups. Only user groups (`type: 'user'`) can have their proficiency relaxed.

---

### 3.5 Tightening Generator Service

**File:** `recommender_api/src/services/constraint-advisor/tightening-generator.service.ts`

**REFACTORED**: Uses unified `skillFilterRequirements` for distribution queries.

**Read in Order:**
1. **Lines 429-448:** `generateSkillTighteningSuggestions` - Extracts unified groups
   ```typescript
   // Extract unified skill filter groups
   const { skillFilterRequirements } = extractSkillConstraints(decomposed);

   // Build and run distribution query using unified groups
   const { query: distributionQuery, params: distributionParams } =
     buildSkillDistributionQuery(
       skillFilterRequirements,
       propertyConditions
     );
   ```

**Key Concept:** The tightening generator uses the unified `skillFilterRequirements` pattern to find skill distribution among matching engineers, enabling accurate "add this skill" suggestions.

---

## Phase 4: Testing & Verification

### 4.1 Query Builder Tests

**File:** `recommender_api/src/services/cypher-query-builder/search-query.builder.test.ts`

New tests verify per-group filtering behavior.

**Key Tests:**
- "generates per-requirement filtering when skillFilterRequirements provided"
- "uses HAS_ANY semantics within each group"
- "ANDs multiple groups together"
- "handles derived skill groups with existence-only check"
- "falls back when no skillFilterRequirements"

---

### 4.2 Constraint Expander Tests

**File:** `recommender_api/src/services/constraint-expander.service.test.ts`

Tests verify HAS_ANY operator and per-group filter creation.

**Key Tests:**
- `creates AppliedSkillFilter with resolved skill data` - Verifies HAS_ANY operator
- `creates separate filters for each skill group with HAS_ANY` - Verifies multiple groups create multiple filters
- `expands derived skill hierarchy for inference-derived requirements` - Verifies hierarchy expansion
- `creates separate preferences for each preferred skill requirement` - Verifies per-requirement preferences

---

### 4.3 Skill Resolver Tests

**File:** `recommender_api/src/services/skill-resolver.service.test.ts`

Tests verify skill requirement building from resolver.

**Key Tests:**
- Existing tests pass - the resolver now returns additional `skillRequirements` field
- Backwards compatible - `resolvedSkills` flat list still works

---

## Phase 5: Per-Requirement Preferred Skill Preferences

### 5.1 Constraint Expander: Per-Requirement Preferences

**File:** `recommender_api/src/services/constraint-expander.service.ts`

Changed preferred skills handling to create one `AppliedSkillPreference` per requirement instead of flattening all preferred skills into a single preference.

**Read in Order:**
1. **Lines 528-550:** Preferred skills loop - Now creates one preference per requirement
   ```typescript
   /*
    * Each preferred skill requirement becomes a separate preference.
    * This matches required skills pattern and enables accurate requirement counting.
    * Preferences boost ranking when engineers have matching skills.
    */
   for (const requirement of resolvedPreferredSkillRequirements) {
     const skills: ResolvedSkillConstraint[] = requirement.expandedSkillIds.map(skillId => ({
       skillId,
       skillName: requirement.skillIdToName.get(skillId) ?? skillId,
       minProficiency: requirement.minProficiency,
       preferredMinProficiency: requirement.preferredMinProficiency ?? undefined,
     }));

     const skillPreference: AppliedSkillPreference = {
       type: AppliedPreferenceType.Skill,
       field: 'preferredSkills',
       skills,
       displayValue: requirement.originalIdentifier,  // Individual skill name, not joined
       source: 'user',
     };
     context.preferences.push(skillPreference);
   }
   ```

**Key Changes:**
- Removed `preferredSkills` parameter from `trackSkillsAsConstraints` signature
- Removed unused `formatSkillSummary` helper function
- Each preference now has `displayValue` set to the original identifier (e.g., "Python") instead of joined names (e.g., "Python, Java")
- Downstream consumers (tradeoff detection) now correctly report individual skill names

**Benefits:**
1. Consistent with required skills pattern (one filter/preference per requirement)
2. Tradeoff explanation shows "Missing preferred skills: Kubernetes, AWS" instead of flattened count
3. API response `appliedPreferences` shows separate entries for each preferred skill

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API Request                                        │
│  { requiredSkills: [{ skill: "Node.js" }, { skill: "TypeScript" }],         │
│    teamFocus: "scaling" }  // triggers inference rule                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    search.service.ts:52-70                                   │
│                                                                              │
│  resolveAllSkills() → skill-resolution.service.ts                           │
│    └── resolveSkillRequirements() → skill-resolver.service.ts               │
│                                                                              │
│  Output: {                                                                   │
│    resolvedRequiredSkillRequirements: [                                           │
│      { originalIdentifier: "Node.js", expandedSkillIds: [node, express] }, │
│      { originalIdentifier: "TypeScript", expandedSkillIds: [ts] },         │
│    ]                                                                         │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 constraint-expander.service.ts:132-260                       │
│                                                                              │
│  expandSearchCriteria(session, ...)                                         │
│                                                                              │
│  1. trackSkillsAsConstraints(resolvedRequiredSkillRequirements) → User filters:   │
│     [                                                                        │
│       { operator: 'HAS_ANY', skills: [node, express], originalSkillId: node }, │
│       { operator: 'HAS_ANY', skills: [ts], originalSkillId: ts },           │
│     ]                                                                        │
│                                                                              │
│  2. runInference() + expandSkillHierarchy() → Derived filters:              │
│     [                                                                        │
│       { operator: 'HAS_ANY', skills: [distributed, monitoring, ...],        │
│         isDerived: true, ruleId: 'scaling-rule' },                          │
│     ]                                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    search.service.ts:101-130                                 │
│                                                                              │
│  Build unified CypherQueryParams.skillFilterRequirements:                         │
│  [                                                                           │
│    { expandedSkillIds: [node, express], originalSkillId: node, type: 'user' },      │
│    { expandedSkillIds: [ts], originalSkillId: ts, type: 'user' },                   │
│    { expandedSkillIds: [distributed, ...], originalSkillId: distributed, type: 'derived' }, │
│  ]                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               search-query.builder.ts:463-554                                │
│                                                                              │
│  addSkillQueryParams():                                                      │
│    $skillGroup0 = [node, express]                                           │
│    $skillGroup1 = [ts]                                                      │
│    $skillGroup2 = [distributed, ...]                                        │
│                                                                              │
│  buildSkillProficiencyFilterClause():                                       │
│    // User skills (type='user'): proficiency-qualified check                │
│    WHERE SIZE([x IN qualifyingSkillIds WHERE x IN $skillGroup0]) > 0        │
│      AND SIZE([x IN qualifyingSkillIds WHERE x IN $skillGroup1]) > 0        │
│      // Derived skills (type='derived'): existence-only check               │
│      AND SIZE([x IN allEngineerSkillIds WHERE x IN $skillGroup2]) > 0       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Cypher Execution                                     │
│                                                                              │
│  Engineer matches if:                                                        │
│    (has Node.js OR Express at proficiency)                                  │
│    AND (has TypeScript at proficiency)                                       │
│    AND (has distributed OR monitoring, any proficiency)                     │
│                                                                              │
│  = HAS_ANY within each group, AND between groups                            │
│  = type='derived' groups use existence-only (no proficiency check)          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Reference Tables

### Test Files

| Test File | Test Count | Focus Area |
|-----------|------------|------------|
| `skill-resolver.service.test.ts` | 13 | Skill expansion, requirement building |
| `constraint-expander.service.test.ts` | 59 | Filter creation, HAS_ANY operator, derived expansion, per-requirement preferences |
| `search-query.builder.test.ts` | 42 | Cypher generation, per-group filtering, derived skill handling |
| `search.service.test.ts` | 47 | Integration, orchestration |
| `skill-resolution.service.test.ts` | 10 | Resolution orchestration |
| `tightening-tester.service.test.ts` | ~15 | Unified skillFilterRequirements pattern |
| `relaxation-tester.service.test.ts` | ~12 | Skill relaxation with unified groups |
| `tightening-generator.service.test.ts` | ~25 | Distribution queries with unified groups |

**Total: 816 tests passing**

### Type Registries

| Type | Location | Purpose |
|------|----------|---------|
| `ResolvedSkillRequirement` | `skill-resolver.service.ts:36-61` | Per-request skill expansion data |
| `SkillFilterRequirement` | `query-types.ts:32-48` | Query-builder format for groups (includes `type: SkillFilterType`) |
| `SkillFilterType` | `search.types.ts:52-58` | `'user' | 'derived'` discriminator |
| `AppliedFilterType` | `search.types.ts:35-40` | Renamed from `AppliedFilterKind` |
| `AppliedPreferenceType` | `search.types.ts:42-50` | Renamed from `AppliedPreferenceKind` |
| `AppliedUserSkillFilter.operator` | `search.types.ts:241` | `'HAS_ANY'` (HAS_ALL removed) |
| `AppliedDerivedSkillFilter.operator` | `search.types.ts:252` | `'HAS_ANY'` (was HAS_ALL) |
| `AppliedUserSkillFilter.originalSkillId` | `search.types.ts:246` | For matchType classification |
| `AppliedDerivedSkillFilter.originalSkillId` | `search.types.ts:259` | For hierarchy expansion tracking |
| `ExtractedSkillConstraints` | `skill-extraction.utils.ts:15-18` | Unified skill filter groups extraction |
| `CountQueryContext` | `tightening-tester.service.ts:34-41` | Unified context for count queries |
| `RawCoreScores` | `search.types.ts` | Pre-weighted 0-1 normalized scores for explanation |
| `ScoreBreakdown.rawScores` | `search.types.ts` | Optional raw scores field for reverse calculation |

---

## Plan vs Implementation

| Plan Phase | Status | Notes |
|------------|--------|-------|
| **Original: Fix Skill Hierarchy Expansion** | | |
| Phase 1: Update Skill Resolver Return Type | ✅ Complete | Added `ResolvedSkillRequirement` interface and `skillRequirements` array |
| Phase 2: Update Constraint Expander | ✅ Complete | Changed operator to HAS_ANY, added `originalSkillId` field |
| Phase 3: Update Query Builder | ✅ Complete | Generates per-group filtering with `$skillGroupN` params |
| Phase 4: Update Search Service Integration | ✅ Complete | Passes skill groups through pipeline |
| Phase 5: Update Tests | ✅ Complete | Added tests for skill filter groups |
| **Follow-on 1: Remove HAS_ALL, Unify Skill Filtering** | | |
| Phase 1: Update Type System | ✅ Complete | Removed `HAS_ALL` from type union |
| Phase 2: Derived Skill Hierarchy Expansion | ✅ Complete | `expandSkillHierarchy()` for inference skills |
| Phase 3: Update Query Builder for Derived | ✅ Complete | `type: SkillFilterType` discriminator, existence-only checks |
| Phase 4: Bug Fixes | ✅ Complete | Fixed hasSkillFilter, filter-similarity, E2E test data |
| Phase 5: Tests | ✅ Complete | 816 unit tests, 321 E2E assertions passing |
| **Follow-on 2: Unify Constraint Advisor** | | |
| Phase 1: Update Query Builders | ✅ Complete | `buildSkillFilterCountQuery` accepts `SkillFilterRequirement[]` |
| Phase 2: Update Skill Extraction | ✅ Complete | Returns unified `skillFilterRequirements` |
| Phase 3: Update Tightening Tester | ✅ Complete | Uses `CountQueryContext` with unified groups |
| Phase 4: Update Relaxation Tester | ✅ Complete | Uses unified groups for skill relaxation |
| Phase 5: Update Tightening Generator | ✅ Complete | Uses unified groups for distribution queries |
| Phase 6: Cleanup | ✅ Complete | No `derivedSkillIds` in constraint-advisor API |
| **Follow-on 3: Narrative Accuracy Fixes** | | |
| Phase 1: Add Raw Scores to ScoreBreakdown | ✅ Complete | `RawCoreScores` interface, `rawScores` field |
| Phase 2: Fix Experience Explanation | ✅ Complete | Uses raw score for reverse calculation |
| Phase 3: Track Preferred Skill Group Count | ✅ Complete | `preferredSkillGroupCount` in tradeoff detection |
| Phase 4: Tests | ✅ Complete | 7 new tests for raw scores and group count |
| **Follow-on 4: Per-Requirement Preferred Skill Preferences** | | |
| Phase 1: Update Constraint Expander | ✅ Complete | One `AppliedSkillPreference` per requirement |
| Phase 2: Remove Unused Code | ✅ Complete | Removed `preferredSkills` param and `formatSkillSummary` |
| Phase 3: Add Tests | ✅ Complete | New test for multiple preferred skill requirements |
| **Follow-on 5: Code Cleanup & Refactoring** | | |
| Phase 1: Remove Unused Parameters | ✅ Complete | Removed `resolvedRequiredSkills`, `resolvedPreferredSkills` from `expandSearchCriteria` |
| Phase 2: Extract Shared Logic | ✅ Complete | `buildSkillFilterBase` helper for count/distribution queries |

### Deviations from Plan

1. **Simpler group filtering approach**: Plan suggested EXISTS subqueries. Implementation uses `SIZE([x IN qualifyingSkillIds WHERE x IN $skillGroupN]) > 0` which reuses the existing proficiency-qualified skill collection. This is more efficient as proficiency checking happens once.

2. **Preferred skills handling**: Originally flattened for simplicity. Later changed (Follow-on 4) to create one preference per requirement for consistency with required skills and accurate tradeoff reporting.

3. **Derived skills existence-only**: Derived skills use `allEngineerSkillIds` (existence-only) rather than `qualifyingSkillIds` (proficiency-checked). This matches the original behavior where inference rules don't specify proficiency.

4. **Type discriminator over boolean**: Changed `isDerived?: boolean` to `type: SkillFilterType` (`'user' | 'derived'`) for better extensibility and clearer semantics. Also renamed `AppliedFilterKind`/`AppliedPreferenceKind` to `AppliedFilterType`/`AppliedPreferenceType` for consistency.

### Post-Implementation Additions

1. **Type export**: Added `SkillFilterRequirement` export to `cypher-query-builder/index.ts`
2. **Mock updates**: Updated test mocks in `search.service.test.ts` to include new fields
3. **Bug fixes during E2E testing**:
   - `filter-similarity.service.ts` missing `skillFilterRequirements`
   - `hasSkillFilter` not considering derived skills
   - E2E test using unsatisfiable scenario (changed teamFocus)

### Retrospective Note

The constraint advisor unification (Follow-on 2) achieved API consistency but in retrospect the unification wasn't strictly necessary - the code now does a round-trip conversion between formats. The original pattern was more direct for the constraint advisor's use case. However, all tests pass (816 unit, 321 E2E) and the change is complete, so it's kept.

---

## Code References

### Primary Implementation Files

| File | Key Lines | Purpose |
|------|-----------|---------|
| `skill-resolver.service.ts` | 36-61, 210-293 | ResolvedSkillRequirement type, requirement building |
| `constraint-expander.service.ts` | 120-248, 454-532, 596-618 | HAS_ANY filters, derived expansion, per-requirement preferences |
| `search-query.builder.ts` | 67-114, 230-246, 299-460, 462-554 | Per-group Cypher generation, derived handling, shared base |
| `search.service.ts` | 52-130 | Pipeline orchestration, unified groups |
| `skill-extraction.utils.ts` | 15-75 | Unified skill extraction |
| `tightening-tester.service.ts` | 34-261 | Unified count queries |
| `relaxation-tester.service.ts` | 63-103 | Skill relaxation with unified groups |
| `tightening-generator.service.ts` | 429-448 | Distribution with unified groups |
| `utility-calculator.ts` | - | Raw scores population for ScoreBreakdown |
| `score-explanation.service.ts` | - | Uses raw scores for experience explanation |
| `tradeoff-explanation.service.ts` | - | Preferred skill group count tracking |
| `search-match-explanation.service.ts` | - | Passes group count to tradeoff detection |

### Type Definitions

| File | Key Lines | Type |
|------|-----------|------|
| `query-types.ts` | 32-48 | `SkillFilterRequirement` (includes `type: SkillFilterType`) |
| `query-types.ts` | 50-59 | `CypherQueryParams.skillFilterRequirements` |
| `search.types.ts` | 35-40 | `AppliedFilterType` (renamed from `AppliedFilterKind`) |
| `search.types.ts` | 42-50 | `AppliedPreferenceType` (renamed from `AppliedPreferenceKind`) |
| `search.types.ts` | 52-58 | `SkillFilterType` (`'user' | 'derived'`) |
| `search.types.ts` | 238-247 | `AppliedUserSkillFilter` (HAS_ANY only) |
| `search.types.ts` | 249-260 | `AppliedDerivedSkillFilter` (HAS_ANY, originalSkillId) |
| `search-query.builder.ts` | 299-310 | `SkillFilterBase` (shared helper result type) |
| `skill-resolver.service.ts` | 36-61 | `ResolvedSkillRequirement` |
| `skill-extraction.utils.ts` | 15-18 | `ExtractedSkillConstraints` |

### Configuration

No configuration changes required - the fix is behavioral, not configurational.

---

## Recommended Learning Order

1. **Start with types**: Read `query-types.ts:32-48` to understand `SkillFilterRequirement` with `type: SkillFilterType` discriminator - this is the core data structure enabling unified filtering.

2. **Trace the pipeline**: Read `search.service.ts:52-130` to see how skill groups flow from resolution to query building, including derived skill group construction.

3. **Understand requirement building**: Read `skill-resolver.service.ts:210-293` to see how user requests become requirements with expanded descendants.

4. **See filter creation**: Read `constraint-expander.service.ts:184-221` and `490-537` to see how both derived and user groups become HAS_ANY filters and per-requirement preferences.

5. **See derived expansion**: Read `constraint-expander.service.ts:608-630` to understand hierarchy expansion for inference-derived skills.

6. **Study query generation**: Read `search-query.builder.ts:519-554` to see how `type === 'derived'` controls proficiency checking in Cypher.

7. **Understand constraint advisor pattern**: Read `skill-extraction.utils.ts:38-75` and `tightening-tester.service.ts:232-261` to see unified `skillFilterRequirements` usage.

8. **Verify with tests**: Run `npm test -- search-query.builder` and read the "skill filter groups" describe block to confirm understanding.

---

## Open Questions

1. **~~E2E Test Updates~~**: ✅ Resolved - Postman collection updated, 321/321 assertions passing.

2. **~~matchType Classification~~**: ✅ Resolved - `originalSkillId` flows through pipeline correctly.

3. **Performance Impact**: Per-group filtering adds multiple `SIZE([...]) > 0` conditions. For searches with many skill requirements, this could impact query performance. Should be monitored.

4. **~~Derived Skills~~**: ✅ Resolved - Derived skills now use HAS_ANY with hierarchy expansion, matching user skill behavior.

5. **Constraint Advisor Unification Value**: The unification achieved API consistency but added indirection. Future refactors should weigh "pattern alignment" against actual problem-solving value.

---

## Follow-on 3: Narrative Accuracy Fixes

Two issues were discovered in the explain endpoint narratives after the skill hierarchy expansion fix.

### Issue 1: Experience Score Showing Wrong Years

**Problem**: Engineers with 5-9 years experience were showing "Junior level experience (0 years)" in the explanation.

**Root Cause**: The experience explanation was reverse-calculating years from the weighted score (e.g., 0.079) instead of the raw 0-1 normalized score (e.g., 0.722).

**Solution**: Pass raw scores separately from weighted scores in `ScoreBreakdown`.

**Files Modified**:
1. `recommender_api/src/types/search.types.ts` - Added `RawCoreScores` interface and `rawScores` field to `ScoreBreakdown`
2. `recommender_api/src/services/utility-calculator/utility-calculator.ts` - Populates `rawScores` with pre-weighted values
3. `recommender_api/src/services/search-match-explanation/score-explanation.service.ts` - Uses `rawScores` for explanation generation

**Key Code Change** (`score-explanation.service.ts`):
```typescript
export function generateScoreExplanations(context: ScoreContext): ScoreExplanation[] {
  const { scores, rawScores } = context.breakdown;

  if (scores.experience !== undefined) {
    // Use raw score for reverse calculation, weighted score for display
    const rawScore = rawScores?.experience ?? scores.experience;
    explanations.push(generateExperienceExplanation(rawScore, scores.experience));
  }
}

function generateExperienceExplanation(rawScore: number, weightedScore: number): ScoreExplanation {
  // Reverse the logarithmic formula using raw 0-1 score
  const years = Math.round(Math.exp(rawScore * Math.log(21)) - 1);
  // ... generates correct "Senior level experience (8 years)"
}
```

### Issue 2: Preferred Skills Tradeoff Showing Expanded Count

**Problem**: Tradeoff showing "Has 0 of 3 preferred skills" when user only requested 1 skill that expanded to 3 descendants.

**Root Cause**: Using the expanded skill ID count instead of the original user request count.

**Solution**: Track `preferredSkillGroupCount` from the user's original request and pass it to tradeoff detection.

**Files Modified**:
1. `recommender_api/src/services/search-match-explanation/tradeoff-explanation.service.ts` - Added `preferredSkillGroupCount` to `SearchPreferences` interface
2. `recommender_api/src/services/search-match-explanation/search-match-explanation.service.ts` - Calculates original group count from request

**Key Code Change** (`tradeoff-explanation.service.ts`):
```typescript
interface SearchPreferences {
  // ... existing fields
  preferredSkillGroupCount?: number;  // Original number of preferred skill groups
}

function detectMissingPreferredSkills(
  engineerSkills: string[],
  preferredSkillIds: string[],
  originalGroupCount?: number
): TradeoffExplanation | null {
  if (originalGroupCount !== undefined && originalGroupCount !== expandedTotalCount) {
    explanation = `Matched ${matchedCount} of ${expandedTotalCount} preferred skills (${originalGroupCount} skill group${originalGroupCount === 1 ? '' : 's'} requested)`;
    requestedValue = originalGroupCount;  // Use original count, not expanded
  }
}
```

**Tests Added**:
- `utility-calculator.test.ts`: 3 tests for raw scores population and reverse calculation
- `tradeoff-explanation.service.test.ts`: 4 tests for group count handling

### Verification Results

API calls verified correct output:
- `eng_robert` (15 years): "Staff+ level experience (15+ years)" ✓
- `eng_olivia` (7 years): "Senior level experience (7 years)" ✓
- `eng_priya` with preferred Python: "Matched 0 of 3 preferred skills (1 skill group requested)" ✓

---

## Follow-on 4: Per-Requirement Preferred Skill Preferences

### Problem

Preferred skills were flattened into a single `AppliedSkillPreference` entry, causing:
1. API response showed one preference with combined `displayValue` (e.g., "Python, Java")
2. Tradeoff detection couldn't identify which specific preferred skills were missing
3. Inconsistent with required skills pattern (which creates one filter per requirement)

### Solution

Changed `trackSkillsAsConstraints` in `constraint-expander.service.ts` to:
1. Create one `AppliedSkillPreference` per requirement (matching required skills pattern)
2. Set `displayValue` to the original identifier (e.g., "Python") instead of joined names
3. Remove unused `preferredSkills` parameter and `formatSkillSummary` helper

### Files Modified

| File | Change |
|------|--------|
| `constraint-expander.service.ts` | Rewrote preferred skills loop (lines 528-550), removed `formatSkillSummary` |
| `constraint-expander.service.test.ts` | Added test for multiple preferred skill requirements |

### Verification Results

API calls verified correct output:
```bash
# Request with multiple preferred skills
curl -X POST http://localhost:4025/api/search/filter \
  -d '{"preferredSkills": [{"skill": "Python"}, {"skill": "Java"}]}'

# Response shows separate preferences
appliedPreferences: [
  { displayValue: "Python", skills: [Python, Django, FastAPI] },
  { displayValue: "Java", skills: [Java, Spring Boot] }
]

# Tradeoff explanation shows individual names
"Missing preferred skills: Kubernetes, AWS"
```

---

## Follow-on 5: Code Cleanup & Refactoring

### Phase 1: Remove Unused Parameters from expandSearchCriteria

**Problem**: `expandSearchCriteria` had two parameters (`resolvedRequiredSkills`, `resolvedPreferredSkills`) that were declared but never used in the function body.

**Solution**: Removed the unused parameters from:
- Function signature and JSDoc in `constraint-expander.service.ts`
- Call sites in `search.service.ts` (2 locations)
- Call site in `filter-similarity.service.ts`
- Test helper in `constraint-expander.service.test.ts`

Also removed the now-unused `ResolvedSkillWithProficiency` import from files that no longer needed it.

### Phase 2: Extract Shared Skill Filter Logic

**Problem**: `buildSkillFilterCountQuery` and `buildSkillDistributionQuery` had ~40 lines of duplicated code:
- Separating user vs derived requirements
- Building proficiency buckets
- Constructing params with skill IDs
- Building property WHERE clause
- Building derived skill existence clause

**Solution**: Extracted shared logic into `buildSkillFilterBase`:

```typescript
interface SkillFilterBase {
  params: Record<string, unknown>;
  allUserSkillIds: string[];
  allSkillIds: string[];
  propertyWhereClause: string;
  derivedSkillExistenceClause: string;
}

function buildSkillFilterBase(
  skillFilterRequirements: SkillFilterRequirement[],
  propertyConditions: { whereClauses: string[]; params: Record<string, unknown> },
  extraParams: Record<string, unknown> = {}
): SkillFilterBase
```

Both functions now call this helper and add only their specific RETURN logic:
- `buildSkillFilterCountQuery`: `RETURN count(DISTINCT e) AS resultCount`
- `buildSkillDistributionQuery`: Second MATCH for skill aggregation

### Files Modified

| File | Change |
|------|--------|
| `constraint-expander.service.ts` | Removed unused params from signature |
| `search.service.ts` | Updated 2 call sites |
| `filter-similarity.service.ts` | Updated call site |
| `constraint-expander.service.test.ts` | Updated helper and removed test's unused variable |
| `search-query.builder.ts` | Added `SkillFilterBase` interface and `buildSkillFilterBase` helper |
