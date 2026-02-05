export async function handleCasino(interaction, ctx) {
  const sub = interaction.options.getSubcommand();

  if (sub === "blackjack") {
    return interaction.reply({ content: "🃏 Blackjack ainda vai ser implementado (botões).", ephemeral: true });
  }

  if (sub === "caraoucoroa") {
    const lado = interaction.options.getString("lado", true);
    const valor = interaction.options.getString("valor", true);
    return interaction.reply({ content: `🪙 Cara ou coroa (${lado}) apostando ${valor} — em breve.`, ephemeral: true });
  }

  return interaction.reply({ content: "Subcomando não implementado ainda.", ephemeral: true });
}

export async function handleComponent(interaction, ctx) {
  // Por enquanto, nada.
  if (interaction.isRepliable()) {
    return interaction.reply({ content: "Componente ainda não implementado.", ephemeral: true });
  }
}
