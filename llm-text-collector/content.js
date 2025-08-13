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