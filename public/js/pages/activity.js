// Activity: a GitHub-style contribution heatmap of the signed-in user's daily
// study activity (notebook opens, submissions, logins) for the last ~53 weeks.

import { onAuth, getUser } from "../auth.js";
import { loadActivity } from "../lib/activity.js";
import { pageHead, signInPrompt, wireSignIn } from "../lib/ui.js";

const MS = 86400000;
const keyOf = (d) => d.toISOString().slice(0, 10);

function level(c) {
  if (!c) return 0;
  if (c >= 10) return 4;
  if (c >= 6) return 3;
  if (c >= 3) return 2;
  return 1;
}

export function render(container) {
  const draw = async () => {
    const user = getUser();
    if (!user) {
      container.innerHTML = pageHead("Activity") + signInPrompt("track your daily study streak");
      wireSignIn(container);
      return;
    }
    container.innerHTML = pageHead("Activity") + `<div class="spinner">Loading your activity…</div>`;
    const counts = await loadActivity(user.uid);

    // anchor on today's UTC date, walk back to the Sunday 52 weeks ago
    const today = new Date(keyOf(new Date()) + "T00:00:00Z");
    const thisSunday = new Date(today.getTime() - today.getUTCDay() * MS);
    const firstSunday = new Date(thisSunday.getTime() - 52 * 7 * MS);

    const cells = [];
    let totalActions = 0;
    let activeDays = 0;
    for (let i = 0; i < 53 * 7; i++) {
      const d = new Date(firstSunday.getTime() + i * MS);
      if (d.getTime() > today.getTime()) {
        cells.push(`<span class="heat-cell" style="visibility:hidden"></span>`);
        continue;
      }
      const k = keyOf(d);
      const c = counts[k] || 0;
      if (c > 0) {
        totalActions += c;
        activeDays++;
      }
      const lv = level(c);
      cells.push(`<span class="heat-cell ${lv ? "heat-" + lv : ""}" title="${k}: ${c} action${c === 1 ? "" : "s"}"></span>`);
    }

    // current streak: consecutive days up to today with activity
    let streak = 0;
    for (let d = new Date(today.getTime()); ; d = new Date(d.getTime() - MS)) {
      if ((counts[keyOf(d)] || 0) > 0) streak++;
      else break;
    }

    container.innerHTML =
      pageHead("Activity", "Every notebook you open and every submission you make, tracked like a GitHub streak.") +
      `<div class="card">
        <div class="row" style="gap:32px;margin-bottom:16px">
          ${stat(activeDays, "active days")}
          ${stat(streak, "day streak")}
          ${stat(totalActions, "total actions")}
        </div>
        <div class="heatmap">${cells.join("")}</div>
        <div class="heat-legend">Less
          <span class="heat-cell"></span>
          <span class="heat-cell heat-1"></span>
          <span class="heat-cell heat-2"></span>
          <span class="heat-cell heat-3"></span>
          <span class="heat-cell heat-4"></span>
        More</div>
      </div>`;
  };

  return onAuth(() => draw());
}

function stat(value, label) {
  return `<div><div style="font-family:var(--font-display);font-size:32px;line-height:1">${value}</div><div class="muted text-small">${label}</div></div>`;
}
