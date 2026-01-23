import { Session } from "neo4j-driver";
import { companySuffixes } from "../config/text-normalization/company-suffixes.config.js";

export interface CompanyNormalizationResult {
  normalizedName: string;          // After suffix stripping + lowercasing
  canonicalCompanyId: string | null; // If matched existing company or alias
  canonicalCompanyName: string | null;
  method: "exact" | "alias" | "new";
}

/*
 * Normalize a company name:
 * 1. Strip common legal suffixes (Inc., LLC, etc.)
 * 2. Check for exact match in existing companies
 * 3. Check for alias match (CompanyAlias nodes)
 * 4. Return normalized name for new company creation
 */
export async function normalizeCompanyName(
  session: Session,
  companyName: string
): Promise<CompanyNormalizationResult> {
  // Step 1: Strip suffixes and normalize
  let normalized = companyName.trim();
  for (const suffix of companySuffixes) {
    if (normalized.toLowerCase().endsWith(suffix.toLowerCase())) {
      normalized = normalized.slice(0, -suffix.length).trim();
      break; // Only strip one suffix
    }
  }
  const normalizedLower = normalized.toLowerCase();

  // Step 2: Check for exact match on existing company
  const exactResult = await session.run(`
    MATCH (c:Company {normalizedName: $name})
    RETURN c.id AS companyId, c.name AS companyName
    LIMIT 1
  `, { name: normalizedLower });

  if (exactResult.records.length > 0) {
    const record = exactResult.records[0];
    return {
      normalizedName: normalizedLower,
      canonicalCompanyId: record.get("companyId") as string,
      canonicalCompanyName: record.get("companyName") as string,
      method: "exact",
    };
  }

  // Step 3: Check for alias match
  const aliasResult = await session.run(`
    MATCH (a:CompanyAlias {name: $name})-[:ALIAS_FOR]->(c:Company)
    RETURN c.id AS companyId, c.name AS companyName
    LIMIT 1
  `, { name: normalizedLower });

  if (aliasResult.records.length > 0) {
    const record = aliasResult.records[0];
    return {
      normalizedName: normalizedLower,
      canonicalCompanyId: record.get("companyId") as string,
      canonicalCompanyName: record.get("companyName") as string,
      method: "alias",
    };
  }

  // Step 4: No match - return normalized name for new company creation
  return {
    normalizedName: normalizedLower,
    canonicalCompanyId: null,
    canonicalCompanyName: null,
    method: "new",
  };
}
