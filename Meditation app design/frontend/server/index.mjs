import http from "node:http";
import { loadLocalEnv } from "./env.mjs";
import { runTravelAgent } from "./agent.mjs";

loadLocalEnv();

const PORT = Number(process.env.PORT || 8787);

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) return {};
  return JSON.parse(text);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "travel-agent-backend",
      provider: process.env.LLM_PROVIDER || "openai-compatible",
      model: process.env.LLM_MODEL || "default",
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/chat") {
    try {
      const body = await readJsonBody(req);
      const message = typeof body.message === "string" ? body.message : "";
      const trip = typeof body.trip === "object" && body.trip ? body.trip : {};

      if (!message.trim()) {
        sendJson(res, 400, { error: "message is required" });
        return;
      }

      const response = await runTravelAgent(message, trip);
      sendJson(res, 200, response);
    } catch (error) {
      sendJson(res, 500, {
        error: "agent_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return;
  }

  sendJson(res, 404, { error: "not_found" });
});

server.listen(PORT, () => {
  console.log(`Travel agent backend running on http://localhost:${PORT}`);
});

