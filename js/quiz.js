// Scored quiz with instant feedback and an explanation for every option.

import { QUIZ } from '../data/quiz.js';
import { escapeHtml, store } from './ui.js';

const SECTION_LINKS = {
  theory: ['#s-theory', 'Section 2: theory'],
  strategies: ['#s-strategies', 'Section 3: strategies'],
  processing: ['#s-processing', 'Section 4: document processing'],
  lab: ['#s-lab', 'Section 5: Chunk Lab'],
  challenges: ['#s-challenges', 'Section 6: Fix the Bot'],
  apply: ['#s-apply', 'Section 7: use it in your app'],
};

export function initQuiz(root, onFinished) {
  if (!root) return;
  let answers = store.get('quiz', {}); // question id -> chosen index

  function render() {
    root.innerHTML = `${QUIZ.map(questionHtml).join('')}<div class="quiz-score" id="quiz-score" aria-live="polite"></div>`;
    QUIZ.forEach((q) => {
      if (answers[q.id] !== undefined) reveal(q);
    });
    renderScore();
  }

  function questionHtml(q, n) {
    return `<fieldset class="quiz-q" id="quiz-${q.id}">
      <legend><span class="qnum">Q${n + 1}.</span>${escapeHtml(q.question)}</legend>
      <div class="quiz-options">${q.options
        .map(
          (opt, j) => `<label class="quiz-option" data-j="${j}">
            <input type="radio" name="quiz-${q.id}" value="${j}">
            <span><span class="opt-text">${escapeHtml(opt)}</span><span class="why" hidden></span></span>
          </label>`,
        )
        .join('')}</div>
      <p class="small" data-role="feedback" aria-live="polite" style="margin:10px 0 0"></p>
    </fieldset>`;
  }

  function reveal(q) {
    const fs = root.querySelector(`#quiz-${q.id}`);
    const chosen = answers[q.id];
    fs.querySelectorAll('.quiz-option').forEach((label) => {
      const j = Number(label.dataset.j);
      const input = label.querySelector('input');
      input.checked = j === chosen;
      input.disabled = true;
      label.classList.toggle('correct', j === q.answer);
      label.classList.toggle('incorrect', j === chosen && j !== q.answer);
      const why = label.querySelector('.why');
      // Show explanations for the chosen option and the correct one; others on demand.
      const tag = j === q.answer ? '<span class="tag">✓ Correct answer.</span>' : j === chosen ? '<span class="tag">✗ Your answer.</span>' : '';
      why.innerHTML = tag + escapeHtml(q.explanations[j]);
      why.hidden = false;
    });
    const right = chosen === q.answer;
    fs.querySelector('[data-role="feedback"]').innerHTML = right
      ? '<strong style="color:var(--success)">Correct!</strong> Read why the other options don’t work, too.'
      : `<strong style="color:var(--danger)">Not quite.</strong> The correct answer is highlighted in green.`;
  }

  function renderScore() {
    const done = QUIZ.filter((q) => answers[q.id] !== undefined);
    const scoreEl = root.querySelector('#quiz-score');
    if (done.length < QUIZ.length) {
      scoreEl.innerHTML = `<p class="small muted">${done.length} of ${QUIZ.length} answered.</p>`;
      return;
    }
    const correct = QUIZ.filter((q) => answers[q.id] === q.answer).length;
    const missed = QUIZ.filter((q) => answers[q.id] !== q.answer);
    const topics = [...new Map(missed.map((q) => [q.topic, q])).values()];
    const msg = correct === QUIZ.length ? 'Perfect score, nicely done.' : correct >= 6 ? 'Strong result.' : 'Good start. Review the topics below and try again.';
    scoreEl.innerHTML = `<div class="card">
      <h4 style="margin:0 0 4px">Your score: ${correct} / ${QUIZ.length}</h4>
      <p style="margin:0 0 8px">${msg}</p>
      ${topics.length ? `<p style="margin:0 0 4px"><strong>Review:</strong></p><ul style="margin:0 0 10px">${topics
        .map((q) => {
          const [href, label] = SECTION_LINKS[q.section];
          return `<li>${escapeHtml(q.topic)}: <a href="${href}">${label}</a></li>`;
        })
        .join('')}</ul>` : ''}
      <button type="button" class="btn btn-sm" id="quiz-retake">Retake the quiz</button></div>`;
    onFinished?.();
  }

  root.addEventListener('change', (e) => {
    const input = e.target;
    if (input.type !== 'radio' || !input.name.startsWith('quiz-')) return;
    const id = input.name.slice(5);
    const q = QUIZ.find((x) => x.id === id);
    answers[id] = Number(input.value);
    store.set('quiz', answers);
    reveal(q);
    renderScore();
  });

  root.addEventListener('click', (e) => {
    if (e.target.id !== 'quiz-retake') return;
    answers = {};
    store.remove('quiz');
    render();
    root.querySelector('input[type="radio"]')?.focus();
  });

  render();
  return {
    reset() {
      answers = {};
      store.remove('quiz');
      render();
    },
  };
}
