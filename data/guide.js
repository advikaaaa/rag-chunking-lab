// Strategy decision guide. Sizes are starting points to tune, not rules.

export const GUIDE = [
  {
    id: 'faq',
    label: 'FAQ / help centre',
    strategy: 'One chunk per question-and-answer pair (structure-aware on the Q headings).',
    size: 'Whatever one Q&A pair needs; split only unusually long answers.',
    why: 'Users ask questions, and each pair is a complete, self-contained answer. Cutting a pair separates the question from its answer.',
    metadata: 'Category, article URL, last updated.',
  },
  {
    id: 'policy',
    label: 'Policies, manuals, articles',
    strategy: 'Recursive or structure-aware splitting.',
    size: 'Around 200–500 tokens with roughly 10–20% overlap as a starting point.',
    why: 'Prose has natural paragraph and sentence boundaries; overlap protects rules whose exceptions sit near a boundary.',
    metadata: 'Document title, section path, version, effective date.',
  },
  {
    id: 'legal',
    label: 'Legal contracts',
    strategy: 'Split by section or clause, following the document’s numbering.',
    size: 'One clause (or sub-clause) per chunk; sub-split only very long clauses.',
    why: 'Clauses reference each other and a half clause can reverse its meaning. Clause IDs make precise citations possible.',
    metadata: 'Contract ID, party, clause number, effective date.',
  },
  {
    id: 'code',
    label: 'Source code',
    strategy: 'Syntax-aware: split by function or class.',
    size: 'One function or class per chunk; group very small ones.',
    why: 'A function is the natural unit people ask about. Cutting through one breaks both the code and its meaning.',
    metadata: 'File path, language, symbol name, repository and commit.',
  },
  {
    id: 'chat',
    label: 'Chat transcripts, support tickets',
    strategy: 'Split by conversation turns or time windows.',
    size: 'A few turns per chunk, so each chunk is a coherent exchange.',
    why: 'Meaning lives in the question-and-reply pattern; isolated single messages ("yes, that worked") are meaningless.',
    metadata: 'Ticket ID, participants, timestamps, resolution status.',
  },
  {
    id: 'tables',
    label: 'Tables, spreadsheets',
    strategy: 'Keep each table whole, or group rows and repeat the header row in every chunk.',
    size: 'Fit the whole table if you can; otherwise a group of rows plus the header.',
    why: 'A cell value without its column header ("₹2,500") has no meaning to retrieval or to the LLM.',
    metadata: 'Sheet or table name, column names, source file.',
  },
];
