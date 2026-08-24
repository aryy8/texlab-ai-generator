/**
 * Catalog embedding index for OpenTikZ.
 * Embeds description + name + tags; caches to disk; rebuilds when catalog.json changes.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CATALOG_PATH, CACHE_DIR, EMBEDDING_CACHE_PATH } from "./paths.js";
import { createEmbeddings, EMBEDDING_MODEL, getApiKey } from "./openrouter.js";

function catalogHash(catalogBytes) {
  return createHash("sha256").update(catalogBytes).digest("hex");
}

export function loadCatalog(catalogPath = CATALOG_PATH) {
  const bytes = readFileSync(catalogPath);
  const entries = JSON.parse(bytes.toString("utf8"));
  if (!Array.isArray(entries)) {
    throw new Error("OpenTikZ catalog.json must be a JSON array.");
  }
  return { entries, hash: catalogHash(bytes), bytes };
}

export function entryEmbedText(entry) {
  const tags = Array.isArray(entry.tags) ? entry.tags.join(", ") : "";
  const domain = Array.isArray(entry.domain) ? entry.domain.join(", ") : "";
  return [
    entry.name || "",
    entry.description || "",
    tags ? `Tags: ${tags}` : "",
    domain ? `Domain: ${domain}` : "",
    entry.type ? `Type: ${entry.type}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function loadCache(cachePath = EMBEDDING_CACHE_PATH) {
  if (!existsSync(cachePath)) return null;
  try {
    return JSON.parse(readFileSync(cachePath, "utf8"));
  } catch {
    return null;
  }
}

function cacheIsValid(cache, hash, model) {
  return (
    cache
    && cache.catalogHash === hash
    && cache.model === model
    && Array.isArray(cache.entries)
    && cache.entries.length > 0
    && cache.entries.every((e) => e.id && Array.isArray(e.embedding) && e.embedding.length > 0)
  );
}

/**
 * Load the embedding index from cache, or rebuild via OpenRouter.
 * @returns {Promise<{ catalogHash: string, model: string, entries: object[], rebuilt: boolean }>}
 */
export async function getCatalogIndex(options = {}) {
  const catalogPath = options.catalogPath || CATALOG_PATH;
  const cachePath = options.cachePath || EMBEDDING_CACHE_PATH;
  const model = options.model || EMBEDDING_MODEL;
  const forceRebuild = Boolean(options.forceRebuild);

  const { entries: catalog, hash } = loadCatalog(catalogPath);
  const existing = loadCache(cachePath);

  if (!forceRebuild && cacheIsValid(existing, hash, model)) {
    return {
      catalogHash: existing.catalogHash,
      model: existing.model,
      entries: existing.entries,
      rebuilt: false,
      createdAt: existing.createdAt,
    };
  }

  const apiKey = options.apiKey || getApiKey();
  const texts = catalog.map(entryEmbedText);
  console.log(`Building catalog embedding index (${catalog.length} entries, model=${model})…`);
  const vectors = await createEmbeddings(texts, { model, apiKey });

  const indexed = catalog.map((entry, i) => ({
    id: entry.id,
    name: entry.name,
    type: entry.type,
    path: entry.path,
    tags: entry.tags || [],
    description: entry.description || "",
    requires: entry.requires || [],
    embedding: vectors[i],
  }));

  const payload = {
    catalogHash: hash,
    model,
    createdAt: new Date().toISOString(),
    entries: indexed,
  };

  mkdirSync(options.cacheDir || CACHE_DIR, { recursive: true });
  writeFileSync(cachePath, JSON.stringify(payload));
  console.log(`Wrote embedding cache → ${cachePath}`);

  return {
    catalogHash: hash,
    model,
    entries: indexed,
    rebuilt: true,
    createdAt: payload.createdAt,
  };
}
