// Notebooks: a grouped index of notebooks. Entries can be link-based (open on
// Colab / Kaggle) and/or disk-based (rendered in-browser from AI_gold + download).

import { apiGet } from "../lib/api.js";
import { renderNotebook } from "../lib/ipynb.js";
import { recordActivity } from "../lib/activity.js";
import { pageHead } from "../lib/ui.js";
import { escapeHtml } from "../lib/markdown.js";

export async function render(container, params) {
  if (params[0]) return renderViewer(container, params[0]);
  return renderIndex(container);
}

// buttons for a single notebook entry (link-based and/or disk-based)
function actions(nb) {
  const b = [];
  if (nb.path) {
    b.push(`<a class="btn btn-ghost btn-sm" href="#/notebooks/${encodeURIComponent(nb.path)}">Open viewer</a>`);
    b.push(`<a class="btn btn-secondary btn-sm" href="/api/download?path=${encodeURIComponent(nb.path)}">Download</a>`);
  }
  if (nb.colab) b.push(`<a class="btn btn-sm" href="${escapeHtml(nb.colab)}" target="_blank" rel="noopener">Open in Colab ↗</a>`);
  if (nb.kaggle) b.push(`<a class="btn btn-sm" href="${escapeHtml(nb.kaggle)}" target="_blank" rel="noopener">Open in Kaggle ↗</a>`);
  if (nb.url) b.push(`<a class="btn btn-secondary btn-sm" href="${escapeHtml(nb.url)}" target="_blank" rel="noopener">Open ↗</a>`);
  return b.join("");
}

function titleLink(nb) {
  if (nb.path) return `<a href="#/notebooks/${encodeURIComponent(nb.path)}">${escapeHtml(nb.title)}</a>`;
  const ext = nb.colab || nb.kaggle || nb.url;
  return ext ? `<a href="${escapeHtml(ext)}" target="_blank" rel="noopener">${escapeHtml(nb.title)} ↗</a>` : escapeHtml(nb.title);
}

async function renderIndex(container) {
  const { notebooks, aiGoldFound } = await apiGet("/api/content");
  if (!notebooks.length) {
    container.innerHTML =
      pageHead("Notebooks", "Work through the syllabus.") +
      `<div class="empty">${aiGoldFound ? "No notebooks yet." : "No notebooks yet — add some from the Manage Content page (paste a Colab or Kaggle link)."}</div>`;
    return;
  }

  const byCat = new Map();
  for (const nb of notebooks) {
    const cat = nb.category || "General";
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(nb);
  }

  const sections = [...byCat.entries()]
    .map(([cat, items]) => {
      const rows = items
        .map((nb) => {
          const tags = (nb.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("");
          const sub = nb.subcategory ? `<span class="muted text-small"> · ${escapeHtml(nb.subcategory)}</span>` : "";
          return `<div class="row between" style="padding:10px 0;border-bottom:1px solid var(--color-border)">
              <div>
                <strong>${titleLink(nb)}</strong>${sub}
                <div>${tags}</div>
              </div>
              <div class="btn-row">${actions(nb)}</div>
            </div>`;
        })
        .join("");
      return `<section style="margin-bottom:32px"><h3>${escapeHtml(cat)}</h3><div class="panel">${rows}</div></section>`;
    })
    .join("");

  container.innerHTML = pageHead("Notebooks", "Open them on Colab or Kaggle, or read them right here when they're on the server.") + sections;
}

async function renderViewer(container, path) {
  container.innerHTML =
    `<div class="row between page-head">
       <a class="btn btn-ghost btn-sm" href="#/notebooks" style="padding-left:0">← All notebooks</a>
       <div class="btn-row">
         <a class="btn btn-secondary btn-sm" href="/api/download?path=${encodeURIComponent(path)}">Download .ipynb</a>
       </div>
     </div>
     <h2 style="word-break:break-word">${escapeHtml(prettyName(path))}</h2>
     <div class="kbd" style="margin-bottom:16px">${escapeHtml(path)}</div>
     <div id="nbMount"><div class="spinner">Rendering notebook…</div></div>`;

  try {
    const nb = await apiGet(`/api/notebook?path=${encodeURIComponent(path)}`);
    const mount = container.querySelector("#nbMount");
    mount.innerHTML = "";
    mount.appendChild(renderNotebook(nb));
    recordActivity("notebook", "nb:" + path);
  } catch (err) {
    container.querySelector("#nbMount").innerHTML = `<div class="notice error">Couldn't load notebook: ${escapeHtml(err.message)}</div>`;
  }
}

function prettyName(path) {
  return path.split("/").pop().replace(/\.ipynb$/i, "").replace(/[_-]+/g, " ");
}
