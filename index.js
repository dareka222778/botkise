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
// 1) CONFIG
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
// 2) KEEP-ALIVE HTTP (Azure Linux)
// =========================
const PORT = Number(process.env.PORT || 3000);
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("ok");
}).listen(PORT, "0.0.0.0", () => {
  console.log("HTTP ativo na porta", PORT);
});

// =========================
// 3) SLASH COMMANDS (GLOBAL)
// =========================
const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Teste de latência e status do bot."),

  new SlashCommandBuilder()
    .setName("ajuda")
    .setDescription("Mostra os comandos disponíveis."),

  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Mostra informações do bot (uptime, servidores, etc.)."),

  new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Comandos administrativos.")
    .addSubcommand(sc =>
      sc.setName("limpar")
        .setDescription("Apaga mensagens do canal (até 100).")
        .addIntegerOption(opt =>
          opt.setName("quantidade")
            .setDescription("Quantidade de mensagens para apagar (1 a 100).")
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
            .setDescription("Texto que o bot vai enviar.")
            .setRequired(true)
        )
    )
    .addSubcommand(sc =>
      sc.setName("lock")
        .setDescription("Trava o canal para @everyone (impede enviar mensagens).")
    )
    .addSubcommand(sc =>
      sc.setName("unlock")
        .setDescription("Destrava o canal para @everyone (permite enviar mensagens).")
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
// 4) HELPERS
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
// 5) EVENTS
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
          "• `/admin limpar quantidade:1-100`\n" +
          "• `/admin say texto:...`\n" +
          "• `/admin lock`\n" +
          "• `/admin unlock`\n" +
          "• `/admin permissao`\n",
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
        if (!requireUserPerm(interaction, PermissionsBitField.Flags.ManageMessages, "❌ Você precisa de **Gerenciar Mensagens**.")) return;
        if (!requireBotPerm(interaction, PermissionsBitField.Flags.ManageMessages, "❌ Eu preciso de **Gerenciar Mensagens**.")) return;

        const qtd = interaction.options.getInteger("quantidade", true);

        // Defer para evitar timeout
        await interaction.deferReply({ ephemeral: true });

        const fetched = await interaction.channel.messages.fetch({ limit: qtd });
        const deletable = fetched.filter(m => !m.pinned);

        // bulkDelete não apaga mensagens muito antigas (limitação do Discord)
        const deleted = await interaction.channel.bulkDelete(deletable, true);

        await interaction.editReply(`🧹 Apaguei **${deleted.size}** mensagens (ignorando fixadas/antigas).`);
        return;
      }

      // /admin say
      if (sub === "say") {
        if (!requireUserPerm(interaction, PermissionsBitField.Flags.ManageGuild, "❌ Você precisa de **Gerenciar Servidor**.")) return;
        if (!requireBotPerm(interaction, PermissionsBitField.Flags.SendMessages, "❌ Eu não tenho permissão para enviar mensagens aqui.")) return;

        const texto = interaction.options.getString("texto", true);
        await interaction.reply({ content: "✅ Enviado.", ephemeral: true });
        await interaction.channel.send(texto);
        return;
      }

      // /admin lock / unlock
      if (sub === "lock" || sub === "unlock") {
        if (!requireUserPerm(interaction, PermissionsBitField.Flags.ManageChannels, "❌ Você precisa de **Gerenciar Canais**.")) return;
        if (!requireBotPerm(interaction, PermissionsBitField.Flags.ManageChannels, "❌ Eu preciso de **Gerenciar Canais**.")) return;

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

      // fallback
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
client.on("messageCreate", (msg) => {
  if (msg.author.bot) return;
  // Aqui depois vamos registrar memória por campanha, logs, etc.
  // Por enquanto, não faz nada automático pra não virar spam.
});

if (TOKEN) {
  client.login(TOKEN);
} else {
  console.error("Sem DISCORD_TOKEN, não vou conectar no Discord.");
}
