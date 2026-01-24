---
date: 2026-01-23T00:00:00-08:00
researcher: Claude
git_commit: 3ba63a9d833ddd2f5b5b68837067160e5e63316b
branch: chapter-4-project-1
repository: recommender_system
topic: "Comprehensive Analysis of Seeded Engineers, Skills, Work Experiences, and Companies"
tags: [research, codebase, seeding, engineers, skills, companies, job-matching]
status: complete
last_updated: 2026-01-23
last_updated_by: Claude
---

# Research: Comprehensive Analysis of Seeded Engineers, Skills, Work Experiences, and Companies

**Date**: 2026-01-23
**Researcher**: Claude
**Git Commit**: 3ba63a9d833ddd2f5b5b68837067160e5e63316b
**Branch**: chapter-4-project-1
**Repository**: recommender_system

## Research Question

Research our engineers, their skills, their work experiences, the companies they worked for, etc. in our seeding files to get a comprehensive understanding of the types of engineers we have. This information will help figure out what kinds of jobs we can match our existing engineers against when seeding job descriptions.

## Summary

The system has **33 engineers** distributed across 5 seniority levels:
- **6 Junior** (1-3 years experience)
- **8 Mid-Level** (4-5 years experience)
- **10 Senior** (6-9 years experience)
- **8 Staff** (10-13 years experience)
- **3 Principal** (14-16 years experience)

Engineers have worked at **70+ companies** spanning FAANG/big tech, fintech unicorns, healthcare, e-commerce, and startups. The skill taxonomy covers **50+ technical skills** and **15+ behavioral skills** across frontend, backend, DevOps, ML, and security domains.

## Detailed Findings

### Engineer Distribution by Seniority Level

| Seniority | Count | Years Experience Range | Example Engineers |
|-----------|-------|----------------------|-------------------|
| Junior | 6 | 1-3 years | Maya, Kevin, Jordan, Carlos, Ashley, Tyler |
| Mid-Level | 8 | 4-5 years | Rachel, Lisa, Zoe, David, Mohammed, Aisha, Ryan, Emma |
| Senior | 10 | 6-9 years | Priya, Marcus, Sofia, Emily, Greg, Natasha, Nathan, Wei, Derek, Takeshi, Sarah, Ravi, Olivia, Lucas |
| Staff | 8 | 10-13 years | James, Anika, Alex, Dmitri, Jennifer, Michael, Sanjay, Christine, Hassan |
| Principal | 3 | 14-16 years | Victoria, Robert, Elena |

### Engineer Archetypes

The seed data includes intentionally diverse archetypes:

1. **High-Performing Mid-Levels** (Rachel, Lisa)
   - Senior-level confidence scores (0.88-0.92)
   - Ex-big tech (Stripe, Cloudflare)
   - Ready for promotion

2. **Coasting Seniors** (Greg, Natasha)
   - Mid-level confidence scores (0.78-0.84)
   - Older skill validation dates (85-90 days ago)
   - Comfortable in current roles

3. **Big-Tech Specialists** (Nathan, Wei)
   - Very high confidence (0.90-0.95) on 5-7 skills
   - Deep expertise in narrow areas
   - Ex-Meta, Ex-Netflix

4. **Startup Generalists** (Zoe, Derek)
   - Broad skill coverage (12-14 skills)
   - Solid confidence (0.75-0.86)
   - High ownership and adaptability

5. **Standard Performers**
   - Typical confidence for level
   - Balanced skill sets
   - Most engineers fall here

### Technical Domains Covered

| Domain | Engineer Examples | Key Skills |
|--------|------------------|------------|
| **Frontend** | Maya, Jordan, Emily, Rachel, Sarah, Jennifer | React, TypeScript, Next.js, Vue.js |
| **Backend** | Priya, Kevin, Tyler, David, Takeshi, Alex | Node.js, Python, Java, Spring Boot |
| **Full Stack** | Marcus, Carlos, Zoe, Ravi, Christine | React + Node.js, TypeScript |
| **DevOps/Platform** | Sofia, Mohammed, Michael | Kubernetes, Docker, Terraform, AWS |
| **ML/Data** | Aisha, Olivia, Dmitri, Robert, Sanjay | Python, TensorFlow, Spark, PyTorch |
| **Security** | Lucas, Hassan, Elena | AWS, Terraform, Monitoring |
| **Distributed Systems** | James, Lisa, Victoria | Kafka, System Design, Event-Driven |
| **Mobile** | Ryan | React Native, Firebase |

### Business Domains Covered

| Domain | Engineers with Experience | Years Range |
|--------|--------------------------|-------------|
| **Fintech** | Priya(6), James(5), Tyler(2), Rachel(3), Derek(3), Takeshi(5), Lucas(5), Anika(7), Alex(6), Sanjay(4), Christine(4), Hassan(8), Victoria(6), Robert(4), Elena(9) | 2-9 years |
| **Payments** | Priya(4), Rachel(3) | 3-4 years |
| **Banking** | James(3), Alex(4), Hassan(5), Elena(7) | 3-7 years |
| **Healthcare** | David(4), Aisha(4), Ravi(6), Olivia(4), Dmitri(5), Christine(5), Robert(8), Elena(3) | 3-8 years |
| **Pharma** | Aisha(2), Olivia(3), Dmitri(4), Robert(5) | 2-5 years |
| **E-commerce** | Emily(3), Carlos(2), Zoe(2), Emma(3), Derek(2), Sarah(4), Jennifer(6) | 2-6 years |
| **SaaS** | Marcus(4), Maya(2), Kevin(2), Lisa(4), Zoe(3), Greg(5), Nathan(6), Derek(4), Michael(8), Jennifer(4), Victoria(10) | 2-10 years |
| **EdTech** | Natasha(6) | 6 years |
| **Streaming** | Wei(5), Sanjay(6) | 5-6 years |
| **Gaming** | Ryan(3) | 3 years |

### Companies Represented

#### FAANG/Big Tech
- Amazon (James - Staff)
- Airbnb (Marcus - Mid)
- Figma (Marcus - Mid)
- Datadog (Sofia - Senior)
- Twilio (Sofia - Mid)
- Shopify (Emily - Mid)

#### Fintech Unicorns
- Stripe (Priya - Senior, Rachel - Senior)
- PayPal (Priya - Mid)
- Plaid (Kevin - Junior)
- Square (Emily - Junior)
- Coinbase (Rachel - Senior)
- American Express (Tyler - Junior)

#### Finance/Banking
- Goldman Sachs (James - Senior)
- JPMorgan Chase (James - Mid)
- Capital One (Priya - Junior)

#### Healthcare
- HealthTech Startup (Kevin - Junior)

#### E-commerce
- Etsy (Carlos - Junior)
- E-commerce Startup (Emily, Carlos - Junior)

#### Real Estate/PropTech
- Zillow (Ashley - Junior)

#### Food/Delivery
- Grubhub (Jordan - Junior)

#### Enterprise
- IBM (Sofia - Junior)

### Skills Taxonomy

#### Programming Languages
- **TypeScript/JavaScript**: Most common, used by 20+ engineers
- **Python**: 12+ engineers, especially ML and backend
- **Java**: 8+ engineers, primarily backend/distributed systems
- **Go**: Sofia, Lisa (platform engineering)

#### Frontend Frameworks
- **React**: Dominant, 15+ engineers
- **Next.js**: 8+ engineers
- **Vue.js**: Ashley (1 engineer)
- **React Native**: Ryan (mobile)

#### Backend Frameworks
- **Node.js/Express**: 10+ engineers
- **Django**: Kevin, David
- **Spring Boot**: Tyler, James, Takeshi, Alex

#### Databases
- **PostgreSQL**: Most common, 20+ engineers
- **MongoDB**: Carlos, Zoe
- **MySQL**: Tyler, Greg
- **Redis**: Lisa, Marcus

#### Infrastructure/DevOps
- **Kubernetes**: Sofia, Mohammed, Michael, Victoria, Elena (5+ engineers)
- **Docker**: 15+ engineers
- **AWS**: 15+ engineers
- **Terraform**: Sofia, Mohammed, Michael, Victoria, Elena
- **Helm**: Sofia, Mohammed, Michael

#### Data/ML
- **Spark**: Nathan, Wei, Aisha, Olivia, Dmitri, Sanjay, Robert
- **TensorFlow**: Aisha, Olivia, Dmitri, Robert
- **PyTorch**: Robert
- **Kafka**: Priya, James, Anika, Wei, Sanjay, Victoria

#### Behavioral/Soft Skills
- **Ownership**: Marcus, Kevin, Carlos, Zoe, Derek
- **Learning/Curiosity**: Maya, Kevin, Jordan, Carlos, Ashley, Tyler, Zoe
- **Mentorship**: Priya, James, Nathan, Wei, and all Staff/Principal
- **Team Leadership**: Derek, Anika, Michael, Victoria, Robert, Elena
- **Attention to Detail**: Emily, Maya, David, Aisha, Emma, Christine, Lucas

### Proficiency Distribution

| Level | Description | Confidence Range | Example |
|-------|-------------|------------------|---------|
| **Learning** | Just starting | 0.62-0.70 | Ashley's TypeScript |
| **Proficient** | Solid working knowledge | 0.72-0.85 | Most mid-level skills |
| **Expert** | Deep mastery | 0.85-0.98 | Victoria's distributed systems (0.98) |

### Geographic Distribution (Timezones)

| Timezone | Count | Engineers |
|----------|-------|-----------|
| Eastern | ~10 | Priya, James, Maya, etc. |
| Central | ~5 | Sofia, Jordan, etc. |
| Mountain | ~3 | Carlos, etc. |
| Pacific | ~15 | Marcus, Emily, Kevin, Ashley, etc. |

### Work Experience Patterns

Each engineer has 2-3 work experiences with:
- **Company name** (normalized via company service)
- **Title** (e.g., "Senior Software Engineer")
- **Seniority level** (junior, mid, senior, staff, principal)
- **Start/end dates** (YYYY-MM format, "present" for current)
- **Highlights** (2-3 bullet points)
- **Linked skills** (which UserSkills were used at this job)

## Job Matching Implications

Based on this data, the system can match engineers against job descriptions requiring:

### Entry-Level/Junior Roles (1-3 years)
- **Frontend Developer** - React, TypeScript, responsive design
- **Backend Developer** - Python/Django or Java/Spring
- **Full Stack Developer** - Node.js + React

### Mid-Level Roles (4-5 years)
- **Senior Frontend Engineer** - React performance, TypeScript, testing
- **Backend Engineer** - API design, microservices basics
- **DevOps Engineer** - Kubernetes, Docker, CI/CD
- **ML Engineer** - Python, TensorFlow, data pipelines

### Senior Roles (6-9 years)
- **Staff Frontend Engineer** - Design systems, performance optimization
- **Senior Backend Engineer** - System design, distributed systems
- **Platform Engineer** - Kubernetes at scale, SRE practices
- **Security Engineer** - Cloud security, compliance

### Staff+ Roles (10+ years)
- **Principal Engineer** - Architecture, cross-team leadership
- **Staff Architect** - Distributed systems, technical strategy
- **Engineering Manager** - Technical leadership, hiring, mentorship

### Industry-Specific Roles
- **Fintech** - 15 engineers with fintech/payments/banking experience
- **Healthcare** - 8 engineers with healthcare/pharma compliance experience
- **E-commerce** - 7 engineers with e-commerce experience
- **Streaming/Media** - 2 engineers (Wei, Sanjay) with high-scale streaming

## Code References

- `seeds/engineers.ts:1-500` - Engineer definitions with seniority, salary, timeline, timezone
- `seeds/engineers.ts:512-965` - UserSkill definitions with proficiency and confidence
- `seeds/engineers.ts:973-1100` - Business and Technical Domain Experience
- `seeds/resumes.ts:28-263` - Core engineer resumes and work experiences
- `seeds/resumes.ts:352-681` - Junior engineer resumes and work experiences
- `seeds/skills.ts` - Skill definitions with type (technical/behavioral)
- `seeds/companies.ts` - Company definitions for normalization
- `seeds/domains.ts` - Business and Technical domain definitions
- `seeds/types.ts` - Type definitions for all seed entities

## Architecture Insights

1. **Skill Confidence Model**: Confidence scores (0-1) differentiate between engineers with same proficiency level. This enables nuanced matching (e.g., "expert React with 0.92 confidence" vs "expert React with 0.80 confidence").

2. **Multi-Dimensional Domain Experience**: Engineers have both technical domain experience (e.g., "frontend", "distributed systems") and business domain experience (e.g., "fintech", "healthcare"), enabling precise job matching.

3. **Work Experience → Skill Links**: Skills are linked to specific work experiences, enabling queries like "engineers who used Kafka at a fintech company."

4. **Validation Freshness**: `lastValidated` dates on skills indicate recency. Coasting seniors have older validation dates, enabling freshness-aware matching.

5. **Resume Text Generation**: Full resume text is generated for content-based matching using TF-IDF and embeddings.

## Recommendations for Job Description Seeding

1. **Create roles at each seniority level** to test matching across the full spectrum
2. **Include fintech, healthcare, and e-commerce roles** as these have the most engineer coverage
3. **Create specialist roles** (ML, Security, Platform) to test deep skill matching
4. **Include startup generalist roles** to test breadth-based matching
5. **Create roles requiring specific company experience** (e.g., "ex-FAANG preferred")
6. **Include roles with compliance requirements** (HIPAA, PCI-DSS) for healthcare/fintech matching

## Open Questions

1. Should job descriptions include salary ranges for matching against engineer salary expectations?
2. Should jobs have their own "required confidence scores" for skills?
3. How should we handle "nice-to-have" vs "required" skills in job descriptions?
4. Should job descriptions reference specific companies as "preferred experience"?
