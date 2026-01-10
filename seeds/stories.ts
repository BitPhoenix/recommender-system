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

  // ============================================
  // Junior Engineer Stories (2 per engineer)
  // ============================================

  // Maya's stories
  {
    id: 'story_maya_1',
    engineerId: 'eng_maya',
    interviewId: 'int_maya_onboard',
    questionPrompt: 'Tell me about a project where you learned a new technology quickly.',
    situation: 'I joined a team that was migrating from class components to React hooks. I had no experience with hooks.',
    task: 'I needed to learn hooks quickly and help migrate a critical user settings page.',
    action: 'I spent a weekend going through the official React docs and building small examples. I asked my senior colleague for code review on my first hooks implementation and incorporated their feedback. I documented the patterns I learned for other team members.',
    result: 'I completed the migration in 3 days. My documentation became the team reference for hooks patterns. Two other junior developers used it to onboard.',
    durationSeconds: 150,
    createdAt: daysAgo(25),
  },
  {
    id: 'story_maya_2',
    engineerId: 'eng_maya',
    interviewId: 'int_maya_onboard',
    questionPrompt: 'Describe a time you collaborated with a designer.',
    situation: 'Our design team created new mockups for the dashboard, but the specs were ambiguous about responsive behavior.',
    task: 'I needed to implement the dashboard while maintaining a good relationship with the design team.',
    action: 'Instead of guessing, I scheduled a 30-minute sync with the designer. We walked through the mockups together on a shared screen and I asked clarifying questions. I built a small prototype and got feedback before full implementation.',
    result: 'The designer appreciated the proactive communication. We completed the dashboard with zero revision rounds. This became our standard process for new features.',
    durationSeconds: 140,
    createdAt: daysAgo(25),
  },

  // Kevin's stories
  {
    id: 'story_kevin_1',
    engineerId: 'eng_kevin',
    interviewId: 'int_kevin_onboard',
    questionPrompt: 'Tell me about a bug you fixed that taught you something important.',
    situation: 'Our Django API was returning 500 errors intermittently. The errors seemed random and the logs were not helpful.',
    task: 'I was assigned to investigate and fix the issue within a day before our demo to stakeholders.',
    action: 'I added more granular logging to trace the request flow. I discovered the issue was a race condition when multiple requests hit the same database record. I implemented proper database locking and added a test case to prevent regression.',
    result: 'Fixed the bug in 6 hours. The test case I wrote caught a similar issue in a different part of the codebase during our next sprint. My team lead praised my systematic debugging approach.',
    durationSeconds: 160,
    createdAt: daysAgo(40),
  },
  {
    id: 'story_kevin_2',
    engineerId: 'eng_kevin',
    interviewId: 'int_kevin_onboard',
    questionPrompt: 'Describe a time you took ownership of something outside your normal responsibilities.',
    situation: 'Our team had no documentation for setting up the local development environment. New hires were spending 2-3 days just getting started.',
    task: 'Although documentation was not my responsibility, I saw an opportunity to help the team.',
    action: 'I documented my own setup process as I went through it, asked recent hires about their pain points, and created a comprehensive README with troubleshooting tips. I also created a Docker Compose file to simplify the setup.',
    result: 'New hire setup time dropped from 2-3 days to 4 hours. The documentation was adopted as the official onboarding guide. My manager mentioned this in my performance review as an example of initiative.',
    durationSeconds: 155,
    createdAt: daysAgo(40),
  },

  // Jordan's stories
  {
    id: 'story_jordan_1',
    engineerId: 'eng_jordan',
    interviewId: 'int_jordan_onboard',
    questionPrompt: 'Tell me about a time you received constructive feedback and how you handled it.',
    situation: 'During a code review, my senior colleague pointed out that my React component was doing too many things and would be hard to test.',
    task: 'I needed to understand the feedback, refactor the code, and learn from the experience.',
    action: 'Instead of getting defensive, I asked for a 15-minute pairing session to understand the principles better. We refactored the component together, splitting it into smaller, focused components. I took notes on the patterns we used.',
    result: 'The refactored code was easier to test and maintain. I applied the same principles to my next three features without needing review feedback. My colleague noted my improvement in our next 1:1.',
    durationSeconds: 145,
    createdAt: daysAgo(55),
  },
  {
    id: 'story_jordan_2',
    engineerId: 'eng_jordan',
    interviewId: 'int_jordan_onboard',
    questionPrompt: 'Describe a time you helped a teammate.',
    situation: 'A new team member was struggling with our codebase and felt overwhelmed during their first week.',
    task: 'I wanted to help them get up to speed without making them feel inadequate.',
    action: 'I offered to pair program on their first ticket. I explained our conventions as we went, pointed out helpful resources, and shared my own early struggles to normalize the learning curve. We met for 30 minutes each morning that week.',
    result: 'They completed their first PR by end of week. They later told me those pairing sessions made them feel welcomed. My manager recognized this as good team citizenship.',
    durationSeconds: 135,
    createdAt: daysAgo(55),
  },

  // Carlos's stories
  {
    id: 'story_carlos_1',
    engineerId: 'eng_carlos',
    interviewId: 'int_carlos_onboard',
    questionPrompt: 'Tell me about a full-stack feature you built.',
    situation: 'Our e-commerce platform needed a product wishlist feature. Users had been requesting it for months.',
    task: 'I was responsible for building both the backend API and the frontend UI for the wishlist.',
    action: 'I started by designing the MongoDB schema and REST endpoints. I wrote API tests first, then implemented the Node.js routes. For the frontend, I built React components with optimistic updates for a snappy feel. I coordinated with the mobile team to ensure API consistency.',
    result: 'Shipped the feature in 2 weeks. It became one of our most-used features with 40% of users creating wishlists. The mobile team appreciated the well-documented API.',
    durationSeconds: 170,
    createdAt: daysAgo(50),
  },
  {
    id: 'story_carlos_2',
    engineerId: 'eng_carlos',
    interviewId: 'int_carlos_onboard',
    questionPrompt: 'Describe a time you had to adapt to changing requirements.',
    situation: 'Midway through building a checkout flow, the product team decided to add a gift card redemption feature.',
    task: 'I needed to incorporate the new requirement without delaying the original deadline.',
    action: 'I reassessed the work remaining and proposed a phased approach: launch with basic gift card support, then enhance it in the next sprint. I modularized my code to make the enhancement easier. I communicated the tradeoffs clearly to the PM.',
    result: 'We launched on time with core gift card functionality. The PM appreciated the transparency about scope. The enhancement shipped the following week with minimal additional effort.',
    durationSeconds: 150,
    createdAt: daysAgo(50),
  },

  // Ashley's stories
  {
    id: 'story_ashley_1',
    engineerId: 'eng_ashley',
    interviewId: 'int_ashley_onboard',
    questionPrompt: 'Tell me about something you learned recently that excited you.',
    situation: 'I had been using Vue 2 and heard about the Composition API in Vue 3. I was curious how it compared to the Options API I knew.',
    task: 'I wanted to understand the new API and evaluate if it would help our team.',
    action: 'I built a small side project using Vue 3 and the Composition API. I compared the same component written both ways and documented the pros and cons. I presented my findings to my team in a lunch-and-learn session.',
    result: 'The team decided to adopt the Composition API for new components. My presentation was well-received and I was asked to help with the migration guide.',
    durationSeconds: 140,
    createdAt: daysAgo(15),
  },
  {
    id: 'story_ashley_2',
    engineerId: 'eng_ashley',
    interviewId: 'int_ashley_onboard',
    questionPrompt: 'Describe a time you caught a bug before it reached production.',
    situation: 'While testing my own feature, I noticed the form validation was accepting invalid email formats.',
    task: 'I needed to fix the bug and ensure similar issues would be caught in the future.',
    action: 'I fixed the regex pattern and added unit tests for various email edge cases. I also noticed we lacked consistent validation patterns across the app, so I proposed creating a shared validation utility.',
    result: 'The bug was fixed before the feature was merged. The shared validation utility was adopted and prevented similar issues in other forms. My attention to detail was noted in my review.',
    durationSeconds: 130,
    createdAt: daysAgo(15),
  },

  // Tyler's stories
  {
    id: 'story_tyler_1',
    engineerId: 'eng_tyler',
    interviewId: 'int_tyler_onboard',
    questionPrompt: 'Tell me about a time you improved code quality on your team.',
    situation: 'Our Java codebase had inconsistent coding styles and no automated formatting. Code reviews often got stuck on style discussions.',
    task: 'I wanted to reduce time spent on style debates and improve consistency.',
    action: 'I researched Java formatting tools and proposed adding Checkstyle to our build. I configured it with Google Java Style Guide rules and created a PR template checklist. I also set up a pre-commit hook to auto-format code.',
    result: 'Style-related review comments dropped by 80%. Build times increased by only 5 seconds. The team appreciated the cleaner diffs and faster reviews.',
    durationSeconds: 155,
    createdAt: daysAgo(30),
  },
  {
    id: 'story_tyler_2',
    engineerId: 'eng_tyler',
    interviewId: 'int_tyler_onboard',
    questionPrompt: 'Describe a time you worked under pressure.',
    situation: 'We had a critical demo for potential investors in 2 days, but a key API endpoint was returning incorrect data.',
    task: 'I needed to fix the issue quickly while maintaining code quality.',
    action: 'I time-boxed my debugging to 2 hours before asking for help. I found the issue was a SQL join returning duplicate rows. I fixed the query, added a test case, and had a senior review my change. I stayed late to ensure the fix was deployed and verified.',
    result: 'The demo went smoothly. The investors were impressed and we closed the funding round. My manager acknowledged my calm handling of the pressure situation.',
    durationSeconds: 160,
    createdAt: daysAgo(30),
  },

  // ============================================
  // Mid-Level Engineer Stories (2 per engineer)
  // ============================================

  // Rachel's stories (High-performing, Ex-Stripe)
  {
    id: 'story_rachel_1',
    engineerId: 'eng_rachel',
    interviewId: 'int_rachel_onboard',
    questionPrompt: 'Tell me about a time you significantly improved application performance.',
    situation: 'At Stripe, our merchant dashboard was taking 4+ seconds to load for merchants with high transaction volumes. Customer complaints were increasing.',
    task: 'I was asked to lead the performance optimization effort and get load times under 1 second.',
    action: 'I profiled the application and identified the main bottlenecks: unoptimized React re-renders and overfetching of transaction data. I implemented virtualization for the transaction list, added React.memo strategically, and designed a pagination API with the backend team. I also set up performance monitoring with Web Vitals.',
    result: 'Load time dropped from 4.2s to 0.8s. Customer complaints about performance dropped to zero. The performance monitoring caught two regressions before they shipped. I documented the patterns for the team.',
    durationSeconds: 200,
    createdAt: daysAgo(40),
  },
  {
    id: 'story_rachel_2',
    engineerId: 'eng_rachel',
    interviewId: 'int_rachel_onboard',
    questionPrompt: 'Describe a time you mentored a less experienced engineer.',
    situation: 'A new junior engineer was assigned to my team. They had React knowledge but struggled with TypeScript and our codebase patterns.',
    task: 'I wanted to help them become productive while maintaining my own deliverables.',
    action: 'I set up weekly 1:1s focused on their growth. I created a series of progressively challenging code review exercises. When they got stuck, I asked guiding questions rather than giving answers directly. I paired with them on their first feature.',
    result: 'Within 2 months they were shipping features independently. They later told me they learned more in those 2 months than their entire bootcamp. They are now mentoring others.',
    durationSeconds: 175,
    createdAt: daysAgo(40),
  },

  // Lisa's stories (High-performing, Ex-Cloudflare)
  {
    id: 'story_lisa_1',
    engineerId: 'eng_lisa',
    interviewId: 'int_lisa_onboard',
    questionPrompt: 'Tell me about a time you designed a system for high scale.',
    situation: 'At Cloudflare, we needed to build a new rate limiting service that could handle 10M+ requests per second globally with sub-millisecond latency.',
    task: 'I was responsible for designing the core rate limiting algorithm and its distributed coordination.',
    action: 'I researched various rate limiting algorithms and chose a sliding window approach with Redis for coordination. I implemented the core logic in Go for performance. I designed a two-tier cache (local + Redis) to minimize network calls. I worked with the infrastructure team on global deployment.',
    result: 'The service handles 15M req/s with p99 latency of 0.4ms. It has been running for 2 years with 99.99% uptime. The design was adopted as a template for other distributed services.',
    durationSeconds: 220,
    createdAt: daysAgo(75),
  },
  {
    id: 'story_lisa_2',
    engineerId: 'eng_lisa',
    interviewId: 'int_lisa_onboard',
    questionPrompt: 'Describe a time you debugged a complex distributed systems issue.',
    situation: 'Our CDN was experiencing intermittent cache misses that were hard to reproduce. Customer-facing latency was spiking unpredictably.',
    task: 'I needed to identify the root cause and fix it without disrupting service.',
    action: 'I added detailed distributed tracing to track requests across nodes. I analyzed the traces and noticed a pattern: misses correlated with clock skew between nodes. I implemented vector clocks for cache invalidation instead of relying on wall-clock time. I rolled out the fix gradually with feature flags.',
    result: 'Cache hit rate improved from 94% to 99.2%. Customer-reported latency issues dropped by 85%. I presented the findings at an internal tech talk.',
    durationSeconds: 210,
    createdAt: daysAgo(75),
  },

  // Zoe's stories (Startup Generalist)
  {
    id: 'story_zoe_1',
    engineerId: 'eng_zoe',
    interviewId: 'int_zoe_onboard',
    questionPrompt: 'Tell me about a time you built something from 0 to 1.',
    situation: 'At my first YC startup, we had an idea but no product. I was the first engineering hire and needed to build our MVP.',
    task: 'Build a functional product in 8 weeks that we could demo at YC Demo Day.',
    action: 'I chose a pragmatic tech stack (Next.js, Node, Postgres) that I could move fast with. I focused ruthlessly on the core value prop and said no to nice-to-haves. I set up basic CI/CD from day one. I talked to users weekly and incorporated feedback immediately. I wore multiple hats: frontend, backend, devops.',
    result: 'We launched 2 days before Demo Day with a working product. We got 50 beta users that week. The architecture I set up scaled to our first 10K users without major changes. We raised a $2M seed round.',
    durationSeconds: 195,
    createdAt: daysAgo(48),
  },
  {
    id: 'story_zoe_2',
    engineerId: 'eng_zoe',
    interviewId: 'int_zoe_onboard',
    questionPrompt: 'Describe a time you had to make a decision with incomplete information.',
    situation: 'Our startup was running low on runway and we had to choose between two product directions. Data was inconclusive on which to pursue.',
    task: 'Make a recommendation to the founders that could determine the company survival.',
    action: 'I talked to 10 customers in 3 days to understand their pain points better. I built rough prototypes of both directions and showed them to users. I analyzed which direction had faster time-to-value. I presented my findings with clear tradeoffs and my recommendation.',
    result: 'Founders went with my recommendation. The pivot worked - we found product-market fit within 2 months. My structured approach to the decision became our template for future pivots.',
    durationSeconds: 180,
    createdAt: daysAgo(48),
  },

  // David's stories (Healthcare Backend)
  {
    id: 'story_david_1',
    engineerId: 'eng_david',
    interviewId: 'int_david_onboard',
    questionPrompt: 'Tell me about a time you worked with sensitive data.',
    situation: 'Our healthcare platform needed to implement a new patient data export feature while maintaining HIPAA compliance.',
    task: 'Design and implement the export system with proper audit logging and access controls.',
    action: 'I researched HIPAA technical requirements thoroughly. I designed the system with encryption at rest and in transit, implemented role-based access controls, and created comprehensive audit logs. I worked with our compliance team to validate the implementation. I wrote detailed documentation for future audits.',
    result: 'The feature passed our external security audit on first attempt. We had zero compliance incidents. The audit logging system I built was adopted for other sensitive features.',
    durationSeconds: 185,
    createdAt: daysAgo(65),
  },
  {
    id: 'story_david_2',
    engineerId: 'eng_david',
    interviewId: 'int_david_onboard',
    questionPrompt: 'Describe a time you improved a legacy system.',
    situation: 'Our patient scheduling system was built on outdated technology and was difficult to maintain. Adding new features took weeks.',
    task: 'Modernize the system incrementally while keeping it running for users.',
    action: 'I proposed a strangler fig pattern to migrate piece by piece. I started with the most painful part: the appointment booking API. I wrote extensive tests for the existing behavior, then rebuilt it in Python/Django. I set up feature flags to switch between old and new implementations.',
    result: 'Migrated 3 core modules over 4 months with zero downtime. Development velocity improved 3x. The team was able to add a new feature in 2 days that would have taken 3 weeks before.',
    durationSeconds: 190,
    createdAt: daysAgo(65),
  },

  // Mohammed's stories (DevOps)
  {
    id: 'story_mohammed_1',
    engineerId: 'eng_mohammed',
    interviewId: 'int_mohammed_onboard',
    questionPrompt: 'Tell me about a time you improved deployment reliability.',
    situation: 'Our deployments were taking 45 minutes and failing 30% of the time. Teams were afraid to deploy on Fridays.',
    task: 'Make deployments fast, reliable, and something teams could do with confidence any day.',
    action: 'I analyzed the deployment pipeline and found the main issues: sequential steps that could be parallelized, flaky integration tests, and no canary deployments. I restructured the pipeline to run tests in parallel, fixed the flaky tests, and implemented automated canary analysis. I created runbooks for common failure scenarios.',
    result: 'Deployment time dropped from 45 minutes to 12 minutes. Failure rate dropped from 30% to 2%. Teams now deploy multiple times per day, including Fridays.',
    durationSeconds: 195,
    createdAt: daysAgo(60),
  },
  {
    id: 'story_mohammed_2',
    engineerId: 'eng_mohammed',
    interviewId: 'int_mohammed_onboard',
    questionPrompt: 'Describe a time you handled a production incident.',
    situation: 'Our main database cluster experienced a split-brain scenario during a network partition. Both nodes thought they were primary.',
    task: 'Resolve the incident with minimal data loss and prevent it from happening again.',
    action: 'I quickly identified the issue from monitoring alerts. I coordinated with the team to gracefully stop writes to both nodes. I determined which node had the most recent data using transaction logs. I promoted that node and reconciled the divergent writes. Post-incident, I implemented a proper fencing mechanism.',
    result: 'We recovered with only 12 seconds of writes affected. The fencing mechanism I implemented has prevented similar issues for 18 months. I led the post-mortem that resulted in 5 action items.',
    durationSeconds: 200,
    createdAt: daysAgo(60),
  },

  // Aisha's stories (ML, Healthcare)
  {
    id: 'story_aisha_1',
    engineerId: 'eng_aisha',
    interviewId: 'int_aisha_onboard',
    questionPrompt: 'Tell me about a machine learning project you delivered.',
    situation: 'Our healthcare company wanted to predict patient no-shows to optimize scheduling. Previous attempts had failed due to data quality issues.',
    task: 'Build a production ML model that could accurately predict no-shows and integrate with our scheduling system.',
    action: 'I started with extensive data exploration and found the previous attempts had used wrong features. I cleaned the data, engineered features from appointment history and patient demographics. I tried several models and chose gradient boosting for its interpretability. I built an MLOps pipeline for retraining and monitoring.',
    result: 'The model achieved 78% precision in predicting no-shows. When integrated with scheduling, it helped reduce no-shows by 23%. The overbooking system I built recaptured $2M in annual revenue.',
    durationSeconds: 205,
    createdAt: daysAgo(50),
  },
  {
    id: 'story_aisha_2',
    engineerId: 'eng_aisha',
    interviewId: 'int_aisha_onboard',
    questionPrompt: 'Describe a time you explained technical concepts to non-technical stakeholders.',
    situation: 'Hospital administrators wanted to use our ML model but were concerned about "black box" decision making.',
    task: 'Help them understand how the model works and build trust in its predictions.',
    action: 'I created visualizations showing which factors influenced predictions most. I developed a dashboard that explained individual predictions in plain language. I held a workshop where I walked through example cases. I established a feedback loop where staff could flag predictions that seemed wrong.',
    result: 'Adoption increased from 20% to 85% of scheduling staff. The feedback loop helped us identify and fix a bias in the model. The administrators became advocates for expanding ML to other areas.',
    durationSeconds: 185,
    createdAt: daysAgo(50),
  },

  // Ryan's stories (Mobile, Gaming)
  {
    id: 'story_ryan_1',
    engineerId: 'eng_ryan',
    interviewId: 'int_ryan_onboard',
    questionPrompt: 'Tell me about a mobile app you built.',
    situation: 'Our gaming company wanted a companion app that would let players track their stats and connect with friends across platforms.',
    task: 'Build a cross-platform mobile app that would work seamlessly with our existing game backend.',
    action: 'I chose React Native to maximize code reuse across iOS and Android. I designed an offline-first architecture so the app would work with spotty connections during gaming sessions. I integrated with the game API and added real-time updates using WebSockets. I worked closely with QA to ensure consistent experience across devices.',
    result: 'Launched on both platforms simultaneously. The app reached 100K downloads in the first month. User engagement with the main game increased 15% among app users. App store rating was 4.6 stars.',
    durationSeconds: 190,
    createdAt: daysAgo(45),
  },
  {
    id: 'story_ryan_2',
    engineerId: 'eng_ryan',
    interviewId: 'int_ryan_onboard',
    questionPrompt: 'Describe a time you optimized app performance.',
    situation: 'Our React Native app was consuming too much battery and users were complaining. The app was draining 20% battery per hour of use.',
    task: 'Reduce battery consumption without sacrificing functionality.',
    action: 'I profiled the app and found the main issues: frequent location polling, unnecessary re-renders, and background sync that was too aggressive. I implemented intelligent location batching, optimized React rendering with useMemo and useCallback, and made background sync adaptive based on user patterns.',
    result: 'Battery consumption dropped from 20% to 6% per hour. App store reviews mentioning battery improved significantly. The optimization patterns I documented became our mobile performance guide.',
    durationSeconds: 175,
    createdAt: daysAgo(45),
  },

  // Emma's stories (Frontend, Design Systems)
  {
    id: 'story_emma_1',
    engineerId: 'eng_emma',
    interviewId: 'int_emma_onboard',
    questionPrompt: 'Tell me about a design system you built or contributed to.',
    situation: 'Our e-commerce platform had inconsistent UI across different product pages. Each team had built their own components.',
    task: 'Create a unified design system that all teams would adopt.',
    action: 'I audited existing components across teams and identified common patterns. I worked with designers to create a cohesive component library with proper variants and states. I built the components in React with TypeScript and Storybook documentation. I created migration guides and held workshops for each team.',
    result: 'Achieved 90% adoption across 5 teams within 3 months. Design-to-development handoff time decreased by 60%. Component consistency complaints from users dropped to near zero.',
    durationSeconds: 195,
    createdAt: daysAgo(30),
  },
  {
    id: 'story_emma_2',
    engineerId: 'eng_emma',
    interviewId: 'int_emma_onboard',
    questionPrompt: 'Describe a time you improved accessibility.',
    situation: 'An accessibility audit revealed our checkout flow had multiple WCAG violations. Some users with disabilities could not complete purchases.',
    task: 'Fix the accessibility issues while maintaining the existing user experience.',
    action: 'I prioritized issues by severity and user impact. I fixed keyboard navigation, added proper ARIA labels, and improved color contrast. I set up automated accessibility testing in CI to prevent regressions. I partnered with a user who uses a screen reader to validate the fixes.',
    result: 'Passed the follow-up accessibility audit with zero critical issues. Checkout completion rate for users with accessibility tools increased 40%. The testing setup caught 12 issues before they shipped.',
    durationSeconds: 180,
    createdAt: daysAgo(30),
  },

  // ============================================
  // Senior Engineer Stories (2 per engineer)
  // ============================================

  // Greg - COASTING SENIOR (Enterprise Java, competent but not exceptional stories)
  {
    id: 'story_greg_1',
    engineerId: 'eng_greg',
    interviewId: 'int_greg_onboard',
    questionPrompt: 'Tell me about a challenging technical project you worked on.',
    situation: 'Our enterprise application needed to migrate from Java 8 to Java 11 to maintain security compliance.',
    task: 'I was assigned to update the codebase and ensure all dependencies were compatible.',
    action: 'I reviewed the Java migration documentation and updated the build configuration. I fixed deprecated API usages and tested the main workflows. I coordinated with QA for regression testing.',
    result: 'The migration was completed in 2 months. We passed the security audit. The team continued to use the updated version without major issues.',
    durationSeconds: 150,
    createdAt: daysAgo(80),
  },
  {
    id: 'story_greg_2',
    engineerId: 'eng_greg',
    interviewId: 'int_greg_onboard',
    questionPrompt: 'Describe a time you helped a team member.',
    situation: 'A new developer was struggling with our Spring configuration patterns.',
    task: 'I needed to help them understand our codebase so they could be productive.',
    action: 'I spent a few hours walking them through the configuration files. I explained the bean lifecycle and pointed them to relevant documentation. I answered their questions over the next week.',
    result: 'They were able to complete their first feature after two weeks. They said my explanations were helpful.',
    durationSeconds: 120,
    createdAt: daysAgo(80),
  },

  // Natasha - COASTING SENIOR (EdTech, stable but not growing)
  {
    id: 'story_natasha_1',
    engineerId: 'eng_natasha',
    interviewId: 'int_natasha_onboard',
    questionPrompt: 'Tell me about a feature you delivered.',
    situation: 'Our learning platform needed a progress tracking dashboard for students to see their course completion.',
    task: 'I was responsible for building the frontend and connecting it to our existing APIs.',
    action: 'I designed the dashboard layout based on our design mockups. I built React components to display progress bars and completion percentages. I integrated with the existing GraphQL API for course data.',
    result: 'The dashboard was launched on schedule. Students can now see their progress. The feature has been used consistently since launch.',
    durationSeconds: 145,
    createdAt: daysAgo(70),
  },
  {
    id: 'story_natasha_2',
    engineerId: 'eng_natasha',
    interviewId: 'int_natasha_onboard',
    questionPrompt: 'Describe a bug you fixed.',
    situation: 'Users reported that course videos were sometimes not loading properly on mobile devices.',
    task: 'I needed to investigate and fix the video loading issue.',
    action: 'I reproduced the issue on different devices and found it was related to video format compatibility. I updated our video player to support additional codecs and added fallback options.',
    result: 'Mobile video playback issues were resolved. Support tickets related to video loading dropped significantly.',
    durationSeconds: 130,
    createdAt: daysAgo(70),
  },

  // Nathan - BIG-TECH SPECIALIST (Ex-Meta, deep ML/Ranking expertise)
  {
    id: 'story_nathan_1',
    engineerId: 'eng_nathan',
    interviewId: 'int_nathan_onboard',
    questionPrompt: 'Tell me about the most impactful system you designed.',
    situation: 'At Meta, our feed ranking model was serving 2B+ users but had become increasingly difficult to iterate on. Model training took 3 days and required coordinating across 4 teams.',
    task: 'I was asked to redesign the ranking infrastructure to enable faster experimentation while maintaining serving latency under 50ms.',
    action: 'I designed a modular ranking architecture that separated feature extraction, model inference, and post-processing stages. I introduced a feature store that reduced duplicate computation by 80%. I implemented a staged rollout system with automatic quality metrics validation. I documented the system extensively and ran training sessions for partner teams.',
    result: 'Model iteration time dropped from 3 days to 4 hours. We ran 5x more experiments per quarter, leading to a 2.3% improvement in engagement metrics. The architecture became the template for two other major ranking systems at the company.',
    durationSeconds: 270,
    createdAt: daysAgo(35),
  },
  {
    id: 'story_nathan_2',
    engineerId: 'eng_nathan',
    interviewId: 'int_nathan_onboard',
    questionPrompt: 'Describe a time you had to make a critical technical decision.',
    situation: 'During a major product launch, we discovered our ranking model was producing unexpectedly biased results for certain user segments.',
    task: 'I needed to decide how to address the bias issue without delaying the launch or causing service degradation.',
    action: 'I convened an emergency meeting with ML fairness experts and product stakeholders. I analyzed the model weights to identify the problematic features. I proposed a two-phase approach: immediate mitigation through feature ablation for the launch, followed by a proper retraining with fairness constraints. I documented the tradeoffs clearly for leadership.',
    result: 'We launched on schedule with the mitigation in place. Bias metrics improved by 45% immediately. The full fix was deployed 3 weeks later with no negative engagement impact. This case became part of Meta\'s ML ethics training.',
    durationSeconds: 240,
    createdAt: daysAgo(35),
  },

  // Wei - BIG-TECH SPECIALIST (Ex-Netflix, Kafka/Spark depth)
  {
    id: 'story_wei_1',
    engineerId: 'eng_wei',
    interviewId: 'int_wei_onboard',
    questionPrompt: 'Tell me about a system you built at scale.',
    situation: 'Netflix\'s real-time analytics pipeline was struggling to process viewing events at our scale of 200M+ members. Event processing lag was reaching 15 minutes during peak hours.',
    task: 'I was tasked with redesigning the pipeline to achieve sub-minute latency while handling 10M events per second.',
    action: 'I architected a new pipeline using Kafka Streams for stateful processing with exactly-once semantics. I implemented a custom partitioning strategy based on content ID to optimize for our query patterns. I designed a tiered storage approach that kept hot data in memory while offloading to S3 for historical queries. I worked closely with the infrastructure team on Kafka cluster optimization.',
    result: 'End-to-end latency dropped from 15 minutes to 30 seconds at peak load. Processing cost decreased by 40% due to more efficient resource utilization. The pipeline has been running for 3 years handling 15M events/second without major incidents.',
    durationSeconds: 260,
    createdAt: daysAgo(75),
  },
  {
    id: 'story_wei_2',
    engineerId: 'eng_wei',
    interviewId: 'int_wei_onboard',
    questionPrompt: 'Describe a time you mentored a team through a difficult migration.',
    situation: 'Our team needed to migrate from an in-house streaming system to Kafka, but most engineers had no Kafka experience and were apprehensive about the change.',
    task: 'As the Kafka expert, I needed to upskill the team and ensure a smooth migration without disrupting production traffic.',
    action: 'I created a comprehensive training program with hands-on exercises. I paired with each engineer on their first Kafka-based feature. I established migration checkpoints with rollback plans and implemented shadow traffic to validate before cutover. I held weekly office hours for questions.',
    result: 'All 8 team members became proficient in Kafka within 2 months. The migration completed with zero customer impact. Two engineers went on to become Kafka experts themselves.',
    durationSeconds: 220,
    createdAt: daysAgo(75),
  },

  // Derek - STARTUP GENERALIST Senior (breadth, wore many hats)
  {
    id: 'story_derek_1',
    engineerId: 'eng_derek',
    interviewId: 'int_derek_onboard',
    questionPrompt: 'Tell me about scaling a team and technical systems simultaneously.',
    situation: 'Our startup closed Series A and needed to scale from 3 to 15 engineers while rebuilding our MVP into a production system. I was the first engineering hire and de facto tech lead.',
    task: 'I needed to hire and onboard engineers while also migrating our prototype to a scalable architecture.',
    action: 'I created our technical interview process and personally interviewed 50+ candidates. I designed an onboarding program that got new engineers shipping code in week one. In parallel, I led the architecture redesign, breaking our monolith into services. I established our engineering culture through documentation, code review standards, and team rituals.',
    result: 'We grew from 3 to 15 engineers in 8 months with 90% retention. The new architecture handled 100x traffic growth. Three engineers I hired were promoted to senior roles within 18 months.',
    durationSeconds: 240,
    createdAt: daysAgo(32),
  },
  {
    id: 'story_derek_2',
    engineerId: 'eng_derek',
    interviewId: 'int_derek_onboard',
    questionPrompt: 'Describe a time you had to make do with limited resources.',
    situation: 'During our Series A fundraise, our cloud bill was unsustainable. We were spending $80K/month on infrastructure but only had 6 months of runway.',
    task: 'I needed to cut infrastructure costs by at least 50% without degrading service quality.',
    action: 'I audited every service and identified over-provisioned resources. I implemented autoscaling where we had fixed capacity. I negotiated reserved instance contracts and optimized our database queries to reduce instance sizes. I also moved batch processing to spot instances.',
    result: 'Reduced monthly cloud spend from $80K to $35K, extending runway significantly. Performance actually improved due to the query optimizations. This efficiency became a selling point during investor conversations.',
    durationSeconds: 200,
    createdAt: daysAgo(32),
  },

  // Takeshi - Standard Senior (Java & Distributed Systems)
  {
    id: 'story_takeshi_1',
    engineerId: 'eng_takeshi',
    interviewId: 'int_takeshi_onboard',
    questionPrompt: 'Tell me about designing a distributed system.',
    situation: 'Our payment processing system needed to handle international expansion to 10 new countries, each with different payment providers and regulatory requirements.',
    task: 'I was asked to architect a system that could integrate with multiple payment providers while ensuring compliance and reliability.',
    action: 'I designed an adapter-based architecture with a common internal payment model that translated to provider-specific formats. I implemented the saga pattern for multi-step transactions that could span multiple providers. I created a compliance engine that applied country-specific rules. I worked with legal and product teams to understand each market\'s requirements.',
    result: 'Successfully launched in 10 countries over 12 months. The adapter architecture reduced new payment provider integration time from 3 months to 2 weeks. Payment success rates improved by 8% due to automatic failover between providers.',
    durationSeconds: 235,
    createdAt: daysAgo(85),
  },
  {
    id: 'story_takeshi_2',
    engineerId: 'eng_takeshi',
    interviewId: 'int_takeshi_onboard',
    questionPrompt: 'Describe a debugging session that taught you something important.',
    situation: 'Our distributed cache was experiencing mysterious data corruption that only appeared in production under high load. Standard debugging approaches weren\'t revealing the cause.',
    task: 'I needed to find and fix the root cause of the corruption before it affected more customers.',
    action: 'I instrumented the system with detailed logging and created a load test that replicated production traffic patterns. After 3 days of analysis, I discovered a race condition in our cache invalidation logic that only manifested with specific timing. I implemented a compare-and-swap mechanism and added comprehensive concurrent unit tests.',
    result: 'The corruption issue was fully resolved. The debugging process led us to add chaos engineering practices to catch similar issues earlier. I shared the learnings in a tech talk attended by 40 engineers.',
    durationSeconds: 210,
    createdAt: daysAgo(85),
  },

  // Sarah - Standard Senior (Frontend, React & Performance)
  {
    id: 'story_sarah_1',
    engineerId: 'eng_sarah',
    interviewId: 'int_sarah_onboard',
    questionPrompt: 'Tell me about optimizing performance in a complex application.',
    situation: 'Our e-commerce site\'s product listing page was loading in 4+ seconds, causing a measurable drop in conversion rates. The page had accumulated significant technical debt.',
    task: 'I was asked to improve page load time to under 2 seconds without a complete rewrite.',
    action: 'I profiled the application using Chrome DevTools and identified three main issues: unnecessary re-renders, large JavaScript bundles, and waterfall API requests. I implemented React.memo strategically, set up code splitting with React.lazy, and parallelized API calls. I also implemented virtual scrolling for the product grid.',
    result: 'Page load time dropped from 4.2s to 1.6s. Conversion rate improved by 12%. The optimizations became part of our performance best practices documentation.',
    durationSeconds: 215,
    createdAt: daysAgo(55),
  },
  {
    id: 'story_sarah_2',
    engineerId: 'eng_sarah',
    interviewId: 'int_sarah_onboard',
    questionPrompt: 'Describe a time you improved team processes.',
    situation: 'Our frontend team was spending significant time on code review back-and-forth due to inconsistent code styles and undocumented patterns.',
    task: 'I wanted to reduce code review friction and help the team ship faster.',
    action: 'I proposed and led the adoption of ESLint rules that enforced our patterns automatically. I documented our component architecture decisions in an ADR format. I created a starter template for new features that included proper testing structure. I facilitated discussions to get team buy-in on standards.',
    result: 'Code review time decreased by 40%. New engineer ramp-up improved as they could reference documented patterns. Team satisfaction scores increased in the next survey.',
    durationSeconds: 180,
    createdAt: daysAgo(55),
  },

  // Ravi - Standard Senior (Healthcare Full Stack)
  {
    id: 'story_ravi_1',
    engineerId: 'eng_ravi',
    interviewId: 'int_ravi_onboard',
    questionPrompt: 'Tell me about building systems with strict compliance requirements.',
    situation: 'Our healthcare platform needed to implement HIPAA-compliant audit logging across all patient data access. Previous attempts had failed SOC 2 audits.',
    task: 'I was responsible for designing and implementing an audit system that would satisfy both compliance requirements and performance needs.',
    action: 'I worked closely with our compliance team to understand the specific requirements. I designed an immutable audit log using append-only tables with cryptographic chaining. I implemented automatic PII detection and masking for logs. I created role-based access controls with detailed permission auditing.',
    result: 'Passed SOC 2 Type II audit with zero findings related to audit logging. The system processes 50K audit events/second with sub-millisecond overhead. Auditors specifically praised the implementation.',
    durationSeconds: 225,
    createdAt: daysAgo(50),
  },
  {
    id: 'story_ravi_2',
    engineerId: 'eng_ravi',
    interviewId: 'int_ravi_onboard',
    questionPrompt: 'Describe a time you had to balance technical debt with new feature development.',
    situation: 'Our patient scheduling system had grown organically over 5 years and was becoming increasingly difficult to modify. But business wanted new features for a competitive launch.',
    task: 'I needed to find a way to deliver the new features while also addressing the most critical technical debt.',
    action: 'I mapped out the technical debt and identified which parts blocked the new features. I proposed a strategy of refactoring incrementally alongside feature work. I created clear interfaces that allowed new code to be written cleanly while gradually migrating old code. I was transparent with stakeholders about the additional time needed.',
    result: 'Delivered the new features on a timeline acceptable to business while reducing critical technical debt by 60%. Developer velocity on the scheduling system improved measurably in subsequent quarters.',
    durationSeconds: 195,
    createdAt: daysAgo(50),
  },

  // Olivia - Standard Senior (ML Engineer, NLP & Python)
  {
    id: 'story_olivia_1',
    engineerId: 'eng_olivia',
    interviewId: 'int_olivia_onboard',
    questionPrompt: 'Tell me about deploying a machine learning model to production.',
    situation: 'Our healthcare NLP model for extracting diagnoses from clinical notes performed well in research but had never been deployed to production. Clinicians were skeptical of AI recommendations.',
    task: 'I needed to productionize the model while building trust with clinical users.',
    action: 'I worked with our MLOps team to containerize the model and set up proper monitoring for model drift. I implemented explainability features that highlighted which parts of the text influenced predictions. I designed a human-in-the-loop workflow where predictions were suggestions rather than decisions. I ran pilot programs with friendly clinicians to gather feedback.',
    result: 'The model is now processing 10K clinical notes daily with 94% accuracy. Clinician adoption reached 70% within 6 months. The explainability features were cited as key to adoption in user surveys.',
    durationSeconds: 235,
    createdAt: daysAgo(65),
  },
  {
    id: 'story_olivia_2',
    engineerId: 'eng_olivia',
    interviewId: 'int_olivia_onboard',
    questionPrompt: 'Describe a time you improved model performance significantly.',
    situation: 'Our medical entity recognition model was stuck at 82% F1 score despite trying various architectures. Clinical users needed at least 90% accuracy to trust the system.',
    task: 'I needed to find ways to improve model performance beyond what architecture changes had achieved.',
    action: 'I analyzed the error cases systematically and found three categories: abbreviations, rare conditions, and context-dependent entities. I created a domain-specific pre-training corpus from medical literature. I implemented a hybrid approach combining neural NER with a medical knowledge graph for disambiguation. I worked with clinicians to curate high-quality training examples for edge cases.',
    result: 'F1 score improved from 82% to 93%. The approach was published in a workshop paper. The model is now being considered for use in clinical decision support.',
    durationSeconds: 220,
    createdAt: daysAgo(65),
  },

  // Lucas - Standard Senior (Security Engineer, Cloud Security)
  {
    id: 'story_lucas_1',
    engineerId: 'eng_lucas',
    interviewId: 'int_lucas_onboard',
    questionPrompt: 'Tell me about implementing security at scale.',
    situation: 'Our fintech company had grown rapidly to 200+ cloud services across multiple AWS accounts, but our security posture was inconsistent. We needed to prepare for SOC 2 certification.',
    task: 'I was asked to implement consistent security controls across all services without blocking developer productivity.',
    action: 'I designed a security-as-code framework using Terraform modules that embedded security requirements. I implemented automated compliance scanning in CI/CD that would fail builds with security violations. I created a self-service portal for developers to request exceptions with proper justification. I established security champions in each team.',
    result: 'Achieved SOC 2 Type II certification in 6 months. Security finding remediation time dropped from 45 days to 3 days average. Developer satisfaction remained high due to the self-service approach.',
    durationSeconds: 240,
    createdAt: daysAgo(60),
  },
  {
    id: 'story_lucas_2',
    engineerId: 'eng_lucas',
    interviewId: 'int_lucas_onboard',
    questionPrompt: 'Describe a security incident you handled.',
    situation: 'Our monitoring detected unusual API traffic patterns suggesting credential stuffing against customer accounts. Initial investigation showed 50K+ login attempts from distributed IPs.',
    task: 'I needed to stop the attack while minimizing impact on legitimate users.',
    action: 'I immediately implemented rate limiting based on behavioral patterns rather than just IP. I coordinated with customer support to prepare for user communications. I analyzed the attack patterns to identify affected accounts and forced password resets. I implemented additional bot detection measures and set up ongoing monitoring.',
    result: 'The attack was stopped within 2 hours with only 12 accounts temporarily locked out. No customer data was compromised. The new protections have blocked 3 similar attempts since then.',
    durationSeconds: 210,
    createdAt: daysAgo(60),
  },

  // ============================================
  // Staff Engineer Stories (2 per engineer)
  // ============================================

  // Anika - CRITICAL: Staff Platform Engineer (Kafka, Kubernetes, Distributed Systems)
  {
    id: 'story_anika_1',
    engineerId: 'eng_anika',
    interviewId: 'int_anika_onboard',
    questionPrompt: 'Tell me about architecting a system at scale.',
    situation: 'Our payment processing platform was hitting scaling limits at 50K transactions per second. During peak periods, we were experiencing message queue backlogs and occasional data loss. The business needed us to support 500K TPS for upcoming expansion.',
    task: 'As the platform lead, I needed to redesign the core infrastructure to achieve 10x scale while maintaining exactly-once semantics for financial transactions.',
    action: 'I architected a new event-driven platform using Kafka with custom partitioning based on account ID for ordering guarantees. I implemented the transactional outbox pattern for exactly-once delivery. I led the migration to Kubernetes with auto-scaling based on queue depth. I established runbooks and trained 3 teams on the new architecture.',
    result: 'The new platform handles 600K TPS with p99 latency under 50ms. We achieved exactly-once delivery with no data loss during the migration. The architecture saved $2M/year in infrastructure costs through better resource utilization.',
    durationSeconds: 280,
    createdAt: daysAgo(90),
  },
  {
    id: 'story_anika_2',
    engineerId: 'eng_anika',
    interviewId: 'int_anika_onboard',
    questionPrompt: 'Describe a time you led a cross-team initiative.',
    situation: 'Four engineering teams were independently building similar Kubernetes deployment patterns, leading to inconsistencies, duplicated effort, and production incidents due to configuration drift.',
    task: 'I proposed and was asked to lead a platform standardization initiative to create shared infrastructure patterns.',
    action: 'I facilitated workshops with all teams to understand their needs and identify common patterns. I designed a shared Helm chart library with sensible defaults and escape hatches for customization. I created comprehensive documentation and migration guides. I implemented a gradual rollout with each team, pairing with their leads to ensure smooth adoption.',
    result: 'All 4 teams migrated within 4 months. Deployment-related incidents dropped by 75%. New service setup time decreased from 2 weeks to 2 hours. Two teams reported 30% faster deployment velocity.',
    durationSeconds: 250,
    createdAt: daysAgo(90),
  },

  // Alex - Staff Backend (Java & System Design)
  {
    id: 'story_alex_1',
    engineerId: 'eng_alex',
    interviewId: 'int_alex_onboard',
    questionPrompt: 'Tell me about a system you designed from scratch.',
    situation: 'Our legacy order management system was a 15-year-old monolith that couldn\'t support our omnichannel retail expansion. Order processing took 30+ seconds and the system frequently crashed during sales events.',
    task: 'I was asked to design and lead the implementation of a new order management platform that could support real-time inventory, multiple fulfillment channels, and 100x the transaction volume.',
    action: 'I designed an event-sourced microservices architecture with domain-driven design principles. I chose Kafka for event streaming and implemented the saga pattern for distributed transactions. I established clear service boundaries and API contracts. I mentored 5 engineers through their first DDD implementation and conducted architecture reviews.',
    result: 'The new system processes orders in under 200ms with 99.99% uptime. It successfully handled Black Friday with zero incidents - our first ever. The architecture has scaled to support 3 new sales channels.',
    durationSeconds: 270,
    createdAt: daysAgo(88),
  },
  {
    id: 'story_alex_2',
    engineerId: 'eng_alex',
    interviewId: 'int_alex_onboard',
    questionPrompt: 'Describe a difficult technical decision you made.',
    situation: 'Our team was divided on whether to continue investing in our custom-built caching layer or migrate to Redis. The custom solution had institutional knowledge but was becoming unmaintainable.',
    task: 'As the technical lead, I needed to make a recommendation that would affect our architecture for years.',
    action: 'I created a decision framework evaluating both options across performance, maintainability, operational cost, and migration risk. I built proof-of-concepts for both paths. I facilitated discussions to ensure all concerns were heard and documented the decision rationale. I proposed a phased migration to Redis with clear milestones and rollback criteria.',
    result: 'The team aligned on Redis migration. We completed it in 6 months with no customer impact. Cache hit rates improved by 15%. Three engineers who had been skeptical became strong advocates after seeing the operational simplicity.',
    durationSeconds: 230,
    createdAt: daysAgo(88),
  },

  // Dmitri - Staff ML Engineer (Deep Learning & MLOps)
  {
    id: 'story_dmitri_1',
    engineerId: 'eng_dmitri',
    interviewId: 'int_dmitri_onboard',
    questionPrompt: 'Tell me about building ML infrastructure.',
    situation: 'Our data science team was spending 80% of their time on infrastructure and deployment rather than model development. Model deployments took 2 weeks and frequently failed. Experimentation was slow.',
    task: 'I was asked to build an ML platform that would accelerate model development and deployment while ensuring production reliability.',
    action: 'I designed an end-to-end ML platform with feature store, experiment tracking, model registry, and automated deployment pipelines. I implemented canary deployments with automatic rollback based on model quality metrics. I built integrations with our existing Kubernetes infrastructure. I ran training sessions and created documentation for 20+ data scientists.',
    result: 'Model deployment time reduced from 2 weeks to 4 hours. Data scientists now spend 70% of time on modeling vs 20% before. We\'ve deployed 5x more models per quarter. The platform is now used by all ML teams company-wide.',
    durationSeconds: 280,
    createdAt: daysAgo(82),
  },
  {
    id: 'story_dmitri_2',
    engineerId: 'eng_dmitri',
    interviewId: 'int_dmitri_onboard',
    questionPrompt: 'Describe a time you improved model performance significantly.',
    situation: 'Our drug discovery model was stuck at 72% accuracy, below the 85% threshold needed for clinical trial recommendations. The team had tried multiple architectures without improvement.',
    task: 'I was brought in to investigate and hopefully improve the model performance to meet clinical requirements.',
    action: 'I conducted systematic error analysis and discovered the model struggled with rare molecular structures. I implemented a multi-task learning approach that leveraged related prediction tasks. I created a novel data augmentation strategy using molecular transformations. I collaborated with domain experts to create a specialized pre-training corpus.',
    result: 'Model accuracy improved from 72% to 89%. The model is now used in clinical trial candidate selection. This work contributed to 2 papers and a patent application. The approach has been adopted by two other teams.',
    durationSeconds: 250,
    createdAt: daysAgo(82),
  },

  // Jennifer - Staff Frontend (React & Web Performance)
  {
    id: 'story_jennifer_1',
    engineerId: 'eng_jennifer',
    interviewId: 'int_jennifer_onboard',
    questionPrompt: 'Tell me about a major frontend architecture initiative.',
    situation: 'Our e-commerce frontend was a legacy jQuery application with slow page loads (8+ seconds), poor mobile experience, and difficulty adding new features. The business was losing customers to faster competitors.',
    task: 'I was tasked with leading the complete rebuild of our frontend while maintaining business continuity during the transition.',
    action: 'I designed a React-based micro-frontend architecture that allowed incremental migration. I implemented a component library with automated visual regression testing. I created a performance budget system with CI enforcement. I led a team of 6 engineers through the migration, conducting regular architecture reviews.',
    result: 'Page load time improved from 8s to 1.2s. Mobile conversion increased by 35%. We migrated 100% of pages in 9 months with zero production incidents. The component library is now used across 3 product teams.',
    durationSeconds: 265,
    createdAt: daysAgo(78),
  },
  {
    id: 'story_jennifer_2',
    engineerId: 'eng_jennifer',
    interviewId: 'int_jennifer_onboard',
    questionPrompt: 'Describe how you built and mentored a team.',
    situation: 'I joined a team of 4 mid-level engineers who had lost their tech lead. Morale was low, technical debt was high, and velocity had dropped significantly.',
    task: 'I needed to rebuild team health and technical practices while delivering on committed features.',
    action: 'I established weekly 1:1s to understand individual growth goals and concerns. I introduced structured code reviews focused on learning. I created a technical debt tracker and negotiated 20% time for addressing it. I set up architecture decision records and involved the team in key decisions. I coached two engineers through senior promotion preparations.',
    result: 'Team velocity increased 40% within 4 months. Both engineers I mentored were promoted to senior. Technical debt was reduced by 60%. The team won the company-wide engineering excellence award.',
    durationSeconds: 240,
    createdAt: daysAgo(78),
  },

  // Michael - Staff DevOps (AWS & Platform Engineering)
  {
    id: 'story_michael_1',
    engineerId: 'eng_michael',
    interviewId: 'int_michael_onboard',
    questionPrompt: 'Tell me about building platform infrastructure.',
    situation: 'Our company had 50+ services across 3 AWS accounts with inconsistent configurations, manual deployments, and frequent security issues. Compliance audits were consuming significant engineering time.',
    task: 'I was asked to design and implement a standardized platform that would enable self-service for development teams while maintaining security and compliance.',
    action: 'I designed a platform based on Kubernetes with GitOps principles. I created Terraform modules for account setup with built-in security controls. I implemented a service mesh for consistent observability. I built a developer portal for self-service provisioning. I established a platform team and trained them on operations.',
    result: 'Deployment frequency increased from weekly to multiple times daily. Security audit time reduced by 80%. New service provisioning went from 2 weeks to 30 minutes. Platform is now the foundation for all new services.',
    durationSeconds: 275,
    createdAt: daysAgo(105),
  },
  {
    id: 'story_michael_2',
    engineerId: 'eng_michael',
    interviewId: 'int_michael_onboard',
    questionPrompt: 'Describe managing a critical production incident.',
    situation: 'Our primary AWS region experienced a cascading failure during peak traffic. Multiple services were down, affecting thousands of customers. Initial triage suggested database connection pool exhaustion.',
    task: 'As the senior on-call engineer, I needed to coordinate incident response, restore service, and identify root cause.',
    action: 'I established a war room and assigned clear roles. I identified the connection pool issue and implemented emergency scaling. I discovered the root cause was a leaked connection from a recent deployment and coordinated a targeted rollback. I communicated status updates to stakeholders every 15 minutes. Post-incident, I led a blameless retrospective.',
    result: 'Service restored in 2 hours with no data loss. Root cause fixed with improved connection handling. I established new deployment safeguards that prevented 3 similar issues in the following months. The incident response became a company training case study.',
    durationSeconds: 250,
    createdAt: daysAgo(105),
  },

  // Sanjay - Staff Data Engineer (Spark & Real-time Systems)
  {
    id: 'story_sanjay_1',
    engineerId: 'eng_sanjay',
    interviewId: 'int_sanjay_onboard',
    questionPrompt: 'Tell me about building a data platform.',
    situation: 'Our analytics team was unable to answer business questions quickly because data was siloed across 20+ systems. Report generation took days and data quality was inconsistent.',
    task: 'I was asked to design a unified data platform that would enable self-service analytics with reliable, timely data.',
    action: 'I designed a lake house architecture combining real-time streaming and batch processing. I implemented CDC pipelines from all source systems using Kafka and Spark. I created a data quality framework with automated monitoring and alerting. I built a metadata catalog and lineage tracking. I trained analysts on the new platform.',
    result: 'Data freshness improved from days to minutes. Self-service queries increased by 400%. Data quality issues detected and resolved automatically. Platform supports 500+ daily users across all business functions.',
    durationSeconds: 260,
    createdAt: daysAgo(88),
  },
  {
    id: 'story_sanjay_2',
    engineerId: 'eng_sanjay',
    interviewId: 'int_sanjay_onboard',
    questionPrompt: 'Describe optimizing a critical data pipeline.',
    situation: 'Our recommendation engine data pipeline was consistently missing SLAs, taking 6 hours instead of the required 2. Business was considering abandoning personalization due to stale data.',
    task: 'I needed to optimize the pipeline to meet SLAs without additional infrastructure budget.',
    action: 'I profiled the pipeline and identified three bottlenecks: inefficient joins, redundant computations, and poor partitioning. I redesigned the join strategy using broadcast joins for dimension tables. I implemented incremental processing with Spark Structured Streaming. I optimized partitioning based on downstream query patterns.',
    result: 'Pipeline execution reduced from 6 hours to 45 minutes. Infrastructure costs actually decreased by 30% due to better resource utilization. Recommendations freshness enabled new personalization features worth $5M in annual revenue.',
    durationSeconds: 235,
    createdAt: daysAgo(88),
  },

  // Christine - Staff Full Stack (Healthcare & Fintech)
  {
    id: 'story_christine_1',
    engineerId: 'eng_christine',
    interviewId: 'int_christine_onboard',
    questionPrompt: 'Tell me about building systems with strict compliance requirements.',
    situation: 'Our healthcare payment platform needed to achieve both HIPAA and PCI-DSS compliance for a major hospital network partnership. Previous compliance efforts had failed audits twice.',
    task: 'I was asked to lead the engineering effort to achieve dual compliance while maintaining development velocity.',
    action: 'I mapped all compliance requirements to technical controls and identified gaps. I designed an architecture that isolated PCI and HIPAA data with appropriate encryption and access controls. I implemented comprehensive audit logging with tamper-proof storage. I created compliance-as-code with automated scanning in CI/CD. I prepared documentation and led engineer training.',
    result: 'Passed both HIPAA and PCI-DSS audits on first attempt. The hospital partnership was signed, worth $15M annually. The compliance framework became the template for 3 subsequent partnerships.',
    durationSeconds: 270,
    createdAt: daysAgo(75),
  },
  {
    id: 'story_christine_2',
    engineerId: 'eng_christine',
    interviewId: 'int_christine_onboard',
    questionPrompt: 'Describe integrating with complex third-party systems.',
    situation: 'We needed to integrate with 15 different hospital EHR systems, each with unique APIs, data formats, and authentication methods. Initial estimates suggested this would take 2+ years.',
    task: 'I was asked to find a way to accelerate the integration timeline to 6 months.',
    action: 'I designed an adapter architecture with a canonical data model and protocol abstraction layer. I created a configuration-driven integration framework that handled 80% of variation through configuration rather than code. I built a testing harness that simulated EHR responses. I trained 3 engineers on the framework and parallelized integration work.',
    result: 'Completed all 15 integrations in 5 months. New EHR integrations now take 2 weeks instead of 2 months. The framework reduced integration bugs by 70%. We\'re now the fastest integrator in our industry.',
    durationSeconds: 245,
    createdAt: daysAgo(75),
  },

  // Hassan - Staff Security Engineer (AppSec & Cloud Security)
  {
    id: 'story_hassan_1',
    engineerId: 'eng_hassan',
    interviewId: 'int_hassan_onboard',
    questionPrompt: 'Tell me about building a security program from scratch.',
    situation: 'Our fintech startup had grown rapidly to 100 engineers but had no formal security program. We were approaching SOC 2 requirements for enterprise customers and had failed an initial assessment.',
    task: 'I was hired to build and lead the security function, achieving SOC 2 Type II within 12 months.',
    action: 'I assessed current state and prioritized the highest-risk gaps. I implemented SAST/DAST in CI/CD with developer-friendly feedback. I designed IAM policies with least-privilege principles. I created a security champions program embedding security engineers in each team. I built an incident response program and ran tabletop exercises. I established vendor security review processes.',
    result: 'Achieved SOC 2 Type II certification in 10 months. Security vulnerabilities in production decreased by 85%. Mean time to remediation improved from 45 days to 5 days. Security is now a competitive advantage cited in sales deals.',
    durationSeconds: 280,
    createdAt: daysAgo(100),
  },
  {
    id: 'story_hassan_2',
    engineerId: 'eng_hassan',
    interviewId: 'int_hassan_onboard',
    questionPrompt: 'Describe responding to a sophisticated security threat.',
    situation: 'Our SOC detected unusual API patterns suggesting a potential breach. Initial investigation found evidence of API key compromise, with the attacker systematically exploring our endpoints.',
    task: 'I needed to contain the threat, assess the damage, and ensure no customer data was compromised.',
    action: 'I invoked our incident response plan and established a command structure. I worked with the team to identify the compromised credentials and rotate them without service disruption. I analyzed the attacker\'s access patterns to determine data exposure scope. I implemented additional monitoring for the attacker\'s TTPs. I coordinated customer notification with legal and communications teams.',
    result: 'Contained the threat within 3 hours with no customer data exfiltration confirmed. Identified the compromise source (phished developer credential) and implemented MFA enforcement. The incident response became a case study for our security training program.',
    durationSeconds: 260,
    createdAt: daysAgo(100),
  },

  // ============================================
  // Principal Engineers Stories (2 each, 0.90-0.98 scores)
  // ============================================

  // Victoria - Principal Architect (Distributed Systems & Cloud)
  {
    id: 'story_victoria_1',
    engineerId: 'eng_victoria',
    interviewId: 'int_victoria_onboard',
    questionPrompt: 'Tell me about leading a major architectural transformation.',
    situation: 'Our company\'s monolithic architecture was preventing us from scaling beyond 100M daily transactions. Engineering velocity had dropped 40% due to deployment conflicts and testing bottlenecks. The board had approved a multi-year platform modernization initiative.',
    task: 'As the principal architect, I was responsible for defining the target architecture, building consensus across 12 engineering teams, and establishing a migration strategy that wouldn\'t disrupt ongoing business.',
    action: 'I conducted a thorough domain analysis with team leads to identify bounded contexts, which informed our service decomposition strategy. I designed a strangler pattern approach that allowed incremental migration without big-bang rewrites. I established an Architecture Review Board to ensure consistent patterns and prevent fragmentation. I created architecture decision records (ADRs) to document and communicate design rationale. I paired with teams during their first service extractions to transfer knowledge and refine patterns. I implemented a service mesh to handle cross-cutting concerns like observability, security, and traffic management.',
    result: 'Migrated 8 of 12 major domains to microservices within 18 months. Platform now handles 500M daily transactions with 99.99% availability. Engineering velocity increased 60% as teams gained independent deployment capability. The architecture became a reference implementation shared at industry conferences.',
    durationSeconds: 320,
    createdAt: daysAgo(145),
  },
  {
    id: 'story_victoria_2',
    engineerId: 'eng_victoria',
    interviewId: 'int_victoria_onboard',
    questionPrompt: 'Describe how you influenced technical direction across the organization.',
    situation: 'Each of our 12 engineering teams had independently chosen different technologies for similar problems—5 different message queues, 4 different caching solutions, 3 different API gateway patterns. This fragmentation was driving up operational costs and making cross-team collaboration difficult.',
    task: 'I needed to establish technology standards without stifling innovation or creating resentment among teams who had invested in their current solutions.',
    action: 'I created a Technology Radar process inspired by ThoughtWorks, involving senior engineers from all teams in evaluating technologies. I established clear criteria: operational maturity, team expertise, vendor support, and total cost of ownership. I led working groups to develop golden path templates for common patterns. I created an exception process for legitimate innovation needs outside the standard path. I demonstrated quick wins by helping teams migrate to standardized solutions with measurable improvements.',
    result: 'Consolidated to 2 message queues, 2 caching solutions, and 1 API gateway pattern within 12 months. Operational costs decreased 35%. On-call incidents related to infrastructure knowledge gaps dropped 50%. The Technology Radar became a quarterly ritual that engineers actually looked forward to.',
    durationSeconds: 280,
    createdAt: daysAgo(140),
  },

  // Robert - Principal ML Architect (AI Systems & Strategy)
  {
    id: 'story_robert_1',
    engineerId: 'eng_robert',
    interviewId: 'int_robert_onboard',
    questionPrompt: 'Tell me about building an ML platform from the ground up.',
    situation: 'Our healthcare company had 15 data science teams all building bespoke ML pipelines. Model deployment took 3-6 months, experiment tracking was inconsistent, and we had no visibility into model performance in production. This was creating significant regulatory risk and slowing our ability to deliver ML-powered features.',
    task: 'As the founding ML architect, I was responsible for designing and building a centralized ML platform that would standardize the ML lifecycle while supporting diverse use cases from computer vision to NLP to traditional ML.',
    action: 'I interviewed every data science team to understand their workflows, pain points, and unique requirements. I designed a layered platform architecture with flexible abstractions—teams could use high-level APIs for common patterns or drop down to lower-level primitives for specialized needs. I built a feature store that unified feature engineering across teams and enabled feature reuse. I implemented model registry with automated lineage tracking for regulatory compliance. I created deployment pipelines with automated canary releases and model monitoring. I established ML ops practices including model validation, A/B testing frameworks, and automated retraining triggers.',
    result: 'Platform now serves 20 teams and 150+ models in production. Model deployment time reduced from 3 months to 2 weeks. Feature reuse across teams increased 70%, reducing redundant computation costs by $2M annually. Passed FDA audit for our ML-based diagnostic tools with model governance capabilities.',
    durationSeconds: 340,
    createdAt: daysAgo(175),
  },
  {
    id: 'story_robert_2',
    engineerId: 'eng_robert',
    interviewId: 'int_robert_onboard',
    questionPrompt: 'Describe establishing ML best practices across an organization.',
    situation: 'After several high-profile ML model failures in production—including a recommendation system that amplified bias and a forecasting model that silently degraded—leadership mandated improved ML governance. However, there was significant resistance from data scientists who viewed governance as bureaucratic overhead.',
    task: 'I needed to design ML governance processes that genuinely improved model quality and reliability without creating excessive friction for teams.',
    action: 'I worked with legal and compliance to understand regulatory requirements and translated them into practical engineering controls. I designed a tiered review process—lightweight automated checks for low-risk models, deeper review for customer-facing or decision-critical models. I built automated bias detection and fairness testing into the CI/CD pipeline. I created model cards as living documentation that evolved through the model lifecycle. I established an ML incident review process that focused on learning rather than blame. I trained ML review committee members across the organization to scale review capacity.',
    result: 'Model-related production incidents decreased 80% over 18 months. Bias detection caught 3 potentially problematic models before production deployment. Regulatory compliance audit findings related to ML decreased from 12 to 2. Survey showed 75% of data scientists found the governance process improved their confidence in deployments.',
    durationSeconds: 300,
    createdAt: daysAgo(170),
  },

  // Elena - Principal Security Architect (Enterprise Security)
  {
    id: 'story_elena_1',
    engineerId: 'eng_elena',
    interviewId: 'int_elena_onboard',
    questionPrompt: 'Tell me about designing a zero-trust security architecture.',
    situation: 'Our financial services company was transitioning from an on-premises model to hybrid cloud. The traditional perimeter-based security model was no longer sufficient—we had employees working remotely, partners accessing our APIs, and workloads distributed across multiple cloud providers. A recent penetration test revealed that once inside the network, lateral movement was trivially easy.',
    task: 'As principal security architect, I was responsible for designing and implementing a zero-trust architecture that would protect our most sensitive financial data while enabling the business agility leadership demanded.',
    action: 'I established zero-trust principles: verify explicitly, use least privilege access, assume breach. I designed identity as the new perimeter with strong authentication for all users, devices, and services. I implemented microsegmentation using service mesh to limit blast radius of any compromise. I deployed a SASE solution for secure access regardless of user location. I created a data classification framework and implemented DLP controls aligned to sensitivity levels. I built security observability with SIEM integration and automated threat detection. I established security champions in each engineering team to distribute security expertise.',
    result: 'Completed zero-trust implementation across 200+ services in 24 months. External penetration test showed lateral movement now detected and contained within minutes versus previously undetected for days. Achieved SOC 2 Type II and PCI DSS compliance ahead of schedule. Security incidents requiring investigation decreased 60% due to reduced attack surface.',
    durationSeconds: 320,
    createdAt: daysAgo(155),
  },
  {
    id: 'story_elena_2',
    engineerId: 'eng_elena',
    interviewId: 'int_elena_onboard',
    questionPrompt: 'Describe leading security response to a significant threat.',
    situation: 'We discovered through threat intelligence sharing that a nation-state actor was actively targeting companies in our sector using a novel supply chain attack vector. Several peer institutions had already been compromised. Our security team found indicators suggesting reconnaissance activity against our systems.',
    task: 'I needed to lead our response to a sophisticated, active threat while avoiding both over-reaction that would disrupt business operations and under-reaction that would leave us vulnerable.',
    action: 'I established a threat response team with representatives from security, engineering, legal, and communications. I led a rapid threat model update focused on the specific attack vectors being exploited. I implemented additional monitoring for the specific IOCs and TTPs associated with this actor. I coordinated a supply chain security review, auditing our software dependencies and build pipelines. I worked with our vendors to understand their security posture and incident response capabilities. I briefed the board and executive team on threat level and our response measures. I participated in industry threat sharing to contribute our findings and learn from others.',
    result: 'Successfully defended against the campaign—forensic analysis confirmed reconnaissance but no compromise. Identified and remediated 3 supply chain vulnerabilities before they could be exploited. Our threat intelligence became valuable to industry partners. The experience led to permanent improvements in our supply chain security program.',
    durationSeconds: 290,
    createdAt: daysAgo(150),
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

  // ============================================
  // Junior Engineer Story Analyses (0.75-0.85 range)
  // ============================================

  // Maya's analyses
  {
    id: 'analysis_maya_1',
    storyId: 'story_maya_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(24),
    clarityScore: 0.82,
    impactScore: 0.78,
    ownershipScore: 0.80,
    overallScore: 0.80,
    reasoning: 'Good demonstration of fast learning. Created documentation for team benefit. Scope appropriate for junior level. Could quantify migration complexity more.',
    flags: [],
  },
  {
    id: 'analysis_maya_2',
    storyId: 'story_maya_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(24),
    clarityScore: 0.80,
    impactScore: 0.75,
    ownershipScore: 0.78,
    overallScore: 0.78,
    reasoning: 'Proactive communication demonstrated. Good collaboration approach. Impact is process-focused rather than metric-focused, appropriate for experience level.',
    flags: [],
  },

  // Kevin's analyses
  {
    id: 'analysis_kevin_1',
    storyId: 'story_kevin_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(39),
    clarityScore: 0.84,
    impactScore: 0.80,
    ownershipScore: 0.82,
    overallScore: 0.82,
    reasoning: 'Systematic debugging approach. Added regression tests showing mature engineering habits. Clear action sequence under pressure.',
    flags: [],
  },
  {
    id: 'analysis_kevin_2',
    storyId: 'story_kevin_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(39),
    clarityScore: 0.82,
    impactScore: 0.78,
    ownershipScore: 0.85,
    overallScore: 0.82,
    reasoning: 'Strong initiative demonstrated. Took ownership beyond role. Quantified impact on onboarding time. Docker improvement shows technical judgment.',
    flags: [],
  },

  // Jordan's analyses
  {
    id: 'analysis_jordan_1',
    storyId: 'story_jordan_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(54),
    clarityScore: 0.78,
    impactScore: 0.75,
    ownershipScore: 0.80,
    overallScore: 0.78,
    reasoning: 'Healthy response to feedback. Sought to understand rather than defend. Applied learning to future work. Growth mindset evident.',
    flags: [],
  },
  {
    id: 'analysis_jordan_2',
    storyId: 'story_jordan_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(54),
    clarityScore: 0.80,
    impactScore: 0.76,
    ownershipScore: 0.78,
    overallScore: 0.78,
    reasoning: 'Good team citizenship. Empathetic approach to helping new team member. Normalized learning curve appropriately. Short-term but meaningful impact.',
    flags: [],
  },

  // Carlos's analyses
  {
    id: 'analysis_carlos_1',
    storyId: 'story_carlos_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(49),
    clarityScore: 0.84,
    impactScore: 0.82,
    ownershipScore: 0.85,
    overallScore: 0.84,
    reasoning: 'Full-stack ownership demonstrated. API-first approach and cross-team coordination impressive for experience level. Good adoption metrics.',
    flags: [],
  },
  {
    id: 'analysis_carlos_2',
    storyId: 'story_carlos_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(49),
    clarityScore: 0.80,
    impactScore: 0.78,
    ownershipScore: 0.82,
    overallScore: 0.80,
    reasoning: 'Good adaptability to changing requirements. Proposed pragmatic phased approach. Clear stakeholder communication. Modular code design shows foresight.',
    flags: [],
  },

  // Ashley's analyses
  {
    id: 'analysis_ashley_1',
    storyId: 'story_ashley_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(14),
    clarityScore: 0.78,
    impactScore: 0.75,
    ownershipScore: 0.80,
    overallScore: 0.78,
    reasoning: 'Strong curiosity and initiative. Self-directed learning led to team adoption. Lunch-and-learn shows knowledge sharing. Good for 1 YoE.',
    flags: [],
  },
  {
    id: 'analysis_ashley_2',
    storyId: 'story_ashley_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(14),
    clarityScore: 0.80,
    impactScore: 0.76,
    ownershipScore: 0.78,
    overallScore: 0.78,
    reasoning: 'Good attention to detail catching bug. Went beyond fix to propose systemic solution. Testing focus shows quality mindset.',
    flags: [],
  },

  // Tyler's analyses
  {
    id: 'analysis_tyler_1',
    storyId: 'story_tyler_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(29),
    clarityScore: 0.82,
    impactScore: 0.80,
    ownershipScore: 0.82,
    overallScore: 0.82,
    reasoning: 'Proactive improvement to team processes. Quantified impact on review comments. Considered tradeoffs (build time). Good DevEx initiative.',
    flags: [],
  },
  {
    id: 'analysis_tyler_2',
    storyId: 'story_tyler_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(29),
    clarityScore: 0.80,
    impactScore: 0.82,
    ownershipScore: 0.78,
    overallScore: 0.80,
    reasoning: 'Handled pressure well. Time-boxed debugging before escalating. Maintained quality under pressure. Clear impact on business outcome.',
    flags: [],
  },

  // ============================================
  // Mid-Level Engineer Story Analyses (0.82-0.92 range)
  // ============================================

  // Rachel's analyses (High-performing)
  {
    id: 'analysis_rachel_1',
    storyId: 'story_rachel_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(39),
    clarityScore: 0.92,
    impactScore: 0.90,
    ownershipScore: 0.88,
    overallScore: 0.90,
    reasoning: 'Excellent technical depth in performance optimization. Clear metrics (4.2s to 0.8s). Proactive monitoring setup. Documentation shows team orientation.',
    flags: [],
  },
  {
    id: 'analysis_rachel_2',
    storyId: 'story_rachel_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(39),
    clarityScore: 0.88,
    impactScore: 0.85,
    ownershipScore: 0.88,
    overallScore: 0.87,
    reasoning: 'Strong mentorship approach with structured exercises. Measured outcome (independent in 2 months). Multiplier effect (mentee now mentoring).',
    flags: [],
  },

  // Lisa's analyses (High-performing)
  {
    id: 'analysis_lisa_1',
    storyId: 'story_lisa_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(74),
    clarityScore: 0.94,
    impactScore: 0.92,
    ownershipScore: 0.90,
    overallScore: 0.92,
    reasoning: 'Exceptional scale and performance metrics (15M req/s, 0.4ms p99). Strong distributed systems fundamentals. Design became organizational template.',
    flags: [],
  },
  {
    id: 'analysis_lisa_2',
    storyId: 'story_lisa_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(74),
    clarityScore: 0.90,
    impactScore: 0.88,
    ownershipScore: 0.85,
    overallScore: 0.88,
    reasoning: 'Sophisticated debugging approach using distributed tracing. Root cause identification (clock skew) shows deep systems understanding. Careful rollout with feature flags.',
    flags: [],
  },

  // Zoe's analyses (Startup Generalist)
  {
    id: 'analysis_zoe_1',
    storyId: 'story_zoe_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(47),
    clarityScore: 0.88,
    impactScore: 0.90,
    ownershipScore: 0.92,
    overallScore: 0.90,
    reasoning: 'Strong 0→1 ownership. Pragmatic technology choices. User-focused iteration. Business impact (seed funding) demonstrates effectiveness.',
    flags: [],
  },
  {
    id: 'analysis_zoe_2',
    storyId: 'story_zoe_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(47),
    clarityScore: 0.86,
    impactScore: 0.88,
    ownershipScore: 0.85,
    overallScore: 0.86,
    reasoning: 'Structured decision-making under uncertainty. Customer-driven validation. Clear communication of tradeoffs. Process became template.',
    flags: [],
  },

  // David's analyses
  {
    id: 'analysis_david_1',
    storyId: 'story_david_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(64),
    clarityScore: 0.86,
    impactScore: 0.84,
    ownershipScore: 0.85,
    overallScore: 0.85,
    reasoning: 'Thorough compliance understanding. Passed audit on first attempt shows attention to detail. Documentation focus valuable for healthcare.',
    flags: [],
  },
  {
    id: 'analysis_david_2',
    storyId: 'story_david_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(64),
    clarityScore: 0.84,
    impactScore: 0.86,
    ownershipScore: 0.82,
    overallScore: 0.84,
    reasoning: 'Good migration strategy (strangler fig). Zero downtime achievement. Clear velocity improvement metrics (3x faster).',
    flags: [],
  },

  // Mohammed's analyses
  {
    id: 'analysis_mohammed_1',
    storyId: 'story_mohammed_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(59),
    clarityScore: 0.88,
    impactScore: 0.88,
    ownershipScore: 0.85,
    overallScore: 0.87,
    reasoning: 'Comprehensive pipeline analysis. Multiple improvements in parallel. Strong metrics (45min→12min, 30%→2% failure). Cultural change (Friday deploys).',
    flags: [],
  },
  {
    id: 'analysis_mohammed_2',
    storyId: 'story_mohammed_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(59),
    clarityScore: 0.86,
    impactScore: 0.84,
    ownershipScore: 0.88,
    overallScore: 0.86,
    reasoning: 'Cool-headed incident response. Minimal data loss (12 seconds). Proactive prevention with fencing mechanism. Strong post-mortem leadership.',
    flags: [],
  },

  // Aisha's analyses
  {
    id: 'analysis_aisha_1',
    storyId: 'story_aisha_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(49),
    clarityScore: 0.88,
    impactScore: 0.90,
    ownershipScore: 0.86,
    overallScore: 0.88,
    reasoning: 'End-to-end ML ownership from data to production. Business impact quantified ($2M revenue). MLOps focus shows operational maturity.',
    flags: [],
  },
  {
    id: 'analysis_aisha_2',
    storyId: 'story_aisha_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(49),
    clarityScore: 0.86,
    impactScore: 0.85,
    ownershipScore: 0.84,
    overallScore: 0.85,
    reasoning: 'Strong stakeholder communication. Creative solution with explainability dashboard. Feedback loop shows user-centered approach.',
    flags: [],
  },

  // Ryan's analyses
  {
    id: 'analysis_ryan_1',
    storyId: 'story_ryan_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(44),
    clarityScore: 0.86,
    impactScore: 0.85,
    ownershipScore: 0.84,
    overallScore: 0.85,
    reasoning: 'Good cross-platform ownership. Offline-first shows user empathy. Strong launch metrics (100K downloads, 4.6 stars).',
    flags: [],
  },
  {
    id: 'analysis_ryan_2',
    storyId: 'story_ryan_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(44),
    clarityScore: 0.84,
    impactScore: 0.86,
    ownershipScore: 0.82,
    overallScore: 0.84,
    reasoning: 'Systematic performance optimization. Clear before/after metrics (20%→6% battery). Documentation for team benefit.',
    flags: [],
  },

  // Emma's analyses
  {
    id: 'analysis_emma_1',
    storyId: 'story_emma_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(29),
    clarityScore: 0.88,
    impactScore: 0.86,
    ownershipScore: 0.88,
    overallScore: 0.87,
    reasoning: 'Strong cross-team coordination. Design system adoption (90%) shows change management skills. Measurable handoff improvement (60%).',
    flags: [],
  },
  {
    id: 'analysis_emma_2',
    storyId: 'story_emma_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(29),
    clarityScore: 0.86,
    impactScore: 0.88,
    ownershipScore: 0.84,
    overallScore: 0.86,
    reasoning: 'User-centered accessibility approach. Partnership with actual user shows empathy. CI integration prevents future issues.',
    flags: [],
  },

  // Senior Engineer Story Analyses

  // Greg - COASTING SENIOR (lower scores, competent but not exceptional)
  {
    id: 'analysis_greg_1',
    storyId: 'story_greg_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(79),
    clarityScore: 0.76,
    impactScore: 0.70,
    ownershipScore: 0.72,
    overallScore: 0.72,
    reasoning: 'Basic STAR structure but lacks specific metrics. Migration was routine maintenance rather than innovation. Limited evidence of leadership or broader impact.',
    flags: ['lacks_specific_metrics'],
  },
  {
    id: 'analysis_greg_2',
    storyId: 'story_greg_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(79),
    clarityScore: 0.74,
    impactScore: 0.68,
    ownershipScore: 0.70,
    overallScore: 0.70,
    reasoning: 'Helpful but reactive assistance. No structured mentorship approach or lasting impact beyond the immediate situation.',
    flags: ['vague_impact'],
  },

  // Natasha - COASTING SENIOR (competent, safe choices)
  {
    id: 'analysis_natasha_1',
    storyId: 'story_natasha_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(69),
    clarityScore: 0.78,
    impactScore: 0.72,
    ownershipScore: 0.74,
    overallScore: 0.74,
    reasoning: 'Clear feature delivery but straightforward scope. Followed mockups rather than driving product decisions. Impact is functional but not transformative.',
    flags: [],
  },
  {
    id: 'analysis_natasha_2',
    storyId: 'story_natasha_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(69),
    clarityScore: 0.76,
    impactScore: 0.74,
    ownershipScore: 0.72,
    overallScore: 0.74,
    reasoning: 'Good debugging process but standard troubleshooting. No systemic improvements or prevention strategies discussed.',
    flags: [],
  },

  // Nathan - BIG-TECH SPECIALIST (high scores, system design excellence)
  {
    id: 'analysis_nathan_1',
    storyId: 'story_nathan_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(34),
    clarityScore: 0.94,
    impactScore: 0.96,
    ownershipScore: 0.92,
    overallScore: 0.94,
    reasoning: 'Exceptional system design story with massive scale impact. Clear articulation of technical decisions and business outcomes. Strong ownership and cross-team influence.',
    flags: [],
  },
  {
    id: 'analysis_nathan_2',
    storyId: 'story_nathan_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(34),
    clarityScore: 0.92,
    impactScore: 0.90,
    ownershipScore: 0.94,
    overallScore: 0.92,
    reasoning: 'Excellent handling of high-stakes ethical situation. Clear decision framework with appropriate stakeholder involvement. Lasting organizational impact through training materials.',
    flags: [],
  },

  // Wei - BIG-TECH SPECIALIST (high scores, scale expertise)
  {
    id: 'analysis_wei_1',
    storyId: 'story_wei_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(74),
    clarityScore: 0.94,
    impactScore: 0.96,
    ownershipScore: 0.90,
    overallScore: 0.94,
    reasoning: 'Outstanding scale achievement with clear technical depth. Specific metrics demonstrate impact. System longevity shows quality of design.',
    flags: [],
  },
  {
    id: 'analysis_wei_2',
    storyId: 'story_wei_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(74),
    clarityScore: 0.90,
    impactScore: 0.88,
    ownershipScore: 0.92,
    overallScore: 0.90,
    reasoning: 'Strong team leadership through knowledge transfer. Structured approach to migration with appropriate risk management. Lasting impact through developing other experts.',
    flags: [],
  },

  // Derek - STARTUP GENERALIST Senior (high ownership, broad impact)
  {
    id: 'analysis_derek_1',
    storyId: 'story_derek_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(31),
    clarityScore: 0.90,
    impactScore: 0.92,
    ownershipScore: 0.96,
    overallScore: 0.92,
    reasoning: 'Exceptional ownership across multiple dimensions - hiring, architecture, culture. Strong metrics on team growth and technical outcomes. Demonstrates startup leadership well.',
    flags: [],
  },
  {
    id: 'analysis_derek_2',
    storyId: 'story_derek_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(31),
    clarityScore: 0.88,
    impactScore: 0.90,
    ownershipScore: 0.92,
    overallScore: 0.90,
    reasoning: 'Excellent cost optimization with specific metrics. Multiple approaches show thorough analysis. Business context understanding strong.',
    flags: [],
  },

  // Takeshi - Standard Senior (good scores, technical depth)
  {
    id: 'analysis_takeshi_1',
    storyId: 'story_takeshi_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(84),
    clarityScore: 0.90,
    impactScore: 0.88,
    ownershipScore: 0.86,
    overallScore: 0.88,
    reasoning: 'Strong architecture story with clear patterns. Good cross-functional coordination. Impact metrics could be more specific.',
    flags: [],
  },
  {
    id: 'analysis_takeshi_2',
    storyId: 'story_takeshi_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(84),
    clarityScore: 0.88,
    impactScore: 0.86,
    ownershipScore: 0.88,
    overallScore: 0.86,
    reasoning: 'Excellent debugging methodology. Knowledge sharing and process improvement show leadership beyond immediate fix.',
    flags: [],
  },

  // Sarah - Standard Senior (strong frontend excellence)
  {
    id: 'analysis_sarah_1',
    storyId: 'story_sarah_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(54),
    clarityScore: 0.90,
    impactScore: 0.92,
    ownershipScore: 0.88,
    overallScore: 0.90,
    reasoning: 'Clear performance optimization with specific metrics. Business impact tied to conversion improvement. Good documentation of learnings.',
    flags: [],
  },
  {
    id: 'analysis_sarah_2',
    storyId: 'story_sarah_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(54),
    clarityScore: 0.86,
    impactScore: 0.84,
    ownershipScore: 0.88,
    overallScore: 0.86,
    reasoning: 'Good team process improvement with buy-in approach. Multiple interventions show systematic thinking. Survey data validates impact.',
    flags: [],
  },

  // Ravi - Standard Senior (healthcare compliance expertise)
  {
    id: 'analysis_ravi_1',
    storyId: 'story_ravi_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(49),
    clarityScore: 0.92,
    impactScore: 0.90,
    ownershipScore: 0.88,
    overallScore: 0.90,
    reasoning: 'Excellent handling of compliance requirements with technical innovation. Performance metrics show engineering quality. External validation from auditors is strong.',
    flags: [],
  },
  {
    id: 'analysis_ravi_2',
    storyId: 'story_ravi_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(49),
    clarityScore: 0.86,
    impactScore: 0.86,
    ownershipScore: 0.84,
    overallScore: 0.86,
    reasoning: 'Good balance of business and technical priorities. Incremental approach shows pragmatism. Transparent stakeholder communication.',
    flags: [],
  },

  // Olivia - Standard Senior (ML deployment expertise)
  {
    id: 'analysis_olivia_1',
    storyId: 'story_olivia_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(64),
    clarityScore: 0.90,
    impactScore: 0.92,
    ownershipScore: 0.88,
    overallScore: 0.90,
    reasoning: 'Excellent productionization story addressing both technical and human factors. User-centered design with explainability. Strong adoption metrics.',
    flags: [],
  },
  {
    id: 'analysis_olivia_2',
    storyId: 'story_olivia_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(64),
    clarityScore: 0.88,
    impactScore: 0.94,
    ownershipScore: 0.86,
    overallScore: 0.90,
    reasoning: 'Systematic error analysis and creative solutions. Hybrid approach shows strong ML fundamentals. Publication demonstrates external impact.',
    flags: [],
  },

  // Lucas - Standard Senior (security at scale)
  {
    id: 'analysis_lucas_1',
    storyId: 'story_lucas_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(59),
    clarityScore: 0.92,
    impactScore: 0.90,
    ownershipScore: 0.90,
    overallScore: 0.90,
    reasoning: 'Strong security-as-code approach at scale. Developer experience consideration shows maturity. SOC 2 certification is concrete milestone.',
    flags: [],
  },
  {
    id: 'analysis_lucas_2',
    storyId: 'story_lucas_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(59),
    clarityScore: 0.88,
    impactScore: 0.90,
    ownershipScore: 0.92,
    overallScore: 0.90,
    reasoning: 'Excellent incident response with minimal customer impact. Proactive prevention measures show security mindset. Clear timeline and actions.',
    flags: [],
  },

  // Staff Engineer Story Analyses (0.88-0.96 range)

  // Anika - Staff Platform Engineer
  {
    id: 'analysis_anika_1',
    storyId: 'story_anika_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(89),
    clarityScore: 0.94,
    impactScore: 0.96,
    ownershipScore: 0.94,
    overallScore: 0.94,
    reasoning: 'Exceptional scale achievement (10x) with clear technical depth. Financial impact quantified ($2M savings). Strong ownership of critical infrastructure.',
    flags: [],
  },
  {
    id: 'analysis_anika_2',
    storyId: 'story_anika_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(89),
    clarityScore: 0.92,
    impactScore: 0.90,
    ownershipScore: 0.94,
    overallScore: 0.92,
    reasoning: 'Strong cross-team leadership. Measurable outcomes (75% incident reduction, 2 weeks to 2 hours). Good balance of standardization and flexibility.',
    flags: [],
  },

  // Alex - Staff Backend
  {
    id: 'analysis_alex_1',
    storyId: 'story_alex_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(87),
    clarityScore: 0.94,
    impactScore: 0.94,
    ownershipScore: 0.92,
    overallScore: 0.94,
    reasoning: 'Excellent system design story with clear architectural principles. Business impact (Black Friday success) demonstrates real-world validation. Strong mentorship element.',
    flags: [],
  },
  {
    id: 'analysis_alex_2',
    storyId: 'story_alex_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(87),
    clarityScore: 0.90,
    impactScore: 0.88,
    ownershipScore: 0.92,
    overallScore: 0.90,
    reasoning: 'Good decision framework and stakeholder management. Proof-of-concept approach demonstrates thoroughness. Team alignment outcome strong.',
    flags: [],
  },

  // Dmitri - Staff ML Engineer
  {
    id: 'analysis_dmitri_1',
    storyId: 'story_dmitri_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(81),
    clarityScore: 0.94,
    impactScore: 0.96,
    ownershipScore: 0.92,
    overallScore: 0.94,
    reasoning: 'Transformative platform impact (2 weeks to 4 hours). Multiplier effect across organization. Strong technical depth with practical outcomes.',
    flags: [],
  },
  {
    id: 'analysis_dmitri_2',
    storyId: 'story_dmitri_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(81),
    clarityScore: 0.92,
    impactScore: 0.94,
    ownershipScore: 0.90,
    overallScore: 0.92,
    reasoning: 'Strong ML fundamentals with practical innovation. External impact (papers, patent). Cross-functional collaboration with domain experts.',
    flags: [],
  },

  // Jennifer - Staff Frontend
  {
    id: 'analysis_jennifer_1',
    storyId: 'story_jennifer_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(77),
    clarityScore: 0.92,
    impactScore: 0.94,
    ownershipScore: 0.92,
    overallScore: 0.92,
    reasoning: 'Significant business impact (35% mobile conversion). Zero-incident migration shows careful execution. Architecture decisions scaled beyond initial scope.',
    flags: [],
  },
  {
    id: 'analysis_jennifer_2',
    storyId: 'story_jennifer_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(77),
    clarityScore: 0.90,
    impactScore: 0.92,
    ownershipScore: 0.94,
    overallScore: 0.92,
    reasoning: 'Excellent team leadership and mentorship. Multiple outcome metrics (velocity, promotions, awards). Balanced technical and people management.',
    flags: [],
  },

  // Michael - Staff DevOps
  {
    id: 'analysis_michael_1',
    storyId: 'story_michael_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(104),
    clarityScore: 0.94,
    impactScore: 0.94,
    ownershipScore: 0.92,
    overallScore: 0.94,
    reasoning: 'Comprehensive platform vision with strong execution. Self-service focus shows developer empathy. Security and compliance built-in from start.',
    flags: [],
  },
  {
    id: 'analysis_michael_2',
    storyId: 'story_michael_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(104),
    clarityScore: 0.92,
    impactScore: 0.90,
    ownershipScore: 0.94,
    overallScore: 0.92,
    reasoning: 'Excellent incident leadership. Clear communication and decision-making under pressure. Lasting impact through safeguards and training.',
    flags: [],
  },

  // Sanjay - Staff Data Engineer
  {
    id: 'analysis_sanjay_1',
    storyId: 'story_sanjay_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(87),
    clarityScore: 0.94,
    impactScore: 0.94,
    ownershipScore: 0.90,
    overallScore: 0.92,
    reasoning: 'Strong data platform architecture. 400% increase in self-service queries shows adoption success. Data quality focus demonstrates maturity.',
    flags: [],
  },
  {
    id: 'analysis_sanjay_2',
    storyId: 'story_sanjay_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(87),
    clarityScore: 0.90,
    impactScore: 0.94,
    ownershipScore: 0.88,
    overallScore: 0.90,
    reasoning: 'Excellent optimization with business impact ($5M revenue). Cost reduction with performance improvement. Clear problem analysis.',
    flags: [],
  },

  // Christine - Staff Full Stack
  {
    id: 'analysis_christine_1',
    storyId: 'story_christine_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(74),
    clarityScore: 0.92,
    impactScore: 0.94,
    ownershipScore: 0.92,
    overallScore: 0.92,
    reasoning: 'Dual compliance achievement on first attempt impressive. Clear business impact ($15M partnership). Scalable framework created.',
    flags: [],
  },
  {
    id: 'analysis_christine_2',
    storyId: 'story_christine_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(74),
    clarityScore: 0.90,
    impactScore: 0.92,
    ownershipScore: 0.90,
    overallScore: 0.90,
    reasoning: 'Smart approach to integration complexity. 2+ years to 5 months is exceptional acceleration. Reusable framework multiplies impact.',
    flags: [],
  },

  // Hassan - Staff Security Engineer
  {
    id: 'analysis_hassan_1',
    storyId: 'story_hassan_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(99),
    clarityScore: 0.94,
    impactScore: 0.96,
    ownershipScore: 0.94,
    overallScore: 0.94,
    reasoning: 'Built security function from scratch. SOC 2 achieved ahead of schedule. Multiple programs established (champions, incident response, vendor review).',
    flags: [],
  },
  {
    id: 'analysis_hassan_2',
    storyId: 'story_hassan_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(99),
    clarityScore: 0.92,
    impactScore: 0.92,
    ownershipScore: 0.94,
    overallScore: 0.92,
    reasoning: 'Effective incident response under pressure. Proper coordination with legal and comms. Root cause addressed (MFA enforcement).',
    flags: [],
  },

  // ============================================
  // Principal Engineers Story Analyses (0.90-0.98 scores)
  // ============================================

  // Victoria - Principal Architect
  {
    id: 'analysis_victoria_1',
    storyId: 'story_victoria_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(143),
    clarityScore: 0.96,
    impactScore: 0.98,
    ownershipScore: 0.96,
    overallScore: 0.96,
    reasoning: 'Exceptional architectural leadership across 12 teams. 5x scaling achieved with 99.99% availability. Clear strategy with measurable business impact. Strong mentorship through pairing and ADRs.',
    flags: [],
  },
  {
    id: 'analysis_victoria_2',
    storyId: 'story_victoria_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(138),
    clarityScore: 0.94,
    impactScore: 0.92,
    ownershipScore: 0.96,
    overallScore: 0.94,
    reasoning: 'Excellent organizational influence without authority. Built consensus through inclusive process. 35% cost reduction with measurable engineer satisfaction.',
    flags: [],
  },

  // Robert - Principal ML Architect
  {
    id: 'analysis_robert_1',
    storyId: 'story_robert_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(173),
    clarityScore: 0.96,
    impactScore: 0.98,
    ownershipScore: 0.96,
    overallScore: 0.96,
    reasoning: 'Built ML platform serving 150+ models. 6x deployment time reduction. Passed FDA audit. $2M annual cost savings from feature reuse. Exceptional scope and impact.',
    flags: [],
  },
  {
    id: 'analysis_robert_2',
    storyId: 'story_robert_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(168),
    clarityScore: 0.94,
    impactScore: 0.94,
    ownershipScore: 0.92,
    overallScore: 0.94,
    reasoning: '80% reduction in ML incidents. Built governance that engineers actually value. Bias detection prevented production issues. Strong regulatory compliance improvement.',
    flags: [],
  },

  // Elena - Principal Security Architect
  {
    id: 'analysis_elena_1',
    storyId: 'story_elena_1',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(153),
    clarityScore: 0.96,
    impactScore: 0.96,
    ownershipScore: 0.94,
    overallScore: 0.96,
    reasoning: 'Comprehensive zero-trust transformation across 200+ services. Compliance achieved ahead of schedule. 60% reduction in security incidents. Strong security culture through champions program.',
    flags: [],
  },
  {
    id: 'analysis_elena_2',
    storyId: 'story_elena_2',
    analyzerModel: 'claude-sonnet-4-20250514',
    analyzedAt: daysAgo(148),
    clarityScore: 0.94,
    impactScore: 0.94,
    ownershipScore: 0.96,
    overallScore: 0.94,
    reasoning: 'Successfully defended against nation-state threat. Balanced response without business disruption. Proactive vulnerability remediation. Contributed to industry threat sharing.',
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

  // ============================================
  // Junior Engineer Story Demonstrations
  // ============================================

  // Maya story 1
  { storyId: 'story_maya_1', skillId: 'skill_learning', strength: 0.85, notes: 'Learned React hooks quickly over a weekend' },
  { storyId: 'story_maya_1', skillId: 'skill_react', strength: 0.78, notes: 'Migrated settings page to React hooks' },
  { storyId: 'story_maya_1', skillId: 'skill_documentation', strength: 0.72, notes: 'Created team reference for hooks patterns' },

  // Maya story 2
  { storyId: 'story_maya_2', skillId: 'skill_cross_functional', strength: 0.78, notes: 'Coordinated with designer on dashboard' },
  { storyId: 'story_maya_2', skillId: 'skill_attention_detail', strength: 0.75, notes: 'Asked clarifying questions about specs' },

  // Kevin story 1
  { storyId: 'story_kevin_1', skillId: 'skill_debugging', strength: 0.80, notes: 'Systematically traced race condition' },
  { storyId: 'story_kevin_1', skillId: 'skill_python', strength: 0.75, notes: 'Fixed Django race condition with database locking' },
  { storyId: 'story_kevin_1', skillId: 'skill_unit_testing', strength: 0.72, notes: 'Added regression test case' },

  // Kevin story 2
  { storyId: 'story_kevin_2', skillId: 'skill_ownership', strength: 0.85, notes: 'Created documentation outside normal responsibilities' },
  { storyId: 'story_kevin_2', skillId: 'skill_documentation', strength: 0.78, notes: 'Wrote comprehensive README with troubleshooting' },
  { storyId: 'story_kevin_2', skillId: 'skill_docker', strength: 0.68, notes: 'Created Docker Compose for simplified setup' },

  // Jordan story 1
  { storyId: 'story_jordan_1', skillId: 'skill_feedback_receiving', strength: 0.80, notes: 'Received code review feedback constructively' },
  { storyId: 'story_jordan_1', skillId: 'skill_learning', strength: 0.78, notes: 'Applied refactoring principles to future work' },
  { storyId: 'story_jordan_1', skillId: 'skill_react', strength: 0.72, notes: 'Refactored component into smaller pieces' },

  // Jordan story 2
  { storyId: 'story_jordan_2', skillId: 'skill_teamwork', strength: 0.78, notes: 'Helped new team member onboard' },
  { storyId: 'story_jordan_2', skillId: 'skill_pair_programming', strength: 0.75, notes: 'Paired on first ticket with new hire' },

  // Carlos story 1
  { storyId: 'story_carlos_1', skillId: 'skill_ownership', strength: 0.85, notes: 'Built wishlist feature end-to-end' },
  { storyId: 'story_carlos_1', skillId: 'skill_nodejs', strength: 0.78, notes: 'Implemented Node.js API routes' },
  { storyId: 'story_carlos_1', skillId: 'skill_react', strength: 0.75, notes: 'Built React components with optimistic updates' },
  { storyId: 'story_carlos_1', skillId: 'skill_mongodb', strength: 0.72, notes: 'Designed MongoDB schema for wishlist' },

  // Carlos story 2
  { storyId: 'story_carlos_2', skillId: 'skill_adaptability', strength: 0.80, notes: 'Adapted to changing requirements mid-sprint' },
  { storyId: 'story_carlos_2', skillId: 'skill_stakeholder_comm', strength: 0.75, notes: 'Communicated tradeoffs to PM' },

  // Ashley story 1
  { storyId: 'story_ashley_1', skillId: 'skill_curiosity', strength: 0.85, notes: 'Self-directed learning of Vue 3 Composition API' },
  { storyId: 'story_ashley_1', skillId: 'skill_learning', strength: 0.82, notes: 'Built side project to learn new framework' },
  { storyId: 'story_ashley_1', skillId: 'skill_knowledge_sharing', strength: 0.75, notes: 'Presented findings in lunch-and-learn' },

  // Ashley story 2
  { storyId: 'story_ashley_2', skillId: 'skill_attention_detail', strength: 0.80, notes: 'Caught email validation bug before production' },
  { storyId: 'story_ashley_2', skillId: 'skill_unit_testing', strength: 0.75, notes: 'Added unit tests for edge cases' },

  // Tyler story 1
  { storyId: 'story_tyler_1', skillId: 'skill_code_review', strength: 0.78, notes: 'Improved team code review process' },
  { storyId: 'story_tyler_1', skillId: 'skill_java', strength: 0.75, notes: 'Configured Checkstyle for Java codebase' },
  { storyId: 'story_tyler_1', skillId: 'skill_ownership', strength: 0.72, notes: 'Took initiative on DevEx improvement' },

  // Tyler story 2
  { storyId: 'story_tyler_2', skillId: 'skill_pressure', strength: 0.80, notes: 'Fixed critical bug before investor demo' },
  { storyId: 'story_tyler_2', skillId: 'skill_debugging', strength: 0.78, notes: 'Time-boxed debugging approach' },
  { storyId: 'story_tyler_2', skillId: 'skill_mysql', strength: 0.72, notes: 'Fixed SQL join query' },

  // ============================================
  // Mid-Level Engineer Story Demonstrations
  // ============================================

  // Rachel story 1
  { storyId: 'story_rachel_1', skillId: 'skill_performance_optimization', strength: 0.92, notes: 'Reduced load time from 4.2s to 0.8s' },
  { storyId: 'story_rachel_1', skillId: 'skill_react', strength: 0.90, notes: 'Implemented virtualization and React.memo optimizations' },
  { storyId: 'story_rachel_1', skillId: 'skill_monitoring', strength: 0.85, notes: 'Set up performance monitoring with Web Vitals' },

  // Rachel story 2
  { storyId: 'story_rachel_2', skillId: 'skill_mentorship', strength: 0.88, notes: 'Structured mentorship with code review exercises' },
  { storyId: 'story_rachel_2', skillId: 'skill_pair_programming', strength: 0.82, notes: 'Paired on first feature with junior' },

  // Lisa story 1
  { storyId: 'story_lisa_1', skillId: 'skill_distributed', strength: 0.92, notes: 'Designed 15M req/s rate limiting service' },
  { storyId: 'story_lisa_1', skillId: 'skill_go', strength: 0.90, notes: 'Implemented core logic in Go for performance' },
  { storyId: 'story_lisa_1', skillId: 'skill_redis', strength: 0.88, notes: 'Designed two-tier cache with Redis' },
  { storyId: 'story_lisa_1', skillId: 'skill_system_design', strength: 0.88, notes: 'Design became template for other services' },

  // Lisa story 2
  { storyId: 'story_lisa_2', skillId: 'skill_debugging', strength: 0.90, notes: 'Debugged intermittent cache misses using distributed tracing' },
  { storyId: 'story_lisa_2', skillId: 'skill_distributed', strength: 0.88, notes: 'Identified clock skew as root cause' },
  { storyId: 'story_lisa_2', skillId: 'skill_root_cause', strength: 0.85, notes: 'Implemented vector clocks solution' },

  // Zoe story 1
  { storyId: 'story_zoe_1', skillId: 'skill_ownership', strength: 0.92, notes: 'Built entire MVP as first engineer' },
  { storyId: 'story_zoe_1', skillId: 'skill_adaptability', strength: 0.88, notes: 'Wore multiple hats across full stack' },
  { storyId: 'story_zoe_1', skillId: 'skill_cross_functional', strength: 0.85, notes: 'Talked to users weekly' },

  // Zoe story 2
  { storyId: 'story_zoe_2', skillId: 'skill_decision_making', strength: 0.88, notes: 'Made recommendation that led to product-market fit' },
  { storyId: 'story_zoe_2', skillId: 'skill_tradeoffs', strength: 0.85, notes: 'Presented clear tradeoffs to founders' },
  { storyId: 'story_zoe_2', skillId: 'skill_stakeholder_comm', strength: 0.82, notes: 'Structured approach became team template' },

  // David story 1
  { storyId: 'story_david_1', skillId: 'skill_attention_detail', strength: 0.88, notes: 'Passed HIPAA audit on first attempt' },
  { storyId: 'story_david_1', skillId: 'skill_documentation', strength: 0.85, notes: 'Detailed documentation for future audits' },
  { storyId: 'story_david_1', skillId: 'skill_api_design', strength: 0.82, notes: 'Designed export system with RBAC' },

  // David story 2
  { storyId: 'story_david_2', skillId: 'skill_system_design', strength: 0.85, notes: 'Proposed strangler fig migration pattern' },
  { storyId: 'story_david_2', skillId: 'skill_python', strength: 0.82, notes: 'Rebuilt modules in Python/Django' },
  { storyId: 'story_david_2', skillId: 'skill_unit_testing', strength: 0.80, notes: 'Wrote extensive tests for existing behavior' },

  // Mohammed story 1
  { storyId: 'story_mohammed_1', skillId: 'skill_github_actions', strength: 0.88, notes: 'Restructured pipeline to run in parallel' },
  { storyId: 'story_mohammed_1', skillId: 'skill_debugging', strength: 0.85, notes: 'Fixed flaky integration tests' },
  { storyId: 'story_mohammed_1', skillId: 'skill_documentation', strength: 0.80, notes: 'Created runbooks for common failures' },

  // Mohammed story 2
  { storyId: 'story_mohammed_2', skillId: 'skill_root_cause', strength: 0.88, notes: 'Identified split-brain from monitoring alerts' },
  { storyId: 'story_mohammed_2', skillId: 'skill_pressure', strength: 0.85, notes: 'Coordinated team response with minimal data loss' },
  { storyId: 'story_mohammed_2', skillId: 'skill_postgresql', strength: 0.82, notes: 'Implemented fencing mechanism for PostgreSQL' },

  // Aisha story 1
  { storyId: 'story_aisha_1', skillId: 'skill_tensorflow', strength: 0.85, notes: 'Built production ML model for no-show prediction' },
  { storyId: 'story_aisha_1', skillId: 'skill_python', strength: 0.88, notes: 'Data cleaning and feature engineering' },
  { storyId: 'story_aisha_1', skillId: 'skill_analytical', strength: 0.90, notes: 'Identified wrong features in previous attempts' },

  // Aisha story 2
  { storyId: 'story_aisha_2', skillId: 'skill_stakeholder_comm', strength: 0.88, notes: 'Explained ML predictions to non-technical staff' },
  { storyId: 'story_aisha_2', skillId: 'skill_documentation', strength: 0.82, notes: 'Created explainability dashboard' },
  { storyId: 'story_aisha_2', skillId: 'skill_feedback_receiving', strength: 0.80, notes: 'Established feedback loop for predictions' },

  // Ryan story 1
  { storyId: 'story_ryan_1', skillId: 'skill_react_native', strength: 0.88, notes: 'Built cross-platform companion app' },
  { storyId: 'story_ryan_1', skillId: 'skill_system_design', strength: 0.82, notes: 'Designed offline-first architecture' },
  { storyId: 'story_ryan_1', skillId: 'skill_cross_functional', strength: 0.80, notes: 'Worked with QA for cross-device testing' },

  // Ryan story 2
  { storyId: 'story_ryan_2', skillId: 'skill_performance_optimization', strength: 0.85, notes: 'Reduced battery usage from 20% to 6%/hour' },
  { storyId: 'story_ryan_2', skillId: 'skill_react_native', strength: 0.82, notes: 'Optimized with useMemo and useCallback' },
  { storyId: 'story_ryan_2', skillId: 'skill_debugging', strength: 0.80, notes: 'Profiled app to find battery bottlenecks' },

  // Emma story 1
  { storyId: 'story_emma_1', skillId: 'skill_react', strength: 0.88, notes: 'Built React component library with Storybook' },
  { storyId: 'story_emma_1', skillId: 'skill_cross_functional', strength: 0.88, notes: 'Coordinated with designers and 5 teams' },
  { storyId: 'story_emma_1', skillId: 'skill_documentation', strength: 0.82, notes: 'Created migration guides for teams' },

  // Emma story 2
  { storyId: 'story_emma_2', skillId: 'skill_attention_detail', strength: 0.88, notes: 'Fixed keyboard navigation and ARIA labels' },
  { storyId: 'story_emma_2', skillId: 'skill_unit_testing', strength: 0.82, notes: 'Set up automated accessibility testing in CI' },
  { storyId: 'story_emma_2', skillId: 'skill_cross_functional', strength: 0.80, notes: 'Partnered with screen reader user for validation' },

  // Senior Engineer Story Demonstrations

  // Greg - COASTING SENIOR (lower strengths matching coasting archetype)
  { storyId: 'story_greg_1', skillId: 'skill_java', strength: 0.76, notes: 'Migrated from Java 8 to 11' },
  { storyId: 'story_greg_1', skillId: 'skill_spring', strength: 0.74, notes: 'Updated Spring dependencies' },
  { storyId: 'story_greg_1', skillId: 'skill_unit_testing', strength: 0.72, notes: 'Coordinated QA testing' },
  { storyId: 'story_greg_2', skillId: 'skill_mentorship', strength: 0.68, notes: 'Helped new developer understand Spring' },
  { storyId: 'story_greg_2', skillId: 'skill_documentation', strength: 0.70, notes: 'Pointed to documentation' },

  // Natasha - COASTING SENIOR (competent but not exceptional strengths)
  { storyId: 'story_natasha_1', skillId: 'skill_react', strength: 0.76, notes: 'Built React components for dashboard' },
  { storyId: 'story_natasha_1', skillId: 'skill_graphql', strength: 0.74, notes: 'Integrated with GraphQL API' },
  { storyId: 'story_natasha_1', skillId: 'skill_cross_functional', strength: 0.72, notes: 'Followed design mockups' },
  { storyId: 'story_natasha_2', skillId: 'skill_debugging', strength: 0.76, notes: 'Reproduced and fixed video playback issue' },
  { storyId: 'story_natasha_2', skillId: 'skill_attention_detail', strength: 0.74, notes: 'Tested across multiple devices' },

  // Nathan - BIG-TECH SPECIALIST (very high strengths in deep skills)
  { storyId: 'story_nathan_1', skillId: 'skill_system_design', strength: 0.94, notes: 'Designed modular ranking architecture at Meta scale' },
  { storyId: 'story_nathan_1', skillId: 'skill_spark', strength: 0.92, notes: 'Built feature store reducing computation by 80%' },
  { storyId: 'story_nathan_1', skillId: 'skill_mentorship', strength: 0.88, notes: 'Ran training sessions for partner teams' },
  { storyId: 'story_nathan_1', skillId: 'skill_documentation', strength: 0.90, notes: 'Documented system extensively' },
  { storyId: 'story_nathan_2', skillId: 'skill_decision_making', strength: 0.92, notes: 'Made critical bias mitigation decision under pressure' },
  { storyId: 'story_nathan_2', skillId: 'skill_tradeoffs', strength: 0.90, notes: 'Balanced launch schedule with ethical concerns' },
  { storyId: 'story_nathan_2', skillId: 'skill_cross_functional', strength: 0.88, notes: 'Coordinated with ML fairness experts and stakeholders' },

  // Wei - BIG-TECH SPECIALIST (exceptional data engineering skills)
  { storyId: 'story_wei_1', skillId: 'skill_kafka', strength: 0.95, notes: 'Architected Kafka Streams pipeline at 15M events/sec' },
  { storyId: 'story_wei_1', skillId: 'skill_distributed', strength: 0.92, notes: 'Designed tiered storage with exactly-once semantics' },
  { storyId: 'story_wei_1', skillId: 'skill_system_design', strength: 0.90, notes: 'Custom partitioning strategy for query optimization' },
  { storyId: 'story_wei_2', skillId: 'skill_mentorship', strength: 0.90, notes: 'Created training program and paired with each engineer' },
  { storyId: 'story_wei_2', skillId: 'skill_kafka', strength: 0.88, notes: 'Led Kafka migration with zero customer impact' },
  { storyId: 'story_wei_2', skillId: 'skill_ownership', strength: 0.86, notes: 'Weekly office hours and migration checkpoints' },

  // Derek - STARTUP GENERALIST (high ownership, broad skills)
  { storyId: 'story_derek_1', skillId: 'skill_hiring', strength: 0.92, notes: 'Created interview process and interviewed 50+ candidates' },
  { storyId: 'story_derek_1', skillId: 'skill_team_leadership', strength: 0.90, notes: 'Scaled team from 3 to 15 with 90% retention' },
  { storyId: 'story_derek_1', skillId: 'skill_system_design', strength: 0.86, notes: 'Led architecture redesign from monolith to services' },
  { storyId: 'story_derek_1', skillId: 'skill_ownership', strength: 0.94, notes: 'First hire, owned technical and hiring simultaneously' },
  { storyId: 'story_derek_2', skillId: 'skill_aws', strength: 0.84, notes: 'Audited and optimized cloud infrastructure' },
  { storyId: 'story_derek_2', skillId: 'skill_postgresql', strength: 0.82, notes: 'Optimized database queries to reduce instance sizes' },
  { storyId: 'story_derek_2', skillId: 'skill_pressure', strength: 0.88, notes: 'Managed cost crisis during fundraise with 6 months runway' },

  // Takeshi - Standard Senior (strong distributed systems)
  { storyId: 'story_takeshi_1', skillId: 'skill_distributed', strength: 0.88, notes: 'Designed saga pattern for multi-provider transactions' },
  { storyId: 'story_takeshi_1', skillId: 'skill_system_design', strength: 0.86, notes: 'Adapter architecture for payment providers' },
  { storyId: 'story_takeshi_1', skillId: 'skill_api_design', strength: 0.85, notes: 'Common internal payment model' },
  { storyId: 'story_takeshi_1', skillId: 'skill_cross_functional', strength: 0.84, notes: 'Worked with legal and product teams' },
  { storyId: 'story_takeshi_2', skillId: 'skill_debugging', strength: 0.90, notes: 'Found race condition in cache invalidation' },
  { storyId: 'story_takeshi_2', skillId: 'skill_unit_testing', strength: 0.86, notes: 'Added comprehensive concurrent unit tests' },
  { storyId: 'story_takeshi_2', skillId: 'skill_mentorship', strength: 0.82, notes: 'Shared learnings in tech talk for 40 engineers' },

  // Sarah - Standard Senior (frontend performance excellence)
  { storyId: 'story_sarah_1', skillId: 'skill_react', strength: 0.92, notes: 'Implemented React.memo and code splitting' },
  { storyId: 'story_sarah_1', skillId: 'skill_performance_optimization', strength: 0.90, notes: 'Reduced page load from 4.2s to 1.6s' },
  { storyId: 'story_sarah_1', skillId: 'skill_debugging', strength: 0.86, notes: 'Profiled application to identify issues' },
  { storyId: 'story_sarah_1', skillId: 'skill_documentation', strength: 0.84, notes: 'Created performance best practices documentation' },
  { storyId: 'story_sarah_2', skillId: 'skill_mentorship', strength: 0.86, notes: 'Facilitated discussions for team buy-in' },
  { storyId: 'story_sarah_2', skillId: 'skill_documentation', strength: 0.88, notes: 'Documented architecture decisions in ADR format' },
  { storyId: 'story_sarah_2', skillId: 'skill_unit_testing', strength: 0.84, notes: 'Created starter template with testing structure' },

  // Ravi - Standard Senior (healthcare compliance expertise)
  { storyId: 'story_ravi_1', skillId: 'skill_api_design', strength: 0.88, notes: 'Designed immutable audit log with cryptographic chaining' },
  { storyId: 'story_ravi_1', skillId: 'skill_attention_detail', strength: 0.92, notes: 'Passed SOC 2 Type II with zero findings' },
  { storyId: 'story_ravi_1', skillId: 'skill_documentation', strength: 0.86, notes: 'Created role-based access controls' },
  { storyId: 'story_ravi_2', skillId: 'skill_system_design', strength: 0.84, notes: 'Created clear interfaces for incremental migration' },
  { storyId: 'story_ravi_2', skillId: 'skill_cross_functional', strength: 0.86, notes: 'Transparent stakeholder communication' },
  { storyId: 'story_ravi_2', skillId: 'skill_tradeoffs', strength: 0.84, notes: 'Balanced technical debt with feature delivery' },

  // Olivia - Standard Senior (ML deployment expertise)
  { storyId: 'story_olivia_1', skillId: 'skill_python', strength: 0.90, notes: 'Containerized NLP model for production' },
  { storyId: 'story_olivia_1', skillId: 'skill_tensorflow', strength: 0.88, notes: 'Implemented explainability features' },
  { storyId: 'story_olivia_1', skillId: 'skill_cross_functional', strength: 0.86, notes: 'Ran pilot programs with clinicians' },
  { storyId: 'story_olivia_1', skillId: 'skill_documentation', strength: 0.84, notes: 'Human-in-the-loop workflow design' },
  { storyId: 'story_olivia_2', skillId: 'skill_analytical', strength: 0.92, notes: 'Systematic error analysis across three categories' },
  { storyId: 'story_olivia_2', skillId: 'skill_tensorflow', strength: 0.90, notes: 'Hybrid neural NER with knowledge graph' },
  { storyId: 'story_olivia_2', skillId: 'skill_attention_detail', strength: 0.88, notes: 'Improved F1 from 82% to 93%' },

  // Lucas - Standard Senior (security at scale)
  { storyId: 'story_lucas_1', skillId: 'skill_terraform', strength: 0.90, notes: 'Security-as-code framework with Terraform modules' },
  { storyId: 'story_lucas_1', skillId: 'skill_aws', strength: 0.88, notes: 'Consistent security controls across 200+ services' },
  { storyId: 'story_lucas_1', skillId: 'skill_mentorship', strength: 0.86, notes: 'Established security champions in each team' },
  { storyId: 'story_lucas_1', skillId: 'skill_cross_functional', strength: 0.84, notes: 'Self-service portal maintained developer productivity' },
  { storyId: 'story_lucas_2', skillId: 'skill_analytical', strength: 0.92, notes: 'Analyzed attack patterns from 50K+ login attempts' },
  { storyId: 'story_lucas_2', skillId: 'skill_debugging', strength: 0.88, notes: 'Implemented behavioral rate limiting' },
  { storyId: 'story_lucas_2', skillId: 'skill_pressure', strength: 0.90, notes: 'Stopped attack within 2 hours with minimal impact' },

  // Staff Engineer Story Demonstrations (0.88-0.96 strengths)

  // Anika - Staff Platform Engineer
  { storyId: 'story_anika_1', skillId: 'skill_kafka', strength: 0.96, notes: 'Architected event-driven platform at 600K TPS' },
  { storyId: 'story_anika_1', skillId: 'skill_distributed', strength: 0.94, notes: 'Implemented exactly-once semantics for financial transactions' },
  { storyId: 'story_anika_1', skillId: 'skill_kubernetes', strength: 0.92, notes: 'Led Kubernetes migration with auto-scaling' },
  { storyId: 'story_anika_1', skillId: 'skill_system_design', strength: 0.94, notes: 'Custom partitioning for ordering guarantees' },
  { storyId: 'story_anika_2', skillId: 'skill_team_leadership', strength: 0.92, notes: 'Led cross-team platform standardization' },
  { storyId: 'story_anika_2', skillId: 'skill_helm', strength: 0.90, notes: 'Designed shared Helm chart library' },
  { storyId: 'story_anika_2', skillId: 'skill_mentorship', strength: 0.90, notes: 'Paired with team leads for adoption' },

  // Alex - Staff Backend
  { storyId: 'story_alex_1', skillId: 'skill_system_design', strength: 0.94, notes: 'Event-sourced microservices architecture' },
  { storyId: 'story_alex_1', skillId: 'skill_kafka', strength: 0.90, notes: 'Kafka for event streaming with saga pattern' },
  { storyId: 'story_alex_1', skillId: 'skill_mentorship', strength: 0.90, notes: 'Mentored 5 engineers through first DDD implementation' },
  { storyId: 'story_alex_1', skillId: 'skill_api_design', strength: 0.92, notes: 'Established service boundaries and API contracts' },
  { storyId: 'story_alex_2', skillId: 'skill_tradeoffs', strength: 0.92, notes: 'Created decision framework for Redis migration' },
  { storyId: 'story_alex_2', skillId: 'skill_cross_functional', strength: 0.90, notes: 'Facilitated discussions and documented rationale' },

  // Dmitri - Staff ML Engineer
  { storyId: 'story_dmitri_1', skillId: 'skill_system_design', strength: 0.94, notes: 'End-to-end ML platform architecture' },
  { storyId: 'story_dmitri_1', skillId: 'skill_kubernetes', strength: 0.88, notes: 'Integration with existing K8s infrastructure' },
  { storyId: 'story_dmitri_1', skillId: 'skill_mentorship', strength: 0.90, notes: 'Training sessions for 20+ data scientists' },
  { storyId: 'story_dmitri_2', skillId: 'skill_tensorflow', strength: 0.94, notes: 'Multi-task learning and novel data augmentation' },
  { storyId: 'story_dmitri_2', skillId: 'skill_analytical', strength: 0.94, notes: 'Systematic error analysis for model improvement' },
  { storyId: 'story_dmitri_2', skillId: 'skill_python', strength: 0.92, notes: 'Domain-specific pre-training implementation' },

  // Jennifer - Staff Frontend
  { storyId: 'story_jennifer_1', skillId: 'skill_react', strength: 0.94, notes: 'React micro-frontend architecture' },
  { storyId: 'story_jennifer_1', skillId: 'skill_performance_optimization', strength: 0.94, notes: 'Page load from 8s to 1.2s' },
  { storyId: 'story_jennifer_1', skillId: 'skill_unit_testing', strength: 0.90, notes: 'Automated visual regression testing' },
  { storyId: 'story_jennifer_1', skillId: 'skill_team_leadership', strength: 0.92, notes: 'Led team of 6 through migration' },
  { storyId: 'story_jennifer_2', skillId: 'skill_mentorship', strength: 0.94, notes: 'Coached two engineers to senior promotion' },
  { storyId: 'story_jennifer_2', skillId: 'skill_documentation', strength: 0.88, notes: 'Architecture decision records' },

  // Michael - Staff DevOps
  { storyId: 'story_michael_1', skillId: 'skill_kubernetes', strength: 0.94, notes: 'Kubernetes platform with GitOps principles' },
  { storyId: 'story_michael_1', skillId: 'skill_terraform', strength: 0.92, notes: 'Account setup modules with security controls' },
  { storyId: 'story_michael_1', skillId: 'skill_aws', strength: 0.94, notes: 'Standardized platform across 50+ services' },
  { storyId: 'story_michael_1', skillId: 'skill_team_leadership', strength: 0.90, notes: 'Established and trained platform team' },
  { storyId: 'story_michael_2', skillId: 'skill_debugging', strength: 0.92, notes: 'Identified connection pool exhaustion' },
  { storyId: 'story_michael_2', skillId: 'skill_pressure', strength: 0.94, notes: 'Coordinated incident response, service restored in 2 hours' },
  { storyId: 'story_michael_2', skillId: 'skill_cross_functional', strength: 0.90, notes: 'Status updates every 15 minutes to stakeholders' },

  // Sanjay - Staff Data Engineer
  { storyId: 'story_sanjay_1', skillId: 'skill_spark', strength: 0.94, notes: 'Lake house architecture with Spark' },
  { storyId: 'story_sanjay_1', skillId: 'skill_kafka', strength: 0.92, notes: 'CDC pipelines from all source systems' },
  { storyId: 'story_sanjay_1', skillId: 'skill_system_design', strength: 0.90, notes: 'Unified data platform for 500+ users' },
  { storyId: 'story_sanjay_2', skillId: 'skill_spark', strength: 0.94, notes: 'Spark Structured Streaming optimization' },
  { storyId: 'story_sanjay_2', skillId: 'skill_distributed', strength: 0.90, notes: 'Broadcast joins and optimized partitioning' },
  { storyId: 'story_sanjay_2', skillId: 'skill_analytical', strength: 0.88, notes: 'Pipeline profiling and bottleneck identification' },

  // Christine - Staff Full Stack
  { storyId: 'story_christine_1', skillId: 'skill_attention_detail', strength: 0.94, notes: 'Dual HIPAA and PCI-DSS compliance' },
  { storyId: 'story_christine_1', skillId: 'skill_system_design', strength: 0.92, notes: 'Architecture isolating PCI and HIPAA data' },
  { storyId: 'story_christine_1', skillId: 'skill_documentation', strength: 0.90, notes: 'Compliance documentation and training' },
  { storyId: 'story_christine_2', skillId: 'skill_api_design', strength: 0.92, notes: 'Adapter architecture with canonical model' },
  { storyId: 'story_christine_2', skillId: 'skill_nodejs', strength: 0.90, notes: 'Configuration-driven integration framework' },
  { storyId: 'story_christine_2', skillId: 'skill_mentorship', strength: 0.88, notes: 'Trained 3 engineers on framework' },

  // Hassan - Staff Security Engineer
  { storyId: 'story_hassan_1', skillId: 'skill_aws', strength: 0.94, notes: 'IAM policies with least-privilege' },
  { storyId: 'story_hassan_1', skillId: 'skill_team_leadership', strength: 0.92, notes: 'Built security function, champions program' },
  { storyId: 'story_hassan_1', skillId: 'skill_mentorship', strength: 0.90, notes: 'Security champions embedded in teams' },
  { storyId: 'story_hassan_1', skillId: 'skill_system_design', strength: 0.90, notes: 'Incident response and vendor review processes' },
  { storyId: 'story_hassan_2', skillId: 'skill_analytical', strength: 0.94, notes: 'Analyzed attacker access patterns' },
  { storyId: 'story_hassan_2', skillId: 'skill_pressure', strength: 0.94, notes: 'Contained threat within 3 hours' },
  { storyId: 'story_hassan_2', skillId: 'skill_cross_functional', strength: 0.90, notes: 'Coordinated with legal and communications' },

  // ============================================
  // Principal Engineers Story Demonstrations (0.90-0.98 strength)
  // ============================================

  // Victoria story 1 - Architectural transformation
  { storyId: 'story_victoria_1', skillId: 'skill_system_design', strength: 0.98, notes: 'Designed microservices architecture for 500M daily transactions' },
  { storyId: 'story_victoria_1', skillId: 'skill_distributed', strength: 0.96, notes: 'Event-driven architecture with service mesh' },
  { storyId: 'story_victoria_1', skillId: 'skill_team_leadership', strength: 0.95, notes: 'Led 12 engineering teams through transformation' },
  { storyId: 'story_victoria_1', skillId: 'skill_mentorship', strength: 0.94, notes: 'Paired with teams during first service extractions' },
  { storyId: 'story_victoria_1', skillId: 'skill_documentation', strength: 0.92, notes: 'Created ADRs to communicate design rationale' },

  // Victoria story 2 - Technology standards
  { storyId: 'story_victoria_2', skillId: 'skill_tech_leadership', strength: 0.96, notes: 'Established technology radar process' },
  { storyId: 'story_victoria_2', skillId: 'skill_stakeholder_comm', strength: 0.94, notes: 'Built consensus across teams without authority' },
  { storyId: 'story_victoria_2', skillId: 'skill_system_design', strength: 0.92, notes: 'Created golden path templates for common patterns' },
  { storyId: 'story_victoria_2', skillId: 'skill_organizational_awareness', strength: 0.92, notes: 'Balanced standardization with innovation needs' },

  // Robert story 1 - ML platform
  { storyId: 'story_robert_1', skillId: 'skill_system_design', strength: 0.98, notes: 'Designed ML platform serving 150+ models' },
  { storyId: 'story_robert_1', skillId: 'skill_tensorflow', strength: 0.96, notes: 'Built model registry and deployment pipelines' },
  { storyId: 'story_robert_1', skillId: 'skill_python', strength: 0.94, notes: 'Implemented feature store and ML ops tooling' },
  { storyId: 'story_robert_1', skillId: 'skill_spark', strength: 0.92, notes: 'Feature engineering at scale with Spark' },
  { storyId: 'story_robert_1', skillId: 'skill_cross_functional', strength: 0.94, notes: 'Interviewed 15 data science teams' },

  // Robert story 2 - ML governance
  { storyId: 'story_robert_2', skillId: 'skill_tech_leadership', strength: 0.96, notes: 'Designed ML governance framework' },
  { storyId: 'story_robert_2', skillId: 'skill_analytical', strength: 0.94, notes: 'Translated regulatory requirements to engineering controls' },
  { storyId: 'story_robert_2', skillId: 'skill_tensorflow', strength: 0.92, notes: 'Built automated bias detection in CI/CD' },
  { storyId: 'story_robert_2', skillId: 'skill_mentorship', strength: 0.90, notes: 'Trained ML review committee members' },

  // Elena story 1 - Zero trust architecture
  { storyId: 'story_elena_1', skillId: 'skill_system_design', strength: 0.98, notes: 'Designed zero-trust architecture across 200+ services' },
  { storyId: 'story_elena_1', skillId: 'skill_aws', strength: 0.96, notes: 'Implemented SASE and cloud security controls' },
  { storyId: 'story_elena_1', skillId: 'skill_kubernetes', strength: 0.94, notes: 'Microsegmentation using service mesh' },
  { storyId: 'story_elena_1', skillId: 'skill_team_leadership', strength: 0.94, notes: 'Established security champions program' },
  { storyId: 'story_elena_1', skillId: 'skill_monitoring', strength: 0.92, notes: 'Built SIEM integration and threat detection' },

  // Elena story 2 - Threat response
  { storyId: 'story_elena_2', skillId: 'skill_analytical', strength: 0.96, notes: 'Rapid threat model update under pressure' },
  { storyId: 'story_elena_2', skillId: 'skill_pressure', strength: 0.96, notes: 'Led response to nation-state threat' },
  { storyId: 'story_elena_2', skillId: 'skill_cross_functional', strength: 0.94, notes: 'Coordinated across security, engineering, legal, communications' },
  { storyId: 'story_elena_2', skillId: 'skill_stakeholder_comm', strength: 0.94, notes: 'Briefed board and executive team' },
  { storyId: 'story_elena_2', skillId: 'skill_terraform', strength: 0.90, notes: 'Supply chain security review of build pipelines' },
];
