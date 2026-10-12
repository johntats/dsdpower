// CEPALCO API: logins, permissions and the shared Excel data, stored in Netlify Blobs.
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const st = () => getStore("cepalco");
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const FEATS = ["collections", "accounts", "report"], ACTS = ["view", "create", "update", "delete"];
const row = v => ({ view: v ? 1 : 0, create: 0, update: 0, delete: 0 });
const defGuest = () => ({ collections: row(1), accounts: row(1), report: row(0) });
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
    if (!can(me, db, "collections") && !can(me, db, "accounts")) return J({ e: "Not allowed" }, 403);
    return J((await s.get("rows", { type: "json" })) || { r: [] });
  }
  if (a === "getfile") {
    if (!can(me, db, "report")) return J({ e: "Not allowed" }, 403);
    return J((await s.get("file", { type: "json" })) || {});
  }

  if (me.role !== "admin") return J({ e: "Admin only" }, 403);
  const save = () => s.setJSON("db", db);
  const pw = String(b.p || ""), u = String(b.u || "").trim().toLowerCase();

  if (a === "putdata") {
    if (!Array.isArray(b.r)) return J({ e: "No rows" }, 400);
    await s.setJSON("rows", { n: String(b.n || "masterlist"), r: b.r, at: Date.now() });
    if (b.b) await s.setJSON("file", { n: String(b.n || "masterlist.xlsx"), b: b.b }); else await s.delete("file");
    return J({ ok: 1 });
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
    if (!FEATS.includes(b.f) || !ACTS.includes(b.x)) return J({ e: "Bad permission" }, 400);
    const p = db.perms[key] = db.perms[key] || defGuest(); (p[b.f] = p[b.f] || row(0))[b.x] = b.v ? 1 : 0; await save(); return J({ ok: 1 });
  }
  return J({ e: "Unknown action" }, 400);
};
export const config = { path: "/api" };
