# Vector OSM Setup：台灣 OSM PBF → PostGIS

> 架構（參考設計圖 `images/Margin.png`）：
> **OSM PBF → osm2pgsql → PostGIS → Martin (MVT) → MapLibre GL JS → React GIS**
>
> 本文件處理前三段：把台灣 PBF 匯入 PostGIS，並確認 Martin 可以直接讀取。

---

## 0. 環境現況（2026-11-13 偵測結果）

| 項目            | 狀態                                          | 備註                                            |
| ------------- | ------------------------------------------- | --------------------------------------------- |
| PostgreSQL 17 | ✅ 已安裝，服務 `postgresql-x64-17` Running        | `C:\Program Files\PostgreSQL\17\bin\psql.exe` |
| PostGIS       | ❌ **未安裝**                                   | `share\extension\postgis.control` 不存在         |
| osm2pgsql     | ❌ **未安裝**                                   | 不在 PATH                                       |
| psql 在 PATH   | ❌                                           | 需加入 PATH                                      |
| 資料            | ✅ `C:\資料收集\taiwan-261112.osm.pbf`（約 313 MB） |                                               |

設計決策：

- **儲存 SRID = EPSG:4326**；Martin 出圖時以 `ST_Transform(geom, 3857)` 轉 EPSG:3857，並以 `ST_Transform(ST_TileEnvelope(z,x,y), 4326)` 做 bbox 篩選，GiST index 仍可命中。
- 使用 osm2pgsql **flex output**（Lua 自訂 schema），依 Martin layer 拆表：`pois` / `roads` / `waterways` / `buildings` / `landuse` / `water` / `boundaries`，每張表單一幾何型別，Martin 會自動發佈成獨立 tile source。
- 一次性匯入（`--slim --drop`），不做 replication diff 更新；資料更新時整批重匯（台灣規模約 10–20 分鐘）。

---

## 1. 安裝 PostGIS（PostgreSQL 17）

擇一：

- **Stack Builder**（建議）：開始功能表 → `Application Stack Builder` → 選 `postgresql-x64-17` → `Spatial Extensions` → `PostGIS 3.5 Bundle for PostgreSQL 17` → 安裝（不需勾選建立範例 DB）。
- 或直接下載安裝檔：<https://download.osgeo.org/postgis/windows/pg17/>

驗證：

```powershell
Test-Path "C:\Program Files\PostgreSQL\17\share\extension\postgis.control"   # 應為 True
```

## 2. 安裝 osm2pgsql 與設定 PATH

1. 從 <https://osm2pgsql.org/download/windows/> 下載最新 Windows zip（需 **2.x** 版）。
2. 解壓到 `C:\Tools\osm2pgsql`。
3. 將 osm2pgsql 與 psql 加入使用者 PATH（開新的 PowerShell 視窗後生效）：

```powershell
$add = 'C:\Tools\osm2pgsql;C:\Program Files\PostgreSQL\17\bin'
$cur = [Environment]::GetEnvironmentVariable('Path', 'User')
[Environment]::SetEnvironmentVariable('Path', "$cur;$add", 'User')
```

驗證（新視窗）：

```powershell
osm2pgsql --version   # 2.x
psql --version        # 17.x
```

## 3. 工作目錄與 .env

> osm2pgsql 對非 ASCII 路徑（`D:\1-研發`、`C:\資料收集`）在部分版本會開檔失敗，**統一放在純 ASCII 路徑**最省事。

```powershell
New-Item -ItemType Directory -Force C:\gis\osm | Out-Null
Copy-Item "C:\資料收集\taiwan-261112.osm.pbf" C:\gis\osm\taiwan.osm.pbf
```

建立 `C:\gis\osm\.env`（**不要進版控**）：

```dotenv
PGHOST=localhost
PGPORT=5432
PG_SUPERUSER=postgres
PG_SUPERUSER_PASSWORD=<安裝 PostgreSQL 時設定的密碼>
OSM_DB=osm_taiwan
OSM_IMPORT_USER=osm_import
OSM_IMPORT_PASSWORD=<自訂強密碼>
MARTIN_USER=martin_reader
MARTIN_PASSWORD=<自訂強密碼>
```

每次開新 PowerShell 時載入 `.env`：

```powershell
# PowerShell 5.1 的 Get-Content 預設以系統 ANSI（cp950）讀檔，必須指定 UTF8
Get-Content C:\gis\osm\.env -Encoding UTF8 | Where-Object { $_ -match '^\s*[^#].*=' } | ForEach-Object {
    $k, $v = $_ -split '=', 2
    Set-Item -Path "Env:$($k.Trim())" -Value $v.Trim()
}
```

## 4. 建立資料庫、角色與 PostGIS extension

最小權限：`osm_import` 負責寫入、`martin_reader` 僅能讀取。

```powershell
$env:PGPASSWORD = $env:PG_SUPERUSER_PASSWORD

# psql 變數插值只在 stdin / -f 生效，-c 不會展開 :'var'
@"
CREATE ROLE $($env:OSM_IMPORT_USER) LOGIN PASSWORD :'import_pw';
CREATE ROLE $($env:MARTIN_USER)     LOGIN PASSWORD :'martin_pw';
CREATE DATABASE $($env:OSM_DB) OWNER $($env:OSM_IMPORT_USER) ENCODING 'UTF8' TEMPLATE template0;
"@ | psql -U $env:PG_SUPERUSER -d postgres -v ON_ERROR_STOP=1 `
         -v import_pw="$env:OSM_IMPORT_PASSWORD" -v martin_pw="$env:MARTIN_PASSWORD"

@"
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;   -- Martin (geom, minzoom) 複合 GiST index 用
GRANT CONNECT ON DATABASE $($env:OSM_DB) TO $($env:MARTIN_USER);
GRANT USAGE ON SCHEMA public TO $($env:MARTIN_USER);
-- 之後 osm_import 建立的表自動授權 SELECT 給 Martin
ALTER DEFAULT PRIVILEGES FOR ROLE $($env:OSM_IMPORT_USER) IN SCHEMA public
    GRANT SELECT ON TABLES TO $($env:MARTIN_USER);
-- PG15+ public schema 預設不給 CREATE，匯入角色需要
GRANT CREATE ON SCHEMA public TO $($env:OSM_IMPORT_USER);
SELECT postgis_full_version();
"@ | psql -U $env:PG_SUPERUSER -d $env:OSM_DB -v ON_ERROR_STOP=1

Remove-Item Env:PGPASSWORD
```

## 5. 匯入期間暫時調校 PostgreSQL

匯入結束後會在步驟 9 還原。數值以 16 GB RAM 為基準，依實機調整。

```powershell
$env:PGPASSWORD = $env:PG_SUPERUSER_PASSWORD
@"
ALTER SYSTEM SET maintenance_work_mem = '1GB';   -- Windows 上限 2GB-1kB
ALTER SYSTEM SET work_mem = '256MB';
ALTER SYSTEM SET max_wal_size = '10GB';
ALTER SYSTEM SET checkpoint_timeout = '30min';
ALTER SYSTEM SET synchronous_commit = 'off';
SELECT pg_reload_conf();
"@ | psql -U $env:PG_SUPERUSER -d postgres -v ON_ERROR_STOP=1
Remove-Item Env:PGPASSWORD
```

## 6. Flex style：`C:\gis\osm\taiwan.lua`

```lua
-- osm2pgsql flex style for Taiwan → Martin vector tiles
-- Storage SRID: EPSG:4326 (Martin transforms to EPSG:3857 at tile time)
local SRID = 4326

local tables = {}

tables.pois = osm2pgsql.define_node_table('pois', {
    { column = 'name',     type = 'text' },
    { column = 'class',    type = 'text', not_null = true },
    { column = 'subclass', type = 'text' },
    { column = 'tags',     type = 'jsonb' },
    { column = 'geom',     type = 'point', projection = SRID, not_null = true },
})

tables.roads = osm2pgsql.define_way_table('roads', {
    { column = 'name',   type = 'text' },
    { column = 'class',  type = 'text', not_null = true },   -- highway / railway 值
    { column = 'kind',   type = 'text', not_null = true },   -- 'highway' | 'railway'
    { column = 'ref',    type = 'text' },
    { column = 'oneway', type = 'direction' },
    { column = 'layer',  type = 'int' },
    { column = 'bridge', type = 'bool' },
    { column = 'tunnel', type = 'bool' },
    { column = 'geom',   type = 'linestring', projection = SRID, not_null = true },
})

tables.waterways = osm2pgsql.define_way_table('waterways', {
    { column = 'name',  type = 'text' },
    { column = 'class', type = 'text', not_null = true },
    { column = 'geom',  type = 'linestring', projection = SRID, not_null = true },
})

-- building 外框與 building:part 分段（3D 建模用）都放這張表，以 is_part 區分
tables.buildings = osm2pgsql.define_area_table('buildings', {
    { column = 'name',       type = 'text' },
    { column = 'building',   type = 'text' },
    { column = 'levels',     type = 'int' },
    { column = 'min_level',  type = 'int' },
    { column = 'height',     type = 'real' },   -- 公尺，已由 parse_meters 正規化
    { column = 'min_height', type = 'real' },
    { column = 'is_part',    type = 'bool', not_null = true },
    { column = 'geom',       type = 'multipolygon', projection = SRID, not_null = true },
})

tables.landuse = osm2pgsql.define_area_table('landuse', {
    { column = 'name',  type = 'text' },
    { column = 'class', type = 'text', not_null = true },    -- landuse / leisure / natural
    { column = 'type',  type = 'text', not_null = true },
    { column = 'geom',  type = 'multipolygon', projection = SRID, not_null = true },
})

tables.water = osm2pgsql.define_area_table('water', {
    { column = 'name',  type = 'text' },
    { column = 'class', type = 'text' },
    { column = 'geom',  type = 'multipolygon', projection = SRID, not_null = true },
})

tables.boundaries = osm2pgsql.define_relation_table('boundaries', {
    { column = 'name',        type = 'text' },
    { column = 'admin_level', type = 'int', not_null = true },
    { column = 'geom',        type = 'multipolygon', projection = SRID, not_null = true },
})

-- 捷運／輕軌／高鐵路線關聯（type=route）：路線色在關聯上，不在軌道 way 上。
-- 去回程各一個關聯、幾何相同，由 01_post_import.sql 合併成 transit_lines。
tables.transit_routes = osm2pgsql.define_relation_table('transit_routes', {
    { column = 'route',    type = 'text', not_null = true },
    { column = 'ref',      type = 'text' },
    { column = 'name',     type = 'text' },
    { column = 'colour',   type = 'text' },
    { column = 'network',  type = 'text' },
    { column = 'operator', type = 'text' },
    { column = 'geom',     type = 'multilinestring', projection = SRID, not_null = true },
})

-- 上層路線（type=route_master）：顏色較一致（例：桃園機捷直達車），members 為其下 route 關聯 id
tables.transit_masters = osm2pgsql.define_relation_table('transit_masters', {
    { column = 'route',   type = 'text', not_null = true },
    { column = 'ref',     type = 'text' },
    { column = 'name',    type = 'text' },
    { column = 'colour',  type = 'text' },
    { column = 'members', type = 'jsonb' },
})

local POI_KEYS = { 'amenity', 'shop', 'tourism', 'leisure', 'historic', 'office', 'railway', 'public_transport' }

local WATER_NATURAL = { water = true, bay = true, wetland = true }
local LANDUSE_NATURAL = { wood = true, scrub = true, grassland = true, heath = true,
                          sand = true, beach = true, bare_rock = true, scree = true }

-- 封閉 way 是否當作面：避免把環狀道路誤判為面
local function is_area(tags)
    if tags.area == 'no' then return false end
    return tags.area == 'yes' or tags.building or tags['building:part'] or tags.landuse
        or tags.leisure or tags.natural or tags.amenity or tags.water
end

-- OSM 高度標籤寫法不一："35"、"35 m"、"35m"、"35.5"、"115 ft"、"35;40"。
-- 統一轉成公尺；無法解析或明顯錯誤（≤ 0、> 1000 m）回傳 nil，交給後處理用樓層推估。
local function parse_meters(v)
    if not v then return nil end
    local num, unit = v:match('^%s*([%d%.]+)%s*([%a\']*)')
    local n = tonumber(num)
    if not n then return nil end
    if unit == 'ft' or unit == 'feet' or unit == "'" then n = n * 0.3048 end
    if n <= 0 or n > 1000 then return nil end
    return n
end

local function add_building(tags, geom, is_part)
    tables.buildings:insert({
        name = tags.name,
        building = is_part and tags['building:part'] or tags.building,
        levels = tags['building:levels'],
        min_level = tags['building:min_level'],
        height = parse_meters(tags.height),
        min_height = parse_meters(tags.min_height),
        is_part = is_part,
        geom = geom,
    })
end

local function add_area(tags, geom)
    if tags.building and tags.building ~= 'no' then
        add_building(tags, geom, false)
        return
    end

    if tags['building:part'] and tags['building:part'] ~= 'no' then
        add_building(tags, geom, true)
        return
    end

    if WATER_NATURAL[tags.natural] or tags.waterway == 'riverbank'
        or tags.landuse == 'reservoir' or tags.landuse == 'basin' then
        tables.water:insert({ name = tags.name, class = tags.water or tags.natural or tags.landuse, geom = geom })
        return
    end

    if tags.landuse then
        tables.landuse:insert({ name = tags.name, class = 'landuse', type = tags.landuse, geom = geom })
    elseif tags.leisure then
        tables.landuse:insert({ name = tags.name, class = 'leisure', type = tags.leisure, geom = geom })
    elseif LANDUSE_NATURAL[tags.natural] then
        tables.landuse:insert({ name = tags.name, class = 'natural', type = tags.natural, geom = geom })
    end
end

function osm2pgsql.process_node(object)
    local tags = object.tags
    for _, k in ipairs(POI_KEYS) do
        if tags[k] then
            tables.pois:insert({
                name = tags.name, class = k, subclass = tags[k],
                tags = tags, geom = object:as_point(),
            })
            return
        end
    end
end

function osm2pgsql.process_way(object)
    local tags = object.tags

    if tags.highway or tags.railway then
        if tags.area ~= 'yes' then
            tables.roads:insert({
                name = tags.name,
                class = tags.highway or tags.railway,
                kind = tags.highway and 'highway' or 'railway',
                ref = tags.ref, oneway = tags.oneway, layer = tags.layer,
                bridge = tags.bridge ~= nil and tags.bridge ~= 'no',
                tunnel = tags.tunnel ~= nil and tags.tunnel ~= 'no',
                geom = object:as_linestring(),
            })
        end
        return
    end

    if tags.waterway and tags.waterway ~= 'riverbank' then
        tables.waterways:insert({ name = tags.name, class = tags.waterway, geom = object:as_linestring() })
        return
    end

    if object.is_closed and is_area(tags) then
        add_area(tags, object:as_polygon())
    end
end

local TRANSIT_ROUTES = { subway = true, light_rail = true, monorail = true, tram = true }

-- 台鐵／高鐵都是 route=train；只收高鐵（台鐵路線在 OSM 沒有顏色，維持一般鐵道樣式）。
-- 只看 operator／network：名稱常含「高鐵站」（如台糖五分車「…高鐵站方向」）會誤判。
-- 高鐵每個車次是一條 route（約 170 條），由 01_post_import.sql 合併成同一條線。
local function is_transit(kind, tags)
    if TRANSIT_ROUTES[kind] then return true end
    if kind ~= 'train' then return false end
    local who = (tags.operator or '') .. ' ' .. (tags.network or '')
    return who:find('高速鐵路', 1, true) ~= nil or who:find('高鐵', 1, true) ~= nil
end

function osm2pgsql.process_relation(object)
    local tags = object.tags

    if tags.type == 'route' and is_transit(tags.route, tags) then
        tables.transit_routes:insert({
            route = tags.route, ref = tags.ref, name = tags.name,
            colour = tags.colour or tags.color, network = tags.network, operator = tags.operator,
            geom = object:as_multilinestring(),
        })
        return
    end

    if tags.type == 'route_master' and is_transit(tags.route_master, tags) then
        local ids = {}
        for _, m in ipairs(object.members) do
            if m.type == 'r' then ids[#ids + 1] = m.ref end
        end
        tables.transit_masters:insert({
            route = tags.route_master, ref = tags.ref, name = tags.name,
            colour = tags.colour or tags.color, members = ids,
        })
        return
    end

    if tags.type == 'boundary' and tags.boundary == 'administrative' and tags.admin_level then
        tables.boundaries:insert({
            name = tags.name, admin_level = tags.admin_level,
            geom = object:as_multipolygon(),
        })
        return
    end

    if tags.type == 'multipolygon' then
        add_area(tags, object:as_multipolygon())
    end
end
```

> 台灣行政層級：`admin_level=4` 直轄市／縣市、`7`／`8` 鄉鎮市區（實測 170 + 199 筆）、`9` 村里。

## 7. 執行匯入

```powershell
$env:PGPASSWORD = $env:OSM_IMPORT_PASSWORD
osm2pgsql `
    --database $env:OSM_DB --username $env:OSM_IMPORT_USER `
    --host $env:PGHOST --port $env:PGPORT `
    --output flex --style C:\gis\osm\taiwan.lua `
    --slim --drop `
    --cache 4000 `
    --number-processes ([Environment]::ProcessorCount) `
    --log-progress true `
    C:\gis\osm\taiwan.osm.pbf
Remove-Item Env:PGPASSWORD
```

參數說明：

- `--slim --drop`：中介 node/way 表放 DB，匯入完即刪除 → 省 RAM、省空間；代價是無法做增量更新（本專案採整批重匯）。
- `--cache 4000`：node 座標快取（MB），台灣資料量 4 GB 足夠，RAM 較少可降到 2000。
- flex output 會自動為每張表的 `geom` 建 GiST index 並 `CLUSTER`。

## 8. 驗證

```powershell
$env:PGPASSWORD = $env:OSM_IMPORT_PASSWORD
@"
SELECT 'pois' t, count(*) FROM pois UNION ALL
SELECT 'roads', count(*) FROM roads UNION ALL
SELECT 'waterways', count(*) FROM waterways UNION ALL
SELECT 'buildings', count(*) FROM buildings UNION ALL
SELECT 'landuse', count(*) FROM landuse UNION ALL
SELECT 'water', count(*) FROM water UNION ALL
SELECT 'boundaries', count(*) FROM boundaries;

-- 確認 SRID 全為 4326
SELECT f_table_name, f_geometry_column, srid, type
FROM geometry_columns WHERE f_table_schema = 'public' ORDER BY 1;

-- 範圍應涵蓋台澎金馬（約 lon 118~123, lat 21~27）
SELECT ST_Extent(geom) FROM boundaries WHERE admin_level = 4;

-- 縣市清單
SELECT name FROM boundaries WHERE admin_level = 4 ORDER BY name;

-- 3857 轉換抽樣（EPSG:4326 → EPSG:3857）
SELECT name, ST_AsText(ST_Transform(geom, 3857)) FROM pois WHERE name = '台北101' LIMIT 1;
"@ | psql -d $env:OSM_DB -U $env:OSM_IMPORT_USER -v ON_ERROR_STOP=1
Remove-Item Env:PGPASSWORD
```

## 9. 匯入後整理

```powershell
# 統計資訊（匯入角色為 owner，可執行）
$env:PGPASSWORD = $env:OSM_IMPORT_PASSWORD
# 只處理自己的表；不指定表會嘗試系統表而產生 permission WARNING
psql -d $env:OSM_DB -U $env:OSM_IMPORT_USER -c "VACUUM ANALYZE public.roads, public.buildings, public.pois, public.landuse, public.water, public.waterways, public.boundaries;"

# 還原步驟 5 的暫時調校
$env:PGPASSWORD = $env:PG_SUPERUSER_PASSWORD
@"
ALTER SYSTEM RESET maintenance_work_mem;
ALTER SYSTEM RESET work_mem;
ALTER SYSTEM RESET max_wal_size;
ALTER SYSTEM RESET checkpoint_timeout;
ALTER SYSTEM RESET synchronous_commit;
SELECT pg_reload_conf();
"@ | psql -U $env:PG_SUPERUSER -d postgres -v ON_ERROR_STOP=1
Remove-Item Env:PGPASSWORD
```

## 10. 快速確認 Martin 可讀

1. 從 <https://github.com/maplibre/martin/releases> 下載 Windows 版，解壓到 `C:\Tools\martin`。
2. 以唯讀帳號啟動（connection string 由環境變數組出，不寫死）：

```powershell
$env:MARTIN_DB_URL = "postgresql://$($env:MARTIN_USER):$($env:MARTIN_PASSWORD)@$($env:PGHOST):$($env:PGPORT)/$($env:OSM_DB)"
C:\Tools\martin\martin.exe $env:MARTIN_DB_URL   # 以參數傳入；DATABASE_URL 環境變數在 1.16 已 deprecated
```

3. 瀏覽器確認：
   - `http://localhost:3000/catalog` → 應列出 `pois`、`roads`、`buildings` … 等 source
   - 此時為 auto-publish 模式，直接發佈原始表，僅供確認連線

> 正式設定（function source 做 zoom 分級、config.yaml）見 **[Martin-Setup.md](Martin-Setup.md)**。

---

## 重新匯入（資料更新）

1. 從 Geofabrik 下載新的 `taiwan-latest.osm.pbf` 覆蓋 `C:\gis\osm\taiwan.osm.pbf`。
2. 停止 Martin。
3. 重跑步驟 5 → 7 → 9（flex output 會自動 DROP 並重建表；`ALTER DEFAULT PRIVILEGES` 會讓新表自動授權給 `martin_reader`）。

## 疑難排解

| 症狀 | 原因 / 處理 |
|---|---|
| `ERROR: could not open extension control file ... postgis.control` | PostGIS 未安裝或裝到別的 PG 版本，回步驟 1 |
| `osm2pgsql: Unable to open file` | 路徑含中文，改用 `C:\gis\osm\` |
| `permission denied for schema public` | 未執行步驟 4 的 `GRANT CREATE ON SCHEMA public` |
| `Unknown output 'flex'` 或 Lua API 錯誤 | osm2pgsql 版本過舊，需 2.x |
| 匯入時記憶體不足 | 降低 `--cache` 與 `--number-processes` |
| Martin catalog 看不到表 | 確認 `martin_reader` 有 `SELECT`：`\dp roads`；必要時 `GRANT SELECT ON ALL TABLES IN SCHEMA public TO martin_reader;` |
