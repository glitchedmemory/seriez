
require('dotenv').config({path:'.env.local', quiet:true});
const KEY=process.env.TMDB_API_KEY;
async function tget(path, params){
  const u=new URL('https://api.themoviedb.org/3'+path);
  u.searchParams.set('api_key',KEY); u.searchParams.set('language','en-US');
  Object.entries(params||{}).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetch(u); if(!r.ok) return {results:[]};
  return r.json();
}
(async()=>{
  const today=new Date(); const f90=new Date(today); f90.setDate(f90.getDate()+90);
  const to=today.toISOString().slice(0,10), f9=f90.toISOString().slice(0,10);
  const [mv,tv]=await Promise.all([
    tget('/movie/upcoming',{region:'US',sort_by:'popularity.desc'}),
    tget('/discover/tv',{'first_air_date.gte':to,'first_air_date.lte':f9,sort_by:'popularity.desc'}),
  ]);
  const noAnime=(it)=>!((it.genre_ids||[]).includes(16)&&it.original_language==='ja');
  const mvOk=(mv.results||[]).filter(noAnime).filter(it=>it.poster_path).filter(it=>{const d=it.release_date;if(!d)return true;return new Date(d).getTime()>=Date.now();});
  const tvOk=(tv.results||[]).filter(noAnime).filter(it=>it.poster_path);
  console.log('movies 유효(포스터O, 미래):', mvOk.length);
  console.log('tv 유효(포스터O):', tvOk.length);
  console.log('=> 포스터 필터만 적용하면 movies 5 + tv 5 = 10 확보 가능');
  console.log('');
  console.log('현재 손실 원인 항목들(포스터 없음):');
  (mv.results||[]).filter(it=>!it.poster_path).forEach(it=>console.log('  movie',it.id,it.title||it.name));
  (tv.results||[]).forEach(it=>{ if(!it.poster_path) console.log('  tv',it.id,it.name||it.title,'(slice 5위 안)'); });
})();
