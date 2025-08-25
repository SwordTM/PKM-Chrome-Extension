import { getAll, setAll, addOne, removeById, updateById } from '../storage.js';
import { contentHash } from '../utils.js';

// Mock the entire utils.js module
jest.mock('../utils.js');

describe('storage.js', () => {
  const KEY = 'snippets';
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {}; // Reset mock storage before each test
    chrome.storage.local.get.mockImplementation(async (keys) => {
      const result = {};
      for (const key of Object.keys(keys)) {
        result[key] = mockStorage[key] !== undefined ? mockStorage[key] : keys[key];
      }
      return result;
    });
    chrome.storage.local.set.mockImplementation(async (items) => {
      Object.assign(mockStorage, items);
    });
    // Mock contentHash for addOne tests
    contentHash.mockImplementation(async (text) => `mock-hash-${text}`);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    test('should return an empty array if no snippets are stored', async () => {
      const result = await getAll();
      expect(result).toEqual([]);
      expect(chrome.storage.local.get).toHaveBeenCalledWith({ [KEY]: [] });
    });

    test('should return stored snippets', async () => {
      mockStorage[KEY] = [{ id: '1', text: 'test' }];
      const result = await getAll();
      expect(result).toEqual([{ id: '1', text: 'test' }]);
    });
  });

  describe('setAll', () => {
    test('should store the given snippets', async () => {
      const snippets = [{ id: '2', text: 'another test' }];
      await setAll(snippets);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ [KEY]: snippets });
      expect(mockStorage[KEY]).toEqual(snippets);
    });
  });

  describe('addOne', () => {
    test('should add a new snippet and assign id, contentHash, and captured_at', async () => {
      const snippet = { title: 'Test Title', url: 'http://example.com', text: 'Some text' };
      const newSnippet = await addOne(snippet);

      expect(newSnippet).toHaveProperty('id');
      expect(newSnippet).toHaveProperty('contentHash');
      expect(newSnippet).toHaveProperty('captured_at');
      expect(newSnippet.source_type).toBe('web');
      expect(newSnippet.title).toBe('Test Title');
      expect(newSnippet.url).toBe('http://example.com');
      expect(newSnippet.text).toBe('Some text');

      expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
      expect(mockStorage[KEY]).toHaveLength(1);
      expect(mockStorage[KEY][0].id).toBe(newSnippet.id);
      expect(mockStorage[KEY][0].contentHash).toBe(newSnippet.contentHash);
    });

    test('should not add a duplicate snippet based on contentHash', async () => {
      const snippet = { title: 'Test Title', url: 'http://example.com', text: 'Some text' };
      await addOne(snippet); // Add first time
      const duplicateSnippet = await addOne(snippet); // Try to add again

      expect(duplicateSnippet).toBeNull();
      expect(mockStorage[KEY]).toHaveLength(1); // Should still be 1 item
    });

    test('should handle TRANSCRIPT_CAPTURED type correctly', async () => {
      const snippet = { type: 'TRANSCRIPT_CAPTURED', title: 'YT Video', url: 'http://youtube.com/watch?v=123', text: 'Full transcript' };
      const newSnippet = await addOne(snippet);

      expect(newSnippet).toHaveProperty('id');
      expect(newSnippet).toHaveProperty('contentHash');
      expect(newSnippet.source_type).toBe('youtube_transcript');
      expect(contentHash).toHaveBeenCalledWith('YT Video|http://youtube.com/watch?v=123');
    });

    test('should prepend new snippets to the list', async () => {
      await addOne({ title: 'Old Snippet', url: 'old.com', text: 'old' });
      const newSnippet = await addOne({ title: 'New Snippet', url: 'new.com', text: 'new' });

      expect(mockStorage[KEY]).toHaveLength(2);
      expect(mockStorage[KEY][0].title).toBe('New Snippet');
      expect(mockStorage[KEY][1].title).toBe('Old Snippet');
    });
  });

  describe('removeById', () => {
    test('should remove a snippet by its ID', async () => {
      const snippet1 = { id: '1', text: 'Snippet 1' };
      const snippet2 = { id: '2', text: 'Snippet 2' };
      mockStorage[KEY] = [snippet1, snippet2];

      await removeById('1');

      expect(mockStorage[KEY]).toHaveLength(1);
      expect(mockStorage[KEY]).toEqual([snippet2]);
      expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
    });

    test('should do nothing if ID is not found', async () => {
      const snippet1 = { id: '1', text: 'Snippet 1' };
      mockStorage[KEY] = [snippet1];

      await removeById('99');

      expect(mockStorage[KEY]).toHaveLength(1);
      expect(mockStorage[KEY]).toEqual([snippet1]);
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
  });

  describe('updateById', () => {
    test('should update a snippet by its ID', async () => {
      const snippet1 = { id: '1', text: 'Snippet 1', status: 'new' };
      const snippet2 = { id: '2', text: 'Snippet 2' };
      mockStorage[KEY] = [snippet1, snippet2];

      await updateById('1', { status: 'read', newField: 'value' });

      expect(mockStorage[KEY]).toHaveLength(2);
      expect(mockStorage[KEY][0]).toEqual({
        id: '1',
        text: 'Snippet 1',
        status: 'read',
        newField: 'value',
      });
      expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
    });

    test('should do nothing if ID is not found', async () => {
      const snippet1 = { id: '1', text: 'Snippet 1' };
      mockStorage[KEY] = [snippet1];

      await updateById('99', { status: 'read' });

      expect(mockStorage[KEY]).toHaveLength(1);
      expect(mockStorage[KEY]).toEqual([snippet1]);
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
  });
});
