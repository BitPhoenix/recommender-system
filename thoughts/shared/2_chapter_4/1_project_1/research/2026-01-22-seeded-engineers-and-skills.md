---
date: 2026-01-22T09:00:00-05:00
researcher: Claude
git_commit: 3ba63a9d833ddd2f5b5b68837067160e5e63316b
branch: chapter-4-project-1
repository: recommender_system
topic: "Seeded Engineers and Their Skills"
tags: [research, codebase, engineers, skills, resume-generation]
status: complete
last_updated: 2026-01-22
last_updated_by: Claude
---

# Research: Seeded Engineers and Their Skills

**Date**: 2026-01-22T09:00:00-05:00
**Researcher**: Claude
**Git Commit**: 3ba63a9d833ddd2f5b5b68837067160e5e63316b
**Branch**: chapter-4-project-1
**Repository**: recommender_system

## Research Question

Research the engineers we've seeded and their skills in preparation for a future task where we'll be generating resume text for each of them.

## Summary

The system has **38 engineers** seeded across five seniority levels, with rich skill profiles, business domain experience, and technical domain experience. Each engineer has a distinct persona with carefully designed skill combinations and confidence levels to represent realistic archetypes (high performers, coasting seniors, big-tech specialists, startup generalists).

## Detailed Findings

### Engineer Overview by Seniority Level

#### Junior Engineers (0-3 years) - 6 engineers

| ID | Name | Headline | Salary | Years | Timezone | Start |
|---|---|---|---|---|---|---|
| `eng_maya` | Maya Johnson | Frontend Engineer \| React & TypeScript | $95K | 2 | Eastern | immediate |
| `eng_kevin` | Kevin Park | Backend Engineer \| Python & Django | $105K | 3 | Pacific | two_weeks |
| `eng_jordan` | Jordan Williams | Frontend Developer \| React & Tailwind | $90K | 2 | Central | immediate |
| `eng_carlos` | Carlos Mendez | Full Stack Developer \| Node.js & React | $85K | 3 | Mountain | one_month |
| `eng_ashley` | Ashley Chen | Frontend Developer \| Vue.js | $88K | 1 | Pacific | immediate |
| `eng_tyler` | Tyler Brooks | Backend Developer \| Java & Spring Boot | $98K | 3 | Mountain | two_weeks |

**Characteristics**: Confidence scores in 0.65-0.82 range, "learning" proficiency on some skills, strong "continuous learning" and "curiosity" behavioral skills.

#### Mid-Level Engineers (4-5 years) - 8 engineers

| ID | Name | Headline | Archetype | Salary | Years | Timezone |
|---|---|---|---|---|---|---|
| `eng_rachel` | Rachel Kim | Frontend Engineer \| Ex-Stripe, React Performance | HIGH-PERFORMING | $165K | 5 | Eastern |
| `eng_lisa` | Lisa Wang | Backend Engineer \| Ex-Cloudflare, Go & High-Scale | HIGH-PERFORMING | $160K | 5 | Pacific |
| `eng_zoe` | Zoe Martinez | Founding Engineer \| 0→1 at Two YC Startups | STARTUP GENERALIST | $155K | 5 | Pacific |
| `eng_david` | David Kim | Backend Engineer \| Healthcare Systems & Python | Standard | $145K | 4 | Pacific |
| `eng_mohammed` | Mohammed Ali | DevOps Engineer \| Kubernetes & Terraform | Standard | $140K | 4 | Central |
| `eng_aisha` | Aisha Patel | ML Engineer \| Healthcare & Python | Standard | $150K | 5 | Central |
| `eng_ryan` | Ryan Zhang | Mobile Developer \| React Native & Gaming | Standard | $125K | 4 | Mountain |
| `eng_emma` | Emma Wilson | Frontend Engineer \| React & Design Systems | Standard | $145K | 5 | Mountain |

**Note on archetypes**:
- **HIGH-PERFORMING**: Senior-level confidence (0.88-0.92) despite mid-level years
- **STARTUP GENERALIST**: Broad skills (12+), moderate confidence (0.75-0.85), very high ownership/adaptability

#### Senior Engineers (6-8 years) - 10 engineers

| ID | Name | Headline | Archetype | Salary | Years | Timezone |
|---|---|---|---|---|---|---|
| `eng_greg` | Greg Patterson | Senior Backend Engineer \| Enterprise Java | COASTING | $155K | 7 | Central |
| `eng_natasha` | Natasha Williams | Senior Full Stack Engineer \| EdTech | COASTING | $150K | 8 | Mountain |
| `eng_nathan` | Nathan Chen | Ex-Meta Staff Engineer \| Feed Ranking Infrastructure | BIG-TECH SPECIALIST | $210K | 8 | Pacific |
| `eng_wei` | Wei Chen | Ex-Netflix Data Engineer \| Real-Time Analytics | BIG-TECH SPECIALIST | $195K | 8 | Pacific |
| `eng_derek` | Derek Sullivan | Head of Engineering (prev) \| Seed to Series B | STARTUP GENERALIST | $180K | 7 | Mountain |
| `eng_takeshi` | Takeshi Yamamoto | Senior Backend Engineer \| Java & Distributed | Standard | $175K | 7 | Pacific |
| `eng_sarah` | Sarah Johnson | Senior Frontend Engineer \| React & Performance | Standard | $165K | 6 | Eastern |
| `eng_ravi` | Ravi Sharma | Senior Full Stack Engineer \| Healthcare Systems | Standard | $170K | 8 | Central |
| `eng_olivia` | Olivia Martinez | Senior ML Engineer \| NLP & Python | Standard | $190K | 7 | Pacific |
| `eng_lucas` | Lucas Thompson | Senior Security Engineer \| Cloud Security | Standard | $185K | 8 | Eastern |

**Note on archetypes**:
- **COASTING**: Mid-level confidence (0.78-0.84), older validation dates (90+ days ago)
- **BIG-TECH SPECIALIST**: Few skills (5-7), very high confidence (0.90-0.95)
- **STARTUP GENERALIST (Senior)**: Many skills (12-14), solid confidence (0.78-0.86), high hiring/leadership

#### Staff Engineers (9-11 years) - 8 engineers

| ID | Name | Headline | Salary | Years | Timezone | Start |
|---|---|---|---|---|---|---|
| `eng_anika` | Anika Patel | Staff Platform Engineer \| Kafka, Kubernetes & Distributed | $220K | 10 | Pacific | immediate |
| `eng_alex` | Alex Rivera | Staff Backend Engineer \| Java & System Design | $210K | 9 | Eastern | two_weeks |
| `eng_dmitri` | Dmitri Volkov | Staff ML Engineer \| Deep Learning & MLOps | $235K | 10 | Pacific | one_month |
| `eng_jennifer` | Jennifer Park | Staff Frontend Engineer \| React & Web Performance | $200K | 9 | Central | immediate |
| `eng_michael` | Michael O'Connor | Staff DevOps Engineer \| AWS & Platform Engineering | $215K | 11 | Mountain | three_months |
| `eng_sanjay` | Sanjay Gupta | Staff Data Engineer \| Spark & Real-time Systems | $225K | 10 | Mountain | two_weeks |
| `eng_christine` | Christine Kim | Staff Full Stack Engineer \| Healthcare & Fintech | $205K | 9 | Pacific | one_month |
| `eng_hassan` | Hassan Ahmed | Staff Security Engineer \| AppSec & Cloud Security | $230K | 11 | Eastern | immediate |

**Note**: `eng_anika` is specifically noted as "CRITICAL" - unlocks an example query requiring Kafka + Kubernetes + 10 years + immediate availability.

#### Principal Engineers (12+ years) - 3 engineers

| ID | Name | Headline | Salary | Years | Timezone | Start |
|---|---|---|---|---|---|---|
| `eng_victoria` | Victoria Chang | Principal Architect \| Distributed Systems & Cloud | $285K | 14 | Pacific | three_months |
| `eng_robert` | Robert Mitchell | Principal ML Architect \| AI Systems & Strategy | $320K | 15 | Eastern | six_months |
| `eng_elena` | Elena Rodriguez | Principal Security Architect \| Enterprise Security | $290K | 12 | Central | three_months |

**Characteristics**: Very high confidence (0.90-0.98), very recent validation (2-4 days ago).

#### Original Core Engineers (5 engineers - appear first in seed file)

| ID | Name | Headline | Salary | Years | Timezone | Start |
|---|---|---|---|---|---|---|
| `eng_priya` | Priya Sharma | Senior Backend Engineer \| Fintech & Payments | $210K | 8 | Eastern | two_weeks |
| `eng_marcus` | Marcus Chen | Full Stack Engineer \| React & Node.js | $155K | 5 | Pacific | immediate |
| `eng_sofia` | Sofia Rodriguez | Platform Engineer \| Kubernetes & AWS | $205K | 7 | Central | three_months |
| `eng_james` | James Okonkwo | Staff Engineer \| Distributed Systems | $295K | 12 | Eastern | six_months |
| `eng_emily` | Emily Nakamura | Frontend Engineer \| React & Design Systems | $140K | 4 | Pacific | immediate |

### Skills System

#### Technical Skills (71 total)

**Languages & Frameworks**: JavaScript, TypeScript, Node.js, Express, NestJS, React, Next.js, Vue, Angular, Python, Django, FastAPI, Java, Spring Boot, Go, Rust

**Databases**: PostgreSQL, MySQL, MongoDB, Redis, DynamoDB, Neo4j, Kafka

**Infrastructure & DevOps**: AWS, Lambda, S3, GCP, Azure, Docker, Kubernetes, Helm, Terraform, GitHub Actions

**Design & Architecture**: API Design, REST API, GraphQL, gRPC, System Design, Microservices, Event-Driven, Distributed Systems, Data Modeling

**Testing & Practices**: Unit Testing, Integration Testing, E2E Testing, TDD, Logging, Monitoring, Distributed Tracing, Auth

**Mobile**: React Native, Swift, Kotlin, Firebase

**Data/ML**: Apache Spark, TensorFlow

#### Behavioral Skills (36 total)

**Leadership**: Team Leadership, Technical Leadership, Mentorship, Coaching, Delegation, Decision Making, Conflict Resolution

**Communication**: Technical Writing, Documentation, Presentation, Stakeholder Communication, Cross-Functional Collaboration, Feedback Giving/Receiving, Active Listening

**Problem Solving**: Analytical Thinking, Debugging, Root Cause Analysis, Navigating Ambiguity, Creative Problem Solving, Prioritization, Evaluating Tradeoffs

**Execution**: Ownership, Accountability, Time Management, Estimation, Attention to Detail, Follow-Through, Working Under Pressure

**Collaboration**: Code Review, Pair Programming, Knowledge Sharing, Teamwork, Remote Collaboration

**Growth**: Continuous Learning, Adaptability, Resilience, Self-Awareness, Curiosity

### UserSkill Model

Each engineer-skill relationship includes:
- `proficiencyLevel`: 'learning' | 'familiar' | 'proficient' | 'expert'
- `yearsUsed`: Number of years using the skill
- `confidenceScore`: 0.0-1.0 confidence in the assessment
- `lastValidated`: When the skill was last validated

**Confidence Score Patterns by Archetype**:
- Junior: 0.65-0.82
- Mid-level standard: 0.75-0.85
- Mid-level high-performing: 0.88-0.92
- Senior coasting: 0.78-0.84
- Senior big-tech specialist: 0.90-0.95
- Staff: 0.85-0.95
- Principal: 0.90-0.98

### Business Domain Experience

Engineers have explicit business domain claims:

| Domain | Engineers with Experience |
|---|---|
| Fintech | Priya (6yr), Tyler (2yr), Rachel (3yr), Zoe (2yr), Derek (3yr), Takeshi (5yr), Lucas (5yr), Anika (7yr), Alex (6yr), Sanjay (4yr), Christine (4yr), Hassan (8yr), Victoria (6yr), Robert (4yr), Elena (9yr) |
| Healthcare | David (4yr), Aisha (4yr), Ravi (6yr), Olivia (4yr), Dmitri (5yr), Christine (5yr), Robert (8yr), Elena (3yr) |
| SaaS | Marcus (4yr), Maya (2yr), Kevin (2yr), Lisa (4yr), Zoe (3yr), Greg (5yr), Nathan (6yr), Derek (4yr), Jennifer (4yr), Michael (8yr), Victoria (10yr) |
| E-commerce | Emily (3yr), Carlos (2yr), Emma (3yr), Zoe (2yr), Derek (2yr), Sarah (4yr), Jennifer (6yr) |
| Payments | Priya (4yr), Rachel (3yr) |
| Banking | James (3yr), Alex (4yr), Hassan (5yr), Elena (7yr) |
| Pharma | Aisha (2yr), Olivia (3yr), Dmitri (4yr), Robert (5yr) |
| Gaming | Ryan (3yr) |
| EdTech | Natasha (6yr) |
| Streaming | Wei (5yr), Sanjay (6yr) |

**Note**: `bd_streaming` domain is referenced in seed data but not defined in `seeds/domains.ts`.

### Technical Domain Experience

| Domain | Engineers with Experience |
|---|---|
| Backend | Priya (8yr), Kevin (3yr), Tyler (3yr), Lisa (5yr), David (4yr), Greg (7yr), Takeshi (7yr), Alex (9yr), Christine (8yr), Robert (8yr) |
| Frontend | Emily (4yr), Maya (2yr), Jordan (2yr), Ashley (1yr), Rachel (5yr), Emma (5yr), Sarah (6yr), Jennifer (9yr) |
| Full Stack | Marcus (5yr), Carlos (3yr), Zoe (5yr), Natasha (8yr), Derek (7yr), Ravi (8yr), Christine (9yr) |
| DevOps | Sofia (7yr), Mohammed (4yr), Derek (4yr), Lucas (6yr), Anika (7yr), Michael (11yr), Hassan (8yr), Victoria (8yr), Elena (8yr) |
| Kubernetes | Sofia (5yr), Mohammed (3yr), Anika (7yr), Michael (6yr), Victoria (8yr), Elena (7yr) |
| Cloud | Sofia (6yr), Lucas (7yr), Michael (10yr), Hassan (10yr), Victoria (10yr), Elena (10yr) |
| Distributed Systems | James (10yr), Lisa (4yr), Wei (6yr), Takeshi (5yr), Anika (8yr), Alex (6yr), Sanjay (7yr), Victoria (12yr) |
| ML | Aisha (4yr), Nathan (6yr), Olivia (7yr), Dmitri (10yr), Robert (12yr) |
| Data Engineering | Aisha (3yr), Nathan (5yr), Wei (8yr), Olivia (4yr), Dmitri (6yr), Sanjay (10yr), Robert (10yr) |
| Mobile | Ryan (4yr) |
| API Development | Priya (6yr) |
| React Ecosystem | Emily (4yr), Rachel (5yr), Emma (4yr), Sarah (6yr), Jennifer (8yr) |

## Code References

- `seeds/engineers.ts:15-491` - Engineer definitions (38 engineers)
- `seeds/engineers.ts:512-965` - UserSkills mapping skills to engineers
- `seeds/engineers.ts:973-1050` - Business domain experience
- `seeds/engineers.ts:1060-1154` - Technical domain experience
- `seeds/skills.ts:11-138` - Skill definitions (107 skills)
- `seeds/domains.ts:13-40` - Business domain definitions (15 domains)
- `seeds/domains.ts:69-98` - Technical domain definitions (18 domains)

## Architecture Insights

1. **Skill Proficiency Model**: Uses four proficiency levels (learning, familiar, proficient, expert) combined with confidence scores to represent nuanced skill assessments.

2. **Archetype-Based Confidence**: Engineers are designed with specific archetypes that affect their confidence scores - high performers have senior-level confidence despite fewer years, coasting seniors have mid-level confidence despite more years.

3. **Domain Hierarchy**: Both business and technical domains support hierarchical relationships where child domain experience satisfies parent domain requirements.

4. **Composite Domains**: The `td_fullstack` domain uses an "encompasses" relationship to indicate it includes both backend and frontend experience.

5. **Missing Domain**: `bd_streaming` is used for Wei Chen and Sanjay Gupta but is not defined in `domains.ts` - this appears to be a data inconsistency that should be addressed.

## Considerations for Resume Generation

When generating resume text, consider:

1. **Headlines as Summary**: Each engineer has a headline that captures their primary focus (e.g., "Senior Backend Engineer | Fintech & Payments")

2. **Skill Depth vs Breadth**:
   - Big-tech specialists have few skills with high confidence
   - Startup generalists have many skills with moderate confidence
   - This should be reflected in how skills are described

3. **Experience Narrative**:
   - Years of experience + specific skill years tell a story
   - Domain experience adds context (e.g., "7 years in fintech")

4. **Archetype-Appropriate Language**:
   - High performers: emphasize achievements, advanced skills
   - Coasting seniors: emphasize reliability, breadth of experience
   - Startup generalists: emphasize versatility, ownership, 0→1 experience

5. **Timezone and Availability**: Can inform work preferences in resume

## Open Questions

1. Should `bd_streaming` be added to `domains.ts` or should the references be changed to existing domains?

2. Are there any additional fields on Engineer that should be populated (e.g., bio, summary) for resume generation?

3. Should the resume text be generated from a template based on archetype, or should each be unique?
