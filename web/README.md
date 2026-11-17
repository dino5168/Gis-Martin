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
| `src/map/style.ts` | MapLibre style、色盤、圖層群組（側欄開關） |
| `src/map/featureInfo.ts` | 點選要素的屬性中文化與排序 |
| `src/map/MapView.tsx` | 地圖元件（建立一次，圖層開關以 `setLayoutProperty` 套用） |
| `src/map/worker.ts` | 指定 MapLibre worker 網址（見下） |
| `src/components/` | 側欄：圖層開關、要素資訊 |

## 注意事項

- **MapLibre worker**：maplibre-gl 6 以自身 `import.meta.url` 推算 worker 位置，經 Vite 預打包／打包後會 404、完全不載入圖磚。`src/map/worker.ts` 用 `?url` 匯入 worker 並 `setWorkerUrl()`，dev 與 build 皆適用。
- **中文字型**：glyph 只從 demotiles 取拉丁字型；中文由 `localIdeographFontFamily`（Noto Sans TC / 微軟正黑體）在瀏覽器端繪製。
- **陸地／海洋**：`background` 是海色，`land-fill`（Martin `land` source，osmdata 海岸線陸地面）蓋在上面；兩者不在圖層開關內。`land` 已切塊，`fill-antialias` 關閉以免出現接縫。
- **3D 建物（LOD1）**：`buildings-3d`（fill-extrusion，z15+）預設隱藏，由側欄「2D／3D 建物」切換（`layerVisibility()` 同時考慮圖層群組與 3D 模式；開啟時相機傾斜 60°）。高度取 `render_height`，缺值為預設 2 層 `DEFAULT_BUILDING_HEIGHT_M = 6.4`（**須與 `martin/01_post_import.sql` 一致**）。有 `building:part` 的外框（`has_parts`）在 3D 中隱藏、改畫分段；2D 填色則排除分段（`is_part`）避免重疊變深。要素資訊會標示高度來源（標註／樓層推估／預設推估）。
- **POI 疏密**：`pois-symbol` 是 symbol 圖層（非 circle），靠碰撞偵測自動隱藏重疊的點，`symbol-sort-key` = `minzoom` 讓重要 POI 優先保留；另以 `minzoom <= zoom` 篩選分級。點狀圖示由 `src/map/icons.ts` 在 `styleimagemissing` 時產生（依 devicePixelRatio）。名稱自 z15 起顯示，`text-optional` 讓名稱放不下時仍保留點。POI 名稱屬於「興趣點」開關，不受「文字標註」開關控制。
- **除錯**：開發模式下 `window.__map` 是 MapLibre 實例（production build 不會有）。
