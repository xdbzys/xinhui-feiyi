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
    const prompt = [
      "你是一位受过艺术治疗训练的观察者。用户凭记忆画下了「闭上眼睛觉得最舒服的地方」，并可能留下一句话。",
      "请只观察画面本身，用温和、具体、克制的语言描述，不做心理诊断，不评价画得好坏。",
      "可参考的知识库边界（只在该框架内组织语言，不得编造未列出的结论）：",
      window.XHFYKnowledge.buildKnowledgeBlock(),
      "",
      analysis ? "【作画过程数据（用于辅助理解，不要直接复述数字）】\n" + describeProcess(analysis) : "",
      "",
      "用户自述：" + (userText || "（未填写）"),
      "严格输出 JSON（不要 markdown，不要额外解释），字段如下：",
      '{"scene":"一句话描述画面场景，20字以内","elements":["2-6个画面元素，每个2-6字"],"dominant_colors":["2-4个主色名，如 靛蓝、赭石"],"line_quality":"线条给人的感觉，20字以内","space":"空间与留白给人的感觉，20字以内","mood":"整体情绪氛围，20字以内","cold_or_warm":"冷色/暖色/中性","note":"一句克制的观察，30字以内"}'
    ].join("\n");

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
      maxTokens: 600,
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
    const prompt = [
      "你是「心绘非遗」项目的心理观察与非遗转化顾问。你的语言温柔、具体、有文学性，但必须克制：",
      "1) 不做医学诊断，不使用「抑郁症/焦虑症/创伤」等临床标签，不吓唬用户；",
      "2) 只把画面当作一种表达，用「可能」「也许」「像是」这样的语气；",
      "3) 必须引用具体的颜色、线条、空间或元素，让用户感到被看见；",
      "4) 结尾要给出一个可执行的小小力量感。",
      "",
      "【量化视觉分析（0-100）】",
      describeAnalysis(analysis),
      "",
      "【作画过程数据】",
      describeProcess(analysis),
      "",
      "【视觉模型观察】",
      "场景：" + (v.scene || "未提供"),
      "元素：" + ((v.elements || []).join("、") || "未提供"),
      "线条：" + (v.lineQuality || "未提供"),
      "空间：" + (v.space || "未提供"),
      "氛围：" + (v.mood || "未提供"),
      "观察：" + (v.note || "未提供"),
      "",
      "【用户自述】",
      userText || "（未填写）",
      "",
      "【专家知识库边界】",
      window.XHFYKnowledge.buildKnowledgeBlock(),
      "",
      "严格输出 JSON（不要 markdown，不要额外解释）。字段与字数要求：",
      JSON.stringify({
        title: "6-12字，如「静海孤舟」",
        archetype: "4-8字意象名",
        summary: "80-120字总述，第二人称",
        colors: "60-100字解读色彩，引用具体颜色",
        lines: "60-100字解读线条与张力",
        space: "60-100字解读空间、重心与留白",
        strength: "30-60字，指出画面里的一处资源或力量",
        whisper: "20-40字，一句温柔提醒",
        process: "70-110字「过程印记」：必须引用作画时长、停顿、撤销、换色中的至少两项，说明你是怎么画的，以及这种画法可能意味着什么",
        mood: "40-70字「当下心情」：结合画面与过程，用「也许」「像是」描述此刻可能的心情，不做诊断",
        regulation: {
          id: "从下列调节方法 ID 中选最贴合的一个：" +
            window.XHFYKnowledge.regulations.map((r) => r.id + "=" + r.name).join("、"),
          why: "30-50字，结合画面与过程，说明为什么此刻适合这个方法"
        },
        craft: {
          style: "从 papercut / tiedye / calico / bamboo 中选一个最贴合画面的",
          reason: "30-60字为什么选它",
          elements: "20-40字，说明元素如何转译为纹样"
        },
        guide: {
          intro: "30-50字，说明这件手作与用户心象的关系",
          materials: ["4-6项具体材料"],
          steps: [{ title: "4-8字", text: "30-50字，含正念呼吸提示" }],
          mantra: "20-35字正念引导语"
        }
      })
    ].join("\n");

    const content = await chat([
      { role: "system", content: "你只输出合法 JSON，用中文书写，不要添加 markdown 代码块。" },
      { role: "user", content: prompt }
    ], {
      model: AI.textModel,
      temperature: 0.85,
      maxTokens: 1900,
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
      "你是心绘非遗画布旁边的一位温和的陪伴者。用户正在凭记忆画「让自己觉得舒服的地方」。",
      "请根据下面的实时作画数据，给出一句很短的提醒，帮助画面更丰富、更舒服，或帮助用户放松。",
      "要求：",
      "1) 不超过 22 个字，像朋友在耳边说的一句话；",
      "2) 具体、可执行，比如「加一点苔绿」或「画一朵云陪它」；",
      "3) 不评价画得好坏，不说「你应该」，不做任何心理诊断；",
      "4) 如果用户正在犹豫或停顿，先允许，再建议。",
      "",
      "实时数据：已画 " + (s.elapsed || 0) + " 秒，落笔 " + (s.strokes || 0) + " 笔，" +
        "使用 " + (s.distinctColors || 0) + " 种颜色，换色 " + (s.colorSwitches || 0) + " 次，" +
        "停顿 " + (s.pauses || 0) + " 次，撤销 " + (s.undos || 0) + " 次，覆盖约 " +
        Math.round((s.coverage || 0) * 100) + "%，画面尺寸 " + (s.bboxW || 0) + "×" + (s.bboxH || 0),
      "触发原因：" + (context || "画面还比较空"),
      "",
      '严格输出 JSON：{"say":"一句不超过22字的温柔提醒","action":"一个不超过12字的具体动作","kind":"color|space|detail|pause|encourage"}'
    ].join("\n");

    const content = await chat([
      { role: "system", content: "你只输出合法 JSON，用中文，不要 markdown。" },
      { role: "user", content: prompt }
    ], { model: AI.textModel, temperature: 0.9, maxTokens: 160, json: true, timeout: 15000 });

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

  /** 让文本模型把「用户原画 + 工艺」翻译成一张可控的重绘蓝图 */
  async function craftBlueprint(analysis, report, style) {
    const v = (report && report.vision) || {};
    const htp = analysis.htp || {};
    const elements = (v.elements && v.elements.length)
      ? v.elements
      : ((analysis.dominantColors || []).map((c) => c.name).slice(0, 3));
    const colors = (analysis.dominantColors || []).map((c) => c.name + "(" + c.hex + ")");
    const prompt = [
      "你是非遗纹样设计师。用户画了一幅很朴素的心象画，现在要把它二创成非遗工艺作品。",
      "关键：不是复制原图，而是在保留原画「构图、主体位置、元素关系、情绪气质」的前提下，把它重绘为细节丰富、纹样完整、符合传统工艺语法的作品。",
      "",
      "【原画信息】",
      "画面场景：" + (v.scene || "未提供"),
      "元素：" + (elements.join("、") || "抽象心象"),
      "线条：" + (v.lineQuality || analysis.lineStyle),
      "氛围：" + (v.mood || analysis.colorStyle),
      "主色：" + (colors.join("、") || "朱砂红、米白"),
      "构图：主体" + htp.horizBias + "、" + htp.vertBias + "，" + htp.sizeBias,
      "图鉴意象：" + ((report && (report.archetype || report.title)) || "心里的那片岸"),
      "用户自述：" + ((analysis.userText || "").slice(0, 120) || "未填写"),
      "",
      "【目标工艺】" + style + "：" + (STYLE_PROMPTS[style] || STYLE_PROMPTS.papercut),
      "",
      "严格输出 JSON（不要 markdown）：",
      JSON.stringify({
        title: "6-10字作品名",
        composition: "30-50字，说明主体在画面中的位置、大小与留白，必须沿用原画构图",
        motifs: ["3-6个要加入的传统纹样元素"],
        palette: ["2-4个颜色，如 朱砂红、米白"],
        prompt: "120-200字，可直接用于图像生成模型的中文提示词：写明非遗工艺、原画主体与构图、传统纹样细节、配色、背景、质感、正方形、无文字"
      })
    ].join("\n");

    const content = await chat([
      { role: "system", content: "你只输出合法 JSON，用中文书写。" },
      { role: "user", content: prompt }
    ], { model: AI.textModel, temperature: 0.7, maxTokens: 900, json: true, timeout: 45000 });

    const parsed = extractJSON(content);
    if (!parsed) throw new Error("二创蓝图生成失败");
    return {
      title: parsed.title || "心象纹样",
      composition: parsed.composition || "",
      motifs: Array.isArray(parsed.motifs) ? parsed.motifs.slice(0, 6) : [],
      palette: Array.isArray(parsed.palette) ? parsed.palette.slice(0, 4) : [],
      prompt: parsed.prompt || "",
      style
    };
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
  async function craftImage(style, elements, colors) {
    const data = await call("/images/generations", {
      model: AI.imageModel,
      prompt: [
        STYLE_PROMPTS[style] || STYLE_PROMPTS.papercut,
        "画面元素：" + ((elements || []).join("、") || "抽象的心象山水"),
        "主色：" + ((colors || []).join("、") || "朱砂红、米白"),
        "正方形构图，高清，无文字，适合作为手工底稿"
      ].join("。"),
      size: "1024x1024"
    }, 90000);
    const url = data && data.data && data.data[0] && data.data[0].url;
    if (!url) throw new Error("图像模型未返回图片");
    return url;
  }

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
    craftImage,
    imageToDataURL,
    describeProcess,
    test,
    extractJSON,
    defaultKeyAvailable: !!DEFAULT_KEY
  };
})();
