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
    const strKeys = ["title", "archetype", "summary", "colors", "lines", "space", "strength", "whisper", "process", "mood",
      "alternative", "confidence"];
    strKeys.forEach((k) => {
      if (!out[k] || typeof out[k] !== "string") out[k] = fallback[k];
    });

    // 分析依据：AI 给的数组优先，缺失时退回本地证据链
    const ev = ai && ai.evidence;
    out.evidence = (Array.isArray(ev) && ev.length)
      ? ev.filter((x) => typeof x === "string" && x.trim()).slice(0, 6)
      : fallback.evidence;

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
    $("#aiRedrawNote").hidden = has;
    $("#downloadPattern").hidden = !has;
    applyMockup(url || "");
  }

  /* ---- AI 材质 + 真实笔迹裁切 ---- */

  const COMPOSE_SIZE = 1024;

  /**
   * 用用户真实笔迹生成裁切蒙版。
   * 留边映射与 PaintStudio.compositeSquare 一致（8% 留边），
   * 再沿八个方向偏移绘制一次，把细线膨胀成有宽度的纹样带。
   */
  function strokeMaskCanvas(size) {
    const s = size || COMPOSE_SIZE;
    const pad = s * 0.08;
    const inner = s - pad * 2;
    const trace = studio.traceCanvas(s);
    const h = (inner / studio.canvas.width) * studio.canvas.height;
    const y = (s - h) / 2;
    const mask = document.createElement("canvas");
    mask.width = s;
    mask.height = s;
    const ctx = mask.getContext("2d");
    const d = Math.max(6, s * 0.008);
    const dirs = [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, -d], [d, -d], [-d, d]];
    dirs.forEach(([dx, dy]) => ctx.drawImage(trace, pad + dx, y + dy, inner, h));
    return mask;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("纹样底图加载失败"));
      img.src = src;
    });
  }

  /** 把满版纹样材质按笔迹形状裁切；返回透明底 PNG dataURL */
  async function composeAiPattern(textureURL) {
    const dataURL = await window.XHFYAI.imageToDataURL(textureURL);
    const tex = await loadImage(dataURL);
    const s = COMPOSE_SIZE;
    const side = Math.min(tex.width, tex.height);
    // 取中心 82%，避开模型常见的边缘留白与右下角角标
    const crop = side * 0.82;
    const sx = (tex.width - crop) / 2;
    const sy = (tex.height - crop) / 2;
    const out = document.createElement("canvas");
    out.width = s;
    out.height = s;
    const ctx = out.getContext("2d");
    ctx.drawImage(tex, sx, sy, crop, crop, 0, 0, s, s);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(strokeMaskCanvas(s), 0, 0);
    return out.toDataURL("image/png");
  }

  /** 无法把底图读进 canvas 时，用 CSS 蒙版达到同样的裁切效果（不可下载合成图） */
  function applyCssMask(img) {
    const maskURL = strokeMaskCanvas(COMPOSE_SIZE).toDataURL("image/png");
    img.style.webkitMaskImage = "url(" + maskURL + ")";
    img.style.maskImage = "url(" + maskURL + ")";
    img.style.webkitMaskSize = "100% 100%";
    img.style.maskSize = "100% 100%";
    img.style.webkitMaskRepeat = "no-repeat";
    img.style.maskRepeat = "no-repeat";
  }

  function clearCssMask(img) {
    img.style.webkitMaskImage = "";
    img.style.maskImage = "";
  }

  function resetAiArt() {
    state.aiImageURL = "";
    state.aiBaseStyle = "";
    state.aiBlueprint = null;
    state.aiComposed = false;
    const img = $("#aiCraftImg");
    img.removeAttribute("src");
    clearCssMask(img);
    applyAiPattern("");
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
      // 蓝图现在是本地同步构建（不消耗 AI token），直接进入材质生成
      const bp = window.XHFYAI.craftBlueprint(state.analysis, state.report, style);
      state.aiBlueprint = bp;
      loaderText.textContent = "AI 正在生成" + meta.short + "纹样材质…";
      const url = await window.XHFYAI.craftRedraw(style, bp, state.analysis, state.report);

      // 构图不交给模型：用用户真实笔迹做裁切蒙版
      loaderText.textContent = "正在按你的笔迹裁切" + meta.short + "纹样…";
      let composed = "";
      try {
        composed = await composeAiPattern(url);
      } catch (e) {
        composed = "";
      }

      state.aiImageURL = composed || url;
      state.aiComposed = !!composed;
      state.aiBaseStyle = style;

      const img = $("#aiCraftImg");
      img.src = state.aiImageURL;
      img.alt = "AI 二创 · " + meta.short;
      if (composed) clearCssMask(img);
      else applyCssMask(img);
      applyAiPattern(state.aiImageURL);

      $("#aiArtTitle").textContent = "AI 二创 · " + meta.short + (bp.title ? " · " + bp.title : "");
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
        ? "AI 二创完成：纹样材质已按你的笔迹裁切"
        : "AI 二创完成：纹样材质已按你的笔迹显示（无法导出合成图）", 4200);
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
        if (style === state.craftStyle) return;
        state.craftStyle = style;
        selectCraftTab(style);
        // 换工艺后，之前的 AI 二创稿不再对应当前工艺，清空等待重新生成
        if (state.aiImageURL && state.aiBaseStyle !== style) resetAiArt();
        updateCraftInfo(style);
        if (state.report && state.analysis) {
          const fb = window.XHFYReport.makeFallbackReport(state.analysis, state.analysis.userText || "", state.vision);
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
        toast("已切换到" + window.XHFYCraft.META[style].short + "，点击「AI 二创当前工艺」生成");
      });
    });

    $("#downloadPattern").addEventListener("click", () => downloadPattern(false));
    $("#downloadReportPattern").addEventListener("click", () => downloadPattern(true));

    $("#aiRedraw").addEventListener("click", generateAiCraft);
    $("#aiCraftEmptyBtn").addEventListener("click", generateAiCraft);

    $("#toCraftBtn").addEventListener("click", () => scrollToEl("#step3"));
    $("#toGuide").addEventListener("click", () => scrollToEl("#step4"));
  }

  async function downloadPattern() {
    if (!state.aiImageURL) {
      toast("先生成 AI 二创稿，再下载");
      scrollToEl("#step3");
      return;
    }
    const meta = window.XHFYCraft.META[state.aiBaseStyle || state.craftStyle];
    const a = document.createElement("a");
    a.href = state.aiImageURL;
    a.download = "心绘非遗_AI二创_" + meta.short + ".png";
    if (!state.aiComposed) {
      // 底图源站不带 CORS 头，无法合成时只能打开原图另存
      a.target = "_blank";
      a.rel = "noopener";
    }
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast(state.aiComposed ? "AI 二创稿已下载" : "已打开纹样原图，可右键保存", 3200);
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
      if (state.aiComposed) clearCssMask($("#reportPattern"));
      else applyCssMask($("#reportPattern"));
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

    const open = () => {
      modal.hidden = false;
      setNoScroll(true);
      input.value = "";
      input.placeholder = window.XHFYAI.hasCustomKey() ? "已保存自定义 Key（留空则不修改）" : "使用项目内置 Key，可粘贴自己的 Key";
      status.textContent = "状态：使用" + (window.XHFYAI.hasCustomKey() ? "自定义 Key" : "项目内置 Key");
      status.className = "modal-status";
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
