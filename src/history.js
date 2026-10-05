const KEY = 'scamhunter.history.v1';
const LIMIT = 50;

export function readHistory(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.id === 'string' && typeof item.text === 'string' && Number.isFinite(item.score) && Array.isArray(item.signals) && Array.isArray(item.evidence) && Array.isArray(item.recommendations)).slice(0, LIMIT);
  } catch {
    return [];
  }
}

export function saveScan(scan, storage = globalThis.localStorage) {
  const next = [scan, ...readHistory(storage)].slice(0, LIMIT);
  try {
    storage?.setItem(KEY, JSON.stringify(next));
  } catch {
    // Analysis still works if browser storage is unavailable or full.
  }
  return next;
}

export function deleteScan(id, storage = globalThis.localStorage) {
  const next = readHistory(storage).filter((item) => item.id !== id);
  try {
    storage?.setItem(KEY, JSON.stringify(next));
  } catch {
    // Keep UI usable if browser storage is blocked.
  }
  return next;
}

export function clearHistory(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(KEY);
  } catch {
    // Keep UI usable if browser storage is blocked.
  }
}
