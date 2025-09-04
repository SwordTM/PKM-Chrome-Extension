import { addOne, getAll, removeById, updateById, addSavedOne, addSavedMany } from "./storage.js";
import { isInjectable } from "./utils.js";
import { summarizeText } from "./summarizer.js";

const els = {
  list: document.getElementById("list"),
  empty: document.getElementById("empty"),
  capture: document.getElementById("capturePage"),
  saveAll: document.getElementById("saveAll"),
  clearAll: document.getElementById("clearAll"),
  // YouTube Buttons
  ytScrapeTranscript: document.getElementById("ytScrapeTranscript"),
  // Menu elements
  profileButton: document.getElementById("profile-button"),
  profileMenu: document.getElementById("profile-menu"),
  snippetsTab: document.getElementById("snippets-tab"),
  autoCaptureTab: document.getElementById("auto-capture-tab"),
  snippetsPanel: document.getElementById("snippets-panel"),
  autoCapturePanel: document.getElementById("auto-capture-panel"),
  autoCaptureList: document.getElementById("auto-capture-list"),
  settingsButton: document.getElementById("settings-button"),
  logoutButton: document.getElementById("logout-button"),
  autoCaptureToggle: document.getElementById("auto-capture-toggle"),
  summarizeAction: document.getElementById("summarize-action"),
  summaryContainer: document.getElementById("summary-container"),
  summaryText: document.getElementById("summary-text"),
};

function createSnippetCardTemplate() {
  const li = document.createElement("li");
  li.className = "snippet-card shadow-sm rounded-lg bg-white p-3";
  li.innerHTML = `
    <div class="snippet-head flex items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <a class="title snippet-title font-semibold text-gray-900 hover:underline block truncate" target="_blank"></a>
        <div class="source flex items-center gap-1 text-xs text-gray-500 mt-0.5"></div>
        <div class="createdAt snippet-meta text-xs text-gray-500 mt-0.5"></div>
      </div>
      <div class="shrink-0 flex items-center gap-2">
        <button class="save btn-ghost-sm">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.6 7.6a1 1 0 0 1-1.4 0L3.3 9.9a1 1 0 1 1 1.4-1.4l3.2 3.2 6.9-6.9a1 1 0 0 1 1.4 0Z"/></svg>
          Save
        </button>
        <button class="delete btn-danger-sm">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M6 7h2v9H6V7Zm6 0h-2v9h2V7ZM4 5h12v2H4V5Zm2-2h8v2H6V3Zm1 16a2 2 0 0 1-2-2V7h10v10a2 2 0 0 1-2 2H7Z"/></svg>
          Delete
        </button>
      </div>
    </div>
    <div class="mt-3">
      <div class="text snippet-body collapsed"></div>
      <button class="toggle btn-ghost-sm mt-2">Expand</button>
    </div>
    <div class="mt-3">
      <ul class="transcript-segments space-y-2"></ul>
    </div>
    <div class="mt-3 grid grid-cols-[1fr_auto] gap-2">
      <input class="tags tags-input" placeholder="#research, #quote" />
      <button class="autotag btn-ghost-sm" title="Auto-generate tags">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2l1.6 3.9 4.2.3-3.2 2.6 1 4-3.6-2.2L6.4 13l1-4L4.2 6.2l4.2-.3L10 2Z"/></svg>
        Auto
      </button>
    </div>
    <textarea class="note note-input mt-2" rows="2" placeholder="Why this matters"></textarea>
  `;
  return li;
}

function renderAutoCaptureItem(item) {
  const li = document.createElement("li");
  li.className = "snippet-card shadow-sm rounded-lg bg-white p-3";
  li.innerHTML = `
    <div class="snippet-head flex items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <a class="title snippet-title font-semibold text-gray-900 hover:underline block truncate" target="_blank"></a>
        <div class="source flex items-center gap-1 text-xs text-gray-500 mt-0.5"></div>
        <div class="createdAt snippet-meta text-xs text-gray-500 mt-0.5"></div>
      </div>
      <div class="shrink-0 flex items-center gap-2">
        <button class="delete btn-danger-sm">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M6 7h2v9H6V7Zm6 0h-2v9h2V7ZM4 5h12v2H4V5Zm2-2h8v2H6V3Zm1 16a2 2 0 0 1-2-2V7h10v10a2 2 0 0 1-2 2H7Z"/></svg>
          Delete
        </button>
      </div>
    </div>
  `;

  li.dataset.id = item.id;

  li.querySelector(".title").textContent = item.title || "(untitled)";
  li.querySelector(".title").href = item.url || "#";
  li.querySelector(".createdAt").textContent = new Date(
    item.captured_at || item.capturedAt
  ).toLocaleString();

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

  els.autoCaptureList.prepend(li);
}

function renderTranscriptItem(item) {
  const li = createSnippetCardTemplate();

  li.dataset.id = item.id;

  li.querySelector(".title").textContent = item.title || "(untitled)";
  li.querySelector(".title").href = item.url || "#";
  li.querySelector(".createdAt").textContent = new Date(
    item.captured_at || item.capturedAt
  ).toLocaleString();

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

  const segmentsEl = li.querySelector(".transcript-segments");
  if (item.segments && Array.isArray(item.segments)) {
    for (const segment of item.segments) {
      const segmentLi = document.createElement("li");
      segmentLi.className = "transcript-segment p-3 border-b border-gray-200 bg-gray-50 rounded-lg mb-2 shadow-md";
      segmentLi.innerHTML = `<div class="flex items-start gap-3"><div class="timestamp font-semibold text-indigo-600 w-24">${segment.ts}</div> <div class="text text-gray-700 flex-1">${segment.text}</div></div>`;
      segmentsEl.appendChild(segmentLi);
    }
  }

  const textEl = li.querySelector(".text");
  textEl.style.display = "none";

  const toggleButton = li.querySelector(".toggle");
  toggleButton.textContent = "Show Transcript";
  toggleButton.addEventListener("click", () => {
    if (segmentsEl.style.display === "none") {
      segmentsEl.style.display = "block";
      toggleButton.textContent = "Hide Transcript";
    } else {
      segmentsEl.style.display = "none";
      toggleButton.textContent = "Show Transcript";
    }
  });

  segmentsEl.style.display = "none";

  return li;
}

function renderLinkedInProfile(item) {
  const li = createSnippetCardTemplate();

  li.dataset.id = item.id;

  li.querySelector(".title").textContent = item.title || "(untitled)";
  li.querySelector(".title").href = item.url || "#";
  li.querySelector(".createdAt").textContent = new Date(
    item.captured_at || item.capturedAt
  ).toLocaleString();

  const sourceEl = li.querySelector(".source");
  sourceEl.textContent = "💼 " + (new URL(item.url).hostname || "");

  const textEl = li.querySelector(".text");
  const data = item.data;
  let html = '';
  console.log('Popup UI: Rendering LinkedIn Location -', data.location);

  if (data.name) {
    html += `<h3 class="text-lg font-bold">${data.name}</h3>`;
  }
  if (data.headline) {
    html += `<p class="text-md text-gray-600">${data.headline}</p>`;
  }
  if (data.location) {
    html += `<p class="text-sm text-gray-500">${data.location}</p>`;
  }
  if (data.about) {
    html += `<div class="mt-4">
               <h4 class="font-semibold">About</h4>
               <p class="text-sm">${data.about}</p>
             </div>`;
  }
  if (data.experience && data.experience.length > 0) {
    html += `<div class="mt-4">
               <h4 class="font-semibold">Experience</h4>
               <ul class="list-disc list-inside">`;
    data.experience.forEach(exp => {
      html += `<li class="text-sm mb-2">
                 <p class="font-medium">${exp.title} at ${exp.company}</p>
                 <p class="text-gray-600">${exp.dates} (${exp.duration})</p>`;
      if (exp.roleLocation) {
        html += `<p class="text-gray-600">${exp.roleLocation}</p>`;
      }
      if (exp.description) {
        html += `<p class="text-gray-700 mt-1">${exp.description}</p>`;
      }
      html += `</li>`;
    });
    html += `</ul></div>`;
  }
  if (data.education && data.education.length > 0) {
    html += `<div class="mt-4">
               <h4 class="font-semibold">Education</h4>
               <ul class="list-disc list-inside">`;
    data.education.forEach(edu => {
      html += `<li class="text-sm">${edu}</li>`;
    });
    html += `</ul></div>`;
  }

  textEl.innerHTML = html;

  li.querySelector(".transcript-segments").style.display = "none";

  return li;
}

function renderItem(item) {
  console.log('Popup UI: Rendering item with type -', item.type, item); // Add this line
  if (item.type === 'TRANSCRIPT_CAPTURED') {
    const li = renderTranscriptItem(item);
    els.list.prepend(li);
    return;
  }
  if (item.type === 'linkedin_profile') {
    const li = renderLinkedInProfile(item);
    els.list.prepend(li);
    return;
  }
  const li = createSnippetCardTemplate();

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

  li.querySelector(".transcript-segments").style.display = "none";

  els.list.prepend(li);
}



async function load() {
  const items = await getAll("snippets");
  console.log("Popup UI: Snippets from storage:", items); // Add this line
  els.list.innerHTML = "";
  if (!items || items.length === 0) {
    els.empty.style.display = "block";
  } else {
    els.empty.style.display = "none";
    items.reverse().forEach(renderItem);
  }

  const autoCapturedItems = await getAll("auto_captured_snippets");
  console.log("Popup UI: Auto Captured Snippets from storage:", autoCapturedItems); // Add this line
  els.autoCaptureList.innerHTML = "";
  if (autoCapturedItems && autoCapturedItems.length > 0) {
    autoCapturedItems.reverse().forEach(renderAutoCaptureItem);
  }
} // Closing brace for load() function

function isYouTubeWatch(url) {
  try {
    const u = new URL(url);
    return u.hostname.includes("youtube.com") && u.pathname === "/watch";
  } catch {
    return false;
  }
}

function isLinkedInProfilePage(url) {
  // Temporarily force regular capture for testing
  return false;
  try {
    const u = new URL(url);
    return u.hostname.includes("linkedin.com") && u.pathname.startsWith("/in/");
  } catch {
    return false;
  }
}

els.capture.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !isInjectable(tab.url)) {
    return;
  }

  if (isLinkedInProfilePage(tab.url)) {
    try {
      // Send message to background script to trigger LinkedIn capture
      await chrome.runtime.sendMessage({ type: "TRIGGER_LINKEDIN_CAPTURE", tabId: tab.id });
      // The background script will handle saving and rendering
    } catch (e) {
      console.error("LinkedIn capture failed:", e);
    }
  } else {
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
  console.log("message received in popup:", msg);
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
        renderItem(newSnippet);
        els.empty.style.display = "none";
      }
    });
  }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && (changes.snippets || changes.auto_captured_snippets)) {
    load();
  }
});

els.autoCaptureList.addEventListener("click", async (e) => {
  const deleteBtn = e.target.closest(".delete");
  if (deleteBtn) {
    const li = deleteBtn.closest("li");
    const id = li.dataset.id;
    if (id) {
      await removeById(id, "auto_captured_snippets");
      li.remove();
      const items = await getAll("auto_captured_snippets");
      if (items.length === 0) {
        // You might want to show an empty state message here
      }
    }
  }
});

els.list.addEventListener("click", async (e) => {
  const deleteBtn = e.target.closest(".delete");
  const saveBtn = e.target.closest(".save");
  if (deleteBtn) {
    const li = deleteBtn.closest("li");
    const id = li.dataset.id;
    if (id) {
      await removeById(id);
      li.remove();
      await load(); // Explicitly reload the UI after deletion
    }
  } else if (saveBtn) {
    // Save this single snippet into local storage 'saved_snippets' as-is
    const li = saveBtn.closest("li");
    const id = li.dataset.id;
    if (id) {
      const allItems = await getAll();
      const snippet = allItems.find(item => item.id === id);
      if (snippet) {
        const saved = await addSavedOne(snippet);
        alert(saved ? "Snippet saved." : "Snippet already saved.");
      }
    }
  }
});

els.clearAll.addEventListener("click", async () => {
  if (!confirm("Delete all saved snippets?")) return;
  await chrome.storage.local.set({ snippets: [] });
  await load();
});

// Save All: persist all snippets into local storage 'saved_snippets' as-is
els.saveAll.addEventListener("click", async () => {
  const items = await getAll();
  if (!items || items.length === 0) {
    alert("No snippets to save.");
    return;
  }
  els.saveAll.disabled = true;
  els.saveAll.textContent = "Saving...";
  try {
    const savedCount = await addSavedMany(items);
    const skipped = items.length - savedCount;
    alert(`Saved ${savedCount} snippet(s)${skipped ? `, ${skipped} already saved` : ""}.`);
  } finally {
    els.saveAll.disabled = false;
    els.saveAll.textContent = "Save All";
  }
});

document.addEventListener('DOMContentLoaded', function() {
  load();

  els.profileButton.addEventListener("click", () => {
    els.profileMenu.style.display = els.profileMenu.style.display === "block" ? "none" : "block";
  });

  els.snippetsTab.addEventListener("click", () => {
    els.snippetsTab.classList.add("active");
    els.autoCaptureTab.classList.remove("active");
    els.snippetsPanel.classList.add("active");
    els.autoCapturePanel.classList.remove("active");
  });

  els.autoCaptureTab.addEventListener("click", () => {
    els.autoCaptureTab.classList.add("active");
    els.snippetsTab.classList.remove("active");
    els.autoCapturePanel.classList.add("active");
    els.snippetsPanel.classList.remove("active");
  });

  els.settingsButton.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  els.logoutButton.addEventListener("click", () => {
    alert("Logout functionality not implemented yet.");
  });

  els.autoCaptureToggle.addEventListener("change", (e) => {
    chrome.storage.local.set({ autoCapture: e.target.checked });
    chrome.runtime.sendMessage({ type: e.target.checked ? "START_AUTO_CAPTURE" : "STOP_AUTO_CAPTURE" });
  });

  // Set initial active tab and panel
  setActiveTabAndPanel(els.snippetsTab, els.snippetsPanel);
});

els.summarizeAction.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !isInjectable(tab.url)) {
    return;
  }

  try {
    let res = await chrome.tabs.sendMessage(tab.id, { type: "PAGE_EXTRACT" });
    if (res && res.ok) {
      const summary = await summarizeText(res.payload.text);
      els.summaryText.textContent = summary;
      els.summaryContainer.style.display = "block";
    } else {
      console.error("Capture for summarization failed", res?.error);
    }
  } catch (e) {
    if (e.message.includes("Receiving end does not exist")) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
      const res = await chrome.tabs.sendMessage(tab.id, { type: "PAGE_EXTRACT" });
      if (res && res.ok) {
        const summary = await summarizeText(res.payload.text);
        els.summaryText.textContent = summary;
        els.summaryContainer.style.display = "block";
      }
    } else {
      console.error("Capture for summarization failed", e);
    }
  }
});

function setActiveTabAndPanel(activeTab, activePanel) {
  // Remove active class from all tabs and panels
  els.snippetsTab.classList.remove("active");
  els.autoCaptureTab.classList.remove("active");
  els.snippetsPanel.classList.remove("active");
  els.autoCapturePanel.classList.remove("active");

  // Add active class to the specified tab and panel
  activeTab.classList.add("active");
  activePanel.classList.add("active");
}