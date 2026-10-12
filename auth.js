/* CEPALCO login. Users, permissions and data live on the server (/api, Netlify Blobs). */
const Auth=(()=>{
const S='cep_session',FEATS={collections:'Collections',accounts:'Accounts',report:'Generate report'},ACTS=['view','create','update','delete'];
const cs=document.currentScript,g=(cs&&cs.dataset)||{},guarded=!!(g.guard||g.admin!==undefined);
if(guarded)document.documentElement.style.visibility='hidden';
const ses=()=>{try{return JSON.parse(sessionStorage.getItem(S))}catch(e){return null}};
const put=r=>sessionStorage.setItem(S,JSON.stringify({t:r.t,u:r.u,role:r.role,perms:r.perms}));
async function call(a,o){const s=ses();let r;try{r=await fetch('/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({a,t:s&&s.t,...o})})}catch(e){return{e:'Cannot reach the server'}}
let j;try{j=await r.json()}catch(e){j={e:'Server error ('+r.status+')'}}return j}
const can=(f,a='view')=>{const s=ses();return !!(s&&(s.role==='admin'||(s.perms&&s.perms[f]&&s.perms[f][a])))};
const logout=()=>{sessionStorage.removeItem(S);location.href='login.html'};
async function login(u,p){const r=await call('login',{u,p});if(r.t){put(r);return true}return r.e||'Sign-in failed'}
async function guest(){const r=await call('guest');if(r.t){put(r);return true}return r.e||'Could not continue as guest'}
function hydrate(){const s=ses();
document.querySelectorAll('[data-feature]').forEach(e=>e.hidden=!can(e.dataset.feature));
document.querySelectorAll('[data-admin]').forEach(e=>{if(e!==cs)e.hidden=s.role!=='admin'});
const slot=document.getElementById('authSlot');
if(slot){slot.textContent='';const t=document.createElement('span');t.textContent='\u{1F464} '+s.u+' ('+s.role+') ';const a=document.createElement('a');a.href='#';a.className='underline ml-1';a.textContent='Logout';a.onclick=e=>{e.preventDefault();logout()};slot.append(t,a)}}
async function guard(){const toLogin=()=>{sessionStorage.removeItem(S);location.replace('login.html?next='+encodeURIComponent(location.pathname.split('/').pop()+location.hash));return false};
if(!ses())return toLogin();
const r=await call('me');if(!r.t)return toLogin();put(r);
const ok=g.admin!==undefined?r.role==='admin':(g.guard||'').split(',').some(f=>can(f));
hydrate();document.documentElement.style.visibility='visible';
if(!ok){const m=document.querySelector('main');if(m){m.hidden=true;m.insertAdjacentHTML('beforebegin','<div class="max-w-xl mx-auto mt-16 bg-white p-10 rounded-xl border border-slate-200 text-center"><h2 class="font-bold text-lg mb-2">Access restricted</h2><p class="text-sm text-slate-500">Your account does not have permission to view this page.</p></div>')}}
return ok}
const ready=guarded?new Promise(r=>document.addEventListener('DOMContentLoaded',()=>guard().then(r))):Promise.resolve(false);
return{FEATS,ACTS,call,can,ses,logout,login,guest,ready}})();
