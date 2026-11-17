-- =============================================================================
-- 04_benchmark.sql
-- 圖磚大小／產生時間基準測試：台北 101 所在圖磚，z5–z14 × 7 圖層。
-- 調整 zoom 規則或 tile function 前後各跑一次比對。
--
-- 執行者：osm_import（或任何可呼叫 tile_* 的角色）
-- 判讀：單一圖層 > 500 KB 或 > 500 ms 標記 '!'；合併圖磚（7 層合計）目標 < 500 KB。
-- =============================================================================
\set ON_ERROR_STOP on

DO $$
DECLARE
    -- 台北 101：lon 121.5654 / lat 25.0330（EPSG:4326）
    lon CONSTANT float8 := 121.5654;
    lat CONSTANT float8 := 25.0330;
    z int; x int; y int; n float8;
    l text; t0 timestamptz; b bytea; ms int; kb int; total_kb int; line text;
BEGIN
    FOR z IN 5..14 LOOP
        -- slippy-map tile index（Web Mercator / EPSG:3857 tiling scheme）
        n := 2 ^ z;
        x := floor((lon + 180) / 360 * n);
        y := floor((1 - ln(tan(radians(lat)) + 1 / cos(radians(lat))) / pi()) / 2 * n);
        line := format('z%-2s %5s/%-5s', z, x, y);
        total_kb := 0;
        FOREACH l IN ARRAY ARRAY['land','boundaries','landuse','water','waterways','roads','transit','buildings','pois'] LOOP
            t0 := clock_timestamp();
            EXECUTE format('SELECT public.tile_%s($1, $2, $3)', l) INTO b USING z, x, y;
            ms := round(extract(epoch FROM clock_timestamp() - t0) * 1000);
            kb := round(coalesce(length(b), 0) / 1024.0);
            total_kb := total_kb + kb;
            line := line || format(' | %s %s%sKB/%sms', left(l, 5),
                                   CASE WHEN kb > 500 OR ms > 500 THEN '!' ELSE '' END, kb, ms);
        END LOOP;
        RAISE NOTICE '% || total %KB%', line, total_kb, CASE WHEN total_kb > 500 THEN ' !' ELSE '' END;
    END LOOP;
END
$$;
