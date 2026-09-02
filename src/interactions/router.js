const { MessageFlags } = require('discord.js');
const { config } = require('../config');
const { parseWhen, discordTimestamp, toUnixSeconds } = require('../utils/time');
const { formatDurationMs } = require('../utils/duration');
const { formatOffsetKeys, normalizeOffsetKeys } = require('../utils/offsets');
const drafts = require('../services/drafts');
const eventsService = require('../services/events');
const remindersService = require('../services/reminders');
const store = require('../services/store');
const {
  eventSetupPanel,
  eventConfigPanel,
  remindSetupPanel,
} = require('../ui/panels');

/**
 * Handle non-slash interactions (modals, selects, buttons).
 * @param {import('discord.js').Interaction} interaction
 * @param {import('discord.js').Client} client
 * @returns {Promise<boolean>} true if handled
 */
async function handleComponentInteraction(interaction, client) {
  if (interaction.isModalSubmit()) {
    return handleModal(interaction);
  }
  if (interaction.isChannelSelectMenu()) {
    return handleChannelSelect(interaction);
  }
  if (interaction.isRoleSelectMenu()) {
    return handleRoleSelect(interaction);
  }
  if (interaction.isStringSelectMenu()) {
    return handleStringSelect(interaction);
  }
  if (interaction.isButton()) {
    return handleButton(interaction, client);
  }
  return false;
}

async function handleModal(interaction) {
  const id = interaction.customId;

  if (id === 'ev:modal:create') {
    const title = interaction.fields.getTextInputValue('title').trim();
    const startRaw = interaction.fields.getTextInputValue('start').trim();
    const description = (interaction.fields.getTextInputValue('description') || '').trim() || null;
    const image = (interaction.fields.getTextInputValue('image') || '').trim() || null;

    const parsed = parseWhen(startRaw, {
      timezone: config.defaultTimezone,
      now: new Date(),
    });

    if (parsed.error) {
      await interaction.reply({
        content: `Could not parse start time: ${parsed.error}`,
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }
    if (parsed.recurring) {
      await interaction.reply({
        content:
          'Events need a single start time, not `every …`. Use `/remind set` for recurring pings.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const offsetKeys = eventsService.getGuildDefaultOffsetKeys(interaction.guildId);

    const draft = drafts.put({
      kind: 'event',
      userId: interaction.user.id,
      guildId: interaction.guildId,
      title,
      description,
      imageUrl: image,
      startAtMs: parsed.at.getTime(),
      channelId: interaction.channelId,
      pingRoleId: null,
      offsetKeys,
    });

    await interaction.reply(eventSetupPanel(draft));
    return true;
  }

  if (id === 'rm:modal:set') {
    const message = interaction.fields.getTextInputValue('message').trim();
    const whenRaw = interaction.fields.getTextInputValue('when').trim();

    const parsed = parseWhen(whenRaw, {
      timezone: config.defaultTimezone,
      now: new Date(),
    });

    if (parsed.error) {
      await interaction.reply({
        content: `Could not parse time: ${parsed.error}`,
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const fireAtMs = parsed.recurring
      ? parsed.firstAt.getTime()
      : parsed.at.getTime();

    const draft = drafts.put({
      kind: 'remind',
      userId: interaction.user.id,
      guildId: interaction.guildId,
      message,
      recurring: Boolean(parsed.recurring),
      intervalMs: parsed.recurring ? parsed.intervalMs : null,
      fireAtMs,
      channelId: interaction.channelId,
      pingRoleId: null,
    });

    await interaction.reply(remindSetupPanel(draft));
    return true;
  }

  return false;
}

function assertDraftOwner(interaction, draft) {
  if (!draft) {
    return { ok: false, error: 'This setup expired. Run the command again.' };
  }
  if (draft.userId !== interaction.user.id) {
    return { ok: false, error: 'Only the person who started this can use these controls.' };
  }
  if (draft.guildId !== interaction.guildId) {
    return { ok: false, error: 'Wrong server for this draft.' };
  }
  return { ok: true };
}

async function handleChannelSelect(interaction) {
  const m = interaction.customId.match(/^(ev|rm):ch:([a-z0-9]+)$/i);
  if (!m) return false;

  const draft = drafts.get(m[2]);
  const check = assertDraftOwner(interaction, draft);
  if (!check.ok) {
    await interaction.reply({ content: check.error, flags: MessageFlags.Ephemeral });
    return true;
  }

  const channelId = interaction.values[0];
  drafts.update(draft.id, { channelId });
  const updated = drafts.get(draft.id);
  const panel = draft.kind === 'event' ? eventSetupPanel(updated) : remindSetupPanel(updated);
  await interaction.update({
    content: panel.content,
    components: panel.components,
  });
  return true;
}

async function handleRoleSelect(interaction) {
  const m = interaction.customId.match(/^(ev|rm):role:([a-z0-9]+)$/i);
  if (!m) return false;

  const draft = drafts.get(m[2]);
  const check = assertDraftOwner(interaction, draft);
  if (!check.ok) {
    await interaction.reply({ content: check.error, flags: MessageFlags.Ephemeral });
    return true;
  }

  const pingRoleId = interaction.values[0] || null;
  drafts.update(draft.id, { pingRoleId });
  const updated = drafts.get(draft.id);
  const panel = draft.kind === 'event' ? eventSetupPanel(updated) : remindSetupPanel(updated);
  await interaction.update({
    content: panel.content,
    components: panel.components,
  });
  return true;
}

async function handleStringSelect(interaction) {
  // Per-event reminder offsets
  const offM = interaction.customId.match(/^ev:off:([a-z0-9]+)$/i);
  if (offM) {
    const draft = drafts.get(offM[1]);
    const check = assertDraftOwner(interaction, draft);
    if (!check.ok) {
      await interaction.reply({ content: check.error, flags: MessageFlags.Ephemeral });
      return true;
    }
    const offsetKeys = normalizeOffsetKeys(interaction.values);
    drafts.update(draft.id, { offsetKeys });
    const updated = drafts.get(draft.id);
    const panel = eventSetupPanel(updated);
    await interaction.update({
      content: panel.content,
      components: panel.components,
    });
    return true;
  }

  // Server default reminder offsets
  if (interaction.customId === 'ev:config:offsets') {
    if (!interaction.memberPermissions?.has('ManageGuild')) {
      await interaction.reply({
        content: 'You need **Manage Server** to change defaults.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }
    const keys = eventsService.setGuildDefaultOffsetKeys(
      interaction.guildId,
      interaction.values
    );
    const panel = eventConfigPanel(interaction.guildId, keys);
    await interaction.update({
      content:
        panel.content +
        `\n\n✅ Saved. New events will pre-select: **${formatOffsetKeys(keys)}**`,
      components: panel.components,
    });
    return true;
  }

  if (interaction.customId === 'ev:cancel:pick') {
    const eventId = interaction.values[0];
    const ev = store.getEvent(eventId);
    if (!ev || ev.guildId !== interaction.guildId) {
      await interaction.update({
        content: 'Event not found in this server.',
        components: [],
      });
      return true;
    }
    const result = eventsService.cancelEvent(eventId);
    if (!result.ok) {
      await interaction.update({ content: result.error, components: [] });
      return true;
    }
    await interaction.update({
      content: `Cancelled **${result.event.title}** (\`${result.event.id}\`). Pending reminders removed.`,
      components: [],
    });
    return true;
  }

  if (interaction.customId === 'rm:cancel:pick') {
    const reminderId = interaction.values[0];
    const existing = store.getReminder(reminderId);
    if (!existing || existing.guildId !== interaction.guildId) {
      await interaction.update({
        content: 'Reminder not found in this server.',
        components: [],
      });
      return true;
    }
    const result = remindersService.cancelReminder(reminderId);
    if (!result.ok) {
      await interaction.update({ content: result.error, components: [] });
      return true;
    }
    await interaction.update({
      content: `Cancelled reminder \`${result.reminder.id}\`.`,
      components: [],
    });
    return true;
  }

  return false;
}

async function handleButton(interaction, client) {
  const cancelM = interaction.customId.match(/^(ev|rm):x:([a-z0-9]+)$/i);
  if (cancelM) {
    const draft = drafts.get(cancelM[2]);
    if (draft && draft.userId !== interaction.user.id) {
      await interaction.reply({
        content: 'Only the person who started this can cancel it.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }
    if (draft) drafts.remove(draft.id);
    await interaction.update({
      content: 'Cancelled. Nothing was created.',
      components: [],
    });
    return true;
  }

  const goM = interaction.customId.match(/^(ev|rm):go:([a-z0-9]+)$/i);
  if (!goM) return false;

  const kind = goM[1];
  const draft = drafts.get(goM[2]);
  const check = assertDraftOwner(interaction, draft);
  if (!check.ok) {
    await interaction.reply({ content: check.error, flags: MessageFlags.Ephemeral });
    return true;
  }

  if (!draft.channelId) {
    await interaction.reply({
      content: 'Pick a channel first (dropdown above).',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (kind === 'ev' && draft.kind === 'event') {
    const keys = normalizeOffsetKeys(draft.offsetKeys);
    if (!keys.length) {
      await interaction.reply({
        content: 'Pick at least one reminder time in the Reminders dropdown.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }
  }

  await interaction.deferUpdate();

  try {
    if (kind === 'ev' && draft.kind === 'event') {
      const { event, scheduledCount } = await eventsService.createEvent(client, {
        guildId: draft.guildId,
        channelId: draft.channelId,
        title: draft.title,
        description: draft.description,
        startAtMs: draft.startAtMs,
        pingRoleId: draft.pingRoleId,
        imageUrl: draft.imageUrl,
        createdById: interaction.user.id,
        createdByTag: interaction.user.tag,
        offsetKeys: draft.offsetKeys,
      });
      drafts.remove(draft.id);
      const unix = toUnixSeconds(event.startAt);
      await interaction.editReply({
        content:
          `Event **${event.title}** created in <#${draft.channelId}>.\n` +
          `Starts ${discordTimestamp(unix, 'F')} (${discordTimestamp(unix, 'R')}).\n` +
          `Reminders: **${formatOffsetKeys(event.offsetKeys)}**\n` +
          `Scheduled **${scheduledCount}** job(s) (past offsets skipped).\n` +
          `ID: \`${event.id}\``,
        components: [],
      });
      return true;
    }

    if (kind === 'rm' && draft.kind === 'remind') {
      const targetMention = draft.pingRoleId ? `<@&${draft.pingRoleId}>` : null;
      const reminder = remindersService.createReminder({
        guildId: draft.guildId,
        channelId: draft.channelId,
        message: draft.message,
        fireAtMs: draft.fireAtMs,
        recurring: draft.recurring,
        intervalMs: draft.intervalMs,
        targetMention,
        createdById: interaction.user.id,
        createdByTag: interaction.user.tag,
      });
      drafts.remove(draft.id);
      const unix = toUnixSeconds(draft.fireAtMs);
      const whenText = draft.recurring
        ? `every **${formatDurationMs(draft.intervalMs)}** (first ${discordTimestamp(unix, 'R')})`
        : `${discordTimestamp(unix, 'F')} (${discordTimestamp(unix, 'R')})`;
      await interaction.editReply({
        content:
          `Reminder set in <#${draft.channelId}>.\n` +
          `When: ${whenText}\n` +
          `ID: \`${reminder.id}\``,
        components: [],
      });
      return true;
    }

    await interaction.editReply({
      content: 'Unknown draft type. Run the command again.',
      components: [],
    });
  } catch (err) {
    console.error('[confirm]', err);
    await interaction.editReply({
      content: `Failed: ${err.message || err}`,
      components: [],
    });
  }
  return true;
}

module.exports = { handleComponentInteraction };
