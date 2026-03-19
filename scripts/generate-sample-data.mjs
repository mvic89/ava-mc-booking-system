import * as XLSX from 'xlsx'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'public', 'sample-data')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

function makeWorkbook(motorcycles, spareParts, accessories) {
    const wb = XLSX.utils.book_new()

    const mcHeaders  = [['Name','Brand','Article Number','VIN','Year','Engine CC','Color','MC Type','Warehouse','Stock','Reorder Qty','Cost','Selling Price','Vendor','Description']]
    const spHeaders  = [['Name','Brand','Article Number','Category','Stock','Reorder Qty','Cost','Selling Price','Vendor','Description']]
    const accHeaders = [['Name','Brand','Article Number','Category','Size','Stock','Reorder Qty','Cost','Selling Price','Vendor','Description']]

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...mcHeaders,  ...motorcycles]),  'Motorcycles')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...spHeaders,  ...spareParts]),   'Spare Parts')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...accHeaders, ...accessories]),  'Accessories')

    return wb
}

// ─── Company 1: Stockholm Premium Moto ────────────────────────────────────────
// Focus: Premium European brands — BMW, Ducati, KTM, Triumph

const company1_mc = [
    ['BMW R 1250 GS Adventure',    'BMW',     'MC-BMW-001', 'WB10A1208NZ123456', 2024, 1254, 'Rallye Blue',      'New',      'Warehouse A', 4, 1, 189000, 219900, 'BMW Motorrad Sverige', 'Flagship adventure tourer with ShiftCam technology'],
    ['BMW S 1000 RR',              'BMW',     'MC-BMW-002', 'WB10A2409NZ234567', 2024, 999,  'M Motorsport',     'New',      'Warehouse A', 2, 1, 219000, 259900, 'BMW Motorrad Sverige', 'Superbike with 210hp, M Package'],
    ['BMW F 900 R',                'BMW',     'MC-BMW-003', 'WB10B1607NZ345678', 2023, 895,  'Sparkling Black',  'New',      'Warehouse B', 3, 1, 109000, 129900, 'BMW Motorrad Sverige', 'Naked roadster, A2 licence friendly'],
    ['Ducati Panigale V4',         'Ducati',  'MC-DUC-001', 'ZDM14BJW9PB000001', 2024, 1103, 'Ducati Red',       'New',      'Warehouse A', 2, 1, 239000, 279900, 'Ducati Sverige AB',    'Race-bred superbike, Desmosedici Stradale engine'],
    ['Ducati Monster',             'Ducati',  'MC-DUC-002', 'ZDM2A000XPB111222', 2024, 937,  'Ducati Red',       'New',      'Warehouse A', 3, 1, 129000, 149900, 'Ducati Sverige AB',    'Iconic naked bike, redesigned 2021'],
    ['Ducati Multistrada V4 S',    'Ducati',  'MC-DUC-003', 'ZDM1YDMX4NB222333', 2023, 1158, 'Ducati Red',       'New',      'Warehouse B', 2, 1, 219000, 259900, 'Ducati Sverige AB',    'Adventure tourer with radar cruise control'],
    ['KTM 1290 Super Duke R',      'KTM',     'MC-KTM-001', 'VBKV39404NM100001', 2024, 1301, 'Orange',           'New',      'Warehouse A', 3, 1, 159000, 189900, 'KTM Nordic AB',        'The Beast — 180hp naked hyperbike'],
    ['KTM 890 Adventure R',        'KTM',     'MC-KTM-002', 'VBKV39204NM200002', 2023, 889,  'Orange / Black',   'New',      'Warehouse B', 4, 1, 119000, 139900, 'KTM Nordic AB',        'Off-road focused adventure bike'],
    ['KTM 390 Duke',               'KTM',     'MC-KTM-003', 'VBKV39004NM300003', 2024, 373,  'White',            'New',      'Warehouse C', 6, 2, 59000,  72900,  'KTM Nordic AB',        'Entry-level naked, perfect A2 bike'],
    ['Triumph Street Triple RS',   'Triumph', 'MC-TRI-001', 'SMTT05BK9NA100001', 2024, 765,  'Sapphire Black',   'New',      'Warehouse A', 2, 1, 129000, 149900, 'Triumph Scandinavia',  '123hp triple-cylinder naked'],
    ['Triumph Tiger 900 Rally Pro','Triumph', 'MC-TRI-002', 'SMTT05BK7NA200002', 2023, 888,  'Snowdonia White',  'New',      'Warehouse B', 2, 1, 149000, 169900, 'Triumph Scandinavia',  'Adventure bike with off-road capability'],
    ['Triumph Bonneville T120',    'Triumph', 'MC-TRI-003', 'SMTT05BK5NA300003', 2023, 1200, 'Jet Black',        'New',      'Warehouse A', 3, 1, 119000, 139900, 'Triumph Scandinavia',  'Classic British twin, modern reliability'],
    ['BMW R 1250 GS (Trade-In)',   'BMW',     'MC-BMW-004', 'WB10A1208MZ987654', 2022, 1254, 'Triple Black',     'Trade-In', 'Warehouse C', 1, 0, 149000, 169900, 'Customer',             'Well maintained, 18 000 km, full service history'],
    ['KTM 790 Duke (Trade-In)',    'KTM',     'MC-KTM-004', 'VBKV39004LM400004', 2021, 799,  'Orange',           'Trade-In', 'Warehouse C', 1, 0, 69000,  82900,  'Customer',             '22 000 km, Akrapovic exhaust included'],
]

const company1_sp = [
    ['BMW R1250GS Oil Filter',     'BMW',     'SP-BMW-001', 'Engine',       25, 8,  180,   320,   'BMW Motorrad Sverige', 'OEM oil filter for R1250GS/RT/RS'],
    ['BMW Brake Fluid DOT4',       'BMW',     'SP-BMW-002', 'Brakes',       30, 10, 95,    165,   'BMW Motorrad Sverige', '1L DOT4 brake fluid, BMW approved'],
    ['Ducati Panigale Chain Kit',  'Ducati',  'SP-DUC-001', 'Transmission', 10, 3,  1800,  2800,  'Ducati Sverige AB',    'OEM chain and sprocket kit for V4'],
    ['Ducati Air Filter',          'Ducati',  'SP-DUC-002', 'Engine',       20, 6,  380,   620,   'Ducati Sverige AB',    'OEM air filter for Monster/Multistrada'],
    ['KTM Super Duke Brake Pads',  'KTM',     'SP-KTM-001', 'Brakes',       15, 5,  450,   750,   'KTM Nordic AB',        'OEM front brake pads for 1290 SD R'],
    ['KTM 390 Spark Plug NGK',     'KTM',     'SP-KTM-002', 'Engine',       40, 12, 120,   220,   'KTM Nordic AB',        'NGK iridium spark plug for KTM 390/690'],
    ['Triumph Triple Oil Service', 'Triumph', 'SP-TRI-001', 'Engine',       12, 4,  890,   1450,  'Triumph Scandinavia',  'Full oil service kit for Street Triple'],
    ['Triumph Tiger Chain Guard',  'Triumph', 'SP-TRI-002', 'Body & Frame', 8,  3,  280,   490,   'Triumph Scandinavia',  'OEM chain guard Tiger 900 series'],
    ['Brembo Radial Pump 19x18',   'Brembo',  'SP-BRE-001', 'Brakes',       6,  2,  2800,  4200,  'BikeParts Premium AB', 'Radial master cylinder for superbikes'],
    ['Öhlins Rear Shock S46HR1C1', 'Öhlins',  'SP-OHL-001', 'Suspension',   4,  1,  8900,  12900, 'Öhlins Sverige',       'S46 rear shock for BMW S1000RR'],
    ['Akrapovic Slip-On BMW GS',   'Akrapovic','SP-AKR-001', 'Exhaust',      5,  1,  7800,  11500, 'Akrapovic Nordic',     'Titanium slip-on for R1250GS'],
    ['Continental TKC80 170/60',   'Continental','SP-CON-001','Tyres & Wheels',8, 2, 1600,  2400,  'Metzeler Nordic AB',   'Adventure rear tyre 170/60 R17'],
    ['Pirelli Diablo Rosso IV 120/70','Pirelli','SP-PIR-001', 'Tyres & Wheels',10,3, 1800,  2700,  'Metzeler Nordic AB',   'Sport front tyre for superbikes'],
    ['WD-40 Specialist Chain Lube','WD-40',   'SP-WD-001',  'Fuel System',  50, 15, 85,    149,   'BikeParts Premium AB', '400ml chain lubricant, O/X-ring safe'],
    ['Lucas Fork Oil 10W',         'Lucas',   'SP-LUC-001', 'Suspension',   20, 6,  180,   299,   'BikeParts Premium AB', '1L fork oil, viscosity 10W'],
]

const company1_acc = [
    ['Shoei X-SPR Pro Helmet',     'Shoei',   'ACC-SHO-001', 'Helmet',     'M',  8,  3,  5200,  7800,  'Helmet World AB',    'Top-of-the-range race helmet, carbon shell'],
    ['Shoei X-SPR Pro Helmet',     'Shoei',   'ACC-SHO-002', 'Helmet',     'L',  6,  2,  5200,  7800,  'Helmet World AB',    'Top-of-the-range race helmet, carbon shell'],
    ['Arai RX-7V EVO Helmet',      'Arai',    'ACC-ARA-001', 'Helmet',     'M',  4,  2,  6800,  9900,  'Helmet World AB',    'Arai premium race helmet, PB-SNC2 shell'],
    ['Arai RX-7V EVO Helmet',      'Arai',    'ACC-ARA-002', 'Helmet',     'L',  3,  1,  6800,  9900,  'Helmet World AB',    'Arai premium race helmet, PB-SNC2 shell'],
    ['Alpinestars GP Force Gloves','Alpinestars','ACC-ALP-001','Gloves',    'M',  10, 3,  1200,  1890,  'Alpinestars Nordic', 'Race leather gloves with carbon knuckle'],
    ['Alpinestars GP Force Gloves','Alpinestars','ACC-ALP-002','Gloves',    'L',  8,  3,  1200,  1890,  'Alpinestars Nordic', 'Race leather gloves with carbon knuckle'],
    ['Dainese D-Air Racing Jacket','Dainese',  'ACC-DAI-001', 'Jacket',    'M',  4,  1,  8900,  13500, 'Dainese Nordic',     'Airbag racing jacket, certified CE Level 2'],
    ['Dainese D-Air Racing Jacket','Dainese',  'ACC-DAI-002', 'Jacket',    'L',  3,  1,  8900,  13500, 'Dainese Nordic',     'Airbag racing jacket, certified CE Level 2'],
    ['TCX RT-Race Pro Boots',      'TCX',     'ACC-TCX-001', 'Boots',      '43', 6,  2,  2800,  4200,  'Dainese Nordic',     'Race boots with ankle protection'],
    ['TCX RT-Race Pro Boots',      'TCX',     'ACC-TCX-002', 'Boots',      '44', 5,  2,  2800,  4200,  'Dainese Nordic',     'Race boots with ankle protection'],
    ['Oxford Tank Bag 8L',         'Oxford',  'ACC-OXF-001', 'Luggage',    'One Size', 12, 4, 650, 990, 'Oxford Nordic',     'Magnetic tank bag, waterproof'],
    ['SW-Motech Trax Evo Cases',   'SW-Motech','ACC-SWM-001', 'Luggage',   'One Size', 5, 2, 3800, 5600, 'SW-Motech Nordic', '37+37L aluminium panniers set'],
]

// ─── Company 2: Göteborg Bikes & More ─────────────────────────────────────────
// Focus: Japanese brands — Yamaha, Honda, Kawasaki, Suzuki

const company2_mc = [
    ['Yamaha MT-09',               'Yamaha',  'MC-YAM-001', 'JYARJ18E4NA000001', 2024, 890,  'Midnight Black',   'New',      'Warehouse A', 5, 2, 89000,  109900, 'Yamaha Motor Sverige', 'Hyper Naked with 119hp CP3 engine'],
    ['Yamaha MT-07',               'Yamaha',  'MC-YAM-002', 'JYARJ12E4NA000002', 2024, 689,  'Ice Fluo',         'New',      'Warehouse A', 6, 2, 72000,  89900,  'Yamaha Motor Sverige', 'Best-selling naked, A2 compliant'],
    ['Yamaha YZF-R1',              'Yamaha',  'MC-YAM-003', 'JYARJ24E4NA000003', 2023, 998,  'Icon Blue',        'New',      'Warehouse B', 2, 1, 169000, 199900, 'Yamaha Motor Sverige', 'Superbike with MotoGP-derived electronics'],
    ['Yamaha Ténéré 700',          'Yamaha',  'MC-YAM-004', 'JYARJ31E4NA000004', 2024, 689,  'Rally Edition',    'New',      'Warehouse A', 4, 1, 99000,  119900, 'Yamaha Motor Sverige', 'True adventure bike, lightweight twin'],
    ['Yamaha XSR900',              'Yamaha',  'MC-YAM-005', 'JYARJ18E4NA000005', 2024, 890,  'Tech Black',       'New',      'Warehouse B', 3, 1, 95000,  114900, 'Yamaha Motor Sverige', 'Sport heritage, MT-09 platform'],
    ['Honda CB1000R Black Edition','Honda',   'MC-HON-001', '1HGDC2160NA000001', 2024, 998,  'Graphite Black',   'New',      'Warehouse A', 3, 1, 129000, 149900, 'Honda Sverige AB',     'Neo Sports Café flagship, SC77 engine'],
    ['Honda CB750 Hornet',         'Honda',   'MC-HON-002', '1HGDC2161NA000002', 2024, 755,  'Pearl Glare White','New',      'Warehouse A', 5, 2, 79000,  95900,  'Honda Sverige AB',     'New 2023 middleweight, lightweight fun'],
    ['Honda Africa Twin 1100 DCT', 'Honda',   'MC-HON-003', '1HGDC2162NA000003', 2024, 1084, 'Tricolor',         'New',      'Warehouse B', 2, 1, 149000, 174900, 'Honda Sverige AB',     'Adventure flagship, dual-clutch transmission'],
    ['Kawasaki Z900',              'Kawasaki','MC-KAW-001', 'JKAZNEC19NA000001', 2024, 948,  'Pearl Robotic White','New',   'Warehouse A', 4, 1, 89000,  109900, 'Kawasaki Motors Nordic','Z-series naked with 125hp'],
    ['Kawasaki Ninja 650',         'Kawasaki','MC-KAW-002', 'JKAZNEC18NA000002', 2024, 649,  'Lime Green',       'New',      'Warehouse A', 6, 2, 72000,  87900,  'Kawasaki Motors Nordic','Sport-tourer A2 bike'],
    ['Kawasaki Z650RS',            'Kawasaki','MC-KAW-003', 'JKAZNEC17NA000003', 2024, 649,  'Candy Emerald Green','New',   'Warehouse B', 4, 1, 79000,  94900,  'Kawasaki Motors Nordic','Retro-style naked, Z-heritage'],
    ['Suzuki GSX-8S',              'Suzuki',  'MC-SUZ-001', 'JS1A7A11XN2000001', 2024, 776,  'Glass Sparkle Black','New',  'Warehouse A', 4, 1, 79000,  95900,  'Suzuki Sverige AB',    'New 2023, parallel-twin naked'],
    ['Yamaha MT-07 (Trade-In)',    'Yamaha',  'MC-YAM-006', 'JYARJ12E3MA100001', 2022, 689,  'Matte Black',      'Trade-In', 'Warehouse C', 1, 0, 52000,  64900,  'Customer',             '14 000 km, one owner, good condition'],
    ['Honda CB750 (Trade-In)',     'Honda',   'MC-HON-004', '1HGDC2161LA200002', 2021, 755,  'White',            'Trade-In', 'Warehouse C', 1, 0, 48000,  59900,  'Customer',             '21 000 km, service book, new tyres'],
]

const company2_sp = [
    ['Yamaha MT-09 Air Filter',    'Yamaha',  'SP-YAM-001', 'Engine',       20, 6,  350,   580,   'Yamaha Motor Sverige', 'OEM air filter for MT-09/XSR900/Tracer 9'],
    ['Yamaha MT-07 Oil Filter',    'Yamaha',  'SP-YAM-002', 'Engine',       30, 10, 95,    175,   'Yamaha Motor Sverige', 'OEM oil filter for MT-07/XSR700/Tracer 7'],
    ['Honda CB750 Hornet Chain',   'Honda',   'SP-HON-001', 'Transmission', 10, 3,  1200,  1900,  'Honda Sverige AB',     'DID chain kit for CB750/CB650'],
    ['Honda Genuine Oil 10W-40',   'Honda',   'SP-HON-002', 'Engine',       40, 12, 120,   210,   'Honda Sverige AB',     '1L Honda Genuine 10W-40 motorcycle oil'],
    ['Kawasaki Z900 Brake Pads',   'Kawasaki','SP-KAW-001', 'Brakes',       18, 6,  380,   650,   'Kawasaki Motors Nordic','OEM front brake pads Z900/Z900RS'],
    ['Kawasaki Ninja 650 Chain',   'Kawasaki','SP-KAW-002', 'Transmission', 12, 4,  980,   1590,  'Kawasaki Motors Nordic','OEM chain and sprocket for Ninja 650'],
    ['Suzuki GSX-8S Spark Plugs',  'Suzuki',  'SP-SUZ-001', 'Engine',       25, 8,  210,   380,   'Suzuki Sverige AB',    'NGK CR9EIA-9 spark plug set (2 pcs)'],
    ['Michelin Road 6 120/70',     'Michelin','SP-MIC-001', 'Tyres & Wheels',12, 3, 1500,  2290,  'Metzeler Nordic AB',   'Sport touring front tyre 120/70 ZR17'],
    ['Michelin Road 6 180/55',     'Michelin','SP-MIC-002', 'Tyres & Wheels',10, 3, 1850,  2790,  'Metzeler Nordic AB',   'Sport touring rear tyre 180/55 ZR17'],
    ['Castrol Power 1 10W-40 4L',  'Castrol', 'SP-CAS-001', 'Engine',       35, 10, 340,   590,   'BikeParts Nordic AB',  '4L semi-synthetic motorcycle engine oil'],
    ['Renthal Twinwall Bars',      'Renthal', 'SP-REN-001', 'Body & Frame', 8,  2,  890,   1390,  'BikeParts Nordic AB',  'Fat Bar handlebar for adventure bikes'],
    ['Yoshimura R-77 Slip-On',     'Yoshimura','SP-YOS-001', 'Exhaust',     5,  1,  4800,  7200,  'BikeParts Nordic AB',  'Stainless slip-on exhaust for MT-07/09'],
    ['Rizoma Mirror Left',         'Rizoma',  'SP-RIZ-001', 'Body & Frame', 10, 3,  780,   1250,  'BikeParts Nordic AB',  'CNC mirror with adapter for naked bikes'],
    ['EBC HH Brake Pads FA418HH',  'EBC',     'SP-EBC-001', 'Brakes',       20, 6,  320,   540,   'BikeParts Nordic AB',  'Sintered double-H compound front pads'],
]

const company2_acc = [
    ['Shark Ridill 2 Helmet',      'Shark',   'ACC-SHA-001', 'Helmet',     'S',  10, 4,  1890,  2890,  'Helmet World AB',    'Shark entry sport helmet, ECE 22.06'],
    ['Shark Ridill 2 Helmet',      'Shark',   'ACC-SHA-002', 'Helmet',     'M',  12, 4,  1890,  2890,  'Helmet World AB',    'Shark entry sport helmet, ECE 22.06'],
    ['Shark Ridill 2 Helmet',      'Shark',   'ACC-SHA-003', 'Helmet',     'L',  8,  3,  1890,  2890,  'Helmet World AB',    'Shark entry sport helmet, ECE 22.06'],
    ['LS2 FF800 Storm II',         'LS2',     'ACC-LS2-001', 'Helmet',     'M',  8,  3,  1650,  2490,  'Helmet World AB',    'Full-face with rear air spoiler'],
    ['Five RFX1 Gloves',           'Five',    'ACC-FIV-001', 'Gloves',     'M',  15, 5,  680,   1090,  'Alpinestars Nordic', 'Sport gloves with D3O knuckle'],
    ['Five RFX1 Gloves',           'Five',    'ACC-FIV-002', 'Gloves',     'L',  12, 4,  680,   1090,  'Alpinestars Nordic', 'Sport gloves with D3O knuckle'],
    ['Rev\'it Tornado 4 Jacket',   'Rev\'it', 'ACC-REV-001', 'Jacket',     'M',  6,  2,  3200,  4890,  'Alpinestars Nordic', 'Mesh jacket with CE Level 2 protectors'],
    ['Rev\'it Tornado 4 Jacket',   'Rev\'it', 'ACC-REV-002', 'Jacket',     'L',  5,  2,  3200,  4890,  'Alpinestars Nordic', 'Mesh jacket with CE Level 2 protectors'],
    ['Sidi Mag-1 Boots',           'Sidi',    'ACC-SID-001', 'Boots',      '42', 5,  2,  2100,  3200,  'Dainese Nordic',     'Racing boots with rear spoiler'],
    ['Sidi Mag-1 Boots',           'Sidi',    'ACC-SID-002', 'Boots',      '43', 6,  2,  2100,  3200,  'Dainese Nordic',     'Racing boots with rear spoiler'],
    ['Kriega US-20 Tail Pack',     'Kriega',  'ACC-KRI-001', 'Luggage',    'One Size', 10, 3, 1250, 1890, 'Oxford Nordic',   '20L waterproof tail bag, MOLLE system'],
    ['Oxford Raider Bungee Net',   'Oxford',  'ACC-OXF-001', 'Luggage',    'One Size', 20, 6, 150,  290,  'Oxford Nordic',   'Elastic cargo net 45x45cm'],
    ['Alpinestars Bionic Neck',    'Alpinestars','ACC-ALP-001','Protection','One Size', 8, 3, 1800, 2790, 'Alpinestars Nordic','CE Level 2 neck brace'],
]

// ─── Company 3: Malmö MC Service Center ───────────────────────────────────────
// Focus: Mixed fleet, heavy trade-ins, service/repairs, Harley + cruiser

const company3_mc = [
    ['Harley-Davidson Sportster S','Harley-Davidson','MC-HD-001','1HD1YRK15NB000001',2024,1252,'Vivid Black',    'New',      'Warehouse A', 3, 1, 169000, 199900, 'Harley-Davidson Norden AB', 'Revolution Max 1250T, 121hp'],
    ['Harley-Davidson Road Glide', 'Harley-Davidson','MC-HD-002','1HD1KRM19NB000002',2024,1868,'Billiard Red',  'New',      'Warehouse A', 2, 1, 299000, 349900, 'Harley-Davidson Norden AB', 'Touring flagship with frame-mount fairing'],
    ['Harley-Davidson Fat Bob 114','Harley-Davidson','MC-HD-003','1HD1GZV14NB000003',2024,1868,'Matte Black',   'New',      'Warehouse B', 2, 1, 199000, 239900, 'Harley-Davidson Norden AB', 'Dark custom with Milwaukee-Eight 114'],
    ['Honda Gold Wing Tour DCT',   'Honda',   'MC-HON-001', '1HGCA2162NA000001', 2024, 1833, 'Pearl Glare White','New',   'Warehouse A', 1, 1, 289000, 339900, 'Honda Sverige AB',     'Ultimate touring with DCT & airbag'],
    ['Royal Enfield Interceptor 650','Royal Enfield','MC-RE-001','ME3ES3538NE000001',2024,648, 'Orange Crush',   'New',      'Warehouse B', 4, 1, 59000,  74900,  'Royal Enfield Nordic', 'Classic parallel-twin, great value'],
    ['Royal Enfield Himalayan 450','Royal Enfield','MC-RE-002','ME3ES3532NE000002',2024,452,  'Forest Green',   'New',      'Warehouse B', 4, 1, 65000,  79900,  'Royal Enfield Nordic', 'New Sherpa engine adventure bike'],
    ['Kawasaki Vulcan S 650',      'Kawasaki','MC-KAW-001', 'JKAZNEC11NA000001', 2024, 649,  'Pearl Flat Stardust Silver','New','Warehouse B',3, 1, 69000,  85900,  'Kawasaki Motors Nordic','Adjustable cruiser, A2 compatible'],
    ['Yamaha V-Star 250',          'Yamaha',  'MC-YAM-001', 'JYAVS250XNA000001', 2024, 249,  'Midnight Black', 'New',      'Warehouse C', 5, 2, 35000,  43900,  'Yamaha Motor Sverige', 'Beginner cruiser, easy first bike'],
    ['Harley-Davidson XL883 (T-I)','Harley-Davidson','MC-HD-004','1HD4CAM11NC000004',2021,883,'Vivid Black',   'Trade-In', 'Warehouse C', 1, 0, 69000,  84900,  'Customer',             '28 000 km, Stage 1 kit, good condition'],
    ['Honda Shadow 750 (T-I)',     'Honda',   'MC-HON-002', '1HGCA2161JA000002', 2019, 745,  'Black',         'Trade-In', 'Warehouse C', 1, 0, 42000,  54900,  'Customer',             '35 000 km, new battery and tyres 2023'],
    ['Royal Enfield Classic 350 (T-I)','Royal Enfield','MC-RE-003','ME3ES3531KE000003',2020,349,'Redditch Blue','Trade-In','Warehouse C',1, 0, 28000, 36900, 'Customer',             '12 000 km, immaculate, barely used'],
    ['Kawasaki W800 (Commission)', 'Kawasaki','MC-KAW-002', 'JKAZNEC13MA000002', 2021, 773,  'Ebony',         'Commission','Warehouse C',1, 0, 89000, 105900, 'Customer',            'Commission sale, 19 000 km, W800 Cafe'],
    ['Harley-Davidson Softail (C)','Harley-Davidson','MC-HD-005','1HD1BVV13MB000005',2021,1868,'Whiskey Sour', 'Commission','Warehouse C',1, 0, 179000,210900,'Customer',             'Commission, 11 000 km, Screamin Eagle exhaust'],
]

const company3_sp = [
    ['Harley-Davidson Oil Filter', 'Harley-Davidson','SP-HD-001','Engine',       20, 6,  280,   490,   'Harley-Davidson Norden AB', 'Genuine HD oil filter, Milwaukee-Eight'],
    ['HD Screamin Eagle Air Cleaner','Harley-Davidson','SP-HD-002','Engine',     6,  2,  1800,  2900,  'Harley-Davidson Norden AB', 'High-flow air cleaner kit'],
    ['HD Sportster S Brake Pads',  'Harley-Davidson','SP-HD-003','Brakes',       10, 3,  480,   790,   'Harley-Davidson Norden AB', 'OEM brake pads for Sportster S'],
    ['Honda Gold Wing Air Filter', 'Honda',   'SP-HON-001', 'Engine',       8,  2,  680,   1090,  'Honda Sverige AB',     'OEM air filter for Gold Wing 1800'],
    ['Royal Enfield 650 Chain Kit','Royal Enfield','SP-RE-001','Transmission', 15, 4,  780,   1290,  'Royal Enfield Nordic', 'Chain and sprocket set for 650 twin'],
    ['Royal Enfield 650 Oil Filter','Royal Enfield','SP-RE-002','Engine',      30, 8,  95,    180,   'Royal Enfield Nordic', 'OEM oil filter for 350/650/Himalayan'],
    ['Kawasaki Vulcan Tyres 150/80','Kawasaki','SP-KAW-001','Tyres & Wheels',6, 2,  1350,  2100,  'Metzeler Nordic AB',   'Cruiser rear tyre 150/80-16'],
    ['Metzeler ME888 Marathon 130/90','Metzeler','SP-MET-001','Tyres & Wheels',8, 2, 1450, 2250,  'Metzeler Nordic AB',   'Cruiser front tyre 130/90-16'],
    ['Drag Specialties Handlebar',  'Drag Specialties','SP-DS-001','Body & Frame',6, 2, 890, 1490, 'Harley-Davidson Norden AB','Ape hanger bars for Sportster/Dyna'],
    ['S&S Cycle Breather Kit',     'S&S Cycle','SP-SS-001',  'Engine',       5,  1,  1200,  1990,  'Harley-Davidson Norden AB','Breather system for Big Twin engines'],
    ['Harley V-Twin Primary Chain','Harley-Davidson','SP-HD-004','Transmission',8, 2, 650,   1100,  'Harley-Davidson Norden AB','Primary chain for Big Twin 1999-2006'],
    ['Vance & Hines Big Radius 2:2','Vance & Hines','SP-VH-001','Exhaust',    3,  1,  5800,  8900,  'Harley-Davidson Norden AB','Chrome 2-into-2 exhaust for Softail'],
    ['Chrome Fuel Cap HD Softail', 'Harley-Davidson','SP-HD-005','Fuel System', 10, 3, 680,   1190,  'Harley-Davidson Norden AB','OEM chrome fuel cap with locking'],
    ['EBC FA409HH Brake Pads',     'EBC',     'SP-EBC-001',  'Brakes',       15, 5,  350,   590,   'BikeParts Nordic AB',  'Sintered HH pads for HD Touring models'],
]

const company3_acc = [
    ['Bell Bullitt Helmet',        'Bell',    'ACC-BEL-001', 'Helmet',     'M',  6,  2,  3200,  4890,  'Helmet World AB',    'Retro full-face for cruiser riders'],
    ['Bell Bullitt Helmet',        'Bell',    'ACC-BEL-002', 'Helmet',     'L',  5,  2,  3200,  4890,  'Helmet World AB',    'Retro full-face for cruiser riders'],
    ['Bell Custom 500 Open Face',  'Bell',    'ACC-BEL-003', 'Helmet',     'M',  8,  3,  2100,  3200,  'Helmet World AB',    'Classic open-face with visor'],
    ['Harley-Davidson B09 Jacket', 'Harley-Davidson','ACC-HD-001','Jacket', 'M',  4,  1,  4500,  6800,  'Harley-Davidson Norden AB','Leather jacket with HD branding'],
    ['Harley-Davidson B09 Jacket', 'Harley-Davidson','ACC-HD-002','Jacket', 'L',  3,  1,  4500,  6800,  'Harley-Davidson Norden AB','Leather jacket with HD branding'],
    ['Hestra Biker Gloves',        'Hestra',  'ACC-HES-001', 'Gloves',     'M',  10, 3,  890,   1390,  'Alpinestars Nordic', 'Swedish leather cruiser gloves'],
    ['Hestra Biker Gloves',        'Hestra',  'ACC-HES-002', 'Gloves',     'L',  8,  3,  890,   1390,  'Alpinestars Nordic', 'Swedish leather cruiser gloves'],
    ['TCX X-Five Waterproof Boots','TCX',     'ACC-TCX-001', 'Boots',      '43', 6,  2,  1650,  2490,  'Dainese Nordic',     'Waterproof touring boots'],
    ['TCX X-Five Waterproof Boots','TCX',     'ACC-TCX-002', 'Boots',      '44', 5,  2,  1650,  2490,  'Dainese Nordic',     'Waterproof touring boots'],
    ['Harley-Davidson Cap Classic','Harley-Davidson','ACC-HD-003','Cap',    'One Size', 20, 6, 250, 450, 'Harley-Davidson Norden AB','Official HD cap, cotton'],
    ['Scarf HD Bar & Shield',      'Harley-Davidson','ACC-HD-004','Neck & Face','One Size', 15, 5, 180, 320, 'Harley-Davidson Norden AB','Official HD neck gaiter'],
    ['Givi E45N Topcase',          'Givi',    'ACC-GIV-001', 'Luggage',    'One Size', 4, 1, 2100, 3200, 'Oxford Nordic',     '45L topcase with plate, monokey system'],
    ['Nelson-Rigg Cruiser Bag',    'Nelson-Rigg','ACC-NR-001','Luggage',   'One Size', 6, 2, 980, 1590, 'Oxford Nordic',     'Throw-over saddlebag 20L each side'],
]

// ─── Generate files ───────────────────────────────────────────────────────────

const companies = [
    { name: 'Stockholm_Premium_Moto',   mc: company1_mc, sp: company1_sp, acc: company1_acc },
    { name: 'Goteborg_Bikes_and_More',  mc: company2_mc, sp: company2_sp, acc: company2_acc },
    { name: 'Malmo_MC_Service_Center',  mc: company3_mc, sp: company3_sp, acc: company3_acc },
]

companies.forEach(({ name, mc, sp, acc }) => {
    const wb  = makeWorkbook(mc, sp, acc)
    const out = path.join(outDir, `${name}_Inventory.xlsx`)
    XLSX.writeFile(wb, out)
    console.log(`✅ Created: ${out}`)
    console.log(`   Motorcycles: ${mc.length} | Spare Parts: ${sp.length} | Accessories: ${acc.length}`)
})

console.log('\n📁 Files saved to: public/sample-data/')
