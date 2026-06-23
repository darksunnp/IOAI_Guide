// Pure-JS scoring metrics for the weekly competition.
// Each metric takes aligned arrays (truth[i] pairs with pred[i]) and returns a
// number. `higherIsBetter` tells the leaderboard how to rank.

export const METRICS = {
  accuracy: { label: "Accuracy", higherIsBetter: true, fn: accuracy },
  macro_f1: { label: "Macro F1", higherIsBetter: true, fn: macroF1 },
  rmse: { label: "RMSE", higherIsBetter: false, fn: rmse },
  mae: { label: "MAE", higherIsBetter: false, fn: mae },
  auc: { label: "ROC AUC", higherIsBetter: true, fn: auc },
};

const num = (x) => Number(String(x).trim());

function accuracy(truth, pred) {
  let correct = 0;
  for (let i = 0; i < truth.length; i++) {
    if (String(truth[i]).trim() === String(pred[i]).trim()) correct++;
  }
  return correct / truth.length;
}

function macroF1(truth, pred) {
  const labels = [...new Set(truth.map((t) => String(t).trim()))];
  let sum = 0;
  for (const label of labels) {
    let tp = 0,
      fp = 0,
      fn = 0;
    for (let i = 0; i < truth.length; i++) {
      const t = String(truth[i]).trim() === label;
      const p = String(pred[i]).trim() === label;
      if (p && t) tp++;
      else if (p && !t) fp++;
      else if (!p && t) fn++;
    }
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    sum += f1;
  }
  return sum / labels.length;
}

function rmse(truth, pred) {
  let s = 0;
  for (let i = 0; i < truth.length; i++) {
    const d = num(truth[i]) - num(pred[i]);
    s += d * d;
  }
  return Math.sqrt(s / truth.length);
}

function mae(truth, pred) {
  let s = 0;
  for (let i = 0; i < truth.length; i++) s += Math.abs(num(truth[i]) - num(pred[i]));
  return s / truth.length;
}

// Probabilistic AUC via the rank-sum (Mann–Whitney U) identity. truth must be
// binary {0,1}; pred is a score/probability.
function auc(truth, pred) {
  const rows = pred.map((p, i) => ({ p: num(p), y: num(truth[i]) }));
  rows.sort((a, b) => a.p - b.p);
  // average ranks for ties
  const ranks = new Array(rows.length);
  let i = 0;
  while (i < rows.length) {
    let j = i;
    while (j < rows.length - 1 && rows[j + 1].p === rows[i].p) j++;
    const avg = (i + j) / 2 + 1; // ranks are 1-based
    for (let k = i; k <= j; k++) ranks[k] = avg;
    i = j + 1;
  }
  let sumRanksPos = 0;
  let nPos = 0;
  for (let k = 0; k < rows.length; k++) {
    if (rows[k].y === 1) {
      sumRanksPos += ranks[k];
      nPos++;
    }
  }
  const nNeg = rows.length - nPos;
  if (nPos === 0 || nNeg === 0) return 0;
  return (sumRanksPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}

// Minimal CSV parser: handles quoted fields and commas inside quotes. Returns
// { header: string[], rows: string[][] }.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") pushField();
    else if (c === "\n") pushRow();
    else if (c === "\r") {
      /* swallow */
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) pushRow();
  const nonEmpty = rows.filter((r) => r.length && !(r.length === 1 && r[0] === ""));
  return { header: nonEmpty[0] || [], rows: nonEmpty.slice(1) };
}

// Build a Map from id-column value -> target value for a parsed CSV.
export function toMap(parsed, idCol, targetCol) {
  const idx = parsed.header.indexOf(idCol);
  const tdx = parsed.header.indexOf(targetCol);
  if (idx === -1) throw new Error(`id column "${idCol}" not found`);
  if (tdx === -1) throw new Error(`target column "${targetCol}" not found`);
  const map = new Map();
  for (const r of parsed.rows) map.set(String(r[idx]).trim(), r[tdx]);
  return map;
}

// Score a submission against an answer key. Throws on misaligned ids / missing
// rows so the user gets a clear error.
export function scoreSubmission({ answerKeyText, submissionText, metric, idCol, targetCol }) {
  const spec = METRICS[metric];
  if (!spec) throw new Error(`unknown metric "${metric}"`);
  const keyMap = toMap(parseCsv(answerKeyText), idCol, targetCol);
  const subMap = toMap(parseCsv(submissionText), idCol, targetCol);

  const truth = [];
  const pred = [];
  const missing = [];
  for (const [id, t] of keyMap) {
    if (!subMap.has(id)) {
      missing.push(id);
      if (missing.length > 5) break;
    } else {
      truth.push(t);
      pred.push(subMap.get(id));
    }
  }
  if (missing.length) {
    throw new Error(`submission is missing predictions for ids: ${missing.slice(0, 5).join(", ")}…`);
  }
  const score = spec.fn(truth, pred);
  return { score, n: truth.length, metric, higherIsBetter: spec.higherIsBetter, label: spec.label };
}
