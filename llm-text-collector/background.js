import { addOne } from "./storage.js";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PING") {
    sendResponse({ type: "PONG" });
    return;
  }
  if (message.type === "SAVE_SELECTION") {
    (async () => {
      try {
        const newSnippet = await addOne(message.payload);
        sendResponse({ ok: true, newSnippet });
      } catch (error) {
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true; // Indicates that the response is sent asynchronously
  } else if (message.type === "SUMMARIZE_TEXT") {
    // Placeholder: Acknowledge the message to prevent the error.
    // Replace this with actual summarization logic when ready.
    console.log("Received SUMMARIZE_TEXT request with text:", message.text);
    sendResponse({ ok: true, summarizedText: message.text }); // Echoing back the original text
    return true; // Indicates that the response is sent asynchronously
  }
});

chrome.runtime.onInstalled.addListener(async (details) => {
  chrome.contextMenus.create({
    id: "save-selection",
    title: "Save selection to LLM Inbox",
    contexts: ["selection"],
  });

  if (details.reason === "install" || details.reason === "update") {
    for (const cs of chrome.runtime.getManifest().content_scripts) {
      for (const tab of await chrome.tabs.query({ url: cs.matches })) {
        if (tab.url.startsWith("http")) { // Avoid injecting into chrome:// pages
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: cs.js,
          });
        }
      }
    }
  }
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

// background.js (append or merge with your file)
const STORAGE_KEY = "snippets";

async function pushSnippet(snippet) {
  const { [STORAGE_KEY]: arr = [] } = await chrome.storage.local.get(STORAGE_KEY);
  const withId = { id: crypto.randomUUID(), ...snippet };
  await chrome.storage.local.set({ [STORAGE_KEY]: [withId, ...arr] });
  return withId;
}

async function callGeminiApi(text) {
  const { geminiApiKey } = await chrome.storage.sync.get('geminiApiKey');
  if (!geminiApiKey) {
    throw new Error("Gemini API Key not set. Please set it in the extension options.");
  }

  const model = "gemini-pro"; // Or "gemini-1.5-pro" or other suitable model
  const prompt = `Summarize the following text concisely:\n\n${text}`;

  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }]
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Gemini API error: ${response.status} - ${errorData.error.message}`);
  }

  const data = await response.json();
  if (data.candidates && data.candidates.length > 0 && data.candidates[0].content.parts.length > 0) {
    return data.candidates[0].content.parts[0].text;
  } else {
    throw new Error("No summary found in Gemini API response.");
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SUMMARIZE_TEXT") {
    // Placeholder: Acknowledge the message to prevent the error.
    // Replace this with actual summarization logic when ready.
    console.log("Received SUMMARIZE_TEXT request with text:", message.text);
    sendResponse({ ok: true, summarizedText: message.text }); // Echoing back the original text
    return true; // Indicates that the response is sent asynchronously
  }
});
