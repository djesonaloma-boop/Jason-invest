import crypto from "node:crypto";

import {
  initializeApp,
  cert,
  getApps
} from "firebase-admin/app";

import {
  getDatabase
} from "firebase-admin/database";

import {
  FIREBASE_CONFIG,
  FIREBASE_SERVICE_ACCOUNT,
  ADMIN_PASSWORD,
  ADMIN_IDENTIFIER,
  JASON_LIMITS,
  formatFC,
  validateFC,
  isFirebaseConfigured
} from "../backend/firebase.js";

/* =========================================================
   JASON INVEST FC
   API PRINCIPALE
   Firebase Realtime Database
========================================================= */

const ROOT = "jasonInvestFC";
const USERS = `${ROOT}/users`;
const PRODUCTS = `${ROOT}/products`;
const ORDERS = `${ROOT}/orders`;
const RECHARGES = `${ROOT}/recharges`;
const WITHDRAWALS = `${ROOT}/withdrawals`;

const TOKEN_SECRET =
  "JASON-INVEST-FC-2026-KINSHASA";

/* =========================================================
   FIREBASE
========================================================= */

function firebase() {
  if (!isFirebaseConfigured()) {
    const error = new Error(
      "Firebase n'est pas configuré. Vérifiez backend/firebase.js."
    );

    error.status = 503;
    throw error;
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: FIREBASE_SERVICE_ACCOUNT.projectId,
        clientEmail: FIREBASE_SERVICE_ACCOUNT.clientEmail,
        privateKey:
          FIREBASE_SERVICE_ACCOUNT.privateKey.replace(
            /\\n/g,
            "\n"
          )
      }),

      databaseURL:
        FIREBASE_CONFIG.databaseURL
    });
  }

  return getDatabase();
}

/* =========================================================
   RESPONSE JSON
========================================================= */

function json(res, status, data) {
  res.status(status);

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  res.end(JSON.stringify(data));
}

/* =========================================================
   REQUEST BODY
========================================================= */

function body(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", chunk => {
      raw += chunk;
    });

    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        const error = new Error(
          "Corps JSON invalide."
        );

        error.status = 400;
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

/* =========================================================
   HASH MOT DE PASSE
========================================================= */

function hash(
  password,
  salt = crypto
    .randomBytes(16)
    .toString("hex")
) {
  const digest = crypto
    .scryptSync(
      String(password),
      salt,
      64
    )
    .toString("hex");

  return `scrypt$${salt}$${digest}`;
}

/* =========================================================
   VERIFICATION MOT DE PASSE
========================================================= */

function verify(password, stored) {
  if (!stored) {
    return false;
  }

  const value = String(stored);

  /*
   Ancien mot de passe éventuellement
   stocké en clair.
  */
  if (!value.startsWith("scrypt$")) {
    return String(password) === value;
  }

  const parts = value.split("$");

  if (parts.length !== 3) {
    return false;
  }

  const salt = parts[1];
  const digest = parts[2];

  const actual = crypto
    .scryptSync(
      String(password),
      salt,
      64
    )
    .toString("hex");

  const a = Buffer.from(actual, "hex");
  const b = Buffer.from(digest, "hex");

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

/* =========================================================
   NETTOYAGE TELEPHONE
========================================================= */

function cleanPhone(value) {
  return String(value || "")
    .replace(/\D/g, "");
}

/* =========================================================
   CODE PARRAINAGE
========================================================= */

function cleanCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function makeCode() {
  return (
    "JAS-" +
    crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase()
  );
}

async function uniqueCode(db) {
  for (let i = 0; i < 20; i++) {
    const code = makeCode();

    const snapshot = await db
      .ref(USERS)
      .orderByChild("inviteCode")
      .equalTo(code)
      .limitToFirst(1)
      .once("value");

    if (!snapshot.exists()) {
      return code;
    }
  }

  const error = new Error(
    "Impossible de générer un code de parrainage unique."
  );

  error.status = 500;

  throw error;
}

/* =========================================================
   CHEMIN UTILISATEUR
========================================================= */

function userPath(phone) {
  return `${USERS}/${cleanPhone(phone)}`;
}

/* =========================================================
   UTILISATEUR PUBLIC
========================================================= */

function safeUser(user) {
  if (!user) {
    return null;
  }

  const {
    password,
    ...publicUser
  } = user;

  return publicUser;
}

/* =========================================================
   TOKEN
========================================================= */

function token(phone) {
  return crypto
    .createHmac(
      "sha256",
      TOKEN_SECRET
    )
    .update(String(phone))
    .digest("hex");
}

/* =========================================================
   AUTHENTIFICATION UTILISATEUR
========================================================= */

function auth(req) {
  const authorization =
    req.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const receivedToken =
    authorization.slice(7);

  const phone =
    req.headers["x-user-phone"];

  if (!phone) {
    return null;
  }

  const expectedToken =
    token(phone);

  if (receivedToken !== expectedToken) {
    return null;
  }

  return cleanPhone(phone);
}

/* =========================================================
   ERREUR
========================================================= */

function error(message, status = 400) {
  const e = new Error(message);
  e.status = status;
  return e;
}

/* =========================================================
   INSCRIPTION
========================================================= */

async function register(db, data) {
  const phone =
    cleanPhone(data.phone);

  const password =
    String(data.password || "");

  const referral =
    cleanCode(data.referral);

  if (phone.length < 10) {
    throw error(
      "Numéro de téléphone invalide. Utilisez le format +243...",
      400
    );
  }

  if (password.length < 6) {
    throw error(
      "Le mot de passe doit contenir au moins 6 caractères.",
      400
    );
  }

  const ref =
    db.ref(userPath(phone));

  const existing =
    await ref.once("value");

  if (existing.exists()) {
    throw error(
      "Ce numéro est déjà enregistré.",
      409
    );
  }

  let sponsor = null;

  /* =======================================================
     PARRAIN
  ======================================================= */

  if (referral) {
    const snapshot = await db
      .ref(USERS)
      .orderByChild("inviteCode")
      .equalTo(referral)
      .limitToFirst(1)
      .once("value");

    if (!snapshot.exists()) {
      throw error(
        "Code d'invitation introuvable.",
        400
      );
    }

    snapshot.forEach(child => {
      sponsor = child.key;
    });

    if (sponsor === phone) {
      throw error(
        "Auto-parrainage interdit.",
        400
      );
    }
  }

  const inviteCode =
    await uniqueCode(db);

  const now = Date.now();

  const user = {
    phone,
    telephone: phone,

    password: hash(password),

    inviteCode,
    referralCode: inviteCode,

    referralBy:
      sponsor || "DIRECT",

    sponsor:
      sponsor || null,

    solde_principal: 0,
    solde_gains: 0,
    solde_commissions: 0,

    balance: 0,
    solde: 0,
    solde_fc: 0,

    monnaie: "FC",

    points: 0,
    points_fidelite: 0,
    loyaltyPoints: 0,

    count_lvl1: 0,
    count_lvl2: 0,
    count_lvl3: 0,

    totalDepotFC: 0,
    totalRetraitFC: 0,

    totalOrders: 0,
    totalRecharge: 0,

    statut: "actif",
    status: "actif",

    disabled: false,
    bloque: false,

    date_inscription:
      new Date(now).toISOString(),

    createdAt: now
  };

  await ref.set(user);

  /* =======================================================
     BONUS PARRAIN
  ======================================================= */

  if (sponsor) {
    await db
      .ref(
        `${USERS}/${sponsor}/count_lvl1`
      )
      .transaction(value =>
        (Number(value) || 0) + 1
      );

    await db
      .ref(userPath(sponsor))
      .transaction(userData => {
        if (!userData) {
          return userData;
        }

        const bonus = 500;

        userData.solde_commissions =
          Number(
            userData.solde_commissions || 0
          ) + bonus;

        userData.balance =
          Number(
            userData.balance || 0
          ) + bonus;

        userData.solde =
          Number(
            userData.solde || 0
          ) + bonus;

        userData.solde_fc =
          Number(
            userData.solde_fc || 0
          ) + bonus;

        return userData;
      });
  }

  return {
    user: safeUser(user),
    phone,
    token: token(phone),
    monnaie: "FC"
  };
}

/* =========================================================
   CONNEXION
========================================================= */

async function login(db, data) {
  const phone =
    cleanPhone(data.phone);

  const password =
    String(data.password || "");

  const ref =
    db.ref(userPath(phone));

  const snapshot =
    await ref.once("value");

  if (!snapshot.exists()) {
    throw error(
      "Numéro ou mot de passe incorrect.",
      401
    );
  }

  const user =
    snapshot.val();

  if (
    user.disabled === true ||
    user.bloque === true ||
    user.status === "bloqué"
  ) {
    throw error(
      "Compte bloqué.",
      403
    );
  }

  if (
    !verify(
      password,
      user.password
    )
  ) {
    throw error(
      "Numéro ou mot de passe incorrect.",
      401
    );
  }

  /*
   Migration automatique des anciens
   mots de passe vers scrypt.
  */

  if (
    !String(user.password)
      .startsWith("scrypt$")
  ) {
    await ref.update({
      password: hash(password)
    });
  }

  return {
    user: safeUser(user),
    phone,
    token: token(phone),
    monnaie: "FC"
  };
}

/* =========================================================
   CREATION PRODUITS PAR DEFAUT
========================================================= */

async function ensureProducts(db) {
  const ref =
    db.ref(PRODUCTS);

  const snapshot =
    await ref.once("value");

  if (snapshot.exists()) {
    return;
  }

  const products = {};

  for (
    const plan of JASON_LIMITS.PLANS
  ) {
    const id = plan.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    products[id] = {
      id,
      name: plan.name,
      price: plan.min,
      gain: plan.gain,
      duree: plan.duree,
      monnaie: "FC",
      bonusPoints:
        plan.bonusPoints || 0,
      active: true
    };
  }

  await ref.set(products);
}

/* =========================================================
   CREATION COMMANDE
========================================================= */

async function createOrder(db, phone, data) {
  const productId =
    String(data.productId || "")
      .trim();

  if (!productId) {
    throw error(
      "Plan d'investissement manquant.",
      400
    );
  }

  const productSnapshot =
    await db
      .ref(`${PRODUCTS}/${productId}`)
      .once("value");

  if (!productSnapshot.exists()) {
    throw error(
      "Plan d'investissement introuvable.",
      404
    );
  }

  const product =
    productSnapshot.val();

  if (product.active === false) {
    throw error(
      "Ce plan est actuellement désactivé.",
      400
    );
  }

  const userRef =
    db.ref(userPath(phone));

  const userSnapshot =
    await userRef.once("value");

  if (!userSnapshot.exists()) {
    throw error(
      "Utilisateur introuvable.",
      404
    );
  }

  const user =
    userSnapshot.val();

  if (
    user.disabled ||
    user.bloque ||
    user.status === "bloqué"
  ) {
    throw error(
      "Compte bloqué.",
      403
    );
  }

  const price =
    Number(product.price) || 0;

  const balance =
    Number(user.balance || 0);

  if (balance < price) {
    throw error(
      `Solde insuffisant. Il faut ${formatFC(price)}.`,
      400
    );
  }

  const orderId =
    `ORD-${Date.now()}-${crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase()}`;

  const order = {
    id: orderId,
    userId: phone,

    productId,
    productName:
      product.name || productId,

    price,
    gain:
      Number(product.gain) || 0,

    duree:
      Number(product.duree) || 30,

    monnaie: "FC",

    status: "pending",

    createdAt: Date.now(),
    createdAtISO:
      new Date().toISOString()
  };

  await db
    .ref(`${ORDERS}/${orderId}`)
    .set(order);

  return {
    order,
    monnaie: "FC"
  };
}

/* =========================================================
   RECHARGE
========================================================= */

async function createRecharge(
  db,
  phone,
  data
) {
  const amount =
    Number(data.amount);

  const method =
    String(
      data.method ||
      data.paymentMethod ||
      ""
    ).trim();

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw error(
      "Montant de dépôt invalide.",
      400
    );
  }

  if (
    !validateFC(
      amount,
      "depot"
    )
  ) {
    throw error(
      `Dépôt minimum : ${formatFC(
        JASON_LIMITS.DEPOT_MIN_FC
      )}.`,
      400
    );
  }

  const id =
    `DEP-${Date.now()}-${crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase()}`;

  const recharge = {
    id,
    userId: phone,
    amount,
    monnaie: "FC",

    method:
      method || "Non précisé",

    status: "pending",

    createdAt: Date.now(),
    createdAtISO:
      new Date().toISOString()
  };

  await db
    .ref(`${RECHARGES}/${id}`)
    .set(recharge);

  return {
    recharge,
    monnaie: "FC",
    limits: JASON_LIMITS
  };
}

/* =========================================================
   RETRAIT
========================================================= */

async function createWithdrawal(
  db,
  phone,
  data
) {
  const amount =
    Number(data.amount);

  const method =
    String(
      data.method ||
      data.paymentMethod ||
      ""
    ).trim();

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw error(
      "Montant de retrait invalide.",
      400
    );
  }

  if (
    !validateFC(
      amount,
      "retrait"
    )
  ) {
    throw error(
      `Retrait minimum : ${formatFC(
        JASON_LIMITS.RETRAIT_MIN_FC
      )}.`,
      400
    );
  }

  const userSnapshot =
    await db
      .ref(userPath(phone))
      .once("value");

  if (!userSnapshot.exists()) {
    throw error(
      "Utilisateur introuvable.",
      404
    );
  }

  const user =
    userSnapshot.val();

  const balance =
    Number(user.balance || 0);

  if (balance < amount) {
    throw error(
      "Solde insuffisant pour effectuer ce retrait.",
      400
    );
  }

  const id =
    `RET-${Date.now()}-${crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase()}`;

  const withdrawal = {
    id,
    userId: phone,
    amount,
    monnaie: "FC",

    method:
      method || "Non précisé",

    status: "pending",

    createdAt: Date.now(),
    createdAtISO:
      new Date().toISOString()
  };

  await db
    .ref(`${WITHDRAWALS}/${id}`)
    .set(withdrawal);

  return {
    withdrawal,
    monnaie: "FC",
    limits: JASON_LIMITS
  };
}

/* =========================================================
   MAIN
========================================================= */

async function main(req, res) {
  try {
    const path =
      req.url
        .split("?")[0]
        .replace(/\/+$/, "");

    /* =====================================================
       CORS / OPTIONS
    ===================================================== */

    res.setHeader(
      "Access-Control-Allow-Origin",
      "*"
    );

    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-User-Phone, X-Admin-Identifier, X-Admin-Password"
    );

    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PATCH,PUT,OPTIONS"
    );

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    const data =
      ["POST", "PUT", "PATCH"]
        .includes(req.method)
        ? await body(req)
        : {};

    const db = firebase();

    /* =====================================================
       AUTH
    ===================================================== */

    if (
      req.method === "POST" &&
      path === "/api/auth/register"
    ) {
      return json(
        res,
        201,
        await register(db, data)
      );
    }

    if (
      req.method === "POST" &&
      path === "/api/auth/login"
    ) {
      return json(
        res,
        200,
        await login(db, data)
      );
    }

    if (
      req.method === "POST" &&
      path === "/api/auth/logout"
    ) {
      return json(
        res,
        200,
        {
          ok: true,
          monnaie: "FC"
        }
      );
    }

    if (
      req.method === "POST" &&
      path === "/api/auth/reset"
    ) {
      const phone =
        cleanPhone(data.phone);

      const snapshot =
        await db
          .ref(userPath(phone))
          .once("value");

      if (!snapshot.exists()) {
        throw error(
          "Compte introuvable.",
          404
        );
      }

      return json(
        res,
        200,
        {
          ok: true,
          message:
            "Demande reçue. Contactez l'administrateur JASON INVEST."
        }
      );
    }

    /* =====================================================
       AUTH USER
    ===================================================== */

    const phone =
      auth(req);

    /* =====================================================
       PRODUITS PUBLICS
    ===================================================== */

    if (
      req.method === "GET" &&
      path === "/api/products"
    ) {
      await ensureProducts(db);

      const snapshot =
        await db
          .ref(PRODUCTS)
          .once("value");

      return json(
        res,
        200,
        {
          products:
            snapshot.val() || {},

          monnaie: "FC",

          limits: JASON_LIMITS
        }
      );
    }

    /* =====================================================
       ROUTES NECESSITANT UNE SESSION
    ===================================================== */

    if (!phone) {
      return json(
        res,
        401,
        {
          error:
            "Session invalide ou absente."
        }
      );
    }

    /* =====================================================
       PROFIL
    ===================================================== */

    if (
      req.method === "GET" &&
      path === "/api/me"
    ) {
      const snapshot =
        await db
          .ref(userPath(phone))
          .once("value");

      if (!snapshot.exists()) {
        return json(
          res,
          404,
          {
            error:
              "Utilisateur introuvable."
          }
        );
      }

      return json(
        res,
        200,
        {
          user:
            safeUser(snapshot.val()),

          monnaie: "FC",

          limits: JASON_LIMITS
        }
      );
    }

    /* =====================================================
       COMMANDES
    ===================================================== */

    if (
      req.method === "POST" &&
      path === "/api/orders"
    ) {
      return json(
        res,
        201,
        await createOrder(
          db,
          phone,
          data
        )
      );
    }

    if (
      req.method === "GET" &&
      path === "/api/orders"
    ) {
      const snapshot =
        await db
          .ref(ORDERS)
          .orderByChild("userId")
          .equalTo(phone)
          .once("value");

      return json(
        res,
        200,
        {
          orders:
            snapshot.val() || {},

          monnaie: "FC"
        }
      );
    }

    /* =====================================================
       DEPOT
    ===================================================== */

    if (
      req.method === "POST" &&
      path === "/api/recharges"
    ) {
      return json(
        res,
        201,
        await createRecharge(
          db,
          phone,
          data
        )
      );
    }

    if (
      req.method === "GET" &&
      path === "/api/recharges"
    ) {
      const snapshot =
        await db
          .ref(RECHARGES)
          .orderByChild("userId")
          .equalTo(phone)
          .once("value");

      return json(
        res,
        200,
        {
          recharges:
            snapshot.val() || {},

          monnaie: "FC",

          limits: JASON_LIMITS
        }
      );
    }

    /* =====================================================
       RETRAIT
    ===================================================== */

    if (
      req.method === "POST" &&
      path === "/api/withdrawals"
    ) {
      return json(
        res,
        201,
        await createWithdrawal(
          db,
          phone,
          data
        )
      );
    }

    if (
      req.method === "GET" &&
      path === "/api/withdrawals"
    ) {
      const snapshot =
        await db
          .ref(WITHDRAWALS)
          .orderByChild("userId")
          .equalTo(phone)
          .once("value");

      return json(
        res,
        200,
        {
          withdrawals:
            snapshot.val() || {},

          monnaie: "FC",

          limits: JASON_LIMITS
        }
      );
    }

    /* =====================================================
       PARRAINAGE
    ===================================================== */

    if (
      req.method === "GET" &&
      path === "/api/referrals"
    ) {
      const userSnapshot =
        await db
          .ref(userPath(phone))
          .once("value");

      if (!userSnapshot.exists()) {
        throw error(
          "Utilisateur introuvable.",
          404
        );
      }

      const user =
        userSnapshot.val();

      const snapshot =
        await db
          .ref(USERS)
          .once("value");

      const allUsers =
        snapshot.val() || {};

      const members =
        Object.entries(allUsers)
          .filter(
            ([, member]) =>
              member &&
              (
                member.sponsor === phone ||
                member.referralBy === phone
              )
          )
          .map(
            ([id, member]) => ({
              id,
              phone: member.phone,
              date_inscription:
                member.date_inscription,
              statut:
                member.statut || "actif"
            })
          );

      return json(
        res,
        200,
        {
          inviteCode:
            user.inviteCode || null,

          members,

          count:
            members.length,

          monnaie: "FC"
        }
      );
    }

    /* =====================================================
       POINTS
    ===================================================== */

    if (
      req.method === "GET" &&
      path === "/api/points"
    ) {
      const snapshot =
        await db
          .ref(userPath(phone))
          .once("value");

      if (!snapshot.exists()) {
        throw error(
          "Utilisateur introuvable.",
          404
        );
      }

      const user =
        snapshot.val();

      const points =
        Number(
          user.points ||
          user.points_fidelite ||
          user.loyaltyPoints ||
          0
        );

      return json(
        res,
        200,
        {
          points,
          valeurFC: points,
          monnaie: "FC"
        }
      );
    }

    /* =====================================================
       CONVERSION POINTS
       1 point = 1 FC
    ===================================================== */

    if (
      req.method === "POST" &&
      path === "/api/points/convert"
    ) {
      const amount =
        Math.floor(
          Number(data.points) || 0
        );

      if (amount <= 0) {
        throw error(
          "Nombre de points invalide.",
          400
        );
      }

      const ref =
        db.ref(userPath(phone));

      let converted = 0;

      await ref.transaction(user => {
        if (!user) {
          return user;
        }

        const points =
          Number(
            user.points ||
            user.points_fidelite ||
            user.loyaltyPoints ||
            0
          );

        if (
          amount > points
        ) {
          return;
        }

        converted = amount;

        const remaining =
          points - amount;

        user.points =
          remaining;

        user.points_fidelite =
          remaining;

        user.loyaltyPoints =
          remaining;

        user.balance =
          Number(user.balance || 0)
          + amount;

        user.solde =
          Number(user.solde || 0)
          + amount;

        user.solde_fc =
          Number(user.solde_fc || 0)
          + amount;

        return user;
      });

      if (!converted) {
        throw error(
          "Conversion impossible.",
          400
        );
      }

      return json(
        res,
        200,
        {
          ok: true,
          converted,
          montant:
            formatFC(converted),
          monnaie: "FC"
        }
      );
    }

    /* =====================================================
       ADMIN AUTH
    ===================================================== */

    const adminIdentifier =
      String(
        req.headers[
          "x-admin-identifier"
        ] || ""
      ).trim();

    const adminPassword =
      String(
        req.headers[
          "x-admin-password"
        ] || ""
      );

    if (
      path.startsWith("/api/admin/")
    ) {
      if (
        adminIdentifier !==
          ADMIN_IDENTIFIER ||
        !ADMIN_PASSWORD ||
        adminPassword !==
          ADMIN_PASSWORD
      ) {
        return json(
          res,
          403,
          {
            error:
              "Accès administrateur refusé."
          }
        );
      }
    }

    /* =====================================================
       ADMIN — UTILISATEURS
    ===================================================== */

    if (
      req.method === "GET" &&
      path === "/api/admin/users"
    ) {
      const snapshot =
        await db
          .ref(USERS)
          .once("value");

      const users =
        snapshot.val() || {};

      return json(
        res,
        200,
        {
          users:
            Object.fromEntries(
              Object.entries(users)
                .map(
                  ([id, user]) => [
                    id,
                    safeUser(user)
                  ]
                )
            ),

          monnaie: "FC"
        }
      );
    }

    /* =====================================================
       ADMIN — COMMANDES
    ===================================================== */

    if (
      req.method === "GET" &&
      path === "/api/admin/orders"
    ) {
      const snapshot =
        await db
          .ref(ORDERS)
          .once("value");

      return json(
        res,
        200,
        {
          orders:
            snapshot.val() || {},

          monnaie: "FC"
        }
      );
    }

    /* =====================================================
       ADMIN — DEPOTS
    ===================================================== */

    if (
      req.method === "GET" &&
      path === "/api/admin/recharges"
    ) {
      const snapshot =
        await db
          .ref(RECHARGES)
          .once("value");

      return json(
        res,
        200,
        {
          recharges:
            snapshot.val() || {},

          monnaie: "FC",

          limits: JASON_LIMITS
        }
      );
    }

    /* =====================================================
       ADMIN — RETRAITS
    ===================================================== */

    if (
      req.method === "GET" &&
      path === "/api/admin/withdrawals"
    ) {
      const snapshot =
        await db
          .ref(WITHDRAWALS)
          .once("value");

      return json(
        res,
        200,
        {
          withdrawals:
            snapshot.val() || {},

          monnaie: "FC",

          limits: JASON_LIMITS
        }
      );
    }

    /* =====================================================
       ADMIN — ACCEPTER / REFUSER COMMANDE
    ===================================================== */

    if (
      req.method === "PATCH" &&
      path.startsWith(
        "/api/admin/orders/"
      )
    ) {
      const id =
        decodeURIComponent(
          path.split("/").pop()
        );

      const ref =
        db.ref(`${ORDERS}/${id}`);

      const snapshot =
        await ref.once("value");

      if (!snapshot.exists()) {
        throw error(
          "Commande introuvable.",
          404
        );
      }

      const order =
        snapshot.val();

      const newStatus =
        String(
          data.status || ""
        ).toLowerCase();

      if (
        ![
          "accepted",
          "rejected",
          "pending"
        ].includes(newStatus)
      ) {
        throw error(
          "Statut de commande invalide.",
          400
        );
      }

      if (
        newStatus === "accepted" &&
        order.status === "pending"
      ) {
        const userRef =
          db.ref(
            userPath(order.userId)
          );

        await userRef.transaction(
          user => {
            if (!user) {
              return user;
            }

            const price =
              Number(
                order.price || 0
              );

            const balance =
              Number(
                user.balance || 0
              );

            if (
              balance < price
            ) {
              return;
            }

            user.balance =
              balance - price;

            user.solde =
              Number(user.solde || 0)
              - price;

            user.solde_fc =
              Number(user.solde_fc || 0)
              - price;

            user.totalOrders =
              Number(
                user.totalOrders || 0
              ) + 1;

            return user;
          }
        );

        await ref.update({
          status: "accepted",
          acceptedAt: Date.now()
        });
      } else {
        await ref.update({
          status: newStatus
        });
      }

      return json(
        res,
        200,
        {
          ok: true,
          monnaie: "FC"
        }
      );
    }

    /* =====================================================
       ADMIN — DEPOTS
    ===================================================== */

    if (
      req.method === "PATCH" &&
      path.startsWith(
        "/api/admin/recharges/"
      )
    ) {
      const id =
        decodeURIComponent(
          path.split("/").pop()
        );

      const ref =
        db.ref(
          `${RECHARGES}/${id}`
        );

      const snapshot =
        await ref.once("value");

      if (!snapshot.exists()) {
        throw error(
          "Dépôt introuvable.",
          404
        );
      }

      const recharge =
        snapshot.val();

      const newStatus =
        String(
          data.status || ""
        ).toLowerCase();

      if (
        ![
          "accepted",
          "rejected",
          "pending"
        ].includes(newStatus)
      ) {
        throw error(
          "Statut de dépôt invalide.",
          400
        );
      }

      /*
       Créditer uniquement lors du
       passage pending -> accepted.
      */

      if (
        newStatus === "accepted" &&
        recharge.status === "pending"
      ) {
        const userRef =
          db.ref(
            userPath(
              recharge.userId
            )
          );

        await userRef.transaction(
          user => {
            if (!user) {
              return user;
            }

            const amount =
              Number(
                recharge.amount || 0
              );

            user.balance =
              Number(user.balance || 0)
              + amount;

            user.solde =
              Number(user.solde || 0)
              + amount;

            user.solde_fc =
              Number(user.solde_fc || 0)
              + amount;

            user.solde_principal =
              Number(
                user.solde_principal || 0
              ) + amount;

            user.totalRecharge =
              Number(
                user.totalRecharge || 0
              ) + amount;

            user.totalDepotFC =
              Number(
                user.totalDepotFC || 0
              ) + amount;

            /*
             10 points par tranche
             de 1 000 FC.
            */

            const points =
              Math.floor(
                amount / 1000
              ) * 10;

            user.points =
              Number(
                user.points || 0
              ) + points;

            user.points_fidelite =
              user.points;

            user.loyaltyPoints =
              user.points;

            return user;
          }
        );

        await ref.update({
          status: "accepted",
          acceptedAt: Date.now()
        });
      } else {
        await ref.update({
          status: newStatus
        });
      }

      return json(
        res,
        200,
        {
          ok: true,
          monnaie: "FC"
        }
      );
    }

    /* =====================================================
       ADMIN — RETRAITS
    ===================================================== */

    if (
      req.method === "PATCH" &&
      path.startsWith(
        "/api/admin/withdrawals/"
      )
    ) {
      const id =
        decodeURIComponent(
          path.split("/").pop()
        );

      const ref =
        db.ref(
          `${WITHDRAWALS}/${id}`
        );

      const snapshot =
        await ref.once("value");

      if (!snapshot.exists()) {
        throw error(
          "Retrait introuvable.",
          404
        );
      }

      const withdrawal =
        snapshot.val();

      const newStatus =
        String(
          data.status || ""
        ).toLowerCase();

      if (
        ![
          "accepted",
          "rejected",
          "pending"
        ].includes(newStatus)
      ) {
        throw error(
          "Statut de retrait invalide.",
          400
        );
      }

      if (
        newStatus === "accepted" &&
        withdrawal.status === "pending"
      ) {
        const userRef =
          db.ref(
            userPath(
              withdrawal.userId
            )
          );

        await userRef.transaction(
          user => {
            if (!user) {
              return user;
            }

            const amount =
              Number(
                withdrawal.amount || 0
              );

            const balance =
              Number(
                user.balance || 0
              );

            if (
              balance < amount
            ) {
              return;
            }

            user.balance =
              balance - amount;

            user.solde =
              Math.max(
                0,
                Number(
                  user.solde || 0
                ) - amount
              );

            user.solde_fc =
              Math.max(
                0,
                Number(
                  user.solde_fc || 0
                ) - amount
              );

            user.totalRetraitFC =
              Number(
                user.totalRetraitFC || 0
              ) + amount;

            return user;
          }
        );

        await ref.update({
          status: "accepted",
          acceptedAt: Date.now()
        });
      } else {
        await ref.update({
          status: newStatus
        });
      }

      return json(
        res,
        200,
        {
          ok: true,
          monnaie: "FC"
        }
      );
    }

    /* =====================================================
       ADMIN — UTILISATEUR
    ===================================================== */

    if (
      req.method === "PATCH" &&
      path.startsWith(
        "/api/admin/users/"
      )
    ) {
      const id =
        decodeURIComponent(
          path.split("/").pop()
        );

      const ref =
        db.ref(userPath(id));

      const snapshot =
        await ref.once("value");

      if (!snapshot.exists()) {
        throw error(
          "Utilisateur introuvable.",
          404
        );
      }

      if (
        data.action === "delete"
      ) {
        await ref.remove();

        return json(
          res,
          200,
          {
            ok: true,
            monnaie: "FC"
          }
        );
      }

      if (
        data.patch &&
        typeof data.patch === "object"
      ) {
        await ref.update(
          data.patch
        );
      }

      return json(
        res,
        200,
        {
          ok: true,
          monnaie: "FC"
        }
      );
    }

    /* =====================================================
       ROUTE INEXISTANTE
    ===================================================== */

    return json(
      res,
      404,
      {
        error:
          "Route FC introuvable."
      }
    );

  } catch (e) {
    console.error(
      "JASON INVEST API ERROR:",
      e
    );

    return json(
      res,
      e.status || 500,
      {
        error:
          e.message ||
          "Erreur serveur FC."
      }
    );
  }
}

/* =========================================================
   EXPORT VERCEL
========================================================= */

export default main;
