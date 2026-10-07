export const FIREBASE_CONFIG = {
  databaseURL: "https://mumbaalomaebundi-4759-default-rtdb.firebaseio.com"
};

export const FIREBASE_SERVICE_ACCOUNT = {
  projectId: "mumbaalomaebundi-4759",
  clientEmail: "firebase-adminsdk-fbsvc@mumbaalomaebundi-4759.iam.gserviceaccount.com",
  privateKey: process.env.FIREBASE_PRIVATE_KEY || `-----BEGIN PRIVATE KEY-----
COLLE_ICI_TA_CLE_COMPLETE_AVEC_RETOURS_LIGNE
-----END PRIVATE KEY-----`
};

export const ADMIN_PASSWORD = "10092007";

export function isFirebaseConfigured(){
  const k = FIREBASE_SERVICE_ACCOUNT.privateKey || "";
  return !!FIREBASE_CONFIG.databaseURL && k.includes("BEGIN PRIVATE KEY");
}
