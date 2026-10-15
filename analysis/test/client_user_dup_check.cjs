// T-USER-DUP-01 check: node analysis/test/client_user_dup_check.cjs analysis/createClient.js client_dup   (cases: user_existing|user_other_client|user_new|client_dup|client_email_of_user|client_new)
// Runs an analysis file with a mocked @tago-io/sdk + fetch. Usage: node harness.js <file> <case>
const Module = require('module'); const path = require('path');
const [file, cas] = process.argv.slice(2);
const DB = { // what TagoIO returned live on 15/10 for these lookups
  clientsByEmail: { 'ammoudares@gmail.com': [{ id: '6acf61f5acb06c000c28ce95', name: 'Νικολουδάκης Μιχάλης ' }] },
  runUsers: { 'ammoudares@gmail.com': { id: '6acf61f6788a95000b23b3e6', name: 'Νικολουδάκης Μιχάλης ', email: 'ammoudares@gmail.com', tags: [{ key: 'access', value: 'ammoudares@gmail.com' }, { key: 'isUser', value: 'yes' }] },
              'other@x.gr': { id: 'u2', name: 'Άλλος', email: 'other@x.gr', tags: [{ key: 'access', value: 'Βασσάλος' }] } },
  policies: { 'ammoudares@gmail.com': { id: '6acf61f6a3025d000c56df2e', name: 'ammoudares@gmail.com' } },
};
const created = [];
global.fetch = async (url, opt = {}) => {
  const u = new URL(url); let body;
  if (u.pathname === '/run/users') { const e = u.searchParams.get('filter[email]'); body = { status: true, result: DB.runUsers[e] ? [{ id: DB.runUsers[e].id, name: DB.runUsers[e].name, email: e }] : [] }; }
  else if (u.pathname.startsWith('/run/users/')) { const id = u.pathname.split('/').pop(); body = { status: true, result: Object.values(DB.runUsers).find((x) => x.id === id) }; }
  else if (u.pathname === '/am' && (opt.method || 'GET') === 'GET') { if (!u.searchParams.get('orderBy')) body = { status: false, message: 'Invalid orderBy parameter' }; else { const n = u.searchParams.get('filter[name]'); body = { status: true, result: DB.policies[n] ? [DB.policies[n]] : [] }; } }
  else if (u.pathname.startsWith('/am/')) body = { status: true, result: { name: 'chris-kamp@hotmail.com', targets: [], permissions: [] } };
  else if (u.pathname === '/am') { created.push('POLICY'); body = { status: true, result: { am_id: 'newam' } }; }
  return { json: async () => body };
};
const sdk = {
  Account: class { constructor() {
    this.devices = {
      list: async (q) => { const e = (q.filter.tags.find((t) => t.key === 'email') || {}).value; return DB.clientsByEmail[e] || []; },
      create: async () => { created.push('DEVICE'); return { device_id: 'newdev', token: 'SECRET-TOKEN' }; },
      info: async (id) => id === 'newdev' ? { tags: [] } : { name: 'Νικολουδάκης Μιχάλης ', tags: [{ key: 'access', value: 'ammoudares@gmail.com' }] },
      edit: async () => ({}),
    };
    this.run = { userCreate: async (d) => { if (DB.runUsers[d.email]) throw new Error('Email already exists'); created.push('USER'); return { user: 'newuser' }; } };
  } },
  Resources: { devices: { sendDeviceData: async (_, d) => console.log(`  → ΦΟΡΜΑ [${d.metadata.type}] ${d.value}`) } },
  Analysis: class { constructor(fn) { this.fn = fn; } },
};
const orig = Module._load; Module._load = function (r, ...a) { return r === '@tago-io/sdk' ? sdk : orig.call(this, r, ...a); };
const an = require(path.resolve(file));
const CASES = {
  user_existing: [{ variable: 'client', value: '6acf61f5acb06c000c28ce95' }, { variable: 'user_name', value: 'Ν' }, { variable: 'user_email', value: 'Ammoudares@gmail.com ' }],
  user_other_client: [{ variable: 'client', value: '6acf61f5acb06c000c28ce95' }, { variable: 'user_name', value: 'Ν' }, { variable: 'user_email', value: 'other@x.gr' }],
  user_new: [{ variable: 'client', value: '6acf61f5acb06c000c28ce95' }, { variable: 'user_name', value: 'Νέος' }, { variable: 'user_email', value: 'new@x.gr' }],
  client_dup: [{ variable: 'name', value: 'Νικολουδάκης Μιχάλης ' }, { variable: 'vat', value: '124043869' }, { variable: 'tab', value: 'Ν' }, { variable: 'email', value: 'ammoudares@gmail.com' }, { variable: 'phone', value: '1' }],
  client_email_of_user: [{ variable: 'name', value: 'Νέος πελάτης' }, { variable: 'vat', value: '1' }, { variable: 'tab', value: 'Ν' }, { variable: 'email', value: 'other@x.gr' }, { variable: 'phone', value: '1' }],
  client_new: [{ variable: 'name', value: 'Νέος πελάτης' }, { variable: 'vat', value: '1' }, { variable: 'tab', value: 'Ν' }, { variable: 'email', value: 'fresh@x.gr' }, { variable: 'phone', value: '1' }],
};
const logs = []; const ol = console.log; console.log = (...a) => { const s = a.map(String).join(' '); logs.push(s); if (s.startsWith('  →')) ol(s); };
an.fn({ environment: [{ key: 'ACCOUNT_TOKEN', value: 'T' }] }, CASES[cas]).then(() => {
  console.log = ol; console.log(`  δημιουργήθηκαν: [${created.join(', ') || '—'}]`);
  if (logs.some((l) => l.includes('SECRET-TOKEN'))) console.log('  ✗ ΤΟ TOKEN ΓΡΑΦΤΗΚΕ ΣΤΟ LOG');
});
