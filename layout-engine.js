/**
 * Layout geometry in mm. Origin bottom-left. Each rect: x, y = bottom-left corner, w, h.
 */
(function (global) {
  "use strict";

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  /** @returns {{ x: number, width: number }[]} */
  function rowTilesFull(areaWidth, tileLength, gap) {
    const tiles = [];
    let x = 0;
    while (x < areaWidth - 1e-6) {
      const remaining = areaWidth - x;
      const w = Math.min(tileLength, remaining);
      if (w <= 1e-6) break;
      tiles.push({ x, width: w });
      const next = x + w + gap;
      if (next >= areaWidth - 1e-6) break;
      x = next;
    }
    return tiles;
  }

  /** Fewest divisions needed so equal cell size is <= maxSize (largest tile under max). */
  function equalDivision(area, maxSize, gap) {
    for (let n = 1; n <= 500; n++) {
      const s = (area - (n - 1) * gap) / n;
      if (s <= 1e-6) break;
      if (s <= maxSize + 1e-6) {
        return { count: n, size: s };
      }
    }
    const n = 500;
    return { count: n, size: Math.max(0, (area - (n - 1) * gap) / n) };
  }

  /** @returns {{ x: number, width: number }[]} */
  function rowTilesEqual(areaWidth, cellLength, gap) {
    const { count, size } = equalDivision(areaWidth, cellLength, gap);
    const tiles = [];
    let x = 0;
    for (let i = 0; i < count; i++) {
      tiles.push({ x, width: size });
      x += size + gap;
    }
    return tiles;
  }

  /** @returns {{ y: number, h: number }[]} bottom-left row positions, bottom row first */
  function rowsCentered(areaHeight, tileHeight, gap) {
    let best = [{ y: 0, h: areaHeight }];
    for (let n = 1; n <= 500; n++) {
      let endH;
      if (n === 1) {
        endH = areaHeight;
      } else {
        endH = (areaHeight - (n - 2) * tileHeight - (n - 1) * gap) / 2;
      }
      if (endH < -1e-6) continue;
      if (n > 1 && endH > tileHeight + 1e-6) continue;

      const rows = [];
      let y = 0;
      for (let i = 0; i < n; i++) {
        const h =
          n === 1 ? areaHeight : i === 0 || i === n - 1 ? endH : tileHeight;
        rows.push({ y, h });
        y += h + (i < n - 1 ? gap : 0);
      }
      if (Math.abs(y - areaHeight) < 0.5) best = rows;
    }
    return best;
  }

  /** @returns {{ x: number, width: number }[]} */
  function rowTilesCentered(areaWidth, tileLength, gap) {
    let best = [{ x: 0, width: areaWidth }];
    for (let n = 1; n <= 500; n++) {
      let endW;
      if (n === 1) {
        endW = areaWidth;
      } else {
        endW = (areaWidth - (n - 2) * tileLength - (n - 1) * gap) / 2;
      }
      if (endW < -1e-6) continue;
      if (n > 1 && endW > tileLength + 1e-6) continue;

      const tiles = [];
      let x = 0;
      for (let i = 0; i < n; i++) {
        const w =
          n === 1 ? areaWidth : i === 0 || i === n - 1 ? endW : tileLength;
        tiles.push({ x, width: w });
        x += w + (i < n - 1 ? gap : 0);
      }
      if (Math.abs(x - areaWidth) < 0.5) best = tiles;
    }
    return best;
  }

  /** @returns {{ x: number, width: number }[]} */
  function rowTiles(areaWidth, tileLength, gap, alignType) {
    if (alignType === "equal") return rowTilesEqual(areaWidth, tileLength, gap);
    if (alignType === "centered")
      return rowTilesCentered(areaWidth, tileLength, gap);
    return rowTilesFull(areaWidth, tileLength, gap);
  }

  function gcd(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y) {
      const t = y;
      y = x % y;
      x = t;
    }
    return x;
  }

  /**
   * Stagger cycle length (row types before offset repeats).
   * e.g. 25% → 4, 33⅓% / 66⅔% → 3, 50% → 2.
   */
  function staggerTypeCount(staggerPercent) {
    const p = clamp(staggerPercent, 0.001, 100);
    if (p >= 99.99) return 1;
    for (let n = 1; n <= 24; n++) {
      const cycles = (n * p) / 100;
      if (Math.abs(cycles - Math.round(cycles)) < 0.02) {
        return n;
      }
    }
    const rounded = Math.max(1, Math.round(p));
    return Math.max(1, Math.round(100 / gcd(100, rounded)));
  }

  function balancedCounts(total, types) {
    const counts = new Array(types).fill(Math.floor(total / types));
    for (let i = 0; i < total % types; i++) counts[i]++;
    return counts;
  }

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
  }

  /**
   * Row-type sequence for randomized stagger. Row 0 is always type 0.
   * No adjacent rows share a type; counts per type are balanced when possible.
   */
  function generateRandomRowTypes(rowCount, numTypes) {
    if (rowCount <= 0) return [];
    if (rowCount === 1) return [0];
    if (numTypes <= 1) {
      const all = new Array(rowCount).fill(0);
      return all;
    }

    const counts = balancedCounts(rowCount, numTypes);
    const remaining = counts.slice();
    remaining[0] -= 1;
    const seq = [0];

    function backtrack() {
      if (seq.length === rowCount) return true;
      const prev = seq[seq.length - 1];
      const options = [];
      for (let t = 0; t < numTypes; t++) {
        if (remaining[t] > 0 && t !== prev) options.push(t);
      }
      if (!options.length) return false;
      shuffleInPlace(options);
      for (let i = 0; i < options.length; i++) {
        const t = options[i];
        remaining[t]--;
        seq.push(t);
        if (backtrack()) return true;
        seq.pop();
        remaining[t]++;
      }
      return false;
    }

    if (backtrack()) return seq;

    const out = [0];
    const rem = counts.slice();
    rem[0] -= 1;
    while (out.length < rowCount) {
      const prev = out[out.length - 1];
      let pick = -1;
      let pickRem = -1;
      for (let t = 0; t < numTypes; t++) {
        if (t !== prev && rem[t] > pickRem) {
          pickRem = rem[t];
          pick = t;
        }
      }
      if (pick < 0) {
        for (let t = 0; t < numTypes; t++) {
          if (rem[t] > 0) {
            pick = t;
            break;
          }
        }
      }
      out.push(pick);
      rem[pick]--;
    }
    return out;
  }

  function countRows(opts, areaH, W, G, equalRow, cellWidth) {
    let y = 0;
    let rowIndex = 0;
    const rowCount = equalRow ? equalRow.count : null;
    while (y < areaH - 1e-6) {
      if (rowCount !== null && rowIndex >= rowCount) break;
      const rowH = equalRow ? cellWidth : Math.min(W, areaH - y);
      const nextY = y + rowH + G;
      if (nextY >= areaH - 1e-6) {
        rowIndex++;
        break;
      }
      y = nextY;
      rowIndex++;
    }
    return rowIndex;
  }

  /**
   * @param {object} opts
   * @param {number} opts.areaWidth
   * @param {number} opts.areaHeight
   * @param {number} opts.tileLength
   * @param {number} opts.tileWidth
   * @param {number} opts.gap
   * @param {"aligned"|"staggered"} opts.layoutMode
   * @param {"full"|"equal"|"centered"} opts.alignType
   * @param {number} opts.staggerPercent 0–100, fraction of (tileLength + gap)
   * @param {number[]|null} [opts.randomRowTypes] row stagger types when randomized
   */
  function computeLayout(opts) {
    const areaW = Math.max(1, opts.areaWidth);
    const areaH = Math.max(1, opts.areaHeight);
    const L = Math.max(1, opts.tileLength);
    const W = Math.max(1, opts.tileWidth);
    const G = Math.max(0, opts.gap);
    const layoutMode = opts.layoutMode;
    const alignType = opts.alignType;
    // Staggered is its own layout; it shouldn't inherit aligned sub-modes.
    const effectiveAlignType = layoutMode === "staggered" ? "full" : alignType;
    const tilePeriod = L + G;
    const staggerStep =
      layoutMode === "staggered"
        ? (clamp(opts.staggerPercent, 0, 100) / 100) * tilePeriod
        : 0;
    const randomRowTypes = opts.randomRowTypes || null;

    function wrapStaggerOffset(raw) {
      if (tilePeriod <= 1e-6 || raw <= 1e-6) return 0;
      const wrapped = raw % tilePeriod;
      return wrapped < 1e-6 ? 0 : wrapped;
    }

    function rowStaggerOffset(rowIndex) {
      if (layoutMode !== "staggered") return 0;
      let raw;
      if (randomRowTypes) {
        raw = (randomRowTypes[rowIndex] || 0) * staggerStep;
      } else {
        raw = rowIndex * staggerStep;
      }
      return wrapStaggerOffset(raw);
    }

    const equalRow =
      effectiveAlignType === "equal"
        ? equalDivision(areaH, W, G)
        : null;
    const cellLength =
      effectiveAlignType === "equal"
        ? equalDivision(areaW, L, G).size
        : L;
    const cellWidth = equalRow ? equalRow.size : W;

    const rects = [];
    const maxRows = equalRow ? equalRow.count : null;
    const useVerticalCenter =
      effectiveAlignType === "centered" && layoutMode === "aligned";

    function placeRow(rowIndex, y, rowH) {
      const xOff = rowStaggerOffset(rowIndex);
      let hTiles = rowTiles(areaW + xOff, cellLength, G, effectiveAlignType);

      if (xOff > 1e-6) {
        const shifted = [];
        for (const t of hTiles) {
          const x1 = t.x - xOff;
          const x2 = t.x + t.width - xOff;
          const clipL = Math.max(0, x1);
          const clipR = Math.min(areaW, x2);
          if (clipR > clipL + 1e-6) {
            shifted.push({ x: clipL, width: clipR - clipL });
          }
        }
        hTiles = shifted.length ? shifted : hTiles;
      }

      for (const t of hTiles) {
        const x = clamp(t.x, 0, areaW);
        const w = Math.min(t.width, areaW - x);
        if (w > 1e-6) {
          rects.push({ x, y, w, h: rowH });
        }
      }
    }

    if (useVerticalCenter) {
      const rows = rowsCentered(areaH, W, G);
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        placeRow(rowIndex, rows[rowIndex].y, rows[rowIndex].h);
      }
    } else {
      let rowIndex = 0;
      let y = 0;

      while (y < areaH - 1e-6) {
        if (maxRows !== null && rowIndex >= maxRows) break;
        const rowH = equalRow
          ? cellWidth
          : Math.min(W, areaH - y);
        placeRow(rowIndex, y, rowH);

        const nextY = y + rowH + G;
        if (nextY >= areaH - 1e-6) break;
        y = nextY;
        rowIndex++;
      }
    }

    return {
      areaWidth: areaW,
      areaHeight: areaH,
      rects,
      cellLength: effectiveAlignType === "equal" ? cellLength : null,
      cellWidth: effectiveAlignType === "equal" ? cellWidth : null,
    };
  }

  global.LayoutEngine = {
    computeLayout,
    countRows,
    staggerTypeCount,
    generateRandomRowTypes,
  };
})(typeof window !== "undefined" ? window : global);
