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
} from '../types/search.types.js';
import { expandConstraints } from './constraint-expander.service.js';
import { resolveSkillHierarchy } from './skill-resolver.service.js';
import {
  buildSearchQuery,
  buildCountQuery,
  type CypherQueryParams,
} from './cypher-query-builder/index.js';
import {
  scoreAndSortEngineers,
  type EngineerData,
  type UtilityContext,
} from './utility-calculator.service.js';

// Raw skill data from Cypher query (before splitting into matched/unmatched)
interface RawSkillData {
  skillId: string;
  skillName: string;
  proficiencyLevel: string;
  confidenceScore: number;
  yearsUsed: number;
  matchType: 'direct' | 'descendant' | 'none';
  // These fields only exist in skill search mode, not browse mode
  meetsConfidence?: boolean;
  meetsProficiency?: boolean;
}

interface RawEngineerRecord {
  id: string;
  name: string;
  headline: string;
  salary: number;
  yearsExperience: number;
  availability: string;
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

  // Step 1: Expand constraints using knowledge base rules
  const expanded = expandConstraints(request);

  // Step 2: Resolve skill hierarchy if skills are specified
  let targetSkillIds: string[] | null = null;
  let expandedSkillNames: string[] = [];
  let unresolvedSkills: string[] = [];
  const skillIdentifiers = request.requiredSkills || null;
  const skillsWereRequested = skillIdentifiers !== null && skillIdentifiers.length > 0;

  if (skillsWereRequested) {
    const skillResolution = await resolveSkillHierarchy(session, skillIdentifiers);
    targetSkillIds = skillResolution.resolvedSkills.map((s) => s.skillId);
    expandedSkillNames = skillResolution.expandedSkillNames;

    // Track which requested skills didn't resolve to anything
    // Use matchedIdentifiers which includes categories that matched
    const matchedSet = new Set(
      skillResolution.matchedIdentifiers.map((id) => id.toLowerCase())
    );
    unresolvedSkills = skillIdentifiers.filter(
      (id) => !matchedSet.has(id.toLowerCase())
    );
  }

  // Step 2b: Resolve preferred skills hierarchy
  let preferredSkillIds: string[] = [];
  const preferredIdentifiers = request.preferredSkills || null;
  const preferredSkillsWereRequested =
    preferredIdentifiers !== null && preferredIdentifiers.length > 0;

  if (preferredSkillsWereRequested) {
    const preferredResolution = await resolveSkillHierarchy(session, preferredIdentifiers);
    preferredSkillIds = preferredResolution.resolvedSkills.map((s) => s.skillId);
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

  // Step 3: Build query parameters
  const queryParams: CypherQueryParams = {
    targetSkillIds,
    skillIdentifiers,
    availability: expanded.availability,
    minYearsExperience: expanded.minYearsExperience,
    maxYearsExperience: expanded.maxYearsExperience,
    minConfidenceScore: expanded.minConfidenceScore,
    allowedProficiencyLevels: expanded.allowedProficiencyLevels,
    timezonePrefix: expanded.timezonePrefix,
    maxSalary: expanded.maxSalary,
    minSalary: expanded.minSalary,
    offset: expanded.offset,
    limit: expanded.limit,
    // Domain filtering
    requiredDomainIds: requiredDomainIds.length > 0 ? requiredDomainIds : undefined,
    preferredDomainIds: preferredDomainIds.length > 0 ? preferredDomainIds : undefined,
  };

  // Step 4: Execute main query (unified for both skill search and browse modes)
  const hasResolvedSkills = targetSkillIds !== null && targetSkillIds.length > 0;
  const mainQuery = buildSearchQuery(queryParams);

  // Run queries sequentially (Neo4j sessions don't support concurrent queries)
  const mainResult = await session.run(mainQuery.query, mainQuery.params);
  const countQuery = buildCountQuery(queryParams);
  const countResult = await session.run(countQuery.query, countQuery.params);

  // Step 5: Process results
  // Determine how to handle skills based on search mode:
  // - requiredSkills specified → split skills into matched/unmatched based on constraints
  // - teamFocus only → show only aligned skills (filter to alignedSkillIds)
  // - neither specified → clear skills (pure browse mode)
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
          // No constraint checks (browse mode) - treat as matched
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
      availability: record.get('availability') as string,
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

  const totalCount = toNumber(countResult.records[0]?.get('totalCount') || 0);

  // Step 6: Calculate utility scores and rank
  const utilityContext: UtilityContext = {
    requestedSkillIds: targetSkillIds || [],
    preferredSkillIds,
    preferredDomainIds,
    alignedSkillIds: expanded.alignedSkillIds,
    maxSalaryBudget: expanded.maxSalary,
    // Pass through preferred values
    preferredSeniorityLevel: expanded.preferredSeniorityLevel,
    preferredAvailability: expanded.preferredAvailability,
    preferredTimezone: expanded.preferredTimezone,
    preferredSalaryRange: expanded.preferredSalaryRange,
    preferredConfidenceScore: expanded.preferredConfidenceScore,
    preferredProficiency: expanded.preferredProficiency,
  };

  const engineerData: EngineerData[] = rawEngineers.map((raw) => ({
    id: raw.id,
    name: raw.name,
    headline: raw.headline,
    salary: raw.salary,
    yearsExperience: raw.yearsExperience,
    availability: raw.availability,
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
    availability: eng.availability,
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
