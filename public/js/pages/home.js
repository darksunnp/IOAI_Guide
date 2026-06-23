// Landing page: hero + feature map.

export function render(container) {
  container.innerHTML = `
    <section class="hero">
      <h1>Your road to IOAI gold.</h1>
      <p>A single hub for everything you're building toward the International Olympiad in
      Artificial Intelligence — your learning notebooks, practice problems, live Kaggle stats,
      a daily activity streak, and a weekly competition with a shared leaderboard.</p>
      <div class="btn-row" style="margin-top:24px">
        <a class="btn" href="#/notebooks">Start learning</a>
        <a class="btn btn-secondary" href="#/problems">Browse problems</a>
      </div>
    </section>

    <hr class="divider" />

    <div class="card-grid">
      ${card("Notebooks", "Work through the syllabus — supervised &amp; unsupervised ML notebooks, rendered in your browser with code, plots and outputs.", "#/notebooks", "Open notebooks")}
      ${card("Problems", "Competition-style problems with a baseline, a worked solution, downloadable datasets, and a one-click jump to Kaggle.", "#/problems", "Solve problems")}
      ${card("Kaggle Dashboard", "Connect your Kaggle key and see your top-5 submission scores across every competition you're tracking.", "#/dashboard", "View dashboard")}
      ${card("Weekly Competition", "Submit predictions, get scored instantly against a hidden answer key, and climb the shared leaderboard.", "#/weekly", "Compete")}
      ${card("Activity", "A GitHub-style streak of your daily study — every notebook you open and every submission you make.", "#/activity", "See your streak")}
      ${card("Resources", "A curated shelf of the references, courses and papers worth your time for IOAI prep.", "#/resources", "Browse resources")}
    </div>
  `;
}

function card(title, body, href, cta) {
  return `<div class="card">
      <h4>${title}</h4>
      <p class="muted text-small">${body}</p>
      <a class="btn btn-ghost btn-sm" href="${href}" style="padding-left:0">${cta} →</a>
    </div>`;
}
