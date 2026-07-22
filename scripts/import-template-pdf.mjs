#!/usr/bin/env node
/**
 * Convert a manually generated teXlab PDF into a sharp gallery preview.
 *
 *   npm run templates:import -- cnn-mnist
 *   npm run templates:import -- cnn-mnist public/templates/my-export.pdf
 *   npm run templates:import -- cnn-mnist --width 3200
 *
 * Drop PDFs in public/templates/, then run with the template id.
 * Output: public/templates/{id}.png (+ keeps source PDF as {id}.pdf if renamed)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(ROOT, "public/templates");
const TEMPLATES_PATH = resolve(ROOT, "src/lib/templates.json");

const args = process.argv.slice(2);
const templateId = args.find((a) => !a.startsWith("--"));
const widthArg = args.find((a) => a.startsWith("--width="))?.split("=")[1]
  ?? (args.includes("--width") ? args[args.indexOf("--width") + 1] : null);
const pdfArg = args.find((a) => !a.startsWith("--") && a !== templateId && a.endsWith(".pdf"));

const RENDER_WIDTH = Number(widthArg) || 2400;

function renderPdfToPng(pdfPath, minWidth = RENDER_WIDTH) {
  if (process.platform === "darwin") {
    const dir = mkdtempSync(join(tmpdir(), "texlab-import-"));
    try {
      execFileSync(
        "qlmanage",
        ["-t", "-s", String(minWidth), "-o", dir, pdfPath],
        { stdio: "pipe" },
      );
      const pngName = `${basename(pdfPath)}.png`;
      const rendered = join(dir, pngName);
      if (!existsSync(rendered)) {
        const found = readdirSync(dir).find((f) => f.endsWith(".png"));
        if (!found) throw new Error(`qlmanage produced no PNG for ${pdfPath}`);
        return readFileSync(join(dir, found));
      }
      return readFileSync(rendered);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // Non-macOS fallback: sips (lower quality)
  const dir = mkdtempSync(join(tmpdir(), "texlab-import-"));
  const out = join(dir, "out.png");
  const hi = join(dir, "hi.png");
  try {
    execFileSync("sips", ["-s", "format", "png", pdfPath, "--out", out], { stdio: "pipe" });
    execFileSync("sips", ["-Z", String(minWidth), out, "--out", hi], { stdio: "pipe" });
    return readFileSync(hi);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function findDroppedPdf(templateId) {
  const canonical = resolve(OUT_DIR, `${templateId}.pdf`);
  if (existsSync(canonical)) return canonical;

  const pdfs = readdirSync(OUT_DIR)
    .filter((f) => f.endsWith(".pdf") && f !== `${templateId}.pdf`)
    .map((f) => resolve(OUT_DIR, f));

  if (pdfs.length === 1) return pdfs[0];
  if (pdfs.length === 0) return null;

  // Prefer most recently modified unknown PDF
  pdfs.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return pdfs[0];
}

async function main() {
  if (!templateId) {
    console.error("Usage: npm run templates:import -- <template-id> [path/to/file.pdf] [--width 2400]");
    process.exit(1);
  }

  const templates = JSON.parse(readFileSync(TEMPLATES_PATH, "utf8"));
  if (!templates.some((t) => t.id === templateId)) {
    console.error(`Unknown template id "${templateId}". Valid: ${templates.map((t) => t.id).join(", ")}`);
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  let pdfPath = pdfArg ? resolve(ROOT, pdfArg) : findDroppedPdf(templateId);
  if (!pdfPath || !existsSync(pdfPath)) {
    console.error(`No PDF found. Drop one in public/templates/ or pass a path.`);
    process.exit(1);
  }

  process.stderr.write(`▶ ${templateId} ← ${basename(pdfPath)} (render @ ${RENDER_WIDTH}px)\n`);

  const png = renderPdfToPng(pdfPath, RENDER_WIDTH);
  const outPng = resolve(OUT_DIR, `${templateId}.png`);
  writeFileSync(outPng, png);

  const archivePdf = resolve(OUT_DIR, `${templateId}.pdf`);
  if (pdfPath !== archivePdf) {
    try {
      renameSync(pdfPath, archivePdf);
      process.stderr.write(`  archived PDF → ${templateId}.pdf\n`);
    } catch {
      // keep original if rename fails (e.g. cross-device)
    }
  }

  process.stderr.write(`  ✓ ${outPng} (${Math.round(png.length / 1024)} KB)\n`);

  // Update manifest
  const manifestPath = resolve(OUT_DIR, "manifest.json");
  let manifest = { templates: [] };
  if (existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch {
      /* fresh */
    }
  }
  const entry = {
    id: templateId,
    ok: true,
    preview: `/templates/${templateId}.png`,
    source: `manual-pdf`,
    importedAt: new Date().toISOString(),
  };
  const idx = manifest.templates?.findIndex((t) => t.id === templateId) ?? -1;
  if (idx >= 0) manifest.templates[idx] = { ...manifest.templates[idx], ...entry };
  else manifest.templates = [...(manifest.templates ?? []), entry];
  manifest.updatedAt = new Date().toISOString();
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`Done: /templates/${templateId}.png`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
