# T-TPREAD-01 (9/11/2026, Michalis): ανάγνωση ThingPark στο gatewayLiveness — στάδιο 1, μόνο δοκιμή με scope {tp_probe:true}.
import sys, subprocess
P = sys.argv[1]
s = open(P, 'rb').read().decode('utf-8')
assert '\r\n' not in s
def sub(old, new, cnt=1):
    global s
    n = s.count(old); assert n == cnt, (n, old[:80]); s = s.replace(old, new)

BLOCK = r'''// ── T-TPREAD-01 (9/11/2026) · ΑΝΑΓΝΩΣΗ THINGPARK, ΣΤΑΔΙΟ 1: ΜΟΝΟ ΔΟΚΙΜΗ ─────────────────────────────────────────────────────────
// Service account μόνο ανάγνωσης (viewer) του τομέα MACC/Crete. Τρέχει ΜΟΝΟ με scope {tp_probe:true}: συνδέεται, διαβάζει πύλες,
// συναγερμούς πυλών και μία σελίδα συσκευών, τυπώνει σύνοψη και ΤΕΛΕΙΩΝΕΙ — δεν γράφει τίποτα και δεν τρέχει την ωριαία δουλειά.
// Η ωριαία εκτέλεση (χωρίς scope) είναι ίδια με πριν. Διαπιστευτήρια: μεταβλητές περιβάλλοντος THINGPARK_CLIENT_ID και
// THINGPARK_CLIENT_SECRET του analysis· δεν τυπώνονται ποτέ. API: OpenAPI «ThingPark things management» 8.1 (Networks/Devices).
const TP_HOST = "https://thingparkenterprise.eu.actility.com";
const TP_REST = TP_HOST + "/thingpark/wireless/rest";
const TP_KEYS = ["THINGPARK_CLIENT_ID", "THINGPARK_CLIENT_SECRET"];
function readScope() {
  try { const s = JSON.parse(process.env.T_ANALYSIS_DATA || "null"); return (Array.isArray(s) ? s[0] : s) || {}; } catch (e) { return {}; }
}
function readEnvMap() {
  const out = {};
  try {
    const e = JSON.parse(process.env.T_ANALYSIS_ENV || "null");
    if (Array.isArray(e)) { for (const x of e) if (x && x.key) out[String(x.key).trim()] = String(x.value == null ? "" : x.value).trim(); }
    else if (e && typeof e === "object") for (const k of Object.keys(e)) out[k.trim()] = String(e[k] == null ? "" : e[k]).trim();
  } catch (err) { /* κενό */ }
  return out;
}
async function tpToken(env) {
  const miss = TP_KEYS.filter((k) => !env[k]);
  if (miss.length) throw new Error("λείπουν μεταβλητές περιβάλλοντος: " + miss.join(", "));
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: env.THINGPARK_CLIENT_ID, client_secret: env.THINGPARK_CLIENT_SECRET });
  const r = await fetch(TP_HOST + "/users-auth/protocol/openid-connect/token",
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error("σύνδεση απέτυχε: HTTP " + r.status + " " + String(j.error || "") + " " + String(j.error_description || "").slice(0, 120));
  return { token: j.access_token, expiresIn: j.expires_in };
}
async function tpGet(tok, path) {
  const r = await fetch(TP_REST + path, { headers: { Authorization: "Bearer " + tok, Accept: "application/json" } });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { /* όχι JSON */ }
  if (!r.ok) throw new Error(path.split("?")[0] + " -> HTTP " + r.status + " " + t.slice(0, 160));
  return j;
}
async function tpProbe() {
  const P = "TP|";
  const env = readEnvMap();
  console.log(P + "μεταβλητές: " + TP_KEYS.map((k) => k + "=" + (env[k] ? "υπάρχει" : "ΛΕΙΠΕΙ")).join(" · "));
  const { token, expiresIn } = await tpToken(env);
  console.log(P + "σύνδεση ΟΚ · διάρκεια token " + expiresIn + " s");
  const now = Date.now(); const bs = [];
  for (let page = 1; page <= 5; page++) {
    const j = await tpGet(token, `/partners/mine/bss?pageSize=100&pageIndex=${page}&sort=lrrID,asc`);
    const b = (j && j.briefs) || []; bs.push(...b);
    if (!j || !j.more || !b.length) break;
  }
  const cnt = {}, hl = {};
  for (const b of bs) { cnt[b.cnxState] = (cnt[b.cnxState] || 0) + 1; hl[b.healthState] = (hl[b.healthState] || 0) + 1; }
  console.log(P + "πύλες " + bs.length + " · σύνδεση " + JSON.stringify(cnt) + " · υγεία " + JSON.stringify(hl));
  for (const b of bs) {
    const up = b.upFrame && b.upFrame.last && b.upFrame.last.date;
    console.log(P + "BS|" + b.lrrID + "|" + String(b.name || "").slice(0, 40) + "|" + b.cnxState + "|" + b.healthState
      + "|συναγερμοί " + b.alarmCount + " επ. " + b.alarmLevel
      + "|τελ. uplink " + (up ? ((now - up) / 3600e3).toFixed(1) + " ω" : "—")
      + "|κατάσταση από " + (b.cnxStateSince ? new Date(b.cnxStateSince).toISOString().slice(0, 16) : "—"));
  }
  try {
    const a = await tpGet(token, `/partners/mine/bss/alarms?pageSize=50&pageIndex=1&state=3`);
    const al = (a && a.briefs) || [];
    console.log(P + "συναγερμοί πυλών ≥ WARNING: " + al.length + (a && a.more ? "+" : ""));
    for (const x of al.slice(0, 40)) console.log(P + "AL|" + ((x.bs && x.bs.lrrID) || "?") + "|ID " + x.ID + "|κατάσταση " + x.state
      + "|" + new Date(x.updateTimestamp || x.creationTimestamp || 0).toISOString().slice(0, 16));
  } catch (e) { console.log(P + "συναγερμοί: " + e.message); }
  try {
    const d = await tpGet(token, `/subscriptions/mine/devices?pageSize=2&pageIndex=1`);
    const br = (d && d.briefs) || [];
    console.log(P + "συσκευές: " + (d && d.count != null ? "σύνολο " + d.count : "χωρίς σύνολο") + " · κλειδιά " + Object.keys(d || {}).join(",")
      + " · πεδία " + Object.keys(br[0] || {}).slice(0, 40).join(","));
  } catch (e) { console.log(P + "συσκευές: " + e.message); }
}

(async () => {
  const t0 = Date.now();
  if (readScope().tp_probe) {
    try { await tpProbe(); } catch (e) { console.log("TP|ΣΦΑΛΜΑ|" + ((e && e.message) || e)); }
    console.log("══ gatewayLiveness · ΔΟΚΙΜΗ THINGPARK · ΤΕΛΟΣ (τίποτα δεν γράφτηκε) ══");
    return;
  }
'''
sub("(async () => {\n  const t0 = Date.now();\n", BLOCK)
open(P, 'wb').write(s.encode('utf-8'))
r = subprocess.run(['node', '--check', P], capture_output=True, text=True)
print('node --check', r.returncode, r.stderr[:300])
