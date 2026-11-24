
const fs=require('fs');
const d=JSON.parse(fs.readFileSync('data/boxoffice.json','utf8'));
console.log('generatedAt:', d.generatedAt);
console.log('week:', d.week);
console.log('');
// 각 국가 첫 3개만
for (const c of ['US','FR','KR','GB','JP']) {
  const arr = d.countries[c]||[];
  console.log(`--- ${c} (${arr.length}) ---`);
  arr.slice(0,3).forEach((m,i)=>console.log('  '+(i+1)+'.', m.title, '|', m.year||''));
}
console.log('');
// US와 FR이 같은지 확인 (덮어쓰기 검증)
const us = (d.countries.US||[]).map(m=>m.id).join(',');
const fr = (d.countries.FR||[]).map(m=>m.id).join(',');
console.log('US ids:', us);
console.log('FR ids:', fr);
console.log('US == FR ?', us===fr ? 'YES (덮어쓰기됨 - 문제)' : 'NO (정상)');
