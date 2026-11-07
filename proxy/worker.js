/* =========================================================
   心绘非遗 · Cloudflare Worker 公网 CORS 中继（线上演示用）

   为什么需要它：
     智谱 API（www.bigmodel.cn / open.bigmodel.cn）的 OPTIONS 预检
     不返回 CORS 头，浏览器里 fetch(application/json) 必然触发预检
     而被拦截，无法直连。本 Worker 把请求转发给智谱并补上 CORS 头。

   部署（约 1 分钟）：
     1. 打开 https://dash.cloudflare.com → Workers & Pages → 创建 Worker；
     2. 把本文件内容整体粘贴进编辑器 → 部署；
     3. 记下部署后的地址，形如 https://你的worker名.workers.dev；
     4. 修改 assets/js/config.js：
          relay: "https://你的worker名.workers.dev/?url={url}"
     5. 重新推送 / 刷新线上站点即可。

   注意：免费套餐每天 10 万次请求，足够比赛演示使用。
   ========================================================= */
export default {
  async fetch(request) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    };

    // 浏览器预检（OPTIONS）：直接放行
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get("url");
    if (!target) {
      return new Response(JSON.stringify({ error: { message: "缺少 url 参数" } }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    try {
      // GET：代理 CogView 图床图片（图床不带 CORS 头，无法直接画进 canvas）
      if (request.method === "GET") {
        const upstream = await fetch(target, {
          headers: { "User-Agent": "xinhui-feiyi-relay" }
        });
        const body = await upstream.arrayBuffer();
        return new Response(body, {
          status: upstream.status,
          headers: {
            ...corsHeaders,
            "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
            "Cache-Control": "no-store"
          }
        });
      }

      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: { message: "仅支持 GET / POST" } }), {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // POST：转发 chat/completions（鉴权已在 target 的 query 里，body 原样透传）
      const upstream = await fetch(target, {
        method: "POST",
        headers: {
          "Content-Type": request.headers.get("Content-Type") || "application/json",
          "User-Agent": "xinhui-feiyi-relay"
        },
        body: await request.arrayBuffer()
      });
      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: { message: "上游请求失败：" + err.message } }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};
