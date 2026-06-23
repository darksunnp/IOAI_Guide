// Thin fetch wrapper. Attaches the Firebase ID token when a call needs auth and
// normalizes errors into thrown Error objects with `.status` and `.data`.

import { getIdToken } from "../auth.js";

async function authHeader() {
  const token = await getIdToken();
  return token ? { Authorization: "Bearer " + token } : {};
}

async function handle(res) {
  const text = await res.text();
  let data = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* keep as text */
  }
  if (!res.ok) {
    const message = (data && data.message) || (data && data.error) || res.statusText || "Request failed";
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function apiGet(path, { auth = false } = {}) {
  const headers = auth ? await authHeader() : {};
  return handle(await fetch(path, { headers }));
}

export async function apiPostJson(path, body, { auth = true } = {}) {
  const headers = { "Content-Type": "application/json", ...(auth ? await authHeader() : {}) };
  return handle(await fetch(path, { method: "POST", headers, body: JSON.stringify(body) }));
}

export async function apiPostForm(path, formData, { auth = true } = {}) {
  const headers = auth ? await authHeader() : {};
  return handle(await fetch(path, { method: "POST", headers, body: formData }));
}
