-- Seeds real categories and products extracted from the Frontier Safety Ltd
-- UK product catalogue PDF supplied by the admin. Every name, model number,
-- description, and specification value below is taken directly from that
-- document — nothing is invented. Where the PDF gave a size/rating table for
-- one physical product line (e.g. End Suction Fire Pump, Automatic Sprinkler
-- Head), that line is seeded as a single product with the size/model range
-- captured in `specifications` rather than one row per size variant.
--
-- Category note: the source catalogue does not organize its contents under
-- the four category names the admin originally listed — "Fire Fighting
-- System" as a single label doesn't correspond to any one section of the
-- PDF, and every real product in it already belongs to a more specific real
-- category (Sprinkler Heads, Valves, Extinguishers, Suppression, Foam, ...).
-- Per the admin's direction, each distinct catalogue section became its own
-- top-level category instead of being forced into a generic bucket. "Tanks"
-- has no coverage in this catalogue at all and was intentionally not created
-- here — add it once real tank product data is available.
--
-- image_url is left NULL throughout — the frontend renders a purpose-made
-- illustration per category (src/components/products/ProductImageFallback.jsx)
-- until an admin uploads a real photo via the Products page.

BEGIN;

INSERT INTO public.categories (name, description, is_active)
SELECT v.name, v.description, true
FROM (VALUES
    ('Fire Alarm System', 'Addressable and conventional detection & notification equipment — control panels, detectors, call points, sounders, isolators.'),
    ('Emergency Lighting & Central Monitoring', 'Addressable and conventional exit/emergency lights plus the central monitoring panels that supervise them.'),
    ('Voice Evacuation System', 'PA and voice alarm controllers, fireproof ceiling speakers, and wall-mount loudspeakers.'),
    ('Fire Resistant Cables', 'Shielded fire alarm and fire resistant cable series for signaling, detection, and notification circuits.'),
    ('Fire Pumps', 'End suction, horizontal split-case, and vertical turbine fire pumps that supply pressurized water to suppression systems.'),
    ('Automatic Sprinkler Head', 'Pendent, upright, sidewall, conventional and recessed automatic sprinkler heads for NFPA13 systems.'),
    ('Portable Fire Extinguishers', 'CO2, dry powder (ABC), water, wet chemical, and foam portable fire extinguishers.'),
    ('Special Suppression System', 'HFC-227ea clean agent fire extinguishing systems for occupied, high-value, or clean-up-sensitive areas.'),
    ('Foam System', 'Foam bladder tanks and AFFF (Aqueous Film Forming Foam) concentrate for Class A & B fire suppression.'),
    ('Valves', 'Gate, butterfly, check, deluge, and pressure reducing valves, strainers, hydrants, water spray nozzles, and pre-action systems.')
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.name = v.name);

-- Helper: look up a category id by name (used below for every product insert).
-- Written as a set of INSERTs each keyed off the category, guarded so
-- re-running this migration never creates duplicate products.

INSERT INTO public.products (category_id, name, model_number, description, specifications, is_active)
SELECT c.id, v.name, v.model_number, v.description, v.specifications::jsonb, true
FROM (VALUES
    -- Fire Alarm System
     ('Fire Alarm System', 'Addressable Fire Alarm Control Panel', 'FRN 3002',
     'Addressable fire alarmcontrol panel designed to comply with the latest versions of EN 54 parts 2 & 4, with simple installation, operation and maintenance.',
     '{"Loop Capacity":"Up to 324 addresses per loop","Display":"4.3\" color LCD, 480x272","Zone Indication":"32 zones","Event Log":"1000 historical events with date/time stamp","Networking":"CAN bus up to 20 panels; Ethernet up to 255 panels","Main Power Supply":"220/230VAC ±15%, 47-63Hz, max 0.8A","Battery":"2x12V/17Ah VRLA","Dimensions (HxWxD)":"565 x 430 x 170 mm"}'),
    ('Fire Alarm System', 'Point-Type Photoelectric Smoke Detector', 'FRN 30',
     'Addressable point-type photoelectric smoke detector with soft addressing and real-time sampling data processing.',
     '{"Standard":"EN54-7","Technology":"Photoelectric smoke sensing, soft addressing, address rewriting via CODER in situ","History":"144 historical data points, curve tracing","Wiring":"Non-polarity two-wire bus connection"}'),
    ('Fire Alarm System', 'Point-Type Heat Detector', 'FRN 20',
     'Addressable point-type heat detector with soft addressing and temperature compensation.',
     '{"Standard":"EN54-5","Technology":"Single-chip microcomputer, real-time data collection, curve tracing","Wiring":"Non-polarity two-wire bus wiring"}'),
    ('Fire Alarm System', 'Manual Call Point', 'FRN 60',
     'Addressable manual call point, semi-flush or surface mount, with lever reusable (non-glass break) activation.',
     '{"Standard":"EN54-11","Mounting":"Semi-flush or surface","Indicator":"LED","Addressing":"Complete soft addressing in situ"}'),
    ('Fire Alarm System', 'Addressable Sounder Visual Indicator', 'FRN 92',
     'Addressable sounder with visual indicator, suitable for wall and ceiling-mount installation, providing 16 alarm tones.',
     '{"Standard":"EN54-3 and EN54-23","Mounting":"Wall and ceiling-mount","Alarm Tones":"16"}'),
    ('Fire Alarm System', 'I/O Module', 'FRN 56',
     'Addressable input/output module, semi-flush or surface mount, with full soft addressing and rewriting through CODER-9001 encoder.',
     '{"Standard":"EN54-18","Mounting":"Semi-flush or surface","Indicator":"LED"}'),
    ('Fire Alarm System', 'Short Circuit Isolator', 'FRN 57',
     'Addressable short circuit isolator that isolates faulty loop sections and automatically resets once the fault clears.',
     '{"Standard":"EN54-17","Function":"Isolates faulty parts of the loop on short circuit; automatic reset once cleared","Indicator":"LED status lights"}'),
    ('Fire Alarm System', 'Conventional Fire Alarm Control Panel', 'FRNC 4001',
     'Conventional fire alarm control panel available in 2, 4, or 8 zone configurations.',
     '{"Zones":"2, 4 or 8 detection zones","Devices per Zone":"Up to 32","Repeater Panels":"Supports up to 7","Auxiliary Output":"Supervised auxiliary DC 24V","Relay Outputs":"2 programmable fire alarm relay outputs"}'),
    ('Fire Alarm System', 'Conventional Smoke Detector', 'FRNSC',
     'Conventional smoke detector with advanced algorithms for analogue detection discrimination and a stable smoke sensing chamber.',
     '{"Design":"Surface mount device circuit board","Wiring":"2-wire and 4-wire models available","Reset":"4-wire models available with auto reset","Output":"2-wire and 4-wire models with remote LED output"}'),
    ('Fire Alarm System', 'Conventional Heat Detector', 'FRNHC',
     'Conventional heat detector with a durable heat sensor and analogue detection discrimination.',
     '{"Sensor":"Durable heat sensor, analogue detection discrimination","Indicator":"Dual LED for 360° visibility","Wiring":"2-wire and 4-wire models, remote LED output; 4-wire with auto reset"}'),
    ('Fire Alarm System', 'Conventional Manual Call Point', 'FRNMCP',
     'Conventional manual call point with a pressure-activated displacement element for safe user activation.',
     '{"Activation":"Pressure activated displacement element","Reset":"Resettable with simple key operation","Use":"Suitable for indoor use","Monitoring":"Monitors quiescent alarm and fault conditions"}'),
    ('Fire Alarm System', 'Conventional Sounder', 'FRN 91C',
     'Conventional sounder operating from the supply voltage connected to the devices, with relay output and indicating equipment.',
     '{"Operating Voltage":"DC 24V","Sound Output":"95 dB at 1m","Quiescent Current":"Zero current load in quiescent condition"}'),
    ('Fire Alarm System', 'Long Life Smoke Alarm for Residential Applications', '205 DC',
     'Battery-powered wireless smoke alarm combining smoke detection and alarm functions in a single unit, suitable for general residential applications.',
     '{"Standards":"EN 14604, VDS 3131, CE","Power":"Long-life Lithium-ion battery, no mains supply required","Operating Life":"Up to 10 years under normal conditions","Sound Output":"85 dB sounder","Connectivity":"Interconnectable via wireless transmission path, closed group configuration","Battery Models":"User-replaceable and non-replaceable variants available"}'),

    -- Emergency Lighting & Central Monitoring
    ('Emergency Lighting & Central Monitoring', 'Central Monitoring Panel', 'FRN-350-DC36U',
     'Addressable control panel for emergency luminaires. Uses one core (two-wire) power supply wiring for digital communication, supporting up to 255 emergency fixtures over a maximum distance of 1000 meters.',
     '{"Input Voltage":"AC 100-120V / 200-240V","Output Voltage":"DC34.5V","Output Current":"Max 8A","Output Power":"Maximum 276W","Communication Distance":"Up to 1000 meters","Carrying Capacity":"Maximum 255 devices","No. of Lines":"2 lines","Certificate":"UL"}'),
    ('Emergency Lighting & Central Monitoring', 'Addressable Surface/Recessed Mounted Emergency Light', 'FRN-Z2745U',
     'Addressable emergency light for surface or recessed mounting.',
     '{"Mounting Method":"Surface/Recessed","Input Voltage":"DC36V (DC15-40V)","Light Source":"SMD2835 x 27pcs, CRI>80","Lumen Output":"300lm","IP Level":"IP65","Operation Model":"Maintained/Non-Maintained","Battery":"LiFePO4 3.2V 3600mAh","Battery Charge Time":"24H","Emergency Time":"3H","Certificate":"UL"}'),
    ('Emergency Lighting & Central Monitoring', 'Addressable Hanging Exit Light', 'FRN-B2308U',
     'Addressable hanging exit light with multiple mounting options.',
     '{"Input Voltage":"DC36V (DC15-40V)","Mounting Method":"Ceiling/Wall/Recessed/Suspend/End mount","Battery Charge Time":"24H","Emergency Time":"3H","Operation Model":"Maintained","Viewing Distance":"30M","IP Level":"IP20","Certificate":"UL"}'),
    ('Emergency Lighting & Central Monitoring', 'Addressable Ceiling/Wall Mounted Exit Light', 'FRN-B5508U',
     'Addressable exit light for ceiling or wall mounting.',
     '{"Input Voltage":"DC36V (DC15-40V)","Mounting Method":"Ceiling/Wall/End mount","Battery Charge Time":"24H","Emergency Time":"3H","Operation Model":"Maintained","Battery":"Ni-Cd 1.2V 900mAh","IP Level":"IP20","Certificate":"UL"}'),
    ('Emergency Lighting & Central Monitoring', 'Addressable Recess Mounted Emergency Light', 'FRN-Z1805U',
     'Addressable recess-mounted emergency light.',
     '{"Input Voltage":"DC36V (DC15-40V)","Mounting Method":"Recessed","Light Source":"SMD 3535 x 1pc, CRI>70","Lumen Output":"300lm","Battery Charge Time":"24H","Emergency Time":"3H","Operation Model":"Non-Maintained","Battery":"LiFePo4 3.2V 3600mAh","IP Level":"IP20","Certificate":"UL"}'),
    ('Emergency Lighting & Central Monitoring', 'Addressable Surface Mounted Emergency Light', 'FRN-Z2805U',
     'Addressable surface-mounted emergency light.',
     '{"Input Voltage":"DC36V (DC15-40V)","Mounting Method":"Surface","Light Source":"SMD 3535 x 1pc, CRI>70","Lumen Output":"300lm","Battery Charge Time":"24H","Emergency Time":"3H","Operation Model":"Non-Maintained","Battery":"LiFePo4 3.2V 3600mAh","IP Level":"IP20","Certificate":"UL"}'),
    ('Emergency Lighting & Central Monitoring', 'Conventional Emergency Light', 'FRN 2145',
     'Conventional self-contained emergency light.',
     '{"Battery":"Ni-Cd SC3.6V 1500mAh","Charge Time":"24H","Emergency Duration":"3H","PCB Type":"CEM-1 / 1.6MM","Power Supply":"Self-contained","Case Color":"White","Degree of Protection":"IP65","Certification Standard":"UL924","Input Voltage":"VAC 120-277","Operation Mode":"Maintained/Non-maintained","Dimension":"352 x 110 x 68 mm","Net Weight":"0.65 KG"}'),
    ('Emergency Lighting & Central Monitoring', 'Conventional Exit Light (Wall Mounted)', 'FRN-B5108U-G',
     'Conventional wall-mounted exit light.',
     '{"Rated Voltage":"AC120-277V~, 60Hz","Rated Wattage":"1.2W","Emergency Output Rating":"0.36W","Emergency Run Time":"180 minutes","Battery":"Ni-Cd 1.2V, 900mAh","Battery Life":"Up to 4 years","Recharge Time":"24 hrs","Operating Temp Range":"0°C-40°C","Dimensions":"305 x 203 x 53 mm","Weight":"0.85 kg","Approval":"UL"}'),

    -- Voice Evacuation System
    ('Voice Evacuation System', 'Digital Network PA & Voice Alarm Controller', 'FRNVA-6000MA',
     'Controller for public address (PA) and voice evacuation. Controls the complete system via a 5" colorful touchscreen or PC management software, realizing automatic monitoring and pre-programmed control for each zone.',
     '{"Interface":"5 inch HD color touch graphical operation interface","Players":"4 independent players, MP3 and WMA audio formats","Microphones":"Up to 4 remote microphones, 600m distance, redundancy wiring supported","AC Power Supply":"~220-240V 50/60Hz, less than 0.2A, 36W","DC Power Supply":"24V DC ±20%, max 1.5A","Size":"484 x 132 x 449 mm (19 inch, 3U)","Weight":"About 8.0 Kg"}'),
    ('Voice Evacuation System', 'Fireproof Ceiling Speaker', 'FRNVA-104C / FRNVA-105C',
     '4-inch and 5-inch fireproof ceiling speakers with ceramic connector, thermal and fire-resistant cable, and all-metal fire dome design.',
     '{"Power Taps @100V":"6W (both models)","Power Taps @70V":"3W (both models)","SPL (1W/1M)":"89dB (104C) / 90dB (105C)","Frequency Response":"110-16KHz (104C) / 110-18KHz (105C)","Certification":"EN54-24 under taken","Mounting":"Spring-clip"}'),
    ('Voice Evacuation System', 'Wall Mount Loudspeaker', 'FRNVA-611',
     'Wall-mounted loudspeaker for voice evacuation and PA systems.',
     '{"Power Taps @100V":"1.5W, 3W, 6W","Power Taps @70V":"0.75W, 1.5W, 3W","SPL (1W/1M)":"90dB ±3dB","Max SPL (Rated 1W/1M)":"98dB","Frequency Response":"90-18KHz","Dimensions":"285 x 200 x 85 mm","Weight":"1.3Kg","Mounting":"Spring-clip"}'),

    -- Fire Resistant Cables
    ('Fire Resistant Cables', 'Fire Alarm Cable Shielded Series (2C x 1.0 sq.mm)', NULL,
     'Shielded fire alarm cable for protective signaling circuits, smoke detectors, strobes/sirens, pull stations, and addressable controlled systems.',
     '{"Conductor":"Solid Bare Copper Wires, 1.12±0.003mm","Insulation":"PVC, 1.92±0.05mm, Brown & Blue","Shielding":"115% Polyester Foil + 100% Single Aluminum Foil, tinned copper drain wire","Jacket":"PVC Red RAL3000, thickness ≥0.85mm","Overall Diameter":"5.80±0.20mm","Standards":"UL 13, UL 1424, UL 444, Flame Rating UL 1666 Riser c(UL) FT4","Conductor Resistance":"≤21.4 Ω/km","Operating Temperature":"-20°C to 75°C"}'),
    ('Fire Resistant Cables', 'Fire Resistant Cable (2C x 1.5 sq.mm)', NULL,
     'Fire resistant cable, 2 core x 1.5 sq.mm, for fire alarm and detection circuits.',
     '{"Conductor":"Solid Bare Copper Wires, 1.37±0.003mm","Insulation":"PVC, 2.35±0.05mm, Brown & Blue","Overall Diameter":"6.50±0.20mm","Conductor Resistance":"≤12.0 Ω/km","Operating Temperature":"-20°C to 75°C","Fire Rating":"PVC: UL 1666"}'),
    ('Fire Resistant Cables', 'Fire Resistant Cable (2C x 2.5 sq.mm)', NULL,
     'Fire resistant cable, 2 core x 2.5 sq.mm, for fire alarm and detection circuits.',
     '{"Conductor":"Solid Bare Copper Wires, 1.76±0.003mm","Insulation":"PVC, 2.75±0.05mm, Brown & Blue","Overall Diameter":"7.40±0.20mm","Conductor Resistance":"≤7.5 Ω/km","Operating Temperature":"-20°C to 75°C","Fire Rating":"PVC: UL 1666"}'),

    -- Fire Pumps
    ('Fire Pumps', 'End Suction Fire Pump', NULL,
     'Single-stage end suction centrifugal fire pump, available across the ESF40/ESF50/ESF65/ESF80 size range, diesel or electric motor driven.',
     '{"Flow Range (50Hz)":"100 to 750 US GPM","Head Range":"up to ~175 PSI","Series":"ESF40, ESF50, ESF65, ESF80","Speed":"2980 rpm (50Hz) / 3550 rpm (60Hz)","Approvals":"NFPA, UL Listed, FM Approved"}'),
    ('Fire Pumps', 'Horizontal Split Case Fire Pump', NULL,
     'UL SCF single-stage double suction, horizontal split-case centrifugal fire pump, diesel engine or electric motor driven.',
     '{"Flow Range (60Hz)":"300 to 5000 US GPM","Head Range":"up to ~340 PSI","Series":"SCF125-100 up to SCF300-250","Casing Material":"Cast Iron – G30","Impeller Material":"Bronze","Shaft Material":"Stainless Steel","Approvals":"NFPA, UL Listed, FM Approved"}'),
    ('Fire Pumps', 'Vertical Turbine Fire Pump', NULL,
     'Vertical shaft turbine type fire pump with submerged impellers in a series-bowl assembly; UL approved for discharging water from tanks, streams, open sumps, and drilled wells.',
     '{"Flow Range":"250 to 5000 US GPM","Series":"100VTP40 up to 400VTP1250, 1 to 8 stages","Bowl/Impeller Material":"Cast Iron – G25","Shaft Material":"Stainless Steel","Components":"Discharge head, motor stand, column pipe, line shaft, bowl assembly, suction strainer","Approvals":"NFPA, UL Listed, FM Approved"}'),

    -- Automatic Sprinkler Head
    ('Automatic Sprinkler Head', 'Automatic Sprinkler Head', NULL,
     'Pendent, upright, sidewall, conventional, and recessed automatic sprinklers for use in automatic sprinkler systems designed per NFPA13. Body made of brass die-casting copper alloy (DZR).',
     '{"Styles":"Pendent, Upright, Sidewall, Conventional, Recessed Pendent, Recessed Sidewall, Recessed Conventional","K Factor":"5.6 (80) gpm/(psi)^0.5","Nominal Thread Size":"1/2\" NPT and 1/2\" BSPT","Max Working Pressure":"175 PSI (12 Bar)","Factory Test Pressure":"500 PSI (35 Bar)","Min Operating Pressure":"7 PSI (0.5 Bar)","Bulb Types":"Standard Response 5.0mm, Quick Response 3.0mm glass bulb","Model Codes":"FN001 Sidewall SR, FN002 Sidewall QR, FN003 Upright SR, FN004 Upright QR, FN005 Pendent SR, FN006 Pendent QR, FN007 Conventional SR","Finish":"Brass, Chrome Plated, White Plated available"}'),

    -- Portable Fire Extinguishers
    ('Portable Fire Extinguishers', 'CO2 Fire Extinguisher', 'FRNCA2 / FRNCA5 / FRNCA2S / FRNCA5S',
     'Carbon dioxide (CO2) portable fire extinguishers in 2KG and 5KG capacities.',
     '{"Capacities":"2 KG, 5 KG","Fire Rating":"34B to 89B","Extinguishing Agent":"CO2","Propelling Agent":"N2","Operating Pressure":"170 Bar","Duration of Discharge":"10-15 sec","Operating Temperature":"-20°C to +60°C","Material":"Alloy"}'),
    ('Portable Fire Extinguishers', 'Dry Powder (ABC) Fire Extinguisher', 'FRNDB1 / FRNDC1 / FRNDB2 / FRNDC2 / FRNDB4 / FRNDB6 / FRNDB9 / FRNDA6 / FRNRA6 / FRNRB6',
     'ABC dry powder stored-pressure portable fire extinguishers across the 1KG to 9KG range.',
     '{"Capacities":"1 KG to 9 KG","Fire Rating":"8A&55B up to 55A&233B","Extinguishing Agent":"40% ABC Powder","Propelling Agent":"N2","Working Pressure":"14 Bar","Duration of Discharge":"8-23 sec","Operating Temperature":"-30°C to +60°C","Material":"Steel Low Carbon"}'),
    ('Portable Fire Extinguishers', 'Water Fire Extinguisher', 'FRNWA6 / FRNWB6 / FRNWA9',
     'Stored-pressure water portable fire extinguishers in 6L and 9L capacities.',
     '{"Capacities":"6 LTR, 9 LTR","Fire Rating":"13A to 34A","Propelling Agent":"N2","Operating Pressure":"12 Bar","Duration of Discharge":"40-65 sec","Operating Temperature":"-5°C to +60°C","Material":"Steel Low Carbon"}'),
    ('Portable Fire Extinguishers', 'Wet Chemical Fire Extinguisher', 'FRNKA2 / FRNKA3 / FRNKA6',
     'Stored-pressure wet chemical portable fire extinguishers in 2L, 3L, and 6L capacities.',
     '{"Capacities":"2 LTR, 3 LTR, 6 LTR","Fire Rating":"5A,70B&25F up to 34A,223B&75F","Extinguishing Agent":"50% Wet Chemical","Propelling Agent":"N2","Operating Pressure":"12 Bar","Duration of Discharge":"13-30 sec","Operating Temperature":"-5°C to +60°C"}'),
    ('Portable Fire Extinguishers', 'Foam Fire Extinguisher', 'FRNFB6 / FRNFC6 / FRNFA9 / FRNFC9',
     'Stored-pressure foam portable fire extinguishers in 6L and 9L capacities.',
     '{"Capacities":"6 LTR, 9 LTR","Fire Rating":"21A&183B up to 34A&233B"}'),

    -- Special Suppression System
    ('Special Suppression System', 'SP Series — HFC-227ea Clean Agent Fire Extinguishing System', 'SP Series',
     'Clean agent fire extinguishing system using HFC-227ea, a colorless, non-toxic, electrically non-conductive gas suited for occupied high-value areas, spaces where agent clean-up is problematic, or restricted storage space. Consists of storage cylinders, distribution nozzles/piping, trim components, and a control panel.',
     '{"Agent":"HFC-227ea","Fill Density":"480 kg/m³ to 1121 kg/m³","Cylinder Pressurization":"Superpressurized with dry nitrogen to 25 or 42 bar at 21°C","Discharge Time":"Within 10 seconds","Cylinder Volumes":"40L to 180L, fill capacity 19.2kg to 201.6kg","Design Standard":"NFPA 2001 and/or agency listings"}'),

    -- Foam System
    ('Foam System', 'Foam Bladder Tank', NULL,
     'Carbon steel pressure vessel containing an elastomeric separation bladder between water and foam concentrate, used with ratio controllers to form a balanced pressure proportioning system.',
     '{"Capacity Range":"100 Liters to 10,000 Liters","Construction":"Carbon steel pressure vessel with elastomeric bladder","Orientation":"Vertical and Horizontal types available","Applications":"Multiple hazard systems, sprinkler systems, variable flow/pressure conditions"}'),
    ('Foam System', 'Aqueous Film Forming Foam (AFFF) Concentrate', 'AFFF 1% / AFFF 3% / AFFF 6%',
     'Nontoxic foam concentrate for effective extinguishment of Class A and B fires, forming a vapour-sealing aqueous film on hydrocarbon fuel surfaces.',
     '{"Types":"AFFF 1% (1:99), AFFF 3% (3:97), AFFF 6% (6:94)","Appearance":"Amber Colour","pH @20°C":"6.5-8.5","Specific Gravity @20°C":"1.00 min","Surface Tension":"Less than 18 dyn/cm","Expansion Ratio":"6.00 to 10.00","Lowest Use Temperature":"0°C","Shelf Life":"At least 10 years when stored properly","Compatibility":"Compatible with conventional/protein-based foams and dry chemical powders"}'),

    -- Valves
    ('Valves', 'Resilient Seated Gate Valve', NULL,
     'NRS (Non-Rising Stem) and OS&Y (Outside Screw & Yoke) resilient seated gate valves with flange or grooved end connections, ductile iron body with fusion-bonded epoxy coating.',
     '{"Standards":"DIN F4, BS5163, AWWA C515","End Connections":"Flange end, Grooved end","Types":"NRS and OS&Y","Pressure Rating":"360 PSI (AWWA/FM/UL)","Body Material":"Ductile Iron","Coating":"Fusion-bonded epoxy, inside and out"}'),
    ('Valves', 'Butterfly Valve', NULL,
     'Butterfly valve available with tamper switch or lever handle, in wafer or grooved-end styles.',
     '{"Styles":"Wafer style, Grooved end","Operation":"Lever handle or tamper switch"}'),
    ('Valves', 'Y Strainer', NULL,
     'Y-type strainer for fire protection piping systems, available with flange or grooved end connections.',
     '{"End Connections":"Flange end, Grooved end"}'),
    ('Valves', 'Swing Check Valve', NULL,
     'Swing check valve for fire protection piping systems, available with flange or grooved end connections.',
     '{"End Connections":"Flange end, Grooved end"}'),
    ('Valves', 'Alarm Check Valve', NULL,
     'System control valve for wet pipe sprinkler systems.',
     '{"Function":"System control / alarm check valve for wet pipe sprinkler systems"}'),
    ('Valves', 'Deluge Valve', NULL,
     'Quick release, hydraulically operated diaphragm valve used as the system control valve in a deluge system for fast water/foam application, protecting power transformers, storage tanks, conveyors, and other industrial applications.',
     '{"Nominal Sizes":"200, 150, 100, 80 & 50 NB","Material":"Cast Iron","Max Service Pressure":"12 Bar (175 PSI)","Threaded Opening":"BSPT","Mounting":"90° pattern inlet to outlet, vertical mounting","Factory Hydrostatic Test Pressure":"25 Kg/sq.cm (350 PSI)","Flange Connection":"ANSI B16.1 FF #125","Trim":"Galvanized Steel with Brass Valves","Net Weight (without trim)":"47 Kg (50NB) to 214 Kg (200NB)","Finish":"Red RAL 3000"}'),
    ('Valves', 'Pre-Action System', NULL,
     'Supervised single interlock pre-action sprinkler system with electric actuation, for locations where accidental water discharge is undesired — museums, archives, data centers, computer/electronic equipment rooms.',
     '{"Nominal Size":"50, 80, 100, 150 & 200","Working Pressure":"175 psi","Supervisory Air Pressure":"~10 psi (transfers alarm contact at 5 psi)","Core Component":"UL Listed Deluge Valve, hydraulically operated diaphragm type","Applications":"Museums, archives, data centers, lift machine rooms, valuable artifact storage"}'),
    ('Valves', 'Pressure Reducing Valve', NULL,
     'Pressure reducing valve for fire protection water supply systems.',
     '{"Function":"Reduces and maintains downstream pressure in fire protection piping systems"}'),
    ('Valves', 'Wet Barrel Hydrant', NULL,
     'Wet barrel fire hydrant for fire protection water supply.',
     '{"Type":"Wet barrel fire hydrant"}'),
    ('Valves', 'UL Listed Medium Velocity Water Spray Nozzle', 'FRN-MVN-B / FRN-MVN-S',
     'Open type (non-automatic) directional spray nozzles for fixed fire protection deluge water spray systems, applying water to exposed vertical, horizontal, curved, and irregular surfaces.',
     '{"Models":"FRN-MVN-B (Brass), FRN-MVN-S (Stainless Steel 316)","Max Working Pressure":"12 Bar (175 PSI)","End Connection":"1/2\" NPT (1/2\" BSPT optional)","Spray Angles":"140°, 120° (UL Listed), 160°, 110°, 100°, 90°, 80°, 65°","K Factors":"K-18 to K-102 (metric), other on request","Approval":"UL Listed"}')
) AS v(category_name, name, model_number, description, specifications)
JOIN public.categories c ON c.name = v.category_name
WHERE NOT EXISTS (
    SELECT 1 FROM public.products p WHERE p.name = v.name AND p.category_id = c.id
);

COMMIT;
