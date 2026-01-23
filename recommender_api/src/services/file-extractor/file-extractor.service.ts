import { extractTextFromPdf, type FileExtractionResult } from "./pdf-extractor.service.js";
import { extractTextFromDocx } from "./docx-extractor.service.js";

export type { FileExtractionResult };

const MIME_TYPE_PDF = "application/pdf";
const MIME_TYPE_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/*
 * Extract text from a file buffer based on its MIME type.
 * Routes to the appropriate extractor.
 */
export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string
): Promise<FileExtractionResult | null> {
  switch (mimeType) {
    case MIME_TYPE_PDF:
      return extractTextFromPdf(buffer);

    case MIME_TYPE_DOCX:
      return extractTextFromDocx(buffer);

    default:
      console.warn(`[File] Unsupported MIME type: ${mimeType}`);
      return null;
  }
}
