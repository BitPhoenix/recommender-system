#!/usr/bin/env npx ts-node

import { Ollama } from "ollama";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  sentenceCount?: number;
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
