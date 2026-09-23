/**
 * Durable multi-window rate limits (Upstash Redis) with in-memory fallback.
 * Also issues a short-lived fingerprint cookie to raise the cost of IP rotation.
 */

import { createHash, randomUUID } from "node:crypto";
import { redisPipeline, getRedisConfig } from "./redis.js";

const FP_COOKIE = "texlab_rl";
const FP_HEADER = "x-texlab-fp";
const FP_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

const memoryBuckets = new Map();

function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const PROFILES = {
  generate: {
    burst: () => envInt("RATE_LIMIT_BURST", 8),
    burstWindowMs: () => envInt("RATE_LIMIT_BURST_WINDOW_MS", 60_000),
    hour: () => envInt("RATE_LIMIT_HOUR", 40),
    day: () => envInt("RATE_LIMIT_DAY", 100),
  },
  compile: {
    burst: () => envInt("RATE_LIMIT_COMPILE_BURST", 30),
    burstWindowMs: () => envInt("RATE_LIMIT_BURST_WINDOW_MS", 60_000),
    hour: () => envInt("RATE_LIMIT_COMPILE_HOUR", 200),
    day: () => envInt("RATE_LIMIT_DAY", 500),
  },
};

export function getClientIp(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

function parseCookies(header) {
  const out = {};
  if (typeof header !== "string" || !header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

export function getOrCreateFingerprint(req) {
  const header = req.headers?.[FP_HEADER];
  if (typeof header === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(header.trim())) {
    return { fingerprint: header.trim(), isNew: false };
  }
  const cookies = parseCookies(req.headers?.cookie);
  const existing = cookies[FP_COOKIE];
  if (typeof existing === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) {
    return { fingerprint: existing, isNew: false };
  }
  return { fingerprint: randomUUID().replace(/-/g, ""), isNew: true };
}

export function setFingerprintCookie(res, fingerprint) {
  if (!res || typeof res.setHeader !== "function") return;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const value = `${FP_COOKIE}=${encodeURIComponent(fingerprint)}; Path=/; Max-Age=${FP_MAX_AGE_SEC}; SameSite=Lax; HttpOnly${secure}`;
  const prev = res.getHeader?.("Set-Cookie");
  if (!prev) {
    res.setHeader("Set-Cookie", value);
  } else if (Array.isArray(prev)) {
    res.setHeader("Set-Cookie", [...prev, value]);
  } else {
    res.setHeader("Set-Cookie", [String(prev), value]);
  }
}

function memoryCheck(key, limit, windowMs) {
  const now = Date.now();
  if (memoryBuckets.size > 20_000) memoryBuckets.clear();

  const timestamps = (memoryBuckets.get(key) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= limit) {
    const retryAfterSeconds = Math.ceil((timestamps[0] + windowMs - now) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
  }
  timestamps.push(now);
  memoryBuckets.set(key, timestamps);
  return { allowed: true };
}

/**
 * Fixed-window counter via Redis INCR + EXPIRE.
 * Returns { allowed, retryAfterSeconds } or null if Redis unavailable.
 */
async function redisWindowCheck(key, limit, windowSec) {
  const results = await redisPipeline([
    ["INCR", key],
    ["TTL", key],
  ]);
  if (!results) return null;

  const count = Number(results[0]);
  let ttl = Number(results[1]);
  if (!Number.isFinite(count)) return null;

  // First hit (or key without expiry): set the window TTL.
  if (!Number.isFinite(ttl) || ttl < 0) {
    await redisPipeline([["EXPIRE", key, String(windowSec)]]);
    ttl = windowSec;
  }

  if (count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Number.isFinite(ttl) && ttl > 0 ? ttl : windowSec),
    };
  }
  return { allowed: true };
}

async function checkIdentity(prefix, id, profile) {
  const burstLimit = profile.burst();
  const burstWindowMs = profile.burstWindowMs();
  const hourLimit = profile.hour();
  const dayLimit = profile.day();
  const burstWindowSec = Math.max(1, Math.ceil(burstWindowMs / 1000));

  if (getRedisConfig()) {
    const burst = await redisWindowCheck(`rl:${prefix}:burst:${id}`, burstLimit, burstWindowSec);
    if (burst && !burst.allowed) return burst;
    if (burst === null) {
      // Degrade this identity to memory for this request.
      return memoryCheck(`mem:${prefix}:burst:${id}`, burstLimit, burstWindowMs);
    }

    const hour = await redisWindowCheck(`rl:${prefix}:hour:${id}`, hourLimit, 3600);
    if (hour && !hour.allowed) return hour;

    const day = await redisWindowCheck(`rl:${prefix}:day:${id}`, dayLimit, 86400);
    if (day && !day.allowed) return day;

    return { allowed: true };
  }

  // No Redis: in-memory burst only (legacy behaviour).
  return memoryCheck(`mem:${prefix}:burst:${id}`, burstLimit, burstWindowMs);
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {{ profile?: 'generate' | 'compile', res?: import('http').ServerResponse }} [options]
 */
export async function checkRateLimit(req, options = {}) {
  const profileName = options.profile === "compile" ? "compile" : "generate";
  const profile = PROFILES[profileName];
  const ip = getClientIp(req);
  const { fingerprint, isNew } = getOrCreateFingerprint(req);

  if (options.res && isNew) {
    setFingerprintCookie(options.res, fingerprint);
  }

  const ipResult = await checkIdentity("ip", ip, profile);
  if (!ipResult.allowed) {
    console.info(JSON.stringify({
      event: "rate_limited",
      profile: profileName,
      by: "ip",
      ipHash: createHash("sha256").update(ip).digest("hex").slice(0, 12),
      retryAfterSeconds: ipResult.retryAfterSeconds,
    }));
    return ipResult;
  }

  const fpResult = await checkIdentity("fp", fingerprint, profile);
  if (!fpResult.allowed) {
    console.info(JSON.stringify({
      event: "rate_limited",
      profile: profileName,
      by: "fingerprint",
      retryAfterSeconds: fpResult.retryAfterSeconds,
    }));
    return fpResult;
  }

  return { allowed: true, fingerprint, isNewFingerprint: isNew };
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

/** @deprecated use async checkRateLimit — kept for sync memory-only callers in tests */
export function checkRateLimitSync(req) {
  const ip = getClientIp(req);
  const burstLimit = PROFILES.generate.burst();
  const burstWindowMs = PROFILES.generate.burstWindowMs();
  return memoryCheck(`mem:ip:burst:${ip}`, burstLimit, burstWindowMs);
}
