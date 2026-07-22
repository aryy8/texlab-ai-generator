import type { IncomingMessage, ServerResponse } from "http";
import type { Plugin, ViteDevServer } from "vite";
import generateLatex from "./api/generate-latex.js";
import compileLatex from "./api/compile-latex.js";
import exportOverleaf from "./api/export-overleaf.js";

type ApiRes = {
  status: (code: number) => ApiRes;
  json: (body: unknown) => void;
  send: (body: string | Buffer) => void;
  setHeader: (name: string, value: string) => void;
};

type ApiHandler = (
  req: {
    method?: string;
    url?: string;
    body?: unknown;
    headers?: IncomingMessage["headers"];
    socket?: { remoteAddress?: string };
  },
  res: ApiRes,
) => Promise<unknown>;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

function createMockRes(serverRes: ServerResponse): ApiRes {
  let statusCode = 200;
  let ended = false;

  const apiRes: ApiRes = {
    status(code: number) {
      statusCode = code;
      return apiRes;
    },
    setHeader(name: string, value: string) {
      if (!ended) serverRes.setHeader(name, value);
    },
    json(body: unknown) {
      if (ended) return;
      ended = true;
      serverRes.statusCode = statusCode;
      serverRes.setHeader("Content-Type", "application/json");
      serverRes.end(JSON.stringify(body));
    },
    send(body: string | Buffer) {
      if (ended) return;
      ended = true;
      serverRes.statusCode = statusCode;
      serverRes.end(body);
    },
  };

  return apiRes;
}

const postRoutes: Record<string, ApiHandler> = {
  "/api/generate-latex": generateLatex as ApiHandler,
  "/api/compile-latex": compileLatex as ApiHandler,
  "/api/export-overleaf": exportOverleaf as ApiHandler,
};

export function apiDevPlugin(env: Record<string, string>): Plugin {
  return {
    name: "api-dev",
    configureServer(server: ViteDevServer) {
      for (const key of ["OPEN_ROUTER_API", "OPENROUTER_MODEL", "OPENROUTER_TIER"]) {
        if (env[key]) {
          process.env[key] = env[key];
        }
      }

      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split("?")[0] ?? "";

        // GET download for Overleaf snip_uri
        if (req.method === "GET" && pathname.startsWith("/api/export-overleaf/")) {
          try {
            await exportOverleaf(
              {
                method: req.method,
                url: req.url,
                headers: req.headers,
                socket: { remoteAddress: req.socket.remoteAddress },
              },
              createMockRes(res),
            );
          } catch (error) {
            console.error(error);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
          return;
        }

        const handler = postRoutes[pathname];
        if (!handler || req.method !== "POST") {
          return next();
        }

        try {
          const body = await readBody(req);
          const parsedBody = body ? JSON.parse(body) : {};
          await handler(
            {
              method: req.method,
              url: req.url,
              body: parsedBody,
              headers: req.headers,
              socket: { remoteAddress: req.socket.remoteAddress },
            },
            createMockRes(res),
          );
        } catch (error) {
          console.error(error);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Internal server error" }));
        }
      });
    },
  };
}
