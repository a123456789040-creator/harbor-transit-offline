import assert from 'node:assert/strict';
import game from '../dist/i18n-game.mjs';
import history from '../dist/i18n-history.mjs';
import realtime from '../dist/i18n-realtime.mjs';
import extra from '../dist/i18n-extra.mjs';
import {translateEnglish,t,preferredLanguage} from '../dist/i18n.mjs';
const slots=text=>[...text.matchAll(/\{(\d+)\}/g)].map(m=>m[1]).sort();
for(const [source,target] of Object.entries({...game,...history,...realtime,...extra})){assert(target&&typeof target==='string',source);assert.deepEqual(slots(target),slots(source),'translation preserves values: '+source);}
assert.equal(preferredLanguage(),'zh-Hant');assert.equal(t('車站大小'),'車站大小','Node/default language preserves Chinese behavior');
assert.equal(translateEnglish('規劃新站：開'),'New stations: On');assert.equal(translateEnglish('規劃新站 12 / 50 · 已關閉，既有車站保留；城市目錄照常開放。'),'New stations 12 / 50 · Disabled. Existing stations remain; the city catalog continues to open.');
assert.equal(translateEnglish('  規劃新站：開\n '),'  New stations: On\n ');assert.equal(translateEnglish('  規劃新站：開\n '),'  New stations: On\n ','cached translations preserve whitespace');
assert.equal(translateEnglish('尖沙咀'),'尖沙咀','unverified station names remain unchanged');assert.equal(translateEnglish('Harbor Transit $&'),'Harbor Transit $&');
assert.equal(translateEnglish('台北車站'),'台北車站','city-name fragments must not alter a longer station name');
assert(!translateEnglish('民生汐止線臺北市段：綜合規劃審議中；通車年未定；規劃中。').includes('綜合規劃'),'compound project notes keep their complete date caveat translation');
console.log('PASS: bilingual message catalogs, placeholder preservation, default Chinese, nested dynamic values, whitespace/cache and native names');
