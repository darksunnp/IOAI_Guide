// Settings: save Kaggle username + key and the list of competition slugs to
// track. Stored in the user's own Firestore doc (users/{uid}), locked by rules.

import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { onAuth, getUser } from "../auth.js";
import { db } from "../firebase.js";
import { apiPostJson } from "../lib/api.js";
import { pageHead, signInPrompt, wireSignIn } from "../lib/ui.js";
import { escapeHtml } from "../lib/markdown.js";

const parseSlugs = (text) =>
  String(text || "")
    .split(/[\s,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export function render(container) {
  const draw = async () => {
    const user = getUser();
    if (!user) {
      container.innerHTML = pageHead("Settings") + signInPrompt("save your Kaggle key and tracked competitions");
      wireSignIn(container);
      return;
    }

    container.innerHTML = pageHead("Settings") + `<div class="spinner">Loading…</div>`;
    let kaggle = {};
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      kaggle = (snap.exists() && snap.data().kaggle) || {};
    } catch {
      /* fresh user */
    }

    container.innerHTML =
      pageHead("Settings", "Connect Kaggle so your dashboard can pull your submissions.") +
      `<div class="card" style="max-width:620px">
        <h4>Kaggle credentials</h4>
        <p class="muted text-small">Create a token at <a href="https://www.kaggle.com/settings" target="_blank" rel="noopener">kaggle.com/settings → Create New Token</a>. Open the downloaded <code>kaggle.json</code> for your username and key.</p>
        <label class="field"><span class="field-label">Kaggle username</span>
          <input type="text" id="kUser" value="${escapeHtml(kaggle.username || "")}" placeholder="your-kaggle-username" autocomplete="off"></label>
        <label class="field"><span class="field-label">Kaggle API key</span>
          <input type="password" id="kKey" value="${escapeHtml(kaggle.key || "")}" placeholder="••••••••••••" autocomplete="off"></label>
        <div class="btn-row">
          <button class="btn btn-secondary btn-sm" id="testBtn">Test connection</button>
          <span id="testResult" class="text-small"></span>
        </div>
        <hr class="divider">
        <h4>Tracked competitions</h4>
        <p class="muted text-small">One Kaggle competition slug per line (the last part of the competition URL, e.g. <code>titanic</code>). Your dashboard shows your top-5 submissions for each.</p>
        <label class="field">
          <textarea id="kSlugs" rows="5" placeholder="titanic&#10;spaceship-titanic">${escapeHtml((kaggle.slugs || []).join("\n"))}</textarea>
        </label>
        <div class="btn-row">
          <button class="btn" id="saveBtn">Save settings</button>
          <span id="saveResult" class="text-small"></span>
        </div>
      </div>`;

    container.querySelector("#testBtn").onclick = async () => {
      const out = container.querySelector("#testResult");
      out.textContent = "Testing…";
      try {
        const r = await apiPostJson("/api/kaggle/verify", {
          username: container.querySelector("#kUser").value.trim(),
          key: container.querySelector("#kKey").value.trim(),
        });
        out.innerHTML = r.ok ? `<span style="color:#5b7a4f">✓ Connected</span>` : `<span style="color:var(--color-error)">${escapeHtml(r.message || "Failed")}</span>`;
      } catch (err) {
        out.innerHTML = `<span style="color:var(--color-error)">${escapeHtml(err.message)}</span>`;
      }
    };

    container.querySelector("#saveBtn").onclick = async () => {
      const out = container.querySelector("#saveResult");
      out.textContent = "Saving…";
      try {
        await setDoc(
          doc(db, "users", user.uid),
          {
            email: user.email || null,
            displayName: user.displayName || null,
            kaggle: {
              username: container.querySelector("#kUser").value.trim(),
              key: container.querySelector("#kKey").value.trim(),
              slugs: parseSlugs(container.querySelector("#kSlugs").value),
            },
          },
          { merge: true }
        );
        out.innerHTML = `<span style="color:#5b7a4f">✓ Saved</span>`;
      } catch (err) {
        out.innerHTML = `<span style="color:var(--color-error)">${escapeHtml(err.message)}</span>`;
      }
    };
  };

  return onAuth(() => draw());
}
