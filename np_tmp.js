
require('dotenv').config({path:'.env.local', quiet:true});
const KEY=process.env.TMDB_API_KEY;
async function tget(path, params){
  const u=new URL('https://api.themoviedb.org/3'+path);
  u.searchParams.set('api_key',KEY); u.searchParams.set('language','en-US');
  Object.entries(params||{}).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetch(u); if(!r.ok){console.log('ERR',path,r.status);return {results:[]};}
  return r.json();
}
(async()=>{
  console.log('=== TMDB /movie/now_playing (US) ===');
  const np = await tget('/movie/now_playing',{region:'US'});
  (np.results||[]).slice(0,10).forEach((m,i)=>{
    console.log((i+1)+'.', m.id, m.title, '| 개봉:', m.release_date);
  });
  console.log('');
  console.log('=== TMDB /movie/popular ===');
  const pop = await tget('/movie/popular',{});
  (pop.results||[]).slice(0,10).forEach((m,i)=>{
    console.log((i+1)+'.', m.id, m.title, '| 개봉:', m.release_date);
  });
  console.log('');
  console.log('오늘:', new Date().toISOString().slice(0,10));
})();
