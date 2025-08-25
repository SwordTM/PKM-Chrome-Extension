import { addOne } from "./storage.js";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-selection",
    title: "Save selection to LLM Inbox",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "save-selection") {
    const snippet = {
      title: tab.title,
      url: tab.url,
      text: info.selectionText,
      source_type: "web",
    };
    await addOne(snippet);
  }
});

const STORE_KEY = "transcripts_by_id";

// ---- helpers ----
async function loadAll() {
  const { [STORE_KEY]: data } = await chrome.storage.local.get(STORE_KEY);
  return data || {}; // { [videoId]: transcript }
}

async function saveAll(map) {
  await chrome.storage.local.set({ [STORE_KEY]: map });
}

async function upsertTranscript(t) {
  const map = await loadAll();
  const prev = map[t.videoId];

  // merge policy: keep most recent capturedAt; replace segments if new has any
  if (!prev) {
    map[t.videoId] = { ...t, source: "youtube" };
  } else {
    const newer = (a, b) => (new Date(a || 0).getTime() >= new Date(b || 0).getTime());
    map[t.videoId] = {
      ...prev,
      ...t,
      capturedAt: newer(t.capturedAt, prev.capturedAt) ? t.capturedAt : prev.capturedAt,
      segments: (t.segments?.length ? t.segments : prev.segments),
      source: "youtube",
    };
  }

  await saveAll(map);
  return map[t.videoId];
}

async function listTranscripts(metaOnly = true) {
  const map = await loadAll();
  const arr = Object.values(map);
  return metaOnly
    ? arr.map(({ videoId, title, url, capturedAt, segments }) => ({
        videoId, title, url, capturedAt, lines: segments?.length || 0
      }))
    : arr;
}

async function getTranscript(videoId) {
  const map = await loadAll();
  return map[videoId] || null;
}

async function removeTranscript(videoId) {
  const map = await loadAll();
  delete map[videoId];
  await saveAll(map);
}

// optional export: save a pretty JSON file via chrome.downloads
async function exportAllToDownloads() {
  const data = await loadAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  try {
    await chrome.downloads.download({
      url,
      filename: `yt_transcripts_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`,
      saveAs: true
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === "SAVE_SELECTION") {
      await addOne(msg.payload);
      sendResponse({ ok: true });
      return;
    }

    if (msg?.type === "TRANSCRIPT_CAPTURED") {
      const stored = await upsertTranscript(msg);
      console.log("[SW] Stored transcript:", stored.videoId, stored.title, stored.segments?.length);
      sendResponse({ ok: true, stored: { videoId: stored.videoId, lines: stored.segments?.length || 0 } });
      return;
    }

    // Optional RPC for UI/popup/options
    if (msg?.type === "TRANSCRIPTS_LIST") {
      const list = await listTranscripts(true);
      sendResponse({ ok: true, list });
      return;
    }
    if (msg?.type === "TRANSCRIPTS_GET" && msg.videoId) {
      const t = await getTranscript(msg.videoId);
      sendResponse({ ok: !!t, transcript: t });
      return;
    }
    if (msg?.type === "TRANSCRIPTS_REMOVE" && msg.videoId) {
      await removeTranscript(msg.videoId);
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "TRANSCRIPTS_EXPORT_ALL") {
      await exportAllToDownloads();
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, error: "unknown_message" });
  })();

  // keep channel open for async
  return true;
});

// background.js (append or merge with your file)
const STORAGE_KEY = "snippets";

async function pushSnippet(snippet) {
  const { [STORAGE_KEY]: arr = [] } = await chrome.storage.local.get(STORAGE_KEY);
  const withId = { id: crypto.randomUUID(), ...snippet };
  await chrome.storage.local.set({ [STORAGE_KEY]: [withId, ...arr] });
  return withId;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === "SAVE_SNIPPET" && msg.payload) {
      const saved = await pushSnippet(msg.payload);
      // notify any open UIs; your popup reloads on storage change anyway
      sendResponse({ ok: true, id: saved.id });
      return;
    }
  })();
  return true;
});