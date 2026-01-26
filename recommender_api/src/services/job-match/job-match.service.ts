import { Session } from "neo4j-driver";
import { loadJobWithSkills, type JobWithSkills } from "../job.service.js";
import {
  calculateSeniorityMatch,
  calculateTimezoneMatch,
  calculateBudgetMatch,
  calculateSkillCoverage,
} from "./structured-signals.service.js";
import { findSimilarEngineersByEmbedding } from "../content-search/embedding-index-manager.service.js";
import { computeSkillSetSimilarity } from "../content-search/skill-embedding-similarity.service.js";
import { loadEngineerSkillsWithEmbeddings } from "../content-search/skill-embedding-loader.service.js";
import { loadEngineerInfo } from "../engineer.service.js";
import { DEFAULT_JOB_MATCH_WEIGHTS } from "../../config/job-match-scoring.config.js";
import type {
  JobMatchScoringWeights,
  JobEngineerMatchSignals,
  JobMatchResult,
} from "../../types/job-match.types.js";
import type { SkillWithEmbedding } from "../content-search/skill-embedding-similarity.types.js";

interface JobMatchRequest {
  jobId: string;
  limit: number;
  offset: number;
  weights?: JobMatchScoringWeights;
}

interface JobMatchResponse {
  jobId: string;
  jobTitle: string;
  matches: Array<{
    id: string;
    name: string;
    headline: string;
    salary: number;
    yearsExperience: number;
    timezone: string;
    matchScore: number;
    scoreBreakdown: JobEngineerMatchSignals;
  }>;
  totalCount: number;
  queryMetadata: {
    executionTimeMs: number;
    candidatesEvaluated: number;
    scoringWeights: JobMatchScoringWeights;
  };
}

/*
 * Find engineers matching a job description.
 *
 * Uses multi-signal scoring following Eightfold architecture:
 * 1. Semantic similarity (job embedding vs engineer embedding)
 * 2. Skill embedding similarity (centroids)
 * 3. Recency-weighted skill similarity
 * 4. Structured feature matching (skills, seniority, timezone, budget)
 */
export async function findEngineersForJob(
  session: Session,
  request: JobMatchRequest
): Promise<JobMatchResponse> {
  const startTime = Date.now();
  const weights = request.weights ?? DEFAULT_JOB_MATCH_WEIGHTS;

  // Load job data
  const jobData = await loadJobWithSkills(session, request.jobId);
  if (!jobData) {
    throw new Error(`Job not found: ${request.jobId}`);
  }

  if (!jobData.embedding) {
    throw new Error(`Job has no embedding: ${request.jobId}`);
  }

  // Stage 1: Find candidate engineers by semantic similarity
  // Fetch more than needed for re-ranking after computing all signals
  const candidatePoolSize = Math.max((request.limit + request.offset) * 3, 100);
  const candidateEngineers = await findSimilarEngineersByEmbedding(
    session,
    jobData.embedding,
    candidatePoolSize
  );

  // Stage 2: Compute all signals for each candidate
  const matchResults: JobMatchResult[] = [];

  for (const candidateEngineer of candidateEngineers) {
    const signals = await computeJobEngineerMatchSignals(
      session,
      jobData,
      candidateEngineer.engineerId,
      candidateEngineer.score
    );

    // Compute weighted score
    const matchScore = computeWeightedScore(signals, weights);

    matchResults.push({
      engineerId: candidateEngineer.engineerId,
      matchScore,
      signals,
    });
  }

  // Stage 3: Sort by match score and apply pagination
  matchResults.sort((a, b) => b.matchScore - a.matchScore);
  const totalCount = matchResults.length;
  const paginatedResults = matchResults.slice(
    request.offset,
    request.offset + request.limit
  );

  // Stage 4: Load engineer details for results
  const engineerIds = paginatedResults.map(r => r.engineerId);
  const engineerInfoMap = await loadEngineerInfo(session, engineerIds);

  // Build response
  const matches = paginatedResults
    .filter(result => engineerInfoMap.has(result.engineerId))
    .map(result => {
      const engineer = engineerInfoMap.get(result.engineerId)!;
      return {
        id: engineer.id,
        name: engineer.name,
        headline: engineer.headline,
        salary: engineer.salary,
        yearsExperience: engineer.yearsExperience,
        timezone: engineer.timezone,
        matchScore: result.matchScore,
        scoreBreakdown: result.signals,
      };
    });

  return {
    jobId: jobData.id,
    jobTitle: jobData.title,
    matches,
    totalCount,
    queryMetadata: {
      executionTimeMs: Date.now() - startTime,
      candidatesEvaluated: candidateEngineers.length,
      scoringWeights: weights,
    },
  };
}

/*
 * Compute all similarity signals for one engineer.
 */
async function computeJobEngineerMatchSignals(
  session: Session,
  jobData: JobWithSkills,
  engineerId: string,
  semanticSimilarity: number
): Promise<JobEngineerMatchSignals> {
  // Load engineer's skills with recency data
  const engineerSkills = await loadEngineerSkillsWithEmbeddings(session, engineerId);

  // Load basic engineer info for structured matching
  const engineerInfoMap = await loadEngineerInfo(session, [engineerId]);
  const engineerInfo = engineerInfoMap.get(engineerId);

  // Prepare job skill embeddings for centroid comparison
  const jobRequiredSkillEmbeddings: SkillWithEmbedding[] = jobData.requiredSkills
    .filter(s => s.embedding)
    .map(s => ({
      skillId: s.skillId,
      skillName: s.skillName,
      embedding: s.embedding,
    }));

  // Compute skill embedding similarity (centroid comparison)
  let skillSimilarity = 0;
  let recentSkillSimilarity = 0;

  if (jobRequiredSkillEmbeddings.length > 0 && engineerSkills.length > 0) {
    const skillSetSimilarity = computeSkillSetSimilarity(
      engineerSkills,
      jobRequiredSkillEmbeddings
    );
    skillSimilarity = skillSetSimilarity.skills.score;
    recentSkillSimilarity = skillSetSimilarity.recentSkills.score;
  }

  // Compute skill coverage (exact matches)
  const engineerSkillIds = new Set(engineerSkills.map(s => s.skillId));
  const requiredCoverage = calculateSkillCoverage(
    jobData.requiredSkills.map(s => s.skillId),
    engineerSkillIds
  );
  const preferredCoverage = calculateSkillCoverage(
    jobData.preferredSkills.map(s => s.skillId),
    engineerSkillIds
  );

  // Get skill names for explainability
  const skillIdToName = new Map<string, string>();
  for (const skill of [...jobData.requiredSkills, ...jobData.preferredSkills]) {
    skillIdToName.set(skill.skillId, skill.skillName);
  }

  const matchingSkills = [
    ...requiredCoverage.matchingSkillIds,
    ...preferredCoverage.matchingSkillIds,
  ].map(id => skillIdToName.get(id) ?? id);

  const missingRequiredSkills = requiredCoverage.missingSkillIds
    .map(id => skillIdToName.get(id) ?? id);

  // Compute structured signals
  const seniorityMatch = engineerInfo
    ? calculateSeniorityMatch(jobData.seniority, engineerInfo.yearsExperience)
    : 0;

  const timezoneMatch = engineerInfo
    ? calculateTimezoneMatch(jobData.timezone, engineerInfo.timezone)
    : 0;

  const budgetMatch = engineerInfo
    ? calculateBudgetMatch(jobData.minBudget, jobData.maxBudget, engineerInfo.salary)
    : 0;

  return {
    semanticSimilarity,
    skillSimilarity,
    recentSkillSimilarity,
    requiredSkillCoverage: requiredCoverage.coverage,
    preferredSkillCoverage: preferredCoverage.coverage,
    seniorityMatch,
    timezoneMatch,
    budgetMatch,
    matchingSkills,
    missingRequiredSkills,
  };
}

/*
 * Compute weighted score from signals.
 */
function computeWeightedScore(
  signals: JobEngineerMatchSignals,
  weights: JobMatchScoringWeights
): number {
  return (
    weights.semanticSimilarity * signals.semanticSimilarity +
    weights.skillSimilarity * signals.skillSimilarity +
    weights.recentSkillSimilarity * signals.recentSkillSimilarity +
    weights.requiredSkillCoverage * signals.requiredSkillCoverage +
    weights.preferredSkillCoverage * signals.preferredSkillCoverage +
    weights.seniorityMatch * signals.seniorityMatch +
    weights.timezoneMatch * signals.timezoneMatch +
    weights.budgetMatch * signals.budgetMatch
  );
}
