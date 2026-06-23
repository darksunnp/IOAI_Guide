// Problems: one card per problem. Baseline / Solution / Dataset and the Kaggle
// link can be external URLs (Colab/Kaggle/Drive) or, for content that lives on
// the server, disk paths served via /api/download. Both are handled.

import { apiGet } from "../lib/api.js";
import { recordActivity } from "../lib/activity.js";
import { pageHead } from "../lib/ui.js";
import { renderMarkdown, escapeHtml } from "../lib/markdown.js";

const isUrl = (s) => /^https?:\/\//i.test(s || "");
const base = (p) => (p ? p.split("/").pop() : "");
const isNotebook = (p) => /\.ipynb$/i.test(p || "");

// Resolve a baseline/solution/dataset value (URL or disk path) to a link.
function resolve(val) {
  if (isUrl(val)) return { href: val, external: true };
  return { href: `/api/download?path=${encodeURIComponent(val)}`, external: false };
}

function linkBtn(val, label, probId, cls = "btn-secondary") {
  const { href, external } = resolve(val);
  const ext = external ? ' target="_blank" rel="noopener"' : "";
  const arrow = external ? " ↗" : "";
  const grab = probId ? ` data-grab="${escapeHtml(probId)}"` : "";
  return `<a class="btn ${cls} btn-sm"${grab} href="${escapeHtml(href)}"${ext}>${escapeHtml(label)}${arrow}</a>`;
}

export async function render(container) {
  const { problems, aiGoldFound } = await apiGet("/api/content");
  if (!problems.length) {
    container.innerHTML =
      pageHead("Problems", "Competition-style practice.") +
      `<div class="empty">No problems yet — add one from the Manage Content page with its Kaggle / Colab links.</div>`;
    return;
  }

  container.innerHTML = pageHead("Problems", "Practice problems with a baseline, a worked solution, datasets, and a jump to Kaggle.") + problems.map(problemCard).join("");

  container.querySelectorAll("[data-grab]").forEach((a) => {
    a.addEventListener("click", () => recordActivity("problem", "prob:" + a.getAttribute("data-grab")));
  });
}

function problemCard(p) {
  const diff = p.difficulty ? `<span class="badge">${escapeHtml(p.difficulty)}</span>` : "";
  const tags = (p.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("");
  const desc = p.description ? `<div class="muted text-small" style="margin:8px 0">${renderMarkdown(p.description)}</div>` : "";

  const buttons = [];
  if (p.baseline) {
    buttons.push(linkBtn(p.baseline, "Baseline", p.id));
    if (!isUrl(p.baseline) && isNotebook(p.baseline)) buttons.push(`<a class="btn btn-ghost btn-sm" href="#/notebooks/${encodeURIComponent(p.baseline)}">View baseline</a>`);
  }
  if (p.solution) {
    buttons.push(linkBtn(p.solution, "Solution", p.id));
    if (!isUrl(p.solution) && isNotebook(p.solution)) buttons.push(`<a class="btn btn-ghost btn-sm" href="#/notebooks/${encodeURIComponent(p.solution)}">View solution</a>`);
  }
  if (p.colab) buttons.push(`<a class="btn btn-sm" href="${escapeHtml(p.colab)}" target="_blank" rel="noopener">Open in Colab ↗</a>`);
  for (const d of p.datasets || []) {
    if (typeof d === "string") buttons.push(linkBtn(d, `Dataset: ${base(d)}`, p.id));
    else if (d && d.url) buttons.push(linkBtn(d.url, d.label || "Dataset", p.id));
  }
  if (p.kaggle) buttons.push(`<a class="btn btn-sm" href="${escapeHtml(p.kaggle)}" target="_blank" rel="noopener">Open in Kaggle ↗</a>`);

  return `<div class="card">
      <div class="row between">
        <h4 style="margin:0">${escapeHtml(p.title)}</h4>
        ${diff}
      </div>
      <div style="margin-top:6px">${tags}</div>
      ${desc}
      <div class="btn-row" style="margin-top:12px">${buttons.join("")}</div>
    </div>`;
}
