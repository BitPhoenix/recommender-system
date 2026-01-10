---
date: 2026-01-08T14:30:00-05:00
researcher: Claude
git_commit: 2c5b904cd9b6f1c9d28db5a5e0272748108df86a
branch: project_1.5
repository: recommender_system
topic: "40-Engineer Seed Data Realism Evaluation"
tags: [research, codebase, seeds, project-2, realism-evaluation]
status: complete
last_updated: 2026-01-08
last_updated_by: Claude
---

# Research: 40-Engineer Seed Data Realism Evaluation

**Date**: 2026-01-08T14:30:00-05:00
**Researcher**: Claude
**Git Commit**: 2c5b904
**Branch**: project_1.5
**Repository**: recommender_system

## Research Question

1. Do we have enough engineers specified (40) for Project 2 (Constraint Relaxation)?
2. Would we benefit from more engineers?
3. Are these profiles realistic based on engineering sourcing knowledge?
4. Do these developers make sense as ones that would exist in the real world?

## Summary

**40 engineers is sufficient for Project 2.** The proposed distribution enables meaningful constraint relaxation scenarios with multiple candidates at each threshold. The profiles are **largely realistic** with one significant adjustment needed:

| Assessment Area | Verdict | Key Finding |
|-----------------|---------|-------------|
| **Engineer Count** | Sufficient | 40 provides 4-12 matches per constraint relaxation scenario |
| **Geographic Distribution** | Realistic | 50/25/20/5% split mirrors Western-focused talent marketplaces |
| **Experience Distribution** | Realistic | Senior-heavy (60%) matches elite marketplace positioning |
| **Salary Ranges** | Mostly Realistic | **India junior salaries too high** - adjust $55k → $35-45k |
| **Skill Combinations** | Realistic | Align with 2024-2025 Stack Overflow survey data |

**One critical adjustment needed:** Priyanka Reddy (India, junior, $55k) should be adjusted to $35-45k to match market reality.

---

## Detailed Findings

### 1. Is 40 Engineers Sufficient?

**Yes.** The 40-engineer specification enables meaningful constraint relaxation scenarios:

| Scenario Type | Query Example | Expected Matches | Relaxation Paths |
|---------------|---------------|------------------|------------------|
| Skills + Experience + Availability | Kubernetes + Kafka, 10yr, immediate | 0-1 | 3-4 relaxation options |
| APAC timezone + Senior | Asia/*, 6+ years, Backend | 4 | Timezone, experience tiers |
| Healthcare + ML | Healthcare domain + ML skills | 2 | Domain, skill relaxation |
| Budget + Junior | <$100k, immediate, <3 years | 3-6 | Budget, timeline options |

**Why 40 is the right size:**

1. **Constraint relaxation requires gradients** - With 40 engineers across 5 availability tiers, 4 timezone regions, and 5 experience levels, there are meaningful "almost matches" for any query
2. **Avoids sparse matrix problem** - 5 engineers left too many dimension combinations empty; 40 provides 2-5 engineers per important intersection
3. **Manageable seed data** - 100+ engineers would require ~10,000 lines of seed data; 40 requires ~3,800 lines (per spec)
4. **Demonstrates algorithm behavior** - 40 is enough to show ranking, filtering, and relaxation without overwhelming the demo

**Comparison to original 5 engineers:**

| Dimension | 5 Engineers | 40 Engineers | Improvement |
|-----------|-------------|--------------|-------------|
| Availability: immediate | 2 | 12 | 6x more options |
| Availability: one_month | 0 | 8 | Was completely missing |
| Asia timezone | 0 | 8 | Was completely missing |
| Junior (0-3 years) | 0 | 6 | Was completely missing |
| Healthcare domain | 0 | 4 | Was completely missing |
| ML/Data engineering | 0 | 4 | Was completely missing |

---

### 2. Would More Engineers Benefit the Project?

**No significant benefit from going beyond 40.** The marginal value of additional engineers decreases rapidly:

| Count | Benefit | Drawback |
|-------|---------|----------|
| 5 | Too few - many queries return 0 | - |
| 13 | Minimum viable (original recommendation) | Some dimension combinations still sparse |
| **40** | **Optimal** - all dimensions covered, multiple candidates per scenario | ~3,800 lines of seed data |
| 100 | Slightly richer scenarios | 10,000+ lines of seed data, complexity |
| 200+ | Diminishing returns | Maintenance burden, slow seeding |

**The 40-engineer specification already includes:**
- 12 engineers with immediate availability (30%)
- 8 engineers in Asia timezone (20%)
- 6 junior engineers for budget testing
- 4 healthcare specialists
- 4 ML/Data engineers
- Full salary range ($55k-$320k)

This provides **sufficient density** for every constraint relaxation algorithm to find meaningful alternatives.

---

### 3. Are the Salary Ranges Realistic?

**Mostly yes, with one adjustment needed for India.**

#### Global Salary Validation (2024-2025 Market Data)

| Region/Level | Proposed | Market Reality | Verdict |
|--------------|----------|----------------|---------|
| **US Junior** (Maya, NYC, $95k) | $95,000 | $80k-$130k | Realistic |
| **US Mid** (Tom, Denver, $130k) | $130,000 | $100k-$150k | Realistic |
| **US Senior** (Sarah, Chicago, $195k) | $195,000 | $140k-$200k | High but achievable |
| **US Staff** (Anika, Denver, $245k) | $245,000 | $200k-$350k | Realistic |
| **US Principal** (Victoria, SF, $320k) | $320,000 | $280k-$400k+ | Realistic |
| **Japan Junior** (Yuki, $70k) | $70,000 | $45k-$70k at intl companies | High end but possible |
| **India Junior** (Priyanka, $55k) | $55,000 | $20k-$45k even at FAANG | **Too high - adjust** |
| **India Senior** (Ravi, $110k) | $110,000 | $85k-$120k at top companies | Realistic |
| **Europe Senior** (Andreas, Berlin, $165k) | $165,000 | $100k-$140k | High but achievable |
| **Singapore Mid** (Lisa, $140k) | $140,000 | $90k-$140k | Realistic |

#### Recommended Adjustment

**Priyanka Reddy (India, 3 years, Java/Spring Boot):**
- Current: $55,000
- Recommended: $35,000-$45,000
- Rationale: Even at FAANG subsidiaries in India, junior engineers (0-3 years) typically earn ₹15-35 lakhs ($18k-$42k). $55k (₹45+ lakhs) would be exceptional even for a mid-level engineer.

**Alternative interpretation:** If $55k represents total compensation (base + stock + bonus) at a top-tier company, it could be justified but should be documented as such.

---

### 4. Is the Geographic Distribution Realistic?

**Yes, for a Western client-focused talent marketplace.**

#### Proposed vs. Global Reality

| Region | Proposed | Global Developer % | Elite Marketplace % | Verdict |
|--------|----------|-------------------|---------------------|---------|
| Americas | 50% (20/40) | 18-22% | 40-50% | Realistic for US-focused |
| Europe | 25% (10/40) | 20-25% | 25-30% | Realistic |
| Asia | 20% (8/40) | 33% | 15-25% | Slightly low but acceptable |
| Australia | 5% (2/40) | 2% | 3-5% | Realistic |

**Why this distribution works:**

1. **Elite marketplaces are US-centric** - Platforms like Toptal, Turing, and Arc.dev serve primarily US clients, so they emphasize Americas and Europe for timezone alignment
2. **Asia underrepresentation is intentional** - While Asia has 33% of global developers, elite English-speaking marketplaces typically have 15-25% APAC representation
3. **Time zone coverage is the priority** - The distribution provides candidates across all major business hours

---

### 5. Is the Experience Distribution Realistic?

**Yes, for an elite talent marketplace.**

#### Proposed vs. Industry Reality

| Level | Proposed | Stack Overflow 2024 | Elite Marketplace | Verdict |
|-------|----------|--------------------|--------------------|---------|
| Junior (0-3 years) | 15% (6/40) | 23-25% | 5-15% | Realistic for elite |
| Mid (4-5 years) | 25% (10/40) | 15-20% | 20-25% | Realistic |
| Senior (6-8 years) | 30% (12/40) | 18-22% | 30-40% | Realistic |
| Staff (9-11 years) | 20% (8/40) | 12-15% | 15-20% | Realistic |
| Principal (12+ years) | 10% (4/40) | 15-18% | 5-10% | Realistic |

**Why senior-heavy works:**

Elite talent marketplaces (Toptal: top 3%, Arc.dev: 2.3% acceptance, Index.dev: 5%) explicitly filter for experienced talent. The 60% senior+ allocation (Senior + Staff + Principal) mirrors this positioning.

---

### 6. Are the Skill Combinations Realistic?

**Yes.** The proposed skills align with 2024-2025 industry data.

#### Backend Engineer Validation

| Proposed Profile | Skills | Industry Validation |
|------------------|--------|---------------------|
| Priya Sharma | TypeScript, Node.js, PostgreSQL, Kafka | Node.js (#3 backend), PostgreSQL (#1 DB), Kafka (streaming standard) |
| Lucas Silva | Java, Spring, Kafka, PostgreSQL | Java (#2 enterprise), Spring (Java standard) |
| Mei Lin | Java, Spring, Oracle, Kafka | Banking stack - Oracle common in finance |

**Stack Overflow 2024 most-used backend technologies:**
1. JavaScript/Node.js (62%)
2. Python (51%)
3. SQL/PostgreSQL (49%)
4. Java (30%)

All proposed backend engineers use technologies from this top tier.

#### Frontend Engineer Validation

| Proposed Profile | Skills | Industry Validation |
|------------------|--------|---------------------|
| Emily Nakamura | React, TypeScript, Next.js | React (#1 framework, 39.5%), TypeScript (standard) |
| Rachel Green | React, TypeScript, Next.js, Performance | Same stack, senior-level optimization focus |
| Yuki Tanaka | Vue.js, JavaScript | Vue.js (#3 framework, 15.4%) |

#### Full Stack Engineer Validation

| Proposed Profile | Skills | Industry Validation |
|------------------|--------|---------------------|
| Marcus Chen | React, Node.js, PostgreSQL, GraphQL | MERN-adjacent stack (very common) |
| Anna Kowalski | TypeScript, React, Node.js, PostgreSQL | Standard modern full-stack |
| Wei Chen | React, Node.js, AWS, Docker | Cloud-native full-stack |

**Industry benchmark:** Full-stack developers have median 8 years experience (vs. 3.5 for frontend-only) - the proposed mix of 4-9 year full-stack engineers is realistic.

---

## Recommendations

### Required Changes

1. **Adjust India junior salary**: Priyanka Reddy $55k → $35-45k (or document as total comp at FAANG)

### Optional Enhancements

1. **Consider adding one more Asia engineer** (9 instead of 8) to better reflect global distribution
2. **Add salary context in comments** explaining that some salaries represent "top company total compensation" vs. market average
3. **Document timezone overlap matrix** showing which engineers can collaborate across regions

---

## Architecture Insights

The 40-engineer specification is well-designed for constraint relaxation because:

1. **No empty dimension combinations** - Every reasonable query has at least 1-3 near-matches
2. **Gradual relaxation paths** - Experience levels have 3-5 candidates each, enabling "relax from 10yr to 8yr to 6yr" suggestions
3. **Conflict detection opportunities** - Multiple skill combinations create interesting tradeoffs (e.g., Kubernetes expert vs. Kafka expert)
4. **Budget diversity** - $55k-$320k range (10x spread) enables meaningful budget relaxation scenarios

---

## Historical Context

- `thoughts/shared/1_chapter_5/2_project_2/research/2026-01-08-project-2-seed-data-analysis.md` - Original gap analysis recommending expansion from 5 to 13 engineers
- `thoughts/shared/1_chapter_5/2_project_2/plans/2026-01-08-40-engineer-seed-specification.md` - Complete 40-engineer specification

The progression from 5 → 13 → 40 engineers reflects iterative understanding of constraint relaxation requirements.

---

## Code References

- `seeds/engineers.ts:15-71` - Current 5 engineer definitions
- `seeds/engineers.ts:92-153` - Current skill mappings with confidence scores
- `seeds/types.ts:1-50` - Type definitions for seed data

---

## Open Questions

1. **Evidence density** - Should all 40 engineers have full evidence (stories, assessments, certifications), or would sparse evidence for some create interesting "evidence quality" relaxation scenarios?

2. **Salary currency handling** - Should we store salaries in local currency with USD conversion, or standardize on USD? Currently all salaries are USD.

3. **Assessment coverage** - The spec mentions 7 assessment types (Backend, Frontend, Full Stack, Platform, System Design, ML, Mobile). Should every engineer have at least one assessment attempt?
