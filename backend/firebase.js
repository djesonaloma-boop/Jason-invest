// ============================================================
// JASON INVESTIR — FIREBASE BACKEND ONLY
// ============================================================
// Projet: JASON INVESTIR GLOBAL FC
// IMPORTANT: Ne mettez PAS cette config dans HTML/JS publics
// Firebase utilisé UNIQUEMENT depuis backend (api/index.js)
// ============================================================

export const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// Pour Firebase Admin SDK - JASON INVESTIR
export const FIREBASE_SERVICE_ACCOUNT = {
  projectId: "",
  clientEmail: "",
  privateKey: ""
};

export function isFirebaseConfigured() {
  return Boolean(
    FIREBASE_SERVICE_ACCOUNT.projectId &&
    FIREBASE_SERVICE_ACCOUNT.clientEmail &&
    FIREBASE_SERVICE_ACCOUNT.privateKey
  );
}

// Mot de passe admin JASON INVESTIR
export const ADMIN_PASSWORD = "";
