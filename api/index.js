// ============================================================
// JASON BUSINESS — FIREBASE BACKEND ONLY
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
export const ADMIN_PASSWORD = "";
