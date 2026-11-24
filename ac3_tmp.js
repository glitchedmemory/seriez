
(async()=>{
  const r = await fetch('https://www.allocine.fr/boxoffice/france/', {
    headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
  });
  const h = await r.text();
  // 마지막 등장 위치(CSS 이후 실제 마크업)
  let i = h.lastIndexOf('meta-title-link');
  console.log('last idx:', i, '/ total:', h.length);
  console.log(h.slice(Math.max(0,i-900), i+700));
})();
