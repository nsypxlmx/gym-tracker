// arnés playwright: servidor estático + chromium + utilidades para sembrar DB
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const KEY = "gymtracker_uni_v1";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };

async function setup() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch();
  return { browser, url, async close() { await browser.close(); await new Promise(r => server.close(r)); } };
}

// arranque limpio: lee el DB sembrado y lo deja sin demo ni historial
async function blankDB(ctx) {
  const c = await ctx.browser.newContext({ serviceWorkers: "block" });
  const page = await c.newPage();
  await page.goto(ctx.url);
  await page.waitForSelector(".nav");
  const db = await page.evaluate(() => JSON.parse(JSON.stringify(DB)));
  await c.close();
  const ids = {};
  for (const e of db.exercises) ids[e.name] = e.id;
  Object.assign(db.settings, { onboarded: true, demo: false, demoUntil: "" });
  db.sessions = {};
  db.bodyweight = [];
  delete db.logros;
  delete db.settings.logrosInit;
  delete db.settings.logrosSeenAt;
  return { db, ids };
}

const ms = (date, hhmm) => { const [y, m, d] = date.split("-").map(Number), [h, mi] = hhmm.split(":").map(Number); return new Date(y, m - 1, d, h, mi).getTime(); };

function sess(ids, date, exs, o = {}) {
  const { start = "18:00", mins = 60, note = "", finished = true, label = "entreno" } = o;
  const startedAt = mins == null ? null : ms(date, start);
  const endedAt = mins == null ? null : startedAt + mins * 60000;
  const exercises = exs.map(([name, sets, x = {}]) => {
    if (!ids[name]) throw new Error("ejercicio desconocido: " + name);
    const ex = { exId: ids[name], name, muscle: x.muscle || "", note: x.note || "",
      sets: sets.map(([kg, reps, type]) => ({ kg, reps: String(reps), done: true, type: type || "work", rpe: "" })) };
    if (x.ss) ex.ss = x.ss;
    return ex;
  });
  return [date, { label, exercises, finished, note, startedAt, endedAt }];
}

function addS(db, ...pairs) { for (const [k, s] of pairs) db.sessions[k] = s; }
function bw(db, date, kg) { db.bodyweight.push({ date, weight: kg }); }

async function open(ctx, db, { now = "2026-11-06T12:00:00" } = {}) {
  const c = await ctx.browser.newContext({ serviceWorkers: "block" });
  const page = await c.newPage();
  // errores y avisos desde el primer arranque (incluye recargas)
  page.errors = []; page.on("pageerror", e => page.errors.push(String(e)));
  page.warns = []; page.on("console", m => { if (m.type() === "warning") page.warns.push(m.text()); });
  await page.clock.setFixedTime(new Date(now));
  await page.addInitScript(([k, json]) => {
    if (sessionStorage.getItem("__seeded")) return;
    sessionStorage.setItem("__seeded", "1");
    localStorage.setItem(k, json);
  }, [KEY, JSON.stringify(db)]);
  await page.goto(ctx.url);
  return page;
}

// n sesiones deterministas, un día sí y otro no, rotando sentadilla/press/peso muerto con carga creciente
function gen(ids, n, from = "2025-01-01") {
  const lifts = ["sentadilla", "press banca", "peso muerto"];
  const out = [];
  const d = new Date(from + "T12:00:00");
  for (let i = 0; i < n; i++) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const kg = 60 + Math.floor(i / 3) * 2.5;
    out.push(sess(ids, key, [[lifts[i % 3], [[kg, 5], [kg, 5], [kg, 5]]]]));
    d.setDate(d.getDate() + 2);
  }
  return out;
}

module.exports = { setup, blankDB, sess, addS, bw, open, gen };
