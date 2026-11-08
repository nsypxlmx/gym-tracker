// récords y big 3: la primera vez de un ejercicio es la base, no un récord (misma regla que logros §3.4);
// las variantes con mancuerna/goblet/rumano no cuentan como sentadilla, banca o peso muerto
const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setup, blankDB, sess, addS, open } = require("./helpers");

let ctx;
before(async () => { ctx = await setup(); });
after(async () => { await ctx.close(); });

// sesión de hoy abierta con una serie sin marcar
function openToday(ids, exs) {
  const [k, s] = sess(ids, "2026-11-06", exs, { mins: null, finished: false });
  s.exercises.forEach(e => e.sets.forEach(x => { x.done = false; }));
  return [k, s];
}

describe("records: first time is a baseline", () => {
  test("no PR overlay on the first ever set of an exercise", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, openToday(ids, [["sentadilla", [[100, 5]]]]));
    const p = await open(ctx, db);
    await p.waitForSelector(".nav");
    await p.evaluate(() => { A.startWorkout(); A.checkSet(0, 0); });
    assert.equal(await p.isVisible("#prOverlay.show"), false);
    await p.context().close();
  });

  test("summary lists only exercises that beat a previous day", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, sess(ids, "2026-11-05", [["sentadilla", [[100, 5]]]]));
    addS(db, openToday(ids, [["sentadilla", [[110, 5]]], ["prensa", [[200, 10]]]]));
    const p = await open(ctx, db);
    await p.waitForSelector(".nav");
    await p.evaluate(() => { A.startWorkout(); A.checkSet(0, 0); A.closePR(); A.checkSet(1, 0); A.finish(true); });
    const txt = await p.textContent("#sheet");
    assert.match(txt, /récords de hoy/);
    assert.match(txt, /sentadilla/);
    assert.doesNotMatch(txt, /prensa/);
    await p.context().close();
  });

  test("summary shows no records section when everything is new", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, openToday(ids, [["prensa", [[200, 10]]]]));
    const p = await open(ctx, db);
    await p.waitForSelector(".nav");
    await p.evaluate(() => { A.startWorkout(); A.checkSet(0, 0); A.finish(true); });
    assert.doesNotMatch(await p.textContent("#sheet"), /récords de hoy/);
    await p.context().close();
  });

  test("calendar PR days skip each exercise's first day", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db,
      sess(ids, "2026-11-01", [["sentadilla", [[100, 5]]]]),
      sess(ids, "2026-11-03", [["sentadilla", [[110, 5]]]]),
      sess(ids, "2026-11-04", [["sentadilla", [[105, 5]]]]));
    const p = await open(ctx, db);
    await p.waitForSelector(".nav");
    assert.deepEqual(await p.evaluate(() => [...prDatesSet()].sort()), ["2026-11-03"]);
    await p.context().close();
  });
});

describe("records: home 'last record' module", () => {
  test("a brand-new exercise doesn't become the last record", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db,
      sess(ids, "2026-11-01", [["sentadilla", [[100, 5]]]]),
      sess(ids, "2026-11-03", [["sentadilla", [[110, 5]]]]),
      sess(ids, "2026-11-05", [["prensa", [[200, 10]]]]));
    const p = await open(ctx, db);
    await p.waitForSelector(".nav");
    const lp = await p.evaluate(() => { const r = lastPR(); return r && [r.name, r.date, r.kg]; });
    assert.deepEqual(lp, ["sentadilla", "2026-11-03", 110]);
    await p.context().close();
  });

  test("nothing to show with a single session", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, sess(ids, "2026-11-01", [["sentadilla", [[100, 5]]]]));
    const p = await open(ctx, db);
    await p.waitForSelector(".nav");
    assert.equal(await p.evaluate(() => lastPR()), null);
    await p.context().close();
  });
});

describe("big 3: dumbbell variants don't count", () => {
  test("goblet / sumo mancuerna / rumano mancuerna are ignored", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, sess(ids, "2026-11-05", [
      ["sentadilla goblet", [[40, 10]]],
      ["sentadilla sumo mancuerna", [[45, 10]]],
      ["peso muerto rumano mancuerna", [[50, 10]]],
    ]));
    const p = await open(ctx, db);
    await p.waitForSelector(".nav");
    const r = await p.evaluate(() => ({ sq: bigLift(BIG3[0].re).e1, dl: bigLift(BIG3[2].re).e1, total: big3Total() }));
    assert.deepEqual(r, { sq: 0, dl: 0, total: 0 });
    await p.context().close();
  });

  test("the barbell lifts still count", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, sess(ids, "2026-11-05", [
      ["sentadilla", [[100, 1]]], ["sentadilla goblet", [[200, 1]]],
      ["press banca", [[80, 1]]], ["peso muerto", [[140, 1]]],
    ]));
    const p = await open(ctx, db);
    await p.waitForSelector(".nav");
    const r = await p.evaluate(() => BIG3.map(b => Math.round(bigLift(b.re).e1)));
    const e1 = await p.evaluate(() => [100, 80, 140].map(kg => Math.round(est1rm({ kg, reps: "1", done: true, type: "work" }))));
    assert.deepEqual(r, e1);
    await p.context().close();
  });
});
