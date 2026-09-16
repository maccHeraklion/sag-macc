import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import type { AppState, SimulationHourOutput } from "../types";
import type { DeviceDataset } from "../synthetic-data/schema";
import { setupTagoWindow, pushRealtimeData } from "../mock/tago-window";

// Lazy-import the production Dashboard (named export, no default) to avoid
// executing it at module level — window.TagoIO must be set up first.
const ProductionDashboard = React.lazy(
  () =>
    (import("@dashboard-src/Dashboard") as Promise<{ Dashboard: React.ComponentType }>).then(
      (m) => ({ default: m.Dashboard })
    )
);

type InnerTab = "dashboard" | "statistics";

interface Props {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

export default function DashboardTab({ state, setState }: Props) {
  const { dataset, simulationLog } = state;
  const [innerTab, setInnerTab] = useState<InnerTab>("dashboard");
  const [virtualTime, setVirtualTime] = useState<string>(
    state.virtualTime ?? toDatetimeInput(new Date(dataset!.startTime))
  );
  // Key based on hour — remounts Dashboard on hour boundary to clear
  // accumulated stale history, without remounting on every slider tick.
  const hourKey = Math.floor(new Date(virtualTime).getTime() / 3_600_000);

  // Reset the TagoIO mock exactly when the Dashboard remounts (hourKey change).
  // useLayoutEffect fires before any child useEffect, so this runs before the
  // Dashboard registers its onRealtime callback — giving us a clean slate.
  useLayoutEffect(() => {
    setupTagoWindow();
  }, [hourKey]);

  // Feed the Dashboard whenever virtual time or simulation data changes.
  // hourKey is included so we re-push after a Dashboard remount (hour boundary).
  useEffect(() => {
    if (innerTab !== "dashboard") return;
    pushDataAtTime(virtualTime, dataset!, simulationLog);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualTime, simulationLog, innerTab, dataset, hourKey]);

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setVirtualTime(val);
    setState((s) => ({ ...s, virtualTime: val }));
  }

  const hasSimulation = simulationLog.length > 0;

  return (
    <div className="dashboard-tab" style={{ padding: 0, gap: 0 }}>
      {/* ── Inner tab bar ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        <button
          className={`tab-btn ${innerTab === "dashboard" ? "active" : ""}`}
          onClick={() => setInnerTab("dashboard")}
        >
          📊 Dashboard
        </button>
        <button
          className={`tab-btn ${innerTab === "statistics" ? "active" : ""}`}
          onClick={() => setInnerTab("statistics")}
          disabled={!hasSimulation}
          title={!hasSimulation ? "Run simulation to see statistics" : undefined}
        >
          📈 Statistics
        </button>

        <div style={{ flex: 1 }} />

        {/* Virtual time selector */}
        <label style={{ fontSize: 12, color: "var(--text-dim)" }}>Virtual time:</label>
        <input
          type="datetime-local"
          value={virtualTime}
          min={toDatetimeInput(new Date(dataset!.startTime))}
          max={toDatetimeInput(new Date(dataset!.endTime))}
          onChange={handleTimeChange}
          style={{
            background: "var(--surface2)", border: "1px solid var(--border)",
            color: "var(--text)", padding: "5px 10px", borderRadius: 6,
            fontSize: 13, outline: "none",
          }}
        />
        {!hasSimulation && (
          <span style={{ fontSize: 11, color: "var(--yellow)" }}>
            ⚠ Run simulation to see calculated indicators (BPI, IPSI, VPD…)
          </span>
        )}
      </div>

      {/* ── Inner tab content ── */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {innerTab === "dashboard" && (
          <div style={{ width: "100%", height: "100%", overflow: "auto", background: "#fff" }}>
            <React.Suspense fallback={<LoadingPlaceholder text="Loading dashboard…" />}>
              <ProductionDashboard key={hourKey} />
            </React.Suspense>
          </div>
        )}
        {innerTab === "statistics" && hasSimulation && (
          <StatisticsTab log={simulationLog} dataset={dataset!.devices} />
        )}
      </div>
    </div>
  );
}

// ── Feed data into the production Dashboard ───────────────────────────────────

type BundleShape = {
  shared?: Record<string, unknown>;
  crops?: Array<{ id: string; indicators?: Record<string, unknown> }>;
};

function pushDataAtTime(
  virtualTime: string,
  dataset: NonNullable<AppState["dataset"]>,
  log: SimulationHourOutput[]
) {
  const targetMs = new Date(virtualTime).getTime();
  const points: Record<string, unknown>[] = [];

  // 1. Sensor history up to virtualTime — capped at MAX_HISTORY_PER_VAR points
  //    per variable to avoid flooding the Dashboard with thousands of entries.
  //    We keep the most-recent points (sufficient for charts + sidebar).
  const MAX_HISTORY_PER_VAR = 100;
  for (const dev of dataset.devices) {
    for (const [varName, series] of Object.entries(dev.data)) {
      const inRange = series.filter((p) => new Date(p.time).getTime() <= targetMs);
      // Take the last N (newest) to stay within the cap
      const sliced = inRange.length > MAX_HISTORY_PER_VAR
        ? inRange.slice(inRange.length - MAX_HISTORY_PER_VAR)
        : inRange;
      for (const point of sliced) {
        points.push({
          variable: varName,
          value: point.value,
          unit: point.unit,
          time: point.time,
          device: dev.id,
        });
      }
    }
  }

  // 2. field_bundle from simulation closest to virtualTime
  const hourEntry = log.length > 0 ? closestLogEntry(log, targetMs) : null;
  if (hourEntry?.fieldBundle) {
    points.push({
      variable: "field_bundle",
      value: 1,
      metadata: hourEntry.fieldBundle,
      time: hourEntry.isoTime,
    });
  }

  // 3. Configuration — derive crop IDs from field_bundle so they match exactly.
  //    Without simulation, fall back to dataset.cropType.
  const bundleCrops = (hourEntry?.fieldBundle as BundleShape)?.crops;
  const configCrops =
    bundleCrops?.length
      ? bundleCrops.map((c) => ({
          id: c.id,
          cultivation_type_general: c.id.split(":")[0],
          cultivation_type: c.id.split(":")[1] ?? c.id.split(":")[0],
        }))
      : [
          {
            id: `${dataset.cropType}:${dataset.cropType}`,
            cultivation_type_general: dataset.cropType,
            cultivation_type: dataset.cropType,
          },
        ];

  points.push({
    variable: "configuration",
    value: JSON.stringify({ crops: configCrops }),
    time: new Date(targetMs).toISOString(),
  });

  pushRealtimeData(points);
}


function closestLogEntry(log: SimulationHourOutput[], targetMs: number) {
  let best = log[0];
  let bestDiff = Math.abs(new Date(log[0].isoTime).getTime() - targetMs);
  for (const e of log) {
    const d = Math.abs(new Date(e.isoTime).getTime() - targetMs);
    if (d < bestDiff) { best = e; bestDiff = d; }
  }
  return best;
}

// ── Statistics tab ────────────────────────────────────────────────────────────

interface StatisticsTabProps {
  log: SimulationHourOutput[];
  dataset: DeviceDataset[];
}

function StatisticsTab({ log, dataset }: StatisticsTabProps) {
  const { sharedSeries, cropSeries, sensorSeries } = useMemo(
    () => extractSeries(log, dataset),
    [log, dataset]
  );

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Shared indicators */}
      {sharedSeries.length > 0 && (
        <ChartGroup title="Κοινοί Δείκτες (Shared Indicators)" series={sharedSeries} log={log} />
      )}

      {/* Per-crop indicators */}
      {cropSeries.map(({ cropId, series }) => (
        <ChartGroup key={cropId} title={`Δείκτες Καλλιέργειας: ${cropId}`} series={series} log={log} />
      ))}

      {/* Raw sensor overlays */}
      <ChartGroup title="Αισθητήρες (Raw Sensors)" series={sensorSeries} log={log} />
    </div>
  );
}

// ── ECharts-based chart group ─────────────────────────────────────────────────

interface SeriesInfo {
  name: string;
  data: Array<[string, number | null]>; // [isoTime, value]
  unit?: string;
  color?: string;
}

interface ChartGroupProps {
  title: string;
  series: SeriesInfo[];
  log: SimulationHourOutput[];
}

function ChartGroup({ title, series }: ChartGroupProps) {
  if (series.length === 0) return null;

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden",
    }}>
      <div style={{
        padding: "10px 16px", background: "var(--surface2)",
        borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 13,
      }}>
        {title}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 1, background: "var(--border)" }}>
        {series.map((s) => (
          <MiniChart key={s.name} series={s} />
        ))}
      </div>
    </div>
  );
}

function MiniChart({ series: s }: { series: SeriesInfo }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<unknown>(null);

  useEffect(() => {
    let chart: any;
    // Dynamic import of echarts (available from parent node_modules)
    import("echarts").then((echarts) => {
      if (!canvasRef.current) return;
      chart = echarts.init(canvasRef.current, "dark");
      chartRef.current = chart;

      const validData = s.data.filter(([, v]) => v !== null) as [string, number][];
      const values = validData.map(([, v]) => v);
      const minV = values.length ? Math.min(...values) : 0;
      const maxV = values.length ? Math.max(...values) : 1;
      const pad = (maxV - minV) * 0.1 || 1;

      chart.setOption({
        backgroundColor: "transparent",
        grid: { top: 8, right: 12, bottom: 28, left: 48 },
        tooltip: {
          trigger: "axis",
          formatter: (params: any[]) => {
            const p = params[0];
            return `${new Date(p.axisValue).toLocaleString("el-GR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}<br/>${p.seriesName}: <b>${p.value?.[1] ?? "—"}</b> ${s.unit ?? ""}`;
          },
        },
        xAxis: {
          type: "time",
          axisLabel: { fontSize: 10, color: "#8892b0", formatter: (val: number) => new Date(val).toLocaleDateString("el-GR", { month: "2-digit", day: "2-digit" }) },
          axisLine: { lineStyle: { color: "#2e3147" } },
          splitLine: { show: false },
        },
        yAxis: {
          type: "value",
          min: parseFloat((minV - pad).toFixed(2)),
          max: parseFloat((maxV + pad).toFixed(2)),
          axisLabel: { fontSize: 10, color: "#8892b0" },
          axisLine: { lineStyle: { color: "#2e3147" } },
          splitLine: { lineStyle: { color: "#2e3147", type: "dashed" } },
        },
        series: [{
          name: s.name,
          type: "line",
          data: s.data.map(([t, v]) => [new Date(t).getTime(), v]),
          smooth: true,
          symbol: "none",
          lineStyle: { color: s.color ?? "#4f8ef7", width: 2 },
          areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: (s.color ?? "#4f8ef7") + "55" }, { offset: 1, color: "transparent" }] } },
        }],
      });

      const ro = new ResizeObserver(() => chart.resize());
      ro.observe(canvasRef.current!);
      return () => ro.disconnect();
    });

    return () => { chart?.dispose(); };
  }, [s]);

  return (
    <div style={{ background: "var(--surface)", padding: "10px 4px 4px" }}>
      <div style={{ fontSize: 11, color: "var(--text-dim)", paddingLeft: 10, marginBottom: 4 }}>
        {s.name.replace(/_/g, " ")} {s.unit ? `(${s.unit})` : ""}
      </div>
      <div ref={canvasRef} style={{ height: 120, width: "100%" }} />
    </div>
  );
}

// ── Series extraction from simulation log ─────────────────────────────────────

const INDICATOR_COLORS: Record<string, string> = {
  vpd: "#ffd54f", ipsi: "#42a5f5", bpi: "#3ecf6e",
  fir: "#ef5350", gdd: "#ab47bc", infection_hours: "#ff7043",
  air_temperature: "#ef5350", air_humidity: "#42a5f5",
  soil_moisture1: "#66bb6a", soil_moisture2: "#26a69a",
  light_intensity: "#ffd54f", rain_height: "#29b6f6",
};

function extractSeries(log: SimulationHourOutput[], devices: DeviceDataset[]) {
  type BundleShape = { shared?: Record<string, any>; crops?: Array<{ id: string; indicators?: Record<string, any> }> };

  const sharedKeys = new Set<string>();
  const cropMap = new Map<string, Set<string>>();

  for (const entry of log) {
    const bundle = entry.fieldBundle as BundleShape | null;
    if (!bundle) continue;
    if (bundle.shared) Object.keys(bundle.shared).forEach((k) => sharedKeys.add(k));
    if (bundle.crops) {
      for (const crop of bundle.crops) {
        if (!cropMap.has(crop.id)) cropMap.set(crop.id, new Set());
        if (crop.indicators) Object.keys(crop.indicators).forEach((k) => cropMap.get(crop.id)!.add(k));
      }
    }
  }

  function buildSeries(key: string, getValue: (entry: SimulationHourOutput) => number | null): SeriesInfo {
    const data = log.map((e) => [e.isoTime, getValue(e)] as [string, number | null]);
    return { name: key, data, color: INDICATOR_COLORS[key.split("_")[0]] };
  }

  const sharedSeries = Array.from(sharedKeys).map((k) =>
    buildSeries(k, (e) => {
      const v = (e.fieldBundle as BundleShape)?.shared?.[k];
      const val = v?.value ?? v;
      return typeof val === "number" ? val : null;
    })
  );

  const cropSeries = Array.from(cropMap.entries()).map(([cropId, keys]) => ({
    cropId,
    series: Array.from(keys).map((k) =>
      buildSeries(k, (e) => {
        const crop = (e.fieldBundle as BundleShape)?.crops?.find((c) => c.id === cropId);
        const v = crop?.indicators?.[k];
        const val = v?.value ?? v;
        return typeof val === "number" ? val : null;
      })
    ),
  }));

  // Sensor series from dataset (first device that has each variable)
  const sensorKeys = ["air_temperature", "air_humidity", "soil_moisture1", "soil_moisture2", "light_intensity", "rain_height", "leaf_moisture"];
  const sensorSeries: SeriesInfo[] = [];
  for (const key of sensorKeys) {
    for (const dev of devices) {
      if (dev.data[key]) {
        const data = dev.data[key].map((p) => [p.time, p.value] as [string, number]);
        sensorSeries.push({ name: key, data, unit: dev.data[key][0]?.unit, color: INDICATOR_COLORS[key] });
        break;
      }
    }
  }

  return { sharedSeries, cropSeries, sensorSeries };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function LoadingPlaceholder({ text }: { text: string }) {
  return (
    <div className="empty-state" style={{ height: "100%" }}>
      <div className="spinner" />
      <span>{text}</span>
    </div>
  );
}

function toDatetimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
