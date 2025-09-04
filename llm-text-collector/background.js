import { addOne } from "./storage.js";

const tabActivatedListener = (activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url && !tab.url.startsWith('chrome://') && tab.url !== "https://www.youtube.com/") {
      console.log("Injecting content script into active tab:", tab.url);
      chrome.scripting.executeScript({
        target: { tabId: activeInfo.tabId },
        files: ['content.js']
      }, () => {
        chrome.tabs.sendMessage(activeInfo.tabId, { type: "PAGE_EXTRACT" }, (res) => {
          if (res && res.ok) {
            addOne(res.payload, "auto_captured_snippets");
          }
        });
      });
    }
  });
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("message received in background:", message);
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
  } else if (message.type === "LINKEDIN_PROFILE_PAGE") {
    // This is for automatic capture when navigating to a LinkedIn profile
    (async () => {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: sender.tab.id },
          files: ["linkedin.js"],
        });
        const results = await chrome.scripting.executeScript({
          target: { tabId: sender.tab.id },
          function: () => getLinkedInProfileData(),
        });
        if (results && results.length > 0) {
          const linkedInData = results[0].result;
          const payload = {
            type: 'linkedin_profile',
            source_type: 'linkedin',
            url: sender.tab.url,
            title: linkedInData.name ? `${linkedInData.name}'s Profile` : 'LinkedIn Profile',
            captured_at: new Date().toISOString(),
            data: linkedInData,
          };
          addOne(payload, 'auto_captured_snippets');
          addOne(payload);
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false, error: "No data extracted" });
        }
      } catch (error) {
        console.error("Error getting LinkedIn profile data:", error);
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  } else if (message.type === "TRIGGER_LINKEDIN_CAPTURE") {
    // This is for manual capture via the "Capture Page Extract" button
    (async () => {
      const tabId = message.tabId; // Get tabId from the message
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ["linkedin.js"],
        });
        const results = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          function: () => getLinkedInProfileData(),
        });
        if (results && results.length > 0) {
          const linkedInData = results[0].result;
          const payload = {
            type: 'linkedin_profile',
            source_type: 'linkedin',
            url: (await chrome.tabs.get(tabId)).url, // Get URL from tab object
            title: linkedInData.name ? `${linkedInData.name}'s Profile` : 'LinkedIn Profile',
            captured_at: new Date().toISOString(),
            data: linkedInData,
          };
          addOne(payload, 'auto_captured_snippets');
          addOne(payload);
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false, error: "No data extracted" });
        }
      } catch (error) {
        console.error("Error getting LinkedIn profile data:", error);
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  } else if (message.type === 'START_AUTO_CAPTURE') {
    chrome.tabs.onActivated.addListener(tabActivatedListener);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        tabActivatedListener({ tabId: tabs[0].id });
      }
    });
  } else if (message.type === 'STOP_AUTO_CAPTURE') {
    chrome.tabs.onActivated.removeListener(tabActivatedListener);
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