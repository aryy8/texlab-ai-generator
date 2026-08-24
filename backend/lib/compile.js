/**
 * Compile LaTeX with local pdflatex when available; otherwise texlive.net.
 * Produce PDF, optional SVG, and PNG preview.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WORK_DIR } from "./paths.js";

const TEXLIVE_NET = "https://texlive.net/cgi-bin/latexcgi";
const MAX_REPAIR_ATTEMPTS = 3;

function run(cmd, args, cwd, timeoutMs = 60_000) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env: process.env });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ code: -1, stdout, stderr: stderr + "\n[timeout]" });
    }, timeoutMs);
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: err.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

export function findPdflatex() {
  const candidates = [
    process.env.PDFLATEX_PATH,
    "pdflatex",
    "/Library/TeX/texbin/pdflatex",
    "/usr/local/texlive/2025/bin/universal-darwin/pdflatex",
    "/usr/local/texlive/2024/bin/universal-darwin/pdflatex",
    "/usr/bin/pdflatex",
  ].filter(Boolean);

  // Prefer an absolute path that exists; otherwise try bare name via `which`.
  for (const c of candidates) {
    if (c.includes("/") && existsSync(c)) return c;
  }
  return "pdflatex";
}

async function compileLocal(latex, workDir) {
  const texPath = join(workDir, "figure.tex");
  writeFileSync(texPath, latex);
  const pdflatex = findPdflatex();
  const result = await run(
    pdflatex,
    ["-interaction=nonstopmode", "-halt-on-error", "figure.tex"],
    workDir,
  );
  const log = `${result.stdout}\n${result.stderr}`;
  const pdfPath = join(workDir, "figure.pdf");
  if (result.code === 0 && existsSync(pdfPath)) {
    return { ok: true, pdf: readFileSync(pdfPath), log, engine: "local-pdflatex" };
  }
  return { ok: false, pdf: null, log, engine: "local-pdflatex" };
}

async function compileRemote(latex) {
  const form = new FormData();
  form.append("filecontents[]", latex);
  form.append("filename[]", "document.tex");
  form.append("engine", "pdflatex");
  form.append("return", "pdf");

  const upstream = await fetch(TEXLIVE_NET, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(45_000),
    redirect: "follow",
  });

  const contentType = upstream.headers.get("content-type") ?? "";
  if (contentType.includes("application/pdf")) {
    return {
      ok: true,
      pdf: Buffer.from(await upstream.arrayBuffer()),
      log: "",
      engine: "texlive.net",
    };
  }
  const log = await upstream.text();
  return { ok: false, pdf: null, log, engine: "texlive.net" };
}

async function tryLocalThenRemote(latex, workDir) {
  const local = await compileLocal(latex, workDir);
  if (local.ok) return local;
  // If pdflatex binary missing, fall through quickly to remote.
  const missing =
    /ENOENT|not found|spawn .* ENOENT/i.test(local.log)
    || /command not found/i.test(local.log);
  if (!missing && local.log.includes("!")) {
    // Real TeX error — don't hide it behind remote.
    return local;
  }
  try {
    return await compileRemote(latex);
  } catch (error) {
    return {
      ok: false,
      pdf: null,
      log: local.log || String(error),
      engine: "none",
    };
  }
}

async function pdfToSvg(pdfPath, svgPath, workDir) {
  const tools = [
    ["pdftocairo", ["-svg", pdfPath, svgPath]],
    ["pdf2svg", [pdfPath, svgPath]],
  ];
  for (const [cmd, args] of tools) {
    const result = await run(cmd, args, workDir, 30_000);
    if (result.code === 0 && existsSync(svgPath)) {
      return readFileSync(svgPath);
    }
  }
  return null;
}

async function pdfToPng(pdfBuffer) {
  try {
    const { pdfToPng: render } = await import("../../scripts/lib/pdf-to-png.mjs");
    return await render(pdfBuffer, { minWidth: 1200 });
  } catch (error) {
    console.error("pdf→png failed:", error.message);
  }

  // Last-resort CLI tools.
  const dir = mkdtempSync(join(tmpdir(), "texlab-png-"));
  try {
    const pdfPath = join(dir, "figure.pdf");
    writeFileSync(pdfPath, pdfBuffer);
    const pngPath = join(dir, "figure.png");
    let result = await run("pdftocairo", ["-png", "-singlefile", "-r", "144", pdfPath, join(dir, "figure")], dir);
    if (result.code === 0 && existsSync(pngPath)) return readFileSync(pngPath);
    result = await run("convert", ["-density", "144", `${pdfPath}[0]`, pngPath], dir);
    if (result.code === 0 && existsSync(pngPath)) return readFileSync(pngPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return null;
}

/**
 * Compile once (no repair). Returns artifacts + log.
 */
export async function compileOnce(latex, options = {}) {
  mkdirSync(WORK_DIR, { recursive: true });
  const hash = createHash("sha1").update(latex).digest("hex").slice(0, 10);
  const workDir = options.workDir || join(WORK_DIR, `job-${hash}-${Date.now()}`);
  mkdirSync(workDir, { recursive: true });

  const compiled = await tryLocalThenRemote(latex, workDir);
  let svg = null;
  let png = null;

  if (compiled.ok && compiled.pdf) {
    writeFileSync(join(workDir, "figure.pdf"), compiled.pdf);
    svg = await pdfToSvg(join(workDir, "figure.pdf"), join(workDir, "figure.svg"), workDir);
    png = await pdfToPng(compiled.pdf);
    if (png) writeFileSync(join(workDir, "figure.png"), png);
    if (svg) writeFileSync(join(workDir, "figure.svg"), svg);
  }

  return {
    ...compiled,
    workDir,
    svg,
    png,
  };
}

export { MAX_REPAIR_ATTEMPTS };
