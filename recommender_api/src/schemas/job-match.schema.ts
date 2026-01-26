import { z } from "zod";
import type { JobEngineerMatchSignals } from "../types/job-match.types.js";

export const JobMatchRequestSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export type JobMatchRequest = z.infer<typeof JobMatchRequestSchema>;

export interface JobMatchResponseMatch {
  id: string;
  name: string;
  headline: string;
  salary: number;
  yearsExperience: number;
  timezone: string;
  matchScore: number;
  scoreBreakdown: JobEngineerMatchSignals;
}

export interface JobMatchResponse {
  jobId: string;
  jobTitle: string;
  matches: JobMatchResponseMatch[];
  totalCount: number;
  queryMetadata: {
    executionTimeMs: number;
    candidatesEvaluated: number;
    scoringWeights: Record<string, number>;
  };
}
