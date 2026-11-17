-- =============================================================================
-- 01_post_import.sql
-- 匯入後處理：為各表加上 minzoom（generated column）與 (geom, minzoom) 複合 GiST index。
--
-- 執行者：osm_import（tables owner）
-- 時機  ：每次 osm2pgsql 匯入完成後（flex output 會 DROP/重建表，需重跑）
-- 前置  ：資料庫已有 btree_gist extension（見 Martin-Setup.md 步驟 1）
--
-- minzoom = NULL 代表「不出圖」，tile function 以 `minzoom <= z` 篩選，NULL 自然被排除。
-- 調整出圖規則只要改這支檔案再重跑，不需重新匯入 PBF。
-- =============================================================================
\set ON_ERROR_STOP on

BEGIN;

-- -----------------------------------------------------------------------------
-- roads
-- -----------------------------------------------------------------------------
ALTER TABLE public.roads DROP COLUMN IF EXISTS minzoom;
ALTER TABLE public.roads ADD COLUMN minzoom smallint GENERATED ALWAYS AS (
    CASE
        WHEN kind = 'highway' THEN CASE
            WHEN class IN ('motorway', 'trunk')                                  THEN 5
            WHEN class = 'primary'                                               THEN 8
            WHEN class IN ('secondary', 'motorway_link', 'trunk_link')           THEN 10
            -- tertiary 在 z10 佔 roads 圖磚約 1/3 feature，延後到 z11
            WHEN class IN ('tertiary', 'primary_link')                           THEN 11
            WHEN class IN ('secondary_link', 'tertiary_link', 'residential', 'unclassified') THEN 12
            WHEN class IN ('living_street', 'service', 'pedestrian', 'track')    THEN 13
            WHEN class IN ('footway', 'path', 'cycleway', 'steps', 'bridleway')  THEN 14
            -- construction / proposed / platform / raceway ... 不出圖
        END
        WHEN kind = 'railway' THEN CASE
            WHEN class = 'rail'                                     THEN 8
            WHEN class IN ('subway', 'light_rail', 'narrow_gauge')  THEN 10
            WHEN class = 'monorail'                                 THEN 11
            WHEN class IN ('tram', 'funicular')                     THEN 12
            -- abandoned / disused / razed / platform ... 不出圖
        END
    END
) STORED;
CREATE INDEX roads_geom_minzoom_idx ON public.roads USING gist (geom, minzoom);

-- -----------------------------------------------------------------------------
-- waterways
-- -----------------------------------------------------------------------------
ALTER TABLE public.waterways DROP COLUMN IF EXISTS minzoom;
ALTER TABLE public.waterways ADD COLUMN minzoom smallint GENERATED ALWAYS AS (
    CASE
        WHEN class = 'river'           THEN 8
        WHEN class = 'canal'           THEN 10
        WHEN class = 'stream'          THEN 13
        WHEN class IN ('drain', 'ditch') THEN 14
    END
) STORED;
CREATE INDEX waterways_geom_minzoom_idx ON public.waterways USING gist (geom, minzoom);

-- -----------------------------------------------------------------------------
-- landuse / water：依真實面積（geography, m²）決定，面積越大越早出現
-- -----------------------------------------------------------------------------
ALTER TABLE public.landuse DROP COLUMN IF EXISTS minzoom;
ALTER TABLE public.landuse ADD COLUMN minzoom smallint GENERATED ALWAYS AS (
    CASE
        WHEN ST_Area(geom::geography) >= 1e8 THEN 5    -- ≥ 100 km²
        WHEN ST_Area(geom::geography) >= 1e7 THEN 7    -- ≥ 10 km²
        WHEN ST_Area(geom::geography) >= 1e6 THEN 9    -- ≥ 1 km²
        WHEN ST_Area(geom::geography) >= 1e5 THEN 11   -- ≥ 0.1 km²
        ELSE 13
    END
) STORED;
CREATE INDEX landuse_geom_minzoom_idx ON public.landuse USING gist (geom, minzoom);

ALTER TABLE public.water DROP COLUMN IF EXISTS minzoom;
ALTER TABLE public.water ADD COLUMN minzoom smallint GENERATED ALWAYS AS (
    CASE
        WHEN ST_Area(geom::geography) >= 1e8 THEN 5
        WHEN ST_Area(geom::geography) >= 1e7 THEN 7
        WHEN ST_Area(geom::geography) >= 1e6 THEN 9
        WHEN ST_Area(geom::geography) >= 1e5 THEN 11
        ELSE 13
    END
) STORED;
CREATE INDEX water_geom_minzoom_idx ON public.water USING gist (geom, minzoom);

-- -----------------------------------------------------------------------------
-- boundaries：2 國界 / 4 直轄市・縣市 / 7、8 鄉鎮市區 / 9 村里
-- 台灣 OSM 的鄉鎮市區分散在 level 7（170）與 8（199），合計 ≈ 368 個鄉鎮市區
-- -----------------------------------------------------------------------------
ALTER TABLE public.boundaries DROP COLUMN IF EXISTS minzoom;
ALTER TABLE public.boundaries ADD COLUMN minzoom smallint GENERATED ALWAYS AS (
    CASE admin_level
        WHEN 2 THEN 0
        WHEN 4 THEN 0
        WHEN 7 THEN 9
        WHEN 8 THEN 9
        WHEN 9 THEN 12
    END
) STORED;
CREATE INDEX boundaries_geom_minzoom_idx ON public.boundaries USING gist (geom, minzoom);

-- -----------------------------------------------------------------------------
-- pois：依重要性分級。z14 是 Martin 最大 zoom，z15+ 由 MapLibre overzoom z14 圖磚，
-- 所以 minzoom 15/16 的 POI 也放進 z14 圖磚，再由前端依 `minzoom <= zoom` 篩選疏密。
--   11 火車站｜12 捷運站｜13 醫院、大學、主要景點｜14 公共設施、旅館、大型商場
--   15 日常去處（餐飲、銀行、便利商店、藥局、宮廟…）｜16 公車站牌、其餘有名稱的 POI
--   NULL 不出圖：鐵路設施節點、街道設施（停車場出入口、飲水機、垃圾桶…）、空店面、無名稱的次要 POI
-- -----------------------------------------------------------------------------
ALTER TABLE public.pois DROP COLUMN IF EXISTS minzoom;
ALTER TABLE public.pois ADD COLUMN minzoom smallint GENERATED ALWAYS AS (
    CASE
        WHEN class = 'railway' AND subclass = 'station'                     THEN 11
        WHEN class = 'railway' AND subclass IN ('halt', 'tram_stop')        THEN 13
        WHEN class = 'railway'                                              THEN NULL
        WHEN class = 'public_transport' AND subclass = 'station'            THEN 12
        -- 公車站牌：台灣 OSM 以 public_transport=platform + highway=bus_stop（或 bus=yes）標註，約 4.9 萬筆
        WHEN class = 'public_transport' AND subclass = 'platform'
             AND (tags->>'highway' = 'bus_stop' OR tags->>'bus' = 'yes')    THEN 16
        WHEN class = 'public_transport'                                     THEN NULL  -- stop_position 等與站牌重複
        WHEN class = 'amenity' AND subclass IN ('hospital', 'university', 'college') THEN 13
        WHEN class = 'tourism' AND subclass IN ('attraction', 'museum', 'zoo', 'theme_park', 'viewpoint') THEN 13

        -- 街道設施：點數多、資訊量低，畫成 POI 只會讓地圖變雜
        WHEN class = 'amenity' AND subclass IN (
            'parking_entrance', 'parking_space', 'drinking_water', 'water_point', 'bench',
            'waste_basket', 'waste_disposal', 'recycling', 'vending_machine', 'telephone',
            'post_box', 'parcel_locker', 'atm', 'bicycle_parking', 'motorcycle_parking',
            'shelter', 'clock', 'grit_bin', 'hunting_stand', 'smoking_area', 'loading_dock') THEN NULL
        WHEN class = 'shop' AND subclass IN ('vacant', 'no', 'disused')    THEN NULL

        WHEN class = 'amenity' AND subclass IN (
            'school', 'townhall', 'police', 'fire_station', 'library', 'post_office',
            'bus_station', 'courthouse', 'ferry_terminal', 'community_centre', 'arts_centre') THEN 14
        WHEN class = 'tourism' AND subclass IN ('hotel', 'information', 'gallery')  THEN 14
        WHEN class = 'shop' AND subclass IN ('mall', 'department_store', 'supermarket') THEN 14
        WHEN class = 'leisure' AND subclass IN ('stadium', 'sports_centre')         THEN 14

        WHEN class = 'amenity' AND subclass IN (
            'restaurant', 'cafe', 'fast_food', 'food_court', 'bar', 'pub', 'bank', 'pharmacy',
            'clinic', 'doctors', 'dentist', 'place_of_worship', 'fuel', 'cinema', 'theatre',
            'marketplace', 'kindergarten', 'charging_station')  THEN 15
        WHEN class = 'shop' AND subclass = 'convenience'          THEN 15
        WHEN class = 'tourism' AND subclass IN ('hostel', 'guest_house', 'motel') THEN 15

        -- 其餘：有名稱才出圖（無名的雜項 POI 在地圖上無從辨識）
        WHEN name IS NOT NULL                                     THEN 16
    END
) STORED;
CREATE INDEX pois_geom_minzoom_idx ON public.pois USING gist (geom, minzoom);

-- -----------------------------------------------------------------------------
-- buildings：LOD1 3D 高度（公尺）
--   render_height 優先序：height 標籤 → building:levels × 3.2 m → 預設 2 層（6.4 m）
--   render_min_height：min_height → building:min_level × 3.2 m → 0（懸空結構如天橋、雨遮）
--   height_source 讓前端標示「實測標註／樓層推估／預設」，避免估計值被當成實測
-- generated column 不能互相參照，所以 levels 的合理範圍判斷在各式中重複
-- -----------------------------------------------------------------------------
ALTER TABLE public.buildings DROP COLUMN IF EXISTS render_height;
ALTER TABLE public.buildings DROP COLUMN IF EXISTS render_min_height;
ALTER TABLE public.buildings DROP COLUMN IF EXISTS height_source;
ALTER TABLE public.buildings DROP COLUMN IF EXISTS has_parts;

ALTER TABLE public.buildings ADD COLUMN render_min_height real GENERATED ALWAYS AS (
    coalesce(min_height, CASE WHEN min_level BETWEEN 0 AND 200 THEN min_level * 3.2 END, 0)
) STORED;
ALTER TABLE public.buildings ADD COLUMN render_height real GENERATED ALWAYS AS (
    -- 頂部至少比底部高 1 m，避免 min_height ≥ height 的錯誤標註產生負高度柱體
    greatest(
        coalesce(height, CASE WHEN levels BETWEEN 1 AND 200 THEN levels * 3.2 END, 6.4),
        coalesce(min_height, CASE WHEN min_level BETWEEN 0 AND 200 THEN min_level * 3.2 END, 0) + 1
    )
) STORED;
ALTER TABLE public.buildings ADD COLUMN height_source text GENERATED ALWAYS AS (
    CASE
        WHEN height IS NOT NULL                THEN 'height'
        WHEN levels BETWEEN 1 AND 200          THEN 'levels'
        ELSE 'default'
    END
) STORED;

-- 有 building:part 的外框：3D 時隱藏外框、改畫各分段（OSM Simple 3D Buildings 慣例），
-- 否則外框柱體會把分段（如台北 101 塔身）整個包住
ALTER TABLE public.buildings ADD COLUMN has_parts boolean NOT NULL DEFAULT false;
UPDATE public.buildings o
SET has_parts = true
WHERE NOT o.is_part
  AND EXISTS (
      SELECT 1 FROM public.buildings p
      WHERE p.is_part
        AND p.geom && o.geom
        AND ST_Within(ST_PointOnSurface(p.geom), o.geom)
  );

COMMIT;

-- =============================================================================
-- 綜合表（generalized tables）：低 zoom 專用的預先簡化資料
--   *_z8  → tile function 在 z ≤ 8 使用，容差 0.0003°（≈ z8 一個 tile 單位 38 m）
--   *_z11 → tile function 在 z 9–11 使用，容差 0.00004°（≈ z11 一個 tile 單位 4.8 m）
--   z ≥ 12 直接用原表
-- 用一般 table 而非 materialized view：osm2pgsql 重匯時會 DROP 原表，
-- 有相依 view 會讓 DROP 失敗。儲存 SRID 維持 EPSG:4326。
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- roads：同 kind/class/name/ref 的相連線段合併成一條（OSM 道路被切成大量短 way，
-- feature 數才是低 zoom 圖磚過大的主因），再簡化。低 zoom 不需要 oneway/layer/bridge/tunnel。
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.roads_z8, public.roads_z11;

CREATE TABLE public.roads_z8 AS
SELECT g.kind, g.class, g.name, g.ref, g.minzoom,
       ST_Simplify(d.geom, 0.0003)::geometry(LineString, 4326) AS geom
FROM (
    SELECT kind, class, name, ref, minzoom, ST_LineMerge(ST_Collect(geom)) AS merged
    FROM public.roads WHERE minzoom <= 8
    GROUP BY kind, class, name, ref, minzoom
) g
CROSS JOIN LATERAL ST_Dump(g.merged) d
WHERE GeometryType(d.geom) = 'LINESTRING';

CREATE TABLE public.roads_z11 AS
SELECT g.kind, g.class, g.name, g.ref, g.minzoom,
       ST_Simplify(d.geom, 0.00004)::geometry(LineString, 4326) AS geom
FROM (
    SELECT kind, class, name, ref, minzoom, ST_LineMerge(ST_Collect(geom)) AS merged
    FROM public.roads WHERE minzoom <= 11
    GROUP BY kind, class, name, ref, minzoom
) g
CROSS JOIN LATERAL ST_Dump(g.merged) d
WHERE GeometryType(d.geom) = 'LINESTRING';

-- -----------------------------------------------------------------------------
-- landuse：簡化後 ST_Subdivide 切成 ≤ 256 頂點的小塊。
-- 大森林面（單一面數萬頂點）每張圖磚都要整個轉換＋裁切，切塊後 index 只取到相關小塊。
-- fill 圖層看不出切塊接縫；landuse 不畫外框線。
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.landuse_z8, public.landuse_z11;

CREATE TABLE public.landuse_z8 AS
SELECT t.name, t.class, t.type, t.minzoom,
       ST_Multi(s.geom)::geometry(MultiPolygon, 4326) AS geom
FROM public.landuse t
CROSS JOIN LATERAL ST_Subdivide(ST_SimplifyPreserveTopology(t.geom, 0.0003), 256) AS s(geom)
WHERE t.minzoom <= 8 AND NOT ST_IsEmpty(s.geom);

CREATE TABLE public.landuse_z11 AS
SELECT t.name, t.class, t.type, t.minzoom,
       ST_Multi(s.geom)::geometry(MultiPolygon, 4326) AS geom
FROM public.landuse t
CROSS JOIN LATERAL ST_Subdivide(ST_SimplifyPreserveTopology(t.geom, 0.00004), 256) AS s(geom)
WHERE t.minzoom <= 11 AND NOT ST_IsEmpty(s.geom);

-- -----------------------------------------------------------------------------
-- boundaries：只簡化不切塊（行政界會畫外框線，切塊會出現假的分隔線）
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.boundaries_z8, public.boundaries_z11;

CREATE TABLE public.boundaries_z8 AS
SELECT relation_id, name, admin_level, minzoom,
       ST_Multi(ST_SimplifyPreserveTopology(geom, 0.0003))::geometry(MultiPolygon, 4326) AS geom
FROM public.boundaries WHERE minzoom <= 8;

CREATE TABLE public.boundaries_z11 AS
SELECT relation_id, name, admin_level, minzoom,
       ST_Multi(ST_SimplifyPreserveTopology(geom, 0.00004))::geometry(MultiPolygon, 4326) AS geom
FROM public.boundaries WHERE minzoom <= 11;

CREATE INDEX roads_z8_geom_minzoom_idx       ON public.roads_z8       USING gist (geom, minzoom);
CREATE INDEX roads_z11_geom_minzoom_idx      ON public.roads_z11      USING gist (geom, minzoom);
CREATE INDEX landuse_z8_geom_minzoom_idx     ON public.landuse_z8     USING gist (geom, minzoom);
CREATE INDEX landuse_z11_geom_minzoom_idx    ON public.landuse_z11    USING gist (geom, minzoom);
CREATE INDEX boundaries_z8_geom_minzoom_idx  ON public.boundaries_z8  USING gist (geom, minzoom);
CREATE INDEX boundaries_z11_geom_minzoom_idx ON public.boundaries_z11 USING gist (geom, minzoom);

COMMIT;

-- =============================================================================
-- 行政區標註點（boundary_labels）
--   MapLibre 對 MultiPolygon 的每一塊、以及每張圖磚的裁切片段各放一個標註，
--   多島縣市（澎湖 119 塊、連江 10 塊）名稱會重複 → 每個行政區只出一個點。
--   位置：面積最大那一塊的最大內切圓圓心（比 ST_PointOnSurface 更接近視覺中心）。
-- =============================================================================
BEGIN;

DROP TABLE IF EXISTS public.boundary_labels;

CREATE TABLE public.boundary_labels AS
SELECT b.relation_id, b.name, b.admin_level, b.minzoom,
       (ST_MaximumInscribedCircle(p.geom)).center::geometry(Point, 4326) AS geom
FROM public.boundaries b
CROSS JOIN LATERAL (
    SELECT d.geom FROM ST_Dump(b.geom) AS d
    ORDER BY ST_Area(d.geom) DESC
    LIMIT 1
) p
WHERE b.admin_level IN (4, 7, 8) AND b.name IS NOT NULL;

CREATE INDEX boundary_labels_geom_minzoom_idx ON public.boundary_labels USING gist (geom, minzoom);

COMMIT;

-- =============================================================================
-- 行政界線（boundary_lines）：縣市（4）、鄉鎮市區（7/8）、村里（9）只保留「與同級相鄰區共用、且落在陸地上」的邊界
--   OSM 行政區面延伸到海上（金門、連江為領海線），或沿海岸線描邊（澎湖每座島一圈）；
--   直接畫面外框會在海上出現虛線。共用邊界剔除沿海岸外框，與 land 相交剔除海上段。
--   鄉鎮市區分散在 level 7 與 8，兩者視為同級互相配對。
--   相依：land（05_land.sql）。land 不受 osm2pgsql 重匯影響，初次建置須先跑 05。
-- =============================================================================
BEGIN;

DROP TABLE IF EXISTS public.county_lines, public.boundary_lines;

CREATE TABLE public.boundary_lines AS
WITH tier AS (
    SELECT relation_id, name, admin_level, minzoom, geom,
           CASE admin_level WHEN 8 THEN 7 ELSE admin_level END AS tier
    FROM public.boundaries
    WHERE admin_level IN (4, 7, 8, 9)
), shared AS (
    -- 相鄰區共用同一批 OSM way，邊界完全重合，交集即為共用邊
    SELECT a.relation_id, a.name, a.admin_level, a.minzoom,
           ST_CollectionExtract(ST_Intersection(ST_Boundary(a.geom), ST_Boundary(b.geom)), 2) AS geom
    FROM tier a
    JOIN tier b ON b.tier = a.tier AND b.relation_id <> a.relation_id AND a.geom && b.geom
), on_land AS (
    SELECT s.relation_id, s.name, s.admin_level, s.minzoom,
           ST_CollectionExtract(ST_Intersection(s.geom, l.geom), 2) AS geom
    FROM shared s
    JOIN public.land l ON l.geom && s.geom AND ST_Intersects(l.geom, s.geom)
    WHERE NOT ST_IsEmpty(s.geom)
)
-- land 已切塊，線段在塊邊界斷開 → ST_LineMerge 接回
SELECT relation_id, name, admin_level, minzoom,
       ST_Multi(ST_LineMerge(ST_Union(geom)))::geometry(MultiLineString, 4326) AS geom
FROM on_land
WHERE NOT ST_IsEmpty(geom)
GROUP BY relation_id, name, admin_level, minzoom;

CREATE INDEX boundary_lines_geom_minzoom_idx ON public.boundary_lines USING gist (geom, minzoom);

COMMIT;

-- =============================================================================
-- 捷運／輕軌／高鐵路線色（transit_lines）
--   來源：osm2pgsql 匯入的 transit_routes（route 關聯）＋ transit_masters（route_master）
--   顏色：上層路線（route_master）優先，其次路線本身；高鐵固定 #CA4F0F（OSM 無顏色）
--   同一路線的去回程關聯幾何相同 → 以 ST_Union 去重、ST_LineMerge 接成長線
-- =============================================================================
BEGIN;

DROP TABLE IF EXISTS public.transit_lines;

CREATE TABLE public.transit_lines AS
WITH r AS (
    SELECT t.relation_id, t.route, t.ref, t.name, t.network, t.colour AS route_colour, t.geom,
           m.relation_id AS master_id, m.colour AS master_colour, m.name AS master_name
    FROM public.transit_routes t
    LEFT JOIN LATERAL (
        -- jsonb 陣列 @> 純量：route_master 的 members 是否含此 route
        SELECT mm.relation_id, mm.colour, mm.name
        FROM public.transit_masters mm
        WHERE mm.members @> to_jsonb(t.relation_id)
        ORDER BY (mm.colour IS NULL), mm.relation_id
        LIMIT 1
    ) m ON true
    -- 與 Lua is_transit 相同的高鐵判斷（只看 operator／network），防舊匯入資料含誤判
    WHERE t.route <> 'train'
       OR concat_ws(' ', t.operator, t.network) ~ '(高速鐵路|高鐵)'
), styled AS (
    SELECT
        CASE WHEN route = 'train' THEN 'hsr' ELSE route END AS kind,
        -- 合併鍵：高鐵全部車次合成一條；其餘有 route_master 依 master，否則依路線屬性（去回程屬性相同）
        CASE WHEN route = 'train' THEN 'hsr'
             ELSE coalesce('m' || master_id, concat_ws('|', route, ref, route_colour, network)) END AS line_key,
        ref, network,
        coalesce(master_name, name) AS name,
        CASE WHEN route = 'train' THEN '#CA4F0F' ELSE coalesce(master_colour, route_colour) END AS colour,
        geom
    FROM r
), parts AS (
    -- PTv2 路線關聯也含月台 way：月台是封閉環或短線段，剔除
    SELECT s.kind, s.line_key, s.ref, s.network, s.name, s.colour, d.geom
    FROM styled s
    CROSS JOIN LATERAL ST_Dump(s.geom) AS d
    WHERE NOT ST_IsClosed(d.geom)
      AND ST_Length(d.geom::geography) >= 250
), merged AS (
    SELECT min(kind) AS kind, min(ref) AS ref, max(network) AS network, min(name) AS name,
           min(colour) AS colour,
           ST_LineMerge(ST_Union(geom)) AS geom
    FROM parts
    GROUP BY line_key
)
SELECT m.kind, m.ref, m.network, m.name, m.colour,
       d.geom::geometry(LineString, 4326) AS geom
FROM merged m
CROSS JOIN LATERAL ST_Dump(m.geom) AS d
WHERE GeometryType(d.geom) = 'LINESTRING';

ALTER TABLE public.transit_lines ADD COLUMN minzoom smallint GENERATED ALWAYS AS (
    CASE kind
        WHEN 'hsr'        THEN 7
        WHEN 'subway'     THEN 10
        WHEN 'monorail'   THEN 10
        WHEN 'light_rail' THEN 11
        WHEN 'tram'       THEN 12
    END
) STORED;
CREATE INDEX transit_lines_geom_minzoom_idx ON public.transit_lines USING gist (geom, minzoom);

COMMIT;

-- ALTER ... ADD COLUMN STORED 會重寫整張表，更新統計資訊讓 planner 選對 index
ANALYZE public.roads, public.waterways, public.landuse, public.water, public.boundaries, public.pois, public.buildings,
        public.transit_lines, public.boundary_labels, public.boundary_lines,
        public.roads_z8, public.roads_z11, public.landuse_z8, public.landuse_z11,
        public.boundaries_z8, public.boundaries_z11;
