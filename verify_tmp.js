
require('dotenv').config({path:'.env.local', quiet:true});
const fs=require('fs');
// 실제 파일에서 getUpcoming 함수 본문만 추출해 실행
const src=fs.readFileSync('lib/tmdb.ts','utf8');
const s=src.indexOf('export async function getUpcoming');
const e=src.indexOf('export async function getNowPlaying');
let body=src.slice(s,e);
// TMDB get 함수와 format 의존성 최소 구현
const KEY=process.env.TMDB_API_KEY;
async function tmdbGet(endpoint, params){
  const u=new URL('https://api.themoviedb.org/3'+endpoint);
  u.searchParams.set('api_key',KEY); u.searchParams.set('language','en-US');
  Object.entries(params||{}).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetch(u); if(!r.ok) throw new Error('TMDB '+r.status);
  return r.json();
}
const poster=(p)=>p?('https://image.tmdb.org/t/p/w780'+p):null;
function format(it){
  const d=it.release_date||it.first_air_date;
  let daysUntil=null;
  if(d){const diff=Math.ceil((new Date(d).getTime()-Date.now())/86400000); daysUntil=diff>0?diff:null;}
  return {id:it.id,title:it.title||it.name,poster:poster(it.poster_path),
    year:d?parseInt(d.slice(0,4)):0,daysUntil,type:it.title?'movie':'tv'};
}
// 추출한 본문을 실행 가능한 함수로 변환
body=body.replace('export async function getUpcoming()','async function getUpcoming()')
         .replace(/\bget\(/g,'tmdbGet(')
         .replace(/TmdbItem/g,'any').replace(/TmdbResult/g,'any')
         .replace(/:\s*Promise<any\[\]>/,'');
eval(body);
(async()=>{
  const r=await getUpcoming();
  console.log('=== 실제 수정된 getUpcoming() 실행 결과 ===');
  console.log('반환 개수:', r.length);
  console.log('포스터 있는 개수:', r.filter(x=>x.poster).length);
  console.log('');
  r.forEach((x,i)=>console.log((i+1)+'.', x.type, x.id, x.title, '| poster:', x.poster?'Y':'N', '| days:', x.daysUntil));
  console.log('');
  // AniList
  const Q=`query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){media(status:NOT_YET_RELEASED,type:ANIME,sort:POPULARITY_DESC){id coverImage{extraLarge}}}}`;
  const ar=await fetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:Q,variables:{page:1,perPage:4}})});
  const aj=await ar.json();
  const an=(aj.data?.Page?.media||[]).length;
  console.log('AniList:', an);
  console.log('=== 최종 Coming Soon ===');
  console.log('합계:', r.length + an, '| 슬라이스(0,14) 후:', Math.min(14, r.length+an));
})();
