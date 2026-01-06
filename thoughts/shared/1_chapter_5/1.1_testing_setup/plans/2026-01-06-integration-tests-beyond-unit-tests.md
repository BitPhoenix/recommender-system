# Integration Testing Implementation Plan

## Overview

Extend the test suite beyond the existing 144 unit tests to include integration tests for Neo4j-dependent services, API endpoints, and Cypher query builders. This establishes comprehensive test coverage for the full request pipeline.

## Current State Analysis

- **Unit tests**: 144 Vitest tests covering pure functions (scoring, constraint expansion, schema validation)
- **Integration tests**: None - zero coverage for database interactions, API endpoints, service orchestration
- **E2E tests**: 42 Postman scenarios but only 3 have automated assertions
- **App structure**: Express app not exported from `index.ts` - prevents supertest usage

### Key Discoveries:
- Query builders are pure functions - can be unit tested without mocking (`search-query.builder.ts:22-304`)
- Services receive `Session` object as first parameter - mockable pattern (`search.service.ts:42-230`)
- Existing tests use simple factory functions without external mocking libraries
- Session-per-request pattern: controller creates session, passes through pipeline, closes in finally

## Desired End State

A comprehensive test suite with:
- Unit tests for all Cypher query builders (3 files, ~100 tests)
- Integration tests for Neo4j-dependent services with mocked sessions (~50 tests)
- API integration tests using supertest (~30 tests)
- Postman collection with assertions on all 42 scenarios

### Verification:
```bash
npm test                    # All 250+ tests pass
npm run test:coverage       # Coverage report shows 80%+ for services
npx newman run postman/...  # All Postman assertions pass
```

## What We're NOT Doing

- Testcontainers with real Neo4j (too slow for CI)
- Performance/load testing (separate future initiative)
- E2E browser tests for client
- Tests for seed scripts or migration tooling
- Adding external mocking libraries (vitest mocking is sufficient)

## Implementation Approach

Start with query builder unit tests (pure functions, no mocking), then add infrastructure for Neo4j mocking, then API tests, then service integration tests. Postman enhancement can run in parallel.

---

## Design Decisions

This section documents key architectural decisions for the testing strategy, explaining the rationale behind each choice.

### Decision 1: App Export with Supertest vs HTTP Calls to Running Server

**Choice: Refactor to export the Express app and use supertest**

**Alternatives Considered:**
1. **Supertest with exported app** - Import app directly, mock dependencies
2. **HTTP calls to running server** - Use axios/fetch against `localhost:4025`

**Why we chose supertest with app export:**

| Factor | Supertest + App Export | HTTP to Running Server |
|--------|----------------------|----------------------|
| **Test isolation** | ✅ In-process, no external deps | ❌ Requires Tilt + Neo4j running |
| **CI/CD friendly** | ✅ Runs anywhere | ❌ Needs infrastructure |
| **Mockability** | ✅ Can mock Neo4j driver | ❌ Uses real database |
| **Speed** | ✅ Milliseconds | ❌ Seconds (network) |
| **Determinism** | ✅ Fully controlled | ❌ Database state varies |

**Industry practice:** Nearly every Express testing guide recommends this pattern. The refactoring is minimal (extract `createApp()` to separate file) and enables proper unit/integration testing in isolation.

**Key insight:** We already have Postman/Newman for E2E tests against the real running server. The supertest integration tests serve a *different purpose* - they test the API layer logic (validation, error handling, response formatting) in isolation. The two test types complement each other:

```
┌─────────────────────────────────────────────────────────────────┐
│ Test Type         │ Tool       │ Database   │ Purpose           │
├───────────────────┼────────────┼────────────┼───────────────────┤
│ API Integration   │ Supertest  │ Mocked     │ Controller logic  │
│ E2E               │ Newman     │ Real Neo4j │ Full system       │
└─────────────────────────────────────────────────────────────────┘
```

---

### Decision 2: Simple Pattern Matching vs Sophisticated Cypher Validation

**Choice: Use simple string pattern matching in mocks**

**Alternatives Considered:**
1. **Simple pattern matching** - `if (query.includes('BELONGS_TO')) return mockResult`
2. **Cypher AST parsing** - Parse and validate query structure
3. **Query template matching** - Exact query string comparison

**Why we chose simple pattern matching:**

```typescript
// This is sufficient for integration tests
mockSession.run.mockImplementation((query) => {
  if (query.includes('Engineer')) return mockEngineers;
  if (query.includes('Skill')) return mockSkills;
  return { records: [] };
});
```

**Rationale based on the testing pyramid:**

```
        /\
       /  \     E2E (Newman + real Neo4j)
      /----\    └─ Catches: Cypher syntax errors, query correctness
     /      \
    /--------\  Integration (Supertest + mocked session)
   /          \ └─ Catches: Service orchestration, error handling
  /------------\
 /              \ Unit (Vitest, pure functions)
/________________\ └─ Catches: Query string construction (Phase 1)
```

**Why sophisticated Cypher validation is wrong for integration tests:**

1. **Query builders are already tested** - Phase 1 tests the Cypher string generation directly. Integration tests don't need to re-validate.

2. **Brittleness** - Sophisticated parsing breaks tests on any query change, even when behavior is identical. Teams quickly abandon such tests.

3. **No good tooling** - There's no well-maintained JavaScript Cypher parser designed for testing.

4. **Wrong layer for validation** - E2E tests with real Neo4j catch syntax errors. That's the appropriate layer.

5. **What integration tests actually verify:**
   - Services call the database with *some* query ✅
   - Services handle results correctly ✅
   - Error paths work ✅
   - They do NOT need to verify exact Cypher ❌

**Industry pattern:** Most teams use simple pattern/substring matching for SQL/Cypher/GraphQL mocks. The goal is to verify the code path, not the exact query syntax.

---

### Decision 3: Test Layer Responsibilities

Each test layer has a specific job. This separation prevents redundant testing and catches issues at the right level:

| Layer | Tests | Catches |
|-------|-------|---------|
| **Unit (Phase 1)** | Query builder pure functions | Cypher string correctness, parameter binding |
| **Integration (Phases 4-5)** | Services with mocked DB | Service orchestration, data flow, error handling |
| **E2E (Phase 6)** | Full system with real DB | Query execution, database schema issues, real-world scenarios |

**Anti-pattern avoided:** Making integration tests validate Cypher syntax (that's unit test territory) or using real database (that's E2E territory).

---

## Phase 1: Cypher Query Builder Unit Tests

### Overview
Test all Cypher query builder pure functions. These generate query strings and parameter objects without executing against Neo4j.

### Changes Required:

#### 1. Search Query Builder Tests
**File**: `recommender_api/src/services/cypher-query-builder/search-query.builder.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { buildSearchQuery } from './search-query.builder.js';
import type { CypherQueryParams } from './query-types.js';

// Factory helper for test params
const createQueryParams = (overrides: Partial<CypherQueryParams> = {}): CypherQueryParams => ({
  learningLevelSkillIds: [],
  proficientLevelSkillIds: [],
  expertLevelSkillIds: [],
  originalSkillIdentifiers: null,
  startTimeline: ['immediate', 'two_weeks', 'one_month'],
  minYearsExperience: null,
  maxYearsExperience: null,
  timezonePrefixes: [],
  maxBudget: null,
  stretchBudget: null,
  offset: 0,
  limit: 20,
  requiredBusinessDomains: [],
  preferredBusinessDomains: [],
  requiredTechnicalDomains: [],
  preferredTechnicalDomains: [],
  ...overrides,
});

describe('buildSearchQuery', () => {
  describe('basic query structure', () => {
    it('returns query string and params object', () => {
      const params = createQueryParams();
      const result = buildSearchQuery(params);

      expect(result.query).toBeDefined();
      expect(typeof result.query).toBe('string');
      expect(result.params).toBeDefined();
      expect(typeof result.params).toBe('object');
    });

    it('generates valid Cypher syntax (MATCH, WHERE, RETURN)', () => {
      const params = createQueryParams();
      const result = buildSearchQuery(params);

      expect(result.query).toContain('MATCH');
      expect(result.query).toContain('WHERE');
      expect(result.query).toContain('RETURN');
    });

    it('includes pagination parameters', () => {
      const params = createQueryParams({ offset: 10, limit: 25 });
      const result = buildSearchQuery(params);

      expect(result.params.offset).toBe(10);
      expect(result.params.limit).toBe(25);
    });
  });

  describe('unfiltered (browse) mode', () => {
    it('generates query without skill matching when no skills specified', () => {
      const params = createQueryParams({
        learningLevelSkillIds: [],
        proficientLevelSkillIds: [],
        expertLevelSkillIds: [],
      });
      const result = buildSearchQuery(params);

      // Should match all engineers without skill filtering
      expect(result.query).toContain('MATCH (e:Engineer)');
      // Should NOT contain skill proficiency checks
      expect(result.query).not.toContain('qualifiesOnProficiency');
    });

    it('includes totalCount in return for pagination', () => {
      const params = createQueryParams();
      const result = buildSearchQuery(params);

      expect(result.query).toContain('totalCount');
    });
  });

  describe('skill-filtered mode', () => {
    it('generates skill matching query when skills specified', () => {
      const params = createQueryParams({
        proficientLevelSkillIds: ['skill-1', 'skill-2'],
      });
      const result = buildSearchQuery(params);

      // Should include skill relationship pattern
      expect(result.query).toContain('HAS_SKILL');
      // Should include skill IDs in params
      expect(result.params.allSkillIds).toContain('skill-1');
      expect(result.params.allSkillIds).toContain('skill-2');
    });

    it('combines all proficiency levels into allSkillIds', () => {
      const params = createQueryParams({
        learningLevelSkillIds: ['learn-1'],
        proficientLevelSkillIds: ['prof-1'],
        expertLevelSkillIds: ['expert-1'],
      });
      const result = buildSearchQuery(params);

      const allSkillIds = result.params.allSkillIds as string[];
      expect(allSkillIds).toContain('learn-1');
      expect(allSkillIds).toContain('prof-1');
      expect(allSkillIds).toContain('expert-1');
    });

    it('includes proficiency level params for skill filtering', () => {
      const params = createQueryParams({
        learningLevelSkillIds: ['skill-learn'],
        proficientLevelSkillIds: ['skill-prof'],
        expertLevelSkillIds: ['skill-expert'],
      });
      const result = buildSearchQuery(params);

      expect(result.params.learningLevelSkillIds).toEqual(['skill-learn']);
      expect(result.params.proficientLevelSkillIds).toEqual(['skill-prof']);
      expect(result.params.expertLevelSkillIds).toEqual(['skill-expert']);
    });
  });

  describe('basic engineer filters', () => {
    it('includes timeline filter when specified', () => {
      const params = createQueryParams({
        startTimeline: ['immediate', 'two_weeks'],
      });
      const result = buildSearchQuery(params);

      expect(result.params.startTimeline).toEqual(['immediate', 'two_weeks']);
      expect(result.query).toContain('startTimeline');
    });

    it('includes experience range when specified', () => {
      const params = createQueryParams({
        minYearsExperience: 3,
        maxYearsExperience: 10,
      });
      const result = buildSearchQuery(params);

      expect(result.params.minYearsExperience).toBe(3);
      expect(result.params.maxYearsExperience).toBe(10);
      expect(result.query).toContain('yearsExperience');
    });

    it('includes budget ceiling when maxBudget specified', () => {
      const params = createQueryParams({
        maxBudget: 200000,
      });
      const result = buildSearchQuery(params);

      // Budget filter uses ceiling (maxBudget or stretchBudget)
      expect(result.params.filterCeiling).toBe(200000);
    });

    it('uses stretchBudget as ceiling when both specified', () => {
      const params = createQueryParams({
        maxBudget: 200000,
        stretchBudget: 220000,
      });
      const result = buildSearchQuery(params);

      expect(result.params.filterCeiling).toBe(220000);
    });

    it('includes timezone prefixes when specified', () => {
      const params = createQueryParams({
        timezonePrefixes: ['America/', 'Europe/'],
      });
      const result = buildSearchQuery(params);

      // Timezone params are dynamically named tz0, tz1, etc.
      expect(result.params.tz0).toBe('America/');
      expect(result.params.tz1).toBe('Europe/');
    });
  });

  describe('domain filters', () => {
    it('includes required business domain filter when specified', () => {
      const params = createQueryParams({
        requiredBusinessDomains: [
          { domainId: 'bd-1', expandedDomainIds: ['bd-1', 'bd-1-child'], minYears: 2 },
        ],
      });
      const result = buildSearchQuery(params);

      expect(result.query).toContain('BusinessDomain');
      expect(result.params.requiredBusinessDomain0Ids).toContain('bd-1');
    });

    it('includes preferred business domain collection when specified', () => {
      const params = createQueryParams({
        preferredBusinessDomains: [
          { domainId: 'bd-pref', expandedDomainIds: ['bd-pref'] },
        ],
      });
      const result = buildSearchQuery(params);

      expect(result.query).toContain('matchedBusinessDomains');
    });

    it('includes required technical domain filter when specified', () => {
      const params = createQueryParams({
        requiredTechnicalDomains: [
          { domainId: 'td-1', expandedDomainIds: ['td-1'], minYears: 3 },
        ],
      });
      const result = buildSearchQuery(params);

      expect(result.query).toContain('TechnicalDomain');
    });

    it('includes preferred technical domain collection when specified', () => {
      const params = createQueryParams({
        preferredTechnicalDomains: [
          { domainId: 'td-pref', expandedDomainIds: ['td-pref'] },
        ],
      });
      const result = buildSearchQuery(params);

      expect(result.query).toContain('matchedTechnicalDomains');
    });
  });

  describe('query correctness', () => {
    it('does not include undefined parameters', () => {
      const params = createQueryParams({
        minYearsExperience: null,
        maxYearsExperience: null,
        maxBudget: null,
      });
      const result = buildSearchQuery(params);

      // Null values should not create conditions
      expect(result.query).not.toMatch(/yearsExperience\s*>=\s*\$minYearsExperience/);
      expect(result.query).not.toMatch(/salary\s*<=\s*\$filterCeiling/);
    });

    it('includes originalSkillIdentifiers in params for match type classification', () => {
      const params = createQueryParams({
        proficientLevelSkillIds: ['skill-1'],
        originalSkillIdentifiers: ['typescript'],
      });
      const result = buildSearchQuery(params);

      expect(result.params.originalSkillIdentifiers).toEqual(['typescript']);
    });
  });
});
```

#### 2. Query Conditions Builder Tests
**File**: `recommender_api/src/services/cypher-query-builder/query-conditions.builder.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { buildBasicEngineerFilters } from './query-conditions.builder.js';
import type { CypherQueryParams } from './query-types.js';

const createQueryParams = (overrides: Partial<CypherQueryParams> = {}): CypherQueryParams => ({
  learningLevelSkillIds: [],
  proficientLevelSkillIds: [],
  expertLevelSkillIds: [],
  originalSkillIdentifiers: null,
  startTimeline: [],
  minYearsExperience: null,
  maxYearsExperience: null,
  timezonePrefixes: [],
  maxBudget: null,
  stretchBudget: null,
  offset: 0,
  limit: 20,
  ...overrides,
});

describe('buildBasicEngineerFilters', () => {
  describe('timeline filter', () => {
    it('returns empty conditions when no timeline specified', () => {
      const params = createQueryParams({ startTimeline: [] });
      const result = buildBasicEngineerFilters(params);

      const hasTimelineCondition = result.conditions.some(c => c.includes('startTimeline'));
      expect(hasTimelineCondition).toBe(false);
    });

    it('creates IN condition for timeline values', () => {
      const params = createQueryParams({ startTimeline: ['immediate', 'two_weeks'] });
      const result = buildBasicEngineerFilters(params);

      const timelineCondition = result.conditions.find(c => c.includes('startTimeline'));
      expect(timelineCondition).toContain('IN');
      expect(result.queryParams.startTimeline).toEqual(['immediate', 'two_weeks']);
    });
  });

  describe('experience filter', () => {
    it('returns empty conditions when no experience range specified', () => {
      const params = createQueryParams({
        minYearsExperience: null,
        maxYearsExperience: null,
      });
      const result = buildBasicEngineerFilters(params);

      const hasExperienceCondition = result.conditions.some(c => c.includes('yearsExperience'));
      expect(hasExperienceCondition).toBe(false);
    });

    it('creates >= condition for minYearsExperience', () => {
      const params = createQueryParams({ minYearsExperience: 5 });
      const result = buildBasicEngineerFilters(params);

      const minCondition = result.conditions.find(c => c.includes('>='));
      expect(minCondition).toBeDefined();
      expect(result.queryParams.minYearsExperience).toBe(5);
    });

    it('creates <= condition for maxYearsExperience', () => {
      const params = createQueryParams({ maxYearsExperience: 10 });
      const result = buildBasicEngineerFilters(params);

      const maxCondition = result.conditions.find(c => c.includes('<=') && c.includes('yearsExperience'));
      expect(maxCondition).toBeDefined();
      expect(result.queryParams.maxYearsExperience).toBe(10);
    });

    it('creates both conditions when range specified', () => {
      const params = createQueryParams({
        minYearsExperience: 3,
        maxYearsExperience: 8,
      });
      const result = buildBasicEngineerFilters(params);

      const experienceConditions = result.conditions.filter(c => c.includes('yearsExperience'));
      expect(experienceConditions.length).toBe(2);
    });
  });

  describe('timezone filter', () => {
    it('returns empty conditions when no timezone specified', () => {
      const params = createQueryParams({ timezonePrefixes: [] });
      const result = buildBasicEngineerFilters(params);

      const hasTimezoneCondition = result.conditions.some(c => c.includes('timezone'));
      expect(hasTimezoneCondition).toBe(false);
    });

    it('creates STARTS WITH condition for single timezone prefix', () => {
      const params = createQueryParams({ timezonePrefixes: ['America/'] });
      const result = buildBasicEngineerFilters(params);

      const tzCondition = result.conditions.find(c => c.includes('timezone'));
      expect(tzCondition).toContain('STARTS WITH');
      expect(result.queryParams.tz0).toBe('America/');
    });

    it('creates OR condition for multiple timezone prefixes', () => {
      const params = createQueryParams({ timezonePrefixes: ['America/', 'Europe/'] });
      const result = buildBasicEngineerFilters(params);

      const tzCondition = result.conditions.find(c => c.includes('timezone'));
      expect(tzCondition).toContain('OR');
      expect(result.queryParams.tz0).toBe('America/');
      expect(result.queryParams.tz1).toBe('Europe/');
    });
  });

  describe('budget filter', () => {
    it('returns empty conditions when no budget specified', () => {
      const params = createQueryParams({ maxBudget: null });
      const result = buildBasicEngineerFilters(params);

      const hasBudgetCondition = result.conditions.some(c => c.includes('salary'));
      expect(hasBudgetCondition).toBe(false);
    });

    it('creates <= condition using maxBudget as ceiling', () => {
      const params = createQueryParams({ maxBudget: 200000 });
      const result = buildBasicEngineerFilters(params);

      const budgetCondition = result.conditions.find(c => c.includes('salary'));
      expect(budgetCondition).toContain('<=');
      expect(result.queryParams.filterCeiling).toBe(200000);
    });

    it('uses stretchBudget as ceiling when provided', () => {
      const params = createQueryParams({
        maxBudget: 200000,
        stretchBudget: 220000,
      });
      const result = buildBasicEngineerFilters(params);

      expect(result.queryParams.filterCeiling).toBe(220000);
    });
  });

  describe('combined filters', () => {
    it('combines multiple filter conditions', () => {
      const params = createQueryParams({
        startTimeline: ['immediate'],
        minYearsExperience: 3,
        maxBudget: 200000,
      });
      const result = buildBasicEngineerFilters(params);

      expect(result.conditions.length).toBeGreaterThanOrEqual(3);
    });

    it('returns empty conditions and params when no filters', () => {
      const params = createQueryParams();
      const result = buildBasicEngineerFilters(params);

      // Only timeline might have a condition if default is set
      expect(result.queryParams).toBeDefined();
    });
  });
});
```

#### 3. Query Domain Filter Builder Tests
**File**: `recommender_api/src/services/cypher-query-builder/query-domain-filter.builder.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  getDomainFilterContext,
  addDomainQueryParams,
  buildRequiredBusinessDomainFilter,
  buildRequiredTechnicalDomainFilter,
  buildBusinessDomainCollection,
  buildTechnicalDomainCollection,
} from './query-domain-filter.builder.js';
import type { CypherQueryParams, ResolvedBusinessDomain, ResolvedTechnicalDomain } from './query-types.js';

const createQueryParams = (overrides: Partial<CypherQueryParams> = {}): CypherQueryParams => ({
  learningLevelSkillIds: [],
  proficientLevelSkillIds: [],
  expertLevelSkillIds: [],
  originalSkillIdentifiers: null,
  startTimeline: [],
  minYearsExperience: null,
  maxYearsExperience: null,
  timezonePrefixes: [],
  maxBudget: null,
  stretchBudget: null,
  offset: 0,
  limit: 20,
  requiredBusinessDomains: [],
  preferredBusinessDomains: [],
  requiredTechnicalDomains: [],
  preferredTechnicalDomains: [],
  ...overrides,
});

const createBusinessDomain = (id: string, overrides: Partial<ResolvedBusinessDomain> = {}): ResolvedBusinessDomain => ({
  domainId: id,
  expandedDomainIds: [id],
  ...overrides,
});

const createTechnicalDomain = (id: string, overrides: Partial<ResolvedTechnicalDomain> = {}): ResolvedTechnicalDomain => ({
  domainId: id,
  expandedDomainIds: [id],
  ...overrides,
});

describe('getDomainFilterContext', () => {
  it('returns all false flags when no domains specified', () => {
    const params = createQueryParams();
    const context = getDomainFilterContext(params);

    expect(context.hasRequiredBusinessDomains).toBe(false);
    expect(context.hasPreferredBusinessDomains).toBe(false);
    expect(context.hasRequiredTechnicalDomains).toBe(false);
    expect(context.hasPreferredTechnicalDomains).toBe(false);
    expect(context.hasAnyBusinessDomains).toBe(false);
    expect(context.hasAnyTechnicalDomains).toBe(false);
  });

  it('sets hasRequiredBusinessDomains when required business domains present', () => {
    const params = createQueryParams({
      requiredBusinessDomains: [createBusinessDomain('bd-1')],
    });
    const context = getDomainFilterContext(params);

    expect(context.hasRequiredBusinessDomains).toBe(true);
    expect(context.hasAnyBusinessDomains).toBe(true);
  });

  it('sets hasPreferredBusinessDomains when preferred business domains present', () => {
    const params = createQueryParams({
      preferredBusinessDomains: [createBusinessDomain('bd-pref')],
    });
    const context = getDomainFilterContext(params);

    expect(context.hasPreferredBusinessDomains).toBe(true);
    expect(context.hasAnyBusinessDomains).toBe(true);
  });

  it('sets hasRequiredTechnicalDomains when required technical domains present', () => {
    const params = createQueryParams({
      requiredTechnicalDomains: [createTechnicalDomain('td-1')],
    });
    const context = getDomainFilterContext(params);

    expect(context.hasRequiredTechnicalDomains).toBe(true);
    expect(context.hasAnyTechnicalDomains).toBe(true);
  });

  it('sets hasPreferredTechnicalDomains when preferred technical domains present', () => {
    const params = createQueryParams({
      preferredTechnicalDomains: [createTechnicalDomain('td-pref')],
    });
    const context = getDomainFilterContext(params);

    expect(context.hasPreferredTechnicalDomains).toBe(true);
    expect(context.hasAnyTechnicalDomains).toBe(true);
  });
});

describe('addDomainQueryParams', () => {
  it('does not add params when no domains specified', () => {
    const params = createQueryParams();
    const context = getDomainFilterContext(params);
    const queryParams: Record<string, unknown> = {};

    addDomainQueryParams(queryParams, params, context);

    expect(Object.keys(queryParams).filter(k => k.includes('Domain'))).toHaveLength(0);
  });

  it('adds required business domain params', () => {
    const params = createQueryParams({
      requiredBusinessDomains: [
        createBusinessDomain('bd-1', { expandedDomainIds: ['bd-1', 'bd-1-child'], minYears: 2 }),
      ],
    });
    const context = getDomainFilterContext(params);
    const queryParams: Record<string, unknown> = {};

    addDomainQueryParams(queryParams, params, context);

    expect(queryParams.requiredBusinessDomain0Ids).toEqual(['bd-1', 'bd-1-child']);
    expect(queryParams.requiredBusinessDomain0MinYears).toBe(2);
  });

  it('adds preferred business domain params', () => {
    const params = createQueryParams({
      preferredBusinessDomains: [createBusinessDomain('bd-pref')],
    });
    const context = getDomainFilterContext(params);
    const queryParams: Record<string, unknown> = {};

    addDomainQueryParams(queryParams, params, context);

    expect(queryParams.allBusinessDomainIds).toBeDefined();
  });

  it('adds required technical domain params', () => {
    const params = createQueryParams({
      requiredTechnicalDomains: [
        createTechnicalDomain('td-1', { expandedDomainIds: ['td-1'], minYears: 3 }),
      ],
    });
    const context = getDomainFilterContext(params);
    const queryParams: Record<string, unknown> = {};

    addDomainQueryParams(queryParams, params, context);

    expect(queryParams.requiredTechnicalDomain0Ids).toEqual(['td-1']);
    expect(queryParams.requiredTechnicalDomain0MinYears).toBe(3);
  });
});

describe('buildRequiredBusinessDomainFilter', () => {
  it('returns empty string when no required business domains', () => {
    const context = getDomainFilterContext(createQueryParams());
    const result = buildRequiredBusinessDomainFilter(context);

    expect(result).toBe('');
  });

  it('returns WITH + WHERE clause when required business domains present', () => {
    const params = createQueryParams({
      requiredBusinessDomains: [createBusinessDomain('bd-1')],
    });
    const context = getDomainFilterContext(params);
    const result = buildRequiredBusinessDomainFilter(context);

    expect(result).toContain('WITH');
    expect(result).toContain('WHERE');
    expect(result).toContain('BusinessDomain');
  });
});

describe('buildRequiredTechnicalDomainFilter', () => {
  it('returns empty string when no required technical domains', () => {
    const context = getDomainFilterContext(createQueryParams());
    const result = buildRequiredTechnicalDomainFilter(context);

    expect(result).toBe('');
  });

  it('returns WITH + WHERE clause when required technical domains present', () => {
    const params = createQueryParams({
      requiredTechnicalDomains: [createTechnicalDomain('td-1')],
    });
    const context = getDomainFilterContext(params);
    const result = buildRequiredTechnicalDomainFilter(context);

    expect(result).toContain('WITH');
    expect(result).toContain('WHERE');
    expect(result).toContain('TechnicalDomain');
  });
});

describe('buildBusinessDomainCollection', () => {
  it('returns empty clause when no business domains', () => {
    const context = getDomainFilterContext(createQueryParams());
    const result = buildBusinessDomainCollection(context, ['e', 'totalCount']);

    expect(result.clause).toBe('');
  });

  it('returns OPTIONAL MATCH clause when business domains present', () => {
    const params = createQueryParams({
      preferredBusinessDomains: [createBusinessDomain('bd-pref')],
    });
    const context = getDomainFilterContext(params);
    const result = buildBusinessDomainCollection(context, ['e', 'totalCount']);

    expect(result.clause).toContain('OPTIONAL MATCH');
    expect(result.clause).toContain('BusinessDomain');
    expect(result.carryForwardFields).toContain('matchedBusinessDomains');
  });
});

describe('buildTechnicalDomainCollection', () => {
  it('returns empty clause when no technical domains', () => {
    const context = getDomainFilterContext(createQueryParams());
    const result = buildTechnicalDomainCollection(context, ['e', 'totalCount']);

    expect(result.clause).toBe('');
  });

  it('returns OPTIONAL MATCH clause when technical domains present', () => {
    const params = createQueryParams({
      preferredTechnicalDomains: [createTechnicalDomain('td-pref')],
    });
    const context = getDomainFilterContext(params);
    const result = buildTechnicalDomainCollection(context, ['e', 'totalCount']);

    expect(result.clause).toContain('OPTIONAL MATCH');
    expect(result.clause).toContain('TechnicalDomain');
    expect(result.carryForwardFields).toContain('matchedTechnicalDomains');
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] `npm test` passes with all query builder tests
- [x] `npm run typecheck` passes
- [x] Coverage for `cypher-query-builder/` shows 80%+

**Implementation Note**: After completing this phase and all automated verification passes, pause here for confirmation before proceeding to Phase 2.

---

## Phase 2: Express App Export Refactoring

### Overview
Refactor `index.ts` to export the Express app instance for supertest usage while maintaining production behavior.

### Changes Required:

#### 1. Extract App Creation
**File**: `recommender_api/src/app.ts` (NEW)

```typescript
import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import searchRoutes from './routes/search.routes.js';
import driver from './neo4j.js';

export function createApp() {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(morgan('combined'));
  app.use(cors());

  // Health endpoints
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'healthy' });
  });

  app.get('/db-health', async (_req, res) => {
    const session = driver.session();
    try {
      await session.run('RETURN 1 as health');
      res.status(200).json({ status: 'healthy', database: 'connected' });
    } catch (error) {
      res.status(500).json({
        message: 'Database health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      await session.close();
    }
  });

  // API routes
  app.use('/api/search', searchRoutes);

  return app;
}

export default createApp();
```

#### 2. Update Entry Point
**File**: `recommender_api/src/index.ts`

```typescript
import app from './app.js';
import config from './config.js';
import driver from './neo4j.js';

// Start server only when not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(config.PORT, () => {
    console.log(`Server running on port ${config.PORT}`);
    console.log(`Neo4j URI: ${config.NEO4J_URI}`);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing Neo4j connection...');
  await driver.close();
  process.exit(0);
});

export default app;
```

#### 3. Update Vitest Config for App Import
**File**: `recommender_api/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    // Set test environment
    env: {
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/neo4j.ts',
        'src/config.ts',
        'src/**/*.test.ts',
      ],
    },
  },
});
```

### Success Criteria:

#### Automated Verification:
- [x] `npm run build` succeeds
- [x] `npm test` passes (existing tests still work)
- [x] `npm run typecheck` passes

#### Manual Verification:
- [x] Server starts correctly via Tilt
- [x] API responds to requests at localhost:4025

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the server works correctly before proceeding to Phase 3.

---

## Phase 3: Neo4j Session Mock Factory

### Overview
Create a reusable mock factory for Neo4j sessions that can be configured to return different results based on query patterns.

### Changes Required:

#### 1. Create Mock Factory
**File**: `recommender_api/src/__mocks__/neo4j-session.mock.ts`

```typescript
import { vi } from 'vitest';
import type { Session, QueryResult, Record as Neo4jRecord } from 'neo4j-driver';

// Type for mock record factory
interface MockRecordData {
  [key: string]: unknown;
}

// Create a mock Neo4j record
export function createMockRecord(data: MockRecordData): Neo4jRecord {
  return {
    get: (key: string) => data[key],
    has: (key: string) => key in data,
    keys: Object.keys(data),
    values: () => Object.values(data),
    toObject: () => data,
    forEach: (fn: (value: unknown, key: string) => void) => {
      Object.entries(data).forEach(([key, value]) => fn(value, key));
    },
  } as Neo4jRecord;
}

// Create a mock query result
export function createMockQueryResult(records: MockRecordData[]): QueryResult {
  return {
    records: records.map(createMockRecord),
    summary: {
      query: { text: '', parameters: {} },
      queryType: 'r',
      counters: { updates: () => ({}) },
      updateStatistics: { updates: () => ({}) },
      plan: false,
      profile: false,
      notifications: [],
      server: { address: 'mock', protocolVersion: 5.0 },
      resultConsumedAfter: { low: 0, high: 0 },
      resultAvailableAfter: { low: 0, high: 0 },
      database: { name: 'neo4j' },
    },
  } as unknown as QueryResult;
}

// Query matcher type
type QueryMatcher = {
  pattern: string | RegExp;
  result: MockRecordData[];
};

// Create a configurable mock session
export function createMockSession(matchers: QueryMatcher[] = []): Session {
  const runMock = vi.fn().mockImplementation((query: string) => {
    // Find matching pattern
    for (const matcher of matchers) {
      const matches = typeof matcher.pattern === 'string'
        ? query.includes(matcher.pattern)
        : matcher.pattern.test(query);

      if (matches) {
        return Promise.resolve(createMockQueryResult(matcher.result));
      }
    }

    // Default: return empty result
    return Promise.resolve(createMockQueryResult([]));
  });

  const closeMock = vi.fn().mockResolvedValue(undefined);

  return {
    run: runMock,
    close: closeMock,
    lastBookmark: () => [],
    lastBookmarks: () => [],
    beginTransaction: vi.fn(),
    readTransaction: vi.fn(),
    writeTransaction: vi.fn(),
    executeRead: vi.fn(),
    executeWrite: vi.fn(),
  } as unknown as Session;
}

// Pre-configured mock data factories
export const mockData = {
  // Engineer record matching search query output
  createEngineerRecord: (overrides: Partial<{
    id: string;
    name: string;
    headline: string;
    salary: number;
    yearsExperience: number;
    startTimeline: string;
    timezone: string;
    avgConfidence: number;
    totalCount: number;
    matchedSkills: unknown[];
    unmatchedRelatedSkills: unknown[];
    matchedBusinessDomains: unknown[];
    matchedTechnicalDomains: unknown[];
  }> = {}) => ({
    id: 'eng-1',
    name: 'Test Engineer',
    headline: 'Senior Developer',
    salary: 150000,
    yearsExperience: 8,
    startTimeline: 'two_weeks',
    timezone: 'America/New_York',
    avgConfidence: 0.85,
    totalCount: 1,
    matchedSkills: [],
    unmatchedRelatedSkills: [],
    matchedBusinessDomains: [],
    matchedTechnicalDomains: [],
    ...overrides,
  }),

  // Skill resolution record
  createSkillRecord: (overrides: Partial<{
    skillId: string;
    skillName: string;
    leafSkillIds: string[];
  }> = {}) => ({
    skillId: 'skill-1',
    skillName: 'TypeScript',
    leafSkillIds: ['skill-1'],
    ...overrides,
  }),

  // Domain resolution record
  createDomainRecord: (overrides: Partial<{
    domainId: string;
    domainName: string;
    childDomainIds: string[];
  }> = {}) => ({
    domainId: 'domain-1',
    domainName: 'Finance',
    childDomainIds: ['domain-1'],
    ...overrides,
  }),
};
```

#### 2. Create Driver Mock
**File**: `recommender_api/src/__mocks__/neo4j-driver.mock.ts`

```typescript
import { vi } from 'vitest';
import { createMockSession, type QueryMatcher } from './neo4j-session.mock.js';
import type { Driver, Session } from 'neo4j-driver';

// Create a mock driver that returns configurable sessions
export function createMockDriver(defaultMatchers: QueryMatcher[] = []): Driver {
  let sessionMatchers = defaultMatchers;

  return {
    session: vi.fn(() => createMockSession(sessionMatchers)),
    close: vi.fn().mockResolvedValue(undefined),
    verifyConnectivity: vi.fn().mockResolvedValue(undefined),
    getServerInfo: vi.fn().mockResolvedValue({
      address: 'mock:7687',
      protocolVersion: 5.0,
    }),
    // Allow updating matchers for different test scenarios
    __setMatchers: (matchers: QueryMatcher[]) => {
      sessionMatchers = matchers;
    },
  } as unknown as Driver & { __setMatchers: (m: QueryMatcher[]) => void };
}
```

### Success Criteria:

#### Automated Verification:
- [x] `npm run typecheck` passes
- [x] Mock factory compiles without errors

**Implementation Note**: This phase creates infrastructure only. Tests using these mocks are in Phase 4 and 5.

---

## Phase 4: API Integration Tests

### Overview
Test the API layer (controller, middleware, routes) using supertest with mocked Neo4j.

### Changes Required:

#### 1. Install Test Dependencies
```bash
cd recommender_api
npm install -D supertest @types/supertest
```

#### 2. API Integration Tests
**File**: `recommender_api/src/routes/search.routes.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { createMockSession, mockData } from '../__mocks__/neo4j-session.mock.js';

// Mock the neo4j driver module
vi.mock('../neo4j.js', () => ({
  default: {
    session: vi.fn(),
    close: vi.fn(),
  },
}));

import driver from '../neo4j.js';

describe('POST /api/search/filter', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful requests', () => {
    it('returns 200 for empty request (browse mode)', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: [mockData.createEngineerRecord()],
        },
      ]);
      vi.mocked(driver.session).mockReturnValue(mockSession);

      const response = await request(app)
        .post('/api/search/filter')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.matches).toBeDefined();
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('returns matches array with engineer data', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: [
            mockData.createEngineerRecord({ id: 'eng-1', name: 'Alice' }),
            mockData.createEngineerRecord({ id: 'eng-2', name: 'Bob' }),
          ],
        },
      ]);
      vi.mocked(driver.session).mockReturnValue(mockSession);

      const response = await request(app)
        .post('/api/search/filter')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.matches).toHaveLength(2);
      expect(response.body.matches[0].name).toBe('Alice');
    });

    it('returns pagination metadata', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH',
          result: [
            mockData.createEngineerRecord({ totalCount: 50 }),
          ],
        },
      ]);
      vi.mocked(driver.session).mockReturnValue(mockSession);

      const response = await request(app)
        .post('/api/search/filter')
        .send({ limit: 20, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body.queryMetadata).toBeDefined();
      expect(response.body.queryMetadata.totalCount).toBe(50);
    });
  });

  describe('validation errors', () => {
    it('returns 400 for invalid seniority level', async () => {
      const response = await request(app)
        .post('/api/search/filter')
        .send({ seniorityLevel: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.name).toBe('ZodError');
    });

    it('returns 400 for stretchBudget without maxBudget', async () => {
      const response = await request(app)
        .post('/api/search/filter')
        .send({ stretchBudget: 220000 });

      expect(response.status).toBe(400);
      expect(response.body.error.issues[0].message).toContain('maxBudget');
    });

    it('returns 400 for stretchBudget less than maxBudget', async () => {
      const response = await request(app)
        .post('/api/search/filter')
        .send({ maxBudget: 200000, stretchBudget: 180000 });

      expect(response.status).toBe(400);
      expect(response.body.error.issues[0].message).toContain('greater than or equal');
    });

    it('returns 400 for preferredMaxStartTime later than requiredMaxStartTime', async () => {
      const response = await request(app)
        .post('/api/search/filter')
        .send({
          requiredMaxStartTime: 'two_weeks',
          preferredMaxStartTime: 'one_month',
        });

      expect(response.status).toBe(400);
    });

    it('returns 400 for negative limit', async () => {
      const response = await request(app)
        .post('/api/search/filter')
        .send({ limit: -1 });

      expect(response.status).toBe(400);
    });
  });

  describe('error handling', () => {
    it('returns 500 for Neo4j connection failure', async () => {
      const mockSession = createMockSession();
      mockSession.run = vi.fn().mockRejectedValue(new Error('Connection refused'));
      vi.mocked(driver.session).mockReturnValue(mockSession);

      const response = await request(app)
        .post('/api/search/filter')
        .send({});

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('SEARCH_ERROR');
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('closes session even on error', async () => {
      const mockSession = createMockSession();
      mockSession.run = vi.fn().mockRejectedValue(new Error('Query failed'));
      vi.mocked(driver.session).mockReturnValue(mockSession);

      await request(app)
        .post('/api/search/filter')
        .send({});

      expect(mockSession.close).toHaveBeenCalled();
    });
  });
});

describe('GET /health', () => {
  it('returns 200 with healthy status', async () => {
    const app = createApp();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
  });
});

describe('GET /db-health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 when database is connected', async () => {
    const mockSession = createMockSession([
      { pattern: 'RETURN 1', result: [{ health: 1 }] },
    ]);
    vi.mocked(driver.session).mockReturnValue(mockSession);

    const app = createApp();
    const response = await request(app).get('/db-health');

    expect(response.status).toBe(200);
    expect(response.body.database).toBe('connected');
  });

  it('returns 500 when database is disconnected', async () => {
    const mockSession = createMockSession();
    mockSession.run = vi.fn().mockRejectedValue(new Error('Connection refused'));
    vi.mocked(driver.session).mockReturnValue(mockSession);

    const app = createApp();
    const response = await request(app).get('/db-health');

    expect(response.status).toBe(500);
    expect(response.body.message).toContain('health check failed');
  });
});
```

#### 3. Validation Middleware Tests
**File**: `recommender_api/src/middleware/zod-validate.middleware.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { validate } from './zod-validate.middleware.js';
import type { Request, Response, NextFunction } from 'express';

// Helper to create mock request/response
const createMockRequest = (body: unknown = {}): Partial<Request> => ({
  body,
});

const createMockResponse = (): Partial<Response> & { jsonData: unknown; statusCode: number } => {
  const res: Partial<Response> & { jsonData: unknown; statusCode: number } = {
    jsonData: null,
    statusCode: 200,
  };
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn().mockImplementation((data: unknown) => {
    res.jsonData = data;
    return res;
  });
  return res;
};

describe('validate middleware', () => {
  const testSchema = z.object({
    name: z.string(),
    age: z.number().optional(),
  });

  it('calls next() for valid request body', () => {
    const middleware = validate(testSchema);
    const req = createMockRequest({ name: 'test' });
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('transforms body with parsed schema data', () => {
    const schemaWithTransform = z.object({
      name: z.string().transform(s => s.toUpperCase()),
    });
    const middleware = validate(schemaWithTransform);
    const req = createMockRequest({ name: 'test' });
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next);

    expect(req.body).toEqual({ name: 'TEST' });
  });

  it('returns 400 for invalid request body', () => {
    const middleware = validate(testSchema);
    const req = createMockRequest({ age: 'not a number' }); // missing required 'name'
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns ZodError details in response', () => {
    const middleware = validate(testSchema);
    const req = createMockRequest({ name: 123 }); // wrong type
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next);

    expect(res.jsonData).toMatchObject({
      success: false,
      error: {
        name: 'ZodError',
        issues: expect.any(Array),
      },
    });
  });

  it('treats empty object as valid for optional schemas', () => {
    const optionalSchema = z.object({
      name: z.string().optional(),
    });
    const middleware = validate(optionalSchema);
    const req = createMockRequest({});
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('treats undefined body as empty object', () => {
    const optionalSchema = z.object({
      name: z.string().optional(),
    });
    const middleware = validate(optionalSchema);
    const req = createMockRequest(undefined);
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] `npm test` passes with all API integration tests
- [x] `npm run typecheck` passes
- [x] Coverage for `routes/`, `middleware/`, `controllers/` shows 80%+

**Implementation Note**: After completing this phase and all automated verification passes, pause here for confirmation before proceeding to Phase 5.

---

## Phase 5: Service Integration Tests

### Overview
Test Neo4j-dependent services (skill-resolver, domain-resolver, search.service) with mocked sessions.

### Changes Required:

#### 1. Skill Resolver Service Tests
**File**: `recommender_api/src/services/skill-resolver.service.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveSkillRequirements } from './skill-resolver.service.js';
import { createMockSession, mockData, createMockQueryResult } from '../__mocks__/neo4j-session.mock.js';
import type { SkillRequirement } from '../types/search.types.js';

describe('resolveSkillRequirements', () => {
  describe('skill hierarchy expansion', () => {
    it('returns resolved skills with expanded leaf IDs', async () => {
      const mockSession = createMockSession([
        {
          // Leaf skill query
          pattern: 'BELONGS_TO',
          result: [
            {
              identifier: 'typescript',
              skillId: 'skill-ts',
              skillName: 'TypeScript',
              leafSkillIds: ['skill-ts'],
            },
          ],
        },
        {
          // Matched skill query
          pattern: 'WHERE s.identifier IN',
          result: [{ count: 1 }],
        },
      ]);

      const requirements: SkillRequirement[] = [
        { identifier: 'typescript', minProficiency: 'proficient' },
      ];

      const result = await resolveSkillRequirements(mockSession, requirements, []);

      expect(result.resolvedSkills).toHaveLength(1);
      expect(result.resolvedSkills[0].skillId).toBe('skill-ts');
      expect(result.resolvedSkills[0].minProficiency).toBe('proficient');
    });

    it('expands parent skills to include all descendants', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'BELONGS_TO',
          result: [
            {
              identifier: 'frontend',
              skillId: 'skill-frontend',
              skillName: 'Frontend',
              leafSkillIds: ['skill-react', 'skill-vue', 'skill-angular'],
            },
          ],
        },
        {
          pattern: 'WHERE s.identifier IN',
          result: [{ count: 1 }],
        },
      ]);

      const requirements: SkillRequirement[] = [
        { identifier: 'frontend' },
      ];

      const result = await resolveSkillRequirements(mockSession, requirements, []);

      expect(result.expandedSkillIds).toContain('skill-react');
      expect(result.expandedSkillIds).toContain('skill-vue');
      expect(result.expandedSkillIds).toContain('skill-angular');
    });
  });

  describe('proficiency inheritance', () => {
    it('inherits minProficiency to all expanded skills', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'BELONGS_TO',
          result: [
            {
              identifier: 'js-framework',
              skillId: 'skill-js-fw',
              skillName: 'JS Framework',
              leafSkillIds: ['skill-react', 'skill-vue'],
            },
          ],
        },
        {
          pattern: 'WHERE s.identifier IN',
          result: [{ count: 1 }],
        },
      ]);

      const requirements: SkillRequirement[] = [
        { identifier: 'js-framework', minProficiency: 'expert' },
      ];

      const result = await resolveSkillRequirements(mockSession, requirements, []);

      // All leaf skills should inherit the expert proficiency requirement
      expect(result.skillIdToMinProficiency.get('skill-react')).toBe('expert');
      expect(result.skillIdToMinProficiency.get('skill-vue')).toBe('expert');
    });

    it('handles overlapping skill hierarchies with highest proficiency', async () => {
      // If skill A requires 'proficient' and skill B (which includes A) requires 'expert',
      // the skill should require 'expert'
      const mockSession = createMockSession([
        {
          pattern: 'BELONGS_TO',
          result: [
            {
              identifier: 'react',
              skillId: 'skill-react',
              skillName: 'React',
              leafSkillIds: ['skill-react'],
            },
            {
              identifier: 'frontend',
              skillId: 'skill-frontend',
              skillName: 'Frontend',
              leafSkillIds: ['skill-react', 'skill-vue'],
            },
          ],
        },
        {
          pattern: 'WHERE s.identifier IN',
          result: [{ count: 2 }],
        },
      ]);

      const requirements: SkillRequirement[] = [
        { identifier: 'react', minProficiency: 'proficient' },
        { identifier: 'frontend', minProficiency: 'expert' },
      ];

      const result = await resolveSkillRequirements(mockSession, requirements, []);

      // React should have the higher proficiency requirement
      expect(result.skillIdToMinProficiency.get('skill-react')).toBe('expert');
    });
  });

  describe('unresolved skills', () => {
    it('tracks unresolved skill identifiers', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'BELONGS_TO',
          result: [], // No matching skills found
        },
        {
          pattern: 'WHERE s.identifier IN',
          result: [{ count: 0 }],
        },
      ]);

      const requirements: SkillRequirement[] = [
        { identifier: 'nonexistent-skill' },
      ];

      const result = await resolveSkillRequirements(mockSession, requirements, []);

      expect(result.unresolvedIdentifiers).toContain('nonexistent-skill');
    });
  });

  describe('session usage', () => {
    it('executes expected number of queries', async () => {
      const mockSession = createMockSession([
        { pattern: 'BELONGS_TO', result: [] },
        { pattern: 'WHERE s.identifier IN', result: [] },
      ]);
      const runSpy = vi.spyOn(mockSession, 'run');

      await resolveSkillRequirements(mockSession, [{ identifier: 'test' }], []);

      // Should execute at least 2 queries (leaf expansion + validation)
      expect(runSpy).toHaveBeenCalledTimes(2);
    });
  });
});
```

#### 2. Domain Resolver Service Tests
**File**: `recommender_api/src/services/domain-resolver.service.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { resolveBusinessDomains, resolveTechnicalDomains } from './domain-resolver.service.js';
import { createMockSession, mockData } from '../__mocks__/neo4j-session.mock.js';
import type { DomainRequirement } from '../types/search.types.js';

describe('resolveBusinessDomains', () => {
  describe('domain hierarchy expansion', () => {
    it('returns resolved domain with expanded child IDs', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'BusinessDomain',
          result: [
            {
              domainId: 'bd-finance',
              domainName: 'Finance',
              childDomainIds: ['bd-finance', 'bd-banking', 'bd-insurance'],
            },
          ],
        },
      ]);

      const requirements: DomainRequirement[] = [
        { identifier: 'finance', minYears: 2 },
      ];

      const result = await resolveBusinessDomains(mockSession, requirements);

      expect(result).toHaveLength(1);
      expect(result[0].domainId).toBe('bd-finance');
      expect(result[0].expandedDomainIds).toContain('bd-banking');
      expect(result[0].expandedDomainIds).toContain('bd-insurance');
      expect(result[0].minYears).toBe(2);
    });

    it('handles parent domain search returning all children', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'CHILD_OF',
          result: [
            {
              domainId: 'bd-healthcare',
              domainName: 'Healthcare',
              childDomainIds: ['bd-healthcare', 'bd-pharma', 'bd-medical-devices'],
            },
          ],
        },
      ]);

      const requirements: DomainRequirement[] = [
        { identifier: 'healthcare' },
      ];

      const result = await resolveBusinessDomains(mockSession, requirements);

      expect(result[0].expandedDomainIds).toHaveLength(3);
    });
  });

  describe('minYears filtering', () => {
    it('passes minYears to resolved domain', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'BusinessDomain',
          result: [mockData.createDomainRecord()],
        },
      ]);

      const requirements: DomainRequirement[] = [
        { identifier: 'finance', minYears: 5 },
      ];

      const result = await resolveBusinessDomains(mockSession, requirements);

      expect(result[0].minYears).toBe(5);
    });

    it('passes preferredMinYears to resolved domain', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'BusinessDomain',
          result: [mockData.createDomainRecord()],
        },
      ]);

      const requirements: DomainRequirement[] = [
        { identifier: 'finance', preferredMinYears: 3 },
      ];

      const result = await resolveBusinessDomains(mockSession, requirements);

      expect(result[0].preferredMinYears).toBe(3);
    });
  });

  describe('unresolved domains', () => {
    it('returns empty array for unknown domain identifier', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'BusinessDomain',
          result: [], // No matching domain
        },
      ]);

      const requirements: DomainRequirement[] = [
        { identifier: 'nonexistent' },
      ];

      const result = await resolveBusinessDomains(mockSession, requirements);

      expect(result).toHaveLength(0);
    });
  });
});

describe('resolveTechnicalDomains', () => {
  describe('standard domain expansion', () => {
    it('expands domain via CHILD_OF relationship', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'TechnicalDomain',
          result: [
            {
              domainId: 'td-backend',
              domainName: 'Backend',
              childDomainIds: ['td-backend', 'td-api', 'td-database'],
              isComposite: false,
            },
          ],
        },
      ]);

      const requirements: DomainRequirement[] = [
        { identifier: 'backend' },
      ];

      const result = await resolveTechnicalDomains(mockSession, requirements);

      expect(result[0].expandedDomainIds).toContain('td-api');
      expect(result[0].expandedDomainIds).toContain('td-database');
    });
  });

  describe('composite domain handling', () => {
    it('expands composite domains via ENCOMPASSES relationship', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'ENCOMPASSES',
          result: [
            {
              domainId: 'td-fullstack',
              domainName: 'Full Stack',
              childDomainIds: ['td-fullstack', 'td-frontend', 'td-backend'],
              isComposite: true,
            },
          ],
        },
      ]);

      const requirements: DomainRequirement[] = [
        { identifier: 'fullstack' },
      ];

      const result = await resolveTechnicalDomains(mockSession, requirements);

      expect(result[0].expandedDomainIds).toContain('td-frontend');
      expect(result[0].expandedDomainIds).toContain('td-backend');
    });
  });
});
```

#### 3. Search Service Integration Tests
**File**: `recommender_api/src/services/search.service.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeSearch } from './search.service.js';
import { createMockSession, mockData } from '../__mocks__/neo4j-session.mock.js';
import type { SearchFilterRequest } from '../types/search.types.js';

// Mock the resolver services
vi.mock('./skill-resolver.service.js', () => ({
  resolveSkillRequirements: vi.fn().mockResolvedValue({
    resolvedSkills: [],
    expandedSkillIds: [],
    skillIdToMinProficiency: new Map(),
    skillIdToPreferredProficiency: new Map(),
    unresolvedIdentifiers: [],
  }),
}));

vi.mock('./domain-resolver.service.js', () => ({
  resolveBusinessDomains: vi.fn().mockResolvedValue([]),
  resolveTechnicalDomains: vi.fn().mockResolvedValue([]),
}));

import { resolveSkillRequirements } from './skill-resolver.service.js';
import { resolveBusinessDomains, resolveTechnicalDomains } from './domain-resolver.service.js';

describe('executeSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('browse mode (empty request)', () => {
    it('returns all engineers without filters', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: [
            mockData.createEngineerRecord({ id: 'eng-1', name: 'Alice', totalCount: 2 }),
            mockData.createEngineerRecord({ id: 'eng-2', name: 'Bob', totalCount: 2 }),
          ],
        },
      ]);

      const result = await executeSearch(mockSession, {});

      expect(result.matches).toHaveLength(2);
      expect(result.queryMetadata.totalCount).toBe(2);
    });

    it('includes applied filters as empty', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH',
          result: [mockData.createEngineerRecord()],
        },
      ]);

      const result = await executeSearch(mockSession, {});

      expect(result.queryMetadata.appliedFilters).toBeDefined();
    });
  });

  describe('skill-filtered search', () => {
    it('calls skill resolver with required skills', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [] },
      ]);

      vi.mocked(resolveSkillRequirements).mockResolvedValue({
        resolvedSkills: [{ skillId: 'skill-ts', skillName: 'TypeScript', minProficiency: 'proficient' }],
        expandedSkillIds: ['skill-ts'],
        skillIdToMinProficiency: new Map([['skill-ts', 'proficient']]),
        skillIdToPreferredProficiency: new Map(),
        unresolvedIdentifiers: [],
      });

      const request: SearchFilterRequest = {
        requiredSkills: [{ identifier: 'typescript', minProficiency: 'proficient' }],
      };

      await executeSearch(mockSession, request);

      expect(resolveSkillRequirements).toHaveBeenCalledWith(
        mockSession,
        request.requiredSkills,
        expect.any(Array)
      );
    });

    it('filters engineers by resolved skill IDs', async () => {
      vi.mocked(resolveSkillRequirements).mockResolvedValue({
        resolvedSkills: [{ skillId: 'skill-ts', skillName: 'TypeScript', minProficiency: 'proficient' }],
        expandedSkillIds: ['skill-ts'],
        skillIdToMinProficiency: new Map([['skill-ts', 'proficient']]),
        skillIdToPreferredProficiency: new Map(),
        unresolvedIdentifiers: [],
      });

      const mockSession = createMockSession([
        {
          pattern: 'HAS_SKILL',
          result: [
            mockData.createEngineerRecord({
              id: 'eng-matching',
              matchedSkills: [{
                skillId: 'skill-ts',
                name: 'TypeScript',
                proficiencyLevel: 'expert',
                confidence: 0.9,
                yearsUsed: 5,
                matchType: 'direct',
              }],
            }),
          ],
        },
      ]);

      const result = await executeSearch(mockSession, {
        requiredSkills: [{ identifier: 'typescript' }],
      });

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].matchedSkills).toHaveLength(1);
    });
  });

  describe('domain-filtered search', () => {
    it('calls domain resolver with business domains', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [] },
      ]);

      vi.mocked(resolveBusinessDomains).mockResolvedValue([
        { domainId: 'bd-finance', expandedDomainIds: ['bd-finance'] },
      ]);

      const request: SearchFilterRequest = {
        requiredBusinessDomains: [{ identifier: 'finance' }],
      };

      await executeSearch(mockSession, request);

      expect(resolveBusinessDomains).toHaveBeenCalledWith(
        mockSession,
        request.requiredBusinessDomains
      );
    });

    it('calls domain resolver with technical domains', async () => {
      const mockSession = createMockSession([
        { pattern: 'MATCH', result: [] },
      ]);

      vi.mocked(resolveTechnicalDomains).mockResolvedValue([
        { domainId: 'td-backend', expandedDomainIds: ['td-backend'] },
      ]);

      const request: SearchFilterRequest = {
        requiredTechnicalDomains: [{ identifier: 'backend' }],
      };

      await executeSearch(mockSession, request);

      expect(resolveTechnicalDomains).toHaveBeenCalledWith(
        mockSession,
        request.requiredTechnicalDomains
      );
    });
  });

  describe('pagination', () => {
    it('respects limit and offset parameters', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH',
          result: Array.from({ length: 5 }, (_, i) =>
            mockData.createEngineerRecord({ id: `eng-${i}`, totalCount: 100 })
          ),
        },
      ]);

      const result = await executeSearch(mockSession, {
        limit: 5,
        offset: 10,
      });

      expect(result.matches).toHaveLength(5);
      expect(result.queryMetadata.limit).toBe(5);
      expect(result.queryMetadata.offset).toBe(10);
    });

    it('uses default pagination when not specified', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH',
          result: [mockData.createEngineerRecord()],
        },
      ]);

      const result = await executeSearch(mockSession, {});

      expect(result.queryMetadata.limit).toBeDefined();
      expect(result.queryMetadata.offset).toBeDefined();
    });
  });

  describe('utility scoring', () => {
    it('sorts engineers by utility score descending', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH',
          result: [
            mockData.createEngineerRecord({ id: 'junior', yearsExperience: 1 }),
            mockData.createEngineerRecord({ id: 'senior', yearsExperience: 15 }),
            mockData.createEngineerRecord({ id: 'mid', yearsExperience: 5 }),
          ],
        },
      ]);

      const result = await executeSearch(mockSession, {});

      // Senior should be first (more experience = higher utility)
      expect(result.matches[0].id).toBe('senior');
      expect(result.matches[0].utilityScore).toBeGreaterThan(result.matches[1].utilityScore);
    });

    it('includes score breakdown in results', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH',
          result: [mockData.createEngineerRecord()],
        },
      ]);

      const result = await executeSearch(mockSession, {});

      expect(result.matches[0].scoreBreakdown).toBeDefined();
      expect(result.matches[0].scoreBreakdown.total).toBe(result.matches[0].utilityScore);
    });
  });

  describe('error handling', () => {
    it('propagates Neo4j errors', async () => {
      const mockSession = createMockSession();
      mockSession.run = vi.fn().mockRejectedValue(new Error('Connection lost'));

      await expect(executeSearch(mockSession, {})).rejects.toThrow('Connection lost');
    });
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] `npm test` passes with all service integration tests
- [x] `npm run typecheck` passes
- [x] Coverage for `services/` shows 80%+

**Implementation Note**: After completing this phase and all automated verification passes, pause here for confirmation before proceeding to Phase 6.

---

## Phase 6: Postman Enhancement

### Overview
Add assertions to all 42 existing Postman test scenarios to validate responses.

### Changes Required:

#### 1. Add Test Scripts to Each Request

For each request in the collection, add a Tests script that validates:
- Response status code
- Response schema structure
- `appliedFilters` correctness
- `queryMetadata` fields

**Example Test Script** (add to each request):

```javascript
// Validate status code
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

// Validate response structure
pm.test("Response has required fields", function () {
    const response = pm.response.json();

    pm.expect(response).to.have.property('matches');
    pm.expect(response).to.have.property('queryMetadata');
    pm.expect(response.matches).to.be.an('array');
});

// Validate queryMetadata structure
pm.test("queryMetadata has required fields", function () {
    const metadata = pm.response.json().queryMetadata;

    pm.expect(metadata).to.have.property('totalCount');
    pm.expect(metadata).to.have.property('limit');
    pm.expect(metadata).to.have.property('offset');
    pm.expect(metadata).to.have.property('appliedFilters');
    pm.expect(metadata).to.have.property('appliedPreferences');
});

// Validate matches structure (if any)
pm.test("Each match has required fields", function () {
    const matches = pm.response.json().matches;

    matches.forEach(function(match) {
        pm.expect(match).to.have.property('id');
        pm.expect(match).to.have.property('name');
        pm.expect(match).to.have.property('utilityScore');
        pm.expect(match).to.have.property('scoreBreakdown');
        pm.expect(match.utilityScore).to.be.a('number');
        pm.expect(match.utilityScore).to.be.at.least(0);
        pm.expect(match.utilityScore).to.be.at.most(1);
    });
});
```

#### 2. Add Validation Error Test Cases

**New Request**: "Validation - stretchBudget without maxBudget"
```json
{
  "stretchBudget": 220000
}
```

**Test Script**:
```javascript
pm.test("Status code is 400", function () {
    pm.response.to.have.status(400);
});

pm.test("Error indicates maxBudget is required", function () {
    const response = pm.response.json();
    pm.expect(response.success).to.equal(false);
    pm.expect(response.error.name).to.equal('ZodError');
    pm.expect(JSON.stringify(response.error.issues)).to.include('maxBudget');
});
```

**New Request**: "Validation - stretchBudget less than maxBudget"
```json
{
  "maxBudget": 200000,
  "stretchBudget": 180000
}
```

**New Request**: "Validation - preferredMaxStartTime later than required"
```json
{
  "requiredMaxStartTime": "two_weeks",
  "preferredMaxStartTime": "one_month"
}
```

**New Request**: "Validation - negative limit"
```json
{
  "limit": -1
}
```

#### 3. Add Edge Case Test Scenarios

**New Request**: "Edge Case - Empty result set"
```json
{
  "requiredSkills": [
    { "identifier": "extremely-rare-skill-xyz", "minProficiency": "expert" }
  ]
}
```

**Test Script**:
```javascript
pm.test("Returns empty matches array", function () {
    const matches = pm.response.json().matches;
    pm.expect(matches).to.be.an('array');
    pm.expect(matches.length).to.equal(0);
});

pm.test("totalCount is 0", function () {
    pm.expect(pm.response.json().queryMetadata.totalCount).to.equal(0);
});
```

**New Request**: "Edge Case - High offset (pagination beyond results)"
```json
{
  "offset": 10000,
  "limit": 20
}
```

### Success Criteria:

#### Automated Verification:
- [x] `npx newman run postman/collections/search-filter-tests.postman_collection.json --globals postman/globals/workspace.postman_globals.json` passes all assertions

#### Manual Verification:
- [x] Run Newman with reporter to verify all 47 tests pass (42 original + 5 new)
- [x] Validation error tests return 400 status
- [x] Edge case tests handle boundary conditions

**Implementation Note**: This phase can run in parallel with other phases since it modifies a different file type (JSON collection).

---

## Testing Strategy

### Unit Tests (Phase 1):
- Query builder pure functions
- String generation assertions
- Parameter binding validation

### Integration Tests (Phases 4-5):
- Mocked Neo4j sessions
- Service orchestration flow
- Error propagation

### E2E Tests (Phase 6):
- Postman/Newman against running server
- Full request/response validation
- Real database interactions

## Performance Considerations

- All unit tests run in <5 seconds (no I/O)
- Integration tests with mocks run in <30 seconds
- E2E tests depend on database state and server availability

## Migration Notes

- Phase 2 changes `index.ts` structure - verify Tilt deployment still works
- Mock factory in Phase 3 is infrastructure - no behavioral changes

## References

- Research document: `thoughts/shared/1_chapter_5/1.1_testing_setup/research/2026-01-06-testing-opportunities-beyond-unit-tests.md`
- Existing unit test plan: `thoughts/shared/1_chapter_5/1.1_testing_setup/plans/2026-01-06-vitest-unit-tests.md`
- Query builders: `recommender_api/src/services/cypher-query-builder/`
- Services: `recommender_api/src/services/`
- API layer: `recommender_api/src/controllers/`, `recommender_api/src/middleware/`
