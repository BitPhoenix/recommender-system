import {
  AppliedFilter,
  AppliedFilterType,
  EngineerMatch,
  MatchedSkill,
  MatchType,
  isSkillFilter,
  isPropertyFilter,
  AppliedSkillFilter,
  AppliedPropertyFilter,
} from '../../types/search.types.js';
import { ConstraintExplanation } from '../../types/search-match-explanation.types.js';
import { formatStartTimeline } from '../../config/display.config.js';

export function generateConstraintExplanations(
  filters: AppliedFilter[],
  engineer: EngineerMatch
): ConstraintExplanation[] {
  return filters.map((filter) => generateSingleConstraintExplanation(filter, engineer));
}

function generateSingleConstraintExplanation(
  filter: AppliedFilter,
  engineer: EngineerMatch
): ConstraintExplanation {
  if (isSkillFilter(filter)) {
    return generateSkillConstraintExplanation(filter, engineer.matchedSkills);
  } else if (isPropertyFilter(filter)) {
    return generatePropertyConstraintExplanation(filter, engineer);
  }
  throw new Error(`Unknown filter type: ${(filter as AppliedFilter).type}`);
}

function generateSkillConstraintExplanation(
  filter: AppliedSkillFilter,
  matchedSkills: MatchedSkill[]
): ConstraintExplanation {
  const requiredSkillIds = new Set(filter.skills.map((s) => s.skillId));
  const matchedForFilter: MatchedSkill[] = [];
  const matchTypes: MatchType[] = [];

  for (const matched of matchedSkills) {
    if (requiredSkillIds.has(matched.skillId)) {
      matchedForFilter.push(matched);
      matchTypes.push(matched.matchType as MatchType);
    }
  }

  /*
   * HAS_ANY semantics: Engineer needs at least ONE skill from the expanded set.
   * After hierarchy expansion, a request for "API Design" becomes a filter containing
   * [api-design, rest-apis, graphql, grpc], and having any one satisfies the requirement.
   */
  const satisfied = matchedForFilter.length >= 1;
  const primaryMatchType = determinePrimaryMatchType(matchTypes);

  const matchedNames = matchedForFilter.map(
    (m) => `${m.skillName} (${m.proficiencyLevel}, ${Math.round(m.confidenceScore * 100)}% confidence)`
  );

  let explanation: string;
  if (satisfied) {
    if (primaryMatchType === 'direct') {
      explanation = `Has required skill${matchedForFilter.length > 1 ? 's' : ''}: ${matchedNames.join(', ')}`;
    } else if (primaryMatchType === 'descendant') {
      explanation = `Has descendant skill${matchedForFilter.length > 1 ? 's' : ''} of ${filter.displayValue}: ${matchedNames.join(', ')}`;
    } else {
      explanation = `Has correlated skill${matchedForFilter.length > 1 ? 's' : ''}: ${matchedNames.join(', ')}`;
    }
  } else {
    /*
     * For HAS_ANY constraints, engineer lacks ALL skills in the expanded set.
     * The message should reflect that none of the acceptable skills were found.
     */
    const skillNames = filter.skills.map((s) => s.skillName);
    explanation = `Lacks required skills in ${filter.displayValue} (needs at least one of: ${skillNames.join(', ')})`;
  }

  return {
    constraint: filter,
    satisfied,
    explanation,
    matchedValues: matchedNames,
    matchType: primaryMatchType,
  };
}

function determinePrimaryMatchType(matchTypes: MatchType[]): MatchType | undefined {
  if (matchTypes.length === 0) return undefined;
  if (matchTypes.includes('direct')) return 'direct';
  if (matchTypes.includes('descendant')) return 'descendant';
  return 'correlated';
}

function generatePropertyConstraintExplanation(
  filter: AppliedPropertyFilter,
  engineer: EngineerMatch
): ConstraintExplanation {
  const { field, operator, value } = filter;
  const engineerPropertyValue = getEngineerPropertyValue(engineer, field);
  const satisfied = evaluatePropertyConstraint(engineerPropertyValue, operator, value);

  const explanation = generatePropertyExplanationText(field, engineerPropertyValue, operator, value, satisfied);

  return {
    constraint: filter,
    satisfied,
    explanation,
    matchedValues: [String(engineerPropertyValue)],
  };
}

function getEngineerPropertyValue(engineer: EngineerMatch, field: string): unknown {
  switch (field) {
    case 'yearsExperience':
      return engineer.yearsExperience;
    case 'salary':
      return engineer.salary;
    case 'timezone':
      return engineer.timezone;
    case 'startTimeline':
      return engineer.startTimeline;
    default:
      return undefined;
  }
}

function evaluatePropertyConstraint(engineerValue: unknown, operator: string, constraintValue: string): boolean {
  switch (operator) {
    case '>=':
      return (engineerValue as number) >= parseFloat(constraintValue);
    case '<=':
      return (engineerValue as number) <= parseFloat(constraintValue);
    case 'IN': {
      const allowedValues = JSON.parse(constraintValue) as string[];
      return allowedValues.includes(engineerValue as string);
    }
    case 'BETWEEN': {
      const [min, max] = constraintValue.split('-').map(parseFloat);
      const numValue = engineerValue as number;
      return numValue >= min && (isNaN(max) || numValue < max);
    }
    default:
      return false;
  }
}

function generatePropertyExplanationText(
  field: string,
  engineerValue: unknown,
  operator: string,
  constraintValue: string,
  satisfied: boolean
): string {
  const fieldLabels: Record<string, string> = {
    yearsExperience: 'years of experience',
    salary: 'salary',
    timezone: 'timezone',
    startTimeline: 'start availability',
  };

  const fieldLabel = fieldLabels[field] ?? field;

  if (satisfied) {
    switch (field) {
      case 'yearsExperience':
        return `Has ${engineerValue} ${fieldLabel} (required: ${formatOperatorValue(operator, constraintValue)})`;
      case 'salary':
        return `Salary of $${(engineerValue as number).toLocaleString()} is within budget (max: $${parseFloat(constraintValue).toLocaleString()})`;
      case 'timezone':
        return `In ${engineerValue} timezone (allowed: ${formatTimezoneValue(constraintValue)})`;
      case 'startTimeline':
        return `Available ${formatStartTimeline(engineerValue as string, false)} (required: within ${formatStartTimeline(constraintValue, false)})`;
      default:
        return `${fieldLabel}: ${engineerValue} meets requirement`;
    }
  } else {
    switch (field) {
      case 'yearsExperience':
        return `Has ${engineerValue} ${fieldLabel} (required: ${formatOperatorValue(operator, constraintValue)})`;
      case 'salary':
        return `Salary of $${(engineerValue as number).toLocaleString()} exceeds budget (max: $${parseFloat(constraintValue).toLocaleString()})`;
      case 'timezone':
        return `In ${engineerValue} timezone (not in allowed: ${formatTimezoneValue(constraintValue)})`;
      case 'startTimeline':
        return `Available ${formatStartTimeline(engineerValue as string, false)} (required: within ${formatStartTimeline(constraintValue, false)})`;
      default:
        return `${fieldLabel}: ${engineerValue} does not meet requirement`;
    }
  }
}

function formatOperatorValue(operator: string, value: string): string {
  switch (operator) {
    case '>=':
      return `≥${value}`;
    case '<=':
      return `≤${value}`;
    case 'BETWEEN':
      return value.replace('-', '–');
    case 'IN':
      return JSON.parse(value).join(' or ');
    default:
      return value;
  }
}

function formatTimezoneValue(value: string): string {
  try {
    const timezones = JSON.parse(value) as string[];
    return timezones.join(' or ');
  } catch {
    return value;
  }
}

