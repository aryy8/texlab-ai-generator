import { checkRateLimit } from "./_lib/security.js";

const COMPILER_ENDPOINT = "https://texlive.net/cgi-bin/latexcgi";
const MAX_SOURCE_LENGTH = 200_000;
const COMPILE_TIMEOUT_MS = 45_000;

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const rate = await checkRateLimit(req, { profile: "compile", res });
    if (!rate.allowed) {
        res.setHeader("Retry-After", String(rate.retryAfterSeconds));
        return res.status(429).json({
            error: `Too many requests. Please wait ${rate.retryAfterSeconds}s and try again.`,
        });
    }

    const source = req.body?.source;
    if (typeof source !== "string" || source.trim().length === 0) {
        return res.status(400).json({ error: "LaTeX source is required." });
    }
    if (source.length > MAX_SOURCE_LENGTH) {
        return res.status(400).json({
            error: `LaTeX source is too long (${source.length} characters). Maximum is ${MAX_SOURCE_LENGTH}.`,
        });
    }

    try {
        const form = new FormData();
        form.append("filecontents[]", source);
        form.append("filename[]", "document.tex");
        form.append("engine", "pdflatex");
        form.append("return", "pdf");

        const upstream = await fetch(COMPILER_ENDPOINT, {
            method: "POST",
            body: form,
            signal: AbortSignal.timeout(COMPILE_TIMEOUT_MS),
            redirect: "follow",
        });

        const contentType = upstream.headers.get("content-type") ?? "";

        if (contentType.includes("application/pdf")) {
            const pdf = Buffer.from(await upstream.arrayBuffer());
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Cache-Control", "no-store");
            return res.status(200).send(pdf);
        }

        const log = await upstream.text();
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        return res.status(422).send(log);
    } catch (error) {
        console.error("compile-latex upstream error:", error);
        return res.status(502).json({
            error: "Preview service unreachable. Check your connection and try again.",
        });
    }
}
