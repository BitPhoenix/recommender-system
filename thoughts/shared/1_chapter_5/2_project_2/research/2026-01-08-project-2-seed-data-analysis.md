---
date: 2026-01-08T10:30:00-05:00
researcher: Claude
git_commit: 2c5b904cd9b6f1c9d28db5a5e0272748108df86a
branch: project_1.5
repository: recommender_system
topic: "Project 2 Seed Data Analysis - Constraint Relaxation Requirements"
tags: [research, codebase, seeds, project-2, constraint-relaxation]
status: complete
last_updated: 2026-01-08
last_updated_by: Claude
---

# Research: Project 2 Seed Data Analysis

**Date**: 2026-01-08T10:30:00-05:00
**Researcher**: Claude
**Git Commit**: 2c5b904
**Branch**: project_1.5
**Repository**: recommender_system

## Research Question

Do we have enough engineers seeded to make Project 2 (Constraint Relaxation and Repair Proposals) interesting? What additional engineers should be seeded?

## Summary

**Yes, we need more engineers.** The current 5 engineers are insufficient for Project 2's constraint relaxation features. Key gaps:

1. **No `one_month` availability** - One of four availability options is completely absent
2. **No APAC timezones** - 4/5 engineers in Americas, 1 in Europe
3. **Sparse "immediate" availability at senior levels** - Both immediate engineers are junior-ish (4 and 5 years)
4. **Several business domains with zero coverage** - Healthcare, Gaming, EdTech, Logistics
5. **Several technical domains with zero coverage** - ML, Mobile, Security, Data Engineering

**Recommendation:** Add 6-8 more engineers to reach 11-13 total, filling these gaps strategically.

## Detailed Findings

### Current Engineer Profiles (5 engineers)

| Engineer | YoE | Availability | Timezone | Salary | Tech Focus | Business Domains |
|----------|-----|--------------|----------|--------|------------|------------------|
| Priya Sharma | 8 | two_weeks | America/New_York | $210k | Backend, Fintech | Fintech, Payments |
| Marcus Chen | 5 | immediate | America/Los_Angeles | $155k | Full Stack | SaaS |
| Sofia Rodriguez | 7 | three_months | America/Chicago | $205k | Platform/DevOps | (none) |
| James Okonkwo | 12 | six_months | Europe/London | $295k | Distributed | Fintech, Banking |
| Emily Nakamura | 4 | immediate | America/Los_Angeles | $140k | Frontend | E-commerce |

### Why Project 2 Needs More Engineers

Project 2 implements constraint relaxation with these key features:

```typescript
// Example from the spec - this query returns 0 results
{
  requiredSkills: ['Kubernetes', 'Kafka'],
  minConfidenceScore: 0.9,
  minYearsExperience: 10,
  availability: 'immediate'
}
```

For constraint relaxation to be **interesting**, we need:
- Engineers who "almost match" but fail on 1-2 constraints
- Multiple candidates at various relaxation thresholds
- Conflicts that require tradeoff decisions

### Gap Analysis

#### 1. Availability Distribution

| Availability | Current Count | Desired |
|--------------|---------------|---------|
| immediate | 2 (Emily, Marcus) | 4-5 |
| two_weeks | 1 (Priya) | 2-3 |
| one_month | **0** | 2-3 |
| three_months | 1 (Sofia) | 1-2 |
| six_months | 1 (James) | 1-2 |

**Problem:** If a manager requires `one_month` availability, we get 0 results - no relaxation suggestions possible.

#### 2. Timezone Coverage

| Timezone Region | Current Count | Desired |
|-----------------|---------------|---------|
| America/* | 4 | 4-5 |
| Europe/* | 1 | 2-3 |
| Asia/* | **0** | 2-3 |
| Australia/* | **0** | 1 |

**Problem:** Any search filtering to APAC returns 0 with no relaxation path.

#### 3. Experience Distribution

| Experience Level | Years | Current Count |
|------------------|-------|---------------|
| Junior | 0-3 | **0** |
| Mid | 4-5 | 2 |
| Senior | 6-8 | 2 |
| Staff | 9-11 | **0** (gap!) |
| Principal+ | 12+ | 1 |

**Problem:** The example query (`minYearsExperience: 10, availability: 'immediate'`) has no relaxation path because no one with 10+ years is remotely close to immediate.

#### 4. Business Domain Coverage

| Domain | Current Engineers |
|--------|-------------------|
| Finance (Fintech, Payments, Banking) | Priya, James |
| SaaS | Marcus |
| E-commerce | Emily |
| Healthcare | **0** |
| Gaming | **0** |
| EdTech | **0** |
| Logistics | **0** |

#### 5. Technical Domain Coverage

| Domain | Current Engineers |
|--------|-------------------|
| Backend | Priya, James |
| Frontend | Emily |
| Full Stack | Marcus |
| DevOps/Platform | Sofia |
| ML/Data | **0** |
| Mobile | **0** |
| Security | **0** |

#### 6. Skill Combination Conflicts

The example query needs Kubernetes + Kafka at 0.9 confidence:
- Sofia: Kubernetes 0.90, **no Kafka**
- James: Kafka 0.90, Kubernetes only 0.75
- Priya: Kafka only 0.75, **no Kubernetes**

This is actually good - it creates a real conflict. But we need more overlapping skill scenarios.

## Recommended New Engineers

### Tier 1: Critical Gaps (must add)

#### 1. Senior + Immediate Availability
```typescript
{
  id: 'eng_anika',
  name: 'Anika Patel',
  salary: 245000,
  yearsExperience: 10,
  startTimeline: 'immediate',  // <-- rare combo!
  timezone: 'America/Denver',
  skills: ['AWS', 'Kafka', 'System Design', 'Java'],
  businessDomains: ['Fintech'],
  technicalDomains: ['Backend', 'Distributed Systems']
}
```
**Why:** Currently NO engineer with 10+ years is immediately available. This creates a "unicorn" candidate that unlocks the example query.

#### 2. APAC Timezone - Backend
```typescript
{
  id: 'eng_takeshi',
  name: 'Takeshi Yamamoto',
  salary: 180000,
  yearsExperience: 6,
  startTimeline: 'two_weeks',
  timezone: 'Asia/Tokyo',
  skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'GraphQL'],
  businessDomains: ['SaaS', 'E-commerce'],
  technicalDomains: ['Backend', 'API Development']
}
```
**Why:** No APAC coverage. Japan timezone provides overlap with both US West Coast evening and Europe morning.

#### 3. One-Month Availability
```typescript
{
  id: 'eng_wei',
  name: 'Chen Wei',
  salary: 175000,
  yearsExperience: 7,
  startTimeline: 'one_month',  // <-- missing availability tier
  timezone: 'Asia/Singapore',
  skills: ['React', 'Node.js', 'AWS', 'Docker'],
  businessDomains: ['SaaS'],
  technicalDomains: ['Full Stack']
}
```
**Why:** `one_month` availability is completely missing from seed data.

### Tier 2: Domain Coverage (should add)

#### 4. Healthcare Domain
```typescript
{
  id: 'eng_sarah',
  name: 'Sarah Mitchell',
  salary: 195000,
  yearsExperience: 8,
  startTimeline: 'two_weeks',
  timezone: 'America/Chicago',
  skills: ['Python', 'PostgreSQL', 'HIPAA Compliance', 'API Design'],
  businessDomains: ['Healthcare', 'Telemedicine'],
  technicalDomains: ['Backend', 'Security']
}
```
**Why:** Healthcare is a major domain with zero coverage.

#### 5. ML/Data Engineering
```typescript
{
  id: 'eng_alex',
  name: 'Alex Thompson',
  salary: 225000,
  yearsExperience: 9,
  startTimeline: 'three_months',
  timezone: 'Europe/Berlin',
  skills: ['Python', 'TensorFlow', 'Spark', 'Kubernetes'],
  businessDomains: ['SaaS'],
  technicalDomains: ['ML', 'Data Engineering', 'MLOps']
}
```
**Why:** No ML or data engineering coverage.

#### 6. Mobile Developer
```typescript
{
  id: 'eng_ravi',
  name: 'Ravi Krishnan',
  salary: 160000,
  yearsExperience: 5,
  startTimeline: 'immediate',
  timezone: 'Asia/Kolkata',
  skills: ['React Native', 'TypeScript', 'Swift', 'Kotlin'],
  businessDomains: ['E-commerce', 'Fintech'],
  technicalDomains: ['Mobile', 'Frontend']
}
```
**Why:** No mobile development coverage; adds India timezone.

### Tier 3: Nice to Have (for richer scenarios)

#### 7. Junior Engineer (entry-level testing)
```typescript
{
  id: 'eng_maya',
  name: 'Maya Johnson',
  salary: 95000,
  yearsExperience: 2,
  startTimeline: 'immediate',
  timezone: 'America/New_York',
  skills: ['JavaScript', 'React', 'CSS', 'Git'],
  businessDomains: ['SaaS'],
  technicalDomains: ['Frontend']
}
```
**Why:** No junior engineers (0-3 years). Creates low-cost options for relaxation suggestions.

#### 8. Australia Timezone
```typescript
{
  id: 'eng_liam',
  name: 'Liam O\'Connor',
  salary: 170000,
  yearsExperience: 6,
  startTimeline: 'one_month',
  timezone: 'Australia/Sydney',
  skills: ['Go', 'Kubernetes', 'Terraform', 'AWS'],
  businessDomains: ['Logistics'],
  technicalDomains: ['DevOps', 'Backend']
}
```
**Why:** Fills Australia timezone gap and Logistics domain.

## Summary Table: After Adding Recommended Engineers

| Dimension | Before | After |
|-----------|--------|-------|
| Total Engineers | 5 | 13 |
| Availability: immediate | 2 | 5 |
| Availability: two_weeks | 1 | 3 |
| Availability: one_month | 0 | 2 |
| Availability: three_months | 1 | 2 |
| Availability: six_months | 1 | 1 |
| Timezone: Americas | 4 | 5 |
| Timezone: Europe | 1 | 2 |
| Timezone: Asia | 0 | 4 |
| Timezone: Australia | 0 | 1 |
| Experience: 0-3 years | 0 | 1 |
| Experience: 4-5 years | 2 | 3 |
| Experience: 6-8 years | 2 | 5 |
| Experience: 9-11 years | 0 | 2 |
| Experience: 12+ years | 1 | 1 |
| Healthcare domain | 0 | 1 |
| ML/Data domain | 0 | 1 |
| Mobile domain | 0 | 1 |

## Interesting Constraint Relaxation Scenarios Now Possible

1. **"Kubernetes + Kafka expert, immediate"** → Suggest relaxing to two_weeks (gets Anika)
2. **"APAC timezone, senior backend"** → Shows Takeshi, Wei, Ravi as options
3. **"Healthcare + 10 years"** → Suggests relaxing years (Sarah has 8) or domain
4. **"ML engineer, immediate"** → Suggests relaxing timeline (Alex needs 3 months)
5. **"Junior React, $80k budget"** → Maya fits perfectly; shows budget relaxation value

## Code References

- `seeds/engineers.ts:15-71` - Current 5 engineers
- `seeds/engineers.ts:92-153` - Current skill mappings
- `seeds/domains.ts:13-40` - Business domain definitions
- `seeds/domains.ts:69-98` - Technical domain definitions
- `docs/chapter_5/chapter5_reading_and_learning_path.md:74-165` - Project 2 specification

## Architecture Insights

The constraint relaxation algorithm (described in spec lines 103-108) requires:
1. Engineers at various thresholds for each constraint
2. Multiple candidates per relaxation step
3. Meaningful tradeoffs between candidates

With only 5 engineers, too many queries hit "0 results" with no relaxation path. With 13 engineers covering all availability tiers, timezones, and domains, the system can demonstrate meaningful relaxation suggestions.

## Open Questions

1. **Should we add interview stories for new engineers?** The current engineers have 8 stories between them. New engineers would need 1-2 each.

2. **Assessment coverage for new engineers?** Currently only 4 assessments exist. New engineers need attempt records.

3. **Skill hierarchy testing?** New engineers could test parent/child skill matching (e.g., "React Native" should satisfy "Frontend" requirement).

4. **Salary ranges for budget testing?** Current range is $140k-$295k. Add lower/higher for budget constraint scenarios?
