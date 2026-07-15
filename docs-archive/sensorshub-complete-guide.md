# SensorsHub: The Complete Developer Guide

This is the full version — every file, every important function, with real code from your project traced through step by step. It's long on purpose. Read it top to bottom once, then use it as a reference afterward.

---

## Table of Contents

1. [How to Use This Guide](#1-how-to-use-this-guide)
2. [The One Thing to Remember](#2-the-one-thing-to-remember)
3. ["I Want To ___" Lookup Table](#3-i-want-to-___-lookup-table)
4. [The Big Picture](#4-the-big-picture)
5. [Core Data Model](#5-core-data-model)
6. [Full Walkthrough: One Component Through All 3 Files](#6-full-walkthrough-one-component-through-all-3-files)
7. [File-by-File Deep Dive](#7-file-by-file-deep-dive)
8. [Component Pin Reference Table](#8-component-pin-reference-table)
9. [Hands-On Tutorial: Finishing the Relay Component](#9-hands-on-tutorial-finishing-the-relay-component)
10. [Debugging Playbook](#10-debugging-playbook)
11. [The 3 Mistakes That Cause Most Bugs](#11-the-3-mistakes-that-cause-most-bugs)
12. [Glossary of Global Variables](#12-glossary-of-global-variables)
13. [One-Page Cheat Sheet](#13-one-page-cheat-sheet)

---

## 1. How to Use This Guide

- **In a hurry?** Jump to §3 (the lookup table) or §13 (cheat sheet at the very end).
- **Confused about the overall shape of the project?** Read §4 and §5 first.
- **Want to actually *see* how the pieces connect, not just read about it?** §6 is a fully traced real example.
- **Trying to understand one specific file?** §7 is organized by filename — `components.js`, `drawing.js`, `interaction.js`, `LibraryRegistry.js`, `simulator.js`, etc.
- **Trying to add something new?** §9 is a full hands-on tutorial, step by step.
- **Something's broken?** §10 is a symptom → cause → file table.

Every section is tagged with **📁 FILE:** so you always know exactly which file you'd be looking at if you opened your editor right now.

---

## 2. The One Thing to Remember

There are only **3 files** you'll touch for 90% of changes, and each has exactly one job:

| File | Its one job | Think of it as... |
|---|---|---|
| 🧩 `components.js` | Holds the **data** — what is this thing, what pins does it have, what's its current value | The character's stats sheet |
| 🎨 `drawing.js` | Holds the **looks** — what gets painted on the canvas, every single frame | The character's sprite/animation |
| 🖱️ `interaction.js` | Holds the **reactions** — what happens when you click, drag, or touch it | The game controller |

A 4th file is the **brain**, only relevant once you click "Run":

| File | Its job |
|---|---|
| 🧠 `simulator.js` | Reads your sketch's code, and translates lines like `digitalWrite(2, HIGH)` into actual changes to a component's data (the same `state` object that `components.js` created and `drawing.js` paints) |

Everything in this whole project is some combination of those four ideas. If you can answer "is this a *data* question, a *looks* question, a *click* question, or a *code* question?" you already know which file to open.

---

## 3. "I Want To ___" Lookup Table

| I want to... | Open this file | Look for... |
|---|---|---|
| Add a brand new component | `components.js` | a `createXXX()` function — copy the simplest one and rename it |
| Change how something looks on the canvas | `drawing.js` | the `drawXXX()` function with the matching type name |
| Make something react to a click or tap | `interaction.js` | inside `handleCanvasMouseDown()`, find another component's `if (c.type === '...')` block |
| Add a drag-able slider/knob (like the DHT thermometer) | `drawing.js` **and** `interaction.js` | search the word `_slider` for a working example |
| Make `digitalWrite()` from code control it | `simulator.js` | inside `writeDigitalPinValue()` |
| Make `digitalRead()` / `analogRead()` from code read its state | `simulator.js` | inside `readDigitalPinValue()` / `readAnalogPinValue()` |
| Require certain pins wired before it "counts" as connected | `simulator.js` | the `REQUIRED_PINS` table near the top |
| Add the palette button so people can place it | `index.html` | the `<div class="comp-item" ...>` blocks |
| Add support for a new `#include` library (like `Servo.h`) | `LibraryRegistry.js` + a new file in `libraries/` | `registerLibrary(...)` calls |
| Add support for a new MicroPython pattern (e.g. a new `machine.X` class) | `simulator.js` | `translatePythonStatement()` |
| Change the Help modal's content | `helpTemplate.js` | the HTML string |
| Change colors, fonts, spacing, mobile layout | `style.css` | CSS variables at the top, or the `@media` blocks at the bottom |

---

## 4. The Big Picture

### Load order

`index.html` loads scripts in this order:

```
drawing.js → components.js → interaction.js → LibraryRegistry.js
→ libraries/DHT.js, Wire.js, SSD1306.js, Servo.js → simulator.js
→ helpTemplate.js → helpModal.js
```

This looks backwards (drawing loads before the data it draws?) but it's fine — every file just declares `function`s (hoisted, available everywhere immediately) and nothing actually *runs* until `DOMContentLoaded` fires, by which point all 8 files have finished loading. You don't need to think about load order at all unless you start using `class` or `const () => {}` at the very top level of a file (those aren't hoisted).

### Two engines sharing one set of data

This is the single most useful mental model for the whole project: **there are two separate "engines," and both of them read and write the exact same `components` and `wires` arrays.**

```
 ┌───────────────────────┐        ┌────────────────────────┐
 │   BUILD MODE            │        │   RUN MODE              │
 │  (you're wiring it up)  │        │  (code is executing)    │
 │                          │        │                          │
 │ interaction.js           │        │ simulator.js             │
 │  • mouse/touch events    │        │  • parses your sketch    │
 │  • drag components       │        │  • "ticks" ~1 line       │
 │  • draw/cancel wires     │        │    every 50ms            │
 │  • toggle sensors by      │        │  • reads/writes          │
 │    clicking them          │        │    component .state     │
 └────────────┬─────────────┘        └────────────┬─────────────┘
              │                                    │
              └─────────────────┬──────────────────┘
                                 ▼
                       components[]  /  wires[]
                     (the single shared truth)
                                 │
                                 ▼
                          drawing.js  draw()
                (repaints the canvas from current state,
                 called after almost every change)
```

Both engines can be active at once — you can click Run *and* still drag a sensor's slider, because dragging just edits `comp.state` directly, the exact same way `digitalWrite()` does. Neither engine "knows" about the other; they just both happen to read and write the same plain JavaScript objects.

### File responsibility table

| File | What it owns |
|---|---|
| `components.js` | Global state variables, canvas setup/resize, undo history, the `createXXX()` factories |
| `drawing.js` | The `draw()` render loop, every `drawXXX()` painter, pin tooltips, the wire-connect spark effect |
| `interaction.js` | All mouse/touch/keyboard handling — hit-testing, dragging, wiring, zoom |
| `LibraryRegistry.js` | Lets user code do `Servo s; s.attach(9);` and have it call real JS classes |
| `simulator.js` | The actual code interpreter — parses the sketch, steps through it, reads/writes component state |
| `libraries/*.js` | The JS classes behind `Servo`, `DHT`, `Wire`, `SSD1306` (not pasted into our conversation — see §7.8) |
| `index.html` | Page shell, CodeMirror editor, language toggle, mobile tabs |
| `style.css` | All visuals, the Arduino-blue/MicroPython-green theme switch |
| `helpTemplate.js` / `helpModal.js` | The Help modal's HTML + its open/close/tab logic |

---

## 5. Core Data Model

Three shapes. Once these click, almost every function in the project is just "read a piece of this" or "write a piece of this."

### 📁 A Component (created in `components.js`, painted in `drawing.js`, clicked in `interaction.js`)

```js
{
  id: 'c_1750000000000_a1b2c',   // from mkId() — unique per component
  type: 'led',                    // a string tag used as a switch-case basically everywhere
  x: 320, y: 210,                 // meaning depends on type! see warning below
  width: 20, height: 36,
  pins: [ /* array of Pin, see below */ ],
  state: { on: false, color: '#ff3344', label: 'Red' },   // type-specific data

  // some components also carry UI-only geometry caches, e.g. _slider, _tempSlider,
  // _humSlider, _xSlider, _ySlider, _servoSlider — written by drawing.js, read by
  // interaction.js to detect "did the user grab the knob?"
}
```

**⚠️ Gotcha — `x`/`y` mean different things depending on type:**
- For `esp32` and `pico`: `(x, y)` is the **top-left corner**.
- For everything else: `(x, y)` is the **center**.

You'll see this exact pattern repeated in several places (`findComponent`, `getComponentCenter`, `getComponentBounds` — all in different files):
```js
if (c.type === 'esp32' || c.type === 'pico') {
  cx = c.x + (c.width / 2);
  cy = c.y + (c.height / 2);
} else {
  cx = c.x;
  cy = c.y;
}
```
If you add a new component, use the "center" convention unless you have a strong reason not to — it's what everything assumes by default.

### 📁 A Pin (lives inside `component.pins`)

```js
{
  name: 'D2',            // must be UNIQUE within this one component (see warning below)
  x: 140, y: 90,           // absolute canvas coordinates — kept in sync by drawing.js
  side: 'left',            // 'left' | 'right' | 'top' | 'bottom' — mostly cosmetic label placement
  type: 'gpio',            // 'gpio' | 'power' | 'gnd' | 'uart' | 'analog' | 'en' | 'pwm' | 'i2c'
  color: '#3ddc84',        // drives the dot's color AND the tooltip's "type" label
  hitRadius: 13             // optional — overrides the default ~10px click radius
}
```

**⚠️ The duplicate-pin-name trap** (you've already hit this twice — ESP32 `GND`/`GND2`, Pico `GND_0`–`GND_6`):

Every wire references a pin through a string built like this:
```js
pinId = component.id + '_' + pin.name
```
If two pins on the **same component** share a `name`, this string collides, and wire lookups (`findPinById`, `getPinId`) silently grab the wrong pin. **Rule: every pin name on one component must be unique**, even if the real hardware reuses a label like "GND" several times. Use a separate display-only `label` field if you want it to *show* as "GND" while its internal `name` is something unique like `GND_0`. (You can see this exact trick already in `drawESP32`: `p.name === 'GND2' ? 'GND' : p.name`.)

### 📁 A Wire (lives in the global `wires` array)

```js
{
  x1: 140, y1: 90,         // synced from pin1's current position
  x2: 400, y2: 210,        // synced from pin2's current position
  color: '#9ece6a',        // chosen ONCE at creation time — see note below
  pin1Id: 'c_..._D2',
  pin2Id: 'c_..._+',
  waypoints: [ {x, y}, ... ]   // user-added bend points
}
```

Two non-obvious facts worth knowing:

1. **Wire color is decided once, at creation**, based on the *starting pin's* `type` — it does **not** read `pin.color` directly. Look inside `handleCanvasMouseDown` in `interaction.js`:
   ```js
   var wc = '#7aa2f7';
   if (wireStart.type === 'power') wc = '#f7768e';
   else if (wireStart.type === 'gnd') wc = '#8b7355';
   else if (wireStart.type === 'uart') wc = '#7dcfff';
   else if (wireStart.type === 'gpio') wc = '#9ece6a';
   ```
   If you invent a new pin `type`, add a case here too, or every wire from that pin will fall through to the default blue.

2. **`draw()` mutates wires as a side effect.** Every call to `draw()` recomputes `w._handles` — the little draggable diamond markers at the midpoint of each wire segment. This isn't just cosmetic: `interaction.js`'s `findWireInteractive()` reads `w._handles` to know where a wire can be grabbed. **If you change `wires`/`components` from code and never call `draw()` afterward, wire-dragging can act like it's reading stale, out-of-date geometry** — because it is.

---

## 6. Full Walkthrough: One Component Through All 3 Files

Reading descriptions of "how the files connect" only goes so far. Let's watch it actually happen, using a component that already exists in your code: the **HC-SR04 ultrasonic sensor**. It's a great teaching example because it has a slider, so you can watch data travel in a full circle: **created → drawn → grabbed → changed → redrawn.**

### 📁 FILE: `components.js` — the data is born

```js
function createUltrasonic(x, y) {
  var c = {
    id: mkId(),
    type: 'ultrasonic',
    x: x, y: y,
    width: 85, height: 50,
    pins: [],
    state: { distance: 50 },             // ← the ONE value this sensor actually "knows"
    _slider: { x: 0, y: 0, w: 80, h: 7, knobX: 0, knobY: 0, knobR: 10 }
    //         ↑ just a placeholder shape. drawing.js fills in real numbers every frame.
  };

  c.pins.push({ name: 'VCC',  x: x + 85, y: y + 5,  side: 'right', type: 'power', color: '#ff5566' });
  c.pins.push({ name: 'Trig', x: x + 85, y: y + 18, side: 'right', type: 'gpio',  color: '#3ddc84' });
  c.pins.push({ name: 'Echo', x: x + 85, y: y + 31, side: 'right', type: 'gpio',  color: '#3ddc84' });
  c.pins.push({ name: 'GND',  x: x + 85, y: y + 44, side: 'right', type: 'gnd',   color: '#8b7355' });

  return c;
}
```

`state.distance` is the entire "personality" of this sensor. Everything else here is bookkeeping.

### 📁 FILE: `drawing.js` — it gets painted, and the slider's real position is saved back

```js
// distance → where the knob should sit visually, as a 0–1 fraction along the track
var sv = Math.min(Math.max((dist - 2) / 398, 0), 1);
var kx = x - sw / 2 + sv * sw;

// the REAL, current slider geometry gets written back onto the component
c._slider = { x: x - sw / 2, y: sy, w: sw, h: 7, knobX: kx, knobY: sy + 3.5, knobR: 10 };
```

Every single time the canvas redraws, this line **overwrites `c._slider`** with the knob's current on-screen position. `interaction.js` never calculates this itself — it just reads whatever `drawing.js` left behind from the last paint.

### 📁 FILE: `interaction.js` — grabbing and dragging the knob

```js
// inside handleCanvasMouseDown — "did the user click on the knob?"
if (c.type === 'ultrasonic' && c._slider) {
  var s = c._slider;
  var dx0 = x - s.knobX;
  var dy0 = y - s.knobY;
  if (dx0 * dx0 + dy0 * dy0 < s.knobR * s.knobR) {   // distance² < radius² = "inside the circle"
    saveState();
    dragging = { comp: c, type: 'ultrasonic-slider' };   // remember what's being dragged
    return;
  }
}
```

```js
// inside handleCanvasMouseMove — "the user is dragging it, update the actual data"
if (dragging.type === 'ultrasonic-slider') {
  var s = dragging.comp._slider;
  var relX = Math.min(Math.max(mouseX - s.x, 0), s.w);
  dragging.comp.state.distance = Math.round(relX / s.w * 398 + 2);   // ← writes back to state!
  draw();
  return;
}
```

### The full circle, drawn out

```
components.js              drawing.js                  interaction.js
"distance = 50"     →     "draw knob at x=140,    →    "user clicked near x=140 —
                            save x=140 to _slider"        start dragging"
                                   ↑                              │
                                   │                              ▼
                            "draw knob at           ←     "mouse moved — recompute
                             the NEW x position"             distance = 212, write
                                                              it into state"
```

That loop — **data exists → its drawn position gets saved → a click is detected against the saved position → data gets updated → it gets redrawn** — is the exact same pattern behind every slider, button, and toggle in this whole project (the DHT's two sliders, the servo angle slider, the LDR slider, the joystick X/Y, the button/PIR/flame/KY-004/KY-032 click-toggles). Once you can trace it here, you can trace it anywhere else in the code.

---

## 7. File-by-File Deep Dive

### 7.1 📁 `components.js`

**Global state lives at the very top of this file** (declared before any function):
```js
var canvas = document.getElementById('simCanvas');
var ctx = canvas ? canvas.getContext('2d') : null;
var container = document.getElementById('canvas-container');

let components = [];
let wires = [];
let tool = 'wire';
let wireStart = null;
let dragging = null;
let mouseX = 0, mouseY = 0;
let actionHistory = [];
let paletteVisible = true;
```
These are *the* global variables. Every other file reaches into these directly by name — there's no passing-data-around, it's all shared mutable state.

| Function | What it does |
|---|---|
| `mkId()` | `'c_' + Date.now() + '_' + random` — your component ID generator |
| `saveState()` / `undo()` | Deep-clones `components`+`wires` onto a stack (capped at 50) before any destructive action; undo pops it back |
| `resizeCanvas()` | Recomputes the canvas's internal pixel size from the container size ÷ zoom; re-syncs wire endpoints afterward |
| `fixOffscreenComponents()` | If a component's bounding box ends up fully outside the visible canvas (e.g. after a resize), nudges it back into view |
| `addComponent(type)` | The single dispatcher every palette button calls. Enforces "only one MCU at a time," then calls the matching `createXXX()` |
| `setTool(t)` | Sets the global `tool`, clears `wireStart`, toggles the active CSS class on toolbar buttons |
| `createXXX(x, y)` | One factory per component type — returns the component object shape from §5 |

**The undo system, in full** — this is short enough to just read directly:
```js
function saveState() {
  actionHistory.push({
    components: JSON.parse(JSON.stringify(components)),
    wires: JSON.parse(JSON.stringify(wires))
  });
  if (actionHistory.length > 50) actionHistory.shift();
}

function undo() {
  if (actionHistory.length === 0) {
    updateStatus('Nothing to undo');
    return;
  }
  var prev = actionHistory.pop();
  components = prev.components;
  wires = prev.wires;
  wireStart = null;
  updateWireEndpointsFromPins();
  fixOffscreenComponents();
  updateStatus('Undo');
  if (typeof draw === 'function') draw();
}
```
Notice it's a brute-force `JSON.parse(JSON.stringify(...))` deep clone — simple, slightly wasteful, but completely safe (no shared-reference bugs between history snapshots). Every interactive action in `interaction.js` calls `saveState()` *before* mutating anything, which is what makes undo work for clicks, drags, deletes, and wire creation alike.

**The factory pattern** — every `createXXX` does the same three things: set `id/type/x/y/width/height`, build `state`, push some `pins`. The LED factory is the cleanest one to study:
```js
function createLED(x, y, color, label) {
  var c = { id: mkId(), type: 'led', x, y, width: 20, height: 36,
            pins: [], state: { on: false, color, label } };
  c.pins.push({ name: '+', x, y: y - 10, side: 'top',    type: 'gpio', color: '#3ddc84' });
  c.pins.push({ name: '-', x, y: y + 10, side: 'bottom', type: 'gnd',  color: '#8b7355' });
  return c;
}
```
That's the whole template. Copy it for anything new.

### 7.2 📁 `drawing.js`

**The render loop is `draw()`.** Anything that changes — a drag, a wire, a slider, a simulator tick — gets followed by a call to `draw()`. There's no diffing; it clears and repaints the entire canvas every single call:

```js
function draw() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // ... faint grid lines ...

  components.forEach(function(c) {
    if      (c.type === 'esp32')      drawESP32(c);
    else if (c.type === 'pico')       drawPico(c);
    else if (c.type === 'led')        drawLED(c);
    else if (c.type === 'ultrasonic') drawUltrasonic(c);
    // ... one else-if per component type ...

    var mcuTypes = ['esp32', 'pico'];
    if (!mcuTypes.includes(c.type) && !isComponentWired(c)) {
      drawNotWiredWarning(c);
    }
  });

  wires.forEach(function(w) { /* draw the wire line, endpoints, bend handles */ });

  if (wireStart && tool === 'wire') { /* draw the dashed "currently connecting" preview line */ }
}
```

This `if/else if` chain is the **draw dispatcher**. Adding a new component without a matching line here means your component will exist in the `components` array but never appear on screen.

**The pin-position-recompute pattern**, repeated in almost every `drawXXX`:
```js
// inside drawLED
p.x = x + legOffsetX;
p.y = y + R + legLength;
```
Pin coordinates get **recalculated from the component's current `x`/`y` on every single draw call.** This means `draw()` — not `createXXX()` — is the real source of truth for "where is this pin right now." The values set in the factory function are just the seed before the very first paint.

**Other systems in this file:**
- **Spark particle effect** (`spawnSpark`, `_animateSparks`) — the little burst on a fresh wire connection. Runs on its own `requestAnimationFrame` loop, fully independent of `draw()`.
- **Pin tooltip system** (`showPinTooltip`, `initTooltip`, `_isPinWired`, `_getConnectedTo`) — the hover/tap info box showing a pin's name, type, voltage hint, and what it's wired to. `_getConnectedTo` walks `wires[]` looking for the other end. `_splitPinReference` is the *safe* way to turn a pinId back into `{comp, pinName}` — it checks each real component's exact ID prefix first:
  ```js
  for (var i = 0; i < components.length; i++) {
    var comp = components[i];
    var prefix = comp.id + '_';
    if (pinId.indexOf(prefix) === 0) {
      return { comp: comp, pinName: pinId.substring(prefix.length) };
    }
  }
  ```
  This is more robust than a naive "split on the last underscore" approach, because pin names like `GND_0` already *contain* underscores — splitting on the wrong underscore would slice the name in half. (`simulator.js` has a cruder version of this same idea — flagged in §10.)

### 7.3 📁 `interaction.js`

Every click, drag, tap, and keypress funnels through this file. The single most important function to understand is `handleCanvasMouseDown` — it's the dispatcher for everything you can click, and it checks things in this order:

1. **If the tool is `'wire'`**, it first checks every component for a slider-knob hit (ultrasonic, DHT temp/humidity, servo, LDR, joystick X/Y) and for click-to-toggle parts (button, KY-004, SW-420, flame, KY-032, PIR dome, joystick switch, and `relay` — which is currently dead code, see §9). Only if **none** of those match does it fall through to general pin/wire logic.
2. **Regardless of tool** (except delete), it checks whether you clicked an existing wire's waypoint or bend-handle.
3. **Then it branches by tool:** `move` picks up a whole component; `delete` removes a wire (checking endpoints and waypoints) or a component (and any wires touching it); `wire` runs the actual connect/cancel/duplicate-check logic.

**Key helper functions:**

```js
function getCanvasXY(e) {
  if (!canvas) return { x: 0, y: 0 };
  var rect = canvas.getBoundingClientRect();
  var zoom = window.zoomLevel || 1;
  return {
    x: (e.clientX - rect.left) / zoom,
    y: (e.clientY - rect.top) / zoom
  };
}
```
**Always route new coordinate math through this function.** Never use raw `e.clientX/Y` — it doesn't account for zoom, and your hit-testing will silently break the moment someone zooms in or out.

```js
function findPin(mx, my) {
  var bestPin = null;
  var bestDist = Infinity;
  for (var i = 0; i < components.length; i++) {
    var c = components[i];
    for (var j = 0; j < c.pins.length; j++) {
      var p = c.pins[j];
      var dx = mx - p.x, dy = my - p.y;
      var radius = p.hitRadius || 10;
      var dist = dx * dx + dy * dy;
      if (dist < radius * radius && dist < bestDist) {
        bestPin = p;
        bestDist = dist;
      }
    }
  }
  return bestPin;
}
```
This is the generic "what pin is under the mouse" check — note it picks the *closest* match if multiple pins overlap within their hit radius.

```js
function getPinId(pin) {
  var owner = findPinOwner(pin);
  return owner ? owner.id + '_' + pin.name : '';
}

function findPinById(id) {
  for (var i = 0; i < components.length; i++) {
    var c = components[i];
    for (var j = 0; j < c.pins.length; j++) {
      if (c.id + '_' + c.pins[j].name === id) return c.pins[j];
    }
  }
  return null;
}
```
This is the pin-ID convention from §5 in action — note `findPinById` does an **exact** string comparison (`c.id + '_' + name === id`), which is why it's immune to the underscore-splitting ambiguity mentioned earlier. It never tries to *parse* the ID, it just rebuilds the same ID for every real pin and compares.

```js
function hasWireBetweenPins(pinA, pinB) {
  var id1 = getPinId(pinA), id2 = getPinId(pinB);
  if (!id1 || !id2) return false;
  return wires.some(function(w) {
    return (w.pin1Id === id1 && w.pin2Id === id2) || (w.pin1Id === id2 && w.pin2Id === id1);
  });
}
```
Prevents drawing a duplicate wire between the same two pins (checked in both directions).

**Touch support** synthesizes real `MouseEvent` objects and dispatches them on the canvas, so single-finger touch reuses 100% of the mouse-handling logic above:
```js
if (e.touches.length === 1) {
  var t = e.touches[0];
  canvas.dispatchEvent(new MouseEvent('mousedown', {
    clientX: t.clientX, clientY: t.clientY, bubbles: true
  }));
}
```
Two-finger touch is handled completely separately, purely for pinch-to-zoom (it never reaches the mouse-event code path).

**Keyboard shortcuts** are bound once at the bottom of the file (`W`/`M`/`D` for tools, `Ctrl/Cmd+Z` for undo, `Escape` to cancel). They're ignored while typing in the code editor, via `isEditorTarget(e.target)`.

### 7.4 📁 `LibraryRegistry.js`

This file is the bridge that lets code like this actually do something:
```cpp
#include <Servo.h>
Servo myServo;
myServo.attach(9);
myServo.write(90);
```

| Function | What it does |
|---|---|
| `registerLibrary(name, Class, config)` | Stores a regex that recognizes a constructor line for that class, e.g. `ClassName varName(args);` |
| `parseInclude(line)` | Matches `#include <X.h>` against registered header filenames |
| `tryInstantiate(line)` | If a line matches a registered constructor pattern, `new`s the real JS class and stores the instance under that variable name |
| `parseMethodCall(line)` | Recognizes `var = instance.method(args);` or `instance.method(args);`, looks up the stored instance, hands back everything `simulator.js` needs to call it |
| `_splitArgs` / `_parseArgs` | A small paren/bracket/brace/quote-aware argument splitter, plus literal-type coercion (strings, hex numbers, booleans, `&varName` references resolved to existing instances) |
| `reset()` | Restores `_instances` to just the "global" ones, called fresh at the start of every `runCode()` |

The default constructor regex, in case you ever need to register a new library:
```js
constructorRegex: config.constructorRegex ||
  new RegExp(`^${name}\\s+(\\w+)\\s*\\((.*)\\)\\s*;?$`)
```
You won't usually touch this file unless you're adding support for a brand-new `#include`-based library — most component work never goes near it.

### 7.5 📁 `simulator.js` — the interpreter

This is the biggest, densest file, and the one most worth slowing down for. It is **not** a real compiler with an AST — it's a line-by-line **text pattern matcher** that re-checks the current line of code against a long list of regular expressions on every single "tick."

#### 7.5.1 Wiring rule tables

```js
const REQUIRED_PINS = {
  led:        ['+', '-'],
  ultrasonic: ['VCC', 'Trig', 'Echo', 'GND'],
  dht:        ['VCC', 'Data', 'GND'],
  // ... one entry per component type — full table in §8
};

const SIGNAL_PINS = {
  led:        '+',
  ultrasonic: 'Echo',
  dht:        'Data',
  // ... the "main" pin used to find a component from an MCU pin number
};
```
If a component type has **no entry** in `REQUIRED_PINS`, `isComponentWired()` returns `true` unconditionally for it — worth remembering if a new part never shows the "NOT WIRED" warning when you expect it to.

#### 7.5.2 MCU & pin resolution helpers

```js
function getMCUPinCandidates(pinNumber) {
  var pinNum = String(pinNumber).replace(/^(GP|D)/i, '');
  var mcu = getActiveMCU();
  if (mcu === 'pico') return ['GP' + pinNum];
  if (mcu === 'esp32') return ['D' + pinNum];
  return ['D' + pinNum, 'GP' + pinNum];   // no MCU yet — try both
}
```
This is why the rest of the code can just say "pin 2" and have it correctly mean `D2` on an ESP32 or `GP2` on a Pico, without every single helper needing its own board-detection logic.

```js
function isComponentWired(comp) {
  const required = REQUIRED_PINS[comp.type];
  if (!required) return true;
  for (let i = 0; i < required.length; i++) {
    const pinId = comp.id + '_' + required[i];
    const connected = wires.some(w => w.pin1Id === pinId || w.pin2Id === pinId);
    if (!connected) return false;
  }
  return true;
}
```
Straightforward once you know `REQUIRED_PINS` — it just checks that every required pin name has *some* wire touching it.

#### 7.5.3 Reading and writing pin values

This is where `digitalWrite`/`digitalRead`/`analogRead`/PWM actually connect to component state. Here's `writeDigitalPinValue` in full, since it's short and shows the pattern every component plugs into:
```js
function writeDigitalPinValue(pin, value) {
  if (pin === null) return;
  var pinName = mcuPinName(pin);
  var boolValue = !!value;
  pinValues[pinName] = boolValue;
  updateLEDsOnPin(pinName, boolValue);
  applyBuzzerState(pin, boolValue);
  // ^ this is exactly where you'd add applyRelayState(pin, boolValue) — see §9
}
```
`readDigitalPinValue` follows the same shape in reverse — it loops over every component, and for each known type checks whether *that component's signal pin* is wired to the requested MCU pin, then returns the right value:
```js
if (comp.type === 'button') {
  var bm = candidates.some(pn => componentConnectedToMcuPin(comp, 'P1', pn));
  if (bm) return comp.state.pressed ? 0 : 1;   // note: pressed = LOW, just like real pull-up buttons
}
```
Adding a new readable component means adding one more `if (comp.type === 'yourtype') { ... return ...; }` block exactly like this one, inside `readDigitalPinValue` (or `readAnalogPinValue` for analog sensors).

#### 7.5.4 The condition & math evaluators — worked trace

`evalCondition(cond)` turns an Arduino-style condition string into a real boolean. Here's a concrete trace, assuming the sketch contains:
```cpp
int x = analogRead(34);
if (x > 2000) {
  digitalWrite(2, HIGH);
}
```
Suppose at this moment `variables.x` is `2500` (because `analogRead(34)` already ran and stored it). When `evalCondition('x > 2000')` runs:
1. It substitutes every known numeric variable by name: `cond = cond.replace(/\bx\b/g, '2500')` → the string becomes `'2500 > 2000'`.
2. `HIGH`/`LOW` get swapped for `1`/`0` (not needed in this example).
3. A safety regex confirms the string only contains digits, spaces, and comparison/math symbols — `/^[\d\s<>=!&|.()+\-*/A-Za-z_"',]+$/`.
4. It's handed to a sandboxed `Function("use strict"; return (2500 > 2000))()`, which evaluates to `true`.

That's the entire trick — string substitution followed by a tightly-scoped `eval`. No real parser, no AST, just text surgery.

#### 7.5.5 Structured execution (`if`/`else`) — worked trace

`handleIfBlock` implements `if/else if/else` by **scanning the raw array of code lines** looking for matching braces — there's no tree structure being built. Given:
```cpp
if (x > 2000) {
  digitalWrite(2, HIGH);
} else {
  digitalWrite(2, LOW);
}
```
as four separate entries in `loopLines[]`, here's what happens:
1. Line 0 matches `/^if\s*\(/`, so `handleIfBlock` takes over.
2. It pulls `condStr = 'x > 2000'` out of line 0, then collects every following line into `bodyLines` until it hits a `}` at the same brace depth — giving `bodyLines = ['digitalWrite(2, HIGH);']`.
3. It evaluates the condition. If true, it runs `executeStructuredLines(bodyLines, 'loop')` (which executes `digitalWrite(2, HIGH);`) and marks `executed = true`.
4. It continues scanning, finds the `} else {` line, sets `condStr = '__else__'`, and collects *its* body: `['digitalWrite(2, LOW);']`.
5. Because `executed` is already `true`, the else-branch check `(!executed && ...)` short-circuits to `false` — **the else body is correctly skipped**, even though the scan visits it.
6. The function returns how many raw lines it consumed, so the outer tick loop can jump the line cursor past the whole `if/else` block in one go.

This is genuinely clever for something with no real parser — but it also means deeply nested or unusually formatted braces can confuse it. If a complex `if` chain misbehaves, this scanning logic (not the condition evaluator) is usually where to look first.

#### 7.5.6 The Run → Tick → Stop lifecycle

**`runCode()`** runs once, when you click Run:
1. If already running, stop first.
2. `validateMCULanguagePair()` — exactly one MCU must be placed, matching the editor's language (`ino`↔ESP32, `py`↔Pico). Aborts with a banner otherwise.
3. Warns (but does **not** block) about any non-MCU component that's missing required wiring.
4. Sets `running = true`, resets the MicroPython runtime bookkeeping.
5. Pulls the raw text out of CodeMirror.
6. If in Python mode, the whole text first goes through `convertPyToSim()` (see §7.5.7); Arduino mode uses the text as-is.
7. **Resets everything**: `variables{}`, `defines{}`, `pinModes{}`, `pinValues{}`, line arrays, delay state, serial buffers, `libraryRegistry.reset()`.
8. Scans `#define` lines, seeds a few built-ins (`DHT11`/`22`/`21`, `SSD1306_*`), then globally substitutes every define name (outside string literals) with its value.
9. Walks the processed text tracking brace depth, sorting every line into `setupLines[]` or `loopLines[]`.
10. Starts `setInterval(tick, 50)`.

**`tick()`** runs every 50ms, forever, until Stop:
1. If a `delay()` is in progress (`isDelayActive`), just checks the real clock. **`delay()` never actually blocks the browser** — it's a cooperative state machine (`delayEndTime`, `delayAdvance`). Once enough wall-clock time has passed, it advances the line cursor and clears the flag.
2. Otherwise, while still in the one-time setup phase, runs the current `setupLines[]` entry and advances. When setup runs out, flips to loop phase, resets the cursor.
3. In loop phase, executes one `loopLines[]` entry per tick (an `if/else` chain is consumed as one unit), wrapping back to line 0 at the end — this **is** the repeating Arduino `loop()`.
4. Everything is wrapped in `try/catch`; any thrown error is caught by `handleRuntimeError()`, which stops the sim and shows the red banner — including a synthetic "timeout" error a disconnected DHT sensor throws on purpose.

**Practical consequence:** the interpreter advances roughly one statement per 50ms tick (faster through consecutive non-`delay()` lines, since they don't pause). It is *not* simulating real microcontroller clock speed — `delay(500)` waits about 500 real-world ms, full stop.

#### 7.5.7 The MicroPython-to-fake-Arduino pipeline — worked trace

This is the cleverest part of the whole project. **There is no separate MicroPython interpreter.** Your `.py` code gets *transpiled into a fake Arduino sketch* full of synthetic function calls, then run through the exact same engine described above.

```
your .py code
     │
     ▼
getPythonLines()            strip comments/imports, normalize tabs
     │
     ▼
extractPythonFunctions()    pulls out top-level no-arg def blocks
     │
     ▼
extractPythonMainLoop()     splits into "setup" (before while True:)
     │                       and "loop" (the while True: body)
     ▼
compilePythonStatements()   walks lines, handling if/elif/else and nested while True:
     │
     ▼
translatePythonStatement()  turns ONE python line into ONE fake-Arduino line
     │
     ▼
convertPyToSim() assembles a full void setup(){...} void loop(){...} text block
     │
     ▼
fed into the SAME runCode() / tick() / executeLineWithDelay() as real .ino code
```

Let's trace the app's own default MicroPython template through this, line by line, so you can see exactly what comes out the other end:
```python
led = Pin(2, Pin.OUT)

while True:
    led.on()
    time.sleep(0.5)
    led.off()
    time.sleep(0.5)
    print("Blink!")
```
- `getPythonLines` strips the `import` lines, leaving 6 real lines.
- `extractPythonMainLoop` finds `while True:` and splits: `setup = ['led = Pin(2, Pin.OUT)']`, `loop = ['led.on()', 'time.sleep(0.5)', 'led.off()', 'time.sleep(0.5)', 'print("Blink!")']`.
- `translatePythonStatement` on each line:
  - `led = Pin(2, Pin.OUT)` matches the Pin-constructor pattern → marks `led` as a known pin variable → outputs `mpPin("led", 2, OUTPUT, NONE);`
  - `led.on()` matches the on/off/high/low pattern (and `led` is a known pin) → outputs `mpPinWrite("led", 1);`
  - `time.sleep(0.5)` matches the sleep pattern → outputs `delay(0.5 * 1000);`
  - `led.off()` → `mpPinWrite("led", 0);`
  - `print("Blink!")` → `Serial.println("Blink!");`
- `convertPyToSim` assembles the final text:
```cpp
void setup() {
  Serial.begin(115200);
  mpPin("led", 2, OUTPUT, NONE);
}

void loop() {
  mpPinWrite("led", 1);
  delay(0.5 * 1000);
  mpPinWrite("led", 0);
  delay(0.5 * 1000);
  Serial.println("Blink!");
}
```
That text is now indistinguishable, as far as `runCode()` is concerned, from a real `.ino` sketch. The `mpPin(...)` / `mpPinWrite(...)` calls aren't real functions anywhere — they're just text patterns that `executeLineWithDelay()` recognizes via regex (search for `mpPinM`, `mpPinWriteM`, etc. in `simulator.js`) and routes to the exact same pin-write helpers Arduino mode uses.

**Why this matters for debugging:** any Python construct with no matching case in `translatePythonStatement` — `for` loops, `try/except`, classes, functions that take arguments — simply has no translation path. That's exactly why the in-app Help docs tell you to avoid those in MicroPython mode. If a Python sketch "does nothing" with no visible error, open the browser devtools console and run `convertPyToSim(yourCodeString)` directly to see exactly what fake-Arduino text it actually became.

### 7.6 📁 `index.html` & `style.css`

`index.html` is mostly layout, plus an inline `<script>` at the bottom handling:
- CodeMirror setup and the Arduino/MicroPython toggle (`toggleLang`) — flips `window.fileMode` between `'ino'`/`'py'`, saves each language's content separately in `_savedContent`, and stops a running sim before switching.
- Mobile tab switching (`mobileTab`) — saves/restores canvas pan/zoom state when flipping between Studio and Code views on phones.
- `showConnAlert` / `showRuntimeError` — the red banner for wiring warnings and runtime errors.
- A thin wrapper around `window.runCode`/`stopCode` that fires custom `sim:run`/`sim:stop` events, purely so the toolbar can add CSS classes for the running/stopped glow effect.

`style.css` defines CSS variables that flip between the Arduino-blue and MicroPython-green theme via `html[data-mode="ino"|"py"]`, plus the responsive layout that collapses into the mobile tab-bar version under 640px width.

### 7.7 📁 `helpTemplate.js` / `helpModal.js`

`helpTemplate.js` is just a giant template string (`window.HELP_MODAL_HTML`) — the entire Help modal's HTML, injected into `#help-root` on page load. `helpModal.js` handles open/close/tab-switching plus a `localStorage` flag (`sh_help_seen`) that auto-opens it once per browser. Low-risk to edit — it's just content and a few DOM toggles, with no connection to the simulator logic.

### 7.8 📁 `libraries/*.js`

I don't have the contents of `DHT.js`, `Wire.js`, `SSD1306.js`, or `Servo.js` — they weren't pasted into our conversation. From how `simulator.js` and `LibraryRegistry.js` *use* them, here's what can be reliably inferred:
- They define plain JS classes, registered via `libraryRegistry.registerLibrary(...)`.
- The Servo class instance carries `_isServo = true` and `_comp` (a back-reference to the on-canvas servo component) — that's how `myServo.write(90)` in user code ends up rotating the horn (see the `swM` regex block near the bottom of `executeLineWithDelay`).
- `SSD1306Library` is referenced directly by name inside `registerMicroPythonSSD1306`, and exposes a `.begin()` method.

If you need to debug something OLED- or Servo-library-specific, you'll need to open those files directly — past this point I'd be guessing.

---

## 8. Component Pin Reference Table

Straight from `REQUIRED_PINS` and `SIGNAL_PINS` in `simulator.js`.

| `type` | Required pins (all must be wired or it's flagged "NOT WIRED") | Signal pin |
|---|---|---|
| `led` | `+`, `-` | `+` |
| `ultrasonic` | `VCC`, `Trig`, `Echo`, `GND` | `Echo` |
| `dht` | `VCC`, `Data`, `GND` | `Data` |
| `pir` | `VCC`, `OUT`, `GND` | `OUT` |
| `ldr` | `S`, `VCC`, `GND` | `S` |
| `button` | `P1`, `P2` | `P1` |
| `joystick` | `VCC`, `GND`, `VRX`, `VRY`, `SW` | `VRX` |
| `ky004` | `S`, `VCC`, `GND` | `S` |
| `sw420` | `DO`, `GND`, `VCC` | `DO` |
| `flame` | `AO`, `DO`, `GND`, `VCC` | `DO` |
| `ky032` | `OUT`, `VCC`, `GND` | `OUT` |
| `servo` | `PWM`, `VCC`, `GND` | `PWM` |
| `buzzer` | `+`, `-` | `+` |
| `ssd1306` | `GND`, `VCC`, `SCL`, `SDA` | *(none — reached via the I2C/library system, not direct pin reads)* |

---

## 9. Hands-On Tutorial: Finishing the Relay Component

Your project already has unfinished, unreachable code for a `'relay'` type — real click-handling logic in `interaction.js` with no matching factory, no draw function, and no wiring rule anywhere. It's the perfect practice target because it's not hypothetical. Open `interaction.js` and search for `'relay'` to see it:
```js
if (c.type === 'relay') {
  var rdx = x - c.x;
  var rdy = y - c.y;
  if (rdx * rdx + rdy * rdy < 400) {
    saveState();
    c.state.active = !c.state.active;
    updateStatus('Relay: ' + (c.state.active ? 'ON' : 'OFF'));
    draw();
    return;
  }
}
```
Six steps bring it fully to life. This is the same checklist for *any* new component — just filled in concretely.

**✅ Step 1 — 📁 `components.js`: give it data**
```js
function createRelay(x, y) {
  var c = {
    id: mkId(),
    type: 'relay',
    x: x, y: y,
    width: 50, height: 36,
    pins: [],
    state: { active: false }
  };
  c.pins.push({ name: 'IN',  x: x - 18, y: y + 18, side: 'bottom', type: 'gpio',  color: '#3ddc84' });
  c.pins.push({ name: 'VCC', x: x,      y: y + 18, side: 'bottom', type: 'power', color: '#ff5566' });
  c.pins.push({ name: 'GND', x: x + 18, y: y + 18, side: 'bottom', type: 'gnd',   color: '#8b7355' });
  return c;
}
```

**✅ Step 2 — 📁 `drawing.js`: give it looks**
```js
function drawRelay(c) {
  var x = c.x, y = c.y, active = !!c.state.active;

  ctx.fillStyle = active ? '#1a3a2a' : '#1a2a3a';
  ctx.fillRect(x - 25, y - 18, 50, 36);
  ctx.strokeStyle = active ? '#45d9a7' : '#2a4a6a';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 25, y - 18, 50, 36);

  ctx.fillStyle = '#8890a8';
  ctx.font = 'bold 7px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('RELAY', x, y + 24);

  c.pins.forEach(function(p, i) {
    p.x = x - 18 + i * 18;
    p.y = y + 18;
    drawPinDot(p, wireStart === p);
  });
}
```
Then add one line inside `draw()`'s if/else chain:
```js
else if (c.type === 'relay') drawRelay(c);
```

**✅ Step 3 — 📁 `components.js`: let it actually be placed** — one line inside `addComponent()`:
```js
else if (type === 'relay') comp = createRelay(cx, cy);
```

**✅ Step 4 — 📁 `index.html`: give it a palette button**
```html
<div class="comp-item" data-cat="peripherals" onclick="addComponent('relay')">
  <span class="comp-icon">🔌</span><span class="comp-name">Relay</span>
</div>
```

**✅ Step 5 — 📁 `simulator.js`: define its wiring rule** — one line in `REQUIRED_PINS`:
```js
relay: ['IN', 'VCC', 'GND'],
```

**✅ Step 6 — 📁 `simulator.js`: let code control it** — copy the buzzer's exact pattern:
```js
function applyRelayState(pin, active) {
  var candidates = getMCUPinCandidates(pin);
  for (var i = 0; i < components.length; i++) {
    var comp = components[i];
    if (comp.type !== 'relay') continue;
    var matched = candidates.some(function(pn) {
      return componentConnectedToMcuPin(comp, 'IN', pn);
    });
    if (!matched || !isComponentWired(comp)) continue;
    comp.state.active = !!active;
  }
}
```
Then call it right next to the existing `applyBuzzerState(...)` line inside `writeDigitalPinValue()`:
```js
applyRelayState(pin, boolValue);
```

Done. `digitalWrite(5, HIGH)` on a relay wired to that pin now flips `state.active = true` — and the click-toggle logic that was already sitting in `interaction.js` works too, for free, because you never had to touch that file.

---

## 10. Debugging Playbook

| Symptom | Likely cause | Where to look |
|---|---|---|
| New component never appears, console says "Unknown component: x" | Not registered in `addComponent()`, or the palette button's `onclick` string doesn't exactly match your `type` | `components.js` → `addComponent()` |
| It's in the `components` array (check in devtools) but nothing draws | Missing/typo'd case in the `draw()` dispatcher | `drawing.js` → `draw()` |
| Always shows "⚠ NOT WIRED" even when fully wired | Pin **names** in `createXXX` don't exactly match the strings in `REQUIRED_PINS` (case-sensitive) | `simulator.js` → `REQUIRED_PINS` |
| `digitalWrite`/`analogWrite` does nothing to it | No hook added in `writeDigitalPinValue` / `writePWMValue` | `simulator.js` |
| `digitalRead`/`analogRead` always returns the same value | No hook in `readDigitalPinValue`/`readAnalogPinValue`, or the signal-pin name passed to `componentConnectedToMcuPin` doesn't match | `simulator.js` |
| Two pins on one part act identical, or one is "invisible" to wiring | **Duplicate `pin.name`** on the same component — the exact bug you already fixed on the ESP32 (`GND`/`GND2`) and Pico (`GND_0`–`GND_6`) | Every `pins.push(...)` in that `createXXX` |
| Wires visually detach/snap wrong while dragging | A draw function isn't recomputing that pin's `x`/`y` from the component's current `x`/`y` | The relevant `drawXXX` — compare to `drawLED`/`drawUltrasonic` |
| Wire bend-handles stop responding after some action | `draw()` wasn't called after that state change — `w._handles` only gets recomputed *inside* `draw()` | Add a `draw()` call right after the mutation |
| Code "runs," a line visibly does nothing, no error shown | The line matched **none** of the regexes in `executeLineWithDelay` — unmatched lines are silent no-ops, not errors | `simulator.js` → scan the regex list for your pattern |
| MicroPython sketch with `for`/`try-except`/a class does nothing | No translation path exists for that construct (see §7.5.7) | Run `convertPyToSim(code)` in the browser console to see what it became |
| Pins/clicks feel "off" after zooming | Raw `clientX/Y` used instead of going through `getCanvasXY()` | `interaction.js` |
| A runtime error banner shows up but the message is vague | The real JS error + stack trace is still logged via `console.error` inside `handleRuntimeError` | Browser devtools console |

---

## 11. The 3 Mistakes That Cause Most Bugs

1. **Same pin name twice on one component.** Wires are tracked by `componentId + '_' + pinName`. Two pins named `'GND'` on the same part collide.
2. **Registered in `addComponent()` but forgot `draw()`'s dispatcher, or vice versa.** A component needs BOTH the create-dispatcher line and the draw-dispatcher line. Missing one means it either never appears, or exists invisibly.
3. **Changed component data, but never called `draw()` after.** Nothing updates visually until `draw()` runs again — it isn't automatic, and `w._handles` for wire-dragging specifically depends on it.

---

## 12. Glossary of Global Variables

| Variable | Lives in | Meaning |
|---|---|---|
| `components` | `components.js` | Array of every placed component object |
| `wires` | `components.js` | Array of every wire object |
| `tool` | `components.js` | Current tool: `'wire'` \| `'move'` \| `'delete'` |
| `wireStart` | `components.js` | The pin clicked first while drawing a wire, or `null` |
| `dragging` | `components.js` | Describes whatever is currently being mouse-dragged |
| `mouseX` / `mouseY` | `components.js` | Current mouse position in canvas (unzoomed) coordinates |
| `actionHistory` | `components.js` | The undo stack |
| `window.zoomLevel` | `interaction.js` | Current canvas zoom factor (0.25–3.0) |
| `running` | `simulator.js` | Is a sketch currently executing? |
| `executionInterval` | `simulator.js` | The `setInterval` handle for `tick()` |
| `variables` | `simulator.js` | The interpreter's simulated variable table |
| `pinModes` / `pinValues` | `simulator.js` | Per-pin mode and last written boolean value |
| `setupLines` / `loopLines` | `simulator.js` | The sketch split into its two line arrays |
| `currentLineIndex` / `currentSetupLineIndex` | `simulator.js` | Where `tick()` currently is |
| `inSetupPhase` | `simulator.js` | Still running `setup()`, or in the repeating `loop()`? |
| `isDelayActive` / `delayEndTime` / `delayAdvance` / `delayPhase` | `simulator.js` | The non-blocking `delay()` state machine |
| `serialLineBuffer` / `serialRxBuffer` | `simulator.js` | Outgoing line-buffer / incoming typed-input queue |
| `runtimeMode` | `simulator.js` | `'ino'` or `'py'` for the active run |
| `microPythonRuntime` | `simulator.js` | The `{pins, adc, pwm, i2c, displays, dht}` bookkeeping object |
| `libraryRegistry` | `LibraryRegistry.js` | The shared instance resolving `#include`-based library calls |

---

## 13. One-Page Cheat Sheet

**3 files, 3 jobs:** `components.js` = data, `drawing.js` = looks, `interaction.js` = clicks. `simulator.js` = the brain that connects code to data.

**Adding a component touches up to 6 spots:**
1. `createXXX()` in `components.js`
2. `drawXXX()` in `drawing.js` + its line in `draw()`'s dispatcher
3. Its line in `addComponent()`'s dispatcher
4. A palette `<div class="comp-item">` in `index.html`
5. `REQUIRED_PINS` entry in `simulator.js` (if it should ever show "NOT WIRED")
6. A hook in `writeDigitalPinValue`/`readDigitalPinValue`/etc. in `simulator.js` (only if code should control or read it)

**The data loop to remember for anything interactive:** data exists → its drawn position gets saved by `drawing.js` → a click is checked against that saved position in `interaction.js` → data gets updated → `draw()` runs again.

**The #1 bug to watch for:** duplicate pin names on the same component. Pin IDs are `componentId + '_' + pinName` — duplicates collide.

**MicroPython isn't really interpreted** — it's translated into a fake Arduino sketch full of `mpXxx(...)` calls, then run through the normal Arduino engine. Constructs with no translation rule in `translatePythonStatement` (loops, try/except, classes) just silently do nothing.
