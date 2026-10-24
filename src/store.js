export const STORAGE_VERSION = 1;
const SITE_SCOPE = typeof location === 'undefined' ? 'root' : (location.pathname.split('/').filter(Boolean)[0] || 'root');
const PREFIX = `classkit:v${STORAGE_VERSION}:${SITE_SCOPE}:`;

export function loadState(key, fallback = null, storage) {
  try {
    storage ??= globalThis.localStorage;
    const raw = storage?.getItem(PREFIX + key);
    if (raw == null) return fallback;
    const record = JSON.parse(raw);
    if (!record || typeof record !== 'object') return fallback;
    if (record.version === 0 && record.data && typeof record.data === 'object') return record.data;
    return record.version === STORAGE_VERSION ? record.data : fallback;
  } catch { return fallback; }
}

export function saveState(key, data, storage) {
  try {
    storage ??= globalThis.localStorage;
    if (!storage) throw new Error('此浏览器不支持本地存储');
    storage.setItem(PREFIX + key, JSON.stringify({ version: STORAGE_VERSION, updatedAt: new Date().toISOString(), data }));
    return true;
  } catch { return false; }
}

export function removeState(key, storage) {
  try { storage ??= globalThis.localStorage; storage?.removeItem(PREFIX + key); return true; } catch { return false; }
}

export function listState(storage) {
  const result = {};
  try {
    storage ??= globalThis.localStorage;
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key?.startsWith(PREFIX)) {
        const name = key.slice(PREFIX.length);
        result[name] = loadState(name, null, storage);
      }
    }
  } catch { /* private browsing can disable storage */ }
  return result;
}

export function replaceAllState(data, storage) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('备份应为 JSON 对象。');
  try { storage ??= globalThis.localStorage; } catch { throw new Error('此浏览器不允许本地存储。'); }
  const entries = Object.entries(data);
  if (entries.some(([key]) => typeof key !== 'string' || key.length > 80)) throw new TypeError('备份包含无效数据项。');
  const previous = listState(storage);
  try {
    for (const key of Object.keys(previous)) storage.removeItem(PREFIX + key);
    for (const [key, value] of entries) {
      if (key === 'format' || key === 'version' || key === 'exportedAt') continue;
      storage.setItem(PREFIX + key, JSON.stringify({ version: STORAGE_VERSION, updatedAt: new Date().toISOString(), data: value }));
    }
    return true;
  } catch (error) {
    try {
      for (const key of Object.keys(listState(storage))) storage.removeItem(PREFIX + key);
      for (const [key, value] of Object.entries(previous)) storage.setItem(PREFIX + key, JSON.stringify({ version: STORAGE_VERSION, updatedAt: new Date().toISOString(), data: value }));
    } catch { /* caller receives a clear storage error */ }
    throw new Error(`导入失败，已尝试恢复原数据：${error.message}`);
  }
}
