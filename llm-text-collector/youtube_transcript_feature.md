```markdown
{
  "id": "youtube-transcript-scraping",
  "type": "feature",
  "title": "YouTube: Scrape full transcript from page",
  "description": "On YouTube /watch pages, this feature adds a button to the extension popup that, when clicked, automatically opens the video's transcript panel (if one is available), scrapes the entire text content, and saves it as a new snippet.",
  "acceptance_criteria": [
    "A new 'Scrape Full Transcript' button appears in the popup UI, but only on YouTube video watch pages.",
    "When clicked, the extension programmatically opens the transcript panel on the page.",
    "The full text from the transcript panel is extracted and saved as a single snippet to local storage.",
    "The new snippet appears immediately in the popup list.",
    "If the video does not have a transcript available, a snippet is still created with a fallback message like '(No transcript available for this video)'.",
    "The process should not require a page reload."
  ],
  "deliverables": [
    "popup.html",
    "popup.js",
    "youtube.js"
  ],
  "stack": {
    "frontend": { "runtime": "Chrome MV3" },
    "backend": { "kind": "local-only" },
    "notes": "The logic for revealing and scraping the transcript will reside entirely in the `youtube.js` content script."
  },
  "impl": {
    "frontend_steps": [
      "In `popup.html`, add a new button with the ID `ytScrapeTranscript`.",
      "In `popup.js`, add a click listener for the `#ytScrapeTranscript` button.",
      "This listener will send a message `{type: 'YT_SCRAPE_TRANSCRIPT'}` to the active tab's content script.",
      "The existing logic to handle a missing content script (inject `youtube.js` and retry) should be applied here as well."
    ],
    "backend_steps": [
      "In `youtube.js`, add a new message listener for the `YT_SCRAPE_TRANSCRIPT` message.",
      "The listener's logic will perform the following sequence of actions:",
      "1. Locate and click the '...' (more actions) button below the video player.",
      "2. From the menu that appears, locate and click the 'Show transcript' menu item.",
      "3. Wait for the transcript panel (`ytd-transcript-renderer`) to appear in the DOM.",
      "4. Once the panel is visible, query for all transcript cue elements (e.g., `ytd-transcript-segment-renderer`).",
      "5. Iterate through the cue elements, extract their text content, and join them into a single string.",
      "6. Construct a snippet payload containing the video title, URL, and the full transcript text.",
      "7. Send this payload back to the popup/background for saving via the `SAVE_SNIPPET` message.",
      "8. Ensure robust error handling for cases where any of the required buttons or panels cannot be found."
    ]
  },
  "codegen_hints": {
    "permissions": ["storage", "activeTab", "scripting"],
    "host_permissions": ["https://www.youtube.com/*"],
    "message_types": ["YT_SCRAPE_TRANSCRIPT"],
    "snippets": [
      {
        "path": "youtube.js",
        "lang": "js",
        "purpose": "A new async function `handleScrapeTranscript()` that uses `document.querySelector` with specific YouTube element IDs and classes to navigate the UI. It will need to handle the slight delay for the transcript panel to load, possibly using a `setTimeout` or `MutationObserver`."
      }
    ]
  },
  "tests": [
    "Open a YouTube video that is known to have a transcript. Click the 'Scrape Full Transcript' button. A new card should appear in the popup containing the complete transcript.",
    "Open a YouTube video that does not have a transcript (e.g., a live stream that just ended). Click the button. A card should appear with the fallback message.",
    "The functionality should not interfere with the existing bookmarking or caption-window features."
  ],
  "dependencies": ["capture-page-on-click"]
}
```