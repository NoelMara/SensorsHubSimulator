// wireNudge.js
// Draw-time "nudging" for orthogonal wires.
//
// The router in interaction.js finds a path for each wire, but wires can still
// end up running on top of each other (close components, shared corridors,
// fallback detours, manual routes, old saved projects). This module does NOT
// change w.waypoints. It takes the raw points of every wire, finds segments that
// share the same corridor and overlap, and spreads them into parallel tracks a
// few pixels apart. The result is stored in w._renderPts for drawing only.

var WIRE_NUDGE_SPACING = 7;   // px between parallel wires (line width is 2.5)
var WIRE_NUDGE_BAND = 6;      // segments closer than this count as "same corridor"

function wireNudgeRawPoints(w) {
  return [{ x: w.x1, y: w.y1 }].concat(w.waypoints || []).concat([{ x: w.x2, y: w.y2 }]);
}

function computeWireRenderPaths(wireList) {
  var paths = wireList.map(function(w) {
    return wireNudgeRawPoints(w).map(function(p) { return { x: p.x, y: p.y }; });
  });

  // Collect interior segments only. Segment 0 and the last segment touch the
  // pins (the short stubs), so they must never move.
  var segs = [];
  paths.forEach(function(pts, wi) {
    for (var i = 1; i <= pts.length - 3; i++) {
      var a = pts[i], b = pts[i + 1];
      if (Math.abs(a.y - b.y) < 0.5 && Math.abs(a.x - b.x) >= 0.5) {
        segs.push({ wi: wi, i: i, horiz: true, coord: a.y,
          lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x) });
      } else if (Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) >= 0.5) {
        segs.push({ wi: wi, i: i, horiz: false, coord: a.x,
          lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y) });
      }
    }
  });

  [true, false].forEach(function(horiz) {
    var list = segs.filter(function(s) { return s.horiz === horiz; });
    list.sort(function(p, q) { return p.coord - q.coord; });

    // 1) Group segments whose coordinate is nearly the same (a "band").
    var bands = [];
    list.forEach(function(s) {
      var band = bands[bands.length - 1];
      if (band && s.coord - band[band.length - 1].coord <= WIRE_NUDGE_BAND) band.push(s);
      else bands.push([s]);
    });

    bands.forEach(function(band) {
      if (band.length < 2) return;
      band.sort(function(p, q) { return p.lo - q.lo || p.wi - q.wi; });

      // 2) Split the band into clusters of segments that really overlap.
      var clusters = [];
      var cur = null, curHi = -Infinity;
      band.forEach(function(s) {
        if (cur && s.lo < curHi - 1) {
          cur.push(s);
          curHi = Math.max(curHi, s.hi);
        } else {
          cur = [s];
          clusters.push(cur);
          curHi = s.hi;
        }
      });

      clusters.forEach(function(cluster) {
        if (cluster.length < 2) return;

        // 3) Greedy track assignment (interval colouring): segments that do
        //    not overlap can share a track, overlapping ones get new tracks.
        var trackEnd = [];
        cluster.forEach(function(s) {
          var t = 0;
          while (t < trackEnd.length && trackEnd[t] > s.lo + 1) t++;
          trackEnd[t] = s.hi;
          s.track = t;
        });
        var tracks = trackEnd.length;
        if (tracks < 2) return;

        var base = cluster.reduce(function(sum, s) { return sum + s.coord; }, 0) / cluster.length;
        cluster.forEach(function(s) {
          s.newCoord = base + (s.track - (tracks - 1) / 2) * WIRE_NUDGE_SPACING;
        });
      });
    });
  });

  // Apply. Segments alternate H/V, so a shifted segment only changes one axis
  // of its two end points and never fights with its neighbours.
  segs.forEach(function(s) {
    if (typeof s.newCoord !== 'number') return;
    var pts = paths[s.wi];
    if (s.horiz) { pts[s.i].y = s.newCoord; pts[s.i + 1].y = s.newCoord; }
    else         { pts[s.i].x = s.newCoord; pts[s.i + 1].x = s.newCoord; }
  });

  wireList.forEach(function(w, wi) { w._renderPts = paths[wi]; });
  return paths;
}

if (typeof module !== 'undefined') module.exports = { computeWireRenderPaths: computeWireRenderPaths };