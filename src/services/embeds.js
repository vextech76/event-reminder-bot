const { EmbedBuilder } = require('discord.js');
const { discordTimestamp, toUnixSeconds } = require('../utils/time');
const { formatOffsetKeys } = require('../utils/offsets');

const COLOR_EVENT = 0x5865f2;
const COLOR_REMIND = 0x57f287;
const COLOR_URGENT = 0xfee75c;
const COLOR_NOW = 0xed4245;

function eventCreatedEmbed(event) {
  const unix = toUnixSeconds(event.startAt);
  const reminders =
    formatOffsetKeys(event.offsetKeys) +
    '\n*(offsets already past at create time are skipped)*';

  const embed = new EmbedBuilder()
    .setColor(COLOR_EVENT)
    .setTitle(event.title)
    .setDescription(event.description || null)
    .addFields(
      {
        name: 'Starts',
        value: `${discordTimestamp(unix, 'F')} (${discordTimestamp(unix, 'R')})`,
        inline: false,
      },
      {
        name: 'Reminders',
        value: reminders,
        inline: false,
      },
      {
        name: 'Event ID',
        value: `\`${event.id}\``,
        inline: true,
      }
    )
    .setTimestamp(new Date(event.startAt));

  if (event.imageUrl) embed.setImage(event.imageUrl);
  if (event.createdByTag) embed.setFooter({ text: `Created by ${event.createdByTag}` });
  return embed;
}

function eventReminderEmbed(event, offsetLabel) {
  const unix = toUnixSeconds(event.startAt);
  const isNow = offsetLabel === 'starting now';
  const color = isNow ? COLOR_NOW : offsetLabel === '1 hour' ? COLOR_URGENT : COLOR_EVENT;

  const titlePrefix = isNow ? 'Starting now' : `Starts in ${offsetLabel}`;
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${titlePrefix}: ${event.title}`)
    .setDescription(event.description || null)
    .addFields({
      name: 'When',
      value: `${discordTimestamp(unix, 'F')} (${discordTimestamp(unix, 'R')})`,
      inline: false,
    })
    .setTimestamp(new Date(event.startAt));

  if (event.imageUrl) embed.setThumbnail(event.imageUrl);
  return embed;
}

function channelRemindEmbed(reminder) {
  const embed = new EmbedBuilder()
    .setColor(COLOR_REMIND)
    .setDescription(reminder.message)
    .setFooter({
      text: reminder.recurring
        ? `Recurring every ${reminder.intervalLabel || 'interval'} · id ${reminder.id}`
        : `One-off · id ${reminder.id}`,
    })
    .setTimestamp(new Date());
  return embed;
}

module.exports = {
  eventCreatedEmbed,
  eventReminderEmbed,
  channelRemindEmbed,
};
