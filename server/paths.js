// Shared filesystem locations and small env-backed config.
// Everything is resolved relative to the app root (the Nwe_Website_IOAI folder)
// so the same code runs locally and on Nest.

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const APP_ROOT = path.join(__dirname, "..");
export const PUBLIC_DIR = path.join(APP_ROOT, "public");
export const CONTENT_DIR = path.join(APP_ROOT, "content");
export const MANIFEST_FILE = path.join(CONTENT_DIR, "content.json");
export const WEEKLY_DIR = path.join(CONTENT_DIR, "weekly");

// Where your learning notebooks / problems live. Defaults to ../AI_gold next to
// this project; override with AI_GOLD_DIR when the layout differs (e.g. on Nest).
export const AI_GOLD_DIR = process.env.AI_GOLD_DIR
  ? path.resolve(process.env.AI_GOLD_DIR)
  : path.join(APP_ROOT, "..", "AI_gold");

export const PORT = Number(process.env.PORT) || 3000;

// Firebase UIDs allowed into the admin pages / write endpoints (comma separated).
export const ADMIN_UIDS = (process.env.ADMIN_UIDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Path to the firebase-admin service-account JSON. When absent, the server runs
// in "no-auth" mode: content browsing works, but auth-gated features are off.
export const SERVICE_ACCOUNT_FILE = process.env.FIREBASE_SERVICE_ACCOUNT || "";

// Guard against path-traversal: resolve `rel` under `base` and ensure it stays
// inside. Returns the absolute path, or null if it escapes.
export function safeJoin(base, rel) {
  const target = path.resolve(base, "." + path.sep + rel);
  const baseResolved = path.resolve(base);
  if (target === baseResolved) return target;
  if (target.startsWith(baseResolved + path.sep)) return target;
  return null;
}
