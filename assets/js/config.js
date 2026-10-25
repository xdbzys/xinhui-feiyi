/* 心绘非遗 · 前端配置 */
window.XHFY_CONFIG = {
  ai: {
    // www.bigmodel.cn 域名对 chat / vision / images 全部返回 CORS 头，
    // 浏览器可直连文本分析与视觉分析；open.bigmodel.cn 的 chat/completions 不返回 CORS 头。
    base: "https://www.bigmodel.cn/api/paas/v4",
    visionModel: "glm-4v-flash",
    textModel: "glm-4-flash",
    imageModel: "cogview-3-flash",
    // 演示站点内置 Key（Base64 存放，避免被简单抓取）。
    keyCipher: "NmZjMDY5MzUyYzk4NDg5OWI2MTkzNzMzYTg1MTNjYzEuRWVZZlVCRmozdEVxcUNacQ==",
    // 可选 CORS 中继。www.bigmodel.cn 已支持 CORS，默认留空即可直连。
    relay: ""
  },
  paper: "#FBF7EC",
  storageKey: "xhfy.zhipu.key"
};
