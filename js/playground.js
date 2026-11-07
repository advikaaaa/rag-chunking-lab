// Chunk Lab: the main playground. Chunk a document with up to two configs,
// inspect the chunks, test retrieval, evaluate hit rate@k and export code.

import { chunkDocument, chunkStats, splitSentences, STRATEGY_LABELS } from './chunkers.js';
import { buildBM25, locateSpan, coverage, evaluate, rankByCosine, searchTerms } from './retrieval.js';
import { cleanText } from './cleaning.js';
import { countTokens, onTokenizerChange } from './tokenizer.js';
import { DOCUMENTS } from '../data/documents.js';
import { escapeHtml, debounce, renderChunkedText, codeBlockHtml, showTip, hideTip } from './ui.js';
import { generateCode } from './codegen.js';
import * as semantic from './semantic.js';

const SIZE_RANGE = {
  tokens: { min: 20, max: 1000, step: 5 },
  chars: { min: 50, max: 4000, step: 25 },
};
const STRATEGIES = ['fixed', 'sentence', 'recursive', 'markdown', 'semantic'];
const STRATEGY_HELP = {
  fixed: 'Cuts every N units, ignoring sentences and structure.',
  sentence: 'Packs whole sentences up to the limit. Overlap is whole sentences.',
  recursive: 'Splits on \\n\\n → \\n → ". " → " " → characters, only as fine as needed.',
  markdown: 'Splits at #–### headings, keeps tables and code blocks whole. Overlap only applies when a long paragraph is sub-split.',
  semantic: 'Breaks where neighbouring sentences are least similar (needs a small embedding model).',
};
const MARK_TEXT = {
  full: '✅ Contains the full answer',
  partial: '⚠️ Contains part of the answer',
  none: '❌ Does not contain the answer',
};

const overlapOf = (cfg) => Math.min(cfg.size - 1, Math.round((cfg.size * cfg.overlapPct) / 100));

export function initPlayground(root) {
  if (!root) return;

  const state = {
    docId: 'refund',
    custom: '',
    clean: false,
    compare: false,
    configs: [
      { strategy: 'fixed', unit: 'tokens', size: 120, overlapPct: 0, contextHeader: false, percentile: 95 },
      { strategy: 'recursive', unit: 'tokens', size: 120, overlapPct: 15, contextHeader: false, percentile: 95 },
    ],
    views: ['doc', 'doc'],
    question: DOCUMENTS[0].questions[0].q,
    topK: 3,
    method: 'bm25',
    evalShown: false,
  };
  const results = [null, null];
  const sentenceEmbeddings = new Map(); // text -> { sentences, embeddings }
  let modelState = semantic.isModelReady() ? 'ready' : 'idle'; // idle | loading | ready | error
  let modelProgress = 0;
  let retrievalRun = 0;

  const doc = () => DOCUMENTS.find((d) => d.id === state.docId);
  const docText = () => {
    const base = state.docId === 'custom' ? state.custom : doc().text;
    return state.clean ? cleanText(base) : base;
  };
  const docTitle = () => (state.docId === 'custom' ? 'Your document' : doc().title);
  const questions = () => (state.docId === 'custom' ? [] : doc().questions);
  const activeConfigs = () => (state.compare ? [0, 1] : [0]);

  // ---------------------------------------------------------------- markup

  root.innerHTML = `
    <div class="lab-toolbar">
      <div class="field">
        <label for="lab-doc">Document</label>
        <select id="lab-doc">
          ${DOCUMENTS.map((d) => `<option value="${d.id}">${escapeHtml(d.title)} (${escapeHtml(d.kind)})</option>`).join('')}
          <option value="custom">Paste your own text…</option>
        </select>
      </div>
      <label class="check"><input type="checkbox" id="lab-clean"> Clean text first</label>
      <label class="check"><input type="checkbox" id="lab-compare"> Compare mode</label>
      <span class="badge" data-tokenizer-badge>Loading tokenizer…</span>
    </div>
    <div class="lab-custom" hidden>
      <label for="lab-custom-text">Your text (Markdown headings and tables are understood by the structure-aware strategy)</label>
      <textarea id="lab-custom-text" rows="8" placeholder="Paste a policy, an article or some Markdown here…"></textarea>
    </div>
    <div class="lab-configs">${[0, 1].map(configHtml).join('')}</div>
    <div class="retrieval">
      <h3>Retrieval tester</h3>
      <p class="small muted" style="margin:0 0 10px">Ask a question about the document. The top-k chunks are what a RAG app would paste into the LLM's prompt.</p>
      <div class="ask-row">
        <div class="field"><label for="lab-q">Question</label><input type="text" id="lab-q" autocomplete="off"></div>
        <div class="field narrow"><label for="lab-k">Top-k</label>
          <select id="lab-k">${[1, 2, 3, 4, 5].map((k) => `<option value="${k}" ${k === 3 ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
        <div class="field method"><label for="lab-method">Retrieval</label>
          <select id="lab-method"><option value="bm25">BM25 (keywords)</option><option value="semantic" disabled>Semantic (load the model first)</option></select></div>
      </div>
      <ul class="suggestions" id="lab-suggestions" aria-label="Suggested questions"></ul>
      <div class="results-grid" id="lab-results" aria-live="polite"></div>
      <div class="eval-panel">
        <h3 style="margin-top:20px">Evaluate this chunking</h3>
        <p class="small muted" style="margin:0 0 10px">Runs every preset question for this document and checks whether a top-k chunk fully contains its known answer.</p>
        <button type="button" class="btn" id="lab-eval-btn">Run all questions</button>
        <div id="lab-eval" aria-live="polite"></div>
      </div>
    </div>
    <div class="lab-footer">
      <button type="button" class="btn" data-export="0">Export A as code</button>
      <button type="button" class="btn" data-export="1" hidden>Export B as code</button>
      <button type="button" class="btn btn-ghost" id="lab-reset">Reset the lab</button>
    </div>`;

  function configHtml(i) {
    const name = i === 0 ? 'A' : 'B';
    return `
      <div class="lab-config" data-i="${i}" ${i === 1 ? 'hidden' : ''}>
        <h3 class="config-title"><span><span class="config-tag" aria-hidden="true">${name}</span>Configuration ${name}</span></h3>
        <div class="controls-grid">
          <fieldset class="segmented span-all">
            <legend>Strategy</legend>
            ${STRATEGIES.map(
              (s) => `<label><input type="radio" name="strategy-${i}" value="${s}" data-k="strategy"><span>${STRATEGY_LABELS[s].replace(' (Markdown)', '')}</span></label>`,
            ).join('')}
          </fieldset>
          <p class="small muted span-all" data-role="help" style="margin:-6px 0 0"></p>
          <fieldset class="segmented">
            <legend>Measure size in</legend>
            <label><input type="radio" name="unit-${i}" value="tokens" data-k="unit"><span>Tokens</span></label>
            <label><input type="radio" name="unit-${i}" value="chars" data-k="unit"><span>Characters</span></label>
          </fieldset>
          <div class="field">
            <div class="field-row"><label for="size-${i}">Chunk size</label><span class="field-value" data-role="size-value"></span></div>
            <input type="range" id="size-${i}" data-k="size">
            <label class="visually-hidden" for="size-num-${i}">Chunk size (number)</label>
            <input type="number" id="size-num-${i}" data-k="size" style="max-width:120px;min-height:36px;padding:4px 8px">
          </div>
          <div class="field">
            <div class="field-row"><label for="overlap-${i}">Overlap</label><span class="field-value" data-role="overlap-value"></span></div>
            <input type="range" id="overlap-${i}" min="0" max="50" step="5" data-k="overlapPct">
            <span class="small muted">0–50% of the chunk size (always smaller than the size).</span>
          </div>
          <div class="field" data-role="percentile" hidden>
            <div class="field-row"><label for="pct-${i}">Breakpoint percentile</label><span class="field-value" data-role="pct-value"></span></div>
            <input type="range" id="pct-${i}" min="80" max="99" step="1" data-k="percentile">
            <span class="small muted">Lower = more breaks = more, smaller chunks.</span>
          </div>
          <label class="check"><input type="checkbox" data-k="contextHeader"> Add contextual header <span class="small muted">(Doc › Section)</span></label>
        </div>
        <div class="semantic-panel" data-role="semantic" hidden></div>
        <ul class="stat-row lab-stats" data-role="stats"></ul>
        <div class="histogram" data-role="hist"></div>
        <div class="distance-plot" data-role="dist" hidden></div>
        <div class="tabs view-tabs" role="tablist" aria-label="Chunk view for configuration ${name}">
          <button type="button" class="tab" role="tab" id="tab-doc-${i}" aria-controls="view-${i}" data-view="doc">Highlighted document</button>
          <button type="button" class="tab" role="tab" id="tab-cards-${i}" aria-controls="view-${i}" data-view="cards">Chunk cards</button>
        </div>
        <div id="view-${i}" role="tabpanel" data-role="view" tabindex="0"></div>
      </div>`;
  }

  const $ = (sel) => root.querySelector(sel);
  const cfgEl = (i) => root.querySelector(`.lab-config[data-i="${i}"]`);

  // ---------------------------------------------------------------- controls

  function syncControls(i) {
    const cfg = state.configs[i];
    const el = cfgEl(i);
    const range = SIZE_RANGE[cfg.unit];
    el.querySelector(`input[name="strategy-${i}"][value="${cfg.strategy}"]`).checked = true;
    el.querySelector(`input[name="unit-${i}"][value="${cfg.unit}"]`).checked = true;
    for (const input of el.querySelectorAll('[data-k="size"]')) {
      Object.assign(input, { min: range.min, max: range.max, step: range.step });
      if (document.activeElement !== input) input.value = cfg.size;
    }
    el.querySelector('[data-k="overlapPct"]').value = cfg.overlapPct;
    el.querySelector('[data-k="percentile"]').value = cfg.percentile;
    el.querySelector('[data-k="contextHeader"]').checked = cfg.contextHeader;
    const unitWord = cfg.unit === 'chars' ? 'characters' : 'tokens';
    el.querySelector('[data-role="size-value"]').textContent = `${cfg.size} ${unitWord}`;
    el.querySelector('[data-role="overlap-value"]').textContent = `${cfg.overlapPct}% · ${overlapOf(cfg)} ${unitWord}`;
    el.querySelector('[data-role="pct-value"]').textContent = `${cfg.percentile}th`;
    el.querySelector('[data-role="percentile"]').hidden = cfg.strategy !== 'semantic';
    el.querySelector('[data-role="help"]').textContent = STRATEGY_HELP[cfg.strategy];
    for (const tab of el.querySelectorAll('[data-view]')) tab.setAttribute('aria-selected', String(tab.dataset.view === state.views[i]));
    renderSemanticPanel(i);
  }

  function syncToolbar() {
    $('#lab-doc').value = state.docId;
    $('#lab-clean').checked = state.clean;
    $('#lab-compare').checked = state.compare;
    $('.lab-custom').hidden = state.docId !== 'custom';
    root.classList.toggle('compare', state.compare);
    cfgEl(1).hidden = !state.compare;
    root.querySelector('[data-export="1"]').hidden = !state.compare;
    $('#lab-q').value = state.question;
    const methodSel = $('#lab-method');
    const semOpt = methodSel.querySelector('option[value="semantic"]');
    semOpt.disabled = modelState !== 'ready';
    semOpt.textContent = modelState === 'ready' ? 'Semantic (embeddings)' : 'Semantic (load the model first)';
    methodSel.value = state.method;
    $('#lab-suggestions').innerHTML = questions()
      .map((q) => `<li><button type="button" class="chip" data-suggest="${escapeHtml(q.q)}">${escapeHtml(q.q)}</button></li>`)
      .join('');
    $('#lab-eval-btn').disabled = questions().length === 0;
  }

  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'lab-q') {
      state.question = t.value;
      debouncedRetrieval();
      return;
    }
    if (t.id === 'lab-custom-text') {
      state.custom = t.value;
      debouncedRefresh();
      return;
    }
    const k = t.dataset.k;
    if (!k || t.type === 'radio' || t.type === 'checkbox') return;
    const i = Number(t.closest('.lab-config').dataset.i);
    const cfg = state.configs[i];
    if (k === 'size') {
      const r = SIZE_RANGE[cfg.unit];
      const v = Number(t.value);
      if (!Number.isFinite(v)) return;
      cfg.size = Math.max(r.min, Math.min(r.max, Math.round(v)));
    } else {
      cfg[k] = Number(t.value);
    }
    syncControls(i);
    debouncedRefresh();
  });

  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'lab-doc') {
      state.docId = t.value;
      state.question = questions()[0]?.q || '';
      state.evalShown = false;
      $('#lab-eval').innerHTML = '';
      syncToolbar();
      refresh();
      return;
    }
    if (t.id === 'lab-clean') {
      state.clean = t.checked;
      refresh();
      return;
    }
    if (t.id === 'lab-compare') {
      state.compare = t.checked;
      syncToolbar();
      refresh();
      return;
    }
    if (t.id === 'lab-k') {
      state.topK = Number(t.value);
      runRetrieval();
      if (state.evalShown) runEval();
      return;
    }
    if (t.id === 'lab-method') {
      state.method = t.value;
      runRetrieval();
      if (state.evalShown) runEval();
      return;
    }
    const k = t.dataset.k;
    if (!k || !(t.type === 'radio' || t.type === 'checkbox')) return;
    const i = Number(t.closest('.lab-config').dataset.i);
    const cfg = state.configs[i];
    if (k === 'contextHeader') cfg.contextHeader = t.checked;
    if (k === 'strategy') cfg.strategy = t.value;
    if (k === 'unit' && cfg.unit !== t.value) {
      // Keep roughly the same amount of text when switching units (~4 chars/token).
      const r = SIZE_RANGE[t.value];
      const converted = t.value === 'chars' ? cfg.size * 4 : cfg.size / 4;
      cfg.size = Math.max(r.min, Math.min(r.max, Math.round(converted / r.step) * r.step));
      cfg.unit = t.value;
    }
    syncControls(i);
    refresh();
  });

  root.addEventListener('click', (e) => {
    const suggest = e.target.closest('[data-suggest]');
    if (suggest) {
      state.question = suggest.dataset.suggest;
      $('#lab-q').value = state.question;
      runRetrieval();
      return;
    }
    const tab = e.target.closest('[data-view]');
    if (tab) {
      const i = Number(tab.closest('.lab-config').dataset.i);
      state.views[i] = tab.dataset.view;
      syncControls(i);
      renderView(i);
      return;
    }
    if (e.target.closest('[data-load-model]')) {
      startModelLoad();
      return;
    }
    const exp = e.target.closest('[data-export]');
    if (exp) {
      openExport(Number(exp.dataset.export));
      return;
    }
    if (e.target.id === 'lab-eval-btn') {
      state.evalShown = true;
      runEval();
      return;
    }
    if (e.target.id === 'lab-reset') {
      state.configs[0] = { strategy: 'fixed', unit: 'tokens', size: 120, overlapPct: 0, contextHeader: false, percentile: 95 };
      state.configs[1] = { strategy: 'recursive', unit: 'tokens', size: 120, overlapPct: 15, contextHeader: false, percentile: 95 };
      Object.assign(state, { docId: 'refund', clean: false, compare: false, method: 'bm25', topK: 3, evalShown: false });
      state.question = questions()[0].q;
      $('#lab-k').value = '3';
      $('#lab-eval').innerHTML = '';
      syncAll();
      refresh();
    }
  });

  // Arrow keys move between the two view tabs.
  root.addEventListener('keydown', (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (!tab || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const tabs = [...tab.parentElement.querySelectorAll('[role="tab"]')];
    const next = tabs[(tabs.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    next.focus();
    next.click();
  });

  // ---------------------------------------------------------------- semantic

  function renderSemanticPanel(i) {
    const panel = cfgEl(i).querySelector('[data-role="semantic"]');
    const show = state.configs[i].strategy === 'semantic';
    panel.hidden = !show;
    if (!show) return;
    if (modelState === 'idle') {
      panel.innerHTML = `<p style="margin:0 0 8px"><strong>Semantic chunking needs a sentence-embedding model.</strong> Clicking below downloads <code>${semantic.MODEL_ID}</code> (${semantic.MODEL_SIZE_NOTE}) from Hugging Face. It runs in your browser and is cached for next time.</p>
        <button type="button" class="btn btn-primary btn-sm" data-load-model>Download model (${semantic.MODEL_SIZE_NOTE})</button>`;
    } else if (modelState === 'loading') {
      panel.innerHTML = `<p style="margin:0 0 6px">Downloading the model… ${modelProgress ? `${modelProgress}%` : ''}</p>
        <progress max="100" ${modelProgress ? `value="${modelProgress}"` : ''} aria-label="Model download progress"></progress>`;
    } else if (modelState === 'error') {
      panel.innerHTML = `<p style="margin:0 0 8px">Couldn't load the model (you may be offline, or the CDN is blocked). Everything else in the lab still works.</p>
        <button type="button" class="btn btn-sm" data-load-model>Try again</button>`;
    } else {
      panel.innerHTML = `<p style="margin:0">✓ Model ready. Sentences are embedded, and a new chunk starts wherever the distance between neighbours is above the chosen percentile. The plot below shows those distances. Semantic retrieval is now available in the tester.</p>`;
    }
  }

  async function startModelLoad() {
    modelState = 'loading';
    modelProgress = 0;
    [0, 1].forEach(renderSemanticPanel);
    try {
      await semantic.loadModel((p) => {
        modelProgress = p;
        const bar = root.querySelector('.semantic-panel:not([hidden]) progress');
        if (bar) {
          bar.value = p;
          bar.previousElementSibling.textContent = `Downloading the model… ${p}%`;
        }
      });
      modelState = 'ready';
    } catch (err) {
      console.warn(err);
      modelState = 'error';
    }
    syncToolbar();
    [0, 1].forEach(renderSemanticPanel);
    refresh();
  }

  async function ensureSentenceEmbeddings(text) {
    if (sentenceEmbeddings.has(text)) return;
    sentenceEmbeddings.set(text, null); // mark as in progress
    try {
      const spans = splitSentences(text);
      const embeddings = await semantic.embed(spans.map(([s, e]) => text.slice(s, e)));
      sentenceEmbeddings.set(text, { sentences: spans, embeddings });
    } catch (err) {
      console.warn(err);
      sentenceEmbeddings.delete(text);
    }
    refresh();
  }

  // ---------------------------------------------------------------- compute

  function computeConfig(i) {
    const cfg = state.configs[i];
    const text = docText();
    if (!text.trim()) return { empty: true };
    const ctx = { countTokens, docTitle: docTitle() };
    if (cfg.strategy === 'semantic') {
      if (modelState !== 'ready') return { pending: 'Load the model above to see semantic chunks.' };
      const sem = sentenceEmbeddings.get(text);
      if (!sem) {
        ensureSentenceEmbeddings(text);
        return { pending: 'Embedding sentences…' };
      }
      ctx.semantic = sem;
    }
    const out = chunkDocument(text, { ...cfg, overlap: overlapOf(cfg) }, ctx);
    out.text = text;
    out.cfg = { ...cfg, overlap: out.overlap };
    return out;
  }

  function refresh() {
    for (const i of activeConfigs()) {
      results[i] = computeConfig(i);
      renderConfigOutput(i);
    }
    runRetrieval();
    if (state.evalShown) runEval();
  }
  const debouncedRefresh = debounce(refresh, 90);
  const debouncedRetrieval = debounce(() => runRetrieval(), 200);

  // ---------------------------------------------------------------- render

  function goldFor(question) {
    const q = question.trim().toLowerCase();
    const match = questions().find((x) => x.q.toLowerCase() === q);
    return match ? match.gold : null;
  }

  function renderConfigOutput(i) {
    const el = cfgEl(i);
    const res = results[i];
    const statsEl = el.querySelector('[data-role="stats"]');
    const histEl = el.querySelector('[data-role="hist"]');
    const distEl = el.querySelector('[data-role="dist"]');
    distEl.hidden = true;
    if (res.empty || res.pending) {
      statsEl.innerHTML = '';
      histEl.innerHTML = '';
      el.querySelector('[data-role="view"]').innerHTML = `<p class="muted">${res.empty ? 'Paste some text above to start.' : escapeHtml(res.pending)}</p>`;
      return;
    }
    const s = chunkStats(res.chunks);
    const docTokens = countTokens(res.text);
    const extra = docTokens ? Math.round((100 * (s.totalTokens - docTokens)) / docTokens) : 0;
    const stat = (value, label) => `<li class="stat"><b>${value}</b><span>${label}</span></li>`;
    statsEl.innerHTML = [
      stat(s.count, 'chunks'),
      stat(s.avg, 'avg tokens'),
      stat(`${s.min}–${s.max}`, 'min–max tokens'),
      stat(s.totalTokens, `tokens stored (${extra >= 0 ? '+' : ''}${extra}% vs ${docTokens} in doc)`),
      stat(`${s.midSentencePct}%`, 'end mid-sentence'),
    ].join('');
    histEl.innerHTML = histogramSvg(res.chunks, res.size, res.unit);
    if (res.semanticInfo) {
      distEl.hidden = false;
      distEl.innerHTML = distanceSvg(res.semanticInfo);
    }
    renderView(i);
  }

  function renderView(i) {
    const res = results[i];
    const view = cfgEl(i).querySelector('[data-role="view"]');
    const tabCards = cfgEl(i).querySelector('[data-view="cards"]');
    if (!res || res.empty || res.pending) return;
    tabCards.textContent = `Chunk cards (${res.chunks.length})`;
    view.setAttribute('aria-labelledby', `tab-${state.views[i]}-${i}`);
    const gold = goldFor(state.question);
    const loc = gold ? locateSpan(res.text, gold) : null;
    if (state.views[i] === 'doc') {
      view.innerHTML = `<div class="doc-view">${renderChunkedText(res.text, res.chunks, { gold: loc })}</div>
        <p class="small muted" style="margin:6px 0 0">Numbers mark where each chunk starts; hatched text is overlap.${loc ? ' The answer to the current question is underlined in green.' : ''}</p>`;
    } else {
      view.innerHTML = `<ol class="chunk-cards">${res.chunks.map((c) => chunkCard(c, res, loc)).join('')}</ol>`;
    }
  }

  function chunkCard(c, res, loc) {
    const unitWord = res.unit === 'chars' ? 'chars' : 'tokens';
    const badges = [];
    if (c.endsMidSentence) badges.push('<span class="badge approx">⚠ ends mid-sentence</span>');
    if (c.oversize) badges.push('<span class="badge bad">over the limit: table/code kept whole</span>');
    if (c.overlapChars) badges.push(`<span class="badge">shares ${c.overlapChars} chars with #${c.index}</span>`);
    if (loc) {
      const mark = coverage(c, loc);
      if (mark !== 'none') badges.push(`<span class="badge ${mark === 'full' ? 'ok' : 'approx'}">${mark === 'full' ? 'has the full answer' : 'has part of the answer'}</span>`);
    }
    const header = res.cfg.contextHeader ? `<span class="chunk-header-line">${escapeHtml(c.header)}</span>` : '';
    return `<li class="chunk-card" data-c="${c.index % 6}">
      <div class="chunk-meta"><strong>#${c.index + 1}</strong><span>${c.tokens} tokens · ${c.chars} chars</span>
        ${c.headingPath.length ? `<span class="path">${escapeHtml(c.headingPath.join(' › '))}</span>` : ''}${badges.join('')}</div>
      <pre class="chunk-text">${header}${escapeHtml(c.text)}</pre>
      <span class="visually-hidden">Size measured in ${unitWord}: ${c.size}</span>
    </li>`;
  }

  // Histogram of chunk sizes: one series, one hue, no legend; hover/focus tooltips.
  function histogramSvg(chunks, limit, unit) {
    const unitWord = unit === 'chars' ? 'characters' : 'tokens';
    const sizes = chunks.map((c) => c.size);
    const maxV = Math.max(limit, ...sizes);
    const bins = 10;
    const width = maxV / bins;
    const counts = new Array(bins).fill(0);
    for (const v of sizes) counts[Math.min(bins - 1, Math.floor(v / width))]++;
    const W = 600;
    const H = 100;
    const pad = 18;
    const bw = (W - 2) / bins;
    const maxC = Math.max(...counts, 1);
    const bars = counts
      .map((n, b) => {
        if (!n) return '';
        const h = Math.max(4, ((H - pad) * n) / maxC);
        const x = b * bw + 1 + 1;
        const y = H - pad - h;
        const w = bw - 2;
        const r = Math.min(4, w / 2, h);
        const lo = Math.round(b * width);
        const hi = Math.round((b + 1) * width);
        const label = `${lo}–${hi} ${unitWord}: ${n} chunk${n === 1 ? '' : 's'}`;
        // Rounded top, square bottom anchored to the baseline.
        const d = `M${x},${H - pad}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${H - pad}Z`;
        return `<path class="bar" d="${d}" tabindex="0" data-tip="${label}" aria-label="${label}"></path>`;
      })
      .join('');
    const lx = (limit / maxV) * (W - 2) + 1;
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Histogram of chunk sizes in ${unitWord}">
      <line class="axis" x1="0" x2="${W}" y1="${H - pad}" y2="${H - pad}"></line>
      ${bars}
      <line class="limit" x1="${lx}" x2="${lx}" y1="0" y2="${H - pad}"></line>
      <text x="2" y="${H - 4}">0</text>
      <text x="${Math.min(lx, W - 70)}" y="10" text-anchor="${lx > W - 80 ? 'end' : 'start'}" dx="${lx > W - 80 ? 0 : 4}">limit ${limit}</text>
      <text x="${W - 2}" y="${H - 4}" text-anchor="end">${Math.round(maxV)} ${unitWord}</text>
    </svg>`;
  }

  function distanceSvg({ distances, threshold }) {
    if (distances.length < 2) return '<p class="small muted">Not enough sentences to plot.</p>';
    const W = 600;
    const H = 100;
    const pad = 14;
    const maxD = Math.max(...distances, threshold) || 1;
    const x = (i) => 4 + (i * (W - 8)) / (distances.length - 1);
    const y = (d) => H - pad - (d / maxD) * (H - pad - 6);
    const pts = distances.map((d, i) => `${x(i).toFixed(1)},${y(d).toFixed(1)}`).join(' ');
    const breaks = distances
      .map((d, i) => (d > threshold ? `<circle class="break" cx="${x(i)}" cy="${y(d)}" r="4"><title>Break after sentence ${i + 1} (distance ${d.toFixed(2)})</title></circle>` : ''))
      .join('');
    return `<p class="small" style="margin:10px 0 4px"><strong>Distance between neighbouring sentences</strong> <span class="muted">(dots = new chunk starts; dashed line = threshold ${threshold.toFixed(2)})</span></p>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Line chart of cosine distance between neighbouring sentences with the breakpoint threshold">
        <line class="threshold" x1="0" x2="${W}" y1="${y(threshold)}" y2="${y(threshold)}"></line>
        <polyline class="line" points="${pts}"></polyline>${breaks}
      </svg>`;
  }

  root.addEventListener('pointerover', (e) => {
    const bar = e.target.closest('.histogram .bar');
    if (bar) showTip(bar, bar.dataset.tip);
  });
  root.addEventListener('pointerout', (e) => {
    if (e.target.closest('.histogram .bar')) hideTip();
  });
  root.addEventListener('focusin', (e) => {
    const bar = e.target.closest('.histogram .bar');
    if (bar) showTip(bar, bar.dataset.tip);
  });
  root.addEventListener('focusout', (e) => {
    if (e.target.closest('.histogram .bar')) hideTip();
  });

  // ---------------------------------------------------------------- retrieval

  const bm25Cache = new WeakMap();
  function bm25For(res) {
    if (!bm25Cache.has(res)) bm25Cache.set(res, buildBM25(res.chunks.map((c) => c.retrievalText)));
    return bm25Cache.get(res);
  }

  async function retrieve(res, question, k) {
    if (state.method === 'semantic' && modelState === 'ready') {
      const [qv] = await semantic.embed([question]);
      const vecs = await semantic.embed(res.chunks.map((c) => c.retrievalText));
      return rankByCosine(qv, vecs, k);
    }
    return bm25For(res).search(question, k);
  }

  function highlightTerms(text, matched) {
    if (!matched || !matched.length) return escapeHtml(text);
    const set = new Set(matched);
    return text
      .split(/([\p{L}\p{N}]+)/u)
      .map((part, idx) => {
        if (idx % 2 === 0) return escapeHtml(part);
        const term = searchTerms(part)[0];
        return term && set.has(term) ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part);
      })
      .join('');
  }

  async function runRetrieval() {
    const run = ++retrievalRun;
    const out = $('#lab-results');
    const question = state.question.trim();
    if (!question) {
      out.innerHTML = '<p class="muted">Type a question, or pick a suggestion.</p>';
      return;
    }
    const gold = goldFor(question);
    const blocks = [];
    for (const i of activeConfigs()) {
      const res = results[i];
      const name = i === 0 ? 'A' : 'B';
      if (!res || res.empty || res.pending) {
        blocks.push(`<div><h4 style="margin:0 0 8px">Configuration ${name}</h4><p class="muted">No chunks yet.</p></div>`);
        continue;
      }
      let ranked;
      try {
        ranked = await retrieve(res, question, state.topK);
      } catch (err) {
        console.warn(err);
        ranked = bm25For(res).search(question, state.topK);
      }
      if (run !== retrievalRun) return; // a newer run started
      const loc = gold ? locateSpan(res.text, gold) : null;
      const items = ranked.map((r, rank) => {
        const c = res.chunks[r.index];
        const mark = loc ? coverage(c, loc) : null;
        const header = res.cfg.contextHeader ? `<span class="chunk-header-line">${escapeHtml(c.header)}</span>` : '';
        return `<li class="result ${mark || ''}">
          <div class="result-head"><strong>Rank ${rank + 1}</strong><span>chunk #${c.index + 1} · ${c.tokens} tokens</span>
            <span class="score">score ${r.score.toFixed(state.method === 'semantic' ? 3 : 2)}</span>
            ${mark ? `<span class="mark-label ${mark}">${MARK_TEXT[mark]}</span>` : ''}</div>
          <pre class="chunk-text">${header}${highlightTerms(c.text, r.matched)}</pre></li>`;
      });
      let note = '';
      if (!gold) note = '<p class="small muted">This is your own question, so there’s no known answer to check against. Judge the chunks yourself.</p>';
      else if (!loc) note = '<p class="small" style="color:var(--danger)">The known answer can’t be found word-for-word in this version of the text, so no chunk can contain it. Try turning on "Clean text first".</p>';
      else if (!ranked.some((r) => coverage(res.chunks[r.index], loc) === 'full')) note = `<p class="small" style="color:var(--danger)"><strong>Miss:</strong> none of the top ${state.topK} chunks contains the full answer.</p>`;
      else note = `<p class="small" style="color:var(--success)"><strong>Hit:</strong> the full answer is in the top ${state.topK}.</p>`;
      blocks.push(`<div><h4 style="margin:0 0 8px">${state.compare ? `Configuration ${name}: ` : ''}top ${state.topK} by ${state.method === 'semantic' ? 'cosine similarity' : 'BM25'}</h4>${note}
        ${items.length ? `<ol class="result-list">${items.join('')}</ol>` : '<p class="muted">No chunk shares any keyword with this question.</p>'}</div>`);
    }
    if (run === retrievalRun) out.innerHTML = blocks.join('');
    // Keep the green answer underline in the document view in sync.
    for (const i of activeConfigs()) renderView(i);
  }

  async function runEval() {
    const out = $('#lab-eval');
    const qs = questions();
    if (!qs.length) {
      out.innerHTML = '';
      return;
    }
    const k = state.topK;
    const evals = [];
    for (const i of activeConfigs()) {
      const res = results[i];
      if (!res || res.empty || res.pending) {
        evals.push(null);
        continue;
      }
      let retrieveFn;
      if (state.method === 'semantic' && modelState === 'ready') {
        const qVecs = await semantic.embed(qs.map((q) => q.q));
        const cVecs = await semantic.embed(res.chunks.map((c) => c.retrievalText));
        const byQ = new Map(qs.map((q, j) => [q.q, qVecs[j]]));
        retrieveFn = (q, kk) => rankByCosine(byQ.get(q), cVecs, kk);
      } else {
        const bm = bm25For(res);
        retrieveFn = (q, kk) => bm.search(q, kk);
      }
      evals.push(evaluate(res.chunks, qs, res.text, k, retrieveFn));
    }
    const cols = activeConfigs();
    const cell = (ev, j) => {
      if (!ev) return '<td>–</td>';
      const p = ev.perQuestion[j];
      if (!p.found) return '<td class="mark">— answer text not found</td>';
      if (p.hitRank) return `<td class="mark" style="color:var(--success)">✅ rank ${p.hitRank}</td>`;
      if (p.marks.includes('partial')) return '<td class="mark" style="color:var(--warn)">⚠️ partial only</td>';
      return '<td class="mark" style="color:var(--danger)">❌ miss</td>';
    };
    const summary = cols
      .map((i, idx) => {
        const ev = evals[idx];
        if (!ev) return '';
        const name = state.compare ? ` (${i === 0 ? 'A' : 'B'})` : '';
        return `<li class="stat"><b>${Math.round(ev.hitRate * 100)}%</b><span>hit rate@${k}${name}</span></li>
          <li class="stat"><b>${ev.mrr.toFixed(2)}</b><span>MRR${name}</span></li>`;
      })
      .join('');
    out.innerHTML = `<ul class="stat-row eval-summary">${summary}</ul>
      <div class="data-table-wrap"><table class="data eval-table">
        <thead><tr><th scope="col">Question</th>${cols.map((i) => `<th scope="col">${state.compare ? `Config ${i === 0 ? 'A' : 'B'}` : 'Result'}</th>`).join('')}</tr></thead>
        <tbody>${qs.map((q, j) => `<tr><td>${escapeHtml(q.q)}</td>${evals.map((ev) => cell(ev, j)).join('')}</tr>`).join('')}</tbody>
      </table></div>
      <p class="small muted">Hit rate@${k}: share of questions where a top-${k} chunk fully contains the answer. MRR: average of 1/rank of the first such chunk (0 if none).</p>`;
  }

  // ---------------------------------------------------------------- export

  function openExport(i) {
    const cfg = { ...state.configs[i], overlap: overlapOf(state.configs[i]) };
    const { langchain, plain, notes } = generateCode(cfg);
    const dialog = document.getElementById('export-dialog');
    const body = document.getElementById('export-body');
    body.innerHTML = `
      <p style="margin-top:0">Python matching configuration ${i === 0 ? 'A' : 'B'}: <strong>${STRATEGY_LABELS[cfg.strategy]}</strong>, ${cfg.size} ${cfg.unit === 'chars' ? 'characters' : 'tokens'}, overlap ${cfg.overlap}${cfg.contextHeader ? ', contextual headers' : ''}.</p>
      <div class="tabs" role="tablist" aria-label="Code version">
        <button type="button" class="tab" role="tab" aria-selected="true" aria-controls="exp-lc" id="exp-tab-lc">LangChain</button>
        <button type="button" class="tab" role="tab" aria-selected="false" aria-controls="exp-plain" id="exp-tab-plain">Plain Python (no dependencies)</button>
      </div>
      <div id="exp-lc" role="tabpanel" aria-labelledby="exp-tab-lc">${codeBlockHtml(langchain, 'python', 'python · langchain-text-splitters')}
        ${notes.map((n) => `<p class="small muted">${escapeHtml(n)}</p>`).join('')}
        <p class="small muted">Chunk boundaries can differ slightly from the lab: libraries count and merge pieces in their own way. Always check results on your own documents.</p></div>
      <div id="exp-plain" role="tabpanel" aria-labelledby="exp-tab-plain" hidden>${codeBlockHtml(plain, 'python', 'python · standard library only')}
        <p class="small muted">A minimal fixed-size version so you can see the algorithm. It counts characters, not tokens.</p></div>`;
    body.querySelectorAll('[role="tab"]').forEach((tab) =>
      tab.addEventListener('click', () => {
        body.querySelectorAll('[role="tab"]').forEach((t) => {
          const on = t === tab;
          t.setAttribute('aria-selected', String(on));
          document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
        });
      }),
    );
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  // ---------------------------------------------------------------- start

  function syncAll() {
    syncToolbar();
    [0, 1].forEach(syncControls);
  }

  syncAll();
  refresh();
  onTokenizerChange(refresh);
}
