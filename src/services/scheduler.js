const { config } = require('../config');
const store = require('./store');
const { fireEventReminder } = require('./events');
const { fireChannelRemind } = require('./reminders');

class Scheduler {
  /**
   * @param {import('discord.js').Client} client
   */
  constructor(client) {
    this.client = client;
    this.timer = null;
    this.tickInFlight = false;
  }

  start() {
    if (this.timer) return;
    console.log(`[scheduler] Polling every ${config.pollIntervalMs}ms`);
    this.timer = setInterval(() => this.tick(), config.pollIntervalMs);
    setImmediate(() => this.tick());
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick() {
    if (this.tickInFlight) return;
    this.tickInFlight = true;
    try {
      const due = store.getDueJobs().sort((a, b) => a.fireAt - b.fireAt);
      for (const job of due) {
        // Claim so concurrent ticks cannot double-send
        const claimed = store.updateJob(job.id, { sent: true, claimedAt: Date.now() });
        if (!claimed) continue;

        try {
          if (job.type === 'event_reminder') {
            await fireEventReminder(this.client, job);
          } else if (job.type === 'channel_remind') {
            await fireChannelRemind(this.client, job);
          } else {
            store.updateJob(job.id, { error: 'unknown_type' });
          }
        } catch (err) {
          console.error(`[scheduler] Job ${job.id} failed:`, err);
          store.updateJob(job.id, {
            error: err.message || String(err),
            failedAt: Date.now(),
          });
        }
      }
    } finally {
      this.tickInFlight = false;
    }
  }
}

module.exports = { Scheduler };
