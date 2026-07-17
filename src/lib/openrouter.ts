async function readErrorMessage(response: Response): Promise<string> {
    try {
        const data = await response.json();
        if (typeof data?.error === "string") {
            return data.error;
        }
    } catch {
        // Non-JSON error body (e.g. platform error pages); fall through.
    }
    return `Server error: ${response.status}`;
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
        throw new Error(await readErrorMessage(response));
    }

    const data = await response.json();
    return data.content;
};

export const generatePaperLaTeX = async (prompt: string, format: string): Promise<string> => {
    const response = await fetch("/api/generate-paper", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, format }),
    });

    if (!response.ok) {
        throw new Error(await readErrorMessage(response));
    }

    const data = await response.json();
    return data.content;
};
