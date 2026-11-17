# 正式機部署：PostgreSQL + PostGIS + Martin（圖磚服務）

> 適用：把開發機已建好的 `osm_taiwan` 圖磚資料庫與 Martin 服務搬到正式機（Windows）。
> 前端網站部署另見 [Progress.md](../Progress.md) 待辦 1（反向代理、HTTPS）。
> 本文件的匯出／還原流程已於 2026-11-17 在開發機以測試資料庫實際演練：匯出 28 秒（314 MB）、還原 29 秒、`03_verify` 全數通過、`martin_reader` 可直接出圖。

---

## 0. 部署策略

```
開發機（建資料）                                   正式機（只負責出圖）
OSM PBF ─osm2pgsql─▶ PostGIS ─01/05/02─▶ osm_taiwan
                                            │ pg_dump -Fc（314 MB）
                                            ▼
                                     osm_taiwan.dump ──複製──▶ pg_restore ─▶ PostGIS ─▶ Martin（WinSW 服務）
```

- **正式機不跑匯入**：osm2pgsql、`taiwan.lua`、PBF、全球 land-polygons（930 MB zip）都只留在開發機。正式機只需要 PostgreSQL + PostGIS + Martin。
- 資料以 `pg_dump` 自訂格式搬移，**不含** extension、擁有者、權限（`--exclude-extension --no-owner --no-acl`）；正式機先建好角色與 `ALTER DEFAULT PRIVILEGES`，還原時由 `osm_import` 建立所有物件，`martin_reader` 自動取得 `SELECT`。
- 資料更新也走同一條路：開發機重建 → 匯出 → 正式機以單一交易還原（見 §9）。

### 正式機需求

| 項目 | 需求 |
|---|---|
| OS | Windows Server 2019+／Windows 10+（x64） |
| PostgreSQL | **17.x**（服務名 `postgresql-x64-17`；Martin 服務相依此名稱） |
| PostGIS | **3.6.x**（≥ 開發機 3.6.2；版本不能比開發機舊） |
| 磁碟 | DB 約 0.9 GB + dump 0.3 GB + 更新時暫存一份，建議預留 5 GB |
| RAM | 8 GB 可運作，16 GB 建議（§6 調校以 16 GB 為例） |
| 網路 | 安裝期間需下載 PostgreSQL／PostGIS 安裝檔；其餘檔案由開發機帶過去 |

---

## 1. 開發機：打包部署檔

```powershell
# 載入 .env（開發機）
Get-Content C:\gis\osm\.env -Encoding UTF8 | Where-Object { $_ -match '^\s*[^#].*=' } | ForEach-Object { $k, $v = $_ -split '=', 2; Set-Item -Path "Env:$($k.Trim())" -Value $v.Trim() }

$bundle = 'C:\gis\osm\deploy'
New-Item -ItemType Directory -Force "$bundle\martin\service", "$bundle\bin" | Out-Null

# 1) 資料庫（約 30 秒、314 MB）
#    不要加 -n public：會多出 CREATE SCHEMA public，還原時與既有 schema 衝突
$env:PGPASSWORD = $env:OSM_IMPORT_PASSWORD
pg_dump -U $env:OSM_IMPORT_USER -d $env:OSM_DB -Fc -Z 6 `
    --exclude-extension=postgis --exclude-extension=btree_gist `
    --no-owner --no-acl -f "$bundle\osm_taiwan.dump"
Remove-Item Env:PGPASSWORD

# 2) Martin 設定、驗證 SQL、服務腳本（取自原始碼目錄，唯一真實來源）
$src = 'D:\1-研發\3-Gis-Martin\martin'
Copy-Item "$src\config.yaml", "$src\03_verify.sql", "$src\04_benchmark.sql" "$bundle\martin\" -Force
Copy-Item "$src\service\*.ps1" "$bundle\martin\service\" -Force
Copy-Item C:\gis\osm\martin\service\WinSW.NET461.exe "$bundle\martin\service\" -Force

# 3) 執行檔（Martin 1.16.1）
Copy-Item C:\Tools\martin\martin.exe "$bundle\bin\" -Force

# 4) 校驗碼（正式機比對，確認傳輸完整）
#    先算完再寫檔：直接管線到 Out-File 會把正在寫入的 SHA256SUMS.txt 也列入而報錯
Remove-Item "$bundle\SHA256SUMS.txt" -ErrorAction SilentlyContinue
$sums = Get-ChildItem $bundle -Recurse -File | Get-FileHash -Algorithm SHA256 |
    ForEach-Object { '{0}  {1}' -f $_.Hash, $_.Path.Substring($bundle.Length + 1) }
$sums | Out-File "$bundle\SHA256SUMS.txt" -Encoding utf8
```

> `.env` **不要**放進部署包：正式機要用新的密碼（§3）。

部署包內容：

```
C:\gis\osm\deploy\
├─ osm_taiwan.dump
├─ SHA256SUMS.txt
├─ bin\martin.exe
└─ martin\
   ├─ config.yaml、03_verify.sql、04_benchmark.sql
   └─ service\install-martin-service.ps1、uninstall-martin-service.ps1、WinSW.NET461.exe
```

把整個 `deploy` 資料夾複製到正式機的 **`C:\gis\osm\deploy\`**（路徑保持純 ASCII）。

---

## 2. 正式機：安裝 PostgreSQL 17 + PostGIS

1. 安裝 PostgreSQL 17（EDB Windows installer），記下 `postgres` 超級使用者密碼；服務名稱維持預設 `postgresql-x64-17`。
2. Stack Builder → `Spatial Extensions` → PostGIS 3.6 Bundle for PostgreSQL 17（或 <https://download.osgeo.org/postgis/windows/pg17/>）。
3. 部署檔就位、加入 PATH：

```powershell
# 管理員 PowerShell
New-Item -ItemType Directory -Force C:\Tools\martin, C:\gis\osm\martin\service | Out-Null
Copy-Item C:\gis\osm\deploy\bin\martin.exe C:\Tools\martin\ -Force
Copy-Item C:\gis\osm\deploy\martin\* C:\gis\osm\martin\ -Recurse -Force

$add = 'C:\Program Files\PostgreSQL\17\bin;C:\Tools\martin'
[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'Machine') + ";$add", 'Machine')
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')

# 驗證
psql --version                         # 17.x
martin --version                       # martin 1.16.1
Test-Path 'C:\Program Files\PostgreSQL\17\share\extension\postgis.control'   # True

# 比對校驗碼（輸出應為空）
Get-Content C:\gis\osm\deploy\SHA256SUMS.txt -Encoding UTF8 | ForEach-Object {
    $h, $p = $_ -split '  ', 2
    if ((Get-FileHash "C:\gis\osm\deploy\$p" -Algorithm SHA256).Hash -ne $h) { "MISMATCH $p" }
}
```

---

## 3. 正式機：建立 `.env`（新密碼）

```powershell
# 產生 32 字元英數密碼（不含特殊字元，避免連線字串跳脫問題）
function New-Password {
    <#
    .SYNOPSIS
        Generates a cryptographically random alphanumeric password.
    .PARAMETER Length
        Number of characters.
    #>
    param([int]$Length = 32)
    $chars = [char[]]'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
    $bytes = New-Object byte[] $Length
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

$envText = @"
PGHOST=localhost
PGPORT=5432
PG_SUPERUSER=postgres
PG_SUPERUSER_PASSWORD=__FILL_IN__
OSM_DB=osm_taiwan
OSM_IMPORT_USER=osm_import
OSM_IMPORT_PASSWORD=$(New-Password)
MARTIN_USER=martin_reader
MARTIN_PASSWORD=$(New-Password)
"@
[IO.File]::WriteAllText('C:\gis\osm\.env', $envText, (New-Object Text.UTF8Encoding $false))

# ACL：只留目前使用者、SYSTEM、Administrators
icacls C:\gis\osm\.env /inheritance:r /grant:r "${env:USERNAME}:(F)" '*S-1-5-18:(F)' '*S-1-5-32-544:(F)'
notepad C:\gis\osm\.env     # 把 PG_SUPERUSER_PASSWORD 改成安裝時設定的 postgres 密碼
```

之後每個 PowerShell 視窗先載入：

```powershell
Get-Content C:\gis\osm\.env -Encoding UTF8 | Where-Object { $_ -match '^\s*[^#].*=' } | ForEach-Object { $k, $v = $_ -split '=', 2; Set-Item -Path "Env:$($k.Trim())" -Value $v.Trim() }
```

---

## 4. 正式機：建立資料庫、角色、extension、預設權限

```powershell
$env:PGPASSWORD = $env:PG_SUPERUSER_PASSWORD

# psql 變數插值只在 stdin / -f 生效（-c 不展開 :'var'）；密碼不出現在命令列
@"
CREATE ROLE $($env:OSM_IMPORT_USER) LOGIN PASSWORD :'import_pw';
CREATE ROLE $($env:MARTIN_USER)     LOGIN PASSWORD :'martin_pw';
CREATE DATABASE $($env:OSM_DB) OWNER $($env:OSM_IMPORT_USER) ENCODING 'UTF8' TEMPLATE template0;
"@ | psql -U $env:PG_SUPERUSER -d postgres -v ON_ERROR_STOP=1 `
         -v import_pw="$env:OSM_IMPORT_PASSWORD" -v martin_pw="$env:MARTIN_PASSWORD"

@"
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;   -- (geom, minzoom) 複合 GiST index
GRANT CONNECT ON DATABASE $($env:OSM_DB) TO $($env:MARTIN_USER);
GRANT USAGE ON SCHEMA public TO $($env:MARTIN_USER);
-- 還原時由 osm_import 建立的表自動授權 SELECT 給 martin_reader（dump 不含權限）
ALTER DEFAULT PRIVILEGES FOR ROLE $($env:OSM_IMPORT_USER) IN SCHEMA public
    GRANT SELECT ON TABLES TO $($env:MARTIN_USER);
GRANT CREATE ON SCHEMA public TO $($env:OSM_IMPORT_USER);
SELECT postgis_full_version();
"@ | psql -U $env:PG_SUPERUSER -d $env:OSM_DB -v ON_ERROR_STOP=1

Remove-Item Env:PGPASSWORD
```

> tile function 的 `EXECUTE` 預設授權給 PUBLIC，不需另外 GRANT。

---

## 5. 正式機：還原資料（約 30 秒）

```powershell
$env:PGPASSWORD = $env:OSM_IMPORT_PASSWORD
$env:PGCLIENTENCODING = 'UTF8'

# --single-transaction + --exit-on-error：失敗即整批回滾，不留半套資料
pg_restore -U $env:OSM_IMPORT_USER -d $env:OSM_DB --no-owner --no-acl `
    --single-transaction --exit-on-error C:\gis\osm\deploy\osm_taiwan.dump
if ($LASTEXITCODE -ne 0) { throw 'pg_restore failed' }

# pg_restore 不帶統計資訊，必須 ANALYZE，否則 planner 可能不走 (geom, minzoom) index
psql -U $env:OSM_IMPORT_USER -d $env:OSM_DB -c "ANALYZE;"

# DB 端驗證：應出現 NOTICE: ALL TILE FUNCTION CHECKS PASSED
psql -U $env:OSM_IMPORT_USER -d $env:OSM_DB -f C:\gis\osm\martin\03_verify.sql

# 唯讀帳號能出圖（台北 101 z14 道路，應 > 0）
$env:PGPASSWORD = $env:MARTIN_PASSWORD
psql -U $env:MARTIN_USER -d $env:OSM_DB -At -c "SELECT length(tile_roads(14, 13724, 7014));"
Remove-Item Env:PGPASSWORD
```

---

## 6. 正式機：PostgreSQL 設定（唯讀出圖用）

圖磚服務是唯讀、查詢以 GiST index 為主。以 16 GB RAM、SSD 為例：

```powershell
$env:PGPASSWORD = $env:PG_SUPERUSER_PASSWORD
@"
ALTER SYSTEM SET shared_buffers = '4GB';           -- RAM 25%；需重啟
ALTER SYSTEM SET effective_cache_size = '10GB';    -- RAM 60–75%
ALTER SYSTEM SET work_mem = '32MB';                -- Martin pool 20 連線 × 多個節點
ALTER SYSTEM SET random_page_cost = 1.1;           -- SSD
ALTER SYSTEM SET listen_addresses = 'localhost';   -- Martin 與 DB 同機：DB 不對外；需重啟
"@ | psql -U $env:PG_SUPERUSER -d postgres -v ON_ERROR_STOP=1
Remove-Item Env:PGPASSWORD

Restart-Service postgresql-x64-17   # 管理員
```

- `max_connections` 預設 100，足夠 Martin `pool_size: 20` 加維運連線。
- `pg_hba.conf`（`C:\Program Files\PostgreSQL\17\data\pg_hba.conf`）維持安裝預設：只有 `127.0.0.1/32`、`::1/128`，`scram-sha-256`。
- 若 DB 與 Martin **不同機**：`listen_addresses` 改為 DB 主機 IP，`pg_hba.conf` 只加 Martin 主機 IP 的 `hostssl … scram-sha-256` 一行，並開防火牆 5432 只限該 IP；`.env` 的 `PGHOST` 改為 DB 主機。

---

## 7. 正式機：Martin 設定與 Windows 服務

### 7.1 調整 `C:\gis\osm\martin\config.yaml`

部署包內是開發機設定，正式機依前端放置方式擇一修改：

| 情境 | `listen_addresses` | `cors.origin` |
|---|---|---|
| **（建議）前端網站與反向代理在同一台**，以同源路徑 `/tiles/*` 代理到 Martin | 維持 `'127.0.0.1:3000'` | 同源不需要 CORS，可整段刪除 |
| 前端在別台主機，直接連 Martin | `'0.0.0.0:3000'` | 改成正式網站 origin，例如 `https://map.example.com`；移除 `localhost` 項目 |

其他設定（`cache`、`auto_publish: false`、9 個 function source 與 bounds）維持不變。連線字串由服務以 `${MARTIN_DB_URL}` 注入，不寫在檔案中。

> `worker_processes: 8` 依正式機 CPU 核心數調整（約等於核心數）。

### 7.2 安裝服務

```powershell
Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass',
    '-File','C:\gis\osm\martin\service\install-martin-service.ps1',
    '-WinSWPath','C:\gis\osm\martin\service\WinSW.NET461.exe'
Get-Content C:\ProgramData\MartinTiles\install.log | Select-String 'RESULT|FAILED'
# 預期：RESULT service=MartinTiles state=Running startmode=Auto account=NT AUTHORITY\LocalService healthy=True
```

腳本行為（idempotent，可重跑）：

- 從 `.env` 讀 `MARTIN_USER`／`MARTIN_PASSWORD` 組成連線字串，寫入 `C:\Program Files\MartinTiles\MartinTiles.xml`（ACL 只給 SYSTEM、Administrators、LocalService 唯讀）。
- `martin.exe`（取自 `C:\Tools\martin\`）與 WinSW 複製到 `C:\Program Files\MartinTiles\`，以 `LocalService` 執行、自動啟動、相依 `postgresql-x64-17`、失敗自動重啟。
- 日誌：`C:\ProgramData\MartinTiles\logs\`（10 MB 輪替保留 8 份）。

### 7.3 移除部署期間不再需要的密碼

服務只需要 XML 內的 `martin_reader` 連線字串。正式機 `.env` 保留 `OSM_IMPORT_PASSWORD`（資料更新需要），**`PG_SUPERUSER_PASSWORD` 建議改由密碼管理器保存並從 `.env` 刪除**，需要時再臨時填入。

---

## 8. 正式機：驗證

```powershell
Get-Service postgresql-x64-17, MartinTiles          # 皆 Running

Invoke-WebRequest http://127.0.0.1:3000/health -UseBasicParsing | Select-Object StatusCode    # 200

# 9 個 source
(Invoke-RestMethod http://127.0.0.1:3000/catalog).tiles.PSObject.Properties.Name

# 合併 TileJSON（前端使用；任一 source 缺失會整串 404）
Invoke-RestMethod http://127.0.0.1:3000/land,boundaries,landuse,water,waterways,roads,transit,buildings,pois |
    Select-Object tilejson, minzoom, maxzoom, bounds

# 實際圖磚：台北 101 z14
$r = Invoke-WebRequest http://127.0.0.1:3000/land,boundaries,landuse,water,waterways,roads,transit,buildings,pois/14/13724/7014 -UseBasicParsing
"$($r.StatusCode) $($r.RawContentLength) bytes"     # 200，約 450 KB（未壓縮）

# 圖磚大小／時間基準（與開發機比對，見 Progress.md 關鍵數據）
$env:PGPASSWORD = $env:OSM_IMPORT_PASSWORD; $env:PGCLIENTENCODING = 'UTF8'
psql -U $env:OSM_IMPORT_USER -d $env:OSM_DB -f C:\gis\osm\martin\04_benchmark.sql
Remove-Item Env:PGPASSWORD
```

若 Martin 綁 `0.0.0.0`，另開防火牆並限制來源：

```powershell
New-NetFirewallRule -DisplayName 'MartinTiles 3000' -Direction Inbound -Protocol TCP -LocalPort 3000 `
    -RemoteAddress <前端或反向代理 IP> -Action Allow
```

---

## 9. 資料更新（之後每次換新 OSM 資料）

1. **開發機**：照原流程重建（osm2pgsql 重匯 → `01_post_import.sql` → `02_tile_functions.sql` → `03_verify.sql`），再執行 §1 步驟 1 產生新的 `osm_taiwan.dump`，複製到正式機 `C:\gis\osm\deploy\`。
2. **正式機**（停機約 1 分鐘）：

```powershell
# 先備份目前正式資料（回滾用）
$env:PGPASSWORD = $env:OSM_IMPORT_PASSWORD; $env:PGCLIENTENCODING = 'UTF8'
pg_dump -U $env:OSM_IMPORT_USER -d $env:OSM_DB -Fc -Z 6 --exclude-extension=postgis --exclude-extension=btree_gist `
    --no-owner --no-acl -f "C:\gis\osm\deploy\osm_taiwan.backup-$(Get-Date -Format yyyyMMdd).dump"

Stop-Service MartinTiles     # 管理員；釋放連線並清除 tile cache

# --clean --if-exists：先 DROP 舊物件再建立；單一交易，失敗則保持原狀
pg_restore -U $env:OSM_IMPORT_USER -d $env:OSM_DB --no-owner --no-acl --clean --if-exists `
    --single-transaction --exit-on-error C:\gis\osm\deploy\osm_taiwan.dump
if ($LASTEXITCODE -ne 0) { throw 'pg_restore failed; database unchanged' }
psql -U $env:OSM_IMPORT_USER -d $env:OSM_DB -c "ANALYZE;"
psql -U $env:OSM_IMPORT_USER -d $env:OSM_DB -f C:\gis\osm\martin\03_verify.sql
Remove-Item Env:PGPASSWORD

Start-Service MartinTiles
```

- **新增或改名 Martin source 時**：同時更新正式機 `config.yaml`，否則合併 URL 整串 404。
- **只改 tile function（`02`）時**：可只帶 `02_tile_functions.sql` 到正式機以 `osm_import` 執行，再 `Restart-Service MartinTiles`，不必整庫還原。
- 回滾：以備份檔重複上面的 `pg_restore --clean` 指令。

---

## 10. 升級與維運

| 情境 | 動作 |
|---|---|
| 改 `.env` 的 `MARTIN_PASSWORD` | `ALTER ROLE martin_reader PASSWORD …`（以 §4 的 `:'var'` 方式）→ 重跑 §7.2 安裝腳本 |
| 升級 Martin | 新 `martin.exe` 放到 `C:\Tools\martin\` → 重跑 §7.2（服務使用 `C:\Program Files\MartinTiles\` 的副本） |
| 改 `config.yaml` | `Restart-Service MartinTiles` |
| 查看日誌 | `Get-Content C:\ProgramData\MartinTiles\logs\MartinTiles.out.log -Tail 30` |
| 移除服務 | 管理員執行 `C:\gis\osm\martin\service\uninstall-martin-service.ps1`（`-RemoveLogs` 一併刪日誌） |

---

## 疑難排解

| 症狀 | 原因／處理 |
|---|---|
| `pg_restore: schema "public" already exists` | dump 時加了 `-n public`；依 §1 重新匯出（不加 `-n`） |
| `type "geometry" does not exist` | 還原前未執行 §4 的 `CREATE EXTENSION postgis` |
| `03_verify` 報 `gbtreekey…` 或建 index 失敗 | 缺 `btree_gist`（§4） |
| Martin tile 回 500、日誌 `permission denied for table` | §4 的 `ALTER DEFAULT PRIVILEGES` 未在還原前執行；補救：`GRANT SELECT ON ALL TABLES IN SCHEMA public TO martin_reader;`（以 `osm_import` 執行） |
| 低 zoom 圖磚很慢 | 還原後未 `ANALYZE`（§5） |
| 服務啟動失敗、`healthy=False` | 看 `C:\ProgramData\MartinTiles\logs\MartinTiles.out.log`；常見為 `.env` 密碼與 DB 角色不一致，或 PostgreSQL 服務名稱不是 `postgresql-x64-17` |
| 前端 CORS 錯誤 | §7.1 `cors.origin` 未加入正式網站 origin，改後 `Restart-Service MartinTiles` |
| 合併 URL 404、地圖全空白 | `config.yaml` 缺少前端合併 URL 中的某個 source，或新增 source 後沒重啟服務 |
| `.ps1` 中文亂碼／語法錯誤 | PS 5.1 以 cp950 讀無 BOM 檔；服務腳本保持純 ASCII |
