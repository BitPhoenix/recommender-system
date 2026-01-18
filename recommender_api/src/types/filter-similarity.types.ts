/**
 * Filter-Similarity API Types
 * Response types for the hybrid filter + similarity endpoint.
 */

import type {
  AppliedFilter,
  RelaxationResult,
  TighteningResult,
} from './search.types.js';
import type {
  SimilarityBreakdown,
  CorrelatedSkillPair,
} from '../services/similarity-calculator/types.js';

export interface FilterSimilarityResponse {
  referenceEngineer: {
    id: string;
    name: string;
    headline: string;
  };
  matches: FilterSimilarityMatch[];
  totalCount: number;
  appliedFilters: AppliedFilter[];
  overriddenRuleIds: string[];
  derivedConstraints: DerivedConstraintInfo[];
  relaxation?: RelaxationResult;
  tightening?: TighteningResult;
  queryMetadata: {
    executionTimeMs: number;
    candidatesBeforeDiversity: number;
  };
}

export interface FilterSimilarityMatch {
  id: string;
  name: string;
  headline: string;
  salary: number;
  yearsExperience: number;
  startTimeline: string;
  timezone: string;
  similarityScore: number;
  scoreBreakdown: SimilarityBreakdown;
  sharedSkills: string[];
  correlatedSkills: CorrelatedSkillPair[];
}

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
    derivationChains: string[][];
    explanation: string;
  };
  override?: {
    overrideScope: 'FULL' | 'PARTIAL';
    overriddenSkills: string[];
  };
}