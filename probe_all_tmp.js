
require('dotenv').config({path:'.env.local', quiet:true});
const KEY=process.env.TMDB_API_KEY;

async function tget(path, params){
  const u=new URL('https://api.themoviedb.org/3'+path);
  u.searchParams.set('api_key',KEY); u.searchParams.set('language','en-US');
  Object.entries(params||{}).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetch(u); if(!r.ok) return {results:[]};
  return r.json();
}
function fmt(it){
  const d = it.release_date || it.first_air_date;
  return { id: it.id, title: it.title||it.name, poster: it.poster_path, date: d,
    daysUntil: d ? Math.ceil((new Date(d).getTime()-Date.now())/86400000) : null,
    type: it.title ? 'movie':'tv' };
}
const Q = `query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){media(status:NOT_YET_RELEASED,type:ANIME,sort:POPULARITY_DESC){id title{romaji english} coverImage{extraLarge} startDate{year month day} seasonYear}}}`;

(async()=>{
  const today=new Date(); const f90=new Date(today); f90.setDate(f90.getDate()+90);
  const to=today.toISOString().slice(0,10), f9=f90.toISOString().slice(0,10);
  const [mv,tv] = await Promise.all([
    tget('/movie/upcoming',{region:'US',sort_by:'popularity.desc'}),
    tget('/discover/tv',{'first_air_date.gte':to,'first_air_date.lte':f9,sort_by:'popularity.desc'}),
  ]);
  const noAnime=(it)=>!((it.genre_ids||[]).includes(16)&&it.original_language==='ja');
  const movies=(mv.results||[]).filter(noAnime).filter(it=>{const d=it.release_date; if(!d)return true; return new Date(d).getTime()>=Date.now();}).map(fmt).filter(it=>{ if(!it.daysUntil) return false; return it.daysUntil>0; });
  const tvs=(tv.results||[]).filter(noAnime).map(fmt).filter(it=>{ if(!it.daysUntil) return false; return it.daysUntil>0; }).slice(0,5);
  const tmdbArr=[...movies.slice(0,5), ...tvs];
  console.log('=== TMDB getUpcoming ===');
  console.log('movies.slice(0,5) =', movies.slice(0,5).length);
  tmdbArr.forEach((x,i)=>console.log(' ',i+1,x.type,x.id,x.title,'days:',x.daysUntil,'poster:',x.poster?'Y':'N'));

  const r=await fetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:Q,variables:{page:1,perPage:4}})});
  const j=await r.json();
  const media=j.data?.Page?.media||[];
  const anArr=media.map(m=>({id:m.id,title:m.title?.english||m.title?.romaji,poster:m.coverImage?.extraLarge?'Y':'N',year:m.seasonYear}));
  console.log('=== AniList getAnimeUpcoming ===');
  console.log('count:', anArr.length);
  anArr.forEach((x,i)=>console.log(' ',i+1,x.id,x.title));

  const all=[...tmdbArr, ...anArr];
  console.log('=== MERGED ===');
  console.log('total:', all.length);
  const ids=all.map(x=>x.id);
  const dup=ids.filter((v,i)=>ids.indexOf(v)!==i);
  console.log('duplicate ids:', dup.length? dup : 'none');
  const idsNoPoster=all.filter(x=>!x.poster || x.poster==='N');
  console.log('without poster:', idsNoPoster.length);
  console.log('=> rendered max 14, actual:', Math.min(14, all.length));
})();
