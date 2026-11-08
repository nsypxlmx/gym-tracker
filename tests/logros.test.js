const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setup, blankDB, sess, addS, bw, open, gen } = require("./helpers");

let ctx;
before(async () => { ctx = await setup(); });
after(async () => { await ctx.close(); });

describe("smoke", () => {
  test("boots with seeded history", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db,
      sess(ids, "2026-11-02", [["sentadilla", [[100, 5]]]]),
      sess(ids, "2026-11-03", [["press banca", [[60, 8]]]]),
      sess(ids, "2026-11-04", [["peso muerto", [[120, 5]]]]));
    const p = await open(ctx, db);
    await p.waitForSelector(".nav");
    assert.equal(await p.evaluate(() => Object.keys(DB.sessions).length), 3);
    await p.context().close();
  });

  test("workout flow: start, check set, finish shows summary", async () => {
    const { db, ids } = await blankDB(ctx);
    // la sesión de hoy se siembra abierta, con un set sin marcar (la rutina de hoy está vacía)
    const [k, s] = sess(ids, "2026-11-06", [["sentadilla", [[100, 5]]]], { mins: null, finished: false });
    s.exercises[0].sets[0].done = false;
    addS(db, [k, s]);
    const p = await open(ctx, db);
    await p.waitForSelector(".nav");
    await p.evaluate(() => { A.startWorkout(); A.checkSet(0, 0); A.finish(true); });
    assert.match(await p.textContent("#sheet"), /entreno terminado/);
    await p.context().close();
  });

  test("PR overlay still appears for a new best", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, sess(ids, "2026-11-05", [["sentadilla", [[100, 5]]]]));
    const [k, s] = sess(ids, "2026-11-06", [["sentadilla", [[110, 5]]]], { mins: null, finished: false });
    s.exercises[0].sets[0].done = false;
    addS(db, [k, s]);
    const p = await open(ctx, db);
    await p.waitForSelector(".nav");
    await p.evaluate(() => { A.startWorkout(); A.checkSet(0, 0); });
    assert.ok(await p.isVisible("#prOverlay.show"));
    await p.evaluate(() => A.closePR());
    await p.context().close();
  });
});

// fechas consecutivas desde `from` (n días seguidos)
const days = (from, n) => Array.from({ length: n }, (_, i) => {
  const d = new Date(from + "T12:00:00"); d.setDate(d.getDate() + i);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
});
const squat = (ids, k, o) => sess(ids, k, [["sentadilla", [[100, 5]]]], o);

// siembra el DB, abre la app y devuelve lo que la función calcule dentro de la página
async function run(db, fn, arg) {
  const p = await open(ctx, db);
  await p.waitForSelector(".nav");
  const out = await p.evaluate(fn, arg);
  await p.context().close();
  return out;
}
const earnedOf = db => run(db, () => replayLogros().earned);

describe("constancia", () => {
  test("c10 dated on the 10th session", async () => {
    const { db, ids } = await blankDB(ctx);
    days("2026-10-01", 10).forEach(k => addS(db, squat(ids, k)));
    assert.equal((await earnedOf(db)).c10, "2026-10-10");
    delete db.sessions["2026-10-10"];
    assert.equal((await earnedOf(db)).c10, undefined);
  });

  test("streak r3 / r7", async () => {
    const { db, ids } = await blankDB(ctx);
    days("2026-10-01", 7).forEach(k => addS(db, squat(ids, k)));
    let e = await earnedOf(db);
    assert.equal(e.r3, "2026-10-03");
    assert.equal(e.r7, "2026-10-07");
    delete db.sessions["2026-10-04"];
    e = await earnedOf(db);
    assert.equal(e.r3, "2026-10-03");
    assert.equal(e.r7, undefined);
  });

  test("w4: 4 consecutive Mon–Sun weeks with ≥3", async () => {
    const { db, ids } = await blankDB(ctx);
    // 2026-10-05 es lunes: lun/mié/vie × 4 semanas
    const ks = [0, 1, 2, 3].flatMap(w => [0, 2, 4].map(d => days("2026-10-05", 28)[w * 7 + d]));
    ks.forEach(k => addS(db, squat(ids, k)));
    assert.equal((await earnedOf(db)).w4, ks[11]);
    // la 3.ª semana con solo 2 entrenos corta la racha
    delete db.sessions[ks[8]];
    assert.equal((await earnedOf(db)).w4, undefined);
  });

  test("back after 14+ days", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, squat(ids, "2026-10-01"), squat(ids, "2026-10-15"));
    assert.equal((await earnedOf(db)).back, "2026-10-15");
    delete db.sessions["2026-10-15"];
    addS(db, squat(ids, "2026-10-14"));
    assert.equal((await earnedOf(db)).back, undefined);
  });

  test("year", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, squat(ids, "2025-11-01"), squat(ids, "2026-10-31"));
    assert.equal((await earnedOf(db)).year, undefined);
    addS(db, squat(ids, "2026-11-01"));
    assert.equal((await earnedOf(db)).year, "2026-11-01");
  });

  test("unfinished sessions don't count", async () => {
    const { db, ids } = await blankDB(ctx);
    days("2026-10-01", 10).forEach((k, i) => addS(db, squat(ids, k, { finished: i !== 4 })));
    const e = await earnedOf(db);
    assert.equal(e.c1, "2026-10-01");
    assert.equal(e.c10, undefined);
  });

  test("demo sessions never count", async () => {
    const { db, ids } = await blankDB(ctx);
    Object.assign(db.settings, { demo: true, demoUntil: "2026-10-31" });
    days("2026-10-01", 12).forEach(k => addS(db, squat(ids, k)));
    assert.deepEqual(await earnedOf(db), {});
  });
});

describe("engine", () => {
  test("liftKey strict", async () => {
    const { db } = await blankDB(ctx);
    const cases = {
      "sentadilla": "sq", "sentadilla goblet": "gob", "sentadilla sumo mancuerna": null,
      "peso muerto rumano mancuerna": null, "press militar": "oh", "press pecho mancuerna": "dbp",
      "press inclinado mancuerna": "dbp", "remo mancuerna": "row", "remo con barra": null,
      "press banca": "bp", "peso muerto": "dl", "squat": "sq", "ohp": "oh", "kettlebell deadlift": null,
    };
    const got = await run(db, names => Object.fromEntries(names.map(n => [n, liftKey(n)])), Object.keys(cases));
    assert.deepEqual(got, cases);
  });

  test("prog c100 at 61 sessions", async () => {
    const { db, ids } = await blankDB(ctx);
    gen(ids, 61).forEach(p => addS(db, p));
    const out = await run(db, () => { replayLogros(); return [logroProg("c100"), logroProg("c1")]; });
    assert.deepEqual(out, [{ cur: 61, goal: 100 }, null]);
  });

  test("replay is pure: DB and localStorage untouched", async () => {
    const { db, ids } = await blankDB(ctx);
    gen(ids, 20).forEach(p => addS(db, p));
    bw(db, "2025-01-02", 80);
    const same = await run(db, () => {
      const a = JSON.stringify(DB), l = localStorage.getItem("gymtracker_uni_v1");
      replayLogros(); replayLogros({ includeOpen: true });
      return a === JSON.stringify(DB) && l === localStorage.getItem("gymtracker_uni_v1");
    });
    assert.equal(same, true);
  });

  test("st.bw is the latest non-demo body weight on or before the day", async () => {
    const { db, ids } = await blankDB(ctx);
    Object.assign(db.settings, { demo: true, demoUntil: "2026-09-30" });
    bw(db, "2026-09-20", 90);                  // demo: no cuenta
    addS(db, squat(ids, "2026-10-01"));
    bw(db, "2026-10-03", "81.5");             // cadena: se normaliza
    bw(db, "2026-10-08", 80);
    addS(db, squat(ids, "2026-10-05"));
    const st = await run(db, () => replayLogros().st);
    assert.equal(st.day, "2026-10-08");
    assert.equal(st.bw, 80);
    assert.equal(st.sessions, 2);
    const first = await run((() => { const d = structuredClone(db); d.bodyweight = d.bodyweight.slice(0, 2); return d; })(), () => replayLogros().st);
    assert.equal(first.bw, 81.5);
    const none = await run((() => { const d = structuredClone(db); d.bodyweight = d.bodyweight.slice(0, 1); return d; })(), () => replayLogros().st);
    assert.equal(none.bw, 0);
  });

  test("includeOpen counts today's open session as the last day", async () => {
    const { db, ids } = await blankDB(ctx);
    days("2026-10-28", 9).forEach(k => addS(db, squat(ids, k)));   // 10-28 … 11-05
    addS(db, squat(ids, "2026-11-06", { mins: null, finished: false }));
    const out = await run(db, () => [replayLogros().earned.c10, replayLogros({ includeOpen: true }).earned.c10, curKey()]);
    assert.deepEqual(out, [undefined, "2026-11-06", "2026-11-06"]);
  });

  test("meta badges run after normal ones on the same day", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, squat(ids, "2026-10-01"), squat(ids, "2026-10-02"), squat(ids, "2026-10-03"));
    const e = await run(db, () => {
      // insignia meta temporal, puesta ANTES en la lista: aun así ve lo que la fase 1 ganó ese día
      LOGROS.unshift({ id: "tmeta", fam: "platino", grade: "X", title: "t", req: "t", scope: "core", meta: true,
        test: (st, earned) => !!earned.r3, prog: () => ({ cur: 0, goal: 1 }) });
      DB.logros = {};                       // sin lo que el arranque guardó: el orden de fases se ve en el recorrido
      try { return replayLogros().earned; } finally { LOGROS.shift(); }
    });
    assert.equal(e.r3, "2026-10-03");
    assert.equal(e.tmeta, "2026-10-03");
  });

  // §4.3: 500 sesiones de forma realista (6 ejercicios × 4 series, con peso corporal) en un móvil de gama media (CPU ×4)
  test("perf: 500 realistic sessions < 30 ms at 4x CPU throttle", async () => {
    const { db, ids } = await blankDB(ctx);
    const names = Object.keys(ids).slice(0, 12);
    const d = new Date("2021-01-01T12:00:00");
    for (let i = 0; i < 500; i++, d.setDate(d.getDate() + 1)) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const w = 60 + (i % 40);
      addS(db, sess(ids, k, [0, 1, 2, 3, 4, 5].map(j => [names[(i + j) % names.length], [[w, 8], [w, 8], [w + 2, 6], [w + 4, 5]]])));
      if (i % 3 === 0) bw(db, k, 80);
    }
    const p = await open(ctx, db);
    await p.waitForSelector(".nav");
    const cdp = await p.context().newCDPSession(p);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const { med, n } = await p.evaluate(() => {
      const t = [];
      for (let i = 0; i < 7; i++) { const a = performance.now(); replayLogros(); t.push(performance.now() - a); }
      t.sort((a, b) => a - b);
      return { med: t[3], n: replayLogros().st.sessions };
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await p.context().close();
    assert.equal(n, 500);
    assert.ok(med < 30, `median ${med.toFixed(2)} ms`);
  });
});

describe("fuerza", () => {
  const lift = (ids, k, name, kg, reps = 1) => sess(ids, k, [[name, [[kg, reps]]]]);
  const keys = (e, re) => Object.keys(e).filter(id => re.test(id)).sort();

  test("plate clubs kg", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, lift(ids, "2026-10-01", "sentadilla", 100));
    const e = await earnedOf(db);
    assert.equal(e.pc1, "2026-10-01");
    assert.equal(e.pc2, "2026-10-01");
    assert.equal(e.pc3, undefined);
  });

  test("lb user: 100 kg is not 2 plate", async () => {
    const { db, ids } = await blankDB(ctx);
    db.settings.unit = "lb";
    addS(db, lift(ids, "2026-10-01", "sentadilla", 100));
    const e = await earnedOf(db);
    assert.equal(e.pc1, "2026-10-01");
    assert.equal(e.pc2, undefined);
  });

  test("goblet 140 kg does not unlock pc3", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, lift(ids, "2026-10-01", "sentadilla goblet", 140, 5));
    const e = await earnedOf(db);
    assert.deepEqual(keys(e, /^pc/), []);
    assert.equal(e.gb32, "2026-10-01");
  });

  test("rumano does not count for dl2", async () => {
    const { db, ids } = await blankDB(ctx);
    bw(db, "2026-09-30", 70);
    addS(db, lift(ids, "2026-10-01", "peso muerto rumano mancuerna", 150, 5));
    const e = await earnedOf(db);
    assert.equal(e.dl2, undefined);
    assert.deepEqual(keys(e, /^pc/), []);
    // control: el mismo peso en peso muerto normal sí desbloquea
    const c = await blankDB(ctx);
    bw(c.db, "2026-09-30", 70);
    addS(c.db, lift(c.ids, "2026-10-01", "peso muerto", 150, 5));
    const ec = await earnedOf(c.db);
    assert.equal(ec.dl2, "2026-10-01");
    assert.equal(ec.pc3, "2026-10-01");
  });

  test("lb user: 102.06 kg (225 lb) unlocks pc2", async () => {
    const { db, ids } = await blankDB(ctx);
    db.settings.unit = "lb";
    addS(db, lift(ids, "2026-10-01", "sentadilla", 102.06));
    assert.equal((await earnedOf(db)).pc2, "2026-10-01");
  });

  test("×pc needs body weight on or before that day", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, lift(ids, "2026-10-05", "press banca", 80));
    assert.equal((await earnedOf(db)).bp1, undefined);
    bw(db, "2026-10-06", 80);                                       // R17: el peso llega después del levantamiento, no lo reescribe
    assert.equal((await earnedOf(db)).bp1, undefined);
    addS(db, lift(ids, "2026-10-07", "press banca", 80));           // con peso registrado, el siguiente levantamiento sí cuenta
    assert.equal((await earnedOf(db)).bp1, "2026-10-07");
  });

  test("×pc uses latest bw at that day", async () => {
    const { db, ids } = await blankDB(ctx);
    bw(db, "2026-10-01", 90);
    addS(db, lift(ids, "2026-10-02", "press banca", 85));
    assert.equal((await earnedOf(db)).bp1, undefined);
    bw(db, "2026-10-03", 84);                                       // R17: ya no reescribe el 85 de antes
    assert.equal((await earnedOf(db)).bp1, undefined);
    addS(db, lift(ids, "2026-10-04", "press banca", 85));           // pero el siguiente 85 usa el peso más reciente
    assert.equal((await earnedOf(db)).bp1, "2026-10-04");
  });

  test("×pc uses the ratio at lift time, not best lift over current bw", async () => {
    const { db, ids } = await blankDB(ctx);
    bw(db, "2026-10-01", 90);
    addS(db, lift(ids, "2026-10-02", "press banca", 85));
    bw(db, "2026-10-10", 84);                                       // bajó de peso, sin banca nueva
    addS(db, lift(ids, "2026-10-12", "sentadilla", 60));
    assert.equal((await earnedOf(db)).bp1, undefined);
  });

  test("levels match progreso thresholds", async () => {
    const { db, ids } = await blankDB(ctx);
    bw(db, "2026-10-01", 80);
    // e1RM = kg × (1 + 1/30); 3 lifts sum to 300 kg
    const f = 1 + 1 / 30;
    const mk = t => { const per = t / 3 / f; addS(db, sess(ids, "2026-10-02", [["sentadilla", [[per, 1]]], ["press banca", [[per, 1]]], ["peso muerto", [[per, 1]]]])); };
    mk(300 + 0.5);
    let e = await earnedOf(db);
    assert.equal(e.lv2, "2026-10-02");
    assert.equal(e.lv3, undefined);
    mk(420 + 0.5);
    e = await earnedOf(db);
    assert.equal(e.lv3, "2026-10-02");
    assert.equal(e.lv4, undefined);
  });

  test("k1000", async () => {
    const { db, ids } = await blankDB(ctx);
    const three = (s, b, d) => sess(ids, "2026-10-01", [["sentadilla", [[s, 1]]], ["press banca", [[b, 1]]], ["peso muerto", [[d, 1]]]]);
    addS(db, three(180, 120, 155));
    assert.equal((await earnedOf(db)).k1000, "2026-10-01");
    addS(db, three(180, 120, 150));
    assert.equal((await earnedOf(db)).k1000, undefined);
  });

  test("k1000 in lb: exactly 1000 lb earns it", async () => {
    const { db, ids } = await blankDB(ctx);
    db.settings.unit = "lb";
    const kg = lb => Math.round(lb / 2.20462 * 100) / 100;   // como se guarda: 315+225+460 lb = 453.59 kg
    addS(db, sess(ids, "2026-10-01", [["sentadilla", [[kg(315), 1]]], ["press banca", [[kg(225), 1]]], ["peso muerto", [[kg(460), 1]]]]));
    assert.equal((await earnedOf(db)).k1000, "2026-10-01");
  });

  test("dumbbell track", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, sess(ids, "2026-10-01", [["press pecho mancuerna", [[30, 8]]], ["remo mancuerna", [[40, 8]]]]));
    const e = await earnedOf(db);
    assert.equal(e.db20, "2026-10-01");
    assert.equal(e.db30, "2026-10-01");
    assert.equal(e.rw40, "2026-10-01");
    assert.equal(e.gb32, undefined);
  });

  test("oh60 / oh1", async () => {
    const { db, ids } = await blankDB(ctx);
    bw(db, "2026-09-30", 80);
    addS(db, lift(ids, "2026-10-01", "press militar", 60, 3));
    const e = await earnedOf(db);
    assert.equal(e.oh60, "2026-10-01");
    assert.equal(e.oh1, undefined);
  });

  test("warm-ups and reps 0 do not count", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, sess(ids, "2026-10-01", [["sentadilla", [[100, 5, "warm"], [140, 0]]]]));
    assert.deepEqual(keys(await earnedOf(db), /^pc/), []);
  });
});

describe("records", () => {
  const lift = (ids, k, name, kg, reps = 5) => sess(ids, k, [[name, [[kg, reps]]]]);
  const mk = async (...rows) => { const { db, ids } = await blankDB(ctx); rows.forEach(r => addS(db, lift(ids, ...r))); return { db, ids }; };
  const prs = db => run(db, () => { const r = replayLogros(); return { e: r.earned, n: r.st.prN }; });

  test("first session of an exercise is not a record", async () => {
    const { db } = await mk(["2026-10-01", "sentadilla", 100]);
    const r = await prs(db);
    assert.equal(r.e.pr1, undefined);
    assert.equal(r.n, 0);
  });

  test("pr1 on the first improvement", async () => {
    const { db } = await mk(["2026-10-01", "sentadilla", 100], ["2026-10-03", "sentadilla", 102.5]);
    const r = await prs(db);
    assert.equal(r.e.pr1, "2026-10-03");
    assert.equal(r.n, 1);
  });

  test("equal or +0.01 is not a record", async () => {
    const { db } = await mk(["2026-10-01", "sentadilla", 100], ["2026-10-03", "sentadilla", 100]);
    assert.equal((await prs(db)).e.pr1, undefined);
    const a = await mk(["2026-10-01", "sentadilla", 100], ["2026-10-03", "sentadilla", 100.005]);
    assert.equal((await prs(a.db)).e.pr1, undefined);
  });

  test("a record needs an earlier day; two sets the same day count once", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, lift(ids, "2026-10-01", "sentadilla", 100),
      sess(ids, "2026-10-03", [["sentadilla", [[105, 5], [110, 5]]]]));
    const r = await prs(db);
    assert.equal(r.n, 1);
  });

  test("records apply to any exercise, not only strict lifts", async () => {
    const { db, ids } = await blankDB(ctx);
    const name = Object.keys(ids).find(n => !/sentad|banca|muerto|press|remo/i.test(n));
    addS(db, lift(ids, "2026-10-01", name, 40), lift(ids, "2026-10-03", name, 45));
    assert.equal((await prs(db)).e.pr1, "2026-10-03");
  });

  test("pr10 counts across exercises and days", async () => {
    const { db, ids } = await blankDB(ctx);
    days("2026-09-01", 11).forEach((k, i) => addS(db, lift(ids, k, "sentadilla", 100 + i * 5)));
    const r = await prs(db);
    assert.equal(r.n, 10);
    assert.equal(r.e.pr10, "2026-09-11");
    assert.equal(r.e.pr50, undefined);
  });

  test("pr3s: 3 records in one session", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, sess(ids, "2026-10-01", [["sentadilla", [[100, 5]]], ["press banca", [[60, 5]]], ["peso muerto", [[120, 5]]]]),
      sess(ids, "2026-10-03", [["sentadilla", [[105, 5]]], ["press banca", [[65, 5]]]]),
      sess(ids, "2026-10-05", [["sentadilla", [[110, 5]]], ["press banca", [[70, 5]]], ["peso muerto", [[130, 5]]]]));
    const e = (await prs(db)).e;
    assert.equal(e.pr3s, "2026-10-05");
  });

  // sesión base con los tres levantamientos (un solo día) y luego un récord por levantamiento en las fechas dadas
  const week3 = async ([d1, d2, d3], names = ["sentadilla", "press banca", "peso muerto"]) => {
    const { db, ids } = await blankDB(ctx);
    addS(db, sess(ids, "2026-09-01", names.map((n, i) => [n, [[[100, 60, 120][i], 5]]])));
    [d1, d2, d3].forEach((d, i) => addS(db, lift(ids, d, names[i], [105, 65, 125][i])));
    return db;
  };

  test("prb3: squat, bench and deadlift records in the same Mon–Sun week", async () => {
    // 2026-10-05 es lunes: lun/mié/vie
    assert.equal((await prs(await week3(["2026-10-05", "2026-10-07", "2026-10-09"]))).e.prb3, "2026-10-09");
    // vie + lun siguiente cruza de semana
    assert.equal((await prs(await week3(["2026-10-05", "2026-10-07", "2026-10-12"]))).e.prb3, undefined);
    assert.equal((await prs(await week3(["2026-10-09", "2026-10-10", "2026-10-12"]))).e.prb3, undefined);
    // domingo es el último día de la semana
    assert.equal((await prs(await week3(["2026-10-05", "2026-10-06", "2026-10-11"]))).e.prb3, "2026-10-11");
  });

  test("prb3 ignores dumbbell variants", async () => {
    const db = await week3(["2026-10-05", "2026-10-06", "2026-10-07"], ["sentadilla", "press banca", "peso muerto rumano mancuerna"]);
    assert.equal((await prs(db)).e.prb3, undefined);
  });

  test("prlt: record after 30+ days without one", async () => {
    const base = [["2026-08-01", "sentadilla", 100], ["2026-08-03", "sentadilla", 105]];
    const yes = await mk(...base, ["2026-09-02", "sentadilla", 110]);   // 30 días tras el 08-03
    assert.equal((await prs(yes.db)).e.prlt, "2026-09-02");
    const no = await mk(...base, ["2026-09-01", "sentadilla", 110]);    // 29 días
    assert.equal((await prs(no.db)).e.prlt, undefined);
    // entrenar sin récord en medio no reinicia: cuenta desde el último récord
    const mid = await mk(...base, ["2026-08-20", "sentadilla", 90], ["2026-09-05", "sentadilla", 110]);
    assert.equal((await prs(mid.db)).e.prlt, "2026-09-05");
  });

  test("warm-up sets never count", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, lift(ids, "2026-10-01", "sentadilla", 100),
      sess(ids, "2026-10-03", [["sentadilla", [[150, 5, "warm"], [100, 5]]]]));
    assert.equal((await prs(db)).n, 0);
  });
});

describe("volumen", () => {
  const vol = db => run(db, () => { const r = replayLogros(); return { e: r.earned, st: { tons: r.st.tons, sets: r.st.sets, reps: r.st.reps, dayTons: r.st.dayTons } }; });
  const rows = (n, kg, reps) => Array.from({ length: n }, () => [kg, reps]);

  test("t6 tonnage", async () => {
    const a = await blankDB(ctx);
    addS(a.db, sess(a.ids, "2026-10-01", [["sentadilla", rows(6, 100, 10)]]));
    const r = await vol(a.db);
    assert.equal(r.st.tons, 6000);
    assert.equal(r.e.t6, "2026-10-01");
    const b = await blankDB(ctx);
    addS(b.db, sess(b.ids, "2026-10-01", [["sentadilla", [...rows(5, 100, 10), [99.9, 10]]]]));
    assert.equal((await vol(b.db)).e.t6, undefined);
  });

  test("t6 accumulates across sessions; strings and junk are parsed defensively", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, sess(ids, "2026-10-01", [["sentadilla", rows(3, 100, 10)]]), sess(ids, "2026-10-02", [["sentadilla", rows(3, 100, 10)]]));
    db.sessions["2026-10-02"].exercises[0].sets[0].kg = "100";
    db.sessions["2026-10-02"].exercises[0].sets[1].reps = "8-12";
    db.sessions["2026-10-02"].exercises[0].sets[2].kg = "";
    const r = await vol(db);
    assert.equal(r.st.tons, 3000 + 1000 + 800);
  });

  test("s10 single-session tonnage", async () => {
    const a = await blankDB(ctx);
    addS(a.db, sess(a.ids, "2026-10-01", [["sentadilla", rows(5, 100, 10)]]), sess(a.ids, "2026-10-02", [["sentadilla", rows(5, 100, 10)]]));
    const ra = await vol(a.db);
    assert.equal(ra.e.s10, undefined);          // 5 t + 5 t no es una sesión de 10 t
    const b = await blankDB(ctx);
    addS(b.db, sess(b.ids, "2026-10-01", [["sentadilla", rows(10, 100, 10)]]));
    const rb = await vol(b.db);
    assert.equal(rb.e.s10, "2026-10-01");
    assert.equal(rb.e.s20, undefined);
  });

  test("n100 sets / rp10k reps; warm-ups excluded", async () => {
    const a = await blankDB(ctx);
    addS(a.db, sess(a.ids, "2026-10-01", [["sentadilla", [...rows(99, 10, 1), [100, 5, "warm"]]]]));
    const ra = await vol(a.db);
    assert.equal(ra.st.sets, 99);
    assert.equal(ra.e.n100, undefined);
    addS(a.db, sess(a.ids, "2026-10-02", [["sentadilla", rows(1, 10, 1)]]));
    assert.equal((await vol(a.db)).e.n100, "2026-10-02");
    const b = await blankDB(ctx);
    addS(b.db, sess(b.ids, "2026-10-01", [["sentadilla", rows(9, 1, 1000)]]), sess(b.ids, "2026-10-02", [["sentadilla", rows(1, 1, 1000)]]));
    const rb = await vol(b.db);
    assert.equal(rb.e.rp10k, "2026-10-02");
  });
});

describe("habitos", () => {
  const hab = db => run(db, () => { const r = replayLogros(); return { e: r.earned, st: { notes: r.st.notes, warms: r.st.warms, supers: r.st.supers, allDone: r.st.allDone, bwN: r.st.bwN, ex: r.st.exSeen.size, legsRun: r.st.legsRun } }; });
  const one = (ids, k, o, exs) => sess(ids, k, exs || [["sentadilla", [[100, 5]]]], o);

  test("no10: session note only, exercise notes ignored", async () => {
    const { db, ids } = await blankDB(ctx);
    const ds = days("2026-10-01", 10);
    addS(db, ...ds.map((k, i) => one(ids, k, { note: i < 9 ? "  buen día " : "   " }, [["sentadilla", [[100, 5]], { note: "nota de ejercicio" }]])));
    const a = await hab(db);
    assert.equal(a.st.notes, 9);
    assert.equal(a.e.no10, undefined);
    db.sessions[ds[9]].note = "x";
    const b = await hab(db);
    assert.equal(b.e.no10, ds[9]);
    assert.equal(b.e.no50, undefined);
  });

  test("wu10 / ss5 count sessions, not sets", async () => {
    const { db, ids } = await blankDB(ctx);
    const ds = days("2026-10-01", 10);
    addS(db, ...ds.map((k, i) => one(ids, k, {}, [["sentadilla", [[40, 5, "warm"], [40, 5, "warm"], [40, 5, "warm"], [100, 5]], i < 5 ? { ss: true } : {}]])));
    const r = await hab(db);
    assert.equal(r.st.warms, 10);
    assert.equal(r.e.wu10, ds[9]);
    assert.equal(r.st.supers, 5);
    assert.equal(r.e.ss5, ds[4]);
    // un ejercicio ss sin series hechas no cuenta
    const b = await blankDB(ctx);
    addS(b.db, one(b.ids, "2026-10-01", {}, [["sentadilla", [[100, 5]], { ss: true }]]));
    b.db.sessions["2026-10-01"].exercises[0].sets[0].done = false;
    assert.equal((await hab(b.db)).st.supers, 0);
  });

  test("wkd: Saturday and the following Sunday", async () => {
    const a = await blankDB(ctx);
    addS(a.db, squat(a.ids, "2026-10-10"), squat(a.ids, "2026-10-11"));
    assert.equal((await hab(a.db)).e.wkd, "2026-10-11");
    const b = await blankDB(ctx);
    addS(b.db, squat(b.ids, "2026-10-04"), squat(b.ids, "2026-10-10"));   // domingo antes del sábado
    assert.equal((await hab(b.db)).e.wkd, undefined);
    const m = await blankDB(ctx);                                         // cruce de mes
    addS(m.db, squat(m.ids, "2026-10-31"), squat(m.ids, "2026-11-01"));
    assert.equal((await hab(m.db)).e.wkd, "2026-11-01");
    const c = await blankDB(ctx);
    addS(c.db, squat(c.ids, "2026-10-10"), squat(c.ids, "2026-10-18"));   // domingo de la semana siguiente
    assert.equal((await hab(c.db)).e.wkd, undefined);
  });

  test("al10: every set done", async () => {
    const { db, ids } = await blankDB(ctx);
    const ds = days("2026-10-01", 10);
    addS(db, ...ds.map(k => one(ids, k, {}, [["sentadilla", [[40, 5, "warm"], [100, 5], [100, 5]]]])));
    db.sessions[ds[3]].exercises[0].sets[2].done = false;
    const a = await hab(db);
    assert.equal(a.st.allDone, 9);
    assert.equal(a.e.al10, undefined);
    db.sessions[ds[3]].exercises[0].sets[2].done = true;
    assert.equal((await hab(db)).e.al10, ds[9]);
    // sin series no cuenta
    const b = await blankDB(ctx);
    addS(b.db, one(b.ids, "2026-10-01", {}, [["sentadilla", []]]));
    assert.equal((await hab(b.db)).st.allDone, 0);
  });

  test("bw10 counts entries, including days without a session", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, squat(ids, "2026-10-01"));
    days("2026-10-01", 9).forEach((k, i) => bw(db, k, 80 + i / 10));
    const a = await hab(db);
    assert.equal(a.st.bwN, 9);
    assert.equal(a.e.bw10, undefined);
    bw(db, "2026-10-20", 81);                     // día sin entreno
    const b = await hab(db);
    assert.equal(b.e.bw10, "2026-10-20");
  });

  test("ex25 distinct exercises with a work set", async () => {
    const { db, ids } = await blankDB(ctx);
    const names = Object.keys(ids);
    addS(db, one(ids, "2026-10-01", {}, names.slice(0, 24).map(n => [n, [[50, 5]]])));
    addS(db, one(ids, "2026-10-02", {}, [[names[0], [[50, 5]]], [names[24], [[50, 5, "warm"]]]]));   // repetido + solo calentamiento
    const a = await hab(db);
    assert.equal(a.st.ex, 24);
    assert.equal(a.e.ex25, undefined);
    addS(db, one(ids, "2026-10-03", {}, [[names[24], [[50, 5]]]]));
    assert.equal((await hab(db)).e.ex25, "2026-10-03");
  });

  test("mg7: Piernas or Glúteo counts as legs", async () => {
    const week = [["press banca", "Pecho"], ["dominadas", "Espalda"], ["puente de glúteo", "Glúteo"], ["press militar", "Hombros"], ["curl bíceps", "Bíceps"], ["fondos", "Tríceps"], ["plancha", "Core"]];
    const mk = (b, k, list) => addS(b.db, one(b.ids, k, {}, list.map(([n, m]) => [n, [[50, 5]], { muscle: m }])));
    const a = await blankDB(ctx);
    mk(a, "2026-10-05", week.slice(0, 4));      // lunes
    mk(a, "2026-10-07", week.slice(4));         // miércoles
    assert.equal((await hab(a.db)).e.mg7, "2026-10-07");
    const b = await blankDB(ctx);               // la misma mezcla partida entre domingo y lunes: semanas distintas
    mk(b, "2026-10-04", week.slice(0, 4));
    mk(b, "2026-10-05", week.slice(4));
    assert.equal((await hab(b.db)).e.mg7, undefined);
    const c = await blankDB(ctx);               // solo calentamiento en Core no cuenta
    mk(c, "2026-10-05", week.slice(0, 6));
    addS(c.db, one(c.ids, "2026-10-06", {}, [["plancha", [[0, 5, "warm"]], { muscle: "Core" }]]));
    assert.equal((await hab(c.db)).e.mg7, undefined);
  });
});

describe("secretos", () => {
  const sec = db => run(db, () => replayLogros().earned);

  test("early 04:00–05:59 / owl 23:00–02:59", async () => {
    const t = async (start, mins) => { const { db, ids } = await blankDB(ctx); addS(db, squat(ids, "2026-10-01", { start, mins })); return sec(db); };
    assert.equal((await t("05:59", 30)).early, "2026-10-01");
    assert.equal((await t("04:00", 30)).early, "2026-10-01");
    assert.equal((await t("03:59", 30)).early, undefined);
    assert.equal((await t("06:00", 30)).early, undefined);
    assert.equal((await t("23:30", 60)).owl, "2026-10-01");     // termina 00:30
    assert.equal((await t("22:00", 60)).owl, "2026-10-01");     // termina 23:00
    assert.equal((await t("21:59", 60)).owl, undefined);        // termina 22:59
    assert.equal((await t("01:30", 89)).owl, "2026-10-01"); // termina 02:59
    assert.equal((await t("02:00", 60)).owl, undefined);        // termina 03:00
  });

  test("time badges skip sessions without times", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, squat(ids, "2026-10-01", { mins: null }), sess(ids, "2026-10-02", [["sentadilla", [[100, 5], [100, 5], [100, 5], [100, 5], [100, 5], [100, 5]]]], { mins: null }));
    const e = await sec(db);
    for (const id of ["early", "owl", "mara", "expr"]) assert.equal(e[id], undefined, id);
  });

  test("mara ≥ 2 h; expr < 20 min with ≥ 6 work sets, all done", async () => {
    const six = Array.from({ length: 6 }, () => [100, 5]);
    const t = async (sets, o, undone) => { const { db, ids } = await blankDB(ctx); addS(db, sess(ids, "2026-10-01", [["sentadilla", sets]], o)); if (undone) db.sessions["2026-10-01"].exercises[0].sets[0].done = false; return sec(db); };
    assert.equal((await t(six, { start: "10:00", mins: 120 })).mara, "2026-10-01");
    assert.equal((await t(six, { start: "10:00", mins: 119 })).mara, undefined);
    assert.equal((await t(six, { mins: 19 })).expr, "2026-10-01");
    assert.equal((await t(six, { mins: 20 })).expr, undefined);
    assert.equal((await t(six.slice(0, 5), { mins: 15 })).expr, undefined);
    assert.equal((await t(six, { mins: 15 }, true)).expr, undefined);
    assert.equal((await t([...six.slice(0, 5), [40, 5, "warm"]], { mins: 15 })).expr, undefined);   // 5 de trabajo + 1 calentamiento
    assert.equal((await t(six, { mins: 12 * 60 })).mara, undefined);                                 // duración absurda: sessionDur null
  });

  test("ny / xmas / f13", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, squat(ids, "2026-01-01"), squat(ids, "2025-12-25"), squat(ids, "2026-11-13"), squat(ids, "2026-10-13"));
    const e = await sec(db);
    assert.equal(e.ny, "2026-01-01");
    assert.equal(e.xmas, "2025-12-25");
    assert.equal(e.f13, "2026-11-13");
    const b = await blankDB(ctx);               // 13 de octubre de 2026 es martes; 1 de feb es domingo
    addS(b.db, squat(b.ids, "2026-10-13"), squat(b.ids, "2026-02-01"));
    const eb = await sec(b.db);
    assert.equal(eb.f13, undefined); assert.equal(eb.ny, undefined); assert.equal(eb.xmas, undefined);
  });

  test("legs: 8 consecutive weeks with Piernas/Glúteo", async () => {
    const leg = (ids, k, m = "Piernas", t) => sess(ids, k, [["sentadilla", [[100, 5, t]], { muscle: m }]]);
    const mondays = n => Array.from({ length: n }, (_, i) => { const d = new Date("2026-08-03T12:00:00"); d.setDate(d.getDate() + 7 * i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
    const a = await blankDB(ctx);
    const m = mondays(8);
    addS(a.db, ...m.map((k, i) => leg(a.ids, k, i % 2 ? "Glúteo" : "Piernas")));
    assert.equal((await sec(a.db)).legs, m[7]);
    const b = await blankDB(ctx);               // semana 5 sin pierna: se corta
    addS(b.db, ...m.map((k, i) => i === 4 ? squat(b.ids, k) : leg(b.ids, k)));
    assert.equal((await sec(b.db)).legs, undefined);
    const c = await blankDB(ctx);               // 7 semanas + calentamiento en la 8.ª
    addS(c.db, ...m.map((k, i) => i === 7 ? leg(c.ids, k, "Piernas", "warm") : leg(c.ids, k)));
    assert.equal((await sec(c.db)).legs, undefined);
    const d = await blankDB(ctx);               // dos sesiones de pierna en la misma semana no suman dos
    addS(d.db, ...m.slice(0, 7).flatMap(k => [leg(d.ids, k), leg(d.ids, k.slice(0, 8) + String(+k.slice(8) + 1).padStart(2, "0"))]));
    assert.equal((await sec(d.db)).legs, undefined);
  });
});

describe("catalog", () => {
  const cat = db => run(db, () => LOGROS.map(({ id, fam, grade, title, req, scope, after, meta, from, to, retro }) =>
    ({ id, fam, grade, title, req, scope, after, meta, from, to, retro, okFam: fam in FAM, okGrade: grade in GRADE, hasTest: typeof LOGROS.find(b => b.id === id).test === "function" })));

  test("catalog: 77 core + 1 season, unique ids", async () => {
    const { db } = await blankDB(ctx);
    const c = await cat(db);
    assert.equal(new Set(c.map(b => b.id)).size, c.length);
    assert.equal(c.filter(b => b.scope === "core").length, 77);
    assert.deepEqual(c.filter(b => b.scope === "season").map(b => b.id), ["dic26"]);
    for (const b of c) {
      assert.ok(b.okFam && b.okGrade && b.hasTest, b.id);
      assert.ok(typeof b.title === "string" && b.title && typeof b.req === "string" && b.req, b.id);
      assert.ok(["core", "season"].includes(b.scope), b.id);
    }
  });

  test("catalog: grades 26/30/20/1 and 2,210 core pts", async () => {
    const { db } = await blankDB(ctx);
    const out = await run(db, () => {
      const core = LOGROS.filter(b => b.scope === "core"), g = {};
      core.forEach(b => g[b.grade] = (g[b.grade] || 0) + 1);
      return { g, pts: core.reduce((a, b) => a + GRADE[b.grade].pts, 0) };
    });
    assert.deepEqual(out.g, { B: 26, P: 30, O: 20, X: 1 });
    assert.equal(out.pts, 2210);
  });

  test("catalog: titles and req match spec §2", async () => {
    const { db } = await blankDB(ctx);
    const by = Object.fromEntries((await cat(db)).map(b => [b.id, [b.title, b.req, b.grade]]));
    const spec = {
      c1: ["primer paso", "primer entreno terminado", "B"],
      pc3: ["3 plate club", "140 kg / 315 lb", "O"],
      prb3: ["triple corona", "récord en sentadilla, banca y peso muerto la misma semana", "P"],
      t150: ["una ballena azul", "150 t en total", "P"],
      mg7: ["cuerpo completo", "todos los grupos musculares en una semana", "P"],
      owl: ["búho", "terminar un entreno entre las 23:00 y las 2:59", "B"],
      plat: ["trck3r 100%", "todos los logros de constancia, récords, volumen y hábitos, y una vía de fuerza completa", "X"],
      dic26: ["diciembre de hierro", "12 entrenos en diciembre de 2026", "P"],
    };
    for (const id in spec) assert.deepEqual(by[id], spec[id], id);
  });

  test("catalog: every after points to an existing id", async () => {
    const { db } = await blankDB(ctx);
    const c = await cat(db), ids = new Set(c.map(b => b.id));
    for (const b of c) if (b.after != null) { assert.ok(ids.has(b.after), b.id); assert.notEqual(b.after, b.id); }
  });

  test("summary ignores unknown stored ids", async () => {
    const { db } = await blankDB(ctx);
    db.logros = { c1: { d: "2026-10-01", seen: true }, zzz: { d: "2026-12-31", seen: false } };
    const s = await run(db, () => logrosSummary());
    assert.equal(s.n, 1);
    assert.equal(s.pts, 10);
    assert.deepEqual(s.last, { id: "c1", d: "2026-10-01" });
    delete db.logros;                           // sin DB.logros: todo a cero
    const z = await run(db, () => logrosSummary());
    assert.deepEqual([z.n, z.pts, z.pct, z.total, z.last, z.season], [0, 0, 0, 77, null, { n: 0 }]);
  });
});

// replay con las insignias de las familias dadas ya ganadas (seed de prueba); drop las quita
const PLAT_BASE = ["constancia", "records", "volumen", "habitos"];
const platRun = (db, fams, tracks, drop = []) => run(db, ([fams, tracks, drop]) => {
  const ids = LOGROS.filter(b => b.scope === "core" && (fams.includes(b.fam) || (b.fam === "fuerza" && tracks.includes(b.track))) && !drop.includes(b.id)).map(b => b.id);
  const r = replayLogros({ seed: Object.fromEntries(ids.map(id => [id, "2026-01-01"])) });
  return { n: ids.length, e: r.earned };
}, [fams, tracks, drop]);

describe("platino", () => {
  test("platino via the dumbbell track", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, squat(ids, "2026-10-01"));
    const { n, e } = await platRun(db, PLAT_BASE, ["mancuernas"]);
    assert.equal(n, 48 + 4);
    assert.equal(e.plat, "2026-10-01");         // la fase meta lo gana en la primera fecha recorrida
    assert.equal(e.c1, "2026-01-01");           // lo sembrado se conserva
  });

  test("platino via the barbell track", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, squat(ids, "2026-10-01"));
    const { n, e } = await platRun(db, PLAT_BASE, ["barra"]);
    assert.equal(n, 48 + 16);
    assert.equal(e.plat, "2026-10-01");
  });

  test("platino and its last prerequisite same day → same date", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, squat(ids, "2026-10-01"), squat(ids, "2026-10-02"), squat(ids, "2026-10-03"));
    const { n, e } = await platRun(db, PLAT_BASE, ["mancuernas"], ["r3"]);
    assert.equal(n, 47 + 4);
    assert.equal(e.r3, "2026-10-03");
    assert.equal(e.plat, "2026-10-03");
  });

  test("platino not earned with 47 + 4", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, squat(ids, "2026-10-01"));
    const a = await platRun(db, PLAT_BASE, ["mancuernas"], ["w52"]);
    assert.equal(a.n, 47 + 4);
    assert.equal(a.e.plat, undefined);
    const b = await platRun(db, PLAT_BASE, ["mancuernas"], ["rw40"]);   // 48 + 3
    assert.equal(b.e.plat, undefined);
    const c = await platRun(db, PLAT_BASE.concat("secretos"), ["barra"], ["k1000"]);   // 48 + 15 + secretos
    assert.equal(c.e.plat, undefined);
  });

  // R8: lo guardado en DB.logros entra en earned con su fecha; la fase meta solo ve lo ganado hasta el día recorrido
  test("stored badges pre-fill earned and keep their date", async () => {
    const { db } = await blankDB(ctx);
    db.logros = { c10: { d: "2026-10-10", seen: true }, c1: { d: "2026-10-01", seen: true }, zzz: { d: "2026-10-02", seen: true } };
    const out = await run(db, () => {
      const a = replayLogros().earned, b = replayLogros({ seed: { c1: "2026-01-01" } }).earned;
      return { a, b, last: _lgLast.earned.c1 };
    });
    assert.deepEqual(out.a, { c10: "2026-10-10", c1: "2026-10-01" });   // ids desconocidos fuera
    assert.equal(out.b.c1, "2026-01-01");                                // seed encima de lo guardado
    assert.equal(out.last, "2026-10-01");                                // un replay con seed no toca _lgLast
  });

  test("platino from stored prerequisites: dated on the first walked day ≥ the last one", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, squat(ids, "2026-10-15"), squat(ids, "2026-10-25"));
    const req = await run(db, () => LOGROS.filter(b => b.scope === "core" && (["constancia", "records", "volumen", "habitos"].includes(b.fam) || b.track === "mancuernas")).map(b => b.id));
    assert.equal(req.length, 52);
    db.logros = Object.fromEntries(req.map((id, i) => [id, { d: i === 7 ? "2026-10-20" : "2026-10-01", seen: true }]));
    const e = await earnedOf(db);
    assert.equal(e.plat, "2026-10-25");          // no 10-15: ese día aún faltaba el requisito del 10-20
    assert.equal(e[req[7]], "2026-10-20");
    assert.equal(e.c1, "2026-10-01");            // lo guardado no se vuelve a fechar
  });

  test("platino: a stored prerequisite whose session was deleted still counts", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, squat(ids, "2026-10-05"));          // un solo entreno: r3 no puede salir del historial
    db.logros = { r3: { d: "2026-10-03", seen: true } };
    const { e } = await platRun(db, PLAT_BASE, ["mancuernas"], ["r3"]);
    assert.equal(e.r3, "2026-10-03");
    assert.equal(e.plat, "2026-10-05");
    delete db.logros;
    assert.equal((await platRun(db, PLAT_BASE, ["mancuernas"], ["r3"])).e.plat, undefined);
  });

  test("platReq follows the closer strength track", async () => {
    const { db } = await blankDB(ctx);
    const out = await run(db, () => {
      const m = ids => Object.fromEntries(ids.map(id => [id, "2026-01-01"]));
      return [platReq({}), platReq(m(["c1", "pc1", "pc2", "pc3", "pc4", "lv2", "db20", "early", "dic26", "zzz"])),
        platReq(m(["c1", "db20", "db30", "pc1"])), platReq(m(["c1", "plat"])),
        platReq({ c1: "2026-10-01", c10: "2026-10-10" }, "2026-10-05")];
    });
    assert.deepEqual(out[0], { cur: 0, goal: 52 });     // empate: la de menos pendientes
    assert.deepEqual(out[1], { cur: 6, goal: 64 });     // barra 5/16 > mancuernas 1/4; secretos y temporada no cuentan
    assert.deepEqual(out[2], { cur: 3, goal: 52 });     // mancuernas 2/4 > barra 1/16
    assert.deepEqual(out[3], { cur: 1, goal: 52 });     // platino no se exige a sí mismo
    assert.deepEqual(out[4], { cur: 1, goal: 52 });     // con day: solo lo ganado hasta ese día
  });
});

describe("temporadas", () => {
  // el arranque ya escribió fecha de visto y guardó logros: el replay se prueba con la fecha dada y nada guardado
  const dic = (db, seenAt) => run(db, sa => {
    DB.logros = {}; if (sa === null) delete DB.settings.logrosSeenAt; else DB.settings.logrosSeenAt = { dic26: sa };
    const r = replayLogros(); return { d: r.earned.dic26, n: r.st.win.dic26.sessions }; }, seenAt === undefined ? null : seenAt);

  test("dic26: Nov 2026 sessions don't count", async () => {
    const { db, ids } = await blankDB(ctx);
    days("2026-11-19", 12).forEach(k => addS(db, squat(ids, k)));
    assert.deepEqual(await dic(db, "2026-11-20"), { d: undefined, n: 0 });
    days("2026-12-01", 11).forEach(k => addS(db, squat(ids, k)));   // 12 de nov + 11 de dic
    assert.deepEqual(await dic(db, "2026-11-20"), { d: undefined, n: 11 });
  });

  test("dic26: 11 in Dec → none; 12th → dated that day", async () => {
    const { db, ids } = await blankDB(ctx);
    days("2026-12-01", 11).forEach(k => addS(db, squat(ids, k)));
    assert.deepEqual(await dic(db, "2026-11-20"), { d: undefined, n: 11 });
    addS(db, squat(ids, "2026-12-20"), squat(ids, "2027-01-02"));
    assert.deepEqual(await dic(db, "2026-11-20"), { d: "2026-12-20", n: 12 });
  });

  test("dic26: Dec 2025 doesn't count", async () => {
    const { db, ids } = await blankDB(ctx);
    days("2025-12-01", 31).forEach(k => addS(db, squat(ids, k)));
    assert.deepEqual(await dic(db, "2025-11-01"), { d: undefined, n: 0 });   // la ventana sola ya lo excluye
    assert.deepEqual(await dic(db, "2026-11-20"), { d: undefined, n: 0 });
  });

  test("dic26: retro false, so sessions before seen-at don't count", async () => {
    const { db, ids } = await blankDB(ctx);
    days("2026-12-01", 12).forEach(k => addS(db, squat(ids, k)));
    assert.deepEqual(await dic(db, "2026-12-10"), { d: undefined, n: 3 });
    assert.deepEqual(await dic(db), { d: undefined, n: 0 });        // sin fecha de visto: no se puede ganar
    days("2026-12-13", 9).forEach(k => addS(db, squat(ids, k)));
    assert.deepEqual(await dic(db, "2026-12-10"), { d: "2026-12-21", n: 12 });
  });

  test("summary ignores the season in n/total/pct but adds its pts", async () => {
    const { db } = await blankDB(ctx);
    db.logros = { c1: { d: "2026-10-01", seen: true }, pc1: { d: "2026-10-03", seen: true } };
    const a = await run(db, () => logrosSummary());
    db.logros.dic26 = { d: "2026-12-20", seen: false };
    const b = await run(db, () => logrosSummary());
    assert.deepEqual([a.n, a.total, a.pct, a.pts, a.season, a.last], [2, 77, 3, 20, { n: 0 }, { id: "pc1", d: "2026-10-03" }]);
    assert.deepEqual([b.n, b.total, b.pct, b.pts, b.season, b.last], [2, 77, 3, 45, { n: 1 }, { id: "dic26", d: "2026-12-20" }]);
    assert.deepEqual(b.fam.constancia, { n: 1, total: 17 });
    assert.deepEqual(b.fam.fuerza, { n: 1, total: 20 });
    assert.deepEqual(b.fam.platino, { n: 0, total: 1 });
    assert.equal(b.fam.temporadas, undefined);
  });
});

describe("sync", () => {
  const dbOf = p => p.evaluate(() => JSON.parse(JSON.stringify(DB)));
  const stored = p => p.evaluate(() => JSON.parse(localStorage.getItem("gymtracker_uni_v1")));
  // abre, espera la nav y devuelve el DB tal como quedó tras el arranque
  const boot = async (db, o) => { const p = await open(ctx, db, o); await p.waitForSelector(".nav"); return p; };
  const lw = p => p.warns.filter(w => w.startsWith("logros"));         // avisos del catch de logros

  test("first boot: retroactive and seen", async () => {
    const { db, ids } = await blankDB(ctx);
    days("2026-10-01", 10).forEach(k => addS(db, squat(ids, k)));
    const p = await boot(db);
    const d = await dbOf(p), ls = await stored(p);
    assert.deepEqual(d.logros.c10, { d: "2026-10-10", seen: true });
    assert.deepEqual(d.logros.c1, { d: "2026-10-01", seen: true });
    assert.equal(d.settings.logrosInit, true);
    assert.deepEqual(ls.logros, d.logros);                 // guardado en localStorage
    assert.equal(ls.settings.logrosInit, true);
    assert.equal(await p.locator("#achToast").count(), 1);               // el elemento existe…
    assert.equal(await p.isVisible("#achToast"), false);                 // …y sigue oculto
    assert.equal(await p.evaluate(() => window._achShown || 0), 0);      // y nunca avisó
    assert.deepEqual([p.errors, lw(p)], [[], []]);
    await p.context().close();
  });

  test("later boots mark new unlocks unseen", async () => {
    const { db, ids } = await blankDB(ctx);
    days("2026-10-01", 9).forEach(k => addS(db, squat(ids, k)));
    let p = await boot(db);
    const d = await dbOf(p); await p.context().close();
    assert.equal(d.logros.c10, undefined);
    addS(d, squat(ids, "2026-10-10"));                    // el 10º, añadido a mano
    p = await boot(d);
    const e = await dbOf(p);
    assert.deepEqual(e.logros.c10, { d: "2026-10-10", seen: false });
    assert.deepEqual(e.logros.c1, { d: "2026-10-01", seen: true });   // lo de antes no cambia
    await p.context().close();
  });

  test("never removes badges", async () => {
    const { db, ids } = await blankDB(ctx);
    db.settings.logrosInit = true;
    db.logros = { pc3: { d: "2026-09-01", seen: true } };
    addS(db, sess(ids, "2026-10-01", [["press banca", [[40, 5]]]]));   // sin sentadillas
    const p = await boot(db);
    await p.reload(); await p.waitForSelector(".nav");
    const d = await dbOf(p);
    assert.deepEqual(d.logros.pc3, { d: "2026-09-01", seen: true });
    assert.deepEqual((await stored(p)).logros.pc3, { d: "2026-09-01", seen: true });
    await p.context().close();
  });

  test("old backup import replays quietly", async () => {
    const { db, ids } = await blankDB(ctx);
    const old = structuredClone(db);
    delete old.settings.logrosInit; delete old.settings.logrosSeenAt;
    days("2026-10-01", 10).forEach(k => addS(old, squat(ids, k)));
    const p = await boot(db);
    const d = await p.evaluate(o => { window._imp = o; commitImport(); return JSON.parse(JSON.stringify(DB)); }, old);
    assert.deepEqual(d.logros.c10, { d: "2026-10-10", seen: false });
    assert.deepEqual(d.logros.c1, { d: "2026-10-01", seen: false });
    assert.deepEqual((await stored(p)).logros.c10, { d: "2026-10-10", seen: false });
    assert.equal(await p.locator("#achToast").count(), 1);               // el elemento existe…
    assert.equal(await p.isVisible("#achToast"), false);                 // …y sigue oculto
    assert.equal(await p.evaluate(() => window._achShown || 0), 0);      // y nunca avisó
    await p.context().close();
  });

  test("deleting the demo changes nothing", async () => {
    const { db, ids } = await blankDB(ctx);
    Object.assign(db.settings, { demo: true, demoUntil: "2026-09-30" });
    days("2026-09-01", 20).forEach(k => addS(db, squat(ids, k)));     // demo: no cuenta
    days("2026-10-01", 3).forEach(k => addS(db, squat(ids, k)));
    const p = await boot(db);
    const before = (await dbOf(p)).logros;
    assert.deepEqual(before.r3, { d: "2026-10-03", seen: true });
    assert.equal(before.c10, undefined);
    await p.evaluate(() => A.startFresh());
    assert.deepEqual((await dbOf(p)).logros, before);
    assert.deepEqual((await stored(p)).logros, before);
    await p.context().close();
  });

  test("malformed history doesn't break boot", async () => {
    const { db, ids } = await blankDB(ctx);
    const [k1, s1] = sess(ids, "2026-10-01", [["sentadilla", [["", 5], [100, "8-12"]]], ["press banca", [[60, 8]]]]);
    delete s1.exercises[1].sets;                                       // ejercicio sin sets
    const [k2, s2] = squat(ids, "2026-10-02"); s2.exercises = "oops"; // exercises no es un array
    const [k3, s3] = squat(ids, "2026-10-03"); s3.exercises = { a: 1 };
    const [k5, s5] = squat(ids, "2026-10-05");                         // exercises y sets con forma de objeto {0:…, 1:…}
    s5.exercises = { 0: { ...s5.exercises[0], sets: { 0: { kg: 150, reps: "3", done: true, type: "work" }, 1: { kg: 120, reps: "5", done: true, type: "work" } } } };
    addS(db, [k1, s1], [k2, s2], [k3, s3], squat(ids, "2026-10-04"), [k5, s5]);
    bw(db, "2026-10-01", "80");
    const p = await boot(db);
    await p.reload(); await p.waitForSelector(".nav");
    const d = await dbOf(p);
    assert.deepEqual(p.errors, []);
    assert.deepEqual(lw(p), []);                                       // load() lo normaliza, no hace falta el catch
    assert.equal(d.logros.c1.d, "2026-10-01");
    assert.equal(d.logros.r3.d, "2026-10-03");                          // las sesiones raras cuentan como días
    assert.equal(await p.evaluate(() => replayLogros().st.liftW.sq), 150);   // 100 × "8-12" → 8 reps; el objeto-set de 150 se conserva
    assert.equal(await p.evaluate(() => DB.sessions["2026-10-05"].exercises[0].sets.length), 2);
    assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem(KEY)).sessions["2026-10-05"].exercises[0].sets.length), 2);   // y save() no lo pierde
    await p.context().close();
  });

  test("a throwing replay only warns", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, squat(ids, "2026-10-01"));
    const p = await boot(db);
    const out = await p.evaluate(() => {
      const f = window.replayLogros; window.replayLogros = () => { throw new Error("x"); };
      try { bootLogros(); window._imp = JSON.parse(JSON.stringify(DB)); commitImport(); return document.querySelector(".nav") !== null; }
      finally { window.replayLogros = f; }
    });
    assert.equal(out, true);
    assert.deepEqual(p.errors, []);
    assert.equal(lw(p).length, 2);
    await p.context().close();
  });

  test("corrupt logros value becomes {}", async () => {
    for (const bad of ["oops", ["c1"], null, 5]) {
      const { db, ids } = await blankDB(ctx);
      db.logros = bad; db.settings.logrosSeenAt = "x";
      addS(db, squat(ids, "2026-10-01"));
      const p = await boot(db);
      const d = await dbOf(p);
      assert.equal(typeof d.logros, "object"); assert.equal(Array.isArray(d.logros), false);
      assert.deepEqual(d.logros.c1, { d: "2026-10-01", seen: true });   // reconstruido por el replay
      assert.equal(d.settings.logrosSeenAt.dic26, "2026-11-06");
      assert.deepEqual(p.errors, []);
      await p.context().close();
    }
  });

  test("seen-at written once", async () => {
    const { db } = await blankDB(ctx);
    let p = await boot(db);
    let d = await dbOf(p); await p.context().close();
    assert.equal(d.settings.logrosSeenAt.dic26, "2026-11-06");
    assert.equal(d.settings.logrosSeenAt.c1, "2026-11-06");
    p = await boot(d, { now: "2026-11-20T12:00:00" });
    d = await dbOf(p);
    await p.reload(); await p.waitForSelector(".nav");
    assert.equal((await dbOf(p)).settings.logrosSeenAt.dic26, "2026-11-06");
    assert.equal(d.settings.logrosSeenAt.dic26, "2026-11-06");
    await p.context().close();
  });

  test("unknown stored id is kept", async () => {
    const { db, ids } = await blankDB(ctx);
    db.settings.logrosInit = true;
    db.logros = { zzz: { d: "2026-10-02", seen: false }, constructor: { d: "2026-10-02", seen: false } };
    addS(db, squat(ids, "2026-10-01"));
    const p = await boot(db);
    const out = await p.evaluate(() => { const n = syncLogros("quiet");
      const known = Object.keys(DB.logros).filter(id => id !== "zzz" && id !== "constructor");
      return { n, L: DB.logros, s: logrosSummary(), known: known.length, pts: known.reduce((a, id) => a + GRADE[LGI[id].grade].pts, 0),
        e: replayLogros().earned, pr: logroProg("constructor") }; });
    assert.deepEqual(out.L.zzz, { d: "2026-10-02", seen: false });
    assert.deepEqual(out.L.constructor, { d: "2026-10-02", seen: false });
    assert.deepEqual(out.n, []);                                       // c1 ya se guardó al arrancar
    assert.deepEqual(out.L.c1, { d: "2026-10-01", seen: false });
    assert.ok(out.known >= 1);
    assert.equal(out.s.n, out.known);                                  // zzz y constructor no cuentan
    assert.equal(out.s.pts, out.pts);
    assert.equal(Object.prototype.hasOwnProperty.call(out.e, "constructor"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(out.e, "zzz"), false);
    assert.equal(out.pr, null);
    await p.context().close();
  });

  test("logroProg is null for a stored badge", async () => {
    const { db, ids } = await blankDB(ctx);
    gen(ids, 61).forEach(x => addS(db, x));
    db.settings.logrosInit = true;
    db.logros = { c100: { d: "2026-10-01", seen: true } };            // guardado aunque el historial no llegue
    const out = await run(db, () => { replayLogros(); return [logroProg("c100"), logroProg("c250")]; });
    assert.equal(out[0], null);
    assert.deepEqual(out[1], { cur: 61, goal: 250 });
  });

  test("syncLogros modes: live stores only live badges, finish the rest; ids in catalog order", async () => {
    const { db, ids } = await blankDB(ctx);
    db.settings.logrosInit = true;
    days("2026-10-01", 9).forEach(k => addS(db, squat(ids, k)));
    addS(db, sess(ids, "2026-11-06", [["press militar", [[60, 5]]]], { mins: null, finished: false }));
    const p = await boot(db);
    const out = await p.evaluate(() => {
      const ord = a => LOGROS.map(b => b.id).filter(id => a.includes(id));
      const live = syncLogros("live"), L1 = JSON.parse(JSON.stringify(DB.logros));
      const again = syncLogros("live");
      DB.sessions[curKey()].finished = true;
      const fin = syncLogros("finish");
      return { live, again, fin, L1, L: DB.logros, liveOk: live.every(id => LGI[id].live), ordOk: JSON.stringify(ord(live)) === JSON.stringify(live) && JSON.stringify(ord(fin)) === JSON.stringify(fin) };
    });
    assert.ok(out.live.length > 0);
    assert.equal(out.liveOk, true);
    assert.equal(out.ordOk, true);
    assert.ok(out.live.includes("oh60"));
    assert.equal(out.L1.c10, undefined);                               // c10 no es live
    assert.deepEqual(out.L1.oh60, { d: "2026-11-06", seen: false });
    assert.deepEqual(out.again, []);
    assert.ok(out.fin.includes("c10") && !out.fin.includes("oh60"));
    assert.deepEqual(out.L.c10, { d: "2026-11-06", seen: false });
    await p.context().close();
  });

  test("history edits sync quietly: detail close, delete, undo", async () => {
    const { db, ids } = await blankDB(ctx);
    db.settings.logrosInit = true;
    days("2026-10-01", 9).forEach(k => addS(db, squat(ids, k)));
    addS(db, squat(ids, "2026-10-22"));                                // 10º, tras 13 días
    let p = await boot(db);
    const r = await p.evaluate(() => {
      const o = {}, c = id => DB.logros[id] && { ...DB.logros[id] };
      o.boot = c("c10");
      // dsDelete: borrar el 10-09 deja un hueco de 14 días → "de vuelta" el 10-22
      _detailKey = "2026-10-09"; dsDelete(); o.del = c("back"); o.delC10 = c("c10"); o.n = Object.keys(DB.sessions).length;
      // deshacer: vuelve el 10-09; se simula un c10 aún no guardado para ver el sync del deshacer
      delete DB.logros.c10; document.getElementById("ta").click(); o.undo = c("c10");
      // dsClose: un 11º entreno metido en el detalle
      delete DB.logros.c10; delete DB.sessions["2026-10-22"]; syncLogros("quiet");
      DB.sessions["2026-10-23"] = JSON.parse(JSON.stringify(DB.sessions["2026-10-08"]));
      _detailKey = "2026-10-23"; dsClose(); o.close = c("c10");
      return o;
    });
    assert.deepEqual(r.boot, { d: "2026-10-22", seen: false });
    assert.deepEqual(r.del, { d: "2026-10-22", seen: false });
    assert.equal(r.n, 9);
    assert.deepEqual(r.delC10, { d: "2026-10-22", seen: false });   // 9 entrenos tras borrar: c10 se queda
    assert.deepEqual(r.undo, { d: "2026-10-22", seen: false });
    assert.deepEqual(r.close, { d: "2026-10-23", seen: false });
    assert.deepEqual([p.errors, lw(p)], [[], []]);
    await p.context().close();
  });

  // R11: registrar un entreno pasado no sincroniza; lo hace el cierre del detalle, ya con ejercicios
  const pastLog = (p, k) => p.evaluate(k => { openPastLog(); document.getElementById("pastd").value = k; createPastLog();
    return { has: !!DB.sessions[k], c10: DB.logros.c10 || null, key: _detailKey }; }, k);
  const nineDays = async () => { const { db, ids } = await blankDB(ctx); db.settings.logrosInit = true;
    days("2026-10-01", 9).forEach(k => addS(db, squat(ids, k))); return { db, ids }; };

  test("past log: nothing stored until the detail closes with exercises", async () => {
    const { db, ids } = await nineDays();
    const p = await boot(db);
    assert.deepEqual(await pastLog(p, "2026-10-25"), { has: true, c10: null, key: "2026-10-25" });
    const r = await p.evaluate(id => {
      openAddExercise("past"); pickEx(id, "past");                        // vuelve al detalle con 3 series hechas
      const mid = { key: _detailKey, c10: DB.logros.c10 || null, open: _sheetOpen };
      dsClose();
      return { mid, c10: DB.logros.c10, key: _detailKey, n: DB.sessions["2026-10-25"].exercises.length };
    }, ids["sentadilla"]);
    assert.deepEqual(r.mid, { key: "2026-10-25", c10: null, open: true });
    assert.deepEqual(r.c10, { d: "2026-10-25", seen: false });
    assert.equal(r.key, null);
    assert.equal(r.n, 1);
    await p.context().close();
  });

  test("an empty past log is deleted by every way of closing the sheet, and stores nothing", async () => {
    const { db } = await nineDays();
    const p = await boot(db);
    const ways = {
      listo: () => p.evaluate(() => dsClose()),
      x: () => p.click(".sheet-x"),
      overlay: () => p.evaluate(() => document.getElementById("overlay").click()),
      back: async () => { await p.evaluate(() => history.back()); await p.waitForFunction(() => !_sheetOpen); },
    };
    let day = 20;
    for (const [name, close] of Object.entries(ways)) {
      const k = `2026-10-${day++}`;
      assert.equal((await pastLog(p, k)).has, true, name);
      await close();
      const r = await p.evaluate(k => ({ has: k in DB.sessions, stored: k in JSON.parse(localStorage.getItem("gymtracker_uni_v1")).sessions,
        c10: DB.logros.c10 || null, key: _detailKey, open: _sheetOpen }), k);
      assert.deepEqual(r, { has: false, stored: false, c10: null, key: null, open: false }, name);
    }
    // y en el siguiente arranque tampoco aparece nada
    await p.reload(); await p.waitForSelector(".nav");
    assert.equal(await p.evaluate(() => DB.logros.c10 || null), null);
    assert.deepEqual([p.errors, lw(p)], [[], []]);
    await p.context().close();
  });

  test("sheets opened from inside the detail don't close it", async () => {
    const { db, ids } = await nineDays();
    const p = await boot(db);
    await pastLog(p, "2026-10-25");
    const r = await p.evaluate(id => {
      const seen = [];
      const look = () => seen.push([_detailKey, "2026-10-25" in DB.sessions, _sheetOpen]);
      openAddExercise("past"); look(); renderSessionDetail(); look();   // elegir ejercicio → volver
      dsAskDelete(); look(); renderSessionDetail(); look();               // ¿borrar? → volver
      openNewEx("past"); document.getElementById("nn").value = "press cerrado"; createEx("past"); look();
      return { seen, n: DB.sessions["2026-10-25"].exercises.length, c10: DB.logros.c10 || null };
    }, ids["sentadilla"]);
    r.seen.forEach(x => assert.deepEqual(x, ["2026-10-25", true, true]));
    assert.equal(r.n, 1);
    assert.equal(r.c10, null);                                           // aún sin cerrar: nada sincronizado
    await p.context().close();
  });

  test("import keeps a stored badge its history can't re-earn, and leaves logrosInit on", async () => {
    const { db, ids } = await blankDB(ctx);
    const bak = structuredClone(db);
    delete bak.settings.logrosInit;                                      // backup de antes del flag
    bak.logros = { pc4: { d: "2026-01-05", seen: true } };
    addS(bak, squat(ids, "2026-10-01"));                                // 100 kg: pc4 (180) no sale
    const p = await boot(db);
    const d = await p.evaluate(o => { window._imp = o; commitImport(); return JSON.parse(JSON.stringify(DB)); }, bak);
    assert.deepEqual(d.logros.pc4, { d: "2026-01-05", seen: true });
    assert.deepEqual(d.logros.c1, { d: "2026-10-01", seen: false });
    assert.equal(d.settings.logrosInit, true);
    assert.equal((await stored(p)).settings.logrosInit, true);
    await p.context().close();
  });

  test("saving a body weight syncs quietly", async () => {
    const { db, ids } = await blankDB(ctx);
    db.settings.logrosInit = true;
    addS(db, sess(ids, "2026-11-06", [["press banca", [[80, 5]]]]));   // R17: el peso cuenta para levantamientos de su día o posteriores
    const p = await boot(db);
    const r = await p.evaluate(() => { const a = DB.logros.bp1 || null; openBodyweight(); document.getElementById("bw").value = "80"; saveBw();
      return { a, b: DB.logros.bp1 }; });
    assert.equal(r.a, null);
    assert.deepEqual(r.b, { d: "2026-11-06", seen: false });           // banca 1× pc con el peso de hoy
    await p.context().close();
  });

  test("the live replay leaves logroProg on finished history", async () => {
    const { db, ids } = await blankDB(ctx);
    db.settings.logrosInit = true;
    days("2026-10-01", 5).forEach(k => addS(db, squat(ids, k)));
    addS(db, squat(ids, "2026-11-06", { mins: null, finished: false }));
    const out = await run(db, () => { replayLogros(); const a = logroProg("c10"); syncLogros("live"); replayLogros({ includeOpen: true });
      return [a, logroProg("c10")]; });
    assert.deepEqual(out, [{ cur: 5, goal: 10 }, { cur: 5, goal: 10 }]);
  });
});

describe("ui", () => {
  // abre datos › logros con el DB sembrado; devuelve la página lista
  async function lg(db, o = {}) {
    db.tab = "datos"; db.dataTab = "logros";
    const p = await open(ctx, db, o);
    await p.waitForSelector(".lgtile");
    return p;
  }
  const seeded = (db, extra = {}) => { db.logros = { c1: { d: "2026-10-01", seen: true }, pc1: { d: "2026-10-03", seen: true }, ...extra }; return db; };

  test("segments: historial · progreso · logros", async () => {
    const { db } = await blankDB(ctx);
    const p = await lg(seeded(db));
    assert.deepEqual(await p.$$eval(".dseg div", d => d.map(x => x.textContent.trim())), ["historial", "progreso", "logros"]);
    assert.equal(await p.textContent(".dseg div.on"), "logros");
    await p.context().close();
  });

  test("renders 78 tiles (77 + dic26)", async () => {
    const { db } = await blankDB(ctx);
    const p = await lg(seeded(db));
    assert.equal(await p.locator(".lgtile").count(), 78);
    assert.equal(await p.locator(".lgtile.sec").count(), 8);
    assert.deepEqual(await p.$$eval(".lgsec h3", h => h.map(x => x.textContent.split("·")[0].trim())),
      ["// platino", "// constancia", "// fuerza", "// récords", "// volumen", "// hábitos", "// secretos", "// temporadas"]);
    assert.deepEqual(p.errors, []);
    await p.context().close();
  });

  test("header: pts · n/77 · pct", async () => {
    const { db } = await blankDB(ctx);
    const p = await lg(seeded(db));
    assert.match(await p.textContent(".lghead"), /20 pts · 2\/77 · 3%/);
    assert.match(await p.textContent(".lghead"), /\/\/ último: /);
    await p.context().close();
  });

  test("filter chip shows one family", async () => {
    const { db } = await blankDB(ctx);
    const p = await lg(seeded(db));
    await p.evaluate(() => A.logroFam("secretos"));
    await p.waitForFunction(() => document.querySelectorAll(".lgtile").length === 8);
    assert.equal(await p.locator(".lgtile").count(), 8);
    assert.match(await p.textContent(".lgchips"), /récords/);
    await p.context().close();
  });

  test("locked secret shows ??? and logro secreto, no bar", async () => {
    const { db } = await blankDB(ctx);
    const p = await lg(seeded(db));
    const t = p.locator(".lgtile.sec").first();
    assert.match(await t.textContent(), /\?\?\?/);
    assert.match(await t.textContent(), /logro secreto/);
    assert.equal(await t.locator(".lgbar").count(), 0);
    await p.context().close();
  });

  test("event badges (wkd, pr3s, prlt, back) have no bar; counters keep it", async () => {
    const { db } = await blankDB(ctx);
    const p = await lg(seeded(db));
    for (const id of ["wkd", "pr3s", "prlt", "back"]) {
      const t = p.locator(`.lgtile[data-id="${id}"]`);
      assert.equal(await t.locator(".lgbar").count(), 0, id);
      assert.match(await t.textContent(), /\S/);
    }
    assert.equal(await p.locator('.lgtile[data-id="c10"] .lgbar').count(), 1);
    await p.context().close();
  });

  test("locked tile shows cur / goal bar", async () => {
    const { db, ids } = await blankDB(ctx);
    days("2026-08-01", 61).forEach(k => addS(db, squat(ids, k)));
    const p = await lg(db);
    const t = p.locator('.lgtile[data-id="c100"]');
    assert.match(await t.textContent(), /61 \/ 100/);
    assert.equal(await t.locator(".lgbar").count(), 1);
    await p.context().close();
  });

  test("dic26 states by date", async () => {
    const { db, ids } = await blankDB(ctx);
    let p = await lg(seeded(JSON.parse(JSON.stringify(db))));
    assert.match(await p.locator('.lgtile[data-id="dic26"]').textContent(), /empieza el 1 dic/);
    await p.context().close();
    p = await lg(seeded(JSON.parse(JSON.stringify(db))), { now: "2026-12-20T12:00:00" });
    assert.match(await p.locator('.lgtile[data-id="dic26"]').textContent(), /quedan 11 días/);
    await p.context().close();
    p = await lg(seeded(JSON.parse(JSON.stringify(db))), { now: "2026-12-31T12:00:00" });
    assert.match(await p.locator('.lgtile[data-id="dic26"]').textContent(), /último día/);
    assert.doesNotMatch(await p.locator('.lgtile[data-id="dic26"]').textContent(), /quedan 0/);
    await p.context().close();
    p = await lg(seeded(JSON.parse(JSON.stringify(db))), { now: "2027-01-02T12:00:00" });
    assert.match(await p.locator('.lgtile[data-id="dic26"]').textContent(), /temporada terminada/);
    await p.context().close();
  });

  test("opening the segment clears seen and the dot", async () => {
    const { db } = await blankDB(ctx);
    seeded(db, { r3: { d: "2026-10-05", seen: false } });
    db.tab = "datos"; db.dataTab = "historial";
    const p = await open(ctx, db);
    await p.waitForSelector(".nav");
    assert.equal(await p.locator(".nav .lgdot").count(), 1);
    assert.equal(await p.evaluate(() => lgUnseen()), 1);
    await p.evaluate(() => A.dataTab("logros"));
    await p.waitForSelector(".lgtile");
    assert.equal(await p.locator(".nav .lgdot").count(), 0);
    assert.equal(await p.evaluate(() => Object.values(DB.logros).every(e => e.seen === true)), true);
    assert.equal(await p.evaluate(() => lgUnseen()), 0);
    await p.context().close();
  });

  test("tile tap opens the sheet", async () => {
    const { db } = await blankDB(ctx);
    const p = await lg(seeded(db));
    await p.click('.lgtile[data-id="pc1"]');
    await p.waitForSelector("#overlay.show");
    const t = await p.textContent("#sheet");
    assert.match(t, /1 plate club/);
    assert.match(t, /bronce · 10 pts/);
    assert.match(t, /3 oct/);
    await p.evaluate(() => openLogro("c10"));
    assert.match(await p.textContent("#sheet"), /0 \/ 10|1 \/ 10/);
    await p.evaluate(() => openLogro("early"));
    assert.match(await p.textContent("#sheet"), /sigue entrenando/);
    await p.context().close();
  });

  test("scroll is remembered per segment", async () => {
    const { db } = await blankDB(ctx);
    const p = await lg(seeded(db));
    assert.equal(await p.evaluate(() => scrollKey()), "datos:logros");
    await p.context().close();
  });

  test("light theme renders", async () => {
    const { db } = await blankDB(ctx);
    db.settings.theme = "light";
    const p = await lg(seeded(db));
    assert.deepEqual(p.errors, []);
    const want = await p.evaluate(() => emblemImg("flame", "lockL", 3));
    assert.equal(await p.getAttribute('.lgtile[data-id="c10"] img.lgem', "src"), want);
    await p.context().close();
  });
});

describe("live", () => {
  // sesión de hoy abierta con sets sin marcar; `sets` = [[kg, reps], …] de sentadilla
  async function live(sets, { past = 1, o = {}, now, ex = "sentadilla" } = {}) {
    const { db, ids } = await blankDB(ctx);
    // historial ligero (99 kg × 10): no gana 2 plate club y su 1rm evita que la serie de hoy sea récord
    days("2026-10-01", past).forEach(k => addS(db, sess(ids, k, [["sentadilla", [[99, 10]]]])));
    const [k, s] = sess(ids, "2026-11-06", [[ex, sets]], { mins: null, finished: false, ...o });
    s.exercises[0].sets.forEach(x => { x.done = false; });
    addS(db, [k, s]);
    const p = await open(ctx, db, now ? { now } : {});
    await p.waitForSelector(".nav");
    await p.evaluate(() => A.startWorkout());
    return p;
  }
  // la sincronización en vivo corre en un setTimeout 0 tras pintar: el timer ya encolado sale antes que este (cola FIFO), sin dormir
  const settle = p => p.evaluate(() => new Promise(r => setTimeout(r, 0)));
  const finishedText = p => p.evaluate(() => { A.finish(true); return document.getElementById("sheet").textContent; });

  test("checking a 100 kg barbell squat toasts 2 plate club", async () => {
    const p = await live([[100, 1]]);
    assert.equal(await p.isVisible("#achToast"), false);          // oculto hasta que haya un logro
    await p.evaluate(() => A.checkSet(0, 0));
    await settle(p);
    await p.waitForSelector("#achToast.show");
    const t = await p.textContent("#achToast");
    assert.match(t, /2 plate club/);
    assert.match(t, /\+25/);
    assert.match(t, /logro desbloqueado/);
    assert.equal(await p.evaluate(() => DB.logros.pc2.d), await p.evaluate(() => curKey()));
    assert.equal(await p.evaluate(() => DB.logros.pc2.d), "2026-11-06");
    assert.deepEqual(p.errors, []);
    await p.context().close();
  });

  test("finish-only badges don't toast live", async () => {
    const p = await live([[60, 5]], { past: 9 });
    await p.evaluate(() => A.checkSet(0, 0));
    await settle(p);
    assert.equal(await p.evaluate(() => window._achShown || 0), 0);
    assert.equal(await p.isVisible("#achToast"), false);
    assert.equal(await p.evaluate(() => DB.logros.c10), undefined);
    await p.context().close();
  });

  test("finish lists all session badges", async () => {
    const p = await live([[100, 1]], { past: 9 });
    await p.evaluate(() => A.checkSet(0, 0));
    await settle(p);
    const t = await finishedText(p);
    assert.match(t, /logros nuevos/);
    assert.match(t, /2 plate club/);
    assert.match(t, /\+25 pts · plata/);
    assert.match(t, /calentando motores/);    // c10 llegó al terminar
    assert.ok(await p.evaluate(() => DB.sessions["2026-11-06"].logros.includes("c10")));
    assert.deepEqual(p.errors, []);
    await p.context().close();
  });

  test("summary keeps badges after opening logros mid-workout", async () => {
    const p = await live([[100, 1]]);
    await p.evaluate(() => A.checkSet(0, 0));
    await settle(p);
    await p.evaluate(() => { A.goData("logros"); });
    await p.waitForSelector(".lgtile");
    assert.equal(await p.evaluate(() => DB.logros.pc2.seen), true);
    await p.evaluate(() => A.go("entreno"));
    const t = await finishedText(p);
    assert.match(t, /logros nuevos/);
    assert.match(t, /2 plate club/);
    await p.context().close();
  });

  test("summary ignores inherited ids in s.logros", async () => {
    const { db, ids } = await blankDB(ctx);
    const [k, s] = sess(ids, "2026-11-05", [["sentadilla", [[60, 5]]]]);
    s.logros = ["constructor", "pc1"];
    addS(db, [k, s]);
    const p = await open(ctx, db);
    await p.waitForSelector(".nav");
    await p.evaluate(k => openSummary(k), k);
    const t = await p.textContent("#sheet");
    assert.match(t, /logros nuevos/);
    assert.equal(await p.locator("#sheet .sumlg").count(), 1);
    assert.match(t, /1 plate club/);
    assert.deepEqual(p.errors, []);
    await p.context().close();
  });

  test("check, uncheck, check → one toast", async () => {
    const p = await live([[100, 1]]);
    await p.evaluate(() => { A.checkSet(0, 0); A.uncheckSet(0, 0); A.checkSet(0, 0); });
    await settle(p);
    assert.equal(await p.evaluate(() => window._achShown), 1);
    assert.equal(await p.evaluate(() => DB.logros.pc2.d), "2026-11-06");   // permanencia: sigue tras desmarcar
    await p.evaluate(() => { A.uncheckSet(0, 0); });
    await settle(p);
    assert.ok(await p.evaluate(() => !!DB.logros.pc2));
    await p.evaluate(() => { A.checkSet(0, 0); });
    await settle(p);
    assert.equal(await p.evaluate(() => window._achShown), 1);
    assert.equal(await p.evaluate(() => DB.sessions["2026-11-06"].logros.filter(x => x === "pc2").length), 1);
    await p.context().close();
  });

  test("toast waits for the PR overlay", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, sess(ids, "2026-11-05", [["sentadilla", [[90, 5]]]]));
    const [k, s] = sess(ids, "2026-11-06", [["sentadilla", [[100, 5]]]], { mins: null, finished: false });
    s.exercises[0].sets[0].done = false;
    addS(db, [k, s]);
    const p = await open(ctx, db);
    await p.waitForSelector(".nav");
    await p.evaluate(() => { A.startWorkout(); A.checkSet(0, 0); });
    await settle(p);
    assert.ok(await p.isVisible("#prOverlay.show"));
    assert.equal(await p.evaluate(() => DB.logros.pc2 !== undefined), true);
    assert.equal(await p.isVisible("#achToast"), false);
    assert.equal(await p.evaluate(() => window._achShown || 0), 0);
    await p.evaluate(() => A.closePR());
    await p.waitForSelector("#achToast.show");
    assert.match(await p.textContent("#achToast"), /2 plate club/);
    await p.context().close();
  });

  test(">3 unlocks collapse", async () => {
    const p = await live([[180, 1]], { past: 0 });
    await p.evaluate(() => A.checkSet(0, 0));
    await settle(p);
    assert.equal(await p.isVisible("#prOverlay.show"), false);  // sin historial no hay récord (es la base): el aviso sale directo
    await p.waitForSelector("#achToast.show");
    assert.equal(await p.evaluate(() => window._achShown), 1);
    assert.equal((await p.textContent("#achToast")).trim().replace(/\s+/g, " "), "+4 logros · ver en el resumen");
    await p.context().close();
  });

  test("tap dismisses the toast", async () => {
    const p = await live([[100, 1]]);
    await p.evaluate(() => { window._achMs = 60000; });              // sin cierre automático: solo el toque puede cerrarlo
    await p.evaluate(() => A.checkSet(0, 0));
    await p.waitForSelector("#achToast.show");
    await p.click("#achToast");
    await p.waitForSelector("#achToast", { state: "hidden", timeout: 1000 });
    await p.context().close();
  });

  test("live sync runs after the check paints, not inside it", async () => {
    const p = await live([[100, 1]]);
    const r = await p.evaluate(async () => {
      A.checkSet(0, 0);
      const sync = DB.logros.pc2 !== undefined, green = !!document.querySelector(".set-donemark");
      await new Promise(r => setTimeout(r, 0));
      return { sync, green, after: DB.logros.pc2 !== undefined };
    });
    assert.deepEqual(r, { sync: false, green: true, after: true });
    await p.context().close();
  });

  test("a PR overlay hides an on-screen toast and the queue resumes on close", async () => {
    const p = await live([[100, 1]]);
    await p.evaluate(() => { window._achMs = 60000; achToast(["pc1"]); achToast(["pc2"]); });
    await p.waitForSelector("#achToast.show");
    assert.match(await p.textContent("#achToast"), /1 plate club/);
    await p.evaluate(() => showPR("sentadilla", { kg: 100, reps: "1" }));
    await p.waitForSelector("#achToast", { state: "hidden", timeout: 1000 });
    await p.waitForSelector("#prOverlay.show");
    assert.equal(await p.evaluate(() => window._achShown), 1);       // el siguiente espera mientras el overlay está abierto
    await p.evaluate(() => A.closePR());
    await p.waitForFunction(() => /2 plate club/.test(document.getElementById("achToast").textContent) && document.getElementById("achToast").classList.contains("show"));
    assert.equal(await p.evaluate(() => window._achShown), 2);
    await p.context().close();
  });

  test("toasts queue one at a time and fade out", async () => {
    const p = await live([[100, 1]]);
    await p.evaluate(() => { window._achMs = 150; achToast(["pc1"]); achToast(["pc2"]); });
    await p.waitForSelector("#achToast.show");
    assert.match(await p.textContent("#achToast"), /1 plate club/);
    await p.waitForFunction(() => /2 plate club/.test(document.getElementById("achToast").textContent) && document.getElementById("achToast").classList.contains("show"));
    assert.equal(await p.evaluate(() => window._achShown), 2);
    await p.waitForSelector("#achToast", { state: "hidden" });
    await p.context().close();
  });

  test("past-midnight session dates live unlock to curKey", async () => {
    const { db, ids } = await blankDB(ctx);
    const [k, s] = sess(ids, "2026-11-05", [["sentadilla", [[100, 1]]]], { mins: null, finished: false });
    s.exercises[0].sets[0].done = false; s.startedAt = ms0("2026-11-05T23:30:00");
    addS(db, [k, s]);
    db.run = { active: true, exIdx: 0, rest: 0, resting: false, key: "2026-11-05", restEnd: 0 };
    const p = await open(ctx, db, { now: "2026-11-06T00:20:00" });
    await p.waitForSelector(".nav");
    assert.equal(await p.evaluate(() => curKey()), "2026-11-05");
    await p.evaluate(() => A.checkSet(0, 0));
    await settle(p);
    assert.equal(await p.evaluate(() => DB.logros.pc2.d), "2026-11-05");
    await p.context().close();
  });

  test("summary row tap opens logros", async () => {
    const p = await live([[100, 1]]);
    await p.evaluate(() => A.checkSet(0, 0));
    await settle(p);
    await finishedText(p);
    await p.click("#sheet .lgrow");
    await p.waitForSelector(".lgtile");
    assert.equal(await p.isVisible("#overlay.show"), false);
    assert.equal(await p.textContent(".dseg div.on"), "logros");
    await p.context().close();
  });
});
const ms0 = s => new Date(s).getTime();
