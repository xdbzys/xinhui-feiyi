/* 心绘非遗 · 前端配置 */
window.XHFY_CONFIG = {
  ai: {
    // 图鉴/视觉请求走智谱国际站 api.z.ai：同一把 Key、同一套模型，
    // 但它的 OPTIONS 预检会正常返回 Access-Control-Allow-Origin / -Methods / -Headers，
    // 浏览器可以直接 fetch(application/json)，无需任何中继。
    // （国内站 www.bigmodel.cn 的预检不返回 CORS 头，只有 POST 响应才带，浏览器必然被拦。）
    base: "https://api.z.ai/api/paas/v4",
    // 备用端点：国际站网络不通时回退国内站（仅在内网/代理放行直连的环境下有效）。
    baseFallback: "https://www.bigmodel.cn/api/paas/v4",
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
    // CORS 中继（可选）。api.z.ai 已支持浏览器直连，默认留空即可。
    //   · 留空 ""：直连主站，失败再试备用站；
    //   · 如需自建中继，格式为 `https://你的服务/?url={url}`，部署脚本见 proxy/worker.js。
    relay: ""
  },
  paper: "#FBF7EC",
  storageKey: "xhfy.zhipu.key"
};
