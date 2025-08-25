import { showSelectionButton, hideSelectionButton } from "./selection.js";

const waitFor = (sel, { root = document, timeout = 10000, poll = 100 } = {}) =>
  new Promise((res, rej) => {
    const t0 = performance.now();
    (function tick(){
      const el = root.querySelector(sel);
      if (el) return res(el);
      if (performance.now() - t0 > timeout) return rej(new Error("Timeout: " + sel));
      setTimeout(tick, poll);
    })();
  });

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
  let youtubeButton = null;

  function isYouTubeWatchPage() {
    return location.hostname.includes("youtube.com") && location.pathname.includes("/watch");
  }

  function handleSelectionChange() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (isYouTubeWatchPage()) {
      if (!youtubeButton) {
        injectYouTubeButton();
      }
      youtubeButton.style.display = "block";
      youtubeButton.textContent = "Capture Transcript";
      youtubeButton.onclick = handleTranscriptCapture;
      hideSelectionButton();
    } else {
      if (selectedText) {
        showSelectionButton(selection);
        hideYouTubeButton();
      } else {
        hideSelectionButton();
      }
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
    const waitFor = (selector, { root = document, timeout = 10000, poll = 100 } = {}) =>
    new Promise((resolve, reject) => {
      const t0 = performance.now();
      const tick = () => {
        const el = root.querySelector(selector);
        if (el) return resolve(el);
        if (performance.now() - t0 > timeout) return reject(new Error(`Timeout waiting for ${selector}`));
        setTimeout(tick, poll,);
      };
      tick();
    });

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

  document.addEventListener("selectionchange", handleSelectionChange);
  document.addEventListener("mousedown", (event) => {
    // Check if the click target is the selection button itself
    // or if there's no selection button (meaning it's hidden or not yet created)
    if (event.target.id !== 'llm-inbox-selection-btn' && event.target.closest('#llm-inbox-selection-btn') === null) {
      hideSelectionButton();
    }
  });

  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(handleSelectionChange, 600);
    }
  }).observe(document, { subtree: true, childList: true });

  handleSelectionChange();
})();