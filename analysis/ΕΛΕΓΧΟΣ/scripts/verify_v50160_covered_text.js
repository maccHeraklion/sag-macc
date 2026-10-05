// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · επαλήθευση v50.160 (T-COVERED-TXT-02): έκδοση + φρεσκάδα σε ΚΑΘΕ αγρό·
// σε αγρούς θερμοκηπίου ΚΑΝΕΝΑ κείμενο «βροχή … μειώνει» / «Βροχή X mm … εκτός ζώνης»· στο ύπαιθρο οι κάρτες προστασίας
// ΚΡΑΤΟΥΝ τη φράση. Απαιτεί την πολιτική ανάγνωσης 6ac171e0 ΕΝΕΡΓΗ μόνο όσο τρέχει.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120));
  return j.result;
}
const unpack = (e) => JSON.parse(zlib.inflateRawSync(Buffer.from(String(e.metadata.data), "base64")).toString("utf8"));
(async () => {
  console.log("ΥΥ6=== ΕΠΑΛΗΘΕΥΣΗ v50.160 · " + new Date().toISOString() + " ===");
  const devs = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  const ver = {}; let fresh = 0, none = 0, old = 0, covN = 0, covBad = 0, outProt = 0, outProtRain = 0;
  for (const d of devs) {
    let cov = false;
    try { const t = (d.tags || []).find(x => x.key === "configuration"); cov = !!(t && String(JSON.parse(t.value).covered_cultivation) === "true"); } catch (_e) {}
    const ct = (d.tags || []).find(x => x.key === "covered_cultivation"); if (ct) cov = ["true", "ναι", "θερμοκήπιο", "1"].includes(String(ct.value).toLowerCase());
    try {
      const b = await get(`/device/${d.id}/data?variables=field_bundle&qty=1`);
      const e = Array.isArray(b) && b[0]; if (!e) { none++; continue; }
      if (Date.now() - Date.parse(e.time) > 75 * 60e3) { old++; continue; }
      fresh++;
      const o = unpack(e); const v = String(((o.shared || {}).kernel_version || {}).value || "—"); ver[v] = (ver[v] || 0) + 1;
      const all = JSON.stringify(o);
      if (cov) {
        covN++;
        const bad = /βροχή τη μειώνει|Η βροχή μειώνει|στο 24ωρο, ρηχή υγρασία αμετάβλητη/.test(all);
        if (bad) covBad++;
        const prot = (o.crops || []).flatMap(c => Object.entries(c.indicators || {}).filter(([k]) => /^spray_protection_end_/.test(k)).map(([k, x]) => k + "=" + (x && x.metadata && x.metadata.text)));
        console.log("ΥΥ6C|" + (d.name || d.id) + "|" + e.time.slice(11, 16) + "|ver=" + v + "|βροχή-κείμενο=" + (bad ? "ΝΑΙ ✗" : "όχι ✔") + "|προστασίες=" + (prot.length ? prot.join(" ; ").slice(0, 200) : "καμία"));
      } else {
        for (const c of (o.crops || [])) for (const [k, x] of Object.entries(c.indicators || {})) {
          if (!/^spray_protection_end_/.test(k)) continue;
          outProt++; if (/Η βροχή τη μειώνει\.$/.test(String(x && x.metadata && x.metadata.text))) outProtRain++;
        }
      }
    } catch (x) { console.log("ΥΥ6ERR|" + d.id + "|" + x.message); }
  }
  console.log("ΥΥ6SUM|αγροί=" + devs.length + "|φρέσκα=" + fresh + "|παλιά=" + old + "|χωρίς=" + none + "|εκδόσεις=" + JSON.stringify(ver)
    + "|θερμοκήπια=" + covN + " με κείμενο βροχής=" + covBad + "|ύπαιθρο: κάρτες προστασίας=" + outProt + " με «Η βροχή τη μειώνει.»=" + outProtRain);
  console.log("ΥΥ6=== ΤΕΛΟΣ ===");
})();
