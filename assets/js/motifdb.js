/* =========================================================
   心绘非遗 · 剪纸纹样单元库（motifdb）
   ---------------------------------------------------------
   数据来源：《中国动物剪纸纹样逐图拆解分析（修订版）》313 件、
   《中国剪纸纹样逐图元素拆解与心理绘画 AI 数据库》302 件、
   《剪纸纹样逐件拆解与心理映射数据库》303 件，以及
   《数据库拆解方法 / 图像分析流程 / 多维匹配机制 / 关联生成方案》。

   本文件只做三件事：
     1. 把已标注的「纹样单元」整理成可检索的结构化记录（含出处编号）；
     2. 提供多维匹配打分（权重与拆解方法文档一致）；
     3. 提供每个单元的矢量绘制函数——程序化绘制保证刀路干净、可镂空，
        而不是把照片贴图糊上去。
   ========================================================= */
(function () {
  "use strict";

  /* ---------------- 一、单元清单 ---------------- */

  /**
   * layer   : 主纹 / 填充 / 边饰 / 角饰
   * tech    : 阴刻（镂空成孔）/ 阳刻（留红成线）
   * fits    : round 团块 / elongated 细长 / corner 边角 / band 带状 / sparse 稀疏
   * tags    : curve 曲线度、angular 折角度、radial 放射度、linear 线状度、density 密度
   * db      : 出自哪件剪纸的哪一项拆解
   */
  const UNITS = [
    {
      id: "ruyi-cloud",
      name: "如意云纹",
      layer: "填充",
      tech: "阴刻",
      fits: ["round", "corner", "sparse"],
      tags: { curve: 0.9, angular: 0.15, radial: 0.2, linear: 0.35, density: 0.4 },
      db: [
        { code: "图002", title: "窗花剪纸（2）· 圆形团花与中心花卉", note: "卷草式外缘与环形花叶边饰" },
        { code: "CP-013", title: "圆形团花 / 放射式构图", note: "同心圆、花瓣、卷草层层展开" }
      ],
      meaning: "云头三卷，取「如意」之意；常填于主体周围的天与气，象征顺遂、气韵流动"
    },
    {
      id: "cloud-roll",
      name: "卷云纹",
      layer: "填充",
      tech: "阴刻",
      fits: ["elongated", "round", "band"],
      tags: { curve: 0.95, angular: 0.1, radial: 0.35, linear: 0.3, density: 0.45 },
      db: [
        { code: "图016", title: "鱼形或鸟形单体吉祥纹样", note: "卷曲尾部以卷云收束" },
        { code: "CP-001", title: "居室花剪纸", note: "躯干内嵌卷草与鳞羽式装饰" }
      ],
      meaning: "取自然云气回旋之势，是剪纸里最通用的「填空纹」，让留白有呼吸"
    },
    {
      id: "vine-scroll",
      name: "卷草缠枝纹",
      layer: "填充",
      tech: "阳刻",
      fits: ["elongated", "band", "sparse"],
      tags: { curve: 0.85, angular: 0.1, radial: 0.15, linear: 0.75, density: 0.5 },
      db: [
        { code: "CP-022", title: "动物与花枝、莲叶、果实或水波组合", note: "枝蔓串联主体与边角" },
        { code: "209", title: "双龙 / 动物卷草纹", note: "以卷草收尾、连绵不断" }
      ],
      meaning: "枝蔓连绵不断，寓意生生不息；在构图里负责把主体与边角「牵」起来"
    },
    {
      id: "chrysanthemum",
      name: "菊瓣团花",
      layer: "填充",
      tech: "阴刻",
      fits: ["round", "corner"],
      tags: { curve: 0.6, angular: 0.2, radial: 0.95, linear: 0.1, density: 0.7 },
      db: [
        { code: "图003", title: "圆形团花与中心花卉", note: "中心花心 + 放射花瓣 + 环形卷草边饰" },
        { code: "034", title: "花卉团花", note: "花瓣层层套叠的典型团花" }
      ],
      meaning: "团花是剪纸最古老的构图母题，菊瓣同心向外，象征圆满与秩序"
    },
    {
      id: "plum-five",
      name: "五瓣梅花",
      layer: "填充",
      tech: "阴刻",
      fits: ["round", "sparse"],
      tags: { curve: 0.55, angular: 0.2, radial: 0.8, linear: 0.1, density: 0.45 },
      db: [
        { code: "图012", title: "菱形几何与中心花纹", note: "中心圆 / 花心" },
        { code: "034", title: "花卉团花", note: "五出花瓣" }
      ],
      meaning: "五瓣为「梅开五福」，常用作小面积的点睛花"
    },
    {
      id: "lotus-petal",
      name: "莲瓣纹",
      layer: "填充",
      tech: "阴刻",
      fits: ["round", "band", "elongated"],
      tags: { curve: 0.7, angular: 0.15, radial: 0.75, linear: 0.2, density: 0.55 },
      db: [
        { code: "CP-022", title: "动物与花枝、莲叶、果实或水波组合", note: "莲叶与花瓣" },
        { code: "图017", title: "鱼、花卉与圆形构图", note: "莲叶 / 花瓣环绕鱼身" }
      ],
      meaning: "莲瓣层叠，清雅不争，适合填在水波或鱼身附近"
    },
    {
      id: "crescent",
      name: "月牙纹",
      layer: "填充",
      tech: "阴刻",
      fits: ["elongated", "sparse", "band"],
      tags: { curve: 0.75, angular: 0.1, radial: 0.25, linear: 0.65, density: 0.25 },
      db: [
        { code: "001", title: "虎形瑞兽", note: "身体以月牙状点纹与卷纹装饰" },
        { code: "CP-005", title: "鸡 / 凤鸟", note: "翅羽、腹部以弧形填花" }
      ],
      meaning: "最省工的镂空单元，一弯月牙就是一个呼吸口，密排即成鳞羽"
    },
    {
      id: "willow-leaf",
      name: "柳叶纹",
      layer: "填充",
      tech: "阴刻",
      fits: ["elongated", "band"],
      tags: { curve: 0.65, angular: 0.15, radial: 0.3, linear: 0.85, density: 0.35 },
      db: [
        { code: "CP-005", title: "鸡 / 凤鸟", note: "尾羽、翅羽以柳叶状长条分组" },
        { code: "图016", title: "鱼形或鸟形吉祥纹样", note: "鳞羽纹按生长方向排布" }
      ],
      meaning: "叶形窄长，顺着走势排布就有「风过」的方向感"
    },
    {
      id: "feather",
      name: "羽纹",
      layer: "填充",
      tech: "阴刻",
      fits: ["elongated", "round"],
      tags: { curve: 0.7, angular: 0.1, radial: 0.5, linear: 0.7, density: 0.6 },
      db: [
        { code: "CP-005", title: "鸡 / 凤鸟", note: "冠、喙、尾羽、翅羽及腹部填花纹" },
        { code: "图016", title: "鱼形或鸟形吉祥纹样", note: "羽鳞成组排列" }
      ],
      meaning: "一组三到五笔，长短错落，专用于翅膀与尾部的层次"
    },
    {
      id: "fish-scale",
      name: "鱼鳞纹",
      layer: "填充",
      tech: "阴刻",
      fits: ["round", "elongated"],
      tags: { curve: 0.6, angular: 0.2, radial: 0.3, linear: 0.4, density: 0.8 },
      db: [
        { code: "图016", title: "鱼形或鸟形吉祥纹样", note: "鱼身鳞纹成排覆盖" },
        { code: "001", title: "虎形瑞兽", note: "羽鳞状装饰覆盖躯干" }
      ],
      meaning: "半圆相错如鳞，是覆盖大面积身体的经典手法，愈密愈显工"
    },
    {
      id: "water-ripple",
      name: "水波纹",
      layer: "边饰",
      tech: "阳刻",
      fits: ["band", "elongated"],
      tags: { curve: 0.8, angular: 0.1, radial: 0.1, linear: 0.9, density: 0.45 },
      db: [
        { code: "图017", title: "鱼、花卉与圆形构图", note: "水波 / 莲叶托底" },
        { code: "CP-022", title: "动物与花枝、莲叶、水波组合", note: "底部水波带" }
      ],
      meaning: "连绵波浪压住画面下缘，让主体「有地方站」"
    },
    {
      id: "meander",
      name: "回纹（回字纹）",
      layer: "边饰",
      tech: "阳刻",
      fits: ["band"],
      tags: { curve: 0.15, angular: 0.95, radial: 0.1, linear: 0.85, density: 0.6 },
      db: [
        { code: "208", title: "连续花纹边饰", note: "回字式连续单元" },
        { code: "图012", title: "菱形几何与中心花纹", note: "几何外框与四向角饰" }
      ],
      meaning: "方折连绵、首尾相接，是剪纸边框的「规矩」"
    },
    {
      id: "sawtooth",
      name: "锯齿纹",
      layer: "边饰",
      tech: "阴刻",
      fits: ["band", "elongated"],
      tags: { curve: 0.1, angular: 0.9, radial: 0.2, linear: 0.8, density: 0.7 },
      db: [
        { code: "001", title: "虎形瑞兽", note: "边缘以锯齿状收口" },
        { code: "CP-008", title: "三角形 / 斜向分割的角花构图", note: "边角几何填充" }
      ],
      meaning: "一刀一齿，节奏最鲜明的剪纸语言，常用在轮廓外缘"
    },
    {
      id: "dot-seed",
      name: "打籽点纹",
      layer: "填充",
      tech: "阴刻",
      fits: ["sparse", "round", "band"],
      tags: { curve: 0.2, angular: 0.2, radial: 0.4, linear: 0.2, density: 0.3 },
      db: [
        { code: "001", title: "虎形瑞兽", note: "点纹点缀关节与面部" },
        { code: "CP-001", title: "居室花剪纸", note: "躯干内以点纹打散大块红面" }
      ],
      meaning: "最小的刀口，用来打散大面积留红，避免「闷」"
    },
    {
      id: "coin",
      name: "铜钱纹",
      layer: "填充",
      tech: "阴刻",
      fits: ["round", "corner"],
      tags: { curve: 0.8, angular: 0.3, radial: 0.85, linear: 0.1, density: 0.4 },
      db: [
        { code: "CP-008", title: "角花构图", note: "边角以几何纹填充" },
        { code: "034", title: "花卉团花", note: "圆形单元化用" }
      ],
      meaning: "外圆内方，常作角部或间隙的小圆点，取「富贵不断头」"
    },
    {
      id: "panchang",
      name: "盘长纹",
      layer: "填充",
      tech: "阴刻",
      fits: ["round", "corner"],
      tags: { curve: 0.55, angular: 0.75, radial: 0.3, linear: 0.5, density: 0.55 },
      db: [
        { code: "208", title: "连续花纹边饰", note: "回环相连的单元" },
        { code: "CP-013", title: "团花构图", note: "同心结构" }
      ],
      meaning: "首尾回环无断点，寓意绵长不断，适合填在连接处"
    },
    {
      id: "corner-flower",
      name: "角花",
      layer: "角饰",
      tech: "阳刻",
      fits: ["corner"],
      tags: { curve: 0.7, angular: 0.35, radial: 0.8, linear: 0.2, density: 0.6 },
      db: [
        { code: "CP-008", title: "三角形 / 斜向分割的角花构图", note: "边角以花叶、卷草或几何纹填充" },
        { code: "图012", title: "菱形几何与中心花纹", note: "四向角饰" }
      ],
      meaning: "四角压阵，是剪纸「有头有尾」的关键；只压角，不进门"
    },
    {
      id: "butterfly",
      name: "蝶纹",
      layer: "填充",
      tech: "阴刻",
      fits: ["round", "sparse"],
      tags: { curve: 0.85, angular: 0.1, radial: 0.5, linear: 0.3, density: 0.5 },
      db: [
        { code: "CP-022", title: "动物与花枝组合", note: "蝶与花枝并置" },
        { code: "图003", title: "圆形团花与中心花卉", note: "团花间以蝶点睛" }
      ],
      meaning: "蝶恋花，破闷的一笔，适合落在较大的空白红面里"
    },
    {
      id: "bottle-flower",
      name: "瓶花纹",
      layer: "填充",
      tech: "阴刻",
      fits: ["elongated", "round"],
      tags: { curve: 0.6, angular: 0.45, radial: 0.3, linear: 0.4, density: 0.55 },
      db: [
        { code: "CP-022", title: "动物与花枝、果实组合", note: "瓶与花枝" },
        { code: "图002", title: "窗花剪纸", note: "中心花卉与容器" }
      ],
      meaning: "瓶谐「平」，插花即「平安」，多用于竖向的窄区"
    },
    {
      id: "wave-band",
      name: "连续弧线带",
      layer: "边饰",
      tech: "阴刻",
      fits: ["band"],
      tags: { curve: 0.85, angular: 0.05, radial: 0.15, linear: 0.9, density: 0.4 },
      db: [
        { code: "208", title: "连续花纹边饰", note: "单元化弧线连续排布" },
        { code: "图017", title: "鱼、花卉与圆形构图", note: "水波托底" }
      ],
      meaning: "最轻的边饰，一道弧接一道弧，衬托主体的重量"
    }
  ];

  /**
   * 单元体量：large 大团花 / small 小点缀。
   * 「空间布局」这一维除了密度，还要看纹样体量是否配得上区域大小——
   * 大片留红里塞一枚铜钱会空，窄缝里塞一朵团花会糊。
   */
  const SCALE_OF = {
    "ruyi-cloud": "large", "cloud-roll": "large", "vine-scroll": "large",
    "chrysanthemum": "large", "plum-five": "large", "lotus-petal": "large",
    "feather": "large", "fish-scale": "large", "panchang": "large",
    "corner-flower": "large", "butterfly": "large", "bottle-flower": "large",
    "crescent": "small", "willow-leaf": "small", "water-ripple": "small",
    "meander": "small", "sawtooth": "small", "dot-seed": "small",
    "coin": "small", "wave-band": "small"
  };
  UNITS.forEach((u) => { u.scale = SCALE_OF[u.id] || "small"; });

  /* ---------------- 二、多维匹配 ---------------- */

  /** 与拆解方法文档一致的六维权重 */
  const WEIGHTS = {
    shape: 0.20,   // 轮廓形似
    line: 0.25,    // 线条风格
    topo: 0.20,    // 结构拓扑
    space: 0.15,   // 空间布局
    local: 0.15,   // 局部视觉
    semantic: 0.05 // 语义情绪
  };

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  /**
   * 单个纹样单元对一个目标区域的匹配分。
   * 六维全部可解释：region 的形/线/拓扑/区位 → unit 的 fits/tags/layer。
   */
  function scoreUnit(unit, region) {
    const t = unit.tags;

    // 轮廓形似：单元的适配形状是否命中区域判定的形状
    const shape = unit.fits.indexOf(region.shape) >= 0 ? 1 : 0.25;

    // 线条风格：曲线度 / 折角度两个分量
    const line = 1 - (Math.abs(t.curve - region.curve) * 0.65 +
                      Math.abs(t.angular - region.angular) * 0.35);

    // 结构拓扑：放射度与线状度
    const topo = 1 - (Math.abs(t.radial - region.radial) * 0.5 +
                      Math.abs(t.linear - region.linear) * 0.5);

    // 空间布局：密度吻合 + 体量吻合（大片留红配团花，窄缝配小点缀）
    const densityFit = 1 - Math.abs(t.density - region.density);
    const scaleFit = region.sizeClass
      ? (unit.scale === region.sizeClass ? 1 : 0.3)
      : 0.75;
    const space = densityFit * 0.45 + scaleFit * 0.55;

    // 局部视觉：区位与图层的适配（边角要角饰、带要边饰、内部要填充）
    let local = 0.7;
    if (region.zone === "corner") local = unit.layer === "角饰" ? 1 : 0.3;
    else if (region.zone === "band") local = unit.layer === "边饰" ? 1 : 0.45;
    else local = unit.layer === "填充" ? 1 : 0.35;

    // 语义情绪：纹样寓意与报告关键词的弱关联
    let semantic = 0.5;
    if (region.tags && region.tags.length) {
      const hit = unit.meaning + unit.name;
      semantic = clamp01(0.4 + region.tags.filter((k) => hit.indexOf(k) >= 0).length * 0.2);
    }

    return (
      shape * WEIGHTS.shape +
      clamp01(line) * WEIGHTS.line +
      clamp01(topo) * WEIGHTS.topo +
      clamp01(space) * WEIGHTS.space +
      local * WEIGHTS.local +
      semantic * WEIGHTS.semantic
    );
  }

  /** 取分最高的 n 个单元（去重后按分排序） */
  function retrieve(region, n) {
    const scored = UNITS.map((u) => ({ unit: u, score: scoreUnit(u, region) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, n || 3);
  }

  function byId(id) {
    for (let i = 0; i < UNITS.length; i++) if (UNITS[i].id === id) return UNITS[i];
    return null;
  }

  /* ---------------- 三、几何绘制 ---------------- */

  const TAU = Math.PI * 2;

  /** 圆点阵列（打籽） */
  function dotGrid(ctx, x, y, w, h, gap, r) {
    for (let yy = y; yy <= y + h; yy += gap) {
      for (let xx = x; xx <= x + w; xx += gap) {
        ctx.moveTo(xx + r, yy);
        ctx.arc(xx, yy, r, 0, TAU);
      }
    }
  }

  /** 月牙：外圆减内圆 */
  function crescent(ctx, x, y, r, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.arc(r * 0.42, 0, r * 0.92, 0, TAU, true);
    ctx.fill();
    ctx.restore();
  }

  /** 柳叶：两端尖的梭形 */
  function leaf(ctx, x, y, len, wid, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.beginPath();
    ctx.moveTo(-len / 2, 0);
    ctx.quadraticCurveTo(0, -wid, len / 2, 0);
    ctx.quadraticCurveTo(0, wid, -len / 2, 0);
    ctx.fill();
    ctx.restore();
  }

  /** 如意云头：三卷 + 云脚（用粗线勾，保证刀口宽度） */
  function ruyi(ctx, x, y, s, lw) {
    ctx.lineWidth = lw;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    // 左卷
    ctx.moveTo(x - s * 0.5, y + s * 0.16);
    ctx.arc(x - s * 0.34, y - s * 0.06, s * 0.2, Math.PI * 0.45, Math.PI * 1.75, false);
    // 中卷
    ctx.moveTo(x - s * 0.06, y + s * 0.16);
    ctx.arc(x, y - s * 0.12, s * 0.22, Math.PI * 0.55, Math.PI * 2.15, false);
    // 右卷
    ctx.moveTo(x + s * 0.28, y + s * 0.16);
    ctx.arc(x + s * 0.34, y - s * 0.06, s * 0.2, Math.PI * 0.45, Math.PI * 1.75, false);
    // 云脚
    ctx.moveTo(x - s * 0.62, y + s * 0.2);
    ctx.quadraticCurveTo(x, y + s * 0.52, x + s * 0.62, y + s * 0.2);
    ctx.stroke();
  }

  /** 卷云：一条阿基米德螺线 */
  function spiral(ctx, x, y, r, turns, lw, dir) {
    ctx.lineWidth = lw;
    ctx.lineCap = "round";
    ctx.beginPath();
    const steps = 64;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = t * TAU * (turns || 1.6) * (dir || 1);
      const rr = r * (1 - t * 0.86);
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  /** 菊瓣团花：花瓣 + 花心 + 外圈点 */
  function chrysanthemum(ctx, x, y, r, lw) {
    const petals = 12;
    ctx.lineWidth = lw;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * TAU;
      ctx.beginPath();
      ctx.ellipse(
        x + Math.cos(a) * r * 0.62,
        y + Math.sin(a) * r * 0.62,
        r * 0.3, r * 0.13, a, 0, TAU
      );
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, r * 0.26, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.09, 0, TAU);
    ctx.fill();
  }

  /** 梅花：五出花瓣 */
  function plum(ctx, x, y, r, lw) {
    ctx.lineWidth = lw;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * TAU;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r * 0.52, y + Math.sin(a) * r * 0.52, r * 0.34, 0, TAU);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, r * 0.16, 0, TAU);
    ctx.fill();
  }

  /** 莲瓣：尖头瓣沿径向排列 */
  function lotus(ctx, x, y, r, lw, petals) {
    const n = petals || 8;
    ctx.lineWidth = lw;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const cx = x + Math.cos(a) * r * 0.55;
      const cy = y + Math.sin(a) * r * 0.55;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, 0);
      ctx.quadraticCurveTo(0, -r * 0.22, r * 0.3, 0);
      ctx.quadraticCurveTo(0, r * 0.22, -r * 0.3, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** 鱼鳞：半圆相错 */
  function scales(ctx, x, y, w, h, r, lw) {
    ctx.lineWidth = lw;
    const stepX = r * 1.45;
    const stepY = r * 0.62;
    let row = 0;
    for (let yy = y; yy <= y + h; yy += stepY) {
      const offset = row % 2 ? stepX / 2 : 0;
      for (let xx = x - r; xx <= x + w + r; xx += stepX) {
        ctx.beginPath();
        ctx.arc(xx + offset, yy, r, 0.12 * Math.PI, 0.88 * Math.PI);
        ctx.stroke();
      }
      row++;
    }
  }

  /** 回纹带：连续方折 */
  function meander(ctx, x, y, w, h, unit, lw) {
    ctx.lineWidth = lw;
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
    const n = Math.max(2, Math.round(w / unit));
    const u = w / n;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    for (let i = 0; i < n; i++) {
      const x0 = x + i * u;
      ctx.lineTo(x0, y + h * 0.12);
      ctx.lineTo(x0 + u * 0.72, y + h * 0.12);
      ctx.lineTo(x0 + u * 0.72, y + h * 0.62);
      ctx.lineTo(x0 + u * 0.3, y + h * 0.62);
      ctx.lineTo(x0 + u * 0.3, y + h * 0.38);
      ctx.lineTo(x0 + u, y + h * 0.38);
      ctx.lineTo(x0 + u, y + h);
    }
    ctx.stroke();
  }

  /** 锯齿带：三角形连续 */
  function sawtooth(ctx, x, y, w, h, pitch) {
    const n = Math.max(2, Math.round(w / pitch));
    const u = w / n;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x0 = x + i * u;
      ctx.moveTo(x0, y + h);
      ctx.lineTo(x0 + u * 0.5, y);
      ctx.lineTo(x0 + u, y + h);
    }
    ctx.fill();
  }

  /** 水波带 */
  function ripple(ctx, x, y, w, amp, lw) {
    ctx.lineWidth = lw;
    ctx.lineCap = "round";
    ctx.beginPath();
    const n = 4;
    const seg = w / n;
    for (let i = 0; i < n; i++) {
      const x0 = x + i * seg;
      ctx.moveTo(x0, y);
      ctx.quadraticCurveTo(x0 + seg * 0.25, y - amp, x0 + seg * 0.5, y);
      ctx.quadraticCurveTo(x0 + seg * 0.75, y + amp, x0 + seg, y);
    }
    ctx.stroke();
  }

  /** 铜钱：外圆 + 中心方孔 */
  function coin(ctx, x, y, r, lw) {
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.78, 0, TAU);
    ctx.stroke();
    const a = r * 0.26;
    ctx.beginPath();
    ctx.rect(x - a, y - a, a * 2, a * 2);
    ctx.stroke();
  }

  /** 盘长：简化回环方结 */
  function knot(ctx, x, y, r, lw) {
    ctx.lineWidth = lw;
    const s = r * 0.34;
    ctx.beginPath();
    ctx.rect(x - s * 2.2, y - s * 2.2, s * 4.4, s * 4.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(x - s * 0.8, y - s * 0.8, s * 1.6, s * 1.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - s * 2.2, y);
    ctx.lineTo(x + s * 2.2, y);
    ctx.moveTo(x, y - s * 2.2);
    ctx.lineTo(x, y + s * 2.2);
    ctx.stroke();
  }

  /** 蝶：双翅 + 触须 */
  function butterfly(ctx, x, y, r, lw) {
    ctx.lineWidth = lw;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.ellipse(x - r * 0.42, y - r * 0.12, r * 0.4, r * 0.26, -0.5, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x + r * 0.42, y - r * 0.12, r * 0.4, r * 0.26, 0.5, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x - r * 0.3, y + r * 0.34, r * 0.26, r * 0.18, 0.4, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x + r * 0.3, y + r * 0.34, r * 0.26, r * 0.18, -0.4, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.3);
    ctx.lineTo(x, y + r * 0.5);
    ctx.moveTo(x, y - r * 0.3);
    ctx.quadraticCurveTo(x - r * 0.2, y - r * 0.6, x - r * 0.34, y - r * 0.62);
    ctx.moveTo(x, y - r * 0.3);
    ctx.quadraticCurveTo(x + r * 0.2, y - r * 0.6, x + r * 0.34, y - r * 0.62);
    ctx.stroke();
  }

  /** 瓶花：瓶身 + 插枝 + 三朵花 */
  function bottle(ctx, x, y, h, lw) {
    ctx.lineWidth = lw;
    ctx.lineCap = "round";
    const w = h * 0.42;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.22, y - h * 0.5);
    ctx.lineTo(x - w * 0.22, y - h * 0.34);
    ctx.quadraticCurveTo(x - w * 0.62, y - h * 0.2, x - w * 0.5, y + h * 0.24);
    ctx.quadraticCurveTo(x - w * 0.45, y + h * 0.5, x, y + h * 0.5);
    ctx.quadraticCurveTo(x + w * 0.45, y + h * 0.5, x + w * 0.5, y + h * 0.24);
    ctx.quadraticCurveTo(x + w * 0.62, y - h * 0.2, x + w * 0.22, y - h * 0.34);
    ctx.lineTo(x + w * 0.22, y - h * 0.5);
    ctx.stroke();
    // 枝
    ctx.beginPath();
    ctx.moveTo(x, y - h * 0.5);
    ctx.quadraticCurveTo(x + w * 0.1, y - h * 0.8, x, y - h * 0.95);
    ctx.moveTo(x, y - h * 0.72);
    ctx.quadraticCurveTo(x - w * 0.5, y - h * 0.86, x - w * 0.62, y - h * 0.98);
    ctx.moveTo(x, y - h * 0.78);
    ctx.quadraticCurveTo(x + w * 0.52, y - h * 0.9, x + w * 0.6, y - h * 1.0);
    ctx.stroke();
    // 花
    plum(ctx, x, y - h * 1.0, h * 0.1, lw * 0.8);
    plum(ctx, x - w * 0.62, y - h * 1.03, h * 0.085, lw * 0.8);
    plum(ctx, x + w * 0.6, y - h * 1.05, h * 0.085, lw * 0.8);
  }

  /** 角花：四分之一团花，朝内放射 */
  function corner(ctx, x, y, r, lw, dirX, dirY) {
    ctx.lineWidth = lw;
    ctx.lineCap = "round";
    // 三条放射枝
    for (let i = 0; i < 3; i++) {
      const a = (i / 2) * (Math.PI / 2);
      const ex = x + Math.cos(a) * r * dirX;
      const ey = y + Math.sin(a) * r * dirY;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(
        x + (ex - x) * 0.55 + (i === 1 ? r * 0.18 * dirX : 0),
        y + (ey - y) * 0.55 - (i === 1 ? r * 0.18 * dirY : 0),
        ex, ey
      );
      ctx.stroke();
      // 枝端小叶
      leaf(ctx, ex, ey, r * 0.3, r * 0.1, a + Math.PI / 2);
      // 枝中卷
      spiral(ctx, x + (ex - x) * 0.55, y + (ey - y) * 0.55, r * 0.16, 1.2, lw * 0.8, i % 2 ? 1 : -1);
    }
    // 根部小团花
    plum(ctx, x + r * 0.16 * dirX, y + r * 0.16 * dirY, r * 0.18, lw * 0.8);
  }

  /* ---------------- 导出 ---------------- */

  window.XHFYMotifDB = {
    UNITS,
    WEIGHTS,
    retrieve,
    score: scoreUnit,
    byId,
    draw: {
      dotGrid, crescent, leaf, ruyi, spiral, chrysanthemum, plum, lotus,
      scales, meander, sawtooth, ripple, coin, knot, butterfly, bottle, corner
    }
  };
})();
