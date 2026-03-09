export type Motorcycle = {
  slug: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  type: string;
  condition: "new" | "used";
  mileage?: number;
  image: string;
  specs: {
    engine: string;
    power: string;
    torque: string;
    weight: string;
    seatHeight: string;
    fuelCapacity: string;
  };
  mechanical: {
    serviceInterval: string;
    warranty: string;
    reliability: string;
  };
  lifestyle: {
    tagline: string;
    riderProfile: string;
    brandStory: string;
  };
};

export const motorcycles: Motorcycle[] = [
  {
    slug: "kawasaki-kle500",
    brand: "Kawasaki",
    model: "KLE500",
    year: 2026,
    price: 72900,
    type: "Adventure",
    condition: "new",
    image:
      "https://pro.bbcdn.io/d5/d50566a9-47dc-f798-52f7-0000eb72f395?rule=legacy-largest&format=.jpg",
    specs: {
      engine: "451cc Parallel Twin",
      power: "45 hk",
      torque: "44 Nm",
      weight: "195 kg",
      seatHeight: "820 mm",
      fuelCapacity: "17 L",
    },
    mechanical: {
      serviceInterval: "Var 6 000 km",
      warranty: "2 år",
      reliability:
        "KLE-serien är känd för hög driftsäkerhet. Parallelltvilling-motorn är enkel att underhålla och reservdelar finns lättillgängliga hos alla Kawasaki-återförsäljare i Sverige.",
    },
    lifestyle: {
      tagline: "Utforska utan gränser.",
      riderProfile:
        "Perfekt för pendlaren som vill ta helgens äventyr på grus. Kräver A2-körkort, vilket gör den idealisk för relativt nya förare som vill växa med en cykel.",
      brandStory:
        "Kawasaki har tillverkat motorcyklar sedan 1961. KLE500 är en del av deras Adventure-familj — byggd för att hantera allt från motorväg till skogsväg utan kompromisser.",
    },
  },
  {
    slug: "kawasaki-kle500-se",
    brand: "Kawasaki",
    model: "KLE500 SE",
    year: 2026,
    price: 79900,
    type: "Adventure",
    condition: "new",
    image:
      "https://pro.bbcdn.io/f9/f9193c1a-7640-da41-3643-000096305c67?rule=legacy-largest&format=.jpg",
    specs: {
      engine: "451cc Parallel Twin",
      power: "45 hk",
      torque: "44 Nm",
      weight: "198 kg",
      seatHeight: "820 mm",
      fuelCapacity: "17 L",
    },
    mechanical: {
      serviceInterval: "Var 6 000 km",
      warranty: "2 år",
      reliability:
        "SE-versionen delar samma beprövade motor som standardmodellen men tillför uppgraderad fjädring och TFT-display. Kawasaki's kvalitetskontroll är bland de högsta i branschen.",
    },
    lifestyle: {
      tagline: "Äventyret, uppgraderat.",
      riderProfile:
        "Föraren som vill ha lite mer — bättre display, mer komfortabel fjädring och en premiumkänsla utan att hoppa till en tyngre klass. Fortfarande A2-kompatibel.",
      brandStory:
        "SE-varianten av KLE500 är Kawasakis svar på förare som kräver mer utan att kompromissa med tillgängligheten. Ett steg upp i komfort och teknik, med samma pålitliga hjärta.",
    },
  },
  {
    slug: "voge-sr1-adv-125",
    brand: "Voge",
    model: "SR1 ADV 125",
    year: 2026,
    price: 39995,
    type: "Scooter",
    condition: "new",
    image:
      "https://pro.bbcdn.io/d5/d52b7e03-e0e5-be7c-fb5b-0000a54dd0cd?rule=legacy-largest&format=.jpg",
    specs: {
      engine: "125cc Single",
      power: "11 hk",
      torque: "11 Nm",
      weight: "142 kg",
      seatHeight: "780 mm",
      fuelCapacity: "12 L",
    },
    mechanical: {
      serviceInterval: "Var 4 000 km",
      warranty: "2 år",
      reliability:
        "Voge är ett relativt nytt varumärke med rötter i Lonchins ingenjörstradition. SR1 ADV 125 har fått positiva recensioner för sin byggnadskvallitet och Bosch-ABS är standard.",
    },
    lifestyle: {
      tagline: "Stadsfrihet med äventyrssjäl.",
      riderProfile:
        "Studenten, pendlaren eller den som tar sitt AM-körkort. Ingen motorvägsbehörighet krävs. Perfekt för tät stadstrafik med ett äventyrligt utseende som sticker ut.",
      brandStory:
        "Voge är Loncins premiumvarumärke, grundat 2018 med målet att utmana etablerade europeiska märken på teknik och design. SR1 ADV kombinerar scooterns praktikalitet med en ADV-estetik.",
    },
  },
];

export function getMotorcycle(slug: string) {
  return motorcycles.find((m) => m.slug === slug);
}
