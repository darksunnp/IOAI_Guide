// Kaggle dashboard: your top-5 submissions per tracked competition. Data comes
// from the server-side proxy (/api/kaggle/dashboard), which reads your saved key.

import { onAuth, getUser } from "../auth.js";
import { apiGet } from "../lib/api.js";
import { pageHead, signInPrompt, wireSignIn, fmtDate, fmtScore } from "../lib/ui.js";
import { escapeHtml } from "../lib/markdown.js";

export function render(container) {
  const draw = async () => {
    const user = getUser();
    if (!user) {
      container.innerHTML = pageHead("Kaggle Dashboard") + signInPrompt("see your Kaggle submissions");
      wireSignIn(container);
      return;
    }
    container.innerHTML = pageHead("Kaggle Dashboard", "Your top-5 submissions across the competitions you track.") + `<div class="spinner">Talking to Kaggle…</div>`;

    let data;
    try {
      data = await apiGet("/api/kaggle/dashboard", { auth: true });
    } catch (err) {
      const goSettings = `<a href="#/settings">Settings</a>`;
      const msg =
        err.data?.error === "no_credentials"
          ? `Add your Kaggle username and key in ${goSettings} first.`
          : escapeHtml(err.message);
      container.innerHTML = pageHead("Kaggle Dashboard") + `<div class="notice error">${msg}</div>`;
      return;
    }

    const head =
      pageHead("Kaggle Dashboard", `Signed in to Kaggle as <strong>${escapeHtml(data.username || "")}</strong>. Showing highest public scores first.`) +
      `<div class="btn-row" style="margin-bottom:16px"><button class="btn btn-secondary btn-sm" id="refreshBtn">Refresh</button></div>`;

    if (!data.competitions?.length) {
      container.innerHTML = head + `<div class="empty">No competitions tracked yet. Add slugs in <a href="#/settings">Settings</a>.</div>`;
      container.querySelector("#refreshBtn").onclick = draw;
      return;
    }

    container.innerHTML = head + data.competitions.map(compCard).join("");
    container.querySelector("#refreshBtn").onclick = draw;
  };

  return onAuth(() => draw());
}

function compCard(c) {
  const url = `https://www.kaggle.com/competitions/${encodeURIComponent(c.slug)}`;
  const meta = [c.metric ? `Metric: ${escapeHtml(c.metric)}` : "", c.deadline ? `Deadline: ${fmtDate(c.deadline)}` : ""]
    .filter(Boolean)
    .join(" · ");

  let body;
  if (c.error) {
    body = `<div class="notice error" style="margin:8px 0 0">${escapeHtml(c.error)}</div>`;
  } else if (!c.topSubmissions?.length) {
    body = `<div class="muted text-small" style="margin-top:8px">No scored submissions yet.</div>`;
  } else {
    const rows = c.topSubmissions
      .map(
        (s, i) => `<tr>
          <td>${i + 1}</td>
          <td><strong>${fmtScore(s.publicScore)}</strong></td>
          <td>${s.privateScore != null ? fmtScore(s.privateScore) : "—"}</td>
          <td class="muted">${fmtDate(s.date, { month: "short", day: "numeric", year: "numeric" })}</td>
          <td class="muted text-small">${escapeHtml(s.description || "")}</td>
        </tr>`
      )
      .join("");
    body = `<table style="margin-top:12px">
        <thead><tr><th>#</th><th>Public</th><th>Private</th><th>Date</th><th>Submission</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="muted text-small" style="margin-top:8px">${c.totalSubmissions || 0} total submission(s).</div>`;
  }

  return `<div class="card">
      <div class="row between">
        <h4 style="margin:0"><a href="${url}" target="_blank" rel="noopener">${escapeHtml(c.title || c.slug)} ↗</a></h4>
        <span class="muted text-small">${meta}</span>
      </div>
      ${body}
    </div>`;
}
