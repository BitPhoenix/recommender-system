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

export interface SkillRequirementResolutionResult {
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
 *    Example: Node.js BELONGS_TO Backend, Node.js BELONGS_TO "Full Stack"
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
  // Process query results, applying proficiency inheritance
  // ---------------------------------------------------------------------------
  // Each leaf skill inherits the proficiency from the identifier that led to it.
  // If a skill appears under multiple identifiers, we keep the stricter requirement.
  //
  // Example scenario:
  //   User requests: ["JavaScript:learning", "Node.js:expert"]
  //   Node.js is found via both paths (CHILD_OF JavaScript, and directly)
  //   Result: Node.js gets "expert" (stricter than "learning")
  // ---------------------------------------------------------------------------
  const resolvedSkillMap = new Map<string, ResolvedSkillWithProficiency>();

  for (const record of leafResult.records) {
    const identifier = (record.get('identifier') as string).toLowerCase();
    const skillId = record.get('skillId') as string;
    const skillName = record.get('skillName') as string;

    const proficiency = proficiencyMap.get(identifier) ?? {
      min: defaultMinProficiency,
      preferred: null,
    };

    // Handle overlap: same skill reached from multiple parents
    if (resolvedSkillMap.has(skillId)) {
      const existing = resolvedSkillMap.get(skillId)!;
      const proficiencyOrder: ProficiencyLevel[] = ['learning', 'proficient', 'expert'];

      // Keep the stricter (higher index) minProficiency
      const existingIdx = proficiencyOrder.indexOf(existing.minProficiency);
      const newIdx = proficiencyOrder.indexOf(proficiency.min);
      if (newIdx > existingIdx) {
        existing.minProficiency = proficiency.min;
      }

      // Keep the stricter preferredMinProficiency
      if (proficiency.preferred) {
        const existingPrefIdx = existing.preferredMinProficiency
          ? proficiencyOrder.indexOf(existing.preferredMinProficiency)
          : -1;
        const newPrefIdx = proficiencyOrder.indexOf(proficiency.preferred);
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
  }

  const resolvedSkills = Array.from(resolvedSkillMap.values());
  const expandedSkillNames = resolvedSkills.map((s) => s.skillName);

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
    resolvedSkills,
    expandedSkillNames,
    originalIdentifiers,
    unresolvedIdentifiers,
  };
}
