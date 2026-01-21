---
date: 2026-01-20T10:30:00-08:00
researcher: Claude
git_commit: 9f36ee8a4014c1304ca4e18e24fdc8c213c212d9
branch: project_5
repository: recommender_system
topic: "Project 6 Requirements Update - Explanation Generation Based on Current Codebase"
tags: [research, codebase, project-6, explanation-generation, llm, evidence]
status: complete
last_updated: 2026-01-20
last_updated_by: Claude
---

# Research: Project 6 Requirements Update - Explanation Generation

**Date**: 2026-01-20T10:30:00-08:00
**Researcher**: Claude
**Git Commit**: 9f36ee8a4014c1304ca4e18e24fdc8c213c212d9
**Branch**: project_5
**Repository**: recommender_system

## Research Question

Update Project 6 (Explanation Generation) requirements based on comprehensive understanding of the current codebase. The original requirements were written before the codebase existed and need to align with:
1. Existing explanation infrastructure (LLM, templates)
2. Evidence data model (stories, assessments, certifications)
3. Score breakdown transparency already in place
4. Constraint satisfaction tracking in the search pipeline
5. Project 5's critique system (now complete)

## Summary

The codebase has evolved significantly since Project 6 was originally specified. Key findings:

1. **Substantial explanation infrastructure already exists** from Project 2.5's LLM integration - including data-aware templates, RAG context generation, and dual explanation patterns
2. **Evidence data model is fully seeded** with stories, assessments, certifications, and the `EVIDENCED_BY` relationship linking skills to proof
3. **Score breakdowns are comprehensive** - both utility (11 components) and similarity (4 components) already return detailed breakdowns with matched items
4. **Constraint tracking is thorough** - AppliedFilters, DerivedConstraints with derivation chains, and source attribution all exist
5. **Project 5 is complete** - The critique endpoint exists with full dynamic suggestion support, establishing the conversational context Project 6 needs

Project 6 should focus on **engineer-specific explanation generation** (explaining why a particular engineer matches) rather than general constraint explanation (which Project 2.5 handles for conflicts).

## Detailed Findings

### 1. Existing Explanation Infrastructure (Project 2.5)

Project 2.5 established a robust foundation for explanation generation:

**LLM Service** (`src/services/llm.service.ts:1-103`):
- Ollama integration with graceful degradation
- Connection caching for efficiency
- Configurable timeout, model selection
- Returns `null` if LLM unavailable (never throws)

**Data-Aware Templates** (`src/services/constraint-advisor/conflict-explanation.service.ts:78-154`):
- `generateDataAwareExplanation()` - builds explanations from database statistics
- No assumptions - only facts from actual DB queries
- Instant response (~50ms)

**RAG Context Generation** (`src/services/constraint-advisor/conflict-explanation.service.ts:156-261`):
- `buildRAGContext()` - structures multi-section context for LLM
- Includes conflicting constraints + full query breakdown
- System prompt with domain expertise framing

**Statistics Service** (`src/services/constraint-advisor/conflict-stats.service.ts`):
- Per-constraint-type statistic queries
- Discriminated union pattern for type safety
- Returns actual counts and distributions from DB

**Reusable Patterns for Project 6:**
| Pattern | Location | Application |
|---------|----------|-------------|
| Dual explanations | `ConflictSet.dataAwareExplanation` + `llmExplanation` | Engineer match explanations |
| RAG context structure | `buildRAGContext()` | Evidence-enhanced prompts |
| Statistics queries | `conflict-stats.service.ts` | Engineer capability queries |
| Type-safe stats | `conflict-stats.types.ts` | Explanation data types |

### 2. Evidence Data Model

The evidence model is fully implemented with rich seed data:

**Node Types:**
| Node | Key Properties | Seed Count |
|------|---------------|------------|
| InterviewStory | situation, task, action, result (STAR) | 80+ stories |
| StoryAnalysis | clarityScore, impactScore, ownershipScore | Per story |
| Assessment | name, assessmentType, totalQuestions | 7 types |
| AssessmentQuestion | summary, maxScore, evaluationCriteria | 20+ questions |
| QuestionPerformance | score, technicalDepth, feedback | 80+ performances |
| Certification | name, issuingOrg, issueDate, verified | 8 credential types |
| SkillEvidence | relevanceScore, isPrimary | 80+ links |

**Evidence Relationships:**
```
Engineer -[:TOLD]-> InterviewStory -[:DEMONSTRATES]-> Skill (strength: 0-1)
Engineer -[:ATTEMPTED]-> AssessmentAttempt -[:INCLUDES]-> QuestionPerformance
QuestionPerformance -[:FOR_QUESTION]-> AssessmentQuestion -[:TESTS]-> Skill (weight)
Engineer -[:HOLDS]-> Certification -[:VALIDATES]-> Skill
UserSkill -[:EVIDENCED_BY]-> (Story|Performance|Certification) (relevanceScore, isPrimary)
```

**Key Files:**
- `seeds/types.ts:77-197` - All evidence interfaces
- `seeds/stories.ts` - STAR-format stories with demonstrations
- `seeds/assessments.ts:1174-1277` - SkillEvidence links
- `seeds/seed.ts:255-498` - Relationship creation

### 3. Score Breakdown Transparency

**Utility Score Breakdown** (`src/types/search.types.ts:104-178`):

Already returns comprehensive breakdown:
```typescript
interface ScoreBreakdown {
  scores: Partial<CoreScores>;        // skillMatch, confidence, experience
  preferenceMatches: PreferenceMatches;  // 9 optional match types with details
  total: number;
}
```

Each preference match includes **matched items** for transparency:
- `preferredSkillsMatch`: {score, matchedSkills: string[]}
- `teamFocusMatch`: {score, matchedSkills: string[]}
- `preferredBusinessDomainMatch`: {score, matchedDomains: string[]}
- etc.

**Similarity Score Breakdown** (`src/types/filter-similarity.types.ts:37-51`):
```typescript
interface FilterSimilarityMatch {
  similarityScore: number;
  scoreBreakdown: SimilarityBreakdown;  // skills, experience, domain, timezone
  sharedSkills: string[];
  correlatedSkills: CorrelatedSkillPair[];
}
```

### 4. Constraint Satisfaction Tracking

**AppliedFilter Types** (`src/types/search.types.ts:200-230`):
- Discriminated union: `AppliedPropertyFilter | AppliedSkillFilter`
- Skill filters further split: `AppliedUserSkillFilter | AppliedDerivedSkillFilter`
- Every filter has `source: ConstraintSource` tracking origin

**DerivedConstraintInfo** (`src/types/search.types.ts:268-293`):
- `rule`: {id, name} - which inference rule
- `action`: {effect, targetField, targetValue} - what it did
- `provenance.derivationChains`: string[][] - full causal paths
- `override`: scope and reason if overridden

**Skill Matching Details** (`src/types/search.types.ts:71-102`):
```typescript
interface MatchedSkill {
  matchType: 'direct' | 'descendant' | 'correlated' | 'none';
  // ... with proficiency, confidence, years
}
```

### 5. Project 5 (Critique) - Now Complete

Project 5 is fully implemented as of commit `9f36ee8`:

**Endpoint**: `POST /api/search/critique`

**Features:**
- Directional critiques (more/less, sooner/later, narrower/wider)
- Replacement critiques (set specific values)
- Add/remove operations for collections
- Dynamic critique suggestions with support metrics
- Compound pattern mining (2-property combinations)

**Key Files:**
- `src/controllers/critique.controller.ts`
- `src/services/critique.service.ts`
- `src/services/critique-interpreter.service.ts`
- `src/services/critique-generator/` - dynamic suggestions

**Relevance to Project 6:**
The textbook Section 5.3.3 "Explanation in Critiques" positions explanation as supporting the critique flow. With Project 5 complete, Project 6 can focus on explaining individual engineer matches within the conversational critiquing context.

## Updated Project 6 Requirements

Based on codebase analysis, here's the recommended scope:

### Original Specification (docs/chapter_5/chapter5_reading_and_learning_path.md)

```typescript
GET /api/engineers/:id/explain?searchId=:searchId
- Explain which constraints were satisfied and how
- Show evidence supporting each skill claim
- Highlight tradeoffs vs. the ideal profile
- Link to actual evidence (stories, assessments, certifications)
```

### Recommended Updates

#### 1. Endpoint Design

**Option A: Query Parameter Approach**
```typescript
GET /api/engineers/:id/explain?searchId=:searchId
```
- Requires storing search context (searchId → criteria mapping)
- More RESTful for "explain this engineer in context of that search"

**Option B: POST with Search Context**
```typescript
POST /api/engineers/:id/explain
{
  searchCriteria: SearchFilterRequest,  // Or minimal subset
  referenceEngineerId?: string          // For similarity explanations
}
```
- Simpler - no server-side state
- Can explain against any criteria (not just stored searches)
- Matches existing stateless patterns

**Recommendation**: Option B - avoids search state management, aligns with existing POST patterns.

#### 2. Explanation Types

Given existing infrastructure, focus on **three explanation types**:

**A. Constraint Satisfaction Explanation**
Reuses: AppliedFilters, DerivedConstraints, MatchedSkill types
```typescript
interface ConstraintExplanation {
  constraint: AppliedFilter;
  satisfied: boolean;
  explanation: string;           // Data-aware template
  matchedValues: string[];       // What matched
  matchType?: 'direct' | 'descendant' | 'correlated';
}
```

**B. Score Component Explanation**
Reuses: ScoreBreakdown, scoring functions
```typescript
interface ScoreExplanation {
  component: string;             // "skillMatch", "preferredTimezoneMatch"
  weight: number;                // From utility.config.ts
  rawScore: number;
  weightedScore: number;
  explanation: string;           // "Expert-level Node.js (0.95 proficiency)"
  contributingFactors: string[]; // ["Node.js (expert)", "TypeScript (proficient)"]
}
```

**C. Evidence Explanation**
NEW - leverages existing evidence model:
```typescript
interface EvidenceExplanation {
  skillId: string;
  skillName: string;
  evidenceItems: EvidenceItem[];
}

interface EvidenceItem {
  type: 'story' | 'assessment' | 'certification';
  id: string;
  summary: string;               // STAR summary or assessment result
  relevanceScore: number;
  isPrimary: boolean;
  details: StoryDetails | AssessmentDetails | CertificationDetails;
}
```

#### 3. Dual Explanation Pattern (From Project 2.5)

Apply the proven dual-explanation approach:

```typescript
interface EngineerExplanation {
  // Fast, factual template-based explanation
  dataAwareExplanation: {
    constraintSummary: string;     // "Matches 5 of 6 requirements"
    strengthSummary: string;       // "Strongest: Backend skills (expert Node.js)"
    tradeoffSummary: string;       // "Note: 8 years experience (ideal was 5)"
  };

  // Rich LLM explanation (nullable if unavailable)
  llmExplanation: string | null;  // "Priya is an excellent fit because..."

  // Structured data for UI rendering
  details: {
    constraints: ConstraintExplanation[];
    scores: ScoreExplanation[];
    evidence: EvidenceExplanation[];
    tradeoffs: TradeoffExplanation[];
  };
}
```

#### 4. Evidence Query Requirements

New Cypher patterns needed:

```cypher
// Get all evidence for an engineer's skills
MATCH (e:Engineer {id: $engineerId})-[:HAS_SKILL]->(us:UserSkill)
OPTIONAL MATCH (us)-[ev:EVIDENCED_BY]->(evidence)
WHERE evidence:InterviewStory OR evidence:QuestionPerformance OR evidence:Certification
RETURN us.skillId,
       collect({
         type: labels(evidence)[0],
         id: evidence.id,
         relevanceScore: ev.relevanceScore,
         isPrimary: ev.isPrimary,
         data: evidence
       }) AS evidenceItems
```

```cypher
// Get story demonstrations for skill
MATCH (s:InterviewStory)-[d:DEMONSTRATES]->(skill:Skill {id: $skillId})
MATCH (e:Engineer {id: $engineerId})-[:TOLD]->(s)
OPTIONAL MATCH (s)-[:ANALYZED_BY]->(analysis:StoryAnalysis)
RETURN s, d.strength, d.notes, analysis
```

#### 5. Tradeoff Detection

For "highlight tradeoffs vs ideal profile":

```typescript
interface TradeoffExplanation {
  attribute: string;           // "yearsExperience", "salary", "availability"
  engineerValue: unknown;      // 8 (years)
  idealValue: unknown;         // 5 (years)
  direction: 'over' | 'under'; // 'over'
  severity: 'minor' | 'moderate' | 'significant';
  explanation: string;         // "3 more years than requested (slight overqualification)"
}
```

Tradeoff detection logic:
- **Experience**: Compare to `preferredSeniorityLevel` or explicit years
- **Salary**: Compare to `maxBudget` and stretch budget
- **Timeline**: Compare to `requiredMaxStartTime`
- **Skills**: Missing preferred skills, excess skills beyond requirements

#### 6. Integration Points

| Component | Existing Location | Reuse Strategy |
|-----------|------------------|----------------|
| LLM Service | `llm.service.ts` | Direct reuse |
| Template Generation | `conflict-explanation.service.ts` | Pattern reuse |
| RAG Context | `buildRAGContext()` | Pattern adaptation |
| Score Calculation | `utility-calculator/` | Call for breakdown |
| Skill Matching | `similarity-calculator/` | Call for skill details |
| Evidence Model | `seeds/` + graph | New queries |
| Constraint Types | `search.types.ts` | Direct reuse |

### Architecture Recommendation

```
src/services/
└── explanation/
    ├── explanation.service.ts           # Orchestrator
    ├── constraint-explanation.service.ts # Constraint satisfaction
    ├── score-explanation.service.ts     # Score component explanations
    ├── evidence-explanation.service.ts  # Evidence retrieval & formatting
    ├── tradeoff-explanation.service.ts  # Tradeoff detection
    └── explanation.types.ts             # Types (or in types/)
```

### NOT in Scope (Already Handled)

| Feature | Handled By | Location |
|---------|-----------|----------|
| Conflict explanations | Project 2.5 | `conflict-explanation.service.ts` |
| Dynamic critiques | Project 5 | `critique-generator/` |
| Score breakdowns | Core search | `utility-calculator/` |
| Constraint tracking | Core search | `search.service.ts` |

## Code References

**Explanation Infrastructure:**
- `src/services/llm.service.ts:1-103` - LLM integration
- `src/services/constraint-advisor/conflict-explanation.service.ts:49-261` - Dual explanation pattern
- `src/services/constraint-advisor/conflict-stats.service.ts` - Statistics queries

**Evidence Model:**
- `seeds/types.ts:77-197` - All evidence interfaces
- `seeds/stories.ts` - Story data with DEMONSTRATES
- `seeds/assessments.ts:1174-1277` - SkillEvidence links
- `seeds/seed.ts:255-498` - Relationship seeding

**Score Transparency:**
- `src/types/search.types.ts:104-178` - ScoreBreakdown types
- `src/services/utility-calculator/utility-calculator.ts:51-236` - Breakdown generation
- `src/services/similarity-calculator/similarity-calculator.ts:42-107` - Similarity breakdown

**Constraint Tracking:**
- `src/types/search.types.ts:200-293` - AppliedFilter, DerivedConstraintInfo
- `src/services/constraint-expander.service.ts:128-238` - Filter building
- `src/services/rule-engine-adapter.ts:417-467` - Derivation chains

**Project 5 (Critique):**
- `src/controllers/critique.controller.ts` - Endpoint
- `src/services/critique.service.ts` - Orchestrator
- `src/services/critique-generator/` - Dynamic suggestions

## Architecture Insights

### Patterns to Follow

1. **Dual Explanation (Project 2.5)**: Always provide both template + LLM explanations
2. **Discriminated Unions (Projects 2, 5)**: Type-safe explanation variants
3. **Config-Driven (Utility Calculator)**: Centralize weights and thresholds
4. **Service Orchestration (Search Pipeline)**: Thin controller, orchestrating service

### Design Decisions for Project 6

1. **POST over GET**: Avoid server-side search state management
2. **Reuse LLM service**: Don't duplicate Ollama integration
3. **Evidence queries as service**: New `evidence-explanation.service.ts`
4. **Template patterns**: Follow `conflict-explanation.service.ts` patterns
5. **Type safety**: Discriminated unions for explanation types

## Historical Context (from thoughts/)

**Project 2.5 Summary** (`thoughts/shared/1_chapter_5/2.5_project_2.5/project_2.5_summary.md`):
- Established dual explanation pattern
- Proved local LLM viability
- Created statistics query infrastructure

**Project 2 Summary** (`thoughts/shared/1_chapter_5/2_project_2/project_2_summary.md`):
- Created discriminated union patterns
- Established constraint decomposition
- Built relaxation suggestion infrastructure

## Open Questions

1. **Search Context Storage**: Should we store search results for `searchId` lookups, or require full criteria in each explain request?
   - Recommendation: POST with criteria (stateless)

2. **Evidence Depth**: How much story/assessment detail to include inline vs require separate endpoint?
   - Recommendation: Summary inline, full detail via separate `/evidence/:id` endpoint

3. **LLM Prompt Design**: What persona/context works best for engineer explanations?
   - Research: Test different prompts, measure quality

4. **Caching**: Should explanation results be cached?
   - Recommendation: Defer - optimize if latency becomes issue

## Summary Table

| Aspect | Original Spec | Updated Recommendation |
|--------|--------------|----------------------|
| Endpoint | `GET ...?searchId=` | `POST /api/engineers/:id/explain` with body |
| Explanation Types | Implicit | 3 explicit: Constraint, Score, Evidence |
| Evidence | "Link to evidence" | Full EVIDENCED_BY traversal with details |
| LLM | Not specified | Dual explanation pattern from Project 2.5 |
| Tradeoffs | "Highlight tradeoffs" | Structured TradeoffExplanation type |
| Critique Context | Not mentioned | Integrates with Project 5 flow |
