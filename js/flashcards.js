// Flashcards: Study mode (flip, prev/next) and a 60-second Quick-fire game
// where cards marked "Review again" go back into the queue.

import { FLASHCARDS } from '../data/flashcards.js';
import { escapeHtml } from './ui.js';

const DURATION = 60;

export function initFlashcards(root) {
  if (!root) return;
  let mode = 'study';
  let index = 0;
  let flipped = false;
  let game = null; // { queue, score, streak, best, missed:Set, left, timer }

  root.innerHTML = `
    <div class="tabs" role="tablist" aria-label="Flashcard mode">
      <button type="button" class="tab" role="tab" id="fc-tab-study" aria-controls="fc-panel" data-mode="study">Study</button>
      <button type="button" class="tab" role="tab" id="fc-tab-quick" aria-controls="fc-panel" data-mode="quick">Quick-fire (60 s)</button>
    </div>
    <div id="fc-panel" role="tabpanel"></div>`;
  const panel = root.querySelector('#fc-panel');

  function cardHtml(card) {
    return `<div class="flash-stage">
      <button type="button" class="flashcard" aria-pressed="${flipped}" aria-label="${flipped ? 'Answer' : 'Prompt'}: ${escapeHtml(flipped ? card.back : card.front)}. Press to flip.">
        <span class="flash-face front" aria-hidden="true"><span class="kind">${card.kind === 'Scenario' ? 'Scenario: which strategy?' : 'Term: define it'}</span><span class="front-text">${escapeHtml(card.front)}</span><span class="hint">Click, Space or Enter to flip</span></span>
        <span class="flash-face back" aria-hidden="true"><span class="kind">Answer</span><span class="back-text">${escapeHtml(card.back)}</span></span>
      </button></div>`;
  }

  function render() {
    root.querySelectorAll('[data-mode]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.mode === mode)));
    panel.setAttribute('aria-labelledby', mode === 'study' ? 'fc-tab-study' : 'fc-tab-quick');
    if (mode === 'study') {
      panel.innerHTML = `${cardHtml(FLASHCARDS[index])}
        <div class="flash-controls">
          <button type="button" class="btn" data-fc="prev">← Previous</button>
          <span class="small muted" aria-live="polite">Card ${index + 1} of ${FLASHCARDS.length}</span>
          <button type="button" class="btn" data-fc="next">Next →</button>
          <button type="button" class="btn btn-ghost" data-fc="shuffle">Shuffle</button>
        </div>`;
      return;
    }
    if (!game) {
      panel.innerHTML = `<div class="card"><p style="margin-top:0">You have ${DURATION} seconds. Flip each card, then be honest: <strong>Got it</strong> or <strong>Review again</strong>. Cards you miss come back later in the round.</p>
        <button type="button" class="btn btn-primary" data-fc="start">Start quick-fire</button></div>`;
      return;
    }
    if (game.left <= 0 || !game.queue.length) {
      const missed = FLASHCARDS.filter((_, i) => game.missed.has(i));
      panel.innerHTML = `<div class="card"><h4 style="margin:0 0 6px">${game.queue.length ? 'Time’s up!' : 'Deck cleared!'}</h4>
        <p style="margin:0 0 8px">Score: <strong>${game.score}</strong> · Best streak: <strong>${game.best}</strong></p>
        ${missed.length ? `<p style="margin:0 0 4px"><strong>Cards to review:</strong></p><ul>${missed.map((c) => `<li><strong>${escapeHtml(c.front)}</strong>: ${escapeHtml(c.back)}</li>`).join('')}</ul>` : '<p>No misses. 🎉</p>'}
        <button type="button" class="btn btn-primary" data-fc="start">Play again</button></div>`;
      return;
    }
    const card = FLASHCARDS[game.queue[0]];
    panel.innerHTML = `<div class="flash-hud" aria-live="off">
        <span class="badge timer ${game.left <= 10 ? 'low' : ''}" role="timer" aria-label="${game.left} seconds left">⏱ ${game.left}s</span>
        <span class="badge">Score ${game.score}</span><span class="badge">Streak ${game.streak}</span></div>
      ${cardHtml(card)}
      <div class="flash-controls">
        <button type="button" class="btn btn-primary" data-fc="got" ${flipped ? '' : 'disabled'}>Got it ✓</button>
        <button type="button" class="btn" data-fc="again" ${flipped ? '' : 'disabled'}>Review again ↺</button>
        <span class="small muted">${flipped ? '' : 'Flip the card first.'}</span>
      </div>`;
  }

  function flip() {
    flipped = !flipped;
    const btn = panel.querySelector('.flashcard');
    const card = mode === 'study' ? FLASHCARDS[index] : FLASHCARDS[game.queue[0]];
    btn.setAttribute('aria-pressed', String(flipped));
    btn.setAttribute('aria-label', `${flipped ? 'Answer' : 'Prompt'}: ${flipped ? card.back : card.front}. Press to flip.`);
    if (mode === 'quick') {
      panel.querySelectorAll('[data-fc="got"], [data-fc="again"]').forEach((b) => (b.disabled = !flipped));
      panel.querySelector('.flash-controls .muted').textContent = flipped ? '' : 'Flip the card first.';
    }
  }

  function startGame() {
    stopTimer();
    const order = FLASHCARDS.map((_, i) => i).sort(() => Math.random() - 0.5);
    game = { queue: order, score: 0, streak: 0, best: 0, missed: new Set(), left: DURATION, timer: null };
    flipped = false;
    game.timer = setInterval(() => {
      game.left--;
      if (game.left <= 0) {
        stopTimer();
        render();
        return;
      }
      const t = panel.querySelector('.timer');
      if (t) {
        t.textContent = `⏱ ${game.left}s`;
        t.setAttribute('aria-label', `${game.left} seconds left`);
        t.classList.toggle('low', game.left <= 10);
      }
    }, 1000);
    render();
    panel.querySelector('.flashcard')?.focus();
  }

  function stopTimer() {
    if (game && game.timer) clearInterval(game.timer);
    if (game) game.timer = null;
  }

  function answer(got) {
    const i = game.queue.shift();
    if (got) {
      game.score++;
      game.streak++;
      game.best = Math.max(game.best, game.streak);
    } else {
      game.streak = 0;
      game.missed.add(i);
      game.queue.push(i); // re-queue for another try
    }
    flipped = false;
    if (!game.queue.length) stopTimer();
    render();
    (panel.querySelector('.flashcard') || panel.querySelector('[data-fc="start"]'))?.focus();
  }

  root.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-mode]');
    if (tab) {
      mode = tab.dataset.mode;
      flipped = false;
      if (mode === 'study') stopTimer();
      render();
      return;
    }
    if (e.target.closest('.flashcard')) {
      flip();
      return;
    }
    const act = e.target.closest('[data-fc]')?.dataset.fc;
    if (!act) return;
    if (act === 'prev' || act === 'next') {
      index = (index + (act === 'next' ? 1 : FLASHCARDS.length - 1)) % FLASHCARDS.length;
      flipped = false;
      render();
      panel.querySelector(`[data-fc="${act}"]`).focus();
    }
    if (act === 'shuffle') {
      FLASHCARDS.sort(() => Math.random() - 0.5);
      index = 0;
      flipped = false;
      render();
      panel.querySelector('[data-fc="shuffle"]').focus();
    }
    if (act === 'start') startGame();
    if (act === 'got') answer(true);
    if (act === 'again') answer(false);
  });

  root.addEventListener('keydown', (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (tab && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const other = root.querySelector(`[data-mode="${tab.dataset.mode === 'study' ? 'quick' : 'study'}"]`);
      other.focus();
      other.click();
    }
    // Arrow keys move between cards in study mode.
    if (mode === 'study' && e.target.closest('.flashcard') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      index = (index + (e.key === 'ArrowRight' ? 1 : FLASHCARDS.length - 1)) % FLASHCARDS.length;
      flipped = false;
      render();
      panel.querySelector('.flashcard').focus();
    }
  });

  render();
}
