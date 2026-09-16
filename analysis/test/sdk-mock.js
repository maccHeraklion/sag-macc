/**
 * Minimal @tago-io/sdk stub for local testing.
 *
 * Prevents any network calls when runPerTich.js is required in TEST_MODE.
 * The Analysis constructor receives the callback but never calls it — all
 * functions are invoked directly by the test harness instead.
 */

class Analysis {
  constructor(fn) {
    // Store but do not invoke — harness calls functions directly
    this._fn = fn;
  }
}

class Resources {}

class Utils {
  static async getTokenByName() {
    return null;
  }
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
      list: async () => [],
      info: async () => ({}),
      edit: async () => {},
    };
  }
}

class Device {
  constructor() {}
  async getData() {
    return [];
  }
  async sendData() {
    return {};
  }
  async info() {
    return { tags: [] };
  }
}

class Services {
  constructor() {}
  get Notification() {
    return {
      send: async () => {},
    };
  }
}

module.exports = { Analysis, Resources, Utils, Account, Device, Services };
