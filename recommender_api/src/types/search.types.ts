/**
 * Search API Types
 * Implements Chapter 5.2.1-5.2.3 (Constraint-Based Recommender Systems)
 * from "Recommender Systems: The Textbook" by Charu Aggarwal.
 */

// ============================================
// REQUEST TYPES
// ============================================

export type SeniorityLevel = 'junior' | 'mid' | 'senior' | 'staff' | 'principal';
export type AvailabilityOption = 'immediate' | 'two_weeks' | 'one_month' | 'not_available';
export type RiskTolerance = 'low' | 'medium' | 'high';
export type ProficiencyLevel = 'learning' | 'proficient' | 'expert';
export type TeamFocus = 'greenfield' | 'migration' | 'maintenance' | 'scaling';

export interface PreferredSalaryRange {
  min: number;
  max: number;
}

export interface SearchFilterRequest {
  // Core constraints - RENAMED to use required prefix
  requiredSeniorityLevel?: SeniorityLevel;      // was: seniorityLevel
  requiredSkills?: string[];                     // unchanged
  preferredSkills?: string[];                    // unchanged
  requiredAvailability?: AvailabilityOption[];   // was: availability
  requiredTimezone?: string;                     // was: timezone

  // Budget constraints - RENAMED
  requiredMaxSalary?: number;   // was: maxSalary
  requiredMinSalary?: number;   // was: minSalary

  // Quality constraints - RENAMED
  requiredRiskTolerance?: RiskTolerance;         // was: riskTolerance
  requiredMinProficiency?: ProficiencyLevel;     // was: minProficiency

  // Context constraints (for ranking bonuses) - unchanged
  teamFocus?: TeamFocus;

  // Domain filtering - unchanged
  requiredDomains?: string[];    // Hard filter - must match at least one domain
  preferredDomains?: string[];   // Ranking boost - optional, increases score

  // NEW: Preferred properties for ranking boosts
  preferredSeniorityLevel?: SeniorityLevel;
  preferredAvailability?: AvailabilityOption[];  // ordered preference list
  preferredTimezone?: string[];                  // ordered preference list
  preferredSalaryRange?: PreferredSalaryRange;   // ideal salary range
  preferredConfidenceScore?: number;             // threshold for bonus (0-1)
  preferredProficiency?: ProficiencyLevel;

  // Pagination - unchanged
  limit?: number;   // Default: 20, max: 100
  offset?: number;  // Default: 0
}

// ============================================
// RESPONSE TYPES
// ============================================

export type MatchType = 'direct' | 'descendant' | 'correlated' | 'none';
export type MatchStrength = 'strong' | 'moderate' | 'weak';
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

// Individual bonus types with score + match data
export interface PreferredSkillsBonus {
  score: number;
  matchedSkills: string[];
}

export interface TeamFocusBonus {
  score: number;
  matchedSkills: string[];
}

export interface RelatedSkillsBonus {
  score: number;
  count: number;
}

export interface DomainBonus {
  score: number;
  matchedDomains: string[];
}

export interface PreferredAvailabilityBonus {
  score: number;
  matchedAvailability: string;
  rank: number;
}

export interface PreferredTimezoneBonus {
  score: number;
  matchedTimezone: string;
  rank: number;
}

export interface PreferredSeniorityBonus {
  score: number;
}

export interface PreferredSalaryRangeBonus {
  score: number;
}

export interface PreferredConfidenceBonus {
  score: number;
}

export interface PreferredProficiencyBonus {
  score: number;
}

export interface Bonuses {
  preferredSkillsBonus?: PreferredSkillsBonus;
  teamFocusBonus?: TeamFocusBonus;
  relatedSkillsBonus?: RelatedSkillsBonus;
  domainBonus?: DomainBonus;
  preferredAvailabilityBonus?: PreferredAvailabilityBonus;
  preferredTimezoneBonus?: PreferredTimezoneBonus;
  preferredSeniorityBonus?: PreferredSeniorityBonus;
  preferredSalaryRangeBonus?: PreferredSalaryRangeBonus;
  preferredConfidenceBonus?: PreferredConfidenceBonus;
  preferredProficiencyBonus?: PreferredProficiencyBonus;
}

export interface ScoreBreakdown {
  scores: Partial<CoreScores>;
  bonuses: Bonuses;
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
  matchStrength: MatchStrength;
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
