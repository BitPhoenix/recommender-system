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
  timezoneZones: [],
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

  it('handles both required and preferred business domains', () => {
    const params = createQueryParams({
      requiredBusinessDomains: [createBusinessDomain('bd-req')],
      preferredBusinessDomains: [createBusinessDomain('bd-pref')],
    });
    const context = getDomainFilterContext(params);

    expect(context.hasRequiredBusinessDomains).toBe(true);
    expect(context.hasPreferredBusinessDomains).toBe(true);
    expect(context.hasAnyBusinessDomains).toBe(true);
  });

  it('handles both required and preferred technical domains', () => {
    const params = createQueryParams({
      requiredTechnicalDomains: [createTechnicalDomain('td-req')],
      preferredTechnicalDomains: [createTechnicalDomain('td-pref')],
    });
    const context = getDomainFilterContext(params);

    expect(context.hasRequiredTechnicalDomains).toBe(true);
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

    // Should not have domain-related params
    expect(queryParams.requiredBusinessDomains).toBeUndefined();
    expect(queryParams.preferredBusinessDomains).toBeUndefined();
    expect(queryParams.requiredTechDomains).toBeUndefined();
    expect(queryParams.preferredTechDomains).toBeUndefined();
    expect(queryParams.allBusinessDomainIds).toBeUndefined();
    expect(queryParams.allTechDomainIds).toBeUndefined();
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

    expect(queryParams.requiredBusinessDomains).toBeDefined();
    const reqDomains = queryParams.requiredBusinessDomains as Array<{ expandedDomainIds: string[]; minYears: number | null }>;
    expect(reqDomains[0].expandedDomainIds).toEqual(['bd-1', 'bd-1-child']);
    expect(reqDomains[0].minYears).toBe(2);
  });

  it('adds preferred business domain params with allBusinessDomainIds', () => {
    const params = createQueryParams({
      preferredBusinessDomains: [createBusinessDomain('bd-pref')],
    });
    const context = getDomainFilterContext(params);
    const queryParams: Record<string, unknown> = {};

    addDomainQueryParams(queryParams, params, context);

    expect(queryParams.allBusinessDomainIds).toBeDefined();
    expect(queryParams.preferredBusinessDomains).toBeDefined();
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

    expect(queryParams.requiredTechDomains).toBeDefined();
    const reqDomains = queryParams.requiredTechDomains as Array<{ expandedDomainIds: string[]; minYears: number | null }>;
    expect(reqDomains[0].expandedDomainIds).toEqual(['td-1']);
    expect(reqDomains[0].minYears).toBe(3);
  });

  it('adds preferred technical domain params with allTechDomainIds', () => {
    const params = createQueryParams({
      preferredTechnicalDomains: [createTechnicalDomain('td-pref')],
    });
    const context = getDomainFilterContext(params);
    const queryParams: Record<string, unknown> = {};

    addDomainQueryParams(queryParams, params, context);

    expect(queryParams.allTechDomainIds).toBeDefined();
    expect(queryParams.preferredTechDomains).toBeDefined();
  });

  it('deduplicates allBusinessDomainIds when same domain in required and preferred', () => {
    const params = createQueryParams({
      requiredBusinessDomains: [createBusinessDomain('bd-shared')],
      preferredBusinessDomains: [createBusinessDomain('bd-shared')],
    });
    const context = getDomainFilterContext(params);
    const queryParams: Record<string, unknown> = {};

    addDomainQueryParams(queryParams, params, context);

    const allIds = queryParams.allBusinessDomainIds as string[];
    expect(allIds).toHaveLength(1);
    expect(allIds).toContain('bd-shared');
  });

  it('deduplicates allTechDomainIds when same domain in required and preferred', () => {
    const params = createQueryParams({
      requiredTechnicalDomains: [createTechnicalDomain('td-shared')],
      preferredTechnicalDomains: [createTechnicalDomain('td-shared')],
    });
    const context = getDomainFilterContext(params);
    const queryParams: Record<string, unknown> = {};

    addDomainQueryParams(queryParams, params, context);

    const allIds = queryParams.allTechDomainIds as string[];
    expect(allIds).toHaveLength(1);
    expect(allIds).toContain('td-shared');
  });

  it('combines expanded IDs from multiple domains', () => {
    const params = createQueryParams({
      requiredBusinessDomains: [
        createBusinessDomain('bd-1', { expandedDomainIds: ['bd-1', 'bd-1a'] }),
        createBusinessDomain('bd-2', { expandedDomainIds: ['bd-2', 'bd-2a'] }),
      ],
    });
    const context = getDomainFilterContext(params);
    const queryParams: Record<string, unknown> = {};

    addDomainQueryParams(queryParams, params, context);

    const allIds = queryParams.allBusinessDomainIds as string[];
    expect(allIds).toContain('bd-1');
    expect(allIds).toContain('bd-1a');
    expect(allIds).toContain('bd-2');
    expect(allIds).toContain('bd-2a');
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

  it('includes ALL constraint for checking each required domain', () => {
    const params = createQueryParams({
      requiredBusinessDomains: [createBusinessDomain('bd-1')],
    });
    const context = getDomainFilterContext(params);
    const result = buildRequiredBusinessDomainFilter(context);

    expect(result).toContain('ALL(constraint IN $requiredBusinessDomains');
  });

  it('references HAS_EXPERIENCE_IN relationship', () => {
    const params = createQueryParams({
      requiredBusinessDomains: [createBusinessDomain('bd-1')],
    });
    const context = getDomainFilterContext(params);
    const result = buildRequiredBusinessDomainFilter(context);

    expect(result).toContain('HAS_EXPERIENCE_IN');
  });

  it('includes minYears check', () => {
    const params = createQueryParams({
      requiredBusinessDomains: [createBusinessDomain('bd-1', { minYears: 2 })],
    });
    const context = getDomainFilterContext(params);
    const result = buildRequiredBusinessDomainFilter(context);

    expect(result).toContain('minYears');
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

  it('includes ALL constraint for checking each required domain', () => {
    const params = createQueryParams({
      requiredTechnicalDomains: [createTechnicalDomain('td-1')],
    });
    const context = getDomainFilterContext(params);
    const result = buildRequiredTechnicalDomainFilter(context);

    expect(result).toContain('ALL(constraint IN $requiredTechDomains');
  });

  it('includes both explicit claim and skill inference options', () => {
    const params = createQueryParams({
      requiredTechnicalDomains: [createTechnicalDomain('td-1')],
    });
    const context = getDomainFilterContext(params);
    const result = buildRequiredTechnicalDomainFilter(context);

    // Option 1: Explicit domain experience
    expect(result).toContain('HAS_EXPERIENCE_IN');
    // Option 2: Skill inference via SkillCategory
    expect(result).toContain('SkillCategory');
    expect(result).toContain('BELONGS_TO');
  });

  it('uses OR between explicit and inferred options', () => {
    const params = createQueryParams({
      requiredTechnicalDomains: [createTechnicalDomain('td-1')],
    });
    const context = getDomainFilterContext(params);
    const result = buildRequiredTechnicalDomainFilter(context);

    expect(result).toContain('OR');
  });
});

describe('buildBusinessDomainCollection', () => {
  it('returns empty clause with matchedBusinessDomains when no business domains', () => {
    const context = getDomainFilterContext(createQueryParams());
    const result = buildBusinessDomainCollection(context, ['e', 'totalCount']);

    // Should have empty array AS matchedBusinessDomains
    expect(result.clause).toContain('[] AS matchedBusinessDomains');
    expect(result.carryForwardFields).toContain('matchedBusinessDomains');
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

  it('references allBusinessDomainIds parameter', () => {
    const params = createQueryParams({
      preferredBusinessDomains: [createBusinessDomain('bd-pref')],
    });
    const context = getDomainFilterContext(params);
    const result = buildBusinessDomainCollection(context, ['e', 'totalCount']);

    expect(result.clause).toContain('$allBusinessDomainIds');
  });

  it('includes carryover fields in WITH clause', () => {
    const params = createQueryParams({
      preferredBusinessDomains: [createBusinessDomain('bd-pref')],
    });
    const context = getDomainFilterContext(params);
    const carryoverFields = ['e', 'totalCount', 'avgConfidence'];
    const result = buildBusinessDomainCollection(context, carryoverFields);

    expect(result.clause).toContain('e, totalCount, avgConfidence');
  });

  it('collects domainId, domainName, and years', () => {
    const params = createQueryParams({
      preferredBusinessDomains: [createBusinessDomain('bd-pref')],
    });
    const context = getDomainFilterContext(params);
    const result = buildBusinessDomainCollection(context, ['e', 'totalCount']);

    expect(result.clause).toContain('domainId:');
    expect(result.clause).toContain('domainName:');
    expect(result.clause).toContain('years:');
  });
});

describe('buildTechnicalDomainCollection', () => {
  it('returns empty clause with matchedTechnicalDomains when no technical domains', () => {
    const context = getDomainFilterContext(createQueryParams());
    const result = buildTechnicalDomainCollection(context, ['e', 'totalCount']);

    // Should have empty array AS matchedTechnicalDomains
    expect(result.clause).toContain('[] AS matchedTechnicalDomains');
    expect(result.carryForwardFields).toContain('matchedTechnicalDomains');
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

  it('references allTechDomainIds parameter', () => {
    const params = createQueryParams({
      preferredTechnicalDomains: [createTechnicalDomain('td-pref')],
    });
    const context = getDomainFilterContext(params);
    const result = buildTechnicalDomainCollection(context, ['e', 'totalCount']);

    expect(result.clause).toContain('$allTechDomainIds');
  });

  it('includes carryover fields in WITH clause', () => {
    const params = createQueryParams({
      preferredTechnicalDomains: [createTechnicalDomain('td-pref')],
    });
    const context = getDomainFilterContext(params);
    const carryoverFields = ['e', 'totalCount', 'avgConfidence', 'matchedBusinessDomains'];
    const result = buildTechnicalDomainCollection(context, carryoverFields);

    expect(result.clause).toContain('e, totalCount, avgConfidence, matchedBusinessDomains');
  });

  it('collects both explicit and inferred domain experience', () => {
    const params = createQueryParams({
      preferredTechnicalDomains: [createTechnicalDomain('td-pref')],
    });
    const context = getDomainFilterContext(params);
    const result = buildTechnicalDomainCollection(context, ['e', 'totalCount']);

    // Should have explicit domain collection
    expect(result.clause).toContain('explicitDomains');
    // Should have inferred domain collection
    expect(result.clause).toContain('inferredDomains');
    // Should include source field
    expect(result.clause).toContain("source: 'explicit'");
    expect(result.clause).toContain("source: 'inferred'");
  });

  it('uses MAX(yearsUsed) for inferred domain years', () => {
    const params = createQueryParams({
      preferredTechnicalDomains: [createTechnicalDomain('td-pref')],
    });
    const context = getDomainFilterContext(params);
    const result = buildTechnicalDomainCollection(context, ['e', 'totalCount']);

    expect(result.clause).toContain('MAX(us.yearsUsed)');
  });

  it('merges explicit and inferred domains with explicit taking precedence', () => {
    const params = createQueryParams({
      preferredTechnicalDomains: [createTechnicalDomain('td-pref')],
    });
    const context = getDomainFilterContext(params);
    const result = buildTechnicalDomainCollection(context, ['e', 'totalCount']);

    // Explicit claims take precedence - check for merge logic
    expect(result.clause).toContain('explicitDomains');
    expect(result.clause).toContain('inferredDomains');
    expect(result.clause).toContain('matchedTechnicalDomains');
  });
});
