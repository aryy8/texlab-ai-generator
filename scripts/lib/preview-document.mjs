/** Mirrors src/lib/figure-export.ts buildPreviewDocument for Node scripts. */

const DEFAULT_PREAMBLE = `\\usepackage{tikz}
\\usepackage{pgfplots}
\\usepackage{amsmath,amssymb}
\\usepackage{array}
\\usepackage{booktabs}
\\usepackage{multirow}
\\usepackage{xcolor}
\\usepackage{graphicx}
\\usetikzlibrary{arrows.meta, positioning, shapes.geometric, fit, backgrounds, calc}
\\pgfplotsset{compat=1.14}`;

function parseLatexBody(latex) {
  const cleaned = latex.replace(/```latex\n?/gi, "").replace(/```\n?/g, "").trim();
  const preambleRegex = /\\(usepackage|usetikzlibrary|pgfplotsset|definecolor).*?(?:\{[^}]+\}|\[[^\]]+\])+/gi;
  const preambleMatches = cleaned.match(preambleRegex) || [];
  const extraPreamble = preambleMatches.join("\n");
  let body = cleaned.replace(preambleRegex, "").trim();

  body = body.replace(/\\documentclass[\s\S]*?\{[\s\S]*?\}/gi, "");
  body = body.replace(/\\begin\s*\{document\}/gi, "");
  body = body.replace(/\\end\s*\{document\}/gi, "");
  body = body.replace(/\\begin\s*\{(figure|table)\*?\}(\[[^\]]*\])?/gi, "");
  body = body.replace(/\\end\s*\{(figure|table)\*?\}/gi, "");
  body = body.replace(/\\centering/gi, "");
  body = body.replace(
    /\\caption\s*\*?\s*(\[[^\]]*\])?\s*\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/gi,
    "",
  );
  body = body.replace(/\\label\s*\{[^}]*\}/gi, "");
  body = body.trim();

  const isBoxContent = /\\begin\s*\{(tikzpicture|tabular|longtable|axis)\}/i.test(body);
  return { preamble: extraPreamble, body, isBoxContent };
}

function targetWidthForFit(documentFit) {
  if (documentFit === "column") return "8.5cm";
  if (documentFit === "fullpage") return "17cm";
  return null;
}

function wrapForPreview(body, isBoxContent, documentFit) {
  const targetWidth = targetWidthForFit(documentFit);
  if (isBoxContent && targetWidth) {
    return `\\resizebox{${targetWidth}}{!}{%\n${body}\n}`;
  }
  return body;
}

export function buildPreviewDocument(latex, documentFit = "column") {
  const { preamble, body, isBoxContent } = parseLatexBody(latex);
  const previewBody = wrapForPreview(body, isBoxContent, documentFit);
  const classOptions = isBoxContent ? "border=10pt" : "border=10pt,varwidth";

  return `\\documentclass[${classOptions}]{standalone}
${DEFAULT_PREAMBLE}
${preamble}
\\begin{document}
${previewBody}
\\end{document}`;
}
