'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('index.html');
const configuredURL = /^const URL='([^']+)';$/m;
const configuredKey = /^const KEY='([^']+)';$/m;
const roster = /^const fields=\[.*\];$/m;
const farmers = /const farmerNames=\{[^\n]*?\};/;
const {FIELD_SCOUT_QA_URL, FIELD_SCOUT_QA_PUBLIC_KEY} = process.env;
const sample = process.argv.includes('--sample');
const suffix=sample?'sample-rc1':'recovery-rc1';
assert.ok(!sample || !FIELD_SCOUT_QA_URL, 'Sample build must remain cloud-disabled');
assert.equal(Boolean(FIELD_SCOUT_QA_URL), Boolean(FIELD_SCOUT_QA_PUBLIC_KEY),
  'Provide both the isolated QA origin and publishable key, or neither.');
for (const marker of [configuredURL, configuredKey, roster, farmers]) {
  assert.ok(marker.test(source), 'Draft source changed. Check the QA substitutions.');
}

let endpoint = '';
let publicKey = '';
if (FIELD_SCOUT_QA_URL) {
  const url = new URL(FIELD_SCOUT_QA_URL);
  assert.ok(url.protocol === 'https:' && url.href === url.origin + '/',
    'Use an HTTPS origin for the separate QA backend.');
  assert.notEqual(url.origin, new URL(configuredURL.exec(source)[1]).origin,
    'The configured Field Scout backend cannot be used for QA.');
  assert.match(FIELD_SCOUT_QA_PUBLIC_KEY, /^sb_publishable_[\w-]+$/,
    'Use a publishable key for the separate QA backend.');
  endpoint = url.origin;
  publicKey = FIELD_SCOUT_QA_PUBLIC_KEY;
}

const html = source
  .replace(roster, sample ? 'const fields=[["TEST1","Sample North",80,"Corn","SAMPLE"],["TEST2","Sample South",40,"Corn","SAMPLE"],["TEST3","Sample Wheat",65,"Spring wheat","SAMPLE2"],["TEST4","Sample Soybeans",55,"Soybeans","SAMPLE2"]];' : 'const fields=[];')
  .replace(farmers, "const farmerNames={SAMPLE:'Sample Farmer',SAMPLE2:'Second Sample Farmer'};")
  .replace(configuredURL, () => 'const URL=' + JSON.stringify(endpoint) + ';')
  .replace(configuredKey, () => 'const KEY=' + JSON.stringify(publicKey) + ';')
  .replace("if(client||initializingCloud||!navigator.onLine)return;",
    "if(!URL){status('Cloud disabled for this synthetic build.');return}\n if(client||initializingCloud||!navigator.onLine)return;")
  .replaceAll('FieldScoutOfflineV7Test', 'FieldScoutPrivateRosterQA-'+suffix)
  .replaceAll('FieldScoutV7RecoverySnapshots', 'FieldScoutPrivateRosterQA-Snapshots-'+suffix)
  .replaceAll('fieldscout_prototype_notes_v1', 'fieldscout_private_roster_qa_notes_'+suffix)
  .replaceAll('fieldscout_v4_plan', 'fieldscout_private_roster_qa_plan_'+suffix)
  .replaceAll('fieldscout_last_backup_v2', 'fieldscout_private_roster_qa_backup_'+suffix)
  .replaceAll('fs-last-field','fs-last-field-'+suffix)
  .replace('Version 7.4.0-rc1 · Review build',sample?'Version 7.4.0-rc1 · SAMPLE QA (cloud disabled)':'Version 7.4.0-rc1 · Isolated roster QA')
  .replace(/<link rel="apple-touch-icon"[^>]+>/, '')
  .replace(/<title>[^<]+<\/title>/, '<title>Field Scout Private Roster QA</title>');

assert.ok(html.includes("if(!URL){status("), 'Offline QA build lacks its cloud guard.');
assert.ok(!html.includes(configuredURL.exec(source)[1]) && !html.includes(configuredKey.exec(source)[1]));
assert.ok(!html.includes(roster.exec(source)[0]) && !html.includes(farmers.exec(source)[0]));
for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);

const manifest = JSON.parse(read('manifest.webmanifest'));
manifest.name = 'Field Scout Private Roster QA';
manifest.short_name = 'Roster QA';
delete manifest.icons;
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'field-scout-roster-qa-'));
const worker = read('sw.js').replace(/const CACHE = PREFIX \+ '[^']+';/, "const CACHE = PREFIX + 'private-roster-qa-"+suffix+"';");
for (const [file, contents] of Object.entries({
  'index.html': html,
  'field-plan.js': read('field-plan.js'),
  'farmer-notes.js': read('farmer-notes.js'),
  'fertilizer-blend.js': read('fertilizer-blend.js'),
  'fertility-recommendations.js': read('fertility-recommendations.js'),
  'fertility-ui.js': read('fertility-ui.js'),
  'manifest.webmanifest': JSON.stringify(manifest, null, 2),
  'sw.js': worker,
})) fs.writeFileSync(path.join(directory, file), contents);
console.log(directory);
