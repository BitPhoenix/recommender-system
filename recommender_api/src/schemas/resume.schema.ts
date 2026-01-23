/*
 * Resume Upload and Content Search API Schemas
 */

import { z } from "zod";

// ============================================
// RESUME UPLOAD SCHEMAS
// ============================================

export const GenerateVectorsSchema = z.enum(["tfidf", "embedding"]);

export const ResumeUploadRequestSchema = z.object({
  /*
   * Raw resume text (plain text or extracted from PDF/DOCX).
   * Required if no engineerId is provided (new engineer).
   * Optional if engineerId is provided and only updating vectors.
   */
  resumeText: z.string().optional(),

  /*
   * Existing engineer ID to update (optional).
   * If provided, updates the engineer's profile.
   * If not provided, creates a new engineer.
   */
  engineerId: z.string().optional(),

  /*
   * Name of the engineer (required for new engineers).
   */
  name: z.string().optional(),

  /*
   * Email of the engineer (required for new engineers).
   */
  email: z.string().email().optional(),

  /*
   * Which vector representations to generate.
   * - "tfidf": Build/update TF-IDF index
   * - "embedding": Generate dense embedding (future)
   */
  generateVectors: z.array(GenerateVectorsSchema).optional(),

  /*
   * Skip LLM feature extraction (for testing).
   * If true, only stores resume and generates vectors.
   */
  skipFeatureExtraction: z.boolean().optional(),
}).refine(
  (data) => data.engineerId || (data.name && data.email),
  { message: "Either engineerId (for update) or both name and email (for create) must be provided" }
).refine(
  (data) => data.engineerId || data.resumeText,
  { message: "resumeText is required when creating a new engineer" }
);

export type ResumeUploadRequest = z.infer<typeof ResumeUploadRequestSchema>;

export interface ResumeUploadValidationResults {
  resolvedSkills: Array<{
    extracted: string;
    canonicalId: string | null;
    canonicalName: string | null;
    method: string;
    confidence: number;
  }>;
  unresolvedSkills: string[];
  resolvedBusinessDomains: Array<{
    extracted: string;
    canonicalId: string | null;
    canonicalName: string | null;
  }>;
  unresolvedBusinessDomains: string[];
  resolvedTechnicalDomains: Array<{
    extracted: string;
    canonicalId: string | null;
    canonicalName: string | null;
  }>;
  unresolvedTechnicalDomains: string[];
}

export interface ResumeUploadResponse {
  engineerId: string;
  isNewEngineer: boolean;
  extractedFeatures?: import("../services/resume-processor/feature-extractor.service.js").ExtractedProfile;
  validationResults?: ResumeUploadValidationResults;
  vectors?: {
    tfidf?: {
      termCount: number;
      nonZeroTerms: number;
    };
    embedding?: {
      dimensions: number;
    };
  };
}

// ============================================
// FILE UPLOAD SCHEMAS
// ============================================

/*
 * Extraction method used to get text from uploaded file.
 */
export const ExtractionMethodSchema = z.enum(["pdf-native", "pdf-ocr", "docx"]);
export type ExtractionMethod = z.infer<typeof ExtractionMethodSchema>;

/*
 * Extended response for file uploads includes extraction metadata.
 * Uses the same base response as JSON uploads.
 */
export interface ResumeFileUploadResponse extends ResumeUploadResponse {
  extractionMetadata: {
    method: ExtractionMethod;
    pageCount: number;
    textLength: number;
  };
}

// ============================================
// CONTENT SEARCH SCHEMAS
// ============================================

export const ContentSearchMethodSchema = z.enum(["tfidf", "embedding", "hybrid"]);

export const ContentSearchRequestSchema = z.object({
  /*
   * Free-text query for keyword matching.
   * Required unless similarToEngineerId is provided.
   */
  queryText: z.string().optional(),

  /*
   * Find engineers similar to this engineer ID.
   * If provided, queryText is ignored.
   */
  similarToEngineerId: z.string().optional(),

  /*
   * Search method to use.
   * - "tfidf": Keyword-based TF-IDF similarity (default)
   * - "embedding": Dense embedding semantic similarity
   * - "hybrid": Boolean filter → Embedding ranking → TF-IDF explainability
   */
  method: ContentSearchMethodSchema.default("tfidf"),

  /*
   * Required terms for boolean filtering (hybrid search only).
   *
   * When provided, only engineers whose profiles contain ALL of these terms
   * are considered as candidates for embedding ranking. This guarantees that
   * results contain specific keywords before semantic ranking is applied.
   *
   * Terms are normalized using the same pipeline as document indexing
   * (lowercase, compound normalization, phrase replacement).
   *
   * Example: ["react", "kafka"] → Only engineers with both "react" AND "kafka"
   */
  requiredTerms: z.array(z.string()).optional(),

  /*
   * Pagination
   */
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
}).refine(
  (data) => data.queryText || data.similarToEngineerId,
  { message: "Either queryText or similarToEngineerId must be provided" }
);

export type ContentSearchRequest = z.infer<typeof ContentSearchRequestSchema>;

export interface ContentSearchMatch {
  id: string;
  name: string;
  headline: string;
  salary: number;
  yearsExperience: number;
  timezone: string;
  contentScore: number;
  contentScoreBreakdown: {
    tfidfScore?: number;
    tfidfMatchingTerms?: string[];
    /** Profile-level dense embedding similarity (0-1) */
    profileEmbeddingScore?: number;
    /** Skill embedding centroid similarity (0-1) using all skills */
    skillEmbeddingSimilarity?: number;
    /** Skill embedding centroid similarity (0-1) using only skills from last 3 years */
    recentSkillEmbeddingSimilarity?: number;
    /** Number of skills included in skillEmbeddingSimilarity calculation */
    skillCount?: number;
    /** Number of skills included in recentSkillEmbeddingSimilarity calculation */
    recentSkillCount?: number;
  };
}

export interface ContentSearchResponse {
  matches: ContentSearchMatch[];
  totalCount: number;
  searchMethod: "tfidf" | "embedding" | "hybrid";
  queryMetadata: {
    executionTimeMs: number;
    documentsSearched: number;
    queryTerms?: string[];
    /*
     * For hybrid search: the required terms that were used for boolean filtering.
     * Only engineers containing ALL these terms were considered for ranking.
     */
    requiredTerms?: string[];
    /*
     * For hybrid search: number of candidates after boolean filtering.
     * Shows how many engineers passed the keyword filter before embedding ranking.
     */
    candidatesAfterBooleanFilter?: number;
  };
}
