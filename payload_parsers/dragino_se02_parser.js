/* ═══════════════════════════════════════════════════════════════════════════
   ΚΕΚ ΑΓΡΟΣ — PARSER 2 ΒΑΘΩΝ · ΕΚΔΟΣΗ 2               3 Σεπτεμβρίου 2026

   ⚠ ΔΕΝ ΕΙΝΑΙ ΔΕΥΤΕΡΟΣ PARSER. ΑΝΤΙΚΑΘΙΣΤΑ ΤΟ ΚΕΙΜΕΝΟ ΤΟΥ ΥΠΑΡΧΟΝΤΟΣ.
   Μία συσκευή έχει ΕΝΑΝ parser. Ανοίγεις τον parser της συσκευής του ΚΕΚ,
   σβήνεις τα πάντα, επικολλάς αυτό, Save. (Κράτα ΠΡΩΤΑ αντίγραφο του παλιού.)

   ΤΟ «ΣΚΙΩΔΗΣ» ΠΟΥ ΕΛΕΓΑ ΑΦΟΡΑ ΤΙΣ ΤΙΜΕΣ, ΟΧΙ ΤΟ ΑΡΧΕΙΟ:
   οι ΝΕΕΣ μεταβλητές (pore_water_ec1/2, salt_diff_depth) γράφονται στην
   πλατφόρμα αλλά ΔΕΝ τις διαβάζει κανείς — ούτε ο πυρήνας, ούτε το ταμπλό.
   Τρέχουν «στη σκιά» για να τις κοιτάξεις εσύ και να τις συγκρίνεις με τις
   παλιές, χωρίς να αλλάξει τίποτα σε παραγωγή. Οι ΠΑΛΙΕΣ έξι μεταβλητές
   βγαίνουν ΠΑΝΟΜΟΙΟΤΥΠΕΣ σε τιμή, μονάδα και όνομα.

   ΕΙΝΑΙ Ο ΔΙΚΟΣ ΣΟΥ PARSER, ΓΡΑΜΜΗ ΠΡΟΣ ΓΡΑΜΜΗ.
   Κάθε αλλαγή είναι σημειωμένη με «ΑΛΛΑΓΗ n». Δεν υπάρχει τίποτα άλλο.

   ΚΑΜΙΑ ΥΠΑΡΧΟΥΣΑ ΜΕΤΑΒΛΗΤΗ ΔΕΝ ΑΛΛΑΖΕΙ ΤΙΜΗ, ΜΟΝΑΔΑ Ή ΟΝΟΜΑ.
   Οι έξι που δημοσιεύεις σήμερα βγαίνουν πανομοιότυπες. Ο,τι νέο, βγαίνει
   δίπλα. Το ταμπλό δεν αλλάζει — το widget δεν ξέρει ακόμη τα νέα ονόματα,
   και αυτό είναι το ζητούμενο σε πειραματικό αγρό.

   ΑΛΛΑΓΗ 1  Ο ΦΡΑΓΜΟΣ. Όταν το fPort δεν είναι 2, η parsePayload επιστρέφει
             undefined και το .map() σκάει ΕΞΩ από το try/catch. Μία λέξη.
   ΑΛΛΑΓΗ 2  Η μπαταρία και ο DS18B20 δημοσιεύονται. Τους υπολόγιζες σωστά
             και τους πετούσες. Γι' αυτό ο πίνακας εποπτείας δείχνει «—».
   ΑΛΛΑΓΗ 3  Το raw mode (mod=1) δημοσιεύει. Πετούσε ΔΥΟ ΜΕΤΡΗΜΕΝΕΣ
             διηλεκτρικές σταθερές — το πιο πολύτιμο που έχει η συσκευή.
   ΑΛΛΑΓΗ 4  Οι σημαίες s_flag / i_flag / Mod δημοσιεύονται (ήταν κι αυτές
             μόνο μέσα στο decode).
   ΑΛΛΑΓΗ 5  ΝΕΟ, ΣΚΙΩΔΕΣ: pore_water_ec1/2 και salt_diff_depth.

   ΔΕΝ ΑΓΓΙΖΩ ΕΠΙΤΗΔΕΣ:
     • τη μονάδα 'mS/m' — μπαίνει στο ΕΠΟΜΕΝΟ βήμα, αφού δεις ότι όλα καλά
     • τη λίστα ignore_vars — είναι δική σου, αυτούσια
     • το `port==0x02` — χαλαρή σύγκριση, δέχεται και το "2" ως κείμενο
   ═══════════════════════════════════════════════════════════════════════════ */

// ── ΣΤΑΘΕΡΕΣ ΓΙΑ ΤΗΝ ΑΛΛΑΓΗ 5 ─────────────────────────────────────────────
const SOIL_OFFSET      = 4.1;      // ε₀ Hilhorst: 4,1 ορυκτό · 3,2 αμμώδες · 1,8 οργανικό
const MIN_MOISTURE_PCT = 15;       // κάτω από αυτό ο Hilhorst ΔΕΝ ισχύει
const EC_MAX_US        = 20000;    // προδιαγραφή Dragino
const NEW_EC_UNIT      = 'µS/cm';  // U+00B5 MICRO SIGN — ο ΜΟΝΟΣ χαρακτήρας που
                                   // αναγνωρίζει το widget· το ελληνικό «μ»
                                   // (U+03BC) δεν υπάρχει πουθενά στον κώδικά του.

// ── ΓΙΑΤΙ ΣΤΑΘΕΡΟ εw ΚΑΙ ΟΧΙ εw(T) — ΔΙΟΡΘΩΣΗ 3/9/2026 ─────────────────────
// Ο Hilhorst θέλει ΟΛΑ τα μεγέθη στην ΙΔΙΑ θερμοκρασία. Η Dragino δίνει την
// αγωγιμότητα ΗΔΗ ανηγμένη στους 25 °C («with temperature compensate») και η
// υγρασία είναι επίσης αντισταθμισμένη. Άρα το εw πρέπει να είναι ΚΙ ΑΥΤΟ
// στους 25 °C. Είχα γράψει εw σε θερμοκρασία ΑΓΡΟΥ — και το μέτρησα:
//   5 °C +9,4 % · 15 °C +4,7 % · 25 °C 0 % · 35 °C −4,7 % · 40 °C −7,1 %
// δηλαδή ΤΕΧΝΗΤΗ εξάρτηση −0,47 %/°C, ίδιου προσήμου με τη διπλή θερμοκρασιακή
// διόρθωση που ΑΚΡΙΒΩΣ προσπαθούμε να αφαιρέσουμε (−1,55 %/°C, r = −0,89).
// Θα κρατούσαμε το 30 % του σφάλματος, και το κριτήριο αποδοχής «η συσχέτιση
// με τη θερμοκρασία πέφτει προς το μηδέν» ΔΕΝ θα έφτανε ποτέ στο μηδέν.
const EPS_WATER_25     = 78.45;    // 80,3 − 0,37·(25 − 20)

// ⚠ ΓΝΩΣΤΗ ΑΝΤΙΦΑΣΗ ΜΟΝΑΔΩΝ, ΣΥΝΕΙΔΗΤΗ: τα ΙΔΙΑ bytes 8-9 βγαίνουν δύο φορές —
//   conduct_soil1  με ετικέτα 'mS/m'  (όπως ήταν· δεν αλλάζουμε τίποτα ακόμη)
//   pore_water_ec1 με ετικέτα 'µS/cm' (η σύμβαση που ΞΕΡΕΙ το widget)
// Η ΑΠΟΘΗΚΕΥΜΕΝΗ τιμή είναι µS/cm — αποδείχθηκε από δεδομένα παραγωγής
// (γονιμότητα 1554 -> pore 2,33 mS/cm εύλογο· 1,554 -> 0,0023 αδύνατο).
// Άρα η ΛΑΘΟΣ ετικέτα είναι το 'mS/m', και διορθώνεται στο ΕΠΟΜΕΝΟ βήμα, ΜΟΝΗ
// της, ώστε να φανεί καθαρά αν αλλάζει κάτι. Ο υπολογισμός ΔΕΝ εξαρτάται από
// την ετικέτα — μόνο από την αποθηκευμένη τιμή, που δεν αλλάζει.

// Αγωγιμότητα νερού πόρων στους 25 °C, από ωμή μέτρηση + υγρασία + θερμοκρασία.
// Topp, Davis & Annan (1980) για το ε · Hilhorst (2000, SSSAJ 64:1922) για το ECp.
// ΚΑΜΙΑ δεύτερη θερμοκρασιακή διόρθωση: η Dragino δίνει ήδη @25 °C.
// Το εw στη ΘΕΡΜΟΚΡΑΣΙΑ ΑΓΡΟΥ — έτσι το αποτέλεσμα βγαίνει αυτόματα στους 25 °C.
// Επιστρέφει null όταν δεν επιτρέπεται να μιλήσει. ΚΕΝΟ, όχι μικρό νούμερο.
function poreEC(conduct_us, moisture_pct) {
  if (!Number.isFinite(conduct_us) || !Number.isFinite(moisture_pct)) return null;
  if (!(conduct_us >= 0 && conduct_us <= EC_MAX_US)) return null;
  if (!(moisture_pct > MIN_MOISTURE_PCT)) return null;
  var vwc = moisture_pct / 100;
  var eps = 3.03 + 9.3*vwc + 146*Math.pow(vwc,2) - 76.7*Math.pow(vwc,3);
  // Φρουρά ε > ε₀ + 1,0 (όχι +0,1): στο +0,1 ο παρονομαστής γίνεται 0,1 και
  // πολλαπλασιάζει το σφάλμα ×800. Στο +1,0 ποτέ πάνω από ×80.
  if (!(eps > SOIL_OFFSET + 1.0)) return null;
  var epsW = EPS_WATER_25;
  // Αποθήκευση σε µS/cm — ΟΧΙ mS/cm. Το widget υποθέτει µS/cm και διαιρεί με
  // 1000 για να δείξει mS/cm. Αν αποθηκεύαμε mS/cm θα διαιρούσε ΔΕΥΤΕΡΗ φορά.
  return Math.round((epsW * (conduct_us / 1000)) / (eps - SOIL_OFFSET) * 1000);
}

const fport = payload.find(x => x.variable === 'fport');

var port;

if (fport)
  port = fport.value;

function parsePayload(payload) {
  try {
        var bytes = Buffer.from(payload, 'hex');
        var data = [];
        var value;
        var decode = {};
        // ΑΛΛΑΓΗ 7 · ΚΟΜΜΕΝΟ PAYLOAD ΔΕΝ ΕΙΝΑΙ ΥΓΙΗΣ ΜΕΤΡΗΣΗ.
        // Σε frame < 17 bytes το bytes[16] είναι undefined, και το undefined>>7
        // δίνει ΣΙΩΠΗΛΑ 0 — κανένα σφάλμα. Ο παλιός parser δημοσίευε έξι
        // μηδενικά που έμοιαζαν με κανονική μέτρηση ξηρού εδάφους. Καλύτερα
        // ΕΝΑ parse_error παρά έξι πειστικά ψέματα.
        // (Το Buffer.from(hex) κόβει ΣΙΩΠΗΛΑ στον πρώτο μη-δεκαεξαδικό χαρακτήρα.)
        if (bytes.length < 17) throw new Error('payload ' + bytes.length + ' bytes — περίμενα 17');
        var mod=(bytes[16]>>7)&0x01;

        if(port==0x02){
          decode.BatV=((bytes[0]<<8 | bytes[1]) & 0x3FFF)/1000;//Battery,units:V

          // ΑΛΛΑΓΗ 2 + 7: η μπαταρία τροφοδοτεί ΤΩΡΑ τον πίνακα εποπτείας ΚΑΙ τον
          // συναγερμό «χαμηλή μπαταρία» (<3,0 V). Κυψέλη Li-SOCl2 3,6 V: 2,0-3,9 V.
          // Χωρίς όριο, ένα αλλοιωμένο frame θα έγραφε 16,383 V στη σειρά.
          if (decode.BatV >= 2.0 && decode.BatV <= 3.9)
            data.push({ variable: 'battery', value: decode.BatV, unit: 'V'});

          var value=bytes[2]<<8 | bytes[3];
          if(bytes[2] & 0x80)
          {value |= 0xFFFF0000;}
          decode.temp_DS18B20=(value/10).toFixed(2);//DS18B20,temperature

          // DS18B20: προδιαγραφή −55…+125 °C. Χωρίς όριο, κομμένο frame -> −1309 °C.
          var _ds = parseFloat(decode.temp_DS18B20);
          if (Number.isFinite(_ds) && _ds >= -55 && _ds <= 125)
            data.push({ variable: 'ds18b20', value: _ds, unit: '°C'});

          if(mod===0) {
          value=bytes[6]<<8 | bytes[7];
          if((value & 0x8000)>>15 === 0)
            decode.temp_SOIL=(value/100).toFixed(2);//temp_SOIL,temperature
          else if((value & 0x8000)>>15 === 1)
            decode.temp_SOIL=parseFloat(((value-0xFFFF)/100).toFixed(2));

            data.push({ variable: 'soil_temperature1',  value: parseFloat(decode.temp_SOIL), unit: '°C'});

            decode.water_SOIL=parseFloat(((bytes[4]<<8 | bytes[5])/100).toFixed(2));//water_SOIL,Humidity,units:%
            data.push({ variable: 'soil_moisture1',  value: parseFloat(decode.water_SOIL), unit: '%'});
            decode.conduct_SOIL=parseFloat(bytes[8]<<8 | bytes[9]);
            data.push({ variable: 'conduct_soil1',  value: parseFloat(decode.conduct_SOIL), unit: 'mS/m'});

          value=bytes[12]<<8 | bytes[13];
          if((value & 0x8000)>>15 === 0)
            decode.temp_SOIL2=(value/100).toFixed(2);//temp_SOIL2,temperature
          else if((value & 0x8000)>>15 === 1)
            decode.temp_SOIL2=parseFloat(((value-0xFFFF)/100).toFixed(2));

            data.push({ variable: 'soil_temperature2',  value: parseFloat(decode.temp_SOIL2), unit: '°C'});

            decode.water_SOIL2=parseFloat(((bytes[10]<<8 | bytes[11])/100).toFixed(2));//water_SOIL2,Humidity,units:%

            data.push({ variable: 'soil_moisture2',  value: parseFloat(decode.water_SOIL2), unit: '%'});
            decode.conduct_SOIL2=parseFloat(bytes[14]<<8 | bytes[15]);
            data.push({ variable: 'conduct_soil2',  value: parseFloat(decode.conduct_SOIL2), unit: 'mS/m'});

            /* ── ΑΛΛΑΓΗ 5 · ΝΕΟ, ΔΙΠΛΑ ΣΤΑ ΥΠΑΡΧΟΝΤΑ ─────────────────────
               ΠΡΟΣΟΧΗ ΣΤΗ ΣΥΓΚΡΙΣΗ: η ΩΜΗ αγωγιμότητα των δύο βαθών ΔΕΝ
               συγκρίνεται μεταξύ της. Ισχύει ECb ≈ a·θⁿ με n ≈ 1,9-2,1 —
               το πιο ΥΓΡΟ στρώμα άγει περισσότερο με ΤΟ ΙΔΙΟ αλάτι. Μόνο η
               pore_water_ec συγκρίνεται. */
            var p1 = poreEC(decode.conduct_SOIL,  decode.water_SOIL);
            var p2 = poreEC(decode.conduct_SOIL2, decode.water_SOIL2);
            if (p1 !== null) data.push({ variable: 'pore_water_ec1', value: p1, unit: NEW_EC_UNIT});
            if (p2 !== null) data.push({ variable: 'pore_water_ec2', value: p2, unit: NEW_EC_UNIT});
            // Βγαίνει ΜΟΝΟ όταν ΚΑΙ ΤΑ ΔΥΟ βάθη πέρασαν την πύλη — αλλιώς θα
            // συγκρίναμε μια μέτρηση με ένα κενό και θα το λέγαμε «διαφορά».
            // ΘΕΤΙΚΗ  = περισσότερο αλάτι ΚΑΤΩ  -> έκπλυση προς τα κάτω, ΟΚ
            // ΑΡΝΗΤΙΚΗ = περισσότερο αλάτι ΠΑΝΩ -> ανοδική κίνηση, καμπανάκι
            if (p1 !== null && p2 !== null)
              data.push({ variable: 'salt_diff_depth', value: (p2 - p1), unit: NEW_EC_UNIT});
            }
          else
          {
              decode.Soil_dielectric_constant=((bytes[4]<<8 | bytes[5])/10).toFixed(1);
            decode.Raw_water_SOIL=bytes[6]<<8 | bytes[7];
            decode.Raw_conduct_SOIL=bytes[8]<<8 | bytes[9];

              decode.Soil_dielectric_constant2=((bytes[10]<<8 | bytes[11])/10).toFixed(1);
            decode.Raw_water_SOIL2=bytes[12]<<8 | bytes[13];
            decode.Raw_conduct_SOIL2=bytes[14]<<8 | bytes[15];

            /* ── ΑΛΛΑΓΗ 3 · ΤΟ RAW MODE ΔΕΝ ΠΕΤΙΕΤΑΙ ΠΙΑ ────────────────────
               Η διηλεκτρική σταθερά είναι ΜΕΤΡΗΜΕΝΗ από το όργανο — ακριβώς
               το μέγεθος που εμείς ξαναφτιάχνουμε με Topp από την υγρασία. */
            data.push({ variable: 'raw_dielectric1', value: parseFloat(decode.Soil_dielectric_constant)});
            data.push({ variable: 'raw_water1',      value: decode.Raw_water_SOIL});
            data.push({ variable: 'raw_conduct1',    value: decode.Raw_conduct_SOIL});
            data.push({ variable: 'raw_dielectric2', value: parseFloat(decode.Soil_dielectric_constant2)});
            data.push({ variable: 'raw_water2',      value: decode.Raw_water_SOIL2});
            data.push({ variable: 'raw_conduct2',    value: decode.Raw_conduct_SOIL2});
          }
          decode.s_flag = (bytes[16]>>4)&0x01;
          decode.i_flag = bytes[16]&0x0F;
          decode.Mod = mod;

          /* ΑΛΛΑΓΗ 4 */ data.push({ variable: 's_flag', value: decode.s_flag});
          /* ΑΛΛΑΓΗ 4 */ data.push({ variable: 'i_flag', value: decode.i_flag});
          /* ΑΛΛΑΓΗ 4 */ data.push({ variable: 'sensor_mode', value: decode.Mod});

          console.log(decode);
          return data;
        }

    } catch (e) {
    console.log(e);
    // Return the variable parse_error for debugging.
    return [{ variable: 'parse_error', value: e.message }];
  }
}

const payload_raw = payload.find(x => x.variable === 'payload');
if (payload_raw) {
  // Get a unique serie for the incoming data.
  const { value, serie, time } = payload_raw;

  if (value) {
    /* ── ΑΛΛΑΓΗ 1 · Ο ΦΡΑΓΜΟΣ — Η ΠΙΟ ΜΙΚΡΗ ΚΑΙ Η ΠΙΟ ΣΗΜΑΝΤΙΚΗ ───────────
       Όταν το fPort δεν είναι 2, η parsePayload δεν φτάνει ποτέ σε return:
       γυρίζει undefined. Το .map() καλείται ΕΞΩ από το try/catch και ρίχνει
       TypeError — σιωπηλά, σε κάθε uplink συντήρησης. Το « || [] » το λύνει. */
    payload = payload.concat((parsePayload(value) || []).map(x => ({ ...x, serie, time: x.time || time })));
  }
}

// Add ignorable variables in this array.
const ignore_vars = ['customerdxprofileid','customerrealmid','rf_chain', 'channel', 'modulation', 'app_id', 'dev_id', 'gtw_trusted', 'port','classb','delayed','encodingtype','fcntdown','fcntup','gwrecvtime','recvtime','application_id', 'device_id', 'downlink_key', 'lora_bandwidth','lora_spreading_factor', 'coding_rate', 'frequency', 'timestamp','time','fport','fcnt','payload','gateway_eui','rssi','snr','frm_payload','lora_coding_rate','deveui','fcntdn','adrbit','mtype','mic_hex','lrcid','lrrrssi','lrrsnr','lrresp','spfact','subband','lrrid','late','devlrrcnt','BaseStationData','modelcfg','DriverCfg','txpower','nbtrans','downlinkurl','margin','batterytime','batterylevel','lostuplinksas','lrrlat','lrrlon'];

// Remove unwanted variables.
payload = payload.filter(x => !ignore_vars.includes(x.variable));

/* ΑΛΛΑΓΗ 6 · Αφαιρέθηκαν οι Str1, str_pad, datalog, getzf, getMyDate.
   Ορίζονταν και δεν καλούνταν ΠΟΤΕ — υπόλειμμα του δείγματος της Dragino
   (datalog αποθηκευμένων μετρήσεων). Αβλαβείς, αλλά έκρυβαν τα σημαντικά. */
