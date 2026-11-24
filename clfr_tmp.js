
const fs=require('fs');
const p='data/boxoffice.json';
const d=JSON.parse(fs.readFileSync(p,'utf8'));
console.log('정리 전 FR:', (d.countries.FR||[]).length, '개');
// FR 오염 제거 - AlloCiné로 새로 받을 것이므로 비움
d.countries.FR = [];
fs.writeFileSync(p, JSON.stringify(d,null,2));
console.log('정리 후 FR:', JSON.parse(fs.readFileSync(p,'utf8')).countries.FR.length, '개');
console.log('US는 보존:', JSON.parse(fs.readFileSync(p,'utf8')).countries.US.length, '개');
