// src/MeasurementModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
// [QW-7 legacy-handoff] xlsx (SheetJS 0.18.5) removed — CVE-2023-30533 + CVE-2024-22363, ~500 KB
// for one export button. Replaced by an inline CSV writer below (Excel opens CSV; BOM keeps Greek).
import "./Modals.css";
import { getVarConfig, getUnitOptionsFor } from "./config/variablesConfig";

export type TimePoint = {
  t: number; // timestamp (ms since epoch)
  v: number; // numeric value in "raw" units (e.g. km/h, °C, %)
};

export type RefLine = {
  /** Raw value (same base as series.v before conversionFn) */
  value: number;
  /** Label shown on the plot */
  label: string;
  /** If true, render dashed line (default: true) */
  dashed?: boolean;
};

type FetchedHistory = {
  variable: string;
  deviceId: string;
  startMs: number;
  endMs: number;
  truncated?: boolean;
  time?: string | null;
  points: TimePoint[];
};

type MeasurementModalProps = {
  open: boolean;
  variable: string | null;
  label: string;
  series: TimePoint[]; // time series for THIS measurement (already in the unit you want to display)
  unit?: string; // optional; if omitted, we try to infer from variablesConfig
  /** Optional horizontal reference lines (e.g. thresholds). Values must be in RAW units. */
  refLines?: RefLine[];
  /** Device this plot belongs to — target for on-demand range fetches. */
  deviceId?: string | null;
  /** Ask the backend (analysis) to fetch an arbitrary [start,end] range for this device+variable. */
  onFetchRange?: (deviceId: string, variable: string, startMs: number, endMs: number) => void;
  /** Latest history_request response from the backend; rendered when it matches this plot. */
  fetchedHistory?: FetchedHistory | null;
  onClose: () => void;
};

// Convert a millisecond zoom window into dataZoom start/end PERCENTAGES relative to the current
// data span. Percentages merge cleanly into ECharts and are honored reliably on a time axis —
// unlike startValue/endValue, which silently failed to move the chart here.
function msWindowToPercent(
  win: { start: number; end: number } | null,
  pairs: [number, number][],
): { start: number; end: number } {
  if (!win || !pairs.length) return { start: 0, end: 100 };
  const ts = pairs.map(([t]) => (typeof t === "number" ? t : new Date(t).getTime()));
  const lo = Math.min(...ts);
  const hi = Math.max(...ts);
  const span = hi - lo || 1;
  const clamp = (x: number) => Math.max(0, Math.min(100, x));
  return {
    start: clamp(((win.start - lo) / span) * 100),
    end: clamp(((win.end - lo) / span) * 100),
  };
}

export const MeasurementModal: React.FC<MeasurementModalProps> = ({
  open,
  variable,
  label,
  series,
  unit,
  refLines,
  deviceId,
  onFetchRange,
  fetchedHistory,
  onClose,
}) => {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  // The user's applied zoom window (ms). Baked into the dataZoom option on every re-render so a
  // realtime data update doesn't reset the view to the full range. null = full/auto.
  const zoomMsRef = useRef<{ start: number; end: number } | null>(null);

// Config from variablesConfig (fallback if variable is null/unknown)
const varConfig = useMemo(
  () => getVarConfig(variable || ""),
  [variable],
);

// Available units + initial (defaultUnit or overridden by prop `unit`)
const { options: unitOptions, initial: initialUnit } = useMemo(
  () => getUnitOptionsFor(variable || "", unit),
  [variable, unit],
);

// Currently selected unit
const [selectedUnit, setSelectedUnit] = useState(initialUnit);

// Reset selected unit whenever variable or initialUnit changes
useEffect(() => {
  setSelectedUnit(initialUnit);
}, [initialUnit]);

// Effective unit label for UI
const unitLabel = selectedUnit ?? "";
const categoricalLabels: string[] | undefined =
  (varConfig.categorical && unitLabel
    ? varConfig.categorical[unitLabel]
    : undefined);

// Conversion function from "raw" value -> selected unit
const conversionFn = useMemo(() => {
  const fn =
    (varConfig.conversions &&
      (varConfig.conversions as any)[selectedUnit]) ||
    ((v: number) => v);

  return (value: number) => {
    if (value == null) return NaN;
    try {
      return fn(value);
    } catch {
      return value;
    }
  };
}, [varConfig, selectedUnit]);

// On-demand fetched range. When a backend history_request response arrives for this plot we
// render it INSTEAD of the pushed `series` (which is capped to the widget's recent window).
const [overrideSeries, setOverrideSeries] = useState<TimePoint[] | null>(null);
const [fetching, setFetching] = useState(false);
const [fetchNote, setFetchNote] = useState<string | null>(null);
const pendingFetchRef = useRef(false);

const displaySeries = overrideSeries ?? series;

// ECharts data pairs in the SELECTED unit
const dataPairs = useMemo(
  () => displaySeries.map((p) => [p.t, conversionFn(p.v)] as [number, number]),
  [displaySeries, conversionFn],
);

// Convert ref lines to selected unit as well (so they follow the unit selector)
const convertedRefLines = useMemo(() => {
  const lines = Array.isArray(refLines) ? refLines : [];
  return lines
    .filter((l) => l && Number.isFinite(l.value))
    .map((l) => ({
      ...l,
      converted: conversionFn(l.value),
      dashed: l.dashed !== false,
    }))
    .filter((l) => Number.isFinite((l as any).converted));
}, [refLines, conversionFn]);



  // Formatting helpers
  const fmtNum = (x: number | null | undefined) => {
    if (x === null || x === undefined || !Number.isFinite(x)) return "—";
    return new Intl.NumberFormat("el-GR", { maximumFractionDigits: 3 }).format(
      x,
    );
  };

  const fmtDate = (ms: number | null | undefined) => {
    if (!ms && ms !== 0) return "—";
    return new Intl.DateTimeFormat("el-GR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(ms));
  };

  const fmtDateLocal = (ms: number) => {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate(),
    )} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  // Compute stats for a visible range
  const computeStatsInRange = (xMin: number, xMax: number) => {
    let cnt = 0;
    let sum = 0;
    let max = -Infinity;
    let min = Infinity;
    let lastVal: number | null = null;
    let lastTs: number | null = null;

    for (const [t, v] of dataPairs) {
      const tt = typeof t === "number" ? t : new Date(t).getTime();
      const vv = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(tt) || !Number.isFinite(vv)) continue;
      if (tt < xMin || tt > xMax) continue;

      sum += vv;
      cnt++;
      if (vv > max) max = vv;
      if (vv < min) min = vv;
      lastVal = vv;
      lastTs = tt;
    }

    if (!cnt) {
      return {
        last: null,
        lastTs: null,
        avg: null,
        sum: null,
        max: null,
        min: null,
      };
    }

    return {
      last: lastVal,
      lastTs,
      avg: sum / cnt,
      sum,
      max,
      min,
    };
  };

  // Attach / update ECharts
  useEffect(() => {
    if (!open) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
      return;
    }

    if (!chartRef.current) return;

    let chart = chartInstanceRef.current;
    if (!chart) {
      const existing = echarts.getInstanceByDom(chartRef.current);
      if (existing) existing.dispose();

      chart = echarts.init(chartRef.current, undefined, { renderer: "canvas" });
      chartInstanceRef.current = chart;
    }

    const option: echarts.EChartsCoreOption = {
      backgroundColor: "#ffffff",
      grid: { left: 48, right: 24, top: 24, bottom: 40, containLabel: true },
      tooltip: {
  trigger: "axis",
  axisPointer: { type: "cross" },
  formatter: (params: any[]) => {
    const seen = new Set<string>();
    const uniq = params.filter(p => {
      const key = p.seriesId ?? p.seriesName;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const header = uniq[0]?.axisValueLabel ?? "";
    const lines = uniq.map(p => {
      const num = Number(p.data?.[1] ?? p.value);
      const valStr = categoricalLabels && Number.isFinite(num)
        ? (categoricalLabels[Math.round(num)] ?? "—")
        : `${fmtNum(num)}${unitLabel ? ` ${unitLabel}` : ""}`;
      return `${p.marker}${p.seriesName} ${valStr}`;
    });

    return [header, ...lines].join("<br/>");
  },
},


      xAxis: {
        type: "time",
        axisLabel: { hideOverlap: true },
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLabel: {
          formatter: (v: number) => {
            if (categoricalLabels && Number.isFinite(v)) {
              const idx = Math.round(v);
              return categoricalLabels[idx] ?? "";
            }
            return fmtNum(v);
          },
        },
      },
      dataZoom: (() => {
        const dz = msWindowToPercent(zoomMsRef.current, dataPairs);
        return [
          { type: "inside", filterMode: "filter", start: dz.start, end: dz.end },
          { type: "slider", height: 18, bottom: 8, filterMode: "filter", start: dz.start, end: dz.end },
        ];
      })(),
      series: [
        {
          id: "main",
          name: label,
          type: "line",
          showSymbol: false,
          smooth: 0.25,
          sampling: "lttb",
          lineStyle: { width: 2 },
          areaStyle: { opacity: 0.08 },
          data: dataPairs,
          ...(convertedRefLines.length
            ? {
                markLine: {
                  silent: true,
                  symbol: ["none", "none"],
                  lineStyle: {
                    width: 2,
                    type: "dashed",
                  },
                  label: {
                    show: true,
                    formatter: (p: any) => {
                      const name = String(p?.name ?? "");
                      const vv = Number(p?.value ?? p?.data?.value);
                      const display = categoricalLabels && Number.isFinite(vv)
                        ? (categoricalLabels[Math.round(vv)] ?? "—")
                        : `${fmtNum(vv)}${unitLabel ? ` ${unitLabel}` : ""}`;
                      return name ? `${name}: ${display}` : display;
                    },
                  },
                  data: convertedRefLines.map((l) => ({
                    name: l.label,
                    yAxis: (l as any).converted,
                    lineStyle: { type: l.dashed ? "dashed" : "solid" },
                  })),
                },
              }
            : {}),
        },
      ],
    };

    chart.clear();
    chart.setOption(option, {
      notMerge: true,
      replaceMerge: ["series"],
    });

    console.log("series.length =", (chart.getOption().series as any[])?.length);

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, [open, label, unitLabel, dataPairs, categoricalLabels, convertedRefLines]);

  // Zoom range inputs (datetime-local strings)
  const msToDatetimeLocal = (ms: number) => {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const datetimeLocalToMs = (s: string) => new Date(s).getTime();

  const isApplyingZoom = useRef(false);
  const didInitZoomRef = useRef(false);
  const [zoomRange, setZoomRange] = useState({ start: "", end: "" });
  const [zoomError, setZoomError] = useState<string | null>(null);

  // Initialise the zoom range to the full data range ONCE per modal-open. Doing it on every
  // dataPairs change (realtime ticks) wiped whatever the user typed into the Από/Έως fields.
  useEffect(() => {
    if (!open) {
      didInitZoomRef.current = false; // re-initialise next time the modal opens
      zoomMsRef.current = null; // reopen at full range
      return;
    }
    if (didInitZoomRef.current || !dataPairs.length) return;
    const allTs = dataPairs.map(([t]) => t as number);
    setZoomRange({
      start: msToDatetimeLocal(Math.min(...allTs)),
      end: msToDatetimeLocal(Math.max(...allTs)),
    });
    setZoomError(null);
    didInitZoomRef.current = true;
  }, [open, dataPairs]);

  const handleZoomRangeChange = (field: "start" | "end", value: string) => {
    const newRange = { ...zoomRange, [field]: value };
    const startMs = datetimeLocalToMs(newRange.start);
    const endMs = datetimeLocalToMs(newRange.end);

    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      setZoomRange(newRange); // let the field update visually (still typing)
      return;
    }
    if (startMs >= endMs) {
      // Transient while the user is still editing a field — keep the text, don't apply, don't nag.
      setZoomRange(newRange);
      return;
    }

    setZoomError(null);
    setZoomRange(newRange);
    zoomMsRef.current = { start: startMs, end: endMs }; // persist so realtime re-renders keep it
    const chart = chartInstanceRef.current;
    if (!chart) return;
    // Apply on the existing chart via a merged setOption using PERCENT start/end. dispatchAction
    // with startValue/endValue did not move the time axis here; percentages do, and merge updates
    // both the inside + slider dataZoom components at once.
    const dz = msWindowToPercent(zoomMsRef.current, dataPairs);
    isApplyingZoom.current = true;
    chart.setOption({
      dataZoom: [
        { start: dz.start, end: dz.end },
        { start: dz.start, end: dz.end },
      ],
    });
    // The dataZoom event this triggers can fire asynchronously; clear the guard next tick so
    // syncInputsFromChart doesn't overwrite the range the user just typed.
    setTimeout(() => { isApplyingZoom.current = false; }, 0);
  };

  // Live stats for current zoom window
  const [stats, setStats] = useState(() => ({
    last: null as number | null,
    lastTs: null as number | null,
    avg: null as number | null,
    sum: null as number | null,
    max: null as number | null,
    min: null as number | null,
  }));

  useEffect(() => {
    if (!open || !chartInstanceRef.current || !dataPairs.length) return;

    const chart = chartInstanceRef.current;

    // Source of truth for the visible window: the dataZoom component's own start/end.
    // NOT xAxis.scale.getExtent() — with filterMode:"none" that returns the FULL data extent
    // regardless of the current zoom, which silently reset the user's typed Από/Έως range back
    // to the full span (and reset zoomMsRef), so typing a date "only changed the hours".
    const readZoomWindow = (): [number, number] => {
      const allTs = dataPairs.map(([t]) =>
        typeof t === "number" ? t : new Date(t).getTime(),
      );
      const dataMin = Math.min(...allTs);
      const dataMax = Math.max(...allTs);
      try {
        const opt: any = chart.getOption();
        const dz = (opt.dataZoom && opt.dataZoom[0]) || {};
        if (dz.startValue != null && dz.endValue != null) {
          return [
            Math.min(dz.startValue, dz.endValue),
            Math.max(dz.startValue, dz.endValue),
          ];
        }
        const s = typeof dz.start === "number" ? dz.start : 0;
        const e = typeof dz.end === "number" ? dz.end : 100;
        const span = dataMax - dataMin;
        return [dataMin + (span * s) / 100, dataMin + (span * e) / 100];
      } catch {
        return [dataMin, dataMax];
      }
    };

    // Stats always reflect the AUTHORITATIVE applied window (zoomMsRef, absolute ms) — not a
    // percent round-trip off the chart, which drifts as realtime ticks grow the data span and
    // produced a single-point (avg=max=min) reading.
    const recompute = () => {
      const win = zoomMsRef.current;
      let xMin: number;
      let xMax: number;
      if (win) {
        xMin = Math.min(win.start, win.end);
        xMax = Math.max(win.start, win.end);
      } else {
        const ts = dataPairs.map(([t]) =>
          typeof t === "number" ? t : new Date(t).getTime(),
        );
        xMin = Math.min(...ts);
        xMax = Math.max(...ts);
      }
      setStats(computeStatsInRange(xMin, xMax));
    };

    // initial stats
    recompute();

    // Only an actual zoom ("dataZoom") pushes the visible window back into the Από/Έως inputs.
    // "finished" fires on every render (incl. realtime updates); binding the sync there overwrote
    // the user's typed range — so it now only refreshes the stats.
    const syncInputsFromChart = () => {
      recompute();
      if (isApplyingZoom.current) return;
      const [a, b] = readZoomWindow();
      if (Number.isFinite(a) && Number.isFinite(b)) {
        zoomMsRef.current = { start: a, end: b }; // persist mouse zoom too
        setZoomRange({
          start: msToDatetimeLocal(a),
          end: msToDatetimeLocal(b),
        });
      }
    };

    chart.on("dataZoom", syncInputsFromChart);
    chart.on("finished", recompute);

    return () => {
      chart.off("dataZoom", syncInputsFromChart);
      chart.off("finished", recompute);
    };
  }, [open, dataPairs]);

  const handleResetZoom = () => {
    if (!chartInstanceRef.current) return;
    // Drop any fetched range and return to the live pushed window.
    setOverrideSeries(null);
    setFetchNote(null);
    zoomMsRef.current = null; // back to full/auto — stop pinning the window on re-renders
    isApplyingZoom.current = true;
    chartInstanceRef.current.setOption({
      dataZoom: [
        { start: 0, end: 100 },
        { start: 0, end: 100 },
      ],
    });
    setTimeout(() => { isApplyingZoom.current = false; }, 0);
    // Reset returns to the live pushed data, so derive the input range from `series` (not the
    // fetched override we just cleared).
    if (series.length) {
      const allTs = series.map((p) => p.t);
      setZoomRange({
        start: msToDatetimeLocal(Math.min(...allTs)),
        end: msToDatetimeLocal(Math.max(...allTs)),
      });
    }
  };

  // Drop any fetched override whenever the plot switches variable or (re)opens.
  useEffect(() => {
    setOverrideSeries(null);
    setFetching(false);
    setFetchNote(null);
    pendingFetchRef.current = false;
  }, [variable, open]);

  // Apply a backend history response only when WE requested one and it matches this plot. Show the
  // WHOLE fetched range: set zoomMsRef=null (full/auto) and let the override-zoom effect below
  // force the view to 0–100% once the chart has been rebuilt with the fetched data.
  useEffect(() => {
    if (!open || !pendingFetchRef.current || !fetchedHistory) return;
    if (fetchedHistory.variable !== variable) return;
    if (deviceId && fetchedHistory.deviceId && fetchedHistory.deviceId !== deviceId) return;

    pendingFetchRef.current = false;
    setFetching(false);

    const pts = fetchedHistory.points;
    if (pts.length) {
      isApplyingZoom.current = true; // guard the rebuild + forced reset from the sync handler
      setOverrideSeries(pts);
      zoomMsRef.current = null; // full range of the fetched data
      setZoomRange({
        start: msToDatetimeLocal(pts[0].t),
        end: msToDatetimeLocal(pts[pts.length - 1].t),
      });
    }

    setFetchNote(
      !pts.length
        ? "Δεν βρέθηκαν δεδομένα για το επιλεγμένο διάστημα."
        : fetchedHistory.truncated
          ? "Εμφανίζονται δειγματοληπτημένα δεδομένα (μεγάλο διάστημα)."
          : null,
    );
  }, [fetchedHistory, open, variable, deviceId]);

  // After a fetched override rebuilds the chart (chart effect runs first — declared earlier), force
  // the view to the full fetched range and release the zoom guard. Without this, a transitional
  // dataZoom event during the rebuild could repin zoomMsRef to a stale (narrow) window.
  useEffect(() => {
    if (!overrideSeries || !overrideSeries.length) return;
    const chart = chartInstanceRef.current;
    if (chart) {
      chart.setOption({
        dataZoom: [
          { start: 0, end: 100 },
          { start: 0, end: 100 },
        ],
      });
    }
    const id = setTimeout(() => { isApplyingZoom.current = false; }, 0);
    return () => clearTimeout(id);
  }, [overrideSeries]);

  // "Φόρτωση" — ask the backend to fetch the currently-typed Από/Έως range for this device+var.
  const handleFetchRange = () => {
    if (!onFetchRange || !variable || !deviceId) return;
    const startMs = datetimeLocalToMs(zoomRange.start);
    const endMs = datetimeLocalToMs(zoomRange.end);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
      setZoomError("Επιλέξτε έγκυρο διάστημα (Από πριν το Έως) για φόρτωση.");
      return;
    }
    setZoomError(null);
    setFetchNote(null);
    setFetching(true);
    pendingFetchRef.current = true;
    onFetchRange(deviceId, variable, startMs, endMs);
  };

const handleExportCSV = () => {
  // [QW-7] Inline CSV export (was xlsx/SheetJS). The export is a 2-column table; CSV needs no
  // third-party code, removes ~500 KB from the mobile bundle, and drops the CVE surface.
  if (!displaySeries.length) {
    alert("Δεν υπάρχουν δεδομένα για εξαγωγή.");
    return;
  }

  const safeVar = variable || "measurement";
  const fileName = `data_${safeVar}.csv`;

  // Sort by time just in case
  const sorted = [...displaySeries].sort((a, b) => a.t - b.t);

  const header = ["Χρόνος", `${label}${unitLabel ? ` [${unitLabel}]` : ""}`];
  const rows: (string | number | null)[][] = [header];
  for (const p of sorted) {
    const val = conversionFn(p.v);
    rows.push([fmtDateLocal(p.t), Number.isFinite(val) ? val : null]);
  }

  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  // UTF-8 BOM so Excel preserves Greek characters.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.target = "_blank"; // helps mobile / WebView
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.error("CSV export failed:", err);
    alert("Δεν ήταν δυνατή η εξαγωγή CSV σε αυτό το περιβάλλον.");
  } finally {
    URL.revokeObjectURL(url);
  }
};
  // Τι θα εμφανιστεί ως "Τελευταία" τιμή στο badge
  const lastDisplay =
    categoricalLabels &&
    stats.last !== null &&
    typeof stats.last === "number" &&
    Number.isFinite(stats.last)
      ? // Αν έχουμε κατηγορίες (π.χ. COMPASS16) και αριθμητικό index
        (categoricalLabels[Math.round(stats.last)] ?? "—")
      : // Αλλιώς, δείξε κανονικό αριθμό
      stats.last !== null
        ? fmtNum(stats.last)
        : "—";
  if (!open) return null;

  return (
    <div className="ag-modal-backdrop" onClick={onClose}>
      <div
        className="ag-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ag-modal-header">
          <div>
            <h2>{label}</h2>
            {variable && (
              <div className="ag-modal-subtitle">
                variable: <code>{variable}</code>
              </div>
            )}
          </div>
          
          <button
            className="ag-modal-close ag-modal-close-topright"
            type="button"
            onClick={onClose}
            aria-label="Κλείσιμο"
          >
            ✕
          </button>
        </div>

        <div className="ag-modal-body">
          {dataPairs.length === 0 ? (
            <p>Δεν υπάρχουν δεδομένα για τη συγκεκριμένη μέτρηση.</p>
          ) : (
            <>
              {/* Last value + time for current zoom */}
              <div className="lastBadge">
                <span className="lv-label">Τελευταία:</span>

                {/* Αν έχουμε categorical labels (π.χ. 16-σημεία), δείξε την ετικέτα.
                    Αλλιώς, δείξε αριθμητική τιμή με μονάδα. */}
                <span className="lv-value">{lastDisplay}</span>

                <span className="lv-unit">
                  {/* Για κατηγορικά, δεν θέλουμε να γράφουμε π.χ. "Β 16-σημεία" */}
                  {categoricalLabels ? "" : unitLabel}
                </span>

                <span className="lv-time">
                  {stats.lastTs ? "• " + fmtDate(stats.lastTs) : ""}
                </span>
              </div>

              {/* Stats row – visibility controlled by variablesConfig flags */}
              <div className="statsWrap">
  {/* Unit selector (only if more than one option) */}
  {unitOptions.length > 1 && (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        marginRight: 12,
      }}
    >
      <span className="s-label">Μονάδα:</span>
      <select
        value={selectedUnit}
        onChange={(e) => setSelectedUnit(e.target.value)}
        style={{ padding: "2px 4px" }}
      >
        {unitOptions.map((u) => (
          <option key={u} value={u}>
            {u || "(χωρίς μονάδα)"}
          </option>
        ))}
      </select>
    </div>
  )}

  {varConfig.showAverage && (
    <div className="statBadge">
      <span className="s-label">Μέσος:</span>
      <span className="s-val">
        {stats.avg !== null ? `${fmtNum(stats.avg)} ${unitLabel}` : "—"}
      </span>
    </div>
  )}

  {varConfig.showSum && (
    <div className="statBadge">
      <span className="s-label">Σύνολο:</span>
      <span className="s-val">
        {stats.sum !== null ? `${fmtNum(stats.sum)} ${unitLabel}` : "—"}
      </span>
    </div>
  )}

  {varConfig.showMax && (
    <div className="statBadge">
      <span className="s-label">Μέγιστο:</span>
      <span className="s-val">
        {stats.max !== null ? `${fmtNum(stats.max)} ${unitLabel}` : "—"}
      </span>
    </div>
  )}

  {varConfig.showMin && (
    <div className="statBadge">
      <span className="s-label">Ελάχιστο:</span>
      <span className="s-val">
        {stats.min !== null ? `${fmtNum(stats.min)} ${unitLabel}` : "—"}
      </span>
    </div>
  )}

</div>



              {/* Zoom range controls + action buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, fontSize: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#666" }}>Από:</span>
                    <input
                      type="datetime-local"
                      value={zoomRange.start}
                      onChange={(e) => handleZoomRangeChange("start", e.target.value)}
                      style={{ fontSize: 12, padding: "2px 4px" }}
                    />
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#666" }}>Έως:</span>
                    <input
                      type="datetime-local"
                      value={zoomRange.end}
                      onChange={(e) => handleZoomRangeChange("end", e.target.value)}
                      style={{ fontSize: 12, padding: "2px 4px" }}
                    />
                  </label>
                  {zoomError && (
                    <span style={{ color: "#c0392b", fontSize: 11 }}>{zoomError}</span>
                  )}
                  {fetchNote && (
                    <span style={{ color: "#8a6d3b", fontSize: 11 }}>{fetchNote}</span>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                    {onFetchRange && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={handleFetchRange}
                        disabled={fetching || !variable || !deviceId}
                        title="Φόρτωση δεδομένων για το επιλεγμένο διάστημα (Από/Έως)"
                      >
                        {fetching ? "Φόρτωση…" : "Φόρτωση"}
                      </button>
                    )}
                    <button type="button" className="secondary" onClick={handleResetZoom}>
                      Reset Zoom
                    </button>
                    <button type="button" className="secondary" onClick={handleExportCSV}>
                      Εξαγωγή CSV
                    </button>
                  </div>
                </div>
              </div>

              {/* Chart */}
              <div ref={chartRef} className="ag-modal-chart" />

            </>
          )}
        </div>
      </div>
    </div>
  );
};
