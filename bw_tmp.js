
// BOM 주말 박스오피스가 언제 갱신되는지: 주차 페이지 존재 여부로 확인
async function head(url){
  try{
    const r = await fetch(url, {method:'GET', headers:{'User-Agent':'Mozilla/5.0'}});
    const t = await r.text();
    // 실제 데이터 행이 있는지
    const rows = (t.match(/mojo-field-type-money/g)||[]).length;
    return {status:r.status, rows};
  }catch(e){ return {status:'ERR', rows:0}; }
}
(async()=>{
  // 오늘 2026-11-23 기준 W45,W46,W47,W48 확인
  for (const w of [45,46,47,48]) {
    const wk = `2026W${w}`;
    const r = await head(`https://www.boxofficemojo.com/weekend/${wk}/`);
    console.log(wk, '-> status:', r.status, '| 데이터 행:', r.rows);
    await new Promise(s=>setTimeout(s,3000));
  }
})();
