---
date: 2026-01-23T14:30:00-08:00
researcher: Claude
git_commit: 3ba63a9
branch: chapter-4-project-1
repository: recommender_system
topic: "Reusable Components for Job Description Matching Feature"
tags: [research, codebase, job-description, content-search, search-filter, reuse]
status: complete
last_updated: 2026-01-23
last_updated_by: Claude
---

# Research: Reusable Components for Job Description Matching Feature

**Date**: 2026-01-23T14:30:00-08:00
**Researcher**: Claude
**Git Commit**: 3ba63a9
**Branch**: chapter-4-project-1
**Repository**: recommender_system

## Research Question

What existing components from the content-based resume filtering (Phase 1-3) and PDF resume upload implementations can be reused for a new job description matching feature, where an engineering manager pastes a job description and receives a sorted list of recommended engineers?

## Summary

The codebase has **extensive infrastructure** that can be directly reused for job description matching. The key insight is that `SearchFilterRequest` already represents structured manager requirements - a parsed job description would produce exactly this structure.

### MVP Implementation
No new search infrastructure needed - only a new extraction pipeline and endpoint:
1. **LLM extraction** (pattern exists in `feature-extractor.service.ts`) to parse job descriptions into `SearchFilterRequest` structure
2. **Hybrid search** (fully implemented) combining boolean filters with embedding ranking
3. **Explainability** via TF-IDF matching terms

### Production Architecture
For the full multi-signal approach aligned with Eightfold's architecture, see:
**`thoughts/shared/2_chapter_4/1_project_1/eightfold-system-comparison.md`**

Key takeaway: Extract signals from both content and structure, combine in a scoring model that can eventually learn optimal weights from outcome data.

## Detailed Findings

### 1. SearchFilterRequest: The Target Schema Already Exists

**Location**: `recommender_api/src/types/search.types.ts` and `recommender_api/src/schemas/search.schema.ts`

The `SearchFilterRequest` is essentially a parsed job description. It already supports:

| Job Description Element | SearchFilterRequest Field |
|------------------------|---------------------------|
| Required skills | `requiredSkills: SkillRequirement[]` |
| Nice-to-have skills | `preferredSkills: SkillRequirement[]` |
| Experience level | `requiredSeniorityLevel`, `preferredSeniorityLevel` |
| Start date needs | `requiredMaxStartTime`, `preferredMaxStartTime` |
| Timezone requirements | `requiredTimezone: USTimezoneZone[]` |
| Budget constraints | `maxBudget`, `stretchBudget` |
| Industry experience | `requiredBusinessDomains`, `preferredBusinessDomains` |
| Technical focus | `requiredTechnicalDomains`, `preferredTechnicalDomains` |
| Team context | `teamFocus` (greenfield/migration/maintenance/scaling) |

**Key type definitions**:
```typescript
interface SkillRequirement {
  skill: string;
  minProficiency?: ProficiencyLevel;        // Hard filter
  preferredMinProficiency?: ProficiencyLevel; // Ranking boost
}

interface BusinessDomainRequirement {
  domain: string;
  minYears?: number;
  preferredMinYears?: number;
}
```

**Reuse strategy**: Parse job description text directly into `SearchFilterRequest` using LLM extraction with RAG context.

---

### 2. LLM Feature Extraction Pattern

**Location**: `recommender_api/src/services/resume-processor/feature-extractor.service.ts`

This service demonstrates the exact pattern needed for job description parsing:

#### RAG Context Loading
```typescript
export async function loadExtractionRagContext(session: Session): Promise<ExtractionRagContext> {
  // Loads valid values from Neo4j to constrain LLM output:
  // - validBusinessDomains (from BusinessDomain nodes)
  // - validTechnicalDomains (from TechnicalDomain nodes)
  // - validCompanyTypes
  // - validSeniorities
}
```

#### Prompt Construction Pattern
```typescript
function buildExtractionPrompt(resumeText: string, ragContext: ExtractionRagContext): string {
  return `Extract structured information...

IMPORTANT - Use ONLY these values for constrained fields:
- businessDomains: ${ragContext.validBusinessDomains.join(", ")}
- technicalDomains: ${ragContext.validTechnicalDomains.join(", ")}
- seniority: ${ragContext.validSeniorities.join(", ")}

Return JSON matching this exact schema:
{ ... }`;
}
```

#### JSON Response Parsing
```typescript
// Handle markdown code blocks and direct JSON
const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ||
                  response.match(/\{[\s\S]*\}/);
```

**Reuse strategy**: Create `buildJobDescriptionExtractionPrompt()` that:
1. Loads RAG context (skills, domains, seniorities from Neo4j)
2. Builds prompt instructing extraction into `SearchFilterRequest` shape
3. Returns structured requirements ready for search

---

### 3. Content-Based Search (Fully Implemented)

**Location**: `recommender_api/src/services/content-search/content-search.service.ts`

Three search methods are already available:

#### TF-IDF Search
- Keyword-based sparse vector similarity
- Returns matching terms for explainability
- Good for exact skill/technology matching

#### Embedding Search
- Dense semantic similarity via Ollama embeddings (mxbai-embed-large, 1024 dimensions)
- Uses Neo4j HNSW vector index for O(log n) ANN search
- Handles semantic synonyms (K8s ↔ Kubernetes)

#### Hybrid Search (Most Relevant for Job Matching)
```typescript
async function executeHybridSearch(session, request): Promise<ContentSearchResponse> {
  // Stage 1: Boolean filter - guarantees required keywords present
  const candidateIds = booleanFilter(requiredTerms, invertedIndex);

  // Stage 2: Embedding ranking - semantically rank ALL filtered candidates
  const ranked = await findSimilarByEmbeddingWithFilter(session, queryEmbedding, limit, candidateIds);

  // Stage 3: TF-IDF matching - extract matching terms for explainability
  const matchingTerms = getTopMatchingTerms(queryVector, docVector, 5);
}
```

**Why hybrid is ideal for job descriptions**:
- Boolean filter ensures required skills are present (precision)
- Embedding ranking captures experience depth and context (quality)
- TF-IDF provides explainable matching terms (transparency)

**Reuse strategy**:
1. Generate embedding from job description text
2. Extract required terms from parsed requirements
3. Call `executeHybridSearch()` or `executeContentSearch()` directly

---

### 4. Constraint-Based Search (Fully Implemented)

**Location**: `recommender_api/src/services/search.service.ts`

The existing search engine already accepts `SearchFilterRequest` and:
- Resolves skill names to canonical IDs
- Expands constraints using knowledge base rules
- Builds Cypher queries with skill hierarchy expansion
- Applies utility scoring across multiple dimensions

**Endpoint**: `POST /api/search/filter`

**Reuse strategy**: After parsing job description into `SearchFilterRequest`, pass it directly to `executeSearch()`.

---

### 5. Text Normalization Pipeline

**Location**: `recommender_api/src/services/content-search/text-normalizer.service.ts`

Handles technology-specific text processing:
- Tech compound normalization: "Node.js" → "nodejs", "C++" → "cpp"
- Phrase tokenization: "machine learning" → "machinelearning"
- Stopword filtering (English + resume-specific filler words)
- Optional stemming/lemmatization

**Reuse strategy**: Apply same normalization to job description text before TF-IDF/embedding generation.

---

### 6. Skill Normalization

**Location**: `recommender_api/src/services/skill-normalizer.service.ts`

4-tier skill resolution:
1. **Exact match** on skill ID or name (confidence: 1.0)
2. **Synonym lookup** via SkillSynonym nodes (confidence: 0.95)
3. **Fuzzy match** via Levenshtein distance, threshold 0.8 (variable confidence)
4. **Unresolved** for unknown skills (confidence: 0)

**Reuse strategy**: Normalize skills extracted from job descriptions to canonical taxonomy.

---

### 7. Domain Normalization

**Location**: `recommender_api/src/services/domain-normalizer.service.ts`

Case-insensitive lookup in Neo4j for both BusinessDomain and TechnicalDomain nodes.

**Reuse strategy**: Normalize domains extracted from job descriptions.

---

### 8. Neo4j Graph Schema (Relevant Portions)

**Engineers have rich profiles**:
```
Engineer → headline, salary, yearsExperience, startTimeline, timezone, embedding
  ├── HAS → UserSkill → FOR → Skill (with proficiencyLevel, yearsUsed)
  ├── HAD_ROLE → WorkExperience → AT_COMPANY → Company
  ├── HAS_EXPERIENCE_IN → BusinessDomain (with years)
  ├── HAS_EXPERIENCE_IN → TechnicalDomain (with years)
  └── HAS_RESUME → Resume (rawText for content search)
```

**Vector search infrastructure**:
- `engineer_embedding_index` (HNSW, 1024 dimensions, cosine similarity)
- In-memory TF-IDF index with vocabulary and document vectors
- Inverted index for boolean filtering

---

### 9. Utility Scoring System

**Location**: `recommender_api/src/services/utility-calculator/`

Engineers are scored across multiple dimensions:
- **Core scores** (weighted): skillMatch × 0.40 + confidence × 0.30 + experience × 0.30
- **Preference boosts**: per-skill proficiency, team focus, domains, timezone, seniority, budget, timeline

**Reuse strategy**: The same scoring applies whether requirements come from manual input or parsed job description.

---

## Architecture Insights

### Proposed Job Description Matching Flow

```
Job Description Text
    │
    ▼ LLM Extraction (new, reuses feature-extractor pattern)
SearchFilterRequest + queryText
    │
    ├──▶ Content Search Path (for semantic matching)
    │    │
    │    ▼ Text Normalization (existing)
    │    │
    │    ▼ Hybrid Search (existing)
    │        - Boolean filter (required skills as requiredTerms)
    │        - Embedding ranking (job description → embedding)
    │        - TF-IDF matching terms (explainability)
    │    │
    │    ▼ Results with contentScore + matchingTerms
    │
    └──▶ Constraint Search Path (for structured matching)
         │
         ▼ Skill Resolution (existing)
         │
         ▼ Cypher Query (existing)
         │
         ▼ Utility Scoring (existing)
         │
         ▼ Results with utilityScore + scoreBreakdown
```

### Two Complementary Approaches

| Approach | Best For | Existing Implementation |
|----------|----------|------------------------|
| **Content Search** | Semantic understanding, handling paraphrasing | `executeContentSearch()` |
| **Constraint Search** | Precise requirement matching, boolean filters | `executeSearch()` |

A job description endpoint could:
1. Parse into `SearchFilterRequest` (structured requirements)
2. Run both searches in parallel
3. Merge/rerank results (fusion strategy TBD)

Or use **hybrid search** which already combines:
- Boolean filtering (from requiredTerms)
- Embedding ranking (from job description text)
- TF-IDF explainability

---

## Code References

### Core Services to Reuse

| Service | Path | Key Functions |
|---------|------|---------------|
| Feature Extractor | `services/resume-processor/feature-extractor.service.ts` | `extractFeaturesFromResume()`, `loadExtractionRagContext()` |
| Content Search | `services/content-search/content-search.service.ts` | `executeContentSearch()` |
| Search Service | `services/search.service.ts` | `executeSearch()` |
| Skill Normalizer | `services/skill-normalizer.service.ts` | `normalizeExtractedSkills()` |
| Text Normalizer | `services/content-search/text-normalizer.service.ts` | `tokenize()` |
| Embedding Manager | `services/content-search/embedding-index-manager.service.ts` | `findSimilarByEmbedding()` |
| TF-IDF Manager | `services/content-search/tfidf-index-manager.service.ts` | `getTfIdfIndex()`, `queryToVector()` |
| Inverted Index | `services/content-search/inverted-index.service.ts` | `booleanFilter()` |

### Types and Schemas

| Type | Path | Purpose |
|------|------|---------|
| SearchFilterRequest | `types/search.types.ts` | Target schema for parsed job descriptions |
| ContentSearchRequest | `schemas/resume.schema.ts` | Content search input schema |
| ExtractionRagContext | `services/resume-processor/feature-extractor.service.ts` | RAG context for constrained extraction |

---

## Historical Context (from Implementation Plans)

### From `2026-01-21-content-based-resume-filtering.md`:

**Phase 1 (TF-IDF Baseline)**: Implemented sparse vector search with text normalization, skill/company normalization, and TF-IDF indexing.

**Phase 2 (Dense Embeddings)**: Added embedding generation via Ollama (mxbai-embed-large), Neo4j HNSW vector index, and embedding-based similarity search.

**Phase 3 (Hybrid Approach)**: Combined boolean filtering + embedding ranking + TF-IDF explainability. Key architectural decision: embeddings rank ALL filtered candidates (not TF-IDF pre-filtered) to avoid penalizing senior engineers with concise resumes.

### From `2026-01-22-pdf-resume-upload.md`:

**File extraction pipeline** (PDF/DOCX) shows how to handle different input formats before processing. Similar pattern could apply if job descriptions arrive as files.

---

## Eightfold Comparison

For detailed comparison of our system vs Eightfold's architecture, including:
- Feature-by-feature gap analysis
- Mental model shift (layered → multi-signal)
- Implementation roadmap aligned to Eightfold phases
- Outcome data collection strategy

See: **`thoughts/shared/2_chapter_4/1_project_1/eightfold-system-comparison.md`**

---

## Open Questions (Job Description Specific)

1. **Job Description Storage**: Should parsed job descriptions be stored for:
   - Reuse across searches
   - Historical matching
   - Analytics on requirement patterns

2. **Required vs Inferred Requirements**: How to distinguish between explicit job requirements ("must have 5 years React") vs implied ones (job title "Senior Engineer" implies senior-level experience)?

3. **Partial Parsing Fallback**: What if LLM extraction fails or returns incomplete data?
   - Fall back to pure content search (embedding on raw text)?
   - Return error and ask user to refine?
   - Use partial extraction + content search?

4. **Confidence Thresholds**: Should extracted requirements have confidence scores? E.g., "React required (high confidence)" vs "Kubernetes preferred (medium confidence, inferred from 'cloud-native')"

For questions about skill embeddings, outcome data collection, and learned scoring, see:
`thoughts/shared/2_chapter_4/1_project_1/eightfold-system-comparison.md`

---

## Recommendations

### MVP Implementation (Job Description Matching)

**Goal**: Working job description matching with existing infrastructure.

1. **Create job description extraction service** (`services/job-description/job-extractor.service.ts`):
   - Reuse `loadExtractionRagContext()` pattern from resume feature extraction
   - Build prompt that outputs `SearchFilterRequest` + raw queryText
   - Parse and validate response with Zod schema

2. **Create endpoint** (`POST /api/jobs/match`):
   - Accept job description text
   - Call extraction service to parse requirements
   - Call `executeContentSearch()` with hybrid method (boolean filter + embedding ranking)
   - Return ranked engineers with match explanations (TF-IDF matching terms)

3. **No new search infrastructure needed** - all search capabilities exist.

**What this gives you**: Semantic matching with keyword guarantees and explainability.

---

### Pre-requisite: Skill Embeddings

Before implementing job description matching, consider implementing skill embeddings first:
- Low effort (~1 day)
- Improves matching quality from day one
- See: `thoughts/shared/2_chapter_4/1_project_1/skill-embeddings-explained.md`

---

### Future Enhancements

For the full Eightfold-aligned roadmap (multi-signal scoring, learned weights, career trajectory):
- See: `thoughts/shared/2_chapter_4/1_project_1/eightfold-system-comparison.md`

**Summary of phases**:
| Phase | Description | Status |
|-------|-------------|--------|
| Skill embeddings | Add embeddings to Skill nodes | Next |
| Job description MVP | Extraction + hybrid search | After skill embeddings |
| Multi-signal scoring | Combine content + structure features | Future |
| Learned scoring | Train on outcome data | Future (needs data) |
| Career trajectory | Predict career progression | Future |

---

## Related Research

- `thoughts/shared/2_chapter_4/1_project_1/eightfold-system-comparison.md` - **Our system vs Eightfold: gap analysis and roadmap**
- `thoughts/shared/2_chapter_4/1_project_1/skill-embeddings-explained.md` - **How skill embeddings work and why they help**
- `thoughts/private/plans/2026-01-21-content-based-resume-filtering.md` - Full implementation plan for content-based filtering (Phases 1-3)
- `thoughts/private/plans/2026-01-22-pdf-resume-upload.md` - File upload pattern for resume ingestion
- `thoughts/shared/2_chapter_4/0_foundational_info/` - Foundational documentation on feature extraction, TF-IDF, embeddings
- `docs/learning_through_imitation/eightfold/eightfold_learning_plan.md` - Eightfold's original learning plan (source material)
