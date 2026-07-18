import type { IncomingMessage, ServerResponse } from "http";
import type { Plugin, ViteDevServer } from "vite";
import generateLatex from "./api/generate-latex.js";
import generatePaper from "./api/generate-paper.js";
import compileLatex from "./api/compile-latex.js";

type ApiRes = {
  status: (code: number) => ApiRes;
  json: (body: unknown) => void;
  send: (body: string | Buffer) => void;
  setHeader: (name: string, value: string) => void;
};

type ApiHandler = (
  req: {
    method?: string;
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

const routes: Record<string, ApiHandler> = {
  "/api/generate-latex": generateLatex as ApiHandler,
  "/api/generate-paper": generatePaper as ApiHandler,
  "/api/compile-latex": compileLatex as ApiHandler,
};

export function apiDevPlugin(env: Record<string, string>): Plugin {
  return {
    name: "api-dev",
    configureServer(server: ViteDevServer) {
      if (env.OPEN_ROUTER_API) {
        process.env.OPEN_ROUTER_API = env.OPEN_ROUTER_API;
      }
      if (env.OPENROUTER_MODEL) {
        process.env.OPENROUTER_MODEL = env.OPENROUTER_MODEL;
      }

      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split("?")[0];
        const handler = pathname ? routes[pathname] : undefined;

        if (!handler || req.method !== "POST") {
          return next();
        }

        try {
          const body = await readBody(req);
          const parsedBody = body ? JSON.parse(body) : {};
          await handler(
            {
              method: req.method,
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
