// wireNudge.js (v2: stable placement)
// Draw-time de-overlap for orthogonal wires. It never changes w.waypoints.
//
// Wires are placed one after another in a fixed order (w._nudgeRank, then list
// position). Each wire keeps its own route where it is free, and only moves a
// few pixels sideways when it would sit on top of a wire placed before it.
// Because earlier wires never react to later ones, wires you are NOT moving
// stay exactly where they are while you drag another component.

var WIRE_NUDGE_SPACING = 7;   // minimum gap between parallel wires (line is 2.5px)
var WIRE_NUDGE_OFFSETS = [0, 1, -1, 2, -2, 3, -3, 4, -4];  // tried in this order

function wireNudgeRawPoints(w) {
  return [{ x: w.x1, y: w.y1 }].concat(w.waypoints || []).concat([{ x: w.x2, y: w.y2 }]);
}

function computeWireRenderPaths(wireList) {
  var order = wireList.map(function(w, i) { return { w: w, i: i }; });
  order.sort(function(a, b) {
    return ((a.w._nudgeRank || 0) - (b.w._nudgeRank || 0)) || (a.i - b.i);
  });

  var placed = [];  // already-placed interior segments of earlier wires
  var minGap = WIRE_NUDGE_SPACING - 0.5;

  function conflicts(horiz, coord, lo, hi, owner) {
    for (var k = 0; k < placed.length; k++) {
      var p = placed[k];
      if (p.owner === owner || p.horiz !== horiz) continue;
      if (Math.abs(p.coord - coord) >= minGap) continue;
      if (Math.min(hi, p.hi) - Math.max(lo, p.lo) > 1) return true;
    }
    return false;
  }

  order.forEach(function(entry) {
    var w = entry.w;
    var pts = wireNudgeRawPoints(w).map(function(p) { return { x: p.x, y: p.y }; });

    // Interior segments only: the first and last segment touch the pins.
    for (var i = 1; i <= pts.length - 3; i++) {
      var a = pts[i], b = pts[i + 1];
      var horiz;
      if (Math.abs(a.y - b.y) < 0.5 && Math.abs(a.x - b.x) >= 0.5) horiz = true;
      else if (Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) >= 0.5) horiz = false;
      else continue;

      var coord = horiz ? a.y : a.x;
      var lo = horiz ? Math.min(a.x, b.x) : Math.min(a.y, b.y);
      var hi = horiz ? Math.max(a.x, b.x) : Math.max(a.y, b.y);

      var chosen = coord;
      for (var t = 0; t < WIRE_NUDGE_OFFSETS.length; t++) {
        var c = coord + WIRE_NUDGE_OFFSETS[t] * WIRE_NUDGE_SPACING;
        if (!conflicts(horiz, c, lo, hi, w)) { chosen = c; break; }
      }

      // Segments alternate H/V, so moving this one only changes one axis of
      // its two end points and never conflicts with its neighbours.
      if (horiz) { a.y = chosen; b.y = chosen; }
      else       { a.x = chosen; b.x = chosen; }

      placed.push({ owner: w, horiz: horiz, coord: chosen, lo: lo, hi: hi });
    }

    // Stored for drawing only; not enumerable so it is not saved in projects.
    Object.defineProperty(w, '_renderPts', {
      value: pts, writable: true, configurable: true, enumerable: false
    });
  });
}

if (typeof module !== 'undefined') module.exports = { computeWireRenderPaths: computeWireRenderPaths };
