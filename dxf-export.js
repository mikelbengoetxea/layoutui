/**
 * DXF export (R12 / AC1009) in mm. Layout coords: origin bottom-left, y up.
 * Uses classic POLYLINE + VERTEX + SEQEND for broad AutoCAD compatibility.
 */
(function (global) {
  "use strict";

  function pair(code, value) {
    return String(code).padStart(3, " ") + "\r\n" + String(value) + "\r\n";
  }

  function num(n) {
    return Number(n).toFixed(6);
  }

  function section(name) {
    return pair(0, "SECTION") + pair(2, name);
  }

  function endSection() {
    return pair(0, "ENDSEC");
  }

  function bounds(layout) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const r of layout.rects) {
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w);
      maxY = Math.max(maxY, r.y + r.h);
    }
    if (!layout.rects.length) {
      minX = minY = 0;
      maxX = layout.areaWidth;
      maxY = layout.areaHeight;
    }
    return { minX, minY, maxX, maxY };
  }

  /** Closed rectangle as R12 POLYLINE */
  function rectPolyline(x, y, w, h) {
    const x2 = x + w;
    const y2 = y + h;
    const pts = [
      [x, y],
      [x2, y],
      [x2, y2],
      [x, y2],
    ];
    let s =
      pair(0, "POLYLINE") +
      pair(8, "0") +
      pair(66, 1) +
      pair(70, 1);
    for (let i = 0; i < pts.length; i++) {
      s +=
        pair(0, "VERTEX") +
        pair(8, "0") +
        pair(10, num(pts[i][0])) +
        pair(20, num(pts[i][1]));
    }
    return s + pair(0, "SEQEND") + pair(8, "0");
  }

  function buildDxf(layout) {
    const ext = bounds(layout);
    let entities = "";
    for (const r of layout.rects) {
      entities += rectPolyline(r.x, r.y, r.w, r.h);
    }

    return (
      section("HEADER") +
      pair(9, "$ACADVER") +
      pair(1, "AC1009") +
      pair(9, "$INSUNITS") +
      pair(70, 4) +
      pair(9, "$MEASUREMENT") +
      pair(70, 1) +
      pair(9, "$EXTMIN") +
      pair(10, num(ext.minX)) +
      pair(20, num(ext.minY)) +
      pair(30, "0.0") +
      pair(9, "$EXTMAX") +
      pair(10, num(ext.maxX)) +
      pair(20, num(ext.maxY)) +
      pair(30, "0.0") +
      endSection() +
      section("ENTITIES") +
      entities +
      endSection() +
      pair(0, "EOF")
    );
  }

  function downloadDxf(layout, filename) {
    const dxf = buildDxf(layout);
    const blob = new Blob([dxf], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "layout.dxf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  global.DxfExport = { buildDxf, downloadDxf };
})(typeof window !== "undefined" ? window : global);
