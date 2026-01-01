// ============================================
// SKILL TYPES
// ============================================

export type SkillType = 'technical' | 'behavioral' | 'domain_knowledge';
export type CorrelationType = 'complementary' | 'transferable' | 'co_occurring';
export type ProficiencyLevel = 'learning' | 'proficient' | 'expert';
export type TechnicalDepth = 'surface' | 'working' | 'deep' | 'expert';
export type StartTimeline = 'immediate' | 'two_weeks' | 'one_month' | 'three_months' | 'six_months' | 'one_year';
export type AssessmentType = 'coding_challenge' | 'system_design' | 'take_home' | 'live_interview';

export interface Skill {
  id: string;
  name: string;
  skillType: SkillType;
  isCategory: boolean;
  description?: string;
}

export interface SkillCorrelation {
  fromSkillId: string;
  toSkillId: string;
  strength: number; // 0-1
  correlationType: CorrelationType;
}

export interface SkillHierarchy {
  childSkillId: string;
  parentSkillId: string;
}

export interface SkillCategoryMembership {
  skillId: string;
  categoryId: string;
}

// ============================================
// ENGINEER TYPES
// ============================================

export interface Engineer {
  id: string;
  name: string;
  email: string;
  headline: string;
  salary: number;
  yearsExperience: number;
  startTimeline: StartTimeline;
  timezone: string;
  createdAt: string;
}

export interface UserSkill {
  id: string;
  engineerId: string;
  skillId: string;
  proficiencyLevel: ProficiencyLevel;
  yearsUsed: number;
  confidenceScore: number; // 0-1
  lastValidated: string;
}

// ============================================
// MANAGER TYPES
// ============================================

export interface EngineeringManager {
  id: string;
  name: string;
  email: string;
  company: string;
  title: string;
  createdAt: string;
}

// ============================================
// EVIDENCE: INTERVIEW STORIES
// ============================================

export interface InterviewStory {
  id: string;
  engineerId: string;
  interviewId: string;
  questionPrompt: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  rawTranscript?: string;
  durationSeconds: number;
  createdAt: string;
}

export interface StoryAnalysis {
  id: string;
  storyId: string;
  analyzerModel: string;
  analyzedAt: string;
  clarityScore: number;
  impactScore: number;
  ownershipScore: number;
  overallScore: number;
  reasoning: string;
  flags: string[];
}

export interface StoryDemonstration {
  storyId: string;
  skillId: string;
  strength: number;
  notes: string;
}

// ============================================
// EVIDENCE: ASSESSMENTS
// ============================================

export interface Assessment {
  id: string;
  name: string;
  assessmentType: AssessmentType;
  description: string;
  totalQuestions: number;
  createdAt: string;
}

export interface AssessmentQuestion {
  id: string;
  assessmentId: string;
  questionNumber: number;
  summary: string;
  maxScore: number;
  evaluationCriteria: string;
}

export interface QuestionSkillTest {
  questionId: string;
  skillId: string;
  weight: number;
}

export interface AssessmentAttempt {
  id: string;
  engineerId: string;
  assessmentId: string;
  startedAt: string;
  completedAt: string;
  overallScore: number;
  overallFeedback: string;
}

export interface QuestionPerformance {
  id: string;
  attemptId: string;
  questionId: string;
  score: number;
  technicalDepth: TechnicalDepth;
  feedback: string;
  evaluatedAt: string;
}

// ============================================
// EVIDENCE: CERTIFICATIONS
// ============================================

export interface Certification {
  id: string;
  name: string;
  issuingOrg: string;
  issueDate: string;
  expiryDate?: string;
  verificationUrl?: string;
  verified: boolean;
}

export interface EngineerCertification {
  engineerId: string;
  certificationId: string;
  acquiredAt: string;
}

export interface CertificationValidation {
  certificationId: string;
  skillId: string;
}

// ============================================
// EVIDENCE LINKING
// ============================================

export interface SkillEvidence {
  userSkillId: string;
  evidenceId: string;
  evidenceType: 'story' | 'performance' | 'certification';
  relevanceScore: number;
  isPrimary: boolean;
}
