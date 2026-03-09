export interface VendorDetail {
    address: string
    phone: string
    orgNumber: string
    email: string
    freeShippingThreshold?: number
}

/**
 * Vendor contact details keyed by exact vendor name string
 * (must match the `vendor` field in inventory / PO data).
 */
export const vendorDetails: Record<string, VendorDetail> = {
    'Honda Motor Distributors Sdn Bhd': {
        address: 'Lot 6, Jalan Perniagaan 3, Taman Perindustrian Puchong, 47100 Puchong, Selangor, Malaysia',
        phone: '+60 3-8061 2000',
        orgNumber: '198401012345 (115678-H)',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 500
    },
    'Yamaha Motor Malaysia Sdn Bhd': {
        address: 'No. 1, Jalan Kemajuan, Seksyen 13, 40100 Shah Alam, Selangor, Malaysia',
        phone: '+60 3-5511 8888',
        orgNumber: '198201034567 (100892-V)',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 600
    },
    'Kawasaki Motors (M) Sdn Bhd': {
        address: 'B-5-1, Block B, Megan Avenue II, 12 Jalan Yap Kwan Seng, 50450 Kuala Lumpur, Malaysia',
        phone: '+60 3-2164 0088',
        orgNumber: '199001056789 (204731-K)',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 400
    },
    'Suzuki Malaysia Sdn Bhd': {
        address: 'No. 19, Jalan Tandang, Kawasan Perindustrian Tandang, 46050 Petaling Jaya, Selangor, Malaysia',
        phone: '+60 3-7782 9900',
        orgNumber: '197801089012 (039847-D)',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 300
    },
    'BMW Motorrad Malaysia': {
        address: 'Lot 10, Persiaran Industri, Bandar Sri Damansara, 52200 Kuala Lumpur, Malaysia',
        phone: '+60 3-6277 5533',
        orgNumber: '200501023456 (693821-P)',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 700
    },
    'Ducati Asia Pacific Pte Ltd': {
        address: '10 Ubi Crescent, #05-28 Ubi Techpark, Singapore 408564',
        phone: '+65 6846 1238',
        orgNumber: '200301045678 (SG)',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 200
    },
    'Triumph Motorcycles (Asia) Ltd': {
        address: 'Unit 8, 6/F, Metroplaza Tower 1, 223 Hing Fong Road, Kwai Chung, New Territories, Hong Kong',
        phone: '+852 2488 9833',
        orgNumber: 'CR-1234567 (HK)',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 300
    },
    'Indian Motorcycle APAC Pte Ltd': {
        address: '1 HarbourFront Avenue, #14-07 Keppel Bay Tower, Singapore 098632',
        phone: '+65 6271 3388',
        orgNumber: '201801067890 (SG)',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 400
    },
    'Royal Enfield Motors (M) Sdn Bhd': {
        address: 'Suite 12-2, Level 12, Menara Lien Hoe, No. 8 Persiaran Tropicana, 47810 Petaling Jaya, Selangor, Malaysia',
        phone: '+60 3-7887 2211',
        orgNumber: '201601078901 (1193456-U)',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 500
    },
    'Vogue Motorcycle Industries': {
        address: 'Lot 88, Jalan Industri Batu Caves 1/3, Taman Industri Batu Caves, 68100 Batu Caves, Selangor, Malaysia',
        phone: '+60 3-6185 4477',
        orgNumber: '201901034512 (1334512-W)',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 600
    },
    'NGK Spark Plugs (Malaysia) Sdn Bhd': {
        address: 'No. 7, Jalan Hi-Tech 2, Kawasan Perindustrian Hi-Tech, 68000 Ampang, Selangor, Malaysia',
        phone: '+60 3-4251 6688',
        orgNumber: '199501045671 (356892-A)',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 400
    },
    'EBC Brakes Distribution Asia': {
        address: '25 Tannery Road, #06-01 Tannery Block, Singapore 347801',
        phone: '+65 6744 2299',
        orgNumber: '201201056789 (SG)',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 300
    },
    'Michelin Tyre PLC Malaysia': {
        address: 'No. 2, Lebuh Utama 2, Taman Perindustrian Bukit Minyak, 14100 Simpang Ampat, Penang, Malaysia',
        phone: '+60 4-507 3300',
        orgNumber: '197901067890 (049812-T)',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 500
    },
    'Alpinestars S.p.A.': {
        address: 'Via Erizzo 48, 31033 Asolo (TV), Italy',
        phone: '+39 0423 55 411',
        orgNumber: 'IT 00347500269',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 300
    },
    'Shoei Co., Ltd.': {
        address: '1-5-8 Higashi Ikebukuro, Toshima-ku, Tokyo 170-8488, Japan',
        phone: '+81 3-3981 3771',
        orgNumber: '0110-01-012345 (JP)',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 600
    },
    'AGV S.p.A.': {
        address: 'Via Po 50, 36030 Molvena (VI), Italy',
        phone: '+39 0424 709 211',
        orgNumber: 'IT 01845890244',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 200
    },
    'Helmet House Inc.': {
        address: '1075 Pioneer Way, El Cajon, CA 92020, United States',
        phone: '+1 619-562-0020',
        orgNumber: 'EIN: 95-3456789',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 100
    },
    'LS2 Helmets': {
        address: 'No. 3 Jinshan Road, Jinshan Industrial Zone, Nanhai District, Foshan, Guangdong, China 528248',
        phone: '+86 757-8622 8866',
        orgNumber: '91440605MA4UX3XX5K',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 500
    },
    "REV'IT! Sport International BV": {
        address: 'Columbusstraat 16, 5928 LC Venlo, Netherlands',
        phone: '+31 77 396 3600',
        orgNumber: 'KvK 12345678 (NL)',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 200
    },
    'Held GmbH': {
        address: 'Industriestrasse 8, 89604 Allmendingen, Germany',
        phone: '+49 7391 70 0',
        orgNumber: 'HRB 500123 Ulm (DE)',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 400
    },
    'K&N Engineering Inc.': {
        address: '1455 Citrus Street, Riverside, CA 92507, United States',
        phone: '+1 951-826-4000',
        orgNumber: 'EIN: 33-1234567',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 500
    },
    'Motul Asia Pacific Pte Ltd': {
        address: '3 Changi South Lane, #04-01, Singapore 486118',
        phone: '+65 6546 5500',
        orgNumber: '198903021112 (SG)',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 200
    },
    'Brembo S.p.A. Asia Pacific': {
        address: '6 Raffles Quay, #14-02 John Hancock Tower, Singapore 048580',
        phone: '+65 6224 5511',
        orgNumber: '200901078901 (SG)',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 300
    },
    'Castrol (Malaysia) Sdn Bhd': {
        address: 'Level 12, Menara Shell, No. 211 Jalan Tun Razak, 50400 Kuala Lumpur, Malaysia',
        phone: '+60 3-2786 8000',
        orgNumber: '196701089234 (006782-K)',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 400
    },
    'Daido Kogyo (DID) Southeast Asia': {
        address: 'No. 12 Tuas Avenue 3, Singapore 639405',
        phone: '+65 6861 4888',
        orgNumber: '199201034567 (SG)',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 200
    },
    'Venhill Engineering Ltd': {
        address: 'Unit 3, Forest Row Business Park, Station Road, Forest Row, East Sussex RH18 5DW, United Kingdom',
        phone: '+44 1342 822 999',
        orgNumber: 'Company No. 01234567 (UK)',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 500
    },
    'Motion Pro Inc.': {
        address: '708 Bragato Road, San Carlos, CA 94070, United States',
        phone: '+1 650-594-9600',
        orgNumber: 'EIN: 94-2345678',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 100
    },
    'All Balls Racing Parts': {
        address: '4350 E. Brickell Street, Ontario, CA 91761, United States',
        phone: '+1 909-923-3600',
        orgNumber: 'EIN: 33-9876543',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 200
    },
    'YSS Thailand Co., Ltd.': {
        address: '88/8 Moo 5, Bangna-Trat Road KM.23, Bangplee, Samutprakarn 10540, Thailand',
        phone: '+66 2-312 8999',
        orgNumber: '0105549112233 (TH)',
        email: 'svpriyaa2808@gmail.com',
    },
    'Yuasa Battery (Malaysia) Sdn Bhd': {
        address: 'PLO 8, Jalan Keluli, Kawasan Perindustrian Pasir Gudang, 81700 Pasir Gudang, Johor, Malaysia',
        phone: '+60 7-251 7888',
        orgNumber: '199201012345 (243456-W)',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 300
    },
    'Koso Electronics Co., Ltd.': {
        address: 'No. 80, Xingye 1st Road, Xinshi District, Tainan City 74146, Taiwan',
        phone: '+886 6-505 5522',
        orgNumber: '13456789 (TW)',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 600
    },
    'Rizoma Srl': {
        address: 'Via Manzoni 1, 20020 Lainate (MI), Italy',
        phone: '+39 02 9370 7070',
        orgNumber: 'IT 07891234561',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 500
    },
    'Dynojet Research Inc.': {
        address: '2191 Mendenhall Drive, North Las Vegas, NV 89081, United States',
        phone: '+1 702-399-1423',
        orgNumber: 'EIN: 88-1234567',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 400
    },
    'Akrapovic d.o.o.': {
        address: 'Industrija izpušnih sistemov d.o.o., Drabosenova ulica 10, 1230 Domžale, Slovenia',
        phone: '+386 1 724 8700',
        orgNumber: 'VAT SI 27588040',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 100
    },
    'Oxford Products Ltd.': {
        address: 'Oxford House, Gilles Hill, Witney, Oxfordshire OX28 5XD, United Kingdom',
        phone: '+44 1993 862 300',
        orgNumber: 'Company No. 01567890 (UK)',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 300
    },
    'SW-Motech GmbH & Co. KG': {
        address: 'Georg-Eger-Strasse 1, 35398 Gießen, Germany',
        phone: '+49 641 94 623-0',
        orgNumber: 'HRA 4567 Gießen (DE)',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 100
    },
    'ODI International Inc.': {
        address: '100 ODI Court, Ashland, OR 97520, United States',
        phone: '+1 541-488-2453',
        orgNumber: 'EIN: 93-1234567',
        email: 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 200
    },
    'Polaris scandinavian AB' : {
        address : 'PO Box 5005, 831 05 Ostersund,Sverige',
        phone : '+46 63 19 95 60',
        orgNumber : 'SE556630593301',
        email : 'svpriyaa2808@gmail.com',
        freeShippingThreshold : 200,
    }
}
