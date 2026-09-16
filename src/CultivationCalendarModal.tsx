// src/CultivationCalendarModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import "./Modals.css";

export const FIELD_CALENDAR_VAR = "field_calendar";

export type CalendarEntryMetadata = {
  /** ISO datetime in UTC (preferred for storage) */
  datetimeISO: string;
  issueText?: string;
  actionText?: string;
  productText?: string;
  otherText?: string;
  notes?: string;
  /** Optional future fields */
  [k: string]: any;
};

export type CalendarPoint = {
  t: number; // ms epoch
  time: string | null;
  value: any;
  metadata: CalendarEntryMetadata;
};

type Props = {
  open: boolean;
  deviceName?: string | null;
  points: CalendarPoint[];
  onClose: () => void;
  /** Called with a ready-to-send payload item for TagoIO.sendData */
  onCreate: (payloadItem: any) => Promise<void> | void;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toDatetimeLocalValue(d: Date) {
  // YYYY-MM-DDTHH:mm in local time
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(
    d.getHours(),
  )}:${pad2(d.getMinutes())}`;
}

function formatLocal(dtISO: string | null | undefined) {
  if (!dtISO) return "—";
  const d = new Date(dtISO);
  if (Number.isNaN(d.getTime())) return String(dtISO);
  // e.g. 02/03/2026 14:05
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(
    d.getHours(),
  )}:${pad2(d.getMinutes())}`;
}

function buildSummary(m: CalendarEntryMetadata) {
  const a = (m.issueText || "").trim();
  const b = (m.actionText || "").trim();
  const c = (m.productText || "").trim();

  const parts = [a, b, c].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  const other = (m.otherText || "").trim();
  const notes = (m.notes || "").trim();
  return other || notes || "Καταγραφή";
}

export const CultivationCalendarModal: React.FC<Props> = ({
  open,
  deviceName,
  points,
  onClose,
  onCreate,
}) => {
  const [datetimeLocal, setDatetimeLocal] = useState<string>(() =>
    toDatetimeLocalValue(new Date()),
  );
  const [issueText, setIssueText] = useState<string>("");
  const [actionText, setActionText] = useState<string>("");
  const [productText, setProductText] = useState<string>("");
  const [otherText, setOtherText] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [pendingPoints, setPendingPoints] = useState<CalendarPoint[]>([]);

  // Clear local pending entries when modal closes (parent points will be authoritative next open)
  useEffect(() => {
    if (!open) setPendingPoints([]);
  }, [open]);

  const sorted = useMemo(() => {
    const seen = new Set<string>();
    const merged: CalendarPoint[] = [];
    for (const p of [...points, ...pendingPoints]) {
      const key = `${p.t || 0}::${String(p.value ?? "")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(p);
    }
    merged.sort((a, b) => (b.t || 0) - (a.t || 0));
    return merged;
  }, [points, pendingPoints]);

  if (!open) return null;

  const resetForm = () => {
    setDatetimeLocal(toDatetimeLocalValue(new Date()));
    setIssueText("");
    setActionText("");
    setProductText("");
    setOtherText("");
    setNotes("");
  };

  const handleSave = async () => {
    // Basic validation: datetime + at least one field
    if (!datetimeLocal) {
      alert("Συμπληρώστε ημερομηνία/ώρα.");
      return;
    }

    const hasAnyText =
      issueText.trim() ||
      actionText.trim() ||
      productText.trim() ||
      otherText.trim() ||
      notes.trim();

    if (!hasAnyText) {
      alert("Συμπληρώστε τουλάχιστον ένα πεδίο πριν την αποθήκευση.");
      return;
    }

    // datetime-local is interpreted in the user's local timezone.
    const dt = new Date(datetimeLocal);
    if (Number.isNaN(dt.getTime())) {
      alert("Μη έγκυρη ημερομηνία/ώρα.");
      return;
    }

    const meta: CalendarEntryMetadata = {
      datetimeISO: dt.toISOString(),
      issueText: issueText.trim() || undefined,
      actionText: actionText.trim() || undefined,
      productText: productText.trim() || undefined,
      otherText: otherText.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    const payloadItem = {
      variable: FIELD_CALENDAR_VAR,
      value: buildSummary(meta),
      metadata: meta,
    };

    try {
      setSaving(true);
      await onCreate(payloadItem);
      // Immediately show in history without waiting for parent state to propagate
      setPendingPoints((prev) => [
        ...prev,
        { t: dt.getTime(), time: meta.datetimeISO, value: payloadItem.value, metadata: meta },
      ]);
      resetForm();
      // Keep modal open for repeated entries.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ag-modal-backdrop" onClick={onClose}>
      <div
        className="ag-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 1100 }}
      >
        <div className="ag-modal-header">
          <div>
            <h2>ΚΑΛΛΙΕΡΓΗΤΙΚΟ ΗΜΕΡΟΛΟΓΙΟ</h2>
            <div className="ag-modal-subtitle">{deviceName ? `Αγρός: ${deviceName}` : ""}</div>
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
          <div className="ag-cal-wrap">
            {/* History */}
            <div className="ag-cal-history">
              <div className="ag-cal-section-title">Ιστορικό</div>
              {sorted.length === 0 ? (
                <div className="muted" style={{ fontSize: 13 }}>
                  Δεν υπάρχουν καταγραφές ακόμα.
                </div>
              ) : (
                <div className="ag-cal-list">
                  {sorted.map((p) => {
                    const meta = (p.metadata || {}) as CalendarEntryMetadata;
                    const key = `${p.t || 0}::${String(p.value ?? "")}`;
                    const isOpen = expandedKey === key;
                    const when = formatLocal(meta.datetimeISO || p.time);
                    const title = String(p.value ?? buildSummary(meta));
                    return (
                      <div key={key} className="ag-cal-item">
                        <div className="ag-cal-item-head">
                          <div>
                            <div className="ag-cal-item-title">{title}</div>
                            <div className="ag-cal-item-time">{when}</div>
                          </div>
                          <button
                            type="button"
                            className="mini-btn"
                            onClick={() => setExpandedKey(isOpen ? null : key)}
                          >
                            {isOpen ? "Κλείσιμο" : "Προβολή"}
                          </button>
                        </div>

                        {isOpen && (
                          <div className="ag-cal-item-body">
                            {meta.issueText ? (
                              <div className="ag-cal-row">
                                <div className="ag-cal-k">Ασθένεια/Εχθρός</div>
                                <div className="ag-cal-v">{meta.issueText}</div>
                              </div>
                            ) : null}
                            {meta.actionText ? (
                              <div className="ag-cal-row">
                                <div className="ag-cal-k">Ενέργεια</div>
                                <div className="ag-cal-v">{meta.actionText}</div>
                              </div>
                            ) : null}
                            {meta.productText ? (
                              <div className="ag-cal-row">
                                <div className="ag-cal-k">Σκεύασμα</div>
                                <div className="ag-cal-v">{meta.productText}</div>
                              </div>
                            ) : null}
                            {meta.otherText ? (
                              <div className="ag-cal-row">
                                <div className="ag-cal-k">Κάτι άλλο</div>
                                <div className="ag-cal-v">{meta.otherText}</div>
                              </div>
                            ) : null}
                            {meta.notes ? (
                              <div className="ag-cal-row">
                                <div className="ag-cal-k">Σχόλια</div>
                                <div className="ag-cal-v">{meta.notes}</div>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Create */}
            <div className="ag-cal-form">
              <div className="ag-cal-section-title">Νέα καταγραφή</div>

              <label className="ag-cal-label">
                Ημερομηνία & Ώρα
                <input
                  className="ag-cal-input"
                  type="datetime-local"
                  value={datetimeLocal}
                  onChange={(e) => setDatetimeLocal(e.target.value)}
                />
              </label>

              <label className="ag-cal-label">
                Εμφάνιση ασθένειας ή εντομολογικού εχθρού
                <input
                  className="ag-cal-input"
                  type="text"
                  value={issueText}
                  onChange={(e) => setIssueText(e.target.value)}
                  placeholder="π.χ. Δάκος / Γλοιοσπόριο"
                />
              </label>

              <label className="ag-cal-label">
                Ενέργεια αντιμετώπισης
                <input
                  className="ag-cal-input"
                  type="text"
                  value={actionText}
                  onChange={(e) => setActionText(e.target.value)}
                  placeholder="π.χ. Ψεκασμός / Κλάδεμα / Παγίδες"
                />
              </label>

              <label className="ag-cal-label">
                Σκεύασμα
                <input
                  className="ag-cal-input"
                  type="text"
                  value={productText}
                  onChange={(e) => setProductText(e.target.value)}
                  placeholder="π.χ. Spinosad / Χαλκός"
                />
              </label>

              <label className="ag-cal-label">
                Κάτι άλλο
                <input
                  className="ag-cal-input"
                  type="text"
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  placeholder="π.χ. Λίπανση / Εργασίες"
                />
              </label>

              <label className="ag-cal-label">
                Σχόλια / Παρατηρήσεις
                <textarea
                  className="ag-cal-textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Οποιαδήποτε παρατήρηση..."
                  rows={4}
                />
              </label>

              <div className="ag-cal-actions">
                <button
                  type="button"
                  className="btn primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Αποθήκευση..." : "Αποθήκευση"}
                </button>
                <button type="button" className="btn" onClick={resetForm} disabled={saving}>
                  Καθαρισμός
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
