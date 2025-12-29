import neo4j, { Driver, Session } from 'neo4j-driver';
import * as data from './data';

// ============================================
// CONFIGURATION
// ============================================

const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';

// ============================================
// SEED FUNCTIONS
// ============================================

async function clearDatabase(session: Session): Promise<void> {
  console.log('🗑️  Clearing existing data...');
  await session.run('MATCH (n) DETACH DELETE n');
}

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
      `CREATE (s:Skill {
        id: $id,
        name: $name,
        skillType: $skillType,
        isCategory: $isCategory,
        description: $description
      })`,
      {
        id: skill.id,
        name: skill.name,
        skillType: skill.skillType,
        isCategory: skill.isCategory,
        description: skill.description || null,
      }
    );
  }
  console.log(`   ✓ Created ${data.skills.length} skills`);
}

async function seedSkillHierarchy(session: Session): Promise<void> {
  console.log('🌳 Seeding skill hierarchy...');
  
  for (const rel of data.skillHierarchy) {
    await session.run(
      `MATCH (child:Skill {id: $childId})
       MATCH (parent:Skill {id: $parentId})
       CREATE (child)-[:CHILD_OF]->(parent)`,
      {
        childId: rel.childSkillId,
        parentId: rel.parentSkillId,
      }
    );
  }
  console.log(`   ✓ Created ${data.skillHierarchy.length} hierarchy relationships`);
}

async function seedSkillCorrelations(session: Session): Promise<void> {
  console.log('🔗 Seeding skill correlations...');
  
  for (const corr of data.skillCorrelations) {
    await session.run(
      `MATCH (from:Skill {id: $fromId})
       MATCH (to:Skill {id: $toId})
       CREATE (from)-[:CORRELATES_WITH {
         strength: $strength,
         correlationType: $correlationType
       }]->(to)`,
      {
        fromId: corr.fromSkillId,
        toId: corr.toSkillId,
        strength: corr.strength,
        correlationType: corr.correlationType,
      }
    );
  }
  console.log(`   ✓ Created ${data.skillCorrelations.length} correlation relationships`);
}

async function seedEngineers(session: Session): Promise<void> {
  console.log('👩‍💻 Seeding engineers...');
  
  for (const eng of data.engineers) {
    await session.run(
      `CREATE (e:Engineer {
        id: $id,
        name: $name,
        email: $email,
        headline: $headline,
        hourlyRate: $hourlyRate,
        yearsExperience: $yearsExperience,
        availability: $availability,
        timezone: $timezone,
        createdAt: datetime($createdAt)
      })`,
      eng
    );
  }
  console.log(`   ✓ Created ${data.engineers.length} engineers`);
}

async function seedManagers(session: Session): Promise<void> {
  console.log('👔 Seeding engineering managers...');
  
  for (const mgr of data.managers) {
    await session.run(
      `CREATE (m:EngineeringManager {
        id: $id,
        name: $name,
        email: $email,
        company: $company,
        title: $title,
        createdAt: datetime($createdAt)
      })`,
      mgr
    );
  }
  console.log(`   ✓ Created ${data.managers.length} managers`);
}

async function seedEngineerSkills(session: Session): Promise<void> {
  console.log('💪 Seeding engineer skills...');
  
  for (const es of data.engineerSkills) {
    await session.run(
      `MATCH (e:Engineer {id: $engineerId})
       MATCH (s:Skill {id: $skillId})
       CREATE (es:EngineerSkill {
         id: $id,
         proficiencyLevel: $proficiencyLevel,
         yearsUsed: $yearsUsed,
         confidenceScore: $confidenceScore,
         lastValidated: datetime($lastValidated)
       })
       CREATE (e)-[:HAS]->(es)
       CREATE (es)-[:FOR]->(s)`,
      es
    );
  }
  console.log(`   ✓ Created ${data.engineerSkills.length} engineer skill records`);
}

async function seedInterviewStories(session: Session): Promise<void> {
  console.log('📖 Seeding interview stories...');
  
  for (const story of data.interviewStories) {
    await session.run(
      `MATCH (e:Engineer {id: $engineerId})
       CREATE (s:InterviewStory {
         id: $id,
         interviewId: $interviewId,
         questionPrompt: $questionPrompt,
         situation: $situation,
         task: $task,
         action: $action,
         result: $result,
         durationSeconds: $durationSeconds,
         createdAt: datetime($createdAt)
       })
       CREATE (e)-[:TOLD]->(s)`,
      story
    );
  }
  console.log(`   ✓ Created ${data.interviewStories.length} interview stories`);
}

async function seedStoryAnalyses(session: Session): Promise<void> {
  console.log('🔍 Seeding story analyses...');
  
  for (const analysis of data.storyAnalyses) {
    await session.run(
      `MATCH (s:InterviewStory {id: $storyId})
       CREATE (a:StoryAnalysis {
         id: $id,
         analyzerModel: $analyzerModel,
         analyzedAt: datetime($analyzedAt),
         clarityScore: $clarityScore,
         impactScore: $impactScore,
         ownershipScore: $ownershipScore,
         overallScore: $overallScore,
         reasoning: $reasoning,
         flags: $flags
       })
       CREATE (s)-[:ANALYZED_BY]->(a)`,
      analysis
    );
  }
  console.log(`   ✓ Created ${data.storyAnalyses.length} story analyses`);
}

async function seedStoryDemonstrations(session: Session): Promise<void> {
  console.log('✨ Seeding story skill demonstrations...');
  
  for (const demo of data.storyDemonstrations) {
    await session.run(
      `MATCH (s:InterviewStory {id: $storyId})
       MATCH (skill:Skill {id: $skillId})
       CREATE (s)-[:DEMONSTRATES {
         strength: $strength,
         notes: $notes
       }]->(skill)`,
      demo
    );
  }
  console.log(`   ✓ Created ${data.storyDemonstrations.length} demonstration relationships`);
}

async function seedAssessments(session: Session): Promise<void> {
  console.log('📝 Seeding assessments...');
  
  for (const assess of data.assessments) {
    await session.run(
      `CREATE (a:Assessment {
        id: $id,
        name: $name,
        assessmentType: $assessmentType,
        description: $description,
        totalQuestions: $totalQuestions,
        createdAt: datetime($createdAt)
      })`,
      assess
    );
  }
  console.log(`   ✓ Created ${data.assessments.length} assessments`);
}

async function seedAssessmentQuestions(session: Session): Promise<void> {
  console.log('❓ Seeding assessment questions...');
  
  for (const q of data.assessmentQuestions) {
    await session.run(
      `MATCH (a:Assessment {id: $assessmentId})
       CREATE (q:AssessmentQuestion {
         id: $id,
         questionNumber: $questionNumber,
         summary: $summary,
         maxScore: $maxScore,
         evaluationCriteria: $evaluationCriteria
       })
       CREATE (a)-[:CONTAINS]->(q)`,
      q
    );
  }
  console.log(`   ✓ Created ${data.assessmentQuestions.length} questions`);
}

async function seedQuestionSkillTests(session: Session): Promise<void> {
  console.log('🎯 Seeding question skill tests...');
  
  for (const test of data.questionSkillTests) {
    await session.run(
      `MATCH (q:AssessmentQuestion {id: $questionId})
       MATCH (s:Skill {id: $skillId})
       CREATE (q)-[:TESTS {weight: $weight}]->(s)`,
      test
    );
  }
  console.log(`   ✓ Created ${data.questionSkillTests.length} skill test relationships`);
}

async function seedAssessmentAttempts(session: Session): Promise<void> {
  console.log('📋 Seeding assessment attempts...');
  
  for (const attempt of data.assessmentAttempts) {
    await session.run(
      `MATCH (e:Engineer {id: $engineerId})
       MATCH (a:Assessment {id: $assessmentId})
       CREATE (att:AssessmentAttempt {
         id: $id,
         startedAt: datetime($startedAt),
         completedAt: datetime($completedAt),
         overallScore: $overallScore,
         overallFeedback: $overallFeedback
       })
       CREATE (e)-[:ATTEMPTED]->(att)
       CREATE (att)-[:OF]->(a)`,
      attempt
    );
  }
  console.log(`   ✓ Created ${data.assessmentAttempts.length} assessment attempts`);
}

async function seedQuestionPerformances(session: Session): Promise<void> {
  console.log('📊 Seeding question performances...');
  
  for (const perf of data.questionPerformances) {
    await session.run(
      `MATCH (att:AssessmentAttempt {id: $attemptId})
       MATCH (q:AssessmentQuestion {id: $questionId})
       CREATE (p:QuestionPerformance {
         id: $id,
         score: $score,
         technicalDepth: $technicalDepth,
         feedback: $feedback,
         evaluatedAt: datetime($evaluatedAt)
       })
       CREATE (att)-[:INCLUDES]->(p)
       CREATE (p)-[:FOR_QUESTION]->(q)`,
      perf
    );
  }
  console.log(`   ✓ Created ${data.questionPerformances.length} question performances`);
}

async function seedCertifications(session: Session): Promise<void> {
  console.log('🏆 Seeding certifications...');
  
  for (const cert of data.certifications) {
    await session.run(
      `CREATE (c:Certification {
        id: $id,
        name: $name,
        issuingOrg: $issuingOrg,
        issueDate: datetime($issueDate),
        expiryDate: datetime($expiryDate),
        verificationUrl: $verificationUrl,
        verified: $verified
      })`,
      cert
    );
  }
  console.log(`   ✓ Created ${data.certifications.length} certifications`);
}

async function seedCertificationValidations(session: Session): Promise<void> {
  console.log('✅ Seeding certification skill validations...');
  
  for (const val of data.certificationValidations) {
    await session.run(
      `MATCH (c:Certification {id: $certificationId})
       MATCH (s:Skill {id: $skillId})
       CREATE (c)-[:VALIDATES]->(s)`,
      val
    );
  }
  console.log(`   ✓ Created ${data.certificationValidations.length} validation relationships`);
}

async function seedEngineerCertifications(session: Session): Promise<void> {
  console.log('🎖️  Seeding engineer certifications...');
  
  for (const ec of data.engineerCertifications) {
    await session.run(
      `MATCH (e:Engineer {id: $engineerId})
       MATCH (c:Certification {id: $certificationId})
       CREATE (e)-[:HOLDS]->(c)`,
      ec
    );
  }
  console.log(`   ✓ Created ${data.engineerCertifications.length} engineer certification relationships`);
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
       CREATE (es)-[:EVIDENCED_BY {
         relevanceScore: $relevanceScore,
         isPrimary: $isPrimary
       }]->(ev)`,
      {
        engineerSkillId: ev.engineerSkillId,
        evidenceId: ev.evidenceId,
        relevanceScore: ev.relevanceScore,
        isPrimary: ev.isPrimary,
      }
    );
  }
  console.log(`   ✓ Created ${data.skillEvidence.length} evidence relationships`);
}

// ============================================
// MAIN
// ============================================

async function seed(): Promise<void> {
  console.log('🚀 Starting Neo4j seed process...\n');
  console.log(`   URI: ${NEO4J_URI}`);
  console.log(`   User: ${NEO4J_USER}\n`);

  const driver: Driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
  );

  const session: Session = driver.session();

  try {
    await clearDatabase(session);
    await createConstraints(session);
    
    // Seed in dependency order
    await seedSkills(session);
    await seedSkillHierarchy(session);
    await seedSkillCorrelations(session);
    
    await seedEngineers(session);
    await seedManagers(session);
    await seedEngineerSkills(session);
    
    await seedInterviewStories(session);
    await seedStoryAnalyses(session);
    await seedStoryDemonstrations(session);
    
    await seedAssessments(session);
    await seedAssessmentQuestions(session);
    await seedQuestionSkillTests(session);
    await seedAssessmentAttempts(session);
    await seedQuestionPerformances(session);
    
    await seedCertifications(session);
    await seedCertificationValidations(session);
    await seedEngineerCertifications(session);
    
    await seedSkillEvidence(session);

    console.log('\n✅ Seed completed successfully!');
    
    // Print summary
    const result = await session.run(`
      MATCH (n)
      RETURN labels(n)[0] as label, count(n) as count
      ORDER BY count DESC
    `);
    
    console.log('\n📊 Database summary:');
    result.records.forEach(record => {
      console.log(`   ${record.get('label')}: ${record.get('count')}`);
    });

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await session.close();
    await driver.close();
  }
}

// Run if called directly
seed().catch(console.error);
