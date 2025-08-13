import { sha256Hex } from './utils.js';

const KEY = 'snippets';

export async function getAll() {
  const res = await chrome.storage.local.get({ [KEY]: [] });
  return res[KEY];
}

export async function setAll(items) {
  await chrome.storage.local.set({ [KEY]: items });
}

export async function addSnippet(snippet) {
  const items = await getAll();
  const contentHash = await sha256Hex((snippet.text || '') + '|' + (snippet.url || ''));
  const exists = items.some(s => s.contentHash === contentHash);
  if (!exists) {
    items.unshift({ ...snippet, contentHash });
    await setAll(items);
  }
  return !exists;
}

export async function deleteByHash(contentHash) {
  const items = await getAll();
  const next = items.filter(s => s.contentHash !== contentHash);
  await setAll(next);
}

export async function clearAll() {
  await setAll([]);
}