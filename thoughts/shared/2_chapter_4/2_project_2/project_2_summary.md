# Project 2: Job Description Seeding & Upload API

**Status**: Complete
**Duration**: January 23-24, 2026
**Branch**: `chapter-4-project-2`

---

## Executive Summary

Project 2 implements the job description side of Chapter 4's content-based filtering approach. The system can now accept job descriptions (both seeded and uploaded via API), extract structured features using LLM, normalize them to canonical taxonomy, store relationships in Neo4j, and generate embeddings for semantic matching.

Key capabilities delivered:

1. **Job Description Seeding**: 12 diverse job postings covering all seniority levels, multiple industries, and various technical domains
2. **LLM Feature Extraction**: Extracts title, skills, domains, seniority, budget, timeline, and timezone from raw job description text
3. **Skill/Domain Normalization**: Maps extracted names to canonical IDs via exact match, synonym lookup, and fuzzy matching
4. **Job Upload API**: REST endpoint (`POST /api/job-description/upload`) for creating and updating job descriptions
5. **Embedding Generation**: 1024-dimensional vectors for semantic search using mxbai-embed-large model
6. **Company Relationships**: Jobs linked to companies via `POSTED_BY` relationship

---

## Problem Statement

### Problem 1: No Job Description Data Model

Previous projects focused on engineer search. But the matching equation requires both sides:
- Engineers with skills, experience, and preferences
- Jobs with requirements, constraints, and context

### Problem 2: No API for Job Input

Hiring managers needed a way to input job descriptions and have the system extract structured requirements automatically.

### Problem 3: Skills/Domains Needed Normalization

Raw job descriptions use varied terminology ("TypeScript", "TS", "Typescript"). These need to map to canonical skill IDs for matching.

---

## Solution Overview

### Solution 1: Job Description Data Model

New graph structure for jobs:

```
JobDescription → REQUIRES_SKILL → Skill (with minProficiency)
JobDescription → PREFERS_SKILL → Skill (with minProficiency)
JobDescription → REQUIRES_BUSINESS_DOMAIN → BusinessDomain (with minYears)
JobDescription → PREFERS_BUSINESS_DOMAIN → BusinessDomain
JobDescription → REQUIRES_TECHNICAL_DOMAIN → TechnicalDomain
JobDescription → PREFERS_TECHNICAL_DOMAIN → TechnicalDomain
JobDescription → POSTED_BY → Company
```

### Solution 2: LLM-Powered Feature Extraction

Ollama-based extraction pipeline:
1. RAG context loads valid domains and company names from Neo4j
2. Structured prompt with constrained enum values
3. JSON response parsing with validation
4. Skill normalization (exact → synonym → fuzzy)

### Solution 3: Dual-Mode Upload API

Single endpoint supporting both operations:
- **Create**: Omit `jobId` → generates new `job_xxxxx` ID
- **Update**: Provide `jobId` → replaces all relationships

---

## Data Model

### JobDescription Node

```typescript
{
  id: string;           // job_senior_backend_fintech
  title: string;        // "Senior Backend Engineer - Payments Platform"
  description: string;  // Full job description text
  companyName: string;  // "TechPay Solutions"
  location: string;     // "Remote (US)"
  seniority: SeniorityLevel;  // junior | mid | senior | staff | principal
  minBudget: number;    // 180000
  maxBudget: number;    // 220000
  stretchBudget?: number; // 240000
  startTimeline: StartTimeline; // immediate | two_weeks | one_month | three_months
  timezone: string[];   // ["Eastern", "Central"]
  teamFocus?: TeamFocus; // greenfield | migration | maintenance | scaling
  embedding: number[];  // 1024-dim vector
  embeddingModel: string; // "mxbai-embed-large"
  createdAt: DateTime;
}
```

### Skill Relationships

```typescript
// Required skills (hard requirements)
(job)-[:REQUIRES_SKILL {minProficiency: "expert"}]->(skill)

// Preferred skills (nice-to-haves)
(job)-[:PREFERS_SKILL {minProficiency: "proficient"}]->(skill)
```

### Domain Relationships

```typescript
// Required business domain experience
(job)-[:REQUIRES_BUSINESS_DOMAIN {minYears: 3}]->(businessDomain)

// Technical domain requirements
(job)-[:REQUIRES_TECHNICAL_DOMAIN]->(technicalDomain)
```

---

## Implementation Architecture

### File Structure

```
recommender_api/src/
├── routes/
│   └── job-description.routes.ts       # POST /api/job-description/upload
├── controllers/
│   └── job-description.controller.ts   # Request handling
├── schemas/
│   ├── job-description.schema.ts       # Zod validation
│   └── enums.schema.ts                 # Shared enum types (extracted)
├── types/
│   └── enums.types.ts                  # Type re-exports
├── services/
│   ├── job.service.ts                  # Job CRUD operations
│   └── job-description-processor/
│       ├── job-upload.service.ts       # Upload orchestrator
│       └── job-description-feature-extractor.service.ts  # LLM extraction

seeds/
├── job-descriptions.ts                 # 12 seeded job postings
├── job-description-embeddings.ts       # Embedding generation
├── companies.ts                        # +12 companies for jobs
├── migrations/
│   └── 003-add-job-vector-index.ts    # HNSW vector index
└── __tests__/
    └── job-descriptions.test.ts        # Seed data validation
```

### Data Flow: Job Description Upload

```
POST /api/job-description/upload
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     job-description.routes.ts                        │
│  • Zod schema validation (JobDescriptionUploadRequestSchema)        │
│  • Routes to controller                                             │
└─────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│               job-description-feature-extractor.service.ts           │
│  1. Load RAG context (domains, companies from Neo4j)                │
│  2. Build extraction prompt with constrained values                 │
│  3. Call Ollama LLM for structured extraction                       │
│  4. Parse JSON response → ExtractedJobDescription                   │
└─────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     job-upload.service.ts                            │
│  1. Determine create vs update (based on jobId presence)            │
│  2. Normalize skills → canonical IDs (exact/synonym/fuzzy)          │
│  3. Normalize domains → canonical IDs                               │
│  4. Upsert JobDescription node                                      │
│  5. Create skill relationships (REQUIRES/PREFERS)                   │
│  6. Create domain relationships                                     │
│  7. Link to company (POSTED_BY)                                     │
│  8. Generate and store embedding                                    │
└─────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Response                                    │
│  • jobId: "job_843bdd13"                                            │
│  • isNewJob: true/false                                             │
│  • extractedFeatures: structured data from LLM                      │
│  • validationResults: resolved/unresolved skills/domains            │
│  • embedding: { dimensions: 1024, model: "mxbai-embed-large" }      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### 1. Enum Extraction to Shared Module

**Decision**: Extract shared enums (seniority, timeline, proficiency, team focus, timezone) from `search.schema.ts` to `enums.schema.ts`.

**Rationale**:
- Both search and job description processing need these types
- Single source of truth prevents drift
- Cleaner import paths

### 2. Required vs Preferred Distinction

**Decision**: Separate relationship types for required (`REQUIRES_SKILL`) vs preferred (`PREFERS_SKILL`) skills.

**Rationale**:
- Matches how job descriptions are written (Requirements vs Nice-to-have)
- Enables different matching weights
- Clear semantics in the graph

### 3. Create/Update via Same Endpoint

**Decision**: Use `POST /api/job-description/upload` for both create and update, with `jobId` presence determining mode.

**Rationale**:
- Mirrors the resume upload pattern (consistency)
- Simple API surface
- Idempotent updates (replace all relationships)

### 4. RAG-Constrained Extraction

**Decision**: Load valid domains and companies from Neo4j to constrain LLM extraction.

**Rationale**:
- Prevents hallucinated domain names
- Improves extraction accuracy
- Domain names match canonical taxonomy

### 5. Original Text Stored for Embedding

**Decision**: Store full original job description text and use it for embedding generation.

**Rationale**:
- Embeddings capture semantic meaning of full description
- Not dependent on LLM extraction quality
- Enables text-based similarity search

---

## Seeded Data

### 12 Job Descriptions

| Job ID | Title | Seniority | Industry | Budget Range |
|--------|-------|-----------|----------|--------------|
| job_senior_backend_fintech | Senior Backend Engineer - Payments Platform | Senior | Fintech | $180k-$220k |
| job_staff_architect_fintech | Staff Engineer - Financial Infrastructure | Staff | Fintech | $250k-$300k |
| job_mid_frontend_saas | Frontend Engineer - Design Systems | Mid | SaaS | $140k-$175k |
| job_senior_fullstack_ecommerce | Senior Full Stack Engineer - E-commerce Platform | Senior | E-commerce | $160k-$200k |
| job_junior_frontend_startup | Junior Frontend Developer | Junior | Startup | $80k-$100k |
| job_senior_backend_healthcare | Senior Backend Engineer - Healthcare Platform | Senior | Healthcare | $170k-$210k |
| job_mid_data_healthcare | Data Engineer - Clinical Analytics | Mid | Healthcare | $145k-$175k |
| job_senior_devops_enterprise | Senior DevOps Engineer - Platform Team | Senior | Enterprise | $175k-$215k |
| job_mid_platform_saas | Platform Engineer | Mid | SaaS | $135k-$165k |
| job_senior_ml_fintech | Senior ML Engineer - Fraud Detection | Senior | Fintech | $190k-$240k |
| job_staff_ml_research | Staff ML Engineer - Research Platform | Staff | AI Research | $280k-$350k |
| job_principal_distributed_systems | Principal Engineer - Distributed Systems | Principal | Enterprise | $320k-$400k |

### 12 Companies Added

| Company ID | Name | Type |
|------------|------|------|
| company_techpay | TechPay Solutions | Startup |
| company_financeforward | FinanceForward | Startup |
| company_designhub | DesignHub | Startup |
| company_shopstream | ShopStream | Startup |
| company_launchpad | LaunchPad Tech | Startup |
| company_healthtech | HealthTech Innovations | Startup |
| company_clinicaldata | ClinicalData Corp | Enterprise |
| company_scaleup | ScaleUp Systems | Startup |
| company_cloudnative | CloudNative Inc | Startup |
| company_securepay | SecurePay | Startup |
| company_airesearch | AI Research Labs | Startup |
| company_megascale | MegaScale Technologies | Enterprise |

---

## Testing

### Unit Tests

| Module | Tests | Coverage |
|--------|-------|----------|
| job-description-feature-extractor.test.ts | 2 | getUniqueSkillNames deduplication |
| job-upload-service.test.ts | 5 | joinNormalizedWithExtracted helper |

### Integration Tests

| Test File | Scenarios | Key Verification |
|-----------|-----------|------------------|
| job-description-upload.test.ts | 12 | Full upload flow, create/update, validation errors |
| job-seed-verification.test.ts | 5 | Neo4j nodes and relationships seeded |
| job-embedding-verification.test.ts | 4 | Vector index and embeddings stored |

### Seed Validation Tests

| Test File | Scenarios | Key Verification |
|-----------|-----------|------------------|
| seeds/__tests__/job-descriptions.test.ts | 12 | Valid IDs, seniority coverage, relationship integrity |

### E2E Tests (Newman/Postman)

| Test | Status | Response Time | Key Verification |
|------|--------|---------------|------------------|
| Job Creation Success | PASS | 15.2s | Creates new job, extracts features, generates embedding |
| Job Update Success | PASS | 9.4s | Updates existing job, preserves jobId |
| Validation Error: Missing text | PASS | 3ms | Returns 400 with ZodError |
| Validation Error: Empty text | PASS | 3ms | Returns 400 with ZodError |
| Error: Non-existent Job Update | PASS | 6ms | Returns 404 NOT_FOUND |
| Skills Extraction and Resolution | PASS | 8.9s | Resolves to canonical IDs |
| Company Extraction | PASS | 11.0s | Resolves company name |
| Domain Extraction | PASS | 10.4s | Business and technical domains |
| Embedding Generation | PASS | 11.2s | 1024-dim mxbai-embed-large |
| Budget Extraction | PASS | 7.2s | Salary range, junior seniority |
| Timeline and Timezone | PASS | 12.3s | "immediate" timeline, all US zones |
| Team Focus Extraction | PASS | 14.3s | Detects "scaling" team focus |

**Total: 12 tests, 47 assertions, all passing.**

---

## Skill Resolution Statistics

From E2E tests, skill resolution rates by test:

| Test | Resolved | Unresolved | Rate |
|------|----------|------------|------|
| Payments Platform | 7 | 3 | 70% |
| Financial Infrastructure | 1 | 1 | 50% |
| Design Systems | 3 | 2 | 60% |
| Cloud Platform | 5 | 2 | 71% |
| Healthcare Platform | 4 | 0 | 100% |
| Clinical Analytics | 1 | 7 | 12.5% |
| Junior Frontend | 3 | 0 | 100% |
| E-commerce Platform | 5 | 3 | 62.5% |
| DevOps Platform | 6 | 6 | 50% |

Unresolved skills indicate opportunities to expand the canonical skill database (e.g., CSS, Tailwind, SQL, Spark, Airflow, Prometheus, Grafana).

---

## Performance Considerations

| Operation | Time | Notes |
|-----------|------|-------|
| LLM extraction | 7-15s | Ollama processing |
| Skill normalization | ~10ms | Per unique skill |
| Embedding generation | ~500ms | Included in LLM time |
| Validation errors | ~3ms | No LLM needed |
| **Total upload** | **7-15s** | With LLM |

---

## Configuration Reference

### Embedding Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| Model | mxbai-embed-large | Via Ollama |
| Dimensions | 1024 | Vector size |
| Index type | HNSW | Hierarchical Navigable Small World |
| Similarity metric | Cosine | For semantic search |

### Feature Extraction Prompt

The LLM extraction uses RAG context from Neo4j:
- Valid business domains (loaded dynamically)
- Valid technical domains (loaded dynamically)
- Known company names (for better extraction)

Constrained output uses canonical enum values:
- Seniority: junior, mid, senior, staff, principal
- Timeline: immediate, two_weeks, one_month, three_months, six_months, one_year
- Timezone: Eastern, Central, Mountain, Pacific
- Team Focus: greenfield, migration, maintenance, scaling
- Proficiency: learning, proficient, expert

---

## Metrics

| Metric | Value |
|--------|-------|
| Implementation plans | 2 |
| Research documents | 1 |
| New service files | 4 |
| New schema/type files | 4 |
| New controller files | 1 |
| New route files | 1 |
| New seed files | 3 |
| Lines of code (new) | ~1,820 |
| Unit tests | 7 |
| Integration tests | 21 |
| E2E tests | 12 |
| Total test assertions | ~65 |

---

## What We're NOT Doing

Per plan scope:
- **Job-to-engineer matching API**: Jobs are seeded and uploadable; matching is future work
- **File upload (PDF/DOCX)**: Text-only upload for now; file parsing can be added later
- **Job validation rules**: No validation of budget ranges or seniority coherence
- **Multi-language support**: English only for now

---

## Lessons Learned

1. **Enum extraction enables reuse**: Moving shared types to `enums.schema.ts` simplified both search and job description modules.

2. **RAG context improves extraction**: Providing valid domain names as context significantly improved LLM extraction accuracy.

3. **Required vs preferred semantics matter**: Separating relationship types creates cleaner matching logic.

4. **Original text for embeddings**: Using full original text (not extracted/summarized) provides better semantic search results.

5. **Skill database gaps visible in E2E tests**: Low resolution rates highlight which skills to add (CSS, SQL, monitoring tools).

---

## Future Considerations

1. **Job-to-engineer matching endpoint**: Use embeddings and skill relationships for job recommendations
2. **Skill database expansion**: Add commonly extracted but unresolved skills
3. **File upload support**: Parse PDF/DOCX job descriptions
4. **Salary normalization**: Validate budget ranges against seniority expectations
5. **Job expiration**: Add TTL or status for job postings
6. **Similar job search**: Find jobs similar to a given job description

---

## References

- **Implementation Plans**:
  - `thoughts/shared/2_chapter_4/2_project_2/plans/2026-01-23-job-description-seeding.md`
  - `thoughts/shared/2_chapter_4/2_project_2/plans/2026-01-24-job-description-upload-api.md`
- **Research Documents**:
  - `thoughts/shared/2_chapter_4/2_project_2/research/2026-01-23-seeded-engineers-comprehensive-analysis.md`
- **Test Results**:
  - `thoughts/shared/2_chapter_4/2_project_2/test-results/2026-01-24-job-description-upload-e2e-test-results.md`
- **Project 1 Reference**:
  - `thoughts/shared/2_chapter_4/1_project_1/project_1_summary.md` (content-based resume filtering)
