import React, { useRef, useCallback, useState } from "react";
import type { AppState } from "../types";
import { runSuite } from "../e2e/runner";
import { tests } from "../e2e/tests";
import { generateSampleDataset } from "../synthetic-data/generator";
import { loadDataset } from "../mock/tagio-sdk";
import { runSimulation } from "../simulation/runner";
import type { FieldDataset } from "../synthetic-data/schema";

interface Props {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

export default function ConfigTab({ state, setState }: Props) {
  const { runPerTichCode, suiteResult, simulationStatus, simulationProgress } = state;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dataFileInputRef = useRef<HTMLInputElement>(null);

  const [dataset, setDataset] = useState<FieldDataset | null>(state.dataset);
  const [dataError, setDataError] = useState<string | null>(null);
  const [maxHours, setMaxHours] = useState<number>(48);

  // ── Dataset handlers ──────────────────────────────────────────────────────

  const applyDataset = useCallback((ds: FieldDataset) => {
    loadDataset(ds);
    setDataset(ds);
    setDataError(null);
    setState((s) => ({ ...s, dataset: ds }));
  }, [setState]);

  const handleUseSampleData = useCallback(() => {
    applyDataset(generateSampleDataset());
  }, [applyDataset]);

  const handleDataFileLoad = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const json = JSON.parse(ev.target?.result as string) as FieldDataset;
          if (!json.devices || !Array.isArray(json.devices)) {
            setDataError('Invalid dataset: missing "devices" array');
            return;
          }
          applyDataset(json);
        } catch {
          setDataError("Failed to parse JSON — check the file format");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [applyDataset]
  );

  // ── Code editor handlers ──────────────────────────────────────────────────

  const handleCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setState((s) => ({ ...s, runPerTichCode: e.target.value, suiteResult: null }));
    },
    [setState]
  );

  const handleFileLoad = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        setState((s) => ({ ...s, runPerTichCode: ev.target?.result as string, suiteResult: null }));
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [setState]
  );

  // ── Test runner ───────────────────────────────────────────────────────────

  const handleRunTests = useCallback(async () => {
    if (!runPerTichCode.trim()) return;
    setState((s) => ({ ...s, suiteResult: null, simulationStatus: "idle", simulationLog: [] }));
    const result = await runSuite(runPerTichCode, tests);
    setState((s) => ({ ...s, suiteResult: result }));
  }, [runPerTichCode, setState]);

  // ── Simulation runner ─────────────────────────────────────────────────────

  const handleRunSimulation = useCallback(async () => {
    if (!runPerTichCode.trim() || !dataset) return;

    setState((s) => ({
      ...s,
      simulationStatus: "running",
      simulationProgress: { completed: 0, total: 0 },
      simulationLog: [],
      simulationError: null,
    }));

    try {
      // Batch progress updates: only re-render every 8 hours to avoid
      // 168 successive React setState calls stalling the browser.
      let lastReportedTotal = 0;
      const log = await runSimulation(runPerTichCode, dataset, {
        maxHours,
        onProgress: (completed, total) => {
          if (total !== lastReportedTotal || completed % 8 === 0 || completed === total) {
            lastReportedTotal = total;
            setState((s) => ({
              ...s,
              simulationProgress: { completed, total },
            }));
          }
        },
      });

      setState((s) => ({
        ...s,
        simulationStatus: "done",
        simulationLog: log,
        simulationProgress: { completed: log.length, total: log.length },
        // Switch to dashboard tab automatically
        activeTab: "dashboard",
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        simulationStatus: "error",
        simulationError: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [runPerTichCode, dataset, setState]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const allPassed = suiteResult !== null && suiteResult.failed === 0;
  const canRunTests = runPerTichCode.trim().length > 0;
  const canSimulate = allPassed && dataset !== null && simulationStatus !== "running";
  const isSimulating = simulationStatus === "running";
  const simPct = simulationProgress.total > 0
    ? Math.round((simulationProgress.completed / simulationProgress.total) * 100)
    : 0;

  return (
    <div className="config-tab">
      {/* ── Left: code editor ── */}
      <div className="panel">
        <div className="panel-header">
          <h2>runPerTich.js</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
              📂 Load file
            </button>
            <input ref={fileInputRef} type="file" accept=".js" style={{ display: "none" }} onChange={handleFileLoad} />
          </div>
        </div>
        <div className="panel-body">
          <div className="code-editor-wrap">
            <span className="code-hint">
              Paste or load <strong>runPerTich.js</strong>, then add a dataset and run the tests.
            </span>
            <textarea
              className="code-editor"
              value={runPerTichCode}
              onChange={handleCodeChange}
              spellCheck={false}
              placeholder={"// Paste runPerTich.js here...\n\nconst { Analysis, Resources } = require('@tago-io/sdk');\n..."}
            />
          </div>
        </div>
      </div>

      {/* ── Right: dataset + tests + simulation ── */}
      <div className="panel" style={{ display: "flex", flexDirection: "column" }}>

        {/* Dataset panel */}
        <div className="panel-header">
          <h2>Dataset</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={handleUseSampleData}>
              🌱 Sample data
            </button>
            <button className="btn btn-secondary" onClick={() => dataFileInputRef.current?.click()}>
              📂 Load JSON
            </button>
            <input ref={dataFileInputRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleDataFileLoad} />
          </div>
        </div>

        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          {dataError && <div className="suite-summary has-fail" style={{ margin: 0 }}>❌ {dataError}</div>}
          {!dataset && !dataError && (
            <span className="code-hint">
              No dataset loaded. Click <strong>Sample data</strong> for a built-in 7-day olive grove, or load your own JSON export.
            </span>
          )}
          {dataset && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <span style={{ fontWeight: 600, color: "var(--green)" }}>✅ {dataset.fieldName}</span>
              <DataChip label="Crop" value={dataset.cropType} />
              <DataChip label="Devices" value={String(dataset.devices.length)} />
              <DataChip label="Period" value={`${fmtDate(dataset.startTime)} → ${fmtDate(dataset.endTime)}`} />
              {dataset.devices.map((d) => (
                <DataChip key={d.id} label={d.type} value={Object.keys(d.data).length + " vars"} />
              ))}
            </div>
          )}
        </div>

        <DataFormatHint />

        {/* Test results */}
        <div className="panel-header">
          <h2>E2E Test Suite</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={handleRunTests} disabled={!canRunTests || isSimulating}>
              ▶ Run Tests
            </button>
            {allPassed && (
              <>
                <select
                  value={maxHours}
                  onChange={(e) => setMaxHours(Number(e.target.value))}
                  disabled={isSimulating}
                  style={{
                    background: "var(--surface2)", border: "1px solid var(--border)",
                    color: "var(--text)", padding: "5px 8px", borderRadius: 6,
                    fontSize: 12, cursor: "pointer",
                  }}
                  title="Hours to simulate"
                >
                  <option value={24}>24h</option>
                  <option value={48}>48h</option>
                  <option value={72}>72h</option>
                  <option value={168}>7 days (full)</option>
                </select>
                <button
                  className="btn btn-secondary"
                  onClick={handleRunSimulation}
                  disabled={!canSimulate}
                  title={!dataset ? "Load a dataset first" : undefined}
                >
                  {isSimulating ? <><span className="spinner" />Running…</> : "🚀 Run Simulation"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Simulation progress bar */}
        {isSimulating && (
          <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-dim)", marginBottom: 4 }}>
              <span>Simulating hour {simulationProgress.completed} / {simulationProgress.total}</span>
              <span>{simPct}%</span>
            </div>
            <div style={{ height: 4, background: "var(--surface2)", borderRadius: 2 }}>
              <div style={{ height: "100%", width: `${simPct}%`, background: "var(--accent)", borderRadius: 2, transition: "width 0.1s" }} />
            </div>
          </div>
        )}

        {/* Simulation error */}
        {state.simulationError && (
          <div style={{ margin: "8px 16px", padding: "10px 12px", background: "#2e1a1a", border: "1px solid var(--red)", borderRadius: 6, fontSize: 12, color: "var(--red)", fontFamily: "var(--mono)", whiteSpace: "pre-wrap" }}>
            ❌ Simulation error: {state.simulationError}
          </div>
        )}

        {/* Simulation done badge */}
        {simulationStatus === "done" && !isSimulating && (
          <div style={{ margin: "8px 16px", padding: "8px 12px", background: "#1a2e23", border: "1px solid var(--green)", borderRadius: 6, fontSize: 12, color: "var(--green)" }}>
            ✅ Simulation complete — {state.simulationLog.length} hours generated.{" "}
            <button
              onClick={() => setState((s) => ({ ...s, activeTab: "dashboard" }))}
              style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12, textDecoration: "underline" }}
            >
              Open Virtual Dashboard →
            </button>
          </div>
        )}

        <div className="panel-body" style={{ flex: 1 }}>
          {suiteResult === null && !canRunTests && (
            <div className="empty-state">
              <span className="icon">🧪</span>
              <span>Load <strong>runPerTich.js</strong> to get started</span>
            </div>
          )}
          {suiteResult === null && canRunTests && (
            <div className="empty-state">
              <span className="icon">▶</span>
              <span>Press <strong>Run Tests</strong> to validate the code</span>
            </div>
          )}

          {suiteResult !== null && (
            <>
              <div className={`suite-summary ${suiteResult.failed === 0 ? "all-pass" : "has-fail"}`}>
                {suiteResult.failed === 0 ? "✅" : "❌"}
                <span>{suiteResult.passed}/{suiteResult.total} tests passed</span>
                <span style={{ marginLeft: "auto", opacity: 0.7 }}>{suiteResult.durationMs} ms</span>
              </div>
              <div className="test-list">
                {suiteResult.results.map((r) => (
                  <div key={r.name} className={`test-item ${r.passed ? "pass" : "fail"}`}>
                    <span className="test-icon">{r.passed ? "✅" : "❌"}</span>
                    <div style={{ flex: 1 }}>
                      <div className="test-name">{r.name}</div>
                      <div className="test-desc">{r.description}</div>
                      {!r.passed && <div className="test-message">✗ {r.message}</div>}
                    </div>
                    <span className="test-duration">{r.durationMs} ms</span>
                  </div>
                ))}
              </div>

              {allPassed && !canSimulate && !isSimulating && (
                <div className="suite-summary running" style={{ marginTop: 14 }}>
                  ⚠️ Tests passed — load a dataset to enable simulation
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function DataChip({ label, value }: { label: string; value: string }) {
  return (
    <span style={{
      display: "inline-flex", gap: 4, alignItems: "center",
      background: "var(--surface2)", border: "1px solid var(--border)",
      borderRadius: 4, padding: "2px 8px", fontSize: 11,
    }}>
      <span style={{ color: "var(--text-dim)" }}>{label}:</span>
      <span>{value}</span>
    </span>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function DataFormatHint() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", textAlign: "left", padding: "8px 16px",
          background: "none", border: "none", cursor: "pointer",
          color: "var(--text-dim)", fontSize: 12, display: "flex", alignItems: "center", gap: 6,
        }}
      >
        <span>{open ? "▾" : "▸"}</span>
        <span>JSON dataset format reference</span>
      </button>
      {open && (
        <pre style={{
          margin: "0 16px 12px", padding: "10px 12px",
          background: "var(--bg)", border: "1px solid var(--border)",
          borderRadius: 6, fontSize: 11, fontFamily: "var(--mono)",
          color: "var(--text-dim)", whiteSpace: "pre-wrap", lineHeight: 1.6,
        }}>
{`{
  "fieldId": "my-field-001",
  "fieldName": "Αγρός Α",
  "cropType": "olive",         // must match CROP_PROFILE key
  "startTime": "2024-04-01T00:00:00Z",
  "endTime":   "2024-04-08T00:00:00Z",
  "devices": [
    {
      "id":   "device-s2120-001",
      "name": "Μετεωρολογικός Σταθμός",
      "type": "s2120",           // must match DEVICE_TYPE_VARIABLES key
      "data": {
        "air_temperature": [
          { "time": "2024-04-01T00:00:00Z", "value": 12.3, "unit": "°C" }
        ]
      }
    }
  ]
}`}
        </pre>
      )}
    </div>
  );
}
