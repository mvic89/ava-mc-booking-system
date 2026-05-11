// Adds the "purchase" namespace to all 9 message files.
// Run once: node scripts/add-purchase-i18n.js

const fs   = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, '..', 'messages');

const translations = {

en: {
  page:    { title: "Procurement", description: "Low stock alert → Create PO → system assigns Ref No. → use Ref No. on supplier portal." },
  topbar:  { title: "Purchase Orders", searchPlaceholder: "Search PO, vendor, item..." },
  buttons: { dailyActions: "📋 Daily Actions", importExcel: "⬆ Import Excel", createPo: "+ Create PO", importFromExcel: "⬆ Import from Excel" },
  filter:  { label: "Filter supplier:", allSuppliers: "All suppliers" },
  status:  { draft: "Draft", reviewed: "Reviewed", sent: "Sent", received: "Received", partial: "Partial", followUp: "⚠ Follow up — {days}d" },
  approval:{ pendingApproval: "🔐 Pending Approval", approved: "✓ Approved", rejected: "✗ Rejected" },
  summary: {
    totalPos: "Total POs", draft: "Draft", sent: "Sent", displayedValue: "Displayed Value",
    tips: {
      totalPos:       "All purchase orders ever created for your dealership, across every status.",
      draft:          "POs created but not yet reviewed or sent to a supplier.",
      sent:           "POs sent to the supplier and currently awaiting delivery or confirmation.",
      displayedValue: "Total cost of POs visible in the table below — updates when you change the status tab or supplier filter."
    }
  },
  metrics: {
    openPoValue: "Open PO Value", openPoInProgress: "{count, plural, one {# PO in progress} other {# POs in progress}}",
    thisMonthSpend: "This Month's Spend", posReceived: "{count, plural, one {# PO received} other {# POs received}}",
    outstandingClaims: "Outstanding Claims", claimsOpen: "{count, plural, one {# claim open} other {# claims open}}",
    tips: {
      openPoValue:       "Total cost of all outstanding POs — Draft, Reviewed, Sent, and Partial. This is your current financial commitment to suppliers.",
      thisMonthSpend:    "Total cost of POs marked as Received in the current calendar month.",
      outstandingClaims: "Total value of unresolved supplier claims — damaged goods, short deliveries, or wrong items — that are still open or submitted."
    }
  },
  tabs: {
    all: "All",
    tips: {
      all:      "Show all purchase orders regardless of status.",
      draft:    "POs created but not yet reviewed or sent to a supplier.",
      reviewed: "POs reviewed internally and ready to be placed with the supplier.",
      sent:     "POs sent to the supplier, awaiting delivery or confirmation.",
      received: "POs where all ordered goods have been fully received into inventory."
    }
  },
  cols:     { poNumber: "PO Number", refNo: "Ref No.", vendor: "Vendor", date: "Date", items: "Items", totalCost: "Total Cost", eta: "ETA", status: "Status" },
  scorecard:{
    title: "Supplier Performance", period: "— last 365 days", hide: "▲ Hide", show: "▼ Show",
    loading: "Loading…", noData: "No data yet — metrics appear once POs reach Sent / Received status.",
    cols: { supplier: "Supplier", pos: "POs", onTime: "On-Time %", backorder: "Backorder %", damage: "Damage %", leadTime: "Avg Lead Time" }
  },
  lowStock: { alert: "{count, plural, one {# item below reorder level} other {# items below reorder level}}", hint: "— click to view and create POs", viewButton: "View Low Stock →" },
  empty:    { title: "No purchase orders yet", description: "Import from Excel or create a PO manually", importButton: "⬆ Import from Excel", filtered: "No purchase orders match your filter" },
  items:    "{count, plural, one {# item} other {# items}}"
},

sv: {
  page:    { title: "Inköp", description: "Lager notis → Skapa IO → systemet tilldelar Ref-nr. → ange Ref-nr. på leverantörsportalen." },
  topbar:  { title: "Inköpsorder", searchPlaceholder: "Sök IO, leverantör, artikel..." },
  buttons: { dailyActions: "📋 Dagliga åtgärder", importExcel: "⬆ Importera Excel", createPo: "+ Skapa IO", importFromExcel: "⬆ Importera från Excel" },
  filter:  { label: "Filtrera leverantör:", allSuppliers: "Alla leverantörer" },
  status:  { draft: "Utkast", reviewed: "Granskad", sent: "Skickad", received: "Mottagen", partial: "Delvis", followUp: "⚠ Följ upp — {days}d" },
  approval:{ pendingApproval: "🔐 Väntar på godkännande", approved: "✓ Godkänd", rejected: "✗ Avvisad" },
  summary: {
    totalPos: "Totalt antal IO", draft: "Utkast", sent: "Skickad", displayedValue: "Visad summa",
    tips: {
      totalPos:       "Alla inköpsorder som skapats för din återförsäljare, i alla statusar.",
      draft:          "IO skapade men ännu inte granskade eller skickade till en leverantör.",
      sent:           "IO skickade till leverantören, inväntar leverans eller bekräftelse.",
      displayedValue: "Total kostnad för IO som visas i tabellen nedan — uppdateras när du ändrar statustabb eller leverantörsfilter."
    }
  },
  metrics: {
    openPoValue: "Öppet IO-värde", openPoInProgress: "{count, plural, one {# IO pågår} other {# IO pågår}}",
    thisMonthSpend: "Månadens inköp", posReceived: "{count, plural, one {# IO mottagen} other {# IO mottagna}}",
    outstandingClaims: "Utestående reklamationer", claimsOpen: "{count, plural, one {# reklamation öppen} other {# reklamationer öppna}}",
    tips: {
      openPoValue:       "Total kostnad för alla utestående IO — Utkast, Granskad, Skickad och Delvis. Detta är ditt nuvarande ekonomiska åtagande mot leverantörer.",
      thisMonthSpend:    "Total kostnad för IO markerade som Mottagna i den aktuella kalendermånaden.",
      outstandingClaims: "Totalt värde av olösta leverantörsreklamationer — skadade varor, underleveranser eller fel artiklar — som fortfarande är öppna eller inskickade."
    }
  },
  tabs: {
    all: "Alla",
    tips: {
      all:      "Visa alla inköpsorder oavsett status.",
      draft:    "IO skapade men ännu inte granskade eller skickade till en leverantör.",
      reviewed: "IO granskade internt och redo att läggas hos leverantören.",
      sent:     "IO skickade till leverantören, inväntar leverans eller bekräftelse.",
      received: "IO där alla beställda varor har tagits emot i lagret."
    }
  },
  cols:     { poNumber: "IO-nummer", refNo: "Ref-nr.", vendor: "Leverantör", date: "Datum", items: "Artiklar", totalCost: "Total kostnad", eta: "Förv. ankomst", status: "Status" },
  scorecard:{
    title: "Leverantörsprestanda", period: "— senaste 365 dagarna", hide: "▲ Dölj", show: "▼ Visa",
    loading: "Laddar…", noData: "Ingen data ännu — statistik visas när IO når status Skickad/Mottagen.",
    cols: { supplier: "Leverantör", pos: "IO", onTime: "I tid %", backorder: "Restorder %", damage: "Skador %", leadTime: "Genomsn. ledtid" }
  },
  lowStock: { alert: "{count, plural, one {# artikel under beställningsgräns} other {# artiklar under beställningsgräns}}", hint: "— klicka för att se och skapa IO", viewButton: "Visa lågt lager →" },
  empty:    { title: "Inga inköpsorder ännu", description: "Importera från Excel eller skapa en IO manuellt", importButton: "⬆ Importera från Excel", filtered: "Inga inköpsorder matchar ditt filter" },
  items:    "{count, plural, one {# artikel} other {# artiklar}}"
},

no: {
  page:    { title: "Innkjøp", description: "Lavt lager → Opprett IO → systemet tildeler Ref-nr. → bruk Ref-nr. på leverandørportalen." },
  topbar:  { title: "Innkjøpsordre", searchPlaceholder: "Søk IO, leverandør, vare..." },
  buttons: { dailyActions: "📋 Daglige handlinger", importExcel: "⬆ Importer Excel", createPo: "+ Opprett IO", importFromExcel: "⬆ Importer fra Excel" },
  filter:  { label: "Filtrer leverandør:", allSuppliers: "Alle leverandører" },
  status:  { draft: "Utkast", reviewed: "Gjennomgått", sent: "Sendt", received: "Mottatt", partial: "Delvis", followUp: "⚠ Følg opp — {days}d" },
  approval:{ pendingApproval: "🔐 Venter på godkjenning", approved: "✓ Godkjent", rejected: "✗ Avvist" },
  summary: {
    totalPos: "Totalt IO", draft: "Utkast", sent: "Sendt", displayedValue: "Vist verdi",
    tips: {
      totalPos:       "Alle innkjøpsordre opprettet for din forhandler, i alle statuser.",
      draft:          "IO opprettet men ennå ikke gjennomgått eller sendt til leverandør.",
      sent:           "IO sendt til leverandøren, avventer levering eller bekreftelse.",
      displayedValue: "Total kostnad for IO synlig i tabellen nedenfor — oppdateres når du endrer statusfane eller leverandørfilter."
    }
  },
  metrics: {
    openPoValue: "Åpen IO-verdi", openPoInProgress: "{count, plural, one {# IO pågår} other {# IO pågår}}",
    thisMonthSpend: "Månedens forbruk", posReceived: "{count, plural, one {# IO mottatt} other {# IO mottatt}}",
    outstandingClaims: "Utestående reklamasjoner", claimsOpen: "{count, plural, one {# reklamasjon åpen} other {# reklamasjoner åpne}}",
    tips: {
      openPoValue:       "Total kostnad for alle utestående IO — Utkast, Gjennomgått, Sendt og Delvis. Dette er ditt nåværende finansielle engasjement mot leverandører.",
      thisMonthSpend:    "Total kostnad for IO merket som Mottatt i inneværende kalendermåned.",
      outstandingClaims: "Total verdi av uløste leverandørreklamasjoner — skadde varer, kortleveranser eller feil varer — som fortsatt er åpne eller innsendt."
    }
  },
  tabs: {
    all: "Alle",
    tips: {
      all:      "Vis alle innkjøpsordre uavhengig av status.",
      draft:    "IO opprettet men ennå ikke gjennomgått eller sendt til leverandør.",
      reviewed: "IO internt gjennomgått og klar til å legges hos leverandøren.",
      sent:     "IO sendt til leverandøren, avventer levering eller bekreftelse.",
      received: "IO der alle bestilte varer er fullt mottatt til lager."
    }
  },
  cols:     { poNumber: "IO-nummer", refNo: "Ref-nr.", vendor: "Leverandør", date: "Dato", items: "Varer", totalCost: "Total kostnad", eta: "Forv. ankomst", status: "Status" },
  scorecard:{
    title: "Leverandørytelse", period: "— siste 365 dager", hide: "▲ Skjul", show: "▼ Vis",
    loading: "Laster…", noData: "Ingen data ennå — statistikk vises når IO når status Sendt/Mottatt.",
    cols: { supplier: "Leverandør", pos: "IO", onTime: "I tide %", backorder: "Restordre %", damage: "Skader %", leadTime: "Gj.sn. leveringstid" }
  },
  lowStock: { alert: "{count, plural, one {# vare under bestillingsnivå} other {# varer under bestillingsnivå}}", hint: "— klikk for å se og opprette IO", viewButton: "Se lavt lager →" },
  empty:    { title: "Ingen innkjøpsordre ennå", description: "Importer fra Excel eller opprett en IO manuelt", importButton: "⬆ Importer fra Excel", filtered: "Ingen innkjøpsordre matcher filteret ditt" },
  items:    "{count, plural, one {# vare} other {# varer}}"
},

da: {
  page:    { title: "Indkøb", description: "Lav beholdning → Opret IO → systemet tildeler Ref-nr. → brug Ref-nr. på leverandørportalen." },
  topbar:  { title: "Indkøbsordrer", searchPlaceholder: "Søg IO, leverandør, vare..." },
  buttons: { dailyActions: "📋 Daglige handlinger", importExcel: "⬆ Importer Excel", createPo: "+ Opret IO", importFromExcel: "⬆ Importer fra Excel" },
  filter:  { label: "Filtrer leverandør:", allSuppliers: "Alle leverandører" },
  status:  { draft: "Kladde", reviewed: "Gennemgået", sent: "Sendt", received: "Modtaget", partial: "Delvis", followUp: "⚠ Opfølgning — {days}d" },
  approval:{ pendingApproval: "🔐 Afventer godkendelse", approved: "✓ Godkendt", rejected: "✗ Afvist" },
  summary: {
    totalPos: "Antal IO", draft: "Kladde", sent: "Sendt", displayedValue: "Vist værdi",
    tips: {
      totalPos:       "Alle indkøbsordrer oprettet for din forhandler, på tværs af alle statusser.",
      draft:          "IO oprettet men endnu ikke gennemgået eller sendt til leverandør.",
      sent:           "IO sendt til leverandøren, afventer levering eller bekræftelse.",
      displayedValue: "Samlet kostnad for IO synlig i tabellen nedenfor — opdateres når du skifter statusfane eller leverandørfilter."
    }
  },
  metrics: {
    openPoValue: "Åben IO-værdi", openPoInProgress: "{count, plural, one {# IO igangværende} other {# IO igangværende}}",
    thisMonthSpend: "Månedens forbrug", posReceived: "{count, plural, one {# IO modtaget} other {# IO modtaget}}",
    outstandingClaims: "Udestående reklamationer", claimsOpen: "{count, plural, one {# reklamation åben} other {# reklamationer åbne}}",
    tips: {
      openPoValue:       "Samlet kostnad for alle udestående IO — Kladde, Gennemgået, Sendt og Delvis. Dette er dit nuværende finansielle tilsagn over for leverandører.",
      thisMonthSpend:    "Samlet kostnad for IO markeret som Modtaget i den aktuelle kalendermåned.",
      outstandingClaims: "Samlet værdi af uløste leverandørreklamationer — beskadigede varer, underleverancer eller forkerte varer — der stadig er åbne eller indsendte."
    }
  },
  tabs: {
    all: "Alle",
    tips: {
      all:      "Vis alle indkøbsordrer uanset status.",
      draft:    "IO oprettet men endnu ikke gennemgået eller sendt til leverandør.",
      reviewed: "IO internt gennemgået og klar til at blive placeret hos leverandøren.",
      sent:     "IO sendt til leverandøren, afventer levering eller bekræftelse.",
      received: "IO hvor alle bestilte varer er fuldt modtaget på lageret."
    }
  },
  cols:     { poNumber: "IO-nummer", refNo: "Ref-nr.", vendor: "Leverandør", date: "Dato", items: "Varer", totalCost: "Samlet kostnad", eta: "Forv. ankomst", status: "Status" },
  scorecard:{
    title: "Leverandørperformance", period: "— seneste 365 dage", hide: "▲ Skjul", show: "▼ Vis",
    loading: "Indlæser…", noData: "Ingen data endnu — statistik vises når IO når status Sendt/Modtaget.",
    cols: { supplier: "Leverandør", pos: "IO", onTime: "Til tiden %", backorder: "Restordre %", damage: "Skader %", leadTime: "Gns. leveringstid" }
  },
  lowStock: { alert: "{count, plural, one {# vare under genbestillingsniveau} other {# varer under genbestillingsniveau}}", hint: "— klik for at se og oprette IO", viewButton: "Se lavt lager →" },
  empty:    { title: "Ingen indkøbsordrer endnu", description: "Importer fra Excel eller opret en IO manuelt", importButton: "⬆ Importer fra Excel", filtered: "Ingen indkøbsordrer matcher dit filter" },
  items:    "{count, plural, one {# vare} other {# varer}}"
},

de: {
  page:    { title: "Einkauf", description: "Niedrigbestand → Bestellung erstellen → System weist Ref-Nr. zu → Ref-Nr. im Lieferantenportal verwenden." },
  topbar:  { title: "Bestellungen", searchPlaceholder: "Bestellung, Lieferant, Artikel suchen..." },
  buttons: { dailyActions: "📋 Tagesaufgaben", importExcel: "⬆ Excel importieren", createPo: "+ Bestellung erstellen", importFromExcel: "⬆ Aus Excel importieren" },
  filter:  { label: "Lieferant filtern:", allSuppliers: "Alle Lieferanten" },
  status:  { draft: "Entwurf", reviewed: "Geprüft", sent: "Gesendet", received: "Empfangen", partial: "Teilweise", followUp: "⚠ Nachverfolgen — {days}d" },
  approval:{ pendingApproval: "🔐 Genehmigung ausstehend", approved: "✓ Genehmigt", rejected: "✗ Abgelehnt" },
  summary: {
    totalPos: "Bestellungen gesamt", draft: "Entwurf", sent: "Gesendet", displayedValue: "Angezeigter Wert",
    tips: {
      totalPos:       "Alle jemals für Ihren Händler erstellten Bestellungen, über alle Status hinweg.",
      draft:          "Bestellungen erstellt, aber noch nicht geprüft oder an einen Lieferanten gesendet.",
      sent:           "An den Lieferanten gesendete Bestellungen, die auf Lieferung oder Bestätigung warten.",
      displayedValue: "Gesamtkosten der in der Tabelle unten sichtbaren Bestellungen — aktualisiert sich bei Änderung des Statusreiters oder Lieferantenfilters."
    }
  },
  metrics: {
    openPoValue: "Offener Bestellwert", openPoInProgress: "{count, plural, one {# Bestellung in Bearbeitung} other {# Bestellungen in Bearbeitung}}",
    thisMonthSpend: "Ausgaben diesen Monat", posReceived: "{count, plural, one {# Bestellung empfangen} other {# Bestellungen empfangen}}",
    outstandingClaims: "Ausstehende Reklamationen", claimsOpen: "{count, plural, one {# Reklamation offen} other {# Reklamationen offen}}",
    tips: {
      openPoValue:       "Gesamtkosten aller ausstehenden Bestellungen — Entwurf, Geprüft, Gesendet und Teilweise. Dies ist Ihre aktuelle finanzielle Verpflichtung gegenüber Lieferanten.",
      thisMonthSpend:    "Gesamtkosten der im laufenden Kalendermonat als Empfangen markierten Bestellungen.",
      outstandingClaims: "Gesamtwert ungelöster Lieferantenreklamationen — beschädigte Waren, Unterlieferungen oder falsche Artikel — die noch offen oder eingereicht sind."
    }
  },
  tabs: {
    all: "Alle",
    tips: {
      all:      "Alle Bestellungen unabhängig vom Status anzeigen.",
      draft:    "Bestellungen erstellt, aber noch nicht geprüft oder an einen Lieferanten gesendet.",
      reviewed: "Intern geprüfte Bestellungen, bereit zur Aufgabe beim Lieferanten.",
      sent:     "An den Lieferanten gesendete Bestellungen, die auf Lieferung oder Bestätigung warten.",
      received: "Bestellungen, bei denen alle bestellten Waren vollständig ins Lager eingegangen sind."
    }
  },
  cols:     { poNumber: "Bestellnummer", refNo: "Ref-Nr.", vendor: "Lieferant", date: "Datum", items: "Artikel", totalCost: "Gesamtkosten", eta: "Voraus. Ankunft", status: "Status" },
  scorecard:{
    title: "Lieferantenleistung", period: "— letzte 365 Tage", hide: "▲ Ausblenden", show: "▼ Einblenden",
    loading: "Wird geladen…", noData: "Noch keine Daten — Statistiken erscheinen, sobald Bestellungen den Status Gesendet/Empfangen erreichen.",
    cols: { supplier: "Lieferant", pos: "Bestell.", onTime: "Pünktlich %", backorder: "Rückstand %", damage: "Schäden %", leadTime: "Ø Lieferzeit" }
  },
  lowStock: { alert: "{count, plural, one {# Artikel unter Mindestbestand} other {# Artikel unter Mindestbestand}}", hint: "— klicken zum Anzeigen und Bestellungen erstellen", viewButton: "Niedrigen Bestand anzeigen →" },
  empty:    { title: "Noch keine Bestellungen", description: "Aus Excel importieren oder Bestellung manuell erstellen", importButton: "⬆ Aus Excel importieren", filtered: "Keine Bestellungen entsprechen Ihrem Filter" },
  items:    "{count, plural, one {# Artikel} other {# Artikel}}"
},

fr: {
  page:    { title: "Achats", description: "Alerte stock bas → Créer BC → le système attribue un Réf. → utiliser ce Réf. sur le portail fournisseur." },
  topbar:  { title: "Bons de commande", searchPlaceholder: "Rechercher BC, fournisseur, article..." },
  buttons: { dailyActions: "📋 Actions quotidiennes", importExcel: "⬆ Importer Excel", createPo: "+ Créer BC", importFromExcel: "⬆ Importer depuis Excel" },
  filter:  { label: "Filtrer fournisseur :", allSuppliers: "Tous les fournisseurs" },
  status:  { draft: "Brouillon", reviewed: "Révisé", sent: "Envoyé", received: "Reçu", partial: "Partiel", followUp: "⚠ Relance — {days}j" },
  approval:{ pendingApproval: "🔐 Approbation en attente", approved: "✓ Approuvé", rejected: "✗ Rejeté" },
  summary: {
    totalPos: "Total BC", draft: "Brouillon", sent: "Envoyé", displayedValue: "Valeur affichée",
    tips: {
      totalPos:       "Tous les bons de commande créés pour votre concession, quel que soit le statut.",
      draft:          "BC créés mais pas encore révisés ni envoyés à un fournisseur.",
      sent:           "BC envoyés au fournisseur, en attente de livraison ou de confirmation.",
      displayedValue: "Coût total des BC visibles dans le tableau ci-dessous — se met à jour lorsque vous changez l'onglet de statut ou le filtre fournisseur."
    }
  },
  metrics: {
    openPoValue: "Valeur BC ouverts", openPoInProgress: "{count, plural, one {# BC en cours} other {# BC en cours}}",
    thisMonthSpend: "Dépenses du mois", posReceived: "{count, plural, one {# BC reçu} other {# BC reçus}}",
    outstandingClaims: "Réclamations en suspens", claimsOpen: "{count, plural, one {# réclamation ouverte} other {# réclamations ouvertes}}",
    tips: {
      openPoValue:       "Coût total de tous les BC en attente — Brouillon, Révisé, Envoyé et Partiel. Il s'agit de votre engagement financier actuel envers les fournisseurs.",
      thisMonthSpend:    "Coût total des BC marqués comme Reçus dans le mois civil en cours.",
      outstandingClaims: "Valeur totale des réclamations fournisseurs non résolues — marchandises endommagées, livraisons incomplètes ou mauvais articles — encore ouvertes ou soumises."
    }
  },
  tabs: {
    all: "Tous",
    tips: {
      all:      "Afficher tous les bons de commande quel que soit leur statut.",
      draft:    "BC créés mais pas encore révisés ni envoyés à un fournisseur.",
      reviewed: "BC révisés en interne et prêts à être passés auprès du fournisseur.",
      sent:     "BC envoyés au fournisseur, en attente de livraison ou de confirmation.",
      received: "BC dont toutes les marchandises commandées ont été entièrement réceptionnées en stock."
    }
  },
  cols:     { poNumber: "N° de BC", refNo: "Réf.", vendor: "Fournisseur", date: "Date", items: "Articles", totalCost: "Coût total", eta: "Arrivée prévue", status: "Statut" },
  scorecard:{
    title: "Performance fournisseurs", period: "— 365 derniers jours", hide: "▲ Masquer", show: "▼ Afficher",
    loading: "Chargement…", noData: "Pas encore de données — les statistiques apparaissent une fois que les BC atteignent le statut Envoyé/Reçu.",
    cols: { supplier: "Fournisseur", pos: "BC", onTime: "À temps %", backorder: "Rupture %", damage: "Dommages %", leadTime: "Délai moy." }
  },
  lowStock: { alert: "{count, plural, one {# article sous le seuil de réapprovisionnement} other {# articles sous le seuil de réapprovisionnement}}", hint: "— cliquez pour voir et créer des BC", viewButton: "Voir stock bas →" },
  empty:    { title: "Aucun bon de commande pour l'instant", description: "Importez depuis Excel ou créez un BC manuellement", importButton: "⬆ Importer depuis Excel", filtered: "Aucun bon de commande ne correspond à votre filtre" },
  items:    "{count, plural, one {# article} other {# articles}}"
},

es: {
  page:    { title: "Compras", description: "Alerta stock bajo → Crear OC → el sistema asigna Ref. → usar Ref. en el portal del proveedor." },
  topbar:  { title: "Órdenes de compra", searchPlaceholder: "Buscar OC, proveedor, artículo..." },
  buttons: { dailyActions: "📋 Acciones diarias", importExcel: "⬆ Importar Excel", createPo: "+ Crear OC", importFromExcel: "⬆ Importar desde Excel" },
  filter:  { label: "Filtrar proveedor:", allSuppliers: "Todos los proveedores" },
  status:  { draft: "Borrador", reviewed: "Revisado", sent: "Enviado", received: "Recibido", partial: "Parcial", followUp: "⚠ Seguimiento — {days}d" },
  approval:{ pendingApproval: "🔐 Aprobación pendiente", approved: "✓ Aprobado", rejected: "✗ Rechazado" },
  summary: {
    totalPos: "Total OC", draft: "Borrador", sent: "Enviado", displayedValue: "Valor mostrado",
    tips: {
      totalPos:       "Todas las órdenes de compra creadas para su concesionario, en todos los estados.",
      draft:          "OC creadas pero aún no revisadas ni enviadas a un proveedor.",
      sent:           "OC enviadas al proveedor, pendientes de entrega o confirmación.",
      displayedValue: "Coste total de las OC visibles en la tabla de abajo — se actualiza al cambiar la pestaña de estado o el filtro de proveedor."
    }
  },
  metrics: {
    openPoValue: "Valor OC abiertas", openPoInProgress: "{count, plural, one {# OC en curso} other {# OC en curso}}",
    thisMonthSpend: "Gasto del mes", posReceived: "{count, plural, one {# OC recibida} other {# OC recibidas}}",
    outstandingClaims: "Reclamaciones pendientes", claimsOpen: "{count, plural, one {# reclamación abierta} other {# reclamaciones abiertas}}",
    tips: {
      openPoValue:       "Coste total de todas las OC pendientes — Borrador, Revisado, Enviado y Parcial. Este es su compromiso financiero actual con los proveedores.",
      thisMonthSpend:    "Coste total de las OC marcadas como Recibidas en el mes natural actual.",
      outstandingClaims: "Valor total de reclamaciones a proveedores sin resolver — mercancía dañada, entregas incompletas o artículos incorrectos — que siguen abiertas o enviadas."
    }
  },
  tabs: {
    all: "Todas",
    tips: {
      all:      "Mostrar todas las órdenes de compra independientemente del estado.",
      draft:    "OC creadas pero aún no revisadas ni enviadas a un proveedor.",
      reviewed: "OC revisadas internamente y listas para ser colocadas con el proveedor.",
      sent:     "OC enviadas al proveedor, pendientes de entrega o confirmación.",
      received: "OC donde todos los artículos pedidos han sido recibidos completamente en el inventario."
    }
  },
  cols:     { poNumber: "N.º de OC", refNo: "Ref.", vendor: "Proveedor", date: "Fecha", items: "Artículos", totalCost: "Coste total", eta: "Llegada prevista", status: "Estado" },
  scorecard:{
    title: "Rendimiento de proveedores", period: "— últimos 365 días", hide: "▲ Ocultar", show: "▼ Mostrar",
    loading: "Cargando…", noData: "Sin datos aún — las estadísticas aparecen cuando las OC alcanzan el estado Enviado/Recibido.",
    cols: { supplier: "Proveedor", pos: "OC", onTime: "A tiempo %", backorder: "Reserva %", damage: "Daños %", leadTime: "Plazo medio" }
  },
  lowStock: { alert: "{count, plural, one {# artículo por debajo del nivel de reposición} other {# artículos por debajo del nivel de reposición}}", hint: "— haga clic para ver y crear OC", viewButton: "Ver stock bajo →" },
  empty:    { title: "Aún no hay órdenes de compra", description: "Importe desde Excel o cree una OC manualmente", importButton: "⬆ Importar desde Excel", filtered: "Ninguna orden de compra coincide con su filtro" },
  items:    "{count, plural, one {# artículo} other {# artículos}}"
},

nl: {
  page:    { title: "Inkoop", description: "Laag voorraad alert → Maak IO aan → systeem wijst Ref-nr. toe → gebruik Ref-nr. op leveranciersportaal." },
  topbar:  { title: "Inkooporders", searchPlaceholder: "Zoek IO, leverancier, artikel..." },
  buttons: { dailyActions: "📋 Dagelijkse acties", importExcel: "⬆ Excel importeren", createPo: "+ IO aanmaken", importFromExcel: "⬆ Importeren uit Excel" },
  filter:  { label: "Filter leverancier:", allSuppliers: "Alle leveranciers" },
  status:  { draft: "Concept", reviewed: "Beoordeeld", sent: "Verzonden", received: "Ontvangen", partial: "Gedeeltelijk", followUp: "⚠ Opvolging — {days}d" },
  approval:{ pendingApproval: "🔐 Goedkeuring in behandeling", approved: "✓ Goedgekeurd", rejected: "✗ Afgewezen" },
  summary: {
    totalPos: "Totaal IO", draft: "Concept", sent: "Verzonden", displayedValue: "Weergegeven waarde",
    tips: {
      totalPos:       "Alle inkooporders ooit aangemaakt voor uw dealership, over alle statussen heen.",
      draft:          "IO aangemaakt maar nog niet beoordeeld of verzonden naar een leverancier.",
      sent:           "IO verzonden naar de leverancier, in afwachting van levering of bevestiging.",
      displayedValue: "Totale kosten van IO zichtbaar in de tabel hieronder — wordt bijgewerkt wanneer u het statustabblad of leveranciersfilter wijzigt."
    }
  },
  metrics: {
    openPoValue: "Waarde open IO", openPoInProgress: "{count, plural, one {# IO in behandeling} other {# IO in behandeling}}",
    thisMonthSpend: "Uitgaven deze maand", posReceived: "{count, plural, one {# IO ontvangen} other {# IO ontvangen}}",
    outstandingClaims: "Uitstaande claims", claimsOpen: "{count, plural, one {# claim open} other {# claims open}}",
    tips: {
      openPoValue:       "Totale kosten van alle uitstaande IO — Concept, Beoordeeld, Verzonden en Gedeeltelijk. Dit is uw huidige financiële verplichting aan leveranciers.",
      thisMonthSpend:    "Totale kosten van IO gemarkeerd als Ontvangen in de huidige kalendermaand.",
      outstandingClaims: "Totale waarde van onopgeloste leveranciersclaims — beschadigde goederen, kortleveringen of verkeerde artikelen — die nog open of ingediend zijn."
    }
  },
  tabs: {
    all: "Alle",
    tips: {
      all:      "Toon alle inkooporders ongeacht de status.",
      draft:    "IO aangemaakt maar nog niet beoordeeld of verzonden naar een leverancier.",
      reviewed: "Intern beoordeelde IO, klaar om bij de leverancier te worden geplaatst.",
      sent:     "IO verzonden naar de leverancier, in afwachting van levering of bevestiging.",
      received: "IO waarbij alle bestelde goederen volledig zijn ontvangen in het magazijn."
    }
  },
  cols:     { poNumber: "IO-nummer", refNo: "Ref-nr.", vendor: "Leverancier", date: "Datum", items: "Artikelen", totalCost: "Totale kosten", eta: "Verw. aankomst", status: "Status" },
  scorecard:{
    title: "Leveranciersprestaties", period: "— laatste 365 dagen", hide: "▲ Verbergen", show: "▼ Tonen",
    loading: "Laden…", noData: "Nog geen gegevens — statistieken verschijnen zodra IO de status Verzonden/Ontvangen bereiken.",
    cols: { supplier: "Leverancier", pos: "IO", onTime: "Op tijd %", backorder: "Nalevering %", damage: "Schade %", leadTime: "Gem. doorlooptijd" }
  },
  lowStock: { alert: "{count, plural, one {# artikel onder bestelniveau} other {# artikelen onder bestelniveau}}", hint: "— klik om te bekijken en IO aan te maken", viewButton: "Laag voorraad bekijken →" },
  empty:    { title: "Nog geen inkooporders", description: "Importeer uit Excel of maak handmatig een IO aan", importButton: "⬆ Importeren uit Excel", filtered: "Geen inkooporders komen overeen met uw filter" },
  items:    "{count, plural, one {# artikel} other {# artikelen}}"
},

ar: {
  page:    { title: "المشتريات", description: "تنبيه مخزون منخفض ← إنشاء أمر شراء ← يقوم النظام بتعيين رقم مرجعي ← استخدم الرقم المرجعي في بوابة المورد." },
  topbar:  { title: "أوامر الشراء", searchPlaceholder: "ابحث عن أمر شراء، مورد، مقال..." },
  buttons: { dailyActions: "📋 الإجراءات اليومية", importExcel: "⬆ استيراد Excel", createPo: "+ إنشاء أمر شراء", importFromExcel: "⬆ استيراد من Excel" },
  filter:  { label: "تصفية المورد:", allSuppliers: "جميع الموردين" },
  status:  { draft: "مسودة", reviewed: "تمت المراجعة", sent: "مُرسَل", received: "مُستلَم", partial: "جزئي", followUp: "⚠ متابعة — {days}ي" },
  approval:{ pendingApproval: "🔐 في انتظار الموافقة", approved: "✓ معتمد", rejected: "✗ مرفوض" },
  summary: {
    totalPos: "إجمالي أوامر الشراء", draft: "مسودة", sent: "مُرسَل", displayedValue: "القيمة المعروضة",
    tips: {
      totalPos:       "جميع أوامر الشراء التي تم إنشاؤها لوكالتك، عبر جميع الحالات.",
      draft:          "أوامر شراء تم إنشاؤها ولكن لم تتم مراجعتها أو إرسالها إلى مورد بعد.",
      sent:           "أوامر شراء مرسلة إلى المورد، في انتظار التسليم أو التأكيد.",
      displayedValue: "إجمالي تكلفة أوامر الشراء المرئية في الجدول أدناه — يتحدث عند تغيير تبويب الحالة أو مرشح المورد."
    }
  },
  metrics: {
    openPoValue: "قيمة أوامر الشراء المفتوحة", openPoInProgress: "{count, plural, one {# أمر شراء قيد التنفيذ} other {# أوامر شراء قيد التنفيذ}}",
    thisMonthSpend: "إنفاق هذا الشهر", posReceived: "{count, plural, one {# أمر شراء مستلم} other {# أوامر شراء مستلمة}}",
    outstandingClaims: "المطالبات المعلقة", claimsOpen: "{count, plural, one {# مطالبة مفتوحة} other {# مطالبات مفتوحة}}",
    tips: {
      openPoValue:       "إجمالي تكلفة جميع أوامر الشراء المعلقة — مسودة، تمت المراجعة، مُرسَل، وجزئي. هذا هو التزامك المالي الحالي تجاه الموردين.",
      thisMonthSpend:    "إجمالي تكلفة أوامر الشراء المُصنَّفة كمستلمة في الشهر التقويمي الحالي.",
      outstandingClaims: "إجمالي قيمة مطالبات الموردين غير المحلولة — بضائع تالفة، أو تسليمات ناقصة، أو مقالات خاطئة — لا تزال مفتوحة أو مُقدَّمة."
    }
  },
  tabs: {
    all: "الكل",
    tips: {
      all:      "عرض جميع أوامر الشراء بغض النظر عن الحالة.",
      draft:    "أوامر شراء تم إنشاؤها ولكن لم تتم مراجعتها أو إرسالها إلى مورد بعد.",
      reviewed: "أوامر شراء تمت مراجعتها داخليًا وجاهزة للوضع لدى المورد.",
      sent:     "أوامر شراء مرسلة إلى المورد، في انتظار التسليم أو التأكيد.",
      received: "أوامر الشراء حيث تم استلام جميع البضائع المطلوبة بالكامل في المخزون."
    }
  },
  cols:     { poNumber: "رقم أمر الشراء", refNo: "رقم مرجعي", vendor: "المورد", date: "التاريخ", items: "المقالات", totalCost: "التكلفة الإجمالية", eta: "الوصول المتوقع", status: "الحالة" },
  scorecard:{
    title: "أداء الموردين", period: "— آخر 365 يومًا", hide: "▲ إخفاء", show: "▼ عرض",
    loading: "جارٍ التحميل…", noData: "لا توجد بيانات بعد — تظهر الإحصائيات عندما تصل أوامر الشراء إلى حالة مُرسَل/مُستلَم.",
    cols: { supplier: "المورد", pos: "أوامر الشراء", onTime: "في الوقت %", backorder: "الطلب المتأخر %", damage: "الأضرار %", leadTime: "متوسط وقت التسليم" }
  },
  lowStock: { alert: "{count, plural, one {# مقال تحت مستوى إعادة الطلب} other {# مقالات تحت مستوى إعادة الطلب}}", hint: "— انقر للعرض وإنشاء أوامر الشراء", viewButton: "عرض المخزون المنخفض ←" },
  empty:    { title: "لا توجد أوامر شراء بعد", description: "استورد من Excel أو أنشئ أمر شراء يدويًا", importButton: "⬆ استيراد من Excel", filtered: "لا توجد أوامر شراء تطابق الفلتر الخاص بك" },
  items:    "{count, plural, one {# مقال} other {# مقالات}}"
},

};

let updated = 0;
for (const [locale, purchase] of Object.entries(translations)) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  const raw  = fs.readFileSync(filePath, 'utf8');
  const json = JSON.parse(raw);
  if (json.purchase && JSON.stringify(json.purchase).includes('"page"')) {
    console.log(`${locale}.json — already has full structure, skipping`);
    continue;
  }
  if (json.purchase) {
    console.log(`${locale}.json — replacing old flat structure`)
  }
  json.purchase = purchase;
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`${locale}.json — ✅ added purchase namespace`);
  updated++;
}
console.log(`\nDone. ${updated} file(s) updated.`);
