/* =========================================================
   心绘非遗 · 体验流程编排
   ========================================================= */
(function () {
  "use strict";

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const state = {
    analysis: null,
    vision: null,
    report: null,
    craftStyle: "papercut",
    aiImageURL: "",
    aiBaseStyle: "",
    aiComposed: false,
    aiBlueprint: null,
    // 已生成过的二创稿按工艺缓存：切换工艺再切回来直接复用，
    // 不再重复调用图像模型（图像按张计费/占免费额度，是全流程最贵的一步）。
    craftCache: {},
    regulations: [],
    regulationIndex: 0,
    busy: false
  };

  let studio = null;
  let toastTimer = 0;

  /* ---------------- 基础 UI ---------------- */

  function toast(msg, ms) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), ms || 3000);
  }

  function scrollToEl(id) {
    const el = $(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 68;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  function setNoScroll(on) {
    document.body.classList.toggle("no-scroll", !!on);
  }

  function initHeader() {
    const header = $("#siteHeader");
    const bar = $("#progressBar");
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? (window.scrollY / max) * 100 : 0;
      bar.style.width = p.toFixed(2) + "%";
      header.classList.toggle("scrolled", window.scrollY > 12);
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  function initReveal() {
    if (!("IntersectionObserver" in window)) {
      $$(".reveal").forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    $$(".reveal").forEach((el) => io.observe(el));
  }

  /* ---------------- AI 实时陪伴 ---------------- */

  const companionState = { lastLocalAt: 0, lastAiAt: 0, seq: 0, hideTimer: 0, aiTimer: 0, lastSay: "" };

  const FALLBACK_HINTS = [
    { kind: "color", context: "画面颜色比较单一", say: "试试苔绿、落日橘或湖蓝，让画面多一点体温。", action: "换一种颜色" },
    { kind: "detail", context: "画面还比较空", say: "画一阵风、一朵云，或者一条小路来陪它。", action: "补一个元素" },
    { kind: "space", context: "主体偏小", say: "把最重要的那块画大一点，它会更有安全感。", action: "画大一点" },
    { kind: "pause", context: "用户停顿较久", say: "停在这里也可以，先呼吸三次，再落下一笔。", action: "先呼吸" },
    { kind: "encourage", context: "用户持续投入", say: "不用画得像，你已经把此刻放进去了。", action: "继续画" }
  ];

  /** 依据实时作画数据挑选一个温柔提醒；只做确定性规则判断 */
  function companionTrigger(s) {
    const changes = (s.undos || 0) + (s.erasers || 0) + (s.clears || 0);
    if (!s.strokes) {
      if (s.elapsed >= 16 && s.idle >= 6) {
        return { kind: "start", context: "用户还没有落笔", say: "不知道从哪开始？先画一条地平线就好。", action: "画一条线" };
      }
      return null;
    }
    if (s.pauses >= 2 && s.idle >= 6) {
      return { kind: "pause", context: "用户多次停顿，可能正在斟酌", say: "停一下也没关系，先看看已经画下的部分。", action: "退后看一眼" };
    }
    if (changes >= 3 && s.strokes >= 3) {
      return { kind: "pause", context: "用户反复撤销或擦除", say: "改过的痕迹也算数，不用画得完美。", action: "先不改了" };
    }
    if (s.distinctColors <= 1 && s.strokes >= 3) {
      return { kind: "color", context: "画面只使用了一种颜色", say: "只用一种颜色也没关系，试试加一点苔绿或落日橘。", action: "加一点颜色" };
    }
    if (s.coverage < 0.03 && s.strokes >= 2) {
      return { kind: "detail", context: "画面覆盖很少，显得空", say: "画面还空着，画一阵风或一朵云陪它吧。", action: "补一朵云" };
    }
    if (s.bboxW < 150 && s.bboxH < 110 && s.strokes >= 3) {
      return { kind: "space", context: "主体占画面比例偏小", say: "把最重要的那块画大一点，它会更有安全感。", action: "画大一点" };
    }
    if (s.coverage > 0.5) {
      return { kind: "space", context: "画面填得很满", say: "画面已经很满了，留一点白给自己呼吸。", action: "留一点白" };
    }
    if (s.elapsed >= 100 && s.strokes >= 8) {
      return { kind: "encourage", context: "用户持续投入作画", say: "你在这块地方待了很久，它一定很重要。", action: "继续待着" };
    }
    if (s.idle >= 24) {
      return { kind: "detail", context: "用户停笔较久，画面可能缺少元素", say: "要不要给它添一盏灯，或一个太阳？", action: "添一盏灯" };
    }
    return null;
  }

  function hideCompanion() {
    const el = $("#companion");
    if (!el || el.hidden) return;
    el.classList.remove("show");
    setTimeout(() => {
      if (!el.classList.contains("show")) el.hidden = true;
    }, 420);
  }

  function showCompanion(say, action) {
    const el = $("#companion");
    if (!el) return;
    $("#companionSay").textContent = action ? say + " · " + action : say;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add("show"));
    clearTimeout(companionState.hideTimer);
    companionState.hideTimer = setTimeout(hideCompanion, 22000);
  }

  function maybeCompanion(force) {
    if (!studio || state.busy) return;
    const stats = studio.liveStats();
    if (stats.drawing && !force) return;
    const now = Date.now();
    if (!force && now - companionState.lastLocalAt < 18000) return;
    if (!force && stats.idle < 4) return;

    let hint = companionTrigger(stats);
    if (force) {
      // 用户主动「换个提醒」时，避开刚刚说过的那一句
      if (!hint || hint.say === companionState.lastSay) {
        const pool = FALLBACK_HINTS.filter((h) => h.say !== companionState.lastSay);
        hint = pool[Math.floor(Math.random() * pool.length)] || hint;
      }
    }
    if (!hint) return;

    companionState.lastLocalAt = now;
    companionState.lastSay = hint.say;
    const id = ++companionState.seq;
    showCompanion(hint.say, hint.action);

    // AI 只负责把提醒说得更贴合此刻；限流到 3 分钟一次，失败就用本地话术
    if (window.XHFYAI && window.XHFYAI.getKey() && now - companionState.lastAiAt > 180000) {
      companionState.lastAiAt = now;
      clearTimeout(companionState.aiTimer);
      companionState.aiTimer = setTimeout(async () => {
        try {
          const r = await window.XHFYAI.companion(stats, hint.context);
          if (id === companionState.seq && !$("#companion").hidden) {
            showCompanion(r.say, r.action);
          }
        } catch (e) {}
      }, 500);
    }
  }

  function initCompanion() {
    const close = $("#companionClose");
    const more = $("#companionMore");
    if (close) close.addEventListener("click", hideCompanion);
    if (more) {
      more.addEventListener("click", () => {
        companionState.lastLocalAt = 0;
        companionState.seq++;
        maybeCompanion(true);
      });
    }
    const wrap = $("#canvasWrap");
    if (wrap) {
      wrap.addEventListener("pointerdown", (e) => {
        // 点气泡内的按钮不应触发「落笔即收起」
        if (e.target.closest && e.target.closest(".companion")) return;
        if (!$("#companion").hidden) setTimeout(hideCompanion, 1600);
      });
    }
    setInterval(() => maybeCompanion(false), 4000);
  }

  /* ---------------- 画笔 ---------------- */

  function initPaint() {
    const canvas = $("#paintCanvas");
    studio = new window.PaintStudio(canvas, {
      onFirstStroke: () => $("#canvasEmpty").classList.add("hide"),
      onChange: (s) => {
        $("#undoBtn").disabled = s.strokes.length === 0;
        $("#redoBtn").disabled = !s.canRedo();
        if (!s.strokes.length) $("#canvasEmpty").classList.remove("hide");
      },
      onStrokeEnd: () => {
        setTimeout(() => maybeCompanion(false), 1200);
      },
      onColorChange: () => {
        setTimeout(() => maybeCompanion(false), 1000);
      }
    });

    // 调色盘
    const palette = $("#palette");
    window.PAINT_PALETTE.forEach((p, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "color-swatch" + (i === 0 ? " active" : "");
      b.style.background = p.color;
      b.title = p.name;
      b.setAttribute("aria-label", "颜色：" + p.name);
      b.addEventListener("click", () => {
        studio.setColor(p.color);
        $$(".color-swatch").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
      });
      palette.appendChild(b);
    });

    // 工具
    $$(".tool").forEach((btn) => {
      btn.addEventListener("click", () => {
        studio.setTool(btn.dataset.tool);
        $$(".tool").forEach((x) => x.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    // 粗细
    const range = $("#sizeRange");
    const sizeLabel = $("#sizeLabel");
    range.addEventListener("input", () => {
      studio.setSize(+range.value);
      sizeLabel.textContent = range.value;
    });

    $("#undoBtn").addEventListener("click", () => studio.undo());
    $("#redoBtn").addEventListener("click", () => studio.redo());
    $("#clearBtn").addEventListener("click", () => {
      if (studio.isEmpty()) return;
      studio.clear();
      toast("画布已清空，可以重新开始");
    });

    $("#undoBtn").disabled = true;
    $("#redoBtn").disabled = true;

    // 文字
    const text = $("#moodText");
    const count = $("#charCount");
    text.addEventListener("input", () => {
      count.textContent = text.value.length + " / 200";
    });

    // 灵感提示
    $$("#hintChips button").forEach((b) => {
      b.addEventListener("click", () => {
        const val = b.textContent.trim();
        const map = {
          "一片海": "那里有一片海，风很轻，浪声一遍一遍地靠近又退回去。",
          "山间小屋": "山里有一间小屋，屋顶是旧的，窗里亮着一盏暖黄的灯。",
          "一棵树": "我在一棵很大的树下坐着，光从叶子里漏下来，落在地上。",
          "一扇窗": "我坐在一扇窗边，外面在下雨，玻璃上有一条一条的水痕。",
          "一片星空": "夜里有一整片星空，我躺在草地上，觉得自己变得很小。"
        };
        if (!text.value.trim()) {
          text.value = map[val] || "";
          count.textContent = text.value.length + " / 200";
          toast("已放入一句自述，也可以改成你自己的话");
        } else {
          toast("先看看你已经写下的那句话");
        }
        text.focus();
      });
    });

    $("#analyzeBtn").addEventListener("click", analyze);
    $("#redrawBtn").addEventListener("click", () => {
      scrollToEl("#step1");
      toast("慢慢改，改完再让 AI 读一次");
    });

    // 键盘撤销
    document.addEventListener("keydown", (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) studio.redo();
        else studio.undo();
      }
    });
  }

  /* ---------------- 分析流程 ---------------- */

  function resetLoading() {
    $("#analysisIdle").hidden = true;
    const loading = $("#analysisLoading");
    loading.hidden = false;
    loading.classList.remove("done");
    $("#analysisResult").hidden = true;
    $$("#loadingSteps li").forEach((li) => li.classList.remove("active", "done"));
    $("#loadingTitle").textContent = "AI 正在读你的笔触";
    $("#loadingNote").textContent = "第一次分析大约需要 10–30 秒，请保持呼吸。";
    $("#scanLayer").classList.add("on");
  }

  function setStage(name, cls) {
    const li = $('#loadingSteps li[data-stage="' + name + '"]');
    if (!li) return;
    li.classList.remove("active", "done");
    if (cls) li.classList.add(cls);
  }

  function finishLoading() {
    const loading = $("#analysisLoading");
    loading.classList.add("done");
    $("#scanLayer").classList.remove("on");
    setTimeout(() => { loading.hidden = true; }, 520);
  }

  function normalizeReport(ai, fallback) {
    const out = Object.assign({}, fallback, ai || {});
    const strKeys = ["title", "archetype", "summary", "colors", "lines", "space", "dynamics", "strength", "whisper", "process", "mood",
      "alternative", "confidence", "limitations"];
    strKeys.forEach((k) => {
      if (!out[k] || typeof out[k] !== "string") out[k] = fallback[k];
    });

    // 分析依据：AI 给的数组优先，缺失时退回本地证据链
    const ev = ai && ai.evidence;
    out.evidence = (Array.isArray(ev) && ev.length)
      ? ev.filter((x) => typeof x === "string" && x.trim()).slice(0, 6)
      : fallback.evidence;

    // FEATS 逐维阅读：维度与分数沿用本地实测，AI 只补「分数对应的证据说明」，
    // 这样维度名与分值不会被编造，同时保留 AI 的解读
    const localFeats = (fallback.feats || []);
    const aiFeats = (ai && Array.isArray(ai.feats)) ? ai.feats : [];
    out.feats = localFeats.map((f) => {
      const hit = aiFeats.find((x) => x && x.dim === f.dim && typeof x.note === "string");
      // AI 的解读在前，本地原始读数在后：可复核的数字不能被改写掉
      const note = (hit && hit.note ? hit.note + " ｜ " : "") + (f.note || "");
      return { dim: f.dim, score: f.score, note };
    });

    const ac = ai && ai.contradictions;
    out.contradictions = (Array.isArray(ac) && ac.length)
      ? ac.filter((x) => typeof x === "string" && x.trim()).slice(0, 3)
      : (fallback.contradictions || []);

    // 心象处方：AI 只从知识库 ID 中选，具体步骤始终由本地知识库给出
    const localRegs = (fallback.regulations || []).slice();
    const chosen = ai && ai.regulation && window.XHFYKnowledge.regulations.find((r) => r.id === ai.regulation.id);
    if (chosen) {
      const rest = localRegs.filter((r) => r.id !== chosen.id);
      localRegs.unshift({
        id: chosen.id,
        name: chosen.name,
        duration: chosen.duration,
        tag: chosen.tag,
        science: chosen.science,
        steps: chosen.steps.slice(),
        why: (ai.regulation && ai.regulation.why) || (rest[0] && rest[0].why) || ""
      });
    }
    out.regulations = localRegs.slice(0, 4);
    out.craft = Object.assign({}, fallback.craft, ai && ai.craft);
    if (!window.XHFYCraft.META[out.craft.style]) out.craft.style = fallback.craft.style;
    if (!out.craft.reason) out.craft.reason = fallback.craft.reason;
    if (!out.craft.elements) out.craft.elements = fallback.craft.elements;
    out.guide = Object.assign({}, fallback.guide, ai && ai.guide);
    if (!Array.isArray(out.guide.materials) || !out.guide.materials.length) out.guide.materials = fallback.guide.materials;
    if (!Array.isArray(out.guide.steps) || !out.guide.steps.length) out.guide.steps = fallback.guide.steps;
    if (!out.guide.mantra) out.guide.mantra = fallback.guide.mantra;
    if (!out.guide.intro) out.guide.intro = fallback.guide.intro;
    out.vision = Object.assign({}, fallback.vision, ai && ai.vision);
    return out;
  }

  async function analyze() {
    if (state.busy) return;
    if (studio.isEmpty()) {
      toast("先画几笔吧，哪怕只是一条线");
      scrollToEl("#step1");
      return;
    }
    const text = $("#moodText").value.trim();
    state.busy = true;
    $("#analyzeBtn").disabled = true;
    state.regulationIndex = 0;
    // 画面变了，此前缓存的各工艺二创稿与意象联想一并失效
    state.craftCache = {};
    if (window.XHFYAI) window.XHFYAI.resetPlanCache();
    resetAiArt();

    scrollToEl("#step2");
    resetLoading();

    await sleep(500);
    setStage("local", "active");
    let analysis;
    try {
      analysis = window.XHFYAnalyze(studio);
    } catch (e) {
      toast("画面分析失败，请重试");
      state.busy = false;
      $("#analyzeBtn").disabled = false;
      finishLoading();
      return;
    }
    state.analysis = analysis;
    await sleep(600);
    setStage("local", "done");

    // 视觉模型
    setStage("vision", "active");
    $("#loadingNote").textContent = "正在请智谱 GLM-4V 观察画面元素…";
    let vision = null;
    let aiVisionOK = false;
    try {
      const b64 = studio.dataURL(768).split(",")[1];
      vision = await window.XHFYAI.vision(b64, text, analysis);
      aiVisionOK = true;
      setStage("vision", "done");
    } catch (e) {
      setStage("vision", "done");
      $("#loadingNote").textContent = "云端视觉暂不可用，改用本地心象引擎继续…";
      await sleep(600);
    }
    state.vision = vision;

    // 图鉴
    setStage("report", "active");
    $("#loadingNote").textContent = aiVisionOK
      ? "正在把你的心象写成一封温柔的信…"
      : "正在用本地叙事引擎生成心灵图鉴…";
    const fallback = window.XHFYReport.makeFallbackReport(analysis, text, vision);
    let aiReport = null;
    try {
      aiReport = await window.XHFYAI.report(analysis, text, vision);
      setStage("report", "done");
    } catch (e) {
      setStage("report", "done");
      $("#loadingNote").textContent = "AI 叙事暂不可用，已切换本地心象引擎…";
      await sleep(500);
    }
    state.report = normalizeReport(aiReport, fallback);
    state.analysis.aiVision = aiVisionOK;
    state.analysis.aiReport = !!aiReport;
    state.analysis.userText = text;

    // 非遗：只保留 AI 二创，本地纹样已移除；工艺信息先就位，二创由用户主动生成
    setStage("craft", "done");
    const style = state.report.craft.style;
    state.craftStyle = style;
    selectCraftTab(style);
    updateCraftInfo(style);

    renderAnalysis();
    renderGuide();
    finishLoading();
    await sleep(600);
    $("#analysisResult").hidden = false;
    $("#analysisResult").scrollIntoView({ behavior: "smooth", block: "start" });

    if (!aiVisionOK && !aiReport) {
      toast("已使用本地心象引擎完成分析（AI 服务暂不可用）", 4200);
    } else if (!aiVisionOK) {
      toast("视觉模型暂不可用，图鉴由本地分析 + GLM-4 共同生成", 4000);
    } else if (!aiReport) {
      toast("图鉴叙事已使用本地模板，视觉观察来自 GLM-4V", 4000);
    }

    state.busy = false;
    $("#analyzeBtn").disabled = false;
  }

  function renderAnalysis() {
    const a = state.analysis;
    const r = state.report;
    const v = r.vision || {};
    const elements = (v.elements && v.elements.length) ? v.elements : [];

    $("#archetype").textContent = "「" + (r.archetype || r.title || "心里的那片岸") + "」";
    $("#summaryText").textContent = r.summary;
    $("#engineBadge").textContent = a.aiVision ? "智谱 GLM-4V" : "本地视觉引擎";
    $("#localBadge").textContent = a.aiVision ? "GLM-4 叙事" : "本地量化分析";

    const tags = [];
    elements.forEach((e) => tags.push(e));
    tags.push(a.colorStyle, a.lineStyle, a.spaceStyle);
    $("#elementTags").innerHTML = tags.slice(0, 8).map((t) => "<span>" + escapeHTML(t) + "</span>").join("");

    $("#colorStrip").innerHTML = (a.dominantColors || [])
      .map((c) => '<i style="background:' + c.hex + '" title="' + c.name + " " + c.hex + '"></i>')
      .join("");

    const notes = [];
    if (v.note) notes.push(v.note);
    if (v.scene) notes.push("画面：" + v.scene);
    notes.push("量化：覆盖 " + Math.round(a.metrics.coverage * 100) + "% · 暖色 " +
      Math.round(a.metrics.warmRatio * 100) + "% · 冷色 " + Math.round(a.metrics.coolRatio * 100) + "%");
    notes.push(a.aiVision ? "视觉观察由 GLM-4V 完成，量化指标由本地算法计算。" : "本次未取得云端视觉结果，已使用本地视觉算法。");
    $("#visionNote").textContent = notes.join(" · ");

    $("#radarWrap").innerHTML = window.XHFYReport.radarSVG(a.scores, { dark: true, size: 360 });
    $("#dimensionGrid").innerHTML = window.XHFYReport.dimensionHTML(a.scores);
    requestAnimationFrame(() => {
      $$("#dimensionGrid .dim-bar i").forEach((el) => {
        el.style.width = (el.dataset.score || 0) + "%";
      });
    });

    // 过程印记与当下心情
    const p = a.process || {};
    const b = a.behavior || {};
    $("#moodNow").textContent = r.mood;
    $("#processText").textContent = r.process;
    const chips = (b.tags || []).slice(0, 4).map((t) => "「" + t + "」");
    if (p.activeSec) chips.push("落笔 " + Math.round(p.activeSec) + " 秒");
    if (p.strokes) chips.push(p.strokes + " 笔");
    if (p.distinctColors) chips.push(p.distinctColors + " 种颜色");
    if (p.pauses) chips.push(p.pauses + " 次停顿");
    $("#processChips").innerHTML = chips.map((t) => "<span>" + escapeHTML(t) + "</span>").join("");
    $("#reportProcess").textContent = r.process;
    $("#reportProcessChips").innerHTML = (b.details || []).map((d) =>
      "<span><b>" + escapeHTML(d.label) + "</b>" + escapeHTML(d.hint) + "</span>").join("");
    $("#reportMood").textContent = r.mood;

    state.regulations = r.regulations || [];
    state.regulationIndex = 0;
    renderRegulation();

    $("#colorNarrative").textContent = r.colors;
    $("#lineNarrative").textContent = r.lines;
    $("#spaceNarrative").textContent = r.space;

    // 工艺信息
    const meta = window.XHFYCraft.META[state.craftStyle];
    const craftElements = (v.elements && v.elements.length) ? v.elements.join("、") : "心象轮廓、主色";
    $("#craftElements").textContent = craftElements;
    $("#craftGrammar").textContent = meta.grammar;
    $("#craftUse").textContent = meta.use;
    $("#craftNote").textContent = meta.note;
    $("#craftName").textContent = meta.name;
    $("#craftDesc").textContent = meta.desc;
    $("#craftBadge").textContent = meta.badge;
    $("#craftElements").textContent = r.craft.elements || craftElements;

    // 图鉴
    $("#reportArchetype").textContent = "「" + (r.archetype || r.title) + "」";
    $("#reportSummary").textContent = r.summary;
    $("#reportColor").textContent = r.colors;
    $("#reportLine").textContent = r.lines;
    $("#reportSpace").textContent = r.space;
    const dynEl = $("#reportDynamics");
    if (dynEl) dynEl.textContent = r.dynamics || "";
    $("#reportDate").textContent = window.XHFYReport.dateText();
    $("#reportNo").textContent = window.XHFYReport.reportNo();
    $("#reportDrawing").src = a.imageDataURL;
    $("#reportRadar").innerHTML = window.XHFYReport.radarSVG(a.scores, { dark: false, size: 280 });
    $("#reportPalette").innerHTML = (a.dominantColors || [])
      .map((c) => '<i style="background:' + c.hex + '" title="' + c.name + '"></i>').join("");
    $("#reportTags").innerHTML = tags.slice(0, 7).map((t) => "<span>" + escapeHTML(t) + "</span>").join("");
    $("#reportCraftReason").textContent = r.craft.reason;
    $("#reportCraftName").textContent = meta.name;
    $("#reportFacts").innerHTML = [
      ["工艺", meta.short],
      ["纹样语法", meta.grammar],
      ["适用", meta.use]
    ].map(([k, v2]) => "<div><dt>" + k + "</dt><dd>" + escapeHTML(v2) + "</dd></div>").join("");
    $("#reportGuideIntro").textContent = r.guide.intro;
    $("#reportGuideSteps").innerHTML = (r.guide.steps || []).map((s) =>
      "<li><strong>" + escapeHTML(s.title || "") + "</strong>" + escapeHTML(s.text || "") + "</li>").join("");
    $("#reportMantra").textContent = r.guide.mantra || "";

    // 分析依据与把握度
    const evEl = $("#reportEvidence");
    if (evEl) {
      evEl.innerHTML = (r.evidence || [])
        .map((t) => "<li>" + escapeHTML(t) + "</li>").join("");
    }
    const cfEl = $("#reportConfidence");
    if (cfEl) cfEl.textContent = r.confidence ? "把握度：" + r.confidence : "";

    // 形式元素读数（FEATS）与解读边界
    const featsEl = $("#reportFeats");
    if (featsEl) {
      featsEl.innerHTML = (r.feats || []).map((f) =>
        "<li><b>" + escapeHTML(f.dim || "") + "</b><i>" + f.score + "/5</i><em>" +
        escapeHTML(f.note || "") + "</em></li>").join("");
    }
    const caveatEl = $("#reportCaveat");
    if (caveatEl) {
      const cs = r.contradictions || [];
      caveatEl.innerHTML =
        (cs.length ? "<b>内部矛盾与权重</b>" + cs.map((t) => "<p>" + escapeHTML(t) + "</p>").join("") : "") +
        (r.limitations ? "<b>本次局限</b><p>" + escapeHTML(r.limitations) + "</p>" : "");
      caveatEl.hidden = !caveatEl.innerHTML;
    }

    const altEl = $("#reportAlternative");
    if (altEl) altEl.textContent = r.alternative || "";
  }

  function renderRegulation() {
    const list = state.regulations || [];
    if (!list.length) return;
    const idx = ((state.regulationIndex % list.length) + list.length) % list.length;
    const reg = list[idx];
    $("#regulationName").textContent = reg.name + (reg.duration ? " · " + reg.duration : "");
    $("#regulationWhy").textContent = reg.why || "";
    $("#regulationSteps").innerHTML = (reg.steps || []).map((s) => "<li>" + escapeHTML(s) + "</li>").join("");
    $("#regulationScience").textContent = reg.science ? "依据：" + reg.science : "";
    $("#regulationMore").hidden = list.length <= 1;

    $("#reportRegName").textContent = reg.name + (reg.duration ? " · " + reg.duration : "") +
      (reg.tag ? "（" + reg.tag + "）" : "");
    $("#reportRegWhy").textContent = reg.why || "";
    $("#reportRegSteps").innerHTML = (reg.steps || []).map((s) => "<li>" + escapeHTML(s) + "</li>").join("");
    $("#reportRegScience").textContent = reg.science ? "依据：" + reg.science : "";
  }

  function initAnalysisActions() {
    $("#regulationMore").addEventListener("click", () => {
      state.regulationIndex++;
      renderRegulation();
    });
  }

  function escapeHTML(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  /* ---------------- 非遗图样 ---------------- */

  function selectCraftTab(style) {
    $$(".craft-tab").forEach((b) => {
      const on = b.dataset.style === style;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function updateCraftInfo(style) {
    const meta = window.XHFYCraft.META[style];
    $("#craftName").textContent = meta.name;
    $("#craftDesc").textContent = meta.desc;
    $("#craftBadge").textContent = meta.badge;
    $("#craftGrammar").textContent = meta.grammar;
    $("#craftUse").textContent = meta.use;
    $("#craftNote").textContent = meta.note;
    if (state.report && state.report.craft && state.report.craft.elements) {
      $("#craftElements").textContent = state.report.craft.elements;
    }
  }

  function applyAiPattern(url) {
    const img = $("#aiCraftImg");
    const has = !!url;
    img.hidden = !has;
    $("#aiCraftEmpty").hidden = has;
    $("#aiArtMeta").hidden = !has;
    $("#aiArtDownload").hidden = !has;
    // 图样下载不依赖 AI：始终可用。没有 AI 二创稿时导出本地工艺图样。
    const dl = $("#downloadPattern");
    dl.hidden = false;
    dl.textContent = has ? "下载打印级图样 · 2048px" : "下载本地工艺图样 · 2048px";
    applyMockup(url || "");
  }

  /* ---- 工艺造型：以真实笔迹为骨架，生成各工艺的造型语言 ---- */

  const COMPOSE_SIZE = 1024;

  function mkCanvas(size) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    return c;
  }

  /**
   * 笔迹映射到正方形画布。留边与 PaintStudio.compositeSquare 一致（8% 留边），
   * 保证成品构图、主体位置与留白与原画完全对应。
   */
  function inkLayer(size) {
    const s = size || COMPOSE_SIZE;
    const pad = s * 0.08;
    const inner = s - pad * 2;
    const trace = studio.traceCanvas(s);
    const h = (inner / studio.canvas.width) * studio.canvas.height;
    const y = (s - h) / 2;
    const cv = mkCanvas(s);
    cv.getContext("2d").drawImage(trace, pad, y, inner, h);
    return cv;
  }


  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("纹样底图加载失败"));
      img.src = src;
    });
  }

  /**
   * AI 二创成品整幅呈现，再把用户原笔迹以低透明度叠回画面。
   * 笔迹在这里是「主骨架的可见证据」，不是裁切模具——
   * 纹样与留白交给模型完成，才有非遗手工的层次与密度。
   */
  async function composeCraftArt(textureURL) {
    const tex = await loadImage(await window.XHFYAI.imageToDataURL(textureURL));
    const s = COMPOSE_SIZE;
    const out = mkCanvas(s);
    const ctx = out.getContext("2d");

    // 只做轻微裁边，避开图像模型常见的边缘留白与角标
    const side = Math.min(tex.width, tex.height);
    const crop = side * 0.94;
    ctx.drawImage(tex, (tex.width - crop) / 2, (tex.height - crop) / 2, crop, crop, 0, 0, s, s);

    // 原笔迹叠回：multiply 保留骨架的走向与位置，又不破坏纹样的色彩层次
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(inkLayer(s), 0, 0);
    ctx.restore();

    return out.toDataURL("image/png");
  }

  /**
   * 笔迹骨架的兜底呈现：取图被跨域拦下时，直接把这个本地画布
   * 以 multiply 叠在成品图上，保证「原线条是主骨架」始终成立。
   */
  function paintInkOverlay() {
    const cv = $("#aiInkOverlay");
    if (!cv) return;
    cv.width = COMPOSE_SIZE;
    cv.height = COMPOSE_SIZE;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, COMPOSE_SIZE, COMPOSE_SIZE);
    ctx.drawImage(inkLayer(COMPOSE_SIZE), 0, 0);
  }

  function clearCssMask(img) {
    img.style.webkitMaskImage = "";
    img.style.maskImage = "";
  }

  /** 未生成时的提示语；换工艺或重画后要把上一轮的意象解读清掉 */
  const AI_NOTE_HINT = "生成后这里会写出 AI 读到的意象与工艺：它把你的线条当作主骨架，用祥云纹、缠枝纹、回字纹填满空白，再以该工艺的材质与光影成画。";

  /** 把当前已生成的二创稿按工艺存入缓存，供切回来时复用 */
  function cacheAiArt(style) {
    if (!style || !state.aiImageURL) return;
    state.craftCache[style] = {
      imageURL: state.aiImageURL,
      composed: state.aiComposed,
      blueprint: state.aiBlueprint
    };
  }

  /**
   * 从缓存恢复某个工艺的二创稿。
   * 命中就完全不碰网络——图像按张计费，这是全流程最贵的一步，
   * 用户在几个工艺之间来回切换欣赏时不应该反复出图。
   */
  function restoreAiArt(style) {
    const hit = style && state.craftCache[style];
    if (!hit) return false;
    const meta = window.XHFYCraft.META[style] || {};
    const bp = hit.blueprint || {};

    state.aiImageURL = hit.imageURL;
    state.aiComposed = hit.composed;
    state.aiBlueprint = hit.blueprint;
    state.aiBaseStyle = style;

    const img = $("#aiCraftImg");
    img.src = hit.imageURL;
    img.alt = "AI 二创 · " + (meta.short || style);
    clearCssMask(img);
    applyAiPattern(hit.imageURL);

    if (hit.composed) $("#aiInkOverlay").hidden = true;
    else { paintInkOverlay(); $("#aiInkOverlay").hidden = false; }

    $("#aiRedrawNote").textContent = bp.imagery
      ? window.XHFYAI.craftReadout(bp) : AI_NOTE_HINT;
    $("#aiArtTitle").textContent = "AI 二创 · " + (meta.short || style) +
      (bp.imagery ? " · " + bp.imagery : "");

    const dl = $("#aiArtDownload");
    dl.href = hit.imageURL;
    dl.download = "心绘非遗_AI二创_" + (meta.short || style) + ".png";
    dl.hidden = false;
    if (hit.composed) { dl.removeAttribute("target"); dl.removeAttribute("rel"); }
    else { dl.target = "_blank"; dl.rel = "noopener"; }
    return true;
  }

  function resetAiArt() {
    state.aiImageURL = "";
    state.aiBaseStyle = "";
    state.aiBlueprint = null;
    state.aiComposed = false;
    const img = $("#aiCraftImg");
    img.removeAttribute("src");
    clearCssMask(img);
    $("#aiInkOverlay").hidden = true;
    applyAiPattern("");
    $("#aiRedrawNote").textContent = AI_NOTE_HINT;
    $("#aiArtTitle").textContent = "AI 二创 · 保留原构图";
    const dl = $("#aiArtDownload");
    dl.removeAttribute("href");
    dl.hidden = true;
  }

  function setAiButtons(loading) {
    const label = loading ? "AI 二创中…" : "AI 二创当前工艺";
    const span = $("#aiRedraw").querySelector("span");
    if (span) span.textContent = label;
    else $("#aiRedraw").textContent = label;
    $("#aiRedraw").disabled = loading;
    $("#aiCraftEmptyBtn").disabled = loading;
  }

  async function generateAiCraft() {
    if (!state.analysis || !state.report) {
      toast("请先完成心象分析");
      scrollToEl("#step1");
      return;
    }
    if (studio.isEmpty()) {
      toast("先画几笔吧，AI 才有可以重绘的心象");
      scrollToEl("#step1");
      return;
    }
    if (state.busy) return;
    if (state.aiImageURL && state.aiBaseStyle === state.craftStyle) {
      toast("这一版 AI 二创已经生成");
      return;
    }

    state.busy = true;
    setAiButtons(true);
    const loader = $("#craftLoading");
    const loaderText = loader.querySelector("span");
    const style = state.craftStyle;
    const meta = window.XHFYCraft.META[style];
    loader.hidden = false;

    try {
      // 第一步：请 AI 读懂这笔涂鸦背后的潜意识，给出具象意象与工艺理由
      loaderText.textContent = "AI 正在读你线条里的意象…";
      const plan = await window.XHFYAI.craftPlan(state.analysis, state.report, style);
      const bp = window.XHFYAI.craftBlueprint(state.analysis, state.report, style, plan);
      state.aiBlueprint = bp;
      loaderText.textContent = "AI 读到的意象：" + bp.imagery + " · 正在以" + meta.short + "重构…";
      const url = await window.XHFYAI.craftRedraw(style, bp, state.analysis, state.report);

      // 成品整幅保留，原笔迹以低透明度叠回作为骨架证据
      loaderText.textContent = "正在把你的骨架叠回" + meta.short + "成品…";
      let composed = "";
      try {
        composed = await composeCraftArt(url);
      } catch (e) {
        console.warn("[心绘非遗] 二创合成失败", e && (e.message || e));
        composed = "";
      }

      state.aiImageURL = composed || url;
      state.aiComposed = !!composed;
      state.aiBaseStyle = style;
      cacheAiArt(style);

      const img = $("#aiCraftImg");
      img.src = state.aiImageURL;
      img.alt = "AI 二创 · " + meta.short;
      clearCssMask(img);
      applyAiPattern(state.aiImageURL);

      // 合成成功时骨架已烘进 PNG；取图失败时用本地画布叠回，主骨架不缺席
      if (composed) {
        $("#aiInkOverlay").hidden = true;
      } else {
        paintInkOverlay();
        $("#aiInkOverlay").hidden = false;
      }
      $("#aiRedrawNote").textContent = window.XHFYAI.craftReadout(bp);

      $("#aiArtTitle").textContent = "AI 二创 · " + meta.short + " · " + bp.imagery;
      const dl = $("#aiArtDownload");
      dl.href = state.aiImageURL;
      dl.download = "心绘非遗_AI二创_" + meta.short + ".png";
      dl.hidden = false;
      if (composed) {
        dl.removeAttribute("target");
        dl.removeAttribute("rel");
      } else {
        dl.target = "_blank";
        dl.rel = "noopener";
      }
      toast(composed
        ? "AI 二创完成：你的线条已成「" + bp.imagery + "」"
        : "AI 二创完成：你的线条已成「" + bp.imagery + "」，原笔迹已叠在画面上", 4200);
    } catch (e) {
      toast("AI 二创失败：" + e.message, 4800);
    } finally {
      loader.hidden = true;
      loaderText.textContent = "AI 正在重绘纹样…";
      setAiButtons(false);
      state.busy = false;
    }
  }

  function initCraftTabs() {
    $$(".craft-tab").forEach((b) => {
      b.addEventListener("click", () => {
        if (state.busy) return;
        const style = b.dataset.style;
        if (!style || style === state.craftStyle) return;
        state.craftStyle = style;
        selectCraftTab(style);
        // 换工艺：先把当前这版存进缓存，再尝试从缓存恢复目标工艺。
        // 命中缓存就零消耗地切回去，未命中才清空等待重新生成。
        if (state.aiBaseStyle && state.aiBaseStyle !== style && state.aiImageURL) {
          cacheAiArt(state.aiBaseStyle);
        }
        let cacheHit = "";
        if (state.aiBaseStyle !== style) {
          if (restoreAiArt(style)) {
            cacheHit = "已恢复此前生成的" + window.XHFYCraft.META[style].short + "（未重复出图）";
          } else {
            resetAiArt();
          }
        }
        updateCraftInfo(style);
        if (state.report && state.analysis) {
          const fb = window.XHFYReport.makeFallbackReport(state.analysis, state.analysis.userText || "", state.vision, style);
          // AI 写的手作指南只针对它推荐的工艺；换工艺后改用该工艺的本地指南
          if (state.report.guide && state.report.craft.style !== style) delete state.report.guide;
          state.report.craft.style = style;
          state.report.craft.reason = fb.craft.reason;
          state.report.craft.elements = fb.craft.elements;
          $("#reportCraftReason").textContent = fb.craft.reason;
          $("#reportCraftName").textContent = window.XHFYCraft.META[style].name;
          $("#craftElements").textContent = fb.craft.elements;
          renderGuide();
        }
        toast(cacheHit ||
          ("已切换到" + window.XHFYCraft.META[style].short + "，点击「AI 二创当前工艺」生成"));
      });
    });

    $("#downloadPattern").addEventListener("click", () => downloadPattern(false));
    $("#downloadReportPattern").addEventListener("click", () => downloadPattern(true));

    $("#aiRedraw").addEventListener("click", generateAiCraft);
    $("#aiCraftEmptyBtn").addEventListener("click", generateAiCraft);

    $("#toCraftBtn").addEventListener("click", () => scrollToEl("#step3"));
    $("#toGuide").addEventListener("click", () => scrollToEl("#step4"));
  }

  /* ---------------- 图样导出（打印级） ---------------- */

  // 印制实物（帆布袋 / 剪纸底稿 / 掐丝珐琅描稿）需要更大的像素，1024 只够屏幕看
  const PRINT_SIZE = 2048;

  function triggerDownload(href, filename, openInNewTab) {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    if (openInNewTab) {
      a.target = "_blank";
      a.rel = "noopener";
    }
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /**
   * 本地工艺图样：完全不依赖 AI。
   * 策划书把「一键下载非遗图样」列为硬要求——AI 额度耗尽或断网时也必须拿得到成品，
   * 所以这里直接用本地转译引擎渲染：笔迹骨架与各工艺纹样都在，且是原分辨率渲染不是放大。
   */
  function localPatternURL(size) {
    const s = size || PRINT_SIZE;
    const style = state.aiBaseStyle || state.craftStyle || "papercut";
    const cv = window.XHFYCraft.render(style, studio, s);
    return cv.toDataURL("image/png");
  }

  /** 把已合成的成品放大到打印尺寸，满足送印的像素要求 */
  function upscaleDataURL(dataURL, target) {
    return loadImage(dataURL).then((img) => {
      const cv = mkCanvas(target);
      const ctx = cv.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, target, target);
      return cv.toDataURL("image/png");
    });
  }

  /**
   * 图样下载（三条路径，保证任何情况下都可用）：
   * ① 有 AI 二创稿且已合成 → 放大到 2048px 导出；
   * ② 有 AI 图但未合成（跨域取图失败）→ 打开原图另存；
   * ③ 完全没有 AI 二创稿 → 用本地引擎渲染打印级图样。
   */
  async function downloadPattern() {
    const meta = window.XHFYCraft.META[state.aiBaseStyle || state.craftStyle] || window.XHFYCraft.META.papercut;
    if (!studio) {
      toast("先画一幅画，再下载图样");
      scrollToEl("#step1");
      return;
    }

    if (state.aiImageURL && state.aiComposed) {
      try {
        const url = await upscaleDataURL(state.aiImageURL, PRINT_SIZE);
        triggerDownload(url, "心绘非遗_AI二创_" + meta.short + "_" + PRINT_SIZE + ".png");
        toast("AI 二创稿已下载（" + PRINT_SIZE + "px，可直接送印）", 3200);
      } catch (e) {
        console.warn("[心绘非遗] 高清导出失败，回退 1024px", e && (e.message || e));
        triggerDownload(state.aiImageURL, "心绘非遗_AI二创_" + meta.short + ".png");
        toast("高清导出未完成，已下载 1024px 版本", 3000);
      }
      return;
    }

    if (state.aiImageURL) {
      // 底图源站不带 CORS 头，无法合成时只能打开原图另存
      triggerDownload(state.aiImageURL, "心绘非遗_AI二创_" + meta.short + ".png", true);
      toast("已打开纹样原图，可右键保存", 3200);
      return;
    }

    try {
      const url = localPatternURL(PRINT_SIZE);
      triggerDownload(url, "心绘非遗_图样_" + meta.short + "_" + PRINT_SIZE + ".png");
      toast("已下载打印级图样（" + PRINT_SIZE + "px，可印帆布袋或作剪纸底稿）", 3600);
    } catch (e) {
      console.warn("[心绘非遗] 本地图样导出失败", e && (e.message || e));
      toast("图样导出失败，请重试", 3000);
    }
  }

  /* ---------------- 手作指南 ---------------- */

  function renderGuide() {
    if (!state.report) return;
    const style = state.craftStyle;
    const guide = window.XHFYReport.makeGuide(style, state.report);
    const meta = window.XHFYCraft.META[style];

    $("#guideCraft").textContent = meta.short;
    $("#guideTitle").textContent = "《心愈手作指南》· " + meta.short;
    $("#guideIntro").textContent = guide.intro;
    $("#guideMaterials").innerHTML = (guide.materials || []).map((m) => "<li>" + escapeHTML(m) + "</li>").join("");
    $("#guideSteps").innerHTML = (guide.steps || []).map((s) =>
      "<li><strong>" + escapeHTML(s.title || "") + "</strong><p>" + escapeHTML(s.text || "") + "</p></li>").join("");
    $("#guideMantra").textContent = guide.mantra || "";

    if (state.aiImageURL) applyMockup(state.aiImageURL);
  }

  function applyMockup(url) {
    const tote = $("#totePattern");
    if (!tote) return;
    if (!url) {
      tote.style.backgroundImage = "";
      return;
    }
    tote.style.backgroundImage = "url(" + url + ")";
    tote.style.backgroundSize = "78%";
    tote.style.backgroundRepeat = "no-repeat";
    tote.style.backgroundPosition = "center";
  }

  function initMockup() {
    $$("#mockupSwitch button").forEach((b) => {
      b.addEventListener("click", () => {
        $$("#mockupSwitch button").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        const tote = $(".tote");
        tote.classList.remove("mode-frame", "mode-card");
        if (b.dataset.mock === "frame") tote.classList.add("mode-frame");
        if (b.dataset.mock === "card") tote.classList.add("mode-card");
        if (b.dataset.mock === "tote") tote.classList.remove("mode-frame", "mode-card");
      });
    });
  }

  function guideText() {
    if (!state.report) return "";
    const meta = window.XHFYCraft.META[state.craftStyle];
    const g = window.XHFYReport.makeGuide(state.craftStyle, state.report);
    const lines = [];
    lines.push("心绘非遗 · 心愈手作指南");
    lines.push("工艺：" + meta.name);
    lines.push("图鉴：" + (state.report.archetype || ""));
    lines.push("");
    lines.push("【为什么是这件手作】");
    lines.push(state.report.craft.reason || meta.desc);
    lines.push("");
    lines.push("【准备材料】");
    (g.materials || []).forEach((m, i) => lines.push((i + 1) + ". " + m));
    lines.push("");
    lines.push("【手作步骤】");
    (g.steps || []).forEach((s, i) => {
      lines.push((i + 1) + ". " + (s.title || ""));
      lines.push("   " + (s.text || ""));
    });
    lines.push("");
    lines.push("【正念引导语】");
    lines.push(g.mantra || "");
    lines.push("");
    lines.push("【给自己的话】");
    lines.push(state.report.whisper || "");
    lines.push("");
    lines.push("—— 心绘非遗 · 让心象被看见，也被触摸");
    return lines.join("\n");
  }

  function downloadText(name, content) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  function initGuide() {
    $("#downloadGuide").addEventListener("click", () => {
      if (!state.report) return toast("请先完成心象分析");
      downloadText("心愈手作指南_" + window.XHFYCraft.META[state.craftStyle].short + ".txt", guideText());
      toast("指南已下载");
    });
    $("#printGuide").addEventListener("click", () => {
      if (!state.report) return toast("请先完成心象分析");
      openReport();
    });
  }

  /* ---------------- 图鉴 ---------------- */

  async function openReport() {
    if (!state.report) {
      toast("先完成一幅心象，才有属于你的图鉴");
      scrollToEl("#step1");
      return;
    }
    // 报告中的图样只使用 AI 二创稿（还没有生成时整块留空）
    const fig = $("#reportPattern").closest("figure");
    if (state.aiImageURL) {
      $("#reportPattern").src = state.aiImageURL;
      clearCssMask($("#reportPattern"));
    }
    if (fig) fig.hidden = !state.aiImageURL;
    $("#reportOverlay").hidden = false;
    setNoScroll(true);
    $("#reportOverlay").scrollTop = 0;
  }

  function closeReport() {
    $("#reportOverlay").hidden = true;
    setNoScroll(false);
  }

  function initReport() {
    ["#openReportBtn", "#openReportBtn2", "#openReportBtn3"].forEach((id) => {
      const el = $(id);
      if (el) el.addEventListener("click", openReport);
    });
    $("#closeReport").addEventListener("click", closeReport);
    $("#printReport").addEventListener("click", () => {
      document.body.classList.remove("no-scroll");
      setTimeout(() => {
        window.print();
        setTimeout(() => setNoScroll(true), 300);
      }, 80);
    });
    $("#reportOverlay").addEventListener("click", (e) => {
      if (e.target === $("#reportOverlay")) closeReport();
    });
  }

  /* ---------------- AI 设置 ---------------- */

  function initSettings() {
    const modal = $("#aiModal");
    const input = $("#apiKeyInput");
    const status = $("#aiStatus");

    /* ---- 分析深度档位：默认走免费模型，全流程零余额消耗 ---- */
    // 说明里的耗时与费用为实测值（同一幅画、同一套提示词）
    const TIER_HINT = {
      lite: "均衡档走免费模型（GLM-4-Flash），视觉、图鉴、意象、出图全部免费，全流程不消耗余额；图鉴约需 50 秒。图鉴质量的大头来自知识库与解读纪律，换旗舰模型带来的是文笔增益，不是证据增益。",
      pro: "深度档调用付费的 GLM-4-Plus（¥5/百万输入 + ¥15/百万输出，实测单次约 ¥0.07），并加载完整知识库，图鉴约 25 秒、措辞更细腻。适合要打印出来带去答辩的样本。"
    };

    function syncTier() {
      const tier = window.XHFYAI.getReportTier();
      $$(".tier-opt").forEach((b) => {
        b.setAttribute("aria-checked", b.dataset.tier === tier ? "true" : "false");
      });
      $("#tierHint").textContent = TIER_HINT[tier] || "";
    }

    $$(".tier-opt").forEach((b) => {
      b.addEventListener("click", () => {
        const tier = window.XHFYAI.setReportTier(b.dataset.tier);
        syncTier();
        toast(tier === "pro"
          ? "已切到深度档：下一次生成图鉴会调用付费模型"
          : "已切到均衡档：全流程免费模型，不消耗余额");
      });
    });

    /* ---- 用量面板 ---- */
    function syncUsage() {
      const u = window.XHFYAI.usage();
      const rows = [
        ["uVision", "vision"],
        ["uText", "text"],
        ["uImage", "image"]
      ];
      rows.forEach(([elId, kind]) => {
        const q = u.quota[kind];
        const used = u.day[kind] || 0;
        const el = $("#" + elId);
        if (!el) return;
        el.textContent = used + " / " + q.day;
        el.className = used >= q.day * 0.8 ? "warn" : "";
      });
      const tk = window.XHFYAI.tokenStat;
      const total = tk.prompt + tk.completion;
      const tkEl = $("#uToken");
      if (tkEl) {
        tkEl.textContent = tk.calls
          ? total.toLocaleString() + "（" + tk.calls + " 次调用）"
          : "0";
      }
      if (u.tripped) {
        status.textContent = "状态：已暂停 · " + u.tripped;
        status.className = "modal-status err";
      }
    }

    const open = () => {
      modal.hidden = false;
      setNoScroll(true);
      input.value = "";
      input.placeholder = window.XHFYAI.hasCustomKey() ? "已保存自定义 Key（留空则不修改）" : "使用项目内置 Key，可粘贴自己的 Key";
      status.textContent = "状态：使用" + (window.XHFYAI.hasCustomKey() ? "自定义 Key" : "项目内置 Key");
      status.className = "modal-status";
      syncTier();
      syncUsage();
    };
    const close = () => {
      modal.hidden = true;
      setNoScroll(false);
    };

    $("#aiSettingsBtn").addEventListener("click", open);
    $("#closeAiModal").addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

    $("#saveKey").addEventListener("click", async () => {
      const key = input.value.trim();
      if (!key) {
        toast("请先粘贴一个 API Key");
        return;
      }
      status.textContent = "状态：正在测试…";
      status.className = "modal-status";
      $("#saveKey").disabled = true;
      try {
        window.XHFYAI.setKey(key);
        const reply = await window.XHFYAI.test();
        status.textContent = "状态：连接成功（" + reply + "）";
        status.className = "modal-status ok";
        toast("智谱 AI 已连接");
        setTimeout(close, 900);
      } catch (e) {
        window.XHFYAI.setKey("");
        status.textContent = "状态：连接失败 · " + e.message;
        status.className = "modal-status err";
      }
      $("#saveKey").disabled = false;
    });

    $("#resetKey").addEventListener("click", () => {
      window.XHFYAI.setKey("");
      status.textContent = "状态：已恢复项目内置 Key";
      status.className = "modal-status ok";
      input.value = "";
      toast("已恢复默认 Key");
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!modal.hidden) close();
      else if (!$("#reportOverlay").hidden) closeReport();
    });

    syncTier();
  }

  /* ---------------- 启动 ---------------- */

  function init() {
    initHeader();
    initReveal();
    initPaint();
    initCraftTabs();
    initGuide();
    initMockup();
    initReport();
    initCompanion();
    initAnalysisActions();
    initSettings();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
