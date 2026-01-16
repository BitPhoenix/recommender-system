---
date: 2026-01-16T10:30:00-07:00
researcher: Claude
git_commit: 1f6ba00805902403424a2bf48eaf795f4a37e4d5
branch: project_2.5
repository: recommender_system
topic: "Code Walkthrough Plan: Local LLM Integration for Conflict Explanations"
tags: [walkthrough, llm, ollama, conflict-explanations, rag, constraint-advisor]
status: complete
last_updated: 2026-01-16
last_updated_by: Claude
---

# Code Walkthrough Plan: Local LLM Integration for Conflict Explanations

**Date**: 2026-01-16
**Researcher**: Claude
**Git Commit**: 1f6ba00805902403424a2bf48eaf795f4a37e4d5
**Branch**: project_2.5
**Repository**: recommender_system

## Overview

This walkthrough covers the implementation of local LLM (Ollama) integration for generating richer conflict explanations in the recommender system. The feature uses a **dual-explanation approach**:

1. **`dataAwareExplanation`**: Fast, factual template using actual database statistics
2. **`llmExplanation`**: RAG-enhanced LLM explanation with reasoning and alternatives

## Learning Objectives

After completing this walkthrough, you will understand:

1. How to integrate a local LLM (Ollama) into a Node.js/TypeScript application
2. The dual-explanation architecture pattern (template + LLM)
3. RAG (Retrieval-Augmented Generation) context building from database statistics
4. Graceful degradation patterns for optional AI features
5. Type-safe discriminated union patterns for constraint statistics
6. Testing strategies for LLM-enhanced features (mocked vs real)

---

## Walkthrough Structure

This walkthrough is organized into **5 modules**, each building on the previous:

| Module | Focus | Time | Key Concepts |
|--------|-------|------|--------------|
| 1. Foundation | Configuration & LLM Service | 15 min | Ollama client, connection caching, graceful degradation |
| 2. Statistics | Constraint Stats Types & Service | 20 min | Discriminated unions, Neo4j queries, type-specific enrichment |
| 3. Explanations | Dual Explanation Generator | 20 min | Template generation, RAG context building, LLM prompting |
| 4. Integration | Constraint Advisor Wiring | 15 min | Service integration, data flow, response structure |
| 5. Testing | Test Strategy | 10 min | Unit vs integration tests, mocking patterns |

---

## Module 1: Foundation - Configuration & LLM Service

### 1.1 Start Here: Configuration

**File**: `recommender_api/src/config.ts`

**Lines to read**: 1-25 (full file)

**Key points**:
- LLM configuration follows existing pattern (env vars with defaults)
- Four new config fields: `LLM_HOST`, `LLM_MODEL`, `LLM_ENABLED`, `LLM_TIMEOUT_MS`
- Default model: `qwen2.5:14b-instruct`
- `LLM_ENABLED` uses "opt-out" pattern (enabled unless explicitly set to "false")

```typescript
LLM_HOST: process.env.LLM_HOST || "http://127.0.0.1:11434",
LLM_MODEL: process.env.LLM_MODEL || "qwen2.5:14b-instruct",
LLM_ENABLED: process.env.LLM_ENABLED !== "false",  // Note: enabled by default
LLM_TIMEOUT_MS: parseInt(process.env.LLM_TIMEOUT_MS || "5000", 10),
```

**Question to consider**: Why is `LLM_ENABLED` default `true` instead of requiring explicit opt-in?

### 1.2 LLM Service Core

**File**: `recommender_api/src/services/llm.service.ts`

**Reading order**:
1. **Lines 9-17**: Client management (lazy singleton pattern)
2. **Lines 23-41**: `isLLMAvailable()` - connection verification with caching
3. **Lines 46-49**: `resetConnectionState()` - testing utility
4. **Lines 60-103**: `generateCompletion()` - main API

**Key patterns to understand**:

1. **Lazy initialization with caching**:
```typescript
let ollamaClient: Ollama | null = null;
let connectionVerified = false;

function getClient(): Ollama {
  if (!ollamaClient) {
    ollamaClient = new Ollama({ host: config.LLM_HOST });
  }
  return ollamaClient;
}
```

2. **Graceful degradation** - never throws, returns null on failure:
```typescript
export async function generateCompletion(prompt, options): Promise<string | null> {
  if (!(await isLLMAvailable())) {
    return null;  // Gracefully degrade
  }
  // ... actual completion logic
}
```

3. **Timeout handling with AbortController**:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), config.LLM_TIMEOUT_MS);
```

**Question to consider**: Why cache the connection state rather than checking availability on each request?

### 1.3 Kubernetes Integration

**File**: `helm_charts/recommender-api/values.dev.yaml`

**Lines to read**: 7-11

**Key insight**: The API runs inside minikube but Ollama runs on the host machine. Uses `host.minikube.internal` to bridge the network boundary:

```yaml
LLM_HOST: "http://host.minikube.internal:11434"
LLM_TIMEOUT_MS: "30000"  # Higher timeout for K8s networking
```

### 1.4 Tilt Health Check

**File**: `Tiltfile`

**Lines to read**: 101-112

**Key insight**: Ollama runs as a macOS system service (not in K8s) to access Apple Silicon GPU:

```python
local_resource(
    'ollama',
    cmd='curl -sf http://127.0.0.1:11434/api/tags > /dev/null && echo "Ollama is running"',
    labels=['recommender'],
    auto_init=True,
)
```

---

## Module 2: Statistics - Constraint Stats Types & Service

### 2.1 Type Definitions

**File**: `recommender_api/src/services/constraint-advisor/conflict-stats.types.ts`

**Reading order**:
1. **Lines 1-8**: File header explaining design rationale
2. **Lines 14-21**: `ConstraintStatsType` enum (discriminant)
3. **Lines 26-31**: `BaseConstraintStats` interface
4. **Lines 36-112**: Type-specific interfaces (one per constraint type)
5. **Lines 125-146**: `ConflictStats` aggregate interface

**Key pattern**: Discriminated union with type-specific enrichment

```typescript
// Base fields shared by all constraint types
interface BaseConstraintStats {
  displayValue: string;
  countMatching: number;
}

// Type-specific enrichment for skills
export interface SkillConstraintStats extends BaseConstraintStats {
  type: ConstraintStatsType.Skill;  // Discriminant
  skillId: string;
  proficiency: string;
  countAtLowerProficiency: number;  // Enrichment: alternatives at lower levels
}

// Type-specific enrichment for salary
export interface SalaryConstraintStats extends BaseConstraintStats {
  type: ConstraintStatsType.Salary;
  requestedMax: number;
  minSalaryInDb: number;  // Enrichment: actual DB range
  maxSalaryInDb: number;
}
```

**Question to consider**: Why use discriminated unions instead of a single generic stats type?

### 2.2 Statistics Service

**File**: `recommender_api/src/services/constraint-advisor/conflict-stats.service.ts`

**Reading order**:
1. **Lines 31-40**: `queryConstraintsStats()` - entry point (sequential, not parallel)
2. **Lines 45-95**: `getCountMatchingAllConstraints()` - combined AND logic
3. **Lines 100-128**: `queryConstraintStats()` - routing by type
4. **Lines 130-164**: `querySkillStats()` - example type-specific query
5. **Lines 202-256**: `queryYearsExperienceStats()` - uses `seniorityMapping` from config

**Key patterns**:

1. **Sequential execution** (Neo4j sessions aren't thread-safe):
```typescript
const results: ConstraintStats[] = [];
for (const c of constraints) {
  results.push(await queryConstraintStats(session, c));  // Sequential!
}
```

2. **Type-based routing**:
```typescript
if (isSkillTraversalConstraint(constraint)) {
  return querySkillStats(session, constraint);
}

switch (constraint.field) {
  case "yearsExperience": return queryYearsExperienceStats(session, constraint);
  case "salary": return querySalaryStats(session, constraint);
  // ...
}
```

3. **Config-driven bucket boundaries** (from canonical source):
```typescript
const { junior, mid, senior, staff } = seniorityMapping;  // Import from config
```

**Question to consider**: Why process constraints sequentially rather than with `Promise.all()`?

---

## Module 3: Explanations - Dual Explanation Generator

### 3.1 Main Entry Point

**File**: `recommender_api/src/services/constraint-advisor/conflict-explanation.service.ts`

**Reading order**:
1. **Lines 20-27**: `ConflictExplanations` interface
2. **Lines 29-40**: `LLM_SYSTEM_PROMPT` - expert context for LLM
3. **Lines 49-72**: `generateConflictExplanations()` - orchestrator

**Key insight**: Three separate data fetches, then two generation paths:

```typescript
// 1. Fetch all data
const countMatchingAll = await getCountMatchingAllConstraints(session, allConstraints);
const allConstraintStats = await queryConstraintsStats(session, allConstraints);
const conflictingConstraintStats = await queryConstraintsStats(session, conflictSetConstraints);

// 2. Generate both explanations
const dataAwareExplanation = generateDataAwareExplanation(stats);     // Fast, always works
const llmExplanation = await generateLLMExplanation(stats);           // Async, may return null
```

### 3.2 Data-Aware Template Generation

**Lines to read**: 78-154

**Structure**:
1. `generateDataAwareExplanation()` - assembles parts
2. `formatConstraintStats()` - type-specific formatting (switch on discriminant)

**Example output**:
```
Your search returns 0 engineers. The conflict: 12 with 10+ years experience
(DB distribution: junior: 6, mid: 12, senior: 10, staff+: 12). 8 within
$100,000 budget (salaries in DB range $85,000-$350,000).
```

**Key pattern**: Template only states facts from database, never makes assumptions.

### 3.3 RAG Context Building

**Lines to read**: 159-182, 187-247

**Key insight**: RAG context is more verbose than template, structured as markdown:

```typescript
function buildRAGContext(stats: ConflictStats): string {
  const lines = [
    "# Search Query Analysis",
    `Total engineers matching the full query: ${stats.countMatchingAll}`,
    "## Conflicting Constraints (the problem)",
    // ... detailed stats for conflict set
    "## Full Query Breakdown (all constraints)",
    // ... detailed stats for all constraints
  ];
  return lines.join("\n");
}
```

### 3.4 LLM Generation

**Lines to read**: 253-261

**Key insight**: Simple call to LLM service with RAG context as prompt:

```typescript
async function generateLLMExplanation(stats: ConflictStats): Promise<string | null> {
  const ragContext = buildRAGContext(stats);
  return generateCompletion(ragContext, { systemPrompt: LLM_SYSTEM_PROMPT });
}
```

**Question to consider**: Why pass the full query breakdown to the LLM, not just the conflict set?

---

## Module 4: Integration - Constraint Advisor Wiring

### 4.1 ConflictSet Type

**File**: `recommender_api/src/types/search.types.ts`

**Lines to read**: 311-326

**Key fields**:
```typescript
export interface ConflictSet {
  constraints: AppliedFilter[];
  dataAwareExplanation: string;      // Always present
  llmExplanation: string | null;     // Null if LLM unavailable
  stats: ConflictStats;              // Full statistics for transparency
}
```

### 4.2 Constraint Advisor Service

**File**: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.ts`

**Lines to read**: 79-124 (`formatConflictSets` function)

**Key insight**: Called for each minimal conflict set found by QUICKXPLAIN:

```typescript
for (const conflictSetConstraints of minimalSets) {
  const { dataAwareExplanation, llmExplanation, stats } =
    await generateConflictExplanations(
      session,
      allConstraints,           // Full query for context
      conflictSetConstraints    // Just this conflict set
    );

  results.push({
    constraints: /* formatted */,
    dataAwareExplanation,
    llmExplanation,
    stats,
  });
}
```

### 4.3 Data Flow Diagram

```
User Request
    │
    ▼
getConstraintAdvice()
    │
    ├── decomposeConstraints()
    │       └── Converts user request → TestableConstraint[]
    │
    ├── findMinimalConflictSets()  [QUICKXPLAIN]
    │       └── Returns minimal TestableConstraint[][]
    │
    └── formatConflictSets()
            │
            └── For each minimal set:
                    │
                    ▼
              generateConflictExplanations()
                    │
                    ├── getCountMatchingAllConstraints() → Neo4j
                    ├── queryConstraintsStats(all) → Neo4j
                    ├── queryConstraintsStats(conflict) → Neo4j
                    │
                    ├── generateDataAwareExplanation() → string
                    │
                    └── generateLLMExplanation()
                            │
                            ├── buildRAGContext() → markdown string
                            │
                            └── generateCompletion() → Ollama → string | null
```

---

## Module 5: Testing - Test Strategy

### 5.1 Unit Tests (Mocked Ollama)

**File**: `recommender_api/src/services/llm.service.test.ts`

**Key patterns**:

1. **Mock the Ollama library**:
```typescript
vi.mock("ollama", () => ({
  Ollama: class MockOllama {
    list = vi.fn().mockResolvedValue({ models: [] });
    chat = vi.fn().mockResolvedValue({
      message: { content: "Staff engineers typically earn $180,000+" },
    });
  },
}));
```

2. **Mock the config**:
```typescript
vi.mock("../config.js", () => ({
  default: { LLM_ENABLED: true, /* ... */ },
}));
```

### 5.2 Integration Tests (Real Ollama)

**File**: `recommender_api/src/services/__tests__/llm.integration.test.ts`

**Key patterns**:

1. **Check availability before running**:
```typescript
beforeAll(async () => {
  ollamaAvailable = await isLLMAvailable();
});

it("generates completion", async () => {
  if (!ollamaAvailable) {
    console.log("Skipping: Ollama not available");
    return;
  }
  // ... actual test
});
```

2. **Extended timeout for LLM latency**:
```typescript
it("respects system prompt", { timeout: 30000 }, async () => {
  // ...
});
```

### 5.3 Higher-Level Mocking

**File**: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.test.ts`

**Key insight**: Mock the entire conflict-explanation service to avoid LLM calls:

```typescript
vi.mock("./conflict-explanation.service.js", () => ({
  generateConflictExplanations: vi.fn().mockResolvedValue({
    dataAwareExplanation: "Your search returns 0 engineers.",
    llmExplanation: null,
    stats: { /* ... */ },
  }),
}));
```

---

## Summary: Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Dual explanations** | Template for reliability, LLM for richness; allows comparison |
| **Template uses only DB facts** | No assumptions that could be wrong |
| **LLM receives RAG context** | Grounds responses in actual data |
| **Graceful degradation** | Feature works (template-only) if Ollama unavailable |
| **Connection caching** | Avoids repeated health checks |
| **Sequential Neo4j queries** | Sessions aren't thread-safe |
| **Ollama on host (not K8s)** | Access to Apple Silicon GPU |
| **Discriminated union types** | Type-safe handling of different constraint kinds |

## Verification Checklist

After completing the walkthrough, verify understanding by:

- [ ] Explain why `llmExplanation` can be `null` but `dataAwareExplanation` is always present
- [ ] Trace the data flow from user request to LLM prompt
- [ ] Identify where the RAG context is built and what it contains
- [ ] Explain why constraint stats are queried sequentially, not in parallel
- [ ] Describe the testing strategy for mocked vs real Ollama

## Related Documentation

- Implementation plan: `thoughts/shared/1_chapter_5/2.5_project_2.5/plans/2026-01-15-local-llm-integration-for-explanations.md`
- Research on conflict explanations: `thoughts/shared/1_chapter_5/2.5_project_2.5/research/2026-01-14-conflict-explanation-generation.md`
