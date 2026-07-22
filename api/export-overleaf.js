import { randomBytes } from "crypto";

/** @type {Map<string, { buffer: Buffer; expires: number }>} */
const store = new Map();

const TTL_MS = 15 * 60 * 1000;

function purgeExpired() {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.expires <= now) store.delete(key);
  }
}

function getPublicBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:5173";
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  purgeExpired();

  const url = req.url || "";
  const getMatch = url.match(/\/api\/export-overleaf\/([^/?]+)/);

  if (req.method === "GET" && getMatch) {
    const token = getMatch[1];
    const entry = store.get(token);
    if (!entry || entry.expires <= Date.now()) {
      return res.status(404).json({ error: "Export expired or not found" });
    }
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="texlab-figure.zip"');
    return res.status(200).send(entry.buffer);
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { zipBase64 } = req.body ?? {};
  if (typeof zipBase64 !== "string" || zipBase64.length === 0) {
    return res.status(400).json({ error: "zipBase64 is required" });
  }

  if (zipBase64.length > 12_000_000) {
    return res.status(400).json({ error: "Export too large" });
  }

  let buffer;
  try {
    buffer = Buffer.from(zipBase64, "base64");
  } catch {
    return res.status(400).json({ error: "Invalid zipBase64" });
  }

  const token = randomBytes(16).toString("hex");
  store.set(token, { buffer, expires: Date.now() + TTL_MS });

  const base = getPublicBaseUrl(req);
  const snipUri = `${base}/api/export-overleaf/${token}`;
  const overleafUrl = `https://www.overleaf.com/docs?snip_uri=${encodeURIComponent(snipUri)}&engine=pdflatex`;

  return res.status(200).json({ overleafUrl, token, expiresInSeconds: TTL_MS / 1000 });
}
