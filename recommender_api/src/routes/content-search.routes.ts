import { Router } from "express";
import { contentSearch } from "../controllers/content-search.controller.js";
import { validate } from "../middleware/zod-validate.middleware.js";
import { ContentSearchRequestSchema } from "../schemas/resume.schema.js";

const router = Router();

/**
 * POST /api/search/content
 * Search engineers using content-based similarity (TF-IDF, embeddings, or hybrid).
 *
 * Implements Chapter 4: Content-Based Filtering
 */
router.post("/content", validate(ContentSearchRequestSchema), contentSearch);

export default router;
