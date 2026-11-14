/* =========================================================
   心绘非遗 · 传统剪纸转译引擎（papercut）
   ---------------------------------------------------------
   这一版刻意降低对原画的机械锚定，不再把用户笔迹原样涂红：
     1. 概括：把原画「化」成块面剪影——合并邻近笔迹、填充围合区域、
        闭运算填凹、开运算去细碎毛刺，只保留画面重心、体量与大体走势；
     2. 转译：剪影只作为「阳刻」红面，画面细节不再描摹，改由纹样库的
        经典单元以「阴刻」镂空的方式重构（团花、云纹、锯齿、水波…）；
     3. 构图：统一加上传统边框、四角角花，并用短枝把主体与边框连成
        一整片纸，符合剪纸「线线相连」的刀路逻辑；
     4. 可剪：所有镂空都留足红桥（最小线宽），孤岛必补桥，碎点清除，
        保证成品能真正用剪刀剪出来，而不是一张红色简笔画。
   —— 关联性只保留在「构图呼应」层面：重心、体量、朝向，而非逐笔复制。
   ========================================================= */
(function () {
  "use strict";

  const DB = window.XHFYMotifDB;
  const TAU = Math.PI * 2;
  /** 外框边线距纸边的距离（占画布边长的比例） */
  const FRAME_INSET = 0.028;
  const RED = "#a8332a";
  const RED_RGB = [168, 51, 42];

  /* ---------------- 基础画布工具 ---------------- */

  function mk(size) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    return c;
  }

  function ctxOf(c) {
    return c.getContext("2d", { willReadFrequently: true });
  }

  /** 把笔迹按与 inkLayer 完全一致的映射放进正方形画布 */
  function inkCanvas(studio, S) {
    const pad = S * 0.08;
    const inner = S - pad * 2;
    const trace = studio.traceCanvas(S);
    const h = (inner / studio.canvas.width) * studio.canvas.height;
    const y = (S - h) / 2;
    const cv = mk(S);
    const ctx = ctxOf(cv);
    ctx.drawImage(trace, pad, y, inner, h);
    return cv;
  }

  /* ---------------- 形态学 ---------------- */

  /** 可分离最大值膨胀 */
  function dilate(m, w, h, r) {
    if (r <= 0) return m.slice();
    const tmp = new Uint8Array(w * h);
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        let v = 0;
        const x0 = Math.max(0, x - r);
        const x1 = Math.min(w - 1, x + r);
        for (let k = x0; k <= x1; k++) if (m[row + k]) { v = 1; break; }
        tmp[row + x] = v;
      }
    }
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let v = 0;
        const y0 = Math.max(0, y - r);
        const y1 = Math.min(h - 1, y + r);
        for (let k = y0; k <= y1; k++) if (tmp[k * w + x]) { v = 1; break; }
        out[y * w + x] = v;
      }
    }
    return out;
  }

  /** 可分离最小值腐蚀 */
  function erodeMask(m, w, h, r) {
    if (r <= 0) return m.slice();
    const tmp = new Uint8Array(w * h);
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        let v = 1;
        const x0 = Math.max(0, x - r);
        const x1 = Math.min(w - 1, x + r);
        for (let k = x0; k <= x1; k++) if (!m[row + k]) { v = 0; break; }
        tmp[row + x] = v;
      }
    }
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let v = 1;
        const y0 = Math.max(0, y - r);
        const y1 = Math.min(h - 1, y + r);
        for (let k = y0; k <= y1; k++) if (!tmp[k * w + x]) { v = 0; break; }
        out[y * w + x] = v;
      }
    }
    return out;
  }

  /** 开运算：先去细（腐蚀）再复原（膨胀），消掉细碎毛刺与孤立碎线 */
  function openMask(m, w, h, r) {
    return dilate(erodeMask(m, w, h, r), w, h, r);
  }

  /** 闭运算：先膨胀再腐蚀，填平凹口与小缝 */
  function closeMask(m, w, h, r) {
    return erodeMask(dilate(m, w, h, r), w, h, r);
  }

  /** 从边界泛洪，标出「外部」；剩下的空洞就是围合出来的内部 */
  function markOutside(m, w, h) {
    const out = new Uint8Array(w * h);
    const stack = [];
    for (let x = 0; x < w; x++) {
      if (!m[x]) { out[x] = 1; stack.push(x); }
      const b = (h - 1) * w + x;
      if (!m[b]) { out[b] = 1; stack.push(b); }
    }
    for (let y = 0; y < h; y++) {
      const l = y * w;
      if (!m[l]) { out[l] = 1; stack.push(l); }
      const r = l + w - 1;
      if (!m[r]) { out[r] = 1; stack.push(r); }
    }
    while (stack.length) {
      const i = stack.pop();
      const x = i % w;
      const y = (i - x) / w;
      if (x > 0 && !m[i - 1] && !out[i - 1]) { out[i - 1] = 1; stack.push(i - 1); }
      if (x < w - 1 && !m[i + 1] && !out[i + 1]) { out[i + 1] = 1; stack.push(i + 1); }
      if (y > 0 && !m[i - w] && !out[i - w]) { out[i - w] = 1; stack.push(i - w); }
      if (y < h - 1 && !m[i + w] && !out[i + w]) { out[i + w] = 1; stack.push(i + w); }
    }
    return out;
  }

  /** 连通域标记（4 邻接），返回 {labels, count, stats} */
  function label(m, w, h, onlyValue) {
    const labels = new Int32Array(w * h);
    let count = 0;
    const stats = [];
    const stack = [];
    for (let i = 0; i < w * h; i++) {
      if (labels[i] || (onlyValue !== undefined && m[i] !== onlyValue) || !m[i]) continue;
      count++;
      let area = 0, sx = 0, sy = 0;
      let minX = w, minY = h, maxX = 0, maxY = 0;
      const px = [];
      labels[i] = count;
      stack.push(i);
      while (stack.length) {
        const j = stack.pop();
        const x = j % w;
        const y = (j - x) / w;
        area++; sx += x; sy += y;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (px.length < 40000) px.push(x, y);
        if (x > 0 && !labels[j - 1] && m[j - 1]) { labels[j - 1] = count; stack.push(j - 1); }
        if (x < w - 1 && !labels[j + 1] && m[j + 1]) { labels[j + 1] = count; stack.push(j + 1); }
        if (y > 0 && !labels[j - w] && m[j - w]) { labels[j - w] = count; stack.push(j - w); }
        if (y < h - 1 && !labels[j + w] && m[j + w]) { labels[j + w] = count; stack.push(j + w); }
      }
      let sxx = 0, syy = 0, sxy = 0;
      const n = px.length / 2;
      const cx = sx / area, cy = sy / area;
      const step = n > 3000 ? Math.ceil(n / 3000) : 1;
      for (let k = 0; k < n; k += step) {
        const dx = px[k * 2] - cx;
        const dy = px[k * 2 + 1] - cy;
        sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
      }
      const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
      stats.push({
        area, cx, cy,
        ax: px.length ? px[0] : Math.round(cx),
        ay: px.length ? px[1] : Math.round(cy),
        minX, minY, maxX, maxY,
        bw: maxX - minX + 1,
        bh: maxY - minY + 1,
        angle: ang
      });
    }
    return { labels, count, stats };
  }

  /** 两遍扫描近似欧氏距离场（到最近「非零」像素的距离） */
  function distanceField(m, w, h) {
    const BIG = w + h;
    const d = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) d[i] = m[i] ? 0 : BIG;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const v = d[row + x];
        if (x > 0) d[row + x] = Math.min(v, d[row + x - 1] + 1);
        if (y > 0) d[row + x] = Math.min(d[row + x], d[row - w + x] + 1);
      }
      for (let x = w - 1; x >= 0; x--) {
        const v = d[row + x];
        if (x < w - 1) d[row + x] = Math.min(v, d[row + x + 1] + 1);
      }
    }
    for (let y = h - 1; y >= 0; y--) {
      const row = y * w;
      for (let x = w - 1; x >= 0; x--) {
        const v = d[row + x];
        if (x < w - 1) d[row + x] = Math.min(v, d[row + x + 1] + 1);
        if (y < h - 1) d[row + x] = Math.min(d[row + x], d[row + w + x] + 1);
      }
      for (let x = 0; x < w; x++) {
        const v = d[row + x];
        if (x > 0) d[row + x] = Math.min(d[row + x], d[row + x - 1] + 1);
      }
    }
    return d;
  }

  /** 掩码包围盒与质心 */
  function bboxOf(m, w, h) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1, count = 0, sx = 0, sy = 0;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        if (!m[row + x]) continue;
        count++; sx += x; sy += y;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    if (!count) return { x0: 0, y0: 0, x1: 0, y1: 0, w: 0, h: 0, cx: w / 2, cy: h / 2, count: 0 };
    return {
      x0, y0, x1, y1,
      w: x1 - x0 + 1, h: y1 - y0 + 1,
      cx: sx / count, cy: sy / count, count
    };
  }

  function innovationLevel(inn) {
    if (inn === "low" || inn === 0) return 0;
    if (inn === "high" || inn === 2) return 2;
    return 1; // medium 默认
  }

  /* =========================================================
     一、剪影概括：把原画化成块面
     ========================================================= */

  /**
   * 笔迹 → 块面剪影。
   * 先小幅膨胀合并近邻笔迹、闭合手绘缺口；围合区域整体填实（阳刻块面）；
   * 再用闭运算填平凹口、开运算削掉细碎毛刺。
   * 创新度越高，概括越强（低创新保留更多原始轮廓）。
   */
  function buildSilhouette(ink, S, inn) {
    const bridge = Math.max(3, Math.round(S * 0.008));
    const base = dilate(ink, S, S, bridge);
    const outside = markOutside(base, S, S);
    const solid = new Uint8Array(S * S);
    for (let i = 0; i < S * S; i++) solid[i] = outside[i] ? 0 : 1;

    const rClose = Math.max(3, Math.round(S * (inn === 0 ? 0.005 : inn === 2 ? 0.013 : 0.009)));
    const rOpen = Math.max(2, Math.round(S * (inn === 0 ? 0.003 : inn === 2 ? 0.011 : 0.007)));
    let s = closeMask(solid, S, S, rClose);
    s = openMask(s, S, S, rOpen);
    return s;
  }

  /**
   * 只保留「紧凑块面」作为剪纸主体。
   * 细长且填充率低的连通块（横贯的波浪、随手拉的长线）不进入主体，
   * 否则会被加粗成一条红绸带，正是要避免的「红色涂鸦感」。
   * 最大的那一块无论如何保留，避免主体被清空。
   */
  function filterMasses(mask, S) {
    const lab = label(mask, S, S, 1);
    if (lab.count <= 1) return mask;
    const keep = new Uint8Array(lab.count + 1);
    const minArea = S * S * 0.0006;
    let maxArea = 0, maxIdx = 0, keptCompact = 0;
    for (let i = 0; i < lab.stats.length; i++) {
      const st = lab.stats[i];
      if (st.area > maxArea) { maxArea = st.area; maxIdx = i; }
      if (st.area < minArea) continue;
      const aspect = Math.max(st.bw, st.bh) / Math.max(1, Math.min(st.bw, st.bh));
      const fill = st.area / (st.bw * st.bh);
      if (aspect > 3.0 && fill < 0.45) continue;
      keep[i + 1] = 1;
      keptCompact++;
    }
    // 一块紧凑的都没有（整幅都是线条/涂鸦）时，才退回保留最大块
    if (!keptCompact) keep[maxIdx + 1] = 1;

    const out = new Uint8Array(S * S);
    let n = 0;
    for (let p = 0; p < S * S; p++) {
      const lb = lab.labels[p];
      if (lb && keep[lb]) { out[p] = 1; n++; }
    }
    return n ? out : mask;
  }

  /** 把剪影等比缩放并居中到画面（给边框留出余量），返回新掩码 */
  function normalizeSilhouette(mask, S, maxFrac) {
    const bb = bboxOf(mask, S, S);
    if (!bb.count) return { mask, bb: null, count: 0 };

    const maxSide = S * maxFrac;
    let scale = maxSide / Math.max(1, Math.max(bb.w, bb.h));
    if (!isFinite(scale) || scale <= 0) scale = 1;
    // 允许放大，让小主体也能撑满构图；上限 3 倍，避免糊成一片
    scale = Math.min(scale, 3);
    if (Math.abs(scale - 1) < 0.02 && Math.abs(bb.cx - S / 2) < S * 0.01 && Math.abs(bb.cy - S / 2) < S * 0.01) {
      return { mask, bb, count: bb.count };
    }

    const src = mk(S);
    const sctx = ctxOf(src);
    const im = sctx.createImageData(S, S);
    for (let i = 0, p = 0; i < S * S; i++, p += 4) {
      if (mask[i]) { im.data[p] = 255; im.data[p + 1] = 255; im.data[p + 2] = 255; im.data[p + 3] = 255; }
    }
    sctx.putImageData(im, 0, 0);

    const nw = bb.w * scale, nh = bb.h * scale;
    const dx = (S - nw) / 2, dy = (S - nh) / 2;
    const dst = mk(S);
    const dctx = ctxOf(dst);
    dctx.imageSmoothingEnabled = true;
    dctx.drawImage(src, bb.x0, bb.y0, bb.w, bb.h, dx, dy, nw, nh);

    const data = dctx.getImageData(0, 0, S, S).data;
    const out = new Uint8Array(S * S);
    let n = 0;
    for (let i = 0, p = 3; i < S * S; i++, p += 4) if (data[p] > 90) { out[i] = 1; n++; }
    // 缩放会带来毛边，补一次开运算让小刺消失
    return { mask: openMask(out, S, S, Math.max(1, Math.round(S * 0.002))), bb: bboxOf(out, S, S), count: n };
  }

  /** 传统团花兜底：原画笔迹太少时，用「以原画重心/体量为种子」的团花构图 */
  function medallionMask(S, cx, cy, R) {
    const cv = mk(S);
    const c = ctxOf(cv);
    c.fillStyle = "#fff";
    c.beginPath();
    c.arc(cx, cy, R, 0, TAU);
    c.fill();
    // 八瓣外展，形成团花轮廓
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      c.beginPath();
      c.ellipse(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86,
        R * 0.26, R * 0.16, a, 0, TAU);
      c.fill();
    }
    const data = c.getImageData(0, 0, S, S).data;
    const out = new Uint8Array(S * S);
    let n = 0;
    for (let i = 0, p = 3; i < S * S; i++, p += 4) if (data[p] > 90) { out[i] = 1; n++; }
    return { mask: out, count: n };
  }

  /** 用主成分方向作为纹样环的「朝向」，让镂空与画面走势呼应 */
  function principalAngle(mask, S, bb) {
    if (!bb || !bb.count) return 0;
    let sxx = 0, syy = 0, sxy = 0, n = 0;
    const step = Math.max(2, Math.round(S * 0.01));
    for (let y = bb.y0; y <= bb.y1; y += step) {
      for (let x = bb.x0; x <= bb.x1; x += step) {
        if (!mask[y * S + x]) continue;
        const dx = x - bb.cx, dy = y - bb.cy;
        sxx += dx * dx; syy += dy * dy; sxy += dx * dy; n++;
      }
    }
    if (!n) return 0;
    return 0.5 * Math.atan2(2 * sxy, sxx - syy);
  }

  /* ---------------- 纹样镂空（阴刻） ---------------- */

  function punchUnit(ctx, unit, d, S, color) {
    const D = DB.draw;
    const lw = Math.max(6, S * 0.0085);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    if (unit.id === "chrysanthemum") {
      D.chrysanthemum(ctx, d.x, d.y, d.r, lw);
    } else if (unit.id === "plum-five") {
      D.plum(ctx, d.x, d.y, d.r, lw);
    } else if (unit.id === "lotus-petal") {
      D.lotus(ctx, d.x, d.y, d.r, lw, 8);
    } else if (unit.id === "ruyi-cloud") {
      D.ruyi(ctx, d.x, d.y, d.r, lw);
    } else if (unit.id === "cloud-roll") {
      D.spiral(ctx, d.x, d.y, d.r * 0.8, 1.5, lw, 1);
      D.spiral(ctx, d.x + d.r * 0.9, d.y + d.r * 0.28, d.r * 0.52, 1.3, lw, -1);
    } else if (unit.id === "vine-scroll") {
      D.spiral(ctx, d.x, d.y, d.r, 1.7, lw, 1);
      D.leaf(ctx, d.x + d.r * 0.62, d.y - d.r * 0.52, d.r * 0.9, d.r * 0.26, -0.7);
      D.leaf(ctx, d.x - d.r * 0.5, d.y + d.r * 0.62, d.r * 0.8, d.r * 0.24, 0.9);
    } else if (unit.id === "crescent") {
      D.crescent(ctx, d.x, d.y, d.r, d.angle || 0);
    } else if (unit.id === "willow-leaf") {
      D.leaf(ctx, d.x, d.y, d.r * 2.1, d.r * 0.48, d.angle || 0);
    } else if (unit.id === "feather") {
      for (let i = -1; i <= 1; i++) {
        D.leaf(ctx, d.x + i * d.r * 0.62, d.y + i * d.r * 0.16,
          d.r * 1.5 - Math.abs(i) * d.r * 0.28,
          d.r * 0.3, (d.angle || 0) + i * 0.16);
      }
    } else if (unit.id === "fish-scale") {
      D.scales(ctx, d.x - d.r, d.y - d.r, d.r * 2, d.r * 2, d.r * 0.42, lw);
    } else if (unit.id === "water-ripple" || unit.id === "wave-band") {
      D.ripple(ctx, d.x - d.r * 1.6, d.y, d.r * 3.2, d.r * 0.38, lw);
    } else if (unit.id === "meander") {
      D.meander(ctx, d.x - d.r * 1.5, d.y - d.r * 0.5, d.r * 3, d.r, Math.max(14, d.r * 0.7), lw);
    } else if (unit.id === "sawtooth") {
      D.sawtooth(ctx, d.x - d.r * 1.5, d.y - d.r * 0.5, d.r * 3, d.r, Math.max(12, d.r * 0.6));
    } else if (unit.id === "dot-seed") {
      ctx.beginPath();
      D.dotGrid(ctx, d.x - d.r, d.y - d.r, d.r * 2, d.r * 2, d.r * 0.62, Math.max(3, d.r * 0.1));
      ctx.fill();
    } else if (unit.id === "coin") {
      D.coin(ctx, d.x, d.y, d.r, lw);
    } else if (unit.id === "panchang") {
      D.knot(ctx, d.x, d.y, d.r, lw);
    } else if (unit.id === "butterfly") {
      D.butterfly(ctx, d.x, d.y, d.r, lw);
    } else if (unit.id === "bottle-flower") {
      D.bottle(ctx, d.x, d.y, d.r * 2.2, lw);
    } else if (unit.id === "corner-flower") {
      D.corner(ctx, d.x, d.y, d.r, lw, d.dx || 1, d.dy || 1);
    } else {
      D.ruyi(ctx, d.x, d.y, d.r, lw);
    }
    ctx.restore();
  }

  /** 镂空的区域描述，供纹样库六维检索 */
  function holeRegion(a, ringR, r, S) {
    const large = r > S * 0.075;
    return {
      shape: "round",
      zone: "inner",
      curve: 0.62,
      angular: 0.42,
      radial: 0.9,
      linear: 0.12,
      density: large ? 0.7 : 0.44,
      sizeClass: large ? "large" : "small",
      angle: a,
      inradius: r,
      area: Math.PI * r * r
    };
  }

  /**
   * 团花心：在最厚实处开一朵放射花心——一个圆孔，外围一圈八瓣柳叶刻线。
   * 所有切口都是彼此独立的镂空，切口之间留足红桥，不会切出无主的红岛。
   */
  function addCenterRosette(ctx, mask, S, inn, avoid) {
    const bb = bboxOf(mask, S, S);
    if (!bb.count) return 0;

    const inv = new Uint8Array(S * S);
    for (let i = 0; i < S * S; i++) inv[i] = mask[i] ? 0 : 1;
    const dist = distanceField(inv, S, S);

    let best = 0, bx = 0, by = 0;
    for (let y = 1; y < S - 1; y++) {
      const row = y * S;
      for (let x = 1; x < S - 1; x++) {
        if (!mask[row + x]) continue;
        if (dist[row + x] > best) { best = dist[row + x]; bx = x; by = y; }
      }
    }
    if (best < S * 0.05) return 0;

    const r = Math.min(S * (inn === 0 ? 0.085 : 0.115), best * 0.52);
    if (r < S * 0.032) return 0;

    ctx.save();
    ctx.fillStyle = "#fff";
    // 花心圆孔
    ctx.beginPath();
    ctx.arc(bx, by, r * 0.26, 0, TAU);
    ctx.fill();
    // 八瓣放射刻线（尾端留红，像太阳纹的芒）
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      ctx.save();
      ctx.translate(bx + Math.cos(a) * r * 0.74, by + Math.sin(a) * r * 0.74);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.28, r * 0.105, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    if (avoid) avoid.push({ x: bx, y: by, r: r * 1.1 });
    return 1;
  }

  /**
   * 在红面上打孔：沿「离边界最远的厚实处」寻找局部极大点，
   * 保证每个孔四周都留足红桥（可剪），并按创新度控制数量与大小；
   * 中等/高创新会把已选孔做一次左右镜像，补足剪纸的对称语感。
   */
  function punchHoles(ctx, mask, S, inn, provenance, avoid) {
    const bb = bboxOf(mask, S, S);
    if (!bb.count) return 0;

    const inv = new Uint8Array(S * S);
    for (let i = 0; i < S * S; i++) inv[i] = mask[i] ? 0 : 1;
    const distIn = distanceField(inv, S, S);

    const minD = S * 0.022;
    const step = Math.max(8, Math.round(S * 0.05));
    const cands = [];
    for (let y = Math.round(step / 2); y < S; y += step) {
      const row = y * S;
      for (let x = Math.round(step / 2); x < S; x += step) {
        const d = distIn[row + x];
        if (d < minD) continue;
        cands.push({ x, y, d });
      }
    }
    cands.sort((a, b) => b.d - a.d);

    const limit = inn === 0 ? 3 : inn === 1 ? 9 : 13;
    const bridge = Math.max(6, Math.round(S * 0.0095));
    const placed = [];

    const tryPlace = (x, y, d, allowMirror) => {
      if (placed.length >= limit) return;
      let r = Math.min(
        S * (inn === 0 ? 0.06 : inn === 1 ? 0.072 : 0.082),
        d * 0.62,
        d - bridge
      );
      if (r < S * 0.02) return;
      if (avoid && avoid.some((a) => Math.hypot(a.x - x, a.y - y) < a.r + r * 1.15)) return;
      if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < (p.r + r) * 1.22)) return;

      const a = Math.atan2(y - bb.cy, x - bb.cx);
      const ranked = DB.retrieve(holeRegion(a, Math.hypot(x - bb.cx, y - bb.cy), r, S), 3);
      const unit = ranked.length ? ranked[0].unit : DB.byId("chrysanthemum");
      punchUnit(ctx, unit, { x, y, r, angle: a }, S, "#fff");
      provenance.push({
        unit,
        score: ranked.length ? ranked[0].score : 0.6,
        role: "主体内部镂空",
        placed: 1
      });
      placed.push({ x, y, r });

      if (!allowMirror) return;
      const mx = Math.round(2 * bb.cx - x);
      const my = y;
      if (mx < 1 || mx >= S - 1) return;
      const md = distIn[my * S + mx];
      if (md < r + bridge) return;
      if (placed.some((p) => Math.hypot(p.x - mx, p.y - my) < (p.r + r) * 1.22)) return;
      const ma = Math.atan2(my - bb.cy, mx - bb.cx);
      punchUnit(ctx, unit, { x: mx, y: my, r, angle: ma }, S, "#fff");
      provenance.push({ unit, score: ranked.length ? ranked[0].score : 0.6, role: "主体内部镂空", placed: 1 });
      placed.push({ x: mx, y: my, r });
    };

    cands.forEach((c) => tryPlace(c.x, c.y, c.d, inn >= 1));
    return placed.length;
  }

  /* ---------------- 传统团花环饰 ---------------- */

  /** 只保留最大的连通块，避免主体旁边残留碎片被桥接成一堆电线 */
  function largestOnly(mask, S) {
    const lab = label(mask, S, S, 1);
    if (lab.count <= 1) return mask;
    let mi = 0;
    for (let i = 1; i < lab.stats.length; i++) {
      if (lab.stats[i].area > lab.stats[mi].area) mi = i;
    }
    const out = new Uint8Array(S * S);
    const want = mi + 1;
    for (let i = 0; i < S * S; i++) if (lab.labels[i] === want) out[i] = 1;
    return out;
  }

  function unionMask(a, b) {
    const o = new Uint8Array(a.length);
    for (let i = 0; i < a.length; i++) o[i] = (a[i] || b[i]) ? 1 : 0;
    return o;
  }

  /**
   * 在主体外围加一圈八瓣团花：花瓣与主体有意重叠，天生连成一片，
   * 让整体从「一块红」变成有花心的传统窗花构图。
   */
  function addPetalRing(bctx, mask, S, provenance) {
    const bb = bboxOf(mask, S, S);
    if (!bb.count) return { mask: new Uint8Array(S * S), holes: [], count: 0 };

    const R = Math.max(bb.w, bb.h) * 0.5;
    const petalLen = S * 0.115;
    const petalW = S * 0.075;
    const n = 8;
    const unit = DB.byId("lotus-petal");

    const tmp = mk(S);
    const tctx = ctxOf(tmp);
    tctx.fillStyle = RED;
    const holes = [];

    const hw = bb.w * 0.5, hh = bb.h * 0.5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const dx = Math.cos(a), dy = Math.sin(a);
      // 沿该方向到主体边缘的距离；花心略微收进主体，让花瓣根部埋进红面
      const tx = Math.abs(dx) > 1e-6 ? hw / Math.abs(dx) : Infinity;
      const ty = Math.abs(dy) > 1e-6 ? hh / Math.abs(dy) : Infinity;
      const edge = Math.min(tx, ty);
      const centerDist = Math.max(R * 0.35, edge * 0.92);
      const cx = bb.cx + dx * centerDist;
      const cy = bb.cy + dy * centerDist;
      // 长短瓣相间，像真团花那样有呼吸，而不是八个一样的耳朵
      const scale = i % 2 ? 0.84 : 1;
      const hl = petalLen * 0.5 * scale, hwd = petalW * 0.5 * scale;
      if (cx - hl < 0 || cy - hwd < 0 || cx + hl > S || cy + hwd > S) continue;
      tctx.save();
      tctx.translate(cx, cy);
      tctx.rotate(a);
      // 水滴瓣：根部宽厚（埋进主体），尖端收圆，是剪纸花瓣的标准造型
      tctx.beginPath();
      tctx.moveTo(-hl, 0);
      tctx.bezierCurveTo(-hl * 0.25, -hwd, hl * 0.55, -hwd * 0.95, hl * 0.97, -hwd * 0.18);
      tctx.quadraticCurveTo(hl * 1.02, 0, hl * 0.97, hwd * 0.18);
      tctx.bezierCurveTo(hl * 0.55, hwd * 0.95, -hl * 0.25, hwd, -hl, 0);
      tctx.fill();
      tctx.restore();
      // 瓣内一道柳叶形阴刻，剪出来是一条细长刀口，而不是把花瓣掏空成圆环
      holes.push({
        x: cx + dx * hl * 0.06,
        y: cy + dy * hl * 0.06,
        rx: hl * 0.5,
        ry: hwd * 0.24,
        a
      });
      provenance.push({ unit, score: 0.7, role: "团花环饰", placed: 1 });
    }

    bctx.drawImage(tmp, 0, 0);
    const data = tctx.getImageData(0, 0, S, S).data;
    const ringMask = new Uint8Array(S * S);
    for (let i = 0, p = 3; i < S * S; i++, p += 4) if (data[p] > 40) ringMask[i] = 1;
    return { mask: ringMask, holes: holes, count: holes.length };
  }

  /* ---------------- 红面绘制 ---------------- */

  /**
   * 沿剪影外缘咬出一圈浅「锯齿/月牙」缺口，是剪纸最典型的刀口语言，
   * 能把「红色块面」读成「剪出来的纸」。只咬朝向画面外侧、且内里有料的边，
   * 半径很浅，不会把结构剪断。
   */
  function scallopEdge(ctx, mask, S, inn) {
    const bb = bboxOf(mask, S, S);
    if (!bb.count) return 0;
    const spacing = Math.max(12, Math.round(S * (inn === 0 ? 0.11 : inn === 1 ? 0.095 : 0.075)));
    const rad = Math.max(3, Math.round(S * (inn === 0 ? 0.008 : inn === 1 ? 0.011 : 0.014)));
    const er = erodeMask(mask, S, S, 1);
    // 内里的厚度场：只在真正厚实的红面上咬缺口，细瓣、细颈一律不动，
    // 否则缺口会把花瓣咬断，逼出一堆细碎补桥（正是要避免的「碎线」）。
    const inv = new Uint8Array(S * S);
    for (let i = 0; i < S * S; i++) inv[i] = mask[i] ? 0 : 1;
    const dIn = distanceField(inv, S, S);

    const pts = [];
    for (let y = 1; y < S - 1; y++) {
      const row = y * S;
      for (let x = 1; x < S - 1; x++) {
        const i = row + x;
        if (!mask[i] || er[i]) continue;
        // 只取朝外、且向内 2 倍半径处仍是红的边，避免咬穿细臂
        const dx = bb.cx - x, dy = bb.cy - y;
        const len = Math.hypot(dx, dy) || 1;
        const qx = Math.round(x + (dx / len) * rad * 2.0);
        const qy = Math.round(y + (dy / len) * rad * 2.0);
        if (qx < 0 || qy < 0 || qx >= S || qy >= S || !mask[qy * S + qx]) continue;
        if (dIn[qy * S + qx] < rad * 1.6) continue;
        pts.push(x, y);
      }
    }

    const picked = [];
    const min2 = spacing * spacing;
    for (let k = 0; k < pts.length; k += 2) {
      const x = pts[k], y = pts[k + 1];
      let ok = true;
      for (let j = 0; j < picked.length; j++) {
        const ddx = picked[j].x - x, ddy = picked[j].y - y;
        if (ddx * ddx + ddy * ddy < min2) { ok = false; break; }
      }
      if (ok) picked.push({ x, y });
    }

    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#fff";
    picked.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, TAU);
      ctx.fill();
    });
    ctx.restore();
    return picked.length;
  }

  function paintMaskRed(bctx, mask, S) {
    const img = bctx.createImageData(S, S);
    for (let i = 0, p = 0; i < S * S; i++, p += 4) {
      if (!mask[i]) continue;
      img.data[p] = RED_RGB[0];
      img.data[p + 1] = RED_RGB[1];
      img.data[p + 2] = RED_RGB[2];
      img.data[p + 3] = 255;
    }
    bctx.putImageData(img, 0, 0);
  }

  /* ---------------- 边框、角花、连接筋 ---------------- */

  /**
   * 四角压角：角花的根落在边框四角中线上，与边框天生相连。
   */
  function decorateCorners(ctx, S, color, provenance) {
    const inset = S * FRAME_INSET;
    const r = S * 0.125;
    const lw = Math.max(6, S * 0.0085);
    const unit = DB.byId("corner-flower");
    const spots = [
      { x: inset, y: inset, dx: 1, dy: 1 },
      { x: S - inset, y: inset, dx: -1, dy: 1 },
      { x: inset, y: S - inset, dx: 1, dy: -1 },
      { x: S - inset, y: S - inset, dx: -1, dy: -1 }
    ];
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    spots.forEach((p) => {
      DB.draw.corner(ctx, p.x, p.y, r, lw, p.dx, p.dy);
      provenance.push({ unit, score: 0.74, role: "四角压角", placed: 1 });
    });
    ctx.restore();
  }

  /**
   * 外框：一条闭合矩形边线 + 四角回纹钩。
   */
  function drawFrame(ctx, S, color) {
    const inset = S * FRAME_INSET;
    const w = S - inset * 2;
    const lw = Math.max(5, S * 0.012);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lw;
    ctx.lineJoin = "miter";
    ctx.strokeRect(inset, inset, w, w);

    const hook = S * 0.055;
    ctx.lineWidth = Math.max(4, lw * 0.62);
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    const corners = [
      [inset, inset, 1, 1],
      [S - inset, inset, -1, 1],
      [inset, S - inset, 1, -1],
      [S - inset, S - inset, -1, -1]
    ];
    corners.forEach(([x, y, dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(x, y + dy * hook * 0.55);
      ctx.lineTo(x + dx * hook * 0.55, y + dy * hook * 0.55);
      ctx.lineTo(x + dx * hook * 0.55, y + dy * hook);
      ctx.stroke();
    });
    ctx.restore();
  }

  /**
   * 连接筋：只在离边框最近的一侧引一根短粗枝，把主体搭到边框上。
   * 不做横贯画面的长连线——那是剪纸里最忌讳的「多余交叉」。
   */
  function connectBody(ctx, body, S, color) {
    const inset = S * FRAME_INSET;
    let top = null, bottom = null, left = null, right = null;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (!body[y * S + x]) continue;
        if (!top || y < top.y) top = { x, y };
        if (!bottom || y > bottom.y) bottom = { x, y };
        if (!left || x < left.x) left = { x, y };
        if (!right || x > right.x) right = { x, y };
      }
    }
    const cands = [
      top && { from: top, to: { x: top.x, y: inset }, d: top.y - inset, vertical: true },
      bottom && { from: bottom, to: { x: bottom.x, y: S - inset }, d: S - inset - bottom.y, vertical: true },
      left && { from: left, to: { x: inset, y: left.y }, d: left.x - inset, vertical: false },
      right && { from: right, to: { x: S - inset, y: right.y }, d: S - inset - right.x, vertical: false }
    ].filter((c) => c && c.d > S * 0.008).sort((a, b) => {
      // 同等距离下优先上下向（竖向搭桥更稳、不横穿留白）
      const av = a.d - (a.vertical ? S * 0.012 : 0);
      const bv = b.d - (b.vertical ? S * 0.012 : 0);
      return av - bv;
    });

    const c = cands[0];
    if (!c || c.d > S * 0.3) return 0;

    ctx.save();
    ctx.fillStyle = color;
    // 一段由粗到细的「藤蔓」根系：根部约 4.5% 画布宽，到边框收窄到 2.4%，
    // 比等粗直线更像剪出来的枝，不会读成一根电线。
    const wBody = S * 0.045;
    const wFrame = S * 0.024;
    const vx = c.to.x - c.from.x;
    const vy = c.to.y - c.from.y;
    const vl = Math.hypot(vx, vy) || 1;
    const nx = -vy / vl;
    const ny = vx / vl;
    const mx = (c.from.x + c.to.x) / 2;
    const my = (c.from.y + c.to.y) / 2;
    const bend = c.d * 0.1;
    const cx = mx + (c.vertical ? bend : 0);
    const cy = my + (c.vertical ? 0 : bend);
    const k = 0.45;

    ctx.beginPath();
    ctx.moveTo(c.from.x + nx * wBody * 0.5, c.from.y + ny * wBody * 0.5);
    ctx.quadraticCurveTo(
      cx + nx * wBody * 0.5 * k, cy + ny * wBody * 0.5 * k,
      c.to.x + nx * wFrame * 0.5, c.to.y + ny * wFrame * 0.5
    );
    ctx.lineTo(c.to.x - nx * wFrame * 0.5, c.to.y - ny * wFrame * 0.5);
    ctx.quadraticCurveTo(
      cx - nx * wBody * 0.5 * k, cy - ny * wBody * 0.5 * k,
      c.from.x - nx * wBody * 0.5, c.from.y - ny * wBody * 0.5
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return 1;
  }

  /**
   * 连通性：孤岛补桥，保证是一整片能剪的纸。
   * keep = 主体剪影掩码（缩放后），属于主体的分量一律保留并补桥；
   * 非主体（边框角花之外的游离装饰）才允许清理。
   */
  function ensureConnected(bctx, S, color, keep) {
    const sample = () => {
      const img = bctx.getImageData(0, 0, S, S);
      const m = new Uint8Array(S * S);
      for (let i = 0, p = 3; i < S * S; i++, p += 4) m[i] = img.data[p] > 40 ? 1 : 0;
      return m;
    };

    const lab = label(sample(), S, S, 1);
    if (lab.count <= 1) return { islands: 0, bridged: 0, dropped: 0, components: lab.count };

    const inkByLabel = new Int32Array(lab.count + 1);
    for (let i = 0; i < S * S; i++) {
      if (lab.labels[i] && keep[i]) inkByLabel[lab.labels[i]]++;
    }

    let mainIdx = 0;
    for (let i = 1; i < lab.stats.length; i++) {
      if (lab.stats[i].area > lab.stats[mainIdx].area) mainIdx = i;
    }
    const mainMask = new Uint8Array(S * S);
    for (let i = 0; i < S * S; i++) {
      if (lab.labels[i] === mainIdx + 1) mainMask[i] = 1;
    }

    let bridged = 0;
    let dropped = 0;
    bctx.save();
    bctx.strokeStyle = color;
    bctx.lineCap = "round";
    for (let i = 0; i < lab.stats.length; i++) {
      if (i === mainIdx) continue;
      const st = lab.stats[i];
      const hasInk = inkByLabel[i + 1] > 0;
      // 用连通块内真实红像素作为起点（质心可能落在镂空里，导致补桥落空）
      const sx0 = st.ax != null ? st.ax : st.cx;
      const sy0 = st.ay != null ? st.ay : st.cy;
      const near = nearestOn(mainMask, S, S, sx0, sy0);
      const gap = near ? near.d : Infinity;

      if (hasInk) {
        // 含用户笔迹的分量必须保留并补桥，可剪性优先
        const tx = near ? near.x : sx0 + (sx0 < S / 2 ? S * 0.1 : -S * 0.1);
        const ty = near ? near.y : sy0;
        const mx = (sx0 + tx) / 2;
        const my = (sy0 + ty) / 2;
        const nx = -(ty - sy0);
        const ny = tx - sx0;
        const len = Math.hypot(nx, ny) || 1;
        const bend = Math.min(S * 0.03, gap * 0.2);
        // 红桥做到 2% 画布宽：印成 A4 约 3–4mm，剪刀能过，不会读成一根发丝
        bctx.lineWidth = Math.max(12, S * 0.02);
        bctx.beginPath();
        bctx.moveTo(sx0, sy0);
        bctx.quadraticCurveTo(mx + (nx / len) * bend, my + (ny / len) * bend, tx, ty);
        bctx.stroke();
        bridged++;
        continue;
      }

      // 非笔迹的装饰碎块：只有非常贴近主体时补一根短枝，否则直接清掉，
      // 避免为远处的装饰拉出横贯画面的多余连线。
      if (gap <= S * 0.04 && st.area >= 12) {
        if (near) {
          bctx.lineWidth = Math.max(8, S * 0.012);
          bctx.beginPath();
          bctx.moveTo(sx0, sy0);
          bctx.lineTo(near.x, near.y);
          bctx.stroke();
        }
        bridged++;
        continue;
      }

      bctx.globalCompositeOperation = "destination-out";
      bctx.fillRect(st.minX - 1, st.minY - 1, st.bw + 2, st.bh + 2);
      bctx.globalCompositeOperation = "source-over";
      dropped++;
    }
    bctx.restore();

    const after = label(sample(), S, S, 1);
    return {
      islands: after.count - 1,
      bridged,
      dropped,
      components: after.count
    };
  }

  /** 在掩码上环形搜索离 (x,y) 最近的像素 */
  function nearestOn(mask, w, h, x, y) {
    const cx = Math.max(0, Math.min(w - 1, Math.round(x)));
    const cy = Math.max(0, Math.min(h - 1, Math.round(y)));
    const maxR = Math.round(Math.max(w, h) * 0.6);
    for (let r = 0; r < maxR; r++) {
      const steps = Math.max(8, Math.round(r * 0.7));
      for (let s = 0; s <= steps; s++) {
        const a = (s / steps) * TAU;
        const px = Math.round(cx + Math.cos(a) * r);
        const py = Math.round(cy + Math.sin(a) * r);
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        if (mask[py * w + px]) return { x: px, y: py, d: r };
      }
    }
    return null;
  }

  /* ---------------- 纸面质感 ---------------- */

  function paintPaper(ctx, S) {
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, "#fbf6ea");
    g.addColorStop(0.5, "#f6eedd");
    g.addColorStop(1, "#efe3ce");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);

    const r = ctx.createRadialGradient(S * 0.28, S * 0.2, 0, S * 0.28, S * 0.2, S * 0.9);
    r.addColorStop(0, "rgba(255,255,255,0.75)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, S, S);
  }

  function fiber(ctx, S) {
    ctx.save();
    ctx.globalAlpha = 0.045;
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * S;
      const y = Math.random() * S;
      const l = 2 + Math.random() * (S * 0.02);
      ctx.strokeStyle = Math.random() > 0.5 ? "#7a5b3a" : "#ffffff";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + l, y + (Math.random() - 0.5) * 2);
      ctx.stroke();
    }
    ctx.restore();

    const v = ctx.createRadialGradient(S / 2, S / 2, S * 0.32, S / 2, S / 2, S * 0.78);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(70,50,30,0.16)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, S, S);
  }

  /* ---------------- 关联度（构图呼应，而非逐笔复制） ---------------- */

  function quadShares(m, S) {
    const q = [0, 0, 0, 0];
    let t = 0;
    const half = S / 2;
    for (let y = 0; y < S; y++) {
      const row = y * S;
      const dy = y < half ? 0 : 2;
      for (let x = 0; x < S; x++) {
        if (!m[row + x]) continue;
        q[dy + (x < half ? 0 : 1)]++;
        t++;
      }
    }
    return t ? q.map((v) => v / t) : [0, 0, 0, 0];
  }

  function cosine(a, b) {
    let dot = 0, aa = 0, bb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
    if (!aa || !bb) return 0;
    return dot / Math.sqrt(aa * bb);
  }

  /**
   * 关联度改成「构图呼应」：
   *   pose   重心呼应（成品主体重心 vs 原画重心）
   *   extent 体量吻合（包围盒长宽比与占幅）
   *   mass   分区呼应（四象限笔墨分布的余弦相似度）
   *   craft  刀路连贯（是否连成一片）
   */
  function correlation(a) {
    const { ink, body, S, components } = a;
    const ib = bboxOf(ink, S, S);
    const ob = bboxOf(body, S, S);

    const shift = Math.hypot(ib.cx - ob.cx, ib.cy - ob.cy);
    const pose = Math.max(0, 1 - shift / (S * 0.32));

    const ew = Math.min(ib.w, ob.w) / Math.max(1, Math.max(ib.w, ob.w));
    const eh = Math.min(ib.h, ob.h) / Math.max(1, Math.max(ib.h, ob.h));
    const extent = (ew + eh) / 2;

    const mass = cosine(quadShares(ink, S), quadShares(body, S));
    const craft = components === 1 ? 1 : components === 2 ? 0.82 : 0.66;

    const total = pose * 0.34 + extent * 0.24 + mass * 0.2 + craft * 0.22;

    return {
      pose: Math.round(pose * 100),
      extent: Math.round(extent * 100),
      mass: Math.round(mass * 100),
      craft: Math.round(craft * 100),
      total: Math.round(total * 100),
      shiftPx: Math.round(shift)
    };
  }

  /* =========================================================
     主流程
     ========================================================= */

  function compose(studio, opts) {
    const o = opts || {};
    const S = o.size || 1024;
    const innovation = o.innovation || "medium";
    const inn = innovationLevel(innovation);

    /* 1. 笔迹掩码（只作为「概括」的输入，不再直接当主体） */
    const inkCv = inkCanvas(studio, S);
    const inkData = ctxOf(inkCv).getImageData(0, 0, S, S).data;
    const ink = new Uint8Array(S * S);
    let inkCount = 0;
    for (let i = 0, p = 0; i < S * S; i++, p += 4) {
      if (inkData[p + 3] > 26) { ink[i] = 1; inkCount++; }
    }
    if (inkCount < 40) return null;

    /* 2. 概括成块面剪影；笔迹太少则退化为「以原画为种子」的传统团花 */
    const rawSil = buildSilhouette(ink, S, inn);
    // 再开一次大半径运算：细于约 2r 的带状/涂鸦笔画会被整条消掉，
    // 只留下有厚度的块面，避免加粗后变成一条红绸带。
    const deStroke = openMask(rawSil, S, S, Math.max(3, Math.round(S * (inn === 0 ? 0.008 : inn === 2 ? 0.014 : 0.012))));
    const massSil = filterMasses(deStroke, S);
    // 邻近的块面用一次闭运算直接连成一体（厚连接），少靠细线去补
    const merged = closeMask(massSil, S, S, Math.max(4, Math.round(S * 0.03)));
    const norm = normalizeSilhouette(merged, S, 0.78);
    let mask = norm.mask;
    let mode = "silhouette";

    const coverage = norm.count / (S * S);
    if (coverage < 0.012) {
      const ib = bboxOf(ink, S, S);
      const cx = ib.count ? ib.cx : S / 2;
      const cy = ib.count ? ib.cy : S / 2;
      const R = Math.max(S * 0.16, Math.min(S * 0.27, Math.max(ib.w, ib.h) * 0.5));
      const med = medallionMask(S, cx, cy, R);
      mask = med.mask;
      mode = "medallion";
    }

    /* 3. 阳刻红面：只保留最大主体，旁边碎片一律不要，避免后续电线式补桥 */
    mask = largestOnly(mask, S);
    const provenance = [];

    const bodyCv = mk(S);
    const bctx = ctxOf(bodyCv);
    paintMaskRed(bctx, mask, S);
    const scallops = scallopEdge(bctx, mask, S, inn);

    /* 3.5 八瓣团花环饰：与主体重叠，天生连成一片 */
    const ring = addPetalRing(bctx, mask, S, provenance);
    const keep = unionMask(mask, ring.mask);

    /* 4. 阴刻镂空：纹样取自素材库 */
    const holeCv = mk(S);
    const hctx = ctxOf(holeCv);
    hctx.strokeStyle = "#fff";
    hctx.fillStyle = "#fff";
    hctx.lineCap = "round";
    hctx.lineJoin = "round";
    // 先开一朵团花心，再在其余厚实处补库里的纹样镂空，避免互相打架
    const avoid = [];
    const rosette = addCenterRosette(hctx, mask, S, inn, avoid);
    const holeCount = punchHoles(hctx, mask, S, inn, provenance, avoid);
    hctx.fillStyle = "#fff";
    ring.holes.forEach((h) => {
      hctx.beginPath();
      hctx.ellipse(h.x, h.y, h.rx, h.ry, h.a, 0, TAU);
      hctx.fill();
    });
    bctx.save();
    bctx.globalCompositeOperation = "destination-out";
    bctx.drawImage(holeCv, 0, 0);
    bctx.restore();

    /* 5. 边框 + 四角角花 + 连接筋 */
    const gapCv = mk(S);
    const gctx = ctxOf(gapCv);
    gctx.strokeStyle = RED;
    gctx.fillStyle = RED;
    gctx.lineCap = "round";
    gctx.lineJoin = "round";
    decorateCorners(gctx, S, RED, provenance);
    drawFrame(gctx, S, RED);
    const stems = connectBody(gctx, mask, S, RED);
    provenance.push({ unit: DB.byId("meander"), score: 0.7, role: "外框边饰", placed: 1 });

    /* 6. 合成 + 连通性校正（保证是一整片可剪的纸） */
    bctx.drawImage(gapCv, 0, 0);
    const checks = ensureConnected(bctx, S, RED, keep);

    /* 7. 纸面 + 刀口 + 落影 */
    const out = mk(S);
    const octx = ctxOf(out);
    paintPaper(octx, S);
    octx.save();
    octx.shadowColor = "rgba(52, 34, 22, 0.34)";
    octx.shadowBlur = S * 0.014;
    octx.shadowOffsetY = S * 0.004;
    octx.drawImage(bodyCv, 0, 0);
    octx.restore();
    fiber(octx, S);

    /* 8. 构图呼应度 */
    const corp = correlation({ ink, body: mask, S, components: checks.components });

    return {
      canvas: out,
      dataURL: out.toDataURL("image/png"),
      provenance,
      correlation: corp,
      checks,
      pixels: {
        inkShare: inkCount / (S * S),
        bodyShare: (norm.count || 0) / (S * S)
      },
      stats: {
        inkPx: inkCount,
        bodyPx: norm.count || 0,
        holes: holeCount + rosette + ring.count,
        ring: ring.count,
        scallops: scallops,
        mode: mode,
        stems: stems,
        components: checks.components,
        bridged: checks.bridged,
        innovation: innovation
      }
    };
  }

  window.XHFYPapercut = { compose, _internals: { dilate, markOutside, label } };
})();
