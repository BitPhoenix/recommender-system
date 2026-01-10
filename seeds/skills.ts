import { Skill, SkillCorrelation, SkillHierarchy, SkillCategoryMembership } from './types';

// ============================================
// SKILLS
// ============================================
// Note: Category Skill nodes (cat_*) are being phased out in favor of:
// - SkillCategory nodes (in skill-categories.ts) for skill categorization
// - TechnicalDomain nodes (in domains.ts) for domain classification
// The skill hierarchy below maintains technical parent-child relationships.

export const skills: Skill[] = [
  // Languages & Frameworks
  { id: 'skill_javascript', name: 'JavaScript', skillType: 'technical', isCategory: false },
  { id: 'skill_typescript', name: 'TypeScript', skillType: 'technical', isCategory: false },
  { id: 'skill_nodejs', name: 'Node.js', skillType: 'technical', isCategory: false },
  { id: 'skill_express', name: 'Express', skillType: 'technical', isCategory: false },
  { id: 'skill_nestjs', name: 'NestJS', skillType: 'technical', isCategory: false },
  { id: 'skill_react', name: 'React', skillType: 'technical', isCategory: false },
  { id: 'skill_nextjs', name: 'Next.js', skillType: 'technical', isCategory: false },
  { id: 'skill_vue', name: 'Vue', skillType: 'technical', isCategory: false },
  { id: 'skill_angular', name: 'Angular', skillType: 'technical', isCategory: false },
  { id: 'skill_python', name: 'Python', skillType: 'technical', isCategory: false },
  { id: 'skill_django', name: 'Django', skillType: 'technical', isCategory: false },
  { id: 'skill_fastapi', name: 'FastAPI', skillType: 'technical', isCategory: false },
  { id: 'skill_java', name: 'Java', skillType: 'technical', isCategory: false },
  { id: 'skill_spring', name: 'Spring Boot', skillType: 'technical', isCategory: false },
  { id: 'skill_go', name: 'Go', skillType: 'technical', isCategory: false },
  { id: 'skill_rust', name: 'Rust', skillType: 'technical', isCategory: false },

  // Databases
  { id: 'skill_postgresql', name: 'PostgreSQL', skillType: 'technical', isCategory: false },
  { id: 'skill_mysql', name: 'MySQL', skillType: 'technical', isCategory: false },
  { id: 'skill_mongodb', name: 'MongoDB', skillType: 'technical', isCategory: false },
  { id: 'skill_redis', name: 'Redis', skillType: 'technical', isCategory: false },
  { id: 'skill_dynamodb', name: 'DynamoDB', skillType: 'technical', isCategory: false },
  { id: 'skill_neo4j', name: 'Neo4j', skillType: 'technical', isCategory: false },
  { id: 'skill_kafka', name: 'Kafka', skillType: 'technical', isCategory: false },

  // Infrastructure & DevOps
  { id: 'skill_aws', name: 'AWS', skillType: 'technical', isCategory: false },
  { id: 'skill_lambda', name: 'AWS Lambda', skillType: 'technical', isCategory: false },
  { id: 'skill_s3', name: 'S3', skillType: 'technical', isCategory: false },
  { id: 'skill_gcp', name: 'Google Cloud', skillType: 'technical', isCategory: false },
  { id: 'skill_azure', name: 'Azure', skillType: 'technical', isCategory: false },
  { id: 'skill_docker', name: 'Docker', skillType: 'technical', isCategory: false },
  { id: 'skill_kubernetes', name: 'Kubernetes', skillType: 'technical', isCategory: false },
  { id: 'skill_helm', name: 'Helm', skillType: 'technical', isCategory: false },
  { id: 'skill_terraform', name: 'Terraform', skillType: 'technical', isCategory: false },
  { id: 'skill_github_actions', name: 'GitHub Actions', skillType: 'technical', isCategory: false },

  // Design & Architecture
  { id: 'skill_api_design', name: 'API Design', skillType: 'technical', isCategory: false },
  { id: 'skill_rest_api', name: 'REST API Design', skillType: 'technical', isCategory: false },
  { id: 'skill_graphql', name: 'GraphQL', skillType: 'technical', isCategory: false },
  { id: 'skill_grpc', name: 'gRPC', skillType: 'technical', isCategory: false },
  { id: 'skill_system_design', name: 'System Design', skillType: 'technical', isCategory: false },
  { id: 'skill_microservices', name: 'Microservices Architecture', skillType: 'technical', isCategory: false },
  { id: 'skill_event_driven', name: 'Event-Driven Architecture', skillType: 'technical', isCategory: false },
  { id: 'skill_distributed', name: 'Distributed Systems', skillType: 'technical', isCategory: false },
  { id: 'skill_data_modeling', name: 'Data Modeling', skillType: 'technical', isCategory: false },

  // Testing & Practices
  { id: 'skill_unit_testing', name: 'Unit Testing', skillType: 'technical', isCategory: false },
  { id: 'skill_integration_testing', name: 'Integration Testing', skillType: 'technical', isCategory: false },
  { id: 'skill_e2e_testing', name: 'E2E Testing', skillType: 'technical', isCategory: false },
  { id: 'skill_tdd', name: 'Test-Driven Development', skillType: 'technical', isCategory: false },
  { id: 'skill_logging', name: 'Logging', skillType: 'technical', isCategory: false },
  { id: 'skill_monitoring', name: 'Monitoring', skillType: 'technical', isCategory: false },
  { id: 'skill_tracing', name: 'Distributed Tracing', skillType: 'technical', isCategory: false },
  { id: 'skill_auth', name: 'Authentication & Authorization', skillType: 'technical', isCategory: false },

  // Leadership skills
  { id: 'skill_team_leadership', name: 'Team Leadership', skillType: 'behavioral', isCategory: false },
  { id: 'skill_tech_leadership', name: 'Technical Leadership', skillType: 'behavioral', isCategory: false },
  { id: 'skill_mentorship', name: 'Mentorship', skillType: 'behavioral', isCategory: false },
  { id: 'skill_coaching', name: 'Coaching', skillType: 'behavioral', isCategory: false },
  { id: 'skill_delegation', name: 'Delegation', skillType: 'behavioral', isCategory: false },
  { id: 'skill_decision_making', name: 'Decision Making', skillType: 'behavioral', isCategory: false },
  { id: 'skill_conflict_resolution', name: 'Conflict Resolution', skillType: 'behavioral', isCategory: false },

  // Communication skills
  { id: 'skill_technical_writing', name: 'Technical Writing', skillType: 'behavioral', isCategory: false },
  { id: 'skill_documentation', name: 'Documentation', skillType: 'behavioral', isCategory: false },
  { id: 'skill_presentation', name: 'Presenting to Groups', skillType: 'behavioral', isCategory: false },
  { id: 'skill_stakeholder_comm', name: 'Stakeholder Communication', skillType: 'behavioral', isCategory: false },
  { id: 'skill_cross_functional', name: 'Cross-Functional Collaboration', skillType: 'behavioral', isCategory: false },
  { id: 'skill_feedback_giving', name: 'Giving Feedback', skillType: 'behavioral', isCategory: false },
  { id: 'skill_feedback_receiving', name: 'Receiving Feedback', skillType: 'behavioral', isCategory: false },
  { id: 'skill_active_listening', name: 'Active Listening', skillType: 'behavioral', isCategory: false },

  // Problem solving skills
  { id: 'skill_analytical', name: 'Analytical Thinking', skillType: 'behavioral', isCategory: false },
  { id: 'skill_debugging', name: 'Debugging & Troubleshooting', skillType: 'behavioral', isCategory: false },
  { id: 'skill_root_cause', name: 'Root Cause Analysis', skillType: 'behavioral', isCategory: false },
  { id: 'skill_ambiguity', name: 'Navigating Ambiguity', skillType: 'behavioral', isCategory: false },
  { id: 'skill_creativity', name: 'Creative Problem Solving', skillType: 'behavioral', isCategory: false },
  { id: 'skill_prioritization', name: 'Prioritization', skillType: 'behavioral', isCategory: false },
  { id: 'skill_tradeoffs', name: 'Evaluating Tradeoffs', skillType: 'behavioral', isCategory: false },

  // Execution skills
  { id: 'skill_ownership', name: 'Ownership', skillType: 'behavioral', isCategory: false },
  { id: 'skill_accountability', name: 'Accountability', skillType: 'behavioral', isCategory: false },
  { id: 'skill_time_management', name: 'Time Management', skillType: 'behavioral', isCategory: false },
  { id: 'skill_estimation', name: 'Estimation & Planning', skillType: 'behavioral', isCategory: false },
  { id: 'skill_attention_detail', name: 'Attention to Detail', skillType: 'behavioral', isCategory: false },
  { id: 'skill_follow_through', name: 'Follow-Through', skillType: 'behavioral', isCategory: false },
  { id: 'skill_pressure', name: 'Working Under Pressure', skillType: 'behavioral', isCategory: false },

  // Collaboration skills
  { id: 'skill_code_review', name: 'Code Review', skillType: 'behavioral', isCategory: false },
  { id: 'skill_pair_programming', name: 'Pair Programming', skillType: 'behavioral', isCategory: false },
  { id: 'skill_knowledge_sharing', name: 'Knowledge Sharing', skillType: 'behavioral', isCategory: false },
  { id: 'skill_teamwork', name: 'Teamwork', skillType: 'behavioral', isCategory: false },
  { id: 'skill_remote_collab', name: 'Remote Collaboration', skillType: 'behavioral', isCategory: false },

  // Growth skills
  { id: 'skill_learning', name: 'Continuous Learning', skillType: 'behavioral', isCategory: false },
  { id: 'skill_adaptability', name: 'Adaptability', skillType: 'behavioral', isCategory: false },
  { id: 'skill_resilience', name: 'Resilience', skillType: 'behavioral', isCategory: false },
  { id: 'skill_self_awareness', name: 'Self-Awareness', skillType: 'behavioral', isCategory: false },
  { id: 'skill_curiosity', name: 'Curiosity', skillType: 'behavioral', isCategory: false },

  // Mobile Development Skills
  { id: 'skill_react_native', name: 'React Native', skillType: 'technical', isCategory: false, description: 'Cross-platform mobile development with React Native' },
  { id: 'skill_swift', name: 'Swift', skillType: 'technical', isCategory: false, description: 'iOS native development with Swift' },
  { id: 'skill_kotlin', name: 'Kotlin', skillType: 'technical', isCategory: false, description: 'Android native development with Kotlin' },
  { id: 'skill_firebase', name: 'Firebase', skillType: 'technical', isCategory: false, description: 'Google Firebase platform services' },

  // Data Engineering Skills
  { id: 'skill_spark', name: 'Apache Spark', skillType: 'technical', isCategory: false, description: 'Distributed data processing with Spark' },

  // ML Skills
  { id: 'skill_tensorflow', name: 'TensorFlow', skillType: 'technical', isCategory: false, description: 'Deep learning with TensorFlow' },

  // Leadership/Hiring Skills
  { id: 'skill_hiring', name: 'Hiring & Interviewing', skillType: 'behavioral', isCategory: false, description: 'Technical hiring and interview skills' },
  { id: 'skill_performance_optimization', name: 'Performance Optimization', skillType: 'technical', isCategory: false, description: 'System and application performance tuning' },
];

// ============================================
// SKILL HIERARCHY
// ============================================
// Technical skill-to-skill parent-child relationships only.
// Categories are now handled via SkillCategory nodes (skill-categories.ts)
// and TechnicalDomain nodes (domains.ts).

export const skillHierarchy: SkillHierarchy[] = [
  // JavaScript family
  { childSkillId: 'skill_typescript', parentSkillId: 'skill_javascript' },
  { childSkillId: 'skill_nodejs', parentSkillId: 'skill_javascript' },
  { childSkillId: 'skill_react', parentSkillId: 'skill_javascript' },
  { childSkillId: 'skill_vue', parentSkillId: 'skill_javascript' },
  { childSkillId: 'skill_angular', parentSkillId: 'skill_javascript' },

  // Node.js frameworks
  { childSkillId: 'skill_express', parentSkillId: 'skill_nodejs' },
  { childSkillId: 'skill_nestjs', parentSkillId: 'skill_nodejs' },

  // React ecosystem
  { childSkillId: 'skill_nextjs', parentSkillId: 'skill_react' },

  // Python family
  { childSkillId: 'skill_django', parentSkillId: 'skill_python' },
  { childSkillId: 'skill_fastapi', parentSkillId: 'skill_python' },

  // Java family
  { childSkillId: 'skill_spring', parentSkillId: 'skill_java' },

  // AWS services
  { childSkillId: 'skill_lambda', parentSkillId: 'skill_aws' },
  { childSkillId: 'skill_s3', parentSkillId: 'skill_aws' },

  // Kubernetes ecosystem
  { childSkillId: 'skill_helm', parentSkillId: 'skill_kubernetes' },

  // API Design patterns
  { childSkillId: 'skill_rest_api', parentSkillId: 'skill_api_design' },
  { childSkillId: 'skill_graphql', parentSkillId: 'skill_api_design' },
  { childSkillId: 'skill_grpc', parentSkillId: 'skill_api_design' },

  // System Design patterns
  { childSkillId: 'skill_microservices', parentSkillId: 'skill_system_design' },
  { childSkillId: 'skill_event_driven', parentSkillId: 'skill_system_design' },
  { childSkillId: 'skill_distributed', parentSkillId: 'skill_system_design' },

  // Testing - TDD implies unit testing
  { childSkillId: 'skill_tdd', parentSkillId: 'skill_unit_testing' },

  // Observability chain
  { childSkillId: 'skill_tracing', parentSkillId: 'skill_monitoring' },
];

// ============================================
// SKILL CORRELATIONS
// ============================================

export const skillCorrelations: SkillCorrelation[] = [
  // Technical correlations
  { fromSkillId: 'skill_typescript', toSkillId: 'skill_javascript', strength: 0.95, correlationType: 'transferable' },
  { fromSkillId: 'skill_react', toSkillId: 'skill_typescript', strength: 0.75, correlationType: 'co_occurring' },
  { fromSkillId: 'skill_express', toSkillId: 'skill_nestjs', strength: 0.6, correlationType: 'transferable' },
  { fromSkillId: 'skill_react', toSkillId: 'skill_vue', strength: 0.65, correlationType: 'transferable' },
  { fromSkillId: 'skill_nextjs', toSkillId: 'skill_react', strength: 0.9, correlationType: 'transferable' },
  { fromSkillId: 'skill_django', toSkillId: 'skill_fastapi', strength: 0.7, correlationType: 'transferable' },
  { fromSkillId: 'skill_spring', toSkillId: 'skill_java', strength: 0.85, correlationType: 'transferable' },
  { fromSkillId: 'skill_postgresql', toSkillId: 'skill_mysql', strength: 0.8, correlationType: 'transferable' },
  { fromSkillId: 'skill_postgresql', toSkillId: 'skill_data_modeling', strength: 0.7, correlationType: 'complementary' },
  { fromSkillId: 'skill_postgresql', toSkillId: 'skill_redis', strength: 0.5, correlationType: 'co_occurring' },
  { fromSkillId: 'skill_dynamodb', toSkillId: 'skill_mongodb', strength: 0.55, correlationType: 'transferable' },
  { fromSkillId: 'skill_kafka', toSkillId: 'skill_event_driven', strength: 0.8, correlationType: 'complementary' },
  { fromSkillId: 'skill_kubernetes', toSkillId: 'skill_docker', strength: 0.9, correlationType: 'complementary' },
  { fromSkillId: 'skill_kubernetes', toSkillId: 'skill_helm', strength: 0.7, correlationType: 'co_occurring' },
  { fromSkillId: 'skill_lambda', toSkillId: 'skill_aws', strength: 0.85, correlationType: 'transferable' },
  { fromSkillId: 'skill_aws', toSkillId: 'skill_gcp', strength: 0.6, correlationType: 'transferable' },
  { fromSkillId: 'skill_terraform', toSkillId: 'skill_aws', strength: 0.7, correlationType: 'co_occurring' },
  { fromSkillId: 'skill_docker', toSkillId: 'skill_github_actions', strength: 0.65, correlationType: 'co_occurring' },
  { fromSkillId: 'skill_microservices', toSkillId: 'skill_api_design', strength: 0.8, correlationType: 'complementary' },
  { fromSkillId: 'skill_microservices', toSkillId: 'skill_event_driven', strength: 0.7, correlationType: 'co_occurring' },
  { fromSkillId: 'skill_distributed', toSkillId: 'skill_microservices', strength: 0.75, correlationType: 'complementary' },
  { fromSkillId: 'skill_system_design', toSkillId: 'skill_api_design', strength: 0.7, correlationType: 'complementary' },
  { fromSkillId: 'skill_graphql', toSkillId: 'skill_rest_api', strength: 0.5, correlationType: 'transferable' },
  { fromSkillId: 'skill_event_driven', toSkillId: 'skill_kafka', strength: 0.75, correlationType: 'co_occurring' },
  { fromSkillId: 'skill_tdd', toSkillId: 'skill_unit_testing', strength: 0.9, correlationType: 'complementary' },
  { fromSkillId: 'skill_monitoring', toSkillId: 'skill_logging', strength: 0.8, correlationType: 'co_occurring' },
  { fromSkillId: 'skill_tracing', toSkillId: 'skill_monitoring', strength: 0.75, correlationType: 'co_occurring' },

  // Behavioral correlations
  { fromSkillId: 'skill_team_leadership', toSkillId: 'skill_delegation', strength: 0.85, correlationType: 'complementary' },
  { fromSkillId: 'skill_team_leadership', toSkillId: 'skill_conflict_resolution', strength: 0.75, correlationType: 'complementary' },
  { fromSkillId: 'skill_tech_leadership', toSkillId: 'skill_decision_making', strength: 0.8, correlationType: 'complementary' },
  { fromSkillId: 'skill_mentorship', toSkillId: 'skill_coaching', strength: 0.85, correlationType: 'transferable' },
  { fromSkillId: 'skill_mentorship', toSkillId: 'skill_feedback_giving', strength: 0.8, correlationType: 'complementary' },
  { fromSkillId: 'skill_decision_making', toSkillId: 'skill_tradeoffs', strength: 0.8, correlationType: 'complementary' },
  { fromSkillId: 'skill_stakeholder_comm', toSkillId: 'skill_active_listening', strength: 0.75, correlationType: 'complementary' },
  { fromSkillId: 'skill_cross_functional', toSkillId: 'skill_stakeholder_comm', strength: 0.7, correlationType: 'complementary' },
  { fromSkillId: 'skill_technical_writing', toSkillId: 'skill_documentation', strength: 0.9, correlationType: 'transferable' },
  { fromSkillId: 'skill_presentation', toSkillId: 'skill_stakeholder_comm', strength: 0.7, correlationType: 'complementary' },
  { fromSkillId: 'skill_feedback_giving', toSkillId: 'skill_feedback_receiving', strength: 0.6, correlationType: 'complementary' },
  { fromSkillId: 'skill_debugging', toSkillId: 'skill_analytical', strength: 0.85, correlationType: 'complementary' },
  { fromSkillId: 'skill_debugging', toSkillId: 'skill_root_cause', strength: 0.9, correlationType: 'complementary' },
  { fromSkillId: 'skill_ambiguity', toSkillId: 'skill_prioritization', strength: 0.75, correlationType: 'complementary' },
  { fromSkillId: 'skill_creativity', toSkillId: 'skill_ambiguity', strength: 0.7, correlationType: 'complementary' },
  { fromSkillId: 'skill_prioritization', toSkillId: 'skill_tradeoffs', strength: 0.8, correlationType: 'complementary' },
  { fromSkillId: 'skill_ownership', toSkillId: 'skill_accountability', strength: 0.9, correlationType: 'complementary' },
  { fromSkillId: 'skill_follow_through', toSkillId: 'skill_ownership', strength: 0.85, correlationType: 'complementary' },
  { fromSkillId: 'skill_time_management', toSkillId: 'skill_estimation', strength: 0.7, correlationType: 'complementary' },
  { fromSkillId: 'skill_pressure', toSkillId: 'skill_prioritization', strength: 0.75, correlationType: 'complementary' },
  { fromSkillId: 'skill_attention_detail', toSkillId: 'skill_follow_through', strength: 0.7, correlationType: 'complementary' },
  { fromSkillId: 'skill_code_review', toSkillId: 'skill_feedback_giving', strength: 0.85, correlationType: 'complementary' },
  { fromSkillId: 'skill_code_review', toSkillId: 'skill_feedback_receiving', strength: 0.7, correlationType: 'complementary' },
  { fromSkillId: 'skill_pair_programming', toSkillId: 'skill_active_listening', strength: 0.75, correlationType: 'complementary' },
  { fromSkillId: 'skill_knowledge_sharing', toSkillId: 'skill_mentorship', strength: 0.8, correlationType: 'complementary' },
  { fromSkillId: 'skill_knowledge_sharing', toSkillId: 'skill_documentation', strength: 0.7, correlationType: 'complementary' },
  { fromSkillId: 'skill_remote_collab', toSkillId: 'skill_technical_writing', strength: 0.8, correlationType: 'complementary' },
  { fromSkillId: 'skill_learning', toSkillId: 'skill_curiosity', strength: 0.9, correlationType: 'complementary' },
  { fromSkillId: 'skill_adaptability', toSkillId: 'skill_resilience', strength: 0.8, correlationType: 'complementary' },
  { fromSkillId: 'skill_feedback_receiving', toSkillId: 'skill_self_awareness', strength: 0.75, correlationType: 'complementary' },
  { fromSkillId: 'skill_self_awareness', toSkillId: 'skill_learning', strength: 0.7, correlationType: 'complementary' },

  // Cross-type correlations (Technical <-> Behavioral)
  { fromSkillId: 'skill_tech_leadership', toSkillId: 'skill_system_design', strength: 0.75, correlationType: 'complementary' },
  { fromSkillId: 'skill_tech_leadership', toSkillId: 'skill_api_design', strength: 0.7, correlationType: 'complementary' },
  { fromSkillId: 'skill_code_review', toSkillId: 'skill_unit_testing', strength: 0.6, correlationType: 'complementary' },
  { fromSkillId: 'skill_debugging', toSkillId: 'skill_monitoring', strength: 0.65, correlationType: 'complementary' },
  { fromSkillId: 'skill_documentation', toSkillId: 'skill_api_design', strength: 0.75, correlationType: 'complementary' },
  { fromSkillId: 'skill_microservices', toSkillId: 'skill_cross_functional', strength: 0.6, correlationType: 'complementary' },
  { fromSkillId: 'skill_system_design', toSkillId: 'skill_tradeoffs', strength: 0.8, correlationType: 'complementary' },
  { fromSkillId: 'skill_distributed', toSkillId: 'skill_debugging', strength: 0.7, correlationType: 'complementary' },
  { fromSkillId: 'skill_tdd', toSkillId: 'skill_ownership', strength: 0.6, correlationType: 'complementary' },
];

// ============================================
// SKILL CATEGORY MEMBERSHIPS (BELONGS_TO)
// ============================================
// Skills belong to SkillCategory nodes (defined in skill-categories.ts).
// A skill can belong to multiple categories (e.g., JS/TS are both frontend and backend).

export const skillCategoryMemberships: SkillCategoryMembership[] = [
  // Frontend frameworks
  { skillId: 'skill_react', categoryId: 'sc_frontend_frameworks' },
  { skillId: 'skill_nextjs', categoryId: 'sc_frontend_frameworks' },
  { skillId: 'skill_vue', categoryId: 'sc_frontend_frameworks' },
  { skillId: 'skill_angular', categoryId: 'sc_frontend_frameworks' },

  // JS/TS belong to BOTH frontend and backend
  { skillId: 'skill_javascript', categoryId: 'sc_frontend_frameworks' },
  { skillId: 'skill_javascript', categoryId: 'sc_backend_languages' },
  { skillId: 'skill_typescript', categoryId: 'sc_frontend_frameworks' },
  { skillId: 'skill_typescript', categoryId: 'sc_backend_languages' },

  // Backend frameworks
  { skillId: 'skill_express', categoryId: 'sc_backend_frameworks' },
  { skillId: 'skill_nestjs', categoryId: 'sc_backend_frameworks' },
  { skillId: 'skill_django', categoryId: 'sc_backend_frameworks' },
  { skillId: 'skill_fastapi', categoryId: 'sc_backend_frameworks' },
  { skillId: 'skill_spring', categoryId: 'sc_backend_frameworks' },

  // Backend languages
  { skillId: 'skill_nodejs', categoryId: 'sc_backend_languages' },
  { skillId: 'skill_python', categoryId: 'sc_backend_languages' },
  { skillId: 'skill_java', categoryId: 'sc_backend_languages' },
  { skillId: 'skill_go', categoryId: 'sc_backend_languages' },
  { skillId: 'skill_rust', categoryId: 'sc_backend_languages' },

  // Databases
  { skillId: 'skill_postgresql', categoryId: 'sc_databases' },
  { skillId: 'skill_mysql', categoryId: 'sc_databases' },
  { skillId: 'skill_mongodb', categoryId: 'sc_databases' },
  { skillId: 'skill_redis', categoryId: 'sc_databases' },
  { skillId: 'skill_dynamodb', categoryId: 'sc_databases' },
  { skillId: 'skill_neo4j', categoryId: 'sc_databases' },
  { skillId: 'skill_kafka', categoryId: 'sc_databases' },

  // Cloud platforms
  { skillId: 'skill_aws', categoryId: 'sc_cloud' },
  { skillId: 'skill_gcp', categoryId: 'sc_cloud' },
  { skillId: 'skill_azure', categoryId: 'sc_cloud' },
  { skillId: 'skill_lambda', categoryId: 'sc_cloud' },
  { skillId: 'skill_s3', categoryId: 'sc_cloud' },

  // Containerization
  { skillId: 'skill_docker', categoryId: 'sc_containers' },
  { skillId: 'skill_kubernetes', categoryId: 'sc_containers' },
  { skillId: 'skill_helm', categoryId: 'sc_containers' },

  // CI/CD
  { skillId: 'skill_terraform', categoryId: 'sc_cicd' },
  { skillId: 'skill_github_actions', categoryId: 'sc_cicd' },

  // Testing
  { skillId: 'skill_unit_testing', categoryId: 'sc_testing' },
  { skillId: 'skill_integration_testing', categoryId: 'sc_testing' },
  { skillId: 'skill_e2e_testing', categoryId: 'sc_testing' },
  { skillId: 'skill_tdd', categoryId: 'sc_testing' },

  // Observability
  { skillId: 'skill_logging', categoryId: 'sc_observability' },
  { skillId: 'skill_monitoring', categoryId: 'sc_observability' },
  { skillId: 'skill_tracing', categoryId: 'sc_observability' },

  // Security
  { skillId: 'skill_auth', categoryId: 'sc_security' },

  // Design & Architecture
  { skillId: 'skill_api_design', categoryId: 'sc_design' },
  { skillId: 'skill_rest_api', categoryId: 'sc_design' },
  { skillId: 'skill_graphql', categoryId: 'sc_design' },
  { skillId: 'skill_grpc', categoryId: 'sc_design' },
  { skillId: 'skill_system_design', categoryId: 'sc_design' },
  { skillId: 'skill_microservices', categoryId: 'sc_design' },
  { skillId: 'skill_event_driven', categoryId: 'sc_design' },
  { skillId: 'skill_distributed', categoryId: 'sc_design' },
  { skillId: 'skill_data_modeling', categoryId: 'sc_design' },

  // Leadership behavioral skills
  { skillId: 'skill_team_leadership', categoryId: 'sc_leadership' },
  { skillId: 'skill_tech_leadership', categoryId: 'sc_leadership' },
  { skillId: 'skill_mentorship', categoryId: 'sc_leadership' },
  { skillId: 'skill_coaching', categoryId: 'sc_leadership' },
  { skillId: 'skill_delegation', categoryId: 'sc_leadership' },
  { skillId: 'skill_decision_making', categoryId: 'sc_leadership' },
  { skillId: 'skill_conflict_resolution', categoryId: 'sc_leadership' },

  // Communication behavioral skills
  { skillId: 'skill_technical_writing', categoryId: 'sc_communication' },
  { skillId: 'skill_documentation', categoryId: 'sc_communication' },
  { skillId: 'skill_presentation', categoryId: 'sc_communication' },
  { skillId: 'skill_stakeholder_comm', categoryId: 'sc_communication' },
  { skillId: 'skill_cross_functional', categoryId: 'sc_communication' },
  { skillId: 'skill_feedback_giving', categoryId: 'sc_communication' },
  { skillId: 'skill_feedback_receiving', categoryId: 'sc_communication' },
  { skillId: 'skill_active_listening', categoryId: 'sc_communication' },

  // Problem solving behavioral skills
  { skillId: 'skill_analytical', categoryId: 'sc_problem_solving' },
  { skillId: 'skill_debugging', categoryId: 'sc_problem_solving' },
  { skillId: 'skill_root_cause', categoryId: 'sc_problem_solving' },
  { skillId: 'skill_ambiguity', categoryId: 'sc_problem_solving' },
  { skillId: 'skill_creativity', categoryId: 'sc_problem_solving' },
  { skillId: 'skill_prioritization', categoryId: 'sc_problem_solving' },
  { skillId: 'skill_tradeoffs', categoryId: 'sc_problem_solving' },

  // Execution behavioral skills
  { skillId: 'skill_ownership', categoryId: 'sc_execution' },
  { skillId: 'skill_accountability', categoryId: 'sc_execution' },
  { skillId: 'skill_time_management', categoryId: 'sc_execution' },
  { skillId: 'skill_estimation', categoryId: 'sc_execution' },
  { skillId: 'skill_attention_detail', categoryId: 'sc_execution' },
  { skillId: 'skill_follow_through', categoryId: 'sc_execution' },
  { skillId: 'skill_pressure', categoryId: 'sc_execution' },

  // Collaboration behavioral skills
  { skillId: 'skill_code_review', categoryId: 'sc_collaboration' },
  { skillId: 'skill_pair_programming', categoryId: 'sc_collaboration' },
  { skillId: 'skill_knowledge_sharing', categoryId: 'sc_collaboration' },
  { skillId: 'skill_teamwork', categoryId: 'sc_collaboration' },
  { skillId: 'skill_remote_collab', categoryId: 'sc_collaboration' },

  // Growth behavioral skills
  { skillId: 'skill_learning', categoryId: 'sc_growth' },
  { skillId: 'skill_adaptability', categoryId: 'sc_growth' },
  { skillId: 'skill_resilience', categoryId: 'sc_growth' },
  { skillId: 'skill_self_awareness', categoryId: 'sc_growth' },
  { skillId: 'skill_curiosity', categoryId: 'sc_growth' },
];
