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
  console.log("Fetched HTML (in getCaptions):\n", html); // Debugging
  const playerResponseRegex = /ytInitialPlayerResponse\s*=\s*({.+?});(?:var|window|\n|$)/s; // More robust regex with 's' flag
  const match = html.match(playerResponseRegex);
  console.log("Regex Match (in getCaptions):\n", match); // Debugging
  if (!match) {
    return null;
  }
  let playerResponse;
  try {
    playerResponse = JSON.parse(match[1]);
    console.log("Parsed Player Response (in getCaptions):\n", playerResponse); // Debugging
  } catch (e) {
    console.error("Failed to parse player response JSON:", e);
    return null;
  }
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
  let i = 0;

  // Validate WEBVTT header
  if (!lines[i].startsWith("WEBVTT")) {
    return [];
  }
  i++; // Skip WEBVTT line

  while (i < lines.length) {
    if (lines[i].trim() === "") {
      i++; // Skip empty lines
      continue;
    }

    // Skip cue number if present
    if (!isNaN(parseInt(lines[i].trim()))) {
      i++;
    }

    if (lines[i] && lines[i].includes("-->")) {
      const [startStr, endStr] = lines[i].split(" --> ").map(s => s.trim());
      const parseTime = (timeStr) => {
        const parts = timeStr.split(/[:.]/).map(Number);
        let seconds = 0;
        if (parts.length === 4) { // HH:MM:SS.mmm
          seconds = parts[0] * 3600 + parts[1] * 60 + parts[2] + parts[3] / 1000;
        } else if (parts.length === 3) { // MM:SS.mmm or SS.mmm
          seconds = parts[0] * 60 + parts[1] + parts[2] / 1000;
        } else if (parts.length === 2) { // SS.mmm
          seconds = parts[0] + parts[1] / 1000;
        }
        return seconds;
      };

      const start = parseTime(startStr);
      const end = parseTime(endStr);

      i++; // Move to text line
      let textLines = [];
      while (i < lines.length && lines[i].trim() !== "" && !lines[i].includes("-->")) {
        textLines.push(lines[i].trim());
        i++;
      }
      cues.push({ start, end, text: textLines.join("\n") });
    } else {
      i++; // Skip unrecognized lines
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