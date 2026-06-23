// Activity tracking, GitHub-contributions style. Each meaningful action bumps a
// per-day counter at users/{uid}/activity/{YYYY-MM-DD}. The heatmap reads the
// whole (small) subcollection. Writes are gated by Firestore rules to own uid.

import {
  doc,
  setDoc,
  getDocs,
  collection,
  increment,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "../firebase.js";
import { getUser } from "../auth.js";

export function todayStr(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

// Bump today's counter. `dedupeKey` (optional) suppresses repeat counts within a
// day via localStorage — e.g. opening the same notebook twice counts once.
export async function recordActivity(type = "visit", dedupeKey = null) {
  const user = getUser();
  if (!db || !user) return;
  const date = todayStr();
  if (dedupeKey) {
    const k = `act:${date}:${dedupeKey}`;
    if (localStorage.getItem(k)) return;
    localStorage.setItem(k, "1");
  }
  try {
    await setDoc(doc(db, "users", user.uid, "activity", date), { count: increment(1), [type]: increment(1), date }, { merge: true });
  } catch {
    /* non-critical */
  }
}

// Returns { 'YYYY-MM-DD': count, ... } for a user (defaults to current user).
export async function loadActivity(uid) {
  const user = getUser();
  const target = uid || user?.uid;
  if (!db || !target) return {};
  const map = {};
  try {
    const snap = await getDocs(collection(db, "users", target, "activity"));
    snap.forEach((d) => {
      map[d.id] = d.data().count || 0;
    });
  } catch {
    /* ignore */
  }
  return map;
}
