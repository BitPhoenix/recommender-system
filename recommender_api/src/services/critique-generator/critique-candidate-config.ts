/**
 * Critique Adjustment Candidate Property Value Configurations
 *
 * Shared configurations for generating critique suggestions. Each property type
 * (timezone, seniority, skill, timeline, budget, domains) has a config that defines:
 * - How to get candidate property values to evaluate
 * - How to check if an engineer passes the filter
 * - How to build the critique adjustment
 * - How to format descriptions for single-property suggestions
 *
 * Used by both single-property and compound critique suggestion generators.
 */

import type { EngineerMatch, SearchFilterRequest } from '../../types/search.types.js';
import type { ExpandedSearchCriteria } from '../constraint-expander.service.js';
import type { CritiquableProperty } from '../../types/critique.types.js';
import { SENIORITY_LEVEL_ORDER, START_TIMELINE_ORDER, US_TIMEZONE_ZONE_ORDER } from '../../schemas/search.schema.js';
import { seniorityMinYears } from '../../config/knowledge-base/utility.config.js';
import { countSkillOccurrencesAcrossEngineerMatches, capitalize } from './pattern-mining-utils.js';

// ============================================
// TYPES
// ============================================

/**
 * A property value that is a candidate for becoming part of a CritiqueAdjustment.
 * Example: { id: 'Pacific', displayLabel: 'Pacific', matchValue: 'Pacific' }
 *
 * Note: A full critique is "property + operation + value", but this type represents
 * just the **value** part - a potential value we might suggest for a property.
 */
export interface CritiqueAdjustmentCandidatePropertyValue {
  /** Unique identifier for this candidate property value */
  id: string;
  /** Human-readable label for descriptions (e.g., "Pacific", "Senior", "Python") */
  displayLabel: string;
  /**
   * Data needed to check if an engineer passes this filter.
   * Type depends on property:
   * - Timezone: the zone name (string), e.g., "Pacific"
   * - Seniority: minimum years threshold (number), e.g., 6
   * - Timeline: index in START_TIMELINE_ORDER (number), e.g., 1
   * - Skills: the skillId (string), e.g., "skill-uuid-123"
   * - Budget: salary threshold (number), e.g., 150000
   * - BusinessDomains: the domainId (string), e.g., "domain-fintech-123"
   * - TechnicalDomains: the domainId (string), e.g., "domain-cloud-456"
   */
  matchValue: string | number;
}

/**
 * Context passed to candidate property value configs containing both the original
 * request and expanded criteria. Configs can access what they need from each:
 * - searchFilterRequest: original user constraints (skills, domains, seniority level, etc.)
 * - expandedSearchCriteria: derived values (minYearsExperience, timezoneZones, startTimeline, etc.)
 */
export interface CritiqueAdjustmentCandidateContext {
  searchFilterRequest: SearchFilterRequest;
  expandedSearchCriteria: ExpandedSearchCriteria;
}

/**
 * Configuration for generating candidate property values for a specific property type.
 * Each critiquable property has its own config defining how to:
 * - Get candidate property values to evaluate
 * - Check if an engineer passes the filter
 * - Build the critique adjustment
 * - Format descriptions for single-property suggestions
 */
export interface CritiqueAdjustmentCandidatePropertyConfig {
  /** Which critiquable property this config handles */
  propertyKey: CritiquableProperty;

  /**
   * Get candidate property values that could be suggested for this property.
   * Should exclude values already constrained by the current search.
   */
  getCritiqueAdjustmentCandidatePropertyValues(
    engineerMatches: EngineerMatch[],
    context: CritiqueAdjustmentCandidateContext
  ): CritiqueAdjustmentCandidatePropertyValue[];

  /**
   * Check if an engineer passes the filter for this candidate property value.
   */
  doesEngineerPassFilter(
    engineerMatch: EngineerMatch,
    candidatePropertyValue: CritiqueAdjustmentCandidatePropertyValue
  ): boolean;

  /**
   * Build the critique adjustment for this candidate property value.
   */
  buildCritiqueAdjustment(
    candidatePropertyValue: CritiqueAdjustmentCandidatePropertyValue
  ): { property: string; operation: string; direction?: string; value?: unknown };

  /**
   * Format description for a single-property suggestion.
   * Example: "Require Pacific timezone", "Add Python requirement"
   */
  formatDescription(candidatePropertyValue: CritiqueAdjustmentCandidatePropertyValue): string;

  /**
   * Format rationale for a single-property suggestion.
   * Example: "45% of current engineers are in Pacific timezone"
   */
  formatRationale(candidatePropertyValue: CritiqueAdjustmentCandidatePropertyValue, supportPercentage: number): string;
}

// ============================================
// CRITIQUE CANDIDATE CONFIGURATIONS
// ============================================

/**
 * Candidate configuration for timezone property.
 * Candidates are US timezone zones not already required.
 */
export const timezoneCandidateConfig: CritiqueAdjustmentCandidatePropertyConfig = {
  propertyKey: 'timezone',

  getCritiqueAdjustmentCandidatePropertyValues(_engineerMatches, context) {
    const alreadyRequiredTimezones = context.expandedSearchCriteria.timezoneZones ?? [];

    return US_TIMEZONE_ZONE_ORDER
      .filter(timezone => !alreadyRequiredTimezones.includes(timezone))
      .map(timezone => ({
        id: timezone,
        displayLabel: timezone,
        matchValue: timezone,
      }));
  },

  doesEngineerPassFilter(engineerMatch, candidate) {
    return engineerMatch.timezone === candidate.matchValue;
  },

  buildCritiqueAdjustment(candidate) {
    return { property: 'timezone', operation: 'set', value: candidate.matchValue };
  },

  formatDescription(candidate) {
    return `Require ${candidate.displayLabel} timezone`;
  },

  formatRationale(candidate, supportPercentage) {
    return `${supportPercentage}% of current engineers are in ${candidate.displayLabel} timezone`;
  },
};

/**
 * Candidate configuration for seniority property.
 * Candidates are seniority levels stricter than the current constraint.
 */
export const seniorityCandidateConfig: CritiqueAdjustmentCandidatePropertyConfig = {
  propertyKey: 'seniority',

  getCritiqueAdjustmentCandidatePropertyValues(_engineerMatches, context) {
    const currentMinYearsRequired = context.expandedSearchCriteria.minYearsExperience ?? 0;

    return SENIORITY_LEVEL_ORDER
      .filter(level => seniorityMinYears[level] > currentMinYearsRequired)
      .map(level => ({
        id: level,
        displayLabel: capitalize(level),
        matchValue: seniorityMinYears[level],  // Store minYears for matching
      }));
  },

  doesEngineerPassFilter(engineerMatch, candidate) {
    const requiredMinYears = candidate.matchValue as number;
    return engineerMatch.yearsExperience >= requiredMinYears;
  },

  buildCritiqueAdjustment(candidate) {
    return { property: 'seniority', operation: 'set', value: candidate.id };
  },

  formatDescription(candidate) {
    const minYears = candidate.matchValue as number;
    return `Require ${candidate.displayLabel.toLowerCase()}-level experience (${minYears}+ years)`;
  },

  formatRationale(candidate, supportPercentage) {
    const minYears = candidate.matchValue as number;
    return `${supportPercentage}% of current engineers have ${minYears}+ years experience`;
  },
};

/**
 * Candidate configuration for timeline property.
 * Candidates are timelines stricter (earlier) than the current constraint.
 *
 * Timeline matching is cumulative: an engineer "matches" a timeline if they
 * can start at or before that timeline (e.g., "immediate" matches "two_weeks").
 */
export const timelineCandidateConfig: CritiqueAdjustmentCandidatePropertyConfig = {
  propertyKey: 'timeline',

  getCritiqueAdjustmentCandidatePropertyValues(_engineerMatches, context) {
    const currentAllowedTimelines = context.expandedSearchCriteria.startTimeline ?? [...START_TIMELINE_ORDER];

    /*
     * Find the loosest currently allowed timeline (latest in order).
     * We suggest stricter timelines (earlier ones) as tightening options.
     */
    const loosestCurrentIndex = Math.max(
      ...currentAllowedTimelines.map(timeline => START_TIMELINE_ORDER.indexOf(timeline))
    );

    // Return timelines stricter than current (earlier in the order, excluding the loosest)
    return START_TIMELINE_ORDER
      .slice(0, loosestCurrentIndex)  // All timelines before the loosest allowed
      .map(timeline => ({
        id: timeline,
        displayLabel: timeline.replace(/_/g, ' '),  // "two_weeks" -> "two weeks"
        matchValue: START_TIMELINE_ORDER.indexOf(timeline),  // Store index for matching
      }));
  },

  doesEngineerPassFilter(engineerMatch, candidate) {
    const candidateTimelineIndex = candidate.matchValue as number;
    const engineerTimelineIndex = START_TIMELINE_ORDER.indexOf(engineerMatch.startTimeline as typeof START_TIMELINE_ORDER[number]);
    // Engineer matches if they can start at or before the candidate timeline
    return engineerTimelineIndex <= candidateTimelineIndex;
  },

  buildCritiqueAdjustment(candidate) {
    return { property: 'timeline', operation: 'set', value: candidate.id };
  },

  formatDescription(candidate) {
    return `Require ${candidate.displayLabel} or sooner`;
  },

  formatRationale(candidate, supportPercentage) {
    return `${supportPercentage}% of current engineers available ${candidate.displayLabel} or sooner`;
  },
};

/**
 * Candidate configuration for skills property.
 * Candidates are top skills (by occurrence) not already required.
 *
 * We exclude skills already in requirements because suggesting them would be
 * redundant - the user has already applied that constraint. Dynamic critiques
 * should help users discover NEW refinements, not remind them of existing ones.
 */
export const skillsCandidateConfig: CritiqueAdjustmentCandidatePropertyConfig = {
  propertyKey: 'skills',

  getCritiqueAdjustmentCandidatePropertyValues(engineerMatches, context) {
    const skillOccurrences = countSkillOccurrencesAcrossEngineerMatches(engineerMatches);
    /*
     * Extract already-required skill names from the original request.
     * The request contains SkillRequirement objects with a 'skill' (name) field.
     */
    const alreadyRequiredSkillNames = new Set(
      context.searchFilterRequest.requiredSkills?.map(skillReq => skillReq.skill) ?? []
    );

    const TOP_SKILLS_LIMIT = 5;

    return Array.from(skillOccurrences.entries())
      .filter(([_skillId, { name }]) => !alreadyRequiredSkillNames.has(name))
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, TOP_SKILLS_LIMIT)
      .map(([skillId, { name: skillName }]) => ({
        id: skillId,
        displayLabel: skillName,
        matchValue: skillId,  // Store skillId for matching
      }));
  },

  doesEngineerPassFilter(engineerMatch, candidate) {
    const targetSkillId = candidate.matchValue as string;
    return engineerMatch.matchedSkills.some(skill => skill.skillId === targetSkillId);
  },

  buildCritiqueAdjustment(candidate) {
    return {
      property: 'skills',
      operation: 'add',
      value: { skill: candidate.displayLabel, proficiency: 'learning' },
    };
  },

  formatDescription(candidate) {
    return `Add ${candidate.displayLabel} requirement`;
  },

  formatRationale(candidate, supportPercentage) {
    return `${supportPercentage}% of current engineers have ${candidate.displayLabel}`;
  },
};

/**
 * Candidate configuration for budget property.
 * Suggests tightening budget based on salary distribution of current matches.
 *
 * Uses salary percentiles to find natural breakpoints where a significant
 * portion of engineers fall below a threshold.
 */
export const budgetCandidateConfig: CritiqueAdjustmentCandidatePropertyConfig = {
  propertyKey: 'budget',

  getCritiqueAdjustmentCandidatePropertyValues(engineerMatches, context) {
    const currentMaxBudget = context.expandedSearchCriteria.maxBudget;

    // Get all salaries and sort ascending
    const salaries = engineerMatches
      .map(engineerMatch => engineerMatch.salary)
      .filter((salary): salary is number => salary != null)
      .sort((a, b) => a - b);

    if (salaries.length === 0) return [];

    // Generate candidates at 25th, 50th, 75th percentiles
    const percentiles = [0.25, 0.5, 0.75];
    const candidates: CritiqueAdjustmentCandidatePropertyValue[] = [];

    for (const percentile of percentiles) {
      const index = Math.floor(salaries.length * percentile);
      const salaryThreshold = salaries[index];

      // Only suggest if it's stricter than current budget
      if (currentMaxBudget == null || salaryThreshold < currentMaxBudget) {
        candidates.push({
          id: `budget-${salaryThreshold}`,
          displayLabel: `$${salaryThreshold.toLocaleString()}`,
          matchValue: salaryThreshold,
        });
      }
    }

    // Deduplicate (in case percentiles land on same value)
    const seen = new Set<number>();
    return candidates.filter(candidate => {
      const salary = candidate.matchValue as number;
      if (seen.has(salary)) return false;
      seen.add(salary);
      return true;
    });
  },

  doesEngineerPassFilter(engineerMatch, candidate) {
    const budgetThreshold = candidate.matchValue as number;
    return engineerMatch.salary != null && engineerMatch.salary <= budgetThreshold;
  },

  buildCritiqueAdjustment(candidate) {
    return {
      property: 'budget',
      operation: 'set',
      value: candidate.matchValue,
    };
  },

  formatDescription(candidate) {
    return `Lower budget to ${candidate.displayLabel}`;
  },

  formatRationale(candidate, supportPercentage) {
    return `${supportPercentage}% of current engineers have salaries at or below ${candidate.displayLabel}`;
  },
};

/**
 * Candidate configuration for businessDomains property.
 * Candidates are business domains common among current matches but not required.
 *
 * Uses matchedBusinessDomains from EngineerMatch, which contains BusinessDomainMatch
 * objects with domainId, domainName, engineerYears, etc.
 */
export const businessDomainsCandidateConfig: CritiqueAdjustmentCandidatePropertyConfig = {
  propertyKey: 'businessDomains',

  getCritiqueAdjustmentCandidatePropertyValues(engineerMatches, context) {
    // Count domain occurrences across matches
    const domainOccurrences = new Map<string, { count: number; name: string }>();
    for (const engineerMatch of engineerMatches) {
      for (const domainMatch of engineerMatch.matchedBusinessDomains ?? []) {
        const existing = domainOccurrences.get(domainMatch.domainId);
        if (existing) {
          existing.count++;
        } else {
          domainOccurrences.set(domainMatch.domainId, { count: 1, name: domainMatch.domainName });
        }
      }
    }

    /*
     * Extract already-required domain names from the original request.
     * The request contains BusinessDomainRequirement objects with a 'domain' (name) field.
     */
    const alreadyRequiredDomainNames = new Set(
      context.searchFilterRequest.requiredBusinessDomains?.map(domainReq => domainReq.domain) ?? []
    );

    const TOP_DOMAINS_LIMIT = 5;

    return Array.from(domainOccurrences.entries())
      .filter(([_domainId, { name }]) => !alreadyRequiredDomainNames.has(name))
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, TOP_DOMAINS_LIMIT)
      .map(([domainId, { name }]) => ({
        id: domainId,
        displayLabel: name,
        matchValue: domainId,  // Store domainId for matching
      }));
  },

  doesEngineerPassFilter(engineerMatch, candidate) {
    const targetDomainId = candidate.matchValue as string;
    return engineerMatch.matchedBusinessDomains?.some(domain => domain.domainId === targetDomainId) ?? false;
  },

  buildCritiqueAdjustment(candidate) {
    return {
      property: 'businessDomains',
      operation: 'add',
      value: { domain: candidate.displayLabel },
    };
  },

  formatDescription(candidate) {
    return `Add ${candidate.displayLabel} business domain requirement`;
  },

  formatRationale(candidate, supportPercentage) {
    return `${supportPercentage}% of current engineers have ${candidate.displayLabel} experience`;
  },
};

/**
 * Candidate configuration for technicalDomains property.
 * Candidates are technical domains common among current matches but not required.
 *
 * Uses matchedTechnicalDomains from EngineerMatch, which contains TechnicalDomainMatch
 * objects with domainId, domainName, engineerYears, matchType, etc.
 */
export const technicalDomainsCandidateConfig: CritiqueAdjustmentCandidatePropertyConfig = {
  propertyKey: 'technicalDomains',

  getCritiqueAdjustmentCandidatePropertyValues(engineerMatches, context) {
    // Count domain occurrences across matches
    const domainOccurrences = new Map<string, { count: number; name: string }>();
    for (const engineerMatch of engineerMatches) {
      for (const domainMatch of engineerMatch.matchedTechnicalDomains ?? []) {
        const existing = domainOccurrences.get(domainMatch.domainId);
        if (existing) {
          existing.count++;
        } else {
          domainOccurrences.set(domainMatch.domainId, { count: 1, name: domainMatch.domainName });
        }
      }
    }

    /*
     * Extract already-required domain names from the original request.
     * The request contains TechnicalDomainRequirement objects with a 'domain' (name) field.
     */
    const alreadyRequiredDomainNames = new Set(
      context.searchFilterRequest.requiredTechnicalDomains?.map(domainReq => domainReq.domain) ?? []
    );

    const TOP_DOMAINS_LIMIT = 5;

    return Array.from(domainOccurrences.entries())
      .filter(([_domainId, { name }]) => !alreadyRequiredDomainNames.has(name))
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, TOP_DOMAINS_LIMIT)
      .map(([domainId, { name }]) => ({
        id: domainId,
        displayLabel: name,
        matchValue: domainId,  // Store domainId for matching
      }));
  },

  doesEngineerPassFilter(engineerMatch, candidate) {
    const targetDomainId = candidate.matchValue as string;
    return engineerMatch.matchedTechnicalDomains?.some(domain => domain.domainId === targetDomainId) ?? false;
  },

  buildCritiqueAdjustment(candidate) {
    return {
      property: 'technicalDomains',
      operation: 'add',
      value: { domain: candidate.displayLabel },
    };
  },

  formatDescription(candidate) {
    return `Add ${candidate.displayLabel} technical domain requirement`;
  },

  formatRationale(candidate, supportPercentage) {
    return `${supportPercentage}% of current engineers have ${candidate.displayLabel} experience`;
  },
};

// ============================================
// CONFIG COLLECTIONS
// ============================================

/**
 * Configs for single-property critique candidate generation.
 * All critiquable properties are included for single-property suggestions.
 */
export const SINGLE_PROPERTY_CANDIDATE_CONFIGS: CritiqueAdjustmentCandidatePropertyConfig[] = [
  timezoneCandidateConfig,
  seniorityCandidateConfig,
  timelineCandidateConfig,
  skillsCandidateConfig,
  budgetCandidateConfig,
  businessDomainsCandidateConfig,
  technicalDomainsCandidateConfig,
];

/**
 * Pairs of configs for compound critique candidate generation.
 * Each pair produces suggestions like "Senior + Pacific" or "Python + Eastern".
 *
 * We focus on the most useful combinations. Additional pairs could be added
 * (e.g., skills + domains) if valuable patterns emerge in practice.
 */
export const COMPOUND_PROPERTY_PAIRS: [CritiqueAdjustmentCandidatePropertyConfig, CritiqueAdjustmentCandidatePropertyConfig][] = [
  [timezoneCandidateConfig, seniorityCandidateConfig],   // "Senior engineers in Pacific timezone"
  [skillsCandidateConfig, timezoneCandidateConfig],      // "Python developers in Eastern timezone"
  [skillsCandidateConfig, seniorityCandidateConfig],     // "Senior Python developers"
];
