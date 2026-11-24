function getBOMWeek(offsetDays){
  const now=new Date();
  const lastWeek=new Date(now.getTime()-offsetDays*86400000);
  const year=lastWeek.getFullYear();
  const jan1=new Date(year,0,1);
  const dayOfWeek=(jan1.getDay()+6)%7;
  const weekNum=Math.ceil((((lastWeek.getTime()-jan1.getTime())/86400000)-dayOfWeek+1)/7);
  return year+'W'+weekNum;
}
(async()=>{
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  for (const off of [7, 0]) {
    const wk = getBOMWeek(off);
    const url = 'https://www.boxofficemojo.com/weekend/'+wk+'/';
    try {
      await page.goto(url, {waitUntil:'domcontentloaded', timeout:30000});
      const rows = await page.evaluate(()=>{
        const out=[];
        document.querySelectorAll('table.mojo-body-table tr').forEach(r=>{
          const t=r.querySelector('.mojo-field-type-release');
          const g=r.querySelector('.mojo-field-type-money');
          if(t&&g) out.push({title:(t.textContent||'').trim(), gross:(g.textContent||'').trim()});
        });
        return out.slice(0,10);
      });
      console.log('=== offset '+off+'d => '+wk+' ===');
      console.log('URL:', url);
      console.log('rows:', rows.length);
      rows.forEach((r,i)=>console.log(' '+(i+1)+'.', r.title, '|', r.gross));
    } catch(e){ console.log('ERR', wk, e.message); }
  }
  await browser.close();
})();
