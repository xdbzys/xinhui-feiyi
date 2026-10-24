/* =========================================================
   心绘非遗 · 轻量心理学知识库
   仅收录「可直接拆成规则」的投射 / 色彩 / 正念手作知识，
   作为 ai.js 系统提示词的「专家知识边界」，AI 只在此框架内组织语言。
   参考来源：HTP 屋树人测验、Cathy Malchiodi 艺术治疗、色彩心理学、
            Laury Rappaport 正念艺术治疗
   ========================================================= */
(function () {
  "use strict";

  // 空间位置（HTP）
  const spatial = [
    { feature: "画面重心偏上", meaning: "更接近想象、期待与精神层面，有时意味着对现实的轻微回避或向上的渴望" },
    { feature: "画面重心偏下", meaning: "更关注安全感、物质基础与脚踏实地；偏低有时伴随不安全感或无力感" },
    { feature: "画面重心偏左", meaning: "更内省、依恋过去，或正在从已有经验中汲取力量" },
    { feature: "画面重心偏右", meaning: "更面向未来、外向、期待改变与行动" },
    { feature: "画面重心居中", meaning: "比较平衡，能同时容纳过去与未来" },
    { feature: "画面偏小", meaning: "自我表达相对克制，可能伴随低能量或对环境的谨慎" },
    { feature: "画面偏大", meaning: "自我感较强、表达外放，可能伴随张力或情绪浓度" }
  ];

  // 线条与笔触
  const lines = [
    { feature: "长而连贯的线条", meaning: "对行为有较好的控制，有时伴随自我压抑" },
    { feature: "短而断续的线条", meaning: "更冲动、敏感，能量在小范围里释放" },
    { feature: "水平线条为主", meaning: "自我保护、谨慎，也可能是无力感的信号" },
    { feature: "垂直线条为主", meaning: "自信、坚决，有向上的动力" },
    { feature: "刚硬直线", meaning: "僵硬、防御或带攻击性倾向" },
    { feature: "曲线为主", meaning: "灵活、有弹性，对传统规则较为松弛" },
    { feature: "反复涂抹 / 反复加重", meaning: "内在冲突、纠结，对该区域格外在意" },
    { feature: "轻淡笔触", meaning: "低能量、不确定、安全感不足" },
    { feature: "浓重笔触", meaning: "情感浓度高，可能伴随焦虑或用力" }
  ];

  // 色彩—情绪对照（暖色/冷色/中性）
  const colors = {
    red: { name: "朱砂 / 红", emotion: "热情、张力、生命力；过浓时可能伴随愤怒或焦虑" },
    orange: { name: "橙", emotion: "活力、社交、温暖，略带不安定" },
    yellow: { name: "黄", emotion: "明快、希望、向外的能量；过多可能焦躁" },
    green: { name: "竹青 / 绿", emotion: "生长、平和、疗愈，与自然联结" },
    blue: { name: "湖蓝 / 蓝", emotion: "安静、信任、沉思；过深时可能低落或退缩" },
    indigo: { name: "靛蓝", emotion: "内省、直觉、精神性；也可能是情绪的内敛与克制" },
    purple: { name: "紫黛", emotion: "敏感、想象力、自我感受" },
    brown: { name: "赭石 / 棕", emotion: "踏实、土地、物质安全感" },
    black: { name: "墨 / 黑", emotion: "沉重、边界、防御；也可以是力量与聚焦" },
    white: { name: "月白 / 白", emotion: "留白、清理、未言说的部分" },
    gray: { name: "灰", emotion: "过渡、模糊、情绪尚未被命名" }
  };

  // 空间与留白
  const space = [
    { feature: "大面积留白", meaning: "保留了很多未被言说的部分，可能是孤独，也可能是需要独处的空间" },
    { feature: "画面充盈", meaning: "情感丰富、表达欲强，有时也意味着难以留白的紧绷" },
    { feature: "下方留白多", meaning: "与身体 / 现实的连接较弱，更活在想象或思考里" },
    { feature: "上方留白多", meaning: "更务实、扎根，但对未来的想象相对克制" }
  ];

  // 正念手作原则（非遗手作的疗愈机制）
  const craftPrinciples = [
    "重复的身体动作（剪裁、扎结、编织、上色）能把注意力从思绪拉回此刻",
    "手作的过程比成品更重要：允许不完美，本身就是对自我的温柔",
    "每一次呼吸配合一次动作，是把正念放进肌肉记忆里",
    "把情绪交给一种古老的手艺，等于把难以言说的感受交给一个安全的容器"
  ];

  // 安全边界（提示词中必须遵守）
  const boundaries = [
    "不做医学或心理诊断，不使用抑郁症、焦虑症、创伤等临床标签",
    "使用「可能」「也许」「像是」等克制语气",
    "必须引用画面中具体的颜色、线条、位置或元素",
    "结论落在「自我觉察 + 可执行的小行动」，不给定性判断"
  ];

  function buildKnowledgeBlock() {
    const lines = [];
    lines.push("【可援引的知识库（仅作语言组织的边界，不得编造未列出的结论）】");
    lines.push("— 空间位置 —");
    spatial.forEach((r) => lines.push("· " + r.feature + "：" + r.meaning));
    lines.push("— 线条与笔触 —");
    lines.forEach((r) => lines.push("· " + r.feature + "：" + r.meaning));
    lines.push("— 色彩情绪 —");
    Object.keys(colors).forEach((k) => {
      lines.push("· " + colors[k].name + "：" + colors[k].emotion);
    });
    lines.push("— 空间留白 —");
    space.forEach((r) => lines.push("· " + r.feature + "：" + r.meaning));
    lines.push("— 正念手作原则 —");
    craftPrinciples.forEach((p) => lines.push("· " + p));
    lines.push("— 必须遵守的边界 —");
    boundaries.forEach((b) => lines.push("· " + b));
    return lines.join("\n");
  }

  window.XHFYKnowledge = {
    spatial, lines, colors, space, craftPrinciples, boundaries,
    buildKnowledgeBlock
  };
})();
