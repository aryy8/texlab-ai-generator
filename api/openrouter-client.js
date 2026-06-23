export const OPENROUTER_MODEL = "google/gemini-2.5-flash";

const DEFAULT_TIKZ_LIBRARIES = [
    "arrows.meta",
    "positioning",
    "shapes.geometric",
    "fit",
    "backgrounds",
    "calc",
];

function mergeTikzLibraries(libraryList) {
    const libraries = libraryList
        .split(",")
        .map((library) => library.trim())
        .filter(Boolean);

    for (const library of DEFAULT_TIKZ_LIBRARIES) {
        if (!libraries.includes(library)) {
            libraries.push(library);
        }
    }

    return libraries.join(", ");
}

function normalizeLatex(content) {
    const latex = content.replace(/```latex\n?/gi, "").replace(/```\n?/g, "").trim();

    if (!/\\begin\s*\{tikzpicture\}/i.test(latex)) {
        return latex;
    }

    const tikzLibraryRegex = /\\usetikzlibrary\s*\{([^}]*)\}/i;
    const existingLibraries = latex.match(tikzLibraryRegex);

    if (existingLibraries) {
        return latex.replace(
            tikzLibraryRegex,
            `\\usetikzlibrary{${mergeTikzLibraries(existingLibraries[1])}}`
        );
    }

    const tikzPackageRegex = /(\\usepackage(?:\[[^\]]*\])?\s*\{tikz\})/i;
    if (tikzPackageRegex.test(latex)) {
        return latex.replace(
            tikzPackageRegex,
            `$1\n\\usetikzlibrary{${DEFAULT_TIKZ_LIBRARIES.join(", ")}}`
        );
    }

    return `\\usetikzlibrary{${DEFAULT_TIKZ_LIBRARIES.join(", ")}}\n${latex}`;
}

export async function createCompletion(apiKey, messages, temperature, maxTokens = 4096) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://texlab.ai",
            "X-Title": "teXlab",
        },
        body: JSON.stringify({
            model: OPENROUTER_MODEL,
            messages,
            temperature,
            max_tokens: maxTokens,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        try {
            const parsed = JSON.parse(errorText);
            if (parsed.error?.code === 402) {
                throw new Error(
                    "Insufficient OpenRouter credits. Add credits at https://openrouter.ai/settings/credits, or try a shorter prompt."
                );
            }
        } catch (parseError) {
            if (parseError instanceof Error && parseError.message.startsWith("Insufficient")) {
                throw parseError;
            }
        }
        throw new Error(`API error: ${errorText}`);
    }

    const data = await response.json();
    return normalizeLatex(data.choices[0].message.content);
}
