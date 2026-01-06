/**
 * Domain Scoring Functions
 * Calculates utility scores for business and technical domain matches.
 */

import type { BusinessDomainMatch, TechnicalDomainMatch } from '../../../types/search.types.js';
import type { ResolvedBusinessDomain, ResolvedTechnicalDomain } from '../../cypher-query-builder/query-types.js';
import type {
  PreferredBusinessDomainMatchResult,
  PreferredTechnicalDomainMatchResult,
} from '../types.js';

/**
 * Calculates preferred business domain match utility with matched domain details.
 * Engineers with preferred business domain experience get a ranking boost.
 *
 * Function type: RATIO (linear proportion)
 * Formula: matched / requested, capped at max
 *
 * Rationale: Each preferred domain is an explicit user wish with equal weight.
 * Matching all requested domains = full score; partial matches scale linearly.
 */
export function calculatePreferredBusinessDomainMatch(
  matchedBusinessDomains: BusinessDomainMatch[],
  preferredBusinessDomains: ResolvedBusinessDomain[],
  maxMatch: number
): PreferredBusinessDomainMatchResult {
  if (preferredBusinessDomains.length === 0) {
    return { raw: 0, matchedDomainNames: [] };
  }

  // Filter to domains that meet the preferred criteria
  const matchingDomains = matchedBusinessDomains.filter((d) => d.meetsPreferred);

  // Normalize by the number of preferred domains, capped at maxMatch
  const matchRatio = matchingDomains.length / preferredBusinessDomains.length;
  const raw = Math.min(matchRatio * maxMatch, maxMatch);

  return {
    raw,
    matchedDomainNames: matchingDomains.map((d) => d.domainName),
  };
}

/**
 * Calculates preferred technical domain match utility with matched domain details.
 * Engineers with preferred technical domain experience get a ranking boost.
 *
 * Function type: RATIO (linear proportion)
 * Formula: matched / requested, capped at max
 *
 * Rationale: Each preferred domain is an explicit user wish with equal weight.
 * Matching all requested domains = full score; partial matches scale linearly.
 */
export function calculatePreferredTechnicalDomainMatch(
  matchedTechnicalDomains: TechnicalDomainMatch[],
  preferredTechnicalDomains: ResolvedTechnicalDomain[],
  maxMatch: number
): PreferredTechnicalDomainMatchResult {
  if (preferredTechnicalDomains.length === 0) {
    return { raw: 0, matchedDomainNames: [] };
  }

  // Filter to domains that meet the preferred criteria
  const matchingDomains = matchedTechnicalDomains.filter((d) => d.meetsPreferred);

  // Normalize by the number of preferred domains, capped at maxMatch
  const matchRatio = matchingDomains.length / preferredTechnicalDomains.length;
  const raw = Math.min(matchRatio * maxMatch, maxMatch);

  return {
    raw,
    matchedDomainNames: matchingDomains.map((d) => d.domainName),
  };
}
