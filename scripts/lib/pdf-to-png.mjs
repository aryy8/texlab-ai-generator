/**
 * Rasterize PDF → high-res PNG for crisp gallery thumbnails.
 * macOS: qlmanage true render. Other platforms: pdfjs or sips fallback.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_MIN_WIDTH = 2400;
const __dirname = dirname(fileURLToPath(import.meta.url));

let pdfjsPromise;

async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((mod) => {
      const workerPath = join(__dirname, "../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");
      mod.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
      return mod;
    });
  }
  return pdfjsPromise;
}

function pdfToPngQlmanage(pdfBuffer, minWidth = DEFAULT_MIN_WIDTH) {
  const dir = mkdtempSync(join(tmpdir(), "texlab-preview-"));
  const pdfPath = join(dir, "page.pdf");
  try {
    writeFileSync(pdfPath, pdfBuffer);
    execFileSync("qlmanage", ["-t", "-s", String(minWidth), "-o", dir, pdfPath], { stdio: "pipe" });
    const pngPath = join(dir, "page.pdf.png");
    if (!existsSync(pngPath)) {
      const found = readdirSync(dir).find((f) => f.endsWith(".png"));
      if (!found) throw new Error("qlmanage produced no PNG");
      return readFileSync(join(dir, found));
    }
    return readFileSync(pngPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function pdfToPngSips(pdfBuffer, minWidth = DEFAULT_MIN_WIDTH) {
  const dir = mkdtempSync(join(tmpdir(), "texlab-preview-"));
  const pdfPath = join(dir, "page.pdf");
  const pngPath = join(dir, "page.png");
  const hiResPath = join(dir, "page-hi.png");
  try {
    writeFileSync(pdfPath, pdfBuffer);
    execFileSync("sips", ["-s", "format", "png", pdfPath, "--out", pngPath], { stdio: "pipe" });
    execFileSync("sips", ["-Z", String(minWidth), pngPath, "--out", hiResPath], { stdio: "pipe" });
    return readFileSync(hiResPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function pdfToPngPdfjs(pdfBuffer, minWidth = DEFAULT_MIN_WIDTH) {
  const pdfjs = await getPdfjs();
  const data = new Uint8Array(pdfBuffer);
  const pdf = await pdfjs.getDocument({ data }).promise;
  const page = await pdf.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.max(3, minWidth / base.width);
  const viewport = page.getViewport({ scale });

  const { createCanvas } = await import("@napi-rs/canvas");
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: context, viewport }).promise;
  return canvas.toBuffer("image/png");
}

/**
 * @param {Buffer} pdfBuffer
 * @param {{ minWidth?: number }} [opts]
 * @returns {Promise<Buffer>}
 */
export async function pdfToPng(pdfBuffer, { minWidth = DEFAULT_MIN_WIDTH } = {}) {
  if (process.platform === "darwin") {
    try {
      return pdfToPngQlmanage(pdfBuffer, minWidth);
    } catch (err) {
      process.stderr.write(`  ⚠ qlmanage failed (${err.message}), falling back to sips\n`);
      return pdfToPngSips(pdfBuffer, minWidth);
    }
  }

  try {
    return await pdfToPngPdfjs(pdfBuffer, minWidth);
  } catch (err) {
    process.stderr.write(`  ⚠ pdfjs render failed (${err.message}), falling back to sips\n`);
    return pdfToPngSips(pdfBuffer, minWidth);
  }
}
