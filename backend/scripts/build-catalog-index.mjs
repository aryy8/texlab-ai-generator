#!/usr/bin/env node
/**
 * Build (or refresh) the OpenTikZ catalog embedding index.
 *
 * Usage:
 *   node backend/scripts/build-catalog-index.mjs
 *   node backend/scripts/build-catalog-index.mjs --force
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getCatalogIndex, loadCatalog, entryEmbedText } from "../lib/catalog-index.js";
import { CATALOG_PATH, EMBEDDING_CACHE_PATH } from "../lib/paths.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

function loadEnvLocal() {
  const envPath = resolve(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();
  const forceRebuild = process.argv.includes("--force");

  if (!existsSync(CATALOG_PATH)) {
    console.error(`Missing OpenTikZ catalog at ${CATALOG_PATH}`);
    console.error("Clone it first: git clone --depth 1 https://github.com/opentikz/opentikz.git backend/opentikz");
    process.exit(1);
  }

  const { entries } = loadCatalog();
  console.log(`Catalog: ${entries.length} entries`);
  console.log(`Sample embed text:\n---\n${entryEmbedText(entries[0]).slice(0, 280)}\n---`);

  const index = await getCatalogIndex({ forceRebuild });
  console.log(
    JSON.stringify(
      {
        rebuilt: index.rebuilt,
        model: index.model,
        catalogHash: index.catalogHash.slice(0, 12),
        entries: index.entries.length,
        dims: index.entries[0]?.embedding?.length ?? 0,
        cache: EMBEDDING_CACHE_PATH,
        createdAt: index.createdAt,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
