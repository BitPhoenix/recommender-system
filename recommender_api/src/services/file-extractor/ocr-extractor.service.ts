import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

export interface OcrExtractionResult {
  text: string;
  pageCount: number;
}

/*
 * Convert PDF to images and run OCR using Tesseract.
 *
 * Pipeline:
 * 1. Write PDF buffer to temp file
 * 2. Convert PDF pages to PNG images using pdftoppm
 * 3. Run Tesseract OCR on each image
 * 4. Concatenate results
 * 5. Clean up temp files
 */
export async function extractTextWithOcr(
  pdfBuffer: Buffer
): Promise<OcrExtractionResult | null> {
  /*
   * fs.mkdtemp() is safe for concurrent requests:
   * - Creates a unique directory by appending 6 random characters to the prefix
   * - Example: "ocr-" becomes "ocr-abc123" or "ocr-xyz789"
   * - Each concurrent call gets a completely different directory
   * - Node.js's mkdtemp uses cryptographically random characters
   *
   * So if two resumes are uploaded simultaneously:
   * - Request 1 → /tmp/ocr-a3f8k2/input.pdf
   * - Request 2 → /tmp/ocr-x9m1n4/input.pdf
   *
   * They're isolated by the unique directory, not the filename.
   */
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ocr-"));

  try {
    // Step 1: Write PDF to temp file
    const pdfPath = path.join(tempDir, "input.pdf");
    await fs.writeFile(pdfPath, pdfBuffer);

    // Step 2: Convert PDF to PNG images
    const imagePrefix = path.join(tempDir, "page");
    try {
      await execFileAsync("pdftoppm", [
        "-png",
        "-r", "300", // 300 DPI for better OCR accuracy
        pdfPath,
        imagePrefix,
      ]);
    } catch (error) {
      console.warn("[OCR] pdftoppm failed:", error);
      return null;
    }

    // Step 3: Find generated image files
    const files = await fs.readdir(tempDir);
    const imageFiles = files
      .filter((f) => f.startsWith("page") && f.endsWith(".png"))
      .sort(); // Ensure page order

    if (imageFiles.length === 0) {
      console.warn("[OCR] No images generated from PDF");
      return null;
    }

    // Step 4: Run Tesseract on each image
    const textParts: string[] = [];

    for (const imageFile of imageFiles) {
      const imagePath = path.join(tempDir, imageFile);
      const outputBase = imagePath.replace(".png", "");

      try {
        await execFileAsync("tesseract", [
          imagePath,
          outputBase,
          "-l", "eng",
          "--psm", "3", // Fully automatic page segmentation
        ]);

        const textPath = `${outputBase}.txt`;
        const pageText = await fs.readFile(textPath, "utf8");
        textParts.push(pageText);
      } catch (error) {
        console.warn(`[OCR] Tesseract failed on ${imageFile}:`, error);
        // Continue with other pages
      }
    }

    if (textParts.length === 0) {
      console.warn("[OCR] No text extracted from any page");
      return null;
    }

    const fullText = textParts.join("\n\n").trim();

    console.log(
      `[OCR] Extracted ${fullText.length} chars from ${imageFiles.length} pages`
    );

    return {
      text: fullText,
      pageCount: imageFiles.length,
    };
  } finally {
    // Step 5: Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn("[OCR] Failed to clean up temp directory:", cleanupError);
    }
  }
}

/*
 * Check if OCR tools are available in the environment.
 */
export async function isOcrAvailable(): Promise<boolean> {
  try {
    await execFileAsync("tesseract", ["--version"]);
    await execFileAsync("pdftoppm", ["-v"]);
    return true;
  } catch {
    return false;
  }
}
