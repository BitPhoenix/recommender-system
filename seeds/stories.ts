import { InterviewStory, StoryAnalysis, StoryDemonstration } from './types';

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

// ============================================
// INTERVIEW STORIES
// ============================================

export const interviewStories: InterviewStory[] = [
  // Priya's stories
  {
    id: 'story_priya_1',
    engineerId: 'eng_priya',
    interviewId: 'int_priya_onboard',
    questionPrompt: 'Tell me about a time you led a significant technical initiative.',
    situation: 'At a Series B fintech startup processing 10M daily transactions, our monolithic payment service was becoming a bottleneck. Response times were degrading and deployments required full system downtime.',
    task: 'I was asked to lead the effort to break the monolith into microservices while maintaining 99.99% uptime during the transition.',
    action: 'I designed the API contracts between services using OpenAPI specs, implemented event sourcing with Kafka for data consistency across services, and created a strangler fig pattern to gradually migrate traffic. I also mentored 3 junior engineers through their first microservice implementations and established CI/CD pipelines with canary deployments.',
    result: 'We completed the migration in 4 months with zero customer-facing downtime. P99 latency dropped from 800ms to 120ms. The team scaled from 5 to 12 engineers who could now deploy independently. This architecture handled 3x traffic growth during Black Friday.',
    durationSeconds: 240,
    createdAt: daysAgo(30),
  },
  {
    id: 'story_priya_2',
    engineerId: 'eng_priya',
    interviewId: 'int_priya_onboard',
    questionPrompt: 'Describe a time you had to make a difficult technical decision with incomplete information.',
    situation: 'We discovered a critical data inconsistency bug in our payment reconciliation system on a Friday afternoon. Some transactions were being double-counted, affecting financial reports.',
    task: 'I needed to decide whether to take the system offline for a full audit, apply a quick fix and monitor, or implement a more complex solution that would take the weekend.',
    action: 'I gathered the team, mapped out the three options with their tradeoffs, and consulted with our finance team about the business impact. I chose a hybrid approach: applied an immediate safeguard to prevent new inconsistencies, wrote a reconciliation script to identify affected transactions, and planned the permanent fix for the following week. I documented the decision rationale for future reference.',
    result: 'We identified and corrected $127K in reporting discrepancies within 24 hours. The safeguard prevented any new issues. The permanent fix was deployed the following Wednesday after proper testing. Leadership appreciated the transparent communication throughout.',
    durationSeconds: 180,
    createdAt: daysAgo(30),
  },

  // Marcus's stories
  {
    id: 'story_marcus_1',
    engineerId: 'eng_marcus',
    interviewId: 'int_marcus_onboard',
    questionPrompt: 'Tell me about a project you owned from start to finish.',
    situation: 'Our SaaS product needed a customer dashboard that would display real-time usage metrics, billing information, and allow self-service account management. The previous attempt had stalled due to scope creep.',
    task: 'I volunteered to own the project end-to-end, from requirements gathering to deployment, with a 6-week timeline.',
    action: 'I started by interviewing 5 customers and our support team to understand the most critical needs. I created a prioritized MVP scope and got stakeholder buy-in. I built the frontend in Next.js with real-time WebSocket updates, designed the GraphQL API myself, and coordinated with our billing team for Stripe integration. I wrote comprehensive tests and documentation.',
    result: 'Launched on time with all MVP features. Customer support tickets related to billing questions dropped 40% in the first month. The dashboard became our most-used feature with 85% weekly active usage among customers.',
    durationSeconds: 200,
    createdAt: daysAgo(25),
  },

  // Sofia's stories
  {
    id: 'story_sofia_1',
    engineerId: 'eng_sofia',
    interviewId: 'int_sofia_onboard',
    questionPrompt: "Tell me about a time you improved a system's reliability.",
    situation: 'Our Kubernetes clusters were experiencing frequent pod evictions and occasional node failures. On-call engineers were getting paged 3-4 times per week, often at night.',
    task: 'I was tasked with reducing on-call burden and improving cluster stability without significant additional infrastructure cost.',
    action: 'I conducted a thorough analysis of the past 3 months of incidents. I found that 60% were caused by resource limit misconfigurations and 25% by missing health checks. I implemented a cluster-wide resource quota policy, created a library of production-ready Helm charts with proper probes, and built a Prometheus alerting pipeline that would catch issues before they became pages. I also ran training sessions for the team.',
    result: 'On-call pages dropped from 15/month to 2/month. Mean time to recovery improved from 45 minutes to 8 minutes. The Helm chart library was adopted by 3 other teams in the organization.',
    durationSeconds: 210,
    createdAt: daysAgo(35),
  },
  {
    id: 'story_sofia_2',
    engineerId: 'eng_sofia',
    interviewId: 'int_sofia_onboard',
    questionPrompt: 'Describe a situation where you had to debug a complex production issue.',
    situation: "Our main API started returning intermittent 503 errors during peak hours. The issue wasn't reproducible in staging, and logs showed no obvious errors.",
    task: 'I needed to identify and fix the root cause while minimizing customer impact.',
    action: 'I enabled distributed tracing across all services and correlated the failing requests. I discovered that a specific database query was occasionally timing out due to a missing index, but only when combined with high concurrent load. I added the index as a hotfix, then implemented circuit breakers to prevent cascade failures in the future. I also added custom metrics to catch similar issues earlier.',
    result: 'Error rate dropped from 2.3% to 0.01%. We created a runbook for similar debugging scenarios and added the database query pattern to our performance review checklist.',
    durationSeconds: 195,
    createdAt: daysAgo(35),
  },

  // James's stories
  {
    id: 'story_james_1',
    engineerId: 'eng_james',
    interviewId: 'int_james_onboard',
    questionPrompt: 'Tell me about a time you designed a system to handle significant scale.',
    situation: 'Our trading platform needed to handle 100x growth in order volume as we expanded to new markets. The existing system was already showing strain at 10K orders/second.',
    task: 'I was asked to architect a new order matching engine that could handle 1M orders/second with sub-millisecond latency.',
    action: 'I designed an event-sourced architecture using Kafka for durability and a custom in-memory matching engine. I chose Java with the LMAX Disruptor pattern for the hot path. I implemented consistent hashing for horizontal scaling and designed a replay mechanism for disaster recovery. I worked closely with the infrastructure team on network optimization and led a team of 4 engineers through the implementation.',
    result: 'The new system handles 1.2M orders/second with p99 latency of 0.3ms. It has been running in production for 2 years with 99.999% uptime. The architecture has been presented at two industry conferences.',
    durationSeconds: 280,
    createdAt: daysAgo(20),
  },
  {
    id: 'story_james_2',
    engineerId: 'eng_james',
    interviewId: 'int_james_onboard',
    questionPrompt: 'Describe a time you mentored someone through a challenging situation.',
    situation: 'A mid-level engineer on my team was struggling with imposter syndrome after a failed project. Their code quality was declining and they were hesitant to take on new challenges.',
    task: 'I wanted to help them rebuild confidence and get back to their previous performance level.',
    action: 'I had honest 1:1 conversations to understand their perspective. We did a blameless retrospective on the failed project together, identifying systemic issues versus personal ones. I paired with them on a medium-complexity feature, gradually stepping back as their confidence grew. I made sure to publicly recognize their contributions in team meetings and helped them prepare for a technical talk at our internal conference.',
    result: 'Within 3 months, they were back to their previous performance level. They successfully led a cross-team initiative and were promoted to senior engineer the following cycle. They later told me this mentorship changed their career trajectory.',
    durationSeconds: 220,
    createdAt: daysAgo(20),
  },

  // Emily's stories
  {
    id: 'story_emily_1',
    engineerId: 'eng_emily',
    interviewId: 'int_emily_onboard',
    questionPrompt: 'Tell me about a time you collaborated with non-engineering stakeholders.',
    situation: "Our design team had created a new design system, but engineering adoption was slow. Designers were frustrated that their specs weren't being followed, and engineers found the designs impractical to implement.",
    task: 'I volunteered to bridge the gap and create a shared component library that both teams could contribute to.',
    action: 'I organized weekly sync meetings between design and engineering. I learned Figma to understand the design workflow and created a React component library that auto-generated documentation from both design tokens and code. I implemented visual regression testing so designers could see exactly how their designs rendered. I also created a contribution guide for both teams.',
    result: 'Design-to-development handoff time decreased from 2 weeks to 2 days. The component library reached 95% adoption across our product. Both teams now participate in a shared design system guild.',
    durationSeconds: 190,
    createdAt: daysAgo(18),
  },
];

// ============================================
// STORY ANALYSES
// ============================================

export const storyAnalyses: StoryAnalysis[] = [
  {
    id: 'analysis_priya_1',
    storyId: 'story_priya_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(29),
    clarityScore: 0.92,
    impactScore: 0.90,
    ownershipScore: 0.88,
    overallScore: 0.90,
    reasoning: 'Excellent STAR structure with specific metrics. Strong ownership demonstrated through API design leadership and mentorship. Impact is quantified and significant (latency reduction, team scaling).',
    flags: [],
  },
  {
    id: 'analysis_priya_2',
    storyId: 'story_priya_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(29),
    clarityScore: 0.88,
    impactScore: 0.82,
    ownershipScore: 0.90,
    overallScore: 0.86,
    reasoning: 'Clear decision-making process demonstrated. Good balance of speed and thoroughness. Quantified financial impact and showed stakeholder communication.',
    flags: [],
  },
  {
    id: 'analysis_marcus_1',
    storyId: 'story_marcus_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(24),
    clarityScore: 0.85,
    impactScore: 0.82,
    ownershipScore: 0.92,
    overallScore: 0.85,
    reasoning: 'Strong demonstration of end-to-end ownership. Good customer focus. Impact metrics are relevant. Could have elaborated more on technical challenges overcome.',
    flags: [],
  },
  {
    id: 'analysis_sofia_1',
    storyId: 'story_sofia_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(34),
    clarityScore: 0.90,
    impactScore: 0.88,
    ownershipScore: 0.85,
    overallScore: 0.87,
    reasoning: 'Systematic approach to problem-solving. Good quantification of before/after metrics. Demonstrated knowledge sharing through training and reusable artifacts.',
    flags: [],
  },
  {
    id: 'analysis_sofia_2',
    storyId: 'story_sofia_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(34),
    clarityScore: 0.88,
    impactScore: 0.85,
    ownershipScore: 0.82,
    overallScore: 0.85,
    reasoning: 'Clear debugging methodology. Good use of observability tools. Proactive in preventing future issues through circuit breakers and runbooks.',
    flags: [],
  },
  {
    id: 'analysis_james_1',
    storyId: 'story_james_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(19),
    clarityScore: 0.94,
    impactScore: 0.95,
    ownershipScore: 0.90,
    overallScore: 0.93,
    reasoning: 'Exceptional technical depth and clarity. Demonstrated both architectural vision and hands-on implementation. Impact is industry-leading (1M+ orders/second). Conference presentations show external validation.',
    flags: [],
  },
  {
    id: 'analysis_james_2',
    storyId: 'story_james_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(19),
    clarityScore: 0.90,
    impactScore: 0.88,
    ownershipScore: 0.85,
    overallScore: 0.88,
    reasoning: 'Thoughtful approach to mentorship. Good balance of support and challenge. Long-term outcome (promotion) validates effectiveness. Showed empathy and psychological safety.',
    flags: [],
  },
  {
    id: 'analysis_emily_1',
    storyId: 'story_emily_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(17),
    clarityScore: 0.86,
    impactScore: 0.82,
    ownershipScore: 0.88,
    overallScore: 0.85,
    reasoning: 'Strong cross-functional collaboration. Proactive in bridging skill gaps (learning Figma). Created sustainable processes (design system guild). Good adoption metrics.',
    flags: [],
  },
];

// ============================================
// STORY DEMONSTRATIONS
// ============================================

export const storyDemonstrations: StoryDemonstration[] = [
  // Priya story 1
  { storyId: 'story_priya_1', skillId: 'skill_api_design', strength: 0.92, notes: 'Designed API contracts between microservices using OpenAPI' },
  { storyId: 'story_priya_1', skillId: 'skill_microservices', strength: 0.90, notes: 'Led migration from monolith to microservices' },
  { storyId: 'story_priya_1', skillId: 'skill_tech_leadership', strength: 0.88, notes: 'Led team of engineers through complex migration' },
  { storyId: 'story_priya_1', skillId: 'skill_mentorship', strength: 0.82, notes: 'Mentored 3 junior engineers through first microservice implementations' },
  { storyId: 'story_priya_1', skillId: 'skill_kafka', strength: 0.75, notes: 'Implemented event sourcing with Kafka' },
  { storyId: 'story_priya_1', skillId: 'skill_system_design', strength: 0.85, notes: 'Designed strangler fig pattern for gradual migration' },

  // Priya story 2
  { storyId: 'story_priya_2', skillId: 'skill_decision_making', strength: 0.90, notes: 'Made difficult tradeoff decision under pressure' },
  { storyId: 'story_priya_2', skillId: 'skill_tradeoffs', strength: 0.88, notes: 'Evaluated three options with clear tradeoff analysis' },
  { storyId: 'story_priya_2', skillId: 'skill_stakeholder_comm', strength: 0.82, notes: 'Communicated with finance team and leadership throughout' },
  { storyId: 'story_priya_2', skillId: 'skill_pressure', strength: 0.85, notes: 'Handled critical production issue on Friday afternoon' },
  { storyId: 'story_priya_2', skillId: 'skill_debugging', strength: 0.78, notes: 'Identified and corrected data inconsistency' },

  // Marcus story 1
  { storyId: 'story_marcus_1', skillId: 'skill_ownership', strength: 0.92, notes: 'Owned project end-to-end from requirements to deployment' },
  { storyId: 'story_marcus_1', skillId: 'skill_react', strength: 0.80, notes: 'Built frontend in Next.js' },
  { storyId: 'story_marcus_1', skillId: 'skill_graphql', strength: 0.78, notes: 'Designed GraphQL API' },
  { storyId: 'story_marcus_1', skillId: 'skill_cross_functional', strength: 0.85, notes: 'Coordinated with billing team and interviewed customers' },

  // Sofia story 1
  { storyId: 'story_sofia_1', skillId: 'skill_kubernetes', strength: 0.92, notes: 'Improved cluster stability through resource quota policy' },
  { storyId: 'story_sofia_1', skillId: 'skill_helm', strength: 0.82, notes: 'Created library of production-ready Helm charts' },
  { storyId: 'story_sofia_1', skillId: 'skill_monitoring', strength: 0.88, notes: 'Built Prometheus alerting pipeline' },
  { storyId: 'story_sofia_1', skillId: 'skill_root_cause', strength: 0.85, notes: 'Analyzed 3 months of incidents to identify patterns' },
  { storyId: 'story_sofia_1', skillId: 'skill_knowledge_sharing', strength: 0.80, notes: 'Ran training sessions and created reusable charts' },

  // Sofia story 2
  { storyId: 'story_sofia_2', skillId: 'skill_debugging', strength: 0.92, notes: 'Debugged complex intermittent production issue' },
  { storyId: 'story_sofia_2', skillId: 'skill_tracing', strength: 0.85, notes: 'Used distributed tracing to correlate failing requests' },
  { storyId: 'story_sofia_2', skillId: 'skill_root_cause', strength: 0.88, notes: 'Identified missing index as root cause' },
  { storyId: 'story_sofia_2', skillId: 'skill_documentation', strength: 0.75, notes: 'Created runbook for similar debugging scenarios' },

  // James story 1
  { storyId: 'story_james_1', skillId: 'skill_distributed', strength: 0.95, notes: 'Designed system for 1M orders/second' },
  { storyId: 'story_james_1', skillId: 'skill_system_design', strength: 0.94, notes: 'Architected event-sourced matching engine' },
  { storyId: 'story_james_1', skillId: 'skill_kafka', strength: 0.88, notes: 'Used Kafka for durability in event sourcing' },
  { storyId: 'story_james_1', skillId: 'skill_java', strength: 0.85, notes: 'Implemented using Java with LMAX Disruptor' },
  { storyId: 'story_james_1', skillId: 'skill_tech_leadership', strength: 0.90, notes: 'Led team of 4 engineers through implementation' },

  // James story 2
  { storyId: 'story_james_2', skillId: 'skill_mentorship', strength: 0.92, notes: 'Rebuilt engineer confidence over 3 months' },
  { storyId: 'story_james_2', skillId: 'skill_coaching', strength: 0.88, notes: 'Paired programming and gradual autonomy increase' },
  { storyId: 'story_james_2', skillId: 'skill_feedback_giving', strength: 0.82, notes: 'Provided public recognition and honest feedback' },
  { storyId: 'story_james_2', skillId: 'skill_active_listening', strength: 0.85, notes: 'Had honest 1:1 conversations to understand perspective' },

  // Emily story 1
  { storyId: 'story_emily_1', skillId: 'skill_cross_functional', strength: 0.92, notes: 'Bridged gap between design and engineering' },
  { storyId: 'story_emily_1', skillId: 'skill_react', strength: 0.80, notes: 'Created React component library' },
  { storyId: 'story_emily_1', skillId: 'skill_learning', strength: 0.85, notes: 'Learned Figma to understand design workflow' },
  { storyId: 'story_emily_1', skillId: 'skill_documentation', strength: 0.78, notes: 'Auto-generated documentation from design tokens and code' },
];
