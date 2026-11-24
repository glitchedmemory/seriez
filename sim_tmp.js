
require('dotenv').config({path:'.env.local', quiet:true});
const KEY=process.env.TMDB_API_KEY;
async function tget(path, params){
  const u=new URL('https://api.themoviedb.org/3'+path);
  u.searchParams.set('api_key',KEY); u.searchParams.set('language','en-US');
  Object.entries(params||{}).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetch(u); if(!r.ok) return {results:[]};
  return r.json();
}
function format(it){
  const d = it.release_date || it.first_air_date;
  let daysUntil=null;
  if(d){ const diff=Math.ceil((new Date(d).getTime()-Date.now())/86400000); daysUntil = diff>0?diff:null; }
  return { id:it.id, title:it.title||it.name, poster:it.poster_path?('https://image.tmdb.org/t/p/w780'+it.poster_path):null,
           year: d?parseInt(d.slice(0,4)):0, daysUntil, type: it.title?'movie':'tv' };
}
const noAnime=(it)=>!((it.genre_ids||[]).includes(16)&&it.original_language==='ja');
const Q=`query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){media(status:NOT_YET_RELEASED,type:ANIME,sort:POPULARITY_DESC){id title{romaji english} coverImage{extraLarge} seasonYear}}}`;

(async()=>{
  const today=new Date(); const f90=new Date(today); f90.setDate(f90.getDate()+90);
  const to=today.toISOString().slice(0,10), f9=f90.toISOString().slice(0,10);
  const [mv,tv]=await Promise.all([
    tget('/movie/upcoming',{region:'US',sort_by:'popularity.desc'}),
    tget('/discover/tv',{'first_air_date.gte':to,'first_air_date.lte':f9,sort_by:'popularity.desc'}),
  ]);

  // ===== 현재 로직 (BEFORE) =====
  const mvBefore=(mv.results||[]).filter(noAnime)
    .filter(it=>{const d=it.release_date;if(!d)return true;return new Date(d).getTime()>=Date.now();})
    .map(format)
    .filter(it=>{ if(!it.daysUntil) return it.year===0; return it.daysUntil>0; });
  const tvBefore=(tv.results||[]).filter(noAnime).map(format)
    .filter(it=>{ if(!it.daysUntil) return it.year===0; return it.daysUntil>0; }).slice(0,5);
  const before=[...mvBefore.slice(0,5), ...tvBefore];
  const beforeFiltered = before.filter(x=>x.poster);

  // ===== 수정 후 (AFTER): 포스터 필터를 slice 앞으로 =====
  const mvAfter=(mv.results||[]).filter(noAnime)
    .filter(it=>{const d=it.release_date;if(!d)return true;return new Date(d).getTime()>=Date.now();})
    .map(format)
    .filter(it=>{ if(!it.daysUntil) return it.year===0; return it.daysUntil>0; })
    .filter(it=>it.poster)
    .slice(0,5);
  const tvAfter=(tv.results||[]).filter(noAnime).map(format)
    .filter(it=>{ if(!it.daysUntil) return it.year===0; return it.daysUntil>0; })
    .filter(it=>it.poster)
    .slice(0,5);
  const after=[...mvAfter, ...tvAfter];
  const afterFiltered = after.filter(x=>x.poster);

  console.log('=== BEFORE (현재) ===');
  console.log('반환 개수:', before.length, '| 포스터 필터 후:', beforeFiltered.length);
  console.log('=== AFTER (수정) ===');
  console.log('반환 개수:', after.length, '| 포스터 필터 후:', afterFiltered.length);

  const r=await fetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:Q,variables:{page:1,perPage:4}})});
  const j=await r.json();
  const anCount=(j.data?.Page?.media||[]).length;
  console.log('');
  console.log('AniList:', anCount);
  console.log('최종 BEFORE:', beforeFiltered.length + anCount);
  console.log('최종 AFTER :', afterFiltered.length + anCount);
  console.log('');
  console.log('=== AFTER 새로 들어온 항목 ===');
  const beforeIds=new Set(beforeFiltered.map(x=>x.id));
  afterFiltered.filter(x=>!beforeIds.has(x.id)).forEach(x=>console.log('  +', x.type, x.id, x.title, '| days:', x.daysUntil));
  console.log('=== AFTER 빠진 항목 ===');
  const afterIds=new Set(afterFiltered.map(x=>x.id));
  beforeFiltered.filter(x=>!afterIds.has(x.id)).forEach(x=>console.log('  -', x.type, x.id, x.title));
})();
