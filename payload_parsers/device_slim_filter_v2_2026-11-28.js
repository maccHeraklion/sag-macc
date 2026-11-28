/* T-PARSER-SLIM-02 (28/11/2026, απόφαση Μιχάλη). Parser ΣΥΣΚΕΥΗΣ, τρέχει μετά τον parser του connector.
 * (α) Κόβει τεχνικά πεδία που δεν διαβάζει κανένας κώδικας και κανένα widget (απογραφή 28/11: 185 ταμπλό, 2.147 widgets).
 * (β) Οι δείκτες wind_chill / thw_indexc / heat_index γράφονται μόνο στα πακέτα των πρώτων 10 λεπτών κάθε ώρας (UTC),
 *     όχι σε κάθε πακέτο. Θερμοκρασία, υγρασία και άνεμος μένουν σε κάθε πακέτο, άρα οι δείκτες ξαναϋπολογίζονται πάντα.
 * Μένουν: μετρήσεις, μπαταρία, lrrid/lrrrssi/lrrsnr/lrrlat/lrrlon (χάρτης πυλών). ΠΟΤΕ σε βάνες, μετρητές νερού ή ξενοδοχείο.
 * Αντικαθιστά το T-PARSER-SLIM-01· σε συσκευή με δικό της parser μπαίνει στο τέλος. Σκέτος κώδικας, ποτέ base64 (παγίδα #225). */
const SAG_DROP = ["adrbit", "basestationdata", "customerdxprofileid", "customerrealmid", "devlrrcnt", "downlinkurl", "drivercfg",
  "fcntdn", "fcntup", "frequency", "ismband", "lostuplinksas", "lrcid", "lrralt", "lrresp", "lrruuid", "mic_hex", "modelcfg",
  "mtype", "nbtrans", "payloadencryption", "spfact", "subband", "txpower",
  "wind_speed_kmh2", "message_type", "interrupt_flag", "tempc_ds18b20", "payload", "late", "channel", "time", "fport", "deveui",
  "i_flag", "mod", "ds18b20", "payloaddecodederror"];
const SAG_HOURLY = ["wind_chill", "thw_indexc", "heat_index"];
if (Array.isArray(payload)) {
  const sagKeepIdx = new Date().getUTCMinutes() < 10;
  payload = payload.filter((x) => {
    if (!x) return true;
    const v = String(x.variable).toLowerCase();
    if (SAG_DROP.includes(v)) return false;
    if (!sagKeepIdx && SAG_HOURLY.includes(v)) return false;
    return true;
  });
}
