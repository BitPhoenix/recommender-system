/**
 * Domain Similarity Scoring
 *
 * Uses symmetric best-match approach with domain hierarchies.
 * Combines business and technical domains.
 *
 * Priority order (first match wins):
 *   1. Exact match → 1.0
 *   2. Siblings (share CHILD_OF parent) → 0.5
 *   3. Parent-child relationship → 0.4
 *   4. ENCOMPASSES relationship → 0.4
 *   5. No relationship → 0.0
 *
 * Years similarity is applied as a multiplier with a 0.5 floor.
 */

import type {
  DomainExperience,
  DomainGraph,
  DomainSimilarityResult,
} from '../types.js';
import { similarityParams } from '../../../config/knowledge-base/similarity.config.js';

export function calculateDomainSimilarity(
  domainGraph: DomainGraph,
  targetBusinessDomains: DomainExperience[],
  targetTechnicalDomains: DomainExperience[],
  candidateBusinessDomains: DomainExperience[],
  candidateTechnicalDomains: DomainExperience[]
): DomainSimilarityResult {
  /*
   * Combine business and technical domains for each engineer.
   * We compare all domains together rather than separately because
   * domain experience is about overall context, not domain type.
   */
  const targetDomains = [...targetBusinessDomains, ...targetTechnicalDomains];
  const candidateDomains = [...candidateBusinessDomains, ...candidateTechnicalDomains];

  if (targetDomains.length === 0 && candidateDomains.length === 0) {
    return { score: 1.0 }; // Both have no domains - perfectly similar
  }

  if (targetDomains.length === 0 || candidateDomains.length === 0) {
    return { score: 0.0 }; // One has domains, the other doesn't - not similar
  }

  // Symmetric: average both directions
  const targetToCandidateAvg = computeDomainBestMatchAverage(
    domainGraph, targetDomains, candidateDomains
  );
  const candidateToTargetAvg = computeDomainBestMatchAverage(
    domainGraph, candidateDomains, targetDomains
  );

  return { score: (targetToCandidateAvg + candidateToTargetAvg) / 2 };
}

function computeDomainBestMatchAverage(
  domainGraph: DomainGraph,
  sourceDomains: DomainExperience[],
  targetDomains: DomainExperience[]
): number {
  if (sourceDomains.length === 0) return 0;

  const { domainYearsMax, domainYearsFloor } = similarityParams;

  let totalBestMatch = 0;

  for (const source of sourceDomains) {
    let bestMatch = 0;
    for (const target of targetDomains) {
      const baseSim = computeDomainToDomainSimilarity(
        domainGraph, source.domainId, target.domainId
      );

      /*
       * Years similarity adjustment for matching/related domains.
       * Only apply when there's some base similarity.
       */
      let finalSim = baseSim;
      if (baseSim > 0) {
        const yearsDiff = Math.abs(source.years - target.years);
        const yearsSim = 1 - (yearsDiff / domainYearsMax);
        finalSim = baseSim * Math.max(domainYearsFloor, yearsSim);
      }

      bestMatch = Math.max(bestMatch, finalSim);
    }
    totalBestMatch += bestMatch;
  }

  return totalBestMatch / sourceDomains.length;
}

function computeDomainToDomainSimilarity(
  domainGraph: DomainGraph,
  domainA: string,
  domainB: string
): number {
  // Same domain = perfect match
  if (domainA === domainB) return 1.0;

  // Check sibling relationship (both are children of the same parent)
  if (shareParent(domainGraph, domainA, domainB)) return 0.5;

  // Check parent-child relationship
  if (isParentOf(domainGraph, domainA, domainB) ||
      isParentOf(domainGraph, domainB, domainA)) return 0.4;

  // Check encompasses relationship (for composite technical domains)
  if (encompasses(domainGraph, domainA, domainB) ||
      encompasses(domainGraph, domainB, domainA)) return 0.4;

  // No relationship found
  return 0.0;
}

function getNode(domainGraph: DomainGraph, domainId: string) {
  return domainGraph.businessDomains.get(domainId) ||
         domainGraph.technicalDomains.get(domainId);
}

function shareParent(domainGraph: DomainGraph, domainA: string, domainB: string): boolean {
  const nodeA = getNode(domainGraph, domainA);
  const nodeB = getNode(domainGraph, domainB);

  if (!nodeA || !nodeB) return false;
  if (!nodeA.parentId || !nodeB.parentId) return false;

  return nodeA.parentId === nodeB.parentId;
}

function isParentOf(domainGraph: DomainGraph, parent: string, child: string): boolean {
  const childNode = getNode(domainGraph, child);
  if (!childNode) return false;

  return childNode.parentId === parent;
}

function encompasses(domainGraph: DomainGraph, container: string, contained: string): boolean {
  const containedNode = getNode(domainGraph, contained);
  if (!containedNode) return false;

  return containedNode.encompassedBy.includes(container);
}
