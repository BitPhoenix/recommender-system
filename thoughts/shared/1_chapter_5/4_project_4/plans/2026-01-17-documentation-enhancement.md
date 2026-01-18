# Documentation Enhancement Implementation Plan

## Overview

Add rich rationale comments from the research documents to the similarity scoring implementation. The documentation gap analysis has already identified the exact locations and provided the specific comment text to add.

## Current State Analysis

The implementation files have good **structural** documentation (what each file does, priority orders, formulas) but lack **rationale** documentation (why specific approaches were chosen, why particular values were selected). The research document `2026-01-16-project-3-similarity-scoring.md` contains excellent explanations with worked examples that would add significant value.

### Key Discoveries:
- All 5 files have header comments but miss the "why" explanations
- The gap analysis (`2026-01-17-documentation-gap-analysis.md`) provides ready-to-use comment blocks
- Comments follow the codebase convention: `/* */` block comments with leading asterisks

## Desired End State

Each similarity scoring file contains rationale comments explaining:
1. **skill-similarity.ts**: Why graph-aware instead of Jaccard, why symmetric averaging
2. **experience-similarity.ts**: Why α=0.5, what different α values mean
3. **domain-similarity.ts**: Why specific hierarchy values, why multiplicative years adjustment with 0.5 floor
4. **diversity-selector.ts**: Why 0.7/0.3 skill/domain weighting
5. **similarity.config.ts**: Enhanced timeline/salary exclusion rationale

### Verification:
- All tests pass (`npm test`)
- TypeScript compiles (`npm run typecheck`)
- Comments are correctly formatted and placed

## What We're NOT Doing

- Changing any logic or behavior
- Modifying test files
- Refactoring code structure
- Adding comments to files already well-documented (similarity-calculator.ts, graph-loader.ts, timezone-similarity.ts)

## Implementation Approach

Sequential edits to add block comments at specific locations. Each phase is one file to keep changes atomic and easy to verify.

---

## Phase 1: skill-similarity.ts - Add Graph-Aware Rationale

### Overview
Add the most impactful comment explaining why we use graph-aware similarity instead of Jaccard, with a concrete worked example.

### Changes Required:

**File**: `recommender_api/src/services/similarity-calculator/scoring/skill-similarity.ts`
**Location**: After line 14 (after the header comment, before imports)

```typescript
/*
 * Why graph-aware similarity instead of Jaccard?
 *
 * Pure Jaccard similarity treats all skills as equally different:
 *   - React vs Vue = React vs PostgreSQL (both count as "no overlap")
 *
 * Example comparison:
 *   Target: {React, Node.js, TypeScript, PostgreSQL}
 *   Candidate: {Vue, Python, Django, PostgreSQL}
 *
 *   Jaccard: intersection={PostgreSQL} / union=7 → 0.14
 *   Graph-aware: React→Vue(0.5), Node.js→Python(0.5), TypeScript→Vue(0.5), PostgreSQL→PostgreSQL(1.0)
 *               → average = 0.625
 *
 * The graph recognizes these engineers have similar *capabilities* even though
 * they use different specific technologies.
 *
 * Why symmetric (averaging both directions)?
 * This is analogous to F1 score averaging precision and recall:
 *   - Target→Candidate: "How well are target's skills covered?"
 *   - Candidate→Target: "How well are candidate's skills covered?"
 * A specialist and generalist would have very different scores depending on
 * which direction you measure. Symmetric average gives the balanced answer
 * to "how similar are these engineers?"
 */
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] All tests pass: `npm test`

---

## Phase 2: experience-similarity.ts - Add α Rationale

### Overview
Add explanation of what α=0.5 means in practice with concrete examples.

### Changes Required:

**File**: `recommender_api/src/services/similarity-calculator/scoring/experience-similarity.ts`
**Location**: After line 15 (after header comment, before imports)

```typescript
/*
 * Why α = 0.5 ("more_is_better" with partial tolerance)?
 *
 * α controls how we treat candidates with MORE experience than the target:
 *   - α = 0: Symmetric penalty (8 years vs 6 years penalized same as 4 years vs 6 years)
 *   - α = 0.5: Reduced penalty for overshoot (current setting)
 *   - α = 1: No penalty for overshoot
 *
 * Example with target = 6 years:
 *   - Candidate with 4 years: score = 0.9 (less experienced = less similar)
 *   - Candidate with 8 years: score = 0.95 (more experienced = slightly less similar)
 *
 * α=0.5 interpretation: "Find engineers around 6 years—a solid senior level.
 * Someone with 4 years may lack the seniority we need. Someone with 8 years
 * is closer to what we want, but a staff-level engineer might be overqualified—
 * they could get bored or expect faster promotion."
 *
 * If you wanted "more experience is always fine", use α=1 instead.
 */
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] All tests pass: `npm test`

---

## Phase 3: domain-similarity.ts - Add Hierarchy and Years Rationale

### Overview
Add two comments: one explaining the hierarchy values (siblings vs parent-child), and one explaining the years multiplier with 0.5 floor.

### Changes Required:

**File**: `recommender_api/src/services/similarity-calculator/scoring/domain-similarity.ts`

#### Change 1: After line 15 (after header comment, before imports)

```typescript
/*
 * Why these specific hierarchy values?
 *
 * Sibling domains (0.5): Fintech ↔ Banking both understand financial services,
 *   regulatory concerns, and industry patterns. Stronger overlap than parent-child.
 *
 * Parent-child (0.4): Finance → Fintech has relevant but less specific overlap.
 *   A Finance generalist understands financial concepts but may not know
 *   fintech-specific things like digital wallets or crypto regulations.
 *
 * Encompasses (0.4): Full Stack → Backend means the full-stack engineer has
 *   backend experience, but not as deep as a backend specialist.
 *
 * Why not pure Jaccard? Same problem as skills: Jaccard says Fintech ↔ Banking
 * have zero overlap because they're different IDs, even though someone with
 * Fintech experience likely understands financial services concepts.
 */
```

#### Change 2: After line 85 (after the years adjustment calculation, inside the if block)

Insert a comment explaining the multiplicative approach and floor after line 84:

```typescript
        /*
         * Why multiplicative (baseSim × yearsSim) instead of additive?
         *
         * Years should only matter when domains are related (baseSim > 0).
         * If domains are unrelated, 10 years in Gaming vs 10 years in Healthcare
         * should still be zero, not rescued by matching years.
         *
         * Why 0.5 floor?
         *
         * Without floor: Fintech(1yr) vs Fintech(10yr) → 1.0 × 0.1 = 0.10
         *   (years dominates! 9-year gap destroys the exact match)
         *
         * With floor: Fintech(1yr) vs Fintech(10yr) → 1.0 × 0.5 = 0.50
         *   (domain match still matters)
         *
         * The floor ensures having *any* Fintech experience is more similar to
         * a Fintech engineer than having *no* Fintech experience.
         */
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] All tests pass: `npm test`

---

## Phase 4: diversity-selector.ts - Add Weight Rationale

### Overview
Add explanation of why 0.7/0.3 skill/domain weighting was chosen for diversity calculation.

### Changes Required:

**File**: `recommender_api/src/services/similarity-calculator/diversity-selector.ts`
**Location**: After line 76 (after the JSDoc for calculateAverageDiversity, before the function)

```typescript
/*
 * Why 0.7/0.3 skill/domain weighting for diversity?
 *
 * This roughly matches the main similarity weights ratio:
 *   - Main weights: skills=0.45, domain=0.22 → ratio ≈ 2:1
 *   - Diversity: skills=0.7, domain=0.3 → ratio ≈ 2:1
 *
 * This ensures that if React↔Vue are "similar" for the main scoring,
 * they're also "similar" for diversity purposes, meaning two React/Vue
 * engineers are less diverse than a React + Python pairing.
 *
 * We exclude experience and timezone from diversity because:
 *   - Experience: seniority diversity is less useful (you usually want
 *     engineers at a similar level, not a mix of junior and staff)
 *   - Timezone: geographic diversity has marginal value for most use cases
 */
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] All tests pass: `npm test`

---

## Phase 5: similarity.config.ts - Enhance Timeline/Salary Rationale

### Overview
Replace the brief timeline/salary exclusion comment with a more thorough explanation.

### Changes Required:

**File**: `recommender_api/src/config/knowledge-base/similarity.config.ts`
**Location**: Replace lines 33-41 (the current comment block)

Replace:
```typescript
/**
 * Similarity Weights (Research-derived)
 *
 * Timeline is intentionally excluded - it's a transient property
 * (current availability), not a capability attribute. Salary is
 * also excluded for fairness reasons.
 *
 * See: thoughts/shared/research/2026-01-16-project-3-similarity-scoring.md
 */
```

With:
```typescript
/**
 * Similarity Weights (Research-derived)
 *
 * INTENTIONAL EXCLUSIONS:
 *
 * Timeline: Two engineers with identical skills/experience are equally
 * "similar" regardless of current availability. Timeline is transient
 * (changes when projects end) and reflects scheduling, not capability.
 * If you need availability filtering, apply it as a post-filter on
 * similarity results, not baked into the similarity score.
 *
 * Salary: Two engineers with identical skills and experience are equally
 * "similar" regardless of their compensation expectations. Ranking by
 * salary would be unfair—salary is a budget constraint, not a similarity
 * dimension.
 *
 * See: thoughts/shared/1_chapter_5/3_project_3/research/2026-01-16-project-3-similarity-scoring.md
 */
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npm run typecheck`
- [x] All tests pass: `npm test`

---

## Testing Strategy

### Unit Tests:
- No new tests needed - this is documentation-only changes
- Existing tests verify behavior is unchanged

### Integration Tests:
- Run full test suite to confirm no regressions

---

## References

- Gap analysis: `thoughts/shared/1_chapter_5/3_project_3/research/2026-01-17-documentation-gap-analysis.md`
- Original research: `thoughts/shared/1_chapter_5/3_project_3/research/2026-01-16-project-3-similarity-scoring.md`
- Implementation plan: `thoughts/shared/1_chapter_5/3_project_3/plans/2026-01-16-project-3-similarity-scoring.md`
