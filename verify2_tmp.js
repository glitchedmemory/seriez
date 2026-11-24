
require('dotenv').config({path:'.env.local', quiet:true});
const fs=require('fs');
const src=fs.readFileSync('lib/tmdb.ts','utf8');
const s=src.indexOf('export async function getUpcoming');
const e=src.indexOf('export async function getNowPlaying');
let body=src.slice(s,e);

// TS 타입 제거
body=body.replace('export async function getUpcoming()','async function getUpcoming()')
  .replace(/:\s*Promise<[^>]*\[\]>/g,'')
  .replace(/\(item:\s*any\)/g,'(item)')
  .replace(/\(results as [^)]*\)/g,'(results)')
  .replace(/\bas TmdbItem\[\]/g,'')
  .replace(/\bas any\b/g,'')
  .replace(/\bas string\b/g,'')
  .replace(/<[A-Za-z]+\[\]>/g,'')
  .replace(/\bget\(/g,'tmdbGet(')
  .replace(/\bmovieData\.results\b/g,'movieData.results')
  .replace(/\btvData\.results\b/g,'tvData.results');

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
try{
  eval(body);
  (async()=>{
    const r=await getUpcoming();
    console.log('=== 실제 수정된 getUpcoming() ===');
    console.log('반환:', r.length, '| 포스터O:', r.filter(x=>x.poster).length);
    r.forEach((x,i)=>console.log((i+1)+'.',x.type,x.id,x.title,'| poster:',x.poster?'Y':'N'));
    const Q=`query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){media(status:NOT_YET_RELEASED,type:ANIME,sort:POPULARITY_DESC){id}}}`;
    const ar=await fetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:Q,variables:{page:1,perPage:4}})});
    const an=((await ar.json()).data?.Page?.media||[]).length;
    console.log('AniList:',an,'| 최종 합계:',r.length+an);
  })();
}catch(err){
  console.log('EVAL_FAIL:', err.message);
  console.log('--- 본문 미리보기 ---');
  console.log(body.slice(0,600));
}
