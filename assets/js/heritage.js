/**
 * heritage.js — 纹样溯源知识库 / 三层融合约束层
 *
 * 数据来源（严格限定，不编造出处）：
 *   1) 《剪纸.pdf》（用户提供）：9 个有明确出处与文献支撑的传统剪纸纹样 + 5 条基础理论文献；
 *   2) 《方案.docx》（用户提供）：「原画视觉锚点 + 心理意象 + 非遗纹样语义」三层融合机制、
 *      「视觉元素 → 文化寓意 → 情绪主题 → 二创纹样」映射、工艺转译规则表、
 *      纹样溯源卡与原画关联度报告的设计要求。
 *
 * 设计原则：
 *   - 所有纹样、地域、文献、链接都从上述两份文件转录，模型不得凭空生成出处；
 *   - 匹配 / 转译 / 溯源 / 关联度全部是确定性纯函数，本地可跑、AI 不可用时同样完整可用；
 *   - 不新增任何付费 API 调用：情绪提问、溯源卡、关联度报告均由本地生成；
 *   - 心理边界：只提供可能的情绪意象联想，由用户确认，不作诊断或疗效判断。
 */
(function () {
  "use strict";

  /* ============================================================
   * 一、经核验的传统纹样库（9 条，全部转录自《剪纸.pdf》）
   * ============================================================ */
  const MOTIFS = [
    {
      id: "sanyang",
      name: "三阳开泰（三羊剪纸）",
      short: "三羊开泰",
      craft: "剪纸",
      region: "陕北窗花",
      meaning: "羊通「祥」，三羊＝三阳；象征冬去春来、否极泰来、吉祥开启、家道兴旺",
      emotion: "明朗、期盼、宽慰、驱走不安的松弛感",
      keywords: ["希望", "转机", "厄运消解", "集体积极暗示", "安全感", "新生"],
      psycho: "农耕环境对时序、收成高度敏感，属于创伤／焦虑补偿意象：用图像确认「困境会结束」；荣格集体原型中太阳、新生动物代表重生原型，用来抵御对灾荒、寒冬、未知风险的恐惧；把不可控的天时转化为可控的吉祥符号，获得心理掌控感。",
      student: "适合处在低谷、等待结果、期待转机的阶段。",
      tags: ["希望", "转机", "新生", "安全感", "松弛", "期待"],
      anchor: ["羊", "太阳", "三阳", "春"],
      sources: [
        {
          title: "乔晓光《读懂剪纸的语言》",
          url: "https://www.ihchina.cn/Article/Index/detail?id=7481",
          note: "中国非物质文化遗产网"
        }
      ]
    },
    {
      id: "biding",
      name: "笔定双钱（必定双全）",
      short: "必定双全",
      craft: "鄂州花样剪纸",
      region: "湖北鄂州",
      meaning: "毛笔 + 两枚铜钱，谐音「必定双全」；毛笔＝科举功名、学识，铜钱＝财富；寓意福禄双全，读书求财两全",
      emotion: "奋进、期许，害怕顾此失彼的补偿心愿",
      keywords: ["成就焦虑", "两全期待", "自我实现", "求全心理", "向上渴望"],
      psycho: "传统平民阶层上升通道狭窄，科举是改变命运最重要路径；纹样投射「我希望两样重要东西都不要失去」的完美主义心理：既要功名体面，又要温饱财富；「双全」是民众幸福观的核心（五福：寿、富、康宁、攸好德、考终命）；图像用来调和现实里「取舍、遗憾」带来的失落，提供一种理想化的心理图景。",
      student: "适合在学业、竞赛、就业之间做取舍，担心顾此失彼的阶段。",
      tags: ["成就", "期许", "自我实现", "向上", "取舍", "目标"],
      anchor: ["笔", "铜钱", "钱", "书", "毛笔"],
      sources: [
        {
          title: "《鄂州花样剪纸「笔定双钱」纹样解读》，湖南工业大学学报，2012",
          url: "https://wenku.baidu.com/view/eaacf20cab114431b90d6c85ec3a87c240288ae6.html",
          note: "期刊论文"
        }
      ]
    },
    {
      id: "panchang",
      name: "盘长纹（八吉祥）",
      short: "盘长纹",
      craft: "剪纸 / 佛家八宝纹样",
      region: "传统吉祥纹样",
      meaning: "无头无尾、连绵回环；佛家八宝之一；寓意绵长不断、福寿永续、姻缘长久、事事不断",
      emotion: "平和、安定，绵长宁静，没有终点的安稳",
      keywords: ["永恒", "联结", "无断裂", "稳定", "克服分离焦虑"],
      psycho: "线条循环、没有断点，视觉上直接对应「不会中断」；对应人内心害怕断裂、离别、中断的分离焦虑；是对「长久、持续、不散」的心理渴望；在丧俗、婚俗、寿庆都使用，跨越生死场景，表达希望缘分、福气、生命不会彻底断绝。",
      student: "适合在意关系是否稳定、害怕中断或失去联结的阶段。",
      tags: ["安定", "联结", "稳定", "平和", "持续", "长久"],
      anchor: ["环", "结", "回环", "连续", "盘长"],
      sources: [
        {
          title: "《民间剪纸艺术》，清华大学出版社",
          url: "https://www.tup.tsinghua.edu.cn/upload/books/yz/029231-01.pdf",
          note: "出版社公开样章"
        }
      ]
    },
    {
      id: "kushulan",
      name: "库淑兰牡丹剪纸",
      short: "牡丹盛放",
      craft: "剪纸（库淑兰风格）",
      region: "陕西旬邑",
      meaning: "牡丹为富贵花，象征荣华、和美、繁盛；库淑兰风格色彩浓烈、花团层叠，融合生命树、蝴蝶、瓶花；牡丹也常代指女性生命力、盛放的生命状态",
      emotion: "热烈、充盈、绚烂、狂喜式的审美愉悦",
      keywords: ["自我绽放", "丰盛", "审美疗愈", "生命力释放", "自尊补偿"],
      psycho: "库淑兰一生苦难，剪纸是重要情绪出口。孟强论文提出：民间剪纸是苦难现实的本我放逐与情感宣泄；浓烈繁复、不计写实、自由拼接的图像，是压抑情绪、被束缚自我的释放；牡丹盛放原型，是创作者对「自我生命也可以盛大美好」的补偿幻想；艺术疗愈视角：重复剪花、填充画面的过程本身具有正念、安抚创伤的作用。",
      student: "适合想让自己被看见、允许自己舒展和盛放的阶段。",
      tags: ["绽放", "生命力", "丰盛", "舒展", "自我表达", "热烈"],
      anchor: ["牡丹", "花", "蝴蝶", "瓶花", "生命树"],
      sources: [
        {
          title: "张志春《剪纸》；孟强《民间美术是本我的放逐和情感的宣泄图式》",
          url: "https://www.sxlib.org.cn/dfzy/sxmjms/mjmsyj/yjlz/201612/t20161221_580983.html",
          note: "陕西省图书馆地方资源"
        }
      ]
    },
    {
      id: "hongyan",
      name: "鸿雁纹",
      short: "鸿雁远行",
      craft: "剪纸（禽鸟纹样）",
      region: "《中国民间剪纸集成》禽鸟纹样",
      meaning: "远志、远行、信守方向",
      emotion: "笃定、轻盈、果敢",
      keywords: ["自我效能感", "自主性", "冒险精神", "目标认同"],
      psycho: "针对大学生生涯选择焦虑。鸿雁不依附群体独自乘风，象征相信自身能力，主动承担选择的结果；剪纸创作时刻画翅膀的过程，可以帮助学生外化「想要向前走」的内在动力。",
      student: "勇敢奔赴目标，接纳追梦路上的独处，自主选择未来道路（考研、竞赛、求职）。",
      tags: ["奔赴", "自主", "目标", "笃定", "果敢", "独处"],
      anchor: ["雁", "鸟", "翅膀", "飞", "远行"],
      sources: [
        {
          title: "《中国民间剪纸集成》禽鸟纹样；陆雅青《表达性艺术治疗》",
          url: "https://book.douban.com/subject/4100343/blockquotes",
          note: "纹样出处为集成卷，疗愈理论出处为陆雅青著作"
        }
      ]
    },
    {
      id: "die",
      name: "《蝶舞青春》团花剪纸",
      short: "蝶舞青春",
      craft: "团花剪纸",
      region: "传统团花 / 剪纸",
      meaning: "蝴蝶破茧化蝶；繁花代表青春绽放；对称团花代表稳定圆满；隐喻走出迷茫、挫折后自我蜕变、多维成长",
      emotion: "轻盈、期待蜕变、重获秩序感",
      keywords: ["心理弹性", "成长性思维", "自我接纳", "蜕变", "突破内耗"],
      psycho: "蝴蝶属于荣格理论里的重生原型；剪纸重复剪刻动作进入心流，降低交感神经兴奋，缓解焦虑；对称构图满足完形心理，重建秩序感，修复失控感。",
      student: "适合走出迷茫、经历挫折后重新开始、想突破内耗的阶段。",
      tags: ["蜕变", "成长", "弹性", "自我接纳", "重启", "秩序"],
      anchor: ["蝶", "蝴蝶", "茧", "团花", "繁花"],
      sources: [
        {
          title: "《基于认知心理学的中国传统蝴蝶纹样研究》",
          url: "https://search.napstic.cn/literature/periodical/010mysd-s202321037",
          note: "从认知心理学解析蝴蝶纹样的蜕变、新生符号认知"
        },
        {
          title: "《艺术疗愈视域下传统剪纸活动缓解高职生社交焦虑效果研究》",
          url: "http://huadongzhiye.com/cn/article/pdf/preview/19b522da-a31c-4eb8-a20a-0916be00757b.pdf",
          note: "剪纸为非语言表达，重复手部动作诱发心流，减少反刍思维"
        }
      ]
    },
    {
      id: "sijun",
      name: "《四骏韶华》团花剪纸",
      short: "四骏韶华",
      craft: "团花剪纸",
      region: "传统团花 / 剪纸",
      meaning: "自强不息、奔赴理想；四骏同行代表同辈同伴支持；祥云代表顺遂；寓意不负韶华、并肩奋斗、马到成功",
      emotion: "昂扬、有伴、被支持",
      keywords: ["进取动机", "内驱力", "目标感", "同伴支持", "坚韧", "对抗习得性无助"],
      psycho: "适合考研、竞赛、就业抉择、学业倦怠的大学生。骏马昂扬动态激活积极趋近情绪；剪纸「取舍镂空」的创作过程隐喻学会取舍、聚焦目标，缓解选择过载焦虑；团体剪纸时提升归属感，降低孤独内卷心理。",
      student: "适合备考、竞赛、就业抉择与学业倦怠阶段。",
      tags: ["进取", "目标", "同伴", "坚韧", "内驱力", "支持"],
      anchor: ["马", "骏", "祥云", "奔跑", "同行"],
      sources: [
        {
          title: "Jiang X, et al. The impact of craft creation practice on university students' mental health: a moderated network analysis, Frontiers in Public Health, 2025",
          url: "https://www.frontiersin.org/journals/public-health/articles/10.3389/fpubh.2025.1502506/full",
          note: "手工创作通过提升社会联结、积极情绪，降低压力与抑郁水平"
        },
        {
          title: "倪建林、沈心荷《引譬连类——中国传统吉祥文化生成思维论》，江苏行政学院学报，2018",
          url: "https://qikan.cqvip.com/Qikan/Search/Index?key=K%3D%E5%90%89%E7%A5%A5%E6%96%87%E5%8C%96",
          note: "吉祥纹样以类比象征思维承载理想与期许，是本土心理资源"
        }
      ]
    },
    {
      id: "chunyan",
      name: "春燕衔枝剪纸",
      short: "春燕衔枝",
      craft: "剪纸",
      region: "传统吉祥花鸟纹样",
      meaning: "春燕报春，新芽新生、转机；柳枝柔韧，代表灵活适应；寓意低谷之后迎来转机、重新出发",
      emotion: "柔和、看见微小转机、慢慢松下来",
      keywords: ["心理复原力", "希望", "适应力", "正念", "情绪疏导", "重启"],
      psycho: "人际受挫、长期情绪低落、敏感容易紧张时适用。燕子轻盈柔和，没有压迫感；慢剪线条属于正念式艺术疗愈，积压负面情绪随碎纸屑剥离，引导学生看见困境中的微小转机。",
      student: "适合长期低落、人际受挫后想慢慢重启的阶段。",
      tags: ["复原", "希望", "转机", "适应", "正念", "柔和"],
      anchor: ["燕", "柳", "新芽", "春", "枝"],
      sources: [
        {
          title: "Guan R, et al. The 'hand-brain-emotion' axis: a theoretical model for handicraft art-based intervention in anxiety disorders, Frontiers in Psychology, 2026",
          url: "https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2026.1786210/full",
          note: "手部精细手工调节自主神经，是焦虑干预的有效路径"
        },
        {
          title: "《中国传统吉祥装饰艺术的当代文化价值》",
          url: "http://www.koovin.com/?a=downloadpdf&id=4251622&file_name=5D3FF88997720CD0F6E2C64A79709766&doaction=download",
          note: "草木、飞鸟纹样代表生生不息，承载对转机、新生的心理期待"
        }
      ]
    },
    {
      id: "fenghuang",
      name: "凤凰剪纸",
      short: "凤凰涅槃",
      craft: "剪纸",
      region: "传统瑞兽纹样",
      meaning: "凤凰浴火涅槃，冲破桎梏；代表从压力、挫败中重建自我，和过往失败和解",
      emotion: "舒展、和解、重新打开",
      keywords: ["创伤复原", "自我重塑", "自我认同", "和解", "打破自我封闭"],
      psycho: "适合经历重大挫败、长期自我封闭、社交回避的大学生。凤凰属于荣格原型理论中的转化原型；舒展向外的线条打破「封闭自我」的心理意象，帮助接纳不完美，重建自我认同，降低社交回避。",
      student: "适合经历重大挫败、想和过往失败和解的阶段。",
      tags: ["复原", "和解", "重塑", "自我认同", "打开", "突破"],
      anchor: ["凤凰", "火", "涅槃", "羽", "展翅"],
      sources: [
        {
          title: "《苗绣生命符号的集体无意识内涵：基于荣格分析心理学的解读》",
          url: "http://d.wanfangdata.com.cn/periodical/rzjs202510011",
          note: "凤凰、蝴蝶属转化与重生原型，在集体无意识层面具备疗愈潜力"
        },
        {
          title: "《剪纸艺术疗愈机制综述》，SCIRP",
          url: "https://www.scirp.org/Journal/paperinformation?paperid=147374",
          note: "剪纸作为潜意识视觉化工具，适合创伤叙事与自我和解类干预"
        }
      ]
    }
  ];

  /* ============================================================
   * 二、基础理论文献（5 条，转录自《剪纸.pdf》末页）
   * ============================================================ */
  const FOUNDATIONS = [
    {
      title: "李可嘉《艺术疗愈视域下传统剪纸活动缓解高职生社交焦虑效果研究》，华东纸业，2026",
      url: "http://huadongzhiye.com/cn/article/pdf/preview/19b522da-a31c-4eb8-a20a-0916be00757b.pdf",
      core: "剪纸、心流、社交焦虑、非语言情绪表达"
    },
    {
      title: "韩布新、孔庆焱《艺术文化的心理疗愈功能——重评失调的认知》，南京师大学报（社会科学版）",
      url: "http://ir.psych.ac.cn/",
      core: "本土化艺术疗愈、传统文化符号、四重自我理论（原 PDF 链接分行排版，此处保留机构库地址）"
    },
    {
      title: "Jiang X, et al. The impact of craft creation practice on university students' mental health: a moderated network analysis, Frontiers in Public Health, 2025",
      url: "https://www.frontiersin.org/journals/public-health/articles/10.3389/fpubh.2025.1502506/full",
      core: "手工创作对大学生压力、抑郁、主观幸福感的实证"
    },
    {
      title: "Guan R, et al. The 'hand-brain-emotion' axis: a theoretical model for handicraft art-based intervention in anxiety disorders, Frontiers in Psychology, 2026",
      url: "https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2026.1786210/full",
      core: "手部精细动作、自主神经调节、焦虑干预机制"
    },
    {
      title: "倪建林、沈心荷《引譬连类——中国传统吉祥文化生成思维论》，江苏行政学院学报，2018",
      url: "https://qikan.cqvip.com/Qikan/Search/Index?key=K%3D%E5%90%89%E7%A5%A5%E6%96%87%E5%8C%96",
      core: "吉祥纹样的象征类比思维、民族心理"
    }
  ];

  /* ============================================================
   * 三、第一层 + 第二层：视觉元素 → 文化寓意 → 情绪主题 → 二创纹样
   *     （转录自《方案.docx》第一部分第 2 节，含其给出的 4 个范例与扩展）
   *
   * 注意：这里关联的是「视觉意象 ↔ 传统文化象征」，不是「颜色 ↔ 心理问题」。
   * ============================================================ */
  const ELEMENT_SYMBOL = [
    {
      keys: ["太阳", "日", "阳光", "光芒", "日出", "夕阳"],
      name: "太阳",
      culture: "光明、温暖、生机",
      themes: ["希望", "能量", "温暖感"],
      // 《方案.docx》明确给出的转译（剪纸 / 扎染两列）
      translation: { papercut: "圆形团花 / 圆形光芒纹", tiedye: "放射状染色" }
    },
    {
      keys: ["水", "海", "河", "湖", "波", "浪", "溪流", "雨", "水滴"],
      name: "水流",
      culture: "流动、包容、生生不息",
      themes: ["舒展", "流动", "变化"],
      translation: { papercut: "连续水波纹 / 涡旋纹", tiedye: "水波晕染" }
    },
    {
      keys: ["山", "峰", "岭", "岩", "石", "丘", "山脉"],
      name: "山",
      culture: "稳定、依托、厚重",
      themes: ["安全感", "安定", "支撑"],
      translation: { papercut: "山形镂空纹 / 连续折线纹", tiedye: "层叠山形色块" }
    },
    {
      keys: ["花朵", "花瓣", "牡丹", "梅", "莲", "兰", "菊", "花园", "开花"],
      name: "花朵",
      culture: "生长、繁盛、美好",
      themes: ["生命力", "自我表达", "舒展"],
      translation: { papercut: "花瓣纹 / 缠枝纹", tiedye: "团花晕染" }
    },
    {
      keys: ["云", "霞", "雾", "云朵"],
      name: "云",
      culture: "高远、如意、顺遂",
      themes: ["松弛", "顺遂", "开阔"],
      translation: { papercut: "如意云纹", tiedye: "云状留白" }
    },
    {
      keys: ["树", "木", "枝", "叶", "林", "森林", "树冠"],
      name: "树木",
      culture: "庇护、生长、扎根",
      themes: ["休憩", "庇护", "安定", "成长"],
      translation: {} // 《方案.docx》未给此元素的工艺转译表，走项目工艺语法
    },
    {
      keys: ["房屋", "房", "家", "屋", "窗", "门", "房子"],
      name: "房屋",
      culture: "归属、安顿、庇护",
      themes: ["安全感", "归属感", "安定"],
      translation: {}
    },
    {
      keys: ["鸟", "燕", "雁", "鹤", "雀", "凤凰", "蝶", "蝴蝶", "翅膀"],
      name: "飞鸟与蝶",
      culture: "远志、报春、蜕变",
      themes: ["自由", "转机", "蜕变", "奔赴"],
      translation: {}
    },
    {
      keys: ["鱼", "游鱼", "鲤", "鱼群"],
      name: "游鱼",
      culture: "有余、丰饶、自在",
      themes: ["从容", "丰足", "自在"],
      translation: {}
    }
  ];

  /* ============================================================
   * 四、第三层：工艺转译规则与工艺适配性（《方案.docx》第一部分第 3 节）
   *    - 转译规则表原样保留 docx 给出的「剪纸 / 扎染」两列，不擅自扩编文献出处；
   *    - 本版只启用剪纸：运行时只取 papercut 列，扎染列作为文献原表留档；
   *    - 没有规则表的元素使用项目剪纸语法，并在关联度报告中如实标注来源。
   * ============================================================ */
  const CRAFT_FIT = {
    papercut: "对称构图、轮廓转化、镂空图案"
  };

  // docx 明确给出的转译规则表：4 个元素 × 剪纸 / 扎染两列（文献原表，当前只用剪纸列）
  const TRANSLATION_RULES = [
    { element: "山", papercut: "山形镂空纹", tiedye: "层叠山形色块" },
    { element: "水流", papercut: "连续水波纹", tiedye: "水波晕染" },
    { element: "太阳", papercut: "圆形团花", tiedye: "放射状染色" },
    { element: "云", papercut: "如意云纹", tiedye: "云状留白" }
  ];

  /* ============================================================
   * 五、边界与三条硬约束（《方案.docx》第五部分）
   * ============================================================ */
  const CONSTRAINTS = {
    content: "内容约束：原画核心元素必须保留，只允许对形态做传统纹样化转译，不得替换题材（山不能变成凤凰，水不能变成牡丹，太阳不能凭空变成蝴蝶）。",
    culture: "文化约束：只能使用纹样溯源库中具有明确来源的传统纹样，不允许凭空编造非遗出处、地域或文献。",
    craft: "工艺约束：图案必须符合对应工艺的制作特点，按工艺转译规则生成，不能只追求视觉效果。"
  };

  const BOUNDARIES = [
    "绘画色彩与心理状态之间不存在可以简单套用的固定诊断关系；不得说「画太阳的人一定有希望」「画蓝色的人一定很忧郁」。",
    "AI 只提供一种可能的情绪意象解释，必须由用户确认、修改或否定；系统不替用户定义心理状态。",
    "本系统定位为情绪表达、自我探索与艺术体验，不是心理疾病诊断或治疗工具；绘画过程数据不作为心理诊断证据。",
    "不能把「第二次画得更明亮、更丰富」直接认定为心理状态好转，应由用户自己评价两次体验的差异。",
    "纹样出处、地域与文献只能取自本知识库，不得由生成模型自行杜撰。"
  ];

  /* ============================================================
   * 六、确定性纯函数
   * ============================================================ */

  /**
   * 把视觉模型给出的元素名归一化到「视觉元素 → 文化寓意」映射。
   * 采用显式打分的最优匹配：精确相等 > 最长子串命中 > 反向包含。
   * 这样「云朵」优先归到「云」而不是被单字「朵」抢到「花朵」，
   * 「一片海」仍能归到「水流」。规则全部写死，不依赖运行时推断。
   */
  function pickElements(visionElements) {
    const list = Array.isArray(visionElements) ? visionElements : [];
    const hits = [];
    const seen = {};
    list.forEach((raw) => {
      const s = String(raw || "").trim();
      if (!s) return;
      let best = null;
      let bestScore = -1;
      ELEMENT_SYMBOL.forEach((e) => {
        if (seen[e.name]) return;
        e.keys.forEach((k) => {
          let score = -1;
          if (s === k) score = 1000 + k.length * 10;
          else if (s.indexOf(k) >= 0) score = 100 + k.length * 10;
          else if (k.indexOf(s) >= 0) score = 50 + s.length * 10;
          if (score > bestScore) { bestScore = score; best = e; }
        });
      });
      if (best && bestScore >= 0) {
        seen[best.name] = true;
        hits.push({
          raw: s,
          name: best.name,
          culture: best.culture,
          themes: best.themes.slice(),
          translation: best.translation || {}
        });
      }
    });
    return hits;
  }

  /** 核心元素锁定清单：写进生成提示词，防止题材漂移 */
  function anchorsOf(visionElements) {
    const list = Array.isArray(visionElements) ? visionElements : [];
    return list.map((s) => String(s || "").trim()).filter(Boolean).slice(0, 6);
  }

  /**
   * 匹配纹样：确定性打分，只从 MOTIFS 里取，绝不生成出处。
   * 打分规则全部显式，便于单测。
   */
  function matchMotifs(opts) {
    const o = opts || {};
    const elements = pickElements(o.elements || []);
    const theme = String(o.emotionTheme || "").trim();
    const mood = String(o.mood || "").trim();
    const hay = elements.map((e) => e.name).join("、") + "、" +
      elements.map((e) => e.culture).join("、") + "、" +
      elements.map((e) => e.themes.join("、")).join("、") + "、" + theme + "、" + mood;

    const scored = MOTIFS.map((m) => {
      let score = 0;
      const why = [];
      (m.tags || []).forEach((t) => {
        if (hay.indexOf(t) >= 0) { score += 3; why.push("情绪标签「" + t + "」"); }
      });
      (m.keywords || []).forEach((k) => {
        if (hay.indexOf(k) >= 0) { score += 2; why.push("心理关键词「" + k + "」"); }
      });
      (m.anchor || []).forEach((a) => {
        if (hay.indexOf(a) >= 0) { score += 2; why.push("视觉锚点「" + a + "」"); }
      });
      if (m.name && hay.indexOf(m.name) >= 0) { score += 2; why.push("同名元素"); }
      return { motif: m, score: score, why: why.slice(0, 3) };
    });

    scored.sort((a, b) => b.score - a.score || a.motif.id.localeCompare(b.motif.id));
    const top = scored.slice(0, 3);
    const matched = top.filter((x) => x.score > 0);
    if (matched.length) {
      return matched.map((x) => ({
        id: x.motif.id,
        motif: x.motif,
        score: x.score,
        why: x.why.length ? x.why.join("、") : "与原画意象相近"
      }));
    }
    // 没有命中时如实说明，仍只从库中取通用吉祥纹样
    return [scored[0], scored[1]].filter(Boolean).map((x) => ({
      id: x.motif.id,
      motif: x.motif,
      score: 0,
      why: "原画未匹配到特定纹样锚点，采用通用吉祥纹样（非针对性解读）"
    }));
  }

  /**
   * 工艺转译：优先用 docx 明确给出的规则表；没有规则的工艺走项目工艺语法，
   * 并如实标注来源，避免把项目自定语法冒充文献出处。
   */
  function translateElements(visionElements, style) {
    const elements = pickElements(visionElements);
    const st = String(style || "papercut");
    const fit = CRAFT_FIT[st] || CRAFT_FIT.papercut;
    return elements.map((e) => {
      const rule = TRANSLATION_RULES.filter((r) => r.element === e.name)[0];
      const fromRule = !!(rule && rule[st]);
      const grammar = (window.XHFYCraft && window.XHFYCraft.META &&
        window.XHFYCraft.META[st]) ? window.XHFYCraft.META[st].grammar : "";
      return {
        element: e.name,
        raw: e.raw,
        culture: e.culture,
        themes: e.themes,
        motif: fromRule ? rule[st] : (e.translation[st] || fit),
        source: fromRule ? "《方案.docx》工艺转译规则表" : "项目工艺语法（非文献转译表）",
        fromRule: fromRule,
        grammar: grammar || ""
      };
    });
  }

  /** 给 AI 的三层约束文本（注入 craftPlan / craftBlueprint 提示词） */
  function constraintText(style, visionElements, opts) {
    const o = opts || {};
    const st = String(style || "papercut");
    const anchors = anchorsOf(visionElements);
    const trans = translateElements(visionElements, st);
    const motifs = matchMotifs({
      elements: visionElements,
      emotionTheme: o.emotionTheme,
      mood: o.mood
    });
    const lines = [
      CONSTRAINTS.content,
      CONSTRAINTS.culture,
      CONSTRAINTS.craft,
      "本幅原画核心元素（必须保留，不得替换为其他题材）：" + (anchors.join("、") || "未识别到具体元素"),
      "本工艺：剪纸；适配特点：" + (CRAFT_FIT[st] || CRAFT_FIT.papercut)
    ];
    if (trans.length) {
      lines.push("转译对照（原画元素 → 本工艺纹样）：" +
        trans.map((t) => t.element + "→" + t.motif).join("；"));
    }
    if (motifs.length) {
      lines.push("可选用的有出处传统纹样（只能从这些名称里取，不得杜撰出处）：" +
        motifs.map((m) => m.motif.short).join("、"));
    }
    if (o.emotionTheme) {
      lines.push("用户本人确认的情绪主题：「" + o.emotionTheme + "」，作品应回响这一主题，但不得把它写成心理结论。");
    }
    return lines.join("\n");
  }

  /**
   * 精简版三层约束：注入文本模型（craftPlan）的提示词。
   * 相比 constraintText 去掉长句解释，控制输入 token，避免拖慢免费模型。
   */
  function constraintBrief(style, visionElements, opts) {
    const o = opts || {};
    const st = String(style || "papercut");
    const anchors = anchorsOf(visionElements).slice(0, 3);
    const trans = translateElements(visionElements, st).slice(0, 4);
    const motifs = matchMotifs({
      elements: visionElements,
      emotionTheme: o.emotionTheme,
      mood: o.mood
    }).map((m) => m.motif.short);
    const lines = [
      "【三层硬约束（必须遵守）】",
      "① 内容：原画核心元素必须保留，只做纹样化形态转译，不得替换题材（山不能变凤凰，水不能变牡丹）。",
      "② 文化：只能使用有明确来源的传统纹样名，不得杜撰出处、地域或文献。",
      "③ 工艺：图案须符合本工艺的制作特点，不能只追求好看。",
      "原画核心元素：" + (anchors.join("、") || "未识别") + "；当前工艺：剪纸"
    ];
    if (trans.length) {
      lines.push("转译对照：" + trans.map((t) => t.element + "→" + t.motif).join("；"));
    }
    if (motifs.length) lines.push("可选用的有出处纹样：" + motifs.join("、"));
    if (o.emotionTheme) {
      lines.push("用户本人确认的情绪主题：「" + o.emotionTheme + "」，作品回响它，但不得写成心理结论。");
    }
    return lines.join("\n");
  }

  /**
   * 情绪共创提问：本地确定性生成，零 API 消耗。
   * 采用《方案.docx》的开放式提问范式，用户可确认 / 修改 / 否定。
   */
  function buildEmotionPrompt(vision, analysis) {
    const v = vision || {};
    const a = analysis || {};
    const elements = pickElements(v.elements || []);
    const mood = String(v.mood || "").trim();
    let question;
    if (elements.length >= 2) {
      const e1 = elements[0], e2 = elements[1];
      question = "你画中的" + e1.name + "和" + e2.name + "，可能让人联想到" +
        e1.themes[0] + "、" + e2.themes[0] + "。你觉得这幅画更接近哪一种感受？";
    } else if (elements.length === 1) {
      const e = elements[0];
      question = "我注意到你画了" + e.name + "。在传统文化里它常与「" + e.culture +
        "」相连。对你来说，它更像" + e.themes[0] + "，还是" + (e.themes[1] || "别的什么") + "？";
    } else if (mood) {
      question = "这幅画给人的感觉接近「" + mood + "」。其中让你最想停留的，是哪一部分？它更接近哪一种感受？";
    } else {
      question = "画完之后，如果用一个词说说这幅画里你最想留下的是什么，会是什么？";
    }

    // 候选情绪意象：优先来自命中元素的情绪主题，去重后补固定兜底
    const pool = [];
    elements.forEach((e) => e.themes.forEach((t) => pool.push(t)));
    if (a.dominantColors && a.dominantColors.length) {
      // 只作为可选补充，不把颜色直接等同心理状态
      pool.push("说不清，先看看");
    }
    ["安静地待一会儿", "舒展一点", "被托住的感觉", "想要向前走", "说不清，先看看"].forEach((t) => pool.push(t));
    const options = [];
    pool.forEach((t) => { if (options.indexOf(t) < 0 && options.length < 4) options.push(t); });

    return {
      question: question,
      options: options,
      disclaimer: "以上只是可能的联想，不是对你心理状态的判断。你可以选一个、自己写，或者都不选。",
      source: "由原画视觉元素与《方案.docx》意象映射本地生成，未调用 AI"
    };
  }

  /** 纹样溯源卡：回答《方案.docx》提出的 5 个问题 */
  function sourceCard(opts) {
    const o = opts || {};
    const st = String(o.style || "papercut");
    const translated = o.translated || translateElements(o.elements, st);
    const motifs = o.motifs || matchMotifs({
      elements: o.elements, emotionTheme: o.emotionTheme, mood: o.mood
    });
    const anchors = anchorsOf(o.elements);
    const origins = [];
    motifs.forEach((m) => {
      m.motif.sources.forEach((s) => origins.push({
        motif: m.motif.short,
        region: m.motif.region,
        craft: m.motif.craft,
        title: s.title,
        url: s.url,
        note: s.note
      }));
    });
    return {
      title: "纹样溯源卡 · " + (window.XHFYCraft && window.XHFYCraft.META &&
        window.XHFYCraft.META[st] ? window.XHFYCraft.META[st].short : st),
      kept: anchors.length ? anchors : ["（未识别到具名元素，保留原画笔迹骨架）"],
      translated: translated,
      origins: origins,
      colorWhy: o.palette
        ? "沿用你原画的主色「" + o.palette + "」" + (o.layout ? "，并保留「" + o.layout + "」的构图方位" : "") + "；配色不做心理推断，只为让二创与原画保持可辨认的关联。"
        : "沿用你原画的主色与构图方位；配色不做心理推断，只为让二创与原画保持可辨认的关联。",
      emotionTheme: o.emotionTheme || "（未确认，以下仅为 AI 联想）",
      howTo: "把第 ④ 步《心愈手作指南》的材料清单、步骤与正念引导语配合这张图样使用；可打印为底稿，或直接照纹样描画。",
      boundary: BOUNDARIES[2]
    };
  }

  /** 原画关联度报告：4 项可枚举、可复核的事实，不给 AI 自评分数 */
  function relevanceReport(opts) {
    const o = opts || {};
    const st = String(o.style || "papercut");
    const translated = o.translated || translateElements(o.elements, st);
    const motifs = o.motifs || matchMotifs({
      elements: o.elements, emotionTheme: o.emotionTheme, mood: o.mood
    });
    const anchors = anchorsOf(o.elements);
    const ruleHits = translated.filter((t) => t.fromRule).length;
    const originTitles = [];
    motifs.forEach((m) => m.motif.sources.forEach((s) => {
      if (originTitles.indexOf(s.title) < 0) originTitles.push(s.title);
    }));

    return {
      title: "原画关联度报告",
      items: [
        {
          label: "原画元素保留",
          value: anchors.length ? anchors.join("、") : "保留原笔迹骨架（未识别到具名元素）",
          evidence: "已作为内容约束写进生成提示词，禁止题材替换"
        },
        {
          label: "情绪主题匹配",
          value: o.emotionTheme ? "用户确认：" + o.emotionTheme : "用户未确认，采用 AI 联想（可修改或否定）",
          evidence: o.emotionTheme ? "来自情绪共创环节，由用户本人选定" : "系统不替用户定义心理状态"
        },
        {
          label: "文化纹样来源",
          value: originTitles.length ? originTitles.join("；") : "无",
          evidence: "全部转录自《剪纸.pdf》，附原文链接；模型不得杜撰出处"
        },
        {
          label: "工艺可行性",
          value: ruleHits + "/" + translated.length + " 个元素命中《方案.docx》转译规则表",
          evidence: ruleHits < translated.length
            ? "其余元素使用项目剪纸语法（非文献转译表），已如实标注"
            : "全部按文献给出的转译规则生成"
        }
      ],
      note: "本报告只枚举可复核的事实，不对作品美观度或心理状态打分。",
      boundary: BOUNDARIES[2]
    };
  }

  window.XHFYHeritage = {
    MOTIFS: MOTIFS,
    FOUNDATIONS: FOUNDATIONS,
    ELEMENT_SYMBOL: ELEMENT_SYMBOL,
    CRAFT_FIT: CRAFT_FIT,
    TRANSLATION_RULES: TRANSLATION_RULES,
    CONSTRAINTS: CONSTRAINTS,
    BOUNDARIES: BOUNDARIES,
    pickElements: pickElements,
    anchorsOf: anchorsOf,
    matchMotifs: matchMotifs,
    translateElements: translateElements,
    constraintText: constraintText,
    constraintBrief: constraintBrief,
    buildEmotionPrompt: buildEmotionPrompt,
    sourceCard: sourceCard,
    relevanceReport: relevanceReport
  };
})();
