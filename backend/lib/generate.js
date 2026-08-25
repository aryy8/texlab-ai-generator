/**
 * Generation paths:
 *   A — edit matched template/example under edit_contract
 *   B — blank-canvas: describe → TikZ
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { OPENTIKZ_ROOT } from "./paths.js";
import { createChatCompletion } from "./openrouter.js";

function stripCodeFence(text) {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:latex|tex)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  // Models often prepend analysis before the real document.
  const docClass = t.search(/\\documentclass\b/);
  const beginTikz = t.search(/\\begin\s*\{tikzpicture\}/);
  const starts = [docClass, beginTikz].filter((i) => i >= 0);
  if (starts.length > 0) {
    t = t.slice(Math.min(...starts));
  }
  const endDoc = t.search(/\\end\s*\{document\}/);
  if (endDoc >= 0) {
    t = t.slice(0, endDoc + "\\end{document}".length);
  } else {
    t = t.replace(/\\end\s*\{document\}[\s\S]*$/i, "\\end{document}");
  }
  return t.trim();
}

/** Pull the most useful TeX error lines from a compile log. */
export function summarizeCompileLog(log, maxLines = 8) {
  if (!log) return "";
  const lines = String(log)
    .split("\n")
    .map((l) => l.trimEnd())
    .filter(Boolean);
  const errors = lines.filter((l) => /^!/.test(l) || /^l\.\d+/.test(l));
  const picked = (errors.length ? errors : lines.slice(-maxLines)).slice(0, maxLines);
  return picked.join("\n").slice(0, 1200);
}

function resolveFigureFiles(catalogEntry) {
  const abs = join(OPENTIKZ_ROOT, catalogEntry.path);
  const candidates = [
    { tex: join(abs, "template.tex"), meta: join(abs, "template.meta.json") },
    { tex: join(abs, "figure.tex"), meta: join(abs, "figure.meta.json") },
  ];
  for (const c of candidates) {
    if (existsSync(c.tex)) {
      const meta = existsSync(c.meta) ? JSON.parse(readFileSync(c.meta, "utf8")) : {};
      return { tex: readFileSync(c.tex, "utf8"), meta, texPath: c.tex };
    }
  }
  throw new Error(`No .tex found for catalog entry ${catalogEntry.id} at ${catalogEntry.path}`);
}

export async function generateFromTemplate(prompt, catalogEntry, options = {}) {
  const { tex, meta } = resolveFigureFiles(catalogEntry);
  const editContract = meta.edit_contract || null;

  const system = `You are a TikZ expert editing an OpenTikZ figure for teXlab.
Return ONLY a complete, compilable standalone LaTeX document (\\documentclass{standalone} … \\end{document}).
No markdown fences, no commentary.

Rules:
- Preserve the overall structure, packages, and visual language of the template.
- Follow the edit_contract strictly when provided: only change listed parameters / allowed node labels / allowed edits.
- If there is no edit_contract, you may adapt labels, colors, and minor geometry to match the user request, but keep the architecture recognizable.
- Do not invent packages that are not already in the template unless required for a small label tweak.
- Output must compile with pdflatex.`;

  const user = `User request:
${prompt}

Matched catalog entry:
- id: ${catalogEntry.id}
- name: ${catalogEntry.name}
- type: ${catalogEntry.type}
- score: ${catalogEntry.score?.toFixed?.(3) ?? "n/a"}

edit_contract (JSON):
${JSON.stringify(editContract, null, 2)}

Current template.tex:
\`\`\`tex
${tex}
\`\`\`

Edit the template to satisfy the user request. Return the full .tex file.`;

  const { content, model } = await createChatCompletion(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    options,
  );

  return {
    latex: stripCodeFence(content),
    model,
    mode: "template",
    templateId: catalogEntry.id,
    editContract,
  };
}

export async function generateBlankCanvas(prompt, options = {}) {
  const feedback = options.feedback || null;

  const describeSystem = `You expand a short diagram request into a precise drawing specification for TikZ.
Describe geometry, layout, node positions (relative), labels, colors, arrows, and grouping.
Do NOT write any LaTeX or TikZ code. Be concrete and complete.`;

  const describeUser = [
    `User request:\n${prompt}`,
    feedback ? `\nPrevious attempt feedback (fix accordingly):\n${feedback}` : "",
  ].join("");

  const { content: description, model: describeModel } = await createChatCompletion(
    [
      { role: "system", content: describeSystem },
      { role: "user", content: describeUser },
    ],
    { ...options, maxTokens: 2048 },
  );

  const codeSystem = `You write publication-ready TikZ as a complete standalone LaTeX document.
Return ONLY the .tex source (\\documentclass[border=…]{standalone} … \\end{document}).
No markdown fences, no commentary.
Use \\usepackage{tikz} and any needed \\usetikzlibrary{…}.
Prefer clear layout, non-overlapping labels, and colorblind-friendly colors.
Must compile with pdflatex.`;

  const codeUser = `User request:
${prompt}

Drawing specification:
${description}

Write the complete standalone .tex file.`;

  const { content, model } = await createChatCompletion(
    [
      { role: "system", content: codeSystem },
      { role: "user", content: codeUser },
    ],
    options,
  );

  return {
    latex: stripCodeFence(content),
    model,
    describeModel,
    description,
    mode: "blank",
    templateId: null,
  };
}

export async function repairLatex(latex, compileLog, options = {}) {
  const system = `You fix LaTeX/TikZ compilation errors.
Return ONLY the complete corrected standalone .tex file.
The first non-whitespace character of your reply MUST be a backslash (start of \\documentclass).
Do not explain the error. Do not apologize. No markdown fences. No prose before or after the code.
Fix only what is needed for compilation.`;

  const user = `Compilation failed. Error log:
\`\`\`
${compileLog.slice(0, 6000)}
\`\`\`

Current source:
\`\`\`tex
${latex}
\`\`\`

Return the fixed complete .tex file only.`;

  const { content, model } = await createChatCompletion(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    options,
  );

  return { latex: stripCodeFence(content), model };
}

export async function reviseFromJudge(latex, prompt, scores, feedback, options = {}) {
  const system = `You revise a TikZ figure based on a vision quality review.
Return ONLY the complete standalone .tex file. No markdown fences.`;

  const user = `Original request:
${prompt}

Quality scores (1–5): ${JSON.stringify(scores)}
Reviewer feedback:
${feedback}

Current source:
\`\`\`tex
${latex}
\`\`\`

Revise to address the feedback while keeping a complete compilable document.`;

  const { content, model } = await createChatCompletion(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    options,
  );

  return { latex: stripCodeFence(content), model };
}
