/**
 * Inference Engine Service
 * Implements Section 5.2.1 - Iterative Requirement Expansion
 *
 * This service runs forward-chaining inference until fixpoint:
 * 1. Convert request to context
 * 2. Run rules engine
 * 3. Convert events to derived constraints
 * 4. Merge derived skills into context
 * 5. Repeat until no new constraints
 */

import type { SearchFilterRequest } from '../schemas/search.schema.js';
import {
  isEffectiveSkillFilter,
  isEffectiveSkillBoost,
  type DerivedConstraint,
  type InferenceResult,
  type OverriddenRuleInfo,
} from '../types/inference-rule.types.js';
import type { InferenceEventParams } from '../types/rule-engine.types.js';
import { knowledgeBaseConfig } from '../config/knowledge-base/index.js';
import {
  createEngine,
  createInferenceContext,
  eventToDerivedConstraint,
  mergeDerivedValuesIntoContext,
  computeContextHash,
} from './rule-engine-adapter.js';

/**
 * Main inference function - runs forward chaining until fixpoint.
 */
export async function runInference(
  request: SearchFilterRequest
): Promise<InferenceResult> {
  const config = knowledgeBaseConfig;
  const engine = createEngine(config.inferenceRules);
  const maxIterations = config.maxInferenceIterations;

  let context = createInferenceContext(request);
  const allDerivedConstraints: DerivedConstraint[] = [];
  const firedRuleIds = new Set<string>();
  const mergedConstraintIds = new Set<string>();
  const overriddenRules: OverriddenRuleInfo[] = [];
  const warnings: string[] = [];

  let iteration = 0;
  let previousHash = '';

  while (iteration < maxIterations) {
    iteration++;
    const currentHash = computeContextHash(context);

    // Fixpoint detection
    if (currentHash === previousHash) break;
    previousHash = currentHash;

    // Run engine (json-rules-engine calls the context "facts" internally)
    const { events } = await engine.run(context);

    // Process events
    for (const event of events) {
      const ruleId = (event.params as InferenceEventParams).ruleId;

      if (firedRuleIds.has(ruleId)) continue;

      const constraint = eventToDerivedConstraint(
        event,
        context.meta.userExplicitFields,
        config.inferenceRules,
        context.meta.overriddenRuleIds,
        context.meta.userExplicitSkills,
        context.derived.skillProvenance,
        context.derived.requiredPropertyProvenance,
        context.derived.preferredPropertyProvenance
      );

      firedRuleIds.add(ruleId);

      // Track any override (FULL or PARTIAL) for transparency
      if (constraint.override) {
        overriddenRules.push({
          ruleId: constraint.rule.id,
          overrideScope: constraint.override.overrideScope,
          overriddenSkills: constraint.override.overriddenSkills,
          reasonType: constraint.override.reasonType,
        });
      }

      allDerivedConstraints.push(constraint);
    }

    // Merge derived values (skills and properties) for chaining
    context = mergeDerivedValuesIntoContext(context, allDerivedConstraints, mergedConstraintIds);
  }

  if (iteration >= maxIterations) {
    warnings.push(`Reached maximum inference iterations (${maxIterations}).`);
  }

  // Extract convenience fields from constraints
  const derivedRequiredSkillIds = getDerivedRequiredSkills(allDerivedConstraints);
  const derivedSkillBoosts = aggregateDerivedSkillBoosts(allDerivedConstraints);

  return {
    derivedConstraints: allDerivedConstraints,
    firedRules: [...firedRuleIds],
    overriddenRules,
    iterationCount: iteration,
    warnings,
    derivedRequiredSkillIds,
    derivedSkillBoosts,
  };
}

/**
 * Extract skills that must be required (from filter rules targeting derivedSkills).
 * Filter rules with effect='filter' add hard requirements.
 */
export function getDerivedRequiredSkills(
  constraints: DerivedConstraint[]
): string[] {
  const skills: string[] = [];

  for (const c of constraints) {
    if (!isEffectiveSkillFilter(c)) continue;

    const values = Array.isArray(c.action.targetValue)
      ? c.action.targetValue
      : [c.action.targetValue];
    skills.push(...values.filter((v): v is string => typeof v === 'string'));
  }

  return [...new Set(skills)];
}

/**
 * Aggregate derived skill boosts (max strength wins).
 * Boost rules with effect='boost' add preferred skills for ranking.
 */
export function aggregateDerivedSkillBoosts(
  constraints: DerivedConstraint[]
): Map<string, number> {
  const boosts = new Map<string, number>();

  for (const c of constraints) {
    if (!isEffectiveSkillBoost(c)) continue;
    if (c.action.boostStrength === undefined) continue;

    const skills = Array.isArray(c.action.targetValue)
      ? c.action.targetValue
      : [c.action.targetValue];
    for (const skill of skills) {
      if (typeof skill !== 'string') continue;
      const current = boosts.get(skill) || 0;
      boosts.set(skill, Math.max(current, c.action.boostStrength));
    }
  }

  return boosts;
}
