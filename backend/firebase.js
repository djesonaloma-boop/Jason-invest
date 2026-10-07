// ============================================================
// JASON INVEST — FIREBASE BACKEND ONLY — COMPLET GLOBAL FC
// Projet: mumbaalomaebundi-4759
// Ce fichier est utilisé par api/index.js sur Vercel
// ============================================================

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD9X... REMPLACE PAR TON VRAI APIKEY DEPUIS FIREBASE CONSOLE",
  authDomain: "mumbaalomaebundi-4759.firebaseapp.com",
  databaseURL: "https://mumbaalomaebundi-4759-default-rtdb.firebaseio.com",
  projectId: "mumbaalomaebundi-4759",
  storageBucket: "mumbaalomaebundi-4759.appspot.com",
  messagingSenderId: "REMPLACE PAR TON SENDER ID",
  appId: "REMPLACE PAR TON APP ID"
};

// SERVICE ACCOUNT - Pour Vercel Backend
export const FIREBASE_SERVICE_ACCOUNT = {
  projectId: "mumbaalomaebundi-4759",
  clientEmail: "firebase-adminsdk-fbsvc@mumbaalomaebundi-4759.iam.gserviceaccount.com",
  privateKey: `-----BEGIN PRIVATE KEY-----
REMPLACE ICI PAR TA VRAIE CLE PRIVEE COMPLETE
TU LA TROUVES DANS FIREBASE CONSOLE > PARAMETRES > COMPTES DE SERVICE > GENERER CLE PRIVEE
ELLE FAIT ENVIRON 20 LIGNES
-----END PRIVATE KEY-----`
};

export const ADMIN_PASSWORD = "10092007";

export function isFirebaseConfigured() {
  return Boolean(
    FIREBASE_SERVICE_ACCOUNT.projectId &&
    FIREBASE_SERVICE_ACCOUNT.clientEmail &&
    FIREBASE_SERVICE_ACCOUNT.privateKey &&
    FIREBASE_SERVICE_ACCOUNT.privateKey.includes("BEGIN PRIVATE KEY") &&
   !FIREBASE_SERVICE_ACCOUNT.privateKey.includes("REMPLACE ICI")
  );
}

// ============ FIREBASE ADMIN INIT ============
let adminInstance = null;
let dbInstance = null;

async function getAdmin() {
  if (adminInstance) return adminInstance;
  const admin = await import("firebase-admin");
  if (!admin.apps.length) {
    const pk = FIREBASE_SERVICE_ACCOUNT.privateKey.replace(/\\n/g, '\n');
    adminInstance = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_SERVICE_ACCOUNT.projectId,
        clientEmail: FIREBASE_SERVICE_ACCOUNT.clientEmail,
        privateKey: pk,
      }),
      databaseURL: FIREBASE_CONFIG.databaseURL
    });
  } else {
    adminInstance = admin.app();
  }
  return adminInstance;
}

export async function getFirestoreDb() {
  if (dbInstance) return dbInstance;
  const admin = await getAdmin();
  const { getFirestore } = await import("firebase-admin/firestore");
  dbInstance = getFirestore(admin);
  return dbInstance;
}

// ============ FONCTIONS GLOBALES POUR API ============
export async function registerUser({ name, phone, email, password, referral, myCode }) {
  const db = await getFirestoreDb();
  const cleanEmail = email.trim().toLowerCase();

  const existing = await db.collection("users").where("email", "==", cleanEmail).get();
  if (!existing.empty) throw new Error("Cet email existe déjà GLOBAL FC");

  const id = Date.now().toString();
  const code = myCode || 'JAS-' + Math.random().toString(36).substring(2,6).toUpperCase() + Math.random().toString(36).substring(2,2).toUpperCase();

  const newUser = {
    id,
    name: name.trim(),
    nom: name.trim(),
    phone: phone.trim(),
    telephone: phone.trim(),
    email: cleanEmail,
    password,
    pass: password,
    referral_code: referral? referral.trim().toUpperCase() : "",
    parrainCode: code,
    code_parrain: code,
    code: code,
    solde: 0,
    balance: 0,
    investment: 0,
    totalInvest: 0,
    vip: "Aucun FC",
    date: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  await db.collection("users").doc(id).set(newUser);

  if (referral) {
    await db.collection("parrainages").doc(id).set({
      filleulId: id,
      filleulName: name.trim(),
      filleulEmail: cleanEmail,
      parrainCode: referral.trim().toUpperCase(),
      date: new Date().toISOString()
    });
  }

  return newUser;
}

export async function loginUser({ email, password }) {
  const db = await getFirestoreDb();
  const snap = await db.collection("users").where("email", "==", email.trim().toLowerCase()).where("password", "==", password).get();
  if (snap.empty) throw new Error("Email ou mot de passe incorrect GLOBAL FC");
  return snap.docs[0].data();
}

export async function listUsers() {
  const db = await getFirestoreDb();
  const snap = await db.collection("users").get();
  return snap.docs.map(d => d.data());
}
