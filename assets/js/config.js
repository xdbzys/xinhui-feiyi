/* 心绘非遗 · 前端配置 */
window.XHFY_CONFIG = {
  ai: {
    // 智谱 API（www.bigmodel.cn / open.bigmodel.cn）的 OPTIONS 预检都不返回
    // CORS 头，浏览器端 fetch(application/json) 必然触发预检而被拦截，无法直连；
    // 必须经 relay 中继转发（见下方 relay 字段）。这是智谱官方端点对浏览器直连的硬限制。
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
    // CORS 中继（浏览器直连智谱 API 的唯一通路）。ai.js 会「中继优先、直连兜底」。
    //   · 本地开发/演示：在本机跑 `node tools/relay.mjs`，保持下面的默认值即可；
    //   · 线上演示（评委远程访问）：把中继部署成公网服务后，改成对应地址，
    //     例如 `relay: "https://你的worker名.workers.dev/?url={url}"`。
    //     部署脚本见仓库 `proxy/worker.js`（Cloudflare Workers，免费额度即可）。
    //   · 留空 "" 表示不使用中继（此时 AI 分析在浏览器里会因 CORS 失败而降级本地引擎）。
    relay: "http://127.0.0.1:8787/?url={url}"
  },
  paper: "#FBF7EC",
  storageKey: "xhfy.zhipu.key"
};
