-- Attaches real product photos to the seeded catalogue rows.
--
-- Every image referenced below was extracted directly from the Frontier
-- Safety Ltd UK product catalogue PDF (the same source as
-- 20260822121500_seed_initial_products.sql) — one crop per real product /
-- model, cropped from that product's own datasheet page. Nothing here is a
-- stock, generic, or AI-generated image. Files live in the frontend as static
-- assets under `public/product-images/<slug>.jpg`, so `image_url` is a
-- root-relative path served by the SPA host (Vercel) — no Supabase Storage
-- upload required.
--
-- Products with no usable photo in the catalogue (Foam Fire Extinguisher,
-- AFFF Concentrate — text-only datasheet pages) are deliberately left with
-- image_url = NULL so the frontend keeps rendering its category illustration
-- fallback (src/components/products/ProductImageFallback.jsx) rather than a
-- mismatched picture.
--
-- Guard: only rows where image_url IS NULL are touched, so a real photo an
-- admin later uploads via the Products page always wins, and re-running this
-- migration is a no-op.

BEGIN;

UPDATE public.products AS p
SET image_url = v.image_url
FROM (VALUES
    -- Fire Alarm System
    ('Fire Alarm System', 'Addressable Fire Alarm Control Panel',                       '/product-images/frn-3002.jpg'),
    ('Fire Alarm System', 'Point-Type Photoelectric Smoke Detector',                    '/product-images/frn-30.jpg'),
    ('Fire Alarm System', 'Point-Type Heat Detector',                                   '/product-images/frn-20.jpg'),
    ('Fire Alarm System', 'Manual Call Point',                                          '/product-images/frn-60.jpg'),
    ('Fire Alarm System', 'Addressable Sounder Visual Indicator',                       '/product-images/frn-92.jpg'),
    ('Fire Alarm System', 'I/O Module',                                                 '/product-images/frn-56.jpg'),
    ('Fire Alarm System', 'Short Circuit Isolator',                                     '/product-images/frn-57.jpg'),
    ('Fire Alarm System', 'Conventional Fire Alarm Control Panel',                      '/product-images/frnc-4001.jpg'),
    ('Fire Alarm System', 'Conventional Smoke Detector',                                '/product-images/frnsc.jpg'),
    ('Fire Alarm System', 'Conventional Heat Detector',                                 '/product-images/frnhc.jpg'),
    ('Fire Alarm System', 'Conventional Manual Call Point',                             '/product-images/frnmcp.jpg'),
    ('Fire Alarm System', 'Conventional Sounder',                                       '/product-images/frn-91c.jpg'),
    ('Fire Alarm System', 'Long Life Smoke Alarm for Residential Applications',         '/product-images/205-dc.jpg'),

    -- Emergency Lighting & Central Monitoring
    ('Emergency Lighting & Central Monitoring', 'Central Monitoring Panel',                                  '/product-images/frn-350-dc36u.jpg'),
    ('Emergency Lighting & Central Monitoring', 'Addressable Surface/Recessed Mounted Emergency Light',      '/product-images/frn-z2745u.jpg'),
    ('Emergency Lighting & Central Monitoring', 'Addressable Hanging Exit Light',                            '/product-images/frn-b2308u.jpg'),
    ('Emergency Lighting & Central Monitoring', 'Addressable Ceiling/Wall Mounted Exit Light',               '/product-images/frn-b5508u.jpg'),
    ('Emergency Lighting & Central Monitoring', 'Addressable Recess Mounted Emergency Light',                '/product-images/frn-z1805u.jpg'),
    ('Emergency Lighting & Central Monitoring', 'Addressable Surface Mounted Emergency Light',               '/product-images/frn-z2805u.jpg'),
    ('Emergency Lighting & Central Monitoring', 'Conventional Emergency Light',                              '/product-images/frn-2145.jpg'),
    ('Emergency Lighting & Central Monitoring', 'Conventional Exit Light (Wall Mounted)',                    '/product-images/frn-b5108u-g.jpg'),

    -- Voice Evacuation System
    ('Voice Evacuation System', 'Digital Network PA & Voice Alarm Controller',          '/product-images/frnva-6000ma.jpg'),
    ('Voice Evacuation System', 'Fireproof Ceiling Speaker',                            '/product-images/frnva-104c-105c.jpg'),
    ('Voice Evacuation System', 'Wall Mount Loudspeaker',                               '/product-images/frnva-611.jpg'),

    -- Fire Resistant Cables (shared cross-section diagram from the catalogue)
    ('Fire Resistant Cables', 'Fire Alarm Cable Shielded Series (2C x 1.0 sq.mm)',      '/product-images/fire-alarm-cable.jpg'),
    ('Fire Resistant Cables', 'Fire Resistant Cable (2C x 1.5 sq.mm)',                  '/product-images/fire-alarm-cable.jpg'),
    ('Fire Resistant Cables', 'Fire Resistant Cable (2C x 2.5 sq.mm)',                  '/product-images/fire-alarm-cable.jpg'),

    -- Fire Pumps
    ('Fire Pumps', 'End Suction Fire Pump',                                             '/product-images/end-suction-fire-pump.jpg'),
    ('Fire Pumps', 'Horizontal Split Case Fire Pump',                                   '/product-images/horizontal-split-case-fire-pump.jpg'),
    ('Fire Pumps', 'Vertical Turbine Fire Pump',                                        '/product-images/vertical-turbine-fire-pump.jpg'),

    -- Automatic Sprinkler Head
    ('Automatic Sprinkler Head', 'Automatic Sprinkler Head',                            '/product-images/automatic-sprinkler-head.jpg'),

    -- Portable Fire Extinguishers
    ('Portable Fire Extinguishers', 'CO2 Fire Extinguisher',                            '/product-images/co2-fire-extinguisher.jpg'),
    ('Portable Fire Extinguishers', 'Dry Powder (ABC) Fire Extinguisher',              '/product-images/dry-powder-fire-extinguisher.jpg'),
    ('Portable Fire Extinguishers', 'Water Fire Extinguisher',                          '/product-images/water-fire-extinguisher.jpg'),
    ('Portable Fire Extinguishers', 'Wet Chemical Fire Extinguisher',                   '/product-images/wet-chemical-fire-extinguisher.jpg'),
    -- 'Foam Fire Extinguisher' — no catalogue photo, intentionally left NULL.

    -- Special Suppression System
    ('Special Suppression System', 'SP Series — HFC-227ea Clean Agent Fire Extinguishing System', '/product-images/sp-series-hfc227ea.jpg'),

    -- Foam System
    ('Foam System', 'Foam Bladder Tank',                                                '/product-images/foam-bladder-tank.jpg'),
    -- 'Aqueous Film Forming Foam (AFFF) Concentrate' — text-only datasheet, left NULL.

    -- Valves
    ('Valves', 'Resilient Seated Gate Valve',                                           '/product-images/gate-valve.jpg'),
    ('Valves', 'Butterfly Valve',                                                       '/product-images/butterfly-valve.jpg'),
    ('Valves', 'Y Strainer',                                                            '/product-images/y-strainer.jpg'),
    ('Valves', 'Swing Check Valve',                                                      '/product-images/swing-check-valve.jpg'),
    ('Valves', 'Alarm Check Valve',                                                      '/product-images/alarm-check-valve.jpg'),
    ('Valves', 'Deluge Valve',                                                           '/product-images/deluge-valve.jpg'),
    ('Valves', 'Pre-Action System',                                                      '/product-images/pre-action-system.jpg'),
    ('Valves', 'Pressure Reducing Valve',                                                '/product-images/pressure-reducing-valve.jpg'),
    ('Valves', 'Wet Barrel Hydrant',                                                     '/product-images/wet-barrel-hydrant.jpg'),
    ('Valves', 'UL Listed Medium Velocity Water Spray Nozzle',                           '/product-images/mv-water-spray-nozzle.jpg')
) AS v(category_name, name, image_url)
JOIN public.categories c ON c.name = v.category_name
WHERE p.name = v.name
  AND p.category_id = c.id
  AND p.image_url IS NULL;

COMMIT;
