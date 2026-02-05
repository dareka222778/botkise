export function formatUptime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}

export function safe1900(text) {
  const t = String(text ?? "");
  return t.length > 1900 ? t.slice(0, 1900) + "…" : t;
}

export function setSafetyLogs() {
  process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));
  process.on("uncaughtException", (e) => console.error("uncaughtException:", e));
}

import { SlashCommandBuilder } from "discord.js";

export function buildSlashCommands() {
  return [
    new SlashCommandBuilder().setName("ping").setDescription("Teste de latência."),
    new SlashCommandBuilder().setName("ajuda").setDescription("Mostra comandos."),

    new SlashCommandBuilder()
      .setName("eco")
      .setDescription("Economia")
      .addSubcommand(sc => sc.setName("saldo").setDescription("Ver saldo"))
      .addSubcommand(sc => sc.setName("daily").setDescription("Resgatar daily")),

    new SlashCommandBuilder()
      .setName("cassino")
      .setDescription("Cassino")
      .addSubcommand(sc => sc.setName("blackjack").setDescription("Jogar blackjack")
        .addStringOption(o => o.setName("valor").setDescription("Ex: 100, 1k").setRequired(true)))
      .addSubcommand(sc => sc.setName("caraoucoroa").setDescription("Cara ou coroa")
        .addStringOption(o => o.setName("lado").setRequired(true).addChoices(
          { name: "cara", value: "cara" },
          { name: "coroa", value: "coroa" }
        ))
        .addStringOption(o => o.setName("valor").setDescription("Ex: 100, 1k").setRequired(true))),

    new SlashCommandBuilder()
      .setName("admin")
      .setDescription("Admin")
      .addSubcommand(sc => sc.setName("say").setDescription("Bot fala")
        .addStringOption(o => o.setName("texto").setRequired(true)))
      .addSubcommand(sc => sc.setName("limpar").setDescription("Apagar mensagens")
        .addIntegerOption(o => o.setName("qtd").setRequired(true).setMinValue(1).setMaxValue(100))),

    new SlashCommandBuilder()
      .setName("storage")
      .setDescription("Storage")
      .addSubcommand(sc => sc.setName("info").setDescription("Info do DB"))
      .addSubcommand(sc => sc.setName("save").setDescription("Salvar agora")),
  ];
}
