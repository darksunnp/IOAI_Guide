// Leaderboard: realtime rankings for a weekly competition, read straight from
// Firestore (leaderboards/{id}/entries) so scores update live as people submit.

import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db, firebaseConfigured } from "../firebase.js";
import { apiGet } from "../lib/api.js";
import { pageHead, fmtScore, fmtDate } from "../lib/ui.js";
import { escapeHtml } from "../lib/markdown.js";

export function render(container, params) {
  let unsub = null;

  const start = async () => {
    if (!firebaseConfigured) {
      container.innerHTML = pageHead("Leaderboard") + `<div class="notice">Leaderboards need Firebase configured (see <code>public/js/firebase.js</code>).</div>`;
      return;
    }
    let comps;
    try {
      ({ competitions: comps } = await apiGet("/api/weekly"));
    } catch (err) {
      container.innerHTML = pageHead("Leaderboard") + `<div class="notice error">${escapeHtml(err.message)}</div>`;
      return;
    }
    if (!comps.length) {
      container.innerHTML = pageHead("Leaderboard") + `<div class="empty">No competitions yet.</div>`;
      return;
    }

    const selected = comps.find((c) => c.id === params[0]) ? params[0] : comps[0].id;
    const options = comps
      .map((c) => `<option value="${escapeHtml(c.id)}" ${c.id === selected ? "selected" : ""}>${escapeHtml(c.title)}</option>`)
      .join("");

    container.innerHTML =
      pageHead("Leaderboard", "Best score per person. Updates live as submissions come in.") +
      `<div class="row" style="margin-bottom:16px">
        <label class="field" style="margin:0;min-width:280px">
          <span class="field-label">Competition</span>
          <select id="compSelect">${options}</select>
        </label>
      </div>
      <div id="lbMount"><div class="spinner">Loading rankings…</div></div>`;

    container.querySelector("#compSelect").onchange = (e) => {
      location.hash = `#/leaderboard/${encodeURIComponent(e.target.value)}`;
    };

    subscribe(selected, comps.find((c) => c.id === selected));
  };

  function subscribe(id, comp) {
    if (unsub) unsub();
    const mount = container.querySelector("#lbMount");
    const ref = collection(db, "leaderboards", id, "entries");
    unsub = onSnapshot(
      ref,
      (snap) => {
        const rows = [];
        snap.forEach((d) => rows.push(d.data()));
        rows.sort((a, b) => (comp.higherIsBetter ? b.bestScore - a.bestScore : a.bestScore - b.bestScore));
        mount.innerHTML = rows.length ? table(rows) : `<div class="empty">No submissions yet — be the first!</div>`;
      },
      (err) => {
        mount.innerHTML = `<div class="notice error">Couldn't read leaderboard: ${escapeHtml(err.message)}</div>`;
      }
    );
  }

  function table(rows) {
    const body = rows
      .map(
        (r, i) => `<tr>
          <td>${medal(i)}</td>
          <td>${escapeHtml(r.displayName || "Anonymous")}</td>
          <td><strong>${fmtScore(r.bestScore)}</strong></td>
          <td class="muted">${r.attempts || 1}</td>
          <td class="muted text-small">${r.updatedAt ? fmtDate(r.updatedAt, { month: "short", day: "numeric" }) : "—"}</td>
        </tr>`
      )
      .join("");
    return `<table>
        <thead><tr><th>Rank</th><th>Name</th><th>Best score</th><th>Tries</th><th>Updated</th></tr></thead>
        <tbody>${body}</tbody>
      </table>`;
  }

  const medal = (i) => (i === 0 ? "🥇 1" : i === 1 ? "🥈 2" : i === 2 ? "🥉 3" : i + 1);

  start();
  return () => {
    if (unsub) unsub();
  };
}
