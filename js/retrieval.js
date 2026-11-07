// Retrieval and evaluation: BM25 keyword ranking, cosine similarity for
// embeddings, gold-span checks, and hit rate@k / MRR.

import { cosineSimilarity } from './chunkers.js';

export { cosineSimilarity };

export const STOPWORDS = new Set(
  `a an and are as at be been but by can could do does did for from has have how i if in into is it its
  me my of on or our so than that the their them then there these they this to was we were what when where
  which who why will with would you your yours about after before also any just more most not no only per
  should than up out over very via all each other some such own same too`.split(/\s+/),
);

// A tiny stemmer: only folds simple plurals ("refunds" -> "refund").
// Real systems use a proper stemmer or lemmatiser; this keeps the demo readable.
function stem(word) {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith('s') && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

/** Lowercase, split on anything that isn't a letter or digit, drop stopwords, fold plurals. */
export function searchTerms(text) {
  const words = text.toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]+/gu) || [];
  return words.filter((w) => !STOPWORDS.has(w)).map(stem);
}

/**
 * Okapi BM25.
 *   score(q, d) = sum over query terms t of
 *     idf(t) * tf(t,d) * (k1 + 1) / (tf(t,d) + k1 * (1 - b + b * |d| / avgdl))
 *   idf(t) = ln(1 + (N - n_t + 0.5) / (n_t + 0.5))   (the always-positive variant)
 */
export function buildBM25(texts, { k1 = 1.5, b = 0.75 } = {}) {
  const docs = texts.map((t) => {
    const terms = searchTerms(t);
    const tf = new Map();
    for (const term of terms) tf.set(term, (tf.get(term) || 0) + 1);
    return { tf, length: terms.length };
  });
  const N = docs.length;
  const avgdl = docs.reduce((a, d) => a + d.length, 0) / (N || 1) || 1;
  const df = new Map();
  for (const d of docs) for (const term of d.tf.keys()) df.set(term, (df.get(term) || 0) + 1);
  const idf = (term) => {
    const n = df.get(term) || 0;
    return Math.log(1 + (N - n + 0.5) / (n + 0.5));
  };

  return {
    /** Returns the top-k chunks with a score above zero, best first. */
    search(query, k) {
      const qTerms = [...new Set(searchTerms(query))];
      const scored = docs.map((d, index) => {
        let score = 0;
        const matched = [];
        for (const term of qTerms) {
          const f = d.tf.get(term);
          if (!f) continue;
          matched.push(term);
          score += (idf(term) * f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.length) / avgdl));
        }
        return { index, score, matched };
      });
      return scored
        .filter((r) => r.score > 0)
        .sort((x, y) => y.score - x.score || x.index - y.index)
        .slice(0, k);
    },
  };
}

/** Ranks chunk embeddings by cosine similarity to a query embedding. */
export function rankByCosine(queryVec, chunkVecs, k) {
  return chunkVecs
    .map((v, index) => ({ index, score: cosineSimilarity(queryVec, v), matched: [] }))
    .sort((x, y) => y.score - x.score || x.index - y.index)
    .slice(0, k);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Finds the gold answer span in the document. Whitespace differences
 * (line breaks vs spaces) are ignored; anything else must match exactly.
 * Returns { start, end } or null.
 */
export function locateSpan(docText, gold) {
  const parts = gold.trim().split(/\s+/).map(escapeRegex);
  const re = new RegExp(parts.join('\\s+'));
  const m = re.exec(docText);
  return m ? { start: m.index, end: m.index + m[0].length } : null;
}

/** 'full' if the chunk contains the whole gold span, 'partial' if it overlaps it, else 'none'. */
export function coverage(chunk, loc) {
  if (!loc) return 'none';
  if (chunk.start <= loc.start && chunk.end >= loc.end) return 'full';
  if (chunk.start < loc.end && chunk.end > loc.start) return 'partial';
  return 'none';
}

/**
 * Runs every gold question and reports hit rate@k and MRR.
 * retrieve(question, k) must return ranked results [{ index }].
 */
export function evaluate(chunks, questions, docText, k, retrieve) {
  const perQuestion = questions.map((q) => {
    const loc = locateSpan(docText, q.gold);
    const results = retrieve(q.q, k);
    const marks = results.map((r) => coverage(chunks[r.index], loc));
    const hitRank = marks.indexOf('full') + 1; // 0 means no hit
    return { question: q.q, found: Boolean(loc), marks, hitRank };
  });
  const n = perQuestion.length || 1;
  return {
    k,
    perQuestion,
    hitRate: perQuestion.filter((p) => p.hitRank > 0).length / n,
    mrr: perQuestion.reduce((a, p) => a + (p.hitRank ? 1 / p.hitRank : 0), 0) / n,
  };
}
