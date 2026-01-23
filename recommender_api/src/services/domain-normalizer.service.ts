import { Session } from "neo4j-driver";

export interface DomainNormalizationResult {
  originalName: string;
  canonicalDomainId: string | null;
  canonicalDomainName: string | null;
}

export interface NormalizedDomainsResult {
  resolvedDomains: DomainNormalizationResult[];
  unresolvedDomains: DomainNormalizationResult[];
}

export type DomainNodeType = "BusinessDomain" | "TechnicalDomain";

/*
 * Normalize extracted domain names to our canonical domain taxonomy.
 * Works for both BusinessDomain and TechnicalDomain node types.
 */
export async function normalizeExtractedDomains(
  session: Session,
  extractedDomainNames: string[],
  domainType: DomainNodeType
): Promise<NormalizedDomainsResult> {
  const results: DomainNormalizationResult[] = [];

  for (const domainName of extractedDomainNames) {
    // Try to match against the specified domain taxonomy (case-insensitive)
    const result = await session.run(`
      MATCH (d:${domainType})
      WHERE toLower(d.name) = toLower($domainName)
      RETURN d.id AS domainId, d.name AS domainName
      LIMIT 1
    `, { domainName });

    if (result.records.length > 0) {
      const record = result.records[0];
      results.push({
        originalName: domainName,
        canonicalDomainId: record.get("domainId") as string,
        canonicalDomainName: record.get("domainName") as string,
      });
    } else {
      results.push({
        originalName: domainName,
        canonicalDomainId: null,
        canonicalDomainName: null,
      });
    }
  }

  return {
    resolvedDomains: results.filter((r) => r.canonicalDomainId !== null),
    unresolvedDomains: results.filter((r) => r.canonicalDomainId === null),
  };
}
