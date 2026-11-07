// Pure chunking functions. Nothing in this file touches the DOM, so every
// strategy can be unit-tested in Node (see tests/run.mjs).
//
// Every chunker works on *spans* ([start, end) character offsets into the
// source text) instead of copying strings around. Spans let the UI highlight
// chunks in the original document, show overlap regions, and let the tests
// prove that no text was lost.

export const DEFAULT_SEPARATORS = ['\n\n', '\n', '. ', ' ', ''];

export const STRATEGY_LABELS = {
  fixed: 'Fixed-size',
  sentence: 'Sentence',
  recursive: 'Recursive',
  markdown: 'Structure-aware (Markdown)',
  semantic: 'Semantic',
};

const WS = /\s/;

/** Measures text in characters or tokens. */
export function makeLength(unit, countTokens) {
  return unit === 'chars' ? (s) => s.length : countTokens;
}

/** Shrinks a span so it does not start or end with whitespace. */
export function trimSpan(text, start, end) {
  while (start < end && WS.test(text[start])) start++;
  while (end > start && WS.test(text[end - 1])) end--;
  return [start, end];
}

// Never cut between the two halves of a UTF-16 surrogate pair (emoji etc.).
function isLowSurrogate(text, i) {
  const c = text.charCodeAt(i);
  return c >= 0xdc00 && c <= 0xdfff;
}

function nextBoundary(text, i) {
  let j = i + 1;
  if (j < text.length && isLowSurrogate(text, j)) j++;
  return j;
}

function snapBack(text, i, floor) {
  if (i > floor && i < text.length && isLowSurrogate(text, i)) return i - 1;
  return i;
}

// ---------------------------------------------------------------------------
// Fixed-size
// ---------------------------------------------------------------------------

// Largest `end` such that text[start:end] measures <= size.
// Binary search works for both characters and BPE tokens because the length
// of a prefix only grows (or stays flat) as the prefix gets longer.
function longestFit(text, start, size, len) {
  const n = text.length;
  let hi = Math.min(n, start + size * 8);
  // Rare case: lots of text per token (long runs of spaces). Widen the window.
  while (hi < n && len(text.slice(start, hi)) <= size) hi = Math.min(n, start + (hi - start) * 2);
  let lo = start + 1;
  let best = start;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (len(text.slice(start, mid)) <= size) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  best = snapBack(text, best, start);
  // A single character larger than the limit: take it anyway so we make progress.
  return best > start ? best : nextBoundary(text, start);
}

// Smallest `s` in [lo, end] such that text[s:end] measures <= maxLen.
function shortestTail(text, lo, end, maxLen, len) {
  let hi = end;
  let best = end;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (len(text.slice(mid, end)) <= maxLen) {
      best = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return snapBack(text, best, 0);
}

// Chunks start at non-whitespace. With BPE, " word" and "word" can be a
// different number of tokens, so measuring an untrimmed span would be off by one.
function skipWhitespace(text, i) {
  while (i < text.length && WS.test(text[i])) i++;
  return i;
}

export function fixedSpans(text, size, overlap, len) {
  const spans = [];
  let start = skipWhitespace(text, 0);
  while (start < text.length) {
    const end = longestFit(text, start, size, len);
    spans.push([start, end]);
    if (end >= text.length) break;
    // Step back so the next chunk re-reads the last `overlap` units.
    let next = end;
    if (overlap > 0) next = Math.max(nextBoundary(text, start), shortestTail(text, start + 1, end, overlap, len));
    start = skipWhitespace(text, next);
  }
  return spans.map((span) => ({ span }));
}

// ---------------------------------------------------------------------------
// Sentences
// ---------------------------------------------------------------------------

/** Splits text into sentence spans. Uses Intl.Segmenter when available. */
export function splitSentences(text) {
  const out = [];
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const seg = new Intl.Segmenter('en', { granularity: 'sentence' });
    for (const { index, segment } of seg.segment(text)) {
      // The segmenter does not always break at a single newline, but headings,
      // list items and table rows are separate units, so split lines too.
      let lineStart = index;
      const segEnd = index + segment.length;
      for (let i = index; i <= segEnd; i++) {
        if (i === segEnd || text[i] === '\n') {
          const [s, e] = trimSpan(text, lineStart, i);
          if (e > s) out.push([s, e]);
          lineStart = i + 1;
        }
      }
    }
    return out;
  }
  return splitSentencesRegex(text);
}

/** Fallback sentence splitter: break after . ! ? followed by whitespace, or at a newline. */
export function splitSentencesRegex(text) {
  const out = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const endsSentence = /[.!?]/.test(ch) && (i + 1 === text.length || WS.test(text[i + 1]));
    if (endsSentence || ch === '\n') {
      const [s, e] = trimSpan(text, start, i + 1);
      if (e > s) out.push([s, e]);
      start = i + 1;
    }
  }
  const [s, e] = trimSpan(text, start, text.length);
  if (e > s) out.push([s, e]);
  return out;
}

export function sentenceSpans(text, size, overlap, len, sentences = splitSentences(text)) {
  const out = [];
  const m = (a, b) => len(text.slice(a, b));
  let group = [];
  const flush = () => {
    if (group.length) out.push({ span: [group[0][0], group[group.length - 1][1]] });
  };
  for (const sent of sentences) {
    if (m(sent[0], sent[1]) > size) {
      // One sentence is bigger than the limit: fall back to word-level splitting.
      flush();
      group = [];
      for (const s of recursiveSpans(text, sent[0], sent[1], [' ', ''], size, overlap, len)) out.push(s);
      continue;
    }
    if (group.length && m(group[0][0], sent[1]) > size) {
      flush();
      // Overlap works in whole sentences: carry the last sentences forward
      // as long as they fit within the overlap budget.
      const last = group[group.length - 1][1];
      let carry = [];
      for (let i = group.length - 1; i >= 0; i--) {
        if (m(group[i][0], last) > overlap) break;
        if (m(group[i][0], sent[1]) > size) break;
        carry = group.slice(i);
      }
      group = carry;
    }
    group.push(sent);
  }
  flush();
  return out;
}

// ---------------------------------------------------------------------------
// Recursive character splitting
// ---------------------------------------------------------------------------

// Splits [s, e) on `sep`, keeping the separator at the END of each piece so
// sentences keep their full stop and nothing is dropped.
function splitKeepEnd(text, s, e, sep) {
  const pieces = [];
  if (sep === '') {
    for (let i = s; i < e; ) {
      const j = nextBoundary(text, i);
      pieces.push([i, Math.min(j, e)]);
      i = j;
    }
    return pieces;
  }
  let cur = s;
  let idx = text.indexOf(sep, cur);
  while (idx !== -1 && idx + sep.length <= e) {
    pieces.push([cur, idx + sep.length]);
    cur = idx + sep.length;
    idx = text.indexOf(sep, cur);
  }
  if (cur < e) pieces.push([cur, e]);
  return pieces;
}

// Greedily joins neighbouring pieces up to `size`, carrying up to `overlap`
// into the next chunk (same idea as LangChain's _merge_splits).
function mergePieces(text, pieces, size, overlap, len) {
  const out = [];
  const m = (a, b) => len(text.slice(a, b));
  let cur = [];
  for (const p of pieces) {
    if (cur.length && m(cur[0][0], p[1]) > size) {
      out.push({ span: [cur[0][0], cur[cur.length - 1][1]] });
      while (cur.length && (m(cur[0][0], cur[cur.length - 1][1]) > overlap || m(cur[0][0], p[1]) > size)) {
        cur.shift();
      }
    }
    cur.push(p);
  }
  if (cur.length) out.push({ span: [cur[0][0], cur[cur.length - 1][1]] });
  return out;
}

export function recursiveSpans(text, s, e, separators, size, overlap, len) {
  const chunk = text.slice(s, e);
  let idx = separators.findIndex((sep) => sep === '' || chunk.includes(sep));
  if (idx === -1) idx = separators.length - 1;
  const sep = separators[idx];
  const finer = separators.slice(idx + 1);

  const out = [];
  let good = [];
  for (const piece of splitKeepEnd(text, s, e, sep)) {
    if (len(text.slice(piece[0], piece[1])) <= size) {
      good.push(piece);
      continue;
    }
    if (good.length) {
      out.push(...mergePieces(text, good, size, overlap, len));
      good = [];
    }
    if (finer.length) out.push(...recursiveSpans(text, piece[0], piece[1], finer, size, overlap, len));
    else out.push({ span: piece });
  }
  if (good.length) out.push(...mergePieces(text, good, size, overlap, len));
  return out;
}

// ---------------------------------------------------------------------------
// Structure-aware (Markdown)
// ---------------------------------------------------------------------------

/** Parses Markdown into blocks: heading, code (fenced), table, para. */
export function parseMarkdownBlocks(text) {
  const lines = [];
  let pos = 0;
  for (;;) {
    const nl = text.indexOf('\n', pos);
    const end = nl === -1 ? text.length : nl;
    lines.push({ start: pos, end, text: text.slice(pos, end) });
    if (nl === -1) break;
    pos = nl + 1;
  }

  const blocks = [];
  const special = /^(```|~~~|#{1,6}\s|\|)/;
  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    const t = line.text.trim();
    if (t === '') {
      i++;
      continue;
    }
    if (t.startsWith('```') || t.startsWith('~~~')) {
      const fence = t.slice(0, 3);
      let j = i + 1;
      while (j < lines.length && !lines[j].text.trim().startsWith(fence)) j++;
      const last = lines[Math.min(j, lines.length - 1)];
      blocks.push({ type: 'code', start: line.start, end: last.end });
      i = j + 1;
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(t);
    if (h) {
      blocks.push({ type: 'heading', level: h[1].length, title: h[2].replace(/\s#+\s*$/, '').trim(), start: line.start, end: line.end });
      i++;
      continue;
    }
    if (t.startsWith('|')) {
      let j = i;
      while (j + 1 < lines.length && lines[j + 1].text.trim().startsWith('|')) j++;
      blocks.push({ type: 'table', start: line.start, end: lines[j].end });
      i = j + 1;
      continue;
    }
    let j = i;
    while (j + 1 < lines.length) {
      const next = lines[j + 1].text.trim();
      if (next === '' || special.test(next)) break;
      j++;
    }
    blocks.push({ type: 'para', start: line.start, end: lines[j].end });
    i = j + 1;
  }
  return blocks;
}

export function markdownSpans(text, size, overlap, len) {
  const m = (a, b) => len(text.slice(a, b));
  const blocks = parseMarkdownBlocks(text);

  // 1. Group blocks into sections that start at #, ## or ### headings.
  const sections = [];
  let current = null;
  for (const b of blocks) {
    if (b.type === 'heading' && b.level <= 3) {
      current = [b];
      sections.push(current);
    } else {
      if (!current) {
        current = [];
        sections.push(current);
      }
      current.push(b);
    }
  }

  const out = [];
  const recurse = (s, e) => out.push(...recursiveSpans(text, s, e, DEFAULT_SEPARATORS, size, overlap, len));

  for (const sec of sections) {
    const s = sec[0].start;
    const e = sec[sec.length - 1].end;
    // 2. A section that fits is one chunk: the ideal case.
    if (m(s, e) <= size) {
      out.push({ span: [s, e] });
      continue;
    }
    // 3. Too big: pack whole blocks together. Tables and code are never cut.
    let group = null; // { s, e, headingOnly }
    const flush = () => {
      if (group) out.push({ span: [group.s, group.e] });
      group = null;
    };
    for (const b of sec) {
      const atomic = b.type === 'code' || b.type === 'table';
      if (group && m(group.s, b.end) <= size) {
        group.e = b.end;
        group.headingOnly = group.headingOnly && b.type === 'heading';
        continue;
      }
      const headingOnly = group && group.headingOnly;
      if (atomic && (headingOnly || m(b.start, b.end) > size)) {
        // Keep a heading attached to its table/code even if that breaks the limit.
        const from = headingOnly ? group.s : b.start;
        if (!headingOnly) flush();
        group = null;
        const fits = m(from, b.end) <= size;
        out.push(fits ? { span: [from, b.end] } : { span: [from, b.end], oversize: true });
        continue;
      }
      if (!atomic && m(b.start, b.end) > size) {
        const from = headingOnly ? group.s : b.start;
        if (!headingOnly) flush();
        group = null;
        recurse(from, b.end);
        continue;
      }
      if (headingOnly) {
        // Heading + a paragraph that doesn't quite fit: split them together
        // so the heading never ends up alone in a chunk.
        const from = group.s;
        group = null;
        recurse(from, b.end);
        continue;
      }
      flush();
      group = { s: b.start, e: b.end, headingOnly: b.type === 'heading' };
    }
    flush();
  }
  return out;
}

// ---------------------------------------------------------------------------
// Semantic chunking (embeddings are computed elsewhere; this part is pure)
// ---------------------------------------------------------------------------

export function cosineSimilarity(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Linear-interpolated percentile (0-100), same definition as numpy's default. */
export function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

/**
 * Starts a new chunk where the cosine distance between neighbouring sentences
 * is above the given percentile, then enforces the max size.
 * Returns { spans, distances, threshold } so the UI can plot the breakpoints.
 */
export function semanticSpans(text, sentences, embeddings, { percentileThreshold = 95, size, overlap = 0, len }) {
  const distances = [];
  for (let i = 0; i + 1 < sentences.length; i++) {
    distances.push(1 - cosineSimilarity(embeddings[i], embeddings[i + 1]));
  }
  const threshold = percentile(distances, percentileThreshold);
  const groups = [];
  let cur = [];
  sentences.forEach((sent, i) => {
    cur.push(sent);
    if (i < distances.length && distances[i] > threshold) {
      groups.push(cur);
      cur = [];
    }
  });
  if (cur.length) groups.push(cur);

  const spans = [];
  for (const g of groups) {
    // A topic that is too long still has to respect the size limit.
    spans.push(...sentenceSpans(text, size, overlap, len, g));
  }
  return { spans, distances, threshold };
}

// ---------------------------------------------------------------------------
// Putting it together
// ---------------------------------------------------------------------------

/** Headings (# to ###) with their offsets, used to build section paths. */
export function headingIndex(text) {
  return parseMarkdownBlocks(text).filter((b) => b.type === 'heading' && b.level <= 3);
}

export function headingPathAt(headings, pos) {
  const stack = [];
  for (const h of headings) {
    if (h.start > pos) break;
    while (stack.length && stack[stack.length - 1].level >= h.level) stack.pop();
    stack.push(h);
  }
  return stack.map((h) => h.title);
}

const SENTENCE_END = /[.!?:;)"'”’`|*]$/;

// A chunk "ends mid-sentence" if its last character is not sentence-ending
// punctuation and the text carries on on the same line.
function endsMidSentence(text, end) {
  const before = text.slice(Math.max(0, end - 3), end);
  if (SENTENCE_END.test(before)) return false;
  let i = end;
  while (i < text.length && (text[i] === ' ' || text[i] === '\t')) i++;
  if (i >= text.length || text[i] === '\n' || text[i] === '\r') return false;
  return true;
}

/**
 * Chunks a document and returns chunk objects ready for display and retrieval.
 *
 * config: { strategy, unit: 'tokens'|'chars', size, overlap, contextHeader, percentile }
 * ctx:    { countTokens, docTitle, semantic: { sentences, embeddings } }
 */
export function chunkDocument(text, config, ctx) {
  const unit = config.unit === 'chars' ? 'chars' : 'tokens';
  const len = makeLength(unit, ctx.countTokens);
  const size = Math.max(1, Math.floor(config.size));
  // Overlap must be smaller than the chunk size, or a chunk would never move forward.
  const overlap = Math.max(0, Math.min(Math.floor(config.overlap || 0), size - 1));

  let raw;
  let semanticInfo = null;
  switch (config.strategy) {
    case 'fixed':
      raw = fixedSpans(text, size, overlap, len);
      break;
    case 'sentence':
      raw = sentenceSpans(text, size, overlap, len);
      break;
    case 'recursive':
      raw = recursiveSpans(text, 0, text.length, DEFAULT_SEPARATORS, size, overlap, len);
      break;
    case 'markdown':
      raw = markdownSpans(text, size, overlap, len);
      break;
    case 'semantic': {
      if (!ctx.semantic) throw new Error('Semantic chunking needs sentence embeddings.');
      semanticInfo = semanticSpans(text, ctx.semantic.sentences, ctx.semantic.embeddings, {
        percentileThreshold: config.percentile ?? 95,
        size,
        overlap,
        len,
      });
      raw = semanticInfo.spans;
      break;
    }
    default:
      throw new Error(`Unknown strategy: ${config.strategy}`);
  }

  const headings = headingIndex(text);
  const chunks = [];
  let prevEnd = -1;
  for (const r of raw) {
    const [start, end] = trimSpan(text, r.span[0], r.span[1]);
    if (end <= start) continue;
    const last = chunks[chunks.length - 1];
    if (last && last.start === start && last.end === end) continue;
    const body = text.slice(start, end);
    const path = headingPathAt(headings, start);
    const header = path.length ? path.join(' › ') : ctx.docTitle || 'Document';
    const retrievalText = config.contextHeader ? `${header}\n${body}` : body;
    chunks.push({
      index: chunks.length,
      start,
      end,
      text: body,
      chars: body.length,
      tokens: ctx.countTokens(body),
      size: len(body),
      headingPath: path,
      header,
      retrievalText,
      retrievalTokens: config.contextHeader ? ctx.countTokens(retrievalText) : ctx.countTokens(body),
      overlapChars: prevEnd > start ? prevEnd - start : 0,
      endsMidSentence: endsMidSentence(text, end),
      oversize: Boolean(r.oversize) || len(body) > size,
    });
    prevEnd = Math.max(prevEnd, end);
  }
  return { chunks, size, overlap, unit, semanticInfo };
}

/** Summary numbers for the stats bar. */
export function chunkStats(chunks) {
  if (!chunks.length) return { count: 0, avg: 0, min: 0, max: 0, totalTokens: 0, midSentencePct: 0 };
  const t = chunks.map((c) => c.tokens);
  const total = t.reduce((a, b) => a + b, 0);
  return {
    count: chunks.length,
    avg: Math.round(total / chunks.length),
    min: Math.min(...t),
    max: Math.max(...t),
    totalTokens: chunks.reduce((a, c) => a + c.retrievalTokens, 0),
    midSentencePct: Math.round((100 * chunks.filter((c) => c.endsMidSentence).length) / chunks.length),
  };
}
