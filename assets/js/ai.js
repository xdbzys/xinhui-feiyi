/* =========================================================
   心绘非遗 · 智谱 AI 接入层
   GLM-4V-Flash（视觉观察） / GLM-4-Flash（图鉴与指南） /
   CogView-3-Flash（非遗重绘）
   ========================================================= */
(function () {
  "use strict";

  const CFG = window.XHFY_CONFIG;
  const AI = CFG.ai;
  const STORAGE_KEY = CFG.storageKey;
  let DEFAULT_KEY = "";
  try { DEFAULT_KEY = atob(AI.keyCipher); } catch (e) { DEFAULT_KEY = ""; }

  function getKey() {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_KEY;
    } catch (e) {
      return DEFAULT_KEY;
    }
  }

  function setKey(key) {
    try {
      if (key) localStorage.setItem(STORAGE_KEY, key.trim());
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  function hasCustomKey() {
    try { return !!localStorage.getItem(STORAGE_KEY); } catch (e) { return false; }
  }

  function extractJSON(text) {
    if (!text) return null;
    let t = String(text).trim();
    t = t.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const body = t.slice(start, end + 1);
    try { return JSON.parse(body); } catch (e) {}
    try {
      // 常见修复：去掉尾逗号、替换中文引号
      const fixed = body
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/,\s*([}\]])/g, "$1");
      return JSON.parse(fixed);
    } catch (e) {
      return null;
    }
  }

  async function call(path, payload, timeout) {
    const key = getKey();
    if (!key) throw new Error("缺少 API Key");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout || 60000);
    let res;
    let url = "";
    try {
      // 纯静态部署下，浏览器直接跨域调用智谱 API。
      // Authorization 头会触发 CORS 预检（智谱预检不返回 CORS 头），
      // 因此把鉴权放进 query string，换取可用的跨域 POST。
      const full = AI.base + path + (path.indexOf("?") >= 0 ? "&" : "?") +
        "Authorization=" + encodeURIComponent("Bearer " + key);
      const relay = (AI.relay || "").trim();
      url = relay ? relay.replace("{url}", encodeURIComponent(full)) : full;
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
    } catch (e) {
      clearTimeout(timer);
      if (e && e.name === "AbortError") throw new Error("AI 响应超时");
      console.warn("[心绘非遗] AI 请求失败", e && e.name, e && e.message, url.slice(0, 120));
      throw new Error("网络连接失败：请确认已运行 node tools/relay.mjs，并允许浏览器访问本地网络");
    }
    clearTimeout(timer);
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      const msg = (data && data.error && (data.error.message || data.error.code)) ||
        (data && data.message) || ("HTTP " + res.status);
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function chat(messages, opts) {
    const o = opts || {};
    const payload = {
      model: o.model || AI.textModel,
      messages,
      temperature: o.temperature === undefined ? 0.8 : o.temperature,
      max_tokens: o.maxTokens || 1500,
      top_p: 0.9
    };
    if (o.json) payload.response_format = { type: "json_object" };
    const data = await call("/chat/completions", payload, o.timeout || 60000);
    const content = data && data.choices && data.choices[0] &&
      data.choices[0].message && data.choices[0].message.content;
    if (!content) throw new Error("AI 未返回内容");
    return content;
  }

  function describeProcess(a) {
    const p = a.process || {};
    const b = a.behavior || {};
    if (!p.strokes && !p.activeSec) return "过程数据：暂无（用户落笔很少）";
    return [
      "作画时长：" + Math.round(p.activeSec || 0) + " 秒（实际落笔）",
      "笔触数量：" + (p.strokes || 0) + " 笔，笔速" + (p.speedLabel || "适中"),
      "使用颜色：" + (p.distinctColors || 0) + " 种，换色 " + (p.colorSwitches || 0) + " 次",
      "停顿：" + (p.pauses || 0) + " 次，最长 " + Math.round(p.longestPauseSec || 0) + " 秒",
      "撤销 / 重做 / 橡皮 / 清空：" + (p.undo || 0) + " / " + (p.redo || 0) + " / " + (p.eraser || 0) + " / " + (p.clear || 0),
      "过程标签：" + ((b.tags || []).join("、") || "无明显特征")
    ].join("\n");
  }

  function describeAnalysis(a) {
    const s = a.scores;
    const htp = a.htp || {};
    return [
      "情绪温度：" + s.warmth + "/100（0 极冷，100 极暖）",
      "内在张力：" + s.tension + "/100",
      "空间留白：" + s.space + "/100（越高越空）",
      "扎根感：" + s.grounded + "/100",
      "生命活力：" + s.vitality + "/100",
      "秩序感：" + s.order + "/100",
      "覆盖度：" + Math.round(a.metrics.coverage * 100) + "%",
      "冷暖比例：暖 " + Math.round(a.metrics.warmRatio * 100) + "% / 冷 " + Math.round(a.metrics.coolRatio * 100) + "%",
      "画面重心：x=" + a.metrics.centroid.x + "，y=" + a.metrics.centroid.y + "（0 左上，1 右下）",
      "HTP 特征：" + [htp.lineDirection, htp.pressure, htp.repeated ? "反复涂抹" : "",
        htp.horizBias, htp.vertBias, htp.sizeBias, a.placement].filter(Boolean).join(" · "),
      "主色：" + a.dominantColors.map((c) => c.name + c.hex).join("、"),
      "笔触：" + a.lineStyle + "；空间：" + a.spaceStyle + "；色彩：" + a.colorStyle
    ].join("\n");
  }

  async function vision(imageBase64, userText, analysis) {
    // 视觉模型只负责「看见」：场景、元素、颜色、线条、空间、氛围。
    // 心理解读由 report() 完成，因此这里不发送完整知识库，大幅降低输入 token。
    const prompt = [
      "观察这幅画，用温和具体的语言描述你看到的。不做心理诊断，不评价好坏。",
      analysis ? ("作画过程（仅辅助理解，不复述数字）：" + describeProcess(analysis)) : "",
      "用户自述：" + (userText || "未填写"),
      "只输出 JSON：{\"scene\":\"场景≤20字\",\"elements\":[\"2-6个元素，2-6字\"],\"dominant_colors\":[\"2-4个主色名\"],\"line_quality\":\"线条感受≤20字\",\"space\":\"空间感受≤20字\",\"mood\":\"氛围≤20字\",\"cold_or_warm\":\"冷/暖/中性\",\"note\":\"克制观察≤30字\"}"
    ].filter(Boolean).join("\n");

    const content = await chat([
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageBase64 } },
          { type: "text", text: prompt }
        ]
      }
    ], {
      model: AI.visionModel,
      temperature: 0.4,
      maxTokens: 500,
      json: true,
      timeout: 60000
    });

    const parsed = extractJSON(content);
    if (!parsed) throw new Error("视觉模型返回格式异常");
    return {
      scene: parsed.scene || "",
      elements: Array.isArray(parsed.elements) ? parsed.elements.slice(0, 6) : [],
      dominantColors: Array.isArray(parsed.dominant_colors) ? parsed.dominant_colors.slice(0, 4) : [],
      lineQuality: parsed.line_quality || "",
      space: parsed.space || "",
      mood: parsed.mood || "",
      coldOrWarm: parsed.cold_or_warm || "",
      note: parsed.note || "",
      raw: parsed
    };
  }

  async function report(analysis, userText, visionData) {
    const v = visionData || {};
    const regIds = window.XHFYKnowledge.regulations.map((r) => r.id).join("/");
    const prompt = [
      "你是「心绘非遗」心理观察与非遗转化顾问。语言温柔具体有文学性，但克制：不诊断不贴临床标签；用「可能/也许/像是」；引用具体颜色线条空间元素；结尾给可执行的小力量感。",
      "",
      "【量化视觉分析】" + describeAnalysis(analysis),
      "【作画过程】" + describeProcess(analysis),
      "【视觉观察】场景:" + (v.scene || "无") + "；元素:" + ((v.elements || []).join("、") || "无") +
        "；线条:" + (v.lineQuality || "无") + "；空间:" + (v.space || "无") +
        "；氛围:" + (v.mood || "无") + "；观察:" + (v.note || "无"),
      "【用户自述】" + (userText || "无"),
      "",
      window.XHFYKnowledge.buildKnowledgeBlockCompact(),
      "",
      "严格输出 JSON（中文，无 markdown），字段：",
      JSON.stringify({
        title: "6-12字意象名",
        archetype: "4-8字",
        summary: "80-120字第二人称总述",
        colors: "60-100字色彩解读",
        lines: "60-100字线条与张力",
        space: "60-100字空间重心留白",
        strength: "30-60字画面的一处资源",
        whisper: "20-40字温柔提醒",
        process: "70-110字过程印记，引用作画时长/停顿/撤销/换色中至少两项",
        mood: "40-70字当下心情，用也许/像是",
        regulation: { id: "从 " + regIds + " 选最贴合的一个", why: "30-50字说明为什么适合" },
        craft: { style: "papercut/tiedye/calico/bamboo 选一个", reason: "30-60字", elements: "20-40字元素如何转译" },
        guide: { intro: "30-50字", materials: ["4-6项"], steps: [{ title: "4-8字", text: "30-50字含正念呼吸" }], mantra: "20-35字正念引导语" }
      })
    ].join("\n");

    const content = await chat([
      { role: "system", content: "只输出合法 JSON，中文，无 markdown。" },
      { role: "user", content: prompt }
    ], {
      model: AI.textModel,
      temperature: 0.85,
      maxTokens: 1400,
      json: true,
      timeout: 75000
    });

    const parsed = extractJSON(content);
    if (!parsed) throw new Error("图鉴生成格式异常");
    return parsed;
  }

  /* ---------------- 实时陪伴引导 ---------------- */

  async function companion(stats, context) {
    const s = stats || {};
    const prompt = [
      "你是画布旁的温和陪伴者。根据实时作画数据，给一句不超过22字的具体建议，帮画面更丰富或让用户放松，不评价不诊断。",
      "数据：" + (s.strokes || 0) + "笔/" + (s.distinctColors || 0) + "色/" +
        (s.colorSwitches || 0) + "换色/" + (s.pauses || 0) + "停顿/" + (s.undos || 0) + "撤销/" +
        Math.round((s.coverage || 0) * 100) + "%覆盖",
      "触发：" + (context || "画面空"),
      'JSON:{"say":"≤22字温柔提醒","action":"≤12字动作","kind":"color|space|detail|pause|encourage"}'
    ].join("\n");

    const content = await chat([
      { role: "system", content: "只输出合法 JSON，中文，无 markdown。" },
      { role: "user", content: prompt }
    ], { model: AI.textModel, temperature: 0.9, maxTokens: 120, json: true, timeout: 15000 });

    const parsed = extractJSON(content);
    if (!parsed || !parsed.say) throw new Error("陪伴引导格式异常");
    return {
      say: String(parsed.say).slice(0, 30),
      action: String(parsed.action || "").slice(0, 16),
      kind: parsed.kind || "encourage"
    };
  }

  /* ---------------- 非遗 AI 二创 ---------------- */

  const STYLE_PROMPTS = {
    papercut: "中国非物质文化遗产剪纸艺术，纯正红纸镂空剪影，传统锯齿纹、云纹、团花与角花收边，平面装饰艺术，宣纸质感，米白或纯白背景，构图对称而留呼吸，刀路清晰，无文字",
    tiedye: "中国非物质文化遗产扎染艺术，靛蓝染布，同心晕圈与自然冰裂纹，手工扎结形成的防染留白，布料纤维肌理可见，平面俯拍，构图不对称，无文字",
    calico: "中国非物质文化遗产蓝印花布艺术，靛蓝底白色纹样，传统刻版防染，细密冰裂纹，白花完整清晰，平面装饰艺术，棉布肌理，无文字",
    bamboo: "中国非物质文化遗产竹编艺术，竹篾经纬交织，一压一挑的编织肌理，暖竹色与深浅竹篾交错，收边整齐，平面装饰艺术，无文字"
  };

  // 各工艺对应的传统纹样元素库（本地取，不调用 LLM）
  const CRAFT_MOTIFS = {
    papercut: ["团花", "云纹", "如意纹", "回纹", "缠枝纹", "双喜纹", "角花"],
    tiedye: ["同心圆", "冰裂纹", "放射纹", "扎结留白", "漩涡晕圈", "折痕"],
    calico: ["缠枝花卉", "冰裂纹", "圆点花孔", "回纹边饰", "团花", "草叶纹"],
    bamboo: ["竹节纹", "经纬格", "人字纹", "回纹收边", "十字编", "六角编"]
  };

  /**
   * 本地构建二创蓝图（不调用 LLM，省掉一次完整请求）。
   * 原画的构图、元素、配色、重心都已在 analysis 中量化，
   * 这里只把它们拼成图像模型可用的提示词。
   */
  function craftBlueprint(analysis, report, style) {
    const v = (report && report.vision) || {};
    const htp = analysis.htp || {};
    const elements = (v.elements && v.elements.length)
      ? v.elements.slice(0, 5)
      : (analysis.dominantColors || []).map((c) => c.name).slice(0, 3);
    const palette = (analysis.dominantColors || []).map((c) => c.name).slice(0, 4);
    const motifs = (CRAFT_MOTIFS[style] || CRAFT_MOTIFS.papercut).slice(0, 4);
    const title = (report && (report.archetype || report.title)) || "心象纹样";
    const composition = "主体" + (htp.horizBias || "居中") + "、" +
      (htp.vertBias || "居中") + "，" + (htp.sizeBias || "适中") + "，保留原画留白比例";

    const prompt = [
      "以用户原画的构图为基础（" + composition + "），",
      "将主体（" + (elements.join("、") || "抽象心象") + "）重绘为中国非遗" +
        (window.XHFYCraft && window.XHFYCraft.META[style] ? window.XHFYCraft.META[style].short : style) +
        "风格。",
      "加入传统纹样：" + motifs.join("、") + "。",
      palette.length ? "配色以" + palette.join("、") + "为主，贴合原画气质。" : "",
      "细节丰富，边缘干净，平面装饰艺术，正方形构图，无文字无水印无相框。"
    ].filter(Boolean).join("");

    return { title, composition, motifs, palette, prompt, style };
  }

  /** 按蓝图调用图像模型，生成非遗二创底图 */
  async function craftRedraw(style, blueprint, analysis, report) {
    const bp = blueprint || {};
    const styleText = STYLE_PROMPTS[style] || STYLE_PROMPTS.papercut;
    const htp = analysis.htp || {};
    const elements = ((report && report.vision && report.vision.elements) || []).join("、");
    const prompt = [
      styleText,
      bp.prompt || "",
      bp.composition ? "构图要求：" + bp.composition : "",
      "沿用原画的主体位置（" + htp.horizBias + "·" + htp.vertBias + "）与留白比例，不要添加原画里没有的人物",
      elements ? "原画元素：" + elements : "",
      (bp.motifs && bp.motifs.length) ? "加入传统纹样：" + bp.motifs.join("、") : "",
      (bp.palette && bp.palette.length) ? "配色：" + bp.palette.join("、") : "",
      "正方形构图，1:1，高清，细节丰富，边缘干净，平面装饰艺术，无文字，无水印，无相框，适合作为剪纸 / 印染底稿"
    ].filter(Boolean).join("。");

    const data = await call("/images/generations", {
      model: AI.imageModel,
      prompt,
      size: "1024x1024"
    }, 90000);

    const url = data && data.data && data.data[0] && data.data[0].url;
    if (!url) throw new Error("图像模型未返回图片");
    return url;
  }

  /** 兼容旧接口：直接按元素生成一张灵感稿 */
  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("图片读取失败"));
      reader.readAsDataURL(blob);
    });
  }

  /** 把图像 URL 取回为 dataURL：CogView 图片不带 CORS 头，需经本地中继转发 */
  async function imageToDataURL(url) {
    try {
      const res = await fetch(url, { mode: "cors" });
      if (res.ok) return await blobToDataURL(await res.blob());
    } catch (e) {}
    const relay = (AI.relay || "").trim();
    if (relay) {
      try {
        const res = await fetch(relay.replace("{url}", encodeURIComponent(url)), { method: "GET" });
        if (res.ok) return await blobToDataURL(await res.blob());
      } catch (e) {}
    }
    throw new Error("图片受跨域限制，请启动本地中继后再生成二创稿");
  }

  async function test() {
    const content = await chat([
      { role: "user", content: "只回复两个字：可用" }
    ], { model: AI.textModel, maxTokens: 8, temperature: 0.1, timeout: 20000 });
    return content.trim();
  }

  window.XHFYAI = {
    getKey,
    setKey,
    hasCustomKey,
    vision,
    report,
    companion,
    craftBlueprint,
    craftRedraw,
    imageToDataURL,
    describeProcess,
    test,
    extractJSON,
    defaultKeyAvailable: !!DEFAULT_KEY
  };
})();
