// Render a parsed .ipynb (Jupyter notebook JSON) into a DOM node:
// markdown cells, syntax-highlighted code, and outputs (text, images, html).

import { renderMarkdown, escapeHtml } from "./markdown.js";

const joinSource = (s) => (Array.isArray(s) ? s.join("") : String(s || ""));
const stripAnsi = (s) => s.replace(/\u001b?\[[0-9;]*m/g, "");

function highlight(code, lang) {
  if (window.hljs) {
    try {
      if (lang && window.hljs.getLanguage(lang)) return window.hljs.highlight(code, { language: lang }).value;
      return window.hljs.highlightAuto(code).value;
    } catch {
      /* fall through */
    }
  }
  return escapeHtml(code);
}

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  return node;
}

function renderOutputs(outputs, container) {
  for (const out of outputs || []) {
    if (out.output_type === "stream") {
      const cls = out.name === "stderr" ? "nb-output stderr" : "nb-output";
      container.appendChild(el("div", cls, `<pre>${escapeHtml(stripAnsi(joinSource(out.text)))}</pre>`));
    } else if (out.output_type === "error") {
      const tb = stripAnsi((out.traceback || []).join("\n")) || `${out.ename}: ${out.evalue}`;
      container.appendChild(el("div", "nb-output stderr", `<pre>${escapeHtml(tb)}</pre>`));
    } else if (out.output_type === "execute_result" || out.output_type === "display_data") {
      const data = out.data || {};
      if (data["image/png"]) {
        const src = "data:image/png;base64," + (Array.isArray(data["image/png"]) ? data["image/png"].join("") : data["image/png"]);
        const wrap = el("div", "nb-output");
        const img = document.createElement("img");
        img.src = src;
        img.alt = "output image";
        wrap.appendChild(img);
        container.appendChild(wrap);
      } else if (data["image/jpeg"]) {
        const src = "data:image/jpeg;base64," + joinSource(data["image/jpeg"]);
        const wrap = el("div", "nb-output");
        const img = document.createElement("img");
        img.src = src;
        wrap.appendChild(img);
        container.appendChild(wrap);
      } else if (data["text/html"]) {
        const safe = window.DOMPurify ? window.DOMPurify.sanitize(joinSource(data["text/html"])) : "";
        container.appendChild(el("div", "nb-output", safe));
      } else if (data["text/plain"]) {
        container.appendChild(el("div", "nb-output", `<pre>${escapeHtml(joinSource(data["text/plain"]))}</pre>`));
      }
    }
  }
}

// Returns a DOM element for the whole notebook.
export function renderNotebook(nb) {
  const lang = nb?.metadata?.kernelspec?.language || nb?.metadata?.language_info?.name || "python";
  const root = el("div", "nb");
  for (const cell of nb.cells || []) {
    const source = joinSource(cell.source);
    if (cell.cell_type === "markdown") {
      if (source.trim()) root.appendChild(el("div", "nb-cell md", `<div class="nb-md">${renderMarkdown(source)}</div>`));
    } else if (cell.cell_type === "code") {
      const cellEl = el("div", "nb-cell code");
      const n = cell.execution_count != null ? cell.execution_count : " ";
      cellEl.appendChild(el("div", "nb-prompt", `In [${n}]`));
      cellEl.appendChild(el("pre", "nb-source", `<code class="hljs language-${escapeHtml(lang)}">${highlight(source, lang)}</code>`));
      renderOutputs(cell.outputs, cellEl);
      root.appendChild(cellEl);
    }
  }
  return root;
}
