// A tiny syntax highlighter for the few languages shown on the page
// (Python, JSON, bash). It's deliberately small: enough to make code
// readable, with no CDN dependency.

const PY_KEYWORDS = new Set(
  'def return import from as for in if elif else while with class not and or is None True False lambda try except raise yield pass break continue'.split(' '),
);

function esc(s) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
}

const RULES = {
  python: /(#[^\n]*)|("""[\s\S]*?"""|f?"(?:\\.|[^"\\\n])*"|f?'(?:\\.|[^'\\\n])*')|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_]\w*)(?=\s*\()|\b([A-Za-z_]\w*)\b/g,
  bash: /(#[^\n]*)|("(?:\\.|[^"\\])*"|'[^']*')|\b(\d+)\b|^(\s*[a-z][\w-]*)|()/gm,
  json: /()("(?:\\.|[^"\\])*")(?=\s*:)|("(?:\\.|[^"\\])*")|\b(-?\d+(?:\.\d+)?|true|false|null)\b/g,
};

export function highlight(code, lang) {
  const re = RULES[lang];
  if (!re) return esc(code);
  re.lastIndex = 0;
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(code))) {
    if (m[0] === '') {
      re.lastIndex++;
      continue;
    }
    out += esc(code.slice(last, m.index));
    out += wrap(m, lang);
    last = m.index + m[0].length;
  }
  return out + esc(code.slice(last));
}

function wrap(m, lang) {
  const t = esc(m[0]);
  if (lang === 'json') {
    if (m[2]) return `<span class="tk-f">${t}</span>`;
    if (m[3]) return `<span class="tk-s">${t}</span>`;
    return `<span class="tk-n">${t}</span>`;
  }
  if (m[1]) return `<span class="tk-c">${t}</span>`;
  if (m[2]) return `<span class="tk-s">${t}</span>`;
  if (m[3]) return `<span class="tk-n">${t}</span>`;
  if (lang === 'bash') return m[4] ? `<span class="tk-f">${t}</span>` : t;
  if (m[4]) return PY_KEYWORDS.has(m[4]) ? `<span class="tk-k">${t}</span>` : `<span class="tk-f">${t}</span>`;
  if (m[5] && PY_KEYWORDS.has(m[5])) return `<span class="tk-k">${t}</span>`;
  return t;
}
