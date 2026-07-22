#!/usr/bin/env node
/**
 * Generate gallery previews through the SAME pipeline as the app:
 * templates.json prompt + preferences → generate-latex → preview doc → compile → QA → PNG
 *
 *   npm run templates:previews              # all templates, one by one
 *   npm run templates:previews -- timeline  # single template
 *   npm run templates:previews -- --curated   # hand-authored sources (dev only)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import generateLatex from "../api/generate-latex.js";
import compileLatex from "../api/compile-latex.js";
import { buildPreviewDocument } from "./lib/preview-document.mjs";
import { pdfToPng } from "./lib/pdf-to-png.mjs";
import { validateFigureFit, validateTemplateRichness } from "./lib/fit-validation.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(ROOT, "public/templates");
const SOURCES_DIR = resolve(__dirname, "template-sources");
const TEMPLATES_PATH = resolve(ROOT, "src/lib/templates.json");

const MAX_GENERATE_ROUNDS = 1;
const MAX_COMPILE_REPAIRS = 2;
const MAX_FIT_REFINES = 1;

const args = process.argv.slice(2);
const USE_CURATED = args.includes("--curated");
const FILTER = args.find((a) => !a.startsWith("--")) ?? "";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(ROOT, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

function invokeHandler(handler, body) {
  return new Promise((resolvePromise, reject) => {
    let statusCode = 200;
    let settled = false;
    const res = {
      status(code) {
        statusCode = code;
        return res;
      },
      setHeader() {
        return res;
      },
      json(data) {
        if (settled) return;
        settled = true;
        resolvePromise({ status: statusCode, json: data });
      },
      send(buf) {
        if (settled) return;
        settled = true;
        resolvePromise({ status: statusCode, body: Buffer.isBuffer(buf) ? buf : Buffer.from(buf) });
      },
    };
    Promise.resolve(
      handler({ method: "POST", body, headers: {}, socket: { remoteAddress: "127.0.0.1" } }, res),
    ).catch(reject);
  });
}

async function compile(source) {
  const result = await invokeHandler(compileLatex, { source });
  if (result.body?.length >= 4 && result.body.subarray(0, 4).toString() === "%PDF") {
    return result.body;
  }
  return { error: result.body?.toString("utf8") ?? JSON.stringify(result.json) };
}

function templatePreferences(t) {
  return {
    outputType: t.outputType,
    style: t.style,
    colorMode: t.colorMode,
    density: t.density,
    aspectRatio: t.aspectRatio,
    arrowStyle: t.arrowStyle,
    documentFit: t.documentFit,
  };
}

async function callGenerate({ prompt, preferences, mode = "generate", baseLatex }) {
  let lastErr = "unknown error";
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const result = await invokeHandler(generateLatex, {
        prompt,
        preferences,
        mode,
        ...(baseLatex ? { baseLatex } : {}),
      });
      if (result.json?.content) return result.json.content;
      lastErr = result.json?.error ?? `HTTP ${result.status}`;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }

    const transient =
      /rate.?limit|too many requests|please wait|timeout|empty response|did not respond|502|503|504/i.test(
        lastErr,
      );
    if (!transient || attempt === 4) break;
    const wait = (Number(String(lastErr).match(/(\d+)s/)?.[1]) || 20) + 3;
    process.stderr.write(`  ⏳ retry ${attempt + 1}/5 in ${wait}s (${lastErr.slice(0, 80)})\n`);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
  throw new Error(`generate failed: ${lastErr}`);
}

async function compileWithRepairs(latex, preferences, template) {
  let current = latex;
  let doc = buildPreviewDocument(current, template.documentFit);

  for (let repair = 0; repair <= MAX_COMPILE_REPAIRS; repair++) {
    const compiled = await compile(doc);
    if (Buffer.isBuffer(compiled)) {
      return { ok: true, latex: current, doc, pdf: compiled };
    }
    if (repair === MAX_COMPILE_REPAIRS) {
      const logPath = resolve(OUT_DIR, `${template.id}-compile.log`);
      writeFileSync(logPath, compiled.error ?? "");
      return { ok: false, error: "compile failed", logPath };
    }
    process.stderr.write(`  ↻ compile repair ${repair + 1}\n`);
    current = await callGenerate({
      prompt: String(compiled.error).slice(0, 18000),
      preferences,
      mode: "repair",
      baseLatex: current,
    });
    doc = buildPreviewDocument(current, template.documentFit);
  }
  return { ok: false, error: "compile failed" };
}

async function maybeFitRefine(latex, preferences, template, fit) {
  if (
    fit.status !== "cropped" &&
    fit.status !== "may_overflow"
  ) {
    return latex;
  }
  if (template.documentFit !== "column" && template.documentFit !== "fullpage") {
    return latex;
  }

  const instruction =
    template.documentFit === "column"
      ? "The figure is cropped or overflows on the right. Reflow and scale so the entire content fits within an IEEE two-column width (~8.5cm). Do not remove content."
      : "The figure is cropped or overflows. Reflow and scale so the entire content fits within full text width (~17cm). Do not remove content.";

  process.stderr.write(`  ↻ fit refine (${fit.status})\n`);
  return callGenerate({
    prompt: instruction,
    preferences,
    mode: "refine",
    baseLatex: latex,
  });
}

async function generateTemplatePreview(template) {
  const preferences = templatePreferences(template);
  process.stderr.write(`\n▶ ${template.id} — "${template.title}"\n`);
  process.stderr.write(`  prompt: ${template.prompt.slice(0, 72)}…\n`);

  let lastIssues = [];

  for (let round = 1; round <= MAX_GENERATE_ROUNDS; round++) {
    if (round > 1) {
      process.stderr.write(`  ↻ regenerate round ${round}/${MAX_GENERATE_ROUNDS} (QA failed: ${lastIssues.join("; ")})\n`);
    }

    let latex = await callGenerate({
      prompt: template.prompt,
      preferences,
      mode: "generate",
    });

    let compiled = await compileWithRepairs(latex, preferences, template);
    if (!compiled.ok) {
      lastIssues = [compiled.error];
      continue;
    }

    latex = compiled.latex;
    let png = await pdfToPng(compiled.pdf);
    let fit = await validateFigureFit(png, template.documentFit);

    for (let refine = 0; refine < MAX_FIT_REFINES; refine++) {
      if (fit.status !== "cropped" && fit.status !== "may_overflow") break;
      latex = await maybeFitRefine(latex, preferences, template, fit);
      compiled = await compileWithRepairs(latex, preferences, template);
      if (!compiled.ok) break;
      latex = compiled.latex;
      png = await pdfToPng(compiled.pdf);
      fit = await validateFigureFit(png, template.documentFit);
    }

    const richness = validateTemplateRichness(latex, template, fit);
    if (!richness.ok) {
      lastIssues = richness.issues;
      const failLog = resolve(OUT_DIR, `${template.id}-qa-round-${round}.log`);
      writeFileSync(
        failLog,
        [`fit: ${fit.status}`, `issues: ${richness.issues.join(", ")}`, "", latex].join("\n"),
      );
      continue;
    }

    writeFileSync(resolve(OUT_DIR, `${template.id}.png`), png);
    writeFileSync(resolve(OUT_DIR, `${template.id}.tex`), compiled.doc);
    writeFileSync(resolve(OUT_DIR, `${template.id}-snippet.tex`), latex);

    process.stderr.write(
      `  ✓ saved (${Math.round(png.length / 1024)} KB, fit=${fit.status}, area=${(fit.contentAreaRatio * 100).toFixed(1)}%)\n`,
    );

    return {
      id: template.id,
      ok: true,
      fit: fit.status,
      contentAreaRatio: fit.contentAreaRatio,
      rounds: round,
    };
  }

  const failPath = resolve(OUT_DIR, `${template.id}-fail.log`);
  writeFileSync(failPath, `QA failed after ${MAX_GENERATE_ROUNDS} rounds.\nLast issues: ${lastIssues.join("; ")}\n`);
  process.stderr.write(`  ✕ QA failed after ${MAX_GENERATE_ROUNDS} rounds (see ${failPath})\n`);
  return { id: template.id, ok: false, error: lastIssues.join("; ") };
}

async function compileCurated(template) {
  const sourcePath = resolve(SOURCES_DIR, `${template.id}.tex`);
  if (!existsSync(sourcePath)) {
    return { id: template.id, ok: false, error: `Missing ${sourcePath}` };
  }
  const source = readFileSync(sourcePath, "utf8");
  process.stderr.write(`\n▶ ${template.id} — curated source\n`);
  const compiled = await compile(source);
  if (!Buffer.isBuffer(compiled)) {
    return { id: template.id, ok: false, error: "compile failed" };
  }
  const png = await pdfToPng(compiled);
  writeFileSync(resolve(OUT_DIR, `${template.id}.png`), png);
  writeFileSync(resolve(OUT_DIR, `${template.id}.tex`), source);
  process.stderr.write(`  ✓ ${template.id}.png\n`);
  return { id: template.id, ok: true };
}

async function main() {
  loadEnv();

  if (!process.env.OPEN_ROUTER_API && !USE_CURATED) {
    console.error("OPEN_ROUTER_API is required. Set it in .env.local or pass --curated.");
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const templates = JSON.parse(readFileSync(TEMPLATES_PATH, "utf8"));
  const selected = templates.filter((t) => !FILTER || t.id.includes(FILTER));

  if (selected.length === 0) {
    console.error(`No templates matched "${FILTER}"`);
    process.exit(1);
  }

  const mode = USE_CURATED ? "curated (dev)" : "app pipeline (generate → compile → QA)";
  process.stderr.write(`Template previews [${mode}]: ${selected.length} template(s), sequential\n`);

  const results = [];
  for (const template of selected) {
    try {
      results.push(USE_CURATED ? await compileCurated(template) : await generateTemplatePreview(template));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`  ✕ ${template.id} crashed: ${message}\n`);
      results.push({ id: template.id, ok: false, error: message });
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  writeFileSync(
    resolve(OUT_DIR, "manifest.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mode: USE_CURATED ? "curated" : "app-pipeline",
        templates: results.map((r) => ({
          id: r.id,
          ok: r.ok,
          preview: r.ok ? `/templates/${r.id}.png` : null,
          fit: r.fit ?? null,
          rounds: r.rounds ?? null,
          error: r.error ?? null,
        })),
      },
      null,
      2,
    ),
  );

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} previews → public/templates/`);
  if (passed < results.length) {
    console.log("Failed:", results.filter((r) => !r.ok).map((r) => r.id).join(", "));
  }
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
