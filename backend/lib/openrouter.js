/**
 * OpenRouter client for chat, embeddings, and vision.
 * API key: OPEN_ROUTER_API (preferred) or OPENROUTER_API_KEY.
 */

const REQUEST_TIMEOUT_MS = 120_000;
const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const PRIMARY_CHAT_MODEL = "anthropic/claude-sonnet-4-6";
const FALLBACK_CHAT_MODEL = "openai/gpt-4o";
const VISION_MODEL = "openai/gpt-4o";

export function getApiKey() {
  return process.env.OPEN_ROUTER_API || process.env.OPENROUTER_API_KEY || "";
}

function authHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://texlab.aryy.in",
    "X-Title": "teXlab OpenTikZ",
  };
}

async function openRouterFetch(path, body, apiKey = getApiKey()) {
  if (!apiKey) {
    throw new Error("Missing OPEN_ROUTER_API (or OPENROUTER_API_KEY) environment variable.");
  }

  let response;
  try {
    response = await fetch(`https://openrouter.ai/api/v1${path}`, {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    console.error(`OpenRouter ${path} network error:`, error);
    throw new Error("The AI provider did not respond in time. Please try again.");
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`OpenRouter ${response.status} on ${path}:`, errorText);
    throw new Error(`OpenRouter request failed (${response.status}).`);
  }

  return response.json();
}

/**
 * Embed one or more texts. Returns float[][] aligned with input order.
 */
export async function createEmbeddings(texts, options = {}) {
  const model = options.model || EMBEDDING_MODEL;
  const input = Array.isArray(texts) ? texts : [texts];
  if (input.length === 0) return [];

  // OpenRouter/OpenAI allow batching; chunk to stay under payload limits.
  const BATCH = 64;
  const vectors = new Array(input.length);

  for (let i = 0; i < input.length; i += BATCH) {
    const slice = input.slice(i, i + BATCH);
    const data = await openRouterFetch("/embeddings", { model, input: slice }, options.apiKey);
    const rows = data?.data;
    if (!Array.isArray(rows) || rows.length !== slice.length) {
      throw new Error("OpenRouter returned a malformed embeddings response.");
    }
    for (const row of rows) {
      if (!Array.isArray(row.embedding)) {
        throw new Error("OpenRouter embedding entry missing vector.");
      }
      vectors[i + row.index] = row.embedding;
    }
  }

  return vectors;
}

export async function createChatCompletion(messages, options = {}) {
  const models = options.models || [PRIMARY_CHAT_MODEL, FALLBACK_CHAT_MODEL];
  let lastError;

  for (const model of models) {
    try {
      const data = await openRouterFetch(
        "/chat/completions",
        {
          model,
          messages,
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens ?? 8192,
        },
        options.apiKey,
      );
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content === "string" && content.trim()) {
        return { content: content.trim(), model };
      }
      lastError = new Error(`Empty response from ${model}`);
    } catch (error) {
      lastError = error;
      console.error(`Chat model ${model} failed:`, error.message);
    }
  }

  throw lastError || new Error("All chat models failed.");
}

/**
 * Vision judge: send a PNG (base64) plus text prompt.
 */
export async function createVisionCompletion(messages, options = {}) {
  return createChatCompletion(messages, {
    ...options,
    models: options.models || [VISION_MODEL, PRIMARY_CHAT_MODEL],
  });
}

export { EMBEDDING_MODEL, PRIMARY_CHAT_MODEL, FALLBACK_CHAT_MODEL, VISION_MODEL };
