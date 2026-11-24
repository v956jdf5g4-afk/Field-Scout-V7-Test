'use strict';

// Exercise a synthetic handoff through the draft's field and backup validators.
// The account transport and device storage are in-memory fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const yearFunctions = html.slice(html.indexOf('const UNCONFIRMED_CROP='), html.indexOf('function fieldAcresLabel('));
const recordValidator = html.split('\n').find(line => line.startsWith('function validRecord('));
const rosterValidator = html.slice(html.indexOf("const restoredRosterKey="), html.indexOf('function transaction('));
const backupValidator = html.slice(html.indexOf(' function checkFullBackup('), html.indexOf(' restoreFile.onchange='));
assert.ok(yearFunctions && recordValidator && backupValidator);

const roster = [
  ['TEST1', 'Sample North', 80, 'Corn', 'SAMPLE'],
  ['TEST2', 'Sample South', 40, 'Soybeans', 'SAMPLE'],
];
const note = {
  id: 'synthetic-visit', fieldId: 'TEST1', cropYear: 2026,
  createdAt: '2026-07-01T12:00:00Z', text: 'Sample visit',
  fieldSnapshot: {name: 'Sample North', crop: 'Corn', acres: 80, operator: 'SAMPLE'},
};
const annual = {'2027|TEST1': {crop: 'Spring wheat', acres: 78, confirmed: true}};
const accounts = new Map([['sample-owner', roster]]);
const downloadRoster = user => structuredClone(accounts.get(user) ?? null);
const runBackup = (backup, fields, transaction, operation = 'checkFullBackup') => {
  const context = vm.createContext({backup, fields, transaction});
  vm.runInContext('const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);\n' +
    rosterValidator + '\n' + recordValidator + '\n' + backupValidator, context);
  return vm.runInContext(operation + '(backup)', context);
};

assert.equal(downloadRoster(null), null);
assert.equal(downloadRoster('sample-other'), null);
const device = new Map();
device.set('roster', downloadRoster('sample-owner'));
device.set('annual', annual);
device.set('notes', [note]);

// Reopen using only local data and the app's existing crop-year lookup.
accounts.clear();
const offline = vm.createContext({
  fields: device.get('roster'), annual: device.get('annual'),
  fieldIdentity: {}, fieldIdentityHistory: {}, cropYear: 2026,
});
vm.runInContext(yearFunctions, offline);
assert.equal(vm.runInContext('JSON.stringify(yearFields()[0])', offline),
  JSON.stringify(['TEST1', 'Sample North', 80, 'Corn', 'SAMPLE']));
offline.cropYear = 2027;
assert.equal(vm.runInContext('JSON.stringify(yearFields()[0])', offline),
  JSON.stringify(['TEST1', 'Sample North', 78, 'Spring wheat', 'SAMPLE']));
assert.equal(vm.runInContext('yearFields()[1][3]', offline), 'Unconfirmed');
assert.deepEqual(device.get('notes'), [note]);

const backup = JSON.parse(JSON.stringify({
  format: 'FieldScoutV71FullDeviceBackup', version: 1,
  staticFields: device.get('roster'), notes: device.get('notes'),
  settings: [{key: 'annual-test-fixture', value: device.get('annual')}],
}));
assert.deepEqual(runBackup(backup, device.get('roster')).notes, [note]);
assert.deepEqual(runBackup(backup, []).notes, [note]);
const mismatch = structuredClone(backup);
mismatch.staticFields[0][0] = 'OTHER';
assert.throws(() => runBackup(mismatch, device.get('roster')), /Field list differs/);
console.log('PASS: simulated owner roster handoff and offline reopen preserve field IDs, annual crops and historical notes.');
for (const [rows, pattern] of [
  [[roster[0], roster[0]], /duplicate field/],
  [[['TEST1', 'Sample North', -1, 'Corn', 'SAMPLE']], /Invalid or duplicate field/],
  [[roster[1]], /Invalid or duplicate scouting note/],
]) {
  assert.throws(() => runBackup({...backup, staticFields: rows}, []), pattern);
}
assert.throws(() => runBackup({...backup, settings: [
  {key:'v7-restored-roster-v1',value:mismatch.staticFields},
]}, []), /Invalid or duplicate setting/);

function simulatedDevice() {
  const data = {notes:new Map(), settings:new Map()};
  const transaction = (stores, mode, work) => {
    assert.ok(stores.includes('settings'));
    assert.equal(mode, 'readwrite');
    const staged = Object.fromEntries(stores.map(store => [store, new Map(data[store])]));
    const count = {result: staged.notes?.size};
    const requests = [];
    let aborted = false;
    work({
      abort() { aborted = true; },
      objectStore(name) {
        const rows = staged[name];
        return {
          clear: () => rows.clear(),
          put: item => rows.set(item.id ?? item.key, item),
          get: key => { const req = {result: rows.get(key)}; requests.push(req); return req; },
          count: () => count,
        };
      },
    });
    for (const request of requests) request.onsuccess?.();
    count.onsuccess?.();
    if (aborted) throw Error('Transaction aborted');
    Object.assign(data, staged);
  };
  return {data, transaction};
}
const blank = simulatedDevice();
runBackup(backup, [], blank.transaction, 'restoreFullBackup');
assert.deepEqual(blank.data.settings.get('v7-restored-roster-v1').value, roster);
assert.deepEqual(blank.data.settings.get('annual-test-fixture').value, annual);
assert.deepEqual(blank.data.notes.get(note.id), note);
assert.throws(() => runBackup(backup, [], blank.transaction, 'restoreFullBackup'), /aborted/);
assert.deepEqual(blank.data.notes.get(note.id), note);
runBackup(backup, roster, blank.transaction, 'restoreFullBackup');
console.log('PASS: legacy JSON initializes a blank roster, rejects invalid data, and restores roster, annual settings, and notes in one simulated transaction.');

async function checkSignedInRoster() {
  const source = html.slice(html.indexOf('async function ensurePrivateRoster('), html.indexOf('async function runSync('));
  const device = simulatedDevice();
  let reads = 0;
  let reloads = 0;
  let activeUser = 'owner';
  let cloudRow = {data: roster};
  const query = {
    select: () => query,
    eq: (column, value) => {
      if (column === 'user_id') assert.equal(value, 'owner');
      return query;
    },
    maybeSingle: async () => { reads++; return {data: cloudRow}; },
  };
  const context = vm.createContext({
    fields: [], transaction: device.transaction,
    setting: async key => device.data.settings.get(key)?.value,
    client: {from: () => query, auth: {getSession: async () => ({data: {session: {user: {id: activeUser}}}})}},
    location: {reload: () => { reloads++; }},
  });
  vm.runInContext(rosterValidator + source, context);
  const install = user => vm.runInContext('ensurePrivateRoster(user)', Object.assign(context, {user}));
  await assert.rejects(install(null), /Sign in/);
  assert.equal(reads, 0);
  cloudRow = null;
  await assert.rejects(install('owner'), /not been set up/);
  cloudRow = {data: roster};
  activeUser = 'other';
  await assert.rejects(install('owner'), /account changed/);
  assert.equal(device.data.settings.size, 0);
  activeUser = 'owner';
  assert.equal(await install('owner'), false);
  assert.equal(reloads, 1);
  assert.deepEqual(device.data.settings.get('v7-restored-roster-v1').value, roster);
  context.fields = roster;
  await assert.rejects(install('other'), /belongs to another account/);
  assert.equal(await install('owner'), true);
  assert.equal(reads, 3);
  console.log('PASS: draft roster loader requires sign-in, validates owner, blocks account changes and reuses the installed roster.');
}
checkSignedInRoster().catch(error => { console.error(error); process.exitCode = 1; });
