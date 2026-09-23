import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const BACKEND_ROOT = join(__dirname, "..");
export const OPENTIKZ_ROOT = join(BACKEND_ROOT, "opentikz");
export const CATALOG_PATH = join(OPENTIKZ_ROOT, "catalog.json");

/** Vercel/Lambda package dir is read-only; only /tmp (os.tmpdir) is writable. */
function isServerlessRuntime() {
  return Boolean(
    process.env.VERCEL
    || process.env.AWS_LAMBDA_FUNCTION_NAME
    || process.env.LAMBDA_TASK_ROOT,
  );
}

const WRITABLE_ROOT = isServerlessRuntime()
  ? join(tmpdir(), "texlab")
  : BACKEND_ROOT;

export const CACHE_DIR = join(WRITABLE_ROOT, "cache");
export const EMBEDDING_CACHE_PATH = join(CACHE_DIR, "catalog-embeddings.json");
export const WORK_DIR = join(WRITABLE_ROOT, "work");
