# Project 1: Content-Based Resume Filtering

**Status**: Complete
**Duration**: January 21-23, 2026
**Branch**: `chapter-4-project-1`

---

## Executive Summary

Project 1 implements Chapter 4's content-based filtering approach, enabling resume-based engineer discovery. The system processes resumes (both uploaded PDFs and generated text for seeded engineers), extracts structured features, and uses a hybrid TF-IDF + embedding approach for semantic matching.

Key capabilities delivered:

1. **Resume Upload & Extraction**: PDF/DOCX upload with text extraction, OCR fallback for scanned documents
2. **Resume Text Generation**: Realistic resume text for 38 seeded engineers with work experiences and skill associations
3. **TF-IDF Vectorization**: Sparse vector search with smoothed IDF, company/domain normalization
4. **Skill Embedding Similarity**: Dense vector (1024-dim) skill matching using mxbai-embed-large embeddings and centroid comparison
5. **Skill Years Calculation**: Deterministic years-of-experience calculation with interval merging to avoid double-counting overlapping jobs

---

## Problem Statement

### Problem 1: No Content-Based Discovery

Previous projects focused on structured attribute filtering (skills, seniority, timezone). But hiring managers also want to:
- Search by free-text job descriptions
- Find engineers with similar background/experience
- Discover candidates based on resume content, not just declared skills

### Problem 2: Skill Matching Limited to Exact Matches

Searching for "React developer" only found engineers with explicit "React" skill. But engineers might describe themselves as "frontend engineer with experience building SPAs" without listing React explicitly.

### Problem 3: No Work Experience Context

Skills existed as flat attributes without context. We couldn't answer:
- How many years has this engineer used Python?
- Is this a recent skill or something from 5 years ago?
- Where did they use this skill (company, role)?

---

## Solution Overview

### Solution 1: Hybrid Text Similarity (TF-IDF + Embeddings)

Two complementary approaches for content matching:

| Approach | Vector Type | Dimension | Strength |
|----------|-------------|-----------|----------|
| TF-IDF | Sparse | ~5000 terms | Keyword precision, rare term matching |
| Embeddings | Dense | 1024 | Semantic similarity, synonym handling |

**TF-IDF** catches exact terminology (e.g., "NestJS", "GraphQL federation").
**Embeddings** catch semantic similarity (e.g., "building REST APIs" ≈ "API development").

### Solution 2: Skill Embedding Similarity with Centroids

Instead of comparing individual skills, we compare skill *sets*:

1. Load pre-computed embeddings for all 97 skills (1024-dim vectors)
2. Compute **centroid** of required skill embeddings (average vector)
3. Compute **centroid** of engineer's skill embeddings
4. Calculate cosine similarity between centroids

Recent skills (used within 3 years) receive 1.5x weight in the centroid calculation.

### Solution 3: Work Experience Graph with Skill Years

New graph structure captures work history:

```
Engineer → HAS_RESUME → Resume
Engineer → HAD_ROLE → WorkExperience → AT_COMPANY → Company
UserSkill → USED_AT → WorkExperience
```

Skill years calculation:
1. Collect all date intervals where skill was used
2. Merge overlapping intervals (avoid double-counting concurrent jobs)
3. Sum total months, convert to years

---

## Data Model

### Resume Node

```typescript
{
  id: string;           // resume_eng_xyz
  rawText: string;      // Full resume text (extracted or generated)
  uploadedAt: string;   // ISO timestamp
}
```

### WorkExperience Node

```typescript
{
  id: string;           // workexp_eng_xyz_1
  title: string;        // "Senior Software Engineer"
  startDate: string;    // "2019-03" or "2019"
  endDate: string;      // "2023-06" or "present"
}
```

### Company Node

```typescript
{
  id: string;           // company_stripe
  name: string;         // "Stripe"
  normalizedName: string; // "stripe" (lowercase, suffix-stripped)
}
```

### UserSkill Node (extended)

```typescript
{
  id: string;
  // ... existing fields ...
  yearsOfExperience: number;  // Calculated from work history
}
```

### Skill Node (extended)

```typescript
{
  id: string;
  name: string;
  // ... existing fields ...
  embedding: number[];  // 1024-dim vector
}
```

---

## Implementation Architecture

### File Structure

```
recommender_api/src/
├── routes/
│   ├── content-search.routes.ts           # Content search endpoint
│   └── resume.routes.ts                   # Resume upload endpoint
├── controllers/
│   ├── content-search.controller.ts       # Search handler
│   └── resume.controller.ts               # Upload handler
├── middleware/
│   └── file-upload.middleware.ts          # Multer configuration
├── schemas/
│   └── resume.schema.ts                   # Zod validation
├── services/
│   ├── content-search/
│   │   ├── content-search.service.ts      # Main orchestrator
│   │   ├── tfidf-vectorizer.service.ts    # TF-IDF computation
│   │   ├── tfidf-index-manager.service.ts # Index building/caching
│   │   ├── sparse-vector.service.ts       # Sparse vector ops
│   │   ├── dense-vector.service.ts        # Dense vector ops
│   │   ├── text-normalizer.service.ts     # Text preprocessing
│   │   ├── inverted-index.service.ts      # Inverted index structure
│   │   ├── embedding-index-manager.service.ts  # Embedding index
│   │   ├── skill-embedding-loader.service.ts   # Load from Neo4j
│   │   ├── skill-embedding-similarity.service.ts  # Centroid comparison
│   │   ├── candidate-skill-similarity.service.ts  # Per-candidate scoring
│   │   └── engineer-text-loader.service.ts  # Load resume text
│   ├── file-extractor/
│   │   ├── file-extractor.service.ts      # Format dispatcher
│   │   ├── pdf-extractor.service.ts       # pdf-parse
│   │   ├── docx-extractor.service.ts      # mammoth
│   │   └── ocr-extractor.service.ts       # Tesseract fallback
│   ├── resume-processor/
│   │   ├── resume-upload.service.ts       # Upload orchestrator
│   │   ├── feature-extractor.service.ts   # LLM extraction
│   │   ├── skill-years.service.ts         # Years calculation
│   │   ├── date-utils.ts                  # Date parsing
│   │   └── date-interval-merger.ts        # Interval merging
│   ├── company-normalizer.service.ts      # "Stripe, Inc." → "stripe"
│   ├── domain-normalizer.service.ts       # Domain entity normalization
│   ├── skill-normalizer.service.ts        # Skill name normalization
│   └── llm.service.ts                     # LLM integration
└── config/
    └── text-normalization/
        └── company-suffixes.config.ts     # "Inc.", "LLC", etc.

seeds/
├── resumes.ts                             # Resume text generation
├── embeddings.ts                          # Engineer embeddings
├── skill-embeddings.ts                    # Skill embeddings (97 skills)
├── skill-synonyms.ts                      # Skill synonym mappings
├── companies.ts                           # Company seed data
└── migrations/
    ├── 001-add-vector-indices.ts          # HNSW index for resumes
    └── 002-add-skill-vector-index.ts      # HNSW index for skills
```

### Data Flow: Resume Upload

```
POST /api/resume/upload (multipart/form-data)
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      file-upload.middleware.ts                       │
│  • Multer validates file type (pdf, docx)                           │
│  • Stores in memory buffer                                          │
└─────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      file-extractor.service.ts                       │
│  1. Detect MIME type                                                │
│  2. Dispatch to appropriate extractor:                              │
│     • PDF → pdf-extractor.service.ts                                │
│     • DOCX → docx-extractor.service.ts                              │
│  3. If extraction fails → ocr-extractor.service.ts (Tesseract)      │
│  4. Return extracted text                                           │
└─────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    resume-upload.service.ts                          │
│  1. Create/update Resume node with rawText                          │
│  2. Call LLM to extract structured features:                        │
│     • Work experiences (title, company, dates)                      │
│     • Skills per work experience                                    │
│  3. Create WorkExperience nodes                                     │
│  4. Create/merge Company nodes (normalized)                         │
│  5. Create UserSkill → USED_AT → WorkExperience relationships       │
│  6. Calculate yearsOfExperience for each UserSkill                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow: Skill Years Calculation

```
UserSkill (e.g., "Python" for eng_priya)
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     skill-years.service.ts                           │
│                                                                      │
│  1. Query all WorkExperience where skill was used:                  │
│     MATCH (us:UserSkill)-[:USED_AT]->(we:WorkExperience)            │
│     WHERE us.skillId = $skillId AND us.engineerId = $engineerId     │
│                                                                      │
│  2. Parse date strings to DateInterval objects:                     │
│     • "2019-03" → { year: 2019, month: 3 }                         │
│     • "2019" → { year: 2019, month: 1 }                            │
│     • "present" → current date                                      │
│                                                                      │
│  3. Merge overlapping intervals:                                    │
│     [2019-03, 2021-06] + [2020-01, 2023-12]                        │
│     → [2019-03, 2023-12] (merged)                                   │
│                                                                      │
│  4. Sum total months across all intervals                           │
│  5. Convert to years (months / 12)                                  │
└─────────────────────────────────────────────────────────────────────┘
       │
       ▼
yearsOfExperience: 4.75
```

### Data Flow: Skill Embedding Similarity

```
Search Request: { requiredSkills: ["React", "TypeScript", "Node.js"] }
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│               skill-embedding-similarity.service.ts                  │
│                                                                      │
│  1. Load embeddings for required skills from index                  │
│     React     → [0.12, -0.34, 0.56, ...] (1024 dims)               │
│     TypeScript → [0.08, -0.28, 0.61, ...]                          │
│     Node.js   → [0.15, -0.31, 0.52, ...]                           │
│                                                                      │
│  2. Compute requirement centroid (average):                         │
│     centroid = mean([React, TypeScript, Node.js])                   │
│                                                                      │
│  3. For each candidate engineer:                                    │
│     a. Load their skill embeddings                                  │
│     b. Apply recency weighting (1.5x for skills used < 3 years)    │
│     c. Compute weighted centroid                                    │
│     d. Calculate cosine similarity to requirement centroid          │
│                                                                      │
│  4. Return similarity scores for re-ranking                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### 1. Hybrid TF-IDF + Embeddings

**Decision**: Use both sparse (TF-IDF) and dense (embedding) vectors instead of embeddings alone.

**Rationale**:
- TF-IDF excels at rare/specific terms ("NestJS", "GraphQL federation")
- Embeddings excel at semantic similarity ("REST API" ≈ "web services")
- Hybrid combines precision and recall
- Matches industry practice (e.g., Eightfold's approach)

### 2. Centroid-Based Skill Comparison

**Decision**: Compare skill *set* centroids rather than individual skill similarities.

**Rationale**:
- More efficient: 1 comparison instead of O(n×m) pairwise
- Captures overall skill profile alignment
- Naturally handles different skill set sizes
- Recency weighting integrates cleanly

### 3. Interval Merging for Skill Years

**Decision**: Merge overlapping work experience intervals before calculating total years.

**Rationale**:
- Concurrent jobs shouldn't double-count skill time
- Example: Engineer at Stripe (2019-2022) and consulting (2020-2021) using Python
- Without merging: 3 + 1 = 4 years
- With merging: 2019-2022 = 3 years (correct)

### 4. Recency Weighting (3-Year Threshold)

**Decision**: Skills used within 3 years get 1.5x weight in centroid calculation.

**Rationale**:
- Recent skills are more relevant than decade-old experience
- 3-year threshold balances recency vs reasonable skill retention
- 1.5x multiplier is significant but not overwhelming

### 5. Company Name Normalization

**Decision**: Normalize company names by stripping suffixes and lowercasing.

**Rationale**:
- "Stripe, Inc." and "Stripe" should be the same company
- Enables company-based filtering and deduplication
- Configurable suffix list (Inc., LLC, Corp., etc.)

### 6. OCR Fallback for Scanned PDFs

**Decision**: Use Tesseract OCR when native PDF text extraction fails.

**Rationale**:
- Some resumes are scanned images
- Better to extract imperfect text than fail entirely
- OCR results marked with lower confidence

---

## Eightfold System Comparison

Our implementation follows the Eightfold "four phases" approach:

| Phase | Eightfold Description | Our Implementation |
|-------|----------------------|-------------------|
| Phase 1 | High recall candidate retrieval (TF-IDF/BM25) | `tfidf-vectorizer.service.ts` with inverted index |
| Phase 2 | Dense embedding similarity | `dense-vector.service.ts` with mxbai-embed-large |
| Phase 3 | Skill matching and scoring | `skill-embedding-similarity.service.ts` with centroids |
| Phase 4 | Re-ranking and explanation | Content search integration with existing search pipeline |

---

## Testing

### Unit Tests (1074 total)

| Module | Tests | Coverage |
|--------|-------|----------|
| tfidf-vectorizer.service.test.ts | 15 | IDF calculation, vectorization, edge cases |
| sparse-vector.service.test.ts | 12 | Cosine similarity, normalization |
| dense-vector.service.test.ts | 10 | Vector operations, centroid computation |
| text-normalizer.service.test.ts | 18 | Tokenization, stopwords, stemming |
| company-normalizer.service.test.ts | 8 | Suffix stripping, case handling |
| skill-normalizer.service.test.ts | 6 | Skill name normalization |
| date-utils.test.ts | 14 | Date parsing, edge cases |
| date-interval-merger.test.ts | 12 | Overlap detection, merging |
| skill-embedding-similarity.service.test.ts | 16 | Centroid computation, recency weighting |
| embedding-index-manager.service.test.ts | 8 | Index building, caching |
| tfidf-index-manager.service.test.ts | 10 | IDF computation, document indexing |

### Integration Tests

| Test File | Scenarios | Key Verification |
|-----------|-----------|------------------|
| content-search.integration.test.ts | 12 | End-to-end search with TF-IDF + embeddings |
| resume-upload.integration.test.ts | 8 | Upload → extraction → graph creation |
| seed-companies.integration.test.ts | 5 | Company normalization and deduplication |
| seed-synonyms.integration.test.ts | 4 | Skill synonym handling |
| skill-embedding-similarity.integration.test.ts | 10 | Similarity scoring accuracy |
| skill-years.integration.test.ts | 8 | Years calculation with interval merging |

### E2E Tests

| Collection | Requests | Assertions |
|------------|----------|------------|
| content-search-tests.postman_collection.json | 18 | 52 |
| resume-file-upload-tests.postman_collection.json | 13 | 39 |

**All tests pass.**

---

## Seeded Data

### Engineers with Resumes

| Count | Description |
|-------|-------------|
| 40 | Resumes (2 engineers have multiple career versions) |
| 38 | Unique engineers with resume data |
| 112 | Work experience records |
| 464 | Skill-to-work-experience links (USED_AT relationships) |

### Skills with Embeddings

| Count | Description |
|-------|-------------|
| 97 | Skills with 1024-dim embeddings |
| 100% | Coverage of all skills in the system |

### Companies

| Count | Description |
|-------|-------------|
| 45 | Unique companies (normalized) |

---

## Configuration Reference

### Text Normalization

| Setting | Value | Description |
|---------|-------|-------------|
| Min word length | 2 | Words shorter than 2 chars ignored |
| Stopwords | English + tech common | "the", "and", "for", "with", etc. |
| Stemming | Porter stemmer | "programming" → "program" |

### Embedding Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| Model | mxbai-embed-large | Via Ollama |
| Dimensions | 1024 | Vector size |
| Index type | HNSW | Hierarchical Navigable Small World |
| Similarity metric | Cosine | For centroid comparison |

### Recency Weighting

| Setting | Value | Description |
|---------|-------|-------------|
| Recent threshold | 3 years | Skills used within this window |
| Recent weight | 1.5 | Multiplier for recent skills |
| Default weight | 1.0 | For older skills |

---

## Metrics

| Metric | Value |
|--------|-------|
| Implementation plans | 7 |
| Research documents | 4 |
| New service files | 25+ |
| Modified service files | ~10 |
| New type definitions | ~20 |
| Lines of code (new) | ~4,500 |
| Unit tests | 1074 |
| E2E requests | 31 |
| Total test assertions | ~200 |

---

## What We're NOT Doing

Per plan scope:
- **Real-time embedding generation**: Pre-computed at seed/upload time, not on-the-fly
- **Embedding fine-tuning**: Using pre-trained mxbai-embed-large as-is
- **Full-text search endpoint**: TF-IDF used for similarity scoring, not standalone search
- **Resume parsing improvements**: Basic extraction; LLM handles structure interpretation
- **Multi-language support**: English only for now

---

## Lessons Learned

1. **Interval merging is essential for accurate skill years**: Without it, concurrent jobs inflate experience counts significantly.

2. **Centroid comparison scales well**: O(1) per candidate instead of O(n×m) pairwise comparisons makes embedding similarity practical.

3. **Hybrid sparse+dense outperforms either alone**: TF-IDF catches exact matches that embeddings miss; embeddings catch semantic similarity that TF-IDF misses.

4. **Company normalization pays off**: Matching "Stripe, Inc." to "Stripe" to "stripe" enables meaningful company-based analysis.

5. **Recency weighting requires careful calibration**: 1.5x for 3-year recency balances relevance vs not over-penalizing experienced engineers.

6. **Pre-computing embeddings is the right tradeoff**: Slightly stale embeddings are better than 100ms+ latency per search.

---

## Future Considerations

1. **Job description matching**: Use the same TF-IDF + embedding infrastructure to match engineers to job descriptions
2. **Skill trajectory analysis**: Use work experience timeline to identify skill growth patterns
3. **Company reputation scoring**: Weight experience at well-known companies
4. **Resume similarity search**: "Find engineers with similar backgrounds to this one"
5. **Embedding model updates**: Periodically re-embed skills as models improve

---

## References

- **Implementation Plans**:
  - `thoughts/shared/2_chapter_4/1_project_1/plans/2026-01-21-content-based-resume-filtering.md`
  - `thoughts/shared/2_chapter_4/1_project_1/plans/2026-01-22-pdf-resume-upload.md`
  - `thoughts/shared/2_chapter_4/1_project_1/plans/2026-01-22-resume-text-generation.md`
  - `thoughts/shared/2_chapter_4/1_project_1/plans/2026-01-23-skill-embedding-similarity.md`
  - `thoughts/shared/2_chapter_4/1_project_1/plans/2026-01-23-skill-years-calculation.md`
  - `thoughts/shared/2_chapter_4/1_project_1/plans/2026-01-21-tfidf-vectorizer-srp-refactor.md`
  - `thoughts/shared/2_chapter_4/1_project_1/plans/2026-01-21-per-requirement-preferred-skill-preferences.md`
- **Research Documents**:
  - `thoughts/shared/2_chapter_4/1_project_1/research/2026-01-21-content-based-resume-filtering.md`
  - `thoughts/shared/2_chapter_4/1_project_1/research/2026-01-22-embedding-model-selection.md`
  - `thoughts/shared/2_chapter_4/1_project_1/research/2026-01-22-seeded-engineers-and-skills.md`
  - `thoughts/shared/2_chapter_4/1_project_1/research/2026-01-23-job-description-matching-reusable-components.md`
- **Test Results**:
  - `thoughts/shared/2_chapter_4/1_project_1/test-results/2026-01-22-content-search-e2e-test-results.md`
  - `thoughts/shared/2_chapter_4/1_project_1/test-results/2026-01-23-resume-file-upload-e2e-test-results.md`
- **Explanatory Documents**:
  - `thoughts/shared/2_chapter_4/1_project_1/skill-embeddings-explained.md`
  - `thoughts/shared/2_chapter_4/1_project_1/eightfold-system-comparison.md`
  - `thoughts/shared/2_chapter_4/1_project_1/pdf-extraction-flows.md`
- **Foundational Info**:
  - `thoughts/shared/2_chapter_4/0_foundational_info/` (feature extraction, weighting, text similarity, vectors, TF-IDF, centroids)
