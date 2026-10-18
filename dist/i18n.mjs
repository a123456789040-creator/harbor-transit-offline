import game from './i18n-game.mjs';
import history from './i18n-history.mjs';
import realtime from './i18n-realtime.mjs';
import extra from './i18n-extra.mjs';

const messages={...game,...history,...realtime,...extra};
const normalize=text=>text.replace(/\s+/g,' ').trim();
const exact=new Map(Object.entries(messages).map(([source,target])=>[normalize(source),target]));
const escape=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const chinese=/[\u3400-\u9fff]/;
const templates=[...exact].filter(([source])=>/\{\d+\}/.test(source)).sort((a,b)=>b[0].length-a[0].length).map(([source,target])=>{
  const slots=[];let pattern='',last=0;
  for(const match of source.matchAll(/\{(\d+)\}/g)){pattern+=escape(source.slice(last,match.index))+'(.*?)';slots.push(Number(match[1]));last=match.index+match[0].length;}
  return {pattern:new RegExp('^'+pattern+escape(source.slice(last))+'$'),slots,target};
});
const fragments=[...exact.keys()].filter(source=>source.length>1&&chinese.test(source)&&!source.includes('{')).sort((a,b)=>b.length-a.length);
const fragmentPattern=new RegExp(fragments.map(escape).join('|'),'g');
const cache=new Map();
const hanCount=text=>(text.match(/[\u3400-\u9fff]/g)||[]).length;
const literalFragments=source=>source.replace(fragmentPattern,(match,offset)=>chinese.test(source[offset-1]||'')||chinese.test(source[offset+match.length]||'')?match:exact.get(match));
export function translateEnglish(value,depth=0){
  const text=String(value??'');if(!chinese.test(text)||depth>6)return text;
  const source=normalize(text);if(cache.has(source))return text.replace(text.trim(),()=>cache.get(source));
  let result=exact.get(source);
  if(result===undefined){
    for(const template of templates){const match=source.match(template.pattern);if(!match)continue;const values={};template.slots.forEach((slot,i)=>values[slot]=translateEnglish(match[i+1],depth+1));result=template.target.replace(/\{(\d+)\}/g,(_,slot)=>values[slot]??'');break;}
  }
  const literal=literalFragments(source);
  if(result===undefined||hanCount(literal)<hanCount(result))result=literal;
  if(cache.size>12000)cache.clear();cache.set(source,result);
  return text.replace(text.trim(),()=>result);
}
const KEY='harbor-transit-language-v1';
export function preferredLanguage(){
  if(typeof location==='undefined')return 'zh-Hant';
  const query=new URLSearchParams(location.search).get('lang');
  if(query==='en'||query==='zh-Hant'){try{localStorage.setItem(KEY,query);}catch{}return query;}
  try{if(localStorage.getItem(KEY)==='en')return 'en';}catch{}
  return 'zh-Hant';
}
export const language=preferredLanguage();
export const t=value=>language==='en'?translateEnglish(value):String(value??'');
export function changeLanguage(value,city){
  const next=value==='en'?'en':'zh-Hant';try{localStorage.setItem(KEY,next);}catch{}
  const url=new URL(location.href);url.searchParams.set('lang',next);if(city)url.searchParams.set('city',city);location.assign(url);
}
const attributes=['title','placeholder','aria-label','alt','content'];
export function localizeDOM(root){
  if(language!=='en'||!root)return;
  const text=node=>{if(node.parentElement?.closest('script,style,[data-keep-language]'))return;const result=t(node.nodeValue);if(result!==node.nodeValue)node.nodeValue=result;};
  const element=node=>{if(node.matches?.('[data-keep-language]'))return;for(const name of attributes){if(!node.hasAttribute?.(name))continue;const value=node.getAttribute(name),result=t(value);if(value!==result)node.setAttribute(name,result);}};
  if(root.nodeType===3){text(root);return;}
  element(root);const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let node;
  while(node=walker.nextNode())node.nodeType===3?text(node):element(node);
}
let observer;
export function startI18n(){
  document.documentElement.lang=language;
  if(observer||language!=='en')return;
  const options={subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes};
  localizeDOM(document.documentElement);
  observer=new MutationObserver(records=>{
    observer.disconnect();const roots=new Set();
    for(const record of records){if(record.type==='childList')for(const node of record.addedNodes)roots.add(node);else roots.add(record.target);}
    for(const root of roots)if(root.isConnected)localizeDOM(root);
    observer.observe(document.documentElement,options);
  });
  observer.observe(document.documentElement,options);
}
