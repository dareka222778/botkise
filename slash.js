import { REST, Routes, SlashCommandBuilder } from "discord.js";
import * as economy from "./economy.js";
import * as casino from "./casino.js";
import * as admin from "./admin.js";
import * as storage from "./storage.js";

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

export function buildSlashCommands() {
  const cmds = [];

  cmds.push(
    new SlashCommandBuilder().setName("ping").setDescription("Teste de latência e status do bot."),
    new SlashCommandBuilder().setName("ajuda").setDescription("Mostra os comandos disponíveis.")
  );

  // ===== ECONOMIA =====
  cmds.push(
    new SlashCommandBuilder()
      .setName("eco")
      .setDescription("Sistema de economia.")
      .addSubcommand(sc => sc.setName("saldo").setDescription("Mostra seu saldo."))
      .addSubcommand(sc =>
        sc.setName("daily").setDescription("Resgata recompensa diária.")
      )
      .addSubcommand(sc =>
        sc.setName("pagar")
          .setDescription("Transfere dinheiro para alguém.")
          .addUserOption(opt => opt.setName("usuario").setDescription("Quem recebe").setRequired(true))
          .addIntegerOption(opt => opt.setName("valor").setDescription("Valor").setMinValue(1).setRequired(true))
      )
  );

  // ===== CASSINO =====
  cmds.push(
    new SlashCommandBuilder()
      .setName("cassino")
      .setDescription("Jogos de cassino.")
      .addSubcommand(sc =>
        sc.setName("coinflip")
          .setDescription("Cara ou coroa.")
          .addIntegerOption(opt => opt.setName("aposta").setDescription("Valor da aposta").setMinValue(1).setRequired(true))
          .addStringOption(opt =>
            opt.setName("lado")
              .setDescription("Escolha")
              .setRequired(true)
              .addChoices(
                { name: "cara", value: "cara" },
                { name: "coroa", value: "coroa" }
              )
          )
      )
      .addSubcommand(sc =>
        sc.setName("blackjack")
          .setDescription("Joga blackjack contra a máquina.")
          .addIntegerOption(opt => opt.setName("aposta").setDescription("Valor da aposta").setMinValue(1).setRequired(true))
      )
      .addSubcommand(sc =>
        sc.setName("cockfight")
          .setDescription("Briga de galo (cassino).")
          .addIntegerOption(opt => opt.setName("aposta").setDescription("Valor da aposta").setMinValue(1).setRequired(true))
      )
      .addSubcommand(sc =>
        sc.setName("truco")
          .setDescription("Truco (vs máquina / futuramente PvP).")
          .addIntegerOption(opt => opt.setName("aposta").setDescription("Valor da aposta").setMinValue(1).setRequired(true))
          .addStringOption(opt =>
            opt.setName("modo")
              .setDescription("Modo de jogo")
              .setRequired(true)
              .addChoices(
                { name: "mineiro", value: "mineiro" },
                { name: "paulista", value: "paulista" }
              )
          )
      )
  );

  // ===== ADMIN =====
  cmds.push(
    new SlashCommandBuilder()
      .setName("admin")
      .setDescription("Administração do bot.")
      .addSubcommand(sc => sc.setName("permissoes").setDescription("Mostra permissões do bot neste canal."))
      .addSubcommand(sc =>
        sc.setName("limpar")
          .setDescription("Apaga mensagens do canal (até 100).")
          .addIntegerOption(opt =>
            opt.setName("quantidade")
              .setDescription("Quantidade (1 a 100)")
              .setMinValue(1)
              .setMaxValue(100)
              .setRequired(true)
          )
      )
  );

  // ===== STORAGE =====
  cmds.push(
    new SlashCommandBuilder()
      .setName("storage")
      .setDescription("Ferramentas de storage / debug.")
      .addSubcommand(sc => sc.setName("ping").setDescription("Testa se o storage está OK."))
  );

  return cmds;
}

export async function registerGlobalCommands() {
  if (!TOKEN || !CLIENT_ID) throw new Error("Falta DISCORD_TOKEN ou DISCORD_CLIENT_ID.");

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  const body = buildSlashCommands().map(c => c.toJSON());
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body });
  console.log("✅ Slash commands globais registrados.");
}

export async function handleInteraction(interaction, ctx) {
  // Componentes (Buttons / Select Menus) — usado pelos jogos do cassino
  if (interaction.isButton() || interaction.isStringSelectMenu()) {
    if (typeof casino.handleComponent === "function") {
      return await casino.handleComponent(interaction, ctx);
    }
    return interaction.reply({ content: "❌ Cassino ainda não tem handler de botões.", ephemeral: true });
  }

  if (!interaction.isChatInputCommand()) return;

  const name = interaction.commandName;

  if (name === "ping") {
    return interaction.reply(`🏓 Pong! API: **${Math.round(ctx.client.ws.ping)}ms**`);
  }

  if (name === "ajuda") {
    return interaction.reply({
      content:
        "**Comandos:**\n" +
        "• `/ping`\n" +
        "• `/eco saldo | daily | pagar`\n" +
        "• `/cassino coinflip | blackjack | cockfight | truco`\n" +
        "• `/admin permissoes | limpar`\n" +
        "• `/storage ping`\n",
      ephemeral: true
    });
  }

  if (name === "eco" && typeof economy.handleEco === "function") return economy.handleEco(interaction, ctx);
  if (name === "cassino" && typeof casino.handleCasino === "function") return casino.handleCasino(interaction, ctx);
  if (name === "admin" && typeof admin.handleAdmin === "function") return admin.handleAdmin(interaction, ctx);
  if (name === "storage" && typeof storage.handleStorage === "function") return storage.handleStorage(interaction, ctx);

  return interaction.reply({ content: "Comando não reconhecido ou módulo não implementado ainda.", ephemeral: true });
}
