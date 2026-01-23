# Skill Embeddings: From Graph Nodes to Semantic Vectors

This document explains how skill embeddings work, why they improve job-candidate matching, and how they complement our existing graph-based skill system.

## Current System: Skills as Graph Nodes

Our system represents skills as nodes in a Neo4j graph with explicit relationships:

```
                    ┌─── SkillSynonym("react.js") ───┐
                    │                                 │
Skill("React") ◄────┼─── SkillSynonym("reactjs") ────┤ ALIAS_FOR
                    │                                 │
                    └─── SkillSynonym("react js") ───┘

Skill("React") ──CHILD_OF──► Skill("Frontend")

Skill("React") ──CORRELATES_WITH──► Skill("TypeScript")
```

### Current Matching Process

1. **Exact match**: Job requires "React" → find Skill node with name "React"
2. **Synonym lookup**: Resume says "react.js" → SkillSynonym resolves to "React"
3. **Fuzzy match**: Resume says "Reakt" → Levenshtein distance finds "React"
4. **Hierarchy expansion**: Job requires "Frontend" → includes all CHILD_OF descendants

### The Limitation

What about skills that are *semantically related* but have no explicit relationship defined?

| Job Requires | Resume Has | Current System | Reality |
|--------------|------------|----------------|---------|
| "Kubernetes" | "Docker" | No match (different skills) | Strong signal - containerization experience |
| "React" | "Vue" | No match | Moderate signal - modern frontend frameworks |
| "Kafka" | "RabbitMQ" | No match | Strong signal - message queue experience |
| "Machine Learning" | "Deep Learning" | Maybe CHILD_OF? | Very strong signal |
| "PostgreSQL" | "MySQL" | No match | Strong signal - relational database experience |

To capture these relationships with graph edges alone, we would need to manually curate thousands of CORRELATES_WITH relationships. Skill embeddings solve this automatically.

---

## Skill Embeddings: Skills as Vectors

With embeddings, each skill becomes a **point in semantic space** - a dense vector where similar concepts cluster together.

### Conceptual Visualization

```
Skill Embedding Space (simplified to 2D)

                    ▲
                    │
     "Kubernetes" ● │ ● "Docker"           ← Close together (containerization)
                    │     ● "Helm"
                    │
     "Kafka"      ● │ ● "RabbitMQ"         ← Close together (message queues)
                    │     ● "Redis Streams"
                    │
────────────────────┼─────────────────────►
                    │
         "React"  ● │ ● "Vue"              ← Close together (frontend frameworks)
                    │     ● "Angular"
                    │
        "Python"  ● │         ● "Java"     ← Farther apart (different paradigms)
                    │
```

### How It Works

1. **Generate embedding** for each skill name using an embedding model:
   ```
   embed("Kubernetes") → [0.23, -0.45, 0.12, 0.87, ..., -0.31]  // 1024 dimensions
   embed("Docker")     → [0.21, -0.42, 0.15, 0.85, ..., -0.28]  // Similar vector
   ```

2. **Store on Skill node** in Neo4j:
   ```cypher
   MATCH (s:Skill {name: "Kubernetes"})
   SET s.embedding = [0.23, -0.45, ...],
       s.embeddingModel = 'mxbai-embed-large'
   ```

3. **Compute similarity** between any two skills:
   ```
   cosine_similarity(embed("Kubernetes"), embed("Docker")) = 0.89  // Very similar
   cosine_similarity(embed("Kubernetes"), embed("React"))  = 0.31  // Not similar
   ```

### Why This Works

Embedding models (like mxbai-embed-large) are trained on massive text corpora. They learn that:
- "Kubernetes" and "Docker" appear in similar contexts (DevOps, containers, orchestration)
- "React" and "Vue" appear in similar contexts (frontend, JavaScript, components)
- "Kafka" and "RabbitMQ" appear in similar contexts (messaging, queues, event-driven)

The model encodes this co-occurrence knowledge into the vector representations.

---

## How Skill Embeddings Improve Matching

### Example: Job Description Matching

**Job requires**: React, Kafka, Kubernetes, PostgreSQL

**Candidate A** has: React, RabbitMQ, Docker, MySQL
**Candidate B** has: React, Redis, Ansible, SQLite

### Current System (exact + synonym matching)

| Candidate | Exact Matches | Score |
|-----------|---------------|-------|
| A | React | 1/4 = 25% |
| B | React | 1/4 = 25% |

**Result**: Tie - we can't distinguish between them.

### With Skill Embeddings

We compute similarity between each required skill and each candidate skill:

**Candidate A**:
| Required | Best Match | Similarity |
|----------|------------|------------|
| React | React | 1.00 |
| Kafka | RabbitMQ | 0.85 (both message queues) |
| Kubernetes | Docker | 0.89 (both containerization) |
| PostgreSQL | MySQL | 0.91 (both relational DBs) |
| **Average** | | **0.91** |

**Candidate B**:
| Required | Best Match | Similarity |
|----------|------------|------------|
| React | React | 1.00 |
| Kafka | Redis | 0.62 (both can do pub/sub, but different) |
| Kubernetes | Ansible | 0.45 (both infra, but different paradigms) |
| PostgreSQL | SQLite | 0.78 (both SQL, but different scale) |
| **Average** | | **0.71** |

**Result**: Candidate A (0.91) clearly better than Candidate B (0.71).

---

## Skill-Set Similarity Computation

### Approach 1: Centroid Similarity (Simple)

Average all skill embeddings into a single "skill profile" vector, then compare:

```typescript
function computeSkillSetSimilarity(
  requiredSkillEmbeddings: number[][],
  candidateSkillEmbeddings: number[][]
): number {
  // Compute centroid (average) of each skill set
  const requiredCentroid = mean(requiredSkillEmbeddings);
  const candidateCentroid = mean(candidateSkillEmbeddings);

  // Compare centroids
  return cosineSimilarity(requiredCentroid, candidateCentroid);
}
```

**Pros**: Fast, single comparison
**Cons**: Loses information about individual skill matches

### Approach 2: Best-Match Pairing (More Explainable)

For each required skill, find the most similar candidate skill:

```typescript
interface SkillMatch {
  requiredSkill: string;
  matchedSkill: string;
  similarity: number;
}

function computeSkillSetSimilarity(
  requiredSkills: Array<{ name: string; embedding: number[] }>,
  candidateSkills: Array<{ name: string; embedding: number[] }>
): { score: number; matches: SkillMatch[] } {
  const matches: SkillMatch[] = [];

  for (const required of requiredSkills) {
    let bestMatch = { skill: '', similarity: 0 };

    for (const candidate of candidateSkills) {
      const similarity = cosineSimilarity(required.embedding, candidate.embedding);
      if (similarity > bestMatch.similarity) {
        bestMatch = { skill: candidate.name, similarity };
      }
    }

    matches.push({
      requiredSkill: required.name,
      matchedSkill: bestMatch.skill,
      similarity: bestMatch.similarity,
    });
  }

  const score = mean(matches.map(m => m.similarity));
  return { score, matches };
}
```

**Pros**: Explainable ("Kafka matched to RabbitMQ with 0.85 similarity")
**Cons**: O(n*m) comparisons

### Approach 3: Weighted by Experience (Eightfold-Style)

Weight candidate skills by years of experience or recency:

```typescript
function computeWeightedSkillSetSimilarity(
  requiredSkillEmbeddings: number[][],
  candidateSkills: Array<{ embedding: number[]; yearsUsed: number }>
): number {
  // Weight by experience (more years = higher weight)
  const totalYears = sum(candidateSkills.map(s => s.yearsUsed));
  const weights = candidateSkills.map(s => s.yearsUsed / totalYears);

  // Weighted centroid
  const candidateCentroid = weightedMean(
    candidateSkills.map(s => s.embedding),
    weights
  );

  const requiredCentroid = mean(requiredSkillEmbeddings);
  return cosineSimilarity(requiredCentroid, candidateCentroid);
}
```

**Pros**: 5 years of Docker experience weights more than 6 months
**Cons**: Requires accurate years data

---

## Implementation Plan

### Step 1: Generate Skill Embeddings (Seed Script)

```typescript
// seeds/skill-embeddings.ts
import { Session } from "neo4j-driver";
import { generateEmbedding, getEmbeddingModelName } from "../recommender_api/src/services/llm.service.js";

export async function seedSkillEmbeddings(session: Session): Promise<void> {
  console.log("[Seed] Generating skill embeddings...");

  // Get all skills without embeddings
  const result = await session.run(`
    MATCH (s:Skill)
    WHERE s.embedding IS NULL
    RETURN s.id AS skillId, s.name AS skillName
  `);

  let successCount = 0;
  for (const record of result.records) {
    const skillId = record.get('skillId');
    const skillName = record.get('skillName');

    const embedding = await generateEmbedding(skillName);
    if (embedding) {
      await session.run(`
        MATCH (s:Skill {id: $skillId})
        SET s.embedding = $embedding,
            s.embeddingModel = $model,
            s.embeddingUpdatedAt = datetime()
      `, { skillId, embedding, model: getEmbeddingModelName() });
      successCount++;
    }
  }

  console.log(`[Seed] Generated ${successCount} skill embeddings`);
}
```

### Step 2: Create Vector Index

```cypher
CREATE VECTOR INDEX skill_embedding_index
FOR (s:Skill) ON (s.embedding)
OPTIONS {
  indexConfig: {
    `vector.dimensions`: 1024,
    `vector.similarity_function`: 'cosine'
  }
}
```

### Step 3: Skill Similarity Service

```typescript
// services/skill-similarity.service.ts
import { Session } from "neo4j-driver";

export interface SkillSimilarityResult {
  score: number;
  matchedPairs: Array<{
    requiredSkill: string;
    matchedSkill: string;
    similarity: number;
  }>;
}

export async function computeSkillSetSimilarity(
  session: Session,
  requiredSkillIds: string[],
  candidateSkillIds: string[]
): Promise<SkillSimilarityResult> {
  // Load skill embeddings
  const result = await session.run(`
    UNWIND $requiredIds AS reqId
    MATCH (req:Skill {id: reqId})
    UNWIND $candidateIds AS candId
    MATCH (cand:Skill {id: candId})
    WITH req, cand,
         gds.similarity.cosine(req.embedding, cand.embedding) AS similarity
    ORDER BY req.id, similarity DESC
    WITH req, collect({skill: cand, similarity: similarity})[0] AS bestMatch
    RETURN req.id AS requiredId, req.name AS requiredName,
           bestMatch.skill.id AS matchedId, bestMatch.skill.name AS matchedName,
           bestMatch.similarity AS similarity
  `, { requiredIds: requiredSkillIds, candidateIds: candidateSkillIds });

  const matchedPairs = result.records.map(r => ({
    requiredSkill: r.get('requiredName'),
    matchedSkill: r.get('matchedName'),
    similarity: r.get('similarity'),
  }));

  const score = matchedPairs.reduce((sum, p) => sum + p.similarity, 0) / matchedPairs.length;

  return { score, matchedPairs };
}
```

### Step 4: Integrate as Scoring Feature

```typescript
// In match feature extraction
interface MatchFeatures {
  // Existing features
  exactSkillMatchScore: number;      // Current constraint search
  profileEmbeddingSimilarity: number; // Full profile embedding

  // New feature
  skillEmbeddingSimilarity: number;   // Skill-set to skill-set
}
```

---

## Graph Relationships vs Skill Embeddings

Both approaches have value - they're complementary, not competing.

| Aspect | Graph Relationships | Skill Embeddings |
|--------|--------------------|--------------------|
| **Precision** | High (explicit, human-curated) | Medium (learned, may over-generalize) |
| **Coverage** | Low (only defined relationships) | High (any skill pair has similarity) |
| **Explainability** | "React is a Frontend skill" | "React and Vue are 0.72 similar" |
| **Maintenance** | Manual curation required | Automatic (re-embed when model improves) |
| **False positives** | Rare (curated) | Possible (Java ~ JavaScript = 0.65?) |
| **Hierarchy** | Explicit (CHILD_OF) | Implicit (cluster proximity) |
| **Use case** | Hard constraints, category filtering | Soft matching, gap-filling |

### Recommended Approach: Use Both

1. **Graph relationships** for:
   - Exact skill matching (required skills)
   - Skill hierarchy expansion (Frontend → React, Vue, Angular)
   - High-confidence correlations (React ↔ TypeScript)

2. **Skill embeddings** for:
   - Soft similarity scoring (additional feature)
   - Gap-filling when exact match fails
   - Discovering implicit skill relationships
   - Ranking candidates with partial matches

The scoring model learns the right balance between exact matches and semantic similarity.

---

## Potential Issues and Mitigations

### Issue 1: Over-Generalization

**Problem**: Java and JavaScript have ~0.65 similarity because both contain "Java" and appear in programming contexts.

**Mitigation**:
- Use embeddings as a *feature*, not a filter
- Exact match score should dominate; embedding similarity is a tiebreaker
- Consider fine-tuning embeddings on tech-specific corpus

### Issue 2: Version Confusion

**Problem**: "Python 2" and "Python 3" are very similar embeddings, but compatibility matters.

**Mitigation**:
- Graph relationships can encode version constraints
- Consider embedding skill + context ("Python for ML" vs "Python for scripting")

### Issue 3: Embedding Quality

**Problem**: General-purpose embedding models may not understand niche technologies.

**Mitigation**:
- Augment skill names with descriptions: embed("Kubernetes - container orchestration platform")
- Consider tech-specific embedding models
- Fallback to graph relationships for niche skills

---

## Connection to Eightfold Architecture

This skill embedding approach aligns with **Eightfold's Phase 4: Token-Level Skill Embeddings**.

Eightfold's learning plan shows:

```
Phase 4: Token-Level Skill Embeddings (Step 2a of Eightfold)

Step 4.1: Build skill vocabulary from CMap
Step 4.2: Create skill embeddings
  - Option A: Use pretrained encoder on skill names
  - Option B: Train Word2Vec/FastText on skill co-occurrence
Step 4.3: Implement skill similarity scoring
Step 4.4: Add recency weighting
```

Our implementation would use Option A (pretrained encoder via Ollama's mxbai-embed-large), which is simpler but effective for MVP. Option B (training on co-occurrence) could be a future enhancement.

---

## Summary

| Current State | With Skill Embeddings |
|---------------|----------------------|
| Skills matched by exact name, synonym, or fuzzy string | Skills matched by semantic similarity |
| Unrelated skills = no match | Similar skills = soft match with score |
| Manual CORRELATES_WITH curation | Automatic similarity from embeddings |
| Binary: matches or doesn't | Continuous: 0.0 to 1.0 similarity |

**Key insight**: Skill embeddings don't replace graph relationships - they fill in the gaps between explicitly defined relationships, providing a soft similarity signal that the scoring model can learn to weight appropriately.
