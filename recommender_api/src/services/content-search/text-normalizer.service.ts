import natural from "natural";
import lemmatizer from "lemmatizer";

const { PorterStemmer, WordTokenizer } = natural;

/*
 * =============================================================================
 * TYPES & CONFIGURATION
 * =============================================================================
 */

export type NormalizationStrategy = "none" | "stemming" | "lemma";

/*
 * Current normalization strategy - change this to compare approaches.
 * After rebuilding the index, run the same searches and compare results.
 */
export const NORMALIZATION_STRATEGY: NormalizationStrategy = "none";

/*
 * =============================================================================
 * STOPWORDS
 * =============================================================================
 *
 * Why use stopwords when IDF already down-weights common terms?
 *
 * 1. **Cleaner "matching terms" explanations** - Users see meaningful matches
 * 2. **Smaller index size** - Fewer dimensions, less memory, faster computation
 * 3. **Edge case protection** - Works even in small corpora where IDF is unreliable
 */

// Standard English stopwords (articles, prepositions, pronouns, auxiliaries)
const ENGLISH_STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of",
  "with", "by", "from", "as", "is", "was", "are", "were", "been", "be", "have",
  "has", "had", "do", "does", "did", "will", "would", "could", "should", "may",
  "might", "must", "shall", "can", "need", "dare", "ought", "used", "i", "you",
  "he", "she", "it", "we", "they", "what", "which", "who", "whom", "this",
  "that", "these", "those", "am", "being", "having", "doing",
]);

/*
 * Resume-specific stopwords: words that appear on nearly every resume but
 * provide zero discriminative value for matching candidates.
 */
const RESUME_FILLER_WORDS = new Set([
  "responsible", "responsibilities", "various", "multiple", "several",
  "including", "such", "also", "well", "etc", "using", "within",
  "years", "year", "months", "month",
  "experience", "experienced", "work", "worked", "working",
  "team", "teams", "company", "role", "position", "job",
]);

const STOPWORDS = new Set([...ENGLISH_STOPWORDS, ...RESUME_FILLER_WORDS]);

/*
 * =============================================================================
 * TECH-SPECIFIC PATTERNS
 * =============================================================================
 */

/*
 * Compound patterns normalized before tokenization.
 */
const TECH_COMPOUND_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // JavaScript ecosystem
  { pattern: /\bnode\.?js\b/gi, replacement: "nodejs" },
  { pattern: /\bvue\.?js\b/gi, replacement: "vuejs" },
  { pattern: /\bnext\.?js\b/gi, replacement: "nextjs" },
  { pattern: /\bnuxt\.?js\b/gi, replacement: "nuxtjs" },
  { pattern: /\breact\.?js\b/gi, replacement: "reactjs" },
  { pattern: /\bexpress\.?js\b/gi, replacement: "expressjs" },
  { pattern: /\bthree\.?js\b/gi, replacement: "threejs" },
  { pattern: /\bd3\.?js\b/gi, replacement: "d3js" },
  // .NET ecosystem
  { pattern: /\.net\b/gi, replacement: "dotnet" },
  { pattern: /\basp\.net\b/gi, replacement: "aspnet" },
  // Languages with special characters
  { pattern: /\bc\+\+/gi, replacement: "cpp" },
  { pattern: /\bc#/gi, replacement: "csharp" },
  { pattern: /\bf#/gi, replacement: "fsharp" },
  // Common abbreviations
  { pattern: /\bk8s\b/gi, replacement: "kubernetes" },
  // Version patterns: "Python 3.9" → "python"
  { pattern: /\b(python|java|node|go|rust|ruby)\s*\d+(\.\d+)*/gi, replacement: "$1" },
];

/*
 * Multi-word tech phrases treated as single tokens.
 */
const PHRASE_TO_TOKEN: Record<string, string> = {
  "machine learning": "machinelearning",
  "deep learning": "deeplearning",
  "natural language processing": "nlp",
  "computer vision": "computervision",
  "data science": "datascience",
  "data engineering": "dataengineering",
  "site reliability": "sre",
  "continuous integration": "ci",
  "continuous deployment": "cd",
  "ci cd": "cicd",
  "ci/cd": "cicd",
  "dev ops": "devops",
  "user experience": "ux",
  "user interface": "ui",
  "front end": "frontend",
  "back end": "backend",
  "full stack": "fullstack",
  "real time": "realtime",
  "open source": "opensource",
  "test driven": "tdd",
  "behavior driven": "bdd",
  "object oriented": "oop",
  "event driven": "eventdriven",
  "micro services": "microservices",
  "rest api": "restapi",
  "restful api": "restapi",
  "graphql api": "graphqlapi",
  "cloud native": "cloudnative",
  "infrastructure as code": "iac",
  "version control": "versioncontrol",
  "tech lead": "techlead",
  "team lead": "teamlead",
  "engineering manager": "engineeringmanager",
};

const wordTokenizer = new WordTokenizer();

/*
 * =============================================================================
 * MAIN API
 * =============================================================================
 */

/*
 * Tokenize and normalize text for TF-IDF/embedding processing.
 *
 * Processing pipeline:
 *   1. Normalize tech compounds  - "Node.js" → "nodejs", "C++" → "cpp"
 *   2. Replace known phrases     - "machine learning" → "machinelearning"
 *   3. Tokenize                  - Split into words
 *   4. Filter stopwords          - Remove non-discriminative words
 *   5. Apply normalization       - Stem or lemmatize based on strategy
 *
 * @param text - Raw text to tokenize
 * @param strategy - Word normalization approach (defaults to NORMALIZATION_STRATEGY)
 */
export function tokenize(
  text: string,
  strategy: NormalizationStrategy = NORMALIZATION_STRATEGY
): string[] {
  const withNormalizedCompounds = normalizeTechCompounds(text);
  const withReplacedPhrases = replaceKnownPhrases(withNormalizedCompounds.toLowerCase());
  const rawTokens = wordTokenizer.tokenize(withReplacedPhrases) || [];
  const withoutStopwords = filterStopwords(rawTokens);
  const normalized = applyWordNormalization(withoutStopwords, strategy);
  return normalized;
}

/*
 * =============================================================================
 * PIPELINE HELPERS (called by tokenize)
 * =============================================================================
 */

function normalizeTechCompounds(text: string): string {
  let result = text;
  for (const { pattern, replacement } of TECH_COMPOUND_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function replaceKnownPhrases(text: string): string {
  let result = text;
  for (const [phrase, token] of Object.entries(PHRASE_TO_TOKEN)) {
    result = result.replace(new RegExp(phrase, "g"), token);
  }
  return result;
}

function filterStopwords(tokens: string[]): string[] {
  return tokens.filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function applyWordNormalization(
  tokens: string[],
  strategy: NormalizationStrategy
): string[] {
  switch (strategy) {
    case "stemming":
      return tokens.map((token) => PorterStemmer.stem(token));
    case "lemma":
      return tokens.map((token) => lemmatizer(token));
    case "none":
    default:
      return tokens;
  }
}
