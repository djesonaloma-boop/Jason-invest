"use strict";

/*

JASON INVEST — API FINAL PUBLIC
api/index.js
Version complète pour Vercel

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

// FIREBASE
let firebase = null;
try {
  // essaie les 2 chemins
  try { firebase = require("../Backend/firebase"); }
  catch { firebase = require("../backend/firebase"); }
} catch (e) {
  console.warn("Firebase non chargé:", e.message);
}

function success(res, data = {}, message = "OK") {
  return res.status(200).json({ success: true, message,...data });
}
function error(res, message, status = 400) {
  return res.status(status).json({ success: false, message });
}

// Route principale
app.get("/", (req, res) => {
  return success(res, { service: "JASON INVEST API", version: "2.0", status: "online" }, "API opérationnelle");
});

app.get("/api", (req, res) => {
  return success(res, { service: "JASON INVEST", backend: "Firebase", status: "online" }, "API JASON INVEST opérationnelle.");
});

/*

INSCRIPTION

*/
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, phone, email, password, referral } = req.body || {};
    if (!name || name.trim().length < 2) return error(res, "Nom complet requis");
    if (!phone || phone.trim().length < 6) return error(res, "Numéro invalide");
    if (!email) return error(res, "Email obligatoire");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return error(res, "Email invalide");
    if (!password || password.length < 6) return error(res, "Mot de passe 6 caractères minimum");

    if (!firebase || typeof firebase.registerUser !== "function") {
      return error(res, "Firebase non configuré", 500);
    }

    const user = await firebase.registerUser({
      name: name.trim(), phone: phone.trim(),
      email: email.trim().toLowerCase(), password,
      referral: referral? referral.trim(): null
    });

    return success(res, { user }, "Compte créé avec succès");
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return error(res, err.message || "Impossible de créer le compte", 400);
  }
});

/*

CONNEXION

*/
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email) return error(res, "Email obligatoire");
    if (!password) return error(res, "Mot de passe obligatoire");

    if (!firebase || typeof firebase.loginUser !== "function") {
      return error(res, "Firebase non configuré", 500);
    }

    const result = await firebase.loginUser({
      email: email.trim().toLowerCase(), password
    });

    return success(res, result, "Connexion réussie");
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return error(res, err.message || "Email ou mot de passe incorrect", 401);
  }
});

// Alias pour ton frontend qui appelle /api/index.js?action=login
app.post("/api/index.js", async (req, res) => {
  const action = req.query.action || req.body.action;
  if (action === "login") {
    req.url = "/api/auth/login";
    return app._router.handle(req, res);
  }
  if (action === "register") {
    req.url = "/api/auth/register";
    return app._router.handle(req, res);
  }
  // sync etc.
  if (action === "sync") return success(res, {}, "SYNC OK");
  return success(res, {}, "API index active");
});

/*

MOT DE PASSE OUBLIÉ

*/
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return error(res, "Email requis");
    if (!firebase || typeof firebase.forgotPassword !== "function") {
      return error(res, "Firebase non configuré", 500);
    }
    await firebase.forgotPassword(email.trim().toLowerCase());
    return success(res, {}, "Email de récupération envoyé");
  } catch (err) {
    return error(res, err.message || "Impossible de traiter", 400);
  }
});

/*

ROUTES PUBLIC POUR DASHBOARD / HISTORIQUE / FIDELITE

*/
app.get("/api/index.js", async (req, res) => {
  const action = req.query.action;
  if (action === "me") {
    return success(res, { user: null }, "me endpoint - utilisez login");
  }
  if (action === "history" || action === "deposits" || action === "tasks") {
    return success(res, { history: [], deposits: [], tasks: [] }, "Vide pour l'instant - Firestore gère");
  }
  return success(res, { service: "JASON INVEST API" }, "OK");
});

app.post("/api/index.js", async (req, res) => {
  // utilisé par admin.html et dashboard pour sync
  return success(res, { synced: true }, "Sync reçu");
});

// 404
app.use((req, res) => {
  return res.status(404).json({ success: false, message: "Route introuvable", path: req.path });
});

app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);
  return res.status(500).json({ success: false, message: "Erreur serveur" });
});

module.exports = app;
