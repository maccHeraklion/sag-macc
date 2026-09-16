import type { FieldDataset } from "./synthetic-data/schema";
export type { FieldDataset };

export type TabId = "config" | "dashboard";

export interface TestResult {
  name: string;
  description: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

export interface TestSuiteResult {
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
  durationMs: number;
}

export type SimulationStatus = "idle" | "running" | "done" | "error";

export interface SimulationHourOutput {
  hour: number;
  isoTime: string;
  /** Decoded field_bundle metadata: { shared, crops } */
  fieldBundle: unknown;
  errors: string[];
}

export interface AppState {
  activeTab: TabId;
  runPerTichCode: string;
  suiteResult: TestSuiteResult | null;
  simulationStatus: SimulationStatus;
  simulationProgress: { completed: number; total: number };
  simulationLog: SimulationHourOutput[];
  simulationError: string | null;
  virtualTime: string | null;
  dataset: FieldDataset | null;
}
