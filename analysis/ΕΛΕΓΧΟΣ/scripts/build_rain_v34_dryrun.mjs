// Συναρμολογεί το probe ΞΗΡΗΣ ΕΚΤΕΛΕΣΗΣ της ανάλυσης βροχής v34 (T-RAIN-UNIFIED-01): ο ΑΥΤΟΥΣΙΟΣ κώδικας της
// v34 τρέχει σε όλους τους σταθμούς S2120 με ζωντανά δεδομένα (ανάγνωση μέσω REST με την πολιτική ανάγνωσης),
// αλλά το sendData ΔΕΝ γράφει: τυπώνει τι θα έγραφε. Το probe (node-rt2025) δεν έχει πακέτα, οπότε ενσωματώνεται
// το moment + moment-timezone (δεδομένα 1970–2030) από analysis/node_modules.
// Χρήση: node build_rain_v34_dryrun.mjs  →  rain_v34_dryrun.generated.js
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const A = path.join(here, "..", "..");
const moment = fs.readFileSync(path.join(A, "node_modules", "moment", "min", "moment.min.js"), "utf8");
const mtz = fs.readFileSync(path.join(A, "node_modules", "moment-timezone", "builds", "moment-timezone-with-data-1970-2030.min.js"), "utf8");
const v34 = fs.readFileSync(path.join(A, "calculate_old_rainHeightSums.js"), "utf8").replace(/\r\n/g, "\n");
const out = `// SAG — PROBE ΞΗΡΗΣ ΕΚΤΕΛΕΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · ανάλυση βροχής v34 με ζωντανά δεδομένα· ΚΑΜΙΑ εγγραφή.
// Παράχθηκε από build_rain_v34_dryrun.mjs — μην το διορθώνεις με το χέρι.
const __moment = (function () { const module = { exports: {} }, exports = module.exports;
${moment}
; return module.exports; })();
const __mtz = (function () { const module = { exports: {} }, exports = module.exports; const require = () => __moment;
${mtz}
; return module.exports; })();
const __V34 = (function () { const module = { exports: {} }, exports = module.exports;
  const require = (n) => n === "moment-timezone" ? __mtz : { Analysis: { use() {} }, Resources: {}, Account: class {}, Device: class {} };
${v34}
; return module.exports; })();
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
async function get(p) {
  const r = await fetch(API + p, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120));
  return j.result;
}
function restDevice(id, writes) {
  return {
    async getData(q) {
      const v = (q.variables && q.variables[0]) || q.variable;
      const P = ["variable=" + encodeURIComponent(v)];
      for (const k of ["start_date", "end_date", "qty", "ordination", "query"]) if (q[k] != null) P.push(k + "=" + encodeURIComponent(q[k]));
      return get("/device/" + id + "/data?" + P.join("&"));
    },
    async sendData(arr) { for (const x of [].concat(arr)) writes.push(x); },   // ΞΗΡΗ: δεν γράφει
  };
}
const fmt = (x) => x.variable.replace("rain_height", "rh") + "=" + x.value + (x.metadata.partial ? "≥" : "") + (x.metadata.status === "estimate" ? "≈" : "")
  + (x.metadata.since ? "/από" + x.metadata.since : "") + (x.metadata.mode === "closed_period" ? "[" + x.metadata.period_key + "]" : "");
(async () => {
  console.log("ΞΞΞ=== ΞΗΡΗ ΕΚΤΕΛΕΣΗ " + __V34.RAIN_VERSION + " · " + new Date().toISOString() + " ===");
  const devs = await get("/device?filter[tags][0][key]=type&filter[tags][0][value]=s2120&amount=200&fields=id,name");
  const cfg = () => ({ TZ: "Europe/Athens", cutMs: Date.parse("2026-10-04T21:00:00.000Z") });
  const t0 = Date.now();
  for (let i = 0; i < devs.length; i += 6) {
    await Promise.all(devs.slice(i, i + 6).map(async (d) => {
      const writes = [];
      try {
        await __V34.computeForDevice(restDevice(d.id, writes), d.name || d.id, cfg());
        const closed = writes.filter(x => x.metadata.mode === "closed_period"), ptd = writes.filter(x => x.metadata.mode !== "closed_period");
        console.log("ΞΞΞD|" + (d.name || d.id) + "|κλειστές " + closed.length + ": " + closed.slice(0, 6).map(fmt).join(" ") + (closed.length > 6 ? " …" : "") + "|τρέχοντα: " + ptd.map(fmt).join(" "));
      } catch (x) { console.log("ΞΞΞERR|" + (d.name || d.id) + "|" + (x && x.message)); }
    }));
  }
  console.log("ΞΞΞ=== ΤΕΛΟΣ · σταθμοί " + devs.length + " · " + Math.round((Date.now() - t0) / 1000) + " s ===");
})();
`;
fs.writeFileSync(path.join(here, "rain_v34_dryrun.generated.js"), out);
console.log("γράφτηκε", out.length, "bytes");
