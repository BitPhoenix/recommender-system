# Project 1.5: Iterative Requirement Expansion (Inference Engine)

**Status**: Complete
**Duration**: December 31, 2025 - January 8, 2026
**Branch**: `main`
**Git Commit**: bc75c7446425b86af35a1a5fb8dcaecaf7a6366a

---

## Executive Summary

Project 1.5 implements **iterative requirement expansion** (Section 5.2.1 of the textbook) using a rules-based inference engine. When a hiring manager searches for an engineer, they often specify high-level needs like "scaling focus" or "senior level." The inference engine **automatically expands these requirements** by deriving implied skills and preferences.

For example:
- **Scaling** → Requires distributed systems expertise
- **Distributed systems** → Requires monitoring/observability skills
- **Senior level** → Benefits from leadership capabilities

The project progressed through three phases:
1. **Research & Design** (Dec 31 - Jan 5): Technology evaluation, architecture design
2. **Core Implementation** (Jan 6): json-rules-engine integration, forward chaining loop
3. **Refinement** (Jan 7 - Jan 8): Override mechanisms, derivation chain provenance, encapsulation

---

## Core Capabilities

### 1. Forward-Chaining Inference

The engine runs rules iteratively until a fixpoint (no new values derived):

```
SearchFilterRequest
       │
       ▼
  Iteration Loop (max 10)
       │
       ├─► Run all rules against context
       ├─► Collect fired events → DerivedConstraints
       ├─► Merge derived values into context
       └─► Fixpoint? → Break
       │
       ▼
  InferenceResult
```

### 2. Filter vs Boost Rules

| Type | Event Type | File | Effect |
|------|------------|------|--------|
| **Filter** | `derived-filter` | `filter-rules.config.ts` | Hard requirement (excludes candidates) |
| **Boost** | `derived-boost` | `boost-rules.config.ts` | Soft preference (affects ranking) |

**Naming Convention**:
- `X-requires-Y` = filter (hard) → `filter-rules.config.ts`
- `X-prefers-Y` = boost (soft) → `boost-rules.config.ts`

### 3. Multi-Hop Chaining

Rules can chain from derived values:

```
teamFocus=scaling
       │
       ▼ (scaling-requires-distributed)
skill_distributed added to allSkills
       │
       ▼ (distributed-requires-observability)
skill_monitoring added to allSkills
```

Chaining works for:
- **Skills**: Rules check `derived.allSkills` with `contains` operator
- **Properties**: Rules check `derived.requiredProperties` or `derived.preferredProperties`

### 4. Three Override Mechanisms

| Override Type | Mechanism | Scope | Reason Type |
|---------------|-----------|-------|-------------|
| **Explicit** | `overriddenRuleIds` in request | `FULL` | `explicit-rule-override` |
| **Implicit Field** | User sets target field | `FULL` | `implicit-field-override` |
| **Implicit Skill** | User handles target skill(s) | `FULL` or `PARTIAL` | `implicit-skill-override` |

### 5. Derivation Chain Provenance

Every constraint tracks all its causal paths (2D arrays):

```typescript
// First-hop rule (triggered by user input)
derivationChains: [['scaling-requires-distributed']]

// Chain rule (triggered by derived value)
derivationChains: [['scaling-requires-distributed', 'distributed-requires-observability']]

// Multi-trigger rule (multiple causal paths)
derivationChains: [['path-a', 'current-rule'], ['path-b', 'current-rule']]
```

---

## Development Timeline

### Phase 1: Research & Design (December 31, 2025 - January 5, 2026)

**Research Documents:**

1. **Requirement Expansion Analysis** (`2025-12-31-requirement-expansion-analysis.md`)
   - Analyzed Section 5.2.1 of textbook
   - Identified iterative expansion pattern
   - Mapped real estate analogy to engineer matching

2. **RETE vs json-rules-engine Analysis** (`2026-01-06-rete-vs-json-rules-engine-analysis.md`)
   - Evaluated RETE algorithm implementations
   - Chose json-rules-engine for JSON-serializability and simplicity
   - Documented trade-offs

3. **Industry Evaluation** (`2026-01-06-iterative-expansion-industry-evaluation.md`)
   - Compared with industry recommender systems
   - Validated approach against LinkedIn, Indeed patterns

**Initial Plans:**

4. **Iterative Requirement Expansion** (`2025-12-31-iterative-requirement-expansion.md`)
   - Initial design with custom loop
   - Later superseded by json-rules-engine approach

### Phase 2: Core Implementation (January 6, 2026)

**Plans Implemented:**

5. **json-rules-engine Integration** (`2026-01-06-iterative-requirement-expansion-jre.md`)
   - Installed json-rules-engine dependency
   - Created type definitions (`inference-rule.types.ts`, `rule-engine.types.ts`)
   - Implemented `InferenceContext` with request/derived/meta structure
   - Built forward-chaining loop with fixpoint detection

6. **Unified Plan** (`2026-01-06-iterative-requirement-expansion-unified.md`)
   - Consolidated approach after json-rules-engine decision
   - Defined ~15 initial rules (filters + boosts)
   - Established adapter pattern for library abstraction

### Phase 3: Refinement (January 7-8, 2026)

**Plans Implemented:**

7. **Explicit Rule Override Mechanism** (`2026-01-07-explicit-rule-override-mechanism.md`)
   - Added `overriddenRuleIds` to `SearchFilterRequest`
   - Enabled users to explicitly override any rule (filter or boost)
   - Overridden filter rules break downstream chains

8. **Implicit Filter Override** (`2026-01-07-implicit-filter-override.md`)
   - Added `userExplicitSkills` tracking
   - Filter rules targeting user-handled skills are implicitly overridden
   - Supports partial overrides (multi-skill rules)
   - Chain continues when user has skill as `requiredSkills`

9. **Derivation Chain Provenance** (`2026-01-07-derivation-chain-provenance.md`)
   - Added three provenance maps (skills, required properties, preferred properties)
   - First-hop rules: single-element chain
   - Chain rules: full causal path preserved
   - Enabled chaining from non-skill derived values

10. **Multi-Trigger Derivation Chains** (`2026-01-08-multi-trigger-derivation-chains.md`)
    - Renamed `derivationChain: string[]` → `derivationChains: string[][]`
    - Captures all causal paths when rule has multiple triggers
    - Added `deduplicateChains()` helper

11. **Override Reason Type** (`2026-01-08-override-reason-type.md`)
    - Added `OverrideReasonType` to distinguish override mechanisms
    - Three values: `explicit-rule-override`, `implicit-field-override`, `implicit-skill-override`
    - Exposed in both `DerivedConstraint.override` and `InferenceResult.overriddenRules`

12. **Inference Result Encapsulation** (`2026-01-08-inference-result-encapsulation.md`)
    - Moved `derivedRequiredSkillIds` and `derivedSkillBoosts` into `InferenceResult`
    - `runInference()` now returns complete, self-contained result
    - Simplified consumer code in `constraint-expander.service.ts`

---

## Architecture

### File Structure

```
recommender_api/src/
├── config/knowledge-base/
│   ├── inference-rules/
│   │   ├── index.ts                    # Combines and exports all rules
│   │   ├── filter-rules.config.ts      # Hard constraints (X-requires-Y)
│   │   └── boost-rules.config.ts       # Soft preferences (X-prefers-Y)
│   └── index.ts                        # Knowledge base config
├── services/
│   ├── inference-engine.service.ts     # Main forward-chaining loop
│   ├── rule-engine-adapter.ts          # json-rules-engine abstraction
│   ├── constraint-expander.service.ts  # Integration point (calls runInference)
│   └── search.service.ts               # Passes derived constraints to utility
├── types/
│   ├── inference-rule.types.ts         # Domain types (DerivedConstraint, InferenceResult)
│   ├── rule-engine.types.ts            # json-rules-engine bridge types
│   └── search.types.ts                 # API types (includes derivedConstraints)
└── schemas/
    └── search.schema.ts                # Zod schema (includes overriddenRuleIds)
```

### Data Flow

```
SearchFilterRequest
       │
       ▼
createInferenceContext()
  ├─► request: { ...original, skills: flattened }
  ├─► derived: { allSkills, requiredProperties, preferredProperties, provenance maps }
  └─► meta: { userExplicitFields, overriddenRuleIds, userExplicitSkills }
       │
       ▼
┌──────────────────────────────────────────┐
│         Forward Chaining Loop            │
│                                          │
│  while (iteration < max && !fixpoint):   │
│    1. Run json-rules-engine              │
│    2. For each fired event:              │
│       - Check overrides                  │
│       - Build derivation chains          │
│       - Create DerivedConstraint         │
│    3. Merge derived values into context  │
│    4. Check fixpoint (hash comparison)   │
└──────────────────────────────────────────┘
       │
       ▼
InferenceResult
  ├─► derivedConstraints: DerivedConstraint[]
  ├─► derivedRequiredSkillIds: string[]
  ├─► derivedSkillBoosts: Map<string, number>
  ├─► firedRules: string[]
  ├─► overriddenRules: OverriddenRuleInfo[]
  └─► iterationCount, warnings
```

---

## Key Design Decisions

### 1. json-rules-engine over Custom Loop

**Decision**: Use json-rules-engine library instead of hand-rolled iteration.

**Rationale**:
- Rules are JSON-serializable (future: DB storage, dynamic loading)
- Well-documented, industry-standard pattern
- Built-in operators reduce custom code
- Adapter pattern insulates domain from library specifics

### 2. Dual Property Containers

**Decision**: Separate `requiredProperties` and `preferredProperties` with normalized keys.

**Rationale**:
- Required and preferred have different semantics (hard filter vs soft ranking)
- Rule authors explicitly choose what triggers their rule
- Filter chain rules check `requiredProperties` (hard from hard)
- Boost chain rules use `any` to check both (soft from any source)

### 3. 2D Derivation Chains

**Decision**: `derivationChains: string[][]` instead of `derivationChain: string[]`.

**Rationale**:
- Multi-trigger rules can have multiple causal paths
- All paths preserved for complete debugging/transparency
- Example: Rule triggered by both skill AND seniority from different rules

### 4. Override Reason Types

**Decision**: Include `reasonType` in override info to distinguish mechanisms.

**Rationale**:
- UI can show "You overrided: X" vs "System detected: X"
- API consumers can differentiate explicit vs implicit overrides
- No ambiguity about why a rule was overridden

### 5. Inference Result Encapsulation

**Decision**: `runInference()` returns complete result with extracted fields.

**Rationale**:
- Single point of truth for inference outputs
- Consumers don't need to know about extraction functions
- Cleaner API, reduced coupling

---

## Current State

### What Works

- Forward-chaining inference with fixpoint detection
- ~15 rules (3 filters, 12 boosts)
- Filter rules (hard requirements) and boost rules (soft preferences)
- Multi-hop skill chains (scaling → distributed → monitoring)
- Property chains (greenfield → senior → leadership)
- Three override mechanisms with reason types
- 2D derivation chain provenance
- Self-contained `InferenceResult`

### Inference Rules Summary

**Filter Rules** (filter-rules.config.ts):
- `scaling-requires-distributed` - Scaling teamFocus requires distributed systems
- `kubernetes-requires-containers` - Kubernetes skill requires container knowledge
- `distributed-requires-observability` - Distributed systems require monitoring

**Boost Rules** (boost-rules.config.ts):
- `senior-prefers-leadership` - Senior seniority boosts leadership skills
- `greenfield-prefers-senior` - Greenfield projects prefer senior engineers
- `greenfield-prefers-ambiguity` - Greenfield prefers ambiguity tolerance
- Plus ~9 more preference rules

### API Request/Response

**Request** (new fields):
```typescript
{
  // ... existing fields ...
  overriddenRuleIds?: string[];  // Explicit rule overrides
}
```

**Response** (new fields):
```typescript
{
  // ... existing fields ...
  derivedConstraints: Array<{
    rule: { id: string; name: string };
    action: { effect: 'filter'|'boost'; targetField: string; targetValue: string|string[]; boostStrength?: number };
    provenance: { derivationChains: string[][]; explanation: string };
    override?: { overrideScope: 'FULL'|'PARTIAL'; overriddenSkills: string[]; reasonType: OverrideReasonType };
  }>;
  overriddenRuleIds: string[];  // Echo back
}
```

### Test Coverage

- Unit tests: `inference-engine.service.test.ts`, `rule-engine-adapter.test.ts`
- Integration tests: `constraint-expander.service.test.ts`
- E2E tests: Updated Postman collection with inference assertions
- Run with: `npm test && npm run test:e2e`

---

## Metrics

| Metric | Value |
|--------|-------|
| Total implementation plans | 8 |
| Research documents | 4 |
| Development duration | 9 days |
| Lines of code (new files) | ~1,500 |
| Inference rules | ~15 (3 filter + 12 boost) |
| Override mechanisms | 3 |
| Provenance map types | 3 (skills, required props, preferred props) |

---

## Lessons Learned

1. **Library abstraction pays off** - The adapter layer insulates domain code from json-rules-engine specifics, making future changes easier.

2. **Provenance is essential for debugging** - Tracking derivation chains from day one made debugging multi-hop scenarios much easier.

3. **Override granularity matters** - Distinguishing explicit vs implicit overrides, and FULL vs PARTIAL, provides crucial transparency.

4. **2D > 1D for multi-trigger** - Single-chain provenance loses information when rules have multiple triggers; 2D captures all paths.

5. **Encapsulate extraction early** - Moving extraction into `runInference()` simplified consumer code and reduced coupling.

6. **Normalized keys simplify chaining** - Using `seniorityLevel` instead of `requiredSeniorityLevel` makes chain rules cleaner.

---

## Future Considerations

These were not implemented but may be valuable:

1. **Dynamic rule loading** - Load rules from database instead of config files
2. **Rule priority visualization** - UI showing which rules fire in what order
3. **Conflict detection** - Warn when rules produce contradictory constraints
4. **Rule versioning** - Track rule changes over time for audit/rollback
5. **Confidence scoring** - Weight derived constraints by inference chain length
6. **Explanation generation** - Natural language explanations of derivation paths

---

## Documentation

- **Code Walkthrough**: `research/2026-01-06-inference-engine-code-walkthrough.md` - Comprehensive guide to reading the inference engine code
- **CLAUDE.md**: Updated with inference rules section, fact paths, rule types, and testing instructions
