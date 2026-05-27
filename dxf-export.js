/**
 * Minimal DXF R12-style export (mm). Layout coords: origin bottom-left, y up.
 */
(function (global) {
  "use strict";

  function num(n) {
    return Number(n).toFixed(4);
  }

  function rectPolyline(x, y, w, h) {
    const x2 = x + w;
    const y2 = y + h;
    return (
      "0\nLWPOLYLINE\n8\n0\n90\n4\n70\n1\n" +
      "10\n" + num(x) + "\n20\n" + num(y) + "\n" +
      "10\n" + num(x2) + "\n20\n" + num(y) + "\n" +
      "10\n" + num(x2) + "\n20\n" + num(y2) + "\n" +
      "10\n" + num(x) + "\n20\n" + num(y2) + "\n"
    );
  }

  function buildDxf(layout) {
    let entities = "";
    for (const r of layout.rects) {
      entities += rectPolyline(r.x, r.y, r.w, r.h);
    }

    return (
      "0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n" +
      "0\nENDSEC\n0\nSECTION\n2\nENTITIES\n" +
      entities +
      "0\nENDSEC\n0\nEOF\n"
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
