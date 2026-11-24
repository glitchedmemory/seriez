require('dotenv').config({path:'.env.local', quiet:true});
(async()=>{
  const r = await fetch('http://127.0.0.1:3000/?probe='+Date.now());
  const h = await r.text();
  // 박스오피스 섹션 찾기
  const i = h.indexOf('박스오피스');
  const j = h.indexOf('Box Office');
  const idx = i>=0? i : j;
  console.log('idx:', idx);
  if(idx>0){
    const seg = h.slice(idx, idx+6000);
    // 영화 제목 후보 추출
    const titles = [...seg.matchAll(/\*\s*([\d.]+)/g)].length;
    console.log('segment:');
    console.log(seg.slice(0,1500));
  }
})();
