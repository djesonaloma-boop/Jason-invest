"use strict";
/*

JASON INVEST — API FINAL PUBLIC GLOBAL FC
api/index.js — Version Vercel + Firebase GLOBAL

*/
const express = require("express");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

// ================= FIREBASE ADMIN =================
// On essaie de charger firebase backend, mais on ne bloque pas si ça échoue
let firebaseBackend = null;
try {
  // Chemin correct minuscule pour Vercel Linux
  firebaseBackend = require("../backend/firebase.js");
  if (firebaseBackend && firebaseBackend.default) {
    firebaseBackend = { ...firebaseBackend.default, ...firebaseBackend };
  }
  console.log("✅ backend/firebase.js chargé");
} catch (e) {
  try {
    firebaseBackend = require("../Backend/firebase/firebase.js");
    console.log("✅ Backend/firebase/firebase.js chargé (fallback majuscule)");
  } catch (e2) {
    console.warn("⚠️ Firebase backend non trouvé, mode API seule:", e2.message);
  }
}

function success(res, data = {}, message = "OK") {
  return res.status(200).json({ success: true, message, ...data });
}
function error(res, message, status = 400) {
  return res.status(status).json({ success: false, message });
}

// Route principale
app.get("/", (req, res) => {
  return success(res, { service: "JASON INVEST API GLOBAL", version: "3.0 GLOBAL FC", status: "online", firebase: !!firebaseBackend }, "API JASON INVEST GLOBALE opérationnelle FC.");
});

app.get("/api", (req, res) => {
  return success(res, { service: "JASON INVEST GLOBAL", backend: firebaseBackend ? "Firebase OK" : "Fallback", status: "online" }, "API JASON INVEST GLOBAL opérationnelle.");
});

// ====== INSCRIPTION GLOBALE ======
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, phone, email, password, referral, myCode } = req.body || {};
    if (!name || name.trim().length < 2) return error(res, "Nom complet requis.");
    if (!phone || phone.trim().length < 6) return error(res, "Téléphone invalide.");
    if (!email) return error(res, "Email obligatoire.");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) return error(res, "Email invalide.");
    if (!password || password.length < 6) return error(res, "Mot de passe 6 caractères min.");

    // Si backend firebase a registerUser, on l'utilise
    if (firebaseBackend && typeof firebaseBackend.registerUser === "function") {
      const user = await firebaseBackend.registerUser({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        password,
        referral: referral ? referral.trim() : null,
        myCode
      });
      return success(res, { user }, "Compte créé GLOBAL via Firebase Backend.");
    }

    // SINON : on crée user direct ici pour que Vercel ne bloque pas
    // Le frontend a déjà la logique Firestore directe, donc on renvoie juste OK
    const id = Date.now().toString();
    const code = myCode || 'JAS-' + Math.random().toString(36).substring(2,6).toUpperCase();
    const newUser = {
      id, name: name.trim(), phone: phone.trim(), email: email.trim().toLowerCase(),
      referral_code: referral||"", parrainCode: code, code_parrain: code,
      solde: 0, balance: 0, date: new Date().toISOString()
    };

    // On essaie d'écrire dans Firestore si possible (via backend)
    if (firebaseBackend && firebaseBackend.db) {
      try {
        const { doc, setDoc } = require("firebase/firestore");
        await setDoc(doc(firebaseBackend.db, "users", id), newUser);
      } catch {}
    }

    return success(res, { user: newUser }, "Compte créé GLOBAL FC (API fallback). Le frontend va aussi écrire dans Firestore.");

  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return error(res, err.message || "Impossible de créer compte.", 400);
  }
});

// ====== LOGIN GLOBAL ======
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return error(res, "Email et mot de passe requis.");
    
    if (firebaseBackend && typeof firebaseBackend.loginUser === "function") {
      const user = await firebaseBackend.loginUser({ email: email.trim().toLowerCase(), password });
      return success(res, { user }, "Connexion GLOBAL réussie.");
    }
    // Fallback : le frontend va vérifier dans Firestore directement
    return success(res, { needFirestoreCheck: true }, "Vérifie dans Firestore GLOBAL.");
  } catch (err) {
    return error(res, err.message || "Login échoué", 401);
  }
});

// ====== SYNC GLOBAL POUR ADMIN ======
app.post("/api/index.js", async (req, res) => {
  const { action } = req.query;
  if (action === "sync") {
    console.log("SYNC reçu:", req.body);
    return success(res, {}, "Sync reçu GLOBAL FC");
  }
  return success(res, {}, "API index GLOBAL");
});

// Export pour Vercel
module.exports = app;
