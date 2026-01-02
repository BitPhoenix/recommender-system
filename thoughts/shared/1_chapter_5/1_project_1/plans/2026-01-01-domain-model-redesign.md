# Domain Model Redesign Implementation Plan

**Status: ✅ COMPLETE** (2026-01-01)

All phases implemented and tested. The new domain model is live and working.

## Overview

Refactor the domain model to separate **Business Domains** and **Technical Domains** from the current skill-based approach. Currently, domains are modeled as Skill nodes with `skillType: 'domain_knowledge'`. This plan introduces proper domain nodes with explicit experience claims and hierarchical technical domains.

## Current State Analysis

### How Domains Work Today
- Domains are stored as `(:Skill {skillType: 'domain_knowledge'})` nodes
- Engineers link to domains via `(:Engineer)-[:HAS]->(:UserSkill)-[:FOR]->(:Skill)`
- Role-based categories (Backend, Frontend, Full Stack) use `BELONGS_TO` relationships
- No distinction between business domains (Fintech, Healthcare) and technical domains (Backend, ML)
- Domain filtering uses the same pattern as skill filtering

### Key Files Currently Involved
- `seeds/skills.ts:152-160` - Domain skills defined with `skillType: 'domain_knowledge'`
- `seeds/skills.ts:402-447` - Role-based category BELONGS_TO relationships
- `recommender_api/src/services/search.service.ts:340-349` - `getSkillIdsForDomains()` function
- `recommender_api/src/services/cypher-query-builder/query-domain-filter.builder.ts` - Domain query building

## Desired End State

### New Graph Model

```
// Business Domains (flat, explicit claims with years)
(:BusinessDomain {id: 'bd_fintech', name: 'Fintech'})
(:BusinessDomain {id: 'bd_healthcare', name: 'Healthcare'})
(:BusinessDomain {id: 'bd_ecommerce', name: 'E-commerce'})

(:Engineer)-[:HAS_EXPERIENCE_IN {years: 5}]->(:BusinessDomain)

// Technical Domains (nested hierarchy with two relationship types)
(:TechnicalDomain {id: 'td_backend', name: 'Backend'})
  ←[:CHILD_OF]- (:TechnicalDomain {id: 'td_api_dev', name: 'API Development'})
  ←[:CHILD_OF]- (:TechnicalDomain {id: 'td_database_eng', name: 'Database Engineering'})

(:TechnicalDomain {id: 'td_frontend', name: 'Frontend'})
  ←[:CHILD_OF]- (:TechnicalDomain {id: 'td_react_ecosystem', name: 'React Ecosystem'})

(:TechnicalDomain {id: 'td_ml', name: 'Machine Learning'})
  ←[:CHILD_OF]- (:TechnicalDomain {id: 'td_nlp', name: 'NLP'})
  ←[:CHILD_OF]- (:TechnicalDomain {id: 'td_computer_vision', name: 'Computer Vision'})

// ENCOMPASSES for composite domains (no upward inference)
(:TechnicalDomain {id: 'td_fullstack', name: 'Full Stack'})
  -[:ENCOMPASSES]->(:TechnicalDomain {id: 'td_backend'})
  -[:ENCOMPASSES]->(:TechnicalDomain {id: 'td_frontend'})

(:Engineer)-[:HAS_EXPERIENCE_IN {years: 3}]->(:TechnicalDomain)

// Skill Categories (new node type, extracted from Skill nodes with isCategory: true)
// Skills point to SkillCategories via BELONGS_TO, then SkillCategories point to TechnicalDomains
(:SkillCategory {id: 'sc_frontend_frameworks', name: 'Frontend Frameworks'})
(:SkillCategory {id: 'sc_backend_frameworks', name: 'Backend Frameworks'})
(:SkillCategory {id: 'sc_backend_languages', name: 'Backend Languages'})
(:SkillCategory {id: 'sc_databases', name: 'Databases'})
(:SkillCategory {id: 'sc_cloud', name: 'Cloud Platforms'})
(:SkillCategory {id: 'sc_containers', name: 'Containerization'})
(:SkillCategory {id: 'sc_cicd', name: 'CI/CD'})
(:SkillCategory {id: 'sc_testing', name: 'Testing'})
(:SkillCategory {id: 'sc_observability', name: 'Observability'})
(:SkillCategory {id: 'sc_security', name: 'Security'})

// Skills belong to Skill Categories via BELONGS_TO (can belong to multiple)
(:Skill {id: 'skill_react'})-[:BELONGS_TO]->(:SkillCategory {id: 'sc_frontend_frameworks'})
(:Skill {id: 'skill_vue'})-[:BELONGS_TO]->(:SkillCategory {id: 'sc_frontend_frameworks'})
(:Skill {id: 'skill_express'})-[:BELONGS_TO]->(:SkillCategory {id: 'sc_backend_frameworks'})
(:Skill {id: 'skill_django'})-[:BELONGS_TO]->(:SkillCategory {id: 'sc_backend_frameworks'})
(:Skill {id: 'skill_python'})-[:BELONGS_TO]->(:SkillCategory {id: 'sc_backend_languages'})
(:Skill {id: 'skill_go'})-[:BELONGS_TO]->(:SkillCategory {id: 'sc_backend_languages'})
(:Skill {id: 'skill_postgresql'})-[:BELONGS_TO]->(:SkillCategory {id: 'sc_databases'})
// JS/TS belong to BOTH frontend and backend categories
(:Skill {id: 'skill_javascript'})-[:BELONGS_TO]->(:SkillCategory {id: 'sc_frontend_frameworks'})
(:Skill {id: 'skill_javascript'})-[:BELONGS_TO]->(:SkillCategory {id: 'sc_backend_languages'})
(:Skill {id: 'skill_typescript'})-[:BELONGS_TO]->(:SkillCategory {id: 'sc_frontend_frameworks'})
(:Skill {id: 'skill_typescript'})-[:BELONGS_TO]->(:SkillCategory {id: 'sc_backend_languages'})

// Skill Categories map to Technical Domains via BELONGS_TO
(:SkillCategory {id: 'sc_frontend_frameworks'})-[:BELONGS_TO]->(:TechnicalDomain {id: 'td_frontend'})
(:SkillCategory {id: 'sc_backend_frameworks'})-[:BELONGS_TO]->(:TechnicalDomain {id: 'td_api_dev'})
(:SkillCategory {id: 'sc_backend_languages'})-[:BELONGS_TO]->(:TechnicalDomain {id: 'td_backend'})
(:SkillCategory {id: 'sc_databases'})-[:BELONGS_TO]->(:TechnicalDomain {id: 'td_database_eng'})
(:SkillCategory {id: 'sc_cloud'})-[:BELONGS_TO]->(:TechnicalDomain {id: 'td_cloud'})
(:SkillCategory {id: 'sc_containers'})-[:BELONGS_TO]->(:TechnicalDomain {id: 'td_kubernetes'})
(:SkillCategory {id: 'sc_cicd'})-[:BELONGS_TO]->(:TechnicalDomain {id: 'td_cicd'})
```

### Key Behaviors

| Claim | Implies |
|-------|---------|
| API Development (3 years) | → Backend experience (via CHILD_OF) |
| Backend (5 years) | ✗ Does NOT imply Full Stack |
| Full Stack (4 years) | → Backend AND Frontend experience (via ENCOMPASSES) |
| Has React skill (4 years) | → Frontend experience with **at least** 4 years (via Skill→SkillCategory→Domain chain) |
| Has Express skill (3 years) | → API Development (3y) → Backend (3y) experience (via Skill→SkillCategory→Domain + CHILD_OF chain) |
| Has JavaScript skill (5 years) | → Frontend AND Backend experience (JS belongs to both categories) |

### Inference Rules

1. **Domain CHILD_OF Domain**: Child domain experience implies parent domain experience (years inherited)
2. **Domain ENCOMPASSES Domain**: Composite domain experience implies encompassed domain experience
3. **Skill → SkillCategory → TechnicalDomain chain**: Skill ownership implies domain experience through a two-level BELONGS_TO chain:
   - `(:Skill)-[:BELONGS_TO]->(:SkillCategory)` - Skills belong to categories
   - `(:SkillCategory)-[:BELONGS_TO]->(:TechnicalDomain)` - Categories belong to domains

#### Rationale for Inference Rules

**Rule 1: CHILD_OF implies parent experience**

A child domain is a specialization of the parent. Someone with API Development experience has necessarily been doing Backend work—you cannot build APIs without working on backend systems. The specialization is a subset of the broader domain.

Real-world reasoning: If you've spent 3 years building REST APIs, you've spent 3 years doing backend development. The API work happened *within* the backend context. Therefore, claiming API Development experience is evidence of Backend experience.

Direction: Upward only. Child → Parent. Having Backend experience does NOT imply API Development experience (you might have done database work instead).

**Rule 2: ENCOMPASSES implies encompassed experience**

A composite domain explicitly includes multiple domains as part of its definition. "Full Stack" is defined as someone who works across both frontend and backend. Claiming Full Stack experience is a claim that you've done both.

Real-world reasoning: If you've worked as a Full Stack developer for 4 years, you've necessarily touched both frontend and backend code during that time. The composite role requires both.

Direction: Downward only. Composite → Encompassed. Having Backend + Frontend experience does NOT automatically make you Full Stack (you might lack the integration/breadth that defines full-stack work).

**Rule 3: Skill → SkillCategory → Domain chain**

Skills are concrete, measurable capabilities. Categories group related skills. Domains represent broad areas of expertise. Possessing specific skills is evidence of working in the domain those skills belong to.

Real-world reasoning: If you have 4 years of React experience, you've spent 4 years doing frontend development—React is a frontend framework. The skill is proof of domain activity. We use MAX(years) across skills in a category as a conservative lower bound: if you have React (4y) and Vue (2y), you definitely have at least 4 years of frontend experience (they might overlap in time).

This chain allows the system to infer domain experience even when engineers haven't explicitly claimed it, making the search more useful with less data entry burden.

**Computing inferred domain years from skills:**
- Inferred years = `MAX(yearsUsed)` from all skills belonging to that domain
- This is a **safe lower bound** - the engineer definitely has at least this much experience
- Engineer can **explicitly override** with HAS_EXPERIENCE_IN to claim higher years (e.g., if skill years were successive, not overlapping)

**Example:**
- Engineer has React (4y) + Vue (2y), both BELONG_TO Frontend
- Inferred Frontend experience = 4 years (max)
- Engineer can explicitly claim Frontend = 6 years if experience was successive

### New API Schema

```typescript
// Request
{
  requiredTechnicalDomains: [
    { domain: "backend", minYears: 3 },
    { domain: "api_development", minYears: 2, preferredMinYears: 4 }
  ],
  preferredTechnicalDomains: [
    { domain: "ml", preferredMinYears: 1 }
  ],
  requiredBusinessDomains: [
    { domain: "fintech", minYears: 2 }
  ],
  preferredBusinessDomains: [
    { domain: "payments", preferredMinYears: 3 }
  ]
}
```

## What We're NOT Doing

- NOT adding proficiency levels to domains (years of experience is sufficient)
- NOT maintaining backward compatibility with old `requiredDomains`/`preferredDomains` fields (breaking change)
- NOT changing the existing skill hierarchy (CHILD_OF for skills remains unchanged)
- NOT automatically summing skill years for domain inference (use max as safe lower bound; engineer can override)

## Implementation Approach

1. Create new node types and relationships in the database schema
2. Update seed data to populate new domain structure
3. Update TypeScript types and Zod schemas
4. Refactor query builders for new domain queries
5. Update service layer to handle domain resolution with hierarchy
6. Update API tests

---

## Phase 1: Seed Data Types & Domain Definitions

### Overview
Define new types and create domain data structures in the seed files.

### Changes Required:

#### 1. Update Seed Types
**File**: `seeds/types.ts`
**Changes**: Add new domain and skill category types

```typescript
// Add new types for domains
export interface BusinessDomain {
  id: string;
  name: string;
  description?: string;
}

export interface TechnicalDomain {
  id: string;
  name: string;
  description?: string;
  isComposite?: boolean; // true for Full Stack
}

export interface TechnicalDomainHierarchy {
  childDomainId: string;
  parentDomainId: string;
}

export interface TechnicalDomainEncompasses {
  compositeDomainId: string;
  encompassedDomainId: string;
}

// New: SkillCategory as a separate node type (extracted from Skill nodes with isCategory: true)
export interface SkillCategory {
  id: string;
  name: string;
  description?: string;
}

// New: SkillCategory → TechnicalDomain mapping
export interface SkillCategoryDomainMapping {
  skillCategoryId: string;
  technicalDomainId: string;
}

export interface EngineerBusinessDomainExperience {
  id: string;
  engineerId: string;
  businessDomainId: string;
  years: number;
}

export interface EngineerTechnicalDomainExperience {
  id: string;
  engineerId: string;
  technicalDomainId: string;
  years: number;
}

// Update SkillType to remove 'domain_knowledge'
export type SkillType = 'technical' | 'behavioral';
```

#### 2. Create Domain Seed Data
**File**: `seeds/domains.ts` (new file)
**Changes**: Define business and technical domains

```typescript
import type {
  BusinessDomain,
  TechnicalDomain,
  TechnicalDomainHierarchy,
  TechnicalDomainEncompasses
} from './types.js';

export const businessDomains: BusinessDomain[] = [
  { id: 'bd_fintech', name: 'Fintech', description: 'Financial technology and services' },
  { id: 'bd_healthcare', name: 'Healthcare', description: 'Healthcare and medical technology' },
  { id: 'bd_ecommerce', name: 'E-commerce', description: 'Online retail and marketplaces' },
  { id: 'bd_saas', name: 'SaaS', description: 'Software as a Service products' },
  { id: 'bd_payments', name: 'Payments', description: 'Payment processing and infrastructure' },
  { id: 'bd_banking', name: 'Banking', description: 'Banking and financial institutions' },
  { id: 'bd_insurance', name: 'Insurance', description: 'Insurance technology' },
  { id: 'bd_gaming', name: 'Gaming', description: 'Video games and interactive entertainment' },
  { id: 'bd_edtech', name: 'EdTech', description: 'Education technology' },
  { id: 'bd_logistics', name: 'Logistics', description: 'Supply chain and logistics' },
];

export const technicalDomains: TechnicalDomain[] = [
  // Top-level domains
  { id: 'td_backend', name: 'Backend' },
  { id: 'td_frontend', name: 'Frontend' },
  { id: 'td_fullstack', name: 'Full Stack', isComposite: true },
  { id: 'td_ml', name: 'Machine Learning' },
  { id: 'td_data_engineering', name: 'Data Engineering' },
  { id: 'td_devops', name: 'DevOps' },
  { id: 'td_mobile', name: 'Mobile Development' },
  { id: 'td_security', name: 'Security' },

  // Backend sub-domains
  { id: 'td_api_dev', name: 'API Development' },
  { id: 'td_database_eng', name: 'Database Engineering' },
  { id: 'td_distributed_systems', name: 'Distributed Systems' },

  // Frontend sub-domains
  { id: 'td_react_ecosystem', name: 'React Ecosystem' },
  { id: 'td_web_performance', name: 'Web Performance' },

  // ML sub-domains
  { id: 'td_nlp', name: 'NLP' },
  { id: 'td_computer_vision', name: 'Computer Vision' },
  { id: 'td_mlops', name: 'MLOps' },

  // DevOps sub-domains
  { id: 'td_cloud', name: 'Cloud Infrastructure' },
  { id: 'td_kubernetes', name: 'Kubernetes/Containers' },
  { id: 'td_cicd', name: 'CI/CD' },
];

// CHILD_OF relationships (child implies parent)
export const technicalDomainHierarchy: TechnicalDomainHierarchy[] = [
  // Backend children
  { childDomainId: 'td_api_dev', parentDomainId: 'td_backend' },
  { childDomainId: 'td_database_eng', parentDomainId: 'td_backend' },
  { childDomainId: 'td_distributed_systems', parentDomainId: 'td_backend' },

  // Frontend children
  { childDomainId: 'td_react_ecosystem', parentDomainId: 'td_frontend' },
  { childDomainId: 'td_web_performance', parentDomainId: 'td_frontend' },

  // ML children
  { childDomainId: 'td_nlp', parentDomainId: 'td_ml' },
  { childDomainId: 'td_computer_vision', parentDomainId: 'td_ml' },
  { childDomainId: 'td_mlops', parentDomainId: 'td_ml' },

  // DevOps children
  { childDomainId: 'td_cloud', parentDomainId: 'td_devops' },
  { childDomainId: 'td_kubernetes', parentDomainId: 'td_devops' },
  { childDomainId: 'td_cicd', parentDomainId: 'td_devops' },
];

// ENCOMPASSES relationships (for composite domains, no upward inference)
export const technicalDomainEncompasses: TechnicalDomainEncompasses[] = [
  { compositeDomainId: 'td_fullstack', encompassedDomainId: 'td_backend' },
  { compositeDomainId: 'td_fullstack', encompassedDomainId: 'td_frontend' },
];
```

#### 3. Create Skill Categories Seed Data
**File**: `seeds/skill-categories.ts` (new file)
**Changes**: Define skill categories as separate nodes and their mappings

```typescript
import type { SkillCategory, SkillCategoryDomainMapping } from './types.js';

// Skill Categories (extracted from Skill nodes with isCategory: true)
export const skillCategories: SkillCategory[] = [
  { id: 'sc_frontend_frameworks', name: 'Frontend Frameworks' },
  { id: 'sc_backend_frameworks', name: 'Backend Frameworks' },
  { id: 'sc_backend_languages', name: 'Backend Languages' },
  { id: 'sc_databases', name: 'Databases' },
  { id: 'sc_cloud', name: 'Cloud Platforms' },
  { id: 'sc_containers', name: 'Containerization' },
  { id: 'sc_cicd', name: 'CI/CD' },
  { id: 'sc_testing', name: 'Testing' },
  { id: 'sc_observability', name: 'Observability' },
  { id: 'sc_security', name: 'Security' },
  { id: 'sc_design', name: 'Design & Architecture' },
  // Behavioral categories remain as SkillCategories
  { id: 'sc_leadership', name: 'Leadership' },
  { id: 'sc_communication', name: 'Communication' },
  { id: 'sc_problem_solving', name: 'Problem Solving' },
  { id: 'sc_execution', name: 'Execution & Delivery' },
  { id: 'sc_collaboration', name: 'Collaboration' },
  { id: 'sc_growth', name: 'Growth & Adaptability' },
];

// SkillCategory → TechnicalDomain mappings (only technical categories map to domains)
export const skillCategoryDomainMappings: SkillCategoryDomainMapping[] = [
  { skillCategoryId: 'sc_frontend_frameworks', technicalDomainId: 'td_frontend' },
  { skillCategoryId: 'sc_backend_frameworks', technicalDomainId: 'td_api_dev' },
  { skillCategoryId: 'sc_backend_languages', technicalDomainId: 'td_backend' },
  { skillCategoryId: 'sc_databases', technicalDomainId: 'td_database_eng' },
  { skillCategoryId: 'sc_cloud', technicalDomainId: 'td_cloud' },
  { skillCategoryId: 'sc_containers', technicalDomainId: 'td_kubernetes' },
  { skillCategoryId: 'sc_cicd', technicalDomainId: 'td_cicd' },
  { skillCategoryId: 'sc_design', technicalDomainId: 'td_backend' },
  // sc_testing, sc_observability, sc_security, and behavioral categories
  // do NOT map to technical domains
];
```

#### 4. Update Skills Seed Data
**File**: `seeds/skills.ts`
**Changes**:
- Remove `cat_domain` and all `skillType: 'domain_knowledge'` skills
- Remove role category definitions (`cat_backend`, `cat_frontend`, `cat_fullstack`)
- Remove category Skill nodes (they become SkillCategory nodes)
- Update `skillCategoryMemberships` to reference new SkillCategory IDs

```typescript
// Remove these entries from skills array:
// - { id: 'cat_domain', name: 'Domain Knowledge', skillType: 'domain_knowledge', isCategory: true }
// - { id: 'skill_ai_ml', ... skillType: 'domain_knowledge' }
// - { id: 'skill_blockchain', ... skillType: 'domain_knowledge' }
// - { id: 'skill_fintech', ... } etc.
// - { id: 'cat_backend', ... }
// - { id: 'cat_frontend', ... }
// - { id: 'cat_fullstack', ... }
// - All category Skill nodes (cat_languages, cat_databases, etc.) - now SkillCategory nodes

// Update skillCategoryMemberships to use new SkillCategory IDs
// Skills now BELONG_TO SkillCategories (can belong to multiple)
export const skillCategoryMemberships: SkillCategoryMembership[] = [
  // Frontend frameworks
  { skillId: 'skill_react', categoryId: 'sc_frontend_frameworks' },
  { skillId: 'skill_nextjs', categoryId: 'sc_frontend_frameworks' },
  { skillId: 'skill_vue', categoryId: 'sc_frontend_frameworks' },
  { skillId: 'skill_angular', categoryId: 'sc_frontend_frameworks' },

  // Backend frameworks
  { skillId: 'skill_express', categoryId: 'sc_backend_frameworks' },
  { skillId: 'skill_nestjs', categoryId: 'sc_backend_frameworks' },
  { skillId: 'skill_django', categoryId: 'sc_backend_frameworks' },
  { skillId: 'skill_fastapi', categoryId: 'sc_backend_frameworks' },
  { skillId: 'skill_spring', categoryId: 'sc_backend_frameworks' },

  // Backend languages
  { skillId: 'skill_python', categoryId: 'sc_backend_languages' },
  { skillId: 'skill_java', categoryId: 'sc_backend_languages' },
  { skillId: 'skill_go', categoryId: 'sc_backend_languages' },
  { skillId: 'skill_rust', categoryId: 'sc_backend_languages' },
  { skillId: 'skill_nodejs', categoryId: 'sc_backend_languages' },

  // JS/TS belong to BOTH frontend and backend
  { skillId: 'skill_javascript', categoryId: 'sc_frontend_frameworks' },
  { skillId: 'skill_javascript', categoryId: 'sc_backend_languages' },
  { skillId: 'skill_typescript', categoryId: 'sc_frontend_frameworks' },
  { skillId: 'skill_typescript', categoryId: 'sc_backend_languages' },

  // Databases
  { skillId: 'skill_postgresql', categoryId: 'sc_databases' },
  { skillId: 'skill_mysql', categoryId: 'sc_databases' },
  { skillId: 'skill_mongodb', categoryId: 'sc_databases' },
  { skillId: 'skill_redis', categoryId: 'sc_databases' },
  { skillId: 'skill_dynamodb', categoryId: 'sc_databases' },
  { skillId: 'skill_neo4j', categoryId: 'sc_databases' },
  { skillId: 'skill_kafka', categoryId: 'sc_databases' },

  // Cloud
  { skillId: 'skill_aws', categoryId: 'sc_cloud' },
  { skillId: 'skill_gcp', categoryId: 'sc_cloud' },
  { skillId: 'skill_azure', categoryId: 'sc_cloud' },
  { skillId: 'skill_lambda', categoryId: 'sc_cloud' },
  { skillId: 'skill_s3', categoryId: 'sc_cloud' },

  // Containers
  { skillId: 'skill_docker', categoryId: 'sc_containers' },
  { skillId: 'skill_kubernetes', categoryId: 'sc_containers' },
  { skillId: 'skill_helm', categoryId: 'sc_containers' },

  // CI/CD
  { skillId: 'skill_terraform', categoryId: 'sc_cicd' },
  { skillId: 'skill_github_actions', categoryId: 'sc_cicd' },

  // ... behavioral skills map to behavioral categories (sc_leadership, etc.)
];
```

#### 5. Update Engineer Seed Data
**File**: `seeds/engineers.ts`
**Changes**: Replace domain skills with domain experience claims

```typescript
// Add new arrays for domain experience
export const engineerBusinessDomainExperience: EngineerBusinessDomainExperience[] = [
  { id: 'ebde_priya_fintech', engineerId: 'eng_priya', businessDomainId: 'bd_fintech', years: 6 },
  { id: 'ebde_priya_payments', engineerId: 'eng_priya', businessDomainId: 'bd_payments', years: 4 },
  { id: 'ebde_emily_ecommerce', engineerId: 'eng_emily', businessDomainId: 'bd_ecommerce', years: 3 },
  { id: 'ebde_chen_saas', engineerId: 'eng_chen', businessDomainId: 'bd_saas', years: 5 },
  // ... more entries based on existing domain skills
];

export const engineerTechnicalDomainExperience: EngineerTechnicalDomainExperience[] = [
  { id: 'etde_priya_backend', engineerId: 'eng_priya', technicalDomainId: 'td_backend', years: 8 },
  { id: 'etde_priya_api', engineerId: 'eng_priya', technicalDomainId: 'td_api_dev', years: 6 },
  { id: 'etde_emily_frontend', engineerId: 'eng_emily', technicalDomainId: 'td_frontend', years: 5 },
  { id: 'etde_emily_react', engineerId: 'eng_emily', technicalDomainId: 'td_react_ecosystem', years: 4 },
  { id: 'etde_chen_fullstack', engineerId: 'eng_chen', technicalDomainId: 'td_fullstack', years: 7 },
  { id: 'etde_alex_ml', engineerId: 'eng_alex', technicalDomainId: 'td_ml', years: 4 },
  { id: 'etde_alex_nlp', engineerId: 'eng_alex', technicalDomainId: 'td_nlp', years: 3 },
  // ... more entries
];

// Remove domain-related UserSkill entries (those linking to skill_fintech, skill_healthcare, etc.)
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] Seed files export new domain arrays correctly

#### Manual Verification:
- [ ] Review domain categorization makes sense for the use cases

---

## Phase 2: Database Seeding Updates

### Overview
Update the seed.ts file to create new node types and relationships in Neo4j.

### Migration Order (Critical)
The seeding functions MUST run in this order to avoid broken relationships:

1. **cleanupOldDomainData()** - Remove old domain_knowledge skills, role categories, and Skill→Skill BELONGS_TO relationships
2. **seedBusinessDomains()** - Create BusinessDomain nodes
3. **seedTechnicalDomains()** - Create TechnicalDomain nodes
4. **seedTechnicalDomainHierarchy()** - Create CHILD_OF relationships between domains
5. **seedTechnicalDomainEncompasses()** - Create ENCOMPASSES relationships
6. **seedSkillCategories()** - Create SkillCategory nodes (MUST exist before Skill→SkillCategory relationships)
7. **seedSkillCategoryMemberships()** - Create Skill→SkillCategory BELONGS_TO relationships
8. **seedSkillCategoryDomainMappings()** - Create SkillCategory→TechnicalDomain BELONGS_TO relationships
9. **seedEngineerBusinessDomainExperience()** - Create Engineer→BusinessDomain HAS_EXPERIENCE_IN relationships
10. **seedEngineerTechnicalDomainExperience()** - Create Engineer→TechnicalDomain HAS_EXPERIENCE_IN relationships

### Changes Required:

#### 1. Update Seed Script
**File**: `seeds/seed.ts`
**Changes**: Add functions to seed new domain nodes and relationships

```typescript
import {
  businessDomains,
  technicalDomains,
  technicalDomainHierarchy,
  technicalDomainEncompasses
} from './domains.js';
import {
  skillCategories,
  skillCategoryDomainMappings
} from './skill-categories.js';
import { skillCategoryMemberships } from './skills.js';
import {
  engineerBusinessDomainExperience,
  engineerTechnicalDomainExperience
} from './engineers.js';

// Add new seeding functions:

async function seedBusinessDomains(session: Session): Promise<void> {
  console.log('Seeding business domains...');
  for (const domain of businessDomains) {
    await session.run(
      `MERGE (d:BusinessDomain {id: $id})
       ON CREATE SET d.name = $name, d.description = $description`,
      domain
    );
  }
}

async function seedTechnicalDomains(session: Session): Promise<void> {
  console.log('Seeding technical domains...');
  for (const domain of technicalDomains) {
    await session.run(
      `MERGE (d:TechnicalDomain {id: $id})
       ON CREATE SET d.name = $name, d.description = $description, d.isComposite = $isComposite`,
      { ...domain, isComposite: domain.isComposite ?? false }
    );
  }
}

async function seedTechnicalDomainHierarchy(session: Session): Promise<void> {
  console.log('Seeding technical domain hierarchy (CHILD_OF)...');
  for (const rel of technicalDomainHierarchy) {
    await session.run(
      `MATCH (child:TechnicalDomain {id: $childDomainId})
       MATCH (parent:TechnicalDomain {id: $parentDomainId})
       MERGE (child)-[:CHILD_OF]->(parent)`,
      rel
    );
  }
}

async function seedTechnicalDomainEncompasses(session: Session): Promise<void> {
  console.log('Seeding technical domain encompasses relationships...');
  for (const rel of technicalDomainEncompasses) {
    await session.run(
      `MATCH (composite:TechnicalDomain {id: $compositeDomainId})
       MATCH (encompassed:TechnicalDomain {id: $encompassedDomainId})
       MERGE (composite)-[:ENCOMPASSES]->(encompassed)`,
      rel
    );
  }
}

async function seedSkillCategories(session: Session): Promise<void> {
  console.log('Seeding skill categories...');
  for (const category of skillCategories) {
    await session.run(
      `MERGE (sc:SkillCategory {id: $id})
       ON CREATE SET sc.name = $name, sc.description = $description`,
      category
    );
  }
}

async function seedSkillCategoryMemberships(session: Session): Promise<void> {
  console.log('Seeding skill to skill category memberships...');
  for (const membership of skillCategoryMemberships) {
    await session.run(
      `MATCH (s:Skill {id: $skillId})
       MATCH (sc:SkillCategory {id: $categoryId})
       MERGE (s)-[:BELONGS_TO]->(sc)`,
      membership
    );
  }
}

async function seedSkillCategoryDomainMappings(session: Session): Promise<void> {
  console.log('Seeding skill category to technical domain mappings...');
  for (const mapping of skillCategoryDomainMappings) {
    await session.run(
      `MATCH (sc:SkillCategory {id: $skillCategoryId})
       MATCH (td:TechnicalDomain {id: $technicalDomainId})
       MERGE (sc)-[:BELONGS_TO]->(td)`,
      mapping
    );
  }
}

async function seedEngineerBusinessDomainExperience(session: Session): Promise<void> {
  console.log('Seeding engineer business domain experience...');
  for (const exp of engineerBusinessDomainExperience) {
    await session.run(
      `MATCH (e:Engineer {id: $engineerId})
       MATCH (d:BusinessDomain {id: $businessDomainId})
       MERGE (e)-[r:HAS_EXPERIENCE_IN]->(d)
       ON CREATE SET r.years = $years`,
      exp
    );
  }
}

async function seedEngineerTechnicalDomainExperience(session: Session): Promise<void> {
  console.log('Seeding engineer technical domain experience...');
  for (const exp of engineerTechnicalDomainExperience) {
    await session.run(
      `MATCH (e:Engineer {id: $engineerId})
       MATCH (d:TechnicalDomain {id: $technicalDomainId})
       MERGE (e)-[r:HAS_EXPERIENCE_IN]->(d)
       ON CREATE SET r.years = $years`,
      exp
    );
  }
}

// Update main seed function to call new functions
async function seed(): Promise<void> {
  // ... existing setup ...

  // Add after existing skill seeding:
  await seedBusinessDomains(session);
  await seedTechnicalDomains(session);
  await seedTechnicalDomainHierarchy(session);
  await seedTechnicalDomainEncompasses(session);
  await seedSkillCategories(session);
  await seedSkillCategoryMemberships(session);
  await seedSkillCategoryDomainMappings(session);
  await seedEngineerBusinessDomainExperience(session);
  await seedEngineerTechnicalDomainExperience(session);

  // Remove old domain skill seeding (cat_domain children, domain UserSkills)
}

// Add cleanup function for old domain data
async function cleanupOldDomainData(session: Session): Promise<void> {
  console.log('Cleaning up old domain_knowledge skills...');

  // Remove UserSkill nodes for domain_knowledge skills
  await session.run(`
    MATCH (us:UserSkill)-[:FOR]->(s:Skill {skillType: 'domain_knowledge'})
    DETACH DELETE us
  `);

  // Remove domain_knowledge skills
  await session.run(`
    MATCH (s:Skill {skillType: 'domain_knowledge'})
    DETACH DELETE s
  `);

  // Remove role-based categories (cat_backend, cat_frontend, cat_fullstack)
  // These are replaced by TechnicalDomain nodes
  await session.run(`
    MATCH (s:Skill)
    WHERE s.id IN ['cat_backend', 'cat_frontend', 'cat_fullstack']
    DETACH DELETE s
  `);

  // Remove old BELONGS_TO relationships from skills to category Skill nodes
  // These will be replaced by Skill → SkillCategory BELONGS_TO relationships
  console.log('Cleaning up old Skill→Skill category BELONGS_TO relationships...');
  await session.run(`
    MATCH (skill:Skill)-[r:BELONGS_TO]->(cat:Skill {isCategory: true})
    DELETE r
  `);

  // Remove old category Skill nodes (cat_languages, cat_databases, etc.)
  // These become SkillCategory nodes
  console.log('Removing old category Skill nodes (now SkillCategory nodes)...');
  await session.run(`
    MATCH (s:Skill {isCategory: true})
    WHERE NOT s.id IN ['cat_technical', 'cat_behavioral', 'cat_domain']
    DETACH DELETE s
  `);

  // Remove top-level category nodes
  await session.run(`
    MATCH (s:Skill)
    WHERE s.id IN ['cat_technical', 'cat_behavioral', 'cat_domain']
    DETACH DELETE s
  `);
}
```

### Success Criteria:

#### Automated Verification:
- [x] Seed script runs without errors: `npx tsx seeds/seed.ts`
- [x] Neo4j contains BusinessDomain nodes: verify in Neo4j browser
- [x] Neo4j contains TechnicalDomain nodes with CHILD_OF and ENCOMPASSES relationships
- [x] Engineers have HAS_EXPERIENCE_IN relationships to domains

#### Manual Verification:
- [x] Query Neo4j to verify domain hierarchy: `MATCH (c:TechnicalDomain)-[:CHILD_OF]->(p:TechnicalDomain) RETURN c, p`
- [x] Verify Full Stack encompasses Backend and Frontend

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the database structure is correct before proceeding to the next phase.

---

## Phase 3: API Types & Schemas

### Overview
Update TypeScript types and Zod schemas to support the new domain model with years of experience.

### Changes Required:

#### 1. Update Search Schema
**File**: `recommender_api/src/schemas/search.schema.ts`
**Changes**: Replace old domain fields with new structured domain requirements

```typescript
// Add new domain requirement schemas
const BusinessDomainRequirementSchema = z.object({
  domain: z.string(),
  minYears: z.number().int().min(0).optional(),
  preferredMinYears: z.number().int().min(0).optional(),
});

const TechnicalDomainRequirementSchema = z.object({
  domain: z.string(),
  minYears: z.number().int().min(0).optional(),
  preferredMinYears: z.number().int().min(0).optional(),
});

// Update SearchFilterRequestSchema - REMOVE old fields:
// - requiredDomains: z.array(z.string()).optional(),
// - preferredDomains: z.array(z.string()).optional(),

// ADD new fields:
const SearchFilterRequestSchema = z.object({
  // ... existing fields ...

  // New domain fields
  requiredBusinessDomains: z.array(BusinessDomainRequirementSchema).optional(),
  preferredBusinessDomains: z.array(BusinessDomainRequirementSchema).optional(),
  requiredTechnicalDomains: z.array(TechnicalDomainRequirementSchema).optional(),
  preferredTechnicalDomains: z.array(TechnicalDomainRequirementSchema).optional(),
});

// Export new types
export type BusinessDomainRequirement = z.infer<typeof BusinessDomainRequirementSchema>;
export type TechnicalDomainRequirement = z.infer<typeof TechnicalDomainRequirementSchema>;
```

#### 2. Update Search Types
**File**: `recommender_api/src/types/search.types.ts`
**Changes**: Update response types for domain matches

```typescript
// Update imports
export type {
  BusinessDomainRequirement,
  TechnicalDomainRequirement,
  // ... other exports
} from '../schemas/search.schema.js';

// Add new interfaces for domain matches in response
export interface BusinessDomainMatch {
  domainId: string;
  domainName: string;
  engineerYears: number;
  meetsRequired: boolean;
  meetsPreferred: boolean;
}

export interface TechnicalDomainMatch {
  domainId: string;
  domainName: string;
  engineerYears: number;
  matchType: 'direct' | 'child_implies_parent' | 'encompasses';
  meetsRequired: boolean;
  meetsPreferred: boolean;
}

// Update EngineerMatch interface
export interface EngineerMatch {
  // ... existing fields ...

  // Replace matchedDomains: string[] with:
  matchedBusinessDomains: BusinessDomainMatch[];
  matchedTechnicalDomains: TechnicalDomainMatch[];
}

// Update score breakdown
export interface PreferredDomainMatch {
  businessDomainScore: number;
  technicalDomainScore: number;
  matchedBusinessDomains: string[];
  matchedTechnicalDomains: string[];
}
```

#### 3. Update Query Types
**File**: `recommender_api/src/services/cypher-query-builder/query-types.ts`
**Changes**: Update query parameter types

```typescript
// Replace old domain params with new structure
export interface ResolvedBusinessDomain {
  domainId: string;
  minYears?: number;
  preferredMinYears?: number;
}

export interface ResolvedTechnicalDomain {
  domainId: string;
  expandedDomainIds: string[]; // includes self + ancestors (for CHILD_OF) or children (for ENCOMPASSES)
  minYears?: number;
  preferredMinYears?: number;
}

export interface CypherQueryParams {
  // ... existing fields ...

  // Replace:
  // requiredDomainSkillIds?: string[];
  // preferredDomainSkillIds?: string[];

  // With structured domain data (for service layer):
  requiredBusinessDomains?: ResolvedBusinessDomain[];
  preferredBusinessDomains?: ResolvedBusinessDomain[];
  requiredTechnicalDomains?: ResolvedTechnicalDomain[];
  preferredTechnicalDomains?: ResolvedTechnicalDomain[];

  // Flattened arrays for Neo4j query parameters (derived from above):
  // Neo4j doesn't support nested object access, so the query builder
  // must flatten these before passing to the query.
  requiredBusinessDomainIds?: string[];
  requiredBusinessMinYears?: (number | null)[];
  requiredTechDomainExpandedIds?: string[][];  // Array of arrays
  requiredTechDomainMinYears?: (number | null)[];
  preferredBusinessDomainIds?: string[];
  preferredTechDomainIds?: string[];
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] No type errors in dependent files

#### Manual Verification:
- [ ] Review type definitions match the desired API contract

---

## Phase 4: Domain Resolver Service

### Overview
Create a new service to resolve domain identifiers and handle technical domain hierarchy.

### Integration Note
This service follows the same patterns as `skill-resolver.service.ts`:
- Resolve identifiers (names or IDs) to database IDs
- Handle hierarchy expansion (skills have CHILD_OF, domains have CHILD_OF and ENCOMPASSES)
- Return resolved data with expansion info

However, it's kept separate because:
1. Different node types (BusinessDomain, TechnicalDomain vs Skill)
2. Different relationship semantics (ENCOMPASSES is unique to domains)
3. Domain resolution includes years requirements (skills have proficiency)

Consider extracting common patterns (identifier resolution, hierarchy traversal) to shared utilities if the code becomes repetitive.

### Changes Required:

#### 1. Create Domain Resolver Service
**File**: `recommender_api/src/services/domain-resolver.service.ts` (new file)
**Changes**: Implement domain resolution with hierarchy handling

```typescript
import { Session } from 'neo4j-driver';
import type {
  BusinessDomainRequirement,
  TechnicalDomainRequirement
} from '../schemas/search.schema.js';
import type {
  ResolvedBusinessDomain,
  ResolvedTechnicalDomain
} from './cypher-query-builder/query-types.js';

/**
 * Resolves business domain identifiers (names or IDs) to domain IDs.
 * Business domains are flat - no hierarchy expansion needed.
 */
export async function resolveBusinessDomains(
  session: Session,
  requirements: BusinessDomainRequirement[] | undefined
): Promise<ResolvedBusinessDomain[]> {
  if (!requirements || requirements.length === 0) {
    return [];
  }

  const identifiers = requirements.map(r => r.domain);

  const result = await session.run(
    `MATCH (d:BusinessDomain)
     WHERE d.id IN $identifiers OR d.name IN $identifiers
     RETURN d.id AS domainId, d.name AS name`,
    { identifiers }
  );

  const domainMap = new Map<string, string>();
  for (const record of result.records) {
    const id = record.get('domainId') as string;
    const name = record.get('name') as string;
    domainMap.set(id, id);
    domainMap.set(name.toLowerCase(), id);
  }

  return requirements
    .map(req => {
      const domainId = domainMap.get(req.domain) || domainMap.get(req.domain.toLowerCase());
      if (!domainId) return null;
      return {
        domainId,
        minYears: req.minYears,
        preferredMinYears: req.preferredMinYears,
      };
    })
    .filter((d): d is ResolvedBusinessDomain => d !== null);
}

/**
 * Resolves technical domain identifiers with hierarchy expansion.
 *
 * For CHILD_OF: If user requests "Backend", expands to include Backend + all children
 * (API Development, Database Engineering, etc.) so engineers with child experience match.
 *
 * For ENCOMPASSES: If user requests "Full Stack", expands to Backend + Frontend
 * so engineers with Full Stack show they have both.
 */
export async function resolveTechnicalDomains(
  session: Session,
  requirements: TechnicalDomainRequirement[] | undefined
): Promise<ResolvedTechnicalDomain[]> {
  if (!requirements || requirements.length === 0) {
    return [];
  }

  const resolved: ResolvedTechnicalDomain[] = [];

  for (const req of requirements) {
    // Find the domain by ID or name
    const domainResult = await session.run(
      `MATCH (d:TechnicalDomain)
       WHERE d.id = $identifier OR d.name = $identifier
       RETURN d.id AS domainId, d.isComposite AS isComposite`,
      { identifier: req.domain }
    );

    if (domainResult.records.length === 0) continue;

    const domainId = domainResult.records[0].get('domainId') as string;
    const isComposite = domainResult.records[0].get('isComposite') as boolean;

    let expandedDomainIds: string[];

    if (isComposite) {
      // For composite domains (Full Stack), get encompassed domains
      const encompassedResult = await session.run(
        `MATCH (composite:TechnicalDomain {id: $domainId})-[:ENCOMPASSES]->(encompassed:TechnicalDomain)
         RETURN encompassed.id AS encompassedId`,
        { domainId }
      );
      expandedDomainIds = [
        domainId,
        ...encompassedResult.records.map(r => r.get('encompassedId') as string)
      ];
    } else {
      // For regular domains, get self + all descendants (CHILD_OF)
      const descendantsResult = await session.run(
        `MATCH (d:TechnicalDomain {id: $domainId})
         OPTIONAL MATCH (child:TechnicalDomain)-[:CHILD_OF*1..]->(d)
         RETURN d.id AS selfId, COLLECT(DISTINCT child.id) AS childIds`,
        { domainId }
      );
      const record = descendantsResult.records[0];
      const childIds = (record.get('childIds') as string[]).filter(id => id !== null);
      expandedDomainIds = [domainId, ...childIds];
    }

    resolved.push({
      domainId,
      expandedDomainIds,
      minYears: req.minYears,
      preferredMinYears: req.preferredMinYears,
    });
  }

  return resolved;
}
```

**Note on Skill→SkillCategory→Domain Inference:**

The domain resolver prepares the query parameters, but the actual inference of domain experience from skills happens in the **Cypher query** (Phase 5). The query will check:

1. **Explicit claims**: `(e)-[:HAS_EXPERIENCE_IN {years}]->(td:TechnicalDomain)`
2. **Inferred from skills via SkillCategory**: `(e)-[:HAS]->(:UserSkill)-[:FOR]->(s:Skill)-[:BELONGS_TO]->(:SkillCategory)-[:BELONGS_TO]->(td:TechnicalDomain)`

For inferred experience, years = `MAX(us.yearsUsed)` from skills in categories that map to that domain.

If both exist, explicit claim takes precedence.

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] Unit tests for domain resolution (create new test file)

#### Manual Verification:
- [ ] Test hierarchy expansion in Neo4j browser

---

## Phase 5: Query Builder Updates

### Overview
Refactor the Cypher query builders to use new domain node types and relationships.

### Changes Required:

#### 1. Rewrite Domain Filter Builder
**File**: `recommender_api/src/services/cypher-query-builder/query-domain-filter.builder.ts`
**Changes**: Complete rewrite for new domain model

```typescript
import type {
  ResolvedBusinessDomain,
  ResolvedTechnicalDomain,
  CypherQueryParams
} from './query-types.js';

export interface DomainFilterContext {
  hasRequiredBusinessDomains: boolean;
  hasPreferredBusinessDomains: boolean;
  hasRequiredTechnicalDomains: boolean;
  hasPreferredTechnicalDomains: boolean;
}

export function getDomainFilterContext(params: CypherQueryParams): DomainFilterContext {
  return {
    hasRequiredBusinessDomains: (params.requiredBusinessDomains?.length ?? 0) > 0,
    hasPreferredBusinessDomains: (params.preferredBusinessDomains?.length ?? 0) > 0,
    hasRequiredTechnicalDomains: (params.requiredTechnicalDomains?.length ?? 0) > 0,
    hasPreferredTechnicalDomains: (params.preferredTechnicalDomains?.length ?? 0) > 0,
  };
}

/**
 * Builds required business domain filter.
 * Engineer must have experience in ALL required business domains with >= minYears.
 *
 * Implementation note: Neo4j doesn't support array indexing syntax like $arr[0].field.
 * Instead, we pass separate arrays for domainIds and minYears, then use list comprehension
 * or UNWIND to check conditions.
 */
export function buildRequiredBusinessDomainFilter(
  params: CypherQueryParams
): string {
  if (!params.requiredBusinessDomains?.length) return '';

  // Pass domain requirements as separate flat arrays for Neo4j compatibility
  // The service layer will prepare: requiredBusinessDomainIds, requiredBusinessMinYears
  return `
WITH e
WHERE ALL(idx IN range(0, size($requiredBusinessDomainIds) - 1) WHERE
  EXISTS {
    MATCH (e)-[exp:HAS_EXPERIENCE_IN]->(bd:BusinessDomain)
    WHERE bd.id = $requiredBusinessDomainIds[idx]
    AND (
      $requiredBusinessMinYears[idx] IS NULL
      OR exp.years >= $requiredBusinessMinYears[idx]
    )
  }
)`;
}

/**
 * Builds required technical domain filter with hierarchy support AND skill inference.
 *
 * An engineer matches a required technical domain if:
 * 1. They have explicit HAS_EXPERIENCE_IN with sufficient years, OR
 * 2. They have skills via SkillCategory chain with sufficient years
 *
 * Uses expandedDomainIds which includes the domain + descendants/encompassed.
 *
 * Implementation note: Neo4j doesn't support nested object access like $arr[0].field.
 * The service layer must flatten the data into parallel arrays:
 * - requiredTechDomainExpandedIds: string[][] (array of expanded ID arrays per requirement)
 * - requiredTechDomainMinYears: (number | null)[] (minYears per requirement)
 */
export function buildRequiredTechnicalDomainFilter(
  params: CypherQueryParams
): string {
  if (!params.requiredTechnicalDomains?.length) return '';

  // For each required technical domain, check engineer has experience via:
  // - Explicit HAS_EXPERIENCE_IN claim, OR
  // - Inferred from skills via SkillCategory chain
  return `
WITH e
WHERE ALL(idx IN range(0, size($requiredTechDomainExpandedIds) - 1) WHERE
  (
    // Option 1: Explicit domain experience claim
    EXISTS {
      MATCH (e)-[exp:HAS_EXPERIENCE_IN]->(td:TechnicalDomain)
      WHERE td.id IN $requiredTechDomainExpandedIds[idx]
      AND (
        $requiredTechDomainMinYears[idx] IS NULL
        OR exp.years >= $requiredTechDomainMinYears[idx]
      )
    }
    OR
    // Option 2: Inferred from skills via SkillCategory → TechnicalDomain
    EXISTS {
      MATCH (e)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)-[:BELONGS_TO]->(:SkillCategory)-[:BELONGS_TO]->(td:TechnicalDomain)
      WHERE td.id IN $requiredTechDomainExpandedIds[idx]
      AND (
        $requiredTechDomainMinYears[idx] IS NULL
        OR us.yearsUsed >= $requiredTechDomainMinYears[idx]
      )
    }
  )
)`;
}

/**
 * Collects matched business domains for scoring.
 */
export function buildBusinessDomainCollection(
  params: CypherQueryParams,
  carryoverFields: string[]
): string {
  const hasPreferred = (params.preferredBusinessDomains?.length ?? 0) > 0;
  if (!hasPreferred) return '';

  const carryover = carryoverFields.join(', ');

  return `
    OPTIONAL MATCH (e)-[bdExp:HAS_EXPERIENCE_IN]->(bd:BusinessDomain)
    WHERE bd.id IN [x IN $preferredBusinessDomains | x.domainId]
    WITH e, ${carryover},
         COLLECT(DISTINCT {
           domainId: bd.id,
           domainName: bd.name,
           years: bdExp.years
         }) AS matchedBusinessDomains
  `;
}

/**
 * Collects matched technical domains for scoring.
 * Includes both explicit claims AND skill-inferred experience via SkillCategory.
 *
 * For each matched domain, computes effective years as:
 * - Explicit claim years (if exists), OR
 * - MAX(yearsUsed) from skills in categories that map to that domain (inferred)
 */
export function buildTechnicalDomainCollection(
  params: CypherQueryParams,
  carryoverFields: string[]
): string {
  const hasPreferred = (params.preferredTechnicalDomains?.length ?? 0) > 0;
  if (!hasPreferred) return '';

  const carryover = carryoverFields.join(', ');

  // Collect both explicit claims and skill-inferred domain experience
  // Use COALESCE to prefer explicit years over inferred
  return `
    // Collect explicit domain claims
    OPTIONAL MATCH (e)-[explicitExp:HAS_EXPERIENCE_IN]->(td:TechnicalDomain)
    WHERE td.id IN [x IN $preferredTechnicalDomains | x.domainId]
    WITH e, ${carryover},
         COLLECT(DISTINCT {
           domainId: td.id,
           domainName: td.name,
           years: explicitExp.years,
           source: 'explicit'
         }) AS explicitDomains

    // Collect skill-inferred domain experience via SkillCategory → TechnicalDomain
    OPTIONAL MATCH (e)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)-[:BELONGS_TO]->(:SkillCategory)-[:BELONGS_TO]->(td:TechnicalDomain)
    WHERE td.id IN [x IN $preferredTechnicalDomains | x.domainId]
    WITH e, ${carryover}, explicitDomains,
         td.id AS inferredDomainId,
         td.name AS inferredDomainName,
         MAX(us.yearsUsed) AS inferredYears
    WITH e, ${carryover}, explicitDomains,
         COLLECT(DISTINCT CASE WHEN inferredDomainId IS NOT NULL THEN {
           domainId: inferredDomainId,
           domainName: inferredDomainName,
           years: inferredYears,
           source: 'inferred'
         } END) AS inferredDomains

    // Merge: explicit claims take precedence over inferred
    WITH e, ${carryover},
         [d IN explicitDomains | d] +
         [d IN inferredDomains WHERE d IS NOT NULL AND NOT d.domainId IN [x IN explicitDomains | x.domainId] | d]
         AS matchedTechnicalDomains
  `;
}
```

#### 2. Update Search Query Builder
**File**: `recommender_api/src/services/cypher-query-builder/search-query.builder.ts`
**Changes**: Integrate new domain filter functions

```typescript
// Update imports
import {
  getDomainFilterContext,
  buildRequiredBusinessDomainFilter,
  buildRequiredTechnicalDomainFilter,
  buildBusinessDomainCollection,
  buildTechnicalDomainCollection,
} from './query-domain-filter.builder.js';

// Update buildSearchQuery function to use new domain functions
// Add domain filter clauses after skill filtering
// Add domain collection clauses before RETURN
// Update RETURN to include matchedBusinessDomains, matchedTechnicalDomains
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] Generated Cypher queries are valid (test with Neo4j)

#### Manual Verification:
- [ ] Test queries with various domain combinations in Neo4j browser

---

## Phase 6: Service Layer Updates

### Overview
Update the search service and utility calculator to use the new domain model.

### Changes Required:

#### 1. Update Search Service
**File**: `recommender_api/src/services/search.service.ts`
**Changes**: Use new domain resolver and update result parsing

```typescript
// Update imports
import {
  resolveBusinessDomains,
  resolveTechnicalDomains
} from './domain-resolver.service.js';

// In searchEngineers function:
// Replace:
// const requiredDomainSkillIds = await getSkillIdsForDomains(session, request.requiredDomains);
// const preferredDomainSkillIds = await getSkillIdsForDomains(session, request.preferredDomains);

// With:
const requiredBusinessDomains = await resolveBusinessDomains(session, request.requiredBusinessDomains);
const preferredBusinessDomains = await resolveBusinessDomains(session, request.preferredBusinessDomains);
const requiredTechnicalDomains = await resolveTechnicalDomains(session, request.requiredTechnicalDomains);
const preferredTechnicalDomains = await resolveTechnicalDomains(session, request.preferredTechnicalDomains);

// Update query params
const queryParams: CypherQueryParams = {
  // ... existing params ...
  requiredBusinessDomains,
  preferredBusinessDomains,
  requiredTechnicalDomains,
  preferredTechnicalDomains,
};

// Update parseEngineerFromRecord to extract new domain fields:
// matchedBusinessDomains: record.get('matchedBusinessDomains')
// matchedTechnicalDomains: record.get('matchedTechnicalDomains')

// Remove getSkillIdsForDomains function (no longer needed)
```

#### 2. Update Utility Calculator
**File**: `recommender_api/src/services/utility-calculator.service.ts`
**Changes**: Update domain scoring for new structure

```typescript
// Update scoring functions to handle new domain structure
// Replace single preferredDomainMatch with separate business/technical scores

function calculateBusinessDomainScore(
  matchedDomains: BusinessDomainMatch[],
  preferredDomains: ResolvedBusinessDomain[],
  maxScore: number
): { score: number; matchedNames: string[] } {
  // Score based on matched domains and whether years requirement met
}

function calculateTechnicalDomainScore(
  matchedDomains: TechnicalDomainMatch[],
  preferredDomains: ResolvedTechnicalDomain[],
  maxScore: number
): { score: number; matchedNames: string[] } {
  // Score based on matched domains with hierarchy consideration
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] API returns correct response structure

#### Manual Verification:
- [ ] Test API with domain filters via Postman

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the API works correctly before proceeding to testing phase.

---

## Phase 7: API Testing

### Overview
Update Postman collection and run comprehensive tests.

### Changes Required:

#### 1. Update Postman Collection
**File**: `postman/collections/search-filter-tests.postman_collection.json`
**Changes**:
- Update existing domain tests to use new schema
- Add tests for business domain filtering with years
- Add tests for technical domain filtering with hierarchy
- Add tests for Full Stack encompasses behavior

### Success Criteria:

#### Automated Verification:
- [ ] Newman tests pass: `npx newman run postman/collections/search-filter-tests.postman_collection.json --globals postman/globals/workspace.postman_globals.json`

#### Manual Verification:
- [ ] Verify domain hierarchy behavior works as expected
- [ ] Verify years filtering works correctly
- [ ] Verify Full Stack encompasses Backend + Frontend

---

## Testing Strategy

### Unit Tests:
- Domain resolver service: test hierarchy expansion
- Query builder: test generated Cypher syntax (including Skill → SkillCategory → TechnicalDomain paths)
- Utility calculator: test domain scoring

### Integration Tests:
- End-to-end search with business domains
- End-to-end search with technical domains and hierarchy
- Combined business + technical domain filters
- Skill → SkillCategory → TechnicalDomain inference tests

### Manual Testing Steps:
1. Search for engineers with "Backend" domain - should match engineers with Backend, API Development, Database Engineering experience
2. Search for engineers with "Full Stack" domain - should match engineers with Full Stack OR (Backend AND Frontend)
3. Search with minYears requirement - verify years filtering works
4. Search with preferredMinYears - verify scoring boost works
5. **Skill→Category→Domain inference test**: Engineer with React skill (4 years) should match "Frontend, minYears: 3" (React → sc_frontend_frameworks → td_frontend)
6. **Explicit override test**: Engineer with React (4y) + explicit Frontend claim (6y) should show 6 years (explicit takes precedence)
7. **Hierarchy + inference test**: Engineer with Express skill (3y) should match "Backend, minYears: 2" (Express → sc_backend_frameworks → td_api_dev → td_backend chain)
8. **Multi-category skill test**: Engineer with JavaScript skill (5y) should match BOTH "Frontend" AND "Backend" domains (JS belongs to both sc_frontend_frameworks and sc_backend_languages)

## Migration Notes

This is a **breaking change**. The old API fields are removed:
- `requiredDomains: string[]` → `requiredBusinessDomains` + `requiredTechnicalDomains`
- `preferredDomains: string[]` → `preferredBusinessDomains` + `preferredTechnicalDomains`

Database migration:
1. Run `cleanupOldDomainData()` to remove old domain_knowledge skills and role-based categories
2. Run new seeding functions to create:
   - BusinessDomain and TechnicalDomain nodes
   - SkillCategory nodes (extracted from old Skill nodes with isCategory: true)
   - Skill → SkillCategory BELONGS_TO relationships
   - SkillCategory → TechnicalDomain BELONGS_TO relationships
3. Create HAS_EXPERIENCE_IN relationships for engineers

## References

- Conversation context: Domain model redesign discussion
- Current implementation: `seeds/skills.ts:152-160` (domain_knowledge skills)
- Current query builder: `recommender_api/src/services/cypher-query-builder/query-domain-filter.builder.ts`
