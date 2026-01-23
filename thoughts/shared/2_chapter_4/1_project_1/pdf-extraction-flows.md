# PDF Text Extraction: Native vs OCR Flows

When extracting text from PDF files, there are two distinct extraction methods depending on how the PDF was created. Understanding these flows is essential for testing the file upload pipeline.

## The Two PDF Types

### 1. Native Text Layer PDFs (`native-text-layer-doesnt-trigger-ocr.pdf`)

**How they're created:** Generated digitally from word processors, LaTeX, or programmatically (e.g., pdfkit). The text is stored as actual text data in the PDF.

**Extraction method:** `pdf-native`

**What happens:**
1. pdf-parse reads the PDF's internal text stream
2. Text is extracted directly from the embedded text layer
3. Fast (~50-200ms), accurate, preserves formatting

**Example flow:**
```
PDF Buffer → pdf-parse → Text extracted → Resume processing
```

### 2. Scanned/Image-Only PDFs (`scanned-image-only-does-trigger-ocr.pdf`)

**How they're created:** Scanned from physical paper, or created by embedding images without a text layer. The "text" is just pixels in an image.

**Extraction method:** `pdf-ocr`

**What happens:**
1. pdf-parse attempts native extraction → returns insufficient text (<100 chars)
2. System detects this and falls back to OCR pipeline
3. pdftoppm converts PDF pages to PNG images (300 DPI)
4. Tesseract OCR reads text from the images
5. Slower (~2-10 seconds per page), may have OCR errors

**Example flow:**
```
PDF Buffer → pdf-parse → <100 chars → OCR fallback
                                           ↓
                         pdftoppm → PNG images → Tesseract → Text extracted
```

## Why We Need Both Test Files

| Test File | Type | Purpose |
|-----------|------|---------|
| `native-text-layer-doesnt-trigger-ocr.pdf` | Digital PDF with text | Tests the fast path (native extraction) |
| `scanned-image-only-does-trigger-ocr.pdf` | Image-only PDF | Tests the OCR fallback path |

### Testing Coverage

**Native extraction tests verify:**
- pdf-parse correctly extracts embedded text
- Sufficient text (>100 chars) bypasses OCR
- Response includes `method: "pdf-native"`

**OCR fallback tests verify:**
- System detects when native extraction fails
- pdftoppm and Tesseract are properly configured
- OCR can extract readable text from images
- Response includes `method: "pdf-ocr"`

## Detection Logic

The system decides which path to use based on text length:

```typescript
const MIN_TEXT_LENGTH = 100;

// Try native extraction first
const nativeResult = await extractTextFromPdfNative(pdfBuffer);

if (nativeResult && nativeResult.textLength >= MIN_TEXT_LENGTH) {
  // Use native result
  return nativeResult;
}

// Fall back to OCR
return await extractTextWithOcr(pdfBuffer);
```

## File Locations

Test fixtures are stored in `recommender_api/src/services/file-extractor/__tests__/fixtures/`:

| File | Type | Purpose |
|------|------|---------|
| `native-text-layer-doesnt-trigger-ocr.pdf` | Digital PDF with text | Tests native extraction path |
| `scanned-image-only-does-trigger-ocr.pdf` | Image-only PDF | Tests OCR fallback path |
| `empty-pdf-triggers-extraction-failure.pdf` | Empty PDF | Tests extraction failure handling |
| `resume.docx` | Word document | Tests DOCX extraction |
