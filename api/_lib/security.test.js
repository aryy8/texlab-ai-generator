import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  checkRateLimit,
  checkRateLimitSync,
  validatePrompt,
  leaksSystemPrompt,
  getOrCreateFingerprint,
} from "./security.js";

describe("validatePrompt", () => {
  it("rejects empty and oversized prompts", () => {
    expect(validatePrompt("", 100)).toBeTruthy();
    expect(validatePrompt("   ", 100)).toBeTruthy();
    expect(validatePrompt("x".repeat(101), 100)).toBeTruthy();
    expect(validatePrompt("hello", 100)).toBeNull();
  });
});

describe("leaksSystemPrompt", () => {
  it("detects marker substrings", () => {
    expect(leaksSystemPrompt("You are a LaTeX expert who…", ["You are a LaTeX expert"])).toBe(true);
    expect(leaksSystemPrompt("\\begin{tikzpicture}", ["You are a LaTeX expert"])).toBe(false);
  });
});

describe("getOrCreateFingerprint", () => {
  it("reuses cookie fingerprint", () => {
    const req = { headers: { cookie: "texlab_rl=abc12345deadbeef" } };
    const result = getOrCreateFingerprint(req);
    expect(result.fingerprint).toBe("abc12345deadbeef");
    expect(result.isNew).toBe(false);
  });

  it("reuses header fingerprint", () => {
    const req = { headers: { "x-texlab-fp": "hdrfingerprint01" } };
    const result = getOrCreateFingerprint(req);
    expect(result.fingerprint).toBe("hdrfingerprint01");
    expect(result.isNew).toBe(false);
  });

  it("creates a new fingerprint when missing", () => {
    const req = { headers: {} };
    const result = getOrCreateFingerprint(req);
    expect(result.isNew).toBe(true);
    expect(result.fingerprint.length).toBeGreaterThanOrEqual(8);
  });
});

describe("checkRateLimit (memory fallback)", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("RATE_LIMIT_BURST", "3");
    vi.stubEnv("RATE_LIMIT_BURST_WINDOW_MS", "60000");
  });

  it("allows then blocks after burst for same IP", async () => {
    const req = {
      headers: { "x-forwarded-for": "203.0.113.50", cookie: "texlab_rl=samefp00000001" },
      socket: { remoteAddress: "203.0.113.50" },
    };
    const headers = {};
    const res = {
      setHeader(k, v) {
        headers[k] = v;
      },
      getHeader(k) {
        return headers[k];
      },
    };

    expect((await checkRateLimit(req, { profile: "generate", res })).allowed).toBe(true);
    expect((await checkRateLimit(req, { profile: "generate", res })).allowed).toBe(true);
    expect((await checkRateLimit(req, { profile: "generate", res })).allowed).toBe(true);
    const blocked = await checkRateLimit(req, { profile: "generate", res });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("sync helper still works", () => {
    const req = {
      headers: { "x-forwarded-for": "198.51.100.9" },
      socket: { remoteAddress: "198.51.100.9" },
    };
    expect(checkRateLimitSync(req).allowed).toBe(true);
  });
});
