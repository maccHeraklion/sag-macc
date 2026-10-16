// T-GW-OUI-01 check: node analysis/test/add_device_gateway_eui_check.cjs analysis/addGateway.js milesight sg50 C0BA1FFFFE054786
const Module = require('module'); const path = require('path');
const [file, manufacturer, type, eui] = process.argv.slice(2);
const created = [];
const sdk = {
  Analysis: class { constructor(fn) { this.fn = fn; } },
  Account: class { constructor() { this.devices = { create: async (d) => { created.push(d.name + ' (serial ' + d.serie_number + ')'); return {}; } }; } },
  Resources: {},
  Device: class { constructor() {} async sendData(d) { console.log(`  → ΦΟΡΜΑ [${d.metadata.color}] ${d.value}`); } },
  Utils: { getTokenByName: async () => 'T' },
};
const orig = Module._load; Module._load = function (r, ...a) { return r === '@tago-io/sdk' ? sdk : orig.call(this, r, ...a); };
const an = require(path.resolve(file));
const ol = console.log; console.log = (...a) => { const s = a.join(' '); if (s.startsWith('  →')) ol(s); };
console.error = () => {};
an.fn({ environment: [{ key: 'ACCOUNT_TOKEN', value: 'T' }] }, [{ device: 'formdev', variable: 'manufacturer', value: manufacturer }, { variable: 'type', value: type }, { variable: 'eui', value: eui }, { variable: 'appeui', value: '0' }, { variable: 'appkey', value: '0' }])
  .then(() => { console.log = ol; console.log(`  δημιουργήθηκε: ${created.join(', ') || '—'}`); });
