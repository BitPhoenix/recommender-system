# Project 6: Explanation Generation - Implementation Plan

## Overview

Implement `POST /api/search/filter/:engineerId/explain` endpoint that explains why a specific engineer matches (or doesn't match) search criteria. This endpoint provides three types of explanations: constraint satisfaction, score components, and evidence backing skill claims. Following the proven dual-explanation pattern from Project 2.5, responses include both fast template-based summaries and rich LLM-generated narratives.

**Textbook Section:** 5.3.3 (Explanation in Critiques)

## Current State Analysis

### Existing Infrastructure to Reuse

| Component | Location | Reuse Strategy |
|-----------|----------|----------------|
| LLM Service | `src/services/llm.service.ts:1-103` | Direct reuse - Ollama integration with graceful degradation |
| Dual Explanation Pattern | `src/services/constraint-advisor/conflict-explanation.service.ts:49-261` | Pattern adaptation for engineer explanations |
| Statistics Queries | `src/services/constraint-advisor/conflict-stats.service.ts` | Pattern reuse for engineer capability queries |
| Score Calculation | `src/services/utility-calculator/` | Call for breakdown generation |
| Similarity Calculation | `src/services/similarity-calculator/` | Call for similarity breakdown |
| Constraint Types | `src/types/search.types.ts:200-293` | Direct reuse of AppliedFilter, DerivedConstraintInfo |
| Evidence Model | `seeds/` + EVIDENCED_BY relationships | New queries to traverse |

### Evidence Data Model (Fully Seeded)

```
Engineer -[:HAS_SKILL]-> UserSkill -[:EVIDENCED_BY]-> InterviewStory
                                   -[:EVIDENCED_BY]-> QuestionPerformance
                                   -[:EVIDENCED_BY]-> Certification
```

Properties on EVIDENCED_BY: `relevanceScore: number`, `isPrimary: boolean`

### Key Discoveries

1. **Dual explanation pattern is proven** - Project 2.5 established dataAwareExplanation (~50ms) + llmExplanation (nullable) pattern
2. **Score breakdowns already comprehensive** - 11 utility components and 4 similarity components with matched items
3. **Constraint tracking is thorough** - AppliedFilters with source attribution, DerivedConstraints with 2D derivation chains
4. **Evidence model is rich** - ~80 stories, ~90 performances, 8 certifications all linked via SkillEvidence

## Desired End State

A new endpoint that:
1. Accepts an engineer ID and search criteria (same schema as `/filter`)
2. Returns comprehensive explanation of why the engineer matches (or doesn't)
3. Provides both fast template-based and LLM-enhanced explanations
4. Shows evidence backing skill claims from stories, assessments, certifications
5. Detects and explains tradeoffs vs the ideal profile

### Verification

- All unit tests pass: `npm test`
- All E2E tests pass: `npm run test:e2e`
- TypeScript compiles: `npm run typecheck`
- Endpoint returns expected response structure
- LLM explanations generate when Ollama is available, gracefully degrade when not

## What We're NOT Doing

1. **Search state management** - No `searchId` parameter; criteria passed in body (stateless)
2. **Conflict explanations** - Already handled by Project 2.5's `conflict-explanation.service.ts`
3. **Dynamic critiques** - Already handled by Project 5's `critique-generator/`
4. **Caching** - Defer optimization until latency becomes an issue
5. **Separate evidence detail endpoint** - Include summaries inline; full STAR details in evidence array
6. **Inline explanations in search results** - See rationale below

## Design Decision: Separate Endpoint vs Inline Explanations

We considered two approaches:
- **Option A**: Return explanations for every engineer in `/filter` and `/filter-similarity` responses
- **Option B**: Separate `POST /api/search/filter/:engineerId/explain` endpoint (chosen)

### Why Separate Endpoint Is Better

| Concern | Inline with Search | Separate Endpoint |
|---------|-------------------|-------------------|
| Evidence queries | N queries for N results (expensive) | 1 query when user drills in |
| LLM calls | N calls or skip entirely | 1 call for selected engineer |
| Response size | Huge with full STAR stories | Search stays light |
| Latency | 2-5s+ with LLM | Search stays fast (~200ms) |
| User workflow | Most results are scanned, not read deeply | Explains candidates user cares about |

### Search Results Already Include Transparency

The `/filter` and `/filter-similarity` responses already return substantial transparency for initial result scanning:

| Data | Location in Response |
|------|---------------------|
| Score breakdown | `scoreBreakdown.scores` + `scoreBreakdown.preferenceMatches` (11 components) |
| Matched skills | `matchedSkills[]` with proficiency, confidence, matchType |
| Related skills | `unmatchedRelatedSkills[]` |
| Applied constraints | `appliedFilters[]` with source attribution |
| Inference rules | `derivedConstraints[]` with derivation chains |

### What `/explain` Adds Beyond Search Results

1. **Evidence backing** - EVIDENCED_BY traversal to stories, assessments, certifications (expensive)
2. **LLM narrative** - Rich prose explanation (~500ms-2s per call, doesn't scale to N engineers)
3. **Tradeoff detection** - Comparison against ideal profile (requested vs actual)
4. **Human-readable constraint explanations** - Formatted text vs raw filter objects

### User Workflow Alignment

The separate endpoint matches the actual user workflow:
1. **Browse results** - Scan 10-25 engineers using existing score breakdowns
2. **Shortlist** - Identify 1-3 candidates worth deeper investigation
3. **Deep dive** - Call `/explain` for shortlisted engineers to see evidence and tradeoffs

This avoids paying the cost of evidence queries and LLM calls for engineers the user will never seriously consider.

## Implementation Approach

Seven phases building incrementally:
1. Types and evidence queries (foundation)
2. Constraint satisfaction explanations (reuses existing constraint tracking)
3. Score component explanations (reuses existing utility/similarity calculators)
4. Evidence explanations (new - queries EVIDENCED_BY relationships)
5. Tradeoff detection (new - compares engineer to ideal profile)
6. Orchestration service with dual explanation integration
7. Controller, schema, and testing

---

## Phase 1: Types and Evidence Queries

### Overview

Define all TypeScript types and create the evidence query service for traversing EVIDENCED_BY relationships.

### Changes Required

#### 1. Explanation Types

**File**: `src/types/search-match-explanation.types.ts` (new file)

```typescript
import { AppliedFilter, MatchedSkill, MatchType } from './search.types.js';

/*
 * TechnicalDepth is defined locally to avoid cross-package imports from seeds/.
 * Values match seeds/types.ts:8 for consistency.
 */
export type TechnicalDepth = 'surface' | 'working' | 'deep' | 'expert';

/*
 * Three explanation types following Section 5.3.3:
 * - Constraint: Which requirements are satisfied and how
 * - Score: How each scoring component contributed
 * - Evidence: Proof backing skill claims
 *
 * Note: We import MatchType from search.types.ts rather than redefining it.
 * We also import TechnicalDepth from seeds/types.ts for consistency.
 *
 * INTERFACE ORDERING: Parent/container interfaces are placed ABOVE the child
 * interfaces they reference, matching the code style convention for functions.
 *
 * Type hierarchy:
 * SearchMatchExplanation (top-level response)
 * ├── summary (inline object for text summaries)
 * ├── ConstraintExplanation[]
 * ├── ScoreExplanation[]
 * ├── EvidenceExplanation[]
 * │   └── EvidenceItem
 * │       ├── StoryDetails
 * │       ├── PerformanceDetails
 * │       └── CertificationDetails
 * └── TradeoffExplanation[]
 */

// ============================================
// Top-Level Response
// ============================================

export interface SearchMatchExplanation {
  engineer: {
    id: string;
    name: string;
    headline: string;
  };
  matchScore: number;

  // Quick text summaries for display
  summary: {
    constraints: string;      // "Matches all 5 requirements"
    strengths: string;        // "Strongest: skill proficiency (92%)"
    tradeoffs: string;        // "No significant tradeoffs"
    narrative: string | null; // LLM-generated prose
  };

  // Structured explanation data
  constraints: ConstraintExplanation[];
  scores: ScoreExplanation[];
  evidence: EvidenceExplanation[];
  tradeoffs: TradeoffExplanation[];
}

// ============================================
// Constraint Satisfaction Explanation
// ============================================

/*
 * Reuse MatchType from search.types.ts: 'direct' | 'descendant' | 'correlated' | 'none'
 * - direct: User explicitly requested this skill, engineer has it
 * - descendant: User requested parent (e.g., "Backend"), engineer has child (e.g., "Node.js")
 * - correlated: Matched via CORRELATES_WITH edge (primarily for similarity scoring)
 * - none: Unfiltered search, all skills returned
 */

export interface ConstraintExplanation {
  constraint: AppliedFilter;
  satisfied: boolean;
  explanation: string;
  matchedValues: string[];
  matchType?: MatchType;  // Imported from search.types.ts
}

/*
 * EXAMPLE: ConstraintExplanation[] for a search
 *
 * Search criteria:
 *   requiredSkills: ["Backend", "TypeScript"]
 *   minYearsExperience: 5
 *   allowedTimezones: ["Eastern", "Central"]
 *
 * Engineer has: Node.js (child of Backend), TypeScript, 7 years, Eastern timezone
 *
 * constraints: [
 *   // Skill - descendant match (user asked for "Backend", engineer has "Node.js")
 *   {
 *     constraint: { kind: "skill", skills: [{skillId: "skill_backend", skillName: "Backend"}], ... },
 *     satisfied: true,
 *     explanation: "Has descendant skill of Backend: Node.js (expert, 95% confidence)",
 *     matchedValues: ["Node.js (expert, 95% confidence)"],
 *     matchType: "descendant"
 *   },
 *
 *   // Skill - direct match (user asked for "TypeScript", engineer has "TypeScript")
 *   {
 *     constraint: { kind: "skill", skills: [{skillId: "skill_typescript", skillName: "TypeScript"}], ... },
 *     satisfied: true,
 *     explanation: "Has required skill: TypeScript (proficient, 88% confidence)",
 *     matchedValues: ["TypeScript (proficient, 88% confidence)"],
 *     matchType: "direct"
 *   },
 *
 *   // Property - no matchType (only skill constraints have hierarchical matching)
 *   {
 *     constraint: { kind: "property", field: "yearsExperience", operator: ">=", value: "5", ... },
 *     satisfied: true,
 *     explanation: "Has 7 years of experience (required: ≥5)",
 *     matchedValues: ["7"]
 *     // No matchType for property constraints
 *   },
 *
 *   // Property - timezone
 *   {
 *     constraint: { kind: "property", field: "timezone", operator: "IN", value: '["Eastern","Central"]', ... },
 *     satisfied: true,
 *     explanation: "In Eastern timezone (allowed: Eastern or Central)",
 *     matchedValues: ["Eastern"]
 *   }
 * ]
 *
 * Correlated match example (from inference rules):
 *   {
 *     constraint: { kind: "skill", ..., source: "rule:react-implies-js" },
 *     satisfied: true,
 *     explanation: "Has correlated skill: JavaScript (expert, 92% confidence)",
 *     matchedValues: ["JavaScript (expert, 92% confidence)"],
 *     matchType: "correlated"
 *   }
 *
 * Unsatisfied constraint example:
 *   {
 *     constraint: { kind: "skill", skills: [{skillId: "skill_kubernetes", skillName: "Kubernetes"}], ... },
 *     satisfied: false,
 *     explanation: "Missing required skill: Kubernetes",
 *     matchedValues: [],
 *     matchType: undefined  // No match, so no match type
 *   }
 */

// ============================================
// Score Component Explanation
// ============================================

export interface ScoreExplanation {
  component: string;
  weight: number;
  rawScore: number;
  weightedScore: number;
  explanation: string;
  contributingFactors: string[];
}

// ============================================
// Evidence Explanation
// ============================================

export interface EvidenceExplanation {
  skillId: string;
  skillName: string;
  evidenceItems: EvidenceItem[];
}

export interface EvidenceItem {
  type: EvidenceType;
  id: string;
  summary: string;
  relevanceScore: number;
  isPrimary: boolean;
  details: StoryDetails | PerformanceDetails | CertificationDetails;
}

/*
 * EvidenceType aligns with SkillEvidence.evidenceType from seeds/types.ts
 * Note: seeds uses 'performance' (QuestionPerformance node), we use same naming
 */
export type EvidenceType = 'story' | 'performance' | 'certification';

/*
 * API response types for evidence details.
 *
 * WHY FLATTENED DTOs INSTEAD OF REUSING SEED TYPES?
 *
 * The Cypher queries join across multiple nodes (e.g., InterviewStory + StoryAnalysis),
 * so we're already working with joined data. The question is what shape to return.
 *
 * Option A: Return raw node properties (seed-like)
 *   - Client receives fields they don't need: engineerId, interviewId, rawTranscript,
 *     durationSeconds, createdAt, storyId, analyzerModel, analyzedAt, reasoning, flags
 *   - Larger payload (~2KB per story vs ~500 bytes flattened)
 *   - Exposes internal IDs and implementation details
 *
 * Option B: Flattened DTOs (chosen)
 *   - Only fields the UI needs to render explanations
 *   - ~75% smaller payload
 *   - Hides internal structure (no internal IDs, timestamps, model names)
 *   - Client-focused shape optimized for display
 *
 * For PerformanceDetails specifically, flattening is required because QuestionPerformance
 * alone is useless - you need assessmentName and questionSummary from joined nodes.
 *
 * Type mapping:
 * - StoryDetails: Flattened STAR + optional analysis scores (vs InterviewStory + StoryAnalysis nodes)
 * - PerformanceDetails: Flattened question performance + joined assessment/question info
 * - CertificationDetails: Subset of Certification fields relevant for display
 */

export interface StoryDetails {
  situation: string;
  task: string;
  action: string;
  result: string;
  analysis?: {
    clarityScore: number;
    impactScore: number;
    ownershipScore: number;
    overallScore: number;
  };
}

export interface PerformanceDetails {
  assessmentName: string;
  questionSummary: string;
  score: number;
  maxScore: number;
  technicalDepth: TechnicalDepth;
  feedback?: string;
}

export interface CertificationDetails {
  name: string;
  issuingOrg: string;
  issueDate: string;
  expiryDate?: string;
  verified: boolean;
}

// ============================================
// Tradeoff Explanation
// ============================================

/*
 * WHY NO DIRECTION OR SEVERITY?
 *
 * We considered including `direction: 'over' | 'under'` and
 * `severity: 'minor' | 'moderate' | 'significant'` but removed them because:
 *
 * 1. Severity is subjective - 10% over budget might be "minor" to a well-funded
 *    company but "significant" to a startup with tight runway. The hiring manager
 *    knows their constraints better than we do.
 *
 * 2. Direction can be misleading - "over" on experience isn't necessarily bad
 *    (overqualified could be great or could mean flight risk). That interpretation
 *    belongs to the manager.
 *
 * 3. We should provide facts, not judgments - the `requested` vs `actual` values
 *    plus the `explanation` give the manager all the information they need to
 *    make their own assessment.
 *
 * The UI can let managers filter/sort tradeoffs however they prefer.
 */

export interface TradeoffExplanation {
  attribute: string;
  requested: unknown;   // What the search criteria specified
  actual: unknown;      // What the engineer has
  explanation: string;  // Human-readable description of the gap
}
```

#### 2. Evidence Query Service

**File**: `src/services/search-match-explanation/evidence-query.service.ts` (new file)

```typescript
import { Session } from 'neo4j-driver';
import { EvidenceItem, EvidenceExplanation, StoryDetails, PerformanceDetails, CertificationDetails } from '../../types/search-match-explanation.types.js';

interface RawEvidenceRow {
  skillId: string;
  skillName: string;
  evidenceType: string;
  evidenceId: string;
  relevanceScore: number;
  isPrimary: boolean;
  evidenceData: Record<string, unknown>;
  analysisData?: Record<string, unknown>;
}

export async function queryEngineerEvidence(
  session: Session,
  engineerId: string,
  skillIds?: string[]
): Promise<EvidenceExplanation[]> {
  const skillFilter = skillIds && skillIds.length > 0
    ? 'AND s.id IN $skillIds'
    : '';

  const result = await session.run(
    `
    MATCH (e:Engineer {id: $engineerId})-[:HAS_SKILL]->(us:UserSkill)-[:FOR_SKILL]->(s:Skill)
    ${skillFilter}
    OPTIONAL MATCH (us)-[ev:EVIDENCED_BY]->(evidence)
    WHERE evidence:InterviewStory OR evidence:QuestionPerformance OR evidence:Certification
    OPTIONAL MATCH (evidence:InterviewStory)-[:ANALYZED_BY]->(analysis:StoryAnalysis)
    RETURN s.id AS skillId,
           s.name AS skillName,
           CASE
             WHEN evidence:InterviewStory THEN 'story'
             WHEN evidence:QuestionPerformance THEN 'performance'
             WHEN evidence:Certification THEN 'certification'
             ELSE null
           END AS evidenceType,
           evidence.id AS evidenceId,
           ev.relevanceScore AS relevanceScore,
           ev.isPrimary AS isPrimary,
           properties(evidence) AS evidenceData,
           properties(analysis) AS analysisData
    ORDER BY s.id, ev.isPrimary DESC, ev.relevanceScore DESC
    `,
    { engineerId, skillIds: skillIds ?? [] }
  );

  const evidenceBySkill = new Map<string, EvidenceExplanation>();

  for (const record of result.records) {
    const skillId = record.get('skillId') as string;
    const skillName = record.get('skillName') as string;
    const evidenceType = record.get('evidenceType') as string | null;

    if (!evidenceBySkill.has(skillId)) {
      evidenceBySkill.set(skillId, {
        skillId,
        skillName,
        evidenceItems: [],
      });
    }

    if (evidenceType) {
      const evidenceItem = parseEvidenceItem(
        evidenceType,
        record.get('evidenceId') as string,
        record.get('relevanceScore') as number,
        record.get('isPrimary') as boolean,
        record.get('evidenceData') as Record<string, unknown>,
        record.get('analysisData') as Record<string, unknown> | null
      );
      evidenceBySkill.get(skillId)!.evidenceItems.push(evidenceItem);
    }
  }

  return Array.from(evidenceBySkill.values());
}

function parseEvidenceItem(
  type: string,
  id: string,
  relevanceScore: number,
  isPrimary: boolean,
  data: Record<string, unknown>,
  analysisData: Record<string, unknown> | null
): EvidenceItem {
  switch (type) {
    case 'story':
      return {
        type: 'story',
        id,
        summary: generateStorySummary(data),
        relevanceScore,
        isPrimary,
        details: parseStoryDetails(data, analysisData),
      };
    case 'performance':
      return {
        type: 'performance',
        id,
        summary: generatePerformanceSummary(data),
        relevanceScore,
        isPrimary,
        details: parsePerformanceDetails(data),
      };
    case 'certification':
      return {
        type: 'certification',
        id,
        summary: generateCertificationSummary(data),
        relevanceScore,
        isPrimary,
        details: parseCertificationDetails(data),
      };
    default:
      throw new Error(`Unknown evidence type: ${type}`);
  }
}

function generateStorySummary(data: Record<string, unknown>): string {
  const action = data.action as string;
  const result = data.result as string;
  // First sentence of action + first sentence of result
  const actionSentence = action.split('.')[0];
  const resultSentence = result.split('.')[0];
  return `${actionSentence}. Result: ${resultSentence}.`;
}

function parseStoryDetails(
  data: Record<string, unknown>,
  analysisData: Record<string, unknown> | null
): StoryDetails {
  const details: StoryDetails = {
    situation: data.situation as string,
    task: data.task as string,
    action: data.action as string,
    result: data.result as string,
  };

  if (analysisData) {
    details.analysis = {
      clarityScore: analysisData.clarityScore as number,
      impactScore: analysisData.impactScore as number,
      ownershipScore: analysisData.ownershipScore as number,
      overallScore: analysisData.overallScore as number,
    };
  }

  return details;
}

function generatePerformanceSummary(data: Record<string, unknown>): string {
  const score = data.score as number;
  const technicalDepth = data.technicalDepth as string;
  return `Scored ${Math.round(score * 100)}% with ${technicalDepth}-level technical depth`;
}

function parsePerformanceDetails(data: Record<string, unknown>): PerformanceDetails {
  return {
    assessmentName: (data.assessmentName as string) ?? 'Assessment',
    questionSummary: (data.questionSummary as string) ?? '',
    score: data.score as number,
    maxScore: (data.maxScore as number) ?? 1.0,
    technicalDepth: data.technicalDepth as PerformanceDetails['technicalDepth'],
    feedback: data.feedback as string | undefined,
  };
}

function generateCertificationSummary(data: Record<string, unknown>): string {
  const name = data.name as string;
  const issuingOrg = data.issuingOrg as string;
  const verified = data.verified as boolean;
  return `${name} from ${issuingOrg}${verified ? ' (verified)' : ''}`;
}

function parseCertificationDetails(data: Record<string, unknown>): CertificationDetails {
  return {
    name: data.name as string,
    issuingOrg: data.issuingOrg as string,
    issueDate: data.issueDate as string,
    expiryDate: data.expiryDate as string | undefined,
    verified: data.verified as boolean,
  };
}
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `npm run typecheck`
- [x] Types are importable from other modules
- [ ] Evidence query returns expected structure (unit test)

#### Manual Verification
- [ ] Evidence query returns stories, assessments, and certifications for eng_priya

---

## Phase 2: Constraint Satisfaction Explanation Service

### Overview

Build the service that explains which constraints are satisfied and how each was matched (direct, descendant, correlated).

### Changes Required

#### 1. Constraint Explanation Service

**File**: `src/services/search-match-explanation/constraint-explanation.service.ts` (new file)

```typescript
import {
  AppliedFilter,
  AppliedFilterKind,
  EngineerMatch,
  MatchedSkill,
  MatchType,
  isSkillFilter,
  isPropertyFilter,
} from '../../types/search.types.js';
import { ConstraintExplanation } from '../../types/search-match-explanation.types.js';

export function generateConstraintExplanations(
  filters: AppliedFilter[],
  engineer: EngineerMatch
): ConstraintExplanation[] {
  return filters.map((filter) => generateSingleConstraintExplanation(filter, engineer));
}

function generateSingleConstraintExplanation(
  filter: AppliedFilter,
  engineer: EngineerMatch
): ConstraintExplanation {
  if (isSkillFilter(filter)) {
    return generateSkillConstraintExplanation(filter, engineer.matchedSkills);
  } else if (isPropertyFilter(filter)) {
    return generatePropertyConstraintExplanation(filter, engineer);
  }
  throw new Error(`Unknown filter kind: ${(filter as AppliedFilter).kind}`);
}

function generateSkillConstraintExplanation(
  filter: AppliedFilter & { kind: AppliedFilterKind.Skill },
  matchedSkills: MatchedSkill[]
): ConstraintExplanation {
  const requiredSkillIds = new Set(filter.skills.map((s) => s.skillId));
  const matchedForFilter: MatchedSkill[] = [];
  const matchTypes: MatchType[] = [];

  for (const matched of matchedSkills) {
    if (requiredSkillIds.has(matched.skillId)) {
      matchedForFilter.push(matched);
      matchTypes.push(matched.matchType as MatchType);
    }
  }

  const satisfied = matchedForFilter.length >= filter.skills.length;
  const primaryMatchType = determinePrimaryMatchType(matchTypes);

  const matchedNames = matchedForFilter.map(
    (m) => `${m.skillName} (${m.proficiencyLevel}, ${Math.round(m.confidenceScore * 100)}% confidence)`
  );

  let explanation: string;
  if (satisfied) {
    if (primaryMatchType === 'direct') {
      explanation = `Has required skill${filter.skills.length > 1 ? 's' : ''}: ${matchedNames.join(', ')}`;
    } else if (primaryMatchType === 'descendant') {
      explanation = `Has descendant skill${matchedForFilter.length > 1 ? 's' : ''} of ${filter.displayValue}: ${matchedNames.join(', ')}`;
    } else {
      explanation = `Has correlated skill${matchedForFilter.length > 1 ? 's' : ''}: ${matchedNames.join(', ')}`;
    }
  } else {
    const missing = filter.skills
      .filter((s) => !matchedForFilter.some((m) => m.skillId === s.skillId))
      .map((s) => s.skillName);
    explanation = `Missing required skill${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`;
  }

  return {
    constraint: filter,
    satisfied,
    explanation,
    matchedValues: matchedNames,
    matchType: primaryMatchType,
  };
}

function determinePrimaryMatchType(matchTypes: MatchType[]): MatchType | undefined {
  if (matchTypes.length === 0) return undefined;
  if (matchTypes.includes('direct')) return 'direct';
  if (matchTypes.includes('descendant')) return 'descendant';
  return 'correlated';
}

function generatePropertyConstraintExplanation(
  filter: AppliedFilter & { kind: AppliedFilterKind.Property },
  engineer: EngineerMatch
): ConstraintExplanation {
  const { field, operator, value } = filter;
  const engineerValue = getEngineerPropertyValue(engineer, field);
  const satisfied = evaluatePropertyConstraint(engineerValue, operator, value);

  const explanation = generatePropertyExplanationText(field, engineerValue, operator, value, satisfied);

  return {
    constraint: filter,
    satisfied,
    explanation,
    matchedValues: [String(engineerValue)],
  };
}

function getEngineerPropertyValue(engineer: EngineerMatch, field: string): unknown {
  switch (field) {
    case 'yearsExperience':
      return engineer.yearsExperience;
    case 'salary':
      return engineer.salary;
    case 'timezone':
      return engineer.timezone;
    case 'startTimeline':
      return engineer.startTimeline;
    default:
      return undefined;
  }
}

function evaluatePropertyConstraint(engineerValue: unknown, operator: string, constraintValue: string): boolean {
  switch (operator) {
    case '>=':
      return (engineerValue as number) >= parseFloat(constraintValue);
    case '<=':
      return (engineerValue as number) <= parseFloat(constraintValue);
    case 'IN': {
      const allowedValues = JSON.parse(constraintValue) as string[];
      return allowedValues.includes(engineerValue as string);
    }
    case 'BETWEEN': {
      const [min, max] = constraintValue.split('-').map(parseFloat);
      const numValue = engineerValue as number;
      return numValue >= min && (isNaN(max) || numValue < max);
    }
    default:
      return false;
  }
}

function generatePropertyExplanationText(
  field: string,
  engineerValue: unknown,
  operator: string,
  constraintValue: string,
  satisfied: boolean
): string {
  const fieldLabels: Record<string, string> = {
    yearsExperience: 'years of experience',
    salary: 'salary',
    timezone: 'timezone',
    startTimeline: 'start availability',
  };

  const fieldLabel = fieldLabels[field] ?? field;

  if (satisfied) {
    switch (field) {
      case 'yearsExperience':
        return `Has ${engineerValue} ${fieldLabel} (required: ${formatOperatorValue(operator, constraintValue)})`;
      case 'salary':
        return `Salary of $${(engineerValue as number).toLocaleString()} is within budget (max: $${parseFloat(constraintValue).toLocaleString()})`;
      case 'timezone':
        return `In ${engineerValue} timezone (allowed: ${constraintValue})`;
      case 'startTimeline':
        return `Available ${engineerValue} (required: ${constraintValue})`;
      default:
        return `${fieldLabel}: ${engineerValue} meets requirement`;
    }
  } else {
    switch (field) {
      case 'yearsExperience':
        return `Has ${engineerValue} ${fieldLabel} (required: ${formatOperatorValue(operator, constraintValue)})`;
      case 'salary':
        return `Salary of $${(engineerValue as number).toLocaleString()} exceeds budget (max: $${parseFloat(constraintValue).toLocaleString()})`;
      case 'timezone':
        return `In ${engineerValue} timezone (not in allowed: ${constraintValue})`;
      case 'startTimeline':
        return `Available ${engineerValue} (required: ${constraintValue})`;
      default:
        return `${fieldLabel}: ${engineerValue} does not meet requirement`;
    }
  }
}

function formatOperatorValue(operator: string, value: string): string {
  switch (operator) {
    case '>=':
      return `≥${value}`;
    case '<=':
      return `≤${value}`;
    case 'BETWEEN':
      return value.replace('-', '–');
    case 'IN':
      return JSON.parse(value).join(' or ');
    default:
      return value;
  }
}
```

### Success Criteria

#### Automated Verification
- [ ] Unit tests for skill constraint explanations (direct, descendant, missing)
- [ ] Unit tests for property constraint explanations (years, salary, timezone, timeline)
- [ ] TypeScript compiles: `npm run typecheck`

#### Manual Verification
- [ ] Constraint explanations are human-readable and accurate

---

## Phase 3: Score Component Explanation Service

### Overview

Build the service that explains how each scoring component contributed to the engineer's match score.

### Changes Required

#### 1. Score Explanation Service

**File**: `src/services/search-match-explanation/score-explanation.service.ts` (new file)

```typescript
import { ScoreBreakdown, PreferenceMatches } from '../../types/search.types.js';
import { ScoreExplanation } from '../../types/search-match-explanation.types.js';
import { utilityWeights } from '../../config/knowledge-base/utility.config.js';

interface ScoreContext {
  breakdown: ScoreBreakdown;
  engineerName: string;
}

export function generateScoreExplanations(context: ScoreContext): ScoreExplanation[] {
  const explanations: ScoreExplanation[] = [];

  // Core scores
  if (context.breakdown.scores.skillMatch !== undefined) {
    explanations.push(generateSkillMatchExplanation(context.breakdown.scores.skillMatch));
  }
  if (context.breakdown.scores.confidence !== undefined) {
    explanations.push(generateConfidenceExplanation(context.breakdown.scores.confidence));
  }
  if (context.breakdown.scores.experience !== undefined) {
    explanations.push(generateExperienceExplanation(context.breakdown.scores.experience));
  }

  // Preference matches
  const preferenceExplanations = generatePreferenceExplanations(context.breakdown.preferenceMatches);
  explanations.push(...preferenceExplanations);

  return explanations;
}

function generateSkillMatchExplanation(rawScore: number): ScoreExplanation {
  const weight = utilityWeights.skillMatch;
  const weightedScore = Math.round(rawScore * weight * 1000) / 1000;

  let explanation: string;
  if (rawScore >= 0.9) {
    explanation = 'Excellent proficiency match on required skills';
  } else if (rawScore >= 0.7) {
    explanation = 'Good proficiency match on required skills';
  } else if (rawScore >= 0.5) {
    explanation = 'Partial proficiency match on required skills';
  } else {
    explanation = 'Limited proficiency match on required skills';
  }

  return {
    component: 'skillMatch',
    weight,
    rawScore,
    weightedScore,
    explanation,
    contributingFactors: [], // Populated by caller with matched skill details
  };
}

function generateConfidenceExplanation(rawScore: number): ScoreExplanation {
  const weight = utilityWeights.confidenceScore;
  const weightedScore = Math.round(rawScore * weight * 1000) / 1000;

  // Raw score is normalized from 0.5-1.0 range, so convert back
  const avgConfidence = rawScore * 0.5 + 0.5;

  let explanation: string;
  if (avgConfidence >= 0.9) {
    explanation = `Very high confidence in skill assessments (avg ${Math.round(avgConfidence * 100)}%)`;
  } else if (avgConfidence >= 0.75) {
    explanation = `Good confidence in skill assessments (avg ${Math.round(avgConfidence * 100)}%)`;
  } else {
    explanation = `Moderate confidence in skill assessments (avg ${Math.round(avgConfidence * 100)}%)`;
  }

  return {
    component: 'confidence',
    weight,
    rawScore,
    weightedScore,
    explanation,
    contributingFactors: [],
  };
}

function generateExperienceExplanation(rawScore: number): ScoreExplanation {
  const weight = utilityWeights.yearsExperience;
  const weightedScore = Math.round(rawScore * weight * 1000) / 1000;

  // Reverse the logarithmic formula to get approximate years
  // rawScore = log(1 + years) / log(1 + 20)
  const years = Math.round(Math.exp(rawScore * Math.log(21)) - 1);

  let explanation: string;
  if (years >= 10) {
    explanation = `Staff+ level experience (${years}+ years)`;
  } else if (years >= 6) {
    explanation = `Senior level experience (${years} years)`;
  } else if (years >= 3) {
    explanation = `Mid-level experience (${years} years)`;
  } else {
    explanation = `Junior level experience (${years} years)`;
  }

  return {
    component: 'experience',
    weight,
    rawScore,
    weightedScore,
    explanation,
    contributingFactors: [`${years} years of experience`],
  };
}

function generatePreferenceExplanations(preferences: PreferenceMatches): ScoreExplanation[] {
  const explanations: ScoreExplanation[] = [];

  if (preferences.preferredSkillsMatch) {
    explanations.push({
      component: 'preferredSkillsMatch',
      weight: utilityWeights.preferredSkillsMatch,
      rawScore: preferences.preferredSkillsMatch.score,
      weightedScore: Math.round(preferences.preferredSkillsMatch.score * utilityWeights.preferredSkillsMatch * 1000) / 1000,
      explanation: preferences.preferredSkillsMatch.matchedSkills.length > 0
        ? `Has ${preferences.preferredSkillsMatch.matchedSkills.length} preferred skill(s)`
        : 'No preferred skills matched',
      contributingFactors: preferences.preferredSkillsMatch.matchedSkills,
    });
  }

  if (preferences.teamFocusMatch) {
    explanations.push({
      component: 'teamFocusMatch',
      weight: utilityWeights.teamFocusMatch,
      rawScore: preferences.teamFocusMatch.score,
      weightedScore: Math.round(preferences.teamFocusMatch.score * utilityWeights.teamFocusMatch * 1000) / 1000,
      explanation: preferences.teamFocusMatch.matchedSkills.length > 0
        ? `Aligns with team focus (${preferences.teamFocusMatch.matchedSkills.length} relevant skills)`
        : 'Limited alignment with team focus',
      contributingFactors: preferences.teamFocusMatch.matchedSkills,
    });
  }

  if (preferences.preferredBusinessDomainMatch) {
    explanations.push({
      component: 'preferredBusinessDomainMatch',
      weight: utilityWeights.preferredBusinessDomainMatch,
      rawScore: preferences.preferredBusinessDomainMatch.score,
      weightedScore: Math.round(preferences.preferredBusinessDomainMatch.score * utilityWeights.preferredBusinessDomainMatch * 1000) / 1000,
      explanation: preferences.preferredBusinessDomainMatch.matchedDomains.length > 0
        ? `Has experience in preferred business domain(s)`
        : 'No preferred business domain experience',
      contributingFactors: preferences.preferredBusinessDomainMatch.matchedDomains,
    });
  }

  if (preferences.preferredTechnicalDomainMatch) {
    explanations.push({
      component: 'preferredTechnicalDomainMatch',
      weight: utilityWeights.preferredTechnicalDomainMatch,
      rawScore: preferences.preferredTechnicalDomainMatch.score,
      weightedScore: Math.round(preferences.preferredTechnicalDomainMatch.score * utilityWeights.preferredTechnicalDomainMatch * 1000) / 1000,
      explanation: preferences.preferredTechnicalDomainMatch.matchedDomains.length > 0
        ? `Has experience in preferred technical domain(s)`
        : 'No preferred technical domain experience',
      contributingFactors: preferences.preferredTechnicalDomainMatch.matchedDomains,
    });
  }

  if (preferences.startTimelineMatch) {
    explanations.push({
      component: 'startTimelineMatch',
      weight: utilityWeights.startTimelineMatch,
      rawScore: preferences.startTimelineMatch.score,
      weightedScore: Math.round(preferences.startTimelineMatch.score * utilityWeights.startTimelineMatch * 1000) / 1000,
      explanation: preferences.startTimelineMatch.score >= 1.0
        ? `Available ${preferences.startTimelineMatch.actualTimeline} (meets preference)`
        : `Available ${preferences.startTimelineMatch.actualTimeline} (later than preferred)`,
      contributingFactors: [preferences.startTimelineMatch.actualTimeline],
    });
  }

  if (preferences.preferredTimezoneMatch) {
    explanations.push({
      component: 'preferredTimezoneMatch',
      weight: utilityWeights.preferredTimezoneMatch,
      rawScore: preferences.preferredTimezoneMatch.score,
      weightedScore: Math.round(preferences.preferredTimezoneMatch.score * utilityWeights.preferredTimezoneMatch * 1000) / 1000,
      explanation: preferences.preferredTimezoneMatch.score >= 1.0
        ? `In preferred timezone (${preferences.preferredTimezoneMatch.actualTimezone})`
        : `In ${preferences.preferredTimezoneMatch.actualTimezone} timezone`,
      contributingFactors: [preferences.preferredTimezoneMatch.actualTimezone],
    });
  }

  if (preferences.preferredSeniorityMatch) {
    explanations.push({
      component: 'preferredSeniorityMatch',
      weight: utilityWeights.preferredSeniorityMatch,
      rawScore: preferences.preferredSeniorityMatch.score,
      weightedScore: Math.round(preferences.preferredSeniorityMatch.score * utilityWeights.preferredSeniorityMatch * 1000) / 1000,
      explanation: preferences.preferredSeniorityMatch.score >= 1.0
        ? 'Meets preferred seniority level'
        : 'Below preferred seniority level',
      contributingFactors: [],
    });
  }

  if (preferences.budgetMatch && preferences.budgetMatch.score < 1.0) {
    explanations.push({
      component: 'budgetMatch',
      weight: utilityWeights.budgetMatch,
      rawScore: preferences.budgetMatch.score,
      weightedScore: Math.round(preferences.budgetMatch.score * utilityWeights.budgetMatch * 1000) / 1000,
      explanation: `Salary in stretch budget zone ($${preferences.budgetMatch.actualSalary.toLocaleString()})`,
      contributingFactors: [`$${preferences.budgetMatch.actualSalary.toLocaleString()}`],
    });
  }

  if (preferences.relatedSkillsMatch) {
    explanations.push({
      component: 'relatedSkillsMatch',
      weight: utilityWeights.relatedSkillsMatch,
      rawScore: preferences.relatedSkillsMatch.score,
      weightedScore: Math.round(preferences.relatedSkillsMatch.score * utilityWeights.relatedSkillsMatch * 1000) / 1000,
      explanation: `Has ${preferences.relatedSkillsMatch.count} additional related skills`,
      contributingFactors: [],
    });
  }

  return explanations;
}
```

### Success Criteria

#### Automated Verification
- [ ] Unit tests for core score explanations (skill, confidence, experience)
- [ ] Unit tests for preference match explanations (all 9 types)
- [ ] TypeScript compiles: `npm run typecheck`

#### Manual Verification
- [ ] Score explanations correctly reflect weight contributions

---

## Phase 4: Evidence Explanation Service

### Overview

Build the service that retrieves and formats evidence backing skill claims.

### Changes Required

#### 1. Evidence Explanation Service

**File**: `src/services/search-match-explanation/evidence-explanation.service.ts` (new file)

```typescript
import { Session } from 'neo4j-driver';
import { EvidenceExplanation } from '../../types/search-match-explanation.types.js';
import { queryEngineerEvidence } from './evidence-query.service.js';

export async function generateEvidenceExplanations(
  session: Session,
  engineerId: string,
  relevantSkillIds: string[]
): Promise<EvidenceExplanation[]> {
  /*
   * Query evidence only for skills that are relevant to the search:
   * - Required skills
   * - Preferred skills
   * - Derived skills from inference rules
   *
   * This keeps the response focused and avoids returning evidence
   * for skills not mentioned in the search criteria.
   */
  const allEvidence = await queryEngineerEvidence(session, engineerId, relevantSkillIds);

  // Filter to only include skills that have evidence
  const evidenceWithItems = allEvidence.filter((e) => e.evidenceItems.length > 0);

  // Sort by number of evidence items (most evidence first)
  evidenceWithItems.sort((a, b) => b.evidenceItems.length - a.evidenceItems.length);

  return evidenceWithItems;
}

export function summarizeEvidence(evidence: EvidenceExplanation[]): string {
  if (evidence.length === 0) {
    return 'No documented evidence for relevant skills';
  }

  const totalItems = evidence.reduce((sum, e) => sum + e.evidenceItems.length, 0);
  const skillsWithEvidence = evidence.length;

  const storyCount = evidence.reduce(
    (sum, e) => sum + e.evidenceItems.filter((i) => i.type === 'story').length,
    0
  );
  const performanceCount = evidence.reduce(
    (sum, e) => sum + e.evidenceItems.filter((i) => i.type === 'performance').length,
    0
  );
  const certCount = evidence.reduce(
    (sum, e) => sum + e.evidenceItems.filter((i) => i.type === 'certification').length,
    0
  );

  const parts: string[] = [];
  if (storyCount > 0) parts.push(`${storyCount} interview stor${storyCount === 1 ? 'y' : 'ies'}`);
  if (performanceCount > 0) parts.push(`${performanceCount} assessment performance${performanceCount === 1 ? '' : 's'}`);
  if (certCount > 0) parts.push(`${certCount} certification${certCount === 1 ? '' : 's'}`);

  return `${totalItems} evidence items across ${skillsWithEvidence} skills (${parts.join(', ')})`;
}
```

### Success Criteria

#### Automated Verification
- [ ] Unit tests for evidence filtering by skill IDs
- [ ] Unit tests for evidence summarization
- [ ] TypeScript compiles: `npm run typecheck`

#### Manual Verification
- [ ] Evidence explanations include STAR details for stories
- [ ] Assessment performances show score and technical depth

---

## Phase 5: Tradeoff Detection Service

### Overview

Build the service that detects and explains tradeoffs between the engineer's attributes and the ideal profile.

### Changes Required

#### 1. Tradeoff Explanation Service

**File**: `src/services/search-match-explanation/tradeoff-explanation.service.ts` (new file)

```typescript
import { TradeoffExplanation } from '../../types/search-match-explanation.types.js';
import { seniorityMapping } from '../../config/knowledge-base/compatibility-constraints.config.js';
import { SeniorityLevel, StartTimeline } from '../../types/search.types.js';
import { START_TIMELINE_ORDER } from '../../schemas/search.schema.js';

interface EngineerProfile {
  yearsExperience: number;
  salary: number;
  startTimeline: StartTimeline;
  timezone: string;
  skills: string[]; // Skill IDs the engineer has
}

/*
 * WHY ONLY PREFERRED CRITERIA, NOT REQUIRED?
 *
 * Tradeoffs and required constraints serve different purposes:
 *
 * | Type     | If engineer doesn't match                                    |
 * |----------|--------------------------------------------------------------|
 * | Required | Filtered out, or ConstraintExplanation.satisfied = false     |
 * | Preferred| Still shown, but it's a tradeoff                             |
 *
 * "Tradeoff" implies you're still considering the engineer despite the gap.
 * Failing a required constraint isn't a tradeoff - it's a disqualification.
 *
 * Required constraints are handled by ConstraintExplanation (satisfied: true/false).
 * TradeoffExplanation focuses on preference gaps - the compromises you'd make
 * if you hire this person.
 *
 * SearchPreferences is extracted from SearchFilterRequest fields:
 *   - preferredSeniorityLevel → preferredSeniorityLevel
 *   - maxBudget, stretchBudget → maxBudget, stretchBudget
 *   - preferredMaxStartTime → preferredMaxStartTime
 *   - preferredTimezone → preferredTimezone
 *   - preferredSkills → preferredSkillIds (after resolution)
 */
interface SearchPreferences {
  preferredSeniorityLevel?: SeniorityLevel;
  maxBudget?: number;
  stretchBudget?: number;
  preferredMaxStartTime?: StartTimeline;
  preferredTimezone?: string[];
  preferredSkillIds?: string[];
}

export function detectTradeoffs(
  engineer: EngineerProfile,
  preferences: SearchPreferences
): TradeoffExplanation[] {
  const tradeoffs: TradeoffExplanation[] = [];

  // Experience tradeoff
  if (preferences.preferredSeniorityLevel) {
    const experienceTradeoff = detectExperienceTradeoff(
      engineer.yearsExperience,
      preferences.preferredSeniorityLevel
    );
    if (experienceTradeoff) tradeoffs.push(experienceTradeoff);
  }

  // Salary tradeoff
  if (preferences.maxBudget) {
    const salaryTradeoff = detectSalaryTradeoff(
      engineer.salary,
      preferences.maxBudget,
      preferences.stretchBudget
    );
    if (salaryTradeoff) tradeoffs.push(salaryTradeoff);
  }

  // Timeline tradeoff
  if (preferences.preferredMaxStartTime) {
    const timelineTradeoff = detectTimelineTradeoff(
      engineer.startTimeline,
      preferences.preferredMaxStartTime
    );
    if (timelineTradeoff) tradeoffs.push(timelineTradeoff);
  }

  // Timezone tradeoff
  if (preferences.preferredTimezone && preferences.preferredTimezone.length > 0) {
    const timezoneTradeoff = detectTimezoneTradeoff(
      engineer.timezone,
      preferences.preferredTimezone
    );
    if (timezoneTradeoff) tradeoffs.push(timezoneTradeoff);
  }

  // Missing preferred skills
  if (preferences.preferredSkillIds && preferences.preferredSkillIds.length > 0) {
    const skillTradeoff = detectMissingPreferredSkills(
      engineer.skills,
      preferences.preferredSkillIds
    );
    if (skillTradeoff) tradeoffs.push(skillTradeoff);
  }

  return tradeoffs;
}

function detectExperienceTradeoff(
  actualYears: number,
  preferredSeniority: SeniorityLevel
): TradeoffExplanation | null {
  const { minYears, maxYears } = seniorityMapping[preferredSeniority];

  if (actualYears < minYears) {
    return {
      attribute: 'yearsExperience',
      requested: `${minYears}+ years (${preferredSeniority})`,
      actual: actualYears,
      explanation: `Has ${actualYears} years experience (${preferredSeniority} level expects ${minYears}+ years)`,
    };
  }

  if (maxYears !== null && actualYears > maxYears + 2) {
    return {
      attribute: 'yearsExperience',
      requested: `${minYears}-${maxYears} years (${preferredSeniority})`,
      actual: actualYears,
      explanation: `Has ${actualYears} years experience (${preferredSeniority} range is ${minYears}-${maxYears} years)`,
    };
  }

  return null;
}

function detectSalaryTradeoff(
  actualSalary: number,
  maxBudget: number,
  stretchBudget?: number
): TradeoffExplanation | null {
  if (actualSalary <= maxBudget) {
    return null; // Within budget, no tradeoff
  }

  const overAmount = actualSalary - maxBudget;
  const overPercent = (overAmount / maxBudget) * 100;
  const inStretch = stretchBudget && actualSalary <= stretchBudget;

  return {
    attribute: 'salary',
    requested: maxBudget,
    actual: actualSalary,
    explanation: inStretch
      ? `Salary ($${actualSalary.toLocaleString()}) is $${overAmount.toLocaleString()} over budget ($${maxBudget.toLocaleString()}) but within stretch range ($${stretchBudget!.toLocaleString()})`
      : `Salary ($${actualSalary.toLocaleString()}) is $${overAmount.toLocaleString()} over budget ($${maxBudget.toLocaleString()})`,
  };
}

function detectTimelineTradeoff(
  actualTimeline: StartTimeline,
  preferredTimeline: StartTimeline
): TradeoffExplanation | null {
  const actualIndex = START_TIMELINE_ORDER.indexOf(actualTimeline);
  const preferredIndex = START_TIMELINE_ORDER.indexOf(preferredTimeline);

  if (actualIndex <= preferredIndex) {
    return null; // Available at or before preferred, no tradeoff
  }

  return {
    attribute: 'startTimeline',
    requested: preferredTimeline,
    actual: actualTimeline,
    explanation: `Available ${actualTimeline.replace('_', ' ')} (preferred: ${preferredTimeline.replace('_', ' ')})`,
  };
}

function detectTimezoneTradeoff(
  actualTimezone: string,
  preferredTimezones: string[]
): TradeoffExplanation | null {
  if (preferredTimezones.includes(actualTimezone)) {
    return null; // In preferred timezone, no tradeoff
  }

  return {
    attribute: 'timezone',
    requested: preferredTimezones,
    actual: actualTimezone,
    explanation: `In ${actualTimezone} timezone (preferred: ${preferredTimezones.join(' or ')})`,
  };
}

function detectMissingPreferredSkills(
  engineerSkills: string[],
  preferredSkillIds: string[]
): TradeoffExplanation | null {
  const engineerSkillSet = new Set(engineerSkills);
  const missingSkills = preferredSkillIds.filter((id) => !engineerSkillSet.has(id));

  if (missingSkills.length === 0) {
    return null;
  }

  return {
    attribute: 'preferredSkills',
    requested: preferredSkillIds.length,
    actual: preferredSkillIds.length - missingSkills.length,
    explanation: `Has ${preferredSkillIds.length - missingSkills.length} of ${preferredSkillIds.length} preferred skills`,
  };
}

export function summarizeTradeoffs(tradeoffs: TradeoffExplanation[]): string {
  if (tradeoffs.length === 0) {
    return 'No tradeoffs detected';
  }

  const attributes = tradeoffs.map((t) => t.attribute);
  return `${tradeoffs.length} tradeoff${tradeoffs.length === 1 ? '' : 's'}: ${attributes.join(', ')}`;
}
```

### Success Criteria

#### Automated Verification
- [ ] Unit tests for experience tradeoffs (under, over, within range)
- [ ] Unit tests for salary tradeoffs (within, stretch, over)
- [ ] Unit tests for timeline tradeoffs
- [ ] Unit tests for missing preferred skills
- [ ] TypeScript compiles: `npm run typecheck`

#### Manual Verification
- [ ] Tradeoff explanations provide clear facts without subjective judgments

---

## Phase 6: Orchestration Service with Dual Explanation Integration

### Overview

Build the main explanation service that orchestrates all components and integrates with the LLM service for rich explanations.

### Pre-requisite: Add engineerId to Search Schema

**File**: `src/schemas/search.schema.ts`

Add `engineerId` to `SearchFilterRequestSchema` to allow filtering search results to a specific engineer:

```typescript
export const SearchFilterRequestSchema = z.object({
  // ... existing fields ...

  // Optional: filter to a specific engineer (used by /explain endpoint)
  engineerId: z.string().optional(),
});
```

**File**: `src/services/cypher-query-builder/filter-clause.builder.ts`

Add handling for `engineerId` in the filter clause builder:

```typescript
if (request.engineerId) {
  whereClauses.push('e.id = $engineerId');
  params.engineerId = request.engineerId;
}
```

This allows the explain endpoint to reuse `executeSearch` and get all computed data (matchType, scores, filters) for free.

### Changes Required

#### 1. Main Explanation Service

**File**: `src/services/search-match-explanation/search-match-explanation.service.ts` (new file)

```typescript
import { Session } from 'neo4j-driver';
import {
  SearchFilterRequest,
  EngineerMatch,
  AppliedFilter,
} from '../../types/search.types.js';
import {
  SearchMatchExplanation,
  ConstraintExplanation,
  ScoreExplanation,
  EvidenceExplanation,
  TradeoffExplanation,
} from '../../types/search-match-explanation.types.js';
import { executeSearch } from '../search.service.js';
import { generateConstraintExplanations } from './constraint-explanation.service.js';
import { generateScoreExplanations } from './score-explanation.service.js';
import { generateEvidenceExplanations, summarizeEvidence } from './evidence-explanation.service.js';
import { detectTradeoffs, summarizeTradeoffs } from './tradeoff-explanation.service.js';
import { generateCompletion } from '../llm.service.js';

/*
 * WHY REUSE executeSearch INSTEAD OF LOADING DATA MANUALLY?
 *
 * The /explain endpoint is called for engineers that appeared in search results.
 * Rather than reimplementing matching logic (matchType computation, score calculation,
 * constraint expansion), we reuse executeSearch with an engineerId filter.
 *
 * This guarantees:
 * - Accurate matchType (direct/descendant/correlated) from existing logic
 * - Consistent score breakdown with /filter endpoint
 * - No duplication of constraint expansion or skill resolution
 * - Single source of truth for how engineers are evaluated
 *
 * The engineerId field is added to SearchFilterRequest to support this pattern.
 */

interface ExplainRequest {
  engineerId: string;
  searchCriteria: SearchFilterRequest;
}

const LLM_SYSTEM_PROMPT = `You are an expert tech recruiter explaining why a software engineer matches (or doesn't match) a hiring manager's search criteria.

You will receive:
1. The engineer's profile summary
2. Constraint satisfaction details
3. Score breakdown
4. Evidence backing their skills
5. Any tradeoffs vs the ideal profile

Your task: Write a concise explanation (typically 2-4 sentences, but use more if the situation warrants it) that:
- Highlights the engineer's strongest qualifications
- Acknowledges any tradeoffs honestly
- Uses specific evidence when relevant
- Is concise but informative

Write in a professional, objective tone.`;

export async function generateSearchMatchExplanation(
  session: Session,
  request: ExplainRequest
): Promise<SearchMatchExplanation> {
  // Step 1: Run search with engineerId filter to get computed match data
  // This reuses all existing matching logic (matchType, scores, constraints)
  const searchResponse = await executeSearch(session, {
    ...request.searchCriteria,
    engineerId: request.engineerId,
  });

  if (searchResponse.matches.length === 0) {
    throw new Error(
      `Engineer ${request.engineerId} does not match the given search criteria`
    );
  }

  const engineerMatch = searchResponse.matches[0];

  // Step 2: Generate constraint explanations using computed appliedFilters
  const constraintExplanations = generateConstraintExplanations(
    searchResponse.appliedFilters,
    engineerMatch
  );

  // Step 3: Generate score explanations using computed scoreBreakdown
  const scoreExplanations = generateScoreExplanations({
    breakdown: engineerMatch.scoreBreakdown,
    engineerName: engineerMatch.name,
  });

  // Step 4: Collect relevant skill IDs for evidence (from matched skills)
  const relevantSkillIds = engineerMatch.matchedSkills.map((s) => s.skillId);

  // Step 5: Generate evidence explanations
  const evidenceExplanations = await generateEvidenceExplanations(
    session,
    request.engineerId,
    relevantSkillIds
  );

  // Step 6: Detect tradeoffs
  const tradeoffExplanations = detectTradeoffs(
    {
      yearsExperience: engineerMatch.yearsExperience,
      salary: engineerMatch.salary,
      startTimeline: engineerMatch.startTimeline as any,
      timezone: engineerMatch.timezone,
      skills: engineerMatch.matchedSkills.map((s) => s.skillId),
    },
    {
      preferredSeniorityLevel: request.searchCriteria.preferredSeniorityLevel,
      maxBudget: request.searchCriteria.maxBudget,
      stretchBudget: request.searchCriteria.stretchBudget,
      preferredMaxStartTime: request.searchCriteria.preferredMaxStartTime,
      preferredTimezone: request.searchCriteria.preferredTimezone,
      preferredSkillIds: searchResponse.appliedPreferences
        .filter((p) => p.kind === 'skill')
        .flatMap((p) => p.skills.map((s) => s.skillId)),
    }
  );

  // Step 7: Generate LLM narrative
  const narrative = await generateLLMNarrative(
    engineerMatch,
    constraintExplanations,
    scoreExplanations,
    evidenceExplanations,
    tradeoffExplanations
  );

  // Step 8: Generate summary
  const summary = generateSummary(
    constraintExplanations,
    scoreExplanations,
    tradeoffExplanations,
    narrative
  );

  return {
    engineer: {
      id: engineerMatch.id,
      name: engineerMatch.name,
      headline: engineerMatch.headline,
    },
    matchScore: engineerMatch.utilityScore,
    summary,
    constraints: constraintExplanations,
    scores: scoreExplanations,
    evidence: evidenceExplanations,
    tradeoffs: tradeoffExplanations,
  };
}

async function generateLLMNarrative(
  engineer: EngineerMatch,
  constraints: ConstraintExplanation[],
  scores: ScoreExplanation[],
  evidence: EvidenceExplanation[],
  tradeoffs: TradeoffExplanation[]
): Promise<string | null> {
  const context = buildLLMContext(engineer, constraints, scores, evidence, tradeoffs);
  return generateCompletion(context, LLM_SYSTEM_PROMPT);
}

function generateSummary(
  constraints: ConstraintExplanation[],
  scores: ScoreExplanation[],
  tradeoffs: TradeoffExplanation[],
  narrative: string | null
): SearchMatchExplanation['summary'] {
  // Constraint summary
  const satisfied = constraints.filter((c) => c.satisfied).length;
  const total = constraints.length;
  const constraintsSummary =
    total === 0
      ? 'No constraints applied'
      : satisfied === total
        ? `Matches all ${total} requirement${total === 1 ? '' : 's'}`
        : `Matches ${satisfied} of ${total} requirements`;

  // Strength summary - find highest weighted score
  const sortedScores = [...scores].sort((a, b) => b.weightedScore - a.weightedScore);
  const topScore = sortedScores[0];
  const strengthsSummary = topScore
    ? `Strongest: ${formatComponentName(topScore.component)} (${Math.round(topScore.rawScore * 100)}%)`
    : 'No scores calculated';

  // Tradeoff summary
  const tradeoffsSummary = summarizeTradeoffs(tradeoffs);

  return {
    constraints: constraintsSummary,
    strengths: strengthsSummary,
    tradeoffs: tradeoffsSummary,
    narrative,
  };
}

function buildLLMContext(
  engineer: EngineerMatch,
  constraints: ConstraintExplanation[],
  scores: ScoreExplanation[],
  evidence: EvidenceExplanation[],
  tradeoffs: TradeoffExplanation[]
): string {
  const parts: string[] = [];

  // Engineer profile
  parts.push(`# Engineer Profile`);
  parts.push(`Name: ${engineer.name}`);
  parts.push(`Headline: ${engineer.headline}`);
  parts.push(`Experience: ${engineer.yearsExperience} years`);
  parts.push(`Timezone: ${engineer.timezone}`);
  parts.push(`Available: ${engineer.startTimeline}`);
  parts.push('');

  // Constraint satisfaction
  parts.push(`# Constraint Satisfaction`);
  for (const c of constraints) {
    const status = c.satisfied ? '✓' : '✗';
    parts.push(`${status} ${c.explanation}`);
  }
  parts.push('');

  // Top score components
  parts.push(`# Score Components (top 3)`);
  const topScores = [...scores].sort((a, b) => b.weightedScore - a.weightedScore).slice(0, 3);
  for (const s of topScores) {
    parts.push(`- ${formatComponentName(s.component)}: ${Math.round(s.rawScore * 100)}% (weight: ${Math.round(s.weight * 100)}%)`);
    if (s.contributingFactors.length > 0) {
      parts.push(`  Factors: ${s.contributingFactors.slice(0, 3).join(', ')}`);
    }
  }
  parts.push('');

  // Evidence summary
  parts.push(`# Evidence`);
  parts.push(summarizeEvidence(evidence));
  if (evidence.length > 0) {
    const topEvidence = evidence[0];
    const primaryItem = topEvidence.evidenceItems.find((e) => e.isPrimary);
    if (primaryItem) {
      parts.push(`Primary evidence for ${topEvidence.skillName}: ${primaryItem.summary}`);
    }
  }
  parts.push('');

  // Tradeoffs
  if (tradeoffs.length > 0) {
    parts.push(`# Tradeoffs`);
    for (const t of tradeoffs) {
      parts.push(`- ${t.explanation}`);
    }
  }

  return parts.join('\n');
}

/*
 * Shared utility for formatting score component names.
 * Called by both generateDataAwareExplanation and buildLLMContext.
 * Placed after both callers per parent-first ordering convention.
 */
function formatComponentName(component: string): string {
  const nameMap: Record<string, string> = {
    skillMatch: 'skill proficiency',
    confidence: 'confidence scores',
    experience: 'years of experience',
    preferredSkillsMatch: 'preferred skills',
    teamFocusMatch: 'team focus alignment',
    relatedSkillsMatch: 'related skills',
    preferredBusinessDomainMatch: 'business domain',
    preferredTechnicalDomainMatch: 'technical domain',
    startTimelineMatch: 'start availability',
    preferredTimezoneMatch: 'timezone',
    preferredSeniorityMatch: 'seniority level',
    budgetMatch: 'budget fit',
  };
  return nameMap[component] ?? component;
}
```

### Success Criteria

#### Automated Verification
- [ ] Unit tests for data-aware explanation generation
- [ ] Unit tests for LLM context building
- [ ] Integration test for full explanation flow (mocked DB)
- [ ] TypeScript compiles: `npm run typecheck`

#### Manual Verification
- [ ] Full explanation returns all expected components
- [ ] LLM explanation is coherent and relevant

---

## Phase 7: Controller, Schema, and Testing

### Overview

Build the HTTP controller, request validation schema, and comprehensive tests.

### Changes Required

#### 1. Request Schema

**File**: `src/schemas/search-match-explanation.schema.ts` (new file)

```typescript
import { z } from 'zod';
import { SearchFilterRequestSchema } from './search.schema.js';

export const explainRequestSchema = z.object({
  searchCriteria: SearchFilterRequestSchema,
});

export type ExplainRequest = z.infer<typeof explainRequestSchema>;
```

#### 2. Controller

**File**: `src/controllers/search-match-explanation.controller.ts` (new file)

```typescript
import { Request, Response, NextFunction } from 'express';
import { explainRequestSchema } from '../schemas/search-match-explanation.schema.js';
import { generateSearchMatchExplanation } from '../services/search-match-explanation/search-match-explanation.service.js';
import driver from '../neo4j.js';
import { ZodError } from 'zod';

export async function explainFilterMatch(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const session = driver.session();

  try {
    const engineerId = req.params.engineerId;
    if (!engineerId) {
      res.status(400).json({ error: 'Engineer ID is required' });
      return;
    }

    const validatedBody = explainRequestSchema.parse(req.body);

    const explanation = await generateSearchMatchExplanation(session, {
      engineerId,
      searchCriteria: validatedBody.searchCriteria,
    });

    res.json(explanation);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }

    next(error);
  } finally {
    await session.close();
  }
}
```

#### 3. Route Registration

**File**: `src/routes/index.ts` (modify existing)

Add to existing routes:

```typescript
import { explainFilterMatch } from '../controllers/search-match-explanation.controller.js';

// ... existing routes ...

router.post('/search/filter/:engineerId/explain', explainFilterMatch);
```

#### 4. Unit Tests

**File**: `src/services/search-match-explanation/__tests__/constraint-explanation.service.test.ts` (new)
**File**: `src/services/search-match-explanation/__tests__/score-explanation.service.test.ts` (new)
**File**: `src/services/search-match-explanation/__tests__/tradeoff-explanation.service.test.ts` (new)
**File**: `src/services/search-match-explanation/__tests__/evidence-explanation.service.test.ts` (new)
**File**: `src/services/search-match-explanation/__tests__/search-match-explanation.service.test.ts` (new)

#### 5. E2E Tests

**Update**: `postman/collections/search-filter-tests.postman_collection.json`

Add test scenarios:
- Basic explain request for eng_priya with simple criteria
- Explain request with all constraint types
- Explain request with inference rules
- Engineer not found (404)
- Validation errors (400)
- Reference engineer for similarity context (optional)

### Success Criteria

#### Automated Verification
- [x] All unit tests pass: `npm test`
- [x] All E2E tests pass: `npm run test:e2e`
- [x] TypeScript compiles: `npm run typecheck`
- [x] Linting passes: N/A (no lint script in this project)

#### Manual Verification
- [x] Endpoint returns expected response structure for eng_priya (verified by E2E test 89)
- [x] LLM explanations generate when Ollama is running (verified by E2E tests 89-94)
- [x] Graceful degradation when Ollama is unavailable (implemented with fallback summary)

---

## Testing Strategy

### Unit Tests

| Service | Key Test Cases |
|---------|---------------|
| constraint-explanation | Direct match, descendant match, missing skills, property constraints |
| score-explanation | All 11 utility components, edge cases (zero scores, missing data) |
| tradeoff-explanation | Experience gaps, salary over budget, timeline differences, missing skills |
| evidence-explanation | Stories, assessments, certifications, missing evidence |
| evidence-query | Cypher query returns expected structure |
| explanation | Orchestration flow, data-aware generation, LLM context |

### Integration Tests

- Full explanation flow with mocked Neo4j session
- LLM integration test (skips if Ollama unavailable)

### E2E Tests (Newman/Postman)

| Scenario | Expected |
|----------|----------|
| Basic explain for eng_priya | 200, all sections populated |
| Explain with inference rules | 200, derived constraints in response |
| Unknown engineer | 404 |
| Invalid request body | 400 with validation errors |
| Empty criteria | 200, minimal explanation |

---

## Architecture Summary

```
src/
├── controllers/
│   └── search-match-explanation.controller.ts  # HTTP handler
├── schemas/
│   └── search-match-explanation.schema.ts      # Request validation (Zod)
├── types/
│   └── search-match-explanation.types.ts       # All explanation types
├── services/
│   └── search-match-explanation/
│       ├── search-match-explanation.service.ts # Orchestrator
│       ├── constraint-explanation.service.ts
│       ├── score-explanation.service.ts
│       ├── evidence-explanation.service.ts
│       ├── evidence-query.service.ts           # Cypher queries for evidence
│       └── tradeoff-explanation.service.ts
└── routes/
    └── index.ts                                # Route registration
```

---

## References

- Original specification: `docs/chapter_5/chapter5_reading_and_learning_path.md` (lines 652-901)
- Requirements update: `thoughts/private/research/2026-01-20-project-6-requirements-update.md`
- LLM Service: `src/services/llm.service.ts:1-103`
- Conflict Explanation Pattern: `src/services/constraint-advisor/conflict-explanation.service.ts:49-261`
- Evidence Model: `seeds/types.ts:77-197`, `seeds/assessments.ts:1174-1277`
- Score Breakdowns: `src/types/search.types.ts:104-178`
- Constraint Types: `src/types/search.types.ts:200-293`
