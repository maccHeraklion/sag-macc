// src/IrrigationModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import "./Modals.css";
import IrrigationRulesModal from "./IrrigationRulesModal";

/* ------------ Types shared with Dashboard ------------ */

export interface IrrigationValveState {
  reportedOpen?: boolean | null;
  cmdOpen?: boolean | null;
  minutesPreset?: number;
}

export interface IrrigationDeviceSummary {
  deviceId: string;
  name?: string;
  batteryPct?: number | null;
  batteryTime?: string | null; // ISO string
  pulseToM3?: number | null;
  valve1?: IrrigationValveState;
  valve2?: IrrigationValveState;
  meter1M3?: number | null;
  meter2M3?: number | null;
}

export type IrrigationCommand =
  | {
      type: "perm";
      deviceId: string;
      valveIndex: 0 | 1;
      targetOpen: boolean;
    }
  | {
      type: "timed";
      deviceId: string;
      valveIndex: 0 | 1;
      minutes: number;
    };

type LatestEntry = {
  value: any;
  metadata?: any;
  time?: string | null;
};

interface IrrigationModalProps {
  open: boolean;
  devices: IrrigationDeviceSummary[];
  /** From widget param device_map: { "<deviceId>": "Friendly name", ... } */
  deviceMap?: Record<string, string>;
  /** Latest values scoped per deviceId (prevents collisions when multiple controllers exist). */
  latestByDevice: Record<string, Record<string, LatestEntry>>;
  /** Field-level soil-moisture sensor fault from runPerTich (PATCH_20); null when healthy. */
  sensorFault?: LatestEntry | null;
  onClose: () => void;
  onSendCommand: (cmd: IrrigationCommand) => void;
  onSendData: (payload: any[]) => Promise<void> | void;
}

/* ------------ Helpers ------------ */

const clampMinutes = (v: number) => {
  const n = Number.isFinite(v) ? Math.round(v) : 30;
  return Math.min(999, Math.max(1, n));
};

function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (diffSec < 60) return "Μόλις τώρα";
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m} ${m === 1 ? "λεπτό" : "λεπτά"} πριν`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${h === 1 ? "ώρα" : "ώρες"} πριν`;
  const days = Math.floor(h / 24);
  return `${days} ${days === 1 ? "μέρα" : "μέρες"} πριν`;
}

function fmtAbs(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("el-GR");
}

const effectiveValveState = (v?: IrrigationValveState) => {
  if (!v) return { open: null as boolean | null };
  if (typeof v.cmdOpen === "boolean") return { open: v.cmdOpen };
  if (typeof v.reportedOpen === "boolean") return { open: v.reportedOpen };
  return { open: null as boolean | null };
};

/* ------------ Confirm modal ------------ */

interface CommandConfirmModalProps {
  open: boolean;
  cmd: IrrigationCommand | null;
  deviceName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

const CommandConfirmModal: React.FC<CommandConfirmModalProps> = ({
  open,
  cmd,
  deviceName,
  onCancel,
  onConfirm,
}) => {
  if (!open || !cmd) return null;

  let description = "";
  if (cmd.type === "perm") {
    description = `${cmd.targetOpen ? "Μόνιμο άνοιγμα" : "Μόνιμο κλείσιμο"} βάννας ${
      cmd.valveIndex + 1
    } στη συσκευή ${deviceName || cmd.deviceId}`;
  } else {
    description = `Χρονικό άνοιγμα ${cmd.minutes} λεπτά στη βάννα ${
      cmd.valveIndex + 1
    } στη συσκευή ${deviceName || cmd.deviceId}`;
  }

  return (
    <div className="ag-modal-backdrop">
      <div className="ag-modal-content ag-irrig-modal">
        <div className="ag-modal-header ag-irrig-header">
          <div>
            <h2>Επιβεβαίωση εντολής</h2>
            <div className="ag-modal-subtitle">{deviceName || cmd.deviceId}</div>
          </div>
          <button
            className="ag-modal-close"
            type="button"
            onClick={onCancel}
          >
            ✕
          </button>
        </div>

        <div className="ag-modal-body ag-irrig-body">
          <p style={{ marginBottom: "1rem" }}>
            Θέλετε σίγουρα να αποστείλετε την ακόλουθη εντολή;
          </p>
          <p>
            <strong>{description}</strong>
          </p>
        </div>

        <div
          className="ag-irrig-meters"
          style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}
        >
          <button
            type="button"
            className="ag-irrig-btn close"
            onClick={onCancel}
          >
            Ακύρωση
          </button>
          <button
            type="button"
            className="ag-irrig-btn"
            onClick={onConfirm}
          >
            Επιβεβαίωση &amp; Αποστολή
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------ Main component ------------ */

export const IrrigationModal: React.FC<IrrigationModalProps> = ({
  open,
  devices,
  deviceMap,
  onClose,
  latestByDevice,
  sensorFault,
  onSendCommand,
  onSendData,
}) => {
  const [selectedId, setSelectedId] = useState<string>("");
  const [v1Minutes, setV1Minutes] = useState<number>(30);
  const [v2Minutes, setV2Minutes] = useState<number>(30);
  const [rulesOpen, setRulesOpen] = useState(false);

  // confirmation state
  const [pendingCommand, setPendingCommand] = useState<IrrigationCommand | null>(
    null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ---- SAFE sorting: handles undefined / non-array devices ----
  const sortedDevices = useMemo(() => {
    const arr: IrrigationDeviceSummary[] = Array.isArray(devices)
      ? devices
      : [];
    return arr.slice().sort((a, b) => {
      const nA = deviceMap?.[a.deviceId] || a.name || a.deviceId || "";
      const nB = deviceMap?.[b.deviceId] || b.name || b.deviceId || "";
      return nA.localeCompare(nB, "el");
    });
  }, [devices, deviceMap]);

  // Keep selection valid
  useEffect(() => {
    if (!sortedDevices.length) {
      setSelectedId("");
      return;
    }
    if (!selectedId || !sortedDevices.some((d) => d.deviceId === selectedId)) {
      setSelectedId(sortedDevices[0].deviceId);
    }
  }, [sortedDevices, selectedId]);

  const selectedDevice =
    sortedDevices.find((d) => d.deviceId === selectedId) || sortedDevices[0];

  // Latest map for the currently selected controller
  const selectedLatest: Record<string, LatestEntry> = useMemo(() => {
    const id = selectedDevice?.deviceId;
    if (!id) return {};
    return (latestByDevice && latestByDevice[id]) ? latestByDevice[id] : {};
  }, [latestByDevice, selectedDevice?.deviceId]);
  console.log("[IRR] selectedDevice", selectedDevice);
  console.log("[IRR] latestByDevice keys", Object.keys(latestByDevice || {}));
  console.log(
    "[IRR] selectedLatest keys",
    Object.keys(selectedLatest || {})
  );
  console.log(
    "[IRR] selected hw_version",
    selectedLatest?.hw_version?.value || null
  );

  // Sync minutes with selected device presets
  useEffect(() => {
    if (!selectedDevice) return;
    setV1Minutes(clampMinutes(selectedDevice.valve1?.minutesPreset ?? 30));
    setV2Minutes(clampMinutes(selectedDevice.valve2?.minutesPreset ?? 30));
  }, [
    selectedDevice?.deviceId,
    selectedDevice?.valve1?.minutesPreset,
    selectedDevice?.valve2?.minutesPreset,
  ]);

  const displayNameForDevice = (dev: IrrigationDeviceSummary | undefined) => {
    if (!dev) return "";
    return deviceMap?.[dev.deviceId] || dev.name || dev.deviceId;
  };

  /* ---------- read latest valve feedback from variables ---------- */

  const latestValve1 = selectedLatest["valve_1"];
  const latestValve2 = selectedLatest["valve_2"];
  const latestValve1Cmd = selectedLatest["valve_1_command"];
  const latestValve2Cmd = selectedLatest["valve_2_command"];

  // Feedback/state from field (valve_1 / valve_2)
  const selectedValve1: IrrigationValveState | undefined = selectedDevice
    ? {
        ...(selectedDevice.valve1 ?? { reportedOpen: null }),
        reportedOpen:
          typeof latestValve1?.value === "number"
            ? latestValve1.value === 1
            : selectedDevice.valve1?.reportedOpen ?? null,
      }
    : undefined;

  const selectedValve2: IrrigationValveState | undefined = selectedDevice
    ? {
        ...(selectedDevice.valve2 ?? { reportedOpen: null }),
        reportedOpen:
          typeof latestValve2?.value === "number"
            ? latestValve2.value === 1
            : selectedDevice.valve2?.reportedOpen ?? null,
      }
    : undefined;

  // Last commanded state (valve_1_command / valve_2_command)
  const selectedValve1CmdOpen: boolean | null =
    typeof latestValve1Cmd?.value === "number"
      ? latestValve1Cmd.value === 1
      : selectedDevice?.valve1?.cmdOpen ?? null;

  const selectedValve2CmdOpen: boolean | null =
    typeof latestValve2Cmd?.value === "number"
      ? latestValve2Cmd.value === 1
      : selectedDevice?.valve2?.cmdOpen ?? null;

  /* ---------- command helpers ---------- */

  const queueCommand = (cmd: IrrigationCommand) => {
    setPendingCommand(cmd);
    setConfirmOpen(true);
  };

  const handleConfirmSend = () => {
    if (pendingCommand) {
      onSendCommand(pendingCommand);
    }
    setConfirmOpen(false);
    setPendingCommand(null);
  };

  const handleCancelSend = () => {
    setConfirmOpen(false);
    setPendingCommand(null);
  };

  const handlePermClick = (valveIndex: 0 | 1, currentCmdOpen: boolean | null) => {
    if (!selectedDevice) return;
    const targetOpen = !(currentCmdOpen === true); // toggle command
    queueCommand({
      type: "perm",
      deviceId: selectedDevice.deviceId,
      valveIndex,
      targetOpen,
    });
  };

  const handleTimedClick = (valveIndex: 0 | 1) => {
    if (!selectedDevice) return;
    const minutes =
      valveIndex === 0 ? clampMinutes(v1Minutes) : clampMinutes(v2Minutes);
    queueCommand({
      type: "timed",
      deviceId: selectedDevice.deviceId,
      valveIndex,
      minutes,
    });
  };

  /* ---------- Small render helpers ---------- */

  const renderValveCard = (
    title: string,
    valve: IrrigationValveState | undefined, // feedback/state
    valveIndex: 0 | 1,
    minutes: number,
    setMinutes: (n: number) => void,
    cmdOpen: boolean | null, // command state (for main button)
  ) => {
    // Real physical state
    const stateOpen =
      typeof valve?.reportedOpen === "boolean" ? valve.reportedOpen : null;

    // The main button should follow the REAL valve state (reportedOpen) so the
    // prompt matches the pill (ΑΝΟΙΧΤΗ/ΚΛΕΙΣΤΗ). Fall back to the last command
    // only when the real state is unknown.
    const effectiveOpen = stateOpen !== null ? stateOpen : cmdOpen === true;

    const pillClass =
      stateOpen === null
        ? "ag-irrig-pill unknown"
        : stateOpen
        ? "ag-irrig-pill open"
        : "ag-irrig-pill closed";

    return (
      <div className="ag-irrig-valve-card">
        <div className="ag-irrig-valve-header">
          <h3>{title}</h3>
          <div className="ag-irrig-pill-toggle">
            {/* --- Pill text (real feedback) --- */}
            <span className={pillClass}>
              {stateOpen === null ? "—" : stateOpen ? "ΑΝΟΙΧΤΗ" : "ΚΛΕΙΣΤΗ"}
            </span>

            {/* --- Read-only toggle for actual valve state --- */}
            
            <div className={`ag-irrig-toggle ${stateOpen ? 'open' : ''} ag-irrig-toggle--readonly`}>
              <span className="handle" />
            </div>
          </div>
        </div>

        {/* --- Main command button still active --- */}
        <button
          type="button"
          className={`ag-irrig-btn ${effectiveOpen ? "close" : ""}`}
          onClick={() => handlePermClick(valveIndex, effectiveOpen)}
        >
          {effectiveOpen ? "Πατήστε για κλείσιμο" : "Πατήστε για άνοιγμα"}
        </button>

        <div className="ag-irrig-divider" />
        <div className="ag-irrig-timed-title">Χρονικό άνοιγμα</div>
        <div className="ag-irrig-timed-row">
          <span>Άνοιγμα για</span>
          <input
            type="number"
            min={1}
            max={999}
            value={minutes}
            onChange={(e) => setMinutes(clampMinutes(Number(e.target.value)))}
          />
          <span>λεπτά</span>
        </div>
        <button
          type="button"
          className="ag-irrig-btn"
          onClick={() => handleTimedClick(valveIndex)}
        >
          Πατήστε για Χρονικό Άνοιγμα
        </button>
      </div>
    );
  };



  /* ---------- Actual render ---------- */

  if (!open) return null;

  if (!sortedDevices.length) {
    return (
      <div className="ag-modal-backdrop">
        <div className="ag-modal-content ag-irrig-modal">
          <div className="ag-modal-header ag-irrig-header">
            <div>
              <h2>Άρδευση</h2>
              <div className="ag-modal-subtitle">
                Προγραμματισμός ηλεκτροβανών &amp; μετρητών νερού
              </div>
            </div>

            <button
              className="ag-modal-close"
              type="button"
              onClick={onClose}
            >
              ✕
            </button>
          </div>

          <div className="ag-modal-body ag-irrig-body">
            <p style={{ margin: 0 }}>Δεν βρέθηκαν συσκευές άρδευσης.</p>
          </div>
        </div>
      </div>
    );
  }

  const battPct = selectedDevice?.batteryPct ?? null;
  const battTime = selectedDevice?.batteryTime ?? null;
  const battPctClamped =
    battPct == null ? null : Math.max(0, Math.min(100, Math.round(battPct)));

  const battFillClass =
    battPctClamped == null
      ? ""
      : battPctClamped <= 20
      ? "crit"
      : battPctClamped <= 50
      ? "low"
      : "";

  return (
    <div className="ag-modal-backdrop">
      <div className="ag-modal-content ag-irrig-modal">
        {/* HEADER */}
        <div className="ag-modal-header ag-irrig-header">
          <div>
            <h2>Πρόγραμμα άρδευσης</h2>
            <div className="ag-modal-subtitle">
              {fmtAgo(battTime)} · {fmtAbs(battTime)}
            </div>
          </div>

          <div className="ag-irrig-header-right">
            <div className="ag-irrig-batt">
              <span className="icon">🔋</span>
              <div className="bar">
                <div
                  className={
                    "ag-irrig-batt-fill" +
                    (battFillClass ? " " + battFillClass : "")
                  }
                  style={{
                    width:
                      battPctClamped == null
                        ? "0%"
                        : `${battPctClamped}%`,
                  }}
                />
              </div>
              <span className="pct">
                {battPctClamped == null ? "—" : `${battPctClamped}%`}
              </span>
            </div>

            <label className="ag-irrig-device-label" htmlFor="ag-irrig-device-select">
              Ελεγκτής:
            </label>
            <select
              id="ag-irrig-device-select"
              className="ag-irrig-device-select"
              value={selectedDevice?.deviceId || ""}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {sortedDevices.map((dev) => (
                <option key={dev.deviceId} value={dev.deviceId}>
                  {displayNameForDevice(dev)}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="ag-irrig-rules-btn"
              onClick={() => setRulesOpen(true)}
            >
              Εντολές κανόνων (UC511)
            </button>
          </div>

          {/* ✕ top-right */}
          <button
            className="ag-modal-close ag-modal-close-topright"
            type="button"
            onClick={onClose}
            aria-label="Κλείσιμο"
          >
            ✕
          </button>
        </div>


        {/* BODY */}
        <div className="ag-modal-body ag-irrig-body">
          {/* Soil-moisture sensor fault notice (runPerTich PATCH_20) — shown only when faulted */}
          {sensorFault ? (
            <div
              className="subscription-banner subscription-banner--warning"
              style={{ marginBottom: 12 }}
            >
              ⚠️{" "}
              {sensorFault?.metadata?.text ||
                "Δεν υπολογίστηκε άρδευση: ο αισθητήρας υγρασίας εδάφους είναι εκτός λειτουργίας ή εκτός ορίων. Ελέγξτε τον αισθητήρα."}
            </div>
          ) : null}

          {/* Valves */}
          <div className="ag-irrig-grid2">
            {renderValveCard(
              "Βάνα 1",
              selectedValve1,
              0,
              v1Minutes,
              setV1Minutes,
              selectedValve1CmdOpen
            )}
            {renderValveCard(
              "Βάνα 2",
              selectedValve2,
              1,
              v2Minutes,
              setV2Minutes,
              selectedValve2CmdOpen
            )}
          </div>

          {/* Meters */}
          <div className="ag-irrig-meters">
            <div className="ag-irrig-grid2">
              <div className="ag-irrig-meter-card">
                <div className="title">Μετρητής νερού 1</div>
                <div className="value">
                  {/* [QW-10] Show "—" when the meter reading is genuinely absent, not a confident 0.0 m³. */}
                  {selectedDevice?.meter1M3 == null ? "—" : Number(selectedDevice.meter1M3).toFixed(1)}
                  <span className="unit">m³</span>
                </div>
              </div>

              <div className="ag-irrig-meter-card">
                <div className="title">Μετρητής νερού 2</div>
                <div className="value">
                  {/* [QW-10] Show "—" when the meter reading is genuinely absent, not a confident 0.0 m³. */}
                  {selectedDevice?.meter2M3 == null ? "—" : Number(selectedDevice.meter2M3).toFixed(1)}
                  <span className="unit">m³</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rules modal */}
        <IrrigationRulesModal
          open={rulesOpen}
          latestByVar={selectedLatest}
          device={selectedDevice ? { deviceId: selectedDevice.deviceId, name: displayNameForDevice(selectedDevice) } : undefined}
          onClose={() => setRulesOpen(false)}
          onSendData={onSendData}
        />
      </div>

      {/* Confirm modal */}
      <CommandConfirmModal
        open={confirmOpen && !!pendingCommand}
        cmd={pendingCommand}
        deviceName={displayNameForDevice(selectedDevice)}
        onCancel={handleCancelSend}
        onConfirm={handleConfirmSend}
      />
    </div>
  );
};

export default IrrigationModal;
