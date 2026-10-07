/* =========================================================
   JASON INVEST — APP.JS CENTRAL - VERSION TRAVAIL EN LIGNE PUBLIC
   api/index.js + backend/firebase.js + racine
   ========================================================= */
"use strict";

const JASON_APP = {
    name: "JASON INVEST",
    apiBase: "/api/index.js", // <-- TA STRUCTURE DEMANDÉE
    currency: "FC",
    pages: {
        index: "index.html",
        dashboard: "dashboard.html",
        investissement: "investissement.html",
        activites: "activites.html",
        fidelite: "fidelite.html",
        parrainage: "parrainage.html",
        historique: "historique.html",
        notification: "notification.html",
        profil: "profil.html",
        support: "support.html"
    }
};

const App = {
    get(id){ return document.getElementById(id); },
    qs(s){ return document.querySelector(s); },
    qsa(s){ return document.querySelectorAll(s); },
    formatMoney(v){ return new Intl.NumberFormat("fr-FR").format(Number(v)||0)+" "+JASON_APP.currency; },
    formatDate(d){ if(!d) return "—"; const x=new Date(d); return isNaN(x)? "—" : x.toLocaleDateString("fr-FR"); },
    formatDateTime(d){ if(!d) return "—"; const x=new Date(d); return isNaN(x)? "—" : x.toLocaleString("fr-FR"); },
    showMessage(m,t="info"){
        let box=this.get("appMessage");
        if(!box){ box=document.createElement("div"); box.id="appMessage"; box.style.position="fixed"; box.style.left="20px"; box.style.right="20px"; box.style.bottom="20px"; box.style.zIndex="99999"; box.style.padding="15px 18px"; box.style.borderRadius="14px"; box.style.fontWeight="700"; box.style.textAlign="center"; document.body.appendChild(box); }
        box.textContent=m;
        box.style.background=t==="success"?"#173d2c":t==="error"?"#4a1d24":"#18283d";
        box.style.color=t==="success"?"#9df2bd":t==="error"?"#ffb4bd":"#fff";
        clearTimeout(box._timer); box._timer=setTimeout(()=>box.remove(),3500);
    },
    go(page){ if(JASON_APP.pages[page]) location.href=JASON_APP.pages[page]; }
};

/* =========================================================
   API CENTRAL - VERSION PUBLIC POUR TRAVAIL EN LIGNE
   1. api/index.js 2. backend/firebase.js 3. localStorage
   ========================================================= */
const API = {
    async request(endpoint, options={}){
        // 1. Essaie api/index.js PUBLIC
        try{
            const url = endpoint.startsWith("?")? `${JASON_APP.apiBase}${endpoint}` : `${JASON_APP.apiBase}?action=${endpoint.replace('/','')}`;
            const r = await fetch(url, {headers:{"Content-Type":"application/json"},...options});
            if(r.ok){ const d=await r.json(); if(d && Object.keys(d).length) return d; }
        }catch{}

        // 2. Essaie backend/firebase.js
        try{
            const { db } = await import("./backend/firebase.js");
            const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            const snap = await getDocs(collection(db, endpoint.replace('/','')));
            if(!snap.empty) return {data: snap.docs.map(x=>x.data())};
        }catch{}

        // 3. Fallback localStorage (ton ancien mode TrebEdit)
        const key = "jason_"+endpoint.replace('/','').replace('user/me','current');
        const local = localStorage.getItem(key);
        if(local){ try{ return {data: JSON.parse(local)}; }catch{} }
        if(endpoint.includes("user/me")){
            const cur = localStorage.getItem('jason_current');
            if(cur) return {user: JSON.parse(cur)};
        }
        throw new Error("API offline - mode local");
    },
    async me(){
        try{ return await this.request("/user/me"); }
        catch{
            const cur = localStorage.getItem('jason_current');
            if(cur) return {user: JSON.parse(cur)};
            throw new Error("Non connecté");
        }
    },
    async dashboard(){
        try{ return await this.request("/dashboard"); }
        catch{
            const users = JSON.parse(localStorage.getItem('jason_users')||'[]');
            const deposits = JSON.parse(localStorage.getItem('jason_deposits')||'[]');
            return {data:{balance: users[0]?.solde||0, points:0, referrals:0, vip:"Bronze", total: deposits.length}};
        }
    },
    async investments(){ return this.request("/investments").catch(()=>({investments: JSON.parse(localStorage.getItem('jason_plans')||'[]')})); },
    async activities(){ return this.request("/activities").catch(()=>({activities: JSON.parse(localStorage.getItem('jason_activities')||'[]')})); },
    async fidelity(){ return this.request("/fidelity").catch(()=>({data:{points:0,vip:"Bronze"}})); },
    async referral(){
        const cur = JSON.parse(localStorage.getItem('jason_current')||'{}');
        return {data:{referralCode: cur.referralCode||"JAS-XXXXXX", referralLink: location.origin+"/index.html?ref="+(cur.referralCode||""), count:0}};
    },
    async history(){ return {data: JSON.parse(localStorage.getItem('jason_history')||'[]')}; },
    async notifications(){ return {notifications: JSON.parse(localStorage.getItem('jason_notifications')||'[]')}; },
    async paymentMethods(){ return {methods: JSON.parse(localStorage.getItem('jason_payments')||'[]')}; },
    async logout(){ localStorage.removeItem('jason_current'); return {ok:true}; }
};

//... RESTE DE TON CODE IDENTIQUE (je garde tout)
function initNavigation(){
    App.qsa("[data-page]").forEach(b=>b.addEventListener("click",()=>{ const p=b.dataset.page; if(JASON_APP.pages[p]) App.go(p); }));
    App.qsa("[data-action='logout']").forEach(b=>b.addEventListener("click", async()=>{ try{await API.logout();}catch{} location.href=JASON_APP.pages.index; }));
}
function initMobileMenu(){
    const menuButton = App.get("menuButton")||App.qs(".menu-button")||App.qs(".mobile-menu");
    const sidebar = App.qs(".sidebar")||App.qs(".side-menu");
    if(!menuButton||!sidebar) return;
    menuButton.addEventListener("click",()=>sidebar.classList.toggle("open"));
}
function displayUser(user){
    if(!user) return;
    ["userName","profileName","dashboardName","welcomeName"].forEach(id=>{ const el=App.get(id); if(el&&user.name) el.textContent=user.name; });
    ["userEmail","profileEmail"].forEach(id=>{ const el=App.get(id); if(el&&user.email) el.textContent=user.email; });
    ["userPhone","profilePhone"].forEach(id=>{ const el=App.get(id); if(el&&user.phone) el.textContent=user.phone; });
    const balance=user.balance??user.solde??0;
    App.qsa("[data-balance]").forEach(el=>el.textContent=App.formatMoney(balance));
    App.qsa("[data-vip]").forEach(el=>el.textContent=user.vip||"Bronze");
    App.qsa("[data-referral-code]").forEach(el=>el.textContent=user.referralCode||"JAS-XXXXXX");
}
async function loadCurrentUser(){
    try{
        const result=await API.me(); const user=result.user||result.data||result;
        if(user) displayUser(user); window.JASON_USER=user; return user;
    }catch{ return null; }
}
async function loadDashboard(){
    if(!App.get("dashboard")&&!App.qs("[data-dashboard]")) return;
    try{
        const result=await API.dashboard(); const data=result.data||result;
        if(!data) return;
        App.qsa("[data-dashboard-balance]").forEach(el=>el.textContent=App.formatMoney(data.balance??0));
        App.qsa("[data-investments]").forEach(el=>el.textContent=App.formatMoney(data.investment??0));
        App.qsa("[data-dashboard-points]").forEach(el=>el.textContent=data.points??0);
        App.qsa("[data-referrals]").forEach(el=>el.textContent=data.referrals??0);
        App.qsa("[data-dashboard-vip]").forEach(el=>el.textContent=data.vip??"Bronze");
    }catch{}
}
async function loadInvestments(){
    if(!App.qs("[data-investments-list]")&&!App.qs(".investment-list")) return;
    try{ const r=await API.investments(); const inv=r.investments||r.data||[]; window.JASON_INVESTMENTS=inv; document.dispatchEvent(new CustomEvent("jason:investments",{detail:inv})); }catch{}
}
async function loadActivities(){
    if(!App.qs("[data-activities]")&&!App.qs(".activities-list")) return;
    try{ const r=await API.activities(); const a=r.activities||r.data||[]; window.JASON_ACTIVITIES=a; document.dispatchEvent(new CustomEvent("jason:activities",{detail:a})); }catch{}
}
async function loadFidelity(){}
async function loadReferral(){
    try{
        const r=await API.referral(); const data=r.data||r;
        App.qsa("[data-referral-code]").forEach(el=>el.textContent=data.referralCode||"JAS-XXXXXX");
        App.qsa("[data-referral-link]").forEach(el=>el.textContent=data.referralLink||"");
        App.qsa("[data-referrals-count]").forEach(el=>el.textContent=data.count??0);
    }catch{}
}
async function loadHistory(){ try{ const r=await API.history(); window.JASON_HISTORY=r.data||[]; }catch{} }
async function loadNotifications(){
    try{
        const r=await API.notifications(); const n=r.notifications||r.data||[];
        window.JASON_NOTIFICATIONS=n;
        App.qsa("[data-unread-count]").forEach(el=>el.textContent=n.filter(x=>!x.read).length);
    }catch{}
}
async function loadPaymentMethods(){ try{ const r=await API.paymentMethods(); window.JASON_PAYMENT_METHODS=r.methods||r.data||[]; }catch{} }
async function copyText(text){
    try{ await navigator.clipboard.writeText(text); App.showMessage("Copié","success"); return true; }
    catch{ App.showMessage("Impossible de copier","error"); return false; }
}
function initCopyButtons(){
    App.qsa("[data-copy]").forEach(b=>b.addEventListener("click",()=>{ const t=App.qs(b.dataset.copy); if(t) copyText(t.value||t.textContent); }));
}
async function initJasonInvest(){
    console.log("JASON INVEST — app.js PUBLIC — api/index.js + backend/firebase.js");
    initNavigation(); initMobileMenu(); initCopyButtons();
    await loadCurrentUser(); await loadDashboard(); await loadInvestments(); await loadActivities(); await loadReferral(); await loadHistory(); await loadNotifications(); await loadPaymentMethods();
    document.dispatchEvent(new CustomEvent("jason:ready"));
}
if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",initJasonInvest); } else { initJasonInvest(); }