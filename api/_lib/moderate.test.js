import { describe, expect, it } from "vitest";
import { parseModerationResponse } from "./moderate.js";

describe("parseModerationResponse", () => {
  it("allows Llama Guard safe", () => {
    expect(parseModerationResponse("safe")).toEqual({
      allowed: true,
      categories: [],
    });
  });

  it("allows safe with trailing whitespace", () => {
    expect(parseModerationResponse("  safe\n  ")).toEqual({
      allowed: true,
      categories: [],
    });
  });

  it("blocks unsafe with categories", () => {
    expect(parseModerationResponse("unsafe\nS4,S6")).toEqual({
      allowed: false,
      categories: ["S4", "S6"],
      reason: "policy_violation",
    });
  });

  it("blocks unsafe without categories", () => {
    expect(parseModerationResponse("unsafe")).toEqual({
      allowed: false,
      categories: [],
      reason: "policy_violation",
    });
  });

  it("parses JSON allowed false", () => {
    expect(
      parseModerationResponse('{"allowed":false,"categories":["S3"],"reason":"weapons"}'),
    ).toEqual({
      allowed: false,
      categories: ["S3"],
      reason: "weapons",
    });
  });

  it("parses JSON allowed true", () => {
    expect(parseModerationResponse('{"allowed":true,"categories":[]}')).toEqual({
      allowed: true,
      categories: [],
      reason: undefined,
    });
  });

  it("fails closed on empty / unrecognized", () => {
    expect(parseModerationResponse("")).toMatchObject({
      allowed: false,
      categories: ["parse_error"],
    });
    expect(parseModerationResponse("maybe?")).toMatchObject({
      allowed: false,
      categories: ["parse_error"],
    });
  });

  it("treats embedded unsafe as block", () => {
    expect(parseModerationResponse("The content is unsafe for this product.")).toMatchObject({
      allowed: false,
    });
  });
});
