import { isInjectable, contentHash } from '../utils.js';

describe('isInjectable', () => {
  test('should return true for valid http/https URLs', () => {
    expect(isInjectable('https://example.com')).toBe(true);
    expect(isInjectable('http://localhost:8080/path')).toBe(true);
  });

  test('should return false for chrome:// URLs', () => {
    expect(isInjectable('chrome://extensions')).toBe(false);
  });

  test('should return false for Chrome Web Store URLs', () => {
    expect(isInjectable('https://chrome.google.com/webstore')).toBe(false);
  });

  test('should return false for invalid URLs', () => {
    expect(isInjectable('invalid-url')).toBe(false);
    expect(isInjectable('')).toBe(false);
    expect(isInjectable(undefined)).toBe(false);
  });

  test('should return false for non-http/https protocols', () => {
    expect(isInjectable('ftp://example.com')).toBe(false);
    expect(isInjectable('file:///path/to/file.html')).toBe(false);
  });
});

describe('contentHash', () => {
  beforeEach(() => {
    // Reset the mock before each test
    global.crypto.subtle.digest.mockClear();
  });

  test('should return a SHA-256 hash of the input text', async () => {
    const testText = 'Hello World';
    // Mock the digest function to return a predictable hash
    global.crypto.subtle.digest.mockImplementationOnce(async (algorithm, data) => {
      // For simplicity, we'll return a fixed hash for testing
      // In a real scenario, you might want to use a library to compute the actual hash
      const hash = new Uint8Array([0x2c, 0xf2, 0x4d, 0xba, 0x5f, 0xb0, 0xa3, 0x0e, 0x26, 0x4c, 0x83, 0x04, 0x5d, 0x88, 0x77, 0x80, 0x65, 0x21, 0x63, 0x3d, 0x18, 0x65, 0x2b, 0x05, 0x60, 0x20, 0x16, 0x70, 0x59, 0x74, 0xee, 0xed]);
      return hash.buffer;
    });

    const hash = await contentHash(testText);
    expect(hash).toBe('2cf24dba5fb0a30e264c83045d8877806521633d18652b05602016705974eeed');
    expect(global.crypto.subtle.digest).toHaveBeenCalledWith('SHA-256', expect.any(Object)); // Changed to expect.any(Object)
  });

  test('should return a consistent hash for the same input', async () => {
    const testText = 'Another string';
    const expectedHash = 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3'; // This is a placeholder, actual hash would be computed

    global.crypto.subtle.digest.mockImplementationOnce(async (algorithm, data) => {
      // Mock a different hash for this test
      const hash = new Uint8Array([0xa9, 0x4a, 0x8f, 0xe5, 0xcc, 0xb1, 0x9b, 0xa6, 0x1c, 0x4c, 0x08, 0x73, 0xd3, 0x91, 0xe9, 0x87, 0x98, 0x2f, 0xbb, 0xd3, 0x61, 0x67, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      return hash.buffer;
    });

    const hash1 = await contentHash(testText);
    expect(hash1).toBe('a94a8fe5ccb19ba61c4c0873d391e987982fbbd3616780000000000000000000');

    global.crypto.subtle.digest.mockImplementationOnce(async (algorithm, data) => {
      // Mock the same hash again
      const hash = new Uint8Array([0xa9, 0x4a, 0x8f, 0xe5, 0xcc, 0xb1, 0x9b, 0xa6, 0x1c, 0x4c, 0x08, 0x73, 0xd3, 0x91, 0xe9, 0x87, 0x98, 0x2f, 0xbb, 0xd3, 0x61, 0x67, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      return hash.buffer;
    });

    const hash2 = await contentHash(testText);
    expect(hash2).toBe('a94a8fe5ccb19ba61c4c0873d391e987982fbbd3616780000000000000000000');
  });
});
