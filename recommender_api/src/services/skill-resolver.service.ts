/**
 * Skill Resolver Service
 * Handles skill hierarchy traversal to expand skill identifiers into leaf skills.
 *
 * When a manager requests "Backend", this service finds all descendants
 * (Node.js, Python, Java, etc.) via the CHILD_OF relationship.
 */

import type { Session } from 'neo4j-driver';
import type { ProficiencyLevel, SkillRequirement } from '../types/search.types.js';

export interface ResolvedSkill {
  skillId: string;
  skillName: string;
}

export interface SkillResolutionResult {
  resolvedSkills: ResolvedSkill[];
  expandedSkillNames: string[];      // For metadata - names of all leaf skills found
  matchedIdentifiers: string[];      // Original identifiers that matched (including categories)
}

/**
 * A resolved skill with its proficiency requirements.
 * Each expanded skill inherits the parent's proficiency requirement.
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
 * Resolves skill identifiers (names or IDs) to all descendant leaf skills.
 *
 * Uses two traversal strategies, combined with UNION:
 * - BELONGS_TO (unlimited depth): For role-based categories (Backend, Frontend, Full Stack)
 * - CHILD_OF (unlimited depth): For structural categories (Databases, Languages) and regular skills
 *
 * Returns only leaf skills (isCategory = false)
 * Accepts both skill IDs and names for flexibility
 */
export async function resolveSkillHierarchy(
  session: Session,
  skillIdentifiers: string[]
): Promise<SkillResolutionResult> {
  if (!skillIdentifiers || skillIdentifiers.length === 0) {
    return { resolvedSkills: [], expandedSkillNames: [], matchedIdentifiers: [] };
  }

  // Generic query - no hardcoded category IDs
  // Just follows whatever relationships exist in the graph
  const leafQuery = `
// First: Find leaf skills via BELONGS_TO (for role-based categories)
// Handles: Backend, Frontend, Full Stack, and any future composites at any depth
MATCH (rootSkill:Skill)
WHERE (rootSkill.id IN $skillIdentifiers OR rootSkill.name IN $skillIdentifiers)

MATCH (leafSkill:Skill)-[:BELONGS_TO*1..]->(rootSkill)
WHERE leafSkill.isCategory = false
RETURN DISTINCT leafSkill.id AS skillId, leafSkill.name AS skillName

UNION

// Second: Find leaf skills via CHILD_OF (for structural categories and regular skills)
// Handles: Databases, Languages, JavaScript→Node.js→Express inheritance
MATCH (rootSkill:Skill)
WHERE (rootSkill.id IN $skillIdentifiers OR rootSkill.name IN $skillIdentifiers)

MATCH (descendant:Skill)-[:CHILD_OF*0..]->(rootSkill)
WHERE descendant.isCategory = false
RETURN DISTINCT descendant.id AS skillId, descendant.name AS skillName
`;

  // Query to find which identifiers matched (including categories)
  const matchedQuery = `
UNWIND $skillIdentifiers AS identifier
MATCH (s:Skill)
WHERE s.id = identifier OR s.name = identifier
RETURN DISTINCT identifier
`;

  const leafResult = await session.run(leafQuery, { skillIdentifiers });
  const matchedResult = await session.run(matchedQuery, { skillIdentifiers });

  const resolvedSkills: ResolvedSkill[] = leafResult.records.map((record) => ({
    skillId: record.get('skillId') as string,
    skillName: record.get('skillName') as string,
  }));

  const expandedSkillNames = resolvedSkills.map((s) => s.skillName);
  const matchedIdentifiers = matchedResult.records.map(
    (record) => record.get('identifier') as string
  );

  return { resolvedSkills, expandedSkillNames, matchedIdentifiers };
}

/**
 * Checks if any of the given skill identifiers exist in the database.
 * Useful for validation.
 */
export async function validateSkillIdentifiers(
  session: Session,
  skillIdentifiers: string[]
): Promise<{ valid: string[]; invalid: string[] }> {
  if (!skillIdentifiers || skillIdentifiers.length === 0) {
    return { valid: [], invalid: [] };
  }

  const query = `
UNWIND $skillIdentifiers AS identifier
OPTIONAL MATCH (s:Skill)
WHERE s.id = identifier OR s.name = identifier
RETURN identifier, s IS NOT NULL AS exists
`;

  const result = await session.run(query, { skillIdentifiers });

  const valid: string[] = [];
  const invalid: string[] = [];

  result.records.forEach((record) => {
    const identifier = record.get('identifier') as string;
    const exists = record.get('exists') as boolean;
    if (exists) {
      valid.push(identifier);
    } else {
      invalid.push(identifier);
    }
  });

  return { valid, invalid };
}

/**
 * Gets aligned skill IDs for team focus, validating they exist in the database.
 */
export async function resolveAlignedSkills(
  session: Session,
  alignedSkillIds: string[]
): Promise<string[]> {
  if (!alignedSkillIds || alignedSkillIds.length === 0) {
    return [];
  }

  const query = `
MATCH (s:Skill)
WHERE s.id IN $alignedSkillIds
RETURN s.id AS skillId
`;

  const result = await session.run(query, { alignedSkillIds });

  return result.records.map((record) => record.get('skillId') as string);
}

/**
 * Resolves skill requirements with per-skill proficiency.
 * Each skill can have its own minProficiency and preferredMinProficiency.
 * Expanded descendant skills inherit the parent's proficiency requirements.
 *
 * @param session Neo4j session
 * @param requirements Array of skill requirements with proficiency settings
 * @param defaultMinProficiency Default proficiency when not specified (usually 'learning')
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

  // Query to find all leaf skills for each requested skill identifier
  // Each result includes the original skill identifier so we can map proficiency
  const leafQuery = `
UNWIND $skillIdentifiers AS identifier
// Find the matching root skill
MATCH (rootSkill:Skill)
WHERE rootSkill.id = identifier OR rootSkill.name = identifier
// Find leaf skills via BELONGS_TO (for role-based categories)
OPTIONAL MATCH (leafBelongsTo:Skill)-[:BELONGS_TO*1..]->(rootSkill)
WHERE leafBelongsTo.isCategory = false
// Find leaf skills via CHILD_OF (for structural categories and regular skills)
OPTIONAL MATCH (leafChildOf:Skill)-[:CHILD_OF*0..]->(rootSkill)
WHERE leafChildOf.isCategory = false
// Collect distinct leaf skills from both traversal paths
WITH identifier,
     COLLECT(DISTINCT {id: leafBelongsTo.id, name: leafBelongsTo.name}) +
     COLLECT(DISTINCT {id: leafChildOf.id, name: leafChildOf.name}) AS allLeaves
UNWIND allLeaves AS leaf
WITH identifier, leaf
WHERE leaf.id IS NOT NULL
RETURN DISTINCT identifier, leaf.id AS skillId, leaf.name AS skillName
`;

  // Query to find which identifiers matched
  const matchedQuery = `
UNWIND $skillIdentifiers AS identifier
MATCH (s:Skill)
WHERE s.id = identifier OR s.name = identifier
RETURN DISTINCT identifier
`;

  const leafResult = await session.run(leafQuery, { skillIdentifiers: originalIdentifiers });
  const matchedResult = await session.run(matchedQuery, { skillIdentifiers: originalIdentifiers });

  // Build a map from skill identifier to proficiency requirements
  const proficiencyMap = new Map<string, { min: ProficiencyLevel; preferred: ProficiencyLevel | null }>();
  for (const req of requirements) {
    proficiencyMap.set(req.skill.toLowerCase(), {
      min: req.minProficiency ?? defaultMinProficiency,
      preferred: req.preferredMinProficiency ?? null,
    });
  }

  // Process results, inheriting proficiency from the original identifier
  const resolvedSkillMap = new Map<string, ResolvedSkillWithProficiency>();
  for (const record of leafResult.records) {
    const identifier = (record.get('identifier') as string).toLowerCase();
    const skillId = record.get('skillId') as string;
    const skillName = record.get('skillName') as string;

    // Get proficiency from the matched parent identifier
    const proficiency = proficiencyMap.get(identifier) ?? {
      min: defaultMinProficiency,
      preferred: null,
    };

    // If this skill ID was already resolved (from another parent), take the stricter requirement
    if (resolvedSkillMap.has(skillId)) {
      const existing = resolvedSkillMap.get(skillId)!;
      const proficiencyOrder: ProficiencyLevel[] = ['learning', 'proficient', 'expert'];
      const existingIdx = proficiencyOrder.indexOf(existing.minProficiency);
      const newIdx = proficiencyOrder.indexOf(proficiency.min);
      // Use the stricter (higher) minimum proficiency
      if (newIdx > existingIdx) {
        existing.minProficiency = proficiency.min;
      }
      // Use the stricter preferred proficiency too
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

  // Determine which identifiers were unresolved
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
