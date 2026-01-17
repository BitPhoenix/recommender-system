/**
 * Similarity Calculator Types
 * Type definitions for engineer-to-engineer similarity scoring.
 */

// ============================================
// PUBLIC API TYPES
// ============================================

export interface EngineerForSimilarity {
  id: string;
  name: string;
  headline: string;
  yearsExperience: number;
  timezone: string;
  skills: EngineerSkill[];
  businessDomains: DomainExperience[];
  technicalDomains: DomainExperience[];
}

export interface EngineerSkill {
  skillId: string;
  skillName: string;
  proficiencyLevel: string;
  confidenceScore: number;
}

export interface DomainExperience {
  domainId: string;
  domainName: string;
  years: number;
}

export interface SimilarityBreakdown {
  skills: number;
  yearsExperience: number;
  domain: number;
  timezone: number;
}

export interface CorrelatedSkillPair {
  targetSkill: string;
  candidateSkill: string;
  strength: number;
}

export interface SimilarityResult {
  engineer: EngineerForSimilarity;
  similarityScore: number;
  breakdown: SimilarityBreakdown;
  sharedSkills: string[];
  correlatedSkills: CorrelatedSkillPair[];
}

export interface SimilarEngineersResponse {
  target: EngineerForSimilarity;
  similar: SimilarityResult[];
}

// ============================================
// INTERNAL TYPES (used by scoring modules)
// ============================================

export interface SkillSimilarityResult {
  score: number;
  sharedSkillIds: string[];
  correlatedPairs: CorrelatedSkillPair[];
}

export interface DomainSimilarityResult {
  score: number;
}

export interface ExperienceSimilarityResult {
  score: number;
}

export interface TimezoneSimilarityResult {
  score: number;
}

// Graph data structures for in-memory traversal
export interface SkillCorrelation {
  toSkillId: string;
  strength: number;
  correlationType: string;
}

export interface SkillGraphNode {
  skillId: string;
  categoryId: string | null;
  parentId: string | null;
  correlations: SkillCorrelation[];
}

export interface SkillGraph {
  nodes: Map<string, SkillGraphNode>;
}

export interface DomainGraphNode {
  domainId: string;
  parentId: string | null;
  encompassedBy: string[];  // For technical domains (Full Stack encompasses Backend)
}

export interface DomainGraph {
  businessDomains: Map<string, DomainGraphNode>;
  technicalDomains: Map<string, DomainGraphNode>;
}
