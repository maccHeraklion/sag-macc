// src/AllMeasurementsModal.grid.tsx
import React, { useMemo } from "react";
import "./Modals.css";
import "./Dashboard.css";
import { TimePoint } from "./MeasurementModal";
import { getVarConfig, VARIABLES_CONFIG } from "./config/variablesConfig";

function colorFor(id: string): string {
  // deterministic hue per deviceId
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  // nice, saturated but not neon
  return `hsl(${hue} 65% 45%)`;
}

type Props = {
  open: boolean;
  /** list of device ids to include */
  deviceIds: string[];
  /** map deviceId -> friendly name */
  deviceNameOf: (id: string) => string;
  history: Record<string, Record<string, TimePoint[]>>;
  /** vars_table (from widget params) used to order/prioritize */
  measTable: Map<string, { label: string; tab: number }>;
  /** when user clicks a card */
  onSelectMeasurement: (deviceId: string, variable: string, label: string) => void;
  onClose: () => void;
};

type CardItem = {
  deviceId: string;
  deviceName: string;
  variable: string;
  label: string;
  latest: TimePoint | null;
};

export const AllMeasurementsModal: React.FC<Props> = ({
  open,
  deviceIds,
  deviceNameOf,
  history,
  measTable,
  onSelectMeasurement,
  onClose,
}) => {
  const items = useMemo<CardItem[]>(() => {
    const out: CardItem[] = [];
    for (const id of deviceIds) {
      const devHist = history[id] || {};
      const allVars = Object.keys(devHist);
      if (!allVars.length) continue;

      // If fertility_indexX exists for this device, suppress the raw conduct_soilX
      const fertilityChannels = new Set(
        allVars.flatMap((v) => {
          const m = v.match(/^fertility_index(\d+)$/);
          return m ? [m[1]] : [];
        }),
      );

      // keep only variables present in VARIABLES_CONFIG (plottable)
      const plottable = allVars.filter((v) => {
        if (!Object.prototype.hasOwnProperty.call(VARIABLES_CONFIG, v)) return false;
        const m = v.match(/^conduct_soil(\d+)$/);
        if (m && fertilityChannels.has(m[1])) return false;
        return true;
      });

      if (!plottable.length) continue;

      // order by presence in measTable first, then by label
      const inTable = plottable.filter((v) => measTable.has(v));
      const notInTable = plottable.filter((v) => !measTable.has(v));
      const byLabel = (a: string, b: string) =>
        getVarConfig(a).label.localeCompare(getVarConfig(b).label, "el");
      inTable.sort(byLabel);
      notInTable.sort(byLabel);

      for (const v of [...inTable, ...notInTable]) {
        const latestArr = devHist[v];
        const latest = latestArr && latestArr.length ? latestArr[latestArr.length - 1] : null;
        out.push({
          deviceId: id,
          deviceName: deviceNameOf(id),
          variable: v,
          label: getVarConfig(v).label,
          latest,
        });
      }
    }

    // global stable order: (1) label, (2) device name
    out.sort((a, b) => {
      const l = a.label.localeCompare(b.label, "el");
      return l !== 0 ? l : a.deviceName.localeCompare(b.deviceName, "el");
    });

    return out;
  }, [deviceIds, deviceNameOf, history, measTable]);

  if (!open) return null;

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
    try { return new Date(t).toLocaleString(); } catch { return ""; }
  }

  return (
    <div className="ag-modal-backdrop" role="dialog" aria-modal="true">
      <div className="ag-modal-content">
        <div className="ag-modal-header">
          <h3>Όλες οι μετρήσεις</h3>
          
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
          {items.length === 0 ? (
            <div className="ag-irrig-empty">Δεν υπάρχουν μετρήσεις.</div>
          ) : (
            <div className="meas-grid" role="list">
              {items.map(({ deviceId, deviceName, variable, label, latest }) => {
                const value = latest ? formatValue(variable, latest.v) : "—";
                const accent = colorFor(deviceId);
                return (
                  <button
                    key={`${deviceId}::${variable}`}
                    className="meas-card meas-card--accent"
                    style={{ ['--accent' as any]: accent }}
                    role="listitem"
                    onClick={() => onSelectMeasurement(deviceId, variable, label)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectMeasurement(deviceId, variable, label);
                      }
                    }}
                    aria-label={`${deviceName} · ${label} ${value}`}
                  >
                    <div className="meas-card__title">
                      <span className="meas-card__device">{deviceName}</span>
                      {" "}{label}
                    </div>
                    <div className="meas-card__value">{value}</div>
                    <div className="meas-card__time">
                      {latest ? formatTime(latest.t) : "·"}
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
