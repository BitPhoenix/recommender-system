/**
 * Skill Resolver Service
 * Handles skill hierarchy traversal to expand skill identifiers into leaf skills.
 *
 * When a manager requests "Backend", this service finds all descendants
 * (Node.js, Python, Java, etc.) via the CHILD_OF relationship.
 */

import type { Session } from 'neo4j-driver';

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
 * Resolves skill identifiers (names or IDs) to all descendant leaf skills.
 *
 * Uses two traversal strategies, combined with UNION:
 * - BELONGS_TO (1-2 hops): For role-based categories (Backend, Frontend, Full Stack)
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
// Handles: Backend (1 hop), Frontend (1 hop), Full Stack (2 hops), any future composites
MATCH (rootSkill:Skill)
WHERE (rootSkill.id IN $skillIdentifiers OR rootSkill.name IN $skillIdentifiers)

MATCH (leafSkill:Skill)-[:BELONGS_TO*1..2]->(rootSkill)
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
