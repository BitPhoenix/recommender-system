# Job Description Seeding Implementation Plan

## Overview

Add support for seeding `JobDescription` nodes into the Neo4j graph database, with embeddings generated using Ollama's `mxbai-embed-large` model. This enables job-to-engineer matching using both constraint-based filtering (via skill/domain requirements) and semantic search (via embeddings).

## Current State Analysis

### What Exists

- **33 engineers** seeded with skills, work experiences, domains, and resumes
- **138 skills** with embeddings (1024-dimensional vectors via `mxbai-embed-large`)
- **Business and Technical domains** with hierarchy relationships
- **Seed infrastructure**: `seeds/seed.ts` orchestrates seeding with MERGE-based idempotent patterns
- **Vector index** pattern established: `skill_embedding_index` and `engineer_embedding_index`
- **Embedding generation pattern**: `seeds/skill-embeddings.ts` shows how to generate and store embeddings

### What's Missing

- `JobDescription` node type and constraint
- Job description seed data (10-15 diverse jobs)
- Relationships: `REQUIRES_SKILL`, `PREFERS_SKILL`, `REQUIRES_DOMAIN`, `PREFERS_DOMAIN`
- Job description embeddings for semantic search
- Vector index for job description embeddings

### Key Discoveries

- `seeds/types.ts:1-263` - All entity types defined here, no `JobDescription` yet
- `seeds/seed.ts:47-69` - Constraints created in `createConstraints()`
- `seeds/seed.ts:792-797` - Migrations and embeddings run at end of seed
- `seeds/skill-embeddings.ts:76-135` - Pattern for embedding generation and storage
- `seeds/resumes.ts:2595-2667` - Pattern for seeding nodes with relationships

## Desired End State

After completing all phases:

1. **JobDescription nodes** seeded in Neo4j with:
   - Core properties: id, title, description, company, location, seniority, budget, timeline, timezone
   - Embeddings: 1024-dimensional vectors from title + description text
   - Relationships to Skill and Domain nodes

2. **Job-Skill relationships** seeded:
   - `REQUIRES_SKILL` - Hard requirements with optional `minProficiency`
   - `PREFERS_SKILL` - Nice-to-haves with optional `minProficiency`

3. **Job-Domain relationships** seeded:
   - `REQUIRES_BUSINESS_DOMAIN` - Required business domain experience with `minYears`
   - `PREFERS_BUSINESS_DOMAIN` - Preferred business domain experience
   - `REQUIRES_TECHNICAL_DOMAIN` - Required technical domain (e.g., "Backend")
   - `PREFERS_TECHNICAL_DOMAIN` - Preferred technical domain

4. **Vector index** for job description embeddings

5. **Diverse job data** covering:
   - All seniority levels (junior through principal)
   - Multiple business domains (fintech, healthcare, e-commerce)
   - Various technical domains (frontend, backend, full stack, DevOps, ML)
   - Range of budgets and timelines

### Verification

- All automated tests pass (`npm test`, `npm run typecheck`)
- Job descriptions seeded: `MATCH (j:JobDescription) RETURN count(j)` returns 10-15
- Jobs have embeddings: `MATCH (j:JobDescription) WHERE j.embedding IS NOT NULL RETURN count(j)`
- Skill relationships exist: `MATCH (j:JobDescription)-[:REQUIRES_SKILL]->(s:Skill) RETURN count(*)`
- Domain relationships exist: `MATCH (j:JobDescription)-[:REQUIRES_BUSINESS_DOMAIN]->(d:BusinessDomain) RETURN count(*)`

## What We're NOT Doing

- **Job description parsing from text** - This is manual seed data; LLM-based extraction is future work
- **Job matching API** - This plan focuses on seeding; API endpoints for matching are future work
- **Salary/budget matching logic** - Just storing budget data; utility scoring is future work
- **Company-to-job relationships** - Jobs have `companyName` as a string property, not linked to Company nodes
- **Recruiter/HiringManager nodes** - Not needed for initial seeding

## Implementation Approach

**Three phases**, building progressively:

1. **Phase 1: Data Model & Types** - Define types, constraints, and seed data structure
2. **Phase 2: Job Description Seeding** - Seed job nodes and relationships
3. **Phase 3: Job Description Embeddings** - Generate and store embeddings

---

## Phase 1: Data Model & Types

### Overview

Define the TypeScript types for job descriptions and create the seed data file with 10-15 diverse job listings that match the existing engineer profiles.

### Changes Required

#### 1.1 Add Types to seeds/types.ts

**File**: `seeds/types.ts`

Add to the end of the file:

```typescript
// ============================================
// JOB DESCRIPTION TYPES
// ============================================

export type JobSeniority = 'junior' | 'mid' | 'senior' | 'staff' | 'principal';

export interface JobDescription {
  id: string;
  title: string;
  description: string;
  companyName: string;
  location: string;
  seniority: JobSeniority;
  minBudget: number;
  maxBudget: number;
  stretchBudget?: number;
  startTimeline: StartTimeline;
  timezone: string[];
  teamFocus?: 'greenfield' | 'migration' | 'maintenance' | 'scaling';
  createdAt: string;
}

export interface JobRequiredSkill {
  jobId: string;
  skillId: string;
  minProficiency?: ProficiencyLevel;
}

export interface JobPreferredSkill {
  jobId: string;
  skillId: string;
  minProficiency?: ProficiencyLevel;
}

export interface JobRequiredBusinessDomain {
  jobId: string;
  businessDomainId: string;
  minYears: number;
}

export interface JobPreferredBusinessDomain {
  jobId: string;
  businessDomainId: string;
  minYears?: number;
}

export interface JobRequiredTechnicalDomain {
  jobId: string;
  technicalDomainId: string;
}

export interface JobPreferredTechnicalDomain {
  jobId: string;
  technicalDomainId: string;
}
```

#### 1.2 Create Job Descriptions Seed Data

**File**: `seeds/job-descriptions.ts` (new)

```typescript
import { Session } from 'neo4j-driver';
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
```

#### 1.3 Update seeds/index.ts

**File**: `seeds/index.ts`

Add export for job descriptions:

```typescript
export * from './skills';
export * from './engineers';
export * from './stories';
export * from './assessments';
export * from './domains';
export * from './skill-categories';
export * from './resumes';
export * from './job-descriptions';
```

### Success Criteria

#### Automated Verification:

- [x] TypeScript compiles: `npm run typecheck` (from recommender_api directory)
- [x] Types are properly exported from seeds/index.ts
- [x] Unit tests pass: `npm test -- job-descriptions` validates:
  - Job descriptions cover all seniority levels (junior, mid, senior, staff, principal)
  - Jobs span fintech, healthcare, e-commerce, SaaS domains
  - All required skill IDs exist in skills.ts
  - All domain IDs exist in domains.ts

#### 1.4 Add Seed Data Validation Tests

**File**: `seeds/__tests__/job-descriptions.test.ts` (new)

```typescript
import { describe, it, expect } from 'vitest';
import {
  jobDescriptions,
  jobRequiredSkills,
  jobPreferredSkills,
  jobRequiredBusinessDomains,
  jobPreferredBusinessDomains,
  jobRequiredTechnicalDomains,
  jobPreferredTechnicalDomains,
} from '../job-descriptions';
import { skills } from '../skills';
import { businessDomains, technicalDomains } from '../domains';

describe('Job Description Seed Data Validation', () => {
  const skillIds = new Set(skills.map(s => s.id));
  const businessDomainIds = new Set(businessDomains.map(d => d.id));
  const technicalDomainIds = new Set(technicalDomains.map(d => d.id));
  const jobIds = new Set(jobDescriptions.map(j => j.id));

  describe('jobDescriptions', () => {
    it('covers all seniority levels', () => {
      const seniorities = new Set(jobDescriptions.map(j => j.seniority));
      expect(seniorities).toContain('junior');
      expect(seniorities).toContain('mid');
      expect(seniorities).toContain('senior');
      expect(seniorities).toContain('staff');
      expect(seniorities).toContain('principal');
    });

    it('has unique job IDs', () => {
      const ids = jobDescriptions.map(j => j.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('has valid startTimeline values', () => {
      const validTimelines = ['immediate', 'two_weeks', 'one_month', 'three_months', 'six_months', 'one_year'];
      for (const job of jobDescriptions) {
        expect(validTimelines).toContain(job.startTimeline);
      }
    });

    it('has valid timezone values', () => {
      const validTimezones = ['Eastern', 'Central', 'Mountain', 'Pacific'];
      for (const job of jobDescriptions) {
        for (const tz of job.timezone) {
          expect(validTimezones).toContain(tz);
        }
      }
    });

    it('has minBudget <= maxBudget', () => {
      for (const job of jobDescriptions) {
        expect(job.minBudget).toBeLessThanOrEqual(job.maxBudget);
        if (job.stretchBudget) {
          expect(job.maxBudget).toBeLessThanOrEqual(job.stretchBudget);
        }
      }
    });
  });

  describe('jobRequiredSkills', () => {
    it('references only valid job IDs', () => {
      for (const req of jobRequiredSkills) {
        expect(jobIds.has(req.jobId)).toBe(true);
      }
    });

    it('references only valid skill IDs', () => {
      for (const req of jobRequiredSkills) {
        expect(skillIds.has(req.skillId)).toBe(true);
      }
    });
  });

  describe('jobPreferredSkills', () => {
    it('references only valid job IDs', () => {
      for (const pref of jobPreferredSkills) {
        expect(jobIds.has(pref.jobId)).toBe(true);
      }
    });

    it('references only valid skill IDs', () => {
      for (const pref of jobPreferredSkills) {
        expect(skillIds.has(pref.skillId)).toBe(true);
      }
    });
  });

  describe('jobRequiredBusinessDomains', () => {
    it('references only valid job IDs', () => {
      for (const req of jobRequiredBusinessDomains) {
        expect(jobIds.has(req.jobId)).toBe(true);
      }
    });

    it('references only valid business domain IDs', () => {
      for (const req of jobRequiredBusinessDomains) {
        expect(businessDomainIds.has(req.businessDomainId)).toBe(true);
      }
    });
  });

  describe('jobPreferredBusinessDomains', () => {
    it('references only valid job IDs', () => {
      for (const pref of jobPreferredBusinessDomains) {
        expect(jobIds.has(pref.jobId)).toBe(true);
      }
    });

    it('references only valid business domain IDs', () => {
      for (const pref of jobPreferredBusinessDomains) {
        expect(businessDomainIds.has(pref.businessDomainId)).toBe(true);
      }
    });
  });

  describe('jobRequiredTechnicalDomains', () => {
    it('references only valid job IDs', () => {
      for (const req of jobRequiredTechnicalDomains) {
        expect(jobIds.has(req.jobId)).toBe(true);
      }
    });

    it('references only valid technical domain IDs', () => {
      for (const req of jobRequiredTechnicalDomains) {
        expect(technicalDomainIds.has(req.technicalDomainId)).toBe(true);
      }
    });
  });

  describe('jobPreferredTechnicalDomains', () => {
    it('references only valid job IDs', () => {
      for (const pref of jobPreferredTechnicalDomains) {
        expect(jobIds.has(pref.jobId)).toBe(true);
      }
    });

    it('references only valid technical domain IDs', () => {
      for (const pref of jobPreferredTechnicalDomains) {
        expect(technicalDomainIds.has(pref.technicalDomainId)).toBe(true);
      }
    });
  });
});
```

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 2.

---

## Phase 2: Job Description Seeding

### Overview

Add seeding functions to create JobDescription nodes in Neo4j and establish relationships to Skill and Domain nodes.

### Changes Required

#### 2.1 Add JobDescription Constraint

**File**: `seeds/seed.ts`

Add to the `createConstraints` function (around line 68):

```typescript
// Job description constraint
'CREATE CONSTRAINT job_description_id IF NOT EXISTS FOR (j:JobDescription) REQUIRE j.id IS UNIQUE',
```

#### 2.2 Create Seed Functions for Job Descriptions

**File**: `seeds/seed.ts`

Add imports at the top (after line 23):

```typescript
import {
  jobDescriptions,
  jobRequiredSkills,
  jobPreferredSkills,
  jobRequiredBusinessDomains,
  jobPreferredBusinessDomains,
  jobRequiredTechnicalDomains,
  jobPreferredTechnicalDomains,
} from './job-descriptions';
```

Add seed category type (update line 35):

```typescript
type SeedCategory = 'skills' | 'engineers' | 'stories' | 'assessments' | 'domains' | 'jobs' | 'all';
```

Add seeding functions (after `seedEngineerTechnicalDomainExperience`, around line 706):

```typescript
// ============================================
// JOB DESCRIPTION SEEDING
// ============================================

async function seedJobDescriptions(session: Session): Promise<void> {
  console.log('📋 Seeding job descriptions...');

  for (const job of jobDescriptions) {
    await session.run(
      `MERGE (j:JobDescription {id: $id})
       ON CREATE SET
         j.title = $title,
         j.description = $description,
         j.companyName = $companyName,
         j.location = $location,
         j.seniority = $seniority,
         j.minBudget = $minBudget,
         j.maxBudget = $maxBudget,
         j.stretchBudget = $stretchBudget,
         j.startTimeline = $startTimeline,
         j.timezone = $timezone,
         j.teamFocus = $teamFocus,
         j.createdAt = datetime($createdAt)
       ON MATCH SET
         j.title = $title,
         j.description = $description,
         j.companyName = $companyName,
         j.location = $location,
         j.seniority = $seniority,
         j.minBudget = $minBudget,
         j.maxBudget = $maxBudget,
         j.stretchBudget = $stretchBudget,
         j.startTimeline = $startTimeline,
         j.timezone = $timezone,
         j.teamFocus = $teamFocus,
         j.updatedAt = datetime()`,
      {
        ...job,
        stretchBudget: job.stretchBudget ?? null,
        teamFocus: job.teamFocus ?? null,
      }
    );
  }
  console.log(`   ✓ Seeded ${jobDescriptions.length} job descriptions`);
}

async function seedJobRequiredSkills(session: Session): Promise<void> {
  console.log('🎯 Seeding job required skills...');

  for (const req of jobRequiredSkills) {
    await session.run(
      `MATCH (j:JobDescription {id: $jobId})
       MATCH (s:Skill {id: $skillId})
       MERGE (j)-[r:REQUIRES_SKILL]->(s)
       ON CREATE SET r.minProficiency = $minProficiency
       ON MATCH SET r.minProficiency = $minProficiency`,
      {
        jobId: req.jobId,
        skillId: req.skillId,
        minProficiency: req.minProficiency ?? null,
      }
    );
  }
  console.log(`   ✓ Seeded ${jobRequiredSkills.length} required skill relationships`);
}

async function seedJobPreferredSkills(session: Session): Promise<void> {
  console.log('✨ Seeding job preferred skills...');

  for (const pref of jobPreferredSkills) {
    await session.run(
      `MATCH (j:JobDescription {id: $jobId})
       MATCH (s:Skill {id: $skillId})
       MERGE (j)-[r:PREFERS_SKILL]->(s)
       ON CREATE SET r.minProficiency = $minProficiency
       ON MATCH SET r.minProficiency = $minProficiency`,
      {
        jobId: pref.jobId,
        skillId: pref.skillId,
        minProficiency: pref.minProficiency ?? null,
      }
    );
  }
  console.log(`   ✓ Seeded ${jobPreferredSkills.length} preferred skill relationships`);
}

async function seedJobRequiredBusinessDomains(session: Session): Promise<void> {
  console.log('🏢 Seeding job required business domains...');

  for (const req of jobRequiredBusinessDomains) {
    await session.run(
      `MATCH (j:JobDescription {id: $jobId})
       MATCH (d:BusinessDomain {id: $domainId})
       MERGE (j)-[r:REQUIRES_BUSINESS_DOMAIN]->(d)
       ON CREATE SET r.minYears = $minYears
       ON MATCH SET r.minYears = $minYears`,
      {
        jobId: req.jobId,
        domainId: req.businessDomainId,
        minYears: req.minYears,
      }
    );
  }
  console.log(`   ✓ Seeded ${jobRequiredBusinessDomains.length} required business domain relationships`);
}

async function seedJobPreferredBusinessDomains(session: Session): Promise<void> {
  console.log('💼 Seeding job preferred business domains...');

  for (const pref of jobPreferredBusinessDomains) {
    await session.run(
      `MATCH (j:JobDescription {id: $jobId})
       MATCH (d:BusinessDomain {id: $domainId})
       MERGE (j)-[r:PREFERS_BUSINESS_DOMAIN]->(d)
       ON CREATE SET r.minYears = $minYears
       ON MATCH SET r.minYears = $minYears`,
      {
        jobId: pref.jobId,
        domainId: pref.businessDomainId,
        minYears: pref.minYears ?? null,
      }
    );
  }
  console.log(`   ✓ Seeded ${jobPreferredBusinessDomains.length} preferred business domain relationships`);
}

async function seedJobRequiredTechnicalDomains(session: Session): Promise<void> {
  console.log('⚙️  Seeding job required technical domains...');

  for (const req of jobRequiredTechnicalDomains) {
    await session.run(
      `MATCH (j:JobDescription {id: $jobId})
       MATCH (d:TechnicalDomain {id: $domainId})
       MERGE (j)-[:REQUIRES_TECHNICAL_DOMAIN]->(d)`,
      {
        jobId: req.jobId,
        domainId: req.technicalDomainId,
      }
    );
  }
  console.log(`   ✓ Seeded ${jobRequiredTechnicalDomains.length} required technical domain relationships`);
}

async function seedJobPreferredTechnicalDomains(session: Session): Promise<void> {
  console.log('🔧 Seeding job preferred technical domains...');

  for (const pref of jobPreferredTechnicalDomains) {
    await session.run(
      `MATCH (j:JobDescription {id: $jobId})
       MATCH (d:TechnicalDomain {id: $domainId})
       MERGE (j)-[:PREFERS_TECHNICAL_DOMAIN]->(d)`,
      {
        jobId: pref.jobId,
        domainId: pref.technicalDomainId,
      }
    );
  }
  console.log(`   ✓ Seeded ${jobPreferredTechnicalDomains.length} preferred technical domain relationships`);
}
```

#### 2.3 Add Jobs Category to Seed Orchestration

**File**: `seeds/seed.ts`

Add after the assessments block (around line 789, before migrations):

```typescript
if (shouldSeedCategory('jobs')) {
  // Jobs require skills and domains to be seeded first
  await seedJobDescriptions(session);
  await seedJobRequiredSkills(session);
  await seedJobPreferredSkills(session);
  await seedJobRequiredBusinessDomains(session);
  await seedJobPreferredBusinessDomains(session);
  await seedJobRequiredTechnicalDomains(session);
  await seedJobPreferredTechnicalDomains(session);
}
```

### Success Criteria

#### Automated Verification:

- [x] TypeScript compiles: `npm run typecheck`
- [x] Seed runs without errors (watch Tilt logs after saving seed.ts)
- [x] Seed verification tests pass: `npm test -- seed-verification` validates Neo4j state

#### 2.4 Add Seed Verification Integration Tests

**File**: `recommender_api/src/__tests__/integration/job-seed-verification.test.ts` (new)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import neo4j, { Driver, Session } from 'neo4j-driver';
import { jobDescriptions, jobRequiredSkills, jobRequiredBusinessDomains } from '../../../../seeds/job-descriptions';

describe('Job Description Seed Verification', () => {
  let driver: Driver;
  let session: Session;

  beforeAll(async () => {
    driver = neo4j.driver(
      process.env.NEO4J_URI || 'bolt://localhost:7687',
      neo4j.auth.basic(
        process.env.NEO4J_USER || 'neo4j',
        process.env.NEO4J_PASSWORD || 'password'
      )
    );
    session = driver.session();
  });

  afterAll(async () => {
    await session.close();
    await driver.close();
  });

  it('seeds all job descriptions', async () => {
    const result = await session.run('MATCH (j:JobDescription) RETURN count(j) AS count');
    const count = result.records[0].get('count').toNumber();
    expect(count).toBe(jobDescriptions.length);
  });

  it('creates REQUIRES_SKILL relationships', async () => {
    const result = await session.run(
      'MATCH (j:JobDescription)-[:REQUIRES_SKILL]->(s:Skill) RETURN count(*) AS count'
    );
    const count = result.records[0].get('count').toNumber();
    expect(count).toBe(jobRequiredSkills.length);
  });

  it('creates REQUIRES_BUSINESS_DOMAIN relationships', async () => {
    const result = await session.run(
      'MATCH (j:JobDescription)-[:REQUIRES_BUSINESS_DOMAIN]->(d:BusinessDomain) RETURN count(*) AS count'
    );
    const count = result.records[0].get('count').toNumber();
    expect(count).toBe(jobRequiredBusinessDomains.length);
  });

  it('sets correct properties on job_senior_backend_fintech', async () => {
    const result = await session.run(
      `MATCH (j:JobDescription {id: 'job_senior_backend_fintech'})
       RETURN j.title AS title, j.seniority AS seniority, j.minBudget AS minBudget, j.maxBudget AS maxBudget`
    );
    expect(result.records.length).toBe(1);
    const record = result.records[0];
    expect(record.get('title')).toBe('Senior Backend Engineer - Payments Platform');
    expect(record.get('seniority')).toBe('senior');
    expect(record.get('minBudget').toNumber()).toBe(180000);
    expect(record.get('maxBudget').toNumber()).toBe(220000);
  });

  it('links correct skills to job_senior_backend_fintech', async () => {
    const result = await session.run(
      `MATCH (j:JobDescription {id: 'job_senior_backend_fintech'})-[:REQUIRES_SKILL]->(s:Skill)
       RETURN s.id AS skillId ORDER BY skillId`
    );
    const skillIds = result.records.map(r => r.get('skillId'));
    expect(skillIds).toContain('skill_typescript');
    expect(skillIds).toContain('skill_nodejs');
    expect(skillIds).toContain('skill_postgresql');
    expect(skillIds).toContain('skill_kafka');
  });
});
```

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 3.

---

## Phase 3: Job Description Embeddings

### Overview

Generate and store 1024-dimensional embeddings for each job description using Ollama's `mxbai-embed-large` model, following the same pattern used for skill embeddings.

### Changes Required

#### 3.1 Create Job Description Embeddings Migration

**File**: `seeds/migrations/003-add-job-vector-index.ts` (new)

```typescript
import { Session } from "neo4j-driver";

/**
 * Migration: Add vector index for job description embeddings.
 *
 * Uses the same configuration as skill_embedding_index:
 * - 1024 dimensions (mxbai-embed-large output size)
 * - Cosine similarity function
 */
export async function addJobDescriptionVectorIndex(session: Session): Promise<void> {
  console.log("[Migration] Creating job description embedding vector index...");

  await session.run(`
    CREATE VECTOR INDEX job_description_embedding_index IF NOT EXISTS
    FOR (j:JobDescription)
    ON (j.embedding)
    OPTIONS {
      indexConfig: {
        \`vector.dimensions\`: 1024,
        \`vector.similarity_function\`: 'cosine'
      }
    }
  `);

  console.log("[Migration] Job description vector index created.");
}
```

#### 3.2 Create Job Description Embeddings Seed Function

**File**: `seeds/job-description-embeddings.ts` (new)

```typescript
import { Session } from "neo4j-driver";
import { Ollama } from "ollama";

/*
 * Self-contained job description embedding generation for the seed script.
 *
 * Generates a 1024-dimensional dense vector for each job description
 * using Ollama's mxbai-embed-large model. Skips jobs that already
 * have embeddings (idempotent).
 */

const LLM_HOST = process.env.LLM_HOST || "http://host.docker.internal:11434";
const LLM_EMBEDDING_MODEL = process.env.LLM_EMBEDDING_MODEL || "mxbai-embed-large";
const LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS || "30000", 10);

let ollamaClient: Ollama | null = null;

function getClient(): Ollama {
  if (!ollamaClient) {
    ollamaClient = new Ollama({ host: LLM_HOST });
  }
  return ollamaClient;
}

/*
 * Check if Ollama is available.
 */
async function isOllamaAvailable(): Promise<boolean> {
  try {
    const client = getClient();
    await client.list();
    return true;
  } catch (error) {
    return false;
  }
}

/*
 * Generate an embedding vector for text using Ollama.
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const client = getClient();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS * 2);

    try {
      const response = await client.embed({
        model: LLM_EMBEDDING_MODEL,
        input: text,
      });

      clearTimeout(timeoutId);
      return response.embeddings[0];
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("[Seed] Job description embedding request timed out");
    } else {
      console.warn("[Seed] Job description embedding generation failed:", error);
    }
    return null;
  }
}

/**
 * Concatenate job title and description for embedding generation.
 *
 * The title provides high-signal keywords (e.g., "Senior Backend Engineer"),
 * while the description provides detailed context about requirements.
 */
function getJobTextForEmbedding(title: string, description: string): string {
  return `${title}\n\n${description}`;
}

/*
 * Seed job description embeddings using Ollama's mxbai-embed-large model.
 *
 * Generates a 1024-dimensional dense vector for each job's title + description.
 * Skips jobs that already have embeddings (idempotent).
 */
export async function seedJobDescriptionEmbeddings(session: Session): Promise<void> {
  console.log("[Seed] Generating job description embeddings...");
  console.log(`[Seed] Using LLM_HOST: ${LLM_HOST}`);
  console.log(`[Seed] Using embedding model: ${LLM_EMBEDDING_MODEL}`);

  // Check if Ollama is available
  const ollamaAvailable = await isOllamaAvailable();
  if (!ollamaAvailable) {
    console.log("[Seed] Ollama not available, skipping job description embeddings.");
    return;
  }

  // Get all job descriptions without embeddings
  const result = await session.run(`
    MATCH (j:JobDescription)
    WHERE j.embedding IS NULL
    RETURN j.id AS jobId, j.title AS title, j.description AS description
  `);

  const jobCount = result.records.length;
  if (jobCount === 0) {
    console.log("[Seed] All job descriptions already have embeddings.");
    return;
  }

  console.log(`[Seed] Generating embeddings for ${jobCount} job descriptions...`);

  let successCount = 0;
  let failCount = 0;

  for (const record of result.records) {
    const jobId = record.get("jobId") as string;
    const title = record.get("title") as string;
    const description = record.get("description") as string;

    const textForEmbedding = getJobTextForEmbedding(title, description);
    const embedding = await generateEmbedding(textForEmbedding);

    if (embedding) {
      await session.run(`
        MATCH (j:JobDescription {id: $jobId})
        SET j.embedding = $embedding,
            j.embeddingModel = $model,
            j.embeddingUpdatedAt = datetime()
      `, {
        jobId,
        embedding,
        model: LLM_EMBEDDING_MODEL,
      });
      successCount++;
    } else {
      console.warn(`[Seed] Failed to generate embedding for job: ${title}`);
      failCount++;
    }

    // Progress logging every 5 jobs (fewer jobs than skills)
    if ((successCount + failCount) % 5 === 0) {
      console.log(`[Seed] Progress: ${successCount + failCount}/${jobCount} jobs processed`);
    }
  }

  console.log(`[Seed] Job description embeddings complete: ${successCount} success, ${failCount} failed`);
}
```

#### 3.3 Update seeds/seed.ts to Run Job Embedding Generation

**File**: `seeds/seed.ts`

Add import at top (after line 24):

```typescript
import { addJobDescriptionVectorIndex } from './migrations/003-add-job-vector-index';
import { seedJobDescriptionEmbeddings } from './job-description-embeddings';
```

Add migration call (after line 793, after `addSkillVectorIndex`):

```typescript
await addJobDescriptionVectorIndex(session);
```

Add embedding generation (after line 797, after `seedSkillEmbeddings`):

```typescript
await seedJobDescriptionEmbeddings(session);
```

### Success Criteria

#### Automated Verification:

- [x] TypeScript compiles: `npm run typecheck`
- [x] Seed runs without errors (watch Tilt logs)
- [x] Embedding verification tests pass: `npm test -- embedding-verification` validates:
  - Vector index exists
  - All jobs have embeddings (when Ollama available)
  - Embedding dimensions are 1024
  - Embedding metadata is stored

#### 3.4 Add Embedding Verification Integration Tests

**File**: `recommender_api/src/__tests__/integration/job-embedding-verification.test.ts` (new)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import neo4j, { Driver, Session } from 'neo4j-driver';
import { jobDescriptions } from '../../../../seeds/job-descriptions';

describe('Job Description Embedding Verification', () => {
  let driver: Driver;
  let session: Session;

  beforeAll(async () => {
    driver = neo4j.driver(
      process.env.NEO4J_URI || 'bolt://localhost:7687',
      neo4j.auth.basic(
        process.env.NEO4J_USER || 'neo4j',
        process.env.NEO4J_PASSWORD || 'password'
      )
    );
    session = driver.session();
  });

  afterAll(async () => {
    await session.close();
    await driver.close();
  });

  it('creates job_description_embedding_index', async () => {
    const result = await session.run('SHOW INDEXES');
    const indexNames = result.records.map(r => r.get('name'));
    expect(indexNames).toContain('job_description_embedding_index');
  });

  it('generates embeddings for all jobs (when Ollama available)', async () => {
    const result = await session.run(
      'MATCH (j:JobDescription) WHERE j.embedding IS NOT NULL RETURN count(j) AS count'
    );
    const count = result.records[0].get('count').toNumber();
    /*
     * If Ollama was available during seeding, all jobs should have embeddings.
     * If Ollama was unavailable, count will be 0 (graceful skip).
     */
    expect(count === 0 || count === jobDescriptions.length).toBe(true);
  });

  it('stores embeddings with correct dimensions (1024)', async () => {
    const result = await session.run(
      `MATCH (j:JobDescription)
       WHERE j.embedding IS NOT NULL
       RETURN j.id AS jobId, size(j.embedding) AS dimensions
       LIMIT 1`
    );
    if (result.records.length > 0) {
      const dimensions = result.records[0].get('dimensions').toNumber();
      expect(dimensions).toBe(1024);
    }
  });

  it('stores embedding metadata', async () => {
    const result = await session.run(
      `MATCH (j:JobDescription {id: 'job_senior_backend_fintech'})
       WHERE j.embedding IS NOT NULL
       RETURN j.embeddingModel AS model, j.embeddingUpdatedAt AS updatedAt`
    );
    if (result.records.length > 0) {
      const record = result.records[0];
      expect(record.get('model')).toBe('mxbai-embed-large');
      expect(record.get('updatedAt')).not.toBeNull();
    }
  });
});
```

---

## Testing Strategy

### Automated Test Suite

All verification is automated via the test files created in each phase:

```bash
# Run all job description tests (from recommender_api directory)
npm test -- job-descriptions seed-verification embedding-verification

# Run just the seed data validation tests (no Neo4j required)
npm test -- job-descriptions

# Run integration tests (requires Neo4j to be running via Tilt)
npm test -- seed-verification embedding-verification
```

### Test Categories

| Test File | Type | Neo4j Required | What It Validates |
|-----------|------|----------------|-------------------|
| `seeds/__tests__/job-descriptions.test.ts` | Unit | No | Seed data integrity, valid IDs, coverage |
| `integration/job-seed-verification.test.ts` | Integration | Yes | Neo4j nodes and relationships created |
| `integration/job-embedding-verification.test.ts` | Integration | Yes | Vector index and embeddings stored |

## Performance Considerations

- **Embedding generation**: ~12 jobs × ~500ms each = ~6 seconds total
- **Neo4j MERGE operations**: Idempotent, safe to re-run
- **Vector index**: HNSW index enables O(log n) similarity queries

## Migration Notes

- Seeding is automatic via Tilt when seed files change
- No manual intervention required
- Embeddings require Ollama to be running; gracefully skipped if unavailable
- Re-running seed is safe (MERGE ensures idempotency)

## References

- Engineer analysis: `thoughts/private/research/2026-01-23-seeded-engineers-comprehensive-analysis.md`
- Skill embedding plan: `thoughts/shared/2_chapter_4/1_project_1/plans/2026-01-23-skill-embedding-similarity.md`
- Existing seed patterns: `seeds/seed.ts`, `seeds/skill-embeddings.ts`
- Domain definitions: `seeds/domains.ts`
- Skill definitions: `seeds/skills.ts`
