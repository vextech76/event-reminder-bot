const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { discordTimestamp, toUnixSeconds } = require('../utils/time');
const remindersService = require('../services/reminders');
const { remindSetModal } = require('../ui/modals');
const { remindCancelPanel } = require('../ui/panels');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('One-off or recurring channel reminders')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Open a form to set a reminder (modal + channel/role dropdowns)')
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List active reminders (ephemeral)')
    )
    .addSubcommand((sub) =>
      sub
        .setName('cancel')
        .setDescription('Cancel a reminder via dropdown (ephemeral)')
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'set') {
      await interaction.showModal(remindSetModal());
      return;
    }

    if (sub === 'list') {
      const list = remindersService.listReminders(interaction.guildId);
      if (!list.length) {
        await interaction.reply({
          content: 'No active reminders.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const lines = list.slice(0, 25).map((r) => {
        const unix = toUnixSeconds(r.nextFireAt);
        const kind = r.recurring ? `every ${r.intervalLabel}` : 'one-off';
        const preview = r.message.length > 40 ? `${r.message.slice(0, 40)}…` : r.message;
        return `• \`${r.id}\` (${kind}) next ${discordTimestamp(unix, 'R')} → <#${r.channelId}> — ${preview}`;
      });

      await interaction.reply({
        content: `**Active reminders** (${list.length})\n${lines.join('\n')}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'cancel') {
      const list = remindersService.listReminders(interaction.guildId);
      if (!list.length) {
        await interaction.reply({
          content: 'No active reminders to cancel.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply(remindCancelPanel(list));
    }
  },
};
