const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
} = require('discord.js');
const { discordTimestamp, toUnixSeconds } = require('../utils/time');
const { formatDurationMs } = require('../utils/duration');
const {
  formatOffsetKeys,
  offsetSelectOptions,
  normalizeOffsetKeys,
} = require('../utils/offsets');

function eventSetupPanel(draft) {
  const unix = toUnixSeconds(draft.startAtMs);
  const desc = draft.description
    ? draft.description.length > 120
      ? `${draft.description.slice(0, 120)}…`
      : draft.description
    : '_none_';

  const offsetKeys = normalizeOffsetKeys(draft.offsetKeys);

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(`ev:ch:${draft.id}`)
    .setPlaceholder('Channel for post & reminders')
    .setMinValues(1)
    .setMaxValues(1)
    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);
  if (draft.channelId) channelSelect.setDefaultChannels(draft.channelId);

  const channelRow = new ActionRowBuilder().addComponents(channelSelect);

  const roleRow = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`ev:role:${draft.id}`)
      .setPlaceholder('Ping role (optional) — clear = none')
      .setMinValues(0)
      .setMaxValues(1)
  );

  if (draft.pingRoleId) {
    roleRow.components[0].setDefaultRoles([draft.pingRoleId]);
  }

  const offsetRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`ev:off:${draft.id}`)
      .setPlaceholder('Reminder times (multi-select)')
      .setMinValues(1)
      .setMaxValues(5)
      .addOptions(offsetSelectOptions(offsetKeys))
  );

  const btnRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ev:go:${draft.id}`)
      .setLabel('Create event')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`ev:x:${draft.id}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  const channelLabel = draft.channelId ? `<#${draft.channelId}>` : '_pick a channel_';
  const roleLabel = draft.pingRoleId ? `<@&${draft.pingRoleId}>` : '_none_';

  return {
    content:
      `**Create event** — only you can see this.\n\n` +
      `**Title:** ${draft.title}\n` +
      `**Starts:** ${discordTimestamp(unix, 'F')} (${discordTimestamp(unix, 'R')})\n` +
      `**Description:** ${desc}\n` +
      `**Image:** ${draft.imageUrl || '_none_'}\n` +
      `**Channel:** ${channelLabel}\n` +
      `**Ping role:** ${roleLabel}\n` +
      `**Reminders:** ${formatOffsetKeys(offsetKeys)}\n\n` +
      `Use the **Reminders** dropdown to pick which countdowns to send (multi-select).`,
    components: [channelRow, roleRow, offsetRow, btnRow],
    flags: MessageFlags.Ephemeral,
  };
}

function eventConfigPanel(guildId, offsetKeys) {
  const keys = normalizeOffsetKeys(offsetKeys);
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ev:config:offsets')
      .setPlaceholder('Default reminder times for new events')
      .setMinValues(1)
      .setMaxValues(5)
      .addOptions(offsetSelectOptions(keys))
  );

  return {
    content:
      `**Event reminder defaults** for this server — only you see this.\n\n` +
      `New events will pre-select: **${formatOffsetKeys(keys)}**\n\n` +
      `Change the multi-select below to update server defaults. You can still change times per event when creating.`,
    components: [row],
    flags: MessageFlags.Ephemeral,
  };
}

function remindSetupPanel(draft) {
  const unix = toUnixSeconds(draft.fireAtMs);
  const whenText = draft.recurring
    ? `every **${formatDurationMs(draft.intervalMs)}** (first ${discordTimestamp(unix, 'R')})`
    : `${discordTimestamp(unix, 'F')} (${discordTimestamp(unix, 'R')})`;
  const preview =
    draft.message.length > 150 ? `${draft.message.slice(0, 150)}…` : draft.message;

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(`rm:ch:${draft.id}`)
    .setPlaceholder('Channel to post in')
    .setMinValues(1)
    .setMaxValues(1)
    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);
  if (draft.channelId) channelSelect.setDefaultChannels(draft.channelId);

  const channelRow = new ActionRowBuilder().addComponents(channelSelect);

  const roleRow = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`rm:role:${draft.id}`)
      .setPlaceholder('Ping role (optional)')
      .setMinValues(0)
      .setMaxValues(1)
  );

  if (draft.pingRoleId) {
    roleRow.components[0].setDefaultRoles([draft.pingRoleId]);
  }

  const btnRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rm:go:${draft.id}`)
      .setLabel('Set reminder')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`rm:x:${draft.id}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  const channelLabel = draft.channelId ? `<#${draft.channelId}>` : '_pick a channel_';
  const roleLabel = draft.pingRoleId ? `<@&${draft.pingRoleId}>` : '_none_';

  return {
    content:
      `**Set reminder** — only you can see this.\n\n` +
      `**Message:** ${preview}\n` +
      `**When:** ${whenText}\n` +
      `**Channel:** ${channelLabel}\n` +
      `**Ping role:** ${roleLabel}`,
    components: [channelRow, roleRow, btnRow],
    flags: MessageFlags.Ephemeral,
  };
}

/**
 * @param {Array<{id:string,title:string,startAt:number}>} events
 */
function eventCancelPanel(events) {
  const opts = events.slice(0, 25).map((e) => {
    const d = new Date(e.startAt).toISOString().slice(0, 16).replace('T', ' ');
    const label = e.title.length > 80 ? `${e.title.slice(0, 77)}…` : e.title;
    return {
      label,
      description: `${d} UTC · ${e.id}`.slice(0, 100),
      value: e.id,
    };
  });

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ev:cancel:pick')
      .setPlaceholder('Select an event to cancel')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(opts)
  );

  return {
    content: `**Cancel event** — pick one (${events.length} upcoming). Only you see this.`,
    components: [row],
    flags: MessageFlags.Ephemeral,
  };
}

/**
 * @param {Array<object>} reminders
 */
function remindCancelPanel(reminders) {
  const opts = reminders.slice(0, 25).map((r) => {
    const preview = r.message.length > 60 ? `${r.message.slice(0, 57)}…` : r.message;
    const kind = r.recurring ? `every ${r.intervalLabel}` : 'one-off';
    return {
      label: (preview || r.id).slice(0, 100),
      description: `${kind} · ${r.id}`.slice(0, 100),
      value: r.id,
    };
  });

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rm:cancel:pick')
      .setPlaceholder('Select a reminder to cancel')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(opts)
  );

  return {
    content: `**Cancel reminder** — pick one (${reminders.length} active). Only you see this.`,
    components: [row],
    flags: MessageFlags.Ephemeral,
  };
}

module.exports = {
  eventSetupPanel,
  eventConfigPanel,
  remindSetupPanel,
  eventCancelPanel,
  remindCancelPanel,
};
