import neo4j, { Driver, Session } from 'neo4j-driver';
import * as data from './index';
import {
  businessDomains,
  businessDomainHierarchy,
  technicalDomains,
  technicalDomainHierarchy,
  technicalDomainEncompasses,
} from './domains';
import {
  skillCategories,
  skillCategoryDomainMappings,
} from './skill-categories';
import {
  engineerBusinessDomainExperience,
  engineerTechnicalDomainExperience,
} from './engineers';
import { seedSkillSynonyms } from './skill-synonyms';
import { seedCompanies, seedJobPostedByRelationships } from './companies';
import { seedResumes } from './resumes';
import { createVectorIndices } from './migrations/001-add-vector-indices';
import { addSkillVectorIndex } from './migrations/002-add-skill-vector-index';
import { addJobDescriptionVectorIndex } from './migrations/003-add-job-vector-index';
import { seedEngineerEmbeddings } from './embeddings';
import { seedSkillEmbeddings } from './skill-embeddings';
import { seedJobDescriptionEmbeddings } from './job-description-embeddings';
import {
  jobDescriptions,
  jobRequiredSkills,
  jobPreferredSkills,
  jobRequiredBusinessDomains,
  jobPreferredBusinessDomains,
  jobRequiredTechnicalDomains,
  jobPreferredTechnicalDomains,
} from './job-descriptions';

// ============================================
// CONFIGURATION
// ============================================

const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';

// Category definitions
type SeedCategory = 'skills' | 'engineers' | 'stories' | 'assessments' | 'domains' | 'jobs' | 'all';

const SEED_CATEGORIES = (process.env.SEED_CATEGORIES?.split(',') || ['all']) as SeedCategory[];

function shouldSeedCategory(category: SeedCategory): boolean {
  return SEED_CATEGORIES.includes('all') || SEED_CATEGORIES.includes(category);
}

// ============================================
// SEED FUNCTIONS
// ============================================

async function createConstraints(session: Session): Promise<void> {
  console.log('📐 Creating constraints and indexes...');
  
  const constraints = [
    'CREATE CONSTRAINT skill_id IF NOT EXISTS FOR (s:Skill) REQUIRE s.id IS UNIQUE',
    'CREATE CONSTRAINT engineer_id IF NOT EXISTS FOR (e:Engineer) REQUIRE e.id IS UNIQUE',
    'CREATE CONSTRAINT manager_id IF NOT EXISTS FOR (m:EngineeringManager) REQUIRE m.id IS UNIQUE',
    'CREATE CONSTRAINT user_skill_id IF NOT EXISTS FOR (us:UserSkill) REQUIRE us.id IS UNIQUE',
    'CREATE CONSTRAINT story_id IF NOT EXISTS FOR (s:InterviewStory) REQUIRE s.id IS UNIQUE',
    'CREATE CONSTRAINT analysis_id IF NOT EXISTS FOR (a:StoryAnalysis) REQUIRE a.id IS UNIQUE',
    'CREATE CONSTRAINT assessment_id IF NOT EXISTS FOR (a:Assessment) REQUIRE a.id IS UNIQUE',
    'CREATE CONSTRAINT question_id IF NOT EXISTS FOR (q:AssessmentQuestion) REQUIRE q.id IS UNIQUE',
    'CREATE CONSTRAINT attempt_id IF NOT EXISTS FOR (a:AssessmentAttempt) REQUIRE a.id IS UNIQUE',
    'CREATE CONSTRAINT performance_id IF NOT EXISTS FOR (p:QuestionPerformance) REQUIRE p.id IS UNIQUE',
    'CREATE CONSTRAINT certification_id IF NOT EXISTS FOR (c:Certification) REQUIRE c.id IS UNIQUE',
    // New domain model constraints
    'CREATE CONSTRAINT business_domain_id IF NOT EXISTS FOR (bd:BusinessDomain) REQUIRE bd.id IS UNIQUE',
    'CREATE CONSTRAINT technical_domain_id IF NOT EXISTS FOR (td:TechnicalDomain) REQUIRE td.id IS UNIQUE',
    'CREATE CONSTRAINT skill_category_id IF NOT EXISTS FOR (sc:SkillCategory) REQUIRE sc.id IS UNIQUE',
    // Resume and work experience constraints
    'CREATE CONSTRAINT resume_engineer_id IF NOT EXISTS FOR (r:Resume) REQUIRE r.engineerId IS UNIQUE',
    'CREATE CONSTRAINT work_experience_id IF NOT EXISTS FOR (we:WorkExperience) REQUIRE we.id IS UNIQUE',
    // Job description constraint
    'CREATE CONSTRAINT job_description_id IF NOT EXISTS FOR (j:JobDescription) REQUIRE j.id IS UNIQUE',
  ];

  for (const constraint of constraints) {
    try {
      await session.run(constraint);
    } catch (e) {
      // Constraint may already exist
    }
  }
}

async function seedSkills(session: Session): Promise<void> {
  console.log('🎯 Seeding skills...');

  for (const skill of data.skills) {
    await session.run(
      `MERGE (s:Skill {id: $id})
       ON CREATE SET
         s.name = $name,
         s.skillType = $skillType,
         s.isCategory = $isCategory,
         s.description = $description
       ON MATCH SET
         s.name = $name,
         s.skillType = $skillType,
         s.isCategory = $isCategory,
         s.description = $description`,
      {
        id: skill.id,
        name: skill.name,
        skillType: skill.skillType,
        isCategory: skill.isCategory,
        description: skill.description || null,
      }
    );
  }
  console.log(`   ✓ Seeded ${data.skills.length} skills`);
}

async function seedSkillHierarchy(session: Session): Promise<void> {
  console.log('🌳 Seeding skill hierarchy...');

  for (const rel of data.skillHierarchy) {
    await session.run(
      `MATCH (child:Skill {id: $childId})
       MATCH (parent:Skill {id: $parentId})
       MERGE (child)-[:CHILD_OF]->(parent)`,
      {
        childId: rel.childSkillId,
        parentId: rel.parentSkillId,
      }
    );
  }
  console.log(`   ✓ Seeded ${data.skillHierarchy.length} hierarchy relationships`);
}

async function cleanupRoleCategoryChildOf(session: Session): Promise<void> {
  // Remove any stale CHILD_OF relationships pointing to role categories
  // These were replaced by BELONGS_TO relationships
  console.log('🧹 Cleaning up stale CHILD_OF relationships from role categories...');

  const result = await session.run(
    `MATCH (s:Skill)-[r:CHILD_OF]->(cat:Skill)
     WHERE cat.id IN ['cat_backend', 'cat_frontend', 'cat_fullstack']
       AND s.isCategory = false
     DELETE r
     RETURN count(r) AS deleted`
  );

  const deleted = result.records[0]?.get('deleted')?.toNumber() || 0;
  if (deleted > 0) {
    console.log(`   ✓ Removed ${deleted} stale CHILD_OF relationships`);
  }
}

async function seedSkillCategoryMemberships(session: Session): Promise<void> {
  console.log('🏷️  Seeding skill category memberships...');

  for (const membership of data.skillCategoryMemberships) {
    await session.run(
      `MATCH (skill:Skill {id: $skillId})
       MATCH (category:Skill {id: $categoryId})
       MERGE (skill)-[:BELONGS_TO]->(category)`,
      {
        skillId: membership.skillId,
        categoryId: membership.categoryId,
      }
    );
  }
  console.log(`   ✓ Seeded ${data.skillCategoryMemberships.length} category membership relationships`);
}

async function seedSkillCorrelations(session: Session): Promise<void> {
  console.log('🔗 Seeding skill correlations...');

  for (const corr of data.skillCorrelations) {
    await session.run(
      `MATCH (from:Skill {id: $fromId})
       MATCH (to:Skill {id: $toId})
       MERGE (from)-[r:CORRELATES_WITH]->(to)
       ON CREATE SET r.strength = $strength, r.correlationType = $correlationType
       ON MATCH SET r.strength = $strength, r.correlationType = $correlationType`,
      {
        fromId: corr.fromSkillId,
        toId: corr.toSkillId,
        strength: corr.strength,
        correlationType: corr.correlationType,
      }
    );
  }
  console.log(`   ✓ Seeded ${data.skillCorrelations.length} correlation relationships`);
}

async function seedEngineers(session: Session): Promise<void> {
  console.log('👩‍💻 Seeding engineers...');

  for (const eng of data.engineers) {
    await session.run(
      `MERGE (e:Engineer {id: $id})
       ON CREATE SET
         e.name = $name, e.email = $email, e.headline = $headline,
         e.salary = $salary, e.yearsExperience = $yearsExperience,
         e.startTimeline = $startTimeline, e.timezone = $timezone,
         e.createdAt = datetime($createdAt)
       ON MATCH SET
         e.name = $name, e.email = $email, e.headline = $headline,
         e.salary = $salary, e.yearsExperience = $yearsExperience,
         e.startTimeline = $startTimeline, e.timezone = $timezone`,
      eng
    );
  }
  console.log(`   ✓ Seeded ${data.engineers.length} engineers`);
}

async function seedManagers(session: Session): Promise<void> {
  console.log('👔 Seeding engineering managers...');

  for (const mgr of data.managers) {
    await session.run(
      `MERGE (m:EngineeringManager {id: $id})
       ON CREATE SET
         m.name = $name, m.email = $email, m.company = $company,
         m.title = $title, m.createdAt = datetime($createdAt)
       ON MATCH SET
         m.name = $name, m.email = $email, m.company = $company, m.title = $title`,
      mgr
    );
  }
  console.log(`   ✓ Seeded ${data.managers.length} managers`);
}

async function cleanupOldEngineerSkillNodes(session: Session): Promise<void> {
  console.log('🧹 Cleaning up old EngineerSkill nodes...');

  const result = await session.run(
    `MATCH (es:EngineerSkill)
     DETACH DELETE es
     RETURN count(es) AS deleted`
  );

  const deleted = result.records[0]?.get('deleted')?.toNumber() || 0;
  if (deleted > 0) {
    console.log(`   ✓ Removed ${deleted} old EngineerSkill nodes`);
  }

  // Drop the old constraint if it exists
  try {
    await session.run('DROP CONSTRAINT engineer_skill_id IF EXISTS');
    console.log('   ✓ Dropped old engineer_skill_id constraint');
  } catch {
    // Constraint may not exist
  }
}

async function seedUserSkills(session: Session): Promise<void> {
  console.log('💪 Seeding user skills...');

  for (const us of data.userSkills) {
    await session.run(
      `MATCH (e:Engineer {id: $engineerId})
       MATCH (s:Skill {id: $skillId})
       MERGE (us:UserSkill {id: $id})
       ON CREATE SET
         us.proficiencyLevel = $proficiencyLevel, us.yearsUsed = $yearsUsed,
         us.confidenceScore = $confidenceScore, us.lastValidated = datetime($lastValidated)
       ON MATCH SET
         us.proficiencyLevel = $proficiencyLevel, us.yearsUsed = $yearsUsed,
         us.confidenceScore = $confidenceScore, us.lastValidated = datetime($lastValidated)
       MERGE (e)-[:HAS]->(us)
       MERGE (us)-[:FOR]->(s)`,
      us
    );
  }
  console.log(`   ✓ Seeded ${data.userSkills.length} user skill records`);
}

async function seedInterviewStories(session: Session): Promise<void> {
  console.log('📖 Seeding interview stories...');

  for (const story of data.interviewStories) {
    await session.run(
      `MATCH (e:Engineer {id: $engineerId})
       MERGE (s:InterviewStory {id: $id})
       ON CREATE SET
         s.interviewId = $interviewId, s.questionPrompt = $questionPrompt,
         s.situation = $situation, s.task = $task, s.action = $action,
         s.result = $result, s.durationSeconds = $durationSeconds,
         s.createdAt = datetime($createdAt)
       ON MATCH SET
         s.interviewId = $interviewId, s.questionPrompt = $questionPrompt,
         s.situation = $situation, s.task = $task, s.action = $action,
         s.result = $result, s.durationSeconds = $durationSeconds
       MERGE (e)-[:TOLD]->(s)`,
      story
    );
  }
  console.log(`   ✓ Seeded ${data.interviewStories.length} interview stories`);
}

async function seedStoryAnalyses(session: Session): Promise<void> {
  console.log('🔍 Seeding story analyses...');

  for (const analysis of data.storyAnalyses) {
    await session.run(
      `MATCH (s:InterviewStory {id: $storyId})
       MERGE (a:StoryAnalysis {id: $id})
       ON CREATE SET
         a.analyzerModel = $analyzerModel, a.analyzedAt = datetime($analyzedAt),
         a.clarityScore = $clarityScore, a.impactScore = $impactScore,
         a.ownershipScore = $ownershipScore, a.overallScore = $overallScore,
         a.reasoning = $reasoning, a.flags = $flags
       ON MATCH SET
         a.analyzerModel = $analyzerModel, a.clarityScore = $clarityScore,
         a.impactScore = $impactScore, a.ownershipScore = $ownershipScore,
         a.overallScore = $overallScore, a.reasoning = $reasoning, a.flags = $flags
       MERGE (s)-[:ANALYZED_BY]->(a)`,
      analysis
    );
  }
  console.log(`   ✓ Seeded ${data.storyAnalyses.length} story analyses`);
}

async function seedStoryDemonstrations(session: Session): Promise<void> {
  console.log('✨ Seeding story skill demonstrations...');

  for (const demo of data.storyDemonstrations) {
    await session.run(
      `MATCH (s:InterviewStory {id: $storyId})
       MATCH (skill:Skill {id: $skillId})
       MERGE (s)-[r:DEMONSTRATES]->(skill)
       ON CREATE SET r.strength = $strength, r.notes = $notes
       ON MATCH SET r.strength = $strength, r.notes = $notes`,
      demo
    );
  }
  console.log(`   ✓ Seeded ${data.storyDemonstrations.length} demonstration relationships`);
}

async function seedAssessments(session: Session): Promise<void> {
  console.log('📝 Seeding assessments...');

  for (const assess of data.assessments) {
    await session.run(
      `MERGE (a:Assessment {id: $id})
       ON CREATE SET
         a.name = $name, a.assessmentType = $assessmentType,
         a.description = $description, a.totalQuestions = $totalQuestions,
         a.createdAt = datetime($createdAt)
       ON MATCH SET
         a.name = $name, a.assessmentType = $assessmentType,
         a.description = $description, a.totalQuestions = $totalQuestions`,
      assess
    );
  }
  console.log(`   ✓ Seeded ${data.assessments.length} assessments`);
}

async function seedAssessmentQuestions(session: Session): Promise<void> {
  console.log('❓ Seeding assessment questions...');

  for (const q of data.assessmentQuestions) {
    await session.run(
      `MATCH (a:Assessment {id: $assessmentId})
       MERGE (q:AssessmentQuestion {id: $id})
       ON CREATE SET
         q.questionNumber = $questionNumber, q.summary = $summary,
         q.maxScore = $maxScore, q.evaluationCriteria = $evaluationCriteria
       ON MATCH SET
         q.questionNumber = $questionNumber, q.summary = $summary,
         q.maxScore = $maxScore, q.evaluationCriteria = $evaluationCriteria
       MERGE (a)-[:CONTAINS]->(q)`,
      q
    );
  }
  console.log(`   ✓ Seeded ${data.assessmentQuestions.length} questions`);
}

async function seedQuestionSkillTests(session: Session): Promise<void> {
  console.log('🎯 Seeding question skill tests...');

  for (const test of data.questionSkillTests) {
    await session.run(
      `MATCH (q:AssessmentQuestion {id: $questionId})
       MATCH (s:Skill {id: $skillId})
       MERGE (q)-[r:TESTS]->(s)
       ON CREATE SET r.weight = $weight
       ON MATCH SET r.weight = $weight`,
      test
    );
  }
  console.log(`   ✓ Seeded ${data.questionSkillTests.length} skill test relationships`);
}

async function seedAssessmentAttempts(session: Session): Promise<void> {
  console.log('📋 Seeding assessment attempts...');

  for (const attempt of data.assessmentAttempts) {
    await session.run(
      `MATCH (e:Engineer {id: $engineerId})
       MATCH (a:Assessment {id: $assessmentId})
       MERGE (att:AssessmentAttempt {id: $id})
       ON CREATE SET
         att.startedAt = datetime($startedAt), att.completedAt = datetime($completedAt),
         att.overallScore = $overallScore, att.overallFeedback = $overallFeedback
       ON MATCH SET
         att.startedAt = datetime($startedAt), att.completedAt = datetime($completedAt),
         att.overallScore = $overallScore, att.overallFeedback = $overallFeedback
       MERGE (e)-[:ATTEMPTED]->(att)
       MERGE (att)-[:OF]->(a)`,
      attempt
    );
  }
  console.log(`   ✓ Seeded ${data.assessmentAttempts.length} assessment attempts`);
}

async function seedQuestionPerformances(session: Session): Promise<void> {
  console.log('📊 Seeding question performances...');

  for (const perf of data.questionPerformances) {
    await session.run(
      `MATCH (att:AssessmentAttempt {id: $attemptId})
       MATCH (q:AssessmentQuestion {id: $questionId})
       MERGE (p:QuestionPerformance {id: $id})
       ON CREATE SET
         p.score = $score, p.technicalDepth = $technicalDepth,
         p.feedback = $feedback, p.evaluatedAt = datetime($evaluatedAt)
       ON MATCH SET
         p.score = $score, p.technicalDepth = $technicalDepth,
         p.feedback = $feedback, p.evaluatedAt = datetime($evaluatedAt)
       MERGE (att)-[:INCLUDES]->(p)
       MERGE (p)-[:FOR_QUESTION]->(q)`,
      perf
    );
  }
  console.log(`   ✓ Seeded ${data.questionPerformances.length} question performances`);
}

async function seedCertifications(session: Session): Promise<void> {
  console.log('🏆 Seeding certifications...');

  for (const cert of data.certifications) {
    await session.run(
      `MERGE (c:Certification {id: $id})
       ON CREATE SET
         c.name = $name, c.issuingOrg = $issuingOrg,
         c.issueDate = datetime($issueDate), c.expiryDate = datetime($expiryDate),
         c.verificationUrl = $verificationUrl, c.verified = $verified
       ON MATCH SET
         c.name = $name, c.issuingOrg = $issuingOrg,
         c.issueDate = datetime($issueDate), c.expiryDate = datetime($expiryDate),
         c.verificationUrl = $verificationUrl, c.verified = $verified`,
      cert
    );
  }
  console.log(`   ✓ Seeded ${data.certifications.length} certifications`);
}

async function seedCertificationValidations(session: Session): Promise<void> {
  console.log('✅ Seeding certification skill validations...');

  for (const val of data.certificationValidations) {
    await session.run(
      `MATCH (c:Certification {id: $certificationId})
       MATCH (s:Skill {id: $skillId})
       MERGE (c)-[:VALIDATES]->(s)`,
      val
    );
  }
  console.log(`   ✓ Seeded ${data.certificationValidations.length} validation relationships`);
}

async function seedEngineerCertifications(session: Session): Promise<void> {
  console.log('🎖️  Seeding engineer certifications...');

  for (const ec of data.engineerCertifications) {
    await session.run(
      `MATCH (e:Engineer {id: $engineerId})
       MATCH (c:Certification {id: $certificationId})
       MERGE (e)-[:HOLDS]->(c)`,
      ec
    );
  }
  console.log(`   ✓ Seeded ${data.engineerCertifications.length} engineer certification relationships`);
}

async function seedSkillEvidence(session: Session): Promise<void> {
  console.log('🔗 Seeding skill evidence links...');

  for (const ev of data.skillEvidence) {
    let evidenceLabel: string;
    switch (ev.evidenceType) {
      case 'story':
        evidenceLabel = 'InterviewStory';
        break;
      case 'performance':
        evidenceLabel = 'QuestionPerformance';
        break;
      case 'certification':
        evidenceLabel = 'Certification';
        break;
      default:
        continue;
    }

    await session.run(
      `MATCH (us:UserSkill {id: $userSkillId})
       MATCH (ev:${evidenceLabel} {id: $evidenceId})
       MERGE (us)-[r:EVIDENCED_BY]->(ev)
       ON CREATE SET r.relevanceScore = $relevanceScore, r.isPrimary = $isPrimary
       ON MATCH SET r.relevanceScore = $relevanceScore, r.isPrimary = $isPrimary`,
      {
        userSkillId: ev.userSkillId,
        evidenceId: ev.evidenceId,
        relevanceScore: ev.relevanceScore,
        isPrimary: ev.isPrimary,
      }
    );
  }
  console.log(`   ✓ Seeded ${data.skillEvidence.length} evidence relationships`);
}

// ============================================
// DOMAIN MODEL SEEDING
// ============================================

async function cleanupOldDomainData(session: Session): Promise<void> {
  console.log('🧹 Cleaning up old domain_knowledge skills and role categories...');

  // Remove UserSkill nodes for domain_knowledge skills
  const usResult = await session.run(`
    MATCH (us:UserSkill)-[:FOR]->(s:Skill {skillType: 'domain_knowledge'})
    DETACH DELETE us
    RETURN count(us) AS deleted
  `);
  const usDeleted = usResult.records[0]?.get('deleted')?.toNumber() || 0;
  if (usDeleted > 0) {
    console.log(`   ✓ Removed ${usDeleted} domain_knowledge UserSkill nodes`);
  }

  // Remove domain_knowledge skills
  const skillResult = await session.run(`
    MATCH (s:Skill {skillType: 'domain_knowledge'})
    DETACH DELETE s
    RETURN count(s) AS deleted
  `);
  const skillDeleted = skillResult.records[0]?.get('deleted')?.toNumber() || 0;
  if (skillDeleted > 0) {
    console.log(`   ✓ Removed ${skillDeleted} domain_knowledge Skill nodes`);
  }

  // Remove role-based categories (cat_backend, cat_frontend, cat_fullstack)
  const roleResult = await session.run(`
    MATCH (s:Skill)
    WHERE s.id IN ['cat_backend', 'cat_frontend', 'cat_fullstack']
    DETACH DELETE s
    RETURN count(s) AS deleted
  `);
  const roleDeleted = roleResult.records[0]?.get('deleted')?.toNumber() || 0;
  if (roleDeleted > 0) {
    console.log(`   ✓ Removed ${roleDeleted} role-based category nodes`);
  }

  // Remove old BELONGS_TO relationships from skills to category Skill nodes
  const belongsResult = await session.run(`
    MATCH (skill:Skill)-[r:BELONGS_TO]->(cat:Skill {isCategory: true})
    DELETE r
    RETURN count(r) AS deleted
  `);
  const belongsDeleted = belongsResult.records[0]?.get('deleted')?.toNumber() || 0;
  if (belongsDeleted > 0) {
    console.log(`   ✓ Removed ${belongsDeleted} old Skill→Skill BELONGS_TO relationships`);
  }

  // Remove old category Skill nodes (cat_languages, cat_databases, etc.)
  const catResult = await session.run(`
    MATCH (s:Skill {isCategory: true})
    DETACH DELETE s
    RETURN count(s) AS deleted
  `);
  const catDeleted = catResult.records[0]?.get('deleted')?.toNumber() || 0;
  if (catDeleted > 0) {
    console.log(`   ✓ Removed ${catDeleted} category Skill nodes`);
  }
}

async function seedBusinessDomains(session: Session): Promise<void> {
  console.log('🏢 Seeding business domains...');
  for (const domain of businessDomains) {
    await session.run(
      `MERGE (d:BusinessDomain {id: $id})
       ON CREATE SET d.name = $name, d.description = $description
       ON MATCH SET d.name = $name, d.description = $description`,
      { ...domain, description: domain.description || null }
    );
  }
  console.log(`   ✓ Seeded ${businessDomains.length} business domains`);
}

async function seedBusinessDomainHierarchy(session: Session): Promise<void> {
  console.log('🌳 Seeding business domain hierarchy (CHILD_OF)...');
  for (const rel of businessDomainHierarchy) {
    await session.run(
      `MATCH (child:BusinessDomain {id: $childDomainId})
       MATCH (parent:BusinessDomain {id: $parentDomainId})
       MERGE (child)-[:CHILD_OF]->(parent)`,
      rel
    );
  }
  console.log(`   ✓ Seeded ${businessDomainHierarchy.length} CHILD_OF relationships`);
}

async function seedTechnicalDomains(session: Session): Promise<void> {
  console.log('⚙️  Seeding technical domains...');
  for (const domain of technicalDomains) {
    await session.run(
      `MERGE (d:TechnicalDomain {id: $id})
       ON CREATE SET d.name = $name, d.description = $description, d.isComposite = $isComposite
       ON MATCH SET d.name = $name, d.description = $description, d.isComposite = $isComposite`,
      { ...domain, description: domain.description || null, isComposite: domain.isComposite ?? false }
    );
  }
  console.log(`   ✓ Seeded ${technicalDomains.length} technical domains`);
}

async function seedTechnicalDomainHierarchy(session: Session): Promise<void> {
  console.log('🌳 Seeding technical domain hierarchy (CHILD_OF)...');
  for (const rel of technicalDomainHierarchy) {
    await session.run(
      `MATCH (child:TechnicalDomain {id: $childDomainId})
       MATCH (parent:TechnicalDomain {id: $parentDomainId})
       MERGE (child)-[:CHILD_OF]->(parent)`,
      rel
    );
  }
  console.log(`   ✓ Seeded ${technicalDomainHierarchy.length} CHILD_OF relationships`);
}

async function seedTechnicalDomainEncompasses(session: Session): Promise<void> {
  console.log('🔗 Seeding technical domain encompasses relationships...');
  for (const rel of technicalDomainEncompasses) {
    await session.run(
      `MATCH (composite:TechnicalDomain {id: $compositeDomainId})
       MATCH (encompassed:TechnicalDomain {id: $encompassedDomainId})
       MERGE (composite)-[:ENCOMPASSES]->(encompassed)`,
      rel
    );
  }
  console.log(`   ✓ Seeded ${technicalDomainEncompasses.length} ENCOMPASSES relationships`);
}

async function seedSkillCategories(session: Session): Promise<void> {
  console.log('📁 Seeding skill categories...');
  for (const category of skillCategories) {
    await session.run(
      `MERGE (sc:SkillCategory {id: $id})
       ON CREATE SET sc.name = $name, sc.description = $description
       ON MATCH SET sc.name = $name, sc.description = $description`,
      { ...category, description: category.description || null }
    );
  }
  console.log(`   ✓ Seeded ${skillCategories.length} skill categories`);
}

async function seedSkillToSkillCategoryMemberships(session: Session): Promise<void> {
  console.log('🏷️  Seeding skill to skill category memberships...');
  for (const membership of data.skillCategoryMemberships) {
    await session.run(
      `MATCH (s:Skill {id: $skillId})
       MATCH (sc:SkillCategory {id: $categoryId})
       MERGE (s)-[:BELONGS_TO]->(sc)`,
      membership
    );
  }
  console.log(`   ✓ Seeded ${data.skillCategoryMemberships.length} Skill→SkillCategory relationships`);
}

async function seedSkillCategoryDomainMappings(session: Session): Promise<void> {
  console.log('🗺️  Seeding skill category to technical domain mappings...');
  for (const mapping of skillCategoryDomainMappings) {
    await session.run(
      `MATCH (sc:SkillCategory {id: $skillCategoryId})
       MATCH (td:TechnicalDomain {id: $technicalDomainId})
       MERGE (sc)-[:BELONGS_TO]->(td)`,
      mapping
    );
  }
  console.log(`   ✓ Seeded ${skillCategoryDomainMappings.length} SkillCategory→TechnicalDomain relationships`);
}

async function seedEngineerBusinessDomainExperience(session: Session): Promise<void> {
  console.log('💼 Seeding engineer business domain experience...');
  for (const exp of engineerBusinessDomainExperience) {
    await session.run(
      `MATCH (e:Engineer {id: $engineerId})
       MATCH (d:BusinessDomain {id: $businessDomainId})
       MERGE (e)-[r:HAS_EXPERIENCE_IN]->(d)
       ON CREATE SET r.years = $years
       ON MATCH SET r.years = $years`,
      exp
    );
  }
  console.log(`   ✓ Seeded ${engineerBusinessDomainExperience.length} Engineer→BusinessDomain relationships`);
}

async function seedEngineerTechnicalDomainExperience(session: Session): Promise<void> {
  console.log('🔧 Seeding engineer technical domain experience...');
  for (const exp of engineerTechnicalDomainExperience) {
    await session.run(
      `MATCH (e:Engineer {id: $engineerId})
       MATCH (d:TechnicalDomain {id: $technicalDomainId})
       MERGE (e)-[r:HAS_EXPERIENCE_IN]->(d)
       ON CREATE SET r.years = $years
       ON MATCH SET r.years = $years`,
      exp
    );
  }
  console.log(`   ✓ Seeded ${engineerTechnicalDomainExperience.length} Engineer→TechnicalDomain relationships`);
}

// ============================================
// JOB DESCRIPTION SEEDING
// ============================================

async function seedJobDescriptions(session: Session): Promise<void> {
  console.log('📋 Seeding job descriptions...');

  for (const job of jobDescriptions) {
    await session.run(
      `MERGE (j:JobDescription {id: $id})
       ON CREATE SET
         j.title = $title,
         j.description = $description,
         j.companyName = $companyName,
         j.location = $location,
         j.seniority = $seniority,
         j.minBudget = $minBudget,
         j.maxBudget = $maxBudget,
         j.stretchBudget = $stretchBudget,
         j.startTimeline = $startTimeline,
         j.timezone = $timezone,
         j.teamFocus = $teamFocus,
         j.createdAt = datetime($createdAt)
       ON MATCH SET
         j.title = $title,
         j.description = $description,
         j.companyName = $companyName,
         j.location = $location,
         j.seniority = $seniority,
         j.minBudget = $minBudget,
         j.maxBudget = $maxBudget,
         j.stretchBudget = $stretchBudget,
         j.startTimeline = $startTimeline,
         j.timezone = $timezone,
         j.teamFocus = $teamFocus,
         j.updatedAt = datetime()`,
      {
        ...job,
        stretchBudget: job.stretchBudget ?? null,
        teamFocus: job.teamFocus ?? null,
      }
    );
  }
  console.log(`   ✓ Seeded ${jobDescriptions.length} job descriptions`);
}

async function seedJobRequiredSkills(session: Session): Promise<void> {
  console.log('🎯 Seeding job required skills...');

  for (const req of jobRequiredSkills) {
    await session.run(
      `MATCH (j:JobDescription {id: $jobId})
       MATCH (s:Skill {id: $skillId})
       MERGE (j)-[r:REQUIRES_SKILL]->(s)
       ON CREATE SET r.minProficiency = $minProficiency
       ON MATCH SET r.minProficiency = $minProficiency`,
      {
        jobId: req.jobId,
        skillId: req.skillId,
        minProficiency: req.minProficiency ?? null,
      }
    );
  }
  console.log(`   ✓ Seeded ${jobRequiredSkills.length} required skill relationships`);
}

async function seedJobPreferredSkills(session: Session): Promise<void> {
  console.log('✨ Seeding job preferred skills...');

  for (const pref of jobPreferredSkills) {
    await session.run(
      `MATCH (j:JobDescription {id: $jobId})
       MATCH (s:Skill {id: $skillId})
       MERGE (j)-[r:PREFERS_SKILL]->(s)
       ON CREATE SET r.minProficiency = $minProficiency
       ON MATCH SET r.minProficiency = $minProficiency`,
      {
        jobId: pref.jobId,
        skillId: pref.skillId,
        minProficiency: pref.minProficiency ?? null,
      }
    );
  }
  console.log(`   ✓ Seeded ${jobPreferredSkills.length} preferred skill relationships`);
}

async function seedJobRequiredBusinessDomains(session: Session): Promise<void> {
  console.log('🏢 Seeding job required business domains...');

  for (const req of jobRequiredBusinessDomains) {
    await session.run(
      `MATCH (j:JobDescription {id: $jobId})
       MATCH (d:BusinessDomain {id: $domainId})
       MERGE (j)-[r:REQUIRES_BUSINESS_DOMAIN]->(d)
       ON CREATE SET r.minYears = $minYears
       ON MATCH SET r.minYears = $minYears`,
      {
        jobId: req.jobId,
        domainId: req.businessDomainId,
        minYears: req.minYears,
      }
    );
  }
  console.log(`   ✓ Seeded ${jobRequiredBusinessDomains.length} required business domain relationships`);
}

async function seedJobPreferredBusinessDomains(session: Session): Promise<void> {
  console.log('💼 Seeding job preferred business domains...');

  for (const pref of jobPreferredBusinessDomains) {
    await session.run(
      `MATCH (j:JobDescription {id: $jobId})
       MATCH (d:BusinessDomain {id: $domainId})
       MERGE (j)-[r:PREFERS_BUSINESS_DOMAIN]->(d)
       ON CREATE SET r.minYears = $minYears
       ON MATCH SET r.minYears = $minYears`,
      {
        jobId: pref.jobId,
        domainId: pref.businessDomainId,
        minYears: pref.minYears ?? null,
      }
    );
  }
  console.log(`   ✓ Seeded ${jobPreferredBusinessDomains.length} preferred business domain relationships`);
}

async function seedJobRequiredTechnicalDomains(session: Session): Promise<void> {
  console.log('⚙️  Seeding job required technical domains...');

  for (const req of jobRequiredTechnicalDomains) {
    await session.run(
      `MATCH (j:JobDescription {id: $jobId})
       MATCH (d:TechnicalDomain {id: $domainId})
       MERGE (j)-[:REQUIRES_TECHNICAL_DOMAIN]->(d)`,
      {
        jobId: req.jobId,
        domainId: req.technicalDomainId,
      }
    );
  }
  console.log(`   ✓ Seeded ${jobRequiredTechnicalDomains.length} required technical domain relationships`);
}

async function seedJobPreferredTechnicalDomains(session: Session): Promise<void> {
  console.log('🔧 Seeding job preferred technical domains...');

  for (const pref of jobPreferredTechnicalDomains) {
    await session.run(
      `MATCH (j:JobDescription {id: $jobId})
       MATCH (d:TechnicalDomain {id: $domainId})
       MERGE (j)-[:PREFERS_TECHNICAL_DOMAIN]->(d)`,
      {
        jobId: pref.jobId,
        domainId: pref.technicalDomainId,
      }
    );
  }
  console.log(`   ✓ Seeded ${jobPreferredTechnicalDomains.length} preferred technical domain relationships`);
}

// ============================================
// MAIN
// ============================================

async function seed(): Promise<void> {
  console.log('Starting Neo4j seed process...\n');
  console.log(`   URI: ${NEO4J_URI}`);
  console.log(`   User: ${NEO4J_USER}`);
  console.log(`   Categories: ${SEED_CATEGORIES.join(', ')}\n`);

  const driver: Driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
  );

  const session: Session = driver.session();

  try {
    await createConstraints(session);

    if (shouldSeedCategory('skills')) {
      await seedSkills(session);
      await seedSkillHierarchy(session);
      await cleanupRoleCategoryChildOf(session);
      // Note: Skill→SkillCategory memberships are seeded after domains
      await seedSkillCorrelations(session);
      // Seed skill synonyms for fuzzy matching
      await seedSkillSynonyms(session);
      // Seed well-known companies and aliases
      await seedCompanies(session);
    }

    if (shouldSeedCategory('domains')) {
      // Clean up old domain model data first
      await cleanupOldDomainData(session);

      // Seed new domain nodes
      await seedBusinessDomains(session);
      await seedBusinessDomainHierarchy(session);
      await seedTechnicalDomains(session);
      await seedTechnicalDomainHierarchy(session);
      await seedTechnicalDomainEncompasses(session);

      // Seed skill categories and their mappings
      await seedSkillCategories(session);
      await seedSkillToSkillCategoryMemberships(session);
      await seedSkillCategoryDomainMappings(session);
    }

    if (shouldSeedCategory('engineers')) {
      await cleanupOldEngineerSkillNodes(session);
      await seedEngineers(session);
      await seedManagers(session);
      await seedUserSkills(session);

      // Seed engineer domain experience (requires domains to be seeded)
      if (shouldSeedCategory('domains')) {
        await seedEngineerBusinessDomainExperience(session);
        await seedEngineerTechnicalDomainExperience(session);
      }

      // Seed resumes and work experiences (requires engineers and skills to be seeded)
      await seedResumes(session);
    }

    if (shouldSeedCategory('stories')) {
      await seedInterviewStories(session);
      await seedStoryAnalyses(session);
      await seedStoryDemonstrations(session);
    }

    if (shouldSeedCategory('assessments')) {
      await seedAssessments(session);
      await seedAssessmentQuestions(session);
      await seedQuestionSkillTests(session);
      await seedAssessmentAttempts(session);
      await seedQuestionPerformances(session);
      await seedCertifications(session);
      await seedCertificationValidations(session);
      await seedEngineerCertifications(session);
      await seedSkillEvidence(session);
    }

    if (shouldSeedCategory('jobs')) {
      // Jobs require skills and domains to be seeded first
      await seedJobDescriptions(session);
      await seedJobRequiredSkills(session);
      await seedJobPreferredSkills(session);
      await seedJobRequiredBusinessDomains(session);
      await seedJobPreferredBusinessDomains(session);
      await seedJobRequiredTechnicalDomains(session);
      await seedJobPreferredTechnicalDomains(session);
      // Create POSTED_BY relationships (requires companies to be seeded)
      await seedJobPostedByRelationships(session);
    }

    // Run migrations
    await createVectorIndices(session);
    await addSkillVectorIndex(session);
    await addJobDescriptionVectorIndex(session);

    // Generate embeddings (requires migrations to be run first)
    await seedEngineerEmbeddings(session);
    await seedSkillEmbeddings(session);
    await seedJobDescriptionEmbeddings(session);

    console.log('\nSeed completed successfully!');

    const result = await session.run(`
      MATCH (n)
      RETURN labels(n)[0] as label, count(n) as count
      ORDER BY count DESC
    `);

    console.log('\nDatabase summary:');
    result.records.forEach(record => {
      console.log(`   ${record.get('label')}: ${record.get('count')}`);
    });

  } catch (error) {
    console.error('Seed failed:', error);
    throw error;
  } finally {
    await session.close();
    await driver.close();
  }
}

// Run if called directly
seed().catch(console.error);
