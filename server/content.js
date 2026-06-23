// Content API: the disk-backed heart of the site.
//
// It merges a curated manifest (content/content.json) with a live scan of the
// AI_gold tree, so dropping a new .ipynb or problem folder onto disk makes it
// appear automatically (manifest entries win for nicer titles / tags / links).

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import express from "express";
import { AI_GOLD_DIR, MANIFEST_FILE, safeJoin } from "./paths.js";

export const router = express.Router();

// ---- manifest -------------------------------------------------------------

async function readManifest() {
  try {
    const raw = await fsp.readFile(MANIFEST_FILE, "utf8");
    const m = JSON.parse(raw);
    return {
      notebooks: m.notebooks || [],
      problems: m.problems || [],
      resources: m.resources || [],
    };
  } catch {
    return { notebooks: [], problems: [], resources: [] };
  }
}

// ---- helpers --------------------------------------------------------------

function prettify(name) {
  return name
    .replace(/\.ipynb$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function relFromGold(abs) {
  return path.relative(AI_GOLD_DIR, abs).split(path.sep).join("/");
}

async function walk(dir, predicate) {
  const out = [];
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...(await walk(full, predicate)));
    } else if (predicate(ent.name)) {
      out.push(full);
    }
  }
  return out;
}

// ---- scanners -------------------------------------------------------------

// Notebooks live under AI_gold/ML. category = first folder under ML,
// subcategory = second folder if present.
async function scanNotebooks() {
  const mlDir = path.join(AI_GOLD_DIR, "ML");
  const files = await walk(mlDir, (n) => n.toLowerCase().endsWith(".ipynb"));
  return files.map((abs) => {
    const rel = relFromGold(abs); // e.g. ML/Supervised/Linear/Linear_reg.ipynb
    const segs = rel.split("/");
    const category = segs[1] || "General";
    const subcategory = segs.length > 3 ? segs[2] : null;
    return {
      id: rel.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
      title: prettify(path.basename(abs)),
      category,
      subcategory,
      path: rel,
    };
  });
}

const looksLikeSolution = (n) => /(_my|_sol|solution|answer)/i.test(n);
const looksLikeNotebook = (n) => n.toLowerCase().endsWith(".ipynb");
const looksLikeData = (n) => /\.(csv|tsv|json|parquet|zip|npy|npz)$/i.test(n);

// Each subfolder of AI_gold/Problems is a problem. Try to guess baseline /
// solution / datasets from the file names; the manifest can override all of it.
async function scanProblems() {
  const probDir = path.join(AI_GOLD_DIR, "Problems");
  let dirs;
  try {
    dirs = (await fsp.readdir(probDir, { withFileTypes: true })).filter((d) => d.isDirectory());
  } catch {
    return [];
  }
  const out = [];
  for (const d of dirs) {
    const full = path.join(probDir, d.name);
    const files = (await fsp.readdir(full)).sort();
    const notebooks = files.filter(looksLikeNotebook);
    const solution = notebooks.find(looksLikeSolution) || null;
    const baseline = notebooks.find((n) => n !== solution) || null;
    const datasets = files.filter(looksLikeData);
    if (!files.length) continue; // skip empty placeholder folders
    out.push({
      id: d.name,
      title: prettify(d.name),
      baseline: baseline ? `Problems/${d.name}/${baseline}` : null,
      solution: solution ? `Problems/${d.name}/${solution}` : null,
      datasets: datasets.map((f) => `Problems/${d.name}/${f}`),
      kaggle: null,
    });
  }
  return out;
}

// Merge manifest entries over scanned ones, keyed by id. Manifest fields win;
// scanned fields fill the gaps.
function mergeById(scanned, manifest) {
  const byId = new Map();
  for (const item of scanned) byId.set(item.id, item);
  for (const item of manifest) {
    const existing = byId.get(item.id) || {};
    byId.set(item.id, { ...existing, ...item });
  }
  return [...byId.values()];
}

// ---- routes ---------------------------------------------------------------

router.get("/content", async (_req, res) => {
  const manifest = await readManifest();
  const [nb, pr] = await Promise.all([scanNotebooks(), scanProblems()]);
  res.json({
    notebooks: mergeById(nb, manifest.notebooks),
    problems: mergeById(pr, manifest.problems),
    resources: manifest.resources,
    aiGoldFound: fs.existsSync(AI_GOLD_DIR),
  });
});

// Raw notebook JSON for the in-browser renderer.
router.get("/notebook", async (req, res) => {
  const rel = String(req.query.path || "");
  const abs = safeJoin(AI_GOLD_DIR, rel);
  if (!abs || !abs.toLowerCase().endsWith(".ipynb")) {
    return res.status(400).json({ error: "bad_path" });
  }
  try {
    const raw = await fsp.readFile(abs, "utf8");
    res.type("application/json").send(raw); // already JSON; pass through verbatim
  } catch {
    res.status(404).json({ error: "not_found" });
  }
});

// Stream any content file as a download (baseline, solution, dataset, ...).
router.get("/download", (req, res) => {
  const rel = String(req.query.path || "");
  const abs = safeJoin(AI_GOLD_DIR, rel);
  if (!abs) return res.status(400).json({ error: "bad_path" });
  res.download(abs, path.basename(abs), (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: "not_found" });
  });
});
