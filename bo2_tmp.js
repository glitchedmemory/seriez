
(async()=>{
  const r = await fetch('http://127.0.0.1:3000/?p='+Date.now());
  const h = await r.text();
  // 모든 '박스오피스' 등장 위치
  let idx=-1, positions=[];
  while((idx=h.indexOf('박스오피스', idx+1))!==-1) positions.push(idx);
  console.log('박스오피스 occurrences:', positions.length, positions.slice(0,6));
  const check = ['Ebenezer','Cat in the Hat','Godzilla Minus Zero','Verity','Avengers: Endgame','Digger'];
  // 각 위치 주변 검사
  for(const p of positions){
    const seg = h.slice(p, p+8000);
    const hits = check.filter(t=>seg.includes(t));
    if(hits.length) { console.log('pos',p,'-> hits:', hits.join(',')); }
  }
  // 전체에서 검사
  console.log('--- 전체 문서 ---');
  check.forEach(t=>console.log((h.includes(t)?'  HIT ':'  --- ')+t));
})();
