import { Session } from 'neo4j-driver';
import {
  EvidenceItem,
  EvidenceExplanation,
  StoryDetails,
  PerformanceDetails,
  CertificationDetails,
  TechnicalDepth,
} from '../../types/search-match-explanation.types.js';

export async function queryEngineerEvidence(
  session: Session,
  engineerId: string,
  skillIds?: string[]
): Promise<EvidenceExplanation[]> {
  const skillFilter = skillIds && skillIds.length > 0
    ? 'WHERE s.id IN $skillIds'
    : '';

  /*
   * Query evidence for an engineer's skills.
   *
   * Graph traversal:
   * (Engineer)-[:HAS]->(UserSkill)-[:FOR]->(Skill)
   * (UserSkill)-[:EVIDENCED_BY]->(InterviewStory|QuestionPerformance|Certification)
   *
   * For stories, we also fetch the optional StoryAnalysis.
   * For performances, we join to get question summary and assessment name.
   */
  const result = await session.run(
    `
    MATCH (e:Engineer {id: $engineerId})-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
    ${skillFilter}
    OPTIONAL MATCH (us)-[ev:EVIDENCED_BY]->(evidence)
    WHERE evidence:InterviewStory OR evidence:QuestionPerformance OR evidence:Certification

    // For stories, get the analysis
    OPTIONAL MATCH (evidence:InterviewStory)-[:ANALYZED_BY]->(analysis:StoryAnalysis)

    // For performances, get the question and assessment info
    OPTIONAL MATCH (evidence:QuestionPerformance)-[:FOR_QUESTION]->(q:AssessmentQuestion)
    OPTIONAL MATCH (q)<-[:HAS_QUESTION]-(a:Assessment)

    RETURN s.id AS skillId,
           s.name AS skillName,
           CASE
             WHEN evidence:InterviewStory THEN 'story'
             WHEN evidence:QuestionPerformance THEN 'performance'
             WHEN evidence:Certification THEN 'certification'
             ELSE null
           END AS evidenceType,
           evidence.id AS evidenceId,
           ev.relevanceScore AS relevanceScore,
           ev.isPrimary AS isPrimary,
           properties(evidence) AS evidenceData,
           properties(analysis) AS analysisData,
           q.summary AS questionSummary,
           q.maxScore AS questionMaxScore,
           a.name AS assessmentName
    ORDER BY s.id, ev.isPrimary DESC, ev.relevanceScore DESC
    `,
    { engineerId, skillIds: skillIds ?? [] }
  );

  const evidenceBySkill = new Map<string, EvidenceExplanation>();

  for (const record of result.records) {
    const skillId = record.get('skillId') as string;
    const skillName = record.get('skillName') as string;
    const evidenceType = record.get('evidenceType') as string | null;

    if (!evidenceBySkill.has(skillId)) {
      evidenceBySkill.set(skillId, {
        skillId,
        skillName,
        evidenceItems: [],
      });
    }

    if (evidenceType) {
      const evidenceItem = parseEvidenceItem(
        evidenceType,
        record.get('evidenceId') as string,
        record.get('relevanceScore') as number,
        record.get('isPrimary') as boolean,
        record.get('evidenceData') as Record<string, unknown>,
        record.get('analysisData') as Record<string, unknown> | null,
        record.get('questionSummary') as string | null,
        record.get('questionMaxScore') as number | null,
        record.get('assessmentName') as string | null
      );
      evidenceBySkill.get(skillId)!.evidenceItems.push(evidenceItem);
    }
  }

  return Array.from(evidenceBySkill.values());
}

function parseEvidenceItem(
  type: string,
  id: string,
  relevanceScore: number,
  isPrimary: boolean,
  data: Record<string, unknown>,
  analysisData: Record<string, unknown> | null,
  questionSummary: string | null,
  questionMaxScore: number | null,
  assessmentName: string | null
): EvidenceItem {
  switch (type) {
    case 'story':
      return {
        type: 'story',
        id,
        summary: generateStorySummary(data),
        relevanceScore,
        isPrimary,
        details: parseStoryDetails(data, analysisData),
      };
    case 'performance':
      return {
        type: 'performance',
        id,
        summary: generatePerformanceSummary(data, assessmentName),
        relevanceScore,
        isPrimary,
        details: parsePerformanceDetails(data, questionSummary, questionMaxScore, assessmentName),
      };
    case 'certification':
      return {
        type: 'certification',
        id,
        summary: generateCertificationSummary(data),
        relevanceScore,
        isPrimary,
        details: parseCertificationDetails(data),
      };
    default:
      throw new Error(`Unknown evidence type: ${type}`);
  }
}

function generateStorySummary(data: Record<string, unknown>): string {
  const action = data.action as string;
  const result = data.result as string;
  // First sentence of action + first sentence of result
  const actionSentence = action.split('.')[0];
  const resultSentence = result.split('.')[0];
  return `${actionSentence}. Result: ${resultSentence}.`;
}

function parseStoryDetails(
  data: Record<string, unknown>,
  analysisData: Record<string, unknown> | null
): StoryDetails {
  const details: StoryDetails = {
    situation: data.situation as string,
    task: data.task as string,
    action: data.action as string,
    result: data.result as string,
  };

  if (analysisData) {
    details.analysis = {
      clarityScore: analysisData.clarityScore as number,
      impactScore: analysisData.impactScore as number,
      ownershipScore: analysisData.ownershipScore as number,
      overallScore: analysisData.overallScore as number,
    };
  }

  return details;
}

function generatePerformanceSummary(
  data: Record<string, unknown>,
  assessmentName: string | null
): string {
  const score = data.score as number;
  const technicalDepth = data.technicalDepth as string;
  const assessment = assessmentName ?? 'Assessment';
  return `Scored ${Math.round(score * 100)}% on ${assessment} with ${technicalDepth}-level depth`;
}

function parsePerformanceDetails(
  data: Record<string, unknown>,
  questionSummary: string | null,
  questionMaxScore: number | null,
  assessmentName: string | null
): PerformanceDetails {
  return {
    assessmentName: assessmentName ?? 'Assessment',
    questionSummary: questionSummary ?? '',
    score: data.score as number,
    maxScore: questionMaxScore ?? 1.0,
    technicalDepth: data.technicalDepth as TechnicalDepth,
    feedback: data.feedback as string | undefined,
  };
}

function generateCertificationSummary(data: Record<string, unknown>): string {
  const name = data.name as string;
  const issuingOrg = data.issuingOrg as string;
  const verified = data.verified as boolean;
  return `${name} from ${issuingOrg}${verified ? ' (verified)' : ''}`;
}

function parseCertificationDetails(data: Record<string, unknown>): CertificationDetails {
  return {
    name: data.name as string,
    issuingOrg: data.issuingOrg as string,
    issueDate: data.issueDate as string,
    expiryDate: data.expiryDate as string | undefined,
    verified: data.verified as boolean,
  };
}
