
require('dotenv').config({path:'.env.local', quiet:true});
const KEY=process.env.TMDB_API_KEY;
async function tget(path, params){
  const u=new URL('https://api.themoviedb.org/3'+path);
  u.searchParams.set('api_key',KEY); u.searchParams.set('language','en-US');
  Object.entries(params||{}).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetch(u); if(!r.ok) return {results:[]};
  return r.json();
}
const Q=`query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){media(status:NOT_YET_RELEASED,type:ANIME,sort:POPULARITY_DESC){id title{romaji english} coverImage{extraLarge} seasonYear}}}`;
(async()=>{
  const today=new Date(); const f90=new Date(today); f90.setDate(f90.getDate()+90);
  const to=today.toISOString().slice(0,10), f9=f90.toISOString().slice(0,10);
  const [mv,tv]=await Promise.all([
    tget('/movie/upcoming',{region:'US',sort_by:'popularity.desc'}),
    tget('/discover/tv',{'first_air_date.gte':to,'first_air_date.lte':f9,sort_by:'popularity.desc'}),
  ]);
  console.log('TMDB 영화 원본:', (mv.results||[]).length, '/ TV 원본:', (tv.results||[]).length);
  const noA=(it)=>!((it.genre_ids||[]).includes(16)&&it.original_language==='ja');
  const mvOk=(mv.results||[]).filter(noA).filter(it=>it.poster_path).filter(it=>{const d=it.release_date;if(!d)return true;return new Date(d).getTime()>=Date.now();});
  const tvOk=(tv.results||[]).filter(noA).filter(it=>it.poster_path).filter(it=>it.first_air_date && new Date(it.first_air_date).getTime()>=Date.now());
  console.log('영화 유효(포스터O+미래):', mvOk.length);
  console.log('TV 유효(포스터O+미래):', tvOk.length);
  // AniList perPage 4 vs 25
  for (const pp of [4, 25]) {
    const r=await fetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:Q,variables:{page:1,perPage:pp}})});
    const j=await r.json();
    const m=j.data?.Page?.media||[];
    console.log('AniList perPage='+pp+' -> 실제 반환:', m.length, '| 포스터O:', m.filter(x=>x.coverImage?.extraLarge).length);
  }
})();
