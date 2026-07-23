/**
 * teXlab figure library — curated templates edited on generate.
 * Style source of truth: library/STYLE.md
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIBRARY_ROOT = join(__dirname, "../../library");

function loadJson(rel) {
  return JSON.parse(readFileSync(join(LIBRARY_ROOT, rel), "utf8"));
}

const catalog = loadJson("catalog.json");

const TEMPLATES = catalog.templates.map((entry) => {
  const meta = loadJson(entry.meta);
  const tex = readFileSync(join(LIBRARY_ROOT, entry.path), "utf8");
  return { ...meta, tex };
});

export function listLibraryTemplates() {
  return TEMPLATES.map(({ tex, ...rest }) => rest);
}

export function getLibraryTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}

/**
 * Match a user prompt + preferred style to a library template.
 * Returns null when freehand generate is better.
 */
export function matchLibraryTemplate(prompt, style) {
  const text = `${prompt ?? ""}`.toLowerCase();

  const neuralHit =
    style === "neural-network"
    || /\b(neural\s*net|mlp|feed[- ]?forward|fully\s*connected|hidden\s*layer|neurons?\b)/i.test(text);

  if (neuralHit && !/\b(encoder|decoder|autoencoder|bottleneck)\b/i.test(text)) {
    const nn = getLibraryTemplate("feedforward-nn");
    if (nn) {
      if (/\b(cnn|resnet|transformer|encoder|decoder|architecture\s*diagram|flowchart)\b/i.test(text)
        && !/\b(mlp|feed[- ]?forward|fully\s*connected|neural\s*net)\b/i.test(text)
        && style !== "neural-network") {
        return null;
      }
      return nn;
    }
  }

  const flowHit =
    style === "flowchart"
    || /\b(flowchart|decision\s*diamond|yes\s*\/\s*no|retry\s*loop|algorithm\s*flow)\b/i.test(text)
    || (/\b(start|end)\b/.test(text) && /\b(decision|diamond|valid\?|yes|no|loop|retry)\b/.test(text));

  if (flowHit && !/\b(neural\s*net|mlp|microservice|architecture|encoder|decoder)\b/i.test(text)) {
    const flow = getLibraryTemplate("flowchart-decision");
    if (flow) return flow;
  }

  const archHit =
    style === "architecture"
    || /\b(system\s*(block|architecture|diagram)|microservice|api\s*gateway|backend\s*services?)\b/i.test(text)
    || (/\b(client|gateway)\b/.test(text) && /\b(service|database|cache|backend)\b/.test(text));

  if (archHit && !/\b(neural\s*net|mlp|flowchart|decision\s*diamond|encoder|decoder|autoencoder|bottleneck)\b/i.test(text)) {
    const arch = getLibraryTemplate("system-block");
    if (arch) return arch;
  }

  const encdecHit =
    /\b(encoder[- ]?decoder|autoencoder|bottleneck|latent\s*z|hourglass|vae|seq2seq)\b/i.test(text)
    || (/\bencoder\b/.test(text) && /\bdecoder\b/.test(text));

  if (encdecHit && !/\b(flowchart|microservice|api\s*gateway|resnet|residual)\b/i.test(text)) {
    const ed = getLibraryTemplate("encoder-decoder");
    if (ed) return ed;
  }

  const resnetHit =
    /\b(resnet|residual\s*block|skip\s*connection|identity\s*skip|f\s*\(\s*x\s*\))\b/i.test(text)
    || (/\bresidual\b/.test(text) && /\b(weight\s*layer|relu|he\s*et)\b/.test(text));

  if (resnetHit && !/\b(flowchart|microservice|encoder|decoder|autoencoder|training\s*pipeline|optimizer)\b/i.test(text)) {
    const rn = getLibraryTemplate("resnet-block");
    if (rn) return rn;
  }

  const trainHit =
    /\b(training\s*pipeline|train(ing)?\s*loop|dataset.*model.*loss|optimizer|backprop|finetun)/i.test(text)
    || (/\b(dataset|dataloader)\b/.test(text) && /\b(loss|optimizer|gradient)\b/.test(text));

  if (trainHit && !/\b(flowchart|decision|microservice|resnet|encoder|decoder)\b/i.test(text)) {
    const tp = getLibraryTemplate("training-pipeline");
    if (tp) return tp;
  }

  let best = null;
  let bestScore = 0;
  for (const tmpl of TEMPLATES) {
    let score = 0;
    for (const tag of tmpl.tags ?? []) {
      if (text.includes(tag.toLowerCase())) score += tag.length > 8 ? 3 : 2;
    }
    if (style && tmpl.styles?.includes(style)) score += 4;
    if (score > bestScore) {
      bestScore = score;
      best = tmpl;
    }
  }
  return bestScore >= 5 ? best : null;
}

export const LIBRARY_EDIT_PROMPT = `You adapt a curated teXlab library template to the user's request.
Return ONLY complete standalone LaTeX. No Markdown, no English commentary, no \\caption/\\label/figure.

Rules:
1. START FROM THE PROVIDED TEMPLATE. Keep its structure, palette (tlblue/tlorange/tlteal/tlpurple/tlgray), layers, and craft.
2. Prefer editing the top \\def parameters and labels. Add/remove nodes only when the request needs it.
3. Preserve node-naming schemes documented for the template.
4. Match REQUEST SCOPE — do not invent extra subsystems.
5. Edges that reference deleted nodes must be deleted too.
6. Follow teXlab style: light fills, darker strokes, \\sffamily labels, edges behind dense nodes when the template uses layers.`;
