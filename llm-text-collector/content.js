chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "PAGE_EXTRACT") {
    try {
      const payload = {
        title: document.title,
        url: location.href,
        text: document.body?.innerText?.slice(0, 20000) || "",
        captured_at: new Date().toISOString(),
      };
      sendResponse({ ok: true, payload });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  }
});

(function () {
  if (window.llmTextCollectorContentLoaded) {
    return;
  }
  window.llmTextCollectorContentLoaded = true;

  let youtubeButton = null;

  function isYouTubeWatchPage() {
    return location.hostname.includes("youtube.com") && location.pathname.includes("/watch");
  }

  function manageYouTubeButtonVisibility() {
    if (isYouTubeWatchPage()) {
      injectYouTubeButton();
      youtubeButton.style.display = "block";
      youtubeButton.textContent = "Capture Transcript";
      youtubeButton.onclick = handleTranscriptCapture;
    } else {
      hideYouTubeButton();
    }
  }

  function injectYouTubeButton() {
    if (document.getElementById("llm-inbox-youtube-btn")) {
      youtubeButton = document.getElementById("llm-inbox-youtube-btn");
      return;
    }
    youtubeButton = document.createElement("button");
    youtubeButton.id = "llm-inbox-youtube-btn";
    Object.assign(youtubeButton.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      zIndex: 999999,
      padding: "10px 14px",
      borderRadius: "999px",
      border: "none",
      fontSize: "14px",
      cursor: "pointer",
      boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
      background: "#fff",
      display: "none",
    });
    youtubeButton.addEventListener("mouseenter", () => (youtubeButton.style.boxShadow = "0 10px 26px rgba(0,0,0,0.25)"));
    youtubeButton.addEventListener("mouseleave", () => (youtubeButton.style.boxShadow = "0 6px 20px rgba(0,0,0,0.2)"));
    document.documentElement.appendChild(youtubeButton);
  }

  function hideYouTubeButton() {
    if (youtubeButton) {
      youtubeButton.style.display = "none";
    }
  }

  async function handleTranscriptCapture() {
    if (!youtubeButton) return; // Ensure button exists
    youtubeButton.disabled = true;
    const original = youtubeButton.textContent;
    const set = (t) => (youtubeButton.textContent = t);

    try {
      set("Opening transcript…");
      // Try sending message first
      await chrome.runtime.sendMessage({ type: "YT_SCRAPE_TRANSCRIPT" });
    } catch (e) {
      if (e.message.includes("Receiving end does not exist")) {
        // If receiving end does not exist, inject youtube.js and retry
        await chrome.scripting.executeScript({
          target: { tabId: await getCurrentTabId() }, // Need to get current tab ID
          files: ["youtube.js"],
        });
        await chrome.runtime.sendMessage({ type: "YT_SCRAPE_TRANSCRIPT" });
      } else {
        console.error("Transcript scrape failed (initial send):", e);
        set("Failed (check console)");
        return; // Exit if initial send fails for other reasons
      }
    }

    // Continue with the rest of the logic after successful message send/injection
    try {
      const panel = await openTranscriptFromDescription();

      set("Parsing…");
      await sleep(200);
      const segments = extractSegmentsNoScroll(panel);

      const meta = getVideoMeta();
      const payload = {
        type: "TRANSCRIPT_CAPTURED",
        capturedAt: new Date().toISOString(),
        url: location.href,
        ...meta,
        segments,
      };

      await chrome.runtime.sendMessage(payload);
      set(segments.length ? `Captured ${segments.length} lines ✓` : "No segments found");
    } catch (err) {
      console.warn("[YT Transcript Capture] Error:", err);
      set("Failed (check console)");
    } finally {
        setTimeout(() => {
            set(original);
            youtubeButton.disabled = false;
        }, 3000);
    }
  }

  // Helper function to get current tab ID
  async function getCurrentTabId() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab.id;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const parseTimestamp = (ts) => {
    if (!ts) return 0;
    const parts = ts.trim().split(":").map(Number);
    if (parts.some(Number.isNaN)) return 0;
    return parts.reduce((acc, v) => acc * 60 + v, 0);
  };

  const getVideoMeta = () => {
    const url = new URL(location.href);
    const videoId = url.searchParams.get("v") || location.pathname.replace("/watch/", "");
    const title =
      document.querySelector('h1.ytd-watch-metadata')?.innerText?.trim() ||
      document.title.replace(" - YouTube", "").trim();
    return { videoId, title };
  };
    

  const openTranscriptFromDescription = async () => {
    const alreadyOpen = document.querySelector(
      'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-transcript"][visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"]'
    );
    if (alreadyOpen) return alreadyOpen;
    const roots = [
      document.querySelector('ytd-watch-metadata'),
      document.querySelector('#below'),
      document.querySelector('ytd-expandable-metadata-renderer'),
      document,
    ].filter(Boolean);
    let toggle = null;
    const matchesTranscript = (el) => /transcript/i.test((el.innerText || el.getAttribute('aria-label') || '').trim());
    for (const root of roots) {
      const candidates = Array.from(
        root.querySelectorAll(
          `
            button, a, yt-button-shape, tp-yt-paper-button, tp-yt-paper-item,
            ytd-rich-metadata-row-renderer a, .yt-spec-button-shape-next
          `.replace(/\s+/g, ' ')
        )
      );
      toggle = candidates.find(matchesTranscript);
      if (toggle) break;
    }
    if (!toggle) throw new Error("Couldn't find the Transcript toggle in the description area.");
    (toggle.querySelector('button, a') || toggle).click();
    const panel = await waitFor('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-transcript"]');
    await sleep(300);
    return panel;
  };

  async function extractSegmentsNoScroll(panel){
    // Wait until at least one segment appears
    await waitFor("ytd-transcript-segment-renderer, yt-transcript-segment-renderer", { root: panel });
    
    const nodes = Array.from(panel.querySelectorAll("ytd-transcript-segment-renderer, yt-transcript-segment-renderer"));
    const getTs = (el) => {
      // Try common timestamp locations
      const tsEl =
        el.querySelector('.segment-timestamp') ||
        el.querySelector('yt-formatted-string[slot="segment-timestamp"]') ||
        el.querySelector('[class*="segment-timestamp"]') ||
        el.querySelector('[aria-label][role="text"]'); // rare fallback
      return (tsEl?.textContent || "").trim();
    };

    const getText = (el) => {
      // Try all known locations; prefer textContent over innerText
      const tEl =
        el.querySelector('.segment-text') ||
        el.querySelector('yt-formatted-string[slot="segment-text"]') ||
        el.querySelector('yt-formatted-string[class*="segment-text"]') ||
        el.querySelector('yt-attributed-string') ||
        el.querySelector('[class*="segment"] [dir="auto"]') ||
        el; // last resort

      return (tEl?.textContent || "").replace(/\s+/g, " ").trim();
    };

    const parseTs = (ts) => ts.split(":").map(Number).reduce((a, v) => a * 60 + (isNaN(v) ? 0 : v), 0);

    const segments = [];
    for (const node of nodes) {
      const ts = getTs(node);
      const text = getText(node);
      if (!ts || !text) continue; // skip empties
      segments.push({ ts, seconds: parseTs(ts), text });
    }
    return segments;
  };

    document.addEventListener("DOMContentLoaded", manageYouTubeButtonVisibility);
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(manageYouTubeButtonVisibility, 600);
    }
  }).observe(document, { subtree: true, childList: true });

  manageYouTubeButtonVisibility(); // Initial call

  // Selection handling
  document.addEventListener("mouseup", () => {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText.length > 0) {
      showSelectionButton(window.getSelection());
    } else {
      hideSelectionButton();
    }
  });

  let selectionButton = null;

  function cleanup() {
    hideSelectionButton();
    // Potentially remove other listeners or UI elements here in the future
  }

  async function handleSelectionCapture(selectionText) {
    if (!selectionButton) return;

    selectionButton.disabled = true;
    const originalText = selectionButton.textContent;
    selectionButton.textContent = "";
    selectionButton.classList.add("loading-dots");

    try {
      await chrome.runtime.sendMessage({ type: "PING" });
    } catch (e) {
      cleanup();
      return;
    }

    selectionButton.classList.remove("loading-dots");
    selectionButton.textContent = "Saving...";

    const payload = {
      type: "SAVE_SELECTION",
      payload: {
        text: selectionText,
        title: document.title,
        url: location.href,
        captured_at: new Date().toISOString(),
        source_type: "web_selection",
      },
    };

    try {
      await chrome.runtime.sendMessage(payload);
      selectionButton.textContent = "Saved ✓";
    } catch (e) {
      if (e.message.includes("Extension context invalidated")) {
        cleanup();
      } else {
        console.error("Error saving selection:", e);
        selectionButton.textContent = "Error!";
      }
    } finally {
      setTimeout(() => {
        if (selectionButton && !selectionButton.classList.contains("loading-dots")) {
          selectionButton.classList.remove("loading-dots");
          selectionButton.textContent = originalText;
          selectionButton.disabled = false;
          hideSelectionButton();
        }
      }, 2000);
    }
  }

  function showSelectionButton(selection) {
    if (!selectionButton) {
      selectionButton = document.createElement("button");
      selectionButton.id = "llm-inbox-selection-btn";
      document.body.appendChild(selectionButton);
      Object.assign(selectionButton.style, {
        position: "absolute",
        zIndex: 999999,
        padding: "4px 8px",
        borderRadius: "4px",
        border: "1px solid #4CAF50",
        fontSize: "12px",
        cursor: "pointer",
        background: "#4CAF50",
        color: "#ffffff",
        boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
        display: "block",
      });
      selectionButton.addEventListener("mouseenter", () => (selectionButton.style.background = "#45a049"));
      selectionButton.addEventListener("mouseleave", () => (selectionButton.style.background = "#4CAF50"));
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    selectionButton.style.top = `${window.scrollY + rect.bottom + 5}px`;
    selectionButton.style.left = `${window.scrollX + rect.left}px`;
    selectionButton.textContent = "Save Selection";
    selectionButton.onclick = () => handleSelectionCapture(selection.toString().trim());
    selectionButton.style.display = "block";
  }

  function hideSelectionButton() {
    if (selectionButton) {
      selectionButton.style.display = "none";
    }
  }

})();