/**
 * Full OpenTikZ generation pipeline.
 */

import { retrieveCatalogMatches } from "./retrieve.js";
import {
  generateFromTemplate,
  generateBlankCanvas,
  repairLatex,
  reviseFromJudge,
  summarizeCompileLog,
} from "./generate.js";
import { compileOnce, MAX_REPAIR_ATTEMPTS } from "./compile.js";
import { judgeFigure, SCORE_FLOOR } from "./judge.js";

function toBase64(buf) {
  return buf ? Buffer.from(buf).toString("base64") : null;
}

async function compileWithRepair(latex, options = {}) {
  let current = latex;
  let repairs = 0;
  let last = await compileOnce(current, options);

  while (!last.ok && repairs < MAX_REPAIR_ATTEMPTS) {
    repairs += 1;
    const fixed = await repairLatex(current, last.log || "Unknown compile error", options);
    current = fixed.latex;
    last = await compileOnce(current, options);
  }

  return { ...last, latex: current, repairCount: repairs };
}

/**
 * Run retrieve → generate → compile/repair → VLM judge (one outer retry).
 */
export async function runPipeline(prompt, options = {}) {
  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("prompt is required");
  }
  const trimmed = prompt.trim();
  const started = Date.now();

  const retrieval = await retrieveCatalogMatches(trimmed, options);
  const trace = {
    retrieval: {
      path: retrieval.path,
      matched: retrieval.matched,
      iconOnly: retrieval.iconOnly,
      threshold: retrieval.threshold,
      top: retrieval.matches.slice(0, 3).map((m) => ({
        id: m.id,
        type: m.type,
        score: Number(m.score.toFixed(4)),
        name: m.name,
      })),
    },
  };

  async function generateOnce(feedback = null) {
    if (retrieval.matched && retrieval.best) {
      return generateFromTemplate(trimmed, retrieval.best, options);
    }
    return generateBlankCanvas(trimmed, { ...options, feedback });
  }

  let generation = await generateOnce();
  let compiled = await compileWithRepair(generation.latex, options);
  let outerRetries = 0;
  let quality = null;

  if (compiled.ok && compiled.png) {
    quality = await judgeFigure(compiled.png, trimmed, options);
    if (!quality.pass) {
      outerRetries = 1;
      const revised = await reviseFromJudge(
        compiled.latex,
        trimmed,
        quality.scores,
        quality.feedback,
        options,
      );
      generation = {
        ...generation,
        latex: revised.latex,
        model: revised.model,
        revisedFromJudge: true,
      };
      compiled = await compileWithRepair(revised.latex, options);
      if (compiled.ok && compiled.png) {
        quality = await judgeFigure(compiled.png, trimmed, options);
      }
    }
  }

  const compileSummary = compiled.ok ? null : summarizeCompileLog(compiled.log);
  const error = compiled.ok
    ? null
    : compileSummary
      ? `LaTeX compilation failed after ${compiled.repairCount} repair(s):\n${compileSummary}`
      : `Generation failed after ${compiled.repairCount} compile repair(s).`;

  return {
    ok: compiled.ok,
    error,
    prompt: trimmed,
    tex: compiled.latex,
    pdfBase64: toBase64(compiled.pdf),
    svgBase64: toBase64(compiled.svg),
    pngBase64: toBase64(compiled.png),
    templateId: generation.templateId,
    generationMode: generation.mode,
    repairCount: compiled.repairCount,
    outerRetries,
    qualityScores: quality?.scores ?? null,
    qualityFeedback: quality?.feedback ?? null,
    qualityPass: quality?.pass ?? null,
    compileEngine: compiled.engine,
    compileLog: compiled.ok ? null : (compiled.log || "").slice(0, 8000),
    retrieval: trace.retrieval,
    elapsedMs: Date.now() - started,
    scoreFloor: SCORE_FLOOR,
  };
}
