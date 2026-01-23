import mammoth from "mammoth";
import type { FileExtractionResult } from "./pdf-extractor.service.js";

/*
 * Minimum text length to consider a DOCX successfully extracted.
 */
const MIN_TEXT_LENGTH = 100;

/*
 * Extract text from a DOCX buffer using mammoth.
 * Returns the raw text content with paragraphs separated by newlines.
 */
export async function extractTextFromDocx(
  docxBuffer: Buffer
): Promise<FileExtractionResult | null> {
  try {
    const result = await mammoth.extractRawText({ buffer: docxBuffer });
    const text = result.value?.trim() || "";

    if (text.length < MIN_TEXT_LENGTH) {
      console.log(
        `[DOCX] Extraction returned only ${text.length} chars (threshold: ${MIN_TEXT_LENGTH})`
      );
      return null;
    }

    // Log any warnings from mammoth (e.g., unsupported features)
    if (result.messages.length > 0) {
      console.log("[DOCX] Extraction warnings:", result.messages);
    }

    console.log(`[DOCX] Extraction succeeded: ${text.length} chars`);

    return {
      text,
      pageCount: 1, // DOCX doesn't have a native page count concept
      extractionMethod: "docx",
      textLength: text.length,
    };
  } catch (error) {
    console.warn("[DOCX] Extraction failed:", error);
    return null;
  }
}
