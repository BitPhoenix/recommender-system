import { Router } from "express";
import { getJobMatches } from "../controllers/job-match.controller.js";
import { validateQuery } from "../middleware/zod-validate.middleware.js";
import { JobMatchRequestSchema } from "../schemas/job-match.schema.js";

const router = Router();

/*
 * GET /api/job/:jobId/matches
 * Find engineers matching a job.
 * Returns ranked list with multi-signal scoring and explainability.
 */
router.get("/:jobId/matches", validateQuery(JobMatchRequestSchema), getJobMatches);

export default router;
