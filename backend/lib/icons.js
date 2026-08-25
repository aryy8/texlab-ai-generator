/**
 * Load OpenTikZ icons and prepare them for inlining into generated figures.
 * Remote compile has no filesystem, so icons must be pasted as macros — never \\input.
 */

import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { OPENTIKZ_ROOT } from "./paths.js";

const ICON_SCORE_FLOOR = 0.3;
const MAX_ICONS = 8;

/**
 * Prompt phrases → OpenTikZ icon ids (forces inclusion even when embedding score is low).
 * There is no OpenAI brand icon; map to the generic `model` glyph.
 */
const ICON_KEYWORDS = [
  { id: "database", patterns: [/\bdatabases?\b/i, /\bdb\b/i, /\bsql\b/i, /\bpostgres/i, /\bmongo/i] },
  { id: "server", patterns: [/\bservers?\b/i, /\bbackend\b/i, /\brack\b/i] },
  { id: "cloud", patterns: [/\bclouds?\b/i, /\binternet\b/i, /\bsaas\b/i] },
  { id: "gpu", patterns: [/\bgpus?\b/i, /\bcuda\b/i, /\baccelerator/i] },
  { id: "cpu", patterns: [/\bcpus?\b/i] },
  { id: "user", patterns: [/\busers?\b/i, /\bclient\b/i, /\bbrowser\b/i, /\bweb\s*apps?\b/i, /\bweb\s*application/i] },
  { id: "disk", patterns: [/\bdisk\b/i, /\bstorage\b/i] },
  { id: "network", patterns: [/\bnetwork\b/i] },
  { id: "container", patterns: [/\bcontainers?\b/i] },
  { id: "docker", patterns: [/\bdocker\b/i] },
  { id: "mobile", patterns: [/\bmobile\b/i, /\bphone\b/i] },
  { id: "queue", patterns: [/\bqueues?\b/i, /\bkafka\b/i] },
  { id: "google", patterns: [/\bgoogle\s*auth\b/i, /\boauth\b/i, /\bgoogle\b/i] },
  { id: "google-cloud", patterns: [/\bgoogle\s*cloud\b/i, /\bgcp\b/i] },
  { id: "google-gemini", patterns: [/\bgemini\b/i] },
  { id: "nvidia", patterns: [/\bnvidia\b/i] },
  { id: "model", patterns: [/\bopenai\b/i, /\bopen\s*ai\b/i, /\bchatgpt\b/i, /\bgpt-?\d/i, /\bllms?\b/i] },
  { id: "claude", patterns: [/\bclaude\b/i] },
  { id: "anthropic", patterns: [/\banthropic\b/i] },
  { id: "huggingface", patterns: [/\bhugging\s*face\b/i, /\bhuggingface\b/i] },
  { id: "pytorch", patterns: [/\bpytorch\b/i, /\btorch\b/i] },
  { id: "tensorflow", patterns: [/\btensorflow\b/i] },
  { id: "kubernetes", patterns: [/\bkubernetes\b/i, /\bk8s\b/i] },
  { id: "vllm", patterns: [/\bvllm\b/i] },
  { id: "ollama", patterns: [/\bollama\b/i] },
];

/**
 * Icon ids explicitly named or implied by the prompt text.
 */
export function iconIdsFromPrompt(prompt) {
  const text = String(prompt || "");
  const ids = [];
  const seen = new Set();
  for (const rule of ICON_KEYWORDS) {
    if (rule.patterns.some((re) => re.test(text)) && !seen.has(rule.id)) {
      seen.add(rule.id);
      ids.push(rule.id);
    }
  }
  return ids;
}

/**
 * Merge embedding-ranked icons with keyword-forced icons.
 * Keyword hits are pinned first so named concepts (database, GPU, Google, …) are never dropped.
 */
export function selectIconsForPrompt(prompt, scoredEntries, options = {}) {
  const floor = options.floor ?? ICON_SCORE_FLOOR;
  const limit = options.limit ?? MAX_ICONS;
  const byId = new Map();
  for (const entry of scoredEntries || []) {
    if (entry?.type === "icon" && entry.id) byId.set(entry.id, entry);
  }

  const selected = [];
  const used = new Set();

  for (const id of iconIdsFromPrompt(prompt)) {
    const entry = byId.get(id);
    if (!entry || used.has(id)) continue;
    used.add(id);
    selected.push({ ...entry, keywordMatch: true });
  }

  const ranked = [...(scoredEntries || [])]
    .filter((e) => e?.type === "icon" && (e.score ?? 0) >= floor)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  for (const entry of ranked) {
    if (used.has(entry.id)) continue;
    used.add(entry.id);
    selected.push({ ...entry, keywordMatch: false });
    if (selected.length >= limit) break;
  }

  return selected.slice(0, limit);
}

function resolveIconTex(catalogEntry) {
  const abs = join(OPENTIKZ_ROOT, catalogEntry.path);
  const name = basename(catalogEntry.path);
  const candidates = [
    join(abs, `${name}.tex`),
    join(abs, `${catalogEntry.id}.tex`),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return null;
}

/**
 * Extract the first tikzpicture environment (including begin/end).
 */
export function extractTikzpicture(tex) {
  const match = tex.match(/\\begin\s*\{tikzpicture\}[\s\S]*?\\end\s*\{tikzpicture\}/i);
  return match ? match[0].trim() : null;
}

/**
 * Collect \\definecolor lines (palette + brand*).
 */
export function extractDefineColors(tex) {
  return [...tex.matchAll(/\\definecolor\{[^}]+\}\{HTML\}\{[0-9A-Fa-f]{6}\}/g)].map((m) => m[0]);
}

/**
 * Libraries mentioned in \\usetikzlibrary{...}.
 */
export function extractTikzLibraries(tex) {
  const libs = new Set();
  for (const m of tex.matchAll(/\\usetikzlibrary\s*\{([^}]+)\}/gi)) {
    for (const part of m[1].split(",")) {
      const name = part.trim();
      if (name) libs.add(name);
    }
  }
  return [...libs];
}

function macroNameFor(id) {
  const clean = String(id || "icon")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/^(\d)/, "i$1");
  return `\\${clean || "icon"}pic`;
}

/**
 * Load full icon payloads for catalog matches (type=icon).
 */
export function loadIconSnippets(iconMatches, options = {}) {
  const limit = options.limit ?? MAX_ICONS;
  // Callers (selectIconsForPrompt) already chose the set; do not re-filter by score floor
  // or keyword-forced icons below the embedding threshold get dropped.
  const picked = (iconMatches || [])
    .filter((m) => m && m.type === "icon")
    .slice(0, limit);

  const snippets = [];
  for (const match of picked) {
    const texPath = resolveIconTex(match);
    if (!texPath) continue;
    const tex = readFileSync(texPath, "utf8");
    const body = extractTikzpicture(tex);
    if (!body) continue;
    snippets.push({
      id: match.id,
      name: match.name,
      path: match.path,
      score: match.score,
      keywordMatch: Boolean(match.keywordMatch),
      tags: match.tags || [],
      requires: match.requires || [],
      macro: macroNameFor(match.id),
      colors: extractDefineColors(tex),
      libraries: extractTikzLibraries(tex),
      body,
    });
  }
  return snippets;
}

/**
 * Prompt block teaching the model how to inline icons.
 */
export function formatIconsForPrompt(snippets) {
  if (!snippets?.length) return "";

  const blocks = snippets.map((icon) => {
    const colorBlock = icon.colors.length
      ? `Colors to define once in the preamble:\n${icon.colors.join("\n")}\n`
      : "";
    const libNote = icon.libraries.length
      ? `Needs \\usetikzlibrary{${icon.libraries.join(", ")}}\n`
      : "";
    const why = icon.keywordMatch ? "keyword match — must use if concept appears" : "embedding match";
    return `### ${icon.id} — ${icon.name} (${why}, score ${Number(icon.score ?? 0).toFixed(3)})
Suggested macro: ${icon.macro}
${libNote}${colorBlock}TikZ body (paste VERBATIM inside \\newcommand{${icon.macro}}{...}):
\`\`\`tex
${icon.body}
\`\`\``;
  });

  return `OpenTikZ icons to INLINE in the figure (paste as macros — never \\input a file path; the compiler has no icon filesystem):

${blocks.join("\n\n")}

Icon composition rules:
- Prefer keyword-matched icons for named concepts in the request (database, GPU, Google, LLM/model, …).
- Paste each used TikZ body VERBATIM inside \\newcommand{\\…pic}{…}. Do NOT redraw icons with shapes.symbols, cylinders, circles+text, or simplified stand-ins.
- Define each used icon once, then place with \\node {\\gpupic}; keep labels as SEPARATE text nodes below/beside (never overlay text on the glyph).
- Scale icons with \\scalebox{0.35}{\\gpupic} (or similar) so they fit architecture boxes.
- Structural colors: otblue, otorange, otteal, otpurple, otgray (tints OK). Brand icons keep their brand* colors.
- Keep the whole document standalone and compilable with pdflatex.`;
}

export { ICON_SCORE_FLOOR, MAX_ICONS };
