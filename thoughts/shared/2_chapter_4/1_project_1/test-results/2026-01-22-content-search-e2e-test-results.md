# Content Search API E2E Test Results

**Date**: 2026-01-23 (Updated)
**Endpoints**:
- `POST /api/search/content` - TF-IDF keyword search, embedding search, hybrid search, and similarity search
- `POST /api/resume/upload` - Resume upload, feature extraction, and embedding generation

**Test Framework**: Newman (Postman CLI)
**Total Tests**: 31
**Total Assertions**: 92
**Result**: All passing (92/92)

---

## Test Summary

| Test # | Name | Status | Key Verification |
|--------|------|--------|------------------|
| 1 | Basic Keyword Search | PASS | Response structure and TF-IDF search method |
| 2 | Results Have Matching Terms | PASS | Content score breakdown with matching terms |
| 3 | Results Ranked by Relevance | PASS | Descending score ordering, scores in [0,1] |
| 4 | Similar to Engineer (TF-IDF) | PASS | Similar engineers found, reference excluded |
| 5 | No Matches for Nonsense Query | PASS | Empty results for gibberish query |
| 6 | Pagination with Limit | PASS | Limit parameter respected |
| 7 | Match Fields Present | PASS | All required fields in match objects |
| 8 | Invalid Request (Missing Required Fields) | PASS | 400 error with validation message |
| 9 | More Keyword Matches = Higher Rank | PASS | Top results have more matching terms |
| 10 | Rare Terms Boost Relevance | PASS | IDF weighting favors rare terms |
| 11 | Embedding Search Basic | PASS | Embedding method returns semantic results |
| 12 | Embedding Search Has Score Breakdown | PASS | Results include profileEmbeddingScore |
| 13 | Embedding Similar to Engineer | PASS | Semantic similarity with embedding vectors |
| 14 | Embedding Results Sorted by Score | PASS | Descending score ordering |
| 15 | Embedding Respects Limit | PASS | Limit parameter honored |
| 16 | Invalid Method Returns 400 | PASS | Invalid method rejected |
| 17 | TF-IDF Default Method | PASS | Default method is tfidf |
| 18 | Embedding Search Returns Semantic Matches | PASS | Engineers with embeddings found |
| 19 | Embedding Semantic Synonym (K8s → Kubernetes) | PASS | Semantic matching across synonyms |
| 20 | Embedding Similar to Engineer (With Embeddings) | PASS | Find similar engineers via embedding vectors |
| 21 | Hybrid Search Basic | PASS | Boolean filter + semantic ranking |
| 22 | Hybrid Search with Required Terms | PASS | AND filter on required terms |
| 23 | Hybrid Search Non-Existent Required Term | PASS | Empty results when filter matches nothing |
| 24 | Hybrid Similar to Engineer | PASS | Hybrid method with engineer reference |
| 25 | Hybrid Search Performance | PASS | Execution under 500ms |
| **26** | **Embedding Search Returns Skill Similarity** | **PASS** | **Skill embedding similarity fields present** |
| **27** | **Combined Score Formula** | **PASS** | **0.5 * profile + 0.5 * skill = contentScore** |
| **28** | **Hybrid Search Includes Skill Similarity** | **PASS** | **Hybrid method also includes skill fields** |
| 29 | Resume Upload Generates Embedding | PASS | 1024-dimensional embedding created |
| 30 | Update Existing Engineer | PASS | Resume update for existing engineer |
| 31 | Invalid Request (Resume Upload) | PASS | 400 error for invalid resume upload |

---

## Content Search Tests

### Test 1: Basic Keyword Search

#### Request
```json
POST /api/search/content
{
  "queryText": "React TypeScript frontend developer",
  "limit": 10,
  "offset": 0
}
```

#### Expected Behavior
- Returns 200 OK with valid response structure
- Response includes `matches`, `totalCount`, `searchMethod`, and `queryMetadata`
- Search method should be "tfidf"
- Query metadata includes execution time, documents searched, and query terms

#### Assertions Verified
- Status code is 200: **PASS**
- Response has required fields: **PASS**
- Search method is tfidf: **PASS**
- Query metadata has execution info: **PASS**

#### Notes
TF-IDF search tokenizes the query, removes stop words, and matches against resume text. The system searched 117 documents and found engineers with matching terms. Query terms are normalized before matching.

---

### Test 2: Results Have Matching Terms

#### Request
```json
POST /api/search/content
{
  "queryText": "Python Django backend API",
  "limit": 5,
  "offset": 0
}
```

#### Expected Behavior
- Each match includes `contentScore` and `contentScoreBreakdown`
- Score breakdown includes `tfidfScore` and `tfidfMatchingTerms`
- Matching terms should be relevant to the query

#### Assertions Verified
- Status code is 200: **PASS**
- Each match has content score breakdown: **PASS**
- Matching terms are relevant to query: **PASS**

#### Notes
The matching terms array provides transparency into exactly which terms contributed to each engineer's score. Engineers matching all four terms (django, backend, python, api) rank highest.

---

### Test 3: Results Ranked by Relevance

#### Request
```json
POST /api/search/content
{
  "queryText": "Kubernetes Docker DevOps infrastructure",
  "limit": 10,
  "offset": 0
}
```

#### Expected Behavior
- Results sorted by content score in descending order
- All scores between 0 and 1

#### Assertions Verified
- Status code is 200: **PASS**
- Results are sorted by score descending: **PASS**
- Content scores are between 0 and 1: **PASS**

#### Notes
Even when engineers match the same terms, their TF-IDF scores differ based on term frequency in their resumes and document-level weighting.

---

### Test 4: Similar to Engineer (TF-IDF)

#### Request
```json
POST /api/search/content
{
  "similarToEngineerId": "eng_priya",
  "limit": 5,
  "offset": 0
}
```

#### Expected Behavior
- Returns engineers similar to the reference engineer
- Reference engineer excluded from results
- Results sorted by similarity score

#### Assertions Verified
- Status code is 200: **PASS**
- Returns similar engineers: **PASS**
- Does not include target engineer in results: **PASS**

#### Notes
The TF-IDF similarity search extracts terms from Priya Sharma's resume text and uses them as a query. Engineers with similar backgrounds in backend engineering and fintech rank highest.

---

### Test 5: No Matches for Nonsense Query

#### Request
```json
POST /api/search/content
{
  "queryText": "xyzzynonexistentskillqwerty123",
  "limit": 10,
  "offset": 0
}
```

#### Expected Behavior
- Returns 200 OK (not an error)
- Empty matches array
- Total count of 0

#### Actual Response
```json
{
  "matches": [],
  "totalCount": 0,
  "searchMethod": "tfidf",
  "queryMetadata": {
    "executionTimeMs": 1,
    "documentsSearched": 117,
    "queryTerms": []
  }
}
```

#### Assertions Verified
- Status code is 200: **PASS**
- Returns empty results for nonsense query: **PASS**

#### Notes
The nonsense query produces no query terms after text normalization. The system gracefully returns an empty result set rather than an error.

---

### Test 6: Pagination with Limit

#### Request
```json
POST /api/search/content
{
  "queryText": "software engineer developer",
  "limit": 3,
  "offset": 0
}
```

#### Expected Behavior
- Returns at most `limit` matches
- Total count reflects all matching documents (may exceed returned count)

#### Assertions Verified
- Status code is 200: **PASS**
- Respects limit parameter: **PASS**
- Total count may exceed returned matches: **PASS**

#### Notes
The query matches many engineers but only returns 3 due to the limit parameter.

---

### Test 7: Match Fields Present

#### Request
```json
POST /api/search/content
{
  "queryText": "backend developer API",
  "limit": 5,
  "offset": 0
}
```

#### Expected Behavior
- Each match contains all required fields: id, name, headline, salary, yearsExperience, timezone, contentScore, contentScoreBreakdown

#### Assertions Verified
- Status code is 200: **PASS**
- Each match has required fields: **PASS**

---

### Test 8: Invalid Request (Missing Required Fields)

#### Request
```json
POST /api/search/content
{
  "limit": 10,
  "offset": 0
}
```

#### Expected Behavior
- Returns 400 Bad Request
- Error message indicates missing field

#### Actual Response
```json
{
  "success": false,
  "error": {
    "issues": [
      {
        "code": "custom",
        "path": [],
        "message": "Either queryText or similarToEngineerId must be provided"
      }
    ],
    "name": "ZodError"
  }
}
```

#### Assertions Verified
- Status code is 400: **PASS**
- Error message indicates missing field: **PASS**

---

### Test 9: More Keyword Matches = Higher Rank

#### Request
```json
POST /api/search/content
{
  "queryText": "Python Django backend API",
  "limit": 10,
  "offset": 0
}
```

#### Expected Behavior
- Engineers matching more query terms rank higher
- Top match has more or equal matching terms than last match

#### Assertions Verified
- Status code is 200: **PASS**
- Top result matches more terms than lower results: **PASS**
- Top match has higher score than last match: **PASS**

---

### Test 10: Rare Terms Boost Relevance More Than Common Terms

#### Request
```json
POST /api/search/content
{
  "queryText": "Python Django backend API",
  "limit": 20,
  "offset": 0
}
```

#### Expected Behavior
- Engineers with rare terms (e.g., "django") score higher than those without
- Common terms (e.g., "backend", "api") appear in more results
- IDF weighting gives more weight to discriminating terms

#### Assertions Verified
- Status code is 200: **PASS**
- Engineers with rare term (django) score higher than those without: **PASS**
- Common terms (backend, api) appear in many results: **PASS**

#### Notes
"Django" is a rarer term than "backend" or "api" in the corpus. Engineers matching "django" consistently outrank engineers matching only common terms. This demonstrates the IDF component boosting discriminating terms.

---

### Test 11: Embedding Search Basic

#### Request
```json
POST /api/search/content
{
  "queryText": "Full stack developer cloud experience",
  "method": "embedding",
  "limit": 10
}
```

#### Expected Behavior
- Returns 200 with semantic matches
- Search method is "embedding"
- Returns engineers based on semantic similarity

#### Assertions Verified
- Status code is 200 or 500: **PASS** (200)
- Search method is embedding: **PASS**
- Returns matching engineers: **PASS**

#### Notes
The embedding search converts the query to a 1024-dimensional vector and finds engineers with semantically similar resume embeddings. Full stack developers rank highest for this query.

---

### Test 12: Embedding Search Has Score Breakdown

#### Request
```json
POST /api/search/content
{
  "queryText": "Machine learning Python data science",
  "method": "embedding",
  "limit": 5
}
```

#### Expected Behavior
- Each match includes `profileEmbeddingScore` in the breakdown

#### Assertions Verified
- Status code is 200 or 500: **PASS**
- Each match has profileEmbeddingScore: **PASS**

#### Notes
The ML/data science query correctly surfaces ML engineers. Olivia Martinez (Senior ML Engineer | NLP & Python) ranks highest, followed by other ML specialists. The embedding model understands the semantic relationship between the query and ML-focused resumes.

---

### Test 13: Embedding Similar to Engineer

#### Request
```json
POST /api/search/content
{
  "similarToEngineerId": "eng_priya",
  "method": "embedding",
  "limit": 5
}
```

#### Expected Behavior
- Returns engineers semantically similar to the reference engineer's resume
- Reference engineer excluded from results
- Uses embedding vectors for similarity comparison

#### Assertions Verified
- Status code is 200, 404, or 500: **PASS** (200)
- Does not include target engineer: **PASS**
- Search method is embedding: **PASS**

#### Notes
Priya Sharma (Senior Backend Engineer | Fintech & Payments) is used as the reference. Her most similar engineers by embedding are other senior/staff backend engineers with Java and distributed systems expertise.

---

### Test 14: Embedding Results Sorted by Score

#### Request
```json
POST /api/search/content
{
  "queryText": "Backend engineer distributed systems",
  "method": "embedding",
  "limit": 10
}
```

#### Expected Behavior
- Results sorted by embedding score in descending order

#### Assertions Verified
- Status code is 200 or 500: **PASS**
- Results are sorted by score descending: **PASS**

---

### Test 15: Embedding Respects Limit

#### Request
```json
POST /api/search/content
{
  "queryText": "Software engineer",
  "method": "embedding",
  "limit": 3
}
```

#### Expected Behavior
- Returns at most `limit` matches

#### Assertions Verified
- Status code is 200 or 500: **PASS**
- Respects limit parameter: **PASS**

---

### Test 16: Invalid Method Returns 400

#### Request
```json
POST /api/search/content
{
  "queryText": "test query",
  "method": "invalid_method",
  "limit": 10
}
```

#### Expected Behavior
- Returns 400 Bad Request for invalid search method
- Error message indicates invalid option

#### Actual Response
```json
{
  "success": false,
  "error": {
    "issues": [
      {
        "code": "invalid_value",
        "values": ["tfidf", "embedding", "hybrid"],
        "path": ["method"],
        "message": "Invalid option: expected one of \"tfidf\"|\"embedding\"|\"hybrid\""
      }
    ],
    "name": "ZodError"
  }
}
```

#### Assertions Verified
- Status code is 400: **PASS**
- Error response has expected structure: **PASS**

---

### Test 17: TF-IDF Default Method

#### Request
```json
POST /api/search/content
{
  "queryText": "Python developer",
  "limit": 5
}
```

#### Expected Behavior
- When method is omitted, defaults to "tfidf"

#### Assertions Verified
- Status code is 200: **PASS**
- Default method is tfidf: **PASS**

---

### Test 18: Embedding Search Returns Semantic Matches

#### Request
```json
POST /api/search/content
{
  "queryText": "Backend engineer with distributed systems experience",
  "method": "embedding",
  "limit": 10
}
```

#### Expected Behavior
- Returns 200 with engineers that have embeddings
- Each match includes numeric embedding score
- Results semantically match the query

#### Assertions Verified
- Status code is 200: **PASS**
- Returns engineers with embeddings: **PASS**
- Each match has embedding score: **PASS**

#### Notes
The query "Backend engineer with distributed systems experience" correctly surfaces backend engineers. The embedding model captures the semantic meaning of "distributed systems" beyond keyword matching.

---

### Test 19: Embedding Semantic Synonym (K8s → Kubernetes)

#### Request
```json
POST /api/search/content
{
  "queryText": "K8s container orchestration cloud native",
  "method": "embedding",
  "limit": 10
}
```

#### Expected Behavior
- "K8s" query finds engineers with "Kubernetes" experience (semantic synonym)
- Demonstrates embedding's ability to understand technical abbreviations
- Returns relevant DevOps/Platform engineers

#### Assertions Verified
- Status code is 200: **PASS**
- K8s query finds engineers: **PASS**
- Compare: TF-IDF may miss K8s synonym: **PASS**

#### Notes
**This test demonstrates a key advantage of embedding search over TF-IDF.** The query uses "K8s" (common abbreviation) but finds engineers with "Kubernetes" in their profiles. TF-IDF would only find exact "K8s" matches, missing the semantic equivalence. The embedding model understands that K8s = Kubernetes.

---

### Test 20: Embedding Similar to Engineer (With Embeddings)

#### Request
```json
POST /api/search/content
{
  "similarToEngineerId": "eng_priya",
  "method": "embedding",
  "limit": 5
}
```

#### Expected Behavior
- Returns engineers semantically similar to Priya Sharma
- Target engineer excluded from results
- Results include embedding scores

#### Assertions Verified
- Status code is 200: **PASS**
- Returns similar engineers: **PASS**
- Target engineer excluded from results: **PASS**
- Similar engineers have embedding scores: **PASS**

---

### Test 21: Hybrid Search Basic

#### Request
```json
POST /api/search/content
{
  "queryText": "React developer with AWS experience",
  "method": "hybrid",
  "limit": 10
}
```

#### Expected Behavior
- Search method is "hybrid"
- Returns matching engineers
- Response includes `candidatesAfterBooleanFilter` metadata
- Each match has `profileEmbeddingScore` (hybrid ranks by embedding)
- Each match has `tfidfMatchingTerms` (for explainability)

#### Assertions Verified
- Status code is 200: **PASS**
- Search method is hybrid: **PASS**
- Returns matching engineers: **PASS**
- Response has hybrid-specific metadata: **PASS**
- Each match has profileEmbeddingScore: **PASS**
- Each match has tfidfMatchingTerms: **PASS**

#### Notes
Hybrid search combines boolean filtering (TF-IDF inverted index) with semantic ranking (embeddings). First, candidates are filtered to those containing query terms, then ranked by embedding similarity.

---

### Test 22: Hybrid Search with Required Terms (Boolean Filter)

#### Request
```json
POST /api/search/content
{
  "queryText": "React developer with AWS experience",
  "method": "hybrid",
  "requiredTerms": ["react", "aws"],
  "limit": 10
}
```

#### Expected Behavior
- Boolean filter reduces candidate count
- `requiredTerms` echoed in response
- All matches have both required terms
- Results ranked by embedding similarity

#### Assertions Verified
- Status code is 200: **PASS**
- Boolean filter reduced candidate count: **PASS**
- requiredTerms echoed in response: **PASS**
- All matches have both required terms in their matching terms: **PASS**
- Results ranked by embedding similarity: **PASS**

---

### Test 23: Hybrid Search with Non-Existent Required Term

#### Request
```json
POST /api/search/content
{
  "queryText": "Machine learning engineer",
  "method": "hybrid",
  "requiredTerms": ["xyznonexistenttermqwerty"],
  "limit": 10
}
```

#### Expected Behavior
- Returns 200 OK (not an error)
- Empty results when boolean filter matches nothing
- `candidatesAfterBooleanFilter` is 0

#### Assertions Verified
- Status code is 200: **PASS**
- Returns empty results when boolean filter matches nothing: **PASS**
- candidatesAfterBooleanFilter is 0: **PASS**
- Search method is still hybrid: **PASS**

---

### Test 24: Hybrid Similar to Engineer

#### Request
```json
POST /api/search/content
{
  "similarToEngineerId": "eng_priya",
  "method": "hybrid",
  "limit": 10
}
```

#### Expected Behavior
- Search method is hybrid
- Returns similar engineers
- Target engineer excluded from results
- Results have embedding scores
- Results have TF-IDF matching terms for explainability

#### Assertions Verified
- Status code is 200: **PASS**
- Search method is hybrid: **PASS**
- Returns similar engineers: **PASS**
- Target engineer excluded from results: **PASS**
- Results have embedding scores: **PASS**
- Results have TF-IDF matching terms for explainability: **PASS**

---

### Test 25: Hybrid Search Performance Under 500ms

#### Request
```json
POST /api/search/content
{
  "queryText": "Senior distributed systems engineer with Kafka and microservices experience",
  "method": "hybrid",
  "limit": 20
}
```

#### Expected Behavior
- Execution time under 500ms
- Response time under 1 second

#### Assertions Verified
- Status code is 200: **PASS**
- Execution time under 500ms: **PASS**
- Response time under 1 second: **PASS**

---

## Skill Embedding Similarity Tests (NEW)

### Test 26: Embedding Search Returns Skill Similarity Fields

#### Request
```json
POST /api/search/content
{
  "similarToEngineerId": "eng_priya",
  "method": "embedding",
  "limit": 5
}
```

#### Expected Behavior
- Response includes skill embedding similarity fields in `contentScoreBreakdown`:
  - `skillEmbeddingSimilarity`: Centroid similarity of all skills (0-1)
  - `recentSkillEmbeddingSimilarity`: Centroid similarity of skills used in last 3 years (0-1)
  - `skillCount`: Number of skills included in all-time calculation
  - `recentSkillCount`: Number of recent skills included
- Skill similarity scores are between 0 and 1
- Skill counts are non-negative integers

#### Actual Response
```json
{
  "matches": [
    {
      "id": "eng_takeshi",
      "name": "Takeshi Yamamoto",
      "headline": "Senior Backend Engineer | Java & Distributed Systems",
      "salary": 175000,
      "yearsExperience": 7,
      "timezone": "Pacific",
      "contentScore": 0.933280802250505,
      "contentScoreBreakdown": {
        "profileEmbeddingScore": 0.9064698219299316,
        "skillEmbeddingSimilarity": 0.9600917825710785,
        "recentSkillEmbeddingSimilarity": 0.9424814472894876,
        "skillCount": 9,
        "recentSkillCount": 5
      }
    },
    {
      "id": "eng_alex",
      "name": "Alex Rivera",
      "headline": "Staff Backend Engineer | Java & System Design",
      "salary": 210000,
      "yearsExperience": 9,
      "timezone": "Eastern",
      "contentScore": 0.929025174470739,
      "contentScoreBreakdown": {
        "profileEmbeddingScore": 0.9069209098815918,
        "skillEmbeddingSimilarity": 0.9511294390598862,
        "recentSkillEmbeddingSimilarity": 0.9260477825055917,
        "skillCount": 8,
        "recentSkillCount": 5
      }
    },
    {
      "id": "eng_anika",
      "name": "Anika Patel",
      "headline": "Staff Platform Engineer | Kafka, Kubernetes & Distributed Systems",
      "salary": 220000,
      "yearsExperience": 10,
      "timezone": "Pacific",
      "contentScore": 0.9254202751148439,
      "contentScoreBreakdown": {
        "profileEmbeddingScore": 0.8943076133728027,
        "skillEmbeddingSimilarity": 0.9565329368568852,
        "recentSkillEmbeddingSimilarity": 0.9484028036422644,
        "skillCount": 10,
        "recentSkillCount": 7
      }
    },
    {
      "id": "eng_james",
      "name": "James Okonkwo",
      "headline": "Staff Engineer | Distributed Systems",
      "salary": 295000,
      "yearsExperience": 12,
      "timezone": "Eastern",
      "contentScore": 0.9225674785500811,
      "contentScoreBreakdown": {
        "profileEmbeddingScore": 0.8857898712158203,
        "skillEmbeddingSimilarity": 0.959345085884342,
        "recentSkillEmbeddingSimilarity": 0.940993722647585,
        "skillCount": 12,
        "recentSkillCount": 9
      }
    },
    {
      "id": "eng_christine",
      "name": "Christine Kim",
      "headline": "Staff Full Stack Engineer | Healthcare & Fintech",
      "salary": 205000,
      "yearsExperience": 9,
      "timezone": "Pacific",
      "contentScore": 0.9175957805128605,
      "contentScoreBreakdown": {
        "profileEmbeddingScore": 0.8910186290740967,
        "skillEmbeddingSimilarity": 0.9441729319516243,
        "recentSkillEmbeddingSimilarity": 0.9359003042918419,
        "skillCount": 10,
        "recentSkillCount": 6
      }
    }
  ],
  "totalCount": 50,
  "searchMethod": "embedding",
  "queryMetadata": {
    "executionTimeMs": 7,
    "documentsSearched": 50,
    "queryTerms": []
  }
}
```

#### Assertions Verified
- Status code is 200: **PASS**
- Response includes skill embedding similarity fields: **PASS**
- Skill similarity scores are between 0 and 1: **PASS**
- Skill counts are non-negative integers: **PASS**

#### Notes
**This test verifies the new skill embedding similarity feature.** Each match now includes four new fields:

1. **`skillEmbeddingSimilarity`**: Cosine similarity between the centroid of the candidate's skill embeddings and the target engineer's skill embeddings. Takeshi Yamamoto (0.960) has the highest skill similarity to Priya.

2. **`recentSkillEmbeddingSimilarity`**: Same calculation but only including skills used within the last 3 years. This helps identify engineers who are *currently* working with similar technologies.

3. **`skillCount`**: Total number of skills with embeddings for this candidate (e.g., James Okonkwo has 12 skills).

4. **`recentSkillCount`**: Number of skills used recently (e.g., James has 9 recent skills out of 12 total).

The skill embedding similarity provides a **complementary signal** to the profile embedding. While profile embeddings capture overall experience and seniority from resume text, skill embeddings provide an isolated technical signal based on canonical skill names.

---

### Test 27: Content Score is Combined Profile and Skill Embedding

#### Request
```json
POST /api/search/content
{
  "similarToEngineerId": "eng_priya",
  "method": "embedding",
  "limit": 5
}
```

#### Expected Behavior
- Combined content score follows the formula: `0.5 * profileEmbeddingScore + 0.5 * skillEmbeddingSimilarity`
- This 50/50 weighting treats profile similarity and skill similarity as equally valuable

#### Verification (Example from Takeshi Yamamoto)
```
profileEmbeddingScore:           0.9064698219299316
skillEmbeddingSimilarity: 0.9600917825710785

Expected contentScore:    0.5 * 0.9064698219299316 + 0.5 * 0.9600917825710785
                        = 0.4532349109649658 + 0.4800458912855392
                        = 0.933280802250505

Actual contentScore:      0.933280802250505 ✓
```

#### Assertions Verified
- Status code is 200: **PASS**
- Content score is approximately combined score (0.5 * profile + 0.5 * skill): **PASS**

#### Notes
The combined scoring model weights profile embedding and skill embedding equally (50/50). This is a deliberate design choice:

- **Profile embedding** captures overall experience, seniority, work history narrative
- **Skill embedding** captures isolated technical fit via canonical skill names

Equal weighting means both signals contribute equally to the final ranking. The weights could be tuned based on feedback, but equal weighting is a reasonable starting point for technical role matching.

**Re-ranking effect**: Engineers are now ranked by combined score rather than just profile embedding score. Notice that the order changed from the previous tests - Takeshi Yamamoto now ranks #1 (was #2) because his skill similarity (0.960) is higher than Alex Rivera's (0.951), even though Alex had a slightly higher profile embedding score.

---

### Test 28: Hybrid Search Also Includes Skill Similarity

#### Request
```json
POST /api/search/content
{
  "similarToEngineerId": "eng_priya",
  "method": "hybrid",
  "limit": 5
}
```

#### Expected Behavior
- Hybrid search includes all skill similarity fields
- Also includes TF-IDF matching terms for explainability

#### Actual Response
```json
{
  "matches": [
    {
      "id": "eng_takeshi",
      "name": "Takeshi Yamamoto",
      "headline": "Senior Backend Engineer | Java & Distributed Systems",
      "salary": 175000,
      "yearsExperience": 7,
      "timezone": "Pacific",
      "contentScore": 0.933280802250505,
      "contentScoreBreakdown": {
        "profileEmbeddingScore": 0.9064698219299316,
        "tfidfMatchingTerms": ["kafka", "capital", "one", "apis", "design"],
        "skillEmbeddingSimilarity": 0.9600917825710785,
        "recentSkillEmbeddingSimilarity": 0.9424814472894876,
        "skillCount": 9,
        "recentSkillCount": 5
      }
    },
    {
      "id": "eng_alex",
      "name": "Alex Rivera",
      "headline": "Staff Backend Engineer | Java & System Design",
      "salary": 210000,
      "yearsExperience": 9,
      "timezone": "Eastern",
      "contentScore": 0.929025174470739,
      "contentScoreBreakdown": {
        "profileEmbeddingScore": 0.9069209098815918,
        "tfidfMatchingTerms": ["design", "kafka", "backend", "system", "leadership"],
        "skillEmbeddingSimilarity": 0.9511294390598862,
        "recentSkillEmbeddingSimilarity": 0.9260477825055917,
        "skillCount": 8,
        "recentSkillCount": 5
      }
    },
    {
      "id": "eng_anika",
      "name": "Anika Patel",
      "headline": "Staff Platform Engineer | Kafka, Kubernetes & Distributed Systems",
      "salary": 220000,
      "yearsExperience": 10,
      "timezone": "Pacific",
      "contentScore": 0.9254202751148439,
      "contentScoreBreakdown": {
        "profileEmbeddingScore": 0.8943076133728027,
        "tfidfMatchingTerms": ["kafka", "payment", "stripe", "50m", "design"],
        "skillEmbeddingSimilarity": 0.9565329368568852,
        "recentSkillEmbeddingSimilarity": 0.9484028036422644,
        "skillCount": 10,
        "recentSkillCount": 7
      }
    },
    {
      "id": "eng_james",
      "name": "James Okonkwo",
      "headline": "Staff Engineer | Distributed Systems",
      "salary": 295000,
      "yearsExperience": 12,
      "timezone": "Eastern",
      "contentScore": 0.9225674785500811,
      "contentScoreBreakdown": {
        "profileEmbeddingScore": 0.8857898712158203,
        "tfidfMatchingTerms": ["banking", "50m", "kafka", "architected", "daily"],
        "skillEmbeddingSimilarity": 0.959345085884342,
        "recentSkillEmbeddingSimilarity": 0.940993722647585,
        "skillCount": 12,
        "recentSkillCount": 9
      }
    },
    {
      "id": "eng_christine",
      "name": "Christine Kim",
      "headline": "Staff Full Stack Engineer | Healthcare & Fintech",
      "salary": 205000,
      "yearsExperience": 9,
      "timezone": "Pacific",
      "contentScore": 0.9175957805128605,
      "contentScoreBreakdown": {
        "profileEmbeddingScore": 0.8910186290740967,
        "tfidfMatchingTerms": ["fintech", "handling", "software", "engineer", "daily"],
        "skillEmbeddingSimilarity": 0.9441729319516243,
        "recentSkillEmbeddingSimilarity": 0.9359003042918419,
        "skillCount": 10,
        "recentSkillCount": 6
      }
    }
  ],
  "totalCount": 50,
  "searchMethod": "hybrid",
  "queryMetadata": {
    "executionTimeMs": 14,
    "documentsSearched": 116,
    "requiredTerms": [],
    "candidatesAfterBooleanFilter": 116
  }
}
```

#### Assertions Verified
- Status code is 200: **PASS**
- Hybrid search includes skill similarity fields: **PASS**

#### Notes
Hybrid search now provides the most comprehensive breakdown:
- **`profileEmbeddingScore`**: Profile embedding similarity (semantic overall match)
- **`tfidfMatchingTerms`**: Keyword overlap for explainability ("why this match?")
- **`skillEmbeddingSimilarity`**: Technical skill centroid similarity
- **`recentSkillEmbeddingSimilarity`**: Recent skills centroid similarity
- **`skillCount`** / **`recentSkillCount`**: Skill counts for context

The combination of TF-IDF matching terms plus skill similarity counts provides excellent explainability. A recruiter can see "this engineer matches on kafka, capital one, and design" (keyword level) plus "they share 96% skill similarity with Priya" (semantic level).

---

## Resume Upload Tests

### Test 29: Resume Upload Generates Embedding

#### Request
```json
POST /api/resume/upload
{
  "engineerId": "eng_james",
  "resumeText": "Staff Engineer with 12 years experience in distributed systems, Java, Kafka, and system design.",
  "skipFeatureExtraction": true,
  "generateVectors": ["embedding"]
}
```

#### Expected Behavior
- Returns 200 OK
- Response includes embedding vector metadata
- Embedding has 1024 dimensions

#### Actual Response
```json
{
  "engineerId": "eng_james",
  "isNewEngineer": false,
  "vectors": {
    "embedding": {
      "dimensions": 1024
    }
  }
}
```

#### Assertions Verified
- Status code is 200: **PASS**
- Response includes embedding vector info: **PASS**

#### Notes
The resume upload endpoint can generate embeddings on-demand using the `generateVectors` parameter. The embedding is created using the mxbai-embed-large model via Ollama, producing a 1024-dimensional vector that captures the semantic meaning of the resume text.

---

### Test 30: Update Existing Engineer (Skip Feature Extraction)

#### Request
```json
POST /api/resume/upload
{
  "engineerId": "eng_james",
  "resumeText": "JAMES OKONKWO\njames.okonkwo@email.com | (202) 555-0134 | Washington, DC\n\nSUMMARY\nStaff Engineer with 12 years of experience...",
  "skipFeatureExtraction": true
}
```

#### Expected Behavior
- Returns 200 OK for existing engineer
- Response includes `engineerId` matching input
- `isNewEngineer` is false

#### Actual Response
```json
{
  "engineerId": "eng_james",
  "isNewEngineer": false
}
```

#### Assertions Verified
- Status code is 200: **PASS**
- Response indicates existing engineer updated: **PASS**

---

### Test 31: Invalid Request (Resume Upload - Missing Required Fields)

#### Request
```json
POST /api/resume/upload
{
  "resumeText": "Some resume text without engineerId or name/email"
}
```

#### Expected Behavior
- Returns 400 Bad Request
- Error message indicates missing identifier

#### Actual Response
```json
{
  "success": false,
  "error": {
    "issues": [
      {
        "code": "custom",
        "path": [],
        "message": "Either engineerId (for update) or both name and email (for create) must be provided"
      }
    ],
    "name": "ZodError"
  }
}
```

#### Assertions Verified
- Status code is 400: **PASS**
- Error message indicates missing field: **PASS**

---

## Summary

All 31 tests and 92 assertions passed successfully. The Content Search API correctly implements:

### TF-IDF Search (Tests 1-10, 17)
- Full-text keyword search with term frequency-inverse document frequency scoring
- Score transparency with matching terms breakdown
- IDF weighting that boosts rare/discriminating terms
- Similar engineer search using reference resume text

### Embedding Search (Tests 11-15, 18-20)
- **Semantic similarity search** using 1024-dimensional mxbai-embed-large vectors
- **Synonym understanding**: "K8s" query finds "Kubernetes" engineers (Test 19)
- **Similar engineer discovery** via embedding vector comparison (Test 20)
- Engineers with embeddings are searched via Neo4j vector index

### Hybrid Search (Tests 21-25)
- **Boolean filtering** via TF-IDF inverted index (required terms)
- **Semantic ranking** via embedding similarity
- **Explainability** via TF-IDF matching terms
- Sub-500ms performance even with complex queries

### Skill Embedding Similarity (Tests 26-28) - NEW
- **Skill centroid comparison** using 1024-dimensional skill embeddings
- **Recency-aware similarity** distinguishes current vs historical skills
- **Combined scoring**: 0.5 * profileEmbedding + 0.5 * skillSimilarity
- **Re-ranking** based on combined technical + experiential fit
- Available in both embedding and hybrid search methods

### Resume Upload (Tests 29-31)
- Update existing engineers with new resume text
- **On-demand embedding generation** via `generateVectors` parameter (Test 29)
- Clear validation errors for invalid requests

### Key Skill Embedding Capabilities Demonstrated

| Metric | Description | Example |
|--------|-------------|---------|
| `skillEmbeddingSimilarity` | Centroid cosine similarity of all skills | Takeshi: 0.960 (very similar to Priya) |
| `recentSkillEmbeddingSimilarity` | Same but only skills used in last 3 years | Takeshi: 0.942 (still high, uses similar tech) |
| `skillCount` | Total skills with embeddings | James: 12 skills |
| `recentSkillCount` | Skills used recently | James: 9 of 12 are recent |

### Re-Ranking Effect

The skill embedding similarity re-ranks engineers based on combined score. Before:
- #1 Alex Rivera (profileEmbeddingScore: 0.907)
- #2 Takeshi Yamamoto (profileEmbeddingScore: 0.906)

After skill similarity:
- #1 Takeshi Yamamoto (combined: 0.933, skill: 0.960)
- #2 Alex Rivera (combined: 0.929, skill: 0.951)

Takeshi moved up because his skill profile is more similar to Priya's, even though his profile embedding was slightly lower. This demonstrates how skill embeddings provide a complementary signal that can improve technical role matching.
