import { Session } from "neo4j-driver";
import { v4 as uuidv4 } from "uuid";
import { normalizeCompanyName } from "./company-normalizer.service.js";

/*
 * Find an existing Company by normalized name (including aliases), or create a new one.
 * Uses company normalizer for suffix stripping and alias resolution.
 */
export async function findOrCreateCompany(
  session: Session,
  companyName: string,
  companyType: string
): Promise<string> {
  // Step 1: Normalize company name (strip suffixes, check aliases)
  const normalization = await normalizeCompanyName(session, companyName);

  // Step 2: If we found an existing company (exact or alias match), return it
  if (normalization.canonicalCompanyId) {
    return normalization.canonicalCompanyId;
  }

  // Step 3: Create new company with normalized name
  const companyId = `company_${uuidv4().slice(0, 8)}`;

  /*
   * MERGE on normalizedName ensures we don't create duplicates.
   * The normalizer already checked for exact/alias matches, so this
   * should create a new company.
   */
  const result = await session.run(`
    MERGE (c:Company {normalizedName: $normalizedName})
    ON CREATE SET
      c.id = $companyId,
      c.name = $companyName,
      c.type = $companyType
    RETURN c.id AS companyId
  `, {
    normalizedName: normalization.normalizedName,
    companyId,
    companyName: companyName.trim(), // Keep original casing for display name
    companyType,
  });

  return result.records[0].get("companyId");
}
