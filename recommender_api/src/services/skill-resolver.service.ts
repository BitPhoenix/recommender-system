/**
 * Skill Resolver Service
 *
 * Expands high-level skill requirements into concrete leaf skills that engineers
 * can actually have assessments for. This is necessary because the skill graph
 * has categories (Backend, Databases) that no engineer directly possesses -
 * they possess the leaf skills underneath (Node.js, PostgreSQL).
 *
 * Example: A manager searches for "Backend at proficient level"
 *   Input:  [{ skill: "Backend", minProficiency: "proficient" }]
 *   Output: [{ skillId: "node", minProficiency: "proficient" },
 *            { skillId: "python", minProficiency: "proficient" },
 *            { skillId: "java", minProficiency: "proficient" }, ...]
 *
 * The expanded leaf skills inherit the proficiency requirement from their parent.
 */

import type { Session } from 'neo4j-driver';
import type { ProficiencyLevel, SkillRequirement } from '../types/search.types.js';
import { PROFICIENCY_LEVEL_ORDER } from '../types/search.types.js';

/**
 * A leaf skill with inherited proficiency requirements.
 *
 * When "Backend at expert" expands to [Node.js, Python, Java], each leaf
 * carries minProficiency: "expert" so the query can filter engineers who
 * meet that bar for ANY of these skills.
 */
export interface ResolvedSkillWithProficiency {
  skillId: string;
  skillName: string;
  minProficiency: ProficiencyLevel;
  preferredMinProficiency: ProficiencyLevel | null;
}

/**
 * A resolved skill requirement represents one user-requested skill
 * and all the skills that satisfy it.
 *
 * When a user requests "Node.js", we need:
 * - The original skill they asked for (Node.js)
 * - All skills that satisfy this requirement (Node.js + Express + NestJS)
 *
 * An engineer matches this requirement if they have ANY skill from expandedSkillIds
 * at the required proficiency level. This enables "descendant matching" where
 * having Express satisfies a request for Node.js.
 *
 * Note: Even leaf skills (with no descendants) become a requirement with a single
 * expanded skill. This simplifies downstream code - every requirement uses
 * HAS_ANY semantics, whether the set has 1 member or 10.
 */
export interface ResolvedSkillRequirement {
  /** The original skill identifier from the user's request */
  originalIdentifier: string;
  /** The resolved skill ID (if found) - null for unresolved identifiers */
  originalSkillId: string | null;
  /** The resolved skill name (if found) - null for unresolved identifiers */
  originalSkillName: string | null;
  /** All skill IDs that satisfy this requirement (original + descendants) */
  expandedSkillIds: string[];
  /** Map from skill ID to human-readable skill name for all expanded skills */
  skillIdToName: Map<string, string>;
  /** Proficiency requirement */
  minProficiency: ProficiencyLevel;
  /** Optional preferred proficiency for ranking boost */
  preferredMinProficiency: ProficiencyLevel | null;
}

export interface SkillRequirementResolutionResult {
  /** One requirement per user-requested skill - each is an independent filter */
  skillRequirements: ResolvedSkillRequirement[];
  /** Flat list of all skills (for backwards compatibility during transition) */
  resolvedSkills: ResolvedSkillWithProficiency[];
  expandedSkillNames: string[];
  originalIdentifiers: string[];     // Original skill identifiers from the request
  unresolvedIdentifiers: string[];   // Identifiers that didn't match any skill
}

/**
 * Resolves skill requirements into leaf skills with per-skill proficiency.
 *
 * ## Graph Traversal
 *
 * The skill graph uses two relationship types that we must traverse:
 *
 * 1. BELONGS_TO - Role-based membership (skill belongs to multiple categories)
 *    Example: JavaScript BELONGS_TO "Frontend Frameworks", JavaScript BELONGS_TO "Backend Languages"
 *    Used for: Composite categories that group skills by role/function
 *
 * 2. CHILD_OF - Structural hierarchy (skill is a specialization of parent)
 *    Example: Express CHILD_OF Node.js CHILD_OF JavaScript
 *    Used for: Technology inheritance trees
 *
 * We traverse both because a search for "Backend" should find Node.js (via BELONGS_TO),
 * and a search for "JavaScript" should find Express (via CHILD_OF).
 *
 * ## Proficiency Inheritance
 *
 * Each expanded skill inherits its parent's proficiency requirement:
 *   "Backend at expert" → Node.js at expert, Python at expert, etc.
 *
 * ## Overlap Resolution
 *
 * When the same leaf skill is reached from multiple parents with different
 * proficiency requirements, we keep the STRICTER requirement:
 *   "JavaScript at learning" + "Node.js at expert" → Node.js at expert
 *
 * This prevents a looser parent requirement from weakening a specific requirement.
 */
export async function resolveSkillRequirements(
  session: Session,
  requirements: SkillRequirement[],
  defaultMinProficiency: ProficiencyLevel = 'learning'
): Promise<SkillRequirementResolutionResult> {
  if (!requirements || requirements.length === 0) {
    return {
      skillRequirements: [],
      resolvedSkills: [],
      expandedSkillNames: [],
      originalIdentifiers: [],
      unresolvedIdentifiers: [],
    };
  }

  const originalIdentifiers = requirements.map((r) => r.skill);

  // ---------------------------------------------------------------------------
  // Query 1: Find all leaf skills for each requested identifier
  // ---------------------------------------------------------------------------
  // We need to track which identifier each leaf came from so we can apply
  // the correct proficiency requirement during post-processing.
  //
  // Example input: ["Backend", "PostgreSQL"]
  // Example output rows:
  //   { identifier: "Backend", skillId: "node", skillName: "Node.js" }
  //   { identifier: "Backend", skillId: "python", skillName: "Python" }
  //   { identifier: "PostgreSQL", skillId: "postgresql", skillName: "PostgreSQL" }
  //
  // Note: PostgreSQL returns itself because CHILD_OF*0.. includes depth 0 (self-match).
  // This allows users to specify leaf skills directly without special handling.
  // ---------------------------------------------------------------------------
  const leafQuery = `
UNWIND $skillIdentifiers AS identifier

// Find the skill node matching this identifier (by ID or name)
MATCH (rootSkill:Skill)
WHERE rootSkill.id = identifier OR rootSkill.name = identifier

// Path 1: BELONGS_TO traversal for role-based categories
// Example: "Backend" → finds Node.js, Python, Java via BELONGS_TO
// Depth 1.. means we don't include the category itself, only members
OPTIONAL MATCH (leafBelongsTo:Skill)-[:BELONGS_TO*1..]->(rootSkill)
WHERE leafBelongsTo.isCategory = false

// Path 2: CHILD_OF traversal for structural hierarchies
// Example: "JavaScript" → finds Node.js, Express, React via CHILD_OF
// Depth 0.. includes the skill itself (important for leaf skill searches)
OPTIONAL MATCH (leafChildOf:Skill)-[:CHILD_OF*0..]->(rootSkill)
WHERE leafChildOf.isCategory = false

// Merge results from both paths, removing duplicates
WITH identifier,
     COLLECT(DISTINCT {id: leafBelongsTo.id, name: leafBelongsTo.name}) +
     COLLECT(DISTINCT {id: leafChildOf.id, name: leafChildOf.name}) AS allLeaves
UNWIND allLeaves AS leaf
WITH identifier, leaf
WHERE leaf.id IS NOT NULL
RETURN DISTINCT identifier, leaf.id AS skillId, leaf.name AS skillName
`;

  // ---------------------------------------------------------------------------
  // Query 2: Validate which identifiers exist in the graph
  // ---------------------------------------------------------------------------
  // Separate from leafQuery because a category with no leaf descendants would
  // return no rows from leafQuery, but we still want to know it was recognized.
  // This powers the "unresolvedIdentifiers" response field for user feedback.
  // ---------------------------------------------------------------------------
  const matchedQuery = `
UNWIND $skillIdentifiers AS identifier
MATCH (s:Skill)
WHERE s.id = identifier OR s.name = identifier
RETURN DISTINCT identifier
`;

  const leafResult = await session.run(leafQuery, { skillIdentifiers: originalIdentifiers });
  const matchedResult = await session.run(matchedQuery, { skillIdentifiers: originalIdentifiers });

  // ---------------------------------------------------------------------------
  // Build proficiency lookup: identifier → { min, preferred }
  // ---------------------------------------------------------------------------
  // Case-insensitive because user input may vary ("typescript" vs "TypeScript")
  // ---------------------------------------------------------------------------
  const proficiencyMap = new Map<string, { min: ProficiencyLevel; preferred: ProficiencyLevel | null }>();
  for (const req of requirements) {
    proficiencyMap.set(req.skill.toLowerCase(), {
      min: req.minProficiency ?? defaultMinProficiency,
      preferred: req.preferredMinProficiency ?? null,
    });
  }

  // ---------------------------------------------------------------------------
  // Process query results, building both flat skill list and skill groups
  // ---------------------------------------------------------------------------
  // Each leaf skill inherits the proficiency from the identifier that led to it.
  // If a skill appears under multiple identifiers, we keep the stricter requirement.
  //
  // Example scenario:
  //   User requests: ["JavaScript:learning", "Node.js:expert"]
  //   Node.js is found via both paths (CHILD_OF JavaScript, and directly)
  //   Result: Node.js gets "expert" (stricter than "learning")
  //
  // Additionally, we build skill groups where each user-requested skill becomes
  // an independent filter group. The engineer must have at least one skill from
  // each group (HAS_ANY semantics within group, AND between groups).
  // ---------------------------------------------------------------------------
  const resolvedSkillMap = new Map<string, ResolvedSkillWithProficiency>();

  /*
   * Build skill requirements: one per original identifier.
   * Each requirement tracks:
   * - The original skill requested (for matchType='direct')
   * - All skills that satisfy this requirement (for HAS_ANY filtering)
   */
  const skillRequirementMap = new Map<string, ResolvedSkillRequirement>();

  for (const record of leafResult.records) {
    const identifier = record.get('identifier') as string;
    const identifierLower = identifier.toLowerCase();
    const skillId = record.get('skillId') as string;
    const skillName = record.get('skillName') as string;

    const proficiency = proficiencyMap.get(identifierLower) ?? {
      min: defaultMinProficiency,
      preferred: null,
    };

    // Handle overlap: same skill reached from multiple parents
    if (resolvedSkillMap.has(skillId)) {
      const existing = resolvedSkillMap.get(skillId)!;

      // Keep the stricter (higher index) minProficiency
      const existingIdx = PROFICIENCY_LEVEL_ORDER.indexOf(existing.minProficiency);
      const newIdx = PROFICIENCY_LEVEL_ORDER.indexOf(proficiency.min);
      if (newIdx > existingIdx) {
        existing.minProficiency = proficiency.min;
      }

      // Keep the stricter preferredMinProficiency
      if (proficiency.preferred) {
        const existingPrefIdx = existing.preferredMinProficiency
          ? PROFICIENCY_LEVEL_ORDER.indexOf(existing.preferredMinProficiency)
          : -1;
        const newPrefIdx = PROFICIENCY_LEVEL_ORDER.indexOf(proficiency.preferred);
        if (newPrefIdx > existingPrefIdx) {
          existing.preferredMinProficiency = proficiency.preferred;
        }
      }
    } else {
      resolvedSkillMap.set(skillId, {
        skillId,
        skillName,
        minProficiency: proficiency.min,
        preferredMinProficiency: proficiency.preferred,
      });
    }

    /*
     * Build skill requirement for this identifier.
     * The original skill is identified by direct match: skill ID or name matches the identifier.
     */
    const isOriginalSkill = skillId === identifier || skillName.toLowerCase() === identifierLower;

    if (!skillRequirementMap.has(identifierLower)) {
      // First skill for this identifier
      const skillIdToName = new Map<string, string>();
      skillIdToName.set(skillId, skillName);
      skillRequirementMap.set(identifierLower, {
        originalIdentifier: identifier,
        originalSkillId: isOriginalSkill ? skillId : null,
        originalSkillName: isOriginalSkill ? skillName : null,
        expandedSkillIds: [skillId],
        skillIdToName,
        minProficiency: proficiency.min,
        preferredMinProficiency: proficiency.preferred,
      });
    } else {
      const requirement = skillRequirementMap.get(identifierLower)!;
      // Add to match candidates if not already present
      if (!requirement.expandedSkillIds.includes(skillId)) {
        requirement.expandedSkillIds.push(skillId);
      }
      // Always add to name map
      requirement.skillIdToName.set(skillId, skillName);
      // Check if this is the original skill (might find it later in results)
      if (isOriginalSkill && !requirement.originalSkillId) {
        requirement.originalSkillId = skillId;
        requirement.originalSkillName = skillName;
      }
    }
  }

  const resolvedSkills = Array.from(resolvedSkillMap.values());
  const expandedSkillNames = resolvedSkills.map((s) => s.skillName);
  const skillRequirements = Array.from(skillRequirementMap.values());

  // ---------------------------------------------------------------------------
  // Identify unresolved identifiers for user feedback
  // ---------------------------------------------------------------------------
  // If someone searches for "Cobol" and it's not in our graph, we want to
  // tell them rather than silently ignoring it.
  // ---------------------------------------------------------------------------
  const matchedIdentifiers = new Set(
    matchedResult.records.map((record) => (record.get('identifier') as string).toLowerCase())
  );
  const unresolvedIdentifiers = originalIdentifiers.filter(
    (id) => !matchedIdentifiers.has(id.toLowerCase())
  );

  return {
    skillRequirements,
    resolvedSkills,
    expandedSkillNames,
    originalIdentifiers,
    unresolvedIdentifiers,
  };
}
