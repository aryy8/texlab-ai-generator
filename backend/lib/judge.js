/**
 * VLM quality judge — scores correctness / clarity / completeness (1–5).
 */

import { createVisionCompletion } from "./openrouter.js";

export const SCORE_FLOOR = 3;

function parseScores(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const obj = JSON.parse(jsonMatch[0]);
    const correctness = Number(obj.correctness);
    const clarity = Number(obj.clarity);
    const completeness = Number(obj.completeness);
    if (![correctness, clarity, completeness].every((n) => n >= 1 && n <= 5)) {
      return null;
    }
    return {
      correctness,
      clarity,
      completeness,
      feedback: typeof obj.feedback === "string" ? obj.feedback : "",
    };
  } catch {
    return null;
  }
}

/**
 * @param {Buffer} pngBuffer
 * @param {string} prompt
 */
export async function judgeFigure(pngBuffer, prompt, options = {}) {
  const floor = options.floor ?? SCORE_FLOOR;
  const b64 = pngBuffer.toString("base64");

  const system = `You are a strict figure-quality reviewer for academic TikZ diagrams.
Score the rendered figure against the user's request on three axes from 1 (poor) to 5 (excellent):
- correctness: does the figure depict the requested concept accurately?
- clarity: are layout, labels, and visual hierarchy readable?
- completeness: are important parts of the request present?

Respond with ONLY JSON:
{"correctness":n,"clarity":n,"completeness":n,"feedback":"…"}`;

  const { content, model } = await createVisionCompletion(
    [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "text", text: `User request:\n${prompt}\n\nScore this figure.` },
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${b64}` },
          },
        ],
      },
    ],
    options,
  );

  const scores = parseScores(content);
  if (!scores) {
    return {
      scores: { correctness: 3, clarity: 3, completeness: 3 },
      feedback: content.slice(0, 500),
      pass: true,
      model,
      raw: content,
    };
  }

  const pass =
    scores.correctness >= floor
    && scores.clarity >= floor
    && scores.completeness >= floor;

  return { scores, feedback: scores.feedback, pass, model, raw: content };
}
