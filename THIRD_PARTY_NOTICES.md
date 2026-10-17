# 第三方資料與執行環境

遊戲程式的 MIT 授權不涵蓋下列資料。圖資已裁切、概化、投影或合併，不是測量圖。開通日期、運量、規劃與列車動畫可能有缺漏；不得作為實際乘車或調度依據。

- 底圖、道路、水域與香港軌道：© OpenStreetMap contributors，經 Protomaps 提供，ODbL 1.0。處理說明、資料庫下載及署名保存在 `dist/maps/LICENSE.txt`、`dist/maps/*.geojson*` 與 `dist/sources.html`。https://www.openstreetmap.org/copyright 、https://opendatacommons.org/licenses/odbl/1-0/ 。快照為 2026-10-16。
- 台北官方軌道及相關開放資料：國土測繪中心、臺北市政府、各系統已列官方來源，政府資料開放授權條款第 1 版。https://data.gov.tw/license 。逐筆來源留於整編檔。
- 日本現況鐵道：國土交通省國土數值情報 N02-25，依原資料與政府公共資料條款使用、保留出典及加工說明。https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-2025.html 。公開版沒有 N05 時系列資料庫；來源 N05 的歷史日期、月台日期及推導年代已排除，不得由此推定其可以重散布。
- 日本京都市交通局班表：2026-03-14 原始 CSV，CC-BY 4.0；本站將時刻數值重整、站間位置內插，未加入未公布的時刻。https://data.city.kyoto.lg.jp/dataset/00692/?page=1 、https://creativecommons.org/licenses/by/4.0/ 。日本國定假日：內閣府公開資料，保留原來源。
- 日本其餘業者班表：未附於公開版。原始私人專案含受各業者條款限制的資料，並不隨公開原始碼或 Release 轉授權。
- 紐約：MTA 官方資料及已列站史／運量文獻。本作從保存的整編資料提供展示，不直接要求使用者連向 MTA；非 MTA 官方或授權應用。MTA 不保證準確、完整、即時或適用性。https://www.mta.info/developers/terms-and-conditions 。班表期限與各筆來源保存在資料內。
- 香港港鐵站表、官方統計、台灣及其他官方公告：來源與處理方式見 `dist/sources.html` 及各筆紀錄，不含業者商標、官方路線圖圖片或原表版面。Wikidata 結構化站史：CC0，逐筆連結保留。https://www.wikidata.org/wiki/Wikidata:Licensing 。
- Windows 下載包包含官方 Node.js v24.22.0 x64；完整 Node 與其內含依賴的授權文字在 `runtime/LICENSE.txt`。https://nodejs.org/ 。原始碼倉庫不包含執行檔，可用建置腳本從官方來源下載並核對 SHA-256。

未來規劃站名／位置依各官方公告整理，部分位置近似、部分名稱暫定；虛線是站序示意，非精確工程線位。現況路線顏色依已核實資料；未核實色彩使用中性灰。沒有承諾完整涵蓋所有遠期構想。
