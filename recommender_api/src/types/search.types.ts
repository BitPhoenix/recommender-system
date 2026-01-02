/**
 * Search API Types
 * Implements Chapter 5.2.1-5.2.3 (Constraint-Based Recommender Systems)
 * from "Recommender Systems: The Textbook" by Charu Aggarwal.
 *
 * Types are now inferred from Zod schemas (single source of truth).
 */

// Re-export types from schemas
export type {
  SeniorityLevel,
  StartTimeline,
  ProficiencyLevel,
  TeamFocus,
  PreferredSalaryRange,
  SkillRequirement,
  BusinessDomainRequirement,
  TechnicalDomainRequirement,
  SearchFilterRequest,
} from '../schemas/search.schema.js';

// Re-export constants from schemas
export { START_TIMELINE_ORDER } from '../schemas/search.schema.js';

// ============================================
// RESPONSE TYPES
// ============================================

export type MatchType = 'direct' | 'descendant' | 'correlated' | 'none';
export type ConstraintSource = 'user' | 'knowledge_base';
export type ConstraintViolation = 'proficiency_below_minimum';

export interface MatchedSkill {
  skillId: string;
  skillName: string;
  proficiencyLevel: string;
  confidenceScore: number;
  yearsUsed: number;
  matchType: MatchType;
}

export interface UnmatchedRelatedSkill extends MatchedSkill {
  constraintViolations: ConstraintViolation[];
}

// Domain match types (used in response)
export type TechnicalDomainMatchType = 'direct' | 'child_implies_parent' | 'encompasses' | 'skill_inferred';

export interface BusinessDomainMatch {
  domainId: string;
  domainName: string;
  engineerYears: number;
  meetsRequired: boolean;
  meetsPreferred: boolean;
}

export interface TechnicalDomainMatch {
  domainId: string;
  domainName: string;
  engineerYears: number;
  matchType: TechnicalDomainMatchType;
  meetsRequired: boolean;
  meetsPreferred: boolean;
}

// Core scores (always present if > 0)
export interface CoreScores {
  skillMatch: number;
  confidence: number;
  experience: number;
  salary: number;
}

// Individual match types with score + match data
export interface PreferredSkillsMatch {
  score: number;
  matchedSkills: string[];
}

export interface TeamFocusMatch {
  score: number;
  matchedSkills: string[];
}

export interface RelatedSkillsMatch {
  score: number;
  count: number;
}

export interface PreferredBusinessDomainMatch {
  score: number;
  matchedDomains: string[];
}

export interface PreferredTechnicalDomainMatch {
  score: number;
  matchedDomains: string[];
}

export interface StartTimelineMatch {
  score: number;
  matchedStartTimeline: string;
  withinPreferred: boolean;
}

export interface PreferredTimezoneMatch {
  score: number;
  matchedTimezone: string;
  rank: number;
}

export interface PreferredSeniorityMatch {
  score: number;
}

export interface PreferredSalaryRangeMatch {
  score: number;
}

export interface PreferredSkillProficiencyMatch {
  score: number;
  skillsExceedingPreferred: string[];
}

export interface PreferenceMatches {
  preferredSkillsMatch?: PreferredSkillsMatch;
  teamFocusMatch?: TeamFocusMatch;
  relatedSkillsMatch?: RelatedSkillsMatch;
  preferredBusinessDomainMatch?: PreferredBusinessDomainMatch;
  preferredTechnicalDomainMatch?: PreferredTechnicalDomainMatch;
  startTimelineMatch?: StartTimelineMatch;
  preferredTimezoneMatch?: PreferredTimezoneMatch;
  preferredSeniorityMatch?: PreferredSeniorityMatch;
  preferredSalaryRangeMatch?: PreferredSalaryRangeMatch;
  preferredSkillProficiencyMatch?: PreferredSkillProficiencyMatch;
}

export interface ScoreBreakdown {
  scores: Partial<CoreScores>;
  preferenceMatches: PreferenceMatches;
  total: number;  // Sum of all weighted scores (equals utilityScore)
}

export interface EngineerMatch {
  id: string;
  name: string;
  headline: string;
  salary: number;
  yearsExperience: number;
  startTimeline: string;
  timezone: string;
  matchedSkills: MatchedSkill[];
  unmatchedRelatedSkills: UnmatchedRelatedSkill[];  // Skills in hierarchy but failing constraints
  matchedBusinessDomains: BusinessDomainMatch[];    // Business domain matches with years
  matchedTechnicalDomains: TechnicalDomainMatch[];  // Technical domain matches with years and match type
  utilityScore: number;          // Computed ranking score per 5.2.3
  scoreBreakdown: ScoreBreakdown;
}

/**
 * AppliedFilter - hard constraints that filter candidates (WHERE clauses).
 * These exclude candidates that don't meet the criteria.
 */
export interface AppliedFilter {
  field: string;
  operator: string;  // 'BETWEEN', 'IN', '>=', '<=', 'STARTS WITH', etc.
  value: string;
  source: ConstraintSource;
}

/**
 * AppliedPreference - soft boosts for ranking (utility scoring).
 * These don't filter candidates, they influence ranking.
 */
export interface AppliedPreference {
  field: string;
  value: string;
  source: ConstraintSource;
}

export interface QueryMetadata {
  executionTimeMs: number;
  skillsExpanded: string[];    // Skills found via hierarchy traversal
  defaultsApplied: string[];   // Which defaults were used
  unresolvedSkills: string[];  // Skills requested but not found in database
}

export interface SearchFilterResponse {
  matches: EngineerMatch[];
  totalCount: number;
  appliedFilters: AppliedFilter[];
  appliedPreferences: AppliedPreference[];
  queryMetadata: QueryMetadata;
}

// ============================================
// ERROR TYPES
// ============================================

export interface ValidationErrorDetail {
  field: string;
  message: string;
}

export interface SearchError {
  code: string;
  message: string;
  details?: ValidationErrorDetail[];
}

export interface SearchErrorResponse {
  error: SearchError;
}
