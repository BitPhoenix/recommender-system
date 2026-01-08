# Learning Path: Knowledge-Based Recommender Systems for Talent Marketplace

## Domain Context

Engineering managers search for full-time software engineers. Key search dimensions:

- Skills (technical, behavioral, domain knowledge)
- Years of experience
- Availability (immediate, two weeks, one month)
- Timezone

---

## Phase 1: Foundation Concepts

**Read:** Section 5.1 (Introduction)

Understand why knowledge-based systems fit this domain:

- Engineers are high-value — you don't spam candidates
- Managers have explicit requirements they can articulate
- Cold-start is common (new engineers have no interaction history)
- Domain knowledge matters (skill relationships, what seniority means)

---

## Phase 2: Constraint-Based Systems (5.2)

**Read:** 5.2 → 5.2.1 → 5.2.2 → 5.2.3 → 5.2.4 → 5.2.5

### Project 1: Basic Constraint Search API

Build `POST /api/search/filter` that translates manager requirements into Cypher queries.

**Features:**

- Accept manager input in their language (seniorityLevel, teamFocus, riskTolerance)
- Apply knowledge base rules to expand into engineer attributes
- Required skills matching using hierarchy (`:CHILD_OF` traversal)
- Minimum confidence scores
- Years of experience range
- Availability, timezone filtering

**Example Request:**

```typescript
{
  seniorityLevel: 'senior',
  requiredSkills: ['Backend'],
  availability: ['immediate', 'two_weeks'],
  timezone: 'America/*'
}
```

**Example Response:**

```typescript
{
  matches: [
    { id: 'eng_priya', name: 'Priya Sharma', ... },
    { id: 'eng_marcus', name: 'Marcus Chen', ... }
  ],
  appliedConstraints: [
    'yearsExperience >= 6 AND yearsExperience < 10',
    'skill IN descendantsOf("Backend")',
    'availability IN ["immediate", "two_weeks"]',
    'timezone STARTS WITH "America/"'
  ]
}
```

---

### Project 2: Constraint Relaxation and Repair Proposals

Build `POST /api/search/diagnose` that handles empty or sparse result sets.

#### Part A: Detect Minimal Inconsistent Sets

When zero results are returned, find the smallest combinations of constraints that conflict:

```typescript
interface ConflictSet {
  constraints: string[];  // e.g., ['minYearsExperience >= 10', 'availability = immediate']
  explanation: string;    // human-readable why these conflict
}
```

#### Part B: Generate Relaxation Suggestions

For each constraint in a conflict set, show what happens if you relax it:

```typescript
interface RelaxationOption {
  constraint: string;       // which constraint to change
  currentValue: any;        // what they specified
  suggestedValue: any;      // what we suggest
  resultingMatches: number; // how many engineers this yields
}
```

#### Part C: Algorithm

1. Start with full constraint set → 0 results
2. Remove one constraint at a time, check if results > 0
3. If removing constraint X gives results, X is part of a conflict
4. Find smallest subsets where removal yields results
5. Present these as minimal conflict sets

**Example Request:**

```typescript
{
  requiredSkills: ['Kubernetes', 'Kafka'],
  minConfidenceScore: 0.9,
  minYearsExperience: 10,
  availability: 'immediate'
}
```

**Example Response:**

```typescript
{
  matches: 0,
  diagnosis: {
    conflictSets: [
      {
        constraints: [
          'minYearsExperience >= 10',
          'availability = "immediate"'
        ],
        explanation: 'Only 1 engineer has 10+ years, and they are not immediately available.'
      },
      {
        constraints: [
          'skill("Kubernetes").confidence >= 0.9',
          'skill("Kafka").confidence >= 0.9'
        ],
        explanation: 'No engineers have 0.9+ confidence in both Kubernetes AND Kafka.'
      }
    ],
    relaxationSuggestions: [
      {
        constraint: 'minYearsExperience',
        currentValue: 10,
        suggestedValue: 7,
        resultingMatches: 2
      },
      {
        constraint: 'minConfidenceScore',
        currentValue: 0.9,
        suggestedValue: 0.8,
        resultingMatches: 3
      },
      {
        constraint: 'availability',
        currentValue: 'immediate',
        suggestedValue: 'two_weeks',
        resultingMatches: 1
      }
    ]
  }
}
```

---

## Phase 3: Case-Based Recommenders (5.3)

**Read:** 5.3 → 5.3.1 → 5.3.2 (all subsections) → 5.3.3

### Project 3: Similarity Scoring

Build `GET /api/engineers/:id/similar` that computes similarity between engineers.

**Features:**

- Weighted attribute similarity
- Asymmetric similarity functions (more experience = okay, less = penalized)
- Skill correlation bonuses via `:CORRELATES_WITH`
- Configurable weights per attribute

**Similarity Function Components:**

```typescript
interface SimilarityWeights {
  skills: number;           // 0.40
  yearsExperience: number;  // 0.25
  domain: number;           // 0.20
  availability: number;     // 0.15
}

interface SimilarityConfig {
  weights: SimilarityWeights;
  experienceTarget: number;  // e.g., 5 years
  experienceAsymmetry: 'more_is_better' | 'less_is_better' | 'symmetric';
  includeCorrelatedSkills: boolean;
  correlationMinStrength: number;  // e.g., 0.7
}
```

**Example Request:**

```
GET /api/engineers/eng_priya/similar?limit=5
```

**Example Response:**

```typescript
{
  target: { id: 'eng_priya', name: 'Priya Sharma' },
  similar: [
    {
      engineer: { id: 'eng_james', name: 'James Okonkwo' },
      similarityScore: 0.82,
      breakdown: {
        skills: 0.85,
        yearsExperience: 0.75,
        domain: 0.90,
        availability: 0.70
      }
    },
    ...
  ]
}
```

---

### Project 4: Combined Search (Filter → Rank)

Build `POST /api/search` that combines constraint filtering with similarity ranking.

**Features:**

- Accept hard constraints (dealbreakers) and soft preferences (ideal profile)
- Filter using constraints first
- Rank remaining candidates by similarity to preferences
- Return ranked results with match scores

**Example Request:**

```typescript
{
  // Hard constraints (filter)
  constraints: {
    requiredSkills: ['React'],
    minExperience: 3,
    availability: ['immediate', 'two_weeks'],
    timezonePattern: 'America/*'
  },

  // Soft preferences (rank)
  preferences: {
    idealExperience: 5,
    bonusSkills: ['TypeScript', 'Next.js', 'GraphQL'],
    preferredDomain: 'SaaS',
    evidenceWeights: {
      assessment: 0.4,
      stories: 0.35,
      certifications: 0.25
    }
  }
}
```

**Example Response:**

```typescript
{
  totalMatches: 3,
  results: [
    {
      engineer: { id: 'eng_marcus', name: 'Marcus Chen', ... },
      matchScore: 0.92,
      constraintsSatisfied: ['React', '5 years', 'immediate', 'America/Los_Angeles'],
      preferenceBreakdown: {
        experienceMatch: 1.0,   // exactly 5 years
        bonusSkills: 0.67,      // has 2 of 3
        domainMatch: 1.0,       // SaaS experience
        evidenceQuality: 0.85
      }
    },
    {
      engineer: { id: 'eng_emily', name: 'Emily Nakamura', ... },
      matchScore: 0.78,
      ...
    },
    ...
  ]
}
```

---

### Project 5: Critiquing System

Build `POST /api/search/critique` for conversational refinement of search results.

#### Part A: Simple Critiques

Single attribute adjustments:

```typescript
{
  baseSearch: { /* previous search */ },
  critique: {
    type: 'simple',
    attribute: 'yearsExperience',
    direction: 'more'  // or 'less', 'different'
  }
}
```

#### Part B: Compound Critiques

Multiple attribute adjustments:

```typescript
{
  baseSearch: { /* previous search */ },
  critique: {
    type: 'compound',
    adjustments: [
      { attribute: 'yearsExperience', direction: 'more' },
      { attribute: 'availability', direction: 'sooner' }
    ]
  }
}
```

#### Part C: Dynamic Critique Suggestions

Analyze current results and suggest useful critiques:

```typescript
// Response includes suggested critiques
{
  results: [...],
  suggestedCritiques: [
    {
      critique: { attribute: 'domain', value: 'Fintech' },
      description: 'Add Fintech experience',
      resultingMatches: 2,
      support: 0.4  // 40% of current results have this
    },
    {
      critique: { attribute: 'yearsExperience', direction: 'less' },
      description: 'Consider less experienced candidates',
      resultingMatches: 5,
      support: 0.6
    }
  ]
}
```

---

### Project 6: Explanation Generation

Build `GET /api/engineers/:id/explain?searchId=:searchId` that explains why an engineer matches.

**Features:**

- Explain which constraints were satisfied and how
- Show evidence supporting each skill claim
- Highlight tradeoffs vs. the ideal profile
- Link to actual evidence (stories, assessments, certifications)

**Example Request:**

```
GET /api/engineers/eng_priya/explain?searchId=search_abc123
```

**Example Response:**

```typescript
{
  engineer: { id: 'eng_priya', name: 'Priya Sharma' },
  matchScore: 0.88,

  constraintExplanations: [
    {
      constraint: 'requiredSkills includes "Backend"',
      satisfied: true,
      explanation: 'Priya has Node.js (expert, 0.92 confidence) which is a child of Backend',
      evidence: [
        {
          type: 'assessment',
          id: 'attempt_priya_backend',
          summary: 'Scored 89% on Backend Engineering Assessment',
          relevance: 0.95
        },
        {
          type: 'story',
          id: 'story_priya_1',
          summary: 'Led microservices migration handling 10M transactions/day',
          relevance: 0.92
        }
      ]
    },
    {
      constraint: 'minYearsExperience >= 5',
      satisfied: true,
      explanation: 'Priya has 8 years of experience'
    }
  ],

  preferenceExplanations: [
    {
      preference: 'idealExperience = 5',
      score: 0.85,
      explanation: 'Priya has 8 years (3 more than ideal, slight penalty for overqualification)'
    },
    {
      preference: 'bonusSkills includes "TypeScript"',
      score: 1.0,
      explanation: 'Priya has TypeScript at expert level (0.92 confidence)'
    }
  ],

  tradeoffs: [
    {
      attribute: 'availability',
      issue: 'Available in 2 weeks, not immediately',
      severity: 'minor'
    }
  ]
}
```

---

## Phase 4: Persistent Personalization (5.4)

**Read:** Section 5.4

### Project 7: Manager Preference Learning

Build preference tracking and personalized ranking.

#### Part A: Track Implicit Signals

Log every manager action:

```typescript
interface ManagerAction {
  managerId: string;
  searchId: string;
  engineerId: string;
  action: 'view' | 'skip' | 'message' | 'interview' | 'hire' | 'reject';
  timestamp: string;
  dwellTimeSeconds?: number;  // for views
}
```

#### Part B: Learn Preferences

After sufficient history, derive manager-specific weights:

```typescript
interface ManagerPreferenceModel {
  managerId: string;
  learnedWeights: {
    yearsExperience: number;
    skillConfidence: number;
    availability: number;
    evidenceQuality: number;
  };
  sampleSize: number;   // how many hires this is based on
  confidence: number;   // how confident we are in these weights
  lastUpdated: string;
}
```

#### Part C: Apply Personalization

When ranking results, blend global and personal models:

```typescript
function getRankingWeights(managerId: string): Weights {
  const globalWeights = getGlobalWeights();
  const personalModel = getManagerModel(managerId);

  if (!personalModel || personalModel.sampleSize < 10) {
    // Not enough data, use global
    return globalWeights;
  }

  // Blend based on confidence
  const blendFactor = Math.min(personalModel.sampleSize / 50, 1);
  return blendWeights(globalWeights, personalModel.learnedWeights, blendFactor);
}
```

#### Part D: Pre-populate Search Defaults

Use history to suggest default search values:

```typescript
// Manager 2 always searches for 7+ years experience
// Pre-fill the search form with their typical values

interface SearchDefaults {
  managerId: string;
  suggestedDefaults: {
    minYearsExperience: 7,           // based on past searches
    preferredSkills: ['Java', 'Kafka'],  // frequently required
    availability: 'two_weeks'        // typical preference
  }
}
```

---

## Project Summary

| # | Project | Sections | Focus |
|---|---------|----------|-------|
| 1 | Basic Constraint Search | 5.2.1–5.2.3 | Filter engineers using knowledge base rules |
| 2 | Constraint Relaxation | 5.2.4–5.2.5 | Detect conflicts, suggest repairs |
| 3 | Similarity Scoring | 5.3.1 | Compute weighted similarity between engineers |
| 4 | Combined Search | 5.2.1, 5.2.3, 5.3.1 | Filter with constraints, rank by similarity |
| 5 | Critiquing System | 5.3.2.1–5.3.2.3 | Refine searches conversationally |
| 6 | Explanation Generation | 5.3.3 | Explain why engineers match |
| 7 | Preference Learning | 5.4 | Learn from manager behavior over time |

### Subsection Details

**Project 1: Basic Constraint Search** (5.2.1–5.2.3)
- 5.2.1 Returning Relevant Results — Rule-based expansion of requirements, iterative constraint propagation, building database queries
- 5.2.2 Interaction Approach — Three-phase interaction (specify → refine → repeat), default value handling
- 5.2.3 Ranking the Matched Items — Utility functions, weighted attribute scoring

**Project 2: Constraint Relaxation** (5.2.4–5.2.5)
- 5.2.4 Handling Unacceptable Results or Empty Sets — Minimal inconsistent constraint sets, repair proposals, QUICKXPLAIN/MINRELAX algorithms
- 5.2.5 Adding Constraints — Suggesting constraints when too many results, mining historical sessions for popular constraints

**Project 3: Similarity Scoring** (5.3.1)
- 5.3.1 Similarity Metrics — Weighted attribute similarity, symmetric vs asymmetric functions, categorical hierarchy similarity
- 5.3.1.1 Incorporating Diversity in Similarity Computation — Bounded greedy selection, quality metrics combining similarity and diversity

**Project 4: Combined Search** (5.2.1, 5.2.3, 5.3.1)
- 5.2.1 Returning Relevant Results — Hard constraint filtering (first pass)
- 5.2.3 Ranking the Matched Items — Utility-based ranking of filtered candidates
- 5.3.1 Similarity Metrics — Preference-based similarity scoring (second pass)

**Project 5: Critiquing System** (5.3.2.1–5.3.2.3)
- 5.3.2.1 Simple Critiques — Single attribute changes, directional critiques (more/less)
- 5.3.2.2 Compound Critiques — Multiple attribute changes in one cycle, informal descriptions ("classier", "roomier")
- 5.3.2.3 Dynamic Critiques — Data-mined critique suggestions, support-based ordering

**Project 6: Explanation Generation** (5.3.3)
- 5.3.3 Explanation in Critiques — Trade-off explanations, correlation statistics, fruitless session analysis

**Project 7: Preference Learning** (5.4)
- 5.4 Persistent Personalization — Tracking user actions (view, save, apply), learning personalized utility/similarity weights, constraint suggestion personalization, dynamic critique personalization

---

## Suggested Timeline

| Week | Reading | Build |
|------|---------|-------|
| 1 | 5.1, 5.2.1-5.2.3 | Project 1 (constraint search) |
| 2 | 5.2.4, 5.2.5 | Project 2 (relaxation, repair proposals) |
| 3 | 5.3.1 | Project 3 (similarity scoring) |
| 4 | 5.3.1 continued | Project 4 (combined search) |
| 5 | 5.3.2 | Project 5 (critiquing) |
| 6 | 5.3.3 | Project 6 (explanations) |
| 7 | 5.4 | Project 7 (preference learning) |

---

## Quick Reference: Seeded Data

| Entity | Count | Notes |
|--------|-------|-------|
| Skills | 110+ | Technical, behavioral, domain with hierarchy |
| Skill correlations | 60+ | Cross-type correlations included |
| Engineers | 5 | Varied profiles (4-12 years experience) |
| Engineer skills | 55 | With confidence scores |
| Interview stories | 8 | STAR format with AI analyses |
| Story demonstrations | 35 | Links stories → skills with strength |
| Assessments | 4 | Backend, frontend, system design, platform |
| Questions | 11 | Each tests 2-3 skills with weights |
| Performances | 15 | Scores and feedback per question |
| Certifications | 5 | AWS, CKA, CKAD, Terraform |
| Evidence links | 30+ | Connects skills to proof |
