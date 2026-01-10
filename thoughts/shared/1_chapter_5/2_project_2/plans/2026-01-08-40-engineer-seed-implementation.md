# 40-Engineer Seed Data Implementation Plan

## Overview

Expand the seed data from 5 engineers to 40 engineers to enable meaningful constraint relaxation scenarios for Project 2. **All engineers are US-based** to simplify the talent marketplace model.

**Note:** This plan diverges from `research/2026-01-08-40-engineer-seed-specification.md` which specified international engineers. The constraint relaxation scenarios remain valid with US-timezone diversity. James Okonkwo (originally Europe/London) will be moved to America/New_York in Phase 0.

## Current State Analysis

### Existing Data (5 engineers)
| File | Current Records |
|------|-----------------|
| `seeds/engineers.ts` - Engineers | 5 |
| `seeds/engineers.ts` - UserSkills | 51 |
| `seeds/engineers.ts` - Business Domain Experience | 6 |
| `seeds/engineers.ts` - Technical Domain Experience | 10 |
| `seeds/stories.ts` - Interview Stories | 8 |
| `seeds/stories.ts` - Story Analyses | 8 |
| `seeds/stories.ts` - Story Demonstrations | 37 |
| `seeds/assessments.ts` - Assessments | 4 |
| `seeds/assessments.ts` - Assessment Questions | 11 |
| `seeds/assessments.ts` - Assessment Attempts | 5 |
| `seeds/assessments.ts` - Question Performances | 15 |
| `seeds/assessments.ts` - Certifications | 5 |
| `seeds/assessments.ts` - Engineer Certifications | 6 |
| `seeds/assessments.ts` - Skill Evidence | 25 |

### Target Data (40 engineers)
| File | Target Records | Delta |
|------|----------------|-------|
| Engineers | 40 | +35 |
| UserSkills | ~400 (10/engineer) | +338 |
| Business Domain Experience | ~60 | +54 |
| Technical Domain Experience | ~80 | +70 |
| Interview Stories | 80 (2/engineer) | +72 |
| Story Analyses | 80 | +72 |
| Story Demonstrations | ~300 (3-4/story) | +263 |
| Assessments | 7 (+Full Stack, ML, Mobile) | +3 |
| Assessment Attempts | 40 | +35 |
| Question Performances | ~100 | +85 |
| Certifications | ~15 | +10 |
| Engineer Certifications | ~50 | +44 |
| Skill Evidence | ~160 | +135 |

## Desired End State

After implementation:
1. **40 engineers** with complete profiles covering all availability tiers, **US timezones**, experience levels, and domains
2. **Full evidence chains** for every engineer (skills → stories → assessments → certifications)
3. **Constraint relaxation scenarios** work as specified in the research documents
4. **Seeding completes successfully** with `npm run seed` or category-based seeding
5. **All engineers in US timezones**: America/New_York, America/Los_Angeles, America/Chicago, America/Denver, America/Phoenix, America/Seattle

### Verification
- Run `npm run seed` - should complete without errors
- Run `MATCH (e:Engineer) RETURN count(e)` in Neo4j - should return 40
- Run `MATCH (e:Engineer) WHERE NOT e.timezone STARTS WITH 'America/' RETURN count(e)` - should return 0
- Run test query from spec: `{ requiredSkills: ['Kubernetes', 'Kafka'], minConfidenceScore: 0.9, minYearsExperience: 10, availability: 'immediate' }` - should return Anika Patel or suggest relaxation paths

## What We're NOT Doing

1. **Not changing types** - All existing types in `types.ts` remain unchanged
2. **Not modifying seed.ts logic** - The seeding functions already support the new data
3. **Not adding new skills** - Using existing skills from `skills.ts`
4. **Not adding new domains** - Using existing domains from `domains.ts`
5. **Not changing the API** - This is purely seed data expansion
6. **Not adding international engineers** - All engineers are US-based

## Implementation Approach

Add engineers in batches organized by experience level to maintain consistency with the specification. For each engineer, add the complete evidence chain (skills, domain experience, stories, assessments, certifications) before moving to the next batch.

**Key principle:** Every engineer gets a complete, realistic profile. No sparse data.

---

## Archetype Diversity

Real engineering talent doesn't fit neatly into experience buckets. The seed data should represent these real-world patterns:

### Experience-Confidence Decoupling

| Archetype | YoE | Confidence Range | Rationale |
|-----------|-----|------------------|-----------|
| High-performing mid-level | 4-5 | 0.88-0.92 | Fast growth at demanding companies |
| Coasting senior | 6-8 | 0.78-0.84 | Competent but not pushing boundaries |
| Standard progression | varies | matches tier | Typical career trajectory |

This creates interesting constraint relaxation paths - a search for "senior React engineer" might surface a strong mid-level as a valid alternative.

### Startup Generalist vs Big-Tech Specialist

| Dimension | Startup Generalist | Big-Tech Specialist |
|-----------|-------------------|---------------------|
| **Skill count** | 10-14 skills | 5-7 skills |
| **Confidence pattern** | 0.75-0.85 across many | 0.88-0.95 in few |
| **Soft skills** | Ownership ↑, adaptability ↑ | Mentorship ↑, documentation ↑ |
| **Headlines** | "Founding Engineer", "0→1" | "Ex-FAANG", "[Team] Infrastructure" |
| **Domain experience** | 3-4 business domains | 1-2 deep domains |

### Archetype Distribution in Phases

- **Phase 2 (Mid-level)**: Include 2 high-performing mid-levels, 1 startup generalist
- **Phase 3 (Senior)**: Include 2 coasting seniors, 2 big-tech specialists, 1 startup generalist

---

## Phase 0: Pre-Implementation Fixes

### Overview
Before adding new engineers, fix existing codebase issues identified during plan verification. These changes ensure the seed infrastructure supports the new data.

### Changes Required:

#### 1. Add Missing Mobile Development Skills
**File**: `seeds/skills.ts`

Add after existing technical skills:

```typescript
// Mobile Development Skills
{ id: 'skill_react_native', name: 'React Native', skillType: 'technical', description: 'Cross-platform mobile development with React Native' },
{ id: 'skill_swift', name: 'Swift', skillType: 'technical', description: 'iOS native development with Swift' },
{ id: 'skill_kotlin', name: 'Kotlin', skillType: 'technical', description: 'Android native development with Kotlin' },
{ id: 'skill_firebase', name: 'Firebase', skillType: 'technical', description: 'Google Firebase platform services' },
```

#### 2. Add Missing Data/ML Skills
**File**: `seeds/skills.ts`

```typescript
// Data Engineering Skills
{ id: 'skill_spark', name: 'Apache Spark', skillType: 'technical', description: 'Distributed data processing with Spark' },

// ML Skills
{ id: 'skill_tensorflow', name: 'TensorFlow', skillType: 'technical', description: 'Deep learning with TensorFlow' },
```

#### 3. Add Missing Soft Skills
**File**: `seeds/skills.ts`

```typescript
// Leadership/Hiring Skills
{ id: 'skill_hiring', name: 'Hiring & Interviewing', skillType: 'behavioral', description: 'Technical hiring and interview skills' },
{ id: 'skill_performance_optimization', name: 'Performance Optimization', skillType: 'technical', description: 'System and application performance tuning' },
```

#### 4. Fix James Okonkwo Timezone
**File**: `seeds/engineers.ts`

Change James's timezone from `Europe/London` to `America/New_York`:

```typescript
// Before
{
  id: 'eng_james',
  name: 'James Okonkwo',
  timezone: 'Europe/London',
  ...
}

// After
{
  id: 'eng_james',
  name: 'James Okonkwo',
  timezone: 'America/New_York',
  ...
}
```

#### 5. Fix EngineerCertification `acquiredAt` Field
**File**: `seeds/assessments.ts`

The type definition requires `acquiredAt` but existing seed data is missing it. Update existing entries:

```typescript
// Before
{ engineerId: 'eng_priya', certificationId: 'cert_aws_saa' },

// After
{ engineerId: 'eng_priya', certificationId: 'cert_aws_saa', acquiredAt: daysAgo(180) },
```

Update all existing `engineerCertifications` entries to include `acquiredAt`.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] All 8 new skills exist in skills.ts
- [x] James Okonkwo has `America/New_York` timezone
- [x] All engineerCertifications have `acquiredAt` field

#### Manual Verification:
- [x] Seeding completes successfully: `npm run seed`
- [x] Neo4j query `MATCH (e:Engineer {id: 'eng_james'}) RETURN e.timezone` returns `America/New_York`

---

## Phase 1: Add Junior Engineers (0-3 years) — 6 new engineers

### Overview
Add 6 US-based junior engineers. These provide budget-conscious options and fill the junior experience gap.

### Changes Required:

#### 1. Add Junior Engineer Records
**File**: `seeds/engineers.ts`
**Section**: `engineers` array

Add these 6 engineers after the existing 5:

```typescript
// Junior Engineers (0-3 years) — 6 new (all US-based)
{
  id: 'eng_maya',
  name: 'Maya Johnson',
  email: 'maya.johnson@email.com',
  headline: 'Frontend Engineer | React & TypeScript',
  salary: 95000,
  yearsExperience: 2,
  startTimeline: 'immediate',
  timezone: 'America/New_York',
  createdAt: daysAgo(30),
},
{
  id: 'eng_kevin',
  name: 'Kevin Park',
  email: 'kevin.park@email.com',
  headline: 'Backend Engineer | Python & Django',
  salary: 105000,
  yearsExperience: 3,
  startTimeline: 'two_weeks',
  timezone: 'America/Los_Angeles',
  createdAt: daysAgo(45),
},
{
  id: 'eng_jordan',
  name: 'Jordan Williams',
  email: 'jordan.williams@email.com',
  headline: 'Frontend Developer | React & Tailwind',
  salary: 90000,
  yearsExperience: 2,
  startTimeline: 'immediate',
  timezone: 'America/Chicago',
  createdAt: daysAgo(60),
},
{
  id: 'eng_carlos',
  name: 'Carlos Mendez',
  email: 'carlos.mendez@email.com',
  headline: 'Full Stack Developer | Node.js & React',
  salary: 85000,
  yearsExperience: 3,
  startTimeline: 'one_month',
  timezone: 'America/Denver',
  createdAt: daysAgo(55),
},
{
  id: 'eng_ashley',
  name: 'Ashley Chen',
  email: 'ashley.chen@email.com',
  headline: 'Frontend Developer | Vue.js',
  salary: 88000,
  yearsExperience: 1,
  startTimeline: 'immediate',
  timezone: 'America/Seattle',
  createdAt: daysAgo(20),
},
{
  id: 'eng_tyler',
  name: 'Tyler Brooks',
  email: 'tyler.brooks@email.com',
  headline: 'Backend Developer | Java & Spring Boot',
  salary: 98000,
  yearsExperience: 3,
  startTimeline: 'two_weeks',
  timezone: 'America/Phoenix',
  createdAt: daysAgo(35),
},
```

#### 2. Add Junior Engineer Skills
**File**: `seeds/engineers.ts`
**Section**: `userSkills` array

Add 8-10 skills per junior engineer with appropriate confidence scores (0.65-0.82 range for juniors):

```typescript
// Maya - Frontend Junior (React focus, NYC)
{ id: 'es_maya_react', engineerId: 'eng_maya', skillId: 'skill_react', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.78, lastValidated: daysAgo(8) },
{ id: 'es_maya_typescript', engineerId: 'eng_maya', skillId: 'skill_typescript', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.75, lastValidated: daysAgo(8) },
{ id: 'es_maya_javascript', engineerId: 'eng_maya', skillId: 'skill_javascript', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.80, lastValidated: daysAgo(8) },
{ id: 'es_maya_nextjs', engineerId: 'eng_maya', skillId: 'skill_nextjs', proficiencyLevel: 'learning', yearsUsed: 1, confidenceScore: 0.65, lastValidated: daysAgo(8) },
{ id: 'es_maya_unit_testing', engineerId: 'eng_maya', skillId: 'skill_unit_testing', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.72, lastValidated: daysAgo(8) },
{ id: 'es_maya_learning', engineerId: 'eng_maya', skillId: 'skill_learning', proficiencyLevel: 'expert', yearsUsed: 2, confidenceScore: 0.85, lastValidated: daysAgo(8) },
{ id: 'es_maya_curiosity', engineerId: 'eng_maya', skillId: 'skill_curiosity', proficiencyLevel: 'expert', yearsUsed: 2, confidenceScore: 0.82, lastValidated: daysAgo(8) },
{ id: 'es_maya_attention_detail', engineerId: 'eng_maya', skillId: 'skill_attention_detail', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.78, lastValidated: daysAgo(8) },

// Kevin - Backend Junior (Python focus, LA)
{ id: 'es_kevin_python', engineerId: 'eng_kevin', skillId: 'skill_python', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.80, lastValidated: daysAgo(12) },
{ id: 'es_kevin_django', engineerId: 'eng_kevin', skillId: 'skill_django', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.75, lastValidated: daysAgo(12) },
{ id: 'es_kevin_postgresql', engineerId: 'eng_kevin', skillId: 'skill_postgresql', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.72, lastValidated: daysAgo(12) },
{ id: 'es_kevin_docker', engineerId: 'eng_kevin', skillId: 'skill_docker', proficiencyLevel: 'learning', yearsUsed: 1, confidenceScore: 0.65, lastValidated: daysAgo(12) },
{ id: 'es_kevin_api_design', engineerId: 'eng_kevin', skillId: 'skill_api_design', proficiencyLevel: 'learning', yearsUsed: 1, confidenceScore: 0.68, lastValidated: daysAgo(12) },
{ id: 'es_kevin_unit_testing', engineerId: 'eng_kevin', skillId: 'skill_unit_testing', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.75, lastValidated: daysAgo(12) },
{ id: 'es_kevin_ownership', engineerId: 'eng_kevin', skillId: 'skill_ownership', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.78, lastValidated: daysAgo(12) },
{ id: 'es_kevin_learning', engineerId: 'eng_kevin', skillId: 'skill_learning', proficiencyLevel: 'expert', yearsUsed: 3, confidenceScore: 0.85, lastValidated: daysAgo(12) },

// Jordan - Frontend Junior (React + Tailwind, Chicago)
{ id: 'es_jordan_react', engineerId: 'eng_jordan', skillId: 'skill_react', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.76, lastValidated: daysAgo(15) },
{ id: 'es_jordan_typescript', engineerId: 'eng_jordan', skillId: 'skill_typescript', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.74, lastValidated: daysAgo(15) },
{ id: 'es_jordan_javascript', engineerId: 'eng_jordan', skillId: 'skill_javascript', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.78, lastValidated: daysAgo(15) },
{ id: 'es_jordan_attention_detail', engineerId: 'eng_jordan', skillId: 'skill_attention_detail', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.80, lastValidated: daysAgo(15) },
{ id: 'es_jordan_cross_functional', engineerId: 'eng_jordan', skillId: 'skill_cross_functional', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.75, lastValidated: daysAgo(15) },
{ id: 'es_jordan_learning', engineerId: 'eng_jordan', skillId: 'skill_learning', proficiencyLevel: 'expert', yearsUsed: 2, confidenceScore: 0.82, lastValidated: daysAgo(15) },

// Carlos - Full Stack Junior (Node + React, Denver)
{ id: 'es_carlos_nodejs', engineerId: 'eng_carlos', skillId: 'skill_nodejs', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.78, lastValidated: daysAgo(18) },
{ id: 'es_carlos_react', engineerId: 'eng_carlos', skillId: 'skill_react', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.75, lastValidated: daysAgo(18) },
{ id: 'es_carlos_mongodb', engineerId: 'eng_carlos', skillId: 'skill_mongodb', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.72, lastValidated: daysAgo(18) },
{ id: 'es_carlos_express', engineerId: 'eng_carlos', skillId: 'skill_express', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.74, lastValidated: daysAgo(18) },
{ id: 'es_carlos_javascript', engineerId: 'eng_carlos', skillId: 'skill_javascript', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.80, lastValidated: daysAgo(18) },
{ id: 'es_carlos_docker', engineerId: 'eng_carlos', skillId: 'skill_docker', proficiencyLevel: 'learning', yearsUsed: 1, confidenceScore: 0.62, lastValidated: daysAgo(18) },
{ id: 'es_carlos_ownership', engineerId: 'eng_carlos', skillId: 'skill_ownership', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.76, lastValidated: daysAgo(18) },
{ id: 'es_carlos_adaptability', engineerId: 'eng_carlos', skillId: 'skill_adaptability', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.78, lastValidated: daysAgo(18) },

// Ashley - Frontend Junior (Vue focus, Seattle)
{ id: 'es_ashley_vue', engineerId: 'eng_ashley', skillId: 'skill_vue', proficiencyLevel: 'proficient', yearsUsed: 1, confidenceScore: 0.72, lastValidated: daysAgo(5) },
{ id: 'es_ashley_javascript', engineerId: 'eng_ashley', skillId: 'skill_javascript', proficiencyLevel: 'proficient', yearsUsed: 1, confidenceScore: 0.75, lastValidated: daysAgo(5) },
{ id: 'es_ashley_typescript', engineerId: 'eng_ashley', skillId: 'skill_typescript', proficiencyLevel: 'learning', yearsUsed: 1, confidenceScore: 0.65, lastValidated: daysAgo(5) },
{ id: 'es_ashley_attention_detail', engineerId: 'eng_ashley', skillId: 'skill_attention_detail', proficiencyLevel: 'proficient', yearsUsed: 1, confidenceScore: 0.78, lastValidated: daysAgo(5) },
{ id: 'es_ashley_learning', engineerId: 'eng_ashley', skillId: 'skill_learning', proficiencyLevel: 'expert', yearsUsed: 1, confidenceScore: 0.88, lastValidated: daysAgo(5) },
{ id: 'es_ashley_curiosity', engineerId: 'eng_ashley', skillId: 'skill_curiosity', proficiencyLevel: 'expert', yearsUsed: 1, confidenceScore: 0.85, lastValidated: daysAgo(5) },

// Tyler - Backend Junior (Java/Spring, Phoenix)
{ id: 'es_tyler_java', engineerId: 'eng_tyler', skillId: 'skill_java', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.78, lastValidated: daysAgo(10) },
{ id: 'es_tyler_spring', engineerId: 'eng_tyler', skillId: 'skill_spring', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.74, lastValidated: daysAgo(10) },
{ id: 'es_tyler_mysql', engineerId: 'eng_tyler', skillId: 'skill_mysql', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.72, lastValidated: daysAgo(10) },
{ id: 'es_tyler_api_design', engineerId: 'eng_tyler', skillId: 'skill_api_design', proficiencyLevel: 'learning', yearsUsed: 1, confidenceScore: 0.68, lastValidated: daysAgo(10) },
{ id: 'es_tyler_unit_testing', engineerId: 'eng_tyler', skillId: 'skill_unit_testing', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.75, lastValidated: daysAgo(10) },
{ id: 'es_tyler_learning', engineerId: 'eng_tyler', skillId: 'skill_learning', proficiencyLevel: 'expert', yearsUsed: 3, confidenceScore: 0.85, lastValidated: daysAgo(10) },
{ id: 'es_tyler_ownership', engineerId: 'eng_tyler', skillId: 'skill_ownership', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.76, lastValidated: daysAgo(10) },
```

#### 3. Add Junior Engineer Domain Experience
**File**: `seeds/engineers.ts`
**Section**: `engineerBusinessDomainExperience` and `engineerTechnicalDomainExperience` arrays

```typescript
// Business Domain Experience
{ id: 'ebde_maya_saas', engineerId: 'eng_maya', businessDomainId: 'bd_saas', years: 2 },
{ id: 'ebde_kevin_saas', engineerId: 'eng_kevin', businessDomainId: 'bd_saas', years: 2 },
{ id: 'ebde_carlos_ecommerce', engineerId: 'eng_carlos', businessDomainId: 'bd_ecommerce', years: 2 },
{ id: 'ebde_tyler_fintech', engineerId: 'eng_tyler', businessDomainId: 'bd_fintech', years: 2 },

// Technical Domain Experience
{ id: 'etde_maya_frontend', engineerId: 'eng_maya', technicalDomainId: 'td_frontend', years: 2 },
{ id: 'etde_kevin_backend', engineerId: 'eng_kevin', technicalDomainId: 'td_backend', years: 3 },
{ id: 'etde_jordan_frontend', engineerId: 'eng_jordan', technicalDomainId: 'td_frontend', years: 2 },
{ id: 'etde_carlos_fullstack', engineerId: 'eng_carlos', technicalDomainId: 'td_fullstack', years: 3 },
{ id: 'etde_ashley_frontend', engineerId: 'eng_ashley', technicalDomainId: 'td_frontend', years: 1 },
{ id: 'etde_tyler_backend', engineerId: 'eng_tyler', technicalDomainId: 'td_backend', years: 3 },
```

#### 4. Add Junior Engineer Stories (2 per engineer)
**File**: `seeds/stories.ts`
**Section**: `interviewStories` array

Add 12 stories for the 6 junior engineers. Each story should be appropriate to their experience level - smaller scope projects, learning moments, collaboration stories.

Example for Maya:
```typescript
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
```

*(Similar pattern for Kevin, Jordan, Carlos, Ashley, Tyler - 2 stories each)*

#### 5. Add Junior Engineer Story Analyses and Demonstrations
**File**: `seeds/stories.ts`
**Sections**: `storyAnalyses` and `storyDemonstrations` arrays

For each story, add an analysis (slightly lower scores for juniors, 0.75-0.85 range) and 3-4 skill demonstrations.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run typecheck` in `seeds/` directory
- [x] Seeding completes successfully: `npm run seed` (or `npx tsx seeds/seed.ts`)
- [x] Neo4j query returns 11 engineers: `MATCH (e:Engineer) RETURN count(e)`
- [x] Junior skills have appropriate confidence scores (0.65-0.82)

#### Manual Verification:
- [x] Verify junior salary distribution: $85k-$105k range covers budget-constrained searches
- [x] Verify US timezone coverage: Maya (NYC), Kevin (LA), Jordan (Chicago), Carlos (Denver), Ashley (Seattle), Tyler (Phoenix)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Add Mid-Level Engineers (4-5 years) — 8 new engineers

### Overview
Add 8 US-based mid-level engineers. These fill gaps in Healthcare, ML, Mobile, and Gaming domains with good US timezone diversity.

**Archetype representation in this phase:**
- 2 high-performing mid-levels (Priya, Lisa) - 5 YoE with senior-level confidence
- 1 startup generalist (Zoe) - broad skills, high ownership
- 5 standard mid-levels

### Changes Required:

#### 1. Add Mid-Level Engineer Records
**File**: `seeds/engineers.ts`

```typescript
// Mid-Level Engineers (4-5 years) — 8 new (all US-based)

// HIGH-PERFORMING MID-LEVEL: Ex-Stripe, senior-level React confidence
{
  id: 'eng_priya',
  name: 'Priya Sharma',
  email: 'priya.sharma@email.com',
  headline: 'Frontend Engineer | Ex-Stripe, React Performance',
  salary: 165000,  // Higher than typical mid-level (recognized talent)
  yearsExperience: 5,
  startTimeline: 'two_weeks',
  timezone: 'America/New_York',
  createdAt: daysAgo(45),
},
// HIGH-PERFORMING MID-LEVEL: Deep Go expertise from high-scale environment
{
  id: 'eng_lisa',
  name: 'Lisa Wang',
  email: 'lisa.wang@email.com',
  headline: 'Backend Engineer | Ex-Cloudflare, Go & High-Scale Systems',
  salary: 160000,
  yearsExperience: 5,
  startTimeline: 'three_months',
  timezone: 'America/Seattle',
  createdAt: daysAgo(80),
},
// STARTUP GENERALIST: Broad skills, 0→1 experience
{
  id: 'eng_zoe',
  name: 'Zoe Martinez',
  email: 'zoe.martinez@email.com',
  headline: 'Founding Engineer | 0→1 at Two YC Startups',
  salary: 155000,
  yearsExperience: 5,
  startTimeline: 'immediate',
  timezone: 'America/Los_Angeles',
  createdAt: daysAgo(52),
},
// Standard mid-levels below
{
  id: 'eng_david',
  name: 'David Kim',
  email: 'david.kim@email.com',
  headline: 'Backend Engineer | Healthcare Systems & Python',
  salary: 145000,
  yearsExperience: 4,
  startTimeline: 'one_month',
  timezone: 'America/Los_Angeles',
  createdAt: daysAgo(70),
},
{
  id: 'eng_mohammed',
  name: 'Mohammed Ali',
  email: 'mohammed.ali@email.com',
  headline: 'DevOps Engineer | Kubernetes & Terraform',
  salary: 140000,
  yearsExperience: 4,
  startTimeline: 'two_weeks',
  timezone: 'America/Chicago',
  createdAt: daysAgo(65),
},
{
  id: 'eng_aisha',
  name: 'Aisha Patel',
  email: 'aisha.patel@email.com',
  headline: 'ML Engineer | Healthcare & Python',
  salary: 150000,
  yearsExperience: 5,
  startTimeline: 'one_month',
  timezone: 'America/Chicago',
  createdAt: daysAgo(55),
},
{
  id: 'eng_ryan',
  name: 'Ryan Zhang',
  email: 'ryan.zhang@email.com',
  headline: 'Mobile Developer | React Native & Gaming',
  salary: 125000,
  yearsExperience: 4,
  startTimeline: 'two_weeks',
  timezone: 'America/Denver',
  createdAt: daysAgo(48),
},
{
  id: 'eng_emma',
  name: 'Emma Wilson',
  email: 'emma.wilson@email.com',
  headline: 'Frontend Engineer | React & Design Systems',
  salary: 145000,
  yearsExperience: 5,
  startTimeline: 'immediate',
  timezone: 'America/Phoenix',
  createdAt: daysAgo(35),
},
```

#### 2. Add Mid-Level Engineer Skills, Domain Experience, Stories, Analyses, Demonstrations

**Standard mid-levels:** Follow Phase 1 pattern with 0.75-0.88 confidence range.

**High-performing mid-levels (Priya, Lisa):**
- Fewer skills (5-7) but senior-level confidence (0.88-0.92) in core areas
- Example for Priya:
  ```typescript
  { id: 'es_priya_react', engineerId: 'eng_priya', skillId: 'skill_react', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.92, lastValidated: daysAgo(5) },
  { id: 'es_priya_typescript', engineerId: 'eng_priya', skillId: 'skill_typescript', proficiencyLevel: 'expert', yearsUsed: 4, confidenceScore: 0.90, lastValidated: daysAgo(5) },
  { id: 'es_priya_performance', engineerId: 'eng_priya', skillId: 'skill_performance_optimization', proficiencyLevel: 'expert', yearsUsed: 3, confidenceScore: 0.88, lastValidated: daysAgo(5) },
  // Only 6-7 total skills - deep, not wide
  ```

**Startup generalist (Zoe):**
- Many skills (12-14) with moderate confidence (0.75-0.85)
- High ownership (0.92) and adaptability (0.90)
- Lower documentation (0.70) and code_review (0.72) - startup trade-offs
- Multiple business domains (3-4)
  ```typescript
  // Zoe's broad skill set (12+ skills, moderate confidence)
  { id: 'es_zoe_react', engineerId: 'eng_zoe', skillId: 'skill_react', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.82, lastValidated: daysAgo(10) },
  { id: 'es_zoe_nodejs', engineerId: 'eng_zoe', skillId: 'skill_nodejs', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.80, lastValidated: daysAgo(10) },
  { id: 'es_zoe_python', engineerId: 'eng_zoe', skillId: 'skill_python', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.76, lastValidated: daysAgo(10) },
  { id: 'es_zoe_aws', engineerId: 'eng_zoe', skillId: 'skill_aws', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.78, lastValidated: daysAgo(10) },
  { id: 'es_zoe_terraform', engineerId: 'eng_zoe', skillId: 'skill_terraform', proficiencyLevel: 'learning', yearsUsed: 2, confidenceScore: 0.70, lastValidated: daysAgo(10) },
  { id: 'es_zoe_postgresql', engineerId: 'eng_zoe', skillId: 'skill_postgresql', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.82, lastValidated: daysAgo(10) },
  // ... plus 6-8 more skills
  // High soft skills for startup environment
  { id: 'es_zoe_ownership', engineerId: 'eng_zoe', skillId: 'skill_ownership', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.92, lastValidated: daysAgo(10) },
  { id: 'es_zoe_adaptability', engineerId: 'eng_zoe', skillId: 'skill_adaptability', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.90, lastValidated: daysAgo(10) },
  ```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Seeding succeeds: `npm run seed`
- [ ] Neo4j shows 19 engineers total

#### Manual Verification:
- [ ] Healthcare domain now covered (David, Aisha)
- [ ] ML domain now covered (Aisha)
- [ ] Mobile domain now covered (Ryan)
- [ ] Gaming domain now covered (Ryan)
- [ ] All engineers in US timezones

#### Archetype Verification:
- [ ] High-performing mid-levels (Priya, Lisa) have 5-7 skills with 0.88-0.92 confidence
- [ ] Startup generalist (Zoe) has 12+ skills with 0.75-0.85 confidence + high ownership/adaptability
- [ ] Priya/Lisa salaries ($160k-$165k) exceed typical mid-level range

---

## Phase 3: Add Senior Engineers (6-8 years) — 10 new engineers

### Overview
Add 10 US-based senior engineers providing healthcare specialists, EdTech domain, and more senior+immediate availability combinations across US timezones.

**Archetype representation in this phase:**
- 2 coasting seniors (Greg, Natasha) - 7-8 YoE but mid-level confidence
- 2 big-tech specialists (Marcus, Wei) - deep expertise, narrow focus
- 1 startup generalist (Derek) - breadth over depth at senior level
- 5 standard seniors

### Changes Required:

#### 1. Add Senior Engineer Records
**File**: `seeds/engineers.ts`

```typescript
// Senior Engineers (6-8 years) — 10 new (all US-based)

// COASTING SENIOR: Competent but not pushing boundaries
{
  id: 'eng_greg',
  name: 'Greg Patterson',
  email: 'greg.patterson@email.com',
  headline: 'Senior Backend Engineer | Enterprise Java',
  salary: 155000,  // Lower than typical senior (not in demand)
  yearsExperience: 7,
  startTimeline: 'immediate',  // Always available
  timezone: 'America/Chicago',
  createdAt: daysAgo(95),
},
// COASTING SENIOR: Comfortable, stable, not growing
{
  id: 'eng_natasha',
  name: 'Natasha Williams',
  email: 'natasha.williams@email.com',
  headline: 'Senior Full Stack Engineer | EdTech',
  salary: 150000,
  yearsExperience: 8,
  startTimeline: 'immediate',
  timezone: 'America/Phoenix',
  createdAt: daysAgo(80),
},
// BIG-TECH SPECIALIST: Deep expertise, narrow focus
{
  id: 'eng_marcus',
  name: 'Marcus Chen',
  email: 'marcus.chen@email.com',
  headline: 'Ex-Meta Staff Engineer | Feed Ranking Infrastructure',
  salary: 210000,  // Premium for FAANG pedigree
  yearsExperience: 8,
  startTimeline: 'one_month',
  timezone: 'America/Seattle',
  createdAt: daysAgo(40),
},
// BIG-TECH SPECIALIST: Kafka/Spark depth from high-scale data team
{
  id: 'eng_wei',
  name: 'Wei Chen',
  email: 'wei.chen@email.com',
  headline: 'Ex-Netflix Data Engineer | Real-Time Analytics at Scale',
  salary: 195000,
  yearsExperience: 8,
  startTimeline: 'one_month',
  timezone: 'America/Los_Angeles',
  createdAt: daysAgo(85),
},
// STARTUP GENERALIST (Senior): Breadth, wore many hats
{
  id: 'eng_derek',
  name: 'Derek Sullivan',
  email: 'derek.sullivan@email.com',
  headline: 'Head of Engineering (prev) | Seed to Series B',
  salary: 180000,
  yearsExperience: 7,
  startTimeline: 'two_weeks',
  timezone: 'America/Denver',
  createdAt: daysAgo(38),
},
// Standard seniors below
{
  id: 'eng_takeshi',
  name: 'Takeshi Yamamoto',
  email: 'takeshi.yamamoto@email.com',
  headline: 'Senior Backend Engineer | Java & Distributed Systems',
  salary: 175000,
  yearsExperience: 7,
  startTimeline: 'two_weeks',
  timezone: 'America/Los_Angeles',
  createdAt: daysAgo(90),
},
{
  id: 'eng_sarah',
  name: 'Sarah Johnson',
  email: 'sarah.johnson@email.com',
  headline: 'Senior Frontend Engineer | React & Performance',
  salary: 165000,
  yearsExperience: 6,
  startTimeline: 'immediate',
  timezone: 'America/New_York',
  createdAt: daysAgo(60),
},
{
  id: 'eng_ravi',
  name: 'Ravi Sharma',
  email: 'ravi.sharma@email.com',
  headline: 'Senior Full Stack Engineer | Healthcare Systems',
  salary: 170000,
  yearsExperience: 8,
  startTimeline: 'immediate',
  timezone: 'America/Chicago',
  createdAt: daysAgo(55),
},
{
  id: 'eng_olivia',
  name: 'Olivia Martinez',
  email: 'olivia.martinez@email.com',
  headline: 'Senior ML Engineer | NLP & Python',
  salary: 190000,
  yearsExperience: 7,
  startTimeline: 'two_weeks',
  timezone: 'America/Los_Angeles',
  createdAt: daysAgo(70),
},
{
  id: 'eng_lucas',
  name: 'Lucas Thompson',
  email: 'lucas.thompson@email.com',
  headline: 'Senior Security Engineer | Cloud Security',
  salary: 185000,
  yearsExperience: 8,
  startTimeline: 'one_month',
  timezone: 'America/New_York',
  createdAt: daysAgo(65),
},
```

#### 2. Add Senior Engineer Skills by Archetype

**Coasting seniors (Greg, Natasha):**
- Standard skill count (8-10) but mid-level confidence (0.78-0.84)
- Older validation dates (skills not recently refreshed)
  ```typescript
  // Greg: Competent Java, but not cutting-edge
  { id: 'es_greg_java', engineerId: 'eng_greg', skillId: 'skill_java', proficiencyLevel: 'proficient', yearsUsed: 7, confidenceScore: 0.80, lastValidated: daysAgo(90) },
  { id: 'es_greg_spring', engineerId: 'eng_greg', skillId: 'skill_spring', proficiencyLevel: 'proficient', yearsUsed: 6, confidenceScore: 0.78, lastValidated: daysAgo(90) },
  { id: 'es_greg_sql', engineerId: 'eng_greg', skillId: 'skill_sql', proficiencyLevel: 'proficient', yearsUsed: 7, confidenceScore: 0.82, lastValidated: daysAgo(90) },
  // Lower soft skills - not driving initiatives
  { id: 'es_greg_mentorship', engineerId: 'eng_greg', skillId: 'skill_mentorship', proficiencyLevel: 'learning', yearsUsed: 2, confidenceScore: 0.65, lastValidated: daysAgo(90) },
  ```

**Big-tech specialists (Marcus, Wei):**
- Few skills (5-7) with very high confidence (0.90-0.95)
- Strong mentorship, documentation, system_design
- Weaker adaptability, ownership (used to defined scope)
  ```typescript
  // Marcus: Deep ML/Ranking expertise, narrow focus
  { id: 'es_marcus_python', engineerId: 'eng_marcus', skillId: 'skill_python', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.94, lastValidated: daysAgo(15) },
  { id: 'es_marcus_spark', engineerId: 'eng_marcus', skillId: 'skill_spark', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.92, lastValidated: daysAgo(15) },
  { id: 'es_marcus_system_design', engineerId: 'eng_marcus', skillId: 'skill_system_design', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.90, lastValidated: daysAgo(15) },
  { id: 'es_marcus_mentorship', engineerId: 'eng_marcus', skillId: 'skill_mentorship', proficiencyLevel: 'expert', yearsUsed: 4, confidenceScore: 0.88, lastValidated: daysAgo(15) },
  // Lower startup-y skills
  { id: 'es_marcus_adaptability', engineerId: 'eng_marcus', skillId: 'skill_adaptability', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.72, lastValidated: daysAgo(15) },
  // Only 5-6 total skills
  ```

**Startup generalist (Derek):**
- Many skills (12-14) with solid confidence (0.78-0.86)
- Multiple business domains (SaaS, Fintech, E-commerce - wherever startups go)
- High hiring/leadership skills from scaling teams
  ```typescript
  // Derek: Breadth from wearing many hats
  { id: 'es_derek_react', engineerId: 'eng_derek', skillId: 'skill_react', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.82, lastValidated: daysAgo(20) },
  { id: 'es_derek_nodejs', engineerId: 'eng_derek', skillId: 'skill_nodejs', proficiencyLevel: 'proficient', yearsUsed: 6, confidenceScore: 0.84, lastValidated: daysAgo(20) },
  { id: 'es_derek_python', engineerId: 'eng_derek', skillId: 'skill_python', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.78, lastValidated: daysAgo(20) },
  { id: 'es_derek_aws', engineerId: 'eng_derek', skillId: 'skill_aws', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.80, lastValidated: daysAgo(20) },
  { id: 'es_derek_hiring', engineerId: 'eng_derek', skillId: 'skill_hiring', proficiencyLevel: 'expert', yearsUsed: 4, confidenceScore: 0.88, lastValidated: daysAgo(20) },
  { id: 'es_derek_leadership', engineerId: 'eng_derek', skillId: 'skill_team_leadership', proficiencyLevel: 'expert', yearsUsed: 3, confidenceScore: 0.86, lastValidated: daysAgo(20) },
  // ... plus 6-8 more skills
  ```

**Standard seniors:** Skills at 0.82-0.92 confidence range, stories demonstrate leadership and larger scope impact.

### Success Criteria:

#### Automated Verification:
- [ ] Seeding succeeds with 29 engineers total
- [ ] All engineers in US timezones

#### Manual Verification:
- [ ] EdTech domain covered (Natasha)
- [ ] Healthcare domain strengthened (Ravi)
- [ ] Senior + immediate combinations work (Sarah, Greg, Natasha, Ravi available immediately)

#### Archetype Verification:
- [ ] Coasting seniors (Greg, Natasha) have 0.78-0.84 confidence, older validation dates
- [ ] Big-tech specialists (Marcus, Wei) have 5-7 skills with 0.90-0.95 confidence
- [ ] Startup generalist (Derek) has 12+ skills with hiring/leadership expertise
- [ ] Coasting seniors have lower salaries ($150k-$155k) vs typical seniors ($165k-$185k)
- [ ] Big-tech specialists command premium salaries ($195k-$210k)

---

## Phase 4: Add Staff Engineers (9-11 years) — 8 new engineers

### Overview
Add 8 US-based staff-level engineers including the critical Anika Patel (10 years + immediate - unlocks the example query from the spec).

### Changes Required:

#### 1. Add Staff Engineer Records
**File**: `seeds/engineers.ts`

```typescript
// Staff Engineers (9-11 years) — 8 new (all US-based)
{
  id: 'eng_anika',
  name: 'Anika Patel',
  email: 'anika.patel@email.com',
  headline: 'Staff Platform Engineer | Kafka, Kubernetes & Distributed Systems',
  salary: 220000,
  yearsExperience: 10,
  startTimeline: 'immediate',  // CRITICAL: unlocks example query
  timezone: 'America/Los_Angeles',
  createdAt: daysAgo(100),
},
{
  id: 'eng_alex',
  name: 'Alex Rivera',
  email: 'alex.rivera@email.com',
  headline: 'Staff Backend Engineer | Java & System Design',
  salary: 210000,
  yearsExperience: 9,
  startTimeline: 'two_weeks',
  timezone: 'America/New_York',
  createdAt: daysAgo(95),
},
{
  id: 'eng_dmitri',
  name: 'Dmitri Volkov',
  email: 'dmitri.volkov@email.com',
  headline: 'Staff ML Engineer | Deep Learning & MLOps',
  salary: 235000,
  yearsExperience: 10,
  startTimeline: 'one_month',
  timezone: 'America/Seattle',
  createdAt: daysAgo(88),
},
{
  id: 'eng_jennifer',
  name: 'Jennifer Park',
  email: 'jennifer.park@email.com',
  headline: 'Staff Frontend Engineer | React & Web Performance',
  salary: 200000,
  yearsExperience: 9,
  startTimeline: 'immediate',
  timezone: 'America/Chicago',
  createdAt: daysAgo(82),
},
{
  id: 'eng_michael',
  name: 'Michael O\'Connor',
  email: 'michael.oconnor@email.com',
  headline: 'Staff DevOps Engineer | AWS & Platform Engineering',
  salary: 215000,
  yearsExperience: 11,
  startTimeline: 'three_months',
  timezone: 'America/Denver',
  createdAt: daysAgo(110),
},
{
  id: 'eng_sanjay',
  name: 'Sanjay Gupta',
  email: 'sanjay.gupta@email.com',
  headline: 'Staff Data Engineer | Spark & Real-time Systems',
  salary: 225000,
  yearsExperience: 10,
  startTimeline: 'two_weeks',
  timezone: 'America/Phoenix',
  createdAt: daysAgo(92),
},
{
  id: 'eng_rachel',
  name: 'Rachel Kim',
  email: 'rachel.kim@email.com',
  headline: 'Staff Full Stack Engineer | Healthcare & Fintech',
  salary: 205000,
  yearsExperience: 9,
  startTimeline: 'one_month',
  timezone: 'America/Los_Angeles',
  createdAt: daysAgo(78),
},
{
  id: 'eng_hassan',
  name: 'Hassan Ahmed',
  email: 'hassan.ahmed@email.com',
  headline: 'Staff Security Engineer | AppSec & Cloud Security',
  salary: 230000,
  yearsExperience: 11,
  startTimeline: 'immediate',
  timezone: 'America/New_York',
  createdAt: daysAgo(105),
},
```

**Critical:** Anika Patel must have:
- `yearsExperience: 10`
- `startTimeline: 'immediate'`
- Skills: Kafka (0.90+), Kubernetes (0.85+), AWS, Java, System Design

Key characteristics:
- Skills at 0.85-0.95 confidence range
- Stories demonstrate cross-team impact and architectural decisions
- High salaries ($200k-$235k) for budget constraint testing

### Success Criteria:

#### Automated Verification:
- [ ] Seeding succeeds with 37 engineers total
- [ ] Anika has Kafka and Kubernetes skills with high confidence

#### Manual Verification:
- [ ] Example query now has a valid result path (Anika matches with relaxation)
- [ ] Staff-level stories demonstrate expected seniority

---

## Phase 5: Add Principal Engineers (12+ years) — 3 new engineers

### Overview
Add 3 US-based principal-level engineers for rare, high-value candidate scenarios.

### Changes Required:

#### 1. Add Principal Engineer Records
**File**: `seeds/engineers.ts`

```typescript
// Principal Engineers (12+ years) — 3 new (all US-based)
{
  id: 'eng_victoria',
  name: 'Victoria Chang',
  email: 'victoria.chang@email.com',
  headline: 'Principal Architect | Distributed Systems & Cloud',
  salary: 285000,
  yearsExperience: 14,
  startTimeline: 'three_months',
  timezone: 'America/Los_Angeles',
  createdAt: daysAgo(150),
},
{
  id: 'eng_robert',
  name: 'Robert Mitchell',
  email: 'robert.mitchell@email.com',
  headline: 'Principal ML Architect | AI Systems & Strategy',
  salary: 320000,
  yearsExperience: 15,
  startTimeline: 'six_months',
  timezone: 'America/New_York',
  createdAt: daysAgo(180),
},
{
  id: 'eng_elena',
  name: 'Elena Rodriguez',
  email: 'elena.rodriguez@email.com',
  headline: 'Principal Security Architect | Enterprise Security',
  salary: 290000,
  yearsExperience: 12,
  startTimeline: 'three_months',
  timezone: 'America/Chicago',
  createdAt: daysAgo(160),
},
```

Key characteristics:
- Skills at 0.90-0.98 confidence range
- Long availability timelines (three_months, six_months)
- Very high salaries ($285k-$320k)
- Stories demonstrate company-wide or industry impact

### Success Criteria:

#### Automated Verification:
- [ ] Seeding succeeds with 40 engineers total
- [ ] `MATCH (e:Engineer) RETURN count(e)` returns 40

#### Manual Verification:
- [ ] Principal engineers have appropriately long availability timelines
- [ ] Budget constraint queries correctly exclude/include principals

---

## Phase 6: Add New Assessments and Certifications

### Overview
Add 3 new assessment types (Full Stack, ML Engineering, Mobile Engineering) and additional certifications to provide evidence for new technical domains.

### Changes Required:

#### 1. New Assessments
**File**: `seeds/assessments.ts`

```typescript
{
  id: 'assess_fullstack',
  name: 'Full Stack Engineering Assessment',
  assessmentType: 'coding_challenge',
  description: '90-minute assessment covering end-to-end feature development',
  totalQuestions: 3,
  createdAt: daysAgo(250),
},
{
  id: 'assess_ml',
  name: 'ML Engineering Assessment',
  assessmentType: 'take_home',
  description: '24-hour take-home covering model development and deployment',
  totalQuestions: 2,
  createdAt: daysAgo(200),
},
{
  id: 'assess_mobile',
  name: 'Mobile Engineering Assessment',
  assessmentType: 'coding_challenge',
  description: '75-minute assessment covering cross-platform mobile development',
  totalQuestions: 3,
  createdAt: daysAgo(180),
},
```

#### 2. Assessment Questions and Skill Tests
Add 8 new questions across the 3 assessments with appropriate skill mappings.

#### 3. New Certifications
```typescript
{ id: 'cert_gcp_ml', name: 'Google Cloud Professional ML Engineer', issuingOrg: 'Google Cloud', ... },
{ id: 'cert_react_native', name: 'React Native Certified Developer', issuingOrg: 'Meta', ... },
{ id: 'cert_hipaa', name: 'HIPAA Compliance Certification', issuingOrg: 'AHLA', ... },
```

### Success Criteria:

#### Automated Verification:
- [ ] 7 total assessments exist
- [ ] All engineers have at least one assessment attempt

---

## Phase 7: Wire Up Assessment Attempts and Skill Evidence

### Overview
Create assessment attempts for all 40 engineers and wire up skill evidence links to complete the evidence chains.

### Changes Required:

1. **Assessment Attempts**: Each engineer takes 1-2 assessments appropriate to their domain
2. **Question Performances**: 2-3 per attempt with scores matching engineer experience level
3. **Skill Evidence**: Link each UserSkill to its supporting evidence (stories, performances, certifications)

### Success Criteria:

#### Automated Verification:
- [ ] Every engineer has at least 1 assessment attempt
- [ ] Every UserSkill with 0.80+ confidence has at least 1 evidence link
- [ ] Seeding completes without orphaned references

#### Manual Verification:
- [ ] Evidence chains are realistic (skills supported by relevant stories/assessments)
- [ ] ML engineers took ML assessment, Frontend engineers took Frontend assessment, etc.

---

## Testing Strategy

### Unit Tests:
- Type checking: `npm run typecheck`
- No duplicate IDs in any array
- All foreign keys reference valid IDs

### Integration Tests:
- Full seeding: `npm run seed` completes without errors
- Category seeding: `SEED_CATEGORIES=engineers npm run seed` works

### End-to-End Verification:
After seeding, run these Neo4j queries:

```cypher
// Engineer count
MATCH (e:Engineer) RETURN count(e) AS total
// Expected: 40

// Availability distribution
MATCH (e:Engineer)
RETURN e.startTimeline AS availability, count(e) AS count
ORDER BY count DESC
// Expected: immediate(12), two_weeks(10), one_month(8), three_months(6), six_months(4)
// Note: StartTimeline enum also supports 'one_year' but current seed data doesn't use it

// All engineers in US timezones
MATCH (e:Engineer)
WHERE NOT e.timezone STARTS WITH 'America/'
RETURN count(e) AS nonUSCount
// Expected: 0

// US timezone distribution
MATCH (e:Engineer)
RETURN e.timezone AS tz, count(*) AS count
ORDER BY count DESC
// Expected distribution across: America/Los_Angeles, America/New_York, America/Chicago, America/Denver, America/Seattle, America/Phoenix

// The example query from spec
MATCH (e:Engineer)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
WHERE e.yearsExperience >= 10
  AND e.startTimeline = 'immediate'
  AND s.id IN ['skill_kubernetes', 'skill_kafka']
  AND us.confidenceScore >= 0.75
RETURN e.name, collect(s.name) AS skills
// Expected: Should return Anika Patel (after relaxing confidence from 0.9 to 0.75)
```

### Archetype Verification Queries:

```cypher
// High-performing mid-levels: 5 YoE with senior-level confidence (0.88+)
MATCH (e:Engineer)-[:HAS]->(us:UserSkill)
WHERE e.yearsExperience <= 5 AND us.confidenceScore >= 0.88
WITH e, count(us) AS highConfSkills
WHERE highConfSkills >= 2
RETURN e.name, e.yearsExperience, highConfSkills
// Expected: Priya Sharma, Lisa Wang

// Coasting seniors: 7+ YoE with mid-level confidence (max < 0.85)
MATCH (e:Engineer)-[:HAS]->(us:UserSkill)
WHERE e.yearsExperience >= 7
WITH e, max(us.confidenceScore) AS maxConf
WHERE maxConf < 0.85
RETURN e.name, e.yearsExperience, maxConf
// Expected: Greg Patterson, Natasha Williams

// Startup generalists: Many skills (12+), high ownership/adaptability
MATCH (e:Engineer)-[:HAS]->(us:UserSkill)
WITH e, count(us) AS skillCount
WHERE skillCount >= 12
MATCH (e)-[:HAS]->(us2:UserSkill)-[:FOR]->(s:Skill)
WHERE s.id IN ['skill_ownership', 'skill_adaptability']
  AND us2.confidenceScore >= 0.88
RETURN e.name, skillCount, collect(s.name) AS highSoftSkills
// Expected: Zoe Martinez, Derek Sullivan

// Big-tech specialists: Few skills (<=7), very high confidence (0.90+)
MATCH (e:Engineer)-[:HAS]->(us:UserSkill)
WITH e, count(us) AS skillCount, avg(us.confidenceScore) AS avgConf
WHERE skillCount <= 7 AND avgConf >= 0.85
RETURN e.name, skillCount, round(avgConf * 100) / 100 AS avgConfidence
// Expected: Marcus Chen, Wei Chen

// Salary distribution by archetype
MATCH (e:Engineer)
WHERE e.id IN ['eng_greg', 'eng_natasha', 'eng_marcus', 'eng_wei', 'eng_priya', 'eng_lisa']
RETURN e.name, e.yearsExperience, e.salary,
  CASE
    WHEN e.id IN ['eng_greg', 'eng_natasha'] THEN 'coasting'
    WHEN e.id IN ['eng_marcus', 'eng_wei'] THEN 'big-tech'
    ELSE 'high-performer'
  END AS archetype
ORDER BY archetype, e.salary DESC
// Expected: coasting ($150-155k) < high-performer ($160-165k) < big-tech ($195-210k)
```

## Performance Considerations

- Seeding 40 engineers with full evidence should take < 60 seconds
- Individual seed functions use MERGE for idempotency
- Batch operations could be added if seeding becomes slow

## References

- Research: `thoughts/shared/1_chapter_5/2_project_2/research/2026-01-08-project-2-seed-data-analysis.md`
- Specification: `thoughts/shared/1_chapter_5/2_project_2/research/2026-01-08-40-engineer-seed-specification.md`
- Realism Evaluation: `thoughts/shared/1_chapter_5/2_project_2/research/2026-01-08-seed-data-realism-evaluation.md`
- Plan Verification: `thoughts/shared/1_chapter_5/2_project_2/research/2026-01-10-40-engineer-plan-verification.md`
- Current seeds: `seeds/engineers.ts`, `seeds/stories.ts`, `seeds/assessments.ts`
