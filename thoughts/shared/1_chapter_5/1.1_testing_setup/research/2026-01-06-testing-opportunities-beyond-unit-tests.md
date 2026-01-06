---
date: 2026-01-06T12:00:00-08:00
researcher: Claude
git_commit: a85b6a0b2ed8b5f6eaa8bd9639089ecf3bf14f09
branch: testing-setup
repository: recommender_system
topic: "Testing Opportunities Beyond Unit Tests"
tags: [research, testing, integration-tests, e2e-tests, neo4j, api-testing]
status: complete
last_updated: 2026-01-06
last_updated_by: Claude
---

# Research: Testing Opportunities Beyond Unit Tests

**Date**: 2026-01-06T12:00:00-08:00
**Researcher**: Claude
**Git Commit**: a85b6a0b2ed8b5f6eaa8bd9639089ecf3bf14f09
**Branch**: testing-setup
**Repository**: recommender_system

## Research Question

What testing opportunities exist beyond the current unit tests? Specifically, what integration tests and other test types should be implemented?

## Summary

The codebase currently has **144 Vitest unit tests** covering pure functions (scoring, constraint expansion, schema validation). However, there is **zero integration test coverage** for:

1. **Neo4j database interactions** - Skill/domain resolvers, search queries
2. **API endpoint testing** - Controller, middleware, request/response flow
3. **Service orchestration** - The 7-step search pipeline in `executeSearch()`
4. **Postman test assertions** - Only 3 of 42 tests have automated assertions

This document identifies **6 major testing categories** with specific recommendations.

---

## Detailed Findings

### 1. Current Test Coverage Status

| Component | Unit Tests | Integration Tests | E2E Tests |
|-----------|------------|-------------------|-----------|
| Scoring functions (13) | ✅ 144 tests | ❌ None | ❌ None |
| Constraint expansion | ✅ 47 tests | ❌ None | ❌ None |
| Schema validation | ✅ 50+ tests | ❌ None | ❌ None |
| Utility calculator | ✅ Full coverage | ❌ None | ❌ None |
| Search service | ❌ None | ❌ None | ❌ None |
| Skill/domain resolvers | ❌ None | ❌ None | ❌ None |
| Cypher query builders | ❌ None | ❌ None | ❌ None |
| API controller | ❌ None | ❌ None | ❌ None |
| Middleware | ❌ None | ❌ None | ❌ None |

### 2. Neo4j Integration Testing Opportunities

**Priority: CRITICAL**

The following services require Neo4j session mocking for integration tests:

#### 2.1 Skill Resolution Service
**File**: `src/services/skill-resolver.service.ts` (240 lines)

```
Database Operations:
- Query 1: Leaf skill expansion via BELONGS_TO + CHILD_OF traversal
- Query 2: Identifier validation

Testing Complexity: MEDIUM-HIGH
- Requires mocking session.run() for 2 queries
- Test proficiency overlap resolution logic
- Test case-insensitive identifier matching
```

**Test Scenarios Needed:**
- Skill hierarchy expansion (parent → descendants)
- Proficiency inheritance with overlaps
- Unresolved skill identifier handling
- Mixed BELONGS_TO and CHILD_OF traversal

#### 2.2 Domain Resolver Service
**File**: `src/services/domain-resolver.service.ts` (147 lines)

```
Database Operations:
- Business domain: lookup + CHILD_OF hierarchy expansion
- Technical domain: lookup + CHILD_OF or ENCOMPASSES expansion

Testing Complexity: MEDIUM
- Sequential queries (not concurrent safe)
- Composite domain handling (Full Stack = Frontend + Backend)
```

**Test Scenarios Needed:**
- Parent domain search returning children
- Composite technical domain expansion
- minYears filtering on domain experience
- Unknown domain identifier handling

#### 2.3 Search Service Orchestration
**File**: `src/services/search.service.ts` (230 lines)

```
7-Step Pipeline:
1. expandSearchCriteria() - Pure, already tested
2. resolveAllSkills() - Neo4j queries
3. resolveBusinessDomains() - Neo4j query
4. resolveTechnicalDomains() - Neo4j query (x2)
5. buildSearchQuery() - Pure, needs unit tests
6. session.run(mainQuery) - Neo4j execution
7. scoreAndSortEngineers() - Pure, already tested

Testing Complexity: VERY HIGH
- Mock 5+ sequential Neo4j queries
- Test data flow through pipeline
- Test error handling at each step
```

**Test Scenarios Needed:**
- Full search with all filters
- Browse mode (empty request)
- Partial filter combinations
- Error handling (Neo4j failures)
- Empty result sets

#### 2.4 Cypher Query Builders
**File**: `src/services/cypher-query-builder/search-query.builder.ts` (304 lines)

```
Pure Logic - No DB Calls:
- buildSearchQuery() generates Cypher string + params
- Conditional segments for skill-filtered vs unfiltered
- 8 query segments assembled dynamically

Testing Complexity: MEDIUM
- Unit test query string assertions
- Test both skill-filtered and unfiltered paths
- Verify parameter binding
```

**Test Scenarios Needed:**
- Skill-filtered query generation
- Unfiltered (browse) query generation
- All filter combinations
- Pagination clause correctness
- Domain filter clause structure

### 3. API Integration Testing Opportunities

**Priority: HIGH**

#### 3.1 Search Controller
**File**: `src/controllers/search.controller.ts` (40 lines)

**Test Scenarios Needed:**
- Successful search returns 200
- Neo4j connection failure returns 500
- Session cleanup in finally block
- Response format validation

#### 3.2 Validation Middleware
**File**: `src/middleware/zod-validate.middleware.ts` (38 lines)

**Test Scenarios Needed:**
- Empty body treated as valid (unfiltered search)
- Validation error returns 400 with structured errors
- Valid request passes through with transformed body
- All refinement rules enforced (stretchBudget, timeline)

#### 3.3 Full Request Flow
```
HTTP POST /api/search/filter
    ↓
Express JSON middleware
    ↓
Zod Validation Middleware
    ↓
filterSearch Controller
    ↓
executeSearch Service (7 steps)
    ↓
HTTP Response
```

**Test Scenarios Needed:**
- Complete happy path with mocked Neo4j
- Validation rejection before DB access
- Error propagation from service layer
- Response schema validation

### 4. Postman/Newman E2E Test Gaps

**Priority: HIGH**

Current state: **42 test scenarios** but only **3 have automated assertions**.

#### 4.1 Missing Test Assertions (39 tests)
Most Postman tests only define request bodies without validating:
- Response status codes
- Response schema structure
- `appliedFilters` / `appliedPreferences` correctness
- `scoreBreakdown` values
- Engineer ranking order
- `queryMetadata` fields

#### 4.2 Missing Edge Case Tests
```
- Empty result handling
- Pagination edge cases (offset > totalCount)
- Invalid skill/domain identifiers
- Extreme values (limit=100, budget=999999999)
- Special characters in identifiers
- Concurrent request handling
- Timeout scenarios
```

#### 4.3 Missing Validation Tests
```
- preferredMaxStartTime > requiredMaxStartTime (should fail)
- stretchBudget < maxBudget (should fail)
- Negative limit/offset (should fail)
- Invalid enum values (should fail)
```

### 5. Test Data & Fixtures

**Current Seed Data:**
- 5 engineers (mid-to-senior level)
- 122 skills with hierarchy
- 17 business domains + 18 technical domains
- 53 user skill entries
- 9 interview stories

**Gaps for Testing:**
- No junior engineers (0-3 years)
- No failed assessment attempts
- No engineers without required skills
- Limited timezone diversity (all Americas)
- No conflicting evidence scenarios

### 6. Recommended Test Infrastructure

#### 6.1 Neo4j Session Mocking
```typescript
// Recommended approach
const mockSession = {
  run: vi.fn(),
  close: vi.fn(),
};

// Mock different queries by matching Cypher patterns
mockSession.run.mockImplementation((query: string) => {
  if (query.includes('BELONGS_TO')) return mockSkillResults;
  if (query.includes('BusinessDomain')) return mockDomainResults;
  return mockSearchResults;
});
```

#### 6.2 Test Helper Factories
Extend existing patterns:
```typescript
const createMockEngineerRecord = (overrides = {}) => ({...});
const createMockSkillResolution = (overrides = {}) => ({...});
const createMockNeo4jSession = () => ({...});
```

#### 6.3 Supertest for API Testing
```typescript
import request from 'supertest';
import app from '../src/index.js';

describe('POST /api/search/filter', () => {
  it('returns engineers matching filters', async () => {
    const response = await request(app)
      .post('/api/search/filter')
      .send({ seniorityLevel: 'senior' });

    expect(response.status).toBe(200);
    expect(response.body.matches).toBeDefined();
  });
});
```

---

## Testing Priority Matrix

| Category | Priority | Effort | Impact |
|----------|----------|--------|--------|
| Cypher query builder unit tests | HIGH | LOW | HIGH |
| Neo4j resolver integration tests | CRITICAL | MEDIUM | HIGH |
| Search service integration tests | CRITICAL | HIGH | VERY HIGH |
| API controller integration tests | HIGH | MEDIUM | HIGH |
| Postman assertion scripts | HIGH | LOW | MEDIUM |
| E2E edge case tests | MEDIUM | MEDIUM | MEDIUM |
| Performance/load tests | LOW | HIGH | MEDIUM |

---

## Code References

### Neo4j Services (Need Integration Tests)
- `recommender_api/src/neo4j.ts:1-10` - Driver setup
- `recommender_api/src/services/search.service.ts:42-230` - Main orchestrator
- `recommender_api/src/services/skill-resolver.service.ts:74-240` - Skill resolution
- `recommender_api/src/services/domain-resolver.service.ts:27-147` - Domain resolution
- `recommender_api/src/services/skill-resolution.service.ts:67-144` - Skill orchestration

### Query Builders (Need Unit Tests)
- `recommender_api/src/services/cypher-query-builder/search-query.builder.ts:22-304` - Main query
- `recommender_api/src/services/cypher-query-builder/query-conditions.builder.ts:15-101` - WHERE clauses
- `recommender_api/src/services/cypher-query-builder/query-domain-filter.builder.ts:23-274` - Domain filters

### API Layer (Need Integration Tests)
- `recommender_api/src/controllers/search.controller.ts:15-39` - Controller
- `recommender_api/src/middleware/zod-validate.middleware.ts:1-38` - Validation
- `recommender_api/src/routes/search.routes.ts:1-10` - Route definition

### Existing Test Patterns
- `recommender_api/src/services/utility-calculator/utility-calculator.test.ts` - Factory helpers
- `recommender_api/src/schemas/search.schema.test.ts` - Schema validation patterns

---

## Recommended Implementation Order

### Phase 1: Query Builder Unit Tests (1-2 days)
1. `search-query.builder.test.ts` - Test Cypher string generation
2. `query-conditions.builder.test.ts` - Test WHERE clause building
3. `query-domain-filter.builder.test.ts` - Test domain filter clauses

### Phase 2: Neo4j Integration Tests (3-5 days)
1. Create `__mocks__/neo4j-session.ts` mock factory
2. `skill-resolver.service.test.ts` - Mock skill queries
3. `domain-resolver.service.test.ts` - Mock domain queries
4. `search.service.test.ts` - Mock full pipeline

### Phase 3: API Integration Tests (2-3 days)
1. Install supertest: `npm install -D supertest @types/supertest`
2. `search.controller.test.ts` - Test with mocked services
3. `zod-validate.middleware.test.ts` - Test validation flow
4. `search.routes.test.ts` - Full request flow tests

### Phase 4: Postman Enhancement (1-2 days)
1. Add test scripts to all 42 requests
2. Validate response schema structure
3. Add edge case test scenarios
4. Add validation error test scenarios

---

## Open Questions

1. **Test Database Strategy**: Should integration tests use:
   - Mocked Neo4j sessions (faster, isolated)
   - Testcontainers with real Neo4j (slower, more realistic)
   - Dedicated test Neo4j instance with seed data

2. **CI/CD Integration**: How should integration tests be run?
   - On every PR?
   - Nightly with full database?
   - Separate from unit tests?

3. **Coverage Targets**: What coverage thresholds should be set?
   - Current: Unknown (unit tests only)
   - Recommended: 80%+ for services, 90%+ for query builders

---

## Related Research

- `thoughts/shared/1_chapter_5/1.1_testing_setup/plans/2026-01-06-vitest-unit-tests.md` - Original unit test plan
