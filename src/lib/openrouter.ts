export interface OpenRouterResponse {
    choices: {
        message: {
            content: string;
        };
    }[];
}

export const generateLaTeX = async (prompt: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_OPEN_ROUTER_API;

    if (!apiKey) {
        throw new Error("VITE_OPEN_ROUTER_API is not defined in .env");
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://texlab.ai", // Optional
            "X-Title": "teXlab", // Optional
        },
        body: JSON.stringify({
            model: "google/gemini-2.0-flash-001", // Fast and capable for LaTeX
            messages: [
                {
                    role: "system",
                    content: "You are a LaTeX expert. Generate ONLY the LaTeX code for the diagram or table requested by the user. Do not include any explanation, preamble (unless necessary for the snippet to work, like tikz libraries), or backticks. Start directly with the LaTeX command (e.g., \\begin{tikzpicture} or \\begin{tabular}). Ensure the code is production-ready and aesthetically pleasing."
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
        const errorBody = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errorBody}`);
    }

    const data: OpenRouterResponse = await response.json();
    return data.choices[0].message.content.trim();
};
