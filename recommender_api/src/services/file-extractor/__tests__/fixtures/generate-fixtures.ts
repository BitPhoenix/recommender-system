/*
 * Script to generate test PDF and DOCX fixtures for file upload tests.
 * Run with: npx tsx src/services/file-extractor/__tests__/fixtures/generate-fixtures.ts
 */

import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/*
 * Generate a PDF with embedded text (for testing native extraction).
 */
function generateResumeWithText(): void {
  const doc = new PDFDocument();
  const outputPath = path.join(__dirname, "resume-with-text.pdf");
  const stream = fs.createWriteStream(outputPath);

  doc.pipe(stream);

  doc
    .fontSize(24)
    .text("John Doe", { align: "center" })
    .fontSize(12)
    .moveDown()
    .text("Senior Software Engineer", { align: "center" })
    .text("john.doe@example.com | (555) 123-4567", { align: "center" })
    .moveDown(2);

  doc
    .fontSize(16)
    .text("Professional Summary", { underline: true })
    .fontSize(12)
    .moveDown(0.5)
    .text(
      "Experienced software engineer with 8+ years of experience building " +
        "scalable web applications using TypeScript, React, Node.js, and cloud " +
        "technologies. Strong background in distributed systems and microservices " +
        "architecture. Passionate about clean code and developer experience."
    )
    .moveDown();

  doc
    .fontSize(16)
    .text("Skills", { underline: true })
    .fontSize(12)
    .moveDown(0.5)
    .text("Languages: TypeScript, JavaScript, Python, Go")
    .text("Frontend: React, Next.js, Vue.js, HTML/CSS")
    .text("Backend: Node.js, Express, NestJS, FastAPI")
    .text("Databases: PostgreSQL, MongoDB, Redis, Neo4j")
    .text("Cloud: AWS, GCP, Docker, Kubernetes")
    .moveDown();

  doc
    .fontSize(16)
    .text("Work Experience", { underline: true })
    .fontSize(12)
    .moveDown(0.5)
    .fontSize(14)
    .text("Tech Corp Inc. - Senior Software Engineer")
    .fontSize(10)
    .text("January 2020 - Present")
    .fontSize(12)
    .moveDown(0.5)
    .text("• Led development of customer-facing API serving 10M+ requests/day")
    .text("• Reduced infrastructure costs by 40% through architecture optimization")
    .text("• Mentored junior developers and established coding standards")
    .moveDown();

  doc
    .fontSize(14)
    .text("Startup XYZ - Software Engineer")
    .fontSize(10)
    .text("June 2017 - December 2019")
    .fontSize(12)
    .moveDown(0.5)
    .text("• Built real-time collaboration features using WebSocket")
    .text("• Implemented CI/CD pipelines reducing deployment time by 60%")
    .text("• Contributed to open source libraries and internal tooling")
    .moveDown();

  doc
    .fontSize(16)
    .text("Education", { underline: true })
    .fontSize(12)
    .moveDown(0.5)
    .text("BS Computer Science - State University (2017)")
    .text("Relevant coursework: Algorithms, Databases, Distributed Systems");

  doc.end();

  stream.on("finish", () => {
    console.log(`Created: ${outputPath}`);
  });
}

/*
 * Generate an empty PDF (for testing extraction failure).
 */
function generateEmptyPdf(): void {
  const doc = new PDFDocument();
  const outputPath = path.join(__dirname, "empty.pdf");
  const stream = fs.createWriteStream(outputPath);

  doc.pipe(stream);
  // Just create a blank page with no text
  doc.end();

  stream.on("finish", () => {
    console.log(`Created: ${outputPath}`);
  });
}

/*
 * Generate a PDF that simulates a scanned document.
 *
 * This creates a PDF with graphical content (rectangles representing text lines)
 * but NO actual text content. Native PDF text extraction will return nothing,
 * triggering OCR.
 *
 * Note: This placeholder PDF will trigger OCR but OCR won't extract meaningful
 * text from the rectangles. For E2E tests that verify successful OCR extraction,
 * replace this file with an actual scanned PDF containing readable text.
 *
 * The current placeholder is useful for testing:
 * 1. That native extraction correctly returns insufficient text (triggering OCR)
 * 2. That the OCR pipeline runs without crashing
 * 3. That proper error handling occurs when OCR can't extract enough text
 */
function generateScannedResumePdf(): void {
  const doc = new PDFDocument({ size: "letter" });
  const outputPath = path.join(__dirname, "scanned-resume.pdf");
  const stream = fs.createWriteStream(outputPath);

  doc.pipe(stream);

  /*
   * Draw rectangles that visually represent text lines.
   * No actual text content is added, so native extraction will fail.
   */
  let y = 50;
  const lineHeight = 15;
  const leftMargin = 50;

  // "Header" - name placeholder
  doc.rect(leftMargin, y, 120, 18).fill("#333");
  y += 30;

  // "Subtitle" - title placeholder
  doc.rect(leftMargin, y, 180, 12).fill("#555");
  y += 25;

  // Contact info line
  doc.rect(leftMargin, y, 250, 10).fill("#666");
  y += 35;

  // Section header
  doc.rect(leftMargin, y, 150, 14).fill("#333");
  y += 20;

  // Paragraph lines
  for (let i = 0; i < 4; i++) {
    const width = 400 + Math.floor(Math.random() * 50);
    doc.rect(leftMargin, y, width, 8).fill("#555");
    y += lineHeight;
  }
  y += 15;

  // Another section header
  doc.rect(leftMargin, y, 80, 14).fill("#333");
  y += 20;

  // Skill items
  for (let i = 0; i < 3; i++) {
    const width = 350 + Math.floor(Math.random() * 80);
    doc.rect(leftMargin, y, width, 8).fill("#555");
    y += lineHeight;
  }
  y += 15;

  // Work experience section
  doc.rect(leftMargin, y, 130, 14).fill("#333");
  y += 20;

  // Job entry
  doc.rect(leftMargin, y, 280, 11).fill("#444");
  y += 18;

  for (let i = 0; i < 3; i++) {
    const width = 380 + Math.floor(Math.random() * 40);
    doc.rect(leftMargin, y, width, 8).fill("#555");
    y += lineHeight;
  }

  doc.end();

  stream.on("finish", () => {
    console.log(`Created: ${outputPath}`);
    console.log(
      "  Note: This is a placeholder. For meaningful OCR success tests, replace with a real scanned PDF."
    );
  });
}

/*
 * Generate a DOCX resume (for testing DOCX extraction).
 */
async function generateResumeDocx(): Promise<void> {
  const outputPath = path.join(__dirname, "resume.docx");

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "Jane Smith",
                bold: true,
                size: 48,
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Full Stack Developer",
                size: 24,
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "jane.smith@example.com | (555) 987-6543 | San Francisco, CA",
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "" }),

          new Paragraph({
            text: "Professional Summary",
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            text:
              "Dynamic full stack developer with 6 years of experience in building " +
              "modern web applications using JavaScript, TypeScript, and cloud services. " +
              "Expertise in React, Angular, Node.js, and PostgreSQL. Strong advocate for " +
              "test-driven development and continuous integration practices.",
          }),
          new Paragraph({ text: "" }),

          new Paragraph({
            text: "Technical Skills",
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            text: "Frontend: React, Angular, Vue.js, TypeScript, JavaScript, HTML5, CSS3, Tailwind",
          }),
          new Paragraph({
            text: "Backend: Node.js, Express, NestJS, Python, Django, GraphQL, REST APIs",
          }),
          new Paragraph({
            text: "Databases: PostgreSQL, MySQL, MongoDB, Redis, Elasticsearch",
          }),
          new Paragraph({
            text: "DevOps: Docker, Kubernetes, AWS, GCP, CI/CD, GitHub Actions, Terraform",
          }),
          new Paragraph({ text: "" }),

          new Paragraph({
            text: "Work Experience",
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Innovation Labs - Full Stack Developer",
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "March 2021 - Present",
                italics: true,
              }),
            ],
          }),
          new Paragraph({
            text: "• Developed microservices architecture handling 5M+ daily transactions",
          }),
          new Paragraph({
            text: "• Implemented real-time notification system using WebSocket and Redis pub/sub",
          }),
          new Paragraph({
            text: "• Led migration from monolith to microservices, improving scalability by 300%",
          }),
          new Paragraph({ text: "" }),

          new Paragraph({
            children: [
              new TextRun({
                text: "Digital Solutions Inc. - Software Developer",
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "June 2018 - February 2021",
                italics: true,
              }),
            ],
          }),
          new Paragraph({
            text: "• Built customer-facing dashboard with React and Redux, serving 50K+ users",
          }),
          new Paragraph({
            text: "• Created automated testing suite with Jest and Cypress, achieving 90% coverage",
          }),
          new Paragraph({
            text: "• Optimized database queries reducing average response time by 65%",
          }),
          new Paragraph({ text: "" }),

          new Paragraph({
            text: "Education",
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            text: "BS Computer Engineering - Tech University (2018)",
          }),
          new Paragraph({
            text: "Relevant coursework: Data Structures, Web Development, Database Systems, Cloud Computing",
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Created: ${outputPath}`);
}

// Run all generators
generateResumeWithText();
generateEmptyPdf();
generateScannedResumePdf();
generateResumeDocx().catch(console.error);
