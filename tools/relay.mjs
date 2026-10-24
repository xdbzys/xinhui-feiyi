/* =========================================================
   心绘非遗 · 本地 CORS 中继（可选）
   用途：智谱 API 的 OPTIONS 预检不返回 CORS 头，纯静态页面
   无法在浏览器里直连。本脚本在本地起一个 30 行的中继，
   让网站可以调用真实的 GLM-4V / GLM-4 / CogView。

   启动：node tools/relay.mjs
   然后修改 assets/js/config.js：
     relay: "http://127.0.0.1:8787/?url={url}"
   ========================================================= */
import http from "node:http";

const PORT = Number(process.env.PORT || 8787);

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  // 允许 HTTPS 页面（GitHub Pages）访问本机中继
  res.setHeader("Access-Control-Allow-Private-Network", "true");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const target = new URL(req.url, "http://relay.local").searchParams.get("url");
  if (!target) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: "缺少 url 参数" } }));
    return;
  }

  try {
    // GET：用于代理 CogView 图片（图床不带 CORS 头，无法直接画进 canvas）
    if (req.method === "GET") {
      const upstream = await fetch(target);
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.writeHead(upstream.status, {
        "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
        "Cache-Control": "no-store"
      });
      res.end(buf);
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "仅支持 GET / POST" } }));
      return;
    }

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);

    const upstream = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: Buffer.concat(chunks)
    });
    const text = await upstream.text();
    res.writeHead(upstream.status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(text);
  } catch (err) {
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: { message: "上游请求失败：" + err.message } }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("心绘非遗中继已启动：http://127.0.0.1:" + PORT + "/?url={url}");
});
