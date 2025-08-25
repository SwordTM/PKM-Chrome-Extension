const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const waitFor = (selector, { root = document, timeout = 10000, poll = 100 } = {}) =>
  new Promise((resolve, reject) => {
    const t0 = performance.now();
    const tick = () => {
      const el = root.querySelector(selector);
      if (el) return resolve(el);
      if (performance.now() - t0 > timeout) return reject(new Error(`Timeout waiting for ${selector}`));
      setTimeout(tick, poll);
    };
    tick();
  });

async function handleScrapeTranscript(sendResponse) {
  try {
    // Try more robust selector for the "more actions" button
    let moreActionsButton = document.querySelector('button[aria-label="More actions"]');
    if (!moreActionsButton) {
      // Fallback to previous selector if aria-label not found
      moreActionsButton = document.querySelector('ytd-menu-renderer.ytd-video-primary-info-renderer > #button-shape > button');
    }

    if (!moreActionsButton) {
      throw new Error("More actions button not found.");
    }
    moreActionsButton.click();
    await waitFor('tp-yt-paper-listbox', { timeout: 2000 }); // Wait for the menu to appear

    // Find the "Show transcript" button by its text content using XPath
    const showTranscriptButton = document.evaluate(
      "//*[text()='Show transcript']",
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;


    if (!showTranscriptButton) {
      throw new Error("Show transcript button not found.");
    }
    showTranscriptButton.click();
    await waitFor('ytd-transcript-renderer', { timeout: 5000 }); // Wait for the transcript to load

    // Wait for the transcript renderer to appear
    const transcriptRenderer = document.querySelector('ytd-transcript-renderer');
    if (!transcriptRenderer) {
        throw new Error("Transcript renderer not found.");
    }

    // Get all the transcript segments
    let segmentElements = transcriptRenderer.querySelectorAll('ytd-transcript-segment-renderer');
    if (!segmentElements || segmentElements.length === 0) {
      // Try to expand the transcript if it's collapsed
      const expandButton = transcriptRenderer.querySelector('#expand-button');
      if (expandButton) {
        expandButton.click();
        await sleep(500);
        segmentElements = transcriptRenderer.querySelectorAll('ytd-transcript-segment-renderer');
      }
    }

    if (!segmentElements || segmentElements.length === 0) {
        throw new Error("Transcript segments not found even after trying to expand.");
    }

    const segments = Array.from(segmentElements).map(segment => {
      // More robust selectors for timestamp and text within segments
      const timestampEl = segment.querySelector('ytd-formatted-string.ytd-transcript-segment-renderer, .segment-timestamp');
      const textEl = segment.querySelector('yt-formatted-string.ytd-transcript-segment-renderer, .segment-text');
      const ts = timestampEl ? timestampEl.innerText.trim() : '';
      const text = textEl ? textEl.innerText.trim() : '';
      return { ts, text };
    });

    const payload = {
      type: "TRANSCRIPT_CAPTURED",
      title: document.title,
      url: location.href,
      segments: segments,
      capturedAt: new Date().toISOString(),
    };
    chrome.runtime.sendMessage(payload);
    sendResponse({ ok: true });

  } catch (error) {
    console.error("Transcript scraping failed:", error);
    const payload = {
      title: document.title,
      url: location.href,
      text: `(No transcript available for this video: ${error.message})`,
      source_type: "youtube_transcript",
    };
    chrome.runtime.sendMessage({ type: "SAVE_SNIPPET", payload });
    sendResponse({ ok: false, error: error.message });
  }
}

async function getCaptions(videoId, lang = "en") {
  const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
  const html = await response.text();
  const playerResponseRegex = /ytInitialPlayerResponse\s*=\s*({.+?});/;
  const match = html.match(playerResponseRegex);
  if (!match) {
    return null;
  }
  const playerResponse = JSON.parse(match[1]);
  const captionTracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!captionTracks) {
    return null;
  }
  const track = captionTracks.find((t) => t.languageCode === lang);
  if (!track) {
    return null;
  }
  const captionResponse = await fetch(track.baseUrl);
  const vtt = await captionResponse.text();
  return vtt;
}

function parseVTT(vtt) {
  const lines = vtt.split("\n");
  const cues = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("-->")) {
      const [start, end] = lines[i].split(" --> ").map((time) => {
        const parts = time.split(":");
        return +parts[0] * 3600 + +parts[1] * 60 + +parts[2];
      });
      cues.push({ start, end, text: lines[i + 1] });
      i++;
    }
  }
  return cues;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === "YT_SCRAPE_TRANSCRIPT") {
      await handleScrapeTranscript(sendResponse);
    }
  })();

  return true;
});

console.log("YouTube content script loaded.");