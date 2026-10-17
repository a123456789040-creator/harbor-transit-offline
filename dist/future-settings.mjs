export function futurePreference(){
  const query=new URLSearchParams(location.search).get('future');
  if(query!==null)return query==='1';
  try{return localStorage.getItem('harbor-transit-future-v1')==='true';}catch{return false;}
}
export function saveFuturePreference(enabled){try{localStorage.setItem('harbor-transit-future-v1',String(enabled));}catch{}}
