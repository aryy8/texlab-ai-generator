#!/usr/bin/env node
/**
 * Lightweight HTTP server: POST /generate
 *
 *   node backend/server.mjs
 *   PORT=8787 node backend/server.mjs
 */

import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runPipeline } from "./lib/pipeline.js";
import { getCatalogIndex } from "./lib/catalog-index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 8787);

function loadEnvLocal() {
  const envPath = resolve(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function readJson(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolveBody({});
      try {
        resolveBody(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(payload);
}

loadEnvLocal();

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    return send(res, 204, {});
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return send(res, 200, { ok: true });
  }

  if (req.method === "POST" && (url.pathname === "/generate" || url.pathname === "/api/generate")) {
    try {
      const body = await readJson(req);
      const prompt = body.prompt ?? body.query;
      if (typeof prompt !== "string" || !prompt.trim()) {
        return send(res, 400, { error: "prompt is required" });
      }
      // Ensure embedding cache is warm (no-op if already built).
      await getCatalogIndex();
      const result = await runPipeline(prompt.trim());
      return send(res, result.ok ? 200 : 422, result);
    } catch (error) {
      console.error("/generate error:", error);
      return send(res, 500, { error: error.message || "Generation failed" });
    }
  }

  return send(res, 404, { error: "Not found. POST /generate" });
});

server.listen(PORT, () => {
  console.log(`OpenTikZ pipeline listening on http://localhost:${PORT}`);
  console.log(`  POST /generate  { "prompt": "..." }`);
});
