// src/DeviceMeasurementsModal.tsx
import React, { useMemo } from "react";
import "./Modals.css";
import "./Dashboard.css"; // for .bullets / .bullet-item
import { TimePoint } from "./MeasurementModal";
import { getVarConfig, VARIABLES_CONFIG } from "./config/variablesConfig";

import { LatestEntry } from "./Dashboard";

type Props = {
  open: boolean;
  deviceId: string | null;
  deviceName: string;
  history: Record<string, Record<string, TimePoint[]>>;
  latestByDevice: Record<string, Record<string, LatestEntry>>;
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
  latestByDevice,
  measTable,
  onSelectMeasurement,
  onClose,
}) => {
const varsForDevice = useMemo(() => {
  if (!deviceId) return [] as string[];

  const devHist = history[deviceId] || {};
  const devLatest = latestByDevice[deviceId] || {};
  const allVarKeys = new Set([
    ...measTable.keys(),
    ...Object.keys(devHist),
    ...Object.keys(devLatest),
  ]);

  if (!allVarKeys.size) return [];

  const plottable = Array.from(allVarKeys).filter((v) =>
    Object.prototype.hasOwnProperty.call(VARIABLES_CONFIG, v),
  );

  if (!plottable.length) return [];

  const inTable = plottable.filter((v) => measTable.has(v));
  const notInTable = plottable.filter((v) => !measTable.has(v));

  inTable.sort((a, b) =>
    getVarConfig(a).label.localeCompare(getVarConfig(b).label, "el"),
  );
  notInTable.sort((a, b) =>
    getVarConfig(a).label.localeCompare(getVarConfig(b).label, "el"),
  );

  return [...inTable, ...notInTable];
}, [deviceId, history, latestByDevice, measTable]);



  if (!open || !deviceId) return null;

  const handleBackdropClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="ag-modal-backdrop" onClick={handleBackdropClick}>
      <div className="ag-modal-content">
        <div className="ag-modal-header">
          <div>
            <h2>Μετρήσεις συσκευής</h2>
            <div className="ag-modal-subtitle">
              {deviceName} ·{" "}
              <span style={{ opacity: 0.7, fontFamily: "monospace" }}>
                {deviceId}
              </span>
            </div>
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
          {varsForDevice.length === 0 ? (
            <div className="ag-irrig-empty">
              Δεν υπάρχουν μετρήσεις για αυτή τη συσκευή.
            </div>
          ) : (
            <ul className="bullets">
              {varsForDevice.map((v) => {
                const label = getVarConfig(v).label;
                const devHist = history[deviceId!] || {};
                const hasTimeseries = (devHist[v]?.length ?? 0) > 0;
                if (hasTimeseries) {
                  return (
                    <li
                      key={v}
                      className="bullet-item"
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectMeasurement(v, label)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectMeasurement(v, label);
                        }
                      }}
                    >
                      {label}
                    </li>
                  );
                } else {
                  return (
                    <li key={v} className="bullet-item bullet-item--no-data">
                      <span>{label}</span>
                      <span className="no-data-note">Δεν υπάρχουν μετρήσεις</span>
                    </li>
                  );
                }
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
