// SPA bootstrap: hash router, left sidebar nav, auth slot. No build step.

import { firebaseConfigured } from "./firebase.js";
import { initAuth, onAuth, signIn, signOutUser, getUser, getIsAdmin } from "./auth.js";
import { recordActivity } from "./lib/activity.js";

import * as home from "./pages/home.js";
import * as notebooks from "./pages/notebooks.js";
import * as problems from "./pages/problems.js";
import * as resources from "./pages/resources.js";
import * as dashboard from "./pages/dashboard.js";
import * as activity from "./pages/activity.js";
import * as weekly from "./pages/weekly.js";
import * as leaderboard from "./pages/leaderboard.js";
import * as settings from "./pages/settings.js";
import * as admin from "./pages/admin.js";

const routes = {
  "": { title: "Home", mod: home },
  notebooks: { title: "Notebooks", mod: notebooks },
  problems: { title: "Problems", mod: problems },
  resources: { title: "Resources", mod: resources },
  dashboard: { title: "Kaggle Dashboard", mod: dashboard },
  activity: { title: "Activity", mod: activity },
  weekly: { title: "Weekly Competition", mod: weekly },
  leaderboard: { title: "Leaderboard", mod: leaderboard },
  settings: { title: "Settings", mod: settings },
  admin: { title: "Admin", mod: admin },
};

const NAV = [
  { group: "Learn", items: [["notebooks", "Notebooks"], ["resources", "Resources"]] },
  { group: "Compete", items: [["problems", "Problems"], ["weekly", "Weekly Competition"], ["leaderboard", "Leaderboard"]] },
  { group: "You", items: [["dashboard", "Kaggle Dashboard"], ["activity", "Activity"], ["settings", "Settings"]] },
];

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [pathPart] = raw.split("?");
  const segs = pathPart.split("/").map((s) => decodeURIComponent(s)).filter((s) => s !== "");
  return { route: segs[0] || "", params: segs.slice(1) };
}

function renderSidebar(activeRoute) {
  const groups = NAV.map((g) => g);
  if (getIsAdmin()) groups.push({ group: "Admin", items: [["admin", "Manage Content"]] });

  const html = [
    `<a class="brand" href="#/">IOAI <span class="tld">Guide</span></a>`,
    ...groups.map(
      (g) => `
      <div class="nav-group">
        <div class="nav-group-label">${g.group}</div>
        ${g.items
          .map(
            ([route, label]) =>
              `<a class="nav-link ${route === activeRoute ? "active" : ""}" href="#/${route}">${label}</a>`
          )
          .join("")}
      </div>`
    ),
  ].join("");
  document.getElementById("sidebar").innerHTML = html;
}

function renderAuthSlot() {
  const slot = document.getElementById("authSlot");
  if (!firebaseConfigured) {
    slot.innerHTML = `<span class="muted text-small">Login disabled — configure Firebase</span>`;
    return;
  }
  const user = getUser();
  if (user) {
    const photo = user.photoURL ? `<img src="${user.photoURL}" alt="" referrerpolicy="no-referrer">` : "";
    slot.innerHTML = `<span class="user-chip">${photo}<span>${user.displayName || user.email}</span></span>
      <button class="btn btn-secondary btn-sm" id="signOutBtn">Sign out</button>`;
    document.getElementById("signOutBtn").onclick = () => signOutUser();
  } else {
    slot.innerHTML = `<button class="btn btn-sm" id="signInBtn">Sign in with Google</button>`;
    document.getElementById("signInBtn").onclick = () => signIn();
  }
}

let cleanup = null;
async function renderRoute() {
  const { route, params } = parseHash();
  const def = routes[route] || routes[""];
  document.title = `${def.title} · IOAI Guide`;
  renderSidebar(route);

  const content = document.getElementById("content");
  if (cleanup) {
    try {
      cleanup();
    } catch {
      /* ignore */
    }
    cleanup = null;
  }
  content.innerHTML = `<div class="spinner">Loading…</div>`;
  try {
    const maybeCleanup = await def.mod.render(content, params);
    cleanup = typeof maybeCleanup === "function" ? maybeCleanup : null;
  } catch (err) {
    content.innerHTML = `<div class="notice error">Couldn't load this page: ${err.message}</div>`;
    console.error(err);
  }
  document.getElementById("sidebar").classList.remove("open");
  window.scrollTo(0, 0);
}

function boot() {
  document.getElementById("menuToggle").onclick = () => document.getElementById("sidebar").classList.toggle("open");
  window.addEventListener("hashchange", renderRoute);

  let loggedToday = false;
  onAuth(() => {
    renderAuthSlot();
    renderSidebar(parseHash().route); // admin links may have appeared
    if (getUser() && !loggedToday) {
      loggedToday = true;
      recordActivity("login", "login");
    }
  });

  initAuth();
  renderRoute();
}

boot();
