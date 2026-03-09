export type TestDriveStatus = "scheduled" | "completed";

export type TestDriveBooking = {
  id: string;
  submittedAt: string;
  requestedDate: string;
  status: TestDriveStatus;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    zipCode: string;
    personalNumber: string;
  };
  bike: {
    slug: string;
    brand: string;
    model: string;
    year: number;
    type: string;
    image: string;
  };
  customerSigned: true;
  sellerSigned: boolean;
  completedAt?: string;
};

export const bookings: TestDriveBooking[] = [
  {
    id: "td-001",
    submittedAt: "2026-03-01T10:22:00",
    requestedDate: "2026-03-06",
    status: "scheduled",
    customer: {
      firstName: "Erik",
      lastName: "Lindqvist",
      email: "erik.lindqvist@gmail.com",
      phone: "070 123 45 67",
      address: "Storgatan 12",
      zipCode: "114 55",
      personalNumber: "19880415-1234",
    },
    bike: {
      slug: "kawasaki-kle500",
      brand: "Kawasaki",
      model: "KLE500",
      year: 2026,
      type: "Adventure",
      image:
        "https://pro.bbcdn.io/d5/d50566a9-47dc-f798-52f7-0000eb72f395?rule=legacy-largest&format=.jpg",
    },
    customerSigned: true,
    sellerSigned: false,
  },
  {
    id: "td-002",
    submittedAt: "2026-03-01T14:05:00",
    requestedDate: "2026-03-07",
    status: "scheduled",
    customer: {
      firstName: "Sofia",
      lastName: "Bergström",
      email: "sofia.bergstrom@outlook.com",
      phone: "073 456 78 90",
      address: "Kungsgatan 8B",
      zipCode: "411 19",
      personalNumber: "19920730-5678",
    },
    bike: {
      slug: "kawasaki-kle500-se",
      brand: "Kawasaki",
      model: "KLE500 SE",
      year: 2026,
      type: "Adventure",
      image:
        "https://pro.bbcdn.io/f9/f9193c1a-7640-da41-3643-000096305c67?rule=legacy-largest&format=.jpg",
    },
    customerSigned: true,
    sellerSigned: false,
  },
  {
    id: "td-003",
    submittedAt: "2026-03-02T09:00:00",
    requestedDate: "2026-03-08",
    status: "scheduled",
    customer: {
      firstName: "Emma",
      lastName: "Nilsson",
      email: "emma.nilsson@icloud.com",
      phone: "079 555 44 33",
      address: "Vasagatan 3",
      zipCode: "111 20",
      personalNumber: "19951204-9012",
    },
    bike: {
      slug: "voge-sr1-adv-125",
      brand: "Voge",
      model: "SR1 ADV 125",
      year: 2026,
      type: "Scooter",
      image:
        "https://pro.bbcdn.io/d5/d52b7e03-e0e5-be7c-fb5b-0000a54dd0cd?rule=legacy-largest&format=.jpg",
    },
    customerSigned: true,
    sellerSigned: false,
  },
  {
    id: "td-004",
    submittedAt: "2026-02-26T11:30:00",
    requestedDate: "2026-02-28",
    status: "completed",
    customer: {
      firstName: "Marcus",
      lastName: "Johansson",
      email: "marcus.j@hotmail.com",
      phone: "076 234 56 78",
      address: "Drottninggatan 22",
      zipCode: "111 51",
      personalNumber: "19850612-3456",
    },
    bike: {
      slug: "kawasaki-kle500",
      brand: "Kawasaki",
      model: "KLE500",
      year: 2026,
      type: "Adventure",
      image:
        "https://pro.bbcdn.io/d5/d50566a9-47dc-f798-52f7-0000eb72f395?rule=legacy-largest&format=.jpg",
    },
    customerSigned: true,
    sellerSigned: true,
    completedAt: "2026-02-28T13:45:00",
  },
  {
    id: "td-005",
    submittedAt: "2026-02-27T16:00:00",
    requestedDate: "2026-03-01",
    status: "completed",
    customer: {
      firstName: "Anna",
      lastName: "Karlsson",
      email: "anna.karlsson@gmail.com",
      phone: "070 987 65 43",
      address: "Birger Jarlsgatan 45",
      zipCode: "114 29",
      personalNumber: "19900322-7890",
    },
    bike: {
      slug: "voge-sr1-adv-125",
      brand: "Voge",
      model: "SR1 ADV 125",
      year: 2026,
      type: "Scooter",
      image:
        "https://pro.bbcdn.io/d5/d52b7e03-e0e5-be7c-fb5b-0000a54dd0cd?rule=legacy-largest&format=.jpg",
    },
    customerSigned: true,
    sellerSigned: true,
    completedAt: "2026-03-01T10:20:00",
  },
];

export const testStatusMeta: Record<
  TestDriveStatus,
  { label: string; color: string; bg: string }
> = {
  scheduled: {
    label: "Bokad",
    color: "text-amber-400",
    bg: "bg-amber-950/60 border-amber-900",
  },
  completed: {
    label: "Slutförd",
    color: "text-green-400",
    bg: "bg-green-950/60 border-green-900",
  },
};

export function getBooking(id: string) {
  return bookings.find((b) => b.id === id);
}
