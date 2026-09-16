import React, { useEffect, useMemo, useState } from "react";
import "./Modals.css";
import { getVarConfig } from "./config/variablesConfig";

type LatestEntry = { value: any; metadata?: any; unit?: string; time?: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  forecastLatest: Record<string, LatestEntry>;
};

function fmt(v: any, suffix = "") {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (Number.isFinite(n)) return `${n}${suffix}`;
  return `${String(v)}${suffix}`;
}

/**
 * Open‑Meteo weather_code uses the WMO weather interpretation.
 * We convert it to something human‑readable (emoji + greek label).
 */
export function wmoToHuman(code: any): { emoji: string; label: string } {
  const c = Number(code);
  if (!Number.isFinite(c)) return { emoji: "❓", label: "Άγνωστο" };

  // Clear / clouds
  if (c === 0) return { emoji: "☀️", label: "Καθαρός" };
  if (c === 1) return { emoji: "🌤️", label: "Κυρίως καθαρός" };
  if (c === 2) return { emoji: "⛅", label: "Μερική συννεφιά" };
  if (c === 3) return { emoji: "☁️", label: "Συννεφιά" };

  // Fog
  if (c === 45 || c === 48) return { emoji: "🌫️", label: "Ομίχλη" };

  // Drizzle
  if (c >= 51 && c <= 57) return { emoji: "🌦️", label: "Ψιχάλα" };

  // Freezing rain (WMO 66/67) — must be checked before plain rain.
  // [CLEANFIX 2026-07-02] BUG: rain range was 61..67, which swallowed 66/67 so
  // freezing rain never displayed (a frost-safety hazard). Rain narrowed to 61..65.
  if (c === 66 || c === 67) return { emoji: "🌧️❄️", label: "Παγωμένη βροχή" };

  // Rain
  if (c >= 61 && c <= 65) return { emoji: "🌧️", label: "Βροχή" };

  // Snow
  if (c >= 71 && c <= 77) return { emoji: "❄️", label: "Χιόνι" };

  // Showers
  if (c >= 80 && c <= 82) return { emoji: "🌦️", label: "Μπόρες" };

  // Thunderstorm
  if (c === 95) return { emoji: "⛈️", label: "Καταιγίδα" };
  if (c === 96 || c === 99) return { emoji: "⛈️🧊", label: "Καταιγίδα / χαλάζι" };

  return { emoji: "🌥️", label: `Κωδικός ${c}` };
}

export function toKmhFromUnit(raw: any, unit?: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const u = (unit || "").toLowerCase();
  // Open‑Meteo can return "m/s" or "km/h" depending on request.
  if (u.includes("m/s") || u === "ms" || u === "mps") return n * 3.6;
  return n; // assume already km/h
}

/**
 * Formats a numeric raw value using the shared conversions in variablesConfig.
 * - wind speed: km/h -> Bft (default)
 * - wind direction: ° -> 16-point compass (default)
 */
export function formatWithConfig(variableKey: string, raw: any) {
  if (raw === null || raw === undefined || raw === "") return "—";
  const n = Number(raw);
  if (!Number.isFinite(n)) return String(raw);

  const conf = getVarConfig(variableKey);
  const unit = conf.defaultUnit || "";
  const conv = conf.conversions?.[unit];
  if (!conv) return `${n}`;

  const out = conv(n);
  const cat = conf.categorical?.[unit];
  if (cat && Number.isFinite(out)) {
    const idx = Math.trunc(out);
    return cat[idx] ?? "—";
  }

  return `${out}${unit ? ` ${unit}` : ""}`;
}

function toTimeHHMM(iso: any) {
  if (!iso) return "—";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "—";
  // Force 24-hour format (no AM/PM)
  return d.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function toDateYYYYMMDD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function toTimeHHMMFromEpoch(epochSec: any) {
  const n = Number(epochSec);
  if (!Number.isFinite(n)) return "—";
  const d = new Date(n * 1000);
  if (Number.isNaN(d.getTime())) return "—";
  // Force 24-hour format (no AM/PM)
  return d.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit", hour12: false });
}
function toGreekDayTitle(d: Date) {
  const s = d.toLocaleDateString("el-GR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  // Ensure first letter capitalized for consistent headings.
  return s.length ? s[0].toLocaleUpperCase("el-GR") + s.slice(1) : "—";
}

type LoadedDaily = { mode: "daily"; baseDate: string; days: any[] };
type LoadedHourly = {
  mode: "hourly";
  baseDate: string;
  timezone?: string;
  hourly_epoch: number[];
  hourly: Record<string, any[]>;
  hourly_units?: Record<string, string>;
};
type LoadedForecast = LoadedDaily | LoadedHourly;

function loadForecast(entry?: LatestEntry): LoadedForecast {
  if (!entry) return { mode: "daily", baseDate: "—", days: [] };

  const md = entry.metadata || {};

  // NEW FORMAT (Open-Meteo): one "forecast" variable with metadata.hourly_epoch + metadata.hourly
  if (Array.isArray(md.hourly_epoch) && md.hourly && typeof md.hourly === "object") {
    return {
      mode: "hourly",
      baseDate: md.forecast_base_date || "—",
      timezone: md.timezone,
      hourly_epoch: md.hourly_epoch,
      hourly: md.hourly,
      hourly_units: md.hourly_units,
    };
  }

  // OLD FORMAT (AccuWeather): metadata.days
  if (Array.isArray(md.days)) {
    return { mode: "daily", baseDate: md.forecast_base_date || "—", days: md.days };
  }

  // Backward compatibility: value contains JSON
  if (typeof entry.value === "string") {
    try {
      const obj = JSON.parse(entry.value);
      if (obj?.hourly_epoch && obj?.hourly) {
        return {
          mode: "hourly",
          baseDate: obj.forecast_base_date || obj.baseDate || "—",
          timezone: obj.timezone,
          hourly_epoch: obj.hourly_epoch,
          hourly: obj.hourly,
          hourly_units: obj.hourly_units,
        };
      }
      if (obj && Array.isArray(obj.days)) {
        return { mode: "daily", baseDate: obj.baseDate || obj.forecast_base_date || "—", days: obj.days };
      }
    } catch {
      // ignore
    }
  }

  return { mode: "daily", baseDate: md.forecast_base_date || "—", days: [] };
}

export const ForecastModal: React.FC<Props> = ({ open, onClose, forecastLatest }) => {
  const forecastEntry = forecastLatest?.forecast;
  const loaded = useMemo(() => loadForecast(forecastEntry), [forecastEntry]);

  // UI preference: show forecast every 2 or 3 hours (default: 3h)
  const [hourStep, setHourStep] = useState<2 | 3>(2);

  // Keep old rerender mechanism to avoid unused imports warnings; in the new format we don't preload icons.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    setTick((t) => t + 1);
  }, [open]);

  if (!open) return null;

  const lastUpdate = forecastEntry?.time
    ? new Date(forecastEntry.time).toLocaleString("el-GR", { hour12: false })
    : "—";

  return (
    <div className="ag-modal-backdrop" onClick={onClose}>
      <div className="ag-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 1150 }}>
        <div className="ag-modal-header">
          <div>
            <h2>Πρόγνωση Καιρού</h2>
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
          {loaded.mode === "daily" ? (
            !loaded.days?.length ? (
              <p style={{ color: "#6c7a89", fontSize: 13 }}>Δεν υπάρχουν δεδομένα πρόγνωσης ακόμα.</p>
            ) : (
              <p style={{ color: "#6c7a89", fontSize: 13 }}>
                Η πρόγνωση είναι σε παλιό format (AccuWeather). Αναβαθμίστε το Analysis για το νέο format Open‑Meteo.
              </p>
            )
          ) : !loaded.hourly_epoch?.length ? (
            <p style={{ color: "#6c7a89", fontSize: 13 }}>Δεν υπάρχουν δεδομένα πρόγνωσης ακόμα.</p>
          ) : (
            <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "60vh" }}>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10, gap: 8 }}>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={th}>Ώρα</th>
                    <th style={th}>Καιρός</th>
                    <th style={th}>Θερμ. (°C)</th>
                    <th style={th}>Σχετ. Υγρ. (%)</th>
                    <th style={th}>Άνεμος</th>
                    <th style={th}>Πιθανότητα βροχής (%)</th>
                    <th style={th}>Χιλιοστά (mm)</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const md = loaded;
                    const t = md.hourly_epoch;
                    const h = md.hourly || {};
                    const temp = h.temperature_2m || [];
                    const rh = h.relative_humidity_2m || [];
                    const precip = h.precipitation || [];
                    const pop = h.precipitation_probability || [];
                    const wind = h.wind_speed_10m || [];
                    const code = h.weather_code || [];

                    const windUnit = md.hourly_units?.wind_speed_10m;

                    const rows: { key: string; date: string; time: string; i: number }[] = [];
                    for (let i = 0; i < t.length; i++) {
                      const d = new Date(t[i] * 1000);
                      const date = toDateYYYYMMDD(d);
                      const time = toTimeHHMMFromEpoch(t[i]);
                      rows.push({ key: `${t[i]}`, date, time, i });
                    }

                    // Only show every N hours (2h or 3h)
                    const shown = rows.filter((r) => r.i % hourStep === 0);

                    // Group by day and render a single day title row per date.
                    const groups = new Map<string, typeof shown>();
                    for (const r of shown) {
                      const arr = groups.get(r.date) || [];
                      arr.push(r);
                      groups.set(r.date, arr);
                    }

                    const orderedDates = Array.from(groups.keys());

                    return orderedDates.flatMap((dateKey) => {
                      const dayRows = groups.get(dateKey) || [];
                      const dayTitle = (() => {
                        const first = dayRows[0];
                        if (!first) return "—";
                        const d = new Date(t[first.i] * 1000);
                        return toGreekDayTitle(d);
                      })();

                      return [
                        <tr key={`day-${dateKey}`}>
                          <td colSpan={7} style={{ ...td, fontWeight: 700, background: "#f8fafc" }}>
                            {dayTitle}
                          </td>
                        </tr>,
                        ...dayRows.map((r) => {
                          const w = wmoToHuman(code[r.i]);
                          const windBft = (() => {
                            const kmh = toKmhFromUnit(wind[r.i], windUnit);
                            return kmh == null ? "—" : formatWithConfig("wind_speed_kmh", kmh);
                          })();
                          return (
                            <tr key={r.key}>
                              <td style={tdNowrap}>{r.time}</td>
                              <td style={{ ...tdNowrap, minWidth: 170 }} title={`WMO code: ${fmt(code[r.i])}`}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                  <span aria-hidden="true" style={{ fontSize: 16 }}>{w.emoji}</span>
                                  <span>{w.label}</span>
                                </span>
                              </td>
                              <td style={tdNowrap}>{fmt(temp[r.i], "°")}</td>
                              <td style={tdNowrap}>{fmt(rh[r.i], "%")}</td>
                              <td style={tdNowrap}>{windBft}</td>
                              <td style={tdNowrap}>{fmt(pop[r.i], "%")}</td>
                              <td style={tdNowrap}>{fmt(precip[r.i], " mm")}</td>
                            </tr>
                          );
                        }),
                      ];
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 8px",
  borderBottom: "1px solid #e5e7eb",
  position: "sticky",
  top: 0,
  backgroundColor: "#fff",
  zIndex: 1,
};

const td: React.CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "top",
};

const tdNowrap: React.CSSProperties = {
  ...td,
  whiteSpace: "nowrap",
};

const segBtn: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  padding: "6px 10px",
  borderRadius: 10,
  fontSize: 12,
  cursor: "pointer",
};

const segBtnActive: React.CSSProperties = {
  ...segBtn,
  background: "#111827",
  borderColor: "#111827",
  color: "#ffffff",
};
