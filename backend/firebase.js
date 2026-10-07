// ============================================================
// JASON INVEST FC — FIREBASE BACKEND
// Backend/firebase/firebase.js
// ============================================================
// Compatible avec :
//     Api/index.js
//
// Fonctions utilisées par Api/index.js :
//     registerUser()
//     loginUser()
//     forgotPassword()
//     getUser()
//
// IMPORTANT RDC :
// - Tout est en FC (Franc Congolais)
// - Dépôt minimum : 20 000 FC
// - Retrait minimum : 10 000 FC
// - Ce fichier reste côté BACKEND uniquement
// - Ne jamais l'importer dans un HTML public
// ============================================================

"use strict";


// ============================================================
// MODULES
// ============================================================

const {
  initializeApp,
  getApps,
  cert
} = require("firebase-admin/app");

const {
  getDatabase
} = require("firebase-admin/database");


// ============================================================
// CONFIGURATION FIREBASE
// ============================================================

const FIREBASE_CONFIG = {

  apiKey:
    process.env.FIREBASE_API_KEY || "",

  authDomain:
    process.env.FIREBASE_AUTH_DOMAIN ||
    "jason-invest-fc.firebaseapp.com",

  databaseURL:
    process.env.FIREBASE_DATABASE_URL ||
    "https://jason-invest-fc-default-rtdb.firebaseio.com",

  projectId:
    process.env.FIREBASE_PROJECT_ID ||
    "jason-invest-fc",

  storageBucket:
    process.env.FIREBASE_STORAGE_BUCKET ||
    "jason-invest-fc.appspot.com",

  messagingSenderId:
    process.env.FIREBASE_MESSAGING_SENDER_ID || "",

  appId:
    process.env.FIREBASE_APP_ID || ""

};


// ============================================================
// FIREBASE ADMIN SERVICE ACCOUNT
// ============================================================

const FIREBASE_SERVICE_ACCOUNT = {

  projectId:
    process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    "jason-invest-fc",

  clientEmail:
    process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL ||
    "",

  privateKey:
    (
      process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY ||
      ""
    ).replace(/\\n/g, "\n")

};


// ============================================================
// VÉRIFICATION CONFIGURATION
// ============================================================

function isFirebaseConfigured() {

  const svc =
    FIREBASE_SERVICE_ACCOUNT;

  return Boolean(

    svc.projectId &&

    svc.clientEmail &&

    svc.privateKey &&

    svc.privateKey.includes(
      "BEGIN PRIVATE KEY"
    )

  );

}


function isFirebaseClientConfigured() {

  return Boolean(

    FIREBASE_CONFIG.apiKey &&

    FIREBASE_CONFIG.authDomain &&

    FIREBASE_CONFIG.projectId &&

    FIREBASE_CONFIG.appId

  );

}


// ============================================================
// INITIALISATION FIREBASE ADMIN
// ============================================================

let adminApp = null;

let database = null;


function getFirebaseAdmin() {

  if (adminApp) {
    return adminApp;
  }


  if (!isFirebaseConfigured()) {

    throw new Error(
      "Firebase Admin n'est pas configuré. " +
      "Configure FIREBASE_SERVICE_ACCOUNT_PROJECT_ID, " +
      "FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL et " +
      "FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY."
    );

  }


  if (getApps().length > 0) {

    adminApp = getApps()[0];

  } else {

    adminApp = initializeApp({

      credential:
        cert(FIREBASE_SERVICE_ACCOUNT),

      databaseURL:
        FIREBASE_CONFIG.databaseURL

    });

  }


  database =
    getDatabase(adminApp);


  return adminApp;

}


// ============================================================
// DATABASE
// ============================================================

function getDB() {

  if (!database) {
    getFirebaseAdmin();
  }

  return database;

}


// ============================================================
// FIREBASE AUTH REST API
// ============================================================

async function firebaseAuthRequest(
  endpoint,
  body
) {

  if (
    !FIREBASE_CONFIG.apiKey
  ) {

    throw new Error(
      "FIREBASE_API_KEY n'est pas configurée."
    );

  }


  const url =
    `https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${encodeURIComponent(
      FIREBASE_CONFIG.apiKey
    )}`;


  const response =
    await fetch(
      url,
      {

        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(body)

      }
    );


  const data =
    await response
      .json()
      .catch(
        () => ({})
      );


  if (!response.ok) {

    const firebaseMessage =
      data?.error?.message ||
      "Erreur Firebase Authentication.";

    throw new Error(
      translateFirebaseError(
        firebaseMessage
      )
    );

  }


  return data;

}


// ============================================================
// TRADUCTION DES ERREURS FIREBASE
// ============================================================

function translateFirebaseError(
  code
) {

  const errors = {

    EMAIL_EXISTS:
      "Cette adresse e-mail est déjà utilisée.",

    EMAIL_NOT_FOUND:
      "Adresse e-mail ou mot de passe incorrect.",

    INVALID_PASSWORD:
      "Adresse e-mail ou mot de passe incorrect.",

    INVALID_LOGIN_CREDENTIALS:
      "Adresse e-mail ou mot de passe incorrect.",

    USER_DISABLED:
      "Ce compte a été désactivé.",

    INVALID_EMAIL:
      "Adresse e-mail invalide.",

    WEAK_PASSWORD:
      "Le mot de passe est trop faible.",

    TOO_MANY_ATTEMPTS_TRY_LATER:
      "Trop de tentatives. Réessayez plus tard.",

    OPERATION_NOT_ALLOWED:
      "La connexion par e-mail et mot de passe n'est pas activée dans Firebase.",

    RESET_PASSWORD_EXCEED_LIMIT:
      "Trop de demandes de récupération. Réessayez plus tard."

  };


  return (
    errors[code] ||
    `Firebase : ${code}`
  );

}


// ============================================================
// GÉNÉRATION DU CODE DE PARRAINAGE
// ============================================================

function generateReferralCode() {

  const random =
    Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();


  return `JAS-${random}`;

}


// ============================================================
// INSCRIPTION UTILISATEUR
// ============================================================

async function registerUser({
  name,
  phone,
  email,
  password,
  referral = null
}) {

  if (!name) {

    throw new Error(
      "Nom complet requis."
    );

  }


  if (!phone) {

    throw new Error(
      "Numéro de téléphone requis."
    );

  }


  if (!email) {

    throw new Error(
      "Adresse e-mail requise."
    );

  }


  if (
    !password ||
    password.length < 6
  ) {

    throw new Error(
      "Le mot de passe doit contenir au moins 6 caractères."
    );

  }


  const cleanEmail =
    email
      .trim()
      .toLowerCase();


  // ----------------------------------------------------------
  // Création du compte Firebase Authentication
  // ----------------------------------------------------------

  const authData =
    await firebaseAuthRequest(
      "accounts:signUp",
      {

        email:
          cleanEmail,

        password,

        returnSecureToken:
          true

      }
    );


  const uid =
    authData.localId;


  if (!uid) {

    throw new Error(
      "Firebase n'a pas retourné l'identifiant utilisateur."
    );

  }


  // ----------------------------------------------------------
  // Profil JASON INVEST
  // ----------------------------------------------------------

  const referralCode =
    generateReferralCode();


  const now =
    new Date()
      .toISOString();


  const user = {

    uid,

    name:
      name.trim(),

    phone:
      phone.trim(),

    email:
      cleanEmail,

    referral:
      referral
        ? referral.trim()
        : null,

    referralCode,

    balanceFC:
      0,

    totalInvestmentFC:
      0,

    totalDepositFC:
      0,

    totalWithdrawalFC:
      0,

    points:
      0,

    vipLevel:
      "Aucun",

    accountStatus:
      "active",

    createdAt:
      now,

    updatedAt:
      now

  };


  // ----------------------------------------------------------
  // Sauvegarde dans Realtime Database
  // ----------------------------------------------------------

  const db =
    getDB();


  await db
    .ref(`users/${uid}`)
    .set(user);


  return {

    uid,

    name:
      user.name,

    phone:
      user.phone,

    email:
      user.email,

    referral:
      user.referral,

    referralCode:
      user.referralCode,

    balanceFC:
      user.balanceFC,

    points:
      user.points,

    vipLevel:
      user.vipLevel,

    accountStatus:
      user.accountStatus

  };

}


// ============================================================
// CONNEXION UTILISATEUR
// ============================================================

async function loginUser({
  email,
  password
}) {

  if (!email) {

    throw new Error(
      "Adresse e-mail requise."
    );

  }


  if (!password) {

    throw new Error(
      "Mot de passe requis."
    );

  }


  const cleanEmail =
    email
      .trim()
      .toLowerCase();


  // ----------------------------------------------------------
  // Firebase Authentication
  // ----------------------------------------------------------

  const authData =
    await firebaseAuthRequest(
      "accounts:signInWithPassword",
      {

        email:
          cleanEmail,

        password,

        returnSecureToken:
          true

      }
    );


  const uid =
    authData.localId;


  if (!uid) {

    throw new Error(
      "Identifiant utilisateur introuvable."
    );

  }


  // ----------------------------------------------------------
  // Récupération du profil
  // ----------------------------------------------------------

  let user = null;


  try {

    const db =
      getDB();


    const snapshot =
      await db
        .ref(`users/${uid}`)
        .once("value");


    user =
      snapshot.val();

  } catch (dbError) {

    console.error(
      "USER PROFILE ERROR:",
      dbError
    );

  }


  return {

    token:
      authData.idToken,

    refreshToken:
      authData.refreshToken,

    expiresIn:
      authData.expiresIn,

    uid,

    user: user || {

      uid,

      email:
        cleanEmail

    }

  };

}


// ============================================================
// MOT DE PASSE OUBLIÉ
// ============================================================

async function forgotPassword(
  email
) {

  if (!email) {

    throw new Error(
      "Adresse e-mail requise."
    );

  }


  const cleanEmail =
    email
      .trim()
      .toLowerCase();


  await firebaseAuthRequest(
    "accounts:sendOobCode",
    {

      requestType:
        "PASSWORD_RESET",

      email:
        cleanEmail

    }
  );


  return true;

}


// ============================================================
// RÉCUPÉRER UN UTILISATEUR
// ============================================================

async function getUser(
  uid
) {

  if (!uid) {

    throw new Error(
      "UID utilisateur requis."
    );

  }


  const db =
    getDB();


  const snapshot =
    await db
      .ref(`users/${uid}`)
      .once("value");


  const user =
    snapshot.val();


  if (!user) {

    throw new Error(
      "Utilisateur introuvable."
    );

  }


  return user;

}


// ============================================================
// METTRE À JOUR UN UTILISATEUR
// ============================================================

async function updateUser(
  uid,
  updates
) {

  if (!uid) {

    throw new Error(
      "UID utilisateur requis."
    );

  }


  if (
    !updates ||
    typeof updates !== "object"
  ) {

    throw new Error(
      "Données de mise à jour invalides."
    );

  }


  const db =
    getDB();


  updates.updatedAt =
    new Date()
      .toISOString();


  await db
    .ref(`users/${uid}`)
    .update(updates);


  return getUser(uid);

}


// ============================================================
// ADMIN JASON INVEST FC
// ============================================================

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD ||
  "10092007";

const ADMIN_IDENTIFIER =
  process.env.ADMIN_IDENTIFIER ||
  "admin";


// ============================================================
// LIMITES FC JASON INVEST
// ============================================================

const JASON_LIMITS = {

  DEPOT_MIN_FC:
    20000,

  RETRAIT_MIN_FC:
    10000,

  MONNAIE:
    "FC",

  DEVISE_INTERDITE: [
    "CFA",
    "FCFA",
    "€",
    "$"
  ],

  PLANS: [

    {
      name:
        "Bronze FC",

      min:
        20000,

      gain:
        1500,

      duree:
        30

    },

    {
      name:
        "Argent FC",

      min:
        50000,

      gain:
        4000,

      duree:
        30

    },

    {
      name:
        "Or FC",

      min:
        100000,

      gain:
        8000,

      duree:
        30

    },

    {
      name:
        "Diamant FC",

      min:
        500000,

      gain:
        40000,

      duree:
        30

    },

    {
      name:
        "MEGA 300K FC",

      min:
        300000,

      gain:
        24000,

      duree:
        30,

      bonusPoints:
        5000

    }

  ]

};


// ============================================================
// FORMAT FC
// ============================================================

function formatFC(
  amount
) {

  return (
    Number(amount || 0)
      .toLocaleString("fr-FR") +
    " FC"
  );

}


// ============================================================
// VALIDATION FC
// ============================================================

function validateFC(
  amount,
  type = "depot"
) {

  const min =
    type === "depot"
      ? JASON_LIMITS.DEPOT_MIN_FC
      : JASON_LIMITS.RETRAIT_MIN_FC;


  return (
    Number(amount) >= min
  );

}


// ============================================================
// EXPORTS
// ============================================================
// Compatible avec :
// const firebase = require(
//   "../Backend/firebase/firebase.js"
// );
// ============================================================

module.exports = {

  FIREBASE_CONFIG,

  FIREBASE_SERVICE_ACCOUNT,

  ADMIN_PASSWORD,

  ADMIN_IDENTIFIER,

  JASON_LIMITS,

  isFirebaseConfigured,

  isFirebaseClientConfigured,

  formatFC,

  validateFC,

  registerUser,

  loginUser,

  forgotPassword,

  getUser,

  updateUser

};
