import { createServer } from "node:http";
import { loadSettings } from "./config.js";
import { loadLayoutConfig, saveLayoutConfig } from "./layout.js";
import { getDisks } from "./graphql/client.js";
import { startLocate, stopLocate, stopAllLocate, activeLocateDevices } from "./locate.js";

// Deliberately no web framework - still just node:http. Routes beyond the
// health check are proxied at /plugins/unraid-disklocation-next/api/ (see
// plugin/nginx/*.conf, which strips that prefix before forwarding here).
const PORT = Number(process.env.PORT ?? 3838);

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.url === "/health") {
    const settings = loadSettings();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, configured: settings !== null }));
    return;
  }

  if (req.url === "/layout" && req.method === "GET") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(loadLayoutConfig()));
    return;
  }

  if (req.url === "/layout" && req.method === "POST") {
    try {
      const config = JSON.parse(await readBody(req));
      if (!config?.layout || !config?.logos) throw new Error("expected {layout, logos}");
      saveLayoutConfig(config);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(err) }));
    }
    return;
  }

  if (req.url === "/disks" && req.method === "GET") {
    const settings = loadSettings();
    if (!settings) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not configured - no unraid-api URL/key saved yet" }));
      return;
    }
    try {
      const disks = await getDisks(settings);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(disks));
    } catch (err) {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return;
  }

  if (req.url === "/locate" && req.method === "GET") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ devices: activeLocateDevices() }));
    return;
  }

  if (req.url === "/locate" && req.method === "POST") {
    try {
      const { device, action } = JSON.parse(await readBody(req));
      if (action === "start") startLocate(device);
      else if (action === "stop") stopLocate(device);
      else if (action === "stopAll") stopAllLocate();
      else throw new Error('action must be "start", "stop", or "stopAll"');
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, devices: activeLocateDevices() }));
    } catch (err) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(err) }));
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`unraid-disklocation-next listening on :${PORT}`);
});
