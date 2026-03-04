export interface OpenRouterResponse {
    choices: {
        message: {
            content: string;
        };
    }[];
}

export const generateLaTeX = async (prompt: string): Promise<string> => {
    const response = await fetch("/api/generate-latex", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();
    return data.content;
};
