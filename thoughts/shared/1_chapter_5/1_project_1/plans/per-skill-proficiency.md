# Per-Skill Proficiency Requirements

## Summary
Refactor skill filtering from a global proficiency threshold to per-skill requirements. Each required/preferred skill can have its own `minProficiency` (hard filter) and `preferredMinProficiency` (ranking boost). Remove confidence scores from user-facing API.

## New API Structure

**Before:**
```json
{
  "requiredSkills": ["typescript", "kubernetes"],
  "requiredMinProficiency": "expert",
  "requiredRiskTolerance": "medium"
}
```

**After:**
```json
{
  "requiredSkills": [
    { "skill": "typescript", "minProficiency": "expert" },
    { "skill": "kubernetes", "minProficiency": "proficient", "preferredMinProficiency": "expert" }
  ],
  "preferredSkills": [
    { "skill": "graphql", "preferredMinProficiency": "proficient" }
  ]
}
```

- `minProficiency`: Hard filter (defaults to 'learning' = any level)
- `preferredMinProficiency`: Ranking boost if exceeded
- Domains stay as `string[]` (no per-domain proficiency)
- `requiredRiskTolerance` removed (confidence internalized at 0.70)

## Implementation Steps

### 1. Schema & Types
**File: `recommender_api/src/schemas/search.schema.ts`**
- Add `SkillRequirementSchema`: `{ skill, minProficiency?, preferredMinProficiency? }`
- Change `requiredSkills`/`preferredSkills` from `z.array(z.string())` to `z.array(SkillRequirementSchema)`
- Remove: `requiredRiskTolerance`, `requiredMinProficiency`, `preferredProficiency`, `preferredConfidenceScore`

**File: `recommender_api/src/types/search.types.ts`**
- Re-export `SkillRequirement` type
- Remove `RiskTolerance` from exports

### 2. Query Parameter Types
**File: `recommender_api/src/services/cypher-query-builder/query-types.ts`**
- Replace `allowedProficiencyLevels: ProficiencyLevel[]` with:
  ```typescript
  learningLevelSkillIds: string[];
  proficientLevelSkillIds: string[];
  expertLevelSkillIds: string[];
  ```
- Rename `requestedSkillIdentifiers` → `originalSkillIdentifiers`
- Add `preferredSkillsWithProficiency` for ranking

### 3. Skill Resolver
**File: `recommender_api/src/services/skill-resolver.service.ts`**
- Add new function `resolveSkillRequirements()` that:
  - Accepts `SkillRequirementInput[]` (skill + proficiency)
  - Expands via hierarchy (existing `resolveSkillHierarchy`)
  - Each expanded skill inherits parent's proficiency requirement
  - Returns `ResolvedSkillWithProficiency[]`

### 4. Constraint Expander
**File: `recommender_api/src/services/constraint-expander.service.ts`**
- Remove `expandRiskToleranceToConfidenceScore()`
- Remove `expandMinProficiencyToAllowedLevels()`
- Use fixed `minConfidenceScore: 0.70` from defaults
- Update constraint tracking for new skill structure

### 5. Cypher Query Builder
**File: `recommender_api/src/services/cypher-query-builder/search-query.builder.ts`**

Replace qualification clause:
```cypher
WITH e, COLLECT(DISTINCT CASE
  WHEN s.id IN $learningLevelSkillIds
   AND es.confidenceScore >= $minConfidenceScore THEN s.id
  WHEN s.id IN $proficientLevelSkillIds
   AND es.proficiencyLevel IN ['proficient', 'expert']
   AND es.confidenceScore >= $minConfidenceScore THEN s.id
  WHEN s.id IN $expertLevelSkillIds
   AND es.proficiencyLevel = 'expert'
   AND es.confidenceScore >= $minConfidenceScore THEN s.id
END) AS qualifyingSkillIds
WHERE SIZE([x IN qualifyingSkillIds WHERE x IS NOT NULL]) > 0
```

Update skill collection to compute `meetsProficiency` per-skill using the same logic.

### 6. Search Service
**File: `recommender_api/src/services/search.service.ts`**
- Add helper `groupSkillsByProficiency()` to bucket skills by their minProficiency level
- Call `resolveSkillRequirements()` for required/preferred skills
- Pass grouped skill IDs to query builder
- Update utility context for per-skill preferred proficiency

### 7. Utility Calculator
**File: `recommender_api/src/services/utility-calculator.service.ts`**
- Update `UtilityContext` to include `preferredSkillsWithProficiency`
- Add `calculatePreferredSkillProficiencyMatch()` for per-skill boost calculation
- Remove global `preferredProficiency`/`preferredConfidenceScore` handling

### 8. Config Updates
**File: `recommender_api/src/config/knowledge-base/defaults.config.ts`**
- Remove `requiredRiskTolerance` default
- Add `defaultMinConfidenceScore: 0.70`

## Key Design Decisions

1. **Hierarchy inheritance**: When 'python' expands to ['python', 'django', 'flask'], all inherit the parent's proficiency requirement
2. **Default proficiency**: 'learning' (any level) when unspecified
3. **Confidence score**: Fixed at 0.70 internally (medium risk tolerance equivalent)
4. **No backward compatibility**: Full migration to new structure

## Files to Modify (in order)
1. `recommender_api/src/schemas/search.schema.ts`
2. `recommender_api/src/types/search.types.ts`
3. `recommender_api/src/services/cypher-query-builder/query-types.ts`
4. `recommender_api/src/config/knowledge-base/defaults.config.ts`
5. `recommender_api/src/services/skill-resolver.service.ts`
6. `recommender_api/src/services/constraint-expander.service.ts`
7. `recommender_api/src/services/cypher-query-builder/search-query.builder.ts`
8. `recommender_api/src/services/search.service.ts`
9. `recommender_api/src/services/utility-calculator.service.ts`
