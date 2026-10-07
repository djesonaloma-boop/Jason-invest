"use strict";

/*
=========================================================
JASON INVEST — API FINAL PUBLIC
Api/index.js
Version Vercel
=========================================================
*/

const express = require("express");
const app = express();

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true
  })
);

/* ======================================================
   CORS
====================================================== */

app.use((req, res, next) => {

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();

});

/* ======================================================
   FIREBASE
====================================================== */

let firebase = null;

try {

  firebase = require(
    "../Backend/firebase/firebase.js"
  );

  if (
    firebase &&
    firebase.default
  ) {

    firebase = {
      ...firebase.default,
      ...firebase
    };

  }

  console.log(
    "Firebase backend chargé."
  );

} catch (error) {

  console.error(
    "Firebase non chargé :",
    error.message
  );

}

/* ======================================================
   RÉPONSES API
====================================================== */

function success(
  res,
  data = {},
  message = "OK"
) {

  return res.status(200).json({

    success: true,

    message,

    ...data

  });

}

function error(
  res,
  message,
  status = 400
) {

  return res.status(status).json({

    success: false,

    message

  });

}

/* ======================================================
   ROUTE PRINCIPALE
====================================================== */

app.get("/", (req, res) => {

  return success(
    res,
    {
      service: "JASON INVEST API",
      version: "2.1",
      status: "online"
    },
    "API JASON INVEST opérationnelle."
  );

});

/* ======================================================
   API STATUS
====================================================== */

app.get("/api", (req, res) => {

  return success(
    res,
    {
      service: "JASON INVEST",
      backend: "Firebase",
      status: "online"
    },
    "API JASON INVEST opérationnelle."
  );

});

/* ======================================================
   INSCRIPTION
====================================================== */

app.post(
  "/api/auth/register",
  async (req, res) => {

    try {

      const {
        name,
        phone,
        email,
        password,
        referral
      } = req.body || {};

      if (
        !name ||
        name.trim().length < 2
      ) {

        return error(
          res,
          "Nom complet requis."
        );

      }

      if (
        !phone ||
        phone.trim().length < 6
      ) {

        return error(
          res,
          "Numéro de téléphone invalide."
        );

      }

      if (!email) {

        return error(
          res,
          "Email obligatoire."
        );

      }

      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (
        !emailRegex.test(
          email.trim()
        )
      ) {

        return error(
          res,
          "Email invalide."
        );

      }

      if (
        !password ||
        password.length < 6
      ) {

        return error(
          res,
          "Mot de passe de 6 caractères minimum."
        );

      }

      if (
        !firebase ||
        typeof firebase.registerUser !==
        "function"
      ) {

        return error(
          res,
          "Firebase non configuré.",
          500
        );

      }

      const user =
        await firebase.registerUser({

          name: name.trim(),

          phone: phone.trim(),

          email:
            email.trim().toLowerCase(),

          password,

          referral:
            referral
              ? referral.trim()
              : null

        });

      return success(
        res,
        { user },
        "Compte créé avec succès."
      );

    } catch (err) {

      console.error(
        "REGISTER ERROR:",
        err
      );

      return error(
        res,
        err.message ||
        "Impossible de créer le compte.",
        400
      );

    }

  }
);
