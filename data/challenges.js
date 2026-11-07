// Fix-the-Bot challenges. tests/run.mjs proves that every `start` config
// fails and every config in `solutions` passes.

export const CHALLENGE_TOP_K = 3;

export const CHALLENGES = [
  {
    id: 'split-answer',
    title: 'The Split Answer',
    lesson: 'Chunk boundaries and overlap',
    docId: 'refund',
    question: 'Can I get a refund after 30 days?',
    gold: 'Refunds after 30 days are allowed only if the item is defective or arrived damaged, and the fault must be reported within 90 days of delivery.',
    botAnswer: 'No. Refunds are only approved within 30 days of delivery.',
    goodAnswer: 'Yes, if the item is defective or arrived damaged, as long as you report the fault within 90 days of delivery. We’ll also cover return shipping.',
    scenario:
      'A customer with a faulty headset was told they could not get a refund. The policy says they can: the exception clause got cut in half.',
    start: { strategy: 'fixed', unit: 'tokens', size: 120, overlap: 0, contextHeader: false },
    controls: ['strategy', 'size', 'overlap'],
    hints: [
      'Open the chunks: where does the first chunk end? Look at the sentence about refunds after 30 days.',
      'Either let neighbouring chunks share some text, or use a strategy that never cuts a sentence in half.',
      'Solution: keep Fixed-size but raise overlap to 60 tokens (50%), or switch the strategy to Sentence or Recursive at 120 tokens.',
    ],
    explainPass:
      'The whole exception clause now sits inside one chunk, so retrieval can hand the LLM the full rule, not half of it.',
    explainFail:
      'No retrieved chunk contains the full exception clause. The LLM only ever sees half the rule, so it answers "no".',
    solutions: [
      { strategy: 'fixed', unit: 'tokens', size: 120, overlap: 60, contextHeader: false },
      { strategy: 'sentence', unit: 'tokens', size: 120, overlap: 0, contextHeader: false },
      { strategy: 'recursive', unit: 'tokens', size: 120, overlap: 0, contextHeader: false },
    ],
  },
  {
    id: 'broken-table',
    title: 'The Broken Table',
    lesson: 'Preserve document structure',
    docId: 'pricing',
    question: 'How much does the Phone channel add-on cost per month?',
    gold: '| Add-on | Price per month | Available on | What you get |\n|---|---|---|---|\n| AI reply drafts | ₹1,200 | Team, Business | Suggested replies written from your help articles |\n| Extra storage | ₹300 | All plans | 100 GB more space for attachments |\n| Phone channel | ₹2,500 | Business | Inbound calls routed to agents, with recordings |',
    goldLabel: 'the table header row together with the Phone channel row',
    botAnswer: 'The Phone channel costs ₹300 per month.',
    goodAnswer: 'The Phone channel add-on costs ₹2,500 per month and is available on the Business plan.',
    scenario:
      'The pricing table was sliced into pieces. The chunk with the Phone channel row has lost its column headers, so "₹2,500" has no label, and the bot grabbed a number from a different row.',
    start: { strategy: 'fixed', unit: 'tokens', size: 50, overlap: 0, contextHeader: false },
    controls: ['strategy', 'size', 'overlap'],
    hints: [
      'Look at how the table is spread across chunks. Is the header row ("Add-on | Price per month | ...") in the same chunk as the Phone channel row?',
      'Pick a strategy that understands Markdown and treats a table as one unit that must not be cut.',
      'Solution: switch the strategy to Structure-aware (Markdown). It keeps the whole table in a single chunk.',
    ],
    explainPass:
      'The table stays whole, so the price sits next to its column header and plan name. The LLM can read the row correctly.',
    explainFail:
      'The header row and the Phone channel row are still in different chunks. A price without its column header is just a number.',
    solutions: [{ strategy: 'markdown', unit: 'tokens', size: 50, overlap: 0, contextHeader: false }],
  },
  {
    id: 'orphan-chunk',
    title: 'The Orphan Chunk',
    lesson: 'Context and metadata',
    docId: 'pricing',
    question: 'How much is the Team plan?',
    gold: 'It costs ₹499 per month and includes 5 seats.',
    botAnswer: "I couldn't find the price of the Team plan in our documents.",
    goodAnswer: 'The Team plan costs ₹499 per month and includes 5 seats.',
    scenario:
      'The pricing page is already chunked with the structure-aware strategy, but the Team plan section was too long for one chunk. The piece that holds the price says "It costs ₹499 per month and includes 5 seats." and never says which plan "it" is.',
    start: { strategy: 'markdown', unit: 'tokens', size: 40, overlap: 0, contextHeader: false },
    controls: ['contextHeader', 'size'],
    hints: [
      'Read the chunk that contains "₹499". Which words from the question ("Team", "plan") appear in it?',
      'The heading above that sentence says "Team plan". Can you carry that heading into every chunk?',
      'Solution: turn on "Add contextual header". Each chunk is then indexed as "NimbusDesk Pricing › Plans › Team plan" + its text.',
    ],
    explainPass:
      'With the section path prepended, the orphan chunk now says which plan it is about, so retrieval can match it to the question.',
    explainFail:
      'The chunk with the price still has no words in common with the question, so BM25 never ranks it in the top 3.',
    solutions: [{ strategy: 'markdown', unit: 'tokens', size: 40, overlap: 0, contextHeader: true }],
  },
  {
    id: 'needle-haystack',
    title: 'Bonus: The Needle in the Haystack',
    lesson: 'Precision vs context',
    docId: 'faq',
    question: 'How do I export my ticket history to CSV?',
    gold: 'Go to Settings, then Data, then Export, choose a date range and click Export CSV.',
    botAnswer: 'You can manage your tickets in the inbox, merge duplicates and use automation rules. Admins can run exports.',
    goodAnswer: 'Go to Settings › Data › Export, pick a date range and click Export CSV. Very large exports are emailed to you as a zip file.',
    scenario:
      'The right chunk is retrieved, but it is 1,000 tokens of mostly unrelated FAQ answers. The bot gets distracted and the prompt is expensive.',
    start: { strategy: 'recursive', unit: 'tokens', size: 1000, overlap: 100, contextHeader: false },
    controls: ['strategy', 'size', 'overlap'],
    maxTokens: 300,
    hints: [
      'The answer is retrieved. Check how many tokens the chunk has, and how much of it is about exports.',
      'Smaller chunks are more focused. Keep a little overlap so answers aren’t cut at the boundaries.',
      'Solution: lower the chunk size to about 250 tokens with 25 tokens of overlap (or use Structure-aware at 300).',
    ],
    explainPass:
      'The retrieved chunk is small and focused on the export answer, so the LLM gets less noise and the prompt is cheaper.',
    explainFail: 'Make sure the chunk that contains the answer is retrieved in the top 3 and is 300 tokens or fewer.',
    solutions: [
      { strategy: 'recursive', unit: 'tokens', size: 250, overlap: 25, contextHeader: false },
      { strategy: 'markdown', unit: 'tokens', size: 300, overlap: 0, contextHeader: false },
    ],
  },
];
