---
date: 2026-01-17T10:30:00-06:00
researcher: Claude
git_commit: e248baa2928764640b5ff27a68ea810e56f0bab6
branch: project_3
repository: BitPhoenix/recommender-system
topic: "Documentation Gap Analysis: Research vs Implementation"
tags: [research, codebase, similarity, documentation, code-comments]
status: complete
last_updated: 2026-01-17
last_updated_by: Claude
---

# Research: Documentation Gap Analysis for Similarity Scoring

**Date**: 2026-01-17T10:30:00-06:00
**Researcher**: Claude
**Git Commit**: e248baa2928764640b5ff27a68ea810e56f0bab6
**Branch**: project_3
**Repository**: BitPhoenix/recommender-system

## Research Question

Compare the implementation against the research and plan documents to identify valuable context from the research that should be added as block comments to the actual implementation (e.g., explanations of why particular formulas were chosen).

---

## Summary

The implementation is **well-documented at a surface level** - each file has a header comment explaining what it does and the priority order of similarity checks. However, there are several areas where the **rich context from the research document** would add significant value:

1. **Why we use symmetric best-match instead of Jaccard** (the research has excellent examples showing Jaccard's limitations)
2. **Why timeline and salary are excluded** (the rationale is thoroughly explained in research but absent from code)
3. **Why we chose specific similarity values** (0.5 for category, 0.3 for parent, 0.4 for sibling domains)
4. **Why experience uses asymmetric scoring with α=0.5** (concrete examples in research)
5. **Why domain years have a 0.5 floor** (prevents years from dominating)
6. **Why diversity uses 0.7/0.3 skill/domain weighting**

---

## Detailed Analysis

### Files That Need Enhanced Documentation

#### 1. `skill-similarity.ts` - Needs Context on Graph-Aware vs Jaccard

**Current state**: Has good priority order comment, but doesn't explain WHY we use this approach.

**Missing from research** (lines 520-727 of research document):
- The excellent worked example showing Jaccard gives 0.14 while graph-aware gives 0.625 for the same comparison
- The explanation that Jaccard treats all skills as equally different (React vs Vue = React vs PostgreSQL)
- The F1 Score / Precision-Recall connection explaining why we average both directions

**Suggested addition** (after line 14):
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

#### 2. `experience-similarity.ts` - Needs Rationale for α=0.5

**Current state**: Has formula reference but doesn't explain the real-world reasoning.

**Missing from research** (lines 146-175):
- Concrete examples showing what different α values mean
- The intuition that α=0.5 means "a solid senior level - someone with 4 years may lack seniority, but someone with 8 years might be overqualified"

**Suggested addition** (after line 15):
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

#### 3. `domain-similarity.ts` - Needs Rationale for Years Floor and Hierarchy Values

**Current state**: Has priority order but doesn't explain the values or the years multiplier logic.

**Missing from research** (lines 1186-1258):
- Why we use multiplicative combination (years only matters when domains are related)
- Why 0.5 floor (prevents 9-year gap from reducing exact domain match to 0.1)
- Why siblings are 0.5 vs parent-child at 0.4

**Suggested additions**:

After line 15:
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

After line 85 (the years adjustment block):
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

#### 4. `similarity.config.ts` - Could Explain Why Timeline/Salary Excluded

**Current state**: Has a brief comment about timeline/salary exclusion.

**Missing from research** (lines 1274-1345):
- The detailed analysis of why timeline is transient vs intrinsic
- The "same engineer, different timeline = same engineer" argument
- Consistency with salary exclusion

**Suggested enhancement** (replace lines 36-41):
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

#### 5. `diversity-selector.ts` - Needs Rationale for 0.7/0.3 Weighting

**Current state**: Has excellent algorithm description but the 0.7/0.3 weighting is unexplained.

**Missing context** (not explicitly in research but derivable from weights):
- Skills are 0.45 of the main similarity, domain is 0.22 (roughly 2:1 ratio)
- For diversity, we use 0.7:0.3 (also roughly 2:1) to maintain consistency

**Suggested addition** (after line 76):
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

---

## Files That Are Already Well-Documented

### `similarity-calculator.ts`
- Clear formula reference (Equation 5.2)
- Explains weight sum simplification
- Good inline comments for each step

### `graph-loader.ts`
- Cypher queries are self-explanatory
- Note about undirected CORRELATES_WITH matching

### `timezone-similarity.ts`
- Simple enough that the code is self-explanatory
- Position-based formula is obvious from the implementation

---

## Recommendations

### Priority Order for Adding Comments

1. **skill-similarity.ts** - Most complex, biggest gap between code and research rationale
2. **domain-similarity.ts** - Years adjustment logic is non-obvious
3. **experience-similarity.ts** - α=0.5 rationale adds real value
4. **diversity-selector.ts** - 0.7/0.3 weighting deserves explanation
5. **similarity.config.ts** - Timeline/salary exclusion could use richer context

### Comment Style

Use the existing block comment style from the codebase:
```typescript
/*
 * Multi-line explanation
 * with examples if helpful
 */
```

Keep comments focused on **WHY** (rationale, tradeoffs, alternatives considered) rather than **WHAT** (which the code already shows).

---

## Code References

- `recommender_api/src/services/similarity-calculator/scoring/skill-similarity.ts:1-161`
- `recommender_api/src/services/similarity-calculator/scoring/experience-similarity.ts:1-40`
- `recommender_api/src/services/similarity-calculator/scoring/domain-similarity.ts:1-146`
- `recommender_api/src/services/similarity-calculator/scoring/timezone-similarity.ts:1-28`
- `recommender_api/src/services/similarity-calculator/similarity-calculator.ts:1-116`
- `recommender_api/src/services/similarity-calculator/diversity-selector.ts:1-112`
- `recommender_api/src/config/knowledge-base/similarity.config.ts:1-50`

---

## Related Research

- `thoughts/shared/1_chapter_5/3_project_3/research/2026-01-16-project-3-similarity-scoring.md` - Original research document
- `thoughts/shared/1_chapter_5/3_project_3/plans/2026-01-16-project-3-similarity-scoring.md` - Implementation plan

---

## Open Questions

None - this analysis is complete. The suggested additions are ready for review and implementation.
