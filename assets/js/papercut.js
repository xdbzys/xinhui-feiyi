/* =========================================================
   心绘非遗 · 剪纸锚定引擎（papercut）
   ---------------------------------------------------------
   与「让图像模型整幅重画」不同，这里的规则是：
     1. 用户笔迹 = 画面主骨架，原样加粗成红纸阳刻主体，不改形、不挪位；
     2. 笔迹围合出的封闭区域 = 主体内部，填红后按区域形状从纹样库
        检索最契合的单元，镂空成孔（阴刻）；
     3. 主体之外的空白 = 间隙，只用纹样库的角花、卷草、云纹做点缀，
        且每个点缀都用缠枝「牵」到主体上，保证整张剪纸是一整片纸，
        不会出现剪下来会掉的孤岛；
     4. 输出纹样溯源（引用了库里的哪些单元）与原画关联度（哪些结构
        来自用户原画、哪些来自素材库）。
   —— 装饰只做加法与镂空，绝不替换用户画出来的物象。
   ========================================================= */
(function () {
  "use strict";

  const DB = window.XHFYMotifDB;
  const TAU = Math.PI * 2;
  /** 外框边线距纸边的距离（占画布边长的比例） */
  const FRAME_INSET = 0.028;

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

  /** 可分离最大值膨胀：把细笔迹加粗到剪纸可承受的线宽 */
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

  /** 从边界泛洪，标出「外部」；剩下的空洞就是笔迹围合出来的内部 */
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
        minX, minY, maxX, maxY,
        bw: maxX - minX + 1,
        bh: maxY - minY + 1,
        angle: ang,
        elongation: Math.max(sxx, syy) / Math.max(1e-3, Math.min(sxx, syy))
      });
    }
    return { labels, count, stats };
  }

  /* ---------------- 区域描述 ---------------- */

  function describeRegion(st, S) {
    const elong = st.bh > 0 && st.bw > 0 ? Math.max(st.bw, st.bh) / Math.max(1, Math.min(st.bw, st.bh)) : 1;
    const circle = Math.min(st.bw, st.bh) / Math.max(1, Math.max(st.bw, st.bh));
    // 区位：落在哪个四角 / 是否贴边成带
    const cx = st.cx / S, cy = st.cy / S;
    const nearCorner =
      (cx < 0.26 || cx > 0.74) && (cy < 0.26 || cy > 0.74);
    const thinBand = Math.min(st.bw, st.bh) < S * 0.06;

    let shape = "round";
    if (nearCorner && st.area < S * S * 0.05) shape = "corner";
    else if (elong > 2.1 || thinBand) shape = "elongated";
    else if (elong > 1.5) shape = "round";

    // 六维匹配需要的特征
    const areaShare = st.area / (S * S);
    // 体量：大区域配团花，小区域配单枚小纹样
    const sizeClass = (areaShare > 0.016 || Math.min(st.bw, st.bh) > S * 0.15) ? "large" : "small";
    return {
      shape,
      zone: shape === "corner" ? "corner" : (thinBand ? "band" : "inner"),
      curve: 0.35 + circle * 0.6,
      angular: 0.9 - circle * 0.55,
      radial: circle * 0.85,
      linear: Math.min(1, (elong - 1) / 2.2),
      density: sizeClass === "large" ? 0.7 : 0.42,
      sizeClass,
      angle: st.angle,
      inradius: Math.max(6, Math.min(st.bw, st.bh) * 0.5),
      area: st.area
    };
  }

  /* ---------------- 镂空绘制（阴刻） ---------------- */

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

  /* ---------------- 主流程 ---------------- */

  function compose(studio, opts) {
    const o = opts || {};
    const S = o.size || 1024;
    const tags = o.tags || [];
    const W = S;
    const H = S;

    /* 1. 原画 → 墨迹掩码（这是唯一的主体来源） */
    const inkCv = inkCanvas(studio, S);
    const inkData = ctxOf(inkCv).getImageData(0, 0, S, S).data;
    const ink = new Uint8Array(S * S);
    let inkCount = 0;
    for (let i = 0, p = 0; i < S * S; i++, p += 4) {
      if (inkData[p + 3] > 26) { ink[i] = 1; inkCount++; }
    }
    if (inkCount < 40) return null;

    /* 2. 加粗到可剪线宽；笔迹围合的空洞填红 —— 主体成型 */
    const strokeR = Math.max(3, Math.round(S * 0.0042));
    const thick = dilate(ink, W, H, strokeR);
    const outside = markOutside(thick, W, H);
    const enclosed = new Uint8Array(S * S);
    let enclosedCount = 0;
    for (let i = 0; i < S * S; i++) {
      if (!thick[i] && !outside[i]) { enclosed[i] = 1; enclosedCount++; }
    }
    const body = new Uint8Array(S * S);
    for (let i = 0; i < S * S; i++) body[i] = thick[i] || enclosed[i] ? 1 : 0;

    /* 3. 主体画布：红纸阳刻主体 */
    const bodyCv = mk(S);
    const bctx = ctxOf(bodyCv);
    const red = "#a8332a";
    const bimg = bctx.createImageData(S, S);
    for (let i = 0, p = 0; i < S * S; i++, p += 4) {
      if (body[i]) {
        bimg.data[p] = 168; bimg.data[p + 1] = 51; bimg.data[p + 2] = 42;
        bimg.data[p + 3] = 255;
      }
    }
    bctx.putImageData(bimg, 0, 0);

    /* 4. 主体内部：按区域形状检索纹样并镂空 */
    const provenance = [];
    const encLabel = label(enclosed, W, H, 1);
    const minArea = S * S * 0.0016;
    const punched = [];

    for (let k = 0; k < encLabel.stats.length; k++) {
      const st = encLabel.stats[k];
      if (st.area < minArea) continue;

      const region = describeRegion(st, S);
      region.tags = tags;
      const ranked = DB.retrieve(region, 3);
      if (!ranked.length) continue;
      const pick = ranked[0];

      // 先把该区域向内收缩一个安全边距，保证镂空后仍留有红桥
      const margin = Math.max(7, Math.round(S * 0.012));
      const regionMask = new Uint8Array(S * S);
      for (let i = 0; i < S * S; i++) {
        if (encLabel.labels[i] === k + 1) regionMask[i] = 1;
      }
      const holeMask = erodeInside(regionMask, W, H, margin, st);

      // 逐个镂空
      const holes = mk(S);
      const hctx = ctxOf(holes);
      hctx.strokeStyle = "#fff";
      hctx.fillStyle = "#fff";
      hctx.lineCap = "round";
      hctx.lineJoin = "round";

      const placed = layoutFor(region, st, S, margin, pick.unit);
      placed.forEach((d) => punchUnit(hctx, pick.unit, d, S, "#fff"));

      if (holeMask) {
        const hm = hctx.getImageData(0, 0, S, S);
        for (let i = 0, p = 3; i < S * S; i++, p += 4) {
          if (!holeMask[i] && hm.data[p] > 0) hm.data[p] = 0;
        }
        hctx.putImageData(hm, 0, 0);
      }

      bctx.save();
      bctx.globalCompositeOperation = "destination-out";
      bctx.drawImage(holes, 0, 0);
      bctx.restore();

      punched.push({ region, unit: pick.unit, score: pick.score });
      provenance.push({
        unit: pick.unit,
        score: pick.score,
        region: region,
        role: "主体内部镂空",
        placed: placed.length
      });
    }

    /* 4.5 主体内部的原始笔迹 → 阴刻刻线
       用户画在闭合区域里的线条（窗棂、纹理、五官）如果被红面盖住，
       就等于把原画丢了。这里把它们刻成白线：既是剪纸的「刻线」语法，
       也让原画的内部结构在成品里继续看得见。 */
    const carvedPx = carveInnerInk(bctx, ink, outside, S, strokeR);

    /* 5. 边角：只压四角，不进门
       角花直接长在边框四角上，天然与边框相连，不会在画面中央横生枝节。 */
    const gapCv = mk(S);
    const gctx = ctxOf(gapCv);
    gctx.strokeStyle = red;
    gctx.fillStyle = red;
    gctx.lineCap = "round";
    gctx.lineJoin = "round";
    decorateCorners(gctx, S, red, provenance);

    /* 6. 边框 + 连接筋：主体到边框最多两根短枝，不做四向放射 */
    drawFrame(gctx, S, red);
    const stems = connectBody(gctx, body, S, red);
    provenance.push({
      unit: DB.byId("meander"),
      score: 0.7,
      role: "外框边饰",
      placed: 1
    });

    /* 7. 合成 + 连通性校正（孤岛补桥，保证是一整片可剪的纸） */
    bctx.drawImage(gapCv, 0, 0);
    const checks = ensureConnected(bctx, S, red, ink);

    /* 8. 长卷纸面 + 刀口 + 落影 */
    const out = mk(S);
    const octx = ctxOf(out);
    paintPaper(octx, S);
    octx.save();
    octx.shadowColor = "rgba(52, 34, 22, 0.34)";
    octx.shadowBlur = S * 0.014;
    octx.shadowOffsetY = S * 0.004;
    octx.drawImage(bodyCv, 0, 0);
    octx.restore();

    // 纸纤维与暖光
    fiber(octx, S);

    /* 9. 关联度：全部由像素统计得出，不用估计 */
    const corp = correlation({ ink, body, S, inkCount, components: checks.components });

    return {
      canvas: out,
      dataURL: out.toDataURL("image/png"),
      provenance,
      correlation: corp,
      checks,
      pixels: {
        inkShare: inkCount / (S * S),
        enclosedShare: enclosedCount / (S * S),
        carvedShare: carvedPx / (S * S)
      },
      stats: {
        inkPx: inkCount,
        enclosedPx: enclosedCount,
        enclosedRegions: encLabel.stats.length,
        filledRegions: punched.length,
        carvedPx: carvedPx,
        stems: stems,
        components: checks.components
      }
    };
  }

  /**
   * 主体内部的原始笔迹刻成白线。
   * 只在离外轮廓两个笔宽以外的地方刻，保证刻线不会一路刻到边缘，
   * 把主体切成几块掉下来。
   */
  function carveInnerInk(bctx, ink, outside, S, strokeR) {
    const buffer = S * S;
    const nearOutside = dilate(outside, S, S, strokeR * 2 + 1);
    const cv = mk(S);
    const c = ctxOf(cv);
    const img = c.createImageData(S, S);
    let n = 0;
    for (let i = 0, p = 0; i < buffer; i++, p += 4) {
      if (ink[i] && !nearOutside[i]) {
        img.data[p] = 255;
        img.data[p + 1] = 255;
        img.data[p + 2] = 255;
        img.data[p + 3] = 255;
        n++;
      }
    }
    if (!n) return 0;
    c.putImageData(img, 0, 0);
    bctx.save();
    bctx.globalCompositeOperation = "destination-out";
    bctx.drawImage(cv, 0, 0);
    bctx.restore();
    return n;
  }

  /**
   * 区域内缩：真正决定镂空安全边距的是「区域内缩后」的像素。
   * 只在区域的包围盒（外扩 margin）里做膨胀，避免每次扫全画布。
   */
  function erodeInside(mask, w, h, r, st) {
    const x0 = Math.max(0, st.minX - r - 1);
    const y0 = Math.max(0, st.minY - r - 1);
    const x1 = Math.min(w - 1, st.maxX + r + 1);
    const y1 = Math.min(h - 1, st.maxY + r + 1);
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;

    const comp = new Uint8Array(bw * bh);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        comp[y * bw + x] = mask[(y + y0) * w + (x + x0)] ? 0 : 1;
      }
    }
    const grown = dilate(comp, bw, bh, r);

    const out = new Uint8Array(w * h);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const gi = (y + y0) * w + (x + x0);
        if (mask[gi] && !grown[y * bw + x]) out[gi] = 1;
      }
    }
    return out;
  }

  /**
   * 四角压角：角花的根就落在边框的四角中线上，
   * 所以它和边框天生是连着的，不需要再往画面中央牵线。
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
   * 连接筋：从主体最靠近边框的两处引出短枝搭到边框上。
   * 最多两根、长度受限、带一片叶子——像长出来的枝，而不是放射状的辐条。
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
    ].filter((c) => c && c.d > S * 0.012).sort((a, b) => a.d - b.d);

    // 只取最近的两处，且不能远到横穿半幅画面
    const picked = cands.slice(0, 2).filter((c) => c.d < S * 0.34);
    if (!picked.length) return 0;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(5, S * 0.0072);
    picked.forEach((c) => {
      const mx = (c.from.x + c.to.x) / 2;
      const my = (c.from.y + c.to.y) / 2;
      const bend = c.d * 0.16;
      const bx = c.vertical ? bend : 0;
      const by = c.vertical ? 0 : bend;
      ctx.beginPath();
      ctx.moveTo(c.to.x, c.to.y);
      ctx.quadraticCurveTo(mx + bx, my + by, c.from.x, c.from.y);
      ctx.stroke();
      // 枝头一片小叶，让这根筋看起来是长出来的
      DB.draw.leaf(ctx, mx + bx, my + by, S * 0.05, S * 0.017,
        c.vertical ? 0 : Math.PI / 2);
    });
    ctx.restore();
    return picked.length;
  }

  /** 某一区域内的落位方案 */
  function layoutFor(region, st, S, margin, unit) {
    const out = [];
    const cx = st.cx, cy = st.cy;
    const short = Math.min(st.bw, st.bh) * 0.5 - margin * 1.1;

    if (region.shape === "elongated") {
      const n = Math.max(2, Math.min(5, Math.round(Math.max(st.bw, st.bh) / (S * 0.075))));
      const along = st.bw >= st.bh;
      const span = along ? st.bw : st.bh;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n - 0.5;
        out.push({
          x: cx + (along ? t * span * 0.82 : 0),
          y: cy + (along ? 0 : t * span * 0.82),
          r: Math.max(S * 0.018, Math.min(short * 0.7, S * 0.06)),
          angle: (along ? 0 : Math.PI / 2) + st.angle
        });
      }
      return out;
    }

    if (region.shape === "corner") {
      out.push({
        x: cx, y: cy,
        r: Math.max(S * 0.03, Math.min(short * 0.9, S * 0.11)),
        dx: cx < S / 2 ? 1 : -1,
        dy: cy < S / 2 ? 1 : -1
      });
      return out;
    }

    // 团块：中心一朵，边缘补一圈打籽
    const r = Math.max(S * 0.03, Math.min(short * 0.86, S * 0.12));
    out.push({ x: cx, y: cy, r, angle: st.angle });
    if (short > S * 0.075) {
      const dots = Math.min(3, 1 + Math.round(short / (S * 0.05)));
      for (let i = 0; i < dots; i++) {
        const a = st.angle + Math.PI * 0.25 + (i / dots) * TAU;
        out.push({
          x: cx + Math.cos(a) * short * 0.62,
          y: cy + Math.sin(a) * short * 0.62,
          r: Math.max(S * 0.016, short * 0.22),
          angle: a
        });
      }
    }
    return out;
  }

  /**
   * 外框：一条闭合的矩形边线 + 四角回纹钩。
   * 回纹钩的起点压在边框的中线上，保证与边框真正相交（差半个线宽就会断成孤岛）。
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

    // 四角回纹钩：起点在边框中线上，天然与边框连成一体
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
      // 先从边框中线往里折一段
      ctx.moveTo(x, y + dy * hook * 0.55);
      ctx.lineTo(x + dx * hook * 0.55, y + dy * hook * 0.55);
      ctx.lineTo(x + dx * hook * 0.55, y + dy * hook);
      ctx.stroke();
    });
    ctx.restore();
  }

  /**
   * 连通性：孤岛补桥，保证是一整片能剪的纸。
   * 桥只画在近处（远距离硬连会横穿用户画面）；太小的非笔迹碎点直接清掉。
   * 返回值是补桥之后的真实连通域数。
   */
  function ensureConnected(bctx, S, color, ink) {
    const sample = () => {
      const img = bctx.getImageData(0, 0, S, S);
      const m = new Uint8Array(S * S);
      for (let i = 0, p = 3; i < S * S; i++, p += 4) m[i] = img.data[p] > 40 ? 1 : 0;
      return m;
    };

    const lab = label(sample(), S, S, 1);
    if (lab.count <= 1) return { islands: 0, bridged: 0, dropped: 0, components: lab.count };

    // 一次性统计每个连通域里有多少「用户笔迹」像素——笔迹永远不删
    const inkByLabel = new Int32Array(lab.count + 1);
    for (let i = 0; i < S * S; i++) {
      if (lab.labels[i] && ink[i]) inkByLabel[lab.labels[i]]++;
    }

    let mainIdx = 0;
    for (let i = 1; i < lab.stats.length; i++) {
      if (lab.stats[i].area > lab.stats[mainIdx].area) mainIdx = i;
    }
    // 主分量的真实像素掩码：包围盒会覆盖整幅（边框就是这样），不能用来量距离
    const mainMask = new Uint8Array(S * S);
    for (let i = 0; i < S * S; i++) {
      if (lab.labels[i] === mainIdx + 1) mainMask[i] = 1;
    }

    let bridged = 0;
    let dropped = 0;
    bctx.save();
    bctx.fillStyle = color;
    bctx.strokeStyle = color;
    bctx.lineCap = "round";
    for (let i = 0; i < lab.stats.length; i++) {
      if (i === mainIdx) continue;
      const st = lab.stats[i];
      const hasInk = inkByLabel[i + 1] > 0;
      const near = nearestOn(mainMask, S, S, st.cx, st.cy);
      const gap = near ? near.d : Infinity;

      // 近处：补一根弯枝把孤岛拉回主体（带叶，不像硬连线）
      if (near && gap <= S * 0.26) {
        const mx = (st.cx + near.x) / 2;
        const my = (st.cy + near.y) / 2;
        const nx = -(near.y - st.cy);
        const ny = near.x - st.cx;
        const len = Math.hypot(nx, ny) || 1;
        const bend = Math.min(S * 0.025, gap * 0.2);
        bctx.lineWidth = Math.max(5, S * 0.0062);
        bctx.beginPath();
        bctx.moveTo(st.cx, st.cy);
        bctx.quadraticCurveTo(mx + (nx / len) * bend, my + (ny / len) * bend, near.x, near.y);
        bctx.stroke();
        bridged++;
        continue;
      }

      // 远处：只有「不是用户画的东西」才清掉，笔迹一律保留
      if (!hasInk && st.area < 48) {
        bctx.globalCompositeOperation = "destination-out";
        bctx.fillRect(st.minX - 1, st.minY - 1, st.bw + 2, st.bh + 2);
        bctx.globalCompositeOperation = "source-over";
        dropped++;
      }
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

    // 淡淡的晕
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

    // 纸边压暗
    const v = ctx.createRadialGradient(S / 2, S / 2, S * 0.32, S / 2, S / 2, S * 0.78);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(70,50,30,0.16)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, S, S);
  }

  /* ---------------- 关联度 ---------------- */

  /**
   * 全部指标由像素统计得出：
   *   skeleton     主骨架保留率（原笔迹有多少仍落在成品红纸上）
   *   contour      包围盒吻合（成品主体包围盒 vs 原画笔迹包围盒）
   *   blank        留白保持（装饰与红面增量占画面的比例，越少越不喧宾夺主）
   *   craft        刀路连贯（整幅是否连成一片、有无孤岛）
   * 另附 shiftPx：原画与成品包围盒中心的偏移。
   */
  function correlation(a) {
    const { ink, body, S, inkCount, components } = a;
    const total = S * S;

    // 主骨架保留：原笔迹像素中仍落在成品红纸上的比例
    let kept = 0;
    for (let i = 0; i < total; i++) if (ink[i] && body[i]) kept++;
    const skeleton = inkCount ? kept / inkCount : 0;

    // 包围盒（顺便取中心，用来算偏移）
    let ix0 = S, iy0 = S, ix1 = 0, iy1 = 0;
    let ox0 = S, oy0 = S, ox1 = 0, oy1 = 0;
    let bodyCount = 0;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = y * S + x;
        if (ink[i]) {
          if (x < ix0) ix0 = x; if (x > ix1) ix1 = x;
          if (y < iy0) iy0 = y; if (y > iy1) iy1 = y;
        }
        if (body[i]) {
          bodyCount++;
          if (x < ox0) ox0 = x; if (x > ox1) ox1 = x;
          if (y < oy0) oy0 = y; if (y > oy1) oy1 = y;
        }
      }
    }
    const iw = ix1 - ix0 + 1, ih = iy1 - iy0 + 1;
    const ow = ox1 - ox0 + 1, oh = oy1 - oy0 + 1;
    const contour = Math.max(0, 1 - (Math.abs(ow - iw) / Math.max(1, iw) * 0.5 +
                                      Math.abs(oh - ih) / Math.max(1, ih) * 0.5));
    const shift = Math.hypot((ix0 + ix1) / 2 - (ox0 + ox1) / 2,
                             (iy0 + iy1) / 2 - (oy0 + oy1) / 2) / S;

    // 留白：红面相对原笔迹的增量占画面的比例，越少越「不喧宾夺主」
    const blank = Math.max(0, 1 - Math.max(0, bodyCount - kept) / (total * 0.32));

    // 刀路连贯：整幅连成一片才是能剪下来的纸
    const craft = components === 1 ? 1 : components === 2 ? 0.82 : 0.68;

    const totalScore = skeleton * 0.42 + contour * 0.2 + blank * 0.2 + craft * 0.18;

    return {
      skeleton: Math.round(skeleton * 100),
      contour: Math.round(contour * 100),
      blank: Math.round(blank * 100),
      craft: Math.round(craft * 100),
      total: Math.round(totalScore * 100),
      shiftPx: Math.round(shift * S)
    };
  }

  window.XHFYPapercut = { compose, _internals: { dilate, markOutside, label } };
})();
