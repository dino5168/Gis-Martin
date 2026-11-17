# Martin Setup：PostGIS → MVT 向量圖磚服務

> 前置：已完成 [Vector-OSM-Setup.md](Vector-OSM-Setup.md)（PostGIS 有 `pois / roads / waterways / buildings / landuse / water / boundaries` 七張表，SRID 4326）。

## 架構決策

| 決策 | 做法 | 理由 |
|---|---|---|
| Source 類型 | **Function source**（`tile_xxx(z,x,y) → bytea`），`auto_publish: false` | 依 zoom 篩選要素、控制輸出欄位；原始表不對外公開 |
| Zoom 分級 | 各表加 `minzoom` generated column，function 以 `minzoom <= z` 過濾 | 規則集中在一支 SQL，調整不需重匯 PBF；`NULL` = 不出圖 |
| Index | `GiST (geom, minzoom)`（btree_gist） | 低 zoom 時 bbox 涵蓋全台，單靠 geom index 會掃整表 |
| 座標系 | 儲存 EPSG:4326；bbox 以 `ST_Transform(ST_TileEnvelope(...), 4326)` 查詢；輸出 `ST_Transform(geom, 3857)` | 符合儲存/渲染分離，且 index 仍可命中 |
| Zoom 範圍 | Martin 0–14，z15+ 由 MapLibre overzoom | 台灣 z14 資料已完整，z15+ 只會徒增圖磚數 |
| 圖層合併 | Martin composite source：`/boundaries,landuse,…/{z}/{x}/{y}` | 前端一個 request 取全部圖層 |
| 低 zoom 綜合 | roads / landuse / boundaries 各建 `*_z8`（z ≤ 8）、`*_z11`（z 9–11）兩級綜合表；z ≥ 12 用原表 | 見下方「圖磚大小調校」 |

## 檔案

| 檔案 | 用途 | 執行者 |
|---|---|---|
| [`martin/01_post_import.sql`](martin/01_post_import.sql) | `minzoom` 欄位 + 複合 GiST index + 低 zoom 綜合表 | `osm_import`，每次匯入後 |
| [`martin/02_tile_functions.sql`](martin/02_tile_functions.sql) | 7 支 tile function | `osm_import`，每次匯入後 |
| [`martin/03_verify.sql`](martin/03_verify.sql) | DB 端測試 + EXPLAIN | `osm_import` |
| [`martin/04_benchmark.sql`](martin/04_benchmark.sql) | 台北 z5–z14 各圖層大小／時間基準 | `osm_import`，調整規則前後 |
| [`martin/05_land.sql`](martin/05_land.sql) | 陸地多邊形（海陸分色）：裁切瀏覽範圍、切塊、低 zoom 綜合表 | `osm_import`，僅更新陸地資料時（見「陸地多邊形」） |
| [`martin/config.yaml`](martin/config.yaml) | Martin 設定 | Martin |

### Zoom 規則摘要

| 圖層 | 規則 |
|---|---|
| boundaries | 國界、縣市 z0+；鄉鎮市區 z9+；村里 z12+。縣市（4）、鄉鎮市區（7/8）、村里（9）皆不出面外框，改出 `boundary_lines`：同級相鄰區共用邊 ∩ 陸地（離島縣、單島鄉村無線，無海上段）；縣市與鄉鎮市區另各出一個標註點（`boundary_labels`）。前端國界（level 2，多為領海線）z10+ 才顯示 |
| landuse / water | 依面積：≥100 km² z5、≥10 km² z7、≥1 km² z9、≥0.1 km² z11、其餘 z13 |
| waterways | river z8、canal z10、stream z13、drain/ditch z14 |
| roads | motorway/trunk z5、primary z8、secondary z10、tertiary z11、residential z12、service z13、footway/path z14；rail z8、捷運 z10 |
| transit | 路線色線形（`transit_lines`）：高鐵 z7、捷運／單軌 z10、輕軌 z11、路面電車 z12；`colour` 取 route_master 優先、其次 route，高鐵固定 `#CA4F0F`；欄位 `kind, ref, network, name, colour` |
| buildings | z13+（只有外框）；z14 起加 `building:part` 分段與 LOD1 高度：`render_height`／`render_min_height`（公尺）、`height_source`（`height` 標註／`levels` × 3.2 m）。無高度資料者（約 87%）預設 2 層 6.4 m，為省圖磚大小**不輸出**高度與來源，前端缺值即視為預設。`has_parts` 標記有分段的外框（3D 時隱藏外框改畫分段） |
| pois | 火車站 z11、捷運站 z12、醫院/大學/景點 z13、公共設施/旅館/大型商場 z14、日常去處（餐飲、銀行、便利商店、宮廟…）z15、公車站牌（`public_transport=platform` + `highway=bus_stop`／`bus=yes`）與其餘有名稱者 z16；街道設施（停車場出入口、飲水機、垃圾桶…）、空店面、無名雜項、平交道等不出圖。z14 圖磚含 minzoom ≤ 16 並輸出 `minzoom` 屬性，z15+ 由前端依 zoom 篩選＋symbol 碰撞偵測控制疏密 |

---

### 圖磚大小調校

目標：合併圖磚（7 層）未壓縮 < 500 KB。以 `04_benchmark.sql` 量測台北市中心（最密集處）。

| 問題 | 原因 | 對策 |
|---|---|---|
| roads z8–z11 過大 | OSM 道路被切成大量短 way（z10 一張圖磚 14,670 個 feature、平均 6 個頂點），feature 數是主因 | 綜合表以 `ST_LineMerge` 合併同 kind/class/name/ref 的相連線段，再 `ST_Simplify`；低 zoom 不輸出 oneway/layer/bridge/tunnel；tertiary 延後到 z11 |
| landuse z8–z9 慢 | 少數森林面就有十多萬頂點，每次出圖都要整個轉換＋裁切 | `ST_SimplifyPreserveTopology` 後 `ST_Subdivide(…, 256)` 切小塊 |
| boundaries z9 偏大 | 鄉鎮界全精度 | 只簡化，不切塊（外框線會出現假接縫） |
| pois / waterways 低 zoom 空圖磚仍耗時 | 全台 bbox 掃 index | function 內 `z >= 最小 minzoom` 短路 |

簡化容差（EPSG:4326 度數）約等於該級最大 zoom 的 1 個 tile 單位：`*_z8` 0.0003°（≈ 38 m）、`*_z11` 0.00004°（≈ 4.8 m）。

調校結果（合併圖磚，未壓縮 / gzip 傳輸）：

| zoom | 調校前 | 調校後 | gzip |
|---|---:|---:|---:|
| z8 | 599 KB | 289 KB | — |
| z9 | 694 KB | 487 KB | 256 KB |
| z10 | 827 KB | 315 KB | — |
| z11 | 480 KB | 209 KB | — |
| z13 | 492 KB | 492 KB | 250 KB |
| z14 | 394 KB | 394 KB | 206 KB |

### 陸地多邊形（海陸分色）

OSM 海岸線不在 osm2pgsql 匯入的表內；改用 [osmdata](https://osmdata.openstreetmap.de/data/land-polygons.html) 由海岸線處理好的全球陸地面 `land-polygons-split-4326`（EPSG:4326，約 890 MB）。資料與 OSM 匯入獨立，osm2pgsql 重匯不會刪除 `land*` 表，只有想更新海岸線時才需重做。

```powershell
# 1. 下載並解壓（curl.exe 比 PS 5.1 的 Invoke-WebRequest 快很多）
New-Item -ItemType Directory -Force C:\gis\osm\land | Out-Null
curl.exe -L --fail -o C:\gis\osm\land\land-polygons-split-4326.zip https://osmdata.openstreetmap.de/download/land-polygons-split-4326.zip
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::ExtractToDirectory('C:\gis\osm\land\land-polygons-split-4326.zip', 'C:\gis\osm\land\extract')

# 2. 載入全球資料到 raw 表（約 1 分鐘、1.4 GB）。管線用 cmd：PS 5.1 會把原生程式間的管線轉碼，極慢
$env:PGPASSWORD = $env:OSM_IMPORT_PASSWORD
cmd /c "shp2pgsql -s 4326 -D -c -g geom C:\gis\osm\land\extract\land-polygons-split-4326\land_polygons.shp public.land_polygons_raw | psql -q -U %OSM_IMPORT_USER% -d %OSM_DB% -v ON_ERROR_STOP=1"

# 3. 裁切台灣範圍、切塊、建綜合表，並刪除 raw 表（數秒）
$env:PGCLIENTENCODING = 'UTF8'
psql -U $env:OSM_IMPORT_USER -d $env:OSM_DB -f C:\gis\osm\martin\05_land.sql
Remove-Item Env:PGPASSWORD
Remove-Item C:\gis\osm\land\extract -Recurse -Force
```

結果：`land` 12,730 塊（13 MB），裁切範圍 113.5–125.5°E、18.5–28.5°N（前端 maxBounds 外擴 1°，Martin `land` source 的 bounds 同此；只裁台灣附近時，低 zoom 會看到福建沿海被切成方框）。z5 台灣圖磚的 land 層約 58 KB。**`05_land.sql` 必須在 `02_tile_functions.sql` 之前執行**：`tile_land` 是 SQL function，建立時會檢查 `land*` 表是否存在。

---

## 1. 啟用 btree_gist（superuser，一次性）

```powershell
# 先依 Vector-OSM-Setup.md 步驟 3 載入 .env
$env:PGPASSWORD = $env:PG_SUPERUSER_PASSWORD
psql -U $env:PG_SUPERUSER -d $env:OSM_DB -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"
Remove-Item Env:PGPASSWORD
```

## 2. 複製檔案到 ASCII 工作目錄

```powershell
New-Item -ItemType Directory -Force C:\gis\osm\martin | Out-Null
Copy-Item "D:\1-研發\3-Gis-Martin\martin\*" C:\gis\osm\martin\ -Force
```

## 3. 建立 minzoom 與 tile functions

```powershell
$env:PGPASSWORD = $env:OSM_IMPORT_PASSWORD
psql -U $env:OSM_IMPORT_USER -d $env:OSM_DB -f C:\gis\osm\martin\01_post_import.sql
psql -U $env:OSM_IMPORT_USER -d $env:OSM_DB -f C:\gis\osm\martin\02_tile_functions.sql
Remove-Item Env:PGPASSWORD
```

`01_post_import.sql` 會重寫各表（ADD COLUMN STORED），台灣資料約數分鐘。

> function 預設 `EXECUTE` 授權給 PUBLIC，`martin_reader` 可直接呼叫；表的 `SELECT` 已由 `ALTER DEFAULT PRIVILEGES` 授權。

## 4. DB 端驗證

```powershell
$env:PGPASSWORD = $env:OSM_IMPORT_PASSWORD
psql -U $env:OSM_IMPORT_USER -d $env:OSM_DB -f C:\gis\osm\martin\03_verify.sql
Remove-Item Env:PGPASSWORD
```

預期：`NOTICE: ALL TILE FUNCTION CHECKS PASSED`，EXPLAIN 中出現 `roads_geom_minzoom_idx`。

## 5. 安裝並啟動 Martin

1. 從 <https://github.com/maplibre/martin/releases> 下載**穩定版** `martin-v1.16.1` 的 `martin-x86_64-pc-windows-msvc.zip`（2.0 目前仍是 beta），解壓到 `C:\Tools\martin`，並加入使用者 PATH。
2. 以唯讀帳號啟動：

```powershell
# 先依 Vector-OSM-Setup.md 步驟 3 載入 .env
$env:MARTIN_DB_URL = "postgresql://$($env:MARTIN_USER):$($env:MARTIN_PASSWORD)@$($env:PGHOST):$($env:PGPORT)/$($env:OSM_DB)"
# Martin 只需要自己的連線字串，其他密碼從這個 session 移除
Remove-Item Env:PG_SUPERUSER_PASSWORD, Env:OSM_IMPORT_PASSWORD, Env:MARTIN_PASSWORD
martin --config C:\gis\osm\martin\config.yaml
```

`config.yaml` 以 `${MARTIN_DB_URL}` 取得連線字串，密碼不落檔。不使用 `DATABASE_URL` 這個名稱：Martin 1.16 會自動讀取它並發出 deprecated 警告。

> Martin 會把每支 function 的 `COMMENT` 當作 TileJSON 解析，所以 `02_tile_functions.sql` 的 COMMENT 是 JSON（含 `vector_layers` 欄位定義），不是一般說明文字。

## 6. HTTP 端驗證

另開 PowerShell：

```powershell
# catalog：應列出 7 個 function source
(Invoke-RestMethod http://localhost:3000/catalog).tiles.PSObject.Properties.Name

# 單一圖層 tile（台北 101，z14）
$r = Invoke-WebRequest http://localhost:3000/roads/14/13724/7014 -UseBasicParsing
"$($r.StatusCode) $($r.RawContentLength) bytes"

# composite TileJSON（前端使用的 URL）
Invoke-RestMethod http://localhost:3000/land,boundaries,landuse,water,waterways,roads,transit,buildings,pois
```

## 7. MapLibre 端接法（下一階段預覽）

```json
{
  "version": 8,
  "sources": {
    "taiwan": {
      "type": "vector",
      "url": "http://localhost:3000/land,boundaries,landuse,water,waterways,roads,transit,buildings,pois"
    }
  },
  "layers": [
    { "id": "bg", "type": "background", "paint": { "background-color": "#aad3df" } },
    { "id": "landuse", "type": "fill", "source": "taiwan", "source-layer": "landuse",
      "paint": { "fill-color": "#cde6c7" } },
    { "id": "water", "type": "fill", "source": "taiwan", "source-layer": "water",
      "paint": { "fill-color": "#aad3df" } },
    { "id": "roads", "type": "line", "source": "taiwan", "source-layer": "roads",
      "paint": { "line-color": "#999", "line-width": 1 } },
    { "id": "buildings", "type": "fill", "source": "taiwan", "source-layer": "buildings",
      "paint": { "fill-color": "#d9d0c9" } }
  ]
}
```

`source-layer` 名稱即 function 內 `ST_AsMVT(..., '<layer>')` 的名稱，與 Martin source id 相同。

> **陸地/海洋**：已由 `land` 圖層處理（見上方「陸地多邊形」）。

---

## 8. Windows 服務（開機自動啟動）

以 [WinSW](https://github.com/winsw/winsw) v2.12.0 包裝成服務 `MartinTiles`（Martin 本身不實作 Windows 服務介面，不能直接 `sc.exe create`）。

| 項目 | 設定 |
|---|---|
| 服務帳號 | `NT AUTHORITY\LocalService`（低權限內建帳號） |
| 執行檔 | `C:\Program Files\MartinTiles\`（只有管理員可寫入，避免服務執行檔被替換） |
| 設定檔 | `C:\gis\osm\martin\config.yaml`（不需管理員即可編輯，改完重啟服務） |
| 連線字串 | WinSW XML 內的 `MARTIN_DB_URL`；XML 權限只給 SYSTEM、Administrators、LocalService（唯讀） |
| 啟動 | 自動；相依 `postgresql-x64-17`（PostgreSQL 先起來） |
| 失敗復原 | 10 s／30 s／60 s 後自動重啟，1 小時重置計數 |
| 日誌 | `C:\ProgramData\MartinTiles\logs\`：`MartinTiles.out.log`（Martin 輸出）、`MartinTiles.wrapper.log`（WinSW），10 MB 輪替保留 8 份；`NO_COLOR=1` 讓日誌為純文字 |

安裝／重新安裝（idempotent，會先移除舊服務；需管理員，會跳 UAC）：

```powershell
# WinSW.NET461.exe 從 https://github.com/winsw/winsw/releases/tag/v2.12.0 下載（655,872 bytes）
New-Item -ItemType Directory -Force C:\gis\osm\martin\service | Out-Null
Copy-Item "D:\1-研發\3-Gis-Martin\martin\service\*.ps1" C:\gis\osm\martin\service\ -Force
Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass',
    '-File','C:\gis\osm\martin\service\install-martin-service.ps1',
    '-WinSWPath','C:\gis\osm\martin\service\WinSW.NET461.exe'
Get-Content C:\ProgramData\MartinTiles\install.log | Select-String 'RESULT|FAILED'
```

> 腳本刻意只用 ASCII：Windows PowerShell 5.1 以 cp950 讀取沒有 BOM 的 `.ps1`，中文會變亂碼甚至語法錯誤。

日常管理（`Restart-Service`／`Stop-Service` 需管理員 PowerShell）：

```powershell
Get-Service MartinTiles                     # 狀態
Restart-Service MartinTiles                 # 改 config.yaml 或 tile function 後
Get-Content C:\ProgramData\MartinTiles\logs\MartinTiles.out.log -Tail 30
```

移除：以管理員執行 `C:\gis\osm\martin\service\uninstall-martin-service.ps1`（加 `-RemoveLogs` 一併刪除日誌）。

> **改了 `.env` 的 `MARTIN_PASSWORD` 或升級 `martin.exe`**：重跑安裝腳本。服務使用的是安裝時複製到 `C:\Program Files\MartinTiles` 的副本與 XML 內的連線字串。

---

## 日常操作

| 情境 | 動作 |
|---|---|
| 重新匯入 PBF | Vector-OSM-Setup 步驟 7 → 本文件步驟 3、4 → `Restart-Service MartinTiles`（清除 tile cache） |
| 調整 zoom 規則 | 改 `01_post_import.sql` → 重跑步驟 3、4 → `Restart-Service MartinTiles` |
| 增加輸出欄位 | 改 `02_tile_functions.sql` 對應 function 的 SELECT 欄位 → 重跑 → `Restart-Service MartinTiles` |
| 改 Martin 設定 | 改 `C:\gis\osm\martin\config.yaml` → `Restart-Service MartinTiles` |

## 疑難排解

| 症狀 | 原因 / 處理 |
|---|---|
| `type "gbtreekey..." does not exist` / 建 index 失敗 | 未執行步驟 1 的 btree_gist |
| `column t.minzoom does not exist` | 重新匯入後沒重跑 `01_post_import.sql` |
| catalog 為空 | `auto_publish: false` 下只看 `functions:`；確認 function 存在：`\df public.tile_*` |
| catalog 出現但 tile 回 500 | Martin console 會印 SQL 錯誤；多半是 `martin_reader` 缺 `SELECT`：`GRANT SELECT ON ALL TABLES IN SCHEMA public TO martin_reader;` |
| 低 zoom 很慢 | `EXPLAIN ANALYZE SELECT tile_landuse(6, 53, 27);` 確認走 `*_geom_minzoom_idx`；必要時調高 landuse/water 面積門檻 |
| 前端 CORS 錯誤 | 把前端 origin 加入 `config.yaml` 的 `cors.origin` |
