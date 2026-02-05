// slash.js
import { REST, Routes, PermissionsBitField } from "discord.js";
import { buildSlashCommands, safe1900 } from "./utils.js";

import * as economy from "./economy.js";
import * as casino from "./casino.js";
import * as admin from "./admin.js";
import * as storage from "./storage.js";

// IA (OpenRouter)
import { narrar, getModel, setModel } from "./openrouter.js";

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

export async function registerGlobalCommands() {
  if (!TOKEN || !CLIENT_ID) throw new Error("Falta DISCORD_TOKEN ou DISCORD_CLIENT_ID.");

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  const body = buildSlashCommands().map((c) => c.toJSON());

  await rest.put(Routes.applicationCommands(CLIENT_ID), { body });
  console.log("✅ Slash commands globais registrados.");
}

export async function handleInteraction(interaction, ctx) {
  try {
    // =========================
    // 1) COMPONENTS (Buttons / SelectMenus)
    // =========================
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      // Casino/games (truco/blackjack etc)
      return await casino.handleComponent(interaction, ctx);
    }

    // =========================
    // 2) SLASH COMMANDS
    // =========================
    if (!interaction.isChatInputCommand()) return;

    const name = interaction.commandName;

    // /ping
    if (name === "ping") {
      return interaction.reply(`🏓 Pong! API: **${Math.round(ctx.client.ws.ping)}ms**`);
    }

    // /ajuda
    if (name === "ajuda") {
      return interaction.reply({
        content:
          "**Comandos:**\n" +
          "• `/ping`\n" +
          "• `/narrar texto:...`\n" +
          "• `/config ver`\n" +
          "• `/config modelo nome:...` (admin)\n" +
          "• `/eco ...`\n" +
          "• `/cassino ...`\n" +
          "• `/admin ...`\n" +
          "• `/storage ...`\n" +
          "\n**Prefix:** `!narrar texto...`\n",
        ephemeral: true,
      });
    }

    // /narrar
    if (name === "narrar") {
      const texto = interaction.options.getString("texto", true);
      await interaction.deferReply();

      const result = await narrar(texto);

      if (!result.ok) {
        console.error("IA falhou:", result.error, "Tried:", result.tried);
      }

      return interaction.editReply(safe1900(result.text));
    }

    // /config (modelo IA)
    if (name === "config") {
      const sub = interaction.options.getSubcommand();

      if (sub === "ver") {
        return interaction.reply({ content: `⚙️ Modelo atual: **${getModel()}**`, ephemeral: true });
      }

      if (sub === "modelo") {
        // só admin
        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
          return interaction.reply({ content: "❌ Precisa de **Gerenciar Servidor**.", ephemeral: true });
        }
        const nome = interaction.options.getString("nome", true);
        setModel(nome);
        return interaction.reply({ content: `✅ Modelo atualizado para: **${getModel()}**`, ephemeral: true });
      }
    }

    // /eco
    if (name === "eco") return economy.handleEco(interaction, ctx);

    // /cassino
    if (name === "cassino") return casino.handleCasino(interaction, ctx);

    // /admin
    if (name === "admin") return admin.handleAdmin(interaction, ctx);

    // /storage
    if (name === "storage") return storage.handleStorage(interaction, ctx);

    // fallback
    return interaction.reply({ content: "Comando não reconhecido.", ephemeral: true });
  } catch (err) {
    console.error("Erro no handleInteraction:", err);

    // evita erro "Unknown interaction" / "Already replied"
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply("❌ Deu erro ao executar esse comando.");
    }
    return interaction.reply({ content: "❌ Deu erro ao executar esse comando.", ephemeral: true });
  }
}
