# logros — achievements / trophy case for TRCK3R

Date: 2026-11-06 · Status: draft for review · Repo: `~/AppDev/gymtracker-mono` (`index.html`, single file)

## 1. Goal

A trophy case in the spirit of Xbox achievements and PlayStation trophies. It rewards both
showing up (constancia, hábitos) and getting stronger (fuerza, récords, volumen), from the
first workout to years in. Success means:

- The badges a user already earned from past training show up right away, unlocked quietly
  and dated to the day each one was actually earned.
- A badge earned during a workout gets a short console-style toast. Every badge earned in a
  session is listed again in "entreno terminado".
- A badge, once earned, is never taken away.
- 77 core badges, each with a grade and points, including one platino for completing the set.
  Seasonal badges sit outside the 77, starting with *diciembre de hierro*.
- The format leaves room for seasonal content and for badges built on earlier badges (§10).

### Decisions already made (brainstorm 2026-11-05/06)

| Topic | Decision |
|---|---|
| Purpose | A full collection mixing consistency and strength |
| Past history | Retroactive and **quiet**, each badge dated to its real earn day |
| Unlock moment | Toast mid-workout + a list in the "entreno terminado" summary; never a full-screen takeover |
| Placement | Third segment in datos: `historial · progreso · logros` |
| Look | Pixel-art emblem tiles; **option A**: one color per family, one silhouette per family |
| Grade display | **Corner gem** (pixel diamond in the grade's metal) + points top-left |
| Engine | **A**: computed by replaying history; only `{id → fecha}` is stored |
| Console layer | Grades (bronce / plata / oro / platino), points, secret badges, playful names, % complete |
| Dumbbell users | **Option a**: a 4-badge dumbbell strength track; platino needs only one of the two strength tracks |
| Skipped | Rarity (% of players): there is no server and no other users to compare against |

The mockups are in `.superpowers/brainstorm/*/content/` (`badge-style.html`, `trophy-case.html`; git-ignored).

## 2. Catalog (77)

Grades and points: **B** bronce 10 · **P** plata 25 · **O** oro 50 · **X** platino 200.
Each badge has an `id`, a playful `title`, a plain `req` line (shown under the title) and a grade.
Weights are stored in kg. "×pc" means a multiple of body weight (see §3.3).

### constancia — flame, red (17)

| id | title | requirement | g |
|---|---|---|---|
| c1 | primer paso | primer entreno terminado | B |
| c10 | calentando motores | 10 entrenos | B |
| c25 | ya es costumbre | 25 entrenos | B |
| c50 | medio centenar | 50 entrenos | P |
| c100 | centurión | 100 entrenos | P |
| c250 | veterano | 250 entrenos | O |
| c500 | leyenda del hierro | 500 entrenos | O |
| r3 | tres al hilo | racha de 3 días | B |
| r7 | siete de siete | racha de 7 días | P |
| r14 | dos semanas sin fallar | racha de 14 días | P |
| r30 | mes de hierro | racha de 30 días | O |
| w4 | un mes en serio | 4 semanas seguidas con ≥3 entrenos | B |
| w12 | trimestre sólido | 12 semanas seguidas con ≥3 entrenos | P |
| w26 | medio año | 26 semanas seguidas con ≥3 entrenos | O |
| w52 | un año sin aflojar | 52 semanas seguidas con ≥3 entrenos | O |
| back | de vuelta | entrenar tras 14+ días sin entrenar | B |
| year | aniversario | entrenar 365+ días después de tu primer entreno | O |

### fuerza · barra — plate, steel (16)

| id | title | requirement | g |
|---|---|---|---|
| pc1 | 1 plate club | 60 kg / 135 lb en sentadilla, banca o peso muerto | B |
| pc2 | 2 plate club | 100 kg / 225 lb | P |
| pc3 | 3 plate club | 140 kg / 315 lb | O |
| pc4 | 4 plate club | 180 kg / 405 lb | O |
| bp1 | tu propio peso | banca 1× pc | P |
| bp15 | banca de acero | banca 1.5× pc | O |
| sq15 | piernas de roble | sentadilla 1.5× pc | P |
| sq2 | doble o nada | sentadilla 2× pc | O |
| dl2 | levantador | peso muerto 2× pc | P |
| dl25 | arrancaárboles | peso muerto 2.5× pc | O |
| oh60 | 1 plate arriba | press militar 60 kg / 135 lb | P |
| oh1 | sobre tu cabeza | press militar 1× pc | O |
| lv2 | intermedio | nivel de fuerza intermedio | B |
| lv3 | avanzado | nivel de fuerza avanzado | P |
| lv4 | élite | nivel de fuerza élite | O |
| k1000 | club de los 1000 | mejores pesos de sentadilla + banca + peso muerto ≥ 1000 lb (453.6 kg) | O |

Change from the brainstorm list: "total Big 3 5× / 7× pc" was dropped because it nearly
duplicates the avanzado (5.25×) and élite (7.25×) levels. The two press militar badges replace it.

### fuerza · mancuernas — plate, steel (4)

Weights are per dumbbell.

| id | title | requirement | g |
|---|---|---|---|
| db20 | mancuerna de 20 | press pecho o inclinado con mancuerna 20 kg / 45 lb | B |
| db30 | mancuerna de 30 | press pecho o inclinado con mancuerna 30 kg / 65 lb | P |
| gb32 | goblet de 32 | sentadilla goblet 32 kg / 70 lb | P |
| rw40 | remo de 40 | remo con mancuerna 40 kg / 90 lb | O |

### récords — star, green (8)

| id | title | requirement | g |
|---|---|---|---|
| pr1 | superado | primer récord | B |
| pr10 | coleccionista | 10 récords | B |
| pr50 | rompe récords | 50 récords | P |
| pr100 | cien veces mejor | 100 récords | O |
| pr250 | imparable | 250 récords | O |
| prb3 | triple corona | récord en sentadilla, banca y peso muerto la misma semana | P |
| pr3s | día perfecto | 3 récords en una sesión | P |
| prlt | nunca es tarde | un récord tras 30+ días sin ninguno | B |

### volumen — gem, violet (10)

| id | title | requirement | g |
|---|---|---|---|
| t6 | un elefante | 6 t levantadas en total | B |
| t100 | cien toneladas | 100 t en total | P |
| t150 | una ballena azul | 150 t en total | P |
| t1000 | mil toneladas | 1,000 t en total | O |
| s10 | sesión pesada | 10 t en una sesión | P |
| s20 | sesión monstruo | 20 t en una sesión | O |
| n100 | cien series | 100 series | B |
| n1k | mil series | 1,000 series | P |
| n5k | cinco mil series | 5,000 series | O |
| rp10k | diez mil reps | 10,000 repeticiones | P |

Tonnage is metric for everyone; "t" is shown in both units.

### hábitos — octagon, teal (13)

| id | title | requirement | g |
|---|---|---|---|
| no10 | diario de entreno | 10 entrenos con nota | B |
| no50 | cronista | 50 entrenos con nota | P |
| wu10 | bien calentado | calentamiento en 10 entrenos | B |
| wu50 | a prueba de lesiones | calentamiento en 50 entrenos | P |
| ss5 | en cadena | superserie en 5 entrenos | B |
| ss50 | eslabón de hierro | superserie en 50 entrenos | P |
| wkd | fin de semana activo | sábado y domingo del mismo fin de semana | B |
| al10 | sin dejar nada | todas las series del día, 10 entrenos | B |
| al50 | cumplidor | todas las series del día, 50 entrenos | P |
| bw10 | a la báscula | registrar tu peso 10 veces | B |
| bw50 | control total | registrar tu peso 50 veces | P |
| ex25 | variedad | 25 ejercicios distintos | P |
| mg7 | cuerpo completo | todos los grupos musculares en una semana | P |

### secretos — crescent moon, night (8)

Until earned, these show as `??? · logro secreto`.

| id | title | requirement | g |
|---|---|---|---|
| early | madrugador | empezar un entreno entre las 4:00 y las 5:59 | B |
| owl | búho | terminar un entreno entre las 23:00 y las 2:59 | B |
| ny | año nuevo | entrenar un 1 de enero | B |
| xmas | navidad | entrenar un 25 de diciembre | B |
| f13 | viernes 13 | entrenar un viernes 13 | B |
| mara | maratón | una sesión de 2 h o más | P |
| expr | exprés | una sesión completa en menos de 20 min (≥6 series) | B |
| legs | nunca te saltas pierna | pierna o glúteo cada semana, 8 semanas seguidas | P |

### platino — trophy, platinum (1)

| id | title | requirement | g |
|---|---|---|---|
| plat | trck3r 100% | every badge in constancia, récords, volumen and hábitos (48), **plus** all of fuerza·barra (16) **or** all of fuerza·mancuernas (4) | X |

Secretos are not required. Platino progress shows `earned / required` for whichever strength
track is closer to done.

Counts: 17 + 16 + 4 + 8 + 10 + 13 + 8 + 1 = **77**. By grade: 26 B, 30 P, 20 O and 1 X, for a
**maximum of 2,210 pts** (260 + 750 + 1,000 + 200).

### temporadas — seasonal, outside the 77 (1 in v1)

Seasonal badges have `scope:"season"` (§10). They are **not** part of the 77, the % or platino, so a
user who starts later can still reach 100%. Their points do add to the header total.

| id | title | requirement | window | retro | g |
|---|---|---|---|---|---|
| dic26 | diciembre de hierro | 12 entrenos en diciembre de 2026 | 2026-12-01 → 2026-12-31 | no | P |

- **Shape:** snowflake, a chunky 6-arm mask with a solid hub and knobbed tips (checked at 16×16:
  it keeps fill inside the outline). **Palette (ice):** `#061a2a #1f6fa8 #5fb8f0 #c8ecff #fff`.
- **It's one-off on purpose:** it's the v1 proof of windowed, non-retro badges. A recurring
  "every December" version is a future extension (§10.5).
- **Tile states:**
  - Before the window: locked, `empieza el 1 dic`, no bar.
  - During the window: locked, with a bar `n / 12` and `quedan N días`.
  - Earned: the date, as usual.
  - Missed (the window ended without 12): faded silhouette, `temporada terminada`. It stays
    visible, the console "you missed it" trophy.

## 3. Rule definitions

### 3.1 What history counts

- **Counted sessions:** finished sessions (`s.finished`) only, ordered by date key.
- **Demo data never counts.** Sessions and body-weight entries with a key ≤ `settings.demoUntil`
  are skipped while `demoUntil` is set. This means deleting the demo data needs no cleanup.
- **Sets:** a "work set" is `isWork(s)` (done and not a warm-up), the same as for records and volume.
  Drop sets count as work sets, as they already do.
- **Week:** Monday to Sunday, the same as `weekVol()`.

### 3.2 Matching lifts

The existing `BIG3` regexes also match dumbbell variants: `/sentad/` matches *sentadilla goblet*
and *sentadilla sumo mancuerna*, and `/peso *muerto/` matches *peso muerto rumano mancuerna*.
Badges use a stricter matcher:

- **Barbell lift:** the name matches the `BIG3` regex (or `/press militar|overhead|ohp/i` for
  the press) **and does not** match `/mancuerna|goblet|kettlebell|pesa rusa|rumano/i`.
- **Dumbbell track:** db20/db30 match `/press (pecho|inclinado) mancuerna/i`, gb32 matches
  `/sentadilla goblet/i`, and rw40 matches `/^remo mancuerna/i`.

Custom exercises that match by name count the same way.

### 3.3 Strength measures

- **Plate clubs, oh60, the dumbbell track and k1000** use the **heaviest weight actually lifted**
  in a work set with reps ≥ 1, the same as the existing `clubbadge`.
- **×pc badges (bp1 … oh1)** also use the actual weight lifted, divided by the most recent body
  weight logged **on or before that day**. With no body weight logged by then, they can't unlock,
  and the tile reads `registra tu peso`.
- **Levels (lv2–lv4)** reuse the app's own strength level: `slevel(total e1RM / pc, [2.75,3.75,5.25,7.25])`.
  Index 2 = intermedio, 3 = avanzado, 4 = élite, so the badge always agrees with progreso.
  The total is computed with the stricter matcher from §3.2.
- **Units:** every fixed weight has a kg value and a lb value. The unit currently selected picks
  which one is checked, against the stored kg converted with `conv()`. This follows `plateClub()`.
  Changing units never takes an earned badge away.

### 3.4 Records

A **récord** is one (exercise, day) pair where the day's best work-set e1RM beats the best
e1RM from all **earlier** days for that exercise by more than 0.01 kg. A previous day with at least one
work set for that exercise is required, so the first time you do an exercise is not a record.
The summary sheet currently does count first sessions as records (see §9).

### 3.5 Other definitions

- **Racha:** consecutive calendar days, each with a finished session, the same as `streak()`.
- **Semanas seguidas:** consecutive Monday-to-Sunday weeks, each with ≥3 sessions.
- **back:** a session whose previous finished session is ≥14 days earlier.
- **Nota:** `s.note` is not empty. Exercise notes don't count.
- **Calentamiento / superserie:** the session has ≥1 done set of `type:"warm"`, or ≥1 exercise
  with `ss:true` that has a done set.
- **Todas las series:** the session has ≥1 set and every set in it is done.
- **mg7:** in one week, work sets in Pecho, Espalda, Piernas-or-Glúteo, Hombros, Bíceps, Tríceps and Core.
- **Time badges** (early, owl, mara, expr) need `startedAt`/`endedAt`. They use local time and,
  for duration, `sessionDur()`. Sessions without times are skipped.
- **expr** also needs ≥6 work sets and every set done.

## 4. Engine

### 4.1 Data

```js
DB.logros = { [id]: { d: "YYYY-MM-DD", seen: true|false } }   // added to baseDefault() and load()
DB.settings.logrosInit = true                                   // set after the first quiet run
DB.settings.logrosSeenAt = { [id]: "YYYY-MM-DD" }               // first day the app saw a badge; only read for retro:false (§10.2)
```

Nothing else is stored. Progress is always computed. The export/import backup includes `logros`
because it saves the whole `DB`. Older backups that lack `logros` are replayed on import, with
no toast. Their unlocks get `seen:false`, so the new-badge dot shows (§4.4, §5.6).

### 4.2 Badge definition

```js
{ id, fam, grade, title, req, secret?, live?,
  scope: "core" | "season",          // default "core"; see §10.1
  meta?: true,                       // evaluated after the other badges each day; see §10.3
  from?: "YYYY-MM-DD", to?: "YYYY-MM-DD", retro?: bool,   // date window; see §10.2
  after?: id,                        // chain prerequisite; see §10.4 (unused in v1)
  test(st, earned) -> bool,          // is the rule met? earned = {id → d} so far in this replay
  prog(st, earned) -> {cur, goal, txt?} }   // the locked tile's bar; txt overrides "cur / goal"
```

Platino is `meta:true`, so its test reads `earned` and isn't a special case. dic26 sets
`scope:"season"`, `from`, `to` and `retro:false`.

`fam` sets the shape and palette. `live:true` marks a badge that can unlock mid-workout:
fuerza (both tracks), récords and volumen. Everything else unlocks when the session is finished.

### 4.3 Replay

`replayLogros({includeOpen})` makes **one chronological pass**. It walks the union of counted
session dates and body-weight dates and updates a running state `st`:

- counts: sessions, notes, warm-ups, supersets, all-done sessions, body weights
- streak and week counters, plus the last session date
- per-exercise best e1RM, a record counter and the last record date
- per-lift best weight
- tonnage, sets, reps, and today's session tonnage
- the current body weight and the week's muscle-group set

After each date, it runs two phases over the badges not yet earned:

1. **Normal badges** (`!meta`) call `test(st, earned)`.
2. **Meta badges** (`meta`) do the same, so they can see what phase 1 just unlocked on that day.

That date becomes the unlock date for each badge that passes. Badges with a window are only
tested on dates inside `from`–`to`, and their counters only count sessions inside the window
(§10.2). This is O(dates × badges) with O(1) tests.
**Budget:** under 30 ms for 500 synthetic sessions on a mid-range phone (measured in the tests).

`includeOpen` adds today's open session (`curSession()`) as the final day, for live checks.

### 4.4 When it runs

| Trigger | Call | New unlocks |
|---|---|---|
| First load after the update (`!logrosInit`) | full replay | stored with `seen:true`, silently; then `logrosInit=true` |
| A set is checked (`A.checkSet`) | replay with `includeOpen`; only `live` badges may unlock | dated `curKey()`, `seen:false`, **toast** |
| A workout is finished (`A.finish`) | full replay | `seen:false`; listed in the summary (live ones already earned in this session are listed too) |
| A past session is edited in historial, a backup is imported (`applyImport`), or a session is added | full replay | `seen:false`, **no toast** (the new-badge dot shows instead) |

- Badges are never removed. Unchecking a set, deleting a session or importing old data never
  deletes an entry from `DB.logros`.
- **Today's session list:** the unlocks of the current session are found by `d === k` plus
  `seen:false`. No extra state is needed.

## 5. UI

### 5.1 The logros segment

`screenDatos()`'s segments become `historial · progreso · logros`. `scrollKey()` must return
`datos:logros` for the new segment; today it maps everything that isn't progreso to historial.
The screen, top to bottom:

1. **Header:** `1,245 pts · 38/77 · 49%`, the points in accent, plus a progress bar.
   Below it: `// último: <title> · <relative date>`.
   The `38/77` and the % count `core` badges only. The points include seasonal badges.
2. **Family filter:** horizontal chips, `todos · constancia 9/17 · fuerza 6/20 · récords · volumen · hábitos · secretos · temporadas`.
   The chip choice isn't persisted. The `temporadas` section comes last and shows `n` earned,
   with no `/total`.
3. **Sections:** one per family, `// constancia · 9/17`. Each is a 3-column grid of tiles, earned
   first by date, then locked ones by % progress (descending). Platino always sits alone in its
   own section at the top, locked or earned.
4. **Opening the segment** sets `seen:true` on everything.

### 5.2 Tile (corner gem, as in `trophy-case.html` option 1)

- The 16×16 emblem at 3× (48 px), `image-rendering: pixelated`.
- **Top-left:** points (`10`). **Top-right:** a 12 px pixel diamond in the grade's metal.
  Both dim when locked.
- The title (bold) and the requirement line underneath.
- **Earned:** the date in `shortDate()` style. **Locked:** a gray silhouette, a 5 px accent progress
  bar and `cur / goal`. **Secret, locked:** the moon silhouette, `???` and `logro secreto`, with
  no bar. **New (`seen:false`):** a small accent dot beside the date until the segment is opened.
- **Tapping a tile** opens a sheet with the emblem at 6×, the title, the requirement, the grade
  and points, then either the earned date or the progress. A secret, locked badge shows
  `sigue entrenando`.

### 5.3 Emblems (procedural, no image files)

- A 16×16 mask per shape: flame, plate, star, gem, octagon, moon, trophy, snowflake, and the
  diamond for the grade gem. The shape functions are the ones validated in the mockups; the
  snowflake was validated separately. A seasonal badge may name its own shape and palette
  instead of its family's.
- **Shading:** pixels on the mask edge get the outline color. A 1.3 px spot at (−2.8, −2.8) from
  the center gets the highlight. The rest is shaded by quadrant: top-left light,
  top-right/bottom-left mid, bottom-right dark.
- **Palettes** `[outline, dark, mid, light, highlight]`:

| Family | Palette |
|---|---|
| constancia (red) | `#2a0800 #b3360f #ff4d1f #ff9f70 #fff3e6` |
| fuerza (steel) | `#0b1220 #3d5a80 #6f93c0 #bcd3ef #fff` |
| récords (green) | `#05250e #13913a #33ff66 #b0ffc6 #fff` |
| volumen (violet) | `#170828 #6a2fb0 #9d5cff #d6bcff #fff` |
| hábitos (teal) | `#03202a #0f7f8f #2fd0e0 #adf4fb #fff` |
| secretos (night) | `#0d0a1f #3b2f7a #6b5cd6 #b9b0f5 #fff` |
| platino | `#14161c #7f8aa3 #c3cbe0 #eef2fb #fff` |

- **Grade gems** use bronze `#c47a3a`, silver `#b4bac6`, gold `#f2b400` and platinum `#c3cbe0`,
  each with its own matching 5-tone ramp from the mockup.
- **Locked emblems:** dark theme `#3A3A40` outline and fills `#1f1f24 #24242a #2a2a30`. Light
  theme `#C9C7BF` outline and fills `#e4e1d9 #dcd9d0 #d3d0c6`. No highlight in either.
- **Rendering:** each (shape, palette) pair is drawn once to a canvas and cached as a data-URL
  `<img>`, about 25 images in total. Emblem colors are deliberately fixed and don't follow the
  theme. They are badge art, like the real plate colors in `plateInfo`.

The emblem colors are a deliberate exception to the "accent/success only" color system. They
appear only inside the logros segment, the toast and the summary.

### 5.4 Unlock toast

- A new `#achToast` element, separate from `#toast`, so it never collides with undo toasts.
- **Placement:** pinned to the top of the content area, card background, a 1.5 px `--line`
  border and the app's hard `4px 4px 0 var(--accent)` shadow.
- **Content:** the emblem at 2×, `logro desbloqueado` (accent, small caps), the title, and
  `+pts` with the grade name in its metal on the right.
- **Motion:** slides down, stays 3 s, slides up; tapping dismisses it. With
  `prefers-reduced-motion`, it fades instead.
- **Several unlocks:** shown one after another, each 3 s. More than 3 at once collapse into
  `+N logros · ver en el resumen`.
- **PR overlay:** if `showPR` is open, the toast waits until that overlay closes.
- **Sound and vibration:** a short `vibrate([15,30,15])`, no sound.

### 5.5 "entreno terminado" summary

After `récords de hoy`, a `logros nuevos` section lists one row per unlock from this session:
the mini emblem, the title, and `+pts · grado`. Tapping a row closes the sheet and opens
datos › logros.

### 5.6 New-badge dot

While any badge is `seen:false`, a small accent dot appears on the `datos` nav item and on the
`logros` segment label. It's for quiet unlocks, such as ones from importing a backup.

## 6. Code layout (inside `index.html`)

| Unit | What it does |
|---|---|
| `LOGROS` (const array) | The catalog from §2, with `test` and `prog` |
| `LIFT` matchers + `bestLiftW(st, key)` | The stricter matching from §3.2 |
| `replayLogros(opts)` | §4.3; returns `{st, earned: {id → d}}`; no side effects |
| `syncLogros(mode)` | Compares the replay with `DB.logros`, writes new unlocks, returns the new ids. `mode` is `quiet` / `live` / `finish` |
| `emblemImg(shape, pal, scale)` | §5.3, cached |
| `bodyLogros()` | The segment from §5.1–5.2 |
| `openLogro(id)` | The tile sheet |
| `achToast(ids)` | §5.4, queued |

Hooks go into the existing `A.checkSet`, `A.finish` → `openSummary`, `applyImport`, the history
edit handlers (`ds*`), `screenDatos`, `scrollKey` and the nav renderer.

## 7. Errors and edge cases

- Corrupt or missing `DB.logros` (old installs, hand-edited backups): treated as `{}`; the quiet
  replay then rebuilds it.
- A badge id that's no longer in the catalog: kept in storage, hidden in the UI, and counted
  in nothing.
- A unit change, a demo delete or a session delete: nothing is removed (§4.4).
- Clock changes or time zones: dates are local `dateKey()`, as everywhere in the app.
- Training past midnight: a live unlock is dated `curKey()`, the session's own date, which
  matches how PRs are dated.

## 8. Testing

Tests are Playwright scripts, like the existing t*.js, but this time **versioned** in
`tests/logros.test.js`. They seed localStorage with a synthetic DB and assert on `DB.logros`
and on the DOM.

1. **Catalog integrity:** 77 unique `core` ids plus 1 `season` id (dic26), with no clashes.
   Every badge has a valid `fam`, `grade`, `title`, `req` and `scope`. Every `after` points to an
   existing id. The core grades total 26 B / 30 P / 20 O / 1 X, and the core points add up to 2,210.
2. **Rules:** at least one at-threshold and one just-below case for each rule type: count,
   streak, weeks, back, year, plate club in kg and in lb, ×pc with and without a body weight,
   level, k1000, the dumbbell track, records (a first session isn't a record), prb3, pr3s,
   prlt, tonnage, session tonnage, sets, reps, each hábito, each secret, and platino via
   each strength track.
3. **Strict matcher:** sentadilla goblet at 140 kg does **not** unlock pc3. Peso muerto rumano
   mancuerna does not count for dl2.
4. **Retroactive quiet run:** a history that has earned c10 gets `d` equal to the 10th session's
   date and `seen:true`, with no toast shown.
5. **Demo exclusion:** demo sessions earn nothing, and deleting the demo leaves `DB.logros` unchanged.
6. **Live:** checking a 100 kg barbell squat set shows `#achToast` with "2 plate club" and dates
   it `curKey()`. A finish-only badge such as c10 does not toast mid-workout, and appears in
   the summary at finish.
7. **Permanence:** unchecking the set, or deleting the session, keeps the badge.
8. **Import:** an old backup without `logros` is replayed with no toast, and the nav dot appears.
9. **UI:** the segment renders 77 tiles, filters work, secrets show `???`, the sheet opens, and
   opening the segment clears `seen`.
10. **Performance:** replaying 500 synthetic sessions takes under 30 ms.
11. **Seasonal window (dic26):**
    - 12 sessions in Nov 2026 earn nothing; 11 in Dec 2026 earn nothing.
    - The 12th in Dec 2026 earns it, dated that session.
    - 12 in Dec 2025 earn nothing (`retro:false` plus the window).
    - The tile state follows a mocked `Date`: before, during, earned, terminada.
    - dic26 doesn't change `38/77`, the % or platino, but it does add 25 to the points.
12. **Meta phase:** a history where the last needed core badge and platino unlock on the same day
    gives both the same date.

The existing suites must still pass, except the known 32-vs-30 timing check.

## 9. Out of scope / follow-ups

- **Existing bug, not fixed here:** progreso's Big 3, strength level and `clubbadge` use the
  loose `BIG3` regexes, so dumbbell variants inflate them. Logros uses the strict matcher
  regardless. Fixing progreso is a separate small change, and it would make the two agree.
- **Existing quirk:** the summary's `récords de hoy` counts the first time you do an exercise
  as a record. Logros doesn't.
- A share card for a badge or for the whole case. A home (inicio) module. Rarity. Badges for
  custom routines.
- **Deploy:** the usual copy to `www/` and to the `gym-tracker` repo, plus a service worker bump
  (v14). Deploy only when asked, as part of a batch. dic26 only works if v1 ships before
  2026-12-01; otherwise move its window or swap it for a later season before shipping.

## 10. Extension points (built in v1, mostly unused)

These keep seasonal content and badges built on earlier badges possible later without
reworking the engine or storage. v1 builds the fields and the engine support, but adds no
content beyond dic26 and platino.

### 10.1 `scope`: what counts toward completion

`core` badges make up the 77, the `38/77`, the % and platino's requirement. `season` badges add
points and appear only in `temporadas`. Any future category that shouldn't affect 100% (events,
collaborations, joke badges) uses a scope other than `core`.

### 10.2 `from` / `to` / `retro`: date windows

- A badge with `from`/`to` is only tested on dates inside its window. Its counters (sessions,
  tonnage, …) count only sessions inside the window. A window-scoped `st` is computed in the
  same pass, so there's no second replay.
- **`retro:false`:** the badge can't be awarded for dates before it shipped. Implementation:
  the badge also needs `date ≥ firstSeen[id]`. `firstSeen` is a small map in
  `DB.settings.logrosSeenAt`, written the first time the running app sees an id. This is the one
  addition to storage.
- **`retro:true`:** the default for core badges. The badge is awarded from the whole history,
  like the 77.

### 10.3 `meta`: badges about badges

`test(st, earned)` receives the unlocks so far, and meta badges run after the other badges
each day (§4.3). Future examples: "every bronce in constancia", "10 logros in one month",
"all secretos". Each needs only a test that reads `earned`; the engine doesn't change.

### 10.4 `after`: chains

When `after` is set and the prerequisite isn't earned, the tile shows as a locked `?` with
`siguiente nivel` instead of its requirement. The rule still runs in the replay, so a skipped
tier unlocks normally and is dated correctly. v1 sets no `after`, so every tile is visible as
agreed. Hiding higher tiers later means adding the field and nothing more.

### 10.5 Not built, but the format leaves room

- **Recurring seasons** ("every December"): a `repeat:"yearly"` field with a month-day window,
  stored as `id@YYYY` in `DB.logros`. Each year then gets its own entry and date, with no change
  to the existing format.
- **Catalog as data:** seasonal badges whose rules are only "count X inside a window" can be
  written as plain objects (`{count:"sessions", goal:12}`) instead of functions. A future season
  then becomes a data edit plus a batched deploy.
- **Player level:** a level derived from total points (e.g. `nivel = floor(√(pts/10))`). It's
  computed, so nothing is stored.
- **Personal challenges** ("beat your best week"): short-lived goals generated from your own
  history. This is a separate feature that would reuse `replayLogros`'s state.
