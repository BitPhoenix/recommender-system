/**
 * Boost Rules Configuration
 * Soft preferences that RANK candidates higher (but don't exclude).
 *
 * Rule Type: 'derived-boost'
 * Naming Convention: X-prefers-Y
 *
 * These rules derive preferred skills/attributes. Candidates with these
 * skills score higher, but aren't excluded if lacking them.
 */

import type { InferenceRuleDefinition } from "../../../types/rule-engine.types.js";

// ============================================
// SENIORITY-BASED BOOSTS
// ============================================

/**
 * Senior+ engineers benefit from leadership skills.
 * Priority 35: Chain rule (fires after seniority may be derived)
 *
 * Fires from EITHER container (user required OR rule-derived preferred):
 * - requiredProperties.seniorityLevel = senior/staff/principal (user set requiredSeniorityLevel)
 * - preferredProperties.seniorityLevel = senior/staff/principal (rule set preferredSeniorityLevel)
 *
 * Example chains:
 * - User input: requiredSeniorityLevel:senior → leadership boost (single-element chain)
 * - Derived: greenfield → preferredSeniorityLevel:senior → leadership boost (multi-hop chain)
 */
const seniorPrefersLeadership: InferenceRuleDefinition = {
  name: "Senior+ Benefits from Leadership Skills",
  priority: 35,
  conditions: {
    any: [
      // Fire from user's required seniority (normalized key in requiredProperties)
      {
        fact: "derived",
        path: "$.requiredProperties.seniorityLevel",
        operator: "in",
        value: ["senior", "staff", "principal"],
      },
      // Fire from rule-derived preferred seniority (normalized key in preferredProperties)
      {
        fact: "derived",
        path: "$.preferredProperties.seniorityLevel",
        operator: "in",
        value: ["senior", "staff", "principal"],
      },
    ],
  },
  event: {
    type: "derived-boost",
    params: {
      ruleId: "senior-prefers-leadership",
      targetField: "derivedSkills",
      targetValue: [
        "skill_mentorship",
        "skill_code_review",
        "skill_tech_leadership",
      ],
      boostStrength: 0.6,
      rationale: "Senior engineers often benefit from leadership abilities",
    },
  },
};

/**
 * Principal engineers benefit from architecture skills.
 * Priority 50: First-hop rule
 */
const principalPrefersArchitecture: InferenceRuleDefinition = {
  name: "Principal Engineers Benefits From Architecture Skills",
  priority: 50,
  conditions: {
    all: [
      {
        fact: "request",
        path: "$.requiredSeniorityLevel",
        operator: "in",
        value: ["principal"],
      },
    ],
  },
  event: {
    type: "derived-boost",
    params: {
      ruleId: "principal-prefers-architecture",
      targetField: "derivedSkills",
      targetValue: ["skill_system_design", "skill_architecture"],
      boostStrength: 0.8,
      rationale:
        "Principal engineers typically need strong architecture skills",
    },
  },
};

// ============================================
// TEAM FOCUS-BASED BOOSTS
// ============================================

/**
 * Greenfield projects benefit from ambiguity tolerance.
 * Priority 50: First-hop rule
 */
const greenfieldPrefersAmbiguityTolerance: InferenceRuleDefinition = {
  name: "Greenfield Projects Prefer Ambiguity Tolerance",
  priority: 50,
  conditions: {
    all: [
      {
        fact: "request",
        path: "$.teamFocus",
        operator: "equal",
        value: "greenfield",
      },
    ],
  },
  event: {
    type: "derived-boost",
    params: {
      ruleId: "greenfield-prefers-ambiguity-tolerance",
      targetField: "derivedSkills",
      targetValue: ["skill_prototyping", "skill_requirements_analysis"],
      boostStrength: 0.5,
      rationale:
        "Greenfield projects benefit from engineers comfortable with ambiguity",
    },
  },
};

/**
 * Greenfield projects prefer senior engineers.
 * Priority 50: First-hop rule
 */
const greenfieldPrefersSenior: InferenceRuleDefinition = {
  name: "Greenfield Projects Prefer Senior Engineers",
  priority: 50,
  conditions: {
    all: [
      {
        fact: "request",
        path: "$.teamFocus",
        operator: "equal",
        value: "greenfield",
      },
    ],
  },
  event: {
    type: "derived-boost",
    params: {
      ruleId: "greenfield-prefers-senior",
      targetField: "preferredSeniorityLevel",
      targetValue: "senior",
      boostStrength: 0.4,
      rationale:
        "Greenfield projects often benefit from experienced engineers",
    },
  },
};

/**
 * Migration projects value documentation skills.
 * Priority 50: First-hop rule
 */
const migrationPrefersDocumentation: InferenceRuleDefinition = {
  name: "Migration Projects Value Documentation Skills",
  priority: 50,
  conditions: {
    all: [
      {
        fact: "request",
        path: "$.teamFocus",
        operator: "equal",
        value: "migration",
      },
    ],
  },
  event: {
    type: "derived-boost",
    params: {
      ruleId: "migration-prefers-documentation",
      targetField: "derivedSkills",
      targetValue: ["skill_documentation", "skill_legacy_systems"],
      boostStrength: 0.5,
      rationale:
        "Migration projects need strong documentation and legacy system understanding",
    },
  },
};

/**
 * Scaling work benefits from observability skills.
 * Priority 50: First-hop rule
 */
const scalingPrefersObservability: InferenceRuleDefinition = {
  name: "Scaling Benefits from Observability Skills",
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
    type: "derived-boost",
    params: {
      ruleId: "scaling-prefers-observability",
      targetField: "derivedSkills",
      targetValue: ["skill_observability", "skill_performance"],
      boostStrength: 0.6,
      rationale:
        "Scaling benefits from observability and performance expertise",
    },
  },
};

/**
 * Maintenance teams value debugging skills.
 * Priority 50: First-hop rule
 */
const maintenancePrefersDebugging: InferenceRuleDefinition = {
  name: "Maintenance Teams Value Debugging Skills",
  priority: 50,
  conditions: {
    all: [
      {
        fact: "request",
        path: "$.teamFocus",
        operator: "equal",
        value: "maintenance",
      },
    ],
  },
  event: {
    type: "derived-boost",
    params: {
      ruleId: "maintenance-prefers-debugging",
      targetField: "derivedSkills",
      targetValue: ["skill_debugging", "skill_troubleshooting"],
      boostStrength: 0.6,
      rationale:
        "Maintenance work requires strong debugging and troubleshooting skills",
    },
  },
};

// ============================================
// COMPOUND BOOSTS (Multiple Conditions)
// ============================================

/**
 * Senior engineers on greenfield projects benefit from ownership skills.
 * Priority 30: Compound rule
 */
const seniorGreenfieldPrefersOwnership: InferenceRuleDefinition = {
  name: "Senior Engineers on Greenfield Prefer Ownership",
  priority: 30,
  conditions: {
    all: [
      {
        fact: "request",
        path: "$.requiredSeniorityLevel",
        operator: "in",
        value: ["senior", "staff", "principal"],
      },
      {
        fact: "request",
        path: "$.teamFocus",
        operator: "equal",
        value: "greenfield",
      },
    ],
  },
  event: {
    type: "derived-boost",
    params: {
      ruleId: "senior-greenfield-prefers-ownership",
      targetField: "derivedSkills",
      targetValue: ["skill_ownership", "skill_decision_making"],
      boostStrength: 0.7,
      rationale:
        "Senior engineers on greenfield projects benefit from ownership and decision-making skills",
    },
  },
};

/**
 * Senior engineers on scaling projects benefit from architecture skills.
 * Priority 30: Compound rule
 */
const seniorScalingPrefersArchitecture: InferenceRuleDefinition = {
  name: "Senior Engineers Scaling Need Architecture",
  priority: 30,
  conditions: {
    all: [
      {
        fact: "request",
        path: "$.requiredSeniorityLevel",
        operator: "in",
        value: ["senior", "staff", "principal"],
      },
      {
        fact: "request",
        path: "$.teamFocus",
        operator: "equal",
        value: "scaling",
      },
    ],
  },
  event: {
    type: "derived-boost",
    params: {
      ruleId: "senior-scaling-prefers-architecture",
      targetField: "derivedSkills",
      targetValue: ["skill_system_design", "skill_capacity_planning"],
      boostStrength: 0.7,
      rationale:
        "Senior engineers working on scaling benefit from architecture and capacity planning",
    },
  },
};

// ============================================
// SKILL CHAIN BOOSTS
// ============================================

/**
 * Kubernetes work benefits from Helm and IaC skills.
 * Priority 40: Skill chain rule
 */
const kubernetesPrefersHelm: InferenceRuleDefinition = {
  name: "Kubernetes Benefits from Helm Skills",
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
    type: "derived-boost",
    params: {
      ruleId: "kubernetes-prefers-helm",
      targetField: "derivedSkills",
      targetValue: ["skill_helm", "skill_infrastructure_as_code"],
      boostStrength: 0.5,
      rationale: "Kubernetes work benefits from Helm and IaC experience",
    },
  },
};

/**
 * Microservices work benefits from API design skills.
 * Priority 40: Skill chain rule
 */
const microservicesPrefersApiDesign: InferenceRuleDefinition = {
  name: "Microservices Benefit from API Design Skills",
  priority: 40,
  conditions: {
    all: [
      {
        fact: "derived",
        path: "$.allSkills",
        operator: "contains",
        value: "skill_microservices",
      },
    ],
  },
  event: {
    type: "derived-boost",
    params: {
      ruleId: "microservices-prefers-api-design",
      targetField: "derivedSkills",
      targetValue: ["skill_api_design", "skill_rest", "skill_graphql"],
      boostStrength: 0.5,
      rationale:
        "Microservices architecture benefits from strong API design skills",
    },
  },
};

/**
 * Distributed systems work benefits from tracing and logging skills.
 * Priority 40: Skill chain rule
 */
const distributedPrefersTracing: InferenceRuleDefinition = {
  name: "Distributed Systems Benefit from Tracing",
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
    type: "derived-boost",
    params: {
      ruleId: "distributed-prefers-tracing",
      targetField: "derivedSkills",
      targetValue: ["skill_tracing", "skill_logging"],
      boostStrength: 0.5,
      rationale:
        "Distributed systems work benefits from tracing and logging expertise",
    },
  },
};

// ============================================
// EXPORTED BOOST RULES
// ============================================

export const boostRules: InferenceRuleDefinition[] = [
  // Seniority-based boosts
  seniorPrefersLeadership,
  principalPrefersArchitecture,

  // Team focus-based boosts
  greenfieldPrefersAmbiguityTolerance,
  greenfieldPrefersSenior,
  migrationPrefersDocumentation,
  scalingPrefersObservability,
  maintenancePrefersDebugging,

  // Compound boosts
  seniorGreenfieldPrefersOwnership,
  seniorScalingPrefersArchitecture,

  // Skill chain boosts
  kubernetesPrefersHelm,
  microservicesPrefersApiDesign,
  distributedPrefersTracing,
];
