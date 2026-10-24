/* 心绘非遗 · 前端配置 */
window.XHFY_CONFIG = {
  ai: {
    base: "https://open.bigmodel.cn/api/paas/v4",
    visionModel: "glm-4v-flash",
    textModel: "glm-4-flash",
    imageModel: "cogview-3-flash",
    // 演示站点内置 Key（Base64 存放，避免被简单抓取）。
    keyCipher: "NmZjMDY5MzUyYzk4NDg5OWI2MTkzNzMzYTg1MTNjYzEuRWVZZlVCRmozdEVxcUNacQ==",
    // 可选 CORS 中继。智谱 chat/completions 的 OPTIONS 预检不返回 CORS 头，
    // 浏览器直连会被拦截；images/generations 支持 CORS 可直连。
    // 留空则：AI 二创直连可用，文本分析自动降级为本地心象引擎。
    // 如需启用完整 AI 文本分析，可运行 `node tools/relay.mjs` 并填入：
    //   relay: "http://127.0.0.1:8787/?url={url}"
    relay: ""
  },
  paper: "#FBF7EC",
  storageKey: "xhfy.zhipu.key"
};
