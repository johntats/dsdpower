// CEPALCO API: logins, permissions and the shared Excel data, stored in Netlify Blobs.
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const st = () => getStore("cepalco");
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const FEATS = ["collections", "accounts", "contacts", "report"], ACTS = ["view", "create", "update", "delete"];
// Contacts are derived from accounts, so only View and Edit apply to them.
const NA = { contacts: ["create", "delete"] };
// Accounts masterlist: same columns, same order as sheet "MONITORING FOR CODE". s=text, n=number, d=date (YYYY-MM-DD), x=number or text
const COLS = [["CUSTOMER TYPE","s"],["BILLING","s"],["DN/ODAA","s"],["JOB-ORDER","s"],["CLN","s"],["SUB-AREA","s"],["CUSTOMER NAME","s"],["AREA","x"],["RATE SCHED","x"],["CONTRACT NO.","n"],["MONTHS UNPAID","n"],["DUE DATE","d"],["PAYMENT DATE","d"],["ARREARS","n"],["LATEST BILL AMOUNT","n"],["TOTAL BALANCE AMOUNT","n"],["PAID AMOUNT","n"],["REMAINING BALANCE","n"],["SMS","s"],["EMAIL","s"],["FIELD REMARKS","s"],["PHONE NO.","s"],["EMAIL ADDRESS","s"],["Contact Person","s"]];
const CONTACT_COLS = ["PHONE NO.", "EMAIL ADDRESS", "Contact Person"], CONTACT_EDIT = ["EMAIL ADDRESS", "Contact Person"];
const row = v => ({ view: v ? 1 : 0, create: 0, update: 0, delete: 0 });
const defGuest = () => ({ collections: row(1), accounts: row(1), contacts: row(0), report: row(0) });
const hash = (p, salt) => crypto.scryptSync(p, salt, 32).toString("hex");
const mkUser = (u, p, role) => { const salt = crypto.randomBytes(16).toString("hex"); return { u, salt, h: hash(p, salt), role }; };

async function loadDb() {
  const s = st(); let db = await s.get("db", { type: "json" });
  if (!db) { db = { users: [mkUser("admin", "admin", "admin")], perms: { guest: defGuest() } }; await s.setJSON("db", db); }
  return db;
}
async function secret() {
  const s = st(); let k = await s.get("secret");
  if (!k) { k = crypto.randomBytes(32).toString("hex"); await s.set("secret", k); }
  return k;
}
const sign = (b, k) => crypto.createHmac("sha256", k).update(b).digest("base64url");
const mk = (o, k) => { const b = Buffer.from(JSON.stringify(o)).toString("base64url"); return b + "." + sign(b, k); };
function ver(t, k) {
  try {
    const [b, s] = String(t || "").split("."); if (!b || !s) return null;
    const e = sign(b, k); if (s.length !== e.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return null;
    const o = JSON.parse(Buffer.from(b, "base64url").toString()); return o.x > Date.now() ? o : null;
  } catch { return null; }
}
const who = (tok, db) => !tok ? null : tok.role === "guest" ? { u: "guest", role: "guest" } : (db.users.find(y => y.u === tok.u && y.role === tok.role) ? { u: tok.u, role: tok.role } : null);
const can = (me, db, f, a = "view") => me.role === "admin" || !!(db.perms[me.role === "guest" ? "guest" : me.u]?.[f]?.[a]);
const permsOf = (me, db) => me.role === "admin" ? Object.fromEntries(FEATS.map(f => [f, { view: 1, create: 1, update: 1, delete: 1 }])) : (db.perms[me.role === "guest" ? "guest" : me.u] || defGuest());
const session = (me, db, k) => ({ t: mk({ u: me.u, role: me.role, x: Date.now() + 12 * 36e5 }, k), u: me.u, role: me.role, perms: permsOf(me, db) });

// ---- accounts data ----
const r2 = v => Math.round(v * 100) / 100;
function coerce(k, t, v) {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  if (t === "s") return String(v).trim();
  if (t === "d") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v).trim()), d = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (!d || d.getUTCMonth() !== +m[2] - 1) throw new Error("Invalid date in " + k + " (use YYYY-MM-DD)");
    return m[0];
  }
  const n = typeof v === "number" ? v : Number(String(v).replace(/[\u20B1,\s]/g, ""));
  if (Number.isFinite(n)) return t === "n" ? r2(n) : n;
  if (t === "x") return String(v).trim();
  throw new Error("Invalid number in " + k);
}
// Same rules as the Excel formulas: TOTAL = ARREARS + LATEST BILL when ARREARS is filled; REMAINING = TOTAL - PAID.
function norm(o, id) {
  const r = { _id: id };
  for (const [k, t] of COLS) r[k] = coerce(k, t, o[k]);
  if (r["ARREARS"] !== null) r["TOTAL BALANCE AMOUNT"] = r2(r["ARREARS"] + (r["LATEST BILL AMOUNT"] || 0));
  const T = r["TOTAL BALANCE AMOUNT"], P = r["PAID AMOUNT"];
  r["REMAINING BALANCE"] = T === null && P === null ? null : r2((T || 0) - (P || 0));
  return r;
}
const newId = () => crypto.randomBytes(6).toString("hex");
const loadAcc = async s => (await s.get("accounts", { type: "json" })) || { n: "", r: [], at: 0 };
const saveAcc = (s, a) => { a.at = Date.now(); return s.setJSON("accounts", a); };
const canAnyAcc = (me, db) => ["create", "update", "delete"].some(x => can(me, db, "accounts", x));
const bad = e => J({ e: e.message || "Invalid data" }, 400);

export default async (req) => {
  if (req.method !== "POST") return J({ e: "POST only" }, 405);
  let b; try { b = await req.json(); } catch { return J({ e: "Bad request" }, 400); }
  const db = await loadDb(), k = await secret(), s = st(), a = b.a;

  if (a === "login") {
    const u = String(b.u || "").trim().toLowerCase(), x = db.users.find(y => y.u === u);
    if (!x || !crypto.timingSafeEqual(Buffer.from(hash(String(b.p || ""), x.salt)), Buffer.from(x.h))) return J({ e: "Wrong username or password." }, 401);
    return J(session({ u, role: x.role }, db, k));
  }
  if (a === "guest") return J(session({ u: "guest", role: "guest" }, db, k));

  const me = who(ver(b.t, k), db);
  if (!me) return J({ e: "Please sign in again." }, 401);
  if (a === "me") return J(session(me, db, k));

  if (a === "getdata") {
    if (!can(me, db, "collections") && !can(me, db, "accounts") && !can(me, db, "report")) return J({ e: "Not allowed" }, 403);
    const d = await loadAcc(s), full = me.role === "admin" || canAnyAcc(me, db) || can(me, db, "contacts");
    // people who may not see contact details never receive them
    const r = full ? d.r : d.r.map(x => { const y = { ...x }; for (const c of CONTACT_COLS) delete y[c]; return y; });
    return J({ n: d.n, at: d.at, cols: COLS, r });
  }
  if (a === "getcontacts") {
    if (!can(me, db, "contacts")) return J({ e: "Not allowed" }, 403);
    const d = await loadAcc(s);
    return J({ r: d.r.map(x => ({ id: x._id, name: x["CUSTOMER NAME"], cn: x["CONTRACT NO."], email: x["EMAIL ADDRESS"], person: x["Contact Person"] })) });
  }
  if (a === "con_upd") {
    if (!can(me, db, "contacts", "update")) return J({ e: "You do not have permission to edit contacts" }, 403);
    const d = await loadAcc(s), x = d.r.find(y => y._id === b.id); if (!x) return J({ e: "Account not found (it may have been deleted)" }, 404);
    const p = b.patch || {}, ks = Object.keys(p);
    if (!ks.length || ks.some(k => !CONTACT_EDIT.includes(k))) return J({ e: "Only email and contact person can be edited here" }, 400);
    try { Object.assign(x, norm({ ...x, ...p }, x._id)); } catch (e) { return bad(e); }
    await saveAcc(s, d); return J({ ok: 1, rec: { id: x._id, name: x["CUSTOMER NAME"], cn: x["CONTRACT NO."], email: x["EMAIL ADDRESS"], person: x["Contact Person"] } });
  }
  if (a === "acc_add") {
    if (!can(me, db, "accounts", "create")) return J({ e: "You do not have permission to add accounts" }, 403);
    let rec; try { rec = norm(b.rec || {}, newId()); } catch (e) { return bad(e); }
    if (!rec["CUSTOMER NAME"]) return J({ e: "Customer name is required" }, 400);
    const d = await loadAcc(s); d.r.push(rec); await saveAcc(s, d); return J({ ok: 1, rec });
  }
  if (a === "acc_upd") {
    if (!can(me, db, "accounts", "update")) return J({ e: "You do not have permission to edit accounts" }, 403);
    const d = await loadAcc(s), i = d.r.findIndex(y => y._id === b.id); if (i < 0) return J({ e: "Account not found (it may have been deleted)" }, 404);
    const p = b.patch || {}; if (Object.keys(p).some(k => !COLS.some(c => c[0] === k))) return J({ e: "Unknown column" }, 400);
    let rec; try { rec = norm({ ...d.r[i], ...p }, d.r[i]._id); } catch (e) { return bad(e); }
    if (!rec["CUSTOMER NAME"]) return J({ e: "Customer name cannot be empty" }, 400);
    d.r[i] = rec; await saveAcc(s, d); return J({ ok: 1, rec });
  }
  if (a === "acc_del") {
    if (!can(me, db, "accounts", "delete")) return J({ e: "You do not have permission to delete accounts" }, 403);
    const d = await loadAcc(s), n = d.r.length; d.r = d.r.filter(y => y._id !== b.id);
    if (d.r.length === n) return J({ e: "Account not found" }, 404);
    await saveAcc(s, d); return J({ ok: 1 });
  }

  if (me.role !== "admin") return J({ e: "Admin only" }, 403);
  const save = () => s.setJSON("db", db);
  const pw = String(b.p || ""), u = String(b.u || "").trim().toLowerCase();

  if (a === "putdata") {
    if (!Array.isArray(b.r)) return J({ e: "No rows" }, 400);
    let r; try { r = b.r.filter(x => x && (x["CUSTOMER NAME"] || x["CONTRACT NO."])).map(x => norm(x, newId())); } catch (e) { return bad(e); }
    await s.setJSON("accounts", { n: String(b.n || "masterlist"), r, at: Date.now() });
    await s.delete("rows"); await s.delete("file"); // old formats, no longer used
    return J({ ok: 1, count: r.length });
  }
  if (a === "users") return J({ users: db.users.map(({ u, role }) => ({ u, role })), perms: db.perms });
  if (a === "adduser") {
    if (!/^[a-z0-9._-]{3,20}$/.test(u)) return J({ e: "Username: 3-20 letters, numbers, . _ -" }, 400);
    if (u === "guest" || db.users.some(x => x.u === u)) return J({ e: "That username is taken" }, 400);
    if (pw.length < 4) return J({ e: "Password needs at least 4 characters" }, 400);
    db.users.push(mkUser(u, pw, "user")); db.perms[u] = JSON.parse(JSON.stringify(db.perms.guest)); await save(); return J({ ok: 1 });
  }
  if (a === "setpw") {
    const x = db.users.find(y => y.u === u); if (!x) return J({ e: "No such user" }, 404);
    if (pw.length < 4) return J({ e: "Password needs at least 4 characters" }, 400);
    Object.assign(x, mkUser(u, pw, x.role)); await save(); return J({ ok: 1 });
  }
  if (a === "deluser") {
    const x = db.users.find(y => y.u === u); if (!x || x.role === "admin") return J({ e: "Cannot delete that user" }, 400);
    db.users = db.users.filter(y => y !== x); delete db.perms[u]; await save(); return J({ ok: 1 });
  }
  if (a === "setperm") {
    const key = String(b.k || ""); if (key !== "guest" && !db.users.some(x => x.u === key && x.role === "user")) return J({ e: "No such user" }, 404);
    if (!FEATS.includes(b.f) || !ACTS.includes(b.x) || (NA[b.f] || []).includes(b.x)) return J({ e: "Bad permission" }, 400);
    const p = db.perms[key] = db.perms[key] || defGuest(); (p[b.f] = p[b.f] || row(0))[b.x] = b.v ? 1 : 0; await save(); return J({ ok: 1 });
  }
  return J({ e: "Unknown action" }, 400);
};
export const config = { path: "/api" };
