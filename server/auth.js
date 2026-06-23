// firebase-admin bootstrap + auth middleware.
//
// If no service-account is configured the server still boots fully — content
// browsing and downloads work — but any auth-gated route returns 503 so the
// front end can degrade gracefully (phases A–B without Firebase; C–F with it).

import fs from "node:fs";
import { ADMIN_UIDS, SERVICE_ACCOUNT_FILE } from "./paths.js";

let admin = null; // the firebase-admin module, loaded lazily
let app = null; // the initialized app
let db = null; // Firestore handle

export const authEnabled = () => Boolean(app);

// Try to initialize firebase-admin from the service-account JSON. Never throws —
// failures just leave auth disabled with a console warning.
export async function initAuth() {
  if (!SERVICE_ACCOUNT_FILE) {
    console.warn(
      "  [auth] FIREBASE_SERVICE_ACCOUNT not set — Google login, Kaggle, " +
        "activity and leaderboard features are disabled (content browsing still works)."
    );
    return;
  }
  try {
    const raw = fs.readFileSync(SERVICE_ACCOUNT_FILE, "utf8");
    const credentials = JSON.parse(raw);
    admin = (await import("firebase-admin")).default;
    app = admin.initializeApp({
      credential: admin.credential.cert(credentials),
    });
    db = admin.firestore();
    console.log("  [auth] firebase-admin initialized for project:", credentials.project_id);
  } catch (err) {
    console.warn("  [auth] failed to initialize firebase-admin:", err.message);
    admin = null;
    app = null;
    db = null;
  }
}

export function getDb() {
  return db;
}

// Express middleware: require a valid Firebase ID token in the Authorization
// header ("Bearer <token>"). On success attaches req.user = { uid, email, ... }.
export async function requireAuth(req, res, next) {
  if (!app) {
    return res.status(503).json({ error: "auth_unconfigured", message: "Server has no Firebase credentials configured." });
  }
  const header = req.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: "missing_token", message: "No Authorization bearer token." });
  }
  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    req.user = decoded;
    req.user.isAdmin = ADMIN_UIDS.includes(decoded.uid);
    next();
  } catch {
    return res.status(401).json({ error: "invalid_token", message: "Could not verify ID token." });
  }
}

// Express middleware: must run after requireAuth. Rejects non-admins.
export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "missing_token" });
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: "not_admin", message: "Admin access required." });
  }
  next();
}
