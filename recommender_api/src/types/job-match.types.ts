/*
 * Scoring weights for job-engineer matching.
 * Weights should sum to 1.0 for normalized scoring.
 */
export interface JobMatchScoringWeights {
  semanticSimilarity: number;
  skillSimilarity: number;
  recentSkillSimilarity: number;
  requiredSkillCoverage: number;
  preferredSkillCoverage: number;
  seniorityMatch: number;
  timezoneMatch: number;
  budgetMatch: number;
}

/*
 * Individual similarity signals computed for a job-engineer pair.
 */
export interface JobEngineerMatchSignals {
  // Content similarity (embedding-based)
  semanticSimilarity: number;
  skillSimilarity: number;
  recentSkillSimilarity: number;

  // Structured matching
  requiredSkillCoverage: number;
  preferredSkillCoverage: number;
  seniorityMatch: number;
  timezoneMatch: number;
  budgetMatch: number;

  // Explainability data (not used in scoring)
  matchingSkills: string[];
  missingRequiredSkills: string[];
}

/*
 * Complete match result for one engineer.
 */
export interface JobMatchResult {
  engineerId: string;
  matchScore: number;
  signals: JobEngineerMatchSignals;
}
