import {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType
} from "discord.js";
import http from "http";

// =========================
// 0) SAFETY (logs)
// =========================
process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));
process.on("uncaughtException", (e) => console.error("uncaughtException:", e));

// =========================
// 1) CONFIG ENV
// =========================
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const OR_KEY = process.env.OPENROUTER_API_KEY;

if (!TOKEN) console.error("Falta DISCORD_TOKEN nas variáveis.");
if (!CLIENT_ID) console.error("Falta DISCORD_CLIENT_ID nas variáveis.");
if (!OR_KEY) console.error("Falta OPENROUTER_API_KEY nas variáveis.");

// Você pode deixar isso assim
const OR_REFERER = process.env.OPENROUTER_REFERER || "https://seuapp.azurewebsites.net";
const OR_TITLE = process.env.OPENROUTER_TITLE || "Bot RPG Discord";

// =========================
// 2) DISCORD CLIENT
// =========================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// =========================
// 3) KEEP-ALIVE HTTP (Azure)
// =========================
const PORT = Number(process.env.PORT || 3000);
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("ok");
}).listen(PORT, "0.0.0.0", () => {
  console.log("HTTP ativo na porta", PORT);
});

// =========================
// 4) MODELOS (melhor p/ agora)
// =========================
// Tenta modelos "free" leves primeiro.
// (Se o OpenRouter bloquear saldo zero, vai retornar 402/401 e a gente mostra o erro.)
let CURRENT_MODEL = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.2-3b-instruct:free";

const FALLBACK_MODELS = [
  "google/gemma-3-4b:free",
  "qwen/qwen3-4b:free",
  "liquid/lfm-2.5-1.2b-instruct:free"
];

// =========================
// 5) OPENROUTER CALL (com timeout + erro claro)
// =========================
async function callOpenRouter({ model, messages, temperature = 0.7, max_tokens = 220 }) {
  if (!OR_KEY) throw new Error("OPENROUTER_API_KEY não configurada.");

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
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens
      })
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      const msg = data?.error?.message || data?.message || "Erro desconhecido";
      console.error("❌ OpenRouter erro:", r.status, "model:", model, data);
      throw new Error(`OpenRouter ${r.status}: ${msg}`);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      console.error("❌ OpenRouter resposta vazia. model:", model, data);
      throw new Error("OpenRouter respondeu vazio (modelo ocupado/limitado).");
    }

    return content;
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error("Timeout: a IA demorou demais.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function narrarComFallback(texto) {
  const messages = [
    { role: "system", content: "Você é um narrador de RPG para Discord. Responda em PT-BR, direto e vívido, sem enrolar." },
    { role: "user", content: texto }
  ];

  const modelsToTry = [CURRENT_MODEL, ...FALLBACK_MODELS];
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const resp = await callOpenRouter({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 220
      });
      return { ok: true, model, text: resp };
    } catch (e) {
      lastError = e;
      console.error("⚠️ Falha no modelo:", model, e?.message);
      // se for 401/402/429, geralmente não adianta insistir muito, mas vamos tentar os fallbacks mesmo.
    }
  }

  return {
    ok: false,
    model: null,
    text:
      "❌ IA não respondeu.\n" +
      `Motivo provável: **saldo 0**, limite, ou modelos indisponíveis.\n` +
      `Erro: **${String(lastError?.message || lastError)}**`
  };
}

// =========================
// 6) SLASH COMMANDS (GLOBAL)
// =========================
const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Teste de latência e status do bot."),

  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Mostra informações do bot (uptime, servidores, etc.)."),

  new SlashCommandBuilder()
    .setName("ajuda")
    .setDescription("Mostra os comandos disponíveis."),

  new SlashCommandBuilder()
    .setName("narrar")
    .setDescription("IA narra/continua uma cena de RPG.")
    .addStringOption(opt =>
      opt.setName("texto")
        .setDescription("O que narrar/continuar.")
        .setRequired(true)
    ),

  // ✅ pra você trocar o modelo sem mexer no código (admin)
  new SlashCommandBuilder()
    .setName("config")
    .setDescription("Configurações do bot (admin).")
    .addSubcommand(sc =>
      sc.setName("modelo")
        .setDescription("Define o modelo do OpenRouter.")
        .addStringOption(opt =>
          opt.setName("nome")
            .setDescription("Ex: meta-llama/llama-3.2-3b-instruct:free")
            .setRequired(true)
        )
    )
    .addSubcommand(sc =>
      sc.setName("ver")
        .setDescription("Mostra o modelo atual.")
    ),

  new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Comandos administrativos.")
    .addSubcommand(sc =>
      sc.setName("limpar")
        .setDescription("Apaga mensagens do canal (até 100).")
        .addIntegerOption(opt =>
          opt.setName("quantidade")
            .setDescription("Quantidade (1 a 100).")
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(true)
        )
    )
    .addSubcommand(sc =>
      sc.setName("say")
        .setDescription("Faz o bot enviar uma mensagem.")
        .addStringOption(opt =>
          opt.setName("texto")
            .setDescription("Texto.")
            .setRequired(true)
        )
    )
    .addSubcommand(sc =>
      sc.setName("lock")
        .setDescription("Trava o canal para @everyone.")
    )
    .addSubcommand(sc =>
      sc.setName("unlock")
        .setDescription("Destrava o canal para @everyone.")
    )
    .addSubcommand(sc =>
      sc.setName("permissao")
        .setDescription("Mostra permissões do bot neste canal.")
    )
].map(c => c.toJSON());

async function registerGlobalCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("✅ Slash commands globais registrados.");
}

// =========================
// 7) PREFIX (!narrar ...)
// =========================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content.startsWith("!narrar ")) {
    const texto = message.content.slice("!narrar ".length).trim();
    if (!texto) return;

    await message.channel.send("🧠 Pensando...");

    const result = await narrarComFallback(texto);
    const out = result.text.length > 1900 ? result.text.slice(0, 1900) + "…" : result.text;

    await message.channel.send(out);
  }
});

// =========================
// 8) HELPERS
// =========================
function formatUptime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}

function requireUserPerm(interaction, perm, msg) {
  const memberPerms = interaction.memberPermissions;
  if (!memberPerms || !memberPerms.has(perm)) {
    interaction.reply({ content: msg, ephemeral: true });
    return false;
  }
  return true;
}

function requireBotPerm(interaction, perm, msg) {
  const me = interaction.guild?.members?.me;
  const botPerms = interaction.channel?.permissionsFor(me);
  if (!botPerms || !botPerms.has(perm)) {
    interaction.reply({ content: msg, ephemeral: true });
    return false;
  }
  return true;
}

// =========================
// 9) EVENTS
// =========================
client.once("ready", async () => {
  console.log(`🤖 Conectado como ${client.user.tag}`);
  try {
    await registerGlobalCommands();
  } catch (e) {
    console.error("❌ Falha registrando comandos globais:", e);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "ping") {
      const apiPing = Math.round(client.ws.ping);
      await interaction.reply(`🏓 Pong! API: **${apiPing}ms**`);
      return;
    }

    if (interaction.commandName === "ajuda") {
      await interaction.reply({
        content:
          "**Comandos:**\n" +
          "• `/ping`\n" +
          "• `/status`\n" +
          "• `/narrar texto:...`\n" +
          "• `/config ver`\n" +
          "• `/config modelo nome:...` (admin)\n" +
          "• `/admin ...`\n" +
          "\n**Prefix:** `!narrar ...`\n",
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName === "status") {
      const uptime = formatUptime(client.uptime ?? 0);
      const guilds = client.guilds.cache.size;
      await interaction.reply({
        content:
          `🧠 **Status do Bot**\n` +
          `• Uptime: **${uptime}**\n` +
          `• Servidores: **${guilds}**\n` +
          `• Latência (WS): **${Math.round(client.ws.ping)}ms**\n` +
          `• Modelo atual: **${CURRENT_MODEL}**`,
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName === "narrar") {
      const texto = interaction.options.getString("texto", true);
      await interaction.deferReply();

      const result = await narrarComFallback(texto);
      const out = result.text.length > 1900 ? result.text.slice(0, 1900) + "…" : result.text;

      await interaction.editReply(out);
      return;
    }

    // /config (admin)
    if (interaction.commandName === "config") {
      const sub = interaction.options.getSubcommand();

      if (sub === "ver") {
        await interaction.reply({ content: `⚙️ Modelo atual: **${CURRENT_MODEL}**`, ephemeral: true });
        return;
      }

      if (sub === "modelo") {
        if (!requireUserPerm(interaction, PermissionsBitField.Flags.ManageGuild, "❌ Precisa de **Gerenciar Servidor**.")) return;

        const nome = interaction.options.getString("nome", true).trim();
        CURRENT_MODEL = nome;

        await interaction.reply({
          content:
            `✅ Modelo atualizado para: **${CURRENT_MODEL}**\n` +
            `Dica: use modelos com sufixo **:free** se estiver sem crédito.`,
          ephemeral: true
        });
        return;
      }
    }

    // /admin
    if (interaction.commandName === "admin") {
      const sub = interaction.options.getSubcommand();

      if (sub === "permissao") {
        const me = interaction.guild?.members?.me;
        const perms = interaction.channel?.permissionsFor(me);
        if (!perms) {
          return interaction.reply({ content: "Não consegui ler permissões aqui.", ephemeral: true });
        }
        return interaction.reply({
          content:
            `🔐 **Permissões do bot neste canal:**\n` +
            `• Enviar mensagens: ${perms.has(PermissionsBitField.Flags.SendMessages) ? "✅" : "❌"}\n` +
            `• Gerenciar mensagens: ${perms.has(PermissionsBitField.Flags.ManageMessages) ? "✅" : "❌"}\n` +
            `• Gerenciar canal: ${perms.has(PermissionsBitField.Flags.ManageChannels) ? "✅" : "❌"}\n` +
            `• Ler histórico: ${perms.has(PermissionsBitField.Flags.ReadMessageHistory) ? "✅" : "❌"}\n`,
          ephemeral: true
        });
      }

      if (sub === "limpar") {
        if (!requireUserPerm(interaction, PermissionsBitField.Flags.ManageMessages, "❌ Precisa de **Gerenciar Mensagens**.")) return;
        if (!requireBotPerm(interaction, PermissionsBitField.Flags.ManageMessages, "❌ Eu preciso de **Gerenciar Mensagens**.")) return;

        const qtd = interaction.options.getInteger("quantidade", true);
        await interaction.deferReply({ ephemeral: true });

        const fetched = await interaction.channel.messages.fetch({ limit: qtd });
        const deletable = fetched.filter(m => !m.pinned);
        const deleted = await interaction.channel.bulkDelete(deletable, true);

        await interaction.editReply(`🧹 Apaguei **${deleted.size}** mensagens (ignorando fixadas/antigas).`);
        return;
      }

      if (sub === "say") {
        if (!requireUserPerm(interaction, PermissionsBitField.Flags.ManageGuild, "❌ Precisa de **Gerenciar Servidor**.")) return;
        if (!requireBotPerm(interaction, PermissionsBitField.Flags.SendMessages, "❌ Não posso enviar mensagens aqui.")) return;

        const texto = interaction.options.getString("texto", true);
        await interaction.reply({ content: "✅ Enviado.", ephemeral: true });
        await interaction.channel.send(texto);
        return;
      }

      if (sub === "lock" || sub === "unlock") {
        if (!requireUserPerm(interaction, PermissionsBitField.Flags.ManageChannels, "❌ Precisa de **Gerenciar Canais**.")) return;
        if (!requireBotPerm(interaction, PermissionsBitField.Flags.ManageChannels, "❌ Eu preciso de **Gerenciar Canais**.")) return;

        if (interaction.channel.type !== ChannelType.GuildText) {
          return interaction.reply({ content: "❌ Só funciona em canal de texto.", ephemeral: true });
        }

        const allow = sub === "unlock";
        await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
          SendMessages: allow
        });

        await interaction.reply({
          content: allow ? "🔓 Canal destravado para @everyone." : "🔒 Canal travado para @everyone.",
          ephemeral: true
        });
        return;
      }

      await interaction.reply({ content: "Subcomando não reconhecido.", ephemeral: true });
      return;
    }

  } catch (err) {
    console.error("Erro no command:", err);
    const msg = `❌ ${String(err?.message || err)}`.slice(0, 1900);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(msg);
    } else {
      await interaction.reply({ content: msg, ephemeral: true });
    }
  }
});

// Observa tudo (por enquanto não age automático)
client.on("messageCreate", (msg) => {
  if (msg.author.bot) return;
  // depois: memória por canal/campanha
});

if (TOKEN) client.login(TOKEN);
      
