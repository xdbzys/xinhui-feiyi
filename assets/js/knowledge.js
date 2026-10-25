/* =========================================================
   心绘非遗 · 轻量心理学知识库
   只收录「能直接拆成规则」的投射 / 色彩 / 表达性艺术治疗 / 正念知识。
   它既是本地叙事的依据，也是 ai.js 系统提示词的「专家知识边界」：
   AI 只能在这个框架内组织语言，不能自由发明结论。

   参考框架：
   · HTP 屋树人投射测验（空间、大小、线条、元素象征）
   · 表达性艺术治疗（Malchiodi / Hinz 的 ETC 连续系统）
   · 应用色彩心理学（《色彩心理学》淀本孝雄、藤澤英昭；Karen Haller / 金容淑）
   · 绘画心理分析实操（《中学生绘画心理应用手册》严虎、梁珊：画面整体分析 + 绘画色彩分析）
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

  // ---------- 画面整体分析（《中学生绘画心理应用手册》第十八章） ----------
  // 阈值与释义直接来自该书「画面大小 / 位置 / 切断 / 用笔力度 / 线条特征」
  const htpOverall = [
    { feature: "画面过大（包围盒>画面 2/3）", meaning: "强调自我存在感、较有活力与自信；也可能对环境感知无力，伴随紧张、躁动或攻击倾向" },
    { feature: "画面过小（包围盒<画面 1/9）", meaning: "内向、自卑、焦虑不安；环境适应不良、精神动力不足、情绪低落；也可能是良好的自我控制" },
    { feature: "主体居中", meaning: "可能存在内在不安全感；或以自我为中心、可塑性差；也可能是一种自我控制" },
    { feature: "主体偏左", meaning: "母性的、女性化的、被动的；感性、情感丰富；对过去生活的留恋" },
    { feature: "主体偏右", meaning: "父性的、男性化的、主动的；理性；向往未来，追求远大目标，易陷想象，可能盲目乐观" },
    { feature: "主体偏下", meaning: "比较关注现实；可能有不安感或缺乏自信" },
    { feature: "主体偏上", meaning: "更接近想象、精神层面；可能行动力弱、好空想或目标不现实" },
    { feature: "画面左侧切断", meaning: "对未来恐惧或留恋过去；想直率表达又依赖他人，反复犹豫，可能有强迫倾向" },
    { feature: "画面右侧切断", meaning: "向往未来或逃避过去；欲用理智控制现在；可能逃避现实、难以适应社会" },
    { feature: "画面上侧切断", meaning: "想法多但目标不现实；行动力弱、好空想；自控力差而期待较高" },
    { feature: "画面下侧切断", meaning: "压抑着自己的冲动；迫于外界压力而压抑情绪" }
  ];

  // ---------- 用笔力度与线条（《中学生绘画心理应用手册》第十八章） ----------
  const htpLine = [
    { feature: "用笔力度大", meaning: "可能有攻击性倾向或脾气暴躁；也表示自信、行动力积极；精神动力过高、自控较弱" },
    { feature: "用笔力度小", meaning: "犹豫不决、不自信、自卑、焦虑不安、抑郁；心理能量较低或受到压抑" },
    { feature: "长线条", meaning: "自我控制能力强，对行动控制得体" },
    { feature: "短线条", meaning: "易冲动、兴奋" },
    { feature: "直线条", meaning: "男性化、自信、攻击性、固执，待人处事可塑性差" },
    { feature: "圆滑线条", meaning: "女性化、情绪化、依赖性、不受束缚、健康，个性随和、适应性较好" },
    { feature: "颤抖状线条", meaning: "精神紧张，有敌对倾向，内心焦虑不安" },
    { feature: "反复涂擦", meaning: "犹豫不决、优柔寡断；要求过高、追求完美；可能焦虑；想要掩饰真实的自我" }
  ];

  // ---------- 绘画色彩分析（《中学生绘画心理应用手册》第二十二章 + 《色彩心理学》） ----------
  const colorAnalysis = [
    { feature: "暖色调（红橙黄）为主", meaning: "象征温暖、热情、能量" },
    { feature: "冷色调（黑棕蓝）为主", meaning: "象征冷漠、无能量；大量冷色可能伴有人格压抑或对人际关系的不确定感" },
    { feature: "过度使用鲜艳色系", meaning: "可能有急躁倾向" },
    { feature: "过度使用暗色系", meaning: "可能有抑郁情绪" },
    { feature: "颜色过淡、几乎看不清", meaning: "想要隐藏自己" },
    { feature: "只用 1–2 种颜色", meaning: "比较淡漠，主要表现为人际关系与情感的淡漠" },
    { feature: "超过 5 种颜色", meaning: "对自我情绪控制能力不足，可能是一种急躁的倾向" },
    { feature: "色彩搭配极不和谐", meaning: "可能处于比较严重的心理失衡状态" },
    { feature: "红色", meaning: "温暖喜庆、成熟坚强有力量；也可能是愤怒和暴躁的表现" },
    { feature: "蓝色", meaning: "传统、忠诚、永恒；智慧与沉思；有时表示自我控制" },
    { feature: "绿色", meaning: "生机、富有生命力；宽容和大度的象征" },
    { feature: "黄色", meaning: "温暖和乐观；也是财富和权力的象征；也可表示警示" },
    { feature: "橙色", meaning: "喜悦、活力、成熟和温暖；有时是家庭情感的投射" },
    { feature: "紫色", meaning: "永恒和神秘；有时表示虔诚；与蓝色同用时可能存在焦虑" },
    { feature: "棕色", meaning: "古典、优雅和诚实；有时表示内心的冲突或对家庭社会的不适应" },
    { feature: "黑色", meaning: "黑暗、危险和死亡；消极、烦恼、焦虑；也可表示内心的保守和节制" },
    { feature: "白色", meaning: "神秘、高尚、清白、纯洁；有时也表示恐惧、死亡" }
  ];

  // ---------- 色彩的心理属性（《色彩心理学》淀本孝雄、藤澤英昭） ----------
  const colorAttributes = [
    { feature: "冷暖", meaning: "红橙黄为暖色（积极、有生命、温暖），蓝青为冷色（恬静、消极），绿紫为中性色（使人休息、轻松，避免疲劳）。暖色饱和度越高越暖，冷色亮度越高越冷" },
    { feature: "轻重", meaning: "浅色给人质量轻、向外扩散的感觉；深色密度大、内聚，给人沉重的感觉" },
    { feature: "膨胀与收缩", meaning: "暖色属膨胀色，冷色属收缩色；亮度高的颜色显得更大" },
    { feature: "前进与后退", meaning: "明色、饱和度高的颜色呈前进性；与背景对比大的颜色更突出" },
    { feature: "艳丽与素雅", meaning: "高饱和度、高亮度给人艳丽感，与动态、快活的感情密切；素雅与静态、抑郁感情相关" },
    { feature: "色彩疗法", meaning: "红色使人情感兴奋，对抑郁状态有提升作用；蓝色有镇静作用，可缓和情绪亢奋" },
    { feature: "色彩认知与性格", meaning: "倾向以色彩分类的人多属外向、适应强、人情味浓；倾向以形状分类的人多偏内向、严谨、孤独" }
  ];


  // ---------- FEATS 形式元素量表（Gantt & Tabone） ----------
  // 只评可观察的形式元素，0–5 分；具象维度对抽象涂画不适用
  const featsScales = [
    { feature: "色彩显著度（Prominence of Color）0–5", meaning: "0＝只有轮廓线、几乎不上色；5＝浓色铺满整幅。衡量色彩占据画面的程度，不评价颜色含义" },
    { feature: "色彩贴合度（Color Fit）0–5", meaning: "颜色与所画对象现实色的吻合程度。0＝完全不合理（如紫色的树）；5＝高度写实。抽象涂画不适用" },
    { feature: "隐含能量（Implied Energy）0–5", meaning: "笔触透出的力度与运动感。0＝虚弱无力；5＝强烈、快速、有压迫感" },
    { feature: "空间使用（Space）0–5", meaning: "画纸被使用的比例与方式。0＝极小一点；5＝填满整张纸" },
    { feature: "整合度（Integration）0–5", meaning: "各部分是否连成有关系的整体。0＝散乱互不相关；5＝结构完整统一" },
    { feature: "逻辑性（Logic）0–5", meaning: "画面是否自洽、有可理解的秩序。抽象涂画不适用" },
    { feature: "写实性（Realism）0–5", meaning: "与真实形象的接近程度。抽象涂画不适用" },
    { feature: "问题解决（Problem-Solving）0–5", meaning: "是否画出达成目标的可行方式（如人如何摘到苹果）。本测验不适用" },
    { feature: "发展水平（Developmental Level）0–5", meaning: "造型成熟度，需与年龄常模比对。本地不适用" },
    { feature: "细节丰富度（Details）0–5", meaning: "对象与环境的细节数量。0＝几乎没有细节；5＝细节密集" },
    { feature: "线条质量（Line Quality）0–5", meaning: "线条的控制与变化。0＝抖动失控、断续；5＝流畅、有控制也有变化" },
    { feature: "人物（Person）0–5", meaning: "人物形象完整度与在场感。本测验不适用" },
    { feature: "旋转之缺失（Rotation absent）1–5", meaning: "5＝画面正立；1＝整体明显倾斜旋转。旋转常与失衡感相关，须结合其他证据" },
    { feature: "重复之缺失（Perseveration absent）1–5", meaning: "5＝无重复；1＝同一处反复涂擦、同形反复堆叠。常与固着、焦虑性重复有关" }
  ];

  // ---------- 标准化评估的解读纪律 ----------
  const assessmentNotes = [
    "FEATS 只评「看得见的形式」，不评「画里的人是谁」；分数不是诊断，必须结合多处证据",
    "DDS 研究中空间使用 <33%、颜色 ≤2 种与抑郁群体相关；这是群体统计相关，不能用于个体判断",
    "任何单一维度都不能定论：色彩、线条、空间、过程行为要交叉验证，并给出替代解释",
    "「不适用」是合法结论：抽象涂画没有具象对象时，写实性/人物/逻辑性等维度不得强行打分",
    "研究结论只能作为可能性权重；触及自伤或危机表达时，应引导寻求专业帮助"
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
    out.push("整体（《中学生绘画心理应用手册》十八章）：包围盒>2/3=过大(自信/外放/攻击性)；<1/9=过小(自卑/退缩/低能量)；偏上=理想/想象；偏下=踏实/不安；偏左=内省/过去；偏右=未来/行动；贴边切断=被环境挤压/求边界；用笔重=焦虑/用力；轻=不确定；长直线=控制压抑；短断=冲动敏感；反复涂抹=冲突在意");
    out.push("色彩（《中学生绘画心理应用手册》二十二章/《色彩心理学》淀本孝雄）：暖色=热情能量；冷色=冷静压抑；过度鲜艳=急躁；过度暗色=抑郁；过淡=隐藏；1-2色=淡漠；>5色=情绪控制不足；红=兴奋张力；蓝=镇静内省；绿=生长疗愈；黄=明快希望");
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
    out.push("— 画面整体分析（《中学生绘画心理应用手册》第十八章，含量化阈值）—");
    htpOverall.forEach((r) => out.push("· " + r.feature + "：" + r.meaning));
    out.push("— 用笔力度与线条特征（《中学生绘画心理应用手册》第十八章）—");
    htpLine.forEach((r) => out.push("· " + r.feature + "：" + r.meaning));
    out.push("— 色彩情绪 —");
    Object.keys(colors).forEach((k) => out.push("· " + colors[k].name + "：" + colors[k].emotion));
    out.push("— 绘画色彩分析（《中学生绘画心理应用手册》第二十二章）—");
    colorAnalysis.forEach((r) => out.push("· " + r.feature + "：" + r.meaning));
    out.push("— 色彩的心理属性（《色彩心理学》淀本孝雄、藤澤英昭）—");
    colorAttributes.forEach((r) => out.push("· " + r.feature + "：" + r.meaning));
    out.push("— FEATS 形式元素量表（Gantt & Tabone；只评可观察的形式，0–5 分）—");
    featsScales.forEach((r) => out.push("· " + r.feature + "：" + r.meaning));
    out.push("— 标准化评估的解读纪律（必须遵守）—");
    assessmentNotes.forEach((n) => out.push("· " + n));
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
    htpOverall, htpLine, colorAnalysis, colorAttributes,
    featsScales, assessmentNotes,
    recommendRegulation, buildKnowledgeBlock, buildKnowledgeBlockCompact, buildKnowledgeBlockRich
  };
})();
