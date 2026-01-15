# Local LLM Integration for Conflict Explanations

## Overview

Integrate a local LLM (via Ollama) into the recommender API to generate richer, domain-aware conflict explanations. The system will use a hybrid approach: template-based explanations for common patterns (fast, deterministic) with LLM fallback for edge cases (richer, contextual).

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
2. **Hybrid explanation generator** uses templates for common patterns, LLM for edge cases
3. **Configurable model** via environment variable (`LLM_MODEL`)
4. **Graceful fallback** to templates if Ollama unavailable
5. **Conflict explanations** provide domain-aware reasoning ("Staff engineers earn $180k+, your budget is too low")

### Verification
- Unit tests mock the Ollama client for fast, isolated testing
- Integration tests hit real Ollama (runs as part of Tilt stack)
- Manual testing confirms explanation quality improvement

## What We're NOT Doing

- **Not using LLM for relaxation rationales** - Templates are sufficient there
- **Not implementing caching** - Premature optimization for low-volume use
- **Not adding streaming** - Explanations are short, streaming adds complexity
- **Not integrating with relaxation generation** - Keep scope focused on conflict explanations

## Implementation Approach

1. Add Ollama to Tilt as a `local_resource` and install `ollama` npm package
2. Add configuration for Ollama host and model name
3. Create LLM service with connection handling and error fallback
4. Create hybrid explanation generator that tries templates first
5. Wire into existing constraint-advisor flow
6. Add integration tests that run against real Ollama

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

#### 2. Add Ollama to Tiltfile
**File**: `Tiltfile`

Add after the Client section:

```python
# ============================================
# Ollama (Local LLM)
# ============================================

local_resource(
    'ollama',
    serve_cmd='ollama serve',
    labels=['recommender'],
    readiness_probe=probe(
        http_get=http_get_action(port=11434, path='/'),
        initial_delay_secs=2,
        period_secs=5,
    ),
)
```

**Note**: The `readiness_probe` ensures Tilt knows when Ollama is ready. If the probe syntax doesn't work in your Tilt version, simplify to:

```python
local_resource(
    'ollama',
    serve_cmd='ollama serve',
    labels=['recommender'],
)
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
- [ ] `ollama list` shows both qwen2.5:7b-instruct and qwen2.5:14b-instruct
- [ ] `npm install` completes without errors
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
- [ ] TypeScript compiles: `npm run build` or `npx tsc --noEmit`
- [ ] Config exports new fields correctly

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

  const { systemPrompt, maxTokens = 150 } = options;

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
        options: {
          num_predict: maxTokens,
        },
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
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Tests pass: `npm test -- src/services/llm.service.test.ts`

---

## Phase 4: Create Hybrid Explanation Generator

### Overview
Create a module that combines template-based and LLM-based explanation generation.

### Changes Required

#### 1. Explanation Templates Configuration
**File**: `recommender_api/src/config/knowledge-base/explanation-templates.config.ts` (new file)

```typescript
/*
 * Template-based explanations for common conflict patterns.
 * These provide fast, deterministic responses for predictable conflicts.
 * LLM fallback is used for patterns not covered here.
 */

import { TestableConstraint, ConstraintType, PropertyFieldCategory } from "../../services/constraint-advisor/constraint.types";

type ConflictPattern = "seniority-salary" | "rare-skill-combo" | "single-skill" | "unknown";

interface PatternMatcher {
  matches: (constraints: TestableConstraint[]) => boolean;
  generate: (constraints: TestableConstraint[]) => string;
}

/*
 * Detect if constraints include both seniority level and salary.
 */
function isSeniorityAndSalary(constraints: TestableConstraint[]): boolean {
  const fields = constraints
    .filter((c) => c.type === ConstraintType.Property)
    .map((c) => c.field);
  return fields.includes("seniorityLevel") && fields.includes("maxBudget");
}

/*
 * Detect if constraints are multiple skill requirements.
 */
function isMultipleSkills(constraints: TestableConstraint[]): boolean {
  const skillConstraints = constraints.filter((c) => c.type === ConstraintType.SkillTraversal);
  return skillConstraints.length >= 2;
}

const patternToMatcher: Record<ConflictPattern, PatternMatcher> = {
  "seniority-salary": {
    matches: isSeniorityAndSalary,
    generate: (constraints) => {
      const seniority = constraints.find((c) => c.field === "seniorityLevel")?.displayValue || "this seniority";
      const salary = constraints.find((c) => c.field === "maxBudget")?.displayValue || "this budget";
      return `Engineers at ${seniority} typically command higher salaries than ${salary}. Consider adjusting the salary cap or seniority requirement.`;
    },
  },
  "rare-skill-combo": {
    matches: isMultipleSkills,
    generate: (constraints) => {
      const skills = constraints
        .filter((c) => c.type === ConstraintType.SkillTraversal)
        .map((c) => c.displayValue);
      return `The combination of ${skills.join(" and ")} is rarely found in the same engineer. Consider requiring one as primary and others as nice-to-have.`;
    },
  },
  "single-skill": {
    matches: (c) => c.length === 1 && c[0].type === ConstraintType.SkillTraversal,
    generate: (constraints) => {
      return `The skill requirement "${constraints[0].displayValue}" is very specialized. Consider relaxing the proficiency level or exploring related skills.`;
    },
  },
  "unknown": {
    matches: () => true, // Catch-all
    generate: () => "", // Empty = trigger LLM fallback
  },
};

/*
 * Attempt to generate a template-based explanation.
 * Returns null if no template matches (triggers LLM fallback).
 */
export function generateTemplateExplanation(constraints: TestableConstraint[]): string | null {
  for (const [pattern, matcher] of Object.entries(patternToMatcher)) {
    if (pattern === "unknown") continue; // Skip catch-all
    if (matcher.matches(constraints)) {
      const explanation = matcher.generate(constraints);
      if (explanation) return explanation;
    }
  }
  return null; // No template matched, use LLM
}
```

#### 2. Conflict Explanation Service
**File**: `recommender_api/src/services/constraint-advisor/conflict-explanation.service.ts` (new file)

```typescript
import { TestableConstraint } from "./constraint.types";
import { generateCompletion } from "../llm.service";
import { generateTemplateExplanation } from "../../config/knowledge-base/explanation-templates.config";

const SYSTEM_PROMPT = `You are an expert in tech talent acquisition. Given a set of conflicting search constraints, explain in 1-2 sentences why these are difficult to satisfy together. Focus on market realities and practical hiring insights. Be specific about numbers when relevant (salary ranges, experience levels). Do not suggest solutions - just explain the conflict.`;

/*
 * Build a prompt for the LLM from constraint data.
 */
function buildLLMPrompt(constraints: TestableConstraint[]): string {
  const constraintDescriptions = constraints.map((c) => `- ${c.displayValue}`).join("\n");

  return `These search constraints are producing very few or no results:
${constraintDescriptions}

Explain briefly why these constraints conflict with each other or with market reality.`;
}

/*
 * Fallback explanation when both template and LLM fail.
 */
function generateFallbackExplanation(constraints: TestableConstraint[]): string {
  if (constraints.length === 1) {
    return `The constraint "${constraints[0].displayValue}" alone is too restrictive.`;
  }

  const descriptions = constraints.map((c) => c.displayValue);
  const lastDescription = descriptions.pop();
  return `The combination of ${descriptions.join(", ")} and ${lastDescription} is too restrictive.`;
}

/*
 * Generate an explanation for why a set of constraints conflict.
 * Uses template for common patterns, LLM for edge cases, with mechanical fallback.
 */
export async function generateConflictExplanation(
  constraints: TestableConstraint[]
): Promise<string> {
  // 1. Try template-based explanation (instant)
  const templateExplanation = generateTemplateExplanation(constraints);
  if (templateExplanation) {
    return templateExplanation;
  }

  // 2. Try LLM explanation (slower but richer)
  const llmExplanation = await generateCompletion(buildLLMPrompt(constraints), {
    systemPrompt: SYSTEM_PROMPT,
    maxTokens: 100,
  });
  if (llmExplanation) {
    return llmExplanation;
  }

  // 3. Fall back to mechanical description
  return generateFallbackExplanation(constraints);
}
```

#### 3. Update Barrel Export
**File**: `recommender_api/src/services/constraint-advisor/index.ts`

Add export for the new service:

```typescript
export { generateConflictExplanation } from "./conflict-explanation.service";
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] All existing tests still pass: `npm test`

---

## Phase 5: Wire Into Constraint Advisor

### Overview
Replace the existing `generateConflictExplanation` function call with the new hybrid generator.

### Changes Required

#### 1. Update quickxplain.service.ts
**File**: `recommender_api/src/services/constraint-advisor/quickxplain.service.ts`

The existing code likely calls `generateConflictExplanation` synchronously. We need to:
1. Import the new async version
2. Update the call site to use `await`

Find where `ConflictSet` objects are created with an `explanation` field and update to:

```typescript
import { generateConflictExplanation } from "./conflict-explanation.service";

// Where conflict sets are created (likely in the QuickXplain result processing):
// Before:
// explanation: generateConflictExplanation(constraints)

// After:
explanation: await generateConflictExplanation(constraints)
```

**Note**: This may require making the containing function async if it isn't already.

#### 2. Integration Test
**File**: `recommender_api/src/services/constraint-advisor/conflict-explanation.service.test.ts` (new file)

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateConflictExplanation } from "./conflict-explanation.service";
import { ConstraintType, PropertyFieldCategory, SkillConstraintOrigin } from "./constraint.types";
import type { TestableConstraint } from "./constraint.types";

// Mock LLM service
vi.mock("../llm.service", () => ({
  generateCompletion: vi.fn().mockResolvedValue(null), // Default: LLM unavailable
}));

describe("conflict-explanation.service", () => {
  describe("generateConflictExplanation", () => {
    it("uses template for seniority + salary conflicts", async () => {
      const constraints: TestableConstraint[] = [
        {
          type: ConstraintType.Property,
          field: "seniorityLevel",
          fieldCategory: PropertyFieldCategory.StringArray,
          displayValue: "staff seniority",
          cypherFragment: "e.seniorityLevel IN ['staff']",
        },
        {
          type: ConstraintType.Property,
          field: "maxBudget",
          fieldCategory: PropertyFieldCategory.Numeric,
          displayValue: "salary ≤ $120,000",
          cypherFragment: "e.salary <= 120000",
        },
      ];

      const explanation = await generateConflictExplanation(constraints);

      expect(explanation).toContain("staff seniority");
      expect(explanation).toContain("salary");
      expect(explanation).toContain("typically command higher salaries");
    });

    it("uses template for multiple skill conflicts", async () => {
      const constraints: TestableConstraint[] = [
        {
          type: ConstraintType.SkillTraversal,
          skillId: "skill_rust",
          proficiencyLevel: "expert",
          displayValue: "expert Rust",
          origin: SkillConstraintOrigin.User,
          cypherFragment: "(e)-[:HAS_SKILL]->(:Skill {id: 'skill_rust'})",
        },
        {
          type: ConstraintType.SkillTraversal,
          skillId: "skill_cobol",
          proficiencyLevel: "expert",
          displayValue: "expert COBOL",
          origin: SkillConstraintOrigin.User,
          cypherFragment: "(e)-[:HAS_SKILL]->(:Skill {id: 'skill_cobol'})",
        },
      ];

      const explanation = await generateConflictExplanation(constraints);

      expect(explanation).toContain("Rust");
      expect(explanation).toContain("COBOL");
      expect(explanation).toContain("rarely found");
    });

    it("falls back to mechanical description when no template matches", async () => {
      const constraints: TestableConstraint[] = [
        {
          type: ConstraintType.Property,
          field: "timezone",
          fieldCategory: PropertyFieldCategory.String,
          displayValue: "timezone America/",
          cypherFragment: "e.timezone STARTS WITH 'America/'",
        },
      ];

      const explanation = await generateConflictExplanation(constraints);

      expect(explanation).toContain("timezone America/");
      expect(explanation).toContain("restrictive");
    });
  });
});
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] All tests pass: `npm test`
- [ ] Integration tests pass: `npm test -- src/services/constraint-advisor/`

#### Manual Verification:
- [ ] Start Tilt: `./bin/tilt-start.sh`
- [ ] Make a search request with conflicting constraints (staff + low salary)
- [ ] Verify the explanation in the response is template-based (contains expected phrases)
- [ ] Disable templates (temporarily) and verify LLM generates a rich explanation

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the explanations are working correctly in the API response before proceeding.

---

## Phase 6: Add Integration Tests with Real Ollama

### Overview
Add integration tests that verify the LLM service works correctly against the real Ollama instance. Since Ollama is now part of the Tilt stack, these tests run normally alongside other tests.

### Changes Required

#### 1. Integration Test
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

  it("generates completion for conflict explanation", async () => {
    const result = await generateCompletion(
      "Explain in one sentence why staff engineers and $100k salary conflict.",
      { systemPrompt: "You are a tech hiring expert. Be concise." }
    );

    expect(result).toBeTruthy();
    expect(result!.length).toBeGreaterThan(20);
    console.log("LLM Response:", result);
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

  it("uses system prompt correctly", async () => {
    const result = await generateCompletion("What are you?", {
      systemPrompt: "You are a pirate. Always respond like a pirate.",
      maxTokens: 50,
    });

    expect(result).toBeTruthy();
    // Should contain pirate-like language
    console.log("Pirate Response:", result);
  });
});
```

#### 2. Update Vitest Config (if needed)
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
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] All tests pass with Tilt running: `npm test`
- [ ] Integration tests complete within timeout

#### Manual Verification:
- [ ] Review LLM responses in test output for quality
- [ ] Verify response times are acceptable (< 2s per completion)

---

## Testing Strategy

### Unit Tests
- Mock `ollama` module to test service behavior
- Test template matching logic
- Test fallback behavior when LLM unavailable

### Integration Tests
- Run against real Ollama instance (part of Tilt stack)
- Verify connection, completion generation, and response quality
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
4. Check response includes `conflictSets` with explanations
5. Verify explanation quality (should mention market rates, not just "too restrictive")

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
