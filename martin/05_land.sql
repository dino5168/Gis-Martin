-- =============================================================================
-- 05_land.sql
-- 陸地多邊形：由 osmdata 全球 land-polygons-split-4326 取台灣範圍，供海陸分色。
--
-- 執行者：osm_import
-- 前置  ：shp2pgsql 已把 land_polygons.shp 載入 public.land_polygons_raw（SRID 4326）
--         見 Martin-Setup.md「陸地多邊形」
-- 時機  ：只在更新陸地資料時執行；osm2pgsql 重匯不會刪除 land* 表，不需重跑
-- 結果  ：land（z ≥ 12）、land_z8、land_z11（低 zoom 綜合表），並刪除 raw 表
--
-- 裁切範圍 = 前端 maxBounds [114.5, 19.5, 124.5, 27.5]（web/src/map/MapView.tsx）外擴 1°，
-- 與 config.yaml 的 land bounds 一致。必須涵蓋使用者可平移／縮放到的整個視窗，
-- 否則低 zoom 會看到陸地被直線切掉的方框（福建、廣東沿海、菲律賓北部只有陸地底色）。
-- =============================================================================
\set ON_ERROR_STOP on

BEGIN;

-- 先裁切到瀏覽範圍（EPSG:4326）；ST_Intersection 可能產生 GeometryCollection，只取面
CREATE TEMP TABLE land_clip ON COMMIT DROP AS
SELECT ST_CollectionExtract(
           ST_Intersection(r.geom, ST_MakeEnvelope(113.5, 18.5, 125.5, 28.5, 4326)), 3) AS geom
FROM public.land_polygons_raw r
WHERE r.geom && ST_MakeEnvelope(113.5, 18.5, 125.5, 28.5, 4326);

DELETE FROM land_clip WHERE ST_IsEmpty(geom);

DROP TABLE IF EXISTS public.land, public.land_z8, public.land_z11;

-- 全部切成 ≤ 256 頂點的小塊：海岸線面頂點極多，切塊後每張圖磚只需處理相關小塊。
-- fill 圖層看不出切塊接縫（陸地不畫外框）。
CREATE TABLE public.land AS
SELECT ST_Multi(s.geom)::geometry(MultiPolygon, 4326) AS geom
FROM land_clip c
CROSS JOIN LATERAL ST_Subdivide(c.geom, 256) AS s(geom)
WHERE NOT ST_IsEmpty(s.geom);

-- 容差與 01_post_import.sql 的綜合表一致：z8 ≈ 38 m、z11 ≈ 4.8 m
CREATE TABLE public.land_z8 AS
SELECT ST_Multi(s.geom)::geometry(MultiPolygon, 4326) AS geom
FROM land_clip c
CROSS JOIN LATERAL ST_Subdivide(ST_SimplifyPreserveTopology(c.geom, 0.0003), 256) AS s(geom)
WHERE NOT ST_IsEmpty(s.geom);

CREATE TABLE public.land_z11 AS
SELECT ST_Multi(s.geom)::geometry(MultiPolygon, 4326) AS geom
FROM land_clip c
CROSS JOIN LATERAL ST_Subdivide(ST_SimplifyPreserveTopology(c.geom, 0.00004), 256) AS s(geom)
WHERE NOT ST_IsEmpty(s.geom);

CREATE INDEX land_geom_idx     ON public.land     USING gist (geom);
CREATE INDEX land_z8_geom_idx  ON public.land_z8  USING gist (geom);
CREATE INDEX land_z11_geom_idx ON public.land_z11 USING gist (geom);

-- 全球 raw 資料約數 GB，台灣以外用不到
DROP TABLE public.land_polygons_raw;

COMMIT;

ANALYZE public.land, public.land_z8, public.land_z11;
