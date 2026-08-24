/**
 * Retrieve top-k OpenTikZ catalog entries by cosine similarity.
 */

import { createEmbeddings } from "./openrouter.js";
import { getCatalogIndex } from "./catalog-index.js";

/** Below this best-score, treat as no-match → blank-canvas fallback. */
export const MATCH_THRESHOLD = 0.42;

export function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * @returns {Promise<{
 *   matches: Array<{ id, name, type, path, score, tags, description, requires }>,
 *   best: object|null,
 *   matched: boolean,
 *   path: 'template'|'blank',
 * }>}
 */
export async function retrieveCatalogMatches(prompt, options = {}) {
  const topK = options.topK ?? 5;
  const threshold = options.threshold ?? MATCH_THRESHOLD;
  const index = options.index || (await getCatalogIndex(options));

  const [queryEmbedding] = await createEmbeddings([prompt], {
    model: index.model,
    apiKey: options.apiKey,
  });

  const scored = index.entries
    .map((entry) => {
      const { embedding, ...rest } = entry;
      return {
        ...rest,
        score: cosineSimilarity(queryEmbedding, embedding),
      };
    })
    .sort((a, b) => b.score - a.score);

  const matches = scored.slice(0, topK);
  const best = matches[0] || null;

  // Icon-only best match → blank canvas (icons are atomic, not full figures).
  const usable = best && best.score >= threshold && best.type !== "icon";
  return {
    matches,
    best: usable ? best : best?.score >= threshold ? best : null,
    matched: Boolean(usable),
    path: usable ? "template" : "blank",
    threshold,
    iconOnly: Boolean(best && best.score >= threshold && best.type === "icon"),
  };
}
