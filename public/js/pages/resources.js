// Resources: a curated, admin-editable shelf of links grouped by category.

import { apiGet } from "../lib/api.js";
import { pageHead } from "../lib/ui.js";
import { escapeHtml } from "../lib/markdown.js";

export async function render(container) {
  const { resources } = await apiGet("/api/content");
  if (!resources.length) {
    container.innerHTML =
      pageHead("Resources", "References worth your time.") +
      `<div class="empty">No resources yet. An admin can add them from the Manage Content page.</div>`;
    return;
  }

  const byCat = new Map();
  for (const r of resources) {
    const cat = r.category || "General";
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(r);
  }

  const sections = [...byCat.entries()]
    .map(
      ([cat, items]) => `
      <section style="margin-bottom:32px">
        <h3>${escapeHtml(cat)}</h3>
        <div class="panel">
          ${items
            .map(
              (r) => `<div style="padding:10px 0;border-bottom:1px solid var(--color-border)">
                <a href="${escapeHtml(r.url)}" target="_blank" rel="noopener"><strong>${escapeHtml(r.title)}</strong> ↗</a>
                ${r.description ? `<div class="muted text-small">${escapeHtml(r.description)}</div>` : ""}
              </div>`
            )
            .join("")}
        </div>
      </section>`
    )
    .join("");

  container.innerHTML = pageHead("Resources", "A curated shelf for IOAI preparation.") + sections;
}
