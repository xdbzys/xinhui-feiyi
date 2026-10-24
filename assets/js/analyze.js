/* =========================================================
   心绘非遗 · 本地视觉分析引擎
   色彩温度 / 线条张力 / 空间留白 / 扎根感 / 生命感 / 秩序感
   —— 不依赖后端，先把画面读成可解释的量化指标
   ========================================================= */
(function () {
  "use strict";

  const PAPER = { r: 251, g: 247, b: 236 };
  const AW = 480;
  const AH = 320;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function round(v) { return Math.round(v * 100) / 100; }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4;
      }
      h *= 60;
    }
    return [h, s, l];
  }

  function hueName(h, s, l) {
    if (s < 0.12 || l < 0.1) return "墨色";
    if (h < 15 || h >= 345) return "朱砂";
    if (h < 38) return "赭石";
    if (h < 65) return "落日";
    if (h < 100) return "苔绿";
    if (h < 155) return "竹青";
    if (h < 195) return "湖蓝";
    if (h < 260) return "靛蓝";
    if (h < 300) return "紫黛";
    return "绯红";
  }

  function analyze(studio) {
    const src = studio.composite(AW);
    const ctx = src.getContext("2d", { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, AW, AH);
    const data = img.data;
    const total = AW * AH;

    const lum = new Float32Array(total);
    const mask = new Uint8Array(total);
    const hueArr = new Float32Array(total);
    const satArr = new Float32Array(total);

    let inkCount = 0;
    let sumX = 0;
    let sumY = 0;
    let warm = 0;
    let cool = 0;
    let green = 0;
    let neutral = 0;
    let satSum = 0;
    let lightSum = 0;

    const hueBins = new Array(24).fill(0);
    const buckets = new Map();
    const grid = [0, 0, 0, 0, 0, 0, 0, 0, 0].fill(0);
    const gridTotal = [0, 0, 0, 0, 0, 0, 0, 0, 0].fill(0);

    for (let y = 0; y < AH; y++) {
      for (let x = 0; x < AW; x++) {
        const i = (y * AW + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const dist = Math.max(Math.abs(r - PAPER.r), Math.abs(g - PAPER.g), Math.abs(b - PAPER.b));
        const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        lum[y * AW + x] = L;

        const col = clamp(Math.floor(x / (AW / 3)), 0, 2);
        const row = clamp(Math.floor(y / (AH / 3)), 0, 2);
        const gi = row * 3 + col;
        gridTotal[gi]++;

        if (dist > 26) {
          mask[y * AW + x] = 1;
          inkCount++;
          sumX += x;
          sumY += y;
          grid[gi]++;

          const hsl = rgbToHsl(r, g, b);
          const h = hsl[0], s = hsl[1], l = hsl[2];
          hueArr[y * AW + x] = h;
          satArr[y * AW + x] = s;
          satSum += s;
          lightSum += l;

          if (s > 0.1) {
            const bin = Math.floor(h / 15) % 24;
            hueBins[bin]++;
          }

          if (s < 0.12) neutral++;
          else if (h <= 65 || h >= 320) warm++;
          else if (h >= 170 && h < 265) cool++;
          else if (h >= 65 && h < 170) green++;
          else neutral++;

          if (dist > 40) {
            const key = ((r >> 5) << 10) | ((g >> 5) << 5) | (b >> 5);
            let bk = buckets.get(key);
            if (!bk) {
              bk = { n: 0, r: 0, g: 0, b: 0, h: 0, s: 0, l: 0 };
              buckets.set(key, bk);
            }
            bk.n++;
            bk.r += r; bk.g += g; bk.b += b;
            bk.h += h; bk.s += s; bk.l += l;
          }
        }
      }
    }

    // Sobel 边缘
    let edgeCount = 0;
    let edgeInk = 0;
    let edgeSumInk = 0;
    const orientBins = new Array(12).fill(0);
    for (let y = 1; y < AH - 1; y++) {
      for (let x = 1; x < AW - 1; x++) {
        const p = y * AW + x;
        const gx =
          -lum[p - AW - 1] - 2 * lum[p - AW] - lum[p - AW + 1] +
          lum[p + AW - 1] + 2 * lum[p + AW] + lum[p + AW + 1];
        const gy =
          -lum[p - 1] - 2 * lum[p] - lum[p + 1] +
          lum[p + AW - 1] + 2 * lum[p + AW] + lum[p + AW + 1];
        const mag = Math.sqrt(gx * gx + gy * gy);
        if (mag > 30) {
          edgeCount++;
          if (mask[p]) {
            edgeInk++;
            edgeSumInk += mag;
            let ang = Math.atan2(gy, gx);
            if (ang < 0) ang += Math.PI;
            if (ang >= Math.PI) ang -= Math.PI;
            const bin = clamp(Math.floor((ang / Math.PI) * 12), 0, 11);
            orientBins[bin] += mag;
          }
        }
      }
    }

    const coverage = inkCount / total;
    const edgeDensity = edgeCount / Math.max(1, total);
    const edgeStrength = edgeInk ? edgeSumInk / edgeInk : 0;

    // 方向熵 & 色彩熵
    let orientTotal = 0;
    orientBins.forEach((v) => (orientTotal += v));
    let orientEntropy = 0;
    if (orientTotal > 0) {
      for (const v of orientBins) {
        if (v > 0) {
          const p = v / orientTotal;
          orientEntropy -= p * Math.log(p);
        }
      }
      orientEntropy /= Math.log(12);
    }

    let hueTotal = 0;
    hueBins.forEach((v) => (hueTotal += v));
    let hueEntropy = 0;
    if (hueTotal > 0) {
      for (const v of hueBins) {
        if (v > 0) {
          const p = v / hueTotal;
          hueEntropy -= p * Math.log(p);
        }
      }
      hueEntropy /= Math.log(24);
    }

    // 左右镜像相似度（秩序感线索）
    let inter = 0;
    let union = 0;
    for (let y = 0; y < AH; y++) {
      for (let x = 0; x < AW; x++) {
        const a = mask[y * AW + x];
        const b = mask[y * AW + (AW - 1 - x)];
        if (a || b) union++;
        if (a && b) inter++;
      }
    }
    const symmetry = union ? inter / union : 0;

    // 重心与分区
    const cx = inkCount ? sumX / inkCount / AW : 0.5;
    const cy = inkCount ? sumY / inkCount / AH : 0.5;
    const topWeight = (grid[0] + grid[1] + grid[2]) / Math.max(1, inkCount);
    const bottomWeight = (grid[6] + grid[7] + grid[8]) / Math.max(1, inkCount);
    const leftWeight = (grid[0] + grid[3] + grid[6]) / Math.max(1, inkCount);
    const rightWeight = (grid[2] + grid[5] + grid[8]) / Math.max(1, inkCount);

    const warmRatio = inkCount ? warm / inkCount : 0;
    const coolRatio = inkCount ? cool / inkCount : 0;
    const greenRatio = inkCount ? green / inkCount : 0;
    const neutralRatio = inkCount ? neutral / inkCount : 0;
    const satAvg = inkCount ? satSum / inkCount : 0;
    const lightAvg = inkCount ? lightSum / inkCount : 0.9;

    // 主色排序
    const colors = [];
    buckets.forEach((v) => {
      if (v.n < total * 0.0015) return;
      const r = Math.round(v.r / v.n);
      const g = Math.round(v.g / v.n);
      const b = Math.round(v.b / v.n);
      colors.push({
        hex: "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join(""),
        name: hueName(v.h / v.n, v.s / v.n, v.l / v.n),
        ratio: v.n / Math.max(1, inkCount),
        n: v.n
      });
    });
    colors.sort((a, b) => b.n - a.n);
    const dominant = colors.slice(0, 5).map((c) => ({
      hex: c.hex,
      name: c.name,
      ratio: round(c.ratio)
    }));

    const stats = studio.strokeStats();
    const softRatio = stats.strokes ? stats.soft / stats.strokes : 0;
    const lineRatio = stats.strokes ? stats.line / stats.strokes : 0;

    // 作画过程信号：说明「怎么画」比只看「画了什么」多一层信息
    const speedLabel = stats.strokeSpeed > 0.6
      ? "偏快"
      : stats.strokeSpeed < 0.2
        ? "偏慢"
        : "适中";
    const process = {
      totalSec: stats.totalSec,
      activeSec: stats.activeSec,
      strokes: stats.strokes,
      undo: stats.undo,
      redo: stats.redo,
      clear: stats.clear,
      eraser: stats.eraser,
      pauses: stats.pauseCount,
      longestPauseSec: stats.longestPauseSec,
      distinctColors: stats.distinctColors,
      colorSwitches: stats.colorSwitches,
      toolCount: stats.toolCount,
      strokeSpeed: stats.strokeSpeed,
      speedLabel: speedLabel,
      pauseMarks: stats.pauses,
      changes: stats.undo + stats.eraser + stats.clear
    };

    // 行为标签：规则来自 knowledge.js 的 behaviorRules，只做确定性映射
    const tagIds = [];
    if (process.changes >= 3) tagIds.push("hesitate");
    else if (process.changes === 0 && process.strokes >= 3) tagIds.push("decisive");
    if (process.distinctColors >= 4 && process.colorSwitches >= 3) tagIds.push("explore");
    if (process.distinctColors <= 1 && process.strokes >= 3) tagIds.push("mono");
    if (process.pauses >= 2) tagIds.push("pause");
    if (speedLabel === "偏快") tagIds.push("fast");
    if (speedLabel === "偏慢" && process.strokes >= 2) tagIds.push("slow");
    if (process.activeSec >= 90) tagIds.push("invest");
    const rules = (window.XHFYKnowledge && window.XHFYKnowledge.behaviorRules) || [];
    const behavior = {
      tags: tagIds.map((id) => {
        const r = rules.find((x) => x.id === id);
        return r ? r.label : id;
      }),
      details: tagIds.map((id) => {
        const r = rules.find((x) => x.id === id);
        return r ? { id: r.id, label: r.label, hint: r.hint } : { id, label: id, hint: "" };
      })
    };

    // 六大心象维度（0-100）
    const scores = {
      warmth: clamp(32 + (warmRatio - coolRatio) * 55 + satAvg * 28 - neutralRatio * 8, 6, 96),
      tension: clamp((edgeStrength - 18) * 0.62 + edgeDensity * 260 + lineRatio * 10 + Math.min(18, stats.avgSpeed * 9), 4, 96),
      space: clamp(100 - coverage * 400, 8, 96),
      grounded: clamp(42 + (bottomWeight - 0.33) * 105 + (0.5 - Math.abs(cx - 0.5)) * 42 + symmetry * 18, 6, 96),
      vitality: clamp(16 + greenRatio * 175 + satAvg * 52 + coverage * 190 + softRatio * 8, 4, 96),
      order: clamp(symmetry * 48 + (1 - orientEntropy) * 38 + (1 - hueEntropy) * 14, 6, 96)
    };
    Object.keys(scores).forEach((k) => (scores[k] = Math.round(scores[k])));

    const colorStyle = coolRatio > warmRatio + 0.12
      ? "冷色主导"
      : warmRatio > coolRatio + 0.12
        ? "暖色主导"
        : warmRatio + coolRatio < 0.18
          ? "低饱和中性"
          : "冷暖交织";

    const lineStyle = edgeStrength > 62 && lineRatio >= softRatio
      ? "细密锋利"
      : softRatio > lineRatio
        ? "柔和晕染"
        : "疏朗克制";

    const spaceStyle = coverage < 0.06
      ? "大量留白"
      : coverage < 0.16
        ? "呼吸均衡"
        : "画面充盈";

    const placement = cy > 0.6
      ? "重心下沉"
      : cy < 0.4
        ? "重心上浮"
        : "重心居中";

    // HTP 风格的派生特征，用于给 AI 与本地叙事提供可解释锚点
    // 线条方向：orientBins 中 bin 0≈水平，bin 6≈垂直
    let horiz = 0, vert = 0;
    for (let b = 0; b < 12; b++) {
      const center = (b + 0.5) * Math.PI / 12;
      const horizV = Math.abs(Math.cos(center));   // 越接近水平，cos 越大
      const vertV = Math.abs(Math.sin(center));    // 越接近垂直，sin 越大
      horiz += orientBins[b] * horizV;
      vert += orientBins[b] * vertV;
    }
    const lineDirection = horiz > vert * 1.25
      ? "水平为主"
      : vert > horiz * 1.25
        ? "垂直为主"
        : "方向多变";

    // 笔触力度（用边缘强度 + 覆盖度近似"用力"程度）
    const pressure = edgeStrength > 55
      ? "笔触浓重"
      : edgeStrength < 28
        ? "笔触轻淡"
        : "笔触适中";

    // 反复涂抹：边缘强但色彩数量少 / 或同色重复
    const repeated = edgeStrength > 45 && hueEntropy < 0.55 && stats.soft > 3;

    // 位置倾向（结合重心与九宫格权重）
    const horizBias = leftWeight > rightWeight + 0.06
      ? "偏左"
      : rightWeight > leftWeight + 0.06
        ? "偏右"
        : "横向居中";
    const vertBias = topWeight > bottomWeight + 0.06
      ? "偏上"
      : bottomWeight > topWeight + 0.06
        ? "偏下"
        : "纵向居中";

    return {
      scores,
      metrics: {
        coverage: round(coverage),
        edgeDensity: round(edgeDensity),
        edgeStrength: round(edgeStrength),
        orientationEntropy: round(orientEntropy),
        hueEntropy: round(hueEntropy),
        symmetry: round(symmetry),
        centroid: { x: round(cx), y: round(cy) },
        topWeight: round(topWeight),
        bottomWeight: round(bottomWeight),
        leftWeight: round(leftWeight),
        rightWeight: round(rightWeight),
        warmRatio: round(warmRatio),
        coolRatio: round(coolRatio),
        greenRatio: round(greenRatio),
        neutralRatio: round(neutralRatio),
        satAvg: round(satAvg),
        lightAvg: round(lightAvg),
        grid: grid.map((n, i) => round(n / Math.max(1, gridTotal[i])))
      },
      dominantColors: dominant,
      colorStyle,
      lineStyle,
      spaceStyle,
      placement,
      // HTP 派生特征
      htp: {
        lineDirection,
        pressure,
        repeated,
        horizBias,
        vertBias,
        sizeBias: coverage > 0.32 ? "画面偏大" : coverage < 0.07 ? "画面偏小" : "大小适中"
      },
      strokeStats: stats,
      process,
      behavior,
      hasDrawing: inkCount > total * 0.002,
      imageDataURL: src.toDataURL("image/jpeg", 0.85)
    };
  }

  window.XHFYAnalyze = analyze;
})();
