import { Client, GatewayIntentBits } from "discord.js";
import http from "http";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => {
  console.log(`Conectado como ${client.user.tag}`);
});

client.on("messageCreate", msg => {
  if (msg.author.bot) return;

  if (msg.mentions.has(client.user)) {
    msg.reply("Estou observando tudo 👁️");
  }
});

// 🔹 SERVIDOR HTTP (OBRIGATÓRIO NO AZURE LINUX)
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Bot online");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor HTTP ativo na porta ${PORT}`);
});

// 🔹 LOGIN DO DISCORD
client.login(process.env.DISCORD_TOKEN);
