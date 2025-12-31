---
date: 2025-12-30T00:00:00Z
researcher: Claude
git_commit: b6b1edb94f77d829c34979fb13dfccd22584dd5e
branch: main
repository: recommender_system
topic: "Data Model Analysis - Talent Marketplace Knowledge Graph"
tags: [research, codebase, neo4j, data-model, knowledge-graph, recommender-system]
status: complete
last_updated: 2025-12-30
last_updated_by: Claude
---

# Research: Data Model Analysis - Talent Marketplace Knowledge Graph

**Date**: 2025-12-30
**Researcher**: Claude
**Git Commit**: b6b1edb94f77d829c34979fb13dfccd22584dd5e
**Branch**: main
**Repository**: recommender_system

## Research Question

Understand the data model from the `/seeds` directory for the talent marketplace recommender system.

## Summary

This is a **Neo4j-based knowledge graph** for an engineering talent marketplace, implementing concepts from Chapter 5 (Knowledge-Based Recommender Systems) of "Recommender Systems: The Textbook" by Charu Aggarwal. The data model is designed to match engineers with opportunities based on verified skills with multiple evidence types.

### Key Design Principles
1. **Evidence-Based Skill Validation**: Skills are not self-reported; they're backed by concrete evidence (stories, assessments, certifications)
2. **Hierarchical Skill Taxonomy**: Skills are organized in parent-child relationships enabling semantic search
3. **Skill Correlations**: Related skills are connected with strength/type metadata for inference
4. **Multi-Dimensional Proficiency**: Skills tracked by proficiency level, years used, and confidence score

## Detailed Findings

### Core Entity Types

#### 1. Skill (`seeds/types.ts:12-18`, `seeds/skills.ts`)
The foundational entity of the knowledge graph.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (e.g., `skill_typescript`) |
| `name` | string | Display name |
| `skillType` | `'technical' \| 'behavioral' \| 'domain_knowledge'` | Classification |
| `isCategory` | boolean | Whether it's a category node or leaf skill |
| `description` | string (optional) | Detailed description |

**Taxonomy Structure** (155 skills total):
- **Technical** (root: `cat_technical`)
  - Languages & Frameworks (JavaScript, TypeScript, React, Node.js, Python, Java, Go, Rust, etc.)
  - Databases & Data (PostgreSQL, MongoDB, Redis, Neo4j, Kafka, etc.)
  - Infrastructure & DevOps (AWS, Kubernetes, Docker, Terraform, etc.)
  - Design & Architecture (System Design, Microservices, API Design, etc.)
  - Engineering Practices (Testing, Observability, Security)
- **Behavioral** (root: `cat_behavioral`)
  - Leadership, Communication, Problem Solving, Execution, Collaboration, Growth
- **Domain Knowledge** (root: `cat_domain`)
  - Fintech, Healthcare, E-commerce, SaaS, Marketplaces, AI/ML, Blockchain

#### 2. Engineer (`seeds/types.ts:36-46`, `seeds/engineers.ts`)
Represents software engineers in the marketplace.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `name` | string | Full name |
| `email` | string | Contact email |
| `headline` | string | Professional headline |
| `hourlyRate` | number | Rate in USD |
| `yearsExperience` | number | Total experience |
| `availability` | `'immediate' \| 'two_weeks' \| 'one_month' \| 'not_available'` | When they can start |
| `timezone` | string | IANA timezone |
| `createdAt` | string | ISO timestamp |

**Sample Engineers** (5 total):
- Priya Sharma - Senior Backend, Fintech ($145/hr, 8 yrs)
- Marcus Chen - Full Stack, React/Node ($125/hr, 5 yrs)
- Sofia Rodriguez - Platform, Kubernetes/AWS ($160/hr, 7 yrs)
- James Okonkwo - Staff, Distributed Systems ($185/hr, 12 yrs)
- Emily Nakamura - Frontend, React/Design Systems ($115/hr, 4 yrs)

#### 3. EngineerSkill (`seeds/types.ts:48-56`, `seeds/engineers.ts:86-151`)
Junction entity connecting Engineers to Skills with proficiency metadata.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `engineerId` | string | FK to Engineer |
| `skillId` | string | FK to Skill |
| `proficiencyLevel` | `'learning' \| 'proficient' \| 'expert'` | Skill level |
| `yearsUsed` | number | Years using this skill |
| `confidenceScore` | number | 0-1, system's confidence in this skill |
| `lastValidated` | string | When evidence was last validated |

#### 4. EngineeringManager (`seeds/types.ts:62-69`)
Hiring managers who search for talent.

### Evidence Types

The system uses three types of evidence to validate skills:

#### 1. InterviewStory (`seeds/types.ts:75-87`, `seeds/stories.ts`)
STAR-format (Situation, Task, Action, Result) stories from AI-conducted interviews.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `engineerId` | string | FK to Engineer |
| `interviewId` | string | Session reference |
| `questionPrompt` | string | The interview question |
| `situation` | string | STAR - Situation |
| `task` | string | STAR - Task |
| `action` | string | STAR - Action |
| `result` | string | STAR - Result |
| `durationSeconds` | number | Time spent |

#### 2. StoryAnalysis (`seeds/types.ts:89-100`, `seeds/stories.ts:121-218`)
AI analysis of story quality using Claude models.

| Field | Type | Description |
|-------|------|-------------|
| `clarityScore` | number | 0-1, how clear the story is |
| `impactScore` | number | 0-1, demonstrated impact |
| `ownershipScore` | number | 0-1, demonstrated ownership |
| `overallScore` | number | 0-1, combined score |
| `reasoning` | string | AI's reasoning |
| `flags` | string[] | Any red flags |

#### 3. Assessment & Related Entities (`seeds/assessments.ts`)

**Assessment** - Reusable assessment templates:
- Backend Engineering (90min, coding challenge)
- Frontend Engineering (60min, coding challenge)
- System Design (45min, design exercise)
- Platform Engineering (75min, coding challenge)

**AssessmentQuestion** - Individual questions with:
- `maxScore`, `evaluationCriteria`
- Linked to skills via `TESTS` relationship with weights

**QuestionPerformance** - Engineer's performance on questions:
- `score`, `technicalDepth` (`'surface' | 'working' | 'deep' | 'expert'`)
- `feedback` from evaluator

#### 4. Certification (`seeds/assessments.ts:388-434`)
External certifications with verification.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Certification name |
| `issuingOrg` | string | e.g., "Amazon Web Services" |
| `issueDate` | string | When issued |
| `expiryDate` | string | Expiration (optional) |
| `verificationUrl` | string | Verification link |
| `verified` | boolean | Whether verified |

**Available Certifications**:
- AWS Solutions Architect Associate/Professional
- CKA (Certified Kubernetes Administrator)
- CKAD (Certified Kubernetes Application Developer)
- HashiCorp Terraform Associate

### Relationship Types (Neo4j)

```
(:Engineer)-[:HAS]->(:EngineerSkill)-[:FOR]->(:Skill)
(:Skill)-[:CHILD_OF]->(:Skill)
(:Skill)-[:CORRELATES_WITH {strength, correlationType}]->(:Skill)
(:EngineerSkill)-[:EVIDENCED_BY {relevanceScore, isPrimary}]->(:Evidence)
(:InterviewStory)-[:DEMONSTRATES {strength}]->(:Skill)
(:InterviewStory)-[:ANALYZED_BY]->(:StoryAnalysis)
(:AssessmentQuestion)-[:TESTS {weight}]->(:Skill)
(:Engineer)-[:ATTEMPTED]->(:AssessmentAttempt)-[:OF]->(:Assessment)
(:AssessmentAttempt)-[:INCLUDES]->(:QuestionPerformance)-[:FOR_QUESTION]->(:AssessmentQuestion)
(:Certification)-[:VALIDATES]->(:Skill)
(:Engineer)-[:HOLDS]->(:Certification)
(:Engineer)-[:TOLD]->(:InterviewStory)
(:Assessment)-[:CONTAINS]->(:AssessmentQuestion)
```

### Skill Correlations (`seeds/skills.ts:310-383`)

Three types of correlations between skills:

| Type | Description | Example |
|------|-------------|---------|
| `complementary` | Skills that work well together | Kubernetes + Docker (0.9) |
| `transferable` | Skills that indicate ability in another | TypeScript -> JavaScript (0.95) |
| `co_occurring` | Skills commonly found together | React + TypeScript (0.75) |

**73 correlations defined**, including cross-type correlations (Technical <-> Behavioral):
- `skill_tech_leadership` <-> `skill_system_design` (0.75, complementary)
- `skill_system_design` <-> `skill_tradeoffs` (0.8, complementary)

### Skill Evidence Linking (`seeds/assessments.ts:471-507`)

The `SkillEvidence` entity links `EngineerSkill` records to their evidence:

| Field | Type | Description |
|-------|------|-------------|
| `engineerSkillId` | string | FK to EngineerSkill |
| `evidenceId` | string | FK to Story/Performance/Certification |
| `evidenceType` | `'story' \| 'performance' \| 'certification'` | Evidence type |
| `relevanceScore` | number | 0-1, how relevant this evidence is |
| `isPrimary` | boolean | Primary evidence for this skill |

## Code References

- `seeds/types.ts:1-193` - All TypeScript type definitions
- `seeds/skills.ts:7-155` - 155 skill definitions
- `seeds/skills.ts:161-304` - Skill hierarchy (parent-child relationships)
- `seeds/skills.ts:310-383` - 73 skill correlations
- `seeds/engineers.ts:9-65` - 5 engineers + 1 manager
- `seeds/engineers.ts:86-151` - ~50 engineer skill records
- `seeds/stories.ts:9-115` - 8 interview stories (STAR format)
- `seeds/stories.ts:121-218` - 8 story analyses
- `seeds/stories.ts:224-277` - Story-skill demonstrations
- `seeds/assessments.ts:18-51` - 4 assessments
- `seeds/assessments.ts:57-150` - 11 assessment questions
- `seeds/assessments.ts:156-192` - Question-skill mappings with weights
- `seeds/assessments.ts:198-244` - 5 assessment attempts
- `seeds/assessments.ts:250-382` - 15 question performances
- `seeds/assessments.ts:388-434` - 5 certifications
- `seeds/assessments.ts:440-452` - Certification-skill validations
- `seeds/assessments.ts:458-465` - 6 engineer-certification links
- `seeds/assessments.ts:471-507` - 28 skill evidence links
- `seeds/seed.ts:26-420` - Neo4j seeding logic with MERGE/upsert pattern

## Architecture Insights

### 1. Knowledge-Based Recommender Design
The model implements a knowledge-based recommender system where recommendations are based on:
- **Explicit skill requirements** (manager searches for skills)
- **Skill inference** via hierarchy (searching "Backend" finds TypeScript engineers)
- **Skill inference** via correlations (React correlates with TypeScript)
- **Evidence-weighted confidence** (skills backed by multiple evidence types rank higher)

### 2. Upsert Pattern for Idempotent Seeding
All seed operations use `MERGE...ON CREATE SET...ON MATCH SET` pattern (`seeds/seed.ts`):
```cypher
MERGE (s:Skill {id: $id})
ON CREATE SET s.name = $name, ...
ON MATCH SET s.name = $name, ...
```
This allows re-running seeds without duplicating data.

### 3. Category-Based Seed Selection
The seeder supports selective category seeding via `SEED_CATEGORIES` env var:
- `skills` - Skills, hierarchy, correlations
- `engineers` - Engineers, managers, engineer skills
- `stories` - Interview stories, analyses, demonstrations
- `assessments` - Assessments, questions, performances, certifications, evidence

### 4. Confidence Score Calculation
The `confidenceScore` on `EngineerSkill` represents the system's overall confidence based on:
- Number and quality of evidence items
- Recency of validation (`lastValidated`)
- Type diversity (story + assessment + certification = higher confidence)

### 5. Temporal Data
All major entities have timestamps (`createdAt`, `lastValidated`, etc.) for:
- Tracking skill freshness
- Audit trails
- Decay modeling (older unvalidated skills may decay)

## Sample Cypher Queries (from README)

```cypher
-- Find engineers with a skill (including children in hierarchy)
MATCH (category:Skill {name: 'Backend'})<-[:CHILD_OF*0..]-(skill:Skill)
MATCH (eng:Engineer)-[:HAS]->(es:EngineerSkill)-[:FOR]->(skill)
WHERE es.confidenceScore >= 0.7
RETURN eng.name, skill.name, es.proficiencyLevel, es.confidenceScore

-- Get engineer's skills with their best evidence
MATCH (eng:Engineer {id: 'eng_priya'})-[:HAS]->(es:EngineerSkill)-[:FOR]->(skill:Skill)
OPTIONAL MATCH (es)-[ev:EVIDENCED_BY {isPrimary: true}]->(evidence)
RETURN skill.name, skill.skillType, es.proficiencyLevel, es.confidenceScore,
       labels(evidence)[0] as evidenceType
```

## Open Questions

1. **Confidence Score Algorithm**: How exactly is `confidenceScore` calculated? Is it manually set or computed?
2. **Skill Decay**: Is there a mechanism to decay confidence over time for unvalidated skills?
3. **Story-Skill Mapping**: Are `StoryDemonstration` links created manually or via AI analysis?
4. **Manager Search Model**: How do managers specify requirements? Free-text? Structured queries?
5. **API Layer**: What API endpoints exist for querying this graph?
