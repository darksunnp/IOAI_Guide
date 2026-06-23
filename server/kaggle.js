// Kaggle proxy. Calls happen server-side (HTTP Basic user:key) so the browser's
// CORS restrictions don't apply and the key never reaches other clients — the
// same trick as AI_gold/z_website/server.js, generalized.
//
// Kaggle has no "competitions I've joined" endpoint, so we work from the slug
// list the user saved in their Firestore doc (users/{uid}.kaggle.slugs).

import express from "express";
import { getDb } from "./auth.js";
import { requireAuth } from "./auth.js";

export const router = express.Router();

const KAGGLE_API = "https://www.kaggle.com/api/v1";

function basicAuth(username, key) {
  return "Basic " + Buffer.from(`${username}:${key}`).toString("base64");
}

async function kaggleGet(pathname, username, key) {
  const res = await fetch(`${KAGGLE_API}${pathname}`, {
    headers: {
      Authorization: basicAuth(username, key),
      "User-Agent": "ioai-guide/0.1",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`kaggle ${res.status}`);
    err.status = res.status;
    err.body = body.slice(0, 300);
    throw err;
  }
  return res.json();
}

// Pull the saved Kaggle credentials + slugs for the signed-in user.
async function loadKaggleProfile(uid) {
  const db = getDb();
  const snap = await db.collection("users").doc(uid).get();
  const data = snap.exists ? snap.data() : {};
  const kaggle = data.kaggle || {};
  return {
    username: kaggle.username || "",
    key: kaggle.key || "",
    slugs: Array.isArray(kaggle.slugs) ? kaggle.slugs : [],
  };
}

// Top 5 submissions by score for one competition.
async function competitionStats(slug, username, key) {
  const out = { slug, title: slug, deadline: null, metric: null, topSubmissions: [], error: null };

  // best-effort metadata lookup (don't fail the card if this 404s)
  try {
    const list = await kaggleGet(`/competitions/list?search=${encodeURIComponent(slug)}`, username, key);
    const match =
      list.find((c) => (c.ref || "").split("/").pop() === slug) || list[0];
    if (match) {
      out.title = match.title || slug;
      out.deadline = match.deadline || null;
      out.metric = match.evaluationMetric || null;
    }
  } catch {
    /* leave defaults */
  }

  try {
    const subs = await kaggleGet(`/competitions/submissions/list/${encodeURIComponent(slug)}`, username, key);
    const scored = subs
      .map((s) => ({
        date: s.date,
        description: s.description || s.fileName || "",
        status: s.status,
        publicScore: s.publicScore != null && s.publicScore !== "" ? Number(s.publicScore) : null,
        privateScore: s.privateScore != null && s.privateScore !== "" ? Number(s.privateScore) : null,
      }))
      .filter((s) => s.publicScore !== null && !Number.isNaN(s.publicScore));
    // default: higher score is better (most classification comps). The client
    // offers a flip toggle for RMSE-style comps.
    scored.sort((a, b) => b.publicScore - a.publicScore);
    out.topSubmissions = scored.slice(0, 5);
    out.totalSubmissions = subs.length;
  } catch (err) {
    out.error = err.status === 403 ? "Not entered / no access" : `Kaggle error ${err.status || ""}`.trim();
  }
  return out;
}

router.get("/dashboard", requireAuth, async (req, res) => {
  let profile;
  try {
    profile = await loadKaggleProfile(req.user.uid);
  } catch (err) {
    return res.status(500).json({ error: "profile_read_failed", message: err.message });
  }
  if (!profile.username || !profile.key) {
    return res.status(400).json({ error: "no_credentials", message: "Add your Kaggle username + key in Settings." });
  }
  if (!profile.slugs.length) {
    return res.json({ competitions: [], username: profile.username, message: "No competition slugs saved yet." });
  }
  const competitions = await Promise.all(
    profile.slugs.map((slug) => competitionStats(slug, profile.username, profile.key))
  );
  res.json({ competitions, username: profile.username });
});

// Lightweight credential check used by the Settings page ("Test connection").
router.post("/verify", requireAuth, express.json(), async (req, res) => {
  const { username, key } = req.body || {};
  if (!username || !key) return res.status(400).json({ ok: false, message: "username and key required" });
  try {
    await kaggleGet("/competitions/list?page=1", username, key);
    res.json({ ok: true });
  } catch (err) {
    res.status(200).json({ ok: false, message: `Kaggle rejected the credentials (${err.status || "error"}).` });
  }
});
