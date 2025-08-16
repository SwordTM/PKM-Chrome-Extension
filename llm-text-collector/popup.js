import { getAll, setAll, deleteByHash, addSnippet } from './storage.js';

const els = {
  list: document.getElementById('list'),
  empty: document.getElementById('empty'),
  capture: document.getElementById('capturePage'),
  exportJson: document.getElementById('exportJson'),
  sendToLLM: document.getElementById('sendToLLM'),
  clearAll: document.getElementById('clearAll')
};

function renderList(items) {
  els.list.innerHTML = '';
  if (!items || items.length === 0) {
    els.empty.style.display = 'block';   // show empty message
    return;
  }
  els.empty.style.display = 'none' ; // hide empty message

  const tpl = document.getElementById('itemTpl');
  items.forEach(sn => {
    const li = tpl.content.firstElementChild.cloneNode(true);
    li.querySelector('.title').textContent = sn.title || '(untitled)';
    li.querySelector('.title').href = sn.url || '#';
    li.querySelector('.createdAt').textContent = new Date(sn.createdAt).toLocaleString();
    li.querySelector('.text').textContent = sn.text || '';
    li.querySelector('.tags').value = (sn.tags || []).join(', ');
    li.querySelector('.note').value = sn.note || '';

    li.querySelector('.save').addEventListener('click', async () => {
      const tags = li.querySelector('.tags').value.split(',').map(s => s.trim()).filter(Boolean);
      const note = li.querySelector('.note').value;
      const items2 = await getAll();
      const idx = items2.findIndex(x => x.contentHash === sn.contentHash);
      if (idx >= 0) {
        items2[idx] = { ...items2[idx], tags, note };
        await setAll(items2);
        await load();
      }
    });

    li.querySelector('.delete').addEventListener('click', async () => {
      await deleteByHash(sn.contentHash);
      await load();
    });

    enhanceItem(li);

    els.list.appendChild(li);
  });
}

function renderItem(item) {
  const li = tpl.content.firstElementChild.cloneNode(true);

  li.querySelector(".title").textContent = item.title || "";
  li.querySelector(".title").href = item.url || "";
  li.querySelector(".createdAt").textContent =
    item.createdAt ? new Date(item.createdAt).toLocaleString() : "";

  const textEl = li.querySelector(".text");
  if (textEl) textEl.textContent = item.text || "";

  enhanceItem(li);
  list.prepend(li);
  els.empty.style.display = 'none';  // hide empty message since we now have items
  renderCount();
}

const list = document.getElementById("list");
const empty = document.getElementById("empty");
const tpl  = document.getElementById("itemTpl");

async function load() {
  const items = await getAll();
  renderList(items);
}

(async () => {
  const tab = await getActiveTab();
  const injectable = isInjectable(tab?.url);
  const btn = document.getElementById("capturePage");
  btn.disabled = !injectable;
  // with Tailwind utility classes:
  if (!injectable) btn.classList.add("opacity-50", "cursor-not-allowed");
})();

function enhanceItem(li) {
  if (li.dataset.enhanced === "1") return;
  li.dataset.enhanced = "1";

  const bodyEl = li.querySelector(".snippet-body") || li.querySelector(".text");
  if (!bodyEl) return;

  // collapsed preview styling
  bodyEl.classList.add("snippet-body", "collapsed");
  bodyEl.style.position = "relative";

  // fade overlay
  if (!bodyEl.querySelector(".snippet-fade")) {
    const fade = document.createElement("div");
    fade.className = "snippet-fade";
    bodyEl.appendChild(fade);
  }

  // expand/collapse button
  let toggle = li.querySelector(".toggle");
  if (!toggle) {
    toggle = document.createElement("button");
    toggle.className =
      "toggle mt-2 inline-flex items-center rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50";
    toggle.textContent = "Expand";
    bodyEl.after(toggle);
  }
  toggle.onclick = () => {
    bodyEl.classList.toggle("collapsed");
    toggle.textContent = bodyEl.classList.contains("collapsed") ? "Expand" : "Collapse";
  };

  // --- Auto-tag button logic (moved here) ---
  const autoBtn = li.querySelector('.autotag');
  const tagsInput = li.querySelector('.tags');
  const textEl = li.querySelector('.text');

  autoBtn?.addEventListener('click', async () => {
    autoBtn.disabled = true;
    autoBtn.textContent = '…';
    try {
      const txt = (textEl?.textContent || '').toLowerCase();
      const guesses = [];
      if (txt.includes('youtube')) guesses.push('#youtube');
      if (txt.includes('agi') || txt.includes('ai')) guesses.push('#ai');
      if (txt.includes('market')) guesses.push('#markets');
      const merged = Array.from(new Set([
        ...(tagsInput.value || '').split(',').map(s => s.trim()).filter(Boolean),
        ...guesses
      ]));
      tagsInput.value = merged.join(', ');
    } finally {
      autoBtn.textContent = 'Auto';
      autoBtn.disabled = false;
    }
  });
}


// Capture full-page extract by injecting content.js
els.capture.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });
});

// Receive extract from content.js
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "PAGE_EXTRACT") {
    try {
      const payload = {
        type: "page_extract",
        title: document.title,
        url: location.href,
        text: document.body?.innerText?.slice(0, 20000) || "",
        createdAt: new Date().toISOString()
      };
      sendResponse({ ok: true, payload });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  }
  // we respond synchronously → return false
  return false;
});

// Export JSON
els.exportJson.addEventListener('click', async () => {
  const items = await getAll();
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `llm_inbox_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// Send to LLM (placeholder). Point to your local ingestion API.
els.sendToLLM.addEventListener('click', async () => {
  const items = await getAll();
  try {
    const res = await fetch('http://localhost:8000/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snippets: items })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    alert('Sent to LLM pipeline.');
  } catch (e) {
    alert('Failed to send to LLM: ' + e.message);
  }
});

// Clear All
els.clearAll.addEventListener('click', async () => {
  if (!confirm('Delete all saved snippets?')) return;
  await chrome.storage.local.set({ snippets: [] });
  await load();
});

// --- Youtube helpers ---
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
function isInjectable(url="") {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return false;
    if (u.hostname === "chrome.google.com") return false;
    return true;
  } catch { return false; }
}
function renderCount() {
  const n = list.querySelectorAll("li").length;
  empty?.classList.toggle("hidden", n > 0);
}
function toast(msg) {
  // replace with your UI; for now a simple alert
  alert(msg);
}
function isYouTubeWatch(url) {
  try {
    const u = new URL(url);
    return u.hostname.includes("youtube.com") && u.pathname === "/watch";
  } catch { return false; }
}
function show(el, yes) { el.classList.toggle('hidden', !yes); }

// --- elements ---
const ytBookmarkBtn   = document.getElementById('ytBookmark');
const ytCaptionNowBtn = document.getElementById('ytCaptionNow');
const ytTranscribeBtn = document.getElementById('ytTranscribe');
const capturePageBtn  = document.getElementById('capturePage');

// Call once on load to toggle visibility
(async () => {
  const tab = await getActiveTab();
  const onYT = isYouTubeWatch(tab?.url || "");
  show(ytBookmarkBtn, onYT);
  show(ytCaptionNowBtn, onYT);
  // Only show Transcribe if your build has audio infra (offscreen + tabCapture)
  const hasOffscreen = !!chrome.offscreen && !!chrome.tabCapture;
  show(ytTranscribeBtn, onYT && hasOffscreen);
})();

// --- YT actions ---
ytBookmarkBtn?.addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "YT_BOOKMARK" });
});

ytCaptionNowBtn?.addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab?.id) return;
  // windowSec = 20s around current time; adjust if you like
  chrome.tabs.sendMessage(tab.id, { type: "YT_CAPTURE_CAPTION", windowSec: 20 });
});

ytTranscribeBtn?.addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab?.id) return;
  // Ask content script for meta (title/url/time), then let background record audio
  chrome.tabs.sendMessage(tab.id, { type: "YT_GET_META" }, (meta) => {
    if (chrome.runtime.lastError) return; // no content script
    chrome.runtime.sendMessage({
      type: "OFFSCREEN_TRANSCRIBE",
      tabId: tab.id,
      meta,
      durationSec: 30
    });
  });
});

document.getElementById("capturePage")?.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (!tab?.id) return;

  if (!isInjectable(tab.url)) {
    alert("Can't capture this page. Try on a regular http(s) page.");
    return;
  }

  // Try sendMessage first (content script may already be there)
  let res = await chrome.tabs.sendMessage(tab.id, { type: "PAGE_EXTRACT" }).catch(() => null);

  // If no listener, inject content.js and try again
  if (!res) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      res = await chrome.tabs.sendMessage(tab.id, { type: "PAGE_EXTRACT" }).catch(() => null);
    } catch (e) {
      console.error("Injection failed:", e);
    }
  }

  if (!res || !res.ok) {
    console.warn("Capture failed:", res?.error);
    alert("Capture failed. Check console (Inspect popup) for details.");
    return;
  }

  const saved = { ...res.payload, tags: [], note: "" };

  // If you also persist to storage, do that here; otherwise render immediately:
  // await addSnippet(saved);
  renderItem(saved);
});

load();