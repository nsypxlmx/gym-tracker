const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setup, blankDB, open } = require("./helpers");

let ctx;

async function page() {
  const { db } = await blankDB(ctx);
  const p = await open(ctx, db);
  await p.waitForSelector(".nav");
  return p;
}

describe("emblems", () => {
  // hooks dentro del describe: con --test-name-pattern que no toca este archivo, no se lanza chromium (antes se colgaba)
  before(async () => { ctx = await setup(); });
  after(async () => { await ctx.close(); });
  test("emblem is a 48×48 png at scale 3", async () => {
    const p = await page();
    const r = await p.evaluate(async () => {
      const u = emblemImg("plate", "steel", 3);
      const im = new Image(); im.src = u; await im.decode();
      return [u.slice(0, 22), im.naturalWidth, im.naturalHeight];
    });
    assert.deepEqual(r, ["data:image/png;base64,", 48, 48]);
    await p.context().close();
  });

  test("cache returns the same string", async () => {
    const p = await page();
    assert.ok(await p.evaluate(() => emblemImg("snow", "ice", 2) === emblemImg("snow", "ice", 2)));
    assert.ok(await p.evaluate(() => emblemImg("snow", "ice", 2) !== emblemImg("snow", "ice", 3)));
    await p.context().close();
  });

  test("edge pixel uses the outline color", async () => {
    const p = await page();
    const px = await p.evaluate(async () => {
      const im = new Image(); im.src = emblemImg("plate", "steel", 1); await im.decode();
      const c = document.createElement("canvas"); c.width = c.height = 16;
      const g = c.getContext("2d"); g.drawImage(im, 0, 0);
      return Array.from(g.getImageData(7, 0, 1, 1).data);
    });
    assert.deepEqual(px, [0x0b, 0x12, 0x20, 255]);
    await p.context().close();
  });

  test("every shape draws some pixels, snowflake included", async () => {
    const p = await page();
    const r = await p.evaluate(() => Object.fromEntries(Object.keys(LG_SHAPE).map(k => {
      let n = 0; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (LG_SHAPE[k](x + .5, y + .5)) n++;
      return [k, n];
    })));
    for (const [k, n] of Object.entries(r)) assert.ok(n > 30, k + " " + n);
    await p.context().close();
  });

  test("emblemOf: earned uses family art, secret locked is a moon", async () => {
    const p = await page();
    const r = await p.evaluate(() => {
      const id = LOGROS.find(b => b.fam === "fuerza").id;
      const sid = LOGROS.find(b => b.fam === "secretos").id;
      return [emblemOf(id, "earned"), emblemOf(id, "missed"), emblemOf(sid, "secret").shape, gemImg("O").startsWith("data:image/png")];
    });
    assert.deepEqual(r[0], { shape: "plate", pal: "steel" });
    assert.deepEqual(r[1], r[0]);
    assert.equal(r[2], "moon");
    assert.ok(r[3]);
    const gp = await p.evaluate(async () => {
      const im = new Image(); im.src = gemImg("O"); await im.decode();
      const c = document.createElement("canvas"); c.width = c.height = 16;
      const g = c.getContext("2d"); g.drawImage(im, 0, 0);
      return [Array.from(g.getImageData(7, 0, 1, 1).data), Array.from(g.getImageData(6, 6, 1, 1).data)];
    });
    assert.deepEqual(gp[0], [0x26, 0x18, 0x00, 255]); // borde: contorno oro
    assert.deepEqual(gp[1], [0xff, 0xe0, 0x8a, 255]); // (6,6): cuadrante sup-izq -> light
    await p.context().close();
  });

  test("locked uses the light ramp in light theme", async () => {
    const p = await page();
    const r = await p.evaluate(() => {
      const id = LOGROS[0].id;
      DB.settings.theme = "light"; const l = emblemOf(id, "locked").pal;
      DB.settings.theme = "dark"; const d = emblemOf(id, "locked").pal;
      return [l, d];
    });
    assert.deepEqual(r, ["lockL", "lockD"]);
    await p.context().close();
  });

  const hex = a => "#" + a.slice(0, 3).map(v => v.toString(16).padStart(2, "0")).join("");
  const pixels = (p, shape, pal, pts) => p.evaluate(async ([shape, pal, pts]) => {
    const im = new Image(); im.src = emblemImg(shape, pal, 1); await im.decode();
    const c = document.createElement("canvas"); c.width = c.height = 16;
    const g = c.getContext("2d"); g.drawImage(im, 0, 0);
    return pts.map(([x, y]) => Array.from(g.getImageData(x, y, 1, 1).data));
  }, [shape, pal, pts]);

  test("highlight spot gets P[4]; quadrants get light/mid/dark", async () => {
    const p = await page();
    const r = await pixels(p, "plate", "steel", [[4, 4], [10, 10], [10, 3], [3, 10]]);
    assert.equal(hex(r[0]), "#ffffff");
    assert.equal(hex(r[1]), "#3d5a80"); // abajo-der: dark
    assert.equal(hex(r[2]), "#6f93c0"); // arriba-der: mid
    assert.equal(hex(r[3]), "#6f93c0"); // abajo-izq: mid
    await p.context().close();
  });

  test("lock ramp render has no highlight", async () => {
    const p = await page();
    const r = await pixels(p, "plate", "lockD", [[4, 4], [7, 0]]);
    assert.equal(hex(r[0]), "#2a2a30"); // donde iría el brillo: light normal
    assert.equal(hex(r[1]), "#3a3a40");
    await p.context().close();
  });

  test("palettes match spec §5.3 / §2 literally", async () => {
    const p = await page();
    const pal = await p.evaluate(() => LG_PAL);
    assert.deepEqual(pal, {
      red: ["#2a0800", "#b3360f", "#ff4d1f", "#ff9f70", "#fff3e6"],
      steel: ["#0b1220", "#3d5a80", "#6f93c0", "#bcd3ef", "#ffffff"],
      green: ["#05250e", "#13913a", "#33ff66", "#b0ffc6", "#ffffff"],
      violet: ["#170828", "#6a2fb0", "#9d5cff", "#d6bcff", "#ffffff"],
      teal: ["#03202a", "#0f7f8f", "#2fd0e0", "#adf4fb", "#ffffff"],
      night: ["#0d0a1f", "#3b2f7a", "#6b5cd6", "#b9b0f5", "#ffffff"],
      plat: ["#14161c", "#7f8aa3", "#c3cbe0", "#eef2fb", "#ffffff"],
      ice: ["#061a2a", "#1f6fa8", "#5fb8f0", "#c8ecff", "#ffffff"],
      bronze: ["#241104", "#8a4a1c", "#c47a3a", "#ecb57e", "#fff3e0"],
      silver: ["#131519", "#767c88", "#b4bac6", "#e4e8ef", "#ffffff"],
      gold: ["#261800", "#a56c00", "#f2b400", "#ffe08a", "#ffffff"],
      lockD: ["#3A3A40", "#1f1f24", "#24242a", "#2a2a30", null],
      lockL: ["#C9C7BF", "#e4e1d9", "#dcd9d0", "#d3d0c6", null]
    });
    await p.context().close();
  });
});
