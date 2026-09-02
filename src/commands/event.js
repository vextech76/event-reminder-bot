const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { discordTimestamp, toUnixSeconds } = require('../utils/time');
const { formatOffsetKeys } = require('../utils/offsets');
const eventsService = require('../services/events');
const { eventCreateModal } = require('../ui/modals');
const { eventCancelPanel, eventConfigPanel } = require('../ui/panels');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Create events with automatic countdown reminders')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create an event (modal + channel / role / reminder dropdowns)')
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List upcoming events (ephemeral)')
    )
    .addSubcommand((sub) =>
      sub
        .setName('cancel')
        .setDescription('Cancel an event via dropdown (ephemeral)')
    )
    .addSubcommand((sub) =>
      sub
        .setName('config')
        .setDescription('Set default reminder times for new events (ephemeral)')
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      await interaction.showModal(eventCreateModal());
      return;
    }

    if (sub === 'list') {
      const list = eventsService.listEvents(interaction.guildId);
      if (!list.length) {
        await interaction.reply({
          content: 'No upcoming events.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const lines = list.slice(0, 20).map((e) => {
        const unix = toUnixSeconds(e.startAt);
        const rem = e.offsetKeys ? ` · ${formatOffsetKeys(e.offsetKeys)}` : '';
        return `• \`${e.id}\` **${e.title}** — ${discordTimestamp(unix, 'f')} (${discordTimestamp(unix, 'R')}) → <#${e.channelId}>${rem}`;
      });

      await interaction.reply({
        content: `**Upcoming events** (${list.length})\n${lines.join('\n')}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'cancel') {
      const list = eventsService.listEvents(interaction.guildId);
      if (!list.length) {
        await interaction.reply({
          content: 'No upcoming events to cancel.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply(eventCancelPanel(list));
      return;
    }

    if (sub === 'config') {
      const keys = eventsService.getGuildDefaultOffsetKeys(interaction.guildId);
      await interaction.reply(eventConfigPanel(interaction.guildId, keys));
    }
  },
};
