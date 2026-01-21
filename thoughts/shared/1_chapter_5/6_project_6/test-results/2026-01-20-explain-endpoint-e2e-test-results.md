# Match Explanation Endpoint E2E Test Results

**Date**: 2026-01-21 (Updated - Fixed Issues)
**Endpoint**: `POST /api/search/filter/:engineerId/explain`
**Test Framework**: Newman (Postman CLI)
**Total Tests**: 9
**Total Assertions**: 29
**Result**: All passing

---

## Test Summary

| Test # | Name | Status | Key Verification |
|--------|------|--------|------------------|
| 89 | Basic Explanation for eng_priya | PASS | Evidence populated, confidence explanation fixed |
| 90 | With Inference Rules (teamFocus: scaling) | PASS | Skill names now human-readable |
| 91 | Non-Matching Engineer (404) | PASS | Proper 404 error handling |
| 92 | Invalid Request Body (400) | PASS | Schema validation error response |
| 93 | Empty Criteria (Browse Mode) | PASS | Browse mode context for LLM |
| 94 | With Tradeoffs Detected | PASS | Clearer skill name in tradeoff explanation |
| 95 | Evidence Structure Validation | PASS | No invented tradeoffs in narrative |
| 96 | Experience Tradeoff | PASS | Tradeoff when under preferred seniority |
| 97 | Stretch Budget Tradeoff | PASS | Tradeoff with stretch budget explanation |

---

## Issues Fixed (2026-01-21)

### 1. LLM No Longer Invents Tradeoffs

**Problem**: Test 95 narrative claimed "The primary tradeoff is that while Priya's confidence score (74%) is strong, it slightly underperforms" when `tradeoffs: []` was empty.

**Fix**: Updated LLM system prompt with explicit guidance:
```
IMPORTANT - Tradeoffs:
- ONLY mention tradeoffs that appear in the "Tradeoffs" section of the context
- If there is no "Tradeoffs" section, there are NO tradeoffs to mention
- Do NOT invent or infer tradeoffs from score percentages or other data
```

### 2. TypeScript Now Has Evidence

**Problem**: Test 89 showed `evidence: []` despite TypeScript having 92% confidence.

**Fix**: Added evidence linkages in seed data:
- `es_priya_typescript` → `perf_priya_q1` (assessment with 92% score)
- `es_priya_typescript` → `story_priya_1` (microservices migration story)

### 3. Skill Names Now Human-Readable

**Problem**: Derived skills showed internal IDs like `skill_distributed` instead of "Distributed Systems".

**Fix**: Modified `expandSkillHierarchy()` to return both skill IDs and names from the database, and updated constraint building to use proper names.

### 4. Clearer PreferredSkills Tradeoff Explanation

**Problem**: Test 94 tradeoff showed confusing message `"Matched 0 of 3 preferred skills (1 skill group requested)"` when user only asked for "Python".

**Fix**: Updated `detectMissingPreferredSkills()` to use skill names directly:
- Before: `"explanation": "Matched 0 of 3 preferred skills (1 skill group requested)"`
- After: `"explanation": "Missing preferred skill: Python"`

### 5. Confidence Score No Longer Shows Confusing Percentage

**Problem**: Test 89 confidence score showed `rawScore: 0.84` alongside explanation `"avg 92%"`, which confused users because the numbers appeared different.

**Fix**: Removed percentage from confidence explanation since the rawScore is a normalized utility score, not a direct percentage:
- Before: `"explanation": "Very high confidence in skill assessments (avg 92%)"`
- After: `"explanation": "Very high confidence in skill assessments"`

---

## Test 89: Basic Explanation for eng_priya

### Request
```http
POST /api/search/filter/eng_priya/explain
Content-Type: application/json

{
  "searchCriteria": {
    "requiredSkills": [{"skill": "TypeScript"}]
  }
}
```

### Expected Behavior
- Returns 200 status for a matching engineer
- Response includes all required top-level fields
- **Evidence is now populated** for TypeScript skill
- Summary contains narrative without invented tradeoffs

### Actual Response (key fields)
```json
{
  "engineer": {
    "id": "eng_priya",
    "name": "Priya Sharma",
    "headline": "Senior Backend Engineer | Fintech & Payments"
  },
  "matchScore": 0.6,
  "summary": {
    "constraints": "Matches all 2 requirements",
    "tradeoffs": "No tradeoffs detected",
    "narrative": "Priya Sharma is a strong match for the role, primarily due to her extensive experience as a Senior Backend Engineer in fintech and payments, along with her demonstrated expertise in TypeScript, where she scored 92% on an assessment and showcased expert-level proficiency. Additionally, Priya is available within two weeks, aligning perfectly with the hiring timeline requirement. No significant tradeoffs were identified."
  },
  "constraints": [
    {
      "constraint": {
        "kind": "property",
        "field": "startTimeline",
        "operator": "IN",
        "source": "knowledge_base"
      },
      "satisfied": true,
      "explanation": "Available 2 weeks (required: within [...])",
      "matchedValues": ["two_weeks"]
    },
    {
      "constraint": {
        "kind": "skill",
        "field": "requiredSkills",
        "operator": "HAS_ANY",
        "skills": [
          {"skillId": "skill_typescript", "skillName": "TypeScript", "minProficiency": "learning"}
        ],
        "displayValue": "TypeScript",
        "source": "user",
        "originalSkillId": "skill_typescript"
      },
      "satisfied": true,
      "explanation": "Has required skill: TypeScript (expert, 92% confidence)",
      "matchedValues": ["TypeScript (expert, 92% confidence)"],
      "matchType": "direct"
    }
  ],
  "scores": [
    {
      "component": "skillMatch",
      "weight": 0.37,
      "rawScore": 1,
      "weightedScore": 0.37,
      "explanation": "Excellent proficiency match on required skills"
    },
    {
      "component": "confidence",
      "weight": 0.14,
      "rawScore": 0.84,
      "weightedScore": 0.118,
      "explanation": "Very high confidence in skill assessments"
    },
    {
      "component": "experience",
      "weight": 0.11,
      "rawScore": 0.722,
      "weightedScore": 0.079,
      "explanation": "Senior level experience (8 years)"
    }
  ],
  "evidence": [
    {
      "skillId": "skill_typescript",
      "skillName": "TypeScript",
      "evidenceItems": [
        {
          "type": "performance",
          "id": "perf_priya_q1",
          "summary": "Scored 92% on Assessment with expert-level depth",
          "relevanceScore": 0.92,
          "isPrimary": true,
          "details": {
            "assessmentName": "Assessment",
            "questionSummary": "Design and implement a rate limiter API with multiple strategies",
            "score": 0.92,
            "maxScore": 1,
            "technicalDepth": "expert",
            "feedback": "Excellent API design with clean separation of concerns. Implemented multiple strategies."
          }
        },
        {
          "type": "story",
          "id": "story_priya_1",
          "summary": "I designed the API contracts between services using OpenAPI specs, implemented event sourcing with Kafka for data consistency across services, and created a strangler fig pattern to gradually migrate traffic. Result: We completed the migration in 4 months with zero customer-facing downtime.",
          "relevanceScore": 0.88,
          "isPrimary": false,
          "details": {
            "situation": "At a Series B fintech startup processing 10M daily transactions...",
            "task": "I was asked to lead the effort to break the monolith into microservices...",
            "action": "I designed the API contracts between services using OpenAPI specs...",
            "result": "We completed the migration in 4 months with zero customer-facing downtime...",
            "analysis": {
              "clarityScore": 0.92,
              "impactScore": 0.9,
              "ownershipScore": 0.88,
              "overallScore": 0.9
            }
          }
        }
      ]
    }
  ],
  "tradeoffs": []
}
```

### Notes
- **FIXED**: Evidence is now populated for TypeScript skill
- The narrative mentions the 92% assessment score as evidence
- `skillName` field shows "TypeScript" (human-readable) not "skill_typescript"

---

## Test 90: With Inference Rules (teamFocus: scaling)

### Request
```http
POST /api/search/filter/eng_christine/explain
Content-Type: application/json

{
  "searchCriteria": {
    "requiredSkills": [{"skill": "Node.js"}],
    "teamFocus": "scaling"
  }
}
```

### Expected Behavior
- Returns 200 status with explanation for the engineer
- Demonstrates inference rule chaining
- **Skill names are now human-readable** in derived constraints

### Actual Response (key fields)
```json
{
  "engineer": {
    "id": "eng_christine",
    "name": "Christine Kim",
    "headline": "Staff Full Stack Engineer | Healthcare & Fintech"
  },
  "matchScore": 0.41,
  "summary": {
    "constraints": "Matches 2 of 4 requirements",
    "tradeoffs": "No tradeoffs detected",
    "narrative": "Christine Kim is a qualified candidate with nine years of full-stack engineering experience in healthcare and fintech, demonstrating expertise in Node.js. However, she does not meet the required skills for distributed systems or observability tools such as monitoring or distributed tracing. Given that these are critical requirements specified by the hiring manager, Christine may need to develop these skills further to fit the role perfectly."
  },
  "constraints": [
    {
      "satisfied": true,
      "explanation": "Available 1 month (required: within [...])"
    },
    {
      "constraint": {
        "kind": "skill",
        "field": "requiredSkills",
        "operator": "HAS_ANY",
        "skills": [
          {"skillId": "skill_nodejs", "skillName": "Node.js"},
          {"skillId": "skill_express", "skillName": "Express"},
          {"skillId": "skill_nestjs", "skillName": "NestJS"}
        ],
        "displayValue": "Node.js",
        "source": "user"
      },
      "satisfied": true,
      "explanation": "Has required skill: Node.js (expert, 90% confidence)",
      "matchType": "direct"
    },
    {
      "constraint": {
        "kind": "skill",
        "field": "derivedSkills",
        "operator": "HAS_ANY",
        "skills": [
          {"skillId": "skill_distributed", "skillName": "Distributed Systems"}
        ],
        "displayValue": "Derived: Scaling Requires Distributed Systems",
        "source": "inference",
        "ruleId": "scaling-requires-distributed"
      },
      "satisfied": false,
      "explanation": "Lacks required skills in Derived: Scaling Requires Distributed Systems (needs at least one of: Distributed Systems)"
    },
    {
      "constraint": {
        "kind": "skill",
        "field": "derivedSkills",
        "operator": "HAS_ANY",
        "skills": [
          {"skillId": "skill_monitoring", "skillName": "Monitoring"},
          {"skillId": "skill_tracing", "skillName": "Distributed Tracing"}
        ],
        "displayValue": "Derived: Distributed Systems Require Observability",
        "source": "inference",
        "ruleId": "distributed-requires-observability"
      },
      "satisfied": false,
      "explanation": "Lacks required skills in Derived: Distributed Systems Require Observability (needs at least one of: Monitoring, Distributed Tracing)"
    }
  ]
}
```

### Notes
- **FIXED**: Skill names are now human-readable:
  - `"skillName": "Distributed Systems"` instead of `"skill_distributed"`
  - `"skillName": "Monitoring"` instead of `"skill_monitoring"`
  - `"skillName": "Distributed Tracing"` instead of `"skill_tracing"`
- The explanation text also uses human-readable names: "needs at least one of: Monitoring, Distributed Tracing"

---

## Test 91: Non-Matching Engineer (404)

### Request
```http
POST /api/search/filter/eng_nonexistent/explain
Content-Type: application/json

{
  "searchCriteria": {
    "requiredSkills": [{"skill": "TypeScript"}]
  }
}
```

### Actual Response
```json
{
  "error": "Engineer eng_nonexistent does not match the given search criteria"
}
```

---

## Test 92: Invalid Request Body (400)

### Request
```http
POST /api/search/filter/eng_priya/explain
Content-Type: application/json

{}
```

### Actual Response
```json
{
  "success": false,
  "error": {
    "issues": [
      {
        "expected": "object",
        "code": "invalid_type",
        "path": ["searchCriteria"],
        "message": "Invalid input: expected object, received undefined"
      }
    ],
    "name": "ZodError"
  }
}
```

---

## Test 93: Empty Criteria (Browse Mode)

### Request
```http
POST /api/search/filter/eng_priya/explain
Content-Type: application/json

{
  "searchCriteria": {}
}
```

### Expected Behavior
- Returns 200 with explanation even when no specific criteria provided
- **Browse mode context**: LLM focuses on evidence, not meaningless scores
- Narrative does NOT speculate about "incomplete profiles"

### Actual Response (key fields)
```json
{
  "matchScore": 0.29,
  "summary": {
    "constraints": "Matches all 1 requirement",
    "tradeoffs": "No tradeoffs detected",
    "narrative": "Priya Sharma is a Senior Backend Engineer with 8 years of experience in fintech and payments, making her well-qualified for roles requiring extensive backend development expertise. Her evidence includes designing API contracts using OpenAPI specifications, implementing event sourcing with Kafka, and successfully migrating traffic using the strangler fig pattern without customer-facing downtime, demonstrating strong skills in API design and system integration."
  },
  "evidence": [
    {
      "skillId": "skill_api_design",
      "skillName": "API Design",
      "evidenceItems": [...]
    }
  ]
}
```

### Notes
- **IMPROVED**: Narrative focuses on qualifications and evidence
- No speculation about "incomplete or outdated profile details"
- Browse mode context helps LLM understand skill scores are baseline values

---

## Test 94: With Tradeoffs Detected

### Request
```http
POST /api/search/filter/eng_priya/explain
Content-Type: application/json

{
  "searchCriteria": {
    "preferredSkills": [{"skill": "Python"}],
    "preferredTimezone": ["Pacific"]
  }
}
```

### Actual Response (key fields)
```json
{
  "summary": {
    "constraints": "Matches all 1 requirement",
    "tradeoffs": "2 tradeoffs: timezone, preferredSkills",
    "narrative": "..."
  },
  "tradeoffs": [
    {
      "attribute": "timezone",
      "requested": ["Pacific"],
      "actual": "Eastern",
      "explanation": "In Eastern timezone (preferred: Pacific)"
    },
    {
      "attribute": "preferredSkills",
      "requested": "Python",
      "actual": "none",
      "explanation": "Missing preferred skill: Python"
    }
  ]
}
```

### Notes
- **FIXED**: The preferredSkills tradeoff now shows the skill name ("Python") instead of confusing counts ("Matched 0 of 3 preferred skills")
- The explanation is clearer: "Missing preferred skill: Python"

---

## Test 95: Evidence Structure Validation

### Request
```http
POST /api/search/filter/eng_priya/explain
Content-Type: application/json

{
  "searchCriteria": {
    "requiredSkills": [{"skill": "API Design"}]
  }
}
```

### Expected Behavior
- Evidence items include story evidence with STAR format
- **Narrative does NOT invent tradeoffs** about confidence scores

### Actual Response (key fields)
```json
{
  "summary": {
    "constraints": "Matches all 2 requirements",
    "tradeoffs": "No tradeoffs detected",
    "narrative": "Priya Sharma is a strong match for the position due to her expertise in API Design, as evidenced by her experience designing API contracts using OpenAPI specifications and implementing event sourcing with Kafka to ensure data consistency across services. Her proficiency in this area is well-supported by an interview story demonstrating successful migration of traffic over four months without any customer-facing downtime. Additionally, Priya's 8 years of experience contribute positively to her overall qualification profile."
  },
  "constraints": [
    {
      "constraint": {
        "kind": "skill",
        "operator": "HAS_ANY",
        "skills": [
          {"skillId": "skill_api_design", "skillName": "API Design"},
          {"skillId": "skill_rest_api", "skillName": "REST APIs"},
          {"skillId": "skill_graphql", "skillName": "GraphQL"},
          {"skillId": "skill_grpc", "skillName": "gRPC"}
        ],
        "displayValue": "API Design"
      },
      "satisfied": true,
      "explanation": "Has required skill: API Design (expert, 87% confidence)",
      "matchType": "direct"
    }
  ],
  "evidence": [
    {
      "skillId": "skill_api_design",
      "skillName": "API Design",
      "evidenceItems": [
        {
          "type": "story",
          "id": "story_priya_1",
          "summary": "I designed the API contracts between services using OpenAPI specs...",
          "isPrimary": true,
          "details": {
            "situation": "At a Series B fintech startup processing 10M daily transactions...",
            "task": "I was asked to lead the effort to break the monolith into microservices...",
            "action": "I designed the API contracts between services using OpenAPI specs...",
            "result": "We completed the migration in 4 months with zero customer-facing downtime...",
            "analysis": {
              "clarityScore": 0.92,
              "impactScore": 0.9,
              "ownershipScore": 0.88,
              "overallScore": 0.9
            }
          }
        },
        {
          "type": "performance",
          "id": "perf_priya_q1",
          "summary": "Scored 92% on Assessment with expert-level depth",
          "isPrimary": false
        }
      ]
    }
  ]
}
```

### Notes
- **FIXED**: Narrative no longer invents tradeoffs about confidence scores
- Previous narrative claimed "The primary tradeoff is that while Priya's confidence score (74%) is strong, it slightly underperforms" - this is now gone
- Skill hierarchy expansion shows human-readable names: "API Design", "REST APIs", "GraphQL", "gRPC"

---

## Test 96: Experience Tradeoff

### Request
```http
POST /api/search/filter/eng_marcus/explain
Content-Type: application/json

{
  "searchCriteria": {
    "requiredSkills": [{"skill": "React"}],
    "preferredSeniorityLevel": "staff"
  }
}
```

### Actual Response (key fields)
```json
{
  "summary": {
    "constraints": "Matches all 2 requirements",
    "tradeoffs": "1 tradeoff: yearsExperience",
    "narrative": "..."
  },
  "tradeoffs": [
    {
      "attribute": "yearsExperience",
      "requested": "10+ years (staff)",
      "actual": 5,
      "explanation": "Has 5 years experience (staff level expects 10+ years)"
    }
  ]
}
```

---

## Test 97: Stretch Budget Tradeoff

### Request
```http
POST /api/search/filter/eng_ravi/explain
Content-Type: application/json

{
  "searchCriteria": {
    "maxBudget": 150000,
    "stretchBudget": 180000
  }
}
```

### Actual Response (key fields)
```json
{
  "summary": {
    "constraints": "Matches all 2 requirements",
    "tradeoffs": "1 tradeoff: salary",
    "narrative": "..."
  },
  "tradeoffs": [
    {
      "attribute": "salary",
      "requested": 150000,
      "actual": 170000,
      "explanation": "Salary ($170,000) is $20,000 over budget ($150,000) but within stretch range ($180,000)"
    }
  ]
}
```

---

## Summary of Fixes

| Issue | Before | After |
|-------|--------|-------|
| Test 89 evidence | `evidence: []` empty despite 92% confidence | Evidence populated with assessment and story |
| Test 89 confidence | `"explanation": "Very high confidence... (avg 92%)"` | `"explanation": "Very high confidence in skill assessments"` |
| Test 90 skill names | `"skillName": "skill_distributed"` | `"skillName": "Distributed Systems"` |
| Test 94 preferredSkills | `"Matched 0 of 3 preferred skills (1 skill group...)"` | `"Missing preferred skill: Python"` |
| Test 95 narrative | Invented tradeoff about confidence score | No invented tradeoffs, focuses on qualifications |
| Browse mode narrative | Speculated about "incomplete profiles" | Focuses on evidence and experience |
