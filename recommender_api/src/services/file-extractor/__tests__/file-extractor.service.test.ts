import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/*
 * Unit tests for file extraction routing.
 */
describe('file-extractor.service', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractTextFromFile', () => {
    it('routes PDF files to PDF extractor', async () => {
      const mockPdfResult = {
        text: 'PDF content here',
        pageCount: 1,
        extractionMethod: 'pdf-native' as const,
        textLength: 16,
      };

      vi.doMock('../pdf-extractor.service.js', () => ({
        extractTextFromPdf: vi.fn().mockResolvedValue(mockPdfResult),
      }));

      const { extractTextFromFile } = await import('../file-extractor.service.js');
      const result = await extractTextFromFile(
        Buffer.from('fake-pdf'),
        'application/pdf'
      );

      expect(result).toEqual(mockPdfResult);
    });

    it('returns null for unsupported MIME types', async () => {
      // Mock PDF extractor even though it won't be called
      vi.doMock('../pdf-extractor.service.js', () => ({
        extractTextFromPdf: vi.fn(),
      }));

      const { extractTextFromFile } = await import('../file-extractor.service.js');
      const result = await extractTextFromFile(
        Buffer.from('plain text'),
        'text/plain'
      );

      expect(result).toBeNull();
    });

    it('routes DOCX files to DOCX extractor', async () => {
      const mockDocxResult = {
        text: 'DOCX content here',
        pageCount: 1,
        extractionMethod: 'docx' as const,
        textLength: 17,
      };

      vi.doMock('../pdf-extractor.service.js', () => ({
        extractTextFromPdf: vi.fn(),
      }));

      vi.doMock('../docx-extractor.service.js', () => ({
        extractTextFromDocx: vi.fn().mockResolvedValue(mockDocxResult),
      }));

      const { extractTextFromFile } = await import('../file-extractor.service.js');
      const result = await extractTextFromFile(
        Buffer.from('fake-docx'),
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );

      expect(result).toEqual(mockDocxResult);
    });

    it('returns null for image files', async () => {
      vi.doMock('../pdf-extractor.service.js', () => ({
        extractTextFromPdf: vi.fn(),
      }));

      const { extractTextFromFile } = await import('../file-extractor.service.js');
      const result = await extractTextFromFile(
        Buffer.from('fake-image'),
        'image/png'
      );

      expect(result).toBeNull();
    });

    it('returns null for legacy .doc files', async () => {
      vi.doMock('../pdf-extractor.service.js', () => ({
        extractTextFromPdf: vi.fn(),
      }));

      const { extractTextFromFile } = await import('../file-extractor.service.js');
      const result = await extractTextFromFile(
        Buffer.from('fake-doc'),
        'application/msword'
      );

      // Legacy .doc is explicitly not supported
      expect(result).toBeNull();
    });
  });
});
