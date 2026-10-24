/* =========================================================
   心绘非遗 · 画笔引擎
   极简但手感细腻：细线 / 涂抹 / 点彩 / 橡皮
   ========================================================= */
(function () {
  "use strict";

  const W = 960;
  const H = 640;
  const SCALE = 2;
  const PAPER = (window.XHFY_CONFIG && window.XHFY_CONFIG.paper) || "#FBF7EC";

  const PALETTE = [
    { name: "墨", color: "#1E1C19" },
    { name: "靛蓝", color: "#2B4A6B" },
    { name: "湖蓝", color: "#4E7F94" },
    { name: "苔绿", color: "#607A63" },
    { name: "赭石", color: "#B08A5A" },
    { name: "落日", color: "#C46753" },
    { name: "朱砂", color: "#A63A2B" },
    { name: "雾灰", color: "#9A958C" }
  ];

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  class PaintStudio {
    constructor(canvas, options) {
      this.canvas = canvas;
      this.options = options || {};
      this.ctx = canvas.getContext("2d");
      this.canvas.width = W * SCALE;
      this.canvas.height = H * SCALE;
      this.ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";

      this.strokes = [];
      this.redoStack = [];
      this.current = null;
      this.tool = "line";
      this.color = PALETTE[0].color;
      this.size = 8;
      this.drawing = false;
      this.last = null;
      this.lastTime = 0;
      this.speedSum = 0;
      this.speedCount = 0;
      this.softSprites = new Map();

      // 作画过程记录：不录屏，只记录可解释的行为信号
      this.behavior = {
        startedAt: 0,
        lastStrokeEndAt: 0,
        lastActionAt: 0,
        firstStrokeAt: 0,
        strokes: [],
        pauses: [],
        undo: 0,
        redo: 0,
        clear: 0,
        colorHistory: [],
        colorSet: new Set(),
        toolHistory: [],
        toolSet: new Set()
      };

      this._bind();
    }

    _bind() {
      const c = this.canvas;
      c.addEventListener("pointerdown", (e) => this._down(e));
      c.addEventListener("pointermove", (e) => this._move(e));
      c.addEventListener("pointerup", (e) => this._up(e));
      c.addEventListener("pointercancel", (e) => this._up(e));
      c.addEventListener("pointerleave", (e) => { if (this.drawing && e.buttons === 0) this._up(e); });
      c.addEventListener("contextmenu", (e) => e.preventDefault());
    }

    _pos(e) {
      const r = this.canvas.getBoundingClientRect();
      return {
        x: clamp(((e.clientX - r.left) / r.width) * W, 0, W),
        y: clamp(((e.clientY - r.top) / r.height) * H, 0, H)
      };
    }

    _down(e) {
      if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      this.canvas.setPointerCapture && this.canvas.setPointerCapture(e.pointerId);
      const p = this._pos(e);
      const now = performance.now();
      const b = this.behavior;

      if (!b.startedAt) b.startedAt = now;
      // 上一笔结束到这一笔开始之间的停顿，是犹豫与思考的痕迹
      if (b.lastStrokeEndAt && b.strokes.length) {
        const gap = now - b.lastStrokeEndAt;
        if (gap > 1600) {
          b.pauses.push({
            ms: Math.round(gap),
            x: Math.round(p.x),
            y: Math.round(p.y),
            afterStroke: b.strokes.length
          });
        }
      }
      b.lastActionAt = now;

      this.drawing = true;
      this.last = { ...p, t: now };
      this.lastTime = now;
      this.speedSum = 0;
      this.speedCount = 0;
      this.maxSpeedSample = 0;
      this.current = {
        tool: this.tool,
        color: this.color,
        size: this.size,
        startedAt: now,
        points: [{ x: p.x, y: p.y }]
      };
      this.strokes.push(this.current);
      this.redoStack.length = 0;
      if (this.tool !== "eraser") b.colorSet.add(this.color);
      b.toolSet.add(this.tool);
      if (this.tool === "dot") this._dot(p, 3);
      else this._segment(p, p, true);
      this._changed();
      if (this.options.onFirstStroke && this.strokes.length === 1) {
        b.firstStrokeAt = now;
        this.options.onFirstStroke();
      }
      if (this.options.onStrokeStart) this.options.onStrokeStart(this);
    }

    _move(e) {
      if (!this.drawing || !this.current) return;
      e.preventDefault();
      const p = this._pos(e);
      const now = performance.now();
      const dt = Math.max(1, now - this.lastTime);
      const dist = Math.hypot(p.x - this.last.x, p.y - this.last.y);
      const speed = dist / dt;
      this.speedSum += speed;
      this.speedCount++;
      if (speed > (this.maxSpeedSample || 0)) this.maxSpeedSample = speed;
      this.behavior.lastActionAt = now;
      const minDist = this.tool === "dot" ? 3 : Math.max(1.2, this.size * 0.12);
      if (dist < minDist) {
        // 平滑补齐：把微小位移合并到最后一点，避免点过密
        const lastPt = this.current.points[this.current.points.length - 1];
        lastPt.x = p.x;
        lastPt.y = p.y;
        return;
      }
      this.current.points.push({ x: p.x, y: p.y });
      if (this.tool === "dot") this._dot(p, Math.min(5, 1 + Math.floor(dist / 10)));
      else this._segment(this.last, p, false);
      this.last = { ...p, t: now };
      this.lastTime = now;
    }

    _up(e) {
      if (!this.drawing) return;
      const now = performance.now();
      this.drawing = false;
      if (this.current && this.current.points.length === 1) {
        const p = this.current.points[0];
        this._segment(p, p, true);
      }
      if (this.current) {
        const s = this.current;
        const pts = s.points;
        let length = 0;
        let minX = pts[0].x, maxX = pts[0].x, minY = pts[0].y, maxY = pts[0].y;
        for (let i = 0; i < pts.length; i++) {
          if (i) length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
          minX = Math.min(minX, pts[i].x);
          maxX = Math.max(maxX, pts[i].x);
          minY = Math.min(minY, pts[i].y);
          maxY = Math.max(maxY, pts[i].y);
        }
        const duration = Math.max(1, now - (s.startedAt || now));
        this.behavior.strokes.push({
          tool: s.tool,
          color: s.color,
          size: s.size,
          points: pts.length,
          length: Math.round(length),
          duration: Math.round(duration),
          avgSpeed: +(length / duration).toFixed(3),
          maxSpeed: +(this.maxSpeedSample || 0).toFixed(3),
          box: {
            x: Math.round(minX), y: Math.round(minY),
            w: Math.round(maxX - minX), h: Math.round(maxY - minY)
          }
        });
      }
      this.behavior.lastStrokeEndAt = now;
      this.behavior.lastActionAt = now;
      this.current = null;
      this.last = null;
      this._changed();
      if (this.options.onStrokeEnd) this.options.onStrokeEnd(this);
    }

    _segment(a, b, first) {
      const ctx = this.ctx;
      const size = this.current ? this.current.size : this.size;
      const color = this.current ? this.current.color : this.color;

      if (this.tool === "soft" || (this.current && this.current.tool === "soft")) {
        this._soft(a, b, size, color);
        return;
      }

      ctx.save();
      if (this.tool === "eraser" || (this.current && this.current.tool === "eraser")) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
        ctx.lineWidth = size * 1.5;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.globalAlpha = 0.94;
      }
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();

      if (first) {
        // 落笔时补一个圆点，让起笔不生硬
        ctx.save();
        if (this.tool === "eraser") {
          ctx.globalCompositeOperation = "destination-out";
          ctx.fillStyle = "#000";
        } else {
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.94;
        }
        ctx.beginPath();
        ctx.arc(b.x, b.y, size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    _sprite(color) {
      if (this.softSprites.has(color)) return this.softSprites.get(color);
      const s = document.createElement("canvas");
      s.width = 128;
      s.height = 128;
      const c = s.getContext("2d");
      const g = c.createRadialGradient(64, 64, 2, 64, 64, 64);
      g.addColorStop(0, color);
      g.addColorStop(0.32, this._rgba(color, 0.72));
      g.addColorStop(0.68, this._rgba(color, 0.22));
      g.addColorStop(1, this._rgba(color, 0));
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
      this.softSprites.set(color, s);
      return s;
    }

    _rgba(hex, a) {
      const h = hex.replace("#", "");
      const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16);
      return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
    }

    _soft(a, b, size, color) {
      const ctx = this.ctx;
      const sprite = this._sprite(color);
      const r = size * 1.55;
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const gap = Math.max(1.2, size * 0.18);
      const steps = Math.max(1, Math.ceil(dist / gap));
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 0.12;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        const jitter = (i % 3) * 0.6;
        ctx.drawImage(sprite, x - r - jitter, y - r + jitter, r * 2, r * 2);
      }
      ctx.restore();
    }

    _dot(p, n) {
      const ctx = this.ctx;
      const color = this.current ? this.current.color : this.color;
      const size = this.current ? this.current.size : this.size;
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = color;
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * size * 0.9;
        const r = Math.max(0.6, size * (0.12 + Math.random() * 0.22));
        ctx.globalAlpha = 0.35 + Math.random() * 0.5;
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(ang) * rad, p.y + Math.sin(ang) * rad, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    _drawStroke(stroke) {
      const ctx = this.ctx;
      const pts = stroke.points;
      if (!pts.length) return;
      if (stroke.tool === "dot") {
        ctx.save();
        ctx.fillStyle = stroke.color;
        for (let i = 0; i < pts.length; i++) {
          ctx.globalAlpha = 0.55;
          ctx.beginPath();
          ctx.arc(pts[i].x, pts[i].y, Math.max(0.7, stroke.size * 0.2), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        return;
      }
      if (stroke.tool === "soft") {
        for (let i = 1; i < pts.length; i++) {
          const prevTool = this.tool;
          this.tool = "soft";
          const fake = this.current;
          this.current = stroke;
          this._soft(pts[i - 1], pts[i], stroke.size, stroke.color);
          this.current = fake;
          this.tool = prevTool;
        }
        return;
      }
      ctx.save();
      if (stroke.tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = stroke.size * 1.5;
      } else {
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.globalAlpha = 0.94;
      }
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      if (pts.length === 1) {
        ctx.lineTo(pts[0].x + 0.01, pts[0].y + 0.01);
      } else {
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2;
          const my = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        const last = pts[pts.length - 1];
        ctx.lineTo(last.x, last.y);
      }
      ctx.stroke();
      ctx.restore();
    }

    redraw() {
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, W, H);
      ctx.restore();
      for (const stroke of this.strokes) this._drawStroke(stroke);
    }

    undo() {
      if (!this.strokes.length) return false;
      this.behavior.undo++;
      this.behavior.lastActionAt = performance.now();
      this.redoStack.push(this.strokes.pop());
      this.redraw();
      this._changed();
      if (this.options.onStrokeEnd) this.options.onStrokeEnd(this);
      return true;
    }

    redo() {
      if (!this.redoStack.length) return false;
      this.behavior.redo++;
      this.behavior.lastActionAt = performance.now();
      this.strokes.push(this.redoStack.pop());
      this.redraw();
      this._changed();
      if (this.options.onStrokeEnd) this.options.onStrokeEnd(this);
      return true;
    }

    clear() {
      if (!this.strokes.length) return;
      this.behavior.clear++;
      this.behavior.lastActionAt = performance.now();
      this.strokes.length = 0;
      this.redoStack.length = 0;
      this.redraw();
      this._changed();
      if (this.options.onStrokeEnd) this.options.onStrokeEnd(this);
    }

    _changed() {
      if (this.options.onChange) this.options.onChange(this);
    }

    isEmpty() { return this.strokes.length === 0; }
    count() { return this.strokes.length; }
    canRedo() { return this.redoStack.length > 0; }

    strokeStats() {
      let points = 0;
      let length = 0;
      let soft = 0;
      let line = 0;
      let dot = 0;
      let eraser = 0;
      for (const s of this.strokes) {
        points += s.points.length;
        for (let i = 1; i < s.points.length; i++) {
          length += Math.hypot(s.points[i].x - s.points[i - 1].x, s.points[i].y - s.points[i - 1].y);
        }
        if (s.tool === "soft") soft++;
        else if (s.tool === "dot") dot++;
        else if (s.tool === "eraser") eraser++;
        else if (s.tool === "line") line++;
      }
      const avgSpeed = this.speedCount ? this.speedSum / this.speedCount : 0;
      const b = this.behavior;
      const active = b.strokes.reduce((n, s) => n + s.duration, 0) / 1000;
      const total = b.startedAt ? (performance.now() - b.startedAt) / 1000 : 0;
      const pauses = b.pauses;
      const longestPause = pauses.reduce((n, p) => Math.max(n, p.ms), 0) / 1000;
      const colorSwitches = b.colorHistory.length;
      const distinctColors = b.colorSet.size;
      const toolCount = b.toolSet.size;
      const strokeSpeed = b.strokes.length
        ? b.strokes.reduce((n, s) => n + s.avgSpeed, 0) / b.strokes.length
        : 0;
      const maxSpeed = b.strokes.reduce((n, s) => Math.max(n, s.maxSpeed), 0);

      return {
        strokes: this.strokes.length,
        points,
        length: Math.round(length),
        soft,
        line,
        dot,
        eraser,
        avgSpeed: +avgSpeed.toFixed(2),
        // 过程信号
        totalSec: +total.toFixed(1),
        activeSec: +active.toFixed(1),
        pauseCount: pauses.length,
        longestPauseSec: +longestPause.toFixed(1),
        undo: b.undo,
        redo: b.redo,
        clear: b.clear,
        colorSwitches,
        distinctColors,
        toolCount,
        strokeSpeed: +strokeSpeed.toFixed(3),
        maxSpeed: +maxSpeed.toFixed(3),
        pauses: pauses.slice(-8),
        strokeLog: b.strokes.slice(-40)
      };
    }

    /** 轻量实时估计，供 AI 陪伴引导使用 */
    liveStats() {
      const b = this.behavior;
      const now = performance.now();
      const elapsed = b.startedAt ? (now - b.startedAt) / 1000 : 0;
      let length = 0;
      let area = 0;
      let minX = W, maxX = 0, minY = H, maxY = 0;
      for (const s of this.strokes) {
        if (s.tool === "eraser") continue;
        const pts = s.points;
        let strokeLen = 0;
        for (let i = 1; i < pts.length; i++) {
          strokeLen += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        }
        length += strokeLen;
        area += strokeLen * s.size;
        for (const p of pts) {
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        }
      }
      const totalBrush = this.strokes.filter((s) => s.tool !== "eraser").length;
      const coverage = Math.min(1, area / (W * H));
      const bboxW = totalBrush ? maxX - minX : 0;
      const bboxH = totalBrush ? maxY - minY : 0;
      const idle = b.lastActionAt ? (now - b.lastActionAt) / 1000 : 0;
      return {
        elapsed: +elapsed.toFixed(1),
        strokes: totalBrush,
        coverage: +coverage.toFixed(3),
        bboxW: Math.round(bboxW),
        bboxH: Math.round(bboxH),
        canvasW: W,
        canvasH: H,
        idle: +idle.toFixed(1),
        distinctColors: b.colorSet.size,
        colorSwitches: b.colorHistory.length,
        erasers: this.strokes.filter((s) => s.tool === "eraser").length,
        undos: b.undo,
        clears: b.clear,
        pauses: b.pauses.length,
        recentColors: Array.from(b.colorSet),
        tool: this.tool,
        drawing: this.drawing
      };
    }

    setTool(tool) {
      if (tool !== this.tool) {
        this.behavior.toolHistory.push(tool);
        this.behavior.toolSet.add(tool);
        this.behavior.lastActionAt = performance.now();
      }
      this.tool = tool;
    }
    setColor(color) {
      if (color !== this.color) {
        // 只记录「换色」这个动作；是否真正用过某颜色，以落笔时的 colorSet 为准
        this.behavior.colorHistory.push(color);
        this.behavior.lastActionAt = performance.now();
        if (this.options.onColorChange) this.options.onColorChange(this);
      }
      this.color = color;
    }
    setSize(size) { this.size = size; }

    /** 返回带纸底与画作的合成画布 */
    composite(width) {
      const w = width || W;
      const h = Math.round((w / W) * H);
      const out = document.createElement("canvas");
      out.width = w;
      out.height = h;
      const c = out.getContext("2d");
      c.fillStyle = PAPER;
      c.fillRect(0, 0, w, h);
      c.drawImage(this.canvas, 0, 0, w, h);
      return out;
    }

    /** 方形、适合做图样底稿的合成画布 */
    compositeSquare(size, padRatio) {
      const s = size || 1024;
      const pad = s * (padRatio === undefined ? 0.08 : padRatio);
      const inner = s - pad * 2;
      const h = (inner / W) * H;
      const out = document.createElement("canvas");
      out.width = s;
      out.height = s;
      const c = out.getContext("2d");
      c.fillStyle = PAPER;
      c.fillRect(0, 0, s, s);
      const y = (s - h) / 2;
      c.drawImage(this.canvas, pad, y, inner, h);
      return out;
    }

    dataURL(width) {
      return this.composite(width || 480).toDataURL("image/jpeg", 0.86);
    }

    /** 透明背景的纯笔迹图，用于 AI 二创上的「原笔迹」叠层 */
    traceDataURL(width) {
      const w = width || 480;
      const h = Math.round((w / W) * H);
      const out = document.createElement("canvas");
      out.width = w;
      out.height = h;
      const ctx = out.getContext("2d");
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.scale(w / W, h / H);
      // 用独立上下文重放笔迹，不改动当前画布
      const mainCtx = this.ctx;
      const mainCanvas = this.canvas;
      this.ctx = ctx;
      this.canvas = out;
      for (const stroke of this.strokes) {
        this._drawStroke(stroke);
      }
      this.ctx = mainCtx;
      this.canvas = mainCanvas;
      ctx.restore();
      return out.toDataURL("image/png");
    }
  }

  window.PaintStudio = PaintStudio;
  window.PAINT_PALETTE = PALETTE;
})();
