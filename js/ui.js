// Small shared UI helpers.

import { highlight } from './highlight.js';

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// localStorage can throw (private mode, blocked storage), so every access is guarded.
const PREFIX = 'chunklab:';
export const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* storage unavailable: progress just won't persist */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
  },
};

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Renders text with each chunk highlighted. Text covered by two chunks
 * (overlap) is hatched; every chunk start gets a numbered badge so colour is
 * never the only signal.
 */
export function renderChunkedText(text, chunks, { badges = true, gold = null } = {}) {
  const cuts = new Set([0, text.length]);
  for (const c of chunks) {
    cuts.add(c.start);
    cuts.add(c.end);
  }
  if (gold) {
    cuts.add(gold.start);
    cuts.add(gold.end);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const startsAt = new Map();
  for (const c of chunks) {
    if (!startsAt.has(c.start)) startsAt.set(c.start, []);
    startsAt.get(c.start).push(c.index);
  }

  let html = '';
  let ci = 0;
  for (let p = 0; p + 1 < points.length; p++) {
    const a = points[p];
    const b = points[p + 1];
    if (b <= a) continue;
    while (ci < chunks.length && chunks[ci].end <= a) ci++;
    const covering = [];
    for (let j = ci; j < chunks.length && chunks[j].start <= a; j++) {
      if (chunks[j].end >= b) covering.push(chunks[j]);
    }
    let seg = escapeHtml(text.slice(a, b));
    if (gold && a >= gold.start && b <= gold.end) seg = `<span class="gold-text">${seg}</span>`;
    const badge = badges && startsAt.has(a) ? startsAt.get(a).map((i) => `<span class="chunk-badge" aria-hidden="true">${i + 1}</span>`).join('') : '';
    if (!covering.length) {
      html += badge + seg;
      continue;
    }
    const newest = covering[covering.length - 1];
    const label = covering.map((c) => c.index + 1).join(' and ');
    const cls = covering.length > 1 ? 'chunk-seg overlap' : 'chunk-seg';
    html += `<span class="${cls}" data-c="${newest.index % 6}" title="Chunk ${label}">${badge}${seg}</span>`;
  }
  return html;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers/contexts without the async clipboard API.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

/** Builds a highlighted code block with a copy button. */
export function codeBlockHtml(code, lang, label = lang) {
  return `<div class="code-block" data-enhanced>
    <div class="code-head"><span>${escapeHtml(label)}</span><button type="button" class="btn btn-sm copy-btn" data-copy>Copy</button></div>
    <pre><code>${highlight(code, lang)}</code></pre>
  </div>`;
}

/** Upgrades static <div class="code-block" data-lang> blocks in the page. */
export function enhanceCodeBlocks(root = document) {
  root.querySelectorAll('.code-block[data-lang]:not([data-enhanced])').forEach((block) => {
    const code = block.querySelector('code').textContent;
    const lang = block.dataset.lang;
    block.outerHTML = codeBlockHtml(code, lang);
  });
}

// One delegated handler serves every copy button on the page.
export function initCopyButtons() {
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    const code = btn.closest('.code-block').querySelector('pre').textContent;
    const ok = await copyText(code);
    btn.textContent = ok ? 'Copied ✓' : 'Copy failed';
    setTimeout(() => (btn.textContent = 'Copy'), 1600);
  });
}

let tip;
/** A single floating tooltip for chart hover/focus. */
export function showTip(target, text) {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.setAttribute('role', 'presentation');
    document.body.appendChild(tip);
  }
  tip.textContent = text;
  tip.hidden = false;
  const r = target.getBoundingClientRect();
  const w = tip.offsetWidth;
  const left = Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2));
  tip.style.left = `${left}px`;
  tip.style.top = `${Math.max(8, r.top - tip.offsetHeight - 8)}px`;
}

export function hideTip() {
  if (tip) tip.hidden = true;
}
