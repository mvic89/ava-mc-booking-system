#!/usr/bin/env node
/**
 * Adds/overwrites the `daily` namespace in all 9 locale message files.
 */
const fs   = require('fs')
const path = require('path')

const LOCALES_DIR = path.join(__dirname, '..', 'messages')

const translations = {
  en: {
    breadcrumbParent: 'Purchase',
    breadcrumb:       'Daily Actions',
    title:            'Daily Action Dashboard',
    subtitle:         'Everything that needs attention today.',
    viewAll:          'View all →',
    noVendor:         'No vendor',
    summary: {
      totalActions:    'Total Actions',
      urgent:          'Urgent',
      pendingApproval: 'Pending Approval',
      lowStock:        'Low Stock',
    },
    allClear:     'All clear — nothing needs attention today!',
    allClearHint: 'Check back tomorrow or after new POs are placed.',
    sections: {
      followUp: {
        title: 'Follow Up Now',
        empty: 'No overdue follow-ups — all sent POs are within 5 business days.',
      },
      etaOverdue: {
        title: 'ETA Overdue',
        empty: 'No POs past their expected arrival date.',
      },
      arrivingToday: {
        title: 'Arriving Today',
        empty: '',
      },
      pendingApproval: {
        title: 'POs Awaiting Approval',
        empty: 'No POs waiting for approval.',
      },
      receiptsApprove: {
        title: 'Receipts to Approve',
        empty: 'No delivery notes waiting for approval.',
      },
      overdueInvoices: {
        title: 'Overdue Invoices',
        empty: 'No overdue supplier invoices.',
      },
      partialOrders: {
        title: 'Partial Orders',
        empty: 'No POs with outstanding backorders.',
      },
      lowStock: {
        title: 'Low Stock — Reorder Needed',
        empty: 'All items are above reorder level.',
      },
    },
    badges: {
      daysOverdue: '{days}d overdue',
      etaWas:      'ETA was {date} ({days}d ago)',
      partial:     'Partial',
      unitsDate:   '{units} units · {date}',
      due:         'Due {date}',
      stock:       'Stock: {current} / Min: {min}',
    },
  },

  sv: {
    breadcrumbParent: 'Inköp',
    breadcrumb:       'Dagliga åtgärder',
    title:            'Daglig åtgärdstavla',
    subtitle:         'Allt som behöver uppmärksamhet idag.',
    viewAll:          'Visa alla →',
    noVendor:         'Ingen leverantör',
    summary: {
      totalActions:    'Totala åtgärder',
      urgent:          'Brådskande',
      pendingApproval: 'Väntar på godkännande',
      lowStock:        'Lågt lager',
    },
    allClear:     'Allt klart — inget behöver uppmärksamhet idag!',
    allClearHint: 'Kom tillbaka imorgon eller efter att nya IO har lagts.',
    sections: {
      followUp: {
        title: 'Följ upp nu',
        empty: 'Inga försenade uppföljningar — alla skickade IO är inom 5 arbetsdagar.',
      },
      etaOverdue: {
        title: 'ETA passerat',
        empty: 'Inga IO efter förväntat ankomstdatum.',
      },
      arrivingToday: {
        title: 'Anländer idag',
        empty: '',
      },
      pendingApproval: {
        title: 'IO väntar på godkännande',
        empty: 'Inga IO väntar på godkännande.',
      },
      receiptsApprove: {
        title: 'Kvitton att godkänna',
        empty: 'Inga följesedlar väntar på godkännande.',
      },
      overdueInvoices: {
        title: 'Förfallna fakturor',
        empty: 'Inga förfallna leverantörsfakturor.',
      },
      partialOrders: {
        title: 'Delleveranser',
        empty: 'Inga IO med utestående restordrar.',
      },
      lowStock: {
        title: 'Lågt lager — beställning behövs',
        empty: 'Alla artiklar är över beställningsnivå.',
      },
    },
    badges: {
      daysOverdue: '{days}d försenad',
      etaWas:      'ETA var {date} ({days}d sedan)',
      partial:     'Delleverans',
      unitsDate:   '{units} st · {date}',
      due:         'Förfaller {date}',
      stock:       'Lager: {current} / Min: {min}',
    },
  },

  no: {
    breadcrumbParent: 'Innkjøp',
    breadcrumb:       'Daglige handlinger',
    title:            'Daglig handlingstavle',
    subtitle:         'Alt som trenger oppmerksomhet i dag.',
    viewAll:          'Se alle →',
    noVendor:         'Ingen leverandør',
    summary: {
      totalActions:    'Totale handlinger',
      urgent:          'Haster',
      pendingApproval: 'Venter på godkjenning',
      lowStock:        'Lavt lager',
    },
    allClear:     'Alt klart — ingenting trenger oppmerksomhet i dag!',
    allClearHint: 'Sjekk igjen i morgen eller etter at nye innkjøpsordre er lagt inn.',
    sections: {
      followUp: {
        title: 'Følg opp nå',
        empty: 'Ingen forsinkede oppfølginger — alle sendte ordrer er innen 5 virkedager.',
      },
      etaOverdue: {
        title: 'ETA overskredet',
        empty: 'Ingen innkjøpsordre etter forventet ankomstdato.',
      },
      arrivingToday: {
        title: 'Ankommer i dag',
        empty: '',
      },
      pendingApproval: {
        title: 'Ordrer venter på godkjenning',
        empty: 'Ingen innkjøpsordre venter på godkjenning.',
      },
      receiptsApprove: {
        title: 'Kvitteringer som skal godkjennes',
        empty: 'Ingen følgesedler venter på godkjenning.',
      },
      overdueInvoices: {
        title: 'Forfalte fakturaer',
        empty: 'Ingen forfalte leverandørfakturaer.',
      },
      partialOrders: {
        title: 'Delvise ordrer',
        empty: 'Ingen innkjøpsordre med utestående restordrer.',
      },
      lowStock: {
        title: 'Lavt lager — bestilling nødvendig',
        empty: 'Alle varer er over bestillingsnivå.',
      },
    },
    badges: {
      daysOverdue: '{days}d forfalt',
      etaWas:      'ETA var {date} ({days}d siden)',
      partial:     'Delvis',
      unitsDate:   '{units} enheter · {date}',
      due:         'Forfaller {date}',
      stock:       'Lager: {current} / Min: {min}',
    },
  },

  da: {
    breadcrumbParent: 'Indkøb',
    breadcrumb:       'Daglige handlinger',
    title:            'Dagligt handlingsoverblik',
    subtitle:         'Alt der kræver opmærksomhed i dag.',
    viewAll:          'Se alle →',
    noVendor:         'Ingen leverandør',
    summary: {
      totalActions:    'Samlede handlinger',
      urgent:          'Haster',
      pendingApproval: 'Afventer godkendelse',
      lowStock:        'Lavt lager',
    },
    allClear:     'Alt klart — intet kræver opmærksomhed i dag!',
    allClearHint: 'Tjek igen i morgen eller efter nye indkøbsordrer er oprettet.',
    sections: {
      followUp: {
        title: 'Følg op nu',
        empty: 'Ingen forsinkede opfølgninger — alle sendte ordrer er inden for 5 arbejdsdage.',
      },
      etaOverdue: {
        title: 'ETA overskredet',
        empty: 'Ingen indkøbsordrer efter forventet ankomstdato.',
      },
      arrivingToday: {
        title: 'Ankommer i dag',
        empty: '',
      },
      pendingApproval: {
        title: 'Ordrer afventer godkendelse',
        empty: 'Ingen indkøbsordrer afventer godkendelse.',
      },
      receiptsApprove: {
        title: 'Kvitteringer til godkendelse',
        empty: 'Ingen følgesedler afventer godkendelse.',
      },
      overdueInvoices: {
        title: 'Forfaldne fakturaer',
        empty: 'Ingen forfaldne leverandørfakturaer.',
      },
      partialOrders: {
        title: 'Delvise ordrer',
        empty: 'Ingen indkøbsordrer med udestående restordrer.',
      },
      lowStock: {
        title: 'Lavt lager — genbestilling nødvendig',
        empty: 'Alle varer er over genbestillingsniveau.',
      },
    },
    badges: {
      daysOverdue: '{days}d forfalden',
      etaWas:      'ETA var {date} ({days}d siden)',
      partial:     'Delvis',
      unitsDate:   '{units} enheder · {date}',
      due:         'Forfalder {date}',
      stock:       'Lager: {current} / Min: {min}',
    },
  },

  de: {
    breadcrumbParent: 'Einkauf',
    breadcrumb:       'Tägliche Aktionen',
    title:            'Tägliches Aktions-Dashboard',
    subtitle:         'Alles, was heute Aufmerksamkeit erfordert.',
    viewAll:          'Alle anzeigen →',
    noVendor:         'Kein Lieferant',
    summary: {
      totalActions:    'Aktionen gesamt',
      urgent:          'Dringend',
      pendingApproval: 'Ausstehende Genehmigung',
      lowStock:        'Niedriger Bestand',
    },
    allClear:     'Alles erledigt — heute gibt es nichts zu tun!',
    allClearHint: 'Morgen wieder nachschauen oder nach neuen Bestellungen.',
    sections: {
      followUp: {
        title: 'Jetzt nachfassen',
        empty: 'Keine überfälligen Nachfassungen — alle gesendeten Bestellungen sind innerhalb von 5 Werktagen.',
      },
      etaOverdue: {
        title: 'ETA überschritten',
        empty: 'Keine Bestellungen nach dem erwarteten Lieferdatum.',
      },
      arrivingToday: {
        title: 'Heute erwartet',
        empty: '',
      },
      pendingApproval: {
        title: 'Bestellungen warten auf Genehmigung',
        empty: 'Keine Bestellungen warten auf Genehmigung.',
      },
      receiptsApprove: {
        title: 'Wareneingänge zu genehmigen',
        empty: 'Keine Lieferscheine warten auf Genehmigung.',
      },
      overdueInvoices: {
        title: 'Überfällige Rechnungen',
        empty: 'Keine überfälligen Lieferantenrechnungen.',
      },
      partialOrders: {
        title: 'Teillieferungen',
        empty: 'Keine Bestellungen mit ausstehenden Nachlieferungen.',
      },
      lowStock: {
        title: 'Niedriger Bestand — Nachbestellung erforderlich',
        empty: 'Alle Artikel liegen über dem Nachbestellniveau.',
      },
    },
    badges: {
      daysOverdue: '{days}T überfällig',
      etaWas:      'ETA war {date} (vor {days}T)',
      partial:     'Teillieferung',
      unitsDate:   '{units} Einh. · {date}',
      due:         'Fällig {date}',
      stock:       'Bestand: {current} / Min: {min}',
    },
  },

  fr: {
    breadcrumbParent: 'Achats',
    breadcrumb:       'Actions du jour',
    title:            'Tableau de bord des actions quotidiennes',
    subtitle:         'Tout ce qui nécessite une attention aujourd\'hui.',
    viewAll:          'Voir tout →',
    noVendor:         'Sans fournisseur',
    summary: {
      totalActions:    'Actions totales',
      urgent:          'Urgent',
      pendingApproval: 'En attente d\'approbation',
      lowStock:        'Stock faible',
    },
    allClear:     'Tout est à jour — rien ne nécessite d\'attention aujourd\'hui !',
    allClearHint: 'Revenez demain ou après la création de nouveaux BC.',
    sections: {
      followUp: {
        title: 'Relancer maintenant',
        empty: 'Aucune relance en retard — tous les BC envoyés sont dans les 5 jours ouvrés.',
      },
      etaOverdue: {
        title: 'ETA dépassé',
        empty: 'Aucun BC après la date de livraison prévue.',
      },
      arrivingToday: {
        title: 'Arrivée aujourd\'hui',
        empty: '',
      },
      pendingApproval: {
        title: 'BC en attente d\'approbation',
        empty: 'Aucun BC en attente d\'approbation.',
      },
      receiptsApprove: {
        title: 'Réceptions à approuver',
        empty: 'Aucun bon de livraison en attente d\'approbation.',
      },
      overdueInvoices: {
        title: 'Factures en retard',
        empty: 'Aucune facture fournisseur en retard.',
      },
      partialOrders: {
        title: 'Commandes partielles',
        empty: 'Aucun BC avec des reliquats en attente.',
      },
      lowStock: {
        title: 'Stock faible — réapprovisionnement nécessaire',
        empty: 'Tous les articles sont au-dessus du seuil de réapprovisionnement.',
      },
    },
    badges: {
      daysOverdue: '{days}j de retard',
      etaWas:      'ETA était {date} (il y a {days}j)',
      partial:     'Partiel',
      unitsDate:   '{units} unités · {date}',
      due:         'Échéance {date}',
      stock:       'Stock : {current} / Min : {min}',
    },
  },

  es: {
    breadcrumbParent: 'Compras',
    breadcrumb:       'Acciones diarias',
    title:            'Panel de acciones diarias',
    subtitle:         'Todo lo que necesita atención hoy.',
    viewAll:          'Ver todo →',
    noVendor:         'Sin proveedor',
    summary: {
      totalActions:    'Acciones totales',
      urgent:          'Urgente',
      pendingApproval: 'Pendiente de aprobación',
      lowStock:        'Stock bajo',
    },
    allClear:     '¡Todo listo — no hay nada que atender hoy!',
    allClearHint: 'Vuelve mañana o después de crear nuevas OC.',
    sections: {
      followUp: {
        title: 'Seguir ahora',
        empty: 'Sin seguimientos pendientes — todas las OC enviadas están dentro de 5 días hábiles.',
      },
      etaOverdue: {
        title: 'ETA vencida',
        empty: 'Sin OC tras la fecha de llegada prevista.',
      },
      arrivingToday: {
        title: 'Llega hoy',
        empty: '',
      },
      pendingApproval: {
        title: 'OC pendientes de aprobación',
        empty: 'Sin OC pendientes de aprobación.',
      },
      receiptsApprove: {
        title: 'Recepciones para aprobar',
        empty: 'Sin albaranes pendientes de aprobación.',
      },
      overdueInvoices: {
        title: 'Facturas vencidas',
        empty: 'Sin facturas de proveedor vencidas.',
      },
      partialOrders: {
        title: 'Pedidos parciales',
        empty: 'Sin OC con pedidos pendientes.',
      },
      lowStock: {
        title: 'Stock bajo — se necesita reorden',
        empty: 'Todos los artículos están por encima del nivel de reorden.',
      },
    },
    badges: {
      daysOverdue: '{days}d vencido',
      etaWas:      'ETA era {date} (hace {days}d)',
      partial:     'Parcial',
      unitsDate:   '{units} unid. · {date}',
      due:         'Vence {date}',
      stock:       'Stock: {current} / Mín: {min}',
    },
  },

  nl: {
    breadcrumbParent: 'Inkoop',
    breadcrumb:       'Dagelijkse acties',
    title:            'Dagelijks actiedashboard',
    subtitle:         'Alles wat vandaag aandacht nodig heeft.',
    viewAll:          'Alles bekijken →',
    noVendor:         'Geen leverancier',
    summary: {
      totalActions:    'Totale acties',
      urgent:          'Dringend',
      pendingApproval: 'Wacht op goedkeuring',
      lowStock:        'Laag voorraad',
    },
    allClear:     'Alles klaar — er is vandaag niets dat aandacht nodig heeft!',
    allClearHint: 'Kom morgen terug of na het plaatsen van nieuwe inkooporders.',
    sections: {
      followUp: {
        title: 'Nu opvolgen',
        empty: 'Geen achterstallige opvolging — alle verzonden orders zijn binnen 5 werkdagen.',
      },
      etaOverdue: {
        title: 'ETA overschreden',
        empty: 'Geen orders na de verwachte aankomstdatum.',
      },
      arrivingToday: {
        title: 'Arriveert vandaag',
        empty: '',
      },
      pendingApproval: {
        title: 'Orders wachten op goedkeuring',
        empty: 'Geen orders wachten op goedkeuring.',
      },
      receiptsApprove: {
        title: 'Ontvangsten goed te keuren',
        empty: 'Geen pakbonnen wachten op goedkeuring.',
      },
      overdueInvoices: {
        title: 'Achterstallige facturen',
        empty: 'Geen achterstallige leveranciersfacturen.',
      },
      partialOrders: {
        title: 'Gedeeltelijke orders',
        empty: 'Geen orders met uitstaande nabestellingen.',
      },
      lowStock: {
        title: 'Lage voorraad — bijbestellen nodig',
        empty: 'Alle artikelen zijn boven het bestelniveau.',
      },
    },
    badges: {
      daysOverdue: '{days}d achterstallig',
      etaWas:      'ETA was {date} ({days}d geleden)',
      partial:     'Gedeeltelijk',
      unitsDate:   '{units} stuks · {date}',
      due:         'Vervalt {date}',
      stock:       'Voorraad: {current} / Min: {min}',
    },
  },

  ar: {
    breadcrumbParent: 'المشتريات',
    breadcrumb:       'الإجراءات اليومية',
    title:            'لوحة الإجراءات اليومية',
    subtitle:         'كل ما يحتاج إلى اهتمام اليوم.',
    viewAll:          'عرض الكل →',
    noVendor:         'بدون مورد',
    summary: {
      totalActions:    'إجمالي الإجراءات',
      urgent:          'عاجل',
      pendingApproval: 'في انتظار الموافقة',
      lowStock:        'مخزون منخفض',
    },
    allClear:     'كل شيء على ما يرام — لا يوجد شيء يحتاج اهتمامًا اليوم!',
    allClearHint: 'تحقق مرة أخرى غدًا أو بعد إنشاء أوامر شراء جديدة.',
    sections: {
      followUp: {
        title: 'متابعة الآن',
        empty: 'لا متابعات متأخرة — جميع الطلبات المرسلة خلال 5 أيام عمل.',
      },
      etaOverdue: {
        title: 'تأخر موعد الوصول',
        empty: 'لا طلبات شراء تجاوزت تاريخ الوصول المتوقع.',
      },
      arrivingToday: {
        title: 'وصول اليوم',
        empty: '',
      },
      pendingApproval: {
        title: 'طلبات شراء بانتظار الموافقة',
        empty: 'لا طلبات شراء بانتظار الموافقة.',
      },
      receiptsApprove: {
        title: 'إيصالات للموافقة',
        empty: 'لا إشعارات تسليم بانتظار الموافقة.',
      },
      overdueInvoices: {
        title: 'فواتير متأخرة',
        empty: 'لا فواتير موردين متأخرة.',
      },
      partialOrders: {
        title: 'طلبات جزئية',
        empty: 'لا طلبات شراء بطلبات معلقة.',
      },
      lowStock: {
        title: 'مخزون منخفض — يلزم إعادة الطلب',
        empty: 'جميع الأصناف فوق مستوى إعادة الطلب.',
      },
    },
    badges: {
      daysOverdue: 'متأخر {days} يوم',
      etaWas:      'كان الموعد {date} (منذ {days} يوم)',
      partial:     'جزئي',
      unitsDate:   '{units} وحدة · {date}',
      due:         'يستحق {date}',
      stock:       'المخزون: {current} / الحد: {min}',
    },
  },
}

const localeFiles = fs.readdirSync(LOCALES_DIR).filter(f => f.endsWith('.json'))

let updated = 0
for (const file of localeFiles) {
  const locale = file.replace('.json', '')
  const translation = translations[locale]
  if (!translation) {
    console.log(`⚠  No translation for locale "${locale}" — skipping`)
    continue
  }

  const filePath = path.join(LOCALES_DIR, file)
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'))

  json.daily = translation

  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8')
  console.log(`✓  Updated ${file}`)
  updated++
}

console.log(`\nDone — updated ${updated} locale files with "daily" namespace.`)
