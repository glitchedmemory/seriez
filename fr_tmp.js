
// FR이 W46에서 0인 이유 확인 - 전용 스크래퍼(AlloCiné) vs BOM
async function bomRows(area, week){
  const url = `https://www.boxofficemojo.com/weekend/${week}/` + (area?`?area=${area}`:'');
  try{
    const r = await fetch(url, {headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}});
    const t = await r.text();
    // area 페이지가 실제로 그 국가인지 확인
    const title = (t.match(/<title>([^<]*)<\/title>/)||[])[1]||'';
    const n = (t.match(/mojo-field-type-money/g)||[]).length;
    return {n, title: title.slice(0,80)};
  }catch(e){ return {n:-1, title:'ERR'}; }
}
(async()=>{
  for (const wk of ['2026W46','2026W47']){
    for (const a of ['FR','KR','JP','CN']){
      const r = await bomRows(a, wk);
      console.log(wk, a, '-> rows:', r.n, '| title:', r.title);
      await new Promise(s=>setTimeout(s,2000));
    }
  }
})();
