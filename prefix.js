import { narrar } from "./openrouter.js";
import { safe1900 } from "./utils.js";

export async function handlePrefix(message) {
  if (message.author.bot) return;

  if (message.content.startsWith("!narrar ")) {
    const texto = message.content.slice("!narrar ".length).trim();
    if (!texto) return;

    await message.channel.send("🧠 Pensando...");
    const result = await narrar(texto);
    await message.channel.send(safe1900(result.text));
  }
}
