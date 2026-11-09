/* T-TPREAD-01 (9/11/2026) — ΕΛΕΓΧΟΣ: η δοκιμή ThingPark στο gatewayLiveness (α) τρέχει μόνο με scope {tp_probe:true},
   (β) δεν καλεί ΚΑΘΟΛΟΥ το API του TagoIO (τίποτα δεν διαβάζεται ούτε γράφεται εκεί), (γ) δεν τυπώνει ποτέ το secret,
   (δ) χωρίς scope η ωριαία δουλειά ξεκινά όπως πριν. Τρέχει το πραγματικό αρχείο σε node:vm με ψεύτικο fetch. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const SRC0 = readFileSync(fileURLToPath(new URL("../gatewayLiveness.js", import.meta.url)), "utf8").replace(/\r\n/g, "\n");
const SECRET = "s3cr3t-ΔΟΚΙΜΗ-9f8e";
async function runOnce(src, scope) {
  const logs = [], calls = [];
  const fakeFetch = async (url, opts = {}) => {
    calls.push(String(url));
    const json = (o, st = 200) => ({ ok: st < 400, status: st, json: async () => o, text: async () => JSON.stringify(o) });
    if (String(url).includes("/openid-connect/token")) {
      const b = String(opts.body || "");
      return b.includes("client_secret=" + encodeURIComponent(SECRET)) ? json({ access_token: "AT", expires_in: 300 }) : json({ error: "invalid_client" }, 401);
    }
    if (String(url).includes("/partners/mine/bss/alarms")) return json({ briefs: [{ ID: 1, state: 4, bs: { lrrID: "1001848B" }, updateTimestamp: 1794200000000 }], more: false });
    if (String(url).includes("/partners/mine/bss")) return json({ briefs: [{ lrrID: "1001848B", name: "gw", cnxState: "CNX", healthState: "ACTIVE", alarmCount: 1, alarmLevel: 4, upFrame: { last: { date: Date.now() - 3600e3 } } }], more: false, now: Date.now() });
    if (String(url).includes("/subscriptions/mine/devices")) return json({ briefs: [{ EUI: "A", name: "x" }], count: 1, more: false });
    return json({ status: false, message: "stop" });   // TagoIO: σταματά την ωριαία δουλειά νωρίς
  };
  const env = { T_ANALYSIS_TOKEN: "T", T_ANALYSIS_DATA: JSON.stringify(scope), T_ANALYSIS_ENV: JSON.stringify([{ key: "THINGPARK_CLIENT_ID", value: "sub-1/x" }, { key: "THINGPARK_CLIENT_SECRET", value: SECRET }]) };
  const sb = { console: { log: (...a) => logs.push(a.join(" ")) }, process: { env }, fetch: fakeFetch, URLSearchParams, setTimeout, Date, JSON, Math, Promise, Buffer, FormData: class {}, Blob: class {} };
  vm.createContext(sb);
  vm.runInContext(src, sb);
  for (let i = 0; i < 50; i++) await new Promise((r) => setTimeout(r, 2));
  return { logs, calls };
}
async function check(src) {
  const bad = []; const ok = (c, m) => { if (!c) bad.push(m); };
  try {
    const a = await runOnce(src, [{ tp_probe: true }]);
    ok(a.calls.some((u) => u.includes("openid-connect/token")) && a.logs.some((l) => l.includes("σύνδεση ΟΚ")), "Α1 σύνδεση με τα διαπιστευτήρια του περιβάλλοντος");
    ok(a.logs.some((l) => l.includes("TP|BS|1001848B|gw|CNX|ACTIVE")), "Α2 γραμμή πύλης");
    ok(a.logs.some((l) => l.includes("TP|AL|1001848B")), "Α3 συναγερμός πύλης");
    ok(!a.calls.some((u) => u.includes("tago.io")), "Β1 καμία κλήση στο TagoIO στη δοκιμή (" + a.calls.filter((u) => u.includes("tago.io")).length + ")");
    ok(!a.logs.join("\n").includes(SECRET) && !a.logs.join("\n").includes("AT\""), "Γ1 το secret δεν τυπώνεται");
    ok(a.logs.some((l) => l.includes("τίποτα δεν γράφτηκε")), "Α4 δηλώνει ότι δεν έγραψε");
    const b = await runOnce(src, []);
    ok(b.calls.some((u) => u.includes("tago.io")) && !b.calls.some((u) => u.includes("actility")), "Δ1 χωρίς scope: ωριαία δουλειά, καμία κλήση στο ThingPark");
  } catch (e) { bad.push("εξαίρεση " + e.message); }
  return bad;
}
const r = await check(SRC0); for (const b of r) console.log("ΑΠΟΤΥΧΙΑ", b);
console.log(r.length ? "ΑΠΟΤΥΧΙΑ" : "ΟΚ δοκιμή ThingPark");
const MUT = [
  ["    return;\n  }\n", "  }\n"],
  ["if (readScope().tp_probe) {", "if (true) {"],
  ["client_secret: env.THINGPARK_CLIENT_SECRET", "client_secret: \"\""],
  ['console.log(P + "μεταβλητές: " + TP_KEYS.map((k) => k + "=" + (env[k] ? "υπάρχει" : "ΛΕΙΠΕΙ")).join(" · "));', 'console.log(P + "μεταβλητές: " + TP_KEYS.map((k) => k + "=" + env[k]).join(" · "));'],
];
let k = 0; for (const [a, b] of MUT) { if (!SRC0.includes(a)) { console.log("ΑΚΥΡΗ", a); process.exitCode = 1; continue; } const x = await check(SRC0.replace(a, b)); if (x.length) k++; else { console.log("ΕΠΕΖΗΣΕ", a); process.exitCode = 1; } }
console.log(`μεταλλάξεις ${k}/${MUT.length}`); if (r.length) process.exitCode = 1;
