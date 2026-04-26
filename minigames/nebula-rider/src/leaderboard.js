// Local leaderboard — top N runs, stored in localStorage.
// Each entry: { name, score, wave, distance, ts }.
const STORAGE_KEY = 'nebula-rider.leaderboard.v1';
const MAX_ENTRIES = 10;

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(isValid);
  } catch (_) { /* ignore */ }
  return [];
}

function isValid(e) {
  return e && typeof e === 'object' &&
    typeof e.name === 'string' &&
    Number.isFinite(e.score) &&
    Number.isFinite(e.wave) &&
    Number.isFinite(e.distance);
}

function writeAll(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (_) { /* ignore */ }
}

export const leaderboard = {
  list() {
    return readAll()
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ENTRIES);
  },

  // Returns the rank (1-based) the new score would take, or null if it wouldn't
  // make the top list.
  projectedRank(score) {
    const list = this.list();
    let rank = 1;
    for (const e of list) {
      if (score > e.score) return rank;
      rank++;
    }
    if (list.length < MAX_ENTRIES) return rank;
    return null;
  },

  submit({ name, score, wave, distance }) {
    const clean = (name || 'RIDER').toString().trim().slice(0, 12).toUpperCase() || 'RIDER';
    const entry = {
      name: clean,
      score: Math.max(0, Math.floor(score)),
      wave: Math.max(1, Math.floor(wave)),
      distance: Math.max(0, Math.floor(distance)),
      ts: Date.now(),
    };
    const list = readAll();
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    const trimmed = list.slice(0, MAX_ENTRIES);
    writeAll(trimmed);
    return { entry, rank: trimmed.indexOf(entry) + 1 };
  },

  clear() { writeAll([]); },
};
