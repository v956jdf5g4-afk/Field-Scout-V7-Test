// Run with: node --test tests/roster-store.test.cjs
// Synthetic examples only: never commit real farmer/field data.
const test=require('node:test');
const assert=require('node:assert/strict');
const r=require('../roster-store.js');
const sample=[['T01','Synthetic North',160,'Corn','DEMO'],['T02','Synthetic South',80,'Soybeans','DEMO']];
test('validates and preserves stable field identifiers and baseline',()=>{
  const v=r.snapshot(sample);assert.equal(v.baselineYear,2026);
  assert.deepEqual(r.validateSnapshot(v).fields,sample);
  assert.deepEqual(r.validateSnapshot(v).fields[0][0],'T01');
});
test('rejects empty, duplicate, malformed, and unconfirmed baseline rows',()=>{
  assert.throws(()=>r.validate([]));
  assert.throws(()=>r.validate([...sample,sample[0]]));
  assert.throws(()=>r.validate([['T01','Name',0,'Corn','DEMO']]));
  assert.throws(()=>r.validate([['T01','Name',NaN,'Corn','DEMO']]));
  assert.throws(()=>r.validate([['T01','Name',100,'','DEMO']]));
  assert.throws(()=>r.validateSnapshot({...r.snapshot(sample),version:2}));
});
test('compares field ID sets independently of sort order',()=>{
  assert.equal(r.idsMatch(sample,[...sample].reverse()),true);
  assert.equal(r.idsMatch(sample,[sample[0]]),false);
});
test('fresh local roster is saved and can be read offline',async()=>{
  const m=new Map(),read=async k=>m.get(k),write=async(k,v)=>m.set(k,v);
  const incoming=r.snapshot(sample);
  assert.equal((await r.reconcileLocal(read,write,incoming)).status,'saved');
  assert.deepEqual((await r.readLocal(read)).fields,sample);
  assert.equal((await r.reconcileLocal(read,write,incoming)).status,'unchanged');
});
test('conflicting remote roster never silently overwrites offline copy',async()=>{
  const m=new Map(),read=async k=>m.get(k),write=async(k,v)=>m.set(k,v);
  await r.saveLocal(write,r.snapshot(sample));
  const changed=sample.map(x=>[...x]);changed[0][2]=170;
  const result=await r.reconcileLocal(read,write,r.snapshot(changed));
  assert.equal(result.status,'review-required');
  assert.deepEqual((await r.readLocal(read)).fields,sample);
});
test('rejects unsupported local payload rather than showing misleading fields',async()=>{
  const read=async()=>({format:'unknown',fields:sample});
  await assert.rejects(()=>r.readLocal(read));
});
