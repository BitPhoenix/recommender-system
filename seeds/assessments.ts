import {
  Assessment,
  AssessmentQuestion,
  QuestionSkillTest,
  AssessmentAttempt,
  QuestionPerformance,
  Certification,
  CertificationValidation,
  SkillEvidence,
} from './types';

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

// ============================================
// ASSESSMENTS
// ============================================

export const assessments: Assessment[] = [
  {
    id: 'assess_backend',
    name: 'Backend Engineering Assessment',
    assessmentType: 'coding_challenge',
    description: 'Timed 90-minute assessment covering API design, data modeling, and system thinking',
    totalQuestions: 3,
    createdAt: daysAgo(365),
  },
  {
    id: 'assess_frontend',
    name: 'Frontend Engineering Assessment',
    assessmentType: 'coding_challenge',
    description: '60-minute assessment covering React, state management, and component design',
    totalQuestions: 3,
    createdAt: daysAgo(365),
  },
  {
    id: 'assess_system_design',
    name: 'System Design Assessment',
    assessmentType: 'system_design',
    description: '45-minute assessment on designing scalable distributed systems',
    totalQuestions: 2,
    createdAt: daysAgo(300),
  },
  {
    id: 'assess_platform',
    name: 'Platform Engineering Assessment',
    assessmentType: 'coding_challenge',
    description: '75-minute assessment covering Kubernetes, CI/CD, and infrastructure as code',
    totalQuestions: 3,
    createdAt: daysAgo(280),
  },
];

// ============================================
// ASSESSMENT QUESTIONS
// ============================================

export const assessmentQuestions: AssessmentQuestion[] = [
  // Backend assessment
  {
    id: 'q_backend_1',
    assessmentId: 'assess_backend',
    questionNumber: 1,
    summary: 'Design and implement a rate limiter API with multiple strategies',
    maxScore: 1.0,
    evaluationCriteria: 'Clean API design, strategy pattern usage, edge case handling, test coverage',
  },
  {
    id: 'q_backend_2',
    assessmentId: 'assess_backend',
    questionNumber: 2,
    summary: 'Design a data model for a multi-tenant SaaS application',
    maxScore: 1.0,
    evaluationCriteria: 'Normalization, tenant isolation, query efficiency, scalability considerations',
  },
  {
    id: 'q_backend_3',
    assessmentId: 'assess_backend',
    questionNumber: 3,
    summary: 'Debug and fix a failing async Node.js service',
    maxScore: 1.0,
    evaluationCriteria: 'Systematic debugging, root cause identification, fix quality, prevention measures',
  },
  // Frontend assessment
  {
    id: 'q_frontend_1',
    assessmentId: 'assess_frontend',
    questionNumber: 1,
    summary: 'Build a reusable data table component with sorting and filtering',
    maxScore: 1.0,
    evaluationCriteria: 'Component API design, performance optimization, accessibility, reusability',
  },
  {
    id: 'q_frontend_2',
    assessmentId: 'assess_frontend',
    questionNumber: 2,
    summary: 'Implement a form with complex validation and error handling',
    maxScore: 1.0,
    evaluationCriteria: 'State management, user experience, error handling, code organization',
  },
  {
    id: 'q_frontend_3',
    assessmentId: 'assess_frontend',
    questionNumber: 3,
    summary: 'Optimize a slow-rendering list of 10,000 items',
    maxScore: 1.0,
    evaluationCriteria: 'Virtualization, memoization, profiling, measurable improvement',
  },
  // System design assessment
  {
    id: 'q_sysdesign_1',
    assessmentId: 'assess_system_design',
    questionNumber: 1,
    summary: 'Design a real-time notification system for 10M users',
    maxScore: 1.0,
    evaluationCriteria: 'Scalability, reliability, latency considerations, technology choices, tradeoffs',
  },
  {
    id: 'q_sysdesign_2',
    assessmentId: 'assess_system_design',
    questionNumber: 2,
    summary: 'Design a URL shortener with analytics',
    maxScore: 1.0,
    evaluationCriteria: 'Data model, read/write patterns, caching strategy, analytics pipeline',
  },
  // Platform assessment
  {
    id: 'q_platform_1',
    assessmentId: 'assess_platform',
    questionNumber: 1,
    summary: 'Write a Kubernetes deployment with proper health checks and resource limits',
    maxScore: 1.0,
    evaluationCriteria: 'Best practices, resource management, health probes, rolling updates',
  },
  {
    id: 'q_platform_2',
    assessmentId: 'assess_platform',
    questionNumber: 2,
    summary: 'Create a CI/CD pipeline for a microservices application',
    maxScore: 1.0,
    evaluationCriteria: 'Build optimization, testing strategy, deployment safety, secrets management',
  },
  {
    id: 'q_platform_3',
    assessmentId: 'assess_platform',
    questionNumber: 3,
    summary: 'Debug a connectivity issue between services in a Kubernetes cluster',
    maxScore: 1.0,
    evaluationCriteria: 'Systematic approach, network understanding, tooling knowledge, resolution',
  },
];

// ============================================
// QUESTION SKILL TESTS
// ============================================

export const questionSkillTests: QuestionSkillTest[] = [
  // Backend assessment
  { questionId: 'q_backend_1', skillId: 'skill_api_design', weight: 0.9 },
  { questionId: 'q_backend_1', skillId: 'skill_nodejs', weight: 0.5 },
  { questionId: 'q_backend_1', skillId: 'skill_unit_testing', weight: 0.4 },
  { questionId: 'q_backend_2', skillId: 'skill_data_modeling', weight: 0.9 },
  { questionId: 'q_backend_2', skillId: 'skill_postgresql', weight: 0.6 },
  { questionId: 'q_backend_2', skillId: 'skill_system_design', weight: 0.5 },
  { questionId: 'q_backend_3', skillId: 'skill_debugging', weight: 0.9 },
  { questionId: 'q_backend_3', skillId: 'skill_nodejs', weight: 0.7 },
  { questionId: 'q_backend_3', skillId: 'skill_root_cause', weight: 0.6 },
  // Frontend assessment
  { questionId: 'q_frontend_1', skillId: 'skill_react', weight: 0.9 },
  { questionId: 'q_frontend_1', skillId: 'skill_typescript', weight: 0.5 },
  { questionId: 'q_frontend_1', skillId: 'skill_attention_detail', weight: 0.4 },
  { questionId: 'q_frontend_2', skillId: 'skill_react', weight: 0.8 },
  { questionId: 'q_frontend_2', skillId: 'skill_typescript', weight: 0.5 },
  { questionId: 'q_frontend_3', skillId: 'skill_react', weight: 0.7 },
  { questionId: 'q_frontend_3', skillId: 'skill_debugging', weight: 0.6 },
  { questionId: 'q_frontend_3', skillId: 'skill_analytical', weight: 0.5 },
  // System design assessment
  { questionId: 'q_sysdesign_1', skillId: 'skill_system_design', weight: 0.95 },
  { questionId: 'q_sysdesign_1', skillId: 'skill_distributed', weight: 0.8 },
  { questionId: 'q_sysdesign_1', skillId: 'skill_tradeoffs', weight: 0.6 },
  { questionId: 'q_sysdesign_2', skillId: 'skill_system_design', weight: 0.85 },
  { questionId: 'q_sysdesign_2', skillId: 'skill_data_modeling', weight: 0.7 },
  { questionId: 'q_sysdesign_2', skillId: 'skill_redis', weight: 0.5 },
  // Platform assessment
  { questionId: 'q_platform_1', skillId: 'skill_kubernetes', weight: 0.95 },
  { questionId: 'q_platform_1', skillId: 'skill_docker', weight: 0.5 },
  { questionId: 'q_platform_2', skillId: 'skill_github_actions', weight: 0.8 },
  { questionId: 'q_platform_2', skillId: 'skill_docker', weight: 0.6 },
  { questionId: 'q_platform_2', skillId: 'skill_terraform', weight: 0.5 },
  { questionId: 'q_platform_3', skillId: 'skill_kubernetes', weight: 0.8 },
  { questionId: 'q_platform_3', skillId: 'skill_debugging', weight: 0.7 },
  { questionId: 'q_platform_3', skillId: 'skill_monitoring', weight: 0.5 },
];

// ============================================
// ASSESSMENT ATTEMPTS
// ============================================

export const assessmentAttempts: AssessmentAttempt[] = [
  {
    id: 'attempt_priya_backend',
    engineerId: 'eng_priya',
    assessmentId: 'assess_backend',
    startedAt: daysAgo(32),
    completedAt: daysAgo(32),
    overallScore: 0.89,
    overallFeedback: 'Strong performance across all sections. Exceptional API design skills.',
  },
  {
    id: 'attempt_marcus_frontend',
    engineerId: 'eng_marcus',
    assessmentId: 'assess_frontend',
    startedAt: daysAgo(28),
    completedAt: daysAgo(28),
    overallScore: 0.85,
    overallFeedback: 'Solid React skills with good attention to component design.',
  },
  {
    id: 'attempt_sofia_platform',
    engineerId: 'eng_sofia',
    assessmentId: 'assess_platform',
    startedAt: daysAgo(38),
    completedAt: daysAgo(38),
    overallScore: 0.92,
    overallFeedback: 'Excellent Kubernetes and infrastructure knowledge. Best practices throughout.',
  },
  {
    id: 'attempt_james_sysdesign',
    engineerId: 'eng_james',
    assessmentId: 'assess_system_design',
    startedAt: daysAgo(22),
    completedAt: daysAgo(22),
    overallScore: 0.96,
    overallFeedback: 'Outstanding system design skills. Deep understanding of distributed systems.',
  },
  {
    id: 'attempt_emily_frontend',
    engineerId: 'eng_emily',
    assessmentId: 'assess_frontend',
    startedAt: daysAgo(15),
    completedAt: daysAgo(15),
    overallScore: 0.82,
    overallFeedback: 'Strong component design and accessibility awareness.',
  },
];

// ============================================
// QUESTION PERFORMANCES
// ============================================

export const questionPerformances: QuestionPerformance[] = [
  // Priya - Backend
  {
    id: 'perf_priya_q1',
    attemptId: 'attempt_priya_backend',
    questionId: 'q_backend_1',
    score: 0.92,
    technicalDepth: 'expert',
    feedback: 'Excellent API design with clean separation of concerns. Implemented multiple strategies.',
    evaluatedAt: daysAgo(31),
  },
  {
    id: 'perf_priya_q2',
    attemptId: 'attempt_priya_backend',
    questionId: 'q_backend_2',
    score: 0.85,
    technicalDepth: 'deep',
    feedback: 'Solid multi-tenant design. Could have explored sharding strategies more.',
    evaluatedAt: daysAgo(31),
  },
  {
    id: 'perf_priya_q3',
    attemptId: 'attempt_priya_backend',
    questionId: 'q_backend_3',
    score: 0.90,
    technicalDepth: 'expert',
    feedback: 'Quickly identified the race condition. Systematic debugging approach.',
    evaluatedAt: daysAgo(31),
  },
  // Marcus - Frontend
  {
    id: 'perf_marcus_q1',
    attemptId: 'attempt_marcus_frontend',
    questionId: 'q_frontend_1',
    score: 0.88,
    technicalDepth: 'deep',
    feedback: 'Well-designed component API with good TypeScript usage. Accessible.',
    evaluatedAt: daysAgo(27),
  },
  {
    id: 'perf_marcus_q2',
    attemptId: 'attempt_marcus_frontend',
    questionId: 'q_frontend_2',
    score: 0.85,
    technicalDepth: 'deep',
    feedback: 'Clean form implementation with proper validation patterns.',
    evaluatedAt: daysAgo(27),
  },
  {
    id: 'perf_marcus_q3',
    attemptId: 'attempt_marcus_frontend',
    questionId: 'q_frontend_3',
    score: 0.82,
    technicalDepth: 'working',
    feedback: 'Implemented virtualization but could optimize further with memoization.',
    evaluatedAt: daysAgo(27),
  },
  // Sofia - Platform
  {
    id: 'perf_sofia_q1',
    attemptId: 'attempt_sofia_platform',
    questionId: 'q_platform_1',
    score: 0.95,
    technicalDepth: 'expert',
    feedback: 'Production-ready deployment with all best practices.',
    evaluatedAt: daysAgo(37),
  },
  {
    id: 'perf_sofia_q2',
    attemptId: 'attempt_sofia_platform',
    questionId: 'q_platform_2',
    score: 0.90,
    technicalDepth: 'expert',
    feedback: 'Comprehensive CI/CD pipeline with proper security considerations.',
    evaluatedAt: daysAgo(37),
  },
  {
    id: 'perf_sofia_q3',
    attemptId: 'attempt_sofia_platform',
    questionId: 'q_platform_3',
    score: 0.91,
    technicalDepth: 'expert',
    feedback: 'Methodical debugging with good use of kubectl and network tools.',
    evaluatedAt: daysAgo(37),
  },
  // James - System Design
  {
    id: 'perf_james_q1',
    attemptId: 'attempt_james_sysdesign',
    questionId: 'q_sysdesign_1',
    score: 0.97,
    technicalDepth: 'expert',
    feedback: 'Exceptional design with clear scalability path. Excellent tradeoff analysis.',
    evaluatedAt: daysAgo(21),
  },
  {
    id: 'perf_james_q2',
    attemptId: 'attempt_james_sysdesign',
    questionId: 'q_sysdesign_2',
    score: 0.95,
    technicalDepth: 'expert',
    feedback: 'Comprehensive solution with analytics pipeline. Good caching strategy.',
    evaluatedAt: daysAgo(21),
  },
  // Emily - Frontend
  {
    id: 'perf_emily_q1',
    attemptId: 'attempt_emily_frontend',
    questionId: 'q_frontend_1',
    score: 0.85,
    technicalDepth: 'deep',
    feedback: 'Good component structure with accessibility focus.',
    evaluatedAt: daysAgo(14),
  },
  {
    id: 'perf_emily_q2',
    attemptId: 'attempt_emily_frontend',
    questionId: 'q_frontend_2',
    score: 0.82,
    technicalDepth: 'working',
    feedback: 'Solid form handling. Error messages could be more user-friendly.',
    evaluatedAt: daysAgo(14),
  },
  {
    id: 'perf_emily_q3',
    attemptId: 'attempt_emily_frontend',
    questionId: 'q_frontend_3',
    score: 0.79,
    technicalDepth: 'working',
    feedback: 'Basic virtualization implemented. Good debugging process.',
    evaluatedAt: daysAgo(14),
  },
];

// ============================================
// CERTIFICATIONS
// ============================================

export const certifications: Certification[] = [
  {
    id: 'cert_aws_saa',
    name: 'AWS Solutions Architect Associate',
    issuingOrg: 'Amazon Web Services',
    issueDate: daysAgo(400),
    expiryDate: daysAgo(-695), // expires in ~2 years
    verificationUrl: 'https://aws.amazon.com/verification',
    verified: true,
  },
  {
    id: 'cert_aws_sap',
    name: 'AWS Solutions Architect Professional',
    issuingOrg: 'Amazon Web Services',
    issueDate: daysAgo(200),
    expiryDate: daysAgo(-895),
    verificationUrl: 'https://aws.amazon.com/verification',
    verified: true,
  },
  {
    id: 'cert_cka',
    name: 'Certified Kubernetes Administrator',
    issuingOrg: 'Cloud Native Computing Foundation',
    issueDate: daysAgo(300),
    expiryDate: daysAgo(-795),
    verificationUrl: 'https://training.linuxfoundation.org/certification/verify',
    verified: true,
  },
  {
    id: 'cert_ckad',
    name: 'Certified Kubernetes Application Developer',
    issuingOrg: 'Cloud Native Computing Foundation',
    issueDate: daysAgo(350),
    expiryDate: daysAgo(-745),
    verificationUrl: 'https://training.linuxfoundation.org/certification/verify',
    verified: true,
  },
  {
    id: 'cert_terraform',
    name: 'HashiCorp Certified: Terraform Associate',
    issuingOrg: 'HashiCorp',
    issueDate: daysAgo(250),
    expiryDate: daysAgo(-845),
    verificationUrl: 'https://www.credly.com/verify',
    verified: true,
  },
];

// ============================================
// CERTIFICATION VALIDATIONS (which skills they validate)
// ============================================

export const certificationValidations: CertificationValidation[] = [
  { certificationId: 'cert_aws_saa', skillId: 'skill_aws' },
  { certificationId: 'cert_aws_saa', skillId: 'skill_system_design' },
  { certificationId: 'cert_aws_sap', skillId: 'skill_aws' },
  { certificationId: 'cert_aws_sap', skillId: 'skill_system_design' },
  { certificationId: 'cert_aws_sap', skillId: 'skill_distributed' },
  { certificationId: 'cert_cka', skillId: 'skill_kubernetes' },
  { certificationId: 'cert_cka', skillId: 'skill_docker' },
  { certificationId: 'cert_ckad', skillId: 'skill_kubernetes' },
  { certificationId: 'cert_ckad', skillId: 'skill_docker' },
  { certificationId: 'cert_terraform', skillId: 'skill_terraform' },
  { certificationId: 'cert_terraform', skillId: 'skill_aws' },
];

// ============================================
// ENGINEER CERTIFICATIONS (who has what)
// ============================================

export const engineerCertifications: { engineerId: string; certificationId: string }[] = [
  { engineerId: 'eng_priya', certificationId: 'cert_aws_saa' },
  { engineerId: 'eng_sofia', certificationId: 'cert_cka' },
  { engineerId: 'eng_sofia', certificationId: 'cert_ckad' },
  { engineerId: 'eng_sofia', certificationId: 'cert_terraform' },
  { engineerId: 'eng_sofia', certificationId: 'cert_aws_saa' },
  { engineerId: 'eng_james', certificationId: 'cert_aws_sap' },
];

// ============================================
// SKILL EVIDENCE (links UserSkill to evidence)
// ============================================

export const skillEvidence: SkillEvidence[] = [
  // Priya's evidence
  { userSkillId: 'es_priya_api_design', evidenceId: 'story_priya_1', evidenceType: 'story', relevanceScore: 0.95, isPrimary: true },
  { userSkillId: 'es_priya_api_design', evidenceId: 'perf_priya_q1', evidenceType: 'performance', relevanceScore: 0.90, isPrimary: false },
  { userSkillId: 'es_priya_microservices', evidenceId: 'story_priya_1', evidenceType: 'story', relevanceScore: 0.92, isPrimary: true },
  { userSkillId: 'es_priya_tech_leadership', evidenceId: 'story_priya_1', evidenceType: 'story', relevanceScore: 0.88, isPrimary: true },
  { userSkillId: 'es_priya_mentorship', evidenceId: 'story_priya_1', evidenceType: 'story', relevanceScore: 0.82, isPrimary: true },
  { userSkillId: 'es_priya_aws', evidenceId: 'cert_aws_saa', evidenceType: 'certification', relevanceScore: 0.90, isPrimary: true },

  // Marcus's evidence
  { userSkillId: 'es_marcus_ownership', evidenceId: 'story_marcus_1', evidenceType: 'story', relevanceScore: 0.92, isPrimary: true },
  { userSkillId: 'es_marcus_react', evidenceId: 'perf_marcus_q1', evidenceType: 'performance', relevanceScore: 0.88, isPrimary: true },
  { userSkillId: 'es_marcus_react', evidenceId: 'story_marcus_1', evidenceType: 'story', relevanceScore: 0.80, isPrimary: false },
  { userSkillId: 'es_marcus_graphql', evidenceId: 'story_marcus_1', evidenceType: 'story', relevanceScore: 0.78, isPrimary: true },

  // Sofia's evidence
  { userSkillId: 'es_sofia_kubernetes', evidenceId: 'story_sofia_1', evidenceType: 'story', relevanceScore: 0.92, isPrimary: false },
  { userSkillId: 'es_sofia_kubernetes', evidenceId: 'perf_sofia_q1', evidenceType: 'performance', relevanceScore: 0.95, isPrimary: true },
  { userSkillId: 'es_sofia_kubernetes', evidenceId: 'cert_cka', evidenceType: 'certification', relevanceScore: 0.90, isPrimary: false },
  { userSkillId: 'es_sofia_debugging', evidenceId: 'story_sofia_2', evidenceType: 'story', relevanceScore: 0.92, isPrimary: true },
  { userSkillId: 'es_sofia_monitoring', evidenceId: 'story_sofia_1', evidenceType: 'story', relevanceScore: 0.88, isPrimary: true },
  { userSkillId: 'es_sofia_terraform', evidenceId: 'cert_terraform', evidenceType: 'certification', relevanceScore: 0.95, isPrimary: true },

  // James's evidence
  { userSkillId: 'es_james_distributed', evidenceId: 'story_james_1', evidenceType: 'story', relevanceScore: 0.95, isPrimary: true },
  { userSkillId: 'es_james_system_design', evidenceId: 'story_james_1', evidenceType: 'story', relevanceScore: 0.94, isPrimary: false },
  { userSkillId: 'es_james_system_design', evidenceId: 'perf_james_q1', evidenceType: 'performance', relevanceScore: 0.97, isPrimary: true },
  { userSkillId: 'es_james_mentorship', evidenceId: 'story_james_2', evidenceType: 'story', relevanceScore: 0.92, isPrimary: true },
  { userSkillId: 'es_james_tech_leadership', evidenceId: 'story_james_1', evidenceType: 'story', relevanceScore: 0.90, isPrimary: true },
  { userSkillId: 'es_james_aws', evidenceId: 'cert_aws_sap', evidenceType: 'certification', relevanceScore: 0.90, isPrimary: true },

  // Emily's evidence
  { userSkillId: 'es_emily_react', evidenceId: 'perf_emily_q1', evidenceType: 'performance', relevanceScore: 0.85, isPrimary: true },
  { userSkillId: 'es_emily_react', evidenceId: 'story_emily_1', evidenceType: 'story', relevanceScore: 0.80, isPrimary: false },
  { userSkillId: 'es_emily_cross_functional', evidenceId: 'story_emily_1', evidenceType: 'story', relevanceScore: 0.92, isPrimary: true },
  { userSkillId: 'es_emily_curiosity', evidenceId: 'story_emily_1', evidenceType: 'story', relevanceScore: 0.85, isPrimary: true },
];
