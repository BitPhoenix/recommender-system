import type { Request, Response } from "express";
import driver from "../neo4j.js";
import {
  processJobDescriptionUpload,
  ExtractionFailedError,
} from "../services/job-description-processor/job-upload.service.js";
import type {
  JobDescriptionUploadRequest,
  JobDescriptionUploadResponse,
} from "../schemas/job-description.schema.js";

/*
 * Handle job description upload requests.
 * POST /api/job-description/upload
 */
export async function uploadJobDescription(req: Request, res: Response): Promise<void> {
  const session = driver.session();

  try {
    const request = req.body as JobDescriptionUploadRequest;

    const result = await processJobDescriptionUpload(
      session,
      request.jobDescriptionText,
      request.jobId
    );

    const response: JobDescriptionUploadResponse = {
      jobId: result.jobId,
      isNewJob: result.isNewJob,
      extractedFeatures: result.extractedFeatures,
      validationResults: result.validationResults,
      embedding: result.embedding,
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Job description upload error:", error);

    // Handle extraction failure (LLM unavailable)
    if (error instanceof ExtractionFailedError) {
      res.status(422).json({
        error: {
          code: "EXTRACTION_FAILED",
          message: error.message,
        },
      });
      return;
    }

    // Handle "job not found" error for update operations
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
        code: "JOB_UPLOAD_ERROR",
        message: "Failed to process job description upload",
        details: error instanceof Error ? [{ field: "internal", message: error.message }] : undefined,
      },
    });
  } finally {
    await session.close();
  }
}
