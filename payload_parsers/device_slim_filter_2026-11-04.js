/* T-PARSER-SLIM-01 (4/11/2026, απόφαση Michalis). Parser ΣΥΣΚΕΥΗΣ, τρέχει μετά τον parser του connector.
 * Κόβει μόνο τεχνικά στοιχεία δικτύου που κανένας κώδικας δεν διαβάζει, ώστε να μη γράφονται ως εγγραφές.
 * Μετρήσεις, μπαταρία και ό,τι χρειάζεται ο χάρτης gateways (lrrid, lrrrssi, lrrsnr, lrrlat, lrrlon) μένουν.
 * ΠΟΤΕ σε βάνες, μετρητές νερού ή στο ξενοδοχείο. Σε συσκευή με δικό της parser μπαίνει στο τέλος, δεν αντικαθιστά.
 * Επικολλάται σκέτος κώδικας, ποτέ base64 (παγίδα #225). */
const SAG_DROP = ["adrbit", "basestationdata", "customerdxprofileid", "customerrealmid", "devlrrcnt", "downlinkurl", "drivercfg",
  "fcntdn", "fcntup", "frequency", "ismband", "lostuplinksas", "lrcid", "lrralt", "lrresp", "lrruuid", "mic_hex", "modelcfg",
  "mtype", "nbtrans", "payloadencryption", "spfact", "subband", "txpower"];
if (Array.isArray(payload)) {
  payload = payload.filter((x) => !(x && SAG_DROP.includes(String(x.variable).toLowerCase())));
}
