import { createCompletion } from "./openrouter-client.js";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt } = req.body;
    const apiKey = process.env.OPEN_ROUTER_API;

    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    try {
        const content = await createCompletion(apiKey, [
            {
                role: "system",
                content: `You are a LaTeX expert. Generate ONLY valid, compilable LaTeX code. Do not include explanations, Markdown, or backticks.

For TikZ diagrams:
- Output a complete standalone document unless the user explicitly asks for only a snippet.
- Include \\documentclass[tikz,border=5mm]{standalone}, \\usepackage{tikz}, and all required libraries.
- Always include \\usetikzlibrary{arrows.meta, positioning, shapes.geometric, fit, backgrounds, calc}.
- Keep the diagram preview-friendly: use scale=0.75, transform shape for larger diagrams; keep node distances modest; avoid large right/left offsets.
- Use text width values that keep the whole diagram within roughly 14cm wide and 10cm tall.
- If using fit/group boxes, draw them inside \\begin{scope}[on background layer] ... \\end{scope}; do not let filled group boxes cover nodes or arrows.
- For diamonds, trapeziums, ellipses, cylinders, clouds, or similar shapes, ensure the required TikZ shape library is loaded.
- Prefer simple, robust layouts over visually complex layouts that risk clipping or overlap.
- Avoid undefined TikZ keys and avoid package-specific commands unless you included their package.

For tables:
- Include all required packages such as booktabs, array, multirow, xcolor, or longtable when used.
- Keep tables compact and compilable.

Return only the final LaTeX code.`
            },
            {
                role: "user",
                content: prompt
            }
        ], 0.1);
        return res.status(200).json({ content });
    } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        return res.status(500).json({ error: message });
    }
}
