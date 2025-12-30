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

export interface ScoreComponent {
  raw: number;      // Raw utility value (0-1)
  weight: number;   // Weight applied (from config)
  weighted: number; // raw * weight contribution to total
}

export interface TeamFocusBonusComponent extends ScoreComponent {
  matchedSkills: string[];  // Names of bonus skills the engineer has
}

export interface PreferredSkillsBonusComponent extends ScoreComponent {
  matchedSkills: string[];  // Names of preferred skills the engineer has
}

export interface RelatedSkillsBonusComponent extends ScoreComponent {
  count: number;  // Number of unmatched related skills
}

export interface DomainBonusComponent extends ScoreComponent {
  matchedDomains: string[];  // Names of matched preferred domains
}

export interface AvailabilityBonusComponent extends ScoreComponent {
  matchedAvailability: string | null;  // Which preferred availability matched
  rank: number;                        // Position in preference list (0 = best)
}

export interface TimezoneBonusComponent extends ScoreComponent {
  matchedTimezone: string | null;
  rank: number;
}

export interface SeniorityBonusComponent extends ScoreComponent {
  matchedLevel: boolean;  // Whether engineer meets/exceeds preferred level
}

export interface SalaryRangeBonusComponent extends ScoreComponent {
  inPreferredRange: boolean;
}

export interface ConfidenceBonusComponent extends ScoreComponent {
  meetsPreferred: boolean;
}

export interface ProficiencyBonusComponent extends ScoreComponent {
  matchedLevel: boolean;
}

export interface ScoreBreakdown {
  components: {
    skillMatch: ScoreComponent;
    confidence: ScoreComponent;
    experience: ScoreComponent;
    availability: ScoreComponent;
    salary: ScoreComponent;
    preferredSkillsBonus: PreferredSkillsBonusComponent;
    teamFocusBonus: TeamFocusBonusComponent;
    relatedSkillsBonus: RelatedSkillsBonusComponent;
    domainBonus: DomainBonusComponent;
    // NEW components for preferred properties
    preferredAvailabilityBonus: AvailabilityBonusComponent;
    preferredTimezoneBonus: TimezoneBonusComponent;
    preferredSeniorityBonus: SeniorityBonusComponent;
    preferredSalaryRangeBonus: SalaryRangeBonusComponent;
    preferredConfidenceBonus: ConfidenceBonusComponent;
    preferredProficiencyBonus: ProficiencyBonusComponent;
  };
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
