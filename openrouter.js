const OR_KEY = process.env.OPENROUTER_API_KEY;
const OR_REFERER = process.env.OPENROUTER_REFERER || "https://seuapp.azurewebsites.net";
const OR_TITLE = process.env.OPENROUTER_TITLE || "Bot RPG Discord";

// Melhor “pra agora” (saldo 0): modelos leves :free, com fallback
let CURRENT_MODEL = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.2-3b-instruct:free";
const FALLBACK_MODELS = [
  "google/gemma-3-4b:free",
  "qwen/qwen3-4b:free",
  "liquid/lfm-2.5-1.2b-instruct:free"
];

export function getModel() {
  return CURRENT_MODEL;
}

export function setModel(name) {
  CURRENT_MODEL = String(name || "").trim() || CURRENT_MODEL;
}

async function callOpenRouter({ model, messages, temperature = 0.7, max_tokens = 220 }) {
  if (!OR_KEY) throw new Error("OPENROUTER_API_KEY não configurada (Azure).");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${OR_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": OR_REFERER,
        "X-Title": OR_TITLE
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens })
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      const msg = data?.error?.message || data?.message || "Erro desconhecido";
      console.error("❌ OpenRouter erro:", r.status, "model:", model, data);
      throw new Error(`OpenRouter ${r.status}: ${msg}`);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      console.error("❌ OpenRouter vazio. model:", model, data);
      throw new Error("OpenRouter respondeu vazio (modelo ocupado/limitado).");
    }

    return content;
  } catch (err) {
    if (err?.name === "AbortError") throw new Error("Timeout: a IA demorou demais.");
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function narrar(texto) {
  const messages = [
    { role: "system", content: "Você é um narrador de RPG para Discord. Responda em PT-BR, direto e vívido." },
    { role: "user", content: texto }
  ];

  const models = [CURRENT_MODEL, ...FALLBACK_MODELS];
  let lastError = null;

  for (const model of models) {
    try {
      const resp = await callOpenRouter({ model, messages, temperature: 0.7, max_tokens: 220 });
      return { ok: true, model, text: resp };
    } catch (e) {
      lastError = e;
      console.error("⚠️ Falha no modelo:", model, e?.message);
    }
  }

  return {
    ok: false,
    model: null,
    text:
      "❌ IA não respondeu.\n" +
      "Motivo provável: **saldo 0**, limite, ou modelo indisponível.\n" +
      `Erro: **${String(lastError?.message || lastError)}**`
  };
}
