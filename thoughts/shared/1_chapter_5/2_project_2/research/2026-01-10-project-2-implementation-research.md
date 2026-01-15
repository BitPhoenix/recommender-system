---
date: 2026-01-10T10:54:35-05:00
researcher: Claude
git_commit: bec4c9da4a835087607d50f043e447e6ab47fb74
branch: project_2
repository: recommender_system
topic: "Project 2: Constraint Relaxation and Repair Proposals - Implementation Research"
tags: [research, project-2, constraint-relaxation, diagnosis, minimal-inconsistent-sets, repair-proposals]
status: complete
last_updated: 2026-01-10
last_updated_by: Claude
last_updated_note: "Added design decision for integrated auto-diagnosis approach"
---

# Research: Project 2 - Constraint Relaxation and Repair Proposals

**Date**: 2026-01-10T10:54:35-05:00
**Researcher**: Claude
**Git Commit**: bec4c9da4a835087607d50f043e447e6ab47fb74
**Branch**: project_2
**Repository**: recommender_system

## Research Question

Research the Project 2 section from the chapter 5 documentation alongside the current codebase to understand what we'll be building for constraint relaxation and repair proposals.

## Summary

**Project 2** builds upon the existing constraint-based search API (`POST /api/search/filter`) to handle the critical edge case when searches return **zero or sparse results**. Rather than creating a separate endpoint, we integrate diagnosis directly into the filter response with **auto-triggering** behavior:

1. **Detects Minimal Inconsistent Sets (MIS)** - Finds the smallest combinations of constraints that conflict with each other
2. **Generates Relaxation Suggestions** - Shows what happens if you relax each conflicting constraint
3. **Explains Conflicts** - Provides human-readable explanations of why constraints conflict

This implements sections **5.2.4 (Handling Unacceptable Results or Empty Sets)** and **5.2.5 (Adding Constraints)** from the textbook "Recommender Systems: The Textbook" by Aggarwal.

## Design Decision: Integrated Auto-Diagnosis

**Decision**: Integrate diagnosis into the existing `/api/search/filter` endpoint rather than creating a separate `/api/search/diagnose` endpoint.

**Approach**: Auto-trigger diagnosis when `totalCount < threshold` (e.g., 3). No new request parameters - just works automatically.

**Rationale**:
1. **Better UX** - Users get diagnosis automatically when they need it, no extra API call
2. **Efficiency** - Reuses already-parsed constraints from the filter request
3. **Single roundtrip** - Avoids redundant network calls for empty results
4. **Pragmatic** - The textbook's separate endpoint was pedagogical; integration is more practical
5. **Simplicity** - No new request parameters to learn; can add control later if needed

**Trade-off accepted**: Slightly slower response when diagnosis runs, but only triggers when results are sparse (when users need help anyway).

## Detailed Findings

### 1. What Project 2 Builds

**Enhanced Endpoint**: `POST /api/search/filter` (existing, with new diagnosis capability)

**Purpose**: When the search returns 0 or too few matches, automatically include diagnosis to help users understand why and suggest how to get results.

**Request Format** (unchanged - diagnosis is automatic):
```typescript
{
  requiredSkills: ['Kubernetes', 'Kafka'],
  minConfidenceScore: 0.9,
  minYearsExperience: 10,
  availability: 'immediate'
}
```

**Response Format** (extended with auto-triggered diagnosis):
```typescript
{
  matches: [],
  totalCount: 0,
  appliedFilters: [...],
  appliedPreferences: [...],
  derivedConstraints: [...],
  queryMetadata: {...},

  // NEW: Only present when diagnosis triggered
  diagnosis: {
    conflictSets: [
      {
        constraints: ['minYearsExperience >= 10', 'availability = "immediate"'],
        explanation: 'Only 1 engineer has 10+ years, and they are not immediately available.'
      },
      {
        constraints: ['skill("Kubernetes").confidence >= 0.9', 'skill("Kafka").confidence >= 0.9'],
        explanation: 'No engineers have 0.9+ confidence in both Kubernetes AND Kafka.'
      }
    ],
    relaxationSuggestions: [
      {
        constraint: 'minYearsExperience',
        currentValue: 10,
        suggestedValue: 7,
        resultingMatches: 2
      },
      {
        constraint: 'minConfidenceScore',
        currentValue: 0.9,
        suggestedValue: 0.8,
        resultingMatches: 3
      },
      {
        constraint: 'availability',
        currentValue: 'immediate',
        suggestedValue: 'two_weeks',
        resultingMatches: 1
      }
    ]
  }
}
```

**Auto-Trigger Behavior**:
- When `totalCount < 3`: automatically run diagnosis and include in response
- When `totalCount >= 3`: skip diagnosis (user has enough results to work with)

### 2. Algorithm for Finding Minimal Conflict Sets

From Section 5.2.4 of the specification:

```
1. Start with full constraint set → 0 results
2. Remove one constraint at a time, check if results > 0
3. If removing constraint X gives results, X is part of a conflict
4. Find smallest subsets where removal yields results
5. Present these as minimal conflict sets
```

**Key Principle**: A constraint set is "minimal inconsistent" if removing ANY single constraint from it makes the remaining constraints satisfiable (produces > 0 results).

**Example**:
- Full constraints: {A, B, C, D} → 0 results
- Remove A: {B, C, D} → 3 results (A participates in conflict)
- Remove B: {A, C, D} → 0 results (B not the issue alone)
- Remove C: {A, B, D} → 2 results (C participates in conflict)
- Remove D: {A, B, C} → 0 results
- Analyze: {A, C} may be the minimal conflict set

### 3. Current Codebase Architecture (What We Build On)

#### 3.1 Search/Filter Pipeline

**File**: `recommender_api/src/services/search.service.ts`

The existing 7-step pipeline:
1. **expandSearchCriteria()** - Expands user input to database constraints
2. **runInference()** - Forward-chaining rule engine for derived constraints
3. **resolveAllSkills()** - Maps skill names to IDs with hierarchy expansion
4. **resolveDomains()** - Resolves business/technical domains
5. **buildSearchQuery()** - Generates Cypher with WHERE clauses
6. **Execute Query** - Runs against Neo4j
7. **Score & Format** - Utility scoring and response formatting

**Key Files**:
| File | Purpose |
|------|---------|
| `routes/search.routes.ts` | Route definitions |
| `controllers/search.controller.ts` | HTTP handler |
| `schemas/search.schema.ts` | Zod validation schemas |
| `services/constraint-expander.service.ts` | Constraint expansion |
| `services/inference-engine.service.ts` | Rule-based expansion |
| `services/cypher-query-builder/search-query.builder.ts` | Cypher generation |

#### 3.2 Constraint Types

From `constraint-expander.service.ts`:

| User Input | Expanded Constraint | Cypher Clause |
|------------|---------------------|---------------|
| `requiredSeniorityLevel: 'senior'` | `minYearsExperience: 6, maxYearsExperience: 10` | `e.yearsExperience >= 6 AND e.yearsExperience < 10` |
| `requiredMaxStartTime: 'two_weeks'` | `startTimeline: ['immediate', 'two_weeks']` | `e.startTimeline IN $startTimeline` |
| `requiredTimezone: ['America/*']` | `timezonePrefixes: ['America/']` | `e.timezone STARTS WITH 'America/'` |
| `maxBudget: 150000` | `budgetCeiling: 150000` | `e.salary <= $budgetCeiling` |
| `requiredSkills: ['Backend']` | Resolved skill IDs with hierarchy | `s.id IN $allSkillIds` |

#### 3.3 Inference Engine (Derived Constraints)

**File**: `recommender_api/src/services/inference-engine.service.ts`

The engine adds derived constraints via rules:
- **Filter Rules**: Hard requirements (e.g., `scaling-requires-distributed`)
- **Boost Rules**: Soft preferences (e.g., `senior-prefers-leadership`)

These derived constraints also need to be considered in conflict detection.

### 4. Neo4j Data Model

**40 Engineers** with varied profiles enabling meaningful conflict scenarios:

| Distribution | Count | Key Characteristics |
|--------------|-------|---------------------|
| Junior (0-3 yrs) | ~6 | Lower salary, immediate availability |
| Mid-Level (3-5 yrs) | ~8 | Varied skills, mixed availability |
| Senior (6-8 yrs) | ~10 | Higher salary, specialized skills |
| Staff+ (9+ yrs) | ~16 | Expert level, longer timelines |

**Skill Relationships** supporting hierarchy-based conflicts:
- `:CHILD_OF` - Skill hierarchies (TypeScript → JavaScript)
- `:CORRELATES_WITH` - Skill correlations with strength
- `:BELONGS_TO` - Skills to categories

### 5. Constraint Relaxation Strategies

From Section 5.2.4-5.2.5:

#### 5.1 Numerical Constraints
```typescript
// Experience: suggest lowering by steps
minYearsExperience: 10 → suggested: 7, 5, 3
// Budget: suggest increasing by percentages
maxBudget: 100000 → suggested: 120000, 150000, 180000
// Confidence: suggest lowering by 0.1 steps
minConfidenceScore: 0.9 → suggested: 0.8, 0.7, 0.6
```

#### 5.2 Categorical Constraints
```typescript
// Availability: expand to include later timelines
availability: 'immediate' → suggested: ['immediate', 'two_weeks']
// Timezone: expand to similar regions
timezone: 'America/New_York' → suggested: 'America/*'
```

#### 5.3 Skill Constraints
```typescript
// Skill: suggest parent category or correlated skills
requiredSkill: 'Kubernetes' → suggested: remove or substitute 'Docker'
// Proficiency: lower the minimum level
minProficiency: 'expert' → suggested: 'proficient'
```

### 6. Implementation Approach

#### Phase 1: Constraint Decomposition
Break down the `SearchFilterRequest` into individual testable constraints:
```typescript
interface IndividualConstraint {
  id: string;           // unique identifier
  field: string;        // e.g., 'minYearsExperience'
  operator: string;     // e.g., '>=', 'IN', 'STARTS WITH'
  value: any;           // e.g., 10
  source: 'user' | 'derived';
  cypherFragment: string;
}
```

#### Phase 2: Single-Constraint Removal Testing
For each constraint, run query without it and count results:
```typescript
async function testConstraintRemoval(
  allConstraints: IndividualConstraint[],
  constraintToRemove: IndividualConstraint
): Promise<number> {
  const remaining = allConstraints.filter(c => c.id !== constraintToRemove.id);
  const query = buildQueryFromConstraints(remaining);
  return await executeCountQuery(query);
}
```

#### Phase 3: Minimal Set Identification
Use results to identify minimal conflict sets:
```typescript
interface ConflictSet {
  constraints: IndividualConstraint[];
  explanation: string;
  evidence: {
    withoutFirst: number;   // matches without first constraint
    withoutSecond: number;  // matches without second constraint
    withBoth: number;       // matches with both (should be 0)
  };
}
```

#### Phase 4: Relaxation Suggestion Generation
For each constraint in a conflict set, compute relaxation options:
```typescript
interface RelaxationOption {
  constraint: IndividualConstraint;
  currentValue: any;
  suggestedValue: any;
  rationale: string;
  resultingMatches: number;
}
```

### 7. Key Technical Challenges

#### 7.1 Query Performance
Running multiple constraint-removal queries could be expensive. Mitigation strategies:
- **Caching**: Cache partial query results
- **Parallel Execution**: Run constraint tests concurrently
- **Early Termination**: Stop when sufficient conflicts found

#### 7.2 Derived Constraint Handling
Inference engine adds derived constraints that may conflict:
- Track provenance of each constraint
- Allow overriding derived constraints in relaxation suggestions
- Explain derived constraint sources in conflict explanations

#### 7.3 Meaningful Relaxation Suggestions
Suggestions must be actionable:
- Respect domain constraints (e.g., don't suggest negative experience)
- Suggest reasonable steps (not "remove all constraints")
- Prioritize high-impact relaxations (those yielding most matches)

### 8. Example Conflict Scenarios

Based on the 40-engineer seed data:

| Scenario | Constraints | Conflict |
|----------|-------------|----------|
| Expert + Immediate | Kubernetes expert, immediate availability | Only 2 Kubernetes experts, neither immediate |
| APAC + Senior | Asia/* timezone, 6+ years | Limited APAC representation |
| Healthcare + ML | Healthcare domain, ML skills | Rare combination |
| High Budget + Junior | <$100k salary, 10+ years experience | Contradictory |

## Architecture Insights

### Existing Patterns to Leverage

1. **Constraint Expansion Service**: Already decomposes user input into individual constraints with source tracking
2. **Cypher Query Builder**: Modular design allows building partial queries
3. **Inference Engine**: Tracks derivation chains for transparency
4. **Applied Filters Array**: Response already includes applied constraints for traceability

### New Components Needed

1. **Diagnosis Service** (`diagnosis.service.ts`): Orchestrates conflict detection and relaxation generation, called from `search.service.ts` when `totalCount < 3`
2. **Constraint Tester**: Runs single-constraint-removal queries efficiently (can reuse existing query builder with constraint omission)
3. **Relaxation Generator**: Computes meaningful relaxation options per constraint type
4. **Explanation Generator**: Creates human-readable conflict explanations
5. **Response Schema Update**: Extend `SearchFilterResponse` type with optional `diagnosis` field

## Historical Context (from thoughts/)

### Existing Project 2 Research

| Document | Purpose |
|----------|---------|
| `2026-01-08-project-2-seed-data-analysis.md` | Analyzed seed data gaps for conflict scenarios |
| `2026-01-08-40-engineer-seed-specification.md` | Designed 40-engineer distribution |
| `2026-01-08-seed-data-realism-evaluation.md` | Validated market realism |
| `2026-01-08-40-engineer-seed-implementation.md` | 7-phase implementation plan (completed) |
| `2026-01-10-40-engineer-plan-verification.md` | Verified implementation correctness |

### Seed Data Preparation (Completed)

The 40-engineer seed data has already been implemented (merged in PR #5), specifically designed to enable meaningful constraint relaxation scenarios with:
- Varied experience levels (0-12 years)
- Multiple timezone regions (Americas, Europe, APAC)
- Diverse availability timelines
- Overlapping but distinct skill profiles
- Business and technical domain coverage

## Code References

- `recommender_api/src/services/search.service.ts:45-150` - Main search orchestration
- `recommender_api/src/services/constraint-expander.service.ts:1-200` - Constraint expansion logic
- `recommender_api/src/services/inference-engine.service.ts:1-400` - Rule engine implementation
- `recommender_api/src/services/cypher-query-builder/search-query.builder.ts:1-300` - Cypher generation
- `recommender_api/src/schemas/search.schema.ts:1-150` - Request validation schemas
- `seeds/engineers.ts:1-1152` - 40-engineer seed data

## Related Research

- `thoughts/shared/1_chapter_5/2_project_2/research/2026-01-08-project-2-seed-data-analysis.md`
- `thoughts/shared/1_chapter_5/2_project_2/plans/2026-01-08-40-engineer-seed-implementation.md`

## Open Questions

1. **Algorithm Choice**: Should we implement the simple O(n) single-removal algorithm or a more sophisticated algorithm like QUICKXPLAIN for minimal sets?

2. **Conflict Set Size Limit**: Should we limit the number of conflict sets returned (e.g., top 3 most impactful)?

3. **Relaxation Granularity**: How fine-grained should numerical relaxation suggestions be (e.g., experience: 10→9→8→7 vs 10→7→5)?

4. **Derived Constraint Treatment**: Should relaxation suggestions include "disable inference rule X" as an option?

5. **Section 5.2.5 Scope**: Should we also implement "adding constraints" suggestions when too many results are returned, or focus only on relaxation?

## Resolved Questions

1. ~~**Separate Endpoint vs Integration**~~: **Decided** - Integrate into `/api/search/filter`. Auto-triggers when results are sparse. No new request parameters.

2. ~~**Auto-Trigger Threshold**~~: **Decided** - Trigger when `totalCount < 3`. Can adjust later if needed.
