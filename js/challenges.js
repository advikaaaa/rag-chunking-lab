// Fix-the-Bot challenges UI. The pass/fail logic lives in challenge-core.js
// (shared with the tests), so what you see here is exactly what is tested.

import { CHALLENGES, CHALLENGE_TOP_K } from '../data/challenges.js';
import { evaluateChallenge } from './challenge-core.js';
import { coverage } from './retrieval.js';
import { STRATEGY_LABELS } from './chunkers.js';
import { countTokens, onTokenizerChange } from './tokenizer.js';
import { escapeHtml, store } from './ui.js';

const toPct = (cfg) => Math.round((100 * cfg.overlap) / cfg.size);

export function initChallenges(root, summaryEl, onAllRequiredSolved) {
  if (!root) return;
  const solved = new Set(store.get('challenges', []));
  const state = CHALLENGES.map((ch) => ({ cfg: { ...ch.start, overlapPct: toPct(ch.start) }, hints: 0, shown: false }));

  root.innerHTML = CHALLENGES.map((ch, i) => challengeHtml(ch, i)).join('');

  function challengeHtml(ch, i) {
    const s = ch.start;
    const required = !ch.id.startsWith('needle');
    return `<article class="challenge" id="ch-${ch.id}" data-i="${i}" aria-labelledby="ch-title-${i}">
      <div class="challenge-head">
        <span class="section-num">${required ? `Challenge ${i + 1}` : 'Bonus'}</span>
        <h3 id="ch-title-${i}">${escapeHtml(ch.title.replace('Bonus: ', ''))}</h3>
        <span class="badge">Lesson: ${escapeHtml(ch.lesson)}</span>
        <span class="status-pill" data-role="status"></span>
      </div>
      <div class="challenge-body">
        <div>
          <p style="margin-top:0">${escapeHtml(ch.scenario)}</p>
          <div class="chat" aria-label="Bot conversation">
            <div class="msg msg-user"><span class="msg-who">Customer</span>${escapeHtml(ch.question)}</div>
            <div class="msg msg-bot" data-role="bot"></div>
          </div>
          <p class="small" style="margin-top:12px"><strong>Passes when</strong> BM25 retrieves, in its top ${CHALLENGE_TOP_K}, a chunk that fully contains
            ${ch.goldLabel ? escapeHtml(ch.goldLabel) : `the answer: <q>${escapeHtml(ch.gold)}</q>`}${ch.maxTokens ? `, <strong>and</strong> that chunk is ${ch.maxTokens} tokens or fewer` : ''}.</p>
        </div>
        <div class="challenge-controls">
          <p class="small" style="margin:0"><strong>Starting settings (they fail):</strong> ${STRATEGY_LABELS[s.strategy]}, ${s.size} tokens, ${s.overlap} overlap${s.contextHeader ? ', header on' : ', no contextual header'}.</p>
          <div class="field"><label for="ch-strat-${i}">Strategy</label>
            <select id="ch-strat-${i}" data-k="strategy">${['fixed', 'sentence', 'recursive', 'markdown']
              .map((v) => `<option value="${v}">${STRATEGY_LABELS[v]}</option>`)
              .join('')}</select></div>
          <div class="field"><div class="field-row"><label for="ch-size-${i}">Chunk size</label><span class="field-value" data-role="size"></span></div>
            <input type="range" id="ch-size-${i}" min="20" max="1000" step="5" data-k="size"></div>
          <div class="field"><div class="field-row"><label for="ch-ov-${i}">Overlap</label><span class="field-value" data-role="ov"></span></div>
            <input type="range" id="ch-ov-${i}" min="0" max="50" step="5" data-k="overlapPct"></div>
          <label class="check"><input type="checkbox" data-k="contextHeader"> Add contextual header (Doc › Section)</label>
          <div class="challenge-actions">
            <button type="button" class="btn btn-primary" data-act="run">Run test</button>
            <button type="button" class="btn" data-act="hint">Hint</button>
            <button type="button" class="btn btn-ghost" data-act="reset">Reset</button>
          </div>
          <div data-role="hints" aria-live="polite"></div>
        </div>
        <div class="challenge-result" data-role="result" aria-live="polite"></div>
      </div>
    </article>`;
  }

  const el = (i) => root.querySelector(`.challenge[data-i="${i}"]`);

  function syncControls(i) {
    const { cfg } = state[i];
    const e = el(i);
    e.querySelector('[data-k="strategy"]').value = cfg.strategy;
    e.querySelector('[data-k="size"]').value = cfg.size;
    e.querySelector('[data-k="overlapPct"]').value = cfg.overlapPct;
    e.querySelector('[data-k="contextHeader"]').checked = cfg.contextHeader;
    e.querySelector('[data-role="size"]').textContent = `${cfg.size} tokens`;
    e.querySelector('[data-role="ov"]').textContent = `${cfg.overlapPct}% · ${overlapTokens(cfg)} tokens`;
    const isSolved = solved.has(CHALLENGES[i].id);
    const pill = e.querySelector('[data-role="status"]');
    pill.textContent = isSolved ? '✓ Solved' : 'Not solved yet';
    pill.classList.toggle('solved', isSolved);
    const bot = e.querySelector('[data-role="bot"]');
    const ch = CHALLENGES[i];
    bot.className = `msg msg-bot ${isSolved ? '' : 'wrong'}`;
    bot.innerHTML = isSolved
      ? `<span class="msg-who">Support bot (fixed)</span>${escapeHtml(ch.goodAnswer)}`
      : `<span class="msg-who">Support bot</span>${escapeHtml(ch.botAnswer)}<span class="msg-flag">✗ Wrong answer</span>`;
  }

  const overlapTokens = (cfg) => Math.min(cfg.size - 1, Math.round((cfg.size * cfg.overlapPct) / 100));
  const toConfig = (cfg) => ({ strategy: cfg.strategy, unit: 'tokens', size: cfg.size, overlap: overlapTokens(cfg), contextHeader: cfg.contextHeader });

  root.addEventListener('input', (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    const i = Number(e.target.closest('.challenge').dataset.i);
    const cfg = state[i].cfg;
    if (k === 'contextHeader') cfg.contextHeader = e.target.checked;
    else if (k === 'strategy') cfg.strategy = e.target.value;
    else cfg[k] = Number(e.target.value);
    syncControls(i);
  });

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const i = Number(btn.closest('.challenge').dataset.i);
    const act = btn.dataset.act;
    if (act === 'run') run(i);
    if (act === 'reset') {
      state[i].cfg = { ...CHALLENGES[i].start, overlapPct: toPct(CHALLENGES[i].start) };
      state[i].shown = false;
      el(i).querySelector('[data-role="result"]').innerHTML = '';
      syncControls(i);
    }
    if (act === 'hint') showHint(i, btn);
  });

  function showHint(i, btn) {
    const ch = CHALLENGES[i];
    state[i].hints = Math.min(ch.hints.length, state[i].hints + 1);
    const n = state[i].hints;
    el(i).querySelector('[data-role="hints"]').innerHTML = `<div class="hint-box">${ch.hints
      .slice(0, n)
      .map((h, j) => `<p><strong>${j === ch.hints.length - 1 ? 'Solution' : `Hint ${j + 1}`}:</strong> ${escapeHtml(h)}</p>`)
      .join('')}</div>`;
    if (n >= ch.hints.length) {
      btn.disabled = true;
      btn.textContent = 'All hints shown';
    } else {
      btn.textContent = n === ch.hints.length - 1 ? 'Show solution' : 'Next hint';
    }
  }

  function run(i) {
    const ch = CHALLENGES[i];
    const r = evaluateChallenge(ch, toConfig(state[i].cfg), { countTokens });
    state[i].shown = true;
    const resultEl = el(i).querySelector('[data-role="result"]');

    let detail = '';
    if (r.reason === 'split') {
      const parts = r.chunks.filter((c) => coverage(c, r.loc) === 'partial').map((c) => `#${c.index + 1}`);
      detail = `No chunk contains the whole answer: it is cut across chunks ${parts.join(' and ')}.`;
    } else if (r.reason === 'not-retrieved') {
      const holder = r.chunks.find((c) => coverage(c, r.loc) === 'full');
      detail = `Chunk #${holder.index + 1} does contain the answer, but BM25 didn't rank it in the top ${CHALLENGE_TOP_K}: it shares too few words with the question.`;
    } else if (r.reason === 'too-big') {
      detail = `The answer is retrieved, but inside a ${r.hit.chunk.tokens}-token chunk. The limit for this challenge is ${ch.maxTokens} tokens.`;
    } else {
      detail = `Chunk #${r.hit.chunk.index + 1} (${r.hit.chunk.tokens} tokens) is ranked #${r.hit.rank} and contains the full answer.`;
    }

    const rows = r.retrieved
      .map((x) => {
        const label = { full: '✅ full answer', partial: '⚠️ part of the answer', none: '❌ no answer' }[x.mark];
        const text = x.chunk.text.length > 420 ? `${x.chunk.text.slice(0, 420)}…` : x.chunk.text;
        const header = state[i].cfg.contextHeader ? `<span class="chunk-header-line">${escapeHtml(x.chunk.header)}</span>` : '';
        return `<li class="result ${x.mark}"><div class="result-head"><strong>Rank ${x.rank}</strong><span>chunk #${x.chunk.index + 1} · ${x.chunk.tokens} tokens</span><span class="mark-label ${x.mark}">${label}</span></div>
          <pre class="chunk-text">${header}${escapeHtml(text)}</pre></li>`;
      })
      .join('');

    resultEl.innerHTML = `<div class="result-banner ${r.pass ? 'pass' : 'fail'}">
        <div><div class="big">${r.pass ? '✓ Test passed' : '✗ Test failed'}</div>
        <p style="margin:4px 0">${escapeHtml(r.pass ? ch.explainPass : ch.explainFail)}</p>
        <p class="small" style="margin:0">${escapeHtml(detail)}</p></div></div>
      <details style="margin-top:10px"><summary>See what retrieval returned (top ${CHALLENGE_TOP_K} of ${r.chunks.length} chunks)</summary>
        ${rows ? `<ol class="result-list" style="margin-top:10px">${rows}</ol>` : '<p class="muted">No chunk shared a keyword with the question.</p>'}</details>`;

    if (r.pass && !solved.has(ch.id)) {
      solved.add(ch.id);
      store.set('challenges', [...solved]);
    }
    syncControls(i);
    renderSummary();
  }

  function renderSummary() {
    const required = CHALLENGES.filter((c) => !c.id.startsWith('needle'));
    const doneReq = required.filter((c) => solved.has(c.id)).length;
    const bonus = CHALLENGES.find((c) => c.id.startsWith('needle'));
    const bonusDone = bonus && solved.has(bonus.id);
    if (doneReq === required.length) {
      summaryEl.innerHTML = `<div class="completion">
        <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="var(--success)"/><path d="M14 25l7 7 13-15" fill="none" stroke="var(--surface)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <div><strong>Bot fixed! All ${required.length} required challenges solved.</strong><br>
        <span class="small">${bonusDone ? 'Bonus solved too. You found the precision sweet spot. 🏆' : 'Try the bonus challenge for the precision vs context trade-off.'}</span></div></div>`;
      onAllRequiredSolved?.();
    } else {
      summaryEl.innerHTML = `<span class="badge">${doneReq} of ${required.length} required solved</span>
        <span class="badge">Bonus: ${bonusDone ? 'solved' : 'not yet'}</span>`;
    }
  }

  CHALLENGES.forEach((_, i) => syncControls(i));
  renderSummary();

  // Re-run visible results if the tokenizer finishes loading (counts change slightly).
  onTokenizerChange(() => state.forEach((s, i) => s.shown && run(i)));

  return {
    reset() {
      solved.clear();
      store.remove('challenges');
      CHALLENGES.forEach((_, i) => syncControls(i));
      renderSummary();
    },
  };
}
