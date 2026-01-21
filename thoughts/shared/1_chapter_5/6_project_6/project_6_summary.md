# Project 6: Explanation Generation & Skill Hierarchy Fixes

**Status**: Complete
**Duration**: January 20-21, 2026
**Branch**: `project_6`
**Git Commit**: 0d107c359a9d06625019ea2df3be0145e798f1b3

---

## Executive Summary

Project 6 implements two major features:

1. **Explanation Generation**: A new `POST /api/search/filter/:engineerId/explain` endpoint that explains why a specific engineer matches (or doesn't match) search criteria, with constraint satisfaction details, score breakdowns, skill evidence, tradeoff detection, and optional LLM-generated narratives.

2. **Skill Hierarchy Expansion Bug Fix**: Corrected backwards expansion behavior where requesting "Node.js" incorrectly required ALL descendants (Node.js + Express + NestJS). Now uses HAS_ANY semantics where having any skill from the expanded set satisfies the requirement.

**Follow-on work** unified derived skill filtering: inference-derived skills now go through the same hierarchy expansion and filtering mechanism as user-requested skills, eliminating the `HAS_ALL` operator entirely from the codebase.

---

## Problem Statement

### Problem 1: No Way to Explain Individual Matches

Projects 1-5 implemented search, filtering, similarity, and critiquing. But when a hiring manager drills into a specific engineer, there's no way to understand:
- Which requirements they satisfy and how (direct vs descendant skill match)
- How each scoring component contributed to their ranking
- What evidence backs their skill claims (interview stories, assessments, certifications)
- What tradeoffs exist vs the ideal profile

### Problem 2: Skill Hierarchy Expansion Was Backwards

**User Request:**
```json
{ "requiredSkills": [{"skill": "Node.js"}] }
```

**Buggy Behavior:**
1. Skill resolver expanded "Node.js" → `[Node.js, Express, NestJS]`
2. Constraint expander created filter with `operator: 'HAS_ALL'`
3. Engineer had to have ALL THREE skills to match
4. Result: Priya (who has Node.js but not Express/NestJS) failed the search

**Expected Behavior:**
- User requests "Node.js" → Engineer with Node.js OR Express OR NestJS matches
- An engineer with Express (child of Node.js) satisfies the requirement via "descendant match"

---

## Solution Overview

### Solution 1: Explanation Generation

A new endpoint that reuses the existing search pipeline with an `engineerId` filter, then delegates to four specialized explanation generators:

| Generator | Output | Purpose |
|-----------|--------|---------|
| constraint-explanation | `ConstraintExplanation[]` | Which filters are satisfied, how (direct/descendant/correlated) |
| score-explanation | `ScoreExplanation[]` | How each scoring component contributed |
| evidence-explanation | `EvidenceExplanation[]` | STAR stories, assessment performances, certifications |
| tradeoff-explanation | `TradeoffExplanation[]` | Gaps between preferences and reality |

Plus optional LLM-generated narrative for rich prose explanations.

### Solution 2: Skill Hierarchy Fix

Changed the filter operator from `HAS_ALL` to `HAS_ANY` and introduced `ResolvedSkillRequirement` to track each user request independently:

| Aspect | Before | After |
|--------|--------|-------|
| **Operator** | HAS_ALL (must have all) | HAS_ANY (must have any one) |
| **Grouping** | Flat list of skill IDs | Per-requirement with expanded set |
| **Matching** | Engineer had to match all skills | Engineer needs ≥1 skill from EACH requirement |
| **Derived skills** | No hierarchy expansion | Same expansion as user skills |

---

## API Design

### Endpoint

```
POST /api/search/filter/:engineerId/explain
```

### Request Schema

```typescript
{
  searchCriteria: SearchFilterRequest;  // Same as /filter endpoint
}
```

### Response Schema

```typescript
{
  engineer: {
    id: string;
    name: string;
    headline: string;
  };
  matchScore: number;

  // Quick text summaries
  summary: {
    constraints: string;      // "Matches all 5 requirements"
    strengths: string;        // "Strongest: skill proficiency (92%)"
    tradeoffs: string;        // "No significant tradeoffs"
    narrative: string | null; // LLM-generated prose
  };

  // Structured explanations
  constraints: ConstraintExplanation[];
  scores: ScoreExplanation[];
  evidence: EvidenceExplanation[];
  tradeoffs: TradeoffExplanation[];
}
```

---

## Implementation Architecture

### File Structure

```
recommender_api/src/
├── routes/search.routes.ts                       # Route registration (line 49)
├── controllers/search-match-explanation.controller.ts  # HTTP handler
├── schemas/search-match-explanation.schema.ts    # Zod validation
├── types/search-match-explanation.types.ts       # All explanation types
├── services/
│   ├── search-match-explanation/
│   │   ├── search-match-explanation.service.ts   # Orchestrator
│   │   ├── constraint-explanation.service.ts     # Filter satisfaction
│   │   ├── score-explanation.service.ts          # Score breakdowns
│   │   ├── evidence-explanation.service.ts       # Evidence fetching
│   │   ├── evidence-query.service.ts             # Neo4j evidence queries
│   │   ├── tradeoff-explanation.service.ts       # Tradeoff detection
│   │   └── index.ts                              # Module exports
│   ├── skill-resolver.service.ts                 # ResolvedSkillRequirement
│   ├── constraint-expander.service.ts            # HAS_ANY filters
│   └── cypher-query-builder/
│       ├── query-types.ts                        # SkillFilterRequirement
│       └── search-query.builder.ts               # Per-group Cypher
└── config/knowledge-base/
    ├── utility.config.ts                         # Score weights
    └── compatibility-constraints.config.ts       # Seniority mapping
```

### Data Flow: Explanation Generation

```
POST /api/search/filter/eng_priya/explain
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│              generateSearchMatchExplanation()                        │
│                                                                      │
│  1. executeSearch() with engineerId filter                          │
│     → Returns EngineerMatch with computed scores, matchTypes        │
│                                                                      │
│  2. generateConstraintExplanations(appliedFilters, engineerMatch)   │
│     → ConstraintExplanation[] with satisfaction & matchType         │
│                                                                      │
│  3. generateScoreExplanations(scoreBreakdown)                       │
│     → ScoreExplanation[] with weights & contributing factors        │
│                                                                      │
│  4. generateEvidenceExplanations(session, engineerId, skillIds)     │
│     → EvidenceExplanation[] with STAR stories, assessments, certs   │
│                                                                      │
│  5. detectTradeoffs(engineerProfile, searchPreferences)             │
│     → TradeoffExplanation[] for preference gaps                     │
│                                                                      │
│  6. generateLLMNarrative() (optional)                               │
│     → Human-readable prose explanation                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
       │
       ▼
SearchMatchExplanation response
```

### Data Flow: Skill Filtering (Fixed)

```
User: { requiredSkills: [{skill: "Node.js"}, {skill: "TypeScript"}] }
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    skill-resolver.service.ts                         │
│                                                                      │
│  resolveSkillRequirements() → [                                     │
│    { originalId: "Node.js", expandedIds: [node, express, nestjs] }, │
│    { originalId: "TypeScript", expandedIds: [typescript] }          │
│  ]                                                                   │
└─────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 constraint-expander.service.ts                       │
│                                                                      │
│  trackSkillsAsConstraints() → [                                     │
│    { operator: 'HAS_ANY', skills: [node,express,nestjs] },          │
│    { operator: 'HAS_ANY', skills: [typescript] }                    │
│  ]                                                                   │
└─────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│               search-query.builder.ts                                │
│                                                                      │
│  WHERE SIZE([x IN qualifyingSkillIds WHERE x IN $skillGroup0]) > 0  │
│    AND SIZE([x IN qualifyingSkillIds WHERE x IN $skillGroup1]) > 0  │
│                                                                      │
│  (HAS_ANY within each group, AND between groups)                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### 1. Separate Endpoint vs Inline Explanations

**Decision**: Create a separate `/:engineerId/explain` endpoint instead of embedding explanations in search results.

**Rationale**:
- Evidence queries are expensive (graph traversal to stories, assessments, certs)
- LLM calls add latency (~500ms-2s per call)
- Search results are for scanning 10-25 engineers; explanations are for drilling into 1-3
- Response size stays manageable

### 2. Reuse executeSearch with engineerId Filter

**Decision**: Add optional `engineerId` to SearchFilterRequest and filter the search to one engineer.

**Rationale**:
- Guarantees consistent matchType, scores, and constraints with `/filter` endpoint
- No reimplementation of complex matching logic
- Single source of truth for how engineers are evaluated

### 3. HAS_ANY Per-Requirement with AND Between Requirements

**Decision**: Each skill requirement creates a filter with HAS_ANY semantics; multiple requirements are ANDed.

**Rationale**:
- Matches user intent: "I want someone who knows Node.js AND TypeScript"
- Descendant matching: "having Express satisfies Node.js requirement"
- Multiple requirements create independent filters, not one giant filter

### 4. Unified Skill Filtering for User and Derived Skills

**Decision**: Both user-requested skills and inference-derived skills go through the same hierarchy expansion and `SkillFilterRequirement` mechanism.

**Rationale**:
- Consistency: same engineer with Express should match "Node.js" whether it came from user or inference rule
- Single code path for skill filtering
- `HAS_ALL` removed entirely from the type system

### 5. Tradeoffs Focus on Preferences, Not Requirements

**Decision**: `TradeoffExplanation` only examines preferred criteria, not required constraints.

**Rationale**:
- Failing a required constraint is disqualification, not a tradeoff
- Tradeoffs imply you're still considering the engineer despite the gap
- Required constraints are handled by `ConstraintExplanation.satisfied`

### 6. Facts Not Judgments in Tradeoffs

**Decision**: Tradeoff explanations report "Has X, wanted Y" without severity/direction labels.

**Rationale**:
- Severity is subjective (10% over budget might be "minor" or "significant" depending on context)
- Direction can be misleading ("over" on experience isn't necessarily bad)
- Let the hiring manager interpret the facts based on their constraints

---

## Textbook Alignment

### Section 5.3.3: Explanation in Critiques

The textbook describes three types of explanations:
1. **Constraint satisfaction** - Which requirements are met
2. **Score contribution** - How each factor affects ranking
3. **Evidence** - Proof backing claims

Our implementation adds:
4. **Tradeoffs** - Gaps between preferences and reality (complements constraint satisfaction)
5. **LLM narrative** - Rich prose synthesis (extends basic explanations)

---

## Testing

### Unit Tests (816 total, 20 new for explain endpoint)

| Module | Tests | Coverage |
|--------|-------|----------|
| constraint-explanation.service.test.ts | 7 | Direct/descendant/missing skills, property constraints |
| tradeoff-explanation.service.test.ts | 13 | All 5 tradeoff types, summarization |
| search-query.builder.test.ts (skill filter groups) | ~10 | Per-group HAS_ANY, derived skill handling |
| constraint-expander.service.test.ts (HAS_ANY) | ~8 | Filter creation with HAS_ANY operator |

### E2E Tests (97 scenarios, 321 assertions)

| Test # | Name | Key Verification |
|--------|------|------------------|
| 89 | Basic Explain for eng_priya | All sections populated |
| 90 | Explain with All Constraint Types | Multiple constraint explanations |
| 91 | Explain for eng_james (Different Engineer) | Works across engineers |
| 92 | Explain with Inference Rules | Shows derived constraints |
| 93 | Explain with Tradeoff Detection | Tradeoffs in response |
| 94 | Explain with Multiple Constraints | Complex scenarios |
| 95 | Evidence Structure Validation | STAR format, analysis scores |
| 96 | Experience Tradeoff Detection | Under-seniority tradeoff |
| 97 | Stretch Budget Tradeoff | Salary over budget but in stretch |

**All 97 requests and 321 assertions pass.**

---

## Configuration Reference

### Score Weights (from utility.config.ts)

| Component | Weight | Description |
|-----------|--------|-------------|
| skillMatch | 0.35 | Proficiency match on required skills |
| confidence | 0.15 | Confidence in skill assessments |
| yearsExperience | 0.10 | Experience level |
| preferredSkillsMatch | 0.10 | Match on preferred skills |
| teamFocusMatch | 0.05 | Alignment with team focus |
| relatedSkillsMatch | 0.05 | Additional related skills |
| (preferences) | 0.05-0.10 | Various preference matches |

### Seniority Mapping (from compatibility-constraints.config.ts)

| Level | Min Years | Max Years |
|-------|-----------|-----------|
| junior | 0 | 2 |
| mid | 3 | 5 |
| senior | 6 | 10 |
| staff | 10 | null |
| principal | 15 | null |

---

## Metrics

| Metric | Value |
|--------|-------|
| Implementation plans | 4 |
| Code walkthroughs | 2 |
| New service files | 7 (search-match-explanation/*) |
| Modified service files | ~12 (skill filtering changes) |
| New type definitions | ~15 |
| Lines of code (new) | ~2,500 |
| Unit tests | 816 (20+ new) |
| E2E scenarios | 97 (9 new) |
| Total test assertions | ~321 |

---

## What We're NOT Doing

Per plan scope:
- **Search state management**: No `searchId` parameter; criteria passed in body (stateless)
- **Conflict explanations in explain endpoint**: Already handled by Project 2.5's conflict-explanation.service
- **Caching**: Deferred until latency becomes an issue
- **Inline explanations in search results**: Separate endpoint for performance

---

## Lessons Learned

1. **Reusing executeSearch was the right call**: By passing `engineerId` to the existing search pipeline, we get consistent matchType, scores, and constraints without reimplementing matching logic.

2. **Per-requirement skill grouping clarifies semantics**: The `ResolvedSkillRequirement` structure makes it obvious that "Node.js AND TypeScript" means "one from Node.js hierarchy AND one from TypeScript hierarchy," not "all of [node, express, nestjs, typescript]."

3. **HAS_ALL had no valid use case**: Every scenario that seemed to need "all skills" was better modeled as multiple independent requirements ANDed together.

4. **Facts over judgments in tradeoffs**: Users appreciate objective data ("salary is $15k over budget") more than subjective labels ("significant budget concern").

5. **Unified skill filtering simplifies debugging**: Having both user and derived skills use the same mechanism means fewer special cases and consistent behavior.

6. **Evidence queries should be lazy**: Fetching stories, assessments, and certifications is expensive; doing it only for the `/explain` endpoint (not inline with search) keeps the main search fast.

---

## Follow-on Work Completed

### 1. Derived Skill Hierarchy Expansion
Inference-derived skills now go through `expandSkillHierarchy()` just like user skills. If an inference rule derives "Node.js" requirement, engineers with Express (a descendant) now match.

### 2. Unified SkillFilterRequirement Pattern
The constraint advisor services (relaxation-tester, tightening-tester, tightening-generator) were refactored to use the same `SkillFilterRequirement[]` mechanism as the main search.

### 3. Narrative Accuracy Fixes
- Experience explanations now use raw 0-1 scores instead of weighted scores for correct year calculation
- Preferred skills tradeoffs now show the original user request count instead of expanded skill count

### 4. Per-Requirement Preferred Skill Preferences
Changed preferred skills handling to create one `AppliedSkillPreference` per requirement instead of flattening all into a single preference.

### 5. Code Cleanup
- Removed unused `resolvedRequiredSkills` and `resolvedPreferredSkills` parameters
- Extracted `buildSkillFilterBase` helper for count/distribution queries

---

## Future Considerations

1. **Caching explain responses**: If latency becomes an issue, cache results by (engineerId, searchCriteria hash)
2. **Additional evidence types**: Integration with external credential verification, GitHub contributions
3. **Comparison explanations**: "Why engineer A ranked higher than engineer B"
4. **Batch explanations**: Explain multiple engineers in one call for shortlist summaries

---

## References

- **Implementation Plans**:
  - `thoughts/shared/1_chapter_5/6_project_6/plans/2026-01-20-project-6-explanation-generation.md`
  - `thoughts/shared/1_chapter_5/6_project_6/plans/2026-01-20-fix-skill-hierarchy-expansion-bug.md`
  - `thoughts/shared/1_chapter_5/6_project_6/plans/2026-01-20-remove-has-all-unify-skill-filtering.md`
  - `thoughts/shared/1_chapter_5/6_project_6/plans/2026-01-20-unify-constraint-advisor-skill-filtering.md`
- **Code Walkthroughs**:
  - `thoughts/shared/1_chapter_5/6_project_6/walkthroughs/2026-01-20-explanation-generation-walkthrough.md`
  - `thoughts/shared/1_chapter_5/6_project_6/walkthroughs/code-walkthrough-skill-hierarchy-expansion-fix.md`
- **Project 5 Summary**: `thoughts/shared/1_chapter_5/5_project_5/project_5_summary.md`
- **Textbook Section**: 5.3.3 (Explanation in Critiques)
