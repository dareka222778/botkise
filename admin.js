import { PermissionsBitField, ChannelType } from "discord.js";

function requireUserPerm(interaction, perm, msg) {
  const memberPerms = interaction.memberPermissions;
  if (!memberPerms || !memberPerms.has(perm)) {
    interaction.reply({ content: msg, ephemeral: true });
    return false;
  }
  return true;
}

function requireBotPerm(interaction, perm, msg) {
  const me = interaction.guild?.members?.me;
  const botPerms = interaction.channel?.permissionsFor(me);
  if (!botPerms || !botPerms.has(perm)) {
    interaction.reply({ content: msg, ephemeral: true });
    return false;
  }
  return true;
}

export async function handleAdmin(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "permissao") {
    const me = interaction.guild?.members?.me;
    const perms = interaction.channel?.permissionsFor(me);
    if (!perms) return interaction.reply({ content: "Não consegui ler permissões aqui.", ephemeral: true });

    return interaction.reply({
      content:
        `🔐 **Permissões do bot neste canal:**\n` +
        `• Enviar mensagens: ${perms.has(PermissionsBitField.Flags.SendMessages) ? "✅" : "❌"}\n` +
        `• Gerenciar mensagens: ${perms.has(PermissionsBitField.Flags.ManageMessages) ? "✅" : "❌"}\n` +
        `• Gerenciar canal: ${perms.has(PermissionsBitField.Flags.ManageChannels) ? "✅" : "❌"}\n` +
        `• Ler histórico: ${perms.has(PermissionsBitField.Flags.ReadMessageHistory) ? "✅" : "❌"}\n`,
      ephemeral: true
    });
  }

  if (sub === "limpar") {
    if (!requireUserPerm(interaction, PermissionsBitField.Flags.ManageMessages, "❌ Você precisa de **Gerenciar Mensagens**.")) return;
    if (!requireBotPerm(interaction, PermissionsBitField.Flags.ManageMessages, "❌ Eu preciso de **Gerenciar Mensagens**.")) return;

    const qtd = interaction.options.getInteger("quantidade", true);
    await interaction.deferReply({ ephemeral: true });

    const fetched = await interaction.channel.messages.fetch({ limit: qtd });
    const deletable = fetched.filter(m => !m.pinned);
    const deleted = await interaction.channel.bulkDelete(deletable, true);

    return interaction.editReply(`🧹 Apaguei **${deleted.size}** mensagens (ignorando fixadas/antigas).`);
  }

  if (sub === "say") {
    if (!requireUserPerm(interaction, PermissionsBitField.Flags.ManageGuild, "❌ Você precisa de **Gerenciar Servidor**.")) return;
    if (!requireBotPerm(interaction, PermissionsBitField.Flags.SendMessages, "❌ Eu não tenho permissão para enviar mensagens aqui.")) return;

    const texto = interaction.options.getString("texto", true);
    await interaction.reply({ content: "✅ Enviado.", ephemeral: true });
    await interaction.channel.send(texto);
    return;
  }

  if (sub === "lock" || sub === "unlock") {
    if (!requireUserPerm(interaction, PermissionsBitField.Flags.ManageChannels, "❌ Você precisa de **Gerenciar Canais**.")) return;
    if (!requireBotPerm(interaction, PermissionsBitField.Flags.ManageChannels, "❌ Eu preciso de **Gerenciar Canais**.")) return;

    if (interaction.channel.type !== ChannelType.GuildText) {
      return interaction.reply({ content: "❌ Esse comando só funciona em canal de texto.", ephemeral: true });
    }

    const allow = sub === "unlock";
    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: allow });

    return interaction.reply({
      content: allow ? "🔓 Canal destravado para @everyone." : "🔒 Canal travado para @everyone.",
      ephemeral: true
    });
  }

  return interaction.reply({ content: "Subcomando não reconhecido.", ephemeral: true });
}

export async function handleAdmin(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "say") {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ content: "❌ Precisa de **Gerenciar Servidor**.", ephemeral: true });
    }
    const texto = interaction.options.getString("texto", true);
    await interaction.reply({ content: "✅ Enviado.", ephemeral: true });
    return interaction.channel.send(texto);
  }

  if (sub === "limpar") {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({ content: "❌ Precisa de **Gerenciar Mensagens**.", ephemeral: true });
    }
    const qtd = interaction.options.getInteger("qtd", true);
    await interaction.deferReply({ ephemeral: true });
    const fetched = await interaction.channel.messages.fetch({ limit: qtd });
    const deleted = await interaction.channel.bulkDelete(fetched, true);
    return interaction.editReply(`🧹 Apaguei **${deleted.size}** mensagens.`);
  }

  return interaction.reply({ content: "Subcomando não implementado.", ephemeral: true });
}
