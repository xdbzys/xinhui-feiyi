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
    $("#aiRedrawNote").hidden = has;
    $("#downloadPattern").hidden = !has;
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

  /**
   * 沿轮廓做「扇贝式」膨胀：按角度交替取半径，一次成形。
   * 这一步把细线变成有宽度的手工纸带，并在边缘留下近似锯齿纹/月牙边的起伏，
   * 而不是把线原样加粗——这是与「笔迹贴图」最大的区别。
   */
  function scallopDilate(ctx, src, base) {
    const steps = 60;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const r = i % 2 ? base * 0.40 : base;
      ctx.drawImage(src, Math.cos(a) * r, Math.sin(a) * r);
    }
  }

  /** 预先渲染的镂空单元：月牙纹、朵花纹、圆点纹 */
  const HOLE_SPRITES = {};
  function holeSprite(kind, r) {
    const key = kind + "|" + Math.round(r);
    if (HOLE_SPRITES[key]) return HOLE_SPRITES[key];
    const s = Math.ceil(r * 4);
    const c = mkCanvas(s);
    const x = c.getContext("2d");
    x.fillStyle = "#fff";
    if (kind === "crescent") {
      x.beginPath();
      x.arc(s / 2, s / 2, r, 0, Math.PI * 2);
      x.fill();
      x.globalCompositeOperation = "destination-out";
      x.beginPath();
      x.arc(s / 2 + r * 0.68, s / 2, r * 0.95, 0, Math.PI * 2);
      x.fill();
    } else if (kind === "petal") {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        x.beginPath();
        x.ellipse(s / 2 + Math.cos(a) * r * 0.42, s / 2 + Math.sin(a) * r * 0.42, r * 0.40, r * 0.20, a, 0, Math.PI * 2);
        x.fill();
      }
    } else {
      x.beginPath();
      x.arc(s / 2, s / 2, r, 0, Math.PI * 2);
      x.fill();
    }
    HOLE_SPRITES[key] = c;
    return c;
  }

  /** 在剪影内部按纹理格律镂空——剪纸的本质是「镂空」而非填色 */
  function carveHoles(ctx, s, spacing, style) {
    const data = ctx.getImageData(0, 0, s, s).data;
    let r = s * 0.0115;
    let kinds = ["crescent", "crescent", "dot"];
    if (style === "calico") { r = s * 0.010; kinds = ["petal", "dot", "petal"]; }
    else if (style === "shadow") { r = s * 0.009; kinds = ["dot", "crescent", "dot"]; }
    else if (style === "embroidery") { r = s * 0.007; kinds = ["dot", "dot", "petal"]; }
    let n = 0;
    for (let y = spacing * 0.55; y < s; y += spacing) {
      for (let x = spacing * 0.55; x < s; x += spacing) {
        const jx = x + (n % 2 ? spacing * 0.3 : 0);
        const jy = y + (n % 3 === 0 ? spacing * 0.16 : 0);
        if (jx < 1 || jy < 1 || jx >= s - 1 || jy >= s - 1) continue;
        if (data[(Math.floor(jy) * s + Math.floor(jx)) * 4 + 3] < 210) continue;
        const sp = holeSprite(kinds[n % kinds.length], r);
        ctx.globalCompositeOperation = "destination-out";
        ctx.drawImage(sp, jx - sp.width / 2, jy - sp.height / 2);
        n++;
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  /** 冰裂纹 / 经纬编织的空隙：细线镂空，模拟防染裂纹与竹篾间隙 */
  function carveLines(ctx, s, style) {
    ctx.globalCompositeOperation = "destination-out";
    if (style === "tiedye") {
      ctx.strokeStyle = "rgba(0,0,0,0.75)";
      ctx.lineWidth = Math.max(1, s * 0.0022);
      for (let i = 0; i < 46; i++) {
        const a = (i / 46) * Math.PI * 2;
        const r0 = s * (0.06 + (i % 7) * 0.012);
        ctx.beginPath();
        ctx.moveTo(s / 2 + Math.cos(a) * r0, s / 2 + Math.sin(a) * r0);
        for (let t = r0; t < s * 0.62; t += s * 0.03) {
          const jitter = Math.sin(t * 0.09 + i) * s * 0.012;
          ctx.lineTo(s / 2 + Math.cos(a + jitter / s) * t, s / 2 + Math.sin(a + jitter / s) * t);
        }
        ctx.stroke();
      }
    } else if (style === "bamboo") {
      ctx.strokeStyle = "rgba(0,0,0,0.8)";
      ctx.lineWidth = Math.max(1, s * 0.003);
      const gap = s * 0.028;
      for (let i = -s; i < s * 2; i += gap) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + s, s);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(i, s);
        ctx.lineTo(i + s, 0);
        ctx.stroke();
      }
    } else if (style === "calico") {
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = Math.max(1, s * 0.0018);
      for (let i = 0; i < 60; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * s * 0.09, y + (Math.random() - 0.5) * s * 0.09);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  /** 各工艺的造型蒙版：形状来自笔迹，语言来自工艺 */
  function craftMaskCanvas(size, style) {
    const s = size || COMPOSE_SIZE;
    const ink = inkLayer(s);
    const mask = mkCanvas(s);
    const ctx = mask.getContext("2d");
    const st = style || "papercut";
    if (st === "tiedye") {
      ctx.filter = "blur(" + Math.round(s * 0.007) + "px)";
      scallopDilate(ctx, ink, s * 0.010);
      ctx.filter = "none";
      carveLines(ctx, s, "tiedye");
    } else if (st === "bamboo") {
      scallopDilate(ctx, ink, s * 0.014);
      carveLines(ctx, s, "bamboo");
    } else if (st === "shadow") {
      // 皮影：剪影偏薄，镂雕小开口透影
      scallopDilate(ctx, ink, s * 0.013);
      carveHoles(ctx, s, s * 0.065, "shadow");
    } else if (st === "embroidery") {
      // 刺绣：轮廓略膨胀，内部用细小针孔模拟透气
      scallopDilate(ctx, ink, s * 0.015);
      carveHoles(ctx, s, s * 0.04, "embroidery");
    } else {
      scallopDilate(ctx, ink, s * 0.017);
      carveHoles(ctx, s, s * 0.055, st);
      if (st === "calico") carveLines(ctx, s, "calico");
    }
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

  /** 各工艺的「纸色」：剪纸取用户自己的暖色主色，其余按工艺固有色 */
  function paperColor(style, analysis) {
    if (style === "tiedye" || style === "calico") return "#22456B";
    if (style === "bamboo") return "#8A6A3B";
    if (style === "shadow") return "#7A2E1E";
    if (style === "embroidery") {
      const dc = (analysis && analysis.dominantColors) || [];
      return (dc[0] && dc[0].hex) || "#B23A48";
    }
    const dc = (analysis && analysis.dominantColors) || [];
    const warm = dc.find((c) => /红|橙|朱|赭|黄|暖|绯|丹|落日/.test(c.name || ""));
    return (warm && warm.hex) || "#A63A2B";
  }

  /**
   * 由画面结构派生的纹样层：收边框、团花、角花，全部是实心纸型并带镂空。
   * 位置与尺度取自画面的重心与包围盒，所以与用户的画对得上；
   * 但它是「纸」而不是「描线」——这正是上一版被指太草率的根因。
   */
  function ornamentCanvas(s, style, plan) {
    const a = state.analysis || {};
    const m = a.metrics || {};
    const p = plan || {};
    const paper = paperColor(style, a);
    const cx = Math.min(0.82, Math.max(0.18, (m.centroid && m.centroid.x) || 0.5)) * s;
    const cy = Math.min(0.82, Math.max(0.18, (m.centroid && m.centroid.y) || 0.5)) * s;
    const R = s * (0.15 + Math.min(0.15, (m.bboxRatio || 0.2) * 0.5));

    const o = mkCanvas(s);
    const c = o.getContext("2d");
    c.fillStyle = paper;
    c.globalAlpha = style === "tiedye" ? 0.78 : 1;

    // ---- 收边框：一圈有一定宽度的纸边，剪纸上最常见的「拐子纹」位置 ----
    const a0 = s * 0.030;
    const band = s * 0.046;
    c.fillRect(a0, a0, s - a0 * 2, s - a0 * 2);
    c.globalCompositeOperation = "destination-out";
    const inner = a0 + band;
    c.fillRect(inner, inner, s - inner * 2, s - inner * 2);
    c.globalCompositeOperation = "source-over";

    // ---- 团花：花瓣辐辏式环列，中心一枚花心 ----
    const petals = p.frame === "团花" ? 12 : 8;
    for (let i = 0; i < petals; i++) {
      const ang = (i / petals) * Math.PI * 2;
      c.beginPath();
      c.ellipse(
        cx + Math.cos(ang) * R * 0.88,
        cy + Math.sin(ang) * R * 0.88,
        R * 0.30, R * 0.15, ang, 0, Math.PI * 2
      );
      c.fill();
    }
    c.beginPath();
    c.arc(cx, cy, R * 0.40, 0, Math.PI * 2);
    c.fill();

    // ---- 角花：四角各一枚四瓣小花，收住画面角落 ----
    const cr = s * 0.040;
    const cIn = inner + s * 0.055;
    [[cIn, cIn], [s - cIn, cIn], [cIn, s - cIn], [s - cIn, s - cIn]].forEach(([ox, oy]) => {
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
        c.beginPath();
        c.ellipse(ox + Math.cos(ang) * cr * 0.55, oy + Math.sin(ang) * cr * 0.55, cr * 0.40, cr * 0.20, ang, 0, Math.PI * 2);
        c.fill();
      }
    });

    // ---- 镂空：边框内的菱形点纹、花瓣心孔、花心孔 ----
    c.globalCompositeOperation = "destination-out";
    const mid = a0 + band / 2;
    const step = s * 0.075;
    const dsz = s * 0.011;
    const diamond = (x, y) => {
      c.beginPath();
      c.moveTo(x, y - dsz); c.lineTo(x + dsz, y);
      c.lineTo(x, y + dsz); c.lineTo(x - dsz, y);
      c.closePath(); c.fill();
    };
    for (let t = inner + step / 2; t < s - inner; t += step) {
      diamond(t, mid);
      diamond(mid, t);
      diamond(t, s - mid);
      diamond(s - mid, t);
    }
    for (let i = 0; i < petals; i++) {
      const ang = (i / petals) * Math.PI * 2;
      c.beginPath();
      c.arc(cx + Math.cos(ang) * R * 0.88, cy + Math.sin(ang) * R * 0.88, R * 0.085, 0, Math.PI * 2);
      c.fill();
    }
    c.beginPath();
    c.arc(cx, cy, R * 0.12, 0, Math.PI * 2);
    c.fill();
    c.globalCompositeOperation = "source-over";

    return o;
  }

  /** 工艺材质 ∩ 造型蒙版，再叠纸型装饰层；返回透明底 PNG */
  async function composeCraftArt(textureURL, style, plan) {
    const tex = await loadImage(await window.XHFYAI.imageToDataURL(textureURL));
    const s = COMPOSE_SIZE;
    const out = mkCanvas(s);
    const ctx = out.getContext("2d");

    ctx.drawImage(ornamentCanvas(s, style, plan), 0, 0);

    const fill = mkCanvas(s);
    const fctx = fill.getContext("2d");
    const side = Math.min(tex.width, tex.height);
    const crop = side * 0.82;  // 避开模型常见的边缘留白与右下角角标
    fctx.drawImage(tex, (tex.width - crop) / 2, (tex.height - crop) / 2, crop, crop, 0, 0, s, s);
    fctx.globalCompositeOperation = "destination-in";
    fctx.drawImage(craftMaskCanvas(s, style), 0, 0);

    ctx.drawImage(fill, 0, 0);
    return out.toDataURL("image/png");
  }

  /** 无法把底图读进 canvas 时，用 CSS 蒙版给出同样的造型轮廓（不可下载合成图） */
  function applyCssMask(img, style) {
    const maskURL = craftMaskCanvas(COMPOSE_SIZE, style || state.craftStyle).toDataURL("image/png");
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

      // 构图不交给模型：用真实笔迹做骨架，再套上该工艺的造型语言
      loaderText.textContent = "正在按你的笔迹生成" + meta.short + "造型…";
      let composed = "";
      try {
        composed = await composeCraftArt(url, style, bp.plan);
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
      else applyCssMask(img, style);
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
        ? "AI 二创完成：笔迹已转成" + meta.short + "造型"
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
        // 智能匹配按钮：根据画面特征自动选择最契合的工艺
        if (b.id === "craftAutoBtn") {
          if (!state.analysis) {
            toast("先画几笔并完成分析，才能智能匹配工艺");
            return;
          }
          const matched = window.XHFYCraft.autoMatchCraft(state.analysis);
          const meta = window.XHFYCraft.META[matched];
          state.craftStyle = matched;
          selectCraftTab(matched);
          if (state.aiImageURL && state.aiBaseStyle !== matched) resetAiArt();
          updateCraftInfo(matched);
          if (state.report && state.analysis) {
            const fb = window.XHFYReport.makeFallbackReport(state.analysis, state.analysis.userText || "", state.vision);
            if (state.report.guide && state.report.craft.style !== matched) delete state.report.guide;
            state.report.craft.style = matched;
            state.report.craft.reason = fb.craft.reason;
            state.report.craft.elements = fb.craft.elements;
            $("#reportCraftReason").textContent = fb.craft.reason;
            $("#reportCraftName").textContent = meta.name;
            $("#craftElements").textContent = fb.craft.elements;
            renderGuide();
          }
          toast("智能匹配：你的线条最契合「" + meta.short + "」，已为你切换");
          return;
        }
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
