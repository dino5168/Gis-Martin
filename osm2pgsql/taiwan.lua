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
