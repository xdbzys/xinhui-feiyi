/* 心绘非遗 · 前端配置 */
window.XHFY_CONFIG = {
  ai: {
    base: "https://open.bigmodel.cn/api/paas/v4",
    visionModel: "glm-4v-flash",
    textModel: "glm-4-flash",
    imageModel: "cogview-3-flash",
    // 演示站点内置 Key（Base64 存放，避免被简单抓取）。
    // 正式上线请改为后端代理，并轮换此 Key。
    keyCipher: "NmZjMDY5MzUyYzk4NDg5OWI2MTkzNzMzYTg1MTNjYzEuRWVZZlVCRmozdEVxcUNacQ==",
    // 可选 CORS 中继。智谱 API 的 OPTIONS 预检不返回 CORS 头，
    // 纯静态站点的浏览器直连会被拦截；把中继地址填在这里即可启用真实 AI。
    // 默认指向 `node tools/relay.mjs` 启动的本地中继：比赛演示时先跑中继，
    // 网页就能调用真实的 GLM-4V / GLM-4 / CogView；没跑中继时自动降级为本地引擎。
    relay: "http://127.0.0.1:8787/?url={url}"
  },
  paper: "#FBF7EC",
  storageKey: "xhfy.zhipu.key"
};
