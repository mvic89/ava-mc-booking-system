export type Status = "new" | "reviewing" | "sent" | "accepted" | "declined";

export type CustomerInquiry = {
  id: string;
  submittedAt: string;
  status: Status;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  bike: {
    slug: string;
    brand: string;
    model: string;
    price: number;
    year: number;
    type: string;
    image: string;
  };
  payment: "cash" | "financing";
  tradeIn: {
    has: boolean;
    make?: string;
    model?: string;
    year?: string;
    mileage?: string;
  };
  accessories: {
    wants: boolean;
    items?: string[];
    note?: string;
  };
  message?: string;
};

export const inquiries: CustomerInquiry[] = [
  {
    id: "inq-001",
    submittedAt: "2026-03-01T09:14:00",
    status: "new",
    customer: {
      name: "Erik Lindqvist",
      email: "erik.lindqvist@gmail.com",
      phone: "070 123 45 67",
    },
    bike: {
      slug: "kawasaki-kle500",
      brand: "Kawasaki",
      model: "KLE500",
      price: 72900,
      year: 2026,
      type: "Adventure",
      image:
        "https://pro.bbcdn.io/d5/d50566a9-47dc-f798-52f7-0000eb72f395?rule=legacy-largest&format=.jpg",
    },
    payment: "financing",
    tradeIn: { has: false },
    accessories: {
      wants: true,
      items: ["Hjälm", "Bagage & väskor"],
      note: "Föredrar svart färg",
    },
    message: "Vill ha erbjudande så snart som möjligt.",
  },
  {
    id: "inq-002",
    submittedAt: "2026-03-01T11:42:00",
    status: "reviewing",
    customer: {
      name: "Sofia Bergström",
      email: "sofia.bergstrom@outlook.com",
      phone: "073 456 78 90",
    },
    bike: {
      slug: "kawasaki-kle500-se",
      brand: "Kawasaki",
      model: "KLE500 SE",
      price: 79900,
      year: 2026,
      type: "Adventure",
      image:
        "https://pro.bbcdn.io/f9/f9193c1a-7640-da41-3643-000096305c67?rule=legacy-largest&format=.jpg",
    },
    payment: "cash",
    tradeIn: {
      has: true,
      make: "Honda",
      model: "CB500F",
      year: "2020",
      mileage: "18000",
    },
    accessories: { wants: false },
  },
  {
    id: "inq-003",
    submittedAt: "2026-03-02T08:05:00",
    status: "sent",
    customer: {
      name: "Marcus Johansson",
      email: "marcus.j@hotmail.com",
      phone: "076 234 56 78",
    },
    bike: {
      slug: "voge-sr1-adv-125",
      brand: "Voge",
      model: "SR1 ADV 125",
      price: 39995,
      year: 2026,
      type: "Scooter",
      image:
        "https://pro.bbcdn.io/d5/d52b7e03-e0e5-be7c-fb5b-0000a54dd0cd?rule=legacy-largest&format=.jpg",
    },
    payment: "financing",
    tradeIn: { has: false },
    accessories: { wants: false },
    message: "Behöver cykeln senast i april.",
  },
  {
    id: "inq-004",
    submittedAt: "2026-02-27T14:30:00",
    status: "accepted",
    customer: {
      name: "Anna Karlsson",
      email: "anna.karlsson@gmail.com",
      phone: "070 987 65 43",
    },
    bike: {
      slug: "kawasaki-kle500",
      brand: "Kawasaki",
      model: "KLE500",
      price: 72900,
      year: 2026,
      type: "Adventure",
      image:
        "https://pro.bbcdn.io/d5/d50566a9-47dc-f798-52f7-0000eb72f395?rule=legacy-largest&format=.jpg",
    },
    payment: "cash",
    tradeIn: { has: false },
    accessories: {
      wants: true,
      items: ["Hjälm", "Motorhölje", "Låssystem"],
    },
  },
  {
    id: "inq-005",
    submittedAt: "2026-02-25T16:20:00",
    status: "declined",
    customer: {
      name: "Johan Petersson",
      email: "johanp@gmail.com",
      phone: "072 111 22 33",
    },
    bike: {
      slug: "kawasaki-kle500-se",
      brand: "Kawasaki",
      model: "KLE500 SE",
      price: 79900,
      year: 2026,
      type: "Adventure",
      image:
        "https://pro.bbcdn.io/f9/f9193c1a-7640-da41-3643-000096305c67?rule=legacy-largest&format=.jpg",
    },
    payment: "financing",
    tradeIn: {
      has: true,
      make: "Yamaha",
      model: "MT-07",
      year: "2019",
      mileage: "32000",
    },
    accessories: { wants: false },
    message: "Priset var för högt.",
  },
  {
    id: "inq-006",
    submittedAt: "2026-03-03T07:55:00",
    status: "new",
    customer: {
      name: "Emma Nilsson",
      email: "emma.nilsson@icloud.com",
      phone: "079 555 44 33",
    },
    bike: {
      slug: "voge-sr1-adv-125",
      brand: "Voge",
      model: "SR1 ADV 125",
      price: 39995,
      year: 2026,
      type: "Scooter",
      image:
        "https://pro.bbcdn.io/d5/d52b7e03-e0e5-be7c-fb5b-0000a54dd0cd?rule=legacy-largest&format=.jpg",
    },
    payment: "cash",
    tradeIn: { has: false },
    accessories: { wants: false },
  },
  {
    id: "inq-007",
    submittedAt: "2026-03-02T15:10:00",
    status: "reviewing",
    customer: {
      name: "Lars Svensson",
      email: "lars.svensson@gmail.com",
      phone: "070 777 88 99",
    },
    bike: {
      slug: "kawasaki-kle500",
      brand: "Kawasaki",
      model: "KLE500",
      price: 72900,
      year: 2026,
      type: "Adventure",
      image:
        "https://pro.bbcdn.io/d5/d50566a9-47dc-f798-52f7-0000eb72f395?rule=legacy-largest&format=.jpg",
    },
    payment: "financing",
    tradeIn: {
      has: true,
      make: "Kawasaki",
      model: "Ninja 400",
      year: "2022",
      mileage: "9500",
    },
    accessories: {
      wants: true,
      items: ["Bagage & väskor", "Körskydd"],
    },
  },
];

export const statusMeta: Record<
  Status,
  { label: string; color: string; bg: string }
> = {
  new:       { label: "Ny",          color: "text-blue-700",   bg: "bg-blue-50"   },
  reviewing: { label: "Granskas",    color: "text-amber-700",  bg: "bg-amber-50"  },
  sent:      { label: "Skickad",     color: "text-orange-700", bg: "bg-orange-50" },
  accepted:  { label: "Accepterad",  color: "text-green-700",  bg: "bg-green-50"  },
  declined:  { label: "Avböjd",      color: "text-red-700",    bg: "bg-red-50"    },
};

export function getInquiry(id: string) {
  return inquiries.find((i) => i.id === id);
}
