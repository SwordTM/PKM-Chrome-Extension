const { TextEncoder, TextDecoder } = require('util');
require('jest-fetch-mock').enableMocks();

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

global.crypto = global.crypto || {};
global.crypto.subtle = global.crypto.subtle || {};
global.crypto.subtle.digest = jest.fn(() => Promise.resolve(new ArrayBuffer(0)));

global.chrome = {
  runtime: {
    onInstalled: {
      addListener: jest.fn(),
    },
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    sendMessage: jest.fn(),
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
    },
    onChanged: {
      addListener: jest.fn(),
    },
  },
  tabs: {
    sendMessage: jest.fn(),
    query: jest.fn(),
  },
  scripting: {
    executeScript: jest.fn(),
  },
  contextMenus: {
    create: jest.fn(),
    onClicked: {
      addListener: jest.fn(),
    },
  },
  downloads: {
    download: jest.fn(),
  },
};
