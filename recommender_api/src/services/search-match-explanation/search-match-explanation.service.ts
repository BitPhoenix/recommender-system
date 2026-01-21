import { Session } from 'neo4j-driver';
import {
  AppliedPreferenceType,
  type SearchFilterRequest,
  type EngineerMatch,
  type StartTimeline,
  isSkillFilter,
  type AppliedSkillFilter,
  type AppliedSkillPreference,
} from '../../types/search.types.js';
import type {
  SearchMatchExplanation,
  ConstraintExplanation,
  ScoreExplanation,
  EvidenceExplanation,
  TradeoffExplanation,
} from '../../types/search-match-explanation.types.js';
import { formatStartTimeline } from '../../config/display.config.js';
import { executeSearch } from '../search.service.js';
import { generateConstraintExplanations } from './constraint-explanation.service.js';
import { generateScoreExplanations } from './score-explanation.service.js';
import { generateEvidenceExplanations, summarizeEvidence } from './evidence-explanation.service.js';
import { detectTradeoffs, summarizeTradeoffs } from './tradeoff-explanation.service.js';
import { generateCompletion } from '../llm.service.js';

/*
 * WHY REUSE executeSearch INSTEAD OF LOADING DATA MANUALLY?
 *
 * The /explain endpoint is called for engineers that appeared in search results.
 * Rather than reimplementing matching logic (matchType computation, score calculation,
 * constraint expansion), we reuse executeSearch with an engineerId filter.
 *
 * This guarantees:
 * - Accurate matchType (direct/descendant/correlated) from existing logic
 * - Consistent score breakdown with /filter endpoint
 * - No duplication of constraint expansion or skill resolution
 * - Single source of truth for how engineers are evaluated
 *
 * The engineerId field is added to SearchFilterRequest to support this pattern.
 */

interface ExplainRequest {
  engineerId: string;
  searchCriteria: SearchFilterRequest;
}

const LLM_SYSTEM_PROMPT = `You are an expert tech recruiter explaining why a software engineer matches (or doesn't match) a hiring manager's search criteria.

You will receive:
1. The engineer's profile summary
2. Constraint satisfaction details (with operator semantics)
3. Score breakdown
4. Evidence backing their skills
5. Any tradeoffs vs the ideal profile (in a "Tradeoffs" section, if present)

IMPORTANT - Skill constraint semantics:
- Constraints use HAS_ANY operator: engineer needs ONE skill from the list, not all
- When skills are marked as "descendants of [X]", the user requested skill X, and the system
  expanded it to include related skills. Having any descendant skill satisfies the requirement.
- Example: If user requested "API Design" and engineer has "REST APIs", that SATISFIES the
  requirement because REST APIs is a descendant of API Design.
- Do NOT say engineer is "missing" skills they don't need. If satisfied=true, they passed.

IMPORTANT - Tradeoffs:
- ONLY mention tradeoffs that appear in the "Tradeoffs" section of the context
- If there is no "Tradeoffs" section, there are NO tradeoffs to mention
- Do NOT invent or infer tradeoffs from score percentages or other data
- Lower scores are not tradeoffs unless explicitly listed in the Tradeoffs section

Your task: Write a concise explanation (typically 2-4 sentences, but use more if the situation warrants it) that:
- Highlights the engineer's strongest qualifications
- Mentions tradeoffs ONLY if they appear in the Tradeoffs section
- Uses specific evidence when relevant
- Correctly interprets HAS_ANY constraints (having one skill from the list is success)
- Is concise but informative

Write in a professional, objective tone.`;

export async function generateSearchMatchExplanation(
  session: Session,
  request: ExplainRequest
): Promise<SearchMatchExplanation> {
  // Step 1: Run search with engineerId filter to get computed match data
  // This reuses all existing matching logic (matchType, scores, constraints)
  const searchResponse = await executeSearch(session, {
    ...request.searchCriteria,
    engineerId: request.engineerId,
  });

  if (searchResponse.matches.length === 0) {
    throw new Error(
      `Engineer ${request.engineerId} does not match the given search criteria`
    );
  }

  const engineerMatch = searchResponse.matches[0];

  // Step 2: Generate constraint explanations using computed appliedFilters
  const constraintExplanations = generateConstraintExplanations(
    searchResponse.appliedFilters,
    engineerMatch
  );

  // Step 3: Generate score explanations using computed scoreBreakdown
  const scoreExplanations = generateScoreExplanations({
    breakdown: engineerMatch.scoreBreakdown,
    engineerName: engineerMatch.name,
  });

  // Step 4: Collect relevant skill IDs for evidence (from matched skills)
  const relevantSkillIds = engineerMatch.matchedSkills.map((s) => s.skillId);

  // Step 5: Generate evidence explanations
  const evidenceExplanations = await generateEvidenceExplanations(
    session,
    request.engineerId,
    relevantSkillIds
  );

  // Step 6: Detect tradeoffs
  // Collect preferred skill data from applied preferences
  const skillPreferences = searchResponse.appliedPreferences.filter(
    (p): p is AppliedSkillPreference => p.type === AppliedPreferenceType.Skill
  );
  const preferredSkillIds = skillPreferences.flatMap((p) => p.skills.map((s) => s.skillId));
  const preferredSkillNames = skillPreferences.map((p) => p.displayValue);

  const tradeoffExplanations = detectTradeoffs(
    {
      yearsExperience: engineerMatch.yearsExperience,
      salary: engineerMatch.salary,
      startTimeline: engineerMatch.startTimeline as StartTimeline,
      timezone: engineerMatch.timezone,
      skills: engineerMatch.matchedSkills.map((s) => s.skillId),
    },
    {
      preferredSeniorityLevel: request.searchCriteria.preferredSeniorityLevel,
      maxBudget: request.searchCriteria.maxBudget,
      stretchBudget: request.searchCriteria.stretchBudget,
      preferredMaxStartTime: request.searchCriteria.preferredMaxStartTime,
      preferredTimezone: request.searchCriteria.preferredTimezone,
      preferredSkillIds,
      preferredSkillNames: preferredSkillNames.length > 0 ? preferredSkillNames : undefined,
    }
  );

  // Step 7: Generate LLM narrative
  const narrative = await generateLLMNarrative(
    engineerMatch,
    constraintExplanations,
    scoreExplanations,
    evidenceExplanations,
    tradeoffExplanations
  );

  // Step 8: Generate summary
  const summary = generateSummary(
    constraintExplanations,
    tradeoffExplanations,
    narrative
  );

  return {
    engineer: {
      id: engineerMatch.id,
      name: engineerMatch.name,
      headline: engineerMatch.headline,
    },
    matchScore: engineerMatch.utilityScore,
    summary,
    constraints: constraintExplanations,
    scores: scoreExplanations,
    evidence: evidenceExplanations,
    tradeoffs: tradeoffExplanations,
  };
}

async function generateLLMNarrative(
  engineer: EngineerMatch,
  constraints: ConstraintExplanation[],
  scores: ScoreExplanation[],
  evidence: EvidenceExplanation[],
  tradeoffs: TradeoffExplanation[]
): Promise<string | null> {
  const context = buildLLMContext(engineer, constraints, scores, evidence, tradeoffs);
  return generateCompletion(context, { systemPrompt: LLM_SYSTEM_PROMPT });
}

function generateSummary(
  constraints: ConstraintExplanation[],
  tradeoffs: TradeoffExplanation[],
  narrative: string | null
): SearchMatchExplanation['summary'] {
  // Constraint summary
  const satisfied = constraints.filter((c) => c.satisfied).length;
  const total = constraints.length;
  const constraintsSummary =
    total === 0
      ? 'No constraints applied'
      : satisfied === total
        ? `Matches all ${total} requirement${total === 1 ? '' : 's'}`
        : `Matches ${satisfied} of ${total} requirements`;

  // Tradeoff summary
  const tradeoffsSummary = summarizeTradeoffs(tradeoffs);

  return {
    constraints: constraintsSummary,
    tradeoffs: tradeoffsSummary,
    narrative,
  };
}

function buildLLMContext(
  engineer: EngineerMatch,
  constraints: ConstraintExplanation[],
  scores: ScoreExplanation[],
  evidence: EvidenceExplanation[],
  tradeoffs: TradeoffExplanation[]
): string {
  const parts: string[] = [];

  // Detect browse mode: no user-requested skill constraints
  const hasUserSkillConstraints = constraints.some(
    (c) => isSkillFilter(c.constraint) && c.constraint.source === 'user'
  );
  const isBrowseMode = !hasUserSkillConstraints;

  // Engineer profile
  parts.push(`# Engineer Profile`);
  parts.push(`Name: ${engineer.name}`);
  parts.push(`Headline: ${engineer.headline}`);
  parts.push(`Experience: ${engineer.yearsExperience} years`);
  parts.push(`Timezone: ${engineer.timezone}`);
  parts.push(`Available: ${formatStartTimeline(engineer.startTimeline)}`);
  parts.push('');

  // Add browse mode context if applicable
  if (isBrowseMode) {
    parts.push(`# Search Context: Browse Mode`);
    parts.push(`The hiring manager did not specify any required skills - this is a browse/discovery search.`);
    parts.push(`In browse mode, skill match scores are baseline values and should NOT be interpreted as`);
    parts.push(`assessments of the engineer's abilities. Focus on the engineer's headline, experience,`);
    parts.push(`and any evidence of their work rather than numeric scores.`);
    parts.push('');
  }

  // Constraint satisfaction with operator context
  parts.push(`# Constraint Satisfaction`);
  if (!isBrowseMode) {
    parts.push(`Note: Skill constraints use HAS_ANY operator - engineer needs ONE skill from the list, not all.`);
    parts.push('');
  }
  for (const constraintExplanation of constraints) {
    const status = constraintExplanation.satisfied ? '✓ SATISFIED' : '✗ NOT SATISFIED';
    parts.push(`${status}: ${constraintExplanation.explanation}`);

    // Add context for skill constraints about original skill and expansion
    if (isSkillFilter(constraintExplanation.constraint)) {
      const skillFilter = constraintExplanation.constraint as AppliedSkillFilter;
      const originalSkillId = skillFilter.originalSkillId;
      const skillNames = skillFilter.skills.map((s) => s.skillName);

      if (originalSkillId && skillFilter.displayValue) {
        parts.push(`  → User requested: "${skillFilter.displayValue}"`);
        parts.push(`  → Acceptable skills (descendants): ${skillNames.join(', ')}`);
        parts.push(`  → Operator: HAS_ANY (having ONE skill satisfies this requirement)`);
      }
    }
  }
  parts.push('');

  // Top score components (exclude skillMatch in browse mode since it's not meaningful)
  parts.push(`# Score Components (top 3)`);
  const filteredScores = isBrowseMode
    ? scores.filter((s) => s.component !== 'skillMatch' && s.component !== 'confidence')
    : scores;
  const topScores = [...filteredScores].sort((a, b) => b.weightedScore - a.weightedScore).slice(0, 3);
  for (const s of topScores) {
    parts.push(`- ${formatComponentName(s.component)}: ${Math.round(s.rawScore * 100)}% (weight: ${Math.round(s.weight * 100)}%)`);
    if (s.contributingFactors.length > 0) {
      parts.push(`  Factors: ${s.contributingFactors.slice(0, 3).join(', ')}`);
    }
  }
  parts.push('');

  // Evidence summary
  parts.push(`# Evidence`);
  parts.push(summarizeEvidence(evidence));
  if (evidence.length > 0) {
    const topEvidence = evidence[0];
    const primaryItem = topEvidence.evidenceItems.find((e) => e.isPrimary);
    if (primaryItem) {
      parts.push(`Primary evidence for ${topEvidence.skillName}: ${primaryItem.summary}`);
    }
  }
  parts.push('');

  // Tradeoffs
  if (tradeoffs.length > 0) {
    parts.push(`# Tradeoffs`);
    for (const t of tradeoffs) {
      parts.push(`- ${t.explanation}`);
    }
  }

  return parts.join('\n');
}

/*
 * Shared utility for formatting score component names.
 * Called by both generateSummary and buildLLMContext.
 * Placed after both callers per parent-first ordering convention.
 */
function formatComponentName(component: string): string {
  const nameMap: Record<string, string> = {
    skillMatch: 'skill proficiency',
    confidence: 'confidence scores',
    experience: 'years of experience',
    preferredSkillsMatch: 'preferred skills',
    teamFocusMatch: 'team focus alignment',
    relatedSkillsMatch: 'related skills',
    preferredBusinessDomainMatch: 'business domain',
    preferredTechnicalDomainMatch: 'technical domain',
    startTimelineMatch: 'start availability',
    preferredTimezoneMatch: 'timezone',
    preferredSeniorityMatch: 'seniority level',
    budgetMatch: 'budget fit',
  };
  return nameMap[component] ?? component;
}

