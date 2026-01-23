---
date: 2026-01-21T12:00:00-05:00
researcher: Claude
git_commit: c6cc05a238ad350672a0dd23cf05f896c10d68e8
branch: project_6
repository: recommender_system
topic: "Content-Based Resume Filtering: Feature Extraction and Text Similarity"
tags: [research, codebase, content-based, resume-processing, tf-idf, embeddings, feature-extraction]
status: complete
last_updated: 2026-01-21
last_updated_by: Claude
---

# Research: Content-Based Resume Filtering

**Date**: 2026-01-21T12:00:00-05:00
**Researcher**: Claude
**Git Commit**: c6cc05a238ad350672a0dd23cf05f896c10d68e8
**Branch**: project_6
**Repository**: recommender_system

## Research Question

How can we add content-based filtering capabilities to the recommender_api, supporting resume upload with feature extraction and text similarity (TF-IDF, dense embeddings) for learning purposes?

## Summary

The existing recommender_api is a **constraint-based knowledge system** (Chapter 5.2) with graph-aware similarity scoring. Adding content-based filtering requires:

1. **Resume Upload Endpoint** - Accept resume text/file, process through LLM feature extraction
2. **Text Similarity Pipeline** - Support multiple approaches (TF-IDF, dense embeddings) for educational comparison
3. **Content-Based Search Endpoint** - Filter/rank engineers by text similarity to a query or uploaded resume

The infrastructure is well-suited for this extension:
- **Ollama integration exists** - Ready for LLM-based feature extraction
- **Modular service architecture** - Clean patterns for adding new endpoints
- **Neo4j with typed nodes** - Can store extracted features and vectors
- **Zod schemas** - Single source of truth for validation

## Detailed Findings

### 1. Theoretical Foundation (from thoughts/shared)

#### Feature Extraction Approaches

From `thoughts/shared/2_chapter_4/0_foundational_info/1_feature_extraction/resume_processing.md`:

| Approach | Pros | Cons |
|----------|------|------|
| **Traditional NLP (spaCy, BERT-NER)** | Fast, deterministic, no API cost | Requires training data, brittle to format changes |
| **LLM Extraction** | No training needed, handles format variation, reasons about context | Non-deterministic, API cost, hallucination risk |

**Recommended for learning project**: LLM extraction via existing Ollama integration (qwen2.5:14b-instruct)

#### Text Similarity Approaches

From `thoughts/shared/2_chapter_4/0_foundational_info/3_text_similarity.md/resume_text_similarity.md`:

| Approach | Pros | Cons |
|----------|------|------|
| **TF-IDF (Sparse Vectors)** | Interpretable, cheap, exact keyword matching | No semantic understanding, vocabulary mismatch |
| **Dense Embeddings** | Semantic similarity, handles paraphrasing | Black box, requires embedding model |
| **Hybrid (Boolean + TF-IDF + Embeddings)** | Best of all worlds | More complex implementation |

**Recommended phases**:
1. Phase 1: TF-IDF baseline
2. Phase 2: Dense embeddings via local model
3. Phase 3: Hybrid approach

### 2. Existing Architecture Patterns

#### Route/Controller/Service Pattern

```
src/routes/<feature>.routes.ts     → Route definitions + Zod validation
src/controllers/<feature>.controller.ts → HTTP handling, Neo4j session management
src/services/<feature>.service.ts  → Business logic orchestration
src/schemas/<feature>.schema.ts    → Zod schemas (single source of truth)
src/types/<feature>.types.ts       → TypeScript types (inferred from Zod)
```

#### LLM Integration Pattern

**File**: `recommender_api/src/services/llm.service.ts`

```typescript
import { Ollama } from "ollama";
import config from "../config.js";

// Singleton client with health check caching
export async function generateCompletion(
  prompt: string,
  options: { systemPrompt?: string; maxTokens?: number } = {}
): Promise<string | null>;
```

- **Model**: qwen2.5:14b-instruct (configurable via LLM_MODEL env)
- **Host**: localhost:11434 (configurable via LLM_HOST)
- **Timeout**: 5000ms (configurable via LLM_TIMEOUT_MS)
- **Graceful degradation**: Returns null if unavailable

#### Neo4j Data Model (Relevant Nodes)

- **Engineer** - id, name, email, headline, salary, yearsExperience, startTimeline, timezone
- **Skill** - id, name, skillType, isCategory, description
- **UserSkill** - id, proficiencyLevel, yearsUsed, confidenceScore (pivot between Engineer and Skill)
- **BusinessDomain** / **TechnicalDomain** - Domain experience with hierarchies

**No existing vector indices** - Similarity is calculated via graph traversal (skill correlations, domain hierarchies)

### 3. Proposed Architecture for Content-Based Extension

#### New Files to Create

```
src/
├── routes/
│   └── resume.routes.ts              # Resume upload + content-based search
├── controllers/
│   └── resume.controller.ts
├── services/
│   ├── resume-processor/
│   │   ├── index.ts                  # Main orchestration
│   │   ├── feature-extractor.ts      # LLM-based extraction
│   │   ├── text-vectorizer.ts        # TF-IDF / embedding generation
│   │   └── validation.ts             # Skill normalization
│   └── content-search/
│       ├── index.ts                  # Content-based search orchestration
│       ├── tfidf-index.ts            # TF-IDF inverted index + scoring
│       └── embedding-index.ts        # Dense embedding similarity
├── schemas/
│   └── resume.schema.ts              # Upload + search request schemas
└── types/
    └── resume.types.ts               # Feature extraction types
```

#### New Neo4j Nodes (Optional)

```cypher
// For storing extracted resume text and vectors
(:ResumeSnapshot {
  id: string,
  engineerId: string,
  rawText: string,
  processedAt: datetime,
  extractionModel: string
})

// For TF-IDF vectors (sparse, stored as JSON)
(:TfIdfVector {
  id: string,
  engineerId: string,
  terms: string[],       // Vocabulary
  weights: float[],      // TF-IDF weights
  createdAt: datetime
})

// For dense embeddings (if using Neo4j vector index)
(:ResumeEmbedding {
  id: string,
  engineerId: string,
  embedding: float[],    // 768-1536 dimensions
  model: string,
  createdAt: datetime
})
```

### 4. Proposed Endpoints

#### POST /api/resume/upload

Upload a resume for feature extraction and similarity indexing.

```typescript
// Request
{
  resumeText: string;           // Plain text resume content
  engineerName: string;         // For new engineer creation
  extractFeatures?: boolean;    // Run LLM feature extraction (default: true)
  generateVectors?: boolean;    // Generate TF-IDF/embedding vectors (default: true)
  vectorTypes?: ('tfidf' | 'embedding')[];  // Which vector types to generate
}

// Response
{
  engineerId: string;
  extractedFeatures?: {
    skills: Array<{ name: string; yearsUsed: number | null; confidence: string }>;
    totalYearsExperience: number;
    domains: string[];
    leadershipSignals: { hasManaged: boolean; teamSize: number | null };
  };
  validationResults?: {
    normalizedSkills: Array<{ extracted: string; canonicalId: string | null }>;
    unknownSkills: string[];
    needsReview: string[];
  };
  vectors?: {
    tfidf?: { termCount: number; nonZeroTerms: number };
    embedding?: { dimensions: number; model: string };
  };
}
```

#### POST /api/search/content

Search engineers by content similarity (TF-IDF or embeddings).

```typescript
// Request
{
  queryText: string;            // Free-text query OR job description
  similarTo?: string;           // Engineer ID to find similar candidates
  method: 'tfidf' | 'embedding' | 'hybrid';

  // Optional constraints (same as existing filter endpoint)
  maxBudget?: number;
  requiredTimezone?: string[];

  // Pagination
  limit?: number;
  offset?: number;
}

// Response (similar to existing SearchFilterResponse)
{
  matches: Array<{
    id: string;
    name: string;
    headline: string;
    // ... standard engineer fields

    // Content-based scoring
    contentScore: number;       // 0-1 similarity score
    contentScoreBreakdown?: {
      tfidfScore?: number;
      embeddingScore?: number;
      matchingTerms?: string[];  // For TF-IDF interpretability
    };
  }>;
  totalCount: number;
  searchMethod: 'tfidf' | 'embedding' | 'hybrid';
  queryMetadata: {
    executionTimeMs: number;
    vectorsSearched: number;
  };
}
```

### 5. Implementation Phases

#### Phase 1: TF-IDF Baseline

1. **Resume text processing**
   - Tokenization, stopword removal, stemming
   - Build vocabulary from all engineer resumes/headlines

2. **TF-IDF vector generation**
   - Compute term frequencies per document
   - Compute inverse document frequencies globally
   - Store sparse vectors (in-memory or Neo4j)

3. **Similarity search**
   - Convert query to TF-IDF vector
   - Compute cosine similarity against all engineers
   - Return top-K matches

**Learning value**: Understand sparse vector representations, inverted indices, term weighting

#### Phase 2: Dense Embeddings

1. **Embedding generation**
   - Use local model via Ollama (e.g., nomic-embed-text, mxbai-embed-large)
   - Or use sentence-transformers if running Python subprocess

2. **Vector storage**
   - Option A: Neo4j vector index (built-in since v5.11)
   - Option B: In-memory for small datasets
   - Option C: Separate vector store (Pinecone, Milvus)

3. **Similarity search**
   - Approximate nearest neighbor (ANN) search
   - Re-ranking with additional features

**Learning value**: Understand dense representations, semantic similarity, ANN algorithms

#### Phase 3: Hybrid Approach

1. **Boolean filtering** (inverted index)
   - Must-have keyword filtering before scoring

2. **TF-IDF scoring** on filtered set
   - Interpretable relevance ranking

3. **Embedding re-ranking** on top-K
   - Semantic similarity for final ordering

4. **Score fusion**
   - Combine TF-IDF and embedding scores (weighted average, RRF)

**Learning value**: Understand multi-stage retrieval, score fusion, precision/recall tradeoffs

### 6. LLM Feature Extraction Prompt

Based on the theoretical document, here's a proposed extraction prompt:

```typescript
const featureExtractionPrompt = `
Extract structured information from this resume.

Resume:
${resumeText}

Return JSON matching this schema:
{
  "skills": [
    {
      "name": string,           // Exact skill name as written
      "yearsUsed": number | null,
      "confidence": "explicit" | "inferred" | "uncertain",
      "evidence": string        // Quote from resume supporting this
    }
  ],
  "totalYearsExperience": number,
  "seniorityProgression": string[],  // e.g., ["Junior", "Mid", "Senior"]
  "leadershipExperience": {
    "hasManaged": boolean,
    "largestTeamSize": number | null,
    "hasMentored": boolean
  },
  "domains": string[],               // Business domains: Fintech, Healthcare, etc.
  "companyTypes": string[],          // FAANG, startup, enterprise, etc.
  "notableAccomplishments": string[] // Brief phrases
}

Rules:
- Only include skills explicitly mentioned or strongly implied
- For confidence "explicit": skill is directly stated
- For confidence "inferred": skill deduced from context
- For confidence "uncertain": educated guess
- Provide exact quote evidence for each skill
`;
```

### 7. Skill Normalization

The codebase already has skill resolution infrastructure:

**File**: `recommender_api/src/services/skill-resolution.service.ts`

```typescript
// Resolves skill names to canonical IDs
export function resolveSkillId(skillName: string): Promise<string | null>;

// Expands skill to include descendants
export function expandSkillHierarchy(skillId: string): Promise<string[]>;
```

For content-based extraction, add a normalization layer:

```typescript
// New: Fuzzy matching for extracted skills
export function normalizeExtractedSkill(
  extractedName: string,
  allSkills: Skill[]
): { canonicalId: string | null; confidence: number };
```

### 8. Vector Storage Options

| Option | Pros | Cons | Recommended For |
|--------|------|------|-----------------|
| **In-memory** | Fast, simple | Volatile, memory-limited | Learning, small datasets |
| **Neo4j properties** | Integrated, persistent | No native vector ops | TF-IDF sparse vectors |
| **Neo4j vector index** | Native ANN search | Requires Neo4j 5.11+ | Dense embeddings (production) |
| **Separate store** | Optimized for vectors | Added complexity | Large-scale production |

**Recommendation for learning**: Start with in-memory, migrate to Neo4j vector index when understanding deepens.

## Code References

- `recommender_api/src/services/llm.service.ts` - Existing Ollama integration
- `recommender_api/src/services/search.service.ts` - Main search orchestration pattern
- `recommender_api/src/services/skill-resolution.service.ts` - Skill normalization infrastructure
- `recommender_api/src/services/cypher-query-builder/search-query.builder.ts` - Query building patterns
- `recommender_api/src/schemas/search.schema.ts` - Zod schema patterns
- `recommender_api/src/config.ts` - Configuration pattern (LLM settings)

## Architecture Insights

1. **Service modularity** - Each feature has dedicated service directory with clear boundaries
2. **Single source of truth** - Zod schemas generate types, no duplication
3. **Graceful degradation** - LLM service returns null when unavailable, system continues
4. **Knowledge base separation** - Config files hold domain rules, services implement logic
5. **RAG pattern established** - LLM calls use structured context from database queries

## Historical Context (from thoughts/)

- `thoughts/shared/2_chapter_4/0_foundational_info/1_feature_extraction/feature_extraction.md` - Two approaches: bag-of-keywords vs structured representation
- `thoughts/shared/2_chapter_4/0_foundational_info/1_feature_extraction/resume_processing.md` - LLM vs NLP extraction tradeoffs, validation layer design
- `thoughts/shared/2_chapter_4/0_foundational_info/3_text_similarity.md/resume_text_similarity.md` - TF-IDF vs embeddings, hybrid approach design

## Open Questions

1. **Vector storage strategy**: In-memory vs Neo4j vector index vs separate store?
2. **Embedding model choice**: Which Ollama-compatible embedding model? (nomic-embed-text, mxbai-embed-large)
3. **Skill taxonomy integration**: Create new engineers from resumes, or only compare to existing?
4. **Phase prioritization**: Start with TF-IDF for interpretability, or embeddings for accuracy?
5. **Comparison metrics**: How to evaluate TF-IDF vs embedding effectiveness for learning?
