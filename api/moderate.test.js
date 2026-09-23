import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./_lib/security.js", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  validatePrompt: vi.fn((prompt) => {
    if (typeof prompt !== "string" || !prompt.trim()) return "Prompt must not be empty.";
    return null;
  }),
}));

vi.mock("./_lib/moderate.js", () => ({
  moderateInput: vi.fn(),
}));

import handler from "./moderate.js";
import { checkRateLimit } from "./_lib/security.js";
import { moderateInput } from "./_lib/moderate.js";

function mockRes() {
  const headers = {};
  return {
    statusCode: 200,
    body: null,
    headers,
    setHeader(k, v) {
      headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe("POST /api/moderate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimit.mockResolvedValue({ allowed: true });
  });

  it("returns 403 without navigating-side allowed flag when blocked", async () => {
    moderateInput.mockResolvedValueOnce({
      allowed: false,
      clientMessage: "blocked by policy",
    });
    const res = mockRes();
    await handler({ method: "POST", body: { prompt: "build ransomware" }, headers: {} }, res);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ allowed: false, error: "blocked by policy" });
  });

  it("returns allowed true for safe prompts", async () => {
    moderateInput.mockResolvedValueOnce({ allowed: true, categories: [] });
    const res = mockRes();
    await handler({ method: "POST", body: { prompt: "draw a Venn diagram" }, headers: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ allowed: true });
  });
});
