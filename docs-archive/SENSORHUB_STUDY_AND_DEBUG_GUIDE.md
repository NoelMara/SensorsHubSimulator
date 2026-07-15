# SensorHub Study and Debug Guide

This guide explains the SensorHub codebase in a practical way: what each file does, how data moves through the app, how the simulator understands user code, how to debug problems, and how to add a new component without getting lost.

It does not change the app code. It is a learning guide for the current project in this folder.

---

## 1. The Short Version

SensorHub is a browser-based circuit simulator. It is made from plain HTML, CSS, JavaScript, and canvas drawing.

The most important idea:

```text
index.html       -> buttons, panels, editor, script loading
components.js    -> creates component objects and stores global app state
drawing.js       -> draws components, pins, wires, sliders, warnings
interaction.js   -> mouse, touch, keyboard, wiring, dragging, clicking
simulator.js     -> runs simplified Arduino/MicroPython code
libraries/*.js   -> fake Arduino libraries that connect code to components
style.css        -> visual design and responsive layout
```

The project has one shared truth:

```js
components = []
wires = []
```

Almost everything reads from or writes to those two arrays.

---

## 2. How The App Starts

Open `index.html`. That file creates the toolbar, code editor, simulation canvas, serial monitor, component palette, and help root.

Near the bottom of `index.html`, scripts are loaded in this order:

```html
<script src="drawing.js"></script>
<script src="components.js"></script>
<script src="interaction.js"></script>
<script src="LibraryRegistry.js"></script>
<script src="libraries/DHT.js"></script>
<script src="libraries/Wire.js"></script>
<script src="libraries/SSD1306.js"></script>
<script src="libraries/Servo.js"></script>
<script src="simulator.js"></script>
<script src="helpTemplate.js"></script>
<script src="helpModal.js"></script>
```

This means:

- `drawing.js` defines drawing functions.
- `components.js` creates the global arrays and component factories.
- `interaction.js` attaches canvas events.
- `LibraryRegistry.js` prepares fake Arduino library support.
- `libraries/*.js` register supported libraries.
- `simulator.js` defines the code runner.
- `helpTemplate.js` and `helpModal.js` build the help window.

Even though `drawing.js` loads before `components.js`, most drawing code does not run immediately. It runs later after the page has loaded, so the global variables already exist by then.

---

## 3. The Main Data Model

### Component Object

Every part on the canvas is a plain JavaScript object. A typical component looks like this:

```js
{
  id: "c_...",
  type: "led",
  x: 300,
  y: 200,
  width: 20,
  height: 36,
  pins: [],
  state: {
    on: false,
    color: "#ff3344",
    label: "Red"
  }
}
```

Important fields:

- `id`: unique component id from `mkId()`.
- `type`: tells the rest of the app what kind of component it is.
- `x`, `y`: position on the canvas.
- `width`, `height`: used for drawing and hit testing.
- `pins`: the connection points.
- `state`: the live simulated values.

Important warning:

- For `esp32` and `pico`, `x` and `y` mean the top-left corner.
- For most other components, `x` and `y` mean the center.

That difference matters when moving, drawing, or hit-testing components.

### Pin Object

Pins are stored inside each component:

```js
{
  name: "+",
  x: 300,
  y: 232,
  side: "bottom",
  type: "gpio",
  color: "#3ddc84"
}
```

Important fields:

- `name`: used to identify the pin in wires, for example `+`, `GND`, `Data`, `PWM`.
- `x`, `y`: current canvas position.
- `type`: used mostly for color and wire styling.
- `hitRadius`: optional larger clickable area.

### Wire Object

When two pins are connected, a wire is stored in `wires`:

```js
{
  x1: 300,
  y1: 232,
  x2: 150,
  y2: 120,
  color: "#9ece6a",
  pin1Id: "componentId_+",
  pin2Id: "mcuId_D2",
  waypoints: []
}
```

Important fields:

- `pin1Id` and `pin2Id` are the real source of the connection.
- `x1`, `y1`, `x2`, `y2` are drawing positions.
- `waypoints` are bend points added by dragging wire handles.

If a component moves, the app must update its pin positions and then sync the wire endpoints.

---

## 4. File By File

### `index.html`

This is the page shell.

Main responsibilities:

- Toolbar buttons: wire, move, delete, undo, clear, run, stop, serial, editor, help.
- Mobile tabs.
- Code panel and CodeMirror editor.
- Canvas area.
- Component palette.
- Serial monitor HTML.
- Help root.
- Script loading.
- Language toggle between Arduino `.ino` and MicroPython `.py`.
- Palette category filtering.
- Runtime warning banner.

Important functions inside the inline script:

- `getCode()`: returns code from CodeMirror or the fallback textarea.
- `toggleLang()`: switches between Arduino and MicroPython editor modes.
- `switchCat(cat)`: shows component palette items by category.
- `toggleCodePanel()`: collapses or expands the editor.
- `mobileTab(tab)`: switches mobile view between simulation and code.
- `showConnAlert(msg)`: warning banner.
- `showRuntimeError(msg)`: error banner.

When adding a visible component, `index.html` usually needs a new palette item:

```html
<div class="comp-item" data-cat="sensors" onclick="addComponent('my_sensor')" style="display:none">
  <span class="comp-icon">?</span><span class="comp-name">My Sensor</span>
</div>
```

### `components.js`

This file creates the app's main state and component objects.

Important globals:

```js
let components = []
let wires = []
let tool = "wire"
let wireStart = null
let dragging = null
let actionHistory = []
```

Main responsibilities:

- Store all components and wires.
- Add new components from the palette.
- Create each component type.
- Save undo states.
- Resize the canvas.
- Keep components visible after resize.
- Update status text.

Important functions:

- `addComponent(type)`: receives a string from the palette and calls the correct factory.
- `createESP32(x, y)`, `createPico(x, y)`: create microcontroller boards.
- `createLED(...)`, `createUltrasonic(...)`, etc.: create parts.
- `saveState()`: snapshots `components` and `wires` before a change.
- `undo()`: restores the previous snapshot.
- `clearAll()`: clears canvas objects.
- `resizeCanvas()`: matches canvas size to container and zoom.
- `fixOffscreenComponents()`: moves objects back into view if needed.
- `setTool(t)`: changes wire/move/delete mode.

For adding a component, this file is where you define:

- `type`
- size
- pins
- default `state`
- optional slider cache objects like `_slider`, `_tempSlider`, `_servoSlider`

### `drawing.js`

This file paints the whole simulator onto the canvas.

Main responsibilities:

- Clear and redraw the canvas.
- Draw the background grid.
- Draw every component.
- Draw every wire.
- Draw wire waypoints and wire handles.
- Draw the temporary wire preview.
- Update pin positions while drawing.
- Draw "NOT WIRED" warnings.
- Handle pin tooltips.
- Handle wire spark effects.

Important functions:

- `draw()`: the main render function.
- `drawESP32(c)`, `drawPico(c)`, `drawLED(c)`, etc.: component painters.
- `drawPinDot(p, selected)`: shared pin rendering.
- `drawNotWiredWarning(c)`: red warning below incomplete components.
- `spawnSpark(x, y, color)`: visual effect when a new wire appears.
- `syncSparkCanvas()`: resizes the spark overlay canvas.
- `initTooltip()`: attaches pin tooltip behavior.

Important pattern:

```js
components.forEach(function(c) {
  if      (c.type === "esp32") drawESP32(c);
  else if (c.type === "pico")  drawPico(c);
  else if (c.type === "led")   drawLED(c);
});
```

If a component is created but not drawn, check this dispatcher first.

### `interaction.js`

This file controls what happens when the user interacts with the canvas.

Main responsibilities:

- Convert mouse/touch coordinates into canvas coordinates.
- Detect pins.
- Detect components.
- Start and finish wires.
- Move components.
- Delete components and wires.
- Drag sliders.
- Toggle sensor states.
- Handle keyboard shortcuts.
- Handle wheel zoom and pinch zoom.

Important functions:

- `getCanvasXY(e)`: converts screen coordinates to canvas coordinates while respecting zoom.
- `findPin(mx, my)`: returns the nearest clickable pin.
- `findComponent(mx, my)`: returns the topmost component under the pointer.
- `getPinId(pin)`: converts a pin into a string like `componentId_pinName`.
- `findPinById(id)`: finds a pin from that string.
- `syncWireEndpoints(w)`: updates one wire after pins move.
- `syncAllWireEndpoints()`: updates all wires.
- `handleCanvasMouseMove(e)`: dragging and cursor updates.
- `handleCanvasMouseDown(e)`: most click behavior.
- `handleCanvasDoubleClick(e)`: removes wire waypoints.
- `handleCanvasWheel(e)`: zoom.

Keyboard shortcuts:

- `W`: wire tool
- `M`: move tool
- `D`: delete tool
- `Ctrl+Z`: undo
- `Escape`: cancel current drag/wire

Important debugging note:

`interaction.js` currently contains blocks for `rgb_led` and `relay`, but the current project does not have matching factories, draw functions, and palette items for those types. Treat those as unfinished/dead code unless you intentionally complete those components.

### `simulator.js`

This is the runtime engine. It is not a full Arduino compiler or full Python interpreter. It is a custom simulator that recognizes common code patterns and turns them into changes on `components`.

Main responsibilities:

- Validate there is exactly one microcontroller.
- Enforce board/language pair:
  - Arduino `.ino` mode works with ESP32.
  - MicroPython `.py` mode works with Pico.
- Check required component wiring.
- Parse simple Arduino code.
- Convert supported MicroPython code into simulator-friendly pseudo-Arduino code.
- Execute setup lines once.
- Execute loop lines repeatedly.
- Handle delays.
- Read/write pins.
- Update LEDs, buzzer, servo, OLED, sensors, and serial output.

Important globals:

```js
let running = false
let variables = {}
let pinModes = {}
let pinValues = {}
let setupLines = []
let loopLines = []
let runtimeMode = "ino"
```

Important functions:

- `validateMCULanguagePair()`: blocks invalid board/language combinations.
- `runCode()`: prepares runtime state, parses code, starts the timer.
- `tick()`: executes the next line about every 50ms.
- `stopCode()`: stops runtime and resets outputs.
- `executeLineWithDelay(line, phase)`: recognizes and runs supported commands.
- `readDigitalPinValue(pin)`: returns digital sensor values.
- `readAnalogPinValue(pin, targetMax)`: returns analog sensor values.
- `writeDigitalPinValue(pin, value)`: updates outputs like LED and buzzer.
- `writePWMValue(pin, dutyValue, dutyMax, frequency)`: updates PWM outputs like servo/buzzer.
- `getUltrasonicPulseDuration(pin, expectedValue)`: converts distance to pulse time.
- `convertPyToSim(code)`: translates supported MicroPython into simulator code.

### `LibraryRegistry.js`

This file lets Arduino-like code create library objects.

Example user code:

```cpp
#include <Servo.h>
Servo myServo;
myServo.attach(5);
myServo.write(90);
```

The registry:

- recognizes `#include` lines,
- recognizes constructor lines like `Servo myServo;`,
- stores instances by variable name,
- recognizes method calls like `myServo.write(90);`,
- calls the JavaScript class method behind the scenes.

Important methods:

- `registerLibrary(name, LibraryClass, config)`
- `parseInclude(line)`
- `tryInstantiate(line)`
- `parseMethodCall(line)`
- `getInstance(varName)`
- `reset()`

### `libraries/DHT.js`

Implements fake DHT support.

Main behavior:

- Finds a `dht` component whose `Data` pin is wired to the requested MCU pin.
- `begin()` succeeds only if the component is found.
- `readTemperature()` returns `comp.state.temperature`.
- `readHumidity()` returns `comp.state.humidity`.
- `computeHeatIndex()` calculates a heat index from temp/humidity.

Registered header:

```cpp
#include <DHT.h>
```

### `libraries/Servo.js`

Implements fake Servo support.

Main behavior:

- `attach(pin)` remembers the target pin.
- `write(angle)` finds a wired servo and updates `comp.state.angle`.
- `writeMicroseconds(us)` converts pulse width to angle.
- `read()` returns the last angle.
- `detach()` clears the pin.

Registered headers:

```cpp
#include <Servo.h>
#include <ESP32Servo.h>
```

### `libraries/Wire.js`

Implements fake I2C `Wire`.

Main behavior:

- `Wire.begin(sda, scl)` stores the expected SDA/SCL pins.
- Used by OLED support to know which pins the code expects.

Registered header:

```cpp
#include <Wire.h>
```

### `libraries/SSD1306.js`

Implements fake OLED support.

Main behavior:

- Finds an `ssd1306` component.
- Checks required OLED wiring.
- Optionally checks the code's expected I2C pins.
- Maintains a 128x64 display buffer.
- `print()`, `println()`, `text()`, `clearDisplay()`, `display()`, and `show()` update the simulated screen.

Registered headers/classes:

```cpp
#include <Adafruit_SSD1306.h>
#include <SSD1306.h>
```

### `helpTemplate.js` and `helpModal.js`

`helpTemplate.js` contains the help modal HTML as one big template string.

`helpModal.js` controls:

- injecting the help template,
- opening and closing the modal,
- switching help tabs,
- closing with Escape.

### `style.css`

This file controls all visual styling:

- layout,
- toolbar,
- palette,
- code editor,
- canvas container,
- serial monitor,
- warning banners,
- help modal,
- responsive/mobile behavior.

If something looks wrong but the logic works, inspect `style.css`.

---

## 5. Component Reference Table

This table uses the current code as the source of truth.

| Palette Type | Internal Type | Factory | Draw Function | Main State | Code Support |
|---|---|---|---|---|---|
| `esp32` | `esp32` | `createESP32` | `drawESP32` | `{}` | Required for Arduino `.ino` mode |
| `pico` | `pico` | `createPico` | `drawPico` | `{}` | Required for MicroPython `.py` mode |
| `led_red` etc. | `led` | `createLED` | `drawLED` | `on`, `color`, `label` | `digitalWrite`, PWM on/off |
| `ultrasonic` | `ultrasonic` | `createUltrasonic` | `drawUltrasonic` | `distance` | `pulseIn` / MicroPython `time_pulse_us` |
| `dht` | `dht` | `createDHT22` | `drawDHT22` | `temperature`, `humidity` | DHT library / MicroPython DHT |
| `pir` | `pir` | `createPIR` | `drawPIR` | `motion` | `digitalRead` |
| `ldr` | `ldr` | `createLDR` | `drawLDR` | `light` | `analogRead` |
| `button` | `button` | `createButton` | `drawButton` | `pressed` | `digitalRead`, active-low |
| `joystick` | `joystick` | `createJoystick` | `drawJoystick` | `vx`, `vy`, `sw` | `analogRead`, `digitalRead`, active-low switch |
| `ky004` | `ky004` | `createKY004` | `drawKY004` | `pressed` | `digitalRead`, active-low |
| `sw420` | `sw420` | `createSW420` | `drawSW420` | `triggered` | `digitalRead`, high when triggered |
| `flame` | `flame` | `createFlame` | `drawFlame` | `detected`, `analog` | `digitalRead`, `analogRead` |
| `ky032` | `ky032` | `createKY032` | `drawKY032` | `detected` | `digitalRead`, active-low |
| `servo` | `servo` | `createServo` | `drawServo` | `angle` | Servo library, PWM |
| `buzzer` | `buzzer` | `createBuzzer` | `drawBuzzer` | `playing`, `frequency` | `digitalWrite`, `tone`, PWM |
| `ssd1306` | `ssd1306` | `createSSD1306` | `drawSSD1306` | `display` buffer | OLED libraries / MicroPython SSD1306 |

---

## 6. Required Pins And Signal Rules

`simulator.js` has a `REQUIRED_PINS` table. If a component is missing any listed pin, it is considered not fully wired.

Current required pins:

| Type | Required Pins |
|---|---|
| `led` | `+`, `-` |
| `ultrasonic` | `VCC`, `Trig`, `Echo`, `GND` |
| `dht` | `VCC`, `Data`, `GND` |
| `pir` | `VCC`, `OUT`, `GND` |
| `ldr` | `S`, `VCC`, `GND` |
| `button` | `P1`, `P2` |
| `joystick` | `VCC`, `GND`, `VRX`, `VRY`, `SW` |
| `ky004` | `S`, `VCC`, `GND` |
| `sw420` | `DO`, `GND`, `VCC` |
| `flame` | `AO`, `DO`, `GND`, `VCC` |
| `ky032` | `OUT`, `VCC`, `GND` |
| `servo` | `PWM`, `VCC`, `GND` |
| `buzzer` | `+`, `-` |
| `ssd1306` | `GND`, `VCC`, `SCL`, `SDA` |

Important KY-032 note:

The KY-032 component has an `EN` pin in `components.js`, and the help modal says `EN` is required. But the actual simulator `REQUIRED_PINS` table currently requires only `OUT`, `VCC`, and `GND` for `ky032`. If debugging, trust `simulator.js` first because that is the runtime source of truth.

`SIGNAL_PINS` tells the simulator which component pin is the main readable/control signal:

| Type | Signal Pin |
|---|---|
| `led` | `+` |
| `ultrasonic` | `Echo` |
| `dht` | `Data` |
| `pir` | `OUT` |
| `ldr` | `S` |
| `button` | `P1` |
| `joystick` | `VRX` |
| `ky004` | `S` |
| `sw420` | `DO` |
| `flame` | `DO` |
| `ky032` | `OUT` |
| `servo` | `PWM` |
| `buzzer` | `+` |

---

## 7. How A Blink Example Works

Suppose the user:

1. Adds an ESP32.
2. Adds a red LED.
3. Wires LED `+` to ESP32 `D2`.
4. Wires LED `-` to `GND`.
5. Runs this code:

```cpp
#define LED_PIN 2

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(500);
  digitalWrite(LED_PIN, LOW);
  delay(500);
}
```

Flow through the project:

```text
Palette click
-> index.html calls addComponent("led_red")
-> components.js creates a component with type "led"
-> drawing.js drawLED() paints it
-> interaction.js creates wires between pins
-> simulator.js runCode() reads the code
-> tick() reaches digitalWrite(2, HIGH)
-> writeDigitalPinValue(2, true)
-> updateLEDsOnPin("D2", true)
-> LED component state changes: comp.state.on = true
-> drawLED() sees state.on and paints the LED as ON
```

That is the whole project in one chain.

The key idea:

The code does not directly draw the LED. The code changes `comp.state.on`. Then `drawing.js` redraws based on that state.

---

## 8. How A Sensor Read Works

Example: button.

The button component starts with:

```js
state: { pressed: false }
```

When the user clicks and holds the button:

```text
interaction.js
-> handleCanvasMouseDown()
-> finds button under pointer
-> sets c.state.pressed = true
-> draw()
```

When user code calls:

```cpp
int value = digitalRead(4);
```

The simulator does:

```text
simulator.js
-> executeLineWithDelay()
-> readDigitalPinValue(4)
-> find button whose P1 pin is wired to D4/GP4
-> return 0 if pressed, 1 if released
-> store that value in variables.value
```

The button is active-low in this simulator, so pressed means `LOW` / `0`.

---

## 9. Supported Arduino-Style Code

The simulator supports common simple Arduino patterns. It does not compile all C++.

Supported examples:

```cpp
#define LED_PIN 2
pinMode(LED_PIN, OUTPUT);
digitalWrite(LED_PIN, HIGH);
int v = digitalRead(4);
int light = analogRead(34);
unsigned long duration = pulseIn(5, HIGH);
analogWrite(9, 120);
ledcWrite(9, 120);
tone(6, 1000);
noTone(6);
delay(500);
delayMicroseconds(10);
Serial.begin(115200);
Serial.print("Value: ");
Serial.println(light);
int incoming = Serial.read();
if (digitalRead(4) == LOW) {
  digitalWrite(2, HIGH);
}
```

Supported math helpers:

```cpp
map(value, fromLow, fromHigh, toLow, toHigh)
constrain(value, minValue, maxValue)
```

Supported library-style code:

```cpp
#include <DHT.h>
#include <Servo.h>
#include <ESP32Servo.h>
#include <Wire.h>
#include <Adafruit_SSD1306.h>
#include <SSD1306.h>
```

Common limitations:

- It is not a real C++ compiler.
- Complex classes, arrays, pointers, templates, and many library APIs are not supported.
- Unsupported lines may do nothing instead of showing a clear error.
- The parser is line-oriented, so formatting can matter.
- Keep examples simple when testing.

Good debugging trick:

If Arduino code does nothing, simplify the sketch until one line works. For example, test only `digitalWrite(2, HIGH)` before adding conditions, sensors, and libraries.

---

## 10. Supported MicroPython-Style Code

MicroPython mode works by translating supported Python into simulator-friendly pseudo-Arduino code using `convertPyToSim(code)`.

Supported examples:

```python
from machine import Pin, ADC, PWM, I2C
import time

led = Pin(2, Pin.OUT)
button = Pin(4, Pin.IN, Pin.PULL_UP)

while True:
    led.on()
    time.sleep(0.5)
    led.off()
    time.sleep_ms(500)
    print(button.value())
```

Supported patterns include:

- `Pin(...)`
- `ADC(...)`
- `PWM(...)`
- `I2C(...)`
- `ssd1306.SSD1306_I2C(...)`
- `dht.DHT11(...)`, `dht.DHT21(...)`, `dht.DHT22(...)`
- `pin.on()`, `pin.off()`, `pin.high()`, `pin.low()`
- `pin.value()`, `pin.value(x)`
- `adc.read_u16()`
- `pwm.freq(x)`
- `pwm.duty_u16(x)`
- `pwm.deinit()`
- `time.sleep(x)`
- `time.sleep_ms(x)`
- `time.sleep_us(x)`
- `print(...)`
- simple `if`, `elif`, `else`
- `while True`
- simple no-argument helper functions

Common limitations:

- It is not a full Python interpreter.
- Imports are ignored after being recognized.
- Only `while True` is treated as the repeating loop.
- Complex functions, function arguments, classes, list comprehensions, exceptions, and many modules are not supported.
- Unsupported Python may translate into code that does nothing.

Debugging trick:

In the browser console, if available, you can call:

```js
convertPyToSim(getCode())
```

This shows what MicroPython became before the simulator runs it.

---

## 11. Debugging Playbook

Use this when something breaks.

### Problem: Component does not appear after clicking palette item

Check:

1. `index.html`: palette item calls the exact type string, for example `addComponent('my_sensor')`.
2. `components.js`: `addComponent(type)` has a matching branch.
3. `components.js`: the factory returns a component object, not `null`.
4. `drawing.js`: `draw()` has a matching `else if` branch.
5. Browser console: check for JavaScript errors.

Likely cause:

The type string does not match across files.

Example:

```text
index.html uses "mySensor"
components.js checks "my_sensor"
drawing.js checks "mysensor"
```

Those are three different strings. They must match.

### Problem: Component appears but cannot be wired

Check:

1. Does the factory add pins to `c.pins`?
2. Does each pin have a `name`, `x`, and `y`?
3. Does the draw function update pin positions every draw?
4. Does `findPin(mx, my)` have a reasonable hit area?

Likely cause:

The pin exists but its `x`/`y` is wrong or never updated in `drawing.js`.

### Problem: Wires do not follow a moved component

Check:

1. `interaction.js` movement code updates `comp.x` and `comp.y`.
2. It also updates every `pin.x` and `pin.y`.
3. It calls `syncAllWireEndpoints()`.
4. The draw function is not overwriting pins with stale coordinates.

Likely cause:

Pin positions and wire positions are out of sync.

### Problem: Red "NOT WIRED" warning appears

Check:

1. `simulator.js` `REQUIRED_PINS`.
2. The component factory's pin names.
3. The actual wires in the UI.

Likely cause:

The required pin name and the real pin name do not match.

Example:

```js
REQUIRED_PINS.my_sensor = ["SIG", "VCC", "GND"]
```

but the factory creates:

```js
{ name: "S" }
```

Then the simulator will never count `SIG` as connected.

### Problem: Code runs but output does not change

Check:

1. Is there exactly one microcontroller on the canvas?
2. Is the correct board used?
   - Arduino mode needs ESP32.
   - MicroPython mode needs Pico.
3. Is the code using a supported command?
4. Is the output pin wired to the component's signal pin?
5. Is the component fully wired according to `REQUIRED_PINS`?

Likely cause:

The simulator can run the code line but cannot find a matching wired component.

### Problem: `digitalRead()` gives the opposite value

Some sensors are active-low.

Current digital read behavior:

| Component | State | Return Value |
|---|---|---|
| Button | pressed | `0` |
| Button | released | `1` |
| KY-004 | pressed | `0` |
| KY-004 | released | `1` |
| Joystick SW | pressed | `0` |
| Joystick SW | released | `1` |
| PIR | motion | `1` |
| PIR | clear | `0` |
| SW-420 | triggered | `1` |
| SW-420 | stable | `0` |
| Flame DO | detected | `0` |
| Flame DO | clear | `1` |
| KY-032 OUT | obstacle detected | `0` |
| KY-032 OUT | clear | `1` |

This is not random. It matches the logic in `readDigitalPinValue()`.

### Problem: `analogRead()` gives unexpected values

Only these analog sources are handled:

| Component | Pin | State Field |
|---|---|---|
| LDR | `S` | `state.light` |
| Flame | `AO` | `state.analog` |
| Joystick | `VRX` | `state.vx` |
| Joystick | `VRY` | `state.vy` |

For Arduino mode, analog values are returned from `0` to `4095`.

For MicroPython ADC `read_u16()`, values are scaled to `0` to `65535`.

### Problem: OLED stays blank

Check:

1. OLED component exists.
2. Required pins are wired: `GND`, `VCC`, `SCL`, `SDA`.
3. If code uses `Wire.begin(sda, scl)`, the real wires match those pins.
4. Code calls `display.display()` or `oled.show()` after drawing text.
5. The OLED library constructor is supported.

Likely cause:

The display buffer was changed but never pushed to the component, or the I2C pins do not match.

### Problem: Servo does not move

Check:

1. Servo `PWM`, `VCC`, `GND` are wired.
2. `attach(pin)` uses the same pin connected to `PWM`.
3. `write(angle)` is called after attach.
4. Angle is between `0` and `180`.

Likely cause:

The library cannot find a wired servo on the requested pin.

### Problem: MicroPython sketch does nothing

Check:

1. Pico is placed, not ESP32.
2. Editor is in MicroPython mode.
3. Code has `while True:` for repeated behavior.
4. Code uses supported patterns.
5. Try `convertPyToSim(getCode())` in console to inspect the generated code.

Likely cause:

The translator did not recognize one or more Python statements.

### Problem: Browser page looks broken

Check:

1. Browser console errors.
2. CodeMirror CDN loaded.
3. `style.css` path is correct.
4. Script files loaded in the correct folder.

Note:

Because CodeMirror is loaded from a CDN, the editor may not initialize properly without internet. The fallback textarea still exists, but the experience may look different.

---

## 12. How To Defend Your Debugging

When someone asks, "How did you debug this?", use this format:

```text
1. Expected behavior:
   I expected the LED to turn on when digitalWrite(pin, HIGH) ran.

2. Actual behavior:
   The code ran, but the LED stayed off.

3. Where I looked:
   I traced the behavior from simulator.js writeDigitalPinValue()
   to updateLEDsOnPin(), then checked the wires and REQUIRED_PINS.

4. Root cause:
   The simulator could not find an LED whose + pin was wired to the same MCU pin.

5. Fix:
   I corrected the wiring/type/pin name so the signal pin matched.

6. Test:
   I ran the simple blink sketch again and confirmed the LED state changed.
```

This is strong because it shows evidence, not guessing.

Use the same pattern for any bug:

```text
Expected -> Actual -> Trace -> Root cause -> Fix -> Test
```

Good phrases for presentation:

- "I checked the source of truth first."
- "For wiring errors, the source of truth is `REQUIRED_PINS` in `simulator.js`."
- "For visual errors, the source of truth is the draw function in `drawing.js`."
- "For click errors, I checked hit testing in `interaction.js`."
- "For code execution errors, I checked `executeLineWithDelay()` because that is where supported commands are recognized."
- "The app uses component state as the bridge between user code and the canvas."

---

## 13. How To Add A New Component

Use this order. Do not start in the simulator first. Start with data and visuals.

### Step 1: Choose the component type

Pick one stable lowercase string:

```text
touch_sensor
relay
gas_sensor
```

Use the exact same string everywhere.

### Step 2: Add palette item in `index.html`

Example:

```html
<div class="comp-item" data-cat="sensors" onclick="addComponent('touch_sensor')" style="display:none">
  <span class="comp-icon">T</span><span class="comp-name">Touch Sensor</span>
</div>
```

### Step 3: Add branch in `components.js`

Inside `addComponent(type)`:

```js
else if (type === 'touch_sensor') comp = createTouchSensor(cx, cy);
```

### Step 4: Add factory in `components.js`

Example digital sensor:

```js
function createTouchSensor(x, y) {
  var c = {
    id: mkId(),
    type: 'touch_sensor',
    x: x,
    y: y,
    width: 48,
    height: 48,
    pins: [],
    state: { touched: false }
  };

  c.pins.push({ name: 'S',   x: x - 18, y: y + 26, side: 'bottom', type: 'gpio',  color: '#3ddc84' });
  c.pins.push({ name: 'VCC', x: x,      y: y + 26, side: 'bottom', type: 'power', color: '#ff5566' });
  c.pins.push({ name: 'GND', x: x + 18, y: y + 26, side: 'bottom', type: 'gnd',   color: '#8b7355' });

  return c;
}
```

### Step 5: Add draw dispatcher in `drawing.js`

Inside `draw()`:

```js
else if (c.type === 'touch_sensor') drawTouchSensor(c);
```

### Step 6: Add draw function in `drawing.js`

Minimum example:

```js
function drawTouchSensor(c) {
  var x = c.x;
  var y = c.y;
  var touched = !!c.state.touched;

  ctx.fillStyle = touched ? '#2a6a4a' : '#1a2a3a';
  ctx.fillRect(x - 24, y - 24, 48, 48);
  ctx.strokeStyle = touched ? '#3ddc84' : '#2a4a6a';
  ctx.strokeRect(x - 24, y - 24, 48, 48);

  ctx.fillStyle = '#e8eaf6';
  ctx.font = 'bold 7px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TOUCH', x, y + 3);

  c.pins.forEach(function(p) {
    if (p.name === 'S') {
      p.x = x - 18;
    } else if (p.name === 'VCC') {
      p.x = x;
    } else if (p.name === 'GND') {
      p.x = x + 18;
    }
    p.y = y + 26;

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8890a8';
    ctx.font = 'bold 6px JetBrains Mono, monospace';
    ctx.fillText(p.name, p.x, p.y + 11);
  });
}
```

### Step 7: Add click behavior in `interaction.js`

Inside the part of `handleCanvasMouseDown(e)` that checks component types:

```js
if (c.type === 'touch_sensor') {
  var dx = x - c.x;
  var dy = y - c.y;
  if (dx * dx + dy * dy < 400) {
    saveState();
    c.state.touched = !c.state.touched;
    updateStatus('Touch: ' + (c.state.touched ? 'Touched' : 'Clear'));
    draw();
    return;
  }
}
```

### Step 8: Add simulator wiring rules in `simulator.js`

Add to `REQUIRED_PINS`:

```js
touch_sensor: ['S', 'VCC', 'GND'],
```

Add to `SIGNAL_PINS`:

```js
touch_sensor: 'S',
```

### Step 9: Add `digitalRead()` support in `simulator.js`

Inside `readDigitalPinValue(pin)`:

```js
if (comp.type === 'touch_sensor') {
  var tm = candidates.some(function(pn) {
    return componentConnectedToMcuPin(comp, 'S', pn);
  });
  if (tm) return comp.state.touched ? 1 : 0;
}
```

### Step 10: Test in the smallest possible way

Use a tiny Arduino sketch:

```cpp
#define TOUCH_PIN 4
#define LED_PIN 2

void setup() {
  pinMode(TOUCH_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int touched = digitalRead(TOUCH_PIN);
  digitalWrite(LED_PIN, touched ? HIGH : LOW);
  delay(100);
}
```

Test checklist:

- Component appears in palette.
- Component appears on canvas.
- Pins show up.
- Wires connect.
- Not-wired warning disappears after all required pins are connected.
- Clicking the component changes its visual state.
- `digitalRead()` returns the expected value.
- A simple LED response works.

---

## 14. How To Add A Library-Based Component

Only do this if normal `digitalRead`, `analogRead`, `digitalWrite`, or PWM is not enough.

A library-based component needs:

1. A normal component object in `components.js`.
2. A draw function in `drawing.js`.
3. Wiring rules in `simulator.js`.
4. A new file in `libraries/`.
5. A `<script>` tag in `index.html`.
6. A `libraryRegistry.registerLibrary(...)` call.

Minimal pattern:

```js
class MySensorLibrary {
  constructor(pin) {
    this._pin = Number(pin);
  }

  _resolveComp() {
    if (typeof globalThis.findConnectedComponent === 'function') {
      return globalThis.findConnectedComponent('my_sensor', 'S', this._pin);
    }
    return null;
  }

  begin() {
    return !!this._resolveComp();
  }

  read() {
    var comp = this._resolveComp();
    return comp ? comp.state.value : 0;
  }
}

if (typeof libraryRegistry !== 'undefined') {
  libraryRegistry.registerLibrary('MySensor', MySensorLibrary, {
    headerFile: 'MySensor.h',
    constructorRegex: /MySensor\s+(\w+)\s*\((.*)\)\s*;?$/
  });
}
```

Then user code could look like:

```cpp
#include <MySensor.h>

MySensor sensor(4);

void setup() {
  sensor.begin();
}

void loop() {
  int value = sensor.read();
}
```

---

## 15. Best Components To Copy

Copy an existing component that behaves like what you want.

| Goal | Best Component To Copy | Why |
|---|---|---|
| Simple on/off output | LED or buzzer | Small state and simple simulator logic |
| Simple click sensor | KY-004 or SW-420 | Easy click-to-toggle behavior |
| Press-and-hold input | Button | Shows held state and release behavior |
| Analog slider sensor | LDR or flame | Shows slider cache and `analogRead` |
| Distance sensor | Ultrasonic | Shows slider plus `pulseIn` |
| Temperature/humidity | DHT | Shows library plus two state values |
| PWM output | Servo | Shows slider, PWM, and library support |
| Display output | SSD1306 | Shows component state as a pixel buffer |

Avoid copying `relay` or `rgb_led` from `interaction.js` until you understand that those are incomplete in the current project.

---

## 16. Safe Editing Rules

When you change the project later, use this checklist:

1. Change one behavior at a time.
2. Search the whole project for the exact component type string.
3. Keep pin names identical across:
   - factory pins,
   - `REQUIRED_PINS`,
   - `SIGNAL_PINS`,
   - read/write logic,
   - help text.
4. After moving pins visually, always make sure wires still follow.
5. Test with the smallest sketch first.
6. Use the browser console for JavaScript errors.
7. Use `Serial.println()` to prove code is running.
8. Keep unsupported Arduino/Python code simple.

Good search commands:

```text
Search component type:
touch_sensor

Search factory:
createTouchSensor

Search draw function:
drawTouchSensor

Search simulator read/write:
readDigitalPinValue
readAnalogPinValue
writeDigitalPinValue
writePWMValue
```

---

## 17. What To Say If Asked How The Simulator Works

Use this explanation:

SensorHub does not run real Arduino firmware. It uses JavaScript to simulate the most common Arduino and MicroPython commands. When the user presses Run, `simulator.js` reads the code, extracts `setup()` and `loop()`, and executes recognized lines on a timer. A command like `digitalWrite(2, HIGH)` is translated into a state change on any LED or buzzer wired to pin `D2`. The canvas does not know about the code directly; it only redraws the current component state.

Short version:

```text
User code -> simulator.js -> component.state -> drawing.js -> canvas
```

For inputs, the direction is reversed:

```text
User click/slider -> interaction.js -> component.state -> simulator.js digitalRead/analogRead -> user variables
```

That is the cleanest mental model for the whole app.

---

## 18. Current Known Oddities

These are not necessarily bugs you must fix right now, but they are useful to know.

1. `interaction.js` contains old blocks for `relay` and `rgb_led`, but those components are not fully implemented in the current app.
2. The KY-032 `EN` pin exists visually, and help text says it is required, but `simulator.js` currently does not require `EN`.
3. The simulator silently accepts many unsupported code lines. This is normal for this custom parser.
4. `Servo.js` uses console logging for attach/write, which can help debugging but may be noisy.
5. CodeMirror loads from a CDN. If offline, editor behavior may differ.
6. Some terminal output may show broken icon characters, but the browser may still render them correctly if the files are UTF-8.

---

## 19. Final Cheat Sheet

If you remember only this, remember:

```text
Data lives in components.js.
Pictures live in drawing.js.
Clicks live in interaction.js.
Code execution lives in simulator.js.
Library APIs live in libraries/*.js.
UI shell lives in index.html.
Styling lives in style.css.
```

When debugging:

```text
Component missing       -> index.html + components.js + drawing.js
Cannot wire             -> component pins + drawing pin positions
Wire follows badly      -> pin positions + syncWireEndpoints
Not wired warning       -> REQUIRED_PINS vs real pin names
Code does nothing       -> simulator supported syntax + board/language pair
Wrong digital value     -> readDigitalPinValue active-high/active-low logic
Wrong analog value      -> readAnalogPinValue source component
Library call fails      -> LibraryRegistry.js + libraries/*.js
Visual problem          -> drawing.js or style.css
```

When presenting:

```text
Expected -> Actual -> Trace -> Root cause -> Fix -> Test
```

That format will help you defend your debugging clearly.
