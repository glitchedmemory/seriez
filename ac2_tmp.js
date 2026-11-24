
(async()=>{
  const r = await fetch('https://www.allocine.fr/boxoffice/france/', {
    headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
  });
  const h = await r.text();
  // 첫 영화 항목의 주변 HTML 구조 확인
  const i = h.indexOf('meta-title-link');
  console.log('--- around first title ---');
  console.log(h.slice(Math.max(0,i-1200), i+900));
})();
