/**
 * Minimal Upstash Redis REST client (no SDK dependency).
 * Returns null when env is unset so callers can degrade gracefully.
 */

export function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

/**
 * Run a Redis command via Upstash REST.
 * @param {string[]} command e.g. ["GET", "key"]
 * @returns {Promise<unknown|null>} result, or null on missing config / failure
 */
export async function redisCommand(command) {
  const cfg = getRedisConfig();
  if (!cfg) return null;

  try {
    const response = await fetch(`${cfg.url}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) {
      const text = await response.text();
      console.error("Upstash Redis error:", response.status, text);
      return null;
    }
    const data = await response.json();
    return data?.result ?? null;
  } catch (error) {
    console.error("Upstash Redis request failed:", error);
    return null;
  }
}

/**
 * Pipeline multiple commands in one HTTP round-trip.
 * @param {string[][]} commands
 * @returns {Promise<unknown[]|null>}
 */
export async function redisPipeline(commands) {
  const cfg = getRedisConfig();
  if (!cfg) return null;

  try {
    const response = await fetch(`${cfg.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) {
      const text = await response.text();
      console.error("Upstash Redis pipeline error:", response.status, text);
      return null;
    }
    const data = await response.json();
    if (!Array.isArray(data)) return null;
    return data.map((row) => row?.result ?? null);
  } catch (error) {
    console.error("Upstash Redis pipeline failed:", error);
    return null;
  }
}
