import { Session } from 'neo4j-driver';

interface EngineerResume {
  engineerId: string;
  resumeText: string;
}

interface EngineerWorkExperience {
  id: string;
  engineerId: string;
  companyName: string;
  title: string;
  seniority: 'junior' | 'mid' | 'senior' | 'staff' | 'principal';
  startDate: string;
  endDate: string | 'present';
  highlights: string[];
}

interface WorkExperienceSkillLink {
  userSkillId: string;
  workExperienceId: string;
}

// ============================================
// ORIGINAL CORE ENGINEERS (5)
// ============================================

const coreEngineerResumes: EngineerResume[] = [
  // Priya Sharma - Senior Backend Engineer | Fintech & Payments (8 years)
  {
    engineerId: 'eng_priya',
    resumeText: `PRIYA SHARMA
priya.sharma@email.com | (617) 555-0142 | Boston, MA

SUMMARY
Senior Backend Engineer with 8 years of experience building scalable payment systems and financial infrastructure. Expert in TypeScript, Node.js, and designing high-throughput APIs for fintech applications. Led teams through multiple successful product launches processing millions in daily transactions.

EXPERIENCE

Stripe | San Francisco, CA (Remote)
Senior Software Engineer | Jan 2021 - Present
- Architected and implemented payment reconciliation system handling $50M+ daily transaction volume
- Led migration of legacy payment processing pipeline to event-driven architecture using Kafka
- Designed and built microservices for merchant onboarding, reducing integration time by 80%
- Mentored team of 4 junior engineers, conducting code reviews and establishing best practices

PayPal | Boston, MA
Software Engineer II | Mar 2018 - Dec 2020
- Developed REST APIs for payment gateway integration serving 10,000+ requests per second
- Implemented fraud detection rules engine using Python, blocking $2M+ in fraudulent transactions
- Built internal tooling for transaction monitoring and dispute resolution

Capital One | McLean, VA
Software Engineer | Jun 2016 - Feb 2018
- Built backend services for credit card rewards program using Node.js and PostgreSQL
- Developed automated testing framework reducing regression testing time by 60%
- Created APIs for mobile banking application serving 1M+ users

EDUCATION

Georgia Institute of Technology
B.S. Computer Science | 2016

SKILLS
Languages & Frameworks: TypeScript, Node.js, Python, Express, NestJS
Databases: PostgreSQL, Redis, Kafka
Infrastructure: AWS, Docker, Kubernetes
Architecture: Microservices, Event-Driven Architecture, REST API Design, System Design`,
  },

  // Marcus Chen - Full Stack Engineer | React & Node.js (5 years)
  {
    engineerId: 'eng_marcus',
    resumeText: `MARCUS CHEN
marcus.chen@email.com | (415) 555-0198 | San Francisco, CA

SUMMARY
Full Stack Engineer with 5 years of experience building modern web applications. Passionate about creating seamless user experiences with React and building robust backend services with Node.js. Strong ownership mentality and continuous learner.

EXPERIENCE

Airbnb | San Francisco, CA
Software Engineer | Mar 2022 - Present
- Built and maintained React components for the host dashboard, improving engagement by 25%
- Developed GraphQL APIs for property management features serving 500K+ hosts
- Implemented real-time messaging features using WebSockets and Redis
- Led migration from legacy jQuery codebase to modern React architecture

Figma | San Francisco, CA
Frontend Engineer | Jun 2020 - Feb 2022
- Developed collaborative design features using React and TypeScript
- Built plugin marketplace frontend serving 10K+ plugins
- Optimized rendering performance reducing load times by 40%

TechStartup Inc | San Francisco, CA
Junior Full Stack Developer | Aug 2019 - May 2020
- Built full-stack features for SaaS analytics platform using React and Node.js
- Implemented user authentication and authorization system
- Created automated deployment pipeline using Docker and GitHub Actions

EDUCATION

University of California, Berkeley
B.S. Computer Science | 2019

SKILLS
Languages & Frameworks: TypeScript, JavaScript, React, Next.js, Node.js, Express
Databases: PostgreSQL, MongoDB, Redis
Tools: Docker, GraphQL, Git, GitHub Actions`,
  },

  // Sofia Rodriguez - Platform Engineer | Kubernetes & AWS (7 years)
  {
    engineerId: 'eng_sofia',
    resumeText: `SOFIA RODRIGUEZ
sofia.rodriguez@email.com | (312) 555-0176 | Chicago, IL

SUMMARY
Platform Engineer with 7 years of experience building and maintaining cloud infrastructure at scale. Expert in Kubernetes, AWS, and infrastructure-as-code. Passionate about reliability, automation, and enabling developer productivity through robust platform tooling.

EXPERIENCE

Datadog | New York, NY (Remote)
Senior Platform Engineer | Feb 2021 - Present
- Designed and implemented multi-region Kubernetes clusters serving 10K+ pods
- Built Terraform modules for standardized AWS infrastructure provisioning
- Reduced deployment times by 70% through CI/CD pipeline optimization
- Led incident response and established SRE practices reducing MTTR by 50%

Twilio | San Francisco, CA (Remote)
Platform Engineer | Aug 2018 - Jan 2021
- Managed Kubernetes clusters processing 100B+ API calls monthly
- Implemented Helm charts for standardized application deployments
- Built monitoring and alerting infrastructure using Prometheus and Grafana
- Developed automated scaling solutions reducing infrastructure costs by 30%

IBM | Chicago, IL
DevOps Engineer | Jul 2017 - Jul 2018
- Migrated legacy applications to containerized architecture using Docker
- Implemented infrastructure monitoring and logging solutions
- Automated deployment processes using Jenkins and Ansible

EDUCATION

University of Illinois at Urbana-Champaign
B.S. Computer Science | 2017

SKILLS
Infrastructure: Kubernetes, Docker, AWS, Terraform, Helm
Languages: Python, Go, Bash
Monitoring: Prometheus, Grafana, Datadog
Practices: GitOps, Infrastructure-as-Code, SRE, System Design`,
  },

  // James Okonkwo - Staff Engineer | Distributed Systems (12 years)
  {
    engineerId: 'eng_james',
    resumeText: `JAMES OKONKWO
james.okonkwo@email.com | (202) 555-0134 | Washington, DC

SUMMARY
Staff Engineer with 12 years of experience architecting and building large-scale distributed systems. Deep expertise in Java, event-driven architecture, and system design. Proven track record of leading technical initiatives, mentoring engineers, and driving architectural decisions that scale to millions of users.

EXPERIENCE

Amazon | Seattle, WA (Remote)
Staff Software Engineer | Jan 2020 - Present
- Architected order processing system handling 50M+ daily transactions across global regions
- Led design and implementation of event-driven microservices using Kafka and Java
- Mentored 8 engineers and established architectural patterns adopted org-wide
- Reduced system latency by 60% through strategic caching and query optimization

Goldman Sachs | New York, NY
Senior Software Engineer | Mar 2016 - Dec 2019
- Built real-time trading platform components processing $10B+ daily volume
- Designed fault-tolerant distributed systems with 99.99% uptime requirements
- Led migration from monolithic architecture to microservices
- Established coding standards and review practices for 20+ person team

JPMorgan Chase | New York, NY
Software Engineer | Jun 2012 - Feb 2016
- Developed backend services for retail banking applications
- Built batch processing systems handling millions of daily transactions
- Implemented disaster recovery solutions and failover mechanisms

EDUCATION

Carnegie Mellon University
M.S. Computer Science | 2012
B.S. Computer Science | 2010

SKILLS
Languages & Frameworks: Java, Spring Boot, Python, Kafka
Databases: PostgreSQL, DynamoDB, Redis
Architecture: Distributed Systems, Event-Driven Architecture, Microservices, System Design
Leadership: Technical Leadership, Mentorship, Architectural Decision Making`,
  },

  // Emily Nakamura - Frontend Engineer | React & Design Systems (4 years)
  {
    engineerId: 'eng_emily',
    resumeText: `EMILY NAKAMURA
emily.nakamura@email.com | (650) 555-0167 | San Jose, CA

SUMMARY
Frontend Engineer with 4 years of experience building beautiful, accessible user interfaces. Specialized in React and design systems, with a keen eye for detail and passion for creating consistent user experiences across products.

EXPERIENCE

Shopify | San Francisco, CA (Remote)
Frontend Engineer | May 2022 - Present
- Built and maintained Polaris design system components used by 500+ developers
- Developed React components for merchant dashboard serving 2M+ stores
- Improved accessibility compliance achieving WCAG 2.1 AA standards
- Collaborated with designers to establish component documentation standards

Square | San Francisco, CA
Frontend Developer | Jan 2021 - Apr 2022
- Built checkout flow components for Square Online increasing conversion by 15%
- Implemented responsive design patterns for mobile-first e-commerce experiences
- Created reusable React component library reducing development time by 30%

E-commerce Startup | San Jose, CA
Junior Frontend Developer | Aug 2020 - Dec 2020
- Developed product catalog pages using React and Next.js
- Implemented search and filtering functionality for 10K+ product SKUs
- Built shopping cart and checkout UI components

EDUCATION

San Jose State University
B.S. Computer Science | 2020

SKILLS
Languages & Frameworks: TypeScript, JavaScript, React, Next.js
Testing: Jest, React Testing Library, Cypress
Tools: GraphQL, Figma, Storybook
Practices: Accessibility, Design Systems, Cross-Functional Collaboration`,
  },
];

const coreEngineerWorkExperiences: EngineerWorkExperience[] = [
  // Priya
  { id: 'we_priya_stripe', engineerId: 'eng_priya', companyName: 'Stripe', title: 'Senior Software Engineer', seniority: 'senior', startDate: '2021-01', endDate: 'present', highlights: ['Architected payment reconciliation system handling $50M+ daily', 'Led Kafka migration', 'Mentored team of 4'] },
  { id: 'we_priya_paypal', engineerId: 'eng_priya', companyName: 'PayPal', title: 'Software Engineer II', seniority: 'mid', startDate: '2018-03', endDate: '2020-12', highlights: ['Developed REST APIs serving 10K+ RPS', 'Implemented fraud detection'] },
  { id: 'we_priya_capitalone', engineerId: 'eng_priya', companyName: 'Capital One', title: 'Software Engineer', seniority: 'junior', startDate: '2016-06', endDate: '2018-02', highlights: ['Built backend services for rewards program', 'Created mobile banking APIs'] },
  // Marcus
  { id: 'we_marcus_airbnb', engineerId: 'eng_marcus', companyName: 'Airbnb', title: 'Software Engineer', seniority: 'mid', startDate: '2022-03', endDate: 'present', highlights: ['Built React components for host dashboard', 'Developed GraphQL APIs'] },
  { id: 'we_marcus_figma', engineerId: 'eng_marcus', companyName: 'Figma', title: 'Frontend Engineer', seniority: 'mid', startDate: '2020-06', endDate: '2022-02', highlights: ['Built plugin marketplace frontend', 'Optimized rendering performance'] },
  { id: 'we_marcus_startup', engineerId: 'eng_marcus', companyName: 'TechStartup Inc', title: 'Junior Full Stack Developer', seniority: 'junior', startDate: '2019-08', endDate: '2020-05', highlights: ['Built SaaS analytics platform', 'Implemented auth system'] },
  // Sofia
  { id: 'we_sofia_datadog', engineerId: 'eng_sofia', companyName: 'Datadog', title: 'Senior Platform Engineer', seniority: 'senior', startDate: '2021-02', endDate: 'present', highlights: ['Designed multi-region Kubernetes clusters', 'Built Terraform modules'] },
  { id: 'we_sofia_twilio', engineerId: 'eng_sofia', companyName: 'Twilio', title: 'Platform Engineer', seniority: 'mid', startDate: '2018-08', endDate: '2021-01', highlights: ['Managed Kubernetes clusters for 100B+ API calls', 'Implemented Helm charts'] },
  { id: 'we_sofia_ibm', engineerId: 'eng_sofia', companyName: 'IBM', title: 'DevOps Engineer', seniority: 'junior', startDate: '2017-07', endDate: '2018-07', highlights: ['Migrated apps to containers', 'Automated deployments'] },
  // James
  { id: 'we_james_amazon', engineerId: 'eng_james', companyName: 'Amazon', title: 'Staff Software Engineer', seniority: 'staff', startDate: '2020-01', endDate: 'present', highlights: ['Architected order processing for 50M+ daily transactions', 'Mentored 8 engineers'] },
  { id: 'we_james_goldman', engineerId: 'eng_james', companyName: 'Goldman Sachs', title: 'Senior Software Engineer', seniority: 'senior', startDate: '2016-03', endDate: '2019-12', highlights: ['Built trading platform for $10B+ daily volume', 'Led microservices migration'] },
  { id: 'we_james_jpmorgan', engineerId: 'eng_james', companyName: 'JPMorgan Chase', title: 'Software Engineer', seniority: 'mid', startDate: '2012-06', endDate: '2016-02', highlights: ['Developed retail banking backend', 'Built batch processing systems'] },
  // Emily
  { id: 'we_emily_shopify', engineerId: 'eng_emily', companyName: 'Shopify', title: 'Frontend Engineer', seniority: 'mid', startDate: '2022-05', endDate: 'present', highlights: ['Built Polaris design system components', 'Improved accessibility'] },
  { id: 'we_emily_square', engineerId: 'eng_emily', companyName: 'Square', title: 'Frontend Developer', seniority: 'junior', startDate: '2021-01', endDate: '2022-04', highlights: ['Built checkout flow components', 'Created React component library'] },
  { id: 'we_emily_startup', engineerId: 'eng_emily', companyName: 'E-commerce Startup', title: 'Junior Frontend Developer', seniority: 'junior', startDate: '2020-08', endDate: '2020-12', highlights: ['Developed product catalog pages', 'Built shopping cart UI'] },
];

const coreEngineerSkillLinks: WorkExperienceSkillLink[] = [
  // Priya - Stripe
  { userSkillId: 'es_priya_typescript', workExperienceId: 'we_priya_stripe' },
  { userSkillId: 'es_priya_nodejs', workExperienceId: 'we_priya_stripe' },
  { userSkillId: 'es_priya_kafka', workExperienceId: 'we_priya_stripe' },
  { userSkillId: 'es_priya_postgresql', workExperienceId: 'we_priya_stripe' },
  { userSkillId: 'es_priya_aws', workExperienceId: 'we_priya_stripe' },
  { userSkillId: 'es_priya_microservices', workExperienceId: 'we_priya_stripe' },
  { userSkillId: 'es_priya_api_design', workExperienceId: 'we_priya_stripe' },
  { userSkillId: 'es_priya_system_design', workExperienceId: 'we_priya_stripe' },
  { userSkillId: 'es_priya_tech_leadership', workExperienceId: 'we_priya_stripe' },
  { userSkillId: 'es_priya_mentorship', workExperienceId: 'we_priya_stripe' },
  // Priya - PayPal
  { userSkillId: 'es_priya_nodejs', workExperienceId: 'we_priya_paypal' },
  { userSkillId: 'es_priya_postgresql', workExperienceId: 'we_priya_paypal' },
  { userSkillId: 'es_priya_api_design', workExperienceId: 'we_priya_paypal' },
  // Priya - Capital One
  { userSkillId: 'es_priya_nodejs', workExperienceId: 'we_priya_capitalone' },
  { userSkillId: 'es_priya_postgresql', workExperienceId: 'we_priya_capitalone' },
  // Marcus - Airbnb
  { userSkillId: 'es_marcus_react', workExperienceId: 'we_marcus_airbnb' },
  { userSkillId: 'es_marcus_typescript', workExperienceId: 'we_marcus_airbnb' },
  { userSkillId: 'es_marcus_graphql', workExperienceId: 'we_marcus_airbnb' },
  { userSkillId: 'es_marcus_nodejs', workExperienceId: 'we_marcus_airbnb' },
  { userSkillId: 'es_marcus_postgresql', workExperienceId: 'we_marcus_airbnb' },
  { userSkillId: 'es_marcus_ownership', workExperienceId: 'we_marcus_airbnb' },
  // Marcus - Figma
  { userSkillId: 'es_marcus_react', workExperienceId: 'we_marcus_figma' },
  { userSkillId: 'es_marcus_typescript', workExperienceId: 'we_marcus_figma' },
  // Marcus - Startup
  { userSkillId: 'es_marcus_react', workExperienceId: 'we_marcus_startup' },
  { userSkillId: 'es_marcus_nodejs', workExperienceId: 'we_marcus_startup' },
  { userSkillId: 'es_marcus_docker', workExperienceId: 'we_marcus_startup' },
  { userSkillId: 'es_marcus_learning', workExperienceId: 'we_marcus_startup' },
  // Sofia - Datadog
  { userSkillId: 'es_sofia_kubernetes', workExperienceId: 'we_sofia_datadog' },
  { userSkillId: 'es_sofia_terraform', workExperienceId: 'we_sofia_datadog' },
  { userSkillId: 'es_sofia_aws', workExperienceId: 'we_sofia_datadog' },
  { userSkillId: 'es_sofia_monitoring', workExperienceId: 'we_sofia_datadog' },
  { userSkillId: 'es_sofia_system_design', workExperienceId: 'we_sofia_datadog' },
  { userSkillId: 'es_sofia_debugging', workExperienceId: 'we_sofia_datadog' },
  // Sofia - Twilio
  { userSkillId: 'es_sofia_kubernetes', workExperienceId: 'we_sofia_twilio' },
  { userSkillId: 'es_sofia_helm', workExperienceId: 'we_sofia_twilio' },
  { userSkillId: 'es_sofia_monitoring', workExperienceId: 'we_sofia_twilio' },
  { userSkillId: 'es_sofia_python', workExperienceId: 'we_sofia_twilio' },
  // Sofia - IBM
  { userSkillId: 'es_sofia_docker', workExperienceId: 'we_sofia_ibm' },
  { userSkillId: 'es_sofia_python', workExperienceId: 'we_sofia_ibm' },
  // James - Amazon
  { userSkillId: 'es_james_distributed', workExperienceId: 'we_james_amazon' },
  { userSkillId: 'es_james_system_design', workExperienceId: 'we_james_amazon' },
  { userSkillId: 'es_james_java', workExperienceId: 'we_james_amazon' },
  { userSkillId: 'es_james_kafka', workExperienceId: 'we_james_amazon' },
  { userSkillId: 'es_james_event_driven', workExperienceId: 'we_james_amazon' },
  { userSkillId: 'es_james_tech_leadership', workExperienceId: 'we_james_amazon' },
  { userSkillId: 'es_james_mentorship', workExperienceId: 'we_james_amazon' },
  { userSkillId: 'es_james_tradeoffs', workExperienceId: 'we_james_amazon' },
  { userSkillId: 'es_james_decision_making', workExperienceId: 'we_james_amazon' },
  // James - Goldman
  { userSkillId: 'es_james_java', workExperienceId: 'we_james_goldman' },
  { userSkillId: 'es_james_distributed', workExperienceId: 'we_james_goldman' },
  { userSkillId: 'es_james_postgresql', workExperienceId: 'we_james_goldman' },
  { userSkillId: 'es_james_system_design', workExperienceId: 'we_james_goldman' },
  // James - JPMorgan
  { userSkillId: 'es_james_java', workExperienceId: 'we_james_jpmorgan' },
  { userSkillId: 'es_james_spring', workExperienceId: 'we_james_jpmorgan' },
  { userSkillId: 'es_james_postgresql', workExperienceId: 'we_james_jpmorgan' },
  // Emily - Shopify
  { userSkillId: 'es_emily_react', workExperienceId: 'we_emily_shopify' },
  { userSkillId: 'es_emily_typescript', workExperienceId: 'we_emily_shopify' },
  { userSkillId: 'es_emily_unit_testing', workExperienceId: 'we_emily_shopify' },
  { userSkillId: 'es_emily_attention_detail', workExperienceId: 'we_emily_shopify' },
  { userSkillId: 'es_emily_cross_functional', workExperienceId: 'we_emily_shopify' },
  // Emily - Square
  { userSkillId: 'es_emily_react', workExperienceId: 'we_emily_square' },
  { userSkillId: 'es_emily_nextjs', workExperienceId: 'we_emily_square' },
  // Emily - Startup
  { userSkillId: 'es_emily_react', workExperienceId: 'we_emily_startup' },
  { userSkillId: 'es_emily_nextjs', workExperienceId: 'we_emily_startup' },
  { userSkillId: 'es_emily_curiosity', workExperienceId: 'we_emily_startup' },
];

// ============================================
// JUNIOR ENGINEERS (6)
// ============================================

const juniorEngineerResumes: EngineerResume[] = [
  // Maya Johnson - Frontend Engineer | React & TypeScript (2 years)
  {
    engineerId: 'eng_maya',
    resumeText: `MAYA JOHNSON
maya.johnson@email.com | (212) 555-0189 | New York, NY

SUMMARY
Frontend Engineer with 2 years of experience building modern web applications with React and TypeScript. Quick learner with strong attention to detail and passion for creating polished user interfaces.

EXPERIENCE

HubSpot | Boston, MA (Remote)
Frontend Engineer | Jun 2023 - Present
- Developed React components for marketing automation dashboard
- Implemented responsive designs serving 100K+ daily active users
- Built unit tests achieving 85% code coverage using Jest
- Collaborated with design team to improve UI consistency

SaaS Analytics Co | New York, NY
Junior Frontend Developer | Jan 2023 - May 2023
- Built data visualization components using React and D3.js
- Implemented TypeScript types improving code reliability
- Participated in code reviews and agile ceremonies

Tech Bootcamp Project | New York, NY
Student Developer | Sep 2022 - Dec 2022
- Built full-stack web application using React and Node.js
- Implemented user authentication and dashboard features

EDUCATION

General Assembly
Software Engineering Immersive | 2022

CUNY Hunter College
B.A. Mathematics | 2022

SKILLS
Languages & Frameworks: JavaScript, TypeScript, React, Next.js
Testing: Jest, React Testing Library
Practices: Responsive Design, Unit Testing, Continuous Learning`,
  },

  // Kevin Park - Backend Engineer | Python & Django (3 years)
  {
    engineerId: 'eng_kevin',
    resumeText: `KEVIN PARK
kevin.park@email.com | (310) 555-0145 | Los Angeles, CA

SUMMARY
Backend Engineer with 3 years of experience building Python applications and REST APIs. Strong foundation in Django and PostgreSQL with growing expertise in containerization and API design.

EXPERIENCE

Plaid | San Francisco, CA (Remote)
Backend Engineer | Mar 2023 - Present
- Developed Python APIs for financial data aggregation
- Built microservices handling 5K+ requests per second
- Implemented unit and integration tests using pytest
- Contributed to API documentation and developer guides

HealthTech Startup | Los Angeles, CA
Junior Backend Developer | Jun 2022 - Feb 2023
- Built Django REST APIs for patient portal application
- Designed PostgreSQL schemas for healthcare data
- Implemented basic Docker containerization for local development

Freelance | Los Angeles, CA
Web Developer | Jan 2022 - May 2022
- Built Python scripts for data processing automation
- Created simple web applications for small businesses

EDUCATION

UCLA
B.S. Computer Science | 2021

SKILLS
Languages & Frameworks: Python, Django, FastAPI
Databases: PostgreSQL, Redis
Tools: Docker, Git, pytest
Practices: REST API Design, Unit Testing, Ownership`,
  },

  // Jordan Williams - Frontend Developer | React & Tailwind (2 years)
  {
    engineerId: 'eng_jordan',
    resumeText: `JORDAN WILLIAMS
jordan.williams@email.com | (773) 555-0123 | Chicago, IL

SUMMARY
Frontend Developer with 2 years of experience creating responsive web applications. Focused on React development with strong eye for design implementation and attention to detail.

EXPERIENCE

Grubhub | Chicago, IL
Frontend Developer | Aug 2023 - Present
- Built React components for restaurant partner dashboard
- Implemented responsive layouts using Tailwind CSS
- Collaborated with backend team on API integration
- Participated in accessibility improvements

Marketing Agency | Chicago, IL
Junior Web Developer | Feb 2023 - Jul 2023
- Developed landing pages and marketing sites
- Built interactive components using JavaScript and React
- Maintained client websites and implemented updates

Internship | Chicago, IL
Web Development Intern | Jun 2022 - Jan 2023
- Assisted senior developers with frontend tasks
- Learned React and modern JavaScript practices

EDUCATION

DePaul University
B.S. Computer Science | 2022

SKILLS
Languages & Frameworks: JavaScript, TypeScript, React
Styling: Tailwind CSS, CSS3, Responsive Design
Practices: Cross-Functional Collaboration, Attention to Detail, Continuous Learning`,
  },

  // Carlos Mendez - Full Stack Developer | Node.js & React (3 years)
  {
    engineerId: 'eng_carlos',
    resumeText: `CARLOS MENDEZ
carlos.mendez@email.com | (720) 555-0167 | Denver, CO

SUMMARY
Full Stack Developer with 3 years of experience building web applications with Node.js and React. Adaptable problem-solver with strong ownership mentality and experience in e-commerce development.

EXPERIENCE

Etsy | Brooklyn, NY (Remote)
Full Stack Developer | Apr 2023 - Present
- Built features for seller tools using React and Node.js
- Developed Express APIs for inventory management
- Implemented MongoDB queries for product search
- Collaborated with cross-functional teams on feature releases

E-commerce Startup | Denver, CO
Junior Developer | Sep 2022 - Mar 2023
- Built shopping cart and checkout features
- Developed REST APIs using Express and MongoDB
- Implemented basic Docker setup for development

Freelance | Denver, CO
Web Developer | Jan 2022 - Aug 2022
- Built websites for local businesses
- Created Node.js backends for small applications

EDUCATION

University of Colorado Boulder
B.S. Computer Science | 2021

SKILLS
Languages & Frameworks: JavaScript, Node.js, Express, React
Databases: MongoDB, PostgreSQL
Tools: Docker, Git
Practices: Ownership, Adaptability, Full Stack Development`,
  },

  // Ashley Chen - Frontend Developer | Vue.js (1 year)
  {
    engineerId: 'eng_ashley',
    resumeText: `ASHLEY CHEN
ashley.chen@email.com | (206) 555-0134 | Seattle, WA

SUMMARY
Frontend Developer with 1 year of experience specializing in Vue.js development. Fast learner with strong curiosity and attention to detail. Eager to grow technical skills and contribute to impactful projects.

EXPERIENCE

Zillow | Seattle, WA
Junior Frontend Developer | Jul 2024 - Present
- Building Vue.js components for property listing features
- Implementing responsive designs for mobile-first experience
- Learning TypeScript and applying it to new components
- Participating in code reviews and team learning sessions

Web Agency | Seattle, WA
Frontend Intern | Jan 2024 - Jun 2024
- Built interactive components using Vue.js
- Assisted with website maintenance and updates
- Learned modern JavaScript and Vue development practices

EDUCATION

University of Washington
B.S. Informatics | 2023

SKILLS
Languages & Frameworks: JavaScript, Vue.js, TypeScript (learning)
Styling: CSS3, SCSS, Responsive Design
Practices: Attention to Detail, Continuous Learning, Curiosity`,
  },

  // Tyler Brooks - Backend Developer | Java & Spring Boot (3 years)
  {
    engineerId: 'eng_tyler',
    resumeText: `TYLER BROOKS
tyler.brooks@email.com | (602) 555-0178 | Phoenix, AZ

SUMMARY
Backend Developer with 3 years of experience building Java applications with Spring Boot. Strong foundation in relational databases and API development with growing interest in fintech systems.

EXPERIENCE

American Express | Phoenix, AZ
Backend Developer | May 2023 - Present
- Developing Java microservices for card processing systems
- Building Spring Boot APIs for merchant services
- Writing unit tests using JUnit and Mockito
- Learning API design patterns and best practices

Insurance Tech Co | Phoenix, AZ
Junior Java Developer | Aug 2022 - Apr 2023
- Built backend services using Spring Boot
- Developed MySQL database schemas and queries
- Implemented basic API endpoints for policy management

University IT Department | Phoenix, AZ
Student Developer | Jan 2022 - May 2022
- Maintained Java applications for student services
- Fixed bugs and implemented minor features

EDUCATION

Arizona State University
B.S. Computer Science | 2022

SKILLS
Languages & Frameworks: Java, Spring Boot
Databases: MySQL, PostgreSQL
Testing: JUnit, Mockito
Practices: Unit Testing, API Design, Ownership, Continuous Learning`,
  },
];

const juniorEngineerWorkExperiences: EngineerWorkExperience[] = [
  // Maya
  { id: 'we_maya_hubspot', engineerId: 'eng_maya', companyName: 'HubSpot', title: 'Frontend Engineer', seniority: 'junior', startDate: '2023-06', endDate: 'present', highlights: ['Built React components for marketing dashboard', 'Achieved 85% test coverage'] },
  { id: 'we_maya_saas', engineerId: 'eng_maya', companyName: 'SaaS Analytics Co', title: 'Junior Frontend Developer', seniority: 'junior', startDate: '2023-01', endDate: '2023-05', highlights: ['Built data visualization components', 'Implemented TypeScript'] },
  // Kevin
  { id: 'we_kevin_plaid', engineerId: 'eng_kevin', companyName: 'Plaid', title: 'Backend Engineer', seniority: 'junior', startDate: '2023-03', endDate: 'present', highlights: ['Developed Python APIs for financial data', 'Built microservices handling 5K+ RPS'] },
  { id: 'we_kevin_healthtech', engineerId: 'eng_kevin', companyName: 'HealthTech Startup', title: 'Junior Backend Developer', seniority: 'junior', startDate: '2022-06', endDate: '2023-02', highlights: ['Built Django REST APIs', 'Designed PostgreSQL schemas'] },
  // Jordan
  { id: 'we_jordan_grubhub', engineerId: 'eng_jordan', companyName: 'Grubhub', title: 'Frontend Developer', seniority: 'junior', startDate: '2023-08', endDate: 'present', highlights: ['Built React components for partner dashboard', 'Implemented responsive layouts'] },
  { id: 'we_jordan_agency', engineerId: 'eng_jordan', companyName: 'Marketing Agency', title: 'Junior Web Developer', seniority: 'junior', startDate: '2023-02', endDate: '2023-07', highlights: ['Developed landing pages', 'Built interactive React components'] },
  // Carlos
  { id: 'we_carlos_etsy', engineerId: 'eng_carlos', companyName: 'Etsy', title: 'Full Stack Developer', seniority: 'junior', startDate: '2023-04', endDate: 'present', highlights: ['Built seller tools features', 'Developed Express APIs'] },
  { id: 'we_carlos_ecommerce', engineerId: 'eng_carlos', companyName: 'E-commerce Startup', title: 'Junior Developer', seniority: 'junior', startDate: '2022-09', endDate: '2023-03', highlights: ['Built shopping cart and checkout', 'Developed REST APIs'] },
  // Ashley
  { id: 'we_ashley_zillow', engineerId: 'eng_ashley', companyName: 'Zillow', title: 'Junior Frontend Developer', seniority: 'junior', startDate: '2024-07', endDate: 'present', highlights: ['Building Vue.js components', 'Learning TypeScript'] },
  { id: 'we_ashley_agency', engineerId: 'eng_ashley', companyName: 'Web Agency', title: 'Frontend Intern', seniority: 'junior', startDate: '2024-01', endDate: '2024-06', highlights: ['Built Vue.js components', 'Learned modern JavaScript'] },
  // Tyler
  { id: 'we_tyler_amex', engineerId: 'eng_tyler', companyName: 'American Express', title: 'Backend Developer', seniority: 'junior', startDate: '2023-05', endDate: 'present', highlights: ['Developing Java microservices', 'Building Spring Boot APIs'] },
  { id: 'we_tyler_insurance', engineerId: 'eng_tyler', companyName: 'Insurance Tech Co', title: 'Junior Java Developer', seniority: 'junior', startDate: '2022-08', endDate: '2023-04', highlights: ['Built Spring Boot backend services', 'Developed MySQL schemas'] },
];

const juniorEngineerSkillLinks: WorkExperienceSkillLink[] = [
  // Maya - HubSpot
  { userSkillId: 'es_maya_react', workExperienceId: 'we_maya_hubspot' },
  { userSkillId: 'es_maya_typescript', workExperienceId: 'we_maya_hubspot' },
  { userSkillId: 'es_maya_unit_testing', workExperienceId: 'we_maya_hubspot' },
  { userSkillId: 'es_maya_attention_detail', workExperienceId: 'we_maya_hubspot' },
  // Maya - SaaS
  { userSkillId: 'es_maya_react', workExperienceId: 'we_maya_saas' },
  { userSkillId: 'es_maya_javascript', workExperienceId: 'we_maya_saas' },
  { userSkillId: 'es_maya_learning', workExperienceId: 'we_maya_saas' },
  { userSkillId: 'es_maya_curiosity', workExperienceId: 'we_maya_saas' },
  // Kevin - Plaid
  { userSkillId: 'es_kevin_python', workExperienceId: 'we_kevin_plaid' },
  { userSkillId: 'es_kevin_postgresql', workExperienceId: 'we_kevin_plaid' },
  { userSkillId: 'es_kevin_api_design', workExperienceId: 'we_kevin_plaid' },
  { userSkillId: 'es_kevin_unit_testing', workExperienceId: 'we_kevin_plaid' },
  { userSkillId: 'es_kevin_ownership', workExperienceId: 'we_kevin_plaid' },
  // Kevin - HealthTech
  { userSkillId: 'es_kevin_python', workExperienceId: 'we_kevin_healthtech' },
  { userSkillId: 'es_kevin_django', workExperienceId: 'we_kevin_healthtech' },
  { userSkillId: 'es_kevin_postgresql', workExperienceId: 'we_kevin_healthtech' },
  { userSkillId: 'es_kevin_docker', workExperienceId: 'we_kevin_healthtech' },
  { userSkillId: 'es_kevin_learning', workExperienceId: 'we_kevin_healthtech' },
  // Jordan - Grubhub
  { userSkillId: 'es_jordan_react', workExperienceId: 'we_jordan_grubhub' },
  { userSkillId: 'es_jordan_typescript', workExperienceId: 'we_jordan_grubhub' },
  { userSkillId: 'es_jordan_attention_detail', workExperienceId: 'we_jordan_grubhub' },
  { userSkillId: 'es_jordan_cross_functional', workExperienceId: 'we_jordan_grubhub' },
  // Jordan - Agency
  { userSkillId: 'es_jordan_react', workExperienceId: 'we_jordan_agency' },
  { userSkillId: 'es_jordan_javascript', workExperienceId: 'we_jordan_agency' },
  { userSkillId: 'es_jordan_learning', workExperienceId: 'we_jordan_agency' },
  // Carlos - Etsy
  { userSkillId: 'es_carlos_nodejs', workExperienceId: 'we_carlos_etsy' },
  { userSkillId: 'es_carlos_react', workExperienceId: 'we_carlos_etsy' },
  { userSkillId: 'es_carlos_express', workExperienceId: 'we_carlos_etsy' },
  { userSkillId: 'es_carlos_mongodb', workExperienceId: 'we_carlos_etsy' },
  { userSkillId: 'es_carlos_ownership', workExperienceId: 'we_carlos_etsy' },
  // Carlos - E-commerce
  { userSkillId: 'es_carlos_nodejs', workExperienceId: 'we_carlos_ecommerce' },
  { userSkillId: 'es_carlos_express', workExperienceId: 'we_carlos_ecommerce' },
  { userSkillId: 'es_carlos_mongodb', workExperienceId: 'we_carlos_ecommerce' },
  { userSkillId: 'es_carlos_docker', workExperienceId: 'we_carlos_ecommerce' },
  { userSkillId: 'es_carlos_adaptability', workExperienceId: 'we_carlos_ecommerce' },
  // Ashley - Zillow
  { userSkillId: 'es_ashley_vue', workExperienceId: 'we_ashley_zillow' },
  { userSkillId: 'es_ashley_javascript', workExperienceId: 'we_ashley_zillow' },
  { userSkillId: 'es_ashley_typescript', workExperienceId: 'we_ashley_zillow' },
  { userSkillId: 'es_ashley_attention_detail', workExperienceId: 'we_ashley_zillow' },
  { userSkillId: 'es_ashley_learning', workExperienceId: 'we_ashley_zillow' },
  // Ashley - Agency
  { userSkillId: 'es_ashley_vue', workExperienceId: 'we_ashley_agency' },
  { userSkillId: 'es_ashley_javascript', workExperienceId: 'we_ashley_agency' },
  { userSkillId: 'es_ashley_curiosity', workExperienceId: 'we_ashley_agency' },
  // Tyler - AmEx
  { userSkillId: 'es_tyler_java', workExperienceId: 'we_tyler_amex' },
  { userSkillId: 'es_tyler_spring', workExperienceId: 'we_tyler_amex' },
  { userSkillId: 'es_tyler_api_design', workExperienceId: 'we_tyler_amex' },
  { userSkillId: 'es_tyler_unit_testing', workExperienceId: 'we_tyler_amex' },
  { userSkillId: 'es_tyler_ownership', workExperienceId: 'we_tyler_amex' },
  // Tyler - Insurance
  { userSkillId: 'es_tyler_java', workExperienceId: 'we_tyler_insurance' },
  { userSkillId: 'es_tyler_spring', workExperienceId: 'we_tyler_insurance' },
  { userSkillId: 'es_tyler_mysql', workExperienceId: 'we_tyler_insurance' },
  { userSkillId: 'es_tyler_learning', workExperienceId: 'we_tyler_insurance' },
];

// ============================================
// MID-LEVEL ENGINEERS (8)
// ============================================

const midLevelEngineerResumes: EngineerResume[] = [
  // Rachel Kim - HIGH-PERFORMING Frontend (Ex-Stripe, 5 years)
  {
    engineerId: 'eng_rachel',
    resumeText: `RACHEL KIM
rachel.kim@email.com | (617) 555-0156 | Boston, MA

SUMMARY
Frontend Engineer with 5 years of experience specializing in React performance optimization and complex UI development. Previously at Stripe where I led performance initiatives that significantly improved user experience. Expert in TypeScript, Next.js, and building high-quality, tested components.

EXPERIENCE

Coinbase | San Francisco, CA (Remote)
Senior Frontend Engineer | Mar 2023 - Present
- Leading frontend architecture for trading platform serving 10M+ users
- Optimized bundle size and lazy loading reducing initial load time by 45%
- Built real-time price chart components handling 1000+ updates per second
- Mentoring junior engineers on React best practices and performance

Stripe | San Francisco, CA
Frontend Engineer | Jun 2020 - Feb 2023
- Built checkout flow components for Stripe Elements increasing conversion by 12%
- Led performance optimization initiative reducing Time to Interactive by 60%
- Developed accessible, WCAG-compliant payment form components
- Created comprehensive test suites achieving 95% code coverage

Fintech Startup | Boston, MA
Junior Frontend Developer | Jan 2019 - May 2020
- Built React dashboard for financial analytics platform
- Implemented responsive designs for mobile banking interface
- Learned and applied TypeScript across the codebase

EDUCATION

MIT
B.S. Computer Science | 2018

SKILLS
Languages & Frameworks: TypeScript, JavaScript, React, Next.js
Performance: Web Vitals, Lighthouse, Bundle Optimization
Testing: Jest, React Testing Library, Cypress
Practices: Performance Optimization, Accessibility, Attention to Detail`,
  },

  // Lisa Wang - HIGH-PERFORMING Backend (Ex-Cloudflare, 5 years)
  {
    engineerId: 'eng_lisa',
    resumeText: `LISA WANG
lisa.wang@email.com | (415) 555-0187 | San Francisco, CA

SUMMARY
Backend Engineer with 5 years of experience building high-performance distributed systems. Former Cloudflare engineer with deep expertise in Go, system design, and building services that handle millions of requests per second. Strong debugging skills and passion for solving complex technical challenges.

EXPERIENCE

Databricks | San Francisco, CA
Senior Backend Engineer | Apr 2023 - Present
- Designing and building data pipeline orchestration services in Go
- Optimized query execution reducing latency by 40% for compute clusters
- Built distributed caching layer serving 100K+ QPS with sub-millisecond latency
- Contributing to open-source Spark integration projects

Cloudflare | San Francisco, CA
Backend Engineer | Aug 2020 - Mar 2023
- Built edge computing services processing 25M+ requests per second globally
- Designed and implemented distributed rate limiting system
- Optimized Go services reducing memory usage by 50% under load
- Led debugging of complex distributed system issues across data centers

SaaS Startup | San Francisco, CA
Junior Backend Developer | Jun 2019 - Jul 2020
- Built REST APIs using Go and PostgreSQL
- Implemented Redis caching reducing database load by 60%
- Developed automated testing and deployment pipelines

EDUCATION

Stanford University
B.S. Computer Science | 2019

SKILLS
Languages: Go, Python, SQL
Databases: PostgreSQL, Redis, DynamoDB
Architecture: Distributed Systems, System Design, High-Performance Computing
Practices: Performance Debugging, Distributed Tracing, Load Testing`,
  },

  // Zoe Martinez - STARTUP GENERALIST (5 years)
  {
    engineerId: 'eng_zoe',
    resumeText: `ZOE MARTINEZ
zoe.martinez@email.com | (415) 555-0143 | San Francisco, CA

SUMMARY
Full Stack Engineer and startup veteran with 5 years of experience building products from 0 to 1. Two-time founding engineer at YC-backed startups. Comfortable wearing many hats, from infrastructure to frontend, and thrive in fast-paced, ambiguous environments. Strong ownership mentality and ability to ship quickly under pressure.

EXPERIENCE

YC Startup (Series A) | San Francisco, CA
Founding Engineer | Feb 2023 - Present
- Built entire MVP in 3 months, from database schema to deployed product
- Architected multi-tenant SaaS platform using React, Node.js, and PostgreSQL
- Set up AWS infrastructure including ECS, RDS, and CI/CD pipelines
- Grew from 0 to 10K users while maintaining 99.9% uptime

YC Startup (Acquired) | San Francisco, CA
Founding Engineer | Mar 2021 - Jan 2023
- Employee #2 at e-commerce platform acquired for $50M
- Built React storefront and Node.js backend handling $10M+ GMV
- Implemented GraphQL API and MongoDB data layer
- Wore multiple hats: engineering, on-call, customer support, hiring

Tech Consultancy | San Francisco, CA
Full Stack Developer | Aug 2019 - Feb 2021
- Delivered 8 client projects across fintech, e-commerce, and SaaS
- Built applications using Python, React, and various databases
- Learned to adapt quickly to new tech stacks and codebases

EDUCATION

UC Berkeley
B.S. Computer Science | 2019

SKILLS
Languages & Frameworks: TypeScript, JavaScript, React, Node.js, Python
Databases: PostgreSQL, MongoDB, Redis
Infrastructure: AWS, Terraform, Docker
Practices: 0-to-1 Product Development, Ownership, Adaptability, Working Under Pressure`,
  },

  // David Kim - Standard Mid-Level (Healthcare Backend, 4 years)
  {
    engineerId: 'eng_david',
    resumeText: `DAVID KIM
david.kim@email.com | (650) 555-0198 | Palo Alto, CA

SUMMARY
Backend Engineer with 4 years of experience building healthcare software systems. Specialized in Python, Django, and working with sensitive medical data under HIPAA compliance. Strong attention to detail and documentation practices essential for regulated environments.

EXPERIENCE

Oscar Health | New York, NY (Remote)
Backend Engineer | May 2022 - Present
- Developing Python microservices for claims processing system
- Built APIs handling 500K+ daily eligibility checks
- Implemented HIPAA-compliant data handling and audit logging
- Created comprehensive API documentation for internal teams

Healthcare Startup | Palo Alto, CA
Junior Backend Developer | Jul 2021 - Apr 2022
- Built Django REST APIs for patient portal application
- Designed PostgreSQL schemas for medical records storage
- Implemented unit tests achieving 80% code coverage
- Contributed to HIPAA compliance documentation

Consulting Firm | San Francisco, CA
Software Developer | Jun 2020 - Jun 2021
- Built backend services for healthcare clients
- Developed Python scripts for data migration projects
- Learned healthcare industry regulations and best practices

EDUCATION

UC San Diego
B.S. Computer Science | 2020

SKILLS
Languages & Frameworks: Python, Django, FastAPI
Databases: PostgreSQL, Redis
Tools: Docker, Git, pytest
Practices: HIPAA Compliance, API Documentation, Attention to Detail`,
  },

  // Mohammed Ali - Standard Mid-Level (DevOps, 4 years)
  {
    engineerId: 'eng_mohammed',
    resumeText: `MOHAMMED ALI
mohammed.ali@email.com | (312) 555-0165 | Chicago, IL

SUMMARY
DevOps Engineer with 4 years of experience building and maintaining cloud infrastructure. Expert in Kubernetes and Terraform with strong focus on automation and reliability. Passionate about improving developer experience through better tooling and processes.

EXPERIENCE

Grubhub | Chicago, IL
DevOps Engineer | Jun 2022 - Present
- Managing Kubernetes clusters serving 50M+ monthly food orders
- Built Terraform modules for AWS infrastructure provisioning
- Implemented Helm charts standardizing application deployments
- Reduced deployment failures by 70% through improved CI/CD pipelines

Cloud Consulting | Chicago, IL
Junior DevOps Engineer | Aug 2021 - May 2022
- Migrated client applications to AWS and Kubernetes
- Built monitoring dashboards using Prometheus and Grafana
- Automated infrastructure provisioning using Terraform
- Provided on-call support and incident response

IT Department | Chicago, IL
Systems Administrator | Jun 2020 - Jul 2021
- Managed Linux servers and Docker containers
- Implemented backup and disaster recovery procedures
- Learned cloud infrastructure and DevOps practices

EDUCATION

University of Illinois Chicago
B.S. Computer Science | 2020

SKILLS
Infrastructure: Kubernetes, Docker, AWS, Terraform, Helm
Languages: Python, Bash, Go
Monitoring: Prometheus, Grafana, Datadog
Practices: GitOps, Infrastructure-as-Code, Debugging`,
  },

  // Aisha Patel - Standard Mid-Level (ML, Healthcare, 5 years)
  {
    engineerId: 'eng_aisha',
    resumeText: `AISHA PATEL
aisha.patel@email.com | (312) 555-0178 | Chicago, IL

SUMMARY
ML Engineer with 5 years of experience building machine learning systems for healthcare applications. Expert in Python, TensorFlow, and working with medical imaging data. Strong analytical skills and attention to detail essential for clinical applications.

EXPERIENCE

Tempus | Chicago, IL
ML Engineer | Mar 2022 - Present
- Building ML models for cancer diagnosis from pathology images
- Developed data pipelines processing 10TB+ of medical imaging data
- Implemented model monitoring and drift detection systems
- Collaborated with clinical teams to validate model predictions

Healthcare AI Startup | Chicago, IL
Junior ML Engineer | Jan 2021 - Feb 2022
- Built TensorFlow models for medical image classification
- Created Spark pipelines for processing clinical trial data
- Developed documentation for model training procedures
- Participated in FDA submission preparation

Research Lab | Chicago, IL
Research Assistant | Jun 2019 - Dec 2020
- Conducted ML research on healthcare applications
- Published 2 papers on medical image analysis
- Built Python tools for data preprocessing

EDUCATION

Northwestern University
M.S. Computer Science (ML focus) | 2021
B.S. Computer Science | 2019

SKILLS
Languages & Frameworks: Python, TensorFlow, PyTorch
Data: Apache Spark, PostgreSQL, Pandas
Tools: Docker, MLflow, Jupyter
Practices: ML Pipelines, Model Validation, Analytical Thinking, Documentation`,
  },

  // Ryan Zhang - Standard Mid-Level (Mobile, Gaming, 4 years)
  {
    engineerId: 'eng_ryan',
    resumeText: `RYAN ZHANG
ryan.zhang@email.com | (720) 555-0134 | Denver, CO

SUMMARY
Mobile Developer with 4 years of experience building cross-platform applications with React Native. Specialized in gaming and entertainment apps with strong focus on smooth animations and user engagement. Excellent cross-functional collaboration skills.

EXPERIENCE

Zynga | San Francisco, CA (Remote)
Mobile Developer | Apr 2022 - Present
- Building React Native features for social gaming platform
- Implemented real-time multiplayer functionality using WebSockets
- Optimized animations achieving consistent 60fps on older devices
- Collaborated with game designers on user engagement features

Gaming Startup | Denver, CO
Junior Mobile Developer | Jun 2021 - Mar 2022
- Built React Native mobile game with 100K+ downloads
- Implemented Firebase backend for leaderboards and achievements
- Developed push notification system increasing daily active users by 25%
- Learning Swift and Kotlin for native module development

Freelance | Denver, CO
Mobile Developer | Aug 2020 - May 2021
- Built mobile apps for local businesses using React Native
- Implemented Firebase authentication and data storage
- Delivered 5 apps to app stores

EDUCATION

Colorado State University
B.S. Computer Science | 2020

SKILLS
Languages & Frameworks: JavaScript, TypeScript, React Native, React
Mobile: iOS, Android, Firebase, Push Notifications
Native: Swift (learning), Kotlin (learning)
Practices: Cross-Platform Development, Animation, Cross-Functional Collaboration`,
  },

  // Emma Wilson - Standard Mid-Level (Frontend, Design Systems, 5 years)
  {
    engineerId: 'eng_emma',
    resumeText: `EMMA WILSON
emma.wilson@email.com | (720) 555-0156 | Denver, CO

SUMMARY
Frontend Engineer with 5 years of experience building React applications and design systems. Passionate about creating consistent, accessible user experiences with strong attention to detail. Experienced in e-commerce and cross-functional collaboration with design teams.

EXPERIENCE

Wayfair | Boston, MA (Remote)
Frontend Engineer | Feb 2022 - Present
- Building React components for product catalog serving 20M+ monthly visitors
- Led migration to Next.js improving SEO and page load performance
- Developed GraphQL queries for product data fetching
- Collaborated with UX team to establish design system patterns

E-commerce Platform | Denver, CO
Frontend Developer | May 2020 - Jan 2022
- Built React checkout flow increasing conversion by 18%
- Created reusable component library used across 3 products
- Implemented unit tests using Jest and React Testing Library
- Documented component APIs and usage guidelines

Marketing Agency | Denver, CO
Junior Frontend Developer | Jun 2019 - Apr 2020
- Built responsive marketing websites using React
- Implemented designs from Figma mockups
- Learned modern CSS and design system concepts

EDUCATION

University of Colorado
B.S. Computer Science | 2019

SKILLS
Languages & Frameworks: TypeScript, JavaScript, React, Next.js
APIs: GraphQL, REST
Testing: Jest, React Testing Library, Cypress
Practices: Design Systems, Accessibility, Documentation, Cross-Functional Collaboration`,
  },
];

const midLevelEngineerWorkExperiences: EngineerWorkExperience[] = [
  // Rachel
  { id: 'we_rachel_coinbase', engineerId: 'eng_rachel', companyName: 'Coinbase', title: 'Senior Frontend Engineer', seniority: 'senior', startDate: '2023-03', endDate: 'present', highlights: ['Leading frontend architecture for trading platform', 'Optimized load time by 45%'] },
  { id: 'we_rachel_stripe', engineerId: 'eng_rachel', companyName: 'Stripe', title: 'Frontend Engineer', seniority: 'mid', startDate: '2020-06', endDate: '2023-02', highlights: ['Built checkout components increasing conversion 12%', 'Led performance optimization'] },
  { id: 'we_rachel_fintech', engineerId: 'eng_rachel', companyName: 'Fintech Startup', title: 'Junior Frontend Developer', seniority: 'junior', startDate: '2019-01', endDate: '2020-05', highlights: ['Built React dashboard', 'Implemented TypeScript'] },
  // Lisa
  { id: 'we_lisa_databricks', engineerId: 'eng_lisa', companyName: 'Databricks', title: 'Senior Backend Engineer', seniority: 'senior', startDate: '2023-04', endDate: 'present', highlights: ['Building data pipeline orchestration', 'Optimized query latency by 40%'] },
  { id: 'we_lisa_cloudflare', engineerId: 'eng_lisa', companyName: 'Cloudflare', title: 'Backend Engineer', seniority: 'mid', startDate: '2020-08', endDate: '2023-03', highlights: ['Built edge services handling 25M+ RPS', 'Designed distributed rate limiting'] },
  { id: 'we_lisa_saas', engineerId: 'eng_lisa', companyName: 'SaaS Startup', title: 'Junior Backend Developer', seniority: 'junior', startDate: '2019-06', endDate: '2020-07', highlights: ['Built REST APIs in Go', 'Implemented Redis caching'] },
  // Zoe
  { id: 'we_zoe_yc2', engineerId: 'eng_zoe', companyName: 'YC Startup (Series A)', title: 'Founding Engineer', seniority: 'mid', startDate: '2023-02', endDate: 'present', highlights: ['Built MVP in 3 months', 'Architected multi-tenant SaaS'] },
  { id: 'we_zoe_yc1', engineerId: 'eng_zoe', companyName: 'YC Startup (Acquired)', title: 'Founding Engineer', seniority: 'mid', startDate: '2021-03', endDate: '2023-01', highlights: ['Employee #2 at acquired startup', 'Built platform handling $10M+ GMV'] },
  { id: 'we_zoe_consultancy', engineerId: 'eng_zoe', companyName: 'Tech Consultancy', title: 'Full Stack Developer', seniority: 'junior', startDate: '2019-08', endDate: '2021-02', highlights: ['Delivered 8 client projects', 'Adapted to various tech stacks'] },
  // David
  { id: 'we_david_oscar', engineerId: 'eng_david', companyName: 'Oscar Health', title: 'Backend Engineer', seniority: 'mid', startDate: '2022-05', endDate: 'present', highlights: ['Building claims processing microservices', 'HIPAA-compliant data handling'] },
  { id: 'we_david_healthcare', engineerId: 'eng_david', companyName: 'Healthcare Startup', title: 'Junior Backend Developer', seniority: 'junior', startDate: '2021-07', endDate: '2022-04', highlights: ['Built Django REST APIs', 'Designed PostgreSQL schemas'] },
  { id: 'we_david_consulting', engineerId: 'eng_david', companyName: 'Consulting Firm', title: 'Software Developer', seniority: 'junior', startDate: '2020-06', endDate: '2021-06', highlights: ['Built healthcare backend services', 'Data migration projects'] },
  // Mohammed
  { id: 'we_mohammed_grubhub', engineerId: 'eng_mohammed', companyName: 'Grubhub', title: 'DevOps Engineer', seniority: 'mid', startDate: '2022-06', endDate: 'present', highlights: ['Managing Kubernetes for 50M+ orders', 'Built Terraform modules'] },
  { id: 'we_mohammed_consulting', engineerId: 'eng_mohammed', companyName: 'Cloud Consulting', title: 'Junior DevOps Engineer', seniority: 'junior', startDate: '2021-08', endDate: '2022-05', highlights: ['Migrated clients to Kubernetes', 'Built monitoring dashboards'] },
  { id: 'we_mohammed_it', engineerId: 'eng_mohammed', companyName: 'IT Department', title: 'Systems Administrator', seniority: 'junior', startDate: '2020-06', endDate: '2021-07', highlights: ['Managed Linux servers', 'Learned cloud infrastructure'] },
  // Aisha
  { id: 'we_aisha_tempus', engineerId: 'eng_aisha', companyName: 'Tempus', title: 'ML Engineer', seniority: 'mid', startDate: '2022-03', endDate: 'present', highlights: ['Building cancer diagnosis ML models', 'Processing 10TB+ medical imaging'] },
  { id: 'we_aisha_healthai', engineerId: 'eng_aisha', companyName: 'Healthcare AI Startup', title: 'Junior ML Engineer', seniority: 'junior', startDate: '2021-01', endDate: '2022-02', highlights: ['Built TensorFlow medical image models', 'Created Spark data pipelines'] },
  { id: 'we_aisha_research', engineerId: 'eng_aisha', companyName: 'Research Lab', title: 'Research Assistant', seniority: 'junior', startDate: '2019-06', endDate: '2020-12', highlights: ['ML research on healthcare', 'Published 2 papers'] },
  // Ryan
  { id: 'we_ryan_zynga', engineerId: 'eng_ryan', companyName: 'Zynga', title: 'Mobile Developer', seniority: 'mid', startDate: '2022-04', endDate: 'present', highlights: ['Building React Native gaming features', 'Implemented multiplayer functionality'] },
  { id: 'we_ryan_gaming', engineerId: 'eng_ryan', companyName: 'Gaming Startup', title: 'Junior Mobile Developer', seniority: 'junior', startDate: '2021-06', endDate: '2022-03', highlights: ['Built mobile game with 100K+ downloads', 'Implemented Firebase backend'] },
  { id: 'we_ryan_freelance', engineerId: 'eng_ryan', companyName: 'Freelance', title: 'Mobile Developer', seniority: 'junior', startDate: '2020-08', endDate: '2021-05', highlights: ['Built 5 React Native apps', 'Delivered to app stores'] },
  // Emma
  { id: 'we_emma_wayfair', engineerId: 'eng_emma', companyName: 'Wayfair', title: 'Frontend Engineer', seniority: 'mid', startDate: '2022-02', endDate: 'present', highlights: ['Building product catalog for 20M+ visitors', 'Led Next.js migration'] },
  { id: 'we_emma_ecommerce', engineerId: 'eng_emma', companyName: 'E-commerce Platform', title: 'Frontend Developer', seniority: 'junior', startDate: '2020-05', endDate: '2022-01', highlights: ['Built checkout increasing conversion 18%', 'Created component library'] },
  { id: 'we_emma_agency', engineerId: 'eng_emma', companyName: 'Marketing Agency', title: 'Junior Frontend Developer', seniority: 'junior', startDate: '2019-06', endDate: '2020-04', highlights: ['Built responsive marketing sites', 'Learned design systems'] },
];

const midLevelEngineerSkillLinks: WorkExperienceSkillLink[] = [
  // Rachel - Coinbase
  { userSkillId: 'es_rachel_react', workExperienceId: 'we_rachel_coinbase' },
  { userSkillId: 'es_rachel_typescript', workExperienceId: 'we_rachel_coinbase' },
  { userSkillId: 'es_rachel_performance', workExperienceId: 'we_rachel_coinbase' },
  { userSkillId: 'es_rachel_nextjs', workExperienceId: 'we_rachel_coinbase' },
  { userSkillId: 'es_rachel_attention_detail', workExperienceId: 'we_rachel_coinbase' },
  // Rachel - Stripe
  { userSkillId: 'es_rachel_react', workExperienceId: 'we_rachel_stripe' },
  { userSkillId: 'es_rachel_typescript', workExperienceId: 'we_rachel_stripe' },
  { userSkillId: 'es_rachel_performance', workExperienceId: 'we_rachel_stripe' },
  { userSkillId: 'es_rachel_unit_testing', workExperienceId: 'we_rachel_stripe' },
  // Rachel - Fintech
  { userSkillId: 'es_rachel_react', workExperienceId: 'we_rachel_fintech' },
  { userSkillId: 'es_rachel_typescript', workExperienceId: 'we_rachel_fintech' },
  // Lisa - Databricks
  { userSkillId: 'es_lisa_go', workExperienceId: 'we_lisa_databricks' },
  { userSkillId: 'es_lisa_distributed', workExperienceId: 'we_lisa_databricks' },
  { userSkillId: 'es_lisa_system_design', workExperienceId: 'we_lisa_databricks' },
  { userSkillId: 'es_lisa_debugging', workExperienceId: 'we_lisa_databricks' },
  // Lisa - Cloudflare
  { userSkillId: 'es_lisa_go', workExperienceId: 'we_lisa_cloudflare' },
  { userSkillId: 'es_lisa_distributed', workExperienceId: 'we_lisa_cloudflare' },
  { userSkillId: 'es_lisa_system_design', workExperienceId: 'we_lisa_cloudflare' },
  { userSkillId: 'es_lisa_debugging', workExperienceId: 'we_lisa_cloudflare' },
  // Lisa - SaaS
  { userSkillId: 'es_lisa_go', workExperienceId: 'we_lisa_saas' },
  { userSkillId: 'es_lisa_postgresql', workExperienceId: 'we_lisa_saas' },
  { userSkillId: 'es_lisa_redis', workExperienceId: 'we_lisa_saas' },
  // Zoe - YC2
  { userSkillId: 'es_zoe_react', workExperienceId: 'we_zoe_yc2' },
  { userSkillId: 'es_zoe_nodejs', workExperienceId: 'we_zoe_yc2' },
  { userSkillId: 'es_zoe_postgresql', workExperienceId: 'we_zoe_yc2' },
  { userSkillId: 'es_zoe_aws', workExperienceId: 'we_zoe_yc2' },
  { userSkillId: 'es_zoe_ownership', workExperienceId: 'we_zoe_yc2' },
  { userSkillId: 'es_zoe_pressure', workExperienceId: 'we_zoe_yc2' },
  // Zoe - YC1
  { userSkillId: 'es_zoe_react', workExperienceId: 'we_zoe_yc1' },
  { userSkillId: 'es_zoe_nodejs', workExperienceId: 'we_zoe_yc1' },
  { userSkillId: 'es_zoe_graphql', workExperienceId: 'we_zoe_yc1' },
  { userSkillId: 'es_zoe_mongodb', workExperienceId: 'we_zoe_yc1' },
  { userSkillId: 'es_zoe_ownership', workExperienceId: 'we_zoe_yc1' },
  { userSkillId: 'es_zoe_adaptability', workExperienceId: 'we_zoe_yc1' },
  // Zoe - Consultancy
  { userSkillId: 'es_zoe_python', workExperienceId: 'we_zoe_consultancy' },
  { userSkillId: 'es_zoe_react', workExperienceId: 'we_zoe_consultancy' },
  { userSkillId: 'es_zoe_adaptability', workExperienceId: 'we_zoe_consultancy' },
  { userSkillId: 'es_zoe_learning', workExperienceId: 'we_zoe_consultancy' },
  // David - Oscar
  { userSkillId: 'es_david_python', workExperienceId: 'we_david_oscar' },
  { userSkillId: 'es_david_postgresql', workExperienceId: 'we_david_oscar' },
  { userSkillId: 'es_david_api_design', workExperienceId: 'we_david_oscar' },
  { userSkillId: 'es_david_attention_detail', workExperienceId: 'we_david_oscar' },
  { userSkillId: 'es_david_documentation', workExperienceId: 'we_david_oscar' },
  // David - Healthcare
  { userSkillId: 'es_david_python', workExperienceId: 'we_david_healthcare' },
  { userSkillId: 'es_david_django', workExperienceId: 'we_david_healthcare' },
  { userSkillId: 'es_david_postgresql', workExperienceId: 'we_david_healthcare' },
  { userSkillId: 'es_david_unit_testing', workExperienceId: 'we_david_healthcare' },
  // David - Consulting
  { userSkillId: 'es_david_python', workExperienceId: 'we_david_consulting' },
  { userSkillId: 'es_david_docker', workExperienceId: 'we_david_consulting' },
  // Mohammed - Grubhub
  { userSkillId: 'es_mohammed_kubernetes', workExperienceId: 'we_mohammed_grubhub' },
  { userSkillId: 'es_mohammed_terraform', workExperienceId: 'we_mohammed_grubhub' },
  { userSkillId: 'es_mohammed_aws', workExperienceId: 'we_mohammed_grubhub' },
  { userSkillId: 'es_mohammed_helm', workExperienceId: 'we_mohammed_grubhub' },
  { userSkillId: 'es_mohammed_debugging', workExperienceId: 'we_mohammed_grubhub' },
  // Mohammed - Consulting
  { userSkillId: 'es_mohammed_kubernetes', workExperienceId: 'we_mohammed_consulting' },
  { userSkillId: 'es_mohammed_terraform', workExperienceId: 'we_mohammed_consulting' },
  { userSkillId: 'es_mohammed_monitoring', workExperienceId: 'we_mohammed_consulting' },
  // Mohammed - IT
  { userSkillId: 'es_mohammed_docker', workExperienceId: 'we_mohammed_it' },
  { userSkillId: 'es_mohammed_python', workExperienceId: 'we_mohammed_it' },
  // Aisha - Tempus
  { userSkillId: 'es_aisha_python', workExperienceId: 'we_aisha_tempus' },
  { userSkillId: 'es_aisha_tensorflow', workExperienceId: 'we_aisha_tempus' },
  { userSkillId: 'es_aisha_spark', workExperienceId: 'we_aisha_tempus' },
  { userSkillId: 'es_aisha_analytical', workExperienceId: 'we_aisha_tempus' },
  { userSkillId: 'es_aisha_attention_detail', workExperienceId: 'we_aisha_tempus' },
  // Aisha - HealthAI
  { userSkillId: 'es_aisha_python', workExperienceId: 'we_aisha_healthai' },
  { userSkillId: 'es_aisha_tensorflow', workExperienceId: 'we_aisha_healthai' },
  { userSkillId: 'es_aisha_spark', workExperienceId: 'we_aisha_healthai' },
  { userSkillId: 'es_aisha_documentation', workExperienceId: 'we_aisha_healthai' },
  // Aisha - Research
  { userSkillId: 'es_aisha_python', workExperienceId: 'we_aisha_research' },
  { userSkillId: 'es_aisha_analytical', workExperienceId: 'we_aisha_research' },
  // Ryan - Zynga
  { userSkillId: 'es_ryan_react_native', workExperienceId: 'we_ryan_zynga' },
  { userSkillId: 'es_ryan_react', workExperienceId: 'we_ryan_zynga' },
  { userSkillId: 'es_ryan_typescript', workExperienceId: 'we_ryan_zynga' },
  { userSkillId: 'es_ryan_cross_functional', workExperienceId: 'we_ryan_zynga' },
  // Ryan - Gaming
  { userSkillId: 'es_ryan_react_native', workExperienceId: 'we_ryan_gaming' },
  { userSkillId: 'es_ryan_firebase', workExperienceId: 'we_ryan_gaming' },
  { userSkillId: 'es_ryan_unit_testing', workExperienceId: 'we_ryan_gaming' },
  // Ryan - Freelance
  { userSkillId: 'es_ryan_react_native', workExperienceId: 'we_ryan_freelance' },
  { userSkillId: 'es_ryan_firebase', workExperienceId: 'we_ryan_freelance' },
  // Emma - Wayfair
  { userSkillId: 'es_emma_react', workExperienceId: 'we_emma_wayfair' },
  { userSkillId: 'es_emma_typescript', workExperienceId: 'we_emma_wayfair' },
  { userSkillId: 'es_emma_nextjs', workExperienceId: 'we_emma_wayfair' },
  { userSkillId: 'es_emma_graphql', workExperienceId: 'we_emma_wayfair' },
  { userSkillId: 'es_emma_cross_functional', workExperienceId: 'we_emma_wayfair' },
  // Emma - E-commerce
  { userSkillId: 'es_emma_react', workExperienceId: 'we_emma_ecommerce' },
  { userSkillId: 'es_emma_unit_testing', workExperienceId: 'we_emma_ecommerce' },
  { userSkillId: 'es_emma_attention_detail', workExperienceId: 'we_emma_ecommerce' },
  { userSkillId: 'es_emma_documentation', workExperienceId: 'we_emma_ecommerce' },
  // Emma - Agency
  { userSkillId: 'es_emma_react', workExperienceId: 'we_emma_agency' },
  { userSkillId: 'es_emma_typescript', workExperienceId: 'we_emma_agency' },
];

// ============================================
// SENIOR ENGINEERS (10)
// ============================================

const seniorEngineerResumes: EngineerResume[] = [
  // Greg Thompson - COASTING SENIOR (7 years, mid-level confidence)
  {
    engineerId: 'eng_greg',
    resumeText: `GREG THOMPSON
greg.thompson@email.com | (972) 555-0145 | Dallas, TX

SUMMARY
Senior Software Engineer with 7 years of experience in Java backend development. Solid foundation in Spring Boot and relational databases. Experienced in maintaining and improving enterprise SaaS applications.

EXPERIENCE

Enterprise SaaS Company | Dallas, TX
Senior Software Engineer | Mar 2019 - Present
- Maintaining Java microservices for enterprise resource planning platform
- Writing SQL queries and stored procedures for reporting features
- Participating in code reviews and providing feedback to team members
- Supporting production deployments and on-call rotations

Consulting Firm | Dallas, TX
Software Engineer | Jun 2017 - Feb 2019
- Built backend services using Spring Boot for various clients
- Developed PostgreSQL database schemas and queries
- Implemented REST APIs for client applications
- Created documentation for API endpoints

Tech Company | Dallas, TX
Junior Developer | Aug 2017 - May 2017
- Developed Java applications for internal tools
- Fixed bugs and implemented minor features
- Learned enterprise development practices

EDUCATION

University of Texas at Dallas
B.S. Computer Science | 2017

SKILLS
Languages & Frameworks: Java, Spring Boot, SQL
Databases: PostgreSQL, MySQL
Tools: Docker, Git, Maven
Practices: Unit Testing, API Design, Documentation`,
  },

  // Natasha Volkov - COASTING SENIOR (8 years, EdTech)
  {
    engineerId: 'eng_natasha',
    resumeText: `NATASHA VOLKOV
natasha.volkov@email.com | (303) 555-0178 | Denver, CO

SUMMARY
Senior Engineer with 8 years of experience building web applications for education technology. Comfortable with full stack development using React and Node.js. Experienced in maintaining stable, reliable applications for school districts.

EXPERIENCE

EdTech Company | Denver, CO
Senior Software Engineer | Jun 2018 - Present
- Maintaining React frontend and Node.js backend for learning management system
- Supporting platform serving 500K+ students and teachers
- Writing GraphQL APIs for gradebook and assignment features
- Participating in quarterly planning and feature prioritization

Education Startup | Denver, CO
Software Engineer | Aug 2016 - May 2018
- Built React components for student dashboard
- Developed Node.js APIs for course management
- Implemented PostgreSQL queries for reporting
- Collaborated with product team on feature requirements

Web Agency | Denver, CO
Junior Developer | Jun 2016 - Jul 2016
- Built websites for education clients
- Learned React and modern JavaScript practices

EDUCATION

University of Colorado Boulder
B.S. Computer Science | 2016

SKILLS
Languages & Frameworks: JavaScript, TypeScript, React, Node.js
Databases: PostgreSQL, Redis
Tools: AWS, GraphQL, Git
Practices: Full Stack Development, Unit Testing, Cross-Functional Collaboration`,
  },

  // Nathan Brooks - BIG-TECH SPECIALIST (8 years, Ex-Meta, ML/Ranking)
  {
    engineerId: 'eng_nathan',
    resumeText: `NATHAN BROOKS
nathan.brooks@email.com | (650) 555-0134 | Menlo Park, CA

SUMMARY
Senior ML Engineer with 8 years of experience building ranking and recommendation systems at scale. Former Meta engineer with deep expertise in Python, Spark, and large-scale data processing. Led teams building ML systems serving billions of users.

EXPERIENCE

Anthropic | San Francisco, CA
Senior ML Engineer | Jan 2023 - Present
- Building evaluation and ranking systems for language models
- Designing data pipelines processing petabytes of training data
- Mentoring junior engineers on ML best practices
- Contributing to system design for scalable ML infrastructure

Meta | Menlo Park, CA
Senior Software Engineer (ML) | Mar 2018 - Dec 2022
- Led ranking team for News Feed serving 3B+ daily active users
- Built Spark pipelines processing 100TB+ daily interaction data
- Designed A/B testing framework for ranking model experiments
- Mentored 6 engineers and led technical design reviews

LinkedIn | Sunnyvale, CA
ML Engineer | Jun 2016 - Feb 2018
- Built recommendation models for job matching
- Developed Python tools for feature engineering
- Implemented offline evaluation frameworks

EDUCATION

Stanford University
M.S. Computer Science (ML focus) | 2016
B.S. Computer Science | 2014

SKILLS
Languages: Python, Scala, SQL
Data: Apache Spark, Hadoop, Airflow
ML: PyTorch, TensorFlow, Feature Engineering
Practices: System Design, Mentorship, Documentation, Adaptability`,
  },

  // Wei Chen - BIG-TECH SPECIALIST (8 years, Ex-Netflix, Kafka/Spark)
  {
    engineerId: 'eng_wei',
    resumeText: `WEI CHEN
wei.chen@email.com | (408) 555-0167 | San Jose, CA

SUMMARY
Senior Data Engineer with 8 years of experience building real-time data streaming systems. Former Netflix engineer with deep expertise in Kafka and Spark. Designed systems processing trillions of events daily with sub-second latency requirements.

EXPERIENCE

Confluent | Mountain View, CA
Senior Data Engineer | Feb 2023 - Present
- Building Kafka-based streaming products for enterprise customers
- Designing reference architectures for real-time data pipelines
- Contributing to open-source Kafka ecosystem projects
- Mentoring customers on streaming best practices

Netflix | Los Gatos, CA
Senior Software Engineer | Apr 2018 - Jan 2023
- Built real-time viewing analytics pipeline processing 1T+ events daily
- Designed Kafka architecture handling 10M+ messages per second
- Led migration from batch to streaming for content recommendation data
- Mentored 5 engineers on distributed systems design

Uber | San Francisco, CA
Data Engineer | Jul 2016 - Mar 2018
- Built Spark ETL pipelines for ride analytics
- Implemented real-time surge pricing data feeds
- Developed monitoring for data quality

EDUCATION

UC Berkeley
M.S. Computer Science | 2016
B.S. EECS | 2014

SKILLS
Languages: Python, Java, Scala
Streaming: Apache Kafka, Kafka Streams, Flink
Data: Apache Spark, Airflow, Presto
Practices: Distributed Systems, System Design, Mentorship, Ownership`,
  },

  // Derek Morgan - STARTUP GENERALIST Senior (9 years)
  {
    engineerId: 'eng_derek',
    resumeText: `DEREK MORGAN
derek.morgan@email.com | (415) 555-0189 | San Francisco, CA

SUMMARY
Senior Engineer and startup leader with 9 years of experience building products from inception to scale. Three-time founding engineer with experience across the full stack and infrastructure. Strong hiring and team leadership skills, having built multiple engineering teams.

EXPERIENCE

Fintech Startup (Series B) | San Francisco, CA
Engineering Lead | Mar 2022 - Present
- Leading 8-person engineering team building payment platform
- Architecting multi-cloud infrastructure using AWS and Terraform
- Built full stack features using React, Node.js, and PostgreSQL
- Hired and onboarded 5 engineers, establishing team practices

SaaS Startup (Acquired) | San Francisco, CA
Senior Engineer / Tech Lead | Jun 2019 - Feb 2022
- Led 5-person team building enterprise collaboration tools
- Architected GraphQL API layer and real-time sync features
- Established CI/CD and deployment practices
- Grew engineering team from 2 to 8 during Series A

E-commerce Platform | San Francisco, CA
Full Stack Engineer | Aug 2016 - May 2019
- Built marketplace features handling $50M+ annual GMV
- Developed React frontend and Python backend services
- Implemented AWS infrastructure for multi-region deployment

EDUCATION

Stanford University
B.S. Computer Science | 2015

SKILLS
Languages & Frameworks: TypeScript, JavaScript, React, Node.js, Python
Infrastructure: AWS, Terraform, Docker, Kubernetes (learning)
Databases: PostgreSQL, Redis, GraphQL
Leadership: Hiring, Team Leadership, Ownership, Adaptability, Working Under Pressure`,
  },

  // Takeshi Yamamoto - Standard Senior (7 years, Java & Distributed Systems)
  {
    engineerId: 'eng_takeshi',
    resumeText: `TAKESHI YAMAMOTO
takeshi.yamamoto@email.com | (212) 555-0156 | New York, NY

SUMMARY
Senior Backend Engineer with 7 years of experience building distributed systems in Java. Expert in Spring Boot, Kafka, and designing high-throughput backend services for financial applications. Strong debugging skills and architectural thinking.

EXPERIENCE

Bloomberg | New York, NY
Senior Software Engineer | Apr 2021 - Present
- Building real-time market data distribution systems in Java
- Designed Kafka-based event streaming for trade execution
- Led migration to microservices architecture
- Mentoring 3 junior engineers on distributed systems concepts

Two Sigma | New York, NY
Software Engineer | Jun 2018 - Mar 2021
- Built backend services for trading platform using Spring Boot
- Implemented low-latency APIs serving 100K+ requests per second
- Developed PostgreSQL query optimizations reducing latency by 50%
- Contributed to system design for order management system

Capital One | McLean, VA
Junior Software Engineer | Jul 2017 - May 2018
- Developed Java services for credit card processing
- Built REST APIs for mobile banking features
- Learned enterprise Java development practices

EDUCATION

Columbia University
M.S. Computer Science | 2017
B.S. Computer Science | 2015

SKILLS
Languages & Frameworks: Java, Spring Boot, Kotlin
Databases: PostgreSQL, Redis, Kafka
Architecture: Distributed Systems, System Design, API Design
Practices: Debugging, Performance Optimization, Mentorship`,
  },

  // Sarah Mitchell - Standard Senior (6 years, Frontend & Performance)
  {
    engineerId: 'eng_sarah',
    resumeText: `SARAH MITCHELL
sarah.mitchell@email.com | (206) 555-0143 | Seattle, WA

SUMMARY
Senior Frontend Engineer with 6 years of experience building high-performance React applications. Expert in JavaScript performance optimization and complex UI development. Passionate about creating fast, accessible user experiences at scale.

EXPERIENCE

Amazon | Seattle, WA
Senior Frontend Engineer | May 2022 - Present
- Leading frontend development for Prime Video web player
- Optimized video player performance achieving 50% faster start times
- Built Next.js application serving 200M+ monthly users
- Mentoring 4 engineers on React best practices and performance

Expedia | Seattle, WA
Frontend Engineer | Aug 2019 - Apr 2022
- Built React components for hotel booking flow
- Led performance initiative improving Core Web Vitals by 40%
- Implemented GraphQL integration for search results
- Created comprehensive test suites with 90% coverage

Tech Startup | Seattle, WA
Junior Frontend Developer | Jun 2018 - Jul 2019
- Built React dashboard for e-commerce analytics
- Implemented responsive designs for mobile users
- Learned React patterns and performance optimization

EDUCATION

University of Washington
B.S. Computer Science | 2018

SKILLS
Languages & Frameworks: JavaScript, TypeScript, React, Next.js
Performance: Web Vitals, Lighthouse, Bundle Analysis
Testing: Jest, React Testing Library, Cypress
Practices: Performance Optimization, Accessibility, Mentorship, Attention to Detail`,
  },

  // Ravi Krishnan - Standard Senior (8 years, Healthcare Full Stack)
  {
    engineerId: 'eng_ravi',
    resumeText: `RAVI KRISHNAN
ravi.krishnan@email.com | (617) 555-0178 | Boston, MA

SUMMARY
Senior Full Stack Engineer with 8 years of experience building healthcare software systems. Expert in Node.js, React, and working with sensitive medical data under regulatory compliance. Strong documentation practices and attention to detail essential for healthcare applications.

EXPERIENCE

Athenahealth | Boston, MA
Senior Software Engineer | Mar 2020 - Present
- Building full stack features for electronic health records platform
- Architected API layer serving 100K+ healthcare providers
- Led migration to TypeScript improving code reliability
- Implemented HIPAA-compliant audit logging and data handling
- Mentoring 3 engineers on healthcare software best practices

Health Catalyst | Salt Lake City, UT (Remote)
Software Engineer | Jun 2017 - Feb 2020
- Built React dashboard for clinical analytics platform
- Developed Node.js APIs for patient data aggregation
- Implemented PostgreSQL queries for population health reporting
- Created comprehensive API documentation

Healthcare Startup | Boston, MA
Junior Developer | Aug 2016 - May 2017
- Built backend services for patient portal
- Learned HIPAA compliance requirements
- Developed REST APIs using Express

EDUCATION

Northeastern University
B.S. Computer Science | 2016

SKILLS
Languages & Frameworks: TypeScript, JavaScript, Node.js, React
Databases: PostgreSQL, Redis, MongoDB
Infrastructure: AWS, Docker
Practices: HIPAA Compliance, API Documentation, Attention to Detail`,
  },

  // Olivia Foster - Standard Senior (7 years, ML Engineer, NLP)
  {
    engineerId: 'eng_olivia',
    resumeText: `OLIVIA FOSTER
olivia.foster@email.com | (858) 555-0134 | San Diego, CA

SUMMARY
Senior ML Engineer with 7 years of experience building NLP and machine learning systems for healthcare. Expert in Python, TensorFlow, and developing production ML pipelines. Strong analytical skills with publications in medical NLP applications.

EXPERIENCE

Illumina | San Diego, CA
Senior ML Engineer | Apr 2021 - Present
- Building NLP models for genomic report generation
- Designed ML pipelines processing 1M+ genomic sequences daily
- Led development of clinical note extraction system
- Mentoring 2 junior ML engineers on model development
- Published paper on clinical NLP at industry conference

Tempus | Chicago, IL (Remote)
ML Engineer | Aug 2018 - Mar 2021
- Built TensorFlow models for cancer pathology classification
- Developed Spark pipelines for clinical trial matching
- Implemented model monitoring and drift detection
- Created documentation for ML model training procedures

Research Lab | San Diego, CA
ML Research Assistant | Jun 2017 - Jul 2018
- Conducted NLP research on medical records
- Published 2 papers on biomedical text mining
- Built Python tools for annotation and evaluation

EDUCATION

UC San Diego
M.S. Computer Science (ML focus) | 2019
B.S. Computer Science | 2017

SKILLS
Languages & Frameworks: Python, TensorFlow, PyTorch
Data: Apache Spark, PostgreSQL, Pandas
ML: NLP, Deep Learning, Model Evaluation
Practices: Analytical Thinking, Mentorship, Documentation`,
  },

  // Lucas Anderson - Standard Senior (7 years, Security Engineer)
  {
    engineerId: 'eng_lucas',
    resumeText: `LUCAS ANDERSON
lucas.anderson@email.com | (512) 555-0167 | Austin, TX

SUMMARY
Senior Security Engineer with 7 years of experience building secure cloud infrastructure. Expert in AWS security, Terraform, and implementing defense-in-depth strategies. Strong attention to detail and analytical skills essential for identifying and mitigating security risks.

EXPERIENCE

Crowdstrike | Austin, TX
Senior Security Engineer | Jun 2021 - Present
- Architecting AWS security infrastructure for threat intelligence platform
- Designed and implemented zero-trust network architecture
- Built Terraform modules for secure infrastructure provisioning
- Leading security review process for new services
- Mentoring 2 engineers on cloud security best practices

Duo Security | Ann Arbor, MI (Remote)
Security Engineer | Mar 2019 - May 2021
- Built Python tools for security automation and vulnerability scanning
- Implemented Kubernetes security policies and pod security standards
- Developed monitoring and alerting for security events
- Contributed to incident response procedures

Consulting Firm | Austin, TX
Junior Security Engineer | Jul 2017 - Feb 2019
- Conducted security assessments for client applications
- Implemented AWS security configurations
- Developed security documentation and runbooks

EDUCATION

University of Texas at Austin
B.S. Computer Science | 2017

SKILLS
Languages: Python, Bash, Go
Infrastructure: AWS, Terraform, Kubernetes, Docker
Security: Cloud Security, IAM, Network Security, Threat Modeling
Practices: Monitoring, Debugging, Attention to Detail, Analytical Thinking`,
  },
];

const seniorEngineerWorkExperiences: EngineerWorkExperience[] = [
  // Greg
  { id: 'we_greg_enterprise', engineerId: 'eng_greg', companyName: 'Enterprise SaaS Company', title: 'Senior Software Engineer', seniority: 'senior', startDate: '2019-03', endDate: 'present', highlights: ['Maintaining Java microservices', 'SQL and stored procedures'] },
  { id: 'we_greg_consulting', engineerId: 'eng_greg', companyName: 'Consulting Firm', title: 'Software Engineer', seniority: 'mid', startDate: '2017-06', endDate: '2019-02', highlights: ['Built Spring Boot services', 'Created API documentation'] },
  // Natasha
  { id: 'we_natasha_edtech', engineerId: 'eng_natasha', companyName: 'EdTech Company', title: 'Senior Software Engineer', seniority: 'senior', startDate: '2018-06', endDate: 'present', highlights: ['Maintaining LMS for 500K+ users', 'GraphQL APIs for gradebook'] },
  { id: 'we_natasha_startup', engineerId: 'eng_natasha', companyName: 'Education Startup', title: 'Software Engineer', seniority: 'mid', startDate: '2016-08', endDate: '2018-05', highlights: ['Built student dashboard', 'Node.js APIs'] },
  // Nathan
  { id: 'we_nathan_anthropic', engineerId: 'eng_nathan', companyName: 'Anthropic', title: 'Senior ML Engineer', seniority: 'senior', startDate: '2023-01', endDate: 'present', highlights: ['Building evaluation systems for LLMs', 'Designing petabyte-scale pipelines'] },
  { id: 'we_nathan_meta', engineerId: 'eng_nathan', companyName: 'Meta', title: 'Senior Software Engineer (ML)', seniority: 'senior', startDate: '2018-03', endDate: '2022-12', highlights: ['Led News Feed ranking for 3B+ users', 'Spark pipelines for 100TB+ daily'] },
  { id: 'we_nathan_linkedin', engineerId: 'eng_nathan', companyName: 'LinkedIn', title: 'ML Engineer', seniority: 'mid', startDate: '2016-06', endDate: '2018-02', highlights: ['Built job matching recommendations', 'Feature engineering tools'] },
  // Wei
  { id: 'we_wei_confluent', engineerId: 'eng_wei', companyName: 'Confluent', title: 'Senior Data Engineer', seniority: 'senior', startDate: '2023-02', endDate: 'present', highlights: ['Building Kafka streaming products', 'Reference architectures'] },
  { id: 'we_wei_netflix', engineerId: 'eng_wei', companyName: 'Netflix', title: 'Senior Software Engineer', seniority: 'senior', startDate: '2018-04', endDate: '2023-01', highlights: ['Built pipeline processing 1T+ daily events', 'Kafka handling 10M+ msg/sec'] },
  { id: 'we_wei_uber', engineerId: 'eng_wei', companyName: 'Uber', title: 'Data Engineer', seniority: 'mid', startDate: '2016-07', endDate: '2018-03', highlights: ['Built Spark ETL for ride analytics', 'Real-time surge pricing'] },
  // Derek
  { id: 'we_derek_fintech', engineerId: 'eng_derek', companyName: 'Fintech Startup (Series B)', title: 'Engineering Lead', seniority: 'senior', startDate: '2022-03', endDate: 'present', highlights: ['Leading 8-person team', 'Multi-cloud architecture'] },
  { id: 'we_derek_saas', engineerId: 'eng_derek', companyName: 'SaaS Startup (Acquired)', title: 'Senior Engineer / Tech Lead', seniority: 'senior', startDate: '2019-06', endDate: '2022-02', highlights: ['Led 5-person team', 'Built GraphQL API layer'] },
  { id: 'we_derek_ecommerce', engineerId: 'eng_derek', companyName: 'E-commerce Platform', title: 'Full Stack Engineer', seniority: 'mid', startDate: '2016-08', endDate: '2019-05', highlights: ['Built marketplace handling $50M+ GMV', 'Multi-region AWS'] },
  // Takeshi
  { id: 'we_takeshi_bloomberg', engineerId: 'eng_takeshi', companyName: 'Bloomberg', title: 'Senior Software Engineer', seniority: 'senior', startDate: '2021-04', endDate: 'present', highlights: ['Real-time market data systems', 'Kafka event streaming'] },
  { id: 'we_takeshi_twosigma', engineerId: 'eng_takeshi', companyName: 'Two Sigma', title: 'Software Engineer', seniority: 'mid', startDate: '2018-06', endDate: '2021-03', highlights: ['Trading platform backend', 'Low-latency APIs'] },
  { id: 'we_takeshi_capitalone', engineerId: 'eng_takeshi', companyName: 'Capital One', title: 'Junior Software Engineer', seniority: 'junior', startDate: '2017-07', endDate: '2018-05', highlights: ['Credit card processing', 'Mobile banking APIs'] },
  // Sarah
  { id: 'we_sarah_amazon', engineerId: 'eng_sarah', companyName: 'Amazon', title: 'Senior Frontend Engineer', seniority: 'senior', startDate: '2022-05', endDate: 'present', highlights: ['Prime Video web player', '50% faster start times'] },
  { id: 'we_sarah_expedia', engineerId: 'eng_sarah', companyName: 'Expedia', title: 'Frontend Engineer', seniority: 'mid', startDate: '2019-08', endDate: '2022-04', highlights: ['Hotel booking React components', 'Core Web Vitals +40%'] },
  { id: 'we_sarah_startup', engineerId: 'eng_sarah', companyName: 'Tech Startup', title: 'Junior Frontend Developer', seniority: 'junior', startDate: '2018-06', endDate: '2019-07', highlights: ['E-commerce analytics dashboard', 'Mobile responsive'] },
  // Ravi
  { id: 'we_ravi_athena', engineerId: 'eng_ravi', companyName: 'Athenahealth', title: 'Senior Software Engineer', seniority: 'senior', startDate: '2020-03', endDate: 'present', highlights: ['EHR platform for 100K+ providers', 'TypeScript migration'] },
  { id: 'we_ravi_healthcatalyst', engineerId: 'eng_ravi', companyName: 'Health Catalyst', title: 'Software Engineer', seniority: 'mid', startDate: '2017-06', endDate: '2020-02', highlights: ['Clinical analytics dashboard', 'Patient data APIs'] },
  { id: 'we_ravi_startup', engineerId: 'eng_ravi', companyName: 'Healthcare Startup', title: 'Junior Developer', seniority: 'junior', startDate: '2016-08', endDate: '2017-05', highlights: ['Patient portal backend', 'HIPAA compliance'] },
  // Olivia
  { id: 'we_olivia_illumina', engineerId: 'eng_olivia', companyName: 'Illumina', title: 'Senior ML Engineer', seniority: 'senior', startDate: '2021-04', endDate: 'present', highlights: ['NLP for genomic reports', 'ML pipelines for 1M+ sequences'] },
  { id: 'we_olivia_tempus', engineerId: 'eng_olivia', companyName: 'Tempus', title: 'ML Engineer', seniority: 'mid', startDate: '2018-08', endDate: '2021-03', highlights: ['Cancer pathology classification', 'Clinical trial matching'] },
  { id: 'we_olivia_research', engineerId: 'eng_olivia', companyName: 'Research Lab', title: 'ML Research Assistant', seniority: 'junior', startDate: '2017-06', endDate: '2018-07', highlights: ['Medical records NLP', 'Published 2 papers'] },
  // Lucas
  { id: 'we_lucas_crowdstrike', engineerId: 'eng_lucas', companyName: 'Crowdstrike', title: 'Senior Security Engineer', seniority: 'senior', startDate: '2021-06', endDate: 'present', highlights: ['AWS security for threat intel', 'Zero-trust architecture'] },
  { id: 'we_lucas_duo', engineerId: 'eng_lucas', companyName: 'Duo Security', title: 'Security Engineer', seniority: 'mid', startDate: '2019-03', endDate: '2021-05', highlights: ['Security automation tools', 'Kubernetes security'] },
  { id: 'we_lucas_consulting', engineerId: 'eng_lucas', companyName: 'Consulting Firm', title: 'Junior Security Engineer', seniority: 'junior', startDate: '2017-07', endDate: '2019-02', highlights: ['Security assessments', 'AWS security configs'] },
];

const seniorEngineerSkillLinks: WorkExperienceSkillLink[] = [
  // Greg - Enterprise
  { userSkillId: 'es_greg_java', workExperienceId: 'we_greg_enterprise' },
  { userSkillId: 'es_greg_spring', workExperienceId: 'we_greg_enterprise' },
  { userSkillId: 'es_greg_sql', workExperienceId: 'we_greg_enterprise' },
  { userSkillId: 'es_greg_postgresql', workExperienceId: 'we_greg_enterprise' },
  { userSkillId: 'es_greg_unit_testing', workExperienceId: 'we_greg_enterprise' },
  { userSkillId: 'es_greg_documentation', workExperienceId: 'we_greg_enterprise' },
  // Greg - Consulting
  { userSkillId: 'es_greg_java', workExperienceId: 'we_greg_consulting' },
  { userSkillId: 'es_greg_spring', workExperienceId: 'we_greg_consulting' },
  { userSkillId: 'es_greg_api_design', workExperienceId: 'we_greg_consulting' },
  { userSkillId: 'es_greg_docker', workExperienceId: 'we_greg_consulting' },
  // Natasha - EdTech
  { userSkillId: 'es_natasha_react', workExperienceId: 'we_natasha_edtech' },
  { userSkillId: 'es_natasha_nodejs', workExperienceId: 'we_natasha_edtech' },
  { userSkillId: 'es_natasha_graphql', workExperienceId: 'we_natasha_edtech' },
  { userSkillId: 'es_natasha_postgresql', workExperienceId: 'we_natasha_edtech' },
  { userSkillId: 'es_natasha_cross_functional', workExperienceId: 'we_natasha_edtech' },
  // Natasha - Startup
  { userSkillId: 'es_natasha_react', workExperienceId: 'we_natasha_startup' },
  { userSkillId: 'es_natasha_nodejs', workExperienceId: 'we_natasha_startup' },
  { userSkillId: 'es_natasha_typescript', workExperienceId: 'we_natasha_startup' },
  // Nathan - Anthropic
  { userSkillId: 'es_nathan_python', workExperienceId: 'we_nathan_anthropic' },
  { userSkillId: 'es_nathan_spark', workExperienceId: 'we_nathan_anthropic' },
  { userSkillId: 'es_nathan_system_design', workExperienceId: 'we_nathan_anthropic' },
  { userSkillId: 'es_nathan_mentorship', workExperienceId: 'we_nathan_anthropic' },
  // Nathan - Meta
  { userSkillId: 'es_nathan_python', workExperienceId: 'we_nathan_meta' },
  { userSkillId: 'es_nathan_spark', workExperienceId: 'we_nathan_meta' },
  { userSkillId: 'es_nathan_system_design', workExperienceId: 'we_nathan_meta' },
  { userSkillId: 'es_nathan_mentorship', workExperienceId: 'we_nathan_meta' },
  { userSkillId: 'es_nathan_documentation', workExperienceId: 'we_nathan_meta' },
  // Nathan - LinkedIn
  { userSkillId: 'es_nathan_python', workExperienceId: 'we_nathan_linkedin' },
  { userSkillId: 'es_nathan_adaptability', workExperienceId: 'we_nathan_linkedin' },
  // Wei - Confluent
  { userSkillId: 'es_wei_kafka', workExperienceId: 'we_wei_confluent' },
  { userSkillId: 'es_wei_distributed', workExperienceId: 'we_wei_confluent' },
  { userSkillId: 'es_wei_system_design', workExperienceId: 'we_wei_confluent' },
  { userSkillId: 'es_wei_mentorship', workExperienceId: 'we_wei_confluent' },
  // Wei - Netflix
  { userSkillId: 'es_wei_kafka', workExperienceId: 'we_wei_netflix' },
  { userSkillId: 'es_wei_spark', workExperienceId: 'we_wei_netflix' },
  { userSkillId: 'es_wei_distributed', workExperienceId: 'we_wei_netflix' },
  { userSkillId: 'es_wei_system_design', workExperienceId: 'we_wei_netflix' },
  { userSkillId: 'es_wei_mentorship', workExperienceId: 'we_wei_netflix' },
  // Wei - Uber
  { userSkillId: 'es_wei_spark', workExperienceId: 'we_wei_uber' },
  { userSkillId: 'es_wei_python', workExperienceId: 'we_wei_uber' },
  { userSkillId: 'es_wei_ownership', workExperienceId: 'we_wei_uber' },
  // Derek - Fintech
  { userSkillId: 'es_derek_react', workExperienceId: 'we_derek_fintech' },
  { userSkillId: 'es_derek_nodejs', workExperienceId: 'we_derek_fintech' },
  { userSkillId: 'es_derek_aws', workExperienceId: 'we_derek_fintech' },
  { userSkillId: 'es_derek_terraform', workExperienceId: 'we_derek_fintech' },
  { userSkillId: 'es_derek_hiring', workExperienceId: 'we_derek_fintech' },
  { userSkillId: 'es_derek_team_leadership', workExperienceId: 'we_derek_fintech' },
  { userSkillId: 'es_derek_ownership', workExperienceId: 'we_derek_fintech' },
  // Derek - SaaS
  { userSkillId: 'es_derek_graphql', workExperienceId: 'we_derek_saas' },
  { userSkillId: 'es_derek_nodejs', workExperienceId: 'we_derek_saas' },
  { userSkillId: 'es_derek_team_leadership', workExperienceId: 'we_derek_saas' },
  { userSkillId: 'es_derek_hiring', workExperienceId: 'we_derek_saas' },
  { userSkillId: 'es_derek_adaptability', workExperienceId: 'we_derek_saas' },
  // Derek - E-commerce
  { userSkillId: 'es_derek_react', workExperienceId: 'we_derek_ecommerce' },
  { userSkillId: 'es_derek_python', workExperienceId: 'we_derek_ecommerce' },
  { userSkillId: 'es_derek_aws', workExperienceId: 'we_derek_ecommerce' },
  { userSkillId: 'es_derek_pressure', workExperienceId: 'we_derek_ecommerce' },
  // Takeshi - Bloomberg
  { userSkillId: 'es_takeshi_java', workExperienceId: 'we_takeshi_bloomberg' },
  { userSkillId: 'es_takeshi_kafka', workExperienceId: 'we_takeshi_bloomberg' },
  { userSkillId: 'es_takeshi_distributed', workExperienceId: 'we_takeshi_bloomberg' },
  { userSkillId: 'es_takeshi_system_design', workExperienceId: 'we_takeshi_bloomberg' },
  { userSkillId: 'es_takeshi_mentorship', workExperienceId: 'we_takeshi_bloomberg' },
  // Takeshi - Two Sigma
  { userSkillId: 'es_takeshi_java', workExperienceId: 'we_takeshi_twosigma' },
  { userSkillId: 'es_takeshi_spring', workExperienceId: 'we_takeshi_twosigma' },
  { userSkillId: 'es_takeshi_postgresql', workExperienceId: 'we_takeshi_twosigma' },
  { userSkillId: 'es_takeshi_api_design', workExperienceId: 'we_takeshi_twosigma' },
  { userSkillId: 'es_takeshi_debugging', workExperienceId: 'we_takeshi_twosigma' },
  // Takeshi - Capital One
  { userSkillId: 'es_takeshi_java', workExperienceId: 'we_takeshi_capitalone' },
  { userSkillId: 'es_takeshi_spring', workExperienceId: 'we_takeshi_capitalone' },
  // Sarah - Amazon
  { userSkillId: 'es_sarah_react', workExperienceId: 'we_sarah_amazon' },
  { userSkillId: 'es_sarah_typescript', workExperienceId: 'we_sarah_amazon' },
  { userSkillId: 'es_sarah_nextjs', workExperienceId: 'we_sarah_amazon' },
  { userSkillId: 'es_sarah_performance', workExperienceId: 'we_sarah_amazon' },
  { userSkillId: 'es_sarah_mentorship', workExperienceId: 'we_sarah_amazon' },
  // Sarah - Expedia
  { userSkillId: 'es_sarah_react', workExperienceId: 'we_sarah_expedia' },
  { userSkillId: 'es_sarah_graphql', workExperienceId: 'we_sarah_expedia' },
  { userSkillId: 'es_sarah_performance', workExperienceId: 'we_sarah_expedia' },
  { userSkillId: 'es_sarah_unit_testing', workExperienceId: 'we_sarah_expedia' },
  // Sarah - Startup
  { userSkillId: 'es_sarah_react', workExperienceId: 'we_sarah_startup' },
  { userSkillId: 'es_sarah_javascript', workExperienceId: 'we_sarah_startup' },
  { userSkillId: 'es_sarah_attention_detail', workExperienceId: 'we_sarah_startup' },
  // Ravi - Athena
  { userSkillId: 'es_ravi_nodejs', workExperienceId: 'we_ravi_athena' },
  { userSkillId: 'es_ravi_react', workExperienceId: 'we_ravi_athena' },
  { userSkillId: 'es_ravi_typescript', workExperienceId: 'we_ravi_athena' },
  { userSkillId: 'es_ravi_postgresql', workExperienceId: 'we_ravi_athena' },
  { userSkillId: 'es_ravi_api_design', workExperienceId: 'we_ravi_athena' },
  { userSkillId: 'es_ravi_attention_detail', workExperienceId: 'we_ravi_athena' },
  { userSkillId: 'es_ravi_documentation', workExperienceId: 'we_ravi_athena' },
  // Ravi - Health Catalyst
  { userSkillId: 'es_ravi_react', workExperienceId: 'we_ravi_healthcatalyst' },
  { userSkillId: 'es_ravi_nodejs', workExperienceId: 'we_ravi_healthcatalyst' },
  { userSkillId: 'es_ravi_postgresql', workExperienceId: 'we_ravi_healthcatalyst' },
  // Ravi - Startup
  { userSkillId: 'es_ravi_nodejs', workExperienceId: 'we_ravi_startup' },
  { userSkillId: 'es_ravi_aws', workExperienceId: 'we_ravi_startup' },
  // Olivia - Illumina
  { userSkillId: 'es_olivia_python', workExperienceId: 'we_olivia_illumina' },
  { userSkillId: 'es_olivia_tensorflow', workExperienceId: 'we_olivia_illumina' },
  { userSkillId: 'es_olivia_spark', workExperienceId: 'we_olivia_illumina' },
  { userSkillId: 'es_olivia_analytical', workExperienceId: 'we_olivia_illumina' },
  { userSkillId: 'es_olivia_mentorship', workExperienceId: 'we_olivia_illumina' },
  { userSkillId: 'es_olivia_documentation', workExperienceId: 'we_olivia_illumina' },
  // Olivia - Tempus
  { userSkillId: 'es_olivia_python', workExperienceId: 'we_olivia_tempus' },
  { userSkillId: 'es_olivia_tensorflow', workExperienceId: 'we_olivia_tempus' },
  { userSkillId: 'es_olivia_spark', workExperienceId: 'we_olivia_tempus' },
  { userSkillId: 'es_olivia_docker', workExperienceId: 'we_olivia_tempus' },
  // Olivia - Research
  { userSkillId: 'es_olivia_python', workExperienceId: 'we_olivia_research' },
  { userSkillId: 'es_olivia_analytical', workExperienceId: 'we_olivia_research' },
  // Lucas - Crowdstrike
  { userSkillId: 'es_lucas_aws', workExperienceId: 'we_lucas_crowdstrike' },
  { userSkillId: 'es_lucas_terraform', workExperienceId: 'we_lucas_crowdstrike' },
  { userSkillId: 'es_lucas_python', workExperienceId: 'we_lucas_crowdstrike' },
  { userSkillId: 'es_lucas_monitoring', workExperienceId: 'we_lucas_crowdstrike' },
  { userSkillId: 'es_lucas_attention_detail', workExperienceId: 'we_lucas_crowdstrike' },
  { userSkillId: 'es_lucas_analytical', workExperienceId: 'we_lucas_crowdstrike' },
  // Lucas - Duo
  { userSkillId: 'es_lucas_python', workExperienceId: 'we_lucas_duo' },
  { userSkillId: 'es_lucas_kubernetes', workExperienceId: 'we_lucas_duo' },
  { userSkillId: 'es_lucas_monitoring', workExperienceId: 'we_lucas_duo' },
  { userSkillId: 'es_lucas_debugging', workExperienceId: 'we_lucas_duo' },
  // Lucas - Consulting
  { userSkillId: 'es_lucas_aws', workExperienceId: 'we_lucas_consulting' },
  { userSkillId: 'es_lucas_docker', workExperienceId: 'we_lucas_consulting' },
];

// ============================================
// STAFF ENGINEERS (8)
// ============================================

const staffEngineerResumes: EngineerResume[] = [
  // Anika Gupta - Platform Engineer (10+ years, Kafka & Kubernetes expert)
  {
    engineerId: 'eng_anika',
    resumeText: `ANIKA GUPTA
anika.gupta@email.com | (212) 555-0145 | New York, NY

SUMMARY
Staff Platform Engineer with 12 years of experience building large-scale distributed systems and platform infrastructure. Expert in Kafka, Kubernetes, and designing systems that handle millions of events per second. Led platform teams at multiple fintech companies, establishing architectural patterns and mentoring dozens of engineers.

EXPERIENCE

Citadel | New York, NY
Staff Platform Engineer | Mar 2021 - Present
- Architecting next-generation trading platform infrastructure
- Designed Kafka clusters processing 50M+ messages per second with <5ms latency
- Built Kubernetes platform serving 2000+ microservices across global regions
- Leading team of 6 platform engineers, establishing best practices org-wide
- Mentoring senior engineers on distributed systems design

Stripe | San Francisco, CA (Remote)
Senior Platform Engineer | Jun 2017 - Feb 2021
- Built payment processing infrastructure handling $100B+ annual volume
- Designed multi-region Kafka deployment for payment event streaming
- Led migration to Kubernetes reducing deployment times by 80%
- Established SRE practices and incident response procedures

Goldman Sachs | New York, NY
Platform Engineer | Aug 2013 - May 2017
- Built Java-based trading infrastructure for equities desk
- Implemented low-latency messaging systems using custom protocols
- Developed monitoring and alerting for critical trading systems

EDUCATION

Cornell University
M.S. Computer Science | 2013
B.S. Computer Science | 2011

SKILLS
Infrastructure: Kafka, Kubernetes, AWS, Docker, Terraform
Languages: Java, Python, Go
Architecture: Distributed Systems, Event-Driven Architecture, System Design
Leadership: Team Leadership, Mentorship, Architectural Decision Making`,
  },

  // Alex Rivera - Staff Backend (9 years, Java & System Design)
  {
    engineerId: 'eng_alex',
    resumeText: `ALEX RIVERA
alex.rivera@email.com | (617) 555-0189 | Boston, MA

SUMMARY
Staff Backend Engineer with 11 years of experience building enterprise-scale backend systems. Expert in Java, Spring Boot, and designing APIs that serve millions of users. Strong track record of mentoring engineers and driving technical excellence across organizations.

EXPERIENCE

Fidelity | Boston, MA
Staff Software Engineer | Apr 2020 - Present
- Architecting next-generation investment platform backend
- Designed Java microservices handling $5T+ in managed assets
- Built API gateway serving 10M+ daily active users
- Leading architecture council and establishing coding standards
- Mentoring 6 senior engineers on system design and best practices

MathWorks | Natick, MA
Senior Software Engineer | Aug 2016 - Mar 2020
- Built backend services for MATLAB Online serving 500K+ users
- Designed distributed compute infrastructure for cloud simulations
- Led migration from monolith to microservices architecture
- Established testing practices achieving 95% code coverage

Oracle | Burlington, MA
Software Engineer | Jun 2013 - Jul 2016
- Developed Java backend for cloud infrastructure products
- Built REST APIs for resource provisioning
- Implemented PostgreSQL optimizations improving query performance

EDUCATION

MIT
M.Eng. Computer Science | 2013
B.S. Computer Science | 2012

SKILLS
Languages & Frameworks: Java, Spring Boot, Kotlin, Python
Databases: PostgreSQL, Redis, Kafka
Architecture: Microservices, System Design, API Design
Leadership: Technical Leadership, Mentorship, Code Review, Debugging`,
  },

  // Dmitri Volkov - Staff ML Engineer (12 years, Deep Learning & MLOps)
  {
    engineerId: 'eng_dmitri',
    resumeText: `DMITRI VOLKOV
dmitri.volkov@email.com | (415) 555-0167 | San Francisco, CA

SUMMARY
Staff ML Engineer with 12 years of experience building production machine learning systems. Expert in TensorFlow, deep learning, and MLOps at scale. Led ML infrastructure teams at multiple companies, establishing practices for reliable model deployment and monitoring.

EXPERIENCE

OpenAI | San Francisco, CA
Staff ML Engineer | Jan 2022 - Present
- Building evaluation infrastructure for large language models
- Designed training pipelines processing petabytes of data
- Architecting MLOps platform serving 1000+ model deployments
- Leading team of 5 ML engineers on infrastructure projects
- Contributing to system design for scalable inference

Google | Mountain View, CA
Senior ML Engineer | Apr 2017 - Dec 2021
- Built TensorFlow training infrastructure for Search ranking
- Designed distributed training system scaling to 1000+ GPUs
- Led MLOps initiative reducing model deployment time by 90%
- Mentored 8 engineers on ML systems and best practices

Microsoft | Seattle, WA
ML Engineer | Aug 2013 - Mar 2017
- Built ML pipelines for Bing relevance models
- Developed Spark-based feature engineering infrastructure
- Implemented model monitoring and A/B testing frameworks

EDUCATION

UC Berkeley
Ph.D. Computer Science (ML focus) | 2013
M.S. Computer Science | 2010
B.S. Computer Science | 2008

SKILLS
Languages & Frameworks: Python, TensorFlow, PyTorch, Spark
Infrastructure: Kubernetes, Docker, AWS, Ray
ML: Deep Learning, Model Training, MLOps, Feature Engineering
Leadership: System Design, Mentorship, Analytical Thinking`,
  },

  // Jennifer Lee - Staff Frontend (10 years, React & Web Performance)
  {
    engineerId: 'eng_jennifer',
    resumeText: `JENNIFER LEE
jennifer.lee@email.com | (206) 555-0134 | Seattle, WA

SUMMARY
Staff Frontend Engineer with 10 years of experience building high-performance web applications at scale. Expert in React, TypeScript, and web performance optimization. Led frontend architecture at multiple companies, establishing patterns used by hundreds of engineers.

EXPERIENCE

Microsoft | Seattle, WA
Staff Frontend Engineer | May 2021 - Present
- Leading frontend architecture for Microsoft 365 web applications
- Designed performance optimization framework reducing load times by 60%
- Built React component library used by 500+ engineers across org
- Establishing frontend best practices and code review standards
- Mentoring 5 senior engineers on performance and architecture

Airbnb | San Francisco, CA
Senior Frontend Engineer | Aug 2017 - Apr 2021
- Led frontend architecture for search and booking flows
- Built Next.js application serving 150M+ monthly visitors
- Designed GraphQL federation layer for frontend data fetching
- Established accessibility standards achieving WCAG 2.1 AA compliance

Facebook | Menlo Park, CA
Frontend Engineer | Jun 2014 - Jul 2017
- Built React components for News Feed and Messenger
- Contributed to React performance optimization initiatives
- Developed JavaScript tooling and build infrastructure

EDUCATION

University of Washington
B.S. Computer Science | 2014

SKILLS
Languages & Frameworks: TypeScript, JavaScript, React, Next.js
Performance: Web Vitals, Bundle Optimization, Rendering Performance
APIs: GraphQL, REST
Leadership: System Design, Mentorship, Frontend Architecture, Unit Testing`,
  },

  // Michael Brown - Staff DevOps (12 years, AWS & Platform Engineering)
  {
    engineerId: 'eng_michael',
    resumeText: `MICHAEL BROWN
michael.brown@email.com | (720) 555-0156 | Denver, CO

SUMMARY
Staff Platform Engineer with 12 years of experience building cloud infrastructure and developer platforms. Expert in AWS, Terraform, and Kubernetes at scale. Led platform teams establishing infrastructure patterns used across entire organizations.

EXPERIENCE

Snowflake | San Mateo, CA (Remote)
Staff Platform Engineer | Apr 2021 - Present
- Architecting multi-cloud infrastructure across AWS, Azure, and GCP
- Designed Terraform modules used for 5000+ infrastructure resources
- Built Kubernetes platform serving 500+ internal services
- Leading platform team of 8 engineers across 3 time zones
- Establishing cloud cost optimization practices saving $5M+ annually

Dropbox | San Francisco, CA (Remote)
Senior Platform Engineer | Jul 2017 - Mar 2021
- Built AWS infrastructure for file sync serving 700M+ users
- Designed Helm charts standardizing deployments across 200+ services
- Implemented monitoring infrastructure processing 1B+ metrics daily
- Led migration to Kubernetes reducing operational overhead by 50%

AWS | Seattle, WA
Cloud Engineer | Aug 2013 - Jun 2017
- Built internal tools for AWS service monitoring
- Developed Python automation for infrastructure management
- Contributed to Terraform AWS provider

EDUCATION

Georgia Tech
M.S. Computer Science | 2013
B.S. Computer Science | 2011

SKILLS
Infrastructure: AWS, Terraform, Kubernetes, Docker, Helm
Languages: Python, Go, Bash
Monitoring: Prometheus, Grafana, Datadog
Leadership: System Design, Team Leadership, Cloud Architecture`,
  },

  // Sanjay Patel - Staff Data Engineer (10 years, Spark & Real-time)
  {
    engineerId: 'eng_sanjay',
    resumeText: `SANJAY PATEL
sanjay.patel@email.com | (408) 555-0178 | San Jose, CA

SUMMARY
Staff Data Engineer with 12 years of experience building real-time data infrastructure at scale. Expert in Apache Spark, Kafka, and designing data platforms that process petabytes daily. Led data engineering teams at streaming companies, establishing patterns for reliable data processing.

EXPERIENCE

Netflix | Los Gatos, CA
Staff Data Engineer | Mar 2020 - Present
- Architecting next-generation data platform for content analytics
- Designed Spark pipelines processing 10PB+ daily viewing data
- Built Kafka streaming infrastructure handling 5M+ events per second
- Leading team of 6 data engineers on platform initiatives
- Mentoring engineers on distributed systems and data modeling

Spotify | New York, NY (Remote)
Senior Data Engineer | Jun 2016 - Feb 2020
- Built real-time streaming analytics for 400M+ monthly active users
- Designed Kafka-based event streaming architecture
- Implemented data quality monitoring catching 95%+ of issues
- Led migration from batch to streaming reducing latency by 99%

Yahoo | Sunnyvale, CA
Data Engineer | Jul 2012 - May 2016
- Built Spark ETL pipelines for advertising analytics
- Developed PostgreSQL data warehousing solutions
- Implemented Hadoop-based batch processing workflows

EDUCATION

Stanford University
M.S. Computer Science | 2012
B.S. Computer Science | 2010

SKILLS
Data: Apache Spark, Kafka, Airflow, Flink
Languages: Python, Scala, SQL
Databases: PostgreSQL, Cassandra, Delta Lake
Leadership: Distributed Systems, System Design, Mentorship`,
  },

  // Christine Wu - Staff Full Stack (11 years, Healthcare & Fintech)
  {
    engineerId: 'eng_christine',
    resumeText: `CHRISTINE WU
christine.wu@email.com | (415) 555-0143 | San Francisco, CA

SUMMARY
Staff Full Stack Engineer with 11 years of experience building compliant software systems for healthcare and fintech. Expert in React, Node.js, and designing systems that meet strict regulatory requirements. Led engineering teams delivering mission-critical applications serving millions of users.

EXPERIENCE

Plaid | San Francisco, CA
Staff Software Engineer | Jun 2020 - Present
- Architecting bank connection infrastructure serving 8000+ financial institutions
- Designed distributed systems handling 1B+ API calls daily
- Built React dashboard for financial data visualization
- Leading team of 7 engineers on core infrastructure
- Establishing security practices for PCI-DSS compliance

Flatiron Health | New York, NY (Remote)
Senior Software Engineer | Mar 2017 - May 2020
- Built full stack features for oncology clinical platform
- Designed React applications for 2000+ cancer research sites
- Implemented Node.js APIs for clinical trial data management
- Led HIPAA compliance initiatives for data handling
- Mentored 4 engineers on healthcare software development

Epic Systems | Madison, WI
Software Engineer | Aug 2013 - Feb 2017
- Developed healthcare applications for major hospital systems
- Built integrations handling millions of patient records
- Implemented monitoring for critical healthcare workflows

EDUCATION

University of Wisconsin-Madison
B.S. Computer Science | 2013

SKILLS
Languages & Frameworks: TypeScript, JavaScript, React, Node.js
Databases: PostgreSQL, Redis, GraphQL
Compliance: HIPAA, PCI-DSS, SOC2
Leadership: Distributed Systems, Documentation, Attention to Detail, Monitoring`,
  },

  // Hassan Mahmoud - Staff Security Engineer (12 years, AppSec & Cloud)
  {
    engineerId: 'eng_hassan',
    resumeText: `HASSAN MAHMOUD
hassan.mahmoud@email.com | (202) 555-0167 | Washington, DC

SUMMARY
Staff Security Engineer with 12 years of experience building secure infrastructure for financial services. Expert in AWS security, application security, and threat modeling. Led security teams at major banks, establishing practices protecting billions in assets.

EXPERIENCE

Capital One | McLean, VA
Staff Security Engineer | Apr 2020 - Present
- Architecting cloud security strategy for $30B+ digital bank
- Designed zero-trust architecture across 500+ AWS accounts
- Built Python security automation processing 10M+ events daily
- Leading security team of 6 engineers on cloud initiatives
- Establishing security review process for 200+ development teams

JPMorgan Chase | New York, NY
Senior Security Engineer | Jul 2016 - Mar 2020
- Built security infrastructure for trading platform
- Designed Kubernetes security policies for container workloads
- Implemented threat detection systems catching advanced attacks
- Led incident response for critical security events
- Mentored 5 engineers on application security

Deloitte | Washington, DC
Security Consultant | Aug 2012 - Jun 2016
- Conducted security assessments for financial services clients
- Developed Terraform security modules for cloud deployments
- Built security documentation and runbooks

EDUCATION

Georgetown University
M.S. Cybersecurity | 2012
B.S. Computer Science | 2010

SKILLS
Infrastructure: AWS, Terraform, Kubernetes, Docker
Security: Cloud Security, AppSec, Threat Modeling, IAM
Languages: Python, Go, Bash
Leadership: Monitoring, Analytical Thinking, System Design, Mentorship`,
  },
];

const staffEngineerWorkExperiences: EngineerWorkExperience[] = [
  // Anika
  { id: 'we_anika_citadel', engineerId: 'eng_anika', companyName: 'Citadel', title: 'Staff Platform Engineer', seniority: 'staff', startDate: '2021-03', endDate: 'present', highlights: ['Kafka processing 50M+ msg/sec', 'Kubernetes for 2000+ microservices'] },
  { id: 'we_anika_stripe', engineerId: 'eng_anika', companyName: 'Stripe', title: 'Senior Platform Engineer', seniority: 'senior', startDate: '2017-06', endDate: '2021-02', highlights: ['Payment infrastructure for $100B+ volume', 'Kubernetes migration'] },
  { id: 'we_anika_goldman', engineerId: 'eng_anika', companyName: 'Goldman Sachs', title: 'Platform Engineer', seniority: 'mid', startDate: '2013-08', endDate: '2017-05', highlights: ['Trading infrastructure', 'Low-latency messaging'] },
  // Alex
  { id: 'we_alex_fidelity', engineerId: 'eng_alex', companyName: 'Fidelity', title: 'Staff Software Engineer', seniority: 'staff', startDate: '2020-04', endDate: 'present', highlights: ['Investment platform for $5T+ assets', 'API gateway for 10M+ users'] },
  { id: 'we_alex_mathworks', engineerId: 'eng_alex', companyName: 'MathWorks', title: 'Senior Software Engineer', seniority: 'senior', startDate: '2016-08', endDate: '2020-03', highlights: ['MATLAB Online backend', 'Microservices migration'] },
  { id: 'we_alex_oracle', engineerId: 'eng_alex', companyName: 'Oracle', title: 'Software Engineer', seniority: 'mid', startDate: '2013-06', endDate: '2016-07', highlights: ['Cloud infrastructure backend', 'PostgreSQL optimizations'] },
  // Dmitri
  { id: 'we_dmitri_openai', engineerId: 'eng_dmitri', companyName: 'OpenAI', title: 'Staff ML Engineer', seniority: 'staff', startDate: '2022-01', endDate: 'present', highlights: ['LLM evaluation infrastructure', 'MLOps for 1000+ deployments'] },
  { id: 'we_dmitri_google', engineerId: 'eng_dmitri', companyName: 'Google', title: 'Senior ML Engineer', seniority: 'senior', startDate: '2017-04', endDate: '2021-12', highlights: ['Search ranking training', 'Distributed training for 1000+ GPUs'] },
  { id: 'we_dmitri_microsoft', engineerId: 'eng_dmitri', companyName: 'Microsoft', title: 'ML Engineer', seniority: 'mid', startDate: '2013-08', endDate: '2017-03', highlights: ['Bing ML pipelines', 'Feature engineering'] },
  // Jennifer
  { id: 'we_jennifer_microsoft', engineerId: 'eng_jennifer', companyName: 'Microsoft', title: 'Staff Frontend Engineer', seniority: 'staff', startDate: '2021-05', endDate: 'present', highlights: ['M365 frontend architecture', 'Component library for 500+ engineers'] },
  { id: 'we_jennifer_airbnb', engineerId: 'eng_jennifer', companyName: 'Airbnb', title: 'Senior Frontend Engineer', seniority: 'senior', startDate: '2017-08', endDate: '2021-04', highlights: ['Search frontend for 150M+ visitors', 'GraphQL federation'] },
  { id: 'we_jennifer_facebook', engineerId: 'eng_jennifer', companyName: 'Facebook', title: 'Frontend Engineer', seniority: 'mid', startDate: '2014-06', endDate: '2017-07', highlights: ['News Feed React components', 'JS tooling'] },
  // Michael
  { id: 'we_michael_snowflake', engineerId: 'eng_michael', companyName: 'Snowflake', title: 'Staff Platform Engineer', seniority: 'staff', startDate: '2021-04', endDate: 'present', highlights: ['Multi-cloud infrastructure', 'Terraform for 5000+ resources'] },
  { id: 'we_michael_dropbox', engineerId: 'eng_michael', companyName: 'Dropbox', title: 'Senior Platform Engineer', seniority: 'senior', startDate: '2017-07', endDate: '2021-03', highlights: ['AWS for 700M+ users', 'Kubernetes migration'] },
  { id: 'we_michael_aws', engineerId: 'eng_michael', companyName: 'AWS', title: 'Cloud Engineer', seniority: 'mid', startDate: '2013-08', endDate: '2017-06', highlights: ['Service monitoring tools', 'Terraform provider contributions'] },
  // Sanjay
  { id: 'we_sanjay_netflix', engineerId: 'eng_sanjay', companyName: 'Netflix', title: 'Staff Data Engineer', seniority: 'staff', startDate: '2020-03', endDate: 'present', highlights: ['Data platform for 10PB+ daily', 'Kafka handling 5M+ events/sec'] },
  { id: 'we_sanjay_spotify', engineerId: 'eng_sanjay', companyName: 'Spotify', title: 'Senior Data Engineer', seniority: 'senior', startDate: '2016-06', endDate: '2020-02', highlights: ['Streaming analytics for 400M+ users', 'Batch to streaming migration'] },
  { id: 'we_sanjay_yahoo', engineerId: 'eng_sanjay', companyName: 'Yahoo', title: 'Data Engineer', seniority: 'mid', startDate: '2012-07', endDate: '2016-05', highlights: ['Spark ETL for advertising', 'Data warehousing'] },
  // Christine
  { id: 'we_christine_plaid', engineerId: 'eng_christine', companyName: 'Plaid', title: 'Staff Software Engineer', seniority: 'staff', startDate: '2020-06', endDate: 'present', highlights: ['Bank connections for 8000+ institutions', '1B+ daily API calls'] },
  { id: 'we_christine_flatiron', engineerId: 'eng_christine', companyName: 'Flatiron Health', title: 'Senior Software Engineer', seniority: 'senior', startDate: '2017-03', endDate: '2020-05', highlights: ['Clinical platform for 2000+ sites', 'HIPAA compliance'] },
  { id: 'we_christine_epic', engineerId: 'eng_christine', companyName: 'Epic Systems', title: 'Software Engineer', seniority: 'mid', startDate: '2013-08', endDate: '2017-02', highlights: ['Healthcare applications', 'Patient record integrations'] },
  // Hassan
  { id: 'we_hassan_capitalone', engineerId: 'eng_hassan', companyName: 'Capital One', title: 'Staff Security Engineer', seniority: 'staff', startDate: '2020-04', endDate: 'present', highlights: ['Cloud security for 500+ AWS accounts', 'Zero-trust architecture'] },
  { id: 'we_hassan_jpmorgan', engineerId: 'eng_hassan', companyName: 'JPMorgan Chase', title: 'Senior Security Engineer', seniority: 'senior', startDate: '2016-07', endDate: '2020-03', highlights: ['Trading platform security', 'Kubernetes security policies'] },
  { id: 'we_hassan_deloitte', engineerId: 'eng_hassan', companyName: 'Deloitte', title: 'Security Consultant', seniority: 'mid', startDate: '2012-08', endDate: '2016-06', highlights: ['Financial services security assessments', 'Terraform security modules'] },
];

const staffEngineerSkillLinks: WorkExperienceSkillLink[] = [
  // Anika - Citadel
  { userSkillId: 'es_anika_kafka', workExperienceId: 'we_anika_citadel' },
  { userSkillId: 'es_anika_kubernetes', workExperienceId: 'we_anika_citadel' },
  { userSkillId: 'es_anika_aws', workExperienceId: 'we_anika_citadel' },
  { userSkillId: 'es_anika_distributed', workExperienceId: 'we_anika_citadel' },
  { userSkillId: 'es_anika_system_design', workExperienceId: 'we_anika_citadel' },
  { userSkillId: 'es_anika_mentorship', workExperienceId: 'we_anika_citadel' },
  { userSkillId: 'es_anika_team_leadership', workExperienceId: 'we_anika_citadel' },
  // Anika - Stripe
  { userSkillId: 'es_anika_kafka', workExperienceId: 'we_anika_stripe' },
  { userSkillId: 'es_anika_kubernetes', workExperienceId: 'we_anika_stripe' },
  { userSkillId: 'es_anika_java', workExperienceId: 'we_anika_stripe' },
  { userSkillId: 'es_anika_terraform', workExperienceId: 'we_anika_stripe' },
  // Anika - Goldman
  { userSkillId: 'es_anika_java', workExperienceId: 'we_anika_goldman' },
  { userSkillId: 'es_anika_distributed', workExperienceId: 'we_anika_goldman' },
  { userSkillId: 'es_anika_docker', workExperienceId: 'we_anika_goldman' },
  // Alex - Fidelity
  { userSkillId: 'es_alex_java', workExperienceId: 'we_alex_fidelity' },
  { userSkillId: 'es_alex_spring', workExperienceId: 'we_alex_fidelity' },
  { userSkillId: 'es_alex_system_design', workExperienceId: 'we_alex_fidelity' },
  { userSkillId: 'es_alex_api_design', workExperienceId: 'we_alex_fidelity' },
  { userSkillId: 'es_alex_mentorship', workExperienceId: 'we_alex_fidelity' },
  // Alex - MathWorks
  { userSkillId: 'es_alex_java', workExperienceId: 'we_alex_mathworks' },
  { userSkillId: 'es_alex_spring', workExperienceId: 'we_alex_mathworks' },
  { userSkillId: 'es_alex_postgresql', workExperienceId: 'we_alex_mathworks' },
  { userSkillId: 'es_alex_debugging', workExperienceId: 'we_alex_mathworks' },
  // Alex - Oracle
  { userSkillId: 'es_alex_java', workExperienceId: 'we_alex_oracle' },
  { userSkillId: 'es_alex_postgresql', workExperienceId: 'we_alex_oracle' },
  { userSkillId: 'es_alex_kafka', workExperienceId: 'we_alex_oracle' },
  // Dmitri - OpenAI
  { userSkillId: 'es_dmitri_python', workExperienceId: 'we_dmitri_openai' },
  { userSkillId: 'es_dmitri_tensorflow', workExperienceId: 'we_dmitri_openai' },
  { userSkillId: 'es_dmitri_kubernetes', workExperienceId: 'we_dmitri_openai' },
  { userSkillId: 'es_dmitri_system_design', workExperienceId: 'we_dmitri_openai' },
  { userSkillId: 'es_dmitri_analytical', workExperienceId: 'we_dmitri_openai' },
  // Dmitri - Google
  { userSkillId: 'es_dmitri_python', workExperienceId: 'we_dmitri_google' },
  { userSkillId: 'es_dmitri_tensorflow', workExperienceId: 'we_dmitri_google' },
  { userSkillId: 'es_dmitri_spark', workExperienceId: 'we_dmitri_google' },
  { userSkillId: 'es_dmitri_mentorship', workExperienceId: 'we_dmitri_google' },
  // Dmitri - Microsoft
  { userSkillId: 'es_dmitri_python', workExperienceId: 'we_dmitri_microsoft' },
  { userSkillId: 'es_dmitri_spark', workExperienceId: 'we_dmitri_microsoft' },
  { userSkillId: 'es_dmitri_docker', workExperienceId: 'we_dmitri_microsoft' },
  // Jennifer - Microsoft
  { userSkillId: 'es_jennifer_react', workExperienceId: 'we_jennifer_microsoft' },
  { userSkillId: 'es_jennifer_typescript', workExperienceId: 'we_jennifer_microsoft' },
  { userSkillId: 'es_jennifer_performance', workExperienceId: 'we_jennifer_microsoft' },
  { userSkillId: 'es_jennifer_mentorship', workExperienceId: 'we_jennifer_microsoft' },
  { userSkillId: 'es_jennifer_system_design', workExperienceId: 'we_jennifer_microsoft' },
  // Jennifer - Airbnb
  { userSkillId: 'es_jennifer_react', workExperienceId: 'we_jennifer_airbnb' },
  { userSkillId: 'es_jennifer_nextjs', workExperienceId: 'we_jennifer_airbnb' },
  { userSkillId: 'es_jennifer_graphql', workExperienceId: 'we_jennifer_airbnb' },
  { userSkillId: 'es_jennifer_unit_testing', workExperienceId: 'we_jennifer_airbnb' },
  // Jennifer - Facebook
  { userSkillId: 'es_jennifer_react', workExperienceId: 'we_jennifer_facebook' },
  { userSkillId: 'es_jennifer_javascript', workExperienceId: 'we_jennifer_facebook' },
  { userSkillId: 'es_jennifer_performance', workExperienceId: 'we_jennifer_facebook' },
  // Michael - Snowflake
  { userSkillId: 'es_michael_aws', workExperienceId: 'we_michael_snowflake' },
  { userSkillId: 'es_michael_terraform', workExperienceId: 'we_michael_snowflake' },
  { userSkillId: 'es_michael_kubernetes', workExperienceId: 'we_michael_snowflake' },
  { userSkillId: 'es_michael_system_design', workExperienceId: 'we_michael_snowflake' },
  { userSkillId: 'es_michael_team_leadership', workExperienceId: 'we_michael_snowflake' },
  // Michael - Dropbox
  { userSkillId: 'es_michael_aws', workExperienceId: 'we_michael_dropbox' },
  { userSkillId: 'es_michael_kubernetes', workExperienceId: 'we_michael_dropbox' },
  { userSkillId: 'es_michael_helm', workExperienceId: 'we_michael_dropbox' },
  { userSkillId: 'es_michael_monitoring', workExperienceId: 'we_michael_dropbox' },
  // Michael - AWS
  { userSkillId: 'es_michael_python', workExperienceId: 'we_michael_aws' },
  { userSkillId: 'es_michael_terraform', workExperienceId: 'we_michael_aws' },
  { userSkillId: 'es_michael_docker', workExperienceId: 'we_michael_aws' },
  // Sanjay - Netflix
  { userSkillId: 'es_sanjay_spark', workExperienceId: 'we_sanjay_netflix' },
  { userSkillId: 'es_sanjay_kafka', workExperienceId: 'we_sanjay_netflix' },
  { userSkillId: 'es_sanjay_python', workExperienceId: 'we_sanjay_netflix' },
  { userSkillId: 'es_sanjay_distributed', workExperienceId: 'we_sanjay_netflix' },
  { userSkillId: 'es_sanjay_system_design', workExperienceId: 'we_sanjay_netflix' },
  { userSkillId: 'es_sanjay_mentorship', workExperienceId: 'we_sanjay_netflix' },
  // Sanjay - Spotify
  { userSkillId: 'es_sanjay_spark', workExperienceId: 'we_sanjay_spotify' },
  { userSkillId: 'es_sanjay_kafka', workExperienceId: 'we_sanjay_spotify' },
  { userSkillId: 'es_sanjay_postgresql', workExperienceId: 'we_sanjay_spotify' },
  // Sanjay - Yahoo
  { userSkillId: 'es_sanjay_spark', workExperienceId: 'we_sanjay_yahoo' },
  { userSkillId: 'es_sanjay_python', workExperienceId: 'we_sanjay_yahoo' },
  { userSkillId: 'es_sanjay_postgresql', workExperienceId: 'we_sanjay_yahoo' },
  // Christine - Plaid
  { userSkillId: 'es_christine_react', workExperienceId: 'we_christine_plaid' },
  { userSkillId: 'es_christine_nodejs', workExperienceId: 'we_christine_plaid' },
  { userSkillId: 'es_christine_typescript', workExperienceId: 'we_christine_plaid' },
  { userSkillId: 'es_christine_postgresql', workExperienceId: 'we_christine_plaid' },
  { userSkillId: 'es_christine_distributed', workExperienceId: 'we_christine_plaid' },
  { userSkillId: 'es_christine_attention_detail', workExperienceId: 'we_christine_plaid' },
  // Christine - Flatiron
  { userSkillId: 'es_christine_react', workExperienceId: 'we_christine_flatiron' },
  { userSkillId: 'es_christine_nodejs', workExperienceId: 'we_christine_flatiron' },
  { userSkillId: 'es_christine_documentation', workExperienceId: 'we_christine_flatiron' },
  { userSkillId: 'es_christine_monitoring', workExperienceId: 'we_christine_flatiron' },
  // Christine - Epic
  { userSkillId: 'es_christine_nodejs', workExperienceId: 'we_christine_epic' },
  { userSkillId: 'es_christine_postgresql', workExperienceId: 'we_christine_epic' },
  { userSkillId: 'es_christine_aws', workExperienceId: 'we_christine_epic' },
  // Hassan - Capital One
  { userSkillId: 'es_hassan_aws', workExperienceId: 'we_hassan_capitalone' },
  { userSkillId: 'es_hassan_terraform', workExperienceId: 'we_hassan_capitalone' },
  { userSkillId: 'es_hassan_python', workExperienceId: 'we_hassan_capitalone' },
  { userSkillId: 'es_hassan_monitoring', workExperienceId: 'we_hassan_capitalone' },
  { userSkillId: 'es_hassan_system_design', workExperienceId: 'we_hassan_capitalone' },
  { userSkillId: 'es_hassan_analytical', workExperienceId: 'we_hassan_capitalone' },
  // Hassan - JPMorgan
  { userSkillId: 'es_hassan_kubernetes', workExperienceId: 'we_hassan_jpmorgan' },
  { userSkillId: 'es_hassan_docker', workExperienceId: 'we_hassan_jpmorgan' },
  { userSkillId: 'es_hassan_monitoring', workExperienceId: 'we_hassan_jpmorgan' },
  { userSkillId: 'es_hassan_mentorship', workExperienceId: 'we_hassan_jpmorgan' },
  // Hassan - Deloitte
  { userSkillId: 'es_hassan_terraform', workExperienceId: 'we_hassan_deloitte' },
  { userSkillId: 'es_hassan_aws', workExperienceId: 'we_hassan_deloitte' },
  { userSkillId: 'es_hassan_python', workExperienceId: 'we_hassan_deloitte' },
];

// ============================================
// PRINCIPAL ENGINEERS (3)
// ============================================

const principalEngineerResumes: EngineerResume[] = [
  // Victoria Chang - Principal Architect (15 years, Distributed Systems & Cloud)
  {
    engineerId: 'eng_victoria',
    resumeText: `VICTORIA CHANG
victoria.chang@email.com | (212) 555-0189 | New York, NY

SUMMARY
Principal Engineer with 15 years of experience designing distributed systems at massive scale. Led architecture for systems serving billions of users at Google and AWS. Expert in cloud infrastructure, Kafka, and building platforms that define how entire organizations build software.

EXPERIENCE

Google | New York, NY
Principal Engineer | Jan 2020 - Present
- Defining cloud architecture strategy for Google Cloud Platform
- Designed distributed systems serving 10B+ daily API calls globally
- Led Kafka adoption across Google Cloud, establishing patterns for 500+ teams
- Built Kubernetes-based platform used by 10,000+ internal developers
- Mentoring 20+ senior and staff engineers across the organization
- Driving technical strategy and architectural decisions at VP level

Amazon Web Services | Seattle, WA
Principal Engineer | Mar 2015 - Dec 2019
- Architected core infrastructure for AWS Lambda serverless platform
- Designed systems handling 1M+ function invocations per second
- Led technical strategy for compute services organization
- Established architectural patterns adopted across AWS services
- Mentored staff engineers and led architecture review boards

Microsoft | Seattle, WA
Senior Software Engineer | Jun 2010 - Feb 2015
- Built distributed storage systems for Azure
- Designed Terraform-compatible infrastructure provisioning
- Led team building foundational cloud platform components

EDUCATION

MIT
Ph.D. Computer Science (Distributed Systems) | 2010
M.S. Computer Science | 2007
B.S. Computer Science | 2005

SKILLS
Infrastructure: AWS, Kubernetes, Kafka, Terraform, Docker
Languages: Java, Python, Go
Architecture: Distributed Systems, System Design, Cloud Architecture
Leadership: Team Leadership, Mentorship, Technical Strategy`,
  },

  // Robert Kim - Principal ML Architect (16 years, AI Systems)
  {
    engineerId: 'eng_robert',
    resumeText: `ROBERT KIM
robert.kim@email.com | (650) 555-0134 | Palo Alto, CA

SUMMARY
Principal ML Architect with 16 years of experience building AI systems at scale. Led ML strategy at Google and DeepMind, designing infrastructure serving billions of predictions daily. Expert in TensorFlow, PyTorch, and defining how organizations approach machine learning.

EXPERIENCE

Google DeepMind | San Francisco, CA
Principal ML Architect | Apr 2020 - Present
- Defining ML infrastructure strategy for next-generation AI systems
- Designed training infrastructure processing exabytes of data
- Built TensorFlow/PyTorch platforms for 1000+ researchers
- Leading team of 15 ML engineers on foundational AI infrastructure
- Driving technical strategy for AI research compute at executive level
- Publishing research on scalable ML systems at top venues

Google | Mountain View, CA
Principal Engineer (ML) | Jun 2014 - Mar 2020
- Architected ML platform serving 500B+ daily predictions for Search
- Designed Spark-based feature engineering used by 2000+ ML models
- Led technical strategy for ML infrastructure across Google
- Established ML engineering practices adopted organization-wide
- Mentored 25+ engineers on ML systems and architecture

Amazon | Seattle, WA
Senior ML Engineer | Aug 2008 - May 2014
- Built recommendation systems for Amazon.com
- Designed real-time personalization serving 300M+ customers
- Led PostgreSQL optimization for ML feature storage

EDUCATION

Stanford University
Ph.D. Computer Science (Machine Learning) | 2008
M.S. Computer Science | 2005
B.S. Computer Science | 2003

SKILLS
ML: TensorFlow, PyTorch, Deep Learning, Distributed Training
Data: Apache Spark, Feature Engineering, Data Infrastructure
Infrastructure: AWS, Kubernetes, PostgreSQL
Leadership: System Design, Team Leadership, Mentorship, Technical Strategy`,
  },

  // Elena Rodriguez - Principal Security Architect (14 years, Enterprise Security)
  {
    engineerId: 'eng_elena',
    resumeText: `ELENA RODRIGUEZ
elena.rodriguez@email.com | (202) 555-0156 | Washington, DC

SUMMARY
Principal Security Architect with 14 years of experience building security infrastructure for critical systems. Led security architecture at NSA and major financial institutions. Expert in cloud security, threat modeling, and defining security strategy for organizations handling sensitive data.

EXPERIENCE

Palantir | Washington, DC
Principal Security Architect | Mar 2019 - Present
- Defining security architecture for platforms handling classified data
- Designed zero-trust infrastructure across 200+ AWS accounts
- Built Terraform security modules used by 500+ deployments
- Leading security team of 12 engineers on platform initiatives
- Driving security strategy at executive level for government clients
- Establishing FedRAMP and compliance frameworks

NSA | Fort Meade, MD
Senior Security Architect | Jun 2014 - Feb 2019
- Architected security infrastructure for intelligence systems
- Designed Kubernetes security policies for classified workloads
- Led incident response for critical security events
- Established security review practices for 1000+ engineers
- Mentored 15 engineers on application and cloud security

Capital One | McLean, VA
Security Engineer | Aug 2010 - May 2014
- Built security monitoring for financial applications
- Designed Docker security for containerized workloads
- Implemented threat detection and response systems

EDUCATION

Johns Hopkins University
M.S. Information Security | 2010
B.S. Computer Science | 2008

SKILLS
Security: Cloud Security, Threat Modeling, Zero Trust, AppSec
Infrastructure: AWS, Kubernetes, Terraform, Docker
Monitoring: SIEM, Security Analytics, Incident Response
Leadership: System Design, Team Leadership, Mentorship, Analytical Thinking`,
  },
];

const principalEngineerWorkExperiences: EngineerWorkExperience[] = [
  // Victoria
  { id: 'we_victoria_google', engineerId: 'eng_victoria', companyName: 'Google', title: 'Principal Engineer', seniority: 'principal', startDate: '2020-01', endDate: 'present', highlights: ['GCP architecture strategy', 'Systems for 10B+ daily API calls'] },
  { id: 'we_victoria_aws', engineerId: 'eng_victoria', companyName: 'Amazon Web Services', title: 'Principal Engineer', seniority: 'principal', startDate: '2015-03', endDate: '2019-12', highlights: ['AWS Lambda infrastructure', '1M+ invocations/sec'] },
  { id: 'we_victoria_microsoft', engineerId: 'eng_victoria', companyName: 'Microsoft', title: 'Senior Software Engineer', seniority: 'senior', startDate: '2010-06', endDate: '2015-02', highlights: ['Azure distributed storage', 'Infrastructure provisioning'] },
  // Robert
  { id: 'we_robert_deepmind', engineerId: 'eng_robert', companyName: 'Google DeepMind', title: 'Principal ML Architect', seniority: 'principal', startDate: '2020-04', endDate: 'present', highlights: ['AI infrastructure strategy', 'Training on exabytes of data'] },
  { id: 'we_robert_google', engineerId: 'eng_robert', companyName: 'Google', title: 'Principal Engineer (ML)', seniority: 'principal', startDate: '2014-06', endDate: '2020-03', highlights: ['ML platform for 500B+ daily predictions', 'Spark feature engineering'] },
  { id: 'we_robert_amazon', engineerId: 'eng_robert', companyName: 'Amazon', title: 'Senior ML Engineer', seniority: 'senior', startDate: '2008-08', endDate: '2014-05', highlights: ['Recommendation systems for 300M+ customers', 'Real-time personalization'] },
  // Elena
  { id: 'we_elena_palantir', engineerId: 'eng_elena', companyName: 'Palantir', title: 'Principal Security Architect', seniority: 'principal', startDate: '2019-03', endDate: 'present', highlights: ['Security for classified platforms', 'Zero-trust for 200+ AWS accounts'] },
  { id: 'we_elena_nsa', engineerId: 'eng_elena', companyName: 'NSA', title: 'Senior Security Architect', seniority: 'senior', startDate: '2014-06', endDate: '2019-02', highlights: ['Intelligence system security', 'Kubernetes security for classified'] },
  { id: 'we_elena_capitalone', engineerId: 'eng_elena', companyName: 'Capital One', title: 'Security Engineer', seniority: 'mid', startDate: '2010-08', endDate: '2014-05', highlights: ['Financial security monitoring', 'Threat detection systems'] },
];

const principalEngineerSkillLinks: WorkExperienceSkillLink[] = [
  // Victoria - Google
  { userSkillId: 'es_victoria_distributed', workExperienceId: 'we_victoria_google' },
  { userSkillId: 'es_victoria_aws', workExperienceId: 'we_victoria_google' },
  { userSkillId: 'es_victoria_kubernetes', workExperienceId: 'we_victoria_google' },
  { userSkillId: 'es_victoria_kafka', workExperienceId: 'we_victoria_google' },
  { userSkillId: 'es_victoria_system_design', workExperienceId: 'we_victoria_google' },
  { userSkillId: 'es_victoria_team_leadership', workExperienceId: 'we_victoria_google' },
  { userSkillId: 'es_victoria_mentorship', workExperienceId: 'we_victoria_google' },
  // Victoria - AWS
  { userSkillId: 'es_victoria_distributed', workExperienceId: 'we_victoria_aws' },
  { userSkillId: 'es_victoria_aws', workExperienceId: 'we_victoria_aws' },
  { userSkillId: 'es_victoria_system_design', workExperienceId: 'we_victoria_aws' },
  { userSkillId: 'es_victoria_terraform', workExperienceId: 'we_victoria_aws' },
  { userSkillId: 'es_victoria_java', workExperienceId: 'we_victoria_aws' },
  // Victoria - Microsoft
  { userSkillId: 'es_victoria_java', workExperienceId: 'we_victoria_microsoft' },
  { userSkillId: 'es_victoria_terraform', workExperienceId: 'we_victoria_microsoft' },
  { userSkillId: 'es_victoria_python', workExperienceId: 'we_victoria_microsoft' },
  // Robert - DeepMind
  { userSkillId: 'es_robert_tensorflow', workExperienceId: 'we_robert_deepmind' },
  { userSkillId: 'es_robert_pytorch', workExperienceId: 'we_robert_deepmind' },
  { userSkillId: 'es_robert_python', workExperienceId: 'we_robert_deepmind' },
  { userSkillId: 'es_robert_system_design', workExperienceId: 'we_robert_deepmind' },
  { userSkillId: 'es_robert_team_leadership', workExperienceId: 'we_robert_deepmind' },
  { userSkillId: 'es_robert_mentorship', workExperienceId: 'we_robert_deepmind' },
  // Robert - Google
  { userSkillId: 'es_robert_tensorflow', workExperienceId: 'we_robert_google' },
  { userSkillId: 'es_robert_spark', workExperienceId: 'we_robert_google' },
  { userSkillId: 'es_robert_python', workExperienceId: 'we_robert_google' },
  { userSkillId: 'es_robert_system_design', workExperienceId: 'we_robert_google' },
  { userSkillId: 'es_robert_aws', workExperienceId: 'we_robert_google' },
  // Robert - Amazon
  { userSkillId: 'es_robert_python', workExperienceId: 'we_robert_amazon' },
  { userSkillId: 'es_robert_postgresql', workExperienceId: 'we_robert_amazon' },
  { userSkillId: 'es_robert_distributed', workExperienceId: 'we_robert_amazon' },
  // Elena - Palantir
  { userSkillId: 'es_elena_aws', workExperienceId: 'we_elena_palantir' },
  { userSkillId: 'es_elena_terraform', workExperienceId: 'we_elena_palantir' },
  { userSkillId: 'es_elena_kubernetes', workExperienceId: 'we_elena_palantir' },
  { userSkillId: 'es_elena_system_design', workExperienceId: 'we_elena_palantir' },
  { userSkillId: 'es_elena_team_leadership', workExperienceId: 'we_elena_palantir' },
  { userSkillId: 'es_elena_analytical', workExperienceId: 'we_elena_palantir' },
  // Elena - NSA
  { userSkillId: 'es_elena_kubernetes', workExperienceId: 'we_elena_nsa' },
  { userSkillId: 'es_elena_python', workExperienceId: 'we_elena_nsa' },
  { userSkillId: 'es_elena_monitoring', workExperienceId: 'we_elena_nsa' },
  { userSkillId: 'es_elena_mentorship', workExperienceId: 'we_elena_nsa' },
  // Elena - Capital One
  { userSkillId: 'es_elena_docker', workExperienceId: 'we_elena_capitalone' },
  { userSkillId: 'es_elena_python', workExperienceId: 'we_elena_capitalone' },
  { userSkillId: 'es_elena_monitoring', workExperienceId: 'we_elena_capitalone' },
];

// ============================================
// COMBINED EXPORTS
// ============================================

export const engineerResumes: EngineerResume[] = [
  ...coreEngineerResumes,
  ...juniorEngineerResumes,
  ...midLevelEngineerResumes,
  ...seniorEngineerResumes,
  ...staffEngineerResumes,
  ...principalEngineerResumes,
];

export const engineerWorkExperiences: EngineerWorkExperience[] = [
  ...coreEngineerWorkExperiences,
  ...juniorEngineerWorkExperiences,
  ...midLevelEngineerWorkExperiences,
  ...seniorEngineerWorkExperiences,
  ...staffEngineerWorkExperiences,
  ...principalEngineerWorkExperiences,
];

export const workExperienceSkillLinks: WorkExperienceSkillLink[] = [
  ...coreEngineerSkillLinks,
  ...juniorEngineerSkillLinks,
  ...midLevelEngineerSkillLinks,
  ...seniorEngineerSkillLinks,
  ...staffEngineerSkillLinks,
  ...principalEngineerSkillLinks,
];

export async function seedResumes(session: Session): Promise<void> {
  // 1. Create Resume nodes linked to Engineers
  for (const resume of engineerResumes) {
    await session.run(`
      MATCH (e:Engineer {id: $engineerId})
      MERGE (r:Resume {engineerId: $engineerId})
      ON CREATE SET r.rawText = $rawText, r.createdAt = datetime()
      ON MATCH SET r.rawText = $rawText, r.updatedAt = datetime()
      MERGE (e)-[:HAS_RESUME]->(r)
    `, {
      engineerId: resume.engineerId,
      rawText: resume.resumeText,
    });
  }
  console.log(`[Seed] Created ${engineerResumes.length} engineer resumes`);

  // 2. Create WorkExperience nodes linked to Companies and Engineers
  for (const workExp of engineerWorkExperiences) {
    const normalizedCompanyName = workExp.companyName.toLowerCase();

    await session.run(`
      MERGE (c:Company {normalizedName: $normalizedName})
      ON CREATE SET c.id = randomUUID(), c.name = $companyName, c.type = 'unknown'
    `, {
      normalizedName: normalizedCompanyName,
      companyName: workExp.companyName,
    });

    await session.run(`
      MATCH (e:Engineer {id: $engineerId})
      MATCH (c:Company {normalizedName: $normalizedName})
      MERGE (we:WorkExperience {id: $workExpId})
      ON CREATE SET
        we.title = $title,
        we.seniority = $seniority,
        we.startDate = $startDate,
        we.endDate = $endDate,
        we.highlights = $highlights,
        we.createdAt = datetime()
      ON MATCH SET
        we.title = $title,
        we.seniority = $seniority,
        we.startDate = $startDate,
        we.endDate = $endDate,
        we.highlights = $highlights,
        we.updatedAt = datetime()
      MERGE (e)-[:HAD_ROLE]->(we)
      MERGE (we)-[:AT_COMPANY]->(c)
    `, {
      engineerId: workExp.engineerId,
      normalizedName: normalizedCompanyName,
      workExpId: workExp.id,
      title: workExp.title,
      seniority: workExp.seniority,
      startDate: workExp.startDate,
      endDate: workExp.endDate,
      highlights: workExp.highlights,
    });
  }
  console.log(`[Seed] Created ${engineerWorkExperiences.length} work experiences`);

  // 3. Create USED_AT relationships between UserSkills and WorkExperiences
  for (const link of workExperienceSkillLinks) {
    await session.run(`
      MATCH (us:UserSkill {id: $userSkillId})
      MATCH (we:WorkExperience {id: $workExpId})
      MERGE (us)-[:USED_AT]->(we)
    `, {
      userSkillId: link.userSkillId,
      workExpId: link.workExperienceId,
    });
  }
  console.log(`[Seed] Created ${workExperienceSkillLinks.length} skill-to-work-experience links`);
}
