import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const BACKEND_ROOT = join(__dirname, "..");
export const OPENTIKZ_ROOT = join(BACKEND_ROOT, "opentikz");
export const CATALOG_PATH = join(OPENTIKZ_ROOT, "catalog.json");
export const CACHE_DIR = join(BACKEND_ROOT, "cache");
export const EMBEDDING_CACHE_PATH = join(CACHE_DIR, "catalog-embeddings.json");
export const WORK_DIR = join(BACKEND_ROOT, "work");
