// App entry: theme, navigation and progress, plus the small inline demos.
// The bigger interactives live in their own modules.

import { SITE } from './config.js';
import { loadTokenizer, countTokens, tokenPieces, isApproximate, onTokenizerChange, ENCODING_NAME } from './tokenizer.js';
import { chunkDocument } from './chunkers.js';
import { cleanText, removeHeadersFooters } from './cleaning.js';
import { locateSpan, coverage } from './retrieval.js';
import { evaluateChallenge } from './challenge-core.js';
import { CHALLENGES } from '../data/challenges.js';
import { getDocument } from '../data/documents.js';
import { GUIDE } from '../data/guide.js';
import { escapeHtml, store, renderChunkedText, enhanceCodeBlocks, initCopyButtons } from './ui.js';
import { initGlossary } from './glossary.js';
import { initPlayground } from './playground.js';
import { initChallenges } from './challenges.js';
import { initQuiz } from './quiz.js';
import { initFlashcards } from './flashcards.js';

const $ = (id) => document.getElementById(id);

// One broken widget should never take the whole lesson down.
function safely(name, fn) {
  try {
    return fn();
  } catch (err) {
    console.error(`[${name}] failed to start`, err);
    return null;
  }
}

// ---------------------------------------------------------------- site & theme

function initSite() {
  document.title = `${SITE.title}: ${SITE.subtitle}`;
  document.querySelectorAll('[data-site-title]').forEach((el) => (el.textContent = SITE.title));
  document.querySelectorAll('[data-site-subtitle]').forEach((el) => (el.textContent = SITE.subtitle));
}

function initTheme() {
  const btn = $('theme-toggle');
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const current = () => root.getAttribute('data-theme') || (system.matches ? 'dark' : 'light');
  const paint = () => {
    const dark = current() === 'dark';
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    btn.querySelector('use').setAttribute('href', dark ? '#i-sun' : '#i-moon');
  };
  btn.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    store.set('theme', next);
    paint();
  });
  system.addEventListener?.('change', paint);
  paint();
}

function initPresenter() {
  const btn = $('presenter-toggle');
  const apply = (on) => {
    document.documentElement.classList.toggle('presenter', on);
    btn.setAttribute('aria-pressed', String(on));
  };
  apply(store.get('presenter', false));
  btn.addEventListener('click', () => {
    const on = btn.getAttribute('aria-pressed') !== 'true';
    store.set('presenter', on);
    apply(on);
  });
}

// ---------------------------------------------------------------- progress

function initProgress() {
  const sections = [...document.querySelectorAll('[data-section]')];
  const list = $('toc-list');
  const done = new Set(store.get('progress', []));
  const unmarked = new Set(store.get('progress-unmarked', []));
  const toc = $('toc');
  const tocToggle = document.querySelector('.toc-toggle');

  list.innerHTML = sections
    .map(
      (s, i) => `<li><a href="#${s.id}" data-target="${s.id}"><span class="toc-num" aria-hidden="true">${i}</span><span>${escapeHtml(s.dataset.title)}<span class="visually-hidden" data-done-label></span></span><span class="toc-time">${s.dataset.time}m</span></a></li>`,
    )
    .join('');

  for (const s of sections) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn section-complete';
    btn.dataset.complete = s.id;
    s.appendChild(btn);
  }

  function save() {
    store.set('progress', [...done]);
    store.set('progress-unmarked', [...unmarked]);
  }

  function paint() {
    for (const a of list.querySelectorAll('a')) {
      const isDone = done.has(a.dataset.target);
      a.classList.toggle('done', isDone);
      a.querySelector('[data-done-label]').textContent = isDone ? ' (completed)' : '';
    }
    for (const btn of document.querySelectorAll('[data-complete]')) {
      const isDone = done.has(btn.dataset.complete);
      btn.setAttribute('aria-pressed', String(isDone));
      btn.innerHTML = isDone ? '<svg class="icon" aria-hidden="true"><use href="#i-check"/></svg>Section complete' : 'Mark section as complete';
    }
    const pct = Math.round((100 * done.size) / sections.length);
    const bar = document.querySelector('.progress');
    bar.setAttribute('aria-valuenow', String(pct));
    bar.setAttribute('aria-valuetext', `${done.size} of ${sections.length} sections complete`);
    document.querySelector('.progress-fill').style.width = `${pct}%`;
    document.querySelector('.progress-label').textContent = `${done.size} of ${sections.length} done`;
  }

  function mark(id, on, manual = false) {
    if (on) {
      done.add(id);
      unmarked.delete(id);
    } else {
      done.delete(id);
      if (manual) unmarked.add(id);
    }
    save();
    paint();
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-complete]');
    if (btn) mark(btn.dataset.complete, !done.has(btn.dataset.complete), true);
  });

  // Reaching a section's final "Key idea" counts as finishing it (unless the
  // learner un-ticked it themselves).
  const keyObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = entry.target.closest('[data-section]').id;
        if (!done.has(id) && !unmarked.has(id)) mark(id, true);
      }
    },
    { threshold: 0.9 },
  );
  for (const s of sections) {
    const keys = s.querySelectorAll('.callout.key');
    // Interactive sections are completed by their activity, not by scrolling.
    if (keys.length && !['s-challenges', 's-check'].includes(s.id)) keyObserver.observe(keys[keys.length - 1]);
  }

  // Highlight the section currently on screen.
  const spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        for (const a of list.querySelectorAll('a')) a.setAttribute('aria-current', String(a.dataset.target === entry.target.id));
      }
    },
    { rootMargin: '-35% 0px -60% 0px' },
  );
  sections.forEach((s) => spy.observe(s));

  // Mobile: the TOC is a drop-down menu.
  tocToggle.addEventListener('click', () => {
    const open = !toc.classList.contains('open');
    toc.classList.toggle('open', open);
    tocToggle.setAttribute('aria-expanded', String(open));
  });
  list.addEventListener('click', () => {
    toc.classList.remove('open');
    tocToggle.setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toc.classList.contains('open')) {
      toc.classList.remove('open');
      tocToggle.setAttribute('aria-expanded', 'false');
      tocToggle.focus();
    }
  });

  paint();
  return {
    complete: (id) => mark(id, true),
    reset() {
      done.clear();
      unmarked.clear();
      save();
      paint();
    },
  };
}

// ---------------------------------------------------------------- tokenizer badges

function paintTokenizerBadges(loading) {
  document.querySelectorAll('[data-tokenizer-badge]').forEach((b) => {
    b.classList.toggle('ok', !loading && !isApproximate());
    b.classList.toggle('approx', !loading && isApproximate());
    b.textContent = loading ? 'Loading tokenizer…' : isApproximate() ? 'Approximate tokens (≈ 4 chars each)' : `Real tokenizer: ${ENCODING_NAME}`;
    b.title = isApproximate()
      ? 'The real tokenizer could not be loaded, so token counts are estimated as characters ÷ 4.'
      : 'Token counts use the cl100k_base BPE tokenizer (via js-tiktoken). Other models’ tokenizers give slightly different counts.';
  });
}

// ---------------------------------------------------------------- hook

function initHook() {
  const btn = $('hook-reveal-btn');
  const panel = $('hook-reveal');
  const render = () => {
    const ch = CHALLENGES[0];
    const doc = getDocument(ch.docId);
    const r = evaluateChallenge(ch, ch.start, { countTokens });
    const top = r.retrieved[0];
    if (!top) return;
    const c = top.chunk;
    const loc = r.loc;
    let html;
    if (coverage(c, loc) === 'partial' && c.end < loc.end) {
      const goldStart = Math.max(c.start, loc.start);
      html = `${escapeHtml(doc.text.slice(c.start, goldStart))}<span class="gold-text">${escapeHtml(doc.text.slice(goldStart, c.end))}</span><span class="cut-mark">✂ chunk ends</span><span class="unseen">${escapeHtml(doc.text.slice(c.end, loc.end))}</span>`;
    } else {
      html = escapeHtml(c.text);
    }
    $('hook-chunk').innerHTML = html;
    const words = c.text.split(/\s+/);
    $('hook-cut-words').textContent = `…${words.slice(-7).join(' ')}`;
    const nextRank = r.retrieved.findIndex((x) => x.chunk.index === c.index + 1);
    $('hook-caption').textContent = `This is the top-ranked chunk (fixed-size, ${c.tokens} tokens, no overlap). Green: the start of the rule. Crossed out: the rest of the sentence, which lives in chunk #${c.index + 2}${nextRank > 0 ? `, ranked #${nextRank + 1}` : ', which was not retrieved'}. This bot sends only its single best chunk to the LLM.`;
  };
  btn.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Hide the retrieved chunk' : 'Show what retrieval handed the bot';
    if (open) render();
  });
  onTokenizerChange(() => !panel.hidden && render());
}

// ---------------------------------------------------------------- tokenizer demo

function initTokenizerDemo() {
  const input = $('tok-input');
  const view = $('tok-view');
  const stats = $('tok-stats');
  const render = () => {
    const text = input.value.slice(0, 3000);
    const pieces = tokenPieces(text);
    view.innerHTML = pieces
      .map((p) => {
        const shown = escapeHtml(p.text).replace(/ /g, '<span class="tok-space">·</span>').replace(/\n/g, '<span class="tok-space">↵</span>\n');
        return `<span class="tok">${shown}</span>`;
      })
      .join('');
    const tokens = countTokens(text);
    const words = (text.match(/\S+/g) || []).length;
    const stat = (v, l) => `<li class="stat"><b>${v}</b><span>${l}</span></li>`;
    stats.innerHTML = [
      stat(text.length, 'characters'),
      stat(words, 'words'),
      stat(tokens, isApproximate() ? 'tokens (estimated)' : 'tokens'),
      stat(tokens ? (text.length / tokens).toFixed(1) : '–', 'characters per token'),
    ].join('');
    view.setAttribute('aria-label', `${tokens} tokens`);
  };
  input.addEventListener('input', render);
  onTokenizerChange(render);
  render();
}

// ---------------------------------------------------------------- trade-off demo

function initTradeoff() {
  const pricing = getDocument('pricing').text;
  const text = pricing.slice(pricing.indexOf('### Starter plan'), pricing.indexOf('## Add-ons')).trim();
  const teamStart = text.indexOf('### Team plan');
  const teamEnd = text.indexOf('### Business plan');
  const slider = $('tradeoff-size');
  const render = () => {
    const size = Number(slider.value);
    const { chunks } = chunkDocument(text, { strategy: 'fixed', unit: 'tokens', size, overlap: 0 }, { countTokens, docTitle: 'Pricing' });
    $('tradeoff-size-value').textContent = `${size} tokens · ${chunks.length} chunk${chunks.length === 1 ? '' : 's'}`;
    $('tradeoff-view').innerHTML = renderChunkedText(text, chunks);
    const loc = locateSpan(text, '₹499 per month');
    const holder = chunks.find((c) => coverage(c, loc) === 'full');
    const verdict = $('tradeoff-verdict');
    let cls;
    let msg;
    if (!holder) {
      cls = 'bad';
      msg = '<strong>Too small.</strong> Even the price itself ("₹499 per month") is cut across two chunks.';
    } else if (!/Team/.test(holder.text)) {
      cls = 'bad';
      msg = `<strong>Too small.</strong> Chunk ${holder.index + 1} has the price but never says which plan it belongs to, so a search for "Team plan" can't find it.`;
    } else {
      const inTeam = Math.max(0, Math.min(holder.end, teamEnd) - Math.max(holder.start, teamStart));
      const share = inTeam / (holder.end - holder.start);
      if (share < 0.6) {
        cls = 'warn';
        msg = `<strong>Too big.</strong> Chunk ${holder.index + 1} contains the answer, but only ${Math.round(share * 100)}% of it is about the Team plan. The LLM has to read past other plans, and the chunk's embedding is a blend of all of them.`;
      } else {
        cls = 'good';
        msg = `<strong>About right.</strong> Chunk ${holder.index + 1} names the plan, has the price, and is mostly about the Team plan (${Math.round(share * 100)}%).`;
      }
    }
    verdict.className = `verdict ${cls}`;
    verdict.innerHTML = `<span class="verdict-icon" aria-hidden="true">${cls === 'good' ? '✓' : cls === 'warn' ? '!' : '✗'}</span><span>${msg}</span>`;
  };
  slider.addEventListener('input', render);
  onTokenizerChange(render);
  render();
}

// ---------------------------------------------------------------- strategy minis

const MINI_TEXT = `## Plans
Starter is free for one agent. It keeps 30 days of history.

Team costs ₹499 per month. It includes 5 seats.

| Plan | Seats |
|---|---|
| Team | 5 |
| Business | 20 |`;

function initStrategyMinis() {
  const configs = {
    fixed: { strategy: 'fixed', unit: 'tokens', size: 16, overlap: 4 },
    sentence: { strategy: 'sentence', unit: 'tokens', size: 20, overlap: 0 },
    recursive: { strategy: 'recursive', unit: 'tokens', size: 20, overlap: 0 },
    markdown: { strategy: 'markdown', unit: 'tokens', size: 24, overlap: 0 },
  };
  const render = () => {
    for (const [key, cfg] of Object.entries(configs)) {
      const el = document.querySelector(`[data-mini="${key}"]`);
      if (!el) continue;
      const { chunks } = chunkDocument(MINI_TEXT, cfg, { countTokens, docTitle: 'Pricing' });
      el.innerHTML = renderChunkedText(MINI_TEXT, chunks);
      el.setAttribute('aria-label', `${chunks.length} chunks with ${key} chunking at ${cfg.size} tokens`);
      el.setAttribute('role', 'img');
    }
  };
  onTokenizerChange(render);
  render();
}

// ---------------------------------------------------------------- cleaning demo

function initCleanDemo() {
  const raw = getDocument('messy').text;
  const boxes = [...document.querySelectorAll('[data-clean]')];
  const kept = removeHeadersFooters(raw).split('\n');
  // Mark the noise in the "before" view so learners can see what each step targets.
  let k = 0;
  const beforeHtml = raw
    .split('\n')
    .map((line) => {
      if (kept[k] === line) {
        k++;
        return escapeHtml(line).replace(/(\p{L})-$/u, '$1<mark title="Hyphenated line break">-</mark>');
      }
      return `<span class="unseen" title="Repeated header/footer">${escapeHtml(line)}</span>`;
    })
    .join('\n');
  $('clean-before').innerHTML = beforeHtml;
  const render = () => {
    const enabled = Object.fromEntries(boxes.map((b) => [b.dataset.clean, b.checked]));
    const after = cleanText(raw, enabled);
    $('clean-after').textContent = after;
    const before = countTokens(raw);
    const now = countTokens(after);
    const unit = isApproximate() ? 'tokens (est.)' : 'tokens';
    $('clean-before-count').textContent = `${before} ${unit}`;
    $('clean-after-count').textContent = `${now} ${unit}`;
    const saved = before - now;
    const badge = $('clean-savings');
    badge.textContent = saved > 0 ? `Saved ${saved} tokens (${Math.round((100 * saved) / before)}%)` : 'No cleaning applied yet';
    badge.className = `badge ${saved > 0 ? 'ok' : ''}`;
  };
  boxes.forEach((b) => b.addEventListener('change', render));
  onTokenizerChange(render);
  render();
}

// ---------------------------------------------------------------- decision guide

function initDecisionGuide() {
  const root = $('decision-guide');
  let current = GUIDE[1].id;
  const render = () => {
    const g = GUIDE.find((x) => x.id === current);
    root.innerHTML = `<div class="picker" role="group" aria-label="Document type">${GUIDE.map(
      (x) => `<button type="button" class="chip" aria-pressed="${x.id === current}" data-guide="${x.id}">${escapeHtml(x.label)}</button>`,
    ).join('')}</div>
      <div class="card guide-card" aria-live="polite">
        <h4 style="margin:0 0 12px">${escapeHtml(g.label)}</h4>
        <dl><dt>Strategy</dt><dd>${escapeHtml(g.strategy)}</dd>
        <dt>Start with</dt><dd>${escapeHtml(g.size)}</dd>
        <dt>Why</dt><dd>${escapeHtml(g.why)}</dd>
        <dt>Metadata</dt><dd>${escapeHtml(g.metadata)}</dd></dl>
      </div>
      <details style="margin-top:12px"><summary>See the whole guide as a table</summary>
        <div class="data-table-wrap"><table class="data"><thead><tr><th scope="col">Document type</th><th scope="col">Strategy</th><th scope="col">Start with</th><th scope="col">Why</th></tr></thead>
        <tbody>${GUIDE.map((x) => `<tr><th scope="row">${escapeHtml(x.label)}</th><td>${escapeHtml(x.strategy)}</td><td>${escapeHtml(x.size)}</td><td>${escapeHtml(x.why)}</td></tr>`).join('')}</tbody></table></div>
      </details>`;
  };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-guide]');
    if (!b) return;
    current = b.dataset.guide;
    const open = root.querySelector('details')?.open;
    render();
    if (open) root.querySelector('details').open = true;
    root.querySelector(`[data-guide="${current}"]`).focus();
  });
  render();
}

// ---------------------------------------------------------------- dialogs

function initDialogs() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-close-dialog]')) e.target.closest('dialog').close();
  });
  // Clicking the backdrop closes a modal dialog.
  document.querySelectorAll('dialog').forEach((d) =>
    d.addEventListener('click', (e) => {
      if (e.target === d) d.close();
    }),
  );
}

// ---------------------------------------------------------------- start

function start() {
  safely('site', initSite);
  safely('theme', initTheme);
  safely('presenter', initPresenter);
  const progress = safely('progress', initProgress);
  safely('glossary', initGlossary);
  safely('code', () => {
    enhanceCodeBlocks();
    initCopyButtons();
  });
  safely('dialogs', initDialogs);
  paintTokenizerBadges(true);
  safely('hook', initHook);
  safely('tokenizer demo', initTokenizerDemo);
  safely('trade-off demo', initTradeoff);
  safely('strategy previews', initStrategyMinis);
  safely('cleaning demo', initCleanDemo);
  safely('decision guide', initDecisionGuide);
  safely('playground', () => initPlayground($('lab')));
  const challenges = safely('challenges', () =>
    initChallenges($('challenges'), $('challenge-summary'), () => progress?.complete('s-challenges')),
  );
  const quiz = safely('quiz', () => initQuiz($('quiz'), () => progress?.complete('s-check')));
  safely('flashcards', () => initFlashcards($('flashcards')));
  paintTokenizerBadges(true);

  $('reset-progress')?.addEventListener('click', () => {
    if (!window.confirm('Reset your saved progress, challenge results and quiz answers?')) return;
    progress?.reset();
    challenges?.reset();
    quiz?.reset();
  });

  loadTokenizer().then(() => paintTokenizerBadges(false));
}

start();
