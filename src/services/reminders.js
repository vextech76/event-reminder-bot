const store = require('./store');
const { channelRemindEmbed } = require('./embeds');
const { formatDurationMs } = require('../utils/duration');

/**
 * Create a one-off or recurring channel reminder.
 */
function createReminder({
  guildId,
  channelId,
  message,
  fireAtMs,
  recurring,
  intervalMs,
  targetMention,
  createdById,
  createdByTag,
}) {
  const now = Date.now();
  const reminder = {
    id: store.id(),
    guildId: String(guildId),
    channelId: String(channelId),
    message: String(message).slice(0, 2000),
    recurring: Boolean(recurring),
    intervalMs: recurring ? Number(intervalMs) : null,
    intervalLabel: recurring ? formatDurationMs(intervalMs) : null,
    targetMention: targetMention || null,
    createdById: createdById ? String(createdById) : null,
    createdByTag: createdByTag || null,
    status: 'active',
    createdAt: now,
    nextFireAt: Number(fireAtMs),
  };

  store.upsertReminder(reminder);

  store.addJobs([
    {
      id: store.id(),
      type: 'channel_remind',
      guildId: reminder.guildId,
      channelId: reminder.channelId,
      reminderId: reminder.id,
      fireAt: reminder.nextFireAt,
      sent: false,
      cancelled: false,
      createdAt: now,
    },
  ]);

  return reminder;
}

function cancelReminder(reminderId) {
  const reminder = store.getReminder(reminderId);
  if (!reminder) return { ok: false, error: 'Reminder not found.' };
  reminder.status = 'cancelled';
  store.upsertReminder(reminder);
  store.removeJobsByRef({ reminderId });
  return { ok: true, reminder };
}

function listReminders(guildId) {
  return store
    .loadReminders()
    .filter((r) => r.guildId === String(guildId) && r.status === 'active')
    .sort((a, b) => (a.nextFireAt || 0) - (b.nextFireAt || 0));
}

async function fireChannelRemind(client, job) {
  const reminder = store.getReminder(job.reminderId);
  if (!reminder || reminder.status === 'cancelled') {
    store.updateJob(job.id, { cancelled: true });
    return;
  }

  const channel = await client.channels.fetch(job.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    console.error(`[reminders] Cannot send ${job.reminderId}: bad channel`);
    store.updateJob(job.id, { error: 'channel_unavailable' });
    return;
  }

  const contentParts = [];
  if (reminder.targetMention) contentParts.push(reminder.targetMention);

  await channel.send({
    content: contentParts.length ? contentParts.join(' ') : undefined,
    embeds: [channelRemindEmbed(reminder)],
    allowedMentions: {
      parse: [],
      users: mentionIds(reminder.targetMention, 'user'),
      roles: mentionIds(reminder.targetMention, 'role'),
    },
  });

  store.updateJob(job.id, { sentAt: Date.now() });

  if (reminder.recurring && reminder.intervalMs) {
    const next = Date.now() + reminder.intervalMs;
    reminder.nextFireAt = next;
    store.upsertReminder(reminder);
    store.addJobs([
      {
        id: store.id(),
        type: 'channel_remind',
        guildId: reminder.guildId,
        channelId: reminder.channelId,
        reminderId: reminder.id,
        fireAt: next,
        sent: false,
        cancelled: false,
        createdAt: Date.now(),
      },
    ]);
  } else {
    reminder.status = 'completed';
    store.upsertReminder(reminder);
  }
}

function mentionIds(mention, kind) {
  if (!mention) return [];
  if (kind === 'user') {
    const m = mention.match(/^<@!?(\d+)>$/);
    return m ? [m[1]] : [];
  }
  const m = mention.match(/^<@&(\d+)>$/);
  return m ? [m[1]] : [];
}

module.exports = {
  createReminder,
  cancelReminder,
  listReminders,
  fireChannelRemind,
};
