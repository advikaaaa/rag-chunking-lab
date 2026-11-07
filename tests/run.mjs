// Run with: node tests/run.mjs
// No test framework needed. If js-tiktoken is installed (npm install), the
// whole suite runs twice: once with the real cl100k_base tokenizer and once
// with the ~4 chars/token fallback, because the browser may use either.

import assert from 'node:assert/strict';
import { chunkDocument, splitSentences, splitSentencesRegex, semanticSpans, percentile, parseMarkdownBlocks } from '../js/chunkers.js';
import { buildBM25, searchTerms, locateSpan, coverage, evaluate } from '../js/retrieval.js';
import { cleanText, fixHyphenation, removeHeadersFooters, normaliseWhitespace } from '../js/cleaning.js';
import { estimateTokens } from '../js/tokenizer.js';
import { evaluateChallenge } from '../js/challenge-core.js';
import { DOCUMENTS } from '../data/documents.js';
import { CHALLENGES } from '../data/challenges.js';
import { GLOSSARY } from '../data/glossary.js';
import { QUIZ } from '../data/quiz.js';
import { FLASHCARDS } from '../data/flashcards.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}\n    ${err.message.split('\n').join('\n    ')}`);
  }
}

async function loadRealTokenizer() {
  try {
    const { Tiktoken } = await import('js-tiktoken/lite');
    const { default: ranks } = await import('js-tiktoken/ranks/cl100k_base');
    const enc = new Tiktoken(ranks);
    return (s) => (s.length ? enc.encode(s, [], []).length : 0);
  } catch {
    return null;
  }
}

const STRATEGY_CONFIGS = [
  { strategy: 'fixed', unit: 'tokens', size: 120, overlap: 0 },
  { strategy: 'fixed', unit: 'tokens', size: 80, overlap: 20 },
  { strategy: 'fixed', unit: 'chars', size: 300, overlap: 60 },
  { strategy: 'sentence', unit: 'tokens', size: 60, overlap: 15 },
  { strategy: 'sentence', unit: 'tokens', size: 20, overlap: 0 },
  { strategy: 'recursive', unit: 'tokens', size: 100, overlap: 15 },
  { strategy: 'recursive', unit: 'chars', size: 200, overlap: 0 },
  { strategy: 'markdown', unit: 'tokens', size: 150, overlap: 10 },
  { strategy: 'markdown', unit: 'tokens', size: 40, overlap: 0 },
];

// Every non-whitespace character must belong to at least one chunk.
function assertNoTextLost(text, chunks) {
  const covered = new Uint8Array(text.length);
  for (const c of chunks) covered.fill(1, c.start, c.end);
  for (let i = 0; i < text.length; i++) {
    if (!covered[i] && /\S/.test(text[i])) {
      throw new Error(`text lost at ${i}: "${text.slice(Math.max(0, i - 20), i + 20)}"`);
    }
  }
}

function runSuite(label, countTokens) {
  console.log(`\n# ${label}`);
  const ctxFor = (doc) => ({ countTokens, docTitle: doc.title });
  const len = (unit) => (unit === 'chars' ? (s) => s.length : countTokens);

  for (const doc of DOCUMENTS) {
    for (const cfg of STRATEGY_CONFIGS) {
      const name = `${doc.id} / ${cfg.strategy} ${cfg.size}${cfg.unit === 'chars' ? 'c' : 't'} ov${cfg.overlap}`;
      test(`${name}: no text lost, sizes within limit, deterministic`, () => {
        const a = chunkDocument(doc.text, cfg, ctxFor(doc));
        const b = chunkDocument(doc.text, cfg, ctxFor(doc));
        assert.deepEqual(a, b, 'output must be deterministic');
        assert.ok(a.chunks.length > 0);
        assertNoTextLost(doc.text, a.chunks);
        for (const c of a.chunks) {
          assert.equal(c.text, doc.text.slice(c.start, c.end));
          assert.equal(c.text, c.text.trim());
          if (!c.oversize) assert.ok(len(cfg.unit)(c.text) <= cfg.size, `chunk ${c.index} is ${len(cfg.unit)(c.text)} > ${cfg.size}`);
        }
        // Only the Markdown splitter may produce oversize chunks, and only for tables/code.
        for (const c of a.chunks.filter((x) => x.oversize)) {
          assert.equal(cfg.strategy, 'markdown', `unexpected oversize chunk in ${cfg.strategy}`);
          assert.ok(/(^|\n)\s*(\||```)/.test(c.text), 'oversize chunks must be an unsplittable table or code block');
        }
        // Chunks move forward through the document.
        for (let i = 1; i < a.chunks.length; i++) assert.ok(a.chunks[i].start > a.chunks[i - 1].start);
      });
    }

    test(`${doc.id}: fixed-size overlap never exceeds the overlap budget`, () => {
      const { chunks } = chunkDocument(doc.text, { strategy: 'fixed', unit: 'tokens', size: 80, overlap: 20 }, ctxFor(doc));
      for (let i = 1; i < chunks.length; i++) {
        const shared = doc.text.slice(chunks[i].start, Math.max(chunks[i].start, chunks[i - 1].end));
        assert.ok(countTokens(shared.trim()) <= 20 + 1, `overlap ${countTokens(shared)} tokens`);
      }
      const noOverlap = chunkDocument(doc.text, { strategy: 'fixed', unit: 'chars', size: 200, overlap: 0 }, ctxFor(doc));
      for (const c of noOverlap.chunks) assert.equal(c.overlapChars, 0);
    });

    test(`${doc.id}: every gold span exists in the (cleaned) document`, () => {
      const text = doc.id === 'messy' ? cleanText(doc.text) : doc.text;
      for (const q of doc.questions) assert.ok(locateSpan(text, q.gold), `gold not found: ${q.gold.slice(0, 50)}`);
    });
  }

  test('overlap >= size is clamped below size', () => {
    const doc = DOCUMENTS[0];
    const r = chunkDocument(doc.text, { strategy: 'fixed', unit: 'chars', size: 100, overlap: 100 }, ctxFor(doc));
    assert.equal(r.overlap, 99);
    assertNoTextLost(doc.text, r.chunks);
  });

  test('markdown splitter keeps tables and code blocks whole', () => {
    for (const doc of DOCUMENTS) {
      const { chunks } = chunkDocument(doc.text, { strategy: 'markdown', unit: 'tokens', size: 40, overlap: 0 }, ctxFor(doc));
      for (const block of parseMarkdownBlocks(doc.text).filter((b) => b.type === 'table' || b.type === 'code')) {
        assert.ok(
          chunks.some((c) => c.start <= block.start && c.end >= block.end),
          `${doc.id}: ${block.type} at ${block.start} was split`,
        );
      }
    }
  });

  test('contextual header carries the heading path', () => {
    const doc = DOCUMENTS.find((d) => d.id === 'pricing');
    const { chunks } = chunkDocument(doc.text, { strategy: 'sentence', unit: 'tokens', size: 30, overlap: 0, contextHeader: true }, ctxFor(doc));
    const orphan = chunks.find((c) => c.text.startsWith('It costs ₹499'));
    assert.ok(orphan, 'orphan chunk exists');
    assert.deepEqual(orphan.headingPath, ['NimbusDesk Pricing', 'Plans', 'Team plan']);
    assert.ok(orphan.retrievalText.startsWith('NimbusDesk Pricing › Plans › Team plan\n'));
  });

  test('semantic splitter breaks where neighbouring sentences differ most', () => {
    const text = 'Cats purr. Cats nap a lot. Stocks fell today. Markets were nervous.';
    const sentences = splitSentences(text);
    assert.equal(sentences.length, 4);
    const emb = [[1, 0], [0.95, 0.05], [0, 1], [0.05, 0.95]];
    const { spans } = semanticSpans(text, sentences, emb, { percentileThreshold: 60, size: 100, len: estimateTokens });
    assert.deepEqual(spans.map((s) => text.slice(...s.span)), ['Cats purr. Cats nap a lot.', 'Stocks fell today. Markets were nervous.']);
    assert.equal(percentile([1, 2, 3, 4, 5], 50), 3);
  });

  // ---- Fix-the-Bot: start must fail, every listed solution must pass ----
  for (const ch of CHALLENGES) {
    test(`challenge "${ch.title}": starting settings fail`, () => {
      const r = evaluateChallenge(ch, ch.start, { countTokens });
      assert.equal(r.pass, false, `start passed unexpectedly (reason ${r.reason})`);
    });
    for (const sol of ch.solutions) {
      test(`challenge "${ch.title}": fix ${sol.strategy} ${sol.size}/${sol.overlap}${sol.contextHeader ? ' +header' : ''} passes`, () => {
        const r = evaluateChallenge(ch, sol, { countTokens });
        const desc = r.retrieved.map((x) => `#${x.chunk.index}(${x.mark},${x.chunk.tokens}t)`).join(' ');
        assert.equal(r.pass, true, `reason ${r.reason}; top3: ${desc}`);
      });
    }
  }

  test('the hook: retrieved refund chunk is cut inside the exception clause', () => {
    const ch = CHALLENGES[0];
    const r = evaluateChallenge(ch, ch.start, { countTokens });
    assert.equal(r.reason, 'split');
    // The hook's story ("the chunk stopped before the exception") needs the cut
    // to land early in the clause, before "defective or arrived damaged".
    const cut = r.chunks.find((c) => c.end > r.loc.start && c.end < r.loc.end);
    assert.ok(cut, 'a chunk ends inside the gold span');
    assert.ok(!cut.text.includes('defective'), `cut too late: "...${cut.text.slice(-40)}"`);
  });

  test('cleaning raises hit rate on the messy PDF extract', () => {
    const doc = DOCUMENTS.find((d) => d.id === 'messy');
    const run = (text) => {
      const { chunks } = chunkDocument(text, { strategy: 'recursive', unit: 'tokens', size: 80, overlap: 10 }, ctxFor(doc));
      const bm25 = buildBM25(chunks.map((c) => c.text));
      return evaluate(chunks, doc.questions, text, 3, (q, k) => bm25.search(q, k)).hitRate;
    };
    const raw = run(doc.text);
    const clean = run(cleanText(doc.text));
    assert.ok(clean > raw, `clean ${clean} should beat raw ${raw}`);
    assert.equal(clean, 1);
  });
}

// ---- Tokenizer-independent tests ----
console.log('# Shared');
test('searchTerms lowercases, drops stopwords and folds plurals', () => {
  assert.deepEqual(searchTerms('How do I get Refunds for the Plans?'), ['get', 'refund', 'plan']);
});
test('BM25 ranks the matching chunk first and skips zero scores', () => {
  const bm = buildBM25(['refund policy for damaged items', 'shipping times and couriers', 'gift cards cannot be refunded']);
  const r = bm.search('damaged refund', 5);
  assert.equal(r[0].index, 0);
  assert.ok(r.every((x) => x.score > 0));
  assert.ok(!r.some((x) => x.index === 1));
});
test('locateSpan ignores whitespace differences; coverage marks', () => {
  const loc = locateSpan('alpha beta\n gamma delta', 'beta gamma');
  assert.deepEqual(loc, { start: 6, end: 17 });
  assert.equal(coverage({ start: 0, end: 20 }, loc), 'full');
  assert.equal(coverage({ start: 10, end: 20 }, loc), 'partial');
  assert.equal(coverage({ start: 18, end: 20 }, loc), 'none');
});
test('cleaning steps', () => {
  assert.equal(fixHyphenation('infor-\nmation'), 'information');
  assert.equal(fixHyphenation('well-known'), 'well-known');
  assert.equal(removeHeadersFooters('ACME — Page 3\nhello\nACME — Page 4\nworld'), 'hello\nworld');
  assert.equal(normaliseWhitespace('a  b\nc\n\n\n\nd'), 'a b c\n\nd');
  assert.equal(normaliseWhitespace('```\n  x = 1\n```\ntext'), '```\n  x = 1\n```\ntext');
});
test('regex sentence fallback', () => {
  assert.deepEqual(splitSentencesRegex('One. Two!\nThree').length, 3);
});
test('content data is well-formed', () => {
  const ids = new Set(GLOSSARY.map((g) => g.id));
  assert.ok(GLOSSARY.length >= 33);
  for (const g of GLOSSARY) for (const r of g.related) assert.ok(ids.has(r), `${g.id} -> missing related ${r}`);
  assert.ok(QUIZ.length >= 6 && QUIZ.length <= 8);
  for (const q of QUIZ) {
    assert.equal(q.options.length, 4);
    assert.ok(q.answer >= 0 && q.answer < 4);
  }
  assert.ok(FLASHCARDS.length >= 12 && FLASHCARDS.length <= 16);
});

runSuite('Fallback tokenizer (~4 chars/token)', estimateTokens);
const real = await loadRealTokenizer();
if (real) runSuite('Real tokenizer (js-tiktoken cl100k_base)', real);
else console.log('\n(js-tiktoken not installed: run `npm install` to also test with the real tokenizer)');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
