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
const readBackup = (backup, fields) => {
  const context = vm.createContext({backup, fields});
  vm.runInContext('const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);\n' +
    recordValidator + '\n' + backupValidator, context);
  return vm.runInContext('checkFullBackup(backup)', context);
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
assert.deepEqual(readBackup(backup, device.get('roster')).notes, [note]);
assert.throws(() => readBackup(backup, []), /Field list differs/);
const mismatch = structuredClone(backup);
mismatch.staticFields[0][0] = 'OTHER';
assert.throws(() => readBackup(mismatch, device.get('roster')), /Field list differs/);
console.log('PASS: simulated owner roster handoff and offline reopen preserve field IDs, annual crops and historical notes.');
console.log('PASS: existing JSON validator accepts the matching roster and rejects a fresh install or a different roster.');
