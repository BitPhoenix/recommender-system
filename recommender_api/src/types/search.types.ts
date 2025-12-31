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
  AvailabilityOption,
  RiskTolerance,
  ProficiencyLevel,
  TeamFocus,
  PreferredSalaryRange,
  SearchFilterRequest,
} from '../schemas/search.schema.js';

// ============================================
// RESPONSE TYPES
// ============================================

export type MatchType = 'direct' | 'descendant' | 'correlated' | 'none';
export type ConstraintSource = 'user' | 'knowledge_base';
export type ConstraintViolation = 'confidence_below_threshold' | 'proficiency_below_minimum';

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

// Core scores (always present if > 0)
export interface CoreScores {
  skillMatch: number;
  confidence: number;
  experience: number;
  availability: number;
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

export interface PreferredDomainMatch {
  score: number;
  matchedDomains: string[];
}

export interface PreferredAvailabilityMatch {
  score: number;
  matchedAvailability: string;
  rank: number;
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

export interface PreferredConfidenceMatch {
  score: number;
}

export interface PreferredProficiencyMatch {
  score: number;
}

export interface PreferenceMatches {
  preferredSkillsMatch?: PreferredSkillsMatch;
  teamFocusMatch?: TeamFocusMatch;
  relatedSkillsMatch?: RelatedSkillsMatch;
  preferredDomainMatch?: PreferredDomainMatch;
  preferredAvailabilityMatch?: PreferredAvailabilityMatch;
  preferredTimezoneMatch?: PreferredTimezoneMatch;
  preferredSeniorityMatch?: PreferredSeniorityMatch;
  preferredSalaryRangeMatch?: PreferredSalaryRangeMatch;
  preferredConfidenceMatch?: PreferredConfidenceMatch;
  preferredProficiencyMatch?: PreferredProficiencyMatch;
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
  availability: string;
  timezone: string;
  matchedSkills: MatchedSkill[];
  unmatchedRelatedSkills: UnmatchedRelatedSkill[];  // Skills in hierarchy but failing constraints
  matchedDomains: string[];      // Domain names matched from preferredDomains
  utilityScore: number;          // Computed ranking score per 5.2.3
  scoreBreakdown: ScoreBreakdown;
}

export interface AppliedConstraint {
  field: string;
  operator: string;
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
  appliedConstraints: AppliedConstraint[];
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
