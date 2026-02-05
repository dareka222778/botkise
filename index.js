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
// 0) SAFETY LOGS (não crashar “silencioso”)
// =========================
process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));
process.on("uncaughtException", (e) => console.error("uncaughtException:", e));

// =========================
// 1) OPENROUTER (IA)
// =========================
// ✅ Ajustes incluídos:
// - modelo mais estável por padrão (DeepSeek R1)
// - fallback automático se o modelo falhar
// - logs detalhados quando OpenRouter der erro
// - retorno "IA não retornou resposta" só quando realmente não veio texto

const PRIMARY_MODEL = process.env.OPENROUTER_MODEL || "deepseek/deepseek-r1";
// Se você quiser insistir na Chimera, coloque na Azure:
// OPENROUTER_MODEL=tngtech/deepseek-r1t-chimera
const FALLBACK_MODELS = [
  "tngtech/deepseek-r1t-chimera",
  "meta-llama/llama-3.3-70b-instruct"
];

async function callOpenRouterOnce({ model, messages, temperature = 0.8, max_tokens = 400 }) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("Falta OPENROUTER_API_KEY nas variáveis.");

  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      // Esses headers ajudam o OpenRouter a identificar sua app (pode ser qualquer coisa)
      "HTTP-Referer": process.env.OPENROUTER_REFERER || "https://seuapp.azurewebsites.net",
      "X-Title": process.env.OPENROUTER_TITLE || "Bot RPG Discord"
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
    console.error("❌ OpenRouter HTTP", r.status, "model:", model, "payload:", data);
    const msg = data?.error?.message || `OpenRouter erro HTTP ${r.status}`;
    throw new Error(msg);
  }

  const resp = data?.choices?.[0]?.message?.content;
  if (!resp) {
    // Loga o payload pra você ver o que veio (rate limit, overload, etc.)
    console.error("❌ OpenRouter sem choices/content. model:", model, "payload:", data);
    throw new Error("OpenRouter não retornou conteúdo");
  }

  return resp;
}

async function chamarOpenRouter(texto) {
  const messages = [
    { role: "system", content: "Você é um narrador de RPG para Discord. Responda em PT-BR." },
    { role: "user", content: texto }
  ];

  // Tenta o modelo principal
  try {
    return await callOpenRouterOnce({ model: PRIMARY_MODEL, messages });
  } catch (e1) {
    console.error("⚠️ Falha no modelo principal:", PRIMARY_MODEL, e1?.message);
  }

  // Fallbacks
  for (const model of FALLBACK_MODELS) {
    try {
      return await callOpenRouterOnce({ model, messages });
    } catch (e2) {
      console.error("⚠️ Falha no fallback:", model, e2?.message);
    }
  }

  return "❌ IA não retornou resposta (modelos indisponíveis/limite).";
}

// =========================
// 2) CONFIG
// =========================
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

if (!TOKEN) console.error("Falta DISCORD_TOKEN nas variáveis de ambiente.");
if (!CLIENT_ID) console.error("Falta DISCORD_CLIENT_ID nas variáveis de ambiente.");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// =========================
// 3) KEEP-ALIVE HTTP (Azure Linux)
// =========================
const PORT = Number(process.env.PORT || 3000);
http
  .createServer((req, res) => {
    res.writeHead(200);
    res.end("ok");
  })
  .listen(PORT, "0.0.0.0", () => {
    console.log("HTTP ativo na porta", PORT);
  });

// =========================
// 4) SLASH COMMANDS (GLOBAL)
// =========================
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Teste de latência e status do bot."),

  new SlashCommandBuilder().setName("ajuda").setDescription("Mostra os comandos disponíveis."),

  new SlashCommandBuilder().setName("status").setDescription("Mostra informações do bot (uptime, servidores, etc.)."),

  // ✅ NOVO: /narrar (recomendado, mais confiável que prefix)
  new SlashCommandBuilder()
    .setName("narrar")
    .setDescription("Faz a IA narrar/continuar uma cena.")
    .addStringOption(opt =>
      opt.setName("texto").setDescription("O que você quer que o narrador faça/continue.").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Comandos administrativos.")
    .addSubcommand(sc =>
      sc
        .setName("limpar")
        .setDescription("Apaga mensagens do canal (até 100).")
        .addIntegerOption(opt =>
          opt
            .setName("quantidade")
            .setDescription("Quantidade de mensagens para apagar (1 a 100).")
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(true)
        )
    )
    .addSubcommand(sc =>
      sc
        .setName("say")
        .setDescription("Faz o bot enviar uma mensagem.")
        .addStringOption(opt => opt.setName("texto").setDescription("Texto que o bot vai enviar.").setRequired(true))
    )
    .addSubcommand(sc => sc.setName("lock").setDescription("Trava o canal para @everyone (impede enviar mensagens)."))
    .addSubcommand(sc => sc.setName("unlock").setDescription("Destrava o canal para @everyone (permite enviar mensagens)."))
    .addSubcommand(sc => sc.setName("permissao").setDescription("Mostra permissões do bot neste canal."))
].map(c => c.toJSON());

async function registerGlobalCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("✅ Slash commands globais registrados.");
}

// =========================
// 5) PREFIX COMMAND (!narrar) - opcional
// =========================
client.on("messageCreate", async message => {
  if (message.author.bot) return;

  if (message.content.startsWith("!narrar ")) {
    const texto = message.content.slice("!narrar ".length).trim();
    if (!texto) return;

    try {
      await message.channel.send("🧠 Pensando...");
      const resposta = await chamarOpenRouter(texto);

      // Discord tem limite ~2000 chars por mensagem
      const out = resposta.length > 1900 ? resposta.slice(0, 1900) + "…" : resposta;
      await message.channel.send(out);
    } catch (e) {
      console.error(e);
      await message.channel.send("❌ Erro ao chamar a IA.");
    }
  }
});

// =========================
// 6) HELPERS
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
// 7) EVENTS
// =========================
client.once("ready", async () => {
  console.log(`🤖 Conectado como ${client.user.tag}`);
  try {
    await registerGlobalCommands();
  } catch (e) {
    console.error("❌ Falha registrando comandos globais:", e);
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    // /ping
    if (interaction.commandName === "ping") {
      const apiPing = Math.round(client.ws.ping);
      await interaction.reply(`🏓 Pong! API: **${apiPing}ms**`);
      return;
    }

    // /ajuda
    if (interaction.commandName === "ajuda") {
      await interaction.reply({
        content:
          "**Comandos:**\n" +
          "• `/ping`\n" +
          "• `/status`\n" +
          "• `/narrar texto:...`\n" +
          "• `/admin limpar quantidade:1-100`\n" +
          "• `/admin say texto:...`\n" +
          "• `/admin lock`\n" +
          "• `/admin unlock`\n" +
          "• `/admin permissao`\n" +
          "\n**Prefix (opcional):** `!narrar ...`\n",
        ephemeral: true
      });
      return;
    }

    // /status
    if (interaction.commandName === "status") {
      const uptime = formatUptime(client.uptime ?? 0);
      const guilds = client.guilds.cache.size;
      await interaction.reply({
        content:
          `🧠 **Status do Bot**\n` +
          `• Uptime: **${uptime}**\n` +
          `• Servidores: **${guilds}**\n` +
          `• Latência (WS): **${Math.round(client.ws.ping)}ms**\n` +
          `• Canal: <#${interaction.channelId}>`,
        ephemeral: true
      });
      return;
    }

    // ✅ /narrar (IA)
    if (interaction.commandName === "narrar") {
      const texto = interaction.options.getString("texto", true);

      // evita timeout do Discord (a IA pode demorar)
      await interaction.deferReply();

      const resposta = await chamarOpenRouter(texto);
      const out = resposta.length > 1900 ? resposta.slice(0, 1900) + "…" : resposta;

      await interaction.editReply(out);
      return;
    }

    // /admin ...
    if (interaction.commandName === "admin") {
      const sub = interaction.options.getSubcommand();

      // /admin permissao
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

      // /admin limpar
      if (sub === "limpar") {
        if (!requireUserPerm(interaction, PermissionsBitField.Flags.ManageMessages, "❌ Você precisa de **Gerenciar Mensagens**."))
          return;
        if (!requireBotPerm(interaction, PermissionsBitField.Flags.ManageMessages, "❌ Eu preciso de **Gerenciar Mensagens**."))
          return;

        const qtd = interaction.options.getInteger("quantidade", true);

        await interaction.deferReply({ ephemeral: true });

        const fetched = await interaction.channel.messages.fetch({ limit: qtd });
        const deletable = fetched.filter(m => !m.pinned);

        const deleted = await interaction.channel.bulkDelete(deletable, true);

        await interaction.editReply(`🧹 Apaguei **${deleted.size}** mensagens (ignorando fixadas/antigas).`);
        return;
      }

      // /admin say
      if (sub === "say") {
        if (!requireUserPerm(interaction, PermissionsBitField.Flags.ManageGuild, "❌ Você precisa de **Gerenciar Servidor**."))
          return;
        if (!requireBotPerm(interaction, PermissionsBitField.Flags.SendMessages, "❌ Eu não tenho permissão para enviar mensagens aqui."))
          return;

        const texto = interaction.options.getString("texto", true);
        await interaction.reply({ content: "✅ Enviado.", ephemeral: true });
        await interaction.channel.send(texto);
        return;
      }

      // /admin lock / unlock
      if (sub === "lock" || sub === "unlock") {
        if (!requireUserPerm(interaction, PermissionsBitField.Flags.ManageChannels, "❌ Você precisa de **Gerenciar Canais**."))
          return;
        if (!requireBotPerm(interaction, PermissionsBitField.Flags.ManageChannels, "❌ Eu preciso de **Gerenciar Canais**."))
          return;

        if (interaction.channel.type !== ChannelType.GuildText) {
          return interaction.reply({ content: "❌ Esse comando só funciona em canal de texto.", ephemeral: true });
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
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply("❌ Deu erro ao executar esse comando.");
    } else {
      await interaction.reply({ content: "❌ Deu erro ao executar esse comando.", ephemeral: true });
    }
  }
});

// (Opcional) Ler tudo e só reagir quando marcado — por enquanto só “observa”
// ✅ Mantém só um listener. (antes você tinha dois messageCreate; removemos o duplicado)
client.on("messageCreate", msg => {
  if (msg.author.bot) return;
  // Aqui depois vamos registrar memória por campanha, logs, etc.
  // Por enquanto, não faz nada automático pra não virar spam.
});

if (TOKEN) {
  client.login(TOKEN);
} else {
  console.error("Sem DISCORD_TOKEN, não vou conectar no Discord.");
}
