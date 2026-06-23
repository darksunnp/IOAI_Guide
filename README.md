# IOAI Guide

A USACO-Guide-style hub for **IOAI** (International Olympiad in Artificial Intelligence) prep:

- **Notebooks** — a syllabus library. Notebooks on the server render in-browser (markdown, highlighted code, plots); notebooks you host on **Colab/Kaggle** show as one-click "Open" links.
- **Problems** — competition problems with **Baseline / Solution / Dataset** buttons and **Open in Kaggle**. Each button is just a link you paste (Kaggle/Colab/Drive), or a file already on the server.
- **Resources** — a curated, admin-editable link shelf.
- **Kaggle Dashboard** — your **top-5 submissions** for every competition slug you track (server-side proxy; your key never reaches other users).
- **Activity** — a GitHub-style daily-streak heatmap.
- **Weekly Competition** — upload a predictions CSV, get scored instantly against a hidden answer key, and climb a **shared leaderboard**.
- **Google sign-in** via Firebase.

Built as a no-build-step vanilla-JS SPA served by a small Node/Express backend. Runs as one persistent process locally or on Hack Club **Nest**.

---

## 1. Run it locally (content-only, no accounts needed)

```bash
cd Nwe_Website_IOAI
npm install
npm start            # → http://localhost:3000
```

You can immediately browse Notebooks / Problems / Resources and the Weekly demo. Login, Kaggle, Activity and the Leaderboard stay disabled until you add Firebase (step 3). Change the port with `PORT=4000 npm start`.

By default the server reads your learning content from `../AI_gold` (the folder next to this project). Override with `AI_GOLD_DIR=/path/to/AI_gold`.

---

## 2. Adding content — paste links, no uploads

Content lives in [`content/content.json`](content/content.json), written to disk (it persists on Nest). Once you're signed in as an **admin** (step 3), the **Manage Content** page lets you:

- **Add a notebook** — title, category, tags, and a **Colab / Kaggle / other** link.
- **Add / update a problem** — title, difficulty, tags, description, a **competition link** (Open in Kaggle), **baseline / solution** links, a **Colab** link, and **datasets** (one per line, `Label | https://url`).
- **Add a resource** — title + URL.
- **Delete** any link-based entry.

You can also edit `content/content.json` by hand — the format is small and obvious.

**Disk notebooks still work too:** any `.ipynb` under `AI_gold/ML` is auto-discovered and rendered in-browser, and any problem folder under `AI_gold/Problems` is picked up with its files as download buttons. Disk and link content live side by side (an entry can even have both — e.g. a server baseline *and* a Colab link). Disk entries show an "on disk" tag in Manage Content and can't be deleted from the UI (remove the file instead).

---

## 3. Enable login, Kaggle, activity & leaderboard (Firebase)

These features need a free Firebase project.

1. **Create a project** at <https://console.firebase.google.com>.
2. **Authentication → Sign-in method → enable Google.**
3. **Firestore Database → Create database** (production mode is fine).
4. **Project settings → General → Your apps → Web app → SDK config.** Copy the config object into [`public/js/firebase.js`](public/js/firebase.js) (replace the `REPLACE_WITH_…` placeholders).
5. **Project settings → Service accounts → Generate new private key.** Save the JSON somewhere private and point the server at it:
   ```bash
   export FIREBASE_SERVICE_ACCOUNT=/path/to/serviceAccount.json
   ```
6. **Deploy the security rules** in [`firestore.rules`](firestore.rules) (Firestore → Rules → paste → Publish). They lock each user's Kaggle key to their own account and make leaderboards read-only to clients (only the server writes scores).
7. **Make yourself an admin.** Start the server, sign in once, open **Manage Content** — it shows your UID. Set it:
   ```bash
   export ADMIN_UIDS=your-firebase-uid
   ```
   (comma-separate multiple admins). Restart and reload.

Tip: copy [`.env.example`](.env.example) to `.env` and put `FIREBASE_SERVICE_ACCOUNT`, `ADMIN_UIDS`, etc. there — `npm start` loads `.env` automatically.

### Connect Kaggle (each user, once)
On **Settings**, create a token at <https://www.kaggle.com/settings> ("Create New Token" downloads `kaggle.json`), paste your **username + key**, hit **Test connection**, and add the **competition slugs** you want on your dashboard (e.g. `titanic`).

> Kaggle has no "competitions I've joined" API, so you maintain the slug list yourself. The dashboard shows the **highest public scores** first (correct for most classification metrics; for lower-is-better metrics, treat the ordering accordingly).

---

## 4. Weekly competitions (admin)

A weekly competition is a folder under `content/weekly/<id>/` containing:

- `config.json` — `{ title, metric, idCol, targetCol, deadline, description }`. Metrics: `accuracy`, `macro_f1`, `rmse`, `mae`, `auc`.
- `answer_key.csv` — the ground truth (**server-side only, never served**).
- `starter.csv` — optional sample submission.

Create one from **Manage Content → Create weekly competition** (the answer key is uploaded; everything else is a form), or drop the files in by hand. A ready-made demo lives in `content/weekly/2026-demo/`. Submissions are scored on the server and the best score per user is written to the live leaderboard.

---

## 5. Deploy to Nest (`darksun.hackclub.app`)

The whole app is one Node process plus a folder of static files — ideal for Nest.

```bash
# 1. copy the project up (run from your machine)
rsync -av --exclude node_modules ./Nwe_Website_IOAI darksun@hackclub.app:~/ioai-guide
#    (optionally copy ../AI_gold too, or skip it and use link-based content only)

# 2. on the box
ssh darksun@hackclub.app
cd ~/ioai-guide
npm install --omit=dev

# 3. secrets + config — create ~/ioai-guide/.env
cat > .env <<'EOF'
PORT=3000
FIREBASE_SERVICE_ACCOUNT=/home/darksun/ioai-guide/serviceAccount.json
ADMIN_UIDS=your-firebase-uid
# AI_GOLD_DIR=/home/darksun/AI_gold   # only if you copied it up
EOF
# upload serviceAccount.json next to it (keep it private — it's gitignored)
```

**Run it persistently** as a systemd *user* service:

```ini
# ~/.config/systemd/user/ioai-guide.service
[Unit]
Description=IOAI Guide
After=network.target

[Service]
WorkingDirectory=%h/ioai-guide
ExecStart=/usr/bin/node --env-file-if-exists=.env server/index.js
Restart=always

[Install]
WantedBy=default.target
```

```bash
loginctl enable-linger darksun           # keep it running after you log out
systemctl --user daemon-reload
systemctl --user enable --now ioai-guide
systemctl --user status ioai-guide       # check it's up; journalctl --user -u ioai-guide for logs
```

**Expose it on your domain** via Nest's Caddy (proxy `darksun.hackclub.app` → `localhost:3000`). Nest provides a helper for this — follow the current "host a web app" guide in the Nest docs (`https://guides.hackclub.app/`); the reverse-proxy target is the `PORT` above.

Finally, in the Firebase console add `darksun.hackclub.app` under **Authentication → Settings → Authorized domains** so Google sign-in works in production.

---

## Project layout

```
server/        Express app: content API, Kaggle proxy, weekly scoring, admin writes, auth
public/        the SPA — index.html, css/styles.css, js/{app,auth,firebase,lib,pages}
content/       content.json (link manifest) + weekly/<id>/ competitions
firestore.rules, .env.example, package.json
```

## Notes & trade-offs

- **No build step.** Firebase, marked, DOMPurify and highlight.js load from CDNs; everything else is plain ES modules. Deploy = `npm install` + run.
- **Security.** Kaggle keys live in each user's own Firestore doc (locked by rules) and are read server-side via the Admin SDK for proxying — never broadcast. Weekly answer keys never leave the server. Leaderboard rows are server-written only.
- **Path-traversal** on the download/notebook endpoints is guarded (`safeJoin`).
- Sign-in is open Google by default; admin pages are gated by `ADMIN_UIDS`. Add an email allowlist later if you want to restrict the cohort.
