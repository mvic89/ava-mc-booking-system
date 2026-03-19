/**
 * Company 4: Västerås Motorsport AB
 * Focus: Italian brands (Aprilia, Vespa, Moto Guzzi) + Indian + Husqvarna + Can-Am
 *
 * ALL supplier names are intentionally different from Companies 1–3.
 * Avoided: BMW Motorrad Sverige, Ducati Sverige AB, KTM Nordic AB, Triumph Scandinavia,
 *           Yamaha Motor Sverige, Honda Sverige AB, Kawasaki Motors Nordic, Suzuki Sverige AB,
 *           Harley-Davidson Norden AB, Royal Enfield Nordic, Metzeler Nordic AB,
 *           BikeParts Nordic AB, BikeParts Premium AB, Alpinestars Nordic, Dainese Nordic,
 *           Helmet World AB, Oxford Nordic, Michelin Nordic AB, Castrol Sverige, Renthal Nordic,
 *           Öhlins Sverige, Akrapovic Nordic
 *
 * Run: node scripts/generate-company4-data.mjs
 */

import * as XLSX from 'xlsx'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'public', 'sample-data')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

// ─── Inventory ────────────────────────────────────────────────────────────────

const motorcycles = [
    ['Aprilia RS 660',              'Aprilia',    'MC-APR-001', 'ZD4KEB00XNA000001', 2024, 659,  'Acid Gold',          'New',       'Warehouse A', 4, 1, 99000,  119900, 'Aprilia Nordic AB',         'Mid-weight supersport, 100hp parallel twin'],
    ['Aprilia Tuono 660',           'Aprilia',    'MC-APR-002', 'ZD4KEB00XNA000002', 2024, 659,  'Acid Gold',          'New',       'Warehouse A', 5, 2, 99000,  119900, 'Aprilia Nordic AB',         'Naked sport, RS 660 platform with wide bars'],
    ['Aprilia RSV4 Factory',        'Aprilia',    'MC-APR-003', 'ZD4RBC00XNA000003', 2024, 1099, 'Aprilia Black',      'New',       'Warehouse A', 2, 1, 219000, 259900, 'Aprilia Nordic AB',         '220hp superbike with APRC electronics suite'],
    ['Aprilia Tuareg 660',          'Aprilia',    'MC-APR-004', 'ZD4KGB00XNA000004', 2024, 659,  'Desert Beige',       'New',       'Warehouse B', 3, 1, 119000, 139900, 'Aprilia Nordic AB',         'Adventure bike, Dakar-inspired lightweight'],
    ['Vespa GTS 300 SuperTech',     'Vespa',      'MC-VES-001', 'ZAPM45200NA000001', 2024, 278,  'Nero Grafite',       'New',       'Warehouse B', 6, 2, 52000,  64900,  'Piaggio Scandinavia AB',    'Premium maxi scooter, 300cc HPE engine'],
    ['Vespa GTV 300',               'Vespa',      'MC-VES-002', 'ZAPM45201NA000002', 2024, 278,  'Azzurro Incanto',    'New',       'Warehouse B', 4, 1, 55000,  68900,  'Piaggio Scandinavia AB',    'Vintage styling, modern technology'],
    ['Vespa Primavera 125 S',       'Vespa',      'MC-VES-003', 'ZAPM45202NA000003', 2024, 125,  'Rosa Chiaro',        'New',       'Warehouse C', 8, 3, 32000,  39900,  'Piaggio Scandinavia AB',    'Classic 125cc scooter, A1 licence'],
    ['Moto Guzzi V7 Stone',         'Moto Guzzi', 'MC-MGZ-001', 'ZGULNB00XNA000001', 2024, 853,  'Nero Ruvido',        'New',       'Warehouse B', 4, 1, 89000,  109900, 'Piaggio Scandinavia AB',    'Iconic V-twin roadster, timeless styling'],
    ['Moto Guzzi V85 TT Travel',    'Moto Guzzi', 'MC-MGZ-002', 'ZGULVB00XNA000002', 2024, 853,  'Verde Altaj',        'New',       'Warehouse B', 2, 1, 119000, 139900, 'Piaggio Scandinavia AB',    'Retro adventure, 80hp V-twin, saddlebags incl.'],
    ['Moto Guzzi V100 Mandello',    'Moto Guzzi', 'MC-MGZ-003', 'ZGULWB00XNA000003', 2024, 1042, 'Grigio Assoluto',    'New',       'Warehouse A', 2, 1, 149000, 174900, 'Piaggio Scandinavia AB',    'New gen sport tourer, active aero wings'],
    ['Indian Scout Classic',        'Indian',     'MC-IND-001', '56KMSA002N3000001', 2024, 1133, 'Spirit Blue',        'New',       'Warehouse A', 3, 1, 149000, 174900, 'Indian Motorcycle Sverige AB','Thunder Stroke 116, premium cruiser'],
    ['Indian FTR Sport',            'Indian',     'MC-IND-002', '56KMSA003N3000002', 2024, 1203, 'Titanium Smoke',     'New',       'Warehouse A', 2, 1, 139000, 164900, 'Indian Motorcycle Sverige AB','Flat track inspired, 120hp'],
    ['Husqvarna Norden 901',        'Husqvarna',  'MC-HUS-001', 'VN1RKA01XN0000001', 2024, 889,  'Stone Grey',         'New',       'Warehouse B', 4, 1, 119000, 139900, 'Husqvarna Moto Scandinavia', 'Adventure tourer with TFT, cornering ABS'],
    ['Husqvarna Vitpilen 701',      'Husqvarna',  'MC-HUS-002', 'VN1RGA01XN0000002', 2024, 693,  'Black',              'New',       'Warehouse B', 3, 1, 99000,  119900, 'Husqvarna Moto Scandinavia', 'LC4 single, stripped naked cafe racer'],
    ['Aprilia RS 660 (Trade-In)',   'Aprilia',    'MC-APR-005', 'ZD4KEB00XLA000099', 2021, 659,  'Lava Red',           'Trade-In',  'Warehouse C', 1, 0, 68000,  82900,  'Customer',                  '17 000 km, Akra exhaust, full service history'],
    ['Indian Scout (Trade-In)',     'Indian',     'MC-IND-003', '56KMSA002J3000099', 2018, 1133, 'Thunder Black',      'Trade-In',  'Warehouse C', 1, 0, 89000,  109900, 'Customer',                  '31 000 km, leather saddlebags, crashbars'],
]

const spareParts = [
    ['Aprilia RS/Tuono 660 Air Filter',     'Aprilia',    'SP-APR-001', 'Engine',        20, 6,  380,   640,   'Aprilia Nordic AB',          'OEM air filter for RS 660 / Tuono 660'],
    ['Aprilia RSV4 Brake Pads Front',       'Aprilia',    'SP-APR-002', 'Brakes',        12, 4,  580,   950,   'Aprilia Nordic AB',          'Brembo OEM pads for RSV4 front caliper'],
    ['Aprilia 660 Oil Service Kit',         'Aprilia',    'SP-APR-003', 'Engine',        10, 3,  790,   1290,  'Aprilia Nordic AB',          'Oil + filter + drain plug kit for 660 twin'],
    ['Vespa GTS 300 Drive Belt',            'Vespa',      'SP-VES-001', 'Transmission',  15, 5,  480,   790,   'Piaggio Scandinavia AB',     'OEM drive belt for GTS 300 HPE'],
    ['Vespa Primavera 125 Spark Plug',      'Vespa',      'SP-VES-002', 'Engine',        40, 12, 95,    175,   'Piaggio Scandinavia AB',     'NGK iridium spark plug for Primavera 125/150'],
    ['Moto Guzzi V7/V85 Oil Filter',        'Moto Guzzi', 'SP-MGZ-001', 'Engine',        25, 8,  180,   320,   'Piaggio Scandinavia AB',     'OEM oil filter for all V7 and V85 models'],
    ['Moto Guzzi V7 Chain Kit',             'Moto Guzzi', 'SP-MGZ-002', 'Transmission',  10, 3,  1100,  1790,  'Piaggio Scandinavia AB',     'DID chain and Regina sprocket set'],
    ['Indian Scout Thunder Stroke Pads',    'Indian',     'SP-IND-001', 'Brakes',        10, 3,  520,   890,   'Indian Motorcycle Sverige AB','Genuine Indian front + rear brake pads'],
    ['Indian Scout Engine Oil 20W-50',      'Indian',     'SP-IND-002', 'Engine',        30, 10, 220,   390,   'Indian Motorcycle Sverige AB','4L Indian Genuine V-twin engine oil'],
    ['Husqvarna Norden 901 Chain Kit',      'Husqvarna',  'SP-HUS-001', 'Transmission',  8,  2,  1200,  1990,  'Husqvarna Moto Scandinavia', 'OEM chain, front and rear sprocket set'],
    ['Husqvarna Vitpilen 701 Air Filter',   'Husqvarna',  'SP-HUS-002', 'Engine',        15, 5,  350,   590,   'Husqvarna Moto Scandinavia', 'OEM air filter for Vitpilen/Svartpilen 701'],
    ['Pirelli Angel GT II 120/70',          'Pirelli',    'SP-PIR-001', 'Tyres & Wheels',12, 3,  1490,  2290,  'Pirelli Sverige AB',         'Sport touring front tyre 120/70 ZR17'],
    ['Pirelli Angel GT II 180/55',          'Pirelli',    'SP-PIR-002', 'Tyres & Wheels',10, 3,  1790,  2690,  'Pirelli Sverige AB',         'Sport touring rear tyre 180/55 ZR17'],
    ['Pirelli Scorpion Trail II 110/80',    'Pirelli',    'SP-PIR-003', 'Tyres & Wheels',8,  2,  1390,  2090,  'Pirelli Sverige AB',         'Adventure front tyre for Norden/V85TT'],
    ['Motul 7100 10W-40 4L',                'Motul',      'SP-MOT-001', 'Engine',        35, 10, 380,   649,   'Motul Sverige AB',           '4L fully synthetic 4T motorcycle oil'],
    ['Motul RBF 660 Brake Fluid',           'Motul',      'SP-MOT-002', 'Brakes',        25, 8,  145,   249,   'Motul Sverige AB',           '500ml DOT 4 racing brake fluid'],
    ['Arrow Dark Slip-On Aprilia 660',      'Arrow',      'SP-ARR-001', 'Exhaust',       5,  1,  4900,  7400,  'SwedeParts Distribution AB', 'Dark Line titanium slip-on for RS/Tuono 660'],
    ['Givi Monokey Top Case Plate',         'Givi',       'SP-GIV-001', 'Body & Frame',  10, 3,  680,   1090,  'SwedeParts Distribution AB', 'Top case mounting plate, Monokey system'],
]

const accessories = [
    ['Schuberth C5 Helmet',            'Schuberth', 'ACC-SCH-001', 'Helmet',     'S',       6,  2,  4800,  7200,  'Schuberth Sverige AB',       'Premium flip-up helmet, integrated comm prep'],
    ['Schuberth C5 Helmet',            'Schuberth', 'ACC-SCH-002', 'Helmet',     'M',       8,  3,  4800,  7200,  'Schuberth Sverige AB',       'Premium flip-up helmet, integrated comm prep'],
    ['Schuberth C5 Helmet',            'Schuberth', 'ACC-SCH-003', 'Helmet',     'L',       6,  2,  4800,  7200,  'Schuberth Sverige AB',       'Premium flip-up helmet, integrated comm prep'],
    ['Nolan N60-6 Sport Helmet',       'Nolan',     'ACC-NOL-001', 'Helmet',     'M',       10, 4,  1890,  2890,  'Schuberth Sverige AB',       'Open face with peak, ECE 22.06 certified'],
    ['Nolan N60-6 Sport Helmet',       'Nolan',     'ACC-NOL-002', 'Helmet',     'L',       8,  3,  1890,  2890,  'Schuberth Sverige AB',       'Open face with peak, ECE 22.06 certified'],
    ['Rev\'it Sand 4 H2O Jacket',      'Rev\'it',   'ACC-REV-001', 'Jacket',     'M',       5,  2,  4200,  6200,  'Rev\'it Scandinavia AB',     'Waterproof adventure jacket, Gore-Tex'],
    ['Rev\'it Sand 4 H2O Jacket',      'Rev\'it',   'ACC-REV-002', 'Jacket',     'L',       4,  1,  4200,  6200,  'Rev\'it Scandinavia AB',     'Waterproof adventure jacket, Gore-Tex'],
    ['Rev\'it Torque 3 Boots',         'Rev\'it',   'ACC-REV-003', 'Boots',      '42',      6,  2,  2600,  3890,  'Rev\'it Scandinavia AB',     'Racing boots, CE Category II'],
    ['Rev\'it Torque 3 Boots',         'Rev\'it',   'ACC-REV-004', 'Boots',      '44',      5,  2,  2600,  3890,  'Rev\'it Scandinavia AB',     'Racing boots, CE Category II'],
    ['Icon Airflite Helmet',           'Icon',      'ACC-ICO-001', 'Helmet',     'M',       8,  3,  2200,  3390,  'Icon Motosports Nordic',     'Fibreglass full-face, MIPS optional'],
    ['Icon Airflite Helmet',           'Icon',      'ACC-ICO-002', 'Helmet',     'L',       6,  2,  2200,  3390,  'Icon Motosports Nordic',     'Fibreglass full-face, MIPS optional'],
    ['Icon Anthem 2 Jacket',           'Icon',      'ACC-ICO-003', 'Jacket',     'M',       6,  2,  2800,  4290,  'Icon Motosports Nordic',     'Leather jacket with D3O CE Level 2'],
    ['Icon Anthem 2 Jacket',           'Icon',      'ACC-ICO-004', 'Jacket',     'L',       4,  1,  2800,  4290,  'Icon Motosports Nordic',     'Leather jacket with D3O CE Level 2'],
    ['Givi Trekker Outback 48L',       'Givi',      'ACC-GIV-001', 'Luggage',    'One Size', 6, 2,  3200,  4800,  'Givi Scandinavia AB',        'Aluminium top case, Monokey mount'],
    ['Givi V35 Side Cases Pair',       'Givi',      'ACC-GIV-002', 'Luggage',    'One Size', 4, 1,  3800,  5600,  'Givi Scandinavia AB',        '35L side cases, Monolock, incl. frames'],
    ['Vespa GTS Cover Original',       'Vespa',     'ACC-VES-001', 'Other',      'One Size', 12, 4, 680,   990,   'Piaggio Scandinavia AB',     'OEM outdoor cover for Vespa GTS/GTV'],
    ['Indian Accessories Phone Mount', 'Indian',    'ACC-IND-001', 'Other',      'One Size', 10, 3, 450,   750,   'Indian Motorcycle Sverige AB','RAM mount kit for FTR/Scout handlebars'],
]

// ─── Suppliers ────────────────────────────────────────────────────────────────

const suppliers = [
    ['Aprilia Nordic AB',              'contact@aprilianordic.se',       'Mälarvägen 12, 721 30 Västerås',         '+46 21 456 7890', '556234-5678', 'Marco Rossi',       'SE5678901234', 'Nordea',          'www.aprilianordic.se', 12000, 'Motorcycles, Spare Parts'],
    ['Piaggio Scandinavia AB',         'info@piaggioscandinavia.se',      'Ringvägen 5, 702 15 Örebro',             '+46 19 234 5678', '556345-6789', 'Sofia Lindgren',    'SE6789012345', 'SEB',             'www.piaggioscandinavia.se', 15000, 'Motorcycles, Spare Parts, Accessories'],
    ['Indian Motorcycle Sverige AB',   'sales@indianmotorcycle.se',       'Kungsgatan 88, 411 19 Göteborg',         '+46 31 567 8901', '556456-7890', 'Anders Holm',       'SE7890123456', 'Handelsbanken',   'www.indianmotorcycle.se', 20000, 'Motorcycles, Spare Parts, Accessories'],
    ['Husqvarna Moto Scandinavia',     'order@husqvarnamoto.se',          'Fabriksvägen 3, 281 23 Hässleholm',      '+46 451 345 678', '556567-8901', 'Emma Johansson',    'SE8901234567', 'Swedbank',        'www.husqvarnamoto.se', 10000, 'Motorcycles, Spare Parts'],
    ['Pirelli Sverige AB',             'tyres@pirelli.se',                'Industrigatan 44, 211 24 Malmö',         '+46 40 678 9012', '556678-9012', 'Luca Ferrari',      'SE9012345678', 'Nordea',          'www.pirelli.se', 8000, 'Spare Parts'],
    ['Motul Sverige AB',               'lubrifiants@motul.se',            'Brommaplan 7, 168 67 Stockholm',         '+46 8 890 1234',  '556789-0123', 'Nathalie Persson',  'SE0123456789', 'SEB',             'www.motul.se', 5000, 'Spare Parts'],
    ['SwedeParts Distribution AB',     'info@swedeparts.se',              'Lagervägen 22, 603 40 Norrköping',       '+46 11 901 2345', '556890-1234', 'Johan Eriksson',    'SE1234567890', 'Handelsbanken',   'www.swedeparts.se', 7500, 'Spare Parts'],
    ['Schuberth Sverige AB',           'helmets@schuberth.se',            'Drottninggatan 55, 252 23 Helsingborg',  '+46 42 123 4567', '556901-2345', 'Hanna Svensson',    'SE2345678901', 'Swedbank',        'www.schuberth.se', 6000, 'Accessories'],
    ['Rev\'it Scandinavia AB',         'gear@revitscandinavia.se',        'Stortorget 9, 581 17 Linköping',         '+46 13 234 5678', '557012-3456', 'Daniel Magnusson',  'SE3456789012', 'Nordea',          'www.revitscandinavia.se', 9000, 'Accessories'],
    ['Icon Motosports Nordic',         'sales@iconmotosports.se',         'Vasagatan 14, 411 24 Göteborg',          '+46 31 345 6789', '557123-4567', 'Sara Nilsson',      'SE4567890123', 'SEB',             'www.iconmotosports.se', 7000, 'Accessories'],
    ['Givi Scandinavia AB',            'luggage@giviscandinavia.se',      'Hamngatan 3, 111 47 Stockholm',          '+46 8 456 7890',  '557234-5678', 'Matteo Colombo',    'SE5678901234', 'Handelsbanken',   'www.giviscandinavia.se', 5500, 'Accessories, Spare Parts'],
    ['Moto Guzzi Sverige',             'guzzi@motoguzzi.se',              'Biblioteksgatan 12, 114 46 Stockholm',   '+46 8 567 8901',  '557345-6789', 'Giulia Mancini',    'SE6789012345', 'Swedbank',        '', 10000, 'Motorcycles'],
    ['Nordic Moto Accessories',        'info@nordicmoto.se',              'Industristigen 8, 931 36 Skellefteå',    '+46 910 678 901', '557456-7890', 'Lars Gustafsson',   'SE7890123456', 'Nordea',          'www.nordicmoto.se', 4000, 'Accessories, Spare Parts'],
]

// ─── Write files ──────────────────────────────────────────────────────────────

// --- Inventory workbook ---
const mcHeaders  = [['Name','Brand','Article Number','VIN','Year','Engine CC','Color','MC Type','Warehouse','Stock','Reorder Qty','Cost','Selling Price','Vendor','Description']]
const spHeaders  = [['Name','Brand','Article Number','Category','Stock','Reorder Qty','Cost','Selling Price','Vendor','Description']]
const accHeaders = [['Name','Brand','Article Number','Category','Size','Stock','Reorder Qty','Cost','Selling Price','Vendor','Description']]

const invWb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(invWb, XLSX.utils.aoa_to_sheet([...mcHeaders,  ...motorcycles]), 'Motorcycles')
XLSX.utils.book_append_sheet(invWb, XLSX.utils.aoa_to_sheet([...spHeaders,  ...spareParts]),  'Spare Parts')
XLSX.utils.book_append_sheet(invWb, XLSX.utils.aoa_to_sheet([...accHeaders, ...accessories]), 'Accessories')

const invOut = path.join(outDir, 'Vasteras_Motorsport_Inventory.xlsx')
XLSX.writeFile(invWb, invOut)
console.log(`✅ Created: ${invOut}`)
console.log(`   Motorcycles: ${motorcycles.length} | Spare Parts: ${spareParts.length} | Accessories: ${accessories.length}`)

// --- Supplier workbook ---
const supHeaders = [['Supplier Name','Email','Address','Phone','Org Number','Contact Person','Bank Account','Bank Name','Website','Free Shipping Threshold','Categories']]

const supWb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(supWb, XLSX.utils.aoa_to_sheet([...supHeaders, ...suppliers]), 'Suppliers')

const supOut = path.join(outDir, 'Vasteras_Motorsport_Suppliers.xlsx')
XLSX.writeFile(supWb, supOut)
console.log(`✅ Created: ${supOut}`)
console.log(`   Suppliers: ${suppliers.length}`)

console.log('\n📁 Files saved to: public/sample-data/')
console.log('\n✅ All supplier names are NEW — no overlap with Companies 1–3.')
