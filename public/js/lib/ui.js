// Small shared UI helpers used across pages.

import { firebaseConfigured } from "../firebase.js";
import { signIn } from "../auth.js";

export function elFrom(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function pageHead(title, subtitle) {
  return `<div class="page-head"><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ""}</div>`;
}

export function fmtDate(iso, opts) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString(undefined, opts || { year: "numeric", month: "short", day: "numeric" });
}

export function fmtScore(x) {
  if (x == null || Number.isNaN(x)) return "—";
  return Number(x).toLocaleString(undefined, { maximumFractionDigits: 6 });
}

// Markup shown when an auth-gated feature is used while signed out (or when
// Firebase isn't configured at all).
export function signInPrompt(feature) {
  if (!firebaseConfigured) {
    return `<div class="notice">This feature needs Firebase. Add your web config to <code>public/js/firebase.js</code> to enable ${feature}.</div>`;
  }
  return `<div class="card" style="max-width:480px">
      <h4>Sign in required</h4>
      <p class="muted">Sign in with your Google account to ${feature}.</p>
      <button class="btn" id="gateSignIn">Sign in with Google</button>
    </div>`;
}

export function wireSignIn(container) {
  const b = container.querySelector("#gateSignIn");
  if (b) b.onclick = () => signIn();
}
