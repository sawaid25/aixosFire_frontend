-- Seed the four initial catalog products. image_url is left NULL — the
-- frontend renders a purpose-made illustration per category
-- (src/components/products/ProductImageFallback.jsx) until an admin uploads
-- a real photo via the Products page.

BEGIN;

INSERT INTO public.products (name, description, category, is_active)
SELECT v.name, v.description, v.category, true
FROM (VALUES
    ('Fire Fighting System', 'Sprinklers, hydrants, hose reels, and foam systems for active fire suppression.', 'Fire Fighting System'),
    ('Fire Alarm System', 'Detection and notification equipment — smoke/heat detectors, control panels, and alarms.', 'Fire Alarm System'),
    ('Fire Pumps', 'Electric, diesel, and jockey pumps that supply pressurized water to fire suppression systems.', 'Fire Pumps'),
    ('Tanks', 'Water storage, foam, and pressure tanks that supply fire fighting systems.', 'Tanks')
) AS v(name, description, category)
WHERE NOT EXISTS (
    SELECT 1 FROM public.products p WHERE p.name = v.name
);

COMMIT;
