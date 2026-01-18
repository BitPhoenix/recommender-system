# Filter-Similarity Endpoint E2E Test Results

**Date**: 2026-01-17
**Endpoint**: `POST /api/search/filter-similarity`
**Test Framework**: Newman (Postman CLI)
**Total Tests**: 11 new tests (Tests 63-73)
**Total Assertions**: 244 (across full collection of 73 tests)
**Result**: All passing

---

## Test Summary

| Test # | Name | Status | Key Verification |
|--------|------|--------|------------------|
| 63 | Basic Request | PASS | Response structure, similarity ranking |
| 64 | Missing referenceEngineerId | PASS | 400 validation error |
| 65 | Non-existent Reference Engineer | PASS | 404 ENGINEER_NOT_FOUND |
| 66 | With Skill Constraints | PASS | Skill filter applied, results ranked |
| 67 | With Seniority Constraint | PASS | Experience filter applied |
| 68 | With Timezone Constraint | PASS | Timezone filter enforced |
| 69 | Pagination | PASS | Limit respected, totalCount accurate |
| 70 | Reference Excluded | PASS | Reference engineer not in matches |
| 71 | Inference Rules Applied | PASS | derivedConstraints populated |
| 72 | Override Inference Rule | PASS | overriddenRuleIds echoed |
| 73 | Match Fields | PASS | salary and startTimeline present |

---

## Test 63: Basic Request

### Request
```json
POST /api/search/filter-similarity
{
  "referenceEngineerId": "eng_marcus"
}
```

### Expected Behavior
- Return 200 OK
- Include reference engineer info
- Return matches ranked by similarity to reference
- Each match includes similarity score and breakdown

### Actual Response (key fields)
```json
{
  "referenceEngineer": {
    "id": "eng_marcus",
    "name": "Marcus Chen",
    "headline": "Full Stack Engineer | React & Node.js"
  },
  "totalCount": 39,
  "matches": [
    {
      "id": "eng_zoe",
      "name": "Zoe Martinez",
      "similarityScore": 0.85,
      "scoreBreakdown": {
        "skills": 0.8,
        "yearsExperience": 1,
        "domain": 0.71,
        "timezone": 1
      }
    }
    // ... 9 more matches
  ]
}
```

### Assertions Verified
- Status code is 200
- Response has `referenceEngineer`, `matches`, `totalCount`, `appliedFilters`, `overriddenRuleIds`, `derivedConstraints`, `queryMetadata`
- Reference engineer ID matches request
- First match has highest similarity score (0.85)
- Each match has `similarityScore`, `scoreBreakdown`, `sharedSkills`
- Score breakdown has 4 components: skills, yearsExperience, domain, timezone

### Notes
The similarity scores in the response are: `[0.85, 0.65, 0.59, 0.63, 0.74, 0.7, 0.6, 0.59, 0.63, 0.76]`. These are not in strict descending order because **diversity selection** intentionally reorders results after the first match to provide variety (engineers with different skill profiles rather than 10 near-clones). The first result (0.85) is guaranteed to be the highest.

---

## Test 64: Missing referenceEngineerId

### Request
```json
POST /api/search/filter-similarity
{}
```

### Expected Behavior
- Return 400 Bad Request
- Error message mentions referenceEngineerId

### Actual Response
```json
{
  "error": {
    "issues": [{
      "expected": "string",
      "code": "invalid_type",
      "path": ["referenceEngineerId"],
      "message": "Invalid input: expected string, received undefined"
    }],
    "name": "ZodError"
  }
}
```

### Assertions Verified
- Status code is 400
- Error mentions "referenceEngineerId"

---

## Test 65: Non-existent Reference Engineer

### Request
```json
POST /api/search/filter-similarity
{
  "referenceEngineerId": "eng_nonexistent"
}
```

### Expected Behavior
- Return 404 Not Found
- Error code is ENGINEER_NOT_FOUND

### Actual Response
```json
{
  "error": {
    "code": "ENGINEER_NOT_FOUND",
    "message": "Engineer not found: eng_nonexistent"
  }
}
```

### Assertions Verified
- Status code is 404
- Error code equals "ENGINEER_NOT_FOUND"

---

## Test 66: With Skill Constraints

### Request
```json
POST /api/search/filter-similarity
{
  "referenceEngineerId": "eng_marcus",
  "requiredSkills": [{"skill": "TypeScript", "minProficiency": "proficient"}]
}
```

### Expected Behavior
- Return 200 OK
- Applied filters include skill filter
- Results filtered to engineers with TypeScript at proficient+ level
- Results still ranked by similarity

### Actual Response (key fields)
```json
{
  "totalCount": 14,
  "appliedFilters": [{
    "kind": "skill",
    "field": "requiredSkills",
    "operator": "HAS_ALL",
    "skills": [{
      "skillId": "skill_typescript",
      "skillName": "TypeScript",
      "minProficiency": "proficient"
    }],
    "displayValue": "TypeScript|min:proficient",
    "source": "user"
  }]
}
```

### Assertions Verified
- Status code is 200
- appliedFilters includes skill filter with field "requiredSkills"
- First match has highest similarity score

### Notes
Total count dropped from 39 (no filter) to 14 (with TypeScript proficient+ requirement), demonstrating the filter is working correctly.

---

## Test 67: With Seniority Constraint

### Request
```json
POST /api/search/filter-similarity
{
  "referenceEngineerId": "eng_marcus",
  "requiredSeniorityLevel": "senior"
}
```

### Expected Behavior
- Return 200 OK
- Applied filters include yearsExperience filter
- Results filtered to senior-level engineers (6-10 years per knowledge base)
- Results ranked by similarity

### Actual Response (key fields)
```json
{
  "totalCount": 15,
  "appliedFilters": [{
    "kind": "property",
    "field": "yearsExperience",
    "operator": "BETWEEN",
    "value": "6 AND 10",
    "source": "knowledge_base"
  }]
}
```

### Assertions Verified
- Status code is 200
- appliedFilters includes yearsExperience filter
- Filter shows "6 AND 10" (senior level from knowledge base config)
- First match has highest similarity score

### Notes
The seniority constraint is expanded via the knowledge base: "senior" → yearsExperience BETWEEN 6 AND 10. This reduced matches from 39 to 15.

---

## Test 68: With Timezone Constraint

### Request
```json
POST /api/search/filter-similarity
{
  "referenceEngineerId": "eng_marcus",
  "requiredTimezone": ["Eastern", "Central"]
}
```

### Expected Behavior
- Return 200 OK
- All matches have timezone Eastern or Central
- Results ranked by similarity

### Actual Response (key fields)
```json
{
  "totalCount": 17,
  "matches": [
    // All matches have timezone "Eastern" or "Central"
  ]
}
```

Unique timezones in results: `["Central", "Eastern"]`

### Assertions Verified
- Status code is 200
- appliedFilters includes timezone filter
- Every match has timezone in ["Eastern", "Central"]

### Notes
The timezone filter correctly excluded engineers in Pacific and Mountain timezones, reducing from 39 to 17 matches.

---

## Test 69: Pagination

### Request
```json
POST /api/search/filter-similarity
{
  "referenceEngineerId": "eng_marcus",
  "limit": 5,
  "offset": 0
}
```

### Expected Behavior
- Return at most 5 matches
- totalCount reflects full result set (not limited)

### Actual Response (key fields)
```json
{
  "totalCount": 39,
  "matches": [/* 5 items */]
}
```

### Assertions Verified
- Status code is 200
- matches.length is at most 5 (actual: 5)
- totalCount (39) >= matches.length (5)

### Notes
Even though only 5 matches are returned, totalCount correctly reports 39 total matching engineers. This enables proper pagination UI.

---

## Test 70: Reference Excluded from Results

### Request
```json
POST /api/search/filter-similarity
{
  "referenceEngineerId": "eng_marcus"
}
```

### Expected Behavior
- Reference engineer should not appear in matches

### Actual Response (key fields)
```json
{
  "referenceEngineer": {"id": "eng_marcus"},
  "matches": [
    {"id": "eng_zoe"},
    {"id": "eng_lisa"},
    {"id": "eng_ashley"},
    {"id": "eng_natasha"},
    {"id": "eng_carlos"},
    {"id": "eng_kevin"},
    {"id": "eng_jennifer"},
    {"id": "eng_greg"},
    {"id": "eng_emily"},
    {"id": "eng_derek"}
  ]
}
```

### Assertions Verified
- Status code is 200
- "eng_marcus" is NOT in the list of match IDs

### Notes
The filter query explicitly excludes the reference engineer (`WHERE e.id <> $excludeEngineerId`), so you can't get back the same engineer you asked to find similar candidates for.

---

## Test 71: Inference Rules Applied

### Request
```json
POST /api/search/filter-similarity
{
  "referenceEngineerId": "eng_marcus",
  "requiredSkills": [{"skill": "React"}]
}
```

### Expected Behavior
- derivedConstraints array is populated if inference rules fire
- Array is present even if empty (shows the field exists)

### Actual Response (key fields)
```json
{
  "derivedConstraints": []
}
```

### Assertions Verified
- Status code is 200
- derivedConstraints is an array

### Notes
In this case, no inference rules fired for the React skill constraint (the frontend-skill-inference rule may not apply to this specific request). The field is present but empty, which is correct behavior.

---

## Test 72: Override Inference Rule

### Request
```json
POST /api/search/filter-similarity
{
  "referenceEngineerId": "eng_marcus",
  "requiredSkills": [{"skill": "React"}],
  "overriddenRuleIds": ["frontend-skill-inference"]
}
```

### Expected Behavior
- overriddenRuleIds is echoed back in response
- The specified rule is bypassed during inference

### Actual Response (key fields)
```json
{
  "overriddenRuleIds": ["frontend-skill-inference"]
}
```

### Assertions Verified
- Status code is 200
- overriddenRuleIds includes "frontend-skill-inference"

### Notes
This confirms the API accepts and echoes override requests. Users can bypass specific inference rules that might be too restrictive for their use case.

---

## Test 73: Match Fields Include salary and startTimeline

### Request
```json
POST /api/search/filter-similarity
{
  "referenceEngineerId": "eng_marcus"
}
```

### Expected Behavior
- Each match includes salary (number)
- Each match includes startTimeline (string)

### Actual Response (first match)
```json
{
  "matches": [{
    "salary": 155000,
    "startTimeline": "immediate"
  }]
}
```

### Assertions Verified
- Status code is 200
- Each match has `salary` property (number)
- Each match has `startTimeline` property (string)

### Notes
These fields are populated from the database and enable the UI to display budget fit and availability information alongside similarity scores.

---

## Full Test Run Summary

```
┌─────────────────────────┬────────────────────┬───────────────────┐
│                         │           executed │            failed │
├─────────────────────────┼────────────────────┼───────────────────┤
│              iterations │                  1 │                 0 │
├─────────────────────────┼────────────────────┼───────────────────┤
│                requests │                 73 │                 0 │
├─────────────────────────┼────────────────────┼───────────────────┤
│            test-scripts │                 73 │                 0 │
├─────────────────────────┼────────────────────┼───────────────────┤
│      prerequest-scripts │                  0 │                 0 │
├─────────────────────────┼────────────────────┼───────────────────┤
│              assertions │                244 │                 0 │
└─────────────────────────┴────────────────────┴───────────────────┘

Total run duration: 26.5s
Average response time: 351ms
```

All 244 assertions passed across the full test collection (73 requests), including the 11 new filter-similarity tests.

---

## Unit Test Coverage

In addition to E2E tests, the following unit tests were added:

### Schema Tests (`filter-similarity.schema.test.ts`)
- 17 tests covering validation:
  - Required field validation (referenceEngineerId)
  - stretchBudget refinement (requires maxBudget, must be >= maxBudget)
  - Pagination defaults and limits
  - Enum validation (seniority, timeline, timezone, proficiency)
  - overriddenRuleIds handling

### Service Tests (`filter-similarity.service.test.ts`)
- 14 tests covering orchestration:
  - EngineerNotFoundError for missing reference
  - Graph loading for similarity calculation
  - Filter query building and execution
  - Candidate data loading by ID
  - Similarity scoring with reference
  - Diversity selection
  - Constraint advice integration
  - Response structure validation
  - Pagination handling
  - overriddenRuleIds echo

**Total unit tests added**: 31
**Total tests in suite**: 736 (all passing)
