// Two model lists, selected by OPENROUTER_TIER:
// - "paid": quality-first paid models, free models as a safety net. Use this
//   where the OpenRouter key has credits (e.g. local development).
// - anything else (default): free models only, so a credit-less key (e.g. the
//   production deployment) never wastes a round-trip on 402 responses.
// OPENROUTER_MODEL (comma-separated) overrides whichever list is active.
export const SELECTABLE_MODEL_IDS = [
    "openai/gpt-4o-mini",
    "openai/gpt-5-mini",
    "google/gemini-2.5-flash",
    "google/gemini-2.5-pro",
    "google/gemini-3-flash-preview",
];

export const PAID_OPENROUTER_MODELS = [
    // Fast, reliable default for TikZ/tables; vision-capable for refine.
    "openai/gpt-4o-mini",
    "openai/gpt-5-mini",
    "google/gemini-2.5-pro",
    "google/gemini-3-flash-preview",
    "google/gemini-2.5-flash",
    // Free fallbacks when credits run low.
    "qwen/qwen3-coder:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "meta-llama/llama-3.3-70b-instruct:free",
];

export const FREE_OPENROUTER_MODELS = [
    "qwen/qwen3-coder:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "google/gemma-4-31b-it:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "openai/gpt-oss-20b:free",
];

// Models that accept image inputs. Used to filter the fallback list when the
// request includes image references.
const VISION_MODELS = new Set([
    "google/gemini-2.5-pro",
    "google/gemini-3-flash-preview",
    "google/gemini-2.5-flash",
    "google/gemini-2.5-flash-lite",
    "openai/gpt-5-mini",
    "openai/gpt-4.1-mini",
    "openai/gpt-4o-mini",
    // Free-tier vision fallbacks.
    "google/gemma-4-31b-it:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
]);

const REQUEST_TIMEOUT_MS = 120_000;

const DEFAULT_TIKZ_LIBRARIES = [
    "arrows.meta",
    "positioning",
    "shapes.geometric",
    "fit",
    "backgrounds",
    "calc",
];

function mergeTikzLibraries(libraryList) {
    const libraries = libraryList
        .split(",")
        .map((library) => library.trim())
        .filter(Boolean);

    for (const library of DEFAULT_TIKZ_LIBRARIES) {
        if (!libraries.includes(library)) {
            libraries.push(library);
        }
    }

    return libraries.join(", ");
}

function stripProseLeakage(latex) {
    let text = latex.replace(/```(?:latex|tex)?\n?/gi, "").replace(/```/g, "").trim();

    // Drop leading English preamble the model sometimes adds.
    const docClass = text.search(/\\documentclass\b/);
    const usepackage = text.search(/\\usepackage\b/);
    const beginTikz = text.search(/\\begin\s*\{tikzpicture\}/);
    const starts = [docClass, usepackage, beginTikz].filter((i) => i >= 0);
    if (starts.length > 0) {
        const start = Math.min(...starts);
        // Keep a short comment block immediately above \documentclass if present.
        const sliced = text.slice(start);
        text = sliced;
    }

    // Remove float wrappers / captions that break standalone (before cutting prose).
    text = text.replace(/\\begin\s*\{figure\*?\}[\s\S]*?\\end\s*\{figure\*?\}/gi, (block) => {
        const tikz = block.match(/\\begin\s*\{tikzpicture\}[\s\S]*?\\end\s*\{tikzpicture\}/);
        return tikz ? tikz[0] : "";
    });
    text = text.replace(/\\caption\s*\*?(\[[^\]]*\])?\s*\{(?:[^{}]|\{[^{}]*\})*\}/gi, "");
    text = text.replace(/\\label\s*\{[^}]*\}/gi, "");

    // Cut junk after the main graphic environment. Models often append
    // "This code creates..." + \caption/\end{figure} after \end{tikzpicture},
    // which still renders inside \begin{document}…\end{document}.
    const endTikz = text.search(/\\end\s*\{tikzpicture\}/);
    const endTabular = text.search(/\\end\s*\{(?:tabular|longtable)\}/);
    const endAxis = text.search(/\\end\s*\{axis\}/);
    const graphicEnds = [endTikz, endTabular, endAxis].filter((i) => i >= 0);
    if (graphicEnds.length > 0) {
        const end = Math.max(...graphicEnds);
        const close = text.slice(end).match(/^\\end\s*\{[^}]+\}/);
        const closeLen = close ? close[0].length : 0;
        const head = text.slice(0, end + closeLen);
        if (/\\documentclass\b/.test(head)) {
            text = `${head}\n\\end{document}`;
        } else if (/\\begin\s*\{tikzpicture\}/.test(head)) {
            text = `\\documentclass[border=6pt]{standalone}
\\usepackage{tikz}
\\usetikzlibrary{${DEFAULT_TIKZ_LIBRARIES.join(", ")}}
\\begin{document}
${head}
\\end{document}`;
        } else {
            text = `${head}\n\\end{document}`;
        }
    } else {
        const endDoc = text.search(/\\end\s*\{document\}/);
        if (endDoc >= 0) {
            text = text.slice(0, endDoc + "\\end{document}".length);
        }
    }

    // Drop trailing prose lines after \end{document} (defense in depth).
    text = text.replace(/\\end\s*\{document\}[\s\S]*$/i, "\\end{document}");

    // Drop obvious English sentences left inside the file (outside comments).
    text = text
        .split("\n")
        .filter((line) => {
            const t = line.trim();
            if (!t) return true;
            if (t.startsWith("%")) return true;
            if (t.startsWith("\\")) return true;
            if (/^[{}\[\]()]+$/.test(t)) return true;
            // Prose leak: "This code creates...", "Here is the updated..."
            if (/^(here is|this code|the (following|updated|complete)|i have|below is|note that)\b/i.test(t)) {
                return false;
            }
            if (/^[A-Z][a-z].*\b(diagram|icon|arrow|guideline|code)\b/i.test(t) && !/\\/.test(t)) {
                return false;
            }
            return true;
        })
        .join("\n")
        .trim();

    return text;
}

export function normalizeLatex(content) {
    let latex = stripProseLeakage(content);

    if (!/\\begin\s*\{tikzpicture\}/i.test(latex)) {
        return latex;
    }

    const tikzLibraryRegex = /\\usetikzlibrary\s*\{([^}]*)\}/i;
    const existingLibraries = latex.match(tikzLibraryRegex);

    if (existingLibraries) {
        latex = latex.replace(
            tikzLibraryRegex,
            `\\usetikzlibrary{${mergeTikzLibraries(existingLibraries[1])}}`,
        );
    } else {
        const tikzPackageRegex = /(\\usepackage(?:\[[^\]]*\])?\s*\{tikz\})/i;
        if (tikzPackageRegex.test(latex)) {
            latex = latex.replace(
                tikzPackageRegex,
                `$1\n\\usetikzlibrary{${DEFAULT_TIKZ_LIBRARIES.join(", ")}}`,
            );
        } else if (/\\documentclass\b/.test(latex)) {
            latex = latex.replace(
                /(\\documentclass(?:\[[^\]]*\])?\s*\{[^}]+\})/,
                `$1\n\\usepackage{tikz}\n\\usetikzlibrary{${DEFAULT_TIKZ_LIBRARIES.join(", ")}}`,
            );
        } else {
            latex = `\\usetikzlibrary{${DEFAULT_TIKZ_LIBRARIES.join(", ")}}\n${latex}`;
        }
    }

    // Incomplete trailing \\draw[...] line (truncated generation) — drop it.
    latex = latex.replace(/\n\s*\\draw\[[^\]]*,\s*$/m, "\n");
    latex = latex.replace(/\n\s*\\draw\[[^\]]*\]\s*$/m, "\n");

    // Drop \\draw lines that reference node names never defined with \\node (...).
    // Catches half-edited seeds that leave orphan arrows (stray horizontal lines).
    latex = stripOrphanDraws(latex);

    return latex.trim();
}

function stripOrphanDraws(latex) {
    const pictureMatch = latex.match(/\\begin\s*\{tikzpicture\}([\s\S]*?)\\end\s*\{tikzpicture\}/i);
    if (!pictureMatch) return latex;

    const body = pictureMatch[1];
    const defined = new Set();
    for (const m of body.matchAll(/\\node\s*(?:\[[^\]]*\])?\s*\(([^)]+)\)/g)) {
        defined.add(m[1].trim());
    }
    if (defined.size === 0) return latex;

    const cleanedBody = body.replace(/\\draw\b[\s\S]*?;/g, (draw) => {
        const refs = [...draw.matchAll(/\(\s*([A-Za-z][\w-]*)\s*(?:\.[a-z]+)?\s*\)/gi)].map((m) => m[1]);
        if (refs.length === 0) return draw;
        const orphan = refs.some((name) => !defined.has(name));
        return orphan ? "" : draw;
    });

    return latex.replace(pictureMatch[0], `\\begin{tikzpicture}${cleanedBody}\\end{tikzpicture}`);
}

function getConfiguredModels() {
    if (process.env.OPENROUTER_MODEL) {
        return process.env.OPENROUTER_MODEL
            .split(",")
            .map((model) => model.trim())
            .filter(Boolean);
    }

    return process.env.OPENROUTER_TIER === "paid"
        ? PAID_OPENROUTER_MODELS
        : FREE_OPENROUTER_MODELS;
}

// Raw upstream error bodies contain account identifiers and internal details,
// so they are logged server-side and never forwarded to the browser.
function getClientSafeError(status) {
    if (status === 402) {
        return "The AI provider rejected the request due to insufficient credits. Please try again later.";
    }
    if (status === 429) {
        return "The AI provider is rate-limiting requests. Please try again in a moment.";
    }
    if (status === 401 || status === 403) {
        return "The server is not authorized with the AI provider. Please contact the site owner.";
    }
    return "The AI provider returned an error. Please try again.";
}

async function requestCompletion(apiKey, model, messages, temperature, maxTokens) {
    let response;
    try {
        response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://texlab.ai",
                "X-Title": "teXlab",
            },
            body: JSON.stringify({
                model,
                messages,
                temperature,
                max_tokens: maxTokens,
            }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
    } catch (error) {
        console.error(`OpenRouter request failed for ${model}:`, error);
        return { ok: false, status: 0, error: "The AI provider did not respond in time. Please try again." };
    }

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenRouter ${response.status} for ${model}:`, errorText);
        // Low-credit accounts get "can only afford N" 402s; retry once with
        // the affordable token budget instead of failing the model outright.
        if (response.status === 402) {
            const affordable = Number(errorText.match(/can only afford (\d+)/)?.[1]);
            if (Number.isFinite(affordable) && affordable >= 1200 && affordable < maxTokens) {
                return requestCompletion(apiKey, model, messages, temperature, Math.floor(affordable * 0.9));
            }
        }
        return { ok: false, status: response.status, error: getClientSafeError(response.status) };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
        console.error(`OpenRouter returned empty/malformed response for ${model}`);
        return { ok: false, status: 502, error: "The AI provider returned an empty response. Please try again." };
    }

    return { ok: true, content: normalizeLatex(content) };
}

export async function createCompletion(apiKey, messages, temperature, maxTokens = 4096, options = {}) {
    let models =
        options.model && options.model !== "auto"
            ? [options.model]
            : getConfiguredModels();

    if (options.requiresVision) {
        models = models.filter((model) => VISION_MODELS.has(model));
        if (models.length === 0) {
            throw new Error("The selected model does not support image references. Switch to Auto or a vision-capable model.");
        }
    }

    let lastError = "No AI model is configured on the server.";

    for (const model of models) {
        const result = await requestCompletion(apiKey, model, messages, temperature, maxTokens);

        if (result.ok) {
            return result.content;
        }

        lastError = result.error;

        // Advance to the next model on failures that are model-specific:
        // 429 rate limit, 0 timeout, 402 out of credits (free fallbacks still
        // work), 404 model removed, and 5xx provider outages. Auth failures
        // (401/403) would fail identically everywhere, so stop immediately.
        const retryable = [429, 0, 402, 404].includes(result.status) || result.status >= 500;
        if (!retryable) {
            break;
        }
    }

    throw new Error(lastError);
}
