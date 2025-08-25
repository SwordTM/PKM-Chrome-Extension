import { getCaptions, parseVTT } from '../youtube.js';

describe('parseVTT', () => {
  test('should parse a simple VTT string correctly', () => {
    const vtt = `WEBVTT\n\n1\n00:00:00.000 --> 00:00:02.000\nHello\n\n2\n00:00:02.500 --> 00:00:04.500\nWorld\n`;
    const expected = [
      { start: 0, end: 2, text: 'Hello' },
      { start: 2.5, end: 4.5, text: 'World' },
    ];
    expect(parseVTT(vtt)).toEqual(expected);
  });

  test('should handle VTT with multiple lines of text per cue', () => {
    const vtt = `WEBVTT\n\n1\n00:00:00.000 --> 00:00:03.000\nThis is the first line.\nThis is the second line.\n\n2\n00:00:03.500 --> 00:00:05.500\nAnother cue.\n`;
    const expected = [
      { start: 0, end: 3, text: 'This is the first line.\nThis is the second line.' },
      { start: 3.5, end: 5.5, text: 'Another cue.' },
    ];
    expect(parseVTT(vtt)).toEqual(expected);
  });

  test('should return empty array for empty VTT string', () => {
    expect(parseVTT('')).toEqual([]);
  });

  test('should return empty array for invalid VTT string', () => {
    const vtt = `INVALID\n\n1\n00:00:00.000 --> 00:00:02.000\nHello\n`;
    expect(parseVTT(vtt)).toEqual([]);
  });
});

describe('getCaptions', () => {
  beforeEach(() => {
    fetch.resetMocks();
    // Mock document.title for handleScrapeTranscript error path
    jest.spyOn(document, 'title', 'get').mockReturnValue('Mock Video Title');
    // Removed window.location.href mocking
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should return VTT content for a given videoId and language', async () => {
    const videoId = 'testVideoId';
    const lang = 'en';
    const mockHtmlResponse = `
      <script>
        var ytInitialPlayerResponse = {
          "captions": {
            "playerCaptionsTracklistRenderer": {
              "captionTracks": [
                {
                  "baseUrl": "http://mock.youtube.com/api/caption?v=testVideoId&lang=en",
                  "languageCode": "en",
                  "kind": "asr"
                },
                {
                  "baseUrl": "http://mock.youtube.com/api/caption?v=testVideoId&lang=fr",
                  "languageCode": "fr",
                  "kind": "asr"
                }
              ]
            }
          }
        };
      </script>
    `;
    const mockVttResponse = `WEBVTT\n\n1\n00:00:00.000 --> 00:00:02.000\nHello`;

    fetch
      .mockResponseOnce(mockHtmlResponse)
      .mockResponseOnce(mockVttResponse);

    const result = await getCaptions(videoId, lang);
    expect(result).toBe(mockVttResponse);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith(`https://www.youtube.com/watch?v=${videoId}`);
    expect(fetch).toHaveBeenCalledWith(`http://mock.youtube.com/api/caption?v=testVideoId&lang=en`);
  });

  test('should return null if player response is not found', async () => {
    const videoId = 'testVideoId';
    const lang = 'en';
    fetch.mockResponseOnce('<html><body>No player response</body></html>');

    const result = await getCaptions(videoId, lang);
    expect(result).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('should return null if caption tracks are not found', async () => {
    const videoId = 'testVideoId';
    const lang = 'en';
    const mockHtmlResponse = `
      <script>
        var ytInitialPlayerResponse = {"captions":{}};
      </script>
    `;
    fetch.mockResponseOnce(mockHtmlResponse);

    const result = await getCaptions(videoId, lang);
    expect(result).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('should return null if specified language track is not found', async () => {
    const videoId = 'testVideoId';
    const lang = 'es'; // Spanish, not available in mock
    const mockHtmlResponse = `
      <script>
        var ytInitialPlayerResponse = {
          "captions": {
            "playerCaptionsTracklistRenderer": {
              "captionTracks": [
                {
                  "baseUrl": "http://mock.youtube.com/api/caption?v=testVideoId&lang=en",
                  "languageCode": "en",
                  "kind": "asr"
                }
              ]
            }
          }
        };
      </script>
    `;
    fetch.mockResponseOnce(mockHtmlResponse);

    const result = await getCaptions(videoId, lang);
    expect(result).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});