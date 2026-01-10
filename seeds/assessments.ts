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
  {
    id: 'assess_fullstack',
    name: 'Full Stack Engineering Assessment',
    assessmentType: 'coding_challenge',
    description: '90-minute assessment covering end-to-end feature development',
    totalQuestions: 3,
    createdAt: daysAgo(250),
  },
  {
    id: 'assess_ml',
    name: 'ML Engineering Assessment',
    assessmentType: 'take_home',
    description: '24-hour take-home covering model development and deployment',
    totalQuestions: 2,
    createdAt: daysAgo(200),
  },
  {
    id: 'assess_mobile',
    name: 'Mobile Engineering Assessment',
    assessmentType: 'coding_challenge',
    description: '75-minute assessment covering cross-platform mobile development',
    totalQuestions: 3,
    createdAt: daysAgo(180),
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
  // Full Stack assessment
  {
    id: 'q_fullstack_1',
    assessmentId: 'assess_fullstack',
    questionNumber: 1,
    summary: 'Build a real-time collaborative feature with frontend and backend components',
    maxScore: 1.0,
    evaluationCriteria: 'End-to-end implementation, WebSocket handling, state synchronization, error handling',
  },
  {
    id: 'q_fullstack_2',
    assessmentId: 'assess_fullstack',
    questionNumber: 2,
    summary: 'Design and implement an authentication flow with OAuth and session management',
    maxScore: 1.0,
    evaluationCriteria: 'Security best practices, token handling, frontend/backend coordination',
  },
  {
    id: 'q_fullstack_3',
    assessmentId: 'assess_fullstack',
    questionNumber: 3,
    summary: 'Build a data dashboard with server-side rendering and client-side updates',
    maxScore: 1.0,
    evaluationCriteria: 'SSR implementation, hydration, performance optimization, data fetching patterns',
  },
  // ML assessment
  {
    id: 'q_ml_1',
    assessmentId: 'assess_ml',
    questionNumber: 1,
    summary: 'Build and deploy a classification model for text sentiment analysis',
    maxScore: 1.0,
    evaluationCriteria: 'Data preprocessing, model selection, evaluation metrics, deployment readiness',
  },
  {
    id: 'q_ml_2',
    assessmentId: 'assess_ml',
    questionNumber: 2,
    summary: 'Design an ML pipeline with feature engineering and model monitoring',
    maxScore: 1.0,
    evaluationCriteria: 'Pipeline architecture, feature store design, drift detection, A/B testing',
  },
  // Mobile assessment
  {
    id: 'q_mobile_1',
    assessmentId: 'assess_mobile',
    questionNumber: 1,
    summary: 'Build a cross-platform list with pull-to-refresh and infinite scroll',
    maxScore: 1.0,
    evaluationCriteria: 'Performance optimization, native feel, memory management, accessibility',
  },
  {
    id: 'q_mobile_2',
    assessmentId: 'assess_mobile',
    questionNumber: 2,
    summary: 'Implement offline-first data sync with conflict resolution',
    maxScore: 1.0,
    evaluationCriteria: 'Local storage, sync strategy, conflict handling, network status awareness',
  },
  {
    id: 'q_mobile_3',
    assessmentId: 'assess_mobile',
    questionNumber: 3,
    summary: 'Build a camera-based feature with image processing',
    maxScore: 1.0,
    evaluationCriteria: 'Native module integration, permissions handling, image optimization',
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
  // Full Stack assessment
  { questionId: 'q_fullstack_1', skillId: 'skill_nodejs', weight: 0.8 },
  { questionId: 'q_fullstack_1', skillId: 'skill_react', weight: 0.8 },
  { questionId: 'q_fullstack_1', skillId: 'skill_typescript', weight: 0.5 },
  { questionId: 'q_fullstack_2', skillId: 'skill_nodejs', weight: 0.7 },
  { questionId: 'q_fullstack_2', skillId: 'skill_api_design', weight: 0.8 },
  { questionId: 'q_fullstack_2', skillId: 'skill_react', weight: 0.6 },
  { questionId: 'q_fullstack_3', skillId: 'skill_react', weight: 0.9 },
  { questionId: 'q_fullstack_3', skillId: 'skill_nextjs', weight: 0.7 },
  { questionId: 'q_fullstack_3', skillId: 'skill_system_design', weight: 0.5 },
  // ML assessment
  { questionId: 'q_ml_1', skillId: 'skill_tensorflow', weight: 0.9 },
  { questionId: 'q_ml_1', skillId: 'skill_python', weight: 0.7 },
  { questionId: 'q_ml_1', skillId: 'skill_analytical', weight: 0.6 },
  { questionId: 'q_ml_2', skillId: 'skill_spark', weight: 0.8 },
  { questionId: 'q_ml_2', skillId: 'skill_system_design', weight: 0.7 },
  { questionId: 'q_ml_2', skillId: 'skill_monitoring', weight: 0.5 },
  // Mobile assessment
  { questionId: 'q_mobile_1', skillId: 'skill_react', weight: 0.8 },
  { questionId: 'q_mobile_1', skillId: 'skill_typescript', weight: 0.5 },
  { questionId: 'q_mobile_1', skillId: 'skill_attention_detail', weight: 0.4 },
  { questionId: 'q_mobile_2', skillId: 'skill_react', weight: 0.7 },
  { questionId: 'q_mobile_2', skillId: 'skill_api_design', weight: 0.6 },
  { questionId: 'q_mobile_2', skillId: 'skill_system_design', weight: 0.5 },
  { questionId: 'q_mobile_3', skillId: 'skill_react', weight: 0.7 },
  { questionId: 'q_mobile_3', skillId: 'skill_debugging', weight: 0.5 },
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

  // ============================================
  // Junior Engineer Attempts (0.70-0.82 scores)
  // ============================================
  {
    id: 'attempt_maya_frontend',
    engineerId: 'eng_maya',
    assessmentId: 'assess_frontend',
    startedAt: daysAgo(45),
    completedAt: daysAgo(45),
    overallScore: 0.78,
    overallFeedback: 'Good understanding of React fundamentals. Shows promise in component design.',
  },
  {
    id: 'attempt_kevin_backend',
    engineerId: 'eng_kevin',
    assessmentId: 'assess_backend',
    startedAt: daysAgo(50),
    completedAt: daysAgo(50),
    overallScore: 0.76,
    overallFeedback: 'Solid Python skills. Good systematic debugging approach.',
  },
  {
    id: 'attempt_jordan_frontend',
    engineerId: 'eng_jordan',
    assessmentId: 'assess_frontend',
    startedAt: daysAgo(55),
    completedAt: daysAgo(55),
    overallScore: 0.74,
    overallFeedback: 'Competent with React basics. Good attention to detail in UI work.',
  },
  {
    id: 'attempt_carlos_fullstack',
    engineerId: 'eng_carlos',
    assessmentId: 'assess_fullstack',
    startedAt: daysAgo(48),
    completedAt: daysAgo(48),
    overallScore: 0.77,
    overallFeedback: 'Good end-to-end understanding. Strong ownership mentality.',
  },
  {
    id: 'attempt_ashley_frontend',
    engineerId: 'eng_ashley',
    assessmentId: 'assess_frontend',
    startedAt: daysAgo(18),
    completedAt: daysAgo(18),
    overallScore: 0.72,
    overallFeedback: 'Quick learner with good fundamentals. Demonstrates curiosity.',
  },
  {
    id: 'attempt_tyler_backend',
    engineerId: 'eng_tyler',
    assessmentId: 'assess_backend',
    startedAt: daysAgo(30),
    completedAt: daysAgo(30),
    overallScore: 0.75,
    overallFeedback: 'Strong Java foundation. Good API design instincts.',
  },

  // ============================================
  // Mid-Level Engineer Attempts (0.78-0.88 scores)
  // ============================================
  {
    id: 'attempt_rachel_frontend',
    engineerId: 'eng_rachel',
    assessmentId: 'assess_frontend',
    startedAt: daysAgo(60),
    completedAt: daysAgo(60),
    overallScore: 0.88,
    overallFeedback: 'Exceptional performance for experience level. Strong React optimization skills.',
  },
  {
    id: 'attempt_lisa_backend',
    engineerId: 'eng_lisa',
    assessmentId: 'assess_backend',
    startedAt: daysAgo(75),
    completedAt: daysAgo(75),
    overallScore: 0.86,
    overallFeedback: 'Excellent distributed systems understanding. Good system design thinking.',
  },
  {
    id: 'attempt_zoe_fullstack',
    engineerId: 'eng_zoe',
    assessmentId: 'assess_fullstack',
    startedAt: daysAgo(65),
    completedAt: daysAgo(65),
    overallScore: 0.84,
    overallFeedback: 'Well-rounded full stack skills. Good product thinking.',
  },
  {
    id: 'attempt_david_backend',
    engineerId: 'eng_david',
    assessmentId: 'assess_backend',
    startedAt: daysAgo(55),
    completedAt: daysAgo(55),
    overallScore: 0.82,
    overallFeedback: 'Strong Python and data modeling skills. Good healthcare domain knowledge.',
  },
  {
    id: 'attempt_mohammed_platform',
    engineerId: 'eng_mohammed',
    assessmentId: 'assess_platform',
    startedAt: daysAgo(58),
    completedAt: daysAgo(58),
    overallScore: 0.85,
    overallFeedback: 'Solid DevOps foundation. Good Kubernetes understanding.',
  },
  {
    id: 'attempt_aisha_ml',
    engineerId: 'eng_aisha',
    assessmentId: 'assess_ml',
    startedAt: daysAgo(52),
    completedAt: daysAgo(51),
    overallScore: 0.86,
    overallFeedback: 'Strong ML fundamentals. Good model evaluation skills.',
  },
  {
    id: 'attempt_ryan_mobile',
    engineerId: 'eng_ryan',
    assessmentId: 'assess_mobile',
    startedAt: daysAgo(45),
    completedAt: daysAgo(45),
    overallScore: 0.83,
    overallFeedback: 'Good mobile development skills. Strong attention to UX.',
  },
  {
    id: 'attempt_emma_frontend',
    engineerId: 'eng_emma',
    assessmentId: 'assess_frontend',
    startedAt: daysAgo(70),
    completedAt: daysAgo(70),
    overallScore: 0.84,
    overallFeedback: 'Strong React skills with good UX focus.',
  },

  // ============================================
  // Senior Engineer Attempts (0.82-0.92 scores)
  // ============================================
  {
    id: 'attempt_greg_backend',
    engineerId: 'eng_greg',
    assessmentId: 'assess_backend',
    startedAt: daysAgo(120),
    completedAt: daysAgo(120),
    overallScore: 0.82,
    overallFeedback: 'Competent backend skills. Could push more on optimization.',
  },
  {
    id: 'attempt_natasha_fullstack',
    engineerId: 'eng_natasha',
    assessmentId: 'assess_fullstack',
    startedAt: daysAgo(95),
    completedAt: daysAgo(95),
    overallScore: 0.84,
    overallFeedback: 'Solid full stack knowledge. Good at shipping features.',
  },
  {
    id: 'attempt_nathan_ml',
    engineerId: 'eng_nathan',
    assessmentId: 'assess_ml',
    startedAt: daysAgo(85),
    completedAt: daysAgo(84),
    overallScore: 0.92,
    overallFeedback: 'Excellent ML architecture skills. Deep TensorFlow expertise.',
  },
  {
    id: 'attempt_wei_backend',
    engineerId: 'eng_wei',
    assessmentId: 'assess_backend',
    startedAt: daysAgo(90),
    completedAt: daysAgo(90),
    overallScore: 0.90,
    overallFeedback: 'Strong data engineering skills. Excellent Spark optimization.',
  },
  {
    id: 'attempt_derek_fullstack',
    engineerId: 'eng_derek',
    assessmentId: 'assess_fullstack',
    startedAt: daysAgo(80),
    completedAt: daysAgo(80),
    overallScore: 0.88,
    overallFeedback: 'Well-rounded generalist. Strong startup experience shows.',
  },
  {
    id: 'attempt_takeshi_backend',
    engineerId: 'eng_takeshi',
    assessmentId: 'assess_backend',
    startedAt: daysAgo(100),
    completedAt: daysAgo(100),
    overallScore: 0.89,
    overallFeedback: 'Excellent backend skills. Strong distributed systems knowledge.',
  },
  {
    id: 'attempt_takeshi_sysdesign',
    engineerId: 'eng_takeshi',
    assessmentId: 'assess_system_design',
    startedAt: daysAgo(95),
    completedAt: daysAgo(95),
    overallScore: 0.87,
    overallFeedback: 'Good system design thinking. Strong scalability considerations.',
  },
  {
    id: 'attempt_sarah_frontend',
    engineerId: 'eng_sarah',
    assessmentId: 'assess_frontend',
    startedAt: daysAgo(75),
    completedAt: daysAgo(75),
    overallScore: 0.88,
    overallFeedback: 'Excellent React skills. Strong design system experience.',
  },
  {
    id: 'attempt_ravi_fullstack',
    engineerId: 'eng_ravi',
    assessmentId: 'assess_fullstack',
    startedAt: daysAgo(85),
    completedAt: daysAgo(85),
    overallScore: 0.86,
    overallFeedback: 'Strong full stack with healthcare domain expertise.',
  },
  {
    id: 'attempt_olivia_ml',
    engineerId: 'eng_olivia',
    assessmentId: 'assess_ml',
    startedAt: daysAgo(110),
    completedAt: daysAgo(109),
    overallScore: 0.90,
    overallFeedback: 'Strong ML skills. Excellent healthcare AI understanding.',
  },
  {
    id: 'attempt_lucas_platform',
    engineerId: 'eng_lucas',
    assessmentId: 'assess_platform',
    startedAt: daysAgo(105),
    completedAt: daysAgo(105),
    overallScore: 0.88,
    overallFeedback: 'Excellent cloud infrastructure skills. Strong AWS expertise.',
  },

  // ============================================
  // Staff Engineer Attempts (0.88-0.95 scores)
  // ============================================
  {
    id: 'attempt_anika_platform',
    engineerId: 'eng_anika',
    assessmentId: 'assess_platform',
    startedAt: daysAgo(130),
    completedAt: daysAgo(130),
    overallScore: 0.94,
    overallFeedback: 'Outstanding platform engineering skills. Expert Kafka and Kubernetes.',
  },
  {
    id: 'attempt_anika_sysdesign',
    engineerId: 'eng_anika',
    assessmentId: 'assess_system_design',
    startedAt: daysAgo(125),
    completedAt: daysAgo(125),
    overallScore: 0.92,
    overallFeedback: 'Excellent distributed system design. Clear tradeoff analysis.',
  },
  {
    id: 'attempt_alex_backend',
    engineerId: 'eng_alex',
    assessmentId: 'assess_backend',
    startedAt: daysAgo(140),
    completedAt: daysAgo(140),
    overallScore: 0.92,
    overallFeedback: 'Expert backend skills. Deep Java and distributed systems knowledge.',
  },
  {
    id: 'attempt_alex_sysdesign',
    engineerId: 'eng_alex',
    assessmentId: 'assess_system_design',
    startedAt: daysAgo(135),
    completedAt: daysAgo(135),
    overallScore: 0.90,
    overallFeedback: 'Strong system design with excellent scalability thinking.',
  },
  {
    id: 'attempt_dmitri_ml',
    engineerId: 'eng_dmitri',
    assessmentId: 'assess_ml',
    startedAt: daysAgo(150),
    completedAt: daysAgo(149),
    overallScore: 0.94,
    overallFeedback: 'Outstanding ML skills. Expert-level model development and deployment.',
  },
  {
    id: 'attempt_jennifer_frontend',
    engineerId: 'eng_jennifer',
    assessmentId: 'assess_frontend',
    startedAt: daysAgo(118),
    completedAt: daysAgo(118),
    overallScore: 0.92,
    overallFeedback: 'Excellent frontend architecture. Strong performance optimization.',
  },
  {
    id: 'attempt_michael_platform',
    engineerId: 'eng_michael',
    assessmentId: 'assess_platform',
    startedAt: daysAgo(155),
    completedAt: daysAgo(155),
    overallScore: 0.94,
    overallFeedback: 'Expert DevOps skills. Outstanding AWS and infrastructure knowledge.',
  },
  {
    id: 'attempt_sanjay_backend',
    engineerId: 'eng_sanjay',
    assessmentId: 'assess_backend',
    startedAt: daysAgo(128),
    completedAt: daysAgo(128),
    overallScore: 0.91,
    overallFeedback: 'Excellent data engineering skills. Strong Spark and Kafka expertise.',
  },
  {
    id: 'attempt_christine_fullstack',
    engineerId: 'eng_christine',
    assessmentId: 'assess_fullstack',
    startedAt: daysAgo(115),
    completedAt: daysAgo(115),
    overallScore: 0.90,
    overallFeedback: 'Strong full stack with excellent healthcare domain knowledge.',
  },
  {
    id: 'attempt_hassan_platform',
    engineerId: 'eng_hassan',
    assessmentId: 'assess_platform',
    startedAt: daysAgo(145),
    completedAt: daysAgo(145),
    overallScore: 0.93,
    overallFeedback: 'Excellent security-focused platform engineering. Strong AWS security.',
  },

  // ============================================
  // Principal Engineer Attempts (0.94-0.98 scores)
  // ============================================
  {
    id: 'attempt_victoria_sysdesign',
    engineerId: 'eng_victoria',
    assessmentId: 'assess_system_design',
    startedAt: daysAgo(180),
    completedAt: daysAgo(180),
    overallScore: 0.97,
    overallFeedback: 'Outstanding architectural thinking. Expert-level distributed systems design.',
  },
  {
    id: 'attempt_robert_ml',
    engineerId: 'eng_robert',
    assessmentId: 'assess_ml',
    startedAt: daysAgo(200),
    completedAt: daysAgo(199),
    overallScore: 0.98,
    overallFeedback: 'Exceptional ML architecture skills. Industry-leading platform design.',
  },
  {
    id: 'attempt_elena_sysdesign',
    engineerId: 'eng_elena',
    assessmentId: 'assess_system_design',
    startedAt: daysAgo(185),
    completedAt: daysAgo(185),
    overallScore: 0.96,
    overallFeedback: 'Expert security architecture. Outstanding zero-trust design capabilities.',
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

  // ============================================
  // Junior Engineer Performances
  // ============================================

  // Maya - Frontend
  { id: 'perf_maya_q1', attemptId: 'attempt_maya_frontend', questionId: 'q_frontend_1', score: 0.80, technicalDepth: 'working', feedback: 'Good component structure for experience level.', evaluatedAt: daysAgo(44) },
  { id: 'perf_maya_q2', attemptId: 'attempt_maya_frontend', questionId: 'q_frontend_2', score: 0.76, technicalDepth: 'working', feedback: 'Functional form with basic validation.', evaluatedAt: daysAgo(44) },

  // Kevin - Backend
  { id: 'perf_kevin_q1', attemptId: 'attempt_kevin_backend', questionId: 'q_backend_1', score: 0.78, technicalDepth: 'working', feedback: 'Good API structure with basic patterns.', evaluatedAt: daysAgo(49) },
  { id: 'perf_kevin_q2', attemptId: 'attempt_kevin_backend', questionId: 'q_backend_2', score: 0.74, technicalDepth: 'working', feedback: 'Reasonable data model design.', evaluatedAt: daysAgo(49) },

  // Jordan - Frontend
  { id: 'perf_jordan_q1', attemptId: 'attempt_jordan_frontend', questionId: 'q_frontend_1', score: 0.75, technicalDepth: 'working', feedback: 'Functional component with room for improvement.', evaluatedAt: daysAgo(54) },
  { id: 'perf_jordan_q2', attemptId: 'attempt_jordan_frontend', questionId: 'q_frontend_2', score: 0.73, technicalDepth: 'working', feedback: 'Basic form implementation.', evaluatedAt: daysAgo(54) },

  // Carlos - Full Stack
  { id: 'perf_carlos_q1', attemptId: 'attempt_carlos_fullstack', questionId: 'q_fullstack_1', score: 0.78, technicalDepth: 'working', feedback: 'Good end-to-end implementation.', evaluatedAt: daysAgo(47) },
  { id: 'perf_carlos_q2', attemptId: 'attempt_carlos_fullstack', questionId: 'q_fullstack_2', score: 0.76, technicalDepth: 'working', feedback: 'Functional auth flow with basic security.', evaluatedAt: daysAgo(47) },

  // Ashley - Frontend
  { id: 'perf_ashley_q1', attemptId: 'attempt_ashley_frontend', questionId: 'q_frontend_1', score: 0.74, technicalDepth: 'working', feedback: 'Good basics, shows learning potential.', evaluatedAt: daysAgo(17) },
  { id: 'perf_ashley_q2', attemptId: 'attempt_ashley_frontend', questionId: 'q_frontend_2', score: 0.70, technicalDepth: 'surface', feedback: 'Basic implementation with room to grow.', evaluatedAt: daysAgo(17) },

  // Tyler - Backend
  { id: 'perf_tyler_q1', attemptId: 'attempt_tyler_backend', questionId: 'q_backend_1', score: 0.76, technicalDepth: 'working', feedback: 'Solid Java implementation.', evaluatedAt: daysAgo(29) },
  { id: 'perf_tyler_q2', attemptId: 'attempt_tyler_backend', questionId: 'q_backend_2', score: 0.74, technicalDepth: 'working', feedback: 'Good data model basics.', evaluatedAt: daysAgo(29) },

  // ============================================
  // Mid-Level Engineer Performances
  // ============================================

  // Rachel - Frontend
  { id: 'perf_rachel_q1', attemptId: 'attempt_rachel_frontend', questionId: 'q_frontend_1', score: 0.90, technicalDepth: 'deep', feedback: 'Excellent component design and optimization.', evaluatedAt: daysAgo(59) },
  { id: 'perf_rachel_q2', attemptId: 'attempt_rachel_frontend', questionId: 'q_frontend_2', score: 0.86, technicalDepth: 'deep', feedback: 'Strong form handling with good UX.', evaluatedAt: daysAgo(59) },

  // Lisa - Backend
  { id: 'perf_lisa_q1', attemptId: 'attempt_lisa_backend', questionId: 'q_backend_1', score: 0.88, technicalDepth: 'deep', feedback: 'Strong API design with concurrency handling.', evaluatedAt: daysAgo(74) },
  { id: 'perf_lisa_q2', attemptId: 'attempt_lisa_backend', questionId: 'q_backend_2', score: 0.84, technicalDepth: 'deep', feedback: 'Good distributed data model considerations.', evaluatedAt: daysAgo(74) },

  // Zoe - Full Stack
  { id: 'perf_zoe_q1', attemptId: 'attempt_zoe_fullstack', questionId: 'q_fullstack_1', score: 0.86, technicalDepth: 'deep', feedback: 'Well-integrated real-time feature.', evaluatedAt: daysAgo(64) },
  { id: 'perf_zoe_q2', attemptId: 'attempt_zoe_fullstack', questionId: 'q_fullstack_2', score: 0.82, technicalDepth: 'working', feedback: 'Secure auth implementation.', evaluatedAt: daysAgo(64) },

  // David - Backend
  { id: 'perf_david_q1', attemptId: 'attempt_david_backend', questionId: 'q_backend_1', score: 0.84, technicalDepth: 'working', feedback: 'Good API design with Python best practices.', evaluatedAt: daysAgo(54) },
  { id: 'perf_david_q2', attemptId: 'attempt_david_backend', questionId: 'q_backend_2', score: 0.80, technicalDepth: 'working', feedback: 'Healthcare-aware data modeling.', evaluatedAt: daysAgo(54) },

  // Mohammed - Platform
  { id: 'perf_mohammed_q1', attemptId: 'attempt_mohammed_platform', questionId: 'q_platform_1', score: 0.87, technicalDepth: 'deep', feedback: 'Solid Kubernetes deployment configuration.', evaluatedAt: daysAgo(57) },
  { id: 'perf_mohammed_q2', attemptId: 'attempt_mohammed_platform', questionId: 'q_platform_2', score: 0.83, technicalDepth: 'working', feedback: 'Good CI/CD pipeline design.', evaluatedAt: daysAgo(57) },

  // Aisha - ML
  { id: 'perf_aisha_q1', attemptId: 'attempt_aisha_ml', questionId: 'q_ml_1', score: 0.88, technicalDepth: 'deep', feedback: 'Strong model development with good evaluation.', evaluatedAt: daysAgo(50) },
  { id: 'perf_aisha_q2', attemptId: 'attempt_aisha_ml', questionId: 'q_ml_2', score: 0.84, technicalDepth: 'working', feedback: 'Good ML pipeline architecture.', evaluatedAt: daysAgo(50) },

  // Ryan - Mobile
  { id: 'perf_ryan_q1', attemptId: 'attempt_ryan_mobile', questionId: 'q_mobile_1', score: 0.85, technicalDepth: 'deep', feedback: 'Smooth list implementation with good performance.', evaluatedAt: daysAgo(44) },
  { id: 'perf_ryan_q2', attemptId: 'attempt_ryan_mobile', questionId: 'q_mobile_2', score: 0.81, technicalDepth: 'working', feedback: 'Functional offline sync.', evaluatedAt: daysAgo(44) },

  // Emma - Frontend
  { id: 'perf_emma_q1', attemptId: 'attempt_emma_frontend', questionId: 'q_frontend_1', score: 0.86, technicalDepth: 'deep', feedback: 'Well-designed component with good TypeScript.', evaluatedAt: daysAgo(69) },
  { id: 'perf_emma_q2', attemptId: 'attempt_emma_frontend', questionId: 'q_frontend_2', score: 0.82, technicalDepth: 'working', feedback: 'Clean form with good UX.', evaluatedAt: daysAgo(69) },

  // ============================================
  // Senior Engineer Performances
  // ============================================

  // Greg - Backend
  { id: 'perf_greg_q1', attemptId: 'attempt_greg_backend', questionId: 'q_backend_1', score: 0.84, technicalDepth: 'working', feedback: 'Competent API design.', evaluatedAt: daysAgo(119) },
  { id: 'perf_greg_q2', attemptId: 'attempt_greg_backend', questionId: 'q_backend_2', score: 0.80, technicalDepth: 'working', feedback: 'Standard data model approach.', evaluatedAt: daysAgo(119) },

  // Natasha - Full Stack
  { id: 'perf_natasha_q1', attemptId: 'attempt_natasha_fullstack', questionId: 'q_fullstack_1', score: 0.85, technicalDepth: 'working', feedback: 'Good full stack implementation.', evaluatedAt: daysAgo(94) },
  { id: 'perf_natasha_q2', attemptId: 'attempt_natasha_fullstack', questionId: 'q_fullstack_2', score: 0.83, technicalDepth: 'working', feedback: 'Solid auth flow.', evaluatedAt: daysAgo(94) },

  // Nathan - ML
  { id: 'perf_nathan_q1', attemptId: 'attempt_nathan_ml', questionId: 'q_ml_1', score: 0.94, technicalDepth: 'expert', feedback: 'Excellent model with production-ready code.', evaluatedAt: daysAgo(83) },
  { id: 'perf_nathan_q2', attemptId: 'attempt_nathan_ml', questionId: 'q_ml_2', score: 0.90, technicalDepth: 'expert', feedback: 'Strong ML pipeline with monitoring.', evaluatedAt: daysAgo(83) },

  // Wei - Backend
  { id: 'perf_wei_q1', attemptId: 'attempt_wei_backend', questionId: 'q_backend_1', score: 0.92, technicalDepth: 'expert', feedback: 'Excellent API design with Spark integration.', evaluatedAt: daysAgo(89) },
  { id: 'perf_wei_q2', attemptId: 'attempt_wei_backend', questionId: 'q_backend_2', score: 0.88, technicalDepth: 'deep', feedback: 'Strong data model for streaming workloads.', evaluatedAt: daysAgo(89) },

  // Derek - Full Stack
  { id: 'perf_derek_q1', attemptId: 'attempt_derek_fullstack', questionId: 'q_fullstack_1', score: 0.90, technicalDepth: 'deep', feedback: 'Well-rounded implementation showing startup velocity.', evaluatedAt: daysAgo(79) },
  { id: 'perf_derek_q2', attemptId: 'attempt_derek_fullstack', questionId: 'q_fullstack_2', score: 0.86, technicalDepth: 'deep', feedback: 'Pragmatic auth solution.', evaluatedAt: daysAgo(79) },

  // Takeshi - Backend
  { id: 'perf_takeshi_q1', attemptId: 'attempt_takeshi_backend', questionId: 'q_backend_1', score: 0.91, technicalDepth: 'expert', feedback: 'Excellent API with distributed patterns.', evaluatedAt: daysAgo(99) },
  { id: 'perf_takeshi_q2', attemptId: 'attempt_takeshi_backend', questionId: 'q_backend_2', score: 0.87, technicalDepth: 'deep', feedback: 'Strong scalable data model.', evaluatedAt: daysAgo(99) },

  // Takeshi - System Design
  { id: 'perf_takeshi_sd_q1', attemptId: 'attempt_takeshi_sysdesign', questionId: 'q_sysdesign_1', score: 0.89, technicalDepth: 'deep', feedback: 'Good notification system design.', evaluatedAt: daysAgo(94) },
  { id: 'perf_takeshi_sd_q2', attemptId: 'attempt_takeshi_sysdesign', questionId: 'q_sysdesign_2', score: 0.85, technicalDepth: 'deep', feedback: 'Solid URL shortener architecture.', evaluatedAt: daysAgo(94) },

  // Sarah - Frontend
  { id: 'perf_sarah_q1', attemptId: 'attempt_sarah_frontend', questionId: 'q_frontend_1', score: 0.90, technicalDepth: 'deep', feedback: 'Excellent component with design system integration.', evaluatedAt: daysAgo(74) },
  { id: 'perf_sarah_q2', attemptId: 'attempt_sarah_frontend', questionId: 'q_frontend_2', score: 0.86, technicalDepth: 'deep', feedback: 'Strong form with accessibility.', evaluatedAt: daysAgo(74) },

  // Ravi - Full Stack
  { id: 'perf_ravi_q1', attemptId: 'attempt_ravi_fullstack', questionId: 'q_fullstack_1', score: 0.88, technicalDepth: 'deep', feedback: 'Good real-time feature with healthcare considerations.', evaluatedAt: daysAgo(84) },
  { id: 'perf_ravi_q2', attemptId: 'attempt_ravi_fullstack', questionId: 'q_fullstack_2', score: 0.84, technicalDepth: 'deep', feedback: 'HIPAA-aware auth implementation.', evaluatedAt: daysAgo(84) },

  // Olivia - ML
  { id: 'perf_olivia_q1', attemptId: 'attempt_olivia_ml', questionId: 'q_ml_1', score: 0.92, technicalDepth: 'expert', feedback: 'Strong model with healthcare domain expertise.', evaluatedAt: daysAgo(108) },
  { id: 'perf_olivia_q2', attemptId: 'attempt_olivia_ml', questionId: 'q_ml_2', score: 0.88, technicalDepth: 'deep', feedback: 'Good ML pipeline for medical data.', evaluatedAt: daysAgo(108) },

  // Lucas - Platform
  { id: 'perf_lucas_q1', attemptId: 'attempt_lucas_platform', questionId: 'q_platform_1', score: 0.90, technicalDepth: 'deep', feedback: 'Excellent K8s deployment with best practices.', evaluatedAt: daysAgo(104) },
  { id: 'perf_lucas_q2', attemptId: 'attempt_lucas_platform', questionId: 'q_platform_2', score: 0.86, technicalDepth: 'deep', feedback: 'Strong CI/CD with AWS integration.', evaluatedAt: daysAgo(104) },

  // ============================================
  // Staff Engineer Performances
  // ============================================

  // Anika - Platform
  { id: 'perf_anika_p_q1', attemptId: 'attempt_anika_platform', questionId: 'q_platform_1', score: 0.96, technicalDepth: 'expert', feedback: 'Outstanding K8s deployment with Kafka integration.', evaluatedAt: daysAgo(129) },
  { id: 'perf_anika_p_q2', attemptId: 'attempt_anika_platform', questionId: 'q_platform_2', score: 0.92, technicalDepth: 'expert', feedback: 'Excellent CI/CD with comprehensive testing.', evaluatedAt: daysAgo(129) },

  // Anika - System Design
  { id: 'perf_anika_sd_q1', attemptId: 'attempt_anika_sysdesign', questionId: 'q_sysdesign_1', score: 0.94, technicalDepth: 'expert', feedback: 'Excellent notification system with Kafka.', evaluatedAt: daysAgo(124) },
  { id: 'perf_anika_sd_q2', attemptId: 'attempt_anika_sysdesign', questionId: 'q_sysdesign_2', score: 0.90, technicalDepth: 'deep', feedback: 'Strong URL shortener with analytics.', evaluatedAt: daysAgo(124) },

  // Alex - Backend
  { id: 'perf_alex_q1', attemptId: 'attempt_alex_backend', questionId: 'q_backend_1', score: 0.94, technicalDepth: 'expert', feedback: 'Exceptional API design with Java best practices.', evaluatedAt: daysAgo(139) },
  { id: 'perf_alex_q2', attemptId: 'attempt_alex_backend', questionId: 'q_backend_2', score: 0.90, technicalDepth: 'expert', feedback: 'Strong distributed data model.', evaluatedAt: daysAgo(139) },

  // Alex - System Design
  { id: 'perf_alex_sd_q1', attemptId: 'attempt_alex_sysdesign', questionId: 'q_sysdesign_1', score: 0.92, technicalDepth: 'expert', feedback: 'Excellent scalable notification design.', evaluatedAt: daysAgo(134) },
  { id: 'perf_alex_sd_q2', attemptId: 'attempt_alex_sysdesign', questionId: 'q_sysdesign_2', score: 0.88, technicalDepth: 'deep', feedback: 'Good analytics-focused URL shortener.', evaluatedAt: daysAgo(134) },

  // Dmitri - ML
  { id: 'perf_dmitri_q1', attemptId: 'attempt_dmitri_ml', questionId: 'q_ml_1', score: 0.96, technicalDepth: 'expert', feedback: 'Outstanding model with PyTorch expertise.', evaluatedAt: daysAgo(148) },
  { id: 'perf_dmitri_q2', attemptId: 'attempt_dmitri_ml', questionId: 'q_ml_2', score: 0.92, technicalDepth: 'expert', feedback: 'Excellent ML pipeline for production.', evaluatedAt: daysAgo(148) },

  // Jennifer - Frontend
  { id: 'perf_jennifer_q1', attemptId: 'attempt_jennifer_frontend', questionId: 'q_frontend_1', score: 0.94, technicalDepth: 'expert', feedback: 'Outstanding component architecture.', evaluatedAt: daysAgo(117) },
  { id: 'perf_jennifer_q2', attemptId: 'attempt_jennifer_frontend', questionId: 'q_frontend_2', score: 0.90, technicalDepth: 'expert', feedback: 'Excellent form with perfect accessibility.', evaluatedAt: daysAgo(117) },

  // Michael - Platform
  { id: 'perf_michael_q1', attemptId: 'attempt_michael_platform', questionId: 'q_platform_1', score: 0.96, technicalDepth: 'expert', feedback: 'Production-grade K8s with security focus.', evaluatedAt: daysAgo(154) },
  { id: 'perf_michael_q2', attemptId: 'attempt_michael_platform', questionId: 'q_platform_2', score: 0.92, technicalDepth: 'expert', feedback: 'Excellent CI/CD with AWS best practices.', evaluatedAt: daysAgo(154) },

  // Sanjay - Backend
  { id: 'perf_sanjay_q1', attemptId: 'attempt_sanjay_backend', questionId: 'q_backend_1', score: 0.93, technicalDepth: 'expert', feedback: 'Strong API with Spark integration patterns.', evaluatedAt: daysAgo(127) },
  { id: 'perf_sanjay_q2', attemptId: 'attempt_sanjay_backend', questionId: 'q_backend_2', score: 0.89, technicalDepth: 'deep', feedback: 'Excellent data model for real-time systems.', evaluatedAt: daysAgo(127) },

  // Christine - Full Stack
  { id: 'perf_christine_q1', attemptId: 'attempt_christine_fullstack', questionId: 'q_fullstack_1', score: 0.92, technicalDepth: 'expert', feedback: 'Excellent real-time with healthcare compliance.', evaluatedAt: daysAgo(114) },
  { id: 'perf_christine_q2', attemptId: 'attempt_christine_fullstack', questionId: 'q_fullstack_2', score: 0.88, technicalDepth: 'deep', feedback: 'Strong HIPAA-compliant auth.', evaluatedAt: daysAgo(114) },

  // Hassan - Platform
  { id: 'perf_hassan_q1', attemptId: 'attempt_hassan_platform', questionId: 'q_platform_1', score: 0.95, technicalDepth: 'expert', feedback: 'Excellent K8s with security hardening.', evaluatedAt: daysAgo(144) },
  { id: 'perf_hassan_q2', attemptId: 'attempt_hassan_platform', questionId: 'q_platform_2', score: 0.91, technicalDepth: 'expert', feedback: 'Strong CI/CD with security scanning.', evaluatedAt: daysAgo(144) },

  // ============================================
  // Principal Engineer Performances
  // ============================================

  // Victoria - System Design
  { id: 'perf_victoria_q1', attemptId: 'attempt_victoria_sysdesign', questionId: 'q_sysdesign_1', score: 0.98, technicalDepth: 'expert', feedback: 'Industry-leading notification system design.', evaluatedAt: daysAgo(179) },
  { id: 'perf_victoria_q2', attemptId: 'attempt_victoria_sysdesign', questionId: 'q_sysdesign_2', score: 0.96, technicalDepth: 'expert', feedback: 'Exceptional URL shortener with analytics at scale.', evaluatedAt: daysAgo(179) },

  // Robert - ML
  { id: 'perf_robert_q1', attemptId: 'attempt_robert_ml', questionId: 'q_ml_1', score: 0.99, technicalDepth: 'expert', feedback: 'Outstanding model with production best practices.', evaluatedAt: daysAgo(198) },
  { id: 'perf_robert_q2', attemptId: 'attempt_robert_ml', questionId: 'q_ml_2', score: 0.97, technicalDepth: 'expert', feedback: 'Industry-leading ML platform design.', evaluatedAt: daysAgo(198) },

  // Elena - System Design
  { id: 'perf_elena_q1', attemptId: 'attempt_elena_sysdesign', questionId: 'q_sysdesign_1', score: 0.97, technicalDepth: 'expert', feedback: 'Excellent secure notification architecture.', evaluatedAt: daysAgo(184) },
  { id: 'perf_elena_q2', attemptId: 'attempt_elena_sysdesign', questionId: 'q_sysdesign_2', score: 0.95, technicalDepth: 'expert', feedback: 'Strong security-first URL shortener.', evaluatedAt: daysAgo(184) },
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
  {
    id: 'cert_gcp_ml',
    name: 'Google Cloud Professional ML Engineer',
    issuingOrg: 'Google Cloud',
    issueDate: daysAgo(180),
    expiryDate: daysAgo(-545),
    verificationUrl: 'https://cloud.google.com/certification/verify',
    verified: true,
  },
  {
    id: 'cert_react_native',
    name: 'React Native Certified Developer',
    issuingOrg: 'Meta',
    issueDate: daysAgo(220),
    expiryDate: daysAgo(-875),
    verificationUrl: 'https://www.credly.com/verify',
    verified: true,
  },
  {
    id: 'cert_hipaa',
    name: 'HIPAA Compliance Certification',
    issuingOrg: 'AHLA',
    issueDate: daysAgo(150),
    expiryDate: daysAgo(-580),
    verificationUrl: 'https://www.ahla.com/verify',
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
  { certificationId: 'cert_gcp_ml', skillId: 'skill_tensorflow' },
  { certificationId: 'cert_gcp_ml', skillId: 'skill_python' },
  { certificationId: 'cert_gcp_ml', skillId: 'skill_spark' },
  { certificationId: 'cert_react_native', skillId: 'skill_react' },
  { certificationId: 'cert_react_native', skillId: 'skill_typescript' },
  { certificationId: 'cert_hipaa', skillId: 'skill_attention_detail' },
];

// ============================================
// ENGINEER CERTIFICATIONS (who has what)
// ============================================

export const engineerCertifications: { engineerId: string; certificationId: string; acquiredAt: string }[] = [
  { engineerId: 'eng_priya', certificationId: 'cert_aws_saa', acquiredAt: daysAgo(180) },
  { engineerId: 'eng_sofia', certificationId: 'cert_cka', acquiredAt: daysAgo(200) },
  { engineerId: 'eng_sofia', certificationId: 'cert_ckad', acquiredAt: daysAgo(250) },
  { engineerId: 'eng_sofia', certificationId: 'cert_terraform', acquiredAt: daysAgo(150) },
  { engineerId: 'eng_sofia', certificationId: 'cert_aws_saa', acquiredAt: daysAgo(300) },
  { engineerId: 'eng_james', certificationId: 'cert_aws_sap', acquiredAt: daysAgo(120) },

  // New engineer certifications
  { engineerId: 'eng_mohammed', certificationId: 'cert_cka', acquiredAt: daysAgo(90) },
  { engineerId: 'eng_lucas', certificationId: 'cert_aws_saa', acquiredAt: daysAgo(150) },
  { engineerId: 'eng_lucas', certificationId: 'cert_terraform', acquiredAt: daysAgo(100) },
  { engineerId: 'eng_michael', certificationId: 'cert_aws_sap', acquiredAt: daysAgo(180) },
  { engineerId: 'eng_michael', certificationId: 'cert_cka', acquiredAt: daysAgo(220) },
  { engineerId: 'eng_michael', certificationId: 'cert_terraform', acquiredAt: daysAgo(160) },
  { engineerId: 'eng_anika', certificationId: 'cert_cka', acquiredAt: daysAgo(200) },
  { engineerId: 'eng_anika', certificationId: 'cert_terraform', acquiredAt: daysAgo(140) },
  { engineerId: 'eng_nathan', certificationId: 'cert_gcp_ml', acquiredAt: daysAgo(120) },
  { engineerId: 'eng_dmitri', certificationId: 'cert_gcp_ml', acquiredAt: daysAgo(160) },
  { engineerId: 'eng_robert', certificationId: 'cert_gcp_ml', acquiredAt: daysAgo(180) },
  { engineerId: 'eng_ravi', certificationId: 'cert_hipaa', acquiredAt: daysAgo(100) },
  { engineerId: 'eng_christine', certificationId: 'cert_hipaa', acquiredAt: daysAgo(90) },
  { engineerId: 'eng_ryan', certificationId: 'cert_react_native', acquiredAt: daysAgo(80) },
  { engineerId: 'eng_victoria', certificationId: 'cert_aws_sap', acquiredAt: daysAgo(240) },
  { engineerId: 'eng_elena', certificationId: 'cert_aws_sap', acquiredAt: daysAgo(200) },
  { engineerId: 'eng_hassan', certificationId: 'cert_aws_sap', acquiredAt: daysAgo(170) },
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

  // ============================================
  // New Engineer Evidence
  // ============================================

  // CRITICAL: Anika (unlocks example query - Kafka + Kubernetes, 10+ years, immediate)
  { userSkillId: 'es_anika_kafka', evidenceId: 'story_anika_1', evidenceType: 'story', relevanceScore: 0.95, isPrimary: true },
  { userSkillId: 'es_anika_kafka', evidenceId: 'perf_anika_p_q1', evidenceType: 'performance', relevanceScore: 0.92, isPrimary: false },
  { userSkillId: 'es_anika_kubernetes', evidenceId: 'story_anika_1', evidenceType: 'story', relevanceScore: 0.94, isPrimary: true },
  { userSkillId: 'es_anika_kubernetes', evidenceId: 'perf_anika_p_q1', evidenceType: 'performance', relevanceScore: 0.96, isPrimary: false },
  { userSkillId: 'es_anika_kubernetes', evidenceId: 'cert_cka', evidenceType: 'certification', relevanceScore: 0.90, isPrimary: false },
  { userSkillId: 'es_anika_distributed', evidenceId: 'story_anika_1', evidenceType: 'story', relevanceScore: 0.94, isPrimary: true },
  { userSkillId: 'es_anika_distributed', evidenceId: 'perf_anika_sd_q1', evidenceType: 'performance', relevanceScore: 0.94, isPrimary: false },
  { userSkillId: 'es_anika_terraform', evidenceId: 'cert_terraform', evidenceType: 'certification', relevanceScore: 0.92, isPrimary: true },

  // Rachel (high-performing mid-level)
  { userSkillId: 'es_rachel_react', evidenceId: 'story_rachel_1', evidenceType: 'story', relevanceScore: 0.92, isPrimary: true },
  { userSkillId: 'es_rachel_react', evidenceId: 'perf_rachel_q1', evidenceType: 'performance', relevanceScore: 0.90, isPrimary: false },

  // Lisa (high-performing mid-level)
  { userSkillId: 'es_lisa_go', evidenceId: 'story_lisa_1', evidenceType: 'story', relevanceScore: 0.90, isPrimary: true },
  { userSkillId: 'es_lisa_go', evidenceId: 'perf_lisa_q1', evidenceType: 'performance', relevanceScore: 0.88, isPrimary: false },
  { userSkillId: 'es_lisa_distributed', evidenceId: 'story_lisa_1', evidenceType: 'story', relevanceScore: 0.88, isPrimary: true },

  // Mohammed (DevOps mid-level)
  { userSkillId: 'es_mohammed_kubernetes', evidenceId: 'story_mohammed_1', evidenceType: 'story', relevanceScore: 0.88, isPrimary: true },
  { userSkillId: 'es_mohammed_kubernetes', evidenceId: 'perf_mohammed_q1', evidenceType: 'performance', relevanceScore: 0.87, isPrimary: false },
  { userSkillId: 'es_mohammed_kubernetes', evidenceId: 'cert_cka', evidenceType: 'certification', relevanceScore: 0.90, isPrimary: false },

  // Nathan (big-tech ML senior)
  { userSkillId: 'es_nathan_tensorflow', evidenceId: 'story_nathan_1', evidenceType: 'story', relevanceScore: 0.95, isPrimary: true },
  { userSkillId: 'es_nathan_tensorflow', evidenceId: 'perf_nathan_q1', evidenceType: 'performance', relevanceScore: 0.94, isPrimary: false },
  { userSkillId: 'es_nathan_tensorflow', evidenceId: 'cert_gcp_ml', evidenceType: 'certification', relevanceScore: 0.92, isPrimary: false },

  // Dmitri (staff ML)
  { userSkillId: 'es_dmitri_tensorflow', evidenceId: 'story_dmitri_1', evidenceType: 'story', relevanceScore: 0.96, isPrimary: true },
  { userSkillId: 'es_dmitri_tensorflow', evidenceId: 'perf_dmitri_q1', evidenceType: 'performance', relevanceScore: 0.96, isPrimary: false },
  { userSkillId: 'es_dmitri_tensorflow', evidenceId: 'cert_gcp_ml', evidenceType: 'certification', relevanceScore: 0.92, isPrimary: false },
  { userSkillId: 'es_dmitri_pytorch', evidenceId: 'story_dmitri_1', evidenceType: 'story', relevanceScore: 0.94, isPrimary: true },

  // Michael (staff DevOps)
  { userSkillId: 'es_michael_aws', evidenceId: 'story_michael_1', evidenceType: 'story', relevanceScore: 0.95, isPrimary: true },
  { userSkillId: 'es_michael_aws', evidenceId: 'perf_michael_q1', evidenceType: 'performance', relevanceScore: 0.96, isPrimary: false },
  { userSkillId: 'es_michael_aws', evidenceId: 'cert_aws_sap', evidenceType: 'certification', relevanceScore: 0.92, isPrimary: false },
  { userSkillId: 'es_michael_kubernetes', evidenceId: 'story_michael_1', evidenceType: 'story', relevanceScore: 0.92, isPrimary: true },
  { userSkillId: 'es_michael_kubernetes', evidenceId: 'cert_cka', evidenceType: 'certification', relevanceScore: 0.90, isPrimary: false },

  // Victoria (principal architect)
  { userSkillId: 'es_victoria_distributed', evidenceId: 'story_victoria_1', evidenceType: 'story', relevanceScore: 0.98, isPrimary: true },
  { userSkillId: 'es_victoria_system_design', evidenceId: 'story_victoria_1', evidenceType: 'story', relevanceScore: 0.98, isPrimary: true },
  { userSkillId: 'es_victoria_system_design', evidenceId: 'perf_victoria_q1', evidenceType: 'performance', relevanceScore: 0.98, isPrimary: false },
  { userSkillId: 'es_victoria_team_leadership', evidenceId: 'story_victoria_1', evidenceType: 'story', relevanceScore: 0.95, isPrimary: true },
  { userSkillId: 'es_victoria_aws', evidenceId: 'cert_aws_sap', evidenceType: 'certification', relevanceScore: 0.92, isPrimary: true },

  // Robert (principal ML)
  { userSkillId: 'es_robert_tensorflow', evidenceId: 'story_robert_1', evidenceType: 'story', relevanceScore: 0.98, isPrimary: true },
  { userSkillId: 'es_robert_tensorflow', evidenceId: 'perf_robert_q1', evidenceType: 'performance', relevanceScore: 0.99, isPrimary: false },
  { userSkillId: 'es_robert_tensorflow', evidenceId: 'cert_gcp_ml', evidenceType: 'certification', relevanceScore: 0.94, isPrimary: false },
  { userSkillId: 'es_robert_system_design', evidenceId: 'story_robert_1', evidenceType: 'story', relevanceScore: 0.96, isPrimary: true },
  { userSkillId: 'es_robert_python', evidenceId: 'perf_robert_q1', evidenceType: 'performance', relevanceScore: 0.98, isPrimary: true },

  // Elena (principal security)
  { userSkillId: 'es_elena_system_design', evidenceId: 'story_elena_1', evidenceType: 'story', relevanceScore: 0.98, isPrimary: true },
  { userSkillId: 'es_elena_system_design', evidenceId: 'perf_elena_q1', evidenceType: 'performance', relevanceScore: 0.97, isPrimary: false },
  { userSkillId: 'es_elena_aws', evidenceId: 'story_elena_1', evidenceType: 'story', relevanceScore: 0.96, isPrimary: true },
  { userSkillId: 'es_elena_aws', evidenceId: 'cert_aws_sap', evidenceType: 'certification', relevanceScore: 0.92, isPrimary: false },
  { userSkillId: 'es_elena_team_leadership', evidenceId: 'story_elena_1', evidenceType: 'story', relevanceScore: 0.94, isPrimary: true },
];
