/* Field-year soil tests and manual dry fertilizer blends. No automatic university recommendation. */
(() => {
 const prefix='fertility-v1:';
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
 const panel=el('details');panel.className='panel';panel.id='fertilityPanel';
 panel.innerHTML='<summary>Soil Tests &amp; Fertilizer Blends</summary><p id="ftContext"></p><label>Field <select id="ftField"></select></label><h3>Soil test</h3><form id="ftSoil"><label>Sample date <input id="ftDate" type="date" required></label><label>Lab/report reference <input id="ftLab" maxlength="200"></label><label>Previous crop <input id="ftPrev" maxlength="100"></label><label>Yield goal and units <input id="ftYield" maxlength="100"></label><div id="ftTests"></div><label>pH <input id="ftPH" type="number" min="0" max="14" step="any"></label><label>Organic matter (%) <input id="ftOM" type="number" min="0" max="100" step="any"></label><button>Save soil test</button></form><h3>Dry fertilizer blend</h3><p>Enter agronomist-reviewed targets in lb nutrient/ac. University recommendations are not enabled. This calculator does not account for previously applied fertilizer automatically.</p><form id="ftBlend"><label>Application method <select id="ftMethod"><option>Broadcast</option><option>Strip-till</option><option>Starter</option><option>Other</option></select></label><label>Pass / purpose <input id="ftPass" required maxlength="100" placeholder="e.g. Spring base fertilizer"></label><div id="ftTargets"></div><div id="ftProducts"></div><button type="button" id="ftAdd">Add product</button> <button type="button" id="ftPreview">Calculate</button> <button>Save blend</button></form><pre id="ftResult" style="white-space:pre-wrap"></pre><p id="ftStatus" role="status"></p><h3>Saved field-year history</h3><div id="ftHistory"></div>';
 $('cropYearFieldPlan').after(panel);
 const keys=['N','P2O5','K2O','S'];
 const field=$('ftField');let ticket=0,busy=false,loadedYear=null,loadedField=null;
 function input(label,type='text'){const l=el('label',label+' '),i=el('input');i.type=type;if(type==='number'){i.min='0';i.step='any'}l.append(i);return [l,i]}
 const tests=['Nitrate-N','P','K','S'].map(name=>{
  const row=el('fieldset');row.append(el('legend',name));const controls={};
  for(const [key,label,type] of [['value','Value','number'],['unit','Units','text'],['depth','Sample depth / units','text'],['method','Test method','text']]){const [l,i]=input(label,type);controls[key]=i;row.append(l)}
  $('ftTests').append(row);return {name,controls};
 });
 const targetInputs={};
 for(const k of keys){const [l,i]=input(k+' target (lb/ac)','number');i.required=true;targetInputs[k]=i;$('ftTargets').append(l)}
 const products=[];
 function addProduct(){
  const row=el('fieldset');row.append(el('legend','Dry product'));const controls={};
  for(const [key,label,type] of [['name','Product','text'],...keys.map(k=>[k,k+' (%)','number']),['rate','Product lb/ac','number'],['price','Price $/US ton (optional)','number']]){const [l,i]=input(label,type);i.required=key!=='price';controls[key]=i;row.append(l)}
  const item={row,controls};const remove=el('button','Remove product');remove.type='button';remove.onclick=()=>{products.splice(products.indexOf(item),1);row.remove();$('ftResult').textContent=''};row.append(remove);products.push(item);$('ftProducts').append(row);
 }
 $('ftAdd').onclick=addProduct;addProduct();$('ftDate').value=today();
 function scope(){const f=yearFields().find(f=>f[0]===field.value);if(!f||!fieldYearConfirmed(f[0])||loadedYear!==cropYear||loadedField!==f[0])throw Error('Select a confirmed field and wait for history to load.');return {fieldId:f[0],name:f[1],acres:f[2],crop:f[3],operator:f[4],year:cropYear}}
 function num(i,optional=false){if(!i.value.trim()){if(optional)return null;throw Error('Enter every numeric value; zero must be explicit.')}const v=Number(i.value);if(!Number.isFinite(v)||v<0)throw Error('Invalid numeric input');return v}
 function blend(){const ctx=scope();if(!products.length)throw Error('Add a fertilizer product');const targets=Object.fromEntries(keys.map(k=>[k,num(targetInputs[k])]));const rows=products.map(({controls:c})=>({name:c.name.value.trim(),rate:num(c.rate),price:num(c.price,true),...Object.fromEntries(keys.map(k=>[k,num(c[k])]))}));return {ctx,targets,calculation:window.FieldScoutBlend.calculate(ctx.acres,targets,rows),method:$('ftMethod').value,pass:$('ftPass').value.trim()}}
 function result(b){const c=b.calculation,fmt=v=>v.toLocaleString(undefined,{maximumFractionDigits:3});$('ftResult').textContent=[...c.rows.map(r=>r.name+': '+fmt(r.rate)+' lb/ac, '+fmt(r.tons)+' US tons/field'),...keys.map(k=>k+': '+fmt(c.totals[k])+' lb/ac; '+(c.balance[k]<0?'shortfall ':'excess ')+fmt(Math.abs(c.balance[k]))),'Cost: '+(c.cost===null?'Incomplete pricing':'$'+fmt(c.costPerAcre)+'/ac; $'+fmt(c.cost)+' field total')].join('\n')}
 $('ftPreview').onclick=()=>{try{result(blend());$('ftStatus').textContent='Calculated from entered targets only.'}catch(e){$('ftStatus').textContent=e.message;$('ftResult').textContent=''}};
 async function refresh(){
  if(!panel.open||!ready)return;const t=++ticket,year=cropYear,prev=field.value;
  const fs=yearFields().filter(f=>fieldYearConfirmed(f[0]));
  field.replaceChildren(...fs.map(f=>Object.assign(el('option',f[0]+' — '+f[1]),{value:f[0]})));if(fs.some(f=>f[0]===prev))field.value=prev;
  const selected=field.value;loadedYear=null;loadedField=null;
  $('ftContext').textContent='Crop year '+year+' · confirmed fields only';
  try{const settings=await getAll('settings');if(t!==ticket||year!==cropYear||selected!==field.value)return;
   const history=settings.filter(r=>r.key.startsWith(prefix)&&r.value?.ctx?.year===year&&r.value.ctx.fieldId===selected).map(r=>r.value).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
   $('ftHistory').replaceChildren(...history.map(r=>{const d=el('details');d.append(el('summary',r.kind==='soil'?'Soil test · '+r.sampleDate:'Blend · '+r.method+' · '+r.pass),el('pre',JSON.stringify(r,null,2)));d.lastChild.style.whiteSpace='pre-wrap';return d}));if(!history.length)$('ftHistory').textContent='No saved soil tests or blends.';
   loadedYear=year;loadedField=selected;
  }catch(e){$('ftStatus').textContent='Could not load: '+e.message}
 }
 async function save(kind,payload){
  if(busy)return;busy=true;try{const id=crypto.randomUUID();await transaction(['settings'],'readwrite',tx=>tx.objectStore('settings').add({key:prefix+id,value:{id,kind,createdAt:new Date().toISOString(),...payload}}));$('ftStatus').textContent='Saved locally. Earlier records retained.';await refresh()}catch(e){$('ftStatus').textContent='Could not save: '+e.message}finally{busy=false}
 }
 $('ftSoil').onsubmit=e=>{e.preventDefault();try{const ctx=scope(),sampleDate=$('ftDate').value;if(!sampleDate)throw Error('Sample date required');const values=tests.map(({name,controls:c})=>({name,value:num(c.value,true),unit:c.unit.value.trim(),depth:c.depth.value.trim(),method:c.method.value.trim()}));if(!values.some(v=>v.value!==null))throw Error('Enter at least one test value');if(values.some(v=>v.value!==null&&(!v.unit||!v.depth||!v.method)))throw Error('Each entered test needs units, depth and method.');void save('soil',{ctx,sampleDate,lab:$('ftLab').value.trim(),previousCrop:$('ftPrev').value.trim(),yieldGoal:$('ftYield').value.trim(),pH:num($('ftPH'),true),organicMatter:num($('ftOM'),true),values})}catch(e){$('ftStatus').textContent=e.message}};
 $('ftBlend').onsubmit=e=>{e.preventDefault();try{const b=blend();if(!b.pass)throw Error('Enter the pass / purpose');result(b);void save('blend',b)}catch(e){$('ftStatus').textContent=e.message}};
 panel.addEventListener('toggle',refresh);field.onchange=()=>{$('ftResult').textContent='';void refresh()};window.addEventListener('fieldscout:field-context',refresh);window.addEventListener('fieldscout:settings-downloaded',refresh);
})();
