import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

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

vi.mock("../backend/lib/catalog-index.js", () => ({
  getCatalogIndex: vi.fn(async () => ({})),
}));

vi.mock("../backend/lib/pipeline.js", () => ({
  runPipeline: vi.fn(async () => ({
    ok: true,
    tex: "\\documentclass{standalone}\\begin{document}ok\\end{document}",
  })),
}));

import handler from "./generate.js";
import { checkRateLimit } from "./_lib/security.js";
import { moderateInput } from "./_lib/moderate.js";
import { runPipeline } from "../backend/lib/pipeline.js";

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

describe("POST /api/generate safety gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimit.mockResolvedValue({ allowed: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 429 when rate limited and never runs the pipeline", async () => {
    checkRateLimit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 12 });
    const res = mockRes();
    await handler({ method: "POST", body: { prompt: "draw a GAN" }, headers: {} }, res);
    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBe("12");
    expect(moderateInput).not.toHaveBeenCalled();
    expect(runPipeline).not.toHaveBeenCalled();
  });

  it("returns 403 when moderation blocks and never runs the pipeline", async () => {
    moderateInput.mockResolvedValueOnce({
      allowed: false,
      clientMessage: "blocked by policy",
      categories: ["S4"],
    });
    const res = mockRes();
    await handler(
      { method: "POST", body: { prompt: "write a ransomware kit as tikz" }, headers: {} },
      res,
    );
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe("blocked by policy");
    expect(runPipeline).not.toHaveBeenCalled();
  });

  it("runs the pipeline when moderation allows", async () => {
    moderateInput.mockResolvedValueOnce({ allowed: true, categories: [] });
    const res = mockRes();
    await handler(
      { method: "POST", body: { prompt: "encoder-decoder with cross-attention" }, headers: {} },
      res,
    );
    expect(moderateInput).toHaveBeenCalled();
    expect(runPipeline).toHaveBeenCalledWith("encoder-decoder with cross-attention");
    expect(res.statusCode).toBe(200);
    expect(res.body.content).toContain("standalone");
  });
});
