import { Session } from 'neo4j-driver';

interface SeedCompany {
  id: string;
  name: string;
  type: "faang" | "startup" | "enterprise" | "agency" | "consultancy";
}

/*
 * Well-known companies pre-seeded with correct types.
 * Companies not in this list are created dynamically during resume upload.
 */
export const knownCompanies: SeedCompany[] = [
  // FAANG / Big Tech
  { id: "company_google", name: "Google", type: "faang" },
  { id: "company_meta", name: "Meta", type: "faang" },
  { id: "company_apple", name: "Apple", type: "faang" },
  { id: "company_amazon", name: "Amazon", type: "faang" },
  { id: "company_netflix", name: "Netflix", type: "faang" },
  { id: "company_microsoft", name: "Microsoft", type: "faang" },

  // Well-known tech companies
  { id: "company_stripe", name: "Stripe", type: "startup" },
  { id: "company_airbnb", name: "Airbnb", type: "startup" },
  { id: "company_uber", name: "Uber", type: "startup" },
  { id: "company_lyft", name: "Lyft", type: "startup" },
  { id: "company_square", name: "Square", type: "startup" },
  { id: "company_shopify", name: "Shopify", type: "startup" },
  { id: "company_twilio", name: "Twilio", type: "startup" },
  { id: "company_datadog", name: "Datadog", type: "startup" },
  { id: "company_snowflake", name: "Snowflake", type: "startup" },

  // Enterprise
  { id: "company_ibm", name: "IBM", type: "enterprise" },
  { id: "company_oracle", name: "Oracle", type: "enterprise" },
  { id: "company_salesforce", name: "Salesforce", type: "enterprise" },
  { id: "company_sap", name: "SAP", type: "enterprise" },

  // Consultancies
  { id: "company_mckinsey", name: "McKinsey", type: "consultancy" },
  { id: "company_bcg", name: "BCG", type: "consultancy" },
  { id: "company_accenture", name: "Accenture", type: "consultancy" },
  { id: "company_deloitte", name: "Deloitte", type: "consultancy" },
  { id: "company_thoughtworks", name: "ThoughtWorks", type: "consultancy" },
];

interface CompanyAlias {
  name: string;      // The alias (lowercase)
  companyId: string; // The canonical company ID it maps to
}

/*
 * Company aliases map alternate names to canonical company IDs.
 * Handles rebrandings, abbreviations, and common variations.
 */
export const companyAliases: CompanyAlias[] = [
  // Rebrandings
  { name: "facebook", companyId: "company_meta" },
  { name: "facebook, inc.", companyId: "company_meta" },
  { name: "fb", companyId: "company_meta" },

  // Abbreviations / alternate names
  { name: "aws", companyId: "company_amazon" },
  { name: "amazon web services", companyId: "company_amazon" },
  { name: "gcp", companyId: "company_google" },
  { name: "google cloud", companyId: "company_google" },
  { name: "google cloud platform", companyId: "company_google" },
  { name: "alphabet", companyId: "company_google" },
  { name: "msft", companyId: "company_microsoft" },
  { name: "azure", companyId: "company_microsoft" },
  { name: "microsoft azure", companyId: "company_microsoft" },

  // Common variations
  { name: "block", companyId: "company_square" },  // Square rebranded to Block
  { name: "block, inc.", companyId: "company_square" },
];

/*
 * Seed well-known companies into Neo4j.
 */
export async function seedCompanies(session: Session): Promise<void> {
  // Create unique constraint on normalized name
  await session.run(`
    CREATE CONSTRAINT company_normalized_name_unique IF NOT EXISTS
    FOR (c:Company) REQUIRE c.normalizedName IS UNIQUE
  `);

  // Create index on company type for filtering
  await session.run(`
    CREATE INDEX company_type_index IF NOT EXISTS
    FOR (c:Company) ON (c.type)
  `);

  // Seed known companies
  for (const company of knownCompanies) {
    await session.run(`
      MERGE (c:Company {normalizedName: $normalizedName})
      ON CREATE SET
        c.id = $id,
        c.name = $name,
        c.type = $type
      ON MATCH SET
        c.type = $type
    `, {
      id: company.id,
      name: company.name,
      normalizedName: company.name.toLowerCase(),
      type: company.type,
    });
  }

  console.log(`[Seed] Created ${knownCompanies.length} known companies`);

  // Create unique constraint for alias names
  await session.run(`
    CREATE CONSTRAINT company_alias_name_unique IF NOT EXISTS
    FOR (a:CompanyAlias) REQUIRE a.name IS UNIQUE
  `);

  // Create index for fast alias lookup
  await session.run(`
    CREATE INDEX company_alias_name_index IF NOT EXISTS
    FOR (a:CompanyAlias) ON (a.name)
  `);

  // Seed company aliases
  for (const alias of companyAliases) {
    await session.run(`
      MATCH (c:Company {id: $companyId})
      MERGE (a:CompanyAlias {name: $name})
      ON CREATE SET a.id = randomUUID()
      MERGE (a)-[:ALIAS_FOR]->(c)
    `, {
      name: alias.name,
      companyId: alias.companyId,
    });
  }

  console.log(`[Seed] Created ${companyAliases.length} company aliases`);
}
