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
                content: "You are a LaTeX expert. Generate ONLY the LaTeX code for the diagram or table requested by the user. Do not include any explanation or backticks. Ensure the code is production-ready. When using TikZ, include every required package/library, especially \\usetikzlibrary{arrows.meta, positioning, shapes.geometric, fit, backgrounds, calc} for flowcharts, diamonds, trapeziums, arrows, positioning, and grouped nodes."
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
