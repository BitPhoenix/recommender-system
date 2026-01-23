import { tokenize, NORMALIZATION_STRATEGY } from "./text-normalizer.service.js";
import { type SparseVector, l2Normalize } from "./sparse-vector.service.js";

/*
 * =============================================================================
 * TYPES
 * =============================================================================
 */

export interface Document {
  id: string;
  text: string;
}

export interface TfIdfIndex {
  vocabulary: Set<string>;
  termToIdf: Map<string, number>;
  documentIdToVector: Map<string, SparseVector>;
  totalDocuments: number;
}

interface TfIdfComponents {
  vocabulary: Set<string>;
  docIdToTermToTf: Map<string, Map<string, number>>;
  termToIdf: Map<string, number>;
}

/*
 * =============================================================================
 * INDEX BUILDING
 * =============================================================================
 */

/*
 * Build a TF-IDF index from documents with concatenated text.
 */
export function buildTfIdfIndex(documents: Document[]): TfIdfIndex {
  const { vocabulary, docIdToTermToTf, termToIdf } = computeTfIdfComponents(documents);
  const documentIdToVector = buildDocumentVectors(documents, docIdToTermToTf, termToIdf);

  return {
    vocabulary,
    termToIdf,
    documentIdToVector,
    totalDocuments: documents.length,
  };
}

function computeTfIdfComponents(documents: Document[]): TfIdfComponents {
  const vocabulary = new Set<string>();
  // Counts how many documents contain each term - the standard definition of document frequency (DF) in TF-IDF
  const termToDocumentFrequency = new Map<string, number>();
  const docIdToTermCounts = new Map<string, Map<string, number>>();

  for (const doc of documents) {
    const termToCountInDoc = computeTermCountsInDocument(doc.text);
    docIdToTermCounts.set(doc.id, termToCountInDoc);

    for (const term of termToCountInDoc.keys()) {
      vocabulary.add(term);
      termToDocumentFrequency.set(term, (termToDocumentFrequency.get(term) || 0) + 1);
    }
  }

  const docIdToTermToTf = computeTfFromTermCounts(docIdToTermCounts);
  const termToIdf = computeIdfFromDocumentFrequency(termToDocumentFrequency, documents.length);

  return { vocabulary, docIdToTermToTf, termToIdf };
}

function computeTermCountsInDocument(text: string): Map<string, number> {
  const termToCountInDoc = new Map<string, number>();
  const tokens = tokenize(text, NORMALIZATION_STRATEGY);

  for (const token of tokens) {
    termToCountInDoc.set(token, (termToCountInDoc.get(token) || 0) + 1);
  }

  return termToCountInDoc;
}

function computeTfFromTermCounts(
  docIdToTermCounts: Map<string, Map<string, number>>
): Map<string, Map<string, number>> {
  const docIdToTermToTf = new Map<string, Map<string, number>>();

  for (const [docId, termToCountInDoc] of docIdToTermCounts) {
    const numTotalTermsInDoc = Array.from(termToCountInDoc.values()).reduce((sum, count) => sum + count, 0);
    const termToTfInDoc = new Map<string, number>();

    for (const [term, termCountInDoc] of termToCountInDoc) {
      termToTfInDoc.set(term, termCountInDoc / numTotalTermsInDoc);
    }

    docIdToTermToTf.set(docId, termToTfInDoc);
  }

  return docIdToTermToTf;
}

function computeIdfFromDocumentFrequency(
  termToDocumentFrequency: Map<string, number>,
  totalDocs: number
): Map<string, number> {
  const termToIdf = new Map<string, number>();
  for (const [term, documentFrequency] of termToDocumentFrequency) {
    termToIdf.set(term, Math.log(totalDocs / (documentFrequency + 1)) + 1); // Smoothed IDF
  }
  return termToIdf;
}

function buildDocumentVectors(
  documents: Document[],
  docIdToTermToTf: Map<string, Map<string, number>>,
  termToIdf: Map<string, number>
): Map<string, SparseVector> {
  const documentIdToVector = new Map<string, SparseVector>();

  for (const doc of documents) {
    const termToTfInDoc = docIdToTermToTf.get(doc.id)!;
    const vector = buildSingleDocumentVector(termToTfInDoc, termToIdf);
    documentIdToVector.set(doc.id, l2Normalize(vector));
  }

  return documentIdToVector;
}

function buildSingleDocumentVector(
  termToTfInDoc: Map<string, number>,
  termToIdf: Map<string, number>
): SparseVector {
  const terms: string[] = [];
  const weights: number[] = [];

  for (const [term, tf] of termToTfInDoc) {
    const idf = termToIdf.get(term) || 0;
    const tfidf = tf * idf;

    if (tfidf > 0) {
      terms.push(term);
      weights.push(tfidf);
    }
  }

  return { terms, weights };
}

/*
 * =============================================================================
 * QUERY PROCESSING
 * =============================================================================
 */

/*
 * Convert a query string to a TF-IDF vector using the IDF values from the corpus index.
 * This ensures query terms are weighted consistently with document terms.
 */
export function queryToVector(query: string, index: TfIdfIndex): SparseVector {
  const tokens = tokenize(query, NORMALIZATION_STRATEGY);
  const termCounts = countKnownTerms(tokens, index.vocabulary);
  const vector = buildQueryVector(termCounts, tokens.length, index.termToIdf);
  return l2Normalize(vector);
}

function countKnownTerms(
  tokens: string[],
  vocabulary: Set<string>
): Map<string, number> {
  const termCounts = new Map<string, number>();
  for (const token of tokens) {
    if (vocabulary.has(token)) {
      termCounts.set(token, (termCounts.get(token) || 0) + 1);
    }
  }
  return termCounts;
}

function buildQueryVector(
  termCounts: Map<string, number>,
  totalTokens: number,
  termToIdf: Map<string, number>
): SparseVector {
  const terms: string[] = [];
  const weights: number[] = [];

  for (const [term, count] of termCounts) {
    const tf = count / totalTokens;
    const idf = termToIdf.get(term) || 0;
    const tfidf = tf * idf;

    if (tfidf > 0) {
      terms.push(term);
      weights.push(tfidf);
    }
  }

  return { terms, weights };
}

/*
 * =============================================================================
 * RE-EXPORTS
 * =============================================================================
 */

export { type SparseVector } from "./sparse-vector.service.js";
export { cosineSimilarity, getTopMatchingTerms } from "./sparse-vector.service.js";
export { tokenize } from "./text-normalizer.service.js";
