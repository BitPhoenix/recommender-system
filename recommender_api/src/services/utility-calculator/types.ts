/**
 * Utility Calculator Types
 * Type definitions for utility scoring calculations.
 */

import type {
  MatchedSkill,
  UnmatchedRelatedSkill,
  ScoreBreakdown,
  SeniorityLevel,
  ProficiencyLevel,
  StartTimeline,
  BusinessDomainMatch,
  TechnicalDomainMatch,
} from '../../types/search.types.js';
import type {
  ResolvedBusinessDomain,
  ResolvedTechnicalDomain,
} from '../cypher-query-builder/query-types.js';

// ============================================
// PUBLIC API TYPES (exported from index.ts)
// ============================================

export interface EngineerData {
  id: string;
  name: string;
  headline: string;
  salary: number;
  yearsExperience: number;
  startTimeline: string;
  timezone: string;
  matchedSkills: MatchedSkill[];
  unmatchedRelatedSkills: UnmatchedRelatedSkill[];
  avgConfidence: number;
  matchedBusinessDomains: BusinessDomainMatch[];
  matchedTechnicalDomains: TechnicalDomainMatch[];
}

export interface UtilityContext {
  requiredSkillIds: string[];
  preferredSkillIds: string[];
  preferredBusinessDomains: ResolvedBusinessDomain[];
  preferredTechnicalDomains: ResolvedTechnicalDomain[];
  alignedSkillIds: string[];
  /*
   * Budget parameters for scoring (job-centric, not engineer-centric).
   * - maxBudget: Job's budget ceiling
   * - stretchBudget: Optional stretch ceiling for exceptional candidates
   */
  maxBudget: number | null;
  stretchBudget: number | null;
  /*
   * Preferred values for match calculation.
   *
   * Timeline scoring thresholds:
   * - preferredMaxStartTime: Engineers at or faster get full startTimelineMatch score
   * - requiredMaxStartTime: Hard filter cutoff; also defines the zero-score boundary
   * Between preferred and required, score degrades linearly.
   */
  preferredSeniorityLevel: SeniorityLevel | null;
  preferredMaxStartTime: StartTimeline | null;
  requiredMaxStartTime: StartTimeline | null;
  preferredTimezone: string[];
  // Per-skill preferred proficiency requirements (skillId -> preferredMinProficiency)
  skillIdToPreferredProficiency: Map<string, ProficiencyLevel>;
}

export interface ScoredEngineer extends EngineerData {
  utilityScore: number;
  scoreBreakdown: ScoreBreakdown;
}

export interface UtilityCalculationResult {
  utilityScore: number;
  scoreBreakdown: ScoreBreakdown;
}

// ============================================
// INTERNAL RESULT TYPES (used by scoring modules)
// ============================================

export interface RequiredSkillsProficiencyResult {
  /** Normalized score 0-1 representing how well engineer proficiency matches preferred levels */
  score: number;
  /** Skills that meet or exceed preferred proficiency (for display) */
  skillsExceedingPreferred: string[];
}

export interface PreferredSkillsMatchResult {
  raw: number;
  matchedSkillNames: string[];
}

export interface TeamFocusMatchResult {
  raw: number;
  matchedSkillNames: string[];
}

export interface RelatedSkillsMatchResult {
  raw: number;
  count: number;
}

export interface PreferredBusinessDomainMatchResult {
  raw: number;
  matchedDomainNames: string[];
}

export interface PreferredTechnicalDomainMatchResult {
  raw: number;
  matchedDomainNames: string[];
}

export interface StartTimelineMatchResult {
  raw: number;
  matchedStartTimeline: string | null;
  withinPreferred: boolean;
}

export interface PreferredTimezoneMatchResult {
  raw: number;
  matchedTimezone: string | null;
  rank: number;
}

export interface PreferredSeniorityMatchResult {
  raw: number;
  matchedLevel: boolean;
}

export interface BudgetMatchResult {
  raw: number;
  inBudget: boolean;
  inStretchZone: boolean;
}
