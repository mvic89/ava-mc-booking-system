import * as XLSX from 'xlsx'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'public', 'sample-data')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

// All suppliers share this contact email as requested
const EMAIL = 'svpriyaa2808@gmail.com'

// Headers: Name | Email | Address | Phone | Org Number | Contact Person | Bank Account | Bank Name | Website | Free Shipping (SEK) | Categories
const HEADERS = [
    'Supplier Name',
    'Email',
    'Address',
    'Phone',
    'Org Number',
    'Contact Person',
    'Bank Account',
    'Bank Name',
    'Website',                   // optional
    'Free Shipping Threshold',
    'Categories',
]

// ─── Company 1: Stockholm Premium Moto ────────────────────────────────────────
// Suppliers: BMW, Ducati, KTM, Triumph, accessories specialists

const company1_suppliers = [
    ['BMW Motorrad Sverige',    EMAIL, 'Lindhagensgatan 110, 112 51 Stockholm',  '+46 8 444 88 00', '556004-2826', 'Lars Eriksson',    'SE2650000000501234567890', 'Handelsbanken', 'www.bmwmotorrad.se',          15000, 'Motorcycles,Spare Parts'],
    ['Ducati Sverige AB',       EMAIL, 'Flygfältsgatan 5, 423 37 Göteborg',      '+46 31 727 40 00','556789-1234', 'Marco Rossi',      'SE2650000000601234567890', 'SEB',           'www.ducati.se',               12000, 'Motorcycles,Spare Parts'],
    ['KTM Nordic AB',           EMAIL, 'Industrigatan 4, 254 67 Helsingborg',    '+46 42 490 80 00','556321-5678', 'Anna Björklund',   'SE2650000000701234567890', 'Swedbank',      'www.ktm.com/se',              10000, 'Motorcycles,Spare Parts'],
    ['Triumph Scandinavia',     EMAIL, 'Kungsgatan 34, 111 35 Stockholm',        '+46 8 555 22 00', '556654-9012', 'James Thornton',   'SE2650000000801234567890', 'Handelsbanken', 'www.triumph.se',              12000, 'Motorcycles,Spare Parts'],
    ['BikeParts Premium AB',    EMAIL, 'Lagervägen 12, 175 62 Järfälla',         '+46 8 580 100 00','556112-3344', 'Sofia Lindqvist',  'SE2650000000901234567890', 'Nordea',        'www.bikeparts-premium.se',    5000,  'Spare Parts,Accessories'],
    ['Öhlins Sverige',          EMAIL, 'Ängsvägen 10, 192 78 Sollentuna',        '+46 8 590 025 00','556013-0156', 'Peter Holm',       'SE2650000001001234567890', 'SEB',           'www.ohlins.com',              8000,  'Spare Parts'],
    ['Akrapovic Nordic',        EMAIL, 'Exportgatan 6, 422 46 Göteborg',         '+46 31 840 50 00','556900-1122', 'Emil Kovač',       'SE2650000001101234567890', 'Swedbank',      'www.akrapovic.com',           6000,  'Spare Parts'],
    ['Metzeler Nordic AB',      EMAIL, 'Hejargatan 2, 602 21 Norrköping',        '+46 11 230 10 00','556445-7788', 'Helena Gustafsson','SE2650000001201234567890', 'Nordea',        'www.metzeler.com',            4000,  'Spare Parts'],
    ['Helmet World AB',         EMAIL, 'Storgatan 58, 211 24 Malmö',             '+46 40 611 20 00','556234-9988', 'Marcus Persson',   'SE2650000001301234567890', 'Handelsbanken', 'www.helmetworld.se',          3000,  'Accessories'],
    ['Alpinestars Nordic',      EMAIL, 'Röntgengatan 5, 721 87 Västerås',        '+46 21 490 30 00','556567-4433', 'Carla Mancini',    'SE2650000001401234567890', 'SEB',           'www.alpinestars.com',         5000,  'Accessories'],
    ['Dainese Nordic',          EMAIL, 'Teknikringen 7, 583 30 Linköping',       '+46 13 214 40 00','556789-5544', 'Luca Ferrari',     'SE2650000001501234567890', 'Swedbank',      '',                            4000,  'Accessories'],
    ['Oxford Nordic',           EMAIL, 'Industrivägen 20, 194 61 Upplands Väsby','+46 8 590 200 00','556333-6677', 'Ingrid Carlsson',  'SE2650000001601234567890', 'Nordea',        'www.oxford-products.com',     2500,  'Accessories,Spare Parts'],
    ['SW-Motech Nordic',        EMAIL, 'Magnetgatan 12, 216 16 Limhamn',         '+46 40 630 50 00','556455-8899', 'Klaus Weber',      'SE2650000001701234567890', 'Handelsbanken', 'www.sw-motech.com',           3500,  'Accessories'],
]

// ─── Company 2: Göteborg Bikes & More ─────────────────────────────────────────
// Suppliers: Yamaha, Honda, Kawasaki, Suzuki, accessories

const company2_suppliers = [
    ['Yamaha Motor Sverige',    EMAIL, 'Armégatan 38, 171 71 Solna',             '+46 8 449 20 00', '556065-1835', 'Mikael Strand',    'SE2650000002001234567890', 'Handelsbanken', 'www.yamaha-motor.se',         10000, 'Motorcycles,Spare Parts'],
    ['Honda Sverige AB',        EMAIL, 'Johanneslundsvägen 3, 194 81 Upplands Väsby','+46 8 590 860 00','556016-7800','Erik Lindberg', 'SE2650000002101234567890', 'SEB',           'www.honda.se',                8000,  'Motorcycles,Spare Parts'],
    ['Kawasaki Motors Nordic',  EMAIL, 'Aminogatan 25, 431 53 Mölndal',          '+46 31 706 90 00','556234-5678', 'Tobias Ahl',       'SE2650000002201234567890', 'Swedbank',      'www.kawasaki.se',             9000,  'Motorcycles,Spare Parts'],
    ['Suzuki Sverige AB',       EMAIL, 'Polygonvägen 15, 187 66 Täby',           '+46 8 510 600 00','556445-3322', 'Yuki Tanaka',      'SE2650000002301234567890', 'Nordea',        'www.suzuki.se',               7500,  'Motorcycles,Spare Parts'],
    ['Metzeler Nordic AB',      EMAIL, 'Hejargatan 2, 602 21 Norrköping',        '+46 11 230 10 00','556445-7788', 'Helena Gustafsson','SE2650000002401234567890', 'Nordea',        'www.metzeler.com',            4000,  'Spare Parts'],
    ['BikeParts Nordic AB',     EMAIL, 'Importgatan 3, 422 46 Göteborg',         '+46 31 840 30 00','556678-1234', 'Maja Nilsson',     'SE2650000002501234567890', 'SEB',           'www.bikeparts-nordic.se',     4500,  'Spare Parts,Accessories'],
    ['Helmet World AB',         EMAIL, 'Storgatan 58, 211 24 Malmö',             '+46 40 611 20 00','556234-9988', 'Marcus Persson',   'SE2650000002601234567890', 'Handelsbanken', 'www.helmetworld.se',          3000,  'Accessories'],
    ['Alpinestars Nordic',      EMAIL, 'Röntgengatan 5, 721 87 Västerås',        '+46 21 490 30 00','556567-4433', 'Carla Mancini',    'SE2650000002701234567890', 'SEB',           'www.alpinestars.com',         5000,  'Accessories'],
    ['Dainese Nordic',          EMAIL, 'Teknikringen 7, 583 30 Linköping',       '+46 13 214 40 00','556789-5544', 'Luca Ferrari',     'SE2650000002801234567890', 'Swedbank',      '',                            4000,  'Accessories'],
    ['Oxford Nordic',           EMAIL, 'Industrivägen 20, 194 61 Upplands Väsby','+46 8 590 200 00','556333-6677', 'Ingrid Carlsson',  'SE2650000002901234567890', 'Nordea',        'www.oxford-products.com',     2500,  'Accessories,Spare Parts'],
    ['Michelin Nordic AB',      EMAIL, 'Löfströms Allé 5, 172 66 Sundbyberg',    '+46 8 449 90 00', '556112-8877', 'Christophe Dubois','SE2650000003001234567890', 'Handelsbanken', 'www.michelin.se',             5000,  'Spare Parts'],
    ['Castrol Sverige',         EMAIL, 'Klarabergsviadukten 70, 111 64 Stockholm','+46 8 771 80 00','556009-1234', 'Diana Berg',       'SE2650000003101234567890', 'SEB',           'www.castrol.com/sv',          2000,  'Spare Parts'],
    ['Renthal Nordic',          EMAIL, 'Svetsarvägen 15, 171 41 Solna',          '+46 8 730 40 00', '556901-2233', 'Kevin Harris',     'SE2650000003201234567890', 'Swedbank',      'www.renthal.com',             3000,  'Spare Parts'],
]

// ─── Company 3: Malmö MC Service Center ───────────────────────────────────────
// Suppliers: Harley-Davidson, Royal Enfield, cruiser specialists

const company3_suppliers = [
    ['Harley-Davidson Norden AB',EMAIL, 'Florettgatan 29C, 254 67 Helsingborg',  '+46 42 240 88 00','556503-2289', 'Brad Johnson',     'SE2650000004001234567890', 'Handelsbanken', 'www.harley-davidson.se',      20000, 'Motorcycles,Spare Parts,Accessories'],
    ['Honda Sverige AB',        EMAIL, 'Johanneslundsvägen 3, 194 81 Upplands Väsby','+46 8 590 860 00','556016-7800','Erik Lindberg', 'SE2650000004101234567890', 'SEB',           'www.honda.se',                8000,  'Motorcycles,Spare Parts'],
    ['Royal Enfield Nordic',    EMAIL, 'Bangårdsgatan 8, 753 20 Uppsala',        '+46 18 480 30 00','556812-3344', 'Priya Sharma',     'SE2650000004201234567890', 'Nordea',        'www.royalenfield.com/se',     5000,  'Motorcycles,Spare Parts'],
    ['Kawasaki Motors Nordic',  EMAIL, 'Aminogatan 25, 431 53 Mölndal',          '+46 31 706 90 00','556234-5678', 'Tobias Ahl',       'SE2650000004301234567890', 'Swedbank',      'www.kawasaki.se',             9000,  'Motorcycles,Spare Parts'],
    ['Metzeler Nordic AB',      EMAIL, 'Hejargatan 2, 602 21 Norrköping',        '+46 11 230 10 00','556445-7788', 'Helena Gustafsson','SE2650000004401234567890', 'Nordea',        'www.metzeler.com',            4000,  'Spare Parts'],
    ['BikeParts Nordic AB',     EMAIL, 'Importgatan 3, 422 46 Göteborg',         '+46 31 840 30 00','556678-1234', 'Maja Nilsson',     'SE2650000004501234567890', 'SEB',           'www.bikeparts-nordic.se',     4500,  'Spare Parts,Accessories'],
    ['Helmet World AB',         EMAIL, 'Storgatan 58, 211 24 Malmö',             '+46 40 611 20 00','556234-9988', 'Marcus Persson',   'SE2650000004601234567890', 'Handelsbanken', 'www.helmetworld.se',          3000,  'Accessories'],
    ['Alpinestars Nordic',      EMAIL, 'Röntgengatan 5, 721 87 Västerås',        '+46 21 490 30 00','556567-4433', 'Carla Mancini',    'SE2650000004701234567890', 'SEB',           'www.alpinestars.com',         5000,  'Accessories'],
    ['Dainese Nordic',          EMAIL, 'Teknikringen 7, 583 30 Linköping',       '+46 13 214 40 00','556789-5544', 'Luca Ferrari',     'SE2650000004801234567890', 'Swedbank',      '',                            4000,  'Accessories'],
    ['Oxford Nordic',           EMAIL, 'Industrivägen 20, 194 61 Upplands Väsby','+46 8 590 200 00','556333-6677', 'Ingrid Carlsson',  'SE2650000004901234567890', 'Nordea',        'www.oxford-products.com',     2500,  'Accessories,Spare Parts'],
    ['Vance & Hines Europe',    EMAIL, 'Industrivägen 8, 232 37 Arlöv',          '+46 40 680 10 00','556734-5566', 'Rick Morrison',    'SE2650000005001234567890', 'Handelsbanken', 'www.vanceandhines.com',       5000,  'Spare Parts'],
    ['Drag Specialties Nordic', EMAIL, 'Hantverkargatan 14, 214 33 Malmö',       '+46 40 600 70 00','556812-7788', 'Sven Magnusson',   'SE2650000005101234567890', 'SEB',           '',                            4000,  'Spare Parts,Accessories'],
    ['S&S Cycle Nordic',        EMAIL, 'Gasverksgatan 3, 211 29 Malmö',          '+46 40 590 40 00','556923-4455', 'Tom Wheeler',      'SE2650000005201234567890', 'Swedbank',      'www.sscycle.com',             6000,  'Spare Parts'],
]

// ─── Generate Excel files ─────────────────────────────────────────────────────

const companies = [
    { name: 'Stockholm_Premium_Moto',  rows: company1_suppliers },
    { name: 'Goteborg_Bikes_and_More', rows: company2_suppliers },
    { name: 'Malmo_MC_Service_Center', rows: company3_suppliers },
]

companies.forEach(({ name, rows }) => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows])

    // Column widths for readability
    ws['!cols'] = [
        { wch: 30 }, // Supplier Name
        { wch: 32 }, // Email
        { wch: 45 }, // Address
        { wch: 18 }, // Phone
        { wch: 14 }, // Org Number
        { wch: 22 }, // Contact Person
        { wch: 28 }, // Bank Account
        { wch: 16 }, // Bank Name
        { wch: 28 }, // Website
        { wch: 20 }, // Free Shipping
        { wch: 30 }, // Categories
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Suppliers')
    const out = path.join(outDir, `${name}_Suppliers.xlsx`)
    XLSX.writeFile(wb, out)
    console.log(`✅ Created: ${out}  (${rows.length} suppliers)`)
})

console.log('\n📁 Files saved to: public/sample-data/')
