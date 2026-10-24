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
    try {
      // 纯静态部署下，浏览器直接跨域调用智谱 API。
      // Authorization 头会触发 CORS 预检（智谱预检不返回 CORS 头），
      // 因此把鉴权放进 query string，换取可用的跨域 POST。
      const full = AI.base + path + (path.indexOf("?") >= 0 ? "&" : "?") +
        "Authorization=" + encodeURIComponent("Bearer " + key);
      const relay = (AI.relay || "").trim();
      const url = relay ? relay.replace("{url}", encodeURIComponent(full)) : full;
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
    } catch (e) {
      clearTimeout(timer);
      if (e && e.name === "AbortError") throw new Error("AI 响应超时");
      throw new Error("网络连接失败，请检查网络后重试");
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

  async function vision(imageBase64, userText) {
    const prompt = [
      "你是一位受过艺术治疗训练的观察者。用户凭记忆画下了「闭上眼睛觉得最舒服的地方」，并可能留下一句话。",
      "请只观察画面本身，用温和、具体、克制的语言描述，不做心理诊断，不评价画得好坏。",
      "可参考的知识库边界（只在该框架内组织语言，不得编造未列出的结论）：",
      window.XHFYKnowledge.buildKnowledgeBlock(),
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

  const STYLE_PROMPTS = {
    papercut: "中国非物质文化遗产剪纸艺术，纯正红纸镂空，传统锯齿纹与云纹收边，平面装饰艺术，对称构图，白色米色背景",
    tiedye: "中国非物质文化遗产扎染艺术，靛蓝色棉布，同心晕圈与自然冰裂纹，手工扎结的不可复制肌理，平面俯拍",
    calico: "中国非物质文化遗产蓝印花布，靛蓝底白色纹样，传统刻版防染，细密冰裂纹，平面装饰艺术",
    bamboo: "中国非物质文化遗产竹编艺术，竹篾经纬交织，一压一挑的编织肌理，暖竹色，平面装饰艺术"
  };

  async function craftImage(style, elements, colors) {
    const styleText = STYLE_PROMPTS[style] || STYLE_PROMPTS.papercut;
    const prompt = [
      styleText,
      "画面元素：" + ((elements || []).join("、") || "抽象的心象山水"),
      "主色：" + ((colors || []).join("、") || "朱砂红、米白"),
      "将元素转化为非遗纹样，保留可辨识的轮廓，正方形构图，高清，细腻，无文字，无边框文字，适合作为手工底稿"
    ].join("。");

    const data = await call("/images/generations", {
      model: AI.imageModel,
      prompt,
      size: "1024x1024"
    }, 90000);

    const url = data && data.data && data.data[0] && data.data[0].url;
    if (!url) throw new Error("图像模型未返回图片");
    return url;
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
    craftImage,
    test,
    extractJSON,
    defaultKeyAvailable: !!DEFAULT_KEY
  };
})();
