/**
 * Similarity Calculator Module
 * Exports the public API for engineer-to-engineer similarity scoring.
 */

export type {
  EngineerForSimilarity,
  EngineerSkill,
  DomainExperience,
  SimilarityResult,
  SimilarityBreakdown,
  SimilarEngineersResponse,
  CorrelatedSkillPair,
  SkillGraph,
  DomainGraph,
} from './types.js';

export {
  calculateSimilarityWithBreakdown,
  scoreAndSortCandidates,
} from './similarity-calculator.js';

export { selectDiverseResults } from './diversity-selector.js';
export { loadSkillGraph, loadDomainGraph } from './graph-loader.js';
