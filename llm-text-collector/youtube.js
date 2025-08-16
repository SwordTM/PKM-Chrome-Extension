// Util: parse VTT into cues
function parseVTT(vtt) {
  const cues = [];
  const lines = vtt.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("-->")) {
      const [start, end] = lines[i].split("-->").map(s => s.trim());
      let text = "";
      i++;
      while (i < lines.length && lines[i].trim() !== "") {
        text += (text ? "\n" : "") + lines[i].trim();
        i++;
      }
      cues.push({ start: toSec(start), end: toSec(end), text });
    }
  }
  return cues;
}
function toSec(ts) {
  // 00:01:23.456
  const m = ts.match(/(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)/);
  if (!m) return 0;
  const h = Number(m[1] || 0), mm = Number(m[2]), ss = Number(m[3]);
  return h * 3600 + mm * 60 + ss;
}
function currentVideo() {
  const video = document.querySelector("video");
  return video && !isNaN(video.currentTime) ? video : null;
}
function videoInfo() {
  const title =
    document.querySelector("h1.title yt-formatted-string")?.textContent?.trim() ||
    document.title.replace(" - YouTube", "").trim();
  const url = location.href;
  return { title, url };
}

// Try to find an active caption track URL from the page.
function getCaptionTrackUrl() {
  // Pull from ytInitialPlayerResponse if available
  try {
    const ytd = window.ytInitialPlayerResponse
      || (window.ytplayer && window.ytplayer.config && window.ytplayer.config.args && JSON.parse(window.ytplayer.config.args.player_response));
    const tracks = ytd?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (tracks?.length) {
      // Prefer English or auto-generated if nothing else
      const preferred = tracks.find(t => t.languageCode?.startsWith("en")) || tracks[0];
      // request VTT format if possible
      const url = preferred.baseUrl + (preferred.baseUrl.includes("?") ? "&" : "?") + "fmt=vtt";
      return url;
    }
  } catch (e) {}
  return null;
}

async function fetchCaptionWindow(seconds, windowSec = 20) {
  const v = currentVideo();
  if (!v) throw new Error("No video element found.");
  const trackUrl = getCaptionTrackUrl();
  if (!trackUrl) throw new Error("No caption track found on this video.");
  const res = await fetch(trackUrl, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch captions.");
  const vtt = await res.text();
  const cues = parseVTT(vtt);
  const from = seconds - windowSec;
  const to = seconds + windowSec;
  const snippet = cues
    .filter(c => c.end >= from && c.start <= to)
    .map(c => c.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return snippet || "(no caption text in this window)";
}

// Save to your existing storage schema
async function saveSnippet(snippet) {
  // You likely already have a storage helper; here’s a minimal example:
  const key = "llm_inbox";
  const items = (await chrome.storage.local.get(key))[key] || [];
  items.unshift(snippet);
  await chrome.storage.local.set({ [key]: items });
}

async function bookmarkTimestamp() {
  const v = currentVideo();
  const { title, url } = videoInfo();
  const t = Math.floor(v?.currentTime || 0);
  const bookmarkedUrl = new URL(url);
  bookmarkedUrl.searchParams.set("t", `${t}s`);
  await saveSnippet({
    type: "youtube_bookmark",
    title,
    url: bookmarkedUrl.toString(),
    createdAt: new Date().toISOString(),
    meta: { seconds: t }
  });
}

async function captureCaptionNow(windowSec) {
  const v = currentVideo();
  const { title, url } = videoInfo();
  const t = Math.floor(v?.currentTime || 0);
  const text = await fetchCaptionWindow(t, windowSec);
  const bookmarkedUrl = new URL(url);
  bookmarkedUrl.searchParams.set("t", `${t}s`);
  await saveSnippet({
    type: "youtube_caption",
    title,
    url: bookmarkedUrl.toString(),
    text,
    createdAt: new Date().toISOString(),
    meta: { seconds: t, windowSec }
  });
}

chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  (async () => {
    if (msg.type === "YT_BOOKMARK") {
      const t = nowSec();
      const u = new URL(location.href); u.searchParams.set("t", `${t}s`);
      await saveSnippet({
        type:"youtube_bookmark",
        title: title(),
        url: u.toString(),
        createdAt: new Date().toISOString(),
        meta:{ seconds: t }
      });
    }
    if (msg.type === "YT_CAPTURE_CAPTION") {
      const t = nowSec();
      const text = await fetchCaptionWindow(t, msg.windowSec ?? 20);
      const u = new URL(location.href); u.searchParams.set("t", `${t}s`);
      await saveSnippet({
        type:"youtube_caption",
        title: title(),
        url: u.toString(),
        text,
        createdAt: new Date().toISOString(),
        meta:{ seconds: t, windowSec: msg.windowSec ?? 20 }
      });
    }
    if (msg.type === "YT_GET_META") {
      sendResponse({ title: title(), url: location.href, seconds: nowSec() });
      return; // must return to keep port alive only if async — we already responded sync
    }
  })().catch(console.error);

  // Return true if we *will* async sendResponse later (not needed here).
  return false;
});
