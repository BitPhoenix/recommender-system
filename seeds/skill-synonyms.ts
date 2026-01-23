import { Session } from 'neo4j-driver';

interface SkillSynonym {
  name: string;       // The synonym (lowercase for consistent matching)
  skillId: string;    // The canonical skill ID it maps to
}

/*
 * Skill synonyms map common variations to canonical skill IDs.
 * Stored as separate nodes for indexable lookups.
 */
export const skillSynonyms: SkillSynonym[] = [
  // JavaScript ecosystem
  { name: "react.js", skillId: "skill_react" },
  { name: "reactjs", skillId: "skill_react" },
  { name: "vue.js", skillId: "skill_vue" },
  { name: "vuejs", skillId: "skill_vue" },
  { name: "node.js", skillId: "skill_nodejs" },
  { name: "nodejs", skillId: "skill_nodejs" },
  { name: "express.js", skillId: "skill_express" },
  { name: "expressjs", skillId: "skill_express" },
  { name: "next.js", skillId: "skill_nextjs" },
  { name: "nextjs", skillId: "skill_nextjs" },
  { name: "nest.js", skillId: "skill_nestjs" },
  { name: "nestjs", skillId: "skill_nestjs" },

  // Infrastructure
  { name: "k8s", skillId: "skill_kubernetes" },
  { name: "kube", skillId: "skill_kubernetes" },
  { name: "amazon web services", skillId: "skill_aws" },
  { name: "gcp", skillId: "skill_gcp" },
  { name: "google cloud", skillId: "skill_gcp" },
  { name: "google cloud platform", skillId: "skill_gcp" },

  // Databases
  { name: "postgres", skillId: "skill_postgresql" },
  { name: "psql", skillId: "skill_postgresql" },
  { name: "mongo", skillId: "skill_mongodb" },

  // Languages
  { name: "ts", skillId: "skill_typescript" },
  { name: "js", skillId: "skill_javascript" },
  { name: "golang", skillId: "skill_go" },
  { name: "python3", skillId: "skill_python" },
  { name: "py", skillId: "skill_python" },
];

/*
 * Seed skill synonyms into Neo4j.
 */
export async function seedSkillSynonyms(session: Session): Promise<void> {
  // Create unique constraint for synonym names (lowercase)
  await session.run(`
    CREATE CONSTRAINT skill_synonym_name_unique IF NOT EXISTS
    FOR (s:SkillSynonym) REQUIRE s.name IS UNIQUE
  `);

  // Create index for fast lookups
  await session.run(`
    CREATE INDEX skill_synonym_name_index IF NOT EXISTS
    FOR (s:SkillSynonym) ON (s.name)
  `);

  // Seed synonyms
  for (const synonym of skillSynonyms) {
    await session.run(`
      MATCH (skill:Skill {id: $skillId})
      MERGE (syn:SkillSynonym {name: $name})
      ON CREATE SET
        syn.id = $synonymId,
        syn.createdAt = datetime()
      MERGE (syn)-[:ALIAS_FOR]->(skill)
    `, {
      name: synonym.name.toLowerCase(),
      skillId: synonym.skillId,
      synonymId: `synonym_${synonym.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
    });
  }

  console.log(`[Seed] Created ${skillSynonyms.length} skill synonyms`);
}
