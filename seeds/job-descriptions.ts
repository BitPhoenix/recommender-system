import {
  JobDescription,
  JobRequiredSkill,
  JobPreferredSkill,
  JobRequiredBusinessDomain,
  JobPreferredBusinessDomain,
  JobRequiredTechnicalDomain,
  JobPreferredTechnicalDomain,
} from './types';

// Helper to generate dates relative to today
function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

// ============================================
// JOB DESCRIPTIONS
// ============================================

export const jobDescriptions: JobDescription[] = [
  // -----------------------------
  // FINTECH ROLES
  // -----------------------------
  {
    id: 'job_senior_backend_fintech',
    title: 'Senior Backend Engineer - Payments Platform',
    description: `We're looking for a Senior Backend Engineer to join our Payments Platform team. You'll design and build scalable payment processing systems handling millions of transactions daily.

Key Responsibilities:
- Design and implement high-throughput payment APIs
- Build real-time fraud detection and prevention systems
- Lead technical design discussions and code reviews
- Mentor junior engineers and contribute to engineering culture

Requirements:
- 6+ years of backend engineering experience
- Strong TypeScript/Node.js or Python experience
- Experience with payment systems, PCI compliance, or financial services
- Distributed systems experience (Kafka, event-driven architecture)
- PostgreSQL and Redis expertise`,
    companyName: 'TechPay Solutions',
    location: 'Remote (US)',
    seniority: 'senior',
    minBudget: 180000,
    maxBudget: 220000,
    stretchBudget: 240000,
    startTimeline: 'two_weeks',
    timezone: ['Eastern', 'Central'],
    teamFocus: 'scaling',
    createdAt: daysAgo(5),
  },
  {
    id: 'job_staff_architect_fintech',
    title: 'Staff Engineer - Financial Infrastructure',
    description: `Join our core infrastructure team as a Staff Engineer. You'll shape the technical direction of our financial platform serving millions of users.

Key Responsibilities:
- Define technical strategy for our payment infrastructure
- Lead cross-team initiatives for system reliability and scalability
- Design APIs and data models for financial products
- Drive adoption of best practices across engineering organization

Requirements:
- 10+ years of software engineering experience
- Deep expertise in distributed systems and microservices
- Experience with banking or fintech infrastructure
- Strong system design and architecture skills
- Track record of technical leadership`,
    companyName: 'FinanceForward',
    location: 'New York, NY (Hybrid)',
    seniority: 'staff',
    minBudget: 250000,
    maxBudget: 300000,
    stretchBudget: 350000,
    startTimeline: 'one_month',
    timezone: ['Eastern'],
    teamFocus: 'migration',
    createdAt: daysAgo(10),
  },

  // -----------------------------
  // FRONTEND/FULL STACK ROLES
  // -----------------------------
  {
    id: 'job_mid_frontend_saas',
    title: 'Frontend Engineer - Design Systems',
    description: `We're building the next generation of design tools and need a Frontend Engineer to help scale our design system.

Key Responsibilities:
- Build and maintain reusable React component library
- Collaborate with designers to implement pixel-perfect UIs
- Optimize performance for complex interactive applications
- Write comprehensive tests and documentation

Requirements:
- 4+ years of frontend development experience
- Expert-level React and TypeScript skills
- Experience building and maintaining design systems
- Strong CSS/Tailwind skills
- Understanding of accessibility best practices`,
    companyName: 'DesignHub',
    location: 'San Francisco, CA',
    seniority: 'mid',
    minBudget: 140000,
    maxBudget: 175000,
    startTimeline: 'two_weeks',
    timezone: ['Pacific', 'Mountain'],
    teamFocus: 'greenfield',
    createdAt: daysAgo(3),
  },
  {
    id: 'job_senior_fullstack_ecommerce',
    title: 'Senior Full Stack Engineer - E-commerce Platform',
    description: `Join our engineering team to build the future of online shopping. You'll work across the stack from React frontends to Node.js backends.

Key Responsibilities:
- Build features across our e-commerce platform
- Design and implement RESTful and GraphQL APIs
- Optimize for performance and conversion
- Collaborate with product and design teams

Requirements:
- 6+ years of full stack experience
- Strong React and Node.js/TypeScript skills
- E-commerce or retail experience preferred
- PostgreSQL and caching (Redis) experience
- Experience with A/B testing and analytics`,
    companyName: 'ShopStream',
    location: 'Remote (US)',
    seniority: 'senior',
    minBudget: 160000,
    maxBudget: 200000,
    stretchBudget: 220000,
    startTimeline: 'immediate',
    timezone: ['Eastern', 'Central', 'Mountain', 'Pacific'],
    teamFocus: 'scaling',
    createdAt: daysAgo(7),
  },
  {
    id: 'job_junior_frontend_startup',
    title: 'Junior Frontend Developer',
    description: `Great opportunity for an early-career developer to join our fast-growing startup. You'll learn from senior engineers while building real features.

Key Responsibilities:
- Build React components under guidance of senior engineers
- Write unit and integration tests
- Participate in code reviews and learn best practices
- Help improve developer tooling and documentation

Requirements:
- 1-2 years of professional experience (bootcamp grads welcome)
- Solid React and JavaScript fundamentals
- Eagerness to learn TypeScript and modern tooling
- Good communication skills
- Portfolio of personal or school projects`,
    companyName: 'LaunchPad Tech',
    location: 'Austin, TX',
    seniority: 'junior',
    minBudget: 80000,
    maxBudget: 100000,
    startTimeline: 'two_weeks',
    timezone: ['Central'],
    teamFocus: 'greenfield',
    createdAt: daysAgo(2),
  },

  // -----------------------------
  // HEALTHCARE ROLES
  // -----------------------------
  {
    id: 'job_senior_backend_healthcare',
    title: 'Senior Backend Engineer - Healthcare Platform',
    description: `Build the infrastructure powering digital healthcare. You'll work on HIPAA-compliant systems serving millions of patients.

Key Responsibilities:
- Design secure APIs for patient data management
- Build integrations with EHR systems (Epic, Cerner)
- Ensure HIPAA compliance across all systems
- Lead initiatives for system security and reliability

Requirements:
- 6+ years of backend engineering experience
- Python or Node.js expertise
- Healthcare or regulated industry experience
- Understanding of HIPAA and data privacy
- Experience with PostgreSQL and secure data handling`,
    companyName: 'HealthTech Innovations',
    location: 'Boston, MA (Hybrid)',
    seniority: 'senior',
    minBudget: 170000,
    maxBudget: 210000,
    startTimeline: 'one_month',
    timezone: ['Eastern'],
    teamFocus: 'maintenance',
    createdAt: daysAgo(12),
  },
  {
    id: 'job_mid_data_healthcare',
    title: 'Data Engineer - Clinical Analytics',
    description: `Join our data team to build analytics infrastructure for clinical research. Help researchers make discoveries that improve patient outcomes.

Key Responsibilities:
- Build ETL pipelines for clinical data
- Design data models for research analytics
- Create dashboards and reporting tools
- Ensure data quality and lineage tracking

Requirements:
- 4+ years of data engineering experience
- Strong Python and SQL skills
- Experience with Spark, Airflow, or similar tools
- Understanding of healthcare data (HL7, FHIR is a plus)
- Data warehouse experience (Snowflake, BigQuery)`,
    companyName: 'ClinicalData Corp',
    location: 'Remote (US)',
    seniority: 'mid',
    minBudget: 145000,
    maxBudget: 175000,
    startTimeline: 'two_weeks',
    timezone: ['Eastern', 'Central'],
    teamFocus: 'greenfield',
    createdAt: daysAgo(8),
  },

  // -----------------------------
  // DEVOPS/PLATFORM ROLES
  // -----------------------------
  {
    id: 'job_senior_devops_enterprise',
    title: 'Senior DevOps Engineer - Platform Team',
    description: `Lead our platform engineering efforts as we scale to support hundreds of microservices and thousands of deployments daily.

Key Responsibilities:
- Design and maintain Kubernetes infrastructure
- Build CI/CD pipelines and deployment automation
- Implement observability and monitoring solutions
- Drive infrastructure-as-code practices

Requirements:
- 6+ years of DevOps/SRE experience
- Expert Kubernetes and Docker skills
- Strong Terraform and cloud (AWS/GCP) experience
- Experience with monitoring (Prometheus, Grafana, DataDog)
- Python or Go scripting abilities`,
    companyName: 'ScaleUp Systems',
    location: 'Seattle, WA',
    seniority: 'senior',
    minBudget: 175000,
    maxBudget: 215000,
    stretchBudget: 230000,
    startTimeline: 'one_month',
    timezone: ['Pacific'],
    teamFocus: 'scaling',
    createdAt: daysAgo(6),
  },
  {
    id: 'job_mid_platform_saas',
    title: 'Platform Engineer',
    description: `Join our platform team to build internal developer tools and infrastructure that powers our SaaS platform.

Key Responsibilities:
- Build and maintain internal developer platform
- Design self-service infrastructure tools
- Implement security and compliance automation
- Support production systems and incident response

Requirements:
- 4+ years of platform/infrastructure experience
- Kubernetes and container orchestration
- Terraform or Pulumi experience
- CI/CD pipeline experience (GitHub Actions, CircleCI)
- Strong Linux and networking fundamentals`,
    companyName: 'CloudNative Inc',
    location: 'Denver, CO (Hybrid)',
    seniority: 'mid',
    minBudget: 135000,
    maxBudget: 165000,
    startTimeline: 'two_weeks',
    timezone: ['Mountain', 'Pacific'],
    teamFocus: 'migration',
    createdAt: daysAgo(4),
  },

  // -----------------------------
  // ML/DATA ROLES
  // -----------------------------
  {
    id: 'job_senior_ml_fintech',
    title: 'Senior ML Engineer - Fraud Detection',
    description: `Build machine learning systems that protect millions of users from fraud. Work on real-time prediction systems processing billions of events.

Key Responsibilities:
- Design and deploy ML models for fraud detection
- Build real-time feature engineering pipelines
- Optimize model performance and latency
- Collaborate with data science and product teams

Requirements:
- 6+ years of ML engineering experience
- Strong Python and TensorFlow/PyTorch skills
- Experience with real-time ML systems
- Fintech or fraud detection experience preferred
- Spark and distributed computing experience`,
    companyName: 'SecurePay',
    location: 'Remote (US)',
    seniority: 'senior',
    minBudget: 190000,
    maxBudget: 240000,
    stretchBudget: 260000,
    startTimeline: 'one_month',
    timezone: ['Eastern', 'Central', 'Pacific'],
    teamFocus: 'scaling',
    createdAt: daysAgo(9),
  },
  {
    id: 'job_staff_ml_research',
    title: 'Staff ML Engineer - Research Platform',
    description: `Lead ML infrastructure at a cutting-edge AI research company. You'll build the platform that enables researchers to train and deploy state-of-the-art models.

Key Responsibilities:
- Design ML training and serving infrastructure
- Optimize distributed training for large models
- Build experiment tracking and model registry
- Mentor ML engineers and establish best practices

Requirements:
- 10+ years of software/ML engineering experience
- Deep expertise in PyTorch and distributed training
- Experience with GPU cluster management
- Strong system design skills
- Published research or open source contributions a plus`,
    companyName: 'AI Research Labs',
    location: 'San Francisco, CA',
    seniority: 'staff',
    minBudget: 280000,
    maxBudget: 350000,
    stretchBudget: 400000,
    startTimeline: 'three_months',
    timezone: ['Pacific'],
    teamFocus: 'greenfield',
    createdAt: daysAgo(14),
  },

  // -----------------------------
  // PRINCIPAL/ARCHITECT ROLES
  // -----------------------------
  {
    id: 'job_principal_distributed_systems',
    title: 'Principal Engineer - Distributed Systems',
    description: `Shape the technical future of our platform as a Principal Engineer. You'll solve our hardest distributed systems challenges.

Key Responsibilities:
- Define technical strategy for core platform
- Lead architecture decisions for distributed systems
- Drive engineering excellence across the organization
- Represent engineering in company strategy discussions

Requirements:
- 14+ years of software engineering experience
- Deep expertise in distributed systems
- Track record of technical leadership and mentorship
- Experience scaling systems to millions of users
- Strong communication and influence skills`,
    companyName: 'MegaScale Technologies',
    location: 'Remote (US)',
    seniority: 'principal',
    minBudget: 320000,
    maxBudget: 400000,
    stretchBudget: 450000,
    startTimeline: 'three_months',
    timezone: ['Eastern', 'Central', 'Pacific'],
    createdAt: daysAgo(20),
  },
];

// ============================================
// JOB SKILL REQUIREMENTS
// ============================================

export const jobRequiredSkills: JobRequiredSkill[] = [
  // Senior Backend Fintech
  { jobId: 'job_senior_backend_fintech', skillId: 'skill_typescript', minProficiency: 'expert' },
  { jobId: 'job_senior_backend_fintech', skillId: 'skill_nodejs', minProficiency: 'expert' },
  { jobId: 'job_senior_backend_fintech', skillId: 'skill_postgresql', minProficiency: 'proficient' },
  { jobId: 'job_senior_backend_fintech', skillId: 'skill_kafka', minProficiency: 'proficient' },

  // Staff Architect Fintech
  { jobId: 'job_staff_architect_fintech', skillId: 'skill_system_design', minProficiency: 'expert' },
  { jobId: 'job_staff_architect_fintech', skillId: 'skill_event_driven', minProficiency: 'expert' },
  { jobId: 'job_staff_architect_fintech', skillId: 'skill_microservices', minProficiency: 'expert' },

  // Mid Frontend SaaS
  { jobId: 'job_mid_frontend_saas', skillId: 'skill_react', minProficiency: 'expert' },
  { jobId: 'job_mid_frontend_saas', skillId: 'skill_typescript', minProficiency: 'proficient' },

  // Senior Full Stack E-commerce
  { jobId: 'job_senior_fullstack_ecommerce', skillId: 'skill_react', minProficiency: 'expert' },
  { jobId: 'job_senior_fullstack_ecommerce', skillId: 'skill_nodejs', minProficiency: 'expert' },
  { jobId: 'job_senior_fullstack_ecommerce', skillId: 'skill_typescript', minProficiency: 'proficient' },
  { jobId: 'job_senior_fullstack_ecommerce', skillId: 'skill_postgresql', minProficiency: 'proficient' },

  // Junior Frontend Startup
  { jobId: 'job_junior_frontend_startup', skillId: 'skill_react', minProficiency: 'proficient' },
  { jobId: 'job_junior_frontend_startup', skillId: 'skill_javascript' },

  // Senior Backend Healthcare
  { jobId: 'job_senior_backend_healthcare', skillId: 'skill_python', minProficiency: 'expert' },
  { jobId: 'job_senior_backend_healthcare', skillId: 'skill_postgresql', minProficiency: 'proficient' },
  { jobId: 'job_senior_backend_healthcare', skillId: 'skill_rest_api', minProficiency: 'proficient' },

  // Mid Data Healthcare
  { jobId: 'job_mid_data_healthcare', skillId: 'skill_python', minProficiency: 'proficient' },
  { jobId: 'job_mid_data_healthcare', skillId: 'skill_spark', minProficiency: 'proficient' },
  { jobId: 'job_mid_data_healthcare', skillId: 'skill_postgresql', minProficiency: 'proficient' },

  // Senior DevOps Enterprise
  { jobId: 'job_senior_devops_enterprise', skillId: 'skill_kubernetes', minProficiency: 'expert' },
  { jobId: 'job_senior_devops_enterprise', skillId: 'skill_docker', minProficiency: 'expert' },
  { jobId: 'job_senior_devops_enterprise', skillId: 'skill_terraform', minProficiency: 'proficient' },
  { jobId: 'job_senior_devops_enterprise', skillId: 'skill_aws', minProficiency: 'proficient' },

  // Mid Platform SaaS
  { jobId: 'job_mid_platform_saas', skillId: 'skill_kubernetes', minProficiency: 'proficient' },
  { jobId: 'job_mid_platform_saas', skillId: 'skill_docker', minProficiency: 'proficient' },
  { jobId: 'job_mid_platform_saas', skillId: 'skill_terraform', minProficiency: 'proficient' },

  // Senior ML Fintech
  { jobId: 'job_senior_ml_fintech', skillId: 'skill_python', minProficiency: 'expert' },
  { jobId: 'job_senior_ml_fintech', skillId: 'skill_tensorflow', minProficiency: 'proficient' },
  { jobId: 'job_senior_ml_fintech', skillId: 'skill_spark', minProficiency: 'proficient' },

  // Staff ML Research
  { jobId: 'job_staff_ml_research', skillId: 'skill_python', minProficiency: 'expert' },
  { jobId: 'job_staff_ml_research', skillId: 'skill_tensorflow', minProficiency: 'expert' },
  { jobId: 'job_staff_ml_research', skillId: 'skill_system_design', minProficiency: 'expert' },

  // Principal Distributed Systems
  { jobId: 'job_principal_distributed_systems', skillId: 'skill_system_design', minProficiency: 'expert' },
  { jobId: 'job_principal_distributed_systems', skillId: 'skill_event_driven', minProficiency: 'expert' },
  { jobId: 'job_principal_distributed_systems', skillId: 'skill_mentorship', minProficiency: 'expert' },
];

export const jobPreferredSkills: JobPreferredSkill[] = [
  // Senior Backend Fintech
  { jobId: 'job_senior_backend_fintech', skillId: 'skill_redis', minProficiency: 'proficient' },
  { jobId: 'job_senior_backend_fintech', skillId: 'skill_mentorship' },

  // Staff Architect Fintech
  { jobId: 'job_staff_architect_fintech', skillId: 'skill_kafka', minProficiency: 'proficient' },
  { jobId: 'job_staff_architect_fintech', skillId: 'skill_team_leadership' },

  // Mid Frontend SaaS
  { jobId: 'job_mid_frontend_saas', skillId: 'skill_nextjs', minProficiency: 'proficient' },
  { jobId: 'job_mid_frontend_saas', skillId: 'skill_unit_testing' },

  // Senior Full Stack E-commerce
  { jobId: 'job_senior_fullstack_ecommerce', skillId: 'skill_graphql', minProficiency: 'proficient' },
  { jobId: 'job_senior_fullstack_ecommerce', skillId: 'skill_redis' },

  // Junior Frontend Startup
  { jobId: 'job_junior_frontend_startup', skillId: 'skill_typescript' },
  { jobId: 'job_junior_frontend_startup', skillId: 'skill_learning' },

  // Senior Backend Healthcare
  { jobId: 'job_senior_backend_healthcare', skillId: 'skill_nodejs', minProficiency: 'proficient' },
  { jobId: 'job_senior_backend_healthcare', skillId: 'skill_docker' },

  // Mid Data Healthcare
  { jobId: 'job_mid_data_healthcare', skillId: 'skill_data_modeling' },
  { jobId: 'job_mid_data_healthcare', skillId: 'skill_attention_detail' },

  // Senior DevOps Enterprise
  { jobId: 'job_senior_devops_enterprise', skillId: 'skill_python', minProficiency: 'proficient' },
  { jobId: 'job_senior_devops_enterprise', skillId: 'skill_go' },

  // Mid Platform SaaS
  { jobId: 'job_mid_platform_saas', skillId: 'skill_aws', minProficiency: 'proficient' },
  { jobId: 'job_mid_platform_saas', skillId: 'skill_python' },

  // Senior ML Fintech
  { jobId: 'job_senior_ml_fintech', skillId: 'skill_kafka' },
  { jobId: 'job_senior_ml_fintech', skillId: 'skill_analytical' },

  // Staff ML Research
  { jobId: 'job_staff_ml_research', skillId: 'skill_distributed' },
  { jobId: 'job_staff_ml_research', skillId: 'skill_mentorship' },

  // Principal Distributed Systems
  { jobId: 'job_principal_distributed_systems', skillId: 'skill_kafka', minProficiency: 'expert' },
  { jobId: 'job_principal_distributed_systems', skillId: 'skill_kubernetes' },
];

// ============================================
// JOB DOMAIN REQUIREMENTS
// ============================================

export const jobRequiredBusinessDomains: JobRequiredBusinessDomain[] = [
  // Fintech roles require fintech/payments experience
  { jobId: 'job_senior_backend_fintech', businessDomainId: 'bd_fintech', minYears: 3 },
  { jobId: 'job_staff_architect_fintech', businessDomainId: 'bd_fintech', minYears: 5 },
  { jobId: 'job_staff_architect_fintech', businessDomainId: 'bd_banking', minYears: 3 },

  // Healthcare roles require healthcare experience
  { jobId: 'job_senior_backend_healthcare', businessDomainId: 'bd_healthcare', minYears: 2 },
  { jobId: 'job_mid_data_healthcare', businessDomainId: 'bd_healthcare', minYears: 1 },

  // E-commerce role prefers but requires some experience
  { jobId: 'job_senior_fullstack_ecommerce', businessDomainId: 'bd_ecommerce', minYears: 2 },

  // ML Fintech needs fintech context
  { jobId: 'job_senior_ml_fintech', businessDomainId: 'bd_fintech', minYears: 2 },
];

export const jobPreferredBusinessDomains: JobPreferredBusinessDomain[] = [
  // Fintech roles prefer payments expertise
  { jobId: 'job_senior_backend_fintech', businessDomainId: 'bd_payments', minYears: 2 },

  // Healthcare roles prefer pharma experience
  { jobId: 'job_senior_backend_healthcare', businessDomainId: 'bd_pharma', minYears: 1 },
  { jobId: 'job_mid_data_healthcare', businessDomainId: 'bd_pharma' },

  // SaaS roles prefer SaaS experience
  { jobId: 'job_mid_frontend_saas', businessDomainId: 'bd_saas', minYears: 2 },
  { jobId: 'job_mid_platform_saas', businessDomainId: 'bd_saas', minYears: 2 },

  // E-commerce also values SaaS experience
  { jobId: 'job_senior_fullstack_ecommerce', businessDomainId: 'bd_saas' },
];

export const jobRequiredTechnicalDomains: JobRequiredTechnicalDomain[] = [
  // Backend roles
  { jobId: 'job_senior_backend_fintech', technicalDomainId: 'td_backend' },
  { jobId: 'job_senior_backend_healthcare', technicalDomainId: 'td_backend' },

  // Frontend roles
  { jobId: 'job_mid_frontend_saas', technicalDomainId: 'td_frontend' },
  { jobId: 'job_junior_frontend_startup', technicalDomainId: 'td_frontend' },

  // Full Stack roles
  { jobId: 'job_senior_fullstack_ecommerce', technicalDomainId: 'td_fullstack' },

  // DevOps/Platform roles
  { jobId: 'job_senior_devops_enterprise', technicalDomainId: 'td_devops' },
  { jobId: 'job_mid_platform_saas', technicalDomainId: 'td_devops' },

  // ML roles
  { jobId: 'job_senior_ml_fintech', technicalDomainId: 'td_ml' },
  { jobId: 'job_staff_ml_research', technicalDomainId: 'td_ml' },
  { jobId: 'job_mid_data_healthcare', technicalDomainId: 'td_data_engineering' },

  // Architect/Principal roles - distributed systems
  { jobId: 'job_staff_architect_fintech', technicalDomainId: 'td_distributed_systems' },
  { jobId: 'job_principal_distributed_systems', technicalDomainId: 'td_distributed_systems' },
];

export const jobPreferredTechnicalDomains: JobPreferredTechnicalDomain[] = [
  // Backend roles that would benefit from devops knowledge
  { jobId: 'job_senior_backend_fintech', technicalDomainId: 'td_devops' },
  { jobId: 'job_senior_backend_healthcare', technicalDomainId: 'td_devops' },

  // Full stack that would benefit from backend depth
  { jobId: 'job_senior_fullstack_ecommerce', technicalDomainId: 'td_backend' },

  // Platform roles that would benefit from backend
  { jobId: 'job_mid_platform_saas', technicalDomainId: 'td_backend' },

  // ML roles that would benefit from backend
  { jobId: 'job_senior_ml_fintech', technicalDomainId: 'td_backend' },
];
