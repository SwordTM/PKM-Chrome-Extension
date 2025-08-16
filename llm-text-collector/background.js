chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "yt-bookmark",
    title: "YouTube: Bookmark timestamp",
    contexts: ["page"],
    documentUrlPatterns: ["https://www.youtube.com/watch*"]
  });
  chrome.contextMenus.create({
    id: "yt-caption-now",
    title: "YouTube: Capture caption @ now (±20s)",
    contexts: ["page"],
    documentUrlPatterns: ["https://www.youtube.com/watch*"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === "yt-bookmark") {
    chrome.tabs.sendMessage(tab.id, { type: "YT_BOOKMARK" });
  }
  if (info.menuItemId === "yt-caption-now") {
    chrome.tabs.sendMessage(tab.id, { type: "YT_CAPTURE_CAPTION", windowSec: 20 });
  }
});
