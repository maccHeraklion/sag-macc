# -*- coding: utf-8 -*-
# Ιδιωτική έκδοση του demo με τον ΠΡΑΓΜΑΤΙΚΟ τιμοκατάλογο του TagoIO (costing_list v4 + subscriptionPricingNumbers).
# Η έξοδος γράφεται στο reports/demo/private/ που είναι στο .gitignore: δεν ανεβαίνει ποτέ στο δημόσιο repo.
import json, sys, os, re
sys.stdout.reconfigure(encoding='utf-8')
SP, ROOT = sys.argv[1], sys.argv[2]
L = open(os.path.join(SP, 'catalog_g22.txt'), encoding='utf-8').read().splitlines()
head = None; items = []; pk = []; subcfg = {}
for l in L:
    p = l.split('|', 2)
    if p[1] == 'HEAD': head = json.loads(p[2])
    elif p[1] == 'I': items += json.loads(l.split('|', 3)[3])
    elif p[1] == 'PK': pk.append(json.loads(p[2]))
    elif p[1] == 'SUBCFG':
        name, tags = p[2].split('|', 1)
        subcfg[name] = dict(json.loads(tags))
CT, IN, VN = head['ct'], head['in'], head['vn']
IT = [[x[0], CT[x[1]], IN[x[2]], VN[x[3]], x[4], x[5]] for x in items]
bysku = {x[0]: x for x in IT}
meter = next(x[0] for x in IT if x[0].startswith('ALTAIR-V4-DN20-R500'))
MAP = {'s2120': '101990961', 'se01': 'SE01-LB-868', 'se0x': 'SE02-LB-868', 'sph01': 'SPH01-LB-868', 'lms01': 'LMS01-LS-868',
       'em320': 'EM320-TH-868M', 'em300': 'EM300-TH-868M', 'uc511': 'UC511-DI-868M', 'uc501': 'UC501-868M', 'ws558': 'WS558-868M PN: Switch',
       'istation': 'PDTIOT-ISS04', 'ifemto': 'PDTIOT-IFE03', 'sg50': 'SG50-L08GL-868M PN: 30W', 'dlos8n': 'DLOS8N-868', 'lps8n': 'LPS8N-868',
       'valve': 'agrohum-Valve-BSP-1inch-FC', 'meter': meter}
for k, v in MAP.items(): assert v in bysku, (k, v)
NAMES = {'sense': 'Sense', 'sensePlus': 'Sense Plus', 'sagFull': 'SAG Full', 'waterPro': 'WaterPro', 'soilone': 'Αισθητήρας εδάφους 1 βάθους', 'soildouble': 'Αισθητήρας εδάφους 2 βαθών', 's2120': 'Μετεωρολογικός σταθμός S2120', 's2120_soil': 'Σταθμός + έδαφος'}
subsys = []
for name, tags in subcfg.items():
    kind = tags.get('pricingType', name)
    for k, v in tags.items():
        if k in ('subscriptionConfiguration', 'pricingType'): continue
        try: pv = float(v)
        except Exception: continue
        subsys.append({'k': k, 'n': NAMES.get(k, k), 'p': pv, 'src': 'TagoIO · ' + kind})
for x in IT:
    if x[1] == 'Συνδρομές': subsys.append({'k': x[0], 'n': x[5], 'p': x[4], 'src': 'Τιμοκατάλογος · ' + x[3]})
catpk = []
for p in pk:
    its = [{'q': i['q'], 'n': (bysku.get(i['sku']) or [i['sku']] * 6)[5], 'p': (bysku.get(i['sku']) or [0] * 6)[4]} for i in p.get('it', [])]
    catpk.append({'n': p['n'], 'it': its, 'sum': sum(i['q'] * (i['p'] or 0) for i in its)})
data = {'IT': IT, 'MAP': MAP, 'SUBSYS': subsys, 'CATPK': catpk, 'u': head['u']}
JS = r"""(function(){const D=__DATA__;
const sp=v=>v==='AGROHUM'?'SA':'SC';const mfOf=x=>/^CyRIC/.test(x[3])?(/Milesight|EM320/i.test(x[0]+x[5])?'Milesight':'CyRIC IoT'):x[3];const pr=c=>c?Math.round(c*(1+MARKUP)*100)/100:0;
const G={Καιρός:'Αισθητήρες',Έδαφος:'Αισθητήρες',Φυτό:'Αισθητήρες',Κλίμα:'Αισθητήρες',Άρδευση:'Ελεγκτές & Διεπαφές',Αυτοματισμός:'Ελεγκτές & Διεπαφές',Πύλες:'Πύλες Δικτύου (Gateways)',Υλικά:'Υλικά εγκατάστασης',Άλλο:'Άλλο'};
const by={};D.IT.forEach(x=>by[x[0]]=x);const used=new Set();
for(const p of EQ){p.cost=null;const sku=D.MAP[p.k];const x=sku&&by[sku];if(x){used.add(sku);p.sku=sku;p.n=x[5];p.cost=x[4]||null;p.price=pr(x[4]);p.mf=mfOf(x);p.sup=sp(x[3]);p.grp=x[1];p.app=x[2]}else{p.grp=p.k==='meter'?'Μετρητές':(G[p.grp]||p.grp);p.price=0;p.app=p.k==='kit'||p.k==='solar'?'Υλικό εγκατάστασης (πλασματικό)':'Εκτός τιμοκαταλόγου · υπάρχει στο TagoIO'}}
const tt=s=>/101990961/.test(s)?'s2120':/^SE0|^SE01|^SE02/.test(s)?'se0x':/LMS01/.test(s)?'lms01_ls':/SPH01/.test(s)?'sph01':/EM320/.test(s)?'em320_th':/EM300/.test(s)?'em300_th':/UC511/.test(s)?'uc511':/UC501/.test(s)?'uc501':/WS558/.test(s)?'ws558':'—';
let i=0;for(const x of D.IT){if(used.has(x[0])||x[1]==='Συνδρομές')continue;EQ.push({k:'c'+(i++),sku:x[0],n:x[5],tt:x[1].startsWith('Πύλες')?'gateway':tt(x[0]),mf:mfOf(x),sup:sp(x[3]),cost:x[4]||null,price:pr(x[4]),min:0,grp:x[1],app:x[2],kind:'eq'})}
const IR=[[/^LMS01/,'lms01'],[/^SE01/,'se01'],[/^SE02|^SE0X/,'se0x'],[/SPH01/,'sph01'],[/^EM320/,'em320'],[/^EM300/,'em300'],[/^UC511|^UC512/,'uc511'],[/^UC50/,'uc501'],[/^WS558-/,'ws558'],[/^SG50/,'sg50'],[/^PDTIOT-ISS/,'istation'],[/^PDTIOT-IFE/,'ifemto'],[/^DLOS8N/,'dlos8n'],[/^LPS8N/,'lps8n']];for(const p of EQ){if(!p.img&&p.sku){const r=IR.find(z=>z[0].test(p.sku));if(r)p.img=IMG[r[1]]||null}}window.SUBSYS=D.SUBSYS;window.CATPK=D.CATPK;window.CATU=D.u;})();"""
s = open(os.path.join(ROOT, 'reports/demo/kentro_diaxeirisis_demo.html'), encoding='utf-8').read()
a, b = '/*@@REAL*/', '/*@@REAL_END*/'
assert s.count(a) == 1 and s.count(b) == 1
s = s.split(a)[0] + a + JS.replace('__DATA__', json.dumps(data, ensure_ascii=False)) + b + s.split(b)[1]
for x, y in [('DEMO · πλασματικά ποσά', 'ΙΔΙΩΤΙΚΟ · πραγματικά κόστη αγοράς, πλασματικές συναλλαγές'), ('<title>SAG ERP · CRM</title>', '<title>SAG ERP · CRM (ιδιωτικό)</title>'), ('Στο δημόσιο demo τα ποσά είναι πλασματικά.', 'Κόστη: ο πραγματικός τιμοκατάλογος του Δημιουργία Προσφοράς.')]:
    assert s.count(x) == 1; s = s.replace(x, y)
out = os.path.join(ROOT, 'reports/demo/private'); os.makedirs(out, exist_ok=True)
open(os.path.join(out, 'kentro_diaxeirisis_PRAGMATIKOS_TIMOKATALOGOS.html'), 'w', encoding='utf-8', newline='\n').write(s)
open(os.path.join(SP, 'demo_private.js'), 'w', encoding='utf-8').write(re.search(r'<script>(.*)</script>', s, re.S).group(1))
print('ok · είδη', len(IT), '· συνδρομές', len(subsys), '· πακέτα', len(catpk), '· αντιστοιχίσεις', len(MAP))
print('χωρίς τιμή', sum(1 for x in IT if not x[4]), '· διπλά', [x[0] for x in IT if x[0].endswith('_COPY') or x[0].endswith("'")])
