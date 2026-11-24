'use strict';

// Run against an isolated Supabase project with the Field Scout schema and
// two disposable signed-in user tokens. Never point this at the app backend.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');

async function main() {
  const {FIELD_SCOUT_QA_URL, FIELD_SCOUT_QA_PUBLIC_KEY, FIELD_SCOUT_QA_OWNER_TOKEN,
    FIELD_SCOUT_QA_OTHER_TOKEN} = process.env;
  assert.ok(FIELD_SCOUT_QA_URL && FIELD_SCOUT_QA_PUBLIC_KEY && FIELD_SCOUT_QA_OWNER_TOKEN &&
    FIELD_SCOUT_QA_OTHER_TOKEN, 'An isolated QA URL, publishable key and two disposable user tokens are required.');

  const base = new URL(FIELD_SCOUT_QA_URL);
  assert.ok(['https:', 'http:'].includes(base.protocol) && !base.username && !base.password &&
    base.pathname === '/' && !base.search && !base.hash, 'Use the isolated project origin.');
  assert.ok(base.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname),
    'Remote QA projects require HTTPS.');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const configured = html.match(/const URL='(https:\/\/[^']+)'/);
  assert.ok(configured, 'Could not identify the app backend to exclude it from QA.');
  assert.notEqual(base.origin, new URL(configured[1]).origin, 'Refusing to run against the app backend.');
  assert.ok(FIELD_SCOUT_QA_PUBLIC_KEY.startsWith('sb_publishable_') ||
    jwtClaims(FIELD_SCOUT_QA_PUBLIC_KEY).role === 'anon', 'Use a publishable or legacy anon key.');
  for (const token of [FIELD_SCOUT_QA_OWNER_TOKEN, FIELD_SCOUT_QA_OTHER_TOKEN]) {
    const claims = jwtClaims(token);
    assert.ok(claims.role === 'authenticated' && claims.sub, 'Use signed-in disposable user tokens.');
  }

  async function request(relative, token, body) {
    const headers = {apikey: FIELD_SCOUT_QA_PUBLIC_KEY};
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body) headers['Content-Type'] = 'application/json';
    const result = await fetch(new URL(relative, base), {
      headers, method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined,
      redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    return {ok: result.ok, status: result.status, data: await result.json()};
  }

  const owner = await request('/auth/v1/user', FIELD_SCOUT_QA_OWNER_TOKEN);
  const other = await request('/auth/v1/user', FIELD_SCOUT_QA_OTHER_TOKEN);
  assert.ok(owner.ok && other.ok && owner.data.id && other.data.id &&
    owner.data.id !== other.data.id, 'Both tokens must resolve to different QA users.');

  // A unique settings key exercises the same row policies and save function
  // without occupying the reserved private-roster key.
  const key = 'v7-qa-roster-' + randomUUID();
  const roster = [['TEST1', 'Sample North', 80, 'Corn', 'SAMPLE']];
  const save = await request('/rest/v1/rpc/field_scout_save', FIELD_SCOUT_QA_OWNER_TOKEN, {
    p_category: 'setting', p_record_key: key, p_data: roster, p_expected_revision: 0,
  });
  assert.ok(save.ok, 'Owner save failed with HTTP ' + save.status);

  const query = new URLSearchParams({select: 'data', category: 'eq.setting',
    record_key: 'eq.' + key, user_id: 'eq.' + owner.data.id});
  const route = '/rest/v1/field_scout_sync?' + query;
  const allowed = await request(route, FIELD_SCOUT_QA_OWNER_TOKEN);
  assert.ok(allowed.ok, 'Owner read failed with HTTP ' + allowed.status);
  assert.deepEqual(allowed.data, [{data: roster}], 'Owner should see the exact roster.');

  const denied = await request(route, FIELD_SCOUT_QA_OTHER_TOKEN);
  assert.ok(denied.ok, 'Second-account read failed with HTTP ' + denied.status);
  assert.ok(Array.isArray(denied.data) && denied.data.length === 0,
    'Second account can see the owner roster.');

  const anonymous = await request(route, null);
  assert.ok([401, 403].includes(anonymous.status) ||
    (anonymous.ok && Array.isArray(anonymous.data) && anonymous.data.length === 0),
  'Signed-out request was not denied or returned rows.');
  console.log('PASS: owner saved and read a synthetic roster. Signed-out and second-account reads exposed no rows.');
}

function jwtClaims(token) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url')); }
  catch { return {}; }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
