let selectionButton = null;

async function handleSelectionCapture(selectionText) {
  if (!selectionButton) return;
  selectionButton.disabled = true;
  const originalText = selectionButton.textContent;
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
    console.error("Error saving selection:", e);
    selectionButton.textContent = "Error!";
  } finally {
    setTimeout(() => {
      selectionButton.textContent = originalText;
      selectionButton.disabled = false;
      hideSelectionButton();
    }, 2000);
  }
}

export function showSelectionButton(selection) {
  if (!selectionButton) {
    selectionButton = document.createElement("button");
    selectionButton.id = "llm-inbox-selection-btn";
    document.body.appendChild(selectionButton);
    Object.assign(selectionButton.style, {
      position: "absolute",
      zIndex: 999999,
      padding: "4px 8px",
      borderRadius: "4px",
      border: "1px solid #ccc",
      fontSize: "12px",
      cursor: "pointer",
      background: "#f0f0f0",
      color: "#333",
      boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
      display: "block",
    });
    selectionButton.addEventListener("mouseenter", () => (selectionButton.style.background = "#e0e0e0"));
    selectionButton.addEventListener("mouseleave", () => (selectionButton.style.background = "#f0f0f0"));
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  selectionButton.style.top = `${window.scrollY + rect.bottom + 5}px`;
  selectionButton.style.left = `${window.scrollX + rect.left}px`;
  selectionButton.textContent = "Save Selection";
  selectionButton.onclick = () => handleSelectionCapture(selection.toString().trim());
  selectionButton.style.display = "block";
}

export function hideSelectionButton() {
  if (selectionButton) {
    selectionButton.style.display = "none";
  }
}