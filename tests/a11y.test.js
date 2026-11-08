// accesibilidad (roles, teclado, diálogos) y mejoras de uso (descanso en reposo, salto de calendario, aviso de respaldo)
const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setup, blankDB, sess, addS, open, gen } = require("./helpers");

let ctx;
before(async () => { ctx = await setup(); });
after(async () => { await ctx.close(); });

async function boot(db, opts) {
  const p = await open(ctx, db, opts);
  await p.waitForSelector(".nav");
  return p;
}
// div con onclick que el lector no ve como control (excluye los fondos de capa)
const unlabeled = p => p.evaluate(() => [...document.querySelectorAll("[onclick]")]
  .filter(el => !el.matches("button,a,input,select,textarea,label,#prOverlay,#achToast"))
  .filter(el => !el.getAttribute("role") || el.tabIndex !== 0)
  .map(el => el.outerHTML.slice(0, 80)));

describe("a11y: roles and keyboard", () => {
  test("every clickable div on every screen is a focusable control", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, ...gen(ids, 12, "2026-10-01"));
    const p = await boot(db);
    for (const go of ["A.go('inicio')", "A.startWorkout()", "A.goData('historial')", "A.goData('progreso')", "A.goData('logros')", "A.go('ajustes')", "A.openWeek()"]) {
      await p.evaluate(go);
      await p.waitForTimeout(50);
      assert.deepEqual(await unlabeled(p), [], go);
    }
    assert.deepEqual(p.errors, []);
    await p.context().close();
  });

  test("Enter and Space activate div buttons", async () => {
    const { db } = await blankDB(ctx);
    const p = await boot(db);
    await p.focus('.nav [onclick="A.go(\'datos\')"]');
    await p.keyboard.press("Enter");
    assert.equal(await p.evaluate(() => DB.tab), "datos");
    await p.focus('.nav [onclick="A.go(\'ajustes\')"]');
    await p.keyboard.press(" ");
    assert.equal(await p.evaluate(() => DB.tab), "ajustes");
    await p.context().close();
  });

  test("nav marks the current page", async () => {
    const { db } = await blankDB(ctx);
    const p = await boot(db);
    await p.evaluate(() => A.go("datos"));
    assert.equal(await p.getAttribute(".nav [aria-current=page]", "onclick"), "A.go('datos')");
    assert.equal(await p.getAttribute(".nav", "role"), "navigation");
    await p.context().close();
  });

  test("switches expose role and state, and follow toggles", async () => {
    const { db } = await blankDB(ctx);
    db.settings.showRpe = false;
    const p = await boot(db);
    await p.evaluate(() => A.go("ajustes"));
    const sel = '[onclick="A.toggleRpe()"]';
    assert.equal(await p.getAttribute(sel, "role"), "switch");
    assert.equal(await p.getAttribute(sel, "aria-checked"), "false");
    assert.equal(await p.getAttribute(sel, "aria-label"), "mostrar rpe por serie");
    await p.focus(sel);
    await p.keyboard.press(" ");
    await p.waitForTimeout(30);
    assert.equal(await p.getAttribute(sel, "aria-checked"), "true");
    await p.context().close();
  });

  test("segments report which option is selected", async () => {
    const { db } = await blankDB(ctx);
    const p = await boot(db);
    await p.evaluate(() => A.goData("progreso"));
    const st = await p.evaluate(() => [...document.querySelectorAll(".dseg > div")].map(d => d.getAttribute("aria-pressed")));
    assert.deepEqual(st, ["false", "true", "false"]);
    await p.evaluate(() => A.go("ajustes"));
    assert.equal(await p.getAttribute('[onclick="A.setUnits(\'kg\')"]', "aria-pressed"), "true");
    assert.equal(await p.getAttribute('[onclick="A.setUnits(\'lb\')"]', "aria-pressed"), "false");
    await p.context().close();
  });

  test("set inputs and checks have names", async () => {
    const { db, ids } = await blankDB(ctx);
    const [k, s] = sess(ids, "2026-11-06", [["sentadilla", [[100, 5]]]], { mins: null, finished: false });
    s.exercises[0].sets[0].done = false;
    addS(db, [k, s]);
    const p = await boot(db);
    await p.evaluate(() => A.startWorkout());
    const names = await p.evaluate(() => [...document.querySelectorAll(".set-row input, .set-row .set-check")].map(e => e.getAttribute("aria-label")));
    assert.deepEqual(names, ["sentadilla · serie 1 · kg", "sentadilla · serie 1 · reps", "marcar sentadilla · serie 1 hecha"]);
    await p.context().close();
  });
});

describe("a11y: dialogs", () => {
  test("sheet is a labelled modal; app is inert; Escape closes and focus returns", async () => {
    const { db } = await blankDB(ctx);
    const p = await boot(db);
    await p.evaluate(() => A.go("ajustes"));
    await p.focus('[onclick="A.openWeek()"]');
    await p.keyboard.press("Enter");
    assert.equal(await p.getAttribute("#sheet", "role"), "dialog");
    assert.equal(await p.evaluate(() => document.getElementById(document.getElementById("sheet").getAttribute("aria-labelledby")).textContent), "tu semana");
    assert.equal(await p.evaluate(() => document.getElementById("app").inert), true);
    assert.equal(await p.evaluate(() => document.getElementById("sheet").contains(document.activeElement)), true);
    await p.keyboard.press("Escape");
    await p.waitForTimeout(30);
    assert.equal(await p.isVisible("#overlay.show"), false);
    assert.equal(await p.evaluate(() => document.getElementById("app").inert), false);
    assert.equal(await p.evaluate(() => document.activeElement.getAttribute("onclick")), "A.openWeek()");
    await p.context().close();
  });

  test("PR overlay takes focus and Escape closes it", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, sess(ids, "2026-11-05", [["sentadilla", [[100, 5]]]]));
    const [k, s] = sess(ids, "2026-11-06", [["sentadilla", [[110, 5]]]], { mins: null, finished: false });
    s.exercises[0].sets[0].done = false;
    addS(db, [k, s]);
    const p = await boot(db);
    await p.evaluate(() => { A.startWorkout(); A.checkSet(0, 0); });
    assert.equal(await p.evaluate(() => document.activeElement.id), "prKeep");
    await p.keyboard.press("Escape");
    assert.equal(await p.isVisible("#prOverlay.show"), false);
    await p.context().close();
  });

  test("validation toasts use the danger style, others don't", async () => {
    const { db } = await blankDB(ctx);
    const p = await boot(db);
    await p.evaluate(() => toastErr("peso inválido"));
    assert.equal(await p.getAttribute("#toast", "class"), "toast err show");
    await p.evaluate(() => toast("guardado"));
    assert.equal(await p.getAttribute("#toast", "class"), "toast show");
    assert.equal(await p.getAttribute("#toast", "role"), "status");
    await p.context().close();
  });
});

describe("ux: rest panel at idle", () => {
  test("shows the upcoming rest and an 'iniciar' button; starting it counts down", async () => {
    const { db, ids } = await blankDB(ctx);
    db.settings.restDefault = 120;
    const [k, s] = sess(ids, "2026-11-06", [["sentadilla", [[100, 5], [100, 5]]]], { mins: null, finished: false });
    s.exercises[0].sets.forEach(x => { x.done = false; });
    addS(db, [k, s]);
    const p = await boot(db);
    await p.evaluate(() => A.startWorkout());
    assert.equal(await p.textContent("#restfmt"), "02:00");
    assert.equal(await p.isVisible("#reststart"), true);
    assert.equal(await p.isVisible("#restminus"), false);
    await p.click("#reststart");
    assert.equal(await p.evaluate(() => DB.run.resting), true);
    assert.equal(await p.isVisible("#reststart"), false);
    assert.equal(await p.isVisible("#restskip"), true);
    await p.click("#restskip");
    await p.waitForTimeout(30);
    assert.equal(await p.isVisible("#reststart"), true);
    assert.equal(await p.textContent("#restfmt"), "02:00");
    await p.context().close();
  });
});

describe("ux: calendar jump", () => {
  test("an empty month links to the last month with workouts", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, sess(ids, "2026-09-20", [["sentadilla", [[100, 5]]]]));
    const p = await boot(db);
    await p.evaluate(() => A.goData("historial"));
    assert.match(await p.textContent(".callast"), /ver sep →/);
    await p.click(".callast");
    assert.match(await p.textContent(".content"), /sep 2026/);
    assert.match(await p.textContent(".content"), /dom 20/);
    await p.context().close();
  });

  test("no link when there is nothing earlier", async () => {
    const { db } = await blankDB(ctx);
    const p = await boot(db);
    await p.evaluate(() => A.goData("historial"));
    assert.equal(await p.locator(".callast").count(), 0);
    await p.context().close();
  });
});

describe("ux: backup reminder", () => {
  const home = async db => { const p = await boot(db); await p.evaluate(() => A.go("inicio")); return p; };

  test("appears after 5 workouts without an export", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, ...gen(ids, 4, "2026-10-01"));
    let p = await home(db);
    assert.equal(await p.locator(".backupbar").count(), 0);
    await p.context().close();
    addS(db, ...gen(ids, 5, "2026-10-01"));
    p = await home(db);
    assert.match(await p.textContent(".backupbar"), /5 entrenos sin respaldo/);
    await p.context().close();
  });

  test("'luego' hides it for 14 days", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, ...gen(ids, 6, "2026-10-01"));
    const p = await home(db);
    await p.click('.backupbar [onclick="A.snoozeBackup()"]');
    assert.equal(await p.locator(".backupbar").count(), 0);
    assert.equal(await p.evaluate(() => DB.settings.backupSnooze), "2026-11-20");
    await p.context().close();
  });

  test("an old export with newer workouts asks again; a fresh one doesn't", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, ...gen(ids, 6, "2026-09-01"));
    db.settings.lastExport = "2026-09-05";
    let p = await home(db);
    assert.match(await p.textContent(".backupbar"), /último respaldo hace 62 días/);
    await p.context().close();
    db.settings.lastExport = "2026-11-01";
    p = await home(db);
    assert.equal(await p.locator(".backupbar").count(), 0);
    await p.context().close();
  });

  test("never with demo data", async () => {
    const { db, ids } = await blankDB(ctx);
    addS(db, ...gen(ids, 8, "2026-10-01"));
    db.settings.demo = true;
    const p = await home(db);
    assert.equal(await p.locator(".backupbar").count(), 0);
    await p.context().close();
  });
});
