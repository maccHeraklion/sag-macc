/* ΔΡΟΜΟΣ Β (8/9/2026): οι τρεις σταθερες φυσικης (SOIL_OFFSET 3.2,
   WATER_PERMITTIVITY 80, MIN_MOISTURE_PCT 15) ΑΦΑΙΡΕΘΗΚΑΝ μαζι με το μπλοκ
   βαθμονομησης. Η αλυσιδα Hilhorst ζει ΜΟΝΟ στον πυρηνα (_sagEcChain), οπου
   υπαρχουν τυπος εδαφους, κορεσμος και ανοχη καλλιεργειας.
   ΜΗΝ ΤΙΣ ΞΑΝΑΒΑΛΕΙΣ ΕΔΩ. Ο parser μετραει· ο πυρηνας κρινει. */


/* ── ΔΙΟΡΘΩΣΗ 1/2 (8/9/2026) · Η ΛΙΣΤΑ ΜΕΤΑΚΙΝΗΘΗΚΕ ΕΔΩ, ΠΑΝΩ ────────────
   Ηταν δηλωμενη στο ΤΕΛΟΣ του αρχειου, αλλα χρησιμοποιουνταν ~15 γραμμες
   πιο πανω. Ενα `const` πριν τη δηλωση του ριχνει ReferenceError, και η
   κληση ηταν ΕΞΩ απο το try/catch: καθε uplink που δεν ειναι fPort 2
   (join, status, ack) ΕΣΚΑΖΕ τον parser και ΧΑΝΟΤΑΝ ολοκληρο.
   Το περιεχομενο της λιστας ειναι απαραλλακτο. ───────────────────────── */
// === List of unwanted variables from Actility ===
const ignore_vars = ['customerdxprofileid','customerrealmid',
  'fport', 'fcnt', 'time', 'payload', 'deveui',
  'frequency', 'fcntup', 'fcntdn', 'adrbit', 'mtype',
  'mic_hex', 'lrcid', 'lrrrssi', 'lrrsnr', 'lrresp',
  'spfact', 'subband', 'lrrid', 'late', 'lrrlat', 'lrrlon',
  'devlrrcnt', 'BaseStationData', 'modelcfg', 'DriverCfg',
  'txpower', 'nbtrans', 'downlinkurl', 'lostuplinksas'
];

// === Get important variables from payload ===
const fportObj = payload.find(x => x.variable === 'fport');
const payload_raw = payload.find(x => x.variable === 'payload');

// === Only continue if payload exists and fPort is 2 ===
/* ── ΔΙΟΡΘΩΣΗ 1/2 (συνεχεια) ─────────────────────────────────────────────
   Το παλιο `if` δεν ειχε `return`: ακομη κι αν δεν εσκαγε, η εκτελεση
   συνεχιζε στο `const { value } = payload_raw` και εσκαγε εκει. Τωρα η
   αποκωδικοποιηση γινεται ΜΟΝΟ οταν υπαρχει payload σε fPort 2· αλλιως
   το uplink απλα καθαριζεται και περναει. ───────────────────────────── */
const _sagCanDecode = !!(payload_raw && payload_raw.value && fportObj && fportObj.value === 2);

const data = [];

if (_sagCanDecode) {
  const { value, serie, time } = payload_raw;
  const bytes = Buffer.from(value, 'hex');

  try {
    // === Decode SE0X Payload ===

    // Battery voltage (first 14 bits)
    const batRaw = ((bytes[0] << 8) | bytes[1]) & 0x3FFF;
    data.push({ variable: 'battery', value: batRaw / 1000, unit: 'V', time, serie });

    // DS18B20 temperature (signed int16)
    let temp = (bytes[2] << 8) | bytes[3];
    if (bytes[2] & 0x80) temp |= 0xFFFF0000; // Sign extend if negative
    data.push({ variable: 'ds18b20', value: temp / 10, unit: '°C', time, serie });

    const byte4 = bytes[4];
    const mod = (byte4 >> 7) & 0x01;
    const i_flag = (byte4 >> 6) & 0x01;
    const type = byte4 & 0x0F;

    data.push({ variable: 'mod', value: mod, time, serie });
    data.push({ variable: 'i_flag', value: i_flag, time, serie });

    // Figure out which probes are active (bit mask)
    const activeProbes = [];
    for (let i = 0; i < 4; i++) {
      if ((type >> (3 - i)) & 0x01) activeProbes.push(i);
    }

    const channelNames = ['1', '2', '3', '4'];
    let idx = 5;

    for (const ch of activeProbes) {
      if (mod === 0) {
        // === Standard Mode ===
        const raw_water = (bytes[idx] << 8) | bytes[idx + 1];
        const raw_temp = (bytes[idx + 2] << 8) | bytes[idx + 3];
        const raw_conduct = (bytes[idx + 4] << 8) | bytes[idx + 5];

        // Format basic values
        let temp_c = ((raw_temp & 0x8000) >> 15 === 1) ? ((raw_temp - 0xFFFF) / 100) : (raw_temp / 100);
        let moisture_pct = raw_water / 100;
        let conduct_us = raw_conduct; // Raw bulk conductivity in µS/cm

        // Push raw values
        data.push({ variable: `soil_temperature${channelNames[ch]}`, value: parseFloat(temp_c.toFixed(2)), unit: '°C', time, serie });
        data.push({ variable: `soil_moisture${channelNames[ch]}`, value: parseFloat(moisture_pct.toFixed(2)), unit: '%', time, serie });
        data.push({ variable: `conduct_soil${channelNames[ch]}`, value: conduct_us, unit: 'µS/cm', time, serie });

        /* ══ ΔΡΟΜΟΣ Β (8/9/2026) · Ο PARSER ΣΤΑΜΑΤΑ ΤΗ ΦΥΣΙΚΗ ═══════════════
           ΑΠΟΦΑΣΗ ΜΙΧΑΛΗ. Εδω υπηρχε ΔΕΥΤΕΡΗ, ΑΝΕΞΑΡΤΗΤΗ υλοποιηση της
           αλυσιδας Hilhorst — με ΑΛΛΕΣ σταθερες απο τον πυρηνα:
             parser: SOIL_OFFSET 3.2 · WATER_PERMITTIVITY 80 σταθερο
             πυρηνας: ε0 = 4.1 · ε_w = 80.3 - 0.37*(T-20)
           και με εναν πολλαπλασιαστη 1000*(2/3) που δεν τεκμηριωνεται
           πουθενα: ουτε µS/cm βγαζει (θα ηταν x1000) ουτε mS/cm (x1).
           Το αποτελεσμα δημοσιευοταν ως `fertility_index{ch}`.

           ΜΕΤΡΗΜΕΝΟ σε πραγματικο δειγμα Κουκιας (ρηχο, 8/9/2026):
             conduct_soil1   =   292 µS/cm  (ωμη μετρηση του οργανου)
             fertility_index1 = 3.364,5     (ιδιο δειγμα, ιδια ετικετα οθονης)
             λογος 11,5x — και το widget ΕΚΡΥΒΕ το ωμο οταν υπηρχε το δευτερο.

           ΓΙΑΤΙ ΦΕΥΓΕΙ ΚΑΙ ΟΧΙ ΑΠΛΑ ΔΙΟΡΘΩΝΕΤΑΙ ΤΟ 2/3: η φυσικη χρειαζεται
           στοιχεια που ο parser ΔΕΝ ΕΧΕΙ — τυπο εδαφους, κορεσμο, βαθος
           αισθητηρα, ανοχη καλλιεργειας. Ο πυρηνας τα εχει ολα (_sagEcChain,
           SOIL_PROFILE, Maas & Hoffman) και τα εφαρμοζει ΑΝΑ ΑΓΡΟ.
           Δυο υλοποιησεις της ιδιας φυσικης ειναι δυο αληθειες.

           ΤΙ ΔΕΝ ΑΛΛΑΖΕΙ: το `conduct_soil{ch}` πιο πανω μενει ΑΚΡΙΒΩΣ οπως
           ηταν — ωμη αγωγιμοτητα σε µS/cm. Ολα τα μοντελα του πυρηνα
           διαβαζουν ΑΥΤΟ. Καμια ιστορικη τιμη δεν αλλαζει κλιμακα, καμια
           ασυνεχεια στα δεδομενα, κανενα λιτρο αρδευσης δεν μετακινειται.
           ══════════════════════════════════════════════════════════════ */

      } else {
        // === Raw Mode ===
        const raw_dielectric = (bytes[idx] << 8) | bytes[idx + 1];
        const raw_water = (bytes[idx + 2] << 8) | bytes[idx + 3];
        const raw_conduct = (bytes[idx + 4] << 8) | bytes[idx + 5];

        data.push({ variable: `raw_dielectric_${channelNames[ch]}`, value: (raw_dielectric / 10).toFixed(1), time, serie });
        data.push({ variable: `raw_water_${channelNames[ch]}`, value: raw_water, time, serie });
        data.push({ variable: `raw_conduct_${channelNames[ch]}`, value: raw_conduct, time, serie });
      }

      idx += 6;
    }

  } catch (err) {
    data.push({ variable: 'parse_error', value: err.message, time });
  }
}

// === Final cleaned + decoded output ===
payload = payload.filter(x => !ignore_vars.includes(x.variable)).concat(data);
