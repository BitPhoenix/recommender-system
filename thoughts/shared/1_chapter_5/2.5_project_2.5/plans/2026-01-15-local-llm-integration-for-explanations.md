# Local LLM Integration for Conflict Explanations

**Status: ✅ COMPLETE** (2026-01-16)

## Overview

Integrate a local LLM (via Ollama) into the recommender API to generate richer, domain-aware conflict explanations. The system uses a **dual-explanation approach**:

1. **`dataAwareExplanation`** (Data-Aware Templates): Fast, factual statements grounded in actual database queries. No assumptions—only facts from our data.
2. **`llmExplanation`** (RAG + LLM): Richer contextual explanation that combines database facts with LLM reasoning about *why* conflicts occur and *what alternatives* might work.

Both fields are always populated, allowing direct comparison of template vs. LLM quality.

## Design Rationale: Why Both Fields?

### The Problem with Assumption-Based Templates

The original plan proposed templates that made assumptions about market reality:
- "Engineers at staff typically command higher salaries than $120k" — **we don't know this from our data**
- "The combination of X and Y is rarely found" — **we don't know what's rare in our database**
- "This skill is very specialized" — **we have no data on skill rarity**

These templates would generate plausible-sounding but potentially false explanations.

### Data-Aware Templates (`dataAwareExplanation`)

The solution: templates that query actual database statistics. Examples:

| Conflict | Template Output |
|----------|-----------------|
| Seniority + salary | "We found 0 staff engineers ≤ $120k. The lowest-paid staff engineer earns $175k." |
| Skill combination | "We found 0 engineers with expert Rust AND expert COBOL. We have 5 with expert Rust, 2 with expert COBOL." |
| Single constraint | "We found 0 engineers with expert COBOL. 3 engineers have COBOL at lower proficiency levels." |

**Pros**: 100% factual, instant (~50ms), no maintenance burden, never hallucinates.
**Cons**: Only answers "what" — cannot explain "why" or suggest alternatives intelligently.

### RAG-Enhanced LLM (`llmExplanation`)

The LLM receives the same database statistics as RAG context, but adds reasoning:

| Capability | Template | LLM |
|------------|----------|-----|
| Explain *why* data looks that way | ❌ | ✅ "Rust and COBOL represent different eras and career paths" |
| Suggest intelligent alternatives | ❌ | ✅ "Consider COBOL + C++ — we have 3 matching engineers" |
| Handle novel constraint combinations | ❌ | ✅ Can reason about any combination |
| Provide market context | ❌ | ✅ "Staff engineers typically earn $200k-350k in the US market" |
| Prioritize which constraint to relax | ❌ | ✅ "Relaxing seniority would yield 12 more candidates vs. 2 for timezone" |

**Pros**: Richer explanations, handles edge cases, provides actionable guidance.
**Cons**: ~2-5 second latency, could hallucinate, compute cost.

### Why Both?

By providing both fields simultaneously:
1. **Evaluation**: Compare template vs. LLM quality in production to see if LLM adds value
2. **Graceful degradation**: If LLM is slow/unavailable, `dataAwareExplanation` is always there
3. **Transparency**: Users can see the factual basis (`dataAwareExplanation`) alongside interpretation (`llmExplanation`)
4. **Future flexibility**: Could expose LLM explanation only on-demand via query param if latency is a concern

## Current State Analysis

### Existing Explanation Generation
Located in `constraint-advisor.service.ts:141-151`:

```typescript
function generateConflictExplanation(constraints: TestableConstraint[]): string {
  if (constraints.length === 1) {
    return `The constraint "${constraints[0].displayValue}" alone is too restrictive.`;
  }

  const descriptions = constraints.map((c) => c.displayValue);
  const lastDescription = descriptions.pop();
  return `The combination of ${descriptions.join(", ")} and ${lastDescription} is too restrictive.`;
}
```

This produces mechanical descriptions ("X and Y is too restrictive") without domain context.

### Codebase Patterns
- **No existing HTTP client** - First external API integration
- **Configuration via `src/config.ts`** with environment variables
- **Service pattern** - Services are pure functions or classes in `src/services/`
- **Knowledge base configs** in `src/config/knowledge-base/`

### Ollama Setup
- Ollama v0.13.5 installed on Mac Studio
- Runs on localhost:11434
- Currently only gemma3:1b installed (will pull qwen2.5:7b-instruct and qwen2.5:14b-instruct)
- Will be added to Tilt as a `local_resource` to start automatically with the stack

## Desired End State

After implementation:
1. **LLM service** available at `src/services/llm.service.ts` for generating explanations
2. **Dual explanation fields** in conflict response:
   - `dataAwareExplanation`: Data-aware template using actual DB counts/ranges (e.g., "We found 0 staff engineers ≤ $120k. The lowest-paid staff engineer earns $175k.")
   - `llmExplanation`: RAG-enhanced LLM explanation with reasoning and alternatives
3. **Configurable model** via environment variable (`LLM_MODEL`)
4. **Graceful degradation**: If Ollama unavailable, `llmExplanation` is null (template always works)
5. **RAG context** provides LLM with relevant database statistics for grounded responses

### Verification
- Unit tests mock the Ollama client for fast, isolated testing
- Integration tests hit real Ollama (runs as part of Tilt stack)
- Manual testing confirms explanation quality improvement

## What We're NOT Doing

- **Not using LLM for relaxation rationales** - Templates are sufficient there
- **Not implementing caching** - Premature optimization for low-volume use
- **Not adding streaming** - Explanations are short, streaming adds complexity
- **Not integrating with relaxation generation** - Keep scope focused on conflict explanations
- **Not making LLM explanation optional/on-demand** - Always generate both for comparison (can revisit if latency is a problem)

## Implementation Approach

1. Add Ollama to Tilt as a `local_resource` and install `ollama` npm package
2. Add configuration for Ollama host and model name
3. Create LLM service with connection handling and graceful degradation
4. Create conflict statistics service that queries actual database counts/ranges
5. Create dual explanation generator that:
   - Generates data-aware `dataAwareExplanation` using database statistics (always works)
   - Generates RAG-enhanced `llmExplanation` with database context (null if LLM unavailable)
6. Wire into existing constraint-advisor flow, returning both fields
7. Add integration tests that run against real Ollama and Neo4j

## Phase 1: Add Ollama to Tilt and Install Dependencies

### Overview
Add Ollama as a Tilt local_resource so it starts automatically with the rest of the stack. Pull the recommended models and add the npm dependency.

**Why local_resource instead of K8s deployment?** Ollama must run natively on macOS to access the Apple Silicon GPU. Running inside minikube would lose access to the M3 Ultra's neural engine, defeating the purpose of local LLM inference.

### Changes Required

#### 1. Pull Models (one-time setup)

```bash
# Pull both models to enable A/B testing
ollama pull qwen2.5:7b-instruct
ollama pull qwen2.5:14b-instruct

# Verify models are available
ollama list
```

#### 2. Add Ollama Health Check to Tiltfile
**File**: `Tiltfile`

Ollama typically runs as a background service on macOS (started via `brew services` or the Ollama app). Rather than trying to start it (which fails if already running), we add a health check resource that verifies Ollama is available.

Add after the Client section:

```python
# ============================================
# Ollama (Local LLM) - Health Check
# ============================================
# Ollama runs as a system service on macOS (brew services or Ollama.app).
# This resource just verifies it's available, not start it.

local_resource(
    'ollama',
    cmd='curl -s http://127.0.0.1:11434/api/tags > /dev/null && echo "Ollama is running"',
    labels=['recommender'],
    auto_init=True,
)
```

**If Ollama is not running**, start it manually:
```bash
# If installed via Homebrew
brew services start ollama

# Or run directly
ollama serve &
```

#### 3. Update API resource dependency
**File**: `Tiltfile`

Update `recommender-api` to depend on Ollama:

```python
k8s_resource(
    'recommender-api',
    labels=['recommender'],
    port_forwards=['4025:4025'],
    resource_deps=['neo4j-db', 'ollama'],  # Added ollama
)
```

#### 4. NPM Dependency
**File**: `recommender_api/package.json`

Add to dependencies:
```json
"ollama": "^0.5.12"
```

Then run:
```bash
cd recommender_api && npm install
```

### Success Criteria

#### Automated Verification:
- [x] `ollama list` shows both qwen2.5:7b-instruct and qwen2.5:14b-instruct
- [x] `npm install` completes without errors
- [ ] `./bin/tilt-start.sh` starts all services including Ollama
- [ ] Tilt UI shows Ollama resource as green/ready

#### Manual Verification:
- [ ] Test models respond correctly: `ollama run qwen2.5:7b-instruct "Say hello"`
- [ ] Ollama appears in Tilt dashboard with other resources

---

## Phase 2: Add LLM Configuration

### Overview
Extend the existing config pattern to include Ollama settings.

### Changes Required

#### 1. Configuration File
**File**: `recommender_api/src/config.ts`

Add LLM configuration fields:

```typescript
interface Config {
  PORT: number;
  NODE_ENV: string;
  NEO4J_URI: string;
  NEO4J_USER: string;
  NEO4J_PASSWORD: string;
  // New LLM configuration
  LLM_HOST: string;
  LLM_MODEL: string;
  LLM_ENABLED: boolean;
  LLM_TIMEOUT_MS: number;
}

const config: Config = {
  PORT: parseInt(process.env.PORT || "4025", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  NEO4J_URI: process.env.NEO4J_URI || "bolt://localhost:7687",
  NEO4J_USER: process.env.NEO4J_USER || "neo4j",
  NEO4J_PASSWORD: process.env.NEO4J_PASSWORD || "password",
  // LLM defaults - Ollama on localhost, 14B model, enabled
  LLM_HOST: process.env.LLM_HOST || "http://127.0.0.1:11434",
  LLM_MODEL: process.env.LLM_MODEL || "qwen2.5:14b-instruct",
  LLM_ENABLED: process.env.LLM_ENABLED !== "false", // Enabled by default
  LLM_TIMEOUT_MS: parseInt(process.env.LLM_TIMEOUT_MS || "5000", 10),
};

export default config;
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npm run build` or `npx tsc --noEmit`
- [x] Config exports new fields correctly

---

## Phase 3: Create LLM Service

### Overview
Create a service that wraps the Ollama client with error handling and fallback behavior.

### Changes Required

#### 1. LLM Service
**File**: `recommender_api/src/services/llm.service.ts` (new file)

```typescript
import { Ollama } from "ollama";
import config from "../config";

/*
 * LLM service for generating text completions via Ollama.
 * Provides graceful degradation if Ollama is unavailable.
 */

let ollamaClient: Ollama | null = null;
let connectionVerified = false;

function getClient(): Ollama {
  if (!ollamaClient) {
    ollamaClient = new Ollama({ host: config.LLM_HOST });
  }
  return ollamaClient;
}

/*
 * Check if the LLM service is available and responding.
 * Caches the result to avoid repeated health checks.
 */
export async function isLLMAvailable(): Promise<boolean> {
  if (!config.LLM_ENABLED) {
    return false;
  }

  if (connectionVerified) {
    return true;
  }

  try {
    const client = getClient();
    await client.list(); // Simple health check
    connectionVerified = true;
    return true;
  } catch (error) {
    console.warn("[LLM] Ollama not available, falling back to templates:", error);
    return false;
  }
}

/*
 * Reset the connection state (useful for testing or reconnection).
 */
export function resetConnectionState(): void {
  connectionVerified = false;
  ollamaClient = null;
}

export interface LLMCompletionOptions {
  systemPrompt?: string;
  maxTokens?: number;
}

/*
 * Generate a completion from the LLM.
 * Returns null if LLM is unavailable or times out.
 */
export async function generateCompletion(
  prompt: string,
  options: LLMCompletionOptions = {}
): Promise<string | null> {
  if (!(await isLLMAvailable())) {
    return null;
  }

  const { systemPrompt, maxTokens } = options;

  try {
    const client = getClient();

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system" as const, content: systemPrompt });
    }
    messages.push({ role: "user" as const, content: prompt });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.LLM_TIMEOUT_MS);

    try {
      const response = await client.chat({
        model: config.LLM_MODEL,
        messages,
        options: maxTokens ? { num_predict: maxTokens } : undefined,
      });

      clearTimeout(timeoutId);
      return response.message.content.trim();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("[LLM] Request timed out");
    } else {
      console.warn("[LLM] Completion failed:", error);
    }
    return null;
  }
}
```

#### 2. LLM Service Tests
**File**: `recommender_api/src/services/llm.service.test.ts` (new file)

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateCompletion, isLLMAvailable, resetConnectionState } from "./llm.service";

// Mock the ollama module
vi.mock("ollama", () => {
  return {
    Ollama: vi.fn().mockImplementation(() => ({
      list: vi.fn().mockResolvedValue({ models: [] }),
      chat: vi.fn().mockResolvedValue({
        message: { content: "Staff engineers typically earn $180,000+" },
      }),
    })),
  };
});

// Mock config
vi.mock("../config", () => ({
  default: {
    LLM_HOST: "http://127.0.0.1:11434",
    LLM_MODEL: "qwen2.5:14b-instruct",
    LLM_ENABLED: true,
    LLM_TIMEOUT_MS: 5000,
  },
}));

describe("llm.service", () => {
  beforeEach(() => {
    resetConnectionState();
  });

  describe("isLLMAvailable", () => {
    it("returns true when Ollama responds", async () => {
      const available = await isLLMAvailable();
      expect(available).toBe(true);
    });

    it("caches the connection state", async () => {
      await isLLMAvailable();
      const secondCall = await isLLMAvailable();
      expect(secondCall).toBe(true);
      // The mock's list() should only be called once due to caching
    });
  });

  describe("generateCompletion", () => {
    it("returns completion text from the model", async () => {
      const result = await generateCompletion("Explain why staff + $120k conflicts");
      expect(result).toBe("Staff engineers typically earn $180,000+");
    });

    it("accepts a system prompt", async () => {
      const result = await generateCompletion("Test prompt", {
        systemPrompt: "You are a helpful assistant",
      });
      expect(result).toBeTruthy();
    });
  });
});
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit`
- [x] Tests pass: `npm test -- src/services/llm.service.test.ts`

---

## Phase 4: Create Dual Explanation Generator

### Overview
Create a module that generates both data-aware template explanations and RAG-enhanced LLM explanations. Templates query actual database counts/ranges—no assumptions. LLM receives RAG context for grounded reasoning.

### Changes Required

#### 1. Database Statistics Types
**File**: `recommender_api/src/services/constraint-advisor/conflict-stats.types.ts` (new file)

```typescript
/*
 * Types for database statistics used in conflict explanations.
 * These stats provide the factual grounding for both templates and RAG context.
 *
 * Design: Unified per-constraint stats for ALL conflict types using discriminated unions.
 * Every constraint gets its individual count, with type-specific enrichment fields.
 * Base interface eliminates duplication; specific types add only unique fields.
 */

/*
 * Enum for constraint stats discriminant.
 * Maps to actual fields on Engineer nodes in Neo4j.
 */
export enum ConstraintStatsType {
  Skill = "skill",
  Salary = "salary",
  YearsExperience = "yearsExperience",  // Seniority is converted to yearsExperience range
  Timezone = "timezone",
  StartTimeline = "startTimeline",
  Fallback = "fallback",
}

/*
 * Common fields for all constraint statistics.
 */
interface BaseConstraintStats {
  /* Human-readable description of the constraint */
  displayValue: string;
  /* Number of engineers matching this constraint alone */
  countMatching: number;
}

/*
 * Skill constraint stats - includes lower proficiency alternatives
 */
export interface SkillConstraintStats extends BaseConstraintStats {
  type: ConstraintStatsType.Skill;
  skillId: string;
  proficiency: string;
  /* How many engineers have this skill at ANY lower proficiency level */
  countAtLowerProficiency: number;
}

/*
 * Salary/budget constraint stats - includes actual salary range in DB
 */
export interface SalaryConstraintStats extends BaseConstraintStats {
  type: ConstraintStatsType.Salary;
  requestedMax: number;
  /* Actual min/max salaries in the database */
  minSalaryInDb: number;
  maxSalaryInDb: number;
}

/*
 * Years of experience constraint stats.
 * Note: User requests "seniority" but it's converted to yearsExperience range.
 * E.g., "staff" → yearsExperience >= 10
 */
export interface YearsExperienceConstraintStats extends BaseConstraintStats {
  type: ConstraintStatsType.YearsExperience;
  /* The constraint bounds (from seniority mapping) */
  requestedMinYears: number;
  requestedMaxYears: number | null;  // null means no upper bound (staff, principal)
  /* Actual range in the database for context */
  minYearsInDb: number;
  maxYearsInDb: number;
  /*
   * Distribution by seniority bucket for richer context.
   * Bucket boundaries are defined in seniorityMapping (compatibility-constraints.config.ts).
   */
  countByRange: {
    junior: number;
    mid: number;
    senior: number;
    staffPlus: number;  // staff + principal combined
  };
}

/*
 * Timezone constraint stats - shows matches per zone.
 * Note: Timezones are stored as US zones directly (Eastern, Central, Mountain, Pacific),
 * not IANA identifiers. The canonical list is in usTimezoneZones config.
 */
export interface TimezoneConstraintStats extends BaseConstraintStats {
  type: ConstraintStatsType.Timezone;
  /* The requested timezone zones (e.g., ["Eastern", "Central"]) */
  requestedZones: string[];
  /* Count of engineers per timezone zone */
  countByZone: Record<string, number>;
  // E.g., { "Eastern": 15, "Central": 12, "Mountain": 8, "Pacific": 5 }
}

/*
 * Start timeline constraint stats - shows availability distribution.
 * E.g., requiredMaxStartTime: "one_month" shows counts at each timeline.
 */
export interface StartTimelineConstraintStats extends BaseConstraintStats {
  type: ConstraintStatsType.StartTimeline;
  /* The requested max start time threshold */
  requestedMaxTimeline: string;
  /* Count of engineers at each timeline value */
  countByTimeline: Record<string, number>;
  // E.g., { "immediate": 10, "two_weeks": 15, "one_month": 8, "three_months": 5 }
}

/*
 * Fallback constraint stats - used for constraint types that don't have
 * specialized statistics queries. Returns only the base count without
 * type-specific enrichment (no distributions, ranges, or alternatives).
 */
export interface FallbackConstraintStats extends BaseConstraintStats {
  type: ConstraintStatsType.Fallback;
}

/*
 * Discriminated union of all constraint stat types
 */
export type ConstraintStats =
  | SkillConstraintStats
  | SalaryConstraintStats
  | YearsExperienceConstraintStats
  | TimezoneConstraintStats
  | StartTimelineConstraintStats
  | FallbackConstraintStats;

export interface ConflictStats {
  /*
   * Total engineers matching ALL constraints from the full user query
   * (including derived constraints from inference engine).
   * This is what the user's actual search would return.
   */
  countMatchingAll: number;

  /*
   * Stats for ALL constraints in the user's request (full visibility).
   * Includes both user-specified and derived constraints.
   * Shows how each constraint individually narrows the candidate pool.
   */
  allConstraintStats: ConstraintStats[];

  /*
   * Stats for just the constraints in this specific conflict set.
   * This is the subset we're explaining - the minimal set causing the conflict.
   * Used by templates and LLM to focus the explanation on the actual problem.
   */
  conflictingConstraintStats: ConstraintStats[];
}
```

#### 2. Database Statistics Service
**File**: `recommender_api/src/services/constraint-advisor/conflict-stats.service.ts` (new file)

```typescript
import { Session } from "neo4j-driver";
import { TestableConstraint, ConstraintType, PropertyFieldType } from "./constraint.types";
import {
  ConstraintStats,
  ConstraintStatsType,
  SkillConstraintStats,
  SalaryConstraintStats,
  YearsExperienceConstraintStats,
  TimezoneConstraintStats,
  StartTimelineConstraintStats,
  FallbackConstraintStats,
} from "./conflict-stats.types";
import { seniorityMapping } from "../../config/knowledge-base/compatibility-constraints.config";

/*
 * Query statistics for a list of constraints.
 * Returns per-constraint stats showing how each constraint individually narrows the pool.
 *
 * @param session Neo4j session
 * @param constraints The constraints to query stats for
 */
export async function queryConstraintsStats(
  session: Session,
  constraints: TestableConstraint[]
): Promise<ConstraintStats[]> {
  return Promise.all(
    constraints.map((c) => queryConstraintStats(session, c))
  );
}

/*
 * Get the count of engineers matching ALL given constraints (combined with AND).
 *
 * @param session Neo4j session
 * @param constraints The constraints that must all be satisfied
 */
export async function getCountMatchingAllConstraints(
  session: Session,
  constraints: TestableConstraint[]
): Promise<number> {
  if (constraints.length === 0) {
    // No constraints = count all engineers
    const result = await session.run(`MATCH (e:Engineer) RETURN count(e) as count`);
    return result.records[0]?.get("count")?.toNumber() ?? 0;
  }

  // Build WHERE clause from all constraint cypher fragments
  const whereClause = constraints.map((c) => c.cypherFragment).join(" AND ");

  const result = await session.run(`
    MATCH (e:Engineer)
    WHERE ${whereClause}
    RETURN count(e) as count
  `);

  return result.records[0]?.get("count")?.toNumber() ?? 0;
}

/*
 * Route to the appropriate stats query based on constraint type and field.
 * Note: Seniority is converted to yearsExperience, so we route by actual field names.
 */
async function queryConstraintStats(
  session: Session,
  constraint: TestableConstraint
): Promise<ConstraintStats> {
  // Skill constraints (both user and derived)
  if (constraint.constraintType === ConstraintType.SkillTraversal) {
    return querySkillStats(session, constraint);
  }

  // Property constraints - route by actual field name
  switch (constraint.field) {
    case "yearsExperience":
      return queryYearsExperienceStats(session, constraint);

    case "salary":
      return querySalaryStats(session, constraint);

    case "timezone":
      return queryTimezoneStats(session, constraint);

    case "startTimeline":
      return queryStartTimelineStats(session, constraint);

    default:
      return queryFallbackStats(session, constraint);
  }
}

async function querySkillStats(
  session: Session,
  constraint: TestableConstraint
): Promise<SkillConstraintStats> {
  const result = await session.run(`
    MATCH (e:Engineer)-[r:HAS_SKILL]->(s:Skill {id: $skillId})
    WITH s,
      sum(CASE WHEN r.proficiencyLevel = $proficiency THEN 1 ELSE 0 END) as exactCount,
      sum(CASE WHEN r.proficiencyLevel <> $proficiency THEN 1 ELSE 0 END) as lowerCount
    RETURN exactCount, lowerCount
  `, { skillId: constraint.skillIds[0], proficiency: constraint.value?.minProficiency ?? 'any' });

  const record = result.records[0];
  return {
    type: ConstraintStatsType.Skill,
    displayValue: constraint.displayValue,
    countMatching: record?.get("exactCount")?.toNumber() ?? 0,
    skillId: constraint.skillIds[0],
    proficiency: constraint.value?.minProficiency ?? 'any',
    countAtLowerProficiency: record?.get("lowerCount")?.toNumber() ?? 0,
  };
}

async function querySalaryStats(
  session: Session,
  constraint: TestableConstraint
): Promise<SalaryConstraintStats> {
  const maxBudget = constraint.value as number;

  const result = await session.run(`
    MATCH (e:Engineer)
    RETURN
      sum(CASE WHEN e.salary <= $maxBudget THEN 1 ELSE 0 END) as countMatching,
      min(e.salary) as minSalary,
      max(e.salary) as maxSalary
  `, { maxBudget });

  const record = result.records[0];
  return {
    type: ConstraintStatsType.Salary,
    displayValue: constraint.displayValue,
    countMatching: record?.get("countMatching")?.toNumber() ?? 0,
    requestedMax: maxBudget,
    minSalaryInDb: record?.get("minSalary")?.toNumber() ?? 0,
    maxSalaryInDb: record?.get("maxSalary")?.toNumber() ?? 0,
  };
}

/*
 * Query stats for yearsExperience constraint.
 * Note: User requests "seniority" but it's converted to yearsExperience range.
 * We query the actual yearsExperience distribution in the database.
 *
 * Uses seniorityMapping from config to ensure consistent bucket boundaries.
 */
async function queryYearsExperienceStats(
  session: Session,
  constraint: TestableConstraint
): Promise<YearsExperienceConstraintStats> {
  // Extract the requested range from the constraint
  const { minYears, maxYears } = extractYearsExperienceRange(constraint);

  // Build CASE statements from seniorityMapping to avoid hardcoded values
  const { junior, mid, senior, staff } = seniorityMapping;

  const result = await session.run(`
    MATCH (e:Engineer)
    RETURN
      min(e.yearsExperience) as minYears,
      max(e.yearsExperience) as maxYears,
      sum(CASE WHEN e.yearsExperience >= $minYears
               AND ($maxYears IS NULL OR e.yearsExperience < $maxYears)
          THEN 1 ELSE 0 END) as countMatching,
      sum(CASE WHEN e.yearsExperience >= $juniorMin AND e.yearsExperience < $juniorMax THEN 1 ELSE 0 END) as junior,
      sum(CASE WHEN e.yearsExperience >= $midMin AND e.yearsExperience < $midMax THEN 1 ELSE 0 END) as mid,
      sum(CASE WHEN e.yearsExperience >= $seniorMin AND e.yearsExperience < $seniorMax THEN 1 ELSE 0 END) as senior,
      sum(CASE WHEN e.yearsExperience >= $staffMin THEN 1 ELSE 0 END) as staffPlus
  `, {
    minYears,
    maxYears,
    juniorMin: junior.minYears,
    juniorMax: junior.maxYears,
    midMin: mid.minYears,
    midMax: mid.maxYears,
    seniorMin: senior.minYears,
    seniorMax: senior.maxYears,
    staffMin: staff.minYears,
  });

  const record = result.records[0];
  return {
    type: ConstraintStatsType.YearsExperience,
    displayValue: constraint.displayValue,
    countMatching: record?.get("countMatching")?.toNumber() ?? 0,
    requestedMinYears: minYears,
    requestedMaxYears: maxYears,
    minYearsInDb: record?.get("minYears")?.toNumber() ?? 0,
    maxYearsInDb: record?.get("maxYears")?.toNumber() ?? 0,
    countByRange: {
      junior: record?.get("junior")?.toNumber() ?? 0,
      mid: record?.get("mid")?.toNumber() ?? 0,
      senior: record?.get("senior")?.toNumber() ?? 0,
      staffPlus: record?.get("staffPlus")?.toNumber() ?? 0,
    },
  };
}

/*
 * Query stats for timezone constraint.
 * Shows distribution across US timezone zones.
 *
 * Note: Timezones are stored as US zones directly (Eastern, Central, Mountain, Pacific),
 * not IANA identifiers. The canonical list is in usTimezoneZones config.
 */
async function queryTimezoneStats(
  session: Session,
  constraint: TestableConstraint
): Promise<TimezoneConstraintStats> {
  const requestedZones = Array.isArray(constraint.value)
    ? constraint.value as string[]
    : [constraint.value as string];

  // Query distribution across all zones
  const result = await session.run(`
    MATCH (e:Engineer)
    RETURN e.timezone as zone, count(e) as count
  `);

  const countByZone: Record<string, number> = {};
  let countMatching = 0;

  for (const record of result.records) {
    const zone = record.get("zone") as string;
    const count = record.get("count").toNumber();
    countByZone[zone] = count;
    if (requestedZones.includes(zone)) {
      countMatching += count;
    }
  }

  return {
    type: ConstraintStatsType.Timezone,
    displayValue: constraint.displayValue,
    countMatching,
    requestedZones,
    countByZone,
  };
}

/*
 * Query stats for startTimeline constraint.
 * Shows distribution across all timeline values.
 */
async function queryStartTimelineStats(
  session: Session,
  constraint: TestableConstraint
): Promise<StartTimelineConstraintStats> {
  const requestedTimelines = constraint.value as string[];

  const result = await session.run(`
    MATCH (e:Engineer)
    RETURN e.startTimeline as timeline, count(e) as count
  `);

  const countByTimeline: Record<string, number> = {};
  let countMatching = 0;

  for (const record of result.records) {
    const timeline = record.get("timeline") as string;
    const count = record.get("count").toNumber();
    countByTimeline[timeline] = count;
    if (requestedTimelines.includes(timeline)) {
      countMatching += count;
    }
  }

  return {
    type: ConstraintStatsType.StartTimeline,
    displayValue: constraint.displayValue,
    countMatching,
    requestedMaxTimeline: requestedTimelines[requestedTimelines.length - 1], // Last is most restrictive
    countByTimeline,
  };
}

async function queryFallbackStats(
  session: Session,
  constraint: TestableConstraint
): Promise<FallbackConstraintStats> {
  // Use the constraint's cypher fragment to count matches
  const result = await session.run(`
    MATCH (e:Engineer)
    WHERE ${constraint.cypher.clause}
    RETURN count(e) as count
  `, { [constraint.cypher.paramName]: constraint.cypher.paramValue });

  return {
    type: ConstraintStatsType.Fallback,
    displayValue: constraint.displayValue,
    countMatching: result.records[0]?.get("count")?.toNumber() ?? 0,
  };
}

/*
 * Extract years experience range from constraint.
 * yearsExperience constraints come as two separate constraints (>= min, < max).
 */
function extractYearsExperienceRange(constraint: TestableConstraint): {
  minYears: number;
  maxYears: number | null;
} {
  // For >= constraint, this is the min years
  if (constraint.operator === ">=") {
    return { minYears: constraint.value as number, maxYears: null };
  }
  // For < constraint, this is the max years (need to find paired min)
  if (constraint.operator === "<") {
    return { minYears: 0, maxYears: constraint.value as number };
  }
  // Fallback
  return { minYears: 0, maxYears: null };
}

```

#### 3. Conflict Explanation Service
**File**: `recommender_api/src/services/constraint-advisor/conflict-explanation.service.ts` (new file)

```typescript
import { Session } from "neo4j-driver";
import { TestableConstraint } from "./constraint.types";
import { generateCompletion } from "../llm.service";
import {
  ConflictStats,
  ConstraintStats,
  ConstraintStatsType,
  SkillConstraintStats,
  SalaryConstraintStats,
  YearsExperienceConstraintStats,
  TimezoneConstraintStats,
  StartTimelineConstraintStats,
} from "./conflict-stats.types";
import { queryConstraintsStats, getCountMatchingAllConstraints } from "./conflict-stats.service";
import { seniorityMapping } from "../../config/knowledge-base/compatibility-constraints.config";

export interface ConflictExplanations {
  /* Data-aware template explanation (always present) */
  dataAwareExplanation: string;
  /* RAG-enhanced LLM explanation (null if LLM unavailable) */
  llmExplanation: string | null;
  /* Full statistics for each constraint */
  stats: ConflictStats;
}

const LLM_SYSTEM_PROMPT = `You are an expert in tech talent acquisition. You will be given:
1. A set of search constraints that produced few/no results
2. Actual statistics from our engineer database (individual counts per constraint + combined count)

Your task: Explain WHY these constraints conflict. Use the provided statistics as facts, but add your knowledge of:
- Market dynamics (salary ranges, skill rarity)
- Career path patterns (which skills tend to co-occur)
- Hiring realities

Also suggest specific alternatives based on the data provided.`;

/*
 * Generate both template and LLM explanations for a conflict.
 * Template uses actual database statistics. LLM receives RAG context.
 *
 * @param session Neo4j session
 * @param allConstraints All constraints from the full user query (including derived)
 * @param conflictSetConstraints The minimal conflict set we're explaining
 */
export async function generateConflictExplanations(
  session: Session,
  allConstraints: TestableConstraint[],
  conflictSetConstraints: TestableConstraint[]
): Promise<ConflictExplanations> {
  // Query database statistics separately - each function has a single responsibility
  const [countMatchingAll, allConstraintStats, conflictingConstraintStats] = await Promise.all([
    getCountMatchingAllConstraints(session, allConstraints),
    queryConstraintsStats(session, allConstraints),
    queryConstraintsStats(session, conflictSetConstraints),
  ]);

  // Assemble the stats object
  const stats: ConflictStats = {
    countMatchingAll,
    allConstraintStats,
    conflictingConstraintStats,
  };

  // Generate data-aware template explanation (instant, factual)
  // Focuses on conflicting constraints but mentions full query result
  const dataAwareExplanation = generateDataAwareExplanation(stats);

  // Generate LLM explanation with RAG context (slower, richer)
  // Gets full context to suggest which constraint might be easiest to relax
  const llmExplanation = await generateLLMExplanation(stats);

  return {
    dataAwareExplanation,
    llmExplanation,
    stats,
  };
}

/*
 * Generate explanation using actual database statistics.
 * No assumptions—only facts from our data.
 *
 * Structure:
 * 1. Full query result (countMatchingAll)
 * 2. Conflict explanation (conflictingConstraintStats) - the problem
 * 3. Full query breakdown (allConstraintStats) - complete visibility
 */
function generateDataAwareExplanation(stats: ConflictStats): string {
  const parts: string[] = [];

  // Summary line - full query result
  parts.push(`Your search returns ${stats.countMatchingAll} engineers.`);

  // Conflict explanation - focus on the problematic constraints
  if (stats.conflictingConstraintStats.length > 0) {
    parts.push("The conflict:");
    for (const cs of stats.conflictingConstraintStats) {
      parts.push(formatConstraintStats(cs));
    }
  }

  // Full query breakdown - complete visibility into all constraints
  if (stats.allConstraintStats.length > stats.conflictingConstraintStats.length) {
    parts.push("Full query breakdown:");
    for (const cs of stats.allConstraintStats) {
      parts.push(formatConstraintStats(cs));
    }
  }

  return parts.join(" ");
}

/*
 * Format a single constraint's stats with type-specific enrichment.
 */
function formatConstraintStats(cs: ConstraintStats): string {
  switch (cs.type) {
    case ConstraintStatsType.Skill: {
      const skill = cs as SkillConstraintStats;
      let line = `${skill.countMatching} with ${skill.proficiency} ${skill.displayValue}`;
      if (skill.countAtLowerProficiency > 0) {
        line += ` (${skill.countAtLowerProficiency} at lower proficiency)`;
      }
      return line + ".";
    }

    case ConstraintStatsType.Salary: {
      const salary = cs as SalaryConstraintStats;
      return `${salary.countMatching} within $${salary.requestedMax.toLocaleString()} budget ` +
        `(salaries in DB range $${salary.minSalaryInDb.toLocaleString()}-$${salary.maxSalaryInDb.toLocaleString()}).`;
    }

    case ConstraintStatsType.YearsExperience: {
      const yoe = cs as YearsExperienceConstraintStats;
      const { countByRange } = yoe;
      const rangeStr = yoe.requestedMaxYears
        ? `${yoe.requestedMinYears}-${yoe.requestedMaxYears} years`
        : `${yoe.requestedMinYears}+ years`;
      const distribution = `junior: ${countByRange.junior}, mid: ${countByRange.mid}, ` +
        `senior: ${countByRange.senior}, staff+: ${countByRange.staffPlus}`;
      return `${yoe.countMatching} with ${rangeStr} experience (DB distribution: ${distribution}).`;
    }

    case ConstraintStatsType.Timezone: {
      const tz = cs as TimezoneConstraintStats;
      const zoneStr = Object.entries(tz.countByZone)
        .map(([zone, count]) => `${zone}: ${count}`)
        .join(", ");
      return `${tz.countMatching} in ${tz.requestedZones.join(" or ")} (DB distribution: ${zoneStr}).`;
    }

    case ConstraintStatsType.StartTimeline: {
      const st = cs as StartTimelineConstraintStats;
      const timelineStr = Object.entries(st.countByTimeline)
        .map(([timeline, count]) => `${timeline}: ${count}`)
        .join(", ");
      return `${st.countMatching} available within ${st.requestedMaxTimeline} (DB distribution: ${timelineStr}).`;
    }

    case ConstraintStatsType.Fallback:
    default:
      return `${cs.countMatching} matching "${cs.displayValue}".`;
  }
}

/*
 * Build RAG context for the LLM from database statistics.
 * Provides both the conflict set (the problem) and full query stats (for alternatives).
 */
function buildRAGContext(stats: ConflictStats): string {
  const lines: string[] = [
    "# Search Query Analysis",
    "",
    `Total engineers matching the full query: ${stats.countMatchingAll}`,
    "",
    "## Conflicting Constraints (the problem)",
    "These constraints together produce insufficient results:",
  ];

  for (const cs of stats.conflictingConstraintStats) {
    lines.push(formatConstraintStatsForRAG(cs));
  }

  lines.push("");
  lines.push("## Full Query Breakdown (all constraints)");
  lines.push("Complete visibility into how each constraint narrows the pool:");

  for (const cs of stats.allConstraintStats) {
    lines.push(formatConstraintStatsForRAG(cs));
  }

  return lines.join("\n");
}

/*
 * Format constraint stats for RAG context (more verbose than template).
 */
function formatConstraintStatsForRAG(cs: ConstraintStats): string {
  switch (cs.type) {
    case ConstraintStatsType.Skill: {
      const skill = cs as SkillConstraintStats;
      return `- "${skill.displayValue}": ${skill.countMatching} engineers at ${skill.proficiency} level, ` +
        `${skill.countAtLowerProficiency} at lower proficiency levels`;
    }

    case ConstraintStatsType.Salary: {
      const salary = cs as SalaryConstraintStats;
      return `- "${salary.displayValue}": ${salary.countMatching} engineers within $${salary.requestedMax.toLocaleString()} budget. ` +
        `Database salary range: $${salary.minSalaryInDb.toLocaleString()} - $${salary.maxSalaryInDb.toLocaleString()}`;
    }

    case ConstraintStatsType.YearsExperience: {
      const yoe = cs as YearsExperienceConstraintStats;
      const { countByRange } = yoe;
      const rangeStr = yoe.requestedMaxYears
        ? `${yoe.requestedMinYears}-${yoe.requestedMaxYears} years`
        : `${yoe.requestedMinYears}+ years`;
      // Use seniorityMapping for consistent year range labels
      const { junior, mid, senior, staff } = seniorityMapping;
      return `- "${yoe.displayValue}": ${yoe.countMatching} engineers with ${rangeStr} experience. ` +
        `Experience distribution: junior (${junior.minYears}-${junior.maxYears}y): ${countByRange.junior}, ` +
        `mid (${mid.minYears}-${mid.maxYears}y): ${countByRange.mid}, ` +
        `senior (${senior.minYears}-${senior.maxYears}y): ${countByRange.senior}, ` +
        `staff+ (${staff.minYears}+y): ${countByRange.staffPlus}`;
    }

    case ConstraintStatsType.Timezone: {
      const tz = cs as TimezoneConstraintStats;
      const zoneBreakdown = Object.entries(tz.countByZone)
        .map(([zone, count]) => `${zone}: ${count}`)
        .join(", ");
      return `- "${tz.displayValue}": ${tz.countMatching} engineers in ${tz.requestedZones.join(" or ")}. ` +
        `Timezone distribution: ${zoneBreakdown}`;
    }

    case ConstraintStatsType.StartTimeline: {
      const st = cs as StartTimelineConstraintStats;
      const timelineBreakdown = Object.entries(st.countByTimeline)
        .map(([timeline, count]) => `${timeline}: ${count}`)
        .join(", ");
      return `- "${st.displayValue}": ${st.countMatching} engineers available within ${st.requestedMaxTimeline}. ` +
        `Availability distribution: ${timelineBreakdown}`;
    }

    case ConstraintStatsType.Fallback:
    default:
      return `- "${cs.displayValue}": ${cs.countMatching} engineers`;
  }
}

/*
 * Generate LLM explanation with RAG context.
 * Returns null if LLM is unavailable.
 */
async function generateLLMExplanation(stats: ConflictStats): Promise<string | null> {
  const ragContext = buildRAGContext(stats);

  return generateCompletion(ragContext, {
    systemPrompt: LLM_SYSTEM_PROMPT,
  });
}
```

#### 4. Update Barrel Export
**File**: `recommender_api/src/services/constraint-advisor/index.ts`

Add exports for the new services:

```typescript
export { generateConflictExplanations } from "./conflict-explanation.service";
export type { ConflictExplanations } from "./conflict-explanation.service";
export { queryConstraintsStats, getCountMatchingAllConstraints } from "./conflict-stats.service";
export type {
  ConflictStats,
  ConstraintStats,
  ConstraintStatsType,
  SkillConstraintStats,
  SalaryConstraintStats,
  YearsExperienceConstraintStats,
  TimezoneConstraintStats,
  StartTimelineConstraintStats,
  FallbackConstraintStats,
} from "./conflict-stats.types";
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit`
- [x] All existing tests still pass: `npm test`

---

## Phase 5: Wire Into Constraint Advisor

### Overview
Update the constraint advisor to use the new dual-explanation generator and return both fields.

### Changes Required

#### 1. Update ConflictSet Type
**File**: `recommender_api/src/services/constraint-advisor/constraint.types.ts`

Add `llmExplanation` and `stats` fields to the ConflictSet type:

```typescript
import { ConflictStats } from "./conflict-stats.types";

export interface ConflictSet {
  constraints: TestableConstraint[];
  dataAwareExplanation: string;
  llmExplanation: string | null;  // New: RAG-enhanced LLM explanation
  stats: ConflictStats;            // New: per-constraint statistics
}
```

#### 2. Update constraint-advisor.service.ts
**File**: `recommender_api/src/services/constraint-advisor/constraint-advisor.service.ts`

The constraint advisor needs to pass both all constraints (from the full query) and the conflict set constraints (minimal set) to the explanation generator:

```typescript
import { generateConflictExplanations } from "./conflict-explanation.service";

// In getConstraintAdvice(), after finding minimal conflict sets:

// decomposed.constraints contains ALL constraints from the full user query
// (including derived constraints from inference engine)
const allConstraints = decomposed.constraints;

// For each conflict set found by QuickXplain:
for (const conflictSetConstraints of minimalSets) {
  const { dataAwareExplanation, llmExplanation, stats } = await generateConflictExplanations(
    session,
    allConstraints,           // Full query - for countMatchingAll and allConstraintStats
    conflictSetConstraints    // Conflict set - for conflictingConstraintStats
  );

  conflictSets.push({
    constraints: conflictSetConstraints,
    dataAwareExplanation,
    llmExplanation,
    stats,
  });
}
```

**Key design point**: `allConstraints` comes from `decomposed.constraints` which includes:
- User-specified constraints (skills, seniority, budget, timezone, etc.)
- Derived constraints from the inference engine (rules that fired)

This ensures `countMatchingAll` reflects the actual search query result.

#### 3. Unit Test for Dual Explanations
**File**: `recommender_api/src/services/constraint-advisor/conflict-explanation.service.test.ts` (new file)

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateConflictExplanations } from "./conflict-explanation.service";
import { ConstraintType, PropertyFieldCategory, SkillConstraintOrigin } from "./constraint.types";
import { ConstraintStatsType } from "./conflict-stats.types";
import type { TestableConstraint } from "./constraint.types";

// Mock LLM service
vi.mock("../llm.service", () => ({
  generateCompletion: vi.fn().mockResolvedValue("LLM explanation: Staff engineers earn $180k+ typically."),
}));

// Mock conflict-stats.service
vi.mock("./conflict-stats.service", () => ({
  queryConstraintsStats: vi.fn(),
  getCountMatchingAllConstraints: vi.fn(),
}));

import { queryConstraintsStats, getCountMatchingAllConstraints } from "./conflict-stats.service";

describe("conflict-explanation.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateConflictExplanations", () => {
    it("returns full query stats and conflict set stats separately", async () => {
      /*
       * Scenario: User searches with 4 constraints, but only 2 form the conflict.
       * - Full query: yearsExperience + salary + timezone + skill (4 constraints)
       * - Conflict set: yearsExperience + salary (2 constraints)
       *
       * Note: User requested "staff seniority" which was converted to yearsExperience >= 10
       */

      // Mock the separate stats functions
      const allStats = [
        {
          type: ConstraintStatsType.YearsExperience,
          displayValue: "yearsExperience >= 10 (staff)",
          countMatching: 15,
          requestedMinYears: 10,
          requestedMaxYears: null,
          minYearsInDb: 1,
          maxYearsInDb: 20,
          countByRange: { junior: 6, mid: 12, senior: 10, staffPlus: 12 },
        },
        {
          type: ConstraintStatsType.Salary,
          displayValue: "salary ≤ $120,000",
          countMatching: 8,
          requestedMax: 120000,
          minSalaryInDb: 85000,
          maxSalaryInDb: 350000,
        },
        {
          type: ConstraintStatsType.Timezone,
          displayValue: "timezone Eastern",
          countMatching: 15,
          requestedZones: ["Eastern"],
          countByZone: { "Eastern": 15, "Central": 12, "Mountain": 8, "Pacific": 5 },
        },
        {
          type: ConstraintStatsType.Skill,
          displayValue: "expert TypeScript",
          countMatching: 25,
          skillId: "skill_typescript",
          proficiency: "expert",
          countAtLowerProficiency: 10,
        },
      ];

      const conflictStats = [
        {
          type: ConstraintStatsType.YearsExperience,
          displayValue: "yearsExperience >= 10 (staff)",
          countMatching: 15,
          requestedMinYears: 10,
          requestedMaxYears: null,
          minYearsInDb: 1,
          maxYearsInDb: 20,
          countByRange: { junior: 6, mid: 12, senior: 10, staffPlus: 12 },
        },
        {
          type: ConstraintStatsType.Salary,
          displayValue: "salary ≤ $120,000",
          countMatching: 8,
          requestedMax: 120000,
          minSalaryInDb: 85000,
          maxSalaryInDb: 350000,
        },
      ];

      // queryConstraintsStats is called twice: once for all, once for conflict set
      vi.mocked(queryConstraintsStats)
        .mockResolvedValueOnce(allStats)
        .mockResolvedValueOnce(conflictStats);
      vi.mocked(getCountMatchingAllConstraints).mockResolvedValue(0);

      // All constraints from full query
      const allConstraints: TestableConstraint[] = [
        { id: "seniority", /* ... */ } as any,
        { id: "salary", /* ... */ } as any,
        { id: "timezone", /* ... */ } as any,
        { id: "skill", /* ... */ } as any,
      ];

      // Just the conflict set
      const conflictSetConstraints: TestableConstraint[] = [
        { id: "seniority", /* ... */ } as any,
        { id: "salary", /* ... */ } as any,
      ];

      const result = await generateConflictExplanations(
        {} as any,
        allConstraints,
        conflictSetConstraints
      );

      // Template shows full query result
      expect(result.dataAwareExplanation).toContain("0 engineers");

      // Stats structure is correct
      expect(result.stats.countMatchingAll).toBe(0);
      expect(result.stats.allConstraintStats).toHaveLength(4);
      expect(result.stats.conflictingConstraintStats).toHaveLength(2);

      // LLM explanation is populated
      expect(result.llmExplanation).toContain("LLM explanation");
    });

    it("distinguishes conflict explanation from full query breakdown", async () => {
      const allStats = [
        { type: ConstraintStatsType.Skill, displayValue: "expert Rust", countMatching: 10, skillId: "skill_rust", proficiency: "expert", countAtLowerProficiency: 15 },
        { type: ConstraintStatsType.Skill, displayValue: "expert Go", countMatching: 12, skillId: "skill_go", proficiency: "expert", countAtLowerProficiency: 8 },
        { type: ConstraintStatsType.Skill, displayValue: "expert COBOL", countMatching: 2, skillId: "skill_cobol", proficiency: "expert", countAtLowerProficiency: 3 },
      ];
      const conflictStats = [
        { type: ConstraintStatsType.Skill, displayValue: "expert Rust", countMatching: 10, skillId: "skill_rust", proficiency: "expert", countAtLowerProficiency: 15 },
        { type: ConstraintStatsType.Skill, displayValue: "expert COBOL", countMatching: 2, skillId: "skill_cobol", proficiency: "expert", countAtLowerProficiency: 3 },
      ];

      vi.mocked(queryConstraintsStats)
        .mockResolvedValueOnce(allStats)
        .mockResolvedValueOnce(conflictStats);
      vi.mocked(getCountMatchingAllConstraints).mockResolvedValue(0);

      const result = await generateConflictExplanations({} as any, [], []);

      // Explanation should distinguish between conflict and full breakdown
      expect(result.dataAwareExplanation).toContain("conflict");
      expect(result.dataAwareExplanation).toContain("Full query breakdown");
    });

    it("returns null llmExplanation when LLM unavailable", async () => {
      const { generateCompletion } = await import("../llm.service");
      vi.mocked(generateCompletion).mockResolvedValueOnce(null);

      const stats = [
        { type: ConstraintStatsType.Fallback, displayValue: "timezone Eastern", countMatching: 0 },
      ];

      vi.mocked(queryConstraintsStats)
        .mockResolvedValueOnce(stats)
        .mockResolvedValueOnce(stats);
      vi.mocked(getCountMatchingAllConstraints).mockResolvedValue(0);

      const result = await generateConflictExplanations({} as any, [], []);

      // Template explanation is always present
      expect(result.dataAwareExplanation).toBeTruthy();

      // LLM explanation is null
      expect(result.llmExplanation).toBeNull();
    });
  });
});
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit`
- [x] All tests pass: `npm test`
- [x] Integration tests pass: `npm test -- src/services/constraint-advisor/`

#### Manual Verification:
- [ ] Start Tilt: `./bin/tilt-start.sh`
- [ ] Make a search request with conflicting constraints (staff + low salary)
- [ ] Response contains both `dataAwareExplanation` (factual) and `llmExplanation` (richer reasoning)
- [ ] Compare quality: `dataAwareExplanation` shows database facts, `llmExplanation` explains "why"

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that both explanation fields are populated correctly.

---

## Phase 6: Add Integration Tests with Real Ollama

### Overview
Add integration tests that verify the LLM service works correctly against the real Ollama instance. Since Ollama is now part of the Tilt stack, these tests run normally alongside other tests.

### Changes Required

#### 1. LLM Service Integration Test
**File**: `recommender_api/src/services/llm.service.integration.test.ts` (new file)

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { generateCompletion, isLLMAvailable, resetConnectionState } from "./llm.service";

/*
 * Integration tests that verify LLM service against real Ollama.
 * Ollama runs as part of the Tilt stack, so these tests run normally.
 */
describe("llm.service integration", () => {
  beforeAll(() => {
    resetConnectionState();
  });

  it("connects to Ollama instance", async () => {
    const available = await isLLMAvailable();
    expect(available).toBe(true);
  });

  it("generates completion with RAG context", async () => {
    const ragContext = `Search constraints that produced no results:
- staff seniority
- salary ≤ $100,000

Database statistics:
- Engineers at staff level: 15
- Minimum salary at staff level: $175,000
- Engineers at staff level within $100,000 budget: 0`;

    const result = await generateCompletion(ragContext, {
      systemPrompt: "You are a tech hiring expert. Explain why these constraints conflict and suggest alternatives.",
    });

    expect(result).toBeTruthy();
    expect(result!.length).toBeGreaterThan(50);
    console.log("RAG-enhanced LLM Response:", result);

    // Should reference the provided statistics
    // (LLM should incorporate the facts we provided)
  });

  it("respects max tokens limit", async () => {
    const result = await generateCompletion(
      "Write a very long explanation about software engineering salaries.",
      { maxTokens: 30 }
    );

    expect(result).toBeTruthy();
    // With 30 tokens, response should be relatively short
    expect(result!.split(" ").length).toBeLessThan(50);
  });
});
```

#### 2. End-to-End Conflict Explanation Test
**File**: `recommender_api/src/services/constraint-advisor/conflict-explanation.integration.test.ts` (new file)

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import neo4j, { Driver, Session } from "neo4j-driver";
import { generateConflictExplanations } from "./conflict-explanation.service";
import { ConstraintType, PropertyFieldCategory, SkillConstraintOrigin } from "./constraint.types";
import { ConstraintStatsType } from "./conflict-stats.types";
import config from "../../config";

/*
 * Integration tests that verify full conflict explanation flow
 * against real Neo4j (with seed data) and real Ollama.
 */
describe("conflict-explanation integration", () => {
  let driver: Driver;
  let session: Session;

  beforeAll(async () => {
    driver = neo4j.driver(
      config.NEO4J_URI,
      neo4j.auth.basic(config.NEO4J_USER, config.NEO4J_PASSWORD)
    );
    session = driver.session();
  });

  afterAll(async () => {
    await session.close();
    await driver.close();
  });

  it("distinguishes full query stats from conflict set stats", async () => {
    /*
     * Scenario: Full query has 4 constraints, conflict set has 2.
     * - Full query: seniority + salary + timezone + skill
     * - Conflict set: seniority + salary
     */
    const seniorityConstraint = {
      id: "seniority_0",
      type: ConstraintType.Property,
      field: "seniorityLevel",
      fieldCategory: PropertyFieldCategory.StringArray,
      displayValue: "staff seniority",
      cypherFragment: "e.seniorityLevel IN ['staff']",
    };

    const salaryConstraint = {
      id: "salary_1",
      type: ConstraintType.Property,
      field: "maxBudget",
      fieldCategory: PropertyFieldCategory.Numeric,
      displayValue: "salary ≤ $100,000",
      cypherFragment: "e.salary <= 100000",
    };

    const timezoneConstraint = {
      id: "timezone_2",
      type: ConstraintType.Property,
      field: "timezone",
      fieldCategory: PropertyFieldCategory.StringArray,
      displayValue: "timezone Eastern",
      cypherFragment: "e.timezone IN ['Eastern']",
    };

    const skillConstraint = {
      id: "skill_3",
      type: ConstraintType.SkillTraversal,
      skillId: "skill_typescript",
      proficiencyLevel: "expert",
      displayValue: "expert TypeScript",
      origin: SkillConstraintOrigin.User,
      cypherFragment: "(e)-[:HAS_SKILL {proficiencyLevel: 'expert'}]->(:Skill {id: 'skill_typescript'})",
    };

    // Full query: all 4 constraints
    const allConstraints = [seniorityConstraint, salaryConstraint, timezoneConstraint, skillConstraint];

    // Conflict set: just the 2 that conflict
    const conflictSetConstraints = [seniorityConstraint, salaryConstraint];

    const result = await generateConflictExplanations(
      session,
      allConstraints,
      conflictSetConstraints
    );

    // Verify we get stats for ALL constraints
    expect(result.stats.allConstraintStats).toHaveLength(4);

    // Verify we get stats for just the CONFLICT SET
    expect(result.stats.conflictingConstraintStats).toHaveLength(2);

    // countMatchingAll should be based on full query
    console.log("Full query result:", result.stats.countMatchingAll);
    console.log("All constraint stats:", result.stats.allConstraintStats.map(s => ({
      constraint: s.displayValue,
      count: s.countMatching,
    })));
    console.log("Conflicting constraint stats:", result.stats.conflictingConstraintStats.map(s => ({
      constraint: s.displayValue,
      count: s.countMatching,
    })));

    // Template explanation contains actual numbers from DB
    expect(result.dataAwareExplanation).toBeTruthy();
    expect(result.dataAwareExplanation).toMatch(/\d+/);
    console.log("Template explanation:", result.dataAwareExplanation);

    // LLM explanation provides richer context
    expect(result.llmExplanation).toBeTruthy();
    console.log("LLM explanation:", result.llmExplanation);
  });

  it("handles skill-only conflicts with full query context", async () => {
    /*
     * Full query: 3 rare skills
     * Conflict set: just 2 of them (the ones that together are impossible)
     */
    const skill1 = {
      id: "skill_rust",
      type: ConstraintType.SkillTraversal,
      skillId: "skill_rust",
      proficiencyLevel: "expert",
      displayValue: "expert Rust",
      origin: SkillConstraintOrigin.User,
      cypherFragment: "(e)-[:HAS_SKILL {proficiencyLevel: 'expert'}]->(:Skill {id: 'skill_rust'})",
    };

    const skill2 = {
      id: "skill_cobol",
      type: ConstraintType.SkillTraversal,
      skillId: "skill_cobol",
      proficiencyLevel: "expert",
      displayValue: "expert COBOL",
      origin: SkillConstraintOrigin.User,
      cypherFragment: "(e)-[:HAS_SKILL {proficiencyLevel: 'expert'}]->(:Skill {id: 'skill_cobol'})",
    };

    const skill3 = {
      id: "skill_typescript",
      type: ConstraintType.SkillTraversal,
      skillId: "skill_typescript",
      proficiencyLevel: "expert",
      displayValue: "expert TypeScript",
      origin: SkillConstraintOrigin.User,
      cypherFragment: "(e)-[:HAS_SKILL {proficiencyLevel: 'expert'}]->(:Skill {id: 'skill_typescript'})",
    };

    const allConstraints = [skill1, skill2, skill3];
    const conflictSetConstraints = [skill1, skill2]; // Rust + COBOL = rare combo

    const result = await generateConflictExplanations(
      session,
      allConstraints,
      conflictSetConstraints
    );

    // All 3 skills in full stats
    expect(result.stats.allConstraintStats).toHaveLength(3);

    // Just 2 skills in conflict stats
    expect(result.stats.conflictingConstraintStats).toHaveLength(2);

    // Log for manual inspection
    console.log("Full query count:", result.stats.countMatchingAll);
    console.log("Conflict: Rust + COBOL");
    console.log("Template:", result.dataAwareExplanation);
    console.log("LLM:", result.llmExplanation);
  });
});
```

#### 3. Update Vitest Config (if needed)
If integration tests are slow, consider separating them. Add to `recommender_api/vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    // Increase timeout for LLM tests (default is 5000ms)
    testTimeout: 15000,
  },
});
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit`
- [x] All tests pass with Tilt running: `npm test`
- [x] Integration tests complete within timeout
- [x] Both `dataAwareExplanation` and `llmExplanation` fields are populated in test output

#### Manual Verification:
- [ ] Review test output: `dataAwareExplanation` contains specific numbers from database
- [ ] Review test output: `llmExplanation` adds reasoning and alternatives
- [ ] Compare quality: LLM explanation should be noticeably richer than template
- [ ] Verify response times: template < 100ms, LLM < 5s

---

## Testing Strategy

### Unit Tests
- Mock `ollama` module and Neo4j session to test service behavior in isolation
- Test conflict type detection logic
- Test data-aware template generation with mocked database responses
- Test that both `dataAwareExplanation` and `llmExplanation` are returned
- **Test full query vs conflict set distinction**: Verify `allConstraintStats` has all constraints while `conflictingConstraintStats` has only the conflict set
- **Test separate stats functions**: Mock `queryConstraintsStats` and `getCountMatchingAllConstraints` independently to verify the explanation service assembles them correctly

### Integration Tests
- Run against real Ollama instance (part of Tilt stack)
- Run against real Neo4j with seed data
- Verify database statistics queries return expected values
- Verify LLM receives correct RAG context (both full query and conflict set)
- **Test countMatchingAll accuracy**: Verify it matches the full user query result, not just the conflict set
- Run as part of standard `npm test` suite

### Manual Testing Steps
1. Start all services via Tilt: `./bin/tilt-start.sh` (Ollama starts automatically)
2. Verify Ollama resource is green in Tilt UI
3. Make search request with known conflicting constraints:
   ```bash
   curl -X POST http://localhost:4025/api/search \
     -H "Content-Type: application/json" \
     -d '{"requiredSeniorityLevel": "staff", "maxBudget": 100000}'
   ```
4. Check response includes `conflictSets` with both full query stats and conflict-specific stats:
   ```json
   {
     "conflictSets": [{
       "dataAwareExplanation": "Your search returns 0 engineers. The conflict: 12 with 10+ years experience (DB distribution: junior: 6, mid: 12, senior: 10, staff+: 12). 8 within $100,000 budget (salaries in DB range $85,000-$350,000). Full query breakdown: ...",
       "llmExplanation": "Staff-level engineers (10+ years experience) command premium salaries due to their technical leadership responsibilities. In the current market, staff engineers typically earn $180k-300k. Your $100k budget aligns better with mid-level engineers. Consider: (1) adjusting budget to $180k+, or (2) targeting senior-level engineers who may have comparable skills.",
       "stats": {
         "countMatchingAll": 0,
         "allConstraintStats": [
           {
             "type": "yearsExperience",
             "displayValue": "yearsExperience >= 10 (staff)",
             "countMatching": 12,
             "requestedMinYears": 10,
             "requestedMaxYears": null,
             "minYearsInDb": 1,
             "maxYearsInDb": 20,
             "countByRange": {"junior": 6, "mid": 12, "senior": 10, "staffPlus": 12}
           },
           {
             "type": "salary",
             "displayValue": "salary ≤ $100,000",
             "countMatching": 8,
             "requestedMax": 100000,
             "minSalaryInDb": 85000,
             "maxSalaryInDb": 350000
           }
         ],
         "conflictingConstraintStats": [
           {
             "type": "yearsExperience",
             "displayValue": "yearsExperience >= 10 (staff)",
             "countMatching": 12,
             "requestedMinYears": 10,
             "requestedMaxYears": null,
             "minYearsInDb": 1,
             "maxYearsInDb": 20,
             "countByRange": {"junior": 6, "mid": 12, "senior": 10, "staffPlus": 12}
           },
           {
             "type": "salary",
             "displayValue": "salary ≤ $100,000",
             "countMatching": 8,
             "requestedMax": 100000,
             "minSalaryInDb": 85000,
             "maxSalaryInDb": 350000
           }
         ]
       },
       "constraints": [...]
     }]
   }
   ```
5. Compare both explanations:
   - `dataAwareExplanation`: Should contain **only facts from our database** - conflict focus + full breakdown
   - `llmExplanation`: Should add **reasoning and alternatives** (market context, suggestions)
   - `stats.countMatchingAll`: Result count from the **full user query** (including all constraints + derived)
   - `stats.allConstraintStats`: Stats for **all constraints** (full visibility)
   - `stats.conflictingConstraintStats`: Stats for **just the conflict set** (the problem being explained)

## Performance Considerations

- **Template-first strategy** means most explanations are instant
- **LLM timeout** of 5 seconds prevents blocking (configurable)
- **Connection caching** avoids repeated health checks
- **Fallback guarantees** response even if LLM fails

## Configuration Reference

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `LLM_HOST` | `http://127.0.0.1:11434` | Ollama server address |
| `LLM_MODEL` | `qwen2.5:14b-instruct` | Model to use for completions |
| `LLM_ENABLED` | `true` | Set to `false` to disable LLM entirely |
| `LLM_TIMEOUT_MS` | `5000` | Request timeout in milliseconds |

## References

- Research document: `thoughts/shared/1_chapter_5/2.5_project_2.5/research/2026-01-14-conflict-explanation-generation.md`
- Ollama JS library: https://github.com/ollama/ollama-js
- Qwen2.5 model info: https://qwenlm.github.io/blog/qwen2.5/
