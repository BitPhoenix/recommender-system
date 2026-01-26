# Job Match API E2E Test Results

**Date**: 2026-01-26
**Endpoint**: `GET /api/job/:jobId/matches`
**Test Framework**: Newman (Postman CLI)
**Total Tests**: 10
**Total Assertions**: 29
**Result**: All passing

---

## Test Summary

| Test # | Name | Status | Response Time | Key Verification |
|--------|------|--------|---------------|------------------|
| 01 | Basic Match Success | PASS | 745ms | Response structure and required fields |
| 02 | Score Breakdown Structure | PASS | 450ms | All 10 signal fields present with valid ranges |
| 03 | Results Ordered by Score | PASS | 297ms | Descending sort by matchScore |
| 04 | Pagination First Page | PASS | 294ms | Limit enforced, totalCount available |
| 05 | Pagination Second Page | PASS | 350ms | No overlap between pages |
| 06 | Different Jobs Return Different Rankings | PASS | 630ms | Frontend job returns frontend-focused matches |
| 07 | Query Metadata Present | PASS | 177ms | Execution stats and scoring weights |
| 08 | 404 Not Found for Non-existent Job | PASS | 5ms | Proper error response |
| 09 | Invalid Limit Parameter | PASS | 7ms | Validation rejects limit > 100 |
| 10 | Invalid Offset Parameter | PASS | 3ms | Validation rejects negative offset |

---

## Test 01: Basic Match Success

### Request
```
GET /api/job/job_senior_backend_fintech/matches
```

### Expected Behavior
- Returns HTTP 200 with job match results
- Response includes jobId, jobTitle, matches array, totalCount, and queryMetadata
- Job ID in response matches the requested job
- Matches array is non-empty
- Each match contains id, name, matchScore, and scoreBreakdown

### Actual Response (key fields)
```json
{
  "jobId": "job_senior_backend_fintech",
  "jobTitle": "Senior Backend Engineer - Payments Platform",
  "matches": [
    {
      "id": "eng_priya",
      "name": "Priya Sharma",
      "headline": "Senior Backend Engineer | Fintech & Payments",
      "salary": 210000,
      "yearsExperience": 8,
      "timezone": "Eastern",
      "matchScore": 0.929,
      "scoreBreakdown": {
        "semanticSimilarity": 0.922,
        "skillSimilarity": 0.913,
        "recentSkillSimilarity": 0.913,
        "requiredSkillCoverage": 1.0,
        "preferredSkillCoverage": 0.5,
        "seniorityMatch": 1.0,
        "timezoneMatch": 1.0,
        "budgetMatch": 1.0,
        "matchingSkills": ["Kafka", "PostgreSQL", "Node.js", "TypeScript", "Mentorship"],
        "missingRequiredSkills": []
      }
    }
  ],
  "totalCount": 100,
  "queryMetadata": { ... }
}
```

### Assertions Verified
- Status code is 200: PASS
- Response has required top-level fields: PASS
- Job ID matches request: PASS
- Matches is non-empty array: PASS
- Each match has required fields: PASS

### Notes
The top match (Priya Sharma) has a near-perfect score of 0.929 because:
- **100% required skill coverage**: Has all 4 required skills (Kafka, PostgreSQL, Node.js, TypeScript)
- **Perfect seniority match**: 8 years experience meets senior requirement (6-10 years)
- **Perfect timezone match**: Eastern timezone matches job requirement
- **Perfect budget match**: $210k salary within budget
- **High semantic similarity**: Resume headline explicitly mentions "Fintech & Payments"

---

## Test 02: Score Breakdown Structure

### Request
```
GET /api/job/job_senior_backend_fintech/matches?limit=5
```

### Expected Behavior
- Each match's scoreBreakdown contains all 10 signal fields
- Numeric signals are normalized between 0 and 1
- Explainability arrays (matchingSkills, missingRequiredSkills) are present

### Actual Response (score breakdown for top match)
```json
{
  "scoreBreakdown": {
    "semanticSimilarity": 0.9224724769592285,
    "skillSimilarity": 0.9133686530617572,
    "recentSkillSimilarity": 0.9133686530617572,
    "requiredSkillCoverage": 1.0,
    "preferredSkillCoverage": 0.5,
    "seniorityMatch": 1.0,
    "timezoneMatch": 1.0,
    "budgetMatch": 1.0,
    "matchingSkills": ["Kafka", "PostgreSQL", "Node.js", "TypeScript", "Mentorship"],
    "missingRequiredSkills": []
  }
}
```

### Assertions Verified
- Status code is 200: PASS
- Score breakdown has all signal fields: PASS
- All numeric signals are between 0 and 1: PASS
- Explainability arrays are present: PASS

### Notes
The score breakdown implements the Eightfold-inspired multi-signal architecture:

| Signal | Weight | Description |
|--------|--------|-------------|
| skillSimilarity | 0.25 | Jaccard similarity between engineer skills and job skills |
| semanticSimilarity | 0.20 | Embedding cosine similarity between resume and job description |
| requiredSkillCoverage | 0.20 | Fraction of required skills the engineer possesses |
| recentSkillSimilarity | 0.10 | Skill similarity weighted by recency |
| seniorityMatch | 0.10 | Binary match for experience level |
| timezoneMatch | 0.05 | Binary or geographic proximity |
| budgetMatch | 0.05 | Whether salary falls within budget |
| preferredSkillCoverage | 0.05 | Fraction of preferred skills possessed |

---

## Test 03: Results Ordered by Score

### Request
```
GET /api/job/job_senior_backend_fintech/matches?limit=20
```

### Expected Behavior
- Results are sorted by matchScore in descending order
- Each subsequent match has a score <= the previous match

### Actual Response (first 5 matches with scores)
```json
[
  { "id": "eng_priya", "matchScore": 0.929 },
  { "id": "eng_ravi", "matchScore": 0.842 },
  { "id": "eng_alex", "matchScore": 0.798 },
  { "id": "eng_christine", "matchScore": 0.796 },
  { "id": "eng_natasha", "matchScore": 0.794 }
]
```

### Assertions Verified
- Status code is 200: PASS
- Results are sorted by matchScore descending: PASS

### Notes
The ordering shows meaningful differentiation:
- **eng_priya** (0.929): Perfect required skill coverage, fintech background
- **eng_ravi** (0.842): Missing Kafka, but strong TypeScript/Node.js
- **eng_alex** (0.798): Staff-level Java engineer, missing Node.js/TypeScript but has Kafka
- **eng_christine** (0.796): Strong skills but timezone mismatch (Pacific vs Eastern)
- **eng_natasha** (0.794): Missing Kafka, timezone mismatch (Mountain)

---

## Test 04: Pagination First Page

### Request
```
GET /api/job/job_senior_backend_fintech/matches?limit=5&offset=0
```

### Expected Behavior
- Returns at most `limit` results
- Response includes totalCount for pagination UI
- totalCount >= matches.length

### Actual Response
```json
{
  "matches": [
    { "id": "eng_priya", ... },
    { "id": "eng_ravi", ... },
    { "id": "eng_alex", ... },
    { "id": "eng_christine", ... },
    { "id": "eng_natasha", ... }
  ],
  "totalCount": 100
}
```

### Assertions Verified
- Status code is 200: PASS
- Returns at most limit results: PASS
- Total count is available: PASS

### Notes
The endpoint evaluates all 100 candidates in the database and returns the paginated subset. The `totalCount: 100` indicates all engineers are potential matches (no hard filtering applied).

---

## Test 05: Pagination Second Page

### Request
```
GET /api/job/job_senior_backend_fintech/matches?limit=5&offset=5
```

### Expected Behavior
- Returns different engineers than the first page
- No overlap between page 1 and page 2

### Actual Response (second page)
```json
{
  "matches": [
    { "id": "eng_derek", ... },
    { "id": "eng_hannah", ... },
    { "id": "eng_kevin", ... },
    { "id": "eng_mike", ... },
    { "id": "eng_david", ... }
  ]
}
```

### Assertions Verified
- Status code is 200: PASS
- Second page has no overlap with first page: PASS

### Notes
Pagination is applied after scoring and sorting, ensuring consistent results across pages. The test stores first page IDs in a collection variable and verifies no IDs appear on the second page.

---

## Test 06: Different Jobs Return Different Rankings

### Request
```
GET /api/job/job_mid_frontend_saas/matches?limit=10
```

### Expected Behavior
- Frontend job returns frontend-focused engineers at top
- Job title indicates frontend role
- Different ranking than backend job

### Actual Response
```json
{
  "jobId": "job_mid_frontend_saas",
  "jobTitle": "Frontend Engineer - Design Systems",
  "matches": [
    {
      "id": "eng_emma",
      "name": "Emma Wilson",
      "headline": "Frontend Engineer | React & Design Systems",
      "matchScore": 0.949,
      "scoreBreakdown": {
        "requiredSkillCoverage": 1.0,
        "preferredSkillCoverage": 1.0,
        "matchingSkills": ["TypeScript", "React", "Unit Testing", "Next.js"],
        "missingRequiredSkills": []
      }
    },
    {
      "id": "eng_emily",
      "name": "Emily Nakamura",
      "headline": "Frontend Engineer | React & Design Systems",
      "matchScore": 0.946,
      "scoreBreakdown": {
        "requiredSkillCoverage": 1.0,
        "preferredSkillCoverage": 1.0,
        "matchingSkills": ["TypeScript", "React", "Unit Testing", "Next.js"],
        "missingRequiredSkills": []
      }
    }
  ]
}
```

### Assertions Verified
- Status code is 200: PASS
- Frontend job returns results: PASS
- Job title is for frontend role: PASS

### Notes
The frontend job produces dramatically different rankings:
- **Backend job top match**: eng_priya (Senior Backend Engineer | Fintech & Payments)
- **Frontend job top match**: eng_emma (Frontend Engineer | React & Design Systems)

This demonstrates that the multi-signal scoring correctly identifies domain-relevant candidates based on:
- Semantic similarity between job description and engineer resume
- Skill overlap with required frontend skills (TypeScript, React, Unit Testing)
- Preferred skill coverage (Next.js)

---

## Test 07: Query Metadata Present

### Request
```
GET /api/job/job_senior_backend_fintech/matches?limit=5
```

### Expected Behavior
- Query metadata includes execution time in milliseconds
- Shows number of candidates evaluated
- Contains the scoring weights used

### Actual Response
```json
{
  "queryMetadata": {
    "executionTimeMs": 587,
    "candidatesEvaluated": 100,
    "scoringWeights": {
      "semanticSimilarity": 0.2,
      "skillSimilarity": 0.25,
      "recentSkillSimilarity": 0.1,
      "requiredSkillCoverage": 0.2,
      "preferredSkillCoverage": 0.05,
      "seniorityMatch": 0.1,
      "timezoneMatch": 0.05,
      "budgetMatch": 0.05
    }
  }
}
```

### Assertions Verified
- Status code is 200: PASS
- Query metadata has execution time: PASS
- Query metadata has candidates evaluated: PASS
- Query metadata has scoring weights: PASS

### Notes
The metadata provides transparency for:
- **Performance monitoring**: ~587ms to score 100 candidates
- **Debugging**: Confirms all 100 engineers were evaluated
- **Explainability**: Documents the exact weights used in scoring

The scoring weights sum to 1.0 and can be tuned via `config/job-match-scoring.config.ts`.

---

## Test 08: 404 Not Found for Non-existent Job

### Request
```
GET /api/job/nonexistent_job_id/matches
```

### Expected Behavior
- Returns HTTP 404 for unknown job IDs
- Response contains error field with "NOT_FOUND"

### Actual Response
```json
{
  "error": "NOT_FOUND",
  "message": "Job not found: nonexistent_job_id"
}
```

### Assertions Verified
- Status code is 404: PASS
- Response has error field: PASS

### Notes
The endpoint performs a job lookup before scoring. If the job ID doesn't exist in the database, it returns a clear error message. Response time of 5ms indicates the fast-fail path before any expensive scoring operations.

---

## Test 09: Invalid Limit Parameter

### Request
```
GET /api/job/job_senior_backend_fintech/matches?limit=999
```

### Expected Behavior
- Returns HTTP 400 for limit > 100
- Response indicates validation error

### Actual Response
```json
{
  "success": false,
  "error": {
    "issues": [
      {
        "origin": "number",
        "code": "too_big",
        "maximum": 100,
        "inclusive": true,
        "path": ["limit"],
        "message": "Too big: expected number to be <=100"
      }
    ],
    "name": "ZodError"
  }
}
```

### Assertions Verified
- Status code is 400: PASS
- Response indicates validation error: PASS

### Notes
Zod schema validation enforces `limit <= 100` to prevent:
- Excessive memory usage for large result sets
- Client performance issues rendering many results
- Potential abuse of the API

The error message clearly indicates the constraint violation.

---

## Test 10: Invalid Offset Parameter

### Request
```
GET /api/job/job_senior_backend_fintech/matches?offset=-1
```

### Expected Behavior
- Returns HTTP 400 for negative offset
- Response indicates validation error

### Actual Response
```json
{
  "success": false,
  "error": {
    "issues": [
      {
        "origin": "number",
        "code": "too_small",
        "minimum": 0,
        "inclusive": true,
        "path": ["offset"],
        "message": "Too small: expected number to be >=0"
      }
    ],
    "name": "ZodError"
  }
}
```

### Assertions Verified
- Status code is 400: PASS
- Response indicates validation error: PASS

### Notes
Zod schema validation enforces `offset >= 0` since negative offsets are semantically meaningless for pagination.

---

## Performance Summary

| Test | Response Time | Notes |
|------|---------------|-------|
| Basic Match | 745ms | Initial request, includes embedding lookup |
| Score Breakdown | 450ms | Subsequent cached embeddings |
| Results Ordered | 297ms | Consistent scoring performance |
| Pagination | 294-350ms | Pagination overhead minimal |
| Different Job | 630ms | Different job requires fresh embedding lookup |
| Metadata | 177ms | Cached results |
| 404 Error | 5ms | Fast-fail before scoring |
| Validation Errors | 3-7ms | Zod validation before processing |

Average response time for successful queries: ~296ms (excluding initial cold request).

---

## Scoring Behavior Observations

### Backend vs Frontend Job Comparison

| Rank | Backend Job (Senior Backend Fintech) | Frontend Job (Mid Frontend SaaS) |
|------|--------------------------------------|----------------------------------|
| 1 | eng_priya (0.929) - Senior Backend | eng_emma (0.949) - Frontend |
| 2 | eng_ravi (0.842) - Full Stack | eng_emily (0.946) - Frontend |
| 3 | eng_alex (0.798) - Staff Backend | eng_ryan (0.910) - Mobile/React |
| 4 | eng_christine (0.796) - Staff Full Stack | eng_marcus (0.908) - Full Stack |
| 5 | eng_natasha (0.794) - Full Stack | eng_rachel (0.888) - Frontend |

The scoring model successfully differentiates candidates based on role fit:
- Backend job surfaces backend-focused engineers
- Frontend job surfaces React/design systems specialists
- Full-stack engineers rank competitively for both

### Score Component Analysis (Top Backend Match)

For eng_priya matching job_senior_backend_fintech:

| Component | Value | Weight | Weighted |
|-----------|-------|--------|----------|
| skillSimilarity | 0.913 | 0.25 | 0.228 |
| semanticSimilarity | 0.922 | 0.20 | 0.184 |
| requiredSkillCoverage | 1.000 | 0.20 | 0.200 |
| recentSkillSimilarity | 0.913 | 0.10 | 0.091 |
| seniorityMatch | 1.000 | 0.10 | 0.100 |
| timezoneMatch | 1.000 | 0.05 | 0.050 |
| budgetMatch | 1.000 | 0.05 | 0.050 |
| preferredSkillCoverage | 0.500 | 0.05 | 0.025 |
| **Total** | | | **0.929** |
