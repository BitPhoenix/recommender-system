/*
 * Types for skill embedding similarity computation.
 */

/*
 * A skill with its embedding vector.
 */
export interface SkillWithEmbedding {
  skillId: string;
  skillName: string;
  embedding: number[];
}

/*
 * A skill with recency information for weighted centroid calculation.
 */
export interface SkillWithRecency extends SkillWithEmbedding {
  /** When the skill was last used (null if self-taught or no work experience link) */
  lastUsedDate: string | null;
  /** Total years of experience with this skill */
  yearsUsed: number;
}

/*
 * Result of skill-set similarity computation.
 *
 * Groups results by skill set for cleaner access:
 *   result.skills.score, result.recentSkills.score
 */
export interface SkillSetSimilarityResult {
  /** Similarity using all skills regardless of when last used */
  skills: {
    /** Centroid cosine similarity (0-1) */
    score: number;
    /** Number of skills included in the calculation */
    count: number;
  };
  /** Similarity using only skills used in last N years */
  recentSkills: {
    /** Centroid cosine similarity (0-1) */
    score: number;
    /** Number of skills included in the calculation */
    count: number;
  };
}
