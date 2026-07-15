// ==========================================
// INTERACTION HANDLERS - CLEANED + FIXED
// Better tool behavior + safer dragging + mobile zoom
// ==========================================

if (!window.zoomLevel) window.zoomLevel = 1;

var _heldButton = null;
var _touchState = {
  lastDist: null,
  lastMid: null,
  isPinching: false
};

// ==========================================
// HELPERS
// ==========================================

function getCanvasXY(e) {
  if (!canvas) return { x: 0, y: 0 };

  var rect = canvas.getBoundingClientRect();
  var zoom = window.zoomLevel || 1;

  return {
    x: (e.clientX - rect.left) / zoom,
    y: (e.clientY - rect.top) / zoom
  };
}

function findPin(mx, my) {
  var bestPin = null;
  var bestDist = Infinity;

  for (var i = 0; i < components.length; i++) {
    var c = components[i];
    for (var j = 0; j < c.pins.length; j++) {
      var p = c.pins[j];
      var dx = mx - p.x;
      var dy = my - p.y;
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

function findPinOwner(pin) {
  for (var i = 0; i < components.length; i++) {
    var c = components[i];
    for (var j = 0; j < c.pins.length; j++) {
      if (c.pins[j] === pin) return c;
    }
  }
  return null;
}

function segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  function ccw(ax, ay, bx, by, cx, cy) {
    return (cy - ay) * (bx - ax) - (by - ay) * (cx - ax);
  }
  var d1 = ccw(x3, y3, x4, y4, x1, y1);
  var d2 = ccw(x3, y3, x4, y4, x2, y2);
  var d3 = ccw(x1, y1, x2, y2, x3, y3);
  var d4 = ccw(x1, y1, x2, y2, x4, y4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function segmentIntersectsRect(x1, y1, x2, y2, rect) {
  if (Math.max(x1, x2) < rect.left || Math.min(x1, x2) > rect.right ||
      Math.max(y1, y2) < rect.top || Math.min(y1, y2) > rect.bottom) {
    return false;
  }
  var edges = [
    [rect.left, rect.top, rect.right, rect.top],
    [rect.right, rect.top, rect.right, rect.bottom],
    [rect.right, rect.bottom, rect.left, rect.bottom],
    [rect.left, rect.bottom, rect.left, rect.top]
  ];
  for (var i = 0; i < edges.length; i++) {
    if (segmentsIntersect(x1, y1, x2, y2, edges[i][0], edges[i][1], edges[i][2], edges[i][3])) return true;
  }
  return false;
}

function findBlockingComponent(x1, y1, x2, y2, excludeComps) {
  for (var i = 0; i < components.length; i++) {
    var comp = components[i];
    if (excludeComps.indexOf(comp) !== -1) continue;
    var rect = getComponentBounds(comp);
    if (segmentIntersectsRect(x1, y1, x2, y2, rect)) return rect;
  }
  return null;
}

function computeAutoWaypoints(x1, y1, x2, y2, excludeComps, stagger) {
  var rect = findBlockingComponent(x1, y1, x2, y2, excludeComps);
  if (!rect) return [];

  var candidates = [{ x: x1, y: y2 }, { x: x2, y: y1 }];

  for (var i = 0; i < candidates.length; i++) {
    var wp = candidates[i];
    if (!segmentIntersectsRect(x1, y1, wp.x, wp.y, rect) &&
        !segmentIntersectsRect(wp.x, wp.y, x2, y2, rect)) {
      return [wp];
    }
  }

  var margin = 55 + (stagger || 0) * 12;
  var midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
  var cornerX = midX < (rect.left + rect.right) / 2 ? rect.left - margin : rect.right + margin;
  return [{ x: cornerX, y: y1 }, { x: cornerX, y: y2 }];
}

function getPinStub(pin, comp, stubLen) {
  stubLen = stubLen || 22;
  var bounds = comp ? getComponentBounds(comp) : null;

  if (pin.side === 'left') {
    var edgeL = bounds ? Math.min(bounds.left, pin.x) : pin.x;
    return { x: edgeL - stubLen, y: pin.y };
  }
  if (pin.side === 'right') {
    var edgeR = bounds ? Math.max(bounds.right, pin.x) : pin.x;
    return { x: edgeR + stubLen, y: pin.y };
  }
  if (pin.side === 'top') {
    var edgeT = bounds ? Math.min(bounds.top, pin.y) : pin.y;
    return { x: pin.x, y: edgeT - stubLen };
  }
  if (pin.side === 'bottom') {
    var edgeB = bounds ? Math.max(bounds.bottom, pin.y) : pin.y;
    return { x: pin.x, y: edgeB + stubLen };
  }
  return { x: pin.x, y: pin.y };
}

function buildWireWaypoints(startPin, endPin, excludeComps, stagger) {
  var startComp = findPinOwner(startPin);
  var endComp = findPinOwner(endPin);
  var stub1 = getPinStub(startPin, startComp);
  var stub2 = getPinStub(endPin, endComp);

  var blocked = computeAutoWaypoints(stub1.x, stub1.y, stub2.x, stub2.y, excludeComps, stagger);

  var middle;
  if (blocked.length > 0) {
    middle = blocked;
  } else {
    var horiz1 = startPin.side === 'left' || startPin.side === 'right';
    var horiz2 = endPin.side === 'left' || endPin.side === 'right';

    if (horiz1 && horiz2) {
      var midX = (stub1.x + stub2.x) / 2;
      middle = [{ x: midX, y: stub1.y }, { x: midX, y: stub2.y }];
    } else if (!horiz1 && !horiz2) {
      var midY = (stub1.y + stub2.y) / 2;
      middle = [{ x: stub1.x, y: midY }, { x: stub2.x, y: midY }];
    } else if (horiz1) {
      middle = [{ x: stub2.x, y: stub1.y }];
    } else {
      middle = [{ x: stub1.x, y: stub2.y }];
    }
  }

  var waypoints = [];
  if (stub1.x !== startPin.x || stub1.y !== startPin.y) waypoints.push(stub1);
  waypoints = waypoints.concat(middle);
  if (stub2.x !== endPin.x || stub2.y !== endPin.y) waypoints.push(stub2);

  return waypoints;
}

function findComponent(mx, my) {
  for (var i = components.length - 1; i >= 0; i--) {
    var c = components[i];
    var hw = (c.width || 30) / 2 + 10;
    var hh = (c.height || 30) / 2 + 10;
    var cx, cy;

    if (c.type === 'esp32' || c.type === 'pico') {
      cx = c.x + (c.width / 2);
      cy = c.y + (c.height / 2);
    } else {
      cx = c.x;
      cy = c.y;
    }

    if (Math.abs(mx - cx) < hw && Math.abs(my - cy) < hh) return c;
  }

  return null;
}

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

function syncWireEndpoints(w) {
  var p1 = findPinById(w.pin1Id);
  var p2 = findPinById(w.pin2Id);
  if (p1) { w.x1 = p1.x; w.y1 = p1.y; }
  if (p2) { w.x2 = p2.x; w.y2 = p2.y; }
}

function syncAllWireEndpoints() {
  wires.forEach(function(w) {
    syncWireEndpoints(w);
  });
}

function findWireInteractive(mx, my) {
  for (var wi = 0; wi < wires.length; wi++) {
    var w = wires[wi];
    var waypoints = w.waypoints || [];

    for (var wpi = 0; wpi < waypoints.length; wpi++) {
      var wp = waypoints[wpi];
      var dx = mx - wp.x;
      var dy = my - wp.y;
      if (dx * dx + dy * dy < 64) {
        return { wire: w, type: 'waypoint', wpIndex: wpi };
      }
    }

    var handles = w._handles || [];
    for (var hi = 0; hi < handles.length; hi++) {
      var h = handles[hi];
      var dx2 = mx - h.x;
      var dy2 = my - h.y;
      if (dx2 * dx2 + dy2 * dy2 < 100) {
        return { wire: w, type: 'handle', segIndex: h.segIndex };
      }
    }
  }

  return null;
}

function hasWireBetweenPins(pinA, pinB) {
  var id1 = getPinId(pinA);
  var id2 = getPinId(pinB);
  if (!id1 || !id2) return false;

  return wires.some(function(w) {
    return (
      (w.pin1Id === id1 && w.pin2Id === id2) ||
      (w.pin1Id === id2 && w.pin2Id === id1)
    );
  });
}

function releaseHeldButton() {
  if (_heldButton) {
    _heldButton.comp.state.pressed = false;
    _heldButton = null;
    updateStatus('Button released');
    if (typeof draw === 'function') draw();
  }
}

function clearDragging(resetCursor) {
  dragging = null;
  if (canvas && resetCursor) {
    canvas.style.cursor = 'crosshair';
  }
}

function showZoomBadge(zoomValue) {
  var badge = document.getElementById('zoom-badge');
  if (!badge) return;

  badge.textContent = Math.round(zoomValue * 100) + '%';
  badge.style.display = 'block';

  clearTimeout(badge._hideTimer);
  badge._hideTimer = setTimeout(function() {
    badge.style.display = 'none';
  }, 1500);
}

function getComponentCenter(c) {
  if (c.type === 'esp32' || c.type === 'pico') {
    return {
      x: c.x + (c.width / 2),
      y: c.y + (c.height / 2)
    };
  }

  return { x: c.x, y: c.y };
}

function isPIRDomeHit(c, mx, my) {
  if (!c || c.type !== 'pir') return false;

  var layout = typeof getPIRLayout === 'function' ? getPIRLayout(c) : null;
  if (!layout) return false;

  var dx = (mx - layout.domeCx) / layout.domeRx;
  var dy = (my - layout.domeCy) / layout.domeRy;
  return (dx * dx + dy * dy) <= 1.06;
}

function isEditorTarget(target) {
  if (!target) return false;
  if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return true;
  if (target.closest && target.closest('.CodeMirror')) return true;
  return false;
}

function _getTouchDist(t0, t1) {
  var dx = t1.clientX - t0.clientX;
  var dy = t1.clientY - t0.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function _getTouchMid(t0, t1) {
  return {
    x: (t0.clientX + t1.clientX) / 2,
    y: (t0.clientY + t1.clientY) / 2
  };
}

// ==========================================
// MOUSE MOVE
// ==========================================

function handleCanvasMouseMove(e) {
  var pos = getCanvasXY(e);
  mouseX = pos.x;
  mouseY = pos.y;

  if (dragging) {
    if (dragging.type === 'ultrasonic-slider') {
      var s = dragging.comp._slider;
      var relX = Math.min(Math.max(mouseX - s.x, 0), s.w);
      dragging.comp.state.distance = Math.round(relX / s.w * 398 + 2);
      draw();
      return;
    }

    if (dragging.type === 'dht-temp') {
      var ts = dragging.comp._tempSlider;
      var relY = Math.min(Math.max(mouseY - ts.y, 0), ts.h);
      var tempNorm = 1 - (relY / ts.h);
      dragging.comp.state.temperature = Math.round((-40 + tempNorm * 120) * 10) / 10;
      draw();
      return;
    }

    if (dragging.type === 'dht-hum') {
      var hs = dragging.comp._humSlider;
      var relY2 = Math.min(Math.max(mouseY - hs.y, 0), hs.h);
      var humNorm = 1 - (relY2 / hs.h);
      dragging.comp.state.humidity = Math.round(humNorm * 1000) / 10;
      draw();
      return;
    }

    if (dragging.type === 'servo-slider') {
      var ss = dragging.comp._servoSlider;
      var relX2 = Math.min(Math.max(mouseX - ss.x, 0), ss.w);
      dragging.comp.state.angle = Math.round(relX2 / ss.w * 180);
      draw();
      return;
    }

    if (dragging.type === 'ldr-slider') {
      var ls = dragging.comp._slider;
      var relY = Math.min(Math.max(mouseY - ls.y, 0), ls.h);
      dragging.comp.state.light = Math.round((1 - relY / ls.h) * 4095);
      draw();
      return;
    }

    if (dragging.type === 'joystick-x') {
      var jxs = dragging.comp._xSlider;
      var relX4 = Math.min(Math.max(mouseX - jxs.x, 0), jxs.w);
      dragging.comp.state.vx = Math.round(relX4 / jxs.w * 4095);
      draw();
      return;
    }

    if (dragging.type === 'joystick-y') {
      var jys = dragging.comp._ySlider;
      var relX5 = Math.min(Math.max(mouseX - jys.x, 0), jys.w);
      dragging.comp.state.vy = Math.round(relX5 / jys.w * 4095);
      draw();
      return;
    }

    if (dragging.type === 'rgb-slider') {
      var rs = dragging.slider;
      var relX6 = Math.min(Math.max(mouseX - rs.x, 0), rs.w);
      dragging.comp.state[rs.channel] = Math.round(relX6 / rs.w * 255);
      draw();
      return;
    }

     if (dragging.type === 'flame-slider') {
      var fls = dragging.comp._slider;
      var relY = Math.min(Math.max(mouseY - fls.y, 0), fls.h);
      dragging.comp.state.analog = Math.round((1 - relY / fls.h) * 4095);
      dragging.comp.state.detected = dragging.comp.state.analog < 2000;
      draw();
      return;
    }

    if (dragging.type === 'wire-waypoint') {
      dragging.wire.waypoints[dragging.wpIndex].x = mouseX;
      dragging.wire.waypoints[dragging.wpIndex].y = mouseY;
      syncWireEndpoints(dragging.wire);
      draw();
      return;
    }

    var dx = mouseX - dragging.sx;
    var dy = mouseY - dragging.sy;
    dragging.comp.x += dx;
    dragging.comp.y += dy;

    if (dragging.comp.pins) {
      dragging.comp.pins.forEach(function(p) {
        p.x += dx;
        p.y += dy;
      });
    }

    syncAllWireEndpoints();

    dragging.sx = mouseX;
    dragging.sy = mouseY;
    draw();
    return;
  }

  var wi = findWireInteractive(mouseX, mouseY);
  if (wi && tool !== 'delete') {
    canvas.style.cursor = wi.type === 'waypoint' ? 'grab' : 'crosshair';
  } else if (findPin(mouseX, mouseY)) {
    canvas.style.cursor = 'pointer';
  } else if (tool === 'move' && findComponent(mouseX, mouseY)) {
    canvas.style.cursor = 'move';
  } else {
    canvas.style.cursor = 'crosshair';
  }

  if (wireStart && tool === 'wire') draw();
}

// ==========================================
// MOUSE DOWN
// ==========================================

function handleCanvasMouseDown(e) {
  var pos = getCanvasXY(e);
  var x = pos.x;
  var y = pos.y;

  if (tool === 'wire') {
    for (var i = 0; i < components.length; i++) {
      var c = components[i];

      if (c.type === 'ultrasonic' && c._slider) {
        var s = c._slider;
        var dx0 = x - s.knobX;
        var dy0 = y - s.knobY;
        if (dx0 * dx0 + dy0 * dy0 < s.knobR * s.knobR) {
          saveState();
          dragging = { comp: c, type: 'ultrasonic-slider' };
          return;
        }
      }

      if (c.type === 'dht' && c._tempSlider) {
        var ts = c._tempSlider;
        var dx1 = x - ts.knobX;
        var dy1 = y - ts.knobY;
        if (dx1 * dx1 + dy1 * dy1 < ts.knobR * ts.knobR) {
          saveState();
          dragging = { comp: c, type: 'dht-temp' };
          return;
        }
      }

      if (c.type === 'dht' && c._humSlider) {
        var hs = c._humSlider;
        var dx2 = x - hs.knobX;
        var dy2 = y - hs.knobY;
        if (dx2 * dx2 + dy2 * dy2 < hs.knobR * hs.knobR) {
          saveState();
          dragging = { comp: c, type: 'dht-hum' };
          return;
        }
      }

      if (c.type === 'servo' && c._servoSlider) {
        var ss = c._servoSlider;
        var dx3 = x - ss.knobX;
        var dy3 = y - ss.knobY;
        if (dx3 * dx3 + dy3 * dy3 < ss.knobR * ss.knobR) {
          saveState();
          dragging = { comp: c, type: 'servo-slider' };
          return;
        }
      }

      if (c.type === 'ldr' && c._slider) {
        var ls = c._slider;
        var dx4 = x - ls.knobX;
        var dy4 = y - ls.knobY;
        if (dx4 * dx4 + dy4 * dy4 < ls.knobR * ls.knobR) {
          saveState();
          dragging = { comp: c, type: 'ldr-slider' };
          return;
        }
      }

      if (c.type === 'joystick' && c._xSlider) {
        var jxs = c._xSlider;
        var dx5 = x - jxs.knobX;
        var dy5 = y - jxs.knobY;
        if (dx5 * dx5 + dy5 * dy5 < jxs.knobR * jxs.knobR) {
          saveState();
          dragging = { comp: c, type: 'joystick-x' };
          return;
        }
      }

      if (c.type === 'joystick' && c._ySlider) {
        var jys = c._ySlider;
        var dx6 = x - jys.knobX;
        var dy6 = y - jys.knobY;
        if (dx6 * dx6 + dy6 * dy6 < jys.knobR * jys.knobR) {
          saveState();
          dragging = { comp: c, type: 'joystick-y' };
          return;
        }
      }

      if (c.type === 'joystick') {
        var jdx = x - c.x;
        var jdy = y - c.y;
        if (jdx * jdx + jdy * jdy < 196) {
          saveState();
          c.state.sw = !c.state.sw;
          updateStatus('Joystick SW: ' + (c.state.sw ? 'pressed' : 'released'));
          draw();
          return;
        }
      }

      if (c.type === 'rgb_led') {
        var sliders = ['_rSlider', '_gSlider', '_bSlider'];
        for (var si = 0; si < sliders.length; si++) {
          var rgbSlider = c[sliders[si]];
          if (rgbSlider) {
            var dx7 = x - rgbSlider.knobX;
            var dy7 = y - rgbSlider.knobY;
            if (dx7 * dx7 + dy7 * dy7 < rgbSlider.knobR * rgbSlider.knobR) {
              saveState();
              dragging = { comp: c, type: 'rgb-slider', slider: rgbSlider };
              return;
            }
          }
        }
      }

      if (c.type === 'button') {
        var bdx = x - c.x;
        var bdy = y - c.y;
        if (bdx * bdx + bdy * bdy < 225) {
          saveState();
          c.state.pressed = true;
          _heldButton = { comp: c };
          updateStatus('Button held');
          draw();
          return;
        }
      }

      if(c.type === 'ky004') {
        var kdx = x - c.x;
        var kdy = y - c.y;
        if (kdx * kdx + kdy * kdy < 225) {
          saveState();
          c.state.pressed = !c.state.pressed;
          updateStatus('Key Switch: ' + (c.state.pressed ? 'Pressed' : 'Released'));
          draw();
          return;
        }
      }
      if (c.type === 'sw420') {
        var vdx = x - c.x;
        var vdy = y - c.y;
        if (vdx * vdx + vdy * vdy < 225) {
          saveState();
          c.state.triggered = !c.state.triggered;
          if (c.state.triggered) {
            c._shake = { startTime: Date.now() };
          }
          updateStatus('Vibration: ' + (c.state.triggered ? 'Triggered!' : 'Stable'));
          draw();
          return;
        }
      }
       if (c.type === 'flame' && c._slider) {
        var fs = c._slider;
        var fdx2 = x - fs.knobX;
        var fdy2 = y - fs.knobY;
        if (fdx2 * fdx2 + fdy2 * fdy2 < fs.knobR * fs.knobR) {
          saveState();
          dragging = { comp: c, type: 'flame-slider' };
          return;
        }
      }
      if (c.type === 'flame') {
        var fdx = x - c.x;
        var fdy = y - c.y;
        if (fdx * fdx + fdy * fdy < 225) {
          saveState();
          c.state.detected = !c.state.detected;
          c.state.analog = c.state.detected ? 200 : 4095;
          updateStatus('Flame: ' + (c.state.detected ? 'Detected!' : 'Clear'));
          draw();
          return;
        }
      }
      if (c.type === 'ky032') {
        var odx = x - c.x;
        var ody = y - c.y;
        if (odx * odx + ody * ody < 324) {
          saveState();
          c.state.detected = !c.state.detected;
          updateStatus('Obstacle: ' + (c.state.detected ? 'Detected!' : 'Clear'));
          draw();
          return;
        }
      }
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
    }
  }

  if (tool !== 'delete') {
    var wireHit = findWireInteractive(x, y);
    if (wireHit) {
      if (wireHit.type === 'waypoint') {
        saveState();
        dragging = { type: 'wire-waypoint', wire: wireHit.wire, wpIndex: wireHit.wpIndex };
        canvas.style.cursor = 'grabbing';
        return;
      }

      if (wireHit.type === 'handle') {
        saveState();
        var w = wireHit.wire;
        if (!w.waypoints) w.waypoints = [];

        var pts = [{ x: w.x1, y: w.y1 }].concat(w.waypoints).concat([{ x: w.x2, y: w.y2 }]);
        var seg = wireHit.segIndex;
        var newWp = {
          x: (pts[seg].x + pts[seg + 1].x) / 2,
          y: (pts[seg].y + pts[seg + 1].y) / 2
        };

        w.waypoints.splice(seg, 0, newWp);
        dragging = { type: 'wire-waypoint', wire: w, wpIndex: seg };
        canvas.style.cursor = 'grabbing';
        draw();
        return;
      }
    }
  }

  if (tool === 'move') {
    var comp = findComponent(x, y);
    if (comp) {
      saveState();
      dragging = { comp: comp, sx: x, sy: y };
      updateStatus('Moving...');
    }
    return;
  }

  if (tool === 'delete') {
    for (var wi = wires.length - 1; wi >= 0; wi--) {
      var ww = wires[wi];
      var dx8 = x - ww.x1;
      var dy8 = y - ww.y1;
      var dx9 = x - ww.x2;
      var dy9 = y - ww.y2;

      if (dx8 * dx8 + dy8 * dy8 < 144 || dx9 * dx9 + dy9 * dy9 < 144) {
        saveState();
        wires.splice(wi, 1);
        updateStatus('Wire deleted');
        draw();
        return;
      }

      var wps = ww.waypoints || [];
      for (var wpi2 = 0; wpi2 < wps.length; wpi2++) {
        var dxw = x - wps[wpi2].x;
        var dyw = y - wps[wpi2].y;
        if (dxw * dxw + dyw * dyw < 64) {
          saveState();
          wires.splice(wi, 1);
          updateStatus('Wire deleted');
          draw();
          return;
        }
      }
    }

    var targetComp = findComponent(x, y);
    if (targetComp) {
      saveState();
      wires = wires.filter(function(wf) {
        return wf.pin1Id.indexOf(targetComp.id) < 0 && wf.pin2Id.indexOf(targetComp.id) < 0;
      });
      components = components.filter(function(cmp) {
        return cmp.id !== targetComp.id;
      });
      updateStatus('Component deleted');
      draw();
    }

    return;
  }

  if (tool === 'wire') {
    var pin = findPin(x, y);

    if (!pin) {
      if (!wireStart) {
        for (var pi = 0; pi < components.length; pi++) {
          var pir = components[pi];
          if (pir.type === 'pir' && isPIRDomeHit(pir, x, y)) {
            saveState();
            pir.state.motion = !pir.state.motion;
            updateStatus('PIR: ' + (pir.state.motion ? 'Motion detected!' : 'Clear'));
            draw();
            return;
          }
        }
      }

      wireStart = null;
      draw();
      return;
    }

    if (!wireStart) {
      wireStart = pin;
      updateStatus('Start: ' + pin.name);
      draw();
      return;
    }

    if (pin === wireStart) {
      wireStart = null;
      updateStatus('Wire cancelled');
      draw();
      return;
    }

    if (hasWireBetweenPins(wireStart, pin)) {
      updateStatus('Those pins are already connected');
      wireStart = null;
      draw();
      return;
    }

    var pin1Id = getPinId(wireStart);
    var pin2Id = getPinId(pin);

    if (!pin1Id || !pin2Id) {
      updateStatus('Could not connect those pins');
      wireStart = null;
      draw();
      return;
    }

    saveState();

    var wc = '#7aa2f7';
    if (wireStart.type === 'power') wc = '#f7768e';
    else if (wireStart.type === 'gnd') wc = '#8b7355';
    else if (wireStart.type === 'uart') wc = '#7dcfff';
    else if (wireStart.type === 'gpio') wc = '#9ece6a';

    var startComp = findPinOwner(wireStart);
    var endComp = findPinOwner(pin);
    var existingCount = wires.filter(function(w) {
      return w.pin1Id.indexOf(startComp.id) === 0 || w.pin2Id.indexOf(startComp.id) === 0 ||
             w.pin1Id.indexOf(endComp.id) === 0 || w.pin2Id.indexOf(endComp.id) === 0;
    }).length;
    var autoWaypoints = buildWireWaypoints(wireStart, pin, [], existingCount);

    wires.push({
      x1: wireStart.x,
      y1: wireStart.y,
      x2: pin.x,
      y2: pin.y,
      color: wc,
      pin1Id: pin1Id,
      pin2Id: pin2Id,
      waypoints: autoWaypoints
    });

    updateStatus('Connected: ' + wireStart.name + ' → ' + pin.name);
    wireStart = null;
    draw();
  }
}

// ==========================================
// RELEASE HANDLERS
// ==========================================

function handlePointerRelease() {
  releaseHeldButton();
  clearDragging(true);
}

function handleCanvasMouseLeave() {
  releaseHeldButton();
  if (dragging && dragging.type === 'wire-waypoint') {
    clearDragging(true);
  }
}

// ==========================================
// DOUBLE CLICK
// ==========================================

function handleCanvasDoubleClick(e) {
  var pos = getCanvasXY(e);
  var x = pos.x;
  var y = pos.y;

  for (var wi = 0; wi < wires.length; wi++) {
    var w = wires[wi];
    var wps = w.waypoints || [];

    for (var wpi = 0; wpi < wps.length; wpi++) {
      var dx = x - wps[wpi].x;
      var dy = y - wps[wpi].y;
      if (dx * dx + dy * dy < 100) {
        saveState();
        w.waypoints.splice(wpi, 1);
        updateStatus('Waypoint removed');
        draw();
        return;
      }
    }
  }
}

// ==========================================
// TOUCH SUPPORT
// ==========================================

function handleCanvasTouchStart(e) {
  e.preventDefault();

  if (e.touches.length === 2) {
    releaseHeldButton();
    _touchState.isPinching = true;
    _touchState.lastDist = _getTouchDist(e.touches[0], e.touches[1]);
    _touchState.lastMid = _getTouchMid(e.touches[0], e.touches[1]);
    wireStart = null;
    clearDragging(true);
    return;
  }

  _touchState.isPinching = false;
  _touchState.lastDist = null;
  _touchState.lastMid = null;

  if (e.touches.length === 1) {
    var t = e.touches[0];
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      clientX: t.clientX,
      clientY: t.clientY,
      bubbles: true
    }));
  }
}

function handleCanvasTouchMove(e) {
  e.preventDefault();

  if (e.touches.length === 2) {
    _touchState.isPinching = true;

    var newDist = _getTouchDist(e.touches[0], e.touches[1]);

    if (_touchState.lastDist !== null) {
      var ratio = newDist / _touchState.lastDist;
      var oldZoom = window.zoomLevel || 1;
      var newZoom = Math.min(Math.max(oldZoom * ratio, 0.25), 3.0);

      if (Math.abs(newZoom - oldZoom) > 0.005) {
        window.zoomLevel = newZoom;
        updateStatus('Zoom: ' + Math.round(newZoom * 100) + '%');
        showZoomBadge(newZoom);
        if (typeof resizeCanvas === 'function') resizeCanvas();
      }
    }

    _touchState.lastDist = newDist;
    _touchState.lastMid = _getTouchMid(e.touches[0], e.touches[1]);
    return;
  }

  if (_touchState.isPinching) return;

  if (e.touches.length === 1) {
    var t = e.touches[0];
    canvas.dispatchEvent(new MouseEvent('mousemove', {
      clientX: t.clientX,
      clientY: t.clientY,
      bubbles: true
    }));
  }
}

function handleCanvasTouchEnd(e) {
  e.preventDefault();
  releaseHeldButton();

  if (e.touches.length === 0) {
    _touchState.isPinching = false;
    _touchState.lastDist = null;
    _touchState.lastMid = null;
    canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return;
  }

  if (e.touches.length === 1 && _touchState.isPinching) {
    _touchState.isPinching = false;
    _touchState.lastDist = null;
    _touchState.lastMid = null;
    return;
  }

  _touchState.isPinching = false;
  _touchState.lastDist = null;
  _touchState.lastMid = null;
}

function handleCanvasTouchCancel(e) {
  e.preventDefault();
  _touchState.isPinching = false;
  _touchState.lastDist = null;
  _touchState.lastMid = null;
  handlePointerRelease();
}

// ==========================================
// KEYBOARD SHORTCUTS
// ==========================================

window.addEventListener('keydown', function(e) {
  if (isEditorTarget(e.target)) return;

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undo();
    return;
  }

  if (e.key === 'w' || e.key === 'W') setTool('wire');
  if (e.key === 'm' || e.key === 'M') setTool('move');
  if (e.key === 'd' || e.key === 'D') setTool('delete');

  if (e.key === 'Escape') {
    wireStart = null;
    handlePointerRelease();
    if (typeof draw === 'function') draw();
  }
});

// ==========================================
// WHEEL ZOOM
// ==========================================

function handleCanvasWheel(e) {
  e.preventDefault();

  if (!window.zoomLevel) window.zoomLevel = 1;

  var delta = e.deltaY > 0 ? 0.9 : 1.1;
  var newZoom = window.zoomLevel * delta;
  newZoom = Math.min(Math.max(newZoom, 0.25), 3.0);

  if (Math.abs(newZoom - window.zoomLevel) > 0.01) {
    window.zoomLevel = newZoom;
    updateStatus('Zoom: ' + Math.round(newZoom * 100) + '%');
    showZoomBadge(newZoom);
    if (typeof resizeCanvas === 'function') resizeCanvas();
  }
}

// ==========================================
// EVENT BINDING
// ==========================================

if (canvas) {
  canvas.addEventListener('mousemove', handleCanvasMouseMove);
  canvas.addEventListener('mousedown', handleCanvasMouseDown);
  canvas.addEventListener('mouseleave', handleCanvasMouseLeave);
  canvas.addEventListener('dblclick', handleCanvasDoubleClick);
  canvas.addEventListener('touchstart', handleCanvasTouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleCanvasTouchMove, { passive: false });
  canvas.addEventListener('touchend', handleCanvasTouchEnd, { passive: false });
  canvas.addEventListener('touchcancel', handleCanvasTouchCancel, { passive: false });
  canvas.addEventListener('wheel', handleCanvasWheel, { passive: false });

  window.addEventListener('mouseup', handlePointerRelease);
}
