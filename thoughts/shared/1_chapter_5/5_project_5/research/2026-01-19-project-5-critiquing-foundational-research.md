---
date: 2026-01-19T12:00:00-08:00
researcher: Claude
git_commit: d0c4c8a9e055f1909396e862024f79ca9fc3403f
branch: main
repository: recommender_system
topic: "Project 5: Critiquing System Foundational Research"
tags: [research, codebase, critiquing, project-5, chapter-5]
status: complete
last_updated: 2026-01-19
last_updated_by: Claude
last_updated_note: "Updated dynamic critique algorithm to match textbook 5.3.2.3 (minimum support threshold, ascending order)"
---

# Research: Project 5 Critiquing System - Foundational Analysis

**Date**: 2026-01-19T12:00:00-08:00
**Researcher**: Claude
**Git Commit**: d0c4c8a9e055f1909396e862024f79ca9fc3403f
**Branch**: main
**Repository**: recommender_system

## Research Question

What foundational components exist in the current codebase that can be reused for Project 5 (Critiquing System), and what new components need to be built? Additionally, evaluate the proposed API schema simplification: using a single `adjustments[]` array instead of discriminating between simple vs compound critique types.

---

## Summary

The existing codebase provides **substantial infrastructure** that can be directly reused for critiquing:

1. **Search pipeline** (constraint expansion, inference engine, query builders) - ~80% reusable
2. **Similarity calculator** (graph-aware scoring) - fully reusable for critique recommendations
3. **Constraint advisor** (what-if testing, distribution analysis) - directly applicable to dynamic critiques
4. **Type system patterns** (discriminated unions, Zod schemas) - proven patterns to follow

**New components needed:**
- Critique request/response types and Zod schema
- Critique interpreter (translates directional adjustments to constraint modifications)
- Dynamic critique generator (data-mines current results for suggestions)
- Session/history tracking (optional, for multi-turn critiquing)

**API Design Agreement:** The user's suggestion to simplify the schema is correct. A single `adjustments[]` array is cleaner - one adjustment = simple critique, multiple adjustments = compound critique. No need for explicit `type: 'simple' | 'compound'` discrimination.

---

## Textbook Context: Section 5.3.2 Critiquing Methods

### Key Concepts

**Three critique types:**

1. **Simple Critiques (5.3.2.1)**: Single attribute adjustment
   - "More experience" → increases yearsExperience threshold
   - "Cheaper" → lowers salary cap
   - Two forms: **directional** (more/less) or **replacement** (different value)

2. **Compound Critiques (5.3.2.2)**: Multiple attribute adjustments in one cycle
   - "More experienced AND closer timezone" → both constraints tightened
   - Reduces recommendation cycles
   - Can use informal descriptions ("roomier", "classier") that map to multiple features

3. **Dynamic Critiques (5.3.2.3)**: Data-mined suggestions from current results
   - Use **frequent pattern mining** on current results
   - Filter by **minimum support threshold** (only show patterns above configurable minimum)
   - Order by **ascending support** (low-support patterns first)

**Key insights from textbook (p.193):**
> "This approach determines all the patterns of change that specify a pre-defined minimum support value."

> "Many recommender systems order the critiques to the user in ascending order of support. The logic for this approach is that low support critiques are often less obvious patterns that can be used to eliminate a larger number of items from the candidate list."

**Why ascending order matters:** High-support patterns (e.g., "80% have Python") are obvious to users and eliminate few items. Low-support patterns (e.g., "15% have Fintech + senior") are non-obvious discoveries that significantly narrow results.

### Mapped to Our Domain

| Textbook Concept | Engineer Recommender Equivalent |
|------------------|--------------------------------|
| "Cheaper" | Lower salary expectations |
| "Roomier" | More experienced (more years) |
| "Different locality" | Different timezone |
| "More bedrooms" | More required skills |
| Support-ordered suggestions | "60% of matches have Python" |

---

## Current Codebase Architecture Analysis

### What We Have (Completed Projects 1-4)

```
recommender_api/src/
├── services/
│   ├── search.service.ts           # Main orchestration
│   ├── skill-resolver.service.ts   # Skill hierarchy expansion
│   ├── constraint-expander.service.ts  # Constraint→DB translation
│   ├── inference-engine.service.ts # Forward-chaining rules
│   ├── filter-similarity.service.ts # Hybrid filter+similarity
│   ├── similarity.service.ts       # Pure similarity
│   ├── cypher-query-builder/       # Unified query generation
│   ├── utility-calculator/         # 11-component scoring
│   ├── similarity-calculator/      # 4-component similarity
│   └── constraint-advisor/         # Relaxation/tightening
├── types/
│   ├── search.types.ts             # Filter request/response
│   ├── filter-similarity.types.ts  # Hybrid types
│   └── (discriminated unions throughout)
└── schemas/
    ├── search.schema.ts            # Zod validation
    └── filter-similarity.schema.ts
```

### Reusability Analysis by Component

#### 1. Search Pipeline (90% Reusable)

| Component | Reusable? | Notes |
|-----------|-----------|-------|
| skill-resolver.service.ts | ✓ Full | Expands skill hierarchies |
| constraint-expander.service.ts | ✓ Full | Converts to DB constraints |
| inference-engine.service.ts | ✓ Full | Applies inference rules |
| search-query.builder.ts | ✓ Full | Builds Cypher queries |
| utility-calculator/ | ✓ Full | Scores results |
| engineer-record-parser.ts | ✓ Full | Parses Neo4j results |

**For critiquing:** Critiques modify constraints, then re-run the exact same pipeline.

#### 2. Similarity Calculator (Fully Reusable)

| Component | Reusable? | Notes |
|-----------|-----------|-------|
| graph-loader.ts | ✓ Full | Load skill/domain graphs |
| skill-similarity.ts | ✓ Full | Graph-aware skill matching |
| domain-similarity.ts | ✓ Full | Hierarchy-aware domains |
| diversity-selector.ts | ✓ Full | Prevent homogeneous results |

**For critiquing:** When showing "similar to critiqued result" recommendations.

#### 3. Constraint Advisor (Directly Applicable)

| Component | Reusable? | Notes |
|-----------|-----------|-------|
| constraint-decomposer.service.ts | ✓ Full | AppliedFilter → TestableConstraint |
| relaxation-tester.service.ts | ✓ Full | What-if queries |
| tightening-generator.service.ts | ✓ Adapt | Pattern for dynamic critiques |
| tightening-tester.service.ts | ✓ Full | Test constraint modifications |

**Key insight:** The tightening generator already does "analyze result distribution and suggest modifications" - this is exactly what dynamic critiques need.

#### 4. Type System (Patterns to Follow)

The codebase uses discriminated unions extensively:

```typescript
// Example: AppliedFilter discriminated by 'kind'
AppliedFilter = AppliedPropertyFilter | AppliedSkillFilter

// Example: RelaxationSuggestion discriminated by 'type'
RelaxationSuggestion = UserConstraintRelaxation | DerivedConstraintOverride
```

**For critiquing:** Follow the same pattern for CritiqueAdjustment types.

---

## Proposed API Design

### User Feedback on Schema Simplification

The original Project 5 spec in the learning path proposed:

```typescript
// OVER-COMPLICATED (from learning path)
{
  baseSearch: { ... },
  critique: {
    type: 'simple' | 'compound',  // Unnecessary discrimination
    attribute?: string,           // For simple
    direction?: string,           // For simple
    adjustments?: []              // For compound
  }
}
```

**User's insight is correct:** This is over-complicated. The `type` field is redundant:
- One adjustment = simple critique
- Multiple adjustments = compound critique

### Simplified Schema (Recommended)

```typescript
interface CritiqueRequest {
  /*
   * Base search to critique - can be:
   * - Previous SearchFilterRequest (stored by client)
   * - Reference to stored search session (if we implement sessions)
   */
  baseSearch: SearchFilterRequest;

  /*
   * Adjustments to apply. Array length determines critique type:
   * - 1 item = simple critique
   * - 2+ items = compound critique
   */
  adjustments: CritiqueAdjustment[];

  /* Pagination */
  limit?: number;   // default 10
  offset?: number;  // default 0
}
```

### CritiqueAdjustment: Discriminated Union

```typescript
type CritiqueAdjustment =
  | DirectionalCritique      // "more" / "less"
  | ReplacementCritique      // "different value"
  | SkillCritique;           // Skill-specific adjustments

interface DirectionalCritique {
  kind: 'directional';
  attribute: CritiquableAttribute;
  direction: 'more' | 'less' | 'sooner' | 'later' | 'closer' | 'farther';
}

interface ReplacementCritique {
  kind: 'replacement';
  attribute: CritiquableAttribute;
  value: unknown;  // Type depends on attribute
}

interface SkillCritique {
  kind: 'skill';
  action: 'add' | 'remove' | 'strengthen' | 'weaken';
  skill: string;
  proficiency?: ProficiencyLevel;  // For add/strengthen
}
```

### Critiquable Attributes

```typescript
type CritiquableAttribute =
  | 'yearsExperience'     // more/less → adjust seniority/years
  | 'salary'              // more/less → adjust budget
  | 'startTimeline'       // sooner/later → adjust availability
  | 'timezone'            // closer/farther → adjust zones
  | 'skills';             // Use SkillCritique instead
```

### Response Structure

```typescript
interface CritiqueResponse {
  /* Results after applying critique */
  matches: EngineerMatch[];
  totalCount: number;

  /* What was actually applied (transparency) */
  appliedFilters: AppliedFilter[];
  appliedPreferences: AppliedPreference[];
  derivedConstraints: DerivedConstraintInfo[];

  /* Critique-specific */
  critiqueApplied: {
    adjustments: AppliedCritiqueAdjustment[];  // What was actually changed
    previousResultCount: number;                // Before critique
    resultCountChange: number;                  // +/- change
  };

  /* Dynamic critique suggestions (Section 5.3.2.3) */
  suggestedCritiques?: DynamicCritiqueSuggestion[];

  /* Constraint advice (reuse existing) */
  relaxation?: RelaxationResult;    // If too few results after critique
  tightening?: TighteningResult;    // If too many results after critique

  queryMetadata: QueryMetadata;
}

interface DynamicCritiqueSuggestion {
  adjustments: CritiqueAdjustment[];  // The suggested critique
  description: string;                 // Human-readable description
  resultingMatches: number;           // How many results this yields
  support: number;                     // % of current results (0-1)
}
```

---

## Implementation Analysis: What to Build

### New Components Needed

#### 1. Critique Schema & Types (~200 lines)

**Files:**
- `schemas/critique.schema.ts` - Zod validation
- `types/critique.types.ts` - Request/response types

**Pattern:** Follow existing `filter-similarity.schema.ts` as template.

#### 2. Critique Interpreter Service (~300 lines)

**File:** `services/critique-interpreter.service.ts`

**Purpose:** Translate directional/replacement critiques into constraint modifications.

```typescript
/*
 * Input: CritiqueAdjustment[]
 * Output: Modified SearchFilterRequest
 *
 * Example:
 * { kind: 'directional', attribute: 'yearsExperience', direction: 'more' }
 * + baseSearch: { requiredSeniorityLevel: 'mid' }
 * = Modified: { requiredSeniorityLevel: 'senior' }
 */
function applyCritiques(
  baseSearch: SearchFilterRequest,
  adjustments: CritiqueAdjustment[]
): SearchFilterRequest
```

**Direction mappings (configurable):**

| Attribute | Direction | Effect |
|-----------|-----------|--------|
| yearsExperience | more | Increase requiredSeniorityLevel one step |
| yearsExperience | less | Decrease requiredSeniorityLevel one step |
| salary | more | Increase maxBudget by 20% |
| salary | less | Decrease maxBudget by 20% |
| startTimeline | sooner | Move requiredMaxStartTime earlier |
| startTimeline | later | Move requiredMaxStartTime later |
| timezone | closer | Narrow to adjacent zones only |
| timezone | farther | Expand to all zones |

**Key insight:** These mappings should be in config, not hardcoded, following the pattern in `relaxation-strategies.config.ts`.

#### 3. Dynamic Critique Generator (~400 lines)

**File:** `services/critique-generator/dynamic-critique-generator.service.ts`

**Purpose:** Analyze current results and suggest useful critiques (Section 5.3.2.3).

**Reuse from constraint-advisor:**
- `tightening-generator.service.ts` pattern for distribution analysis
- `tightening-tester.service.ts` for what-if queries

**Algorithm (from textbook p.193):**

```
1. MINE PATTERNS
   For each critiquable attribute (skills, timezone, seniority, etc.):
   - Compute distribution in current results
   - Generate candidate critique patterns (single and compound)

2. FILTER BY MINIMUM SUPPORT
   - Only keep patterns where support >= minSupportThreshold (default: 0.15)
   - Eliminates patterns too rare to be meaningful

3. ORDER BY ASCENDING SUPPORT
   - Sort patterns from lowest to highest support
   - Low-support patterns shown first (they're less obvious, eliminate more items)

4. LIMIT AND RETURN
   - Return top maxSuggestions patterns (default: 5)
```

**Why ascending order?**
- High-support patterns (e.g., "60% have Python") are **obvious** to users
- Low-support patterns (e.g., "15% have Fintech + Pacific timezone") are **non-obvious discoveries**
- Non-obvious patterns eliminate more items, making them more useful for narrowing

**Example output** (20 current results, ordered by ascending support):
```typescript
suggestedCritiques: [
  // Low support first (most useful for filtering)
  {
    adjustments: [
      { kind: 'replacement', attribute: 'timezone', value: 'Pacific' },
      { kind: 'directional', attribute: 'yearsExperience', direction: 'more' }
    ],
    description: 'Senior engineers in Pacific timezone',
    resultingMatches: 3,
    support: 0.15  // Only 15% match—non-obvious compound pattern
  },
  {
    adjustments: [
      { kind: 'skill', action: 'add', skill: 'Fintech', proficiency: 'proficient' }
    ],
    description: 'Add Fintech domain experience',
    resultingMatches: 4,
    support: 0.20  // 20% have Fintech—useful filter
  },
  // Higher support last (more obvious, less useful)
  {
    adjustments: [
      { kind: 'skill', action: 'add', skill: 'Python', proficiency: 'proficient' }
    ],
    description: 'Add Python requirement',
    resultingMatches: 12,
    support: 0.60  // 60% have Python—obvious pattern
  }
]
```

**Configuration:**
- `minSupportThreshold`: Minimum support to include (default: 0.15)
- `maxSuggestions`: Maximum suggestions to return (default: 5)

#### 4. Critique Controller & Routes (~100 lines)

**Files:**
- `controllers/critique.controller.ts`
- Update `routes/search.routes.ts` to add `POST /api/search/critique`

**Pattern:** Follow `filter-similarity.controller.ts`.

#### 5. Critique Service (Orchestration) (~250 lines)

**File:** `services/critique.service.ts`

**Purpose:** Orchestrate the full critique flow.

**Flow:**
```
POST /api/search/critique
       │
       ▼
┌────────────────────────────────────────────────────┐
│              executeCritique()                      │
│                                                     │
│  1. Validate request (Zod schema)                   │
│  2. Parse baseSearch                                │
│  3. Apply critique adjustments                      │
│     └─ critique-interpreter.service.ts             │
│  4. Execute modified search                         │
│     └─ REUSE: search.service.ts executeSearch()    │
│  5. Generate dynamic critique suggestions           │
│     └─ dynamic-critique-generator.service.ts       │
│  6. Get constraint advice (if sparse/many)          │
│     └─ REUSE: constraint-advisor.service.ts        │
│  7. Assemble response                               │
│                                                     │
└────────────────────────────────────────────────────┘
       │
       ▼
CritiqueResponse
```

---

## Reuse Summary

| Component | Reuse Level | Notes |
|-----------|-------------|-------|
| search.service.ts | Full | Core search pipeline |
| skill-resolver.service.ts | Full | Skill expansion |
| constraint-expander.service.ts | Full | Constraint translation |
| inference-engine.service.ts | Full | Rule-based expansion |
| utility-calculator/ | Full | Result scoring |
| similarity-calculator/ | Full | For similarity-based suggestions |
| constraint-advisor/ | Adapt | What-if testing patterns |
| tightening-generator.service.ts | Adapt | Distribution analysis patterns |
| cypher-query-builder/ | Full | Query generation |
| Zod schema patterns | Pattern | Follow for new schemas |
| Discriminated union patterns | Pattern | Follow for new types |

**Estimated new code:** ~1,250 lines
**Estimated reused code:** ~5,000+ lines (existing infrastructure)

---

## Architecture Insights

### Why This Is Simpler Than It Looks

The textbook presents critiquing as a distinct paradigm, but in our implementation:

1. **Critiques ARE constraint modifications** - They don't require a new search engine
2. **We already have the pipeline** - Constraint expansion → Query → Score → Respond
3. **Dynamic critiques ARE distribution analysis** - We built this for tightening suggestions

The new work is primarily:
- **Translation layer** (critique → constraint modification)
- **Suggestion generator** (find non-obvious patterns)
- **API surface** (request/response types)

### Session/History Considerations

The textbook mentions (p.190):
> "When multiple critiques are specified in sequential recommendation cycles, preference is given to more recent critiques."

**Options:**
1. **Stateless (recommended initially):** Client sends full baseSearch each time
2. **Stateful:** Server tracks session history, applies critique chains

**Recommendation:** Start stateless. Client can track history. Add server sessions later if needed.

---

## Open Questions for Implementation

1. **Critique step sizes:** How much should "more experience" increase the threshold?
   - Option A: Fixed steps (senior → staff → principal)
   - Option B: Percentage-based (10% more years)
   - **Recommendation:** Use the seniority ladder (ordinal) - follows existing patterns

2. **Conflicting critiques:** What if user says "more experience" but already at principal?
   - Return warning in response, don't modify
   - Similar to how we handle overriddenRuleIds

3. **Critique persistence:** Should we store critique history?
   - Not for MVP. Add sessionId support later if needed.

4. **Dynamic critique configuration:**
   - **minSupportThreshold:** What minimum support to include? (default: 0.15)
     - Too low (< 10%): Patterns too rare to be useful
     - Too high (> 50%): Only obvious patterns shown
   - **maxSuggestions:** How many to return? (default: 5)
   - **Compound pattern mining:** Should we mine compound patterns (multi-attribute)?
     - Textbook: Yes, dynamic critiques are "by definition" compound
     - Implementation complexity: Higher, but more valuable suggestions

5. **Pattern mining scope:** What attributes to mine patterns for?
   - **Definitely:** Skills, timezone, seniority level
   - **Maybe:** Domain experience, salary buckets
   - **Probably not:** Timeline (too transient)

---

## Related Research

- `thoughts/shared/1_chapter_5/1_project_1/project_1_summary.md` - Constraint search foundation
- `thoughts/shared/1_chapter_5/2_project_2/project_2_summary.md` - Constraint advisor (QUICKXPLAIN, relaxation)
- `thoughts/shared/1_chapter_5/3_project_3/project_3_summary.md` - Similarity scoring
- `thoughts/shared/1_chapter_5/4_project_4/project_4_summary.md` - Hybrid filter+similarity

---

## Conclusion

**Project 5 is highly achievable** given the existing infrastructure. The core insight is that critiquing is fundamentally a constraint modification system - we're translating user-friendly adjustment requests into the constraint language we already process.

**Key decisions validated:**
1. ✓ Simplify schema: Use `adjustments[]` array, not explicit simple/compound discrimination
2. ✓ Reuse search pipeline: Critiques modify constraints, then run existing search
3. ✓ Adapt tightening patterns: Dynamic critiques use same distribution analysis approach
4. ✓ Follow type patterns: Discriminated unions for adjustment types

**Estimated effort:** ~1,250 lines new code, ~2-3 days implementation given the foundation.

---

## Learning Plan Alignment

The learning plan (`docs/chapter_5/chapter5_reading_and_learning_path.md`) was updated to align with this research:

**Changes made to Project 5 requirements:**

1. **Simplified request schema**: Unified `adjustments[]` array instead of `type: 'simple' | 'compound'`
   - 1 adjustment = simple critique (5.3.2.1)
   - Multiple adjustments = compound critique (5.3.2.2)

2. **Added dynamic critique algorithm details** (5.3.2.3):
   - Mine patterns from current results
   - Filter by minimum support threshold
   - Order by **ascending support** (low-support first)
   - Rationale: Low-support patterns are less obvious and eliminate more items

3. **Added configuration options**:
   - `minSupportThreshold` (default: 0.15)
   - `maxSuggestions` (default: 5)

4. **Updated subsection details** to emphasize the algorithm requirements

This research document and the learning plan are now aligned on the Project 5 requirements.
