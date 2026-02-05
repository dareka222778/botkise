export async function initStorage() {
  // depois a gente troca por JSON/SQLite/QuickDB.
  const mem = new Map();
  return {
    mem,
    async save() { /* noop */ },
    info() { return { backend: "memory", keys: mem.size }; }
  };
}

export async function handleStorage(interaction, ctx) {
  const sub = interaction.options.getSubcommand();

  if (sub === "info") {
    const i = ctx.storage.info?.() ?? { backend: "?", keys: "?" };
    return interaction.reply({ content: `🗄️ DB: **${i.backend}** | keys: **${i.keys}**`, ephemeral: true });
  }

  if (sub === "save") {
    await ctx.storage.save?.();
    return interaction.reply({ content: "✅ Save executado.", ephemeral: true });
  }

  return interaction.reply({ content: "Subcomando não implementado.", ephemeral: true });
}
