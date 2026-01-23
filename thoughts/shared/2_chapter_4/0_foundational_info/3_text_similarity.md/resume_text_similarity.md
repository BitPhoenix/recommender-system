# Text Similarity: TF-IDF vs Embeddings

For matching resumes to job descriptions (or to other resumes), you need a vector representation that captures semantic similarity.

## Option A: TF-IDF (Sparse Vectors)

**How it works:**
```
Resume: "Built distributed systems using Kafka and Redis for real-time processing"

1. Tokenize: ["built", "distributed", "systems", "using", "kafka", "redis", "real-time", "processing"]
2. Weight by TF-IDF:
   - "distributed" → 0.42 (common in tech, moderate weight)
   - "kafka" → 0.89 (rare overall, high weight)
   - "built" → 0.12 (very common, low weight)
3. Result: Sparse vector with ~10,000+ dimensions, mostly zeros
```

**Pros:**
- Interpretable — you can see which keywords matched
- No ML model needed — pure statistical approach
- Fast and cheap to compute
- Works well for exact/near-exact term matching
- Easy to debug ("why did these match?" → show overlapping terms)

**Cons:**
- No semantic understanding — "Kubernetes" and "K8s" are completely different
- Vocabulary mismatch problem — "built APIs" vs "developed endpoints" don't match
- Sparse vectors are memory-inefficient for large corpora
- Can't capture context — "I don't know React" and "I know React" look similar

**Best for:**
- Keyword search / filtering
- When you need explainability
- Bootstrapping before you have training data
- Augmenting embedding-based search (hybrid approach)

## Option B: Embeddings (Dense Vectors)

**How it works:**
```
Resume: "Built distributed systems using Kafka and Redis for real-time processing"

1. Pass through embedding model (e.g., OpenAI ada-002, Cohere, sentence-transformers)
2. Result: Dense vector of 768-1536 dimensions, all non-zero
   [0.023, -0.041, 0.089, ..., 0.012]  // 768 floats
```

**Pros:**
- Semantic understanding — "Kubernetes" and "K8s" and "container orchestration" cluster together
- Handles paraphrasing — "built APIs" ≈ "developed endpoints"
- Fixed-size vectors regardless of document length
- Captures contextual meaning
- State-of-the-art for similarity search

**Cons:**
- Black box — hard to explain why two things matched
- Requires an embedding model (cost, latency, dependency)
- Can miss exact matches that TF-IDF would catch
- Model choice matters — general-purpose embeddings may not understand domain jargon
- Can encode biases present in training data

**Best for:**
- Semantic search ("find similar candidates")
- When vocabulary varies widely
- Matching across different phrasings (resume vs job description)
- Ranking candidates by relevance

## Head-to-Head Comparison

| Dimension | TF-IDF | Embeddings |
|-----------|--------|------------|
| "React" vs "React.js" | Different tokens, no match | Same concept, high similarity |
| "5 years Python" vs "Python expert" | Low match (different words) | High match (semantic overlap) |
| "Java" vs "JavaScript" | Different tokens, no match | Moderate similarity (problematic!) |
| Compute cost | Cheap, local | API call or GPU inference |
| Storage | Sparse, can be large | Dense, fixed size |
| Explainability | High (show matching terms) | Low (black box) |
| Cold start | Works immediately | Works immediately (pretrained) |
| Domain adaptation | Add domain terms to vocabulary | Fine-tune or hope general model works |

## The Hybrid Approach

In practice, production systems often combine both. But first, let's clarify two different filtering mechanisms that are often conflated:

### Inverted Index (True Hard Keyword Match)

When you say "must contain React AND Kafka," you're describing **boolean retrieval** via an inverted index:

```
Build an inverted index at ingestion time:

"react"      → [candidate_3, candidate_7, candidate_12, candidate_45, ...]
"kafka"      → [candidate_7, candidate_23, candidate_45, candidate_89, ...]
"typescript" → [candidate_3, candidate_12, candidate_45, ...]
...

Query: "React AND Kafka"
  → Intersect the posting lists
  → [candidate_7, candidate_45, ...]  (only candidates in BOTH lists)
```

This is binary yes/no on keyword presence. Fast and exact, but no ranking — a candidate who mentions React 10 times looks the same as one who mentions it once.

### TF-IDF Similarity Scoring

TF-IDF gives you **ranked results** based on term importance:

```
1. Pre-compute TF-IDF vector for each resume (at ingestion)
   candidate_7:  {"react": 0.72, "kafka": 0.89, "python": 0.45, ...}
   candidate_12: {"react": 0.68, "vue": 0.71, "graphql": 0.82, ...}

2. Compute TF-IDF vector for query
   query: {"react": 0.5, "kafka": 0.5}  (simplified)

3. Compute cosine similarity between query and all candidates
   similarity(query, candidate_7)  = 0.81
   similarity(query, candidate_12) = 0.34

4. Filter to candidates above threshold (e.g., > 0.3)
   OR take top-K (e.g., top 2,000)
```

This ranks by relevance but doesn't guarantee exact keyword presence — a candidate might score well without having all required terms.

### Why Combine Both?

| Pure Boolean | Pure TF-IDF | Hybrid |
|--------------|-------------|--------|
| "Has React" = yes/no | React mentioned 10x ranks higher than 1x | Boolean ensures presence, TF-IDF ranks by relevance |
| Fast (index lookup) | Slower (compute similarity for all 100K) | Fast filter, then score smaller set |
| No ranking | May return docs without required terms | Best of both |

### The Full Hybrid Pipeline

```
Query: "Senior React developer with Kafka experience"

Step 1: Extract required keywords
  → ["react", "kafka"] (hard requirements)

Step 2: Inverted index lookup (boolean filter)
  → Candidates containing BOTH "react" AND "kafka"
  → 100,000 → 2,000 candidates

Step 3: TF-IDF scoring on the filtered set
  → Score the 2,000 by TF-IDF similarity to full query
  → Candidates mentioning React/Kafka heavily rank higher
  → Candidates mentioning them once in passing rank lower

Step 4: Embedding re-ranking (optional)
  → Take top 500 from TF-IDF
  → Re-rank by semantic similarity to capture paraphrases

Step 5: Structured filter
  → Apply years of experience >= 5, location = remote, etc.
```

### Implementation Sketch

```typescript
interface InvertedIndex {
  // keyword → set of candidate IDs
  postings: Map<string, Set<string>>;
}

interface TfIdfIndex {
  // candidate ID → sparse vector of term weights
  vectors: Map<string, Map<string, number>>;
  // document frequency for IDF calculation
  documentFrequency: Map<string, number>;
  totalDocuments: number;
}

function hybridSearch(
  query: string,
  requiredKeywords: string[],
  invertedIndex: InvertedIndex,
  tfIdfIndex: TfIdfIndex,
  topK: number
): string[] {
  // Step 1: Boolean filter — must have all required keywords
  let candidateIds: Set<string> | null = null;
  for (const keyword of requiredKeywords) {
    const posting = invertedIndex.postings.get(keyword.toLowerCase());
    if (!posting) return []; // No candidates have this keyword

    if (candidateIds === null) {
      candidateIds = new Set(posting);
    } else {
      // Intersect: keep only candidates in both sets
      candidateIds = new Set(
        [...candidateIds].filter(id => posting.has(id))
      );
    }
  }

  if (!candidateIds || candidateIds.size === 0) return [];

  // Step 2: TF-IDF scoring on filtered set
  const queryVector = computeTfIdfVector(query, tfIdfIndex);

  const scored: Array<{ id: string; score: number }> = [];
  for (const candidateId of candidateIds) {
    const candidateVector = tfIdfIndex.vectors.get(candidateId);
    if (candidateVector) {
      const score = cosineSimilarity(queryVector, candidateVector);
      scored.push({ id: candidateId, score });
    }
  }

  // Step 3: Return top K by score
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(s => s.id);
}
```

### Summary

This gives you:
- **Precision** from boolean filtering (guaranteed keyword presence)
- **Ranking** from TF-IDF (relevance scoring within the filtered set)
- **Recall** from semantic embeddings (catch paraphrases and synonyms)
- **Efficiency** from filtering before expensive operations

---

## Putting It Together

For a talent marketplace processing resumes:

```
Raw Resume (PDF/Text)
        │
        ▼
┌───────────────────┐
│  LLM Extraction   │ → Structured profile (skills, years, seniority, etc.)
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Validation &     │ → Canonical skills, confidence scores
│  Normalization    │
└───────────────────┘
        │
        ├──────────────────────────────────┐
        ▼                                  ▼
┌───────────────────┐              ┌───────────────────┐
│  Store in Graph   │              │  Generate Vectors │
│  (Neo4j)          │              │  (TF-IDF and/or   │
│                   │              │   Embeddings)     │
│  - Skill nodes    │              └───────────────────┘
│  - Relationships  │                      │
│  - Properties     │                      ▼
└───────────────────┘              ┌───────────────────┐
        │                          │  Vector Store     │
        │                          │  (Neo4j / Pinecone)│
        │                          └───────────────────┘
        │                                  │
        └──────────────┬───────────────────┘
                       ▼
              ┌───────────────────┐
              │  Hybrid Query     │
              │  - Cypher for     │
              │    constraints    │
              │  - Vector for     │
              │    similarity     │
              └───────────────────┘
```

The structured extraction feeds your constraint-based matching (hard requirements), while the vector representation enables similarity-based ranking (soft preferences and semantic matching).
