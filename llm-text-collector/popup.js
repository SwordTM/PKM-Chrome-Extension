import { getAll, setAll, deleteByHash, addSnippet } from './storage.js';

const els = {
  list: document.getElementById('list'),
  empty: document.getElementById('empty'),
  capture: document.getElementById('capturePage'),
  exportJson: document.getElementById('exportJson'),
  sendToLLM: document.getElementById('sendToLLM'),
  clearAll: document.getElementById('clearAll')
};

function renderList(items) {
  els.list.innerHTML = '';
  els.empty.style.display = items.length ? 'none' : 'block';

  const tpl = document.getElementById('itemTpl');
  items.forEach(sn => {
    const li = tpl.content.firstElementChild.cloneNode(true);
    li.querySelector('.title').textContent = sn.title || '(untitled)';
    li.querySelector('.title').href = sn.url || '#';
    li.querySelector('.url').textContent = sn.url;
    li.querySelector('.createdAt').textContent = new Date(sn.createdAt).toLocaleString();
    li.querySelector('.text').textContent = sn.text || '';
    li.querySelector('.tags').value = (sn.tags || []).join(', ');
    li.querySelector('.note').value = sn.note || '';

    li.querySelector('.save').addEventListener('click', async () => {
      const tags = li.querySelector('.tags').value.split(',').map(s => s.trim()).filter(Boolean);
      const note = li.querySelector('.note').value;
      const items2 = await getAll();
      const idx = items2.findIndex(x => x.contentHash === sn.contentHash);
      if (idx >= 0) {
        items2[idx] = { ...items2[idx], tags, note };
        await setAll(items2);
        await load();
      }
    });

    li.querySelector('.delete').addEventListener('click', async () => {
      await deleteByHash(sn.contentHash);
      await load();
    });

    els.list.appendChild(li);
  });
}

async function load() {
  const items = await getAll();
  renderList(items);
}

// Capture full-page extract by injecting content.js
els.capture.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });
});

// Receive extract from content.js
chrome.runtime.onMessage.addListener(async (msg, _sender, _sendResponse) => {
  if (msg?.type === 'PAGE_EXTRACT') {
    const saved = await addSnippet({ ...msg.payload, tags: [], note: '' });
    if (saved) await load();
  }
});

// Export JSON
els.exportJson.addEventListener('click', async () => {
  const items = await getAll();
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `llm_inbox_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// Send to LLM (placeholder). Point to your local ingestion API.
els.sendToLLM.addEventListener('click', async () => {
  const items = await getAll();
  try {
    const res = await fetch('http://localhost:8000/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snippets: items })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    alert('Sent to LLM pipeline.');
  } catch (e) {
    alert('Failed to send to LLM: ' + e.message);
  }
});

// Clear All
els.clearAll.addEventListener('click', async () => {
  if (!confirm('Delete all saved snippets?')) return;
  await chrome.storage.local.set({ snippets: [] });
  await load();
});

load();