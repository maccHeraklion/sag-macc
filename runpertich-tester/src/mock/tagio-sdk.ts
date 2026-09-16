/**
 * Browser mock for @tago-io/sdk
 */

import type { FieldDataset, DataPoint } from "../synthetic-data/schema";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TagoDataPoint {
  variable: string;
  value: string | number | boolean;
  unit?: string;
  serie?: string;
  time?: string;
  metadata?: unknown;
  location?: unknown;
}

export type AnalysisHandler = (
  context: AnalysisContext,
  scope: TagoDataPoint[]
) => Promise<void>;

export interface AnalysisContext {
  log: (...args: unknown[]) => void;
  token: string;
  analysis_id: string;
  environment: Array<{ key: string; value: string }>;
}

// ── Virtual time ──────────────────────────────────────────────────────────────

let _virtualTime: Date = new Date();

export function setVirtualTime(d: Date) {
  _virtualTime = d;
}

export function getVirtualTime(): Date {
  return _virtualTime;
}

// ── Captured output ──────────────────────────────────────────────────────────

export const capturedOutput: Array<{
  deviceId: string;
  data: TagoDataPoint[];
}> = [];

export function clearCapturedOutput() {
  capturedOutput.length = 0;
}

// ── Last field_bundle per device (for fetchLastFieldBundle reads) ─────────────

const lastBundleByDevice: Record<string, unknown> = {};

/** Stored decoded field_bundle outputs per hour, keyed by isoTime. */
export const simulationBundles: Array<{
  isoTime: string;
  bundle: { shared?: unknown; crops?: unknown[] };
}> = [];

export function clearSimulationBundles() {
  simulationBundles.length = 0;
}

// ── Dataset ───────────────────────────────────────────────────────────────────

let deviceSeries: Record<string, Record<string, DataPoint[]>> = {};
let deviceList: Array<{
  id: string;
  name: string;
  tags: Array<{ key: string; value: string }>;
}> = [];

export function loadDataset(dataset: FieldDataset): void {
  deviceSeries = {};
  deviceList = dataset.devices.map((dev) => {
    deviceSeries[dev.id] = dev.data;
    return {
      id: dev.id,
      name: dev.name,
      tags: [{ key: "type", value: dev.type }],
    };
  });
}

export function clearDataset(): void {
  deviceSeries = {};
  deviceList = [];
}

// ── Aggregation helpers ───────────────────────────────────────────────────────

type AggQuery = "avg" | "max" | "min" | "sum" | "count" | "first" | "last";

function filterByDateRange(
  points: DataPoint[],
  startDate?: string,
  endDate?: string
): DataPoint[] {
  // Default end to virtual time if not specified
  const start = startDate ? new Date(startDate).getTime() : -Infinity;
  const end = endDate
    ? new Date(endDate).getTime()
    : _virtualTime.getTime();
  return points.filter((p) => {
    const t = new Date(p.time).getTime();
    return t >= start && t <= end;
  });
}

function aggregate(points: DataPoint[], query: AggQuery): number | null {
  if (points.length === 0) return null;
  const values = points.map((p) => p.value);
  switch (query) {
    case "avg": return values.reduce((a, b) => a + b, 0) / values.length;
    case "max": return Math.max(...values);
    case "min": return Math.min(...values);
    case "sum": return values.reduce((a, b) => a + b, 0);
    case "count": return values.length;
    case "first": return values[0];
    case "last": return values[values.length - 1];
  }
}

// ── BrowserBuffer — supports toString('base64') and toString('utf8') ──────────

/**
 * Drop-in for Node.js Buffer in the context of runPerTich's
 * compressFieldBundle / decompressFieldBundle.
 * toString('base64') base64-encodes the bytes (no actual deflate).
 */
class BrowserBuffer {
  private bytes: Uint8Array;
  readonly length: number;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.length = bytes.length;
  }

  toString(encoding = "utf8"): string {
    if (encoding === "base64") {
      let binary = "";
      for (let i = 0; i < this.bytes.length; i++)
        binary += String.fromCharCode(this.bytes[i]);
      return btoa(binary);
    }
    return new TextDecoder("utf-8").decode(this.bytes);
  }

  // Allow zlib to pass it through unchanged
  toBytes(): Uint8Array {
    return this.bytes;
  }
}

export const bufferPolyfill = {
  from(data: string | Uint8Array | BrowserBuffer, encoding = "utf8"): BrowserBuffer {
    if (data instanceof BrowserBuffer) return data;
    if (data instanceof Uint8Array) return new BrowserBuffer(data);
    if (encoding === "base64") {
      const binary = atob(data as string);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new BrowserBuffer(bytes);
    }
    return new BrowserBuffer(new TextEncoder().encode(data as string));
  },
  isBuffer: (v: unknown): boolean => v instanceof BrowserBuffer,
};

export const zlibPolyfill = {
  deflateRawSync(buf: BrowserBuffer | Uint8Array): BrowserBuffer {
    // No actual compression — return as BrowserBuffer so .toString('base64') works
    const bytes = buf instanceof BrowserBuffer ? buf.toBytes() : buf;
    return new BrowserBuffer(bytes);
  },
  inflateRawSync(buf: BrowserBuffer | Uint8Array): BrowserBuffer {
    // No actual decompression — return as-is
    const bytes = buf instanceof BrowserBuffer ? buf.toBytes() : buf;
    return new BrowserBuffer(bytes);
  },
};

// ── Decode a "compressed" field_bundle value back to a plain object ────────────

function decodeFieldBundle(
  value: unknown,
  metadata: unknown
): { shared?: unknown; crops?: unknown[] } | null {
  // Case 1: metadata already has shared/crops (already decoded or plain)
  const meta = metadata as Record<string, unknown>;
  if (meta?.shared || meta?.crops) {
    return { shared: meta.shared, crops: meta.crops as unknown[] };
  }
  // Case 2: compressed via our BrowserBuffer mock (base64 of raw UTF-8)
  const dataStr = (meta?.data as string) ?? (typeof value === "string" ? value : null);
  if (dataStr) {
    try {
      const binary = atob(dataStr);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const json = new TextDecoder().decode(bytes);
      return JSON.parse(json);
    } catch {
      // fall through
    }
  }
  return null;
}

// ── Device mock ───────────────────────────────────────────────────────────────

export class DeviceMock {
  readonly id: string;

  constructor(token: string) {
    this.id = token.replace(/^mock_token_/, "");
  }

  async getData(query: {
    variables: string | string[];
    qty?: number;
    query?: AggQuery;
    start_date?: string;
    end_date?: string;
  }): Promise<TagoDataPoint[]> {
    const vars = Array.isArray(query.variables) ? query.variables : [query.variables];
    const deviceData = deviceSeries[this.id] ?? {};
    const results: TagoDataPoint[] = [];

    for (const varName of vars) {
      // Special case: return last written field_bundle
      if (varName === "field_bundle") {
        const last = lastBundleByDevice[this.id];
        if (last) {
          results.push({
            variable: "field_bundle",
            value: 1,
            metadata: last,
            time: _virtualTime.toISOString(),
          });
        }
        continue;
      }

      const allPoints = deviceData[varName] ?? [];
      const inRange = filterByDateRange(allPoints, query.start_date, query.end_date);

      if (query.query) {
        const aggValue = aggregate(inRange, query.query);
        if (aggValue !== null) {
          results.push({
            variable: varName,
            value: parseFloat(aggValue.toFixed(4)),
            unit: inRange[0]?.unit,
            time: (_virtualTime ?? new Date()).toISOString(),
          });
        }
      } else {
        // Latest N points up to virtualTime, newest first
        const sorted = [...inRange].sort(
          (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
        );
        const sliced = sorted.slice(0, query.qty ?? 1);
        results.push(
          ...sliced.map((p) => ({
            variable: varName,
            value: p.value,
            unit: p.unit,
            time: p.time,
          }))
        );
      }
    }
    return results;
  }

  async sendDeviceData(data: TagoDataPoint | TagoDataPoint[]): Promise<void> {
    const points = Array.isArray(data) ? data : [data];

    const processed = points.map((p) => {
      if (p.variable === "field_bundle") {
        const bundle = decodeFieldBundle(p.value, p.metadata);
        if (bundle) {
          // Store for future getData('field_bundle') reads
          lastBundleByDevice[this.id] = bundle;
          // Record in simulation timeline
          simulationBundles.push({
            isoTime: _virtualTime.toISOString(),
            bundle,
          });
          // Return with plain metadata — no schema.compression so Dashboard uses it directly
          return { ...p, metadata: bundle };
        }
      }
      return p;
    });

    capturedOutput.push({ deviceId: this.id, data: processed });
  }
}

// ── Resources mock ────────────────────────────────────────────────────────────

export const Resources = {
  devices: {
    async list(_query?: unknown): Promise<typeof deviceList> {
      return deviceList;
    },
    async getDeviceData(
      deviceId: string,
      query: { variables: string | string[]; qty?: number }
    ): Promise<TagoDataPoint[]> {
      return new DeviceMock(deviceId).getData(query);
    },
    async sendDeviceData(deviceId: string, data: TagoDataPoint[]): Promise<void> {
      await new DeviceMock(deviceId).sendDeviceData(data);
    },
  },
};

// ── Utils mock ────────────────────────────────────────────────────────────────

export const Utils = {
  async getTokenByName(_account: unknown, deviceId: string): Promise<string> {
    return `mock_token_${deviceId}`;
  },
};

// ── Analysis mock — auto-registers for external .run() calls ─────────────────

let _lastAnalysis: Analysis | null = null;

export function getCapturedAnalysis(): Analysis | null {
  return _lastAnalysis;
}

export class Analysis {
  private handler: AnalysisHandler;

  constructor(handler: AnalysisHandler) {
    this.handler = handler;
    _lastAnalysis = this;
  }

  async init(): Promise<void> {
    // no-op: caller uses getCapturedAnalysis().run() explicitly
  }

  async run(scope: TagoDataPoint[] = [], token = "mock_context_token"): Promise<void> {
    const context: AnalysisContext = {
      log: (...args) => console.log("[runPerTich]", ...args),
      token,
      analysis_id: "mock_analysis_id",
      environment: [{ key: "ACCOUNT_TOKEN", value: "mock_account_token" }],
    };
    await this.handler(context, scope);
  }
}

// ── Analysis tag store — persists between hours within one simulation run ─────

/** In-memory tag store keyed by analysisId. Cleared on each new simulation run. */
const _analysisTags: Record<string, Array<{ key: string; value: string }>> = {};

export function clearAnalysisTags(): void {
  for (const k of Object.keys(_analysisTags)) delete _analysisTags[k];
}

// ── Account / Services mocks ──────────────────────────────────────────────────

export class Account {
  constructor(_options?: { token: string }) {}

  analysis = {
    info: async (analysisId: string) => ({ tags: _analysisTags[analysisId] ?? [] }),
    edit: async (analysisId: string, update: { tags?: Array<{ key: string; value: string }> }) => {
      if (update.tags) _analysisTags[analysisId] = update.tags;
    },
  };

  run = {
    listUsers: async (_query?: unknown) => [],
    notificationCreate: async (_userId: string, _payload: unknown) => {},
  };

  dashboards = {
    info: async (_dashboardId: string) => ({ id: _dashboardId, label: "mock" }),
    edit: async (_dashboardId: string, _update: unknown) => {},
  };
}

export class Services {
  constructor(_options?: { token: string }) {}
  Notification = {
    async send(_payload: { title: string; message: string }): Promise<void> {},
  };
}

export default {
  Analysis,
  Resources,
  Utils,
  Account,
  Device: DeviceMock,
  Services,
};
