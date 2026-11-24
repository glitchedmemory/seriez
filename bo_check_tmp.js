
const fs=require('fs');
(async()=>{
  const r = await fetch('http://127.0.0.1:3000/?p='+Date.now());
  const h = await r.text();
  console.log('html size:', h.length);
  const j = h.indexOf('박스오피스');
  const i = h.indexOf('Box Office');
  const idx = j>=0? j : i;
  console.log('section idx:', idx);
  if(idx<0){ console.log('NOT FOUND'); return; }
  const seg = h.slice(idx, idx+6000);
  const check = ['Ebenezer','Cat in the Hat','Godzilla Minus Zero','Verity','Avengers: Endgame','Digger','Primetime','Heart of the Beast'];
  check.forEach(t=>{
    console.log((seg.includes(t)?'  HIT ':'  --- ')+t);
  });
})();
