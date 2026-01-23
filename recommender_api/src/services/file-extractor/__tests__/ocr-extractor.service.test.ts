import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/*
 * Unit tests for OCR extraction.
 * Mocks system calls to tesseract and pdftoppm.
 *
 * Note: Full integration testing is done via E2E tests with real scanned PDFs.
 * These unit tests verify error handling and availability checking.
 */
describe('ocr-extractor.service', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isOcrAvailable', () => {
    it('returns true when tesseract and pdftoppm are available', async () => {
      vi.doMock('child_process', () => ({
        execFile: vi.fn((_cmd: string, _args: string[], cb: (err: Error | null, stdout: string, stderr: string) => void) => {
          cb(null, 'version info', '');
        }),
      }));

      const { isOcrAvailable } = await import('../ocr-extractor.service.js');
      const result = await isOcrAvailable();

      expect(result).toBe(true);
    });

    it('returns false when tesseract is not available', async () => {
      vi.doMock('child_process', () => ({
        execFile: vi.fn((cmd: string, _args: string[], cb: (err: Error | null, stdout: string, stderr: string) => void) => {
          if (cmd === 'tesseract') {
            cb(new Error('command not found'), '', 'command not found');
          } else {
            cb(null, 'version info', '');
          }
        }),
      }));

      const { isOcrAvailable } = await import('../ocr-extractor.service.js');
      const result = await isOcrAvailable();

      expect(result).toBe(false);
    });

    it('returns false when pdftoppm is not available', async () => {
      let callCount = 0;
      vi.doMock('child_process', () => ({
        execFile: vi.fn((_cmd: string, _args: string[], cb: (err: Error | null, stdout: string, stderr: string) => void) => {
          callCount++;
          // First call (tesseract) succeeds, second call (pdftoppm) fails
          if (callCount === 1) {
            cb(null, 'tesseract 5.0.0', '');
          } else {
            cb(new Error('command not found'), '', 'command not found');
          }
        }),
      }));

      const { isOcrAvailable } = await import('../ocr-extractor.service.js');
      const result = await isOcrAvailable();

      expect(result).toBe(false);
    });
  });

  describe('extractTextWithOcr', () => {
    it('returns null when pdftoppm fails', async () => {
      // Mock fs for temp directory operations
      vi.doMock('fs/promises', () => ({
        default: {
          mkdtemp: vi.fn().mockResolvedValue('/tmp/ocr-test123'),
          writeFile: vi.fn().mockResolvedValue(undefined),
          readdir: vi.fn().mockResolvedValue([]),
          rm: vi.fn().mockResolvedValue(undefined),
        },
      }));

      // Mock child_process to fail on pdftoppm
      vi.doMock('child_process', () => ({
        execFile: vi.fn((_cmd: string, _args: string[], cb: (err: Error | null, stdout: string, stderr: string) => void) => {
          cb(new Error('pdftoppm failed'), '', 'error');
        }),
      }));

      const { extractTextWithOcr } = await import('../ocr-extractor.service.js');
      const result = await extractTextWithOcr(Buffer.from('fake-pdf'));

      expect(result).toBeNull();
    });

    it('returns null when no images are generated', async () => {
      vi.doMock('fs/promises', () => ({
        default: {
          mkdtemp: vi.fn().mockResolvedValue('/tmp/ocr-test123'),
          writeFile: vi.fn().mockResolvedValue(undefined),
          readdir: vi.fn().mockResolvedValue(['input.pdf']), // No page images
          rm: vi.fn().mockResolvedValue(undefined),
        },
      }));

      vi.doMock('child_process', () => ({
        execFile: vi.fn((_cmd: string, _args: string[], cb: (err: Error | null, stdout: string, stderr: string) => void) => {
          cb(null, '', '');
        }),
      }));

      const { extractTextWithOcr } = await import('../ocr-extractor.service.js');
      const result = await extractTextWithOcr(Buffer.from('fake-pdf'));

      expect(result).toBeNull();
    });

    it('cleans up temp directory even on failure', async () => {
      const mockRm = vi.fn().mockResolvedValue(undefined);

      vi.doMock('fs/promises', () => ({
        default: {
          mkdtemp: vi.fn().mockResolvedValue('/tmp/ocr-test123'),
          writeFile: vi.fn().mockResolvedValue(undefined),
          readdir: vi.fn().mockResolvedValue([]),
          rm: mockRm,
        },
      }));

      vi.doMock('child_process', () => ({
        execFile: vi.fn((_cmd: string, _args: string[], cb: (err: Error | null, stdout: string, stderr: string) => void) => {
          cb(new Error('pdftoppm failed'), '', 'error');
        }),
      }));

      const { extractTextWithOcr } = await import('../ocr-extractor.service.js');
      await extractTextWithOcr(Buffer.from('fake-pdf'));

      expect(mockRm).toHaveBeenCalledWith('/tmp/ocr-test123', { recursive: true, force: true });
    });
  });
});
