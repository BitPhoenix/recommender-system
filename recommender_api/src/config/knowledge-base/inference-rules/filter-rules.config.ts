/**
 * Filter Rules Configuration
 * Hard constraints that EXCLUDE candidates from results.
 *
 * Rule Type: 'derived-filter'
 * Naming Convention: X-requires-Y
 *
 * These rules derive mandatory skill requirements. Candidates lacking
 * these skills will be filtered out entirely.
 */

import type { InferenceRuleDefinition } from "../../../types/rule-engine.types.js";

// ============================================
// FIRST-HOP FILTERS: User Fields → Required Skills
// ============================================

/**
 * Scaling team focus requires distributed systems expertise.
 * Priority 50: First-hop rule (user fields → skills)
 */
const scalingRequiresDistributed: InferenceRuleDefinition = {
  name: "Scaling Requires Distributed Systems",
  priority: 50,
  conditions: {
    all: [
      {
        fact: "request",
        path: "$.teamFocus",
        operator: "equal",
        value: "scaling",
      },
    ],
  },
  event: {
    type: "derived-filter",
    params: {
      ruleId: "scaling-requires-distributed",
      targetField: "derivedSkills",
      targetValue: ["skill_distributed"],
      rationale: "Scaling work requires distributed systems expertise",
    },
  },
};

// ============================================
// SKILL CHAIN FILTERS: Skills → Required Skills
// ============================================

/**
 * Kubernetes work requires container knowledge.
 * Priority 40: Skill chain rule (skills → skills)
 */
const kubernetesRequiresContainers: InferenceRuleDefinition = {
  name: "Kubernetes Requires Container Knowledge",
  priority: 40,
  conditions: {
    all: [
      {
        fact: "derived",
        path: "$.allSkills",
        operator: "contains",
        value: "skill_kubernetes",
      },
    ],
  },
  event: {
    type: "derived-filter",
    params: {
      ruleId: "kubernetes-requires-containers",
      targetField: "derivedSkills",
      targetValue: ["skill_docker"],
      rationale:
        "Cannot effectively work with Kubernetes without container knowledge",
    },
  },
};

/**
 * Distributed systems work requires monitoring skills.
 * Priority 40: Skill chain rule (skills → skills)
 */
const distributedRequiresObservability: InferenceRuleDefinition = {
  name: "Distributed Systems Require Observability",
  priority: 40,
  conditions: {
    all: [
      {
        fact: "derived",
        path: "$.allSkills",
        operator: "contains",
        value: "skill_distributed",
      },
    ],
  },
  event: {
    type: "derived-filter",
    params: {
      ruleId: "distributed-requires-observability",
      targetField: "derivedSkills",
      targetValue: ["skill_monitoring"],
      rationale:
        "Cannot effectively work on distributed systems without monitoring skills",
    },
  },
};

// ============================================
// EXPORTED FILTER RULES
// ============================================

export const filterRules: InferenceRuleDefinition[] = [
  // First-hop filters
  scalingRequiresDistributed,

  // Skill chain filters
  kubernetesRequiresContainers,
  distributedRequiresObservability,
];
