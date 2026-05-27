(function () {
  "use strict";

  const canvas = document.getElementById("preview");
  const ctx = canvas.getContext("2d");
  const form = document.getElementById("params-form");

  const els = {
    areaWidth: document.getElementById("area-width"),
    areaHeight: document.getElementById("area-height"),
    areaWidthOut: document.getElementById("area-width-out"),
    areaHeightOut: document.getElementById("area-height-out"),
    layoutMode: document.getElementById("layout-mode"),
    alignType: document.getElementById("align-type"),
    stagger: document.getElementById("stagger"),
    staggerOut: document.getElementById("stagger-out"),
    tileLength: document.getElementById("tile-length"),
    tileWidth: document.getElementById("tile-width"),
    gap: document.getElementById("gap"),
    tileLengthOut: document.getElementById("tile-length-out"),
    tileWidthOut: document.getElementById("tile-width-out"),
    gapOut: document.getElementById("gap-out"),
    lengthLabel: document.getElementById("length-label"),
    widthLabel: document.getElementById("width-label"),
    typeRow: document.getElementById("type-row"),
    staggerRow: document.getElementById("stagger-row"),
    exportBtn: document.getElementById("export-dxf"),
  };

  const STROKE = "#5ee06a";
  const STROKE_DIM = "#3a9e44";
  const BG = "#1c2230";

  let lastLayout = null;
  let drawBounds = null;
  let staggerRandomize = false;
  let randomRowTypes = null;
  let randomRowMeta = { rows: 0, types: 0 };

  const STAGGER = StaggerConstants;

  function staggerPercentFromSlider(sliderValue) {
    const v = Number(sliderValue);
    if (Math.abs(v - STAGGER.sliderForOneThird) < 0.02) {
      return STAGGER.ONE_THIRD;
    }
    if (Math.abs(v - STAGGER.sliderForTwoThirds) < 0.02) {
      return STAGGER.TWO_THIRDS;
    }
    return 100 - v;
  }

  function formatStaggerPercent(percent) {
    if (Math.abs(percent - STAGGER.ONE_THIRD) < 0.001) {
      return (STAGGER.ONE_THIRD).toFixed(1);
    }
    if (Math.abs(percent - STAGGER.TWO_THIRDS) < 0.001) {
      return (STAGGER.TWO_THIRDS).toFixed(1);
    }
    return (Math.round(percent * 10) / 10).toString();
  }

  function initStaggerAltTicks() {
    document
      .querySelectorAll(".stagger-ticks--alt .stagger-tick[data-stagger]")
      .forEach(function (btn) {
        const key = btn.dataset.stagger;
        let sliderVal;
        if (key === "one-third") {
          sliderVal = STAGGER.sliderForOneThird;
        } else if (key === "two-thirds") {
          sliderVal = STAGGER.sliderForTwoThirds;
        } else {
          return;
        }
        btn.dataset.value = String(sliderVal);
        btn.style.left = sliderVal + "%";
      });
  }

  function layoutRowCount(p) {
    const areaH = Math.max(1, p.areaHeight);
    const W = Math.max(1, p.tileWidth);
    const G = Math.max(0, p.gap);
    const equalRow =
      p.alignType === "equal"
        ? (function () {
            for (let n = 1; n <= 500; n++) {
              const s = (areaH - (n - 1) * G) / n;
              if (s <= 1e-6) break;
              if (s <= W + 1e-6) return { count: n, size: s };
            }
            return { count: 1, size: areaH };
          })()
        : null;
    const cellWidth = equalRow ? equalRow.size : W;
    return LayoutEngine.countRows(p, areaH, W, G, equalRow, cellWidth);
  }

  function regenerateRandomRowTypes(p) {
    const rows = layoutRowCount(p);
    const types = LayoutEngine.staggerTypeCount(p.staggerPercent);
    randomRowTypes = LayoutEngine.generateRandomRowTypes(rows, types);
    randomRowMeta = { rows: rows, types: types };
  }

  function ensureRandomRowTypes(p) {
    if (!staggerRandomize || p.layoutMode !== "staggered") return;
    const rows = layoutRowCount(p);
    const types = LayoutEngine.staggerTypeCount(p.staggerPercent);
    if (
      !randomRowTypes ||
      randomRowMeta.rows !== rows ||
      randomRowMeta.types !== types
    ) {
      randomRowTypes = LayoutEngine.generateRandomRowTypes(rows, types);
      randomRowMeta = { rows: rows, types: types };
    }
  }

  function readParams() {
    const layoutMode = els.layoutMode.value;
    const alignType = els.alignType.value;
    const isEqual = layoutMode === "aligned" && alignType === "equal";

    const params = {
      areaWidth: Number(els.areaWidth.value) || 1200,
      areaHeight: Number(els.areaHeight.value) || 800,
      tileLength: Number(els.tileLength.value),
      tileWidth: Number(els.tileWidth.value),
      gap: Number(els.gap.value),
      layoutMode,
      alignType,
      staggerPercent: staggerPercentFromSlider(els.stagger.value),
      isEqual,
      randomRowTypes: null,
    };

    if (staggerRandomize && layoutMode === "staggered") {
      ensureRandomRowTypes(params);
      params.randomRowTypes = randomRowTypes;
    }

    return params;
  }

  function syncOutputs() {
    els.areaWidthOut.textContent = els.areaWidth.value;
    els.areaHeightOut.textContent = els.areaHeight.value;
    els.tileLengthOut.textContent = els.tileLength.value;
    els.tileWidthOut.textContent = els.tileWidth.value;
    els.gapOut.textContent = els.gap.value;
    els.staggerOut.textContent =
      formatStaggerPercent(staggerPercentFromSlider(els.stagger.value)) + "%";

    const staggered = els.layoutMode.value === "staggered";
    const equal = els.layoutMode.value === "aligned" && els.alignType.value === "equal";

    els.typeRow.classList.toggle("param-row--hidden", staggered);
    els.staggerRow.classList.toggle("param-row--hidden", !staggered);

    const staggerR = document.getElementById("stagger-r");
    if (staggerR) {
      staggerR.disabled = !staggered;
      staggerR.setAttribute("aria-hidden", staggered ? "false" : "true");
    }

    els.lengthLabel.parentElement.classList.toggle("param-row--max-hint", equal);
    els.widthLabel.parentElement.classList.toggle("param-row--max-hint", equal);

    // Preview hint removed (was showing "mm"/equal cell size).
  }

  function num(n) {
    return Math.round(n * 10) / 10;
  }

  function resizeCanvas() {
    const section = canvas.parentElement;
    const sectionRect = section.getBoundingClientRect();
    const pad = 8;
    const availW = Math.max(1, sectionRect.width - pad * 2);
    const availH = Math.max(1, sectionRect.height - pad * 2);
    const areaW = lastLayout?.areaWidth || Number(els.areaWidth.value) || 1200;
    const areaH = lastLayout?.areaHeight || Number(els.areaHeight.value) || 800;
    const aspect = areaW / areaH;

    let cssW = availW;
    let cssH = cssW / aspect;
    if (cssH > availH) {
      cssH = availH;
      cssW = cssH * aspect;
    }

    cssW = Math.floor(cssW);
    cssH = Math.floor(cssH);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(cssW * dpr));
    const h = Math.max(1, Math.floor(cssH * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function arrow(ctx, x1, y1, x2, y2, size) {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const a1 = ang + Math.PI * 0.85;
    const a2 = ang - Math.PI * 0.85;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + Math.cos(a1) * size, y1 + Math.sin(a1) * size);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + Math.cos(a2) * size, y1 + Math.sin(a2) * size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 + Math.cos(a1) * size, y2 + Math.sin(a1) * size);
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 + Math.cos(a2) * size, y2 + Math.sin(a2) * size);
    ctx.stroke();
  }

  function drawDimensionH(ctx, x1, x2, y, label, below) {
    const ext = 8;
    const off = 14;
    const dimY = below ? y + off : y - off;
    ctx.strokeStyle = STROKE_DIM;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x1, below ? dimY + ext : dimY - ext);
    ctx.moveTo(x2, y);
    ctx.lineTo(x2, below ? dimY + ext : dimY - ext);
    ctx.stroke();
    ctx.setLineDash([]);
    arrow(ctx, x1, dimY, x2, dimY, 5);
    ctx.fillStyle = STROKE_DIM;
    ctx.font = `${Math.max(10, 11 * (window.devicePixelRatio || 1) / 2)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = below ? "top" : "bottom";
    ctx.fillText(label, (x1 + x2) / 2, below ? dimY + 4 : dimY - 4);
  }

  /** Map layout y (bottom-left, y up) to canvas y (down). */
  function layoutToCanvasY(rectY, rectH, areaH, oy, scale) {
    return oy + (areaH - rectY - rectH) * scale;
  }

  function drawDimensionV(ctx, y1, y2, x, label) {
    const ext = 8;
    const off = 14;
    const dimX = x - off;
    ctx.strokeStyle = STROKE_DIM;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(dimX - ext, y1);
    ctx.moveTo(x, y2);
    ctx.lineTo(dimX - ext, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    arrow(ctx, dimX, y2, dimX, y1, 5);
    ctx.fillStyle = STROKE_DIM;
    ctx.font = `${Math.max(10, 11 * (window.devicePixelRatio || 1) / 2)}px system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(label, dimX - 6, (y1 + y2) / 2);
  }

  function render() {
    const p = readParams();
    if (!staggerRandomize || p.layoutMode !== "staggered") {
      randomRowTypes = null;
      randomRowMeta = { rows: 0, types: 0 };
    }
    lastLayout = LayoutEngine.computeLayout(p);
    syncOutputs();
    resizeCanvas();

    const padL = 48;
    const padT = 36;
    const padR = 16;
    const padB = 16;
    const availW = canvas.width - padL - padR;
    const availH = canvas.height - padT - padB;
    const scale = Math.min(availW / lastLayout.areaWidth, availH / lastLayout.areaHeight);
    const drawW = lastLayout.areaWidth * scale;
    const drawH = lastLayout.areaHeight * scale;
    const ox = padL + (availW - drawW) / 2;
    const oy = padT + (availH - drawH) / 2;

    drawBounds = { ox, oy, scale, drawW, drawH };

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = STROKE;
    ctx.lineWidth = Math.max(1, 1.5 * (window.devicePixelRatio || 1) / 2);
    ctx.lineJoin = "miter";

    const areaH = lastLayout.areaHeight;

    for (const r of lastLayout.rects) {
      ctx.strokeRect(
        ox + r.x * scale,
        layoutToCanvasY(r.y, r.h, areaH, oy, scale),
        r.w * scale,
        r.h * scale
      );
    }

    // (Area dimension annotations removed per UI request.)
  }

  function onChange() {
    render();
  }

  form.addEventListener("input", onChange);
  form.addEventListener("change", onChange);

  initStaggerAltTicks();

  document.querySelectorAll(".stagger-tick").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!btn.dataset.value) return;
      els.stagger.value = btn.dataset.value;
      els.stagger.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });

  const staggerToggle = document.getElementById("stagger-toggle");
  const staggerWrap = staggerToggle ? staggerToggle.closest(".range-wrap--stagger") : null;
  if (staggerToggle && staggerWrap) {
    staggerToggle.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      const next = !staggerWrap.classList.contains("is-alt");
      staggerWrap.classList.toggle("is-alt", next);
      staggerToggle.setAttribute("aria-pressed", next ? "true" : "false");
      const main = staggerWrap.querySelector(".stagger-ticks--main");
      const alt = staggerWrap.querySelector(".stagger-ticks--alt");
      if (main) main.setAttribute("aria-hidden", next ? "true" : "false");
      if (alt) alt.setAttribute("aria-hidden", next ? "false" : "true");
    });
  }

  const staggerR = document.getElementById("stagger-r");
  if (staggerR) {
    staggerR.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (els.layoutMode.value !== "staggered") return;
      staggerRandomize = !staggerRandomize;
      staggerR.setAttribute("aria-pressed", staggerRandomize ? "true" : "false");
      if (staggerRandomize) {
        regenerateRandomRowTypes({
          areaWidth: Number(els.areaWidth.value) || 1200,
          areaHeight: Number(els.areaHeight.value) || 800,
          tileWidth: Number(els.tileWidth.value),
          gap: Number(els.gap.value),
          alignType: els.alignType.value,
          staggerPercent: staggerPercentFromSlider(els.stagger.value),
        });
      } else {
        randomRowTypes = null;
        randomRowMeta = { rows: 0, types: 0 };
      }
      render();
    });
  }

  els.exportBtn.addEventListener("click", function () {
    if (!lastLayout) render();
    DxfExport.downloadDxf(lastLayout, "layout.dxf");
  });

  let resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 80);
  });

  if (window.ResizeObserver) {
    const ro = new ResizeObserver(function () {
      render();
    });
    ro.observe(canvas.parentElement);
    ro.observe(document.querySelector(".app-main"));
  }

  render();
})();
