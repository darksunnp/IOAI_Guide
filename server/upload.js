// Admin-only content management.
//
// Notebooks, problems and resources are now LINK-BASED: the admin pastes Kaggle
// / Colab / GitHub links and we store them in content/content.json (which lives
// on disk and persists on Nest). No notebook/dataset files are uploaded to the
// server. The only thing still uploaded is a weekly competition's answer key,
// which must stay server-side so it can score submissions without being exposed.

import fsp from "node:fs/promises";
import path from "node:path";
import express from "express";
import multer from "multer";
import { MANIFEST_FILE, WEEKLY_DIR, safeJoin } from "./paths.js";
import { requireAuth, requireAdmin } from "./auth.js";

export const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });

router.use(requireAuth, requireAdmin); // every route here is admin-gated

const slugify = (s) => String(s || "").replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-|-$/g, "");
const tagsFrom = (s) => String(s || "").split(",").map((t) => t.trim()).filter(Boolean);
const clean = (s) => (s == null ? "" : String(s).trim());

async function readManifest() {
  try {
    const m = JSON.parse(await fsp.readFile(MANIFEST_FILE, "utf8"));
    return { notebooks: m.notebooks || [], problems: m.problems || [], resources: m.resources || [] };
  } catch {
    return { notebooks: [], problems: [], resources: [] };
  }
}

async function writeManifest(m) {
  await fsp.mkdir(path.dirname(MANIFEST_FILE), { recursive: true });
  await fsp.writeFile(MANIFEST_FILE, JSON.stringify(m, null, 2) + "\n", "utf8");
}

function upsert(arr, entry) {
  const i = arr.findIndex((e) => e.id === entry.id);
  if (i === -1) arr.push(entry);
  else arr[i] = { ...arr[i], ...entry };
}

// "Label | https://url" (or just a URL) per line -> [{label, url}]
function parseDatasetLinks(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const bar = line.indexOf("|");
      if (bar !== -1) return { label: line.slice(0, bar).trim() || "Dataset", url: line.slice(bar + 1).trim() };
      return { label: "Dataset", url: line };
    })
    .filter((d) => /^https?:\/\//i.test(d.url));
}

// ---- notebook (link-based) ------------------------------------------------
router.post("/notebook", express.json(), async (req, res) => {
  try {
    const { title, category = "General", subcategory = "", tags = "", colab = "", kaggle = "", url = "" } = req.body || {};
    if (!clean(title)) return res.status(400).json({ error: "missing_title" });
    if (!clean(colab) && !clean(kaggle) && !clean(url)) {
      return res.status(400).json({ error: "missing_link", message: "Provide at least one link (Colab, Kaggle, or other)." });
    }
    const id = "lnk-" + slugify(title);
    const m = await readManifest();
    upsert(m.notebooks, {
      id,
      title: clean(title),
      category: clean(category) || "General",
      subcategory: clean(subcategory) || null,
      tags: tagsFrom(tags),
      colab: clean(colab) || null,
      kaggle: clean(kaggle) || null,
      url: clean(url) || null,
    });
    await writeManifest(m);
    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ error: "write_failed", message: err.message });
  }
});

// ---- problem (link-based) -------------------------------------------------
router.post("/problem", express.json(), async (req, res) => {
  try {
    const { title, id: rawId, difficulty = "", tags = "", description = "", kaggle = "", baseline = "", solution = "", colab = "", datasets = "" } = req.body || {};
    if (!clean(title)) return res.status(400).json({ error: "missing_title" });
    const id = slugify(rawId || title);
    const m = await readManifest();
    upsert(m.problems, {
      id,
      title: clean(title),
      difficulty: clean(difficulty) || null,
      tags: tagsFrom(tags),
      description: clean(description),
      kaggle: clean(kaggle) || null,
      colab: clean(colab) || null,
      baseline: clean(baseline) || null, // URL (rendered as external link)
      solution: clean(solution) || null, // URL
      datasets: parseDatasetLinks(datasets), // [{label,url}]
    });
    await writeManifest(m);
    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ error: "write_failed", message: err.message });
  }
});

// ---- resource (link only) -------------------------------------------------
router.post("/resource", express.json(), async (req, res) => {
  try {
    const { title, url, category = "General", description = "" } = req.body || {};
    if (!clean(title) || !clean(url)) return res.status(400).json({ error: "missing_fields" });
    const m = await readManifest();
    m.resources.push({ id: slugify(title) + "-" + Date.now().toString(36), title: clean(title), url: clean(url), category: clean(category) || "General", description: clean(description) });
    await writeManifest(m);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "write_failed", message: err.message });
  }
});

// ---- delete a manifest entry ----------------------------------------------
router.post("/delete", express.json(), async (req, res) => {
  try {
    const { kind, id } = req.body || {};
    if (!["notebooks", "problems", "resources"].includes(kind) || !id) return res.status(400).json({ error: "bad_request" });
    const m = await readManifest();
    const before = m[kind].length;
    m[kind] = m[kind].filter((e) => e.id !== id);
    await writeManifest(m);
    res.json({ ok: true, removed: before - m[kind].length });
  } catch (err) {
    res.status(500).json({ error: "write_failed", message: err.message });
  }
});

// ---- reorder a manifest array (drag-and-drop in admin) --------------------
router.post("/reorder", express.json(), async (req, res) => {
  try {
    const { kind, ids } = req.body || {};
    if (!["notebooks", "problems", "resources"].includes(kind) || !Array.isArray(ids)) {
      return res.status(400).json({ error: "bad_request" });
    }
    const m = await readManifest();
    const byId = new Map(m[kind].map((e) => [e.id, e]));
    const reordered = ids.map((id) => byId.get(id)).filter(Boolean);
    for (const e of m[kind]) if (!reordered.includes(e)) reordered.push(e); // keep any not listed
    m[kind] = reordered;
    await writeManifest(m);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "write_failed", message: err.message });
  }
});

// ---- weekly competition (answer key MUST stay server-side) ----------------
router.post(
  "/weekly",
  upload.fields([
    { name: "answer_key", maxCount: 1 },
    { name: "starter", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { id: rawId, title, metric, idCol, targetCol, deadline = "", description = "" } = req.body;
      const id = slugify(rawId || title);
      if (!id || !title || !metric || !idCol || !targetCol) {
        return res.status(400).json({ error: "missing_fields", message: "id, title, metric, idCol, targetCol are required." });
      }
      const files = req.files || {};
      if (!files.answer_key?.[0]) return res.status(400).json({ error: "no_answer_key" });

      const dir = safeJoin(WEEKLY_DIR, id);
      if (!dir) return res.status(400).json({ error: "bad_id" });
      await fsp.mkdir(dir, { recursive: true });
      await fsp.writeFile(path.join(dir, "answer_key.csv"), files.answer_key[0].buffer);
      if (files.starter?.[0]) await fsp.writeFile(path.join(dir, "starter.csv"), files.starter[0].buffer);
      await fsp.writeFile(
        path.join(dir, "config.json"),
        JSON.stringify({ title, metric, idCol, targetCol, deadline: deadline || null, description }, null, 2) + "\n",
        "utf8"
      );
      res.json({ ok: true, id });
    } catch (err) {
      res.status(500).json({ error: "write_failed", message: err.message });
    }
  }
);
