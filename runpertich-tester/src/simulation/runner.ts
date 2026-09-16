/**
 * Simulation runner — executes runPerTich.js hour by hour using the browser mocks.
 *
 * For each hour in the dataset:
 *  1. Set the virtual time on the mock (so moment() returns that hour)
 *  2. Execute the analysis code via new Function + require shim (once, to get the Analysis instance)
 *  3. Call analysis.run() with a dummy scope
 *  4. Collect the field_bundle written to capturedOutput
 *  5. Advance to next hour
 */

import type { FieldDataset } from "../synthetic-data/schema";
import type { SimulationHourOutput } from "../types";
import {
  setVirtualTime,
  getVirtualTime,
  getCapturedAnalysis,
  clearCapturedOutput,
  capturedOutput,
  clearSimulationBundles,
  clearAnalysisTags,
  Analysis,
} from "../mock/tagio-sdk";
import { requireShim, processMock } from "../mock/require-shim";
import { bufferPolyfill } from "../mock/tagio-sdk";

export interface SimulationRunOptions {
  maxHours?: number;
  onProgress?: (completed: number, total: number, hourIso: string) => boolean | void;
}

/**
 * Creates a Date subclass where new Date() (no args) returns the current
 * virtual simulation time instead of real wall-clock time.
 *
 * runPerTich.js uses `const now = new Date()` for hourTich/dailyTich comparisons.
 * Without this shadow, every simulated hour runs in milliseconds of real time,
 * so `hourlyTimeDiff ≈ 0 < 55` and hourTich is always false after hour 0.
 */
class VirtualDate extends Date {
  constructor(...args: any[]) {
    if (args.length === 0) {
      super(getVirtualTime().getTime());
    } else {
      // @ts-ignore — spread over Date overloads
      super(...args);
    }
  }
  static now(): number {
    return getVirtualTime().getTime();
  }
}

/**
 * Loads runPerTich.js as a CommonJS module in the browser sandbox.
 * runPerTich.js ends with: module.exports = new Analysis(handler)
 * The Analysis constructor auto-registers via getCapturedAnalysis().
 */
function loadAnalysisModule(code: string): Analysis {
  // Provide a CommonJS `module` object so `module.exports = ...` works
  const moduleObj: { exports: unknown } = { exports: {} };

  // eslint-disable-next-line no-new-func
  const fn = new Function(
    "require", "process", "Buffer", "__filename", "__dirname", "module", "exports", "Date",
    code
  );

  try {
    fn(
      requireShim,
      processMock,
      bufferPolyfill,
      "runPerTich.js",
      "/",
      moduleObj,
      moduleObj.exports,
      VirtualDate
    );
  } catch (e) {
    // Non-fatal load errors (e.g. the TEST_MODE block at the bottom)
    console.warn("[simulation] Code load warning:", e instanceof Error ? e.message : e);
  }

  // module.exports = new Analysis(handler) sets _lastAnalysis in the constructor
  const analysis = getCapturedAnalysis();
  if (!analysis) {
    throw new Error(
      "runPerTich.js did not produce an Analysis instance.\n" +
      "Expected: module.exports = new Analysis(async (context) => { ... })\n" +
      "Check the browser console for load errors."
    );
  }
  return analysis;
}

export async function runSimulation(
  code: string,
  dataset: FieldDataset,
  options: SimulationRunOptions = {}
): Promise<SimulationHourOutput[]> {
  const startMs = new Date(dataset.startTime).getTime();
  const endMs = new Date(dataset.endTime).getTime();
  const totalHours = Math.floor((endMs - startMs) / 3_600_000);
  const maxHours = Math.min(options.maxHours ?? totalHours, totalHours);

  clearSimulationBundles();
  clearAnalysisTags();

  const analysis = loadAnalysisModule(code);

  const results: SimulationHourOutput[] = [];

  for (let h = 0; h < maxHours; h++) {
    const hourMs = startMs + h * 3_600_000;
    const hourDate = new Date(hourMs);
    const isoTime = hourDate.toISOString();

    setVirtualTime(hourDate);
    clearCapturedOutput();

    const errors: string[] = [];

    try {
      await analysis.run([], "mock_context_token");
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }

    const bundleEntry = capturedOutput
      .flatMap((o) => o.data)
      .find((p) => p.variable === "field_bundle");

    results.push({
      hour: h,
      isoTime,
      fieldBundle: bundleEntry?.metadata ?? null,
      errors,
    });

    const keepGoing = options.onProgress?.(h + 1, maxHours, isoTime);
    if (keepGoing === false) break;

    // Yield every hour to keep the UI responsive
    await new Promise((r) => setTimeout(r, 0));
  }

  return results;
}
