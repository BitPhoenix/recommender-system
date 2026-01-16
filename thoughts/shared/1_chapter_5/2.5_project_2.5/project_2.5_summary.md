# Project 2.5: Local LLM Integration for Conflict Explanations

**Status**: Complete
**Duration**: January 15-16, 2026
**Branch**: `project_2.5`
**Git Commit**: 9a2081f7d7b62e8b3d47f9a6b35885357abd609f

---

## Executive Summary

Project 2.5 integrates a **local LLM (Ollama)** into the recommender API to generate richer, domain-aware conflict explanations. Building on Project 2's QUICKXPLAIN algorithm that detects minimal conflict sets, this project adds a **dual-explanation approach**:

1. **`dataAwareExplanation`** (Data-Aware Templates): Fast (~50ms), factual statements grounded in actual database queries. No assumptions—only facts from our data.
2. **`llmExplanation`** (RAG + LLM): Richer contextual explanation (~2-5s) that combines database facts with LLM reasoning about *why* conflicts occur and *what alternatives* might work.

Both fields are always populated (llmExplanation is null if LLM unavailable), allowing direct comparison of template vs. LLM quality and graceful degradation.

---

## Problem Statement

Project 2's constraint advisor could detect **what** constraints conflicted but not **why**:

```
Before: "The combination of staff seniority and $100,000 budget is too restrictive."
```

This is mechanically correct but unhelpful. Users need to understand:
- Why do these constraints conflict? (Market dynamics)
- What alternatives exist? (Concrete suggestions)
- How does the data look? (Factual grounding)

---

## Solution: Dual Explanation Architecture

### Data-Aware Templates (Always Available)

Templates query actual database statistics—no assumptions about market reality:

| Conflict Type | Template Output |
|--------------|-----------------|
| Seniority + Salary | "Your search returns 0 engineers. The conflict: 12 with 10+ years experience (distribution: junior: 6, mid: 12, senior: 10, staff+: 12). 8 within $100,000 budget (salaries in DB range $85,000-$350,000)." |
| Skill Combination | "0 with expert Rust (15 at lower proficiency). 2 with expert COBOL (3 at lower proficiency)." |
| Timezone Constraint | "15 in Eastern (DB distribution: Eastern: 15, Central: 12, Mountain: 8, Pacific: 5)." |

**Pros**: 100% factual, instant, no maintenance burden, never hallucinates.
**Cons**: Only answers "what"—cannot explain "why" or suggest alternatives intelligently.

### RAG-Enhanced LLM (Graceful Degradation)

The LLM receives database statistics as RAG context, then adds reasoning:

| Capability | Template | LLM |
|------------|----------|-----|
| Explain *why* data looks that way | No | "Staff engineers command $180k+ due to leadership responsibilities" |
| Suggest intelligent alternatives | No | "Consider senior level—10 engineers available within budget" |
| Handle novel constraint combinations | No | Can reason about any combination |
| Provide market context | No | "Staff engineers typically earn $200k-350k in the US market" |

**Pros**: Richer explanations, handles edge cases, provides actionable guidance.
**Cons**: ~2-5 second latency, could hallucinate, compute cost.

---

## Implementation Phases

### Phase 1: Ollama Integration with Tilt

**Tiltfile Changes** (`Tiltfile:107-112`):
```python
local_resource(
    'ollama',
    cmd='curl -sf http://127.0.0.1:11434/api/tags > /dev/null && echo "Ollama is running"',
    labels=['recommender'],
    auto_init=True,
)
```

**Key Decisions**:
- Ollama runs as macOS system service (not containerized) to access Apple Silicon GPU
- Health check resource verifies availability rather than starting service
- `recommender-api` depends on `ollama` resource

**NPM Dependency**: `ollama: ^0.6.3`

### Phase 2: LLM Configuration

**Config Interface** (`src/config.ts:7-10`):
```typescript
interface Config {
  LLM_HOST: string;        // Default: http://127.0.0.1:11434
  LLM_MODEL: string;       // Default: qwen2.5:14b-instruct
  LLM_ENABLED: boolean;    // Default: true
  LLM_TIMEOUT_MS: number;  // Default: 5000
}
```

### Phase 3: LLM Service

**File**: `src/services/llm.service.ts`

**Exports**:
- `isLLMAvailable(): Promise<boolean>` - Cached health check
- `generateCompletion(prompt, options): Promise<string | null>` - RAG-ready completion
- `resetConnectionState(): void` - Testing utility

**Graceful Degradation**:
- Returns `null` if LLM disabled, unavailable, or times out
- Connection verification cached after first success
- All errors caught and logged, never thrown

### Phase 4: Dual Explanation Generator

**New Files**:
- `src/services/constraint-advisor/conflict-stats.types.ts` - Discriminated union for constraint statistics
- `src/services/constraint-advisor/conflict-stats.service.ts` - Database statistics queries
- `src/services/constraint-advisor/conflict-explanation.service.ts` - Dual explanation generation

**Type System** (`conflict-stats.types.ts`):
```typescript
enum ConstraintStatsType {
  Skill = "skill",
  Salary = "salary",
  YearsExperience = "yearsExperience",
  Timezone = "timezone",
  StartTimeline = "startTimeline",
  Fallback = "fallback",
}

type ConstraintStats =
  | SkillConstraintStats      // skillId, proficiency, countAtLowerProficiency
  | SalaryConstraintStats     // requestedMax, minSalaryInDb, maxSalaryInDb
  | YearsExperienceConstraintStats  // requestedRange, countByRange
  | TimezoneConstraintStats   // requestedZones, countByZone
  | StartTimelineConstraintStats    // requestedMaxTimeline, countByTimeline
  | FallbackConstraintStats;

interface ConflictStats {
  countMatchingAll: number;              // Full query result
  allConstraintStats: ConstraintStats[]; // All user constraints
  conflictingConstraintStats: ConstraintStats[]; // Just the conflict set
}
```

**Main Function** (`conflict-explanation.service.ts:49-72`):
```typescript
export async function generateConflictExplanations(
  session: Session,
  allConstraints: TestableConstraint[],
  conflictSetConstraints: TestableConstraint[]
): Promise<ConflictExplanations> {
  // Query database statistics
  const [countMatchingAll, allConstraintStats, conflictingConstraintStats] = await Promise.all([
    getCountMatchingAllConstraints(session, allConstraints),
    queryConstraintsStats(session, allConstraints),
    queryConstraintsStats(session, conflictSetConstraints),
  ]);

  const stats: ConflictStats = { countMatchingAll, allConstraintStats, conflictingConstraintStats };

  // Generate both explanations
  const dataAwareExplanation = generateDataAwareExplanation(stats);
  const llmExplanation = await generateLLMExplanation(stats);

  return { dataAwareExplanation, llmExplanation, stats };
}
```

### Phase 5: Constraint Advisor Integration

**Updated Type** (`src/types/search.types.ts:311-326`):
```typescript
export interface ConflictSet {
  constraints: AppliedFilter[];
  dataAwareExplanation: string;           // Always present
  llmExplanation: string | null;          // Null if LLM unavailable
  stats: ConflictStats;                   // Full database statistics
  evidence?: { ... }[];
}
```

**Integration Point** (`constraint-advisor.service.ts:119-124`):
```typescript
const { dataAwareExplanation, llmExplanation, stats } =
  await generateConflictExplanations(
    session,
    allConstraints,          // Full query context
    conflictSetConstraints   // Minimal conflict set
  );
```

### Phase 6: Testing

**Unit Tests** (`llm.service.test.ts`):
- Mocks Ollama module entirely
- Tests connection caching, completion generation, system prompt handling

**Integration Tests** (`__tests__/llm.integration.test.ts`):
- Runs against real Ollama (if available)
- Tests RAG context with real LLM responses
- Gracefully skips if Ollama unavailable
- Extended timeout (30s) for LLM latency

---

## Architecture

### File Structure

```
recommender_api/src/
├── config.ts                           # LLM_HOST, LLM_MODEL, LLM_ENABLED, LLM_TIMEOUT_MS
├── services/
│   ├── llm.service.ts                  # Ollama client wrapper
│   ├── llm.service.test.ts             # Unit tests (mocked)
│   ├── __tests__/
│   │   └── llm.integration.test.ts     # Integration tests (real Ollama)
│   └── constraint-advisor/
│       ├── conflict-stats.types.ts     # ConstraintStats discriminated union
│       ├── conflict-stats.service.ts   # Database statistics queries
│       ├── conflict-explanation.service.ts  # Dual explanation generation
│       ├── constraint-advisor.service.ts    # Integration point
│       └── index.ts                    # Barrel exports
└── types/
    └── search.types.ts                 # ConflictSet with dual explanations
```

### Data Flow

```
Conflict Detection (QUICKXPLAIN)
       │
       ▼ conflictSetConstraints
┌──────────────────────────────────────────┐
│     generateConflictExplanations()       │
│                                          │
│  1. Query database statistics            │
│     ├─ countMatchingAll (full query)     │
│     ├─ allConstraintStats (all)          │
│     └─ conflictingConstraintStats (set)  │
│                                          │
│  2. Generate dataAwareExplanation        │
│     └─ Template using stats (instant)    │
│                                          │
│  3. Generate llmExplanation              │
│     └─ RAG context → Ollama (2-5s)       │
│                                          │
└──────────────────────────────────────────┘
       │
       ▼
ConflictSet {
  dataAwareExplanation: "Your search returns 0...",
  llmExplanation: "Staff engineers command...",
  stats: { countMatchingAll, ... }
}
```

### RAG Context Structure

```markdown
# Search Query Analysis

Total engineers matching the full query: 0

## Conflicting Constraints (the problem)
These constraints together produce insufficient results:
- "yearsExperience >= 10 (staff)": 12 engineers with 10+ years experience.
  Experience distribution: junior (0-2y): 6, mid (2-6y): 12, senior (6-10y): 10, staff+ (10+y): 12
- "salary ≤ $100,000": 8 engineers within $100,000 budget.
  Database salary range: $85,000 - $350,000

## Full Query Breakdown (all constraints)
Complete visibility into how each constraint narrows the pool:
- (same format for all constraints in query)
```

---

## Key Design Decisions

### 1. Dual Explanations (Not Either/Or)

**Decision**: Always generate both `dataAwareExplanation` and `llmExplanation`.

**Rationale**:
- **Evaluation**: Compare template vs. LLM quality in production
- **Graceful degradation**: Template always available if LLM fails
- **Transparency**: Users see factual basis alongside interpretation
- **Flexibility**: Can expose LLM only on-demand if latency is a concern

### 2. Data-Aware Templates (Not Assumption-Based)

**Decision**: Templates query actual database statistics instead of making market assumptions.

**Rationale**:
- Original plan had templates like "Staff engineers typically earn $180k+"—we don't know this from our data
- Data-aware approach: "12 staff engineers in DB, lowest paid earns $175k"
- 100% factual, no hallucination risk, instant response

### 3. Local LLM via Ollama (Not Cloud API)

**Decision**: Use Ollama running natively on macOS.

**Rationale**:
- Access to Apple Silicon GPU (M3 Ultra neural engine)
- No API costs or rate limits
- Data stays local
- Can use larger models (14B parameters)

### 4. Health Check Resource (Not Auto-Start)

**Decision**: Tilt verifies Ollama is running rather than starting it.

**Rationale**:
- Ollama runs as system service (brew services or Ollama.app)
- Starting already-running service causes errors
- Health check is idempotent and informative

---

## API Response Example

**Request**:
```bash
curl -X POST http://localhost:4025/api/search/filter \
  -H "Content-Type: application/json" \
  -d '{"requiredSeniorityLevel": "staff", "maxBudget": 100000}'
```

**Response** (sparse results):
```json
{
  "matches": [],
  "totalCount": 0,
  "relaxation": {
    "conflictAnalysis": {
      "conflictSets": [{
        "constraints": [...],
        "dataAwareExplanation": "Your search returns 0 engineers. The conflict: 12 with 10+ years experience (DB distribution: junior: 6, mid: 12, senior: 10, staff+: 12). 8 within $100,000 budget (salaries in DB range $85,000-$350,000).",
        "llmExplanation": "Staff-level engineers (10+ years experience) command premium salaries due to their technical leadership responsibilities. In the current market, staff engineers typically earn $180k-300k. Your $100k budget aligns better with mid-level engineers. Consider: (1) increasing budget to $175k+ to access staff engineers, or (2) targeting senior-level engineers who may have comparable skills within your budget.",
        "stats": {
          "countMatchingAll": 0,
          "allConstraintStats": [...],
          "conflictingConstraintStats": [...]
        }
      }]
    },
    "suggestions": [...]
  }
}
```

---

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Template generation | ~50ms |
| LLM generation (qwen2.5:14b) | ~2-5s |
| Database statistics query | ~100ms |
| Timeout threshold | 5s (configurable) |
| Graceful degradation | llmExplanation = null |

---

## Metrics

| Metric | Value |
|--------|-------|
| Implementation plan | 1 (1,866 lines) |
| Development duration | 2 days |
| New service files | 4 |
| New type definitions | 8 |
| Lines of code (new) | ~800 |
| Unit tests | 4 |
| Integration tests | 4 |

---

## What We're NOT Doing

Per plan scope:
- **Not using LLM for relaxation rationales** - Templates sufficient there
- **Not implementing caching** - Premature for low-volume use
- **Not adding streaming** - Explanations are short
- **Not making LLM optional/on-demand** - Always generate both for comparison

---

## Configuration Reference

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `LLM_HOST` | `http://127.0.0.1:11434` | Ollama server address |
| `LLM_MODEL` | `qwen2.5:14b-instruct` | Model for completions |
| `LLM_ENABLED` | `true` | Set `false` to disable |
| `LLM_TIMEOUT_MS` | `5000` | Request timeout (ms) |

---

## Lessons Learned

1. **Data-aware templates > assumption-based templates** - Querying actual database statistics produces explanations that are always correct, never hallucinate, and provide concrete numbers users can trust.

2. **Dual output enables comparison** - Returning both template and LLM explanations allows evaluating LLM value-add without committing to it exclusively.

3. **Local LLM via Ollama is viable** - 14B parameter models on Apple Silicon provide quality comparable to cloud APIs with lower latency and no cost per request.

4. **Discriminated unions scale to statistics** - The `ConstraintStats` union pattern cleanly handles diverse constraint types with type-specific enrichment fields.

5. **Health checks beat auto-start** - For system services like Ollama, verifying availability is more robust than trying to manage lifecycle.

---

## Future Considerations

1. **A/B testing template vs LLM** - Track user engagement with each explanation type
2. **LLM caching** - Cache responses for identical constraint combinations
3. **Model comparison** - Test qwen2.5:7b vs 14b for quality/latency tradeoff
4. **On-demand LLM** - Add query param to optionally skip LLM for faster response
5. **Streaming** - If explanations get longer, stream LLM responses

---

## References

- **Plan**: `thoughts/shared/1_chapter_5/2.5_project_2.5/plans/2026-01-15-local-llm-integration-for-explanations.md`
- **Project 2 Summary**: `thoughts/shared/1_chapter_5/2_project_2/project_2_summary.md`
- **Ollama JS library**: https://github.com/ollama/ollama-js
- **Qwen2.5 model info**: https://qwenlm.github.io/blog/qwen2.5/
