// src/DeviceMeasurementsModal.grid.tsx
import React, { useMemo } from "react";
import "./Modals.css";
import "./Dashboard.css"; // reuse modal/reset styles
import { TimePoint } from "./MeasurementModal";
import { getVarConfig, VARIABLES_CONFIG } from "./config/variablesConfig";

// Cloud + rain-drops icon for rainfall cards (inline SVG → consistent across platforms).
const RainDropletsIcon: React.FC = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M7.5 14a3.5 3.5 0 0 1-.4-6.98 4.5 4.5 0 0 1 8.72-1.02A3.75 3.75 0 0 1 16 14H7.5z"
      fill="currentColor"
      fillOpacity="0.95"
    />
    <path
      d="M8 16.5l-1 2.2M12 16.5l-1 2.2M16 16.5l-1 2.2"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </svg>
);

type Props = {
  open: boolean;
  deviceId: string | null;
  deviceName: string;
  history: Record<string, Record<string, TimePoint[]>>;
  /** vars_table (from widget params), used only as filter/order – labels come from variablesConfig */
  measTable: Map<string, { label: string; tab: number }>;
  onSelectMeasurement: (variable: string, label: string) => void;
  onClose: () => void;
};

export const DeviceMeasurementsModal: React.FC<Props> = ({
  open,
  deviceId,
  deviceName,
  history,
  measTable,
  onSelectMeasurement,
  onClose,
}) => {
  const varsForDevice = useMemo(() => {
    if (!deviceId) return [] as string[];

    const devHist = history[deviceId] || {};
    const allVars = Object.keys(devHist);
    if (!allVars.length) return [];

    // If fertility_indexX exists for this device, suppress the raw conduct_soilX
    const fertilityChannels = new Set(
      allVars.flatMap((v) => {
        const m = v.match(/^fertility_index(\d+)$/);
        return m ? [m[1]] : [];
      }),
    );

    // Only variables that are explicitly configured / plottable
    const plottable = allVars.filter((v) => {
      if (!Object.prototype.hasOwnProperty.call(VARIABLES_CONFIG, v)) return false;
      const m = v.match(/^conduct_soil(\d+)$/);
      if (m && fertilityChannels.has(m[1])) return false;
      return true;
    });

    if (!plottable.length) return [];

    // Use measTable to order (and optionally "prioritize") vars, not to hide them.
    const inTable = plottable.filter((v) => measTable.has(v));
    const notInTable = plottable.filter((v) => !measTable.has(v));

    inTable.sort((a, b) =>
      getVarConfig(a).label.localeCompare(getVarConfig(b).label, "el"),
    );

    // Rain cards follow a fixed chronological order (today → week → month → year, then the
    // rolling totals) to match the weather-station design; other cards stay alphabetical.
    const RAIN_ORDER = [
      "current_rain_height_daily",
      "current_rain_height_weekly",
      "current_rain_height_monthly",
      "current_rain_height_yearly",
      "rain_height_hourly",
      "rain_height",
      "rain_height_daily",
      "rain_height_weekly",
      "rain_height_monthly",
      "rain_height_yearly",
    ];
    const isRainVar = (v: string) => /^(rain_height|current_rain_height)/.test(v);
    const rainRank = (v: string) => {
      const i = RAIN_ORDER.indexOf(v);
      return i >= 0 ? i : RAIN_ORDER.length;
    };
    const rainVars = notInTable.filter(isRainVar).sort((a, b) => rainRank(a) - rainRank(b));
    const otherVars = notInTable
      .filter((v) => !isRainVar(v))
      .sort((a, b) => getVarConfig(a).label.localeCompare(getVarConfig(b).label, "el"));

    return [...inTable, ...rainVars, ...otherVars];
  }, [deviceId, history, measTable]);
  

  if (!open) return null;

  function latestOf(variable: string): TimePoint | null {
    const arr = history?.[deviceId || ""]?.[variable];
    if (!arr || !arr.length) return null;
    return arr[arr.length - 1];
  }

  function formatValue(variable: string, v: number | null): string {
    if (v == null) return "—";

    const cfg = getVarConfig(variable);
    const unit = cfg?.defaultUnit || "";

    // Convert raw -> default unit if we have a conversion
    const conv =
      (cfg.conversions && cfg.conversions[unit]) ||
      ((x: number) => x);

    const numeric = conv(v);

    // If we have categorical labels for this unit (e.g. windDir)
    const cat = cfg.categorical?.[unit];
    if (cat && Number.isFinite(numeric)) {
      const idx = Math.round(numeric);
      const label = cat[idx];
      return label ?? "—";
    }

    // Otherwise, format as numeric + unit (current behavior)
    const val =
      Math.abs(numeric) >= 100 ? numeric.toFixed(0) :
      Math.abs(numeric) >= 10 ? numeric.toFixed(1) :
      Math.abs(numeric) >= 1 ? numeric.toFixed(2) : numeric.toFixed(3);
    return unit ? `${val} ${unit}` : val;
  }


  function formatTime(t?: number): string {
    if (!t) return "";
    try {
      const d = new Date(t);
      return d.toLocaleString();
    } catch {
      return "";
    }
  }

  return (
    <div className="ag-modal-backdrop" role="dialog" aria-modal="true">
      <div className="ag-modal-content">
        <div className="ag-modal-header">
          <h3>{deviceName || "Συσκευή"}</h3>
          
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
          {varsForDevice.length === 0 ? (
            <div className="ag-irrig-empty">
              Δεν υπάρχουν μετρήσεις για αυτή τη συσκευή.
            </div>
          ) : (
            <div className="meas-grid" role="list">
              {varsForDevice.map((variable) => {
                const cfg = getVarConfig(variable);
                const latest = latestOf(variable);
                const value = latest ? formatValue(variable, latest.v) : "—";
                const label = cfg.label;
                // Rain measurements get a distinct cloud/rain icon; "today" is highlighted.
                const isRain = /^(rain_height|current_rain_height)/.test(variable);
                const isRainToday = variable === "current_rain_height_daily";
                const displayLabel = isRain ? label.replace(/^🌧️?\s*/, "") : label;
                const className =
                  "meas-card" +
                  (isRain ? " meas-card--rain" : "") +
                  (isRainToday ? " meas-card--rain-today" : "");
                return (
                  <button
                    key={variable}
                    className={className}
                    role="listitem"
                    onClick={() => onSelectMeasurement(variable, label)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectMeasurement(variable, label);
                      }
                    }}
                    aria-label={`${displayLabel} ${value}`}
                  >
                    {isRain && (
                      <span className="meas-card__rain-icon" aria-hidden="true">
                        <RainDropletsIcon />
                      </span>
                    )}
                    <div className="meas-card__title">{displayLabel}</div>
                    <div className="meas-card__value">{value}</div>
                    <div className="meas-card__time">
                      {latest ? formatTime(latest.t) : "—"}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
