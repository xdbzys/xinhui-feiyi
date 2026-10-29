/* 心绘非遗 · 前端配置 */
window.XHFY_CONFIG = {
  ai: {
    // www.bigmodel.cn 域名对 chat / vision / images 全部返回 CORS 头，
    // 浏览器可直连文本分析与视觉分析；open.bigmodel.cn 的 chat/completions 不返回 CORS 头。
    base: "https://www.bigmodel.cn/api/paas/v4",
    visionModel: "glm-4v-flash",
    textModel: "glm-4-flash",
    // 心理图鉴分两档。差别是实打实的钱：
    //   lite → 免费档。本项目里视觉(glm-4v-flash)、出图(cogview-3-flash)、
    //          意象(glm-4-flash)本来就是免费模型，唯一花钱的就是图鉴这一步；
    //          把它放到免费档后，全流程余额消耗归零。
    //   pro  → glm-4-plus，¥5/百万输入 + ¥15/百万输出，单次图鉴约 ¥0.1，
    //          适合要打印出来带去答辩的样本。
    // lite 档不要用 glm-4.7-flash：它是推理模型，会先生成一长段 thinking/reasoning
    // 思维链，既吃 token 又拖慢响应；实测在合理输出上限下思维链会把预算占满，
    // 返回的 content 为空。图鉴要的是稳定吐出完整 JSON，普通免费模型更合适。
    reportModelLite: "glm-4-flash",
    reportModelLiteFallback: "glm-4-flash",
    reportModelPro: "glm-4-plus",
    defaultReportTier: "lite",
    // 生成剪纸/印染纹样底纹；这一步只提供材质，构图由用户笔迹裁切决定。
    imageModel: "cogview-3-flash",
    // 演示站点内置 Key（Base64 存放，避免被简单抓取）。
    keyCipher: "NmZjMDY5MzUyYzk4NDg5OWI2MTkzNzMzYTg1MTNjYzEuRWVZZlVCRmozdEVxcUNacQ==",
    // 可选 CORS 中继。www.bigmodel.cn 已支持 CORS，默认留空即可直连。
    relay: ""
  },
  paper: "#FBF7EC",
  storageKey: "xhfy.zhipu.key"
};
