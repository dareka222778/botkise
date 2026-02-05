import { Client, GatewayIntentBits } from "discord.js";
import http from "http";

import { makeContext } from "./context.js";
import * as storage from "./storage.js";
import * as openrouter from "./openrouter.js";

import * as slash from "./slash.js";
import * as prefix from "./prefix.js";

import * as embeds from "./embeds.js";
import * as cooldown from "./cooldown.js";

const TOKEN = process.env.DISCORD_TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Keep-alive (Azure)
const PORT = Number(process.env.PORT || 3000);
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("ok");
}).listen(PORT, "0.0.0.0", () => console.log("HTTP ativo na porta", PORT));

// Boot
const db = await storage.initStorage();
const ctx = makeContext({ client, storage: db, embeds, cooldown, openrouter });

client.once("ready", async () => {
  console.log(`🤖 Conectado como ${client.user.tag}`);

  try {
    await slash.registerGlobalCommands();
  } catch (e) {
    console.error("❌ Falha registrando slash:", e);
  }
});

// Slash commands + Buttons/Select menus
client.on("interactionCreate", async (interaction) => {
  try {
    await slash.handleInteraction(interaction, ctx);
  } catch (e) {
    console.error("interaction error:", e);
    if (interaction.isRepliable()) {
      const msg = "❌ Erro ao executar.";
      if (interaction.deferred || interaction.replied) await interaction.editReply(msg);
      else await interaction.reply({ content: msg, ephemeral: true });
    }
  }
});

// Prefix commands (!narrar etc)
client.on("messageCreate", async (message) => {
  try {
    await prefix.handleMessage(message, ctx);
  } catch (e) {
    console.error("message error:", e);
  }
});

if (!TOKEN) {
  console.error("Sem DISCORD_TOKEN.");
} else {
  client.login(TOKEN);
}
