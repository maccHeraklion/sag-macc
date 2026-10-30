// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · Έλεγχος αντιστοίχισης DevEUI ThingPark ↔ TagoIO, 30/10/2026.
// Για κάθε συσκευή στο δίκτυο «LoRaWAN Actility»: όνομα, ετικέτα eui, και τι DevEUI φέρνουν τα ΙΔΙΑ τα τελευταία uplinks
// (όπου υπάρχει στα δεδομένα/metadata). Το ThingPark δρομολογεί με DevEUI → σειριακό συσκευής στο TagoIO, όχι με όνομα.
// Πολιτική: 6aa2e0cf (Device Access + Get data, πάντα ενεργή). Δεν γράφει τίποτα.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
const NET = "5ede22a7427104001c248b08";
// Η λίστα /device ΔΕΝ επιστρέφει το πεδίο network στο probe (βγήκε actility=0) → τα 243 id από search_devices 30/10.
const ACT_IDS = new Set(["679791f32322d300093c307a", "67a765ca35b1a7000a49f64d", "679791f44c1a960009574564", "682abc00557b1e000a8535b1", "684c4f2c372edb000a5a8ede", "684c2c4ddf4dd2000a10106a", "684c293acd7675000a93c981", "69f1c5fa885fc300093422d6", "697787b942302d000ba9eb0d", "6a7c6f08c670de000bf9f6e6", "69f85a0fb313c5000901d994", "69f1c707f99316000a057808", "69f85c94b313c5000902114c", "69f85cf1bb10720009d72040", "69f85c07f79d76000a2baf05", "69f85c3de8f6de000fc3bb7a", "68186154ed779e000aa93d14", "681861540a7b23000a5283f1", "68186154c227a7000ad5ae99", "681861542efa76000b9a73d0", "681861548ee17b000abf980c", "683efef2651b78000a111ec4", "681861546c0953000a16a174", "681861541d3cfa000a4ee07a", "6818615438b932000a309624", "68186154e8d40e000a68f322", "67fe99036ae7fc000a89e0ff", "67fe9ae85fccdd000a4bdd42", "6a7c6ef1c670de000bf9f1c5", "6977921b312a11000a3b81c8", "69778fb405f6ae0009e6e686", "6977925d093f0f000bb6a436", "67ada90670d187000a621236", "67ada906caec1900096b1306", "67ada906394a4d000a52b415", "67ada906394a4d000a52b416", "67ada906f52f96000ac71114", "67ada90670d187000a621235", "67ada90636089a000a15e72e", "67ada906a04298000a0a1a4d", "67ada90636089a000a15e72d", "67ada906576be9000ab1e281", "680e7a2c5ff14c000a9fd72e", "680e89d840a654000ac657e9", "69b282167686c70009115dab", "67f4263236b2df000a052c5d", "67f3ec04a4ccc0000a1349bd", "67f4267aa8b5e6000a653fe2", "680e86bd09d547000a435260", "68184d91c227a7000ad35e50", "67fdfa1ec587b600093e94f8", "680e86e0a44e13000a7195f2", "697792b983514a000bc7a222", "6977929f83514a000bc77ac4", "69779061a6e2fb001147d7be", "697790f8de8115000a7f136d", "697786b4ad8ef1000ae1f555", "697792cc312a11000a3bc8c0", "68d668ba47d533000a48f00e", "68d6691e15f048000abad6e8", "685d20154a6e63000a65652e", "69135c184ab63d0009e74840", "6913605f2dc6ad0011d03abc", "67a766e6a56e20000ae2821a", "67a76653faa836000ac4e5a3", "6853ff9cff3054000acaaeae", "6853ff9d13af9d000a28bf26", "6797625d7188ba0009c5bfae", "67fe98a1697935000afafb14", "69f3266755f21a000edc7f4f", "69f85d886b36a6000ab90fa4", "69f329a24d843200108202f7", "6a2bb0d7b99739000d135b44", "69f85e0aef3625000f9a9587", "69f85d46c99ea9000a10a6f1", "6a2bb0f4b99739000d136139", "6a2bb0b8ad3db0000c568348", "6891d4806af6cd000aed7bcf", "6891d4907caabe000a49bc52", "6891d4a12e379b000a0cdf6f", "688b7dcb11758d000906fa22", "6891d4c17caabe000a49c086", "6891d4d15e263c000a682e75", "6891d4e3f6143d000a55eeac", "688cd0e4fbe87e000a219941", "69779797803f37000a21342e", "6a7c73108b06e3000cb27004", "6a7c720c23232f000cf5583b", "6a7c72b046a750000ce1866e", "6a7446498acfb8000ccca926", "6a7c71cd0ad4a1000b4e78d5", "6891d5133884e5000a211541", "6a7c6f8a3e1623000c001193", "6a7c6f730ad4a1000b4dee19", "6a7c700f0ad4a1000b4e119f", "69f85af12daa23000e6816bb", "69f1ba3c36f05f000a12850a", "69f85b4fbb10720009d6f99e", "69f1c044d4b929000ac9114d", "69f1c105d4b929000ac9217d", "69f1c0c03766b6000ba2bdff", "681859264f9c59000a881ace", "68185926ed779e000aa85bae", "6818592638b932000a2fb11b", "681859265e2146000a8f48cd", "681859261d3cfa000a4df347", "681859262ad137000aaf1ea6", "681859261d3cfa000a4df348", "68185926c227a7000ad4be75", "68185926f1b648000adbfe45", "6818592638b932000a2fb11a", "6958f971d6708b000a059d8d", "695a36e297536d000a0b02fe", "695a3b9af44516000941124d", "695a415edbdd35000a1c05b0", "69516bb21735ca000a56bf38", "695a4cca516a0f00097ae455", "6958e6623f13ef000afc329f", "6958f385b7666e000a3fe05f", "695a6bfa83fd67000be2b346", "6797625d62b2a00009f63540", "6797625e7188ba0009c5bfc5", "684c0e90df4dd2000a09fb43", "684c0ed2df4dd2000a0a08f7", "68dfb225f78a1d000a313160", "6797625fb17e75000995b414", "684c0ec3372edb000a4cc50d", "6a313498b99739000d495239", "69f1c7b866cc6a00090edc9e", "6a313639b99739000d49b1bd", "6a313509d5cee5000cff7ca9", "6a7c6de0c670de000bf9b382", "6a313437b99739000d493ecf", "6a7c6e1346a750000ce061f1", "69779a27a6e2fb0011490969", "6a2bd1b3d3f020000c10f7a5", "6a7c6df146a750000ce059ee", "6a3133dab99739000d4928b6", "6a313589b99739000d498bda", "6a31353dd5cee5000cff8779", "6a7c6dce23232f000cf448b6", "6a7c6dba23232f000cf44427", "6a313388ad3db0000c749163", "67976260b17e75000995b41d", "6797626165ba050009c44427", "679762619a6427000982b0a4", "69779476093f0f000bb76446", "6977952a05f6ae0009e7e211", "684c444dcc1cd8000a0f2b21", "69779536f01b55000af5de68", "6a7c6d4a0ad4a1000b4d6e58", "67fe9a453b56fa000ac762da", "67bd98d739006c000ada33ef", "684c4457508354000ae398a3", "67a764f9f1c195000aa6fe4a", "6977938e05f6ae0009e7b783", "67bd988839006c000ada2be7", "6977953ead8ef1000ae48c52", "69779455093f0f000bb760b0", "69779601de8115000a800375", "6977935da63d390010b24ec1", "69779522093f0f000bb77596", "6a54867531e9b9000c153084", "6853ff9e13af9d000a28bf41", "69779884c8a765000a6dc90d", "6a7c6d0b0ad4a1000b4d60a6", "6977946b42302d000bad37b5", "684c3fbaf71517000a449750", "6977945f42302d000bad3655", "68186205ed779e000aa95199", "679762629c86c10009471297", "681862050a7b23000a529775", "6977947d83514a000bc8092f", "68186205e8d40e000a690642", "681862052ad137000ab02c0f", "6818620516339f00099d76a5", "67fe993feff26b000a8143a9", "681862058ee17b000abfac56", "681862052ad137000ab02c0e", "681862052ad137000ab02c10", "681862050dd9c5000a6ecd03", "68186205ed2478000aa01dac", "6977871d83514a000bc64c66", "6977944b093f0f000bb75f90", "684c42522cbc3d000a4faae9", "684c3e89ff3054000a21903a", "697797d683514a000bc86281", "67976263a5cc530008cb2589", "69779384ad8ef1000ae45fb2", "684c27630de23f000a594f7e", "684c3de5675005000abcae24", "6a749040f99707000cb101f2", "6a7c6cb48b06e3000cb0b944", "684c376d508354000ae0bdf2", "69779443a63d390010b264e9", "69779379803f37000a20c645", "67976264de3d260009528af0", "680e7c9a0feb8c000a70a6c8", "681315a0ed3243000a85e3c2", "6a313a9bb99739000d4aafa9", "6a2bb332bf4706000c79e7fc", "69aed3c9962d2c00097b621f", "6971054abb3d630010741e09", "679762659c7a230009672585", "67fe9a063b56fa000ac75c4b", "6a313c16c4325f000c1e0072", "6a313eebd5cee5000c01c612", "67976266de3d260009528afe", "681c8f237a6e41000a900c8d", "6797626662b2a00009f635e6", "6a313e76bf4706000cb0ef12", "679762679a6427000982b13d", "67fd6001d2bacd000aed390e", "67a0fb407a6e1b0009348600", "681c8f5c8ee17b000a45de39", "680e7c7822d66f000b008ff6", "6797832265ba050009c7d668", "67fdf9f10c797f000a7b6d09", "684c4e48cc1cd8000a10ddb9", "684c39adfcf7b1000a8dd206", "6797626820ac9d000954e70d", "684c342a13af9d000a77bef3", "681c8f9c4f9c59000a0e3368", "67f3ec9f30b56a00090d20d6", "680e7bf064c02e000a714dcd", "684c458bcd7675000a9ae991", "6797626920ac9d000954e710", "681c8f3d4f9c59000a0e267a", "67f426a236b2df000a053948", "67f3ece305bd5d000a6ac97b", "683379a2038bf5000a7eaaf3", "6818812a6c0953000a1ab9c8", "681c8f825e2146000a16693b", "683379ed697657000a7185e2", "680e8a1c40a654000ac660de", "67fe99b670defa000a954bbe", "67f426da1d7709000abb62b0", "67a7655b29c214000a93fe2c", "680f51b022d66f000b18bede", "6797626af571870008a0a3b5", "6797626b9960e00009c5956b", "67a75622a56e20000ae0700e", "6797626bf571870008a0a3c5"]);
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}
const HEX16 = /^[0-9a-f]{16}$/i;
function scan(obj, path, out, depth) {
  if (obj == null || depth > 6) return;
  if (typeof obj === "string") {
    const s = obj.replace(/[-:\s]/g, "");
    if (HEX16.test(s) && /eui/i.test(path)) out.add(s.toLowerCase() + "@" + path.split(".").pop());
    return;
  }
  if (typeof obj !== "object") return;
  for (const k of Object.keys(obj)) scan(obj[k], path + "." + k, out, depth + 1);
}
const P = "EUI|";
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " ===");
  let devs = [];
  for (let page = 1; page <= 3; page++) {
    const r = await get(`/device?amount=200&page=${page}&fields=id,name,tags,network,last_input,active`);
    devs = devs.concat(r); if (r.length < 200) break;
  }
  const act = devs.filter((d) => d.network === NET || ACT_IDS.has(d.id));
  console.log(P + "ΣΥΝΟΛΟ|όλες=" + devs.length + "|actility=" + act.length);
  const buf = []; // η κονσόλα κρατά ≤ 200 εγγραφές → 10 συσκευές ανά εγγραφή
  let first = true, withEui = 0, match = 0, mism = 0, noData = 0;
  for (const d of act) {
    const tag = ((d.tags || []).find((t) => t.key === "eui") || {}).value || "";
    let found = new Set(), vars = new Set(), last = "";
    try {
      const recs = await get(`/device/${d.id}/data?qty=12`);
      for (const e of recs || []) { vars.add(e.variable); scan(e, "rec", found, 0); if (!last || e.time > last) last = e.time; }
      if (first && recs && recs.length) { first = false; console.log(P + "ΔΕΙΓΜΑ|" + d.name + "|" + JSON.stringify(recs.slice(0, 3)).slice(0, 1500)); }
      if (!recs || !recs.length) noData++;
    } catch (e) { console.log(P + "ERR|" + d.name + "|" + e.message); continue; }
    const euis = [...new Set([...found].map((x) => x.split("@")[0]))];
    if (euis.length) withEui++;
    let verdict = "—";
    if (euis.length) {
      if (euis.length === 1 && euis[0] === tag.toLowerCase().trim()) { verdict = "ΣΥΜΦΩΝΕΙ"; match++; }
      else { verdict = "✗ ΔΙΑΦΟΡΑ"; mism++; }
    }
    buf.push(P + "DEV|" + d.id + "|" + d.name + "|tag=" + tag + "|uplink=" + ([...found].join(",") || "-") +
      "|" + verdict + "|last=" + (last || d.last_input || "-") + "|active=" + d.active + "|vars=" + [...vars].slice(0, 6).join(","));
  }
  for (let i = 0; i < buf.length; i += 10) console.log(buf.slice(i, i + 10).join(" ¶ "));
  console.log(P + "ΤΕΛΟΣ|με_eui_στα_δεδομένα=" + withEui + "|συμφωνούν=" + match + "|διαφορές=" + mism + "|χωρίς_δεδομένα=" + noData);
})();
