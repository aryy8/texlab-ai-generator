// Two model lists, selected by OPENROUTER_TIER:
// - "paid": quality-first paid models, free models as a safety net. Use this
//   where the OpenRouter key has credits (e.g. local development).
// - anything else (default): free models only, so a credit-less key (e.g. the
//   production deployment) never wastes a round-trip on 402 responses.
// OPENROUTER_MODEL (comma-separated) overrides whichever list is active.
export const PAID_OPENROUTER_MODELS = [
    "anthropic/claude-sonnet-5",
    "google/gemini-3-flash-preview",
    "google/gemini-2.5-flash",
    "openai/gpt-5-mini",
    "qwen/qwen3-coder:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
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
    "anthropic/claude-sonnet-5",
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

const REQUEST_TIMEOUT_MS = 60_000;

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

function normalizeLatex(content) {
    const latex = content.replace(/```latex\n?/gi, "").replace(/```\n?/g, "").trim();

    if (!/\\begin\s*\{tikzpicture\}/i.test(latex)) {
        return latex;
    }

    const tikzLibraryRegex = /\\usetikzlibrary\s*\{([^}]*)\}/i;
    const existingLibraries = latex.match(tikzLibraryRegex);

    if (existingLibraries) {
        return latex.replace(
            tikzLibraryRegex,
            `\\usetikzlibrary{${mergeTikzLibraries(existingLibraries[1])}}`
        );
    }

    const tikzPackageRegex = /(\\usepackage(?:\[[^\]]*\])?\s*\{tikz\})/i;
    if (tikzPackageRegex.test(latex)) {
        return latex.replace(
            tikzPackageRegex,
            `$1\n\\usetikzlibrary{${DEFAULT_TIKZ_LIBRARIES.join(", ")}}`
        );
    }

    return `\\usetikzlibrary{${DEFAULT_TIKZ_LIBRARIES.join(", ")}}\n${latex}`;
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
    let models = getConfiguredModels();

    if (options.requiresVision) {
        models = models.filter((model) => VISION_MODELS.has(model));
        if (models.length === 0) {
            throw new Error("Image references need a vision-capable model, but none is configured.");
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
