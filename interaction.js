// ==========================================
// INTERACTION HANDLERS - CLEANED + FIXED
// Better tool behavior + safer dragging + mobile zoom
// ==========================================

if (!window.zoomLevel) window.zoomLevel = 1;
var selectedWire = null;
var WIRE_LANE_SPACING = 30;

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

function snapWirePointToGrid(point) {
  var grid = 24;
  return {
    x: Math.round(point.x / grid) * grid,
    y: Math.round(point.y / grid) * grid
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
  // Catch segments whose endpoint is inside the rectangle. The edge-only
  // test below misses that case and can let a wire pass through a component.
  function pointInside(x, y) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }
  if (pointInside(x1, y1) || pointInside(x2, y2)) return true;

  var edges = [
    [rect.left, rect.top, rect.right, rect.top],
    [rect.right, rect.top, rect.right, rect.bottom],
    [rect.right, rect.bottom, rect.left, rect.bottom],
    [rect.left, rect.bottom, rect.left, rect.top]
  ];
  for (var i = 0; i < edges.length; i++) {
    var edge = edges[i];
    if (segmentsIntersect(x1, y1, x2, y2, edge[0], edge[1], edge[2], edge[3])) return true;
    // Also catch collinear overlap with a rectangle edge.
    if (Math.abs(edge[0] - edge[2]) < 0.001 && Math.abs(x1 - x2) < 0.001 &&
        Math.abs(x1 - edge[0]) < 0.001 && Math.max(y1, y2) >= Math.min(edge[1], edge[3]) &&
        Math.min(y1, y2) <= Math.max(edge[1], edge[3])) return true;
    if (Math.abs(edge[1] - edge[3]) < 0.001 && Math.abs(y1 - y2) < 0.001 &&
        Math.abs(y1 - edge[1]) < 0.001 && Math.max(x1, x2) >= Math.min(edge[0], edge[2]) &&
        Math.min(x1, x2) <= Math.max(edge[0], edge[2])) return true;
  }
  return false;
}

function findBlockingComponents(x1, y1, x2, y2, excludeComps) {
  var blocked = [];
  for (var i = 0; i < components.length; i++) {
    var comp = components[i];
    if (excludeComps.indexOf(comp) !== -1) continue;
    var rect = getComponentBounds(comp);
    // Keep wires a little away from component bodies and their labels.
    var padding = 22;
    var safeRect = {
      left: rect.left - padding,
      top: rect.top - padding,
      right: rect.right + padding,
      bottom: rect.bottom + padding
    };
    if (segmentIntersectsRect(x1, y1, x2, y2, safeRect)) blocked.push(safeRect);
  }
  return blocked;
}

function resetSelectedWireRoute() {
  if (!selectedWire) {
    updateStatus('Select a wire first');
    return;
  }
  var p1 = findPinById(selectedWire.pin1Id);
  var p2 = findPinById(selectedWire.pin2Id);
  if (!p1 || !p2) return;
  saveState();
  selectedWire.autoRoute = true;
  if (typeof selectedWire.lane !== 'number') selectedWire.lane = 0;
  selectedWire.waypoints = buildWireWaypoints(p1, p2, [], 0, selectedWire.lane);
  syncWireEndpoints(selectedWire);
  updateStatus('Wire route reset');
  draw();
}

function showConnectionToast(message) {
  var toast = document.getElementById('connection-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  toast.classList.add('visible');
  clearTimeout(showConnectionToast._timer);
  showConnectionToast._timer = setTimeout(function() {
    toast.classList.remove('visible');
    setTimeout(function() { toast.classList.add('hidden'); }, 220);
  }, 2000);
}

function computeAutoWaypoints(x1, y1, x2, y2, excludeComps, stagger, lane) {
  var points = [{ x: x1, y: y1 }];
  var current = { x: x1, y: y1 };
  var margin = 26 + (stagger || 0) * 8;

  // Resolve one blocking component at a time. Each pass checks every
  // component, so a detour cannot simply run through the next component.
  for (var pass = 0; pass < 8; pass++) {
    var blocked = findBlockingComponents(current.x, current.y, x2, y2, excludeComps);
    if (!blocked.length) break;

    var rect = blocked[0];
    var laneOffset = (lane || 0) * WIRE_LANE_SPACING;
    var candidates = [
      { x: rect.left - margin - laneOffset, y: current.y },
      { x: rect.right + margin + laneOffset, y: current.y },
      { x: current.x, y: rect.top - margin },
      { x: current.x, y: rect.bottom + margin }
    ];
    var chosen = null;

    var bestScore = Infinity;
    for (var i = 0; i < candidates.length; i++) {
      var candidate = candidates[i];
      var currentBlocked = findBlockingComponents(current.x, current.y, candidate.x, candidate.y, excludeComps);
      var nextBlocked = findBlockingComponents(candidate.x, candidate.y, x2, y2, excludeComps);
      if (!currentBlocked.length && (!nextBlocked.length || nextBlocked.length < blocked.length)) {
        var score = Math.abs(candidate.x - current.x) + Math.abs(candidate.y - current.y) +
          Math.abs(x2 - candidate.x) + Math.abs(y2 - candidate.y);
        if (score < bestScore) {
          bestScore = score;
          chosen = candidate;
        }
      }
    }

    if (!chosen) {
      chosen = {
        x: current.x < (rect.left + rect.right) / 2
          ? rect.left - margin - laneOffset
          : rect.right + margin + laneOffset,
        y: current.y
      };
    }

    if (chosen.x !== current.x || chosen.y !== current.y) {
      points.push(chosen);
      current = chosen;
    } else {
      break;
    }
  }

  if (current.x !== x2 && current.y !== y2) {
    points.push({ x: x2, y: current.y });
  }
  points.shift();
  return points;
}

// Choose a complete orthogonal route from obstacle boundary coordinates. This
// evaluates the whole two-turn path instead of deciding one bend at a time.
function computeVisibilityRoute(x1, y1, x2, y2, excludeComps, lane) {
  var margin = 30;
  var offset = (lane || 0) * WIRE_LANE_SPACING;
  var xs = [x1, x2, (x1 + x2) / 2 + offset];
  var ys = [y1, y2, (y1 + y2) / 2 + offset];

  // Try several nearby parallel lanes instead of stopping at one midpoint.
  for (var laneStep = -3; laneStep <= 3; laneStep++) {
    ys.push(y1 + laneStep * WIRE_LANE_SPACING);
    ys.push(y2 + laneStep * WIRE_LANE_SPACING);
    xs.push(x1 + laneStep * WIRE_LANE_SPACING);
    xs.push(x2 + laneStep * WIRE_LANE_SPACING);
  }

  components.forEach(function(comp) {
    if (excludeComps.indexOf(comp) !== -1) return;
    var rect = getComponentBounds(comp);
    xs.push(rect.left - margin, rect.right + margin);
    ys.push(rect.top - margin, rect.bottom + margin);
  });

  var best = null;
  var bestScore = Infinity;
  function consider(points) {
    var full = [{ x: x1, y: y1 }].concat(points).concat([{ x: x2, y: y2 }]);
    var score = 0;
    for (var i = 0; i < full.length - 1; i++) {
      var a = full[i];
      var b = full[i + 1];
      if (a.x !== b.x && a.y !== b.y) return;
      if (findBlockingComponents(a.x, a.y, b.x, b.y, excludeComps).length) return;
      score += Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    }
    if (lane && points.length && points[0].y === points[1].y &&
        (points[0].y === y1 || points[0].y === y2)) {
      score += 900;
    }
    score += points.length * 80;
    if (score < bestScore) {
      bestScore = score;
      best = points;
    }
  }

  xs.forEach(function(x) { consider([{ x: x, y: y1 }, { x: x, y: y2 }]); });
  ys.forEach(function(y) { consider([{ x: x1, y: y }, { x: x2, y: y }]); });
  return best || computeAutoWaypoints(x1, y1, x2, y2, excludeComps, 0, lane);
}

function getPinStub(pin, comp, stubLen) {
  /* Give every automatic wire a clear straight exit before turning. */
  stubLen = stubLen || 34;
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

function getPinFanoutOffset(pin, comp) {
  if (!comp || !comp.pins) return 0;
  var index = comp.pins.indexOf(pin);
  if (index < 0) return 0;
  // Give pins on the same component distinct nearby fan-out rows without
  // changing the pins themselves.
  return (index - (comp.pins.length - 1) / 2) * 18;
}

function simplifyWirePath(points) {
  var cleaned = [];
  points.forEach(function(point) {
    var previous = cleaned[cleaned.length - 1];
    if (!previous || previous.x !== point.x || previous.y !== point.y) {
      cleaned.push(point);
    }
  });

  for (var i = cleaned.length - 2; i > 0; i--) {
    var before = cleaned[i - 1];
    var current = cleaned[i];
    var after = cleaned[i + 1];
    if ((before.x === current.x && current.x === after.x) ||
        (before.y === current.y && current.y === after.y)) {
      cleaned.splice(i, 1);
    }
  }
  return cleaned;
}

function wirePathBlocked(points, excludeComps) {
  for (var i = 0; i < points.length - 1; i++) {
    if (findBlockingComponents(
      points[i].x, points[i].y,
      points[i + 1].x, points[i + 1].y,
      excludeComps
    ).length) return true;
  }
  return false;
}

function wirePathNearUnrelatedPin(points, startPin, endPin) {
  function pointSegmentDistanceSquared(px, py, ax, ay, bx, by) {
    var dx = bx - ax;
    var dy = by - ay;
    var length = dx * dx + dy * dy;
    var t = length ? ((px - ax) * dx + (py - ay) * dy) / length : 0;
    t = Math.max(0, Math.min(1, t));
    var nearX = ax + dx * t;
    var nearY = ay + dy * t;
    var offsetX = px - nearX;
    var offsetY = py - nearY;
    return offsetX * offsetX + offsetY * offsetY;
  }

  for (var ci = 0; ci < components.length; ci++) {
    var comp = components[ci];
    for (var pi = 0; pi < comp.pins.length; pi++) {
      var pin = comp.pins[pi];
      if (pin === startPin || pin === endPin) continue;
      var clearance = (pin.hitRadius || 10) + 10;
      for (var si = 0; si < points.length - 1; si++) {
        if (pointSegmentDistanceSquared(
          pin.x, pin.y,
          points[si].x, points[si].y,
          points[si + 1].x, points[si + 1].y
        ) < clearance * clearance) return true;
      }
    }
  }
  return false;
}

function buildWireWaypoints(startPin, endPin, excludeComps, stagger, lane) {
  var startComp = findPinOwner(startPin);
  var endComp = findPinOwner(endPin);
  var stub1 = getPinStub(startPin, startComp);
  var stub2 = getPinStub(endPin, endComp);
  var rawStub1 = { x: stub1.x, y: stub1.y };
  var rawStub2 = { x: stub2.x, y: stub2.y };
  var laneOffset = (lane || 0) * WIRE_LANE_SPACING;
  var startMcu = startComp && (startComp.type === 'esp32' || startComp.type === 'pico');
  var endMcu = endComp && (endComp.type === 'esp32' || endComp.type === 'pico');

  // Give MCU side pins separate straight exit lanes before the wire turns.
  if (startMcu && (startPin.side === 'left' || startPin.side === 'right')) {
    stub1.y += laneOffset;
  }
  if (endMcu && (endPin.side === 'left' || endPin.side === 'right')) {
    stub2.y += laneOffset;
  }

  var blocked = computeAutoWaypoints(stub1.x, stub1.y, stub2.x, stub2.y, excludeComps, stagger, lane);

  var middle;
  // Give nearby wires their own lanes instead of stacking them on one line.
  var startIsHorizontal = startPin.side === 'left' || startPin.side === 'right';
  var endIsHorizontal = endPin.side === 'left' || endPin.side === 'right';
  var isBottomFanout = (startIsHorizontal && endPin.side === 'bottom') ||
    (endIsHorizontal && startPin.side === 'bottom');
  // Component avoidance takes priority over the fan-out layout. If the
  // direct route is blocked, use the obstacle detour instead of allowing a
  // decorative fan-out path to enter a sensor body.
  if (blocked.length > 0 && !isBottomFanout) {
    middle = blocked;
  } else {
    var horiz1 = startIsHorizontal;
    var horiz2 = endIsHorizontal;

    if (horiz1 && horiz2) {
      var midX = (stub1.x + stub2.x) / 2 + laneOffset;
      middle = [{ x: midX, y: stub1.y }, { x: midX, y: stub2.y }];
    } else if (!horiz1 && !horiz2) {
      var midY = (stub1.y + stub2.y) / 2 + laneOffset;
      middle = [{ x: stub1.x, y: midY }, { x: stub2.x, y: midY }];
    } else if (horiz1) {
      var mixedMidX1 = (stub1.x + stub2.x) / 2 + laneOffset;
      var forwardCorridorY = stub1.y + (startMcu ? 0 : laneOffset);
      middle = [];
      if (endPin.side === 'bottom') {
        // Bottom-facing sensor pins fan out below the component instead of
        // sharing the target pin's horizontal line.
        var endPinFanout = getPinFanoutOffset(endPin, endComp);
        var sensorBounds = endComp ? getComponentBounds(endComp) : null;
        var sensorCenterX = sensorBounds ? sensorBounds.left + sensorBounds.width / 2 : stub2.x;
        var outsideSensorX = sensorBounds
          ? (stub1.x <= sensorCenterX ? sensorBounds.left - 28 : sensorBounds.right + 28)
          : (stub1.x + stub2.x) / 2;
        var bottomFanoutY = Math.max(stub1.y, stub2.y) + 36 + laneOffset + endPinFanout;
        // Rejoin the destination pin's own X column directly. The fan-out
        // row provides separation; an additional approach column creates a
        // box-shaped detour.
        var bottomApproachX = stub2.x;
        var bottomMiddle;
        for (var bottomTry = 0; bottomTry < 8; bottomTry++) {
          bottomMiddle = [
            { x: outsideSensorX + laneOffset, y: stub1.y },
            { x: outsideSensorX + laneOffset, y: bottomFanoutY },
            { x: bottomApproachX, y: bottomFanoutY },
            { x: bottomApproachX, y: stub2.y }
          ];
          var bottomRoute = [{ x: stub1.x, y: stub1.y }].concat(bottomMiddle).concat([{ x: stub2.x, y: stub2.y }]);
          if (!wirePathBlocked(bottomRoute, excludeComps) &&
              !wirePathNearUnrelatedPin(bottomRoute, startPin, endPin)) break;
          bottomFanoutY += 32;
        }
        middle = bottomMiddle;
      } else {
      if (forwardCorridorY !== stub1.y) {
        middle.push({ x: stub1.x, y: forwardCorridorY });
      }
      middle.push(
        { x: mixedMidX1, y: forwardCorridorY },
        { x: mixedMidX1, y: stub2.y }
      );
      }
    } else {
      var mixedMidX2 = (stub1.x + stub2.x) / 2 + laneOffset;
      var reverseCorridorY = stub1.y + laneOffset;
      middle = [];
      if (startPin.side === 'bottom') {
        // Sensor-to-board routes use the same dedicated fan-out area.
        var startPinFanout = getPinFanoutOffset(startPin, startComp);
        var reverseFanoutY = Math.max(stub1.y, stub2.y) + 36 + laneOffset + startPinFanout;
        var reverseApproachX = stub1.x;
        var reverseMiddle;
        for (var reverseTry = 0; reverseTry < 8; reverseTry++) {
          reverseMiddle = [
            { x: stub1.x, y: reverseFanoutY },
            { x: reverseApproachX, y: reverseFanoutY },
            { x: reverseApproachX, y: stub2.y }
          ];
          var reverseRoute = [{ x: stub1.x, y: stub1.y }].concat(reverseMiddle).concat([{ x: stub2.x, y: stub2.y }]);
          if (!wirePathBlocked(reverseRoute, excludeComps) &&
              !wirePathNearUnrelatedPin(reverseRoute, startPin, endPin)) break;
          reverseFanoutY += 32;
        }
        middle = reverseMiddle;
      } else {
      if (reverseCorridorY !== stub1.y) {
        middle.push({ x: stub1.x, y: reverseCorridorY });
      }
      middle.push(
        { x: mixedMidX2, y: reverseCorridorY },
        { x: mixedMidX2, y: stub2.y }
      );
      }
    }
  }

  var waypoints = [];
  if (rawStub1.x !== startPin.x || rawStub1.y !== startPin.y) waypoints.push(rawStub1);
  if (stub1.x !== rawStub1.x || stub1.y !== rawStub1.y) waypoints.push(stub1);
  waypoints = waypoints.concat(middle);
  if (stub2.x !== rawStub2.x || stub2.y !== rawStub2.y) waypoints.push(stub2);
  if (rawStub2.x !== endPin.x || rawStub2.y !== endPin.y) waypoints.push(rawStub2);

  // Keep the dedicated bottom-pin fan-out route. The visibility route is
  // used for other connections, but must not overwrite this longer route.
  if (!isBottomFanout) {
    var routedMiddle = computeVisibilityRoute(stub1.x, stub1.y, stub2.x, stub2.y, excludeComps, lane);
    waypoints = [];
    if (rawStub1.x !== startPin.x || rawStub1.y !== startPin.y) waypoints.push(rawStub1);
    if (stub1.x !== rawStub1.x || stub1.y !== rawStub1.y) waypoints.push(stub1);
    waypoints = waypoints.concat(routedMiddle);
    if (stub2.x !== rawStub2.x || stub2.y !== rawStub2.y) waypoints.push(rawStub2);
    if (rawStub2.x !== endPin.x || rawStub2.y !== endPin.y) waypoints.push(rawStub2);
  }
  return simplifyWirePath(waypoints);
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

function rerouteAutomaticWires() {
  wires.forEach(function(w, wi) {
    if (w.autoRoute === false) return;
    if (typeof w.lane !== 'number') w.lane = (wi % 5) - 2;
    var p1 = findPinById(w.pin1Id);
    var p2 = findPinById(w.pin2Id);
    if (!p1 || !p2) return;
    w.x1 = p1.x;
    w.y1 = p1.y;
    w.x2 = p2.x;
    w.y2 = p2.y;
    w.waypoints = buildWireWaypoints(p1, p2, [], 0, w.lane);
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

function getAvailableWireLane() {
  var used = {};
  wires.forEach(function(w) {
    if (typeof w.lane === 'number') used[w.lane] = true;
  });
  var candidates = [0, -1, 1, -2, 2, -3, 3, -4, 4];
  for (var i = 0; i < candidates.length; i++) {
    if (!used[candidates[i]]) return candidates[i];
  }
  return wires.length;
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
      // A manually placed bend becomes part of the user's chosen route.
      dragging.wire.autoRoute = false;
      var snappedWirePoint = snapWirePointToGrid({ x: mouseX, y: mouseY });
      dragging.wire.waypoints[dragging.wpIndex].x = snappedWirePoint.x;
      dragging.wire.waypoints[dragging.wpIndex].y = snappedWirePoint.y;
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

    // Automatic wires follow moved components. Manually edited wires keep
    // their chosen bends while their endpoints remain attached to the pins.
    wires.forEach(function(w, wi) {
      if (w.autoRoute === false) return;
      if (typeof w.lane !== 'number') w.lane = (wi % 5) - 2;
      var p1 = findPinById(w.pin1Id);
      var p2 = findPinById(w.pin2Id);
      if (!p1 || !p2) return;
      w.waypoints = buildWireWaypoints(p1, p2, [], 0, w.lane || 0);
    });

    dragging.sx = mouseX;
    dragging.sy = mouseY;
    draw();
    return;
  }

  var pinUnderCursor = tool === 'wire' ? findPin(mouseX, mouseY) : null;
  var wi = pinUnderCursor ? null : findWireInteractive(mouseX, mouseY);
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
      if (c.type === 'hw201') {
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
    }
  }

  if (tool !== 'delete') {
    /* In Wire mode, a nearby pin must win over an overlapping wire handle. */
    var wirePinHit = tool === 'wire' ? findPin(x, y) : null;
    var wireHit = wirePinHit ? null : findWireInteractive(x, y);
    if (wireHit) {
      selectedWire = wireHit.wire;
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
        newWp = snapWirePointToGrid(newWp);

        w.autoRoute = false;
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
    // Give every automatic wire an unused lane so later wires do not reuse
    // the same bend corridor after the first five connections.
    var wireLane = getAvailableWireLane();
    var autoWaypoints = buildWireWaypoints(wireStart, pin, [], 0, wireLane);

    wires.push({
      x1: wireStart.x,
      y1: wireStart.y,
      x2: pin.x,
      y2: pin.y,
      color: wc,
      pin1Id: pin1Id,
      pin2Id: pin2Id,
      waypoints: autoWaypoints,
      lane: wireLane,
      autoRoute: true
    });

    updateStatus('Connected: ' + wireStart.name + ' → ' + pin.name);
    showConnectionToast('Connected: ' + wireStart.name + ' → ' + pin.name);
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
        w.autoRoute = false;
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

  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
    e.preventDefault();
    redo();
    return;
  }

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
  var oldZoom = window.zoomLevel || 1;
  var newZoom = oldZoom * delta;
  newZoom = Math.min(Math.max(newZoom, 0.25), 3.0);

  if (Math.abs(newZoom - oldZoom) > 0.01) {
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
