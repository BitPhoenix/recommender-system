import type {
  SkillWithEmbedding,
  SkillWithRecency,
  SkillSetSimilarityResult,
} from "./skill-embedding-similarity.types.js";
import { parseDateString, toMonthNumber } from "../resume-processor/date-utils.js";
import { cosineSimilarity, computeCentroid } from "./dense-vector.service.js";

/*
 * Years threshold for "recent" skills.
 *
 * Skills used within this many years from today are considered recent.
 * This aligns with typical job posting requirements ("3+ years recent experience").
 */
const RECENT_YEARS_THRESHOLD = 3;

/*
 * Compute skill-set similarity between two sets of skills using centroid comparison.
 *
 * Per Eightfold Phase 4.3: aggregate skills into single vectors via mean,
 * then compare centroids with cosine similarity.
 *
 * @param sourceSkills Skills from the source (e.g., engineer)
 * @param targetSkills Skills from the target (e.g., query or other engineer)
 * @returns Similarity scores for all-time and recent skill sets
 */
export function computeSkillSetSimilarity(
  sourceSkills: SkillWithRecency[],
  targetSkills: SkillWithEmbedding[]
): SkillSetSimilarityResult {
  // Handle empty cases
  if (sourceSkills.length === 0 || targetSkills.length === 0) {
    return {
      skills: { score: 0, count: sourceSkills.length },
      recentSkills: { score: 0, count: 0 },
    };
  }

  // Compute target centroid (all skills equally weighted)
  const targetCentroid = computeCentroid(targetSkills.map((s) => s.embedding));

  // Compute similarity using all skills
  const skillsCentroid = computeCentroid(sourceSkills.map((s) => s.embedding));
  const skillsScore = cosineSimilarity(skillsCentroid, targetCentroid);

  // Filter to recent skills and compute similarity
  const recentSkills = filterRecentSkills(sourceSkills, RECENT_YEARS_THRESHOLD);
  let recentSkillsScore = 0;
  if (recentSkills.length > 0) {
    const recentSkillsCentroid = computeCentroid(recentSkills.map((s) => s.embedding));
    recentSkillsScore = cosineSimilarity(recentSkillsCentroid, targetCentroid);
  }

  return {
    skills: { score: skillsScore, count: sourceSkills.length },
    recentSkills: { score: recentSkillsScore, count: recentSkills.length },
  };
}

/*
 * Filter skills to those used within the recency threshold.
 *
 * A skill is "recent" if:
 * - It has a lastUsedDate that is within RECENT_YEARS_THRESHOLD years of today, OR
 * - It has lastUsedDate = "present" (currently using)
 *
 * Skills without work experience links (self-taught) are excluded from recent
 * calculation since we can't determine recency.
 */
function filterRecentSkills(
  skills: SkillWithRecency[],
  yearsThreshold: number
): SkillWithRecency[] {
  const now = new Date();
  const cutoffYearMonth = {
    year: now.getFullYear() - yearsThreshold,
    month: now.getMonth() + 1, // 1-indexed
  };
  const cutoffMonthNumber = toMonthNumber(cutoffYearMonth);

  return skills.filter((skill) => {
    if (!skill.lastUsedDate) {
      return false; // No work experience link, can't determine recency
    }

    try {
      // parseDateString handles "YYYY-MM", "YYYY", and "present"
      const lastUsed = parseDateString(skill.lastUsedDate, true); // isEndDate=true
      return toMonthNumber(lastUsed) >= cutoffMonthNumber;
    } catch {
      return false; // Unparseable date
    }
  });
}
