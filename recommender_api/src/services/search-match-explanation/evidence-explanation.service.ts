import { Session } from 'neo4j-driver';
import { EvidenceExplanation } from '../../types/search-match-explanation.types.js';
import { queryEngineerEvidence } from './evidence-query.service.js';

export async function generateEvidenceExplanations(
  session: Session,
  engineerId: string,
  relevantSkillIds: string[]
): Promise<EvidenceExplanation[]> {
  /*
   * Query evidence only for skills that are relevant to the search:
   * - Required skills
   * - Preferred skills
   * - Derived skills from inference rules
   *
   * This keeps the response focused and avoids returning evidence
   * for skills not mentioned in the search criteria.
   */
  const allEvidence = await queryEngineerEvidence(session, engineerId, relevantSkillIds);

  // Filter to only include skills that have evidence
  const evidenceWithItems = allEvidence.filter((e) => e.evidenceItems.length > 0);

  // Sort by number of evidence items (most evidence first)
  evidenceWithItems.sort((a, b) => b.evidenceItems.length - a.evidenceItems.length);

  return evidenceWithItems;
}

export function summarizeEvidence(evidence: EvidenceExplanation[]): string {
  if (evidence.length === 0) {
    return 'No documented evidence for relevant skills';
  }

  const totalItems = evidence.reduce((sum, e) => sum + e.evidenceItems.length, 0);
  const skillsWithEvidence = evidence.length;

  const storyCount = evidence.reduce(
    (sum, e) => sum + e.evidenceItems.filter((i) => i.type === 'story').length,
    0
  );
  const performanceCount = evidence.reduce(
    (sum, e) => sum + e.evidenceItems.filter((i) => i.type === 'performance').length,
    0
  );
  const certCount = evidence.reduce(
    (sum, e) => sum + e.evidenceItems.filter((i) => i.type === 'certification').length,
    0
  );

  const parts: string[] = [];
  if (storyCount > 0) parts.push(`${storyCount} interview stor${storyCount === 1 ? 'y' : 'ies'}`);
  if (performanceCount > 0) parts.push(`${performanceCount} assessment performance${performanceCount === 1 ? '' : 's'}`);
  if (certCount > 0) parts.push(`${certCount} certification${certCount === 1 ? '' : 's'}`);

  return `${totalItems} evidence items across ${skillsWithEvidence} skills (${parts.join(', ')})`;
}
