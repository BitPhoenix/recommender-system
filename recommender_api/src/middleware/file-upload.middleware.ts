import multer from "multer";

/*
 * Maximum file size for resume uploads (10 MB).
 * Engineering resumes rarely exceed 2-3 MB, but we allow some headroom.
 */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/*
 * Allowed MIME types for resume uploads.
 * PDF and DOCX are supported; legacy .doc (application/msword) is not.
 */
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
];

/*
 * Multer configuration for resume file uploads.
 * Uses memory storage (buffer) since we process and discard the file.
 */
export const resumeFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only PDF and DOCX files are allowed.`));
    }
  },
});
