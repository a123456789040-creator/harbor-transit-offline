# 河港路網 Harbor Transit · 離線版

原創單人捷運規劃遊戲。香港、台北、紐約、東京、大阪・京都與環海自建城；包含關卡、自動調度、BUG 資源、過關後無盡玩法、5 分鐘規劃／10 秒運行循環、未來路網開關與歷史／路網觀賞。

## 下載與啟動

到 [Releases](https://github.com/a123456789040-creator/harbor-transit-offline/releases/latest) 下載 `HarborTransit-3.0.1-win-x64.zip`。

1. 將 ZIP **全部解壓縮**到一般資料夾。
2. 雙擊 `HarborTransit.exe`。程式會開啟預設瀏覽器；遊玩不需要網際網路、帳號、API 金鑰或另裝 Node.js。
3. 保持啟動器視窗開啟；玩完按「結束程式」。關閉瀏覽器頁面不會自動關閉啟動器。

Windows 10／11 x64，使用已安裝的 Edge 或 Chrome。程式未簽署數位憑證；請核對本倉庫 Release 附的 SHA-256。這是本機瀏覽器遊戲，網址 `127.0.0.1` 代表你的電腦，不會連到作者伺服器。不要直接雙擊 `dist/index.html`。

最高分、城市進度與外觀設定存在此電腦的瀏覽器；不保存當局路網。使用無痕模式或清除網站資料會移除這些紀錄。

BUG 模式左邊的「規劃新站」可開關：手動／自動皆最多新增 50 個額外站點。關閉保留已有站點與路網，不影響真實／官方未來目錄的開放；新遊戲預設開啟。

## 公開版資料範圍

- 五城全部現況站點、實際軌道路網、底圖及人工城市都在下載包內。未來規劃為官方資料整理的示意，日期可能調整。
- 台北、香港、紐約保留既有通車回顧與已收錄運量。
- 東京、大阪・京都保留現況路網、既有運量與未來計畫；**未附日本 N05 站史資料庫**，因此不提供其早年開通時間軸，也不把快照日期當作通車日。原資料非商用條款排除複製物重散布，見下方來源。
- 離線時刻展示保留台北班距模型、紐約已收錄班表、京都 CC-BY 4.0 班表。沒有連網到站預測／定位／臨時延誤；未取得散布授權的日本業者班表未附，相關路線只顯示地圖。班表過期會停止對應推估，不冒充當日實況。

參考：[MLIT N05 條款](https://nlftp.mlit.go.jp/ksj/other/agreement_02.html)、[JR 東日本](https://www.jreast.co.jp/site/rules.html/)、[JR 西日本](https://www.jr-odekake.net/use/about.html)。完整署名見 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 與遊戲「資料來源」。本作非任何鐵路業者的官方或授權應用。

## 從原始碼執行

已安裝 Node.js 24 LTS 的開發者可執行 `node server.mjs`，開啟顯示的本機網址；不需 `npm install`。`npm test` 檢查離線服務、資料及路徑邊界。

Windows 建置：`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-windows.ps1`。建置步驟需網路下載並核對官方 Node 執行檔；**建好的下載版不需要網路**。輸出於 `releases/`。`scripts/Launcher.cs` 為啟動器原始碼。

遊戲程式依 MIT 授權；地圖與第三方資料各自適用原授權，不因本倉庫的 MIT 而改變。原作 Mini Metro 的程式、圖片與音效未包含於此專案。
