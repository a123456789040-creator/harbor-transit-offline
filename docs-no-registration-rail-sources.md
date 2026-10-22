# 免申請的鐵路資料來源查核

查核日：2026-10-22。公開查詢網頁、免金鑰 API 與可公開散布的資料是不同範圍。

| 範圍 | 免申請來源 | 已確認內容與限制 |
| --- | --- | --- |
| 台北捷運 | [官方公開進站 JSON 資料目錄](https://data.taipei/dataset/detail?id=6556e1e8-c908-42d5-b984-b3f7337b139b) | 每 30 秒更新進入月台站名、目的地與時間；不含穩定車號，不能直接辨識完整車隊。既有線上版使用此來源，離線版不連網。 |
| 台北捷運 | [官方各站首末班車](https://www.metro.taipei/cp.aspx?n=5298d33851223b04)、[官方車站時刻頁範例](https://web.metro.taipei/pages/tw/timetables/104) | 網頁可公開查閱；首末班與班距不能取代完整逐班表。搜尋引擎列出的舊 PDF 051a.pdf 本次回傳 404，不當作可用來源。 |
| 東京都營 | [ODPT 公開列車 API](https://api-public.odpt.org/api/v4/odpt:Train?odpt:operator=odpt.Operator:Toei) | 本次無金鑰 HTTP 200，回傳 57 筆；樣本來源時間 2026-10-22 23:19:29 JST。有車次、線路、起訖方向、所在／下一站與延誤。筆數隨時間變動；只代表都營。尚未接入遊戲。 |
| 東京 Metro | [官方車站時刻表範例](https://www.tokyometro.jp/station/shibuya/timetable/index.html)、[官方 my! App 列車位置說明](https://www.tokyometro.jp/mobiledevice/smartphone/my/howto01.html) | 時刻頁公開，網頁班表服務由 NAVITIME 提供。官方 App 可看即時位置；沒有因此取得可自由介接的 API。相同公開 ODPT 端點查 TokyoMetro，本次回傳空陣列，不據此宣稱無列車運行。 |
| 東京都營 | [官方四線各站時刻表](https://www.kotsu.metro.tokyo.jp/subway/timetable/index.html) | 可直接查閱平日／假日、方向等站表。缺少到達時間時仍需標示站間推估。 |
| Osaka Metro | [官方時刻表](https://kensaku.osakametro.co.jp/timetable/ja/)、[江坂往中百舌鳥範例](https://kensaku.osakametro.co.jp/timetable/subway/dia/station/25850/1019/1)、[官方列車位置](https://subway.osakametro.co.jp/ressyaichi.php) | 班表與位置網頁可直接看。位置頁明示：走行與擁擠資訊未經許可不得轉載、轉用、編輯、公眾傳送等；不將該網頁當作可自由轉送的資料授權。 |
| 京都市地下鐵 | [2026-03-14 班表 CSV](https://data.city.kyoto.lg.jp/dataset/00692/?page=1) | 8 個 CSV，烏丸／東西線、雙向、平日／土休日；CC-BY 4.0，可署名納入公開離線包。既有公開版已包含此來源。 |
| JR 西日本近畿 | [官方列車位置](https://www.train-guide.westjr.co.jp/area_kinki.html)、[官方 FAQ](https://trafficinfo.westjr.co.jp/static-pages/qanda.html)、[條款](https://www.train-guide.westjr.co.jp/terms.html) | 免會員查看，約 05:00 至翌日 01:00 提供位置與逐車延誤。公開觀看不等同取得批次轉送或散布授權。 |

北捷逐車位置／到站倒數仍以[官方 API 申請規範](https://www.metro.taipei/cp.aspx?n=BDEB860F2BE3E249)為準；場地預約會員不是 API 會員。

實作方向：有效公開班表作為離線基礎，列車沿真實線位連續移動；正式介接的逐車觀測用穩定車號校正，站點進站事件則獨立標示。各來源保留有效期、更新時間與精度說明，不用進站事件冒認班距模型中的某班列車。
