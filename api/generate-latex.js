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
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://texlab.ai",
                "X-Title": "teXlab",
            },
            body: JSON.stringify({
                model: "google/gemini-2.0-flash-001",
                messages: [
                    {
                        role: "system",
                        content: "You are a LaTeX expert. Generate ONLY the LaTeX code for the diagram or table requested by the user. Do not include any explanation, preamble, or backticks. Start directly with the LaTeX command. Ensure the code is production-ready."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.1,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: `API error: ${errorText}` });
        }

        const data = await response.json();
        const content = data.choices[0].message.content.trim();
        return res.status(200).json({ content });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
