(() => {
  function getMeta(name) {
    const el = document.querySelector(`meta[name="${name}"]`);
    return el?.getAttribute('content') || '';
  }
  const text = document.body.innerText || '';
  const payload = {
    source: 'page-extract',
    url: location.href,
    title: document.title,
    description: getMeta('description'),
    lang: document.documentElement.lang || '',
    text: text.length > 5000 ? text.slice(0, 5000) + '\n…[truncated]' : text,
    createdAt: new Date().toISOString()
  };
  chrome.runtime.sendMessage({ type: 'PAGE_EXTRACT', payload });
})();

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "PAGE_EXTRACT") {
    // build your extract here
    const payload = {
      type: "page_extract",
      title: document.title,
      url: location.href,
      text: document.body.innerText.slice(0, 20000), // example
      createdAt: new Date().toISOString()
    };
    sendResponse({ ok: true, payload });
  }
  // Return true only if you plan to call sendResponse asynchronously.
  return false;
});