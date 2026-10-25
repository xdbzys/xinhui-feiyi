/* =========================================================
   心绘非遗 · 轻量心理学知识库
   只收录「能直接拆成规则」的投射 / 色彩 / 表达性艺术治疗 / 正念知识。
   它既是本地叙事的依据，也是 ai.js 系统提示词的「专家知识边界」：
   AI 只能在这个框架内组织语言，不能自由发明结论。

   参考框架：
   · HTP 屋树人投射测验（空间、大小、线条、元素象征）
   · 表达性艺术治疗（Malchiodi / Hinz 的 ETC 连续系统）
   · 应用色彩心理学（Karen Haller / 金容淑）
   · 正念艺术治疗与 MBCT / MBSR 的呼吸、着陆、身体扫描
   ========================================================= */
(function () {
  "use strict";

  // ---------- 空间位置（HTP） ----------
  const spatial = [
    { feature: "画面重心偏上", meaning: "更接近想象、期待与精神层面，有时意味着对现实的轻微回避或向上的渴望" },
    { feature: "画面重心偏下", meaning: "更关注安全感、物质基础与脚踏实地；偏低有时伴随不安全感或无力感" },
    { feature: "画面重心偏左", meaning: "更内省、依恋过去，或正在从已有经验中汲取力量" },
    { feature: "画面重心偏右", meaning: "更面向未来、外向、期待改变与行动" },
    { feature: "画面重心居中", meaning: "比较平衡，能同时容纳过去与未来" },
    { feature: "画面偏小", meaning: "自我表达相对克制，可能伴随低能量或对环境的谨慎" },
    { feature: "画面偏大", meaning: "自我感较强、表达外放，可能伴随张力或情绪浓度" },
    { feature: "主体贴近边缘", meaning: "可能有被挤压、想退出或寻找边界的感觉" }
  ];

  // ---------- 线条与笔触 ----------
  const lines = [
    { feature: "长而连贯的线条", meaning: "对行为有较好的控制，有时伴随自我压抑" },
    { feature: "短而断续的线条", meaning: "更冲动、敏感，能量在小范围里释放" },
    { feature: "水平线条为主", meaning: "自我保护、谨慎，也可能是无力感的信号" },
    { feature: "垂直线条为主", meaning: "自信、坚决，有向上的动力" },
    { feature: "刚硬直线", meaning: "僵硬、防御或带攻击性倾向" },
    { feature: "曲线为主", meaning: "灵活、有弹性，对传统规则较为松弛" },
    { feature: "反复涂抹 / 反复加重", meaning: "内在冲突、纠结，对该区域格外在意" },
    { feature: "轻淡笔触", meaning: "低能量、不确定、安全感不足" },
    { feature: "浓重笔触", meaning: "情感浓度高，可能伴随焦虑或用力" },
    { feature: "快速挥洒的笔触", meaning: "情绪流动快，可能是在释放积压的张力" }
  ];

  // ---------- 色彩—情绪对照 ----------
  // key 同时用于 UI 色板名与本地色相命名
  const colors = {
    red: { name: "朱砂 / 红", emotion: "热情、张力、生命力；过浓时可能伴随愤怒或焦虑", tone: "warm" },
    orange: { name: "落日 / 橙", emotion: "活力、社交、温暖，略带不安定", tone: "warm" },
    yellow: { name: "黄", emotion: "明快、希望、向外的能量；过多可能焦躁", tone: "warm" },
    green: { name: "竹青 / 苔绿", emotion: "生长、平和、疗愈，与自然联结", tone: "cool" },
    blue: { name: "湖蓝 / 蓝", emotion: "安静、信任、沉思；过深时可能低落或退缩", tone: "cool" },
    indigo: { name: "靛蓝", emotion: "内省、直觉、精神性；也可能是情绪的内敛与克制", tone: "cool" },
    purple: { name: "紫黛", emotion: "敏感、想象力、自我感受；过深时容易沉入内在", tone: "cool" },
    brown: { name: "赭石 / 棕", emotion: "踏实、土地、物质安全感", tone: "warm" },
    black: { name: "墨 / 黑", emotion: "沉重、边界、防御；也可以是力量与聚焦", tone: "neutral" },
    white: { name: "月白 / 白", emotion: "留白、清理、未言说的部分", tone: "neutral" },
    gray: { name: "雾灰", emotion: "过渡、模糊、情绪尚未被命名", tone: "neutral" }
  };

  // ---------- 常见画面元素（山水投射） ----------
  const elements = [
    { feature: "树", meaning: "常被视为自我力量的投射。树干粗壮=自我支撑较强；树冠大=思绪与想象丰富；树根明显=与现实、家庭的连接更强；空心或折断=可能有耗竭感" },
    { feature: "山", meaning: "常象征目标、压力或需要翻越的东西。山在远处=目标尚远但可望；山压得很低=压力感明显；山间有路=感到有出路" },
    { feature: "水（海 / 湖 / 河）", meaning: "常与情绪流动有关。平静水面=情绪相对稳定；浪大=情绪起伏；水在画面下方=情绪承载在身体层面" },
    { feature: "房子 / 小屋", meaning: "常象征自我与家庭。屋顶大=思考与幻想多；门窗大=愿意与外界连接；门窗紧闭=防御或需要私密空间" },
    { feature: "太阳 / 落日", meaning: "常象征希望、父亲形象或生命能量。旭日=新的开始；落日=收束与告别；太阳被遮住=力量暂时被挡住" },
    { feature: "云 / 雾", meaning: "常象征不确定、模糊或保护。薄云=轻盈的心情；浓雾=方向感暂时不清" },
    { feature: "路 / 小径", meaning: "常象征选择与行动方向。路通向远方=愿意向前；路断掉=犹豫或受阻" },
    { feature: "窗", meaning: "常象征与外界的连接方式。开窗=愿意被看见；关窗=需要边界；窗里有灯=仍有期待" },
    { feature: "星空 / 月亮", meaning: "常象征理想、远方与孤独感。星空大=想象与渴望多；一个人在星空下=渺小感或宁静感" },
    { feature: "花 / 草", meaning: "常象征生命力与柔软的部分。花开=愿意生长；花草稀疏=能量较低" }
  ];

  // ---------- 空间与留白 ----------
  const space = [
    { feature: "大面积留白", meaning: "保留了很多未被言说的部分，可能是孤独，也可能是需要独处的空间" },
    { feature: "画面充盈", meaning: "情感丰富、表达欲强，有时也意味着难以留白的紧绷" },
    { feature: "下方留白多", meaning: "与身体 / 现实的连接较弱，更活在想象或思考里" },
    { feature: "上方留白多", meaning: "更务实、扎根，但对未来的想象相对克制" }
  ];

  // ---------- 表达性艺术治疗（EAT）原则 ----------
  const eatPrinciples = [
    "创作过程本身就是调节：不需要画得好看，动手已经在改变情绪状态（Malchiodi）",
    "艺术材料是情绪的容器：把难以言说的感受放进颜色、线条和形状里，比直接说出来更安全",
    "表达性艺术治疗连续系统（ETC）从动觉/感官层开始：先动起来、先感受材料，再谈意义",
    "重复、有节奏的动作能把注意力锚定在此刻，这是手作疗愈的核心机制",
    "作品不需要被解释得完全清楚；保留一点模糊，等于给情绪留了余地"
  ];

  // ---------- 正念手作原则 ----------
  const craftPrinciples = [
    "重复的身体动作（剪裁、扎结、编织、上色）能把注意力从思绪拉回此刻",
    "手作的过程比成品更重要：允许不完美，本身就是对自我的温柔",
    "每一次呼吸配合一次动作，是把正念放进肌肉记忆里",
    "把情绪交给一种古老的手艺，等于把难以言说的感受交给一个安全的容器"
  ];

  // ---------- 情绪调节方法库 ----------
  // 每条都有可解释的适用条件；本地与 AI 都只能从这里选择
  const regulations = [
    {
      id: "breath478",
      name: "4-7-8 呼吸锚定",
      duration: "3 分钟",
      tag: "呼吸 · 降张力",
      science: "延长呼气会提升迷走神经张力，帮助生理唤醒回落；MBCT 的「呼吸空间」使用同一机制。",
      steps: [
        "坐直，双脚踩地，舌尖轻抵上颚。",
        "用鼻子吸气 4 拍，轻轻屏住 7 拍。",
        "用嘴缓缓呼气 8 拍，像吹凉一杯热茶。",
        "重复 4 轮，把注意力放在呼气末端的那一点安静上。",
        "回到画前，看一分钟，不评价它。"
      ],
      score(a) {
        const s = a.scores;
        const p = a.process || {};
        return (s.tension >= 62 ? 3 : s.tension >= 50 ? 1 : 0) +
          ((p.undo || 0) + (p.eraser || 0) >= 3 ? 1.5 : 0) +
          (p.longestPauseSec >= 5 ? 0.8 : 0) +
          (p.speedLabel === "偏快" ? 1 : 0);
      },
      why(a) {
        const s = a.scores;
        const p = a.process || {};
        return "你的内在张力是 " + s.tension + "/100" +
          (p.pauses ? "，作画中有 " + p.pauses + " 次明显停顿" : "") +
          "。身体可能还在替你把什么撑住，先用呼吸把肩膀放下来。";
      }
    },
    {
      id: "grounding54321",
      name: "5-4-3-2-1 感官着陆",
      duration: "5 分钟",
      tag: "感官 · 回到当下",
      science: "用五感把注意力从反刍思维拉回当下，是正念与创伤知情练习中常用的稳定化技术。",
      steps: [
        "说出你看见的 5 样东西，并指出其中最让你舒服的颜色。",
        "摸 4 样东西：桌面的温度、纸张的纹理、衣服的布料、自己的手背。",
        "听 3 种声音：远处的、近处的、自己呼吸的声音。",
        "闻 2 种气味，或回忆两种让你安心的味道。",
        "感受 1 次完整的呼吸，然后把那个舒服的颜色画在纸角。"
      ],
      score(a) {
        const s = a.scores;
        const p = a.process || {};
        return (s.grounded <= 38 ? 3 : s.grounded <= 50 ? 1.2 : 0) +
          (s.space >= 64 ? 1.5 : 0) +
          (p.longestPauseSec >= 8 ? 1 : 0) +
          (s.warmth <= 40 ? 1 : 0);
      },
      why(a) {
        return "画面的扎根感是 " + a.scores.grounded + "/100，留白指数是 " + a.scores.space +
          "/100。你可能有一部分还飘在思绪里，先用五感把自己接回房间。";
      }
    },
    {
      id: "colorReplenish",
      name: "色彩补全练习",
      duration: "4 分钟",
      tag: "色彩 · 补充能量",
      science: "色彩与情绪存在跨通道联想；在低饱和画面里加入一点暖色或绿色，能提升唤醒与生命感。",
      steps: [
        "从色板里选一个你最少用的颜色：落日橘、苔绿或湖蓝。",
        "在画面最空的地方，轻轻落下 3 笔，不需要画成具体的东西。",
        "退后一步看 30 秒，注意身体有没有一点点变暖或变松。",
        "把这个颜色带到现实里：一杯暖茶、一件绿衣服、一条蓝色的围巾。",
        "如果愿意，在纸角写下这个颜色此刻给你的一个词。"
      ],
      score(a) {
        const s = a.scores;
        const p = a.process || {};
        return (s.warmth <= 42 ? 2.5 : s.warmth <= 52 ? 1 : 0) +
          (s.vitality <= 45 ? 2 : s.vitality <= 58 ? 0.8 : 0) +
          (p.distinctColors <= 1 ? 2 : p.distinctColors === 2 ? 0.8 : 0);
      },
      why(a) {
        const names = (a.dominantColors || []).map((c) => c.name).slice(0, 2).join("、") || "单一颜色";
        return "画面主要由 " + names + " 构成，情绪温度是 " + a.scores.warmth +
          "/100。不是要你变开心，而是给画面补一点有生命感的颜色。";
      }
    },
    {
      id: "container",
      name: "为情绪画一个容器",
      duration: "6 分钟",
      tag: "边界 · 安放",
      science: "表达性艺术治疗强调「安全容器」：把难以言说的感受放进一个有边界的形状里，能降低被淹没感。",
      steps: [
        "在画纸外圈画一个不完美的圆或方框，允许线条抖。",
        "在框上留一个小小的缺口，表示情绪可以有出口。",
        "在框内选一个最乱的位置，用手指轻轻按住 3 次呼吸。",
        "在框外写一个词，描述你此刻最想放下的东西。",
        "看着这个容器说：这些感受可以暂时放在这里。"
      ],
      score(a) {
        const s = a.scores;
        return (s.tension >= 60 && s.order <= 50 ? 3 : 0) +
          (s.space <= 34 ? 1.5 : 0) +
          (a.process && a.process.strokes >= 14 ? 0.8 : 0);
      },
      why(a) {
        return "你的画面张力偏高（" + a.scores.tension + "/100），同时秩序感是 " + a.scores.order +
          "/100。与其把乱的感受压下去，不如先给它一个清楚的边界。";
      }
    },
    {
      id: "rhythmWeave",
      name: "重复手作锚定",
      duration: "10 分钟",
      tag: "手作 · 节奏",
      science: "重复的身体动作会把注意力锚定在此刻，属于 ETC 连续系统的动觉 / 感官层。",
      steps: [
        "选一个简单动作：折纸、剪直线、编一根绳或给图样上色。",
        "动作配合呼吸：吸气做一次，呼气做一次，数到 10。",
        "数乱了你也不用重来，从当下的数字继续。",
        "停下来，感受手掌的温度和纸张的触感 30 秒。",
        "把完成的一小块放在画旁，告诉自己：我已经做了一点。"
      ],
      score(a) {
        const s = a.scores;
        return 1 +
          (s.order >= 60 ? 1.2 : 0) +
          (s.grounded >= 60 ? 1 : 0) +
          (a.process && a.process.activeSec >= 60 ? 0.8 : 0);
      },
      why() {
        return "重复动作是最温和的锚。你不需要想清楚什么，只需要让手先动起来，注意力会自己跟过来。";
      }
    },
    {
      id: "selfCompassion",
      name: "自我关怀三句话",
      duration: "2 分钟",
      tag: "自我 · 允许",
      science: "自我关怀练习能降低自我批评带来的附加压力（Neff 的自我关怀框架）。",
      steps: [
        "把一只手放在胸口，感受掌心的温度。",
        "第一句：我现在这样，是可以的。",
        "第二句：很多人都会有这样的时刻，我并不奇怪。",
        "第三句：我愿意对自己温柔一点，哪怕只是一点点。",
        "选一句写在画的背面，字丑也没关系。"
      ],
      score(a) {
        const s = a.scores;
        const p = a.process || {};
        return (s.warmth <= 42 ? 1.5 : 0) +
          ((p.undo || 0) + (p.eraser || 0) >= 3 ? 2 : 0) +
          (a.behavior && a.behavior.tags.indexOf("反复修改") >= 0 ? 1 : 0);
      },
      why() {
        return "你在画里反复调整过一些地方，说明你很在意它。把这份在意也分一点给自己。";
      }
    },
    {
      id: "bodyScan",
      name: "三分钟身体扫描",
      duration: "3 分钟",
      tag: "身体 · 松开",
      science: "身体扫描训练注意力在身体感受上的流动，帮助识别并松开紧张区域（MBSR / MBCT）。",
      steps: [
        "闭上眼睛，把注意力放到脚底与地面的接触。",
        "慢慢经过小腿、腹部、肩膀、下颌、额头。",
        "遇到紧的地方，不急着放松，先陪它呼吸 3 次。",
        "最后把注意力放回整个身体，感受它的重量。",
        "睁开眼睛，先看画里最柔和的那一处。"
      ],
      score(a) {
        const s = a.scores;
        const p = a.process || {};
        return (s.tension >= 64 ? 2.5 : 0) +
          (p.longestPauseSec >= 6 ? 1 : 0) +
          (p.speedLabel === "偏快" ? 0.8 : 0);
      },
      why(a) {
        return "线条的张力是 " + a.scores.tension +
          "/100。先把注意力放回身体，情绪的结往往先松在肩膀和下颌。";
      }
    },
    {
      id: "movementRelease",
      name: "大笔触释放",
      duration: "3 分钟",
      tag: "动觉 · 释放",
      science: "大幅、快速的动觉表达可以释放躯体张力，对应 ETC 的动觉 / 感官层。",
      steps: [
        "拿一张废纸，把笔触调到最大。",
        "用整条手臂画圈 60 秒，不评价形状。",
        "试着加重力度 10 秒，再突然放松。",
        "停下，甩甩手腕，做三次深呼吸。",
        "回到你的画，看看有没有哪一处想再补一笔。"
      ],
      score(a) {
        const s = a.scores;
        const p = a.process || {};
        return (s.tension >= 66 ? 2 : 0) +
          (p.speedLabel === "偏快" ? 1.5 : 0) +
          ((p.undo || 0) + (p.eraser || 0) >= 4 ? 1 : 0);
      },
      why(a) {
        return "你落笔的节奏偏快，张力也偏高（" + a.scores.tension + "/100）。有些情绪不适合慢慢说，适合先大幅度地动出去。";
      }
    }
  ];

  // ---------- 行为标签（过程信号） ----------
  const behaviorRules = [
    { id: "hesitate", label: "反复修改", hint: "反复撤销或擦除，通常意味着对某个区域格外在意，或担心做错" },
    { id: "decisive", label: "落笔笃定", hint: "很少撤销与擦除，表达更直接、更愿意承担结果" },
    { id: "explore", label: "色彩探索", hint: "频繁换色，情绪流动快，愿意尝试不同的感受" },
    { id: "mono", label: "单色专注", hint: "长时间使用同一种颜色，可能专注，也可能在克制情绪" },
    { id: "pause", label: "多次停顿", hint: "落笔之间有明显停顿，可能在斟酌、回忆或整理感受" },
    { id: "fast", label: "落笔迅疾", hint: "笔速偏快，能量向外，可能带着急切或释放" },
    { id: "slow", label: "笔触缓慢", hint: "笔速偏慢，动作谨慎，可能伴随犹豫或低能量" },
    { id: "invest", label: "持续投入", hint: "作画时间较长，愿意在这件事上停留，是一种自我照顾" }
  ];

  // ---------- 安全边界 ----------
  const boundaries = [
    "不做医学或心理诊断，不使用抑郁症、焦虑症、创伤等临床标签",
    "使用「可能」「也许」「像是」等克制语气",
    "必须引用画面中具体的颜色、线条、位置、元素或作画过程数据",
    "结论落在「自我觉察 + 可执行的小行动」，不给定性判断",
    "调节方法只能从知识库中选择，不能编造疗法名称或疗效承诺",
    "如果用户自述中出现持续低落、自伤或危机表达，优先引导其联系学校心理中心或专业机构"
  ];

  function recommendRegulation(analysis, limit) {
    const list = regulations
      .map((r) => ({ r, s: r.score(analysis) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);
    const picked = (list.length ? list : [{ r: regulations[4], s: 1 }]).slice(0, limit || 3);
    return picked.map(({ r }) => ({
      id: r.id,
      name: r.name,
      duration: r.duration,
      tag: r.tag,
      science: r.science,
      steps: r.steps.slice(),
      why: r.why(analysis)
    }));
  }

  function buildKnowledgeBlock() {
    const out = [];
    out.push("【可援引的知识库（仅作语言组织的边界，不得编造未列出的结论）】");
    out.push("— 空间位置（HTP）—");
    spatial.forEach((r) => out.push("· " + r.feature + "：" + r.meaning));
    out.push("— 线条与笔触 —");
    lines.forEach((r) => out.push("· " + r.feature + "：" + r.meaning));
    out.push("— 色彩情绪 —");
    Object.keys(colors).forEach((k) => out.push("· " + colors[k].name + "：" + colors[k].emotion));
    out.push("— 常见画面元素 —");
    elements.forEach((r) => out.push("· " + r.feature + "：" + r.meaning));
    out.push("— 空间留白 —");
    space.forEach((r) => out.push("· " + r.feature + "：" + r.meaning));
    out.push("— 表达性艺术治疗原则 —");
    eatPrinciples.forEach((p) => out.push("· " + p));
    out.push("— 正念手作原则 —");
    craftPrinciples.forEach((p) => out.push("· " + p));
    out.push("— 可推荐的情绪调节方法（只能从这里选择）—");
    regulations.forEach((r) => {
      out.push("· " + r.name + "（" + r.duration + "）：" + r.steps.join(" "));
    });
    out.push("— 必须遵守的边界 —");
    boundaries.forEach((b) => out.push("· " + b));
    return out.join("\n");
  }

  /**
   * 精简版知识库：供 report() 使用。
   * 去掉调节方法的完整步骤（步骤由本地渲染，AI 只需选 id），
   * 并把每条规则压缩为「特征→含义」的短句，显著降低输入 token。
   */
  function buildKnowledgeBlockCompact() {
    const out = ["【知识库边界（仅组织语言，不得编造）】"];
    out.push("空间：偏上=想象/向上；偏下=安全感/扎根；偏左=内省/过去；偏右=未来/行动；居中=平衡；偏小=克制/低能量；偏大=外放/张力；贴边=被挤压/求边界");
    out.push("线条：长连贯=控制/压抑；短断续=冲动/敏感；水平=保护/无力；垂直=自信/向上；刚硬=防御；曲线=灵活；反复涂抹=冲突/在意；轻淡=不确定；浓重=焦虑/用力；快=释放张力");
    out.push("色彩：朱红=热情/张力；落日橙=活力/温暖；黄=明快/希望；苔绿=生长/疗愈；湖蓝=安静/沉思；靛蓝=内省/克制；紫黛=敏感/想象；赭石=踏实/土地；墨黑=边界/防御；月白=留白/清理；雾灰=过渡/模糊");
    out.push("元素：树=自我力量；山=目标/压力；水=情绪流动；屋=自我/家庭；太阳=希望/能量；云雾=不确定/保护；路=选择/方向；窗=连接方式；星月=理想/孤独；花草=生命力");
    out.push("留白：大面积=未言说/独处；充盈=表达欲/紧绷；下方空=脱离现实；上方空=务实/少想象");
    out.push("EAT：创作过程即调节；材料是情绪容器；先动觉感官再谈意义；重复动作锚定注意力；允许模糊");
    out.push("调节方法（只选 id，步骤由系统提供）：" +
      regulations.map((r) => r.id + "=" + r.name + "[" + r.tag + "]").join("；"));
    out.push("边界：不诊断不用临床标签；用可能/也许/像是；引用具体颜色线条位置元素或过程；给自我觉察+小行动；不编疗法；危机表达引导专业帮助");
    return out.join("\n");
  }

  /**
   * 丰富版知识库：供 report() 使用（AI 已可直连时启用）。
   * 保留空间/线条/色彩/元素/留白的完整解读细节，以及 EAT 与正念手作原则全文，
   * 让 AI 能组织出有依据、有层次的心理观察，而不是套模板短句。
   * 调节方法仍只给 id+名称+标签，具体步骤由本地渲染。
   */
  function buildKnowledgeBlockRich() {
    const out = ["【可援引的知识库（仅作语言组织的边界，不得编造未列出的结论）】"];
    out.push("— 空间位置（HTP）—");
    spatial.forEach((r) => out.push("· " + r.feature + "：" + r.meaning));
    out.push("— 线条与笔触 —");
    lines.forEach((r) => out.push("· " + r.feature + "：" + r.meaning));
    out.push("— 色彩情绪 —");
    Object.keys(colors).forEach((k) => out.push("· " + colors[k].name + "：" + colors[k].emotion));
    out.push("— 常见画面元素 —");
    elements.forEach((r) => out.push("· " + r.feature + "：" + r.meaning));
    out.push("— 空间留白 —");
    space.forEach((r) => out.push("· " + r.feature + "：" + r.meaning));
    out.push("— 表达性艺术治疗原则（EAT）—");
    eatPrinciples.forEach((p) => out.push("· " + p));
    out.push("— 正念手作原则 —");
    craftPrinciples.forEach((p) => out.push("· " + p));
    out.push("— 可推荐的情绪调节方法（只能从这里选择 id，步骤与科学依据由系统本地提供）—");
    regulations.forEach((r) => {
      out.push("· " + r.id + "：" + r.name + "（" + r.tag + "，" + r.duration + "）");
    });
    out.push("— 必须遵守的边界 —");
    boundaries.forEach((b) => out.push("· " + b));
    return out.join("\n");
  }

  window.XHFYKnowledge = {
    spatial, lines, colors, elements, space, eatPrinciples, craftPrinciples,
    regulations, behaviorRules, boundaries,
    recommendRegulation, buildKnowledgeBlock, buildKnowledgeBlockCompact, buildKnowledgeBlockRich
  };
})();
