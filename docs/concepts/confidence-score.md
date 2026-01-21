# Confidence Score

This document explains the confidence score concept used in the recommender system to quantify how certain we are about an engineer's claimed skills.

## The Problem

Engineers claim skills on their profiles, but not all claims are equally reliable:

- **Engineer A**: Claims "expert TypeScript", has passed 3 assessments, holds a certification, and told validated STAR stories demonstrating the skill
- **Engineer B**: Claims "expert TypeScript", but has no assessments, no certifications, no validated evidence

Both might be equally skilled in reality. But when recommending candidates to a hiring manager, we should factor in our uncertainty about unverified claims.

## Key Concepts

### Proficiency vs Confidence

These are two orthogonal dimensions:

| Metric | Measures | Question It Answers |
|--------|----------|---------------------|
| `proficiencyLevel` | Skill level | "How good are they at this skill?" |
| `confidenceScore` | Epistemic certainty | "How sure are we about that claim?" |

An engineer can be:
- Expert with high confidence (verified expert)
- Expert with low confidence (claims expert, unverified)
- Proficient with high confidence (verified proficient)
- Proficient with low confidence (claims proficient, unverified)

### Epistemic Uncertainty

The confidence score represents **epistemic uncertainty** - uncertainty due to lack of knowledge, not inherent randomness. As we gather more evidence, confidence increases.

This is the same reasoning a human recruiter uses: "This candidate has a portfolio, passed our screen, and has references - I feel confident putting them forward."

## Data Model

The confidence score is stored on the `UserSkill` relationship in Neo4j:

```
(:Engineer)-[:HAS]->(:UserSkill)-[:FOR]->(:Skill)
```

Each `UserSkill` node contains:

```typescript
interface UserSkill {
  id: string;
  engineerId: string;
  skillId: string;
  proficiencyLevel: 'familiar' | 'proficient' | 'expert';
  yearsUsed: number;
  confidenceScore: number;  // 0-1 probability
  lastValidated: string;    // ISO date
}
```

## Evidence Sources

In a production system, confidence scores would be calculated from multiple evidence types, each contributing to the overall confidence:

### 1. Assessment Performance

Technical assessments (coding challenges, system design) provide objective skill validation.

```typescript
// Example: Engineer scored 92% on TypeScript assessment
// This strongly supports their "expert" proficiency claim
{
  type: 'performance',
  assessmentName: 'TypeScript Fundamentals',
  score: 0.92,
  technicalDepth: 'expert'
}
```

**Contribution to confidence**: High. Objective, controlled evaluation.

### 2. Interview Stories (STAR Format)

AI-analyzed behavioral stories where engineers describe past work demonstrate skills in context.

```typescript
// Example: Engineer describes designing API contracts
{
  type: 'story',
  situation: 'Monolith was becoming a bottleneck...',
  task: 'Lead the microservices migration...',
  action: 'Designed API contracts using OpenAPI specs...',
  result: 'Completed migration with zero downtime...',
  analysis: {
    clarityScore: 0.92,
    impactScore: 0.90,
    ownershipScore: 0.88,
    overallScore: 0.90
  }
}
```

**Contribution to confidence**: Medium-high. Demonstrates real-world application but relies on self-report.

### 3. Certifications

External credentials from recognized organizations (AWS, Google Cloud, Kubernetes).

```typescript
// Example: AWS Solutions Architect certification
{
  type: 'certification',
  name: 'AWS Solutions Architect Associate',
  issuingOrg: 'Amazon Web Services',
  verified: true,
  expiryDate: '2027-12-17'
}
```

**Contribution to confidence**: Medium. Validates baseline knowledge but may not reflect current skill level.

### 4. Work History Signals

Duration of use, recency, and project context provide additional signals.

- **Years used**: Longer experience generally means more skill development
- **Last validated**: Recent validation is more trustworthy than stale data
- **Project context**: Using a skill in production vs learning projects

## How Confidence Is Used

### 1. Calculating Average Confidence

When searching for engineers with specific skills, the system calculates the average confidence across matched skills:

```sql
AVG(CASE WHEN skill.id IN $requiredSkillIds
    THEN userSkill.confidenceScore
    END) AS avgConfidence
```

### 2. Normalizing to Utility Score

The raw confidence (0-1) is normalized to a utility score:

```typescript
// From config: confidenceMin = 0.5, confidenceMax = 1.0
function calculateConfidenceUtility(avgConfidence: number): number {
  if (avgConfidence <= 0) {
    return 0; // No skill filtering applied, confidence irrelevant
  }
  // Linear normalization: (value - min) / (max - min)
  return (avgConfidence - 0.5) / (1.0 - 0.5);
}
```

**Why 0.5 minimum?** Engineers with very low confidence scores (<0.5) are filtered out during search. The ranking only considers "acceptable" to "highly confident" engineers.

### 3. Weighting in Final Score

The confidence utility is weighted (currently 14%) in the overall match score:

```typescript
const weights = {
  skillMatch: 0.37,      // How well proficiency matches requirements
  confidence: 0.14,      // How confident we are in skill claims
  experience: 0.11,      // Years of experience
  // ... other components
};

totalScore = skillMatch * 0.37 + confidence * 0.14 + experience * 0.11 + ...
```

## Example: Confidence in Practice

### Scenario

A hiring manager searches for engineers with **TypeScript** expertise.

### Candidates

| Engineer | Proficiency | Confidence | Evidence |
|----------|-------------|------------|----------|
| Priya | expert | 0.92 | 3 assessments (90%+), certification, STAR story |
| Marcus | expert | 0.82 | 1 assessment (88%), STAR story |
| New Hire | expert | 0.55 | Self-reported only |

### Confidence Utility Calculation

Using the formula `(confidence - 0.5) / (0.5)`:

| Engineer | Raw Confidence | Utility Score | Weighted (×0.14) |
|----------|----------------|---------------|------------------|
| Priya | 0.92 | 0.84 | 0.118 |
| Marcus | 0.82 | 0.64 | 0.090 |
| New Hire | 0.55 | 0.10 | 0.014 |

### Impact on Ranking

Even though all three claim "expert" TypeScript, Priya gets a ranking boost because we have strong evidence supporting her claim. The New Hire isn't excluded (they passed the 0.5 threshold), but their unverified claim contributes less to their score.

## Design Rationale

### Why Linear Scaling?

From `core-scoring.ts`:

> ML confidence scores are already calibrated probabilities. A 0.7→0.8 jump represents a genuine 10% improvement in match certainty. Unlike experience (where gains diminish), each point of confidence means more reliable skill inference.

### Why Include Low-Confidence Engineers?

Engineers with lower confidence aren't excluded - they might be perfectly qualified, just unverified. The system:

1. **Includes them** in results (they might be the best fit)
2. **Ranks them lower** than verified candidates (all else equal)
3. **Surfaces the uncertainty** to hiring managers via explanations

This lets hiring managers make informed decisions: "This candidate looks great but hasn't been assessed yet - should we fast-track their evaluation?"

## Related Concepts

- **Proficiency Level**: The claimed skill level (familiar, proficient, expert). See skill scoring documentation.
- **Evidence**: The supporting data for skill claims. See evidence types documentation.
- **Utility Scoring**: How multiple factors combine into a ranking score. See utility calculator documentation.

## File References

| File | Description |
|------|-------------|
| `seeds/types.ts` | `UserSkill` interface with `confidenceScore` field |
| `services/utility-calculator/scoring/core-scoring.ts` | `calculateConfidenceUtility()` function |
| `config/knowledge-base/utility.config.ts` | `confidenceMin`, `confidenceMax` parameters |
| `services/cypher-query-builder/search-query.builder.ts` | `AVG(confidenceScore)` aggregation in Cypher |
