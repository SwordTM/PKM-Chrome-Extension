// selection_ui.js

let selectionButton = null;

function createSelectionButton() {
  if (selectionButton) {
    selectionButton.remove();
  }

  selectionButton = document.createElement('button');
  selectionButton.id = 'llm-inbox-selection-button';
  selectionButton.textContent = 'Save Selection';
  selectionButton.style.position = 'absolute';
  selectionButton.style.zIndex = '99999'; // Ensure it's on top
  selectionButton.style.background = '#4CAF50';
  selectionButton.style.color = 'white';
  selectionButton.style.border = 'none';
  selectionButton.style.padding = '5px 10px';
  selectionButton.style.borderRadius = '3px';
  selectionButton.style.cursor = 'pointer';
  selectionButton.style.fontSize = '12px';
  selectionButton.style.display = 'none'; // Hidden by default
  selectionButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';

  document.body.appendChild(selectionButton);

  selectionButton.addEventListener('click', () => {
    const selection = window.getSelection();
    if (selection.toString().length > 0) {
      const selectedText = selection.toString();
      const url = window.location.href;
      const title = document.title;

      chrome.runtime.sendMessage({
        type: 'SAVE_SELECTION', // Reusing existing message type
        payload: {
          title: title,
          url: url,
          text: selectedText,
          source_type: 'web'
        }
      }, function handleResponse(response) { // Use a named function for retry
        if (chrome.runtime.lastError) {
          const errorMessage = chrome.runtime.lastError.message;
          console.error("Error sending message:", errorMessage);

          // Retry if context invalidated (common for service workers)
          if (errorMessage.includes("Extension context invalidated")) {
            console.warn("Service worker inactive, retrying message...");
            // Small delay before retry
            setTimeout(() => {
              chrome.runtime.sendMessage({
                type: 'SAVE_SELECTION',
                payload: {
                  title: title,
                  url: url,
                  text: selectedText,
                  source_type: 'web'
                }
              }, handleResponse); // Call the same handler for retry
            }, 100); // 100ms delay
          }
        } else if (response && response.ok) {
          console.log('Selection saved successfully!');
          // Optionally, provide visual feedback to the user
        } else {
          console.error('Failed to save selection or response not ok.');
        }
      });
    }
    selectionButton.style.display = 'none'; // Hide button after saving
  });
}

function showSelectionButton() {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (selectedText.length > 0) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Position the button slightly above the selection
    selectionButton.style.left = `${rect.left + window.scrollX}px`;
    selectionButton.style.top = `${rect.top + window.scrollY - selectionButton.offsetHeight - 5}px`;
    selectionButton.style.display = 'block';
  } else {
    selectionButton.style.display = 'none';
  }
}

document.addEventListener('mouseup', (event) => {
  // Ignore clicks on the button itself
  if (selectionButton && selectionButton.contains(event.target)) {
    return;
  }

  // Give a small delay to ensure selection is stable
  setTimeout(() => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText.length > 0) {
      showSelectionButton();
    } else {
      if (selectionButton) {
        selectionButton.style.display = 'none';
      }
    }
  }, 50);
});

// Initialize the button
createSelectionButton();
