import { isInjectable } from '../utils.js';

// Mock external modules
jest.mock('../utils.js');

describe('popup.js', () => {
  // Mock the DOM structure expected by popup.js
  const mockHtml = `
    <div id="list"></div>
    <div id="empty" style="display: none;">No snippets yet.</div>
    <button id="capturePage"></button>
    <button id="exportJson"></button>
    <button id="sendToLLM"></button>
    <button id="clearAll"></button>
    <button id="ytScrapeTranscript"></button>
    <template id="itemTpl">
      <li>
        <a class="title"></a>
        <span class="createdAt"></span>
        <span class="text"></span>
        <span class="source"></span>
        <button class="delete"></button>
      </li>
    </template>
    <template id="transcriptTpl">
      <li>
        <a class="title"></a>
        <span class="createdAt"></span>
        <div class="text"></div>
        <div class="transcript-segments"></div>
        <span class="source"></span>
      </li>
    </template>
  `;

  let messageListener;
  let storageOnChangedListener;
  let popupModule; // To hold the imported popup.js module

  // Declare mocks for storage functions globally so they can be referenced
  let mockAddOne;
  let mockGetAll;
  let mockRemoveById;

  // Helper to drain the microtask queue
  const drainMicrotasks = async () => {
    for (let i = 0; i < 10; i++) { // Loop a few times to ensure all promises resolve
      await Promise.resolve();
    }
  };

  beforeAll(() => {
    // Capture the message listener from chrome.runtime.onMessage.addListener
    chrome.runtime.onMessage.addListener.mockImplementation((listener) => {
      messageListener = listener;
    });

    // Capture the storage onChanged listener
    chrome.storage.onChanged.addListener.mockImplementation((listener) => {
      storageOnChangedListener = listener;
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules(); // Reset modules before each test to ensure fresh import

    // Define mocks for storage functions using jest.doMock
    mockAddOne = jest.fn(async (snippet) => {
      console.log('addOne mock called with:', snippet);
      if (snippet) {
        return { ...snippet, id: 'mock-id-' + Date.now(), captured_at: new Date().toISOString() };
      } else {
        return null;
      }
    });
    mockGetAll = jest.fn(async () => []);
    mockRemoveById = jest.fn(async () => undefined);

    jest.doMock('../storage.js', () => ({
      addOne: mockAddOne,
      getAll: mockGetAll,
      removeById: mockRemoveById,
    }));

    // Set up the DOM before importing popup.js
    document.body.innerHTML = mockHtml;

    // Import popup.js after DOM and mocks are set up
    popupModule = require('../popup.js');

    // Reset DOM elements to initial state for each test
    document.getElementById("list").innerHTML = "";
    document.getElementById("empty").style.display = "none";
    document.getElementById("capturePage").style.display = "block";
    document.getElementById("ytScrapeTranscript").style.display = "none";

    // Mock chrome.tabs.query to return a default tab
    chrome.tabs.query.mockResolvedValue([{ id: 1, url: 'http://example.com' }]);

    // Mock isInjectable
    isInjectable.mockReturnValue(true);
  });

  describe('load() function', () => {
    test('should display empty message if no snippets', async () => {
      mockGetAll.mockResolvedValue([]);
      // load() is called on import, so it should already be triggered
      await drainMicrotasks(); // Allow promises to resolve

      expect(document.getElementById('empty').style.display).toBe('block');
      expect(document.getElementById('list').innerHTML).toBe('');
    });

    test('should render snippets if available', async () => {
      const mockSnippets = [
        { id: '1', title: 'Test Snippet', url: 'http://test.com', text: 'Some text', captured_at: new Date().toISOString() },
      ];
      mockGetAll.mockResolvedValue(mockSnippets);

      // Re-import to trigger load() with new mocks
      jest.resetModules();
      document.body.innerHTML = mockHtml;
      require('../popup.js');

      await drainMicrotasks();

      expect(document.getElementById('empty').style.display).toBe('none');
      expect(document.getElementById('list').children.length).toBe(1);
      expect(document.querySelector('#list .title').textContent).toBe('Test Snippet');
    });

    test('should show capturePage button and hide ytScrapeTranscript on non-YouTube page', async () => {
      chrome.tabs.query.mockResolvedValue([{ id: 1, url: 'http://example.com' }]);

      // Re-import to trigger load() with new mocks
      jest.resetModules();
      document.body.innerHTML = mockHtml;
      require('../popup.js');

      await drainMicrotasks();

      expect(document.getElementById('capturePage').style.display).toBe('block');
      expect(document.getElementById('ytScrapeTranscript').style.display).toBe('none');
    });

    test('should hide capturePage button and show ytScrapeTranscript on YouTube watch page', async () => {
      chrome.tabs.query.mockResolvedValue([{ id: 1, url: 'https://www.youtube.com/watch?v=123' }]);

      // Re-import to trigger load() with new mocks
      jest.resetModules();
      document.body.innerHTML = mockHtml;
      require('../popup.js');

      await drainMicrotasks();

      expect(document.getElementById('capturePage').style.display).toBe('none');
      expect(document.getElementById('ytScrapeTranscript').style.display).toBe('block');
    });
  });

  describe('capturePage button click', () => {
    test('should send PAGE_EXTRACT message and add snippet on success', async () => {
      const mockTab = { id: 1, url: 'http://example.com/page' };
      chrome.tabs.query.mockResolvedValue([mockTab]);
      isInjectable.mockReturnValue(true);
      chrome.tabs.sendMessage.mockResolvedValue({ ok: true, payload: { title: 'Captured', url: 'http://example.com/page', text: 'Content' } });

      document.getElementById('capturePage').click();
      await drainMicrotasks(); // Allow promises to resolve

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(mockTab.id, { type: 'PAGE_EXTRACT' });
      expect(mockAddOne).toHaveBeenCalledWith({ title: 'Captured', url: 'http://example.com/page', text: 'Content' });
      expect(document.getElementById('list').children.length).toBe(1);
      expect(document.getElementById('empty').style.display).toBe('none');
    });

    test('should inject content.js and retry if receiving end does not exist', async () => {
      const mockTab = { id: 1, url: 'http://example.com/page' };
      chrome.tabs.query.mockResolvedValue([mockTab]);
      isInjectable.mockReturnValue(true);

      // First call to sendMessage throws, second succeeds
      chrome.tabs.sendMessage
        .mockRejectedValueOnce(new Error('Receiving end does not exist'))
        .mockResolvedValueOnce({ ok: true, payload: { title: 'Retried', url: 'http://example.com/page', text: 'Content' } });

      document.getElementById('capturePage').click();
      await drainMicrotasks(); // Allow promises to resolve

      expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: mockTab.id },
        files: ['content.js'],
      });
      expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
      expect(mockAddOne).toHaveBeenCalledWith({ title: 'Retried', url: 'http://example.com/page', text: 'Content' });
      expect(document.getElementById('list').children.length).toBe(1);
    });

    test('should not capture if tab is not injectable', async () => {
      const mockTab = { id: 1, url: 'chrome://extensions' };
      chrome.tabs.query.mockResolvedValue([mockTab]);
      isInjectable.mockReturnValue(false);

      document.getElementById('capturePage').click();
      await drainMicrotasks();

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
      expect(mockAddOne).not.toHaveBeenCalled();
    });
  });

  describe('chrome.runtime.onMessage listener', () => {
    test('should add and render snippet on SAVE_SNIPPET message', async () => {
      const mockSnippet = { title: 'Saved via Message', url: 'http://msg.com', text: 'Message content' };
      mockAddOne.mockResolvedValueOnce({ ...mockSnippet, id: 'msg-id' });

      await messageListener({ type: 'SAVE_SNIPPET', payload: mockSnippet }, {}, jest.fn());
      await drainMicrotasks();

      expect(mockAddOne).toHaveBeenCalledWith(mockSnippet);
      expect(document.getElementById('list').children.length).toBe(1);
      expect(document.querySelector('#list .title').textContent).toBe('Saved via Message');
      expect(document.getElementById('empty').style.display).toBe('none');
    });

    test('should add and render transcript snippet on TRANSCRIPT_CAPTURED message', async () => {
      const mockTranscriptSnippet = {
        type: 'TRANSCRIPT_CAPTURED',
        title: 'YT Transcript',
        url: 'http://youtube.com/watch?v=abc',
        segments: [{ ts: '0:00', text: 'Hello' }, { ts: '0:01', text: 'World' }],
      };
      mockAddOne.mockResolvedValueOnce({ ...mockTranscriptSnippet, id: 'transcript-id' });

      await messageListener({ type: 'TRANSCRIPT_CAPTURED', ...mockTranscriptSnippet }, {}, jest.fn());
      await drainMicrotasks();

      expect(mockAddOne).toHaveBeenCalledWith(expect.objectContaining({
        type: 'TRANSCRIPT_CAPTURED',
        title: 'YT Transcript',
        text: 'Hello\nWorld',
      }));
      expect(document.getElementById('list').children.length).toBe(1);
      expect(document.querySelector('#list .title').textContent).toBe('YT Transcript');
      expect(document.querySelector('#list .text').textContent).toBe('Hello\nWorld');
      expect(document.getElementById('empty').style.display).toBe('none');
    });
  });

  describe('chrome.storage.onChanged listener', () => {
    test('should call load() when snippets change in local storage', async () => {
      // We need to ensure the DOM is reset and mocks are in place for the re-import
      mockGetAll.mockResolvedValueOnce([{ id: 'new', title: 'New Snippet', url: 'http://new.com', text: 'new', captured_at: new Date().toISOString() }]);

      await storageOnChangedListener({ snippets: { oldValue: [], newValue: [{ id: '1' }] } }, 'local');
      await drainMicrotasks(); // Allow load() to complete

      // Assert on the effects of load()
      expect(document.getElementById('list').children.length).toBe(1);
      expect(document.getElementById('empty').style.display).toBe('none');
      expect(document.querySelector('#list .title').textContent).toBe('New Snippet');
    });
  });

  describe('delete button click', () => {
    test('should remove snippet and update UI', async () => {
      const mockSnippet = { id: '1', title: 'Deletable', url: 'http://del.com', text: 'del', captured_at: new Date().toISOString() };
      mockGetAll.mockResolvedValueOnce([mockSnippet]);
      // Re-import to trigger load() with initial data
      jest.resetModules();
      document.body.innerHTML = mockHtml;
      require('../popup.js');
      await drainMicrotasks();

      expect(document.getElementById('list').children.length).toBe(1);

      document.querySelector('#list .delete').click();
      await drainMicrotasks();

      expect(mockRemoveById).toHaveBeenCalledWith('1');
      expect(document.getElementById('list').children.length).toBe(0);
      expect(document.getElementById('empty').style.display).toBe('block');
    });
  });
});
