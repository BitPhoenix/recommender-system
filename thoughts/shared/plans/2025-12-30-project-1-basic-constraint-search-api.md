# Project 1: Basic Constraint Search API - Implementation Plan

**Date**: 2025-12-30
**Textbook Reference**: Chapter 5.2.1-5.2.3 (Constraint-Based Recommender Systems)
**Status**: ✅ Complete

---

## Overview

Build `POST /api/search/filter` that translates manager requirements into Cypher queries for a talent marketplace. This implements Chapter 5.2.1-5.2.3 (Constraint-Based Recommender Systems) from "Recommender Systems: The Textbook" by Charu Aggarwal.

**Key Concept**: Managers speak in "their language" (seniorityLevel, teamFocus, riskTolerance) but the database stores engineer attributes. A knowledge base maps between them.

---

## Scope Boundaries

### In Scope (5.2.1 - 5.2.3)
- **5.2.1 Returning Relevant Results**: Filter conditions that translate user requirements to DB constraints
- **5.2.2 Interaction Approach**: API design with sensible defaults
- **5.2.3 Ranking the Matched Items**: Utility functions for weighted scoring

### Out of Scope (Other Projects)
| Section | Topic | Project |
|---------|-------|---------|
| 5.2.4-5.2.5 | Empty set handling, constraint relaxation | Project 2 |
| 5.3.x | Case-based similarity | Projects 3-5 |
| 5.3.3 | Explanation generation | Project 6 |
| 5.4 | Persistent personalization | Project 7 |

---

## API Contract

### Request

```typescript
interface SearchFilterRequest {
  // Core constraints
  seniorityLevel?: 'junior' | 'mid' | 'senior' | 'staff' | 'principal';
  requiredSkills?: string[];           // Skill names OR IDs (supports hierarchy)
  preferredSkills?: string[];          // Nice-to-have skills (for ranking boost)
  availability?: ('immediate' | 'two_weeks' | 'one_month' | 'not_available')[];
  timezone?: string;                   // Glob pattern: "America/*", "Europe/*"

  // Budget constraints
  maxSalary?: number;   // Maximum annual salary
  minSalary?: number;   // Minimum annual salary

  // Quality constraints
  riskTolerance?: 'low' | 'medium' | 'high';
  minProficiency?: 'learning' | 'proficient' | 'expert';

  // Context constraints (for ranking bonuses)
  teamFocus?: 'greenfield' | 'migration' | 'maintenance' | 'scaling';
  domainPreference?: string[];

  // Pagination
  limit?: number;   // Default: 20, max: 100
  offset?: number;  // Default: 0
}
```

### Example Request

```json
{
  "seniorityLevel": "senior",
  "requiredSkills": ["Backend"],
  "preferredSkills": ["TypeScript"],
  "availability": ["immediate", "two_weeks"],
  "timezone": "America/*",
  "teamFocus": "greenfield",
  "riskTolerance": "medium",
  "maxSalary": 200000,
  "minProficiency": "proficient",
  "limit": 20,
  "offset": 0
}
```

### Response

```typescript
interface SearchFilterResponse {
  matches: EngineerMatch[];
  totalCount: number;
  appliedConstraints: AppliedConstraint[];
  queryMetadata: {
    executionTimeMs: number;
    skillsExpanded: string[];    // Skills found via hierarchy traversal
    defaultsApplied: string[];   // Which defaults were used
  };
}

interface EngineerMatch {
  id: string;
  name: string;
  headline: string;
  salary: number;
  yearsExperience: number;
  availability: string;
  timezone: string;
  matchedSkills: MatchedSkill[];
  utilityScore: number;          // Computed ranking score per 5.2.3
  matchStrength: 'strong' | 'moderate' | 'weak';
}

interface MatchedSkill {
  skillId: string;
  skillName: string;
  proficiencyLevel: string;
  confidenceScore: number;
  yearsUsed: number;
  matchType: 'direct' | 'descendant' | 'correlated';
}

interface AppliedConstraint {
  field: string;
  operator: string;
  value: string;
  source: 'user' | 'knowledge_base';
}
```

### Example Response

```json
{
  "matches": [
    {
      "id": "eng_priya",
      "name": "Priya Sharma",
      "headline": "Senior Backend Engineer | Fintech & Payments",
      "salary": 180000,
      "yearsExperience": 8,
      "availability": "two_weeks",
      "timezone": "America/New_York",
      "matchedSkills": [
        {
          "skillId": "skill_nodejs",
          "skillName": "Node.js",
          "proficiencyLevel": "expert",
          "confidenceScore": 0.91,
          "yearsUsed": 7,
          "matchType": "descendant"
        },
        {
          "skillId": "skill_postgresql",
          "skillName": "PostgreSQL",
          "proficiencyLevel": "expert",
          "confidenceScore": 0.88,
          "yearsUsed": 8,
          "matchType": "descendant"
        }
      ],
      "utilityScore": 0.82,
      "matchStrength": "strong"
    }
  ],
  "totalCount": 1,
  "appliedConstraints": [
    {
      "field": "yearsExperience",
      "operator": "BETWEEN",
      "value": "6 AND 10",
      "source": "knowledge_base"
    },
    {
      "field": "confidenceScore",
      "operator": ">=",
      "value": "0.70",
      "source": "knowledge_base"
    },
    {
      "field": "availability",
      "operator": "IN",
      "value": "[\"immediate\",\"two_weeks\"]",
      "source": "user"
    },
    {
      "field": "timezone",
      "operator": "STARTS WITH",
      "value": "America/",
      "source": "user"
    },
    {
      "field": "teamFocusBonus",
      "operator": "BOOST",
      "value": "skill_ambiguity, skill_creativity, skill_ownership, skill_system_design",
      "source": "knowledge_base"
    }
  ],
  "queryMetadata": {
    "executionTimeMs": 45,
    "skillsExpanded": ["Node.js", "Express", "NestJS", "PostgreSQL", "MongoDB"],
    "defaultsApplied": ["minProficiency"]
  }
}
```

---

## Knowledge Base Rules (Section 5.2.1)

The knowledge base implements two types of rules from the textbook:

### Filter Conditions
Rules that map user requirements directly to product attribute constraints.

#### Seniority Level Mappings

| Input | Output Constraint |
|-------|-------------------|
| `junior` | `yearsExperience >= 0 AND yearsExperience < 3` |
| `mid` | `yearsExperience >= 3 AND yearsExperience < 6` |
| `senior` | `yearsExperience >= 6 AND yearsExperience < 10` |
| `staff` | `yearsExperience >= 10` |
| `principal` | `yearsExperience >= 15` |

#### Risk Tolerance Mappings

| Input | Output Constraint |
|-------|-------------------|
| `low` | `confidenceScore >= 0.85` |
| `medium` | `confidenceScore >= 0.70` |
| `high` | `confidenceScore >= 0.50` |

### Compatibility Constraints
Rules that infer typically expected product requirements based on context.

#### Team Focus Skill Bonuses

| Team Focus | Bonus Skills (for ranking) | Rationale |
|--------------|---------------------------|-----------|
| `greenfield` | ambiguity tolerance, creativity, ownership, system design | New projects require navigating unclear requirements |
| `migration` | system design, debugging, attention to detail, documentation | Understanding both old and new systems |
| `maintenance` | debugging, root cause analysis, documentation, code review | Bug fixing and quality gates |
| `scaling` | distributed systems, system design, monitoring, Kafka | Performance and scalability expertise |

### Default Values (Section 5.2.2)

When fields are unspecified, apply sensible defaults:

| Field | Default Value |
|-------|---------------|
| `riskTolerance` | `'medium'` |
| `minProficiency` | `'proficient'` |
| `availability` | `['immediate', 'two_weeks', 'one_month']` (excludes not_available) |
| `limit` | `20` |
| `offset` | `0` |

---

## Design Decisions

1. **Empty Query Handling**: Allow empty requests - returns all engineers (paginated), useful for browsing
2. **Timezone Matching**: Prefix match only - `America/*` matches `America/New_York` using Cypher `STARTS WITH`
3. **Utility Weights**: Hardcoded defaults as specified in Section 5.2.3 (not configurable per request)

---

## Skill Hierarchy Traversal

When a manager requests `requiredSkills: ['Backend']`, the system must find all engineers with any descendant skill of "Backend" in the skill taxonomy.

### Example Hierarchy

```
Backend (category)
├── Node.js
│   ├── Express
│   └── NestJS
├── Python
│   ├── Django
│   └── FastAPI
├── Java
│   └── Spring Boot
└── Go
```

### Traversal Query

```cypher
// Find all descendants of requested skills
MATCH (rootSkill:Skill)
WHERE rootSkill.id IN $skillIdentifiers
   OR rootSkill.name IN $skillIdentifiers

// Traverse CHILD_OF relationships (0 or more hops)
MATCH (descendant:Skill)-[:CHILD_OF*0..]->(rootSkill)
WHERE descendant.isCategory = false  // Only leaf skills

RETURN DISTINCT descendant.id AS skillId, descendant.name AS skillName
```

---

## Utility Function for Ranking (Section 5.2.3)

### Formula

From the textbook: `U(V) = Σ w_j * f_j(v_j)`

Where:
- `w_j` = weight of attribute j
- `f_j(v_j)` = utility function applied to attribute value

### Attribute Weights and Functions

| Attribute | Weight | Function | Parameters | Notes |
|-----------|--------|----------|------------|-------|
| `skillMatch` | 0.35 | linear | max: 1.0 | Coverage ratio + proficiency bonus |
| `confidenceScore` | 0.20 | linear | min: 0.5, max: 1.0 | Average across matched skills |
| `yearsExperience` | 0.15 | logarithmic | max: 20 | Diminishing returns after 20 yrs |
| `availability` | 0.15 | step | see below | immediate=1.0, two_weeks=0.8, etc |
| `salary` | 0.10 | linear_inverse | min: 80000, max: 300000 | Lower salary = higher utility (budget fit) |
| `teamFocusBonus` | 0.05 | linear | max: 0.5 | Accumulated from compatibility rules |

### Availability Step Function

```typescript
const availabilityUtility = {
  'immediate': 1.0,
  'two_weeks': 0.8,
  'one_month': 0.5,
  'not_available': 0.0
};
```

### Skill Match Score Calculation

```typescript
function calculateSkillMatchScore(matchedSkills, requestedSkillIds): number {
  if (requestedSkillIds.length === 0) return 0.5; // Neutral if no skills requested

  const coverageRatio = Math.min(matchedSkills.length / requestedSkillIds.length, 1);

  // Bonus for proficiency levels
  const proficiencyBonus = matchedSkills.reduce((sum, skill) => {
    const bonus = skill.proficiencyLevel === 'expert' ? 0.1 :
                  skill.proficiencyLevel === 'proficient' ? 0.05 : 0;
    return sum + bonus;
  }, 0) / Math.max(matchedSkills.length, 1);

  return Math.min(coverageRatio + proficiencyBonus, 1);
}
```

### Match Strength Classification

| Utility Score | Match Strength |
|---------------|----------------|
| >= 0.7 | `strong` |
| >= 0.4 | `moderate` |
| < 0.4 | `weak` |

---

## File Structure

```
recommender_api/src/
├── types/
│   ├── search.types.ts              # Request/response interfaces
│   └── knowledge-base.types.ts      # KB rule type definitions
├── config/
│   └── knowledge-base.config.ts     # All KB rules (hardcoded)
├── services/
│   ├── search.service.ts            # Main orchestration
│   ├── constraint-expander.service.ts # Rule expansion logic (5.2.1)
│   ├── cypher-builder.service.ts    # Cypher query generation
│   ├── skill-resolver.service.ts    # Skill hierarchy resolution
│   └── utility-calculator.service.ts # Ranking/scoring (5.2.3)
├── controllers/
│   └── search.controller.ts         # HTTP handlers
├── middleware/
│   └── validate-search.middleware.ts # Request validation
├── routes/
│   └── search.routes.ts             # Route definitions
└── index.ts                         # Updated entry point
```

---

## Implementation Phases

### Phase 1: Types & Configuration
1. [x] Create `types/search.types.ts` - Request/response interfaces
2. [x] Create `types/knowledge-base.types.ts` - Rule type definitions
3. [x] Create `config/knowledge-base.config.ts` - KB rules

### Phase 2: Query Building Services
4. [x] Create `services/cypher-builder.service.ts` - Cypher generation
5. [x] Create `services/skill-resolver.service.ts` - Hierarchy traversal
6. [x] Create `services/constraint-expander.service.ts` - Rule expansion

### Phase 3: Ranking (Section 5.2.3)
7. [x] Create `services/utility-calculator.service.ts` - Weighted utility scoring

### Phase 4: API Layer
8. [x] Create `services/search.service.ts` - Main orchestration
9. [x] Create `controllers/search.controller.ts`
10. [x] Create `middleware/validate-search.middleware.ts`
11. [x] Create `routes/search.routes.ts`
12. [x] Update `index.ts` to mount routes

### Phase 5: Testing
13. [x] Manual testing with sample requests
14. [x] Verify skill hierarchy expansion works

---

## Key Cypher Query Pattern

### Main Search Query

```cypher
// Step 1: Resolve skill identifiers and expand hierarchy
WITH $skillIdentifiers AS requestedSkills
MATCH (rootSkill:Skill)
WHERE rootSkill.id IN requestedSkills OR rootSkill.name IN requestedSkills

// Step 2: Get all descendants via CHILD_OF relationship
CALL {
  WITH rootSkill
  MATCH (descendant:Skill)-[:CHILD_OF*0..]->(rootSkill)
  WHERE descendant.isCategory = false
  RETURN descendant
}

WITH COLLECT(DISTINCT descendant.id) AS targetSkillIds

// Step 3: Find engineers with matching skills and apply constraints
MATCH (e:Engineer)-[:HAS]->(es:EngineerSkill)-[:FOR]->(s:Skill)
WHERE s.id IN targetSkillIds
  AND e.availability IN $availability
  AND e.yearsExperience >= $minYearsExperience
  AND e.yearsExperience < $maxYearsExperience
  AND es.confidenceScore >= $minConfidenceScore
  AND es.proficiencyLevel IN $allowedProficiencyLevels
  AND e.timezone STARTS WITH $timezonePrefix

// Step 4: Aggregate skill data per engineer
WITH e,
     COLLECT({
       skillId: s.id,
       skillName: s.name,
       proficiencyLevel: es.proficiencyLevel,
       confidenceScore: es.confidenceScore,
       yearsUsed: es.yearsUsed,
       matchType: CASE
         WHEN s.id IN $skillIdentifiers THEN 'direct'
         ELSE 'descendant'
       END
     }) AS matchedSkills,
     COUNT(DISTINCT s.id) AS matchedSkillCount,
     AVG(es.confidenceScore) AS avgConfidence

// Step 5: Return results ordered by match quality
RETURN e.id AS id,
       e.name AS name,
       e.headline AS headline,
       e.salary AS salary,
       e.yearsExperience AS yearsExperience,
       e.availability AS availability,
       e.timezone AS timezone,
       matchedSkills,
       matchedSkillCount,
       avgConfidence

ORDER BY matchedSkillCount DESC, avgConfidence DESC, e.yearsExperience DESC
SKIP $offset
LIMIT $limit
```

### Query Without Skills (Browse All)

```cypher
// When no skills are specified, return all engineers matching other constraints
MATCH (e:Engineer)
WHERE e.availability IN $availability
  AND e.yearsExperience >= $minYearsExperience
  AND ($maxYearsExperience IS NULL OR e.yearsExperience < $maxYearsExperience)
  AND ($timezonePrefix IS NULL OR e.timezone STARTS WITH $timezonePrefix)
  AND ($maxSalary IS NULL OR e.salary <= $maxSalary)
  AND ($minSalary IS NULL OR e.salary >= $minSalary)

// Get all skills for display (not filtering)
OPTIONAL MATCH (e)-[:HAS]->(es:EngineerSkill)-[:FOR]->(s:Skill)
WHERE s.isCategory = false

WITH e,
     COLLECT({
       skillId: s.id,
       skillName: s.name,
       proficiencyLevel: es.proficiencyLevel,
       confidenceScore: es.confidenceScore,
       yearsUsed: es.yearsUsed,
       matchType: 'none'
     }) AS allSkills

RETURN e.id AS id,
       e.name AS name,
       e.headline AS headline,
       e.salary AS salary,
       e.yearsExperience AS yearsExperience,
       e.availability AS availability,
       e.timezone AS timezone,
       allSkills AS matchedSkills,
       0 AS matchedSkillCount,
       0.0 AS avgConfidence

ORDER BY e.yearsExperience DESC
SKIP $offset
LIMIT $limit
```

---

## Validation Rules

### Request Validation

| Field | Validation |
|-------|------------|
| `seniorityLevel` | Must be one of: junior, mid, senior, staff, principal |
| `teamFocus` | Must be one of: greenfield, migration, maintenance, scaling |
| `riskTolerance` | Must be one of: low, medium, high |
| `availability` | Array of: immediate, two_weeks, one_month, not_available |
| `minProficiency` | Must be one of: learning, proficient, expert |
| `requiredSkills` | Array of strings (skill names or IDs) |
| `timezone` | Valid timezone pattern (e.g., "America/*", "Europe/London") |
| `maxSalary` | Positive number (annual salary) |
| `minSalary` | Positive number, must be <= maxSalary |
| `limit` | Number between 1 and 100 |
| `offset` | Non-negative number |

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "seniorityLevel",
        "message": "Must be one of: junior, mid, senior, staff, principal"
      }
    ]
  }
}
```

---

## Reference Files

| File | Purpose |
|------|---------|
| `seeds/types.ts` | Entity type definitions |
| `seeds/skills.ts` | Skill hierarchy structure (155 skills) |
| `seeds/engineers.ts` | Sample engineer data (5 engineers) |
| `docs/2025-12-30-data-model-research.md` | Data model documentation |

---

## Success Criteria

- [x] `POST /api/search/filter` accepts manager requirements
- [x] Knowledge base rules correctly expand seniority/risk/teamFocus
- [x] Skill hierarchy traversal finds descendants (e.g., "Backend" → Node.js, Python, etc.)
- [x] Results are ranked by utility score per Section 5.2.3
- [x] Response includes `appliedConstraints` showing what rules were applied
- [x] Validation rejects invalid request fields
- [x] Defaults are applied for unspecified fields
- [x] Empty requests return all engineers (paginated)

---

## Testing Scenarios

### Scenario 1: Senior Backend Engineer Search

**Request:**
```json
{
  "seniorityLevel": "senior",
  "requiredSkills": ["Backend"],
  "availability": ["immediate", "two_weeks"],
  "timezone": "America/*"
}
```

**Expected Behavior:**
- Years experience constraint: 6-10 years (from seniority mapping)
- Skill expansion: Backend → Node.js, Python, Java, Go, etc.
- Confidence threshold: 0.70 (from default medium risk tolerance)
- Results ranked by utility score

### Scenario 2: Empty Request (Browse)

**Request:**
```json
{}
```

**Expected Behavior:**
- Returns all engineers (excluding not_available)
- Applies default limit of 20
- Still includes utility scores for comparison

### Scenario 3: Greenfield Team Focus

**Request:**
```json
{
  "seniorityLevel": "mid",
  "requiredSkills": ["React"],
  "teamFocus": "greenfield"
}
```

**Expected Behavior:**
- Engineers with ambiguity tolerance, creativity skills get ranking boost
- Applied constraints shows the team focus bonus skills
