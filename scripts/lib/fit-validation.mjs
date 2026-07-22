/**
 * Node port of src/lib/fit-validation.ts + basic richness checks for template QA.
 */
import { createCanvas, loadImage } from "@napi-rs/canvas";

const WHITE_THRESHOLD = 248;

function sampleContentBounds(imageData) {
  const { data, width, height } = imageData;
  let left = width;
  let right = 0;
  let top = height;
  let bottom = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 16) continue;
      if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) continue;
      found = true;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y < bottom) bottom = y;
    }
  }

  if (!found) return null;
  return { left, right, top, bottom };
}

/**
 * @param {Buffer} pngBuffer
 * @param {"column"|"fullpage"|"snippet"|"standalone"} documentFit
 */
export async function validateFigureFit(pngBuffer, documentFit) {
  if (documentFit === "snippet" || documentFit === "standalone") {
    return { status: "verified", contentWidthRatio: 0, contentRightRatio: 0, contentAreaRatio: 1 };
  }

  const img = await loadImage(pngBuffer);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const bounds = sampleContentBounds(data);

  if (!bounds) {
    return { status: "empty", contentWidthRatio: 0, contentRightRatio: 0, contentAreaRatio: 0 };
  }

  const contentWidthRatio = (bounds.right - bounds.left + 1) / canvas.width;
  const contentRightRatio = (bounds.right + 1) / canvas.width;
  const contentAreaRatio =
    ((bounds.right - bounds.left + 1) * (bounds.bottom - bounds.top + 1)) / (canvas.width * canvas.height);
  const marginRight = 1 - contentRightRatio;

  if (marginRight < 0.012 && contentWidthRatio > 0.88) {
    return { status: "cropped", contentWidthRatio, contentRightRatio, contentAreaRatio };
  }
  if (marginRight < 0.04 && contentWidthRatio > 0.82) {
    return { status: "may_overflow", contentWidthRatio, contentRightRatio, contentAreaRatio };
  }

  return { status: "verified", contentWidthRatio, contentRightRatio, contentAreaRatio };
}

/**
 * Reject obviously broken or trivial outputs before saving to the gallery.
 */
export function validateTemplateRichness(latex, template, fit) {
  const issues = [];
  const body = latex.replace(/\s+/g, " ").trim();

  if (body.length < 120) issues.push("latex too short (likely truncated)");

  if (fit.status === "empty") issues.push("preview image is blank");
  if (fit.status === "cropped") issues.push("figure is cropped at the right edge");
  // Some templates intentionally have whitespace margins due to standalone
  // borders and resizing; do not reject aggressively on this metric.
  if (fit.contentAreaRatio < 0.005) issues.push("figure content too sparse");

  if (template.outputType === "diagram") {
    if (!/\\begin\s*\{tikzpicture\}/i.test(latex) && !/\\begin\s*\{axis\}/i.test(latex)) {
      issues.push("diagram missing tikzpicture/axis");
    }
    const nodeCount = (latex.match(/\\node\b/g) || []).length;
    if (template.density === "detailed" && nodeCount < 3) {
      issues.push(`only ${nodeCount} nodes — too simple for a detailed diagram`);
    }
    if (template.density !== "compact" && nodeCount < 2) {
      issues.push(`only ${nodeCount} nodes — diagram too minimal`);
    }
  }

  if (template.outputType === "table") {
    if (!/\\begin\s*\{tabular\}/i.test(latex)) issues.push("table missing tabular environment");
    const rowCount = (latex.match(/\\\\/g) || []).length;
    if (rowCount < 3) issues.push(`only ~${rowCount} rows — table too small`);
  }

  if (template.outputType === "plot") {
    if (!/\\addplot/i.test(latex)) issues.push("plot missing addplot");
  }

  return { ok: issues.length === 0, issues };
}
