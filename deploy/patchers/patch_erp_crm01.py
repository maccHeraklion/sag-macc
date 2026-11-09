# T-ERP-CRM-01 (9/11/2026): μητρώο πελατών με αποθήκευση στη σελίδα ERP + μενού μόνο με πραγματικές ενότητες μέσα στο TagoIO.
import sys, subprocess, re
P, BLOCK = sys.argv[1], sys.argv[2]
s = open(P, 'rb').read().decode('utf-8'); assert '\r\n' not in s
blk = open(BLOCK, 'rb').read().decode('utf-8').replace('\r\n', '\n')
def sub(old, new, cnt=1):
    global s
    n = s.count(old); assert n == cnt, (n, old[:80]); s = s.replace(old, new)
sub('</style>', '.alert.bad{background:var(--bad-bg);color:var(--bad)}.fld textarea{border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:8px 10px;font:inherit;resize:vertical;min-height:70px}\n.btn:disabled{opacity:.6;cursor:wait}\n</style>')
sub("NAV.map(([g,items])=>`<div class=\"grp\">", "navView().map(([g,items])=>`<div class=\"grp\">")
sub("+' · συναλλαγές από τη Φάση 2'}", "+(typeof REG!=='undefined'&&REG?' · μητρώο '+regAll().length+' καρτέλες':'')}")
sub("async function liveAll(src){await liveCatalog(src);liveFleet(src)}", blk + "\nasync function liveAll(src){await liveCatalog(src);liveFleet(src);await liveRegistry(src)}")
open(P, 'wb').write(s.encode('utf-8'))
# έλεγχος σύνταξης του κύριου script
m = re.findall(r'<script>([\s\S]*?)</script>', s)
open(P + '.check.js', 'w', encoding='utf-8').write(m[-1])
r = subprocess.run(['node', '--check', P + '.check.js'], capture_output=True, text=True)
print('node --check', r.returncode, r.stderr[:500])
