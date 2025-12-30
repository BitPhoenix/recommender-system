import { Skill, SkillCorrelation, SkillHierarchy, SkillCategoryMembership } from './types';

// ============================================
// SKILLS
// ============================================

export const skills: Skill[] = [
  // Top-level categories
  { id: 'cat_technical', name: 'Technical', skillType: 'technical', isCategory: true },
  { id: 'cat_behavioral', name: 'Behavioral', skillType: 'behavioral', isCategory: true },
  { id: 'cat_domain', name: 'Domain Knowledge', skillType: 'domain_knowledge', isCategory: true },

  // Technical subcategories
  { id: 'cat_languages', name: 'Languages & Frameworks', skillType: 'technical', isCategory: true },
  { id: 'cat_databases', name: 'Databases & Data', skillType: 'technical', isCategory: true },
  { id: 'cat_infrastructure', name: 'Infrastructure & DevOps', skillType: 'technical', isCategory: true },
  { id: 'cat_design', name: 'Design & Architecture', skillType: 'technical', isCategory: true },
  { id: 'cat_practices', name: 'Engineering Practices', skillType: 'technical', isCategory: true },

  // Role-based categories (virtual groupings that span multiple subcategories)
  { id: 'cat_backend', name: 'Backend', skillType: 'technical', isCategory: true },
  { id: 'cat_frontend', name: 'Frontend', skillType: 'technical', isCategory: true },
  { id: 'cat_fullstack', name: 'Full Stack', skillType: 'technical', isCategory: true },

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

  // Databases subcategories
  { id: 'cat_relational', name: 'Relational Databases', skillType: 'technical', isCategory: true },
  { id: 'cat_nosql', name: 'NoSQL Databases', skillType: 'technical', isCategory: true },
  { id: 'skill_postgresql', name: 'PostgreSQL', skillType: 'technical', isCategory: false },
  { id: 'skill_mysql', name: 'MySQL', skillType: 'technical', isCategory: false },
  { id: 'skill_mongodb', name: 'MongoDB', skillType: 'technical', isCategory: false },
  { id: 'skill_redis', name: 'Redis', skillType: 'technical', isCategory: false },
  { id: 'skill_dynamodb', name: 'DynamoDB', skillType: 'technical', isCategory: false },
  { id: 'skill_neo4j', name: 'Neo4j', skillType: 'technical', isCategory: false },
  { id: 'skill_kafka', name: 'Kafka', skillType: 'technical', isCategory: false },

  // Infrastructure subcategories
  { id: 'cat_cloud', name: 'Cloud Platforms', skillType: 'technical', isCategory: true },
  { id: 'cat_containers', name: 'Containerization', skillType: 'technical', isCategory: true },
  { id: 'cat_cicd', name: 'CI/CD', skillType: 'technical', isCategory: true },
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

  // Practices subcategories
  { id: 'cat_testing', name: 'Testing', skillType: 'technical', isCategory: true },
  { id: 'cat_observability', name: 'Observability', skillType: 'technical', isCategory: true },
  { id: 'cat_security', name: 'Security', skillType: 'technical', isCategory: true },
  { id: 'skill_unit_testing', name: 'Unit Testing', skillType: 'technical', isCategory: false },
  { id: 'skill_integration_testing', name: 'Integration Testing', skillType: 'technical', isCategory: false },
  { id: 'skill_e2e_testing', name: 'E2E Testing', skillType: 'technical', isCategory: false },
  { id: 'skill_tdd', name: 'Test-Driven Development', skillType: 'technical', isCategory: false },
  { id: 'skill_logging', name: 'Logging', skillType: 'technical', isCategory: false },
  { id: 'skill_monitoring', name: 'Monitoring', skillType: 'technical', isCategory: false },
  { id: 'skill_tracing', name: 'Distributed Tracing', skillType: 'technical', isCategory: false },
  { id: 'skill_auth', name: 'Authentication & Authorization', skillType: 'technical', isCategory: false },

  // Behavioral categories
  { id: 'cat_leadership', name: 'Leadership', skillType: 'behavioral', isCategory: true },
  { id: 'cat_communication', name: 'Communication', skillType: 'behavioral', isCategory: true },
  { id: 'cat_problem_solving', name: 'Problem Solving', skillType: 'behavioral', isCategory: true },
  { id: 'cat_execution', name: 'Execution & Delivery', skillType: 'behavioral', isCategory: true },
  { id: 'cat_collaboration', name: 'Collaboration', skillType: 'behavioral', isCategory: true },
  { id: 'cat_growth', name: 'Growth & Adaptability', skillType: 'behavioral', isCategory: true },

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

  // Domain knowledge
  { id: 'skill_ai_ml', name: 'AI/Machine Learning', skillType: 'domain_knowledge', isCategory: false },
  { id: 'skill_blockchain', name: 'Blockchain/Web3', skillType: 'domain_knowledge', isCategory: false },
  { id: 'skill_fintech', name: 'Fintech', skillType: 'domain_knowledge', isCategory: false },
  { id: 'skill_healthcare', name: 'Healthcare', skillType: 'domain_knowledge', isCategory: false },
  { id: 'skill_ecommerce', name: 'E-commerce', skillType: 'domain_knowledge', isCategory: false },
  { id: 'skill_saas', name: 'SaaS', skillType: 'domain_knowledge', isCategory: false },
  { id: 'skill_marketplace', name: 'Marketplaces', skillType: 'domain_knowledge', isCategory: false },
];

// ============================================
// SKILL HIERARCHY
// ============================================

export const skillHierarchy: SkillHierarchy[] = [
  // Technical category structure
  { childSkillId: 'cat_languages', parentSkillId: 'cat_technical' },
  { childSkillId: 'cat_databases', parentSkillId: 'cat_technical' },
  { childSkillId: 'cat_infrastructure', parentSkillId: 'cat_technical' },
  { childSkillId: 'cat_design', parentSkillId: 'cat_technical' },
  { childSkillId: 'cat_practices', parentSkillId: 'cat_technical' },

  // Languages & Frameworks
  { childSkillId: 'skill_javascript', parentSkillId: 'cat_languages' },
  { childSkillId: 'skill_typescript', parentSkillId: 'skill_javascript' },
  { childSkillId: 'skill_nodejs', parentSkillId: 'skill_javascript' },
  { childSkillId: 'skill_express', parentSkillId: 'skill_nodejs' },
  { childSkillId: 'skill_nestjs', parentSkillId: 'skill_nodejs' },
  { childSkillId: 'skill_react', parentSkillId: 'skill_javascript' },
  { childSkillId: 'skill_nextjs', parentSkillId: 'skill_react' },
  { childSkillId: 'skill_vue', parentSkillId: 'skill_javascript' },
  { childSkillId: 'skill_angular', parentSkillId: 'skill_javascript' },
  { childSkillId: 'skill_python', parentSkillId: 'cat_languages' },
  { childSkillId: 'skill_django', parentSkillId: 'skill_python' },
  { childSkillId: 'skill_fastapi', parentSkillId: 'skill_python' },
  { childSkillId: 'skill_java', parentSkillId: 'cat_languages' },
  { childSkillId: 'skill_spring', parentSkillId: 'skill_java' },
  { childSkillId: 'skill_go', parentSkillId: 'cat_languages' },
  { childSkillId: 'skill_rust', parentSkillId: 'cat_languages' },

  // Databases
  { childSkillId: 'cat_relational', parentSkillId: 'cat_databases' },
  { childSkillId: 'cat_nosql', parentSkillId: 'cat_databases' },
  { childSkillId: 'skill_postgresql', parentSkillId: 'cat_relational' },
  { childSkillId: 'skill_mysql', parentSkillId: 'cat_relational' },
  { childSkillId: 'skill_mongodb', parentSkillId: 'cat_nosql' },
  { childSkillId: 'skill_redis', parentSkillId: 'cat_nosql' },
  { childSkillId: 'skill_dynamodb', parentSkillId: 'cat_nosql' },
  { childSkillId: 'skill_neo4j', parentSkillId: 'cat_nosql' },
  { childSkillId: 'skill_kafka', parentSkillId: 'cat_databases' },

  // Infrastructure
  { childSkillId: 'cat_cloud', parentSkillId: 'cat_infrastructure' },
  { childSkillId: 'cat_containers', parentSkillId: 'cat_infrastructure' },
  { childSkillId: 'cat_cicd', parentSkillId: 'cat_infrastructure' },
  { childSkillId: 'skill_aws', parentSkillId: 'cat_cloud' },
  { childSkillId: 'skill_lambda', parentSkillId: 'skill_aws' },
  { childSkillId: 'skill_s3', parentSkillId: 'skill_aws' },
  { childSkillId: 'skill_gcp', parentSkillId: 'cat_cloud' },
  { childSkillId: 'skill_azure', parentSkillId: 'cat_cloud' },
  { childSkillId: 'skill_docker', parentSkillId: 'cat_containers' },
  { childSkillId: 'skill_kubernetes', parentSkillId: 'cat_containers' },
  { childSkillId: 'skill_helm', parentSkillId: 'skill_kubernetes' },
  { childSkillId: 'skill_terraform', parentSkillId: 'cat_cicd' },
  { childSkillId: 'skill_github_actions', parentSkillId: 'cat_cicd' },

  // Design & Architecture
  { childSkillId: 'skill_api_design', parentSkillId: 'cat_design' },
  { childSkillId: 'skill_rest_api', parentSkillId: 'skill_api_design' },
  { childSkillId: 'skill_graphql', parentSkillId: 'skill_api_design' },
  { childSkillId: 'skill_grpc', parentSkillId: 'skill_api_design' },
  { childSkillId: 'skill_system_design', parentSkillId: 'cat_design' },
  { childSkillId: 'skill_microservices', parentSkillId: 'skill_system_design' },
  { childSkillId: 'skill_event_driven', parentSkillId: 'skill_system_design' },
  { childSkillId: 'skill_distributed', parentSkillId: 'skill_system_design' },
  { childSkillId: 'skill_data_modeling', parentSkillId: 'cat_design' },

  // Practices
  { childSkillId: 'cat_testing', parentSkillId: 'cat_practices' },
  { childSkillId: 'cat_observability', parentSkillId: 'cat_practices' },
  { childSkillId: 'cat_security', parentSkillId: 'cat_practices' },
  { childSkillId: 'skill_unit_testing', parentSkillId: 'cat_testing' },
  { childSkillId: 'skill_integration_testing', parentSkillId: 'cat_testing' },
  { childSkillId: 'skill_e2e_testing', parentSkillId: 'cat_testing' },
  { childSkillId: 'skill_tdd', parentSkillId: 'cat_testing' },
  { childSkillId: 'skill_logging', parentSkillId: 'cat_observability' },
  { childSkillId: 'skill_monitoring', parentSkillId: 'cat_observability' },
  { childSkillId: 'skill_tracing', parentSkillId: 'cat_observability' },
  { childSkillId: 'skill_auth', parentSkillId: 'cat_security' },

  // Behavioral category structure
  { childSkillId: 'cat_leadership', parentSkillId: 'cat_behavioral' },
  { childSkillId: 'cat_communication', parentSkillId: 'cat_behavioral' },
  { childSkillId: 'cat_problem_solving', parentSkillId: 'cat_behavioral' },
  { childSkillId: 'cat_execution', parentSkillId: 'cat_behavioral' },
  { childSkillId: 'cat_collaboration', parentSkillId: 'cat_behavioral' },
  { childSkillId: 'cat_growth', parentSkillId: 'cat_behavioral' },

  // Leadership
  { childSkillId: 'skill_team_leadership', parentSkillId: 'cat_leadership' },
  { childSkillId: 'skill_tech_leadership', parentSkillId: 'cat_leadership' },
  { childSkillId: 'skill_mentorship', parentSkillId: 'cat_leadership' },
  { childSkillId: 'skill_coaching', parentSkillId: 'cat_leadership' },
  { childSkillId: 'skill_delegation', parentSkillId: 'cat_leadership' },
  { childSkillId: 'skill_decision_making', parentSkillId: 'cat_leadership' },
  { childSkillId: 'skill_conflict_resolution', parentSkillId: 'cat_leadership' },

  // Communication
  { childSkillId: 'skill_technical_writing', parentSkillId: 'cat_communication' },
  { childSkillId: 'skill_documentation', parentSkillId: 'cat_communication' },
  { childSkillId: 'skill_presentation', parentSkillId: 'cat_communication' },
  { childSkillId: 'skill_stakeholder_comm', parentSkillId: 'cat_communication' },
  { childSkillId: 'skill_cross_functional', parentSkillId: 'cat_communication' },
  { childSkillId: 'skill_feedback_giving', parentSkillId: 'cat_communication' },
  { childSkillId: 'skill_feedback_receiving', parentSkillId: 'cat_communication' },
  { childSkillId: 'skill_active_listening', parentSkillId: 'cat_communication' },

  // Problem Solving
  { childSkillId: 'skill_analytical', parentSkillId: 'cat_problem_solving' },
  { childSkillId: 'skill_debugging', parentSkillId: 'cat_problem_solving' },
  { childSkillId: 'skill_root_cause', parentSkillId: 'cat_problem_solving' },
  { childSkillId: 'skill_ambiguity', parentSkillId: 'cat_problem_solving' },
  { childSkillId: 'skill_creativity', parentSkillId: 'cat_problem_solving' },
  { childSkillId: 'skill_prioritization', parentSkillId: 'cat_problem_solving' },
  { childSkillId: 'skill_tradeoffs', parentSkillId: 'cat_problem_solving' },

  // Execution
  { childSkillId: 'skill_ownership', parentSkillId: 'cat_execution' },
  { childSkillId: 'skill_accountability', parentSkillId: 'cat_execution' },
  { childSkillId: 'skill_time_management', parentSkillId: 'cat_execution' },
  { childSkillId: 'skill_estimation', parentSkillId: 'cat_execution' },
  { childSkillId: 'skill_attention_detail', parentSkillId: 'cat_execution' },
  { childSkillId: 'skill_follow_through', parentSkillId: 'cat_execution' },
  { childSkillId: 'skill_pressure', parentSkillId: 'cat_execution' },

  // Collaboration
  { childSkillId: 'skill_code_review', parentSkillId: 'cat_collaboration' },
  { childSkillId: 'skill_pair_programming', parentSkillId: 'cat_collaboration' },
  { childSkillId: 'skill_knowledge_sharing', parentSkillId: 'cat_collaboration' },
  { childSkillId: 'skill_teamwork', parentSkillId: 'cat_collaboration' },
  { childSkillId: 'skill_remote_collab', parentSkillId: 'cat_collaboration' },

  // Growth
  { childSkillId: 'skill_learning', parentSkillId: 'cat_growth' },
  { childSkillId: 'skill_adaptability', parentSkillId: 'cat_growth' },
  { childSkillId: 'skill_resilience', parentSkillId: 'cat_growth' },
  { childSkillId: 'skill_self_awareness', parentSkillId: 'cat_growth' },
  { childSkillId: 'skill_curiosity', parentSkillId: 'cat_growth' },

  // Domain knowledge
  { childSkillId: 'skill_ai_ml', parentSkillId: 'cat_domain' },
  { childSkillId: 'skill_blockchain', parentSkillId: 'cat_domain' },
  { childSkillId: 'skill_fintech', parentSkillId: 'cat_domain' },
  { childSkillId: 'skill_healthcare', parentSkillId: 'cat_domain' },
  { childSkillId: 'skill_ecommerce', parentSkillId: 'cat_domain' },
  { childSkillId: 'skill_saas', parentSkillId: 'cat_domain' },
  { childSkillId: 'skill_marketplace', parentSkillId: 'cat_domain' },

  // Role-based categories are now linked to cat_technical but their
  // skill membership uses BELONGS_TO (see skillCategoryMemberships below)
  { childSkillId: 'cat_backend', parentSkillId: 'cat_technical' },
  { childSkillId: 'cat_frontend', parentSkillId: 'cat_technical' },
  { childSkillId: 'cat_fullstack', parentSkillId: 'cat_technical' },
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
// Non-transitive category membership for role-based categories
// (Backend, Frontend, Full Stack)

export const skillCategoryMemberships: SkillCategoryMembership[] = [
  // Frontend skills
  { skillId: 'skill_javascript', categoryId: 'cat_frontend' },
  { skillId: 'skill_typescript', categoryId: 'cat_frontend' },
  { skillId: 'skill_react', categoryId: 'cat_frontend' },
  { skillId: 'skill_nextjs', categoryId: 'cat_frontend' },
  { skillId: 'skill_vue', categoryId: 'cat_frontend' },
  { skillId: 'skill_angular', categoryId: 'cat_frontend' },

  // Backend skills - languages
  { skillId: 'skill_javascript', categoryId: 'cat_backend' },  // JS is BOTH!
  { skillId: 'skill_typescript', categoryId: 'cat_backend' },  // TS is BOTH!
  { skillId: 'skill_nodejs', categoryId: 'cat_backend' },
  { skillId: 'skill_express', categoryId: 'cat_backend' },
  { skillId: 'skill_nestjs', categoryId: 'cat_backend' },
  { skillId: 'skill_python', categoryId: 'cat_backend' },
  { skillId: 'skill_django', categoryId: 'cat_backend' },
  { skillId: 'skill_fastapi', categoryId: 'cat_backend' },
  { skillId: 'skill_java', categoryId: 'cat_backend' },
  { skillId: 'skill_spring', categoryId: 'cat_backend' },
  { skillId: 'skill_go', categoryId: 'cat_backend' },
  { skillId: 'skill_rust', categoryId: 'cat_backend' },
  // Backend - databases
  { skillId: 'skill_postgresql', categoryId: 'cat_backend' },
  { skillId: 'skill_mysql', categoryId: 'cat_backend' },
  { skillId: 'skill_mongodb', categoryId: 'cat_backend' },
  { skillId: 'skill_redis', categoryId: 'cat_backend' },
  { skillId: 'skill_dynamodb', categoryId: 'cat_backend' },
  { skillId: 'skill_neo4j', categoryId: 'cat_backend' },
  { skillId: 'skill_kafka', categoryId: 'cat_backend' },
  // Backend - architecture
  { skillId: 'skill_api_design', categoryId: 'cat_backend' },
  { skillId: 'skill_rest_api', categoryId: 'cat_backend' },
  { skillId: 'skill_graphql', categoryId: 'cat_backend' },
  { skillId: 'skill_grpc', categoryId: 'cat_backend' },
  { skillId: 'skill_system_design', categoryId: 'cat_backend' },
  { skillId: 'skill_microservices', categoryId: 'cat_backend' },
  { skillId: 'skill_event_driven', categoryId: 'cat_backend' },
  { skillId: 'skill_distributed', categoryId: 'cat_backend' },

  // Full Stack = skills that belong to BOTH Frontend and Backend
  // (handled by having skills in both categories above)
  // The cat_fullstack category itself gets BELONGS_TO from cat_backend and cat_frontend
  { skillId: 'cat_backend', categoryId: 'cat_fullstack' },
  { skillId: 'cat_frontend', categoryId: 'cat_fullstack' },
];
