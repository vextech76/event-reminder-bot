const { parseDurationMs } = require('./duration');

/**
 * Parse user time strings into a Date (UTC instant).
 * Supports:
 *  - ISO-ish: 2026-08-15T19:00, 2026-08-15 19:00
 *  - relative: in 2h, in 3 days, in 1 week
 *  - every X: every 3h (returns { recurring: true, intervalMs })
 *  - tomorrow [HH:MM], today [HH:MM]
 *
 * @param {string} input
 * @param {{ timezone?: string, now?: Date }} opts
 * @returns {{ at: Date } | { recurring: true, intervalMs: number, firstAt: Date } | { error: string }}
 */
function parseWhen(input, opts = {}) {
  const now = opts.now || new Date();
  const tz = opts.timezone || 'UTC';
  const raw = String(input || '').trim();
  if (!raw) return { error: 'Empty time string.' };

  const lower = raw.toLowerCase();

  // every 3h / every 1d
  const everyMatch = lower.match(/^every\s+(.+)$/);
  if (everyMatch) {
    const intervalMs = parseDurationMs(everyMatch[1]);
    if (!intervalMs || intervalMs < 60 * 1000) {
      return { error: 'Recurring interval must be at least 1 minute (e.g. every 3h).' };
    }
    return {
      recurring: true,
      intervalMs,
      firstAt: new Date(now.getTime() + intervalMs),
    };
  }

  // in 2h / in 3 days
  const inMatch = lower.match(/^in\s+(.+)$/);
  if (inMatch) {
    const ms = parseDurationMs(inMatch[1]);
    if (!ms) return { error: `Could not parse duration: "${inMatch[1]}"` };
    return { at: new Date(now.getTime() + ms) };
  }

  // today / tomorrow [HH:MM]
  const dayMatch = lower.match(/^(today|tomorrow)(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (dayMatch) {
    const base = zonedParts(now, tz);
    let y = base.year;
    let mo = base.month;
    let d = base.day;
    if (dayMatch[1] === 'tomorrow') {
      const next = addCalendarDays(y, mo, d, 1, tz);
      y = next.year;
      mo = next.month;
      d = next.day;
    }
    const hour = dayMatch[2] != null ? Number(dayMatch[2]) : base.hour;
    const minute = dayMatch[3] != null ? Number(dayMatch[3]) : dayMatch[2] != null ? 0 : base.minute;
    const at = zonedLocalToUtc(y, mo, d, hour, minute, 0, tz);
    if (!at || Number.isNaN(at.getTime())) return { error: 'Invalid today/tomorrow time.' };
    if (at.getTime() <= now.getTime()) {
      return { error: 'That time is already in the past. Try tomorrow or a later clock time.' };
    }
    return { at };
  }

  // ISO or "YYYY-MM-DD HH:MM" or "YYYY-MM-DDTHH:MM"
  const isoish = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?(?:\s*(Z|[+-]\d{2}:?\d{2}))?$/i
  );
  if (isoish) {
    const y = Number(isoish[1]);
    const mo = Number(isoish[2]);
    const d = Number(isoish[3]);
    const hour = isoish[4] != null ? Number(isoish[4]) : 0;
    const minute = isoish[5] != null ? Number(isoish[5]) : 0;
    const second = isoish[6] != null ? Number(isoish[6]) : 0;
    const offset = isoish[7];

    let at;
    if (offset) {
      // Explicit offset / Z → use Date parse
      const normalized = `${isoish[1]}-${isoish[2]}-${isoish[3]}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}${offset === 'Z' || offset === 'z' ? 'Z' : offset}`;
      at = new Date(normalized);
    } else {
      at = zonedLocalToUtc(y, mo, d, hour, minute, second, tz);
    }
    if (!at || Number.isNaN(at.getTime())) return { error: 'Invalid date/time.' };
    if (at.getTime() <= now.getTime()) {
      return { error: 'That time is already in the past.' };
    }
    return { at };
  }

  // Fallback: Date.parse
  const fallback = new Date(raw);
  if (!Number.isNaN(fallback.getTime()) && fallback.getTime() > now.getTime()) {
    return { at: fallback };
  }

  return {
    error:
      'Could not parse time. Try: `in 2h`, `every 3h`, `tomorrow 19:00`, or `2026-08-15 19:00`.',
  };
}

function zonedParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/**
 * Convert a wall-clock time in `timeZone` to a UTC Date.
 * Uses iterative offset resolution (handles DST for common cases).
 */
function zonedLocalToUtc(year, month, day, hour, minute, second, timeZone) {
  // Initial guess: treat as UTC
  let utc = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 3; i++) {
    const parts = zonedParts(new Date(utc), timeZone);
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    const target = Date.UTC(year, month - 1, day, hour, minute, second);
    const diff = target - asUtc;
    if (diff === 0) break;
    utc += diff;
  }
  return new Date(utc);
}

function addCalendarDays(year, month, day, delta, timeZone) {
  // noon UTC-ish via zoned conversion to avoid DST edge on day boundary
  const base = zonedLocalToUtc(year, month, day, 12, 0, 0, timeZone);
  const next = new Date(base.getTime() + delta * 24 * 60 * 60 * 1000);
  const p = zonedParts(next, timeZone);
  return { year: p.year, month: p.month, day: p.day };
}

function discordTimestamp(unixSeconds, style = 'F') {
  return `<t:${unixSeconds}:${style}>`;
}

function toUnixSeconds(dateOrMs) {
  const ms = dateOrMs instanceof Date ? dateOrMs.getTime() : Number(dateOrMs);
  return Math.floor(ms / 1000);
}

module.exports = {
  parseWhen,
  zonedParts,
  zonedLocalToUtc,
  discordTimestamp,
  toUnixSeconds,
};
