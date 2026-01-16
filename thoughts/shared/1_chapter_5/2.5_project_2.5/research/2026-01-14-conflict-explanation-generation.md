# Conflict Explanation Generation: Approaches and Tradeoffs

## Context

The Constraint Advisor generates `ConflictSet` objects when search results are sparse. Each conflict set contains:
- `constraints`: The combination of filters that conflict
- `explanation`: A human-readable explanation of why they conflict

## Current Implementation

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

**Output examples:**
- Single constraint: `"The constraint 'senior seniority' alone is too restrictive."`
- Multiple constraints: `"The combination of staff seniority, expert Rust and salary ≤ $120,000 is too restrictive."`

This is a mechanical description of *what* conflicts, not *why* they conflict in the domain sense.

---

## Future Approaches

### 1. LLM-based (Most Flexible)

```typescript
async function generateConflictExplanation(constraints: TestableConstraint[]): Promise<string> {
  const prompt = `Given these conflicting constraints in a talent search:
    ${JSON.stringify(constraints)}
    Explain in one sentence why these are unlikely to coexist.`;

  return await llm.complete(prompt);
}
```

**Pros:**
- Rich, contextual explanations
- Understands domain nuances without explicit encoding
- No manual rule authoring required

**Cons:**
- Latency (~500ms-2s per request)
- Cost per request
- Non-deterministic output
- Potential hallucinations

### 2. Domain Rule Templates (Deterministic)

Define explanation templates for known conflict patterns:

```typescript
const conflictTemplates: Record<string, (constraints) => string> = {
  'seniorityLevel+salary': (c) =>
    `${c.seniority}-level engineers typically command salaries above ${marketRate[c.seniority]}`,
  'skills+skills': (c) =>
    `${c.skill1} and ${c.skill2} are rarely found together in the same engineer`,
  // ...
};
```

**Pros:**
- Fast (synchronous)
- Predictable, testable output
- No API costs

**Cons:**
- Manual maintenance required
- Limited to anticipated patterns
- Can feel robotic

### 3. Knowledge Graph Enrichment (Existing Stack)

Store domain knowledge in Neo4j and query it:

```cypher
MATCH (s1:Skill)-[r:RARELY_COMBINED_WITH]->(s2:Skill)
WHERE s1.id = $skill1 AND s2.id = $skill2
RETURN r.explanation
```

**Pros:**
- Leverages existing infrastructure
- Queryable and auditable
- Maintainable by non-developers

**Cons:**
- Requires upfront knowledge modeling
- Limited expressiveness

### 4. Hybrid (Recommended)

Use templates for common patterns, fall back to LLM for unknown combinations:

```typescript
function generateExplanation(constraints): string | Promise<string> {
  const pattern = identifyConflictPattern(constraints);
  if (conflictTemplates[pattern]) {
    return conflictTemplates[pattern](constraints);  // sync, fast
  }
  return llmFallback(constraints);  // async, richer
}
```

**Rationale:** Most conflicts fall into predictable categories (seniority-salary, rare skill combos, timezone-availability), so templates handle ~80% of cases instantly. The LLM fallback handles edge cases without requiring anticipation of every scenario.

---

## LLM Capabilities Beyond Templates

### 1. Cross-Constraint Reasoning

**Template:**
> "The combination of staff seniority and salary ≤ $120,000 is too restrictive."

**LLM:**
> "Staff-level engineers in the US typically earn $180,000-$250,000. Your $120,000 budget might work for senior-level instead, or for staff engineers in regions with lower cost of living like Eastern Europe or Latin America."

The LLM connects seniority → market rates → geography without explicit encoding.

### 2. Skill Ecosystem Knowledge

**Template:**
> "Expert Rust and expert COBOL are rarely combined."

**LLM:**
> "Rust and COBOL represent different eras and ecosystems. Engineers specializing in Rust typically come from systems programming or modern backend development, while COBOL expertise is concentrated in legacy financial/government systems. Consider whether you actually need both, or if the underlying need (e.g., performance + mainframe integration) could be solved differently."

The LLM understands *why* skills don't overlap and can suggest alternatives.

### 3. Temporal/Market Awareness

**Template:** Static, frozen at write-time.

**LLM can incorporate:**
> "Kubernetes expertise was rare in 2018 but is now common among mid-level engineers. Your combination of 'junior + Kubernetes' is actually quite feasible in 2026."

Or conversely:
> "GenAI/LLM experience at the 'expert' level is still rare—most practitioners have < 3 years experience. Consider 'proficient' instead."

### 4. Nuanced Intent Interpretation

When constraints conflict, the LLM can infer what the user *actually* wants:

```typescript
// User searched for:
{ skills: ["React", "Angular", "Vue"], operator: "ALL" }
```

**Template:**
> "Requiring all three frontend frameworks is too restrictive."

**LLM:**
> "Engineers rarely master all three frameworks—most specialize in one. If you need framework flexibility for a consulting role, consider requiring one framework at 'expert' plus general 'frontend architecture' experience. If this is for a specific project, which framework is your codebase actually using?"

### 5. Evidence Synthesis

Given conflict set evidence:
```typescript
evidence: [
  { constraintField: "seniorityLevel", resultingCountIfRelaxed: 3 },
  { constraintField: "skills", resultingCountIfRelaxed: 5 },
  { constraintField: "salary", resultingCountIfRelaxed: 2 }
]
```

**Template:** Lists the numbers mechanically.

**LLM:**
> "Your salary constraint is the tightest filter (only 2 matches). The 3 staff engineers in your network all have salaries above your budget. Relaxing salary to $150,000 would surface 2 additional candidates who match all other criteria."

---

## Capability Comparison

| Capability | Templates | LLM |
|------------|-----------|-----|
| Explain *what* conflicts | ✓ | ✓ |
| Explain *why* it conflicts | Limited | ✓ |
| Suggest alternatives | Predefined only | Dynamic |
| Market/temporal awareness | ✗ | ✓ |
| Synthesize multiple data points | ✗ | ✓ |
| Infer user intent | ✗ | ✓ |

**Summary:** Templates handle "these things conflict." LLMs handle "here's what you probably meant and how to get there."

---

## Implementation Considerations

### When to Introduce LLM

The LLM approach becomes more compelling when:
1. Explanations need to reference actual market data
2. Candidate-specific context is valuable ("Only 3 engineers in your network have this combination...")
3. The system needs to suggest creative alternatives
4. Edge cases become frequent enough that template maintenance is burdensome

### Cost/Latency Mitigation

- Cache common conflict pattern explanations
- Generate explanations asynchronously (return template immediately, enhance with LLM in background)
- Batch multiple conflict sets into single LLM call
- Use smaller/faster models for straightforward patterns

---

## Does LLM Benefit Relaxation Rationales?

The relaxation suggestions also have a `rationale` field, currently template-based:

```typescript
// From relaxation-strategies.config.ts
rationaleTemplate: "Increase budget from ${current} to ${suggested}"
```

**Short answer: Not as much.**

| Aspect | Conflict Explanation | Relaxation Rationale |
|--------|---------------------|---------------------|
| Core question | "Why don't these work together?" | "What change would help?" |
| Domain reasoning needed | High - market rates, skill ecosystems | Low - change is self-explanatory |
| Impact visibility | Implicit | Explicit via `resultingMatches` |
| User decision | Complex (why? what to do?) | Simple (accept/reject) |

The key insight: LLMs add value when explaining *why* something is true, not just *what* is true. Relaxation rationales already state the concrete action and show the impact via `resultingMatches`. The "why" is implicit (you want more candidates).

**Current output:**
> "Increase budget from $100,000 to $150,000" + `resultingMatches: 5`

The user already knows everything they need: do X → get 5 more matches.

### Where LLM Could Add Marginal Value

1. **Synthesis across suggestions** - "Relaxing budget alone yields 2 candidates; combined with lowering seniority, you'd get 12"
2. **Qualitative framing** - "This is a minor compromise" vs "This significantly changes your search"
3. **Market context** - "Staff engineers typically earn $180k+, so this budget adjustment aligns with market rates"

These are nice-to-have enhancements, not the fundamental capability gap that exists for conflict explanations.

**Conclusion:** LLM for conflict explanations has high value (explains *why*). LLM for relaxation rationales has marginal value (the *what* is already clear). Template-based rationales are adequate.
