import { Session } from "neo4j-driver";

export interface NormalizationResult {
  canonicalSkillId: string | null;
  canonicalSkillName: string | null;
  method: "exact" | "synonym" | "fuzzy" | "unresolved";
  confidence: number; // 0-1
  originalName: string;
}

interface CanonicalSkill {
  id: string;
  name: string;
}

/*
 * Normalize an extracted skill name to a canonical skill ID.
 * Uses three-tier fallback: exact → synonym (from Neo4j) → fuzzy → unresolved.
 */
export async function normalizeExtractedSkill(
  session: Session,
  extractedName: string,
  allCanonicalSkills: CanonicalSkill[]
): Promise<NormalizationResult> {
  const normalized = extractedName.toLowerCase().trim();

  // Tier 1: Exact match on skill ID or name
  const exactMatch = allCanonicalSkills.find(
    (skill) => skill.id.toLowerCase() === normalized ||
               skill.name.toLowerCase() === normalized
  );
  if (exactMatch) {
    return {
      canonicalSkillId: exactMatch.id,
      canonicalSkillName: exactMatch.name,
      method: "exact",
      confidence: 1.0,
      originalName: extractedName,
    };
  }

  // Tier 2: Synonym lookup from Neo4j (indexed, O(1) lookup)
  const synonymResult = await session.run(`
    MATCH (syn:SkillSynonym {name: $name})-[:ALIAS_FOR]->(skill:Skill)
    RETURN skill.id AS skillId, skill.name AS skillName
    LIMIT 1
  `, { name: normalized });

  if (synonymResult.records.length > 0) {
    const record = synonymResult.records[0];
    return {
      canonicalSkillId: record.get("skillId") as string,
      canonicalSkillName: record.get("skillName") as string,
      method: "synonym",
      confidence: 0.95,
      originalName: extractedName,
    };
  }

  // Tier 3: Fuzzy string matching (Levenshtein distance)
  const fuzzyResult = findFuzzyMatch(normalized, allCanonicalSkills);
  if (fuzzyResult && fuzzyResult.similarity >= 0.8) {
    return {
      canonicalSkillId: fuzzyResult.skill.id,
      canonicalSkillName: fuzzyResult.skill.name,
      method: "fuzzy",
      confidence: fuzzyResult.similarity,
      originalName: extractedName,
    };
  }

  // Tier 4: Unresolved - flag for review
  return {
    canonicalSkillId: null,
    canonicalSkillName: null,
    method: "unresolved",
    confidence: 0,
    originalName: extractedName,
  };
}

export interface NormalizedSkillsResult {
  resolvedSkills: NormalizationResult[];
  unresolvedSkills: NormalizationResult[];
}

/*
 * Normalize a list of extracted skill names to our canonical taxonomy.
 * Returns resolved skills (matched) and unresolved skills (needs review).
 *
 * Note: Runs sequentially to avoid Neo4j session concurrency issues.
 * Sessions can only run one query at a time.
 */
export async function normalizeExtractedSkills(
  session: Session,
  extractedSkillNames: string[]
): Promise<NormalizedSkillsResult> {
  const canonicalSkills = await loadCanonicalSkills(session);

  const normalizedSkills: NormalizationResult[] = [];
  for (const name of extractedSkillNames) {
    const result = await normalizeExtractedSkill(session, name, canonicalSkills);
    normalizedSkills.push(result);
  }

  return {
    resolvedSkills: normalizedSkills.filter((n) => n.canonicalSkillId !== null),
    unresolvedSkills: normalizedSkills.filter((n) => n.canonicalSkillId === null),
  };
}

interface FuzzyMatchResult {
  skill: CanonicalSkill;
  similarity: number;
}

function findFuzzyMatch(
  searchTerm: string,
  candidates: CanonicalSkill[]
): FuzzyMatchResult | null {
  let bestMatch: FuzzyMatchResult | null = null;

  for (const candidate of candidates) {
    const similarity = calculateSimilarity(searchTerm, candidate.name.toLowerCase());
    if (!bestMatch || similarity > bestMatch.similarity) {
      bestMatch = { skill: candidate, similarity };
    }
  }

  return bestMatch;
}

/*
 * Calculate normalized Levenshtein similarity (0-1).
 * 1.0 = exact match, 0.0 = completely different.
 */
function calculateSimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1.0;
  return 1 - distance / maxLength;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/*
 * Load all canonical skills from Neo4j for normalization.
 */
export async function loadCanonicalSkills(session: Session): Promise<CanonicalSkill[]> {
  const result = await session.run(`
    MATCH (s:Skill)
    WHERE s.isCategory = false
    RETURN s.id AS id, s.name AS name
  `);

  return result.records.map((record) => ({
    id: record.get("id") as string,
    name: record.get("name") as string,
  }));
}
