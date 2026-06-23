// Weekly competition: list comps, hand out starter files, score an uploaded
// predictions CSV against a private answer key, and keep a best-per-user
// leaderboard in Firestore.
//
// An admin "creates" a competition by dropping a folder under content/weekly/<id>/
// containing config.json + answer_key.csv (+ optional starter.csv). The answer
// key is read only server-side and never served.

import fsp from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import multer from "multer";
import { WEEKLY_DIR, safeJoin } from "./paths.js";
import { getDb, requireAuth } from "./auth.js";
import { scoreSubmission, METRICS } from "./scoring.js";

export const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

async function readConfig(id) {
  const dir = safeJoin(WEEKLY_DIR, id);
  if (!dir) return null;
  try {
    const cfg = JSON.parse(await fsp.readFile(path.join(dir, "config.json"), "utf8"));
    return { dir, cfg };
  } catch {
    return null;
  }
}

function isOpen(cfg) {
  if (!cfg.deadline) return true;
  return Date.now() <= new Date(cfg.deadline).getTime();
}

// Public-safe view of a competition (no answer key).
function publicView(id, cfg, dir) {
  const metric = METRICS[cfg.metric];
  return {
    id,
    title: cfg.title || id,
    description: cfg.description || "",
    metric: cfg.metric,
    metricLabel: metric ? metric.label : cfg.metric,
    higherIsBetter: metric ? metric.higherIsBetter : true,
    idCol: cfg.idCol,
    targetCol: cfg.targetCol,
    deadline: cfg.deadline || null,
    open: isOpen(cfg),
    hasStarter: fs.existsSync(path.join(dir, "starter.csv")),
  };
}

// GET /api/weekly — list all competitions (newest id first).
router.get("/", async (_req, res) => {
  let ids;
  try {
    ids = (await fsp.readdir(WEEKLY_DIR, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return res.json({ competitions: [] });
  }
  const comps = [];
  for (const id of ids.sort().reverse()) {
    const r = await readConfig(id);
    if (r) comps.push(publicView(id, r.cfg, r.dir));
  }
  res.json({ competitions: comps });
});

// GET /api/weekly/:id/starter — download the starter / sample-submission file.
router.get("/:id/starter", async (req, res) => {
  const r = await readConfig(req.params.id);
  if (!r) return res.status(404).json({ error: "not_found" });
  const file = path.join(r.dir, "starter.csv");
  res.download(file, `${req.params.id}-starter.csv`, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: "no_starter" });
  });
});

// POST /api/weekly/:id/submit — score an upload and update the leaderboard.
router.post("/:id/submit", requireAuth, upload.single("submission"), async (req, res) => {
  const r = await readConfig(req.params.id);
  if (!r) return res.status(404).json({ error: "not_found" });
  if (!isOpen(r.cfg)) return res.status(403).json({ error: "closed", message: "This competition is closed." });
  if (!req.file) return res.status(400).json({ error: "no_file", message: "Attach a predictions CSV." });

  let result;
  try {
    const answerKeyText = await fsp.readFile(path.join(r.dir, "answer_key.csv"), "utf8");
    result = scoreSubmission({
      answerKeyText,
      submissionText: req.file.buffer.toString("utf8"),
      metric: r.cfg.metric,
      idCol: r.cfg.idCol,
      targetCol: r.cfg.targetCol,
    });
  } catch (err) {
    return res.status(400).json({ error: "scoring_failed", message: err.message });
  }

  // Update best-per-user leaderboard entry transactionally.
  const db = getDb();
  if (db) {
    const ref = db.collection("leaderboards").doc(req.params.id).collection("entries").doc(req.user.uid);
    const now = new Date().toISOString();
    const better = (a, b) => (result.higherIsBetter ? a > b : a < b);
    try {
      await db.runTransaction(async (tx) => {
        const cur = await tx.get(ref);
        const prev = cur.exists ? cur.data() : null;
        const attempts = (prev?.attempts || 0) + 1;
        const beats = !prev || better(result.score, prev.bestScore);
        tx.set(
          ref,
          {
            uid: req.user.uid,
            displayName: req.user.name || req.user.email || "Anonymous",
            email: req.user.email || null,
            bestScore: beats ? result.score : prev.bestScore,
            lastScore: result.score,
            attempts,
            updatedAt: now,
            metric: result.metric,
          },
          { merge: true }
        );
      });
    } catch (err) {
      return res.status(500).json({ error: "leaderboard_write_failed", message: err.message, score: result.score });
    }
  }

  res.json({ score: result.score, n: result.n, metricLabel: result.label, higherIsBetter: result.higherIsBetter });
});
