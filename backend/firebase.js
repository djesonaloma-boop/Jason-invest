// ============================================================
// JASON INVEST FC — FIREBASE BACKEND ONLY
// ============================================================
// IMPORTANT RDC:
// - Ce fichier reste côté BACKEND uniquement (Vercel / Firebase Functions)
// - Ne JAMAIS l'importer dans un HTML public ou frontend
// - Tout est en FC (Franc Congolais) - jamais CFA
// - Dépôt min 20 000 FC / Retrait min 10 000 FC
// ============================================================

export const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "jason-invest-fc.firebaseapp.com",
  databaseURL: "https://jason-invest-fc-default-rtdb.firebaseio.com",
  projectId: "jason-invest-fc",
  storageBucket: "jason-invest-fc.appspot.com",
  messagingSenderId: "",
  appId: ""
};

// Pour Firebase Admin SDK - Compte de service JSON
// Colle ici les 3 valeurs de ton fichier serviceAccountKey.json
export const FIREBASE_SERVICE_ACCOUNT = {
  projectId: "jason-invest-fc",
  clientEmail: "firebase-adminsdk-xxxxx@jason-invest-fc.iam.gserviceaccount.com",
  // Remplace \n par vrais retours à la ligne - garde BEGIN PRIVATE KEY
  privateKey: `-----BEGIN PRIVATE KEY-----
REMPLACE_PAR_TA_CLE_PRIVEE
-----END PRIVATE KEY-----
`
};

export function isFirebaseConfigured() {
  const cfg = FIREBASE_CONFIG;
  const svc = FIREBASE_SERVICE_ACCOUNT;
  return Boolean(
    cfg.apiKey &&
    cfg.projectId &&
    svc.projectId &&
    svc.clientEmail &&
    svc.privateKey &&
    svc.privateKey.includes("BEGIN PRIVATE KEY")
  );
}

export function isFirebaseClientConfigured() {
  return Boolean(
    FIREBASE_CONFIG.apiKey &&
    FIREBASE_CONFIG.authDomain &&
    FIREBASE_CONFIG.projectId &&
    FIREBASE_CONFIG.appId
  );
}

// ============================================================
// ADMIN JASON INVEST FC
// ============================================================
export const ADMIN_PASSWORD = "10092007";
export const ADMIN_IDENTIFIER = "admin";

// ============================================================
// LIMITES FC JASON INVEST
// ============================================================
export const JASON_LIMITS = {
  DEPOT_MIN_FC: 20000,
  RETRAIT_MIN_FC: 10000,
  MONNAIE: "FC",
  DEVISE_INTERDITE: ["CFA", "FCFA", "€", "$"],
  PLANS: [
    { name: "Bronze FC", min: 20000, gain: 1500, duree: 30 },
    { name: "Argent FC", min: 50000, gain: 4000, duree: 30 },
    { name: "Or FC", min: 100000, gain: 8000, duree: 30 },
    { name: "Diamant FC", min: 500000, gain: 40000, duree: 30 },
    { name: "MEGA 300K FC", min: 300000, gain: 24000, duree: 30, bonusPoints: 5000 }
  ]
};

// Helper pour vérifier FC
export function formatFC(amount) {
  return Number(amount || 0).toLocaleString('fr-FR') + " FC";
}

export function validateFC(amount, type = "depot") {
  const min = type === "depot" ? JASON_LIMITS.DEPOT_MIN_FC : JASON_LIMITS.RETRAIT_MIN_FC;
  return Number(amount) >= min;
}
