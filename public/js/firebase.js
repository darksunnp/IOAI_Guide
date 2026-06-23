// Firebase client initialization.
//
// ▸ Replace the placeholder values below with your project's web config
//   (Firebase console → Project settings → Your apps → SDK setup → Config).
// ▸ Until you do, `firebaseConfigured` stays false and the site runs in
//   content-only mode (browse / render / download still work; login, Kaggle,
//   activity and leaderboard are disabled with a friendly notice).

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDUi2cRubN3pqqW46akjsVPqfKZFhpKvCA",
  authDomain: "helpioai.firebaseapp.com",
  projectId: "helpioai",
  storageBucket: "helpioai.firebasestorage.app",
  messagingSenderId: "144469082804",
  appId: "1:144469082804:web:634d773b9c9276319acde1",
  measurementId: "G-X98GW7EZ5Z",
};

export const firebaseConfigured = Boolean(firebaseConfig.apiKey) && !/REPLACE_WITH/.test(firebaseConfig.apiKey);

let app = null;
let auth = null;
let db = null;

if (firebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  console.warn("[firebase] Using placeholder config — auth-backed features are disabled. Edit public/js/firebase.js.");
}

export { app, auth, db };
