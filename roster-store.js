/* Field Scout roster migration primitives. Not loaded by the deployed app yet.
   No private field/farmer data belongs in this public file. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.FieldScoutRoster=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const KEY='private-roster-v1';
  const MAX_FIELDS=10000;
  function validate(fields){
    if(!Array.isArray(fields)||fields.length===0||fields.length>MAX_FIELDS)
      throw Error('Roster must be a nonempty list of at most '+MAX_FIELDS+' fields');
    const seen=new Set();
    return fields.map((row,i)=>{
      if(!Array.isArray(row)||row.length!==5)throw Error('Invalid field row '+i);
      const [id,name,acres,crop,operator]=row;
      if(typeof id!=='string'||!id.trim()||id.length>80||seen.has(id))
        throw Error('Invalid or duplicate field ID at row '+i);
      if(typeof name!=='string'||!name.trim()||name.length>300)
        throw Error('Invalid field name at row '+i);
      if(typeof crop!=='string'||!crop.trim()||crop.length>120)
        throw Error('Invalid baseline crop at row '+i);
      if(typeof operator!=='string'||!operator.trim()||operator.length>80)
        throw Error('Invalid operator at row '+i);
      if(typeof acres!=='number'||!Number.isFinite(acres)||acres<=0||acres>1000000)
        throw Error('Invalid baseline acres at row '+i);
      seen.add(id);
      return [id,name,acres,crop,operator];
    });
  }
  function snapshot(fields,metadata){
    const rows=validate(fields);
    return {format:'FieldScoutPrivateRoster',version:1,
      baselineYear:2026,fields:rows,metadata:metadata||{}};
  }
  function validateSnapshot(value){
    if(!value||value.format!=='FieldScoutPrivateRoster'||value.version!==1||value.baselineYear!==2026)
      throw Error('Unsupported private roster snapshot');
    return snapshot(value.fields,value.metadata);
  }
  function idsMatch(a,b){
    const x=validate(a).map(r=>r[0]).sort();
    const y=validate(b).map(r=>r[0]).sort();
    return x.length===y.length&&x.every((id,i)=>id===y[i]);
  }
  // IndexedDB settings adapter: read/write must use existing transactional storage.
  async function readLocal(read){
    const value=await read(KEY);
    return value==null?null:validateSnapshot(value);
  }
  async function saveLocal(write,value){
    const verified=validateSnapshot(value);
    await write(KEY,verified);
    return verified;
  }
  // Fail closed: never replace local data silently if the incoming roster differs.
  async function reconcileLocal(read,write,incoming){
    const next=validateSnapshot(incoming),existing=await readLocal(read);
    if(existing&&JSON.stringify(existing.fields)!==JSON.stringify(next.fields))
      return {status:'review-required',existing,incoming:next};
    if(!existing)await saveLocal(write,next);
    return {status:existing?'unchanged':'saved',roster:next};
  }
  return {KEY,validate,snapshot,validateSnapshot,idsMatch,readLocal,saveLocal,reconcileLocal};
});
