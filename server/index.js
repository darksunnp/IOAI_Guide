// IOAI Guide server: serves the SPA, the disk-backed content API, the Kaggle
// proxy, weekly-competition scoring, and admin uploads. Designed to run as one
// persistent process locally or on Nest.

import express from "express";
import path from "node:path";
import { PUBLIC_DIR, PORT, ADMIN_UIDS } from "./paths.js";
import { initAuth, authEnabled, requireAuth } from "./auth.js";
import { router as contentRouter } from "./content.js";
import { router as kaggleRouter } from "./kaggle.js";
import { router as weeklyRouter } from "./weekly.js";
import { router as uploadRouter } from "./upload.js";

const app = express();
app.disable("x-powered-by");

// Tell the front end which optional features are live (so it can degrade).
app.get("/api/config", (_req, res) => {
  res.json({ authEnabled: authEnabled(), adminConfigured: ADMIN_UIDS.length > 0 });
});

// Who am I? (used by the client to learn its admin status from the server.)
app.get("/api/me", requireAuth, (req, res) => {
  res.json({ uid: req.user.uid, email: req.user.email || null, name: req.user.name || null, isAdmin: Boolean(req.user.isAdmin) });
});

// API routers.
app.use("/api", contentRouter);
app.use("/api/kaggle", kaggleRouter);
app.use("/api/weekly", weeklyRouter);
app.use("/api/admin", uploadRouter);

// Unknown API routes get JSON, not the SPA shell.
app.use("/api", (_req, res) => res.status(404).json({ error: "not_found" }));

// Static assets + SPA fallback (hash routing, so any non-API GET serves index).
app.use(express.static(PUBLIC_DIR));
app.get("*", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));

await initAuth();
app.listen(PORT, () => {
  console.log("\n  IOAI Guide is running");
  console.log("  →  http://localhost:" + PORT);
  console.log("  auth:", authEnabled() ? "enabled" : "disabled (content-only mode)");
  console.log("  admins:", ADMIN_UIDS.length ? ADMIN_UIDS.join(", ") : "(none set)");
  console.log("\n  Stop with Ctrl+C.\n");
});
