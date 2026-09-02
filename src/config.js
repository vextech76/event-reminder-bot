const path = require('path');
require('dotenv').config();

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

function required(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value).trim();
}

const poll = Number.parseInt(process.env.POLL_INTERVAL_MS || '30000', 10);

const config = {
  token: required('DISCORD_TOKEN'),
  clientId: required('CLIENT_ID'),
  guildId: (process.env.GUILD_ID || '').trim() || null,
  defaultTimezone: (process.env.DEFAULT_TIMEZONE || 'America/New_York').trim(),
  dataDir: DATA_DIR,
  eventsPath: path.join(DATA_DIR, 'events.json'),
  remindersPath: path.join(DATA_DIR, 'reminders.json'),
  jobsPath: path.join(DATA_DIR, 'jobs.json'),
  guildSettingsPath: path.join(DATA_DIR, 'guild-settings.json'),
  pollIntervalMs: Number.isFinite(poll) && poll >= 5000 ? poll : 30000,
  /** Offsets before event start (ms). Month ≈ 30 days. */
  eventOffsets: [
    { key: '1_month', label: '1 month', ms: 30 * 24 * 60 * 60 * 1000 },
    { key: '1_week', label: '1 week', ms: 7 * 24 * 60 * 60 * 1000 },
    { key: '1_day', label: '1 day', ms: 24 * 60 * 60 * 1000 },
    { key: '1_hour', label: '1 hour', ms: 60 * 60 * 1000 },
    { key: 'now', label: 'starting now', ms: 0 },
  ],
};

module.exports = { config };
