---
date: 2026-01-07T10:30:00-08:00
researcher: Claude
git_commit: bc75c7446425b86af35a1a5fb8dcaecaf7a6366a
branch: main
repository: recommender-system
topic: "User-Specified vs Derived Constraint Conflict Resolution"
tags: [research, inference-engine, constraint-conflicts, user-intent]
status: complete
last_updated: 2026-01-07
last_updated_by: Claude
---

# Research: User-Specified vs Derived Constraint Conflict Resolution

**Date**: 2026-01-07T10:30:00-08:00
**Researcher**: Claude
**Git Commit**: bc75c7446425b86af35a1a5fb8dcaecaf7a6366a
**Branch**: main
**Repository**: recommender-system

## Research Question

When the inference engine derives a filter constraint that conflicts with a user-specified constraint, which should take priority?

## Summary

**Recommendation: User-specified constraints should always win**, consistent with how boost rules already work. This research identifies the conflict scenarios, current handling gaps, and proposes a unified "user-intent-first" principle.

---

## The Conflict Scenarios

### Scenario 1: Same Skill, Different Treatment

| Source | Skill | Treatment |
|--------|-------|-----------|
| User | `skill_distributed` | `preferredSkills` (soft boost) |
| Derived | `skill_distributed` | `derived-filter` (hard requirement) |

**Question**: Does the derived filter rule promote the user's preference to a hard requirement?

**Current behavior**: Yes. Derived filter rules add skills to `derivedRequiredSkillIds`, which (once fully integrated) would become WHERE clause filters. The user's soft preference would be overruled.

**Proposed behavior**: No. If the user explicitly placed a skill in `preferredSkills` (soft), a derived filter rule should NOT promote it to a hard requirement. Mark the derived constraint as `overriddenByUser: true`.

### Scenario 2: Same Skill, Different Proficiency

| Source | Skill | Proficiency |
|--------|-------|-------------|
| User | `skill_distributed` | `minProficiency: 'expert'` |
| Derived | `skill_distributed` | No proficiency (implies 'learning'?) |

**Question**: What proficiency threshold applies?

**Current behavior**: User's proficiency wins (by accident - derived constraints don't carry proficiency metadata).

**Proposed behavior**: User's proficiency wins (by design). Document this as intentional.

### Scenario 3: User Omits Skill, Derived Filter Requires It

| Source | Skill | Treatment |
|--------|-------|-----------|
| User | (not specified) | - |
| Derived | `skill_distributed` | `derived-filter` |

**Question**: Should the derived filter apply as a hard requirement?

**Current behavior**: This is the intended use case for derived filters - adding requirements the user didn't explicitly state but are logically implied.

**Proposed behavior**: Same. This is NOT a conflict - it's the inference engine adding value.

### Scenario 4: User Explicitly Overrides Rule

| Source | Skill | Treatment |
|--------|-------|-----------|
| User | `overriddenRuleIds: ['scaling-requires-distributed']` | Explicit rejection |
| Derived | `skill_distributed` via `scaling-requires-distributed` | `derived-filter` |

**Current behavior**: Rule is marked `overriddenByUser: true`, skill not added to `allSkills` (breaks chaining). Works correctly.

**Proposed behavior**: Same.

---

## The Unified Principle: User Intent First

The design principle should be consistent across filter and boost rules:

| Rule Type | User Action | Effect |
|-----------|------------|--------|
| **Boost** | Sets `preferred*` field | Implicit override (existing) |
| **Boost** | Adds `overriddenRuleIds` | Explicit override (existing) |
| **Filter** | Explicitly handles skill in `requiredSkills` or `preferredSkills` | **Implicit override (NEW)** |
| **Filter** | Adds `overriddenRuleIds` | Explicit override (existing) |

### Why This Makes Sense

1. **User knows their context**: If they deliberately placed a skill as "preferred" (soft), they have a reason - maybe the role can succeed without it but it's nice to have.

2. **Consistency with boost handling**: Boost rules already respect user intent via implicit override. Filter rules should follow the same pattern.

3. **Principle of least surprise**: Users expect their explicit choices to take priority over automated inference.

4. **Transparency**: The API response already includes `overriddenByUser` flag, so the UI can show "You chose to keep X as optional, overriding the system's recommendation to require it."

---

## Proposed Implementation

### Change 1: Extend Implicit Override Detection

Current code in `rule-engine-adapter.ts:135-141`:

```typescript
const explicitlyOverridden = overriddenRuleIds.includes(params.ruleId);
const implicitlyOverridden =
  effect === 'boost' && userExplicitFields.includes(params.targetField);
const overriddenByUser = explicitlyOverridden || implicitlyOverridden;
```

Proposed change:

```typescript
const explicitlyOverridden = overriddenRuleIds.includes(params.ruleId);

// Implicit override for BOOST rules: user set the target preferred* field
const implicitBoostOverride =
  effect === 'boost' && userExplicitFields.includes(params.targetField);

// Implicit override for FILTER rules: user already handles the skill explicitly
// (either as required or preferred - user's treatment takes priority)
const implicitFilterOverride =
  effect === 'filter' &&
  params.targetField === 'derivedSkills' &&
  userExplicitlyHandlesSkill(params.targetValue, request);

const overriddenByUser = explicitlyOverridden || implicitBoostOverride || implicitFilterOverride;
```

Where `userExplicitlyHandlesSkill()` checks if any skill in `targetValue` appears in:
- `request.requiredSkills[].skill` (user already requires it)
- `request.preferredSkills[].skill` (user deliberately made it soft)

### Change 2: Update Context Creation

Extend `createInferenceContext()` to track which skills the user explicitly mentioned:

```typescript
meta: {
  userExplicitFields: extractUserExplicitFields(request),
  overriddenRuleIds: request.overriddenRuleIds || [],
  userExplicitSkills: extractUserExplicitSkills(request), // NEW
}
```

Where `extractUserExplicitSkills()` returns:
```typescript
[
  ...request.requiredSkills?.map(s => s.skill) || [],
  ...request.preferredSkills?.map(s => s.skill) || [],
]
```

### Change 3: Per-Skill Override Granularity

Since a derived filter rule might add multiple skills (e.g., `['skill_monitoring', 'skill_tracing']`), and the user might only handle one of them, we need per-skill handling:

```typescript
// Instead of marking whole constraint as overridden,
// filter out user-handled skills from targetValue
const userHandledSkills = new Set(context.meta.userExplicitSkills);
const nonOverriddenSkills = params.targetValue.filter(
  skill => !userHandledSkills.has(skill)
);

if (nonOverriddenSkills.length === 0) {
  // All skills user-handled, mark whole constraint overridden
  return { ...constraint, overriddenByUser: true };
} else if (nonOverriddenSkills.length < params.targetValue.length) {
  // Partial override - reduce targetValue to non-overridden skills
  return {
    ...constraint,
    action: { ...constraint.action, targetValue: nonOverriddenSkills },
    provenance: {
      ...constraint.provenance,
      partiallyOverridden: true, // NEW field
      overriddenSkills: params.targetValue.filter(s => userHandledSkills.has(s)),
    }
  };
}
```

---

## Edge Cases

### Edge Case 1: User Requires Skill at Lower Proficiency Than Rule Implies

If we ever add proficiency to derived filter rules:

| Source | Skill | Proficiency |
|--------|-------|-------------|
| User | `skill_distributed` | `'learning'` |
| Derived | `skill_distributed` | `'expert'` |

**Recommendation**: User's proficiency wins. The user explicitly said "learning is fine" - respect that. Log/track the discrepancy for observability.

### Edge Case 2: Skill in Both Required AND Preferred

If user puts same skill in both (unusual but valid):

```typescript
requiredSkills: [{ skill: 'skill_distributed', minProficiency: 'proficient' }],
preferredSkills: [{ skill: 'skill_distributed', preferredMinProficiency: 'expert' }]
```

**Handling**: This is valid (required at proficient, prefer expert). Derived filter for same skill should be marked overridden since user explicitly handles it in `requiredSkills`.

### Edge Case 3: Downstream Chain Rules

If user overrides (implicitly or explicitly) a filter rule, downstream rules that depend on it should NOT fire. This already works correctly via the `mergeDerivedSkillsIntoInferenceContext()` function which skips overridden constraints.

---

## Implementation Priority

| Priority | Change | Complexity | Value |
|----------|--------|------------|-------|
| 1 | Add `userExplicitSkills` to meta context | Low | Enables all other changes |
| 2 | Extend implicit override for filter rules | Medium | Core behavior change |
| 3 | Per-skill override granularity | Medium | Handles multi-skill rules correctly |
| 4 | Add proficiency to derived constraints | Low | Future-proofing (not urgent) |

---

## Test Cases to Add

```typescript
describe('implicit filter override', () => {
  it('marks derived filter as overridden when user already requires the skill', async () => {
    const request = {
      teamFocus: 'scaling',
      requiredSkills: [{ skill: 'skill_distributed', minProficiency: 'expert' }]
    };
    const result = await runInference(request);
    const scalingRule = result.derivedConstraints.find(
      c => c.rule.id === 'scaling-requires-distributed'
    );
    expect(scalingRule?.overriddenByUser).toBe(true);
  });

  it('marks derived filter as overridden when user has skill as preferred', async () => {
    const request = {
      teamFocus: 'scaling',
      preferredSkills: [{ skill: 'skill_distributed' }]
    };
    const result = await runInference(request);
    const scalingRule = result.derivedConstraints.find(
      c => c.rule.id === 'scaling-requires-distributed'
    );
    expect(scalingRule?.overriddenByUser).toBe(true);
  });

  it('still fires downstream rules when skill is user-handled but not overridden rule', async () => {
    // User handles distributed, but observability rule should still check allSkills
    // (if user also has distributed, it's in allSkills, so observability fires)
    const request = {
      teamFocus: 'scaling',
      requiredSkills: [{ skill: 'skill_distributed' }]
    };
    const result = await runInference(request);

    // scaling-requires-distributed: overridden (user already has it)
    // BUT skill_distributed IS in allSkills (from user), so...
    // distributed-requires-observability SHOULD fire
    const obsRule = result.derivedConstraints.find(
      c => c.rule.id === 'distributed-requires-observability'
    );
    expect(obsRule).toBeDefined();
    expect(obsRule?.overriddenByUser).toBe(false);
  });
});
```

---

## Architecture Insight: Why This Matters

The inference engine exists to **help users who don't know all the implications** of their requirements. But when users DO know what they want, the system should defer to their judgment.

This creates two user personas:
1. **Novice user**: "I need scaling expertise" → System infers distributed systems, monitoring, etc.
2. **Expert user**: "I need scaling, and I specifically want distributed systems as optional" → System respects the explicit choice.

The `overriddenByUser` mechanism supports both personas through the same code path.

---

---

## How This Relates to Explicit Rule Overrides

The explicit `overriddenRuleIds` mechanism (already implemented per `2026-01-07-explicit-rule-override-mechanism.md`) provides **fine-grained control** for power users. The implicit filter override proposed here provides **automatic respect for user intent** without requiring rule knowledge.

### The Two Mechanisms Are Complementary

| Mechanism | Trigger | User Knowledge Required | Use Case |
|-----------|---------|------------------------|----------|
| **Explicit** (`overriddenRuleIds`) | User adds rule ID to list | High (must know rule ID) | "I disagree with this specific rule" |
| **Implicit boost** (existing) | User sets `preferred*` field | None | "I already set my preferences" |
| **Implicit filter** (proposed) | User handles skill in request | None | "I already specified how I want this skill treated" |

### Interaction Scenarios

**Scenario A: User uses ONLY implicit override**
```typescript
{
  teamFocus: 'scaling',
  preferredSkills: [{ skill: 'skill_distributed' }]  // User: "nice to have"
}
```
- `scaling-requires-distributed` fires (wants: hard requirement)
- **Implicit filter override**: Marked `overriddenByUser: true` because user explicitly put skill in preferredSkills
- User never needs to know the rule ID

**Scenario B: User uses ONLY explicit override**
```typescript
{
  teamFocus: 'scaling',
  overriddenRuleIds: ['scaling-requires-distributed']  // User: "I know this rule, skip it"
}
```
- `scaling-requires-distributed` fires
- **Explicit override**: Marked `overriddenByUser: true` because rule ID is in overriddenRuleIds
- User must know the rule ID (from previous response or docs)

**Scenario C: User uses BOTH (redundant but valid)**
```typescript
{
  teamFocus: 'scaling',
  preferredSkills: [{ skill: 'skill_distributed' }],
  overriddenRuleIds: ['scaling-requires-distributed']
}
```
- Rule is overridden by EITHER mechanism (both trigger)
- Harmless redundancy - code uses `||` so either path works

**Scenario D: User REQUIRES skill that rule would derive**
```typescript
{
  teamFocus: 'scaling',
  requiredSkills: [{ skill: 'skill_distributed', minProficiency: 'expert' }]
}
```
- `scaling-requires-distributed` fires (wants: `skill_distributed` as filter)
- User already requires it with specific proficiency

**Question**: Is this a conflict or agreement?

**Answer**: It's **agreement with user's version winning**. Two options:

1. **Mark as overridden**: User's explicit requirement takes priority, derived version is redundant
2. **Allow both**: User's version goes to `requiredSkillIds`, derived goes to `derivedRequiredSkillIds`, they dedupe in Cypher

Option 1 is cleaner - it prevents the same skill appearing in both lists and makes the provenance clear: "You required this skill, so we didn't need to derive it."

### Why BOTH Mechanisms Matter

| User Type | Typical Behavior | Mechanism Used |
|-----------|-----------------|----------------|
| **Novice** | Sets skills, sees results, adjusts | Implicit (automatic) |
| **Power user** | Knows rules, explicitly overrides | Explicit (`overriddenRuleIds`) |
| **Iterative user** | Sees derived constraint, dismisses it | Explicit (via UI button) |

The UI flow for iterative users:
1. User searches with `teamFocus: 'scaling'`
2. Response shows `derivedConstraints` including `scaling-requires-distributed`
3. User clicks "Dismiss this rule" on UI
4. UI re-runs search with `overriddenRuleIds: ['scaling-requires-distributed']`
5. Results no longer filtered by that rule

The implicit mechanism handles the case where user already expressed intent through their skill choices - no UI interaction needed.

---

## Implementation Order

Given the explicit mechanism is already implemented, the implicit filter override can build on top:

1. **Already done**: `overriddenRuleIds` explicit override (Phase 1-4 of explicit plan)
2. **Proposed**: Add `userExplicitSkills` to context meta
3. **Proposed**: Extend override logic to check implicit filter conditions
4. **Proposed**: Add tests for implicit filter override

The code change is minimal since `overriddenByUser` handling already works downstream.

## Related Research

- `thoughts/shared/1_chapter_5/1.5_project_1.5/research/2026-01-06-inference-engine-code-walkthrough.md` - Full system walkthrough
- `thoughts/shared/1_chapter_5/1.5_project_1.5/plans/2026-01-07-explicit-rule-override-mechanism.md` - Explicit override design (implemented)

## Open Questions

1. **UI implications**: How should the UI communicate "You overrode the system's recommendation to require X"?
2. **Analytics**: Should we track override frequency to identify rules that users commonly disagree with?
3. **Rule refinement**: If a rule is frequently overridden, should it be demoted from filter to boost?
