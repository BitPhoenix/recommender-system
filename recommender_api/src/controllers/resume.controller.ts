import type { Request, Response } from "express";
import driver from "../neo4j.js";
import { processResumeUpload } from "../services/resume-processor/resume-upload.service.js";
import { extractTextFromFile } from "../services/file-extractor/file-extractor.service.js";
import {
  ResumeUploadRequestSchema,
  type ResumeUploadRequest,
  type ResumeFileUploadResponse,
} from "../schemas/resume.schema.js";

/*
 * Handle resume upload requests.
 * POST /api/resume/upload
 */
export async function uploadResume(req: Request, res: Response): Promise<void> {
  const session = driver.session();

  try {
    const request = req.body as ResumeUploadRequest;
    const response = await processResumeUpload(session, request);
    res.status(200).json(response);
  } catch (error) {
    console.error("Resume upload error:", error);

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
        message: "Failed to process resume upload",
        details: error instanceof Error ? [{ field: "internal", message: error.message }] : undefined,
      },
    });
  } finally {
    await session.close();
  }
}

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
            "Could not extract text from file. The file may be corrupted, password-protected, " +
            "or contain only images that OCR could not process.",
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
