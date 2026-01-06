---
date: 2025-12-30T15:45:00-08:00
researcher: Claude
git_commit: 4c5b569cfde955c7279dd39b3db5e6d4f57d92ee
branch: chapter_5_project_1
repository: recommender_system
topic: "Required vs Preferred Properties Analysis - Gaps in Dealbreaker vs Preference Support"
tags: [research, codebase, api-design, constraints, required-vs-preferred, dealbreakers, preferences]
status: complete
last_updated: 2025-12-30
last_updated_by: Claude
---

# Research: Required vs Preferred Properties Analysis

**Date**: 2025-12-30T15:45:00-08:00
**Researcher**: Claude
**Git Commit**: 4c5b569cfde955c7279dd39b3db5e6d4f57d92ee
**Branch**: chapter_5_project_1
**Repository**: recommender_system

## Research Question

Analyze which required vs preferred properties are supported in the API, identify gaps where engineering managers might want to specify dealbreakers vs preferences.

## Summary

The recommender API currently implements a **partial required vs preferred distinction**. Two property types fully support both modes (skills, domains), while **six property types only support hard constraints** without a preferred/boost option. This limits engineering managers' ability to express nuanced requirements like "must be available within 2 weeks, but ideally immediate" or "minimum senior, but prefer staff level."

### Current Support Matrix

| Property | Required (Dealbreaker) | Preferred (Nice-to-have) | Gap? |
|----------|------------------------|--------------------------|------|
| Skills | `requiredSkills` | `preferredSkills` | No |
| Domains | `requiredDomains` | `preferredDomains` | No |
| Availability | `availability` | - | **Yes** |
| Timezone | `timezone` | - | **Yes** |
| Seniority/Experience | `seniorityLevel` | - | **Yes** |
| Salary | `minSalary`/`maxSalary` | - | **Yes** |
| Confidence | `riskTolerance` | - | **Yes** |
| Proficiency | `minProficiency` | - | **Yes** |
| Team Focus | - | `teamFocus` | No (soft by design) |

## Detailed Findings

### Properties with Full Required + Preferred Support

#### 1. Skills (`requiredSkills` + `preferredSkills`)

**Files:**
- `recommender_api/src/types/search.types.ts:20-21`
- `recommender_api/src/services/search.service.ts:73-100`

```typescript
requiredSkills?: string[];   // Hard filter - must have at least one qualifying skill
preferredSkills?: string[];  // Nice-to-have skills (for ranking boost)
```

**Implementation:**
- Required skills are resolved via skill hierarchy and used in Cypher WHERE clauses
- Preferred skills are resolved separately and contribute to `preferredSkillsBonus` in utility calculation
- Weight: `skillMatch: 0.25` (required), `preferredSkillsBonus: 0.10` (preferred)

#### 2. Domains (`requiredDomains` + `preferredDomains`)

**Files:**
- `recommender_api/src/types/search.types.ts:37-38`
- `recommender_api/src/services/cypher-builder.service.ts:89-128`

```typescript
requiredDomains?: string[];    // Hard filter - must match at least one domain
preferredDomains?: string[];   // Ranking boost - optional, increases score
```

**Implementation:**
- Required domains use MATCH clause (hard filter)
- Preferred domains use OPTIONAL MATCH + COLLECT for scoring
- Weight: `domainBonus: 0.05`

---

### Properties with Required-Only Support (GAPS)

#### 3. Availability - **MISSING PREFERRED**

**Current Implementation:**
- `recommender_api/src/types/search.types.ts:22`
- `recommender_api/src/services/constraint-expander.service.ts:117-127`

```typescript
availability?: AvailabilityOption[];  // Hard filter only
```

**What Managers Might Want:**
- `requiredAvailability`: "Must be available within 2 weeks" (dealbreaker)
- `preferredAvailability`: "Ideally immediate" (boost for sooner availability)

**Utility Function Gap:**
- Currently `availabilityUtility` only considers whether candidate is available
- No bonus for earlier availability even if manager prefers it

#### 4. Timezone - **MISSING PREFERRED**

**Current Implementation:**
- `recommender_api/src/types/search.types.ts:23`
- `recommender_api/src/services/cypher-builder.service.ts:60-63`

```typescript
timezone?: string;  // Glob pattern: "America/*" - hard filter only
```

**What Managers Might Want:**
- `requiredTimezone`: "Must be in Americas" (dealbreaker)
- `preferredTimezone`: "Ideally Pacific timezone" (boost for specific zones)

**Example Use Case:**
Manager in SF wants anyone in US time zones (required), but prefers Pacific for more overlap.

#### 5. Seniority/Experience - **MISSING PREFERRED**

**Current Implementation:**
- `recommender_api/src/types/search.types.ts:18`
- `recommender_api/src/config/knowledge-base.config.ts:18-24`

```typescript
seniorityLevel?: SeniorityLevel;  // Maps to yearsExperience range - hard filter only

seniorityMapping: {
  junior: { minYears: 0, maxYears: 3 },
  mid: { minYears: 3, maxYears: 6 },
  senior: { minYears: 6, maxYears: 10 },
  staff: { minYears: 10, maxYears: null },
  principal: { minYears: 15, maxYears: null }
}
```

**What Managers Might Want:**
- `requiredSeniorityLevel`: "Must be senior+" (dealbreaker)
- `preferredSeniorityLevel`: "Prefer staff level" (boost)

**Alternative:**
- `minYearsExperience` / `preferredYearsExperience`: "Must have 5+, prefer 8+"

#### 6. Salary - **MISSING PREFERRED**

**Current Implementation:**
- `recommender_api/src/types/search.types.ts:25-26`
- `recommender_api/src/services/utility-calculator.service.ts:420-441`

```typescript
maxSalary?: number;  // Maximum annual salary - hard filter
minSalary?: number;  // Minimum annual salary - hard filter
```

**What Managers Might Want:**
- `maxSalary`: "Cannot exceed $200k" (dealbreaker budget cap)
- `preferredSalaryRange`: "Ideally $150-180k" (boost for ideal range)

**Current Utility Behavior:**
Salary utility is linear from `salaryMin` to `salaryMax` in config (not request), rewarding lower salary. No concept of "preferred budget range."

#### 7. Risk Tolerance / Confidence - **MISSING PREFERRED**

**Current Implementation:**
- `recommender_api/src/types/search.types.ts:28`
- `recommender_api/src/config/knowledge-base.config.ts:30-34`

```typescript
riskTolerance?: RiskTolerance;  // Maps to minConfidenceScore - hard filter only

riskToleranceMapping: {
  low: { minConfidenceScore: 0.85 },
  medium: { minConfidenceScore: 0.70 },
  high: { minConfidenceScore: 0.50 }
}
```

**What Managers Might Want:**
- `minConfidenceScore`: "Must be at least 0.7" (dealbreaker)
- `preferredConfidenceScore`: "Prefer 0.9+" (boost for higher confidence)

**Current Utility Behavior:**
`confidenceUtility` does scale with confidence score, but threshold is binary (pass/fail), not graduated boost.

#### 8. Proficiency Level - **MISSING PREFERRED**

**Current Implementation:**
- `recommender_api/src/types/search.types.ts:29`
- `recommender_api/src/config/knowledge-base.config.ts:40-44`

```typescript
minProficiency?: ProficiencyLevel;  // Hard filter only

proficiencyMapping: {
  learning: ['learning', 'proficient', 'expert'],
  proficient: ['proficient', 'expert'],
  expert: ['expert']
}
```

**What Managers Might Want:**
- `minProficiency`: "Must be at least proficient" (dealbreaker)
- `preferredProficiency`: "Prefer experts" (boost)

**Current Utility Behavior:**
`skillMatchUtility` gives small proficiency bonus (10% for expert, 5% for proficient), but this is baked into the skill match, not a separate preference.

---

### Properties with Preferred-Only Support (Appropriate)

#### 9. Team Focus - Soft by Design

**Implementation:**
- `recommender_api/src/types/search.types.ts:30`
- `recommender_api/src/config/knowledge-base.config.ts:54-91`

```typescript
teamFocus?: TeamFocus;  // Maps to bonus skills - ranking boost only
```

This is correctly implemented as soft preference - team focus provides context for ranking but shouldn't exclude candidates.

---

## Architecture Insights

### Current Constraint Architecture

```
SearchFilterRequest
       │
       ▼
┌──────────────────────────────────────┐
│     Constraint Expander Service      │
│  (Maps user terms → DB constraints)  │
│                                      │
│  Hard Filters: WHERE clauses         │
│  Soft Boosts: Utility function       │
└──────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│       Cypher Builder Service         │
│  (Builds Neo4j queries)              │
│                                      │
│  - MATCH for required                │
│  - OPTIONAL MATCH for preferred      │
└──────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│     Utility Calculator Service       │
│  (Ranking formula)                   │
│                                      │
│  U(V) = Σ w_j * f_j(v_j)             │
└──────────────────────────────────────┘
```

### Extension Pattern for Adding Preferred Support

To add preferred support for a property (e.g., `preferredAvailability`):

1. **Types** (`search.types.ts`): Add `preferredAvailability?: AvailabilityOption[]`

2. **Validation** (`validate-search.middleware.ts`): Add validation rules

3. **Constraint Expander** (`constraint-expander.service.ts`):
   - Keep `availability` as hard filter
   - Pass `preferredAvailability` through for utility calculation

4. **Knowledge Base** (`knowledge-base.config.ts`):
   - Add `availabilityBonus` weight (e.g., 0.05)
   - Add `availabilityBonusMax` parameter

5. **Utility Calculator** (`utility-calculator.service.ts`):
   - Add `calculateAvailabilityBonusUtility()` function
   - Include in score breakdown

6. **Response Types** (`search.types.ts`):
   - Add `AvailabilityBonusComponent` to `ScoreBreakdown`

---

## Code References

- `recommender_api/src/types/search.types.ts:17-43` - SearchFilterRequest interface
- `recommender_api/src/config/knowledge-base.config.ts:18-44` - Constraint mappings
- `recommender_api/src/config/knowledge-base.config.ts:113-123` - Utility weights
- `recommender_api/src/services/constraint-expander.service.ts:51-240` - Constraint expansion
- `recommender_api/src/services/cypher-builder.service.ts:81-268` - Query building
- `recommender_api/src/services/utility-calculator.service.ts:193-366` - Scoring logic
- `recommender_api/src/services/search.service.ts:60-297` - Search orchestration

## Recommendations

### Priority 1: High-Value Gaps

1. **preferredAvailability** - Very common use case: "need someone soon, prefer immediate"
2. **preferredSeniorityLevel** - Common: "need senior+, prefer staff"
3. **preferredSalaryRange** - Budget optimization: "cap at $200k, prefer $150-180k"

### Priority 2: Nice-to-Have Gaps

4. **preferredTimezone** - Useful for distributed teams
5. **preferredConfidenceScore** - Quality optimization
6. **preferredProficiency** - Already partially implemented via skillMatchUtility

### Implementation Complexity

| Property | Complexity | Notes |
|----------|------------|-------|
| preferredAvailability | Low | Simple ordinal ranking (immediate > 2wk > 1mo) |
| preferredSeniorityLevel | Low | Map to years range bonus |
| preferredSalaryRange | Medium | Need new params for ideal range |
| preferredTimezone | Medium | Need timezone ranking/overlap calculation |
| preferredConfidenceScore | Low | Already have confidence utility, just need threshold |
| preferredProficiency | Low | Already partially baked into skill match |

## Related Research

- `thoughts/shared/plans/2025-12-30-project-1-basic-constraint-search-api.md` - Original API specification
- `thoughts/shared/research/2025-12-30-recommender-api-analysis.md` - Full API analysis
- `thoughts/shared/research/2025-12-30-system-comparison-analysis.md` - Comparison with legacy system

## Open Questions

1. Should `preferredAvailability` use ordinal ranking (immediate=3, 2wk=2, 1mo=1) or allow manager to specify order?
2. For `preferredTimezone`, should we calculate overlap hours or use simple zone ranking?
3. Should `preferredSalaryRange` be a range (min-max) or a target value with tolerance?
4. What weights should new preferred properties receive? Current preferred weights total ~0.25.
