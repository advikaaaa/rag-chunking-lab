// Flashcards: term ↔ definition and scenario ↔ strategy.

export const FLASHCARDS = [
  { kind: 'Term', front: 'Chunk', back: 'A piece of a document that is embedded, stored and retrieved as one unit.' },
  { kind: 'Term', front: 'Chunk overlap', back: 'Text shared between neighbouring chunks so answers near a boundary aren’t cut in half. Must be smaller than the chunk size.' },
  { kind: 'Term', front: 'Token', back: 'The unit a model counts. Roughly 4 characters of English on average, but it depends on the tokenizer.' },
  { kind: 'Term', front: 'Context window', back: 'The maximum number of tokens a model can handle in one request: prompt + retrieved chunks (+ usually the answer).' },
  { kind: 'Term', front: 'Recursive splitting', back: 'Try separators from coarse to fine (\\n\\n → \\n → ". " → " " → characters) and only go finer when a piece is still too big.' },
  { kind: 'Term', front: 'Semantic chunking', back: 'Embed sentences and start a new chunk where similarity between neighbours drops: chunks follow topics.' },
  { kind: 'Term', front: 'Contextual chunk header', back: 'Prepending "Doc title › Section" to a chunk so it still makes sense on its own.' },
  { kind: 'Term', front: 'Hit rate@k', back: 'Share of test questions where at least one top-k chunk contains the answer.' },
  { kind: 'Term', front: 'BM25', back: 'Keyword ranking: rewards rare query words, with diminishing returns for repeats and a penalty for long chunks.' },
  { kind: 'Term', front: 'Parent–child retrieval', back: 'Search small chunks for precision, then hand the LLM their larger parent section for context.' },
  { kind: 'Scenario', front: 'A help centre made of question-and-answer pairs', back: 'One chunk per Q&A pair: keep each question with its answer.' },
  { kind: 'Scenario', front: 'A pricing page with a comparison table', back: 'Structure-aware: keep the table whole, or repeat the header row in every group of rows.' },
  { kind: 'Scenario', front: 'A code repository', back: 'Split by function or class (syntax-aware) and store the file path as metadata.' },
  { kind: 'Scenario', front: 'Scanned PDF contracts', back: 'OCR first, then split by section or clause and keep clause IDs in metadata.' },
  { kind: 'Scenario', front: 'Support chat transcripts', back: 'Split by conversation turns or time windows so each chunk is a coherent exchange.' },
  { kind: 'Scenario', front: 'Long policy articles in plain prose', back: 'Recursive (or sentence-based) splitting with modest overlap. Start around a few hundred tokens and tune.' },
];
