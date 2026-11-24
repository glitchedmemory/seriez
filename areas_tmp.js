
// 11개국 BOM 주차별 데이터 확정 여부 확인
const AREAS = ['','GB','AU','MX','KR','JP','FR','DE','ES','CN','BR'];
async function rows(area, week){
  const url = `https://www.boxofficemojo.com/weekend/${week}/` + (area?`?area=${area}`:'');
  try{
    const r = await fetch(url, {headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}});
    const t = await r.text();
    const n = (t.match(/mojo-field-type-money/g)||[]).length;
    return n;
  }catch(e){ return -1; }
}
(async()=>{
  for (const wk of ['2026W45','2026W46','2026W47']){
    const line = [];
    for (const a of AREAS){
      const n = await rows(a, wk);
      line.push(`${a||'US'}=${n}`);
      await new Promise(s=>setTimeout(s,1500));
    }
    console.log(wk+': '+line.join(' '));
    await new Promise(s=>setTimeout(s,2000));
  }
})();
