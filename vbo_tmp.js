
require('dotenv').config({path:'.env.local', quiet:true});
const KEY=process.env.TMDB_API_KEY;
// Verity, Digger, Primetime 이 TMDB에서 뭔지 확인
async function search(q){
  const u=new URL('https://api.themoviedb.org/3/search/movie');
  u.searchParams.set('api_key',KEY); u.searchParams.set('query',q); u.searchParams.set('language','en-US');
  const r=await fetch(u); const j=await r.json();
  return (j.results||[]).slice(0,3).map(m=>({id:m.id,title:m.title,date:m.release_date,vote:m.vote_average}));
}
(async()=>{
  for(const q of ['Verity','Digger','Primetime','Forgotten Island','Avengers: Endgame']){
    console.log('--- '+q+' ---');
    (await search(q)).forEach(x=>console.log('  ',x.id,x.title,'|',x.date,'| ★',x.vote));
  }
})();
