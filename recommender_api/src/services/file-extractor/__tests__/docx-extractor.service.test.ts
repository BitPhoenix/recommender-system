import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/*
 * Unit tests for DOCX text extraction.
 * Uses mocked mammoth to avoid needing real DOCX files.
 */
describe('docx-extractor.service', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractTextFromDocx', () => {
    it('returns extraction result for DOCX with sufficient text', async () => {
      vi.doMock('mammoth', () => ({
        default: {
          extractRawText: vi.fn().mockResolvedValue({
            value: 'A'.repeat(200),
            messages: [],
          }),
        },
      }));

      const { extractTextFromDocx } = await import('../docx-extractor.service.js');
      const result = await extractTextFromDocx(Buffer.from('fake-docx'));

      expect(result).not.toBeNull();
      expect(result?.extractionMethod).toBe('docx');
      expect(result?.textLength).toBe(200);
      expect(result?.pageCount).toBe(1); // DOCX doesn't have native page count
    });

    it('returns null for DOCX with insufficient text', async () => {
      vi.doMock('mammoth', () => ({
        default: {
          extractRawText: vi.fn().mockResolvedValue({
            value: 'Short',
            messages: [],
          }),
        },
      }));

      const { extractTextFromDocx } = await import('../docx-extractor.service.js');
      const result = await extractTextFromDocx(Buffer.from('fake-docx'));

      expect(result).toBeNull();
    });

    it('returns null when mammoth throws an error', async () => {
      vi.doMock('mammoth', () => ({
        default: {
          extractRawText: vi.fn().mockRejectedValue(new Error('Invalid DOCX')),
        },
      }));

      const { extractTextFromDocx } = await import('../docx-extractor.service.js');
      const result = await extractTextFromDocx(Buffer.from('invalid-docx'));

      expect(result).toBeNull();
    });

    it('logs warnings from mammoth', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      vi.doMock('mammoth', () => ({
        default: {
          extractRawText: vi.fn().mockResolvedValue({
            value: 'A'.repeat(200),
            messages: [{ type: 'warning', message: 'Unsupported element' }],
          }),
        },
      }));

      const { extractTextFromDocx } = await import('../docx-extractor.service.js');
      await extractTextFromDocx(Buffer.from('fake-docx'));

      expect(consoleSpy).toHaveBeenCalledWith(
        '[DOCX] Extraction warnings:',
        expect.any(Array)
      );
    });

    it('trims whitespace from extracted text', async () => {
      vi.doMock('mammoth', () => ({
        default: {
          extractRawText: vi.fn().mockResolvedValue({
            value: '   ' + 'A'.repeat(200) + '   \n\n',
            messages: [],
          }),
        },
      }));

      const { extractTextFromDocx } = await import('../docx-extractor.service.js');
      const result = await extractTextFromDocx(Buffer.from('fake-docx'));

      expect(result?.text).toBe('A'.repeat(200));
    });

    it('returns text and correct textLength', async () => {
      const expectedText = 'This is a sample resume text for testing purposes. It contains enough content to pass the minimum length threshold.';
      vi.doMock('mammoth', () => ({
        default: {
          extractRawText: vi.fn().mockResolvedValue({
            value: expectedText,
            messages: [],
          }),
        },
      }));

      const { extractTextFromDocx } = await import('../docx-extractor.service.js');
      const result = await extractTextFromDocx(Buffer.from('fake-docx'));

      expect(result?.text).toBe(expectedText);
      expect(result?.textLength).toBe(expectedText.length);
    });
  });
});
