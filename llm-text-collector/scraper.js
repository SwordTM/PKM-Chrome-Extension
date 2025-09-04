// scraper.js - For structured data scraping with DOM context

/**
 * Listens for messages from the extension to trigger structured scraping.
 * The message should contain a 'type' of 'SCRAPE_STRUCTURED' and optionally
 * 'selectors' to guide the scraping process.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCRAPE_STRUCTURED') {
    console.log('Received SCRAPE_STRUCTURED message. Starting structured scraping...');
    try {
      const scrapedData = scrapeStructuredData(message.selectors);
      sendResponse({ ok: true, payload: scrapedData });
    } catch (error) {
      console.error('Error during structured scraping:', error);
      sendResponse({ ok: false, error: error.message });
    }
    return true; // Indicates that sendResponse will be called asynchronously
  }
});

/**
 * Performs structured data scraping based on provided selectors.
 * Includes basic DOM context for each extracted piece of text.
 * @param {Array<Object>} selectors - An array of objects, each defining a selector
 *                                    and optionally a 'name' for the data.
 *                                    Example: [{ selector: 'h1', name: 'title' }, { selector: 'p.article-body' }]
 * @returns {Array<Object>} An array of scraped data objects.
 */
function scrapeStructuredData(selectors = []) {
  const results = [];

  if (selectors.length === 0) {
    console.warn('No selectors provided for structured scraping. Returning all text nodes with context.');
    // Fallback: Scrape all visible text nodes with their immediate parent context
    document.querySelectorAll('body *').forEach(element => {
      if (element.children.length === 0 && element.textContent.trim().length > 0) {
        results.push({
          text: element.textContent.trim(),
          tag: element.tagName.toLowerCase(),
          classes: Array.from(element.classList),
          id: element.id || null,
          parentTag: element.parentElement ? element.parentElement.tagName.toLowerCase() : null,
          parentClasses: element.parentElement ? Array.from(element.parentElement.classList) : [],
        });
      }
    });
    return results;
  }

  selectors.forEach(item => {
    const elements = document.querySelectorAll(item.selector);
    elements.forEach(element => {
      results.push({
        name: item.name || item.selector, // Use provided name or selector as default
        text: element.textContent.trim(),
        tag: element.tagName.toLowerCase(),
        classes: Array.from(element.classList),
        id: element.id || null,
        href: element.hasAttribute('href') ? element.getAttribute('href') : null,
        src: element.hasAttribute('src') ? element.getAttribute('src') : null,
        parentTag: element.parentElement ? element.parentElement.tagName.toLowerCase() : null,
        parentClasses: element.parentElement ? Array.from(element.parentElement.classList) : [],
        // Add more context as needed, e.g., siblings, children structure
      });
    });
  });

  return results;
}

console.log('scraper.js loaded.');
