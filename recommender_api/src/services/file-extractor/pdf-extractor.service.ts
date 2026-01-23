import { PDFParse } from "pdf-parse";
import type { ExtractionMethod } from "../../schemas/resume.schema.js";
import { extractTextWithOcr, isOcrAvailable } from "./ocr-extractor.service.js";

/*
 * Minimum text length to consider a file successfully extracted.
 * Shorter extractions likely indicate a scanned/image-only PDF.
 */
const MIN_TEXT_LENGTH = 100;

export interface FileExtractionResult {
  text: string;
  pageCount: number;
  extractionMethod: ExtractionMethod;
  textLength: number;
}

/*
 * Extract text from a PDF buffer using native text layer extraction.
 * Returns null if the PDF has insufficient text (likely scanned/image-only).
 */
export async function extractTextFromPdfNative(
  pdfBuffer: Buffer
): Promise<FileExtractionResult | null> {
  let parser: PDFParse | null = null;

  try {
    parser = new PDFParse({ data: pdfBuffer });
    const textResult = await parser.getText();
    const text = textResult.text?.trim() || "";

    if (text.length < MIN_TEXT_LENGTH) {
      console.log(
        `[PDF] Native extraction returned only ${text.length} chars (threshold: ${MIN_TEXT_LENGTH})`
      );
      return null;
    }

    const infoResult = await parser.getInfo();
    const pageCount = infoResult.pages?.length || textResult.pages?.length || 1;

    return {
      text,
      pageCount,
      extractionMethod: "pdf-native",
      textLength: text.length,
    };
  } catch (error) {
    console.warn("[PDF] Native extraction failed:", error);
    return null;
  } finally {
    if (parser) {
      await parser.destroy();
    }
  }
}

/*
 * Extract text from a PDF, using native extraction with OCR fallback.
 */
export async function extractTextFromPdf(
  pdfBuffer: Buffer
): Promise<FileExtractionResult | null> {
  // Try native extraction first
  const nativeResult = await extractTextFromPdfNative(pdfBuffer);

  if (nativeResult) {
    console.log(
      `[PDF] Native extraction succeeded: ${nativeResult.textLength} chars, ${nativeResult.pageCount} pages`
    );
    return nativeResult;
  }

  // Fall back to OCR
  console.log("[PDF] Native extraction failed, attempting OCR fallback");

  const ocrAvailable = await isOcrAvailable();
  if (!ocrAvailable) {
    console.warn("[PDF] OCR tools not available (tesseract/pdftoppm)");
    return null;
  }

  const ocrResult = await extractTextWithOcr(pdfBuffer);
  if (!ocrResult) {
    console.warn("[PDF] OCR extraction failed");
    return null;
  }

  if (ocrResult.text.length < MIN_TEXT_LENGTH) {
    console.warn(
      `[PDF] OCR extraction returned only ${ocrResult.text.length} chars (threshold: ${MIN_TEXT_LENGTH})`
    );
    return null;
  }

  return {
    text: ocrResult.text,
    pageCount: ocrResult.pageCount,
    extractionMethod: "pdf-ocr",
    textLength: ocrResult.text.length,
  };
}
