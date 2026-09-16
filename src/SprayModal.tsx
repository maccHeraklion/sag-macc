import React, { useMemo } from "react";
import "./Modals.css";

type LatestEntry = { value: any; metadata?: any; unit?: string; time?: string | null };

// ─── Thresholds ──────────────────────────────────────────────────────────────
const MAX_WIND_OK = 15;       // km/h
const MAX_WIND_CAUTION = 22;  // km/h
const MAX_POP_OK = 20;        // %
const MAX_PRECIP_OK = 0.1;    // mm/h
const MAX_PRECIP_CAUTION = 1; // mm/h
const TEMP_MIN = 5;           // °C
const TEMP_MAX = 28;          // °C
const RH_MIN = 35;            // %
const RH_MAX = 95;            // %

export type SprayStatus = "good" | "caution" | "bad";
export type SprayWindow = { start: string; end: string } | null;

export type SprayRecommendation = {
  status: SprayStatus;
  label: string;
  reasons: string[];
  window: SprayWindow;
};

export const STATUS_STYLE: Record<SprayStatus, React.CSSProperties> = {
  good:    { background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" },
  caution: { background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a" },
  bad:     { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" },
};

const STATUS_COLOR: Record<SprayStatus, string> = {
  good:    "#16a34a",
  caution: "#d97706",
  bad:     "#dc2626",
};

/**
 * Spray wand with a fan-shaped droplet pattern. Fill colour changes with status.
 */
export const SprayStatusIcon: React.FC<{ status: SprayStatus; size?: number }> = ({
  status,
  size = 48,
}) => {
  const c = STATUS_COLOR[status];
  return (
    <svg
      viewBox="0 0 80 56"
      width={size}
      height={Math.round((size * 56) / 80)}
      fill="none"
      aria-hidden="true"
    >
      {/* Wand / handle */}
      <rect x="2" y="22" width="44" height="12" rx="6" fill={c} />
      {/* Nozzle tip */}
      <polygon points="46,20 60,28 46,36" fill={c} />
      {/* Spray droplets – outer fan */}
      <circle cx="66" cy="13" r="3.5" fill={c} opacity="0.40" />
      <circle cx="73" cy="20" r="3"   fill={c} opacity="0.55" />
      <circle cx="76" cy="28" r="3.5" fill={c} opacity="0.75" />
      <circle cx="73" cy="36" r="3"   fill={c} opacity="0.55" />
      <circle cx="66" cy="43" r="3.5" fill={c} opacity="0.40" />
      {/* Spray droplets – inner fan */}
      <circle cx="63" cy="21" r="2"   fill={c} opacity="0.30" />
      <circle cx="66" cy="28" r="2.5" fill={c} opacity="0.45" />
      <circle cx="63" cy="35" r="2"   fill={c} opacity="0.30" />
    </svg>
  );
};

export const STATUS_LABEL: Record<SprayStatus, string> = {
  good:    "Κατάλληλο",
  caution: "Με προφύλαξη",
  bad:     "Μη συνιστάται",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function normalizeWindKmh(raw: any, unit?: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const u = (unit || "").toLowerCase();
  if (u.includes("m/s") || u === "ms" || u === "mps") return n * 3.6;
  if (u.includes("mph")) return n * 1.60934;
  if (u.includes("knot")) return n * 1.852;
  return n; // assume km/h
}

function safeNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toTimeHHMM(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  return d.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function statusLabel(status: SprayStatus): string {
  if (status === "good") return "Κατάλληλο για ψεκασμό";
  if (status === "caution") return "Ψεκασμός με προφύλαξη";
  return "Ψεκασμός δεν συνιστάται";
}

function evaluateHour(
  temp: number | null,
  rh: number | null,
  windKmh: number | null,
  pop: number | null,
  precip: number | null,
): { reasonsBad: string[]; reasonsCaution: string[] } {
  const reasonsBad: string[] = [];
  const reasonsCaution: string[] = [];

  if (windKmh !== null) {
    if (windKmh > MAX_WIND_CAUTION) reasonsBad.push("Ισχυρός άνεμος");
    else if (windKmh > MAX_WIND_OK) reasonsCaution.push("Μέτριος άνεμος");
  }

  if (pop !== null) {
    if (pop > 60) reasonsBad.push("Υψηλή πιθανότητα βροχής");
    else if (pop > MAX_POP_OK) reasonsCaution.push("Πιθανή βροχή");
  }

  if (precip !== null) {
    if (precip > MAX_PRECIP_CAUTION) reasonsBad.push("Ενεργή βροχή");
    else if (precip > MAX_PRECIP_OK) reasonsCaution.push("Ελαφριά βροχή");
  }

  if (temp !== null) {
    if (temp < TEMP_MIN) reasonsCaution.push("Χαμηλή θερμοκρασία");
    if (temp > TEMP_MAX) reasonsCaution.push("Υψηλή θερμοκρασία");
  }

  if (rh !== null) {
    if (rh < RH_MIN) reasonsCaution.push("Χαμηλή υγρασία");
    if (rh > RH_MAX) reasonsCaution.push("Πολύ υψηλή υγρασία");
  }

  return { reasonsBad, reasonsCaution };
}

function isWindowHourValid(
  temp: number | null,
  windKmh: number | null,
  pop: number | null,
  precip: number | null,
): boolean {
  if (windKmh === null || windKmh >= MAX_WIND_OK) return false;
  if (pop === null || pop >= MAX_POP_OK) return false;
  if (precip === null || precip >= MAX_PRECIP_OK) return false;
  if (temp === null || temp <= TEMP_MIN || temp >= TEMP_MAX) return false;
  return true;
}

// ─── Exported computation ─────────────────────────────────────────────────────
export function computeSprayRecommendation(
  forecastLatest: Record<string, LatestEntry>,
): SprayRecommendation | null {
  const entry = forecastLatest?.forecast;
  if (!entry) return null;
  const md = entry.metadata || {};
  if (!Array.isArray(md.hourly_epoch) || !md.hourly) return null;

  const epochs: number[] = md.hourly_epoch;
  const h = md.hourly as Record<string, any[]>;
  const windUnit: string | undefined = md.hourly_units?.wind_speed_10m;

  const now = Date.now() / 1000;
  let i0 = epochs.findIndex((ep) => ep >= now);
  if (i0 < 0) i0 = 0;

  const temp0  = safeNum(h.temperature_2m?.[i0]);
  const rh0    = safeNum(h.relative_humidity_2m?.[i0]);
  const wind0  = normalizeWindKmh(h.wind_speed_10m?.[i0], windUnit);
  const pop0   = safeNum(h.precipitation_probability?.[i0]);
  const precip0 = safeNum(h.precipitation?.[i0]);

  const { reasonsBad, reasonsCaution } = evaluateHour(temp0, rh0, wind0, pop0, precip0);

  const status: SprayStatus =
    reasonsBad.length > 0 ? "bad" : reasonsCaution.length > 0 ? "caution" : "good";

  // Find first 2-consecutive-hour spray window in next 24 h
  let window: SprayWindow = null;
  const limit = Math.min(epochs.length - 1, i0 + 24);
  for (let i = i0; i < limit; i++) {
    const tI  = safeNum(h.temperature_2m?.[i]);
    const wI  = normalizeWindKmh(h.wind_speed_10m?.[i], windUnit);
    const pI  = safeNum(h.precipitation_probability?.[i]);
    const ppI = safeNum(h.precipitation?.[i]);

    const tI1  = safeNum(h.temperature_2m?.[i + 1]);
    const wI1  = normalizeWindKmh(h.wind_speed_10m?.[i + 1], windUnit);
    const pI1  = safeNum(h.precipitation_probability?.[i + 1]);
    const ppI1 = safeNum(h.precipitation?.[i + 1]);

    if (isWindowHourValid(tI, wI, pI, ppI) && isWindowHourValid(tI1, wI1, pI1, ppI1)) {
      const endEpoch = i + 2 < epochs.length ? epochs[i + 2] : epochs[i + 1] + 3600;
      window = { start: toTimeHHMM(epochs[i]), end: toTimeHHMM(endEpoch) };
      break;
    }
  }

  return {
    status,
    label: statusLabel(status),
    reasons: [...reasonsBad, ...reasonsCaution],
    window,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────
type Props = {
  open: boolean;
  onClose: () => void;
  forecastLatest: Record<string, LatestEntry>;
};

type TableRow = {
  time: string;
  windKmh: number | null;
  temp: number | null;
  rh: number | null;
  pop: number | null;
  status: SprayStatus;
};

export const SprayModal: React.FC<Props> = ({ open, onClose, forecastLatest }) => {
  const rec = useMemo(() => computeSprayRecommendation(forecastLatest), [forecastLatest]);

  const tableRows = useMemo((): TableRow[] => {
    const entry = forecastLatest?.forecast;
    if (!entry) return [];
    const md = entry.metadata || {};
    if (!Array.isArray(md.hourly_epoch) || !md.hourly) return [];

    const epochs: number[] = md.hourly_epoch;
    const h = md.hourly as Record<string, any[]>;
    const windUnit: string | undefined = md.hourly_units?.wind_speed_10m;

    const now = Date.now() / 1000;
    let i0 = epochs.findIndex((ep) => ep >= now);
    if (i0 < 0) i0 = 0;

    const rows: TableRow[] = [];
    for (let i = i0; i < Math.min(epochs.length, i0 + 24); i++) {
      const temp    = safeNum(h.temperature_2m?.[i]);
      const rh      = safeNum(h.relative_humidity_2m?.[i]);
      const windKmh = normalizeWindKmh(h.wind_speed_10m?.[i], windUnit);
      const pop     = safeNum(h.precipitation_probability?.[i]);
      const precip  = safeNum(h.precipitation?.[i]);

      const { reasonsBad, reasonsCaution } = evaluateHour(temp, rh, windKmh, pop, precip);
      const rowStatus: SprayStatus =
        reasonsBad.length > 0 ? "bad" : reasonsCaution.length > 0 ? "caution" : "good";

      rows.push({ time: toTimeHHMM(epochs[i]), windKmh, temp, rh, pop, status: rowStatus });
    }
    return rows;
  }, [forecastLatest]);

  if (!open) return null;

  const fmtVal = (v: number | null, suffix = "") => (v !== null ? `${v}${suffix}` : "—");
  const fmtWind = (kmh: number | null) => (kmh !== null ? `${Math.round(kmh)} km/h` : "—");

  return (
    <div className="ag-modal-backdrop" onClick={onClose}>
      <div className="ag-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 750 }}>
        <div className="ag-modal-header">
          <h2>Σύσταση Ψεκασμού</h2>
          
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
          {!rec ? (
            <p style={{ color: "#6c7a89", fontSize: 13 }}>Δεν υπάρχουν δεδομένα πρόγνωσης.</p>
          ) : (
            <>
              {/* Status badge */}
              <div style={{ marginBottom: 16 }}>
                <span
                  style={{
                    ...STATUS_STYLE[rec.status],
                    padding: "6px 16px",
                    borderRadius: 20,
                    fontWeight: 700,
                    fontSize: 15,
                  }}
                >
                  {rec.label}
                </span>
              </div>

              {/* Reasons */}
              {rec.reasons.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: "#374151" }}>
                    Αίτια:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#6b7280" }}>
                    {rec.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Spray window */}
              {rec.window ? (
                <div
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: "#16a34a",
                    marginBottom: 20,
                    fontWeight: 500,
                  }}
                >
                  Συνιστώμενο παράθυρο ψεκασμού: {rec.window.start} – {rec.window.end}
                </div>
              ) : (
                rec.status !== "good" && (
                  <div
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: 13,
                      color: "#dc2626",
                      marginBottom: 20,
                    }}
                  >
                    Δεν βρέθηκε κατάλληλο παράθυρο ψεκασμού στις επόμενες 24 ώρες.
                  </div>
                )
              )}

              {/* Hourly table */}
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: "#374151" }}>
                Επόμενες 24 ώρες
              </div>
              <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "40vh" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Ώρα</th>
                      <th style={thStyle}>Άνεμος</th>
                      <th style={thStyle}>Θερμ. (°C)</th>
                      <th style={thStyle}>Υγρ. (%)</th>
                      <th style={thStyle}>Βροχή (%)</th>
                      <th style={thStyle}>Κατάσταση</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row, idx) => (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? "#fff" : "#f9fafb" }}>
                        <td style={tdStyle}>{row.time}</td>
                        <td style={tdStyle}>{fmtWind(row.windKmh)}</td>
                        <td style={tdStyle}>{fmtVal(row.temp, "°")}</td>
                        <td style={tdStyle}>{fmtVal(row.rh, "%")}</td>
                        <td style={tdStyle}>{fmtVal(row.pop, "%")}</td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              ...STATUS_STYLE[row.status],
                              padding: "2px 10px",
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            {STATUS_LABEL[row.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 8px",
  borderBottom: "1px solid #e5e7eb",
  position: "sticky",
  top: 0,
  backgroundColor: "#fff",
  zIndex: 1,
};

const tdStyle: React.CSSProperties = {
  padding: "8px",
  borderBottom: "1px solid #f1f5f9",
  whiteSpace: "nowrap",
};
