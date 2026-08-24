#!/usr/bin/env node
/**
 * Smoke-test retrieval against the three verification prompts.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { retrieveCatalogMatches } from "../lib/retrieve.js";
import { getCatalogIndex } from "../lib/catalog-index.js";

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

const CASES = [
  {
    prompt: "encoder-decoder architecture with cross-attention",
    expectPath: "template",
    expectIdIncludes: ["encoder-decoder"],
  },
  {
    prompt: "GAN generator and discriminator",
    expectPath: "template",
    expectIdIncludes: ["gan"],
  },
  {
    prompt: "Venn diagram of three overlapping sets A, B, C",
    expectPath: "blank",
  },
];

async function main() {
  loadEnvLocal();
  await getCatalogIndex();

  let failed = 0;
  for (const c of CASES) {
    const result = await retrieveCatalogMatches(c.prompt);
    const top = result.matches[0];
    const idOk =
      !c.expectIdIncludes
      || c.expectIdIncludes.some((id) => top?.id === id || result.best?.id === id);
    const pathOk = result.path === c.expectPath;
    const ok = pathOk && idOk;
    if (!ok) failed += 1;
    console.log(
      JSON.stringify(
        {
          prompt: c.prompt,
          ok,
          path: result.path,
          matched: result.matched,
          best: result.best
            ? { id: result.best.id, type: result.best.type, score: Number(result.best.score.toFixed(4)) }
            : null,
          top3: result.matches.slice(0, 3).map((m) => ({
            id: m.id,
            type: m.type,
            score: Number(m.score.toFixed(4)),
          })),
        },
        null,
        2,
      ),
    );
  }
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
