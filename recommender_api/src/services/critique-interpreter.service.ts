/**
 * Critique Interpreter Service
 *
 * Translates CritiqueAdjustment[] into modified SearchFilterRequest.
 * Leverages the discriminated union on 'operation' for type-safe handling.
 *
 * Section 5.3.2.1 (Simple Critiques): Single adjustment
 * Section 5.3.2.2 (Compound Critiques): Multiple adjustments
 */

import type { SearchFilterRequest, SkillRequirement } from '../types/search.types.js';
import type {
  CritiqueAdjustment,
  AppliedCritiqueAdjustment,
  FailedCritiqueAdjustment,
  SkillValue,
  DomainValue,
} from '../types/critique.types.js';
import {
  SENIORITY_LEVEL_ORDER,
  PROFICIENCY_LEVEL_ORDER,
  START_TIMELINE_ORDER,
  US_TIMEZONE_ZONE_ORDER,
} from '../schemas/search.schema.js';
import { critiqueConfig } from '../config/knowledge-base/critique.config.js';

// ============================================
// TYPES
// ============================================

/**
 * Result of interpreting critique adjustments.
 */
export interface InterpretedCritiques {
  /** The search request after applying all critique adjustments */
  modifiedSearchFilterRequest: SearchFilterRequest;
  appliedCritiqueAdjustments: AppliedCritiqueAdjustment[];
  failedCritiqueAdjustments: FailedCritiqueAdjustment[];
}

/** Result type for individual adjustment application */
type AdjustmentResult =
  | { type: 'applied'; modifiedSearchFilterRequest: SearchFilterRequest; applied: AppliedCritiqueAdjustment }
  | { type: 'failed'; failed: FailedCritiqueAdjustment };

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Interpret critique adjustments and apply them to search criteria.
 *
 * Takes user-facing adjustments (e.g., "more experience") and translates
 * them into concrete changes to the SearchFilterRequest.
 */
export function applyAdjustmentsToSearchCriteria(
  baseCriteria: SearchFilterRequest,
  adjustments: CritiqueAdjustment[]
): InterpretedCritiques {
  let modifiedSearchFilterRequest = { ...baseCriteria };
  const appliedCritiqueAdjustments: AppliedCritiqueAdjustment[] = [];
  const failedCritiqueAdjustments: FailedCritiqueAdjustment[] = [];

  /*
   * Iterates over adjustments sequentially.
   * Accumulates applied/failed results.
   * Updates modifiedSearchFilterRequest on each success.
   */
  for (const adjustment of adjustments) {
    const result = applyAdjustmentToSearchCriteria(modifiedSearchFilterRequest, adjustment);
    if (result.type === 'applied') {
      modifiedSearchFilterRequest = result.modifiedSearchFilterRequest;
      appliedCritiqueAdjustments.push(result.applied);
    } else {
      failedCritiqueAdjustments.push(result.failed);
    }
  }

  return { modifiedSearchFilterRequest, appliedCritiqueAdjustments, failedCritiqueAdjustments };
}

// ============================================
// DISPATCHER
// ============================================

/**
 * Apply a single adjustment to search criteria.
 *
 * Dispatches by property, then uses TypeScript's discriminated union
 * narrowing on 'operation' within each handler for type-safe access
 * to operation-specific fields (direction, value, item).
 */
function applyAdjustmentToSearchCriteria(
  searchCriteria: SearchFilterRequest,
  adjustment: CritiqueAdjustment
): AdjustmentResult {
  switch (adjustment.property) {
    case 'seniority':
      return applySeniorityAdjustmentToSearchCriteria(searchCriteria, adjustment);
    case 'budget':
      return applyBudgetAdjustmentToSearchCriteria(searchCriteria, adjustment);
    case 'timeline':
      return applyTimelineAdjustmentToSearchCriteria(searchCriteria, adjustment);
    case 'timezone':
      return applyTimezoneAdjustmentToSearchCriteria(searchCriteria, adjustment);
    case 'skills':
      return applySkillsAdjustmentToSearchCriteria(searchCriteria, adjustment);
    case 'businessDomains':
      return applyDomainAdjustmentToSearchCriteria(searchCriteria, adjustment, 'business');
    case 'technicalDomains':
      return applyDomainAdjustmentToSearchCriteria(searchCriteria, adjustment, 'technical');
  }
}

// ============================================
// PROPERTY HANDLERS
// ============================================

function applySeniorityAdjustmentToSearchCriteria(
  searchCriteria: SearchFilterRequest,
  adjustment: CritiqueAdjustment
): AdjustmentResult {
  const currentLevel = searchCriteria.requiredSeniorityLevel;
  const currentIndex = currentLevel ? SENIORITY_LEVEL_ORDER.indexOf(currentLevel) : -1;
  let newLevel: typeof currentLevel;
  let warning: string | undefined;

  /*
   * Type narrowing via discriminated union:
   * When adjustment.operation === 'set', TypeScript knows adjustment is SetOperation,
   * so adjustment.value is guaranteed to exist and is typed.
   * When adjustment.operation === 'adjust', TypeScript knows adjustment is AdjustOperation,
   * so adjustment.direction is guaranteed to exist.
   */
  switch (adjustment.operation) {
    case 'set':
      // adjustment is narrowed to SetOperation, adjustment.value is required
      newLevel = adjustment.value as typeof currentLevel;
      break;

    case 'adjust': {
      // adjustment is narrowed to AdjustOperation, adjustment.direction is required
      let newIndex: number;
      if (adjustment.direction === 'more') {
        newIndex = Math.min(currentIndex + 1, SENIORITY_LEVEL_ORDER.length - 1);
        if (currentIndex === SENIORITY_LEVEL_ORDER.length - 1) {
          warning = 'Already at maximum seniority (principal)';
        }
      } else {
        newIndex = Math.max(currentIndex - 1, 0);
        if (currentIndex <= 0) {
          warning = 'Already at minimum seniority (junior)';
        }
      }
      newLevel = SENIORITY_LEVEL_ORDER[Math.max(0, newIndex)] as typeof currentLevel;
      break;
    }

    default:
      // 'add' and 'remove' not valid for seniority (enforced by schema)
      throw new Error(`Invalid operation '${(adjustment as CritiqueAdjustment).operation}' for seniority`);
  }

  return {
    type: 'applied',
    modifiedSearchFilterRequest: { ...searchCriteria, requiredSeniorityLevel: newLevel },
    applied: {
      property: adjustment.property,
      operation: adjustment.operation,
      direction: adjustment.operation === 'adjust' ? adjustment.direction : undefined,
      value: adjustment.operation === 'set' ? adjustment.value : undefined,
      modifiedField: 'requiredSeniorityLevel',
      previousValue: currentLevel ?? null,
      newValue: newLevel,
      warning,
    },
  };
}

function applyBudgetAdjustmentToSearchCriteria(
  searchCriteria: SearchFilterRequest,
  adjustment: CritiqueAdjustment
): AdjustmentResult {
  const currentBudget = searchCriteria.maxBudget;
  let newBudget: number | undefined;
  let warning: string | undefined;

  if (adjustment.operation === 'set') {
    newBudget = adjustment.value as number;
  } else if (adjustment.operation === 'adjust') {
    if (!currentBudget) {
      // Cannot adjust a budget that doesn't exist - this is a failed adjustment
      return {
        type: 'failed',
        failed: {
          property: 'budget',
          operation: 'adjust',
          direction: adjustment.direction,
          targetField: 'maxBudget',
          reason: 'No budget constraint set - cannot adjust a non-existent value',
        },
      };
    }
    const { adjustmentFactor, floorValue } = critiqueConfig.budget;
    if (adjustment.direction === 'more') {
      newBudget = Math.round(currentBudget * (1 + adjustmentFactor));
    } else {
      newBudget = Math.round(currentBudget * (1 - adjustmentFactor));
      if (newBudget < floorValue) {
        newBudget = floorValue;
        warning = `Budget floor reached ($${floorValue.toLocaleString()})`;
      }
    }
  } else {
    throw new Error(`Invalid operation '${adjustment.operation}' for budget`);
  }

  return {
    type: 'applied',
    modifiedSearchFilterRequest: { ...searchCriteria, maxBudget: newBudget },
    applied: {
      property: 'budget',
      operation: adjustment.operation,
      direction: adjustment.operation === 'adjust' ? adjustment.direction : undefined,
      value: adjustment.operation === 'set' ? adjustment.value : undefined,
      modifiedField: 'maxBudget',
      previousValue: currentBudget ?? null,
      newValue: newBudget,
      warning,
    },
  };
}

function applyTimelineAdjustmentToSearchCriteria(
  searchCriteria: SearchFilterRequest,
  adjustment: CritiqueAdjustment
): AdjustmentResult {
  const currentTimeline = searchCriteria.requiredMaxStartTime;
  const currentIndex = currentTimeline
    ? START_TIMELINE_ORDER.indexOf(currentTimeline)
    : START_TIMELINE_ORDER.length - 1;
  let newTimeline: typeof currentTimeline;
  let warning: string | undefined;

  if (adjustment.operation === 'set') {
    newTimeline = adjustment.value as typeof currentTimeline;
  } else if (adjustment.operation === 'adjust') {
    let newIndex: number;
    if (adjustment.direction === 'sooner') {
      newIndex = Math.max(currentIndex - 1, 0);
      if (currentIndex === 0) warning = 'Already at fastest timeline (immediate)';
    } else {
      newIndex = Math.min(currentIndex + 1, START_TIMELINE_ORDER.length - 1);
      if (currentIndex === START_TIMELINE_ORDER.length - 1) warning = 'Already at slowest timeline';
    }
    newTimeline = START_TIMELINE_ORDER[newIndex] as typeof currentTimeline;
  } else {
    throw new Error(`Invalid operation '${adjustment.operation}' for timeline`);
  }

  return {
    type: 'applied',
    modifiedSearchFilterRequest: { ...searchCriteria, requiredMaxStartTime: newTimeline },
    applied: {
      property: 'timeline',
      operation: adjustment.operation,
      direction: adjustment.operation === 'adjust' ? adjustment.direction : undefined,
      value: adjustment.operation === 'set' ? adjustment.value : undefined,
      modifiedField: 'requiredMaxStartTime',
      previousValue: currentTimeline ?? null,
      newValue: newTimeline,
      warning,
    },
  };
}

function applyTimezoneAdjustmentToSearchCriteria(
  searchCriteria: SearchFilterRequest,
  adjustment: CritiqueAdjustment
): AdjustmentResult {
  const currentTimezones = searchCriteria.requiredTimezone ?? [];
  let newTimezones: typeof searchCriteria.requiredTimezone;
  let warning: string | undefined;

  if (adjustment.operation === 'set') {
    const value = adjustment.value;
    newTimezones = Array.isArray(value) ? value as typeof newTimezones : [value as string] as typeof newTimezones;
  } else if (adjustment.operation === 'adjust') {
    if (adjustment.direction === 'narrower') {
      if (currentTimezones.length === 0) {
        // Cannot narrow a non-existent constraint
        return {
          type: 'failed',
          failed: {
            property: 'timezone',
            operation: 'adjust',
            direction: adjustment.direction,
            targetField: 'requiredTimezone',
            reason: 'No timezone constraint set - cannot narrow a non-existent constraint',
          },
        };
      } else if (currentTimezones.length === 1) {
        warning = 'Already at single timezone';
        newTimezones = [...currentTimezones];
      } else {
        // Remove outermost timezones
        const timezoneIndices = currentTimezones
          .map(timezone => US_TIMEZONE_ZONE_ORDER.indexOf(timezone))
          .sort((a, b) => a - b);
        const middleIndices = timezoneIndices.slice(1, -1);
        newTimezones = middleIndices.length > 0
          ? middleIndices.map(index => US_TIMEZONE_ZONE_ORDER[index]) as typeof newTimezones
          : [US_TIMEZONE_ZONE_ORDER[timezoneIndices[0]]] as typeof newTimezones;
      }
    } else {  // wider
      if (currentTimezones.length === 0) {
        // Cannot widen a non-existent constraint
        return {
          type: 'failed',
          failed: {
            property: 'timezone',
            operation: 'adjust',
            direction: adjustment.direction,
            targetField: 'requiredTimezone',
            reason: 'No timezone constraint set - cannot widen a non-existent constraint',
          },
        };
      } else if (currentTimezones.length >= US_TIMEZONE_ZONE_ORDER.length) {
        warning = 'Already includes all timezones';
        newTimezones = [...currentTimezones];
      } else {
        const timezoneIndices = currentTimezones.map(timezone => US_TIMEZONE_ZONE_ORDER.indexOf(timezone));
        const expandedIndices = new Set(timezoneIndices);
        const minIndex = Math.min(...timezoneIndices);
        const maxIndex = Math.max(...timezoneIndices);
        if (minIndex > 0) expandedIndices.add(minIndex - 1);
        if (maxIndex < US_TIMEZONE_ZONE_ORDER.length - 1) expandedIndices.add(maxIndex + 1);
        newTimezones = Array.from(expandedIndices)
          .sort((a, b) => a - b)
          .map(index => US_TIMEZONE_ZONE_ORDER[index]) as typeof newTimezones;
      }
    }
  } else {
    throw new Error(`Invalid operation '${adjustment.operation}' for timezone`);
  }

  return {
    type: 'applied',
    modifiedSearchFilterRequest: { ...searchCriteria, requiredTimezone: newTimezones },
    applied: {
      property: 'timezone',
      operation: adjustment.operation,
      direction: adjustment.operation === 'adjust' ? adjustment.direction : undefined,
      value: adjustment.operation === 'set' ? adjustment.value : undefined,
      modifiedField: 'requiredTimezone',
      previousValue: currentTimezones.length > 0 ? currentTimezones : null,
      newValue: newTimezones ?? null,
      warning,
    },
  };
}

function applySkillsAdjustmentToSearchCriteria(
  searchCriteria: SearchFilterRequest,
  adjustment: CritiqueAdjustment
): AdjustmentResult {
  const currentSkills = searchCriteria.requiredSkills ?? [];
  let newSkills = [...currentSkills];
  let warning: string | undefined;

  if (adjustment.operation === 'add') {
    const skillValue = adjustment.value as SkillValue;
    const existingIndex = currentSkills.findIndex(skill => skill.skill === skillValue.skill);
    if (existingIndex >= 0) {
      warning = `Skill "${skillValue.skill}" already required - updating proficiency`;
      newSkills[existingIndex] = { ...newSkills[existingIndex], minProficiency: skillValue.proficiency ?? 'learning' };
    } else {
      newSkills.push({ skill: skillValue.skill, minProficiency: skillValue.proficiency ?? 'learning' });
    }
  } else if (adjustment.operation === 'remove') {
    const skillName = adjustment.item!;
    const existingIndex = currentSkills.findIndex(skill => skill.skill === skillName);
    if (existingIndex < 0) {
      // Cannot remove a skill that isn't in requirements
      return {
        type: 'failed',
        failed: {
          property: 'skills',
          operation: 'remove',
          item: skillName,
          targetField: 'requiredSkills',
          reason: `Skill "${skillName}" not in requirements - cannot remove`,
        },
      };
    }
    newSkills = newSkills.filter((_, index) => index !== existingIndex);
  } else if (adjustment.operation === 'adjust') {
    // Adjust proficiency of specific skill (strengthen/weaken)
    const skillName = adjustment.item!;
    const existingIndex = currentSkills.findIndex(skill => skill.skill === skillName);
    if (existingIndex < 0) {
      warning = `Skill "${skillName}" not in requirements - adding it`;
      newSkills.push({ skill: skillName, minProficiency: adjustment.direction === 'more' ? 'proficient' : 'learning' });
    } else {
      const currentProficiency = currentSkills[existingIndex].minProficiency ?? 'learning';
      const currentProficiencyIndex = PROFICIENCY_LEVEL_ORDER.indexOf(currentProficiency);
      let newProficiencyIndex: number;
      if (adjustment.direction === 'more') {
        newProficiencyIndex = Math.min(currentProficiencyIndex + 1, PROFICIENCY_LEVEL_ORDER.length - 1);
        if (currentProficiencyIndex === PROFICIENCY_LEVEL_ORDER.length - 1) warning = `Skill "${skillName}" already at expert`;
      } else {
        newProficiencyIndex = Math.max(currentProficiencyIndex - 1, 0);
        if (currentProficiencyIndex === 0) warning = `Skill "${skillName}" already at learning`;
      }
      newSkills[existingIndex] = { ...newSkills[existingIndex], minProficiency: PROFICIENCY_LEVEL_ORDER[newProficiencyIndex] };
    }
  } else if (adjustment.operation === 'set') {
    // Replace entire skills array (rare but supported)
    const skillValue = adjustment.value as SkillValue;
    newSkills = [{ skill: skillValue.skill, minProficiency: skillValue.proficiency ?? 'learning' }];
  }

  return {
    type: 'applied',
    modifiedSearchFilterRequest: { ...searchCriteria, requiredSkills: newSkills.length > 0 ? newSkills : undefined },
    applied: {
      property: 'skills',
      operation: adjustment.operation,
      direction: adjustment.operation === 'adjust' ? adjustment.direction : undefined,
      value: adjustment.operation === 'add' || adjustment.operation === 'set' ? adjustment.value : undefined,
      item: adjustment.operation === 'remove' || adjustment.operation === 'adjust' ? adjustment.item : undefined,
      modifiedField: 'requiredSkills',
      previousValue: currentSkills.length > 0 ? currentSkills : null,
      newValue: newSkills.length > 0 ? newSkills : null,
      warning,
    },
  };
}

function applyDomainAdjustmentToSearchCriteria(
  searchCriteria: SearchFilterRequest,
  adjustment: CritiqueAdjustment,
  domainType: 'business' | 'technical'
): AdjustmentResult {
  const fieldName = domainType === 'business' ? 'requiredBusinessDomains' : 'requiredTechnicalDomains';
  const currentDomains = domainType === 'business'
    ? (searchCriteria.requiredBusinessDomains ?? [])
    : (searchCriteria.requiredTechnicalDomains ?? []);
  let newDomains = [...currentDomains];
  let warning: string | undefined;

  if (adjustment.operation === 'add') {
    const domainValue = adjustment.value as DomainValue;
    const existingIndex = currentDomains.findIndex(domain => domain.domain === domainValue.domain);
    if (existingIndex >= 0) {
      warning = `Domain "${domainValue.domain}" already required - updating minYears`;
      newDomains[existingIndex] = { ...newDomains[existingIndex], minYears: domainValue.minYears };
    } else {
      newDomains.push({ domain: domainValue.domain, minYears: domainValue.minYears });
    }
  } else if (adjustment.operation === 'remove') {
    const domainName = adjustment.item!;
    const existingIndex = currentDomains.findIndex(domain => domain.domain === domainName);
    if (existingIndex < 0) {
      // Cannot remove a domain that isn't in requirements
      return {
        type: 'failed',
        failed: {
          property: adjustment.property,
          operation: 'remove',
          item: domainName,
          targetField: fieldName,
          reason: `Domain "${domainName}" not in requirements - cannot remove`,
        },
      };
    }
    newDomains = newDomains.filter((_, index) => index !== existingIndex);
  } else {
    throw new Error(`Invalid operation '${adjustment.operation}' for ${domainType}Domains`);
  }

  const updatedCriteria = domainType === 'business'
    ? { ...searchCriteria, requiredBusinessDomains: newDomains.length > 0 ? newDomains : undefined }
    : { ...searchCriteria, requiredTechnicalDomains: newDomains.length > 0 ? newDomains : undefined };

  return {
    type: 'applied',
    modifiedSearchFilterRequest: updatedCriteria,
    applied: {
      property: adjustment.property,
      operation: adjustment.operation,
      value: adjustment.operation === 'add' ? adjustment.value : undefined,
      item: adjustment.operation === 'remove' ? adjustment.item : undefined,
      modifiedField: fieldName,
      previousValue: currentDomains.length > 0 ? currentDomains : null,
      newValue: newDomains.length > 0 ? newDomains : null,
      warning,
    },
  };
}
