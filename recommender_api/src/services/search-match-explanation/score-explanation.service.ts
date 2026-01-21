import { ScoreBreakdown, PreferenceMatches } from '../../types/search.types.js';
import { ScoreExplanation } from '../../types/search-match-explanation.types.js';
import { utilityWeights } from '../../config/knowledge-base/utility.config.js';
import { formatStartTimeline } from '../../config/display.config.js';

interface ScoreContext {
  breakdown: ScoreBreakdown;
  engineerName: string;
}

export function generateScoreExplanations(context: ScoreContext): ScoreExplanation[] {
  const explanations: ScoreExplanation[] = [];
  const { scores, rawScores } = context.breakdown;

  // Core scores
  // Use raw scores (0-1 normalized) for explanation generation when available.
  // Raw scores allow accurate reverse calculation (e.g., years from experience score).
  // Fall back to weighted scores for backwards compatibility.
  if (scores.skillMatch !== undefined) {
    const rawScore = rawScores?.skillMatch ?? scores.skillMatch;
    explanations.push(generateSkillMatchExplanation(rawScore, scores.skillMatch));
  }
  if (scores.confidence !== undefined) {
    const rawScore = rawScores?.confidence ?? scores.confidence;
    explanations.push(generateConfidenceExplanation(rawScore, scores.confidence));
  }
  if (scores.experience !== undefined) {
    const rawScore = rawScores?.experience ?? scores.experience;
    explanations.push(generateExperienceExplanation(rawScore, scores.experience));
  }

  // Preference matches
  const preferenceExplanations = generatePreferenceExplanations(context.breakdown.preferenceMatches);
  explanations.push(...preferenceExplanations);

  return explanations;
}

function generateSkillMatchExplanation(rawScore: number, weightedScore: number): ScoreExplanation {
  const weight = utilityWeights.skillMatch;

  let explanation: string;
  if (rawScore >= 0.9) {
    explanation = 'Excellent proficiency match on required skills';
  } else if (rawScore >= 0.7) {
    explanation = 'Good proficiency match on required skills';
  } else if (rawScore >= 0.5) {
    explanation = 'Partial proficiency match on required skills';
  } else {
    explanation = 'Limited proficiency match on required skills';
  }

  return {
    component: 'skillMatch',
    weight,
    rawScore,
    weightedScore,
    explanation,
    contributingFactors: [], // Populated by caller with matched skill details
  };
}

function generateConfidenceExplanation(rawScore: number, weightedScore: number): ScoreExplanation {
  const weight = utilityWeights.confidenceScore;

  /*
   * The rawScore is normalized to 0-1 from the original 0.5-1.0 confidence range.
   * We don't show the original percentage in the explanation because having two
   * different numbers (rawScore: 0.84 vs "avg 92%") is confusing to users.
   */
  let explanation: string;
  if (rawScore >= 0.8) {
    explanation = 'Very high confidence in skill assessments';
  } else if (rawScore >= 0.5) {
    explanation = 'Good confidence in skill assessments';
  } else {
    explanation = 'Moderate confidence in skill assessments';
  }

  return {
    component: 'confidence',
    weight,
    rawScore,
    weightedScore,
    explanation,
    contributingFactors: [],
  };
}

function generateExperienceExplanation(rawScore: number, weightedScore: number): ScoreExplanation {
  const weight = utilityWeights.yearsExperience;

  // Reverse the logarithmic formula to get approximate years
  // rawScore = log(1 + years) / log(1 + 20)
  const years = Math.round(Math.exp(rawScore * Math.log(21)) - 1);

  let explanation: string;
  if (years >= 10) {
    explanation = `Staff+ level experience (${years}+ years)`;
  } else if (years >= 6) {
    explanation = `Senior level experience (${years} years)`;
  } else if (years >= 3) {
    explanation = `Mid-level experience (${years} years)`;
  } else {
    explanation = `Junior level experience (${years} years)`;
  }

  return {
    component: 'experience',
    weight,
    rawScore,
    weightedScore,
    explanation,
    contributingFactors: [`${years} years of experience`],
  };
}

function generatePreferenceExplanations(preferences: PreferenceMatches): ScoreExplanation[] {
  const explanations: ScoreExplanation[] = [];

  if (preferences.preferredSkillsMatch) {
    explanations.push({
      component: 'preferredSkillsMatch',
      weight: utilityWeights.preferredSkillsMatch,
      rawScore: preferences.preferredSkillsMatch.score,
      weightedScore: Math.round(preferences.preferredSkillsMatch.score * utilityWeights.preferredSkillsMatch * 1000) / 1000,
      explanation: preferences.preferredSkillsMatch.matchedSkills.length > 0
        ? `Has ${preferences.preferredSkillsMatch.matchedSkills.length} preferred skill(s)`
        : 'No preferred skills matched',
      contributingFactors: preferences.preferredSkillsMatch.matchedSkills,
    });
  }

  if (preferences.teamFocusMatch) {
    explanations.push({
      component: 'teamFocusMatch',
      weight: utilityWeights.teamFocusMatch,
      rawScore: preferences.teamFocusMatch.score,
      weightedScore: Math.round(preferences.teamFocusMatch.score * utilityWeights.teamFocusMatch * 1000) / 1000,
      explanation: preferences.teamFocusMatch.matchedSkills.length > 0
        ? `Aligns with team focus (${preferences.teamFocusMatch.matchedSkills.length} relevant skills)`
        : 'Limited alignment with team focus',
      contributingFactors: preferences.teamFocusMatch.matchedSkills,
    });
  }

  if (preferences.preferredBusinessDomainMatch) {
    explanations.push({
      component: 'preferredBusinessDomainMatch',
      weight: utilityWeights.preferredBusinessDomainMatch,
      rawScore: preferences.preferredBusinessDomainMatch.score,
      weightedScore: Math.round(preferences.preferredBusinessDomainMatch.score * utilityWeights.preferredBusinessDomainMatch * 1000) / 1000,
      explanation: preferences.preferredBusinessDomainMatch.matchedDomains.length > 0
        ? `Has experience in preferred business domain(s)`
        : 'No preferred business domain experience',
      contributingFactors: preferences.preferredBusinessDomainMatch.matchedDomains,
    });
  }

  if (preferences.preferredTechnicalDomainMatch) {
    explanations.push({
      component: 'preferredTechnicalDomainMatch',
      weight: utilityWeights.preferredTechnicalDomainMatch,
      rawScore: preferences.preferredTechnicalDomainMatch.score,
      weightedScore: Math.round(preferences.preferredTechnicalDomainMatch.score * utilityWeights.preferredTechnicalDomainMatch * 1000) / 1000,
      explanation: preferences.preferredTechnicalDomainMatch.matchedDomains.length > 0
        ? `Has experience in preferred technical domain(s)`
        : 'No preferred technical domain experience',
      contributingFactors: preferences.preferredTechnicalDomainMatch.matchedDomains,
    });
  }

  if (preferences.startTimelineMatch) {
    explanations.push({
      component: 'startTimelineMatch',
      weight: utilityWeights.startTimelineMatch,
      rawScore: preferences.startTimelineMatch.score,
      weightedScore: Math.round(preferences.startTimelineMatch.score * utilityWeights.startTimelineMatch * 1000) / 1000,
      explanation: preferences.startTimelineMatch.score >= 1.0
        ? `Available ${formatStartTimeline(preferences.startTimelineMatch.matchedStartTimeline)} (meets preference)`
        : `Available ${formatStartTimeline(preferences.startTimelineMatch.matchedStartTimeline)} (later than preferred)`,
      contributingFactors: [preferences.startTimelineMatch.matchedStartTimeline],
    });
  }

  if (preferences.preferredTimezoneMatch) {
    explanations.push({
      component: 'preferredTimezoneMatch',
      weight: utilityWeights.preferredTimezoneMatch,
      rawScore: preferences.preferredTimezoneMatch.score,
      weightedScore: Math.round(preferences.preferredTimezoneMatch.score * utilityWeights.preferredTimezoneMatch * 1000) / 1000,
      explanation: preferences.preferredTimezoneMatch.score >= 1.0
        ? `In preferred timezone (${preferences.preferredTimezoneMatch.matchedTimezone})`
        : `In ${preferences.preferredTimezoneMatch.matchedTimezone} timezone`,
      contributingFactors: [preferences.preferredTimezoneMatch.matchedTimezone],
    });
  }

  if (preferences.preferredSeniorityMatch) {
    explanations.push({
      component: 'preferredSeniorityMatch',
      weight: utilityWeights.preferredSeniorityMatch,
      rawScore: preferences.preferredSeniorityMatch.score,
      weightedScore: Math.round(preferences.preferredSeniorityMatch.score * utilityWeights.preferredSeniorityMatch * 1000) / 1000,
      explanation: preferences.preferredSeniorityMatch.score >= 1.0
        ? 'Meets preferred seniority level'
        : 'Below preferred seniority level',
      contributingFactors: [],
    });
  }

  if (preferences.budgetMatch && preferences.budgetMatch.score < 1.0) {
    explanations.push({
      component: 'budgetMatch',
      weight: utilityWeights.budgetMatch,
      rawScore: preferences.budgetMatch.score,
      weightedScore: Math.round(preferences.budgetMatch.score * utilityWeights.budgetMatch * 1000) / 1000,
      explanation: preferences.budgetMatch.inStretchZone
        ? `Salary in stretch budget zone`
        : `Salary within budget`,
      contributingFactors: [],
    });
  }

  if (preferences.relatedSkillsMatch) {
    explanations.push({
      component: 'relatedSkillsMatch',
      weight: utilityWeights.relatedSkillsMatch,
      rawScore: preferences.relatedSkillsMatch.score,
      weightedScore: Math.round(preferences.relatedSkillsMatch.score * utilityWeights.relatedSkillsMatch * 1000) / 1000,
      explanation: `Has ${preferences.relatedSkillsMatch.count} additional related skills`,
      contributingFactors: [],
    });
  }

  return explanations;
}

