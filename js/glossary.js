// Glossary drawer: opens from any <a data-term> link without leaving the page.
// Keyboard: focus is trapped inside while open, Esc closes, and focus goes
// back to the link that opened it.

import { GLOSSARY, PIPELINE_STAGES } from '../data/glossary.js';
import { escapeHtml } from './ui.js';

const byId = new Map(GLOSSARY.map((g) => [g.id, g]));

export function initGlossary() {
  const drawer = document.getElementById('glossary');
  const scrim = document.getElementById('scrim');
  const body = document.getElementById('drawer-body');
  const title = document.getElementById('drawer-title');
  const back = document.getElementById('drawer-back');
  const closeBtn = document.getElementById('drawer-close');
  let returnFocus = null;
  let query = '';

  // Turn plain <a data-term> markers into accessible links.
  const hint = document.createElement('span');
  hint.id = 'term-hint';
  hint.className = 'visually-hidden';
  hint.textContent = 'Opens the glossary definition';
  document.body.appendChild(hint);
  enhanceLinks(document);

  function enhanceLinks(root) {
    root.querySelectorAll('a[data-term]:not(.term)').forEach((a) => {
      if (!byId.has(a.dataset.term)) {
        console.warn(`Glossary term missing: ${a.dataset.term}`);
        return;
      }
      a.classList.add('term');
      a.href = `#glossary-${a.dataset.term}`;
      a.setAttribute('aria-haspopup', 'dialog');
      a.setAttribute('aria-describedby', 'term-hint');
    });
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a.term[data-term]');
    if (link) {
      e.preventDefault();
      open(link.dataset.term, link);
    }
  });

  document.getElementById('glossary-open').addEventListener('click', (e) => open(null, e.currentTarget));
  closeBtn.addEventListener('click', close);
  scrim.addEventListener('click', close);
  back.addEventListener('click', () => showList(true));

  drawer.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = [...drawer.querySelectorAll('button:not([hidden]), input, a[href], [tabindex]:not([tabindex="-1"])')].filter(
      (el) => el.offsetParent !== null,
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-goto]');
    if (btn) showTerm(btn.dataset.goto, true);
  });

  function open(id, trigger) {
    returnFocus = trigger || document.activeElement;
    drawer.hidden = false;
    scrim.hidden = false;
    // Next frame so the CSS transition runs.
    requestAnimationFrame(() => {
      drawer.classList.add('open');
      scrim.classList.add('open');
    });
    document.body.style.overflow = 'hidden';
    if (id) showTerm(id, false);
    else showList(false);
    closeBtn.focus({ preventScroll: true });
    if (!id) body.querySelector('input')?.focus({ preventScroll: true });
  }

  function close() {
    drawer.classList.remove('open');
    scrim.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => {
      drawer.hidden = true;
      scrim.hidden = true;
    }, 260);
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
  }

  function stageStrip(stage) {
    const items = PIPELINE_STAGES.map((s) => `<li class="${s.id === stage ? 'active' : ''}">${escapeHtml(s.label)}</li>`).join('');
    const label = stage ? `This term belongs to the ${PIPELINE_STAGES.find((s) => s.id === stage).label} stage.` : 'This idea spans the whole pipeline.';
    return `<ol class="stage-strip ${stage ? '' : 'all'}" aria-label="${escapeHtml(label)}">${items}</ol><p class="small muted" style="margin:6px 0 0">${escapeHtml(label)}</p>`;
  }

  function showTerm(id, focusHeading) {
    const g = byId.get(id);
    if (!g) return;
    title.textContent = 'Glossary';
    back.hidden = false;
    body.innerHTML = `
      <h3 id="term-heading" tabindex="-1">${escapeHtml(g.term)}</h3>
      <p>${escapeHtml(g.definition)}</p>
      <p class="drawer-label">Where it fits in RAG</p>
      ${stageStrip(g.stage)}
      <p class="drawer-label">Example</p>
      <div class="example-box">${escapeHtml(g.example)}</div>
      <p class="drawer-label">Related terms</p>
      <ul class="chip-list">${g.related
        .map((r) => byId.get(r))
        .filter(Boolean)
        .map((r) => `<li><button type="button" class="chip" data-goto="${r.id}">${escapeHtml(r.term)}</button></li>`)
        .join('')}</ul>`;
    body.scrollTop = 0;
    if (focusHeading) body.querySelector('#term-heading').focus();
  }

  function showList(focusSearch) {
    title.textContent = 'All terms';
    back.hidden = true;
    body.innerHTML = `
      <label for="term-search" class="visually-hidden">Search terms</label>
      <input type="search" id="term-search" placeholder="Search ${GLOSSARY.length} terms…" value="${escapeHtml(query)}" autocomplete="off">
      <p class="small muted" id="term-count" aria-live="polite" style="margin:8px 0 0"></p>
      <ul class="term-list" id="term-list"></ul>`;
    const input = body.querySelector('#term-search');
    const renderList = () => {
      query = input.value;
      const q = query.trim().toLowerCase();
      const items = [...GLOSSARY]
        .sort((a, b) => a.term.localeCompare(b.term))
        .filter((g) => !q || g.term.toLowerCase().includes(q) || g.definition.toLowerCase().includes(q));
      body.querySelector('#term-list').innerHTML = items
        .map((g) => {
          const stage = PIPELINE_STAGES.find((s) => s.id === g.stage);
          return `<li><button type="button" data-goto="${g.id}">${escapeHtml(g.term)}<span class="stage-tag">${stage ? escapeHtml(stage.label) : 'Whole pipeline'}</span></button></li>`;
        })
        .join('');
      body.querySelector('#term-count').textContent = `${items.length} term${items.length === 1 ? '' : 's'}`;
    };
    input.addEventListener('input', renderList);
    renderList();
    if (focusSearch) input.focus();
  }

  return { enhanceLinks };
}
