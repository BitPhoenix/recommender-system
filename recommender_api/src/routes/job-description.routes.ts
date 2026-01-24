import { Router } from "express";
import { uploadJobDescription } from "../controllers/job-description.controller.js";
import { validate } from "../middleware/zod-validate.middleware.js";
import { JobDescriptionUploadRequestSchema } from "../schemas/job-description.schema.js";

const router = Router();

/*
 * POST /api/job-description/upload
 * Upload job description as text for LLM feature extraction.
 */
router.post("/upload", validate(JobDescriptionUploadRequestSchema), uploadJobDescription);

export default router;
