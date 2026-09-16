// src/PathoModal.tsx
import React, { useMemo, useState } from "react";
import "./Modals.css";
import { PATHOGENS, PathogenConfig } from "./config/pathogens";

type LatestEntry = {
  value: any;
  metadata: any;
  time: string | null;
};

type Pathogen = {
  key: string;
  name: string;
};

type PathoModalProps = {
  open: boolean;
  latest: Record<string, LatestEntry>;
  pathogens: Pathogen[];
  /** Farmer declaration writer (spray / inspection-clean) for runPerTich PATCH_18/19. */
  // [DECL-UI 2026-07-04 legacy-handoff] `opts` carries the in-modal fields (protection days, product)
  // so the native window.prompt in Dashboard.handleDeclaration is retired. This path NEVER touches
  // valve/irrigation variables; all fields optional -> empty = kernel applies residualDays/14-day.
  onDeclare?: (
    kind: "spray" | "inspection",
    pathogenKey: string,
    opts?: { protectionDays?: number; productName?: string }
  ) => Promise<void> | void;
  onClose: () => void;
};

export const PathoModal: React.FC<PathoModalProps> = ({
  open,
  latest,
  pathogens,
  onDeclare,
  onClose,
}) => {
  const [declared, setDeclared] = useState<Record<string, string>>({});
  const [pendingDecl, setPendingDecl] = useState<{
    kind: "spray" | "inspection";
    key: string;
    name: string;
  } | null>(null);
  // [DECL-UI 2026-07-04] In-modal spray fields (replace the mobile-hostile window.prompt).
  const [protDaysInput, setProtDaysInput] = useState<string>("");
  const [productInput, setProductInput] = useState<string>("");

  // Open the in-widget confirmation (replaces the native window.confirm).
  const declare = (kind: "spray" | "inspection", key: string, name: string) => {
    if (!onDeclare) return;
    setProtDaysInput("");
    setProductInput("");
    setPendingDecl({ kind, key, name });
  };

  const cancelDecl = () => setPendingDecl(null);

  const confirmDecl = async () => {
    if (!pendingDecl || !onDeclare) return;
    const { kind, key } = pendingDecl;
    // Parse the optional in-modal fields. Invalid/empty -> undefined (kernel auto).
    const pd = Number(protDaysInput);
    const protectionDays =
      protDaysInput.trim() !== "" && Number.isFinite(pd) && pd > 0 && pd <= 60 ? Math.round(pd) : undefined;
    const productName = productInput.trim() !== "" ? productInput.trim() : undefined;
    setPendingDecl(null);
    try {
      await onDeclare(kind, key, kind === "spray" ? { protectionDays, productName } : undefined);
      setDeclared((d) => ({
        ...d,
        [key]: kind === "spray" ? "Η δήλωση ψεκασμού στάλθηκε ✓" : "Η επιθεώρηση καταχωρήθηκε ✓",
      }));
    } catch {
      /* onDeclare already alerted */
    }
  };

  // --- Logic ported from your HTML widget ---

  const labelToLevel = (label: any) => {
    const s = String(label || "").toLowerCase();
    if (s.includes("χαμηλ")) return 1;
    if (s.includes("μέτρι") || s.includes("μετρι")) return 2;
    if (s.includes("υψηλ")) return 3;
    if (s.includes("σοβαρ")) return 4;
    return 0;
  };

  const levelToColor = (level: number) => {
    switch (level) {
      case 1:
        return "green";
      case 2:
        return "yellow";
      case 3:
        return "orange";
      case 4:
        return "red";
      default:
        return "yellow";
    }
  };

  const getLevelForVar = (varName: string) => {
    const e = latest[varName];
    if (!e) return 0;
    const metaLevel = Number(e?.metadata?.level);
    if (Number.isFinite(metaLevel) && metaLevel >= 1 && metaLevel <= 4) {
      return metaLevel | 0;
    }
    return labelToLevel(e.value);
  };

  type Row = {
    p: Pathogen;
    idx: number;
    entry: LatestEntry | null;
    level: number;
  };

  const rows: Row[] = useMemo(() => {
    const list: Row[] = pathogens.map((p, idx) => {
      const varName = `fir_message_${p.key}`;
      const entry = latest[varName] ?? null;
      const level = entry ? getLevelForVar(varName) : 0;
      return { p, idx, entry, level };
    });

    // Hide completely pathogens with no data (entry=null)
    const filtered = list.filter((r) => r.entry);

    // Sort: level desc, then original index
    filtered.sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      return a.idx - b.idx;
    });

    return filtered;
  }, [latest, pathogens]);

  if (!open) return null;

  return (
    <>
    <div className="ag-modal-backdrop" onClick={onClose}>
      <div
        className="ag-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 900 }}
      >
        <div className="ag-modal-header">
          <h2>Δείκτης Κινδύνου Ασθενειών</h2>
          
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
          {rows.length === 0 ? (
            <p style={{ color: "#6c7a89", fontSize: 13 }}>
              Δεν υπάρχουν εκτιμήσεις κινδύνου παθογόνων ακόμα.
            </p>
          ) : (
            <div>
              {rows.map((row) => {
                const varName = `fir_message_${row.p.key}`;
                const e = row.entry!;
                const level = row.level;
                const color = levelToColor(level);

                const valueText = String(e.value ?? "—");
                const descText =
                  (e?.metadata && e.metadata.text) || "Καμία εκτίμηση ακόμα.";

                // segments 1..4
                const segments = [1, 2, 3, 4];

                return (
                  <div
                    key={row.p.key}
                    className="card"
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e8eef3",
                      borderRadius: 14,
                      padding: 16,
                      boxShadow: "0 2px 12px rgba(0,0,0,.05)",
                      marginBottom: 12,
                    }}
                  >
                    <div
                      className="row"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "220px 1fr",
                        gap: 16,
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <p
                          className="name"
                          style={{
                            fontWeight: 800,
                            color: "#1a2b3c",
                            margin: 0,
                            fontSize: "1.05rem",
                          }}
                        >
                          {row.p.name}
                        </p>
                        <p
                          className="meta"
                          style={{
                            marginTop: 4,
                            color: "#6c7a89",
                            fontSize: ".92rem",
                          }}
                        >
                          Εκτίμηση κινδύνου προσβολής
                        </p>
                      </div>

                      <div
                        className="bar"
                        style={{ display: "flex", gap: 6, alignItems: "center" }}
                      >
                        <div
                          className="segments"
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(4,1fr)",
                            gap: 6,
                            width: "100%",
                            height: 14,
                          }}
                        >
                          {segments.map((i) => {
                            const filled = i <= level;
                            const baseStyle: React.CSSProperties = {
                              borderRadius: 999,
                              background: "#ecf1f6",
                              border: "1px solid #dfe6ee",
                              transition:
                                "background .2s ease, border-color .2s ease",
                            };

                            let segStyle: React.CSSProperties = { ...baseStyle };
                            if (filled) {
                              segStyle.borderColor = "transparent";
                              if (color === "green")
                                segStyle.background = "#2ecc71";
                              if (color === "yellow")
                                segStyle.background = "#f1c40f";
                              if (color === "orange")
                                segStyle.background = "#f39c12";
                              if (color === "red")
                                segStyle.background = "#e74c3c";
                            }

                            return (
                              <div
                                key={i}
                                className={`seg${filled ? " filled " + color : ""}`}
                                style={segStyle}
                              />
                            );
                          })}
                        </div>

                        <span
                          className={`badge ${color}`}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 999,
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                            fontSize: ".9rem",
                            marginLeft: 10,
                            color:
                              color === "yellow" || color === "orange"
                                ? "#222"
                                : "#fff",
                            background:
                              color === "green"
                                ? "#2ecc71"
                                : color === "yellow"
                                ? "#f1c40f"
                                : color === "orange"
                                ? "#f39c12"
                                : "#e74c3c",
                          }}
                        >
                          {valueText}
                        </span>
                      </div>
                    </div>

                    <p
                      className={`desc${
                        descText === "Καμία εκτίμηση ακόμα." ? " empty" : ""
                      }`}
                      style={{
                        margin: "10px 0 0",
                        color:
                          descText === "Καμία εκτίμηση ακόμα."
                            ? "#6c7a89"
                            : "#1a2b3c",
                        lineHeight: 1.45,
                        fontSize: ".97rem",
                      }}
                    >
                      {descText}
                    </p>
                    {Number.isFinite(Number(e?.metadata?.protection_days_left)) && (
                      <div
                        style={{
                          marginTop: 8,
                          display: "inline-block",
                          padding: "4px 10px",
                          borderRadius: 999,
                          background: "#e8f0ff",
                          color: "#163970",
                          border: "1px solid #cbd9ff",
                          fontWeight: 700,
                          fontSize: ".85rem",
                        }}
                      >
                        🛡️ Κάλυψη ψεκασμού: ακόμα {Number(e.metadata.protection_days_left)}{" "}
                        ημέρες
                      </div>
                    )}

                    {onDeclare && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          marginTop: 12,
                          alignItems: "center",
                        }}
                      >
                        <button
                          type="button"
                          className="ag-irrig-btn"
                          style={{ width: "auto", padding: "8px 14px", fontSize: ".85rem" }}
                          onClick={() => declare("spray", row.p.key, row.p.name)}
                        >
                          🛡️ Δήλωσα ψεκασμό
                        </button>
                        <button
                          type="button"
                          className="ag-irrig-btn"
                          style={{
                            width: "auto",
                            padding: "8px 14px",
                            fontSize: ".85rem",
                            background: "#16a34a",
                          }}
                          onClick={() => declare("inspection", row.p.key, row.p.name)}
                        >
                          👁️ Επιθεώρησα — καθαρό
                        </button>
                        {declared[row.p.key] && (
                          <span
                            style={{
                              alignSelf: "center",
                              color: "#1e7a44",
                              fontWeight: 700,
                              fontSize: ".85rem",
                            }}
                          >
                            {declared[row.p.key]}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>

    {pendingDecl && (
      <div className="ag-modal-backdrop confirmation" onClick={cancelDecl}>
        <div
          className="ag-modal-content confirmation ag-irrig-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="ag-modal-header ag-irrig-header">
            <div>
              <h2>Επιβεβαίωση δήλωσης</h2>
              <div className="ag-modal-subtitle">{pendingDecl.name}</div>
            </div>
            <button
              className="ag-modal-close ag-modal-close-topright"
              type="button"
              onClick={cancelDecl}
              aria-label="Κλείσιμο"
            >
              ✕
            </button>
          </div>

          <div className="ag-modal-body ag-irrig-body">
            <p style={{ margin: 0 }}>
              {pendingDecl.kind === "spray"
                ? "Θέλετε να καταχωρήσετε δήλωση ψεκασμού για αυτό το παθογόνο; Η κατάσταση προστασίας θα ενεργοποιηθεί και οι συναγερμοί κινδύνου θα σημανθούν «υπό προστασία» μέχρι τη λήξη της."
                : "Θέλετε να καταχωρήσετε «επιθεώρηση — καθαρό»; Ο δείκτης κινδύνου για αυτό το παθογόνο θα επανέλθει στο κανονικό (μηδέν) και θα ξαναμετρήσει από την αρχή."}
            </p>

            {pendingDecl.kind === "spray" && (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: ".9rem", fontWeight: 600 }}>
                  Προϊόν / σκεύασμα (προαιρετικό)
                  <input
                    type="text"
                    inputMode="text"
                    value={productInput}
                    onChange={(e) => setProductInput(e.target.value)}
                    placeholder="π.χ. χαλκός, θειάφι…"
                    style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: "1rem", minHeight: 44, boxSizing: "border-box" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: ".9rem", fontWeight: 600 }}>
                  Ημέρες προστασίας (προαιρετικό — κενό = αυτόματο)
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={60}
                    value={protDaysInput}
                    onChange={(e) => setProtDaysInput(e.target.value)}
                    placeholder="αυτόματο (PHI σκευάσματος)"
                    style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: "1rem", minHeight: 44, boxSizing: "border-box" }}
                  />
                </label>
                <span style={{ fontSize: ".8rem", color: "#64748b" }}>
                  Αν το αφήσεις κενό, το σύστημα εφαρμόζει αυτόματα το διάστημα προστασίας (PHI) του σκευάσματος.
                </span>
              </div>
            )}
          </div>

          <div
            className="ag-irrig-meters"
            style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}
          >
            <button type="button" className="ag-irrig-btn close" onClick={cancelDecl}>
              Ακύρωση
            </button>
            <button type="button" className="ag-irrig-btn" onClick={confirmDecl}>
              Επιβεβαίωση &amp; Αποστολή
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};
