# Resume Text Generation for Seeded Engineers - Implementation Plan

## Overview

Create realistic resume text for each of the 38 seeded engineers that looks exactly like text extracted from a PDF resume. Each resume should reflect the engineer's skills, experience, domain expertise, and archetype (e.g., high-performing mid-level, coasting senior, big-tech specialist, startup generalist).

**Additionally**, seed the graph data (WorkExperience, Company relationships, UserSkill USED_AT links) that would be created if these resumes were uploaded via the `/api/resume/upload` endpoint. This ensures the seeded data matches what exists when resumes are processed through the normal upload flow.

## Current State Analysis

We have 38 engineers seeded in `seeds/engineers.ts` with:
- Basic info: name, email, headline, salary, yearsExperience, startTimeline, timezone
- Skills with proficiency levels and years used (via `userSkills`)
- Business domain experience (via `engineerBusinessDomainExperience`)
- Technical domain experience (via `engineerTechnicalDomainExperience`)

The engineers are grouped by seniority with distinct archetypes:
- **Junior (0-3 years)**: 6 engineers - Maya, Kevin, Jordan, Carlos, Ashley, Tyler
- **Mid-Level (4-5 years)**: 8 engineers - Rachel (high-performing), Lisa (high-performing), Zoe (startup generalist), David, Mohammed, Aisha, Ryan, Emma
- **Senior (6-8 years)**: 10 engineers - Greg (coasting), Natasha (coasting), Nathan (big-tech specialist), Wei (big-tech specialist), Derek (startup generalist), Takeshi, Sarah, Ravi, Olivia, Lucas
- **Staff (9-11 years)**: 8 engineers - Anika, Alex, Dmitri, Jennifer, Michael, Sanjay, Christine, Hassan
- **Principal (12+ years)**: 3 engineers - Victoria, Robert, Elena
- **Original Core**: 5 engineers - Priya, Marcus, Sofia, James, Emily

### Resume Upload Data Model (from Phase 1 of content-based-filtering plan)

When a resume is uploaded via the API, the following data is created:

```cypher
// 1. Resume node
(Engineer)-[:HAS_RESUME]->(Resume {text: "..."})

// 2. Work experience chain
(Engineer)-[:HAD_ROLE]->(WorkExperience)-[:AT_COMPANY]->(Company)

// 3. Skills linked to work experiences
(Engineer)-[:HAS]->(UserSkill)-[:FOR]->(Skill)
(UserSkill)-[:USED_AT]->(WorkExperience)  // Optional - skills can exist without job link
```

## Desired End State

A new seed file `seeds/resumes.ts` that exports:
1. `engineerResumes: EngineerResume[]` - resume text for each engineer
2. `engineerWorkExperiences: EngineerWorkExperience[]` - work history for each engineer
3. `workExperienceSkillLinks: WorkExperienceSkillLink[]` - links between existing UserSkills and WorkExperiences

The resume text should look like realistic text extracted from a PDF resume, and the structured data should match what the resume text describes.

### Resume Text Format

Each resume should include (in a realistic extracted text format):
- Contact information (name, email, location based on timezone, phone)
- Professional Summary (2-3 sentences based on headline and archetype)
- Work Experience (2-4 jobs with realistic companies, dates, and bullet points)
- Education (university, degree, graduation year)
- Skills section (grouped by category)

### Key Discoveries

1. **Archetype-appropriate language**:
   - High performers: emphasize impact, achievements, metrics
   - Coasting seniors: reliability-focused, maintenance, stable systems
   - Big-tech specialists: deep expertise in narrow area, scale
   - Startup generalists: breadth, ownership, wore many hats, 0→1

2. **Company alignment**:
   - Use `seeds/companies.ts` known companies (Stripe, Netflix, Meta, etc.) where appropriate for headlines
   - Create realistic fictional companies for other roles
   - Match company type to engineer archetype (startups for generalists, FAANG for specialists)

3. **Skill alignment**:
   - Resume skills must match what's in `userSkills`
   - Years of experience in skills should be consistent with job durations
   - `USED_AT` links connect existing UserSkill nodes to WorkExperience nodes

4. **Domain alignment**:
   - Business domains should match previous employer industries
   - Technical domains should be reflected in job responsibilities

## What We're NOT Doing

- Not creating PDF files - just realistic text that looks like it was extracted from a PDF
- Not modifying existing `userSkills` - only creating `USED_AT` links to WorkExperiences
- Not generating fake phone numbers with real area codes - use placeholder format
- Not re-seeding skills - just linking existing UserSkill nodes to WorkExperiences

## Implementation Approach

Create a single new file `seeds/resumes.ts` with:
1. Type definitions for the resume and work experience structures
2. Resume text data for all 38 engineers
3. Work experience data that matches the resume text
4. Skill-to-work-experience links using existing skill IDs from `engineers.ts`

The seeding function will:
1. Create Resume nodes linked to Engineers
2. Create WorkExperience nodes linked to Companies
3. Create USED_AT relationships between existing UserSkill nodes and WorkExperience nodes

### Why Skill Normalization Isn't Needed

Unlike the API upload flow which must normalize arbitrary skill names from resume text (e.g., "JS" → `skill_javascript`), the seed approach doesn't require normalization because:

| API Upload Flow | Seed Flow |
|-----------------|-----------|
| Resume text → LLM extraction → "JS" found | We write resume text with "JS" |
| Normalize "JS" → `skill_javascript` | We directly use existing `es_priya_javascript` |
| Create new UserSkill → USED_AT → WorkExperience | Create USED_AT between *existing* UserSkill and new WorkExperience |

**Key insight:** We're *authoring* the data, not *extracting* it. The `workExperienceSkillLinks` array directly references the existing `userSkillId` values from `engineers.ts` (e.g., `es_priya_typescript`). These already point to canonical skills via the existing `(UserSkill)-[:FOR]->(Skill)` relationships.

The resume text can say "JS", "JavaScript", or "ECMAScript" - it doesn't matter for the graph structure because:
1. The `USED_AT` relationship is created using existing canonical skill IDs
2. The resume text is used for TF-IDF/embedding search, not for skill graph construction
3. Both the resume text and structured data are authored together, ensuring consistency by design

---

## Phase 1: Create Resume Seed File Structure

### Overview

Create the file structure and type definitions.

### Changes Required

#### 1. Create `seeds/resumes.ts`

**File**: `seeds/resumes.ts`

```typescript
import { Session } from 'neo4j-driver';

interface EngineerResume {
  engineerId: string;
  resumeText: string;
}

interface EngineerWorkExperience {
  id: string;                    // e.g., "we_priya_stripe"
  engineerId: string;            // e.g., "eng_priya"
  companyName: string;           // e.g., "Stripe"
  title: string;                 // e.g., "Senior Software Engineer"
  seniority: 'junior' | 'mid' | 'senior' | 'staff' | 'principal';
  startDate: string;             // "2021-01" or "2021"
  endDate: string | 'present';   // "2023-06" or "present"
  highlights: string[];          // Key accomplishments
}

interface WorkExperienceSkillLink {
  userSkillId: string;           // e.g., "es_priya_typescript" (from engineers.ts)
  workExperienceId: string;      // e.g., "we_priya_stripe"
}

export const engineerResumes: EngineerResume[] = [
  // Resumes will be added here
];

export const engineerWorkExperiences: EngineerWorkExperience[] = [
  // Work experiences will be added here
];

export const workExperienceSkillLinks: WorkExperienceSkillLink[] = [
  // Skill-to-work-experience links will be added here
];

export async function seedResumes(session: Session): Promise<void> {
  // 1. Create Resume nodes linked to Engineers
  for (const resume of engineerResumes) {
    await session.run(`
      MATCH (e:Engineer {id: $engineerId})
      MERGE (r:Resume {engineerId: $engineerId})
      ON CREATE SET r.text = $text, r.createdAt = datetime()
      ON MATCH SET r.text = $text, r.updatedAt = datetime()
      MERGE (e)-[:HAS_RESUME]->(r)
    `, {
      engineerId: resume.engineerId,
      text: resume.resumeText,
    });
  }
  console.log(`[Seed] Created ${engineerResumes.length} engineer resumes`);

  // 2. Create WorkExperience nodes linked to Companies and Engineers
  for (const workExp of engineerWorkExperiences) {
    // First ensure company exists (MERGE to handle both known and new companies)
    const normalizedCompanyName = workExp.companyName.toLowerCase();

    await session.run(`
      MERGE (c:Company {normalizedName: $normalizedName})
      ON CREATE SET c.id = randomUUID(), c.name = $companyName, c.type = 'unknown'
    `, {
      normalizedName: normalizedCompanyName,
      companyName: workExp.companyName,
    });

    // Create WorkExperience and link to Engineer and Company
    await session.run(`
      MATCH (e:Engineer {id: $engineerId})
      MATCH (c:Company {normalizedName: $normalizedName})
      MERGE (we:WorkExperience {id: $workExpId})
      ON CREATE SET
        we.title = $title,
        we.seniority = $seniority,
        we.startDate = $startDate,
        we.endDate = $endDate,
        we.highlights = $highlights,
        we.createdAt = datetime()
      ON MATCH SET
        we.title = $title,
        we.seniority = $seniority,
        we.startDate = $startDate,
        we.endDate = $endDate,
        we.highlights = $highlights,
        we.updatedAt = datetime()
      MERGE (e)-[:HAD_ROLE]->(we)
      MERGE (we)-[:AT_COMPANY]->(c)
    `, {
      engineerId: workExp.engineerId,
      normalizedName: normalizedCompanyName,
      workExpId: workExp.id,
      title: workExp.title,
      seniority: workExp.seniority,
      startDate: workExp.startDate,
      endDate: workExp.endDate,
      highlights: workExp.highlights,
    });
  }
  console.log(`[Seed] Created ${engineerWorkExperiences.length} work experiences`);

  // 3. Create USED_AT relationships between UserSkills and WorkExperiences
  for (const link of workExperienceSkillLinks) {
    await session.run(`
      MATCH (us:UserSkill {id: $userSkillId})
      MATCH (we:WorkExperience {id: $workExpId})
      MERGE (us)-[:USED_AT]->(we)
    `, {
      userSkillId: link.userSkillId,
      workExpId: link.workExperienceId,
    });
  }
  console.log(`[Seed] Created ${workExperienceSkillLinks.length} skill-to-work-experience links`);
}
```

### Success Criteria

#### Automated Verification:
- [x] File compiles: `npm run typecheck`
- [x] File can be imported

---

## Phase 2: Generate Data for All 38 Engineers

### Overview

Create realistic resume text, work experience data, and skill links for each engineer based on their seeded data.

### Resume Template Structure

Each resume should follow this general structure (as extracted text would appear):

```
[NAME]
[EMAIL] | [PHONE] | [LOCATION]

SUMMARY
[2-3 sentence professional summary]

EXPERIENCE

[COMPANY NAME] | [LOCATION]
[TITLE] | [DATE RANGE]
- [Bullet point about responsibility/achievement]
- [Bullet point about responsibility/achievement]
- [Bullet point about responsibility/achievement]

[PREVIOUS COMPANY] | [LOCATION]
[TITLE] | [DATE RANGE]
- [Bullet point]
- [Bullet point]

EDUCATION

[UNIVERSITY NAME]
[DEGREE] | [GRADUATION YEAR]

SKILLS
[Languages & Frameworks]: [skill1], [skill2], [skill3]
[Databases]: [skill1], [skill2]
[Infrastructure]: [skill1], [skill2]
```

### Data Consistency Requirements

For each engineer, the resume text, work experiences, and skill links must be consistent:

1. **Resume text skills** → Must match skills in `userSkills` from `engineers.ts`
2. **Resume job history** → Must match `engineerWorkExperiences` entries
3. **Skill USED_AT links** → Use the existing `userSkillId` from `engineers.ts` (e.g., `es_priya_typescript`)
4. **Total years** → Job durations must sum to approximately `yearsExperience`
5. **Companies** → Use known companies from `seeds/companies.ts` where appropriate

### Example Entry (Priya Sharma)

```typescript
// In engineerResumes array:
{
  engineerId: 'eng_priya',
  resumeText: `PRIYA SHARMA
priya.sharma@email.com | (617) 555-0142 | Boston, MA

SUMMARY
Senior Backend Engineer with 8 years of experience building scalable payment systems and financial infrastructure. Expert in TypeScript, Node.js, and designing high-throughput APIs for fintech applications. Led teams through multiple successful product launches processing millions in daily transactions.

EXPERIENCE

Stripe | San Francisco, CA (Remote)
Senior Software Engineer | Jan 2021 - Present
- Architected and implemented payment reconciliation system handling $50M+ daily transaction volume
- Led migration of legacy payment processing pipeline to event-driven architecture using Kafka
- Designed and built microservices for merchant onboarding, reducing integration time by 80%
- Mentored team of 4 junior engineers, conducting code reviews and establishing best practices

PayPal | Boston, MA
Software Engineer II | Mar 2018 - Dec 2020
- Developed REST APIs for payment gateway integration serving 10,000+ requests per second
- Implemented fraud detection rules engine using Python, blocking $2M+ in fraudulent transactions
- Built internal tooling for transaction monitoring and dispute resolution

Capital One | McLean, VA
Software Engineer | Jun 2016 - Feb 2018
- Built backend services for credit card rewards program using Node.js and PostgreSQL
- Developed automated testing framework reducing regression testing time by 60%
- Created APIs for mobile banking application serving 1M+ users

EDUCATION

Georgia Institute of Technology
B.S. Computer Science | 2016

SKILLS
Languages & Frameworks: TypeScript, Node.js, Python, Express, NestJS
Databases: PostgreSQL, Redis, Kafka
Infrastructure: AWS, Docker, Kubernetes
Architecture: Microservices, Event-Driven Architecture, REST API Design, System Design
Practices: Unit Testing, Code Review, Technical Leadership, Mentorship`,
},

// In engineerWorkExperiences array:
{
  id: 'we_priya_stripe',
  engineerId: 'eng_priya',
  companyName: 'Stripe',
  title: 'Senior Software Engineer',
  seniority: 'senior',
  startDate: '2021-01',
  endDate: 'present',
  highlights: [
    'Architected payment reconciliation system handling $50M+ daily',
    'Led Kafka migration reducing latency by 40%',
    'Mentored team of 4 junior engineers',
  ],
},
{
  id: 'we_priya_paypal',
  engineerId: 'eng_priya',
  companyName: 'PayPal',
  title: 'Software Engineer II',
  seniority: 'mid',
  startDate: '2018-03',
  endDate: '2020-12',
  highlights: [
    'Developed REST APIs serving 10K+ RPS',
    'Implemented fraud detection blocking $2M+ annually',
  ],
},
{
  id: 'we_priya_capitalone',
  engineerId: 'eng_priya',
  companyName: 'Capital One',
  title: 'Software Engineer',
  seniority: 'junior',
  startDate: '2016-06',
  endDate: '2018-02',
  highlights: [
    'Built backend services for rewards program',
    'Created APIs for mobile banking app',
  ],
},

// In workExperienceSkillLinks array:
// Link Priya's skills to the work experiences where she used them
{ userSkillId: 'es_priya_typescript', workExperienceId: 'we_priya_stripe' },
{ userSkillId: 'es_priya_nodejs', workExperienceId: 'we_priya_stripe' },
{ userSkillId: 'es_priya_nodejs', workExperienceId: 'we_priya_paypal' },
{ userSkillId: 'es_priya_kafka', workExperienceId: 'we_priya_stripe' },
{ userSkillId: 'es_priya_postgresql', workExperienceId: 'we_priya_stripe' },
{ userSkillId: 'es_priya_postgresql', workExperienceId: 'we_priya_paypal' },
{ userSkillId: 'es_priya_postgresql', workExperienceId: 'we_priya_capitalone' },
{ userSkillId: 'es_priya_aws', workExperienceId: 'we_priya_stripe' },
{ userSkillId: 'es_priya_microservices', workExperienceId: 'we_priya_stripe' },
{ userSkillId: 'es_priya_api_design', workExperienceId: 'we_priya_stripe' },
{ userSkillId: 'es_priya_api_design', workExperienceId: 'we_priya_paypal' },
{ userSkillId: 'es_priya_system_design', workExperienceId: 'we_priya_stripe' },
{ userSkillId: 'es_priya_tech_leadership', workExperienceId: 'we_priya_stripe' },
{ userSkillId: 'es_priya_mentorship', workExperienceId: 'we_priya_stripe' },
```

### Engineer-Specific Approach

For each engineer, create data that:
1. Matches their total years of experience
2. Reflects their business domain experience
3. Uses their technical skills appropriately
4. Matches their archetype in tone and content
5. Uses existing `userSkillId` values from `engineers.ts`

### Success Criteria

#### Automated Verification:
- [x] File compiles: `npm run typecheck`
- [x] All 40 engineers have resumes (40 engineers in seed data, not 38)
- [x] All engineer IDs match those in `engineers.ts`
- [x] All userSkillIds in skill links match those in `engineers.ts`

#### Manual Verification:
- [x] Resume text looks realistic when read (verified: proper format with name, contact, summary, experience, education, skills)
- [x] Skills mentioned match engineer's skill set (verified: Priya's skills correctly linked to Stripe, PayPal, Capital One)
- [x] Work history duration matches yearsExperience (verified: Maya 2yrs, Rachel 5yrs, Greg 7yrs, Anika 10yrs, Victoria 14yrs)
- [x] Company types match archetype expectations:
  - Big-tech specialists (Nathan, Wei): Meta, Netflix, LinkedIn, Uber, Anthropic, Confluent
  - Startup generalists (Zoe, Derek): YC startups, Fintech Series B, acquired startups
  - Coasting seniors (Greg, Natasha): Enterprise SaaS, EdTech, Consulting firms

---

## Phase 3: Integrate with Seed System

### Overview

Add the resume seeding to the main seed process.

### Changes Required

#### 1. Update `seeds/seed.ts`

**File**: `seeds/seed.ts`

Import and call the `seedResumes` function in the appropriate place in the seeding sequence. It must run AFTER engineers and userSkills are seeded.

```typescript
import { seedResumes } from './resumes.js';

// In the seed function, AFTER engineer and skill seeding:
await seedResumes(session);
```

#### 2. Update `seeds/index.ts`

**File**: `seeds/index.ts`

Export the new module.

```typescript
export * from './resumes.js';
```

### Success Criteria

#### Automated Verification:
- [x] Seed runs without errors
- [x] `MATCH (r:Resume) RETURN count(r)` returns 40 ✓
- [x] `MATCH (e:Engineer)-[:HAS_RESUME]->(r:Resume) RETURN count(e)` returns 40 ✓
- [x] `MATCH (we:WorkExperience) RETURN count(we)` returns 112 (2-3 per engineer) ✓
- [x] `MATCH (us:UserSkill)-[:USED_AT]->(we:WorkExperience) RETURN count(us)` returns 464 ✓

---

## Testing Strategy

### Unit Tests:
- None needed - this is seed data

### Integration Tests:
- [x] Verify seed creates Resume nodes (40 Resume nodes created)
- [x] Verify Resume nodes are linked to Engineers (40 HAS_RESUME relationships)
- [x] Verify WorkExperience nodes are created and linked to Companies (112 WorkExperience nodes)
- [x] Verify USED_AT relationships exist between UserSkills and WorkExperiences (464 links)

### Manual Testing Steps (verified programmatically):
1. [x] Run seed via Tilt (automatic) - seed ran successfully
2. [x] Query Neo4j to verify resumes exist - verified 5 sample resumes with proper format
3. [x] Verify work experiences - Priya's work history: Stripe (senior), PayPal (mid), Capital One (junior)
4. [x] Verify skill links - Priya's skills correctly linked (TypeScript, Node.js, Kafka at Stripe; PostgreSQL at all three)

## References

- Research document: `thoughts/private/research/2026-01-22-seeded-engineers-and-skills.md`
- Content-based filtering plan: `thoughts/private/plans/2026-01-21-content-based-resume-filtering.md`
- Resume upload service: `recommender_api/src/services/resume-processor/resume-upload.service.ts`
- Engineer seed data: `seeds/engineers.ts:15-491`
- User skills data: `seeds/engineers.ts:512-965`
- Skills data: `seeds/skills.ts:11-138`
- Domain data: `seeds/domains.ts`
- Company data: `seeds/companies.ts`
