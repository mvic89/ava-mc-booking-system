import { readFileSync, writeFileSync } from 'fs';

const FILES = [
  'messages/sv.json',
  'messages/en.json',
  'messages/no.json',
  'messages/da.json',
  'messages/fr.json',
  'messages/es.json',
  'messages/de.json',
  'messages/nl.json',
  'messages/ar.json',
];

const EXTRA = {
  sv: {
    kpi: {
      noBookings: 'Inga bokningar idag',
      noOrders:   'Inga aktiva ordrar',
      allGood:    'Allt är i lager',
      noDone:     'Ingen klar idag',
    },
    common: { booking: 'bokning' },
  },
  en: {
    kpi: {
      noBookings: 'No bookings today',
      noOrders:   'No active orders',
      allGood:    'All parts in stock',
      noDone:     'None completed today',
    },
    common: { booking: 'booking' },
  },
  no: {
    kpi: {
      noBookings: 'Ingen bestillinger i dag',
      noOrders:   'Ingen aktive ordrer',
      allGood:    'Alt på lager',
      noDone:     'Ingen ferdig i dag',
    },
    common: { booking: 'bestilling' },
  },
  da: {
    kpi: {
      noBookings: 'Ingen bookinger i dag',
      noOrders:   'Ingen aktive ordrer',
      allGood:    'Alt er på lager',
      noDone:     'Ingen færdig i dag',
    },
    common: { booking: 'booking' },
  },
  fr: {
    kpi: {
      noBookings: "Pas de réservations aujourd'hui",
      noOrders:   'Aucune commande active',
      allGood:    'Tout est en stock',
      noDone:     'Aucune terminée aujourd\'hui',
    },
    common: { booking: 'réservation' },
  },
  es: {
    kpi: {
      noBookings: 'Sin reservas hoy',
      noOrders:   'Sin pedidos activos',
      allGood:    'Todo en stock',
      noDone:     'Ninguno completado hoy',
    },
    common: { booking: 'reserva' },
  },
  de: {
    kpi: {
      noBookings: 'Keine Buchungen heute',
      noOrders:   'Keine aktiven Aufträge',
      allGood:    'Alles vorrätig',
      noDone:     'Heute noch nichts abgeschlossen',
    },
    common: { booking: 'Buchung' },
  },
  nl: {
    kpi: {
      noBookings: 'Geen boekingen vandaag',
      noOrders:   'Geen actieve orders',
      allGood:    'Alles op voorraad',
      noDone:     'Vandaag nog niets klaar',
    },
    common: { booking: 'boeking' },
  },
  ar: {
    kpi: {
      noBookings: 'لا حجوزات اليوم',
      noOrders:   'لا طلبات نشطة',
      allGood:    'كل القطع متوفرة',
      noDone:     'لم يكتمل أي طلب اليوم',
    },
    common: { booking: 'حجز' },
  },
};

for (const file of FILES) {
  const locale = file.match(/messages\/(\w+)\.json/)[1];
  const json = JSON.parse(readFileSync(file, 'utf8'));
  const extra = EXTRA[locale] ?? EXTRA.en;

  if (!json.service) json.service = {};
  if (!json.service.dashboard) json.service.dashboard = {};
  if (!json.service.dashboard.kpi) json.service.dashboard.kpi = {};
  if (!json.service.common) json.service.common = {};

  json.service.dashboard.kpi = { ...json.service.dashboard.kpi, ...extra.kpi };
  json.service.common = { ...json.service.common, ...extra.common };

  writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
  console.log(`✓ ${file}`);
}
console.log('Done.');
