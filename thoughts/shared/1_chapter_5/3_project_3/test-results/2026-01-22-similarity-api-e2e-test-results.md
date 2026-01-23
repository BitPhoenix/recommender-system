# Similarity API E2E Test Results

**Date**: 2026-01-22
**Endpoint**: `GET /api/engineers/:id/similar`
**Test Framework**: Newman (Postman CLI)
**Total Tests**: 8
**Total Assertions**: 30
**Result**: All passing (30/30 assertions)

---

## Test Summary

| Test # | Name | Status | Response Time | Key Verification |
|--------|------|--------|---------------|------------------|
| 01 | Basic Similarity Request | PASS | 116ms | Returns 5 similar engineers with full structure |
| 02 | Custom Limit Parameter | PASS | 64ms | Respects limit=3 query parameter |
| 03 | Non-existent Engineer Returns 404 | PASS | 7ms | Returns ENGINEER_NOT_FOUND error |
| 04 | Invalid Limit (Too High) | PASS | 3ms | Returns 400 for limit=100 (max is 20) |
| 05 | Invalid Limit (Zero) | PASS | 3ms | Returns 400 for limit=0 (min is 1) |
| 06 | Maximum Limit | PASS | 147ms | Returns up to 20 results |
| 07 | Similar to Staff Engineer | PASS | 16ms | Validates breakdown scores and exclusion |
| 08 | Shared Skills Populated | PASS | 41ms | Verifies sharedSkills and correlatedSkills arrays |

---

## Test 01: Basic Similarity Request

### Request
```
GET /api/engineers/eng_priya/similar
```

### Expected Behavior
- Returns the target engineer (Priya Sharma) with full profile data
- Returns 5 similar engineers (default limit)
- Each result includes similarity score and multi-dimensional breakdown
- Results are sorted by similarity score descending
- First result has the highest similarity score

### Actual Response (key fields)

**Target Engineer:**
```json
{
  "id": "eng_priya",
  "name": "Priya Sharma",
  "headline": "Senior Backend Engineer | Fintech & Payments",
  "yearsExperience": 8,
  "timezone": "Eastern",
  "skills": ["TypeScript", "Node.js", "PostgreSQL", "API Design", "System Design", "Microservices Architecture", "AWS", "Kafka", "Technical Leadership", "Mentorship"],
  "businessDomains": ["Fintech (6 years)", "Payments (4 years)"],
  "technicalDomains": ["Backend (8 years)", "API Development (6 years)"]
}
```

**Top Similar Engineers:**

| Rank | Engineer | Score | Skills | Experience | Domain | Timezone |
|------|----------|-------|--------|------------|--------|----------|
| 1 | Alex Rivera | 0.80 | 0.70 | 0.98 | 0.73 | 1.00 |
| 2 | Sanjay Gupta | 0.73 | 0.78 | 0.95 | 0.47 | 0.33 |
| 3 | Ravi Sharma | 0.68 | 0.75 | 1.00 | 0.15 | 0.67 |
| 4 | Hassan Ahmed | 0.61 | 0.51 | 0.93 | 0.31 | 1.00 |
| 5 | Jennifer Park | 0.56 | 0.58 | 0.98 | 0.00 | 0.67 |

**Top Match Details (Alex Rivera):**
```json
{
  "engineer": {
    "id": "eng_alex",
    "name": "Alex Rivera",
    "headline": "Staff Backend Engineer | Java & System Design",
    "yearsExperience": 9,
    "timezone": "Eastern"
  },
  "similarityScore": 0.80,
  "breakdown": {
    "skills": 0.70,
    "yearsExperience": 0.98,
    "domain": 0.73,
    "timezone": 1.00
  },
  "sharedSkills": ["Mentorship", "Kafka", "System Design", "API Design", "PostgreSQL"],
  "correlatedSkills": []
}
```

### Assertions Verified
- Status code is 200: PASS
- Response has required top-level fields: PASS
- Target engineer has correct ID: PASS
- Target engineer has required fields: PASS
- Similar results have required fields: PASS
- Similarity scores are between 0 and 1: PASS
- Breakdown has all dimensions: PASS
- First result has highest similarity score: PASS
- Default limit returns 5 results: PASS

### Notes
- Alex Rivera is the best match with 0.80 similarity score, driven by:
  - Same timezone (Eastern) = 1.00 timezone score
  - Nearly identical experience (9 vs 8 years) = 0.98 experience score
  - Shared Fintech/Banking domain expertise = 0.73 domain score
  - 5 shared skills including backend fundamentals (Kafka, PostgreSQL, API Design)
- Diversity selection may reorder results 2-5 while keeping the top match first

---

## Test 02: Custom Limit Parameter

### Request
```
GET /api/engineers/eng_marcus/similar?limit=3
```

### Expected Behavior
- Respects the limit query parameter
- Returns exactly 3 similar engineers
- Target is Marcus Chen (Full Stack Engineer)

### Actual Response (key fields)

**Target Engineer:**
```json
{
  "id": "eng_marcus",
  "name": "Marcus Chen",
  "headline": "Full Stack Engineer | React & Node.js",
  "yearsExperience": 5,
  "timezone": "Pacific"
}
```

**Similar Engineers (limit=3):**

| Rank | Engineer | Score | Shared Skills |
|------|----------|-------|---------------|
| 1 | Zoe Martinez | 0.85 | TypeScript, React, Node.js, PostgreSQL, Docker, GraphQL, Ownership, Continuous Learning |
| 2 | Lisa Wang | 0.65 | Docker, PostgreSQL |
| 3 | Maya Johnson | 0.64 | TypeScript, React, Next.js, Continuous Learning |

### Assertions Verified
- Status code is 200: PASS
- Target engineer is eng_marcus: PASS
- Returns exactly 3 results: PASS

### Notes
- Zoe Martinez is the top match (0.85) with 8 shared skills and identical experience/timezone
- Both are Pacific timezone, 5 years experience, Full Stack/SaaS focus
- The high number of shared skills (8) drives the strong match

---

## Test 03: Non-existent Engineer Returns 404

### Request
```
GET /api/engineers/nonexistent_id/similar
```

### Expected Behavior
- Returns 404 status code
- Returns structured error with ENGINEER_NOT_FOUND code

### Actual Response
```json
{
  "error": {
    "code": "ENGINEER_NOT_FOUND",
    "message": "Engineer not found: nonexistent_id"
  }
}
```

### Assertions Verified
- Status code is 404: PASS
- Response has error code: PASS

### Notes
- Clean error handling with descriptive message including the invalid ID

---

## Test 04: Invalid Limit (Too High)

### Request
```
GET /api/engineers/eng_priya/similar?limit=100
```

### Expected Behavior
- Returns 400 status code for limit exceeding maximum (20)
- Returns Zod validation error

### Actual Response
```json
{
  "success": false,
  "error": {
    "issues": [
      {
        "origin": "number",
        "code": "too_big",
        "maximum": 20,
        "inclusive": true,
        "path": ["limit"],
        "message": "Too big: expected number to be <=20"
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
- Zod schema enforces maximum limit of 20 to prevent expensive queries

---

## Test 05: Invalid Limit (Zero)

### Request
```
GET /api/engineers/eng_priya/similar?limit=0
```

### Expected Behavior
- Returns 400 status code for limit below minimum (1)
- Returns Zod validation error

### Actual Response
```json
{
  "success": false,
  "error": {
    "issues": [
      {
        "origin": "number",
        "code": "too_small",
        "minimum": 1,
        "inclusive": true,
        "path": ["limit"],
        "message": "Too small: expected number to be >=1"
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
- Zod schema enforces minimum limit of 1 to ensure meaningful results

---

## Test 06: Maximum Limit

### Request
```
GET /api/engineers/eng_sofia/similar?limit=20
```

### Expected Behavior
- Returns up to 20 results (the maximum allowed)
- Target is Sofia Rodriguez (Platform Engineer)

### Actual Response (key fields)

**Target Engineer:**
```json
{
  "id": "eng_sofia",
  "name": "Sofia Rodriguez",
  "headline": "Platform Engineer | Kubernetes & AWS",
  "yearsExperience": 7
}
```

**Results Summary:**
- Total results returned: 20
- Score range: 0.84 (highest) to 0.37 (lowest)

**Top 5 Similar Engineers:**

| Rank | Engineer | Score |
|------|----------|-------|
| 1 | Mohammed Ali | 0.84 |
| 2 | Lucas Thompson | 0.81 |
| 3 | Michael O'Connor | 0.79 |
| 4 | Elena Rodriguez | 0.78 |
| 5 | Hassan Ahmed | 0.77 |

### Assertions Verified
- Status code is 200: PASS
- Target engineer is eng_sofia: PASS
- Returns at most 20 results: PASS

### Notes
- With 40 engineers in the database and one excluded (target), 20 results represents significant coverage
- Top matches are other DevOps/Platform engineers with Kubernetes and cloud infrastructure expertise

---

## Test 07: Similar to Staff Engineer

### Request
```
GET /api/engineers/eng_james/similar
```

### Expected Behavior
- Returns engineers similar to James Okonkwo (Staff Engineer, 12 years experience)
- Target engineer does not appear in results
- Breakdown scores are valid (0-1 range for each dimension)

### Actual Response (key fields)

**Target Engineer:**
```json
{
  "id": "eng_james",
  "name": "James Okonkwo",
  "headline": "Staff Engineer | Distributed Systems",
  "yearsExperience": 12,
  "timezone": "Eastern",
  "skills": ["Distributed Systems", "System Design", "Java", "Spring Boot", "Kafka", "Event-Driven Architecture", "PostgreSQL", "Kubernetes", "Technical Leadership", "Mentorship", "Evaluating Tradeoffs", "Decision Making"],
  "businessDomains": ["Fintech (5 years)", "Banking (3 years)"],
  "technicalDomains": ["Backend (12 years)", "Distributed Systems (10 years)"]
}
```

**Top Similar Engineers:**

| Rank | Engineer | Score | Experience | Key Similarities |
|------|----------|-------|------------|------------------|
| 1 | Alex Rivera | 0.85 | 9 years | Java, Spring Boot, Kafka, PostgreSQL, System Design, Mentorship |
| 2 | Robert Mitchell | 0.67 | 15 years | System Design, Distributed Systems, PostgreSQL, Mentorship |
| 3 | Hassan Ahmed | 0.65 | 11 years | System Design, Kubernetes, Mentorship |
| 4 | Michael O'Connor | 0.51 | 11 years | System Design, Kubernetes |
| 5 | Tyler Brooks | 0.51 | 3 years | Java, Spring Boot |

**Top Match Details (Alex Rivera):**
```json
{
  "similarityScore": 0.85,
  "breakdown": {
    "skills": 0.86,
    "yearsExperience": 0.85,
    "domain": 0.77,
    "timezone": 1.00
  },
  "sharedSkills": ["Mentorship", "PostgreSQL", "Kafka", "Spring Boot", "Java", "System Design"],
  "correlatedSkills": [
    {"targetSkill": "Technical Leadership", "candidateSkill": "API Design", "strength": 0.70},
    {"targetSkill": "System Design", "candidateSkill": "API Design", "strength": 0.70},
    {"targetSkill": "Distributed Systems", "candidateSkill": "Debugging & Troubleshooting", "strength": 0.70}
  ]
}
```

### Assertions Verified
- Status code is 200: PASS
- Target engineer is eng_james: PASS
- Target does not appear in similar results: PASS
- Similarity breakdown sums correctly: PASS

### Notes
- Alex Rivera is the best match (0.85) with 6 shared skills and strong domain overlap (both Fintech/Banking)
- The correlatedSkills array shows skills that are related but not directly shared:
  - Technical Leadership correlates with API Design (0.70 strength)
  - System Design correlates with API Design (0.70 strength)
  - Distributed Systems correlates with Debugging & Troubleshooting (0.70 strength)
- Staff-level engineers match well due to shared senior technical skills (System Design, Mentorship)

---

## Test 08: Shared Skills Populated

### Request
```
GET /api/engineers/eng_emily/similar?limit=10
```

### Expected Behavior
- Returns engineers similar to Emily Nakamura (Frontend Engineer)
- Each result has sharedSkills array populated
- Each result has correlatedSkills array populated
- At least one result has shared skills

### Actual Response (key fields)

**Target Engineer:**
```json
{
  "id": "eng_emily",
  "name": "Emily Nakamura",
  "headline": "Frontend Engineer | React & Design Systems",
  "yearsExperience": 4,
  "timezone": "Pacific",
  "skills": ["React", "TypeScript", "Next.js", "GraphQL", "Unit Testing", "Attention to Detail", "Cross-Functional Collaboration", "Curiosity"]
}
```

**Similar Engineers with Skill Details:**

| Rank | Engineer | Score | Shared Skills | Correlated Skills |
|------|----------|-------|---------------|-------------------|
| 1 | Emma Wilson | 0.92 | React, TypeScript, Next.js, GraphQL, Unit Testing, Attention to Detail, Cross-Functional Collaboration | - |
| 2 | Sarah Johnson | 0.78 | React, TypeScript, Next.js, GraphQL, Unit Testing, Attention to Detail | TypeScript→JavaScript |
| 3 | Jordan Williams | 0.78 | React, TypeScript, Attention to Detail, Cross-Functional Collaboration | TypeScript→JavaScript, Curiosity→Continuous Learning |
| 4 | Ashley Chen | 0.72 | TypeScript, Attention to Detail, Curiosity | TypeScript→JavaScript, Curiosity→Continuous Learning |
| 5 | Jennifer Park | 0.67 | React, TypeScript, Next.js, GraphQL, Unit Testing | TypeScript→JavaScript |

**Top Match Details (Emma Wilson):**
```json
{
  "engineer": {
    "id": "eng_emma",
    "name": "Emma Wilson",
    "headline": "Frontend Engineer | React & Design Systems",
    "yearsExperience": 5,
    "timezone": "Mountain"
  },
  "similarityScore": 0.92,
  "breakdown": {
    "skills": 0.91,
    "yearsExperience": 0.98,
    "domain": 0.97,
    "timezone": 0.67
  },
  "sharedSkills": [
    "Cross-Functional Collaboration",
    "Attention to Detail",
    "Unit Testing",
    "GraphQL",
    "Next.js",
    "TypeScript",
    "React"
  ],
  "correlatedSkills": []
}
```

### Assertions Verified
- Status code is 200: PASS
- Target engineer is eng_emily: PASS
- sharedSkills is an array on all results: PASS
- correlatedSkills is an array on all results: PASS
- At least one result has shared skills: PASS

### Notes
- Emma Wilson is an exceptionally strong match (0.92 similarity) with 7 shared skills
- Both are Frontend Engineers working on React & Design Systems
- The nearly identical skill profiles and domain focus drive the high score
- The correlatedSkills feature identifies relationships like:
  - TypeScript users often know JavaScript (0.95 strength)
  - Curiosity correlates with Continuous Learning (0.90 strength)
- This demonstrates the system captures both direct skill overlap and implicit skill relationships

---

## Response Structure Reference

### Target Engineer Object
```typescript
{
  id: string;
  name: string;
  headline: string;
  yearsExperience: number;
  timezone: string;
  skills: Array<{
    skillName: string;
    skillId: string;
    confidenceScore: number;
    proficiencyLevel: string;
  }>;
  businessDomains: Array<{
    domainName: string;
    domainId: string;
    years: number;
  }>;
  technicalDomains: Array<{
    domainName: string;
    domainId: string;
    years: number;
  }>;
  salary: number;
  startTimeline: string;
}
```

### Similar Result Object
```typescript
{
  engineer: EngineerForSimilarity;
  similarityScore: number;  // 0.0 - 1.0 weighted combination
  breakdown: {
    skills: number;         // 0.0 - 1.0 skill similarity
    yearsExperience: number; // 0.0 - 1.0 experience similarity
    domain: number;          // 0.0 - 1.0 domain overlap
    timezone: number;        // 0.0 - 1.0 timezone proximity
  };
  sharedSkills: string[];   // Directly overlapping skills
  correlatedSkills: Array<{
    targetSkill: string;     // Skill from target engineer
    candidateSkill: string;  // Related skill from candidate
    strength: number;        // Correlation strength 0.0 - 1.0
  }>;
}
```

---

## Key Observations

1. **Similarity Scoring**: The multi-dimensional breakdown (skills, experience, domain, timezone) provides transparent scoring that explains why engineers match.

2. **Skill Correlations**: The `correlatedSkills` feature captures implicit relationships (e.g., TypeScript users likely know JavaScript) that enhance matching beyond direct skill overlap.

3. **Diversity Selection**: Results are reordered after similarity scoring to promote diversity, but the highest-scoring match is always preserved in position 1.

4. **Input Validation**: Zod schema enforcement prevents invalid queries with clear error messages (limit must be 1-20).

5. **Response Times**: All queries complete in under 150ms, with most under 50ms, indicating efficient Neo4j traversal.
