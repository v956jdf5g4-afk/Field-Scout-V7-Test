/* Field-year soil tests and manual dry fertilizer blends. Versioned limited regional recommendations. */
(() => {
 const prefix='fertility-v1:';
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
 const panel=el('details');panel.className='panel';panel.id='fertilityPanel';
 panel.innerHTML='<summary>Soil Tests &amp; Fertilizer Blends</summary><p id="ftContext"></p><button type="button" id="ftNewContext">Start a new entry for selected field/year</button><label>Field <select id="ftField"></select></label><h3>Soil test</h3><form id="ftSoil"><label>Sample date <input id="ftDate" type="date" required></label><label>Lab/report reference <input id="ftLab" maxlength="200"></label><label>Previous crop <input id="ftPrev" maxlength="100"></label><label>Yield goal and units <input id="ftYield" maxlength="100"></label><div id="ftTests"></div><label>pH <input id="ftPH" type="number" min="0" max="14" step="any"></label><label>Organic matter (%) <input id="ftOM" type="number" min="0" max="100" step="any"></label><button>Save soil test</button></form><h3>University base recommendation</h3><p><a href="https://lamp.ndsu.edu/soils/FourCropsNitrogenCalculatorWebApp/" target="_blank" rel="noopener noreferrer">Official NDSU economic nitrogen calculator (online)</a>. Use a manually reviewed target where the offline rules do not support a nutrient or crop.</p><p>Use the soil test above. For supported rules enter P and K as ppm, depth exactly 0-6 in, and methods Olsen or Bray-1 and Ammonium acetate. Unavailable nutrients require manual review.</p><label>Field state <select id="ftState"><option value="">Choose state</option><option value="ND">North Dakota</option><option value="SD">South Dakota</option></select></label><label>Yield goal (bu/ac; SD only) <input id="ftRecYield" type="number" min="0" step="any"></label><label>ND clay smectite:illite class <select id="ftClay"><option value="">Not established</option><option value="low">Below 3.5</option><option value="high">Above 3.5</option></select></label><label>ND corn region <select id="ftCornRegion"><option value="">Not established</option><option value="west">West River dryland</option><option value="east">East River dryland</option><option value="irrigated">Irrigated</option></select></label><label>ND corn price ($/bu; exact table value 2–10) <input id="ftCornPrice" type="number" min="2" max="10" step="1"></label><label>ND price per lb K2O (not per lb potash) <select id="ftKCost"><option value="">Not entered</option><option>0.125</option><option>0.20</option><option>0.30</option><option>0.40</option><option>0.50</option><option>0.60</option><option>0.70</option><option>0.80</option><option>0.90</option><option>1.00</option></select></label><label>ND winter wheat productivity <select id="ftProductivity"><option value="">Not established</option><option value="low">Below 40 bu/ac</option><option value="medium">40–60 bu/ac</option><option value="high">Above 60 bu/ac</option></select></label><label>ND Langdon region <select id="ftLangdon"><option value="">Not established</option><option value="yes">Yes</option><option value="no">No</option></select></label><label>ND long-term no-till (6+ continuous years) <select id="ftNoTill"><option value="">Not established</option><option value="yes">Yes</option><option value="no">No</option></select></label><label>Starter band planned <select id="ftStarter"><option value="">Not established</option><option value="yes">Yes</option><option value="no">No</option></select></label><label><input id="ftInoculated" type="checkbox"> Soybean inoculation confirmed</label><label>N credits (lb/ac) <input id="ftCredits" type="number" min="0" step="any"></label><label>Additional N adjustment (lb/ac) <input id="ftAdjust" type="number" min="0" step="any"></label><label><input id="ftReviewedCredits" type="checkbox"> N credits and tillage/other adjustments reviewed</label><button id="ftRecommend" type="button">Calculate base recommendation</button><button id="ftAcceptRec" type="button">Save and use reviewed targets</button><pre id="ftRecResult" style="white-space:pre-wrap"></pre><h3>Dry fertilizer blend</h3><p>Enter agronomist-reviewed targets in lb nutrient/ac for this pass. This calculator does not account for previously applied fertilizer automatically.</p><form id="ftBlend"><label>Application method <select id="ftMethod"><option>Broadcast</option><option>Strip-till</option><option>Starter</option><option>Other</option></select></label><label>Pass number <input id="ftPassNumber" type="number" min="1" max="20" step="1" value="1" required></label><label>Pass / purpose <input id="ftPass" required maxlength="100" placeholder="e.g. Spring base fertilizer"></label><label><input type="checkbox" id="ftLinkPlan"> Also save a planned Field Plan operation for this field/pass</label><div id="ftTargets"></div><div id="ftProducts"></div><button type="button" id="ftAdd">Add product</button> <button type="button" id="ftPreview">Calculate</button> <button>Save blend</button></form><pre id="ftResult" style="white-space:pre-wrap"></pre><p id="ftStatus" role="status"></p><h3>Saved field-year history</h3><div id="ftHistory"></div>';
 $('cropYearFieldPlan').after(panel);
 const keys=['N','P2O5','K2O','S'];
 const field=$('ftField');let ticket=0,busy=false,loadedYear=null,loadedField=null,draftScope=null,visibleSettings=[];
 function input(label,type='text'){const l=el('label',label+' '),i=el('input');i.type=type;if(type==='number'){i.min='0';i.step='any'}l.append(i);return [l,i]}
 const tests=['Nitrate-N','P','K','S'].map(name=>{
  const row=el('fieldset');row.append(el('legend',name));const controls={};
  for(const [key,label,type] of [['value','Value','number'],['unit','Units','text'],['depth','Sample depth / units','text'],['method','Test method','text']]){const [l,i]=input(label,type);controls[key]=i;row.append(l)}
  $('ftTests').append(row);return {name,controls};
 });
 const targetInputs={};
 for(const k of keys){const [l,i]=input(k+' target (lb/ac)','number');i.required=true;targetInputs[k]=i;$('ftTargets').append(l)}
 const products=[];let library=[];
 const libPrefix='fertility-product-v1:';
 function setLibraryOptions(select){const before=select.value;select.replaceChildren(Object.assign(el('option','Choose saved product'),{value:''}),...library.map(p=>Object.assign(el('option',p.name+' · '+keys.map(k=>p[k]).join('-')+' · '+p.createdAt.slice(0,10)),{value:p.id})));if(library.some(p=>p.id===before))select.value=before}
 function productGrade(c){const p={name:c.name.value.trim(),rate:0,price:num(c.price,true),...Object.fromEntries(keys.map(k=>[k,num(c[k])]))};window.FieldScoutBlend.calculate(1,{N:0,P2O5:0,K2O:0,S:0},[p]);return p}
 function addProduct(){
  const row=el('fieldset');row.append(el('legend','Dry product'));const controls={};
  for(const [key,label,type] of [['name','Product','text'],...keys.map(k=>[k,k+' (%)','number']),['rate','Product lb/ac','number'],['price','Price $/US ton (optional)','number']]){const [l,i]=input(label,type);i.required=key!=='price';controls[key]=i;row.append(l)}
  const selector=el('select');setLibraryOptions(selector);const sl=el('label','Saved product ');sl.append(selector);row.prepend(sl);
  selector.onchange=()=>{const p=library.find(p=>p.id===selector.value);if(!p)return;controls.name.value=p.name;for(const k of keys)controls[k].value=p[k];controls.price.value=p.price??'';$('ftResult').textContent=''};
  const remember=el('button','Remember grade and price');remember.type='button';remember.onclick=async()=>{remember.disabled=true;try{const p=productGrade(controls);const id=crypto.randomUUID();await transaction(['settings'],'readwrite',tx=>tx.objectStore('settings').add({key:libPrefix+id,value:{...p,id,createdAt:new Date().toISOString()}}));$('ftStatus').textContent='Saved product template.';await refresh()}catch(e){$('ftStatus').textContent=e.message}finally{remember.disabled=false}};
  const balance=el('select');for(const k of keys)balance.append(Object.assign(el('option',k),{value:k}));const balanceBtn=el('button','Balance rate to selected nutrient');balanceBtn.type='button';balanceBtn.onclick=()=>{try{const k=balance.value,grade=num(controls[k]);if(grade<=0)throw Error('Selected product does not contain '+k);const other=products.filter(p=>p.controls!==controls).reduce((sum,p)=>sum+num(p.controls.rate)*num(p.controls[k])/100,0);controls.rate.value=String(Math.max(0,(num(targetInputs[k])-other)*100/grade));result(blend());$('ftStatus').textContent='Rate adjusted for '+k+'; review excess or shortfalls in all nutrients.'}catch(e){$('ftStatus').textContent=e.message}};
  row.append(remember,balance,balanceBtn);
  const item={row,controls,selector};const remove=el('button','Remove product');remove.type='button';remove.onclick=()=>{products.splice(products.indexOf(item),1);row.remove();$('ftResult').textContent=''};row.append(remove);products.push(item);$('ftProducts').append(row);
 }
 $('ftAdd').onclick=addProduct;addProduct();$('ftDate').value=today();
 function scope(){const f=yearFields().find(f=>f[0]===field.value);if(!f||!fieldYearConfirmed(f[0])||loadedYear!==cropYear||loadedField!==f[0]||draftScope!==cropYear+':'+f[0])throw Error('Select a confirmed field and wait for history to load.');return {fieldId:f[0],name:f[1],acres:f[2],crop:f[3],operator:f[4],year:cropYear}}
 function num(i,optional=false){if(!i.value.trim()){if(optional)return null;throw Error('Enter every numeric value; zero must be explicit.')}const v=Number(i.value);if(!Number.isFinite(v)||v<0)throw Error('Invalid numeric input');return v}
 function recommendation(){const ctx=scope(),values=Object.fromEntries(tests.map(({name,controls:c})=>[name,{value:num(c.value,true),unit:c.unit.value.trim(),depth:c.depth.value.trim(),method:c.method.value.trim()}]));const p=values.P,k=values.K,n=values['Nitrate-N'];if(p.unit!=='ppm'||k.unit!=='ppm'||p.depth!==k.depth)throw Error('P and K require matching depth and ppm units');const starter=$('ftStarter').value;return {ctx,sampleDate:$('ftDate').value,lab:$('ftLab').value.trim(),soilValues:values,recommendation:window.FieldScoutRecommendations.calculate({state:$('ftState').value,crop:ctx.crop,p:p.value,k:k.value,depth:p.depth,pMethod:p.method,kMethod:k.method,clay:$('ftClay').value,starter:starter===''?null:starter==='yes',cornRegion:$('ftCornRegion').value,cornPrice:num($('ftCornPrice'),true),potashCost:num($('ftKCost'),true),productivity:$('ftProductivity').value,langdon:$('ftLangdon').value===''?null:$('ftLangdon').value==='yes',longNoTill:$('ftNoTill').value===''?null:$('ftNoTill').value==='yes',yield:num($('ftRecYield'),true),nitrate:n.value,nDepth:n.depth,nUnit:n.unit,credits:num($('ftCredits'),true),adjustment:num($('ftAdjust'),true),inoculated:$('ftInoculated').checked,reviewedCredits:$('ftReviewedCredits').checked})}}
 function showRec(r){$('ftRecResult').textContent=r.recommendation.version+'\n'+Object.entries(r.recommendation.targets).map(([k,v])=>k+': '+(v===null?'Manual review required':v.toFixed(2)+' lb/ac')).join('\n')+'\n'+r.recommendation.warning+'\n'+r.recommendation.source}
 $('ftRecommend').onclick=()=>{try{showRec(recommendation());$('ftStatus').textContent='Review before accepting.'}catch(e){$('ftRecResult').textContent=e.message}};
 $('ftAcceptRec').onclick=async()=>{if(busy)return;try{const r=recommendation();showRec(r);if(!r.sampleDate)throw Error('Sample date required');if(!confirm('Save these base recommendations and copy available targets? Verify credits, placement and previous applications before using them.'))return;const saved=await save('recommendation',r);if(saved&&cropYear===r.ctx.year&&field.value===r.ctx.fieldId){for(const k of keys)targetInputs[k].value=r.recommendation.targets[k]??'';}}catch(e){$('ftStatus').textContent=e.message}};
 function blend(){const ctx=scope();if(!products.length)throw Error('Add a fertilizer product');const targets=Object.fromEntries(keys.map(k=>[k,num(targetInputs[k])]));const rows=products.map(({controls:c})=>({name:c.name.value.trim(),rate:num(c.rate),price:num(c.price,true),...Object.fromEntries(keys.map(k=>[k,num(c[k])]))}));return {ctx,targets,calculation:window.FieldScoutBlend.calculate(ctx.acres,targets,rows),method:$('ftMethod').value,pass:$('ftPass').value.trim(),passNumber:Number($('ftPassNumber').value)}}
 function result(b){const c=b.calculation,fmt=v=>v.toLocaleString(undefined,{maximumFractionDigits:3});$('ftResult').textContent=[...c.rows.map(r=>r.name+': '+fmt(r.rate)+' lb/ac, '+fmt(r.tons)+' US tons/field'),...keys.map(k=>k+': '+fmt(c.totals[k])+' lb/ac; '+(c.balance[k]<0?'shortfall ':'excess ')+fmt(Math.abs(c.balance[k]))),'Cost: '+(c.cost===null?'Incomplete pricing':'$'+fmt(c.costPerAcre)+'/ac; $'+fmt(c.cost)+' field total')].join('\n')}
 $('ftPreview').onclick=()=>{try{result(blend());$('ftStatus').textContent='Calculated from entered targets only.'}catch(e){$('ftStatus').textContent=e.message;$('ftResult').textContent=''}};
 async function refresh(){
  if(!panel.open||!ready)return;const t=++ticket,year=cropYear,prev=field.value;
  const fs=yearFields().filter(f=>fieldYearConfirmed(f[0]));
  field.replaceChildren(...fs.map(f=>Object.assign(el('option',f[0]+' — '+f[1]),{value:f[0]})));if(fs.some(f=>f[0]===prev))field.value=prev;
  const selected=field.value;loadedYear=null;loadedField=null;
  const nextScope=year+':'+selected;
  if(draftScope===null)draftScope=nextScope;
  if(draftScope!==nextScope){$('ftStatus').textContent='Entry belongs to a different field/year. Return to it or start a new entry. Saving is blocked.'}
  $('ftContext').textContent='Crop year '+year+' · confirmed fields only';
  try{const settings=await getAll('settings');if(t!==ticket||year!==cropYear||selected!==field.value)return;
   library=settings.filter(r=>r.key.startsWith(libPrefix)&&r.value?.name&&r.value.id).map(r=>r.value).sort((a,b)=>a.name.localeCompare(b.name)||b.createdAt.localeCompare(a.createdAt));for(const p of products)setLibraryOptions(p.selector);
   visibleSettings=settings;
   const history=settings.filter(r=>r.key.startsWith(prefix)&&r.value?.ctx?.year===year&&r.value.ctx.fieldId===selected).map(r=>r.value).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
   const superseded=new Set(history.filter(r=>r.kind==='blend').flatMap(r=>r.previous||[]));
   $('ftHistory').replaceChildren(...history.map(r=>{const d=el('details');d.append(el('summary',r.kind==='soil'?'Soil test · '+r.sampleDate:r.kind==='recommendation'?'Recommendation · '+r.recommendation.version:(superseded.has(r.id)?'Earlier blend · ':'Current blend (check for overlap) · ')+r.method+' #'+(r.passNumber||1)+' · '+r.pass),el('pre',JSON.stringify(r,null,2)));d.lastChild.style.whiteSpace='pre-wrap';return d}));if(!history.length)$('ftHistory').textContent='No saved soil tests or blends.';
   loadedYear=year;loadedField=selected;
  }catch(e){$('ftStatus').textContent='Could not load: '+e.message}
 }
 function relevantHeads(rows,b,kind){
  const type={Broadcast:'broadcast','Strip-till':'strip',Starter:'starter',Other:'otherfert'}[b.method];
  const records=kind==='blend'?rows.filter(r=>r.key.startsWith(prefix)&&r.value?.kind==='blend'&&r.value.ctx?.fieldId===b.ctx.fieldId&&r.value.ctx.year===b.ctx.year&&r.value.method===b.method&&(r.value.passNumber||1)===b.passNumber).map(r=>r.value):rows.filter(r=>r.key.startsWith('field-plan-v1:')&&r.value?.year===b.ctx.year&&r.value.type===type&&(r.value.pass||1)===b.passNumber&&r.value.targets?.some(t=>t.fieldId===b.ctx.fieldId)).map(r=>r.value);
  const old=new Set(records.flatMap(r=>kind==='blend'?(r.previous||[]):(r.targets.find(t=>t.fieldId===b.ctx.fieldId).previous||[])));return records.filter(r=>!old.has(r.id))
 }
 const ids=rows=>rows.map(r=>r.id).sort().join('|');
 async function saveBlend(b){
  if(busy)return;busy=true;
  try{
   if(!Number.isInteger(b.passNumber)||b.passNumber<1||b.passNumber>20)throw Error('Choose a valid pass number (1–20).');
   const link=$('ftLinkPlan').checked;
   const reviewedBlends=relevantHeads(visibleSettings,b,'blend'),reviewedPlans=relevantHeads(visibleSettings,b,'plan');
   if(reviewedBlends.length&&!confirm('Save a revision of the current blend(s)? '+reviewedBlends.map(r=>r.pass+' ('+r.createdAt+')').join('; ')+' Earlier versions remain.'))return;
   if(link){
    if(reviewedPlans.length>1||reviewedPlans.some(r=>r.state==='reported'))throw Error('Current plan has overlap or reported completion. Review it in Field Plan; save the blend without linking.');
    if(!confirm('Save blend and '+(reviewedPlans.length?'revise planned operation: '+reviewedPlans[0].text:'create planned operation')+'? No application is reported.'))return;
   }
   const id=crypto.randomUUID(),now=new Date().toISOString(),record={id,kind:'blend',createdAt:now,...b};
   let rejected='';
   await transaction(['settings'],'readwrite',tx=>{
    const store=tx.objectStore('settings'),req=store.getAll();
    req.onsuccess=()=>{
     try{
      const all=req.result;
      const blendHeads=relevantHeads(all,b,'blend');record.previous=blendHeads.map(r=>r.id);
      if(ids(blendHeads)!==ids(reviewedBlends)){rejected='Blend history changed; refresh and review before saving.';tx.abort();return}
      if(link){
       const type={Broadcast:'broadcast','Strip-till':'strip',Starter:'starter',Other:'otherfert'}[b.method];
       const heads=relevantHeads(all,b,'plan');
       if(ids(heads)!==ids(reviewedPlans)||heads.length>1||heads.some(r=>r.state==='reported')){rejected='Plan changed or needs review; no records saved.';tx.abort();return}
       const planId=crypto.randomUUID(),{fieldId,name,acres,crop,operator,year}=b.ctx;
       const text=b.pass+' · '+b.calculation.rows.map(r=>r.name+' '+r.rate+' lb/ac').join('; ');
       store.add({key:'field-plan-v1:'+planId,value:{id:planId,year,type,pass:b.passNumber,state:'planned',createdAt:now,workDate:'',text,blendId:id,targets:[{fieldId,name,acres,crop,operator,previous:heads.map(r=>r.id)}]}});
      }
      store.add({key:prefix+id,value:record});
     }catch(e){rejected=e.message;tx.abort()}
    };
   }).catch(e=>{throw Error(rejected||e.message)});
   $('ftStatus').textContent=link?'Blend and planned operation saved locally.':'Blend saved locally.';
   window.dispatchEvent(new CustomEvent('fieldscout:field-context'));await refresh();
  }catch(e){$('ftStatus').textContent='Could not save blend: '+e.message}finally{busy=false}
 }
 async function save(kind,payload){
  if(busy)return false;busy=true;try{const id=crypto.randomUUID();await transaction(['settings'],'readwrite',tx=>tx.objectStore('settings').add({key:prefix+id,value:{id,kind,createdAt:new Date().toISOString(),...payload}}));$('ftStatus').textContent='Saved locally. Earlier records retained.';await refresh();return true}catch(e){$('ftStatus').textContent='Could not save: '+e.message;return false}finally{busy=false}
 }
 $('ftSoil').onsubmit=e=>{e.preventDefault();try{const ctx=scope(),sampleDate=$('ftDate').value;if(!sampleDate)throw Error('Sample date required');const values=tests.map(({name,controls:c})=>({name,value:num(c.value,true),unit:c.unit.value.trim(),depth:c.depth.value.trim(),method:c.method.value.trim()}));if(Number($('ftPH').value)>14||Number($('ftOM').value)>100)throw Error('Invalid pH or organic matter');if(!values.some(v=>v.value!==null))throw Error('Enter at least one test value');if(values.some(v=>v.value!==null&&(!v.unit||!v.depth||!v.method)))throw Error('Each entered test needs units, depth and method.');void save('soil',{ctx,sampleDate,lab:$('ftLab').value.trim(),previousCrop:$('ftPrev').value.trim(),yieldGoal:$('ftYield').value.trim(),pH:num($('ftPH'),true),organicMatter:num($('ftOM'),true),values})}catch(e){$('ftStatus').textContent=e.message}};
 $('ftBlend').onsubmit=e=>{e.preventDefault();try{const b=blend();if(!b.pass)throw Error('Enter the pass / purpose');result(b);void saveBlend(b)}catch(e){$('ftStatus').textContent=e.message}};
 $('ftNewContext').onclick=()=>{
  if(!ready||busy)return;
  if(!confirm('Clear the current entry forms and start a new entry for the selected field/year? Saved history will not be changed.'))return;
  $('ftSoil').reset();$('ftBlend').reset();$('ftDate').value=today();for(const p of products.splice(0))p.row.remove();addProduct();$('ftResult').textContent='';$('ftRecResult').textContent='';for(const id of ['ftState','ftRecYield','ftClay','ftStarter','ftCredits','ftAdjust','ftCornRegion','ftCornPrice','ftKCost','ftProductivity','ftLangdon','ftNoTill'])$(id).value='';$('ftInoculated').checked=$('ftReviewedCredits').checked=false;
  draftScope=cropYear+':'+field.value;$('ftStatus').textContent='New entry ready.';void refresh();
 };
 panel.addEventListener('toggle',refresh);field.onchange=()=>{$('ftResult').textContent='';void refresh()};window.addEventListener('fieldscout:field-context',refresh);window.addEventListener('fieldscout:settings-downloaded',refresh);
})();
