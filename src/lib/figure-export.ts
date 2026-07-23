import type { DocumentFit, OutputType } from "@/lib/openrouter";

const DEFAULT_PREAMBLE = `\\usepackage{tikz}
\\usepackage{pgfplots}
\\usepackage{amsmath,amssymb}
\\usepackage{array}
\\usepackage{booktabs}
\\usepackage{multirow}
\\usepackage{xcolor}
\\usepackage{graphicx}
\\usetikzlibrary{arrows.meta, positioning, shapes.geometric, fit, backgrounds, calc}
\\pgfplotsset{compat=1.14}
% teXlab academic palette (see library/STYLE.md)
\\definecolor{tlblue}{HTML}{2E6B8A}
\\definecolor{tlteal}{HTML}{3D8B7A}
\\definecolor{tlorange}{HTML}{B86B2C}
\\definecolor{tlpurple}{HTML}{6E5A7E}
\\definecolor{tlgray}{HTML}{3F4A56}`;

export interface ParsedLatex {
  preamble: string;
  body: string;
  isBoxContent: boolean;
}

export function parseLatexBody(latex: string): ParsedLatex {
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

export function targetWidthForFit(documentFit: DocumentFit): string | null {
  if (documentFit === "column") return "8.5cm";
  if (documentFit === "fullpage") return "17cm";
  return null;
}

export function fitBadgeLabel(documentFit: DocumentFit): string {
  switch (documentFit) {
    case "column":
      return "Fits 8.5 cm column";
    case "fullpage":
      return "Fits 17 cm width";
    case "snippet":
      return "Paste snippet";
    default:
      return "Standalone preview";
  }
}

function wrapForPreview(body: string, isBoxContent: boolean, documentFit: DocumentFit): string {
  const targetWidth = targetWidthForFit(documentFit);
  if (isBoxContent && targetWidth) {
    return `\\resizebox{${targetWidth}}{!}{%\n${body}\n}`;
  }
  return body;
}

export function buildPreviewDocument(latex: string, documentFit: DocumentFit): string {
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

export function buildStandaloneDocument(latex: string): string {
  const { preamble, body } = parseLatexBody(latex);
  if (/\\documentclass/i.test(latex)) {
    return latex.replace(/```latex\n?/gi, "").replace(/```\n?/g, "").trim();
  }

  return `\\documentclass[tikz,border=5mm]{standalone}
${DEFAULT_PREAMBLE}
${preamble}
\\begin{document}
${body}
\\end{document}`;
}

export function buildPasteSnippet(
  latex: string,
  documentFit: DocumentFit,
  outputType: OutputType | null,
): string {
  const { preamble, body, isBoxContent } = parseLatexBody(latex);
  const preambleComment =
    preamble.trim().length > 0
      ? `% Add to your preamble if missing:\n${preamble.split("\n").map((l) => `% ${l}`).join("\n")}\n\n`
      : "";

  const core = body.trim();
  const isTable = outputType === "table" || /\\begin\s*\{tabular/i.test(core);

  if (documentFit === "snippet") {
    return `${preambleComment}${core}`;
  }

  const targetWidth = targetWidthForFit(documentFit);
  const resizeCmd = documentFit === "column" ? "\\columnwidth" : "\\textwidth";
  const inner = targetWidth && isBoxContent ? `\\resizebox{${resizeCmd}}{!}{%\n${core}\n}` : core;

  if (isTable) {
    return `${preambleComment}\\begin{table}[t]
  \\centering
  ${inner}
  \\caption{Your caption here}
  \\label{tab:your-label}
\\end{table}`;
  }

  return `${preambleComment}\\begin{figure}[t]
  \\centering
  ${inner}
  \\caption{Your caption here}
  \\label{fig:your-label}
\\end{figure}`;
}

export function buildInputLine(slug: string): string {
  return `\\input{figures/${slug}}`;
}

export function extractPreambleLines(latex: string): string {
  const { preamble } = parseLatexBody(latex);
  const merged = [DEFAULT_PREAMBLE, preamble].filter(Boolean).join("\n");
  const seen = new Set<string>();
  return merged
    .split("\n")
    .filter((line) => {
      const key = line.trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n");
}

export function slugFromPrompt(prompt: string): string {
  const base = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  return `texlab-${base || "figure"}`;
}
