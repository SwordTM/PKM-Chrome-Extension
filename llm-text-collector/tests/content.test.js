describe('content.js PAGE_EXTRACT', () => {
  let mockSendResponse;
  let messageListener;
  let originalWindowLocation;
  let documentTitleSpy;
  let documentBodyInnerTextSpy;

  beforeAll(() => {
    // Store original window.location
    originalWindowLocation = window.location;

    // Capture the message listener when it's added
    chrome.runtime.onMessage.addListener.mockImplementation((listener) => {
      messageListener = listener;
    });

    // Import content.js after the mock is set up so the listener is captured
    require('../content.js');
  });

  beforeEach(() => {
    mockSendResponse = jest.fn();

    // Replace window.location with a mock object
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        href: 'http://example.com/original',
        hostname: 'example.com',
        pathname: '/original',
        assign: jest.fn(),
        replace: jest.fn(),
        reload: jest.fn(),
      },
    });

    // Mock document properties using spyOn
    documentTitleSpy = jest.spyOn(document, 'title', 'get').mockReturnValue('Original Title');
    documentBodyInnerTextSpy = jest.spyOn(document.body, 'innerText', 'get').mockReturnValue('Original body text content.');
  });

  afterEach(() => {
    jest.clearAllMocks();
    documentTitleSpy.mockRestore();
    documentBodyInnerTextSpy.mockRestore();
  });

  afterAll(() => {
    // Restore original window.location
    Object.defineProperty(window, 'location', { writable: true, value: originalWindowLocation });
  });

  test('should extract page title, URL, and text on PAGE_EXTRACT message', async () => {
    const expectedPayload = {
      title: 'Test Page Title',
      url: 'http://test.com/path',
      text: 'This is some test content.',
      captured_at: expect.any(String),
    };

    // Set specific values for this test
    window.location.href = expectedPayload.url;
    window.location.hostname = 'test.com';
    window.location.pathname = '/path';
    document.title = expectedPayload.title;
    document.body.innerText = expectedPayload.text;

    // Trigger the message listener
    await messageListener({ type: 'PAGE_EXTRACT' }, {}, mockSendResponse);

    expect(mockSendResponse).toHaveBeenCalledWith({
      ok: true,
      payload: expectedPayload,
    });
  });

  test('should handle empty body text gracefully', async () => {
    document.body.innerText = null;

    await messageListener({ type: 'PAGE_EXTRACT' }, {}, mockSendResponse);

    expect(mockSendResponse).toHaveBeenCalledWith({
      ok: true,
      payload: expect.objectContaining({
        text: '',
      }),
    });
  });

  test('should truncate body text to 20000 characters', async () => {
    const longText = 'a'.repeat(25000);
    document.body.innerText = longText;

    await messageListener({ type: 'PAGE_EXTRACT' }, {}, mockSendResponse);

    expect(mockSendResponse).toHaveBeenCalledWith({
      ok: true,
      payload: expect.objectContaining({
        text: 'a'.repeat(20000),
      }),
    });
  });

  test('should send error response if an error occurs during extraction', async () => {
    // Simulate an error by making document.title throw
    documentTitleSpy.mockImplementation(() => {
      throw new Error('Access denied');
    });

    await messageListener({ type: 'PAGE_EXTRACT' }, {}, mockSendResponse);

    expect(mockSendResponse).toHaveBeenCalledWith({
      ok: false,
      error: 'Error: Access denied',
    });
  });
});