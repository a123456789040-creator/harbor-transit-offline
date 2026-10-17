// Public-source opening history. Current station names/codes identify historical stations consistently.
const MIL = 'https://www.metro.taipei/cp.aspx?n=b27e7bc8cbbcda61';
const OPS13 = 'https://data.taipei/api/dataset/a03272e7-362b-4bad-9e93-c0cc0e58ffcd/resource/89aaee52-5e8b-4090-9f6e-33df2a55354a/download';
const OPS14 = 'https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=21cefb8e-16fa-4193-a55c-b4ec45023a1b';
const NT = 'https://www.ntmetro.com.tw/basic/';
const TY = 'https://www.tymetro.com.tw/tymetro-new/tw/_pages/';
const CSS = 'https://web.metro.taipei/pages2026/css/webstyle.css';
const ROUTES = 'https://www.metro.taipei/cp.aspx?n=EAD981369A065968&s=';
const sources = {
  BR: ROUTES + 'C58C8C2C6419810F', R: ROUTES + '1CC297E1D0B4C7B1',
  G: ROUTES + '0F3F913C344BA050', O: ROUTES + 'E153D917FDC2AC69',
  BL: ROUTES + '3092796CF14AC78E', Y: NT + '?node=10069',
  V: NT + '?node=10070', K: NT + '?node=10071', LB: NT + '?node=10154',
  A: TY + 'travel-guide/introduce.html'
};
const colors = { BR: '#C48D32', R: '#E4002C', G: '#008659', O: '#F8B616', BL: '#0070BD', Y: '#FFDA00', V: '#DD5C57', K: '#A09367', LB: '#50BAD4', A: '#8246AF' };
const names = text => text.split('、');
const line = (id, name, stops, stationCodes) => {
  const base = id.split('-')[0];
  return { id, name, color: colors[base], stops: names(stops), stationCodes: stationCodes.split(' '), source: sources[base],
    colorSource: ['BR', 'R', 'G', 'O', 'BL', 'Y'].includes(base) ? CSS : sources[base],
    colorNote: ['V', 'K', 'LB'].includes(base) ? '官方圖檔主色取樣，非公佈hex規範。' : base === 'A' ? '官方路網圖PANTONE 2587 C的螢幕近似值；車種另以紫色直達、藍色普通區別。' : '官方網站現行CSS色值。' };
};

export const HISTORY_METADATA = {
  verifiedOn: '2026-10-17',
  scope: '雙北捷運（含三鶯）＋淡海與安坑輕軌＋桃園機場捷運',
  stationCodePolicy: '顯示現行站碼供比對；北捷旅客站碼2016年10月起分期導入，2017年5月完成，不能宣稱1996年已有BR等現行碼。',
  animationPolicy: '常態交路及停靠站示意；非即時列車、逐日歷史時刻表或災害停駛重現。速度、發車相位、停站秒數為視覺示意。',
  historicalLimits: [
    '未核實的歷史班距留空，不以2026年資料回填。',
    '不重演2001納莉、2024環狀線地震等臨時停駛及復駛。',
    '清晨深夜、加班車及機捷特殊跳站班次未完整納入歷史；應以官方當日時刻表為準。',
    '新店區公所更名列官方核定日；現場換牌完成日未核實。',
    '淡海綠山線2018-12-23舉行通車典禮，12-24起一般試營運。'
  ]
};

export const HISTORY_LINES = [
  line('BR', '文湖線', '動物園、木柵、萬芳社區、萬芳醫院、辛亥、麟光、六張犁、科技大樓、大安、忠孝復興、南京復興、中山國中、松山機場、大直、劍南路、西湖、港墘、文德、內湖、大湖公園、葫洲、東湖、南港軟體園區、南港展覽館', 'BR01 BR02 BR03 BR04 BR05 BR06 BR07 BR08 BR09 BR10 BR11 BR12 BR13 BR14 BR15 BR16 BR17 BR18 BR19 BR20 BR21 BR22 BR23 BR24'),
  line('R', '淡水信義線', '廣慈/奉天宮、象山、台北101／世貿、信義安和、大安、大安森林公園、東門、中正紀念堂、台大醫院、台北車站、中山、雙連、民權西路、圓山、劍潭、士林、芝山、明德、石牌、唭哩岸、奇岩、北投、復興崗、忠義、關渡、竹圍、紅樹林、淡水', 'R01 R02 R03 R04 R05 R06 R07 R08 R09 R10 R11 R12 R13 R14 R15 R16 R17 R18 R19 R20 R21 R22 R23 R24 R25 R26 R27 R28'),
  line('R-branch', '新北投支線', '北投、新北投', 'R22 R22A'),
  line('G', '松山新店線', '新店、新店區公所、七張、大坪林、景美、萬隆、公館、台電大樓、古亭、中正紀念堂、小南門、西門、北門、中山、松江南京、南京復興、台北小巨蛋、南京三民、松山', 'G01 G02 G03 G04 G05 G06 G07 G08 G09 G10 G11 G12 G13 G14 G15 G16 G17 G18 G19'),
  line('G-branch', '小碧潭支線', '七張、小碧潭', 'G03 G03A'),
  line('O', '中和新蘆線（新莊）', '南勢角、景安、永安市場、頂溪、古亭、東門、忠孝新生、松江南京、行天宮、中山國小、民權西路、大橋頭、台北橋、菜寮、三重、先嗇宮、頭前庄、新莊、輔大、丹鳳、迴龍', 'O01 O02 O03 O04 O05 O06 O07 O08 O09 O10 O11 O12 O13 O14 O15 O16 O17 O18 O19 O20 O21'),
  line('O-luzhou', '中和新蘆線（蘆洲支線）', '大橋頭、三重國小、三和國中、徐匯中學、三民高中、蘆洲', 'O12 O50 O51 O52 O53 O54'),
  line('BL', '板南線', '頂埔、永寧、土城、海山、亞東醫院、府中、板橋、新埔、江子翠、龍山寺、西門、台北車站、善導寺、忠孝新生、忠孝復興、忠孝敦化、國父紀念館、市政府、永春、後山埤、昆陽、南港、南港展覽館', 'BL01 BL02 BL03 BL04 BL05 BL06 BL07 BL08 BL09 BL10 BL11 BL12 BL13 BL14 BL15 BL16 BL17 BL18 BL19 BL20 BL21 BL22 BL23'),
  line('Y', '環狀線', '大坪林、十四張、秀朗橋、景平、景安、中和、橋和、中原、板新、板橋、新埔民生、頭前庄、幸福、新北產業園區', 'Y07 Y08 Y09 Y10 Y11 Y12 Y13 Y14 Y15 Y16 Y17 Y18 Y19 Y20'),
  line('V', '淡海輕軌綠山線', '紅樹林、竿蓁林、淡金鄧公、淡江大學、淡金北新、新市一路、淡水行政中心、濱海義山、濱海沙崙、淡海新市鎮、崁頂', 'V01 V02 V03 V04 V05 V06 V07 V08 V09 V10 V11'),
  line('V-blue', '淡海輕軌藍海線第一期', '濱海沙崙、台北海洋大學、沙崙、淡水漁人碼頭', 'V09 V28 V27 V26'),
  line('K', '安坑輕軌', '雙城、玫瑰中國城、台北小城、耕莘安康院區、景文科大、安康、陽光運動公園、新和國小、十四張', 'K01 K02 K03 K04 K05 K06 K07 K08 K09'),
  line('LB', '三鶯線', '頂埔、媽祖田、長壽山、橫溪、龍埔、三峽、台北大學、鶯歌車站、陶瓷老街、國華、永吉公園、鶯桃福德', 'LB01 LB02 LB03 LB04 LB05 LB06 LB07 LB08 LB09 LB10 LB11 LB12'),
  line('A', '桃園機場捷運', '台北車站、三重、新北產業園區、新莊副都心、泰山、泰山貴和、體育大學、長庚醫院、林口、山鼻、坑口、機場第一航廈、機場第二航廈、機場旅館、大園、橫山、領航、高鐵桃園、桃園體育園區、興南、環北、老街溪', 'A1 A2 A3 A4 A5 A6 A7 A8 A9 A10 A11 A12 A13 A14a A15 A16 A17 A18 A19 A20 A21 A22')
];
const byId = Object.fromEntries(HISTORY_LINES.map(item => [item.id, item]));
const part = (id, from, to) => {
  const stops = byId[id].stops, a = stops.indexOf(from), b = stops.indexOf(to);
  if (a < 0 || b < 0) throw new Error(`Unknown ${id} section: ${from}–${to}`);
  return a <= b ? stops.slice(a, b + 1) : stops.slice(b, a + 1).reverse();
};
const join = (...parts) => parts.reduce((all, stops) => all.concat(all.at(-1) === stops[0] ? stops.slice(1) : stops), []);
const opening = (date, title, sections, source = MIL, note) => ({ date, title, sections: sections.map(([lineId, from, to]) => ({ lineId, from, to })), source, ...(note ? { note } : {}) });

export const HISTORY_EVENTS = [
  opening('1996-03-28', '木柵線通車', [['BR', '動物園', '中山國中']]),
  opening('1997-03-28', '淡水線與新北投支線通車', [['R', '中山', '淡水'], ['R-branch', '北投', '新北投']]),
  opening('1997-12-25', '淡水線延伸台北車站', [['R', '台北車站', '中山']]),
  opening('1998-12-24', '淡水線南延、中和線與新店線北段通車', [['R', '中正紀念堂', '台北車站'], ['G', '古亭', '中正紀念堂'], ['O', '南勢角', '古亭']]),
  opening('1999-11-11', '新店線全線通車', [['G', '新店', '古亭']]),
  opening('1999-12-24', '板橋與南港線首段通車', [['BL', '龍山寺', '市政府']]),
  opening('2000-08-31', '板橋線延伸新埔、小南門線通車', [['BL', '新埔', '龍山寺'], ['G', '中正紀念堂', '西門']]),
  opening('2000-12-30', '南港線延伸昆陽', [['BL', '市政府', '昆陽']]),
  opening('2004-09-29', '小碧潭支線通車', [['G-branch', '七張', '小碧潭']]),
  opening('2006-05-31', '板橋線第二階段與土城線通車', [['BL', '永寧', '新埔']]),
  opening('2008-12-25', '南港線延伸南港', [['BL', '昆陽', '南港']]),
  opening('2009-07-04', '內湖線通車並直通木柵線', [['BR', '中山國中', '南港展覽館']]),
  opening('2010-11-03', '蘆洲線與新莊線台北市段通車', [['O', '忠孝新生', '大橋頭'], ['O-luzhou', '大橋頭', '蘆洲']]),
  opening('2011-02-27', '南港線東延南港展覽館', [['BL', '南港', '南港展覽館']]),
  opening('2012-01-05', '新莊線延伸輔大', [['O', '大橋頭', '輔大']]),
  opening('2012-09-30', '東門站通車，中和新蘆線貫通', [['O', '古亭', '忠孝新生']]),
  opening('2013-06-29', '新莊線延伸丹鳳、迴龍', [['O', '輔大', '迴龍']]),
  opening('2013-11-24', '信義線通車', [['R', '象山', '中正紀念堂']]),
  opening('2014-11-15', '松山線通車，紅綠線分流', [['G', '西門', '松山']]),
  opening('2015-07-06', '土城線延伸頂埔', [['BL', '頂埔', '永寧']]),
  opening('2017-03-02', '機場捷運正式通車', [['A', '台北車站', '環北']], TY + 'news/show-294-78.html'),
  opening('2018-12-23', '淡海輕軌綠山線通車', [['V', '紅樹林', '崁頂']], 'https://www.ntpc.gov.tw/mobile/home.jsp?dataserno=5e018236966319e1a3296eed880b8c99&id=e8ca970cde5c00e1', '12月23日通車典禮，12月24日起一般試營運。'),
  opening('2020-01-31', '環狀線第一階段通車', [['Y', '大坪林', '新北產業園區']]),
  opening('2020-11-15', '淡海輕軌藍海線第一期通車', [['V-blue', '濱海沙崙', '淡水漁人碼頭']], 'https://www.dorts.ntpc.gov.tw/about/route/LXlR27XkdV8v'),
  opening('2023-02-10', '安坑輕軌通車', [['K', '雙城', '十四張']], NT + '?mode=detail&node=578'),
  opening('2023-07-31', '機場捷運延伸老街溪', [['A', '環北', '老街溪']], TY + 'news/show-1822-1.html'),
  opening('2026-06-30', '三鶯線通車', [['LB', '頂埔', '鶯桃福德']], NT + '?mode=detail&node=867'),
  opening('2026-08-30', '信義線東延廣慈／奉天宮通車', [['R', '廣慈/奉天宮', '象山']], 'https://web.metro.taipei/event/taipeimetroextensionopening/')
];

export const HISTORY_ALIASES = {
  '台北101／世貿': ['台北101/世貿', '臺北101/世貿'], '台北車站': ['臺北車站'], '台大醫院': ['臺大醫院'],
  '台電大樓': ['臺電大樓'], '台北小巨蛋': ['臺北小巨蛋'], '台北橋': ['臺北橋'], '台北小城': ['臺北小城'],
  '台北海洋大學': ['臺北海洋大學'], '台北大學': ['臺北大學'], '南京復興': ['南京東路'],
  '新店區公所': ['新店市公所'], '廣慈/奉天宮': ['廣慈／奉天宮'], '景文科大': ['景文科技大學'], '陽光運動公園': ['陽光運動園區']
};
export const HISTORY_RENAMINGS = [
  { date: '2009-10-08', title: '木柵線與內湖線合併更名文山內湖線（文湖線）', source: MIL },
  { date: '2011-06-08', title: '新店市公所站更名新店區公所站（官方核定日；現場換牌完成日未核實）', station: '新店區公所', previousName: '新店市公所', source: 'https://data.taipei/api/dataset/ce96fcca-0b14-49be-8630-1b02d0c4c026/resource/d6cd5963-589e-40c0-a65f-6578a12b21ac/download' },
  { date: '2014-11-15', title: '南京東路站更名南京復興站', station: '南京復興', previousName: '南京東路', source: 'https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=3b94de93-e7ff-4a62-a668-729945a561d9' },
  { date: '2016-10-01', datePrecision: 'month', title: '現行旅客站碼自2016年10月起分階段導入，2017年5月完成（日期僅作月份定位）', source: 'https://www-ws.gov.taipei/001/Upload/405/relfile/18288/7592/ba9dffc6-8b10-41fc-9230-367d05c40d14.pdf' }
];

// shortcut: these are ordinary service patterns; add incident calendars only if daily operational history is required.
function servicesAt(date) {
  const services = [];
  const add = (id, lineIds, stops, source, extra = {}) => {
    const service = { id, color: byId[lineIds[0]].color, lineIds, stops, source, ...extra };
    services.push({ ...service, id: id + '-out', direction: 1 }, { ...service, id: id + '-back', stops: [...stops].reverse(), direction: -1 });
  };
  add('wenhu', ['BR'], part('BR', '動物園', date < '2009-07-04' ? '中山國中' : '南港展覽館'), MIL);
  if (date >= '1997-03-28') {
    add('xinbeitou', ['R-branch'], byId['R-branch'].stops, sources.R, { kind: 'shuttle' });
    if (date < '1998-12-24') add('tamsui', ['R'], part('R', '淡水', date < '1997-12-25' ? '中山' : '台北車站'), MIL);
    else if (date < '1999-11-11') add('tamsui-nanshijiao', ['R', 'G', 'O'], join(part('R', '淡水', '中正紀念堂'), part('G', '中正紀念堂', '古亭'), part('O', '古亭', '南勢角')), OPS14, { kind: 'through' });
    else if (date < '2014-11-15') {
      add('tamsui-xindian', ['R', 'G'], join(part('R', '淡水', '中正紀念堂'), part('G', '中正紀念堂', '新店')), OPS13, { kind: 'through' });
      if (date < '2012-09-30') add('beitou-nanshijiao', ['R', 'G', 'O'], join(part('R', '北投', '中正紀念堂'), part('G', '中正紀念堂', '古亭'), part('O', '古亭', '南勢角')), OPS14, { kind: 'through' });
      else if (date < '2013-11-24') add('beitou-taipower', ['R', 'G'], join(part('R', '北投', '中正紀念堂'), part('G', '中正紀念堂', '台電大樓')), OPS13, { kind: 'through' });
      else add('beitou-xiangshan', ['R'], part('R', '北投', '象山'), OPS13, { headwayMin: 6, headwayMax: 6 });
    } else {
      add('tamsui-xinyi', ['R'], part('R', '淡水', date >= '2026-08-30' ? '廣慈/奉天宮' : '象山'), sources.R);
      add('beitou-daan', ['R'], part('R', '北投', '大安'), sources.R, { kind: 'short-turn', note: '依公布時段開行，非全天固定班表。' });
    }
  }
  if (date >= '1999-12-24') {
    const west = date >= '2015-07-06' ? '頂埔' : date >= '2006-05-31' ? '永寧' : date >= '2000-08-31' ? '新埔' : '龍山寺';
    const east = date >= '2011-02-27' ? '南港展覽館' : date >= '2008-12-25' ? '南港' : date >= '2000-12-30' ? '昆陽' : '市政府';
    add('bannan', ['BL'], part('BL', west, east), MIL);
    if (date >= '2006-05-31') add('bannan-short', ['BL'], part('BL', '亞東醫院', east), sources.BL, { kind: 'short-turn', note: '區間車時段依各期班表，未重建每次調整。' });
  }
  if (date >= '2000-08-31' && date < '2014-11-15') {
    if (date < '2013-11-24') add('xiaonanmen', ['G'], part('G', '中正紀念堂', '西門'), MIL, { kind: 'shuttle' });
    else add('ximen-taipower', ['G'], part('G', '西門', '台電大樓'), OPS13, { kind: 'short-turn', headwayMin: 6, headwayMax: 6 });
  }
  if (date >= '2004-09-29') add('xiaobitan', ['G-branch'], byId['G-branch'].stops, sources.G, { kind: 'shuttle' });
  if (date >= '2010-11-03') {
    const south = date >= '2012-09-30' ? '南勢角' : '忠孝新生';
    add('luzhou', ['O', 'O-luzhou'], join(part('O', south, '大橋頭'), part('O-luzhou', '大橋頭', '蘆洲')), OPS14);
    if (date >= '2012-01-05') add('xinzhuang', ['O'], part('O', south, date >= '2013-06-29' ? '迴龍' : '輔大'), OPS14);
  }
  if (date >= '2014-11-15') {
    add('songshan-xindian', ['G'], part('G', '新店', '松山'), sources.G);
    add('songshan-short', ['G'], part('G', '台電大樓', '松山'), sources.G, { kind: 'short-turn', note: '平常日部分時段；例假日無此區間交路。' });
  }
  if (date >= '2017-03-02') {
    add('airport-commuter', ['A'], part('A', '台北車站', date >= '2023-07-31' ? '老街溪' : '環北'), sources.A, { kind: 'local', color: '#0070BD' });
    const fast = names('台北車站、新北產業園區、長庚醫院、機場第一航廈、機場第二航廈');
    add('airport-express', ['A'], fast, sources.A, { kind: 'express', note: '只停所列車站，但沿A線完整軌道路徑行駛，不能連接成跨站直線。' });
    if (date >= '2018-03-01') add('airport-express-huanbei', ['A'], [...fast, '高鐵桃園', '環北'], TY + 'news/show-770-66.html', { kind: 'express', note: '部分指定班次延伸，非每班直達車。2025-10-16起一班晨車另有普通車跳站例外。' });
  }
  if (date >= '2018-12-23') {
    add('danhai-kanding', ['V'], byId.V.stops, NT + '?mode=detail&node=270');
    if (date >= '2020-11-15') add('danhai-fisherman', ['V', 'V-blue'], join(part('V', '紅樹林', '濱海沙崙'), byId['V-blue'].stops), NT + '?mode=detail&node=270');
  }
  if (date >= '2020-01-31') add('circular', ['Y'], byId.Y.stops, sources.Y);
  if (date >= '2023-02-10') {
    add('ankeng', ['K'], byId.K.stops, NT + '?mode=detail&node=578');
    if (date >= '2023-03-13' && date < '2024-02-26') add('ankeng-short', ['K'], part('K', '安康', '十四張'), NT + '?mode=detail&node=712', { kind: 'short-turn' });
  }
  if (date >= '2026-06-30') add('sanying', ['LB'], byId.LB.stops, NT + '?mode=detail&node=867');
  return services;
}
const descriptions = {
  '1996-03-28': '木柵線獨立營運。',
  '1997-03-28': '淡水—中山，新北投支線接駁。',
  '1998-12-24': '淡水、新店北段及中和線直通：淡水—南勢角。',
  '1999-11-11': '淡水—新店與北投—南勢角交錯直通；中和線尚未接上新蘆線。',
  '2012-09-30': '東門通車，橘線貫通；保留淡水—新店，北投—南勢角改為北投—台電大樓。',
  '2013-11-24': '信義線初期：北投—象山、淡水—新店、西門—台電大樓三交路。',
  '2014-11-15': '松山線通車，改為淡水—象山、松山—新店分線營運。',
  '2018-03-01': '機捷部分直達車延駛高鐵桃園及環北。',
  '2020-11-15': '淡海採紅樹林—崁頂及紅樹林—淡水漁人碼頭雙交路，無崁頂—漁人碼頭直通。',
  '2023-02-10': '安坑試營運全程車。',
  '2023-03-13': '安坑正式收費，全程車加尖峰安康—十四張區間車。',
  '2024-02-26': '安坑取消尖峰區間車，改為全線行駛。',
  '2026-06-30': '三鶯線頂埔—鶯桃福德全程車加入。',
  '2026-08-30': '淡水信義線全程車延駛廣慈／奉天宮，另有北投—大安區間及新北投接駁。'
};
const eraDates = [...new Set([...HISTORY_EVENTS.map(event => event.date), '2018-03-01', '2023-03-13', '2024-02-26'])].sort();
export const HISTORY_OPERATION_ERAS = eraDates.map((from, index) => ({
  from, ...(eraDates[index + 1] ? { until: eraDates[index + 1] } : {}),
  description: (descriptions[from] || HISTORY_EVENTS.find(event => event.date === from)?.title || '常態交路調整。') + ' 未核實歷史班距留空。',
  source: from < '2014-11-15' ? OPS13 : HISTORY_EVENTS.find(event => event.date === from)?.source || NT + '?mode=detail&node=712',
  services: servicesAt(from)
}));

// Current published ranges apply only here; they must not be copied to historical eras.
export const CURRENT_SERVICES = servicesAt('2026-10-17').map(service => {
  const ranges = { wenhu: [2, 12], 'tamsui-xinyi': [6, 15], xinbeitou: [7, 15], xiaobitan: [12, 20], bannan: [6, 12], xinzhuang: [6, 12], luzhou: [6, 12] };
  const stem = service.id.replace(/-(out|back)$/, '');
  if (ranges[stem]) return { ...service, source: sources[service.lineIds[0].split('-')[0]], headwayMin: ranges[stem][0], headwayMax: ranges[stem][1], headwayNote: '不同時段公布範圍；重疊區間班距較短。' };
  if (stem === 'circular') return { ...service, headwayMin: 4 + 50 / 60, headwayMax: 10, source: NT + '?mode=detail&node=795' };
  return service;
});
