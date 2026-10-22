import {startI18n,t} from './i18n.mjs';
startI18n();
import {HISTORY_CITIES,loadHistoryCity} from './history-cities.mjs';
import {paintTerrain} from './terrain.mjs';
import {paintRailLines} from './rail-map.mjs';
import {mountDisplaySettings} from './display-settings.mjs';
import {mountPinchZoom} from './touch-map.mjs';
import {REALTIME_ZONES,cityTime,createTimetable,frequencyFrame,frequencyDepartures,sampleTrain,parseHongKong,parseTaipei,freshTimestamp} from './realtime-model.mjs';
import {taipeiFrequencyPatterns} from './realtime-taipei.mjs';
import {createLivePositions} from './realtime-positions.mjs';
import {createPlaybackClock,cityDateTime,cityDateTimeEpoch} from './realtime-clock.mjs';
import {HONGKONG_LIVE,TAIPEI_LIVE,TAIPEI_TRAVEL_TIMES,TAIPEI_PUBLIC_SERVICE_FACTS} from './realtime-hk-taipei-data.mjs';

const $=id=>document.getElementById(id),query=new URLSearchParams(location.search),requested=query.get('city'),cityId=HISTORY_CITIES.some(c=>c.id===requested)?requested:'taipei';
const model=await loadHistoryCity(cityId),timeZone=REALTIME_ZONES[cityId],snapshot=model.snapshotAt(),stationById=new Map(snapshot.stations.map(s=>[s.id,s])),lineById=new Map(snapshot.lines.map(l=>[l.id,l]));
let data=null,timetable=null,dataError='';
if(['newyork','tokyo','kansai'].includes(cityId))try{const response=await fetch(cityId==='newyork'?'realtime-newyork-data.json':`realtime-${cityId}-runtime.json`);if(!response.ok)throw new Error();data=await response.json();timetable=createTimetable(model,data);}catch{dataError='班表載入失敗，請重新載入。';}
const frequency=cityId==='taipei'?taipeiFrequencyPatterns(model):[],livePositions=createLivePositions(model,data),covered=new Set(timetable?.lines||frequency.map(p=>p.lineId));
if(cityId==='hongkong')for(const id of HONGKONG_LIVE.coverage)covered.add(id);
const display=mountDisplaySettings($('display-settings')),canvas=$('realtime-map'),ctx=canvas.getContext('2d'),hasRelay=false,canRefresh=false;
let started=false,zoom=1,panX=0,panY=0,transform={scale:1,x:0,y:0},drag=null,hovered=null,selected=null,shown=30,selectedLine='',trains=[],packet=null,arrivals=[],events=[],pending=false,lastAttempt=0,feedError='',expired=false,testNow=null,background=null;
let selectedStation='',boardRows=[],following=false,followed=null,drawnTrains=[],lastFrameUpdate=-Infinity,updates=0;
const playback=createPlaybackClock({wallNow:()=>testNow??Date.now()}),now=playback.now,name=id=>stationById.get(id)?.name||id||'',lineName=id=>lineById.get(id)?.name||id||'',node=(tag,text)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;return el;};
const quality={timetable:'官方班表・站間推估','published-timetable':'官方班表・站間推估','published-station-departures':'官方逐站發車・到達時刻未全公布','terminal-departures-estimated-offsets':'官方起站時刻・中途推估','published-headway-model':'官方班距模型・示意相位','frequency-estimate':'班距推估・示意相位','live-entry-estimate':'官方進站事件・離站後推估','station-event':'最近進站事件','live-station-status':'官方列車狀態・站間位置示意','arrival-illustration':'官方到站預測・動畫示意'};
const coverage={
 taipei:'台北捷運 BR／R／G／O／BL 與兩條支線：官方站間秒數及班距模型。區網版另顯示近期進站事件，這不是完整車隊；班距模型不含國定假日調整、區間加班車。環狀線、機捷及輕軌目前沒有完整可用逐班班表，保留地圖。',
 hongkong:'港鐵十條重鐵綫各取一個參考站，顯示最近到站預測。抵站前 90 秒的站間動畫僅供示意，不代表列車目前位置；其他預測以站點標記呈現。沒有完整車隊或 GPS，未涵蓋輕鐵與高鐵。',
 newyork:'紐約地鐵 26 條路線的官方常態班表，含平日、週末、例外日與凌晨跨日班次。區網版另接八組官方即時列車站點／狀態；沒有 GPS，站間位置只作示意。常態班表不含多數臨時改點。',
 kansai:'大阪 Metro 八線與 New Tram：雙向平日／土休日起站發車表，中間時間與終站到達推估，含已辨識起站短程車，尚缺中途始發折返車。京都烏丸／東西線、京阪本線／中之島／鴨東／交野／宇治線採逐站時刻。JR 西日本補入京都、大阪、天王寺、京橋四樞紐可查的一般列車逐站表，並非全部 JR 班次。依日本當地時鐘、假日與跨日服務推估位置；臨時延誤與未取得班表的路線不補造列車。',
 tokyo:'東京 Metro 九線、都營四線的官方逐站發車時刻，以及 JR 東日本主要通勤幹線的當月逐班表。含短程車、平日／土休日與凌晨服務；直通列車依既有物理軌道分段繪製。未公布的到達時刻保留空值，只畫到最後可核對的站時。站間位置為推估，未接即時定位或延誤；其餘私鐵尚無班表。'
};
document.title=`${model.metadata.name}即時運行｜河港路網`;
$('realtime-title').textContent=$('realtime-setup-title').textContent=`${model.metadata.name}・城市此刻`;
$('realtime-zone').textContent=`${timeZone} · 唯讀觀賞`;$('realtime-limit').textContent=$('setup-coverage').textContent=cityId==='taipei'?'離線班距推估：不接進站事件，非當日定位。':cityId==='hongkong'?'離線版沒有到站預測；保留全部現況車站與路線。':cityId==='tokyo'?'公開版未附可散布的東京班表；保留完整地圖。':cityId==='kansai'&&!false?'公開離線版只附京都市開放班表；其他線路保留地圖。':'離線班表展示：依已附資料及有效期推估，不含延誤或當日異動。';
$('realtime-history').href=`history.html?city=${cityId}`;
for(const city of HISTORY_CITIES){const a=node('a',city.name);a.href=`realtime.html?city=${city.id}`;if(city.id===cityId)a.setAttribute('aria-current','page');$('realtime-nav').append(a);}
for(const line of snapshot.lines){const o=node('option',`${line.name}${covered.has(line.id)?'':' · 無班次資料'}`);o.value=line.id;$('realtime-line').append(o);}
let sources=cityId==='newyork'?[{label:'MTA 官方地鐵班表',url:data?.source.url},{label:'MTA 資料使用條款',url:data?.source.terms},{label:'MTA 即時資料說明',url:'https://www.mta.info/developers'}]:data?.sources;
if(cityId==='hongkong')sources=[{label:'港鐵下一班車 API',url:HONGKONG_LIVE.catalog},{label:'港鐵 API 規格與精度',url:HONGKONG_LIVE.spec},{label:'香港政府資料使用條款',url:HONGKONG_LIVE.terms}];
if(cityId==='taipei')sources=[{label:'台北捷運進站資料（每 30 秒）',url:TAIPEI_LIVE.catalog},{label:'台北官方站間旅行與停靠秒數',url:TAIPEI_TRAVEL_TIMES.catalog},...TAIPEI_PUBLIC_SERVICE_FACTS.facts.filter(f=>covered.has(f.lineId)).map(f=>({label:`${lineName(f.lineId)}官方營運資訊`,url:f.source})),{label:'政府資料開放授權條款',url:TAIPEI_LIVE.terms}];
if(['tokyo','kansai'].includes(cityId)&&sources?.length>15){const details=node('details'),summary=node('summary',`查看 ${sources.length} 項官方時刻來源`);details.append(summary);$('realtime-sources').append(details);for(const source of sources){const a=node('a',(source.label||source.id)+' ↗');a.href=source.url;a.target='_blank';a.rel='noreferrer';details.append(a);}}
else for(const source of sources||[]){if(!source.url)continue;const a=node('a',(source.label||source.id||'官方來源')+' ↗');a.href=source.url;a.target='_blank';a.rel='noreferrer';$('realtime-sources').append(a);if(source.attribution)$('realtime-sources').append(node('small',source.attribution));}
if(data?.validUntil)$('realtime-sources').append(node('small',`班表有效期：${data.validFrom} 至 ${data.validUntil}；期滿停止班表推估，需更新資料。`));
if(data?.source?.lastModified)$('realtime-sources').append(node('small',`官方檔案更新：${data.source.lastModified}`));
if(cityId==='newyork')$('realtime-sources').append(node('small','本作非 MTA 官方或授權應用。資料由本作伺服器下載保存後轉送；MTA 不保證資料精確、完整或即時。超過 1 分鐘的即時資料不再作為即時狀態使用。'));
if(data?.metadata?.fetchedAt)$('realtime-sources').append(node('small',`班表整理日期：${data.metadata.fetchedAt.slice(0,10)}。${cityId==='kansai'?'京都市交通局原始 CSV：CC-BY 4.0。':''}`));
if(['tokyo','kansai'].includes(cityId)){
 const dated=[...new Set(data?.services.filter(s=>s.validUntil).map(s=>`${s.validFrom} 至 ${s.validUntil}`))];
 if(dated.length)$('realtime-sources').append(node('small',`有期限的逐班表：${dated.join('；')}。期滿只停止對應服務，其他有效班表繼續。`));
 if(data?.metadata.sampleDates?.length)$('realtime-sources').append(node('small',`官方站表查詢參考日：${data.metadata.sampleDates.join('、')}；未當作改點生效日。`));
 const versions=[...new Set(data?.services.map(s=>s.timetableAsOf).filter(Boolean))];
 if(versions.length)$('realtime-sources').append(node('small',`官方站表目前版本：${versions.join('、')}。這是官網版本標示，未當作改點生效日。`));
 for(const url of new Set((sources||[]).map(s=>s.terms).filter(Boolean))){const a=node('a','業者資料利用條款 ↗');a.href=url;a.target='_blank';a.rel='noreferrer';$('realtime-sources').append(a);}
 $('realtime-sources').append(node('small','官方公開時刻的數值重整；東京 Metro／都營、JR、Osaka Metro 與私鐵不因此成為開放授權資料。本作非官方應用，不能反映當日臨時異動。'));
 $('realtime-sources').append(node('small','沿既有官方線位繪製；部分圖資保有軌道缺口，跨缺口時可能跳移，沒有補畫不存在的直線軌道。'));
 if(cityId==='kansai')$('realtime-sources').append(node('small','JR 西日本的週日／國定假日使用本次週六代表表，可能與特殊日實際時刻不同；不是逐日即時班表。'));
}
const anchors=HONGKONG_LIVE.coverage.map(lineId=>{const list=HONGKONG_LIVE.stations.filter(s=>s.lineId===lineId);return list[Math.floor(list.length/2)];});
async function fetchJson(url){const response=await fetch(url,{signal:AbortSignal.timeout(10000),cache:'no-store'});if(!response.ok)throw new Error('官方來源暫時無法使用');return response.json();}
async function refresh(){
 if(!started||pending||!canRefresh||!playback.live)return;pending=true;lastAttempt=Date.now();$('live-refresh').disabled=true;
 try{
  if(cityId==='hongkong'){
   const results=await Promise.allSettled(anchors.map(async anchor=>{const url=new URL(HONGKONG_LIVE.endpoint);url.search=new URLSearchParams({line:anchor.lineId,sta:anchor.code,lang:'TC'});return parseHongKong(await fetchJson(url),anchor,now());}));
   const good=results.filter(r=>r.status==='fulfilled').map(r=>r.value);arrivals=good.flatMap(r=>r.arrivals);feedError=good.length<anchors.length?'部分參考站暫時無資料':'';
   if(!good.length)throw new Error('官方到站來源暫時無法使用');
  }else if(hasRelay&&['taipei','newyork'].includes(cityId)){
   try{packet=await fetchJson(`api/realtime?city=${cityId}`);}catch{packet=await fetchJson(`realtime-cache/${cityId}.json`);}
   if(packet.city!==cityId)throw new Error('來源城市不符');
   if(cityId==='taipei')events=parseTaipei(packet.events,model,now());feedError=packet.unavailable?.length?`${packet.unavailable.length} 組來源暫缺`:'';
  }
 }catch(error){feedError=error.message;}
 finally{pending=false;update();}
}
function describe(t){
 const target=name(t.toId),origin=name(t.fromId);
 if(t.kind==='arrival-illustration')return `${target} · 約 ${Math.ceil(t.nextIn/60)} 分鐘後到站${t.delayed?' · 官方提示延誤':''}`;
 if(t.kind==='station-event')return `${target} · 最近進站記錄`;
 if(t.kind==='live-station-status')return t.atStation?`${target} · 官方回報停站`:t.status===0?`正接近 ${target}`:`往 ${target} 途中 · 站間位置示意`;
 return t.atStation?`${target} · ${t.kind==='live-entry-estimate'?'進站後推估停靠':'班表停站'}`:`${origin} → ${target}${Number.isFinite(t.nextIn)?` · 約 ${Math.ceil(t.nextIn)} 秒`:''}`;
}
function update(){
 updates++;
 const epoch=now(),clock=cityTime(epoch,timeZone);$('realtime-clock').textContent=clock.clock;$('realtime-date').textContent=clock.date;
 let frame=timetable?.frame(epoch);expired=!!frame?.expired;trains=started?(frame?.trains||frequencyFrame(model,frequency,epoch)):[];
 let live=false,status=cityId==='taipei'?'官方班距推估':'依官方時刻表推估',updated='';
 if(frame?.expiredServices)updated='部分班表已過有效期；對應服務已停止，其他有效班表繼續。';
 if(started&&playback.live&&cityId==='hongkong'){trains=livePositions.hongkong(arrivals,epoch);live=trains.length>0;status=live?'官方到站預測（參考站）':'目前沒有有效到站預測';updated=live?`來源時間 ${cityTime(Math.max(...arrivals.map(a=>a.timestamp)),timeZone).clock}`:feedError||'可能已收車、來源延遲或尚未連線。';}
 if(started&&playback.live&&cityId==='taipei'){
  const current=livePositions.taipei(events,epoch);if(current.length){trains.push(...current);live=true;status='班距推估＋官方局部進站事件';updated=`最新進站記錄 ${cityTime(Math.max(...events.map(e=>e.timestamp)),timeZone).clock}`;}
 }
 if(started&&playback.live&&cityId==='newyork'){
  const fresh=(packet?.feeds||[]).filter(f=>freshTimestamp(f.timestamp*1000,epoch,60000));
  if(fresh.length){trains=livePositions.mta(packet,epoch);live=true;status='官方列車站點／運行狀態';updated=`${fresh.length} / 8 組來源 · ${cityTime(Math.max(...fresh.map(f=>f.timestamp*1000)),timeZone).clock}`;}
 }
 if(!live&&['taipei','newyork'].includes(cityId))updated=hasRelay?(feedError||'等待即時來源；目前使用班表／班距推估。'):'此入口使用已整理的班表／班距；區網版可接官方即時來源。';
 if(!playback.live){updated='班表播放不使用當前即時資訊，也不代表歷史實際車況。';if(cityId==='hongkong')status='此城市沒有已收錄班表可供播放';}
 if(expired&&!live)status='班表已過有效期・停止班表推估';
 if(dataError)status=dataError;
 if(started&&cityId==='hongkong')status='離線版沒有到站預測';if(started&&cityId==='tokyo'&&!timetable?.lines.length)status='公開版未附東京業者班表';$('live-status').textContent=started?status:'開始前可調整外觀';$('live-badge').textContent=live?(cityId==='hongkong'?'官方到站預測':'官方即時資訊'):'班表／班距推估';$('live-badge').dataset.live=String(live);$('live-updated').textContent='離線版不連線更新；沒有 GPS 或當日延誤資訊。';
 if(selectedLine)trains=trains.filter(t=>t.lineId===selectedLine||t.lineIds?.includes(selectedLine));
 $('realtime-count').textContent=`${snapshot.stations.length} 個真實站點 · ${cityId==='hongkong'?'到站預測':live&&cityId==='taipei'?'推估列車＋局部事件':live?'官方列車':'推估列車'} ${trains.length} 筆`;
 $('realtime-coverage').textContent=`已收錄班次：${covered.size} / ${snapshot.lines.length} 條${['tokyo','kansai'].includes(cityId)?'物理軌道路線（直通車分段繪製）':'路線'}${selectedLine&&!covered.has(selectedLine)?'；所選路線無班次來源。':'。'}`;
 $('realtime-disclosure').textContent=live?(cityId==='hongkong'?'即時到站預測；抵站前 90 秒的動畫僅示意，並非列車定位。':cityId==='taipei'?'班距推估與局部進站事件並列，可能重疊；無逐車識別或 GPS，不將事件冒認為推估班次。':'官方站點／狀態；站間位置示意，無 GPS 座標。'):'依城市當地時間推估運行；未涵蓋臨時延誤或停駛。';
 $('live-refresh').disabled=!canRefresh||!playback.live||pending;
 if(!playback.live)$('realtime-disclosure').textContent='班表播放不使用當前即時資訊，也不代表歷史實際車況。';
 renderTrains();renderBoard();renderFollow();renderPlayback();
}
function renderPlayback(){
 const epoch=now(),p=cityTime(epoch,timeZone);$('playback-mode').textContent=playback.live?'城市現在':playback.paused?'班表播放・已暫停':`班表播放・${playback.speed}×`;$('playback-mode').dataset.live=String(playback.live);
 $('playback-toggle').textContent=playback.paused?'播放':'暫停';$('playback-toggle').setAttribute('aria-pressed',String(playback.paused));
 if(document.activeElement!==$('playback-datetime'))$('playback-datetime').value=cityDateTime(epoch,timeZone);
 if(document.activeElement!==$('playback-range'))$('playback-range').value=String(Math.min(86340,Math.floor(p.seconds/60)*60));
 $('playback-range').setAttribute('aria-valuetext',`${p.date} ${p.clock} · ${timeZone}`);$('playback-speed').value=String(playback.speed);
 $('playback-note').textContent=`${timeZone} · 以城市當地時間選擇；班表播放不代表歷史實際車況。`;
 for(const id of ['playback-toggle','playback-speed','playback-datetime','playback-range','playback-now'])$(id).disabled=!started;
}
function seekPlayback(value){
 const epoch=cityDateTimeEpoch(value,timeZone);$('playback-datetime').setCustomValidity(epoch===null?t('此城市日期或時間無效。'):'');
 if(epoch===null){$('playback-datetime').reportValidity();return;}
 playback.seek(epoch);update();
}
$('playback-datetime').oninput=()=>$('playback-datetime').setCustomValidity('');$('playback-datetime').onchange=()=>seekPlayback($('playback-datetime').value);
$('playback-range').oninput=()=>{const date=cityTime(now(),timeZone).date,seconds=Number($('playback-range').value);seekPlayback(`${date}T${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds%3600/60)).padStart(2,'0')}:00`);};
$('playback-toggle').onclick=()=>{playback.toggle();update();};$('playback-speed').onchange=()=>{playback.setSpeed(Number($('playback-speed').value));update();};
$('playback-now').onclick=()=>{playback.reset();$('playback-datetime').setCustomValidity('');$('playback-datetime').value=cityDateTime(now(),timeZone);update();refresh();};
function renderTrains(){
 const container=$('realtime-trains'),visible=trains.slice(0,shown);$('train-total').textContent=String(trains.length);$('show-more').hidden=trains.length<=shown;
 if(!trains.length){container.replaceChildren(node('p',started?(selectedLine&&!covered.has(selectedLine)?'此路線尚無可用班次來源。':'此時段沒有已涵蓋的班次，或官方來源暫缺。'):'開始後顯示此刻班次。'));return;}
 const focused=container.contains(document.activeElement),existing=new Map([...container.querySelectorAll('button')].map(b=>[b.dataset.id,b]));
 if(!focused)for(const child of [...container.children])if(!visible.some(t=>t.id===child.dataset.id))child.remove();
 for(const train of visible){
  let button=existing.get(train.id);if(!button){if(focused)continue;button=node('button');button.className='realtime-train';button.dataset.id=train.id;button.append(node('strong'),node('span'),node('small'));button.onclick=()=>followTrain(train);container.append(button);}
  button.style.setProperty('--train-color',lineById.get(train.lineId)?.color||'#466d80');button.setAttribute('aria-pressed',String(selected===train.id));button.children[0].textContent=`${train.name||lineName(train.lineId)}${train.destination?' → '+name(train.destination):''}`;button.children[1].textContent=describe(train);button.children[2].textContent=quality[train.kind]||'時刻推估';
 }
}
function fillStations(){
 const select=$('realtime-station'),search=$('station-search').value.trim().toLocaleLowerCase();
 select.replaceChildren(node('option','點選地圖車站，或在此選站'));select.firstChild.value='';
 for(const station of snapshot.stations.filter(s=>s.name.toLocaleLowerCase().includes(search)||s.id===selectedStation).sort((a,b)=>a.name.localeCompare(b.name))){const option=node('option',`${station.name} · ${(station.lineIds||[]).map(lineName).join('／')}`);option.value=station.id;select.append(option);}
 select.value=selectedStation;
}
function chooseStation(id){selectedStation=id;hovered=stationById.get(id);following=false;fillStations();if(hovered)focusPoint(hovered);renderBoard();renderFollow();}
function renderBoard(){
 const container=$('station-departures');
 if(!started||!selectedStation){container.replaceChildren();boardRows=[];return;}
 boardRows=timetable?.departures(selectedStation,now())||frequencyDepartures(model,frequency,selectedStation,now());
 if(selectedLine)boardRows=boardRows.filter(row=>row.lineId===selectedLine);
 const groups=new Map();for(const row of boardRows){const key=`${row.lineId}:${row.nextId}`;if(!groups.has(key))groups.set(key,[]);if(groups.get(key).length<4)groups.get(key).push(row);}
 const visible=[...groups.values()].flat(),focused=container.contains(document.activeElement),key=visible.map(row=>`${row.id}:${row.stationId}`).join('|');
 if(container.dataset.key!==key&&!focused){container.replaceChildren();for(const rows of groups.values()){
   const group=node('div');group.className='departure-direction';const title=node('h3',`${lineName(rows[0].lineId)} · 經 ${name(rows[0].nextId)}`);title.style.borderColor=lineById.get(rows[0].lineId)?.color||'#617784';group.append(title);
   for(const row of rows){const button=node('button');button.className='departure-row';button.dataset.id=row.id;button.append(node('strong'),node('span'),node('small'));button.onclick=()=>followTrain(row);group.append(button);}container.append(group);
  }container.dataset.key=key;
 }
 for(const button of container.querySelectorAll('button')){const row=boardRows.find(r=>r.id===button.dataset.id);if(!row){button.disabled=true;continue;}button.disabled=false;button.setAttribute('aria-pressed',String(selected===row.id));button.children[0].textContent=`往 ${name(row.destination)}`;button.children[1].textContent=`${cityTime(row.departureAt,timeZone).clock} · 約 ${Math.max(0,Math.ceil((row.departureAt-now())/1000))} 秒後發車`;button.children[2].textContent=quality[row.kind]||'時刻推估';}
 if(!visible.length&&!focused){container.replaceChildren(node('p','此站未來 30 分鐘沒有已收錄的發車資料；終點站不列入該方向。'));container.dataset.key='';}
}
function followTrain(train){
 selected=train.id;followed=train;following=true;
 if(selectedLine&&train.lineId!==selectedLine){selectedLine='';$('realtime-line').value='';}
 const point=sampleTrain(train,now())||train;focusPoint(point);renderFollow();renderTrains();
}
function currentFollow(){return selected&&(trains.find(t=>t.id===selected)||trains.find(t=>followed?.operationId&&t.operationId===followed.operationId)||followed);}
function followPosition(){const train=currentFollow();if(!train||!train.motion&&!trains.some(t=>t.id===train.id))return null;return sampleTrain(train,now())||(train.departureAt>=now()?train:null);}
function renderFollow(){
 const card=$('follow-card'),train=currentFollow();card.hidden=!train;if(!train)return;
 followed=train;selected=train.id;const point=followPosition();if(!point)following=false;
 $('follow-title').textContent=`${lineName(train.lineId)} → ${name(train.destination)}`;
 $('follow-state').textContent=!point?'此班次已結束':following?'持續跟車中':'已解除跟車';
 $('follow-detail').textContent=point?(point===train&&train.departureAt>now()?`等待始發 · 約 ${Math.ceil((train.departureAt-now())/1000)} 秒`:describe(point)):'此班次已結束，請選擇其他班次。';
 $('follow-quality').textContent=quality[train.kind]||'時刻推估';$('follow-toggle').textContent=following?'解除跟車':'繼續跟車';$('follow-toggle').setAttribute('aria-pressed',String(following));$('follow-toggle').disabled=!point;
}
function detachFollow(){if(following){following=false;renderFollow();}}
fillStations();$('station-search').oninput=fillStations;$('realtime-station').onchange=()=>chooseStation($('realtime-station').value);
$('follow-toggle').onclick=()=>{following=!following;renderFollow();};$('follow-close').onclick=()=>{following=false;selected=null;followed=null;renderFollow();};
function focusPoint(point){zoom=Math.max(zoom,3);const scale=Math.min(canvas.clientWidth/1100,(canvas.clientHeight-60)/700)*zoom;panX=(550-point.x)*scale;panY=(350-point.y)*scale;}
function zoomAt(next,x,y){const previous=zoom,cx=canvas.clientWidth/2,cy=(canvas.clientHeight+60)/2;zoom=Math.max(.7,Math.min(16,next));panX=(panX+cx-x)*zoom/previous-cx+x;panY=(panY+cy-y)*zoom/previous-cy+y;}
function draw(frameTime){
 if(started&&frameTime-lastFrameUpdate>=250){lastFrameUpdate=frameTime;update();}
 drawnTrains=trains.map(t=>sampleTrain(t,now())).filter(Boolean);const tracked=followPosition();if(following&&tracked){focusPoint(tracked);if(!drawnTrains.some(t=>t.id===selected))drawnTrains.push(tracked);}
 const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr),scale=Math.min(rect.width/1100,(rect.height-60)/700)*zoom;
 if(w&&h&&scale>0){
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  transform={scale,x:(rect.width-1100*scale)/2+panX,y:60+(rect.height-60-700*scale)/2+panY};
  const priority=new Set([selectedStation,tracked?.fromId,tracked?.toId]),padding=256,key=[w,h,scale,selectedLine,display.values.line,display.values.station,...priority].join(':');
  if(background?.key!==key||Math.abs(background.x-transform.x)>padding||Math.abs(background.y-transform.y)>padding){const layer=background?.canvas||document.createElement('canvas');layer.width=w+padding*2*dpr;layer.height=h+padding*2*dpr;const c=layer.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.fillStyle='#d1e5ec';c.fillRect(0,0,layer.width/dpr,layer.height/dpr);c.translate(transform.x+padding,transform.y+padding);c.scale(scale,scale);paintTerrain(c,model.city,scale);
   paintRailLines(c,snapshot.legs.map(l=>({...l,color:selectedLine&&l.lineId!==selectedLine||!covered.has(l.lineId)?'#aabac2':l.color})),scale,display.values.line/100);
   const labels=[];
   for(const s of [...snapshot.stations].sort((a,b)=>Number(priority.has(b.id))-Number(priority.has(a.id)))){c.beginPath();c.arc(s.x,s.y,2.2*display.values.station/100/scale,0,Math.PI*2);c.fillStyle='#fff';c.fill();c.lineWidth=.8/scale;c.strokeStyle='#627b88';c.stroke();if(zoom>=2.5&&(!selectedLine||s.lineIds.includes(selectedLine))){c.font=`${9/scale}px sans-serif`;const box={x:s.x+4/scale,y:s.y-13/scale,w:c.measureText(s.name).width+4/scale,h:14/scale};if(labels.some(b=>box.x<b.x+b.w&&box.x+box.w>b.x&&box.y<b.y+b.h&&box.y+box.h>b.y))continue;labels.push(box);c.strokeStyle='#fffffff0';c.lineWidth=3/scale;c.strokeText(s.name,s.x+4/scale,s.y-4/scale);c.fillStyle='#3d5666';c.fillText(s.name,s.x+4/scale,s.y-4/scale);}}
   background={key,canvas:layer,x:transform.x,y:transform.y};
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.drawImage(background.canvas,(transform.x-background.x)-padding,(transform.y-background.y)-padding,background.canvas.width/dpr,background.canvas.height/dpr);ctx.translate(transform.x,transform.y);ctx.scale(scale,scale);
  for(const t of drawnTrains){if(!Number.isFinite(t.x)||!Number.isFinite(t.y))continue;ctx.save();ctx.translate(t.x,t.y);ctx.rotate(t.angle||0);const size=display.values.train/100;ctx.scale(size,size);ctx.fillStyle=lineById.get(t.lineId)?.color||'#456e84';ctx.strokeStyle='#fff';ctx.lineWidth=1.2/scale;ctx.beginPath();
   if(Number.isFinite(t.angle)){ctx.moveTo(-4.5/scale,-2/scale);ctx.lineTo(1.5/scale,-2/scale);ctx.lineTo(4.5/scale,0);ctx.lineTo(1.5/scale,2/scale);ctx.lineTo(-4.5/scale,2/scale);ctx.closePath();}
   else ctx.roundRect(-4.5/scale,-2/scale,9/scale,4/scale,1/scale);
   ctx.fill();ctx.stroke();if(selected===t.id){ctx.beginPath();ctx.arc(0,0,9/scale,0,Math.PI*2);ctx.strokeStyle='#263f52';ctx.lineWidth=1/scale;ctx.stroke();}ctx.restore();}
  if(hovered){ctx.beginPath();ctx.arc(hovered.x,hovered.y,6/scale,0,Math.PI*2);ctx.strokeStyle='#263f52';ctx.lineWidth=1/scale;ctx.stroke();}
 }
 requestAnimationFrame(draw);
}
function inspect(event,activate=false){
 const r=canvas.getBoundingClientRect(),p={x:(event.clientX-r.left-transform.x)/transform.scale,y:(event.clientY-r.top-transform.y)/transform.scale},radius=(event.pointerType==='touch'?16:8)/transform.scale;
 const nearest=items=>items.reduce((best,item)=>{const d=Math.hypot(item.x-p.x,item.y-p.y);return d<radius&&(!best||d<Math.hypot(best.x-p.x,best.y-p.y))?item:best;},null),train=nearest(drawnTrains);hovered=nearest(snapshot.stations);
 if(train){if(activate)followTrain(train);$('realtime-hover').textContent=`${lineName(train.lineId)} · ${describe(train)} · ${quality[train.kind]||'推估'}`;}
 else $('realtime-hover').textContent=hovered?`${hovered.name} · ${(hovered.lineIds||[]).map(lineName).join('／')}`:'點選車站或列車查看資訊 · 雙指縮放／拖曳平移';
 if(activate&&!train&&hovered)chooseStation(hovered.id);
}
$('zoom-in').onclick=()=>zoomAt(zoom*1.4,canvas.clientWidth/2,canvas.clientHeight/2);$('zoom-out').onclick=()=>zoomAt(zoom/1.4,canvas.clientWidth/2,canvas.clientHeight/2);$('zoom-fit').onclick=()=>{zoom=1;panX=panY=0;detachFollow();};
canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoomAt(zoom*Math.exp(-e.deltaY*.001),e.clientX-r.left,e.clientY-r.top);},{passive:false});
canvas.addEventListener('pointerdown',e=>{if(e.button!==0||pinch.active)return;drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(drag){if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>5)drag.moved=true;if(drag.moved){detachFollow();panX+=e.clientX-drag.x;panY+=e.clientY-drag.y;}drag.x=e.clientX;drag.y=e.clientY;}else inspect(e);});
canvas.addEventListener('pointerup',e=>{if(drag&&!drag.moved&&!pinch.active)inspect(e,true);drag=null;});
for(const event of ['pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{drag=null;});
canvas.addEventListener('keydown',e=>{if(e.code==='Space'&&started){e.preventDefault();playback.toggle();update();}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();detachFollow();panX+=e.key==='ArrowLeft'?30:e.key==='ArrowRight'?-30:0;panY+=e.key==='ArrowUp'?30:e.key==='ArrowDown'?-30:0;}});
const pinch=mountPinchZoom(canvas,{cancel:()=>{drag=null;detachFollow();},zoom:(ratio,from,to)=>{zoomAt(zoom*ratio,from.x,from.y);panX+=to.x-from.x;panY+=to.y-from.y;}});
$('realtime-line').onchange=()=>{selectedLine=$('realtime-line').value;shown=30;selected=null;followed=null;following=false;update();};$('show-more').onclick=()=>{shown+=30;renderTrains();};$('live-refresh').onclick=refresh;
$('realtime-start').onclick=()=>{started=true;display.lock();$('realtime-setup').close();update();refresh();canvas.focus();};$('realtime-setup').addEventListener('cancel',e=>e.preventDefault());
document.addEventListener('visibilitychange',()=>{if(!document.hidden){update();if(Date.now()-lastAttempt>30000)refresh();}});
setInterval(()=>{if(started&&Date.now()-lastAttempt>=30000)refresh();},1000);
$('live-refresh').disabled=!canRefresh;update();$('realtime-setup').showModal();requestAnimationFrame(draw);
if(query.has('test'))window.realtimeTransit={model,get cityId(){return cityId;},get trains(){return trains;},get drawnTrains(){return drawnTrains;},get boardRows(){return boardRows;},get following(){return following;},get selected(){return selected;},get display(){return display.values;},get view(){return {...transform,zoom};},get expired(){return expired;},get playback(){return {epoch:now(),live:playback.live,paused:playback.paused,speed:playback.speed,updates};},setTime(value){testNow=value;update();},chooseStation,refresh,update};
