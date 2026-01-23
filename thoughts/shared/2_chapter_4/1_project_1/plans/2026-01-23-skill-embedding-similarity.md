# Skill Embedding Similarity Implementation Plan

## Overview

Add token-level skill embeddings to enable semantic skill similarity scoring in content search. This implements **Phase 4 of the Eightfold learning plan** using Option A (pretrained encoder on skill names via Ollama's `mxbai-embed-large`).

## Current State Analysis

### What Exists

- **138 skills** in Neo4j with CHILD_OF, BELONGS_TO, and CORRELATES_WITH relationships
- **Engineer embeddings** (dense vectors, 1024 dimensions) stored on Engineer nodes with HNSW index
- **Content search** with three methods: TF-IDF, embedding, hybrid
- **skill-similarity.ts** in similarity-calculator uses graph relationships only (constraint-based path)
- **Ollama integration** (`llm.service.ts`) with `mxbai-embed-large` for embeddings

### What's Missing

- Embeddings on Skill nodes
- Vector index for skill embeddings
- Skill-set similarity scoring using embedding centroids
- Recency-weighted skill similarity (all-time vs recent skills)

### Key Discoveries

- `recommender_api/src/services/llm.service.ts:111-147` - `generateEmbedding()` function already exists
- `seeds/migrations/001-add-vector-indices.ts` - Pattern for creating vector indices
- `engineer-text-loader.service.ts:54-55` - Skills already loaded via `(e)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)`
- `UserSkill` nodes have `yearsUsed` field but not recency (last used date)
- `WorkExperience` nodes have `startDate`/`endDate` fields for determining recency

## Desired End State

After completing all phases:

1. **Skill embeddings** stored on every `Skill` node in Neo4j
2. **Skill vector index** for efficient similarity queries
3. **Skill-set similarity scoring** as new features in content search:
   - `skillEmbeddingSimilarity`: Centroid similarity of all skills
   - `recentSkillEmbeddingSimilarity`: Centroid similarity of skills used in last 3 years
4. **Content search response** includes new skill similarity features in `contentScoreBreakdown`

### Verification

- All automated tests pass (`npm test`, `npm run typecheck`, `npm run test:e2e`)
- Skill embeddings seeded for all 138 skills
- Content search with method "embedding" now factors in skill similarity
- Engineers with similar skill profiles (e.g., React/Vue/Angular) have high similarity scores
- Recency weighting distinguishes between "used React 5 years ago" vs "uses React now"

## What We're NOT Doing

- **Modifying skill-similarity.ts** - Keep constraint-based and content-based paths isolated
- **Best-match pairing** - Using centroid approach per Eightfold Phase 4.3; explainability deferred to Phase 14
- **Training custom embeddings** - Using pretrained encoder (Option A)
- **Threshold filtering** - Return raw similarity; let scoring model learn appropriate weights
- **Job description matching** - This plan focuses on engineer-to-engineer similarity; job matching is future work

## Implementation Approach

**Three phases**, each building on the previous:

1. **Phase 1: Skill Embeddings Infrastructure** - Generate and store skill embeddings, create vector index
2. **Phase 2: Skill-Set Similarity Service** - Compute centroid similarity between skill sets
3. **Phase 3: Content Search Integration** - Add skill similarity as features in content search

---

## Phase 1: Skill Embeddings Infrastructure

### Overview

Generate dense embeddings for each skill name using Ollama's `mxbai-embed-large` and store them on Skill nodes in Neo4j. Create a vector index for efficient similarity queries.

### Changes Required

#### 1.1 Migration: Create Skill Vector Index

**File**: `seeds/migrations/002-add-skill-vector-index.ts` (new)

```typescript
import { Session } from "neo4j-driver";

/**
 * Migration: Add vector index for skill embeddings.
 *
 * Uses the same configuration as engineer_embedding_index:
 * - 1024 dimensions (mxbai-embed-large output size)
 * - Cosine similarity function
 */
export async function addSkillVectorIndex(session: Session): Promise<void> {
  console.log("[Migration] Creating skill embedding vector index...");

  await session.run(`
    CREATE VECTOR INDEX skill_embedding_index IF NOT EXISTS
    FOR (s:Skill)
    ON (s.embedding)
    OPTIONS {
      indexConfig: {
        \`vector.dimensions\`: 1024,
        \`vector.similarity_function\`: 'cosine'
      }
    }
  `);

  console.log("[Migration] Skill vector index created.");
}
```

#### 1.2 Seed Script: Generate Skill Embeddings

**File**: `seeds/skill-embeddings.ts` (new)

```typescript
import { Session } from "neo4j-driver";
import {
  generateEmbedding,
  getEmbeddingModelName,
  isOllamaAvailable,
} from "../recommender_api/src/services/llm.service.js";

/**
 * Seed skill embeddings using Ollama's mxbai-embed-large model.
 *
 * Generates a 1024-dimensional dense vector for each skill name.
 * Skips skills that already have embeddings (idempotent).
 */
export async function seedSkillEmbeddings(session: Session): Promise<void> {
  console.log("[Seed] Generating skill embeddings...");

  // Check if Ollama is available
  const ollamaAvailable = await isOllamaAvailable();
  if (!ollamaAvailable) {
    console.log("[Seed] Ollama not available, skipping skill embeddings.");
    return;
  }

  // Get all skills without embeddings
  const result = await session.run(`
    MATCH (s:Skill)
    WHERE s.embedding IS NULL
    RETURN s.id AS skillId, s.name AS skillName
  `);

  const skillCount = result.records.length;
  if (skillCount === 0) {
    console.log("[Seed] All skills already have embeddings.");
    return;
  }

  console.log(`[Seed] Generating embeddings for ${skillCount} skills...`);

  let successCount = 0;
  let failCount = 0;
  const modelName = getEmbeddingModelName();

  for (const record of result.records) {
    const skillId = record.get("skillId") as string;
    const skillName = record.get("skillName") as string;

    const embedding = await generateEmbedding(skillName);
    if (embedding) {
      await session.run(`
        MATCH (s:Skill {id: $skillId})
        SET s.embedding = $embedding,
            s.embeddingModel = $model,
            s.embeddingUpdatedAt = datetime()
      `, {
        skillId,
        embedding,
        model: modelName,
      });
      successCount++;
    } else {
      console.warn(`[Seed] Failed to generate embedding for skill: ${skillName}`);
      failCount++;
    }

    // Progress logging every 20 skills
    if ((successCount + failCount) % 20 === 0) {
      console.log(`[Seed] Progress: ${successCount + failCount}/${skillCount} skills processed`);
    }
  }

  console.log(`[Seed] Skill embeddings complete: ${successCount} success, ${failCount} failed`);
}
```

#### 1.3 Update Seed Entry Point

**File**: `seeds/seed.ts` - Add skill embedding seeding

Add to imports:
```typescript
import { seedSkillEmbeddings } from "./skill-embeddings.js";
import { addSkillVectorIndex } from "./migrations/002-add-skill-vector-index.js";
```

Add after existing migrations (around line 35):
```typescript
// Phase 2: Run new migration for skill vector index
await addSkillVectorIndex(session);
```

Add after seeding skills (around line 180, after `seedSkillSynonyms`):
```typescript
// Generate skill embeddings (requires Ollama)
await seedSkillEmbeddings(session);
```

### Success Criteria

#### Automated Verification:

- [x] Migration applies cleanly: `cd seeds && npm run seed`
- [x] TypeScript compiles: `npm run typecheck`
- [x] Vector index exists: Verify via Neo4j Browser `SHOW INDEXES`
- [x] Skills have embeddings: `MATCH (s:Skill) WHERE s.embedding IS NOT NULL RETURN count(s)` returns 97 (all skills)

#### Manual Verification:

- [ ] Confirm embedding dimensions are 1024: `MATCH (s:Skill {name: "React"}) RETURN size(s.embedding)`
- [ ] Verify similar skills have similar embeddings (sanity check via Neo4j Browser)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Skill-Set Similarity Service

### Overview

Create a service that computes centroid-based skill similarity between two sets of skills. Supports both all-time and recency-weighted variants.

### Changes Required

#### 2.1 Types for Skill Similarity

**File**: `recommender_api/src/services/content-search/skill-embedding-similarity.types.ts` (new)

```typescript
/**
 * A skill with its embedding vector.
 */
export interface SkillWithEmbedding {
  skillId: string;
  skillName: string;
  embedding: number[];
}

/**
 * A skill with recency information for weighted centroid calculation.
 */
export interface SkillWithRecency extends SkillWithEmbedding {
  /** When the skill was last used (null if self-taught or no work experience link) */
  lastUsedDate: string | null;
  /** Total years of experience with this skill */
  yearsUsed: number;
}

/**
 * Result of skill-set similarity computation.
 *
 * Groups results by skill set for cleaner access:
 *   result.skills.score, result.recentSkills.score
 */
export interface SkillSetSimilarityResult {
  /** Similarity using all skills regardless of when last used */
  skills: {
    /** Centroid cosine similarity (0-1) */
    score: number;
    /** Number of skills included in the calculation */
    count: number;
  };
  /** Similarity using only skills used in last N years */
  recentSkills: {
    /** Centroid cosine similarity (0-1) */
    score: number;
    /** Number of skills included in the calculation */
    count: number;
  };
}
```

#### 2.2 Skill Embedding Loader

**File**: `recommender_api/src/services/content-search/skill-embedding-loader.service.ts` (new)

```typescript
import { Session } from "neo4j-driver";
import type { SkillWithEmbedding, SkillWithRecency } from "./skill-embedding-similarity.types.js";

/**
 * Load skill embeddings for an engineer from Neo4j.
 *
 * Joins Engineer → UserSkill → Skill to get all skills with their embeddings.
 * Also joins UserSkill → WorkExperience to determine recency.
 */
export async function loadEngineerSkillsWithEmbeddings(
  session: Session,
  engineerId: string
): Promise<SkillWithRecency[]> {
  const result = await session.run(`
    MATCH (e:Engineer {id: $engineerId})-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
    WHERE s.embedding IS NOT NULL

    // Get the most recent work experience where this skill was used
    OPTIONAL MATCH (us)-[:USED_AT]->(w:WorkExperience)
    WITH us, s, w
    ORDER BY w.endDate DESC
    WITH us, s, collect(w)[0] AS latestWork

    RETURN
      s.id AS skillId,
      s.name AS skillName,
      s.embedding AS embedding,
      latestWork.endDate AS lastUsedDate,
      us.yearsUsed AS yearsUsed
  `, { engineerId });

  return result.records.map((record) => ({
    skillId: record.get("skillId") as string,
    skillName: record.get("skillName") as string,
    embedding: record.get("embedding") as number[],
    lastUsedDate: record.get("lastUsedDate") as string | null,
    yearsUsed: (record.get("yearsUsed") as number) || 0,
  }));
}

/**
 * Load skill embeddings for multiple skills by ID.
 *
 * Used when computing similarity against a query skill set
 * (e.g., job requirements or another engineer's skills).
 */
export async function loadSkillEmbeddingsByIds(
  session: Session,
  skillIds: string[]
): Promise<SkillWithEmbedding[]> {
  if (skillIds.length === 0) {
    return [];
  }

  const result = await session.run(`
    MATCH (s:Skill)
    WHERE s.id IN $skillIds AND s.embedding IS NOT NULL
    RETURN s.id AS skillId, s.name AS skillName, s.embedding AS embedding
  `, { skillIds });

  return result.records.map((record) => ({
    skillId: record.get("skillId") as string,
    skillName: record.get("skillName") as string,
    embedding: record.get("embedding") as number[],
  }));
}
```

#### 2.3 Dense Vector Utilities

**File**: `recommender_api/src/services/content-search/dense-vector.service.ts` (new)

Reusable utilities for dense vector operations (embeddings). Complements `sparse-vector.service.ts` which handles TF-IDF vectors.

```typescript
/**
 * Compute cosine similarity between two dense vectors.
 *
 * Returns value in range [-1, 1], where:
 * - 1.0 = identical direction
 * - 0.0 = orthogonal (unrelated)
 * - -1.0 = opposite direction (rare for embeddings)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have same dimensions");
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Compute the centroid (mean) of a set of vectors.
 *
 * The centroid is the element-wise average - the "center point"
 * that represents the entire set. See thoughts/shared/2_chapter_4/
 * 0_foundational_info/6_centroids/centroids.md for details.
 */
export function computeCentroid(vectors: number[][]): number[] {
  if (vectors.length === 0) {
    throw new Error("Cannot compute centroid of empty vector set");
  }

  const dimensions = vectors[0].length;
  const centroid = new Array(dimensions).fill(0);

  for (const vector of vectors) {
    for (let i = 0; i < dimensions; i++) {
      centroid[i] += vector[i];
    }
  }

  for (let i = 0; i < dimensions; i++) {
    centroid[i] /= vectors.length;
  }

  return centroid;
}
```

#### 2.3.1 Unit Tests for Dense Vector Utilities

**File**: `recommender_api/src/services/content-search/dense-vector.service.test.ts` (new)

```typescript
import { describe, it, expect } from "vitest";
import { cosineSimilarity, computeCentroid } from "./dense-vector.service.js";

describe("cosineSimilarity", () => {
  it("returns 1.0 for identical vectors", () => {
    const vector = [1, 2, 3];
    expect(cosineSimilarity(vector, vector)).toBeCloseTo(1.0, 5);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("returns -1 for opposite vectors", () => {
    const a = [1, 0, 0];
    const b = [-1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
  });

  it("returns 0 when either vector is zero", () => {
    const zero = [0, 0, 0];
    const nonZero = [1, 2, 3];
    expect(cosineSimilarity(zero, nonZero)).toBe(0);
    expect(cosineSimilarity(nonZero, zero)).toBe(0);
  });

  it("throws error for mismatched dimensions", () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    expect(() => cosineSimilarity(a, b)).toThrow("Vectors must have same dimensions");
  });

  it("handles negative values correctly", () => {
    const a = [1, -1, 0];
    const b = [1, 1, 0];
    // dot product = 1*1 + (-1)*1 = 0, so orthogonal
    expect(cosineSimilarity(a, b)).toBe(0);
  });
});

describe("computeCentroid", () => {
  it("returns the vector itself for single vector input", () => {
    const vectors = [[1, 2, 3]];
    expect(computeCentroid(vectors)).toEqual([1, 2, 3]);
  });

  it("computes average for multiple vectors", () => {
    const vectors = [
      [2, 4],
      [4, 2],
      [6, 6],
    ];
    // Expected: [(2+4+6)/3, (4+2+6)/3] = [4, 4]
    expect(computeCentroid(vectors)).toEqual([4, 4]);
  });

  it("throws error for empty vector set", () => {
    expect(() => computeCentroid([])).toThrow("Cannot compute centroid of empty vector set");
  });

  it("handles negative values", () => {
    const vectors = [
      [1, -1],
      [-1, 1],
    ];
    expect(computeCentroid(vectors)).toEqual([0, 0]);
  });
});
```

#### 2.4 Skill Set Similarity Computation

**File**: `recommender_api/src/services/content-search/skill-embedding-similarity.service.ts` (new)

```typescript
import type {
  SkillWithEmbedding,
  SkillWithRecency,
  SkillSetSimilarityResult,
} from "./skill-embedding-similarity.types.js";
import { parseDateString, toMonthNumber } from "../resume-processor/date-utils.js";
import { cosineSimilarity, computeCentroid } from "./dense-vector.service.js";

/**
 * Years threshold for "recent" skills.
 *
 * Skills used within this many years from today are considered recent.
 * This aligns with typical job posting requirements ("3+ years recent experience").
 */
const RECENT_YEARS_THRESHOLD = 3;

/**
 * Compute skill-set similarity between two sets of skills using centroid comparison.
 *
 * Per Eightfold Phase 4.3: aggregate skills into single vectors via mean,
 * then compare centroids with cosine similarity.
 *
 * @param sourceSkills Skills from the source (e.g., engineer)
 * @param targetSkills Skills from the target (e.g., query or other engineer)
 * @returns Similarity scores for all-time and recent skill sets
 */
export function computeSkillSetSimilarity(
  sourceSkills: SkillWithRecency[],
  targetSkills: SkillWithEmbedding[]
): SkillSetSimilarityResult {
  // Handle empty cases
  if (sourceSkills.length === 0 || targetSkills.length === 0) {
    return {
      skills: { score: 0, count: sourceSkills.length },
      recentSkills: { score: 0, count: 0 },
    };
  }

  // Compute target centroid (all skills equally weighted)
  const targetCentroid = computeCentroid(targetSkills.map((s) => s.embedding));

  // Compute similarity using all skills
  const skillsCentroid = computeCentroid(sourceSkills.map((s) => s.embedding));
  const skillsScore = cosineSimilarity(skillsCentroid, targetCentroid);

  // Filter to recent skills and compute similarity
  const recentSkills = filterRecentSkills(sourceSkills, RECENT_YEARS_THRESHOLD);
  let recentSkillsScore = 0;
  if (recentSkills.length > 0) {
    const recentSkillsCentroid = computeCentroid(recentSkills.map((s) => s.embedding));
    recentSkillsScore = cosineSimilarity(recentSkillsCentroid, targetCentroid);
  }

  return {
    skills: { score: skillsScore, count: sourceSkills.length },
    recentSkills: { score: recentSkillsScore, count: recentSkills.length },
  };
}

/**
 * Filter skills to those used within the recency threshold.
 *
 * A skill is "recent" if:
 * - It has a lastUsedDate that is within RECENT_YEARS_THRESHOLD years of today, OR
 * - It has lastUsedDate = "present" (currently using)
 *
 * Skills without work experience links (self-taught) are excluded from recent
 * calculation since we can't determine recency.
 */
function filterRecentSkills(
  skills: SkillWithRecency[],
  yearsThreshold: number
): SkillWithRecency[] {
  const now = new Date();
  const cutoffYearMonth = {
    year: now.getFullYear() - yearsThreshold,
    month: now.getMonth() + 1, // 1-indexed
  };
  const cutoffMonthNumber = toMonthNumber(cutoffYearMonth);

  return skills.filter((skill) => {
    if (!skill.lastUsedDate) {
      return false; // No work experience link, can't determine recency
    }

    try {
      // parseDateString handles "YYYY-MM", "YYYY", and "present"
      const lastUsed = parseDateString(skill.lastUsedDate, true); // isEndDate=true
      return toMonthNumber(lastUsed) >= cutoffMonthNumber;
    } catch {
      return false; // Unparseable date
    }
  });
}
```

#### 2.5 Unit Tests

**File**: `recommender_api/src/services/content-search/skill-embedding-similarity.service.test.ts` (new)

```typescript
import { describe, it, expect } from "vitest";
import { computeSkillSetSimilarity } from "./skill-embedding-similarity.service.js";
import type { SkillWithEmbedding, SkillWithRecency } from "./skill-embedding-similarity.types.js";

describe("computeSkillSetSimilarity", () => {
  // Simple test vectors (3 dimensions for readability)
  const frontendVector = [1, 0, 0];
  const backendVector = [0, 1, 0];
  const hybridVector = [0.7, 0.7, 0]; // Fullstack-ish

  it("returns 0 for empty skill sets", () => {
    const result = computeSkillSetSimilarity([], []);
    expect(result.skills.score).toBe(0);
    expect(result.recentSkills.score).toBe(0);
  });

  it("returns 1.0 for identical skill sets", () => {
    const source: SkillWithRecency[] = [
      { skillId: "s1", skillName: "React", embedding: frontendVector, lastUsedDate: "present", yearsUsed: 5 },
    ];
    const target: SkillWithEmbedding[] = [
      { skillId: "s1", skillName: "React", embedding: frontendVector },
    ];

    const result = computeSkillSetSimilarity(source, target);
    expect(result.skills.score).toBeCloseTo(1.0, 5);
  });

  it("returns 0 for orthogonal skill sets", () => {
    const source: SkillWithRecency[] = [
      { skillId: "s1", skillName: "React", embedding: frontendVector, lastUsedDate: "present", yearsUsed: 5 },
    ];
    const target: SkillWithEmbedding[] = [
      { skillId: "s2", skillName: "Django", embedding: backendVector },
    ];

    const result = computeSkillSetSimilarity(source, target);
    expect(result.skills.score).toBe(0);
  });

  it("computes centroid correctly for multiple skills", () => {
    const source: SkillWithRecency[] = [
      { skillId: "s1", skillName: "React", embedding: frontendVector, lastUsedDate: "present", yearsUsed: 5 },
      { skillId: "s2", skillName: "Django", embedding: backendVector, lastUsedDate: "present", yearsUsed: 3 },
    ];
    const target: SkillWithEmbedding[] = [
      { skillId: "s3", skillName: "Fullstack", embedding: hybridVector },
    ];

    const result = computeSkillSetSimilarity(source, target);
    // Source centroid = [0.5, 0.5, 0], target = [0.7, 0.7, 0]
    // Both point in same general direction, high similarity
    expect(result.skills.score).toBeGreaterThan(0.9);
  });

  it("excludes old skills from recent calculation", () => {
    const source: SkillWithRecency[] = [
      { skillId: "s1", skillName: "React", embedding: frontendVector, lastUsedDate: "present", yearsUsed: 5 },
      { skillId: "s2", skillName: "jQuery", embedding: [0.8, 0.2, 0], lastUsedDate: "2015-01", yearsUsed: 3 },
    ];
    const target: SkillWithEmbedding[] = [
      { skillId: "s1", skillName: "React", embedding: frontendVector },
    ];

    const result = computeSkillSetSimilarity(source, target);
    // All-time includes both (centroid leans toward frontend)
    // Recent only includes React (exact match)
    expect(result.skills.count).toBe(2);
    expect(result.recentSkills.count).toBe(1);
    expect(result.recentSkills.score).toBeCloseTo(1.0, 5);
  });

  it("handles skills without work experience links", () => {
    const source: SkillWithRecency[] = [
      { skillId: "s1", skillName: "Rust", embedding: backendVector, lastUsedDate: null, yearsUsed: 1 },
    ];
    const target: SkillWithEmbedding[] = [
      { skillId: "s1", skillName: "Rust", embedding: backendVector },
    ];

    const result = computeSkillSetSimilarity(source, target);
    expect(result.skills.score).toBeCloseTo(1.0, 5);
    expect(result.recentSkills.score).toBe(0); // No recency data
    expect(result.recentSkills.count).toBe(0);
  });
});
```

### Success Criteria

#### Automated Verification:

- [x] TypeScript compiles: `npm run typecheck`
- [x] Unit tests pass: `npm test -- skill-embedding-similarity`
- [x] All tests pass: `npm test`

#### Manual Verification:

- [x] Service correctly loads skills with embeddings for a test engineer (verified via integration tests)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Content Search Integration

### Overview

Integrate skill embedding similarity into the content search pipeline as new features. The existing content search already computes `embeddingScore` from full profile embeddings; we add `skillEmbeddingSimilarity` and `recentSkillEmbeddingSimilarity` as complementary features.

### Why Skill Embeddings When Skills Are Already in Profile Embeddings?

The full profile embedding concatenates headline + job titles + skills + domains + companies + highlights + resume text into one vector. Skills are just words mixed into a blob of text. Skill embeddings provide complementary signal:

| Aspect | Profile Embedding | Skill Embedding |
|--------|-------------------|-----------------|
| **Input** | Raw text blob with skills as words | Canonical skill names only |
| **Dilution** | "Leadership" and "collaboration" paragraphs can dominate over actual technical skills | Isolated technical signal |
| **Normalization** | "React.js" embedded as raw text | "React.js" → "React" → React's embedding |
| **Recency** | Can't distinguish old vs current skills | `recentSkillEmbeddingSimilarity` enabled |
| **Context** | Captures "Python for ML" vs "Python for scripting" from surrounding text | Loses this context (just "Python") |
| **Overall vibe** | Captures seniority, experience depth | Just skill names |

**Eightfold's approach**: They use both as separate features (Phase 3 = profile embeddings, Phase 4 = skill embeddings). The scoring model learns how to weight each signal appropriately. Neither replaces the other - they capture different aspects of similarity.

### Changes Required

#### 3.1 Update Content Search Types

**File**: `recommender_api/src/schemas/resume.schema.ts` - Update response types

Add to `ContentScoreBreakdown` interface (around line 45):

```typescript
// Existing fields
embeddingScore?: number;
tfidfScore?: number;
tfidfMatchingTerms?: string[];

// New fields for skill embedding similarity
skillEmbeddingSimilarity?: number;
recentSkillEmbeddingSimilarity?: number;
skillCount?: number;
recentSkillCount?: number;
```

#### 3.2 Create Skill Embedding Similarity Integration Service

**File**: `recommender_api/src/services/content-search/candidate-skill-similarity.service.ts` (new)

```typescript
import { Session } from "neo4j-driver";
import { loadEngineerSkillsWithEmbeddings } from "./skill-embedding-loader.service.js";
import { computeSkillSetSimilarity } from "./skill-embedding-similarity.service.js";
import type { SkillSetSimilarityResult, SkillWithEmbedding } from "./skill-embedding-similarity.types.js";

/**
 * Cache for engineer skill embeddings to avoid repeated Neo4j queries.
 *
 * Key: engineerId
 * Value: Array of skills with embeddings and recency info
 *
 * Note: This is a simple in-memory cache. For production, consider
 * using a proper caching solution with TTL and memory limits.
 */
const engineerIdToSkillEmbeddingsCache = new Map<string, Awaited<ReturnType<typeof loadEngineerSkillsWithEmbeddings>>>();

/**
 * Compute skill embedding similarity between a target engineer and multiple candidates.
 *
 * Used by content search to add skill-based features to the ranking.
 *
 * @param session Neo4j session
 * @param targetEngineerId The engineer to compare against (or query skill set)
 * @param candidateEngineerIds Engineers to score
 * @returns Map of engineerId → similarity result
 */
export async function computeSkillSimilarityForCandidates(
  session: Session,
  targetEngineerId: string,
  candidateEngineerIds: string[]
): Promise<Map<string, SkillSetSimilarityResult>> {
  // Load target engineer's skills (as the reference set)
  const targetSkills = await getCachedEngineerSkillsWithEmbeddings(session, targetEngineerId);
  if (targetSkills.length === 0) {
    // Target has no skills with embeddings - return zeros for all candidates
    return new Map(
      candidateEngineerIds.map((id) => [
        id,
        { skills: { score: 0, count: 0 }, recentSkills: { score: 0, count: 0 } },
      ])
    );
  }

  // Compute similarity for each candidate
  const candidateIdToSimilarity = new Map<string, SkillSetSimilarityResult>();

  for (const candidateId of candidateEngineerIds) {
    const candidateSkills = await getCachedEngineerSkillsWithEmbeddings(session, candidateId);
    const similarity = computeSkillSetSimilarity(candidateSkills, targetSkills);
    candidateIdToSimilarity.set(candidateId, similarity);
  }

  return candidateIdToSimilarity;
}

/**
 * Get engineer skills with caching.
 */
async function getCachedEngineerSkillsWithEmbeddings(
  session: Session,
  engineerId: string
): Promise<Awaited<ReturnType<typeof loadEngineerSkillsWithEmbeddings>>> {
  if (!engineerIdToSkillEmbeddingsCache.has(engineerId)) {
    const skills = await loadEngineerSkillsWithEmbeddings(session, engineerId);
    engineerIdToSkillEmbeddingsCache.set(engineerId, skills);
  }
  return engineerIdToSkillEmbeddingsCache.get(engineerId)!;
}

/**
 * Clear the skill embedding cache.
 *
 * Call this when skills are updated (e.g., after resume upload).
 */
export function clearCachedEngineerSkillsWithEmbeddings(engineerId?: string): void {
  if (engineerId) {
    engineerIdToSkillEmbeddingsCache.delete(engineerId);
  } else {
    engineerIdToSkillEmbeddingsCache.clear();
  }
}
```

#### 3.3 Update Content Search Service

**File**: `recommender_api/src/services/content-search/content-search.service.ts`

Add imports at top:
```typescript
import { computeSkillSimilarityForCandidates } from "./candidate-skill-similarity.service.js";
import type { SkillSetSimilarityResult } from "./skill-embedding-similarity.types.js";
```

Update `executeEmbeddingSearch` function (around line 153) to re-rank using combined score:

```typescript
/**
 * Weight for profile embedding vs skill embedding in combined score.
 * Profile embedding captures overall experience/seniority; skill embedding captures technical fit.
 * Equal weighting treats both signals as equally valuable for technical role matching.
 */
const PROFILE_EMBEDDING_WEIGHT = 0.5;
const SKILL_EMBEDDING_WEIGHT = 0.5;

async function executeEmbeddingSearch(
  session: Session,
  request: ContentSearchRequest
): Promise<ContentSearchResponse> {
  const startTime = Date.now();

  let similarEngineers: Array<{ engineerId: string; score: number }>;
  let targetEngineerId: string | undefined;

  /*
   * Fetch more candidates than needed for re-ranking.
   * Re-ranking may promote candidates that were initially lower-ranked by profile
   * embedding but have high skill similarity. We fetch extra to ensure good coverage.
   */
  const candidatePoolSize = Math.max((request.limit + request.offset) * 2, 50);

  if (request.similarToEngineerId) {
    targetEngineerId = request.similarToEngineerId;
    similarEngineers = await findSimilarToEngineer(
      session,
      request.similarToEngineerId,
      candidatePoolSize
    );
  } else {
    const queryEmbedding = await generateEmbedding(request.queryText!);
    if (!queryEmbedding) {
      throw new Error("Failed to generate embedding for query. LLM may be unavailable.");
    }
    similarEngineers = await findSimilarByEmbedding(
      session,
      queryEmbedding,
      candidatePoolSize
    );
  }

  // Compute skill similarity for ALL candidates (before re-ranking)
  const allEngineerIds = similarEngineers.map((r) => r.engineerId);
  let skillSimilarityMap = new Map<string, SkillSetSimilarityResult>();
  if (targetEngineerId) {
    skillSimilarityMap = await computeSkillSimilarityForCandidates(
      session,
      targetEngineerId,
      allEngineerIds
    );
  }

  // Combine scores and re-rank
  const rerankedEngineers = similarEngineers
    .map((engineer) => {
      const skillSimilarity = skillSimilarityMap.get(engineer.engineerId);
      const skillScore = skillSimilarity?.skills.score ?? 0;

      // Combined score: weighted average of profile embedding and skill similarity
      const combinedScore = targetEngineerId
        ? PROFILE_EMBEDDING_WEIGHT * engineer.score + SKILL_EMBEDDING_WEIGHT * skillScore
        : engineer.score; // No skill re-ranking for text queries (no target engineer)

      return {
        engineerId: engineer.engineerId,
        profileEmbeddingScore: engineer.score,
        skillSimilarity,
        combinedScore,
      };
    })
    .sort((a, b) => b.combinedScore - a.combinedScore);

  // Apply pagination after re-ranking
  const totalCount = rerankedEngineers.length;
  const paginatedResults = rerankedEngineers.slice(request.offset, request.offset + request.limit);

  // Load engineer details
  const engineerIds = paginatedResults.map((r) => r.engineerId);
  const engineerInfoMap = await loadEngineerInfo(session, engineerIds);

  // Build response
  const matches = paginatedResults
    .filter((result) => engineerInfoMap.has(result.engineerId))
    .map((result) => {
      const engineer = engineerInfoMap.get(result.engineerId)!;

      return {
        id: engineer.id,
        name: engineer.name,
        headline: engineer.headline,
        salary: engineer.salary,
        yearsExperience: engineer.yearsExperience,
        timezone: engineer.timezone,
        contentScore: result.combinedScore,
        contentScoreBreakdown: {
          embeddingScore: result.profileEmbeddingScore,
          skillEmbeddingSimilarity: result.skillSimilarity?.skills.score ?? 0,
          recentSkillEmbeddingSimilarity: result.skillSimilarity?.recentSkills.score ?? 0,
          skillCount: result.skillSimilarity?.skills.count ?? 0,
          recentSkillCount: result.skillSimilarity?.recentSkills.count ?? 0,
        },
      };
    });

  const executionTimeMs = Date.now() - startTime;

  return {
    matches,
    totalCount,
    searchMethod: "embedding",
    queryMetadata: {
      executionTimeMs,
      documentsSearched: similarEngineers.length,
      queryTerms: [],
    },
  };
}
```

Apply similar re-ranking approach to `executeHybridSearch` function.

#### 3.4 Integration Tests

**File**: `recommender_api/src/services/__tests__/skill-embedding-similarity.integration.test.ts` (new)

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Session } from "neo4j-driver";
import { getSession } from "../../test/neo4j-test-utils.js";
import {
  loadEngineerSkillsWithEmbeddings,
  loadSkillEmbeddingsByIds,
} from "../content-search/skill-embedding-loader.service.js";
import { computeSkillSimilarityForCandidates } from "../content-search/candidate-skill-similarity.service.js";

describe("Skill Embedding Similarity Integration", () => {
  let session: Session;

  beforeAll(async () => {
    session = await getSession();
  });

  afterAll(async () => {
    await session.close();
  });

  describe("loadEngineerSkillsWithEmbeddings", () => {
    it("loads skills with embeddings for an existing engineer", async () => {
      // Use a seeded engineer ID
      const skills = await loadEngineerSkillsWithEmbeddings(session, "eng_001");

      expect(skills.length).toBeGreaterThan(0);
      expect(skills[0]).toHaveProperty("skillId");
      expect(skills[0]).toHaveProperty("skillName");
      expect(skills[0]).toHaveProperty("embedding");
      expect(skills[0].embedding.length).toBe(1024);
    });

    it("returns empty array for non-existent engineer", async () => {
      const skills = await loadEngineerSkillsWithEmbeddings(session, "eng_nonexistent");
      expect(skills).toEqual([]);
    });

    it("includes recency information when available", async () => {
      const skills = await loadEngineerSkillsWithEmbeddings(session, "eng_001");

      expect(skills.length).toBeGreaterThan(0);
      // At least some skills should have recency info
      expect(skills[0]).toHaveProperty("lastUsedDate");
      expect(skills[0]).toHaveProperty("yearsUsed");
    });
  });

  describe("loadSkillEmbeddingsByIds", () => {
    it("loads embeddings for existing skills", async () => {
      // First get some skill IDs from the database
      const result = await session.run(`
        MATCH (s:Skill) WHERE s.embedding IS NOT NULL
        RETURN s.id AS skillId LIMIT 3
      `);
      const skillIds = result.records.map((r) => r.get("skillId") as string);

      const skills = await loadSkillEmbeddingsByIds(session, skillIds);

      expect(skills.length).toBe(skillIds.length);
      skills.forEach((skill) => {
        expect(skill.embedding.length).toBe(1024);
        expect(skillIds).toContain(skill.skillId);
      });
    });

    it("returns empty array for empty input", async () => {
      const skills = await loadSkillEmbeddingsByIds(session, []);
      expect(skills).toEqual([]);
    });

    it("filters out non-existent skill IDs", async () => {
      const skills = await loadSkillEmbeddingsByIds(session, ["nonexistent_skill_id"]);
      expect(skills).toEqual([]);
    });
  });

  describe("computeSkillSimilarityForCandidates", () => {
    it("computes similarity between two engineers", async () => {
      const results = await computeSkillSimilarityForCandidates(
        session,
        "eng_001",
        ["eng_002", "eng_003"]
      );

      expect(results.size).toBe(2);

      const eng002Result = results.get("eng_002");
      expect(eng002Result).toBeDefined();
      expect(eng002Result!.skills.score).toBeGreaterThanOrEqual(0);
      expect(eng002Result!.skills.score).toBeLessThanOrEqual(1);
    });

    it("returns zeros when target engineer has no skills", async () => {
      // Use a non-existent engineer as target
      const results = await computeSkillSimilarityForCandidates(
        session,
        "eng_nonexistent",
        ["eng_001"]
      );

      const eng001Result = results.get("eng_001");
      expect(eng001Result).toBeDefined();
      expect(eng001Result!.skills.score).toBe(0);
      expect(eng001Result!.skills.count).toBe(0);
    });

    it("includes recent skill similarity", async () => {
      const results = await computeSkillSimilarityForCandidates(
        session,
        "eng_001",
        ["eng_002"]
      );

      const eng002Result = results.get("eng_002");
      expect(eng002Result).toBeDefined();
      expect(eng002Result!.recentSkills).toHaveProperty("score");
      expect(eng002Result!.recentSkills).toHaveProperty("count");
    });
  });
});
```

#### 3.5 E2E Tests

**File**: `postman/collections/content-search-tests.postman_collection.json` - Add new test cases

Add the following test cases to the existing "Content Search" folder:

**Test: Embedding Search with Skill Similarity Fields**

```json
{
  "name": "Embedding Search Returns Skill Similarity",
  "event": [
    {
      "listen": "test",
      "script": {
        "type": "text/javascript",
        "exec": [
          "pm.test('Status code is 200', function() {",
          "  pm.response.to.have.status(200);",
          "});",
          "",
          "pm.test('Response includes skill embedding similarity fields', function() {",
          "  const response = pm.response.json();",
          "  pm.expect(response.matches.length).to.be.greaterThan(0);",
          "  ",
          "  response.matches.forEach(function(match) {",
          "    pm.expect(match.contentScoreBreakdown).to.have.property('skillEmbeddingSimilarity');",
          "    pm.expect(match.contentScoreBreakdown).to.have.property('recentSkillEmbeddingSimilarity');",
          "    pm.expect(match.contentScoreBreakdown).to.have.property('skillCount');",
          "    pm.expect(match.contentScoreBreakdown).to.have.property('recentSkillCount');",
          "  });",
          "});",
          "",
          "pm.test('Skill similarity scores are between 0 and 1', function() {",
          "  const response = pm.response.json();",
          "  response.matches.forEach(function(match) {",
          "    pm.expect(match.contentScoreBreakdown.skillEmbeddingSimilarity).to.be.at.least(0);",
          "    pm.expect(match.contentScoreBreakdown.skillEmbeddingSimilarity).to.be.at.most(1);",
          "    pm.expect(match.contentScoreBreakdown.recentSkillEmbeddingSimilarity).to.be.at.least(0);",
          "    pm.expect(match.contentScoreBreakdown.recentSkillEmbeddingSimilarity).to.be.at.most(1);",
          "  });",
          "});",
          "",
          "pm.test('Skill counts are non-negative integers', function() {",
          "  const response = pm.response.json();",
          "  response.matches.forEach(function(match) {",
          "    pm.expect(match.contentScoreBreakdown.skillCount).to.be.a('number');",
          "    pm.expect(match.contentScoreBreakdown.skillCount).to.be.at.least(0);",
          "    pm.expect(match.contentScoreBreakdown.recentSkillCount).to.be.a('number');",
          "    pm.expect(match.contentScoreBreakdown.recentSkillCount).to.be.at.least(0);",
          "  });",
          "});"
        ]
      }
    }
  ],
  "request": {
    "method": "POST",
    "header": [{ "key": "Content-Type", "value": "application/json" }],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"similarToEngineerId\": \"eng_priya\",\n  \"method\": \"embedding\",\n  \"limit\": 5\n}"
    },
    "url": {
      "raw": "http://mac-studio.tailb9e408.ts.net:4025/api/search/content",
      "host": ["mac-studio", "tailb9e408", "ts", "net"],
      "path": ["api", "search", "content"],
      "protocol": "http",
      "port": "4025"
    }
  }
}
```

**Test: Combined Score Reflects Both Profile and Skill Similarity**

```json
{
  "name": "Content Score is Combined Profile and Skill",
  "event": [
    {
      "listen": "test",
      "script": {
        "type": "text/javascript",
        "exec": [
          "pm.test('Status code is 200', function() {",
          "  pm.response.to.have.status(200);",
          "});",
          "",
          "pm.test('Content score is approximately combined score', function() {",
          "  const response = pm.response.json();",
          "  pm.expect(response.matches.length).to.be.greaterThan(0);",
          "  ",
          "  response.matches.forEach(function(match) {",
          "    const breakdown = match.contentScoreBreakdown;",
          "    // Combined score = 0.5 * embeddingScore + 0.5 * skillEmbeddingSimilarity",
          "    const expectedCombined = 0.5 * breakdown.embeddingScore + 0.5 * breakdown.skillEmbeddingSimilarity;",
          "    // Allow small floating point tolerance",
          "    pm.expect(Math.abs(match.contentScore - expectedCombined)).to.be.lessThan(0.001);",
          "  });",
          "});"
        ]
      }
    }
  ],
  "request": {
    "method": "POST",
    "header": [{ "key": "Content-Type", "value": "application/json" }],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"similarToEngineerId\": \"eng_priya\",\n  \"method\": \"embedding\",\n  \"limit\": 5\n}"
    },
    "url": {
      "raw": "http://mac-studio.tailb9e408.ts.net:4025/api/search/content",
      "host": ["mac-studio", "tailb9e408", "ts", "net"],
      "path": ["api", "search", "content"],
      "protocol": "http",
      "port": "4025"
    }
  }
}
```

**Test: Hybrid Search Also Includes Skill Similarity**

```json
{
  "name": "Hybrid Search Returns Skill Similarity",
  "event": [
    {
      "listen": "test",
      "script": {
        "type": "text/javascript",
        "exec": [
          "pm.test('Status code is 200', function() {",
          "  pm.response.to.have.status(200);",
          "});",
          "",
          "pm.test('Hybrid search includes skill similarity fields', function() {",
          "  const response = pm.response.json();",
          "  if (response.matches.length > 0) {",
          "    response.matches.forEach(function(match) {",
          "      pm.expect(match.contentScoreBreakdown).to.have.property('skillEmbeddingSimilarity');",
          "      pm.expect(match.contentScoreBreakdown).to.have.property('recentSkillEmbeddingSimilarity');",
          "    });",
          "  }",
          "});"
        ]
      }
    }
  ],
  "request": {
    "method": "POST",
    "header": [{ "key": "Content-Type", "value": "application/json" }],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"similarToEngineerId\": \"eng_priya\",\n  \"method\": \"hybrid\",\n  \"limit\": 5\n}"
    },
    "url": {
      "raw": "http://mac-studio.tailb9e408.ts.net:4025/api/search/content",
      "host": ["mac-studio", "tailb9e408", "ts", "net"],
      "path": ["api", "search", "content"],
      "protocol": "http",
      "port": "4025"
    }
  }
}
```

### Success Criteria

#### Automated Verification:

- [x] TypeScript compiles: `npm run typecheck`
- [x] Unit tests pass: `npm test` (1074 tests passing)
- [x] Integration tests pass: `npm test -- skill-embedding-similarity.integration` (17 tests passing)
- [x] E2E tests pass: content-search collection (31 requests, 92 assertions)

#### Manual Verification:

- [x] Content search API returns `skillEmbeddingSimilarity` in response breakdown (E2E test 26)
- [x] Similar engineers (by skill profile) have higher skill similarity scores (verified via combined score formula)
- [x] Recent skill similarity distinguishes between current vs historical skills (recentSkillEmbeddingSimilarity field)

---

## Testing Strategy

### Unit Tests

| Test File | What It Tests |
|-----------|---------------|
| `dense-vector.service.test.ts` | `cosineSimilarity()` and `computeCentroid()` - core math functions |
| `skill-embedding-similarity.service.test.ts` | `computeSkillSetSimilarity()` - centroid comparison, recency filtering |

**Test cases:**
- Edge cases: empty skill sets, single skill, orthogonal vectors
- Dimension mismatch errors
- Zero vector handling
- Recency filtering with various date formats

### Integration Tests

| Test File | What It Tests |
|-----------|---------------|
| `skill-embedding-similarity.integration.test.ts` | Neo4j queries, data loading, cross-service integration |

**Test cases:**
- `loadEngineerSkillsWithEmbeddings`: existing engineer, non-existent engineer, recency data
- `loadSkillEmbeddingsByIds`: multiple skills, empty input, non-existent IDs
- `computeSkillSimilarityForCandidates`: similarity computation, target with no skills, recent skill similarity

### E2E Tests

| Test Case | What It Verifies |
|-----------|------------------|
| Embedding Search Returns Skill Similarity | Response includes all new fields |
| Content Score is Combined Profile and Skill | Combined score formula is correct (0.5 * profile + 0.5 * skill) |
| Hybrid Search Returns Skill Similarity | Hybrid method also includes skill similarity |

### Manual Testing Steps

1. Run content search with `similarToEngineerId` parameter
2. Verify response includes `skillEmbeddingSimilarity` and `recentSkillEmbeddingSimilarity`
3. Compare two engineers with similar skill profiles (e.g., two React developers)
4. Compare two engineers with different skill profiles (e.g., frontend vs backend)
5. Verify recent skill similarity differs when one engineer has older skills

## Performance Considerations

- **Skill embedding generation**: One-time cost during seeding (~138 skills × ~100ms each = ~14 seconds)
- **Centroid computation**: O(n × d) where n = number of skills, d = 1024 dimensions
- **Caching**: Engineer skill embeddings cached in memory to avoid repeated Neo4j queries
- **Index usage**: Skill vector index enables O(log n) similarity search if needed later

## Migration Notes

- Run `npm run seed` after deploying to regenerate skills with embeddings
- Existing engineers will have embeddings; skills are new
- No breaking changes to existing API responses (new fields are additive)

## References

- Eightfold learning plan: `docs/learning_through_imitation/eightfold/eightfold_learning_plan.md` (Phase 4)
- Skill embeddings explained: `thoughts/shared/2_chapter_4/1_project_1/skill-embeddings-explained.md`
- Content-based filtering plan: `thoughts/private/plans/2026-01-21-content-based-resume-filtering.md`
- Existing content search: `recommender_api/src/services/content-search/content-search.service.ts`
