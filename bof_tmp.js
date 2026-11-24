
const fs=require('fs');
const d=JSON.parse(fs.readFileSync('data/boxoffice.json','utf8'));
console.log('generatedAt:', d.generatedAt);
console.log('week:', d.week);
console.log('');
const usIds = (d.countries.US||[]).map(m=>m.id).join(',');
for (const c of ['US','FR','KR','JP','GB','DE']) {
  const arr = d.countries[c]||[];
  const ids = arr.map(m=>m.id).join(',');
  console.log(`--- ${c} (${arr.length}) ${ids===usIds && c!=='US' ? '⚠️ US와 동일' : ''} ---`);
  arr.slice(0,4).forEach((m,i)=>console.log('  '+(i+1)+'.', m.title, '|', m.year||''));
}
console.log('');
console.log('=== US == FR ? ===', usIds === (d.countries.FR||[]).map(m=>m.id).join(',') ? 'YES (문제)' : 'NO (정상)');
