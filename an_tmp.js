
const Q = "query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){media(status:NOT_YET_RELEASED,type:ANIME,sort:POPULARITY_DESC){id title{romaji english} coverImage{extraLarge large} bannerImage averageScore startDate{year month day} genres}}}";
(async()=>{
  const r=await fetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:Q,variables:{page:1,perPage:4}})});
  console.log('status:',r.status);
  if(!r.ok){console.log((await r.text()).slice(0,300));return;}
  const j=await r.json();
  const media=j.data?.Page?.media||[];
  console.log('returned:',media.length);
  media.forEach((m,i)=>{
    console.log((i+1)+'. '+m.title?.romaji+' | poster:'+(m.coverImage?.extraLarge?'YES':'NO')+' | start:'+JSON.stringify(m.startDate));
  });
})();
