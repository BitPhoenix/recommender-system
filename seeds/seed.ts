import neo4j, { Driver, Session } from 'neo4j-driver';
import * as data from './index';

// ============================================
// CONFIGURATION
// ============================================

const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';

// Category definitions
type SeedCategory = 'skills' | 'engineers' | 'stories' | 'assessments' | 'all';

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
    'CREATE CONSTRAINT engineer_skill_id IF NOT EXISTS FOR (es:EngineerSkill) REQUIRE es.id IS UNIQUE',
    'CREATE CONSTRAINT story_id IF NOT EXISTS FOR (s:InterviewStory) REQUIRE s.id IS UNIQUE',
    'CREATE CONSTRAINT analysis_id IF NOT EXISTS FOR (a:StoryAnalysis) REQUIRE a.id IS UNIQUE',
    'CREATE CONSTRAINT assessment_id IF NOT EXISTS FOR (a:Assessment) REQUIRE a.id IS UNIQUE',
    'CREATE CONSTRAINT question_id IF NOT EXISTS FOR (q:AssessmentQuestion) REQUIRE q.id IS UNIQUE',
    'CREATE CONSTRAINT attempt_id IF NOT EXISTS FOR (a:AssessmentAttempt) REQUIRE a.id IS UNIQUE',
    'CREATE CONSTRAINT performance_id IF NOT EXISTS FOR (p:QuestionPerformance) REQUIRE p.id IS UNIQUE',
    'CREATE CONSTRAINT certification_id IF NOT EXISTS FOR (c:Certification) REQUIRE c.id IS UNIQUE',
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
         e.availability = $availability, e.timezone = $timezone,
         e.createdAt = datetime($createdAt)
       ON MATCH SET
         e.name = $name, e.email = $email, e.headline = $headline,
         e.salary = $salary, e.yearsExperience = $yearsExperience,
         e.availability = $availability, e.timezone = $timezone`,
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

async function seedEngineerSkills(session: Session): Promise<void> {
  console.log('💪 Seeding engineer skills...');

  for (const es of data.engineerSkills) {
    await session.run(
      `MATCH (e:Engineer {id: $engineerId})
       MATCH (s:Skill {id: $skillId})
       MERGE (es:EngineerSkill {id: $id})
       ON CREATE SET
         es.proficiencyLevel = $proficiencyLevel, es.yearsUsed = $yearsUsed,
         es.confidenceScore = $confidenceScore, es.lastValidated = datetime($lastValidated)
       ON MATCH SET
         es.proficiencyLevel = $proficiencyLevel, es.yearsUsed = $yearsUsed,
         es.confidenceScore = $confidenceScore, es.lastValidated = datetime($lastValidated)
       MERGE (e)-[:HAS]->(es)
       MERGE (es)-[:FOR]->(s)`,
      es
    );
  }
  console.log(`   ✓ Seeded ${data.engineerSkills.length} engineer skill records`);
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
      `MATCH (es:EngineerSkill {id: $engineerSkillId})
       MATCH (ev:${evidenceLabel} {id: $evidenceId})
       MERGE (es)-[r:EVIDENCED_BY]->(ev)
       ON CREATE SET r.relevanceScore = $relevanceScore, r.isPrimary = $isPrimary
       ON MATCH SET r.relevanceScore = $relevanceScore, r.isPrimary = $isPrimary`,
      {
        engineerSkillId: ev.engineerSkillId,
        evidenceId: ev.evidenceId,
        relevanceScore: ev.relevanceScore,
        isPrimary: ev.isPrimary,
      }
    );
  }
  console.log(`   ✓ Seeded ${data.skillEvidence.length} evidence relationships`);
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
      await seedSkillCategoryMemberships(session);
      await seedSkillCorrelations(session);
    }

    if (shouldSeedCategory('engineers')) {
      await seedEngineers(session);
      await seedManagers(session);
      await seedEngineerSkills(session);
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
