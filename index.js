import { Client, GatewayIntentBits } from "discord.js";
import http from "http";

console.log("Iniciando processo...");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => {
  console.log(`Discord conectado como ${client.user.tag}`);
});

client.on("messageCreate", (msg) => {
  if (msg.author.bot) return;
  if (msg.mentions.has(client.user)) msg.reply("Online 👁️");
});

const PORT = Number(process.env.PORT || 3000);
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("ok");
}).listen(PORT, "0.0.0.0", () => {
  console.log("HTTP ativo na porta", PORT);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error("Falha no login Discord:", err);
});
