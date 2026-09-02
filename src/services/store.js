const fs = require('fs');
const path = require('path');
const { config } = require('../config');

function ensureDataDir() {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[store] Failed to read ${filePath}:`, err.message);
    return fallback;
  }
}

function writeJson(filePath, data) {
  ensureDataDir();
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function id() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Events ──────────────────────────────────────────────

function loadEvents() {
  const data = readJson(config.eventsPath, []);
  return Array.isArray(data) ? data : [];
}

function saveEvents(events) {
  writeJson(config.eventsPath, events);
}

function getEvent(eventId) {
  return loadEvents().find((e) => e.id === eventId) || null;
}

function upsertEvent(event) {
  const events = loadEvents();
  const idx = events.findIndex((e) => e.id === event.id);
  if (idx >= 0) events[idx] = event;
  else events.push(event);
  saveEvents(events);
  return event;
}

function removeEvent(eventId) {
  const events = loadEvents().filter((e) => e.id !== eventId);
  saveEvents(events);
}

// ── Reminders ───────────────────────────────────────────

function loadReminders() {
  const data = readJson(config.remindersPath, []);
  return Array.isArray(data) ? data : [];
}

function saveReminders(reminders) {
  writeJson(config.remindersPath, reminders);
}

function getReminder(reminderId) {
  return loadReminders().find((r) => r.id === reminderId) || null;
}

function upsertReminder(reminder) {
  const list = loadReminders();
  const idx = list.findIndex((r) => r.id === reminder.id);
  if (idx >= 0) list[idx] = reminder;
  else list.push(reminder);
  saveReminders(list);
  return reminder;
}

function removeReminder(reminderId) {
  saveReminders(loadReminders().filter((r) => r.id !== reminderId));
}

// ── Jobs ────────────────────────────────────────────────

function loadJobs() {
  const data = readJson(config.jobsPath, []);
  return Array.isArray(data) ? data : [];
}

function saveJobs(jobs) {
  writeJson(config.jobsPath, jobs);
}

function addJobs(newJobs) {
  const jobs = loadJobs();
  jobs.push(...newJobs);
  saveJobs(jobs);
  return newJobs;
}

function updateJob(jobId, patch) {
  const jobs = loadJobs();
  const idx = jobs.findIndex((j) => j.id === jobId);
  if (idx < 0) return null;
  jobs[idx] = { ...jobs[idx], ...patch };
  saveJobs(jobs);
  return jobs[idx];
}

function removeJobsByRef({ eventId, reminderId }) {
  const jobs = loadJobs().filter((j) => {
    if (eventId && j.eventId === eventId) return false;
    if (reminderId && j.reminderId === reminderId) return false;
    return true;
  });
  saveJobs(jobs);
}

function getDueJobs(nowMs = Date.now()) {
  return loadJobs().filter((j) => !j.sent && !j.cancelled && Number(j.fireAt) <= nowMs);
}

// ── Guild settings ──────────────────────────────────────

function loadGuildSettingsMap() {
  const data = readJson(config.guildSettingsPath, {});
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}

function saveGuildSettingsMap(map) {
  writeJson(config.guildSettingsPath, map);
}

function getGuildSettings(guildId) {
  const map = loadGuildSettingsMap();
  return map[String(guildId)] || {};
}

function setGuildSettings(guildId, patch) {
  const map = loadGuildSettingsMap();
  const key = String(guildId);
  map[key] = { ...(map[key] || {}), ...patch, updatedAt: Date.now() };
  saveGuildSettingsMap(map);
  return map[key];
}

module.exports = {
  ensureDataDir,
  id,
  loadEvents,
  saveEvents,
  getEvent,
  upsertEvent,
  removeEvent,
  loadReminders,
  saveReminders,
  getReminder,
  upsertReminder,
  removeReminder,
  loadJobs,
  saveJobs,
  addJobs,
  updateJob,
  removeJobsByRef,
  getDueJobs,
  getGuildSettings,
  setGuildSettings,
};
