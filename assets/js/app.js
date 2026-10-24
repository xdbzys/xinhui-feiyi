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
    craftEl: null,
    craftURL: "",
    reportPatternURL: "",
    aiImageURL: "",
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

  /* ---------------- 画笔 ---------------- */

  function initPaint() {
    const canvas = $("#paintCanvas");
    studio = new window.PaintStudio(canvas, {
      onFirstStroke: () => $("#canvasEmpty").classList.add("hide"),
      onChange: (s) => {
        $("#undoBtn").disabled = s.strokes.length === 0;
        $("#redoBtn").disabled = !s.canRedo();
        if (!s.strokes.length) $("#canvasEmpty").classList.remove("hide");
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
    const strKeys = ["title", "archetype", "summary", "colors", "lines", "space", "strength", "whisper"];
    strKeys.forEach((k) => {
      if (!out[k] || typeof out[k] !== "string") out[k] = fallback[k];
    });
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
    state.reportPatternURL = "";
    state.aiImageURL = "";
    $("#aiArt").hidden = true;

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
      vision = await window.XHFYAI.vision(b64, text);
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

    // 非遗
    setStage("craft", "active");
    $("#loadingNote").textContent = "正在把你的笔触织成非遗纹样…";
    const style = state.report.craft.style;
    state.craftStyle = style;
    selectCraftTab(style);
    await renderCraft(style, false);
    setStage("craft", "done");

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

  async function renderCraft(style, showLoader) {
    const loader = $("#craftLoading");
    if (showLoader) loader.hidden = false;
    await nextFrame();
    await sleep(showLoader ? 180 : 30);
    try {
      const c = window.XHFYCraft.render(style, studio, 1024);
      state.craftEl = c;
      const target = $("#craftCanvas");
      const ctx = target.getContext("2d");
      ctx.clearRect(0, 0, target.width, target.height);
      ctx.drawImage(c, 0, 0, target.width, target.height);
      state.craftURL = c.toDataURL("image/png");
      state.reportPatternURL = "";
      applyMockup(state.craftURL);
    } catch (e) {
      toast("纹样生成失败，请重试");
    }
    if (showLoader) loader.hidden = true;
  }

  function initCraftTabs() {
    $$(".craft-tab").forEach((b) => {
      b.addEventListener("click", async () => {
        if (state.busy) return;
        const style = b.dataset.style;
        if (style === state.craftStyle && state.craftEl) return;
        state.craftStyle = style;
        selectCraftTab(style);
        const meta = window.XHFYCraft.META[style];
        $("#craftName").textContent = meta.name;
        $("#craftDesc").textContent = meta.desc;
        $("#craftBadge").textContent = meta.badge;
        $("#craftGrammar").textContent = meta.grammar;
        $("#craftUse").textContent = meta.use;
        $("#craftNote").textContent = meta.note;
        $("#craftLoading").hidden = false;
        await renderCraft(style, true);
        if (state.report && state.analysis) {
          const fb = window.XHFYReport.makeFallbackReport(state.analysis, state.analysis.userText || "", state.vision);
          // AI 写的手作指南只针对它推荐的工艺；换工艺后改用该工艺的本地指南
          if (state.report.guide && state.report.craft.style !== style) delete state.report.guide;
          state.report.craft.style = style;
          state.report.craft.reason = fb.craft.reason;
          state.report.craft.elements = fb.craft.elements;
          $("#reportCraftReason").textContent = fb.craft.reason;
          $("#reportCraftName").textContent = meta.name;
          $("#reportFacts").innerHTML = [
            ["工艺", meta.short],
            ["纹样语法", meta.grammar],
            ["适用", meta.use]
          ].map(([k, v2]) => "<div><dt>" + k + "</dt><dd>" + escapeHTML(v2) + "</dd></div>").join("");
          $("#craftElements").textContent = fb.craft.elements;
          renderGuide();
        }
      });
    });

    $("#downloadPattern").addEventListener("click", () => downloadPattern(false));
    $("#downloadReportPattern").addEventListener("click", () => downloadPattern(true));

    $("#aiRedraw").addEventListener("click", async () => {
      if (!state.analysis) {
        toast("请先完成心象分析");
        return;
      }
      const btn = $("#aiRedraw");
      btn.disabled = true;
      const old = btn.textContent;
      btn.textContent = "AI 重绘中…";
      try {
        const v = state.report.vision || {};
        const els = (v.elements && v.elements.length) ? v.elements : (state.analysis.dominantColors || []).map((c) => c.name);
        const colors = (state.analysis.dominantColors || []).map((c) => c.name);
        const url = await window.XHFYAI.craftImage(state.craftStyle, els, colors);
        state.aiImageURL = url;
        $("#aiArtImg").src = url;
        $("#aiArtDownload").href = url;
        $("#aiArt").hidden = false;
        toast("AI 灵感稿已生成（带平台水印，仅作灵感参考）", 3800);
      } catch (e) {
        toast("AI 重绘失败：" + e.message, 4200);
      }
      btn.disabled = false;
      btn.textContent = old;
    });

    $("#toCraftBtn").addEventListener("click", () => scrollToEl("#step3"));
    $("#toGuide").addEventListener("click", () => scrollToEl("#step4"));
  }

  async function downloadPattern(full) {
    if (!studio || studio.isEmpty()) {
      toast("还没有可以下载的图样");
      return;
    }
    toast("正在生成 2048px 打印稿…", 2400);
    await sleep(120);
    try {
      const big = window.XHFYCraft.render(state.craftStyle, studio, 2048);
      big.toBlob((blob) => {
        if (!blob) {
          toast("导出失败，请重试");
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const meta = window.XHFYCraft.META[state.craftStyle];
        a.href = url;
        a.download = "心绘非遗_" + meta.short + "_2048.png";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        toast("图样已下载，可打印后作为手作底稿");
      }, "image/png");
    } catch (e) {
      toast("导出失败：" + e.message);
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

    if (state.craftURL) applyMockup(state.craftURL);
  }

  function applyMockup(url) {
    const tote = $("#totePattern");
    if (!tote || !url) return;
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
    // 生成报告中的图样（缓存）
    if (!state.reportPatternURL && state.craftEl) {
      const c = window.XHFYCraft.render(state.craftStyle, studio, 900);
      state.reportPatternURL = c.toDataURL("image/png");
    }
    $("#reportPattern").src = state.reportPatternURL || state.craftURL;
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
    initSettings();

    // 初始示例纹样占位
    setTimeout(async () => {
      if (!studio.isEmpty()) return;
      // 空画布的工艺纸，让第三幕不显得空
      try {
        const c = window.XHFYCraft.render("papercut", studio, 760);
        state.craftEl = c;
        const target = $("#craftCanvas");
        const ctx = target.getContext("2d");
        ctx.drawImage(c, 0, 0, target.width, target.height);
      } catch (e) {}
    }, 800);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
