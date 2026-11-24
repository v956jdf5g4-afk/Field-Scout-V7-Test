/* Farmer contact log: independent append-only records. */
(() => {
 const prefix='farmer-note-v1:';
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
 const panel=el('details');panel.className='panel';panel.id='farmerNotes';
 panel.innerHTML='<summary>Farmer Notes &amp; Follow-ups</summary><label>Farmer <select id="fnFarmer"></select></label><form id="fnForm"><label>Contact date <input id="fnDate" type="date" required></label><label>Type <select id="fnType"><option>Call</option><option>Text</option><option>In person</option><option>General note</option></select></label><label>Topic (optional) <input id="fnTopic" maxlength="120"></label><label>Notes <textarea id="fnText" maxlength="10000" required rows="4"></textarea></label><label>Follow-up (optional) <input id="fnDue" type="date"></label><button id="fnSave">Save farmer note</button></form><p id="fnStatus" role="status"></p><label>Search history <input id="fnSearch" type="search"></label><h3>Open farmer follow-ups</h3><div id="fnTasks"></div><h3>Contact history — all years</h3><div id="fnHistory"></div>';
 $('cropYearFieldPlan').before(panel);
 const farmer=$('fnFarmer'),save=$('fnSave');let busy=false,ticket=0;
 $('fnDate').value=today();
 async function refresh(){
  if(!panel.open||!ready)return;
  const t=++ticket;save.disabled=true;
  try{
   const all=await getAll('settings');if(t!==ticket)return;
   const notes=all.filter(r=>r.key.startsWith(prefix)&&r.value?.kind==='note').map(r=>r.value);
   const done=new Set(all.filter(r=>r.key.startsWith(prefix)&&r.value?.kind==='complete').map(r=>r.value.noteId));
   const ids=[...new Set([...fields.map(f=>f[4]),...yearFields().map(f=>f[4]),...notes.map(n=>n.farmer)])].sort();
   const prev=farmer.value;farmer.replaceChildren(...ids.map(id=>Object.assign(el('option',farmerNames[id]||id),{value:id})));if(ids.includes(prev))farmer.value=prev;
   const q=$('fnSearch').value.toLowerCase().trim();
   const history=notes.filter(n=>n.farmer===farmer.value&&[n.text,n.topic,n.type,n.date].join(' ').toLowerCase().includes(q)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));
   $('fnHistory').replaceChildren(...history.map(n=>{const row=el('article');row.append(el('h4',n.date+' · '+n.type+(n.topic?' · '+n.topic:'')),el('p',n.text));if(n.due)row.append(el('small','Follow-up: '+n.due+(done.has(n.id)?' · Complete':'')));return row}));
   if(!history.length)$('fnHistory').textContent='No matching farmer notes.';
   const tasks=notes.filter(n=>n.due&&!done.has(n.id)).sort((a,b)=>a.due.localeCompare(b.due));
   $('fnTasks').replaceChildren(...tasks.map(n=>{const row=el('div');const btn=el('button','Complete');btn.type='button';btn.onclick=async()=>{btn.disabled=true;try{const id=crypto.randomUUID();await transaction(['settings'],'readwrite',tx=>tx.objectStore('settings').add({key:prefix+id,value:{id,kind:'complete',noteId:n.id,createdAt:new Date().toISOString()}}));await refresh()}catch(e){$('fnStatus').textContent='Could not complete: '+e.message;btn.disabled=false}};row.append(el('p',(n.due<today()?'Overdue · ':'')+n.due+' · '+(farmerNames[n.farmer]||n.farmer)+' · '+(n.topic||n.text.slice(0,100))),btn);return row}));
   if(!tasks.length)$('fnTasks').textContent='No open farmer follow-ups.';
   save.disabled=busy||!ids.length;
  }catch(e){if(t===ticket)$('fnStatus').textContent='Could not load farmer notes: '+e.message}
 }
 panel.addEventListener('toggle',refresh);farmer.onchange=refresh;$('fnSearch').oninput=refresh;window.addEventListener('fieldscout:field-context',refresh);window.addEventListener('fieldscout:settings-downloaded',refresh);
 $('fnForm').onsubmit=async e=>{
  e.preventDefault();if(busy||save.disabled||!ready)return;
  const text=$('fnText').value.trim(),date=$('fnDate').value,due=$('fnDue').value;
  if(!text||!farmer.value||!date||(due&&due<date)){$('fnStatus').textContent='Enter a farmer, contact date and note. Follow-up cannot precede contact.';return}
  const id=crypto.randomUUID(),record={id,kind:'note',farmer:farmer.value,date,due,text,topic:$('fnTopic').value.trim(),type:$('fnType').value,createdAt:new Date().toISOString()};
  busy=true;save.disabled=true;
  try{await transaction(['settings'],'readwrite',tx=>tx.objectStore('settings').add({key:prefix+id,value:record}));if($('fnText').value.trim()===text){$('fnText').value='';$('fnTopic').value='';$('fnDue').value=''}$('fnStatus').textContent='Saved on this device.'}catch(e){$('fnStatus').textContent='Could not save: '+e.message}finally{busy=false;await refresh()}
 };
})();
