import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { buildMissionPrompt } from "./prompts.js";
import { FALLBACK_MISSION, normalizeMission, validateAnswer } from "./mission-schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
let OLLAMA_MODEL = process.env.OLLAMA_MODEL || "";

async function resolveModel() {
  if (OLLAMA_MODEL) return OLLAMA_MODEL;
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await r.json();
    const names = (data.models || []).map((m) => m.name);
    const preferred = ["qwen2.5:3b", "llama3.2", "llama3.1:8b", "mistral", "phi3"];
    OLLAMA_MODEL =
      preferred.find((p) => names.some((n) => n === p || n.startsWith(p))) ||
      names[0] ||
      "llama3.2";
  } catch {
    OLLAMA_MODEL = "llama3.2";
  }
  return OLLAMA_MODEL;
}

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

async function ollamaChat(messages, { format = "json", temperature = 0.8 } = {}) {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format,
      options: { temperature },
      messages,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.message?.content ?? "";
}

function parseJsonContent(raw) {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Model did not return valid JSON");
  }
}

app.get("/api/health", async (_req, res) => {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!r.ok) throw new Error("Ollama unreachable");
    const data = await r.json();
    const models = (data.models || []).map((m) => m.name);
    res.json({
      ok: true,
      ollama: true,
      model: OLLAMA_MODEL,
      models,
    });
  } catch (err) {
    res.status(503).json({
      ok: false,
      ollama: false,
      model: OLLAMA_MODEL,
      error: err.message,
    });
  }
});

app.post("/api/mission", async (req, res) => {
  const seed = req.body?.seed || Date.now();
  try {
    const raw = await ollamaChat(
      [
        { role: "system", content: buildMissionPrompt() },
        {
          role: "user",
          content: `Generate a unique escape mission. Session seed: ${seed}. Return only JSON.`,
        },
      ],
      { temperature: 0.65 }
    );

    const parsed = parseJsonContent(raw);
    const mission = normalizeMission(parsed);
    res.json({ source: "ollama", mission });
  } catch (err) {
    console.error("Mission generation failed:", err.message);
    const mission = normalizeMission(FALLBACK_MISSION);
    res.json({
      source: "fallback",
      mission,
      warning: err.message,
    });
  }
});

app.post("/api/validate", (req, res) => {
  const { puzzle, answer } = req.body || {};
  const result = validateAnswer(puzzle, answer);
  res.json(result);
});

resolveModel().then((model) => {
  OLLAMA_MODEL = model;
  app.listen(PORT, () => {
    console.log(`Zero Trace server → http://localhost:${PORT}`);
    console.log(`Ollama model: ${OLLAMA_MODEL} @ ${OLLAMA_URL}`);
  });
});
