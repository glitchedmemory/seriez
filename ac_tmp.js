
// AlloCiné FR 박스오피스 실제 작동 확인
(async()=>{
  try{
    const r = await fetch('https://www.allocine.fr/boxoffice/france/', {
      headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'}
    });
    console.log('status:', r.status);
    const h = await r.text();
    console.log('size:', h.length);
    const titles = [...h.matchAll(/class="meta-title-link"[^>]*>([^<]+)<\/a>/g)].map(m=>m[1].trim());
    const grosses = [...h.matchAll(/[\d\s]+entrées/g)].map(m=>m[0].trim());
    console.log('titles found:', titles.length);
    console.log('grosses found:', grosses.length);
    titles.slice(0,10).forEach((t,i)=>console.log('  '+(i+1)+'.', t, '|', grosses[i]||'?'));
  }catch(e){ console.log('ERR:', e.message); }
})();
