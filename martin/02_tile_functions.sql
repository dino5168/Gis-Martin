-- =============================================================================
-- 02_tile_functions.sql
-- Martin function sources：每個圖層一支 (z, x, y) -> bytea(MVT) function。
--
-- 執行者：osm_import
-- 座標系：
--   - 資料儲存 EPSG:4326
--   - 查詢 bbox：ST_TileEnvelope 產生 EPSG:3857，ST_Transform(..., 4326) 轉成儲存 SRID，
--     讓 `geom && bbox` 命中 (geom, minzoom) GiST index
--   - 輸出幾何：ST_Transform(geom, 3857)（EPSG:4326 → EPSG:3857）後交給 ST_AsMVTGeom
--
-- 共用參數：extent 4096、buffer 64（bbox margin = 64/4096 與之對應，避免跨圖磚線段斷裂）
-- MVT layer 名稱 = Martin source id，MapLibre 的 source-layer 直接用同名。
-- =============================================================================
\set ON_ERROR_STOP on

-- -----------------------------------------------------------------------------
-- land（海陸分色；資料來自 05_land.sql，與 OSM 匯入無關）
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tile_land(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE sql STABLE STRICT PARALLEL SAFE
AS $$
    WITH env AS (
        SELECT ST_TileEnvelope(z, x, y) AS tile,
               ST_Transform(ST_TileEnvelope(z, x, y, margin => 64.0 / 4096), 4326) AS bbox
    ), src AS (
        SELECT t.geom FROM public.land_z8 t, env
        WHERE z <= 8 AND t.geom && env.bbox
        UNION ALL
        SELECT t.geom FROM public.land_z11 t, env
        WHERE z BETWEEN 9 AND 11 AND t.geom && env.bbox
        UNION ALL
        SELECT t.geom FROM public.land t, env
        WHERE z >= 12 AND t.geom && env.bbox
    ), features AS (
        SELECT ST_AsMVTGeom(ST_Transform(s.geom, 3857), env.tile, 4096, 64, true) AS geom
        FROM src s, env
    )
    SELECT ST_AsMVT(features.*, 'land', 4096, 'geom')
    FROM features
    WHERE geom IS NOT NULL;
$$;
COMMENT ON FUNCTION public.tile_land(integer, integer, integer) IS $json$
{"description": "陸地面（OSM 海岸線，osmdata land-polygons），供海陸分色",
 "attribution": "© OpenStreetMap contributors",
 "vector_layers": [{"id": "land", "minzoom": 0, "maxzoom": 14, "fields": {}}]}
$json$;

-- -----------------------------------------------------------------------------
-- boundaries
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tile_boundaries(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE sql STABLE STRICT PARALLEL SAFE
AS $$
    WITH env AS (
        SELECT ST_TileEnvelope(z, x, y) AS tile,
               ST_Transform(ST_TileEnvelope(z, x, y, margin => 64.0 / 4096), 4326) AS bbox
    ), src AS (
        -- 依 zoom 選資料來源；`z <= 8` 等條件成為 one-time filter，未選中的分支不執行
        -- 縣市、鄉鎮市區、村里（admin_level 4/7/8/9）不出面外框，改出 boundary_lines（只含陸上共用邊界）
        SELECT t.relation_id, t.name, t.admin_level, t.geom
        FROM public.boundaries_z8 t, env
        WHERE z <= 8 AND t.geom && env.bbox AND t.minzoom <= z AND t.admin_level NOT IN (4, 7, 8, 9)
        UNION ALL
        SELECT t.relation_id, t.name, t.admin_level, t.geom
        FROM public.boundaries_z11 t, env
        WHERE z BETWEEN 9 AND 11 AND t.geom && env.bbox AND t.minzoom <= z AND t.admin_level NOT IN (4, 7, 8, 9)
        UNION ALL
        SELECT t.relation_id, t.name, t.admin_level, t.geom
        FROM public.boundaries t, env
        WHERE z >= 12 AND t.geom && env.bbox AND t.minzoom <= z AND t.admin_level NOT IN (4, 7, 8, 9)
        UNION ALL
        -- 低 zoom 即時簡化（容差同 *_z8 / *_z11 綜合表）
        SELECT t.relation_id, t.name, t.admin_level,
               CASE WHEN z <= 8  THEN ST_Simplify(t.geom, 0.0003)
                    WHEN z <= 11 THEN ST_Simplify(t.geom, 0.00004)
                    ELSE t.geom END
        FROM public.boundary_lines t, env
        WHERE t.geom && env.bbox AND t.minzoom <= z
    ), labels AS (
        -- 每個行政區一個標註點（Point）與外框（MultiPolygon）同層；前端以 geometry-type 區分。
        -- 只取圖磚本體範圍（不含 buffer），避免同一點同時出現在相鄰圖磚
        SELECT t.relation_id, t.name, t.admin_level, t.geom
        FROM public.boundary_labels t, env
        WHERE t.geom && ST_Transform(env.tile, 4326) AND t.minzoom <= z
    ), features AS (
        SELECT ST_AsMVTGeom(ST_Transform(s.geom, 3857), env.tile, 4096, 64, true) AS geom,
               s.relation_id AS osm_id, s.name, s.admin_level
        FROM (SELECT * FROM src UNION ALL SELECT * FROM labels) s, env
    )
    SELECT ST_AsMVT(features.*, 'boundaries', 4096, 'geom', 'osm_id')
    FROM features
    WHERE geom IS NOT NULL;
$$;
-- Martin 會把 function COMMENT 當作 TileJSON（必須是合法 JSON）合併進 /source 的回應
COMMENT ON FUNCTION public.tile_boundaries(integer, integer, integer) IS $json$
{"description": "行政界：國界、縣市 z0+；鄉鎮市區 (admin_level 7/8) z9+；村里 z12+；縣市、鄉鎮市區、村里皆為陸上共用邊界線（不含海上與沿海岸外框）；縣市與鄉鎮市區另含一個標註點 (Point)",
 "vector_layers": [{"id": "boundaries", "minzoom": 0, "maxzoom": 14,
   "fields": {"osm_id": "Number", "name": "String", "admin_level": "Number"}}]}
$json$;

-- -----------------------------------------------------------------------------
-- landuse
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tile_landuse(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE sql STABLE STRICT PARALLEL SAFE
AS $$
    WITH env AS (
        SELECT ST_TileEnvelope(z, x, y) AS tile,
               ST_Transform(ST_TileEnvelope(z, x, y, margin => 64.0 / 4096), 4326) AS bbox
    ), src AS (
        SELECT t.name, t.class, t.type, t.geom
        FROM public.landuse_z8 t, env
        WHERE z <= 8 AND t.geom && env.bbox AND t.minzoom <= z
        UNION ALL
        SELECT t.name, t.class, t.type, t.geom
        FROM public.landuse_z11 t, env
        WHERE z BETWEEN 9 AND 11 AND t.geom && env.bbox AND t.minzoom <= z
        UNION ALL
        SELECT t.name, t.class, t.type, t.geom
        FROM public.landuse t, env
        WHERE z >= 12 AND t.geom && env.bbox AND t.minzoom <= z
    ), features AS (
        SELECT ST_AsMVTGeom(ST_Transform(s.geom, 3857), env.tile, 4096, 64, true) AS geom,
               s.name, s.class, s.type
        FROM src s, env
    )
    SELECT ST_AsMVT(features.*, 'landuse', 4096, 'geom')
    FROM features
    WHERE geom IS NOT NULL;
$$;
COMMENT ON FUNCTION public.tile_landuse(integer, integer, integer) IS $json$
{"description": "土地使用 landuse/leisure/natural 面，依面積分級出圖 (z5–z13)",
 "vector_layers": [{"id": "landuse", "minzoom": 5, "maxzoom": 14,
   "fields": {"name": "String", "class": "String", "type": "String"}}]}
$json$;

-- -----------------------------------------------------------------------------
-- water
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tile_water(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE sql STABLE STRICT PARALLEL SAFE
AS $$
    WITH env AS (
        SELECT ST_TileEnvelope(z, x, y) AS tile,
               ST_Transform(ST_TileEnvelope(z, x, y, margin => 64.0 / 4096), 4326) AS bbox
    ), features AS (
        SELECT ST_AsMVTGeom(ST_Transform(t.geom, 3857), env.tile, 4096, 64, true) AS geom,
               t.name, t.class
        FROM public.water t, env
        WHERE t.geom && env.bbox
          AND t.minzoom <= z
    )
    SELECT ST_AsMVT(features.*, 'water', 4096, 'geom')
    FROM features
    WHERE geom IS NOT NULL;
$$;
COMMENT ON FUNCTION public.tile_water(integer, integer, integer) IS $json$
{"description": "水域面：湖泊、水庫、河道，依面積分級出圖 (z5–z13)",
 "vector_layers": [{"id": "water", "minzoom": 5, "maxzoom": 14,
   "fields": {"name": "String", "class": "String"}}]}
$json$;

-- -----------------------------------------------------------------------------
-- waterways
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tile_waterways(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE sql STABLE STRICT PARALLEL SAFE
AS $$
    WITH env AS (
        SELECT ST_TileEnvelope(z, x, y) AS tile,
               ST_Transform(ST_TileEnvelope(z, x, y, margin => 64.0 / 4096), 4326) AS bbox
    ), features AS (
        SELECT ST_AsMVTGeom(ST_Transform(t.geom, 3857), env.tile, 4096, 64, true) AS geom,
               t.name, t.class
        FROM public.waterways t, env
        -- 最小 minzoom 為 8（river）；低於此直接短路，避免全台 bbox 掃 index
        WHERE z >= 8
          AND t.geom && env.bbox
          AND t.minzoom <= z
    )
    SELECT ST_AsMVT(features.*, 'waterways', 4096, 'geom')
    FROM features
    WHERE geom IS NOT NULL;
$$;
COMMENT ON FUNCTION public.tile_waterways(integer, integer, integer) IS $json$
{"description": "水道線：river z8+、canal z10+、stream z13+、drain/ditch z14",
 "vector_layers": [{"id": "waterways", "minzoom": 8, "maxzoom": 14,
   "fields": {"name": "String", "class": "String"}}]}
$json$;

-- -----------------------------------------------------------------------------
-- roads
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tile_roads(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE sql STABLE STRICT PARALLEL SAFE
AS $$
    WITH env AS (
        SELECT ST_TileEnvelope(z, x, y) AS tile,
               ST_Transform(ST_TileEnvelope(z, x, y, margin => 64.0 / 4096), 4326) AS bbox
    ), src AS (
        -- z ≤ 11 用合併後的綜合表，不帶 oneway/layer/bridge/tunnel（NULL 屬性不寫入 MVT）
        SELECT t.name, t.class, t.kind, t.ref, t.minzoom,
               NULL::smallint AS oneway, NULL::integer AS layer,
               NULL::boolean AS bridge, NULL::boolean AS tunnel, t.geom
        FROM public.roads_z8 t, env
        WHERE z <= 8 AND t.geom && env.bbox AND t.minzoom <= z
        UNION ALL
        SELECT t.name, t.class, t.kind, t.ref, t.minzoom,
               NULL::smallint, NULL::integer, NULL::boolean, NULL::boolean, t.geom
        FROM public.roads_z11 t, env
        WHERE z BETWEEN 9 AND 11 AND t.geom && env.bbox AND t.minzoom <= z
        UNION ALL
        SELECT t.name, t.class, t.kind, t.ref, t.minzoom,
               t.oneway, t.layer, t.bridge, t.tunnel, t.geom
        FROM public.roads t, env
        WHERE z >= 12 AND t.geom && env.bbox AND t.minzoom <= z
    ), features AS (
        SELECT ST_AsMVTGeom(ST_Transform(s.geom, 3857), env.tile, 4096, 64, true) AS geom,
               s.name, s.class, s.kind, s.ref, s.oneway, s.layer, s.bridge, s.tunnel
        FROM src s, env
        -- MVT 內 feature 順序 = 繪製順序；高架/隧道依 layer 排序，避免 MapLibre 疊錯
        ORDER BY coalesce(s.layer, 0), s.minzoom DESC
    )
    SELECT ST_AsMVT(features.*, 'roads', 4096, 'geom')
    FROM features
    WHERE geom IS NOT NULL;
$$;
COMMENT ON FUNCTION public.tile_roads(integer, integer, integer) IS $json$
{"description": "道路與鐵路線，依等級分級出圖 (motorway/trunk z5 … footway z14)",
 "vector_layers": [{"id": "roads", "minzoom": 5, "maxzoom": 14,
   "fields": {"name": "String", "class": "String", "kind": "String", "ref": "String",
              "oneway": "Number", "layer": "Number", "bridge": "Boolean", "tunnel": "Boolean"}}]}
$json$;

-- -----------------------------------------------------------------------------
-- transit（捷運／輕軌／高鐵路線，依路線色）
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tile_transit(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE sql STABLE STRICT PARALLEL SAFE
AS $$
    WITH env AS (
        SELECT ST_TileEnvelope(z, x, y) AS tile,
               ST_Transform(ST_TileEnvelope(z, x, y, margin => 64.0 / 4096), 4326) AS bbox
    ), features AS (
        SELECT ST_AsMVTGeom(ST_Transform(t.geom, 3857), env.tile, 4096, 64, true) AS geom,
               t.kind, t.ref, t.network, t.name, t.colour
        FROM public.transit_lines t, env
        -- 最小 minzoom 為 7（高鐵）
        WHERE z >= 7
          AND t.geom && env.bbox
          AND t.minzoom <= z
        -- 高鐵先畫、捷運後畫：共線區段（如台北車站一帶）捷運色在上
        ORDER BY t.minzoom, t.kind
    )
    SELECT ST_AsMVT(features.*, 'transit', 4096, 'geom')
    FROM features
    WHERE geom IS NOT NULL;
$$;
COMMENT ON FUNCTION public.tile_transit(integer, integer, integer) IS $json$
{"description": "捷運／輕軌／高鐵路線線形，colour 為路線色（OSM route_master 優先；高鐵固定 #CA4F0F）。高鐵 z7+、捷運 z10+、輕軌 z11+",
 "vector_layers": [{"id": "transit", "minzoom": 7, "maxzoom": 14,
   "fields": {"kind": "String", "ref": "String", "network": "String", "name": "String", "colour": "String"}}]}
$json$;

-- -----------------------------------------------------------------------------
-- buildings（固定 z13+，不需 minzoom 欄位）
--   z13：只有 2D 外框（不含 building:part、不帶高度），控制圖磚大小
--   z14：加上分段與 LOD1 高度欄位；前端 3D 在 z15+ 使用（overzoom z14 圖磚）
--   false／0／NULL 一律輸出 NULL：MVT 不寫入 NULL 屬性，可省下每個要素的 key/value
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tile_buildings(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE sql STABLE STRICT PARALLEL SAFE
AS $$
    WITH env AS (
        SELECT ST_TileEnvelope(z, x, y) AS tile,
               ST_Transform(ST_TileEnvelope(z, x, y, margin => 64.0 / 4096), 4326) AS bbox
    ), features AS (
        SELECT ST_AsMVTGeom(ST_Transform(t.geom, 3857), env.tile, 4096, 64, true) AS geom,
               t.name, t.building, t.levels,
               -- 87% 建物是「預設 2 層」：不輸出高度與來源，前端缺值即視為 6.4 m／default（省約 40% 圖磚大小）
               CASE WHEN z >= 14 AND t.height_source <> 'default'
                    THEN round(t.render_height::numeric, 1)::real END AS render_height,
               CASE WHEN z >= 14 THEN nullif(round(t.render_min_height::numeric, 1), 0)::real END AS render_min_height,
               CASE WHEN z >= 14 THEN nullif(t.height_source, 'default') END AS height_source,
               nullif(t.is_part, false) AS is_part,
               CASE WHEN z >= 14 THEN nullif(t.has_parts, false) END AS has_parts
        FROM public.buildings t, env
        -- z < 13 時直接短路，不碰 index（台灣建物數百萬筆，低 zoom 無意義）
        WHERE z >= 13
          AND t.geom && env.bbox
          AND (z >= 14 OR NOT t.is_part)
        -- 先畫低的再畫高的：2D 疊圖時高樓外框在上
        ORDER BY t.render_height
    )
    SELECT ST_AsMVT(features.*, 'buildings', 4096, 'geom')
    FROM features
    WHERE geom IS NOT NULL;
$$;
COMMENT ON FUNCTION public.tile_buildings(integer, integer, integer) IS $json$
{"description": "建物面 z13+；z14 起含 building:part 分段與 LOD1 高度（render_height／render_min_height 公尺，height_source = height|levels；兩者缺值代表預設 2 層 6.4 m），供 fill-extrusion",
 "vector_layers": [{"id": "buildings", "minzoom": 13, "maxzoom": 14,
   "fields": {"name": "String", "building": "String", "levels": "Number",
              "render_height": "Number", "render_min_height": "Number", "height_source": "String",
              "is_part": "Boolean", "has_parts": "Boolean"}}]}
$json$;

-- -----------------------------------------------------------------------------
-- pois
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tile_pois(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE sql STABLE STRICT PARALLEL SAFE
AS $$
    WITH env AS (
        SELECT ST_TileEnvelope(z, x, y) AS tile,
               ST_Transform(ST_TileEnvelope(z, x, y, margin => 64.0 / 4096), 4326) AS bbox
    ), features AS (
        SELECT ST_AsMVTGeom(ST_Transform(t.geom, 3857), env.tile, 4096, 64, true) AS geom,
               t.node_id AS osm_id, t.name, t.class, t.subclass, t.minzoom
        FROM public.pois t, env
        -- 最小 minzoom 為 11（火車站）；低於此直接短路
        WHERE z >= 11
          AND t.geom && env.bbox
          -- z14 是最大 zoom、會被 overzoom 到 z15+：帶入 minzoom 15/16，由前端依 zoom 篩選
          AND t.minzoom <= CASE WHEN z >= 14 THEN 16 ELSE z END
        -- 重要 POI（minzoom 小）排前面，MapLibre symbol collision 時優先保留
        ORDER BY t.minzoom, t.name NULLS LAST
    )
    SELECT ST_AsMVT(features.*, 'pois', 4096, 'geom', 'osm_id')
    FROM features
    WHERE geom IS NOT NULL;
$$;
COMMENT ON FUNCTION public.tile_pois(integer, integer, integer) IS $json$
{"description": "興趣點：火車站 z11、捷運站 z12、醫院/大學/景點 z13、公共設施 z14、日常去處 z15、其餘 z16。minzoom 屬性供前端依 zoom 篩選（z14 圖磚含 minzoom ≤ 16）",
 "vector_layers": [{"id": "pois", "minzoom": 11, "maxzoom": 14,
   "fields": {"osm_id": "Number", "name": "String", "class": "String", "subclass": "String", "minzoom": "Number"}}]}
$json$;
