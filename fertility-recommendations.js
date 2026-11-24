/* Versioned regional decision support; broadcast base rates only. */
(function(root){
const sources={SD:'https://extension.sdstate.edu/sites/default/files/2026-03/P-00039-v4-2026.pdf',ND:'https://www.ndsu.edu/agriculture/sites/default/files/2023-10/sf882.pdf'};
function calculate(x){
 const n=(v,label)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw Error('Missing or invalid '+label);return v};
 const crop=String(x.crop).toLowerCase(),p=n(x.p,'P ppm'),k=n(x.k,'K ppm');
 if(x.depth!=='0-6 in'||x.kMethod!=='Ammonium acetate')throw Error('Requires 0–6 inch P/K samples and ammonium acetate K');
 const out={N:null,P2O5:null,K2O:null,S:null};
 if(x.state==='SD'){
  const y=n(x.yield,'yield goal (bu/ac)');if(y<=0)throw Error('Positive yield goal required');
  if(!['Olsen','Bray-1'].includes(x.pMethod))throw Error('Select the actual P extraction method');
  const r=crop==='corn'?[.700,.044,.035,1.166,.0073,1]:crop==='soybeans'?[1.55,.14,.10,2.2,.0183,0]:['spring wheat','winter wheat'].includes(crop)?[1.071,.067,.054,2.71,.017,2.5]:null;
  if(!r)throw Error('Crop not supported by this rule set');
  out.P2O5=Math.max(0,(r[0]-r[x.pMethod==='Olsen'?1:2]*p)*y);
  out.K2O=Math.max(0,(r[3]-r[4]*k)*y);if(crop==='corn'&&out.K2O>0)out.K2O=Math.max(60,out.K2O);
  // Base N only; credits/adjustments and starter exceptions need separate review.
  if(crop==='soybeans'){if(x.inoculated===true)out.N=0}
  else if(x.nDepth==='0-24 in'&&x.nUnit==='lb/ac'&&x.reviewedCredits===true){
   out.N=Math.max(0,r[5]*y-n(x.nitrate,'nitrate-N')-n(x.credits,'N credits')+n(x.adjustment,'N adjustment'));
  }
 }else if(x.state==='ND'){
  if(x.pMethod!=='Olsen'||!Number.isInteger(p)||!Number.isInteger(k))throw Error('ND tables require whole-number lab ppm and Olsen P');
  const pi=p<=3?0:p<=7?1:p<=11?2:p<=15?3:4;
  if(!['low','high'].includes(x.clay))throw Error('Verify smectite:illite class; use manual review at uncertain boundaries');
  if(crop==='soybeans'){
   out.P2O5=[52,26,0,0,0][pi];
   const ki=k<=40?0:k<=80?1:k<=120?2:k<=150?3:k<=200?4:5;
   out.K2O=(x.clay==='low'?[90,60,60,30,0,0]:[90,90,60,60,60,0])[ki];
   if(x.inoculated===true)out.N=0;
  }else if(crop==='corn'){
   const pTable={west:[78,52,39,26,10],east:[104,78,52,39,10],irrigated:[156,104,78,52,26]}[x.cornRegion];
   if(!pTable)throw Error('Choose the North Dakota corn region/irrigation category');
   out.P2O5=pTable[pi];
   // SF882 Tables 8-11 to 8-14: exact published grid cells only.
   const prices=[.125,.2,.3,.4,.5,.6,.7,.8,.9,1],col=prices.indexOf(x.potashCost),row=x.cornPrice-2;
   const lower=[[90,90,90,90,60,60,0,0,0,0],[90,90,90,90,60,60,60,60,60,0],[90,90,90,90,90,90,90,90,90,60],[90,90,90,90,90,90,90,90,90,90],[120,120,120,120,90,90,90,90,90,90],[120,120,120,120,120,120,120,120,120,90],...Array.from({length:3},()=>Array(10).fill(120))];
   const upper=[[90,90,60,60,60,0,0,0,0,0],[90,90,90,90,60,60,60,0,0,0],[90,90,90,90,90,90,90,60,60,0],[90,90,90,90,90,90,90,90,90,60],[120,120,120,120,90,90,90,90,90,90],[120,120,120,120,120,120,120,120,120,90],...Array.from({length:3},()=>Array(10).fill(120))];
   const table=k<=(x.clay==='low'?100:150)?lower:k<=(x.clay==='low'?149:199)?upper:null;
   if(table&&Number.isInteger(row)&&row>=0&&row<9&&col>=0)out.K2O=table[row][col];
  }else if(['spring wheat','winter wheat'].includes(crop)){
   if(typeof x.starter!=='boolean')throw Error('Specify whether starter banding is planned');
   out.P2O5=(crop==='spring wheat'?[90,60,35,20,15]:[75,50,30,15,15])[pi];
   if(!x.starter&&pi>=3)out.P2O5=0;
   out.K2O=k<=(x.clay==='low'?100:150)?30:0;
   if(crop==='winter wheat'&&x.nDepth==='0-24 in'&&x.nUnit==='lb/ac'&&x.reviewedCredits===true&&['low','medium','high'].includes(x.productivity)&&typeof x.langdon==='boolean'&&typeof x.longNoTill==='boolean'){out.N=Math.max(0,({low:100,medium:150,high:200})[x.productivity]-n(x.nitrate,'nitrate-N')-n(x.credits,'N credits')-(x.langdon?40:0)-(x.longNoTill?50:0))}
   // ND corn and spring wheat economic N models require separate consultant review.
  }else throw Error('ND crop not supported; enter manual consultant targets');
 }else throw Error('Choose the field state explicitly');
 return {source:sources[x.state],version:x.state==='SD'?'SDSU P-00039 v4 2026':'NDSU SF882 Oct 2023',inputs:{...x},targets:out,warning:'Base recommendation only. Review placement, prior applications, credits and local exceptions. ND corn/spring wheat N requires the NDSU economic calculator; sulfur needs separate review. ND corn K uses exact published price cells only. Null means manual review, not zero.'};
}
if(typeof module!=='undefined'&&module.exports)module.exports={calculate};else root.FieldScoutRecommendations={calculate};
})(typeof window==='undefined'?globalThis:window);
