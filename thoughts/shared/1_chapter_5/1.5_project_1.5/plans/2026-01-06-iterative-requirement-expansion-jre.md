# Iterative Requirement Expansion with json-rules-engine

## Summary

Implement Section 5.2.1's iterative requirement expansion using [json-rules-engine](https://www.npmjs.com/package/json-rules-engine) instead of a custom loop. This provides:
- **Future-proofing**: Rules are JSON-serializable (DB storage, dynamic loading possible later)
- **Dynamic rules**: Industry-standard pattern, well-documented
- **Rule count growth**: Built-in operators reduce custom code

## Key Design Decisions

1. **json-rules-engine + adapter layer**: The library handles rule evaluation; adapter converts to domain types
2. **Manual iteration loop**: json-rules-engine doesn't auto-iterate for chaining; we wrap it
3. **Event types encode filter/boost**: `derived-filter` vs `derived-boost` event types
4. **Provenance tracked externally**: Derivation chains maintained in adapter state

## Architecture

```
SearchFilterRequest
       │
       ▼
┌──────────────────┐
│  createFacts()   │  ← Convert request to almanac facts
└──────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│         Iteration Loop (max 10)          │
│  ┌────────────────────────────────────┐  │
│  │     json-rules-engine.run()       │  │
│  │  - Evaluates all rules             │  │
│  │  - Fires matching events           │  │
│  └────────────────────────────────────┘  │
│              │                            │
│              ▼                            │
│  ┌────────────────────────────────────┐  │
│  │    eventToConstraint()             │  │
│  │  - Convert events to domain types  │  │
│  │  - Check user overrides            │  │
│  └────────────────────────────────────┘  │
│              │                            │
│              ▼                            │
│  ┌────────────────────────────────────┐  │
│  │    mergeSkillsIntoFacts()          │  │
│  │  - Add derived skills for chaining │  │
│  └────────────────────────────────────┘  │
│              │                            │
│              ▼                            │
│       fixpoint? → break                   │
└──────────────────────────────────────────┘
       │
       ▼
InferenceResult { derivedConstraints, firedRules, ... }
```

---

## Phase 1: Types and Dependency

### Install json-rules-engine
```bash
cd recommender_api && npm install json-rules-engine
```

### New Files

**`recommender_api/src/types/inference-rule.types.ts`** - Domain types (engine-agnostic):
- `DerivedConstraint` - Result of rule firing with filter/boost effect
- `InferenceResult` - Full result with constraints, fired rules, iteration count

**`recommender_api/src/types/rule-engine.types.ts`** - json-rules-engine specific:
- `InferenceRuleDefinition` - Rule format extending RuleProperties
- `InferenceEvent` - Event structure with params for DerivedConstraint creation
- `InferenceFacts` - Almanac fact structure

### Modified Files

**`recommender_api/src/types/knowledge-base.types.ts`**:
- Add `inferenceRules: InferenceRuleDefinition[]` to KnowledgeBaseConfig

**`recommender_api/src/types/search.types.ts`**:
- Add `'inference'` to ConstraintSource type
- Add `derivedConstraints` to SearchFilterResponse

### Success Criteria
- [ ] `npm run typecheck` passes
- [ ] Types correctly model domain semantics

---

## Phase 2: Rule Definitions

### New File

**`recommender_api/src/config/knowledge-base/inference-rules.config.ts`**

~15 rules in json-rules-engine format:

```typescript
{
  name: 'Scaling Requires Distributed Systems',
  priority: 50,
  conditions: {
    all: [{ fact: 'teamFocus', operator: 'equal', value: 'scaling' }]
  },
  event: {
    type: 'derived-filter',  // Hard requirement
    params: {
      ruleId: 'scaling-requires-distributed',
      targetField: 'preferredSkills',
      targetValue: ['skill_distributed'],
      rationale: 'Scaling work requires distributed systems expertise'
    }
  }
}
```

Rule categories:
1. **Seniority-based** (boosts): senior-prefers-leadership, principal-prefers-architecture
2. **Team focus** (mix): greenfield-prefers-ambiguity, scaling-requires-distributed
3. **Compound** (boosts): senior-greenfield-prefers-ownership
4. **Skill chains** (mix): kubernetes-requires-containers, distributed-requires-observability

### Modified File

**`recommender_api/src/config/knowledge-base/index.ts`**:
- Export `inferenceRules` and `maxInferenceIterations`

### Success Criteria
- [ ] All rule IDs unique
- [ ] Rules compile without type errors
- [ ] Filter vs boost semantics encoded correctly

---

## Phase 3: Inference Engine

### New Files

**`recommender_api/src/services/rule-engine-adapter.ts`** (~150 lines):
- `createEngine(rules)` - Create and cache Engine instance
- `createFacts(request)` - Convert SearchFilterRequest to InferenceFacts
- `eventToConstraint(event, chain, userFields)` - Convert event to DerivedConstraint
- `mergeSkillsIntoFacts(facts, constraints)` - Add derived skills for chaining
- `computeFactsHash(facts)` - Fixpoint detection

**`recommender_api/src/services/inference-engine.service.ts`** (~150 lines):
- `runInference(request)` - Main entry point
  - Creates facts from request
  - Runs iteration loop (max 10)
  - Tracks fired rules across iterations
  - Detects fixpoint (no new facts)
  - Returns InferenceResult
- `getDerivedRequiredSkills(constraints)` - Extract filter rule skills
- `aggregateDerivedSkillBoosts(constraints)` - Aggregate boost strengths (max wins)

Key implementation notes:
- Cache Engine instance (rules don't change at runtime)
- Add computed `allSkills` fact for skill-to-skill chaining
- User override check: boosts blocked if user set target field; filters always fire

### Success Criteria
- [ ] Engine evaluates conditions correctly
- [ ] Iteration loop detects fixpoint
- [ ] User override logic works (boosts blocked, filters pass)
- [ ] Multi-hop chains work (scaling → distributed → monitoring)

---

## Phase 4: Integration

### Modified Files

**`recommender_api/src/services/constraint-expander.service.ts`**:
- Change `expandSearchCriteria` from sync to async (json-rules-engine uses Promises)
- Add call to `runInference(request)` after existing expansions
- Extract `derivedRequiredSkillIds` and `derivedSkillBoosts` from result
- Track inference constraints in `appliedFilters`/`appliedPreferences`
- Return new fields in `ExpandedSearchCriteria`

**`recommender_api/src/services/search.service.ts`**:
- Await `expandSearchCriteria` call
- Pass derived constraints to UtilityContext
- Include `derivedConstraints` in API response

**`recommender_api/src/services/utility-calculator/types.ts`**:
- Add `derivedRequiredSkillIds` and `derivedSkillBoosts` to UtilityContext

### Success Criteria
- [ ] Async change propagates correctly
- [ ] API response includes derivedConstraints
- [ ] Existing tests still pass

---

## Phase 5: Tests

### New Files

**`recommender_api/src/services/rule-engine-adapter.test.ts`**:
- Test `createFacts` extracts skills and tracks explicit fields
- Test `eventToConstraint` creates correct types
- Test user override detection
- Test `computeFactsHash` for fixpoint detection

**`recommender_api/src/services/inference-engine.service.test.ts`**:
- Test boost rules fire correctly
- Test filter rules fire correctly
- Test user override blocks boosts but not filters
- Test multi-hop chains (scaling → distributed → monitoring)
- Test fixpoint detection
- Test boost aggregation (max wins)

### Success Criteria
- [ ] `npm test` passes
- [ ] Coverage > 80% for new code
- [ ] Multi-hop chaining verified

---

## Phase 6: Documentation

### Modified Files

**`CLAUDE.md`**:
- Add "Inference Engine" section explaining json-rules-engine integration
- Document rule format and naming conventions
- Add testing instructions

### Success Criteria
- [ ] Documentation explains how to add rules
- [ ] Examples show filter vs boost patterns

---

## File Summary

### New Files (5)
```
recommender_api/src/types/inference-rule.types.ts
recommender_api/src/types/rule-engine.types.ts
recommender_api/src/config/knowledge-base/inference-rules.config.ts
recommender_api/src/services/rule-engine-adapter.ts
recommender_api/src/services/inference-engine.service.ts
```

### Test Files (2)
```
recommender_api/src/services/rule-engine-adapter.test.ts
recommender_api/src/services/inference-engine.service.test.ts
```

### Modified Files (7)
```
recommender_api/package.json                              # Add json-rules-engine
recommender_api/src/types/knowledge-base.types.ts         # Add inference config
recommender_api/src/types/search.types.ts                 # Add inference source
recommender_api/src/config/knowledge-base/index.ts        # Export rules
recommender_api/src/services/constraint-expander.service.ts  # Call inference
recommender_api/src/services/search.service.ts            # Pass constraints
recommender_api/src/services/utility-calculator/types.ts  # Add derived boosts
CLAUDE.md                                                 # Add docs
```

---

## Verification Commands

```bash
# After each phase
npm run typecheck
npm run lint

# After Phase 5
npm test

# Full verification
npm test && npm run test:e2e
```

---

## References

- Original plan: `thoughts/shared/1_chapter_5/1.5_project_1.5/plans/2026-01-06-iterative-requirement-expansion.md`
- RETE analysis: `thoughts/shared/1_chapter_5/1.5_project_1.5/research/2026-01-06-rete-vs-json-rules-engine-analysis.md`
- json-rules-engine: https://github.com/CacheControl/json-rules-engine
