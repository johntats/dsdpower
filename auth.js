/* CEPALCO login. NOTE: runs in the browser (localStorage). It controls what the UI shows,
   but it is not server-side security. */
const Auth=(()=>{
const K='cep_auth',S='cep_session',FEATS={collections:'Collections',accounts:'Accounts',report:'Generate report'},ACTS=['view','create','update','delete'];
const cs=document.currentScript,g=(cs&&cs.dataset)||{},guarded=!!(g.guard||g.admin!==undefined);
if(guarded)document.documentElement.style.visibility='hidden';
const row=v=>({view:v?1:0,create:0,update:0,delete:0});
const defGuest=()=>({collections:row(1),accounts:row(1),report:row(0)});
let db=null;
const H=async(u,p)=>{const s='cep|'+u.toLowerCase()+'|'+p;try{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}catch(e){let h=5381;for(const c of s)h=((h<<5)+h+c.charCodeAt(0))>>>0;return'f'+h}};
const save=()=>localStorage.setItem(K,JSON.stringify(db));
async function load(){if(db)return db;try{db=JSON.parse(localStorage.getItem(K))}catch(e){}
if(!db||!Array.isArray(db.users)){db={users:[{u:'admin',ph:await H('admin','admin'),role:'admin'}],perms:{guest:defGuest()}};save()}
db.perms=db.perms||{};db.perms.guest=db.perms.guest||defGuest();return db}
const ses=()=>{try{const s=JSON.parse(sessionStorage.getItem(S));if(!s)return null;if(s.role==='guest')return s;return db&&db.users.some(x=>x.u===s.u&&x.role===s.role)?s:null}catch(e){return null}};
const can=(f,a='view')=>{const s=ses();if(!s)return false;if(s.role==='admin')return true;const p=db.perms[s.role==='guest'?'guest':s.u];return !!(p&&p[f]&&p[f][a])};
const logout=()=>{sessionStorage.removeItem(S);location.href='login.html'};
async function login(u,p){await load();u=u.trim().toLowerCase();const x=db.users.find(y=>y.u===u);if(!x||x.ph!==await H(u,p))return false;sessionStorage.setItem(S,JSON.stringify({u,role:x.role}));return true}
const guest=()=>sessionStorage.setItem(S,JSON.stringify({u:'guest',role:'guest'}));
function hydrate(){const s=ses();
document.querySelectorAll('[data-feature]').forEach(e=>e.hidden=!can(e.dataset.feature));
document.querySelectorAll('[data-admin]').forEach(e=>{if(e!==cs)e.hidden=s.role!=='admin'});
const slot=document.getElementById('authSlot');
if(slot){slot.textContent='';const t=document.createElement('span');t.textContent='\u{1F464} '+s.u+' ('+s.role+') ';const a=document.createElement('a');a.href='#';a.className='underline ml-1';a.textContent='Logout';a.onclick=e=>{e.preventDefault();logout()};slot.append(t,a)}}
async function guard(){await load();const s=ses();
if(!s){location.replace('login.html?next='+encodeURIComponent(location.pathname.split('/').pop()+location.hash));return false}
const ok=g.admin!==undefined?s.role==='admin':(g.guard||'').split(',').some(f=>can(f));
hydrate();document.documentElement.style.visibility='visible';
if(!ok){const m=document.querySelector('main');if(m){m.hidden=true;m.insertAdjacentHTML('beforebegin','<div class="max-w-xl mx-auto mt-16 bg-white p-10 rounded-xl border border-slate-200 text-center"><h2 class="font-bold text-lg mb-2">Access restricted</h2><p class="text-sm text-slate-500">Your account does not have permission to view this page.</p></div>')}}
return ok}
const ready=guarded?new Promise(r=>document.addEventListener('DOMContentLoaded',()=>guard().then(r))):Promise.resolve(false);
return{FEATS,ACTS,H,load,save,ses,can,logout,login,guest,row,db:()=>db,ready}})();
