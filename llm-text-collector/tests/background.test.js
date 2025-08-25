import { addOne } from '../storage.js';

// Mock external modules
jest.mock('../storage.js');

describe('background.js - onInstalled', () => {
  beforeAll(() => {
    // Ensure mocks are clean before this specific test
    jest.clearAllMocks();
    jest.resetModules();

    // Mock chrome.contextMenus.create specifically for this test
    chrome.contextMenus.create = jest.fn();

    // Import background.js here to trigger onInstalled listener
    require('../background.js');
  });

  test('should create context menu item on installation', () => {
    expect(chrome.contextMenus.create).toHaveBeenCalledWith({
      id: "save-selection",
      title: "Save selection to LLM Inbox",
      contexts: ["selection"],
    });
  });
});

describe('background.js - other functionalities', () => {
  // Declare mocks for storage functions globally so they can be referenced
  let mockAddOne;

  // Declare mockStorageData at the top level
  let mockStorageData = {};

  // Helper to drain the microtask queue
  const drainMicrotasks = async () => {
    for (let i = 0; i < 10; i++) { // Loop a few times to ensure all promises resolve
      await Promise.resolve();
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules(); // Reset modules before each test to ensure fresh import

    // Re-assign global listeners after clearing mocks
    chrome.contextMenus.onClicked.addListener.mockImplementation((listener) => {
      global.contextMenuClickListener = listener;
    });
    chrome.runtime.onMessage.addListener.mockImplementation((listener) => {
      global.runtimeMessageListener = listener;
    });

    // Re-define global.URL mocks as fresh Jest mock functions
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();

    // Define global.crypto.randomUUID as a fresh Jest mock function for each test
    global.crypto = {
      ...global.crypto, // Keep other crypto properties if any
      randomUUID: jest.fn(() => 'mock-uuid'),
    };

    // Import background.js here to re-register listeners
    require('../background.js');

    // Reset mock storage data for each test
    mockStorageData = {};

    // Reset mockAddOne for each test
    mockAddOne = jest.fn(async (snippet) => ({ ...snippet, id: 'mock-id', captured_at: new Date().toISOString() }));
    addOne.mockImplementation(mockAddOne);

    // Reset chrome.downloads.download mock
    chrome.downloads.download.mockResolvedValue(1);
  });

  describe('contextMenus.onClicked listener', () => {
    test('should save selected text as snippet', async () => {
      const mockInfo = { menuItemId: 'save-selection', selectionText: 'Selected Text' };
      const mockTab = { title: 'Page Title', url: 'http://example.com/page' };

      await global.contextMenuClickListener(mockInfo, mockTab);
      await drainMicrotasks(); // Ensure all async operations complete

      expect(mockAddOne).toHaveBeenCalledWith({
        title: 'Page Title',
        url: 'http://example.com/page',
        text: 'Selected Text',
        source_type: 'web',
      });
    });
  });

  describe('chrome.runtime.onMessage listener', () => {
    // Helper to call the runtime message listener and capture sendResponse
    const callRuntimeMessageListener = async (msg, sender = {}) => {
      const sendResponseMock = jest.fn();
      // The listener returns true to keep the channel open, so we don't await it directly
      global.runtimeMessageListener(msg, sender, sendResponseMock);
      // Allow promises inside the listener to resolve and sendResponse to be called
      await drainMicrotasks();
      return sendResponseMock;
    };

    test('SAVE_SELECTION message should save snippet', async () => {
      const snippet = { title: 'Test Selection', url: 'http://test.com/sel', text: 'Selected text' };
      const sendResponse = await callRuntimeMessageListener({ type: "SAVE_SELECTION", payload: snippet });

      expect(mockAddOne).toHaveBeenCalledWith(snippet);
      expect(sendResponse).toHaveBeenCalledWith({ ok: true });
    });

    test('TRANSCRIPT_CAPTURED message should upsert transcript', async () => {
      const transcript = { videoId: 'v1', title: 'Video 1', segments: ['s1'], capturedAt: '2023-01-01T00:00:00Z' };
      const sendResponse = await callRuntimeMessageListener({ type: "TRANSCRIPT_CAPTURED", ...transcript });

      expect(mockStorageData["transcripts_by_id"]['v1']).toEqual({ ...transcript, source: 'youtube' });
      expect(sendResponse).toHaveBeenCalledWith({ ok: true, stored: { videoId: 'v1', lines: 1 } });
    });

    test('TRANSCRIPTS_LIST message should return a list of transcripts (metaOnly)', async () => {
      mockStorageData["transcripts_by_id"] = {
        'v1': { videoId: 'v1', title: 'Video 1', segments: ['s1'], capturedAt: '2023-01-01T00:00:00Z', fullData: true },
        'v2': { videoId: 'v2', title: 'Video 2', segments: ['s1', 's2'], capturedAt: '2023-01-02T00:00:00Z', fullData: true },
      };

      const sendResponse = await callRuntimeMessageListener({ type: "TRANSCRIPTS_LIST" });

      expect(sendResponse).toHaveBeenCalledWith({
        ok: true,
        list: [
          { videoId: 'v1', title: 'Video 1', url: undefined, capturedAt: '2023-01-01T00:00:00Z', lines: 1 },
          { videoId: 'v2', title: 'Video 2', url: undefined, capturedAt: '2023-01-02T00:00:00Z', lines: 2 },
        ],
      });
    });

    test('TRANSCRIPTS_GET message should return a specific transcript', async () => {
      const transcript = { videoId: 'v1', title: 'Video 1', segments: ['s1'], capturedAt: '2023-01-01T00:00:00Z' };
      mockStorageData["transcripts_by_id"] = { 'v1': transcript };

      const sendResponse = await callRuntimeMessageListener({ type: "TRANSCRIPTS_GET", videoId: 'v1' });

      expect(sendResponse).toHaveBeenCalledWith({ ok: true, transcript: transcript });
    });

    test('TRANSCRIPTS_REMOVE message should remove a transcript', async () => {
      mockStorageData["transcripts_by_id"] = { 'v1': { videoId: 'v1' } };

      const sendResponse = await callRuntimeMessageListener({ type: "TRANSCRIPTS_REMOVE", videoId: 'v1' });

      expect(sendResponse).toHaveBeenCalledWith({ ok: true });
      expect(mockStorageData["transcripts_by_id"]).toEqual({});
    });

    test('TRANSCRIPTS_EXPORT_ALL message should trigger a download', async () => {
      jest.useFakeTimers(); // Use fake timers for setTimeout
      mockStorageData["transcripts_by_id"] = { 'v1': { videoId: 'v1', title: 'Video 1' } };

      const sendResponse = await callRuntimeMessageListener({ type: "TRANSCRIPTS_EXPORT_ALL" });

      expect(sendResponse).toHaveBeenCalledWith({ ok: true });
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(chrome.downloads.download).toHaveBeenCalled();

      jest.runAllTimers(); // Advance timers to trigger revokeObjectURL
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
      jest.useRealTimers(); // Restore real timers
    });

    test('SAVE_SNIPPET message should save snippet using pushSnippet', async () => {
      const snippet = { title: 'Test Snippet', url: 'http://test.com', text: 'Test' };
      const sendResponse = await callRuntimeMessageListener({ type: "SAVE_SNIPPET", payload: snippet });

      expect(sendResponse).toHaveBeenCalledWith({ ok: true, id: 'mock-uuid' });
      expect(mockStorageData["snippets"]).toEqual([
        { id: 'mock-uuid', title: 'Test Snippet', url: 'http://test.com', text: 'Test' },
      ]);
    });

    test('unknown message type should send error response', async () => {
      const sendResponse = await callRuntimeMessageListener({ type: "UNKNOWN_MESSAGE" });
      expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: "unknown_message" });
    });
  });
});