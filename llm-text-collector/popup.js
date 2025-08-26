import { addOne, getAll, removeById } from "./storage.js";
import { isInjectable } from "./utils.js";

const els = {
  list: document.getElementById("list"),
  empty: document.getElementById("empty"),
  capture: document.getElementById("capturePage"),
  clearAll: document.getElementById("clearAll"),
  // YouTube Buttons
  ytScrapeTranscript: document.getElementById("ytScrapeTranscript"),
  
};

function renderItem(item) {
  if (item.type === 'TRANSCRIPT_CAPTURED') {
    return renderTranscript(item);
  }
  const tpl = document.getElementById("itemTpl");
  const li = tpl.content.firstElementChild.cloneNode(true);

  li.dataset.id = item.id;

  li.querySelector(".title").textContent = item.title || "(untitled)";
  li.querySelector(".title").href = item.url || "#";
  li.querySelector(".createdAt").textContent = new Date(
    item.captured_at || item.capturedAt
  ).toLocaleString();
  li.querySelector(".text").textContent = item.text || "";

  const sourceEl = li.querySelector(".source");
  let icon = "🌐";
  if (item.source_type?.startsWith("youtube")) {
    icon = "📺";
  } else if (item.url?.includes("pdf")) {
    icon = "📄";
  } else if (item.url?.includes("github.com")) {
    icon = "🐙";
  } else if(item.url?.includes("selection")) {
    icon = "✂️";
  }
  sourceEl.textContent = icon + " " + (new URL(item.url).hostname || "");

  els.list.prepend(li);
}

function renderTranscript(item) {
  const tpl = document.getElementById("transcriptTpl");
  const li = tpl.content.firstElementChild.cloneNode(true);

  li.dataset.id = item.id;

  li.querySelector(".title").textContent = item.title || "(untitled)";
  li.querySelector(".title").href = item.url || "#";
  li.querySelector(".createdAt").textContent = new Date(
    item.capturedAt || item.captured_at || Date.now()
  ).toLocaleString();

  const segments = Array.isArray(item.segments) ? item.segments : [];
  const fullText = segments.length ? segments.map(s => s.text || "").join("\n") : (item.text || "");
  li.querySelector(".text").textContent = fullText || "(no transcript text)";

  const segmentsEl = li.querySelector(".transcript-segments");
  segmentsEl.innerHTML = "";
  let visibleSegmentCount = 5;

  function renderSegments() {
    segmentsEl.innerHTML = "";
    const segmentsToRender = segments.slice(0, visibleSegmentCount);
    for (const seg of segmentsToRender) {
      const liSeg = document.createElement("li");
      liSeg.classList.add("flex", "items-start", "gap-2", "text-sm");
      const tsEl = document.createElement("div");
      tsEl.classList.add("text-gray-600", "w-16", "shrink-0");
      tsEl.textContent = seg.ts ?? "";
      const textEl = document.createElement("div");
      textEl.classList.add("text-gray-900");
      textEl.textContent = seg.text ?? "";
      liSeg.appendChild(tsEl);
      liSeg.appendChild(textEl);
      segmentsEl.appendChild(liSeg);
    }

    if (segments.length > visibleSegmentCount) {
      const showMoreBtn = document.createElement("button");
      showMoreBtn.textContent = `Show more (${visibleSegmentCount}/${segments.length})`;
      showMoreBtn.classList.add("btn-ghost-sm", "mt-2");
      showMoreBtn.addEventListener("click", () => {
        visibleSegmentCount += 5;
        renderSegments();
      });
      segmentsEl.appendChild(showMoreBtn);
    } else if (visibleSegmentCount > 5) {
      const showLessBtn = document.createElement("button");
      showLessBtn.textContent = "Show less";
      showLessBtn.classList.add("btn-ghost-sm", "mt-2");
      showLessBtn.addEventListener("click", () => {
        visibleSegmentCount = 5;
        renderSegments();
      });
      segmentsEl.appendChild(showLessBtn);
    }
  }

  renderSegments();

  const sourceEl = li.querySelector(".source");
  sourceEl.textContent = (item.url?.includes("youtube.com") ? "📺" : "🌐") + " " + (new URL(item.url).hostname || "");
  els.list.prepend(li);
}

async function load() {
  

  const items = await getAll();
  els.list.innerHTML = "";
  if (!items || items.length === 0) {
    els.empty.style.display = "block";
  } else {
    els.empty.style.display = "none";
    items.reverse().forEach(renderItem);
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (isYouTubeWatch(tab?.url || "")) {
    els.capture.style.display = "none";
    els.ytScrapeTranscript.style.display = "block";
  } else {
    els.capture.style.display = "block";
    els.ytScrapeTranscript.style.display = "none";
  }
}

function isYouTubeWatch(url) {
  try {
    const u = new URL(url);
    return u.hostname.includes("youtube.com") && u.pathname === "/watch";
  } catch {
    return false;
  }
}

els.capture.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !isInjectable(tab.url)) {
    return;
  }

  try {
    let res = await chrome.tabs.sendMessage(tab.id, { type: "PAGE_EXTRACT" });
    if (res && res.ok) {
      const newSnippet = await addOne(res.payload);
      if (newSnippet) {
        renderItem(newSnippet);
        els.empty.style.display = "none";
      }
    } else {
      console.error("Capture failed", res?.error);
    }
  } catch (e) {
    if (e.message.includes("Receiving end does not exist")) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
      const res = await chrome.tabs.sendMessage(tab.id, { type: "PAGE_EXTRACT" });
      if (res && res.ok) {
        const newSnippet = await addOne(res.payload);
        if (newSnippet) {
          renderItem(newSnippet);
          els.empty.style.display = "none";
        }
      }
    } else {
      console.error("Capture failed", e);
    }
  }
});

els.ytScrapeTranscript.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "YT_SCRAPE_TRANSCRIPT" });
  } catch (e) {
    if (e.message.includes("Receiving end does not exist")) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["youtube.js"],
      });
      await chrome.tabs.sendMessage(tab.id, { type: "YT_SCRAPE_TRANSCRIPT" });
    } else {
      console.error("Transcript scrape failed", e);
    }
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "SAVE_SNIPPET") {
    addOne(msg.payload).then((newSnippet) => {
      if (newSnippet) {
        renderItem(newSnippet);
        els.empty.style.display = "none";
      }
    });
  } else if (msg.type === "TRANSCRIPT_CAPTURED") {
    console.log("[POPUP] transcript payload received", msg);
    const text = Array.isArray(msg.segments) ? msg.segments.map(s => s.text || "").join("\n") : "";
    const toSave = { ...msg, text };     // keep segments + add text for fallback/views
    addOne(toSave).then((newSnippet) => {
      if (newSnippet) {
        renderTranscript(newSnippet);
        els.empty.style.display = "none";
      }
    });
  }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.snippets) {
    load();
  }
});

els.list.addEventListener("click", async (e) => {
  const deleteBtn = e.target.closest(".delete");
  if (deleteBtn) {
    const li = deleteBtn.closest("li");
    const id = li.dataset.id;
    if (id) {
      await removeById(id);
      li.remove();
      const items = await getAll();
      if (items.length === 0) {
        els.empty.style.display = "block";   
      }
    }
  }
});

els.clearAll.addEventListener("click", async () => {
  if (!confirm("Delete all saved snippets?")) return;
  await chrome.storage.local.set({ snippets: [] });
  await load();
});

load();
