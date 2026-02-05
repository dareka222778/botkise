import { SlashCommandBuilder, REST, Routes, PermissionsBitField } from "discord.js";
import { formatUptime, safe1900 } from "./utils.js";
import { narrar, getModel, setModel } from "./openrouter.js";
import { handleAdmin } from "./admin.js";

export function buildCommands() {
  const builders = [
    new SlashCommandBuilder().setName("ping").setDescription("Teste de latência e status do bot."),
    new SlashCommandBuilder().setName("ajuda").setDescription("Mostra os comandos disponíveis."),
    new SlashCommandBuilder().setName("status").setDescription("Mostra informações do bot (uptime, servidores, etc.)."),
    new SlashCommandBuilder()
      .setName("narrar")
      .setDescription("IA narra/continua uma cena de RPG.")
      .addStringOption(opt =>
        opt.setName("texto").setDescription("O que narrar/continuar.").setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("config")
      .setDescription("Configurações do bot (admin).")
      .addSubcommand(sc => sc.setName("ver").setDescription("Mostra o modelo atual."))
      .addSubcommand(sc =>
        sc.setName("modelo")
          .setDescription("Define o modelo do OpenRouter.")
          .addStringOption(opt =>
            opt.setName("nome").setDescription("Ex: meta-llama/llama-3.2-3b-instruct:free").setRequired(true)
          )
      ),
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
          .addStringOption(opt => opt.setName("texto").setDescription("Texto que o bot vai enviar.").setRequired(true))
      )
      .addSubcommand(sc => sc.setName("lock").setDescription("Trava o canal para @everyone (impede enviar mensagens)."))
      .addSubcommand(sc => sc.setName("unlock").setDescription("Destrava o canal para @everyone (permite enviar mensagens)."))
      .addSubcommand(sc => sc.setName("permissao").setDescription("Mostra permissões do bot neste canal."))
  ];

  return builders;
}

export async function registerGlobalCommands({ token, clientId }) {
  const rest = new REST({ version: "10" }).setToken(token);
  const body = buildCommands().map(c => c.toJSON());
  await rest.put(Routes.applicationCommands(clientId), { body });
  console.log("✅ Slash commands globais registrados.");
}

export async function handleSlash(interaction, client) {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ping") {
    return interaction.reply(`🏓 Pong! API: **${Math.round(client.ws.ping)}ms**`);
  }

  if (interaction.commandName === "ajuda") {
    return interaction.reply({
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
  }

  if (interaction.commandName === "status") {
    const uptime = formatUptime(client.uptime ?? 0);
    const guilds = client.guilds.cache.size;
    return interaction.reply({
      content:
        `🧠 **Status do Bot**\n` +
        `• Uptime: **${uptime}**\n` +
        `• Servidores: **${guilds}**\n` +
        `• Latência (WS): **${Math.round(client.ws.ping)}ms**\n` +
        `• Modelo: **${getModel()}**`,
      ephemeral: true
    });
  }

  if (interaction.commandName === "narrar") {
    const texto = interaction.options.getString("texto", true);
    await interaction.deferReply();
    const result = await narrar(texto);
    return interaction.editReply(safe1900(result.text));
  }

  if (interaction.commandName === "config") {
    const sub = interaction.options.getSubcommand();

    if (sub === "ver") {
      return interaction.reply({ content: `⚙️ Modelo atual: **${getModel()}**`, ephemeral: true });
    }

    if (sub === "modelo") {
      if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
        return interaction.reply({ content: "❌ Precisa de **Gerenciar Servidor**.", ephemeral: true });
      }
      const nome = interaction.options.getString("nome", true);
      setModel(nome);
      return interaction.reply({ content: `✅ Modelo atualizado para: **${getModel()}**`, ephemeral: true });
    }
  }

  if (interaction.commandName === "admin") {
    return handleAdmin(interaction);
  }
}

