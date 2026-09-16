/* =====================================================================
 * UC511 Valve-Command Feedback Overlay  (runtime patch, no build needed)
 * ---------------------------------------------------------------------
 * Drop-in companion script for the "Καλλιέργεια — Σύνοψη Πεδίου" widget.
 * It does NOT modify the minified bundle. It wraps the TagoIO host hooks
 * (sendData / onRealtime / onStart) to drive a feedback flow for the
 * quick valve commands sent from the "Πρόγραμμα άρδευσης" modal:
 *
 *   1. User presses on/off (or timed) → widget calls
 *        TagoIO.sendData({ device, variable:"valve_X_command", value })
 *      We intercept it and open a small status panel docked inside the
 *      irrigation modal.
 *
 *   2. DOWNLINK-RECEIVED echo  (parser: valve_X_command_feedback,
 *      metadata.ack === "downlink_received") is expected within 10 s.
 *      A live seconds counter runs; it stops the instant the echo lands.
 *      If 10 s pass with no echo → "Το downlink δεν παραλήφθηκε" alert.
 *
 *   3. VALVE STATUS change (parser: valve_X = "on"/"off") matching the
 *      requested state is expected within 25 s (counted from send).
 *      If 25 s pass with no matching status → alert + "Επανάληψη" button.
 *
 *   4. On the user's retry the same 10 s / 25 s rules apply again.
 *      If the retry also fails → communication-issue panel with:
 *        • a help pop-up (Milesight ToolBox download + NFC steps), and
 *        • a "Κλήση υποστήριξης" action.
 *
 * Correlation is by (deviceId, valveIndex). Timed commands open the same
 * valve, so they use the same "expect on" status target.
 *
 * Install: host this file in TagoIO Files next to index.html and add ONE
 * line to index.html AFTER the bundle's <script type="module"> tag:
 *
 *   <script src="https://api.tago.io/file/.../betaTesting/uc511-feedback-overlay.js"></script>
 *
 * Everything below is plain ES5-ish browser JS — no bundler, no imports.
 * ===================================================================== */
(function () {
  "use strict";

  if (window.__uc511FeedbackOverlay) return; // idempotent
  window.__uc511FeedbackOverlay = true;

  // Resolve DOM/timer globals from window (works in browser global scope and
  // when this file is evaluated with a non-global `this`, e.g. test harnesses).
  var document = window.document;
  var setTimeout = window.setTimeout.bind(window);
  var clearTimeout = window.clearTimeout.bind(window);
  var setInterval = window.setInterval.bind(window);
  var clearInterval = window.clearInterval.bind(window);

  // ---- Tunables (overridable via window.__uc511FBConfig before load) ---
  var CFG = window.__uc511FBConfig || {};
  var DOWNLINK_TIMEOUT_MS = CFG.downlinkTimeoutMs || 20000; // echo within 20 s
  var STATUS_TIMEOUT_MS = CFG.statusTimeoutMs || 35000; // valve status within 35 s
  var SUCCESS_DISMISS_MS = CFG.successDismissMs || 10000; // auto-close after success
  var SUPPORT_PHONE = CFG.supportPhone || "+302102200611"; // TODO: real number
  var SUPPORT_PHONE_TEL = CFG.supportPhoneTel || "+302102200611"; // tel: form
  var PLAY_URL =
    CFG.playUrl || "https://play.google.com/store/apps/details?id=com.ursalinknfc";
  var APPSTORE_URL =
    CFG.appStoreUrl || "https://apps.apple.com/app/milesight-toolbox/id1518748039";

  // ---- Tracker state --------------------------------------------------
  // One active flow at a time per (device, valve). Keyed "device::valveIdx".
  var flows = Object.create(null);

  // When a retry re-sends a command through the wrapped sendData, we stash the
  // current attempt count here keyed by (device::valve) so the send hook can
  // start the new flow with the right attempt number instead of resetting to 1.
  var pendingAttempt = Object.create(null);

  function flowKey(device, valveIdx) {
    return String(device || "") + "::" + String(valveIdx);
  }

  // ---- Small helpers --------------------------------------------------
  function now() {
    return Date.now();
  }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function clearTimers(f) {
    if (!f) return;
    if (f.tickTimer) {
      clearInterval(f.tickTimer);
      f.tickTimer = null;
    }
    if (f.dlTimer) {
      clearTimeout(f.dlTimer);
      f.dlTimer = null;
    }
    if (f.stTimer) {
      clearTimeout(f.stTimer);
      f.stTimer = null;
    }
  }

  // ---- Styles (scoped, theme-matched to the widget) -------------------
  function injectStyles() {
    if (document.getElementById("uc511-fb-styles")) return;
    var css =
      "" +
      ".uc511fb-panel{margin-top:12px;border-radius:14px;border:1px solid var(--line,#e8eef3);" +
      "background:#fff;padding:12px 14px;font-size:13px;color:var(--ink,#1a2b3c);" +
      "box-shadow:0 6px 20px #0f172a14;animation:uc511fb-in .18s ease}" +
      "@keyframes uc511fb-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}" +
      ".uc511fb-row{display:flex;align-items:center;gap:10px}" +
      ".uc511fb-title{font-weight:700;font-size:13px;margin:0 0 2px}" +
      ".uc511fb-sub{color:var(--muted,#6c7a89);font-size:12px}" +
      ".uc511fb-steps{margin:10px 0 0;display:flex;flex-direction:column;gap:8px}" +
      ".uc511fb-step{display:flex;align-items:center;gap:10px}" +
      ".uc511fb-dot{flex:0 0 auto;width:22px;height:22px;border-radius:999px;display:flex;" +
      "align-items:center;justify-content:center;font-size:12px;font-weight:700;" +
      "background:var(--line,#e8eef3);color:var(--muted,#6c7a89)}" +
      ".uc511fb-dot.ok{background:var(--green,#2ecc71);color:#fff}" +
      ".uc511fb-dot.wait{background:var(--blue,#2f6feb);color:#fff}" +
      ".uc511fb-dot.err{background:var(--red,#e74c3c);color:#fff}" +
      ".uc511fb-step-main{flex:1 1 auto;min-width:0}" +
      ".uc511fb-step-name{font-weight:600}" +
      ".uc511fb-counter{font-variant-numeric:tabular-nums;font-weight:700;color:var(--blue,#2f6feb)}" +
      ".uc511fb-alert{margin-top:10px;border-radius:12px;padding:10px 12px;font-size:12.5px;line-height:1.45}" +
      ".uc511fb-alert.warn{background:#fff4e0;border:1px solid var(--orange,#f39c12);color:#8a5300}" +
      ".uc511fb-alert.err{background:#fdecea;border:1px solid var(--red,#e74c3c);color:#9b2218}" +
      ".uc511fb-alert.ok{background:#e9f9ef;border:1px solid var(--green,#2ecc71);color:#1e7a44}" +
      ".uc511fb-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}" +
      ".uc511fb-btn{border:none;border-radius:999px;padding:9px 14px;font-size:12.5px;font-weight:700;" +
      "cursor:pointer;background:var(--blue,#2f6feb);color:#fff}" +
      ".uc511fb-btn.ghost{background:#eef2f7;color:var(--ink,#1a2b3c)}" +
      ".uc511fb-btn.warn{background:var(--orange,#f39c12);color:#fff}" +
      ".uc511fb-btn.danger{background:var(--red,#e74c3c);color:#fff}" +
      ".uc511fb-btn:active{transform:translateY(1px)}" +
      ".uc511fb-x{margin-left:auto;border:none;background:transparent;cursor:pointer;" +
      "color:var(--muted,#6c7a89);font-size:16px;line-height:1;padding:2px 6px}" +
      /* help modal */
      ".uc511fb-help-back{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:10050;" +
      "display:flex;align-items:center;justify-content:center;padding:16px}" +
      ".uc511fb-help{background:#fff;border-radius:14px;max-width:560px;width:100%;max-height:88vh;" +
      "overflow:auto;padding:18px 20px;box-shadow:0 24px 70px #0f172a66}" +
      ".uc511fb-help h3{margin:0 0 4px;font-size:17px}" +
      ".uc511fb-help h4{margin:16px 0 6px;font-size:14px}" +
      ".uc511fb-help p,.uc511fb-help li{font-size:13px;line-height:1.5;color:var(--ink,#1a2b3c)}" +
      ".uc511fb-help ol{margin:6px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:6px}" +
      ".uc511fb-help .tip{background:#f1f5fb;border-radius:10px;padding:10px 12px;margin-top:10px;" +
      "font-size:12.5px;color:var(--muted,#6c7a89)}" +
      ".uc511fb-help-links{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}" +
      ".uc511fb-help-links a{text-decoration:none}" +
      ".uc511fb-help-head{display:flex;align-items:flex-start;gap:10px}" +
      ".uc511fb-anim{margin-top:10px;background:#f7f9fc;border:1px solid var(--line,#e8eef3);" +
      "border-radius:12px;padding:10px;}" +
      ".uc511fb-anim svg{width:100%;height:auto;display:block;max-width:420px;margin:0 auto}" +
      ".uc511fb-anim-cap{text-align:center;font-size:12px;color:var(--muted,#6c7a89);margin-top:6px}";
    var s = document.createElement("style");
    s.id = "uc511-fb-styles";
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ---- Locate the irrigation modal so we can dock the panel -----------
  function findModalBody() {
    // The irrigation modal uses .ag-irrig-modal; its scrollable area is .ag-irrig-body.
    var modal = document.querySelector(".ag-irrig-modal");
    if (!modal) return null;
    var body = modal.querySelector(".ag-irrig-body") || modal.querySelector(".ag-modal-body");
    return body || modal;
  }

  // ---- Panel construction --------------------------------------------
  function buildPanel(f) {
    var panel = el("div", "uc511fb-panel");
    panel.setAttribute("data-uc511fb", f.key);

    var head = el("div", "uc511fb-row");
    var titleWrap = el("div");
    var title = el("p", "uc511fb-title", "Αποστολή εντολής · " + f.valveLabel);
    var sub = el(
      "div",
      "uc511fb-sub",
      f.actionLabel + " — αναμονή επιβεβαίωσης από τον ελεγκτή"
    );
    titleWrap.appendChild(title);
    titleWrap.appendChild(sub);
    head.appendChild(titleWrap);

    var x = el("button", "uc511fb-x", "✕");
    x.title = "Κλείσιμο";
    x.onclick = function () {
      dismissFlow(f);
    };
    head.appendChild(x);
    panel.appendChild(head);

    // Steps
    var steps = el("div", "uc511fb-steps");

    // Step 1: downlink received
    var s1 = el("div", "uc511fb-step");
    f.dot1 = el("div", "uc511fb-dot wait", "1");
    var s1main = el("div", "uc511fb-step-main");
    var s1name = el("div", "uc511fb-step-name", "Παραλαβή downlink");
    f.s1status = el("div", "uc511fb-sub", "Αναμονή… ");
    f.counter1 = el("span", "uc511fb-counter", "0s");
    f.s1status.appendChild(f.counter1);
    s1main.appendChild(s1name);
    s1main.appendChild(f.s1status);
    s1.appendChild(f.dot1);
    s1.appendChild(s1main);
    steps.appendChild(s1);

    // Step 2: valve actuated
    var s2 = el("div", "uc511fb-step");
    f.dot2 = el("div", "uc511fb-dot", "2");
    var s2main = el("div", "uc511fb-step-main");
    var s2name = el("div", "uc511fb-step-name", "Εκτέλεση εντολής βάνας");
    f.s2status = el("div", "uc511fb-sub", "Αναμονή κατάστασης βάνας…");
    s2main.appendChild(s2name);
    s2main.appendChild(f.s2status);
    s2.appendChild(f.dot2);
    s2.appendChild(s2main);
    steps.appendChild(s2);

    panel.appendChild(steps);

    // Alert + actions containers (filled later)
    f.alertBox = el("div");
    panel.appendChild(f.alertBox);
    f.actionBox = el("div", "uc511fb-actions");
    panel.appendChild(f.actionBox);

    f.panel = panel;
    return panel;
  }

  function mountPanel(f) {
    injectStyles();
    var host = findModalBody();
    if (!host) {
      // Modal not open (e.g. command from elsewhere) — skip UI silently.
      f.detached = true;
      return;
    }
    // Remove any stale panel for this flow.
    var prev = host.querySelector('[data-uc511fb="' + f.key + '"]');
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
    host.appendChild(buildPanel(f));
  }

  function setAlert(f, kind, html) {
    if (!f.alertBox) return;
    f.alertBox.innerHTML = "";
    if (!kind) return;
    var a = el("div", "uc511fb-alert " + kind);
    a.innerHTML = html;
    f.alertBox.appendChild(a);
  }

  function clearActions(f) {
    if (f.actionBox) f.actionBox.innerHTML = "";
  }
  function addAction(f, label, cls, handler) {
    var b = el("button", "uc511fb-btn" + (cls ? " " + cls : ""), label);
    b.onclick = handler;
    f.actionBox.appendChild(b);
    return b;
  }

  // ---- Flow lifecycle -------------------------------------------------
  function startFlow(device, valveIdx, wantOpen, opts) {
    opts = opts || {};
    var key = flowKey(device, valveIdx);

    // Cancel any existing flow on the same valve.
    if (flows[key]) {
      clearTimers(flows[key]);
      if (flows[key].panel && flows[key].panel.parentNode) {
        flows[key].panel.parentNode.removeChild(flows[key].panel);
      }
    }

    var valveLabel = "Βάνα " + (valveIdx + 1);
    var actionLabel = opts.timed
      ? "Άνοιγμα για " + opts.minutes + " λεπτά"
      : wantOpen
      ? "Άνοιγμα"
      : "Κλείσιμο";

    var f = {
      key: key,
      device: device,
      valveIdx: valveIdx,
      wantOpen: wantOpen, // boolean target valve state ("on" if true)
      timed: !!opts.timed,
      minutes: opts.minutes,
      valveLabel: valveLabel,
      actionLabel: actionLabel,
      attempt: (opts.attempt || 0) + 1, // 1 = first try, 2 = retry
      startTs: now(),
      sentAtMs: now(), // wall-clock send time; feedback must be at/after this
      dlReceived: false,
      statusOk: false,
      dlReceivedTs: null,
    };
    flows[key] = f;

    mountPanel(f);

    // Live counter (for step 1) — real elapsed seconds.
    f.tickTimer = setInterval(function () {
      if (f.dlReceived) return; // stop counting once echo lands
      var secs = Math.floor((now() - f.startTs) / 1000);
      if (f.counter1) f.counter1.textContent = secs + "s";
    }, 250);

    // 10 s downlink-received timeout
    f.dlTimer = setTimeout(function () {
      if (!f.dlReceived) onDownlinkTimeout(f);
    }, DOWNLINK_TIMEOUT_MS);

    // 25 s status timeout (from send)
    f.stTimer = setTimeout(function () {
      if (!f.statusOk) onStatusTimeout(f);
    }, STATUS_TIMEOUT_MS);

    return f;
  }

  function dismissFlow(f) {
    clearTimers(f);
    if (f.panel && f.panel.parentNode) f.panel.parentNode.removeChild(f.panel);
    delete flows[f.key];
  }

  // ---- Realtime event handlers ---------------------------------------
  function onEchoReceived(f) {
    if (f.dlReceived) return;
    f.dlReceived = true;
    f.dlReceivedTs = now();
    if (f.dlTimer) {
      clearTimeout(f.dlTimer);
      f.dlTimer = null;
    }
    var secs = ((f.dlReceivedTs - f.startTs) / 1000).toFixed(1);
    if (f.dot1) {
      f.dot1.className = "uc511fb-dot ok";
      f.dot1.textContent = "✓";
    }
    if (f.s1status) {
      f.s1status.textContent = "Ελήφθη από τη συσκευή σε " + secs + "s";
    }
    if (f.dot2) f.dot2.className = "uc511fb-dot wait";
    if (f.s2status) f.s2status.textContent = "Η συσκευή εκτελεί την εντολή…";
    // clear any "downlink not received" warning if it had been shown early
    if (!f.statusOk) setAlert(f, null);
  }

  function onStatusReceived(f, isOpen) {
    // Only count the status that matches the requested state.
    var matches = isOpen === f.wantOpen;
    if (!matches) return;
    if (f.statusOk) return;
    f.statusOk = true;
    clearTimers(f);
    // Make sure step 1 reads as done even if the echo was missed but status arrived.
    if (!f.dlReceived && f.dot1) {
      f.dot1.className = "uc511fb-dot ok";
      f.dot1.textContent = "✓";
      if (f.s1status) f.s1status.textContent = "Ολοκληρώθηκε";
    }
    if (f.dot2) {
      f.dot2.className = "uc511fb-dot ok";
      f.dot2.textContent = "✓";
    }
    if (f.s2status) {
      f.s2status.textContent = f.wantOpen ? "Η βάνα άνοιξε" : "Η βάνα έκλεισε";
    }
    setAlert(f, "ok", "Η εντολή ολοκληρώθηκε με επιτυχία.");
    clearActions(f);
    // auto-dismiss after a short moment
    setTimeout(function () {
      // only auto-close if still the success state
      if (flows[f.key] === f && f.statusOk) dismissFlow(f);
    }, SUCCESS_DISMISS_MS);
  }

  function onDownlinkTimeout(f) {
    if (f.dlReceived) return;
    // Do NOT declare a failure here. The status window is still open, and the echo/valve-status
    // very often lands a moment later (TagoIO realtime-delivery lag beyond the device's response).
    // Showing a red "downlink not received" now, only to flip to success 1–2 s later when the
    // confirmation arrives, is confusing. Keep the step in a quiet "waiting" state instead — the
    // ONLY terminal failure point is onStatusTimeout. When the echo/status arrives, the relevant
    // handler resolves the step immediately.
    if (f.s1status) f.s1status.textContent = "Καθυστέρηση επιβεβαίωσης… αναμονή κατάστασης βάνας";
  }

  function onStatusTimeout(f) {
    if (f.statusOk) return;
    clearTimers(f);
    if (f.dot2) {
      f.dot2.className = "uc511fb-dot err";
      f.dot2.textContent = "!";
    }
    if (f.s2status) f.s2status.textContent = "Δεν επιβεβαιώθηκε αλλαγή κατάστασης";

    if (f.attempt < 2) {
      // First failure → offer retry.
      setAlert(
        f,
        "warn",
        "<strong>Η εντολή δεν ολοκληρώθηκε.</strong> Δεν λάβαμε την αναμενόμενη " +
          "κατάσταση της βάνας μέσα σε " +
          STATUS_TIMEOUT_MS / 1000 +
          " δευτερόλεπτα. Μπορείτε να δοκιμάσετε ξανά."
      );
      clearActions(f);
      addAction(f, "Επανάληψη εντολής", "warn", function () {
        retryFlow(f);
      });
      addAction(f, "Άκυρο", "ghost", function () {
        dismissFlow(f);
      });
    } else {
      // Second failure → communication issue.
      commFailure(f);
    }
  }

  function commFailure(f) {
    if (f.dot2) {
      f.dot2.className = "uc511fb-dot err";
      f.dot2.textContent = "!";
    }
    setAlert(
      f,
      "err",
      "<strong>Πρόβλημα επικοινωνίας με τον ελεγκτή.</strong> Η εντολή απέτυχε " +
        "δύο φορές. Μπορείτε να ανοίξετε/κλείσετε τη βάνα χειροκίνητα μέσω NFC με " +
        "την εφαρμογή Milesight ToolBox, ή να επικοινωνήσετε με την υποστήριξη."
    );
    clearActions(f);
    addAction(f, "Οδηγίες χειροκίνητου ελέγχου (NFC)", "", function () {
      openHelpModal();
    });
    addAction(f, "Κλήση υποστήριξης", "danger", function () {
      window.location.href = "tel:" + SUPPORT_PHONE_TEL;
    });
    addAction(f, "Νέα προσπάθεια", "ghost", function () {
      // allow a fresh attempt counter reset
      f.attempt = 0;
      retryFlow(f);
    });
    addAction(f, "Κλείσιμο", "ghost", function () {
      dismissFlow(f);
    });
  }

  function retryFlow(f) {
    var device = f.device;
    var valveIdx = f.valveIdx;
    var wantOpen = f.wantOpen;
    // Mark the next outgoing command for this valve as a continuation, so the
    // sendData hook starts the new flow with the correct attempt counter.
    // (We do NOT call startFlow directly here — sendValveCommand goes through
    //  the wrapped sendData, which already triggers onOutgoingCommand.)
    pendingAttempt[flowKey(device, valveIdx)] = f.attempt; // startFlow adds +1
    sendValveCommand(device, valveIdx, wantOpen, { timed: f.timed, minutes: f.minutes });
  }

  // ---- Re-send a command (used by retry) ------------------------------
  function sendValveCommand(device, valveIdx, wantOpen, opts) {
    var ye = window.TagoIO;
    if (!ye || typeof ye.sendData !== "function") return;
    // Match the widget's irrigation handler: keep autofill (default ON, so the widget analysis_run
    // fires) and stamp metadata.target_device so UC511_downlink downlinks to the right controller.
    try {
      var meta = { target_device: device };
      if (opts && opts.timed) {
        var tvar = valveIdx === 0 ? "valve_1_time_command" : "valve_2_time_command";
        ye.sendData({ device: device, variable: tvar, value: opts.minutes, metadata: meta });
      } else {
        var cvar = valveIdx === 0 ? "valve_1_command" : "valve_2_command";
        ye.sendData({ device: device, variable: cvar, value: wantOpen ? "on" : "off", metadata: meta });
      }
    } catch (e) {
      console.error("uc511fb retry send failed", e);
    }
  }

  // ---- NFC tap animation (stylized, self-contained SVG) ---------------
  function nfcAnimSVG() {
    return [
      '<svg viewBox="0 0 360 230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Κινούμενη οδηγία: ακουμπήστε το κινητό στην περιοχή NFC του ελεγκτή UC511 και η βάνα ανοίγει (πράσινο) ή κλείνει (κόκκινο)">',
      "<title>NFC tap to toggle valve</title>",
      '<rect x="0" y="190" width="360" height="2" fill="#e3e9f0"/>',
      // controller
      '<g transform="translate(78,62)">',
      '<rect x="-40" y="0" width="80" height="112" rx="11" fill="#2f3b4c"/>',
      '<rect x="-40" y="0" width="80" height="30" rx="11" fill="#3a4a60"/>',
      '<rect x="-26" y="40" width="52" height="34" rx="6" fill="#1f2937"/>',
      '<text x="0" y="64" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" font-weight="500" fill="#9fb4d6">UC511</text>',
      '<circle cx="0" cy="18" r="10" fill="none" stroke="#6ea0ff" stroke-width="2.5"/>',
      '<circle cx="0" cy="18" r="3.5" fill="#6ea0ff"/>',
      '<circle cx="0" cy="94" r="7"><animate attributeName="fill" values="#e74c3c;#e74c3c;#2ecc71;#2ecc71;#e74c3c" keyTimes="0;0.45;0.55;0.9;1" dur="4s" repeatCount="indefinite"/></circle>',
      "</g>",
      // nfc waves
      '<g transform="translate(108,80)" stroke="#2f6feb" fill="none" stroke-width="2.5" stroke-linecap="round">',
      '<path d="M0,-15 A19,19 0 0 1 0,15"><animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.32;0.45;0.62;0.66;1" dur="4s" repeatCount="indefinite"/></path>',
      '<path d="M9,-24 A30,30 0 0 1 9,24"><animate attributeName="opacity" values="0;0;0.7;0.7;0;0" keyTimes="0;0.36;0.48;0.62;0.66;1" dur="4s" repeatCount="indefinite"/></path>',
      '<path d="M18,-33 A41,41 0 0 1 18,33"><animate attributeName="opacity" values="0;0;0.45;0.45;0;0" keyTimes="0;0.40;0.50;0.62;0.66;1" dur="4s" repeatCount="indefinite"/></path>',
      "</g>",
      // phone
      "<g>",
      '<animateTransform attributeName="transform" type="translate" values="210 48; 134 48; 134 48; 210 48; 210 48" keyTimes="0;0.32;0.62;0.8;1" dur="4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0 0 1 1;0.4 0 0.2 1;0 0 0 1"/>',
      '<rect x="0" y="0" width="84" height="146" rx="15" fill="#1a2230"/>',
      '<rect x="6" y="7" width="72" height="132" rx="10" fill="#eaf1ff"/>',
      '<text x="42" y="32" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" font-weight="500" fill="#2f3b4c">ToolBox</text>',
      '<rect x="15" y="45" width="54" height="23" rx="11.5" fill="#cdddf7"/>',
      '<circle cx="26.5" cy="56.5" r="9.5"><animate attributeName="cx" values="26.5;26.5;57.5;57.5;26.5" keyTimes="0;0.45;0.55;0.9;1" dur="4s" repeatCount="indefinite"/><animate attributeName="fill" values="#e74c3c;#e74c3c;#2ecc71;#2ecc71;#e74c3c" keyTimes="0;0.45;0.55;0.9;1" dur="4s" repeatCount="indefinite"/></circle>',
      '<text x="42" y="90" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" font-weight="500" fill="#6c7a89">ΒΑΝΑ</text>',
      '<text x="42" y="106" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" font-weight="400" fill="#9aa7b5"><animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;0.45;0.55;0.9;1" dur="4s" repeatCount="indefinite"/>Κλειστή</text>',
      '<text x="42" y="106" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" font-weight="400" fill="#2ecc71"><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.45;0.55;0.9;1" dur="4s" repeatCount="indefinite"/>Ανοιχτή</text>',
      '<circle cx="7" cy="73" r="5" fill="none" stroke="#6ea0ff" stroke-width="1.5" opacity="0.8"/>',
      "</g>",
      "</svg>",
    ].join("");
  }

  // ---- Help modal (Milesight ToolBox + NFC) ---------------------------
  function openHelpModal() {
    injectStyles();
    var back = el("div", "uc511fb-help-back");
    back.onclick = function (e) {
      if (e.target === back) document.body.removeChild(back);
    };
    var box = el("div", "uc511fb-help");

    var head = el("div", "uc511fb-help-head");
    var icon = el("div", "uc511fb-dot wait", "i");
    var htxt = el("div");
    var h3 = el("h3", null, "Χειροκίνητος έλεγχος βάνας μέσω NFC");
    var hp = el(
      "p",
      "uc511fb-sub",
      "Με την εφαρμογή Milesight ToolBox μπορείτε να ανοίξετε/κλείσετε τη βάνα " +
        "τοπικά, ακουμπώντας το κινητό στον ελεγκτή UC511."
    );
    htxt.appendChild(h3);
    htxt.appendChild(hp);
    head.appendChild(icon);
    head.appendChild(htxt);
    box.appendChild(head);

    var h4a = el("h4", null, "1) Εγκατάσταση εφαρμογής");
    box.appendChild(h4a);
    var links = el("div", "uc511fb-help-links");
    var aAndroid = el("a", null, null);
    aAndroid.href = PLAY_URL;
    aAndroid.target = "_blank";
    aAndroid.rel = "noopener";
    aAndroid.appendChild(el("button", "uc511fb-btn", "Google Play (Android)"));
    var aIos = el("a", null, null);
    aIos.href = APPSTORE_URL;
    aIos.target = "_blank";
    aIos.rel = "noopener";
    aIos.appendChild(el("button", "uc511fb-btn ghost", "App Store (iPhone)"));
    links.appendChild(aAndroid);
    links.appendChild(aIos);
    box.appendChild(links);

    var h4b = el("h4", null, "2) Σύνδεση μέσω NFC");
    box.appendChild(h4b);
    var ol1 = el("ol");
    [
      "Ενεργοποιήστε το NFC στο κινητό και ανοίξτε την εφαρμογή Milesight ToolBox.",
      "Ακουμπήστε την περιοχή NFC του κινητού πάνω στον ελεγκτή UC511 για ανάγνωση των βασικών στοιχείων.",
      "Στην πρώτη σύνδεση ζητείται κωδικός — ο προεπιλεγμένος είναι 123456.",
      "Πατήστε «Read» για να διαβάσετε την τρέχουσα κατάσταση της συσκευής.",
    ].forEach(function (t) {
      ol1.appendChild(el("li", null, t));
    });
    box.appendChild(ol1);

    // Animated NFC tap illustration
    var anim = el("div", "uc511fb-anim");
    anim.innerHTML = nfcAnimSVG();
    var animCap = el(
      "div",
      "uc511fb-anim-cap",
      "Ακουμπήστε το κινητό στον ελεγκτή — η βάνα ανοίγει (πράσινο) ή κλείνει (κόκκινο)."
    );
    anim.appendChild(animCap);
    box.appendChild(anim);

    var h4c = el("h4", null, "3) Άνοιγμα / Κλείσιμο βάνας");
    box.appendChild(h4c);
    var ol2 = el("ol");
    [
      "Πηγαίνετε στη σελίδα «Device → Status» (Κατάσταση).",
      "Πατήστε το κουμπί της αντίστοιχης βάνας (Open για άνοιγμα ή Close για κλείσιμο).",
      "Ακουμπήστε ξανά το κινητό στον ελεγκτή ώστε να γραφτεί η εντολή και να αλλάξει η κατάσταση της βάνας.",
    ].forEach(function (t) {
      ol2.appendChild(el("li", null, t));
    });
    box.appendChild(ol2);

    var tip = el(
      "div",
      "tip",
      "Συμβουλή: τοποθετήστε σωστά την περιοχή NFC του κινητού και αφαιρέστε τη θήκη. " +
        "Αν η ανάγνωση/εγγραφή αποτύχει, απομακρύνετε το κινητό και ξαναδοκιμάστε."
    );
    box.appendChild(tip);

    var foot = el("div", "uc511fb-actions");
    var support = el("a", null, null);
    support.href = "tel:" + SUPPORT_PHONE_TEL;
    support.appendChild(
      el("button", "uc511fb-btn danger", "Κλήση υποστήριξης " + SUPPORT_PHONE)
    );
    var close = el("button", "uc511fb-btn ghost", "Κλείσιμο");
    close.onclick = function () {
      if (back.parentNode) document.body.removeChild(back);
    };
    foot.appendChild(support);
    foot.appendChild(close);
    box.appendChild(foot);

    back.appendChild(box);
    document.body.appendChild(back);
  }

  // ---- Record extraction from realtime payloads -----------------------
  // The widget's onRealtime receives an array of envelopes; each may carry a
  // .result array of records, or be a record itself. Records: {variable,
  // value, metadata, time, device|origin|bucket}.
  function flattenRecords(payload) {
    var out = [];
    if (!payload) return out;
    var arr = Array.isArray(payload) ? payload : [payload];
    for (var i = 0; i < arr.length; i++) {
      var e = arr[i];
      if (!e) continue;
      if (Array.isArray(e.result)) {
        for (var j = 0; j < e.result.length; j++) out.push(e.result[j]);
      } else if (e.variable) {
        out.push(e);
      } else if (Array.isArray(e)) {
        for (var k = 0; k < e.length; k++) if (e[k] && e[k].variable) out.push(e[k]);
      }
    }
    return out;
  }

  function recDevice(r) {
    return String(
      r.device || r.device_id || r.origin || r.bucket || (r.origin && r.origin.id) || ""
    );
  }

  // Best-effort timestamp (ms) for a realtime record. Returns null if none
  // can be parsed, in which case callers treat the record as "current".
  function recTimeMs(r) {
    var t = r && (r.time || r.timestamp || r.created_at);
    if (t == null) return null;
    if (typeof t === "number") {
      // seconds vs ms heuristic
      return t < 1e12 ? t * 1000 : t;
    }
    var ms = Date.parse(String(t));
    return isNaN(ms) ? null : ms;
  }

  // Is this record new enough to belong to the in-flight command? We accept
  // records at/after (sentAt - SKEW). Records older than that are stale
  // (pre-existing device state) and must NOT close the flow — that was the
  // cause of instant false "success". Records with no timestamp are accepted.
  var TS_SKEW_MS = CFG.freshnessToleranceMs != null ? CFG.freshnessToleranceMs : 4000; // clock-skew tolerance
  function recIsFresh(f, r) {
    var tms = recTimeMs(r);
    if (tms == null) return true; // no timestamp → don't block
    return tms >= f.sentAtMs - TS_SKEW_MS;
  }

  function handleRecords(records) {
    if (!records || !records.length) return;
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (!r || !r.variable) continue;
      var v = String(r.variable);
      var dev = recDevice(r);

      // valve_X_command_feedback  → downlink received echo
      var mFb = v.match(/^valve_([12])_command_feedback$/i);
      if (mFb) {
        var fbIdx = Number(mFb[1]) - 1;
        var f = matchFlow(dev, fbIdx);
        if (f && recIsFresh(f, r)) onEchoReceived(f);
        continue;
      }

      // valve_X  → actual valve status
      var mSt = v.match(/^valve_([12])$/i);
      if (mSt) {
        var stIdx = Number(mSt[1]) - 1;
        var f2 = matchFlow(dev, stIdx);
        if (f2 && recIsFresh(f2, r)) {
          var val = String(r.value).toLowerCase();
          onStatusReceived(f2, val === "on" || val === "1" || val === "true");
        }
        continue;
      }
    }
  }

  // Find an active flow for (device, valveIdx). If the device id on the record
  // doesn't match (aggregator/echo quirks), fall back to a unique active flow
  // on that valve index.
  function matchFlow(device, valveIdx) {
    var key = flowKey(device, valveIdx);
    if (flows[key]) return flows[key];
    if (!device) {
      // pick the (single) active flow on this valve index, if unambiguous
      var hits = [];
      for (var k in flows) {
        if (flows[k].valveIdx === valveIdx) hits.push(flows[k]);
      }
      if (hits.length === 1) return hits[0];
    } else {
      // device given but no exact key — still try a unique valve-index match
      var hits2 = [];
      for (var k2 in flows) {
        if (flows[k2].valveIdx === valveIdx) hits2.push(flows[k2]);
      }
      if (hits2.length === 1) return hits2[0];
    }
    return null;
  }

  // ---- Hook installation ---------------------------------------------
  // We wrap sendData (to detect outgoing commands) and onRealtime/onStart
  // (to observe incoming feedback). The widget sets its own onRealtime via
  // window.TagoIO.onRealtime(cb); the host stores cb and invokes it. We wrap
  // the registration so both the widget's cb AND our observer run.

  function looksLikeValveCommand(payload) {
    var items = Array.isArray(payload) ? payload : [payload];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it && typeof it.variable === "string" && /^valve_[12]_(time_)?command$/i.test(it.variable)) {
        return it;
      }
    }
    return null;
  }

  function onOutgoingCommand(item) {
    var dev = String(item.device || "");
    var m = String(item.variable).match(/^valve_([12])_(time_)?command$/i);
    if (!m) return;
    var valveIdx = Number(m[1]) - 1;
    var isTimed = !!m[2];
    var key = flowKey(dev, valveIdx);
    // If this command is a retry continuation, carry the attempt count forward.
    var carried = pendingAttempt[key];
    if (carried != null) delete pendingAttempt[key];
    var opts = { attempt: carried != null ? carried : 0 };
    if (isTimed) {
      opts.timed = true;
      opts.minutes = Number(item.value) || 0;
      setTimeout(function () {
        startFlow(dev, valveIdx, true, opts);
      }, 0);
    } else {
      var wantOpen = String(item.value).toLowerCase() === "on";
      setTimeout(function () {
        startFlow(dev, valveIdx, wantOpen, opts);
      }, 0);
    }
  }

  function installHooks() {
    var T = window.TagoIO;
    if (!T) return false;

    // ---- wrap sendData ----
    if (typeof T.sendData === "function" && !T.sendData.__uc511wrapped) {
      var origSend = T.sendData.bind(T);
      var wrappedSend = function (payload, cb) {
        try {
          var cmd = looksLikeValveCommand(payload);
          if (cmd) onOutgoingCommand(cmd);
        } catch (e) {
          console.warn("uc511fb send hook error", e);
        }
        return origSend(payload, cb);
      };
      wrappedSend.__uc511wrapped = true;
      try {
        T.sendData = wrappedSend;
      } catch (e) {
        /* property may be non-writable in some hosts */
      }
    }

    // ---- wrap onRealtime registration ----
    if (typeof T.onRealtime === "function" && !T.onRealtime.__uc511wrapped) {
      var origOnRealtime = T.onRealtime.bind(T);
      var wrappedOnRealtime = function (cb) {
        var wrappedCb = function (data) {
          try {
            handleRecords(flattenRecords(data));
          } catch (e) {
            console.warn("uc511fb realtime hook error", e);
          }
          return cb ? cb(data) : undefined;
        };
        return origOnRealtime(wrappedCb);
      };
      wrappedOnRealtime.__uc511wrapped = true;
      try {
        T.onRealtime = wrappedOnRealtime;
      } catch (e) {}
    }

    // ---- wrap onStart registration (initial snapshot may already carry status) ----
    if (typeof T.onStart === "function" && !T.onStart.__uc511wrapped) {
      var origOnStart = T.onStart.bind(T);
      var wrappedOnStart = function (cb) {
        var wrappedCb = function (data) {
          // onStart payload often has data under .data; observe but don't
          // trigger flows from historical snapshot (no active flow yet anyway).
          return cb ? cb(data) : undefined;
        };
        return origOnStart(wrappedCb);
      };
      wrappedOnStart.__uc511wrapped = true;
      try {
        T.onStart = wrappedOnStart;
      } catch (e) {}
    }

    return T.sendData && T.sendData.__uc511wrapped;
  }

  // ---- Boot: wait for window.TagoIO, install before widget registers --
  // The bundle defines window.TagoIO.* synchronously on load. Our script
  // runs after it, so hooks installed here are in place before the widget
  // calls onRealtime()/ready(). If TagoIO isn't ready yet, poll briefly.
  function boot() {
    if (installHooks()) return;
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (installHooks() || tries > 100) clearInterval(iv);
    }, 50);
  }

  // Run as soon as possible. Our <script> is placed after the module bundle,
  // but module scripts are deferred, so TagoIO may appear slightly later — the
  // poll inside boot() covers that. We also (re)run on DOMContentLoaded in case
  // this classic script somehow executed before the DOM was ready.
  boot();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  }

  // Expose a tiny manual hook for debugging / support.
  window.__uc511FB = {
    openHelp: openHelpModal,
    flows: flows,
    startFlow: startFlow,
  };
})();