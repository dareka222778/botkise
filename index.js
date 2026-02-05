import { Client, GatewayIntentBits } from "discord.js";
import http from "http";
import { setSafetyLogs } from "./utils.js";
import { registerGlobalCommands, handleSlash } from "./slash.js";
import { handlePrefix } from "./prefix.js";

setSafetyLogs();

// ENV
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

if (!TOKEN) console.error("Falta DISCORD_TOKEN nas variáveis.");
if (!CLIENT_ID) console.error("Falta DISCORD_CLIENT_ID nas variáveis.");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Keep-alive HTTP (Azure)
const PORT = Number(process.env.PORT || 3000);
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("ok");
}).listen(PORT, "0.0.0.0", () => console.log("HTTP ativo na porta", PORT));

// Ready
client.once("ready", async () => {
  console.log(`🤖 Conectado como ${client.user.tag}`);
  try {
    await registerGlobalCommands({ token: TOKEN, clientId: CLIENT_ID });
  } catch (e) {
    console.error("❌ Falha registrando comandos globais:", e);
  }
});

// Slash commands
client.on("interactionCreate", async (interaction) => {
  try {
    await handleSlash(interaction, client);
  } catch (e) {
    console.error("Erro slash:", e);
    const msg = `❌ ${String(e?.message || e)}`.slice(0, 1900);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(msg);
    } else {
      await interaction.reply({ content: msg, ephemeral: true });
    }
  }
});

// Prefix commands
client.on("messageCreate", async (message) => {
  try {
    await handlePrefix(message);
  } catch (e) {
    console.error("Erro prefix:", e);
  }
});

if (TOKEN) client.login(TOKEN);
