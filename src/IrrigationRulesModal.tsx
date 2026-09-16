// src/IrrigationRulesModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import "./Modals.css";

type LatestEntry = {
  value: any;
  metadata?: any;
  time?: string | null;
};

type IrrigationRulesModalProps = {
  open: boolean;
  onClose: () => void;
  /** Latest datapoints for the selected UC511 device (already device-scoped) */
  latestByVar: Record<string, LatestEntry>;
  /** Wrapper that ultimately calls TagoIO.sendData([{ variable, value, metadata, time }]) */
  onSendData: (payload: any[]) => Promise<void> | void;
  /** Optional: used only for display */
  device?: { deviceId: string; name?: string };
  /** From widget param device_map: { "<deviceId>": "Friendly name", ... } */
  deviceMap?: Record<string, string>;
};

type RuleInfo = {
  id: number;
  enabled: boolean;
  condition: string;
  startISO: string | null;
  loop: boolean;
  loopPeriod: string;
  intervalDays: number | null;
  weekdayMask: string;
  valve: string;
  operation: string;
  durationSec: number | null;
  flowControl: boolean;
  waterPulses: number | null;
};

type PlanInfo = {
  id: number;
  enabled: boolean;
  planType: string; // Άνοιγμα / Κλείσιμο
  from: string; // HH:MM
  to: string; // HH:MM
  repeatText: string; // weekly or "Μία φορά"
  weekdayMask: string; // freeform, display-only
  valveMask: number; // 1,2,3
  waterPulses: number | null;
};

const ATHENS_TZ = "Europe/Athens";
const WEEKDAY_LABELS = ["Δε", "Τρ", "Τε", "Πε", "Πα", "Σα", "Κυ"]; // Mon..Sun (bit 0..6)
const WEEKDAY_KEYS = ["δευτ", "τρίτ", "τετάρ", "πέμπτ", "παρασκ", "σάββ", "κυρι"]; // to parse echo text

// Display an instant in Europe/Athens regardless of the host/browser timezone (TagoIO iframes
// frequently run in UTC), as "YYYY-MM-DD HH:mm".
function formatLocal(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone: ATHENS_TZ,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(d);
    const g = (t: string) => p.find((x) => x.type === t)?.value || "";
    return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}`;
  } catch {
    return "—";
  }
}

// Europe/Athens offset (minutes east of UTC) at a given instant (handles summer/winter DST).
function athensOffsetMinutes(at: Date): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: ATHENS_TZ, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
  const asUTC = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return Math.round((asUTC - at.getTime()) / 60000);
}

// UTC ISO instant → "YYYY-MM-DDTHH:mm" Athens wall-clock (for the datetime-local input value).
function utcISOToAthensInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: ATHENS_TZ, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value || "";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

// "YYYY-MM-DDTHH:mm" Athens wall-clock (from datetime-local) → UTC ISO string.
function athensInputToUTCISO(input: string): string | null {
  if (!input) return null;
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const y = Number(m[1]), mo = Number(m[2]), da = Number(m[3]), h = Number(m[4]), mi = Number(m[5]);
  const approx = Date.UTC(y, mo - 1, da, h, mi); // treat wall-clock as UTC, then correct by offset
  const off = athensOffsetMinutes(new Date(approx));
  return new Date(approx - off * 60000).toISOString();
}

const maskFromWeekdays = (days: boolean[]): number =>
  days.reduce((mask, on, idx) => (on ? mask | (1 << idx) : mask), 0);

// Restore the Δε-Κυ selection from a rule's weekday_mask (number from the optimistic write, or the
// Greek day-name string from the parser echo). Unknown/empty → all days.
function weekdaysFromRule(weekdayMask: unknown): boolean[] {
  const res = [false, false, false, false, false, false, false];
  if (typeof weekdayMask === "number") {
    for (let i = 0; i < 7; i++) res[i] = !!((weekdayMask >> i) & 1);
    return res.some(Boolean) ? res : [true, true, true, true, true, true, true];
  }
  const s = String(weekdayMask || "").toLowerCase();
  if (!s) return [true, true, true, true, true, true, true];
  for (let i = 0; i < 7; i++) res[i] = s.includes(WEEKDAY_KEYS[i]);
  return res.some(Boolean) ? res : [true, true, true, true, true, true, true];
}

function buildActionText(r: RuleInfo): string {
  const base = [r.operation, r.valve && `Βάνα ${r.valve}`].filter(Boolean).join(" ");
  const extra: string[] = [];

  if (r.durationSec && r.durationSec > 0) {
    const minutes = Math.round(r.durationSec / 60);
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      extra.push(`για ${h} ώρες${m ? ` και ${m} λεπτά` : ""}`);
    } else {
      extra.push(`για ${minutes} λεπτά`);
    }
  }
  if (r.flowControl && r.waterPulses != null) {
    extra.push(`ή ${r.waterPulses} παλμούς`);
  }
  return [base, extra.join(" ")].filter(Boolean).join(" ");
}

const clampInt = (v: string, min: number, max?: number | null) => {
  let n = Number.isFinite(+v) ? Math.trunc(+v) : 0;
  if (n < min) n = min;
  if (max != null && n > max) n = max;
  return n;
};

const IrrigationRulesModal: React.FC<IrrigationRulesModalProps> = ({
  open,
  onClose,
  latestByVar,
  onSendData,
  device,
  deviceMap,
}) => {
  const [rules, setRules] = useState<RuleInfo[]>([]);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  // editor state (v4 rules)
  const [editRuleId, setEditRuleId] = useState<number | null>(null);
  const [editNext, setEditNext] = useState("");
  const [editValve, setEditValve] = useState("1");
  const [editHours, setEditHours] = useState("0");
  const [editMinutes, setEditMinutes] = useState("0");
  const [editPulses, setEditPulses] = useState("");
  const [editRepeat, setEditRepeat] = useState(false);
  const [editEvery, setEditEvery] = useState("1");
  const [editUnit, setEditUnit] = useState<"day" | "week" | "month">("day");
  const [editWeekdays, setEditWeekdays] = useState<boolean[]>([true, true, true, true, true, true, true]); // Mon..Sun

  // editor state (legacy plans)
  const [editPlanId, setEditPlanId] = useState<number | null>(null);
  const [planType, setPlanType] = useState<"open" | "close">("open");
  const [planValveMask, setPlanValveMask] = useState<1 | 2 | 3>(1);
  const [planFrom, setPlanFrom] = useState("06:00");
  const [planTo, setPlanTo] = useState("06:10");
  const [planOnce, setPlanOnce] = useState(true);
  const [planWeek, setPlanWeek] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]); // Mon..Sun
  const [planPulses, setPlanPulses] = useState("");

  const displayDeviceName = useMemo(() => {
    const id = device?.deviceId;
    if (!id) return "";
    return deviceMap?.[id] || device?.name || id;
  }, [device?.deviceId, device?.name, deviceMap]);

  // --- generation detection (UI-level only) ---
  const hwRaw: string | null = useMemo(() => {
    const v = (latestByVar as any)?.hw_version?.value;
    if (v == null) return null;
    const s = String(v).trim();
    return s ? s : null;
  }, [latestByVar]);

  const hwMajor: number | null = useMemo(() => {
    if (!hwRaw) return null;
    const m = hwRaw.match(/v?\s*(\d+)/i);
    return m ? Number(m[1]) : null;
  }, [hwRaw]);

  const hasAnyPlan = useMemo(() => {
    for (let i = 1; i <= 16; i++) if ((latestByVar as any)[`plan${i}`]) return true;
    return false;
  }, [latestByVar]);

  const hasAnyRule = useMemo(() => {
    for (let i = 1; i <= 16; i++) if ((latestByVar as any)[`rule${i}`]) return true;
    return false;
  }, [latestByVar]);

  const generation: "v4" | "legacy" | "unknown" = useMemo(() => {
    // If hw_version exists -> always decide by it.
    if (hwMajor != null) return hwMajor >= 4 ? "v4" : "legacy";
    // Fail-safe if hw_version missing
    if (hasAnyPlan) return "legacy";
    if (hasAnyRule) return "v4";
    return "unknown";
  }, [hwMajor, hasAnyPlan, hasAnyRule]);

  const prefix = generation === "v4" ? "rule" : generation === "legacy" ? "plan" : "rule";
  const isV4 = generation === "v4";

  // --- absorb latest -> lists ---
  useEffect(() => {
    if (!open) {
      setRules([]);
      setPlans([]);
      setBusyId(null);
      setEditRuleId(null);
      setEditPlanId(null);
      return;
    }

    const nextRules: RuleInfo[] = [];
    const nextPlans: PlanInfo[] = [];

    for (let id = 1; id <= 16; id++) {
      const rEntry = (latestByVar as any)[`rule${id}`] as LatestEntry | undefined;
      const rmd = (rEntry?.metadata || {}) as any;
      nextRules.push({
        id,
        enabled: !!rEntry?.value,
        condition: rmd.condition_type || "—",
        startISO: rmd.start_iso || null,
        loop: rmd.loop === "Ναι" || rmd.loop === true,
        loopPeriod: rmd.loop_period || "",
        intervalDays: typeof rmd.interval_days === "number" ? rmd.interval_days : null,
        weekdayMask: rmd.weekday_mask || "",
        valve: rmd.valve != null ? String(rmd.valve) : "—",
        operation: rmd.operation || "—",
        durationSec: typeof rmd.duration_sec === "number" ? rmd.duration_sec : null,
        flowControl: rmd.flow_control === "Ναι" || rmd.flow_control === true,
        waterPulses: typeof rmd.water_pulses === "number" ? rmd.water_pulses : null,
      });

      const pEntry = (latestByVar as any)[`plan${id}`] as LatestEntry | undefined;
      const pmd = (pEntry?.metadata || {}) as any;
      nextPlans.push({
        id,
        enabled: !!pEntry?.value,
        planType: pmd.plan_type || pmd.operation || "—",
        from: pmd.from || pmd.start_hm || "—",
        to: pmd.to || pmd.end_hm || "—",
        repeatText: pmd.repeat_text || (pmd.once ? "Μία φορά" : "—"),
        weekdayMask: pmd.weekday_mask || "",
        valveMask: typeof pmd.valve_mask === "number" ? pmd.valve_mask : 1,
        waterPulses: typeof pmd.water_pulses === "number" ? pmd.water_pulses : null,
      });
    }

    setRules(nextRules);
    setPlans(nextPlans);
  }, [open, latestByVar]);

  const openRuleEditor = (id: number) => {
    const rule = rules.find((r) => r.id === id);
    if (!rule) return;
    setEditRuleId(id);
    setEditValve(rule.valve && rule.valve !== "—" ? rule.valve : "1");
    setEditNext(utcISOToAthensInput(rule.startISO));
    const dur = rule.durationSec != null ? Math.max(0, Math.round(rule.durationSec / 60)) : 0;
    setEditHours(String(Math.floor(dur / 60)));
    setEditMinutes(String(dur % 60));
    setEditPulses(rule.waterPulses != null ? String(rule.waterPulses) : "");
    setEditRepeat(!!rule.loop);
    // Restore the repeat unit from the saved rule instead of always defaulting to "day"
    // (a weekly rule otherwise looked daily in the editor, and re-saving would revert it).
    const lp = (rule.loopPeriod || "").toLowerCase();
    setEditUnit(
      lp.includes("εβδομ") || lp.includes("week")
        ? "week"
        : lp.includes("μήν") || lp.includes("month")
        ? "month"
        : "day"
    );
    setEditEvery(rule.intervalDays && rule.intervalDays > 1 ? String(rule.intervalDays) : "1");
    setEditWeekdays(weekdaysFromRule(rule.weekdayMask));
  };

  const openPlanEditor = (id: number) => {
    const plan = plans.find((p) => p.id === id);
    if (!plan) return;
    setEditPlanId(id);
    setPlanType(String(plan.planType).toLowerCase().includes("κλεί") || String(plan.planType).toLowerCase().includes("close") ? "close" : "open");
    setPlanValveMask((plan.valveMask === 2 || plan.valveMask === 3) ? (plan.valveMask as 2 | 3) : 1);
    setPlanFrom(plan.from && plan.from !== "—" ? plan.from : "06:00");
    setPlanTo(plan.to && plan.to !== "—" ? plan.to : "06:10");
    setPlanOnce((plan.repeatText || "").toLowerCase().includes("μία"));
    setPlanPulses(plan.waterPulses != null ? String(plan.waterPulses) : "");
  };

  const closeEditors = () => {
    setEditRuleId(null);
    setEditPlanId(null);
  };

  const handleToggle = async (id: number, enabled: boolean) => {
    setBusyId(id);
    try {
      await Promise.resolve(
        onSendData([
          {
            variable: `${prefix}${id}_enable`,
            value: !enabled,
            time: new Date().toISOString(),
            metadata: { id, target: !enabled, kind: prefix, target_device: device?.deviceId },
          },
        ])
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveRule = async () => {
    if (!editRuleId) return;
    const id = editRuleId;

    const h = clampInt(editHours, 0, null);
    const m = clampInt(editMinutes, 0, 59);
    const durationMin = h * 60 + m;
    const pulses = editPulses.trim() ? clampInt(editPulses, 0, null) : null;
    const every = clampInt(editEvery || "1", 1, null);

    // The datetime-local value is Athens wall-clock; convert to a UTC ISO instant.
    const startISO: string | null = editNext ? athensInputToUTCISO(editNext) : null;

    // Weekly rules carry the selected Δε-Κυ days as a bitmask (bit 0 = Monday). An empty selection
    // falls back to all days (the analysis also defaults to 0x7F). Only meaningful for the week unit.
    const weekdayMask = maskFromWeekdays(editWeekdays) || 0x7f;

    const metadata = {
      rule_id: id,
      start_iso: startISO,
      valve: Number(editValve) || 1,
      duration_min: durationMin,
      water_pulses: pulses,
      repeat: editRepeat,
      interval: every,
      unit: editUnit,
      weekday_mask: editRepeat && editUnit === "week" ? weekdayMask : undefined,
      target_device: device?.deviceId,
    };

    setBusyId(id);
    try {
      await Promise.resolve(
        onSendData([
          {
            variable: `rule${id}_set`,
            value: 1,
            time: new Date().toISOString(),
            metadata,
          },
        ])
      );
    } finally {
      setBusyId(null);
      closeEditors();
    }
  };

  const handleSavePlan = async () => {
    if (!editPlanId) return;
    const id = editPlanId;

    const pulses = planPulses.trim() ? clampInt(planPulses, 0, null) : null;
    const weekday = planWeek
      .map((v, idx) => (v ? idx : -1))
      .filter((x) => x >= 0);

    const metadata = {
      plan_id: id,
      plan_type: planType,
      valve_mask: planValveMask,
      from: planFrom,
      to: planTo,
      once: planOnce,
      week_days: weekday, // Mon=0..Sun=6
      water_pulses: pulses,
      target_device: device?.deviceId,
    };

    setBusyId(id);
    try {
      await Promise.resolve(
        onSendData([
          {
            variable: `plan${id}_set`,
            value: 1,
            time: new Date().toISOString(),
            metadata,
          },
        ])
      );
    } finally {
      setBusyId(null);
      closeEditors();
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="ag-modal-backdrop">
        <div className="ag-modal-content ag-irrig-modal">
          <div className="ag-modal-header ag-irrig-header">
            <div>
              <h2>{isV4 ? "Προγραμματιστής Κανόνων" : "Προγραμματιστής Πλάνων"}</h2>
              <div className="ag-modal-subtitle">
                {displayDeviceName ? (
                  <span>
                    Συσκευή: <b>{displayDeviceName}</b>
                    {hwRaw ? ` (HW ${hwRaw})` : ""}
                  </span>
                ) : (
                  <span>
                    Ρύθμιση έως 16 {isV4 ? "κανόνων" : "πλάνων"} εκτέλεσης από τον UC511.
                    {hwRaw ? ` (HW ${hwRaw})` : ""}
                  </span>
                )}
              </div>
              {generation === "unknown" && (
                <div className="ag-modal-subtitle" style={{ color: "#b45309" }}>
                  Δεν βρέθηκε hw_version ή μεταβλητές rule/plan. Εμφανίζονται κανόνες (rule) ως προεπιλογή.
                </div>
              )}
            </div>
            <button type="button" className="ag-modal-close" onClick={onClose}>
              ×
            </button>
          </div>

          <div className="ag-modal-body ag-irrig-body">
            <div style={{ marginBottom: 10, fontSize: 12, color: "#6b7280" }}>
              Κάνε κλικ στο status για ενεργοποίηση/απενεργοποίηση ή στο <b>«Ρύθμιση…»</b> για τροποποίηση.
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {isV4
                ? rules.map((r) => {
                    const isBusy = busyId === r.id;
                    const statusLabel = r.enabled ? "Ενεργοποιημένο" : "ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΟ";

                    let repeatText = "—";
                    if (!r.loop) {
                      repeatText = r.startISO ? "Μία φορά" : "—";
                    } else if (
                      (r.loopPeriod || "").toLowerCase().includes("ημέρ") ||
                      (r.loopPeriod || "").toLowerCase().includes("day")
                    ) {
                      repeatText =
                        r.intervalDays && r.intervalDays > 1
                          ? `Κάθε ${r.intervalDays} ημέρες`
                          : "Κάθε ημέρα";
                    } else if (
                      (r.loopPeriod || "").toLowerCase().includes("εβδομ") ||
                      (r.loopPeriod || "").toLowerCase().includes("week")
                    ) {
                      repeatText = r.weekdayMask ? `Εβδομαδιαία: ${r.weekdayMask}` : "Εβδομαδιαία";
                    } else {
                      repeatText = r.loopPeriod || "—";
                    }

                    return (
                      <div key={r.id} className="ag-irrig-valve-card" style={{ padding: "10px 12px" }}>
                        <div className="ag-irrig-valve-header">
                          <h3 style={{ margin: 0 }}>Κανόνας #{r.id}</h3>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              type="button"
                              className="ag-config-btn ghost"
                              onClick={() => openRuleEditor(r.id)}
                              disabled={isBusy}
                            >
                              Ρύθμιση…
                            </button>
                            <button
                              type="button"
                              className={`ag-config-btn ${r.enabled ? "primary" : "ghost"}`}
                              onClick={() => handleToggle(r.id, r.enabled)}
                              disabled={isBusy}
                            >
                              {statusLabel}
                            </button>
                          </div>
                        </div>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12 }}>
                          <div>
                            <b>Επόμενη:</b> {formatLocal(r.startISO)}
                          </div>
                          <div>
                            <b>Επανάληψη:</b> {repeatText}
                          </div>
                          <div>
                            <b>Ενέργεια:</b> {buildActionText(r)}
                          </div>
                          <div>
                            <b>Συνθήκη:</b> {r.condition}
                          </div>
                        </div>
                      </div>
                    );
                  })
                : plans.map((p) => {
                    const isBusy = busyId === p.id;
                    const statusLabel = p.enabled ? "Ενεργοποιημένο" : "ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΟ";

                    return (
                      <div key={p.id} className="ag-irrig-valve-card" style={{ padding: "10px 12px" }}>
                        <div className="ag-irrig-valve-header">
                          <h3 style={{ margin: 0 }}>Πλάνο #{p.id}</h3>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              type="button"
                              className="ag-config-btn ghost"
                              onClick={() => openPlanEditor(p.id)}
                              disabled={isBusy}
                            >
                              Ρύθμιση…
                            </button>
                            <button
                              type="button"
                              className={`ag-config-btn ${p.enabled ? "primary" : "ghost"}`}
                              onClick={() => handleToggle(p.id, p.enabled)}
                              disabled={isBusy}
                            >
                              {statusLabel}
                            </button>
                          </div>
                        </div>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12 }}>
                          <div>
                            <b>Τύπος:</b> {p.planType}
                          </div>
                          <div>
                            <b>Ώρα:</b> {p.from} → {p.to}
                          </div>
                          <div>
                            <b>Επανάληψη:</b> {p.repeatText}
                          </div>
                          <div>
                            <b>Βάνες:</b> {p.valveMask === 3 ? "1 & 2" : `Βάνα ${p.valveMask}`}
                          </div>
                          <div>
                            <b>Παλμοί:</b> {p.waterPulses != null ? p.waterPulses : "—"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
            </div>
          </div>
        </div>
      </div>

      {/* RULE editor */}
      {isV4 && editRuleId != null && (
        <div className="ag-modal-backdrop">
          <div className="ag-modal-content ag-irrig-modal">
            <div className="ag-modal-header ag-irrig-header">
              <div>
                <h2>Ρύθμιση Κανόνα #{editRuleId}</h2>
                <div className="ag-modal-subtitle">Αποθήκευση σε TagoIO (η ανάλυση θα στείλει το downlink).</div>
              </div>
              <button type="button" className="ag-modal-close" onClick={closeEditors}>
                ×
              </button>
            </div>

            <div className="ag-modal-body ag-irrig-body" style={{ display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>Επόμενη εκτέλεση</span>
                <input type="datetime-local" value={editNext} onChange={(e) => setEditNext(e.target.value)} />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>Βάνα</span>
                  <select value={editValve} onChange={(e) => setEditValve(e.target.value)}>
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </select>
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>Παλμοί (προαιρετικό)</span>
                  <input value={editPulses} onChange={(e) => setEditPulses(e.target.value)} placeholder="π.χ. 1200" />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>Διάρκεια (ώρες)</span>
                  <input value={editHours} onChange={(e) => setEditHours(e.target.value)} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>Διάρκεια (λεπτά)</span>
                  <input value={editMinutes} onChange={(e) => setEditMinutes(e.target.value)} />
                </label>
              </div>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={editRepeat} onChange={(e) => setEditRepeat(e.target.checked)} />
                <span>Επανάληψη</span>
              </label>

              {editRepeat && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>Κάθε</span>
                      <input value={editEvery} onChange={(e) => setEditEvery(e.target.value)} />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>Μονάδα</span>
                      <select value={editUnit} onChange={(e) => setEditUnit(e.target.value as any)}>
                        <option value="day">Ημέρα</option>
                        <option value="week">Εβδομάδα</option>
                        <option value="month">Μήνας</option>
                      </select>
                    </label>
                  </div>

                  {editUnit === "week" && (
                    <div style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>Ημέρες εβδομάδας (Δε-Κυ)</span>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {WEEKDAY_LABELS.map((d, idx) => (
                          <label key={d} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                            <input
                              type="checkbox"
                              checked={editWeekdays[idx]}
                              onChange={(e) => {
                                const next = [...editWeekdays];
                                next[idx] = e.target.checked;
                                setEditWeekdays(next);
                              }}
                            />
                            <span>{d}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="ag-config-btn ghost" onClick={closeEditors}>
                  Άκυρο
                </button>
                <button type="button" className="ag-config-btn primary" onClick={handleSaveRule}>
                  Αποθήκευση
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PLAN editor */}
      {!isV4 && editPlanId != null && (
        <div className="ag-modal-backdrop">
          <div className="ag-modal-content ag-irrig-modal">
            <div className="ag-modal-header ag-irrig-header">
              <div>
                <h2>Ρύθμιση Πλάνου #{editPlanId}</h2>
                <div className="ag-modal-subtitle">Αποθήκευση σε TagoIO (η ανάλυση θα στείλει το downlink).</div>
              </div>
              <button type="button" className="ag-modal-close" onClick={closeEditors}>
                ×
              </button>
            </div>

            <div className="ag-modal-body ag-irrig-body" style={{ display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>Τύπος</span>
                <select value={planType} onChange={(e) => setPlanType(e.target.value as any)}>
                  <option value="open">Άνοιγμα</option>
                  <option value="close">Κλείσιμο</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>Βάνες</span>
                <select value={String(planValveMask)} onChange={(e) => setPlanValveMask(Number(e.target.value) as any)}>
                  <option value="1">Βάνα 1</option>
                  <option value="2">Βάνα 2</option>
                  <option value="3">Βάνα 1 & 2</option>
                </select>
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>Από (HH:MM)</span>
                  <input value={planFrom} onChange={(e) => setPlanFrom(e.target.value)} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>Έως (HH:MM)</span>
                  <input value={planTo} onChange={(e) => setPlanTo(e.target.value)} />
                </label>
              </div>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={planOnce} onChange={(e) => setPlanOnce(e.target.checked)} />
                <span>Μία φορά</span>
              </label>

              {!planOnce && (
                <div style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>Εβδομάδα (Δε-Κυ)</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {["Δε", "Τρ", "Τε", "Πε", "Πα", "Σα", "Κυ"].map((d, idx) => (
                      <label key={d} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={planWeek[idx]}
                          onChange={(e) => {
                            const next = [...planWeek];
                            next[idx] = e.target.checked;
                            setPlanWeek(next);
                          }}
                        />
                        <span>{d}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>Παλμοί (προαιρετικό)</span>
                <input value={planPulses} onChange={(e) => setPlanPulses(e.target.value)} placeholder="π.χ. 1200" />
              </label>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="ag-config-btn ghost" onClick={closeEditors}>
                  Άκυρο
                </button>
                <button type="button" className="ag-config-btn primary" onClick={handleSavePlan}>
                  Αποθήκευση
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default IrrigationRulesModal;
