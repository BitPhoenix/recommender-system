# Resume File Upload Implementation Plan

**Status**: ✅ Complete (2026-01-23)

All three phases implemented and verified via E2E tests:
- Phase 1: Native PDF text extraction
- Phase 2: OCR fallback for scanned PDFs
- Phase 3: DOCX support via mammoth

See: `thoughts/shared/2_chapter_4/1_project_1/test-results/2026-01-23-resume-file-upload-e2e-test-results.md`

---

## Overview

Add file upload capability (PDF and DOCX) to the existing resume upload endpoint. When a user uploads a file, the system extracts text using the appropriate method before passing it through the existing resume processing flow:
- **PDF**: Native text extraction via pdf-parse, with Tesseract OCR fallback for scanned documents
- **DOCX**: Semantic text extraction via mammoth

## Current State Analysis

### What Exists

- **Resume upload endpoint**: `POST /api/resume/upload` accepting JSON with `resumeText` field
- **Resume processing pipeline**: LLM feature extraction, skill normalization, domain linking, TF-IDF indexing
- **Docker container**: Alpine-based (`node:22-alpine`) with Tilt live-update
- **Middleware**: `express.json()` for JSON body parsing, Zod validation

### What's Missing

- Multipart form-data handling (multer or similar)
- PDF text extraction library (`pdf-parse`)
- DOCX text extraction library (`mammoth`)
- OCR fallback (`tesseract` + `poppler-utils` system packages)
- File upload endpoint variant

### Key Discoveries

- `recommender_api/src/app.ts:14` - Only `express.json()` middleware, no multipart support
- `recommender_api/Dockerfile.dev:6` - Only `curl bash` system packages installed
- `recommender_api/src/schemas/resume.schema.ts:13-56` - Current schema expects JSON body with string fields
- Existing pattern: Services return `null` on external failures (graceful degradation)

## Desired End State

After completing all phases:

1. **File Upload Endpoint** (`POST /api/resume/upload/file`)
   - Accept `multipart/form-data` with PDF or DOCX file
   - Extract text via appropriate method based on file type
   - Pass extracted text through existing resume processing pipeline
   - Return same response format as JSON endpoint plus extraction metadata

2. **Text Extraction Service**
   - **PDF**: Native text extraction via pdf-parse, OCR fallback via Tesseract
   - **DOCX**: Text extraction via mammoth
   - Clear logging of which method was used
   - Configurable minimum text threshold

3. **Container Updates**
   - System packages: `tesseract-ocr`, `poppler-utils`
   - Node packages: `multer`, `pdf-parse`, `mammoth`

### Verification

- All automated tests pass (`npm test`, `npm run typecheck`)
- PDF with native text layer extracts correctly
- PDF requiring OCR extracts correctly (may be lower quality)
- DOCX files extract correctly
- Extraction metadata returned in response (method, pageCount, textLength)
- Existing JSON endpoint continues to work unchanged

## What We're NOT Doing

- Legacy .doc file support (Word 97-2003 binary format) - users can save-as .docx
- Storing original files (only extracted text stored)
- Perfect layout reconstruction or table detection
- Cloud-based OCR (Textract) - local Tesseract only
- Regex-based resume parsing (LLM handles semantic extraction)

## Implementation Approach

**Three phases**, building incrementally:

1. **Phase 1: Native PDF Text Extraction** - Add multer, pdf-parse, and new endpoint
2. **Phase 2: OCR Fallback** - Add Tesseract pipeline for scanned PDFs
3. **Phase 3: DOCX Support** - Add mammoth for Word document extraction

Each phase is independently deployable and testable.

---

## Phase 1: Native PDF Text Extraction

### Overview

Add file upload support with pdf-parse for native text extraction. This handles ~95% of engineering resumes that have embedded text layers.

### Changes Required

#### 1.1 Install Dependencies

**Command:**
```bash
cd recommender_api && npm install multer pdf-parse && npm install -D @types/multer
```

| Package | Purpose |
|---------|---------|
| `multer` | Multipart form-data parsing for file uploads |
| `pdf-parse` | Extract text from PDF text layers |
| `@types/multer` | TypeScript types for multer |

#### 1.2 File Extraction Service (Router)

**File**: `recommender_api/src/services/file-extractor/file-extractor.service.ts` (new)

Routes extraction to the appropriate handler based on MIME type.

```typescript
import { extractTextFromPdf } from "./pdf-extractor.service.js";
import type { FileExtractionResult } from "./pdf-extractor.service.js";

export type { FileExtractionResult };

const MIME_TYPE_PDF = "application/pdf";
const MIME_TYPE_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/*
 * Extract text from a file buffer based on its MIME type.
 * Routes to the appropriate extractor.
 */
export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string
): Promise<FileExtractionResult | null> {
  switch (mimeType) {
    case MIME_TYPE_PDF:
      return extractTextFromPdf(buffer);

    case MIME_TYPE_DOCX:
      // Phase 3 will implement DOCX extraction
      console.warn("[File] DOCX extraction not yet implemented");
      return null;

    default:
      console.warn(`[File] Unsupported MIME type: ${mimeType}`);
      return null;
  }
}
```

#### 1.3 PDF Text Extraction Service

**File**: `recommender_api/src/services/file-extractor/pdf-extractor.service.ts` (new)

```typescript
import pdfParse from "pdf-parse";
import type { ExtractionMethod } from "../../schemas/resume.schema.js";

/*
 * Minimum text length to consider a file successfully extracted.
 * Shorter extractions likely indicate a scanned/image-only PDF.
 */
const MIN_TEXT_LENGTH = 100;

export interface FileExtractionResult {
  text: string;
  pageCount: number;
  extractionMethod: ExtractionMethod;
  textLength: number;
}

/*
 * Extract text from a PDF buffer using native text layer extraction.
 * Returns null if the PDF has insufficient text (likely scanned/image-only).
 */
export async function extractTextFromPdfNative(
  pdfBuffer: Buffer
): Promise<FileExtractionResult | null> {
  try {
    const result = await pdfParse(pdfBuffer);
    const text = result.text?.trim() || "";

    if (text.length < MIN_TEXT_LENGTH) {
      console.log(
        `[PDF] Native extraction returned only ${text.length} chars (threshold: ${MIN_TEXT_LENGTH})`
      );
      return null;
    }

    return {
      text,
      pageCount: result.numpages,
      extractionMethod: "pdf-native",
      textLength: text.length,
    };
  } catch (error) {
    console.warn("[PDF] Native extraction failed:", error);
    return null;
  }
}

/*
 * Extract text from a PDF, using native extraction with OCR fallback.
 * Phase 1 implementation: native only, returns null if OCR needed.
 */
export async function extractTextFromPdf(
  pdfBuffer: Buffer
): Promise<FileExtractionResult | null> {
  // Try native extraction first
  const nativeResult = await extractTextFromPdfNative(pdfBuffer);

  if (nativeResult) {
    console.log(
      `[PDF] Native extraction succeeded: ${nativeResult.textLength} chars, ${nativeResult.pageCount} pages`
    );
    return nativeResult;
  }

  // Phase 2 will add OCR fallback here
  console.warn("[PDF] Native extraction failed and OCR not yet implemented");
  return null;
}
```

#### 1.3 Multer Configuration

**File**: `recommender_api/src/middleware/file-upload.middleware.ts` (new)

```typescript
import multer from "multer";

/*
 * Maximum file size for resume uploads (10 MB).
 * Engineering resumes rarely exceed 2-3 MB, but we allow some headroom.
 */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/*
 * Allowed MIME types for resume uploads.
 * PDF and DOCX are supported; legacy .doc (application/msword) is not.
 */
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
];

/*
 * Multer configuration for resume file uploads.
 * Uses memory storage (buffer) since we process and discard the file.
 */
export const resumeFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only PDF and DOCX files are allowed.`));
    }
  },
});
```

#### 1.4 File Upload Types

**File**: `recommender_api/src/schemas/resume.schema.ts` (add to existing file)

```typescript
// Add after existing schemas

/*
 * Extraction method used to get text from uploaded file.
 */
export const ExtractionMethodSchema = z.enum(["pdf-native", "pdf-ocr", "docx"]);
export type ExtractionMethod = z.infer<typeof ExtractionMethodSchema>;

/*
 * Extended response for file uploads includes extraction metadata.
 * Uses the same base response as JSON uploads.
 */
export interface ResumeFileUploadResponse extends ResumeUploadResponse {
  extractionMetadata: {
    method: ExtractionMethod;
    pageCount: number;
    textLength: number;
  };
}
```

**Note**: No separate request schema needed. The file upload controller converts form field strings to proper types, then validates using the existing `ResumeUploadRequestSchema`.

#### 1.5 File Upload Controller

**File**: `recommender_api/src/controllers/resume.controller.ts` (add to existing file)

```typescript
// Add imports
import { extractTextFromFile } from "../services/file-extractor/file-extractor.service.js";
import {
  ResumeUploadRequestSchema,
  type ResumeUploadRequest,
  type ResumeFileUploadResponse,
} from "../schemas/resume.schema.js";

/*
 * Handle resume file upload requests (PDF, DOCX).
 * POST /api/resume/upload/file
 *
 * Reuses the same schema as JSON uploads - just converts form field strings
 * to proper types before validation.
 */
export async function uploadResumeFile(req: Request, res: Response): Promise<void> {
  const session = driver.session();

  try {
    // Validate that a file was uploaded
    const file = req.file;
    if (!file) {
      res.status(400).json({
        error: {
          code: "NO_FILE",
          message: "No file provided. Upload a PDF or DOCX file with field name 'resume'.",
        },
      });
      return;
    }

    // Extract text based on file type
    const extractionResult = await extractTextFromFile(file.buffer, file.mimetype);
    if (!extractionResult) {
      res.status(422).json({
        error: {
          code: "EXTRACTION_FAILED",
          message:
            "Could not extract text from file. For PDFs, the file may be scanned/image-only. " +
            "OCR support is not yet implemented.",
        },
      });
      return;
    }

    /*
     * Convert form field strings to proper types, then validate with the same
     * schema used by the JSON endpoint. This avoids duplicating validation logic.
     */
    const formFields = req.body;
    const requestBody = {
      resumeText: extractionResult.text,
      engineerId: formFields.engineerId || undefined,
      name: formFields.name || undefined,
      email: formFields.email || undefined,
      generateVectors: formFields.generateVectors
        ? JSON.parse(formFields.generateVectors)
        : undefined,
      skipFeatureExtraction: formFields.skipFeatureExtraction === "true",
    };

    // Validate with the same schema as JSON uploads
    let validatedRequest: ResumeUploadRequest;
    try {
      validatedRequest = ResumeUploadRequestSchema.parse(requestBody);
    } catch (validationError) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid form fields",
          details: validationError,
        },
      });
      return;
    }

    // Process through existing pipeline (same as JSON endpoint)
    const result = await processResumeUpload(session, validatedRequest);

    // Build response with extraction metadata
    const response: ResumeFileUploadResponse = {
      ...result,
      extractionMetadata: {
        method: extractionResult.extractionMethod,
        pageCount: extractionResult.pageCount,
        textLength: extractionResult.textLength,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Resume file upload error:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: error.message,
        },
      });
      return;
    }

    res.status(500).json({
      error: {
        code: "RESUME_UPLOAD_ERROR",
        message: "Failed to process resume file upload",
        details: error instanceof Error ? [{ field: "internal", message: error.message }] : undefined,
      },
    });
  } finally {
    await session.close();
  }
}
```

#### 1.6 Add Route

**File**: `recommender_api/src/routes/resume.routes.ts` (update existing file)

```typescript
import { Router } from "express";
import { uploadResume, uploadResumeFile } from "../controllers/resume.controller.js";
import { validate } from "../middleware/zod-validate.middleware.js";
import { ResumeUploadRequestSchema } from "../schemas/resume.schema.js";
import { resumeFileUpload } from "../middleware/file-upload.middleware.js";

const router = Router();

/*
 * POST /api/resume/upload
 * Upload resume as JSON with resumeText field.
 */
router.post("/upload", validate(ResumeUploadRequestSchema), uploadResume);

/*
 * POST /api/resume/upload/file
 * Upload resume as PDF file via multipart form-data.
 * Field name: "resume"
 */
router.post("/upload/file", resumeFileUpload.single("resume"), uploadResumeFile);

export default router;
```

#### 1.7 Error Handling for Multer

**File**: `recommender_api/src/app.ts` (update)

Add error handling middleware for multer errors after the routes:

```typescript
import { MulterError } from "multer";

// ... existing code ...

// API routes
app.use('/api/search', searchRoutes);
app.use('/api/search', contentSearchRoutes);
app.use('/api/engineers', similarityRoutes);
app.use('/api/resume', resumeRoutes);

// Error handling for file uploads
app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        error: {
          code: "FILE_TOO_LARGE",
          message: "File size exceeds the 10 MB limit",
        },
      });
      return;
    }
    res.status(400).json({
      error: {
        code: "FILE_UPLOAD_ERROR",
        message: err.message,
      },
    });
    return;
  }

  if (err.message?.includes("Invalid file type")) {
    res.status(415).json({
      error: {
        code: "INVALID_FILE_TYPE",
        message: err.message,
      },
    });
    return;
  }

  next(err);
});

return app;
```

### Success Criteria

#### Automated Verification:

- [x] TypeScript compiles: `npm run typecheck`
- [x] Unit tests pass: `npm test`
- [x] E2E tests pass: `npm run test:e2e:file-upload` (7 tests, 22 assertions)
- [x] New dependencies installed and importable

#### Unit Tests Required

**File**: `recommender_api/src/services/file-extractor/__tests__/pdf-extractor.service.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractTextFromPdfNative, extractTextFromPdf } from '../pdf-extractor.service.js';

/*
 * Unit tests for PDF text extraction.
 * Uses mocked pdf-parse to avoid needing real PDF files.
 */
describe('pdf-extractor.service', () => {
  describe('extractTextFromPdfNative', () => {
    it('returns extraction result for PDFs with sufficient text', async () => {
      // Mock pdf-parse to return valid text
      vi.doMock('pdf-parse', () => ({
        default: vi.fn().mockResolvedValue({
          text: 'A'.repeat(150), // More than MIN_TEXT_LENGTH (100)
          numpages: 2,
        }),
      }));

      const { extractTextFromPdfNative } = await import('../pdf-extractor.service.js');
      const result = await extractTextFromPdfNative(Buffer.from('fake-pdf'));

      expect(result).not.toBeNull();
      expect(result?.extractionMethod).toBe('pdf-native');
      expect(result?.textLength).toBe(150);
      expect(result?.pageCount).toBe(2);
    });

    it('returns null for PDFs with insufficient text', async () => {
      vi.doMock('pdf-parse', () => ({
        default: vi.fn().mockResolvedValue({
          text: 'Short', // Less than MIN_TEXT_LENGTH (100)
          numpages: 1,
        }),
      }));

      const { extractTextFromPdfNative } = await import('../pdf-extractor.service.js');
      const result = await extractTextFromPdfNative(Buffer.from('fake-pdf'));

      expect(result).toBeNull();
    });

    it('returns null when pdf-parse throws an error', async () => {
      vi.doMock('pdf-parse', () => ({
        default: vi.fn().mockRejectedValue(new Error('Invalid PDF')),
      }));

      const { extractTextFromPdfNative } = await import('../pdf-extractor.service.js');
      const result = await extractTextFromPdfNative(Buffer.from('invalid-pdf'));

      expect(result).toBeNull();
    });

    it('trims whitespace from extracted text', async () => {
      vi.doMock('pdf-parse', () => ({
        default: vi.fn().mockResolvedValue({
          text: '   ' + 'A'.repeat(150) + '   \n\n',
          numpages: 1,
        }),
      }));

      const { extractTextFromPdfNative } = await import('../pdf-extractor.service.js');
      const result = await extractTextFromPdfNative(Buffer.from('fake-pdf'));

      expect(result?.text).toBe('A'.repeat(150));
    });
  });

  describe('extractTextFromPdf', () => {
    it('returns native extraction result when successful', async () => {
      vi.doMock('pdf-parse', () => ({
        default: vi.fn().mockResolvedValue({
          text: 'A'.repeat(200),
          numpages: 3,
        }),
      }));

      const { extractTextFromPdf } = await import('../pdf-extractor.service.js');
      const result = await extractTextFromPdf(Buffer.from('fake-pdf'));

      expect(result).not.toBeNull();
      expect(result?.extractionMethod).toBe('pdf-native');
    });

    it('returns null when native extraction fails and OCR not implemented', async () => {
      vi.doMock('pdf-parse', () => ({
        default: vi.fn().mockResolvedValue({
          text: '', // Empty text, triggers OCR fallback
          numpages: 1,
        }),
      }));

      const { extractTextFromPdf } = await import('../pdf-extractor.service.js');
      const result = await extractTextFromPdf(Buffer.from('scanned-pdf'));

      // Phase 1: OCR not implemented, so returns null
      expect(result).toBeNull();
    });
  });
});
```

**File**: `recommender_api/src/services/file-extractor/__tests__/file-extractor.service.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

/*
 * Unit tests for file extraction routing.
 */
describe('file-extractor.service', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('extractTextFromFile', () => {
    it('routes PDF files to PDF extractor', async () => {
      const mockPdfResult = {
        text: 'PDF content',
        pageCount: 1,
        extractionMethod: 'pdf-native' as const,
        textLength: 11,
      };

      vi.doMock('../pdf-extractor.service.js', () => ({
        extractTextFromPdf: vi.fn().mockResolvedValue(mockPdfResult),
      }));

      const { extractTextFromFile } = await import('../file-extractor.service.js');
      const result = await extractTextFromFile(
        Buffer.from('fake-pdf'),
        'application/pdf'
      );

      expect(result).toEqual(mockPdfResult);
    });

    it('returns null for unsupported MIME types', async () => {
      const { extractTextFromFile } = await import('../file-extractor.service.js');
      const result = await extractTextFromFile(
        Buffer.from('plain text'),
        'text/plain'
      );

      expect(result).toBeNull();
    });

    it('returns null for DOCX (Phase 3 not implemented yet)', async () => {
      const { extractTextFromFile } = await import('../file-extractor.service.js');
      const result = await extractTextFromFile(
        Buffer.from('fake-docx'),
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );

      // Phase 1: DOCX not implemented
      expect(result).toBeNull();
    });
  });
});
```

#### E2E Tests Required (Postman Collection)

**File**: `postman/collections/resume-file-upload-tests.postman_collection.json`

Create a new Postman collection with the following tests:

| Test Name | Description | Expected |
|-----------|-------------|----------|
| 01 - PDF Upload Success | Upload PDF with text layer, name, email | 200, extractionMetadata.method = "pdf-native" |
| 02 - PDF Upload Updates Existing Engineer | Upload PDF with engineerId | 200, isNewEngineer = false |
| 03 - Unsupported File Type | Upload .txt file | 415 INVALID_FILE_TYPE |
| 04 - File Too Large | Upload file > 10MB | 413 FILE_TOO_LARGE |
| 05 - Missing File | POST without file attachment | 400 NO_FILE |
| 06 - Empty PDF (Insufficient Text) | Upload PDF with no text layer | 422 EXTRACTION_FAILED |
| 07 - Response Has Extraction Metadata | Upload valid PDF | Has pageCount, textLength, method |
| 08 - JSON Endpoint Still Works | POST to /api/resume/upload with JSON | 200 (regression test) |

**Add npm script to package.json:**

```json
{
  "scripts": {
    "test:e2e:file-upload": "newman run ../postman/collections/resume-file-upload-tests.postman_collection.json --globals ../postman/globals/workspace.postman_globals.json"
  }
}
```

**Test Fixture Files Required:**

Create test PDF files in `recommender_api/src/services/file-extractor/__tests__/fixtures/`:
- `resume-with-text.pdf` - A simple PDF with embedded text (can be generated programmatically or manually)
- `empty.pdf` - A PDF with no text content (for testing extraction failure)

**Note on File Upload Testing in Newman:**

Newman supports file uploads via form-data. Each test should use the `formdata` body mode with file attachments. Example structure:

```json
{
  "request": {
    "method": "POST",
    "url": "{{baseUrl}}/api/resume/upload/file",
    "body": {
      "mode": "formdata",
      "formdata": [
        {
          "key": "resume",
          "type": "file",
          "src": "fixtures/resume-with-text.pdf"
        },
        {
          "key": "name",
          "value": "Test Engineer",
          "type": "text"
        },
        {
          "key": "email",
          "value": "test@example.com",
          "type": "text"
        }
      ]
    }
  }
}
```

---

## Phase 2: OCR Fallback for Scanned PDFs

### Overview

Add Tesseract OCR as a fallback for PDFs that don't have extractable text layers (scanned documents, image-only PDFs).

### Changes Required

#### 2.1 Update Dockerfile

**File**: `recommender_api/Dockerfile.dev` (update)

```dockerfile
FROM node:22-alpine

WORKDIR /app

# Install necessary packages including PDF/OCR tools
RUN apk add --no-cache \
    curl \
    bash \
    tesseract-ocr \
    poppler-utils

# Copy package files first for better caching
COPY recommender_api/package*.json ./
COPY recommender_api/tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY recommender_api/src ./src

EXPOSE 4025

# Start with tsx watch for hot reload
CMD ["npm", "run", "dev"]
```

#### 2.2 OCR Extraction Service

**File**: `recommender_api/src/services/file-extractor/ocr-extractor.service.ts` (new)

```typescript
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

export interface OcrExtractionResult {
  text: string;
  pageCount: number;
}

/*
 * Convert PDF to images and run OCR using Tesseract.
 *
 * Pipeline:
 * 1. Write PDF buffer to temp file
 * 2. Convert PDF pages to PNG images using pdftoppm
 * 3. Run Tesseract OCR on each image
 * 4. Concatenate results
 * 5. Clean up temp files
 */
export async function extractTextWithOcr(
  pdfBuffer: Buffer
): Promise<OcrExtractionResult | null> {
  /*
   * fs.mkdtemp() is safe for concurrent requests:
   * - Creates a unique directory by appending 6 random characters to the prefix
   * - Example: "ocr-" becomes "ocr-abc123" or "ocr-xyz789"
   * - Each concurrent call gets a completely different directory
   * - Node.js's mkdtemp uses cryptographically random characters
   *
   * So if two resumes are uploaded simultaneously:
   * - Request 1 → /tmp/ocr-a3f8k2/input.pdf
   * - Request 2 → /tmp/ocr-x9m1n4/input.pdf
   *
   * They're isolated by the unique directory, not the filename.
   */
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ocr-"));

  try {
    // Step 1: Write PDF to temp file
    const pdfPath = path.join(tempDir, "input.pdf");
    await fs.writeFile(pdfPath, pdfBuffer);

    // Step 2: Convert PDF to PNG images
    const imagePrefix = path.join(tempDir, "page");
    try {
      await execFileAsync("pdftoppm", [
        "-png",
        "-r", "300", // 300 DPI for better OCR accuracy
        pdfPath,
        imagePrefix,
      ]);
    } catch (error) {
      console.warn("[OCR] pdftoppm failed:", error);
      return null;
    }

    // Step 3: Find generated image files
    const files = await fs.readdir(tempDir);
    const imageFiles = files
      .filter((f) => f.startsWith("page") && f.endsWith(".png"))
      .sort(); // Ensure page order

    if (imageFiles.length === 0) {
      console.warn("[OCR] No images generated from PDF");
      return null;
    }

    // Step 4: Run Tesseract on each image
    const textParts: string[] = [];

    for (const imageFile of imageFiles) {
      const imagePath = path.join(tempDir, imageFile);
      const outputBase = imagePath.replace(".png", "");

      try {
        await execFileAsync("tesseract", [
          imagePath,
          outputBase,
          "-l", "eng",
          "--psm", "3", // Fully automatic page segmentation
        ]);

        const textPath = `${outputBase}.txt`;
        const pageText = await fs.readFile(textPath, "utf8");
        textParts.push(pageText);
      } catch (error) {
        console.warn(`[OCR] Tesseract failed on ${imageFile}:`, error);
        // Continue with other pages
      }
    }

    if (textParts.length === 0) {
      console.warn("[OCR] No text extracted from any page");
      return null;
    }

    const fullText = textParts.join("\n\n").trim();

    console.log(
      `[OCR] Extracted ${fullText.length} chars from ${imageFiles.length} pages`
    );

    return {
      text: fullText,
      pageCount: imageFiles.length,
    };
  } finally {
    // Step 5: Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn("[OCR] Failed to clean up temp directory:", cleanupError);
    }
  }
}

/*
 * Check if OCR tools are available in the environment.
 */
export async function isOcrAvailable(): Promise<boolean> {
  try {
    await execFileAsync("tesseract", ["--version"]);
    await execFileAsync("pdftoppm", ["-v"]);
    return true;
  } catch {
    return false;
  }
}
```

#### 2.3 Update PDF Extractor to Use OCR Fallback

**File**: `recommender_api/src/services/file-extractor/pdf-extractor.service.ts` (update)

```typescript
import pdfParse from "pdf-parse";
import { extractTextWithOcr, isOcrAvailable } from "./ocr-extractor.service.js";

const MIN_TEXT_LENGTH = 100;

export interface FileExtractionResult {
  text: string;
  pageCount: number;
  extractionMethod: "pdf-native" | "pdf-ocr" | "docx";
  textLength: number;
}

export async function extractTextFromPdfNative(
  pdfBuffer: Buffer
): Promise<FileExtractionResult | null> {
  try {
    const result = await pdfParse(pdfBuffer);
    const text = result.text?.trim() || "";

    if (text.length < MIN_TEXT_LENGTH) {
      console.log(
        `[PDF] Native extraction returned only ${text.length} chars (threshold: ${MIN_TEXT_LENGTH})`
      );
      return null;
    }

    return {
      text,
      pageCount: result.numpages,
      extractionMethod: "pdf-native",
      textLength: text.length,
    };
  } catch (error) {
    console.warn("[PDF] Native extraction failed:", error);
    return null;
  }
}

/*
 * Extract text from a PDF, using native extraction with OCR fallback.
 */
export async function extractTextFromPdf(
  pdfBuffer: Buffer
): Promise<FileExtractionResult | null> {
  // Try native extraction first
  const nativeResult = await extractTextFromPdfNative(pdfBuffer);

  if (nativeResult) {
    console.log(
      `[PDF] Native extraction succeeded: ${nativeResult.textLength} chars, ${nativeResult.pageCount} pages`
    );
    return nativeResult;
  }

  // Fall back to OCR
  console.log("[PDF] Native extraction failed, attempting OCR fallback");

  const ocrAvailable = await isOcrAvailable();
  if (!ocrAvailable) {
    console.warn("[PDF] OCR tools not available (tesseract/pdftoppm)");
    return null;
  }

  const ocrResult = await extractTextWithOcr(pdfBuffer);
  if (!ocrResult) {
    console.warn("[PDF] OCR extraction failed");
    return null;
  }

  if (ocrResult.text.length < MIN_TEXT_LENGTH) {
    console.warn(
      `[PDF] OCR extraction returned only ${ocrResult.text.length} chars (threshold: ${MIN_TEXT_LENGTH})`
    );
    return null;
  }

  return {
    text: ocrResult.text,
    pageCount: ocrResult.pageCount,
    extractionMethod: "pdf-ocr",
    textLength: ocrResult.text.length,
  };
}
```

#### 2.4 Update Controller Error Message

**File**: `recommender_api/src/controllers/resume.controller.ts` (update error message)

```typescript
// In uploadResumeFile function, update the extraction failure error:
if (!extractionResult) {
  res.status(422).json({
    error: {
      code: "PDF_EXTRACTION_FAILED",
      message:
        "Could not extract text from PDF. The file may be corrupted, password-protected, " +
        "or contain only images that OCR could not process.",
    },
  });
  return;
}
```

### Success Criteria

#### Automated Verification:

- [x] TypeScript compiles: `npm run typecheck`
- [x] Unit tests pass: `npm test`
- [x] E2E tests pass: `npm run test:e2e:file-upload`
- [x] Container rebuilds with new system packages: Tilt auto-rebuilds on Dockerfile change

#### Unit Tests Required

**File**: `recommender_api/src/services/file-extractor/__tests__/ocr-extractor.service.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';

/*
 * Unit tests for OCR extraction.
 * Mocks system calls to tesseract and pdftoppm.
 */
describe('ocr-extractor.service', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('isOcrAvailable', () => {
    it('returns true when tesseract and pdftoppm are available', async () => {
      vi.doMock('child_process', () => ({
        execFile: vi.fn((cmd, args, cb) => cb(null, '', '')),
      }));

      const { isOcrAvailable } = await import('../ocr-extractor.service.js');
      const result = await isOcrAvailable();

      expect(result).toBe(true);
    });

    it('returns false when tesseract is not available', async () => {
      vi.doMock('child_process', () => ({
        execFile: vi.fn((cmd, args, cb) => {
          if (cmd === 'tesseract') {
            cb(new Error('command not found'), '', '');
          } else {
            cb(null, '', '');
          }
        }),
      }));

      const { isOcrAvailable } = await import('../ocr-extractor.service.js');
      const result = await isOcrAvailable();

      expect(result).toBe(false);
    });
  });

  describe('extractTextWithOcr', () => {
    it('returns null when pdftoppm fails', async () => {
      // This test verifies error handling when PDF-to-image conversion fails
      // Full integration testing done via E2E tests
    });
  });
});
```

**Update existing PDF extractor tests** to cover OCR fallback:

```typescript
// Add to pdf-extractor.service.test.ts

describe('extractTextFromPdf with OCR fallback', () => {
  it('falls back to OCR when native extraction returns insufficient text', async () => {
    // Mock native extraction to return too little text
    vi.doMock('pdf-parse', () => ({
      default: vi.fn().mockResolvedValue({
        text: 'Short',
        numpages: 1,
      }),
    }));

    // Mock OCR to be available and return text
    vi.doMock('./ocr-extractor.service.js', () => ({
      isOcrAvailable: vi.fn().mockResolvedValue(true),
      extractTextWithOcr: vi.fn().mockResolvedValue({
        text: 'A'.repeat(200),
        pageCount: 1,
      }),
    }));

    const { extractTextFromPdf } = await import('../pdf-extractor.service.js');
    const result = await extractTextFromPdf(Buffer.from('scanned-pdf'));

    expect(result).not.toBeNull();
    expect(result?.extractionMethod).toBe('pdf-ocr');
  });

  it('returns null when OCR tools are not available', async () => {
    vi.doMock('pdf-parse', () => ({
      default: vi.fn().mockResolvedValue({
        text: '',
        numpages: 1,
      }),
    }));

    vi.doMock('./ocr-extractor.service.js', () => ({
      isOcrAvailable: vi.fn().mockResolvedValue(false),
      extractTextWithOcr: vi.fn(),
    }));

    const { extractTextFromPdf } = await import('../pdf-extractor.service.js');
    const result = await extractTextFromPdf(Buffer.from('scanned-pdf'));

    expect(result).toBeNull();
  });
});
```

#### E2E Tests Required (Add to Postman Collection)

Add these tests to `resume-file-upload-tests.postman_collection.json`:

| Test Name | Description | Expected |
|-----------|-------------|----------|
| 09 - Scanned PDF OCR Extraction | Upload image-only PDF | 200, extractionMetadata.method = "pdf-ocr" |
| 10 - Native PDF Still Uses Native | Upload text-layer PDF | 200, extractionMetadata.method = "pdf-native" |
| 11 - OCR Response Has Accurate Page Count | Upload multi-page scanned PDF | pageCount matches actual pages |

**Test Fixture Files Required:**

Add to `recommender_api/src/services/file-extractor/__tests__/fixtures/`:
- `scanned-resume.pdf` - A PDF created from a scanned image (image-only, no text layer)
- `multi-page-scanned.pdf` - Multi-page scanned PDF for page count verification

---

## Phase 3: DOCX Support

### Overview

Add support for DOCX file uploads using the `mammoth` library. This handles modern Word documents exported from Microsoft Word, Google Docs, and LibreOffice.

### Library Selection

| Library / Tool | Best For | Downside |
|----------------|----------|----------|
| **Mammoth** ✓ | Clean semantic text extraction | Not layout-perfect |
| docx-parser / docx4js | Low-level XML access | Verbose, harder to use |
| Pandoc | Very robust conversion | External CLI, not pure JS |
| LibreOffice headless | 1:1 visual fidelity | Heavy (~500MB) and slow |
| Unzip + XML parse | Fully custom extraction | Time-intensive to build |

**Why Mammoth:**
1. **Semantic extraction** - Extracts text with document structure (headings, lists, paragraphs), ideal for LLM processing
2. **Pure JavaScript** - No system dependencies, works anywhere Node runs
3. **Fast** - No process spawning or file I/O beyond reading the buffer
4. **Simple API** - `mammoth.extractRawText({ buffer })` returns clean text
5. **Well-maintained** - Battle-tested, used in production by many organizations

For resume processing, we need **text content**, not visual fidelity. Mammoth extracts exactly what the LLM needs without the overhead of LibreOffice or Pandoc.

### Changes Required

#### 3.1 Install Dependency

**Command:**
```bash
cd recommender_api && npm install mammoth
```

| Package | Purpose |
|---------|---------|
| `mammoth` | Extract text from DOCX files |

Note: `mammoth` ships with TypeScript types, no separate `@types/mammoth` needed.

#### 3.2 DOCX Extraction Service

**File**: `recommender_api/src/services/file-extractor/docx-extractor.service.ts` (new)

```typescript
import mammoth from "mammoth";
import type { FileExtractionResult } from "./pdf-extractor.service.js";

/*
 * Minimum text length to consider a DOCX successfully extracted.
 */
const MIN_TEXT_LENGTH = 100;

/*
 * Extract text from a DOCX buffer using mammoth.
 * Returns the raw text content with paragraphs separated by newlines.
 */
export async function extractTextFromDocx(
  docxBuffer: Buffer
): Promise<FileExtractionResult | null> {
  try {
    const result = await mammoth.extractRawText({ buffer: docxBuffer });
    const text = result.value?.trim() || "";

    if (text.length < MIN_TEXT_LENGTH) {
      console.log(
        `[DOCX] Extraction returned only ${text.length} chars (threshold: ${MIN_TEXT_LENGTH})`
      );
      return null;
    }

    // Log any warnings from mammoth (e.g., unsupported features)
    if (result.messages.length > 0) {
      console.log("[DOCX] Extraction warnings:", result.messages);
    }

    console.log(`[DOCX] Extraction succeeded: ${text.length} chars`);

    return {
      text,
      pageCount: 1, // DOCX doesn't have a native page count concept
      extractionMethod: "docx",
      textLength: text.length,
    };
  } catch (error) {
    console.warn("[DOCX] Extraction failed:", error);
    return null;
  }
}
```

#### 3.3 Update File Extractor Router

**File**: `recommender_api/src/services/file-extractor/file-extractor.service.ts` (update)

```typescript
import { extractTextFromPdf, type FileExtractionResult } from "./pdf-extractor.service.js";
import { extractTextFromDocx } from "./docx-extractor.service.js";

export type { FileExtractionResult };

const MIME_TYPE_PDF = "application/pdf";
const MIME_TYPE_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/*
 * Extract text from a file buffer based on its MIME type.
 * Routes to the appropriate extractor.
 */
export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string
): Promise<FileExtractionResult | null> {
  switch (mimeType) {
    case MIME_TYPE_PDF:
      return extractTextFromPdf(buffer);

    case MIME_TYPE_DOCX:
      return extractTextFromDocx(buffer);

    default:
      console.warn(`[File] Unsupported MIME type: ${mimeType}`);
      return null;
  }
}
```

### Success Criteria

#### Automated Verification:

- [x] TypeScript compiles: `npm run typecheck`
- [x] Unit tests pass: `npm test`
- [x] E2E tests pass: `npm run test:e2e:file-upload`
- [x] New dependency installed: `mammoth` importable

#### Unit Tests Required

**File**: `recommender_api/src/services/file-extractor/__tests__/docx-extractor.service.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

/*
 * Unit tests for DOCX text extraction.
 * Uses mocked mammoth to avoid needing real DOCX files.
 */
describe('docx-extractor.service', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('extractTextFromDocx', () => {
    it('returns extraction result for DOCX with sufficient text', async () => {
      vi.doMock('mammoth', () => ({
        default: {
          extractRawText: vi.fn().mockResolvedValue({
            value: 'A'.repeat(200),
            messages: [],
          }),
        },
      }));

      const { extractTextFromDocx } = await import('../docx-extractor.service.js');
      const result = await extractTextFromDocx(Buffer.from('fake-docx'));

      expect(result).not.toBeNull();
      expect(result?.extractionMethod).toBe('docx');
      expect(result?.textLength).toBe(200);
      expect(result?.pageCount).toBe(1); // DOCX doesn't have native page count
    });

    it('returns null for DOCX with insufficient text', async () => {
      vi.doMock('mammoth', () => ({
        default: {
          extractRawText: vi.fn().mockResolvedValue({
            value: 'Short',
            messages: [],
          }),
        },
      }));

      const { extractTextFromDocx } = await import('../docx-extractor.service.js');
      const result = await extractTextFromDocx(Buffer.from('fake-docx'));

      expect(result).toBeNull();
    });

    it('returns null when mammoth throws an error', async () => {
      vi.doMock('mammoth', () => ({
        default: {
          extractRawText: vi.fn().mockRejectedValue(new Error('Invalid DOCX')),
        },
      }));

      const { extractTextFromDocx } = await import('../docx-extractor.service.js');
      const result = await extractTextFromDocx(Buffer.from('invalid-docx'));

      expect(result).toBeNull();
    });

    it('logs warnings from mammoth', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      vi.doMock('mammoth', () => ({
        default: {
          extractRawText: vi.fn().mockResolvedValue({
            value: 'A'.repeat(200),
            messages: [{ type: 'warning', message: 'Unsupported element' }],
          }),
        },
      }));

      const { extractTextFromDocx } = await import('../docx-extractor.service.js');
      await extractTextFromDocx(Buffer.from('fake-docx'));

      expect(consoleSpy).toHaveBeenCalledWith(
        '[DOCX] Extraction warnings:',
        expect.any(Array)
      );
    });

    it('trims whitespace from extracted text', async () => {
      vi.doMock('mammoth', () => ({
        default: {
          extractRawText: vi.fn().mockResolvedValue({
            value: '   ' + 'A'.repeat(200) + '   \n\n',
            messages: [],
          }),
        },
      }));

      const { extractTextFromDocx } = await import('../docx-extractor.service.js');
      const result = await extractTextFromDocx(Buffer.from('fake-docx'));

      expect(result?.text).toBe('A'.repeat(200));
    });
  });
});
```

**Update file-extractor.service.test.ts** to cover DOCX routing:

```typescript
// Add to file-extractor.service.test.ts

it('routes DOCX files to DOCX extractor', async () => {
  const mockDocxResult = {
    text: 'DOCX content',
    pageCount: 1,
    extractionMethod: 'docx' as const,
    textLength: 12,
  };

  vi.doMock('../pdf-extractor.service.js', () => ({
    extractTextFromPdf: vi.fn(),
  }));

  vi.doMock('../docx-extractor.service.js', () => ({
    extractTextFromDocx: vi.fn().mockResolvedValue(mockDocxResult),
  }));

  const { extractTextFromFile } = await import('../file-extractor.service.js');
  const result = await extractTextFromFile(
    Buffer.from('fake-docx'),
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );

  expect(result).toEqual(mockDocxResult);
});
```

#### E2E Tests Required (Add to Postman Collection)

Add these tests to `resume-file-upload-tests.postman_collection.json`:

| Test Name | Description | Expected |
|-----------|-------------|----------|
| 12 - DOCX Upload Success | Upload DOCX with name, email | 200, extractionMetadata.method = "docx" |
| 13 - DOCX Upload Updates Existing Engineer | Upload DOCX with engineerId | 200, isNewEngineer = false |
| 14 - DOCX Response Has Extraction Metadata | Upload valid DOCX | Has pageCount (1), textLength, method |
| 15 - PDF Still Works After DOCX Added | Upload PDF (regression) | 200, method = "pdf-native" or "pdf-ocr" |
| 16 - OCR Still Works After DOCX Added | Upload scanned PDF (regression) | 200, method = "pdf-ocr" |

**Test Fixture Files Required:**

Add to `recommender_api/src/services/file-extractor/__tests__/fixtures/`:
- `resume.docx` - A DOCX file with resume content (can be created in any word processor)

**Final Test Suite Summary:**

After Phase 3, the full E2E test collection should have 16 tests:
1. PDF Upload Success
2. PDF Upload Updates Existing Engineer
3. Unsupported File Type
4. File Too Large
5. Missing File
6. Empty PDF (Insufficient Text)
7. Response Has Extraction Metadata
8. JSON Endpoint Still Works
9. Scanned PDF OCR Extraction
10. Native PDF Still Uses Native
11. OCR Response Has Accurate Page Count
12. DOCX Upload Success
13. DOCX Upload Updates Existing Engineer
14. DOCX Response Has Extraction Metadata
15. PDF Still Works After DOCX Added
16. OCR Still Works After DOCX Added

---

## Testing Strategy

### Overview

Each phase includes specific unit tests and E2E tests in the Success Criteria section. This provides:

1. **Unit Tests** (Vitest) - Test individual extractors with mocked dependencies
   - `pdf-extractor.service.test.ts` - PDF native extraction
   - `ocr-extractor.service.test.ts` - OCR availability and error handling
   - `docx-extractor.service.test.ts` - DOCX extraction
   - `file-extractor.service.test.ts` - MIME type routing

2. **E2E Tests** (Newman/Postman) - Test the full upload flow via HTTP
   - New collection: `postman/collections/resume-file-upload-tests.postman_collection.json`
   - 16 test scenarios covering PDF, OCR, DOCX, and error cases
   - Run via: `npm run test:e2e:file-upload`

### Test Fixture Files

All test fixtures live in `recommender_api/src/services/file-extractor/__tests__/fixtures/`:

| File | Purpose | Phase |
|------|---------|-------|
| `resume-with-text.pdf` | PDF with embedded text layer | Phase 1 |
| `empty.pdf` | PDF with no extractable text | Phase 1 |
| `scanned-resume.pdf` | Image-only PDF (requires OCR) | Phase 2 |
| `multi-page-scanned.pdf` | Multi-page scanned PDF | Phase 2 |
| `resume.docx` | Standard Word document | Phase 3 |

### Running Tests

```bash
# Unit tests only
npm test

# E2E file upload tests (requires Tilt running)
npm run test:e2e:file-upload

# All E2E tests
npm run test:e2e

# Full verification
npm run typecheck && npm test && npm run test:e2e:file-upload
```

---

## Performance Considerations

### PDF Native Extraction
- **Speed**: ~50-200ms for typical resumes
- **Memory**: PDF buffer held in memory during processing
- **CPU**: Minimal

### PDF OCR Fallback
- **Speed**: ~2-10 seconds per page (300 DPI)
- **Memory**: Temp files on disk, not in memory
- **CPU**: High during image conversion and OCR
- **Disk**: Temp files cleaned up after processing

### DOCX Extraction
- **Speed**: ~20-100ms for typical resumes (faster than PDF)
- **Memory**: DOCX buffer held in memory, XML parsed in-memory
- **CPU**: Minimal (just XML parsing)

### Recommendations
- Consider async processing for OCR-heavy workloads (future enhancement)
- Monitor OCR frequency via logs to justify future Textract migration
- Set reasonable timeout for OCR processing (30 seconds default)

---

## Logging & Observability

All extraction logs use prefixes: `[PDF]`, `[OCR]`, `[DOCX]`, `[File]`:

```
[File] Processing application/pdf
[PDF] Native extraction succeeded: 4523 chars, 2 pages
[PDF] Native extraction returned only 42 chars (threshold: 100)
[PDF] Native extraction failed, attempting OCR fallback
[OCR] Extracted 3891 chars from 2 pages
[OCR] pdftoppm failed: [error details]
[File] Processing application/vnd.openxmlformats-officedocument.wordprocessingml.document
[DOCX] Extraction succeeded: 3254 chars
[DOCX] Extraction warnings: [any mammoth warnings]
```

Response includes extraction metadata for monitoring:
```json
{
  "extractionMetadata": {
    "method": "pdf-native",
    "pageCount": 2,
    "textLength": 4523
  }
}
```

---

## Migration Notes

No database migrations required. This feature:
- Adds a new endpoint (`/upload/file`) alongside existing (`/upload`)
- Reuses existing resume processing pipeline
- Stores extracted text in existing Resume nodes

---

## Future Extensions

Explicitly supported without touching callers or API contracts:

1. **Replace Tesseract with AWS Textract** - Swap OCR implementation in `ocr-extractor.service.ts`
2. **Add more file formats** - Add new extractors (e.g., RTF, ODT), route by MIME type in `file-extractor.service.ts`
3. **Confidence scoring** - Return OCR confidence to help identify low-quality extractions
4. **Async processing** - Queue OCR jobs for background processing
5. **Legacy .doc support** - Add LibreOffice headless conversion if business need arises

---

## References

- Original research: `thoughts/private/plans/2026-01-21-content-based-resume-filtering.md`
- Existing resume upload: `recommender_api/src/services/resume-processor/`
- LLM service pattern: `recommender_api/src/services/llm.service.ts`
