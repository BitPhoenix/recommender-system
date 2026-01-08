---
date: 2026-01-06T14:30:00-08:00
researcher: Claude
git_commit: bc75c7446425b86af35a1a5fb8dcaecaf7a6366a
branch: main
repository: recommender_system
topic: "RETE vs json-rules-engine: Which Should We Use for Iterative Requirement Expansion?"
tags: [research, inference-engine, rete, json-rules-engine, forward-chaining, performance]
status: complete
last_updated: 2026-01-06
last_updated_by: Claude
---

# Research: RETE vs json-rules-engine for Iterative Requirement Expansion

**Date**: 2026-01-06T14:30:00-08:00
**Researcher**: Claude
**Git Commit**: bc75c7446425b86af35a1a5fb8dcaecaf7a6366a
**Branch**: main
**Repository**: recommender_system

## Research Question

Should we use RETE algorithm or json-rules-engine for a new version of the iterative requirement expansion plan (`2026-01-06-iterative-requirement-expansion.md`)?

## Summary

**Recommendation: Neither RETE nor json-rules-engine is necessary for your current scale. A simple loop-based implementation is appropriate.**

| Factor | Your Situation | RETE Threshold | json-rules-engine Threshold |
|--------|---------------|----------------|---------------------------|
| Rule count | ~15 planned | 100+ rules | 100-1,000 rules |
| Inference needed | Yes (2-3 hops) | Strong fit | Overkill |
| Facts per request | Small (1 request) | Needs many facts | Good fit |
| Performance target | <50ms acceptable | Sub-ms critical | 25-50ms typical |
| Rule changes | Code deployments | Dynamic needed | JSON config desired |

### The Bottom Line

Your plan proposes **~15 inference rules** with **2-3 hop chains**. This is well below the threshold where RETE's overhead pays off (~100+ rules) and below where json-rules-engine adds significant value over a custom implementation.

**However**, if you anticipate:
- Rules growing to 50+ in the near future
- Non-developers needing to modify rules
- Storing rules in a database for dynamic updates
- Building a rule management UI

Then **json-rules-engine** makes sense as a foundation—not for performance, but for **developer experience and future flexibility**.

---

## Detailed Analysis

### What is RETE?

The RETE algorithm (Latin for "net") was developed by Charles Forgy at CMU (1974-1982). It's a pattern-matching algorithm that optimizes rule evaluation by:

1. **Building a discrimination network** - Rules are compiled into a tree of alpha nodes (single-fact tests) and beta nodes (joins between facts)
2. **Caching intermediate results** - Partial matches are stored in "memories"
3. **Processing only deltas** - When facts change, only affected rules are re-evaluated

**Key Trade-off**: Memory for speed (O(RFP) space complexity where R=rules, F=facts, P=patterns per rule)

### When Does RETE Help?

| Scenario | RETE Benefit |
|----------|--------------|
| 100+ rules with shared conditions | High - node sharing amortizes setup cost |
| Incremental fact updates | High - only changed facts propagate |
| Long-running session with evolving facts | High - memory pays off over time |
| Single-shot evaluation per request | **Low** - setup cost never amortized |
| Rules evaluated once then discarded | **Low** - memory wasted |
| <50 rules | **Low** - simple loop is competitive |

### Your Use Case Analysis

Based on the implementation plan (`2026-01-06-iterative-requirement-expansion.md`):

```
Current situation:
- 15 inference rules proposed (lines 376-724)
- 2-3 hop inference chains (e.g., teamFocus=scaling → skill_distributed → skill_monitoring)
- Single request → expand → query → discard pattern
- Facts: One SearchFilterRequest object per API call
- No persistent working memory across requests
```

**This is exactly the scenario where RETE is overkill:**
- Rules: ~15 (threshold is ~100+)
- Facts: 1 request object (RETE benefits from many facts)
- Evaluation: Single-shot (RETE benefits from incremental updates)
- Memory: Wasted if rebuilt per request

### What is json-rules-engine?

[json-rules-engine](https://github.com/CacheControl/json-rules-engine) is a popular Node.js rules engine (~248k weekly npm downloads) where rules are expressed as JSON structures.

**Important: It does NOT use RETE.** From the maintainer:

> "json-rules-engine is aimed at solving the 95% of business applications which require a small number of rules (i.e. hundreds/thousands of rules), configured by a simple syntax with an easy to use API."

It uses straightforward forward-chaining evaluation:
- Rules evaluated sequentially by priority
- Same-priority rules run in parallel
- Results cached per-run (not across runs)

### json-rules-engine: Costs vs Benefits for Your Case

| Benefit | Relevance to Your Case |
|---------|----------------------|
| JSON-serializable rules | Low - rules are code-defined in config files |
| Dynamic rule loading | Low - rules change with deployments |
| Built-in operators | Medium - you'd implement these anyway |
| Event system | Medium - could simplify tracking fired rules |
| Rule management UI ready | Low - no UI planned |
| Mature, tested library | Medium - reduces bugs in condition evaluation |

| Cost | Impact |
|------|--------|
| Another dependency | Minor - ~17kb gzipped |
| Learning curve | Minor - simple API |
| Async overhead | Minor - ~25-50ms per run |
| Less control | Medium - harder to customize behavior |

### Performance Comparison

| Approach | Expected Performance | Notes |
|----------|---------------------|-------|
| Custom loop (your plan) | <1ms for 15 rules | Direct, no overhead |
| json-rules-engine | 25-50ms for 15 rules | Async/await overhead |
| RETE (via Drools/nools) | Setup cost dominates | Overkill, complex |

Your plan's simple loop (Phase 3, lines 1030-1101) is likely **25-50x faster** than json-rules-engine for this rule count.

---

## Decision Framework

### Use Custom Loop Implementation (Current Plan) When:

✅ Rule count < 50
✅ Rules defined in code, change with deployments
✅ No rule management UI needed
✅ Performance matters (<10ms target)
✅ Full control over inference behavior needed
✅ Simple provenance tracking requirements

**This is your current situation.**

### Use json-rules-engine When:

☐ Rules need to be stored in database
☐ Non-developers modify rules via JSON
☐ Rule management UI planned
☐ 50-1,000 rules expected
☐ Willing to accept 25-50ms overhead
☐ Want community-maintained operator library

### Use Full RETE (Drools, CLIPS) When:

☐ 1,000+ rules
☐ Long-running sessions with evolving facts
☐ Shared conditions across many rules
☐ Complex join patterns between facts
☐ Sub-millisecond performance critical after warmup

---

## Recommendation

### For Now: Stick with the Current Plan's Custom Implementation

The implementation in Phase 3 of `2026-01-06-iterative-requirement-expansion.md` (lines 862-1163) is appropriate:

```typescript
// This simple loop is fine for ~15 rules
while (changed && iteration < maxIterations) {
  changed = false;
  iteration++;

  for (const rule of sortedRules) {
    if (state.firedRuleIds.has(rule.id)) continue;
    if (!evaluateAntecedent(rule, state.activeConstraints)) continue;
    // ... apply rule
  }
}
```

**Why this is fine:**
- O(iterations × rules × conditions) = O(3 × 15 × 3) = ~135 operations max
- All synchronous, no async overhead
- Full control over filter vs boost semantics
- Clear provenance tracking via `derivationChain`

### If You Want Future-Proofing: Consider json-rules-engine

If you anticipate rules growing significantly or want rule management capabilities, you could adopt json-rules-engine with these modifications:

```typescript
// Example adaptation for json-rules-engine
import { Engine } from 'json-rules-engine';

const engine = new Engine();

// Your rule format translates naturally
engine.addRule({
  conditions: {
    all: [
      { fact: 'teamFocus', operator: 'equal', value: 'scaling' }
    ]
  },
  event: {
    type: 'derive-skill',
    params: {
      skillId: 'skill_distributed',
      effect: 'filter',
      rationale: 'Scaling projects require distributed systems'
    }
  },
  priority: 50,
  name: 'scaling-requires-distributed'
});
```

**But wait until you actually need it.** YAGNI applies here.

### Do NOT Use RETE

RETE is architecturally wrong for your use case:
- Single-shot request evaluation doesn't amortize setup cost
- 15 rules is 10x below the benefit threshold
- Memory overhead provides no value for stateless requests
- Adds significant complexity (network compilation, token propagation)

---

## Comparison Matrix

| Feature | Custom Loop | json-rules-engine | RETE (Drools) |
|---------|-------------|-------------------|---------------|
| Implementation effort | Medium | Low | High |
| Performance (15 rules) | <1ms | 25-50ms | ~100ms+ setup |
| Rule format | TypeScript | JSON | DRL/DSL |
| Forward chaining | Yes | Yes | Yes |
| Backward chaining | No | No | Yes |
| Rule sharing/network | No | No | Yes |
| Memory efficiency | High | High | Low |
| Async support | Optional | Built-in | Varies |
| Node.js native | Yes | Yes | Via JVM |
| Learning curve | None | Low | High |
| Provenance tracking | Custom | Events | Complex |
| Filter vs Boost distinction | Custom | Custom | Custom |
| **Fit for your use case** | **Excellent** | Good | Poor |

---

## Code References

- Implementation plan: `thoughts/shared/1_chapter_5/1.5_project_1.5/plans/2026-01-06-iterative-requirement-expansion.md`
- Industry evaluation: `thoughts/shared/1_chapter_5/1.5_project_1.5/research/2026-01-06-iterative-expansion-industry-evaluation.md`
- Current constraint expander: `recommender_api/src/services/constraint-expander.service.ts:60-367`
- Proposed inference engine: Plan Phase 3, lines 862-1163
- Current rule count: ~14 rules across `config/knowledge-base/*.config.ts`

## Sources

### RETE Algorithm
- [Forgy, C. (1982). Rete: A Fast Algorithm for the Many Pattern/Many Object Match Problem](https://www.semanticscholar.org/paper/Rete:-A-Fast-Algorithm-for-the-Many-Patterns-Many-Forgy/165d44b4c40fef0fbfed588428485a14701b7e84)
- [Oracle Rules Engine Documentation - RETE vs NRE](https://docs.oracle.com/middleware/1221/bpm/rules-reference/GUID-0C04037C-6D1F-4DA8-A6C0-91DEB9A92DF1.htm)
- [RETE Algorithm Demystified - Sparkling Logic](https://www.sparklinglogic.com/rete-algorithm-demystified-part-2/)
- [Temple University CIS587 - RETE Readings](https://cis.temple.edu/~ingargio/cis587/readings/rete.html)

### json-rules-engine
- [GitHub: CacheControl/json-rules-engine](https://github.com/CacheControl/json-rules-engine)
- [npm: json-rules-engine](https://www.npmjs.com/package/json-rules-engine)
- [Issue #53: RETE Discussion](https://github.com/CacheControl/json-rules-engine/issues/53)
- [Issue #58: Performance Discussion](https://github.com/CacheControl/json-rules-engine/issues/58)

### Alternatives Considered
- [nools](https://npmtrends.com/json-rules-engine-vs-node-rules-vs-nools) - RETE-based but unmaintained
- [node-rules](https://github.com/mithunsatheesh/node-rules) - Simpler alternative
- [Drools](https://drools.org/) - Full RETE implementation (Java)

## Open Questions

1. **What's the expected growth rate of inference rules?** If approaching 50+ in the next year, consider json-rules-engine from the start.
2. **Will rules need to be user-configurable?** If yes, json-rules-engine's JSON format enables this.
3. **Is there a hard performance budget?** If <10ms is required, stay with custom loop.
