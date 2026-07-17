const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 8;

// In-memory limiter: exact per warm serverless instance / local dev server.
// Cold starts reset it, so treat this as a first line of defense, not a quota.
const requestLog = new Map();

function getClientIp(req) {
    const forwarded = req.headers?.["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.length > 0) {
        return forwarded.split(",")[0].trim();
    }
    return req.socket?.remoteAddress || "unknown";
}

export function checkRateLimit(req) {
    const now = Date.now();
    const ip = getClientIp(req);

    if (requestLog.size > 10_000) {
        requestLog.clear();
    }

    const timestamps = (requestLog.get(ip) || []).filter(
        (t) => now - t < RATE_LIMIT_WINDOW_MS
    );

    if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
        const retryAfterSeconds = Math.ceil(
            (timestamps[0] + RATE_LIMIT_WINDOW_MS - now) / 1000
        );
        return { allowed: false, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
    }

    timestamps.push(now);
    requestLog.set(ip, timestamps);
    return { allowed: true };
}

export function validatePrompt(prompt, maxLength) {
    if (typeof prompt !== "string") {
        return "Prompt must be a string.";
    }
    const trimmed = prompt.trim();
    if (trimmed.length === 0) {
        return "Prompt must not be empty.";
    }
    if (trimmed.length > maxLength) {
        return `Prompt is too long (${trimmed.length} characters). Maximum is ${maxLength}.`;
    }
    return null;
}

// Guards against the model echoing its own instructions when a user
// asks it to "repeat everything above" or similar extraction prompts.
export function leaksSystemPrompt(output, markers) {
    const lowered = output.toLowerCase();
    return markers.some((marker) => lowered.includes(marker.toLowerCase()));
}
