/**
 * Parse human durations like 30s, 5m, 1h, 2d, 1w, 1mo into milliseconds.
 * Also accepts bare integers as seconds (FlashBot-compatible).
 */
function parseDurationMs(input) {
  if (input == null) return null;
  const raw = String(input).trim().toLowerCase();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    const sec = Number.parseInt(raw, 10);
    return Number.isFinite(sec) && sec > 0 ? sec * 1000 : null;
  }

  const match = raw.match(/^(\d+(?:\.\d+)?)\s*(mo|months?|w|weeks?|d|days?|h|hours?|m|mins?|minutes?|s|secs?|seconds?)$/);
  if (!match) return null;

  const amount = Number.parseFloat(match[1]);
  const unit = match[2];
  if (!Number.isFinite(amount) || amount <= 0) return null;

  let mult;
  if (unit.startsWith('mo')) mult = 30 * 24 * 60 * 60 * 1000;
  else if (unit.startsWith('w')) mult = 7 * 24 * 60 * 60 * 1000;
  else if (unit.startsWith('d')) mult = 24 * 60 * 60 * 1000;
  else if (unit.startsWith('h')) mult = 60 * 60 * 1000;
  else if (unit === 'm' || unit.startsWith('min')) mult = 60 * 1000;
  else mult = 1000;

  return Math.round(amount * mult);
}

function formatDurationMs(ms) {
  if (!Number.isFinite(ms) || ms < 0) return String(ms);
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s ? `${m}m ${s}s` : `${m}m`;
  }
  if (sec < 86400) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  if (sec < 7 * 86400) {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    return h ? `${d}d ${h}h` : `${d}d`;
  }
  if (sec < 30 * 86400) {
    const w = Math.floor(sec / (7 * 86400));
    const d = Math.floor((sec % (7 * 86400)) / 86400);
    return d ? `${w}w ${d}d` : `${w}w`;
  }
  const mo = Math.floor(sec / (30 * 86400));
  const d = Math.floor((sec % (30 * 86400)) / 86400);
  return d ? `${mo}mo ${d}d` : `${mo}mo`;
}

module.exports = { parseDurationMs, formatDurationMs };
