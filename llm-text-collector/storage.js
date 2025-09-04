import { contentHash } from "./utils.js";

const KEY = "snippets";
const SAVED_KEY = "saved_snippets";
const AUTO_CAPTURED_KEY = "auto_captured_snippets";

export async function getAll(key = KEY) {
  const res = await chrome.storage.local.get({ [key]: [] });
  return res[key];
}

export async function setAll(items, key = KEY) {
  await chrome.storage.local.set({ [key]: items });
}

export async function addOne(snippet, key = KEY) {
  console.log(`addOne called with key: ${key}, snippet:`, snippet);
  const items = await getAll(key);
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
    await setAll(items, key);
    return newSnippet;
  }
  return null;
}

export async function removeById(id, key = KEY) {
  const items = await getAll(key);
  const next = items.filter((s) => s.id !== id);
  if (next.length !== items.length) {
    await setAll(next, key);
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

// Saved snippets (finalized, no summarization)
export async function getAllSaved() {
  const res = await chrome.storage.local.get({ [SAVED_KEY]: [] });
  return res[SAVED_KEY];
}

export async function setAllSaved(items) {
  await chrome.storage.local.set({ [SAVED_KEY]: items });
}

export async function addSavedOne(snippet) {
  const items = await getAllSaved();
  let textToHash = "";
  if (snippet.type === 'TRANSCRIPT_CAPTURED') {
    textToHash = (snippet.title || "") + "|" + (snippet.url || "");
  } else {
    textToHash = (snippet.text || "") + "|" + (snippet.url || "");
  }
  const hash = await contentHash(textToHash);
  const exists = items.some((s) => s.contentHash === hash);
  if (!exists) {
    const newSaved = {
      ...snippet,
      saved_at: new Date().toISOString(),
    };
    await setAllSaved([newSaved, ...items]);
    return newSaved;
  }
  return null;
}

export async function addSavedMany(snippets) {
  let count = 0;
  for (const s of snippets) {
    const res = await addSavedOne(s);
    if (res) count++;
  }
  return count;
}
