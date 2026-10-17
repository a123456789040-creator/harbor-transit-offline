import {createHistoryModel} from './history-model.mjs';
import {withFutureRail} from './future-rail.mjs';
export const HISTORY_CITIES=[{id:'taipei',name:'台北'},{id:'hongkong',name:'香港'},{id:'tokyo',name:'東京'},{id:'newyork',name:'紐約'},{id:'kansai',name:'大阪・京都'}];
const loaders={
  hongkong:()=>Promise.all([import('./hongkong-history-data.mjs'),import('./maps/hongkong-terrain.mjs')]),
  tokyo:()=>Promise.all([import('./tokyo-history-data.mjs'),import('./maps/tokyo-terrain.mjs')]),
  newyork:()=>Promise.all([import('./newyork-history-data.mjs'),import('./maps/newyork-terrain.mjs')]),
  kansai:()=>Promise.all([import('./kansai-history-data.mjs'),import('./maps/kansai-terrain.mjs')]),
};
const cache=new Map();
export function loadHistoryCity(id='taipei',includeFuture=false){
  if(!HISTORY_CITIES.some(city=>city.id===id))return Promise.reject(new Error('未知歷史城市'));
  if(!cache.has(id)){
    const pending=id==='taipei'?Promise.all([import('./history-network.mjs'),import('./taipei-history-data.mjs'),import('./taipei-ridership-data.mjs'),import('./taipei-geography.mjs')]).then(([network,data,ridership,geography])=>({cityId:id,city:geography.TAIPEI_GEOGRAPHY,metadata:{...data.HISTORY_METADATA,id,name:'台北'},network:network.HISTORY_NETWORK,events:data.HISTORY_EVENTS,ridership:ridership.RIDERSHIP,operationEras:data.HISTORY_OPERATION_ERAS,snapshotAt:network.snapshotAt,servicesAt:network.servicesAt,samplePath:network.samplePath})):
      loaders[id]().then(([data,geography])=>createHistoryModel(data.default,geography.default));
    cache.set(id,pending.catch(error=>{cache.delete(id);throw error;}));
  }
  return includeFuture?cache.get(id).then(withFutureRail):cache.get(id);
}
