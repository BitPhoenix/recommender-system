import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/*
 * Unit tests for PDF text extraction.
 *
 * These tests verify the extraction logic by mocking the pdf-parse library.
 * Integration tests with real PDF files are done via E2E tests.
 */
describe('pdf-extractor.service', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractTextFromPdfNative', () => {
    it('returns extraction result for PDFs with sufficient text', async () => {
      const mockTextResult = {
        text: 'A'.repeat(150),
        pages: [{ text: 'A'.repeat(150) }],
      };

      const mockInfoResult = {
        pages: [{ pageNumber: 1 }, { pageNumber: 2 }],
      };

      class MockPDFParse {
        getText = vi.fn().mockResolvedValue(mockTextResult);
        getInfo = vi.fn().mockResolvedValue(mockInfoResult);
        destroy = vi.fn().mockResolvedValue(undefined);
      }

      vi.doMock('pdf-parse', () => ({
        PDFParse: MockPDFParse,
      }));

      const { extractTextFromPdfNative } = await import('../pdf-extractor.service.js');
      const result = await extractTextFromPdfNative(Buffer.from('fake-pdf'));

      expect(result).not.toBeNull();
      expect(result?.extractionMethod).toBe('pdf-native');
      expect(result?.textLength).toBe(150);
      expect(result?.pageCount).toBe(2);
    });

    it('returns null for PDFs with insufficient text', async () => {
      const mockTextResult = {
        text: 'Short',
        pages: [{ text: 'Short' }],
      };

      class MockPDFParse {
        getText = vi.fn().mockResolvedValue(mockTextResult);
        getInfo = vi.fn().mockResolvedValue({ pages: [] });
        destroy = vi.fn().mockResolvedValue(undefined);
      }

      vi.doMock('pdf-parse', () => ({
        PDFParse: MockPDFParse,
      }));

      const { extractTextFromPdfNative } = await import('../pdf-extractor.service.js');
      const result = await extractTextFromPdfNative(Buffer.from('fake-pdf'));

      expect(result).toBeNull();
    });

    it('returns null when pdf-parse throws an error', async () => {
      class MockPDFParse {
        getText = vi.fn().mockRejectedValue(new Error('Invalid PDF'));
        destroy = vi.fn().mockResolvedValue(undefined);
      }

      vi.doMock('pdf-parse', () => ({
        PDFParse: MockPDFParse,
      }));

      const { extractTextFromPdfNative } = await import('../pdf-extractor.service.js');
      const result = await extractTextFromPdfNative(Buffer.from('invalid-pdf'));

      expect(result).toBeNull();
    });

    it('trims whitespace from extracted text', async () => {
      const mockTextResult = {
        text: '   ' + 'A'.repeat(150) + '   \n\n',
        pages: [{ text: '   ' + 'A'.repeat(150) + '   \n\n' }],
      };

      class MockPDFParse {
        getText = vi.fn().mockResolvedValue(mockTextResult);
        getInfo = vi.fn().mockResolvedValue({ pages: [{}] });
        destroy = vi.fn().mockResolvedValue(undefined);
      }

      vi.doMock('pdf-parse', () => ({
        PDFParse: MockPDFParse,
      }));

      const { extractTextFromPdfNative } = await import('../pdf-extractor.service.js');
      const result = await extractTextFromPdfNative(Buffer.from('fake-pdf'));

      expect(result?.text).toBe('A'.repeat(150));
    });

    it('handles null text from pdf-parse', async () => {
      const mockTextResult = {
        text: null,
        pages: [],
      };

      class MockPDFParse {
        getText = vi.fn().mockResolvedValue(mockTextResult);
        getInfo = vi.fn().mockResolvedValue({ pages: [] });
        destroy = vi.fn().mockResolvedValue(undefined);
      }

      vi.doMock('pdf-parse', () => ({
        PDFParse: MockPDFParse,
      }));

      const { extractTextFromPdfNative } = await import('../pdf-extractor.service.js');
      const result = await extractTextFromPdfNative(Buffer.from('fake-pdf'));

      expect(result).toBeNull();
    });

    it('handles undefined text from pdf-parse', async () => {
      const mockTextResult = {
        text: undefined,
        pages: [],
      };

      class MockPDFParse {
        getText = vi.fn().mockResolvedValue(mockTextResult);
        getInfo = vi.fn().mockResolvedValue({ pages: [] });
        destroy = vi.fn().mockResolvedValue(undefined);
      }

      vi.doMock('pdf-parse', () => ({
        PDFParse: MockPDFParse,
      }));

      const { extractTextFromPdfNative } = await import('../pdf-extractor.service.js');
      const result = await extractTextFromPdfNative(Buffer.from('fake-pdf'));

      expect(result).toBeNull();
    });
  });

  describe('extractTextFromPdf', () => {
    it('returns native extraction result when successful', async () => {
      const mockTextResult = {
        text: 'A'.repeat(200),
        pages: [{ text: 'A'.repeat(200) }],
      };

      class MockPDFParse {
        getText = vi.fn().mockResolvedValue(mockTextResult);
        getInfo = vi.fn().mockResolvedValue({ pages: [{}, {}, {}] });
        destroy = vi.fn().mockResolvedValue(undefined);
      }

      vi.doMock('pdf-parse', () => ({
        PDFParse: MockPDFParse,
      }));

      // Mock OCR as unavailable so we test the native path
      vi.doMock('../ocr-extractor.service.js', () => ({
        isOcrAvailable: vi.fn().mockResolvedValue(false),
        extractTextWithOcr: vi.fn(),
      }));

      const { extractTextFromPdf } = await import('../pdf-extractor.service.js');
      const result = await extractTextFromPdf(Buffer.from('fake-pdf'));

      expect(result).not.toBeNull();
      expect(result?.extractionMethod).toBe('pdf-native');
    });

    it('falls back to OCR when native extraction returns insufficient text', async () => {
      const mockTextResult = {
        text: 'Short',
        pages: [],
      };

      class MockPDFParse {
        getText = vi.fn().mockResolvedValue(mockTextResult);
        getInfo = vi.fn().mockResolvedValue({ pages: [] });
        destroy = vi.fn().mockResolvedValue(undefined);
      }

      vi.doMock('pdf-parse', () => ({
        PDFParse: MockPDFParse,
      }));

      // Mock OCR to be available and return text
      vi.doMock('../ocr-extractor.service.js', () => ({
        isOcrAvailable: vi.fn().mockResolvedValue(true),
        extractTextWithOcr: vi.fn().mockResolvedValue({
          text: 'A'.repeat(200),
          pageCount: 1,
        }),
      }));

      const { extractTextFromPdf } = await import('../pdf-extractor.service.js');
      const result = await extractTextFromPdf(Buffer.from('scanned-pdf'));

      expect(result).not.toBeNull();
      expect(result?.extractionMethod).toBe('pdf-ocr');
      expect(result?.textLength).toBe(200);
    });

    it('returns null when OCR tools are not available', async () => {
      const mockTextResult = {
        text: '',
        pages: [],
      };

      class MockPDFParse {
        getText = vi.fn().mockResolvedValue(mockTextResult);
        getInfo = vi.fn().mockResolvedValue({ pages: [] });
        destroy = vi.fn().mockResolvedValue(undefined);
      }

      vi.doMock('pdf-parse', () => ({
        PDFParse: MockPDFParse,
      }));

      vi.doMock('../ocr-extractor.service.js', () => ({
        isOcrAvailable: vi.fn().mockResolvedValue(false),
        extractTextWithOcr: vi.fn(),
      }));

      const { extractTextFromPdf } = await import('../pdf-extractor.service.js');
      const result = await extractTextFromPdf(Buffer.from('scanned-pdf'));

      expect(result).toBeNull();
    });

    it('returns null when OCR extraction fails', async () => {
      const mockTextResult = {
        text: '',
        pages: [],
      };

      class MockPDFParse {
        getText = vi.fn().mockResolvedValue(mockTextResult);
        getInfo = vi.fn().mockResolvedValue({ pages: [] });
        destroy = vi.fn().mockResolvedValue(undefined);
      }

      vi.doMock('pdf-parse', () => ({
        PDFParse: MockPDFParse,
      }));

      vi.doMock('../ocr-extractor.service.js', () => ({
        isOcrAvailable: vi.fn().mockResolvedValue(true),
        extractTextWithOcr: vi.fn().mockResolvedValue(null), // OCR failed
      }));

      const { extractTextFromPdf } = await import('../pdf-extractor.service.js');
      const result = await extractTextFromPdf(Buffer.from('scanned-pdf'));

      expect(result).toBeNull();
    });

    it('returns null when OCR extraction returns insufficient text', async () => {
      const mockTextResult = {
        text: '',
        pages: [],
      };

      class MockPDFParse {
        getText = vi.fn().mockResolvedValue(mockTextResult);
        getInfo = vi.fn().mockResolvedValue({ pages: [] });
        destroy = vi.fn().mockResolvedValue(undefined);
      }

      vi.doMock('pdf-parse', () => ({
        PDFParse: MockPDFParse,
      }));

      vi.doMock('../ocr-extractor.service.js', () => ({
        isOcrAvailable: vi.fn().mockResolvedValue(true),
        extractTextWithOcr: vi.fn().mockResolvedValue({
          text: 'Too short', // Less than MIN_TEXT_LENGTH (100)
          pageCount: 1,
        }),
      }));

      const { extractTextFromPdf } = await import('../pdf-extractor.service.js');
      const result = await extractTextFromPdf(Buffer.from('scanned-pdf'));

      expect(result).toBeNull();
    });
  });
});
