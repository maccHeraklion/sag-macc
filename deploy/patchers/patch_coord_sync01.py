# T-COORD-SYNC-01 (9/11/2026, Michalis «όταν ενημερώνεται κάπου, να αντικαθίσταται παντού»): sync v19 — η θέση της φόρμας
# ξαναγράφει την ετικέτα coordinates του αγρού (μία τιμή, δεκαδικές μοίρες). Ως τώρα την έγραφε ΜΟΝΟ το createField.
import sys, subprocess
P = sys.argv[1]
s = open(P, 'rb').read().decode('utf-8').replace('\r\n', '\n')


def sub(old, new, cnt=1):
    global s
    n = s.count(old)
    assert n == cnt, (n, old[:80])
    s = s.replace(old, new)


sub(" ** v18 · 3/11/2026 — T-ZONES-01:",
    " ** v19 · 9/11/2026 — T-COORD-SYNC-01: η θέση της φόρμας (latitude/longitude) ξαναγράφει την ετικέτα «coordinates» του αγρού\n"
    " **   (μία τιμή «πλάτος, μήκος» σε δεκαδικές μοίρες· διπλές/παλιές τιμές φεύγουν). Πριν τη γράφε ΜΟΝΟ το createField στη δημιουργία,\n"
    " **   άρα κάθε αλλαγή θέσης από την παραμετροποίηση άφηνε παλιά ετικέτα σε όποιον τη διαβάζει (πρόγνωση, έλεγχος «λάθος αγρός»).\n"
    " ** v18 · 3/11/2026 — T-ZONES-01:")
sub("""  newTags.push({ key: "configuration", value: serialized });
  if (typeof zonesTag === "string") newTags.push({ key: "irrigation_zones", value: zonesTag });""",
"""  newTags.push({ key: "configuration", value: serialized });
  if (typeof zonesTag === "string") newTags.push({ key: "irrigation_zones", value: zonesTag });
  /* v19 · T-COORD-SYNC-01: η φόρμα είναι το ΚΥΡΙΟ σημείο της θέσης του αγρού. Μόνο έγκυρη θέση μέσα στην Ελλάδα·
     αλλιώς η ετικέτα μένει όπως είναι (καμία διαγραφή θέσης από κενό πεδίο). */
  {
    const _lat = Number(tag.latitude), _lon = Number(tag.longitude);
    if (Number.isFinite(_lat) && Number.isFinite(_lon) && _lat >= 33.5 && _lat <= 42.5 && _lon >= 19 && _lon <= 30.5) {
      const _val = _lat.toFixed(6) + ", " + _lon.toFixed(6);
      const _old = newTags.filter((t) => t.key === "coordinates").map((t) => String(t.value || ""));
      if (!(_old.length === 1 && _old[0] === _val)) {
        for (let _i = newTags.length - 1; _i >= 0; _i--) if (newTags[_i].key === "coordinates") newTags.splice(_i, 1);
        newTags.push({ key: "coordinates", value: _val });
        context.log("T-COORD-SYNC-01: coordinates [" + device_id + "]: " + (_old.join(" | ") || "—") + " → " + _val);
      }
    }
  }""")
open(P, 'wb').write(s.encode('utf-8'))
r = subprocess.run(['node', '--check', P], capture_output=True, text=True)
print('node --check', r.returncode, r.stderr[:300])
