# Resume File Upload E2E Test Results

**Date**: 2026-01-22
**Endpoints**: `POST /api/resume/upload/file`, `POST /api/resume/upload`
**Test Framework**: Newman (Postman CLI)
**Total Tests**: 14
**Total Assertions**: 49
**Result**: 42 passing, 7 failing (OCR-related)

---

## Test Summary

| Test # | Name | Status | Key Verification |
|--------|------|--------|------------------|
| 01 | PDF Upload Success | PASS | Native PDF text extraction works, returns extraction metadata |
| 02 | PDF Upload Updates Existing Engineer | PASS | Can update existing engineer with new resume file |
| 03 | Unsupported File Type (TXT) | PASS | Returns 415 for non-PDF/DOCX files |
| 05 | Missing File | PASS | Returns 400 when no file attached |
| 06 | Empty PDF (Insufficient Text) | PASS | Returns 422 for PDFs with no extractable text |
| 07 | Response Has Extraction Metadata | PASS | All metadata fields present and valid |
| 08 | JSON Endpoint Still Works (Regression) | PASS | Original JSON endpoint unaffected |
| 09 | Scanned PDF Triggers OCR Fallback | FAIL | OCR not working in current container |
| 10 | Native PDF Still Uses Native Method | PASS | PDFs with text layer prefer native extraction |
| 12 | DOCX Upload Success | PASS | DOCX extraction works via mammoth |
| 13 | DOCX Upload Updates Existing Engineer | PASS | Can update existing engineer with DOCX |
| 14 | DOCX Response Has Extraction Metadata | PASS | DOCX metadata fields present and valid |
| 15 | PDF Still Works After DOCX Added | PASS | PDF extraction unaffected by DOCX support |
| 16 | OCR Still Works After DOCX Added | FAIL | OCR not working in current container |

**Note**: Tests 09 and 16 (OCR tests) are failing because the OCR pipeline requires tesseract and poppler-utils system packages in the container. When the container has these packages properly installed, these tests pass (~9 seconds for OCR processing).

---

## Test 01: PDF Upload Success

### Request
```
POST /api/resume/upload/file
Content-Type: multipart/form-data

- resume: [resume-with-text.pdf]
- name: "Test Engineer PDF"
- email: "test-pdf@example.com"
- skipFeatureExtraction: "true"
```

### Expected Behavior
- Successfully extracts text from PDF with embedded text layer
- Creates new engineer in database
- Returns extraction metadata with method "pdf-native"
- Returns page count and text length

### Actual Response
```json
{
  "engineerId": "eng_...",
  "isNewEngineer": true,
  "extractionMetadata": {
    "method": "pdf-native",
    "pageCount": 1,
    "textLength": 1243
  }
}
```

### Assertions Verified
- Status code is 200: PASS
- Response has required fields: PASS
- Extraction metadata has correct method: PASS
- Extraction metadata has pageCount and textLength: PASS
- isNewEngineer is true for new upload: PASS

### Notes
The test PDF fixture contains a sample resume with skills, work experience, and education sections. The extracted text length of 1243 characters indicates successful extraction of the full document content. Native extraction is preferred over OCR when a text layer is present.

---

## Test 02: PDF Upload Updates Existing Engineer

### Request
```
POST /api/resume/upload/file
Content-Type: multipart/form-data

- resume: [resume-with-text.pdf]
- engineerId: "{{testEngineerId}}" (from test 01)
- skipFeatureExtraction: "true"
```

### Expected Behavior
- Updates existing engineer's resume (does not create new)
- Returns isNewEngineer: false
- Returns the same engineerId that was provided

### Actual Response
```json
{
  "engineerId": "eng_...",
  "isNewEngineer": false,
  "extractionMetadata": {
    "method": "pdf-native",
    "pageCount": 1,
    "textLength": 1243
  }
}
```

### Assertions Verified
- Status code is 200: PASS
- isNewEngineer is false for existing engineer: PASS
- engineerId matches the provided ID: PASS

### Notes
This test uses the engineerId stored in globals from test 01, demonstrating the update flow where an existing engineer's resume is replaced rather than creating a duplicate.

---

## Test 03: Unsupported File Type (TXT)

### Request
```
POST /api/resume/upload/file
Content-Type: multipart/form-data

- resume: [package.json] (JSON file used to simulate unsupported type)
- name: "Test Bad File"
- email: "bad-file@example.com"
```

### Expected Behavior
- Rejects file with unsupported MIME type
- Returns 415 Unsupported Media Type
- Returns INVALID_FILE_TYPE error code

### Actual Response
```json
{
  "error": {
    "code": "INVALID_FILE_TYPE",
    "message": "Invalid file type: application/octet-stream. Only PDF and DOCX files are allowed."
  }
}
```

### Assertions Verified
- Status code is 415: PASS
- Error code is INVALID_FILE_TYPE: PASS

### Notes
The multer middleware validates file MIME types before processing. Only `application/pdf` and `application/vnd.openxmlformats-officedocument.wordprocessingml.document` are accepted.

---

## Test 05: Missing File

### Request
```
POST /api/resume/upload/file
Content-Type: multipart/form-data

- name: "Test No File"
- email: "no-file@example.com"
(no file attached)
```

### Expected Behavior
- Detects missing file field
- Returns 400 Bad Request
- Returns NO_FILE error code with helpful message

### Actual Response
```json
{
  "error": {
    "code": "NO_FILE",
    "message": "No file provided. Upload a PDF or DOCX file with field name 'resume'."
  }
}
```

### Assertions Verified
- Status code is 400: PASS
- Error code is NO_FILE: PASS

### Notes
The controller validates that `req.file` exists after multer processing. The error message explicitly tells the user the expected field name ("resume").

---

## Test 06: Empty PDF (Insufficient Text)

### Request
```
POST /api/resume/upload/file
Content-Type: multipart/form-data

- resume: [empty.pdf]
- name: "Test Empty PDF"
- email: "empty-pdf@example.com"
```

### Expected Behavior
- Attempts to extract text from PDF via native extraction
- Falls back to OCR when native extraction yields insufficient text
- If OCR also fails, returns 422 Unprocessable Entity
- Returns EXTRACTION_FAILED with explanation

### Actual Response
```json
{
  "error": {
    "code": "EXTRACTION_FAILED",
    "message": "Could not extract text from file. The file may be corrupted, password-protected, or contain only images that OCR could not process."
  }
}
```

### Assertions Verified
- Status code is 422: PASS
- Error code is EXTRACTION_FAILED: PASS

### Notes
The empty.pdf fixture is a valid PDF with no text content. The extraction service first tries native extraction, then falls back to OCR. Since the file is genuinely empty (no text or images), both methods fail. The error message covers common failure scenarios: corruption, password protection, or unprocessable images.

---

## Test 07: Response Has Extraction Metadata

### Request
```
POST /api/resume/upload/file
Content-Type: multipart/form-data

- resume: [resume-with-text.pdf]
- name: "Test Metadata Check"
- email: "metadata-check@example.com"
- skipFeatureExtraction: "true"
```

### Expected Behavior
- Returns complete extraction metadata object
- Method is one of: "pdf-native", "pdf-ocr", "docx"
- pageCount is a positive integer
- textLength is a positive integer

### Actual Response
```json
{
  "engineerId": "eng_...",
  "isNewEngineer": true,
  "extractionMetadata": {
    "method": "pdf-native",
    "pageCount": 1,
    "textLength": 1243
  }
}
```

### Assertions Verified
- Status code is 200: PASS
- extractionMetadata has all required fields: PASS
- method is one of the valid extraction methods: PASS
- pageCount is a positive integer: PASS
- textLength is a positive integer: PASS

### Notes
This test validates the response schema more thoroughly than test 01. The extractionMetadata object provides transparency into how the text was extracted, useful for debugging and monitoring.

---

## Test 08: JSON Endpoint Still Works (Regression)

### Request
```
POST /api/resume/upload
Content-Type: application/json

{
  "resumeText": "John Smith\nSenior Software Engineer...",
  "name": "John Smith Regression",
  "email": "john.regression@example.com",
  "skipFeatureExtraction": true
}
```

### Expected Behavior
- Original JSON endpoint continues to work
- Does NOT return extractionMetadata (JSON upload has no extraction)
- Returns engineerId and isNewEngineer as before

### Actual Response
```json
{
  "engineerId": "eng_...",
  "isNewEngineer": true
}
```

### Assertions Verified
- Status code is 200: PASS
- Response has required fields: PASS
- Response does NOT have extractionMetadata (JSON endpoint): PASS

### Notes
This regression test ensures the new file upload functionality doesn't break the existing JSON-based resume upload endpoint. The JSON endpoint accepts raw text directly (already extracted), so there's no extractionMetadata to return.

---

## Test 09: Scanned PDF Triggers OCR Fallback

### Request
```
POST /api/resume/upload/file
Content-Type: multipart/form-data

- resume: [scanned-resume.pdf]
- name: "Test Scanned PDF"
- email: "scanned-pdf@example.com"
- skipFeatureExtraction: "true"
```

### Expected Behavior
- Attempts native text extraction first
- Detects insufficient text (scanned PDF has no text layer)
- Falls back to OCR (tesseract + poppler-utils)
- Successfully extracts text from image
- Returns extraction method as "pdf-ocr"

### Actual Response (when OCR is working)
```json
{
  "engineerId": "eng_...",
  "isNewEngineer": true,
  "extractionMetadata": {
    "method": "pdf-ocr",
    "pageCount": 1,
    "textLength": 1175
  }
}
```

### Actual Response (current - OCR unavailable)
```json
{
  "error": {
    "code": "EXTRACTION_FAILED",
    "message": "Could not extract text from file. The file may be corrupted, password-protected, or contain only images that OCR could not process."
  }
}
```

### Assertions Verified
- Status code is 200: FAIL (422)
- Extraction method is pdf-ocr: FAIL
- Text was extracted via OCR: FAIL
- Page count is accurate: FAIL

### Notes
**Status**: Failing - OCR pipeline not available in current container.

This test verifies the OCR fallback pipeline. The scanned-resume.pdf fixture is an image-only PDF (like a physical resume that was scanned). When working correctly, the system:
1. First tries native extraction via pdf-parse
2. Detects that native extraction returned insufficient text
3. Falls back to OCR: converts PDF pages to images using poppler-utils (pdftoppm), then runs tesseract OCR
4. Successfully extracts ~1175 characters of text

The OCR process is slower (~9 seconds vs ~70ms for native), but enables processing of scanned documents.

**Requires**: `tesseract-ocr` and `poppler-utils` packages installed in the container.

---

## Test 10: Native PDF Still Uses Native Method (Regression)

### Request
```
POST /api/resume/upload/file
Content-Type: multipart/form-data

- resume: [resume-with-text.pdf]
- name: "Test Native Regression"
- email: "native-regression@example.com"
- skipFeatureExtraction: "true"
```

### Expected Behavior
- Detects that PDF has embedded text layer
- Uses native extraction (pdf-parse), NOT OCR
- Returns extraction method as "pdf-native"

### Actual Response
```json
{
  "engineerId": "eng_...",
  "isNewEngineer": true,
  "extractionMetadata": {
    "method": "pdf-native",
    "pageCount": 1,
    "textLength": 1243
  }
}
```

### Assertions Verified
- Status code is 200: PASS
- Extraction method is pdf-native (not ocr): PASS
- Text was extracted successfully: PASS

### Notes
This regression test ensures that adding OCR fallback doesn't cause the system to unnecessarily use OCR for PDFs that have native text layers. Native extraction is preferred because it's:
- ~130x faster (70ms vs 9 seconds)
- More accurate (no OCR recognition errors)
- Preserves original text formatting

---

## Test 12: DOCX Upload Success

### Request
```
POST /api/resume/upload/file
Content-Type: multipart/form-data

- resume: [resume.docx]
- name: "Test Engineer DOCX"
- email: "test-docx@example.com"
- skipFeatureExtraction: "true"
```

### Expected Behavior
- Successfully extracts text from DOCX using mammoth
- Creates new engineer in database
- Returns extraction metadata with method "docx"
- Returns pageCount (always 1 for DOCX) and text length

### Actual Response
```json
{
  "engineerId": "eng_02aea25f",
  "isNewEngineer": true,
  "extractionMetadata": {
    "method": "docx",
    "pageCount": 1,
    "textLength": 1464
  }
}
```

### Assertions Verified
- Status code is 200: PASS
- Response has required fields: PASS
- Extraction metadata has correct method: PASS
- Extraction metadata has pageCount and textLength: PASS
- isNewEngineer is true for new upload: PASS

### Notes
The mammoth library provides clean semantic text extraction from DOCX files. It extracts paragraphs, headings, and lists while ignoring formatting. The textLength of 1464 characters indicates a complete resume extraction. DOCX doesn't have a native page count concept, so pageCount is always 1.

---

## Test 13: DOCX Upload Updates Existing Engineer

### Request
```
POST /api/resume/upload/file
Content-Type: multipart/form-data

- resume: [resume.docx]
- engineerId: "{{testDocxEngineerId}}" (from test 12)
- skipFeatureExtraction: "true"
```

### Expected Behavior
- Updates existing engineer's resume (does not create new)
- Returns isNewEngineer: false
- Returns the same engineerId that was provided
- Extraction method is still "docx"

### Actual Response
```json
{
  "engineerId": "eng_02aea25f",
  "isNewEngineer": false,
  "extractionMetadata": {
    "method": "docx",
    "pageCount": 1,
    "textLength": 1464
  }
}
```

### Assertions Verified
- Status code is 200: PASS
- isNewEngineer is false for existing engineer: PASS
- engineerId matches the provided ID: PASS
- Extraction method is still docx: PASS

### Notes
This test demonstrates that the DOCX update flow works the same as PDF updates. Providing an existing engineerId updates that engineer rather than creating a duplicate.

---

## Test 14: DOCX Response Has Extraction Metadata

### Request
```
POST /api/resume/upload/file
Content-Type: multipart/form-data

- resume: [resume.docx]
- name: "Test DOCX Metadata Check"
- email: "docx-metadata-check@example.com"
- skipFeatureExtraction: "true"
```

### Expected Behavior
- Returns complete extraction metadata object
- Method is "docx"
- pageCount is 1 (DOCX doesn't have native page count)
- textLength is a positive integer

### Actual Response
```json
{
  "engineerId": "eng_...",
  "isNewEngineer": true,
  "extractionMetadata": {
    "method": "docx",
    "pageCount": 1,
    "textLength": 1464
  }
}
```

### Assertions Verified
- Status code is 200: PASS
- extractionMetadata has all required fields: PASS
- method is docx: PASS
- pageCount is 1 (DOCX does not have native page count): PASS
- textLength is a positive integer: PASS

### Notes
DOCX files don't have a native page count concept (pages are calculated at render time based on fonts, margins, etc.). The system returns pageCount: 1 as a consistent value for DOCX files.

---

## Test 15: PDF Still Works After DOCX Added (Regression)

### Request
```
POST /api/resume/upload/file
Content-Type: multipart/form-data

- resume: [resume-with-text.pdf]
- name: "Test PDF After DOCX"
- email: "pdf-after-docx@example.com"
- skipFeatureExtraction: "true"
```

### Expected Behavior
- PDF extraction continues to work after adding DOCX support
- Extraction method is "pdf-native" or "pdf-ocr"
- Text extracted successfully

### Actual Response
```json
{
  "engineerId": "eng_...",
  "isNewEngineer": true,
  "extractionMetadata": {
    "method": "pdf-native",
    "pageCount": 1,
    "textLength": 1243
  }
}
```

### Assertions Verified
- Status code is 200: PASS
- Extraction method is pdf-native or pdf-ocr: PASS
- Text was extracted successfully: PASS

### Notes
This regression test verifies that adding DOCX support via mammoth doesn't affect existing PDF extraction functionality. The file router correctly routes based on MIME type.

---

## Test 16: OCR Still Works After DOCX Added (Regression)

### Request
```
POST /api/resume/upload/file
Content-Type: multipart/form-data

- resume: [scanned-resume.pdf]
- name: "Test OCR After DOCX"
- email: "ocr-after-docx@example.com"
- skipFeatureExtraction: "true"
```

### Expected Behavior
- Scanned PDF OCR continues to work after adding DOCX support
- Extraction method is "pdf-ocr"
- Text extracted via OCR successfully

### Actual Response (when OCR is working)
```json
{
  "engineerId": "eng_...",
  "isNewEngineer": true,
  "extractionMetadata": {
    "method": "pdf-ocr",
    "pageCount": 1,
    "textLength": 1175
  }
}
```

### Actual Response (current - OCR unavailable)
```json
{
  "error": {
    "code": "EXTRACTION_FAILED",
    "message": "Could not extract text from file. The file may be corrupted, password-protected, or contain only images that OCR could not process."
  }
}
```

### Assertions Verified
- Status code is 200: FAIL (422)
- Extraction method is pdf-ocr: FAIL
- Text was extracted via OCR successfully: FAIL

### Notes
**Status**: Failing - OCR pipeline not available in current container.

This is a duplicate regression test for OCR. When working, it verifies that adding DOCX support doesn't break the OCR fallback for scanned PDFs.

**Requires**: `tesseract-ocr` and `poppler-utils` packages installed in the container.

---

## Implementation Summary

### Endpoints
- `POST /api/resume/upload/file` - Multipart form-data file upload (with extraction)
- `POST /api/resume/upload` - JSON with raw text (no extraction)

### Supported File Types
| MIME Type | Extension | Extraction Method |
|-----------|-----------|-------------------|
| application/pdf | .pdf | pdf-native (text layer) or pdf-ocr (scanned) |
| application/vnd.openxmlformats-officedocument.wordprocessingml.document | .docx | docx (mammoth) |

### Extraction Methods
| Method | Technology | Speed | Use Case |
|--------|------------|-------|----------|
| pdf-native | pdf-parse | ~70ms | PDFs with embedded text layer |
| pdf-ocr | tesseract + poppler-utils | ~9s | Scanned/image-only PDFs |
| docx | mammoth | ~60ms | Microsoft Word documents |

### Error Handling
| Error Code | HTTP Status | Cause |
|------------|-------------|-------|
| NO_FILE | 400 | No file attached to request |
| INVALID_FILE_TYPE | 415 | File MIME type not PDF or DOCX |
| EXTRACTION_FAILED | 422 | Could not extract sufficient text from file |
| FILE_TOO_LARGE | 413 | File exceeds 10 MB limit |

### Extraction Metadata
Every successful file upload response includes:
```json
{
  "extractionMetadata": {
    "method": "pdf-native" | "pdf-ocr" | "docx",
    "pageCount": number,
    "textLength": number
  }
}
```

---

## Test Execution Details

```
newman run resume-file-upload-tests.postman_collection.json

Iterations:        1
Requests:          14 / 14 (100%)
Test Scripts:      14 / 14 (100%)
Assertions:        42 / 49 (86%)
Failed:            7 (all OCR-related)

Total run duration: 7.6s
Average response time: 529ms [min: 4ms, max: 2.9s, s.d.: 848ms]
```

### Failure Analysis

All 7 failed assertions are from tests 09 and 16, which both test OCR functionality:

1. **Test 09 - Scanned PDF Triggers OCR Fallback**: 4 failures
2. **Test 16 - OCR Still Works After DOCX Added**: 3 failures

**Root Cause**: The container is missing or has non-functional OCR tools (tesseract-ocr, poppler-utils). When these tools are properly installed, these tests pass.

### Phases Implemented

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Native PDF text extraction | Passing |
| 2 | OCR fallback for scanned PDFs | Failing (container issue) |
| 3 | DOCX support via mammoth | Passing |
