/**
 * Browser require() shim — maps Node.js module names to browser-compatible mocks.
 */

import tagioSdkDefault, {
  Analysis, Resources, Utils, Account, DeviceMock as Device, Services,
  bufferPolyfill, zlibPolyfill, getVirtualTime,
} from "./tagio-sdk";

// ── process mock ──────────────────────────────────────────────────────────────

export const processMock = {
  env: { NODE_ENV: "browser-mock" },
  on: (_event: string, _handler: unknown) => {},
  exit: (_code?: number) => {
    throw new Error("[mock] process.exit() called");
  },
};

// ── moment-timezone mock ──────────────────────────────────────────────────────

interface MomentLike {
  toDate: () => Date;
  toISOString: () => string;
  valueOf: () => number;
  diff: (other: MomentLike, unit?: string) => number;
  add: (amount: number, unit?: string) => MomentLike;
  subtract: (amount: number, unit?: string) => MomentLike;
  tz: (zone: string) => MomentLike;
  format: (fmt?: string) => string;
  isBefore: (other: MomentLike) => boolean;
  isAfter: (other: MomentLike) => boolean;
  isSame: (other: MomentLike) => boolean;
  startOf: (unit: string) => MomentLike;
  endOf: (unit: string) => MomentLike;
  clone: () => MomentLike;
  unix: () => number;
}

const MS: Record<string, number> = {
  ms: 1, milliseconds: 1,
  s: 1000, seconds: 1000,
  m: 60000, minutes: 60000,
  h: 3600000, hours: 3600000,
  d: 86400000, days: 86400000,
};

function momentMock(date?: string | Date | number | MomentLike): MomentLike {
  let d: Date;
  if (!date) {
    // No arg → use virtual time
    d = new Date(getVirtualTime());
  } else if (date instanceof Date) {
    d = date;
  } else if (typeof date === "number") {
    d = new Date(date);
  } else if (typeof date === "string") {
    d = new Date(date);
  } else {
    d = (date as MomentLike).toDate();
  }

  return {
    toDate: () => d,
    toISOString: () => d.toISOString(),
    valueOf: () => d.getTime(),
    unix: () => Math.floor(d.getTime() / 1000),
    diff: (other: MomentLike, unit = "ms") =>
      (d.getTime() - other.toDate().getTime()) / (MS[unit] ?? 1),
    add: (amount: number, unit = "ms") =>
      momentMock(new Date(d.getTime() + amount * (MS[unit] ?? 1))),
    subtract: (amount: number, unit = "ms") =>
      momentMock(new Date(d.getTime() - amount * (MS[unit] ?? 1))),
    tz: (_zone: string) => momentMock(d),
    format: (_fmt?: string) => d.toISOString(),
    isBefore: (other: MomentLike) => d < other.toDate(),
    isAfter: (other: MomentLike) => d > other.toDate(),
    isSame: (other: MomentLike) => d.getTime() === other.toDate().getTime(),
    startOf: (_unit: string) => momentMock(d),
    endOf: (_unit: string) => momentMock(d),
    clone: () => momentMock(d),
  };
}
momentMock.tz = (date: string | Date | number, _zone: string) => momentMock(date);
momentMock.utc = (date?: string | Date | number) => momentMock(date);

// ── axios mock ────────────────────────────────────────────────────────────────

const axiosMock = {
  get: async (_url: string) => ({ data: {} }),
  post: async (_url: string, _body?: unknown) => ({ data: {} }),
};

// ── Module registry ───────────────────────────────────────────────────────────

const registry: Record<string, unknown> = {
  "@tago-io/sdk": {
    ...tagioSdkDefault,
    Analysis, Resources, Utils, Account, Device, Services,
  },
  "moment-timezone": momentMock,
  "moment": momentMock,
  "axios": axiosMock,
  "zlib": zlibPolyfill,
  "buffer": { Buffer: bufferPolyfill },
};

export function requireShim(moduleName: string): unknown {
  if (moduleName in registry) return registry[moduleName];
  throw new Error(
    `[require-shim] Module "${moduleName}" is not mocked.\n` +
    `Add it to runpertich-tester/src/mock/require-shim.ts`
  );
}
