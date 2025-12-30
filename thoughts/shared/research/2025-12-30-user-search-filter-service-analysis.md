---
date: 2025-12-30T12:00:00-08:00
researcher: Claude
git_commit: 5808b25e29115b8dbc76018a058a9a054c2ceb5a
branch: main
repository: software-devs-server
topic: "User Search Filter Service - Architecture, Capabilities, and Limitations"
tags: [research, codebase, filtering, recommender-system, match-score, user-search]
status: complete
last_updated: 2025-12-30
last_updated_by: Claude
---

# Research: User Search Filter Service - Architecture, Capabilities, and Limitations

**Date**: 2025-12-30T12:00:00-08:00
**Researcher**: Claude
**Git Commit**: 5808b25e29115b8dbc76018a058a9a054c2ceb5a
**Branch**: main
**Repository**: software-devs-server

## Research Question

How does the filtering system and recommender system work in `software-devs-server/src/services/user-search-filter-service/user-search-filter-service.ts`? What can it do, what can't it do, and what are its pros and cons?

## Summary

The User Search Filter Service is a **constraint-based filtering system** combined with a **weighted match scoring recommender**. It enables employers to search for developers by applying multiple filter criteria (YOE, technologies, education, location, etc.) and ranks results using an 8-dimensional match score algorithm. The system follows a modular database design with separate tables for each filter type, integrates with ChatGPT for job qualification extraction, and supports default filter generation from job postings.

**Key Findings:**
- 7 filter types implemented (6 active, 1 inactive)
- 8-dimension match score with weighted components (max raw score: 19)
- Salary expectation impacts final score (0.85x - 1.0x multiplier)
- Tight coupling between filters, jobs, and match score qualifications
- Industry scoring not yet implemented (TODO in codebase)

---

## Detailed Findings

### 1. Architecture Overview

The system consists of three core layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Routes)                       │
│  GET /user-search/:filterId, POST /jobs, etc.              │
├─────────────────────────────────────────────────────────────┤
│                  Controller Layer                           │
│  user-search.ts, job.ts                                    │
├─────────────────────────────────────────────────────────────┤
│                  Service Layer                              │
│  user-search-filter-service.ts, match-score.ts, job-service│
├─────────────────────────────────────────────────────────────┤
│                  Data Layer (Prisma)                        │
│  UserSearchFilter + 7 related filter tables                │
└─────────────────────────────────────────────────────────────┘
```

**File Locations:**
- Main service: `src/services/user-search-filter-service/user-search-filter-service.ts`
- Match score: `src/services/match-score/match-score.ts`
- Filter builder: `src/controllers/user-search/parent-filter-to-build-where-clause-functions.ts`
- Types: `src/services/user-search-filter-service/user-search-filter-types.ts`

---

### 2. Filter Types and Implementation Status

| Filter Type | Status | Database Table | Applied To | Logic |
|-------------|--------|----------------|------------|-------|
| **YOE** | Active | `yoe_filter` | `insights.years_of_experience` | Range (min/max) |
| **Technologies** | Active | `technologies_filter` | `user_technologies` | Array match (some) |
| **Stack Type** | Active | `stack_type_filter` | `dev_type` | Array match (in) |
| **Education Level** | Active | `education_level_filter` | `user_education` | Complex OR with area_of_study |
| **Location** | Active | `location_filter` | `location.country/state` | Exact match |
| **General Insights** | Active | `general_insights_filter` | `insights.*` | Boolean flags |
| **Location Type** | **INACTIVE** | `location_type_filter` | N/A | Commented out |

**Filter Application Code** (`parent-filter-to-build-where-clause-functions.ts`):
```typescript
// YOE Filter (lines 14-22)
whereConditions.insights = {
  years_of_experience: {
    ...(filter.yoe_filter.min && { gte: filter.yoe_filter.min }),
    ...(filter.yoe_filter.max && { lte: filter.yoe_filter.max }),
  },
};

// Technologies Filter (lines 40-49)
whereConditions.user_technologies = {
  some: {
    technology_id: { in: filter.technologies_filter.technology_ids },
  },
};
```

---

### 3. Match Score Algorithm

The recommender uses an 8-dimension weighted scoring system:

| Dimension | Weight | Max Score | Calculation |
|-----------|--------|-----------|-------------|
| **LOCATION** | 2 | 1 | Binary: remote OR state match |
| **INDUSTRY** | 1 | 1 | **NOT IMPLEMENTED (TODO)** |
| **EDUCATION** | 2 | 2 | `min(2, devRank / jobRank)` |
| **YEARS_OF_EXPERIENCE** | 3 | 2 | `min(2, devYOE / jobYOE)` |
| **TECHNOLOGIES** | 3 | 1 | Normalized sum of tech scores |
| **BIG_TECH_EXPERIENCE** | 1 | 1 | Binary: not required OR has it |
| **OPEN_SOURCE_CONTRIBUTOR** | 1 | 1 | Binary: not required OR has it |
| **STACK_TYPE** | 1 | 1 | Binary: type matches |

**Maximum Raw Score: 19** (before salary adjustment)

**Salary Multiplier Impact:**
- No gap: `1.0x`
- Gap $0-10K: `0.95x`
- Gap $10K-20K: `0.9x`
- Gap $20K+: `0.85x`

**Technology Scoring Detail:**
```typescript
// Each matched technology (lines 101-118 in match-score.ts)
const score = Math.min(10, (devTechnology.years_of_experience / jobTechnology.years_of_experience) * 5);
// Normalized: totalTechnologyScore / (numberOfJobTechnologies * 10)
```

---

### 4. Data Flow

```
Job Created
    │
    ▼
calculateMatchScoreQualificationsForJob() ──► ChatGPT parses job description
    │
    ▼
upsertDefaultUserSearchFilterForJobFromMatchScoreQualifications()
    │
    ▼
UserSearchFilter created with all 7 filter types pre-populated
    │
    ▼
User searches: GET /user-search/:filterId
    │
    ▼
buildWhereConditionsFromFilter() ──► Prisma WHERE clause
    │
    ▼
Query DevUser database
    │
    ▼
mapDevUsersToDevUserDetails() ──► calculateMatchScoreForDev() per developer
    │
    ▼
handleDevUserDetailsSort() ──► Sort by match score (default) or YOE
    │
    ▼
Return ranked DevUserDetails[]
```

---

### 5. Database Schema

**Main Model:**
```prisma
model UserSearchFilter {
    user_search_filter_id String  @id @default(uuid())
    job_id                String? @unique
    is_default            Boolean
    is_confirmed_by_user  Boolean

    // One-to-one relationships to filter tables
    yoe_filter              YoeFilter?
    technologies_filter     TechnologiesFilter?
    stack_type_filter       StackTypeFilter?
    education_level_filter  EducationLevelFilter?
    location_type_filter    LocationTypeFilter?
    location_filter         LocationFilter?
    general_insights_filter GeneralInsightsFilter?
    sort_info               UserSearchSortInfo?

    @@unique([job_id, is_default])
}
```

**Design Pattern:** Each filter is a separate table with CASCADE deletion, enabling modular filter management.

---

## Capabilities (What It Can Do)

1. **Multi-dimensional filtering** - Apply up to 6 active filter criteria simultaneously
2. **Flexible sorting** - Sort by total YOE, specific technology YOE, or match score
3. **AI-powered defaults** - Auto-generate filters from job descriptions via ChatGPT
4. **Bi-directional sync** - Update match score qualifications when filters change
5. **Modular filter reset** - Reset individual filters or entire filter sets
6. **Job-specific filters** - Each job can have default and custom filter configurations
7. **Weighted scoring** - Prioritize dimensions that matter most (technologies/YOE weighted 3x)
8. **Salary normalization** - Adjust scores based on salary expectation alignment

---

## Limitations (What It Can't Do)

1. **Location Type filter is inactive** - Stored but never applied to queries
2. **Industry scoring not implemented** - Weight exists but always scores 0
3. **No skill hierarchy** - Technologies are flat, no parent/child relationships
4. **No fuzzy matching** - All filters are exact matches
5. **No negative filtering** - Cannot exclude specific technologies/skills
6. **Single location only** - Uses first office location, ignores multiple offices
7. **No pagination** - Returns all matching results at once
8. **No real-time updates** - Match scores calculated at query time, not cached
9. **No confidence/evidence tracking** - No indication of skill validation strength
10. **Limited sort options** - Only 3 sort types (YOE, tech YOE, match score)

---

## Pros

| Advantage | Description |
|-----------|-------------|
| **Modular architecture** | Each filter type is independently managed |
| **Database-backed** | Filters persist and can be edited/reused |
| **AI integration** | ChatGPT extracts qualifications automatically |
| **Weighted scoring** | Customizable importance per dimension |
| **Salary awareness** | Realistic expectation alignment |
| **Default generation** | Zero-config starting point for searches |
| **Bi-directional sync** | Filters and match qualifications stay aligned |
| **Type safety** | Full TypeScript + Prisma type generation |

---

## Cons

| Disadvantage | Impact |
|--------------|--------|
| **Tight coupling** | Filter, Job, and MatchScore are interdependent |
| **No skill taxonomy** | Can't search "frontend" and get React, Vue, Angular |
| **Black box scoring** | Users don't see why a developer scored high/low |
| **Performance risk** | Full table scan + per-developer scoring calculation |
| **Limited extensibility** | Adding new filter types requires schema migration |
| **Incomplete implementation** | Location Type and Industry not working |
| **No caching** | Match scores recalculated every search |
| **Single dimension arrays** | Technologies filter uses OR, not AND logic |

---

## Code References

- `software-devs-server/src/services/user-search-filter-service/user-search-filter-service.ts:8-17` - getUserSearchFilterById
- `software-devs-server/src/services/user-search-filter-service/user-search-filter-service.ts:74-102` - handleDevUserDetailsSort
- `software-devs-server/src/services/user-search-filter-service/user-search-filter-service.ts:104-193` - upsertDefaultUserSearchFilterForJobFromMatchScoreQualifications
- `software-devs-server/src/services/match-score/match-score.ts:29-147` - calculateMatchScoreForDev
- `software-devs-server/src/controllers/user-search/parent-filter-to-build-where-clause-functions.ts:14-91` - buildWhereConditionsFromFilter
- `software-devs-server/src/services/user-search-filter-service/user-search-filter-types.ts` - DevUserDetails interface
- `software-devs-server/prisma/schema/dev_discovery/dev_discovery.prisma` - Filter schema definitions

---

## Comparison with Recommender System Project

The `recommender_system` project (Neo4j-based) addresses several limitations:

| Feature | software-devs-server | recommender_system |
|---------|---------------------|-------------------|
| **Skill hierarchy** | None | Category relationships |
| **Score transparency** | Hidden | Full breakdown exposed |
| **Evidence tracking** | None | Stories, assessments, certs |
| **Database** | PostgreSQL (Prisma) | Neo4j (graph) |
| **Filter modes** | Hard filters only | Hard + ranking boost |
| **Domain filtering** | Not supported | requiredDomains/preferredDomains |

---

## Historical Context (from thoughts/)

Relevant documentation found in `recommender_system/thoughts/shared/`:

- `plans/2025-12-30-project-1-basic-constraint-search-api.md` - Constraint-based recommender design
- `plans/2025-12-30-utility-score-breakdown-transparency.md` - Score transparency implementation
- `plans/2025-12-30-domain-filtering-implementation.md` - Domain filtering with hard/soft modes
- `research/2025-12-30-data-model-research.md` - Knowledge graph model with evidence-based skills

---

## Open Questions

1. **Why is Location Type filter inactive?** - Is this intentional or an oversight?
2. **When will Industry scoring be implemented?** - TODO exists but no timeline
3. **Should match scores be cached?** - Performance concern for large datasets
4. **Is OR logic for technologies intentional?** - May want AND for "must have all skills"
5. **How to add score transparency?** - Users would benefit from seeing breakdown
