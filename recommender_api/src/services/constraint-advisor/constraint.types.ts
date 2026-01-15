import type { CypherFragment } from "../../utils/cypher-fragment.builder.js";
import type { ConstraintSource, ProficiencyLevel } from "../../types/search.types.js";

/**
 * Enum for constraint types - determines how the constraint is evaluated.
 */
export enum ConstraintType {
  /** Simple property constraint that maps to a WHERE clause */
  Property = "property",
  /** Skill traversal constraint requiring graph pattern matching */
  SkillTraversal = "skill-traversal",
}

/**
 * Property field categories for type discrimination.
 */
export enum PropertyFieldType {
  /** Numeric fields: salary, yearsExperience */
  Numeric = "numeric",
  /** String fields: timezone (with STARTS WITH) */
  String = "string",
  /** Array fields: startTimeline (with IN) */
  StringArray = "string-array",
}

/**
 * Skill constraint origin for type discrimination.
 */
export enum SkillConstraintOrigin {
  /** User-specified skill requirement */
  User = "user",
  /** Derived from inference rule */
  Derived = "derived",
}

// ============================================
// BASE FIELDS (shared, no `value` field)
// ============================================

interface ConstraintBase {
  /** Unique identifier for this constraint */
  id: string;
  /** Field being constrained */
  field: string;
  /** Operator used (IN, >=, <=, STARTS WITH, etc.) */
  operator: string;
  /** Human-readable description */
  displayValue: string;
  /** Source of the constraint */
  source: ConstraintSource;
  /** For derived constraints, the rule ID to override */
  ruleId?: string;
}

// ============================================
// PROPERTY CONSTRAINTS (with typed values)
// ============================================

interface PropertyConstraintBase extends ConstraintBase {
  constraintType: ConstraintType.Property;
  /** Generated Cypher fragment for this constraint */
  cypher: CypherFragment;
}

/**
 * Numeric property constraint (salary, yearsExperience).
 */
export interface NumericPropertyConstraint extends PropertyConstraintBase {
  fieldType: PropertyFieldType.Numeric;
  value: number;
}

/**
 * String property constraint (timezone with STARTS WITH).
 */
export interface StringPropertyConstraint extends PropertyConstraintBase {
  fieldType: PropertyFieldType.String;
  value: string;
}

/**
 * String array property constraint (startTimeline with IN).
 */
export interface StringArrayPropertyConstraint extends PropertyConstraintBase {
  fieldType: PropertyFieldType.StringArray;
  value: string[];
}

/**
 * Union of all property constraint types.
 */
export type PropertyConstraint =
  | NumericPropertyConstraint
  | StringPropertyConstraint
  | StringArrayPropertyConstraint;

// ============================================
// SKILL TRAVERSAL CONSTRAINTS (with typed values)
// ============================================

interface SkillTraversalConstraintBase extends ConstraintBase {
  constraintType: ConstraintType.SkillTraversal;
  /** Skill IDs that must be matched via relationship traversal */
  skillIds: string[];
}

/**
 * User skill requirement with optional proficiency.
 */
export interface UserSkillRequirement {
  skill: string;
  minProficiency?: ProficiencyLevel;
}

/**
 * User-specified skill constraint (one per skill for independent testing).
 */
export interface UserSkillConstraint extends SkillTraversalConstraintBase {
  origin: SkillConstraintOrigin.User;
  value: UserSkillRequirement;
}

/**
 * Derived skill constraint (grouped by rule).
 */
export interface DerivedSkillConstraint extends SkillTraversalConstraintBase {
  origin: SkillConstraintOrigin.Derived;
  /** Derived constraints group skill IDs, not individual requirements */
  value: string[];
  /** Rule ID is required for derived constraints */
  ruleId: string;
}

/**
 * Union of all skill traversal constraint types.
 */
export type SkillTraversalConstraint = UserSkillConstraint | DerivedSkillConstraint;

// ============================================
// TESTABLE CONSTRAINT (top-level union)
// ============================================

/**
 * Discriminated union of all constraint types.
 *
 * Discrimination hierarchy:
 * 1. constraintType: Property | SkillTraversal
 * 2. For Property: fieldType: Numeric | String | StringArray
 * 3. For SkillTraversal: origin: User | Derived
 */
export type TestableConstraint = PropertyConstraint | SkillTraversalConstraint;

// ============================================
// TYPE GUARDS
// ============================================

export function isPropertyConstraint(c: TestableConstraint): c is PropertyConstraint {
  return c.constraintType === ConstraintType.Property;
}

export function isSkillTraversalConstraint(c: TestableConstraint): c is SkillTraversalConstraint {
  return c.constraintType === ConstraintType.SkillTraversal;
}

export function isNumericPropertyConstraint(c: PropertyConstraint): c is NumericPropertyConstraint {
  return c.fieldType === PropertyFieldType.Numeric;
}

export function isStringPropertyConstraint(c: PropertyConstraint): c is StringPropertyConstraint {
  return c.fieldType === PropertyFieldType.String;
}

export function isStringArrayPropertyConstraint(c: PropertyConstraint): c is StringArrayPropertyConstraint {
  return c.fieldType === PropertyFieldType.StringArray;
}

export function isUserSkillConstraint(c: SkillTraversalConstraint): c is UserSkillConstraint {
  return c.origin === SkillConstraintOrigin.User;
}

export function isDerivedSkillConstraint(c: SkillTraversalConstraint): c is DerivedSkillConstraint {
  return c.origin === SkillConstraintOrigin.Derived;
}

// ============================================
// RESULT TYPES
// ============================================

/**
 * Result of decomposing a search request into testable constraints.
 */
export interface DecomposedConstraints {
  /** All constraints extracted from the request */
  constraints: TestableConstraint[];
  /** The base MATCH clause (without WHERE) */
  baseMatchClause: string;
}
