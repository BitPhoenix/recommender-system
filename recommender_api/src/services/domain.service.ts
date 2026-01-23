import { Session } from "neo4j-driver";
import { DomainNormalizationResult, DomainNodeType } from "./domain-normalizer.service.js";

/*
 * Link engineer to resolved domains (business or technical).
 */
export async function linkEngineerToDomains(
  session: Session,
  engineerId: string,
  resolvedDomains: DomainNormalizationResult[],
  domainType: DomainNodeType
): Promise<void> {
  for (const domain of resolvedDomains) {
    if (domain.canonicalDomainId) {
      await session.run(`
        MATCH (e:Engineer {id: $engineerId})
        MATCH (d:${domainType} {id: $domainId})
        MERGE (e)-[:HAS_EXPERIENCE_IN]->(d)
      `, { engineerId, domainId: domain.canonicalDomainId });
    }
  }
}
