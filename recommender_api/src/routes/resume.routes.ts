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
