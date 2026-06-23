// Auth state: Google sign-in via Firebase, plus a tiny pub/sub so pages can
// react to login/logout. Admin status comes from the server (/api/me), which is
// the source of truth (ADMIN_UIDS env), so the client can't fake it.

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth, firebaseConfigured } from "./firebase.js";

let currentUser = null;
let isAdmin = false;
let ready = false;
const listeners = new Set();

export function onAuth(cb) {
  listeners.add(cb);
  if (ready) cb(currentUser, isAdmin);
  return () => listeners.delete(cb);
}
function emit() {
  for (const cb of listeners) cb(currentUser, isAdmin);
}

export const getUser = () => currentUser;
export const getIsAdmin = () => isAdmin;
export const authReady = () => ready;

export async function getIdToken() {
  if (!currentUser) return null;
  try {
    return await currentUser.getIdToken();
  } catch {
    return null;
  }
}

export async function signIn() {
  if (!firebaseConfigured) {
    alert("Firebase isn't configured yet. Add your web config to public/js/firebase.js.");
    return;
  }
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err?.code !== "auth/popup-closed-by-user") alert("Sign-in failed: " + (err?.message || err));
  }
}

export async function signOutUser() {
  if (auth) await signOut(auth);
}

// Ask the server whether the signed-in user is an admin.
async function refreshAdmin() {
  isAdmin = false;
  if (!currentUser) return;
  try {
    const token = await currentUser.getIdToken();
    const res = await fetch("/api/me", { headers: { Authorization: "Bearer " + token } });
    if (res.ok) isAdmin = Boolean((await res.json()).isAdmin);
  } catch {
    /* leave isAdmin false */
  }
}

export function initAuth() {
  if (!firebaseConfigured) {
    ready = true;
    emit();
    return;
  }
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    await refreshAdmin();
    ready = true;
    emit();
  });
}
