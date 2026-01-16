# Qwen Model Comparison Testing Implementation Plan

## Overview

Execute standardized tests across 8 Qwen models (3 Qwen2.5 variants and 5 Qwen3 variants) to compare performance, quality, and response characteristics. Each model will be warmed up, tested with **6 prompts**, and results recorded in the existing comparison document.

## Current State Analysis

The existing document `docs/model_testing/qwen2.5-7b-vs-14b-comparison.md` contains:
- 3 test prompts (Multi-Step Reasoning, Trade-Off Analysis, Causal Chain Reasoning)
- Results for qwen2.5:7b-instruct, qwen2.5:14b-instruct, qwen2.5:32b-instruct
- Performance tables and analysis sections

**Gap Analysis**: The existing tests don't cover production-like RAG prompts, instruction following, or domain context injection. Three additional tests have been added.

## Desired End State

The comparison document will be expanded to include results from all 8 models:
- Qwen 2.5: 7b-instruct, 14b-instruct, 32b-instruct (already present)
- Qwen 3: 4b, 8b, 14b, 30b-a3b, 32b (to be added)

Each model's results will include:
- Response times for all 3 tests
- Full response content in collapsible sections
- Quality assessment in analysis tables
- Updated summary tables comparing all models

## What We're NOT Doing

- Not modifying the test prompts (beyond what's defined here)
- Not testing models outside the specified list
- Not changing the evaluation criteria

## Test Prompts Reference

### Test 1: Multi-Step Reasoning
```
A search finds 3 staff engineers: one earns $180k in Pacific timezone, one earns $95k in Eastern timezone, and one earns $150k in Central timezone. The budget is $100k and the team needs Eastern or Central timezone overlap. Which engineers are viable candidates and why might this search return zero results after filtering?
```

### Test 2: Trade-Off Analysis
```
Explain the trade-offs when a hiring manager wants a 'staff-level React expert available immediately' but the talent pool shows most staff engineers have 3-month notice periods while mid-level engineers are available immediately. What constraints should be relaxed first and why?
```

### Test 3: Causal Chain Reasoning
```
If a constraint advisor detects that 'seniority=staff' and 'budget<120k' conflict, explain the causal chain: what market dynamics cause this, what implicit assumptions are being violated, and suggest two different resolution strategies with their trade-offs.
```

### Test 4: RAG-Contextualized Prompt (Production-like)
This test mirrors the actual production prompt structure from `conflict-explanation.service.ts`.

**System Prompt:**
```
You are an expert in tech talent acquisition. You will be given:
1. A set of search constraints that produced few/no results
2. Actual statistics from our engineer database (individual counts per constraint + combined count)

Your task: Explain WHY these constraints conflict. Use the provided statistics as facts, but add your knowledge of:
- Market dynamics (salary ranges, skill rarity)
- Career path patterns (which skills tend to co-occur)
- Hiring realities

Also suggest specific alternatives based on the data provided.

Keep your response concise (2-4 sentences).
```

**User Prompt:**
```
# Search Query Analysis

Total engineers matching the full query: 0

## Conflicting Constraints (the problem)
These constraints together produce insufficient results:
- "expert React": 12 engineers at expert level, 45 at lower proficiency levels
- "salary ≤ $100,000": 28 engineers within $100,000 budget. Database salary range: $65,000 - $195,000

## Full Query Breakdown (all constraints)
Complete visibility into how each constraint narrows the pool:
- "expert React": 12 engineers at expert level, 45 at lower proficiency levels
- "salary ≤ $100,000": 28 engineers within $100,000 budget. Database salary range: $65,000 - $195,000
- "Eastern or Central timezone": 67 engineers in Eastern or Central. Timezone distribution: Eastern: 32, Central: 35, Mountain: 18, Pacific: 25
```

### Test 5: Conciseness Instruction Following
Tests whether models respect explicit length constraints.

**System Prompt:**
```
You are a hiring assistant. Respond in exactly 2 sentences, no more.
```

**User Prompt:**
```
Why might a search for "staff engineer with Kubernetes expertise earning under $130k in Pacific timezone" return zero results?
```

**Evaluation Criteria:** Count sentences in response. Ideal = 2.

### Test 6: Domain Context Injection
Tests whether models correctly use provided domain definitions instead of general knowledge.

**Prompt:**
```
Context: In this system, engineering seniority levels are defined as:
- junior: 0-2 years experience, typical salary $60k-$90k
- mid: 2-5 years experience, typical salary $90k-$120k
- senior: 5-10 years experience, typical salary $120k-$160k
- staff: 10+ years experience, typical salary $160k-$200k+

Question: A search for "senior engineer" with budget "$100k" found 0 results. Based on the definitions above, explain why this is expected and what the user should change.
```

**Evaluation Criteria:** Does the model correctly reference the provided salary ranges ($120k-$160k for senior) rather than making up different numbers?

## Execution Method

Use the test script for each model:
```bash
cd docs/model_testing && npx ts-node run-model-tests.ts <model-name>
```

The script automatically:
1. Warms up the model
2. Runs all 6 tests with precise timing
3. Saves results to `docs/model_testing/results/<model>-<timestamp>.json`
4. Prints a summary table to console

### Evaluation Criteria by Test

| Test | Primary Metric | Secondary Metrics |
|------|----------------|-------------------|
| Test 1 (Multi-Step) | Correct answer | Reasoning clarity, structure |
| Test 2 (Trade-Off) | Correct recommendation | Trade-offs identified, actionability |
| Test 3 (Causal Chain) | Domain understanding | Market dynamics, resolution strategies |
| Test 4 (RAG Context) | Uses provided statistics | Conciseness (2-4 sentences), actionable suggestions |
| Test 5 (Conciseness) | Exactly 2 sentences | Content quality within constraint |
| Test 6 (Domain Context) | Correctly cites $120k-$160k | Follows provided definitions vs. hallucinating |

### Results JSON Structure

Each test run produces a JSON file with:
```json
{
  "model": "qwen2.5:7b-instruct",
  "runDate": "2026-01-16T...",
  "warmupTimeMs": 1234,
  "tests": [
    {
      "testId": "test1_multiStepReasoning",
      "testName": "Multi-Step Reasoning",
      "responseTimeMs": 15500,
      "response": "...",
      "timestamp": "..."
    },
    // ... 5 more tests
  ],
  "summary": {
    "totalTimeMs": 85000,
    "averageTimeMs": 14166
  }
}
```

---

## Phase 0: Create Test Script

### Overview
Create a Node.js script that automates test execution using the existing `ollama` npm package. The script will run all 6 tests against a specified model and output structured results.

### Script Location
`docs/model_testing/run-model-tests.ts`

### Script Requirements

1. **Input**: Model name as CLI argument
2. **Output**: JSON results file + console summary
3. **Features**:
   - Warm-up call before tests
   - Precise timing for each test
   - Capture full response content
   - Save to `docs/model_testing/results/<model-name>-<timestamp>.json`

### Script Implementation

```typescript
#!/usr/bin/env npx ts-node

import { Ollama } from "ollama";
import * as fs from "fs";
import * as path from "path";

const TEST_PROMPTS = {
  test1_multiStepReasoning: {
    name: "Multi-Step Reasoning",
    prompt: `A search finds 3 staff engineers: one earns $180k in Pacific timezone, one earns $95k in Eastern timezone, and one earns $150k in Central timezone. The budget is $100k and the team needs Eastern or Central timezone overlap. Which engineers are viable candidates and why might this search return zero results after filtering?`,
  },
  test2_tradeOffAnalysis: {
    name: "Trade-Off Analysis",
    prompt: `Explain the trade-offs when a hiring manager wants a 'staff-level React expert available immediately' but the talent pool shows most staff engineers have 3-month notice periods while mid-level engineers are available immediately. What constraints should be relaxed first and why?`,
  },
  test3_causalChain: {
    name: "Causal Chain Reasoning",
    prompt: `If a constraint advisor detects that 'seniority=staff' and 'budget<120k' conflict, explain the causal chain: what market dynamics cause this, what implicit assumptions are being violated, and suggest two different resolution strategies with their trade-offs.`,
  },
  test4_ragContextualized: {
    name: "RAG-Contextualized (Production-like)",
    system: `You are an expert in tech talent acquisition. You will be given:
1. A set of search constraints that produced few/no results
2. Actual statistics from our engineer database (individual counts per constraint + combined count)

Your task: Explain WHY these constraints conflict. Use the provided statistics as facts, but add your knowledge of:
- Market dynamics (salary ranges, skill rarity)
- Career path patterns (which skills tend to co-occur)
- Hiring realities

Also suggest specific alternatives based on the data provided.

Keep your response concise (2-4 sentences).`,
    prompt: `# Search Query Analysis

Total engineers matching the full query: 0

## Conflicting Constraints (the problem)
These constraints together produce insufficient results:
- "expert React": 12 engineers at expert level, 45 at lower proficiency levels
- "salary ≤ $100,000": 28 engineers within $100,000 budget. Database salary range: $65,000 - $195,000

## Full Query Breakdown (all constraints)
Complete visibility into how each constraint narrows the pool:
- "expert React": 12 engineers at expert level, 45 at lower proficiency levels
- "salary ≤ $100,000": 28 engineers within $100,000 budget. Database salary range: $65,000 - $195,000
- "Eastern or Central timezone": 67 engineers in Eastern or Central. Timezone distribution: Eastern: 32, Central: 35, Mountain: 18, Pacific: 25`,
  },
  test5_conciseness: {
    name: "Conciseness Instruction Following",
    system: `You are a hiring assistant. Respond in exactly 2 sentences, no more.`,
    prompt: `Why might a search for "staff engineer with Kubernetes expertise earning under $130k in Pacific timezone" return zero results?`,
  },
  test6_domainContext: {
    name: "Domain Context Injection",
    prompt: `Context: In this system, engineering seniority levels are defined as:
- junior: 0-2 years experience, typical salary $60k-$90k
- mid: 2-5 years experience, typical salary $90k-$120k
- senior: 5-10 years experience, typical salary $120k-$160k
- staff: 10+ years experience, typical salary $160k-$200k+

Question: A search for "senior engineer" with budget "$100k" found 0 results. Based on the definitions above, explain why this is expected and what the user should change.`,
  },
};

interface TestResult {
  testId: string;
  testName: string;
  model: string;
  responseTimeMs: number;
  response: string;
  sentenceCount?: number; // For test5
  timestamp: string;
}

interface ModelTestResults {
  model: string;
  runDate: string;
  warmupTimeMs: number;
  tests: TestResult[];
  summary: {
    totalTimeMs: number;
    averageTimeMs: number;
  };
}

async function runTest(
  client: Ollama,
  model: string,
  testId: string,
  testConfig: { name: string; prompt: string; system?: string }
): Promise<TestResult> {
  const messages: Array<{ role: "system" | "user"; content: string }> = [];

  if (testConfig.system) {
    messages.push({ role: "system", content: testConfig.system });
  }
  messages.push({ role: "user", content: testConfig.prompt });

  const startTime = performance.now();
  const response = await client.chat({ model, messages });
  const endTime = performance.now();

  const result: TestResult = {
    testId,
    testName: testConfig.name,
    model,
    responseTimeMs: Math.round(endTime - startTime),
    response: response.message.content.trim(),
    timestamp: new Date().toISOString(),
  };

  // Count sentences for test5
  if (testId === "test5_conciseness") {
    result.sentenceCount = (result.response.match(/[.!?]+/g) || []).length;
  }

  return result;
}

async function warmupModel(client: Ollama, model: string): Promise<number> {
  console.log(`Warming up ${model}...`);
  const startTime = performance.now();
  await client.chat({
    model,
    messages: [{ role: "user", content: "Hello, respond with OK" }],
  });
  const endTime = performance.now();
  return Math.round(endTime - startTime);
}

async function main() {
  const model = process.argv[2];
  if (!model) {
    console.error("Usage: npx ts-node run-model-tests.ts <model-name>");
    console.error("Example: npx ts-node run-model-tests.ts qwen2.5:7b-instruct");
    process.exit(1);
  }

  const client = new Ollama({ host: "http://localhost:11434" });
  const results: ModelTestResults = {
    model,
    runDate: new Date().toISOString(),
    warmupTimeMs: 0,
    tests: [],
    summary: { totalTimeMs: 0, averageTimeMs: 0 },
  };

  // Warmup
  results.warmupTimeMs = await warmupModel(client, model);
  console.log(`Warmup complete: ${results.warmupTimeMs}ms\n`);

  // Run all tests
  const testEntries = Object.entries(TEST_PROMPTS);
  for (const [testId, testConfig] of testEntries) {
    console.log(`Running ${testConfig.name}...`);
    const result = await runTest(client, model, testId, testConfig);
    results.tests.push(result);
    console.log(`  Time: ${result.responseTimeMs}ms`);
    console.log(`  Response preview: ${result.response.substring(0, 100)}...\n`);
  }

  // Calculate summary
  const totalTime = results.tests.reduce((sum, t) => sum + t.responseTimeMs, 0);
  results.summary = {
    totalTimeMs: totalTime,
    averageTimeMs: Math.round(totalTime / results.tests.length),
  };

  // Save results
  const resultsDir = path.join(__dirname, "results");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const safeModelName = model.replace(/[:/]/g, "-");
  const filename = `${safeModelName}-${Date.now()}.json`;
  const filepath = path.join(resultsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(results, null, 2));

  // Print summary
  console.log("=".repeat(60));
  console.log(`Model: ${model}`);
  console.log(`Total time: ${results.summary.totalTimeMs}ms`);
  console.log(`Average per test: ${results.summary.averageTimeMs}ms`);
  console.log(`Results saved to: ${filepath}`);
  console.log("=".repeat(60));

  // Print timing table
  console.log("\nTiming Summary:");
  console.log("| Test | Time |");
  console.log("|------|------|");
  for (const test of results.tests) {
    console.log(`| ${test.testName} | ${(test.responseTimeMs / 1000).toFixed(1)}s |`);
  }
}

main().catch(console.error);
```

### Success Criteria

#### Automated Verification:
- [x] Script compiles: `npx tsc --noEmit docs/model_testing/run-model-tests.ts`
- [x] Script runs with test model: `npx ts-node docs/model_testing/run-model-tests.ts qwen2.5:7b-instruct`
- [x] Results JSON file is created in `docs/model_testing/results/`

#### Manual Verification:
- [x] Results JSON contains all 6 tests
- [x] Response times are reasonable (not 0ms or extremely long)
- [x] Responses are coherent

**Implementation Note**: Create this script first before running any model tests.

---

## Phase 1: qwen2.5:7b-instruct (4.7 GB)

### Overview
Re-run tests on 7B model to verify baseline and ensure consistency with existing results.

### Execution
```bash
cd docs/model_testing && npx ts-node run-model-tests.ts qwen2.5:7b-instruct
```

### Success Criteria

#### Automated Verification:
- [x] Script completes without errors
- [x] Results JSON saved to `docs/model_testing/results/qwen2.5-7b-instruct-*.json`
- [x] All 6 tests have response times captured

#### Manual Verification:
- [x] Results are consistent with existing document data (Tests 1-3)
- [x] Test 4: Response is 2-4 sentences and uses provided statistics
- [x] Test 5: Response is exactly 2 sentences
- [x] Test 6: Correctly cites $120k-$160k as senior salary range

**Implementation Note**: After completing this phase, pause for confirmation before proceeding to Phase 2.

---

## Phase 2: qwen2.5:14b-instruct (9.0 GB)

### Overview
Re-run tests on 14B model to verify baseline.

### Execution
```bash
cd docs/model_testing && npx ts-node run-model-tests.ts qwen2.5:14b-instruct
```

### Success Criteria

#### Automated Verification:
- [x] Script completes without errors
- [x] Results JSON saved to `docs/model_testing/results/qwen2.5-14b-instruct-*.json`

#### Manual Verification:
- [x] Results consistent with existing document (Tests 1-3)
- [x] Test 5: Exactly 2 sentences
- [x] Test 6: Correctly cites $120k-$160k

**Implementation Note**: After completing this phase, pause for confirmation before proceeding to Phase 3.

---

## Phase 3: qwen2.5:32b-instruct (19 GB)

### Overview
Re-run tests on 32B model to verify baseline.

### Execution
```bash
cd docs/model_testing && npx ts-node run-model-tests.ts qwen2.5:32b-instruct
```

### Success Criteria

#### Automated Verification:
- [x] Script completes without errors
- [x] Results JSON saved to `docs/model_testing/results/qwen2.5-32b-instruct-*.json`

#### Manual Verification:
- [x] Results consistent with existing document (Tests 1-3)
- [x] Test 5: Exactly 2 sentences
- [x] Test 6: Correctly cites $120k-$160k

**Implementation Note**: After completing this phase, pause for confirmation before proceeding to Phase 4.

---

## Phase 4: qwen3:4b (2.5 GB)

### Overview
First Qwen3 model - smallest variant. Test baseline Qwen3 performance.

### Execution
```bash
cd docs/model_testing && npx ts-node run-model-tests.ts qwen3:4b
```

### Success Criteria

#### Automated Verification:
- [x] Script completes without errors
- [x] Results JSON saved to `docs/model_testing/results/qwen3-4b-*.json`

#### Manual Verification:
- [x] Responses are coherent and address the prompts
- [x] Test 5: Check sentence count (target: 2)
- [x] Test 6: Check if $120k-$160k is correctly cited

**Implementation Note**: After completing this phase, pause for confirmation before proceeding to Phase 5.

---

## Phase 5: qwen3:8b (5.2 GB)

### Overview
Test qwen3:8b - comparable size to qwen2.5:7b-instruct.

### Execution
```bash
cd docs/model_testing && npx ts-node run-model-tests.ts qwen3:8b
```

### Success Criteria

#### Automated Verification:
- [x] Script completes without errors
- [x] Results JSON saved to `docs/model_testing/results/qwen3-8b-*.json`

#### Manual Verification:
- [x] Responses are coherent
- [x] Compare quality to qwen2.5:7b-instruct (similar size)

**Implementation Note**: After completing this phase, pause for confirmation before proceeding to Phase 6.

---

## Phase 6: qwen3:14b (9.3 GB)

### Overview
Test qwen3:14b - comparable size to qwen2.5:14b-instruct.

### Execution
```bash
cd docs/model_testing && npx ts-node run-model-tests.ts qwen3:14b
```

### Success Criteria

#### Automated Verification:
- [x] Script completes without errors
- [x] Results JSON saved to `docs/model_testing/results/qwen3-14b-*.json`

#### Manual Verification:
- [x] Responses are coherent
- [x] Compare quality to qwen2.5:14b-instruct (similar size)

**Implementation Note**: After completing this phase, pause for confirmation before proceeding to Phase 7.

---

## Phase 7: qwen3:30b-a3b (18 GB, MoE with 3B active)

### Overview
Test the Mixture of Experts model - unique architecture with 30B total params but only 3B active.

### Execution
```bash
cd docs/model_testing && npx ts-node run-model-tests.ts qwen3:30b-a3b
```

### Success Criteria

#### Automated Verification:
- [x] Script completes without errors
- [x] Results JSON saved to `docs/model_testing/results/qwen3-30b-a3b-*.json`

#### Manual Verification:
- [x] Responses are coherent
- [x] Note MoE-specific characteristics (speed vs quality tradeoff with only 3B active)
- [x] Compare timing to dense models of similar memory footprint

**Implementation Note**: After completing this phase, pause for confirmation before proceeding to Phase 8.

---

## Phase 8: qwen3:32b (20 GB)

### Overview
Test the largest Qwen3 model - comparable to qwen2.5:32b-instruct.

### Execution
```bash
cd docs/model_testing && npx ts-node run-model-tests.ts qwen3:32b
```

### Post-Test: Update Comparison Document
After all 8 models are tested, update `docs/model_testing/qwen2.5-7b-vs-14b-comparison.md` with:
1. Rename file to `qwen-model-comparison.md` (broader scope now)
2. Add all Qwen3 results
3. Update summary tables with all 8 models × 6 tests
4. Add new analysis sections for Tests 4-6

### Success Criteria

#### Automated Verification:
- [x] Script completes without errors
- [x] Results JSON saved to `docs/model_testing/results/qwen3-32b-*.json`
- [x] All 8 result files exist in `docs/model_testing/results/`

#### Manual Verification:
- [x] Responses are coherent
- [x] Compare quality to qwen2.5:32b-instruct (similar size)
- [x] Summary tables updated with all models
- [x] Final recommendations updated
After all models are tested, update the summary tables in the document to include all 8 models:
- Performance Summary table
- Overall Performance table
- Recommendations section

### Success Criteria

#### Automated Verification:
- [ ] Model responds to warm-up prompt
- [ ] All 3 tests complete without errors
- [ ] Response times are captured

#### Manual Verification:
- [ ] Responses are coherent and address the prompts
- [ ] Quality assessment completed for all 3 tests
- [ ] Results added to comparison document
- [ ] Summary tables updated with all 8 models
- [ ] Final recommendations updated based on full comparison

**Implementation Note**: This is the final phase. After completion, review the entire document for consistency and completeness.

---

## Document Update Structure

### For Each Model, Add:

1. **Performance table row** (6 tests):
```markdown
| Model | Test 1 | Test 2 | Test 3 | Test 4 | Test 5 | Test 6 | Average |
```

2. **Collapsible responses for each test**:
```markdown
<details>
<summary><strong>[Model] Response</strong> (click to expand)</summary>

[Full response text]

</details>
```

3. **Analysis table entries** for each test section

### New Test Sections to Add

Add these new sections to the document after Test 3:

- **Test 4: RAG-Contextualized Prompt** - Tests production-like prompt with statistics
- **Test 5: Conciseness Instruction Following** - Tests adherence to "2 sentences" constraint
- **Test 6: Domain Context Injection** - Tests use of provided definitions

### Final Summary Updates

Update the summary section with:
1. Expanded performance comparison table (all 8 models × 6 tests)
2. Qwen 2.5 vs Qwen 3 comparison analysis
3. New metrics: instruction following score, context grounding score
4. Updated recommendations based on full 48-test dataset

---

## References

- Test document: `docs/model_testing/qwen2.5-7b-vs-14b-comparison.md`
- Ollama documentation: https://ollama.ai/library
