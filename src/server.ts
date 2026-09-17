import { createServer } from "node:http";
import { loadSettings } from "./config.js";

// Deliberately no web framework yet - all this needs to do today is answer
// a health check and prove the daemon lifecycle (rc.d start/stop) works.
// Real routes (API for the frontend, proxied by the nginx conf.d snippet
// under /plugins/unraid-disklocation-next/api/) land once there's a schema
// to query against.
const PORT = Number(process.env.PORT ?? 3838);

const server = createServer((req, res) => {
  if (req.url === "/health") {
    const settings = loadSettings();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, configured: settings !== null }));
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`unraid-disklocation-next listening on :${PORT}`);
});
