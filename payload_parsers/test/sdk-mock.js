/**
 * Minimal @tago-io/sdk stub for payload-parser tests.
 *
 * The Analysis constructor stores the function but never invokes it.
 * Pure downlink-builder / helper functions are exported in test mode
 * via the UC511_PARSER_TEST_MODE env var and tested directly.
 */

class Analysis {
  constructor(fn) {
    this._fn = fn;
  }
}

class Utils {
  static envToJson(envArray = []) {
    return envArray.reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {});
  }
}

class Account {
  constructor() {}
  get devices() {
    return {
      info: async () => ({ tags: [] }),
      edit: async () => {},
      tokenCreate: async () => ({ token: 'test-token' }),
      tokenList: async () => [],
      paramList: async () => [],
      paramSet: async () => {},
      sendDownlink: async () => ({}),
    };
  }
  get actions() {
    return {
      list: async () => [],
      create: async () => ({}),
      delete: async () => {},
    };
  }
}

class Device {
  constructor() {}
  async getData() { return []; }
  async sendData() { return {}; }
}

module.exports = { Analysis, Utils, Account, Device };
