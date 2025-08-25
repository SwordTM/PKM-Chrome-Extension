import { contentHash } from "./utils.js";

const KEY = "snippets";

export async function getAll() {
  const res = await chrome.storage.local.get({ [KEY]: [] });
  return res[KEY];
}

export async function setAll(items) {
  await chrome.storage.local.set({ [KEY]: items });
}

export async function addOne(snippet) {
  const items = await getAll();
  let textToHash = "";
  if (snippet.type === 'TRANSCRIPT_CAPTURED') {
    textToHash = snippet.title + "|" + snippet.url;
  } else {
    textToHash = (snippet.text || "") + "|" + (snippet.url || "");
  }
  const hash = await contentHash(textToHash);
  const exists = items.some((s) => s.contentHash === hash);
  if (!exists) {
    const newSnippet = {
      ...snippet,
      id: Date.now().toString(),
      contentHash: hash,
      source_type: snippet.type === 'TRANSCRIPT_CAPTURED' ? 'youtube_transcript' : 'web',
      captured_at: new Date().toISOString(),
    };
    items.unshift(newSnippet);
    await setAll(items);
    return newSnippet;
  }
  return null;
}

export async function removeById(id) {
  const items = await getAll();
  const next = items.filter((s) => s.id !== id);
  if (next.length !== items.length) {
    await setAll(next);
  }
}

export async function updateById(id, updates) {
  const items = await getAll();
  const index = items.findIndex((s) => s.id === id);
  if (index !== -1) {
    items[index] = { ...items[index], ...updates };
    await setAll(items);
  }
}
