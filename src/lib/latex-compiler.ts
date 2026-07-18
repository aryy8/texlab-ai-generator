export interface CompileSuccess {
    status: "success";
    pdfUrl: string;
}

export interface CompileFailure {
    status: "error";
    log: string;
}

export type CompileResult = CompileSuccess | CompileFailure;

// Compiles via our same-origin /api/compile-latex proxy, which POSTs to
// texlive.net's latexcgi. The proxy exists because browsers cannot call
// texlive.net directly (no CORS headers).
const COMPILER_ENDPOINT = "/api/compile-latex";

function extractErrors(log: string): string {
    const lines = log.split("\n");
    const picked: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("!")) {
            picked.push(...lines.slice(i, Math.min(i + 3, lines.length)), "");
        }
    }

    if (picked.length > 0) {
        return picked.join("\n").trim();
    }
    return lines.slice(-30).join("\n").trim();
}

export async function compileLatex(source: string, signal?: AbortSignal): Promise<CompileResult> {
    const response = await fetch(COMPILER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
        signal,
    });

    const contentType = response.headers.get("content-type") ?? "";

    if (response.ok && contentType.includes("application/pdf")) {
        const blob = await response.blob();
        return { status: "success", pdfUrl: URL.createObjectURL(blob) };
    }

    if (contentType.includes("application/json")) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Preview service unreachable. Check your connection and try again.");
    }

    const log = await response.text();
    return { status: "error", log: extractErrors(log) };
}
