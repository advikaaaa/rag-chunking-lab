// Generates Python snippets that match the Chunk Lab settings.
// API names were checked against the langchain-text-splitters and
// langchain-experimental source (TextSplitter.from_tiktoken_encoder,
// TokenTextSplitter, RecursiveCharacterTextSplitter(keep_separator="end"),
// MarkdownHeaderTextSplitter(headers_to_split_on, strip_headers),
// NLTKTextSplitter, SemanticChunker(breakpoint_threshold_type, ...)).

const SEPARATORS = '["\\n\\n", "\\n", ". ", " ", ""]';

function headerSnippet(cfg) {
  if (!cfg.contextHeader) return '';
  if (cfg.strategy === 'markdown') {
    return `

# Contextual chunk headers: prepend the heading path to each chunk
for chunk in chunks:
    path = " › ".join(chunk.metadata[k] for k in ("h1", "h2", "h3") if k in chunk.metadata)
    chunk.page_content = f"{path}\\n{chunk.page_content}"`;
  }
  return `

# Contextual chunk headers: prepend the document title to each chunk
doc_title = "My document"
chunks = [f"{doc_title}\\n{chunk}" for chunk in chunks]`;
}

/** Returns { langchain, plain, notes } for a lab config. */
export function generateCode(cfg) {
  const tokens = cfg.unit !== 'chars';
  const size = cfg.size;
  const overlap = cfg.overlap;
  const notes = [];
  let lc;

  switch (cfg.strategy) {
    case 'fixed':
      lc = tokens
        ? `# pip install langchain-text-splitters tiktoken
from langchain_text_splitters import TokenTextSplitter

splitter = TokenTextSplitter(
    encoding_name="cl100k_base",
    chunk_size=${size},     # tokens
    chunk_overlap=${overlap},
)
chunks = splitter.split_text(document_text)`
        : `# pip install langchain-text-splitters
from langchain_text_splitters import CharacterTextSplitter

splitter = CharacterTextSplitter(
    separator="",          # "" = split anywhere, i.e. pure fixed-size
    chunk_size=${size},     # characters
    chunk_overlap=${overlap},
)
chunks = splitter.split_text(document_text)`;
      break;
    case 'sentence':
      lc = `# pip install langchain-text-splitters nltk${tokens ? ' tiktoken' : ''}
# First run only: python -m nltk.downloader punkt_tab
from langchain_text_splitters import NLTKTextSplitter

splitter = NLTKTextSplitter${tokens ? '.from_tiktoken_encoder(\n    encoding_name="cl100k_base",' : '('}
    chunk_size=${size},${tokens ? '     # tokens' : '     # characters'}
    chunk_overlap=${overlap},
)
chunks = splitter.split_text(document_text)`;
      notes.push('NLTKTextSplitter packs whole sentences up to the limit, like the lab. Its overlap is measured in tokens/characters, not whole sentences.');
      break;
    case 'recursive':
      lc = `# pip install langchain-text-splitters${tokens ? ' tiktoken' : ''}
from langchain_text_splitters import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter${tokens ? '.from_tiktoken_encoder(\n    encoding_name="cl100k_base",' : '('}
    chunk_size=${size},${tokens ? '     # tokens' : '     # characters'}
    chunk_overlap=${overlap},
    separators=${SEPARATORS},
    keep_separator="end",   # keep ". " at the end of a sentence, like the lab
)
chunks = splitter.split_text(document_text)`;
      break;
    case 'markdown':
      lc = `# pip install langchain-text-splitters${tokens ? ' tiktoken' : ''}
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter

# 1) Split on headings; each section remembers its heading path as metadata.
header_splitter = MarkdownHeaderTextSplitter(
    headers_to_split_on=[("#", "h1"), ("##", "h2"), ("###", "h3")],
    strip_headers=False,
)
sections = header_splitter.split_text(markdown_text)

# 2) Size-limit sections that are still too long.
size_splitter = RecursiveCharacterTextSplitter${tokens ? '.from_tiktoken_encoder(\n    encoding_name="cl100k_base",' : '('}
    chunk_size=${size},
    chunk_overlap=${overlap},
)
chunks = size_splitter.split_documents(sections)`;
      notes.push('Unlike the lab, LangChain’s splitter does not protect tables from being cut when a section has to be sub-split. Keep tables in their own section, or handle them separately.');
      break;
    case 'semantic':
      lc = `# pip install langchain-experimental langchain-huggingface sentence-transformers
from langchain_experimental.text_splitter import SemanticChunker
from langchain_huggingface import HuggingFaceEmbeddings

embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
splitter = SemanticChunker(
    embeddings,
    breakpoint_threshold_type="percentile",
    breakpoint_threshold_amount=${cfg.percentile ?? 95},
)
chunks = splitter.split_text(document_text)`;
      notes.push(`SemanticChunker has no maximum chunk size. The lab also caps chunks at ${size} ${tokens ? 'tokens' : 'characters'}; to do the same, run oversized chunks through a RecursiveCharacterTextSplitter.`);
      break;
    default:
      lc = '# Unknown strategy';
  }
  lc += headerSnippet(cfg);

  const charSize = tokens ? size * 4 : size;
  const charOverlap = tokens ? overlap * 4 : overlap;
  const plain = `# Dependency-free fixed-size chunking with overlap (characters).
${tokens ? `# ${size} tokens ≈ ${charSize} characters, using the rough 4 chars/token rule for English.\n` : ''}def chunk_text(text: str, size: int = ${charSize}, overlap: int = ${charOverlap}) -> list[str]:
    if not 0 <= overlap < size:
        raise ValueError("overlap must be >= 0 and smaller than size")
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        chunks.append(text[start:end].strip())
        if end == len(text):
            break
        start = end - overlap   # step back so neighbours share \`overlap\` characters
    return [c for c in chunks if c]

chunks = chunk_text(document_text)`;

  return { langchain: lc, plain, notes };
}
