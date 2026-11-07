// Glossary entries shown in the side drawer.
// stage: where the term lives in the RAG pipeline (see PIPELINE_STAGES), or
// null for general ideas that span the whole pipeline.

export const PIPELINE_STAGES = [
  { id: 'parse', label: 'Parse & clean' },
  { id: 'chunk', label: 'Chunk' },
  { id: 'embed', label: 'Embed' },
  { id: 'store', label: 'Store' },
  { id: 'retrieve', label: 'Retrieve' },
  { id: 'generate', label: 'Generate' },
];

export const GLOSSARY = [
  {
    id: 'rag',
    term: 'RAG (Retrieval-Augmented Generation)',
    stage: null,
    definition:
      'A way of building AI apps where the system first searches your own documents for relevant text, then gives that text to an LLM along with the question. The model answers from the retrieved text instead of relying only on what it memorised during training.',
    example: 'A support bot looks up the refund policy, then asks the LLM: "Using only these passages, answer the customer’s question."',
    related: ['retrieval', 'llm', 'grounding', 'chunk'],
  },
  {
    id: 'llm',
    term: 'LLM (Large Language Model)',
    stage: 'generate',
    definition:
      'A neural network trained on large amounts of text to predict the next token. In RAG it is the part that writes the final answer. It can only use what is in its training data and what you put in its prompt.',
    example: 'The model that turns three retrieved policy chunks into a friendly two-sentence reply.',
    related: ['token', 'context-window', 'hallucination'],
  },
  {
    id: 'token',
    term: 'Token',
    stage: 'chunk',
    definition:
      'The unit of text a language model reads and counts. A token is often a whole common word, part of a longer word, a number or a punctuation mark. Limits and prices are measured in tokens, not characters or words.',
    example: 'With the cl100k_base tokenizer, "chunking" is split into two tokens: "chunk" and "ing". In English, one token is roughly 4 characters on average, but this varies by tokenizer and language.',
    related: ['tokenizer', 'context-window', 'chunk-size'],
  },
  {
    id: 'tokenizer',
    term: 'Tokenizer',
    stage: 'chunk',
    definition:
      'The algorithm that turns text into tokens (and back). Different models use different tokenizers, so the same text can be a different number of tokens for different models. Many use byte-pair encoding (BPE).',
    example: 'This lesson uses the cl100k_base BPE tokenizer through the js-tiktoken library. If it can’t load, counts fall back to an estimate of characters ÷ 4.',
    related: ['token', 'chunk-size'],
  },
  {
    id: 'context-window',
    term: 'Context window',
    stage: 'generate',
    definition:
      'The maximum number of tokens a model can handle in one request, counting the prompt (instructions, question, retrieved chunks) and usually the generated answer too. Anything beyond it can’t be used, and long prompts also cost more and take longer.',
    example: 'You can’t paste a 2,000-page manual into the prompt, so RAG sends only the few chunks that matter.',
    related: ['token', 'llm', 'top-k'],
  },
  {
    id: 'chunk',
    term: 'Chunk',
    stage: 'chunk',
    definition:
      'A piece of a document that is embedded, stored and retrieved as one unit. Chunks are what retrieval returns and what the LLM ends up reading, so their boundaries decide which facts travel together.',
    example: 'One FAQ question with its answer, or one paragraph of a policy.',
    related: ['chunk-size', 'chunk-overlap', 'retrieval'],
  },
  {
    id: 'chunk-size',
    term: 'Chunk size',
    stage: 'chunk',
    definition:
      'The maximum length of a chunk, measured in tokens or characters. Small chunks are precise but can lose context; large chunks keep context but dilute relevance and add irrelevant tokens to the prompt. There is no universal best value; test it on your own questions.',
    example: 'Many teams start somewhere around 200–500 tokens for prose and then tune using an evaluation set.',
    related: ['chunk-overlap', 'precision', 'evaluation-set'],
  },
  {
    id: 'chunk-overlap',
    term: 'Chunk overlap',
    stage: 'chunk',
    definition:
      'Text repeated at the start of a chunk from the end of the previous one. It lowers the chance that an answer is cut in half at a boundary. The cost is more chunks, more storage and some duplicate text in results. Overlap must be smaller than the chunk size.',
    example: 'Chunk size 300 tokens with 45 tokens (15%) of overlap.',
    related: ['chunk-size', 'separator'],
  },
  {
    id: 'separator',
    term: 'Separator',
    stage: 'chunk',
    definition:
      'A string a splitter is allowed to cut on, such as a blank line ("\\n\\n"), a newline, ". " or a space. Splitting on natural separators keeps paragraphs and sentences intact.',
    example: 'A recursive splitter tries "\\n\\n" first and only uses " " if a paragraph is still too long.',
    related: ['recursive-splitting', 'chunk'],
  },
  {
    id: 'structure-aware',
    term: 'Structure-aware chunking',
    stage: 'chunk',
    definition:
      'Splitting a document along its own structure (headings, sections, tables, code blocks) instead of at arbitrary lengths. Units that lose meaning when cut, like tables, are kept whole, and the heading path is saved as metadata.',
    example: 'A Markdown docs page is split at each ## heading; a pricing table stays in one chunk.',
    related: ['metadata', 'contextual-headers', 'parsing'],
  },
  {
    id: 'recursive-splitting',
    term: 'Recursive splitting',
    stage: 'chunk',
    definition:
      'A strategy that tries a list of separators from coarse to fine (paragraph, line, sentence, word, character). It only moves to a finer separator when a piece is still bigger than the chunk size, then merges small pieces back together up to the limit.',
    example: 'LangChain’s RecursiveCharacterTextSplitter is a widely used implementation of this idea.',
    related: ['separator', 'chunk-size', 'structure-aware'],
  },
  {
    id: 'semantic-chunking',
    term: 'Semantic chunking',
    stage: 'chunk',
    definition:
      'A strategy that embeds each sentence and starts a new chunk where the meaning shifts, i.e. where the similarity between neighbouring sentences drops sharply. Chunks follow topics, but it is slower and needs an embedding model.',
    example: 'A breakpoint is placed wherever the distance between two neighbouring sentences is above the 95th percentile of all such distances.',
    related: ['embedding', 'cosine-similarity', 'chunk'],
  },
  {
    id: 'parent-child',
    term: 'Parent–child retrieval',
    stage: 'retrieve',
    definition:
      'Also called small-to-big retrieval. You search over small, precise chunks, but when one matches you give the LLM its larger parent section. This combines precise matching with enough surrounding context.',
    example: 'A 100-token child chunk matches the question; the 800-token section it came from is sent to the LLM.',
    related: ['chunk-size', 'precision', 'retrieval'],
  },
  {
    id: 'contextual-headers',
    term: 'Contextual chunk headers',
    stage: 'chunk',
    definition:
      'A short label, such as the document title and section path, added to each chunk (or only to the text that gets embedded or indexed). It helps chunks that would otherwise be ambiguous out of context.',
    example: '"NimbusDesk Pricing › Plans › Team plan" added before "It costs ₹499 per month and includes 5 seats."',
    related: ['metadata', 'structure-aware', 'retrieval'],
  },
  {
    id: 'embedding',
    term: 'Embedding',
    stage: 'embed',
    definition:
      'A list of numbers (a vector) that represents the meaning of a piece of text. Texts with similar meanings get vectors that point in similar directions, even if they use different words.',
    example: '"How do I get my money back?" and "refund request" end up with similar embeddings.',
    related: ['embedding-model', 'vector', 'cosine-similarity'],
  },
  {
    id: 'embedding-model',
    term: 'Embedding model',
    stage: 'embed',
    definition:
      'A model that turns text into embeddings. Embedding models have a maximum input length; text beyond it is usually truncated, which is one more reason to keep chunks within a sensible size.',
    example: 'all-MiniLM-L6-v2 is a small, free sentence-embedding model that outputs 384-dimensional vectors.',
    related: ['embedding', 'chunk-size', 'semantic-search'],
  },
  {
    id: 'vector',
    term: 'Vector',
    stage: 'embed',
    definition:
      'An ordered list of numbers. In RAG, each chunk’s embedding is a vector, and "finding similar text" becomes "finding nearby vectors".',
    example: '[0.12, -0.03, 0.88, …] with a few hundred to a few thousand dimensions.',
    related: ['embedding', 'vector-database', 'cosine-similarity'],
  },
  {
    id: 'cosine-similarity',
    term: 'Cosine similarity',
    stage: 'retrieve',
    definition:
      'A measure of how closely two vectors point in the same direction, from −1 (opposite) through 0 (unrelated) to 1 (same direction). It is the most common way to compare embeddings.',
    example: 'A question and a chunk about the same topic might score 0.7; an unrelated chunk might score 0.1.',
    related: ['embedding', 'semantic-search', 'vector'],
  },
  {
    id: 'vector-database',
    term: 'Vector database',
    stage: 'store',
    definition:
      'A database built to store vectors and quickly find the ones nearest to a query vector, usually alongside the chunk text and its metadata. Many support metadata filters too.',
    example: 'Store each chunk’s embedding with { source, page, section } and search for the 5 nearest neighbours.',
    related: ['vector', 'metadata', 'semantic-search'],
  },
  {
    id: 'semantic-search',
    term: 'Semantic search',
    stage: 'retrieve',
    definition:
      'Search by meaning: embed the query, then find chunks whose embeddings are most similar. It can match paraphrases with no words in common, but may miss exact codes, names or rare terms.',
    example: '"Can I send it back?" finds a chunk about returns even though "returns" never appears in the question.',
    related: ['embedding', 'keyword-search', 'hybrid-search'],
  },
  {
    id: 'keyword-search',
    term: 'Keyword search',
    stage: 'retrieve',
    definition:
      'Search by matching the words in the query against the words in each chunk. It is fast and great for exact terms (product codes, error messages), but misses synonyms and paraphrases.',
    example: 'Searching "HTTP 429" finds the rate-limit section instantly.',
    related: ['bm25', 'semantic-search', 'hybrid-search'],
  },
  {
    id: 'bm25',
    term: 'BM25',
    stage: 'retrieve',
    definition:
      'A classic keyword ranking formula. A chunk scores higher when it contains the query’s words, especially rare words, with diminishing returns for repeats (parameter k1) and a penalty for very long chunks (parameter b).',
    example: 'This lab uses BM25 with k1 = 1.5 and b = 0.75, a simple tokeniser and a small stopword list.',
    related: ['keyword-search', 'retrieval', 'hybrid-search'],
  },
  {
    id: 'hybrid-search',
    term: 'Hybrid search',
    stage: 'retrieve',
    definition:
      'Combining keyword search (like BM25) and semantic search, then merging the two ranked lists. It catches exact terms and paraphrases.',
    example: 'Take the top 20 from BM25 and the top 20 from embeddings, then merge them with a method such as reciprocal rank fusion.',
    related: ['bm25', 'semantic-search', 'reranking'],
  },
  {
    id: 'retrieval',
    term: 'Retrieval',
    stage: 'retrieve',
    definition:
      'The step that finds the chunks most relevant to a question. The LLM can only answer from what retrieval returns, so chunking quality shows up directly as retrieval quality.',
    example: 'Question in, ranked list of 3 chunks out.',
    related: ['top-k', 'bm25', 'semantic-search'],
  },
  {
    id: 'top-k',
    term: 'Top-k',
    stage: 'retrieve',
    definition:
      'How many of the best-scoring chunks retrieval returns. A larger k raises the chance the answer is included but adds more irrelevant text and tokens to the prompt.',
    example: 'top-k = 3 sends the three highest-ranked chunks to the LLM.',
    related: ['retrieval', 'hit-rate', 'context-window'],
  },
  {
    id: 'hit-rate',
    term: 'Hit rate@k / Recall@k',
    stage: 'retrieve',
    definition:
      'Hit rate@k is the fraction of test questions where at least one of the top-k retrieved chunks contains the answer. Recall@k is the fraction of all relevant chunks that appear in the top k. With one relevant chunk per question, the two are the same.',
    example: '17 of 20 questions have the answer in the top 3 → hit rate@3 = 0.85.',
    related: ['evaluation-set', 'top-k', 'mrr'],
  },
  {
    id: 'mrr',
    term: 'MRR (Mean Reciprocal Rank)',
    stage: 'retrieve',
    definition:
      'The average of 1 / (rank of the first correct chunk) across test questions, counting 0 when none is found. It rewards putting the right chunk near the top, not just somewhere in the list.',
    example: 'Correct chunk at rank 1, 2 and not found → MRR = (1 + 0.5 + 0) / 3 = 0.5.',
    related: ['hit-rate', 'reranking'],
  },
  {
    id: 'precision',
    term: 'Precision',
    stage: 'retrieve',
    definition:
      'How much of what you retrieved is actually relevant. Precision@k is the fraction of the top-k chunks that are relevant. Huge chunks hurt precision because most of each chunk is about something else.',
    example: 'If 1 of 3 retrieved chunks is relevant, precision@3 = 0.33.',
    related: ['hit-rate', 'chunk-size', 'reranking'],
  },
  {
    id: 'reranking',
    term: 'Reranking',
    stage: 'retrieve',
    definition:
      'A second, more careful scoring pass over the first retrieval results, often with a cross-encoder model that reads the query and chunk together. It improves the order of results at extra cost per query.',
    example: 'Retrieve 25 chunks quickly, rerank them, keep the best 4.',
    related: ['retrieval', 'precision', 'hybrid-search'],
  },
  {
    id: 'hallucination',
    term: 'Hallucination',
    stage: 'generate',
    definition:
      'When a model states something that is false or not supported by its sources, often in a confident tone. In RAG it often happens when retrieval misses the right chunk or hands over half of it.',
    example: 'Answering "No refunds after 30 days" because the exception clause was cut off.',
    related: ['grounding', 'retrieval', 'llm'],
  },
  {
    id: 'grounding',
    term: 'Grounding',
    stage: 'generate',
    definition:
      'Making the model base its answer on the provided sources, ideally with citations, and say "I don’t know" when the sources don’t contain the answer. Good chunks make grounding possible; the prompt enforces it.',
    example: '"Answer only from the context below and cite the section. If the answer isn’t there, say so."',
    related: ['hallucination', 'metadata', 'rag'],
  },
  {
    id: 'metadata',
    term: 'Metadata',
    stage: 'store',
    definition:
      'Extra fields stored with each chunk, such as source file, page, section path, document type and last-updated date. Metadata enables citations, filters (e.g. only HR documents) and freshness checks.',
    example: '{ source: "refund-policy.md", section: "Standard refunds", updated: "2026-03-04" }',
    related: ['contextual-headers', 'vector-database', 'grounding'],
  },
  {
    id: 'parsing',
    term: 'Parsing (extraction)',
    stage: 'parse',
    definition:
      'Getting clean text and structure out of files such as PDF, HTML, DOCX or slides. Layout matters: multi-column pages, tables and headers can come out scrambled if the parser doesn’t understand them.',
    example: 'A two-column PDF read straight across mixes lines from both columns.',
    related: ['ocr', 'boilerplate', 'structure-aware'],
  },
  {
    id: 'ocr',
    term: 'OCR (Optical Character Recognition)',
    stage: 'parse',
    definition:
      'Turning images of text, such as scanned pages or photos, into actual text. A scanned PDF has no text layer, so without OCR there is nothing to chunk.',
    example: 'A scanned contract is run through OCR before chunking; low scan quality leads to typos in the text.',
    related: ['parsing', 'boilerplate'],
  },
  {
    id: 'boilerplate',
    term: 'Boilerplate',
    stage: 'parse',
    definition:
      'Repeated text that carries no useful information for answering questions: page headers and footers, navigation menus, cookie banners, legal footers. It wastes tokens and can pollute search results.',
    example: '"ACME Corp — Confidential — Page 3" repeated on every page.',
    related: ['parsing', 'token'],
  },
  {
    id: 'evaluation-set',
    term: 'Evaluation set',
    stage: null,
    definition:
      'A list of realistic questions with known answer locations, used to measure retrieval. It turns "this chunk size feels right" into numbers you can compare across configurations.',
    example: '20 real customer questions, each tagged with the exact policy sentence that answers it.',
    related: ['hit-rate', 'mrr', 'chunk-size'],
  },
];
