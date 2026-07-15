// ==========================================
// ESP32/Pico SIMULATOR - simulator.js
// ==========================================

let running = false;
let executionInterval = null;
let variables = {};
let pinModes = {};
let pinValues = {};
let loopLines = [];
let setupLines = [];
let defines = {};
let currentLineIndex = 0;
let currentSetupLineIndex = 0;
let inSetupPhase = false;
let isDelayActive = false;
let delayAdvance = 1;
let delayPhase = 'loop';
let serialLineBuffer = '';
let serialRxBuffer = [];
let runtimeMode = 'ino';
let microPythonRuntime = null;

const REQUIRED_PINS = {
  led:        ['+', '-'],
  ultrasonic: ['VCC', 'Trig', 'Echo', 'GND'],
  dht:        ['VCC', 'Data', 'GND'],
  pir:        ['VCC', 'OUT', 'GND'],
  ldr:        ['S', 'VCC', 'GND'],
  button:     ['P1', 'P2'],
  joystick:   ['VCC', 'GND', 'VRX', 'VRY', 'SW'],
  ky004:      ['S', 'VCC', 'GND'],
  sw420:      ['DO', 'GND', 'VCC'],
  flame:      ['AO', 'DO', 'GND', 'VCC'],
  ky032:      ['OUT', 'VCC', 'GND'],
  servo:      ['PWM', 'VCC', 'GND'],
  buzzer:     ['+', '-'],
  ssd1306:    ['GND', 'VCC', 'SCL', 'SDA']
};

const SIGNAL_PINS = {
  led:        '+',
  ultrasonic: 'Echo',
  dht:        'Data',
  pir:        'OUT',
  ldr:        'S',
  button:     'P1',
  joystick:   'VRX',
  ky004:      'S',
  sw420:      'DO',
  flame:      'DO',
  ky032:      'OUT',
  servo:      'PWM',
  buzzer:     '+'
};

// ==========================================
// MCU DETECTION
// ==========================================

function getPlacedMCUs() {
  return components.filter(function(c) {
    return c.type === 'esp32' || c.type === 'pico';
  });
}

function getActiveMCUComponent() {
  var mcus = getPlacedMCUs();
  return mcus.length === 1 ? mcus[0] : null;
}

function getActiveMCU() {
  var mcu = getActiveMCUComponent();
  return mcu ? mcu.type : null;
}

function getMCUPinCandidates(pinNumber) {
  var pinNum = String(pinNumber).replace(/^(GP|D)/i, '');
  var mcu = getActiveMCU();

  if (mcu === 'pico') return ['GP' + pinNum];
  if (mcu === 'esp32') return ['D' + pinNum];

  return ['D' + pinNum, 'GP' + pinNum];
}

function mcuPinName(pinNumber) {
  return getActiveMCU() === 'pico'
    ? 'GP' + pinNumber
    : 'D' + pinNumber;
}

// ==========================================
// PIN HELPERS
// ==========================================

function pinIdEndsWith(pinId, pinName) {
  return typeof pinId === 'string' && pinId.endsWith('_' + pinName);
}

function getComponentIdFromPinId(pinId) {
  if (typeof pinId !== 'string') return '';
  const idx = pinId.lastIndexOf('_');
  return idx === -1 ? '' : pinId.substring(0, idx);
}

function getComponentById(id) {
  for (let i = 0; i < components.length; i++) {
    if (components[i].id === id) return components[i];
  }
  return null;
}

function componentConnectedToMcuPin(comp, componentPinName, mcuPinNameValue) {
  const compPinId = comp.id + '_' + componentPinName;
  return wires.some(function(w) {
    return (
      (w.pin1Id === compPinId && pinIdEndsWith(w.pin2Id, mcuPinNameValue)) ||
      (w.pin2Id === compPinId && pinIdEndsWith(w.pin1Id, mcuPinNameValue))
    );
  });
}

function isComponentWired(comp) {
  const required = REQUIRED_PINS[comp.type];
  if (!required) return true;

  for (let i = 0; i < required.length; i++) {
    const pinId = comp.id + '_' + required[i];
    const connected = wires.some(function(w) {
      return w.pin1Id === pinId || w.pin2Id === pinId;
    });
    if (!connected) return false;
  }
  return true;
}

function isPinConnected(comp, pinName) {
  const pinId = comp.id + '_' + pinName;
  return wires.some(function(w) {
    return w.pin1Id === pinId || w.pin2Id === pinId;
  });
}

function getMissingPins(comp) {
  const required = REQUIRED_PINS[comp.type] || [];
  return required.filter(function(pinName) {
    return !isPinConnected(comp, pinName);
  });
}

// ==========================================
// FIND CONNECTED COMPONENT
// ==========================================

function findConnectedComponent(componentType, componentPinName, mcuPinNumber) {
  var candidates = getMCUPinCandidates(mcuPinNumber);

  for (var i = 0; i < components.length; i++) {
    var comp = components[i];
    if (comp.type !== componentType) continue;
    if (!isComponentWired(comp)) continue;

    var matched = candidates.some(function(pinName) {
      return componentConnectedToMcuPin(comp, componentPinName, pinName);
    });

    if (matched) return comp;
  }

  return null;
}

window.findConnectedComponent = findConnectedComponent;

function findSensorOnPin(sensorType, pinNumber) {
  const signalPin = SIGNAL_PINS[sensorType];
  if (signalPin) {
    return findConnectedComponent(sensorType, signalPin, pinNumber);
  }

  var candidates = getMCUPinCandidates(pinNumber);

  for (let i = 0; i < components.length; i++) {
    const comp = components[i];
    if (comp.type !== sensorType) continue;

    for (let j = 0; j < wires.length; j++) {
      const w = wires[j];

      var hasPin = candidates.some(function(pn) {
        return pinIdEndsWith(w.pin1Id, pn) || pinIdEndsWith(w.pin2Id, pn);
      });

      const hasSensor =
        getComponentIdFromPinId(w.pin1Id) === comp.id ||
        getComponentIdFromPinId(w.pin2Id) === comp.id;

      if (hasPin && hasSensor) {
        if (!isComponentWired(comp)) {
          const missing = getMissingPins(comp);
          if (typeof showConnAlert === 'function') {
            showConnAlert(sensorType.toUpperCase() + ' sensor missing wires: ' + missing.join(', '));
          }
          return null;
        }
        return comp;
      }
    }
  }

  return null;
}

// ==========================================
// PIN RESOLUTION
// ==========================================

function resolvePin(arg) {
  arg = String(arg || '').trim();

  if (variables[arg] !== undefined) {
    const n = parseInt(variables[arg], 10);
    return isNaN(n) ? null : n;
  }

  if (/^D\d+$/i.test(arg)) return parseInt(arg.slice(1), 10);
  if (/^GP\d+$/i.test(arg)) return parseInt(arg.slice(2), 10);

  const n = parseInt(arg, 10);
  return isNaN(n) ? null : n;
}

function parseValue(str) {
  str = String(str || '').trim().replace(/;$/, '');

  if (variables[str] !== undefined) return variables[str];
  if (str === 'true') return true;
  if (str === 'false') return false;
  if (/^0x[0-9a-f]+$/i.test(str)) return parseInt(str, 16);

  const n = parseFloat(str);
  if (!isNaN(n)) return n;

  if (
    (str.startsWith('"') && str.endsWith('"')) ||
    (str.startsWith("'") && str.endsWith("'"))
  ) {
    return str.slice(1, -1);
  }

  return str;
}

function parseContent(content) {
  content = resolveSimulatorRuntimeCalls(String(content || '').trim());
  content = content.replace(/^F\((.+)\)$/, '$1');

  content = content.replace(/String\(([^)]+)\)/g, function(_, inner) {
    const v = inner.trim();
    if (variables[v] !== undefined) return String(variables[v]);
    const n = parseFloat(v);
    return isNaN(n) ? v.replace(/"/g, '') : String(n);
  });

  if (
    /^"(?:[^"\\]|\\.)*"$/.test(content) ||
    /^'(?:[^'\\]|\\.)*'$/.test(content)
  ) {
    return content.slice(1, -1);
  }

  if (variables[content] !== undefined) {
    return String(variables[content]);
  }

  if (!isNaN(parseFloat(content))) {
    return String(parseFloat(content));
  }

  return content.split('+').map(function(p) {
    p = p.trim();

    if (
      (p.startsWith('"') && p.endsWith('"')) ||
      (p.startsWith("'") && p.endsWith("'"))
    ) {
      return p.slice(1, -1);
    }

    if (variables[p] !== undefined) return String(variables[p]);
    if (!isNaN(parseFloat(p))) return String(parseFloat(p));

    return p;
  }).join('');
}

function evaluateLiteral(str) {
  str = String(str || '').trim().replace(/;$/, '');
  str = str.replace(/^F\((.+)\)$/, '$1');

  if (variables[str] !== undefined) return variables[str];
  if (str === 'true') return true;
  if (str === 'false') return false;
  if (/^0x[0-9a-f]+$/i.test(str)) return parseInt(str, 16);

  const n = parseFloat(str);
  return isNaN(n) ? str : n;
}

// ==========================================
// LED PIN CHECK
// ==========================================

function isNonLEDPin(pinName) {
  var candidates = getMCUPinCandidates(pinName);

  for (let i = 0; i < wires.length; i++) {
    const w = wires[i];
    let otherId = null;

    var hit = candidates.some(function(pn) {
      if (pinIdEndsWith(w.pin1Id, pn)) { otherId = w.pin2Id; return true; }
      if (pinIdEndsWith(w.pin2Id, pn)) { otherId = w.pin1Id; return true; }
      return false;
    });

    if (!hit || !otherId) continue;

    const comp = getComponentById(getComponentIdFromPinId(otherId));
    if (comp && comp.type !== 'led') return true;
  }

  return false;
}

// ==========================================
// UPDATE LEDs
// ==========================================

function updateLEDsOnPin(pinName, state) {
  let updated = false;
  var candidates = getMCUPinCandidates(pinName);

  for (let i = 0; i < components.length; i++) {
    const comp = components[i];
    if (comp.type !== 'led') continue;

    var matched = candidates.some(function(pn) {
      return componentConnectedToMcuPin(comp, '+', pn);
    });

    if (!matched) continue;

    if (!isComponentWired(comp)) {
      const missing = getMissingPins(comp);
      if (typeof showConnAlert === 'function') {
        showConnAlert('LED not fully wired! Missing: ' + missing.join(', '));
      }
      continue;
    }

    comp.state.on = !!state;
    updated = true;
  }

  return updated;
}

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resetMicroPythonRuntime() {
  microPythonRuntime = {
    pins: {},
    adc: {},
    pwm: {},
    i2c: {},
    displays: {},
    dht: {}
  };
}

function getMicroPythonRuntime() {
  if (!microPythonRuntime) resetMicroPythonRuntime();
  return microPythonRuntime;
}

function unquoteToken(token) {
  token = String(token || '').trim();
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    return token.slice(1, -1);
  }
  return token;
}

function parseBooleanLike(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  var raw = String(value || '').trim();
  if (variables[raw] !== undefined) return !!variables[raw];
  if (raw === 'HIGH' || raw === 'true' || raw === '1') return true;
  if (raw === 'LOW' || raw === 'false' || raw === '0') return false;

  return !!parseValue(raw);
}

function evaluateBooleanLikeExpression(expr) {
  var normalized = normalizeEvaluatorExpression(expr);
  var numeric = evaluateMath(normalized);

  if (numeric !== null) return numeric !== 0;
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;

  try {
    if (/^[\d\s<>=!&|.()+\-*/%]+$/.test(normalized)) {
      return !!Function('"use strict"; return (' + normalized + ')')();
    }
  } catch (err) {}

  return parseBooleanLike(parseValue(normalized));
}

function setPinModeValue(pin, mode) {
  if (pin === null) return;
  pinModes[mcuPinName(pin)] = mode;
}

function applyBuzzerState(pin, playing, frequency) {
  var candidates = getMCUPinCandidates(pin);

  for (var i = 0; i < components.length; i++) {
    var comp = components[i];
    if (comp.type !== 'buzzer') continue;

    var matched = candidates.some(function(pn) {
      return componentConnectedToMcuPin(comp, '+', pn);
    });

    if (!matched || !isComponentWired(comp)) continue;
    comp.state.playing = !!playing;
    if (frequency !== undefined) comp.state.frequency = frequency;
  }
}

function writeDigitalPinValue(pin, value) {
  if (pin === null) return;

  var pinName = mcuPinName(pin);
  var boolValue = !!value;
  pinValues[pinName] = boolValue;
  updateLEDsOnPin(pinName, boolValue);
  applyBuzzerState(pin, boolValue);
}

function getDefaultDigitalValue(pinName) {
  return pinModes[pinName] === 'INPUT_PULLUP' ? 1 : 0;
}

function readDigitalPinValue(pin) {
  if (pin === null) return 0;

  var pinName = mcuPinName(pin);
  var candidates = getMCUPinCandidates(pin);

  for (var i = 0; i < components.length; i++) {
    var comp = components[i];
    if (!isComponentWired(comp)) continue;

    if (comp.type === 'button') {
      var bm = candidates.some(function(pn) {
        return componentConnectedToMcuPin(comp, 'P1', pn);
      });
      if (bm) return comp.state.pressed ? 0 : 1;
    }

    if (comp.type === 'pir') {
      var pm = candidates.some(function(pn) {
        return componentConnectedToMcuPin(comp, 'OUT', pn);
      });
      if (pm) return comp.state.motion ? 1 : 0;
    }

    if (comp.type === 'ky004') {
      var km = candidates.some(function(pn) {
        return componentConnectedToMcuPin(comp, 'S', pn);
      });
      if (km) return comp.state.pressed ? 0 : 1;
    }
    if (comp.type === 'sw420') {
      var vm = candidates.some(function(pn) {
        return componentConnectedToMcuPin(comp, 'DO', pn);
      });
      if (vm) return comp.state.triggered ? 1 : 0;
    }
    if (comp.type === 'flame') {
      var fm = candidates.some(function(pn) {
        return componentConnectedToMcuPin(comp, 'DO', pn);
      });
      if (fm) return comp.state.detected ? 0 : 1;
    }
     if (comp.type === 'ky032') {
      var om = candidates.some(function(pn) {
        return componentConnectedToMcuPin(comp, 'OUT', pn);
      });
      if (om) return comp.state.detected ? 0 : 1;
    }
    if (comp.type === 'joystick') {
      var swm = candidates.some(function(pn) {
        return componentConnectedToMcuPin(comp, 'SW', pn);
      });
      if (swm) return comp.state.sw ? 0 : 1;
    }
  }

  if (pinValues[pinName] !== undefined) return pinValues[pinName] ? 1 : 0;
  return getDefaultDigitalValue(pinName);
}

function scaleAnalogValue(rawValue, targetMax) {
  var clamped = clampValue(parseFloat(rawValue) || 0, 0, 4095);
  return Math.round(clamped / 4095 * targetMax);
}

function readAnalogPinValue(pin, targetMax) {
  if (pin === null) return 0;

  var candidates = getMCUPinCandidates(pin);
  var rawValue = null;

  for (var i = 0; i < components.length; i++) {
    var comp = components[i];
    if (!isComponentWired(comp)) continue;

    if (comp.type === 'ldr') {
      var lm = candidates.some(function(pn) {
        return componentConnectedToMcuPin(comp, 'S', pn);
      });
      if (lm) {
        rawValue = comp.state.light;
        break;
      }
    }
    if (comp.type === 'flame') {
      var flm = candidates.some(function(pn) {
        return componentConnectedToMcuPin(comp, 'AO', pn);
      });
      if (flm) { rawValue = comp.state.analog; break; }
    }

    if (comp.type === 'joystick') {
      var vrxMatch = candidates.some(function(pn) {
        return componentConnectedToMcuPin(comp, 'VRX', pn);
      });
      if (vrxMatch) {
        rawValue = comp.state.vx;
        break;
      }

      var vryMatch = candidates.some(function(pn) {
        return componentConnectedToMcuPin(comp, 'VRY', pn);
      });
      if (vryMatch) {
        rawValue = comp.state.vy;
        break;
      }
    }
  }

  if (rawValue === null) rawValue = pinValues[mcuPinName(pin)] ? 4095 : 0;
  return targetMax === 65535 ? scaleAnalogValue(rawValue, 65535) : clampValue(rawValue, 0, 4095);
}

function getUltrasonicPulseDuration(pin, expectedValue) {
  if (pin === null) return 0;
  if (parseInt(expectedValue, 10) !== 1) return 0;

  var comp = findConnectedComponent('ultrasonic', 'Echo', pin);
  if (!comp) return 0;

  var distance = clampValue(parseFloat(comp.state.distance) || 0, 0, 400);
  return Math.round(distance * 2 / 0.0343);
}

function mapServoDutyToAngle(dutyValue, dutyMax, frequency) {
  var duty = clampValue(parseFloat(dutyValue) || 0, 0, dutyMax);
  var freq = parseFloat(frequency) || 50;
  var periodUs = 1000000 / freq;
  var pulseUs = duty / dutyMax * periodUs;
  var angle = Math.round((pulseUs - 500) * 180 / 2000);

  if (!isFinite(angle)) angle = 90;
  if (angle < 0 || angle > 180) {
    angle = Math.round(duty / dutyMax * 180);
  }

  return clampValue(angle, 0, 180);
}

function writePWMValue(pin, dutyValue, dutyMax, frequency) {
  if (pin === null) return;

  var pinName = mcuPinName(pin);
  var duty = clampValue(parseFloat(dutyValue) || 0, 0, dutyMax);
  var candidates = getMCUPinCandidates(pin);

  pinValues[pinName] = duty > 0;
  updateLEDsOnPin(pinName, duty > 0);

  for (var i = 0; i < components.length; i++) {
    var comp = components[i];

    if (comp.type === 'servo') {
      var sm = candidates.some(function(pn) {
        return componentConnectedToMcuPin(comp, 'PWM', pn);
      });
      if (sm && isComponentWired(comp)) {
        comp.state.angle = mapServoDutyToAngle(duty, dutyMax, frequency);
      }
    }

    if (comp.type === 'buzzer') {
      var bm = candidates.some(function(pn) {
        return componentConnectedToMcuPin(comp, '+', pn);
      });
      if (bm && isComponentWired(comp)) {
        comp.state.playing = duty > 0 && (frequency === undefined || frequency > 0);
        if (frequency !== undefined) comp.state.frequency = frequency;
      }
    }
  }
}

function resolveMicroPythonPinRef(ref) {
  var runtime = getMicroPythonRuntime();
  var token = String(ref || '').trim();
  var unquoted = unquoteToken(token);

  if (runtime.pins[unquoted]) {
    return resolvePin(runtime.pins[unquoted].pinRef);
  }

  if (runtime.adc[unquoted]) {
    return resolveMicroPythonPinRef(runtime.adc[unquoted].pinRef);
  }

  if (runtime.pwm[unquoted]) {
    return resolveMicroPythonPinRef(runtime.pwm[unquoted].pinRef);
  }

  return resolvePin(token);
}

function resolveMicroPythonAdcRef(ref) {
  var runtime = getMicroPythonRuntime();
  var name = unquoteToken(ref);
  if (runtime.adc[name]) {
    return resolveMicroPythonPinRef(runtime.adc[name].pinRef);
  }
  return resolveMicroPythonPinRef(ref);
}

function registerMicroPythonPin(name, pinRef, mode, pull) {
  var runtime = getMicroPythonRuntime();
  runtime.pins[name] = {
    pinRef: pinRef,
    mode: mode,
    pull: pull || 'NONE'
  };

  var pin = resolvePin(pinRef);
  if (pin !== null) {
    setPinModeValue(pin, mode);
    if (mode === 'INPUT_PULLUP' && pinValues[mcuPinName(pin)] === undefined) {
      pinValues[mcuPinName(pin)] = true;
    }
  }
}

function registerMicroPythonAdc(name, pinRef) {
  var runtime = getMicroPythonRuntime();
  runtime.adc[name] = { pinRef: pinRef };
}

function registerMicroPythonPwm(name, pinRef) {
  var runtime = getMicroPythonRuntime();
  runtime.pwm[name] = {
    pinRef: pinRef,
    freq: 0,
    duty: 0
  };
}

function registerMicroPythonI2C(name, busId, sdaRef, sclRef, freq) {
  var runtime = getMicroPythonRuntime();
  var busValue = evaluateMath(busId);
  if (busValue === null) busValue = parseFloat(parseValue(busId));

  var freqValue = evaluateMath(freq);
  if (freqValue === null) freqValue = parseFloat(parseValue(freq));

  runtime.i2c[name] = {
    busId: isNaN(busValue) ? 0 : busValue,
    sdaRef: sdaRef,
    sclRef: sclRef,
    freq: isNaN(freqValue) ? 400000 : freqValue
  };
}

function registerMicroPythonSSD1306(name, width, height, i2cRef, addr) {
  if (typeof libraryRegistry === 'undefined' || typeof SSD1306Library === 'undefined') return false;

  var runtime = getMicroPythonRuntime();
  var i2cName = unquoteToken(i2cRef);
  var i2cConfig = runtime.i2c[i2cName] || null;
  var widthValue = evaluateMath(width);
  if (widthValue === null) widthValue = parseFloat(parseValue(width));

  var heightValue = evaluateMath(height);
  if (heightValue === null) heightValue = parseFloat(parseValue(height));

  var addrValue = evaluateMath(addr);
  if (addrValue === null) addrValue = parseFloat(parseValue(addr));

  var instance = new SSD1306Library(
    isNaN(widthValue) ? 128 : widthValue,
    isNaN(heightValue) ? 64 : heightValue
  );

  if (!isNaN(addrValue)) {
    instance._address = addrValue;
  }

  instance._expectedI2C = i2cConfig ? {
    busId: i2cConfig.busId,
    sdaPin: resolveMicroPythonPinRef(i2cConfig.sdaRef),
    sclPin: resolveMicroPythonPinRef(i2cConfig.sclRef)
  } : {
    busId: 0,
    sdaPin: null,
    sclPin: null
  };

  libraryRegistry.setInstance(name, instance);

  runtime.displays[name] = {
    instance: instance,
    i2cRef: i2cName
  };

  return instance.begin(0, isNaN(addrValue) ? undefined : addrValue);
}

function makeMicroPythonTimeoutError() {
  var err = new Error('[Errno 110] ETIMEDOUT');
  err.name = 'OSError';
  err.errno = 110;
  err.code = 'ETIMEDOUT';
  return err;
}

function resolveMicroPythonDHTEntry(name) {
  var runtime = getMicroPythonRuntime();
  return runtime.dht[unquoteToken(name)] || null;
}

function resolveMicroPythonDHTComponent(name) {
  var entry = resolveMicroPythonDHTEntry(name);
  if (!entry) return null;

  var pin = resolveMicroPythonPinRef(entry.pinRef);
  if (pin === null || pin === undefined) return null;

  return typeof findConnectedComponent === 'function'
    ? findConnectedComponent('dht', 'Data', pin)
    : null;
}

function registerMicroPythonDHT(name, pinRef, type) {
  var runtime = getMicroPythonRuntime();
  runtime.dht[name] = {
    pinRef: pinRef,
    type: type || 'DHT22',
    lastTemp: NaN,
    lastHum: NaN,
    ready: false
  };
  return runtime.dht[name];
}

function resolveMicroPythonDHTMeasure(name) {
  var entry = resolveMicroPythonDHTEntry(name);
  if (!entry) throw makeMicroPythonTimeoutError();

  var comp = resolveMicroPythonDHTComponent(name);
  if (!comp || !comp.state) {
    entry.ready = false;
    entry.lastTemp = NaN;
    entry.lastHum = NaN;
    throw makeMicroPythonTimeoutError();
  }

  if (typeof comp.state.temperature === 'number' && typeof comp.state.humidity === 'number') {
    entry.lastTemp = comp.state.temperature;
    entry.lastHum = comp.state.humidity;
    entry.ready = true;
    return true;
  }

  entry.ready = false;
  entry.lastTemp = NaN;
  entry.lastHum = NaN;
  throw makeMicroPythonTimeoutError();
}

function resolveMicroPythonDHTTemperature(name) {
  var entry = resolveMicroPythonDHTEntry(name);
  if (!entry || !entry.ready) throw makeMicroPythonTimeoutError();

  var comp = resolveMicroPythonDHTComponent(name);
  if (!comp || !comp.state || typeof comp.state.temperature !== 'number') throw makeMicroPythonTimeoutError();

  return entry.lastTemp;
}

function resolveMicroPythonDHTHumidity(name) {
  var entry = resolveMicroPythonDHTEntry(name);
  if (!entry || !entry.ready) throw makeMicroPythonTimeoutError();

  var comp = resolveMicroPythonDHTComponent(name);
  if (!comp || !comp.state || typeof comp.state.humidity !== 'number') throw makeMicroPythonTimeoutError();

  return entry.lastHum;
}

function formatRuntimeError(err) {
  if (!err) return 'Runtime error';
  if (err.name === 'OSError' && err.message) return err.name + ': ' + err.message;
  if (err.message) {
    return (err.name && err.name !== 'Error' ? err.name + ': ' : '') + err.message;
  }
  return String(err);
}

function handleRuntimeError(err) {
  var msg = formatRuntimeError(err);

  if (running) {
    stopCode();
  }

  if (typeof showRuntimeError === 'function') {
    showRuntimeError(msg);
  } else if (typeof showConnAlert === 'function') {
    showConnAlert(msg);
  }

  updateStatus('Runtime error');
  if (typeof console !== 'undefined' && console.error) {
    console.error(msg, err);
  }
}

// ==========================================
// CONDITION EVALUATOR
// ==========================================

function evalCondition(cond) {
  cond = normalizeEvaluatorExpression(String(cond || '').trim());

  cond = cond.replace(/\bisnan\s*\(([^)]+)\)/gi, function(_, inner) {
    const varName = inner.trim();
    if (variables[varName] !== undefined) {
      const v = variables[varName];
      return (typeof v === 'number' && (isNaN(v) || !isFinite(v))) ? 'true' : 'false';
    }
    return 'false';
  });

  let negMatch = cond.match(/^!\s*(\w+)\.(\w+)\((.*)\)$/);
  if (negMatch && typeof libraryRegistry !== 'undefined') {
    const instance = libraryRegistry.getInstance(negMatch[1]);
    if (instance && typeof instance[negMatch[2]] === 'function') {
      const args = typeof libraryRegistry._parseArgs === 'function'
        ? libraryRegistry._parseArgs(negMatch[3] || '')
        : [];
      return !instance[negMatch[2]](...args);
    }
  }

  let posMatch = cond.match(/^(\w+)\.(\w+)\((.*)\)$/);
  if (posMatch && typeof libraryRegistry !== 'undefined') {
    const instance = libraryRegistry.getInstance(posMatch[1]);
    if (instance && typeof instance[posMatch[2]] === 'function') {
      const args = typeof libraryRegistry._parseArgs === 'function'
        ? libraryRegistry._parseArgs(posMatch[3] || '')
        : [];
      return !!instance[posMatch[2]](...args);
    }
  }

  const drMatch = cond.match(/digitalRead\(([^)]+)\)/i);
  if (drMatch) {
    const pin = resolvePin(drMatch[1]);
    if (pin !== null) {
      cond = cond.replace(drMatch[0], String(readDigitalPinValue(pin)));
    }
  }

  if (cond.includes('Serial.available()')) {
    cond = cond.replace(/Serial\.available\(\)/g, String(serialRxBuffer.length));
  }

  for (const k in variables) {
    const v = variables[k];
    const rx = new RegExp('\\b' + k + '\\b', 'g');

    if (typeof v === 'number' || typeof v === 'boolean') {
      cond = cond.replace(rx, String(v));
    } else if (typeof v === 'string') {
      cond = cond.replace(rx, JSON.stringify(v));
    }
  }

  cond = cond
    .replace(/\bHIGH\b/g, '1')
    .replace(/\bLOW\b/g, '0')
    .replace(/\btrue\b/g, 'true')
    .replace(/\bfalse\b/g, 'false');

  try {
    if (/^[\d\s<>=!&|.()+\-*/A-Za-z_"',]+$/.test(cond)) {
      return !!Function('"use strict"; return (' + cond + ')')();
    }
  } catch (e) {}

  return false;
}

// ==========================================
// STRUCTURED EXECUTION
// ==========================================

function executeStructuredLines(sourceLines, phase) {
  for (let i = 0; i < sourceLines.length;) {
    const l = String(sourceLines[i] || '').trim();

    if (!l || l === '{' || l === '}' || l === '};' || l.startsWith('//')) {
      i++;
      continue;
    }

    if (l === 'return' || l.startsWith('return ') || l.startsWith('return;')) {
      break;
    }

    if (/^if\s*\(/.test(l)) {
      const consumed = handleIfBlock(i, sourceLines, phase);
      if (consumed > 0) {
        i += consumed;
        if (isDelayActive) break;
        continue;
      }
    }

    const ok = executeLineWithDelay(l, phase);
    if (ok === false) break;

    i++;
  }
}

function handleIfBlock(startIdx, sourceLines, phase) {
  const firstLine = String(sourceLines[startIdx] || '').trim();
  if (!/^if\s*\(/.test(firstLine)) return 0;

  let i = startIdx;
  let executed = false;

  while (i < sourceLines.length) {
    const l = String(sourceLines[i] || '').trim();
    let condStr = null;

    if (i === startIdx) {
      const m = l.match(/^if\s*\((.+)\)\s*\{?\s*$/);
      if (!m) return 0;
      condStr = m[1];
      i++;
    } else {
      if (/^}\s*else\s+if\s*\((.+)\)\s*\{?\s*$/.test(l)) {
        condStr = l.match(/^}\s*else\s+if\s*\((.+)\)\s*\{?\s*$/)[1];
        i++;
      } else if (/^else\s+if\s*\((.+)\)\s*\{?\s*$/.test(l)) {
        condStr = l.match(/^else\s+if\s*\((.+)\)\s*\{?\s*$/)[1];
        i++;
      } else if (/^}\s*else\s*\{?\s*$/.test(l) || /^else\s*\{?\s*$/.test(l)) {
        condStr = '__else__';
        i++;
      } else if (l === '}') {
        i++;
        break;
      } else {
        break;
      }
    }

    const bodyLines = [];
    let depth = 0;

    while (i < sourceLines.length) {
      const bl = String(sourceLines[i] || '').trim();

      if (
        depth === 0 &&
        (
          /^}\s*else\s+if\s*\(/.test(bl) ||
          /^else\s+if\s*\(/.test(bl) ||
          /^}\s*else\s*(\{|$)/.test(bl) ||
          /^else\s*(\{|$)/.test(bl)
        )
      ) {
        break;
      }

      if (depth === 0 && (bl === '}' || bl === '};')) {
        const next = String(sourceLines[i + 1] || '').trim();
        if (/^else\s/.test(next) || /^}\s*else/.test(next)) i++;
        break;
      }

      const opens = (bl.match(/\{/g) || []).length;
      const closes = (bl.match(/\}/g) || []).length;
      depth += opens - closes;

      if (bl !== '{' && bl !== '}') bodyLines.push(bl);
      i++;
    }

    const shouldRun = condStr === '__else__'
      ? !executed
      : (!executed && evalCondition(condStr));

    if (shouldRun) {
      executed = true;
      executeStructuredLines(bodyLines, phase);
      if (isDelayActive) {
        delayAdvance = i - startIdx;
        delayPhase = phase;
        return i - startIdx;
      }
    }
  }

  return i - startIdx;
}

function evaluateMath(expr) {
  expr = String(expr || '').trim().replace(/;$/, '');
  let e = normalizeEvaluatorExpression(expr);

  for (const k in variables) {
    if (typeof variables[k] === 'number') {
      e = e.replace(new RegExp('\\b' + k + '\\b', 'g'), variables[k]);
    }
  }

  const mapM = e.match(/map\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
  if (mapM) {
    const val = parseFloat(mapM[1]);
    const fromLow = parseFloat(mapM[2]);
    const fromHigh = parseFloat(mapM[3]);
    const toLow = parseFloat(mapM[4]);
    const toHigh = parseFloat(mapM[5]);
    return Math.round((val - fromLow) * (toHigh - toLow) / (fromHigh - fromLow) + toLow);
  }

  const conM = e.match(/constrain\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
  if (conM) {
    return Math.min(parseFloat(conM[3]), Math.max(parseFloat(conM[2]), parseFloat(conM[1])));
  }

  try {
    if (/^[\d\s+\-*/().%]+$/.test(e)) {
      const r = Function('"use strict";return (' + e + ')')();
      return Math.round(r * 100) / 100;
    }
  } catch (err) {}

  const n = parseFloat(e);
  return isNaN(n) ? null : n;
}

function serialWrite(msg, newLine) {
  if (typeof addSerialMessage === 'function') {
    addSerialMessage(msg, newLine);
  }
}

function resolveLibraryArgValue(arg) {
  if (typeof arg !== 'string') return arg;

  const trimmed = arg.trim();
  if (!trimmed) return '';

  if (variables[trimmed] !== undefined) return variables[trimmed];
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  if (/^0x[0-9a-f]+$/i.test(trimmed)) return parseInt(trimmed, 16);
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);

  return arg;
}

function splitCallArguments(source) {
  var args = [];
  var current = '';
  var depth = 0;
  var quote = null;
  var escaped = false;

  for (var i = 0; i < source.length; i++) {
    var ch = source[i];

    if (quote) {
      current += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }

    if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
      current += ch;
      continue;
    }

    if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      current += ch;
      continue;
    }

    if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.trim() || source.trim() === '') args.push(current.trim());
  if (args.length === 1 && args[0] === '') return [];
  return args;
}

function stripSimpleWrappers(expr) {
  var out = String(expr || '');
  var prev = '';

  while (prev !== out) {
    prev = out;
    out = out
      .replace(/\bint\s*\(\s*([^()]+)\s*\)/g, '($1)')
      .replace(/\bfloat\s*\(\s*([^()]+)\s*\)/g, '($1)')
      .replace(/\bround\s*\(\s*([^()]+)\s*\)/g, '($1)');
  }

  return out;
}

function resolveSimulatorRuntimeCalls(expr) {
  var out = String(expr || '');

  out = out.replace(/\bmpPinRead\s*\(\s*([^)]+?)\s*\)/g, function(_, ref) {
    return String(readDigitalPinValue(resolveMicroPythonPinRef(ref)));
  });

  out = out.replace(/\bmpAdcRead\s*\(\s*([^)]+?)\s*\)/g, function(_, ref) {
    return String(readAnalogPinValue(resolveMicroPythonAdcRef(ref), 65535));
  });

  out = out.replace(/\b(?:mpTimePulseUs|time_pulse_us)\s*\(\s*([^,]+?)\s*,\s*([^,]+?)(?:\s*,\s*[^)]+)?\s*\)/g, function(_, ref, value) {
    return String(getUltrasonicPulseDuration(resolveMicroPythonPinRef(ref), parseValue(value)));
  });

  out = out.replace(/\bmpDHTMeasure\s*\(\s*([^)]+?)\s*\)/g, function(_, ref) {
    return String(resolveMicroPythonDHTMeasure(ref) ? 1 : 0);
  });

  out = out.replace(/\bmpDHTTemperature\s*\(\s*([^)]+?)\s*\)/g, function(_, ref) {
    return String(resolveMicroPythonDHTTemperature(ref));
  });

  out = out.replace(/\bmpDHTHumidity\s*\(\s*([^)]+?)\s*\)/g, function(_, ref) {
    return String(resolveMicroPythonDHTHumidity(ref));
  });

  return out;
}

function normalizeEvaluatorExpression(expr) {
  var out = resolveSimulatorRuntimeCalls(expr);
  out = stripSimpleWrappers(out);
  out = out
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\bNone\b/g, '0')
    .replace(/\band\b/g, '&&')
    .replace(/\bor\b/g, '||')
    .replace(/\bnot\b/g, '!');

  return out;
}

function normalizePythonPinMode(modeToken, pullToken) {
  var mode = String(modeToken || 'Pin.OUT').replace(/\s+/g, '');
  var pull = String(pullToken || 'NONE').replace(/\s+/g, '');

  if (/PULL_UP$/i.test(pull)) {
    return { mode: 'INPUT_PULLUP', pull: 'PULL_UP' };
  }

  if (/Pin\.IN$/i.test(mode)) {
    return { mode: 'INPUT', pull: 'NONE' };
  }

  return { mode: 'OUTPUT', pull: 'NONE' };
}

function parsePythonCallArgs(argsText) {
  var rawArgs = splitCallArguments(argsText);
  var positional = [];
  var keywords = {};

  rawArgs.forEach(function(arg) {
    var token = String(arg || '').trim();
    var keywordMatch = token.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);

    if (keywordMatch) {
      keywords[keywordMatch[1]] = keywordMatch[2].trim();
      return;
    }

    positional.push(token);
  });

  return {
    positional: positional,
    keywords: keywords
  };
}

function translatePythonObjectRef(token, state) {
  var ref = String(token || '').trim();

  if (state.pinVars[ref] || state.adcVars[ref] || state.pwmVars[ref] || state.i2cVars[ref]) {
    return JSON.stringify(ref);
  }

  var pinCtor = ref.match(/^(?:machine\.)?Pin\s*\((.+)\)$/);
  if (pinCtor) {
    var pinArgs = splitCallArguments(pinCtor[1]);
    return pinArgs.length > 0 ? translatePythonExpression(pinArgs[0], state) : '0';
  }

  return translatePythonExpression(ref, state);
}

function translatePythonExpression(expr, state) {
  var out = String(expr || '').trim();

  out = out.replace(/\b(\w+)\.value\s*\(\s*\)/g, function(match, name) {
    return state.pinVars[name] ? 'mpPinRead("' + name + '")' : match;
  });

  out = out.replace(/\b(\w+)\.read_u16\s*\(\s*\)/g, function(match, name) {
    return state.adcVars[name] ? 'mpAdcRead("' + name + '")' : match;
  });

  out = out.replace(/\b(\w+)\.(?:temperature|readTemperature)\s*\(\s*\)/g, function(match, name) {
    return state.dhtVars[name] ? 'mpDHTTemperature("' + name + '")' : match;
  });

  out = out.replace(/\b(\w+)\.(?:humidity|readHumidity)\s*\(\s*\)/g, function(match, name) {
    return state.dhtVars[name] ? 'mpDHTHumidity("' + name + '")' : match;
  });

  out = out.replace(/\b(\w+)\.measure\s*\(\s*\)/g, function(match, name) {
    return state.dhtVars[name] ? 'mpDHTMeasure("' + name + '")' : match;
  });

  out = out.replace(/\b(?:machine\.)?time_pulse_us\s*\(\s*([^,]+?)\s*,\s*([^,]+?)(?:\s*,\s*[^)]+)?\s*\)/g, function(_, ref, value) {
    return 'mpTimePulseUs(' + translatePythonObjectRef(ref, state) + ', ' + translatePythonExpression(value, state) + ')';
  });

  out = out
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\bNone\b/g, '0')
    .replace(/\band\b/g, '&&')
    .replace(/\bor\b/g, '||')
    .replace(/\bnot\b/g, '!');

  return out;
}

function translatePythonCondition(expr, state) {
  return translatePythonExpression(expr, state);
}

function compilePythonPrint(argsText, state) {
  var args = splitCallArguments(argsText);
  if (args.length === 0) return 'Serial.println("")';

  return 'Serial.println(' + args.map(function(arg) {
    return translatePythonExpression(arg, state);
  }).join(' + " " + ') + ')';
}

function getPythonLines(code) {
  return String(code || '')
    .replace(/\r/g, '')
    .split('\n')
    .map(function(rawLine) {
      return rawLine.replace(/\t/g, '    ');
    })
    .reduce(function(list, rawLine) {
      var trimmed = rawLine.trim();
      if (!trimmed) return list;
      if (trimmed.startsWith('#')) return list;
      if (/^from\s+\S+\s+import\s+.+$/.test(trimmed)) return list;
      if (/^import\s+.+$/.test(trimmed)) return list;

      list.push({
        indent: rawLine.match(/^ */)[0].length,
        text: trimmed
      });
      return list;
    }, []);
}

function collectIndentedPythonBlock(lines, startIndex, parentIndent) {
  var block = [];
  var i = startIndex;

  while (i < lines.length) {
    if (lines[i].indent <= parentIndent) break;
    block.push(lines[i]);
    i++;
  }

  return {
    block: block,
    nextIndex: i
  };
}

function rebasePythonLines(lines) {
  if (!lines.length) return [];

  var baseIndent = lines[0].indent;
  return lines.map(function(line) {
    return {
      indent: Math.max(0, line.indent - baseIndent),
      text: line.text
    };
  });
}

function extractPythonFunctions(lines) {
  var remaining = [];
  var functions = {};

  for (var i = 0; i < lines.length;) {
    var line = lines[i];
    var defMatch = line.indent === 0 ? line.text.match(/^def\s+(\w+)\s*\(([^)]*)\)\s*:\s*$/) : null;

    if (!defMatch) {
      remaining.push(line);
      i++;
      continue;
    }

    var bodyInfo = collectIndentedPythonBlock(lines, i + 1, line.indent);
    functions[defMatch[1]] = {
      name: defMatch[1],
      args: splitCallArguments(defMatch[2]),
      body: rebasePythonLines(bodyInfo.block)
    };
    i = bodyInfo.nextIndex;
  }

  return {
    lines: remaining,
    functions: functions
  };
}

function extractPythonMainLoop(lines) {
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indent !== 0) continue;
    if (!/^while\s+True\s*:\s*$/i.test(lines[i].text)) continue;

    var loopInfo = collectIndentedPythonBlock(lines, i + 1, lines[i].indent);
    return {
      setup: lines.slice(0, i),
      loop: rebasePythonLines(loopInfo.block)
    };
  }

  return {
    setup: lines,
    loop: []
  };
}

function inlinePythonFunction(fn, state, targetVar) {
  if (!fn || fn.args.length > 0) return null;

  var body = fn.body.slice();
  var returnExpr = null;

  if (body.length > 0) {
    var last = body[body.length - 1];
    var retMatch = last.indent === 0 ? last.text.match(/^return\s+(.+)$/) : null;
    if (retMatch) {
      returnExpr = retMatch[1];
      body = body.slice(0, -1);
    }
  }

  var cursor = { index: 0 };
  var out = compilePythonStatements(body, state, 0, cursor, { inInlineFunction: true });
  if (targetVar && returnExpr !== null) {
    out.push(targetVar + ' = ' + translatePythonExpression(returnExpr, state) + ';');
  }
  return out;
}

function translatePythonStatement(text, state, options) {
  var pinCtor = text.match(/^(\w+)\s*=\s*(?:machine\.)?Pin\s*\((.+)\)$/);
  if (pinCtor) {
    var pinArgs = splitCallArguments(pinCtor[2]);
    var pinModeInfo = normalizePythonPinMode(pinArgs[1], pinArgs[2]);
    state.pinVars[pinCtor[1]] = true;
    return ['mpPin("' + pinCtor[1] + '", ' + (pinArgs[0] || '0') + ', ' + pinModeInfo.mode + ', ' + pinModeInfo.pull + ');'];
  }

  var dhtCtor = text.match(/^(\w+)\s*=\s*(?:dht\.)?(DHT11|DHT21|DHT22)\s*\((.+)\)$/i);
  if (dhtCtor) {
    var dhtArgs = splitCallArguments(dhtCtor[3]);
    var dhtPin = dhtArgs.length > 0 ? translatePythonObjectRef(dhtArgs[0], state) : '0';
    state.dhtVars[dhtCtor[1]] = true;
    return ['mpDHT("' + dhtCtor[1] + '", ' + dhtPin + ', "' + dhtCtor[2].toUpperCase() + '");'];
  }

  var adcCtor = text.match(/^(\w+)\s*=\s*(?:machine\.)?ADC\s*\((.+)\)$/);
  if (adcCtor) {
    state.adcVars[adcCtor[1]] = true;
    return ['mpAdc("' + adcCtor[1] + '", ' + translatePythonObjectRef(adcCtor[2], state) + ');'];
  }

  var pwmCtor = text.match(/^(\w+)\s*=\s*(?:machine\.)?PWM\s*\((.+)\)$/);
  if (pwmCtor) {
    state.pwmVars[pwmCtor[1]] = true;
    return ['mpPwm("' + pwmCtor[1] + '", ' + translatePythonObjectRef(pwmCtor[2], state) + ');'];
  }

  var i2cCtor = text.match(/^(\w+)\s*=\s*(?:machine\.)?I2C\s*\((.+)\)$/);
  if (i2cCtor) {
    var i2cArgs = parsePythonCallArgs(i2cCtor[2]);
    var i2cBus = i2cArgs.positional[0] || '0';
    var i2cSda = i2cArgs.keywords.sda || i2cArgs.positional[1] || '0';
    var i2cScl = i2cArgs.keywords.scl || i2cArgs.positional[2] || '1';
    var i2cFreq = i2cArgs.keywords.freq || i2cArgs.positional[3] || '400000';

    state.i2cVars[i2cCtor[1]] = true;

    return ['mpI2C("' + i2cCtor[1] + '", '
      + translatePythonExpression(i2cBus, state) + ', '
      + translatePythonObjectRef(i2cSda, state) + ', '
      + translatePythonObjectRef(i2cScl, state) + ', '
      + translatePythonExpression(i2cFreq, state) + ');'];
  }

  var ssd1306Ctor = text.match(/^(\w+)\s*=\s*ssd1306\.SSD1306_I2C\s*\((.+)\)$/i);
  if (ssd1306Ctor) {
    var oledArgs = parsePythonCallArgs(ssd1306Ctor[2]);
    var oledWidth = oledArgs.positional[0] || '128';
    var oledHeight = oledArgs.positional[1] || '64';
    var oledI2C = oledArgs.keywords.i2c || oledArgs.positional[2] || '""';
    var oledAddr = oledArgs.keywords.addr || oledArgs.positional[3] || '0x3C';

    state.displayVars[ssd1306Ctor[1]] = true;

    return ['mpSSD1306("' + ssd1306Ctor[1] + '", '
      + translatePythonExpression(oledWidth, state) + ', '
      + translatePythonExpression(oledHeight, state) + ', '
      + translatePythonObjectRef(oledI2C, state) + ', '
      + translatePythonExpression(oledAddr, state) + ');'];
  }

  var pinToggle = text.match(/^(\w+)\.(on|off|high|low)\s*\(\s*\)\s*$/);
  if (pinToggle && state.pinVars[pinToggle[1]]) {
    return ['mpPinWrite("' + pinToggle[1] + '", ' + (/on|high/.test(pinToggle[2]) ? '1' : '0') + ');'];
  }

  var pinWrite = text.match(/^(\w+)\.value\s*\(\s*(.+)\s*\)\s*$/);
  if (pinWrite && state.pinVars[pinWrite[1]]) {
    return ['mpPinWrite("' + pinWrite[1] + '", ' + translatePythonExpression(pinWrite[2], state) + ');'];
  }

  var pwmFreq = text.match(/^(\w+)\.freq\s*\(\s*(.+)\s*\)\s*$/);
  if (pwmFreq && state.pwmVars[pwmFreq[1]]) {
    return ['mpPwmFreq("' + pwmFreq[1] + '", ' + translatePythonExpression(pwmFreq[2], state) + ');'];
  }

  var pwmDuty = text.match(/^(\w+)\.duty_u16\s*\(\s*(.+)\s*\)\s*$/);
  if (pwmDuty && state.pwmVars[pwmDuty[1]]) {
    return ['mpPwmDuty("' + pwmDuty[1] + '", ' + translatePythonExpression(pwmDuty[2], state) + ');'];
  }

  var pwmDeinit = text.match(/^(\w+)\.deinit\s*\(\s*\)\s*$/);
  if (pwmDeinit && state.pwmVars[pwmDeinit[1]]) {
    return ['mpPwmDeinit("' + pwmDeinit[1] + '");'];
  }

  var sleepMatch = text.match(/^(?:time|utime)\.sleep\s*\(\s*(.+)\s*\)\s*$/);
  if (sleepMatch) {
    return ['delay(' + translatePythonExpression(sleepMatch[1], state) + ' * 1000);'];
  }

  var sleepMsMatch = text.match(/^(?:time|utime)\.sleep_ms\s*\(\s*(.+)\s*\)\s*$/);
  if (sleepMsMatch) {
    return ['delay(' + translatePythonExpression(sleepMsMatch[1], state) + ');'];
  }

  var sleepUsMatch = text.match(/^(?:time|utime)\.sleep_us\s*\(\s*(.+)\s*\)\s*$/);
  if (sleepUsMatch) {
    return ['delayMicroseconds(' + translatePythonExpression(sleepUsMatch[1], state) + ');'];
  }

  var printMatch = text.match(/^print\s*\((.*)\)\s*$/);
  if (printMatch) {
    return [compilePythonPrint(printMatch[1], state) + ';'];
  }

  var fnAssign = text.match(/^(\w+)\s*=\s*(\w+)\s*\(\s*\)\s*$/);
  if (fnAssign && state.functions[fnAssign[2]]) {
    return inlinePythonFunction(state.functions[fnAssign[2]], state, fnAssign[1]);
  }

  var fnCall = text.match(/^(\w+)\s*\(\s*\)\s*$/);
  if (fnCall && state.functions[fnCall[1]]) {
    return inlinePythonFunction(state.functions[fnCall[1]], state, null);
  }

  if (/^return\b/.test(text)) {
    if (options && options.inInlineFunction) return [];
    var returnMatch = text.match(/^return\s+(.+)$/);
    return [returnMatch ? 'return ' + translatePythonExpression(returnMatch[1], state) + ';' : 'return;'];
  }

  return [translatePythonExpression(text, state) + ';'];
}

function compilePythonIfChain(lines, state, indent, cursor, options) {
  var out = [];
  var first = true;

  while (cursor.index < lines.length) {
    var line = lines[cursor.index];
    if (line.indent !== indent) break;

    var ifMatch = line.text.match(/^if\s+(.+)\s*:\s*$/);
    var elifMatch = line.text.match(/^elif\s+(.+)\s*:\s*$/);
    var elseMatch = /^else\s*:\s*$/.test(line.text);

    if (first && !ifMatch) break;
    if (!first && !elifMatch && !elseMatch) break;

    if (ifMatch) {
      out.push('if (' + translatePythonCondition(ifMatch[1], state) + ') {');
    } else if (elifMatch) {
      out.push('} else if (' + translatePythonCondition(elifMatch[1], state) + ') {');
    } else {
      out.push('} else {');
    }

    first = false;
    cursor.index++;

    var childIndent = cursor.index < lines.length ? lines[cursor.index].indent : indent + 4;
    out.push.apply(out, compilePythonStatements(lines, state, childIndent, cursor, options));

    var next = lines[cursor.index];
    if (!next || next.indent !== indent || (!/^elif\s+/.test(next.text) && !/^else\s*:\s*$/.test(next.text))) {
      out.push('}');
      break;
    }
  }

  return out;
}

function compilePythonStatements(lines, state, indent, cursor, options) {
  var out = [];

  while (cursor.index < lines.length) {
    var line = lines[cursor.index];
    if (line.indent < indent) break;
    if (line.indent > indent) {
      cursor.index++;
      continue;
    }

    if (/^if\s+/.test(line.text)) {
      out.push.apply(out, compilePythonIfChain(lines, state, indent, cursor, options));
      continue;
    }

    if (/^elif\s+/.test(line.text) || /^else\s*:\s*$/.test(line.text)) {
      break;
    }

    if (/^while\s+True\s*:\s*$/i.test(line.text)) {
      cursor.index++;
      var nestedIndent = cursor.index < lines.length ? lines[cursor.index].indent : indent + 4;
      out.push.apply(out, compilePythonStatements(lines, state, nestedIndent, cursor, options));
      continue;
    }

    var translated = translatePythonStatement(line.text, state, options) || [];
    out.push.apply(out, translated);
    cursor.index++;
  }

  return out;
}

// ==========================================
// MICROPYTHON TO SIMULATOR CONVERTER
// ==========================================

function convertPyToSim(code) {
  var extracted = extractPythonFunctions(getPythonLines(code));
  var sections = extractPythonMainLoop(extracted.lines);
  var state = {
    functions: extracted.functions,
    pinVars: {},
    adcVars: {},
    pwmVars: {},
    i2cVars: {},
    displayVars: {},
    dhtVars: {}
  };

  var setupCursor = { index: 0 };
  var loopCursor = { index: 0 };
  var setupBody = compilePythonStatements(sections.setup, state, 0, setupCursor, {});
  var loopBody = compilePythonStatements(sections.loop, state, 0, loopCursor, {});

  return [
    'void setup() {',
    '  Serial.begin(115200);'
  ].concat(setupBody.map(function(line) {
    return '  ' + line;
  })).concat([
    '}',
    '',
    'void loop() {'
  ]).concat(loopBody.map(function(line) {
    return '  ' + line;
  })).concat([
    '}'
  ]).join('\n');
}

// ==========================================
// MCU/LANGUAGE VALIDATION
// ==========================================

function validateMCULanguagePair() {
  var mcus = getPlacedMCUs();
  var mode = window.fileMode || 'ino';

  if (mcus.length === 0) {
    if (typeof showConnAlert === 'function') {
      showConnAlert('Place an ESP32 or Pico on the canvas first!');
    }
    updateStatus('No microcontroller placed');
    return false;
  }

  if (mcus.length > 1) {
    if (typeof showConnAlert === 'function') {
      showConnAlert('Use only one microcontroller at a time when running the simulator.');
    }
    updateStatus('Multiple microcontrollers detected');
    return false;
  }

  var mcu = mcus[0].type;

  if (mode === 'ino' && mcu !== 'esp32') {
    if (typeof showConnAlert === 'function') {
      showConnAlert('Arduino (.ino) mode only works with ESP32. Switch board or change the editor mode.');
    }
    updateStatus('Wrong MCU for Arduino mode');
    return false;
  }

  if (mode === 'py' && mcu !== 'pico') {
    if (typeof showConnAlert === 'function') {
      showConnAlert('MicroPython (.py) mode only works with Pico. Switch board or change the editor mode.');
    }
    updateStatus('Wrong MCU for MicroPython mode');
    return false;
  }

  return true;
}

// ==========================================
// RUN CODE
// ==========================================

function runCode() {
  if (running) stopCode();

  if (!validateMCULanguagePair()) return;
  runtimeMode = window.fileMode || 'ino';

  for (let i = 0; i < components.length; i++) {
    const comp = components[i];
    const mcuTypes = ['esp32', 'pico'];
    if (mcuTypes.includes(comp.type)) continue;

    if (!isComponentWired(comp)) {
      const missing = getMissingPins(comp);
      const msg = (comp.state.label || comp.type).toUpperCase() + ' is missing connections: ' + missing.join(', ');
      if (typeof showConnAlert === 'function') showConnAlert(msg);
    }
  }

  running = true;
  resetMicroPythonRuntime();

  updateStatus('Running...');

  const sourceCode = typeof getCode === 'function'
    ? getCode()
    : document.getElementById('code-textarea').value;

  const code = window.fileMode === 'py'
    ? convertPyToSim(sourceCode)
    : sourceCode;

  variables = {};
  defines = {};
  pinModes = {};
  pinValues = {};
  setupLines = [];
  loopLines = [];
  currentSetupLineIndex = 0;
  currentLineIndex = 0;
  inSetupPhase = false;
  isDelayActive = false;
  delayEndTime = 0;
  delayAdvance = 1;
  delayPhase = 'loop';
  serialLineBuffer = '';
  serialRxBuffer = [];

  if (typeof libraryRegistry !== 'undefined') libraryRegistry.reset();

  const rawLines = code.split('\n');
  for (let i = 0; i < rawLines.length; i++) {
    const m = rawLines[i].trim().match(/#define\s+(\w+)\s+(.+)/);
    if (m) defines[m[1]] = m[2].trim();
  }

  if (!defines['SSD1306_SWITCHCAPVCC']) defines['SSD1306_SWITCHCAPVCC'] = '0x02';
  if (!defines['SSD1306_WHITE']) defines['SSD1306_WHITE'] = '1';
  if (!defines['DHT11']) defines['DHT11'] = '11';
  if (!defines['DHT22']) defines['DHT22'] = '22';
  if (!defines['DHT21']) defines['DHT21'] = '21';

  let processed = code;
  for (const k in defines) {
    processed = processed.replace(
      new RegExp('("(?:[^"\\\\]|\\\\.)*")|\\b' + k + '\\b', 'g'),
      function(match, strLiteral) {
        return strLiteral ? strLiteral : defines[k];
      }
    );
  }

  const pLines = processed.split('\n');
  let inSetup = false;
  let inLoop = false;
  let braceDepth = 0;

  for (let i = 0; i < pLines.length; i++) {
    const raw = pLines[i];
    const l = raw.trim();
    if (!l || l.startsWith('//')) continue;

    if (typeof libraryRegistry !== 'undefined') {
      const includedLib = libraryRegistry.parseInclude(l);
      if (includedLib) continue;
    }

    if (/^void\s+setup\s*\(/.test(l)) {
      inSetup = true;
      inLoop = false;
      braceDepth = 0;
      continue;
    }

    if (/^void\s+loop\s*\(/.test(l)) {
      inSetup = false;
      inLoop = true;
      braceDepth = 0;
      continue;
    }

    const opens = (l.match(/\{/g) || []).length;
    const closes = (l.match(/\}/g) || []).length;
    braceDepth += opens - closes;

    if (braceDepth < 0) {
      inSetup = false;
      inLoop = false;
      braceDepth = 0;
      continue;
    }

    if (typeof libraryRegistry !== 'undefined') {
      const instance = libraryRegistry.tryInstantiate(l);
      if (instance) continue;
    }

    if (!inSetup && !inLoop) {
      const vd = l.match(/^(?:const\s+)?(?:int|float|long|byte|double|String|unsigned\s+long|bool|char)\s+(\w+)\s*=\s*(.+);?$/);
      if (vd) variables[vd[1]] = evaluateLiteral(vd[2]);
    }

    if (inSetup) setupLines.push(l);
    if (inLoop) loopLines.push(l);
  }

  inSetupPhase = setupLines.length > 0;

  if (executionInterval) clearInterval(executionInterval);
  executionInterval = setInterval(tick, 50);
}

// ==========================================
// TICK
// ==========================================

function tick() {
  try {
    if (!running) return;

    if (isDelayActive) {
      if (Date.now() >= delayEndTime) {
        isDelayActive = false;

        if (delayPhase === 'setup') {
          currentSetupLineIndex += delayAdvance;
          if (currentSetupLineIndex >= setupLines.length) {
            inSetupPhase = false;
            currentLineIndex = 0;
          }
        } else {
          currentLineIndex += delayAdvance;
        }

        delayAdvance = 1;
        if (typeof draw === 'function') draw();
      }
      return;
    }

    if (inSetupPhase) {
      if (currentSetupLineIndex >= setupLines.length) {
        inSetupPhase = false;
        currentLineIndex = 0;
        return;
      }

      const l = String(setupLines[currentSetupLineIndex] || '').trim();
      if (!l || l === '{' || l === '}' || l === '};' || l.startsWith('//')) {
        currentSetupLineIndex++;
        return;
      }

      if (l === 'return' || l === 'return;') {
        inSetupPhase = false;
        currentLineIndex = 0;
        return;
      }

      if (/^if\s*\(/.test(l)) {
        const consumed = handleIfBlock(currentSetupLineIndex, setupLines, 'setup');
        if (consumed > 0) {
          if (!isDelayActive) currentSetupLineIndex += consumed;
          if (typeof draw === 'function') draw();
          return;
        }
      }

      const ok = executeLineWithDelay(setupLines[currentSetupLineIndex], 'setup');
      if (!isDelayActive && ok !== false) currentSetupLineIndex++;
      return;
    }

    if (currentLineIndex >= loopLines.length) {
      currentLineIndex = 0;
      return;
    }

    const l = String(loopLines[currentLineIndex] || '').trim();
    if (!l || l === '{' || l === '}' || l === '};' || l.startsWith('//')) {
      currentLineIndex++;
      return;
    }

    if (l === 'return' || l === 'return;') {
      currentLineIndex = loopLines.length;
      return;
    }

    if (/^if\s*\(/.test(l)) {
      const consumed = handleIfBlock(currentLineIndex, loopLines, 'loop');
      if (consumed > 0) {
        if (!isDelayActive) currentLineIndex += consumed;
        if (typeof draw === 'function') draw();
        return;
      }
    }

    const ok = executeLineWithDelay(loopLines[currentLineIndex], 'loop');
    if (!isDelayActive && ok !== false) currentLineIndex++;
    if (typeof draw === 'function') draw();
  } catch (err) {
    handleRuntimeError(err);
  }
}

// ==========================================
// STOP CODE
// ==========================================

function stopCode() {
  running = false;
  if (executionInterval) {
    clearInterval(executionInterval);
    executionInterval = null;
  }
  isDelayActive = false;
  resetMicroPythonRuntime();

  components.forEach(function(comp) {
    if (comp.type === 'led') comp.state.on = false;
    if (comp.type === 'buzzer') comp.state.playing = false;
    if (comp.type === 'servo') comp.state.angle = 90;
    if (comp.type === 'ssd1306') {
      comp.state.display = Array.from({ length: 8 }, function() {
        return Array.from({ length: 128 }, function() { return 0; });
      });
    }
  });

  updateStatus('Stopped');
  if (typeof draw === 'function') draw();
}

// ==========================================
// EXECUTE LINE WITH DELAY
// ==========================================

function executeLineWithDelay(line, phase) {
  const l = String(line || '').trim().replace(/;$/, '');
  if (!l || l === '{' || l === '}' || l.startsWith('//')) return true;

  const delayM = l.match(/^delay\s*\(\s*(.+?)\s*\)$/i);
  if (delayM) {
    let ms = evaluateMath(delayM[1]);
    if (ms === null) ms = parseFloat(parseValue(delayM[1]));
    if (isNaN(ms)) ms = 0;
    isDelayActive = true;
    delayEndTime = Date.now() + ms;
    delayAdvance = 1;
    delayPhase = phase;
    return true;
  }

  const delayUsM = l.match(/^delayMicroseconds\s*\(\s*(.+?)\s*\)$/i);
  if (delayUsM) {
    let micros = evaluateMath(delayUsM[1]);
    if (micros === null) micros = parseFloat(parseValue(delayUsM[1]));
    if (isNaN(micros) || micros <= 0) return true;

    isDelayActive = true;
    delayEndTime = Date.now() + Math.max(0, micros / 1000);
    delayAdvance = 1;
    delayPhase = phase;
    return true;
  }

  if (/^Serial\.begin\s*\(/.test(l)) {
    serialWrite('Serial started', true);
    return true;
  }

  const spln = l.match(/^Serial\.println\s*\(\s*(.*?)\s*\)$/);
  if (spln) {
    serialWrite(parseContent(spln[1]), true);
    return true;
  }

  const sp = l.match(/^Serial\.print\s*\(\s*(.*?)\s*\)$/);
  if (sp) {
    serialWrite(parseContent(sp[1]), false);
    return true;
  }

  if (/^(?:\w+\s*=\s*)?Serial\.read\s*\(\)/.test(l)) {
    const assignM = l.match(/^(\w+)\s*=\s*Serial\.read\s*\(\)/);
    const val = serialRxBuffer.length > 0 ? serialRxBuffer.shift().charCodeAt(0) : -1;
    if (assignM) variables[assignM[1]] = val;
    return true;
  }

  const pmM = l.match(/^pinMode\s*\(\s*(.+?)\s*,\s*(INPUT|OUTPUT|INPUT_PULLUP)\s*\)$/i);
  if (pmM) {
    const pin = resolvePin(pmM[1]);
    setPinModeValue(pin, pmM[2]);
    return true;
  }

  const mpPinM = l.match(/^mpPin\s*\(\s*"(.*?)"\s*,\s*(.+?)\s*,\s*(OUTPUT|INPUT|INPUT_PULLUP)\s*(?:,\s*(PULL_UP|PULL_DOWN|NONE))?\s*\)$/);
  if (mpPinM) {
    registerMicroPythonPin(mpPinM[1], mpPinM[2], mpPinM[3], mpPinM[4] || 'NONE');
    return true;
  }

  const mpAdcM = l.match(/^mpAdc\s*\(\s*"(.*?)"\s*,\s*(.+?)\s*\)$/);
  if (mpAdcM) {
    registerMicroPythonAdc(mpAdcM[1], mpAdcM[2]);
    return true;
  }

  const mpPwmM = l.match(/^mpPwm\s*\(\s*"(.*?)"\s*,\s*(.+?)\s*\)$/);
  if (mpPwmM) {
    registerMicroPythonPwm(mpPwmM[1], mpPwmM[2]);
    return true;
  }

  const mpPwmFreqM = l.match(/^mpPwmFreq\s*\(\s*"(.*?)"\s*,\s*(.+?)\s*\)$/);
  if (mpPwmFreqM) {
    var runtime = getMicroPythonRuntime();
    if (runtime.pwm[mpPwmFreqM[1]]) {
      var pwmFreqValue = evaluateMath(mpPwmFreqM[2]);
      if (pwmFreqValue === null) pwmFreqValue = parseFloat(parseValue(mpPwmFreqM[2]));
      runtime.pwm[mpPwmFreqM[1]].freq = isNaN(pwmFreqValue) ? 0 : pwmFreqValue;
      var pwmPin = resolveMicroPythonPinRef(runtime.pwm[mpPwmFreqM[1]].pinRef);
      writePWMValue(pwmPin, runtime.pwm[mpPwmFreqM[1]].duty, 65535, runtime.pwm[mpPwmFreqM[1]].freq);
    }
    return true;
  }

  const mpPwmDutyM = l.match(/^mpPwmDuty\s*\(\s*"(.*?)"\s*,\s*(.+?)\s*\)$/);
  if (mpPwmDutyM) {
    var pwmRuntime = getMicroPythonRuntime();
    if (pwmRuntime.pwm[mpPwmDutyM[1]]) {
      var pwmDutyValue = evaluateMath(mpPwmDutyM[2]);
      if (pwmDutyValue === null) pwmDutyValue = parseFloat(parseValue(mpPwmDutyM[2]));
      pwmRuntime.pwm[mpPwmDutyM[1]].duty = isNaN(pwmDutyValue) ? 0 : pwmDutyValue;
      var pwmTargetPin = resolveMicroPythonPinRef(pwmRuntime.pwm[mpPwmDutyM[1]].pinRef);
      writePWMValue(pwmTargetPin, pwmRuntime.pwm[mpPwmDutyM[1]].duty, 65535, pwmRuntime.pwm[mpPwmDutyM[1]].freq);
    }
    return true;
  }

  const mpPwmDeinitM = l.match(/^mpPwmDeinit\s*\(\s*"(.*?)"\s*\)$/);
  if (mpPwmDeinitM) {
    var deinitRuntime = getMicroPythonRuntime();
    if (deinitRuntime.pwm[mpPwmDeinitM[1]]) {
      var deinitPin = resolveMicroPythonPinRef(deinitRuntime.pwm[mpPwmDeinitM[1]].pinRef);
      writePWMValue(deinitPin, 0, 65535, 0);
      deinitRuntime.pwm[mpPwmDeinitM[1]].duty = 0;
    }
    return true;
  }

  const mpI2CM = l.match(/^mpI2C\s*\((.*)\)$/);
  if (mpI2CM) {
    var i2cCallArgs = splitCallArguments(mpI2CM[1]);
    if (i2cCallArgs.length >= 5) {
      registerMicroPythonI2C(
        unquoteToken(i2cCallArgs[0]),
        i2cCallArgs[1],
        i2cCallArgs[2],
        i2cCallArgs[3],
        i2cCallArgs[4]
      );
    }
    return true;
  }

  const mpSSD1306M = l.match(/^mpSSD1306\s*\((.*)\)$/);
  if (mpSSD1306M) {
    var oledCallArgs = splitCallArguments(mpSSD1306M[1]);
    if (oledCallArgs.length >= 4) {
      registerMicroPythonSSD1306(
        unquoteToken(oledCallArgs[0]),
        oledCallArgs[1],
        oledCallArgs[2],
        oledCallArgs[3],
        oledCallArgs[4]
      );
    }
    return true;
  }

  const mpDHTCtor = l.match(/^mpDHT\s*\(\s*"(.*?)"\s*,\s*(.+?)\s*,\s*"(DHT11|DHT21|DHT22)"\s*\)$/i);
  if (mpDHTCtor) {
    registerMicroPythonDHT(
      mpDHTCtor[1],
      mpDHTCtor[2],
      String(mpDHTCtor[3]).toUpperCase()
    );
    return true;
  }

  const mpDHTMeasureM = l.match(/^mpDHTMeasure\s*\(\s*"(.*?)"\s*\)$/);
  if (mpDHTMeasureM) {
    resolveMicroPythonDHTMeasure(mpDHTMeasureM[1]);
    return true;
  }

  const mpDHTTempM = l.match(/^mpDHTTemperature\s*\(\s*"(.*?)"\s*\)$/);
  if (mpDHTTempM) {
    resolveMicroPythonDHTTemperature(mpDHTTempM[1]);
    return true;
  }

  const mpDHTHumM = l.match(/^mpDHTHumidity\s*\(\s*"(.*?)"\s*\)$/);
  if (mpDHTHumM) {
    resolveMicroPythonDHTHumidity(mpDHTHumM[1]);
    return true;
  }

  const mpPinWriteM = l.match(/^mpPinWrite\s*\(\s*"(.*?)"\s*,\s*(.+?)\s*\)$/);
  if (mpPinWriteM) {
    writeDigitalPinValue(resolveMicroPythonPinRef(mpPinWriteM[1]), evaluateBooleanLikeExpression(mpPinWriteM[2]));
    return true;
  }

  const dwM = l.match(/^digitalWrite\s*\(\s*(.+?)\s*,\s*(HIGH|LOW|1|0|true|false|\w+)\s*\)$/i);
  if (dwM) {
    const pin = resolvePin(dwM[1]);
    if (pin !== null) {
      const val = dwM[2] === 'HIGH' || dwM[2] === '1' || dwM[2] === 'true'
        ? true
        : dwM[2] === 'LOW' || dwM[2] === '0' || dwM[2] === 'false'
          ? false
          : !!variables[dwM[2]];

      writeDigitalPinValue(pin, val);
    }
    return true;
  }

  //Digital Read
  const drM = l.match(/^(?:(?:int|bool|byte)\s+)?(\w+)\s*=\s*digitalRead\s*\(\s*(.+?)\s*\)$/i);
  if (drM) {
    const pin = resolvePin(drM[2]);
    variables[drM[1]] = pin !== null ? readDigitalPinValue(pin) : 0;
    return true;
  }

  const pulseM = l.match(/^(?:(?:unsigned\s+long|long|int|float)\s+)?(\w+)\s*=\s*pulseIn\s*\(\s*(.+?)\s*,\s*\w+\s*\)$/i);
  if (pulseM) {
    const pin = resolvePin(pulseM[2]);
    variables[pulseM[1]] = pin !== null ? getUltrasonicPulseDuration(pin, 1) : 0;
    return true;
  }

  const arM = l.match(/^(?:(?:int|float|long)\s+)?(\w+)\s*=\s*analogRead\s*\(\s*(.+?)\s*\)$/i);
  if (arM) {
    const pin = resolvePin(arM[2]);
    variables[arM[1]] = pin !== null ? readAnalogPinValue(pin, 4095) : 0;
    return true;
  }

  const awM = l.match(/^(?:analogWrite|ledcWrite)\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)$/i);
  if (awM) {
    const pin = resolvePin(awM[1]);
    if (pin !== null) {
      const val = parseFloat(parseValue(awM[2]));
      writePWMValue(pin, val, 255, 50);
    }
    return true;
  }

  const toneM = l.match(/^tone\s*\(\s*(.+?)\s*,\s*(.+?)(?:\s*,\s*.+?)?\s*\)$/i);
  if (toneM) {
    const pin = resolvePin(toneM[1]);
    if (pin !== null) {
      var toneFreq = evaluateMath(toneM[2]);
      if (toneFreq === null) toneFreq = parseFloat(parseValue(toneM[2]));
      applyBuzzerState(pin, true, toneFreq);
    }
    return true;
  }

  const noToneM = l.match(/^noTone\s*\(\s*(.+?)\s*\)$/i);
  if (noToneM) {
    const pin = resolvePin(noToneM[1]);
    if (pin !== null) {
      applyBuzzerState(pin, false, 0);
    }
    return true;
  }

  const varDecl = l.match(/^(?:(?:const\s+)?(?:int|float|long|byte|double|String|unsigned\s+long|bool|char)\s+)?(\w+)\s*([+\-*\/]?=)\s*(.+)$/);
  if (varDecl) {
    const vname = varDecl[1];
    const op = varDecl[2];
    const rhs = varDecl[3].replace(/;$/, '').trim();
    const resolvedRhs = resolveSimulatorRuntimeCalls(rhs);

    if (['if', 'else', 'while', 'for', 'return', 'void', 'int', 'float', 'bool'].includes(vname)) return true;

    if (typeof libraryRegistry !== 'undefined') {
      const mc = libraryRegistry.parseMethodCall(l);
      if (mc) {
        try {
          const resolvedArgs = mc.args.map(resolveLibraryArgValue);
          const result = mc.instance[mc.methodName](...resolvedArgs);
          if (mc.resultVariable) variables[mc.resultVariable] = result;
        } catch (e) {}
        return true;
      }
    }

    if (resolvedRhs === 'NaN') {
      if (op === '+=') variables[vname] = String(variables[vname] || '') + 'NaN';
      else variables[vname] = NaN;
      return true;
    }

    const mathResult = evaluateMath(resolvedRhs);
    if (mathResult !== null) {
      if (op === '+=') variables[vname] = (variables[vname] || 0) + mathResult;
      else if (op === '-=') variables[vname] = (variables[vname] || 0) - mathResult;
      else if (op === '*=') variables[vname] = (variables[vname] || 0) * mathResult;
      else if (op === '/=') variables[vname] = mathResult !== 0 ? (variables[vname] || 0) / mathResult : 0;
      else variables[vname] = mathResult;
    } else {
      const litVal = evaluateLiteral(resolvedRhs);
      if (op === '+=') variables[vname] = String(variables[vname] || '') + String(litVal);
      else variables[vname] = litVal;
    }
    return true;
  }

  if (typeof libraryRegistry !== 'undefined') {
    const mc = libraryRegistry.parseMethodCall(l);
    if (mc) {
      try {
        const resolvedArgs = mc.args.map(resolveLibraryArgValue);
        mc.instance[mc.methodName](...resolvedArgs);
      } catch (e) {}
      return true;
    }
  }

  const swM = l.match(/^(\w+)\.write\s*\(\s*(.+?)\s*\)$/);
  if (swM) {
    const inst = typeof libraryRegistry !== 'undefined' ? libraryRegistry.getInstance(swM[1]) : null;
    if (inst && inst._isServo) {
      const angle = parseFloat(parseValue(swM[2]));
      if (!isNaN(angle) && inst._comp) inst._comp.state.angle = Math.max(0, Math.min(180, angle));
    }
    return true;
  }

  return true;
}

// ==========================================
// SERIAL MONITOR
// ==========================================

function addSerialMessage(msg, newLine) {
  var out = document.getElementById('serial-output');
  if (!out) return;

  if (newLine) {
    serialLineBuffer += msg;
    var line = document.createElement('div');
    line.className = 'serial-line';
    line.textContent = '> ' + serialLineBuffer;
    out.appendChild(line);
    serialLineBuffer = '';
    out.scrollTop = out.scrollHeight;
  } else {
    serialLineBuffer += msg;
  }
}

function sendSerial() {
  var inp = document.getElementById('serial-input');
  if (!inp) return;
  var val = inp.value.trim();
  if (!val) return;

  for (var i = 0; i < val.length; i++) serialRxBuffer.push(val[i]);
  serialRxBuffer.push('\n');

  var out = document.getElementById('serial-output');
  if (out) {
    var line = document.createElement('div');
    line.className = 'serial-line serial-sent';
    line.textContent = '< ' + val;
    out.appendChild(line);
    out.scrollTop = out.scrollHeight;
  }

  inp.value = '';
}

function toggleSerial() {
  var mon = document.getElementById('serial-monitor');
  if (!mon) return;
  mon.classList.toggle('visible');
}
