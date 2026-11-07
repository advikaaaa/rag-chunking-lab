// Pure pass/fail logic for the Fix-the-Bot challenges (shared by the UI and tests).

import { chunkDocument } from './chunkers.js';
import { buildBM25, locateSpan, coverage } from './retrieval.js';
import { getDocument } from '../data/documents.js';
import { CHALLENGE_TOP_K } from '../data/challenges.js';

/**
 * Pass condition: with BM25 top-3, at least one retrieved chunk fully contains
 * the gold answer span (and is within `maxTokens`, if the challenge sets one).
 */
export function evaluateChallenge(challenge, config, { countTokens }) {
  const doc = getDocument(challenge.docId);
  const { chunks } = chunkDocument(doc.text, config, { countTokens, docTitle: doc.title });
  const bm25 = buildBM25(chunks.map((c) => c.retrievalText));
  const results = bm25.search(challenge.question, CHALLENGE_TOP_K);
  const loc = locateSpan(doc.text, challenge.gold);
  if (!loc) throw new Error(`Gold span not found for challenge ${challenge.id}`);

  const retrieved = results.map((r, rank) => {
    const chunk = chunks[r.index];
    return { rank: rank + 1, chunk, score: r.score, matched: r.matched, mark: coverage(chunk, loc) };
  });
  const hits = retrieved.filter((r) => r.mark === 'full');
  const goodHit = hits.find((r) => !challenge.maxTokens || r.chunk.tokens <= challenge.maxTokens);

  let reason;
  if (goodHit) reason = 'pass';
  else if (hits.length) reason = 'too-big';
  else if (chunks.some((c) => coverage(c, loc) === 'full')) reason = 'not-retrieved';
  else reason = 'split';

  return { pass: Boolean(goodHit), reason, retrieved, chunks, loc, hit: goodHit || hits[0] || null };
}
