function safe1900(t) {
  const s = String(t ?? "");
  return s.length > 1900 ? s.slice(0, 1900) + "…" : s;
}

export async function handleMessage(message, ctx) {
  if (message.author.bot) return;

  const prefix = "!";
  if (!message.content.startsWith(prefix)) return;

  const [cmd, ...rest] = message.content.slice(prefix.length).trim().split(/\s+/);
  const text = rest.join(" ").trim();

  if (cmd === "narrar") {
    if (!text) return message.reply("Use: `!narrar <texto>`");

    await message.channel.send("🧠 Pensando...");

    const result = await ctx.openrouter.chat({
      system: "Você é um narrador de RPG para Discord. Responda em PT-BR, com descrição imersiva e direta.",
      user: text,
      temperature: 0.8,
      max_tokens: 450
    });

    if (!result.ok) {
      console.error("OpenRouter fail:", result.error);
      return message.channel.send(result.content);
    }

    return message.channel.send(safe1900(result.content));
  }
}
