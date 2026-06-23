// Markdown → safe HTML, using the marked + DOMPurify globals loaded in index.html.

export function renderMarkdown(src) {
  const md = Array.isArray(src) ? src.join("") : String(src || "");
  const html = window.marked ? window.marked.parse(md, { gfm: true, breaks: false }) : escapeHtml(md);
  return window.DOMPurify ? window.DOMPurify.sanitize(html) : html;
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
