---
date: 2025-12-29T14:23:11Z
researcher: Claude
git_commit: 1e20fa613ea2a3b8d02f0271561e9de420fbf154
branch: main
repository: recommender_system
topic: "Neo4j Seeds Directory Analysis - Talent Marketplace Knowledge Graph"
tags: [research, codebase, neo4j, seeds, knowledge-graph, recommender-system]
status: complete
last_updated: 2025-12-29
last_updated_by: Claude
---

# Research: Neo4j Seeds Directory Analysis

**Date**: 2025-12-29T14:23:11Z
**Researcher**: Claude
**Git Commit**: 1e20fa613ea2a3b8d02f0271561e9de420fbf154
**Branch**: main
**Repository**: recommender_system

## Research Question

Research the seeds directory to get an understanding of what we're going to be seeding into the Neo4j database.

## Summary

The seeds directory contains TypeScript files that populate a Neo4j knowledge graph for an **Engineering Talent Marketplace**. The system implements concepts from Chapter 5 (Knowledge-Based Recommender Systems) of "Recommender Systems: The Textbook" by Charu Aggarwal.

The graph connects **Engineers** to **Skills** through evidence-based relationships, where skills are validated by:
- Interview stories (STAR-format narratives with AI analysis)
- Assessment performances (coding challenges, system design)
- External certifications (AWS, Kubernetes, etc.)

## Detailed Findings

### Project Structure

```
seeds/
├── index.ts          # Data exports aggregator
├── seed.ts           # Main seed script (Neo4j operations)
├── types.ts          # TypeScript type definitions
├── skills.ts         # Skills, hierarchy, correlations
├── engineers.ts      # Engineers, managers, engineer skills
├── stories.ts        # Interview stories, analyses, demonstrations
├── assessments.ts    # Assessments, questions, performances, certs
├── package.json      # Dependencies (neo4j-driver)
├── tsconfig.json     # TypeScript configuration
└── README.md         # Documentation
```

### Node Types (Entities)

| Entity | Count | Description |
|--------|-------|-------------|
| **Skill** | 100+ | Technical, behavioral, and domain knowledge skills |
| **Engineer** | 5 | Software engineers with profiles, rates, availability |
| **EngineeringManager** | 1 | Hiring manager who searches for talent |
| **EngineerSkill** | 50+ | Junction entities with proficiency & confidence scores |
| **InterviewStory** | 8 | STAR-format stories from AI interviews |
| **StoryAnalysis** | 8 | AI analysis scores (clarity, impact, ownership) |
| **Assessment** | 4 | Reusable assessment templates |
| **AssessmentQuestion** | 11 | Individual questions within assessments |
| **AssessmentAttempt** | 5 | Engineer attempts at assessments |
| **QuestionPerformance** | 15 | Performance records on specific questions |
| **Certification** | 5 | External credentials (AWS, CKA, Terraform) |

### Skill Taxonomy

Skills are organized into three top-level categories with hierarchical subcategories:

#### Technical Skills (`skills.ts:7-87`)
- **Languages & Frameworks**: JavaScript, TypeScript, Node.js, Express, NestJS, React, Next.js, Vue, Angular, Python, Django, FastAPI, Java, Spring Boot, Go, Rust
- **Databases**: PostgreSQL, MySQL, MongoDB, Redis, DynamoDB, Neo4j, Kafka
- **Infrastructure**: AWS (Lambda, S3), GCP, Azure, Docker, Kubernetes, Helm, Terraform, GitHub Actions
- **Design & Architecture**: API Design, REST, GraphQL, gRPC, System Design, Microservices, Event-Driven, Distributed Systems, Data Modeling
- **Practices**: Testing (Unit, Integration, E2E, TDD), Observability (Logging, Monitoring, Tracing), Security (Auth)

#### Behavioral Skills (`skills.ts:88-145`)
- **Leadership**: Team Leadership, Technical Leadership, Mentorship, Coaching, Delegation, Decision Making, Conflict Resolution
- **Communication**: Technical Writing, Documentation, Presenting, Stakeholder Communication, Cross-Functional Collaboration, Feedback (giving/receiving), Active Listening
- **Problem Solving**: Analytical Thinking, Debugging, Root Cause Analysis, Navigating Ambiguity, Creative Problem Solving, Prioritization, Evaluating Tradeoffs
- **Execution**: Ownership, Accountability, Time Management, Estimation, Attention to Detail, Follow-Through, Working Under Pressure
- **Collaboration**: Code Review, Pair Programming, Knowledge Sharing, Teamwork, Remote Collaboration
- **Growth**: Continuous Learning, Adaptability, Resilience, Self-Awareness, Curiosity

#### Domain Knowledge (`skills.ts:147-152`)
- Fintech, Healthcare, E-commerce, SaaS, Marketplaces

### Skill Relationships

#### Hierarchy (`skills.ts:159-299`)
Skills form a tree structure via `CHILD_OF` relationships:
```
Technical
├── Languages & Frameworks
│   ├── JavaScript
│   │   ├── TypeScript
│   │   ├── Node.js
│   │   │   ├── Express
│   │   │   └── NestJS
│   │   ├── React
│   │   │   └── Next.js
│   │   ├── Vue
│   │   └── Angular
│   ├── Python
│   │   ├── Django
│   │   └── FastAPI
│   └── ...
├── Databases
│   ├── Relational
│   │   ├── PostgreSQL
│   │   └── MySQL
│   └── NoSQL
│       ├── MongoDB
│       ├── Redis
│       └── ...
└── ...
```

#### Correlations (`skills.ts:306-379`)
Skills are linked via `CORRELATES_WITH` relationships with three correlation types:
- **complementary**: Skills that work well together (e.g., Kubernetes + Docker: 0.9)
- **transferable**: Knowledge from one applies to another (e.g., TypeScript -> JavaScript: 0.95)
- **co_occurring**: Skills frequently seen together (e.g., React + TypeScript: 0.75)

### Sample Engineers (`engineers.ts:9-65`)

| Name | ID | Role | Rate | Experience | Availability | Timezone |
|------|-----|------|------|------------|--------------|----------|
| Priya Sharma | eng_priya | Senior Backend, Fintech | $145/hr | 8 yrs | 2 weeks | America/New_York |
| Marcus Chen | eng_marcus | Full Stack, React & Node.js | $125/hr | 5 yrs | Immediate | America/Los_Angeles |
| Sofia Rodriguez | eng_sofia | Platform, Kubernetes & AWS | $160/hr | 7 yrs | 1 month | America/Chicago |
| James Okonkwo | eng_james | Staff Engineer, Distributed Systems | $185/hr | 12 yrs | 2 weeks | Europe/London |
| Emily Nakamura | eng_emily | Frontend, React & Design Systems | $115/hr | 4 yrs | Immediate | America/Los_Angeles |

### Engineer Skills (`engineers.ts:86-151`)

Each engineer has 9-13 skills with:
- `proficiencyLevel`: 'learning' | 'proficient' | 'expert'
- `yearsUsed`: Number of years using the skill
- `confidenceScore`: 0-1 score indicating confidence in the skill assessment
- `lastValidated`: Timestamp of last validation

Example (Priya's skills):
- TypeScript (expert, 6 yrs, 0.92 confidence)
- Node.js (expert, 7 yrs, 0.91)
- PostgreSQL (expert, 8 yrs, 0.88)
- System Design (expert, 5 yrs, 0.85)
- Fintech domain (expert, 6 yrs, 0.90)

### Evidence System

Skills are validated through three evidence types:

#### 1. Interview Stories (`stories.ts:9-115`)
STAR-format stories from AI interviews:
- `situation`: Context/background
- `task`: What was required
- `action`: Specific actions taken
- `result`: Quantified outcomes

Example (Priya's microservices migration story):
- Led migration from monolith to microservices at Series B fintech
- Designed API contracts with OpenAPI, implemented Kafka event sourcing
- Result: Zero downtime, P99 latency 800ms -> 120ms, team scaled 5 -> 12

#### 2. Story Analysis (`stories.ts:121-218`)
AI analysis of story quality:
- `clarityScore`: How clear the narrative (0-1)
- `impactScore`: Business/technical impact (0-1)
- `ownershipScore`: Individual contribution (0-1)
- `overallScore`: Combined assessment
- `reasoning`: Explanation of scores
- `flags`: Any concerns

#### 3. Story Demonstrations (`stories.ts:224-277`)
Links between stories and skills they demonstrate:
- `strength`: How strongly the story shows the skill (0-1)
- `notes`: Specific evidence from the story

#### 4. Assessments (`assessments.ts:18-51`)
Four assessment types:
| Assessment | Type | Duration | Questions |
|------------|------|----------|-----------|
| Backend Engineering | coding_challenge | 90 min | 3 |
| Frontend Engineering | coding_challenge | 60 min | 3 |
| System Design | system_design | 45 min | 2 |
| Platform Engineering | coding_challenge | 75 min | 3 |

#### 5. Assessment Questions (`assessments.ts:57-150`)
Each question has:
- `summary`: Question description
- `maxScore`: Maximum achievable score
- `evaluationCriteria`: How answers are evaluated

Questions test multiple skills with weights via `TESTS` relationships.

#### 6. Question Performance (`assessments.ts:250-381`)
Records of how engineers performed:
- `score`: Achieved score (0-1)
- `technicalDepth`: 'surface' | 'working' | 'deep' | 'expert'
- `feedback`: Evaluator comments

#### 7. Certifications (`assessments.ts:388-434`)
External credentials:
- AWS Solutions Architect (Associate & Professional)
- Certified Kubernetes Administrator (CKA)
- Certified Kubernetes Application Developer (CKAD)
- HashiCorp Terraform Associate

### Relationship Schema

```cypher
// Core engineer-skill relationship
(:Engineer)-[:HAS]->(:EngineerSkill)-[:FOR]->(:Skill)

// Skill taxonomy
(:Skill)-[:CHILD_OF]->(:Skill)
(:Skill)-[:CORRELATES_WITH {strength, correlationType}]->(:Skill)

// Evidence linking
(:EngineerSkill)-[:EVIDENCED_BY {relevanceScore, isPrimary}]->(:Evidence)

// Interview stories
(:Engineer)-[:TOLD]->(:InterviewStory)
(:InterviewStory)-[:ANALYZED_BY]->(:StoryAnalysis)
(:InterviewStory)-[:DEMONSTRATES {strength, notes}]->(:Skill)

// Assessments
(:Assessment)-[:CONTAINS]->(:AssessmentQuestion)
(:AssessmentQuestion)-[:TESTS {weight}]->(:Skill)
(:Engineer)-[:ATTEMPTED]->(:AssessmentAttempt)-[:OF]->(:Assessment)
(:AssessmentAttempt)-[:INCLUDES]->(:QuestionPerformance)-[:FOR_QUESTION]->(:AssessmentQuestion)

// Certifications
(:Certification)-[:VALIDATES]->(:Skill)
(:Engineer)-[:HOLDS]->(:Certification)
```

### Seed Process (`seed.ts`)

The seed script executes in dependency order:
1. Clear existing data
2. Create uniqueness constraints
3. Seed skills -> hierarchy -> correlations
4. Seed engineers -> managers -> engineer skills
5. Seed stories -> analyses -> demonstrations
6. Seed assessments -> questions -> skill tests -> attempts -> performances
7. Seed certifications -> validations -> engineer certifications
8. Link all evidence to engineer skills

## Code References

- `seeds/types.ts:1-193` - All TypeScript type definitions
- `seeds/skills.ts:7-153` - Skill entity definitions
- `seeds/skills.ts:159-300` - Skill hierarchy relationships
- `seeds/skills.ts:306-379` - Skill correlations
- `seeds/engineers.ts:9-65` - Engineer profiles
- `seeds/engineers.ts:86-151` - Engineer skill assignments
- `seeds/stories.ts:9-115` - Interview story content
- `seeds/stories.ts:121-218` - Story analysis data
- `seeds/stories.ts:224-277` - Story-skill demonstrations
- `seeds/assessments.ts:18-51` - Assessment definitions
- `seeds/assessments.ts:57-150` - Assessment questions
- `seeds/assessments.ts:156-192` - Question-skill test mappings
- `seeds/assessments.ts:198-244` - Assessment attempt records
- `seeds/assessments.ts:250-381` - Question performance data
- `seeds/assessments.ts:388-434` - Certification definitions
- `seeds/assessments.ts:440-452` - Certification-skill validations
- `seeds/assessments.ts:458-465` - Engineer certification assignments
- `seeds/assessments.ts:471-507` - Skill evidence linking
- `seeds/seed.ts:16-486` - Main seed orchestration

## Architecture Insights

1. **Knowledge-Based Recommender Pattern**: The system implements evidence-based skill validation rather than self-reported skills, following academic best practices from Aggarwal's textbook.

2. **Junction Entity Pattern**: `EngineerSkill` acts as a rich junction entity that holds proficiency metadata and serves as the anchor for evidence relationships.

3. **Hierarchical Taxonomy**: Skills form a tree allowing queries like "find all engineers with Backend skills" to traverse the hierarchy and match specialists in specific technologies.

4. **Correlation Graph**: Skill correlations enable recommendations like "engineers with React often know TypeScript" with different relationship semantics (complementary, transferable, co-occurring).

5. **Multi-Source Evidence**: Skills are validated through multiple independent sources (stories, assessments, certifications), each with relevance scores and primary/secondary designation.

6. **Temporal Tracking**: All entities include timestamps (`createdAt`, `lastValidated`, `analyzedAt`) enabling freshness-based queries.

## Open Questions

1. How will the correlation strengths be updated over time based on observed data?
2. Is there a plan for additional evidence types (GitHub activity, peer reviews)?
3. How will the confidence scores be recalculated as new evidence is added?
4. Will there be multi-tenant support for different marketplaces?
