/**
 * Vercel / Vite-dev compatible handler: POST /api/generate
 * Runs the OpenTikZ retrieve → generate → compile → judge pipeline.
 */

import { checkRateLimit, validatePrompt } from "./_lib/security.js";
import { runPipeline } from "../backend/lib/pipeline.js";
import { getCatalogIndex } from "../backend/lib/catalog-index.js";

const MAX_PROMPT_LENGTH = 4000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rate = checkRateLimit(req);
  if (!rate.allowed) {
    return res.status(429).json({
      error: `Too many requests. Please wait ${rate.retryAfterSeconds}s and try again.`,
    });
  }

  const prompt = req.body?.prompt ?? req.body?.query;
  const promptError = validatePrompt(prompt, MAX_PROMPT_LENGTH);
  if (promptError) {
    return res.status(400).json({ error: promptError });
  }

  try {
    await getCatalogIndex();
    const result = await runPipeline(prompt.trim());
    // `content` mirrors generate-latex so clients can share parsing.
    return res.status(result.ok ? 200 : 422).json({
      ...result,
      content: result.tex,
    });
  } catch (error) {
    console.error("generate pipeline error:", error);
    return res.status(500).json({
      error: error.message || "Generation failed. Please try again.",
    });
  }
}
