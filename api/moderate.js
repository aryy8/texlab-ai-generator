/**
 * Lightweight safety check for the landing page.
 * Blocks unsafe prompts before the user is sent to the workspace.
 */

import { checkRateLimit, validatePrompt } from "./_lib/security.js";
import { moderateInput } from "./_lib/moderate.js";

const MAX_PROMPT_LENGTH = 4000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rate = await checkRateLimit(req, { profile: "generate", res });
  if (!rate.allowed) {
    res.setHeader("Retry-After", String(rate.retryAfterSeconds));
    return res.status(429).json({
      error: `Too many requests. Please wait ${rate.retryAfterSeconds}s and try again.`,
      allowed: false,
    });
  }

  const prompt = req.body?.prompt ?? req.body?.query;
  const promptError = validatePrompt(prompt, MAX_PROMPT_LENGTH);
  if (promptError) {
    return res.status(400).json({ error: promptError, allowed: false });
  }

  const textParts = [prompt.trim()];
  const references = req.body?.references;
  if (Array.isArray(references)) {
    for (const ref of references) {
      if (ref && ref.kind === "text" && typeof ref.content === "string" && ref.content.trim()) {
        textParts.push(ref.content.trim());
      }
    }
  }

  const moderation = await moderateInput(textParts.join("\n\n"));
  if (!moderation.allowed) {
    return res.status(403).json({
      allowed: false,
      error: moderation.clientMessage || "Request blocked by safety policy.",
    });
  }

  return res.status(200).json({ allowed: true });
}
