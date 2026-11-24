const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const html = read('index.html');
const rows = [['A','Field A',50,'Corn','F'], ['B','Field B',30,'Corn','F'], ['C','Field C',20,'Corn','F']];
function line(name) {
  return html.split('\n').find(l => l.startsWith(name));
}
const spraySource = ['const qtyBase=', 'const packBase=', 'const displayQty=', 'function calculate()', 'function productTable(','function orderHtml(']
  .map(line).join('\n');
const spray = vm.createContext({
  S: id => ({value:id==='sprayFarmer'?'F':'Corn'}),
  year:()=>2026, yearFields:()=>rows, fieldYearConfirmed:id=>id!=='C',
  getRecipe:id=>recipes[id], resolveRecipe:f=>f[0], structuredClone,
  fmt: n => Number(n).toLocaleString('en-US',{maximumFractionDigits:3}),
  farmerNames:{F:'Farmer'}, esc:String,
});
const recipes = {
  A:{id:'A',name:'First',crop:'Corn',gpa:10,lines:[
    {name:'Example liquid',rate:32,unit:'fl oz/ac',packSize:2.5,packUnit:'gal'},
    {name:'Example weight',rate:16,unit:'oz wt/ac',packSize:25,packUnit:'lb'}]},
  B:{id:'B',name:'Second',crop:'Corn',gpa:20,lines:[
    {name:'Example liquid',rate:16,unit:'fl oz/100 gal',packSize:2.5,packUnit:'gal'},
    {name:'Example weight',rate:0.1,unit:'lb/100 gal',packSize:25,packUnit:'lb'}]},
};
recipes.C = recipes.A;
vm.runInContext(spraySource, spray);
const order = vm.runInContext('calculate()',spray);
assert.equal(order.groups.length,2);
assert.equal(order.groups.reduce((sum,g)=>sum+g.acres,0),80);
assert.equal(order.totals.find(p=>p.kind==='volume').base,1696);
assert.equal(order.totals.find(p=>p.kind==='weight').base,809.6);
const printed = vm.runInContext('orderHtml(order)',Object.assign(spray,{order}));
assert.match(printed,/6 × 2.5 gal/);
assert.match(printed,/3 × 25 lb/);
rows[0][2]=200;
recipes.A.lines[0].rate=100;
assert.equal(order.groups[0].fields[0].acres,50);
assert.equal(order.groups[0].recipe.lines[0].rate,32);
console.log('PASS: actual spray calculation mixed units, confirmation gate, farmer totals, package rounding and frozen recipe/acre calculation snapshot');

const plan = read('field-plan.js');
const model = plan.slice(plan.indexOf('  function historyFor('),plan.indexOf('  function describe('));
const a={id:'one',type:'fall',targets:[{fieldId:'A',previous:[]},{fieldId:'B',previous:[]}]};
const b={id:'two',type:'fall',targets:[{fieldId:'A',previous:['one']}]};
const c={id:'three',type:'fall',targets:[{fieldId:'A',previous:['one']}]};
const d={id:'four',type:'fall',targets:[{fieldId:'A',previous:['two','three']}]};
const fieldPlan = vm.createContext({a,b,c,d});
vm.runInContext(model,fieldPlan);
const heads = (entries,id) => vm.runInContext(`headsFor(historyFor([${entries}],'${id}','fall'),'${id}').map(entry=>entry.id).join(',')`,fieldPlan);
assert.equal(heads('a,b,c','A'),'two,three');
assert.equal(heads('a,b,c,d','A'),'four');
assert.equal(heads('a,b,c,d','B'),'one');
console.log('PASS: bulk history remains field-specific and simultaneous revisions remain visible until corrected');

const handlers = {};
let keys = ['legacy','field-scout:https://local/test/:older','field-scout:https://local/production/:older'];
const values = new Map();
let offline = false;
const cache = {
  addAll: async files => {for(const f of files)values.set(f,new Response(f));},
  match: async request => values.get(request.url || request),
  put: async (request,response) => values.set(request.url,response),
};
const sandbox = {Response, self:{registration:{scope:'https://local/test/'},clients:{claim:()=>{}},addEventListener:(name,fn)=>{handlers[name]=fn}}, caches:{
  open: async()=>cache, keys:async()=>keys, delete:async key=>{keys=keys.filter(x=>x!==key)}
},fetch:async()=>{if(offline)throw Error('offline');return new Response('network')}};
vm.runInNewContext(read('sw.js'),sandbox);
(async()=>{
  let pending;
  handlers.install({waitUntil: promise=>{pending=promise}});
  await pending;
  assert.ok(values.has('./field-plan.js?v=7.4.0-dev'));
  handlers.activate({waitUntil: promise=>{pending=promise}});
  await pending;
  assert.deepEqual(keys,['legacy','field-scout:https://local/production/:older']);
  offline=true;
  handlers.fetch({request:{method:'GET',mode:'navigate',url:'https://local/test/'},respondWith:p=>{pending=p}});
  assert.equal(await (await pending).text(),'./index.html');
  console.log('PASS: planner asset precached, test cache cleanup isolated by scope, offline navigation falls back to cached HTML');
})().catch(error=>{console.error(error);process.exitCode=1});
