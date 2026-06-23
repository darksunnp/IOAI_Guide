// Admin: paste Kaggle / Colab / GitHub links to add notebooks, problems and
// resources (stored in content.json on disk). Weekly competitions still take an
// uploaded answer key (it must stay server-side to score submissions).

import { onAuth, getUser, getIsAdmin } from "../auth.js";
import { apiGet, apiPostJson, apiPostForm } from "../lib/api.js";
import { pageHead, signInPrompt, wireSignIn } from "../lib/ui.js";
import { escapeHtml } from "../lib/markdown.js";

const METRICS = [
  ["accuracy", "Accuracy"],
  ["macro_f1", "Macro F1"],
  ["rmse", "RMSE"],
  ["mae", "MAE"],
  ["auc", "ROC AUC"],
];

const field = (label, inner, hint) =>
  `<label class="field"><span class="field-label">${label}</span>${inner}${hint ? `<span class="muted text-small">${hint}</span>` : ""}</label>`;
const result = (id) => `<div id="${id}" class="text-small" style="margin-top:8px"></div>`;

export function render(container) {
  const draw = async () => {
    const user = getUser();
    if (!user) {
      container.innerHTML = pageHead("Manage Content") + signInPrompt("manage content");
      wireSignIn(container);
      return;
    }
    if (!getIsAdmin()) {
      container.innerHTML =
        pageHead("Manage Content") +
        `<div class="notice">Your account isn't an admin. Add your Firebase UID to <code>ADMIN_UIDS</code> on the server, then reload.<br><span class="muted text-small">Your UID: <code>${escapeHtml(user.uid)}</code></span></div>`;
      return;
    }

    container.innerHTML =
      pageHead("Manage Content", "Add content by pasting links — no file uploads. Everything is saved to content.json on the server.") +
      notebookForm() +
      problemForm() +
      resourceForm() +
      weeklyForm() +
      `<h3 style="margin-top:40px">Current content</h3><div id="manageMount"><div class="spinner">Loading…</div></div>`;

    wireForms(container, refreshManage);
    refreshManage();
  };

  async function refreshManage() {
    const mount = container.querySelector("#manageMount");
    if (!mount) return;
    let data;
    try {
      data = await apiGet("/api/content");
    } catch (err) {
      mount.innerHTML = `<div class="notice error">${escapeHtml(err.message)}</div>`;
      return;
    }
    mount.innerHTML =
      manageGroup("Notebooks", "notebooks", data.notebooks, (n) => `${escapeHtml(n.title)} <span class="muted text-small">· ${escapeHtml(n.category || "")}</span>`, (n) => Boolean(n.path) && !n.colab && !n.kaggle && !n.url) +
      manageGroup("Problems", "problems", data.problems, (p) => escapeHtml(p.title), () => false) +
      manageGroup("Resources", "resources", data.resources, (r) => `${escapeHtml(r.title)} <span class="muted text-small">· ${escapeHtml(r.category || "")}</span>`, () => false);

    mount.querySelectorAll("[data-del]").forEach((btn) => {
      btn.onclick = async () => {
        btn.disabled = true;
        try {
          await apiPostJson("/api/admin/delete", { kind: btn.getAttribute("data-kind"), id: btn.getAttribute("data-del") });
          refreshManage();
        } catch (err) {
          btn.disabled = false;
          alert("Delete failed: " + err.message);
        }
      };
    });

    mount.querySelectorAll(".sortable").forEach((listEl) => {
      makeSortable(listEl, async (ids) => {
        try {
          await apiPostJson("/api/admin/reorder", { kind: listEl.getAttribute("data-kind"), ids });
        } catch (err) {
          alert("Reorder failed: " + err.message);
          refreshManage();
        }
      });
    });
  }

  return onAuth(() => draw());
}

// `diskOnly(entry)` -> true means it lives on disk and can't be removed from here
function manageGroup(title, kind, items, labelFn, diskOnly) {
  if (!items?.length) return `<div class="card"><h4>${title}</h4><div class="muted text-small">None yet.</div></div>`;
  const rows = items
    .map((e) => {
      const right = diskOnly(e)
        ? `<span class="badge">on disk</span>`
        : `<button class="btn btn-secondary btn-sm" data-del="${escapeHtml(e.id)}" data-kind="${kind}">Delete</button>`;
      return `<div class="sort-row" data-sort-item data-id="${escapeHtml(e.id)}" draggable="true">
          <span class="drag-handle" title="Drag to reorder">⠿</span>
          <div style="flex:1">${labelFn(e)}</div>
          ${right}
        </div>`;
    })
    .join("");
  return `<div class="card"><h4>${title}</h4><div class="sortable" data-kind="${kind}">${rows}</div>
      <div class="muted text-small" style="margin-top:8px">Drag the ⠿ handle to reorder — the order is saved and shown on the public pages.</div></div>`;
}

// HTML5 drag-and-drop reordering. Calls onReorder(idsInNewOrder) after a drop.
function makeSortable(listEl, onReorder) {
  let dragEl = null;
  listEl.querySelectorAll("[data-sort-item]").forEach((item) => {
    item.addEventListener("dragstart", () => {
      dragEl = item;
      setTimeout(() => item.classList.add("dragging"), 0);
    });
    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      dragEl = null;
      onReorder([...listEl.querySelectorAll("[data-sort-item]")].map((el) => el.getAttribute("data-id")));
    });
  });
  listEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (!dragEl) return;
    const after = dragAfter(listEl, e.clientY);
    if (after == null) listEl.appendChild(dragEl);
    else listEl.insertBefore(dragEl, after);
  });
}

function dragAfter(listEl, y) {
  const els = [...listEl.querySelectorAll("[data-sort-item]:not(.dragging)")];
  let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
  for (const child of els) {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) closest = { offset, element: child };
  }
  return closest.element;
}

// ---- forms ---------------------------------------------------------------
function notebookForm() {
  return `<div class="card"><h4>Add a notebook (link)</h4>
    ${field("Title", `<input type="text" id="nbTitle" placeholder="Intro to CNNs">`)}
    <div class="row">
      ${field("Category", `<input type="text" id="nbCat" placeholder="Deep Learning">`)}
      ${field("Subcategory (optional)", `<input type="text" id="nbSub" placeholder="Vision">`)}
    </div>
    ${field("Tags (comma separated)", `<input type="text" id="nbTags" placeholder="cnn, vision">`)}
    ${field("Colab link", `<input type="url" id="nbColab" placeholder="https://colab.research.google.com/...">`)}
    ${field("Kaggle link", `<input type="url" id="nbKaggle" placeholder="https://www.kaggle.com/code/...">`)}
    ${field("Other link (optional)", `<input type="url" id="nbUrl" placeholder="https://github.com/.../notebook.ipynb">`, "Provide at least one link.")}
    <button class="btn" id="nbSubmit">Add notebook</button>${result("nbResult")}
  </div>`;
}

function problemForm() {
  return `<div class="card"><h4>Add / update a problem (links)</h4>
    ${field("Title", `<input type="text" id="prTitle" placeholder="Titanic">`)}
    ${field("Slug / id (optional)", `<input type="text" id="prId" placeholder="auto from title">`)}
    <div class="row">
      ${field("Difficulty", `<input type="text" id="prDiff" placeholder="Easy">`)}
      ${field("Tags (comma separated)", `<input type="text" id="prTags" placeholder="classification">`)}
    </div>
    ${field("Description", `<textarea id="prDesc" placeholder="Short description (markdown ok)"></textarea>`)}
    ${field("Competition link (Open in Kaggle)", `<input type="url" id="prKaggle" placeholder="https://www.kaggle.com/competitions/titanic">`)}
    <div class="row">
      ${field("Baseline link", `<input type="url" id="prBaseline" placeholder="Colab / Kaggle notebook URL">`)}
      ${field("Solution link", `<input type="url" id="prSolution" placeholder="Colab / Kaggle notebook URL">`)}
    </div>
    ${field("Colab link (optional)", `<input type="url" id="prColab" placeholder="https://colab.research.google.com/...">`)}
    ${field("Datasets", `<textarea id="prData" placeholder="Train + test | https://www.kaggle.com/competitions/titanic/data&#10;Extra features | https://drive.google.com/..."></textarea>`, "One per line. Format: <code>Label | https://url</code> (label optional).")}
    <button class="btn" id="prSubmit">Save problem</button>${result("prResult")}
  </div>`;
}

function resourceForm() {
  return `<div class="card"><h4>Add a resource</h4>
    ${field("Title", `<input type="text" id="rsTitle" placeholder="Dive into Deep Learning">`)}
    ${field("URL", `<input type="url" id="rsUrl" placeholder="https://...">`)}
    ${field("Category", `<input type="text" id="rsCat" value="General">`)}
    ${field("Description (optional)", `<input type="text" id="rsDesc">`)}
    <button class="btn" id="rsSubmit">Add resource</button>${result("rsResult")}
  </div>`;
}

function weeklyForm() {
  const opts = METRICS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
  return `<div class="card"><h4>Create / update a weekly competition</h4>
    <p class="muted text-small">The answer key is uploaded and stays on the server — it's never served to clients.</p>
    ${field("Title", `<input type="text" id="wkTitle" placeholder="Week 26 — Tabular Playground">`)}
    ${field("Id / slug (optional)", `<input type="text" id="wkId" placeholder="auto from title, e.g. 2026-w26">`)}
    <div class="row">
      ${field("Metric", `<select id="wkMetric">${opts}</select>`)}
      ${field("Deadline (optional)", `<input type="datetime-local" id="wkDeadline">`)}
    </div>
    <div class="row">
      ${field("Id column", `<input type="text" id="wkIdCol" placeholder="id">`)}
      ${field("Target column", `<input type="text" id="wkTargetCol" placeholder="label">`)}
    </div>
    ${field("Description", `<textarea id="wkDesc"></textarea>`)}
    <div class="row">
      ${field("Answer key (.csv, required)", `<input type="file" id="wkKey" accept=".csv">`)}
      ${field("Starter / sample (.csv, optional)", `<input type="file" id="wkStarter" accept=".csv">`)}
    </div>
    <button class="btn" id="wkSubmit">Publish competition</button>${result("wkResult")}
  </div>`;
}

// ---- wiring --------------------------------------------------------------
const val = (c, id) => c.querySelector("#" + id).value.trim();
const file = (c, id) => c.querySelector("#" + id).files[0] || null;

async function run(btn, out, fn, after) {
  btn.disabled = true;
  out.textContent = "Working…";
  try {
    await fn();
    out.innerHTML = `<span style="color:#5b7a4f">✓ Done</span>`;
    if (after) after();
  } catch (err) {
    out.innerHTML = `<span style="color:var(--color-error)">${escapeHtml(err.message)}</span>`;
  } finally {
    btn.disabled = false;
  }
}

function wireForms(c, after) {
  c.querySelector("#nbSubmit").onclick = () =>
    run(c.querySelector("#nbSubmit"), c.querySelector("#nbResult"), async () => {
      await apiPostJson("/api/admin/notebook", {
        title: val(c, "nbTitle"),
        category: val(c, "nbCat") || "General",
        subcategory: val(c, "nbSub"),
        tags: val(c, "nbTags"),
        colab: val(c, "nbColab"),
        kaggle: val(c, "nbKaggle"),
        url: val(c, "nbUrl"),
      });
    }, after);

  c.querySelector("#prSubmit").onclick = () =>
    run(c.querySelector("#prSubmit"), c.querySelector("#prResult"), async () => {
      await apiPostJson("/api/admin/problem", {
        title: val(c, "prTitle"),
        id: val(c, "prId"),
        difficulty: val(c, "prDiff"),
        tags: val(c, "prTags"),
        description: val(c, "prDesc"),
        kaggle: val(c, "prKaggle"),
        baseline: val(c, "prBaseline"),
        solution: val(c, "prSolution"),
        colab: val(c, "prColab"),
        datasets: val(c, "prData"),
      });
    }, after);

  c.querySelector("#rsSubmit").onclick = () =>
    run(c.querySelector("#rsSubmit"), c.querySelector("#rsResult"), async () => {
      await apiPostJson("/api/admin/resource", {
        title: val(c, "rsTitle"),
        url: val(c, "rsUrl"),
        category: val(c, "rsCat") || "General",
        description: val(c, "rsDesc"),
      });
    }, after);

  c.querySelector("#wkSubmit").onclick = () =>
    run(c.querySelector("#wkSubmit"), c.querySelector("#wkResult"), async () => {
      const key = file(c, "wkKey");
      if (!key) throw new Error("Answer key CSV is required.");
      const fd = new FormData();
      for (const [k, id] of [["title", "wkTitle"], ["id", "wkId"], ["metric", "wkMetric"], ["idCol", "wkIdCol"], ["targetCol", "wkTargetCol"], ["description", "wkDesc"]]) fd.append(k, val(c, id));
      const dl = val(c, "wkDeadline");
      if (dl) fd.append("deadline", new Date(dl).toISOString());
      fd.append("answer_key", key);
      if (file(c, "wkStarter")) fd.append("starter", file(c, "wkStarter"));
      await apiPostForm("/api/admin/weekly", fd);
    });
}
