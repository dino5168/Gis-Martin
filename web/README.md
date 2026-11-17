# 台灣向量地圖（前端）

MapLibre GL JS + React + TypeScript，讀取 Martin 合併圖磚
`/land,boundaries,landuse,water,waterways,roads,transit,buildings,pois/{z}/{x}/{y}`。

## 啟動

前置：Martin 已在 `http://localhost:3000` 執行。它以 Windows 服務 `MartinTiles` 開機自動啟動（見 `../Martin-Setup.md` 第 8 節），`Get-Service MartinTiles` 可確認狀態。

```powershell
pnpm install
Copy-Item .env.example .env.local   # 依環境修改 VITE_MARTIN_URL
pnpm dev                            # http://localhost:5173
```

> 必須用 `localhost:5173` 開啟：Martin `config.yaml` 的 CORS 白名單是 `http://localhost:5173`，用 `127.0.0.1` 會被擋。

## 指令

| 指令 | 用途 |
|---|---|
| `pnpm dev` | 開發伺服器 |
| `pnpm test` | vitest：設定驗證、MapLibre style-spec 驗證、屬性格式化 |
| `pnpm typecheck` | `tsc --noEmit`（strict） |
| `pnpm build` | 型別檢查 + production build 到 `dist/` |

## 結構

| 檔案 | 內容 |
|---|---|
| `src/config.ts` | 驗證 `VITE_MARTIN_URL`（Result type） |
| `src/map/style.ts` | MapLibre style、主題色盤（`THEMES`）、圖層群組（側欄開關） |
| `src/map/themeStorage.ts` | 以 localStorage 記住使用者選的地圖樣式（不可用時退回預設） |
| `src/map/featureInfo.ts` | 點選要素的屬性中文化與排序 |
| `src/map/MapView.tsx` | 地圖元件（建立一次；主題、圖層開關、3D 都烘進 style，以 `setStyle(style, { diff: true })` 套用） |
| `src/map/worker.ts` | 指定 MapLibre worker 網址（見下） |
| `src/components/` | 側欄：圖層開關、要素資訊 |

## 注意事項

- **MapLibre worker**：maplibre-gl 6 以自身 `import.meta.url` 推算 worker 位置，經 Vite 預打包／打包後會 404、完全不載入圖磚。`src/map/worker.ts` 用 `?url` 匯入 worker 並 `setWorkerUrl()`，dev 與 build 皆適用。
- **中文字型**：glyph 只從 demotiles 取拉丁字型；中文由 `localIdeographFontFamily`（Noto Sans TC / 微軟正黑體）在瀏覽器端繪製。
- **陸地／海洋**：`background` 是海色，`land-fill`（Martin `land` source，osmdata 海岸線陸地面）蓋在上面；兩者不在圖層開關內。`land` 已切塊，`fill-antialias` 關閉以免出現接縫。
- **3D 建物（LOD1）**：`buildings-3d`（fill-extrusion，z15+）預設隱藏，由側欄「2D／3D 建物」切換（`layerVisibility()` 同時考慮圖層群組與 3D 模式；開啟時相機傾斜 60°）。高度取 `render_height`，缺值為預設 2 層 `DEFAULT_BUILDING_HEIGHT_M = 6.4`（**須與 `martin/01_post_import.sql` 一致**）。有 `building:part` 的外框（`has_parts`）在 3D 中隱藏、改畫分段；2D 填色則排除分段（`is_part`）避免重疊變深。要素資訊會標示高度來源（標註／樓層推估／預設推估）。
- **POI 疏密**：`pois-symbol` 是 symbol 圖層（非 circle），靠碰撞偵測自動隱藏重疊的點，`symbol-sort-key` = `minzoom` 讓重要 POI 優先保留；另以 `minzoom <= zoom` 篩選分級。點狀圖示由 `src/map/icons.ts` 在 `styleimagemissing` 時產生（依 devicePixelRatio）。名稱自 z15 起顯示，`text-optional` 讓名稱放不下時仍保留點。POI 名稱屬於「興趣點」開關，不受「文字標註」開關控制。
- **POI 圖示（Maki）**：以 [Maki](https://github.com/mapbox/maki)（`@mapbox/maki`，**CC0 1.0**，可商用、免標註）顯示：分組顏色圓底＋白色圖案。
  - 對照：`style.ts` 的 `POI_MAKI`（`class/subclass` → [Maki 名稱, 分組]，涵蓋所有會出圖且 Maki 有合適圖案的子類別）→ 找不到時用 `POI_CLASS_MAKI` 的大類預設（`shop` 購物袋、`office` 辦公大樓、`historic` 古蹟、`leisure` 公園）→ 其餘（`amenity`／`tourism`／`railway`／`public_transport` 未列出的子類別）仍是圓點。
  - 分組（`PoiGroup`，9 組：餐飲／購物／醫療／交通／公共教育／休閒娛樂／觀光／古蹟／辦公金融）決定圓底顏色，每個主題各有一組色（`Palette.poiFood` 等，`POI_GROUP_COLOR`）。圖示 id 為 `maki-{圖示}-{分組}-{主題}`。
  - 產生方式：`MapView` 以 `map.setMissingStyleImageResolver()` 在第一次用到時非同步把 SVG 轉成遮罩（`makiGlyphs.ts`，快取 Promise）再由純函式 `createIconImage()` 合成。**不要改回 `styleimagemissing`**：MapLibre 6 起該事件的 listener 無法補上當次請求的圖片，首批圖磚會缺圖。
  - SVG 以 `?raw` 只打包用到的 104 個（全部 215 個約 164 KB）；增減對照表時同步 `makiGlyphs.ts` 的 import（`Record<MakiName, string>` 型別與測試會抓漏）。
- **公車動態（1 號公車）**：`src/bus/`。瀏覽器每 30 秒直接抓 Data.Taipei 的 `https://tcgbusfs.blob.core.windows.net/blobbus/GetBusData.gz`（CORS `*`、免金鑰；全市約 2,100 輛、gzip 約 50 KB），以 `DecompressionStream('gzip')` 解壓（伺服器回 `application/octet-stream`，瀏覽器不會自動解壓），`parseBusData()` 驗證後篩 `ROUTE_1.routeIds`（`10723` 主線、`160559` 狗狗公車）。座標為 WGS84＝EPSG:4326，直接作為 GeoJSON。
  - 車輛位置**放在 style 裡**（`buildStyle({ buses })` 的 `buses` GeoJSON source），由同一次 `setStyle` diff 更新；若在 style 外 `setData`，下一次 setStyle（切主題、開關圖層）會被比對回空資料。
  - 圖示：`bus-{go|back|unknown}-{主題}`（Maki `bus` 圓底，去程／返程不同色：`Palette.busGo`／`busBack`）＋ `bus-arrow-*`（Maki `triangle`，依 `Azimuth` 旋轉、繞在圓外指出行進方向）。
  - 「公車動態」圖層關閉或分頁在背景（`visibilitychange`）時停止輪詢；下載失敗保留上一筆位置並在側欄顯示錯誤。
  - 資料來源標示：attribution 加上「公車動態：臺北市政府交通局（Data.Taipei）」。
- **地圖樣式（主題）**：側欄「地圖樣式」下拉選單（`<select>`）切換 `預設`／`OSM Bright`／`柔和`／`暗色`／`黑白`／`黑白淡色`（柔和、黑白、黑白淡色分別參考 Stadia 的 Alidade Smooth、Stamen Toner、Toner Lite 的用途與配色方向，名稱不沿用其品牌）。Stadia 清單中的 Satellite／Terrain／Watercolor 需要衛星影像、地形陰影或水彩 raster 圖磚，本專案沒有這些資料來源，未提供。主題 id 會存進 localStorage，**不可改名**。各主題**只換色盤（`Palette`），圖層 id、filter、順序完全相同**，所以 `setStyle` diff 只會改 paint 屬性，相機與已載入圖磚不受影響。新增主題＝在 `style.ts` 加一份 `Palette` 並加入 `THEMES`（色值必須是 `#rrggbb`，POI 圓點由此產生）。POI 圖示 id 含主題名（`poi-major-dark`），因為 MapLibre 在 `setStyle` 後會保留已加入的圖片，共用 id 會沿用舊主題顏色。
  - OSM Bright 原始 style JSON（OpenMapTiles，CC-BY 4.0）是給 OpenMapTiles schema（`transportation`、`landcover`、`place`…）用的，與本專案 Martin 自訂的 9 層不相容，**無法直接載入**；此處只取其配色近似值。
- **除錯**：開發模式下 `window.__map` 是 MapLibre 實例（production build 不會有）。
