# 新手老師成長儀表板

給國小自然科任教師的每日工作台。純前端靜態網站，不需要伺服器、不需要帳號，資料存在你自己的瀏覽器裡。

## 怎麼用

直接用瀏覽器打開 `index.html` 即可。若要放到自己的空間，把整個資料夾上傳到任何靜態主機（GitHub Pages、Netlify、學校網站空間）都能用。

第一次開啟會自動載入示範資料，讓你看得懂每個欄位。要清空請到「設定」頁按「清除所有資料」。

## 檔案結構

```
teacher-dashboard/
├── index.html          儀表板（今日課表、待辦、提醒、待關注學生、本週反思、四輪進度）
├── lessons.html        課程與備課（備課單、課綱代碼、器材清單、可列印教案）
├── classes.html        班級與學生（名單、狀態標籤、觀察紀錄時間軸、課堂點數）
├── contact.html        親師溝通（模板庫、變數代入、一對一聯繫紀錄）
├── scifair.html        科展管理（分組、研究設計、8 週進度、材料與報告檢核）
├── reflect.html        教師反思（L1 速記 / L2 Gibbs 六格 / L3 ALACT 深挖、關鍵詞統計）
├── growth.html         專業成長（四面向自評雷達圖、待精進項目、成長目標、歷程時間軸）
├── resources.html      資源中心（連結收藏、檢核清單、教案筆記）
├── settings.html       設定（週課表、學期起訖、匯出／匯入 JSON、清除資料）
├── assets/
│   ├── favicon.svg
│   ├── css/style.css   全站樣式，最上方是可調整的 CSS 變數
│   └── js/
│       ├── store.js    資料層：localStorage 讀寫、示範資料、匯出匯入
│       ├── ui.js       共用外框：側邊欄、頂部列、SVG 圖示、共用元件
│       └── <頁名>.js   各頁邏輯，檔名對應 html 檔名
```

## 資料存在哪裡

全部在瀏覽器的 `localStorage`，存在單一鍵 `teacherDashboard.v1` 裡（一個 JSON 物件）。這代表：

- 換電腦、換瀏覽器、清瀏覽紀錄，資料不會跟著走。
- **請定期到「設定」頁按「匯出 JSON」備份**，換裝置時用「匯入 JSON」還原。

若瀏覽器不允許本機儲存（無痕視窗、嵌入式預覽畫面），網站會自動退回「試用模式」：功能全部可用，但重新整理就會回到示範資料，頁面上方會有黃色提示條。把檔案存到自己電腦直接開啟 `index.html` 就會正常存檔。

## 如何改顏色

打開 `assets/css/style.css`，最上方 `:root` 區塊改變數即可，全站會同步變色：

```css
:root {
  --c-primary:      #0B7285;   /* 主色（按鈕、連結、重點） */
  --c-primary-dark: #095C6B;   /* 主色加深（hover） */
  --c-primary-tint: #E4F1F4;   /* 主色淡底（選取、標籤底色） */
  --c-bg:           #F6F8FA;   /* 頁面底色 */
  --c-surface:      #FFFFFF;   /* 卡片底色 */
  --c-text:         #1C2B33;   /* 主要文字 */
  --c-text-muted:   #5A6B77;   /* 次要文字 */
  --c-border:       #DFE5EB;   /* 邊框 */
}
```

只改前三個 `--c-primary*` 就能換整站主色。字體變數也在同一區塊；字型檔在各 html 的 `<head>` 用 Google Fonts 載入。

## 如何新增一個頁面

1. 複製一份現有頁面（例如 `resources.html`）改名為 `mypage.html`，改掉 `<title>` 與 `.page-head` 裡的標題。
2. 在 `assets/js/` 新增 `mypage.js`，並把頁面底部的 `<script src="assets/js/resources.js">` 改成你的檔案。
3. 到 `assets/js/ui.js` 找到 `NAV` 陣列（約第 14 行），加一筆 `{ file: 'mypage.html', label: '我的頁面', icon: 'star' }`，側邊欄就會出現。圖示名稱可用的清單在 `ui.js` 的 `ICON_PATHS`。
4. 頁面 JS 開頭要呼叫 `UI.renderShell('mypage.html')` 才會長出側邊欄。
5. 要存資料的話，在 `store.js` 的 `emptyData()` 加一個陣列，再用 `Store.list('yourKey')` / `Store.add` / `Store.update` / `Store.remove` 讀寫，不用另外寫程式。

## 修改建議

- 想換掉示範資料：改 `store.js` 裡的 `seedData()`。
- 想改親師溝通模板文字：在「親師溝通」頁直接編輯即可；要改預設內建模板則改 `store.js` 的 `seedData()`。
- 想改自評題目或面向：改 `growth.js` 最上方的 `DIMENSIONS`。
- 想改科展 8 週節奏：改 `store.js` 的 `sciFairWeekTitles()`。
- 想改反思引導問句：改 `reflect.js` 的 `LEVELS`（三層問句）、`ONION`（洋葱五層）、`RHYTHM`（週／月／學期題組）、`KEYWORDS`（關鍵詞統計詞庫）。

## 內容依據

- 反思模板結構參考 Gibbs 反思循環（[NHS 反思模型](https://www.hee.nhs.uk/)、[愛丁堡大學反思工具箱](https://www.ed.ac.uk/reflection/reflectors-toolkit)）與 Korthagen ALACT 五階段。
- 探究架構對應十二年國教自然領域課綱四主軸與學習表現代碼（[國家教育研究院課綱資源](https://www.naer.edu.tw/)）。
- 實驗室安全清單依教育部《學校實驗室與實習場所安全衛生管理要點》。
