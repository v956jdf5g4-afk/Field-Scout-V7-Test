/* Crop-year plans are append-only batches in the existing settings store. */
(() => {
  const prefix = 'field-plan-v1:';
  const types = {
    herbicide: 'Herbicide program',
    preemerge: 'Pre-emergence herbicide',
    postemerge: 'Post-emergence herbicide',
    prepay: 'Chemical prepay',
    fall: 'Fall herbicide',
    strip: 'Strip-till fertilizer',
    broadcast: 'Broadcast fertilizer',
    starter: 'Starter fertilizer',
    otherfert: 'Other fertilizer'
  };
  const states = { planned: 'Planned', needed: 'Still needed', reported: 'Farmer-reported complete' };
  const node = (tag, label) => {
    const element = document.createElement(tag);
    if (label !== undefined) element.textContent = label;
    return element;
  };
  const option = (value, label) => Object.assign(node('option', label), { value });

  const panel = node('details');
  panel.id = 'cropYearFieldPlan';
  panel.className = 'panel';
  panel.innerHTML = `<summary>Crop-year Chemical &amp; Fertilizer Field Plan</summary>
    <p id="fpYear"></p>
    <label>Farmer <select id="fpFarmer"></select></label>
    <label>Crop <select id="fpCrop"></select></label>
    <form id="fpForm">
      <fieldset><legend>Fields to update</legend>
        <button type="button" id="fpSelectAll">Select all shown</button>
        <p id="fpSummary"></p><div id="fpFields"></div>
      </fieldset>
      <label>Plan or operation <select id="fpType"></select></label>
      <label>Pass / separate item <input id="fpPass" type="number" min="1" max="20" step="1" value="1" required></label><small>Use the same number to revise; a different number adds another pass or prepaid product.</small><label>Status <select id="fpState"></select></label>
      <label id="fpWorkLabel" hidden>Reported work date (optional) <input id="fpWork" type="date"></label>
      <label>Plan or report details <textarea id="fpText" required maxlength="2000" rows="3"></textarea></label>
      <div id="fpPrepay" hidden><label>Prepaid product <input id="fpPrepayProduct" maxlength="120"></label><label>Farmer-reported total quantity for selected fields <input id="fpPrepayQty" type="number" min="0" step="any"></label><label>Unit <select id="fpPrepayUnit"><option value="gal">gal</option><option value="lb">lb</option><option value="qt">qt</option><option value="pt">pt</option><option value="fl oz">fl oz</option><option value="oz wt">oz wt</option></select></label><small>One shared total, not a quantity per field. Prepaid does not mean applied.</small></div><label id="fpRecipeLabel" hidden>Spray recipe (optional) <select id="fpRecipe"></select></label>
      <label>Related farmer conversation (optional) <select id="fpContact"><option value="">None</option></select></label><button type="button" id="fpClear">Clear current entry</button><button type="submit" id="fpSave">Save to selected fields</button>
    </form>
    <p id="fpStatus" role="status"></p><h3>Generate spray order from selected plan</h3><p>Choose one crop, a chemical stage and confirmed fields. Current saved recipe snapshots are used; overlapping or completed plans must be reviewed. No application is reported by generating an order.</p><button type="button" id="fpPreviewOrder">Preview planned order</button><button type="button" id="fpSaveOrder" disabled>Save planned order snapshot</button><div id="fpOrderPreview"></div><h3>Saved plan orders</h3><div id="fpOrderHistory"></div>`;
  const review = $('yearReviewFields').closest('details') || $('yearReviewFields').parentElement;
  review.after(panel);

  const farmer = $('fpFarmer'), crop = $('fpCrop'), type = $('fpType'), state = $('fpState');
  const work = $('fpWork'), note = $('fpText'), recipe = $('fpRecipe'), save = $('fpSave');
  let draftScope=null,lastYear, tickets = 0, savingBatch = false, displayedHeads = new Map(), previewOrder=null, savingOrder=false;
  type.replaceChildren(...Object.entries(types).map(([key, label]) => option(key, label)));

  function replaceOptions(select, options) {
    const previous = select.value;
    select.replaceChildren(...options);
    if (options.some(item => item.value === previous)) select.value = previous;
  }

  function stateOptions() {
    const isWork = ['fall', 'strip', 'broadcast', 'starter', 'otherfert', 'preemerge', 'postemerge'].includes(type.value);
    const options = Object.entries(states).filter(([key]) => isWork || key === 'planned');
    replaceOptions(state, options.map(([key, label]) => option(key, label)));
    $('fpWorkLabel').hidden = state.value !== 'reported';
    work.disabled = $('fpWorkLabel').hidden;
    $('fpRecipeLabel').hidden = !['herbicide', 'fall', 'preemerge', 'postemerge'].includes(type.value);
    recipe.disabled = $('fpRecipeLabel').hidden;
    $('fpPrepay').hidden = type.value !== 'prepay';
  }

  function matchingFields() {
    return yearFields().filter(field => field[4] === farmer.value && (!crop.value || crop.value === field[3]));
  }

  function historyFor(entries, id, category, pass=1) {
    return entries.filter(entry => entry.type === category && (entry.pass||1)===pass && entry.targets?.some(target => target.fieldId === id));
  }

  function headsFor(history, id) {
    const superseded = new Set(history.flatMap(entry => entry.targets.find(target => target.fieldId === id).previous || []));
    return history.filter(entry => !superseded.has(entry.id));
  }

  function describe(entry) {
    const status = states[entry.state] || entry.state;
    return status + ' · ' + entry.text + (entry.prepay ? ' · Shared batch prepay: ' + entry.prepay.quantity + ' ' + entry.prepay.unit + ' ' + entry.prepay.product + ' across ' + entry.targets.length + ' field(s)' : '') + (entry.recipe ? ' · Recipe: ' + entry.recipe.name : '') +
      (entry.workDate ? ' · Work date: ' + entry.workDate : '') + ' · Entered ' + new Date(entry.createdAt).toLocaleString();
  }

  function fieldRow(field, entries, selected, settings) {
    const [id, name, , fieldCrop] = field;
    const row = node('div');
    row.className = 'fp-row';
    const label = node('label');
    const checkbox = Object.assign(node('input'), { type: 'checkbox', value: id, checked: selected.has(id) });
    checkbox.disabled = !fieldYearConfirmed(id);
    label.append(checkbox, document.createTextNode(' ' + id + ' — ' + name + ' · ' + fieldCrop));
    row.append(label);
    const currentStatuses = [];
    const details = node('details');
    details.append(node('summary', 'Plan and history'));
    for (const [category, title] of Object.entries(types)) {
      const passes=[...new Set(entries.filter(entry=>entry.type===category&&entry.targets?.some(t=>t.fieldId===id)).map(entry=>entry.pass||1))].sort((a,b)=>a-b);
      for(const pass of passes){
        const history=historyFor(entries,id,category,pass),heads=headsFor(history,id);
        displayedHeads.set(id+':'+category+':'+pass,heads.map(entry=>entry.id));
        currentStatuses.push(title+' #'+pass+' · '+(heads.length>1?'Review overlapping updates':states[heads[0]?.state]||'Review history'));
        details.append(node('h4',title+' #'+pass));
        if(heads.length>1)details.append(node('p','Overlapping updates. Review each entry and save a correction to set the current plan.'));
        const list=node('ul');
        for(const entry of history){
          const original=entry.targets.find(t=>t.fieldId===id).previous.length===0;
          const marker=(heads.includes(entry)?(heads.length>1?'Needs review · ':'Current · '):'')+(original?'Initial entry · ':'');
          const li=node('li',marker+describe(entry));
          if(entry.blendId){const blend=settings.find(r=>r.key==='fertility-v1:'+entry.blendId)?.value;if(blend?.calculation){const d=node('details');d.append(node('summary','Saved fertilizer blend'),node('p',blend.calculation.rows.map(r=>r.name+' '+r.rate+' lb/ac').join('; ')));li.append(d)}}
          if(entry.contactId){
            const contact=settings.find(r=>r.key==='farmer-note-v1:'+entry.contactId)?.value;
            if(contact){const related=node('details');related.append(node('summary','Related farmer conversation · '+contact.date),node('p',contact.text));li.append(related)}
          }
          list.append(li);
        }
        details.append(list);
      }
    }
    const fertility=settings.filter(r=>r.key.startsWith('fertility-v1:')&&r.value?.ctx?.fieldId===id&&r.value.ctx.year===cropYear).map(r=>r.value);
    if(fertility.length){
      const counts=['soil','recommendation','blend'].map(k=>fertility.filter(r=>r.kind===k).length);
      details.append(node('p','Fertility history: '+counts[0]+' soil tests, '+counts[1]+' recommendations, '+counts[2]+' blend records. Open Soil Tests & Fertilizer Blends for details.'));
    }
    if (details.children.length === 1) details.append(node('p', 'No plan entries for this crop year.'));
    row.append(details);
    for (const status of currentStatuses) row.append(node('small', status));
    return row;
  }

  async function render() {
    if (!panel.open || !ready) return;
    invalidatePreview();
    const ticket = ++tickets;
    const year = cropYear;
    const previousScope = lastYear === year;
    const selected = new Set(previousScope ? [...panel.querySelectorAll('input[type=checkbox]:checked')].map(input => input.value) : []);
    save.disabled = true;
    try {
      const [settings, recipes] = await Promise.all([getAll('settings'), getSetting('spray-recipes-v1')]);
      if (ticket !== tickets || year !== cropYear) return;
      $('fpYear').textContent = 'Target crop year ' + year + ' · Confirm crop and acres before planning a field.';
      const available = yearFields();
      const farmers = [...new Set(available.map(field => field[4]))];
      replaceOptions(farmer, farmers.map(id => option(id, farmerNames[id] || id)));
      const crops = [...new Set(available.filter(field => field[4] === farmer.value).map(field => field[3]))].sort();
      replaceOptions(crop, [option('', 'All crops'), ...crops.map(name => option(name, name))]);
      const entries = settings.filter(item => item.key.startsWith(prefix) && item.value?.year === year)
        .map(item => item.value).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
      const candidates = matchingFields();
      const context=year+':'+farmer.value+':'+crop.value;
      if(draftScope===null||!hasDraft())draftScope=context;
      replaceOptions($('fpContact'),[option('','None'),...settings.filter(r=>r.key.startsWith('farmer-note-v1:')&&r.value?.kind==='note'&&r.value.farmer===farmer.value).map(r=>r.value).sort((a,b)=>b.date.localeCompare(a.date)).map(n=>option(n.id,n.date+' · '+(n.topic||n.text.slice(0,60))))]);
      replaceOptions(recipe, [option('', 'Choose recipe'), ...(recipes || []).filter(item => candidates.some(field => !item.crop || item.crop === field[3])).map(item => option(item.id, item.name))]);
      const counts={planned:0,needed:0,reported:0,review:0};let prepay=0;
      for(const f of candidates)for(const category of Object.keys(types))for(const pass of new Set(entries.filter(e=>e.type===category&&e.targets?.some(t=>t.fieldId===f[0])).map(e=>e.pass||1))){const h=headsFor(historyFor(entries,f[0],category,pass),f[0]);if(category==='prepay'){prepay++;if(h.length>1)counts.review++;continue}if(h.length!==1)counts.review++;else if(Object.hasOwn(counts,h[0].state))counts[h[0].state]++}
      $('fpSummary').textContent=candidates.length+' fields · '+counts.planned+' planned · '+counts.needed+' still needed · '+counts.reported+' farmer-reported complete · '+counts.review+' needing review · '+prepay+' prepaid item/field references (not application counts).';
      displayedHeads = new Map();
      $('fpFields').replaceChildren(...candidates.map(field => fieldRow(field, entries, selected, settings)));
      if (!candidates.length) $('fpFields').textContent = 'No fields match these filters.';
      lastYear = year;
      renderOrderHistory(settings,year);
      stateOptions();
    } catch {
      $('fpStatus').textContent = 'Could not read field plans. Reopen the panel to retry.';
      lastYear = null;
    } finally {
      if (ticket === tickets) save.disabled = savingBatch || lastYear !== cropYear || draftScope!==cropYear+':'+farmer.value+':'+crop.value;
    }
  }

  function hasDraft(){return !!(note.value.trim()||recipe.value||work.value||$('fpPrepayProduct').value||$('fpPrepayQty').value||$('fpContact').value)}
  $('fpClear').onclick=()=>{if(hasDraft()&&!confirm('Clear unsaved plan entry?'))return;$('fpForm').reset();draftScope=cropYear+':'+farmer.value+':'+crop.value;void render()};
  function invalidatePreview(){
    previewOrder=null;$('fpSaveOrder').disabled=true;$('fpOrderPreview').replaceChildren();
  }
  function renderOrderHistory(settings,year){
    const list=$('fpOrderHistory');
    list.replaceChildren(...settings.filter(x=>x.key.startsWith('plan-order-v1:')&&x.value?.data?.year===year&&x.value.data.farmer===farmer.value).map(x=>x.value).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(o=>{
      const d=node('details');d.append(node('summary',o.number+' · '+o.category+' #'+(o.pass||1)+' · '+o.data.crop));
      const report=node('div');report.innerHTML=window.fieldScoutPlanOrder.html(o.data);const print=node('button','Print / Save PDF');print.type='button';print.onclick=()=>window.fieldScoutPlanOrder.print(o.data);d.append(report,print);return d;
    }));if(!list.children.length)list.textContent='No saved plan orders for this farmer/year.';
  }
  async function prepareOrder(){
    invalidatePreview();if(!ready||lastYear!==cropYear||savingBatch)throw Error('Wait for plans to load.');
    if(!crop.value||!['herbicide','fall','preemerge','postemerge'].includes(type.value))throw Error('Choose a single crop and chemical stage.');
    const year=cropYear,operator=farmer.value,fieldCrop=crop.value,category=type.value,pass=Number($('fpPass').value);if(!Number.isInteger(pass)||pass<1||pass>20)throw Error('Choose a valid pass number.');
    const checked=[...panel.querySelectorAll('#fpFields input[type=checkbox]:checked')].map(i=>i.value);
    if(!checked.length)throw Error('Select fields for this order.');
    const settings=await getAll('settings');
    if(year!==cropYear||operator!==farmer.value||fieldCrop!==crop.value||category!==type.value||pass!==Number($('fpPass').value)||checked.join('|')!==[...panel.querySelectorAll('#fpFields input[type=checkbox]:checked')].map(i=>i.value).join('|'))throw Error('Selection changed; preview again.');
    const all=settings.filter(r=>r.key.startsWith(prefix)&&r.value?.year===year).map(r=>r.value);
    const recipes=Object.create(null),links=[];
    for(const id of checked){
      if(!fieldYearConfirmed(id))throw Error(id+' is not confirmed.');
      const h=headsFor(historyFor(all,id,category,pass),id);
      if(h.length!==1||h[0].state==='reported'||!h[0].recipe?.snapshot)throw Error(id+': needs one current, incomplete plan with a saved recipe snapshot. Resave legacy recipe links.');
      const r=h[0].recipe.snapshot;
      if(!r.id||!Array.isArray(r.lines)||!r.lines.length||!Number.isFinite(Number(r.gpa))||Number(r.gpa)<=0||r.lines.some(l=>!l.name||!Number.isFinite(Number(l.rate))||Number(l.rate)<=0||!['fl oz/ac','pt/ac','qt/ac','gal/ac','oz wt/ac','lb/ac','fl oz/100 gal','pt/100 gal','qt/100 gal','gal/100 gal','oz wt/100 gal','lb/100 gal'].includes(l.unit)))throw Error(id+': invalid recipe snapshot.');
      recipes[id]=r;links.push({fieldId:id,planId:h[0].id});
    }
    const data=window.fieldScoutPlanOrder.calculate({farmer:operator,crop:fieldCrop,recipes});
    if(data.groups.reduce((n,g)=>n+g.fields.length,0)!==checked.length)throw Error('Some fields could not be included. Review crop and recipe assignments.');
    previewOrder={data,links,category,pass};$('fpOrderPreview').innerHTML=window.fieldScoutPlanOrder.html(data);$('fpSaveOrder').disabled=savingOrder;
  }
  $('fpPreviewOrder').onclick=async()=>{try{await prepareOrder()}catch(e){$('fpStatus').textContent=e.message}};
  $('fpSaveOrder').onclick=async()=>{
    if(!previewOrder||savingOrder)return;const shown=JSON.stringify(previewOrder);savingOrder=true;$('fpSaveOrder').disabled=true;
    try{await prepareOrder();if(!previewOrder||JSON.stringify(previewOrder)!==shown)throw Error('Plan or field data changed. Review the updated preview and save again.');
      if(!confirm('Save this planned order snapshot? This does not report any application.'))return;
      const id=crypto.randomUUID(),o={...previewOrder,id,createdAt:new Date().toISOString(),number:'PLAN-'+cropYear+'-'+id.slice(0,8)};
      await transaction(['settings'],'readwrite',tx=>tx.objectStore('settings').add({key:'plan-order-v1:'+id,value:o}));$('fpStatus').textContent='Saved '+o.number;await render();
    }catch(e){$('fpStatus').textContent=e.message}finally{savingOrder=false;$('fpSaveOrder').disabled=!previewOrder}
  };
  panel.addEventListener('change',e=>{if(e.target.closest('#fpForm')||e.target===farmer||e.target===crop)invalidatePreview()});
  panel.addEventListener('toggle', () => { void render(); });
  farmer.onchange = crop.onchange = () => { if(hasDraft())$('fpStatus').textContent='Unsaved entry belongs to the previous farmer/crop/year. Return to that selection or clear the entry.';void render(); };
  type.onchange = state.onchange = stateOptions;
  $('fpSelectAll').onclick = () => {
    for (const input of panel.querySelectorAll('#fpFields input[type=checkbox]:enabled')) input.checked = true;
    invalidatePreview();
  };
  window.addEventListener('fieldscout:field-context', () => { void render(); });
  window.addEventListener('fieldscout:settings-downloaded', () => { void render(); });
  $('fpForm').onsubmit = async event => {
    event.preventDefault();
    if (savingBatch || save.disabled || lastYear !== cropYear || draftScope!==cropYear+':'+farmer.value+':'+crop.value) return;
    const pass=Number($('fpPass').value);if(!Number.isInteger(pass)||pass<1||pass>20){$('fpStatus').textContent='Choose a pass or item number between 1 and 20.';return}
    const year = cropYear;
    const selected = [...panel.querySelectorAll('input[type=checkbox]:checked')].map(input => input.value);
    const targets = matchingFields().filter(field => selected.includes(field[0]) && fieldYearConfirmed(field[0]))
      .map(([fieldId, name, acres, fieldCrop, operator]) => ({
        fieldId, name, acres, crop: fieldCrop, operator,
        previous: displayedHeads.get(fieldId + ':' + type.value + ':' + pass) || []
      }));
    const text = note.value.trim(), recipeId = recipe.disabled ? '' : recipe.value;
    if (!targets.length || !text) {
      $('fpStatus').textContent = 'Select at least one confirmed field and enter plan or report details.';
      return;
    }
    const entry = {
      id: crypto.randomUUID(), year, targets, text, type: type.value, pass, contactId:$('fpContact').value||null, state: state.value,
      createdAt: new Date().toISOString(), workDate: work.disabled ? '' : work.value
    };
    if (type.value === 'prepay') {
      const product=$('fpPrepayProduct').value.trim(), raw=$('fpPrepayQty').value;
      if(product || raw !== '') {
        const quantity=Number(raw);
        if(!product || raw === '' || !Number.isFinite(quantity) || quantity < 0) {
          $('fpStatus').textContent='Enter both prepaid product and a valid total quantity.';return;
        }
        entry.prepay={product,quantity,unit:$('fpPrepayUnit').value,scope:'batch-total'};
      }
    }
    if (!confirm('Save this ' + year + ' update to ' + targets.length + ' field(s)?')) return;
    savingBatch = true;
    save.disabled = true;
    try {
      if (recipeId) {
        const savedRecipe = (await getSetting('spray-recipes-v1') || []).find(item => item.id === recipeId);
        if (!savedRecipe || targets.some(target => savedRecipe.crop && savedRecipe.crop !== target.crop)) {
          throw Error('Choose a recipe that applies to all selected fields.');
        }
        entry.recipe = { id: savedRecipe.id, name: savedRecipe.name, snapshot: structuredClone(savedRecipe) };
      }
      await transaction(['settings'], 'readwrite', tx => {
        tx.objectStore('settings').add({ key: prefix + entry.id, value: entry });
      });
      if (note.value.trim() === text) {note.value = '';recipe.value='';work.value='';$('fpPrepayProduct').value='';$('fpPrepayQty').value='';$('fpContact').value=''}
      $('fpStatus').textContent = 'Saved on this device for ' + targets.length + ' field(s) in ' + year + '.';
      await render();
    } catch (error) {
      $('fpStatus').textContent = 'Could not save: ' + error.message;
    } finally {
      savingBatch = false;
      save.disabled = lastYear !== cropYear || draftScope!==cropYear+':'+farmer.value+':'+crop.value;
    }
  };
  stateOptions();
})();
