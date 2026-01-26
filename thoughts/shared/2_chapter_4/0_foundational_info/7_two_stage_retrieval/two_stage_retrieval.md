# Two-Stage Retrieval: Speed vs. Coverage Tradeoffs

When matching candidates to jobs (or any large-scale retrieval problem), evaluating every candidate against every criterion is prohibitively expensive. Two-stage retrieval solves this by:

1. **Stage 1 (Retrieval)**: Quickly narrow down to a candidate pool
2. **Stage 2 (Scoring)**: Apply expensive scoring only to the candidate pool

The critical question: **What should Stage 1 use?**

## The Speed/Coverage Tradeoff

### Semantic-First Retrieval (What We Implemented)

```
Stage 1: HNSW vector search on embeddings → top 100 candidates
Stage 2: Compute skill coverage, seniority match, etc. on 100 candidates
```

**Speed benefits:**
- HNSW is O(log n) - milliseconds regardless of corpus size
- Expensive graph queries (skill relationships, domain lookups) only run on 100 candidates
- 10,000 engineers → 100 candidates = 99% reduction before heavy computation

**Coverage risk:**
- Semantic similarity acts as a hard filter
- Candidates who don't rank in the top-K by embedding similarity are never evaluated
- This can miss:
  - Engineers with great skill coverage but sparse/atypical resume text
  - Strong structured matches (right seniority, timezone, exact skills) but low semantic similarity
  - Cases where embeddings didn't capture relevant experience

### Graph-First Retrieval (Alternative)

```
Stage 1: Graph query "engineers with ≥1 required skill" → N candidates
Stage 2: Compute semantic similarity + other signals on N candidates
```

**Coverage benefits:**
- Guarantees skill-matching candidates aren't missed
- Explicit criteria (skills, domains, seniority) drive initial selection
- No "embedding blind spots"

**Speed cost:**
- Graph traversal is O(n) in worst case
- If required skills are common, candidate pool can be huge
- Example: "Must have JavaScript" → 80% of engineers qualify

## Visualizing the Tradeoff

```
All Engineers (10,000)
        │
        ├─── Semantic First ────────────────────────┐
        │    (fast, may miss explicit matches)      │
        │                                           ▼
        │                              Candidate Pool (100)
        │                                           │
        │                              Score with all signals
        │                                           │
        │                                     Results (10)
        │
        └─── Graph First ───────────────────────────┐
             (slower, guarantees explicit matches)  │
                                                    ▼
                                       Candidate Pool (500-2000)
                                                    │
                                       Score with all signals
                                                    │
                                              Results (10)
```

## When Each Approach Wins

### Semantic-First is Better When:

1. **Corpus is huge** and explicit criteria are broad
   - "Senior engineer" + "knows JavaScript" = too many matches

2. **Semantic fit matters most**
   - Similarity search ("find engineers like this one")
   - Natural language queries ("ML engineer for fintech startup")

3. **Embeddings are high quality**
   - Well-trained on domain data
   - Capture the relevant signals

### Graph-First is Better When:

1. **Explicit criteria are selective**
   - "Must have Kubernetes AND Terraform AND AWS" = small candidate pool

2. **Hard requirements are non-negotiable**
   - Compliance roles: "Must have healthcare/HIPAA experience"
   - Literal skill matches matter more than vibes

3. **Embeddings have known blind spots**
   - New skills not well-represented in training data
   - Domain-specific terminology

## Hybrid Approaches

### Multi-Path Retrieval

Run both and merge:

```
Path A: Semantic top-100 by embedding similarity
Path B: Graph query "has ≥2 required skills"
        ↓
    Deduplicate
        ↓
  Combined candidate pool (150-200)
        ↓
   Score all candidates
```

**Benefit:** Best of both worlds - semantic coverage + explicit guarantees
**Cost:** More candidates to score, more complex pipeline

### Filtered Vector Search

Neo4j and other vector DBs support pre-filtering:

```cypher
CALL db.index.vector.queryNodes('engineer_embedding', 100, $jobEmbedding)
YIELD node, score
WHERE node.yearsExperience >= 5
  AND EXISTS((node)-[:HAS]->(:UserSkill)-[:FOR]->(:Skill {id: 'skill_kubernetes'}))
RETURN node, score
```

**Benefit:** Single query, filtering happens during vector search
**Cost:** Filter predicates add latency to vector search

### Coarse-to-Fine

Use cheap signals first, expensive signals later:

```
Stage 1: HNSW → top 500 candidates
Stage 2: Quick graph check (has any required skill?) → 200 candidates
Stage 3: Full scoring → top 10
```

## Our Current Implementation

```typescript
// Stage 1: Semantic retrieval
const candidatePoolSize = Math.max((request.limit + request.offset) * 3, 100);
const candidates = await findSimilarEngineersByEmbedding(
  session,
  jobEmbedding,
  candidatePoolSize
);

// Stage 2: Full scoring on candidate pool
for (const candidate of candidates) {
  const signals = await computeJobEngineerMatchSignals(...);
  const score = computeWeightedScore(signals, weights);
}
```

**Trade-off accepted:** We risk missing good explicit matches for fast retrieval.

**Mitigation:**
- Pool size of 3x requested results (minimum 100)
- Assumption that semantic similarity correlates with explicit match quality

**When to revisit:**
- If users report "obvious" candidates missing from results
- If required skills have low embedding coverage
- If switching to graph-first doesn't hurt latency unacceptably

## Embedding Similarity vs. Explicit Graph Relationships

A related question: if embeddings capture semantic similarity, do we need explicit skill relationships in the graph?

### What Embeddings Capture

Skill embeddings trained on technical content place related skills nearby:
- React ↔ Vue: close (both frontend frameworks)
- Python ↔ Machine Learning: close (frequently co-occur)
- Kubernetes ↔ Docker: close (container ecosystem)

The centroid comparison implicitly rewards engineers with semantically similar skills.

### What Explicit Graph Edges Add

1. **Asymmetric relationships**
   - "Has Kubernetes → implies Docker knowledge" but not vice versa
   - Embeddings are symmetric; skill implications often aren't

2. **Curated certainty**
   - "TypeScript is a superset of JavaScript" is certain
   - Embedding proximity is probabilistic

3. **Relationship types**
   - "commonly-used-together" vs "is-prerequisite-for" vs "migration-path-from"
   - Embeddings collapse these into one similarity score

4. **Explainability**
   - "Matched because has React (related to required Vue)" is interpretable
   - "Embedding similarity was 0.82" is not

### Verdict

Embeddings capture ~80% of "related skills" signal implicitly. Explicit graph edges add value for:
- Asymmetric inference (advanced → basic skill implication)
- Explainability
- Rare/new skills not well-represented in embeddings

For MVP, embedding similarity is sufficient. Graph-based skill relationships are a future enhancement.

## Summary

| Approach | Speed | Coverage | Best For |
|----------|-------|----------|----------|
| Semantic-first | O(log n) | May miss explicit matches | Large corpus, semantic queries |
| Graph-first | O(n) worst case | Guarantees explicit matches | Selective criteria, hard requirements |
| Multi-path | 2x retrieval cost | Best coverage | When coverage is critical |
| Filtered vector | Moderate | Good | When filter predicates are selective |

Our MVP uses semantic-first for speed, accepting coverage risk. If users report missing obvious candidates, we'll add graph-based retrieval as a second path.
