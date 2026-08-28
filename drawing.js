// ==========================================
// DRAWING FUNCTIONS - drawing.js
// ==========================================

// ==========================================
// WIRE SPARK SYSTEM
// ==========================================
var _sparks = [];
var _sparkAnimating = false;
var _tooltipInitialized = false;

function spawnSpark(x, y, color) {
  var sc = document.getElementById('spark-canvas');
  if (!sc || !canvas) return;

  var zoom = window.zoomLevel || 1;
  var sx = x * zoom;
  var sy = y * zoom;

  var count = 10 + Math.floor(Math.random() * 8);
  for (var i = 0; i < count; i++) {
    var angle = Math.random() * Math.PI * 2;
    var speed = 1.5 + Math.random() * 3.5;

    _sparks.push({
      x: sx,
      y: sy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      decay: 0.06 + Math.random() * 0.08,
      r: 1.5 + Math.random() * 2.5,
      color: color || '#4d9fff'
    });
  }

  if (_sparks.length > 300) {
    _sparks.splice(0, _sparks.length - 300);
  }

  if (!_sparkAnimating) _animateSparks();
}

function _animateSparks() {
  var sc = document.getElementById('spark-canvas');
  if (!sc) return;

  var sctx = sc.getContext('2d');
  if (!sctx) return;

  if (_sparks.length === 0) {
    _sparkAnimating = false;
    sctx.clearRect(0, 0, sc.width, sc.height);
    return;
  }

  _sparkAnimating = true;
  sctx.clearRect(0, 0, sc.width, sc.height);

  for (var i = _sparks.length - 1; i >= 0; i--) {
    var sp = _sparks[i];

    sp.x += sp.vx;
    sp.y += sp.vy;
    sp.vy += 0.12;
    sp.life -= sp.decay;
    sp.r *= 0.94;

    if (sp.life <= 0) {
      _sparks.splice(i, 1);
      continue;
    }

    sctx.save();
    sctx.globalAlpha = Math.max(0, sp.life);
    sctx.fillStyle = sp.color;
    sctx.shadowColor = sp.color;
    sctx.shadowBlur = 6;
    sctx.beginPath();
    sctx.arc(sp.x, sp.y, Math.max(0.3, sp.r), 0, Math.PI * 2);
    sctx.fill();
    sctx.restore();
  }

  requestAnimationFrame(_animateSparks);
}

function syncSparkCanvas() {
  var sc = document.getElementById('spark-canvas');
  var cc = document.getElementById('canvas-container');
  if (!sc || !cc) return;

  sc.width = cc.offsetWidth;
  sc.height = cc.offsetHeight;
  sc.style.width = cc.offsetWidth + 'px';
  sc.style.height = cc.offsetHeight + 'px';
}

// ==========================================
// PIN TOOLTIP SYSTEM
// ==========================================
var _pinTooltipEl = null;
var _pinTooltipTarget = null;
var _pinTooltipHoverTimer = null;
var _pinTooltipHideTimer = null;
var _pinTooltipLocked = false;
var _pinTooltipTouchPin = null;

function createPinTooltip() {
  if (_pinTooltipEl) return _pinTooltipEl;

  var el = document.createElement('div');
  el.id = 'pin-tooltip';
  el.style.cssText = [
    'position:absolute',
    'z-index:400',
    'pointer-events:none',
    'min-width:134px',
    'max-width:195px',
    'padding:9px 11px',
    'background:rgba(5,12,22,0.97)',
    'border:1px solid rgba(116,169,221,0.28)',
    'border-radius:11px',
    'box-shadow:0 10px 32px rgba(0,0,0,0.6),0 0 0 1px rgba(94,184,255,0.05)',
    'font-family:JetBrains Mono,monospace',
    'font-size:9px',
    'line-height:1.5',
    'opacity:0',
    'transform:translateY(6px) scale(0.94)',
    'transition:opacity 0.18s ease,transform 0.18s ease',
    'display:none'
  ].join(';');

  var cc = document.getElementById('canvas-container');
  if (cc) cc.appendChild(el);

  _pinTooltipEl = el;
  return el;
}

function _clearPinTooltipTimers() {
  if (_pinTooltipHoverTimer) {
    clearTimeout(_pinTooltipHoverTimer);
    _pinTooltipHoverTimer = null;
  }
  if (_pinTooltipHideTimer) {
    clearTimeout(_pinTooltipHideTimer);
    _pinTooltipHideTimer = null;
  }
}

function hidePinTooltip() {
  if (!_pinTooltipEl) return;

  _clearPinTooltipTimers();
  _pinTooltipEl.style.opacity = '0';
  _pinTooltipEl.style.transform = 'translateY(6px) scale(0.94)';
  _pinTooltipLocked = false;
  _pinTooltipTarget = null;
  _pinTooltipTouchPin = null;

  var el = _pinTooltipEl;
  setTimeout(function() {
    if (el.style.opacity === '0') el.style.display = 'none';
  }, 180);
}

function _isPinWired(comp, pin) {
  if (typeof wires === 'undefined') return false;
  var pid = comp.id + '_' + pin.name;
  return wires.some(function(w) {
    return w.pin1Id === pid || w.pin2Id === pid;
  });
}

function _splitPinReference(pinId) {
  if (typeof pinId !== 'string' || !pinId) return null;

  for (var i = 0; i < components.length; i++) {
    var comp = components[i];
    var prefix = comp.id + '_';
    if (pinId.indexOf(prefix) === 0) {
      return {
        comp: comp,
        pinName: pinId.substring(prefix.length)
      };
    }
  }

  var idx = pinId.lastIndexOf('_');
  if (idx === -1) return null;

  var compId = pinId.substring(0, idx);
  var pinName = pinId.substring(idx + 1);

  for (var j = 0; j < components.length; j++) {
    if (components[j].id === compId) {
      return {
        comp: components[j],
        pinName: pinName
      };
    }
  }

  return null;
}

function _getConnectedTo(comp, pin) {
  if (typeof wires === 'undefined') return null;

  var pid = comp.id + '_' + pin.name;
  for (var i = 0; i < wires.length; i++) {
    var w = wires[i];
    var otherId = null;

    if (w.pin1Id === pid) otherId = w.pin2Id;
    else if (w.pin2Id === pid) otherId = w.pin1Id;

    if (!otherId) continue;

    var parsed = _splitPinReference(otherId);
    if (parsed) {
      return {
        comp: parsed.comp,
        pinName: parsed.pinName
      };
    }
  }

  return null;
}

function findPinNear(mx, my, radius) {
  radius = radius || 14;
  var rSq = radius * radius;

  for (var i = 0; i < components.length; i++) {
    var c = components[i];
    if (!c.pins) continue;

    for (var j = 0; j < c.pins.length; j++) {
      var p = c.pins[j];
      var dx = mx - p.x;
      var dy = my - p.y;
      if (dx * dx + dy * dy < rSq) {
        return { pin: p, comp: c };
      }
    }
  }

  return null;
}

function showPinTooltip(pin, comp, screenX, screenY) {
  var el = createPinTooltip();
  _pinTooltipLocked = true;

  var isWired = _isPinWired(comp, pin);
  var connectedTo = isWired ? _getConnectedTo(comp, pin) : null;

  var typeLabels = {
    gpio: 'Digital GPIO',
    power: 'Power supply',
    gnd: 'Ground (GND)',
    uart: 'UART serial',
    analog: 'Analog (ADC)',
     i2c: 'I²C bus',
    en: 'Enable pin',
    pwm: 'PWM output'
  };

  var compTypeLabel = {
    esp32: 'ESP32',
    pico: 'Pico',
    led: 'LED',
    ultrasonic: 'HC-SR04',
    dht: 'DHT22',
    pir: 'HC-SR501',
    ldr: 'LDR',
    servo: 'Servo',
    button: 'Button',
    joystick: 'Joystick',
    buzzer: 'Buzzer',
    ssd1306: 'OLED'
  };

  var pinNumMatch = pin.name.match(/^(?:D|GP)(\d+)$/i);
  var pinNum = pinNumMatch ? pinNumMatch[1] : null;

  var voltageHint = '';
  if (pin.type === 'power') {
    voltageHint =
      (pin.name === '3V3' || pin.name === '3.3V') ? '3.3V' :
      (pin.name === 'VIN' || pin.name === 'VBUS' || pin.name === 'VSYS') ? '5V' :
      '3.3V';
  }

  var connLabel = '';
  if (connectedTo) {
    var ctLabel = compTypeLabel[connectedTo.comp.type] || connectedTo.comp.type;
    connLabel = ctLabel + ' → ' + connectedTo.pinName;
  }

  var isMobile = ('ontouchstart' in window);
  var hintText = isMobile ? 'Tap elsewhere to close' : 'Click anywhere to close';

  el.innerHTML = [
    '<div style="display:flex;align-items:center;gap:7px;margin-bottom:7px;padding-bottom:6px;border-bottom:1px solid rgba(86,126,164,0.15);">',
      '<div style="width:9px;height:9px;border-radius:50%;flex-shrink:0;background:', pin.color, ';box-shadow:0 0 8px ', pin.color, '99;"></div>',
      '<span style="font-size:13px;font-weight:700;color:#f0f6fc;letter-spacing:0.03em;">', pin.name, '</span>',
      '<span style="margin-left:auto;font-size:8px;font-weight:600;color:#3a5a7a;letter-spacing:0.06em;">', (comp.type || '').toUpperCase(), '</span>',
    '</div>',

    '<div style="display:flex;justify-content:space-between;gap:8px;padding:2px 0;">',
      '<span style="color:#4a6a88;">type</span>',
      '<span style="color:#7a9abb;font-weight:600;">', (typeLabels[pin.type] || pin.type || 'GPIO'), '</span>',
    '</div>',

    pinNum ? [
      '<div style="display:flex;justify-content:space-between;gap:8px;padding:2px 0;">',
        '<span style="color:#4a6a88;">pin #</span>',
        '<span style="color:#7a9abb;font-weight:600;">', pinNum, '</span>',
      '</div>'
    ].join('') : '',

    voltageHint ? [
      '<div style="display:flex;justify-content:space-between;gap:8px;padding:2px 0;">',
        '<span style="color:#4a6a88;">voltage</span>',
        '<span style="color:#ff7788;font-weight:600;">', voltageHint, '</span>',
      '</div>'
    ].join('') : '',

    connectedTo ? [
      '<div style="display:flex;justify-content:space-between;gap:8px;padding:2px 0;">',
        '<span style="color:#4a6a88;">wired to</span>',
        '<span style="color:#5eb8ff;font-weight:600;font-size:8.5px;">', connLabel, '</span>',
      '</div>'
    ].join('') : '',

    '<div style="margin-top:7px;padding-top:6px;border-top:1px solid rgba(86,126,164,0.15);display:flex;align-items:center;gap:6px;color:',
      (isWired ? '#45d9a7' : '#4a6a88'),
      ';font-size:8.5px;font-weight:600;">',
      '<div style="width:6px;height:6px;border-radius:50%;flex-shrink:0;background:',
      (isWired ? '#45d9a7' : '#2a3a4a'),
      ';',
      (isWired ? 'box-shadow:0 0 6px #45d9a799;' : ''),
      '"></div>',
      isWired ? 'Connected' : 'Not connected',
    '</div>',

    '<div style="margin-top:5px;font-size:7.5px;color:#2a4a6a;text-align:center;letter-spacing:0.04em;">',
      hintText,
    '</div>'
  ].join('');

  var cc = document.getElementById('canvas-container');
  var cr = cc
    ? cc.getBoundingClientRect()
    : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

  var ttW = 198;
  var ttH = 160;
  var lx = (screenX - cr.left) + 18;
  var ly = (screenY - cr.top) - 18;

  if (lx + ttW > cr.width - 8) lx = (screenX - cr.left) - ttW - 12;
  if (ly + ttH > cr.height - 8) ly = (screenY - cr.top) - ttH - 8;
  if (lx < 6) lx = 6;
  if (ly < 6) ly = 6;

  el.style.left = lx + 'px';
  el.style.top = ly + 'px';
  el.style.display = 'block';
  el.offsetHeight;
  el.style.opacity = '1';
  el.style.transform = 'translateY(0) scale(1)';
}

function initTooltip() {
  if (_tooltipInitialized) return;

  var c = document.getElementById('simCanvas');
  if (!c) return;

  _tooltipInitialized = true;
  createPinTooltip();

  c.addEventListener('mousemove', function(e) {
    if (dragging) {
      _clearPinTooltipTimers();
      hidePinTooltip();
      return;
    }

    if (_pinTooltipLocked) return;

    var pos = getCanvasXY(e);
    var zoom = window.zoomLevel || 1;
    var hitR = Math.max(13, 20 / zoom);
    var hit = findPinNear(pos.x, pos.y, hitR);

    if (!hit) {
      if (_pinTooltipTarget) {
        _clearPinTooltipTimers();
        _pinTooltipTarget = null;
        _pinTooltipHideTimer = setTimeout(function() {
          hidePinTooltip();
        }, 800);
      }
      return;
    }

    if (_pinTooltipHideTimer) {
      clearTimeout(_pinTooltipHideTimer);
      _pinTooltipHideTimer = null;
    }

    if (hit.pin === _pinTooltipTarget) return;

    _pinTooltipTarget = hit.pin;
    _clearPinTooltipTimers();

    var ex = e.clientX;
    var ey = e.clientY;
    _pinTooltipHoverTimer = setTimeout(function() {
      if (_pinTooltipTarget === hit.pin) {
        showPinTooltip(hit.pin, hit.comp, ex, ey);
      }
    }, 1500);
  });

  c.addEventListener('mouseleave', function() {
    _clearPinTooltipTimers();
    if (_pinTooltipLocked) {
      _pinTooltipHideTimer = setTimeout(hidePinTooltip, 800);
    } else {
      _pinTooltipTarget = null;
    }
  });

  c.addEventListener('mousedown', function() {
    _clearPinTooltipTimers();
    _pinTooltipTarget = null;
    hidePinTooltip();
  });

  c.addEventListener('touchend', function(e) {
    if (e.changedTouches.length !== 1) return;

    var t = e.changedTouches[0];
    var zoom = window.zoomLevel || 1;
    var cc = document.getElementById('canvas-container');
    var cr = cc ? cc.getBoundingClientRect() : { left: 0, top: 0 };
    var mx = (t.clientX - cr.left) / zoom;
    var my = (t.clientY - cr.top) / zoom;

    var hitR = Math.max(18, 28 / zoom);
    var hit = findPinNear(mx, my, hitR);

    if (!hit) {
      if (_pinTooltipLocked) {
        hidePinTooltip();
        e.preventDefault();
      }
      return;
    }

    e.preventDefault();

    if (_pinTooltipLocked && _pinTooltipTouchPin === hit.pin) {
      hidePinTooltip();
      return;
    }

    _pinTooltipTouchPin = hit.pin;
    showPinTooltip(hit.pin, hit.comp, t.clientX, t.clientY);
  }, { passive: false });
}

// ==========================================
// DRAW LOOP
// ==========================================
function getWirePoints(w) {
  return [{ x: w.x1, y: w.y1 }].concat(w.waypoints || []).concat([{ x: w.x2, y: w.y2 }]);
}

function drawWirePath(w) {
  var col = w.color || '#4d9fff';
  var pts = getWirePoints(w);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.strokeStyle = 'rgba(0,0,0,0.38)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();

  ctx.strokeStyle = col;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y);
  ctx.stroke();

  ctx.restore();
}

function updateWireHandles(w) {
  var pts = getWirePoints(w);
  w._handles = [];

  for (var i = 0; i < pts.length - 1; i++) {
    w._handles.push({
      x: (pts[i].x + pts[i + 1].x) / 2,
      y: (pts[i].y + pts[i + 1].y) / 2,
      segIndex: i
    });
  }
}

function drawWireControls(w) {
  var col = w.color || '#4d9fff';

  (w.waypoints || []).forEach(function(wp) {
    ctx.fillStyle = 'rgba(255,255,255,0.86)';
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(wp.x, wp.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  (w._handles || []).forEach(function(h) {
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = col + '88';
    ctx.fillStyle = 'rgba(6,12,20,0.58)';
    ctx.lineWidth = 1;
    ctx.fillRect(-3.5, -3.5, 7, 7);
    ctx.strokeRect(-3.5, -3.5, 7, 7);
    ctx.restore();
  });
}

function drawAllComponents() {
  components.forEach(function(c) {
    if      (c.type === 'esp32')      drawESP32(c);
    else if (c.type === 'pico')       drawPico(c);
    else if (c.type === 'led')        drawLED(c);
    else if (c.type === 'ultrasonic') drawUltrasonic(c);
    else if (c.type === 'dht')        drawDHT22(c);
    else if (c.type === 'pir')        drawPIR(c);
    else if (c.type === 'ldr')        drawLDR(c);
    else if (c.type === 'servo')      drawServo(c);
    else if (c.type === 'button')     drawButton(c);
    else if (c.type === 'joystick')   drawJoystick(c);
    else if (c.type === 'ky004')      drawKY004(c);
    else if (c.type === 'sw420')      drawSW420(c);
    else if (c.type === 'flame')      drawFlame(c);
    else if (c.type === 'ky032')      drawKY032(c);
    else if (c.type === 'buzzer')     drawBuzzer(c);
    else if (c.type === 'ssd1306')    drawSSD1306(c);

    var mcuTypes = ['esp32', 'pico'];
    if (!mcuTypes.includes(c.type) && typeof isComponentWired === 'function' && !isComponentWired(c)) {
      drawNotWiredWarning(c);
    }
  });
}

function draw() {
  if (!ctx || !canvas) return;

  ctx.clearRect(0, 0, canvasLogicalWidth, canvasLogicalHeight);

  ctx.strokeStyle = 'rgba(255,255,255,0.025)';
  ctx.lineWidth = 0.5;

  for (var gx = 0; gx < canvasLogicalWidth; gx += 24) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, canvasLogicalHeight);
    ctx.stroke();
  }

  for (var gy = 0; gy < canvasLogicalHeight; gy += 24) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(canvasLogicalWidth, gy);
    ctx.stroke();
  }

  wires.forEach(function(w) {
    if (typeof syncWireEndpoints === 'function') syncWireEndpoints(w);
    updateWireHandles(w);
    drawWirePath(w);
  });

  drawAllComponents();

  wires.forEach(drawWireControls);

  if (wireStart && tool === 'wire') {
    ctx.strokeStyle = wireStart.color || '#4d9fff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(wireStart.x, wireStart.y);
    ctx.lineTo(mouseX, mouseY);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ==========================================
// NOT WIRED WARNING
// ==========================================
function drawNotWiredWarning(c) {
  if (c.type === 'esp32' || c.type === 'pico') return;

  var cx = c.x;
  var cy = c.y;

  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.font = 'bold 8px JetBrains Mono, monospace';
  ctx.textAlign = 'center';

  var bw = 63;
  var bh = 15;
  var bx = cx - bw / 2;
  var by = cy + (c.height || 30) / 2 + 8;

  ctx.fillStyle = 'rgba(255,85,102,0.15)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#ff5566';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#ff5566';
  ctx.globalAlpha = 1;
  ctx.fillText('\u26A0 NOT WIRED', cx, by + 9.5);

  ctx.restore();
}

// ==========================================
// SHARED HELPERS
// ==========================================
function drawPinDot(p, selected) {
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, selected ? 6 : 4, 0, Math.PI * 2);
  ctx.fill();

  if (selected) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ==========================================
// MICROCONTROLLERS
// ==========================================
function drawESP32(c) {
  var x = c.x, y = c.y, w = c.width, h = c.height;

  ctx.fillStyle = '#0b1e3a';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#1a4080';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = '#060f1e';
  ctx.fillRect(x + 10, y + 10, w - 20, 48);
  ctx.strokeStyle = '#0a2040';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 10, y + 10, w - 20, 48);

  ctx.fillStyle = '#4d9fff';
  ctx.font = 'bold 13px Orbitron, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ESP32', x + w / 2, y + 32);

  ctx.fillStyle = '#2a5a8a';
  ctx.font = '8px JetBrains Mono, monospace';
  ctx.fillText('DevKit V1', x + w / 2, y + 48);

  ctx.fillStyle = '#222';
  ctx.fillRect(x + w / 2 - 10, y, 20, 6);
  ctx.strokeStyle = '#444';
  ctx.strokeRect(x + w / 2 - 10, y, 20, 6);

  c.pins.forEach(function(p) {
    p.x = p.side === 'left' ? x : x + w;
    p.y = y + 60 + p.index * 23;

    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.side === 'left' ? p.x - 12 : p.x + 12, p.y);
    ctx.stroke();

    drawPinDot(p, wireStart === p);

    ctx.fillStyle = '#8890a8';
    ctx.font = 'bold 8px JetBrains Mono, monospace';
    ctx.textAlign = p.side === 'left' ? 'right' : 'left';
    ctx.fillText(p.name === 'GND2' ? 'GND' : p.name, p.side === 'left' ? p.x - 15 : p.x + 15, p.y + 2.5);
  });
}

function drawPico(c) {
  var x = c.x, y = c.y, w = c.width, h = c.height;

  ctx.fillStyle = '#0a2a12';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#1a5a28';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = '#050f08';
  ctx.fillRect(x + 18, y + 10, w - 36, 52);
  ctx.strokeStyle = '#0d3018';
  ctx.strokeRect(x + 18, y + 10, w - 36, 52);

  ctx.fillStyle = '#3ddc84';
  ctx.font = 'bold 11px Orbitron, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PICO', x + w / 2, y + 30);

  ctx.fillStyle = '#1a6a34';
  ctx.font = '7px JetBrains Mono, monospace';
  ctx.fillText('RP2040', x + w / 2, y + 45);
  ctx.fillText('Raspberry Pi', x + w / 2, y + 55);

  ctx.fillStyle = '#111';
  ctx.fillRect(x + w / 2 - 8, y, 16, 5);
  ctx.strokeStyle = '#333';
  ctx.strokeRect(x + w / 2 - 8, y, 16, 5);

  [[x + 4, y + 4], [x + w - 4, y + 4], [x + 4, y + h - 4], [x + w - 4, y + h - 4]].forEach(function(pt) {
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(pt[0], pt[1], 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a5a28';
    ctx.stroke();
  });

  c.pins.forEach(function(p) {
    p.x = p.side === 'left' ? x : x + w;
    p.y = y + 55 + p.index * 19;

    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.side === 'left' ? p.x - 12 : p.x + 12, p.y);
    ctx.stroke();

    drawPinDot(p, wireStart === p);

   ctx.fillStyle = '#8890a8';
    ctx.font = 'bold 8px JetBrains Mono, monospace';
    ctx.textAlign = p.side === 'left' ? 'right' : 'left';
    ctx.fillText(p.name, p.side === 'left' ? p.x - 16 : p.x + 16, p.y + 2);
  });
}

// ==========================================
// LIGHTS
// ==========================================
function drawLED(c) {
  var x = c.x, y = c.y, on = !!c.state.on, col = c.state.color;
  var wired = typeof isComponentWired === 'function' ? isComponentWired(c) : true;
  var R = 10;

  if (on && wired) {
    var grad = ctx.createRadialGradient(x, y, 0, x, y, 22);
    grad.addColorStop(0, col + 'aa');
    grad.addColorStop(1, col + '00');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = col;
    ctx.shadowBlur = 18;
  }

  ctx.fillStyle = (on && wired) ? col : '#1e1e2a';
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = (on && wired) ? col : '#3a3a50';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = (on && wired) ? '#ffffffaa' : '#333345';
  ctx.beginPath();
  ctx.arc(x - 2, y - 3, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = (on && wired) ? col : '#5a5a70';
  ctx.font = 'bold 7px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(c.state.label, x, y - 15);

  ctx.fillStyle = (on && wired) ? '#fff' : '#333';
  ctx.font = '7px JetBrains Mono, monospace';
  ctx.fillText((on && wired) ? 'ON' : 'OFF', x, y + 22);

  c.pins.forEach(function(p) {
    var legOffsetX = p.name === '+' ? -6 : 6;
    var legLength  = p.name === '+' ? 22 : 16;

    p.x = x + legOffsetX;
    p.y = y + R + legLength;

    ctx.strokeStyle = '#b0b8c8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + legOffsetX, y + R);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + legOffsetX - 0.5, y + R);
    ctx.lineTo(p.x - 0.5, p.y);
    ctx.stroke();

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8890a8';
    ctx.font = 'bold 7.5px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, p.x, p.y + 11);
  });
}

// ==========================================
// SENSORS
// ==========================================
function drawUltrasonic(c) {
  var x = c.x, y = c.y, w = c.width, dist = (c.state.distance ?? 100);

  ctx.fillStyle = '#1a2a3a';
  ctx.fillRect(x - w / 2, y - 26, w, 54);
  ctx.strokeStyle = '#2a4a6a';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - w / 2, y - 26, w, 54);

  [[x - 20, y], [x + 20, y]].forEach(function(pt) {
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(pt[0], pt[1], 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(pt[0], pt[1], 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(pt[0], pt[1], 2, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 8px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('HC-SR04', x, y - 22);

  ctx.fillStyle = '#3ddc84';
  ctx.font = 'bold 9px JetBrains Mono, monospace';
  ctx.fillText(dist.toFixed(1) + ' cm', x, y + 32);

  var sy = y + 40, sw = 80;
  ctx.fillStyle = '#111';
  ctx.fillRect(x - sw / 2, sy, sw, 7);
  ctx.strokeStyle = '#2a2a3a';
  ctx.strokeRect(x - sw / 2, sy, sw, 7);

  var sv = Math.min(Math.max((dist - 2) / 398, 0), 1);
  var kx = x - sw / 2 + sv * sw;

  ctx.fillStyle = '#ff6600';
  ctx.beginPath();
  ctx.arc(kx, sy + 3.5, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffaa00';
  ctx.lineWidth = 2;
  ctx.stroke();

  c._slider = { x: x - sw / 2, y: sy, w: sw, h: 7, knobX: kx, knobY: sy + 3.5, knobR: 10 };

  ctx.fillStyle = '#5a6080';
  ctx.font = '5px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('2cm', x - sw / 2 - 8, sy + 11);
  ctx.fillText('400cm', x + sw / 2 + 10, sy + 11);

 c.pins.forEach(function(p, i) {
    p.x = x - 38;
    p.y = y - 18 + i * 14;

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8890a8';
    ctx.font = 'bold 8px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(p.name, p.x - 6, p.y + 3);
  });
}


function drawDHT22(c) {
  var x = c.x, y = c.y;
  var temp = (c.state.temperature ?? 25);
  var hum = (c.state.humidity ?? 55);

  var shellW = 48;
  var shellH = 34;
  var shellX = x - shellW / 2;
  var shellY = y - 42;
  var boardW = 44;
  var boardH = 44;
  var boardX = x - boardW / 2;
  var boardY = y - 8;
  var pinTop = boardY + boardH;
  var pinTip = pinTop + 14;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.24)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#0f1117';
  ctx.fillRect(boardX, boardY, boardW, boardH);
  ctx.restore();

  ctx.strokeStyle = '#232631';
  ctx.lineWidth = 1;
  ctx.strokeRect(boardX, boardY, boardW, boardH);

  ctx.fillStyle = '#f4f2e8';
  ctx.beginPath();
  ctx.moveTo(shellX + 4, shellY + shellH);
  ctx.lineTo(shellX + 4, shellY + 14);
  ctx.arc(x, shellY + 14, shellW / 2 - 4, Math.PI, 0);
  ctx.lineTo(shellX + shellW - 4, shellY + shellH);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#d6d3c8';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(shellX + 7, shellY + 7, shellW - 14, 3);

  ctx.fillStyle = '#cfd0c3';
  for (var row = 0; row < 4; row++) {
    for (var col = 0; col < 4; col++) {
      ctx.fillRect(shellX + 10 + col * 8, shellY + 18 + row * 7, 4, 4);
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,0.26)';
  ctx.beginPath();
  ctx.arc(x, shellY + 12, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = 'center'; 
  ctx.fillStyle = '#ff5566';
  ctx.font = '9px JetBrains Mono, monospace';
  ctx.fillText(temp.toFixed(1) + 'C', x, boardY + 20);

  ctx.fillStyle = '#4d9fff';
  ctx.fillText(hum.toFixed(0) + '%RH', x, boardY + 33);

  var ty = y + 18;
  var th = 48;
  ctx.fillStyle = '#111';
  ctx.fillRect(x + 28, ty - th / 2, 6, th);

  var tv = Math.min(Math.max((temp - (-40)) / 120, 0), 1);
  var tky = ty + th / 2 - tv * th;

  ctx.fillStyle = '#ff5566';
  ctx.beginPath();
  ctx.arc(x + 31, tky, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ff887a';
  ctx.lineWidth = 1;
  ctx.stroke();

  c._tempSlider = { x: x + 28, y: ty - th / 2, w: 6, h: th, knobX: x + 31, knobY: tky, knobR: 8 };

  ctx.fillStyle = '#5a6080';
  ctx.font = '5px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('-40', x + 31, ty + th / 2 + 8);
  ctx.fillText('80C', x + 31, ty - th / 2 - 3);

  var hy = y + 18;
  var hh = 48;
  ctx.fillStyle = '#111';
  ctx.fillRect(x - 34, hy - hh / 2, 6, hh);

  var hv = Math.min(Math.max(hum / 100, 0), 1);
  var hky = hy + hh / 2 - hv * hh;

  ctx.fillStyle = '#4d9fff';
  ctx.beginPath();
  ctx.arc(x - 31, hky, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7ab8ff';
  ctx.lineWidth = 1;
  ctx.stroke();

  c._humSlider = { x: x - 34, y: hy - hh / 2, w: 6, h: hh, knobX: x - 31, knobY: hky, knobR: 8 };

  ctx.fillStyle = '#5a6080';
  ctx.font = '5px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('0%', x - 31, hy + hh / 2 + 8);
  ctx.fillText('100%', x - 31, hy - hh / 2 - 3);

  var pinDefs = [
    { idx: 0, dx: -14, color: '#ff5566', label: '+' },
    { idx: 1, dx:  0, color: '#3ddc84', label: 'OUT' },
    { idx: 2, dx: 14, color: '#8b7355', label: '-' }
  ];

  pinDefs.forEach(function(pd) {
    var p = c.pins[pd.idx];
    var px = x + pd.dx;
    var legTop = pinTop;
    var dotY = pinTip;

    p.x = px;
    p.y = dotY;

    ctx.strokeStyle = '#b0b8c8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(px, legTop);
    ctx.lineTo(px, dotY);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px - 0.5, legTop);
    ctx.lineTo(px - 0.5, dotY);
    ctx.stroke();

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(px, dotY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8890a8';
    ctx.font = 'bold 7px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pd.label || p.label || p.name, px, dotY + 11);
  });
}

// Shared PIR geometry so drawing and hit testing stay in sync.
function getPIRLayout(c) {
  var x = c.x, y = c.y;

  return {
    x: x,
    y: y,
    domeCx: x,
    domeCy: y - 10,
    domeRx: 31,
    domeRy: 23,
    boardW: 94,
    boardH: 15,
    boardX: x - 47,
    boardY: y + 12,
    baseW: 68,
    baseH: 16,
    baseX: x - 34,
    baseY: y - 3,
    potY: y + 21,
    pinTop: y + 27,
    pinTip: y + 44
  };
}

function drawPIR(c) {
  var x = c.x, y = c.y, motion = !!c.state.motion;
  var wired = typeof isComponentWired === 'function' ? isComponentWired(c) : true;
  var layout = getPIRLayout(c);

  ctx.save();

  // ── Drop shadow ──
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;

  // ── PCB board ──
  ctx.fillStyle = '#1e7a2e';
  ctx.fillRect(layout.boardX, layout.boardY, layout.boardW, layout.boardH);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // PCB top highlight
  ctx.fillStyle = '#2a9a3a';
  ctx.fillRect(layout.boardX, layout.boardY, layout.boardW, 2);

  // PCB bottom shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(layout.boardX, layout.boardY + layout.boardH - 2, layout.boardW, 2);

  // PCB inner border
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.strokeRect(layout.boardX + 1, layout.boardY + 1, layout.boardW - 2, layout.boardH - 2);

  // ── Small red LED on board ──
  ctx.fillStyle = motion && wired ? '#ff2244' : '#4a0011';
  ctx.beginPath();
  ctx.arc(layout.boardX + 9, layout.boardY + 7, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = motion && wired ? '#ff6688' : '#220008';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  if (motion && wired) {
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#ff2244';
    ctx.beginPath();
    ctx.arc(layout.boardX + 9, layout.boardY + 7, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── HC-SR501 label on board ──
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.font = 'bold 5px JetBrains Mono, monospace';
  ctx.textAlign = 'right';
  ctx.fillText('HC-SR501', layout.boardX + layout.boardW - 4, layout.boardY + 9);

  // ── Two potentiometers on PCB ──
  function drawPot(cx) {
    ctx.fillStyle = '#1850aa';
    ctx.fillRect(cx - 6, layout.potY - 5, 12, 11);
    ctx.strokeStyle = '#2a6add';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(cx - 6, layout.potY - 5, 12, 11);

    // pot top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(cx - 5, layout.potY - 4, 10, 3);

    // white dial
    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.arc(cx, layout.potY + 1, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // dial pointer
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, layout.potY - 1.5);
    ctx.lineTo(cx, layout.potY + 1);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  drawPot(x - 13);
  drawPot(x + 13);

  // ── Flat white base (rectangle under the dome) ──
  var baseX = layout.baseX;
  var baseY = layout.baseY;
  var baseW = layout.baseW;
  var baseH = layout.baseH;

  ctx.fillStyle = '#efefea';
  ctx.fillRect(baseX, baseY, baseW, baseH);

  // base top highlight
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(baseX, baseY, baseW, 2.5);

  // base bottom shadow
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(baseX, baseY + baseH - 2, baseW, 2);

  // base left/right side tabs (small protruding clips)
  ctx.fillStyle = '#d8d8d0';
  ctx.fillRect(baseX - 4, baseY + 3, 5, baseH - 6);
  ctx.fillRect(baseX + baseW - 1, baseY + 3, 5, baseH - 6);

  // base border
  ctx.strokeStyle = '#c8c8be';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(baseX, baseY, baseW, baseH);

  // ── Half-dome sitting on top of the base ──
  var domeCx = x;
  var domeCy = baseY;           // dome bottom edge sits on top of base
  var domeRx = baseW / 2 - 2;  // dome width matches base width
  var domeRy = 22;              // dome height (half-circle height)

  // motion glow behind dome
  if (motion && wired) {
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#ff4466';
    ctx.beginPath();
    ctx.ellipse(domeCx, domeCy, domeRx + 8, domeRy + 6, 0, Math.PI, 0);
    ctx.lineTo(domeCx + domeRx + 8, domeCy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // dome clip region (upper half of ellipse only)
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(domeCx, domeCy, domeRx, domeRy, 0, Math.PI, 0);
  ctx.lineTo(domeCx + domeRx, domeCy);
  ctx.closePath();
  ctx.clip();

  // dome fill (flat creamy white, top-lit)
  ctx.fillStyle = motion && wired ? '#faf6ee' : '#f5f5ef';
  ctx.fillRect(domeCx - domeRx - 2, domeCy - domeRy - 2, domeRx * 2 + 4, domeRy + 4);

  // Fresnel concentric rings (semi-ellipses only top half)
  ctx.strokeStyle = 'rgba(180,175,165,0.5)';
  ctx.lineWidth = 0.7;
  [0.3, 0.58, 0.82].forEach(function(s) {
    ctx.beginPath();
    ctx.ellipse(domeCx, domeCy, domeRx * s, domeRy * s, 0, Math.PI, 0);
    ctx.stroke();
  });

  // Fresnel vertical divider lines
  ctx.strokeStyle = 'rgba(180,175,165,0.3)';
  ctx.lineWidth = 0.6;
  [-0.6, -0.3, 0.3, 0.6].forEach(function(frac) {
    var lx = domeCx + frac * domeRx;
    var topY = domeCy - domeRy * Math.sqrt(1 - frac * frac);
    ctx.beginPath();
    ctx.moveTo(lx, domeCy);
    ctx.lineTo(lx, topY);
    ctx.stroke();
  });

  // specular highlight on dome (top-left)
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(
    domeCx - domeRx * 0.3,
    domeCy - domeRy * 0.55,
    domeRx * 0.22,
    domeRy * 0.15,
    -0.3, 0, Math.PI * 2
  );
  ctx.fill();

  ctx.restore(); // end dome clip

  // dome outline (only the top arc, no bottom line)
  ctx.strokeStyle = motion && wired ? '#c8bfaa' : '#b8b5ae';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(domeCx, domeCy, domeRx, domeRy, 0, Math.PI, 0);
  ctx.stroke();

  // ── Status text ──
  ctx.fillStyle = motion && wired ? '#ff4466' : '#3a5a3a';
  ctx.font = 'bold 7px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(motion && wired ? '● MOTION!' : '○ CLEAR', x, layout.pinTip + 12);

  // ── Three pins ──
  var pinDefs = [
    { idx: 0, dx: -18, label: 'GND', color: '#8b7355' },
    { idx: 1, dx:   0, label: 'OUT', color: '#3ddc84' },
    { idx: 2, dx:  18, label: 'VCC', color: '#ff5566' }
  ];

  pinDefs.forEach(function(pd) {
    var pin = c.pins[pd.idx];
    var px  = x + pd.dx;

    pin.x = px;
    pin.y = layout.pinTip;
    pin.hitRadius = 13;

    // metal leg
    ctx.strokeStyle = '#b0b8c8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(px, layout.pinTop);
    ctx.lineTo(px, layout.pinTip);
    ctx.stroke();

    // leg shine
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px - 0.5, layout.pinTop);
    ctx.lineTo(px - 0.5, layout.pinTip);
    ctx.stroke();

    // pin dot
    ctx.fillStyle = pd.color;
    ctx.beginPath();
    ctx.arc(px, layout.pinTip, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // pin label
    ctx.fillStyle = '#8890a8';
    ctx.font = 'bold 7px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pd.label, px, layout.pinTip + 11);
  });

  ctx.restore();
}

function drawLDR(c) {
  var x = c.x, y = c.y, light = (c.state.light ?? 2000);
  var bright = light < 2000;

  //  PCB body
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(x - 24, y - 20, 48, 44);
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - 24, y - 20, 48, 44);

  //  Two wire legs sticking up from PCB
  ctx.strokeStyle = '#b0b8c8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 20);
  ctx.lineTo(x - 5, y - 40);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 5, y - 20);
  ctx.lineTo(x + 5, y - 40);
  ctx.stroke();

  //  Photoresistor body sitting on top of the legs
  ctx.fillStyle = '#c8724a';
  ctx.beginPath();
  ctx.arc(x, y - 42, 10, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#e8925a';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  //  Zigzag on photoresistor
  ctx.strokeStyle = '#ffcc88';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 42);
  ctx.lineTo(x - 3, y - 47);
  ctx.lineTo(x - 1, y - 37);
  ctx.lineTo(x + 1, y - 47);
  ctx.lineTo(x + 3, y - 37);
  ctx.lineTo(x + 5, y - 42);
  ctx.stroke();

  //  Resistor body
  ctx.fillStyle = '#1e0e0e';
  ctx.fillRect(x + 2, y + 8, 16, 6);
  ctx.strokeStyle = '#3a2a2a';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x + 2, y + 8, 16, 6);
  ctx.fillStyle = '#bb7700'; ctx.fillRect(x + 7,  y + 8, 2, 6);
  ctx.fillStyle = '#111111'; ctx.fillRect(x + 10, y + 8, 2, 6);
  ctx.fillStyle = '#555';
  ctx.font = '4px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('103', x + 10, y + 13);
  ctx.fillStyle = '#2a3a2a';
  ctx.font = 'bold 5px JetBrains Mono, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('R1', x + 19, y + 13);

  //  KY-018 label
  ctx.fillStyle = '#2a3a2a';
  ctx.font = 'bold 5px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('KY-018', x, y - 24);

  //  Status text
  ctx.fillStyle = bright ? '#ffdd44' : '#3a4a5a';
  ctx.font = '6px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(bright ? '● BRIGHT' : '○ DARK', x, y + 28);

  //  Slider on the RIGHT SIDE so it doesn't block the warning
  var slx = x + 32, slh = 44;
  ctx.fillStyle = '#111';
  ctx.fillRect(slx, y - slh / 2, 4, slh);
  var sv = Math.min(Math.max(light / 4095, 0), 1);
  var sky = y + slh / 2 - sv * slh;
  ctx.fillStyle = '#ffdd44';
  ctx.beginPath();
  ctx.arc(slx + 2, sky, 6, 0, Math.PI * 2);
  ctx.fill();
  c._slider = { x: slx, y: y - slh / 2, w: 4, h: slh, knobX: slx + 2, knobY: sky, knobR: 8 };

  ctx.fillStyle = '#5a6080';
  ctx.font = '5px JetBrains Mono, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('☀', slx + 8, y - slh / 2 + 4);
  ctx.fillText('●', slx + 8, y + slh / 2);

  //  Pins: S, +, - at bottom (same pattern as KY-004)
  var pinDefs = [
    { idx: 0, name: 'OUT', dx: -18, color: '#a78bfa', label: 'S' },
    { idx: 1, name: 'VCC', dx:   0, color: '#ff5566', label: '+' },
    { idx: 2, name: 'GND', dx:  18, color: '#8b7355', label: '-' }
  ];

  pinDefs.forEach(function(pd) {
    var pin    = c.pins[pd.idx];
    var px     = x + pd.dx;
    var legTop = y + 24;
    var dotY   = legTop + 10;

    pin.x = px;
    pin.y = dotY;

    ctx.strokeStyle = '#b0b8c8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(px, legTop);
    ctx.lineTo(px, dotY);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px - 0.5, legTop);
    ctx.lineTo(px - 0.5, dotY);
    ctx.stroke();

    ctx.fillStyle = pd.color;
    ctx.beginPath();
    ctx.arc(px, dotY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8890a8';
    ctx.font = 'bold 7px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pd.label, px, dotY + 11);
  });
}

function drawButton(c) {
  var x = c.x, y = c.y, pressed = !!c.state.pressed;
  var wired = typeof isComponentWired === 'function' ? isComponentWired(c) : true;

  ctx.fillStyle = '#1e1e2e';
  ctx.fillRect(x - 15, y - 15, 30, 30);
  ctx.strokeStyle = '#3a3a5a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - 15, y - 15, 30, 30);

  [[-11, 15], [11, 15], [-12, -15], [12, -15]].forEach(function(pt) {
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + pt[0], y + pt[1]);
    ctx.lineTo(x + pt[0], y + pt[1] + (pt[1] > 0 ? 6 : -12));
    ctx.stroke();
  });


  if (pressed && wired) {
    ctx.shadowColor = '#ffcc44';
    ctx.shadowBlur = 10;
  }

   ctx.fillStyle = (pressed && wired) ? '#ffcc44' : '#555';
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = (pressed && wired) ? '#ffaa00' : '#777';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#e8eaf6';
  ctx.font = 'bold 7px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(pressed ? 'ON' : 'OFF', x, y - 19);

  c.pins.forEach(function(p, i) {
    p.x = i === 0 ? x - 12 : x + 12;
    p.y = y - 27;

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8890a8';
    ctx.font = 'bold 7px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, p.x, p.y - 8);
  });
}

function drawJoystick(c) {
  var x = c.x, y = c.y;
  var vx = c.state.vx ?? 2048;
  var vy = c.state.vy ?? 2048;
  var sw = !!c.state.sw;
  var wired = typeof isComponentWired === 'function' ? isComponentWired(c) : true;

  ctx.fillStyle = '#0f2a14';
  ctx.fillRect(x - 65, y - 35, 130, 70);
  ctx.strokeStyle = '#1f5a28';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 65, y - 35, 130, 70);

  [[-58, -28], [58, -28], [-58, 28], [58, 28]].forEach(function(o) {
    ctx.fillStyle = '#070f09';
    ctx.beginPath();
    ctx.arc(x + o[0], y + o[1], 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1f5a28';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(x - 22, y - 22, 44, 44);
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - 22, y - 22, 44, 44);

  ctx.strokeStyle = '#333';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x - 18, y);
  ctx.lineTo(x + 18, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y - 18);
  ctx.lineTo(x, y + 18);
  ctx.stroke();

  var normX = (vx / 4095 - 0.5) * 10;
  var normY = (vy / 4095 - 0.5) * 10;
  var capX = x + normX, capY = y + normY;

  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (sw && wired) {
    ctx.strokeStyle = '#3ddc84';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(capX, capY, 18, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(capX, capY + 2, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = sw && wired ? '#484848' : '#2e2e2e';
  ctx.beginPath();
  ctx.arc(capX, capY, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = sw && wired ? '#888' : '#444';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = sw && wired ? '#606060' : '#404040';
  ctx.beginPath();
  ctx.arc(capX, capY, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = sw && wired ? '#3ddc84' : '#1a1a1a';
  ctx.beginPath();
  ctx.arc(capX, capY, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 7px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('KY-023', x, y - 38);

  var sxy = y + 42, sxw = 70;
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(x - sxw / 2, sxy, sxw, 5);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x - sxw / 2, sxy, sxw, 5);

  var sxv = Math.min(Math.max(vx / 4095, 0), 1);
  var skx = x - sxw / 2 + sxv * sxw;

  ctx.fillStyle = '#a78bfa';
  ctx.beginPath();
  ctx.arc(skx, sxy + 2.5, 6, 0, Math.PI * 2);
  ctx.fill();

  c._xSlider = { x: x - sxw / 2, y: sxy, w: sxw, h: 5, knobX: skx, knobY: sxy + 2.5, knobR: 8 };

  ctx.fillStyle = '#6a6080';
  ctx.font = '6px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('VRX ' + vx, x, sxy + 16);

  var syy = y + 64, syw = 70;
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(x - syw / 2, syy, syw, 5);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x - syw / 2, syy, syw, 5);

  var syv = Math.min(Math.max(vy / 4095, 0), 1);
  var sky2 = x - syw / 2 + syv * syw;

  ctx.fillStyle = '#38d8ea';
  ctx.beginPath();
  ctx.arc(sky2, syy + 2.5, 6, 0, Math.PI * 2);
  ctx.fill();

  c._ySlider = { x: x - syw / 2, y: syy, w: syw, h: 5, knobX: sky2, knobY: syy + 2.5, knobR: 8 };

  ctx.fillStyle = '#3a7080';
  ctx.font = '6px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('VRY ' + vy, x, syy + 16);

  ctx.fillStyle = sw && wired ? '#3ddc84' : '#3a3a4a';
  ctx.font = 'bold 6px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(sw && wired ? '● SW PRESSED' : '○ SW', x, y + 96);

  var pinYMap = { 'GND': y - 25, 'VCC': y - 12, 'VRX': y + 1, 'VRY': y + 14, 'SW': y + 27 };
  c.pins.forEach(function(p) {
    p.x = x - 65;
    p.y = pinYMap[p.name] !== undefined ? pinYMap[p.name] : p.y;

    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 65, p.y);
    ctx.lineTo(x - 73, p.y);
    ctx.stroke();

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.fillStyle = p.color;
    ctx.font = 'bold 7px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(p.name, p.x - 10, p.y + 2.5);
  });
}
function drawKY004(c) {
  var x = c.x, y = c.y;
  var pressed = !!c.state.pressed;
  var wired = typeof isComponentWired === 'function' ? isComponentWired(c) : true;
 
  //  PCB body (black square, same proportions as real module)
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(x - 24, y - 24, 48, 48);
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - 24, y - 24, 48, 48);
 
  //  Four corner mounting holes (faithful to PCB photo)
  [[-16, -16], [16, -16], [-16, 16], [16, 16]].forEach(function(o) {
    ctx.fillStyle = '#1e1e1e';
    ctx.beginPath();
    ctx.arc(x + o[0], y + o[1], 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // inner hole
    ctx.fillStyle = '#050505';
    ctx.beginPath();
    ctx.arc(x + o[0], y + o[1], 2, 0, Math.PI * 2);
    ctx.fill();
  });
 
  //  Resistor body (bottom-right, "103" label, matches photo)
  ctx.fillStyle = '#1e0e0e';
  ctx.fillRect(x + 2, y + 8, 16, 6);
  ctx.strokeStyle = '#3a2a2a';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x + 2, y + 8, 16, 6);
  // colour bands
  ctx.fillStyle = '#bb7700'; ctx.fillRect(x + 7,  y + 8, 2, 6);
  ctx.fillStyle = '#111111'; ctx.fillRect(x + 10, y + 8, 2, 6);
  // "103" silk text
  ctx.fillStyle = '#555';
  ctx.font = '4px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('103', x + 10, y + 13);
  // "R1" silk label
  ctx.fillStyle = '#2a3a2a';
  ctx.font = 'bold 5px JetBrains Mono, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('R1', x + 19, y + 13);
 
  //  Tactile switch metal base plate
  ctx.fillStyle = '#1c1c26';
  ctx.fillRect(x - 10, y - 13, 20, 20);
  ctx.strokeStyle = '#38384a';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 10, y - 13, 20, 20);
 
  //  Four tiny solder legs on the tactile switch corners
  [[-7, 4], [7, 4], [-7, -11], [7, -11]].forEach(function(o) {
    ctx.fillStyle = '#5a5a5a';
    ctx.beginPath();
    ctx.arc(x + o[0], y + o[1], 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#777';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  });
 
  //  Button cap: glows yellow when pressed+wired
  if (pressed && wired) {
    ctx.shadowColor = '#ffcc44';
    ctx.shadowBlur = 12;
  }
 
  var capY = pressed && wired ? y - 2 : y - 3; // slight depress when pressed
  ctx.fillStyle = pressed && wired ? '#505050' : '#2e2e2e';
  ctx.fillRect(x - 8, capY - 8, 16, 16);
  ctx.strokeStyle = pressed && wired ? '#888' : '#444';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - 8, capY - 8, 16, 16);
 
  // inner cap surface
  ctx.fillStyle = pressed && wired ? '#686868' : '#3c3c3c';
  ctx.fillRect(x - 6, capY - 6, 12, 12);
 
  ctx.shadowBlur = 0;
 
  //  "A / S1" silk-screen (rotated top-left, matching real PCB)
  ctx.save();
  ctx.translate(x - 19, y - 16);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#303030';
  ctx.font = 'bold 5px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('A', 0, 0);
  ctx.fillText('S1', 0, 6);
  ctx.restore();
 
  //  "KY-004" silk label (top-center of PCB, very small, part of board art)
  ctx.fillStyle = '#2a3a2a';
  ctx.font = 'bold 5px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('KY-004', x, y - 19);
 
  //  Status text below component (same pattern as drawButton / drawPIR)
  ctx.fillStyle = pressed && wired ? '#ffcc44' : '#3a4a5a';
  ctx.font = '6px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(pressed && wired ? '● PRESSED' : '○ OPEN', x, y + 34);
 
  //  Pins: S (left), VCC (center), GND (right)
  //
  var pinDefs = [
    { idx: 0, name: 'S',   dx: -18, color: '#3ddc84', label: 'S' },
    { idx: 1, name: 'VCC', dx:   0, color: '#ff5566', label: '+' },
    { idx: 2, name: 'GND', dx:  18, color: '#8b7355', label: '-' }
  ];
 
  pinDefs.forEach(function(pd) {
    var pin = c.pins[pd.idx];
    var px  = x + pd.dx;
    var legTop = y + 24;   // bottom edge of PCB
    var dotY   = legTop + 10;
 
    // sync position (same pattern as every other draw function)
    pin.x = px;
    pin.y = dotY;
 
    // metal leg
    ctx.strokeStyle = '#b0b8c8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(px, legTop);
    ctx.lineTo(px, dotY);
    ctx.stroke();
 
    // leg highlight (same subtle shine used in drawLED)
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px - 0.5, legTop);
    ctx.lineTo(px - 0.5, dotY);
    ctx.stroke();
 
    //
    ctx.fillStyle = pd.color;
    ctx.beginPath();
    ctx.arc(px, dotY, 3.5, 0, Math.PI * 2);
    ctx.fill();
 
    // pin name label (same position/style as drawButton / drawBuzzer)
    ctx.fillStyle = '#8890a8';
    ctx.font = 'bold 7px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pd.label, px, dotY + 11);
  });
}

function drawSW420(c) {
  var x = c.x, y = c.y;
  var triggered = !!c.state.triggered;
  var wired = typeof isComponentWired === 'function' ? isComponentWired(c) : true;

  //
  var ox = 0, oy = 0;
  if (c._shake) {
    var elapsed = Date.now() - c._shake.startTime;
    var duration = 500;
    if (elapsed < duration) {
      var progress = elapsed / duration;
      var decay = 1 - progress;
      ox = Math.round(Math.sin(progress * Math.PI * 18) * 5 * decay);
      oy = Math.round(Math.cos(progress * Math.PI * 12) * 3 * decay);
      requestAnimationFrame(function() { if (typeof draw === 'function') draw(); });
    } else {
      c._shake = null;
    }
  }

  ctx.save();
  ctx.translate(ox, oy);

  //
  var pcbW = 40, pcbH = 92;
  var yTop = y - pcbH / 2;

  ctx.fillStyle = '#1a3a8a';
  ctx.fillRect(x - pcbW / 2, yTop, pcbW, pcbH);
  ctx.strokeStyle = triggered && wired ? '#ffcc44' : '#2a5acc';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - pcbW / 2, yTop, pcbW, pcbH);
  ctx.strokeStyle = '#2a4ab0';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x - pcbW / 2 + 1, yTop + 1, pcbW - 2, pcbH - 2);

  //
  // vibration switch: horizontal cylinder with metal end caps + bent leads
  var senY = yTop + 4;
  var swHalfW = pcbW / 2 - 5;
  var swCapR  = 6;

  ctx.strokeStyle = '#b0b8c8';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(x - swHalfW + 4, senY);
  ctx.lineTo(x - swHalfW + 4, senY + swCapR + 7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + swHalfW - 4, senY);
  ctx.lineTo(x + swHalfW - 4, senY + swCapR + 7);
  ctx.stroke();
  ctx.fillStyle = '#8a9098';
  ctx.beginPath(); ctx.arc(x - swHalfW + 4, senY + swCapR + 7, 1.1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + swHalfW - 4, senY + swCapR + 7, 1.1, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#7ea8d8';
  ctx.beginPath();
  ctx.moveTo(x - swHalfW + swCapR, senY - swCapR);
  ctx.lineTo(x + swHalfW - swCapR, senY - swCapR);
  ctx.arc(x + swHalfW - swCapR, senY, swCapR, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x - swHalfW + swCapR, senY + swCapR);
  ctx.arc(x - swHalfW + swCapR, senY, swCapR, Math.PI / 2, Math.PI * 1.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = triggered && wired ? '#ffcc44' : '#5a86b8';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  ctx.fillStyle = '#dfe3e8';
  ctx.strokeStyle = '#9aa6b8';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.arc(x - swHalfW + swCapR, senY, swCapR - 1.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(x + swHalfW - swCapR, senY, swCapR - 1.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - swHalfW + swCapR + 1.5, senY - swCapR + 1, (swHalfW - swCapR) * 2 - 3, 2);
  ctx.restore();

  //
  // row 1: two black resistors (103) + two tan ceramic caps
  var row1Y = yTop + 22, row1H = 7, row1W = 5;
  [
    { dx: -10.5, color: '#1a1a1a', label: '103' },
    { dx:  -3.5, color: '#1a1a1a', label: '103' },
    { dx:   3.5, color: '#c9a878', label: null  },
    { dx:  10.5, color: '#c9a878', label: null  }
  ].forEach(function(it) {
    ctx.fillStyle = it.color;
    ctx.fillRect(x + it.dx - row1W / 2, row1Y, row1W, row1H);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.3;
    ctx.strokeRect(x + it.dx - row1W / 2, row1Y, row1W, row1H);
    if (it.label) {
      ctx.fillStyle = '#999';
      ctx.font = '3px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(it.label, x + it.dx, row1Y + row1H / 2 + 1);
    }
  });

  //
  // LM393 chip
  ctx.fillStyle = '#111';
  ctx.fillRect(x - 17, yTop + 33, 18, 12);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 0.4;
  ctx.strokeRect(x - 17, yTop + 33, 18, 12);
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(x - 14, yTop + 33, 1.2, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#888';
  ctx.font = '3px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('LM393', x - 8, yTop + 40);

  //
  // trimmer potentiometer
  ctx.fillStyle = '#1a55cc';
  ctx.fillRect(x + 3.5, yTop + 31, 15, 15);
  ctx.strokeStyle = '#4488ff';
  ctx.lineWidth = 0.6;
  ctx.strokeRect(x + 3.5, yTop + 31, 15, 15);
  ctx.fillStyle = '#eeeeee';
  ctx.beginPath();
  ctx.arc(x + 11, yTop + 38.5, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x + 11, yTop + 35);
  ctx.lineTo(x + 11, yTop + 42);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 7.5, yTop + 38.5);
  ctx.lineTo(x + 14.5, yTop + 38.5);
  ctx.stroke();

  //
  // row 2: two black components (102) + vertical "SBX" silkscreen
  var row2Y = yTop + 53, row2H = 7, row2W = 5;
  [-10, 10].forEach(function(dx) {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x + dx - row2W / 2, row2Y, row2W, row2H);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.3;
    ctx.strokeRect(x + dx - row2W / 2, row2Y, row2W, row2H);
    ctx.fillStyle = '#999';
    ctx.font = '3px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('102', x + dx, row2Y + row2H / 2 + 1);
  });

  ctx.save();
  ctx.translate(x, row2Y + row2H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#ffffff55';
  ctx.font = 'bold 4px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SBX', 0, 0);
  ctx.restore();

  //
  // mounting hole
  var holeCy = yTop + 68;
  ctx.fillStyle = '#cfd3d8';
  ctx.beginPath();
  ctx.arc(x, holeCy, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8e9e4';
  ctx.beginPath();
  ctx.arc(x, holeCy, 4.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#9aa0a8';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  //
  // DO + power indicator LEDs (small SMD rectangles)
  var ledCy = yTop + 77;
  ctx.fillStyle = triggered && wired ? '#22dd55' : '#11371d';
  ctx.fillRect(x - 17, ledCy - 2.5, 6, 5);
  ctx.strokeStyle = triggered && wired ? '#5fff8a' : '#0a2412';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x - 17, ledCy - 2.5, 6, 5);

  ctx.fillStyle = wired ? '#ff5566' : '#3a1a1e';
  ctx.fillRect(x + 11, ledCy - 2.5, 6, 5);
  ctx.strokeStyle = wired ? '#ff99a3' : '#240d10';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x + 11, ledCy - 2.5, 6, 5);

  //
  ctx.fillStyle = '#ffffff33';
  ctx.font = 'bold 4px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SW-420', x, yTop + 88);

  //
  ctx.fillStyle = triggered && wired ? '#ffcc44' : '#3a4a5a';
  ctx.font = '6px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(triggered && wired ? '● VIBRATING' : '○ STABLE', x, y + pcbH / 2 + 14);

  //
  if (triggered && wired) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#ffcc44';
    ctx.beginPath();
    ctx.arc(x, y, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  //
  var pinDefs = [
    { idx: 0, dx: -18, color: '#3ddc84', label: 'DO'  },
    { idx: 1, dx:   0, color: '#8b7355', label: 'GND' },
    { idx: 2, dx:  18, color: '#ff5566', label: 'VCC' }
  ];

  pinDefs.forEach(function(pd) {
    var pin    = c.pins[pd.idx];
    var px     = x + pd.dx;
    var legTop = y + pcbH / 2;
    var dotY   = legTop + 12;

    pin.x = px;
    pin.y = dotY;

    ctx.strokeStyle = '#b0b8c8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(px, legTop);
    ctx.lineTo(px, dotY);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px - 0.5, legTop);
    ctx.lineTo(px - 0.5, dotY);
    ctx.stroke();

    ctx.fillStyle = pd.color;
    ctx.beginPath();
    ctx.arc(px, dotY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8890a8';
    ctx.font = 'bold 7px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pd.label, px, dotY + 11);
  });

  ctx.restore();
}

function drawFlame(c) {
  var x = c.x, y = c.y;
  var detected = !!c.state.detected;
  var wired = typeof isComponentWired === 'function' ? isComponentWired(c) : true;

  //  PCB body (blue)
  ctx.fillStyle = '#1a3a8a';
  ctx.fillRect(x - 28, y - 32, 56, 64);
  ctx.strokeStyle = detected && wired ? '#ff6600' : '#2a5acc';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - 28, y - 32, 56, 64);

  //  PCB edge highlight
  ctx.strokeStyle = '#2a4ab0';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x - 26, y - 30, 52, 60);

  //
  var domeX = x + 14;
  var domeBaseY = y - 32; // sits flush on PCB top edge

  // bullet body (rectangle base + round top)
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(domeX - 6, domeBaseY - 10, 12, 12);
  ctx.beginPath();
  ctx.arc(domeX, domeBaseY - 10, 6, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 1;
  ctx.strokeRect(domeX - 6, domeBaseY - 10, 12, 12);
  ctx.beginPath();
  ctx.arc(domeX, domeBaseY - 10, 6, Math.PI, 0);
  ctx.stroke();

  // subtle lens shine
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(domeX - 2, domeBaseY - 14, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // IR glow when detected
  if (detected && wired) {
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#ff4400';
    ctx.beginPath();
    ctx.arc(domeX, domeBaseY - 16, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  //  Blue trim potentiometer (center-right)
  ctx.fillStyle = '#1a55cc';
  ctx.fillRect(x + 2, y - 18, 18, 18);
  ctx.strokeStyle = '#4488ff';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 2, y - 18, 18, 18);
  // pot dial
  ctx.fillStyle = '#2266dd';
  ctx.beginPath();
  ctx.arc(x + 11, y - 9, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#88aaff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 11, y - 15);
  ctx.lineTo(x + 11, y - 9);
  ctx.stroke();

  //  LM393 chip (left side)
  ctx.fillStyle = '#111';
  ctx.fillRect(x - 26, y - 14, 22, 16);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x - 26, y - 14, 22, 16);
  // chip notch
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(x - 15, y - 14, 2.5, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#444';
  ctx.font = '4px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('LM393', x - 15, y - 4);

  //  Two small indicator LEDs (left edge, stacked)
  // PWR LED (red)
  ctx.fillStyle = detected && wired ? '#ff2200' : '#550000';
  ctx.beginPath();
  ctx.arc(x - 24, y + 8, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // DO LED (green)
  ctx.fillStyle = detected && wired ? '#00ff44' : '#004411';
  ctx.beginPath();
  ctx.arc(x - 24, y + 16, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#44ff88';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  //  Small resistors on PCB
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(x - 4,  y + 2,  10, 5);
  ctx.fillRect(x + 8,  y + 2,  10, 5);
  ctx.fillRect(x - 14, y - 20, 10, 5);
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 0.3;
  ctx.strokeRect(x - 4,  y + 2,  10, 5);
  ctx.strokeRect(x + 8,  y + 2,  10, 5);
  ctx.strokeRect(x - 14, y - 20, 10, 5);

  //  Label
  ctx.fillStyle = '#ffffff55';
  ctx.font = 'bold 5px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('IR FLAME', x, y - 19);

  //  Animated flame above sensor
  var t = Date.now() / 120;
  var flickerH = detected && wired ? (18 + Math.sin(t * 2.1) * 4 + Math.sin(t * 3.7) * 2) : 0;
  var flickerW = detected && wired ? (7  + Math.sin(t * 1.8) * 2) : 0;

  if (detected && wired && flickerH > 0) {
    // outer flame (orange)
    ctx.beginPath();
    ctx.moveTo(x + 14, y - 36 - flickerH);
    ctx.bezierCurveTo(
      x + 14 + flickerW,     y - 36 - flickerH * 0.5,
      x + 14 + flickerW * 1.3, y - 36,
      x + 14,                y - 36
    );
    ctx.bezierCurveTo(
      x + 14 - flickerW * 1.3, y - 36,
      x + 14 - flickerW,     y - 36 - flickerH * 0.5,
      x + 14,                y - 36 - flickerH
    );
    ctx.fillStyle = 'rgba(255,100,0,0.85)';
    ctx.fill();

    // inner flame (yellow)
    var iH = flickerH * 0.6;
    var iW = flickerW * 0.55;
    ctx.beginPath();
    ctx.moveTo(x + 14, y - 36 - iH);
    ctx.bezierCurveTo(
      x + 14 + iW, y - 36 - iH * 0.4,
      x + 14 + iW, y - 36,
      x + 14,      y - 36
    );
    ctx.bezierCurveTo(
      x + 14 - iW, y - 36,
      x + 14 - iW, y - 36 - iH * 0.4,
      x + 14,      y - 36 - iH
    );
    ctx.fillStyle = 'rgba(255,220,50,0.9)';
    ctx.fill();

    // glow
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.arc(x + 14, y - 36 - flickerH * 0.4, flickerH * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    requestAnimationFrame(function() { if (typeof draw === 'function') draw(); });
  }

  //  Status
  ctx.fillStyle = detected && wired ? '#ff6600' : '#3a4a5a';
  ctx.font = '6px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(detected && wired ? '● FLAME!' : '○ CLEAR', x, y + 46);

  //  Analog slider (right side)
  var slx = x + 36, slh = 44;
  ctx.fillStyle = '#111';
  ctx.fillRect(slx, y - slh / 2, 4, slh);
  var sv = Math.min(Math.max(c.state.analog / 4095, 0), 1);
  var sky = y + slh / 2 - sv * slh;
  ctx.fillStyle = detected && wired ? '#ff6600' : '#3a4a5a';
  ctx.beginPath();
  ctx.arc(slx + 2, sky, 6, 0, Math.PI * 2);
  ctx.fill();
  c._slider = { x: slx, y: y - slh / 2, w: 4, h: slh, knobX: slx + 2, knobY: sky, knobR: 8 };

  //  4 pins at bottom (AO, DO, GND, VCC)
  var pinDefs = [
    { idx: 0, dx: -18, color: '#a78bfa', label: 'AO' },
    { idx: 1, dx:  -6, color: '#3ddc84', label: 'DO' },
    { idx: 2, dx:   6, color: '#8b7355', label: 'G'  },
    { idx: 3, dx:  18, color: '#ff5566', label: 'V'  }
  ];

  pinDefs.forEach(function(pd) {
    var pin    = c.pins[pd.idx];
    var px     = x + pd.dx;
    var legTop = y + 32;
    var dotY   = legTop + 12;

    pin.x = px;
    pin.y = dotY;

    // metal leg
    ctx.strokeStyle = '#b0b8c8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(px, legTop);
    ctx.lineTo(px, dotY);
    ctx.stroke();

    // shine
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px - 0.5, legTop);
    ctx.lineTo(px - 0.5, dotY);
    ctx.stroke();

    ctx.fillStyle = pd.color;
    ctx.beginPath();
    ctx.arc(px, dotY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8890a8';
    ctx.font = 'bold 7px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pd.label, px, dotY + 11);
  });
}
function drawKY032(c) {
  var x = c.x, y = c.y;
  var detected = !!c.state.detected;
  var wired = typeof isComponentWired === 'function' ? isComponentWired(c) : true;

  if (!c._beam) c._beam = { phase: 0 };
  c._beam.phase = (c._beam.phase + 0.035) % 1;
  var phase = c._beam.phase;

  var pcbW = 52;
  var pcbH = 90;
  var pcbX = x - pcbW / 2;
  var pcbY = y - pcbH / 2;

  //
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(pcbX, pcbY, pcbW, pcbH);
  ctx.strokeStyle = detected && wired ? '#cc3300' : '#2a2a2a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(pcbX, pcbY, pcbW, pcbH);
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(pcbX + 1, pcbY + 1, pcbW - 2, pcbH - 2);

  //
  ctx.save();
  ctx.fillStyle = '#2a2a2a';
  ctx.font = 'bold 4px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.translate(x, y - 5);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('IR-08H', 0, 2);
  ctx.restore();

  ctx.fillStyle = '#2a2a2a';
  ctx.font = 'bold 4px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('EN', pcbX + 6, pcbY + pcbH - 4);

  // ============================================================
  //
  // ============================================================
  var rcX = x - 8;
  var rcDomeTopY = pcbY - 7;

  ctx.strokeStyle = '#666'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(rcX - 2, pcbY); ctx.lineTo(rcX - 2, pcbY + 5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(rcX + 2, pcbY); ctx.lineTo(rcX + 2, pcbY + 5); ctx.stroke();

  // receiver dome glow when detected
  if (detected && wired) {
    ctx.save();
    ctx.globalAlpha = 0.2 + Math.abs(Math.sin(phase * Math.PI * 2)) * 0.3;
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.arc(rcX, rcDomeTopY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = '#0d0d0d';
  ctx.beginPath(); ctx.arc(rcX, rcDomeTopY, 5, Math.PI, 0); ctx.closePath(); ctx.fill();
  ctx.fillRect(rcX - 5, rcDomeTopY, 10, 7);
  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(rcX, rcDomeTopY, 5, Math.PI, 0);
  ctx.moveTo(rcX - 5, rcDomeTopY); ctx.lineTo(rcX - 5, rcDomeTopY + 7);
  ctx.moveTo(rcX + 5, rcDomeTopY); ctx.lineTo(rcX + 5, rcDomeTopY + 7);
  ctx.stroke();
  ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = '#aaddff';
  ctx.beginPath(); ctx.arc(rcX - 1, rcDomeTopY - 1, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // ============================================================
  //
  // ============================================================
  var emX = x + 8;
  var domeTopY = pcbY - 10;

  ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(emX - 2, pcbY); ctx.lineTo(emX - 2, pcbY + 5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(emX + 2, pcbY); ctx.lineTo(emX + 2, pcbY + 5); ctx.stroke();

  ctx.fillStyle = '#c8dde8';
  ctx.beginPath(); ctx.arc(emX, domeTopY, 6, Math.PI, 0); ctx.closePath(); ctx.fill();
  ctx.fillRect(emX - 6, domeTopY, 12, 10);
  ctx.strokeStyle = '#aabbc8'; ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(emX, domeTopY, 6, Math.PI, 0);
  ctx.moveTo(emX - 6, domeTopY); ctx.lineTo(emX - 6, domeTopY + 10);
  ctx.moveTo(emX + 6, domeTopY); ctx.lineTo(emX + 6, domeTopY + 10);
  ctx.stroke();
  ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(emX - 2, domeTopY - 2, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // ============================================================
  //
  // ============================================================
  ctx.fillStyle = '#050505';
  ctx.beginPath(); ctx.arc(x, pcbY + 18, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1e1e1e'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(x, pcbY + 18, 2, 0, Math.PI * 2); ctx.fill();

  // ============================================================
  //
  // ============================================================
  ctx.fillStyle = '#111';
  ctx.fillRect(pcbX + 5, y - 7, pcbW - 10, 14);
  ctx.strokeStyle = '#222'; ctx.lineWidth = 0.5;
  ctx.strokeRect(pcbX + 5, y - 7, pcbW - 10, 14);
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.arc(pcbX + 7, y, 1.5, 0, Math.PI * 2); ctx.fill();
  for (var ip = 0; ip < 3; ip++) {
    ctx.strokeStyle = '#444'; ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(pcbX + 5, y - 4 + ip * 4); ctx.lineTo(pcbX + 2, y - 4 + ip * 4); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pcbX + pcbW - 5, y - 4 + ip * 4); ctx.lineTo(pcbX + pcbW - 2, y - 4 + ip * 4); ctx.stroke();
  }

  // ============================================================
  //
  // ============================================================
  var potY = y + 22;
  var pot1X = x - 9;
  var pot2X = x + 9;

  ctx.fillStyle = '#1a55cc';
  ctx.fillRect(pot1X - 8, potY - 6, 16, 14);
  ctx.strokeStyle = '#4488ff'; ctx.lineWidth = 0.8;
  ctx.strokeRect(pot1X - 8, potY - 6, 16, 14);
  ctx.fillStyle = '#eeeeee';
  ctx.beginPath(); ctx.arc(pot1X, potY + 1, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#aaa'; ctx.lineWidth = 0.6; ctx.stroke();
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pot1X, potY - 2); ctx.lineTo(pot1X, potY + 1); ctx.stroke();

  ctx.fillStyle = '#1a55cc';
  ctx.fillRect(pot2X - 8, potY - 6, 16, 14);
  ctx.strokeStyle = '#4488ff'; ctx.lineWidth = 0.8;
  ctx.strokeRect(pot2X - 8, potY - 6, 16, 14);
  ctx.fillStyle = '#eeeeee';
  ctx.beginPath(); ctx.arc(pot2X, potY + 1, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#aaa'; ctx.lineWidth = 0.6; ctx.stroke();
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pot2X, potY - 2); ctx.lineTo(pot2X, potY + 1); ctx.stroke();

  // ============================================================
  // ANIMATIONS
  // ============================================================
  if (wired) {

    //
    for (var pulse = 0; pulse < 3; pulse++) {
      var pOff  = (phase + pulse / 3) % 1;
      var segY  = (domeTopY - 6) - pOff * 26;
      var alpha = 0.7 - pOff * 0.6;

      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.strokeStyle = '#9933ff';
      ctx.lineWidth = 1.3;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(emX, segY + 5);
      ctx.lineTo(emX, segY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    //
    if (detected) {

      // incoming wave arcs above receiver dome
      for (var ring = 0; ring < 3; ring++) {
        var rPhase  = (phase + ring * 0.33) % 1;
        var rRadius = 4 + rPhase * 13;
        var rAlpha  = 0.7 * (1 - rPhase);

        ctx.save();
        ctx.globalAlpha = rAlpha;
        ctx.strokeStyle = '#ff5500';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(rcX, rcDomeTopY - 3, rRadius, Math.PI, 0);
        ctx.stroke();
        ctx.restore();
      }

      requestAnimationFrame(function() { if (typeof draw === 'function') draw(); });
    }
  }

  //
  ctx.fillStyle = detected && wired ? '#ff4400' : '#3a4a5a';
  ctx.font = '6px JetBrains Mono, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(detected && wired ? '● OBS!' : '○ CLR', pcbX + pcbW + 4, y);

  // ============================================================
  //
  // ============================================================
  var pinDefs = [
    { idx: 0, dx: -21, color: '#ffcc44', label: 'EN'  },
    { idx: 1, dx:  -7, color: '#ff5566', label: 'VCC' },
    { idx: 2, dx:   7, color: '#3ddc84', label: 'OUT' },
    { idx: 3, dx:  21, color: '#8b7355', label: 'GND' }
  ];

  pinDefs.forEach(function(pd) {
    var pin    = c.pins[pd.idx];
    var px     = x + pd.dx;
    var legTop = pcbY + pcbH;
    var dotY   = legTop + 10;

    pin.x = px;
    pin.y = dotY;

    ctx.strokeStyle = '#b0b8c8'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(px, legTop); ctx.lineTo(px, dotY); ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px - 0.5, legTop); ctx.lineTo(px - 0.5, dotY); ctx.stroke();

    ctx.fillStyle = pd.color;
    ctx.beginPath(); ctx.arc(px, dotY, 3.5, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#8890a8';
    ctx.font = 'bold 7px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pd.label, px, dotY + 11);
  });
}

// ==========================================
// OUTPUT
// ==========================================
function drawServo(c) {
  var x = c.x, y = c.y, angle = (c.state.angle ?? 90);
  var wired = typeof isComponentWired === 'function' ? isComponentWired(c) : true;
 
  var bw = 120, bh = 72;
  var bx = x - bw / 2, by = y - bh / 2;
 
  // ── Right mounting tab ──
  ctx.fillStyle = '#1a3d80';
  ctx.fillRect(bx + bw, y - 30, 16, 60);
  ctx.strokeStyle = '#122a60';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + bw, y - 30, 16, 60);
  // mounting holes
  ctx.fillStyle = '#0a1628';
  ctx.beginPath();
  ctx.arc(bx + bw + 8, y - 16, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0d2050';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.fillStyle = '#050e1c';
  ctx.beginPath();
  ctx.arc(bx + bw + 8, y - 16, 2.5, 0, Math.PI * 2);
  ctx.fill();
 
  ctx.fillStyle = '#0a1628';
  ctx.beginPath();
  ctx.arc(bx + bw + 8, y + 16, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0d2050';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.fillStyle = '#050e1c';
  ctx.beginPath();
  ctx.arc(bx + bw + 8, y + 16, 2.5, 0, Math.PI * 2);
  ctx.fill();
 
  // ── Main blue body ──
  ctx.fillStyle = '#2255aa';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#1a3d80';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx, by, bw, bh);
  // top highlight
  ctx.fillStyle = 'rgba(100,160,255,0.15)';
  ctx.fillRect(bx, by, bw, 6);
 
  // ── Gear area (LEFT portion of blue body) ──
  var gearPanelW = 74;
  ctx.fillStyle = '#112070';
  ctx.fillRect(bx, by + 8, gearPanelW, bh - 16);
  ctx.strokeStyle = '#0f1e60';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(bx, by + 8, gearPanelW, bh - 16);
 
  // gear position: center of gear panel
  var gx = bx + gearPanelW / 2;
  var gy = y;
 
  // gear teeth ring
  ctx.strokeStyle = '#2a55bb';
  ctx.lineWidth = 4;
  ctx.setLineDash([3, 2]);
  ctx.beginPath();
  ctx.arc(gx, gy, 24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
 
  // gear inner rings
  ctx.fillStyle = '#0a1830';
  ctx.beginPath();
  ctx.arc(gx, gy, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2255aa';
  ctx.lineWidth = 1;
  ctx.stroke();
 
  ctx.fillStyle = '#152560';
  ctx.beginPath();
  ctx.arc(gx, gy, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2a4aaa';
  ctx.lineWidth = 0.8;
  ctx.stroke();
 
  // output shaft
  ctx.fillStyle = '#e0e0e0';
  ctx.beginPath();
  ctx.arc(gx, gy, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#bbb';
  ctx.beginPath();
  ctx.arc(gx, gy, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 0.8;
  ctx.stroke();
 
  // ── Horn arm ──
  // 0°=down, 90°=right, 180°=up  →  hornRad = (90 - angle) * PI / 180
  var hornRad = (90 - angle) * Math.PI / 180;
 
  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(hornRad);
 
  // arm body
  ctx.fillStyle = '#e8e8e8';
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-2, -8);
  ctx.lineTo(36, -8);
  ctx.quadraticCurveTo(42, -8, 42, 0);
  ctx.quadraticCurveTo(42,  8, 36,  8);
  ctx.lineTo(-2,  8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
 
  // 4 holes along arm
  [12, 20, 28, 36].forEach(function(hx) {
    ctx.fillStyle = '#999';
    ctx.beginPath();
    ctx.arc(hx, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#777';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.fillStyle = '#666';
    ctx.beginPath();
    ctx.arc(hx, 0, 1.5, 0, Math.PI * 2);
    ctx.fill();
  });
 
  // center white hub
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;
  ctx.stroke();
 
  ctx.fillStyle = '#dddddd';
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#bbb';
  ctx.lineWidth = 0.8;
  ctx.stroke();
 
  ctx.fillStyle = '#888';
  ctx.beginPath();
  ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();
 
  ctx.restore();
 
  // ── SG90 label (right portion of body) ──
  ctx.fillStyle = '#4d9fff';
  ctx.font = 'bold 8px Orbitron, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SG90', bx + gearPanelW + (bw - gearPanelW) / 2, y - 4);
  ctx.fillStyle = '#2a5aaa';
  ctx.font = '6px JetBrains Mono, monospace';
  ctx.fillText('SERVO', bx + gearPanelW + (bw - gearPanelW) / 2, y + 7);
 
  // ── 3-pin connector (stacked rectangles on LEFT edge of body) ──
  var conX = bx - 22;  // connector sits just left of blue body
  var con = [
    { name: 'PWM', color: '#dd7700' },  // was SIG
    { name: 'VCC', color: '#cc2222' },
    { name: 'GND', color: '#8b7355' }
  ];
  var slotH   = 12;
  var slotGap = 3;
  var totalH  = con.length * slotH + (con.length - 1) * slotGap;
  var startY  = y - totalH / 2;
 
  con.forEach(function(pd, i) {
    var slotY = startY + i * (slotH + slotGap);
 
    // black slot rectangle
    ctx.fillStyle = '#111';
    ctx.fillRect(conX, slotY, 22, slotH);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(conX, slotY, 22, slotH);
 
    // inner recess
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(conX + 2, slotY + 2, 14, slotH - 4);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.3;
    ctx.strokeRect(conX + 2, slotY + 2, 14, slotH - 4);
 
    // pin dot on left
    var pinX = conX - 6;
    var pinY = slotY + slotH / 2;
 
    c.pins[i].x = pinX;
    c.pins[i].y = pinY;
 
    ctx.fillStyle = pd.color;
    ctx.beginPath();
    ctx.arc(pinX, pinY, 3.5, 0, Math.PI * 2);
    ctx.fill();
 
    // label
    ctx.fillStyle = '#8890a8';
    ctx.font = 'bold 6px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(pd.name, pinX - 5, pinY + 2.5);
  });
 
  // ── Angle display ──
  ctx.fillStyle = '#ffcc44';
  ctx.font = 'bold 9px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(angle + '\u00b0', x, by - 10);
 
  // ── Slider ──
  var aw = 100, ax0 = x - aw / 2, ay0 = by + bh + 16;
  ctx.fillStyle = '#111';
  ctx.fillRect(ax0, ay0, aw, 5);
 
  var av  = Math.min(Math.max(angle / 180, 0), 1);
  var akx = ax0 + av * aw;
 
  ctx.fillStyle = '#ffcc44';
  ctx.beginPath();
  ctx.arc(akx, ay0 + 2.5, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#cc9900';
  ctx.lineWidth = 1;
  ctx.stroke();
 
  c._servoSlider = {
    x: ax0, y: ay0, w: aw, h: 5,
    knobX: akx, knobY: ay0 + 2.5, knobR: 9
  };
 
  ctx.fillStyle = '#5a6080';
  ctx.font = '5px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('0\u00b0',   ax0,           ay0 + 15);
  ctx.fillText('90\u00b0',  ax0 + aw / 2,  ay0 + 15);
  ctx.fillText('180\u00b0', ax0 + aw,      ay0 + 15);
}

function drawBuzzer(c) {
  var x = c.x, y = c.y, playing = !!c.state.playing;
  var wired = typeof isComponentWired === 'function' ? isComponentWired(c) : true;

  if (playing && wired) {
    ctx.shadowColor = '#ff5566';
    ctx.shadowBlur = 10;
  }

  ctx.fillStyle = '#1e0a0a';
  ctx.beginPath();
  ctx.arc(x, y, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4a1a1a';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#0e0404';
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  if (playing && wired) {
    for (var i = 1; i <= 3; i++) {
      ctx.strokeStyle = 'rgba(255,85,102,' + (0.5 / i) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 12 + i * 5, -0.6, 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 12 + i * 5, Math.PI - 0.6, Math.PI + 0.6);
      ctx.stroke();
    }
  }

  ctx.fillStyle = '#e8eaf6';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText((playing && wired) ? '🔊' : '🔇', x, y - 19);

  c.pins.forEach(function(p) {
    p.x = p.side === 'left' ? x - 16 : x + 16;
    p.y = y;

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();

   // label
    ctx.fillStyle = '#8890a8';
    ctx.font = 'bold 7.5px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, p.x, p.y - 8);
  });
}

// ==========================================
// OLED DISPLAY
// ==========================================
function drawSSD1306(c) {
  var x = c.x, y = c.y;
  var w = c.width || 120;
  var h = c.height || 80;
  var wired = typeof isComponentWired === 'function' ? isComponentWired(c) : true;

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.strokeStyle = wired ? '#2a2a4e' : '#5a2a2a';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - w / 2, y - h / 2, w, h);

  var sw = Math.round(w * 0.8);
  var sh = Math.round(h * 0.64);
  var sx = x - sw / 2;
  var sy = y - sh / 2 - 2;

  ctx.fillStyle = wired ? '#0a1628' : '#1a0808';
  ctx.fillRect(sx, sy, sw, sh);
  ctx.strokeStyle = wired ? '#1a3060' : '#4a1a1a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(sx, sy, sw, sh);

  if (wired) {
    var display = c.state.display;
    if (display) {
      var pw = sw / 128;
      var ph = sh / 64;
      for (var page = 0; page < 8; page++) {
        if (!display[page]) continue;
        for (var px = 0; px < 128; px++) {
          var bits = display[page][px] || 0;
          for (var bit = 0; bit < 8; bit++) {
            if (bits & (1 << bit)) {
              ctx.fillStyle = '#4d9fff';
              ctx.fillRect(
                sx + px * pw,
                sy + (page * 8 + bit) * ph,
                Math.max(pw, 1),
                Math.max(ph, 1)
              );
            }
          }
        }
      }
    }
  } else {
    ctx.fillStyle = '#5a1a1a';
    ctx.font = 'bold 9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NO SIGNAL', x, y + 2);
  }

  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 7px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SSD1306', x, y + h / 2 + 12);

  ctx.fillStyle = '#5a6080';
  ctx.font = '5px JetBrains Mono, monospace';
  ctx.fillText('0.96" 128x64', x, y + h / 2 + 20);

  var pinLabels = ['GND', 'VCC', 'SCL', 'SDA'];
  c.pins.forEach(function(p, i) {
    p.x = x - 52 + i * 35;
    p.y = y - h / 2;

    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - 12);
    ctx.stroke();

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e8eaf6';
    ctx.font = 'bold 7px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pinLabels[i], p.x, p.y - 15);
  });
}


