import { Request, Response } from "express";
import driver from "../neo4j.js";
import { findEngineersForJob } from "../services/job-match/job-match.service.js";
import type { JobMatchRequest } from "../schemas/job-match.schema.js";

export async function getJobMatches(req: Request, res: Response): Promise<void> {
  const session = driver.session();

  try {
    const jobId = req.params.jobId;
    const query = res.locals.query as JobMatchRequest;

    const result = await findEngineersForJob(session, {
      jobId,
      limit: query.limit,
      offset: query.offset,
    });

    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("not found")) {
      res.status(404).json({
        error: "NOT_FOUND",
        message: `Job not found: ${req.params.jobId}`,
      });
      return;
    }

    if (message.includes("no embedding")) {
      res.status(422).json({
        error: "UNPROCESSABLE_ENTITY",
        message: "Job has no embedding. Re-upload to generate embedding.",
      });
      return;
    }

    console.error("Job match error:", error);
    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Failed to find matching engineers",
    });
  } finally {
    await session.close();
  }
}
