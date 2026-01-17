---
date: 2026-01-16T10:30:00-06:00
researcher: Claude
git_commit: 4ad1d903fa07194281bc05c13f4c3b95a3114a66
branch: project_3
repository: BitPhoenix/recommender-system
topic: "Project 3: Similarity Scoring - Foundational Research"
tags: [research, codebase, similarity, case-based-recommender, chapter-5]
status: complete
last_updated: 2026-01-16
last_updated_by: Claude
---

# Research: Project 3 - Similarity Scoring

**Date**: 2026-01-16T10:30:00-06:00
**Researcher**: Claude
**Git Commit**: 4ad1d903fa07194281bc05c13f4c3b95a3114a66
**Branch**: project_3
**Repository**: BitPhoenix/recommender-system

## Research Question

Conduct foundational research for Project 3 (Similarity Scoring) by understanding the textbook concepts (Section 5.3.1), existing codebase architecture, and how to implement `GET /api/engineers/:id/similar` for computing similarity between engineers.

---

## Summary

Project 3 introduces **case-based recommender** concepts from Section 5.3.1 of the textbook. Unlike constraint-based systems (Projects 1-2) that filter and rank based on user requirements, case-based systems use **similarity metrics** to find items similar to a target. For our domain, this means finding engineers similar to a reference engineer—useful for:

1. **"More like this"** functionality when a manager finds a good candidate
2. **Replacement search** when a specific engineer is unavailable
3. **Team composition analysis** (finding engineers with complementary skills)

The textbook provides a weighted attribute similarity formula that maps well to our existing utility calculator architecture. Key design decisions include handling **asymmetric similarity** (more experience = okay, less = penalized), **skill hierarchy similarity** via graph relationships, and **incorporating diversity** to avoid returning nearly-identical candidates.

---

## Textbook Concepts (Section 5.3.1)

### Core Similarity Formula

From the textbook (Equation 5.2):

```
                     Σ(i∈S) w_i · Sim(t_i, x_i)
Similarity(T, X) = ─────────────────────────────
                          Σ(i∈S) w_i
```

Where:
- `T` = target engineer (the one we're finding similar candidates to)
- `X` = candidate engineer being compared
- `S` = set of attributes being compared
- `w_i` = weight of attribute i (importance)
- `Sim(t_i, x_i)` = similarity between target's value and candidate's value for attribute i

**In plain English:**

```
                    Σ(i∈S) w_i · Sim(t_i, x_i)
Similarity(T, X) = ────────────────────────────
                         Σ(i∈S) w_i
```

- **Numerator** — Sum of weighted similarity scores: For each attribute i in the set S, multiply its weight (how important it is) by how similar the target and candidate are on that attribute. Then sum all these products together. This gives "total weighted similarity."

- **Denominator** — Sum of weights: Add up all the weights for the attributes being compared. This normalizes the score so that the final similarity is between 0 and 1, regardless of how many attributes are compared or what their weights sum to.

- **Result** — A normalized similarity score between 0 (completely different) and 1 (identical). The division ensures that if you only compare a subset of attributes, the score remains comparable to when you compare all attributes.

**Example with 3 attributes:**

| Attribute | Weight (w_i) | Similarity (Sim) | Weighted (w_i × Sim) |
|-----------|--------------|------------------|----------------------|
| skills | 0.40 | 0.75 | 0.30 |
| yearsExperience | 0.25 | 0.90 | 0.225 |
| domain | 0.20 | 0.60 | 0.12 |
| **Totals** | **0.85** | | **0.645** |

```
             0.645
Similarity = ───── = 0.76
             0.85
```

The engineers are 76% similar based on these three attributes with their respective weights.

### Attribute-Level Similarity Functions

The textbook describes several similarity function types:

**1. Symmetric Similarity (Equation 5.3):**
```
                       |t_i - x_i|
Sim(t_i, x_i) = 1 - ────────────────
                     max_i - min_i
```
- Used when deviation in either direction is equally bad
- Example: If target has 5 years experience, both 3 and 7 years are equally "distant"

**2. Asymmetric Similarity (Equations 5.5 and 5.6):**

The textbook provides **two formulas** depending on which direction is preferable:

**Equation 5.5 — When HIGHER candidate values are better:**
```
                       |t_i - x_i|                        |t_i - x_i|
Sim(t_i, x_i) = 1 - ──────────────  +  α_i · I(x_i > t_i) · ──────────────
                      max - min                             max - min
                ╰──────────────────╯   ╰────────────────────────────────────╯
                  base symmetric           reward kicks in when candidate
                     penalty               EXCEEDS target (x > t)
```

**Equation 5.6 — When LOWER candidate values are better:**
```
                       |t_i - x_i|                        |t_i - x_i|
Sim(t_i, x_i) = 1 - ──────────────  +  α_i · I(x_i < t_i) · ──────────────
                      max - min                             max - min
                ╰──────────────────╯   ╰────────────────────────────────────╯
                  base symmetric           reward kicks in when candidate
                     penalty               is BELOW target (x < t)
```

**The only difference is the indicator function direction:**
- `I(x_i > t_i)` — use when MORE is better (experience, resolution, confidence)
- `I(x_i < t_i)` — use when LESS is better (price, latency, error rate)

---

**How the indicator function works:**

- **`I(condition)`** returns 1 if the condition is true, 0 if false
- This "turns on" the reward term only in the preferred direction
- In the non-preferred direction, reward = 0 and you get pure symmetric penalty

---

**How α controls the reward strength:**

- **`α_i ∈ (0, 1)`: Prefers target but tolerates deviation in the good direction**
  - The reward partially cancels the penalty
  - Net effect: deviating in the good direction is penalized *less* than the bad direction, but still penalized somewhat
  - *Example: Target engineer has 6 years experience (solid senior), using α = 0.5 (more_is_better):*
    - Candidate with 4 years: penalty = 0.1, reward = 0 → **score = 0.9** (less experienced = less similar)
    - Candidate with 8 years: penalty = 0.1, reward = 0.05 → **score = 0.95** (more experienced = slightly less similar)
    - Interpretation: "Find engineers around 6 years—a solid senior level. Someone with 4 years may lack the seniority we need. Someone with 8 years is closer to what we want, but a staff-level engineer might be overqualified—they could get bored, expect faster promotion, or not want the hands-on work this role requires."
  - *When to use*: When you genuinely want someone at a specific level and overqualification is a mild concern. If more experience is always fine, use α = 1 instead.

- **`α_i = 1`: Indifferent to deviation in the good direction**
  - The reward exactly cancels the penalty
  - Net effect: no penalty for deviating in the good direction, full penalty for the bad direction
  - *Example: Target engineer has 3 years in Fintech domain, using α = 1.0 (more_is_better):*
    - Candidate with 1 year Fintech: penalty = 0.2, reward = 0 → **score = 0.8** (less domain depth)
    - Candidate with 5 years Fintech: penalty = 0.2, reward = 0.2 → **score = 1.0** (more domain depth = just as good)
    - Interpretation: "We need someone with solid Fintech experience like this engineer. More Fintech years is never a downside—it's just as similar. Less experience means they may not understand the regulatory landscape."

- **`α_i > 1`: Actively prefers deviation in the good direction**
  - The reward exceeds the penalty, so score improves beyond 1.0 (capped)
  - Net effect: further deviation in the good direction = higher score
  - *Example: Target engineer available in 2 weeks, using α = 1.3 (less_is_better for wait time):*
    - Candidate available in 1 month: penalty = 0.17, reward = 0 → **score = 0.83** (longer wait = less similar)
    - Candidate available immediately: penalty = 0.17, reward = 0.22 → **score = 1.05 → capped to 1.0** (shorter wait = even better)
    - Interpretation: "Find engineers with similar availability. But if someone can start sooner than our reference engineer, that's actually a bonus—immediate availability is always welcome."
  - Note: This is rare in pure similarity (where you want "same as target"), but useful when similarity doubles as a utility function

**For our domain:**
| Attribute | Asymmetry | Rationale |
|-----------|-----------|-----------|
| yearsExperience | more_is_better (α ≈ 0.5) | More experience is acceptable, less is concerning |
| confidenceScore | more_is_better (α ≈ 0.3) | Higher confidence is welcome |
| skills | n/a (categorical) | Uses hierarchy-based similarity |

**Note on salary:** Salary is intentionally excluded from similarity scoring. Ranking engineers by salary expectation would be unfair—two engineers with identical skills and experience are equally "similar" regardless of their compensation expectations. Salary is a job-fit/budget constraint (handled in constraint-based search), not an engineer similarity attribute.

**3. Categorical Hierarchy Similarity:**

For categorical attributes like skills, the textbook recommends using domain hierarchies to compute similarity. Two skills closer in the hierarchy are more similar. Our codebase already has:
- `CHILD_OF` relationships (e.g., Express is child of Node.js)
- `CORRELATES_WITH` relationships with strength values
- `BELONGS_TO` category memberships

### Incorporating Diversity (Section 5.3.1.1)

#### The Problem: Homogeneous Results

If you simply return the top 5 most similar engineers, you often get repetitive results:

```
Target: Priya (React, Node.js, 7 years, Fintech)

Naive "Top 5 Most Similar":
1. Marcus  - React, Node.js, 8 years, Fintech  (score: 0.95)
2. James   - React, Node.js, 7 years, Fintech  (score: 0.94)
3. Sofia   - React, Node.js, 6 years, Fintech  (score: 0.92)
4. Chen    - React, Node.js, 7 years, Banking  (score: 0.91)
5. Aisha   - React, Node.js, 8 years, Fintech  (score: 0.90)
```

All five are React/Node.js engineers with ~7 years in finance. If the hiring manager doesn't like React developers for some unstated reason, ALL five suggestions are useless. There's no variety.

#### What We Want: Similar BUT Diverse

A better result set might be:

```
Diverse "Top 5":
1. Marcus  - React, Node.js, 8 years, Fintech     (score: 0.95) ← most similar
2. Wei     - Vue, Python, 7 years, Fintech        (score: 0.82) ← different tech stack
3. James   - React, Node.js, 7 years, Fintech     (score: 0.94) ← very similar
4. Fatima  - React, Node.js, 6 years, Healthcare  (score: 0.85) ← different domain
5. Alex    - Angular, Java, 8 years, Banking      (score: 0.78) ← different stack + domain
```

Each result is still reasonably similar to Priya, but they're different from *each other*. If React doesn't work out, there's Vue and Angular. If Fintech isn't required, there's Healthcare.

#### The Core Idea: Greedy Selection with a Diversity Bonus

Instead of just picking the top k by similarity, we pick candidates **one at a time**, and each time we ask:

> "Which remaining candidate is both similar to the target AND different from the ones we've already picked?"

This is "greedy" because at each step we pick the locally best option without reconsidering previous choices.

#### The Algorithm Step-by-Step

**Setup:**
- We want to return **k** engineers (e.g., k = 5)
- We start by fetching **b × k** candidates (e.g., b = 3, so 15 candidates)
- This larger pool gives us options to choose from

**Iteration:**

```
Start with:
  - Pool = top 15 most similar candidates
  - Selected = empty set

Repeat until we have 5 selected:

  For each candidate X still in the pool:
    Calculate: Quality(X) = Similarity(target, X) × AvgDiversity(X, Selected)

  Pick the candidate with highest Quality
  Move them from Pool → Selected
```

**The Quality Formula:**

```
Quality(T, X, R) = Similarity(T, X) × D_avg(X, R)
                   ╰───────────────╯   ╰──────────╯
                    how similar X      how different X
                    is to target T     is from already-
                                       selected set R
```

- **Similarity(T, X)**: How similar is candidate X to the target? (0 to 1)
- **D_avg(X, R)**: How different is X from the engineers already selected? (0 to 1)
  - Calculated as: average of (1 - Similarity(X, each person in R))
  - If R is empty (first pick), D_avg = 1.0 (no penalty)

**Why Multiplication?**

Multiplying these two factors means a candidate needs BOTH:
- High similarity to target (or the score drops)
- High diversity from already-selected (or the score drops)

A candidate who is 95% similar to target but identical to someone already picked gets a low quality score.

#### Worked Example

Target: Priya (React, Node.js, 7 years, Fintech)
Want: k = 3 results
Pool: top 9 candidates (b = 3)

**Round 1: Selected = ∅ (empty)**

| Candidate | Sim(Target, X) | D_avg(X, ∅) | Quality |
|-----------|----------------|-------------|---------|
| Marcus    | 0.95           | 1.0         | **0.95** ← highest |
| James     | 0.94           | 1.0         | 0.94    |
| Wei       | 0.82           | 1.0         | 0.82    |
| ...       | ...            | ...         | ...     |

→ Select **Marcus** (React, Node, 8yr, Fintech)

**Round 2: Selected = {Marcus}**

| Candidate | Sim(Target, X) | D_avg(X, {Marcus}) | Quality |
|-----------|----------------|---------------------|---------|
| James     | 0.94           | 0.15 (very similar to Marcus) | 0.14 |
| Wei       | 0.82           | 0.70 (different stack) | **0.57** ← highest |
| Sofia     | 0.92           | 0.20 (similar to Marcus) | 0.18 |
| ...       | ...            | ...                 | ...     |

→ Select **Wei** (Vue, Python, 7yr, Fintech) — even though James had higher similarity!

**Round 3: Selected = {Marcus, Wei}**

| Candidate | Sim(Target, X) | D_avg(X, {Marcus, Wei}) | Quality |
|-----------|----------------|--------------------------|---------|
| James     | 0.94           | 0.42 (similar to Marcus, different from Wei) | 0.39 |
| Fatima    | 0.85           | 0.65 (different domain from both) | **0.55** ← highest |
| Sofia     | 0.92           | 0.35                     | 0.32    |

→ Select **Fatima** (React, Node, 6yr, Healthcare)

**Final Result:** Marcus, Wei, Fatima — each similar to Priya but different from each other.

#### Why "Bounded"?

The "bounded" part refers to only considering the top **b × k** candidates, not the entire database. This:
- Ensures all candidates are at least reasonably similar (they made the initial cut)
- Keeps computation manageable (comparing 15 candidates, not 10,000)
- The bound `b` controls the tradeoff: higher b = more diversity options but slower

#### Summary

| Approach | Picks Based On | Result |
|----------|---------------|--------|
| Naive top-k | Similarity only | Homogeneous (all similar to each other) |
| Bounded greedy | Similarity × Diversity | Varied (similar to target, different from each other) |

---

## Current Codebase Analysis

### Existing Architecture

The codebase implements constraint-based search (Projects 1-2) with a well-structured service layer:

```
recommender_api/src/
├── routes/search.routes.ts          # Route definitions
├── controllers/search.controller.ts # HTTP handlers
├── services/
│   ├── search.service.ts            # Main orchestrator
│   ├── skill-resolution.service.ts  # Skill hierarchy expansion
│   ├── constraint-expander.service.ts
│   ├── utility-calculator/          # Multi-attribute scoring
│   │   ├── index.ts
│   │   ├── utility-calculator.ts
│   │   ├── types.ts
│   │   └── scoring/
│   │       ├── core-scoring.ts      # Confidence, experience
│   │       ├── skill-scoring.ts     # Skill matching
│   │       ├── domain-scoring.ts    # Business/technical domains
│   │       └── logistics-scoring.ts # Timeline, timezone, seniority
│   └── cypher-query-builder/
└── config/knowledge-base/
    ├── utility.config.ts            # Weights & params
    └── compatibility-constraints.config.ts
```

### Utility Calculator (Existing)

The current utility calculator computes weighted utility for ranking search results:

```
Utility(V) = Σ w_j · f_j(v_j)
             ╰─────────────────╯
             sum over all attributes j:
             weight × utility function applied to value
```

It has:

**Weights (sum to 1.0):**
- skillMatch: 0.37
- confidence: 0.14
- yearsExperience: 0.11
- relatedSkillsMatch: 0.04
- preferredSkillsMatch: 0.08
- startTimelineMatch: 0.10
- teamFocusMatch: 0.04
- preferredBusinessDomainMatch: 0.02
- preferredTechnicalDomainMatch: 0.02
- preferredTimezoneMatch: 0.02
- preferredSeniorityMatch: 0.03
- budgetMatch: 0.03

**Key insight:** The utility calculator is designed for **constraint-based search** where a manager specifies requirements. For **similarity scoring**, we compare two engineers directly—no user requirements involved.

### Engineer Data Model

Engineers have these attributes for similarity comparison:

| Attribute | Type | Source | Used in Similarity? |
|-----------|------|--------|---------------------|
| yearsExperience | number (0-20+) | Engineer node | ✓ Yes (asymmetric) |
| salary | number | Engineer node | ✗ No (fairness) |
| startTimeline | enum | Engineer node | ✓ Yes |
| timezone | string (US zones) | Engineer node | ✓ Yes |
| skills | array | Engineer→UserSkill→Skill | ✓ Yes (primary) |
| proficiencyLevel | enum per skill | UserSkill node | ✓ Yes |
| confidenceScore | number per skill | UserSkill node | ✓ Yes |
| businessDomains | array + years | HAS_EXPERIENCE_IN relationship | ✓ Yes |
| technicalDomains | array + years | HAS_EXPERIENCE_IN relationship | ✓ Yes |

### Skill Relationships

```
Skill -[:CHILD_OF]-> Skill              # Hierarchy (38 relationships)
Skill -[:CORRELATES_WITH]-> Skill       # Correlations (73 relationships)
Skill -[:BELONGS_TO]-> SkillCategory    # Category membership
```

The `CORRELATES_WITH` relationships have:
- `strength`: 0-1 correlation strength
- `correlationType`: 'complementary' | 'transferable' | 'co_occurring'

**Example correlations:**
- TypeScript ↔ JavaScript: 0.95 strength (transferable)
- React ↔ TypeScript: 0.75 strength (complementary)
- Docker ↔ Kubernetes: 0.9 strength (co_occurring)
- TechLeadership ↔ SystemDesign: 0.75 strength (cross-type)

---

## API Design for Project 3

### Endpoint

```
GET /api/engineers/:id/similar?limit=5
```

### Request Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| limit | number | 5 | Number of similar engineers to return |

### Baked-In Defaults (Not Configurable)

These implementation details are baked into the similarity algorithm rather than exposed as parameters. This keeps the API simple—users just ask "find similar engineers" without needing to understand correlation thresholds or asymmetry coefficients.

| Setting | Value | Rationale |
|---------|-------|-----------|
| Skill correlations | Enabled, min strength 0.7 | Correlations add value; 0.7 filters noise |
| Experience asymmetry | more_is_better (α = 0.5) | More experience is acceptable, less is concerning |
| Diversity selection | Enabled (b = 3) | Prevents homogeneous results |

If real users request configurability for specific use cases, we can add parameters later. Easier to add than remove.

### Response Structure

```typescript
{
  target: {
    id: string,
    name: string,
    yearsExperience: number,
    skills: SkillSummary[],
    timezone: string,
    // ... other attributes
  },
  similar: [
    {
      engineer: EngineerSummary,
      similarityScore: number,        // 0-1 overall similarity
      breakdown: {
        skills: number,               // 0-1 skill similarity
        yearsExperience: number,      // 0-1 experience similarity
        domain: number,               // 0-1 domain similarity
        availability: number,         // 0-1 availability similarity
        timezone: number,             // 0-1 timezone similarity
      },
      sharedSkills: string[],         // Skills both engineers have
      correlatedSkills: string[],     // Skills linked via CORRELATES_WITH
    },
    // ...
  ]
}
```

---

## Implementation Approach

### Option A: New Similarity Calculator (Recommended)

Create a parallel module to utility-calculator focused on engineer-to-engineer comparison:

```
src/services/similarity-calculator/
├── index.ts
├── similarity-calculator.ts
├── types.ts
└── scoring/
    ├── skill-similarity.ts          # Skill overlap + hierarchy + correlations
    ├── experience-similarity.ts     # Asymmetric years comparison
    ├── domain-similarity.ts         # Business + technical domain overlap
    └── logistics-similarity.ts      # Timeline, timezone proximity
```

**Rationale:**
- Similarity has fundamentally different inputs (two engineers) vs utility (engineer + requirements)
- Weights and asymmetry config are different
- Cleaner separation of concerns

### Option B: Extend Utility Calculator

Add a `calculateSimilarity(engineer1, engineer2)` function to existing module.

**Drawback:** Conflates two different concepts (utility vs similarity) in one module.

### Recommendation: Option A

The textbook treats constraint-based (utility) and case-based (similarity) as distinct paradigms. Keeping them separate preserves clarity and allows independent evolution.

---

## Similarity Function Designs

### Jaccard Similarity (Foundation for Set Comparison)

Before diving into skill similarity, we need to understand **Jaccard similarity**—a standard measure for comparing two sets. It answers: "What fraction of all items appear in both sets?"

**Formula:**

```
                      |A ∩ B|
Jaccard(A, B) = ─────────────────
                      |A ∪ B|
```

- **Numerator (intersection)**: Count of items that appear in BOTH sets
- **Denominator (union)**: Count of ALL unique items across both sets
- **Result**: A number between 0 and 1
  - 0 = no overlap (completely different sets)
  - 1 = perfect overlap (identical sets)

**Worked Example with Engineer Skills:**

```
Target engineer Priya's skills:   {React, Node.js, TypeScript, PostgreSQL}
Candidate engineer Marcus's skills: {React, Node.js, Python, MongoDB}

Intersection (skills in BOTH):    {React, Node.js}           → 2 skills
Union (ALL unique skills):        {React, Node.js, TypeScript, PostgreSQL, Python, MongoDB} → 6 skills

             2
Jaccard = ───── = 0.33
             6
```

Priya and Marcus have 33% skill overlap. They share React and Node.js, but differ on database (PostgreSQL vs MongoDB) and other languages (TypeScript vs Python).

**Another Example:**

```
Target: Priya      {React, Node.js, TypeScript, PostgreSQL}
Candidate: Sofia   {React, Node.js, TypeScript, AWS}

Intersection: {React, Node.js, TypeScript}  → 3 skills
Union:        {React, Node.js, TypeScript, PostgreSQL, AWS} → 5 skills

             3
Jaccard = ───── = 0.60
             5
```

Sofia is more similar to Priya (60% overlap) than Marcus was (33%).

**Why Jaccard Works Well for Skills:**

- Handles different-sized skill sets fairly (a person with 10 skills isn't automatically "more similar")
- Symmetric: Jaccard(A, B) = Jaccard(B, A)
- Intuitive: "What percentage of the combined skill pool do they share?"

**Limitation:** Jaccard treats all skills as equally different. It doesn't know that React and Vue are both frontend frameworks, or that TypeScript and JavaScript are closely related.

---

### Why Graph Database? The Foundation for Intelligent Matching

Before explaining our smarter approach, it's worth noting that **our Neo4j graph database is what makes this possible**. The rich relationships we've encoded enable similarity scoring that would be painful or impossible with a traditional relational database.

**What we have in Neo4j:**

```
Skill -[:CORRELATES_WITH {strength: 0.95, type: "transferable"}]-> Skill
Skill -[:BELONGS_TO]-> SkillCategory
Skill -[:CHILD_OF]-> Skill (parent)
Engineer -[:HAS]-> UserSkill -[:FOR]-> Skill
```

**Why this matters for similarity:**

| Query | Neo4j (Graph) | PostgreSQL (Relational) |
|-------|---------------|-------------------------|
| "Are React and Vue related?" | Single hop: `MATCH (a)-[:BELONGS_TO]->(cat)<-[:BELONGS_TO]-(b)` | JOIN through junction table, hope you indexed it |
| "What's the correlation strength between TypeScript and JavaScript?" | Direct edge property: `(a)-[r:CORRELATES_WITH]-(b) RETURN r.strength` | Lookup in separate correlations table |
| "Find all skills that share a parent with Node.js" | Pattern match: `(node)-[:CHILD_OF]->(parent)<-[:CHILD_OF]-(sibling)` | Recursive CTE or self-join, gets ugly fast |
| "Traverse hierarchy to find related skills" | Variable-length path: `[:CHILD_OF*1..3]` | Multiple self-joins or recursive query |

**Graph advantages for similarity scoring:**

1. **Relationships are first-class citizens** — Correlation strength, relationship type, and other metadata live on the edge itself, not in a separate table.

2. **Path queries are natural** — "Skills within 2 hops of React" is a one-liner, not a recursive CTE nightmare.

3. **No JOIN explosion** — Finding skill relationships doesn't require joining 5 tables. The graph traversal is the query.

4. **Schema flexibility** — We can add new relationship types (e.g., `PREREQUISITE_FOR`) without schema migrations or new junction tables.

**How complexity compounds over time (Relational vs Graph):**

A single query comparing two skills isn't dramatically different between the two approaches. The pain emerges as the system evolves:

| Scenario | Graph (Neo4j) | Relational (PostgreSQL) |
|----------|---------------|-------------------------|
| **Today: Check if two skills are related** | Add OPTIONAL MATCH clause | Add LEFT JOIN to junction table |
| **Month 2: Add "PREREQUISITE_FOR" relationship** | Add one more OPTIONAL MATCH line | New table, new JOIN, update all queries |
| **Month 4: Skills can have multi-level hierarchies (React → JavaScript → Programming)** | Change `[:CHILD_OF]` to `[:CHILD_OF*1..3]` | Recursive CTE, or denormalize with closure table |
| **Month 6: Find skills "within 2 hops" of a skill** | `MATCH (s)-[*1..2]-(related)` | ??? (multiple self-joins, or precompute all pairs) |
| **Month 8: Add weighted paths (skill A → B → C with decaying strength)** | `REDUCE(score = 1.0, r IN relationships(path) \| score * r.strength)` | Give up and move to a graph database |

**The real cost: N×M skill comparisons at query time**

Similarity scoring doesn't compare two skills once—it compares every skill in engineer A's set against every skill in engineer B's set. For two engineers with 8 skills each, that's 64 comparisons *per candidate*. With 50 candidates in the pool, that's 3,200 skill-pair lookups.

```
Graph approach:
- Load skill subgraph once (skills + relationships for relevant IDs)
- Traverse in-memory, O(1) edge lookups
- Naturally handles "check correlation, then category, then parent" priority

Relational approach:
- 3,200 queries? Batch them somehow?
- Precompute all skill-pair similarities into a matrix table?
- Now you're maintaining a derived table that needs rebuilding when relationships change
```

**Where graph really shines: Emergent queries**

The questions you'll want to ask in 6 months that you can't predict today:

- "Find engineers whose skills form a connected subgraph with the target" (team compatibility)
- "What's the shortest skill path between two engineers?" (learning/mentorship potential)
- "Cluster engineers by skill similarity using community detection"
- "Find skill gaps: skills the target has that no similar engineer covers"

These are graph algorithms. In Neo4j, many are built-in or one Cypher query. In PostgreSQL, each is a research project.

**The takeaway:** The single-query comparison isn't dramatic, but **the graph compounds in your favor over time**. Each new relationship type is one line of Cypher, not a schema migration. Each new traversal pattern is a pattern match, not a recursive CTE. Our investment in Neo4j and rich skill relationships (73 CORRELATES_WITH, 38 CHILD_OF, category memberships) gives us a foundation that gets more valuable as similarity scoring evolves.

---

### Why Not Pure Jaccard? A Smarter Approach

**The problem with Jaccard + bonuses:**

A naive approach would be: compute Jaccard similarity, then add bonuses for hierarchy/correlation:

```
score = jaccard * 0.5 + hierarchyBonus * 0.25 + correlationBonus * 0.15
```

This has issues:
- **Arbitrary weights**: Why 0.5 for Jaccard, 0.25 for hierarchy? These are guesses.
- **Bonuses stack unclearly**: Hierarchy and correlation are afterthoughts bolted on, not integrated.
- **Still binary at the core**: A skill either matches or it doesn't—no partial credit for "almost matching."

**Better approach: Skill-to-Skill Similarity with Best Matching**

Instead of binary "has/doesn't have," we define how similar *any two skills* are using our graph relationships:

```
                    ┌─ 1.0   if same skill (React == React)
                    │
                    ├─ strength if CORRELATES_WITH exists (e.g., TypeScript ↔ JavaScript = 0.95)
                    │
SkillSim(a, b) = ───┼─ 0.5   if same SkillCategory (React & Vue both in "Frontend Frameworks")
                    │
                    ├─ 0.3   if share parent via CHILD_OF (Express & NestJS both children of Node.js)
                    │
                    └─ 0.0   otherwise (React & PostgreSQL - unrelated)
```

Then for each skill the target engineer has, find its **best match** in the candidate's skill set:

**Worked Example:**

```
Target: Priya with {React, Node.js, TypeScript, PostgreSQL}
Candidate: Wei with {Vue, Python, Django, PostgreSQL}

For each of Priya's skills, find best match in Wei's skills:

  React      → Vue (same category: Frontend Frameworks)        = 0.5
  Node.js    → Python (same category: Backend Languages)       = 0.5
  TypeScript → Vue (same category: Frontend Frameworks)        = 0.5
  PostgreSQL → PostgreSQL (exact match!)                       = 1.0
                                                         ─────────
  Average of best matches: (0.5 + 0.5 + 0.5 + 1.0) / 4        = 0.625
```

**Compare to pure Jaccard:**

```
Intersection: {PostgreSQL}  → 1 skill
Union: {React, Node.js, TypeScript, PostgreSQL, Vue, Python, Django} → 7 skills

Jaccard = 1/7 = 0.14
```

The graph-aware approach (0.625) recognizes that:
- Wei's Vue covers Priya's React (both frontend frameworks)
- Wei's Python covers Priya's Node.js (both backend languages)
- Wei's Vue also covers TypeScript (frontend-adjacent)

Pure Jaccard (0.14) sees only the PostgreSQL overlap and misses all this context. The graph knows these engineers have similar *capabilities* even though they use different specific technologies.

**Why this is better:**

| Aspect | Jaccard + Bonuses | Best-Match with SkillSim |
|--------|-------------------|--------------------------|
| Partial credit for related skills | Bolted on as bonus | Built into the core |
| Weights | Arbitrary (0.5, 0.25, 0.15) | Derived from graph (correlation strength) |
| Conceptual clarity | Hacky | Clean: "For each skill, how well is it covered?" |
| Uses our graph data | Partially | Fully (CORRELATES_WITH, BELONGS_TO, CHILD_OF) |

**Symmetry consideration:**

The best-match approach is inherently asymmetric: A→B can differ significantly from B→A when engineers have different skill set sizes or compositions.

**Example: Specialist vs Generalist**

```
Aisha (Frontend Specialist): {React, Redux, Next.js}           → 3 skills
Carlos (Full-Stack Generalist): {React, Node.js, PostgreSQL, AWS, Docker}  → 5 skills
```

**Aisha → Carlos** (How well are Aisha's skills covered by Carlos?):
```
  React   → React (exact match)                    = 1.0
  Redux   → React (same category: Frontend)        = 0.5
  Next.js → React (same category: Frontend)        = 0.5
                                             ───────────
  Average: (1.0 + 0.5 + 0.5) / 3                  = 0.67
```
Aisha's skills are well-covered by Carlos—he has React, and his React covers her other frontend tools.

**Carlos → Aisha** (How well are Carlos's skills covered by Aisha?):
```
  React      → React (exact match)                 = 1.0
  Node.js    → ??? (no backend skills in Aisha)    = 0.0
  PostgreSQL → ??? (no database skills in Aisha)   = 0.0
  AWS        → ??? (no cloud skills in Aisha)      = 0.0
  Docker     → ??? (no DevOps skills in Aisha)     = 0.0
                                             ───────────
  Average: (1.0 + 0 + 0 + 0 + 0) / 5              = 0.20
```
Carlos's skills are poorly covered by Aisha—she only matches his React, nothing else.

**The asymmetry problem:**

| Direction | Score | Interpretation |
|-----------|-------|----------------|
| Aisha → Carlos | 0.67 | "Carlos could replace Aisha" |
| Carlos → Aisha | 0.20 | "Aisha could NOT replace Carlos" |

Without symmetry, similarity depends on who you ask about. That's weird—"how similar are Aisha and Carlos?" should have one answer.

**Solution: Average both directions**

```
                         BestMatchAvg(A → B) + BestMatchAvg(B → A)
SymmetricSkillSim(A, B) = ─────────────────────────────────────────
                                            2

                        0.67 + 0.20
                      = ───────────  =  0.435
                             2
```

**Why this is the right answer:**

The symmetric score (0.435) captures the intuition that:
- They share some common ground (React)
- But they're not interchangeable—Carlos has breadth Aisha lacks
- 0.435 is "moderately similar"—not high (they're different), not low (they share frontend)

| Approach | Score | Problem |
|----------|-------|---------|
| Aisha → Carlos only | 0.67 | Overstates similarity (ignores Carlos's uncovered skills) |
| Carlos → Aisha only | 0.20 | Understates similarity (ignores that Aisha IS covered) |
| Symmetric average | 0.435 | Balanced: accounts for both coverage directions |

**When asymmetry would matter (future consideration):**

In some contexts, you might WANT asymmetric similarity:
- "Find engineers who could replace Priya" → use Priya → Candidate direction
- "Find engineers Priya could mentor" → use Candidate → Priya direction (they should cover less)

For now, we use symmetric similarity since we're answering "how similar are these two engineers?" without a directional intent.

---

**Background: Symmetrization is a standard technique**

The problem of asymmetric similarity measures is well-known in information retrieval, machine learning, and statistics. Our approach—averaging both directions—is one of several standard symmetrization techniques:

| Technique | Formula | Use Case |
|-----------|---------|----------|
| **Arithmetic mean** | (A→B + B→A) / 2 | General purpose, what we use |
| **Geometric mean** | √(A→B × B→A) | Penalizes when one direction is very low |
| **Harmonic mean** | 2×(A→B × B→A) / (A→B + B→A) | Penalizes imbalance more strongly |
| **Max** | max(A→B, B→A) | Optimistic: "at least one direction is good" |
| **Min** | min(A→B, B→A) | Pessimistic: "both directions must be good" |

**Connection to Precision & Recall (F1 Score):**

Our best-match approach is conceptually similar to precision and recall in information retrieval:

```
Precision: Of the items I retrieved, how many are relevant?
           → "Of candidate's skills, how many match target?" (Candidate → Target)

Recall:    Of the relevant items, how many did I retrieve?
           → "Of target's skills, how many are covered?" (Target → Candidate)
```

The **F1 score**—widely used in ML evaluation—is the *harmonic mean* of precision and recall. It solves the same asymmetry problem: precision and recall are two perspectives on the same retrieval, and F1 combines them into one balanced metric.

We use arithmetic mean rather than harmonic mean because:
- Arithmetic mean is simpler to explain and compute
- Harmonic mean penalizes imbalance more aggressively (if one direction is 0.1, harmonic mean tanks even if the other is 0.9)
- For similarity scoring, we want a balanced view, not a pessimistic one

**Related concepts in the literature:**

- **Tversky Index**: A generalization of Jaccard that allows asymmetric weighting: `|A ∩ B| / (|A ∩ B| + α|A - B| + β|B - A|)`. When α = β = 1, it's Jaccard. When α ≠ β, it's asymmetric.

- **Dice Coefficient**: `2|A ∩ B| / (|A| + |B|)` — mathematically equivalent to the harmonic mean of the two coverage directions.

- **Coverage-based similarity** in case-based reasoning: Our best-match approach is similar to "feature coverage" metrics used in case-based recommender systems, where you ask "how well does case B cover the features of case A?"

**Our choice: Arithmetic mean**

We chose arithmetic mean because:
1. It's intuitive: "average similarity in both directions"
2. It's well-behaved: doesn't collapse to near-zero when one direction is weak
3. It matches the question we're answering: "how similar are these engineers?" (not "could A replace B?")
4. It's the same approach used in many production similarity systems

---

### 1. Skill Similarity

Skills are the most important differentiator. Using the best-match approach described above:

**Proposed Algorithm:**

```typescript
/*
 * Main entry point: Calculate skill similarity between two engineers.
 * Uses symmetric best-match approach (average of both directions).
 *
 * Calls: computeBestMatchAverage
 */
function calculateSkillSimilarity(
  skillGraph: SkillGraph,
  targetSkills: EngineerSkill[],
  candidateSkills: EngineerSkill[]
): { score: number; sharedSkills: string[]; relatedSkillPairs: SkillPair[] } {

  // Symmetric: average both directions (see "Symmetry consideration" above)
  const targetToCandidateAvg = computeBestMatchAverage(skillGraph, targetSkills, candidateSkills);
  const candidateToTargetAvg = computeBestMatchAverage(skillGraph, candidateSkills, targetSkills);
  const symmetricScore = (targetToCandidateAvg + candidateToTargetAvg) / 2;

  // Collect exact matches for response
  const targetIds = new Set(targetSkills.map(s => s.skillId));
  const candidateIds = new Set(candidateSkills.map(s => s.skillId));
  const sharedSkills = [...targetIds].filter(id => candidateIds.has(id));

  // Collect related (non-exact) skill pairs for transparency
  const relatedSkillPairs = findRelatedSkillPairs(skillGraph, targetSkills, candidateSkills);

  return {
    score: symmetricScore,
    sharedSkills,
    relatedSkillPairs  // e.g., [{target: "React", candidate: "Vue", similarity: 0.5, reason: "same category"}]
  };
}

/*
 * For a set of skills, find best match score against another set.
 * Returns average of "how well is each skill covered by the other set?"
 *
 * Called by: calculateSkillSimilarity
 * Calls: computeSkillToSkillSimilarity
 */
function computeBestMatchAverage(
  skillGraph: SkillGraph,
  sourceSkills: EngineerSkill[],
  targetSkills: EngineerSkill[]
): number {
  if (sourceSkills.length === 0) return 0;

  let totalBestMatch = 0;

  for (const source of sourceSkills) {
    let bestMatch = 0;
    for (const target of targetSkills) {
      const sim = computeSkillToSkillSimilarity(skillGraph, source.skillId, target.skillId);
      bestMatch = Math.max(bestMatch, sim);
    }
    totalBestMatch += bestMatch;
  }

  return totalBestMatch / sourceSkills.length;
}

/*
 * Compute similarity between two individual skills using graph relationships.
 * Returns a value between 0 (unrelated) and 1 (same skill).
 *
 * Called by: computeBestMatchAverage
 *
 * Priority order (first match wins):
 *   1. Exact match → 1.0
 *   2. CORRELATES_WITH → use edge strength (e.g., 0.95)
 *   3. Same SkillCategory → 0.5
 *   4. Share CHILD_OF parent → 0.3
 *   5. No relationship → 0.0
 */
function computeSkillToSkillSimilarity(
  skillGraph: SkillGraph,
  skillA: string,
  skillB: string
): number {
  // Same skill = perfect match
  if (skillA === skillB) return 1.0;

  // Check CORRELATES_WITH relationship (use actual strength from graph)
  const correlation = skillGraph.getCorrelation(skillA, skillB);
  if (correlation) return correlation.strength;

  // Check if same SkillCategory (both BELONGS_TO same category)
  if (skillGraph.shareCategory(skillA, skillB)) return 0.5;

  // Check if share parent via CHILD_OF
  if (skillGraph.shareParent(skillA, skillB)) return 0.3;

  // No relationship found
  return 0.0;
}
```

### 2. Experience Similarity (Asymmetric)

Uses `more_is_better` asymmetry with α = 0.5 (baked in per design decision).

```typescript
/*
 * Calculate experience similarity between two engineers.
 * Uses asymmetric similarity: more experience is acceptable, less is penalized.
 *
 * Baked-in behavior (α = 0.5):
 *   - Candidate has MORE experience → penalty reduced by 50%
 *   - Candidate has LESS experience → full penalty
 */
function calculateExperienceSimilarity(
  targetYears: number,
  candidateYears: number
): number {
  const maxYears = 20;
  const alpha = 0.5;  // Asymmetry factor: 0.5 means "tolerate overshoot, penalize undershoot"

  const diff = candidateYears - targetYears;
  const normalizedDiff = Math.abs(diff) / maxYears;

  if (diff > 0) {
    // Candidate has more experience: reduce penalty by α
    return Math.max(0, 1 - (normalizedDiff * (1 - alpha)));
  } else {
    // Candidate has less experience: full penalty
    return Math.max(0, 1 - normalizedDiff);
  }
}
```

### 3. Domain Similarity

#### Why Not Jaccard for Domains?

An earlier draft of this document used Jaccard similarity for domains:

```typescript
// ❌ Original approach: Jaccard on domain IDs
const intersection = [...targetIds].filter(x => candidateIds.has(x));
const union = new Set([...targetIds, ...candidateIds]);
return intersection.length / union.size;
```

This has the same fundamental problem as Jaccard for skills: **it treats all domains as equally different**. Fintech and Banking would have zero similarity because they're different IDs—even though both are finance domains and someone with Fintech experience likely understands financial services concepts.

#### We Already Have Domain Hierarchies

Looking at `seeds/domains.ts`, we have rich hierarchy data that Jaccard ignores:

**Business Domains (CHILD_OF):**
```
Finance
├── Fintech
├── Banking
├── Payments
└── Insurance

Healthcare
├── Pharmaceuticals
├── Medical Devices
├── Telemedicine
└── Health Insurance

Retail
├── E-commerce
└── Marketplace
```

**Technical Domains (CHILD_OF):**
```
Backend
├── API Development
├── Database Engineering
└── Distributed Systems

Frontend
├── React Ecosystem
└── Web Performance

Machine Learning
├── NLP
├── Computer Vision
└── MLOps

DevOps
├── Cloud Infrastructure
├── Kubernetes/Containers
└── CI/CD
```

**Technical Domains (ENCOMPASSES):**
```
Full Stack encompasses Backend + Frontend
```

#### Better Approach: Best-Match with Hierarchy (Same as Skills)

For consistency with skill similarity, we use the same symmetric best-match approach:

| Comparison | Jaccard | Best-Match w/ Hierarchy |
|------------|---------|-------------------------|
| Fintech ↔ Banking | 0.0 (different IDs) | 0.5 (siblings under Finance) |
| Backend ↔ API Development | 0.0 | 0.4 (parent-child) |
| Healthcare ↔ Telemedicine | 0.0 | 0.4 (parent-child) |
| Full Stack ↔ Backend | 0.0 | 0.4 (encompasses) |
| Fintech ↔ Fintech | 1.0 | 1.0 (exact match) |
| Fintech ↔ Gaming | 0.0 | 0.0 (unrelated) |

The best-match approach recognizes that someone with Fintech experience is partially similar to someone with Banking experience—both understand financial services, regulatory concerns, and industry-specific patterns.

#### Proposed Algorithm

```typescript
/*
 * Main entry point: Calculate domain similarity between two engineers.
 * Uses symmetric best-match approach (average of both directions).
 * Handles both business and technical domains together.
 *
 * Calls: computeDomainBestMatchAverage
 */
function calculateDomainSimilarity(
  domainGraph: DomainGraph,
  targetDomains: DomainExperience[],
  candidateDomains: DomainExperience[]
): number {
  if (targetDomains.length === 0 && candidateDomains.length === 0) {
    return 1.0; // Both have no domains - perfectly similar
  }

  if (targetDomains.length === 0 || candidateDomains.length === 0) {
    return 0.0; // One has domains, the other doesn't - not similar
  }

  // Symmetric: average both directions
  const targetToCandidateAvg = computeDomainBestMatchAverage(
    domainGraph, targetDomains, candidateDomains
  );
  const candidateToTargetAvg = computeDomainBestMatchAverage(
    domainGraph, candidateDomains, targetDomains
  );

  return (targetToCandidateAvg + candidateToTargetAvg) / 2;
}

/*
 * For a set of domains, find best match score against another set.
 * Returns average of "how well is each domain covered by the other set?"
 *
 * Called by: calculateDomainSimilarity
 * Calls: computeDomainToDomainSimilarity
 */
function computeDomainBestMatchAverage(
  domainGraph: DomainGraph,
  sourceDomains: DomainExperience[],
  targetDomains: DomainExperience[]
): number {
  if (sourceDomains.length === 0) return 0;

  let totalBestMatch = 0;

  for (const source of sourceDomains) {
    let bestMatch = 0;
    for (const target of targetDomains) {
      const baseSim = computeDomainToDomainSimilarity(
        domainGraph, source.domainId, target.domainId
      );

      /*
       * Years similarity adjustment for matching/related domains.
       * See "Years Similarity Formula Rationale" section below.
       */
      let finalSim = baseSim;
      if (baseSim > 0) {
        const yearsSim = 1 - Math.abs(source.years - target.years) / 10;
        finalSim = baseSim * Math.max(0.5, yearsSim);
      }

      bestMatch = Math.max(bestMatch, finalSim);
    }
    totalBestMatch += bestMatch;
  }

  return totalBestMatch / sourceDomains.length;
}

/*
 * Compute similarity between two individual domains using hierarchy.
 * Returns a value between 0 (unrelated) and 1 (same domain).
 *
 * Called by: computeDomainBestMatchAverage
 *
 * Priority order (first match wins):
 *   1. Exact match → 1.0
 *   2. Siblings (share CHILD_OF parent) → 0.5 (e.g., Fintech ↔ Banking)
 *   3. Parent-child relationship → 0.4 (e.g., Finance ↔ Fintech)
 *   4. ENCOMPASSES relationship → 0.4 (e.g., Full Stack ↔ Backend)
 *   5. No relationship → 0.0
 */
function computeDomainToDomainSimilarity(
  domainGraph: DomainGraph,
  domainA: string,
  domainB: string
): number {
  // Same domain = perfect match
  if (domainA === domainB) return 1.0;

  // Check sibling relationship (both are children of the same parent)
  // e.g., Fintech and Banking are both children of Finance
  if (domainGraph.shareParent(domainA, domainB)) return 0.5;

  // Check parent-child relationship
  // e.g., Finance → Fintech or Backend → API Development
  if (domainGraph.isParentOf(domainA, domainB) ||
      domainGraph.isParentOf(domainB, domainA)) return 0.4;

  // Check encompasses relationship (for composite technical domains)
  // e.g., Full Stack encompasses Backend and Frontend
  if (domainGraph.encompasses(domainA, domainB) ||
      domainGraph.encompasses(domainB, domainA)) return 0.4;

  // No relationship found
  return 0.0;
}
```

#### Years Similarity Formula Rationale

When two domains are related (baseSim > 0), we adjust the similarity based on how similar their years of experience are:

```typescript
const yearsSim = 1 - Math.abs(source.years - target.years) / 10;
finalSim = baseSim * Math.max(0.5, yearsSim);
```

**Why factor in years at all?**

Domain similarity isn't just about *which* domains—it's also about *depth* of experience. Two engineers both with Fintech experience are more similar if they both have 5 years than if one has 1 year and the other has 8. The 1-year engineer is still learning the domain; the 8-year engineer has deep institutional knowledge.

| Target | Candidate | Same Domain? | Years Similarity | Intuition |
|--------|-----------|--------------|------------------|-----------|
| Fintech, 5yr | Fintech, 5yr | Yes (1.0) | 1.0 | Identical domain depth |
| Fintech, 5yr | Fintech, 3yr | Yes (1.0) | 0.8 | Similar depth |
| Fintech, 5yr | Fintech, 1yr | Yes (1.0) | 0.6 | Candidate is much greener |
| Fintech, 5yr | Banking, 5yr | Sibling (0.5) | 1.0 | Related domain, same depth |
| Fintech, 5yr | Banking, 1yr | Sibling (0.5) | 0.6 | Related domain, much greener |

**Why multiplication instead of addition?**

We use `baseSim * yearsSim` (multiplicative) rather than `baseSim + yearsSim` (additive) because:

1. **Years only matter when domains are related.** If domains are unrelated (baseSim = 0), years shouldn't rescue the score. An engineer with 10 years in Gaming has zero domain similarity to an engineer with 10 years in Healthcare, regardless of matching years.

2. **Multiplicative preserves the hierarchy.** A sibling domain (0.5) with perfect years match should still score lower than an exact domain (1.0) with imperfect years. Multiplication ensures this: `0.5 × 1.0 = 0.5` vs `1.0 × 0.8 = 0.8`.

3. **Intuitive interpretation.** The final score answers: "How much of this domain match is 'real'?" Years similarity acts as a confidence multiplier on the base match.

**Why cap the reduction at 50%?**

The `Math.max(0.5, yearsSim)` floor prevents years from dominating the score:

```
Without floor: Fintech(5yr) vs Fintech(1yr) → 1.0 × 0.6 = 0.60
With floor:    Fintech(5yr) vs Fintech(1yr) → 1.0 × 0.6 = 0.60 (no change, 0.6 > 0.5)

Without floor: Fintech(1yr) vs Fintech(10yr) → 1.0 × 0.1 = 0.10 (years dominates!)
With floor:    Fintech(1yr) vs Fintech(10yr) → 1.0 × 0.5 = 0.50 (domain still matters)
```

Without the floor, a 9-year experience gap would reduce an exact domain match to 0.1—worse than an unrelated domain with no experience. That's wrong: having *any* Fintech experience is more similar to a Fintech engineer than having *no* Fintech experience. The 50% floor ensures domain match remains the primary signal.

**Why 10 years as the normalization factor?**

The formula `1 - diff / 10` means a 10-year gap gives yearsSim = 0 (before the floor kicks in):

| Years Gap | yearsSim (raw) | yearsSim (floored) |
|-----------|----------------|---------------------|
| 0 years   | 1.0            | 1.0                 |
| 2 years   | 0.8            | 0.8                 |
| 5 years   | 0.5            | 0.5                 |
| 8 years   | 0.2            | 0.5 (floored)       |
| 10+ years | ≤0             | 0.5 (floored)       |

We chose 10 years because:
- It aligns with the domain experience range in our data (engineers have 1-10+ years per domain)
- Beyond 10 years, the difference is less meaningful (15 vs 20 years are both "very experienced")
- It provides good discrimination in the 0-5 year range where depth differences matter most

**Alternatives considered:**

1. **No years adjustment** — Treats Fintech(1yr) and Fintech(10yr) as identical. Loses useful signal about depth.

2. **Separate years score** — Calculate domain similarity and years similarity independently, then combine with weights. More complex, harder to tune, and years would affect unrelated domains.

3. **Asymmetric years (like experience similarity)** — More candidate years = good, fewer = bad. Rejected because for *similarity* we want "same depth," not "more is better." (We already have asymmetric handling in `calculateExperienceSimilarity` for total years.)

4. **Lower floor (e.g., 0.3)** — Would let years dominate more. We prefer domain match as the primary signal.

5. **Higher floor (e.g., 0.7)** — Would make years nearly irrelevant. Loses discrimination between same-depth and different-depth matches.

The 0.5 floor with multiplicative combination provides a reasonable balance: years matter for fine-grained discrimination, but domain relationship remains the primary factor.

#### Rationale for the Switch

1. **Consistency**: Skills use best-match with hierarchy; domains should too. Both have the same data model (CHILD_OF relationships) and the same problem (semantic similarity between related items).

2. **Leverage existing data**: We already seeded domain hierarchies in `seeds/domains.ts`. Jaccard ignores this data entirely. Best-match uses it.

3. **Domain expertise is transferable within families**: Someone with Fintech experience understands financial regulations, compliance, and industry patterns that transfer to Banking or Payments. Jaccard says they have zero similarity; best-match recognizes the partial overlap.

4. **Technical domain laddering**: An engineer with "Distributed Systems" experience has relevant "Backend" skills. The CHILD_OF relationship captures this—Backend → Distributed Systems means distributed systems expertise implies backend competence.

5. **Composite domains**: "Full Stack" encompasses both Backend and Frontend. An engineer with Full Stack experience should be somewhat similar to a pure Backend engineer, not completely different.

### 4. Availability/Timeline — EXCLUDED

#### Analysis: Should Timeline Factor Into Similarity?

An earlier draft included timeline similarity:

```typescript
// ❌ Earlier draft included this
function calculateTimelineSimilarity(
  targetTimeline: StartTimeline,
  candidateTimeline: StartTimeline
): number {
  const order = START_TIMELINE_ORDER; // from types/search.types.ts
  // ...position-based distance calculation
}
```

After analysis, we're **excluding timeline** from similarity scoring. Here's why:

**1. Timeline is transient, not intrinsic**

Skills, experience, and domain expertise are stable attributes that define *who an engineer is*. Timeline reflects their *current situation*—it changes when they finish a project, take on a new engagement, or their circumstances change.

| Attribute | Stability | What it measures |
|-----------|-----------|------------------|
| Skills | Stable | Capabilities |
| Years experience | Stable | Seniority/depth |
| Domain expertise | Stable | Industry knowledge |
| Timeline | **Transient** | Current availability |

**2. Same engineer, different timeline = same engineer**

Consider:
- Engineer A: React expert, 8 years, Fintech, available **immediately**
- Engineer B: React expert, 8 years, Fintech, available **in 3 months**

Are A and B "similar engineers"? **Yes**—they're practically identical in capability. The only difference is situational. If we penalize B's similarity score because of timeline, we're conflating "when can they start" (a scheduling constraint) with "what can they do" (a capability measure).

**3. Consistency with salary exclusion**

We already excluded salary with this rationale:

> "Ranking engineers by salary expectation would be unfair—two engineers with identical skills and experience are equally 'similar' regardless of their compensation expectations."

Timeline has the same issue. Two identical engineers shouldn't have different similarity scores because one happens to be finishing a project later. Both salary and timeline are job-fit constraints, not engineer-similarity attributes.

**4. Timeline is a filter, not a similarity dimension**

In constraint-based search (Projects 1-2), timeline is a filter/preference: "Show me engineers available within one month." That's appropriate—you're filtering based on operational needs.

In case-based similarity (Project 3), you're asking: "Who is like this engineer?" That question is about capability, not scheduling. If you need availability filtering on top of similarity results, apply it as a post-filter:

```typescript
// Better: similarity for capability, filter for availability
const similar = await findSimilarEngineers(targetId, { limit: 20 });
const availableSoon = similar.filter(e =>
  START_TIMELINE_ORDER.indexOf(e.startTimeline) <= START_TIMELINE_ORDER.indexOf('one_month')
);
```

**5. Practical use cases don't need it**

| Use Case | What matters | Timeline relevant? |
|----------|--------------|-------------------|
| "More like this" | Capabilities, experience | No |
| Replacement search | Capabilities, seniority | No (filter separately) |
| Team composition | Complementary skills | No |
| Mentorship matching | Seniority gap, skills | No |

In every case, timeline is better handled as a separate filter applied to similarity results, not baked into the score.

**Decision: Exclude timeline from similarity scoring.**

---

### 4. Timezone Similarity

Timezone is a borderline case. Unlike timeline (which is transient), timezone is relatively stable—it reflects where the engineer lives/works. However, it's still more of an operational compatibility factor than a capability attribute.

We include it with **low weight (0.06)** because:
- It has some signal for "working style similarity" (same timezone = similar working hours)
- It's stable enough to be meaningful
- The low weight ensures it doesn't dominate over capability attributes

```typescript
import { usTimezoneZones } from '../config/knowledge-base/compatibility-constraints.config.js';

function calculateTimezoneSimilarity(
  targetTz: string,
  candidateTz: string
): number {
  const zones = usTimezoneZones; // ['Eastern', 'Central', 'Mountain', 'Pacific']
  const targetIdx = zones.indexOf(targetTz);
  const candidateIdx = zones.indexOf(candidateTz);

  if (targetIdx === -1 || candidateIdx === -1) return 0;

  const maxDist = zones.length - 1; // 3 hours max difference
  const distance = Math.abs(targetIdx - candidateIdx);

  return 1 - (distance / maxDist);
}
```

---

## Proposed Similarity Weights

Based on the textbook's guidance and our domain. **Timeline excluded** (see analysis above).

```typescript
export const similarityWeights = {
  skills: 0.45,           // Most important differentiator (increased from 0.40)
  yearsExperience: 0.27,  // Seniority matters for replacement (increased from 0.25)
  domain: 0.22,           // Industry/technical context (increased from 0.20)
  timezone: 0.06,         // Geographic proximity (minor, increased from 0.05)
  // availability: EXCLUDED — transient property, not a capability attribute
};
```

**Weight redistribution:** The 0.10 previously allocated to timeline has been redistributed proportionally to the capability-based attributes (skills, experience, domain), with a small bump to timezone.

---

## Cypher Query for Loading Engineer Data

```cypher
// Get target engineer with all attributes
MATCH (target:Engineer {id: $engineerId})
OPTIONAL MATCH (target)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
OPTIONAL MATCH (target)-[:HAS_EXPERIENCE_IN]->(bd:BusinessDomain)
OPTIONAL MATCH (target)-[:HAS_EXPERIENCE_IN]->(td:TechnicalDomain)
WITH target,
     COLLECT(DISTINCT {
       skillId: s.id,
       skillName: s.name,
       proficiencyLevel: us.proficiencyLevel,
       confidenceScore: us.confidenceScore
     }) AS skills,
     COLLECT(DISTINCT {domainId: bd.id, type: 'business'}) AS businessDomains,
     COLLECT(DISTINCT {domainId: td.id, type: 'technical'}) AS technicalDomains

// Get all other engineers for comparison
MATCH (candidate:Engineer)
WHERE candidate.id <> $engineerId
OPTIONAL MATCH (candidate)-[:HAS]->(cus:UserSkill)-[:FOR]->(cs:Skill)
OPTIONAL MATCH (candidate)-[:HAS_EXPERIENCE_IN]->(cbd:BusinessDomain)
OPTIONAL MATCH (candidate)-[:HAS_EXPERIENCE_IN]->(ctd:TechnicalDomain)
WITH target, skills, businessDomains, technicalDomains, candidate,
     COLLECT(DISTINCT {
       skillId: cs.id,
       skillName: cs.name,
       proficiencyLevel: cus.proficiencyLevel,
       confidenceScore: cus.confidenceScore
     }) AS candidateSkills,
     COLLECT(DISTINCT {domainId: cbd.id}) AS candidateBusinessDomains,
     COLLECT(DISTINCT {domainId: ctd.id}) AS candidateTechnicalDomains

RETURN target, skills, businessDomains, technicalDomains,
       candidate, candidateSkills, candidateBusinessDomains, candidateTechnicalDomains
```

---

## Integration with Skill Correlations

The `CORRELATES_WITH` relationships are already seeded but not used in search queries. For similarity:

```cypher
// Find correlated skills between target and candidate
MATCH (targetSkill:Skill)<-[:FOR]-(:UserSkill)<-[:HAS]-(target:Engineer {id: $targetId})
MATCH (candidateSkill:Skill)<-[:FOR]-(:UserSkill)<-[:HAS]-(candidate:Engineer {id: $candidateId})
MATCH (targetSkill)-[c:CORRELATES_WITH]-(candidateSkill)
WHERE c.strength >= $minStrength
RETURN targetSkill.name AS targetSkill,
       candidateSkill.name AS candidateSkill,
       c.strength AS strength,
       c.correlationType AS type
```

---

## Diversity Implementation (Optional Phase 2)

If `diversityEnabled=true`, apply bounded greedy selection:

```typescript
function selectDiverseResults(
  candidates: SimilarityResult[],
  targetCount: number,
  bMultiplier: number = 3
): SimilarityResult[] {
  // Take top b*k candidates
  const pool = candidates.slice(0, targetCount * bMultiplier);
  const selected: SimilarityResult[] = [];

  while (selected.length < targetCount && pool.length > 0) {
    let bestIdx = 0;
    let bestQuality = -Infinity;

    for (let i = 0; i < pool.length; i++) {
      const candidate = pool[i];
      const avgDiversity = selected.length === 0
        ? 1.0
        : calculateAverageDiversity(candidate, selected);
      const quality = candidate.similarityScore * avgDiversity;

      if (quality > bestQuality) {
        bestQuality = quality;
        bestIdx = i;
      }
    }

    selected.push(pool[bestIdx]);
    pool.splice(bestIdx, 1);
  }

  return selected;
}
```

---

## Testing Strategy

### Unit Tests

1. **Skill similarity calculation** with mock skill sets
2. **Experience similarity** with asymmetric cases
3. **Domain similarity** with overlap scenarios
4. **Overall similarity** combining all components
5. **Diversity selection** with synthetic candidates

### Integration Tests

1. Load real engineer from Neo4j, verify similarity to themselves = 1.0
2. Engineers with no skill overlap should have low similarity
3. Engineers with similar profiles should rank higher
4. Verify correlation bonus for related skills

### E2E Tests (Postman)

1. `GET /api/engineers/eng_priya/similar` returns valid response
2. Target engineer not in results (exclude self)
3. Results sorted by similarity descending
4. Invalid engineer ID returns 404

---

## Code References

**Existing Utility Calculator:**
- `recommender_api/src/services/utility-calculator/utility-calculator.ts:42` - calculateUtilityWithBreakdown
- `recommender_api/src/services/utility-calculator/scoring/skill-scoring.ts:30` - calculateRequiredSkillsProficiencyMatch
- `recommender_api/src/services/utility-calculator/scoring/core-scoring.ts:20` - normalizeLinear

**Skill Relationships:**
- `seeds/skills.ts:147` - CHILD_OF hierarchy definitions
- `seeds/skills.ts:197` - CORRELATES_WITH definitions

**Configuration:**
- `recommender_api/src/config/knowledge-base/utility.config.ts` - Weights reference
- `recommender_api/src/config/knowledge-base/compatibility-constraints.config.ts` - Mappings

**Engineer Data Model:**
- `seeds/types.ts:41` - Engineer interface
- `seeds/engineers.ts` - Engineer seed data (40+ engineers)

---

## Architecture Insights

**Parallel to Utility Calculator:** The similarity calculator should mirror the utility calculator's modular structure for consistency, but with different semantics:

| Aspect | Utility Calculator | Similarity Calculator |
|--------|-------------------|----------------------|
| Input | Engineer + Requirements | Engineer + Engineer |
| Output | Score + Breakdown | Score + Breakdown |
| Weights | Optimized for search ranking | Optimized for case similarity |
| Asymmetry | N/A (requirements are targets) | Experience: more_is_better |
| Skills | Match against requirements | Overlap + hierarchy + correlations |

**Service Layer Pattern:** Follow existing patterns:
- Service files export functions (not classes)
- Config imported from knowledge-base
- Types in dedicated types.ts file
- Index.ts for public API exports

---

## Open Questions

1. **Behavioral skills weight?** Should behavioral skills (leadership, communication) be weighted differently than technical skills for similarity?

2. **Correlation direction?** `CORRELATES_WITH` is undirected in seeds. Should we treat it as bidirectional for similarity?

3. **Minimum skill overlap?** Should we return candidates with zero skill overlap? They'd have low similarity but might still appear in results.

## Design Decisions (Resolved)

1. **Salary and timeline excluded from similarity** — Both are situational properties, not capability attributes:
   - **Salary**: Two engineers with identical skills/experience are equally "similar" regardless of compensation expectations. Salary is a budget constraint, not a similarity dimension.
   - **Timeline**: Two engineers with identical capabilities are equally "similar" regardless of current availability. Timeline is transient (changes when projects end) and reflects scheduling, not capability. Apply timeline as a post-filter on similarity results if needed.

2. **Diversity enabled by default** — Bounded greedy selection (b=3) is baked in to prevent homogeneous results. Users don't need to understand or configure this.

3. **Simple API with baked-in defaults** — Implementation details like experience asymmetry (α=0.5) and diversity settings are not exposed as request parameters. Only `limit` is configurable. We can add parameters later if real users request them.

4. **Graph-aware skill similarity over pure Jaccard** — Pure Jaccard similarity treats all skills as equally different (React vs Vue = React vs PostgreSQL). This ignores our rich skill graph with CORRELATES_WITH, BELONGS_TO, and CHILD_OF relationships. Instead, we use a **best-match approach** where each skill finds its closest match in the other set using graph-based similarity:
   - Same skill = 1.0
   - CORRELATES_WITH = use actual strength (e.g., 0.95 for TypeScript↔JavaScript)
   - Same SkillCategory = 0.5
   - Share CHILD_OF parent = 0.3
   - Unrelated = 0.0

   This gives partial credit for related skills (React↔Vue = 0.5) rather than treating them as completely different. The approach fully leverages the skill graph we've already built.

5. **Graph-aware domain similarity over pure Jaccard** — Same reasoning as skills: Jaccard treats all domains as equally different (Fintech vs Banking = Fintech vs Gaming). But we have domain hierarchies in `seeds/domains.ts` with CHILD_OF and ENCOMPASSES relationships. We use the same **best-match approach** as skills:
   - Same domain = 1.0
   - Siblings (share parent) = 0.5 (e.g., Fintech↔Banking under Finance)
   - Parent-child = 0.4 (e.g., Finance↔Fintech)
   - ENCOMPASSES = 0.4 (e.g., Full Stack↔Backend)
   - Unrelated = 0.0

   This recognizes that Fintech and Banking engineers have transferable domain knowledge (both understand financial services), while Fintech and Gaming engineers don't.

---

## Related Research

- `thoughts/shared/research/2026-01-15-derived-skills-missing-from-relaxation-test-queries.md` - Skill handling in queries
- `docs/chapter_5/chapter5_reading_and_learning_path.md` - Project roadmap

---

## Next Steps for Implementation

1. Create `similarity-calculator/` module structure
2. Implement individual similarity functions with unit tests
3. Implement bounded greedy diversity selection
4. Add Cypher query for loading engineer comparison data
5. Create route/controller for `GET /api/engineers/:id/similar`
6. Add E2E tests to Postman collection
7. Document API in OpenAPI/Swagger
