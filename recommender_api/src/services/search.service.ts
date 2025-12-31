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
import { expandConstraints } from './constraint-expander.service.js';
import {
  resolveSkillHierarchy,
  resolveSkillRequirements,
  type ResolvedSkillWithProficiency,
} from './skill-resolver.service.js';
import {
  buildSearchQuery,
  type CypherQueryParams,
} from './cypher-query-builder/index.js';
import {
  scoreAndSortEngineers,
  type EngineerData,
  type UtilityContext,
} from './utility-calculator.service.js';
import { knowledgeBaseConfig } from '../config/knowledge-base/index.js';

/**
 * Groups resolved skills by their minProficiency level for efficient query filtering.
 * Returns three arrays: skills requiring 'learning', 'proficient', or 'expert' minimum.
 */
function groupSkillsByProficiency(
  resolvedSkills: ResolvedSkillWithProficiency[]
): {
  learningLevelSkillIds: string[];
  proficientLevelSkillIds: string[];
  expertLevelSkillIds: string[];
} {
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
 * Extracts skills with preferredMinProficiency for utility calculation.
 */
function extractPreferredSkillProficiencies(
  resolvedSkills: ResolvedSkillWithProficiency[]
): Map<string, ProficiencyLevel> {
  const result = new Map<string, ProficiencyLevel>();
  for (const skill of resolvedSkills) {
    if (skill.preferredMinProficiency) {
      result.set(skill.skillId, skill.preferredMinProficiency);
    }
  }
  return result;
}

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

/**
 * Executes a search filter request and returns ranked results.
 */
export async function executeSearch(
  session: Session,
  request: SearchFilterRequest
): Promise<SearchFilterResponse> {
  const startTime = Date.now();
  const config = knowledgeBaseConfig;

  // Step 1: Expand constraints using knowledge base rules
  const expanded = expandConstraints(request);

  // Step 2: Resolve skill requirements with per-skill proficiency
  let skillGroups = {
    learningLevelSkillIds: [] as string[],
    proficientLevelSkillIds: [] as string[],
    expertLevelSkillIds: [] as string[],
  };
  let expandedSkillNames: string[] = [];
  let unresolvedSkills: string[] = [];
  let originalSkillIdentifiers: string[] = [];
  let preferredSkillProficiencies = new Map<string, ProficiencyLevel>();

  const requiredSkillRequests = request.requiredSkills || [];
  const skillsWereRequested = requiredSkillRequests.length > 0;

  if (skillsWereRequested) {
    const skillResolution = await resolveSkillRequirements(
      session,
      requiredSkillRequests,
      config.defaults.defaultMinProficiency
    );

    skillGroups = groupSkillsByProficiency(skillResolution.resolvedSkills);
    expandedSkillNames = skillResolution.expandedSkillNames;
    unresolvedSkills = skillResolution.unresolvedIdentifiers;
    originalSkillIdentifiers = skillResolution.originalIdentifiers;

    // Extract preferred proficiencies for utility calculation
    preferredSkillProficiencies = extractPreferredSkillProficiencies(
      skillResolution.resolvedSkills
    );
  }

  // Step 2b: Resolve preferred skills with proficiency
  let preferredSkillIds: string[] = [];
  let preferredSkillProficienciesFromPreferred = new Map<string, ProficiencyLevel>();

  const preferredSkillRequests = request.preferredSkills || [];
  const preferredSkillsWereRequested = preferredSkillRequests.length > 0;

  if (preferredSkillsWereRequested) {
    const preferredResolution = await resolveSkillRequirements(
      session,
      preferredSkillRequests,
      config.defaults.defaultMinProficiency
    );
    preferredSkillIds = preferredResolution.resolvedSkills.map((s) => s.skillId);

    // Extract preferred proficiencies from preferred skills
    preferredSkillProficienciesFromPreferred = extractPreferredSkillProficiencies(
      preferredResolution.resolvedSkills
    );
  }

  // Merge preferred proficiencies from both required and preferred skills
  for (const [skillId, proficiency] of preferredSkillProficienciesFromPreferred) {
    if (!preferredSkillProficiencies.has(skillId)) {
      preferredSkillProficiencies.set(skillId, proficiency);
    }
  }

  // Step 2c: Resolve domain skill IDs (domains are skills with skillType: 'domain_knowledge')
  let requiredDomainIds: string[] = [];
  let preferredDomainIds: string[] = [];
  const requiredDomainIdentifiers = request.requiredDomains || null;
  const preferredDomainIdentifiers = request.preferredDomains || null;

  if (requiredDomainIdentifiers && requiredDomainIdentifiers.length > 0) {
    const domainResolution = await resolveSkillHierarchy(session, requiredDomainIdentifiers);
    requiredDomainIds = domainResolution.resolvedSkills.map((s) => s.skillId);
  }

  if (preferredDomainIdentifiers && preferredDomainIdentifiers.length > 0) {
    const domainResolution = await resolveSkillHierarchy(session, preferredDomainIdentifiers);
    preferredDomainIds = domainResolution.resolvedSkills.map((s) => s.skillId);
  }

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
    timezonePrefix: expanded.timezonePrefix,
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
  const hasResolvedSkills = allSkillIds.length > 0;
  const mainQuery = buildSearchQuery(queryParams);

  // Run main query (now includes totalCount computed before pagination)
  const mainResult = await session.run(mainQuery.query, mainQuery.params);

  // Step 5: Process results
  // Determine how to handle skills based on search mode:
  // - requiredSkills specified → split skills into matched/unmatched based on constraints
  // - teamFocus only → show only aligned skills (filter to alignedSkillIds)
  // - neither specified → clear skills (unfiltered search)
  const isTeamFocusOnlyMode = !hasResolvedSkills && expanded.alignedSkillIds.length > 0;
  const shouldClearSkills = !hasResolvedSkills && expanded.alignedSkillIds.length === 0;

  const rawEngineers: RawEngineerRecord[] = mainResult.records.map((record) => {
    let matchedSkills: MatchedSkill[] = [];
    let unmatchedRelatedSkills: UnmatchedRelatedSkill[] = [];

    if (!shouldClearSkills) {
      // Get all relevant skills from the query (consistent field name in unified query)
      const allSkills = (record.get('allRelevantSkills') as RawSkillData[]) || [];

      // Split skills into matched and unmatched based on:
      // 1. matchType: only 'direct' matches go into matchedSkills
      // 2. constraint checks: skills failing constraints go to unmatchedRelatedSkills
      for (const skill of allSkills) {
        // Check if skill has constraint check booleans (from skill search mode)
        const hasConstraintChecks = 'meetsConfidence' in skill && 'meetsProficiency' in skill;

        if (hasConstraintChecks) {
          const violations: ConstraintViolation[] = [];
          if (!skill.meetsConfidence) violations.push('confidence_below_threshold');
          if (!skill.meetsProficiency) violations.push('proficiency_below_minimum');

          // Only direct matches that pass all constraints go into matchedSkills
          if (skill.matchType === 'direct' && violations.length === 0) {
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
            // go to unmatchedRelatedSkills
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
        } else {
          // No constraint checks (unfiltered search) - include as matched
          matchedSkills.push({
            skillId: skill.skillId,
            skillName: skill.skillName,
            proficiencyLevel: skill.proficiencyLevel,
            confidenceScore: skill.confidenceScore,
            yearsUsed: skill.yearsUsed,
            matchType: skill.matchType,
          });
        }
      }

      // In teamFocus-only mode, filter to only show aligned skills
      if (isTeamFocusOnlyMode) {
        matchedSkills = matchedSkills.filter((skill) =>
          expanded.alignedSkillIds.includes(skill.skillId)
        );
        unmatchedRelatedSkills = []; // Clear unmatched in this mode
      }
    }

    // Extract matched domain names from query result (filter out null values)
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
      matchedSkillCount: shouldClearSkills
        ? 0
        : toNumber(record.get('matchedSkillCount')),
      avgConfidence: shouldClearSkills
        ? 0
        : toNumber(record.get('avgConfidence')),
      matchedDomainNames,
    };
  });

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
    preferredSkillProficiencies,
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
    appliedConstraints: expanded.appliedConstraints,
    queryMetadata: {
      executionTimeMs,
      skillsExpanded: expandedSkillNames,
      defaultsApplied: expanded.defaultsApplied,
      unresolvedSkills,
    },
  };
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
