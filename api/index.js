import crypto from "node:crypto";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { FIREBASE_CONFIG, FIREBASE_SERVICE_ACCOUNT, ADMIN_PASSWORD, isFirebaseConfigured } from "../backend/firebase.js";

function firebase(){
  if(!isFirebaseConfigured()){
    const e=new Error("Firebase non configuré"); e.status=503; throw e;
  }
  if(!getApps().length){
    initializeApp({
      credential: cert({
        projectId: FIREBASE_SERVICE_ACCOUNT.projectId,
        clientEmail: FIREBASE_SERVICE_ACCOUNT.clientEmail,
        privateKey: FIREBASE_SERVICE_ACCOUNT.privateKey.replace(/\\n/g, "\n")
      }),
      databaseURL: FIREBASE_CONFIG.databaseURL
    });
  }
  return getDatabase();
}

const ROOT="jasonInvestFC";
const USERS=`${ROOT}/users`;
const ADMIN_EMAIL="admin@jasoninvest.com";
const TOKEN_SECRET="JASON-INVEST-FC-2026-KINSHASA";
const LIMITS={ DEPOT_MIN: 20000, RETRAIT_MIN: 10000, MONNAIE: "FC" };

function json(res,status,data){ res.status(status).setHeader("Content-Type","application/json; charset=utf-8"); res.end(JSON.stringify(data)); }
function body(req){ return new Promise((resolve,reject)=>{ let raw=""; req.on("data",c=>raw+=c); req.on("end",()=>{ try{ resolve(raw?JSON.parse(raw):{});}catch(e){reject(e);}}); req.on("error",reject); }); }
function hash(p,s=crypto.randomBytes(16).toString("hex")){ const d=crypto.scryptSync(String(p),s,64).toString("hex"); return `scrypt$${s}$${d}`; }
function verify(p,stored){ if(!stored) return false; if(!String(stored).startsWith("scrypt$")) return String(p)===String(stored); const [,s,d]=String(stored).split("$"); const a=crypto.scryptSync(String(p),s,64).toString("hex"); return crypto.timingSafeEqual(Buffer.from(a,"hex"),Buffer.from(d,"hex")); }
function token(phone){ return crypto.createHmac("sha256",TOKEN_SECRET).update(String(phone)).digest("hex"); }
function auth(req){ const h=req.headers.authorization||""; if(!h.startsWith("Bearer ")) return null; const t=h.slice(7); const phone=req.headers["x-user-phone"]; if(!phone||t!==token(phone)) return null; return String(phone); }
function cleanPhone(v){ return String(v||"").replace(/\D/g,""); }
function cleanCode(v){ return String(v||"").trim().toUpperCase(); }
function makeCode(){ return "JAS-"+crypto.randomBytes(3).toString("hex").toUpperCase(); }
async function uniqueCode(db){ for(let i=0;i<20;i++){ const c=makeCode(); const s=await db.ref(USERS).orderByChild("inviteCode").equalTo(c).once("value"); if(!s.exists()) return c; } throw new Error("Code FC impossible"); }
function safeUser(u){ if(!u) return null; const {password,...r}=u; return r; }
function userPath(phone){ return `${USERS}/${cleanPhone(phone)}`; }

async function register(db,d){
  const phone=cleanPhone(d.phone); const password=String(d.password||""); const referral=cleanCode(d.referral);
  if(phone.length<10) throw Object.assign(new Error("Numéro FC invalide"),{status:400});
  if(password.length<6) throw Object.assign(new Error("Mot de passe 6 min"),{status:400});
  const ref=db.ref(userPath(phone)); const ex=await ref.once("value"); if(ex.exists()) throw Object.assign(new Error("Numéro déjà enregistré"),{status:409});
  let sponsor=null; if(referral){ const snap=await db.ref(USERS).orderByChild("inviteCode").equalTo(referral).limitToFirst(1).once("value"); if(!snap.exists()) throw Object.assign(new Error("Code invit FC introuvable"),{status:400}); snap.forEach(x=>sponsor=x.key); }
  const inviteCode=await uniqueCode(db); const now=Date.now();
  const user={ telephone:phone, phone, password:hash(password), inviteCode, referralCode:inviteCode, referredBy:sponsor||"DIRECT", sponsor:sponsor||null, solde_principal:0, solde_gains:0, solde_commissions:0, solde:0, balance:0, solde_fc:0, monnaie:"FC", points_fidelite:0, points:0, loyaltyPoints:0, count_lvl1:0, count_lvl2:0, count_lvl3:0, totalDepotFC:0, totalRetraitFC:0, statut:"actif", status:"actif", disabled:false, bloque:false, date_inscription:new Date(now).toISOString(), createdAt:now };
  await ref.set(user);
  if(sponsor){ await db.ref(`${USERS}/${sponsor}/count_lvl1`).transaction(v=>(Number(v)||0)+1); await db.ref(userPath(sponsor)).transaction(u=>{ if(!u) return u; u.solde_commissions=Number(u.solde_commissions||0)+500; u.balance=Number(u.balance||0)+500; u.solde=Number(u.solde||0)+500; u.solde_fc=Number(u.solde_fc||0)+500; return u; }); }
  return {user:safeUser(user), phone, token:token(phone), monnaie:"FC"};
}
async function login(db,d){
  const phone=cleanPhone(d.phone), password=String(d.password||""); const ref=db.ref(userPath(phone)), snap=await ref.once("value");
  if(!snap.exists()) throw Object.assign(new Error("Numéro ou mot de passe incorrect"),{status:401});
  const u=snap.val(); if(u.disabled||u.bloque) throw Object.assign(new Error("Compte bloqué"),{status:403});
  if(!verify(password,u.password)) throw Object.assign(new Error("Numéro ou mot de passe incorrect"),{status:401});
  return {user:safeUser(u), phone, token:token(phone), monnaie:"FC"};
}

async function main(req,res){
  try{
    const path=req.url.split("?")[0].replace(/\/+$/,""); if(req.method==="OPTIONS"){ res.status(204).end(); return; }
    const d=["POST","PUT","PATCH"].includes(req.method)?await body(req):{}; const db=firebase();
    if(req.method==="POST"&&path==="/api/auth/register") return json(res,201,await register(db,d));
    if(req.method==="POST"&&path==="/api/auth/login") return json(res,200,await login(db,d));
    if(req.method==="POST"&&path==="/api/auth/logout") return json(res,200,{ok:true});
    if(req.method==="POST"&&path==="/api/auth/reset") return json(res,200,{ok:true, message:"Contact admin"});
    const phone=auth(req); if(!phone) return json(res,401,{error:"Session invalide FC"});
    if(req.method==="GET"&&path==="/api/me"){ const s=await db.ref(userPath(phone)).once("value"); if(!s.exists()) return json(res,404,{error:"User introuvable"}); return json(res,200,{user:safeUser(s.val()), monnaie:"FC", limits:LIMITS}); }
    if(req.method==="GET"&&path==="/api/products"){ const s=await db.ref(`${ROOT}/products`).once("value"); return json(res,200,{products:s.val()||{}, monnaie:"FC"}); }
    if(req.method==="POST"&&path==="/api/orders"){
      const p=await db.ref(`${ROOT}/products/${d.productId}`).once("value"); if(!p.exists()) throw Object.assign(new Error("Plan introuvable"),{status:404});
      const u=(await db.ref(userPath(phone)).once("value")).val(); const price=Number(p.val().price)||0;
      if(Number(u.balance||0)<price) throw Object.assign(new Error(`Solde insuffisant: ${price} FC`),{status:400});
      const order={userId:phone, productId:d.productId, product:p.val().name||"", price, status:"pending", date:Date.now(), monnaie:"FC"};
      const key=db.ref(`${ROOT}/orders`).push().key; await db.ref(`${ROOT}/orders/${key}`).set(order); return json(res,201,{orderId:key, order});
    }
    if(req.method==="GET"&&path==="/api/orders"){ const s=await db.ref(`${ROOT}/orders`).once("value"); const all=s.val()||{}; const mine=Object.fromEntries(Object.entries(all).filter(([,o])=>o.userId===phone)); return json(res,200,{orders:mine}); }
    if(req.method==="POST"&&path==="/api/recharges"){
      const amount=Number(d.amount); if(!amount||amount<LIMITS.DEPOT_MIN) throw Object.assign(new Error(`Dépôt min ${LIMITS.DEPOT_MIN} FC`),{status:400});
      const u=(await db.ref(userPath(phone)).once("value")).val(); const key=db.ref(`${ROOT}/recharges`).push().key;
      const item={userId:phone, userName:u.name||phone, amount, transactionId:String(d.transactionId||""), method:String(d.method||"Orange Money"), status:"pending", date:Date.now(), monnaie:"FC"};
      await db.ref(`${ROOT}/recharges/${key}`).set(item); return json(res,201,{id:key,item});
    }
    if(req.method==="POST"&&path==="/api/withdrawals"){
      const amount=Number(d.amount); if(!amount||amount<LIMITS.RETRAIT_MIN) throw Object.assign(new Error(`Retrait min ${LIMITS.RETRAIT_MIN} FC`),{status:400});
      const u=(await db.ref(userPath(phone)).once("value")).val(); if(Number(u.balance||0)<amount) throw Object.assign(new Error("Solde insuffisant"),{status:400});
      const key=db.ref(`${ROOT}/withdrawals`).push().key; const item={userId:phone, amount, method:String(d.method||""), wallet:String(d.wallet||""), status:"pending", date:Date.now(), monnaie:"FC"};
      await db.ref(`${ROOT}/withdrawals/${key}`).set(item); return json(res,201,{id:key,item});
    }
    if(req.method==="GET"&&path==="/api/team"){ const all=(await db.ref(USERS).once("value")).val()||{}; const members=Object.values(all).filter(u=>u.sponsor===phone); return json(res,200,{members}); }

    const adminH=req.headers["x-admin-email"]; const adminP=req.headers["x-admin-password"];
    if(path.startsWith("/api/admin/")){ if(adminH!==ADMIN_EMAIL||adminP!==ADMIN_PASSWORD) return json(res,403,{error:"Admin refusé"}); }
    if(req.method==="GET"&&path==="/api/admin/users"){ const users=(await db.ref(USERS).once("value")).val()||{}; return json(res,200,{users:Object.fromEntries(Object.entries(users).map(([k,v])=>[k,safeUser(v)]))}); }
    if(req.method==="GET"&&path==="/api/admin/recharges") return json(res,200,{recharges:(await db.ref(`${ROOT}/recharges`).once("value")).val()||{}});
    if(req.method==="GET"&&path==="/api/admin/withdrawals") return json(res,200,{withdrawals:(await db.ref(`${ROOT}/withdrawals`).once("value")).val()||{}});
    if(req.method==="GET"&&path==="/api/admin/orders") return json(res,200,{orders:(await db.ref(`${ROOT}/orders`).once("value")).val()||{}});
    if(req.method==="PATCH"&&path.startsWith("/api/admin/recharges/")){
      const id=path.split("/").pop(); const s=await db.ref(`${ROOT}/recharges/${id}`).once("value"); if(!s.exists()) return json(res,404,{error:"Recharge introuvable"});
      const r=s.val(); await db.ref(`${ROOT}/recharges/${id}`).update({status:d.status});
      if(d.status==="accepted"&&r.status==="pending"){ await db.ref(userPath(r.userId)).transaction(u=>{ if(!u) return u; u.balance=Number(u.balance||0)+Number(r.amount||0); u.solde=Number(u.solde||0)+Number(r.amount||0); u.solde_fc=Number(u.solde_fc||0)+Number(r.amount||0); u.totalDepotFC=Number(u.totalDepotFC||0)+Number(r.amount||0); return u; }); }
      return json(res,200,{ok:true});
    }
    if(req.method==="PATCH"&&path.startsWith("/api/admin/withdrawals/")){
      const id=path.split("/").pop(); const s=await db.ref(`${ROOT}/withdrawals/${id}`).once("value"); if(!s.exists()) return json(res,404,{error:"Retrait introuvable"});
      const w=s.val(); await db.ref(`${ROOT}/withdrawals/${id}`).update({status:d.status});
      if(d.status==="accepted"&&w.status==="pending"){ await db.ref(userPath(w.userId)).transaction(u=>{ if(!u) return u; u.balance=Math.max(0,Number(u.balance||0)-Number(w.amount||0)); u.solde=Math.max(0,Number(u.solde||0)-Number(w.amount||0)); return u; }); }
      return json(res,200,{ok:true});
    }
    if(req.method==="PATCH"&&path.startsWith("/api/admin/orders/")){ const id=path.split("/").pop(); await db.ref(`${ROOT}/orders/${id}`).update({status:d.status}); return json(res,200,{ok:true}); }
    return json(res,404,{error:"Route introuvable"});
  }catch(e){ console.error(e); return json(res,e.status||500,{error:e.message||"Erreur FC"}); }
}
export default main;
