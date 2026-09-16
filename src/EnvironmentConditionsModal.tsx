import React, { useEffect, useMemo, useState } from "react";
import "./Modals.css";

type LatestEntry = { value: any; metadata?: any; time?: string | null };

type Condition = {
  id: string;                  // e.g. "heat"
  label: string;               // e.g. "Ζέστη"
  desc?: string;
  confirmText?: string;
  /** Which switch_X must be ON when this condition is active */
  control?: Record<string, boolean>; // e.g. { switch_1: true, switch_2: false }
  /** One of iconSvg or iconUrl can be used */
  iconSvg?: string;
  iconUrl?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Latest values by variable name (from Dashboard state) */
  latest: Record<string, LatestEntry>;
  /** Callthrough to TagoIO.sendData already handled in Dashboard */
  onSendData: (payload: any[]) => Promise<void> | void;

  /** Optional overrides (fallbacks match your HTML) */
  prefix?: string;             // default: "innodays2025"  -> variables are prefix_id (boolean)
  conditions?: Condition[];    // default: the 5 sample conditions below
};

const DEFAULT_PREFIX = "innodays2025";

// Mirrors your HTML’s CONDITIONS array
const DEFAULT_CONDITIONS: Condition[] = [
  {
    id: "cold",
    label: "Κρύο",
    desc: "Συνθήκες με κρύο",
    confirmText:
      "Έρχονται κρύες συνθήκες. Το παράθυρο και η παρεία θα κλείσουν.",
    control: { switch_2: true },
    iconUrl: "https://unpkg.com/lucide-static@0.554.0/icons/snowflake.svg",
  },
  {
    id: "midheat_lowwind",
    label: "Μέτρια Ζέστη/Ήπιος Εξωτερικός Άνεμος",
    desc: "Μέτρια ζέστη χωρίς να φυσάει έξω.",
    confirmText:
    "Έρχονται συνθήκες μέτριας ζέστης χωρίς να φυσάει. Το παράθυρο θα ανοίξει και η παρεία θα σταματήσει να λειτουργεί.",
    control: { switch_1: true },
    iconUrl: "https://unpkg.com/heroicons@2.1.5/24/outline/cloud.svg",
  },
  {
    id: "midheat_highwind",
    label: "Μέτρια Ζέστη/Δυνατός Εξωτερικός Άνεμος",
    desc: "Μέτρια ζέστη με τον άνεμο έξω να φυσάει.",
    confirmText:
    "Έρχονται συνθήκες μέτριας ζέστης με τον άνεμο έξω να φυσάει. Το παράθυρο και η παρεία θα κλείσουν.",
    control: { switch_2: true },
    iconUrl: "https://unpkg.com/heroicons@2.1.5/24/outline/cloud-arrow-up.svg",
  },
  {
    id: "highheat_lowwind",
    label: "Υψηλή Ζέστη/Ήπιος Εξωτερικός Άνεμος",
    desc: "Υψηλή ζέστη χωρίς να φυσάει έξω.",
    confirmText:
    "Έρχονται συνθήκες υψηλής ζέστης χωρίς να φυσάει. Το παράθυρο θα ανοίξει και η παρεία θα δουλεύει.",
    control: { switch_1: true, switch_3: true  },
    iconUrl: "https://unpkg.com/heroicons@2.1.5/24/outline/sun.svg",
  },
  {
    id: "highheat_highwind",
    label: "Υψηλή Ζέστη/Ήπιος Εξωτερικός Άνεμος",
    desc: "Υψηλή ζέστη με τον άνεμο έξω να φυσάει.",
    confirmText:
    "Έρχονται συνθήκες υψηλής ζέστης με τον άνεμο έξω να φυσάει. Το παράθυρο θα κλείσει και η παρεία θα δουλεύει.",
    control: { switch_2: true, switch_3: true },
    iconUrl: "https://unpkg.com/heroicons@2.1.5/24/outline/fire.svg",
  }
];

function variableFor(prefix: string, id: string) {
  return `${prefix}_${id}`;
}

export const EnvironmentConditionsModal: React.FC<Props> = ({
  open,
  onClose,
  latest,
  onSendData,
  prefix = DEFAULT_PREFIX,
  conditions = DEFAULT_CONDITIONS,
}) => {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");

  // Which condition is currently active (first variable with true)
  const activeId = useMemo(() => {
    for (const c of conditions) {
      const vname = variableFor(prefix, c.id);
      const e = latest[vname];
      if (e && e.value === true) return c.id;
    }
    return null;
  }, [latest, conditions, prefix]);

  // Build a payload: exactly one condition = true; the rest = false.
  // If a condition is selected, also emit switch_1..switch_8 following `control`.
  function buildPayload(selectedId: string | null) {
    const arr: any[] = [];

    // One-hot on the condition variables
    for (const c of conditions) {
      arr.push({
        variable: variableFor(prefix, c.id),
        value: selectedId === c.id,
      });
    }

    // Switch fan-out (if selecting a condition; “disable all” skips this)
    if (selectedId) {
      const cond = conditions.find((x) => x.id === selectedId);
      const ctrl = cond?.control || {};
      for (let i = 1; i <= 8; i++) {
        const key = `switch_${i}`;
        arr.push({
          variable: key, // same as original (no extra prefix)
          value: !!ctrl[key],
        });
      }
    }

    return arr;
  }

  async function handleApply(selectedId: string | null) {
    try {
      setBusy(true);
      setStatus(selectedId ? "Αποστολή…" : "Απενεργοποίηση όλων…");
      await onSendData(buildPayload(selectedId));
      setStatus("");
      setPendingId(null);
    } catch (e) {
      console.error("sendData error", e);
      setStatus(
        "Αποτυχία αποστολής. Ελέγξτε ότι το widget έχει Device στο 'Data from'."
      );
    } finally {
      setBusy(false);
    }
  }

  function openConfirm(id: string) {
    setPendingId(id);
  }
  function closeConfirm() {
    setPendingId(null);
  }

  useEffect(() => {
    // Clear inline status when modal closes
    if (!open) {
      setPendingId(null);
      setBusy(false);
      setStatus("");
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="ag-modal-backdrop">
      <div className="ag-modal-content">
        <div className="ag-modal-header">
          <div>
            <h2>Συνθήκες Περιβάλλοντος</h2>
            <div className="ag-modal-subtitle">
              Επιλογή μίας ενεργής συνθήκης (one-hot). Οι υπόλοιπες απενεργοποιούνται.
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
          {/* Top actions */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
              {status}
            </div>
            <button
              type="button"
              className="ag-config-btn ghost"
              onClick={() => handleApply(null)}
              disabled={busy}
              aria-busy={busy ? "true" : "false"}
            >
              Απενεργοποίηση όλων
            </button>
          </div>

          {/* Cards grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 12,
              alignItems: "stretch",
            }}
          >
            {conditions.map((c) => {
              const isActive = activeId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openConfirm(c.id)}
                  className="card"
                  style={{
                    textAlign: "left",
                    cursor: "pointer",
                    border: "1px solid #e5e7eb",
                    borderRadius: 16,
                    padding: "14px 16px",
                    background: "#fff",
                    boxShadow: "0 1px 2px rgba(0,0,0,.04)",
                    outline: isActive ? "3px solid rgba(37,99,235,.14)" : "none",
                    borderColor: isActive ? "#2563eb" : "#e5e7eb",
                  }}
                  aria-pressed={isActive ? "true" : "false"}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>{c.label}</h3>
                    <span
                      className={`statBadge`}
                      style={{
                        background: isActive ? "#dcfce7" : "#f1f5f9",
                        border: `1px solid ${isActive ? "#bbf7d0" : "#e2e8f0"}`,
                        color: isActive ? "#166534" : "#475569",
                        borderRadius: 999,
                      }}
                    >
                      <span
                        className="dot"
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: isActive ? "#16a34a" : "#64748b",
                          opacity: 0.8,
                        }}
                      />
                      {isActive ? "Ενεργό" : "Ανενεργό"}
                    </span>
                  </div>

                  {c.iconSvg || c.iconUrl ? (
                    <div
                      aria-hidden="true"
                      style={{
                        width: 44,
                        height: 44,
                        display: "grid",
                        placeItems: "center",
                        borderRadius: 10,
                        border: "1px solid #e5e7eb",
                        background: "#f8fafc",
                        margin: "8px 0",
                      }}
                      dangerouslySetInnerHTML={
                        c.iconSvg
                          ? { __html: c.iconSvg }
                          : undefined
                      }
                    >
                      {!c.iconSvg && c.iconUrl ? (
                        // eslint-disable-next-line jsx-a11y/alt-text
                        <img src={c.iconUrl} style={{ width: 26, height: 26 }} />
                      ) : null}
                    </div>
                  ) : null}

                  {c.desc ? (
                    <div style={{ fontSize: 13, color: "#64748b" }}>{c.desc}</div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Confirmation mini-modal stacked above (uses z-index bump classes if needed) */}
      {pendingId && (
        <div className="ag-modal-backdrop confirmation">
          <div className="ag-modal-content confirmation" style={{ maxWidth: 560 }}>
            <div className="ag-modal-header">
              <h2>Επιβεβαίωση</h2>
              
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
              <p style={{ color: "#6b7280" }}>
                {conditions.find((x) => x.id === pendingId)?.confirmText ||
                  "Επιβεβαιώνετε την αλλαγή;"}
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 10 }}>
                <button className="ag-config-btn" onClick={closeConfirm}>
                  Ακύρωση
                </button>
                <button
                  className="ag-config-btn primary"
                  onClick={() => handleApply(pendingId)}
                  disabled={busy}
                >
                  Επιβεβαίωση
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
