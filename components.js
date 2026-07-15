// ==========================================
// COMPONENT CREATION - components.js
// ==========================================

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
let paletteVisible = true
let resizeTimeout = null;

// ==========================================
// HELPERS
// ==========================================

function queueResize(delay) {
  if (resizeTimeout) clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(function() {
    resizeCanvas();
    resizeTimeout = null;
  }, delay || 80);
}

function getMCUComponents() {
  return components.filter(function(c) {
    return c.type === 'esp32' || c.type === 'pico';
  });
}

function updateWireEndpointsFromPins() {
  wires.forEach(function(w) {
    var p1 = findPinById(w.pin1Id);
    var p2 = findPinById(w.pin2Id);
    if (p1) { w.x1 = p1.x; w.y1 = p1.y; }
    if (p2) { w.x2 = p2.x; w.y2 = p2.y; }
  });
}

function getComponentBounds(comp) {
  var w = comp.width || 30;
  var h = comp.height || 30;

  if (comp.type === 'esp32' || comp.type === 'pico') {
    return {
      left: comp.x,
      top: comp.y,
      right: comp.x + w,
      bottom: comp.y + h,
      width: w,
      height: h
    };
  }

  return {
    left: comp.x - w / 2,
    top: comp.y - h / 2,
    right: comp.x + w / 2,
    bottom: comp.y + h / 2,
    width: w,
    height: h
  };
}

function applyPaletteUIState() {
  var paletteBody = document.getElementById('palette-body');
  var palette = document.getElementById('component-palette');
  var arrow = document.getElementById('palette-arrow');
  var openLabel = document.getElementById('palette-open-label');

  if (paletteBody) {
    paletteBody.classList.toggle('closed', !paletteVisible);
  } else if (palette) {
    palette.classList.toggle('collapsed', !paletteVisible);
  }

  if (arrow) {
    arrow.textContent = paletteVisible ? '▾' : '▸';
    arrow.style.transform = paletteVisible ? 'rotate(0deg)' : 'rotate(-90deg)';
  }

  if (openLabel) {
    openLabel.style.display = paletteVisible ? 'none' : '';
  }
}

// ==========================================
// RESIZE OBSERVER
// ==========================================

if (container) {
  if (window.ResizeObserver) {
    var resizeObserver = new ResizeObserver(function() {
      queueResize(50);
    });
    resizeObserver.observe(container);
  }

  window.addEventListener('resize', function() {
    queueResize(120);
  });
}

// ==========================================
// UI ACTIONS
// ==========================================

function togglePalette() {
  paletteVisible = !paletteVisible;
  applyPaletteUIState();
  setTimeout(function() {
    resizeCanvas();
  }, 300);
}

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

var canvasLogicalWidth = 0;
var canvasLogicalHeight = 0;

function resizeCanvas() {
  if (!canvas || !container || !ctx) return;

  var zoom = window.zoomLevel || 1;
  var dpr = window.devicePixelRatio || 1;
  var containerRect = container.getBoundingClientRect();
  var containerWidth = containerRect.width;
  var containerHeight = containerRect.height;

  if (containerWidth < 10 || containerHeight < 10) {
    return;
  }

  var newW = Math.max(containerWidth / zoom, 100);
  var newH = Math.max(containerHeight / zoom, 100);

  if (Math.abs(canvasLogicalWidth - newW) < 1 && Math.abs(canvasLogicalHeight - newH) < 1) {
    if (typeof syncSparkCanvas === 'function') syncSparkCanvas();
    return;
  }

  canvasLogicalWidth = Math.round(newW);
  canvasLogicalHeight = Math.round(newH);

  var displayWidth = Math.round(containerWidth);
  var displayHeight = Math.round(containerHeight);

  var pixelW = Math.round(displayWidth * dpr);
  var pixelH = Math.round(displayHeight * dpr);

  canvas.width = pixelW;
  canvas.height = pixelH;
  canvas.style.width = displayWidth + 'px';
  canvas.style.height = displayHeight + 'px';

  var scaleX = pixelW / canvasLogicalWidth;
  var scaleY = pixelH / canvasLogicalHeight;
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

  updateWireEndpointsFromPins();

  if (typeof syncSparkCanvas === 'function') syncSparkCanvas();

  setTimeout(function() {
    fixOffscreenComponents();
  }, 10);

  if (typeof draw === 'function') draw();
}

function addComponent(type) {
 if (!canvas || canvasLogicalWidth === 0 || canvasLogicalHeight === 0) {
    setTimeout(function() {
      addComponent(type);
    }, 100);
    return;
  }

  if (type === 'esp32' || type === 'pico') {
    var existingMCUs = getMCUComponents();
    if (existingMCUs.length > 0) {
      if (typeof showConnAlert === 'function') {
        showConnAlert('Only one microcontroller can be placed at a time. Delete the current board first.');
      }
      updateStatus('Only one microcontroller allowed');
      return;
    }
  }

  saveState();

 var margin = 100;
  var minX = margin;
  var maxX = canvasLogicalWidth - margin;
  var minY = margin;
  var maxY = canvasLogicalHeight - margin;

  if (canvasLogicalWidth < margin * 2) {
    minX = 20;
    maxX = canvasLogicalWidth - 20;
  }

  if (canvasLogicalHeight < margin * 2) {
    minY = 20;
    maxY = canvasLogicalHeight - 20;
  }

var cx = Math.round(Math.min(maxX, Math.max(minX, canvasLogicalWidth / 2 + (Math.random() - 0.5) * 120)));
var cy = Math.round(Math.min(maxY, Math.max(minY, canvasLogicalHeight / 2 + (Math.random() - 0.5) * 80)));

if (type === 'esp32' || type === 'pico') {
  cy = Math.round(Math.min(maxY - 210, Math.max(minY, canvasLogicalHeight / 2 - 100)));
}

  var comp = null;

  if      (type === 'esp32')      comp = createESP32(cx, cy);
  else if (type === 'pico')       comp = createPico(cx, cy);
  else if (type === 'led_red')    comp = createLED(cx, cy, '#ff3344', 'Red');
  else if (type === 'led_green')  comp = createLED(cx, cy, '#22dd55', 'Green');
  else if (type === 'led_blue')   comp = createLED(cx, cy, '#3399ff', 'Blue');
  else if (type === 'led_yellow') comp = createLED(cx, cy, '#ffdd00', 'Yellow');
  else if (type === 'ultrasonic') comp = createUltrasonic(cx, cy);
  else if (type === 'dht')        comp = createDHT22(cx, cy);
  else if (type === 'pir')        comp = createPIR(cx, cy);
  else if (type === 'ldr')        comp = createLDR(cx, cy);
  else if (type === 'servo')      comp = createServo(cx, cy);
  else if (type === 'button')     comp = createButton(cx, cy);
  else if (type === 'joystick')   comp = createJoystick(cx, cy);
  else if (type === 'ky004')      comp = createKY004(cx, cy);
  else if (type === 'sw420')      comp = createSW420(cx, cy);
  else if (type === 'flame')      comp = createFlame(cx, cy);
  else if (type === 'ky032')      comp = createKY032(cx, cy);
  else if (type === 'buzzer')     comp = createBuzzer(cx, cy);
  else if (type === 'ssd1306')    comp = createSSD1306(cx, cy);

  if (!comp) {
    updateStatus('Unknown component: ' + type);
    return;
  }

  components.push(comp);
  updateStatus('Added: ' + type.replace(/_/g, ' '));

  setTimeout(function() {
    fixOffscreenComponents();
    if (typeof draw === 'function') draw();
  }, 10);
}

function mkId() {
  return 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function clearAll() {
  saveState();
  components = [];
  wires = [];
  wireStart = null;
  updateStatus('Cleared');
  if (typeof draw === 'function') draw();
}

function updateStatus(msg) {
  var el = document.getElementById('status');
  if (el) el.textContent = msg;
}

function setTool(t) {
  tool = t;
  wireStart = null;

  document.querySelectorAll('#toolbar .btn').forEach(function(b) {
    b.classList.remove('active');
  });

  var btn = document.getElementById('btn-' + t);
  if (btn) btn.classList.add('active');

  updateStatus('Tool: ' + t.toUpperCase());
  if (typeof draw === 'function') draw();
}

function fixOffscreenComponents() {
  if (!canvas || canvasLogicalWidth === 0 || canvasLogicalHeight === 0) return false;

  var anyFixed = false;
  var mcu = getMCUComponents()[0] || null;
  var mcuBounds = mcu ? getComponentBounds(mcu) : null;

  components.forEach(function(comp) {
    var bounds = getComponentBounds(comp);
    var compW = bounds.width;
    var compH = bounds.height;

    var isOffscreen =
      bounds.right < 0 ||
      bounds.left > canvasLogicalWidth ||
      bounds.bottom < 0 ||
      bounds.top > canvasLogicalHeight;

    if (!isOffscreen) return;

    anyFixed = true;

    var newX;
    var newY;

    if (comp.type === 'esp32' || comp.type === 'pico') {
      newX = Math.max(20, Math.min(canvasLogicalWidth - compW - 20, canvasLogicalWidth / 2 - compW / 2));
      newY = Math.max(20, Math.min(canvasLogicalHeight - compH - 20, canvasLogicalHeight / 2 - compH / 2 + 50));
    } else {
      if (mcuBounds && (mcuBounds.right + compW + 60) < canvasLogicalWidth) {
        newX = mcuBounds.right + 40 + compW / 2;
        newY = Math.max(compH / 2 + 20, Math.min(canvasLogicalHeight - compH / 2 - 20, mcu.y + 100));
      } else if (mcuBounds) {
        newX = Math.max(compW / 2 + 20, Math.min(canvasLogicalWidth - compW / 2 - 20, mcuBounds.left + 60));
        newY = Math.max(compH / 2 + 20, Math.min(canvasLogicalHeight - compH / 2 - 20, mcuBounds.bottom + 50));
      } else {
        newX = Math.max(compW / 2 + 20, Math.min(canvasLogicalWidth - compW / 2 - 20, canvasLogicalWidth / 2 + 80));
        newY = Math.max(compH / 2 + 20, Math.min(canvasLogicalHeight - compH / 2 - 20, canvasLogicalHeight / 2));
      }
    }

    var dx = newX - comp.x;
    var dy = newY - comp.y;

    comp.x = newX;
    comp.y = newY;

    if (comp.pins) {
      comp.pins.forEach(function(pin) {
        pin.x += dx;
        pin.y += dy;
      });
    }
  });

  if (anyFixed) {
    updateWireEndpointsFromPins();
    if (typeof draw === 'function') draw();
  }

  return anyFixed;
}

// ==========================================
// MICROCONTROLLERS
// ==========================================

function createESP32(x, y) {
  var c = {
    id: mkId(),
    type: 'esp32',
    x: x,
    y: y,
    width: 180,
    height: 420,
    pins: [],
    state: {}
  };

  var LS = ['3V3', 'GND', 'D15', 'D2', 'D4', 'RX2', 'TX2', 'D5', 'D18', 'D19', 'D21', 'RX0', 'TX0', 'D22', 'D23'];
  var RS = ['VIN', 'GND2', 'D13', 'D12', 'D14', 'D27', 'D26', 'D25', 'D33', 'D32', 'D35', 'D34', 'VN', 'VP', 'EN'];

  LS.forEach(function(n, i) {
    var type = 'gpio';
    var color = '#3ddc84';

    if (n === '3V3') {
      type = 'power';
      color = '#ff5566';
    } else if (n === 'GND') {
      type = 'gnd';
      color = '#8b7355';
    } else if (n.indexOf('TX') >= 0 || n.indexOf('RX') >= 0) {
      type = 'uart';
      color = '#22d3ee';
    }

    c.pins.push({
      name: n,
      side: 'left',
      index: i,
      x: x,
      y: y + 60 + i * 23,
      type: type,
      color: color
    });
  });

  RS.forEach(function(n, i) {
    var type = 'gpio';
    var color = '#3ddc84';

    if (n === 'VIN') {
      type = 'power';
      color = '#ff5566';
     } else if (n === 'GND2') {
      type = 'gnd';
      color = '#8b7355';
    } else if (n === 'EN') {
      type = 'en';
      color = '#ffcc44';
    } else if (n === 'VP' || n === 'VN') {
      type = 'analog';
      color = '#a78bfa';
    }

    c.pins.push({
      name: n,
      side: 'right',
      index: i,
      x: x + c.width,
      y: y + 60 + i * 23,
      type: type,
      color: color
    });
  });

  return c;
}

function createPico(x, y) {
  var c = {
    id: mkId(),
    type: 'pico',
    x: x,
    y: y,
    width: 160,
    height: 460,
    pins: [],
    state: {}
  };

  var LP = [
  'GP0', 'GP1', 'GND_0', 'GP2', 'GP3',
  'GP4', 'GP5', 'GND_1', 'GP6', 'GP7',
  'GP8', 'GP9', 'GND_2', 'GP10', 'GP11',
  'GP12', 'GP13', 'GND_3', 'GP14', 'GP15'
  ];

  var RP = [
    'VBUS', 'VSYS', 'GND_4', '3V3_EN', '3V3',
    'ADC_VREF', 'GP28', 'AGND', 'GP27', 'GP26',
    'RUN', 'GP22', 'GND_5', 'GP21', 'GP20',
    'GP19', 'GP18', 'GND_6', 'GP17', 'GP16'
  ];

  LP.forEach(function(n, i) {
    var type = 'gpio';
    var color = '#3ddc84';

    if (n.startsWith('GND')) {
      type = 'gnd';
      color = '#8b7355';
    }

    c.pins.push({
      name: n,
      side: 'left',
      index: i,
      x: x,
      y: y + 55 + i * 19,
      type: type,
      color: color
    });
  });

  RP.forEach(function(n, i) {
    var type = 'gpio';
    var color = '#3ddc84';

    if (n.startsWith('GND') || n === 'AGND') {
      type = 'gnd';
      color = '#8b7355';
    } else if (n === 'VBUS' || n === 'VSYS' || n === '3V3') {
      type = 'power';
      color = '#ff5566';
    } else if (n === '3V3_EN' || n === 'RUN') {
      type = 'en';
      color = '#ffcc44';
    } else if (n === 'ADC_VREF' || n === 'GP26' || n === 'GP27' || n === 'GP28') {
      type = 'analog';
      color = '#a78bfa';
    }

    c.pins.push({
      name: n,
      side: 'right',
      index: i,
      x: x + c.width,
      y: y + 55 + i * 19,
      type: type,
      color: color
    });
  });

  return c;
}

// ==========================================
// LIGHTS
// ==========================================

function createLED(x, y, color, label) {
  var c = {
    id: mkId(),
    type: 'led',
    x: x,
    y: y,
    width: 20,
    height: 80,
    pins: [],
    state: {
      on: false,
      color: color,
      label: label
    }
  };

  c.pins.push({ name: '+', x: x, y: y - 10, side: 'bottom', type: 'gpio', color: '#3ddc84' });
  c.pins.push({ name: '-', x: x, y: y + 10, side: 'bottom', type: 'gnd', color: '#8b7355' });

  return c;
}

// ==========================================
// SENSORS
// ==========================================

function createUltrasonic(x, y) {
  var c = {
    id: mkId(),
    type: 'ultrasonic',
    x: x,
    y: y,
    width: 110,
    height: 110,
    pins: [],
    state: { distance: 50 },
    _slider: { x: 0, y: 0, w: 80, h: 7, knobX: 0, knobY: 0, knobR: 10 }
  };

  c.pins.push({ name: 'VCC',  x: x - 38, y: y - 18, side: 'left', type: 'power', color: '#ff5566' });
  c.pins.push({ name: 'Trig', x: x - 38, y: y - 4,  side: 'left', type: 'gpio', color: '#3ddc84' });
  c.pins.push({ name: 'Echo', x: x - 38, y: y + 10, side: 'left', type: 'gpio', color: '#3ddc84' });
  c.pins.push({ name: 'GND',  x: x - 38, y: y + 24, side: 'left', type: 'gnd', color: '#8b7355' });

  return c;
}

function createDHT22(x, y) {
  var c = {
    id: mkId(),
    type: 'dht',
    x: x,
    y: y,
    width: 84,
    height: 120,
    pins: [],
    state: { temperature: 25.0, humidity: 55 },
    _tempSlider: { x: 0, y: 0, w: 6, h: 50, knobX: 0, knobY: 0, knobR: 8 },
    _humSlider:  { x: 0, y: 0, w: 6, h: 50, knobX: 0, knobY: 0, knobR: 8 }
  };

  c.pins.push({ name: 'VCC',  label: '+',   x: x - 14, y: y + 48, side: 'bottom', type: 'power', color: '#ff5566' });
  c.pins.push({ name: 'Data', label: 'OUT', x: x,      y: y + 48, side: 'bottom', type: 'gpio',  color: '#3ddc84' });
  c.pins.push({ name: 'GND',  label: '-',   x: x + 14, y: y + 48, side: 'bottom', type: 'gnd',   color: '#8b7355' });

  return c;
}

function createPIR(x, y) {
  var c = {
    id: mkId(),
    type: 'pir',
    x: x,
    y: y,
    width: 96,
    height: 110,
    pins: [],
    state: { motion: false }
  };

  c.pins.push({ name: 'GND', x: x - 18, y: y + 44, side: 'bottom', type: 'gnd',   color: '#8b7355', hitRadius: 13 });
  c.pins.push({ name: 'OUT', x: x,      y: y + 44, side: 'bottom', type: 'gpio',  color: '#3ddc84', hitRadius: 13 });
  c.pins.push({ name: 'VCC', x: x + 18, y: y + 44, side: 'bottom', type: 'power', color: '#ff5566', hitRadius: 13 });

  return c;
}

function createLDR(x, y) {
  var c = {
    id: mkId(),
    type: 'ldr',
    x: x,
    y: y,
    width: 30,
    height: 84,
    pins: [],
    state: { light: 2000 },
    _slider: { x: 0, y: 0, w: 40, h: 4, knobX: 0, knobY: 0, knobR: 7 }
  };

  c.pins.push({ name: 'S',   x: x - 18, y: y + 34, side: 'bottom', type: 'analog', color: '#a78bfa' });
  c.pins.push({ name: 'VCC', x: x,      y: y + 34, side: 'bottom', type: 'power',  color: '#ff5566' });
  c.pins.push({ name: 'GND', x: x + 18, y: y + 34, side: 'bottom', type: 'gnd',    color: '#8b7355' });

  return c;
}

function createButton(x, y) {
  var c = {
    id: mkId(),
    type: 'button',
    x: x,
    y: y,
    width: 40,
    height: 44,
    pins: [],
    state: { pressed: false }
  };

  c.pins.push({ name: 'P1', x: x - 12, y: y - 27, side: 'top', type: 'gpio', color: '#3ddc84' });
  c.pins.push({ name: 'P2', x: x + 12, y: y - 27, side: 'top', type: 'gnd', color: '#8b7355' });

  return c;
}

function createJoystick(x, y) {
  var c = {
    id: mkId(),
    type: 'joystick',
    x: x,
    y: y,
    width: 130,
    height: 159,
    pins: [],
    state: { vx: 2048, vy: 2048, sw: false },
    _xSlider: { x: 0, y: 0, w: 60, h: 5, knobX: 0, knobY: 0, knobR: 8 },
    _ySlider: { x: 0, y: 0, w: 60, h: 5, knobX: 0, knobY: 0, knobR: 8 }
  };

  c.pins.push({ name: 'GND', x: x - 65, y: y - 25, side: 'left', type: 'gnd', color: '#8b7355' });
  c.pins.push({ name: 'VCC', x: x - 65, y: y - 12, side: 'left', type: 'power', color: '#ff5566' });
  c.pins.push({ name: 'VRX', x: x - 65, y: y + 1,  side: 'left', type: 'analog', color: '#a78bfa' });
  c.pins.push({ name: 'VRY', x: x - 65, y: y + 14, side: 'left', type: 'analog', color: '#38d8ea' });
  c.pins.push({ name: 'SW',  x: x - 65, y: y + 27, side: 'left', type: 'gpio', color: '#3ddc84' });

  return c;
}

function createKY004(x, y) {
  var c = {
    id: mkId(),
    type: 'ky004',
    x: x,
    y: y,
    width: 48,
    height: 85,
    pins: [],
    state: { pressed: false }
  };
 
 
  c.pins.push({name: 'S',x: x - 18,y: y + 26,side: 'bottom',type: 'gpio',color: '#3ddc84'});
  c.pins.push({name: 'VCC',x: x,y: y + 26,side: 'bottom',type: 'power',color: '#ff5566' });
  c.pins.push({name: 'GND',x: x + 18,y: y + 26,side: 'bottom',type: 'gnd',color: '#8b7355'});
 
  return c;
}

function createSW420(x, y) {
  var c = {
    id: mkId(),
    type: 'sw420',
    x: x,
    y: y,
    width: 40,
    height: 130,
    pins: [],
    state: { triggered: false }
  };

  c.pins.push({ name: 'DO',  x: x - 18, y: y + 38, side: 'bottom', type: 'gpio',  color: '#3ddc84' });
  c.pins.push({ name: 'GND', x: x,      y: y + 38, side: 'bottom', type: 'gnd',   color: '#8b7355' });
  c.pins.push({ name: 'VCC', x: x + 18, y: y + 38, side: 'bottom', type: 'power', color: '#ff5566' });

  return c;
}

function createFlame(x, y) {
  var c = {
    id: mkId(),
    type: 'flame',
    x: x,
    y: y,
    width: 56,
    height: 105,
    pins: [],
    state: { detected: false, analog: 4095 },
    _slider: { x: 0, y: 0, w: 4, h: 50, knobX: 0, knobY: 0, knobR: 8 }
  };

  c.pins.push({ name: 'AO',  x: x - 18, y: y + 26, side: 'bottom', type: 'analog', color: '#a78bfa' });
  c.pins.push({ name: 'DO',  x: x,      y: y + 26, side: 'bottom', type: 'gpio',   color: '#3ddc84' });
  c.pins.push({ name: 'GND', x: x + 18, y: y + 26, side: 'bottom', type: 'gnd',    color: '#8b7355' });
  c.pins.push({ name: 'VCC', x: x + 36, y: y + 26, side: 'bottom', type: 'power',  color: '#ff5566' });

  return c;
}

function createKY032(x, y) {
  var c = {
    id: mkId(),
    type: 'ky032',
    x: x,
    y: y,
    width: 52,
    height: 130,
    pins: [],
    state: { detected: false },  
    _beam: { phase: 0 }
  };

  c.pins.push({ name: 'EN',  x: x - 21, y: y + 55, side: 'bottom', type: 'gpio',  color: '#ffcc44' });
  c.pins.push({ name: 'VCC', x: x -  7, y: y + 55, side: 'bottom', type: 'power', color: '#ff5566' });
  c.pins.push({ name: 'OUT', x: x +  7, y: y + 55, side: 'bottom', type: 'gpio',  color: '#3ddc84' });
  c.pins.push({ name: 'GND', x: x + 21, y: y + 55, side: 'bottom', type: 'gnd',   color: '#8b7355' });

  return c;
}
// ==========================================
// OUTPUT
// ==========================================

function createServo(x, y) {
  var c = {
    id: mkId(),
    type: 'servo',
    x: x,
    y: y,
    width: 190,
    height: 130,
    pins: [],
    state: { angle: 90 },
    _servoSlider: { x: 0, y: 0, w: 100, h: 5, knobX: 0, knobY: 0, knobR: 9 }
  };

  c.pins.push({ name: 'PWM', x: x, y: y, side: 'left', type: 'pwm',   color: '#dd7700' });
  c.pins.push({ name: 'VCC', x: x, y: y, side: 'left', type: 'power', color: '#cc2222' });
  c.pins.push({ name: 'GND', x: x, y: y, side: 'left', type: 'gnd',   color: '#8b7355' });

  return c;
}

function createBuzzer(x, y) {
  var c = {
    id: mkId(),
    type: 'buzzer',
    x: x,
    y: y,
    width: 40,
    height: 35,
    pins: [],
    state: { playing: false }
  };

  c.pins.push({ name: '+', x: x - 16, y: y, side: 'left', type: 'gpio', color: '#3ddc84' });
  c.pins.push({ name: '-', x: x + 16, y: y, side: 'right', type: 'gnd', color: '#8b7355' });

  return c;
}

function createSSD1306(x, y) {
  var c = {
    id: mkId(),
    type: 'ssd1306',
    x: x,
    y: y,
    width: 120,
    height: 80,
    pins: [],
    state: {
      display: Array.from({ length: 8 }, function() {
        return Array.from({ length: 128 }, function() {
          return 0;
        });
      })
    }
  };

  c.pins.push({ name: 'GND', x: x - 52, y: y - 40, side: 'top', type: 'gnd', color: '#8b7355' });
  c.pins.push({ name: 'VCC', x: x - 12, y: y - 40, side: 'top', type: 'power', color: '#ff5566' });
  c.pins.push({ name: 'SCL', x: x + 12, y: y - 40, side: 'top', type: 'i2c', color: '#ffcc44' });
  c.pins.push({ name: 'SDA', x: x + 36, y: y - 40, side: 'top', type: 'i2c', color: '#3ddc84' });

  return c;
}

// ==========================================
// STARTUP
// ==========================================

window.togglePalette = togglePalette;

document.addEventListener('DOMContentLoaded', function() {
  window.togglePalette = togglePalette;
  applyPaletteUIState();
  setTimeout(function() {
    resizeCanvas();
    fixOffscreenComponents();
    if (typeof draw === 'function') draw();
  }, 80);
});

setTimeout(function() {
  window.togglePalette = togglePalette;
  applyPaletteUIState();
  fixOffscreenComponents();
  if (typeof draw === 'function') draw();
}, 200);
