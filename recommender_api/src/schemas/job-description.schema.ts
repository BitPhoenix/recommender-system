import { z } from "zod";

// ============================================
// JOB DESCRIPTION UPLOAD SCHEMAS
// ============================================

export const JobDescriptionUploadRequestSchema = z.object({
  /*
   * Existing job ID to update (optional).
   * If provided, updates the job's data and relationships.
   * If not provided, creates a new job.
   */
  jobId: z.string().optional(),

  /*
   * Raw job description text for LLM feature extraction.
   * The LLM will extract title, skills, domains, seniority, etc.
   */
  jobDescriptionText: z.string().min(1, "Job description text is required"),
});

export type JobDescriptionUploadRequest = z.infer<typeof JobDescriptionUploadRequestSchema>;

export interface JobDescriptionUploadResponse {
  jobId: string;
  isNewJob: boolean;
  extractedFeatures: {
    title: string;
    companyName: string | null;
    location: string | null;
    seniority: string;
    minBudget: number | null;
    maxBudget: number | null;
    stretchBudget?: number | null;
    startTimeline: string;
    timezone: string[];
    teamFocus?: string | null;
    skills: Array<{
      name: string;
      isRequired: boolean;
      minProficiency?: string;
    }>;
    businessDomains: Array<{
      name: string;
      isRequired: boolean;
      minYears?: number;
    }>;
    technicalDomains: Array<{
      name: string;
      isRequired: boolean;
    }>;
  };
  validationResults: {
    resolvedSkills: Array<{
      extracted: string;
      canonicalId: string | null;
      canonicalName: string | null;
      method: string;
      confidence: number;
      isRequired: boolean;
      minProficiency?: string;
    }>;
    unresolvedSkills: Array<{
      extracted: string;
      isRequired: boolean;
      minProficiency?: string;
    }>;
    resolvedBusinessDomains: Array<{
      extracted: string;
      canonicalId: string | null;
      canonicalName: string | null;
      isRequired: boolean;
      minYears?: number;
    }>;
    unresolvedBusinessDomains: string[];
    resolvedTechnicalDomains: Array<{
      extracted: string;
      canonicalId: string | null;
      canonicalName: string | null;
      isRequired: boolean;
    }>;
    unresolvedTechnicalDomains: string[];
    company?: {
      extracted: string;
      canonicalId: string;
      canonicalName: string;
      method: "exact" | "alias" | "new";
    };
  };
  embedding: {
    dimensions: number;
    model: string;
  } | null;  // null if LLM unavailable
}
