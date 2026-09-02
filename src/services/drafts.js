/**
 * Short-lived in-memory drafts for multi-step modal → select → confirm flows.
 * Keyed by draft id; only the creating user may continue the flow.
 */

const TTL_MS = 15 * 60 * 1000;
/** @type {Map<string, object>} */
const drafts = new Map();

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function put(draft) {
  const id = makeId();
  const entry = {
    ...draft,
    id,
    createdAt: Date.now(),
    expiresAt: Date.now() + TTL_MS,
  };
  drafts.set(id, entry);
  return entry;
}

function get(id) {
  const d = drafts.get(id);
  if (!d) return null;
  if (Date.now() > d.expiresAt) {
    drafts.delete(id);
    return null;
  }
  return d;
}

function update(id, patch) {
  const d = get(id);
  if (!d) return null;
  Object.assign(d, patch);
  drafts.set(id, d);
  return d;
}

function remove(id) {
  drafts.delete(id);
}

function purgeExpired() {
  const now = Date.now();
  for (const [id, d] of drafts) {
    if (now > d.expiresAt) drafts.delete(id);
  }
}

setInterval(purgeExpired, 60_000).unref?.();

module.exports = { put, get, update, remove, TTL_MS };
