// Weekly competition: browse competitions, grab the starter file, and upload a
// predictions CSV to be scored against the hidden answer key.

import { onAuth, getUser } from "../auth.js";
import { apiGet, apiPostForm } from "../lib/api.js";
import { recordActivity } from "../lib/activity.js";
import { pageHead, signInPrompt, wireSignIn, fmtDate } from "../lib/ui.js";
import { escapeHtml } from "../lib/markdown.js";

export function render(container) {
  const draw = async () => {
    let comps;
    try {
      ({ competitions: comps } = await apiGet("/api/weekly"));
    } catch (err) {
      container.innerHTML = pageHead("Weekly Competition") + `<div class="notice error">${escapeHtml(err.message)}</div>`;
      return;
    }

    const head = pageHead("Weekly Competition", "Upload predictions, get scored instantly, and climb the leaderboard.");
    if (!comps.length) {
      container.innerHTML = head + `<div class="empty">No competition is running yet. Check back soon.</div>`;
      return;
    }

    container.innerHTML = head + comps.map(compCard).join("");
    comps.forEach((c) => wireCard(container, c));
  };

  return onAuth(() => draw());
}

function compCard(c) {
  const badge = c.open ? `<span class="badge open">Open</span>` : `<span class="badge">Closed</span>`;
  const meta = [`Metric: ${escapeHtml(c.metricLabel)}`, c.deadline ? `Closes ${fmtDate(c.deadline, { month: "short", day: "numeric", year: "numeric" })}` : "No deadline"].join(" · ");
  const starter = c.hasStarter
    ? `<a class="btn btn-secondary btn-sm" href="/api/weekly/${encodeURIComponent(c.id)}/starter">Download starter CSV</a>`
    : "";

  return `<div class="card" id="comp-${escapeHtml(c.id)}">
      <div class="row between">
        <h4 style="margin:0">${escapeHtml(c.title)}</h4>
        ${badge}
      </div>
      <div class="muted text-small" style="margin:4px 0 8px">${meta}</div>
      ${c.description ? `<p class="text-small">${escapeHtml(c.description)}</p>` : ""}
      <div class="muted text-small">Submission format: CSV with columns <code>${escapeHtml(c.idCol)}</code> and <code>${escapeHtml(c.targetCol)}</code>.</div>
      <div class="btn-row" style="margin:12px 0">
        ${starter}
        <a class="btn btn-ghost btn-sm" href="#/leaderboard/${encodeURIComponent(c.id)}">View leaderboard →</a>
      </div>
      <div class="divider" style="margin:12px 0"></div>
      <div data-submit-zone>${c.open ? "" : `<div class="muted text-small">This competition is closed for submissions.</div>`}</div>
    </div>`;
}

function wireCard(container, c) {
  const zone = container.querySelector(`#comp-${cssEscape(c.id)} [data-submit-zone]`);
  if (!zone || !c.open) return;

  const user = getUser();
  if (!user) {
    zone.innerHTML = signInPrompt("submit to this competition");
    wireSignIn(zone);
    return;
  }

  zone.innerHTML = `
    <div class="field-label">Submit predictions</div>
    <div class="btn-row">
      <input type="file" accept=".csv,text/csv" id="file-${escapeHtml(c.id)}">
      <button class="btn btn-sm" id="submit-${escapeHtml(c.id)}">Score submission</button>
    </div>
    <div id="result-${escapeHtml(c.id)}" class="text-small" style="margin-top:8px"></div>`;

  const btn = zone.querySelector(`#submit-${cssEscape(c.id)}`);
  const fileInput = zone.querySelector(`#file-${cssEscape(c.id)}`);
  const result = zone.querySelector(`#result-${cssEscape(c.id)}`);

  btn.onclick = async () => {
    if (!fileInput.files?.length) {
      result.innerHTML = `<span style="color:var(--color-error)">Choose a CSV file first.</span>`;
      return;
    }
    btn.disabled = true;
    result.textContent = "Scoring…";
    try {
      const fd = new FormData();
      fd.append("submission", fileInput.files[0]);
      const r = await apiPostForm(`/api/weekly/${encodeURIComponent(c.id)}/submit`, fd);
      recordActivity("submission");
      result.innerHTML = `<span style="color:#5b7a4f">✓ ${escapeHtml(r.metricLabel)} = <strong>${r.score.toLocaleString(undefined, { maximumFractionDigits: 6 })}</strong></span> over ${r.n} rows. <a href="#/leaderboard/${encodeURIComponent(c.id)}">See where you rank →</a>`;
    } catch (err) {
      result.innerHTML = `<span style="color:var(--color-error)">${escapeHtml(err.message)}</span>`;
    } finally {
      btn.disabled = false;
    }
  };
}

// competition ids are slugs (already [a-z0-9-]), but be safe for querySelector
function cssEscape(s) {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
