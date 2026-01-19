/**
 * Search API Types
 * Implements Chapter 5.2.1-5.2.3 (Constraint-Based Recommender Systems)
 * from "Recommender Systems: The Textbook" by Charu Aggarwal.
 *
 * Types are now inferred from Zod schemas (single source of truth).
 */

// Import for local use (needed before re-export for interface definitions)
import type { ProficiencyLevel as ProficiencyLevelType } from '../schemas/search.schema.js';
import type { ExpandedSearchCriteria } from '../services/constraint-expander.service.js';

// Re-export types from schemas
export type {
  SeniorityLevel,
  StartTimeline,
  ProficiencyLevel,
  TeamFocus,
  SkillRequirement,
  BusinessDomainRequirement,
  TechnicalDomainRequirement,
  SearchFilterRequest,
} from '../schemas/search.schema.js';

// Re-export constants from schemas
export { START_TIMELINE_ORDER, PROFICIENCY_LEVEL_ORDER, SENIORITY_LEVEL_ORDER } from '../schemas/search.schema.js';

// ============================================
// APPLIED FILTER/PREFERENCE DISCRIMINATED UNIONS
// ============================================

/**
 * Kind discriminator for applied filter types.
 */
export enum AppliedFilterKind {
  /** Standard property constraint (salary, timezone, etc.) */
  Property = 'property',
  /** Skill constraint with resolved skill data */
  Skill = 'skill',
}

/**
 * Kind discriminator for applied preference types.
 */
export enum AppliedPreferenceKind {
  /** Standard property preference (preferredTimezone, etc.) */
  Property = 'property',
  /** Skill preference with resolved skill data */
  Skill = 'skill',
}

/**
 * Resolved skill constraint with full structured data.
 * Contains both ID (for queries) and name (for display).
 */
export interface ResolvedSkillConstraint {
  skillId: string;
  skillName: string;
  minProficiency?: ProficiencyLevelType;
  preferredMinProficiency?: ProficiencyLevelType;
}

// ============================================
// RESPONSE TYPES
// ============================================

export type MatchType = 'direct' | 'descendant' | 'correlated' | 'none';
export type ConstraintSource = 'user' | 'knowledge_base' | 'inference';
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
// Note: salary removed - was unfair to higher-earning engineers, now handled by budget filter only
export interface CoreScores {
  skillMatch: number;
  confidence: number;
  experience: number;
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

export interface BudgetMatch {
  score: number;
  inStretchZone: boolean;
}

// Note: PreferredSkillProficiencyMatch removed - now absorbed into CoreScores.skillMatch
// The unified skill match score handles both coverage and proficiency matching.

export interface PreferenceMatches {
  preferredSkillsMatch?: PreferredSkillsMatch;
  teamFocusMatch?: TeamFocusMatch;
  relatedSkillsMatch?: RelatedSkillsMatch;
  preferredBusinessDomainMatch?: PreferredBusinessDomainMatch;
  preferredTechnicalDomainMatch?: PreferredTechnicalDomainMatch;
  startTimelineMatch?: StartTimelineMatch;
  preferredTimezoneMatch?: PreferredTimezoneMatch;
  preferredSeniorityMatch?: PreferredSeniorityMatch;
  budgetMatch?: BudgetMatch;
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
 * Discriminated union: use `filter.kind` to narrow the type.
 */
export interface AppliedPropertyFilter {
  kind: AppliedFilterKind.Property;
  field: string;
  operator: string;
  value: string;
  source: ConstraintSource;
}

/**
 * AppliedSkillFilter - discriminated union for skill-based filters.
 * Use `filter.field` to narrow: 'requiredSkills' = user, 'derivedSkills' = derived.
 */
export interface AppliedUserSkillFilter {
  kind: AppliedFilterKind.Skill;
  field: 'requiredSkills';
  operator: 'HAS_ALL';
  skills: ResolvedSkillConstraint[];
  displayValue: string;
  source: ConstraintSource;
}

export interface AppliedDerivedSkillFilter {
  kind: AppliedFilterKind.Skill;
  field: 'derivedSkills';
  operator: 'HAS_ALL';
  skills: ResolvedSkillConstraint[];
  displayValue: string;
  source: ConstraintSource;
  /** Identifies the inference rule that added this constraint. */
  ruleId: string;
}

export type AppliedSkillFilter = AppliedUserSkillFilter | AppliedDerivedSkillFilter;

export type AppliedFilter = AppliedPropertyFilter | AppliedSkillFilter;

/**
 * AppliedPreference - soft boosts for ranking (utility scoring).
 * Discriminated union: use `preference.kind` to narrow the type.
 */
export interface AppliedPropertyPreference {
  kind: AppliedPreferenceKind.Property;
  field: string;
  value: string;
  source: ConstraintSource;
}

export interface AppliedSkillPreference {
  kind: AppliedPreferenceKind.Skill;
  field: 'preferredSkills';
  skills: ResolvedSkillConstraint[];
  displayValue: string;
  source: ConstraintSource;
}

export type AppliedPreference = AppliedPropertyPreference | AppliedSkillPreference;

export interface QueryMetadata {
  executionTimeMs: number;
  skillsExpanded: string[];    // Skills found via hierarchy traversal
  defaultsApplied: string[];   // Which defaults were used
  unresolvedSkills: string[];  // Skills requested but not found in database
}

/**
 * Information about a derived constraint from inference rules.
 * Used in SearchFilterResponse, FilterSimilarityResponse, and CritiqueResponse.
 */
export interface DerivedConstraintInfo {
  rule: {
    id: string;
    name: string;
  };
  action: {
    effect: 'filter' | 'boost';
    targetField: string;
    targetValue: unknown;
    boostStrength?: number;
  };
  provenance: {
    /** All causal paths (2D: array of chains) */
    derivationChains: string[][];
    explanation: string;
  };
  /**
   * Override information - only present when user overrode this constraint.
   * - FULL: Entire constraint overridden (explicit, implicit boost, or all skills user-handled)
   * - PARTIAL: Some target skills user-handled, rule still applies for remaining skills
   */
  override?: {
    overrideScope: 'FULL' | 'PARTIAL';
    overriddenSkills: string[];
  };
}

export interface SearchFilterResponse {
  matches: EngineerMatch[];
  totalCount: number;
  appliedFilters: AppliedFilter[];
  appliedPreferences: AppliedPreference[];
  overriddenRuleIds: string[]; // Echo back the overridden rules from request
  derivedConstraints: DerivedConstraintInfo[];
  queryMetadata: QueryMetadata;

  // Constraint Advice (Project 2: Section 5.2.4-5.2.5)
  /** Relaxation advice for sparse results (< 3 matches) */
  relaxation?: RelaxationResult;
  /** Tightening advice for many results (>= 25 matches) */
  tightening?: TighteningResult;

  /** Internal: expanded criteria for downstream processing (critique generation) */
  expandedCriteria?: ExpandedSearchCriteria;
}

// ============================================
// CONSTRAINT ADVICE TYPES (Project 2)
// ============================================

/**
 * A minimal set of constraints that together cause insufficient results.
 * Removing any single constraint from this set would yield more results.
 */
export interface ConflictSet {
  /** Structured constraints that form the conflict set */
  constraints: AppliedFilter[];
  /** Data-aware template explanation using actual DB statistics (always present) */
  dataAwareExplanation: string;
  /** RAG-enhanced LLM explanation with reasoning (null if LLM unavailable) */
  llmExplanation: string | null;
  /** Per-constraint statistics from the database */
  stats: import("../services/constraint-advisor/conflict-stats.types.js").ConflictStats;
  /** Evidence: result counts when each constraint is removed */
  evidence?: {
    /** Field name referencing AppliedFilter.field in constraints array */
    constraintField: string;
    resultingCountIfRelaxed: number;
  }[];
}

// ============================================
// RELAXATION SUGGESTION TYPES (Discriminated Union)
// ============================================

/**
 * Type discriminator for relaxation suggestions.
 */
export enum RelaxationSuggestionType {
  /** Suggests modifying a user-provided constraint value */
  UserConstraint = 'user-constraint',
  /** Suggests bypassing an inference rule via overriddenRuleIds */
  DerivedOverride = 'derived-override',
}

/**
 * Action types for skill relaxation suggestions.
 * Used to discriminate between different skill modification strategies.
 */
export enum SkillRelaxationAction {
  /** Lower the required proficiency level (e.g., expert -> proficient) */
  LowerProficiency = 'lowerProficiency',
  /** Move skill from required to preferred (soft constraint) */
  MoveToPreferred = 'moveToPreferred',
  /** Remove the skill requirement entirely */
  Remove = 'remove',
}

/**
 * Skill relaxation value - discriminated by action.
 */
export type SkillRelaxationValue =
  | { action: SkillRelaxationAction.LowerProficiency; skill: string; minProficiency: string }
  | { action: SkillRelaxationAction.MoveToPreferred; skill: string }
  | { action: SkillRelaxationAction.Remove; skill: string };

/**
 * Skill requirement value for tightening suggestions (add a skill).
 */
export interface SkillRequirementValue {
  skill: string;
  minProficiency: string;
}

/**
 * Base fields shared by all relaxation suggestions.
 */
interface BaseRelaxationSuggestion {
  /** Why this relaxation helps */
  rationale: string;
  /** How many results this would yield */
  resultingMatches: number;
}

/**
 * Base fields shared by all user constraint relaxations.
 */
interface BaseUserConstraintRelaxation extends BaseRelaxationSuggestion {
  type: RelaxationSuggestionType.UserConstraint;
}

/**
 * Relaxation for maxBudget field.
 * API: maxBudget: number
 */
export interface BudgetRelaxation extends BaseUserConstraintRelaxation {
  field: 'maxBudget';
  currentValue: number;
  suggestedValue: number;
}

/**
 * Relaxation for requiredMaxStartTime field.
 * API: requiredMaxStartTime: string (single enum value)
 *
 * Note: The EnumExpand strategy suggests individual expanded values,
 * not arrays. Each expansion step becomes a separate suggestion.
 */
export interface StartTimeRelaxation extends BaseUserConstraintRelaxation {
  field: 'requiredMaxStartTime';
  currentValue: string;
  suggestedValue: string;
}

/**
 * Relaxation for requiredTimezone field (Remove strategy only).
 * API: requiredTimezone: string[]
 * suggestedValue is null since this uses Remove strategy.
 */
export interface TimezoneRelaxation extends BaseUserConstraintRelaxation {
  field: 'requiredTimezone';
  currentValue: string[];
  suggestedValue: null;
}

/**
 * Relaxation for skill requirements.
 * API: requiredSkills: SkillRequirement[]
 */
export interface SkillRelaxation extends BaseUserConstraintRelaxation {
  field: 'requiredSkills';
  currentValue: { skill: string; minProficiency?: string };
  suggestedValue: SkillRelaxationValue;
}

/**
 * Discriminated union of all user constraint relaxation types.
 * Discriminated by `field`.
 *
 * Note: yearsExperience was removed - there's no corresponding API field.
 * The salary constraint maps to maxBudget via suggestedField config.
 */
export type UserConstraintRelaxation =
  | BudgetRelaxation
  | StartTimeRelaxation
  | TimezoneRelaxation
  | SkillRelaxation;

/**
 * Derived constraint override - suggests bypassing an inference rule.
 * Action: Client adds ruleId to overriddenRuleIds array and re-submits.
 */
export interface DerivedConstraintOverride extends BaseRelaxationSuggestion {
  type: RelaxationSuggestionType.DerivedOverride;
  /** The inference rule ID to add to overriddenRuleIds */
  ruleId: string;
  /** Human-readable rule name for UI display */
  ruleName: string;
  /** What constraints this rule added (for transparency) */
  affectedConstraints: Array<{
    field: string;
    value: unknown;
  }>;
}

/**
 * Discriminated union of all relaxation suggestion types.
 * Use `suggestion.type` to determine how to handle each suggestion.
 */
export type RelaxationSuggestion = UserConstraintRelaxation | DerivedConstraintOverride;

/**
 * Relaxation payload returned when results < threshold.
 */
export interface RelaxationResult {
  /** Analysis of which constraints conflict */
  conflictAnalysis: {
    /** Minimal sets of conflicting constraints (max 3) */
    conflictSets: ConflictSet[];
  };
  /** Suggested constraint relaxations sorted by impact */
  suggestions: RelaxationSuggestion[];
}

/**
 * Base fields shared by all tightening suggestions.
 */
interface BaseTighteningSuggestion {
  rationale: string;
  resultingMatches: number;
  distributionInfo: string;
}

/**
 * Tightening for requiredTimezone field.
 */
export interface TimezoneTightening extends BaseTighteningSuggestion {
  field: 'requiredTimezone';
  suggestedValue: string[];
}

/**
 * Tightening for requiredSeniorityLevel field.
 */
export interface SeniorityTightening extends BaseTighteningSuggestion {
  field: 'requiredSeniorityLevel';
  suggestedValue: string;
}

/**
 * Tightening for maxBudget field.
 */
export interface BudgetTightening extends BaseTighteningSuggestion {
  field: 'maxBudget';
  suggestedValue: number;
}

/**
 * Tightening for requiredMaxStartTime field.
 * Note: single string (e.g., "immediate"), unlike relaxation which also uses single string.
 */
export interface StartTimeTightening extends BaseTighteningSuggestion {
  field: 'requiredMaxStartTime';
  suggestedValue: string;
}

/**
 * Tightening for requiredSkills field.
 */
export interface SkillTightening extends BaseTighteningSuggestion {
  field: 'requiredSkills';
  suggestedValue: SkillRequirementValue;
}

/**
 * Discriminated union of all tightening suggestion types.
 * Discriminated by `field`.
 */
export type TighteningSuggestion =
  | TimezoneTightening
  | SeniorityTightening
  | BudgetTightening
  | StartTimeTightening
  | SkillTightening;

/**
 * Tightening payload returned when results >= threshold.
 */
export interface TighteningResult {
  /** Suggested constraints to add, sorted by effectiveness */
  suggestions: TighteningSuggestion[];
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

// ============================================
// TYPE GUARDS
// ============================================

export function isSkillFilter(filter: AppliedFilter): filter is AppliedSkillFilter {
  return filter.kind === AppliedFilterKind.Skill;
}

export function isPropertyFilter(filter: AppliedFilter): filter is AppliedPropertyFilter {
  return filter.kind === AppliedFilterKind.Property;
}

export function isUserSkillFilter(filter: AppliedSkillFilter): filter is AppliedUserSkillFilter {
  return filter.field === 'requiredSkills';
}

export function isDerivedSkillFilter(filter: AppliedSkillFilter): filter is AppliedDerivedSkillFilter {
  return filter.field === 'derivedSkills';
}

export function isSkillPreference(pref: AppliedPreference): pref is AppliedSkillPreference {
  return pref.kind === AppliedPreferenceKind.Skill;
}

export function isPropertyPreference(pref: AppliedPreference): pref is AppliedPropertyPreference {
  return pref.kind === AppliedPreferenceKind.Property;
}
