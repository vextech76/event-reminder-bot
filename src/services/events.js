const store = require('./store');
const { eventCreatedEmbed, eventReminderEmbed } = require('./embeds');
const {
  normalizeOffsetKeys,
  resolveOffsets,
  defaultOffsetKeys,
} = require('../utils/offsets');

/**
 * Create a guild event, post announcement, schedule countdown jobs.
 * @param {object} opts
 * @param {string[]} [opts.offsetKeys] - subset of event offset keys to schedule
 */
async function createEvent(client, {
  guildId,
  channelId,
  title,
  description,
  startAtMs,
  pingRoleId,
  imageUrl,
  createdById,
  createdByTag,
  offsetKeys,
}) {
  const keys = normalizeOffsetKeys(offsetKeys);

  const event = {
    id: store.id(),
    guildId: String(guildId),
    channelId: String(channelId),
    title: String(title).slice(0, 256),
    description: description ? String(description).slice(0, 2000) : null,
    startAt: Number(startAtMs),
    pingRoleId: pingRoleId ? String(pingRoleId) : null,
    imageUrl: imageUrl || null,
    createdById: createdById ? String(createdById) : null,
    createdByTag: createdByTag || null,
    offsetKeys: keys,
    status: 'scheduled',
    createdAt: Date.now(),
  };

  store.upsertEvent(event);

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    store.removeEvent(event.id);
    throw new Error('Could not post to that channel (missing or not text-based).');
  }

  const content = event.pingRoleId ? `<@&${event.pingRoleId}>` : undefined;
  const announce = await channel.send({
    content,
    embeds: [eventCreatedEmbed(event)],
    allowedMentions: event.pingRoleId
      ? { roles: [event.pingRoleId] }
      : { parse: [] },
  });

  event.announceMessageId = announce.id;
  store.upsertEvent(event);

  const now = Date.now();
  const jobs = [];
  for (const offset of resolveOffsets(keys)) {
    const fireAt = event.startAt - offset.ms;
    if (offset.ms > 0 && fireAt <= now) continue;
    if (offset.ms === 0 && event.startAt < now) continue;

    jobs.push({
      id: store.id(),
      type: 'event_reminder',
      guildId: event.guildId,
      channelId: event.channelId,
      eventId: event.id,
      offsetKey: offset.key,
      offsetLabel: offset.label,
      fireAt,
      sent: false,
      cancelled: false,
      createdAt: now,
    });
  }

  store.addJobs(jobs);
  return { event, scheduledCount: jobs.length, announce };
}

async function cancelEvent(eventId) {
  const event = store.getEvent(eventId);
  if (!event) return { ok: false, error: 'Event not found.' };
  event.status = 'cancelled';
  store.upsertEvent(event);
  store.removeJobsByRef({ eventId });
  return { ok: true, event };
}

function listEvents(guildId, { includePast = false } = {}) {
  const now = Date.now();
  return store
    .loadEvents()
    .filter((e) => e.guildId === String(guildId))
    .filter((e) => e.status !== 'cancelled')
    .filter((e) => includePast || e.startAt >= now - 60_000)
    .sort((a, b) => a.startAt - b.startAt);
}

/**
 * Default reminder offsets for new events in this guild.
 */
function getGuildDefaultOffsetKeys(guildId) {
  const settings = store.getGuildSettings(guildId);
  if (settings.eventOffsetKeys) {
    return normalizeOffsetKeys(settings.eventOffsetKeys);
  }
  return defaultOffsetKeys();
}

function setGuildDefaultOffsetKeys(guildId, keys) {
  const normalized = normalizeOffsetKeys(keys);
  store.setGuildSettings(guildId, { eventOffsetKeys: normalized });
  return normalized;
}

async function fireEventReminder(client, job) {
  const event = store.getEvent(job.eventId);
  if (!event || event.status === 'cancelled') {
    store.updateJob(job.id, { cancelled: true });
    return;
  }

  const channel = await client.channels.fetch(job.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    console.error(`[events] Cannot send reminder for ${job.eventId}: bad channel`);
    store.updateJob(job.id, { error: 'channel_unavailable' });
    return;
  }

  const content = event.pingRoleId ? `<@&${event.pingRoleId}>` : undefined;
  await channel.send({
    content,
    embeds: [eventReminderEmbed(event, job.offsetLabel)],
    allowedMentions: event.pingRoleId
      ? { roles: [event.pingRoleId] }
      : { parse: [] },
  });

  store.updateJob(job.id, { sentAt: Date.now() });

  if (job.offsetKey === 'now') {
    event.status = 'completed';
    store.upsertEvent(event);
  }
}

module.exports = {
  createEvent,
  cancelEvent,
  listEvents,
  fireEventReminder,
  getGuildDefaultOffsetKeys,
  setGuildDefaultOffsetKeys,
};
