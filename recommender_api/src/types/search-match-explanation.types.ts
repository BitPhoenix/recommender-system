import { AppliedFilter, MatchedSkill, MatchType } from './search.types.js';

/*
 * TechnicalDepth is defined locally to avoid cross-package imports from seeds/.
 * Values match seeds/types.ts:8 for consistency.
 */
export type TechnicalDepth = 'surface' | 'working' | 'deep' | 'expert';

/*
 * Three explanation types following Section 5.3.3:
 * - Constraint: Which requirements are satisfied and how
 * - Score: How each scoring component contributed
 * - Evidence: Proof backing skill claims
 *
 * Note: We import MatchType from search.types.ts rather than redefining it.
 * We also import TechnicalDepth from seeds/types.ts for consistency.
 *
 * INTERFACE ORDERING: Parent/container interfaces are placed ABOVE the child
 * interfaces they reference, matching the code style convention for functions.
 *
 * Type hierarchy:
 * SearchMatchExplanation (top-level response)
 * ├── summary (inline object for text summaries)
 * ├── ConstraintExplanation[]
 * ├── ScoreExplanation[]
 * ├── EvidenceExplanation[]
 * │   └── EvidenceItem
 * │       ├── StoryDetails
 * │       ├── PerformanceDetails
 * │       └── CertificationDetails
 * └── TradeoffExplanation[]
 */

// ============================================
// Top-Level Response
// ============================================

export interface SearchMatchExplanation {
  engineer: {
    id: string;
    name: string;
    headline: string;
  };
  matchScore: number;

  // Quick text summaries for display
  summary: {
    constraints: string;      // "Matches all 5 requirements"
    tradeoffs: string;        // "No significant tradeoffs"
    narrative: string | null; // LLM-generated prose
  };

  // Structured explanation data
  constraints: ConstraintExplanation[];
  scores: ScoreExplanation[];
  evidence: EvidenceExplanation[];
  tradeoffs: TradeoffExplanation[];
}

// ============================================
// Constraint Satisfaction Explanation
// ============================================

/*
 * Reuse MatchType from search.types.ts: 'direct' | 'descendant' | 'correlated' | 'none'
 * - direct: User explicitly requested this skill, engineer has it
 * - descendant: User requested parent (e.g., "Backend"), engineer has child (e.g., "Node.js")
 * - correlated: Matched via CORRELATES_WITH edge (primarily for similarity scoring)
 * - none: Unfiltered search, all skills returned
 */

export interface ConstraintExplanation {
  constraint: AppliedFilter;
  satisfied: boolean;
  explanation: string;
  matchedValues: string[];
  matchType?: MatchType;  // Imported from search.types.ts
}

/*
 * EXAMPLE: ConstraintExplanation[] for a search
 *
 * Search criteria:
 *   requiredSkills: ["Backend", "TypeScript"]
 *   minYearsExperience: 5
 *   allowedTimezones: ["Eastern", "Central"]
 *
 * Engineer has: Node.js (child of Backend), TypeScript, 7 years, Eastern timezone
 *
 * constraints: [
 *   // Skill - descendant match (user asked for "Backend", engineer has "Node.js")
 *   {
 *     constraint: { kind: "skill", skills: [{skillId: "skill_backend", skillName: "Backend"}], ... },
 *     satisfied: true,
 *     explanation: "Has descendant skill of Backend: Node.js (expert, 95% confidence)",
 *     matchedValues: ["Node.js (expert, 95% confidence)"],
 *     matchType: "descendant"
 *   },
 *
 *   // Skill - direct match (user asked for "TypeScript", engineer has "TypeScript")
 *   {
 *     constraint: { kind: "skill", skills: [{skillId: "skill_typescript", skillName: "TypeScript"}], ... },
 *     satisfied: true,
 *     explanation: "Has required skill: TypeScript (proficient, 88% confidence)",
 *     matchedValues: ["TypeScript (proficient, 88% confidence)"],
 *     matchType: "direct"
 *   },
 *
 *   // Property - no matchType (only skill constraints have hierarchical matching)
 *   {
 *     constraint: { kind: "property", field: "yearsExperience", operator: ">=", value: "5", ... },
 *     satisfied: true,
 *     explanation: "Has 7 years of experience (required: ≥5)",
 *     matchedValues: ["7"]
 *     // No matchType for property constraints
 *   },
 *
 *   // Property - timezone
 *   {
 *     constraint: { kind: "property", field: "timezone", operator: "IN", value: '["Eastern","Central"]', ... },
 *     satisfied: true,
 *     explanation: "In Eastern timezone (allowed: Eastern or Central)",
 *     matchedValues: ["Eastern"]
 *   }
 * ]
 *
 * Correlated match example (from inference rules):
 *   {
 *     constraint: { kind: "skill", ..., source: "rule:react-implies-js" },
 *     satisfied: true,
 *     explanation: "Has correlated skill: JavaScript (expert, 92% confidence)",
 *     matchedValues: ["JavaScript (expert, 92% confidence)"],
 *     matchType: "correlated"
 *   }
 *
 * Unsatisfied constraint example:
 *   {
 *     constraint: { kind: "skill", skills: [{skillId: "skill_kubernetes", skillName: "Kubernetes"}], ... },
 *     satisfied: false,
 *     explanation: "Missing required skill: Kubernetes",
 *     matchedValues: [],
 *     matchType: undefined  // No match, so no match type
 *   }
 */

// ============================================
// Score Component Explanation
// ============================================

export interface ScoreExplanation {
  component: string;
  weight: number;
  rawScore: number;
  weightedScore: number;
  explanation: string;
  contributingFactors: string[];
}

// ============================================
// Evidence Explanation
// ============================================

export interface EvidenceExplanation {
  skillId: string;
  skillName: string;
  evidenceItems: EvidenceItem[];
}

export interface EvidenceItem {
  type: EvidenceType;
  id: string;
  summary: string;
  relevanceScore: number;
  isPrimary: boolean;
  details: StoryDetails | PerformanceDetails | CertificationDetails;
}

/*
 * EvidenceType aligns with SkillEvidence.evidenceType from seeds/types.ts
 * Note: seeds uses 'performance' (QuestionPerformance node), we use same naming
 */
export type EvidenceType = 'story' | 'performance' | 'certification';

/*
 * API response types for evidence details.
 *
 * WHY FLATTENED DTOs INSTEAD OF REUSING SEED TYPES?
 *
 * The Cypher queries join across multiple nodes (e.g., InterviewStory + StoryAnalysis),
 * so we're already working with joined data. The question is what shape to return.
 *
 * Option A: Return raw node properties (seed-like)
 *   - Client receives fields they don't need: engineerId, interviewId, rawTranscript,
 *     durationSeconds, createdAt, storyId, analyzerModel, analyzedAt, reasoning, flags
 *   - Larger payload (~2KB per story vs ~500 bytes flattened)
 *   - Exposes internal IDs and implementation details
 *
 * Option B: Flattened DTOs (chosen)
 *   - Only fields the UI needs to render explanations
 *   - ~75% smaller payload
 *   - Hides internal structure (no internal IDs, timestamps, model names)
 *   - Client-focused shape optimized for display
 *
 * For PerformanceDetails specifically, flattening is required because QuestionPerformance
 * alone is useless - you need assessmentName and questionSummary from joined nodes.
 *
 * Type mapping:
 * - StoryDetails: Flattened STAR + optional analysis scores (vs InterviewStory + StoryAnalysis nodes)
 * - PerformanceDetails: Flattened question performance + joined assessment/question info
 * - CertificationDetails: Subset of Certification fields relevant for display
 */

export interface StoryDetails {
  situation: string;
  task: string;
  action: string;
  result: string;
  analysis?: {
    clarityScore: number;
    impactScore: number;
    ownershipScore: number;
    overallScore: number;
  };
}

export interface PerformanceDetails {
  assessmentName: string;
  questionSummary: string;
  score: number;
  maxScore: number;
  technicalDepth: TechnicalDepth;
  feedback?: string;
}

export interface CertificationDetails {
  name: string;
  issuingOrg: string;
  issueDate: string;
  expiryDate?: string;
  verified: boolean;
}

// ============================================
// Tradeoff Explanation
// ============================================

/*
 * WHY NO DIRECTION OR SEVERITY?
 *
 * We considered including `direction: 'over' | 'under'` and
 * `severity: 'minor' | 'moderate' | 'significant'` but removed them because:
 *
 * 1. Severity is subjective - 10% over budget might be "minor" to a well-funded
 *    company but "significant" to a startup with tight runway. The hiring manager
 *    knows their constraints better than we do.
 *
 * 2. Direction can be misleading - "over" on experience isn't necessarily bad
 *    (overqualified could be great or could mean flight risk). That interpretation
 *    belongs to the manager.
 *
 * 3. We should provide facts, not judgments - the `requested` vs `actual` values
 *    plus the `explanation` give the manager all the information they need to
 *    make their own assessment.
 *
 * The UI can let managers filter/sort tradeoffs however they prefer.
 */

export interface TradeoffExplanation {
  attribute: string;
  requested: unknown;   // What the search criteria specified
  actual: unknown;      // What the engineer has
  explanation: string;  // Human-readable description of the gap
}
