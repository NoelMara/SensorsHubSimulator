# SensorsHub Component Guide

This guide is for learning the project slowly, not just copy-pasting code.

If you want to add a new part, you usually do **not** need to touch every file in the project.

Most of the time, you only work in these files:

1. `index.html`
2. `components.js`
3. `drawing.js`
4. `simulator.js`
5. `interaction.js` only if the part can be clicked, dragged, toggled, or adjusted
6. `libraries/*.js` only if the part needs its own code library API like `DHT`, `Servo`, or `SSD1306`

---

## 1. The Big Picture

Each component follows this life cycle:

1. A palette button is added in `index.html`
2. `components.js` creates the component object
3. `drawing.js` draws the component on the canvas
4. `interaction.js` changes its state when the user clicks or drags it
5. `simulator.js` makes code affect it, or lets the part feed values back into code
6. `libraries/*.js` is optional for advanced parts with custom library-style code

Short version:

`palette -> create object -> draw object -> interact -> simulate`

---

## 2. What Each Main File Does

### `index.html`
Use this when:

- you want the new part to appear in the component palette
- you want to load a new library file

What you add here:

- a new palette item like `onclick="addComponent('my_part')"`
- an optional `<script src="libraries/MyPart.js"></script>` if your part uses its own library file

Good examples to search for:

- `addComponent('ultrasonic')`
- `addComponent('ssd1306')`

### `components.js`
Use this when:

- you want to create the actual component object
- you want to define pins, size, and default state

What you add here:

- a new `createMyPart(x, y)` function
- a line inside `addComponent(type)` that calls your create function

This file is the "birth place" of the component.

### `drawing.js`
Use this when:

- you want the part to appear visually on the canvas
- you want to draw labels, sliders, status text, LEDs, displays, and pins

What you add here:

- a new `drawMyPart(c)` function
- a line inside the main `draw()` dispatcher

This file is the "face" of the component.

### `interaction.js`
Use this when:

- the user should be able to click the part
- the user should drag a slider
- the user should toggle a value like `pressed`, `motion`, `light`, `distance`

What you add here:

- mouse or touch handling for your new state

This file is the "hands" of the component.

### `simulator.js`
Use this when:

- the part must be checked for proper wiring
- Arduino or MicroPython code needs to read from it
- Arduino or MicroPython code needs to control it

What you add here:

- required pins in `REQUIRED_PINS`
- sometimes a signal pin in `SIGNAL_PINS`
- logic inside functions like:
  - `readDigitalPinValue`
  - `readAnalogPinValue`
  - `writeDigitalPinValue`
  - `writePWMValue`
  - helper functions if needed

This file is the "brain" of the simulator.

### `libraries/*.js`
Use this only when:

- the part is controlled through a class or library API
- examples: `DHT`, `Servo`, `SSD1306`

What you add here:

- a class like `MyPartLibrary`
- methods like `begin()`, `read()`, `write()`, `show()`
- registration with `libraryRegistry.registerLibrary(...)`

This file is the "special translator" between user code and the component.

---

## 3. Minimum Files Needed by Component Type

### A. Simple output part
Example: LED, buzzer

Usually edit:

1. `index.html`
2. `components.js`
3. `drawing.js`
4. `simulator.js`

### B. Clickable or adjustable sensor
Example: button, PIR, LDR, joystick, ultrasonic

Usually edit:

1. `index.html`
2. `components.js`
3. `drawing.js`
4. `interaction.js`
5. `simulator.js`

### C. Library-based part
Example: DHT, Servo, SSD1306

Usually edit:

1. `index.html`
2. `components.js`
3. `drawing.js`
4. `simulator.js`
5. `libraries/MyPart.js`

---

## 4. The Component Object Shape

Most parts in `components.js` look like this:

```js
function createMyPart(x, y) {
  var c = {
    id: mkId(),
    type: 'my_part',
    x: x,
    y: y,
    width: 40,
    height: 40,
    pins: [],
    state: {
      active: false
    }
  };

  c.pins.push({ name: 'VCC', x: x - 15, y: y, side: 'left', type: 'power', color: '#ff5566' });
  c.pins.push({ name: 'OUT', x: x + 15, y: y, side: 'right', type: 'gpio', color: '#3ddc84' });
  c.pins.push({ name: 'GND', x: x, y: y + 18, side: 'bottom', type: 'gnd', color: '#8b7355' });

  return c;
}
```

Important meanings:

- `type`: the exact name used in every file
- `pins`: the names must match what you later use in `simulator.js`
- `state`: live values for the part

If the `type` or pin names do not match across files, the part will not work.

---

## 5. The Real Checklist When Adding a Part

Use this every time.

### Step 1. Add the palette item in `index.html`

Example:

```html
<div class="comp-item" data-cat="sensors" onclick="addComponent('touch')" style="display:none">
  <span class="comp-icon">👆</span><span class="comp-name">Touch</span>
</div>
```

### Step 2. Add the factory in `components.js`

You need two things:

1. a new line in `addComponent(type)`
2. a new `createTouch(x, y)` function

Example mapping:

```js
else if (type === 'touch') comp = createTouch(cx, cy);
```

Example factory:

```js
function createTouch(x, y) {
  var c = {
    id: mkId(),
    type: 'touch',
    x: x,
    y: y,
    width: 42,
    height: 42,
    pins: [],
    state: { touched: false }
  };

  c.pins.push({ name: 'VCC', x: x - 16, y: y - 8, side: 'left', type: 'power', color: '#ff5566' });
  c.pins.push({ name: 'OUT', x: x + 16, y: y - 8, side: 'right', type: 'gpio', color: '#3ddc84' });
  c.pins.push({ name: 'GND', x: x, y: y + 12, side: 'bottom', type: 'gnd', color: '#8b7355' });

  return c;
}
```

### Step 3. Draw it in `drawing.js`

You need two things:

1. add it to the `draw()` dispatcher
2. create `drawTouch(c)`

Dispatcher line:

```js
else if (c.type === 'touch') drawTouch(c);
```

Simple draw example:

```js
function drawTouch(c) {
  var x = c.x;
  var y = c.y;
  var active = !!c.state.touched;
  var wired = typeof isComponentWired === 'function' ? isComponentWired(c) : true;

  ctx.fillStyle = active ? '#22ddaa' : '#1e2430';
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = wired ? '#4a90ff' : '#7a3344';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#d8e2ff';
  ctx.font = 'bold 7px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(active ? 'TOUCH' : 'IDLE', x, y + 30);

  c.pins.forEach(function(p) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
}
```

### Step 4. Add interaction in `interaction.js` if needed

If the part should react when clicked:

```js
if (c.type === 'touch') {
  var dx = x - c.x;
  var dy = y - c.y;
  if (dx * dx + dy * dy < 324) {
    saveState();
    c.state.touched = !c.state.touched;
    updateStatus('Touch: ' + (c.state.touched ? 'ON' : 'OFF'));
    draw();
    return;
  }
}
```

If the part has a slider, copy the pattern from:

- `ultrasonic`
- `ldr`
- `joystick`
- `dht`

### Step 5. Add simulator logic in `simulator.js`

First, define required pins:

```js
touch: ['VCC', 'OUT', 'GND']
```

If it is a signal-based sensor, also add:

```js
touch: 'OUT'
```

Then decide how code sees it.

For a digital sensor, add logic inside `readDigitalPinValue(pin)`:

```js
if (comp.type === 'touch') {
  var tm = candidates.some(function(pn) {
    return componentConnectedToMcuPin(comp, 'OUT', pn);
  });
  if (tm) return comp.state.touched ? 1 : 0;
}
```

That means:

- if the MCU reads the pin
- and the touch sensor is wired there
- return `1` or `0` based on the current sensor state

### Step 6. Add a custom library only if really needed

If user code looks like this:

```cpp
MySensor sensor(4);
sensor.begin();
sensor.readValue();
```

then a `libraries/MySensor.js` file may make sense.

If user code only uses `digitalRead`, `analogRead`, `digitalWrite`, or PWM, you often do **not** need a new library file.

---

## 6. Easiest Parts to Practice First

Start with these in order:

1. Copy `pir` and turn it into another simple digital sensor
2. Copy `button` and rename its state
3. Copy `ldr` if you want a slider-based analog sensor
4. Copy `ssd1306` only after you feel comfortable with the simpler ones

Good beginner copies:

- Want a digital sensor: copy `createPIR`, `drawPIR`, and the `pir` parts in `interaction.js` and `simulator.js`
- Want an analog sensor: copy `createLDR`, `drawLDR`, and the `ldr` parts
- Want a library-based device: study `libraries/SSD1306.js` or `libraries/Servo.js`

---

## 7. A Beginner Practice Plan

Do this in small steps.

### Practice 1: Add a fake "Touch Sensor"

Files to touch:

1. `index.html`
2. `components.js`
3. `drawing.js`
4. `interaction.js`
5. `simulator.js`

Goal:

- click it to toggle `touched`
- `digitalRead()` should return `1` when touched, `0` when not touched

### Practice 2: Add a "Light Bar"

Files to touch:

1. `index.html`
2. `components.js`
3. `drawing.js`
4. `simulator.js`

Goal:

- make it act like an output
- light up when `digitalWrite(pin, HIGH)` happens

### Practice 3: Add a new library-controlled device

Files to touch:

1. `index.html`
2. `components.js`
3. `drawing.js`
4. `simulator.js`
5. `libraries/MyDevice.js`

Goal:

- create a class
- register it with `libraryRegistry`
- respond to method calls

---

## 8. Common Mistakes

These are the bugs that happen most often.

### Mistake 1. `type` names do not match

Bad:

- `type: 'touch_sensor'` in one file
- `c.type === 'touch'` in another file

Fix:

- use one exact string everywhere

### Mistake 2. Pin names do not match

Bad:

- `components.js` uses `'OUT'`
- `simulator.js` checks for `'SIG'`

Fix:

- pin names must be identical

### Mistake 3. State names do not match

Bad:

- drawing checks `c.state.on`
- interaction updates `c.state.active`

Fix:

- pick one name and keep it everywhere

### Mistake 4. You created the part, but forgot the draw dispatcher

Symptom:

- the component exists in memory, but nothing appears on the canvas

Fix:

- add `else if (c.type === 'my_part') drawMyPart(c);`

### Mistake 5. You drew the part, but forgot simulator wiring rules

Symptom:

- it appears on screen
- but code does nothing

Fix:

- add its pins to `REQUIRED_PINS`
- add read or write behavior in `simulator.js`

### Mistake 6. You forgot interaction code for a clickable part

Symptom:

- the part is visible
- but clicking does nothing

Fix:

- add click or drag logic in `interaction.js`

---

## 9. How to Read Existing Components Without Getting Lost

When you study an existing part, do it in this order:

1. Search for its `type`
2. Read `create...()` in `components.js`
3. Read `draw...()` in `drawing.js`
4. Search the same `type` in `interaction.js`
5. Search the same `type` in `simulator.js`

Example search words:

- `type === 'pir'`
- `type === 'ldr'`
- `type === 'ssd1306'`

Do not try to understand the whole project at once.
Understand one component from start to finish.

---

## 10. Good Learning Habit for This Project

When adding a component, make only one kind of change at a time.

Good order:

1. Make it appear in the palette
2. Make it spawn on the canvas
3. Make it draw correctly
4. Make it clickable if needed
5. Make it work with code
6. Only then improve visuals

That way, if something breaks, you know where the problem likely is.

---

## 11. Optional Files You Usually Do Not Need First

You usually do **not** need to edit these for a basic new component:

- `style.css`
- `helpTemplate.js`
- `helpModal.js`

Only touch them if you want:

- custom styling
- help documentation
- UI polish

---

## 12. Final Advice

You are already doing something valuable: you built a working simulator and now you want to understand it better.

A good way to grow from here is:

1. copy one simple component pattern
2. rename it carefully
3. change one behavior
4. test it
5. repeat

That is not "cheating." That is how many developers learn large codebases.

If you want, the best next practice exercise is:

**make a new `touch` sensor by copying `pir` and changing it step by step**

That is one of the cleanest beginner exercises in this project.
