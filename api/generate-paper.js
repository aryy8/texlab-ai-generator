import { createCompletion } from "./openrouter-client.js";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt, format } = req.body;
    const apiKey = process.env.OPEN_ROUTER_API;

    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    try {
        const content = await createCompletion(apiKey, [
            {
                role: "system",
                content: `You are an expert LaTeX typesetter. 
Your job is to convert the user's raw text/document drafts into a COMPLETE, compilable LaTeX research paper in the ${format} style.
Do NOT output ANY explanation or Markdown backticks (e.g., skip \`\`\`latex and \`\`\`).
You MUST output ONLY valid LaTeX code starting exactly with \\documentclass and ending exactly with \\end{document}.

Make sure to apply the following depending on the format requested:
- For "ieee": Use \\documentclass[conference]{IEEEtran}. Emulate a two-column IEEE format paper. Add placeholder \\author{} blocks if none are provided.
- For "acm": Use \\documentclass[sigconf]{acmart}.
- For "article": Use \\documentclass[11pt,a4paper]{article}. You may use standard layout packages like geometry.
- For "report": Use \\documentclass[12pt,a4paper]{report}.

Always include standard necessary packages like \\usepackage{amsmath}, \\usepackage{graphicx}, \\usepackage{hyperref}, etc.
Format the text professionally with appropriate \\section{}, \\subsection{}, and standard environments where applicable.
If the user provides an abstract, wrap it in \\begin{abstract} ... \\end{abstract}.
If the user provides a title, use \\title{} and \\maketitle.`
            },
            {
                role: "user",
                content: prompt
            }
        ], 0.2, 8192);
        return res.status(200).json({ content });
    } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        return res.status(500).json({ error: message });
    }
}
