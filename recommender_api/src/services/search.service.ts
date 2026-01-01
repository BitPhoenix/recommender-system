/**
 * Search Service
 * Main orchestration layer for the constraint-based search API.
 * Coordinates all services to fulfill search requests.
 */

import type { Session } from 'neo4j-driver';
import type {
  SearchFilterRequest,
  SearchFilterResponse,
  EngineerMatch,
  MatchedSkill,
  UnmatchedRelatedSkill,
  ConstraintViolation,
  ProficiencyLevel,
  SkillRequirement,
} from '../types/search.types.js';
import { expandSearchCriteria } from './constraint-expander.service.js';
import {
  resolveSkillHierarchy,
  resolveSkillRequirements,
  type ResolvedSkillWithProficiency,
} from './skill-resolver.service.js';
import {
  buildSearchQuery,
  type CypherQueryParams,
  type SkillProficiencyGroups,
} from './cypher-query-builder/index.js';
import {
  scoreAndSortEngineers,
  type EngineerData,
  type UtilityContext,
} from './utility-calculator.service.js';
import { knowledgeBaseConfig } from '../config/knowledge-base/index.js';

// Raw skill data from Cypher query (before splitting into matched/unmatched)
interface RawSkillData {
  skillId: string;
  skillName: string;
  proficiencyLevel: string;
  confidenceScore: number;
  yearsUsed: number;
  matchType: 'direct' | 'descendant' | 'none';
  // These fields only exist when skill filtering is active
  meetsConfidence?: boolean;
  meetsProficiency?: boolean;
}

interface RawEngineerRecord {
  id: string;
  name: string;
  headline: string;
  salary: number;
  yearsExperience: number;
  startTimeline: string;
  timezone: string;
  matchedSkills: MatchedSkill[];
  unmatchedRelatedSkills: UnmatchedRelatedSkill[];
  matchedSkillCount: number;
  avgConfidence: number;
  matchedDomainNames: string[];
}

// Result of resolving both required and preferred skills
interface SkillResolutionResult {
  // From required skills (for query building)
  skillGroups: SkillProficiencyGroups;
  expandedSkillNames: string[];
  unresolvedSkills: string[];
  originalSkillIdentifiers: string[];
  // From preferred skills (for ranking)
  preferredSkillIds: string[];
  // Merged from both (for utility calculation)
  skillIdToPreferredProficiency: Map<string, ProficiencyLevel>;
}

/**
 * Executes a search filter request and returns ranked results.
 */
export async function executeSearch(
  session: Session,
  request: SearchFilterRequest
): Promise<SearchFilterResponse> {
  const startTime = Date.now();
  const config = knowledgeBaseConfig;

  // Step 1: Expand search criteria using knowledge base rules
  const expanded = expandSearchCriteria(request);

  // Step 2: Resolve all skill requirements (both required and preferred)
  const {
    skillGroups,
    expandedSkillNames,
    unresolvedSkills,
    originalSkillIdentifiers,
    preferredSkillIds,
    skillIdToPreferredProficiency,
  } = await resolveAllSkills(
    session,
    request.requiredSkills,
    request.preferredSkills,
    config.defaults.defaultMinProficiency
  );

  // Step 2b: Resolve domain skill IDs (domains are skills with skillType: 'domain_knowledge')
  const requiredDomainIds = await resolveDomainIds(session, request.requiredDomains);
  const preferredDomainIds = await resolveDomainIds(session, request.preferredDomains);

  // Step 3: Build query parameters with per-skill proficiency buckets
  const queryParams: CypherQueryParams = {
    // Per-skill proficiency buckets
    learningLevelSkillIds: skillGroups.learningLevelSkillIds,
    proficientLevelSkillIds: skillGroups.proficientLevelSkillIds,
    expertLevelSkillIds: skillGroups.expertLevelSkillIds,
    originalSkillIdentifiers: originalSkillIdentifiers.length > 0 ? originalSkillIdentifiers : null,
    // Basic engineer filters
    startTimeline: expanded.startTimeline,
    minYearsExperience: expanded.minYearsExperience,
    maxYearsExperience: expanded.maxYearsExperience,
    timezonePrefixes: expanded.timezonePrefixes,
    maxSalary: expanded.maxSalary,
    minSalary: expanded.minSalary,
    offset: expanded.offset,
    limit: expanded.limit,
    // Domain filtering
    requiredDomainIds: requiredDomainIds.length > 0 ? requiredDomainIds : undefined,
    preferredDomainIds: preferredDomainIds.length > 0 ? preferredDomainIds : undefined,
  };

  // Step 4: Execute main query (unified for skill-filtered and unfiltered search)
  const allSkillIds = [
    ...skillGroups.learningLevelSkillIds,
    ...skillGroups.proficientLevelSkillIds,
    ...skillGroups.expertLevelSkillIds,
  ];
  const mainQuery = buildSearchQuery(queryParams);

  // Run main query (now includes totalCount computed before pagination)
  const mainResult = await session.run(mainQuery.query, mainQuery.params);

  // Step 5: Process results
  // Determine search mode from what user specified (not derived data):
  // - skill constraints specified → split skills into matched/unmatched
  // - teamFocus only → show only aligned skills
  // - neither → clear skills (unfiltered search)
  const hasSkillConstraints =
    (request.requiredSkills?.length ?? 0) > 0 ||
    (request.preferredSkills?.length ?? 0) > 0;
  const hasTeamFocus = request.teamFocus !== undefined;
  const isTeamFocusOnlyMode = !hasSkillConstraints && hasTeamFocus;
  const shouldClearSkills = !hasSkillConstraints && !hasTeamFocus;

  const parseOptions = {
    shouldClearSkills,
    isTeamFocusOnlyMode,
    alignedSkillIds: expanded.alignedSkillIds,
  };

  const rawEngineers: RawEngineerRecord[] = mainResult.records.map((record) =>
    parseEngineerFromRecord(record, parseOptions)
  );

  // Extract totalCount from first record (all records have same value from early count step)
  const totalCount = mainResult.records.length > 0
    ? toNumber(mainResult.records[0].get('totalCount'))
    : 0;

  // Step 6: Calculate utility scores and rank
  const utilityContext: UtilityContext = {
    requestedSkillIds: allSkillIds,
    preferredSkillIds,
    preferredDomainIds,
    alignedSkillIds: expanded.alignedSkillIds,
    maxSalaryBudget: expanded.maxSalary,
    // Pass through preferred/required values
    preferredSeniorityLevel: expanded.preferredSeniorityLevel,
    preferredMaxStartTime: expanded.preferredMaxStartTime,
    requiredMaxStartTime: expanded.requiredMaxStartTime,
    preferredTimezone: expanded.preferredTimezone,
    preferredSalaryRange: expanded.preferredSalaryRange,
    // Per-skill preferred proficiencies for ranking boost
    skillIdToPreferredProficiency,
  };

  const engineerData: EngineerData[] = rawEngineers.map((raw) => ({
    id: raw.id,
    name: raw.name,
    headline: raw.headline,
    salary: raw.salary,
    yearsExperience: raw.yearsExperience,
    startTimeline: raw.startTimeline,
    timezone: raw.timezone,
    matchedSkills: raw.matchedSkills,
    unmatchedRelatedSkills: raw.unmatchedRelatedSkills,
    avgConfidence: raw.avgConfidence,
    matchedDomainNames: raw.matchedDomainNames,
  }));

  const scoredEngineers = scoreAndSortEngineers(engineerData, utilityContext);

  // Step 7: Format response
  const matches: EngineerMatch[] = scoredEngineers.map((eng) => ({
    id: eng.id,
    name: eng.name,
    headline: eng.headline,
    salary: eng.salary,
    yearsExperience: eng.yearsExperience,
    startTimeline: eng.startTimeline,
    timezone: eng.timezone,
    matchedSkills: eng.matchedSkills,
    unmatchedRelatedSkills: eng.unmatchedRelatedSkills,
    matchedDomains: eng.matchedDomainNames,
    utilityScore: eng.utilityScore,
    scoreBreakdown: eng.scoreBreakdown,
  }));

  const executionTimeMs = Date.now() - startTime;

  return {
    matches,
    totalCount,
    appliedFilters: expanded.appliedFilters,
    appliedPreferences: expanded.appliedPreferences,
    queryMetadata: {
      executionTimeMs,
      skillsExpanded: expandedSkillNames,
      defaultsApplied: expanded.defaultsApplied,
      unresolvedSkills,
    },
  };
}

/**
 * Groups resolved skills by their minProficiency level for efficient query filtering.
 * Returns three arrays: skills requiring 'learning', 'proficient', or 'expert' minimum.
 */
function groupSkillsByProficiency(
  resolvedSkills: ResolvedSkillWithProficiency[]
): SkillProficiencyGroups {
  const learningLevelSkillIds: string[] = [];
  const proficientLevelSkillIds: string[] = [];
  const expertLevelSkillIds: string[] = [];

  for (const skill of resolvedSkills) {
    switch (skill.minProficiency) {
      case 'learning':
        learningLevelSkillIds.push(skill.skillId);
        break;
      case 'proficient':
        proficientLevelSkillIds.push(skill.skillId);
        break;
      case 'expert':
        expertLevelSkillIds.push(skill.skillId);
        break;
    }
  }

  return { learningLevelSkillIds, proficientLevelSkillIds, expertLevelSkillIds };
}

/**
 * Converts Neo4j integer values to JavaScript numbers.
 */
function toNumber(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  // Handle Neo4j Integer type
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value) || 0;
}

/**
 * Categorizes raw skill data into matched and unmatched skills based on constraint checks.
 *
 * - Direct matches passing all constraints → matchedSkills
 * - Descendants (even if passing) and any skill with violations → unmatchedRelatedSkills
 * - Skills without constraint checks (unfiltered search) → matchedSkills
 */
function categorizeSkillsByConstraints(allSkills: RawSkillData[]): {
  matchedSkills: MatchedSkill[];
  unmatchedRelatedSkills: UnmatchedRelatedSkill[];
} {
  const matchedSkills: MatchedSkill[] = [];
  const unmatchedRelatedSkills: UnmatchedRelatedSkill[] = [];

  for (const skill of allSkills) {
    const hasConstraintChecks = 'meetsConfidence' in skill && 'meetsProficiency' in skill;

    if (!hasConstraintChecks) {
      // No constraint checks (unfiltered search) - include as matched
      matchedSkills.push({
        skillId: skill.skillId,
        skillName: skill.skillName,
        proficiencyLevel: skill.proficiencyLevel,
        confidenceScore: skill.confidenceScore,
        yearsUsed: skill.yearsUsed,
        matchType: skill.matchType,
      });
      continue;
    }

    // Skill search mode: check constraints
    const violations: ConstraintViolation[] = [];
    if (!skill.meetsConfidence) violations.push('confidence_below_threshold');
    if (!skill.meetsProficiency) violations.push('proficiency_below_minimum');

    const isDirectMatchPassingConstraints =
      skill.matchType === 'direct' && violations.length === 0;

    if (isDirectMatchPassingConstraints) {
      matchedSkills.push({
        skillId: skill.skillId,
        skillName: skill.skillName,
        proficiencyLevel: skill.proficiencyLevel,
        confidenceScore: skill.confidenceScore,
        yearsUsed: skill.yearsUsed,
        matchType: skill.matchType,
      });
    } else {
      // Descendants (even if passing constraints) and any skill with violations
      unmatchedRelatedSkills.push({
        skillId: skill.skillId,
        skillName: skill.skillName,
        proficiencyLevel: skill.proficiencyLevel,
        confidenceScore: skill.confidenceScore,
        yearsUsed: skill.yearsUsed,
        matchType: skill.matchType,
        constraintViolations: violations,
      });
    }
  }

  return { matchedSkills, unmatchedRelatedSkills };
}

/**
 * Resolves domain identifiers to skill IDs.
 * Returns empty array if no identifiers provided.
 */
async function resolveDomainIds(
  session: Session,
  identifiers: string[] | null | undefined
): Promise<string[]> {
  if (!identifiers || identifiers.length === 0) {
    return [];
  }
  const resolution = await resolveSkillHierarchy(session, identifiers);
  return resolution.resolvedSkills.map((s) => s.skillId);
}

/**
 * Resolves both required and preferred skills, returning all data needed for query building and ranking.
 */
async function resolveAllSkills(
  session: Session,
  requiredSkills: SkillRequirement[] | undefined,
  preferredSkills: SkillRequirement[] | undefined,
  defaultProficiency: ProficiencyLevel
): Promise<SkillResolutionResult> {
  // Defaults for when no skills are provided
  let skillGroups: SkillProficiencyGroups = {
    learningLevelSkillIds: [],
    proficientLevelSkillIds: [],
    expertLevelSkillIds: [],
  };
  let expandedSkillNames: string[] = [];
  let unresolvedSkills: string[] = [];
  let originalSkillIdentifiers: string[] = [];
  let preferredSkillIds: string[] = [];
  const skillIdToPreferredProficiency = new Map<string, ProficiencyLevel>();

  // Resolve required skills
  if (requiredSkills && requiredSkills.length > 0) {
    const resolution = await resolveSkillRequirements(session, requiredSkills, defaultProficiency);
    skillGroups = groupSkillsByProficiency(resolution.resolvedSkills);
    expandedSkillNames = resolution.expandedSkillNames;
    unresolvedSkills = resolution.unresolvedIdentifiers;
    originalSkillIdentifiers = resolution.originalIdentifiers;

    // Add preferred proficiencies from required skills
    for (const skill of resolution.resolvedSkills) {
      if (skill.preferredMinProficiency) {
        skillIdToPreferredProficiency.set(skill.skillId, skill.preferredMinProficiency);
      }
    }
  }

  // Resolve preferred skills
  if (preferredSkills && preferredSkills.length > 0) {
    const resolution = await resolveSkillRequirements(session, preferredSkills, defaultProficiency);
    preferredSkillIds = resolution.resolvedSkills.map((s) => s.skillId);

    // Add preferred proficiencies (don't override existing from required)
    for (const skill of resolution.resolvedSkills) {
      if (skill.preferredMinProficiency && !skillIdToPreferredProficiency.has(skill.skillId)) {
        skillIdToPreferredProficiency.set(skill.skillId, skill.preferredMinProficiency);
      }
    }
  }

  return {
    skillGroups,
    expandedSkillNames,
    unresolvedSkills,
    originalSkillIdentifiers,
    preferredSkillIds,
    skillIdToPreferredProficiency,
  };
}

/**
 * Parses a Neo4j record into a RawEngineerRecord.
 * Handles skill categorization based on search mode.
 */
function parseEngineerFromRecord(
  record: { get: (key: string) => unknown },
  options: {
    shouldClearSkills: boolean;
    isTeamFocusOnlyMode: boolean;
    alignedSkillIds: string[];
  }
): RawEngineerRecord {
  const { shouldClearSkills, isTeamFocusOnlyMode, alignedSkillIds } = options;

  let matchedSkills: MatchedSkill[] = [];
  let unmatchedRelatedSkills: UnmatchedRelatedSkill[] = [];

  if (!shouldClearSkills) {
    const allSkills = (record.get('allRelevantSkills') as RawSkillData[]) || [];
    const categorized = categorizeSkillsByConstraints(allSkills);
    matchedSkills = categorized.matchedSkills;
    unmatchedRelatedSkills = categorized.unmatchedRelatedSkills;

    // In teamFocus-only mode, filter to only show aligned skills
    if (isTeamFocusOnlyMode) {
      matchedSkills = matchedSkills.filter((skill) =>
        alignedSkillIds.includes(skill.skillId)
      );
      unmatchedRelatedSkills = [];
    }
  }

  // Extract matched domain names (filter out null values)
  const rawDomainNames = (record.get('matchedDomainNames') as string[] | null) || [];
  const matchedDomainNames = rawDomainNames.filter((name) => name !== null);

  return {
    id: record.get('id') as string,
    name: record.get('name') as string,
    headline: record.get('headline') as string,
    salary: toNumber(record.get('salary')),
    yearsExperience: toNumber(record.get('yearsExperience')),
    startTimeline: record.get('startTimeline') as string,
    timezone: record.get('timezone') as string,
    matchedSkills,
    unmatchedRelatedSkills,
    matchedSkillCount: shouldClearSkills ? 0 : toNumber(record.get('matchedSkillCount')),
    avgConfidence: shouldClearSkills ? 0 : toNumber(record.get('avgConfidence')),
    matchedDomainNames,
  };
}
