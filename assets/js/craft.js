/* =========================================================
   心绘非遗 · 非遗纹样转译引擎
   把用户笔触实时转译成：剪纸 / 扎染 / 蓝印花布 / 竹编
   全部为 Canvas 程序化生成，可导出 2048px 打印图样
   ========================================================= */
(function () {
  "use strict";

  const PAPER = "#F4EBDD";
  const INK_PAPER = { r: 251, g: 247, b: 236 };

  const META = {
    papercut: {
      name: "非遗剪纸 · 红纸镂空",
      badge: "非遗剪纸",
      short: "剪纸",
      desc: "以你的笔触为刀路，保留轮廓与呼吸感，再用锯齿纹、云纹与角花收边，让心象成为一张可以真正剪下来的红纸。",
      grammar: "轮廓 · 镂空 · 对称 · 锯齿纹",
      use: "剪纸 / 窗花 / 帆布袋印花",
      note: "小提示：红色越深，剪影越完整；细碎的笔触会被收拢成连续的刀路。",
      palette: ["#A63A2B", "#C46753", "#F4EBDD"]
    },
    tiedye: {
      name: "非遗扎染 · 靛蓝晕染",
      badge: "非遗扎染",
      short: "扎染",
      desc: "把你的画面放进一口靛蓝染缸。笔触成为被扎结的「resist」，在冰裂纹与晕圈之间，留下不可复制的蓝。",
      grammar: "扎结 · 晕染 · 冰裂纹 · 同心圆",
      use: "扎染方巾 / 帆布袋 / 棉麻挂布",
      note: "小提示：扎染没有两块完全相同的布。你画得越松弛，晕开的层次越好看。",
      palette: ["#16293D", "#2B4A6B", "#7FA1B8"]
    },
    calico: {
      name: "非遗蓝印花布 · 白花靛底",
      badge: "蓝印花布",
      short: "蓝印花布",
      desc: "以靛蓝为底、石灰防染为白，把你的心象变成一块白花蓝布。细密的冰裂纹，是手工防染留下的呼吸。",
      grammar: "靛底 · 白花 · 防染 · 冰裂纹",
      use: "蓝印花布 / 桌旗 / 手作包",
      note: "小提示：白色纹样越完整，越接近传统刻版防染的效果。",
      palette: ["#26425F", "#41647F", "#F4EFE1"]
    },
    bamboo: {
      name: "非遗竹编 · 经纬交织",
      badge: "非遗竹编",
      short: "竹编",
      desc: "把你的线条拆成竹篾，横向为纬、纵向为经，一压一挑地重新编织。心绪在重复的经纬里，慢慢有了秩序。",
      grammar: "经纬 · 一压一挑 · 竹篾 · 收边",
      use: "竹编画 / 杯垫 / 灯罩底稿",
      note: "小提示：深色笔触会成为竹编里的阴面，浅色则像被光穿透的竹篾。",
      palette: ["#C9A96A", "#8C6E3F", "#4A3B26"]
    },
    shadow: {
      name: "非遗皮影 · 镂雕皮影",
      badge: "非遗皮影",
      short: "皮影",
      desc: "把你的线条镂刻成一张皮影。关节处留一道细线，让剪影有了可以活动的生命，在暖光里投出灵动的影子。",
      grammar: "剪影 · 关节线 · 镂雕 · 暖光透影",
      use: "皮影戏底稿 / 装饰画 / 灯箱片",
      note: "小提示：皮影靠光活着。画里的每一道开口，都是光透过来的地方。",
      palette: ["#8B3A2A", "#C97B4A", "#E8C88A"]
    },
    embroidery: {
      name: "非遗刺绣 · 丝理针脚",
      badge: "非遗刺绣",
      short: "刺绣",
      desc: "把你的笔触化成丝线。一针一线地走，缎面铺满、打籽点缀，让心象在绸缎上有了丝绒的温度与光泽。",
      grammar: "缎绣 · 打籽 · 套针 · 丝理",
      use: "刺绣画稿 / 团扇 / 服饰纹样",
      note: "小提示：刺绣最讲究「丝理」——线条的方向就是丝线的走向，顺着它绣才会发亮。",
      palette: ["#B23A48", "#E0A8B0", "#6B8FA8"]
    }
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const s = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a += 0x6d2b79f5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function smoothstep(a, b, x) {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function buildScene(studio, W) {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = W;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#FBF7EC";
    ctx.fillRect(0, 0, W, W);
    // 先在缩略图上找墨迹包围盒，让纹样自动撑满画面
    const src = studio.canvas;
    const tw = 480;
    const th = 320;
    const tmp = document.createElement("canvas");
    tmp.width = tw;
    tmp.height = th;
    const tctx = tmp.getContext("2d", { willReadFrequently: true });
    tctx.drawImage(src, 0, 0, tw, th);
    const td = tctx.getImageData(0, 0, tw, th).data;
    let minX = tw, minY = th, maxX = -1, maxY = -1;
    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const i = (y * tw + x) * 4;
        const d = Math.max(
          Math.abs(td[i] - INK_PAPER.r),
          Math.abs(td[i + 1] - INK_PAPER.g),
          Math.abs(td[i + 2] - INK_PAPER.b)
        );
        if (d > 14) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (maxX < 0) {
      const innerW = W * 0.84;
      const innerH = (innerW / src.width) * src.height;
      ctx.drawImage(src, 0, 0, src.width, src.height, (W - innerW) / 2, (W - innerH) / 2, innerW, innerH);
      return c;
    }

    const sx = src.width / tw;
    const sy = src.height / th;
    let bx = minX * sx;
    let by = minY * sy;
    let bw = (maxX - minX + 1) * sx;
    let bh = (maxY - minY + 1) * sy;
    const mx = bw * 0.055;
    const my = bh * 0.055;
    bx -= mx; by -= my; bw += mx * 2; bh += my * 2;
    bx = clamp(bx, 0, src.width);
    by = clamp(by, 0, src.height);
    bw = clamp(bw, 1, src.width - bx);
    bh = clamp(bh, 1, src.height - by);

    const target = W * 0.8;
    const k = Math.min(target / bw, target / bh, 3.2);
    const dw = bw * k;
    const dh = bh * k;
    ctx.drawImage(src, bx, by, bw, bh, (W - dw) / 2, (W - dh) / 2, dw, dh);
    return c;
  }

  function buildMask(scene, W) {
    const ctx = scene.getContext("2d", { willReadFrequently: true });
    const data = ctx.getImageData(0, 0, W, W).data;
    const mask = new Float32Array(W * W);
    const edge = new Float32Array(W * W);
    let sumX = 0;
    let sumY = 0;
    let n = 0;
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const d = Math.max(
          Math.abs(data[i] - INK_PAPER.r),
          Math.abs(data[i + 1] - INK_PAPER.g),
          Math.abs(data[i + 2] - INK_PAPER.b)
        );
        const raw = smoothstep(8, 26, d);
        // 收紧过渡带：保留约 1px 抗锯齿，去掉灰雾，让刀口利落
        const a = raw < 0.34 ? 0 : raw > 0.62 ? 1 : (raw - 0.34) / 0.28;
        mask[y * W + x] = a;
        if (a > 0.5) {
          sumX += x;
          sumY += y;
          n++;
        }
      }
    }
    // 轮廓（用于刀路 / 防染边线）
    for (let y = 1; y < W - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (mask[i] < 0.5) continue;
        const minN = Math.min(mask[i - 1], mask[i + 1], mask[i - W], mask[i + W]);
        if (minN < 0.5) edge[i] = 1;
      }
    }
    // 形态学腐蚀：只保留「厚」的部分，细线不会被刀口切断
    let core = mask;
    for (let pass = 0; pass < 3; pass++) {
      const tmp = new Float32Array(W * W);
      for (let y = 1; y < W - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const i = y * W + x;
          tmp[i] = Math.min(core[i], core[i - 1], core[i + 1], core[i - W], core[i + W]);
        }
      }
      core = tmp;
    }
    return {
      mask,
      core,
      edge,
      coverage: n / (W * W),
      centroid: { x: n ? sumX / n : W / 2, y: n ? sumY / n : W / 2 }
    };
  }

  function colorize(mask, W, color, alphaScale) {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = W;
    const ctx = c.getContext("2d");
    const id = ctx.createImageData(W, W);
    const [r, g, b] = hexToRgb(color);
    const k = alphaScale === undefined ? 1 : alphaScale;
    for (let i = 0; i < W * W; i++) {
      const a = mask[i] * k;
      const p = i * 4;
      id.data[p] = r;
      id.data[p + 1] = g;
      id.data[p + 2] = b;
      id.data[p + 3] = Math.round(clamp(a, 0, 1) * 255);
    }
    ctx.putImageData(id, 0, 0);
    return c;
  }

  function edgeCanvas(edge, W, color, alpha) {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = W;
    const ctx = c.getContext("2d");
    const id = ctx.createImageData(W, W);
    const [r, g, b] = hexToRgb(color);
    for (let i = 0; i < W * W; i++) {
      const p = i * 4;
      id.data[p] = r;
      id.data[p + 1] = g;
      id.data[p + 2] = b;
      id.data[p + 3] = Math.round(clamp(edge[i], 0, 1) * 255 * alpha);
    }
    ctx.putImageData(id, 0, 0);
    return c;
  }

  function maskCanvas(arr, W) {
    return colorize(arr, W, "#FFFFFF", 1);
  }

  function paperBase(ctx, W, base, rng) {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, W);

    // 大块纸浆云斑
    for (let i = 0; i < 7; i++) {
      const x = rng() * W;
      const y = rng() * W;
      const r = W * (0.08 + rng() * 0.2);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const dark = rng() > 0.5;
      g.addColorStop(0, dark ? "rgba(120,98,70,0.045)" : "rgba(255,255,255,0.34)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, W);
    }

    // 纸纤维
    ctx.save();
    for (let i = 0; i < Math.round(W * 2.2); i++) {
      const x = rng() * W;
      const y = rng() * W;
      const len = W * (0.004 + rng() * 0.012);
      const ang = rng() * Math.PI;
      ctx.strokeStyle = rng() > 0.45 ? "rgba(120,98,70,0.075)" : "rgba(255,255,255,0.42)";
      ctx.lineWidth = Math.max(0.5, W / 1400);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
    ctx.restore();
  }

  function flower(ctx, x, y, r, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.fillStyle = color;
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.43, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y, r * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function punchDotFlowers(ctx, mask, W, color, cellSize, probability, rng) {
    const cell = Math.max(9, Math.round(cellSize));
    for (let y = cell / 2; y < W; y += cell) {
      for (let x = cell / 2; x < W; x += cell) {
        if (mask[Math.floor(y) * W + Math.floor(x)] < 0.86) continue;
        if (rng() > probability) continue;
        // 手剪的花孔不会排成格子：位置与大小都带抖动
        const jx = x + (rng() - 0.5) * cell * 0.62;
        const jy = y + (rng() - 0.5) * cell * 0.62;
        const r = cell * (0.15 + rng() * 0.1);
        flower(ctx, jx, jy, r, color, 0.6 + rng() * 0.28);
      }
    }
  }

  function leafCut(ctx, x, y, len, wid, ang, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-len / 2, 0);
    ctx.quadraticCurveTo(0, -wid, len / 2, 0);
    ctx.quadraticCurveTo(0, wid, -len / 2, 0);
    ctx.fill();
    ctx.restore();
  }

  function sawtooth(ctx, W, inset, step, height, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let x = inset; x < W - inset - step; x += step) {
      ctx.moveTo(x, inset);
      ctx.lineTo(x + step / 2, inset + height);
      ctx.lineTo(x + step, inset);
    }
    ctx.fill();
    ctx.beginPath();
    for (let x = inset; x < W - inset - step; x += step) {
      ctx.moveTo(x, W - inset);
      ctx.lineTo(x + step / 2, W - inset - height);
      ctx.lineTo(x + step, W - inset);
    }
    ctx.fill();
    ctx.beginPath();
    for (let y = inset; y < W - inset - step; y += step) {
      ctx.moveTo(inset, y);
      ctx.lineTo(inset + height, y + step / 2);
      ctx.lineTo(inset, y + step);
    }
    ctx.fill();
    ctx.beginPath();
    for (let y = inset; y < W - inset - step; y += step) {
      ctx.moveTo(W - inset, y);
      ctx.lineTo(W - inset - height, y + step / 2);
      ctx.lineTo(W - inset, y + step);
    }
    ctx.fill();
    ctx.restore();
  }

  function sealStamp(ctx, W, x, y, size, color, textColor) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size * 0.46);
    ctx.fillStyle = textColor;
    ctx.font = "600 " + Math.round(size * 0.27) + "px 'Songti SC','STSong',serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("心绘", x + size / 2, y + size * 0.25);
    ctx.restore();
  }

  /* ---------- 传统纹样原语：回纹 · 云纹 · 团花 · 缠枝纹 · 如意纹 · 月牙纹 ---------- */

  /** 回纹（万字不到头）：沿矩形边框排布的连续折线 */
  function meanderBorder(ctx, x, y, w, h, color, lineW, unit) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineW;
    ctx.lineJoin = "miter";
    const u = unit;
    // 上边
    for (let cx = x; cx < x + w - u; cx += u * 2) {
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(cx, y + u);
      ctx.lineTo(cx + u, y + u);
      ctx.lineTo(cx + u, y);
      ctx.lineTo(cx + u * 2, y);
      ctx.stroke();
    }
    // 下边
    for (let cx = x; cx < x + w - u; cx += u * 2) {
      ctx.beginPath();
      ctx.moveTo(cx, y + h);
      ctx.lineTo(cx, y + h - u);
      ctx.lineTo(cx + u, y + h - u);
      ctx.lineTo(cx + u, y + h);
      ctx.lineTo(cx + u * 2, y + h);
      ctx.stroke();
    }
    // 左边
    for (let cy = y; cy < y + h - u; cy += u * 2) {
      ctx.beginPath();
      ctx.moveTo(x, cy);
      ctx.lineTo(x + u, cy);
      ctx.lineTo(x + u, cy + u);
      ctx.lineTo(x, cy + u);
      ctx.lineTo(x, cy + u * 2);
      ctx.stroke();
    }
    // 右边
    for (let cy = y; cy < y + h - u; cy += u * 2) {
      ctx.beginPath();
      ctx.moveTo(x + w, cy);
      ctx.lineTo(x + w - u, cy);
      ctx.lineTo(x + w - u, cy + u);
      ctx.lineTo(x + w, cy + u);
      ctx.lineTo(x + w, cy + u * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** 云纹：如意云头，单个卷云纹样 */
  function cloudMotif(ctx, x, y, size, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.fillStyle = color;
    const s = size;
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.bezierCurveTo(x - s, y - s * 0.7, x - s * 0.4, y - s * 0.9, x, y - s * 0.5);
    ctx.bezierCurveTo(x + s * 0.4, y - s * 0.9, x + s, y - s * 0.7, x + s, y);
    ctx.bezierCurveTo(x + s * 0.7, y + s * 0.15, x + s * 0.4, y + s * 0.5, x, y + s * 0.35);
    ctx.bezierCurveTo(x - s * 0.4, y + s * 0.5, x - s * 0.7, y + s * 0.15, x - s, y);
    ctx.closePath();
    ctx.fill();
    // 云头内卷
    ctx.beginPath();
    ctx.arc(x - s * 0.35, y - s * 0.1, s * 0.18, 0, Math.PI * 2);
    ctx.arc(x + s * 0.35, y - s * 0.1, s * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** 层叠团花：多层花瓣的放射对称花卉 */
  function medallionFlower(ctx, x, y, r, color, alpha, petals) {
    const p = petals || 8;
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.fillStyle = color;
    // 外层花瓣（尖瓣）
    for (let i = 0; i < p; i++) {
      const a = (i / p) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(a) * r * 0.7;
      const py = y + Math.sin(a) * r * 0.7;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.55);
      ctx.quadraticCurveTo(r * 0.22, -r * 0.15, 0, r * 0.2);
      ctx.quadraticCurveTo(-r * 0.22, -r * 0.15, 0, -r * 0.55);
      ctx.fill();
      ctx.restore();
    }
    // 内层圆瓣
    for (let i = 0; i < p; i++) {
      const a = (i / p) * Math.PI * 2;
      const px = x + Math.cos(a) * r * 0.32;
      const py = y + Math.sin(a) * r * 0.32;
      ctx.beginPath();
      ctx.arc(px, py, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    // 花心
    ctx.beginPath();
    ctx.arc(x, y, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** 缠枝纹：连续卷草藤蔓，沿路径延伸 */
  function vineScroll(ctx, cx, cy, radius, color, alpha, turns) {
    const t = turns || 2;
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, radius * 0.06);
    ctx.lineCap = "round";
    const steps = 120;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const p = i / steps;
      const ang = p * Math.PI * 2 * t;
      const r = radius * (0.3 + p * 0.7);
      const wobble = Math.sin(p * Math.PI * 8) * radius * 0.06;
      const x = cx + Math.cos(ang) * (r + wobble);
      const y = cy + Math.sin(ang) * (r + wobble);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // 藤蔓上的小叶
    ctx.fillStyle = color;
    for (let i = 8; i < steps; i += 14) {
      const p = i / steps;
      const ang = p * Math.PI * 2 * t;
      const r = radius * (0.3 + p * 0.7);
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang + Math.PI / 2);
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 0.05, radius * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /** 如意纹：对称如意头纹样 */
  function ruyiMotif(ctx, x, y, size, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.fillStyle = color;
    const s = size;
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.6);
    ctx.bezierCurveTo(x - s * 0.5, y - s * 0.6, x - s * 0.7, y - s * 0.1, x - s * 0.4, y + s * 0.1);
    ctx.bezierCurveTo(x - s * 0.6, y + s * 0.3, x - s * 0.3, y + s * 0.6, x, y + s * 0.4);
    ctx.bezierCurveTo(x + s * 0.3, y + s * 0.6, x + s * 0.6, y + s * 0.3, x + s * 0.4, y + s * 0.1);
    ctx.bezierCurveTo(x + s * 0.7, y - s * 0.1, x + s * 0.5, y - s * 0.6, x, y - s * 0.6);
    ctx.fill();
    ctx.restore();
  }

  /** 月牙纹镂空：剪纸中常见的半月形刀孔 */
  function crescentCut(ctx, x, y, r, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x + r * 0.35, y, r * 0.78, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ---------------- 剪纸 ---------------- */
  function drawPapercut(ctx, W, maskData, rng) {
    const { mask, core, edge } = maskData;
    paperBase(ctx, W, PAPER, rng);

    // 纸边淡淡暗角
    const vg = ctx.createRadialGradient(W / 2, W / 2, W * 0.32, W / 2, W / 2, W * 0.78);
    vg.addColorStop(0, "rgba(120,96,64,0)");
    vg.addColorStop(1, "rgba(120,96,64,0.10)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, W);

    const red = "#A6382A";
    const redDeep = "#8B291D";
    const silhouette = colorize(mask, W, red, 1);

    // 投影：红纸微微翘起
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.filter = "blur(" + Math.max(2, W * 0.004) + "px)";
    ctx.drawImage(colorize(mask, W, "#6E1E15", 1), W * 0.006, W * 0.008);
    ctx.restore();

    // 红色剪影
    ctx.drawImage(silhouette, 0, 0);

    // 内部装饰层：缠枝纹 + 云纹 + 月牙纹（只落在红色剪影厚实处）
    const deco = document.createElement("canvas");
    deco.width = W;
    deco.height = W;
    const dctx = deco.getContext("2d");

    // 缠枝纹：从画面中心螺旋展开的卷草藤蔓
    const cx = W * 0.5, cy = W * 0.5;
    vineScroll(dctx, cx, cy, W * 0.32, PAPER, 0.88, 2.5);

    // 云纹：四面对称分布在中心区域
    const cloudPositions = [
      [W * 0.32, W * 0.34], [W * 0.68, W * 0.34],
      [W * 0.32, W * 0.66], [W * 0.68, W * 0.66]
    ];
    cloudPositions.forEach(([x, y]) => cloudMotif(dctx, x, y, W * 0.03, PAPER, 0.8));

    // 月牙纹：沿中心环形分布的刀孔
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const rr = W * 0.16;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      crescentCut(dctx, x, y, W * 0.011, PAPER, 0.75);
    }

    // 如意纹：点缀在藤蔓上
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const rr = W * 0.26;
      ruyiMotif(dctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, W * 0.016, PAPER, 0.7);
    }

    // 点状花孔：保留少量细密打点，增加刀工层次
    punchDotFlowers(dctx, mask, W, PAPER, W * 0.03, 0.3, rng);

    // 将装饰层限制在红色剪影厚实处
    dctx.globalCompositeOperation = "destination-in";
    dctx.drawImage(maskCanvas(core, W), 0, 0);
    ctx.drawImage(deco, 0, 0);

    // 刀口：沿轮廓向内刻两圈纸色白线，模拟双线剪法（只落在厚实处）
    const carve = document.createElement("canvas");
    carve.width = W;
    carve.height = W;
    const cctx = carve.getContext("2d");
    const ringLine = edgeCanvas(edge, W, PAPER, 0.9);
    for (const ring of [1, 2]) {
      const k = Math.max(1, W * 0.0018) * ring * 2.2;
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        cctx.drawImage(ringLine, Math.cos(ang) * k, Math.sin(ang) * k);
      }
    }
    cctx.globalCompositeOperation = "destination-in";
    cctx.drawImage(maskCanvas(core, W), 0, 0);
    ctx.drawImage(carve, 0, 0);

    // 边缘压深，模拟厚纸
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(edgeCanvas(edge, W, redDeep, 0.6), 0, 0);
    ctx.restore();

    // 外框：双线 + 回纹 + 锯齿
    const m = W * 0.042;
    ctx.save();
    ctx.strokeStyle = red;
    ctx.lineWidth = Math.max(2, W * 0.0045);
    ctx.strokeRect(m, m, W - m * 2, W - m * 2);
    ctx.lineWidth = Math.max(1, W * 0.0014);
    ctx.globalAlpha = 0.7;
    ctx.strokeRect(m * 1.22, m * 1.22, W - m * 2.44, W - m * 2.44);
    ctx.restore();

    // 回纹内框
    meanderBorder(ctx, m * 1.08, m * 1.08, W - m * 2.16, W - m * 2.16, red, Math.max(1, W * 0.0012), W * 0.012);

    sawtooth(ctx, W, m * 1.16, Math.max(9, W * 0.016), W * 0.008, red);

    // 四角团花（八瓣层叠）
    const cs = [
      [m * 2.2, m * 2.2],
      [W - m * 2.2, m * 2.2],
      [m * 2.2, W - m * 2.2],
      [W - m * 2.2, W - m * 2.2]
    ];
    cs.forEach(([x, y]) => {
      medallionFlower(ctx, x, y, W * 0.028, red, 0.95, 8);
    });

    // 上下中央团花 + 缠枝连接
    for (const cy of [m * 2.6, W - m * 2.6]) {
      medallionFlower(ctx, W / 2, cy, W * 0.026, red, 0.92, 8);
      for (const dx of [-1, 1]) {
        ctx.save();
        ctx.strokeStyle = red;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = Math.max(1, W * 0.0016);
        ctx.beginPath();
        ctx.moveTo(W / 2 + dx * W * 0.032, cy);
        ctx.quadraticCurveTo(W / 2 + dx * W * 0.07, cy - W * 0.01, W / 2 + dx * W * 0.1, cy);
        ctx.stroke();
        ctx.restore();
      }
    }

    sealStamp(ctx, W, W - m * 3.35, W - m * 2.35, W * 0.05, red, PAPER);
  }

  /* ---------------- 扎染 ---------------- */
  function drawTiedye(ctx, W, maskData, rng) {
    const { mask, edge, centroid } = maskData;
    // 靛蓝染缸：由深到浅的七阶色阶
    const stops = [
      [8, 19, 30],
      [15, 33, 48],
      [26, 52, 74],
      [44, 76, 100],
      [78, 110, 132],
      [132, 160, 172],
      [206, 221, 218]
    ];
    const cx = centroid.x;
    const cy = centroid.y;
    const base = document.createElement("canvas");
    base.width = W;
    base.height = W;
    const bctx = base.getContext("2d");
    const id = bctx.createImageData(W, W);
    const d = id.data;

    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const dx = (x - cx) / W;
        const dy = (y - cy) / W;
        const r = Math.sqrt(dx * dx + dy * dy);
        const ang = Math.atan2(dy, dx);
        // 扎结的折痕把同心圆揉皱
        const fold = Math.sin(ang * 6 + Math.sin(ang * 2.3) * 1.2) * 0.6 +
          Math.sin(ang * 13 + 1.1) * 0.22;
        const ring1 = Math.sin(r * 36 + fold * 3.1);
        const ring2 = Math.sin(r * 14.5 - fold * 1.9 + 1.4);
        let v = 0.5 + ring1 * 0.34 + ring2 * 0.16;
        // 提对比：让亮环更亮、靛底更深
        v = clamp((v - 0.5) * 1.28 + 0.48, 0, 0.999);
        const idx = v * (stops.length - 1);
        const i0 = Math.floor(idx);
        const i1 = Math.min(stops.length - 1, i0 + 1);
        const t = idx - i0;
        const p = (y * W + x) * 4;
        d[p] = lerp(stops[i0][0], stops[i1][0], t);
        d[p + 1] = lerp(stops[i0][1], stops[i1][1], t);
        d[p + 2] = lerp(stops[i0][2], stops[i1][2], t);
        d[p + 3] = 255;
      }
    }
    bctx.putImageData(id, 0, 0);
    ctx.drawImage(base, 0, 0);

    // 布面散落的白点：染缸里被扎住的小结
    ctx.save();
    for (let i = 0; i < 150; i++) {
      const x = rng() * W;
      const y = rng() * W;
      if (mask[Math.floor(y) * W + Math.floor(x)] > 0.4) continue;
      const r = W * (0.0015 + rng() * 0.0032);
      ctx.globalAlpha = 0.1 + rng() * 0.22;
      ctx.fillStyle = "#E9F0EA";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // 扎结同心圆：手工扎线留下的环形防染，是扎染最标志性的纹样
    for (let i = 0; i < 8; i++) {
      const tx = W * (0.12 + rng() * 0.76);
      const ty = W * (0.12 + rng() * 0.76);
      const tr = W * (0.02 + rng() * 0.04);
      // 中心扎结白点
      const kg = ctx.createRadialGradient(tx, ty, 0, tx, ty, tr);
      kg.addColorStop(0, "rgba(232,240,236,0.55)");
      kg.addColorStop(0.5, "rgba(232,240,236,0.18)");
      kg.addColorStop(1, "rgba(232,240,236,0)");
      ctx.fillStyle = kg;
      ctx.beginPath();
      ctx.arc(tx, ty, tr, 0, Math.PI * 2);
      ctx.fill();
      // 2-3 圈扎线环
      ctx.strokeStyle = "rgba(232,240,236,0.32)";
      ctx.lineWidth = Math.max(0.8, W * 0.0014);
      for (let ring = 1; ring <= 3; ring++) {
        ctx.globalAlpha = 0.4 - ring * 0.08;
        ctx.beginPath();
        ctx.arc(tx, ty, tr * (0.6 + ring * 0.35), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // 放射折痕
    ctx.save();
    ctx.translate(cx, cy);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rng() * 0.06;
      ctx.rotate(a);
      const grad = ctx.createLinearGradient(0, 0, W * 0.78, 0);
      grad.addColorStop(0, "rgba(230,238,236,0.10)");
      grad.addColorStop(0.42, "rgba(230,238,236,0.02)");
      grad.addColorStop(1, "rgba(6,16,26,0.10)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(W * 0.78, -W * 0.016);
      ctx.lineTo(W * 0.78, W * 0.016);
      ctx.closePath();
      ctx.fill();
      ctx.rotate(-a);
    }
    ctx.restore();

    // 染液在笔触外缘积成深靛，再留下白防染
    ctx.save();
    ctx.filter = "blur(" + Math.max(4, W * 0.014) + "px)";
    ctx.globalAlpha = 0.75;
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(colorize(mask, W, "#17384F", 1), 0, 0);
    ctx.restore();

    // 白防染纹样：边缘微晕，布面留有渗染与折痕
    const motif = document.createElement("canvas");
    motif.width = W;
    motif.height = W;
    const mctx = motif.getContext("2d");
    mctx.filter = "blur(" + Math.max(1, W * 0.0022) + "px)";
    mctx.drawImage(colorize(mask, W, "#E4EBE5", 1), 0, 0);
    mctx.filter = "none";
    mctx.globalCompositeOperation = "source-atop";
    for (let i = 0; i < 26; i++) {
      const x = rng() * W;
      const y = rng() * W;
      const rr = W * (0.02 + rng() * 0.08);
      const g2 = mctx.createRadialGradient(x, y, 0, x, y, rr);
      g2.addColorStop(0, "rgba(96,138,162," + (0.05 + rng() * 0.1).toFixed(3) + ")");
      g2.addColorStop(1, "rgba(96,138,162,0)");
      mctx.fillStyle = g2;
      mctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    for (let i = 0; i < 12; i++) {
      mctx.strokeStyle = "rgba(255,255,255," + (0.08 + rng() * 0.16).toFixed(3) + ")";
      mctx.lineWidth = W * (0.0012 + rng() * 0.0026);
      mctx.beginPath();
      mctx.moveTo(rng() * W, rng() * W);
      mctx.lineTo(rng() * W, rng() * W);
      mctx.stroke();
    }
    // 扎结的放射折痕穿过白纹
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2 + rng() * 0.12;
      mctx.strokeStyle = i % 2
        ? "rgba(255,255,255,0.16)"
        : "rgba(70,110,135,0.12)";
      mctx.lineWidth = W * (0.001 + rng() * 0.0016);
      mctx.beginPath();
      mctx.moveTo(cx + Math.cos(ang) * W * 0.015, cy + Math.sin(ang) * W * 0.015);
      mctx.lineTo(cx + Math.cos(ang) * W * 0.62, cy + Math.sin(ang) * W * 0.62);
      mctx.stroke();
    }
    // 同一块布上的晕圈，也要透过白纹
    mctx.globalAlpha = 0.34;
    mctx.drawImage(base, 0, 0);
    mctx.globalAlpha = 1;
    ctx.drawImage(motif, 0, 0);
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.drawImage(edgeCanvas(edge, W, "#123049", 0.7), 0, 0);
    ctx.restore();

    // 白纹里透出的靛色小点
    ctx.save();
    ctx.globalAlpha = 0.45;
    punchDotFlowers(ctx, mask, W, "#2C4E6B", W * 0.055, 0.2, rng);
    ctx.restore();

    // 冰裂纹：树枝状分叉网络，模拟染液在折痕间渗开的肌理
    ctx.save();
    ctx.strokeStyle = "rgba(240,244,240,0.22)";
    ctx.lineWidth = Math.max(0.6, W / 1400);
    const crackCenters = 14;
    for (let c = 0; c < crackCenters; c++) {
      const sx = W * (0.1 + rng() * 0.8);
      const sy = W * (0.1 + rng() * 0.8);
      // 每个中心发出 2-4 条主裂纹
      const branches = 2 + Math.floor(rng() * 3);
      for (let b = 0; b < branches; b++) {
        let x = sx, y = sy;
        let ang = (b / branches) * Math.PI * 2 + rng() * 0.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        const segs = 8 + Math.floor(rng() * 14);
        for (let s = 0; s < segs; s++) {
          ang += (rng() - 0.5) * 0.7;
          const step = W * (0.006 + rng() * 0.01);
          x += Math.cos(ang) * step;
          y += Math.sin(ang) * step;
          if (x < 0 || x > W || y < 0 || y > W) break;
          ctx.lineTo(x, y);
          // 中途分叉：30% 概率发出支裂纹
          if (rng() < 0.3 && s > 1) {
            const subAng = ang + (rng() > 0.5 ? 1 : -1) * (0.4 + rng() * 0.6);
            let sx2 = x, sy2 = y;
            ctx.moveTo(sx2, sy2);
            for (let ss = 0; ss < 5 + rng() * 6; ss++) {
              sx2 += Math.cos(subAng + (rng() - 0.5) * 0.4) * W * 0.006;
              sy2 += Math.sin(subAng + (rng() - 0.5) * 0.4) * W * 0.006;
              if (sx2 < 0 || sx2 > W || sy2 < 0 || sy2 > W) break;
              ctx.lineTo(sx2, sy2);
            }
            ctx.moveTo(x, y);
          }
        }
        ctx.stroke();
      }
    }
    ctx.restore();

    // 布纹
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 0.6;
    for (let x = 0; x < W; x += Math.max(2, W / 340)) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, W);
      ctx.stroke();
    }
    for (let y = 0; y < W; y += Math.max(2, W / 340)) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.restore();

    // 四边晕染加深
    const vg = ctx.createRadialGradient(W / 2, W / 2, W * 0.3, W / 2, W / 2, W * 0.78);
    vg.addColorStop(0, "rgba(8,20,32,0)");
    vg.addColorStop(1, "rgba(8,20,32,0.3)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, W);

    sealStamp(ctx, W, W * 0.885, W * 0.885, W * 0.05, "rgba(18,38,57,0.86)", "#EAF0EC");
  }

  /* ---------------- 蓝印花布 ---------------- */
  function drawCalico(ctx, W, maskData, rng) {
    const { mask, edge } = maskData;
    const indigo = "#27435F";
    const indigoDeep = "#1D3349";
    const white = "#F3EEDF";

    // 靛底 + 布纹
    ctx.fillStyle = indigo;
    ctx.fillRect(0, 0, W, W);
    ctx.save();
    const id = ctx.getImageData(0, 0, W, W);
    for (let i = 0; i < W * W; i++) {
      const v = (Math.sin(i * 0.37) + Math.sin(i * 0.011)) * 3;
      id.data[i * 4] = clamp(id.data[i * 4] + v, 0, 255);
      id.data[i * 4 + 1] = clamp(id.data[i * 4 + 1] + v, 0, 255);
      id.data[i * 4 + 2] = clamp(id.data[i * 4 + 2] + v, 0, 255);
    }
    ctx.putImageData(id, 0, 0);
    ctx.globalAlpha = 0.055;
    ctx.strokeStyle = "#FFFFFF";
    for (let x = 0; x < W; x += Math.max(2, W / 360)) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, W); ctx.stroke();
    }
    for (let y = 0; y < W; y += Math.max(2, W / 360)) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();

    // 白色主体纹样
    const whiteLayer = colorize(mask, W, white, 1);
    ctx.save();
    ctx.shadowColor = "rgba(8,18,28,0.28)";
    ctx.shadowBlur = W * 0.005;
    ctx.shadowOffsetY = W * 0.002;
    ctx.drawImage(whiteLayer, 0, 0);
    ctx.restore();

    // 防染边线（靛色细边，略厚一点，像刻版留下的界线）
    const rim = edgeCanvas(edge, W, indigoDeep, 0.55);
    const rs = Math.max(1, W * 0.0016);
    ctx.drawImage(rim, 0, 0);
    ctx.drawImage(rim, rs, 0);
    ctx.drawImage(rim, -rs, 0);
    ctx.drawImage(rim, 0, rs);
    ctx.drawImage(rim, 0, -rs);

    // 传统点状花孔：让白色纹样透气
    punchDotFlowers(ctx, mask, W, indigo, W * 0.03, 0.4, rng);

    // 缠枝纹 + 云纹：在白色纹样内部叠加靛色卷草，增加刻版层次
    const calicoDeco = document.createElement("canvas");
    calicoDeco.width = W;
    calicoDeco.height = W;
    const cdctx = calicoDeco.getContext("2d");
    vineScroll(cdctx, W * 0.5, W * 0.5, W * 0.3, indigo, 0.7, 2);
    cloudMotif(cdctx, W * 0.35, W * 0.35, W * 0.025, indigo, 0.6);
    cloudMotif(cdctx, W * 0.65, W * 0.35, W * 0.025, indigo, 0.6);
    cloudMotif(cdctx, W * 0.35, W * 0.65, W * 0.025, indigo, 0.6);
    cloudMotif(cdctx, W * 0.65, W * 0.65, W * 0.025, indigo, 0.6);
    cdctx.globalCompositeOperation = "destination-in";
    cdctx.drawImage(maskCanvas(mask, W), 0, 0);
    ctx.drawImage(calicoDeco, 0, 0);

    // 冰裂纹（靛色断续细线，模拟防染石灰龟裂）
    ctx.save();
    ctx.strokeStyle = indigo;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = Math.max(0.6, W / 1500);
    for (let i = 0; i < 28; i++) {
      let x = rng() * W;
      let y = rng() * W;
      let ang = rng() * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const steps = 6 + Math.floor(rng() * 16);
      for (let s = 0; s < steps; s++) {
        ang += (rng() - 0.5) * 1.0;
        x += Math.cos(ang) * W * 0.007;
        y += Math.sin(ang) * W * 0.007;
        if (s % 3 === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // 白色边框 + 回纹
    const m = W * 0.045;
    ctx.save();
    ctx.strokeStyle = "rgba(243,238,223,0.9)";
    ctx.lineWidth = Math.max(1.2, W * 0.0022);
    ctx.strokeRect(m, m, W - m * 2, W - m * 2);
    ctx.lineWidth = Math.max(0.7, W * 0.0012);
    ctx.strokeRect(m * 1.18, m * 1.18, W - m * 2.36, W - m * 2.36);
    ctx.restore();

    meanderBorder(ctx, m * 1.06, m * 1.06, W - m * 2.12, W - m * 2.12, "rgba(243,238,223,0.5)", Math.max(0.8, W * 0.001), W * 0.012);

    // 边框重复小花
    const step = W * 0.055;
    const mr = W * 0.0115;
    for (let x = m * 1.7; x <= W - m * 1.7; x += step) {
      flower(ctx, x, m * 1.6, mr, "rgba(243,238,223,0.94)", 1);
      flower(ctx, x, W - m * 1.6, mr, "rgba(243,238,223,0.94)", 1);
    }
    for (let y = m * 1.7 + step; y <= W - m * 1.7 - step; y += step) {
      flower(ctx, m * 1.6, y, mr, "rgba(243,238,223,0.94)", 1);
      flower(ctx, W - m * 1.6, y, mr, "rgba(243,238,223,0.94)", 1);
    }

    // 四角层叠团花
    const cm = W * 0.098;
    const corners = [
      [cm, cm], [W - cm, cm], [cm, W - cm], [W - cm, W - cm]
    ];
    corners.forEach(([x, y]) => {
      medallionFlower(ctx, x, y, W * 0.03, "rgba(243,238,223,0.95)", 1, 8);
      ctx.save();
      ctx.strokeStyle = "rgba(243,238,223,0.5)";
      ctx.lineWidth = Math.max(0.8, W * 0.0012);
      ctx.beginPath();
      ctx.arc(x, y, W * 0.045, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    sealStamp(ctx, W, W * 0.885, W * 0.885, W * 0.05, "rgba(243,238,223,0.92)", indigoDeep);
  }

  /* ---------------- 竹编 ---------------- */
  function drawBamboo(ctx, W, maskData, rng) {
    const { mask, edge } = maskData;
    // 2/2 斜纹编织：横篾压两针、挑两针，比棋盘格更像真竹编
    const cell = Math.max(14, Math.round(W / 28));
    const gap = Math.max(1.1, cell * 0.07);
    const HOR = [218, 191, 145];
    const VER = [199, 169, 122];
    const GAP = [165, 137, 94];

    const id = ctx.createImageData(W, W);
    const d = id.data;

    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const ix = Math.floor(x / cell);
        const iy = Math.floor(y / cell);
        const bx = x - ix * cell;
        const by = y - iy * cell;
        const over = (ix + iy) % 4 < 2;
        const base = over ? HOR : VER;
        const stripVar = ((over ? iy : ix) % 5) * 3 - 6;

        // 篾条之间的缝
        const seam = Math.min(Math.min(bx, cell - bx), Math.min(by, cell - by));
        const gapK = seam < gap ? clamp((gap - seam) / gap, 0, 1) : 0;

        // 沿篾条方向的高光
        const hi = over
          ? Math.max(0, 1 - Math.abs(by - cell * 0.34) / (cell * 0.32)) * 9
          : Math.max(0, 1 - Math.abs(bx - cell * 0.34) / (cell * 0.32)) * 7;

        let r = lerp(base[0] + stripVar + hi, GAP[0], gapK * 0.9);
        let g = lerp(base[1] + stripVar + hi * 0.92, GAP[1], gapK * 0.9);
        let b = lerp(base[2] + stripVar + hi * 0.72, GAP[2], gapK * 0.9);

        // 竹纤维
        const fib = (over ? Math.sin(y * 0.42 + x * 0.02) : Math.sin(x * 0.42 + y * 0.02)) * 2.2;
        r += fib;
        g += fib * 0.8;
        b += fib * 0.55;

        // 用户笔触：染成深色竹篾，但保留经纬明暗
        const m = mask[y * W + x];
        if (m > 0) {
          const lum = clamp((r + g + b) / 562, 0.55, 1.2);
          const k = m * 0.9;
          r = lerp(r, 62 * lum, k);
          g = lerp(g, 47 * lum, k);
          b = lerp(b, 29 * lum, k);
        }

        const p = (y * W + x) * 4;
        d[p] = clamp(r, 0, 255);
        d[p + 1] = clamp(g, 0, 255);
        d[p + 2] = clamp(b, 0, 255);
        d[p + 3] = 255;
      }
    }
    ctx.putImageData(id, 0, 0);

    // 竹节：每根竹篾上的环状节疤，是竹编最真实的辨识特征
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = "#5C4526";
    ctx.lineWidth = Math.max(1, W * 0.0014);
    const nodeGap = cell * 4.5;
    for (let y = nodeGap; y < W; y += nodeGap) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(W * 0.25, y + cell * 0.15, W * 0.75, y - cell * 0.15, W, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.22;
    for (let x = nodeGap; x < W; x += nodeGap) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + cell * 0.15, W * 0.25, x - cell * 0.15, W * 0.75, x, W);
      ctx.stroke();
    }
    ctx.restore();

    // 纹样边缘：浅竹色勾一道光，让形状读得出来
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.drawImage(edgeCanvas(edge, W, "#F4E3BE", 0.9), 0, 0);
    ctx.restore();

    // 收边：双线 + 回纹
    const m = W * 0.042;
    ctx.save();
    ctx.strokeStyle = "#6F552F";
    ctx.lineWidth = Math.max(1.6, W * 0.0035);
    ctx.strokeRect(m, m, W - m * 2, W - m * 2);
    ctx.strokeStyle = "rgba(242,224,182,0.55)";
    ctx.lineWidth = Math.max(0.8, W * 0.0014);
    ctx.strokeRect(m * 1.04, m * 1.04, W - m * 2.08, W - m * 2.08);
    ctx.restore();

    meanderBorder(ctx, m * 1.08, m * 1.08, W - m * 2.16, W - m * 2.16, "rgba(111,85,47,0.6)", Math.max(0.8, W * 0.001), W * 0.013);

    // 四角编结
    ctx.save();
    const corners = [[m * 2.2, m * 2.2], [W - m * 2.2, m * 2.2], [m * 2.2, W - m * 2.2], [W - m * 2.2, W - m * 2.2]];
    corners.forEach(([x, y]) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "rgba(98,76,45,0.6)";
      ctx.fillRect(-W * 0.011, -W * 0.011, W * 0.022, W * 0.022);
      ctx.strokeStyle = "rgba(242,224,182,0.62)";
      ctx.lineWidth = Math.max(1, W * 0.0018);
      ctx.strokeRect(-W * 0.011, -W * 0.011, W * 0.022, W * 0.022);
      ctx.restore();
    });
    ctx.restore();

    sealStamp(ctx, W, W * 0.885, W * 0.885, W * 0.05, "rgba(74,59,38,0.9)", "#EFDFC0");
  }

  /* ---------------- 皮影 ---------------- */
  function drawShadow(ctx, W, maskData, rng) {
    const { mask, edge, core, centroid } = maskData;

    // 暖黄羊皮纸底：半透明、带纤维与烫痕
    paperBase(ctx, W, "#F2E0B8", rng);
    ctx.save();
    ctx.globalAlpha = 0.08;
    const id = ctx.getImageData(0, 0, W, W);
    for (let i = 0; i < W * W; i++) {
      const v = (Math.sin(i * 0.21) + Math.sin(i * 0.013)) * 4;
      id.data[i * 4] = clamp(id.data[i * 4] + v, 0, 255);
      id.data[i * 4 + 1] = clamp(id.data[i * 4 + 1] + v * 0.8, 0, 255);
      id.data[i * 4 + 2] = clamp(id.data[i * 4 + 2] - 2, 0, 255);
    }
    ctx.putImageData(id, 0, 0);
    ctx.restore();

    // 背后暖光：从中心透出的橘黄光，模拟灯箱
    const warm = ctx.createRadialGradient(W / 2, W / 2, W * 0.08, W / 2, W / 2, W * 0.72);
    warm.addColorStop(0, "rgba(255,196,120,0.42)");
    warm.addColorStop(0.5, "rgba(255,170,90,0.18)");
    warm.addColorStop(1, "rgba(180,100,50,0)");
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, W, W);

    // 皮影剪影：深褐偏红，半透明让光透出
    const shadowColor = "#7A2E1E";
    const silhouette = colorize(mask, W, shadowColor, 0.92);
    // 投影偏移
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.filter = "blur(" + Math.max(3, W * 0.006) + "px)";
    ctx.drawImage(colorize(mask, W, "#3A1410", 0.6), W * 0.008, W * 0.01);
    ctx.restore();
    ctx.drawImage(silhouette, 0, 0);

    // 镂雕开口：在剪影厚实处开出云纹与圆点孔，让光透过来
    const carve = document.createElement("canvas");
    carve.width = W; carve.height = W;
    const cc = carve.getContext("2d");
    cloudMotif(cc, W * 0.5, W * 0.5, W * 0.025, "#F2E0B8", 0.85);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const rr = W * (0.1 + (i % 4) * 0.04);
      crescentCut(cc, W / 2 + Math.cos(a) * rr, W / 2 + Math.sin(a) * rr, W * 0.008, "#F2E0B8", 0.7);
    }
    cc.globalCompositeOperation = "destination-in";
    cc.drawImage(maskCanvas(core, W), 0, 0);
    ctx.drawImage(carve, 0, 0);

    // 关节线：皮影各部件之间的细线连接，是皮影最标志性的特征
    ctx.save();
    ctx.strokeStyle = "rgba(242,224,184,0.7)";
    ctx.lineWidth = Math.max(1, W * 0.0016);
    ctx.setLineDash([W * 0.012, W * 0.008]);
    // 横向关节线
    for (let y = W * 0.2; y < W * 0.85; y += W * 0.18) {
      ctx.beginPath();
      ctx.moveTo(W * 0.1, y);
      ctx.lineTo(W * 0.9, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // 关节铆钉
    ctx.fillStyle = "rgba(242,224,184,0.85)";
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const rr = W * 0.22;
      const jx = centroid.x + Math.cos(a) * rr;
      const jy = centroid.y + Math.sin(a) * rr;
      ctx.beginPath();
      ctx.arc(jx, jy, W * 0.006, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 描边压深
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(edgeCanvas(edge, W, "#3A1410", 0.5), 0, 0);
    ctx.restore();

    // 边框：双线 + 卷草纹
    const m = W * 0.042;
    ctx.save();
    ctx.strokeStyle = "#7A2E1E";
    ctx.lineWidth = Math.max(2, W * 0.004);
    ctx.strokeRect(m, m, W - m * 2, W - m * 2);
    ctx.lineWidth = Math.max(0.8, W * 0.0012);
    ctx.globalAlpha = 0.6;
    ctx.strokeRect(m * 1.16, m * 1.16, W - m * 2.32, W - m * 2.32);
    ctx.restore();

    // 四角如意云纹
    [[m * 2, m * 2], [W - m * 2, m * 2], [m * 2, W - m * 2], [W - m * 2, W - m * 2]].forEach(([x, y]) =>
      cloudMotif(ctx, x, y, W * 0.022, "#7A2E1E", 0.85));

    sealStamp(ctx, W, W * 0.885, W * 0.885, W * 0.05, "#7A2E1E", "#F2E0B8");
  }

  /* ---------------- 刺绣 ---------------- */
  function drawEmbroidery(ctx, W, maskData, rng) {
    const { mask, edge, core, centroid } = maskData;

    // 绸缎底：暗雅的素色缎面，带经向光泽
    ctx.fillStyle = "#E8DCC8";
    ctx.fillRect(0, 0, W, W);
    // 缎面光泽：水平方向的微妙渐变带
    for (let i = 0; i < 30; i++) {
      const y = (i / 30) * W;
      const g = ctx.createLinearGradient(0, y, 0, y + W / 30);
      const t = (Math.sin(i * 0.7) + 1) / 2;
      g.addColorStop(0, "rgba(255,255,255," + (0.03 + t * 0.06) + ")");
      g.addColorStop(1, "rgba(180,160,130," + (0.02 + t * 0.03) + ")");
      ctx.fillStyle = g;
      ctx.fillRect(0, y, W, W / 30 + 1);
    }
    // 绸缎细纹
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = "#8B7355";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += Math.max(1.5, W / 600)) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, W); ctx.stroke();
    }
    ctx.restore();

    // 绣线色系：从用户主色派生，用多层次丝线
    const dc = (window.XHFY_LAST_COLORS && window.XHFY_LAST_COLORS[0]) || "#B23A48";
    const threadColors = [dc, "#D4556A", "#8C2A38", "#E8B4BC"];

    // 缎绣铺底：在剪影内部填充有方向的丝理
    const stitch = document.createElement("canvas");
    stitch.width = W; stitch.height = W;
    const sctx = stitch.getContext("2d");
    sctx.drawImage(colorize(mask, W, threadColors[0], 0.9), 0, 0);
    // 丝理线：沿着笔触方向排布短平行线，模拟缎绣
    sctx.save();
    sctx.globalCompositeOperation = "source-atop";
    const strokeAng = (window.XHFY_LAST_STROKE_ANG || 45) * Math.PI / 180;
    for (let y = 0; y < W; y += Math.max(2, W * 0.004)) {
      for (let x = 0; x < W; x += Math.max(2, W * 0.004)) {
        if (mask[Math.floor(y) * W + Math.floor(x)] < 0.5) continue;
        const len = W * (0.012 + rng() * 0.01);
        const ang = strokeAng + (rng() - 0.5) * 0.4;
        sctx.strokeStyle = threadColors[Math.floor(rng() * threadColors.length)];
        sctx.globalAlpha = 0.35 + rng() * 0.4;
        sctx.lineWidth = Math.max(0.6, W * 0.0012);
        sctx.beginPath();
        sctx.moveTo(x, y);
        sctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
        sctx.stroke();
      }
    }
    sctx.restore();
    ctx.drawImage(stitch, 0, 0);

    // 打籽绣点缀：法国结，散落在纹样中增加立体颗粒感
    ctx.save();
    for (let i = 0; i < 200; i++) {
      const x = rng() * W;
      const y = rng() * W;
      if (mask[Math.floor(y) * W + Math.floor(x)] < 0.7) continue;
      const r = W * (0.002 + rng() * 0.003);
      const col = threadColors[Math.floor(rng() * threadColors.length)];
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.7 + rng() * 0.25;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      // 结的高光
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 套针边缘：在轮廓处用深浅交替的短针收边
    ctx.save();
    ctx.strokeStyle = threadColors[2];
    ctx.lineWidth = Math.max(0.8, W * 0.0016);
    for (let y = 1; y < W - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (edge[y * W + x] < 0.5) continue;
        ctx.globalAlpha = 0.5 + rng() * 0.3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        const a = rng() * Math.PI * 2;
        ctx.lineTo(x + Math.cos(a) * W * 0.01, y + Math.sin(a) * W * 0.01);
        ctx.stroke();
      }
    }
    ctx.restore();

    // 丝线光泽：在整个绣面叠一层微妙的高光方向
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.globalCompositeOperation = "overlay";
    const sheen = ctx.createLinearGradient(0, 0, W, W);
    sheen.addColorStop(0, "rgba(255,255,255,0.5)");
    sheen.addColorStop(0.5, "rgba(255,255,255,0)");
    sheen.addColorStop(1, "rgba(255,255,255,0.3)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, W, W);
    ctx.restore();

    // 边框：细双线 + 四角打籽花
    const m = W * 0.042;
    ctx.save();
    ctx.strokeStyle = threadColors[2];
    ctx.lineWidth = Math.max(1.4, W * 0.0028);
    ctx.strokeRect(m, m, W - m * 2, W - m * 2);
    ctx.strokeStyle = "rgba(140,42,56,0.4)";
    ctx.lineWidth = Math.max(0.6, W * 0.0012);
    ctx.strokeRect(m * 1.12, m * 1.12, W - m * 2.24, W - m * 2.24);
    ctx.restore();

    // 四角打籽花
    [[m * 2, m * 2], [W - m * 2, m * 2], [m * 2, W - m * 2], [W - m * 2, W - m * 2]].forEach(([x, y]) => {
      flower(ctx, x, y, W * 0.018, threadColors[0], 0.9);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.fillStyle = threadColors[1];
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * W * 0.02, y + Math.sin(a) * W * 0.02, W * 0.004, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    sealStamp(ctx, W, W * 0.885, W * 0.885, W * 0.05, threadColors[2], "#E8DCC8");
  }

  /* ---------------- AI 二创合成 ---------------- */

  /** 把用户笔迹重染成单一颜色，作为 AI 二创稿上的「原笔迹叠层」 */
  function traceCanvas(studio, width, color) {
    const w = width;
    const h = Math.round((w / 960) * 640);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d");
    if (!studio || studio.isEmpty()) return c;
    x.drawImage(studio.canvas, 0, 0, w, h);
    x.globalCompositeOperation = "source-in";
    x.fillStyle = color;
    x.fillRect(0, 0, w, h);
    return c;
  }

  /** 二创稿的非遗装裱边框 */
  function aiFrame(ctx, W, inset, style, rng) {
    const red = "#A6382A";
    const indigo = "#1D3550";
    const bamboo = "#8C6E3F";

    if (style === "papercut") {
      // 红纸边框 + 锯齿内边 + 四角团花
      ctx.save();
      ctx.fillStyle = "rgba(166,56,42,0.10)";
      ctx.fillRect(0, 0, W, inset);
      ctx.fillRect(0, W - inset, W, inset);
      ctx.fillRect(0, 0, inset, W);
      ctx.fillRect(W - inset, 0, inset, W);
      ctx.strokeStyle = red;
      ctx.lineWidth = Math.max(2, W * 0.0045);
      ctx.strokeRect(W * 0.018, W * 0.018, W * 0.964, W * 0.964);
      sawtooth(ctx, W, W * 0.03, W * 0.02, W * 0.012, red);
      [0.065, 0.935].forEach((p) => {
        [0.065, 0.935].forEach((q) => flower(ctx, W * p, W * q, W * 0.022, red, 0.9));
      });
      ctx.restore();
      sealStamp(ctx, W, W * 0.885, W * 0.885, W * 0.05, red, "#F4EBDD");
      return;
    }

    if (style === "tiedye") {
      ctx.save();
      ctx.fillStyle = "#16293D";
      ctx.fillRect(0, 0, W, inset * 0.86);
      ctx.fillRect(0, W - inset * 0.86, W, inset * 0.86);
      ctx.fillRect(0, 0, inset * 0.86, W);
      ctx.fillRect(W - inset * 0.86, 0, inset * 0.86, W);
      // 手工缝线：白色虚线 + 轻微抖动
      ctx.strokeStyle = "rgba(244,239,225,0.72)";
      ctx.lineWidth = Math.max(1.5, W * 0.003);
      ctx.setLineDash([W * 0.014, W * 0.011]);
      ctx.lineDashOffset = (rng() * W) % 20;
      ctx.strokeRect(W * 0.036, W * 0.036, W * 0.928, W * 0.928);
      ctx.setLineDash([]);
      // 四角扎结
      [0.05, 0.95].forEach((p) => {
        [0.05, 0.95].forEach((q) => {
          const g = ctx.createRadialGradient(W * p, W * q, 0, W * p, W * q, W * 0.035);
          g.addColorStop(0, "rgba(255,255,255,0.85)");
          g.addColorStop(0.45, "rgba(127,161,184,0.45)");
          g.addColorStop(1, "rgba(22,41,61,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(W * p, W * q, W * 0.035, 0, Math.PI * 2);
          ctx.fill();
        });
      });
      ctx.restore();
      sealStamp(ctx, W, W * 0.885, W * 0.885, W * 0.05, indigo, "#EFE6D4");
      return;
    }

    if (style === "calico") {
      ctx.save();
      ctx.fillStyle = "#26425F";
      ctx.fillRect(0, 0, W, inset * 0.9);
      ctx.fillRect(0, W - inset * 0.9, W, inset * 0.9);
      ctx.fillRect(0, 0, inset * 0.9, W);
      ctx.fillRect(W - inset * 0.9, 0, inset * 0.9, W);
      // 白花点沿边框排布
      const step = W * 0.052;
      for (let x = step; x < W - step; x += step) {
        flower(ctx, x, W * 0.034, W * 0.012, "#F4EFE1", 0.75);
        flower(ctx, x, W * 0.966, W * 0.012, "#F4EFE1", 0.75);
      }
      for (let y = step; y < W - step; y += step) {
        flower(ctx, W * 0.034, y, W * 0.012, "#F4EFE1", 0.75);
        flower(ctx, W * 0.966, y, W * 0.012, "#F4EFE1", 0.75);
      }
      ctx.restore();
      sealStamp(ctx, W, W * 0.885, W * 0.885, W * 0.05, "#26425F", "#F4EFE1");
      return;
    }

    if (style === "bamboo") {
    // 竹编：四边竹篾交替
    ctx.save();
    const slats = 26;
    const gap = W / slats;
    ctx.fillStyle = "#E8D6AE";
    ctx.fillRect(0, 0, W, inset * 0.78);
    ctx.fillRect(0, W - inset * 0.78, W, inset * 0.78);
    ctx.fillRect(0, 0, inset * 0.78, W);
    ctx.fillRect(W - inset * 0.78, 0, inset * 0.78, W);
    for (let i = 0; i < slats; i++) {
      const x = i * gap;
      const y = i * gap;
      ctx.fillStyle = i % 2 ? "rgba(140,110,63,0.30)" : "rgba(201,169,106,0.26)";
      ctx.fillRect(x, 0, gap * 0.52, inset * 0.78);
      ctx.fillRect(x, W - inset * 0.78, gap * 0.52, inset * 0.78);
      ctx.fillRect(0, y, inset * 0.78, gap * 0.52);
      ctx.fillRect(W - inset * 0.78, y, inset * 0.78, gap * 0.52);
    }
    ctx.strokeStyle = bamboo;
    ctx.lineWidth = Math.max(1.6, W * 0.0028);
    ctx.strokeRect(W * 0.022, W * 0.022, W * 0.956, W * 0.956);
    ctx.restore();
    sealStamp(ctx, W, W * 0.885, W * 0.885, W * 0.05, bamboo, "#F0E2C4");
    return;
  }

  if (style === "shadow") {
    // 皮影：暖黄羊皮边框 + 镂雕关节线 + 四角云纹
    ctx.save();
    ctx.fillStyle = "#E8C88A";
    ctx.fillRect(0, 0, W, inset * 0.82);
    ctx.fillRect(0, W - inset * 0.82, W, inset * 0.82);
    ctx.fillRect(0, 0, inset * 0.82, W);
    ctx.fillRect(W - inset * 0.82, 0, inset * 0.82, W);
    ctx.strokeStyle = "#7A2E1E";
    ctx.lineWidth = Math.max(2, W * 0.0038);
    ctx.strokeRect(W * 0.026, W * 0.026, W * 0.948, W * 0.948);
    ctx.strokeStyle = "rgba(122,46,30,0.4)";
    ctx.lineWidth = Math.max(0.8, W * 0.0012);
    ctx.strokeRect(W * 0.036, W * 0.036, W * 0.928, W * 0.928);
    [[0.06, 0.06], [0.94, 0.06], [0.06, 0.94], [0.94, 0.94]].forEach(([p, q]) =>
      cloudMotif(ctx, W * p, W * q, W * 0.018, "#7A2E1E", 0.85));
    ctx.restore();
    sealStamp(ctx, W, W * 0.885, W * 0.885, W * 0.05, "#7A2E1E", "#F2E0B8");
    return;
  }

  if (style === "embroidery") {
    // 刺绣：细双线边框 + 四角打籽花
    ctx.save();
    ctx.strokeStyle = "#8C2A38";
    ctx.lineWidth = Math.max(1.6, W * 0.003);
    ctx.strokeRect(W * 0.024, W * 0.024, W * 0.952, W * 0.952);
    ctx.strokeStyle = "rgba(140,42,56,0.35)";
    ctx.lineWidth = Math.max(0.6, W * 0.0012);
    ctx.strokeRect(W * 0.034, W * 0.034, W * 0.932, W * 0.932);
    [[0.06, 0.06], [0.94, 0.06], [0.06, 0.94], [0.94, 0.94]].forEach(([p, q]) => {
      flower(ctx, W * p, W * q, W * 0.016, "#B23A48", 0.9);
    });
    ctx.restore();
    sealStamp(ctx, W, W * 0.885, W * 0.885, W * 0.05, "#8C2A38", "#E8DCC8");
    return;
  }
}

  /**
   * 把 AI 重绘底图与用户原笔迹合成一张非遗作品
   * @param {HTMLImageElement} baseImage 已加载完成的 CogView 图
   * @param {PaintStudio} studio
   * @param {string} style
   * @param {number} size
   */
  function renderAI(baseImage, studio, style, size) {
    const W = size || 1024;
    const out = document.createElement("canvas");
    out.width = W;
    out.height = W;
    const ctx = out.getContext("2d");
    const rng = mulberry32(918273 + style.length * 451);
    const inset = W * 0.055;
    const art = W - inset * 2;

    paperBase(ctx, W, PAPER, rng);

    ctx.save();
    ctx.beginPath();
    ctx.rect(inset, inset, art, art);
    ctx.clip();

    if (baseImage && baseImage.width) {
      const scale = Math.max(art / baseImage.width, art / baseImage.height);
      const dw = baseImage.width * scale;
      const dh = baseImage.height * scale;
      ctx.drawImage(baseImage, inset + (art - dw) / 2, inset + (art - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = "#EFE5D4";
      ctx.fillRect(inset, inset, art, art);
    }

    // 原笔迹叠层：保留用户自己的形状与用力痕迹
    const ghostColor = (style === "tiedye" || style === "calico") ? "#0E2035" : "#7A2418";
    const ghost = traceCanvas(studio, Math.round(art * 1.05), ghostColor);
    const gw = art * 0.94;
    const gh = (gw / ghost.width) * ghost.height;
    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = 0.62;
    ctx.drawImage(ghost, inset + (art - gw) / 2, inset + (art - gh) / 2, gw, gh);
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.1;
    ctx.drawImage(ghost, inset + (art - gw) / 2, inset + (art - gh) / 2, gw, gh);
    ctx.restore();

    // 内框细线与轻微暗角，让画面收住
    ctx.strokeStyle = "rgba(30,28,25,0.22)";
    ctx.lineWidth = Math.max(1, W * 0.0016);
    ctx.strokeRect(inset, inset, art, art);
    const vg = ctx.createRadialGradient(W / 2, W / 2, W * 0.3, W / 2, W / 2, W * 0.78);
    vg.addColorStop(0, "rgba(30,28,25,0)");
    vg.addColorStop(1, "rgba(30,28,25,0.08)");
    ctx.fillStyle = vg;
    ctx.fillRect(inset, inset, art, art);
    ctx.restore();

    aiFrame(ctx, W, inset, style, rng);
    return out;
  }

  function render(style, studio, size) {
    const W = size || 1024;
    const scene = buildScene(studio, W);
    const maskData = buildMask(scene, W);
    const out = document.createElement("canvas");
    out.width = W;
    out.height = W;
    const ctx = out.getContext("2d");
    const rng = mulberry32(20261024 + style.length * 977);

    if (!maskData.coverage) {
      // 空画布时仍输出一张空的工艺纸，供占位
      paperBase(ctx, W, PAPER, rng);
      if (style === "tiedye" || style === "calico") {
        ctx.fillStyle = style === "tiedye" ? "#2B4A6B" : "#27435F";
        ctx.fillRect(0, 0, W, W);
      }
    }

    if (style === "papercut") drawPapercut(ctx, W, maskData, rng);
    else if (style === "tiedye") drawTiedye(ctx, W, maskData, rng);
    else if (style === "calico") drawCalico(ctx, W, maskData, rng);
    else if (style === "bamboo") drawBamboo(ctx, W, maskData, rng);
    else if (style === "shadow") drawShadow(ctx, W, maskData, rng);
    else if (style === "embroidery") drawEmbroidery(ctx, W, maskData, rng);
    else drawPapercut(ctx, W, maskData, rng);

    return out;
  }

  /** 智能匹配工艺：根据画面线条特征自动选择最契合的非遗门类 */
  function autoMatchCraft(analysis) {
    const s = (analysis && analysis.scores) || {};
    const m = (analysis && analysis.metrics) || {};
    const htp = (analysis && analysis.htp) || {};
    const orientEntropy = m.orientationEntropy || 0.5;
    const bboxRatio = m.bboxRatio || 0.2;
    const coverage = m.coverage || 0.1;
    const hueEntropy = m.hueEntropy || 0.5;
    const tension = s.tension || 50;
    const order = s.order || 50;
    const lineDir = htp.lineDirection || "方向多变";

    // 极简单线条（儿童涂鸦）：剪纸，用繁复镂空丰富它
    if (bboxRatio < 0.12 && coverage < 0.06 && orientEntropy > 0.6) {
      return "papercut";
    }
    // 乱线团（高覆盖、高方向熵、低秩序）：扎染，用蓝色晕染化解
    if (coverage > 0.22 && orientEntropy > 0.7 && order < 45) {
      return "tiedye";
    }
    // 直线交接（水平/垂直为主、秩序高）：竹编，经纬交织
    if ((lineDir.indexOf("水平") >= 0 || lineDir.indexOf("垂直") >= 0) && order > 55) {
      return "bamboo";
    }
    // 圆润交织（方向多变但覆盖适中）：刺绣，丝理针脚
    if (orientEntropy > 0.55 && coverage > 0.08 && coverage < 0.2 && tension < 60) {
      return "embroidery";
    }
    // 曲折有张力（高张力、低覆盖）：皮影，镂雕关节
    if (tension > 60 && coverage < 0.15) {
      return "shadow";
    }
    // 其余：按秩序感与色调数兜底
    if (order > 60) return "bamboo";
    if (hueEntropy > 0.6) return "embroidery";
    return "papercut";
  }

  window.XHFYCraft = { render, renderAI, META, autoMatchCraft };
})();
