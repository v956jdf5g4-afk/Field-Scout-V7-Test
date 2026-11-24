/* Dry fertilizer blend arithmetic. Manual nutrient targets only; no agronomic recommendation. */
(function(root){
 function calculate(acres,targets,products){
  if(!Number.isFinite(acres)||acres<=0)throw Error('Confirmed positive acres required');
  const keys=['N','P2O5','K2O','S'], totals=Object.fromEntries(keys.map(k=>[k,0]));
  let cost=0,priced=true;
  const rows=products.map(p=>{
   if(!p.name||!Number.isFinite(p.rate)||p.rate<0||keys.some(k=>!Number.isFinite(p[k])||p[k]<0||p[k]>100)||keys.reduce((s,k)=>s+p[k],0)>100)throw Error('Invalid product rate or grade');
   const nutrients=Object.fromEntries(keys.map(k=>[k,p.rate*p[k]/100]));
   keys.forEach(k=>totals[k]+=nutrients[k]);
   const tons=p.rate*acres/2000;
   if(p.price==null)priced=false;else{if(!Number.isFinite(p.price)||p.price<0)throw Error('Invalid price');cost+=tons*p.price}
   return {...p,tons,nutrients};
  });
  const balance=Object.fromEntries(keys.map(k=>{if(!Number.isFinite(targets[k])||targets[k]<0)throw Error('Invalid nutrient target');return [k,totals[k]-targets[k]]}));
  return {acres,rows,totals,balance,cost:priced?cost:null,costPerAcre:priced?cost/acres:null};
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={calculate};else root.FieldScoutBlend={calculate};
})(typeof window==='undefined'?globalThis:window);
