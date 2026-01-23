import type { Request, Response } from "express";
import driver from "../neo4j.js";
import { executeContentSearch } from "../services/content-search/content-search.service.js";
import type { ContentSearchRequest } from "../schemas/resume.schema.js";

/*
 * Handle content-based search requests.
 * POST /api/search/content
 */
export async function contentSearch(req: Request, res: Response): Promise<void> {
  const session = driver.session();

  try {
    const request = req.body as ContentSearchRequest;
    const response = await executeContentSearch(session, request);
    res.status(200).json(response);
  } catch (error) {
    console.error("Content search error:", error);

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
        code: "CONTENT_SEARCH_ERROR",
        message: "Failed to execute content search",
        details: error instanceof Error ? [{ field: "internal", message: error.message }] : undefined,
      },
    });
  } finally {
    await session.close();
  }
}
