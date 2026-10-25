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

  /**
   * FEATS 形式元素评分（Formal Elements Art Therapy Scale，Gantt & Tabone）。
   * 原则：只评「可观察的形式元素」，0–5 分并附可复核证据；
   * 与具象内容绑定的维度（人物、写实性、问题解决、发展水平、色彩贴合度、逻辑性）
   * 对抽象涂画不适用，一律标「不适用」，不给分、不推测。
   */
  function buildFeats(x) {
    const g = (v, lo, hi) => Math.max(lo === undefined ? 0 : lo, Math.min(hi === undefined ? 5 : hi, Math.round(v)));
    const pct = (v) => Math.round((v || 0) * 100) + "%";
    const list = [];
    const push = (dim, score, evidence) => list.push({ dim, score, evidence });
    const NA = (dim, why) => list.push({ dim, score: null, evidence: "不适用：" + why });

    push("色彩显著度", g((x.tint * 0.5 + x.sat * 0.3 + x.coverage * 0.9) * 5),
      "彩色笔迹 " + pct(x.tint) + "、平均饱和度 " + x.sat.toFixed(2) + "、覆盖 " + pct(x.coverage));

    push("隐含能量", g((x.speed * 0.35 + x.strength * 0.30 + Math.min(x.strokes / 25, 1) * 0.20 + x.coverage * 0.6) * 5),
      "笔速 " + (x.speed).toFixed(2) + "、笔压强度 " + Math.round(x.rawStrength) + "、" + x.strokes + " 笔");

    push("空间使用", g((x.bbox * 0.7 + x.coverage * 0.8) * 5),
      "包围盒占画面 " + pct(x.bbox) + "、笔迹覆盖 " + pct(x.coverage));

    push("整合度", g((x.fillDensity * 0.75 + (x.strokes >= 3 ? 0.15 : 0.05) - (x.strokes > 40 ? 0.15 : 0)) * 5),
      "包围盒内填充密度 " + x.fillDensity.toFixed(2) + "、" + x.strokes + " 笔");

    push("细节丰富度", g((Math.min(x.density / 0.12, 1) * 0.5 + Math.min(x.strokes / 30, 1) * 0.3 + Math.min(x.colors / 5, 1) * 0.2) * 5),
      "边缘密度 " + x.density.toFixed(3) + "、" + x.strokes + " 笔、" + x.colors + " 种颜色");

    push("线条质量", g((0.45 + x.orientEntropy * 0.35 + (x.lineRatio > 0.4 ? 0.15 : 0)) * 5),
      "方向熵 " + x.orientEntropy.toFixed(2) + "、直线笔触占比 " + pct(x.lineRatio));

    push("旋转之缺失", g(5 - (x.rotDev / 45) * 4, 1, 5),
      "主笔触方向 " + Math.round(x.peakAngle) + "°（偏离水平/垂直 " + Math.round(x.rotDev) + "°）");

    push("重复之缺失", x.repeated ? 2 : (x.soft > 6 && x.hueEntropy < 0.5 ? 3 : 5),
      x.repeated ? "同色反复覆盖、边缘锐利" : "色相熵 " + x.hueEntropy.toFixed(2) + "、柔边笔触 " + x.soft + " 笔");

    NA("色彩贴合度", "画面无具象对象，无法判断颜色是否符合实物");
    NA("逻辑性", "抽象涂画无情节可判断");
    NA("写实性", "抽象涂画无写实对照");
    NA("问题解决", "本测验未设定需要克服的具体目标");
    NA("发展水平", "需与同龄常模比对，本地无法判断");
    NA("人物", "画面中未设定人物任务");

    return list;
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
    let darkInk = 0;
    let sumX = 0;
    let sumY = 0;
    let minX = AW, minY = AH, maxX = -1, maxY = -1;
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

        if (dist > 20) {
          mask[y * AW + x] = 1;
          inkCount++;
          if (L < 100) darkInk++;
          sumX += x;
          sumY += y;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
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

          if (s < 0.16) neutral++;
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

    // 上下镜像对称（Arnheim 视觉平衡、Jung 完形的双轴对称线索）
    let interV = 0, unionV = 0;
    for (let y = 0; y < AH; y++) {
      for (let x = 0; x < AW; x++) {
        const a = mask[y * AW + x];
        const b = mask[(AH - 1 - y) * AW + x];
        if (a || b) unionV++;
        if (a && b) interV++;
      }
    }
    const symmetryV = unionV ? interV / unionV : 0;

    // 中心聚集度（Jung 曼陀罗中心性）：笔迹到几何中心的平均距离归一化
    // 0=全部贴边，1=全部在中心；值越高表示越向中心收拢
    let distSum = 0;
    for (let y = 0; y < AH; y++) {
      for (let x = 0; x < AW; x++) {
        if (mask[y * AW + x]) {
          const dx = (x / AW - 0.5) * 2;   // -1..1
          const dy = (y / AH - 0.5) * 2;
          distSum += Math.sqrt(dx * dx + dy * dy);
        }
      }
    }
    const centerConvergence = inkCount
      ? clamp(1 - (distSum / inkCount) / Math.SQRT2, 0, 1)
      : 0;

    // 四象限平衡（Jung 曼陀罗四象限均衡）：四个象限笔墨占比的均匀度
    // 用 1 - 标准差/均值 的形式，0=极度失衡，1=完全均衡
    const qWeights = [0, 0, 0, 0]; // 左上、右上、左下、右下
    for (let y = 0; y < AH; y++) {
      for (let x = 0; x < AW; x++) {
        if (mask[y * AW + x]) {
          const qi = (y < AH / 2 ? 0 : 2) + (x < AW / 2 ? 0 : 1);
          qWeights[qi]++;
        }
      }
    }
    const qTotal = qWeights.reduce((a, b) => a + b, 0) || 1;
    const qRatios = qWeights.map((v) => v / qTotal);
    const qMean = 0.25;
    const qVar = qRatios.reduce((a, r) => a + (r - qMean) * (r - qMean), 0) / 4;
    const quadrantBalance = clamp(1 - Math.sqrt(qVar) / qMean, 0, 1);

    // 视觉平衡度（Arnheim）：重心偏离几何中心的程度 + 双轴对称
    // 重心越接近中心、双轴对称越高 → 视觉越平衡
    const cx0 = inkCount ? sumX / inkCount / AW : 0.5;
    const cy0 = inkCount ? sumY / inkCount / AH : 0.5;
    const centroidOffset = Math.sqrt((cx0 - 0.5) * 2 * (cx0 - 0.5) * 2 + (cy0 - 0.5) * 2 * (cy0 - 0.5) * 2);
    const visualBalance = clamp(
      (1 - centroidOffset / Math.SQRT2) * 0.55 + (symmetry + symmetryV) / 2 * 0.45,
      0, 1
    );

    // 闭合结构检测（Jung 完形）：用简单的包围检测——
    // 若笔迹在水平/垂直方向上形成「中间被围」的区域，则认为有闭合结构。
    // 简化版：统计 mask 中「上下左右都有笔迹」的背景像素比例，作为闭合度线索。
    let enclosed = 0;
    for (let y = 1; y < AH - 1; y++) {
      for (let x = 1; x < AW - 1; x++) {
        if (!mask[y * AW + x]) {
          let left = false, right = false, up = false, down = false;
          for (let k = 1; k < 12; k++) {
            if (x - k < 0) break;
            if (mask[y * AW + (x - k)]) { left = true; break; }
          }
          if (left) {
            for (let k = 1; k < 12; k++) {
              if (x + k >= AW) break;
              if (mask[y * AW + (x + k)]) { right = true; break; }
            }
          }
          if (right) {
            for (let k = 1; k < 12; k++) {
              if (y - k < 0) break;
              if (mask[(y - k) * AW + x]) { up = true; break; }
            }
          }
          if (up) {
            for (let k = 1; k < 12; k++) {
              if (y + k >= AH) break;
              if (mask[(y + k) * AW + x]) { down = true; break; }
            }
          }
          if (left && right && up && down) enclosed++;
        }
      }
    }
    const enclosedRatio = enclosed / Math.max(1, total - inkCount);
    const hasClosure = enclosedRatio > 0.008;

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
    // 关键：所有输入先归一化到 0..1，再按权重加权，避免某项量纲失控直接饱和。
    // （edgeStrength 是 Sobel 梯度幅值均值，实测范围约 200~900，不能直接线性入公式）
    const strengthN = clamp((edgeStrength - 150) / 700, 0, 1);
    const densityN = clamp(edgeDensity / 0.12, 0, 1);
    const heavyN = clamp(coverage / 0.45, 0, 1);
    const speedN = clamp((stats.strokeSpeed || 0) / 1.2, 0, 1);
    const rigidN = orientTotal > 0 ? clamp(1 - orientEntropy, 0, 1) : 0;
    const darkRatio = inkCount ? darkInk / inkCount : 0;
    const tintRatio = inkCount ? 1 - neutralRatio : 0;
    const repeatedInk = stats.soft > 3 && hueEntropy < 0.55;

    // 画面大小：以笔迹包围盒占画面的比例衡量（《中学生绘画心理应用手册》阈值：>2/3 过大，<1/9 过小）
    const bboxW = maxX >= 0 ? (maxX - minX + 1) : 0;
    const bboxH = maxY >= 0 ? (maxY - minY + 1) : 0;
    const bboxRatio = inkCount ? (bboxW * bboxH) / (AW * AH) : 0;

    const scores = {
      warmth: clamp(30 + (warmRatio - coolRatio) * 52 + satAvg * 30 - neutralRatio * 6, 6, 96),
      tension: clamp(
        12 +
        strengthN * 12 +        // 边缘锐利：笔触的“刺”
        densityN * 20 +         // 细节密度：信息压迫感
        heavyN * 20 +           // 画面满溢：透不过气
        speedN * 12 +           // 落笔急促
        rigidN * 8 +            // 方向单一：僵硬、不流动
        darkRatio * 6 +         // 墨色沉重
        (repeatedInk ? 6 : 0) + // 反复涂抹
        ((process.changes >= 3) ? 4 : 0), // 反复修正的纠结
        6, 94
      ),
      space: clamp(96 - coverage * 125, 10, 96),
      grounded: clamp(42 + (bottomWeight - 0.33) * 105 + (0.5 - Math.abs(cx - 0.5)) * 42 + symmetry * 18, 6, 96),
      vitality: clamp(12 + tintRatio * 30 + satAvg * 40 + greenRatio * 60 + softRatio * 10 + Math.min(coverage, 0.5) * 40, 4, 96),
      order: clamp(symmetry * 48 + (orientTotal > 0 ? (1 - orientEntropy) * 38 : 0) + (hueTotal > 0 ? (1 - hueEntropy) * 14 : 0), 6, 96),
      // 自我力量（Koch 树木 / Machover 画人：画面大小 + 笔触力度 + 线条质量）
      egoStrength: clamp(
        18 +
        Math.min(bboxRatio / 0.6, 1) * 28 +   // 画面占比：愿意占据空间
        strengthN * 22 +                       // 笔触力度：能量投入
        (orientTotal > 0 ? orientEntropy * 12 : 0) +  // 方向变化：灵活度
        (lineRatio > 0.3 ? 8 : 0) +            // 直线占比：果断
        (hasClosure ? 8 : 0),                  // 闭合结构：自我边界
        6, 96
      ),
      // 完形程度（Jung 曼陀罗：中心聚集 + 四象限平衡 + 对称 + 闭合）
      completeness: clamp(
        10 +
        centerConvergence * 28 +
        quadrantBalance * 24 +
        (symmetry + symmetryV) / 2 * 20 +
        (hasClosure ? 14 : 0) +
        Math.min(coverage / 0.15, 1) * 8,
        4, 96
      ),
      // 视觉平衡（Arnheim：重心偏移 + 双轴对称 + 四象限均衡）
      visualBalance: clamp(
        visualBalance * 50 +
        quadrantBalance * 28 +
        (symmetry + symmetryV) / 2 * 14 +
        (0.5 - Math.abs(cx - 0.5)) * 8,
        6, 96
      )
    };
    Object.keys(scores).forEach((k) => (scores[k] = Math.round(scores[k])));

    const colorStyle = coolRatio > warmRatio + 0.12
      ? "冷色主导"
      : warmRatio > coolRatio + 0.12
        ? "暖色主导"
        : warmRatio + coolRatio < 0.18
          ? "低饱和中性"
          : "冷暖交织";

    const lineStyle = strengthN > 0.55 && lineRatio >= softRatio
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
    // 注意：方向直方图统计的是「亮度梯度方向」，它与实际笔触方向相差 90°。
    // 因此用倍角圆均值求梯度主方向，再 +90° 换算成笔触方向，避免水平/垂直互相错位。
    let sx = 0, sy = 0;
    for (let b = 0; b < 12; b++) {
      const th = (b + 0.5) * Math.PI / 12;
      sx += orientBins[b] * Math.cos(2 * th);
      sy += orientBins[b] * Math.sin(2 * th);
    }
    let gradAng = Math.atan2(sy, sx) / 2 * 180 / Math.PI;   // -90..90
    if (gradAng < 0) gradAng += 180;                        // 0..180
    const strokeAng = (gradAng + 90) % 180;                 // 笔触主方向
    const dirConc = orientTotal > 0 ? Math.hypot(sx, sy) / orientTotal : 0;  // 方向集中度 0..1
    const angDist = (a, b2) => { const d = Math.abs(a - b2) % 180; return Math.min(d, 180 - d); };
    const lineDirection = orientTotal === 0 || dirConc < 0.30
      ? "方向多变"
      : angDist(strokeAng, 0) <= 15
        ? "水平为主"
        : angDist(strokeAng, 90) <= 15
          ? "垂直为主"
          : "斜向为主";

    // 笔触力度（用归一化边缘锐利度近似"用力"程度）
    const pressure = strengthN > 0.62
      ? "笔触浓重"
      : strengthN < 0.18
        ? "笔触轻淡"
        : "笔触适中";

    // 反复涂抹：边缘锐利但色彩数量少 / 或同色反复覆盖
    const repeated = strengthN > 0.35 && hueEntropy < 0.55 && stats.soft > 3;

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

    // 画面切断：笔迹是否顶到画纸四边
    const cutoff = [];
    if (minX <= 1) cutoff.push("左");
    if (maxX >= AW - 2) cutoff.push("右");
    if (minY <= 1) cutoff.push("上");
    if (maxY >= AH - 2) cutoff.push("下");

    // 旋转：主笔触方向偏离水平/垂直的角度
    const rem = strokeAng % 90;
    const rotDev = Math.min(rem, 90 - rem);
    const fillDensity = bboxRatio > 0 ? Math.min(1, coverage / bboxRatio) : 0;

    const feats = buildFeats({
      tint: inkCount ? 1 - neutralRatio : 0,
      sat: satAvg,
      coverage,
      bbox: bboxRatio,
      speed: stats.strokeSpeed || 0,
      strength: strengthN,
      rawStrength: edgeStrength,
      strokes: stats.strokes || 0,
      colors: stats.distinctColors || 0,
      density: edgeDensity,
      fillDensity,
      orientEntropy: orientTotal > 0 ? orientEntropy : 0,
      lineRatio,
      soft: stats.soft || 0,
      hueEntropy,
      repeated: repeatedInk,
      peakAngle: strokeAng,
      rotDev
    });

    return {
      scores,
      metrics: {
        coverage: round(coverage),
        bboxRatio: round(bboxRatio),
        edgeDensity: round(edgeDensity),
        edgeStrength: round(edgeStrength),
        orientationEntropy: round(orientEntropy),
        hueEntropy: round(hueEntropy),
        symmetry: round(symmetry),
        symmetryV: round(symmetryV),
        centerConvergence: round(centerConvergence),
        quadrantBalance: round(quadrantBalance),
        visualBalance: round(visualBalance),
        enclosedRatio: round(enclosedRatio),
        hasClosure,
        qRatios: qRatios.map(round),
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
        sizeBias: bboxRatio > 2 / 3 ? "画面过大" : bboxRatio < 1 / 9 ? "画面偏小" : "大小适中",
        cutoff: cutoff.length ? cutoff.join("、") + "侧切断" : "未切断"
      },
      // Jung 曼陀罗派生特征（中心性 / 四象限 / 完形）
      jung: {
        centerConvergence: round(centerConvergence),
        centerPattern: centerConvergence > 0.55 ? "向中心聚集" : centerConvergence < 0.3 ? "偏离中心" : "分布弥散",
        quadrantBalance: round(quadrantBalance),
        quadrantPattern: quadrantBalance > 0.7 ? "四象限均衡" : "四象限失衡",
        quadrants: qRatios.map((r, i) => ["左上", "右上", "左下", "右下"][i] + " " + Math.round(r * 100) + "%"),
        closure: hasClosure ? "有闭合结构" : "结构开放",
        symmetry: "左右 " + Math.round(symmetry * 100) + "% / 上下 " + Math.round(symmetryV * 100) + "%"
      },
      // Arnheim 视觉动力派生特征（重心 / 平衡 / 运动）
      arnheim: {
        visualBalance: round(visualBalance),
        balancePattern: visualBalance > 0.6 ? "视觉平衡" : "视觉张力偏侧",
        centroidBias: (Math.abs(cy - 0.5) > 0.1 ? (cy < 0.5 ? "重心偏上" : "重心偏下") : "重心居中") +
          " / " + (Math.abs(cx - 0.5) > 0.1 ? (cx < 0.5 ? "偏左" : "偏右") : "横向居中"),
        movement: lineDirection === "斜向为主" ? "斜线暗示运动趋势" :
          lineDirection === "方向多变" ? "多方向能量交织" : "方向稳定",
        edgeWeight: cutoff.length > 0 ? "边缘有重量（" + cutoff.join("、") + "侧）" : "边缘无明显重量"
      },
      // FEATS 形式元素评分（0–5，含「不适用」项）
      feats,
      strokeStats: stats,
      process,
      behavior,
      hasDrawing: inkCount > total * 0.002,
      imageDataURL: src.toDataURL("image/jpeg", 0.85)
    };
  }

  window.XHFYAnalyze = analyze;
})();
