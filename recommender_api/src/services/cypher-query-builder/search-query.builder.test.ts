import { describe, it, expect } from 'vitest';
import { buildSearchQuery, buildSkillFilterCountQuery } from './search-query.builder.js';
import type { CypherQueryParams, SkillFilterRequirement } from './query-types.js';
import { SkillFilterType } from '../../types/search.types.js';

// Factory helper for test params
const createQueryParams = (overrides: Partial<CypherQueryParams> = {}): CypherQueryParams => ({
  learningLevelSkillIds: [],
  proficientLevelSkillIds: [],
  expertLevelSkillIds: [],
  originalSkillIdentifiers: null,
  startTimeline: ['immediate', 'two_weeks', 'one_month'],
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

      // neo4j-driver int() wraps the values
      expect(result.params.offset).toEqual(expect.objectContaining({ low: 10 }));
      expect(result.params.limit).toEqual(expect.objectContaining({ low: 25 }));
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
      // Should NOT contain skill proficiency qualification checks
      expect(result.query).not.toContain('qualifyingSkillIds');
    });

    it('includes totalCount in return for pagination', () => {
      const params = createQueryParams();
      const result = buildSearchQuery(params);

      expect(result.query).toContain('totalCount');
    });

    it('includes Unfiltered Search Query comment', () => {
      const params = createQueryParams();
      const result = buildSearchQuery(params);

      expect(result.query).toContain('Unfiltered');
    });
  });

  describe('skill-filtered mode', () => {
    it('generates skill matching query when skills specified', () => {
      const params = createQueryParams({
        proficientLevelSkillIds: ['skill-1', 'skill-2'],
      });
      const result = buildSearchQuery(params);

      // Should include skill relationship pattern
      expect(result.query).toContain('HAS');
      expect(result.query).toContain('UserSkill');
      expect(result.query).toContain('Skill');
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

    it('includes Skill-Filtered Search Query comment', () => {
      const params = createQueryParams({
        proficientLevelSkillIds: ['skill-1'],
      });
      const result = buildSearchQuery(params);

      expect(result.query).toContain('Skill-Filtered');
    });

    it('includes proficiency qualification check in skill-filtered mode', () => {
      const params = createQueryParams({
        proficientLevelSkillIds: ['skill-1'],
      });
      const result = buildSearchQuery(params);

      // Should check proficiency qualifications
      expect(result.query).toContain('qualifyingSkillIds');
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

    it('includes experience range when minYearsExperience specified', () => {
      const params = createQueryParams({
        minYearsExperience: 3,
      });
      const result = buildSearchQuery(params);

      expect(result.params.minYearsExperience).toBe(3);
      expect(result.query).toContain('yearsExperience');
    });

    it('includes experience range when maxYearsExperience specified', () => {
      const params = createQueryParams({
        maxYearsExperience: 10,
      });
      const result = buildSearchQuery(params);

      expect(result.params.maxYearsExperience).toBe(10);
      expect(result.query).toContain('yearsExperience');
    });

    it('includes budget ceiling when maxBudget specified', () => {
      const params = createQueryParams({
        maxBudget: 200000,
      });
      const result = buildSearchQuery(params);

      // Budget filter uses ceiling (maxBudget or stretchBudget)
      expect(result.params.budgetCeiling).toBe(200000);
    });

    it('uses stretchBudget as ceiling when both specified', () => {
      const params = createQueryParams({
        maxBudget: 200000,
        stretchBudget: 220000,
      });
      const result = buildSearchQuery(params);

      expect(result.params.budgetCeiling).toBe(220000);
    });

    it('includes timezone zones when specified', () => {
      const params = createQueryParams({
        timezoneZones: ['Eastern', 'Pacific'],
      });
      const result = buildSearchQuery(params);

      // Timezone zones are passed as array to IN clause
      expect(result.params.timezoneZones).toEqual(['Eastern', 'Pacific']);
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
      expect(result.params.requiredBusinessDomains).toBeDefined();
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
    it('does not include experience conditions when experience range not specified', () => {
      const params = createQueryParams({
        minYearsExperience: null,
        maxYearsExperience: null,
      });
      const result = buildSearchQuery(params);

      // Null values should not create conditions with parameter references
      expect(result.query).not.toContain('$minYearsExperience');
      expect(result.query).not.toContain('$maxYearsExperience');
    });

    it('does not include salary filter when no budget specified', () => {
      const params = createQueryParams({
        maxBudget: null,
        stretchBudget: null,
      });
      const result = buildSearchQuery(params);

      expect(result.query).not.toContain('$budgetCeiling');
    });

    it('includes originalSkillIdentifiers in params for match type classification', () => {
      const params = createQueryParams({
        proficientLevelSkillIds: ['skill-1'],
        originalSkillIdentifiers: ['typescript'],
      });
      const result = buildSearchQuery(params);

      expect(result.params.originalSkillIdentifiers).toEqual(['typescript']);
    });

    it('uses empty array for originalSkillIdentifiers when null', () => {
      const params = createQueryParams({
        proficientLevelSkillIds: ['skill-1'],
        originalSkillIdentifiers: null,
      });
      const result = buildSearchQuery(params);

      expect(result.params.originalSkillIdentifiers).toEqual([]);
    });
  });

  describe('SKIP and LIMIT placement', () => {
    it('includes SKIP and LIMIT in the query', () => {
      const params = createQueryParams({ offset: 5, limit: 10 });
      const result = buildSearchQuery(params);

      expect(result.query).toContain('SKIP');
      expect(result.query).toContain('LIMIT');
    });
  });

  describe('return clause fields', () => {
    it('returns all expected engineer fields', () => {
      const params = createQueryParams();
      const result = buildSearchQuery(params);

      expect(result.query).toContain('e.id AS id');
      expect(result.query).toContain('e.name AS name');
      expect(result.query).toContain('e.headline AS headline');
      expect(result.query).toContain('e.salary AS salary');
      expect(result.query).toContain('e.yearsExperience AS yearsExperience');
      expect(result.query).toContain('e.startTimeline AS startTimeline');
      expect(result.query).toContain('e.timezone AS timezone');
    });

    it('returns skill and domain collections', () => {
      const params = createQueryParams();
      const result = buildSearchQuery(params);

      expect(result.query).toContain('allRelevantSkills');
      expect(result.query).toContain('matchedSkillCount');
      expect(result.query).toContain('avgConfidence');
      expect(result.query).toContain('matchedBusinessDomains');
      expect(result.query).toContain('matchedTechnicalDomains');
    });
  });

  describe('matchType classification', () => {
    it('includes matchType CASE expression in skill-filtered query', () => {
      const params = createQueryParams({
        proficientLevelSkillIds: ['skill-1'],
        originalSkillIdentifiers: ['typescript'],
      });
      const result = buildSearchQuery(params);

      // Verify the matchType CASE pattern exists
      expect(result.query).toContain('matchType: CASE');
      // Both ID and name are checked on the same line with OR
      expect(result.query).toContain("s2.id IN $originalSkillIdentifiers OR s2.name IN $originalSkillIdentifiers");
      expect(result.query).toContain("'direct'");
      expect(result.query).toContain("'descendant'");
    });

    it('sets matchType to none in unfiltered query', () => {
      const params = createQueryParams({
        learningLevelSkillIds: [],
        proficientLevelSkillIds: [],
        expertLevelSkillIds: [],
      });
      const result = buildSearchQuery(params);

      // Unfiltered mode uses 'none' for matchType
      expect(result.query).toContain("matchType: 'none'");
    });

    it('passes originalSkillIdentifiers for direct match detection', () => {
      const params = createQueryParams({
        proficientLevelSkillIds: ['skill_typescript', 'skill_javascript'],
        originalSkillIdentifiers: ['typescript', 'skill_javascript'],
      });
      const result = buildSearchQuery(params);

      // Both ID and name should be checked
      expect(result.params.originalSkillIdentifiers).toEqual(['typescript', 'skill_javascript']);
    });
  });

  describe('ORDER BY clauses', () => {
    it('orders skill-filtered results by qualifying skills count DESC, then experience DESC', () => {
      const params = createQueryParams({
        proficientLevelSkillIds: ['skill-1', 'skill-2'],
      });
      const result = buildSearchQuery(params);

      // Skill-filtered mode: ORDER BY SIZE(qualifyingSkillIds) DESC, e.yearsExperience DESC
      expect(result.query).toContain('ORDER BY SIZE(qualifyingSkillIds) DESC');
      expect(result.query).toContain('e.yearsExperience DESC');
    });

    it('orders unfiltered results by experience DESC only', () => {
      const params = createQueryParams({
        learningLevelSkillIds: [],
        proficientLevelSkillIds: [],
        expertLevelSkillIds: [],
      });
      const result = buildSearchQuery(params);

      // Unfiltered mode: ORDER BY e.yearsExperience DESC only
      expect(result.query).toContain('ORDER BY e.yearsExperience DESC');
      // Should NOT have skill-count ordering
      expect(result.query).not.toContain('SIZE(qualifyingSkillIds)');
    });
  });

  describe('skill filter requirements (HAS_ANY per requirement)', () => {
    it('generates per-requirement filtering when skillFilterRequirements provided', () => {
      const params = createQueryParams({
        proficientLevelSkillIds: ['skill_node', 'skill_express', 'skill_ts'],
        skillFilterRequirements: [
          {
            expandedSkillIds: ['skill_node', 'skill_express'],
            originalSkillId: 'skill_node',
            minProficiency: 'proficient',
            type: SkillFilterType.User,
          },
          {
            expandedSkillIds: ['skill_ts'],
            originalSkillId: 'skill_ts',
            minProficiency: 'learning',
            type: SkillFilterType.User,
          },
        ],
      });
      const result = buildSearchQuery(params);

      // Each requirement gets its own parameter
      expect(result.params.skillGroup0).toEqual(['skill_node', 'skill_express']);
      expect(result.params.skillGroup1).toEqual(['skill_ts']);
      expect(result.params.skillGroupCount).toBe(2);

      // Query uses per-requirement filtering
      expect(result.query).toContain('$skillGroup0');
      expect(result.query).toContain('$skillGroup1');
    });

    it('uses HAS_ANY semantics within each requirement', () => {
      const params = createQueryParams({
        proficientLevelSkillIds: ['skill_node', 'skill_express'],
        skillFilterRequirements: [
          {
            expandedSkillIds: ['skill_node', 'skill_express'],
            originalSkillId: 'skill_node',
            minProficiency: 'proficient',
            type: SkillFilterType.User,
          },
        ],
      });
      const result = buildSearchQuery(params);

      // Query should check SIZE > 0 for each requirement (HAS_ANY)
      expect(result.query).toContain('SIZE([x IN qualifyingSkillIds WHERE x IN $skillGroup0]) > 0');
    });

    it('ANDs multiple requirements together', () => {
      const params = createQueryParams({
        proficientLevelSkillIds: ['skill_node', 'skill_ts'],
        skillFilterRequirements: [
          { expandedSkillIds: ['skill_node'], originalSkillId: 'skill_node', minProficiency: 'proficient', type: SkillFilterType.User },
          { expandedSkillIds: ['skill_ts'], originalSkillId: 'skill_ts', minProficiency: 'proficient', type: SkillFilterType.User },
        ],
      });
      const result = buildSearchQuery(params);

      // Both requirements should appear in WHERE clause with AND
      expect(result.query).toContain('$skillGroup0');
      expect(result.query).toContain('$skillGroup1');
      expect(result.query).toContain('AND');
    });

  });
});

describe('buildSkillFilterCountQuery', () => {
  const createSkillFilterRequirement = (
    skillId: string,
    minProficiency: string = 'learning',
    type: SkillFilterType = SkillFilterType.User
  ): SkillFilterRequirement => ({
    expandedSkillIds: [skillId],
    originalSkillId: skillId,
    minProficiency,
    preferredMinProficiency: null,
    type,
  });

  it('builds count query with proficiency buckets from skill filter requirements', () => {
    const skillFilterRequirements: SkillFilterRequirement[] = [
      createSkillFilterRequirement('skill_1', 'learning'),
      createSkillFilterRequirement('skill_2', 'proficient'),
      createSkillFilterRequirement('skill_3', 'expert'),
    ];
    const propertyConditions = { whereClauses: [], params: {} };

    const result = buildSkillFilterCountQuery(skillFilterRequirements, propertyConditions);

    expect(result.query).toContain('$learningLevelSkillIds');
    expect(result.query).toContain('$proficientLevelSkillIds');
    expect(result.query).toContain('$expertLevelSkillIds');
    expect(result.query).toContain('count(DISTINCT e) AS resultCount');
    expect(result.params.learningLevelSkillIds).toEqual(['skill_1']);
    expect(result.params.proficientLevelSkillIds).toEqual(['skill_2']);
    expect(result.params.expertLevelSkillIds).toEqual(['skill_3']);
  });

  it('includes property conditions in WHERE clause', () => {
    const skillFilterRequirements: SkillFilterRequirement[] = [
      createSkillFilterRequirement('skill_1', 'learning'),
    ];
    const propertyConditions = {
      whereClauses: ['e.salary <= $maxSalary'],
      params: { maxSalary: 100000 },
    };

    const result = buildSkillFilterCountQuery(skillFilterRequirements, propertyConditions);

    expect(result.query).toContain('e.salary <= $maxSalary');
    expect(result.params.maxSalary).toBe(100000);
  });

  it('returns 0-result query when no skill requirements provided', () => {
    const skillFilterRequirements: SkillFilterRequirement[] = [];
    const result = buildSkillFilterCountQuery(skillFilterRequirements, { whereClauses: [], params: {} });

    expect(result.query).toContain('RETURN 0 AS resultCount');
  });

  it('combines multiple property conditions with AND', () => {
    const skillFilterRequirements: SkillFilterRequirement[] = [
      createSkillFilterRequirement('skill_1', 'proficient'),
    ];
    const propertyConditions = {
      whereClauses: ['e.salary <= $maxSalary', 'e.yearsExperience >= $minExp'],
      params: { maxSalary: 100000, minExp: 5 },
    };

    const result = buildSkillFilterCountQuery(skillFilterRequirements, propertyConditions);

    expect(result.query).toContain('e.salary <= $maxSalary');
    expect(result.query).toContain('e.yearsExperience >= $minExp');
    expect(result.query).toContain('AND');
    expect(result.params.maxSalary).toBe(100000);
    expect(result.params.minExp).toBe(5);
  });

  it('uses proficiency CASE pattern for skill matching', () => {
    const skillFilterRequirements: SkillFilterRequirement[] = [
      createSkillFilterRequirement('skill_1', 'expert'),
    ];
    const propertyConditions = { whereClauses: [], params: {} };

    const result = buildSkillFilterCountQuery(skillFilterRequirements, propertyConditions);

    // Check for the proficiency qualification CASE pattern
    expect(result.query).toContain('COLLECT(DISTINCT CASE');
    expect(result.query).toContain('WHEN s.id IN $learningLevelSkillIds');
    expect(result.query).toContain('WHEN s.id IN $proficientLevelSkillIds');
    expect(result.query).toContain('WHEN s.id IN $expertLevelSkillIds');
    expect(result.query).toContain("us.proficiencyLevel = 'expert'");
  });

  it('requires all user skills to match (>= count of user skills)', () => {
    const skillFilterRequirements: SkillFilterRequirement[] = [
      createSkillFilterRequirement('skill_1', 'proficient'),
      createSkillFilterRequirement('skill_2', 'proficient'),
    ];
    const propertyConditions = { whereClauses: [], params: {} };

    const result = buildSkillFilterCountQuery(skillFilterRequirements, propertyConditions);

    // Now uses hardcoded count instead of SIZE($allSkillIds) for user skills only
    expect(result.query).toContain('>= 2');
    expect(result.params.allSkillIds).toEqual(['skill_1', 'skill_2']);
  });

  it('handles derived skills with existence-only check', () => {
    const skillFilterRequirements: SkillFilterRequirement[] = [
      createSkillFilterRequirement('skill_1', 'proficient', SkillFilterType.User),    // User skill
      createSkillFilterRequirement('skill_2', 'learning', SkillFilterType.Derived),   // Derived skill
    ];
    const propertyConditions = { whereClauses: [], params: {} };

    const result = buildSkillFilterCountQuery(skillFilterRequirements, propertyConditions);

    // Derived skills should be in derivedSkillIds param
    expect(result.params.derivedSkillIds).toEqual(['skill_2']);
    // User skills should be in proficiency buckets
    expect(result.params.proficientLevelSkillIds).toEqual(['skill_1']);
    // Existence check for derived skills
    expect(result.query).toContain('ALL(derivedId IN $derivedSkillIds');
  });
});
