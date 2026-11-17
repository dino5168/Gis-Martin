-- =============================================================================
-- 03_verify.sql
-- Tile function 驗證（DB 端測試）。任何一項失敗會 RAISE EXCEPTION，psql 以非 0 結束。
--
-- 測試圖磚（台北 101 一帶，lon 121.5654 / lat 25.0330）：
--   z5  26/13      z12 3431/1753      z14 13724/7014
-- =============================================================================
\set ON_ERROR_STOP on

DO $$
DECLARE
    -- length(NULL) 為 NULL，統一以 0 表示空圖磚
    n integer;
BEGIN
    -- 1. 低 zoom：縣市界要有，建物/一般道路不得出現
    n := coalesce(length(public.tile_boundaries(5, 26, 13)), 0);
    IF n = 0 THEN RAISE EXCEPTION 'FAIL boundaries z5 should not be empty'; END IF;

    n := coalesce(length(public.tile_buildings(12, 3431, 1753)), 0);
    IF n <> 0 THEN RAISE EXCEPTION 'FAIL buildings z12 should be empty, got % bytes', n; END IF;

    -- 2. z5 道路只允許 motorway / trunk
    IF EXISTS (
        SELECT 1 FROM public.roads
        WHERE minzoom <= 5 AND NOT (kind = 'highway' AND class IN ('motorway', 'trunk'))
    ) THEN
        RAISE EXCEPTION 'FAIL roads minzoom<=5 contains non motorway/trunk';
    END IF;

    -- 3. 高 zoom：市區各圖層都要有資料
    n := coalesce(length(public.tile_roads(14, 13724, 7014)), 0);
    IF n = 0 THEN RAISE EXCEPTION 'FAIL roads z14 empty'; END IF;

    n := coalesce(length(public.tile_buildings(14, 13724, 7014)), 0);
    IF n = 0 THEN RAISE EXCEPTION 'FAIL buildings z14 empty'; END IF;

    n := coalesce(length(public.tile_pois(14, 13724, 7014)), 0);
    IF n = 0 THEN RAISE EXCEPTION 'FAIL pois z14 empty'; END IF;

    -- 4. 台灣範圍外（太平洋中央 z5 31/14）必須是空圖磚
    n := coalesce(length(public.tile_roads(5, 31, 14)), 0);
    IF n <> 0 THEN RAISE EXCEPTION 'FAIL roads outside Taiwan should be empty'; END IF;

    -- 5. 不出圖的 railway 節點（平交道等）minzoom 必須為 NULL
    IF EXISTS (
        SELECT 1 FROM public.pois
        WHERE class = 'railway' AND subclass = 'level_crossing' AND minzoom IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'FAIL railway level_crossing should not be rendered';
    END IF;

    -- 5b. POI 分級：街道設施不出圖、餐廳 z15、z13 圖磚不得含 minzoom > 13 的 POI
    IF EXISTS (SELECT 1 FROM public.pois WHERE class = 'amenity' AND subclass = 'drinking_water' AND minzoom IS NOT NULL) THEN
        RAISE EXCEPTION 'FAIL amenity=drinking_water should not be rendered';
    END IF;
    IF EXISTS (SELECT 1 FROM public.pois WHERE class = 'amenity' AND subclass = 'restaurant' AND minzoom <> 15) THEN
        RAISE EXCEPTION 'FAIL amenity=restaurant should have minzoom 15';
    END IF;
    IF EXISTS (SELECT 1 FROM public.pois WHERE minzoom > 16) THEN
        RAISE EXCEPTION 'FAIL pois minzoom must be <= 16 so the z14 tile (overzoomed) carries them';
    END IF;

    -- 5c. LOD1 建物高度
    IF EXISTS (SELECT 1 FROM public.buildings WHERE render_height IS NULL OR render_height <= render_min_height) THEN
        RAISE EXCEPTION 'FAIL buildings render_height must be set and above render_min_height';
    END IF;
    IF EXISTS (SELECT 1 FROM public.buildings
               WHERE height IS NULL AND (levels IS NULL OR levels NOT BETWEEN 1 AND 200)
                 AND min_height IS NULL AND min_level IS NULL
                 AND (render_height <> 6.4::real OR height_source <> 'default')) THEN
        RAISE EXCEPTION 'FAIL buildings without height/levels should default to 6.4 m (2 levels)';
    END IF;
    -- 台北 101 一帶應有 building:part，且最高分段 > 400 m（101 實際 508 m）
    IF NOT EXISTS (SELECT 1 FROM public.buildings
                   WHERE is_part AND render_height > 400
                     AND geom && ST_MakeEnvelope(121.560, 25.030, 121.570, 25.038, 4326)) THEN
        RAISE EXCEPTION 'FAIL expected Taipei 101 building:part taller than 400 m';
    END IF;
    -- 101 的外框必須被標記 has_parts（3D 時隱藏外框）
    IF NOT EXISTS (SELECT 1 FROM public.buildings
                   WHERE has_parts AND geom && ST_MakeEnvelope(121.560, 25.030, 121.570, 25.038, 4326)) THEN
        RAISE EXCEPTION 'FAIL expected a building outline with has_parts near Taipei 101';
    END IF;

    -- 5d. 捷運路線色：板南線藍、淡水信義線紅（OSM 值）、高鐵固定橘；台北 z12 transit 圖磚非空
    IF NOT EXISTS (SELECT 1 FROM public.transit_lines WHERE ref = 'BL' AND lower(colour) = '#007ec7') THEN
        RAISE EXCEPTION 'FAIL Taipei Bannan line (BL) should be #007ec7';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.transit_lines WHERE kind = 'hsr' AND colour = '#CA4F0F') THEN
        RAISE EXCEPTION 'FAIL HSR line should exist with colour #CA4F0F';
    END IF;
    IF EXISTS (SELECT 1 FROM public.transit_lines WHERE colour IS NULL AND kind IN ('subway', 'hsr')
               AND geom && ST_MakeEnvelope(121.4, 24.9, 121.7, 25.2, 4326)) THEN
        RAISE EXCEPTION 'FAIL every Taipei metro line should have a colour';
    END IF;
    n := coalesce(length(public.tile_transit(12, 3431, 1753)), 0);
    IF n = 0 THEN RAISE EXCEPTION 'FAIL transit z12 Taipei should not be empty'; END IF;

    -- 6. 海陸：台北市區 z14 一定是陸地；
    --    台灣海峽中央 z10 853/440（lon 119.88–120.23 / lat 24.21–24.53，澎湖以北、台中外海）一定是海
    n := coalesce(length(public.tile_land(14, 13724, 7014)), 0);
    IF n = 0 THEN RAISE EXCEPTION 'FAIL land z14 Taipei should not be empty'; END IF;

    n := coalesce(length(public.tile_land(10, 853, 440)), 0);
    IF n <> 0 THEN RAISE EXCEPTION 'FAIL land in mid Taiwan Strait should be empty, got % bytes', n; END IF;

    n := coalesce(length(public.tile_land(5, 26, 13)), 0);
    IF n = 0 THEN RAISE EXCEPTION 'FAIL land z5 should not be empty'; END IF;

    -- 7. 行政界線：只有陸上共用邊界；無陸上鄰區者（離島縣、單島鄉）不得有線
    IF EXISTS (
        SELECT 1 FROM public.boundary_lines c
        WHERE (c.admin_level = 4 AND c.name IN ('澎湖縣', '金門縣', '連江縣'))
           OR (c.admin_level IN (7, 8) AND c.name IN ('蘭嶼鄉', '綠島鄉', '琉球鄉', '七美鄉'))
    ) THEN
        RAISE EXCEPTION 'FAIL boundary_lines should not contain areas without land neighbours';
    END IF;
    n := (SELECT count(*) FROM public.boundary_lines WHERE admin_level = 4);
    IF n < 15 THEN RAISE EXCEPTION 'FAIL boundary_lines expected >= 15 counties, got %', n; END IF;
    n := (SELECT count(*) FROM public.boundary_lines WHERE admin_level IN (7, 8));
    IF n < 300 THEN RAISE EXCEPTION 'FAIL boundary_lines expected >= 300 towns, got %', n; END IF;
    n := (SELECT count(*) FROM public.boundary_lines WHERE admin_level = 9);
    IF n < 7000 THEN RAISE EXCEPTION 'FAIL boundary_lines expected >= 7000 villages, got %', n; END IF;

    RAISE NOTICE 'ALL TILE FUNCTION CHECKS PASSED';
END
$$;

-- 效能抽查：z14 市中心 roads 應走 roads_geom_minzoom_idx，執行時間 < 100 ms 為佳
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT public.tile_roads(14, 13724, 7014);
