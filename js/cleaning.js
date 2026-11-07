// Text cleaning applied before chunking. Each step is a small pure function
// so the "Clean this text" demo can toggle them one at a time.

/**
 * Removes repeated header/footer lines. A line counts as a header/footer if
 * it appears on 2+ pages once digits are ignored ("Page 3" == "Page 4"), or
 * if it is just a page number.
 */
export function removeHeadersFooters(text) {
  const lines = text.split('\n');
  const key = (l) => l.trim().replace(/\d+/g, '#');
  const counts = new Map();
  for (const l of lines) {
    const k = key(l);
    if (k && k.length <= 90) counts.set(k, (counts.get(k) || 0) + 1);
  }
  const pageNumber = /^(page\s*)?#(\s*(of|\/)\s*#)?$/i;
  return lines
    .filter((l) => {
      const k = key(l);
      if (!k) return true;
      // Headings and table rows repeat legitimately, so never treat them as boilerplate.
      if (/^(#|\|)/.test(l.trim())) return true;
      return !(counts.get(k) >= 2 || pageNumber.test(k));
    })
    .join('\n');
}

/** Joins words that a PDF broke across lines: "infor-\nmation" -> "information". */
export function fixHyphenation(text) {
  return text.replace(/(\p{L})-[ \t]*\n[ \t]*(\p{Ll})/gu, '$1$2');
}

/**
 * Collapses runs of spaces, trims line ends, unwraps hard line breaks inside
 * paragraphs, and limits blank lines to one.
 */
export function normaliseWhitespace(text) {
  const out = [];
  let inFence = false;
  for (const rawLine of text.replace(/\r\n?/g, '\n').split('\n')) {
    // Code blocks are left exactly as they are: indentation matters there.
    if (/^\s*(```|~~~)/.test(rawLine)) {
      inFence = !inFence;
      out.push(rawLine.trim());
      continue;
    }
    if (inFence) {
      out.push(rawLine);
      continue;
    }
    const line = rawLine.replace(/[ \t ]+/g, ' ').trim();
    const prev = out[out.length - 1];
    const startsBlock = /^(#{1,6}\s|[-*•]\s|\d+[.)]\s|\|)/.test(line);
    const prevIsBlockLine = prev !== undefined && /^(#{1,6}\s|\||```|~~~)/.test(prev);
    if (line && prev && !startsBlock && !prevIsBlockLine) {
      out[out.length - 1] = `${prev} ${line}`; // same paragraph: unwrap the line break
    } else {
      out.push(line);
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export const CLEANING_STEPS = [
  { id: 'headers', label: 'Remove headers/footers', fn: removeHeadersFooters },
  { id: 'hyphenation', label: 'Fix hyphenation', fn: fixHyphenation },
  { id: 'whitespace', label: 'Normalise whitespace', fn: normaliseWhitespace },
];

/** Applies the enabled steps in a fixed, sensible order. */
export function cleanText(text, enabled = { headers: true, hyphenation: true, whitespace: true }) {
  return CLEANING_STEPS.reduce((t, step) => (enabled[step.id] ? step.fn(t) : t), text);
}
