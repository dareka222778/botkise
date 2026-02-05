const OR_URL = "https://openrouter.ai/api/v1/chat/completions";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithTimeout(url, options, timeoutMs = 25000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...options, signal: controller.signal });
    return r;
  } finally {
    clearTimeout(t);
  }
}

// Modelos: coloque 1 “principal” + fallback.
// Os FREE podem falhar por limite. Eu deixei um mix.
const MODEL_FALLBACKS = [
  "google/gemma-3-12b",          // geralmente bom custo/benefício
  "mistralai/mistral-small-3.1", // bom
  "meta-llama/llama-3.3-70b-instruct", // pesado, pode falhar (depende)
  "tngtech/r1t-chimera",         // free, mas vive em limite
];

export async function chat({ system, user, temperature = 0.8, max_tokens = 450 }) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("Falta OPENROUTER_API_KEY nas variáveis.");

  const siteUrl = process.env.OPENROUTER_SITE_URL || "https://seuapp.azurewebsites.net";
  const appName = process.env.OPENROUTER_APP_NAME || "Mestre Kise";

  let lastErr = null;

  for (const model of MODEL_FALLBACKS) {
    try {
      const r = await fetchWithTimeout(OR_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": siteUrl,
          "X-Title": appName,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature,
          max_tokens,
        })
      }, 25000);

      const raw = await r.text();
      let data = null;
      try { data = JSON.parse(raw); } catch { data = { _raw: raw }; }

      if (!r.ok) {
        // 429/503 etc
        lastErr = new Error(`OpenRouter erro ${r.status}: ${data?.error?.message || raw}`);
        // espera um pouco e tenta próximo modelo
        await sleep(600);
        continue;
      }

      const content = data?.choices?.[0]?.message?.content;
      if (!content || !content.trim()) {
        lastErr = new Error(`Sem conteúdo do modelo ${model}.`);
        await sleep(300);
        continue;
      }

      return { ok: true, model, content };
    } catch (e) {
      lastErr = e;
      await sleep(400);
    }
  }

  return {
    ok: false,
    model: null,
    content: "❌ IA não retornou resposta (modelos indisponíveis/limite).",
    error: String(lastErr?.message || lastErr || "erro desconhecido"),
  };
}
