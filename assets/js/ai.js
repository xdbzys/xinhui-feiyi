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

    // 鉴权放 query string（避免 Authorization 头触发预检）
    const full = AI.base + path + (path.indexOf("?") >= 0 ? "&" : "?") +
      "Authorization=" + encodeURIComponent("Bearer " + key);
    const relay = (AI.relay || "").trim();

    // 尝试顺序：直连 → 中继（如果配置了）
    // www.bigmodel.cn 对 chat/vision/images 全部支持 CORS，直连即可；
    // 若自定义了中继则作为兜底。直连失败时调用方降级到本地引擎。
    const attempts = [];
    attempts.push({ url: full, label: "直连" });
    if (relay) attempts.push({ url: relay.replace("{url}", encodeURIComponent(full)), label: "中继" });

    let lastErr = null;
    for (const attempt of attempts) {
      try {
        const res = await fetch(attempt.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: ctrl.signal
        });
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
      } catch (e) {
        lastErr = e;
        if (e && e.name === "AbortError") break;
        console.warn("[心绘非遗] " + attempt.label + " 请求失败", e && e.message);
      }
    }
    clearTimeout(timer);
    if (lastErr && lastErr.name === "AbortError") throw new Error("AI 响应超时");
    throw new Error("AI 服务暂不可用，已切换本地心象引擎");
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
    const jung = a.jung || {};
    const arn = a.arnheim || {};
    const m = a.metrics || {};
    const pct = (x) => Math.round((x || 0) * 100) + "%";
    const grid = (m.grid || []).map(pct);
    return [
      "情绪温度：" + s.warmth + "/100（0 极冷，100 极暖）",
      "内在张力：" + s.tension + "/100",
      "留白占比：" + s.space + "%（= 100 − 笔墨覆盖度，越高越空，是可复核的几何量）",
      "扎根感：" + s.grounded + "/100",
      "生命活力：" + s.vitality + "/100",
      "秩序感：" + s.order + "/100",
      "自我力量：" + s.egoStrength + "/100（来源：Koch 树木/Machover 画人：画面大小+笔触力度+线条质量）",
      "完形程度：" + s.completeness + "/100（来源：Jung 曼陀罗：中心聚集+四象限平衡+对称+闭合）",
      "视觉平衡：" + s.visualBalance + "/100（来源：Arnheim 视知觉：重心偏移+双轴对称+四象限均衡）",
      "覆盖度：" + pct(m.coverage) + "；边缘密度：" + m.edgeDensity + "；笔压强度：" + m.edgeStrength,
      "方向一致性：" + (1 - (m.orientationEntropy || 0)).toFixed(2) + "（方向熵 " + m.orientationEntropy + "）",
      "色相熵：" + m.hueEntropy + "（越高颜色越杂）；左右对称度：" + m.symmetry + "；上下对称度：" + m.symmetryV,
      "冷暖比例：暖 " + pct(m.warmRatio) + " / 冷 " + pct(m.coolRatio) + " / 中性 " + pct(m.neutralRatio) + " / 绿 " + pct(m.greenRatio),
      "平均饱和度：" + m.satAvg + "；平均明度：" + m.lightAvg,
      "画面重心：x=" + (m.centroid && m.centroid.x) + "，y=" + (m.centroid && m.centroid.y) + "（0 左上，1 右下）",
      "四区权重：上 " + pct(m.topWeight) + " / 下 " + pct(m.bottomWeight) + " / 左 " + pct(m.leftWeight) + " / 右 " + pct(m.rightWeight),
      "九宫格笔墨分布：" + grid.join(" · ") + "（按左上→右中→右下顺序）",
      "HTP 特征：" + [htp.lineDirection, htp.pressure, htp.repeated ? "反复涂抹" : "",
        htp.horizBias, htp.vertBias, htp.sizeBias, htp.cutoff, a.placement].filter(Boolean).join(" · "),
      "包围盒占画面：" + Math.round((m.bboxRatio || 0) * 100) + "%（《中学生绘画心理应用手册》：>67% 过大、<11% 过小）",
      "Jung 曼陀罗：中心" + (jung.centerPattern || "?") + "（聚集度 " + (jung.centerConvergence || "?") + "）；" +
        (jung.quadrantPattern || "?") + "（均衡度 " + (jung.quadrantBalance || "?") + "）；" +
        (jung.closure || "?") + "；对称 " + (jung.symmetry || "?"),
      "Arnheim 视觉动力：" + (arn.balancePattern || "?") + "（平衡度 " + (arn.visualBalance || "?") + "）；" +
        "重心" + (arn.centroidBias || "?") + "；运动" + (arn.movement || "?") + "；" + (arn.edgeWeight || "?"),
      "FEATS 形式元素（0–5，空=不适用）：" + (a.feats || [])
        .map((f) => f.dim + (f.score === null || f.score === undefined ? "=不适用" : "=" + f.score))
        .join(" · "),
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
      "只输出 JSON：{\"scene\":\"场景≤20字\",\"elements\":[\"2-6个元素，2-6字\"],\"dominant_colors\":[\"2-4个主色名\"],\"line_quality\":\"线条感受≤20字\",\"space\":\"空间感受≤20字\",\"mood\":\"氛围≤20字\",\"cold_or_warm\":\"冷/暖/中性\",\"layout\":\"一句话说明每个主要图形在画面的位置与走向，如“从左下到右上的斜线、中部空心方块、右上圆圈”，≤60字\",\"note\":\"克制观察≤30字\"}"
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
      // 元素的空间位置：二创提示词靠它复刻原画构图，比单纯列元素名有效得多
      layout: typeof parsed.layout === "string" ? parsed.layout.trim() : "",
      note: parsed.note || "",
      raw: parsed
    };
  }

  async function report(analysis, userText, visionData) {
    const v = visionData || {};
    const regIds = window.XHFYKnowledge.regulations.map((r) => r.id).join("/");
    const prompt = [
      "你是「心绘非遗」的绘画心理投射分析师。理论框架限定为：HTP 屋树人投射测验、表达性艺术治疗（EAT / ETC 连续系统）、应用色彩心理学、Jung 曼陀罗理论（自性化与完形）、Arnheim《艺术与视知觉》视觉动力、Koch 树木人格测验（Baum Test）、Machover 画人测验（Draw-A-Person）、FEATS 形式元素量表、正念手作（MBCT / MBSR）。",
      "任务是做一次可复核的严格分析，不是写安慰文。宁可说「难以判断」，也不要编造。",
      "",
      "【硬性规则】",
      "1. 证据优先：每条结论必须引用下方给出的具体量化指标（写明数字）或视觉观察里的具体元素；没有证据就不要下结论。",
      "2. 标注来源：每段分析末尾必须用括号注明所依据的知识库条目，例如（《中学生绘画心理应用手册》画面位置）、（《色彩心理学》色彩冷暖）、（Jung 曼陀罗 中心性）、（Arnheim 视觉重心）、（Koch 树木 线条力度）、（Machover 画人 画面大小）、（HTP 空间投射）、（FEATS）、（EAT 容器理论）、（MBCT）。",
      "3. 三层解读：每条核心观察必须覆盖「形式层」（看得见的画面特征）、「过程层」（作画过程数据）、「象征层」（心理学框架的含义），三层缺一不可。",
      "4. 多解并存：对最突出的 1–2 个特征，先给主解读，再给一个同样合理的替代解读，并说明为什么更倾向主解读。",
      "5. 把握度分三档：较有把握 / 可能 / 难以判断；证据不足时直接写明局限，不要假装确定。",
      "6. 不诊断、不使用临床标签（抑郁、焦虑症、创伤等）、不承诺疗效。",
      "7. 语气克制，用「可能 / 也许 / 更像是」；结论落到自我觉察 + 一个可执行的小行动。",
      "8. 分数只是线索，不是结论：不得把「张力 72」直接翻译成「你很焦虑」，必须同时引用笔触形态、位置、颜色等可视证据，说明为何这样读。",
      "9. 当量化指标与云端视觉观察冲突时，以可复核的视觉观察为准，并在 evidence 中写明这处冲突。",
      "10. 逐维读 FEATS：对已给分的维度逐一说明「分数 → 画面证据 → 可能含义」；标注「不适用」的维度一律不要评，也不要换说法硬评。",
      "11. 必须写出至少一处内部矛盾或不确定（如色彩与线条指向相反、某维度证据不足），并写明本次分析的局限。",
      "12. 新三维度必须解读：自我力量（Koch/Machover）、完形程度（Jung）、视觉平衡（Arnheim）每个都要给出分数→证据→含义，并标注来源框架。",
      "",
      "【量化视觉分析（本地算法，0–100，已按画面尺度归一化）】",
      describeAnalysis(analysis),
      "【作画过程】",
      describeProcess(analysis),
      "【云端视觉观察（GLM-4V）】场景:" + (v.scene || "无") + "；元素:" + ((v.elements || []).join("、") || "无") +
        "；布局:" + (v.layout || "无") + "；线条:" + (v.lineQuality || "无") + "；空间:" + (v.space || "无") +
        "；主色:" + ((v.dominantColors || []).join("、") || "无") + "；冷暖:" + (v.coldOrWarm || "无") +
        "；氛围:" + (v.mood || "无") + "；观察:" + (v.note || "无"),
      "【用户自述】" + (userText || "无"),
      "",
      window.XHFYKnowledge.buildKnowledgeBlockRich(),
      "",
      "【引用格式示范（必须照此格式在 colors/lines/space/evidence 中出现书名）】",
      "evidence 示例：\"暖色占比 70% → 情感能量偏向外放（来源：《中学生绘画心理应用手册》暖色调）\"",
      "colors 示例：\"朱红与落日橙为主，暖占比高…（《色彩心理学》色彩冷暖：暖色饱和度越高越暖）\"",
      "lines 示例：\"长直线为主，方向一致性 0.7…（《中学生绘画心理应用手册》长线条：自我控制能力强）\"",
      "space 示例：\"包围盒占 35%，居中偏右上…（《中学生绘画心理应用手册》画面位置：偏上=接近想象）\"",
      "",
      "严格输出 JSON（中文，无 markdown），字段与要求：",
      JSON.stringify({
        title: "6-12字意象名",
        archetype: "4-8字",
        summary: "120-180字第二人称总述，必须引用至少3个具体证据（数字或画面元素）",
        evidence: ["3-5条，每条格式：具体指标或现象 → 可能的含义（来源：知识库中的具体条目名），必须含书名"],
        colors: "100-140字色彩解读，须引用具体色名、冷暖占比、饱和度、用色数量，末尾必须括号标注《色彩心理学》或《中学生绘画心理应用手册》对应条目",
        lines: "100-140字线条与张力，须引用张力分值、线条方向、笔触力度(HTP)、方向一致性、是否反复涂抹，末尾必须括号标注《中学生绘画心理应用手册》用笔力度或线条条目",
        space: "100-140字空间与留白，须引用覆盖度、包围盒比例(sizeBias)、画面位置、是否切断(cutoff)、留白占比(=100−覆盖度)、四区权重；解读空白时必须交叉验证笔触数量/落笔时长/情绪温度，不得只凭空白大小断言孤独或自由，末尾必须括号标注《中学生绘画心理应用手册》画面大小/位置/切断条目",
        dynamics: "140-200字完形与视觉动力解读，必须分三段：①Jung曼陀罗：引用中心聚集度/四象限平衡/闭合结构/对称，解读自性化与完形状态（末尾标注 Jung 曼陀罗）；②Arnheim视觉动力：引用视觉平衡度/重心偏移/运动方向/边缘重量，解读内在张力的平衡（末尾标注 Arnheim 视觉动力）；③自我力量：引用自我力量分值+画面占比+笔触力度，解读自我功能（末尾标注 Koch 树木 / Machover 画人）",
        feats: [{ dim: "维度名，只能取自上方 FEATS 中已给分的项", score: "整数0-5", note: "≤30字：该分数对应的具体画面证据与可能含义" }],
        contradictions: ["1-2条：画面中指向不一致的证据，以及你如何权衡"],
        limitations: "40-70字：本次分析不能判断什么、为什么不能",
        alternative: "70-110字：对最突出特征给出另一种同样合理的解读，并说明本次为何更倾向主解读",
        confidence: "「较有把握」/「可能」/「难以判断」三选一，后接10字内理由",
        strength: "40-70字：画面中的一处心理资源，须指认具体位置或元素",
        whisper: "20-40字温柔提醒",
        process: "80-130字过程印记，引用作画时长/停顿/撤销/换色/笔速中至少三项",
        mood: "50-80字当下心情，用也许/像是，并标注把握度",
        regulation: { id: "从 " + regIds + " 选最贴合证据的一个", why: "40-60字说明这个调节方法与哪些证据匹配" },
        craft: { style: "papercut/tiedye/calico/bamboo 选一个", reason: "40-70字说明为何此工艺贴合画面结构", elements: "30-50字说明画面哪些元素如何转译为纹样" },
        guide: { intro: "30-50字", materials: ["4-6项"], steps: [{ title: "4-8字", text: "30-50字含正念呼吸" }], mantra: "20-35字正念引导语" }
      })
    ].join("\n");

    const content = await chat([
      { role: "system", content: "你是严谨的绘画心理投射分析师，只输出合法 JSON，中文，无 markdown。不确定时明确写出不确定。" },
      { role: "user", content: prompt }
    ], {
      model: AI.reportModel || AI.textModel,
      temperature: 0.35,
      maxTokens: 3000,
      json: true,
      timeout: 120000
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

  /**
   * 角色设定：东方美学大师 + 非遗传承人 + 敏锐心理分析师。
   * 四步工作流（骨架意象 → 工艺匹配 → 艺术重构 → 材质光影）先在后台走完，
   * 再把结论写进图像模型的提示词，避免「描边 + 平铺纹样」的草率结果。
   */
  const ARTIST_SYSTEM = [
    "你融合了东方美学大师、非遗传承人、敏锐心理分析师三重身份。",
    "你的任务是把用户极简单、随意的涂鸦，升华为一幅有灵魂的非遗数字艺术展品。",
    "你只输出合法 JSON，中文，无 markdown，不解释。"
  ].join("");

  // 各工艺的材质与纹样关键词
  /**
   * 图像模型的提示词必须短。
   * 实测 CogView-3-Flash 对长段多义描述会失焦——把「骨架/关节/镂雕/千丝万缕」
   * 堆在一起时曾生成过建筑照片与人像；改成「工艺＋一个具象意象＋两条材质关键词」
   * 后，六种工艺都能稳定产出可用的非遗画面。控制在 40–70 字。
   */
  const CRAFT_BRIEF = {
    papercut: { name: "剪纸", material: "红纸镂空剪影，刀口利落", accent: "祥云纹镂空" },
    tiedye: { name: "扎染", material: "靛蓝棉布晕染，冰裂纹", accent: "同心晕圈" },
    calico: { name: "蓝印花布", material: "靛蓝底白花，刻版防染", accent: "缠枝纹" },
    bamboo: { name: "竹编", material: "竹篾经纬交织", accent: "竹节纹" },
    shadow: { name: "皮影", material: "牛皮镂雕剪影，侧身关节，暖黄透光", accent: "祥云纹镂空" },
    embroidery: { name: "苏绣", material: "绸缎底缎绣针脚，丝线光泽", accent: "打籽点缀" },
    cloisonne: { name: "掐丝珐琅", material: "景泰蓝铜丝掐丝填釉，釉面玻璃光泽", accent: "鎏金回字边" },
    knot: { name: "绳结", material: "正红棉绳盘长结，一线到底", accent: "结耳与流苏" }
  };

  /** 本地兜底：按线条特征联想一个具象意象 */
  function suggestImagery(analysis) {
    const v = (analysis && analysis.vision) || {};
    const s = (analysis && analysis.scores) || {};
    const htp = (analysis && analysis.htp) || {};
    const layout = (v.layout || "");
    const lineDir = htp.lineDirection || "方向多变";

    if (/圆|圈|环|球/.test(layout)) return "一只展翅的纸鸢";
    if (/三角|尖|山/.test(layout)) return "一座层叠的远山";
    if (/交叉|十字|交/.test(layout)) return "一只盘踞的螭龙";
    if (/方|框|格/.test(layout)) return "一扇万字花窗";
    if (/波|曲|弧|弯/.test(layout)) return "一尾游动的锦鲤";
    if (/散|点|碎/.test(layout)) return "一丛飘落的兰花";
    if (/螺旋|涡|旋/.test(layout)) return "一团翻腾的云气";

    if (lineDir.indexOf("斜") >= 0) return "一位飞天的舞者";
    if (lineDir.indexOf("水平") >= 0) return "一叶扁舟与水面";
    if (lineDir.indexOf("垂直") >= 0) return "一株并蒂的兰草";
    if ((s.tension || 0) > 60) return "一只回首的瑞兽";
    if ((s.vitality || 0) > 60) return "一丛盛放的牡丹";
    if ((s.order || 0) > 60) return "一组对称的吉祥纹样";
    return "一片写意的山水云纹";
  }

  function fallbackPlan(analysis, style) {
    const meta = (window.XHFYCraft && window.XHFYCraft.META[style]) || {};
    return {
      imagery: suggestImagery(analysis),
      imageryWhy: "线条的走向与疏密更像一具体有生命的形体，而不是纯粹的笔迹。",
      motifWeave: "以祥云纹与缠枝纹填满线条之间的空白，让轮廓之外也有工艺的密度。",
      craftNote: meta.short ? "以" + meta.short + "承载，材质与线条的张力最相合。" : ""
    };
  }

  /**
   * 第一步 + 第二步：读懂线条背后的潜意识，给出具象意象与工艺判断。
   * 走一次轻量文本模型；失败时退回本地联想，保证二创永不中断。
   */
  async function craftPlan(analysis, report, style) {
    const v = (analysis && analysis.vision) || {};
    const s = (analysis && analysis.scores) || {};
    const m = (analysis && analysis.metrics) || {};
    const htp = (analysis && analysis.htp) || {};
    const meta = (window.XHFYCraft && window.XHFYCraft.META[style]) || {};
    const colors = (analysis && analysis.dominantColors || []).slice(0, 3)
      .map((c) => c.name).filter(Boolean).join("、");

    const prompt = [
      "【第一步 极简骨架提取与意象联想】",
      "用户画的只是线条，你要读懂它背后的潜意识：一团乱麻可能是纠结的内心，可化作盘踞的螭龙；",
      "简单的一撇一捺可能是冲破束缚的翅膀，可化作展翅的纸鸢。",
      "必须给出一个极其高级、具象的自然或人文意象（如飞天、瑞兽、游鱼、兰花、水波纹、纸鸢、仙鹤、螭龙、云气、莲、牡丹）。",
      "绝不能只描述线条本身，必须描述你联想到的具体事物。",
      "【第二步 精准的非遗匹配】",
      "用户当前所选工艺：" + (meta.short || style) + "。请判断它是否是最契合的载体：",
      "线条狂放断裂感强→皮影；线条细腻长短错落→苏绣；线条交错复杂→竹编；线条首尾相连成环→绳结；",
      "线条闭合且色块分明→掐丝珐琅；大面积留白气韵生动→扎染或剪纸。",
      "若更契合别的工艺，在 craftNote 里说明，但仍按用户所选工艺输出。",
      "【第三步 艺术重构】保留用户原始线条作为画面主骨架，用繁复精美的祥云纹、缠枝纹、回字纹、水波纹填补线条之间的空白。",
      "【第四步 材质光影】红纸毛边、皮影斑驳透光、靛蓝自然晕染；背景用高级宣纸肌理或暗调光影。",
      "",
      "画面证据：",
      "- 线条走向：" + (htp.lineDirection || "方向多变") + "；笔触压力：" + (htp.pressure || "适中"),
      "- 内在张力 " + (s.tension || 50) + "/100，秩序感 " + (s.order || 50) + "/100，留白占比 " + (s.space || 50) + "%",
      "- 覆盖度 " + Math.round((m.coverage || 0) * 100) + "%，主色 " + (colors || "未提取"),
      "- 视觉模型看到的布局：" + (v.layout || "无"),
      "- 视觉模型看到的元素：" + ((v.elements || []).join("、") || "无"),
      "- 心象图鉴标题：" + ((report && (report.archetype || report.title)) || "未命名"),
      "",
      '只输出 JSON：{"imagery":"≤12字具象意象，如：盘踞的螭龙","imageryWhy":"≤40字：为什么这几笔让你想到它","motifWeave":"≤50字：用哪种纹样、怎样填补线条之间的空白","craftNote":"≤40字：为何此工艺最契合，或更契合的工艺"}'
    ].join("\n");

    try {
      const content = await chat([
        { role: "system", content: ARTIST_SYSTEM },
        { role: "user", content: prompt }
      ], { model: AI.textModel, temperature: 1.0, maxTokens: 400, json: true, timeout: 40000 });
      const parsed = extractJSON(content);
      const base = fallbackPlan(analysis, style);
      if (!parsed) return base;
      return {
        imagery: String(parsed.imagery || base.imagery).slice(0, 20),
        imageryWhy: String(parsed.imageryWhy || base.imageryWhy).slice(0, 80),
        motifWeave: String(parsed.motifWeave || base.motifWeave).slice(0, 100),
        craftNote: String(parsed.craftNote || base.craftNote).slice(0, 80)
      };
    } catch (e) {
      return fallbackPlan(analysis, style);
    }
  }

  /**
   * 第三步 + 第四步：把意象与工艺写成短提示词。
   * 只有「一件具象作品」这一个中心，模型才不会跑到别的题材上。
   * 同时回灌用户的真实数据——主色、氛围、构图方位——
   * 让文本生图模型（CogView-3-Flash 不支持图生图）也能回响原画的骨架与色彩，
   * 而不是凭空编一张非遗图。控制总字数 ≤72，避免模型失焦。
   */
  function craftBlueprint(analysis, report, style, plan) {
    const b = CRAFT_BRIEF[style] || CRAFT_BRIEF.papercut;
    const p = plan || fallbackPlan(analysis, style);
    const a = analysis || {};
    const v = a.vision || {};
    const palette = (a.dominantColors || []).slice(0, 3)
      .map((c) => c.name).filter(Boolean).join("、");
    // 视觉模型看到的构图方位，是「复刻原画骨架」最关键的线索；截断避免超出字数预算
    const layout = (v.layout || "").slice(0, 22);
    const mood = (v.mood || "").slice(0, 10);

    let prompt = "中国" + b.name + "：" + p.imagery + "，" + b.material + "，" + b.accent;
    if (palette) prompt += "，主色" + palette;
    if (mood) prompt += "，" + mood;
    if (layout) prompt += "，构图" + layout;
    prompt += "，大面积留白，无文字";

    return {
      title: (report && (report.archetype || report.title)) || "心象纹样",
      imagery: p.imagery,
      imageryWhy: p.imageryWhy,
      motifWeave: p.motifWeave,
      craftNote: p.craftNote,
      prompt,
      style,
      palette,
      layout,
      mood
    };
  }

  /** 给用户看的「先告诉我意象与工艺」的一句话 */
  function craftReadout(bp) {
    const b = bp || {};
    const meta = (window.XHFYCraft && window.XHFYCraft.META[b.style]) || {};
    const parts = ["AI 从你的笔迹里读到「" + (b.imagery || "一片心象") + "」"];
    if (b.imageryWhy) parts.push(b.imageryWhy);
    if (meta.short) parts.push("因此以「" + meta.short + "」承载：" + (b.motifWeave || meta.desc || ""));
    return parts.join("——");
  }

  /** 按蓝图调用图像模型，生成整幅非遗作品底图 */
  async function craftRedraw(style, blueprint, analysis, report) {
    const bp = blueprint || {};
    const prompt = bp.prompt || (CRAFT_BRIEF[style] || CRAFT_BRIEF.papercut).name + "：一枝牡丹，红纸镂空，大面积留白，无文字";

    const data = await call("/images/generations", {
      model: AI.imageModel || "cogview-3-flash",
      prompt,
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

  // 图像 CDN（ufileos.com）不返回 CORS 头，canvas 会被污染；
  // images.weserv.nl 是带 `Access-Control-Allow-Origin: *` 的图片网关，可用作只读取图。
  const IMAGE_GATEWAY = "https://images.weserv.nl/?url=";

  /** 把图像 URL 取回为 dataURL（供 canvas 裁切使用） */
  async function imageToDataURL(url) {
    const attempts = [];
    const relay = (AI.relay || "").trim();
    attempts.push(url);
    if (relay) attempts.push(relay.replace("{url}", encodeURIComponent(url)));
    attempts.push(IMAGE_GATEWAY + encodeURIComponent(url) + "&output=png");

    for (const u of attempts) {
      try {
        const res = await fetch(u, { mode: "cors" });
        if (!res.ok) {
          console.warn("[心绘非遗] 取图失败", u.slice(0, 80), "HTTP " + res.status);
          continue;
        }
        return await blobToDataURL(await res.blob());
      } catch (e) {
        console.warn("[心绘非遗] 取图异常", u.slice(0, 80), e && e.message);
      }
    }
    throw new Error("纹样底图受跨域限制，暂时无法裁切");
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
    craftPlan,
    craftBlueprint,
    craftReadout,
    craftRedraw,
    imageToDataURL,
    describeProcess,
    test,
    extractJSON,
    defaultKeyAvailable: !!DEFAULT_KEY
  };
})();
