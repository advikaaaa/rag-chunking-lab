// Token counting. Loads a real BPE tokenizer (js-tiktoken, cl100k_base) from a
// CDN. If that fails (offline, CDN blocked), it falls back to the common
// "about 4 characters per token" estimate and the UI shows an "approximate" badge.

const VERSION = '1.0.21';
const LITE_URL = `https://cdn.jsdelivr.net/npm/js-tiktoken@${VERSION}/lite/+esm`;
const RANKS_URL = `https://cdn.jsdelivr.net/npm/js-tiktoken@${VERSION}/ranks/cl100k_base/+esm`;

export const ENCODING_NAME = 'cl100k_base';

let encoder = null;
let loadPromise = null;
const cache = new Map();
const listeners = new Set();

/** Rough estimate used when the real tokenizer is unavailable. */
export function estimateTokens(text) {
  return text.length === 0 ? 0 : Math.ceil(text.length / 4);
}

/** Lets tests (or other code) plug in an encoder directly. */
export function setEncoder(enc) {
  encoder = enc;
  cache.clear();
  listeners.forEach((fn) => fn());
}

export function isApproximate() {
  return encoder === null;
}

function encode(text) {
  // Treat special-token strings like "<|endoftext|>" as ordinary text.
  return encoder.encode(text, [], []);
}

export function countTokens(text) {
  if (!encoder) return estimateTokens(text);
  if (text.length === 0) return 0;
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  const n = encode(text).length;
  if (cache.size > 20000) cache.clear();
  cache.set(text, n);
  return n;
}

/**
 * Splits text into displayable token pieces for the tokenizer demo.
 * A single token can be part of a multi-byte character (e.g. "₹"), so tokens
 * are grouped until they decode to clean text.
 */
export function tokenPieces(text) {
  if (!encoder) {
    // Approximate view: words and spaces, cut into 4-character pieces.
    return (text.match(/\s*\S{1,4}|\s+/g) || []).map((t) => ({ text: t, approx: true }));
  }
  const ids = encode(text);
  const pieces = [];
  let pending = [];
  for (const id of ids) {
    pending.push(id);
    const s = encoder.decode(pending);
    if (!s.includes('�')) {
      pieces.push({ text: s, ids: pending });
      pending = [];
    }
  }
  if (pending.length) pieces.push({ text: encoder.decode(pending), ids: pending });
  return pieces;
}

/** Calls `fn` whenever the tokenizer changes (so the UI can re-render). */
export function onTokenizerChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

/** Loads the real tokenizer once. Resolves to true on success, false on fallback. */
export function loadTokenizer() {
  if (!loadPromise) {
    loadPromise = withTimeout(Promise.all([import(LITE_URL), import(RANKS_URL)]), 20000)
      .then(([lite, ranks]) => {
        setEncoder(new lite.Tiktoken(ranks.default));
        return true;
      })
      .catch((err) => {
        console.warn('Tokenizer failed to load, using the ~4 chars/token estimate.', err);
        return false;
      });
  }
  return loadPromise;
}
