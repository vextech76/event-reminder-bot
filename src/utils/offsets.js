const { config } = require('../config');

const ALL_KEYS = config.eventOffsets.map((o) => o.key);

function getOffsetByKey(key) {
  return config.eventOffsets.find((o) => o.key === key) || null;
}

function defaultOffsetKeys() {
  return ALL_KEYS.slice();
}

function normalizeOffsetKeys(keys) {
  if (!Array.isArray(keys) || !keys.length) return defaultOffsetKeys();
  const set = new Set(keys.map(String));
  const ordered = ALL_KEYS.filter((k) => set.has(k));
  return ordered.length ? ordered : defaultOffsetKeys();
}

function formatOffsetKeys(keys) {
  const list = normalizeOffsetKeys(keys);
  return list
    .map((k) => getOffsetByKey(k)?.label || k)
    .join(' · ');
}

function offsetSelectOptions(selectedKeys) {
  const selected = new Set(normalizeOffsetKeys(selectedKeys));
  return config.eventOffsets.map((o) => ({
    label: o.label === 'starting now' ? 'At start' : o.label,
    description:
      o.ms === 0
        ? 'Post when the event starts'
        : `About ${o.label} before start`,
    value: o.key,
    default: selected.has(o.key),
  }));
}

function resolveOffsets(keys) {
  return normalizeOffsetKeys(keys)
    .map((k) => getOffsetByKey(k))
    .filter(Boolean);
}

module.exports = {
  ALL_KEYS,
  getOffsetByKey,
  defaultOffsetKeys,
  normalizeOffsetKeys,
  formatOffsetKeys,
  offsetSelectOptions,
  resolveOffsets,
};
