import { Session } from "neo4j-driver";

/*
 * Structured text content for an engineer, used for both TF-IDF and embedding generation.
 */
export interface EngineerTextContent {
  engineerId: string;
  headline: string;
  jobTitles: string[];
  skills: string[];
  domains: string[];
  jobHighlights: string[];
  companyNames: string[];
  resumeText: string;
}

/*
 * Load text content for engineers from Neo4j.
 *
 * Aggregates all searchable text fields:
 * - Headline
 * - Job titles from WorkExperience nodes
 * - Skills from UserSkill → Skill relationships
 * - Domains from BusinessDomain and TechnicalDomain relationships
 * - Job highlights from WorkExperience nodes
 * - Company names from WorkExperience → Company relationships
 * - Resume raw text
 *
 * Used by both TF-IDF and embedding index managers.
 *
 * @param session Neo4j session
 * @param engineerId Optional - if provided, loads only that engineer's content
 */
export async function loadEngineerTextContent(
  session: Session,
  engineerId?: string
): Promise<EngineerTextContent[]> {
  const whereClause = engineerId ? "WHERE e.id = $engineerId" : "";

  const result = await session.run(`
    MATCH (e:Engineer)
    ${whereClause}

    // Collect job titles and highlights from work history
    OPTIONAL MATCH (e)-[:HAD_ROLE]->(w:WorkExperience)
    WITH e, collect(DISTINCT w.title) AS jobTitles, collect(DISTINCT w.highlights) AS allHighlights
    WITH e, jobTitles, reduce(acc = [], h IN allHighlights | acc + COALESCE(h, [])) AS flatHighlights

    // Collect company names
    OPTIONAL MATCH (e)-[:HAD_ROLE]->(:WorkExperience)-[:AT_COMPANY]->(c:Company)
    WITH e, jobTitles, flatHighlights, collect(DISTINCT c.name) AS companyNames

    // Collect skills
    OPTIONAL MATCH (e)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
    WITH e, jobTitles, flatHighlights, companyNames, collect(DISTINCT s.name) AS skills

    // Collect domains
    OPTIONAL MATCH (e)-[:HAS_EXPERIENCE_IN]->(bd:BusinessDomain)
    OPTIONAL MATCH (e)-[:HAS_EXPERIENCE_IN]->(td:TechnicalDomain)
    WITH e, jobTitles, flatHighlights, companyNames, skills,
         collect(DISTINCT bd.name) + collect(DISTINCT td.name) AS domains

    // Get resume text
    OPTIONAL MATCH (e)-[:HAS_RESUME]->(r:Resume)

    RETURN
      e.id AS engineerId,
      e.headline AS headline,
      jobTitles,
      skills,
      domains,
      flatHighlights AS jobHighlights,
      companyNames,
      r.rawText AS resumeText
  `, { engineerId: engineerId || null });

  return result.records.map((record) => ({
    engineerId: record.get("engineerId") as string,
    headline: (record.get("headline") as string) || "",
    jobTitles: (record.get("jobTitles") as string[]) || [],
    skills: ((record.get("skills") as (string | null)[]) || []).filter((s): s is string => s !== null),
    domains: ((record.get("domains") as (string | null)[]) || []).filter((d): d is string => d !== null),
    jobHighlights: (record.get("jobHighlights") as string[]) || [],
    companyNames: (record.get("companyNames") as string[]) || [],
    resumeText: (record.get("resumeText") as string) || "",
  }));
}

/*
 * Concatenate engineer text content into a single searchable string.
 *
 * Uses space separator for all fields - this works for both TF-IDF (tokenization
 * splits on whitespace/punctuation regardless) and embeddings (semantic content
 * matters more than delimiters).
 */
export function concatenateEngineerText(content: EngineerTextContent): string {
  return [
    content.headline,
    content.jobTitles.join(" "),
    content.skills.join(" "),
    content.domains.join(" "),
    content.companyNames.join(" "),
    content.jobHighlights.join(" "),
    content.resumeText,
  ]
    .filter(Boolean)
    .join(" ");
}
