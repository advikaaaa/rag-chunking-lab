// Lazy wrapper around Transformers.js for sentence embeddings.
// Nothing is downloaded until the learner explicitly asks for it.

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
export const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
export const MODEL_SIZE_NOTE = 'about 25 MB';

let extractor = null;
let loading = null;
const cache = new Map();

export function isModelReady() {
  return extractor !== null;
}

/**
 * Loads the embedding model. onProgress receives a number 0-100 (or null
 * when the size is unknown).
 */
export function loadModel(onProgress = () => {}) {
  if (!loading) {
    loading = (async () => {
      const { pipeline } = await import(TRANSFORMERS_URL);
      const files = new Map();
      extractor = await pipeline('feature-extraction', MODEL_ID, {
        dtype: 'q8', // 8-bit quantised weights: the small download
        progress_callback: (p) => {
          if (p.status === 'progress' && p.total) {
            files.set(p.file, { loaded: p.loaded, total: p.total });
            let loaded = 0;
            let total = 0;
            for (const f of files.values()) {
              loaded += f.loaded;
              total += f.total;
            }
            onProgress(Math.round((100 * loaded) / total));
          }
        },
      });
      return true;
    })().catch((err) => {
      loading = null; // allow a retry
      throw err;
    });
  }
  return loading;
}

/** Embeds texts (mean-pooled, normalised). Results are cached per text. */
export async function embed(texts) {
  if (!extractor) throw new Error('Model not loaded');
  const missing = [...new Set(texts.filter((t) => !cache.has(t)))];
  const BATCH = 32;
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    const out = await extractor(batch, { pooling: 'mean', normalize: true });
    out.tolist().forEach((vec, j) => cache.set(batch[j], vec));
  }
  return texts.map((t) => cache.get(t));
}
