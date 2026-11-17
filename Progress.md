# Progress — 台灣 OSM 向量圖磚（Gis-Martin）

> 最後更新：2026-11-17　｜　專案說明與注意事項見 [CLAUDE.md](CLAUDE.md)
> 參考設計圖：`images/Margin.png`（OSM PBF → osm2pgsql → PostGIS → Martin → MapLibre GL JS → React GIS）

## 目前狀態（一句話）

整條管線已在本機運作：PostGIS 有完整台灣資料，Martin 以 Windows 服務開機自動提供 MVT（9 層），React 前端在開發模式（`pnpm dev`）可瀏覽、點選、切換圖層、2D／3D（LOD1 建物）與捷運路線色；行政界只畫陸上邊界、標註不重複（2026-11-17）；正式機部署包已打包完成、待搬到正式機（`SetUp/setup.md`）；**尚未部署成正式網站**。

## 下次進來先做

```powershell
Get-Service postgresql-x64-17, MartinTiles           # 兩者都應為 Running（開機自動啟動）
Invoke-WebRequest http://127.0.0.1:3000/health -UseBasicParsing | Select-Object StatusCode
Set-Location "D:\1-研發\3-Gis-Martin\web"; pnpm dev  # Vite 開發伺服器不是服務，需手動啟動
# 瀏覽 http://localhost:5173（必須用 localhost）
```

---

## 已完成

| # | 項目 | 結果 | 文件 |
|---|---|---|---|
| 1 | 環境安裝 | PostGIS 3.6.2、osm2pgsql 2.3.1、Martin 1.16.1、psql/osm2pgsql/martin 加入使用者 PATH | Vector-OSM-Setup.md §1–2 |
| 2 | DB 與角色 | `osm_taiwan`、`osm_import`（owner）、`martin_reader`（唯讀）、postgis + btree_gist；`.env` 自動產生強密碼、ACL 限本人；postgres 密碼已由使用者更換 | Vector-OSM-Setup.md §3–4 |
| 3 | 匯入台灣 PBF | `taiwan-261112.osm.pbf`，flex style（7 表，EPSG:4326），2 分 4 秒；roads 83.9 萬、buildings 60.3 萬、pois 25.7 萬 | Vector-OSM-Setup.md §5–9 |
| 4 | Martin tile functions | 7（後為 9）支 function source、`minzoom` generated column、`GiST (geom, minzoom)`；`03_verify.sql` 全數通過 | Martin-Setup.md §1–6 |
| 5 | 圖磚大小調校 | 低 zoom 綜合表 `*_z8`/`*_z11`（道路合併線段、landuse 簡化切塊、行政界簡化）；z10 合併圖磚 827 → 315 KB，全 zoom < 500 KB | Martin-Setup.md「圖磚大小調校」 |
| 6 | 前端 | Vite + React 19 + TS 7 strict + maplibre-gl 6；台灣樣式、圖層開關、要素資訊（中文化）、狀態列、RWD；vitest 33 項通過 | web/README.md |
| 7 | 海陸分色 | osmdata land-polygons（EPSG:4326）裁切台灣範圍 → `land`／`land_z8`／`land_z11`（6,339 塊，#13 擴大範圍後 12,730 塊）；背景為海色 | Martin-Setup.md「陸地多邊形」 |
| 8 | Martin Windows 服務 | WinSW 2.12.0，服務 `MartinTiles`（LocalService、自動啟動、相依 PostgreSQL、失敗自動重啟、日誌輪替） | Martin-Setup.md §8 |
| 9 | POI 密度 | POI 分級 z11–z16、街道設施不出圖；前端改 symbol 圖層（碰撞偵測）；台北 z15 可見 POI 3,376 → 489 | Martin-Setup.md「Zoom 規則摘要」、web/README.md |
| 10 | LOD1 3D 建物（`Plans/2-LOD1建物圖.md`） | 匯入 `height`／`min_height`／`building:min_level`／`building:part`（重匯 1 分 56 秒）；高度：標註 1.7%、樓層推估 11.1%、預設 2 層 87.2%；分段 18,002、有分段外框 4,093；台北 101 分段疊出 0→508 m；前端 fill-extrusion（z15+）＋ 2D／3D 切換、要素資訊標示高度來源；前端測試 40 項通過 | Martin-Setup.md「Zoom 規則摘要」、web/README.md |
| 11 | 捷運／高鐵路線色（`Plans/5-捷運與鐵路顏色.md`） | 新 source `transit`（第 9 層）：Lua 匯入 route／route_master 關聯 → `transit_lines` 434 條（去回程合併、剔除月台）；高鐵 z7、捷運／單軌 z10、輕軌 z11、路面電車 z12；板南線藍 `#007ec7`、淡水信義線紅等取自 OSM，高鐵固定橘 `#CA4F0F`；`03_verify` 通過、前端測試 43 項通過。**2026-11-13 補重啟 MartinTiles 才生效**（之前合併 URL 因缺 transit 整串 404） | Martin-Setup.md「Zoom 規則摘要」、web/README.md |
| 12 | 多島縣市標註重複（澎湖、連江等） | 新表 `boundary_labels`（`01`）：縣市／鄉鎮市區各一點，取最大島的最大內切圓圓心；`tile_boundaries` 在同一 `boundaries` 層輸出 Point，前端 `label-counties`／`label-towns` 以 `geometry-type == Point` 篩選。瀏覽器驗證澎湖、連江、全台各縣市標註皆只出現 1 次；`03_verify` 通過、前端測試 45 項通過 | `Plans/1-問題修改.md` |
| 13 | 低 zoom 陸地被切成方框 | 陸地原只裁 116–123°E，但前端 maxBounds 可看到 114.5–124.5°E → 縮小到底時福建沿海呈直線方框。`05_land.sql` 裁切範圍改 113.5–125.5°E／18.5–28.5°N（maxBounds 外擴 1°），`config.yaml` 的 land bounds 同步；`land` 12,730 塊（13 MB），重載 land 後 `03_verify` 通過 | Martin-Setup.md「陸地多邊形」 |
| 14 | 低 zoom 隱藏海上國界虛線 | 國界 admin_level 2 面積 89,702 km²、陸地僅 36,462 km²（其餘為領海）→ 前端拆出 `boundaries-country`（minzoom 10，`COUNTRY_BOUNDARY_MINZOOM`），`boundaries-county` 只畫 level 4；前端測試 46 項通過 | web/src/map/style.ts |
| 15 | 縣市界只畫陸上共用邊界 | 新表 `county_lines`（`01`，相依 `land`；#16 起改名併入 `boundary_lines`）：相鄰縣市共用邊 ∩ 陸地 → 金門、連江、澎湖不再畫海上／沿岸虛線，本島外海與離島外框一併移除（19 縣市有線）；`tile_boundaries` 的 level 4 改出此線（低 zoom 即時 `ST_Simplify`）；`03_verify` 新增檢查並通過 | Martin-Setup.md「Zoom 規則摘要」 |
| 16 | 鄉鎮市區界也只畫陸上共用邊界 | `county_lines` 改為 `boundary_lines`（level 4 與 7/8；7、8 視為同級配對），建表 19 秒；鄉鎮 354 個有線，無線者 15 個皆為獨立島嶼（七美、馬祖各鄉、綠島、蘭嶼、旗津…）；台北 boundaries 圖磚大小幾乎不變；`03_verify` 通過 | Martin-Setup.md「Zoom 規則摘要」 |
| 17 | 村里界也只畫陸上共用邊界 | `boundary_lines` 加入 level 9（自成一級配對）：村里 7,764 個有線、14 個無線（獨立島嶼）；建表時間 19 → 65 秒；台北 z12–z14 boundaries 圖磚 +80～170 bytes；`03_verify` 新增村里數檢查並通過 | Martin-Setup.md「Zoom 規則摘要」 |
| 18 | 正式機部署文件（PostgreSQL + Martin） | `SetUp/setup.md`：開發機 `pg_dump -Fc`（排除 extension、不含擁有者／權限）→ 正式機建角色與 `ALTER DEFAULT PRIVILEGES` → `pg_restore --single-transaction` → WinSW 服務；資料更新流程與回滾。已在開發機以測試 DB 演練：匯出 28 秒／314 MB、還原 29 秒、`03_verify` 通過、`martin_reader` 可出圖（測試 DB 已刪除）。**部署包已完成**：`C:\gis\osm\deploy\`（dump 314 MB、martin.exe 1.16.1、config／SQL／服務腳本、WinSW、`SHA256SUMS.txt` 已驗證）；修正 §1 校驗碼指令（管線寫檔會把 SHA256SUMS.txt 自己列入） | `SetUp/setup.md` |

### 2026-11-17 工作紀錄

- 處理項目：#12–#17（行政區標註、陸地範圍、國界與各級行政界的海上虛線）
- 已套用到 DB：`01` 中 `boundary_labels`、`boundary_lines` 兩段單獨執行（未整份重跑 01）；`05_land.sql` 以重新載入的全球 land-polygons 重跑；`02` 已重建；`03_verify` 全數通過；MartinTiles 已重啟
- 前端：vitest 46 項、`tsc --noEmit` 通過；瀏覽器驗證澎湖、連江、金門、高雄沿海、全台低 zoom 畫面
- 下次重匯 OSM 時照常 01 → 02（`01` 已含上述兩段，`boundary_lines` 約 65 秒）

### 關鍵數據

- DB 大小 819 MB；z14 台北合併圖磚約 395 KB（gzip 約 206 KB）
- 合併圖磚最大值：z9 487 KB、z13 495 KB（皆接近 500 KB 上限）；z14 449 KB（含 LOD1 高度欄位後，原 394 KB）
- 加入 transit 後（2026-11-13 `04_benchmark` 台北 101）：z9 492 KB、z10 334 KB、z13 496 KB、z14 450 KB；transit 層本身最多 18 KB（z10），全 zoom 仍 < 500 KB

---

## 待辦

### 0. 圖磚服務上正式機（`SetUp/setup.md`，進行中）

- [x] §1 開發機打包部署檔（2026-11-17，`C:\gis\osm\deploy\`）
- [ ] 把 `C:\gis\osm\deploy\` 複製到正式機同路徑，比對 `SHA256SUMS.txt`
- [ ] §2–§6 正式機安裝 PostgreSQL 17 + PostGIS 3.6、新 `.env`、建角色／DB、`pg_restore`、調校
- [ ] §7.1 決定前端放置方式：同機反向代理（Martin 維持 127.0.0.1）或前端在別台（0.0.0.0 + CORS + 防火牆）→ 修改正式機 `config.yaml`
- [ ] §7.2–§8 安裝 MartinTiles 服務並驗證
- [ ] 部署包若在搬移前開發機資料有變動，需重跑 §1 重新打包

### 1. 把前端 build 部署成正式網站（優先）

> **2026-11-17 改採 Cloudflare 前後端分離**（計畫：`Plans/6-前後端分離-實作.md`），下方原「同機反向代理」方案暫緩。
>
> - [x] 前端：Cloudflare Pages 專案 `gis-martin` → https://gis-martin.pages.dev（GitHub `main` push 自動部署；root `web`、`pnpm install --frozen-lockfile && pnpm build`、輸出 `dist`、`NODE_VERSION=22.18.0`、`PNPM_VERSION=10.32.1`）。`_headers` 已生效（assets immutable、index.html no-cache），worker `.mjs` 正常提供
> - [x] **暫時以 quick tunnel 測試成功**（2026-11-17）：`cloudflared tunnel --url http://127.0.0.1:3000`（Claude Code 背景程序，關閉即斷）→ Pages `VITE_MARTIN_URL` 設為該 `*.trycloudflare.com` 網址並重新部署，地圖正常顯示。Martin CORS 已加 `https://gis-martin.pages.dev`
>   - quick tunnel 每次重啟網址會變 → 需同步改 Pages 的 `VITE_MARTIN_URL` 並重新部署；無 edge 快取、無路徑白名單，僅供測試
> - [ ] 後端：Cloudflare 帳號尚無網域 → 需先決定網域，才能建 named tunnel（計畫 §4）

目前前端只在 `pnpm dev` 下運作，且 Vite 開發伺服器跑在 Claude Code 的背景程序，關閉即停止。

建議方向（實作前再確認需求，例如：只在內網？要不要 HTTPS／網域？）：

- [ ] `pnpm build` 產出 `web/dist`（已可成功 build；worker 會輸出為獨立資產）
- [ ] 選一個靜態網站伺服器並註冊為 Windows 服務（候選：Caddy／nginx／IIS），開機自動啟動
- [ ] **同源反向代理 Martin**（例如 `/tiles/*` → `http://127.0.0.1:3000/*`）：
  - 前端 `VITE_MARTIN_URL` 改為同源路徑，免除 CORS 設定
  - Martin 維持只綁 `127.0.0.1`，不直接對外
  - 注意 Martin TileJSON 內的 `tiles` URL 由請求 Host 推得，經代理時需確認產生的網址正確（必要時設定代理的 Host / X-Forwarded 標頭）
- [ ] 快取標頭：`dist/assets/*`（檔名含 hash）長快取；`index.html` 不快取；圖磚設定合理 `Cache-Control`
- [ ] 視需求啟用 HTTPS（內網可用自簽或 Caddy 內建 CA）
- [ ] glyphs 目前取自外部 `demotiles.maplibre.org`：正式環境建議自行託管字型 PBF（或確認可接受外部相依）
- [ ] 部署腳本與文件（建議新增 `Deploy.md`），並在 CLAUDE.md 補上部署路徑與重啟方式
- [ ] 部署後驗證：首頁、圖磚、點選要素、圖層開關、手機寬度

### 2. 使用者回報問題（`Plans/1-問題修改.md`）— 2026-11-17 已全部處理

截圖 `images/外框.png`（連江縣／馬祖一帶）可見：
- [x] 「連江縣」「澎湖縣」標註重複：已改為每區一個代表點（見已完成 #12，2026-11-17）
- [x] 島嶼只見虛線外框：縣市界改為陸上共用邊界後已無海上外框（#15，2026-11-17）；陸地填色正常
- [x] 延伸處理：低 zoom 陸地方框（#13）、海上國界虛線 z10 以下隱藏（#14）、縣市／鄉鎮／村里界只畫陸上共用邊界（#15–#17）
- [ ] 若 `Plans/1-問題修改.md` 之後補充新需求再處理

### 3. 其他改善（非急迫）

- [ ] 評估文件 `Plans/3-評估.md`（前端改 Rust + Leptos 優缺點）、`Plans/4-評估02.md`（使用者如何修改地圖樣式）只有需求、結論未寫入文件（若已在對話中回覆過，建議補記）
- [ ] z13 合併圖磚 496 KB（建物 279 KB）、z9 492 KB、z14 450 KB（建物 191 KB）接近上限：可延後建物到 z14、過濾極小建物，或 z13 只出面積較大的建物
- [ ] LOD1 高度 87% 是預設 2 層推估：評估接內政部國土測繪中心三維建物模型（LOD1，實測高度），需先確認授權、格式（CityGML／3D Tiles／Shapefile）與年份；若能取得「外框＋高度」，可匯入 PostGIS 取代 `render_height` 來源，前端不需改
- [ ] 3D 模式下點選建物：POI 圖層在上層，點到 POI 時會優先顯示 POI（目前行為，是否要改為優先建物待確認）
- [ ] z9 landuse 首次產生約 500 ms（有快取後無影響）
- [x] 專案納入 git：GitHub private repo `dino5168/Gis-Martin`（2026-11-17）；`taiwan.lua` 原始碼移入 `osm2pgsql/`
- [ ] 資料更新流程自動化（定期下載 Geofabrik 台灣 PBF → 重匯 → 01/02 → 重啟服務）
- [ ] 淡水外海曾看到一塊方形水域，未查明是否為 OSM 原始資料
- [ ] 前端元件（MapView、App）目前無自動化測試，僅以瀏覽器手動驗證

---

## 版本紀錄

| 元件 | 版本 |
|---|---|
| PostgreSQL / PostGIS | 17.5 / 3.6.2 |
| osm2pgsql | 2.3.1 |
| Martin | 1.16.1（2.0 仍為 beta） |
| WinSW | 2.12.0（WinSW.NET461.exe） |
| Node / pnpm | 22.18.0 / 10.32.1 |
| React / TypeScript / Vite / vitest | 19.3 / 7.0.2 / 8.3.8 / 5.1.0 |
| maplibre-gl / style-spec | 6.18.0 / 26.6.0 |
| 資料 | `taiwan-261112.osm.pbf`、osmdata land-polygons（2026-11-13） |
