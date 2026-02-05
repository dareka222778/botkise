export async function handleEco(interaction, ctx) {
  const sub = interaction.options.getSubcommand();

  if (sub === "saldo") {
    return interaction.reply({ content: `💰 Seu saldo: **${ctx.defaults.economy.currencySymbol} 0**`, ephemeral: true });
  }

  if (sub === "daily") {
    return interaction.reply({ content: `✅ Daily resgatado: **${ctx.defaults.economy.currencySymbol} ${ctx.defaults.economy.daily.amount}**`, ephemeral: true });
  }

  return interaction.reply({ content: "Subcomando não implementado ainda.", ephemeral: true });
}
