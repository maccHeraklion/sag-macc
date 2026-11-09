# T-ERP-OFFERS-01 (9/11/2026): οι προσφορές στη σελίδα ERP — μενού, καρτέλα πελάτη, πίνακας ελέγχου, απάντηση εντολών.
import sys, subprocess, re
P, BLOCK = sys.argv[1], sys.argv[2]
s = open(P, 'rb').read().decode('utf-8').replace('\r\n', '\n')
blk = open(BLOCK, 'rb').read().decode('utf-8').replace('\r\n', '\n')


def sub(old, new, cnt=1):
    global s
    n = s.count(old)
    assert n == cnt, (n, old[:80])
    s = s.replace(old, new)


# 1. το μπλοκ πριν τη liveAll
sub("\nasync function liveAll(src){await liveCatalog(src);liveFleet(src);await liveRegistry(src)}",
    "\n" + blk + "\nasync function liveAll(src){await liveCatalog(src);liveFleet(src);await liveRegistry(src)}")
# 2. μετά την αποθήκευση ανοίγει η σωστή καρτέλα (πελάτη ή προσφοράς)· ανανέωση και της σελίδας προσφορών
sub("if (m.ok) { closeD(); if (m.id && p.reopen) setTimeout(() => dCust(m.id), 400); }",
    "if (m.ok) { closeD(); if (m.id && p.reopen) setTimeout(() => (m.kind === 'offer' ? dOfferLive(m.id) : dCust(m.id)), 400); }")
sub("if (REG && ['customers', 'dash'].includes(ST.page) && !$('#drw').classList.contains('on')) go(ST.page);",
    "if (REG && ['customers', 'dash', 'offers'].includes(ST.page) && !$('#drw').classList.contains('on')) go(ST.page);")
# 3. καρτέλα πελάτη: ενότητα «Προσφορές» και κουμπί «+ Προσφορά»
sub("const tabs = [['info', 'Στοιχεία'], ['contacts', 'Επαφές (' + (c.contacts || []).length + ')'], ['inst', 'Εγκαταστάσεις (' + ii.length + ')'], ['hist', 'Ιστορικό (' + aud.length + ')']];",
    "const oo = (typeof regOffers === 'function' ? regOffers() : []).filter(o => String(o.customer_id) === String(c.id)).sort((a, b) => String(b.number).localeCompare(String(a.number)));\n  const tabs = [['info', 'Στοιχεία'], ['contacts', 'Επαφές (' + (c.contacts || []).length + ')'], ['inst', 'Εγκαταστάσεις (' + ii.length + ')'], ['offers', 'Προσφορές (' + oo.length + ')'], ['hist', 'Ιστορικό (' + aud.length + ')']];")
sub("  if (tab === 'hist') body +=",
    "  if (tab === 'offers') body += tbl(['Αριθμός', 'Τίτλος', '#Σύνολο', 'Κατάσταση'], oo.map(o => `<tr class=\"c\" onclick=\"dOfferLive('${o.id}')\"><td class=\"mono\">${esc(o.number)}</td><td>${esc(o.title || '')}</td><td class=\"num\">${eur((o.totals || {}).gross)}</td><td>${b(OFF_N[o.status] || o.status, OFF_T[o.status])}</td></tr>`), 'Καμία προσφορά') + `<div style=\"margin-top:10px\"><button class=\"btn\" onclick=\"offerFormLive(null,'${c.id}')\">+ Νέα προσφορά για τον πελάτη</button></div>`;\n  if (tab === 'hist') body +=")
sub("`<button class=\"btn\" onclick=\"noteForm('${c.id}')\">+ Σημείωση</button><button class=\"btn p\" onclick=\"custForm('${c.id}')\">Επεξεργασία</button>`;",
    "`<button class=\"btn\" onclick=\"noteForm('${c.id}')\">+ Σημείωση</button><button class=\"btn\" onclick=\"offerFormLive(null,'${c.id}')\">+ Προσφορά</button><button class=\"btn p\" onclick=\"custForm('${c.id}')\">Επεξεργασία</button>`;")
# 4. πίνακας ελέγχου: ανοιχτές προσφορές στη θέση του τιμοκαταλόγου
sub("${kpi('Τιμοκατάλογος', LIVE ? LIVE.n + ' είδη' : '—', LIVE && LIVE.u ? 'ενημέρωση ' + fd(LIVE.u) : '')}",
    "${(() => { const oo = (typeof regOffers === 'function' ? regOffers() : []).filter(o => o.status === 'draft' || o.status === 'sent'); return kpi('Ανοιχτές προσφορές', REG ? oo.length : '…', REG ? eur0(oo.reduce((s, o) => s + ((o.totals || {}).gross || 0), 0)) + ' με ΦΠΑ' : ''); })()}")
open(P, 'wb').write(s.encode('utf-8'))
m = re.findall(r'<script>([\s\S]*?)</script>', s)
chk = P + '.check.js'
open(chk, 'w', encoding='utf-8', newline='\n').write(m[-1])
r = subprocess.run(['node', '--check', chk], capture_output=True, text=True)
print('node --check', r.returncode, r.stderr[:500])
