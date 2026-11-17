# CLAUDE.md — 台灣 OSM 向量圖磚（Gis-Martin）

> 全域偏好（繁中回應、PowerShell 5.1、YAGNI、測試規範、GIS SRID 規則）在使用者全域 CLAUDE.md，這裡只寫本專案特有的事。
> 進度與待辦見 [Progress.md](Progress.md)。

## 架構

```
OSM PBF ──osm2pgsql(flex)──▶ PostGIS (osm_taiwan, EPSG:4326)
                                │  01 minzoom + 綜合表 / 05 陸地 / 02 tile functions
                                ▼
                    Martin 1.16.1（Windows 服務 MartinTiles, 127.0.0.1:3000）
                                │  function sources → MVT（ST_Transform → EPSG:3857）
                                ▼
          MapLibre GL JS 6 + React 19 + TS 7（web/, Vite 8, localhost:5173）
```

- 儲存一律 EPSG:4326；tile function 以 `ST_Transform(ST_TileEnvelope(z,x,y, margin => 64.0/4096), 4326)` 查 bbox，輸出 `ST_Transform(geom, 3857)`。
- 9 個 Martin source（= MVT layer 名）：`land, boundaries, landuse, water, waterways, roads, transit, buildings, pois`。前端用合併 URL `/land,boundaries,…,pois/{z}/{x}/{y}`；**合併 URL 中任一 source 不存在，整串回 404**（新增 source 後忘記重啟服務就會整張地圖空白）。
- Martin maxzoom 14，z15+ 由 MapLibre overzoom。

## 路徑

| 用途 | 路徑 |
|---|---|
| **原始碼（唯一真實來源）** | `D:\1-研發\3-Gis-Martin\`（`osm2pgsql\taiwan.lua`、`martin\*.sql`、`martin\config.yaml`、`martin\service\*.ps1`、`web\`） |
| 執行用副本（純 ASCII 路徑） | `C:\gis\osm\`：`.env`、`taiwan.osm.pbf`、`taiwan.lua`（副本）、`martin\`（SQL/config 副本）、`land\`（海岸線 zip） |
| 工具 | `C:\Tools\osm2pgsql\`（2.3.1）、`C:\Tools\martin\`（1.16.1）、PostgreSQL 17.5 + PostGIS 3.6.2（`C:\Program Files\PostgreSQL\17`） |
| Martin 服務 | `C:\Program Files\MartinTiles\`（WinSW 2.12.0 + martin.exe 副本 + 含密碼 XML）、日誌 `C:\ProgramData\MartinTiles\logs\` |

**修改流程**：改 `D:\…\martin\` 的檔案 → `Copy-Item` 到 `C:\gis\osm\martin\` → `psql -f` → `Restart-Service MartinTiles`（需管理員，會跳 UAC）。不要直接改 `C:\gis\osm\martin\` 的副本。
Lua 同理：改 `D:\…\osm2pgsql\taiwan.lua` → `Copy-Item` 到 `C:\gis\osm\taiwan.lua` → 重匯 → 重跑 01、02。

## 資料庫

- DB `osm_taiwan`；角色 `osm_import`（owner，匯入／建表）、`martin_reader`（唯讀，Martin 用）。`ALTER DEFAULT PRIVILEGES` 讓 osm_import 新建的表自動授權給 martin_reader。
- 帳密只在 `C:\gis\osm\.env`（ACL 限本人）。**絕不印出密碼值**；載入方式：
  ```powershell
  Get-Content C:\gis\osm\.env -Encoding UTF8 | Where-Object { $_ -match '^\s*[^#].*=' } | ForEach-Object { $k, $v = $_ -split '=', 2; Set-Item -Path "Env:$($k.Trim())" -Value $v.Trim() }
  $env:PGPASSWORD = $env:OSM_IMPORT_PASSWORD   # 用完 Remove-Item Env:PGPASSWORD
  ```
- SQL 執行順序：`01_post_import.sql` → （僅更新海岸線時）`05_land.sql` → `02_tile_functions.sql` → `03_verify.sql`（測試）→ `04_benchmark.sql`（大小／時間基準）。
  - osm2pgsql 重匯會 DROP 原表：重匯後必須重跑 01、02。
  - `05_land.sql` 需先以 shp2pgsql 載入 `land_polygons_raw`；`land*` 表不受重匯影響。
  - `tile_land` 是 SQL function，建立時會檢查 `land*` 表存在 → 05 必須早於 02。
  - `01` 的 `boundary_lines`（縣市、鄉鎮市區、村里的陸上共用邊界，建表約 65 秒）讀 `land` → 初次建置須 05 早於 01；之後重匯 land 仍在，照常 01 → 02。
- 綜合表 `*_z8`（z≤8）、`*_z11`（z9–11）用一般 table（非 materialized view），因 osm2pgsql DROP 原表時相依 view 會擋住。

## 常用指令

```powershell
# 前端（web/）
pnpm dev          # http://localhost:5173（必須用 localhost：Martin CORS 只允許此 origin）
pnpm test         # vitest：config / style-spec 驗證 / featureInfo / icons
pnpm typecheck    # tsc --noEmit（strict）
pnpm build        # → web/dist

# DB 測試與基準（需先載入 .env、設 PGPASSWORD、PGCLIENTENCODING=UTF8）
psql -U $env:OSM_IMPORT_USER -d $env:OSM_DB -f C:\gis\osm\martin\03_verify.sql
psql -U $env:OSM_IMPORT_USER -d $env:OSM_DB -f C:\gis\osm\martin\04_benchmark.sql

# Martin 服務
Get-Service MartinTiles
Get-Content C:\ProgramData\MartinTiles\logs\MartinTiles.out.log -Tail 30
```

## 已踩過的坑（務必遵守）

**Windows / PowerShell 5.1**
- `Get-Content` 讀 UTF-8 檔一定加 `-Encoding UTF8`（預設 cp950，中文註解會吃掉下一行）。
- `.ps1` 腳本保持**純 ASCII**（無 BOM 的 .ps1 以 cp950 解析）。
- `psql -f` 含中文的 SQL 前設 `$env:PGCLIENTENCODING = 'UTF8'`。
- 原生程式間的大量管線（shp2pgsql | psql）用 `cmd /c "... | ..."`，PS 管線會轉碼且極慢。
- `$ErrorActionPreference='Stop'` 時原生程式寫 stderr（如 psql WARNING）會變成終止錯誤。
- PS 5.1 呼叫原生程式會丟掉空字串參數 `''`。
- osm2pgsql 等工具避開非 ASCII 路徑 → 一律用 `C:\gis\osm\`。
- Windows 版 PostgreSQL `maintenance_work_mem` 上限 2GB−1kB。
- 新增 PATH 後，目前的 shell 要重載：`$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`。

**Martin 1.16**
- function 的 `COMMENT` 會被當 TileJSON 解析 → 必須是合法 JSON（含 `vector_layers`）。
- cache 設定是 `cache.size_mb` / `cache.tile_size_mb`（舊 `cache_size_mb` 會被靜默忽略）。
- 不用 `DATABASE_URL` 環境變數（deprecated）；config 以 `${MARTIN_DB_URL}` 讀取。
- 輸出導到檔案仍有 ANSI 色碼 → 服務設定 `NO_COLOR=1`。
- 改了 tile function 或資料後要重啟服務清 tile cache；**新增 source（config.yaml）一定要重啟**，服務只在啟動時讀 catalog。確認：`(Invoke-RestMethod http://127.0.0.1:3000/catalog).tiles`。
- 改 `.env` 的 `MARTIN_PASSWORD` 或升級 martin.exe → 重跑 `martin\service\install-martin-service.ps1`（idempotent，需管理員）。

**前端**
- maplibre-gl 6 以 `import.meta.url` 推算 worker，經 Vite 會 404 → `src/map/worker.ts` 以 `?url` + `setWorkerUrl()` 處理，勿移除。
- 中文 glyph 由 `localIdeographFontFamily` 在瀏覽器繪製；glyphs URL 目前指向 demotiles（外部相依）。
- POI 疏密：`tile_pois` 在 z14 帶 `minzoom ≤ 16` 並輸出 `minzoom` 屬性；前端 `pois-symbol`（symbol 圖層，碰撞偵測 + `symbol-sort-key`）依 `minzoom <= zoom` 篩選。
- LOD1 3D 建物：預設高度 6.4 m（2 層 × 3.2 m）同時寫在 `martin/01_post_import.sql` 與 `web/src/map/style.ts` 的 `DEFAULT_BUILDING_HEIGHT_M`，改一邊必須改另一邊。`tile_buildings` 對預設高度建物不輸出 `render_height`／`height_source`（省圖磚大小）。`building:part` 與外框同在 `buildings` 表（`is_part`）；Lua 的 `parse_meters()` 正規化 height 標籤（m／ft）。
- 捷運／高鐵路線色：路線色在 OSM route 關聯（不在軌道 way）→ Lua 匯入 `transit_routes`／`transit_masters`，`01` 合併成 `transit_lines`（route_master 顏色優先；高鐵 OSM 無色，固定 `#CA4F0F`）；前端 `railways` 灰軌之上疊 `transit-casing`／`transit-line`。
- 行政區名稱標註用 `boundary_labels` 代表點（`boundaries` 層內的 Point），不可掛在面上，否則多島縣市每塊島重複標註。
- POI 圖示：Maki（CC0）SVG，對照表 `style.ts` 的 `POI_MAKI`（`class/subclass` → [圖示, 分組]）＋`POI_CLASS_MAKI`（大類預設）；分組決定圓底顏色（`POI_GROUP_COLOR`）。圖示由 `map.setMissingStyleImageResolver()` 依需求非同步產生——**MapLibre 6 的 `styleimagemissing` listener 無法補上當次請求的圖片**，用它會讓首批圖磚缺圖。圖示 id 含分組與主題（`maki-lodging-tourism-dark`）。增減圖示時 `makiGlyphs.ts` 的 `?raw` import 要同步（`Record<MakiName,…>` 型別與測試會抓漏）。
- 公車動態：前端直接輪詢 Data.Taipei `blobbus/GetBusData.gz`（CORS `*`、gzip 需 `DecompressionStream` 解壓、WGS84），不經 Martin／PostGIS；位置以 GeoJSON source 放在 `buildStyle({ buses })` 內，**不要在 style 外 `setData`**（會被下一次 setStyle diff 蓋回空資料）。
- 地圖樣式（主題）只換 `style.ts` 的 `Palette`，圖層結構共用；主題、圖層開關、3D 都烘進 `buildStyle()` 的結果，MapView 以 `setStyle(style, { diff: true })` 套用（不要再對個別圖層 `setLayoutProperty`，下一次 setStyle 會蓋掉）。OpenMapTiles 系列 style JSON（OSM Bright 等）與本專案 schema 不相容，不能直接載入。
- 開發模式 `window.__map` 是 MapLibre 實例（production 不含）。Chrome 擴充截圖常逾時 → 用 `window.__map` 查詢或讀 canvas 像素驗證。

## 圖磚大小目標

合併圖磚（8 層）未壓縮 < 500 KB；調整 zoom 規則前後跑 `04_benchmark.sql` 比對（台北 101，z5–z14）。
