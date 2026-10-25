/* =========================================================
   心绘非遗 · 心灵图鉴与心愈手作指南
   本地叙事引擎（AI 不可用时的完整降级）
   ========================================================= */
(function () {
  "use strict";

  const DIMENSIONS = [
    { key: "warmth", label: "情绪温度", low: "偏冷", high: "偏暖" },
    { key: "tension", label: "内在张力", low: "松弛", high: "紧绷" },
    { key: "space", label: "留白指数", low: "充盈", high: "空旷" },
    { key: "grounded", label: "扎根感", low: "漂浮", high: "稳定" },
    { key: "vitality", label: "生命活力", low: "收拢", high: "流动" },
    { key: "order", label: "秩序感", low: "自由", high: "有序" }
  ];

  const ELEMENT_DICT = [
    ["海", ["海", "海边", "大海", "海浪", "沙滩", "潮"]],
    ["湖", ["湖", "湖面", "池塘"]],
    ["河", ["河", "溪", "水流"]],
    ["山", ["山", "山谷", "群山", "山顶"]],
    ["树", ["树", "林", "森林", "树下", "树林"]],
    ["落日", ["太阳", "日落", "夕阳", "黄昏", "落日", "晚霞"]],
    ["星空", ["星空", "星星", "夜空", "月亮", "星"]],
    ["小屋", ["屋", "房子", "家", "小屋", "房间"]],
    ["窗", ["窗", "窗外", "阳台"]],
    ["花", ["花", "花园", "草地"]],
    ["云", ["云", "云朵", "雾"]],
    ["路", ["路", "小路", "道路"]]
  ];

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function pct(v) { return Math.round(v); }

  function scoreLabel(key, v) {
    const d = DIMENSIONS.find((x) => x.key === key);
    if (!d) return "";
    if (v >= 72) return d.high;
    if (v <= 34) return d.low;
    return "平衡";
  }

  function dominantNames(analysis) {
    return (analysis.dominantColors || []).slice(0, 3).map((c) => c.name);
  }

  function guessElements(text, analysis) {
    const found = [];
    const t = text || "";
    for (const [name, keys] of ELEMENT_DICT) {
      if (keys.some((k) => t.indexOf(k) >= 0)) found.push(name);
    }
    if (found.length) return found.slice(0, 5);
    if (analysis.metrics.coverage < 0.05) return ["一片留白"];
    const out = [];
    if (analysis.scores.space > 62) out.push("一片留白");
    if (analysis.scores.grounded > 60) out.push("一处落点");
    if (analysis.scores.vitality > 60) out.push("生长的形状");
    if (analysis.scores.tension > 62) out.push("锋利的线");
    if (!out.length) out.push("心里的风景");
    return out.slice(0, 3);
  }

  function archetypeOf(analysis) {
    const s = analysis.scores;
    if (s.space > 64 && s.warmth < 42) return "静海孤舟";
    if (s.warmth > 64 && s.tension < 54) return "暖阳缓流";
    if (s.tension > 64 && s.order < 46) return "风中的线";
    if (s.vitality > 66 && s.warmth >= 42) return "林间回声";
    if (s.grounded > 64) return "山脚有灯";
    if (s.order > 64) return "窗里的秩序";
    if (s.space > 60) return "留白的岸";
    return "心里的那片岸";
  }

  function colorNarrative(analysis) {
    const m = analysis.metrics;
    const names = dominantNames(analysis).join("、");
    const warm = m.warmRatio;
    const cool = m.coolRatio;
    const sat = m.satAvg;
    let s = "";
    if (cool > warm + 0.12) {
      s = "冷色占了画面的大部分。" + (names ? "你在" + names + "之间，给自己围出了一块安静的水域。" : "") +
        "蓝与灰会把情绪放低、放慢。冷色不一定等于低落，它有时是你在替自己降温，让翻涌的部分先沉一沉。";
    } else if (warm > cool + 0.12) {
      s = "暖色从画面里透出来。" + (names ? "赭石、落日或朱砂的" + names + "，让这块地方带着体温。" : "") +
        "你似乎在画里为自己留了一盏灯——即便外面不确定，你仍愿意靠近有温度的东西。";
    } else if (warm + cool < 0.16) {
      s = "你没有用太多颜色，像把声音调小了。低饱和的画面不是空，而是你把感受收得很轻，怕惊动什么。" +
        "这种克制本身，也是一种保护。";
    } else {
      s = "冷暖在画面里交替出现。" + (names ? "主色是" + names + "。" : "") +
        "你一边想要安定，一边又保留着向外走的力气。这种拉扯并不矛盾，它是你正在寻找平衡的证据。";
    }
    if (sat > 0.5) s += "颜色饱和度不低，说明你并不麻木，感受仍然鲜活。";
    else if (sat < 0.18) s += "颜色很淡，像是隔着一层雾在看它。";
    return s;
  }

  function lineNarrative(analysis) {
    const s = analysis.scores;
    const st = analysis.strokeStats;
    const htp = analysis.htp || {};
    let t = "";
    if (s.tension > 64) {
      t = "线条偏紧，边缘清晰，落笔的速度可能不慢。紧绷有时是身体在替你撑住什么，也可能只是你太想把它画准。" +
        "画面里那些反复描过的地方，往往是你最在意的地方。";
    } else if (analysis.lineStyle === "柔和晕染") {
      t = "笔触是化开的，边缘不急着结束。你很允许事情模糊一点，这份松弛本身就是一种资源——不是所有感受都需要被说清楚。";
    } else {
      t = "线条不疾不徐，既有边界，也留了余地。你在控制与放手之间，找到了一个还算舒服的位置。";
    }
    if (htp.lineDirection === "水平为主") t += "画面里横向的线比较多，像是在稳稳地托住什么。";
    else if (htp.lineDirection === "垂直为主") t += "画面里竖向的线比较多，有一股向上的劲儿。";
    if (htp.repeated) t += "有些地方你来回涂了好几遍——反复出现的地方，往往藏着你最想安放的东西。";
    if (htp.pressure === "笔触浓重") t += "笔触落得很重，说明你投入的情感浓度很高。";
    else if (htp.pressure === "笔触轻淡") t += "笔触很轻，像是怕惊动什么，也像在给自己留余地。";
    if (st.strokes >= 12) t += "你落笔很多次，像是在一点一点确认这块地方真的属于你。";
    else if (st.strokes <= 3 && st.strokes > 0) t += "你只用了很少的笔触，果断，也保留了余地。";
    return t;
  }

  function spaceNarrative(analysis) {
    const s = analysis.scores;
    let t = "";
    if (s.space > 64) {
      t = "画面留了很多空白。空白可能是孤独，也可能是自由——你给自己留了很大的呼吸空间。" +
        "有时候，一个人需要先拥有一块空地，才能放得下新的东西。";
    } else if (s.space < 32) {
      t = "画面被填得比较满，像是心里有很多东西同时在场。满不一定是乱，它也可能是一种丰盛。" +
        "如果最近觉得累，也许可以试着在生活里也留出一小块空白。";
    } else {
      t = "画面的疏密比较均衡。你知道什么时候该填满，什么时候该停下来，这是一种不错的节奏感。";
    }
    if (s.grounded > 62) t += "重心落在画面下方，你似乎在寻找一个能踩住的地方，而你已经找到了它。";
    else if (analysis.placement === "重心上浮") t += "重心偏上，你的注意力更多在远处，在还没有发生的地方。";
    const htp = analysis.htp || {};
    if (htp.horizBias === "偏左") t += "画面的重心偏左，像是在从过去里拿一点东西。";
    else if (htp.horizBias === "偏右") t += "画面的重心偏右，像是在朝未来的方向走。";
    if (htp.sizeBias === "画面偏小") t += "整体画得比较小，表达有些克制。";
    else if (htp.sizeBias === "画面偏大") t += "整体画得比较满，情感浓度很高。";
    return t;
  }

  /** 过程印记：说明「怎么画」——时间、停顿、改笔、换色 */
  function processNarrative(analysis) {
    const p = analysis.process || {};
    const b = analysis.behavior || {};
    const parts = [];
    if (p.activeSec) {
      parts.push("你在这幅画上真正落笔约 " + Math.max(1, Math.round(p.activeSec)) + " 秒，落下 " + (p.strokes || 0) + " 笔");
    }
    if (p.distinctColors) {
      parts.push("用了 " + p.distinctColors + " 种颜色" +
        (p.colorSwitches >= 4 ? "，中途换色 " + p.colorSwitches + " 次" : "，颜色始终比较集中"));
    }
    if (p.pauses >= 2) {
      parts.push("落笔之间停顿了 " + p.pauses + " 次" +
        (p.longestPauseSec >= 4 ? "，最长的一次约 " + Math.round(p.longestPauseSec) + " 秒" : ""));
    }
    if (p.changes >= 2) {
      parts.push("有 " + p.changes + " 次撤销或擦除的痕迹");
    }
    if (p.speedLabel === "偏快") parts.push("笔速偏快，能量更愿意往外走");
    else if (p.speedLabel === "偏慢") parts.push("笔速偏慢，每一笔都落得谨慎");
    if (!parts.length) return "这一次你画得很安静，过程本身没有留下太多起伏。";
    let text = parts.join("；") + "。";
    if (b.tags && b.tags.length) {
      text += "过程里最明显的是「" + b.tags[0] + "」——" +
        ((b.details && b.details[0] && b.details[0].hint) || "它也是你此刻状态的一部分") + "。";
    }
    return text;
  }

  /** 当下心情：把六维与过程收成一句可以读出来的描述 */
  function moodNowOf(analysis) {
    const s = analysis.scores;
    const p = analysis.process || {};
    const tone = s.warmth >= 60
      ? "心里还有温度，愿意靠近让你舒服的东西"
      : s.warmth <= 40
        ? "情绪的温度被调得比较低，像把自己收进了一件薄外套"
        : "温度不远不近，你还在试探";
    const energy = s.vitality >= 62
      ? "力气还在流动"
      : s.vitality <= 42
        ? "能量偏低，需要被温和地补一补"
        : "力气不多不少";
    const load = s.tension >= 62
      ? "身体可能还替你绷着什么"
      : p.changes >= 3
        ? "有些地方你反复斟酌过，在意得很认真"
        : "整体是松的，允许事情慢一点";
    return "此刻的你，也许" + tone + "；" + energy + "；" + load + "。";
  }

  /** 心象处方：从知识库里挑最贴合当前状态的调节方法 */
  function regulationsOf(analysis) {
    if (!window.XHFYKnowledge || !window.XHFYKnowledge.recommendRegulation) return [];
    return window.XHFYKnowledge.recommendRegulation(analysis, 3);
  }

  function strengthOf(analysis) {
    const s = analysis.scores;
    const names = dominantNames(analysis);
    if (s.vitality >= 66) return "你还愿意用颜色，这本身就是生命力。画面里那处" + (names[0] || "亮色") + "，是你给自己留下的出口。";
    if (s.grounded >= 66) return "你给画面留了一个可以站住的地方。那种「脚踩在地上」的感觉，会帮你度过很多摇晃的时刻。";
    if (s.order >= 66) return "你在不确定里仍然画出了秩序。那些重复的线、靠近中心的形状，都是你内在的稳定器。";
    if (s.tension >= 66) return "那些紧绷的线，也在替你表达。它们不是缺点，是你曾经努力撑住的证据。";
    if (s.space >= 66) return "你敢于留白。不是每个人都能忍受空白，而你已经在空白里待了一会儿。";
    return "你愿意停下来画一幅画，这件事本身，就是你在照顾自己。";
  }

  function whisperOf(analysis) {
    const s = analysis.scores;
    if (s.tension > 64) return "不必急着把线画直。先松一松握笔的手，肩膀也会跟着松下来。";
    if (s.space > 64) return "不必急着填满。空白不是缺口，是你留给自己的呼吸。";
    if (s.warmth < 40) return "不必急着好起来。先允许自己在这片冷色里停一会儿。";
    return "你已经把说不出口的部分，画出来了。接下来，让它慢慢变成一件可以触摸的东西。";
  }

  function pickCraft(analysis) {
    const s = analysis.scores;
    if (s.order > 62 && s.tension < 58) return "bamboo";
    if (s.space > 60 && s.warmth < 48) return "tiedye";
    if (s.warmth > 58 && s.tension > 46) return "papercut";
    if (s.space > 52) return "calico";
    return "papercut";
  }

  const CRAFT_REASON = {
    papercut: "你的线条有清晰的轮廓和方向感，适合被收拢成剪纸的刀路；红纸的暖，也能接住画面里的情绪。",
    tiedye: "画面里的冷色与留白比较多，像一块被水浸过的布。扎染的晕染与冰裂纹，能让这种安静继续扩散。",
    calico: "你的画面有明确的形状与边界，适合变成蓝印花布的白花靛底；防染的留白，正好像你给自己的空间。",
    bamboo: "画面的秩序感与重复线条，适合竹编的经纬节奏。一压一挑，会把纷乱的心绪慢慢编回位置。"
  };

  const GUIDES = {
    papercut: {
      intro: "剪纸是一种「减法」：不是往上加，而是一刀一刀把不需要的部分去掉。对你来说，这也许正是一次温柔的放下。",
      materials: ["红纸或朱砂宣纸 1 张", "小剪刀 1 把", "美工刀 + 垫板", "铅笔与橡皮", "固体胶或白乳胶"],
      steps: [
        { title: "净手，落座", text: "把手机调成静音，双手平放在纸上。做三次慢呼吸：吸气 4 拍，呼气 6 拍。让肩膀先落下来。" },
        { title: "把图样拓下来", text: "将图样打印出来，或用铅笔轻轻描在红纸背面。描的时候不用完全精准，手抖的地方就让它抖。" },
        { title: "先剪大形", text: "从外轮廓开始，剪刀沿着线慢慢走。每剪一段，就呼吸一次；如果心急了，就停下来看看已经剪出的形状。" },
        { title: "再刻花孔", text: "把红纸放在垫板上，用美工刀刻出内部的花孔。刀尖只走一小段，像把心里的结一点一点挑开。" },
        { title: "压平，安放", text: "把剪纸夹进一本厚书里压 10 分钟。取出来后，贴到窗前或送给自己，并在背面写下一句此刻想说的话。" }
      ],
      mantra: "一刀一线，不急；呼吸到哪里，手就到哪里。"
    },
    tiedye: {
      intro: "扎染的迷人之处，是你无法完全控制它。你只能扎结、浸染，然后把手松开，接受布自己长出来的样子。",
      materials: ["纯棉方巾 1 块", "靛蓝染液或染粉", "橡皮筋 6–10 根", "木夹或竹筷", "橡胶手套", "清水与晾晒绳"],
      steps: [
        { title: "浸湿，静心", text: "先把棉布浸湿、拧到不滴水。摸着布的纹理做三次呼吸，感受水从指缝里慢慢流走。" },
        { title: "折出心象", text: "把布对折、再对折，或者从中心抓起拧成一股。用橡皮筋扎紧，扎几圈由你决定——扎得越紧，留白越清晰。" },
        { title: "浸入染缸", text: "戴好手套，把布浸入靛蓝染液。轻轻按压，让染液进入纤维。心里默数 30 秒，再把布提起来接触空气。" },
        { title: "氧化，等待", text: "布从黄绿慢慢变成蓝色，这是靛蓝在呼吸。重复浸染 2–3 次，每一次都给自己多一点等待的时间。" },
        { title: "拆线，摊开", text: "用清水冲净，再拆开橡皮筋。不要期待它和想象一样——晕开的边缘，正是扎染替你保留的意外。" }
      ],
      mantra: "扎紧，是为了松开；染上，是为了让光进来。"
    },
    calico: {
      intro: "蓝印花布用「防染」留住白色：把不想被染的部分盖住，再让靛蓝去拥抱其余的地方。它像在提醒你，界限也可以是一种温柔。",
      materials: ["纯棉白布 1 块", "靛蓝染液", "防染浆（黄豆粉+石灰水）", "图样与刻版纸", "刮刀或旧银行卡", "晾晒架"],
      steps: [
        { title: "铺布，定心", text: "把白布平铺在桌上，四角用重物压住。手掌从中间向四周抚平，像把心里的褶皱也一并抹开。" },
        { title: "刻出图样", text: "把图样描在刻版纸上，用刻刀镂空。刻的时候只关注刀尖和线，其他念头来了，就让它们路过。" },
        { title: "刮浆防染", text: "把刻版放在布上，用刮刀把防染浆均匀刮过镂空处。刮一下，停一下，感受手腕的力度。" },
        { title: "浸染靛蓝", text: "等浆干透，把布浸入染缸。重复浸染、氧化 2–3 次。蓝色会一层层加深，像情绪慢慢沉淀。" },
        { title: "洗去浆，晾干", text: "用清水洗去防染浆，白色纹样会重新露出来。把它挂在有风的地方晾干，也让自己吹一会儿风。" }
      ],
      mantra: "盖住一部分，才有白；留一点界限，才有蓝。"
    },
    bamboo: {
      intro: "竹编是重复的艺术：一压一挑，经纬交错。它不要求你一次做对，只要求你一根一根地编下去。",
      materials: ["竹篾或纸藤 20 根", "剪刀", "白乳胶", "底板或相框", "镊子", "喷壶（保持竹篾柔韧）"],
      steps: [
        { title: "润篾，起底", text: "把竹篾喷湿，让它柔软。先横向铺 8 根，间距约一指宽，用手掌压平。" },
        { title: "一压一挑", text: "拿起第一根竖篾，从横篾下面穿过，再压在上面。每穿一根，呼吸一次，不要赶。" },
        { title: "照图收形", text: "把图样垫在下面，用深色竹篾编出画面里的形状。看不清的地方不用勉强，留白也是图案。" },
        { title: "收边固定", text: "把四边多出的竹篾折回，用白乳胶粘牢。用手指沿着边缘压一遍，像给这件事画一个句号。" },
        { title: "装框，安放", text: "把竹编放进相框或贴在底板。退后两步看看它——那些重复的经纬，已经替你安放了一部分心绪。" }
      ],
      mantra: "一压一挑，一格一格；心乱的时候，就先编下一根。"
    }
  };

  /* ---------------- 分析依据（本地兜底） ---------------- */

  function evidenceOf(analysis) {
    const s = analysis.scores;
    const m = analysis.metrics;
    const p = analysis.process || {};
    const out = [];
    out.push("内在张力 " + s.tension + "/100（边缘锐利度 " + m.edgeStrength + "，笔触密度 " +
      Math.round(m.edgeDensity * 100) + "%）→ " +
      (s.tension >= 65 ? "画面里有较明显的撑紧感" : s.tension >= 45 ? "有张力，但仍在可控范围" : "笔触相对松弛，张力不高") +
      "（HTP 笔触力度）");
    out.push("色彩冷暖：暖 " + Math.round(m.warmRatio * 100) + "% / 冷 " + Math.round(m.coolRatio * 100) + "%，饱和度 " +
      m.satAvg + " → " +
      (m.warmRatio > m.coolRatio + 0.12 ? "更靠近体温与外部能量" : m.coolRatio > m.warmRatio + 0.12
        ? "更靠近安静与向内收" : "冷暖同时在场，情绪并存") + "（色彩心理学）");
    out.push("覆盖度 " + Math.round(m.coverage * 100) + "%，留白指数 " + s.space + "/100 → " +
      (s.space >= 70 ? "保留了很多未被言说的空间" : s.space >= 40 ? "疏密之间还能呼吸" : "画面被填得较满，透气的余地不多") +
      "（EAT 空间与容器）");
    out.push("重心 x=" + m.centroid.x + "、y=" + m.centroid.y + "（0 左上，1 右下）→ " +
      analysis.placement + "，对应" +
      (analysis.placement === "重心下沉" ? "对安全感与基础的关注" : analysis.placement === "重心上浮"
        ? "对想象与向上的期待" : "相对平衡的自我位置") + "（HTP 空间投射）");
    if (p.strokes) {
      out.push("过程：落笔 " + Math.round(p.activeSec || 0) + " 秒 / 停顿 " + (p.pauses || 0) + " 次 / 撤销 " +
        (p.undo || 0) + " 次 / 换色 " + (p.colorSwitches || 0) + " 次 → " +
        ((p.undo || 0) >= 3 ? "对某些部分格外在意，反复调整" :
          (p.pauses || 0) >= 2 ? "落笔之间在斟酌与整理" : "下笔比较连贯，表达较直接") + "（EAT 过程即调节）");
    }
    return out.slice(0, 5);
  }

  function alternativeOf(analysis) {
    const s = analysis.scores;
    if (s.tension >= 60) {
      return "也可以换个方向看：这股张力也许不是压力，而是你把注意力集中在一处的证据——画面里线条的密度与力度说明你在意它。本次更倾向「撑紧」这一解读，是因为同时出现了留白收缩（留白指数 " +
        s.space + "/100）与重心" + analysis.placement.replace("重心", "") + "，两者一起更像是在用力维持某个位置，而不只是专注。";
    }
    if (s.space >= 70) {
      return "也可以换个方向看：大面积留白也许不是孤独，而是你给自己留的余地，是一种有意识的节制（EAT 允许模糊）。本次更倾向「留有余地」这一解读，是因为笔触数量与落笔时长都还在，说明并非无力落笔，而是选择不填满。";
    }
    return "也可以换个方向看：画面里较满的分布也许不是压抑，而是表达欲旺盛、愿意把感受铺开（EAT 材料作为情绪容器）。本次更倾向「信息较密」这一解读，是因为线条方向" +
      (analysis.htp.lineDirection || "较多变") + "且换色 " + ((analysis.process || {}).colorSwitches || 0) +
      " 次，能量更偏向外放。";
  }

  function confidenceOf(analysis) {
    const p = analysis.process || {};
    const enough = (p.strokes || 0) >= 5 && analysis.metrics.coverage > 0.025;
    if (enough) return "较有把握：笔触与过程数据较充分，结论有量化依据";
    if ((p.strokes || 0) >= 2) return "可能：画面信息偏少，解读仅作参考";
    return "难以判断：落笔过少，建议多画几笔再读";
  }

  function makeFallbackReport(analysis, userText, vision) {
    const v = vision || {};
    const archetype = archetypeOf(analysis);
    const elements = (v.elements && v.elements.length) ? v.elements : guessElements(userText, analysis);
    const style = pickCraft(analysis);
    const s = analysis.scores;
    const names = dominantNames(analysis);

    const summary = "你这幅画里，" +
      (analysis.colorStyle === "冷色主导" ? "冷色像一片安静的水面" :
        analysis.colorStyle === "暖色主导" ? "暖色像一盏没有关掉的灯" :
          analysis.colorStyle === "低饱和中性" ? "颜色被调得很轻" : "冷暖两种温度同时在场") +
      "；" + (analysis.lineStyle === "细密锋利" ? "线条细而紧，像有很多话要说" :
        analysis.lineStyle === "柔和晕染" ? "笔触是化开的，边缘不急着结束" : "线条疏朗，留了余地") +
      "；" + (s.space > 60 ? "画面留了很多空白" : s.space < 32 ? "画面被填得很满" : "疏密之间有一种呼吸感") +
      "。它不像一张风景照，更像你此刻心里的一块地方——也许不完美，但它是你的。";

    return {
      title: archetype,
      archetype,
      summary,
      evidence: evidenceOf(analysis),
      alternative: alternativeOf(analysis),
      confidence: confidenceOf(analysis),
      colors: colorNarrative(analysis),
      lines: lineNarrative(analysis),
      space: spaceNarrative(analysis),
      strength: strengthOf(analysis),
      whisper: whisperOf(analysis),
      process: processNarrative(analysis),
      mood: moodNowOf(analysis),
      regulations: regulationsOf(analysis),
      craft: {
        style,
        reason: CRAFT_REASON[style],
        elements: elements.slice(0, 3).join("、") + " 被转译为" + XHFYCraft.META[style].grammar.split(" · ")[0] + "纹样"
      },
      guide: {
        intro: GUIDES[style].intro,
        materials: GUIDES[style].materials,
        steps: GUIDES[style].steps,
        mantra: GUIDES[style].mantra
      },
      vision: {
        elements,
        scene: (v.scene || ""),
        mood: (v.mood || ""),
        note: (v.note || ""),
        // 元素位置：AI 二创需要它来复刻原画构图
        layout: (v.layout || ""),
        colors: (v.dominantColors && v.dominantColors.length) ? v.dominantColors : names
      },
      source: "local"
    };
  }

  /* ---------------- 雷达图 ---------------- */

  let radarSeq = 0;

  function radarSVG(scores, options) {
    const o = options || {};
    const size = o.size || 360;
    const cx = size / 2;
    const cy = size / 2;
    const R = size * 0.32;
    const dark = !!o.dark;
    const ink = dark ? "rgba(239,232,218,0.9)" : "#1E1C19";
    const line = dark ? "rgba(239,232,218,0.14)" : "rgba(30,28,25,0.14)";
    const accent = dark ? "#D8B48A" : "#A63A2B";
    const fill = dark ? "rgba(216,180,138,0.16)" : "rgba(166,58,43,0.12)";
    const id = "radarGrad" + (++radarSeq);

    const axes = DIMENSIONS.map((d, i) => {
      const a = (Math.PI * 2 * i) / DIMENSIONS.length - Math.PI / 2;
      return { d, a, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
    });

    let rings = "";
    for (let r = 1; r <= 4; r++) {
      const rr = (R * r) / 4;
      const pts = axes.map((ax) => {
        const a = ax.a;
        return (cx + Math.cos(a) * rr).toFixed(1) + "," + (cy + Math.sin(a) * rr).toFixed(1);
      }).join(" ");
      rings += '<polygon points="' + pts + '" fill="none" stroke="' + line + '" stroke-width="1"/>';
    }

    let spokes = "";
    axes.forEach((ax) => {
      spokes += '<line x1="' + cx + '" y1="' + cy + '" x2="' + ax.x.toFixed(1) + '" y2="' + ax.y.toFixed(1) + '" stroke="' + line + '" stroke-width="1"/>';
    });

    const pts = DIMENSIONS.map((d, i) => {
      const a = (Math.PI * 2 * i) / DIMENSIONS.length - Math.PI / 2;
      const v = clamp((scores[d.key] || 0) / 100, 0.04, 1);
      return {
        x: cx + Math.cos(a) * R * v,
        y: cy + Math.sin(a) * R * v
      };
    });
    const poly = pts.map((p) => p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ");

    let dots = "";
    pts.forEach((p) => {
      dots += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + (size * 0.008) + '" fill="' + accent + '"/>';
    });

    let labels = "";
    axes.forEach((ax, i) => {
      const a = ax.a;
      const lx = cx + Math.cos(a) * (R + size * 0.105);
      const ly = cy + Math.sin(a) * (R + size * 0.105);
      const anchor = Math.abs(Math.cos(a)) < 0.25 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
      const v = scores[ax.d.key];
      labels += '<text x="' + lx.toFixed(1) + '" y="' + (ly - 5).toFixed(1) + '" fill="' + (dark ? "rgba(239,232,218,0.72)" : "#6F675A") + '" font-size="' + (size * 0.03) + '" text-anchor="' + anchor + '" font-family="PingFang SC,Microsoft YaHei,sans-serif" letter-spacing="1">' + ax.d.label + '</text>';
      labels += '<text x="' + lx.toFixed(1) + '" y="' + (ly + size * 0.038).toFixed(1) + '" fill="' + accent + '" font-size="' + (size * 0.033) + '" text-anchor="' + anchor + '" font-family="Songti SC,STSong,serif">' + v + '</text>';
    });

    return '<svg viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="六维心象雷达图" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><radialGradient id="' + id + '"><stop offset="0%" stop-color="' + (dark ? "rgba(216,180,138,0.32)" : "rgba(166,58,43,0.24)") + '"/><stop offset="100%" stop-color="' + fill + '"/></radialGradient></defs>' +
      rings + spokes +
      '<polygon points="' + poly + '" fill="url(#' + id + ')" stroke="' + accent + '" stroke-width="' + (size * 0.005) + '" stroke-linejoin="round"/>' +
      dots + labels +
      '<text x="' + cx + '" y="' + (cy + 4) + '" fill="' + ink + '" font-size="' + (size * 0.026) + '" text-anchor="middle" font-family="Songti SC,STSong,serif" opacity="0.55">心象</text>' +
      '</svg>';
  }

  function dimensionHTML(scores) {
    return DIMENSIONS.map((d) => {
      const v = scores[d.key];
      return '<article class="dim-card">' +
        '<div class="dim-head"><span>' + d.label + ' · ' + scoreLabel(d.key, v) + '</span><b>' + v + '</b></div>' +
        '<div class="dim-bar"><i data-score="' + v + '"></i></div>' +
        '<p>' + dimensionCopy(d.key, v) + '</p>' +
        '</article>';
    }).join("");
  }

  function dimensionCopy(key, v) {
    const high = v >= 68;
    const low = v <= 32;
    const map = {
      warmth: high ? "画面有体温，你愿意靠近暖的东西。" : low ? "你把温度调低了，情绪像一潭静水。" : "冷暖之间，你保留了自己的温度。",
      tension: high ? "线条绷得紧，画面里有一股向外的力。" : low ? "笔触松下来，你在允许事情慢一点。" : "有一点紧，也有一点松，张力刚好。",
      space: high ? "留白很多，你给自己留了呼吸的余地。" : low ? "画面很满，心里有很多东西同时在场。" : "疏密有致，节奏是舒服的。",
      grounded: high ? "重心稳，你正在找到可以站住的地方。" : low ? "重心有点飘，你还在寻找落点。" : "不算飘，也还没完全落地。",
      vitality: high ? "色彩与覆盖度都在，生命力仍在流动。" : low ? "颜色收得很轻，像把声音调小了。" : "有生气，但不喧闹。",
      order: high ? "画面有秩序，你在试着把事放回位置。" : low ? "结构自由，你不愿被规则框住。" : "有秩序，也留了自由的缝隙。"
    };
    return map[key] || "";
  }

  function dateText() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "." + p(d.getMonth() + 1) + "." + p(d.getDate());
  }

  function reportNo() {
    const t = Date.now().toString(36).toUpperCase().slice(-5);
    return "XHFY-" + t;
  }

  function makeGuide(style, reportObj) {
    if (reportObj && reportObj.craft && reportObj.craft.style === style &&
      reportObj.guide && reportObj.guide.steps && reportObj.guide.steps.length) return reportObj.guide;
    return {
      intro: GUIDES[style].intro,
      materials: GUIDES[style].materials,
      steps: GUIDES[style].steps,
      mantra: GUIDES[style].mantra
    };
  }

  window.XHFYReport = {
    DIMENSIONS,
    radarSVG,
    dimensionHTML,
    scoreLabel,
    makeFallbackReport,
    processNarrative,
    moodNowOf,
    regulationsOf,
    makeGuide,
    pickCraft,
    dateText,
    reportNo,
    GUIDES,
    archetypeOf
  };
})();
